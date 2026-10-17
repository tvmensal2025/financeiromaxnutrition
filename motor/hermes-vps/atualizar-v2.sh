#!/usr/bin/env bash
# Prepara uma nova versão da Helena v2 sem tocar no serviço em produção.
# Uso: atualizar-v2.sh --bundle ARQUIVO --commit SHA40 --current-repo DIR
#       --baseline SHA40 --dest DIR_PRIVADO [--prepare]
# Sem --prepare: verifica bundle, ancestralidade e migrations num clone temporário.
# Com --prepare: instala venvs novos e roda verificações locais; nunca ativa a versão.
set -euo pipefail
umask 077

falhar() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }
ajuda() {
  echo 'Uso: atualizar-v2.sh --bundle ARQUIVO --commit SHA40 --current-repo DIR --baseline SHA40 --dest DIR_PRIVADO [--prepare]' >&2
  exit 2
}

bundle='' commit='' current_repo='' baseline='' staging_root='' prepare=0
while (($#)); do
  case "$1" in
    --bundle|--commit|--current-repo|--baseline|--dest)
      (($# >= 2)) || ajuda
      case "$1" in
        --bundle) bundle=$2 ;; --commit) commit=$2 ;;
        --current-repo) current_repo=$2 ;; --baseline) baseline=$2 ;;
        --dest) staging_root=$2 ;;
      esac
      shift 2 ;;
    --prepare) prepare=1; shift ;;
    *) ajuda ;;
  esac
done
[[ $commit =~ ^[0-9a-f]{40}$ && $baseline =~ ^[0-9a-f]{40}$ ]] || falhar 'commit e baseline devem ser SHA-1 completos (40 hexadecimais minúsculos).'
[[ -f $bundle && ! -L $bundle ]] || falhar 'bundle ausente ou link simbólico.'
[[ -d $current_repo && -d $staging_root && ! -L $staging_root ]] || falhar 'checkout ou diretório de staging ausente; staging não pode ser link simbólico.'
for comando in git stat realpath mktemp sha256sum cmp; do command -v "$comando" >/dev/null || falhar "falta $comando"; done
bundle=$(realpath -- "$bundle")
current_repo=$(realpath -- "$current_repo")
staging_root=$(realpath -- "$staging_root")
[[ $staging_root != "$current_repo" && $staging_root != "$current_repo"/* && $current_repo != "$staging_root"/* ]] || falhar 'staging e checkout atual não podem conter um ao outro.'
[[ $(stat -c %u -- "$staging_root") == "$(id -u)" ]] || falhar 'staging deve pertencer ao usuário atual.'
perms=$(stat -c %a -- "$staging_root")
(( (8#$perms & 0077) == 0 )) || falhar 'staging deve ser privado (sem permissões de grupo/outros).'
[[ $(git -C "$current_repo" rev-parse --show-toplevel) == "$current_repo" ]] || falhar 'current-repo deve ser a raiz de um checkout Git.'
[[ $(git -C "$current_repo" rev-parse HEAD) == "$baseline" ]] || falhar 'HEAD atual diverge do baseline informado.'
[[ -z $(git -C "$current_repo" status --porcelain=v1 --untracked-files=normal) ]] || falhar 'checkout atual contém alterações; inventarie antes de atualizar.'
git -C "$current_repo" bundle verify "$bundle" >/dev/null || falhar 'bundle inválido ou incompleto.'

final_dir="$staging_root/$commit"
[[ ! -e $final_dir && ! -L $final_dir ]] || falhar 'release já existe; não sobrescrever.'
if ((prepare)); then
  for comando in uv python3.13; do command -v "$comando" >/dev/null || falhar "falta $comando"; done
  mkdir -m 0700 -- "$final_dir" || falhar 'não foi possível criar release exclusivo.'
  temp_dir=$final_dir
else
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/helena-check.XXXXXXXX")
fi
limpar() { [[ -z ${temp_dir:-} ]] || rm -rf -- "$temp_dir"; }
trap limpar EXIT
git clone --quiet --no-checkout -- "$bundle" "$temp_dir/repo" || falhar 'não foi possível clonar o bundle isoladamente.'
git -C "$temp_dir/repo" cat-file -e "$commit^{commit}" || falhar 'commit não está no bundle.'
git -C "$temp_dir/repo" cat-file -e "$baseline^{commit}" || falhar 'baseline não está no bundle.'
git -C "$temp_dir/repo" merge-base --is-ancestor "$baseline" "$commit" || falhar 'novo commit não descende do baseline.'
git -C "$temp_dir/repo" checkout --quiet --detach "$commit"
[[ $(git -C "$temp_dir/repo" rev-parse HEAD) == "$commit" ]] || falhar 'checkout divergiu do commit esperado.'
[[ -z $(git -C "$temp_dir/repo" status --porcelain=v1 --untracked-files=normal) ]] || falhar 'release extraído com alterações.'

# Compara todas as migrations presentes no checkout anterior, inclusive as
# posteriores à 0023. O estado aplicado no banco requer conferência separada;
# o staging nunca consulta ou executa SQL.
shopt -s nullglob
declare -A baseline_migrations=() incoming_migrations=()
baseline_latest=0 incoming_latest=0
for source in baseline incoming; do
  if [[ $source == baseline ]]; then migration_root="$current_repo"; else migration_root="$temp_dir/repo"; fi
  migrations=("$migration_root"/supabase/migrations-v2/*.sql)
  for migration in "${migrations[@]}"; do
    filename=${migration##*/}
    [[ $filename =~ ^([0-9]{4})_.+\.sql$ ]] || falhar "migration com nome inválido no $source: $filename"
    [[ -f $migration && ! -L $migration ]] || falhar "migration não é arquivo regular no $source: $filename"
    number=$((10#${BASH_REMATCH[1]}))
    ((number > 0)) || falhar "migration 0000 inválida no $source."
    if [[ $source == baseline ]]; then
      [[ -z ${baseline_migrations[$number]:-} ]] || falhar "migration duplicada no baseline: $filename"
      baseline_migrations[$number]=$migration
      if ((number > baseline_latest)); then baseline_latest=$number; fi
    else
      [[ -z ${incoming_migrations[$number]:-} ]] || falhar "migration duplicada no release: $filename"
      incoming_migrations[$number]=$migration
      if ((number > incoming_latest)); then incoming_latest=$number; fi
    fi
  done
done
((baseline_latest > 0)) || falhar 'baseline não contém a migration 0001.'
((incoming_latest >= 26)) || falhar 'release precisa conter pelo menos as migrations 0001–0026.'
for ((number=1; number<=incoming_latest; number++)); do
  printf -v prefix '%04d' "$number"
  [[ -n ${incoming_migrations[$number]:-} ]] || falhar "release tem lacuna na migration $prefix."
done
for ((number=1; number<=baseline_latest; number++)); do
  printf -v prefix '%04d' "$number"
  previous=${baseline_migrations[$number]:-}
  incoming=${incoming_migrations[$number]:-}
  [[ -n $previous ]] || falhar "baseline tem lacuna na migration $prefix."
  [[ -n $incoming ]] || falhar "migration $prefix do baseline ausente no release."
  [[ ${previous##*/} == ${incoming##*/} ]] || falhar "migration $prefix mudou de nome."
  cmp -s -- "$previous" "$incoming" || falhar "migration $prefix do baseline foi alterada."
done
for required in motor/orquestrador/requirements.txt motor/executor/requirements-hermes-real.txt motor/hermes-vps/patch-hermes-auth.py motor/hermes-vps/testar-patch-hermes-auth.py; do
  [[ -f "$temp_dir/repo/$required" ]] || falhar "arquivo obrigatório ausente: $required"
done
printf 'OK: baseline=%s release=%s bundle_sha256=%s; migrations do checkout 0001–%04d iguais, release contém 0001–%04d.\n' \
  "$baseline" "$commit" "$(sha256sum "$bundle" | cut -d' ' -f1)" "$baseline_latest" "$incoming_latest"
if ((!prepare)); then
  echo 'DRY RUN: nenhuma dependência instalada; nenhum serviço, banco ou ambiente alterado.'
  exit 0
fi

# Isola credenciais de produção dos instaladores de dependências e testes locais.
limpo() {
  local nome
  local -a vars=("PATH=$PATH" "HOME=$temp_dir" "UV_CACHE_DIR=$staging_root/.uv-cache")
  for nome in HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy \
              SSL_CERT_FILE REQUESTS_CA_BUNDLE CURL_CA_BUNDLE; do
    [[ -z ${!nome:-} ]] || vars+=("$nome=${!nome}")
  done
  env -i "${vars[@]}" "$@"
}
limpo uv pip compile --generate-hashes --python-version 3.13 \
  --output-file "$temp_dir/motor.lock" "$temp_dir/repo/motor/orquestrador/requirements.txt" >/dev/null
limpo uv venv --python python3.13 "$temp_dir/venv-motor"
limpo uv pip sync --require-hashes --python "$temp_dir/venv-motor/bin/python" "$temp_dir/motor.lock"
limpo "$temp_dir/venv-motor/bin/python" -c 'import dbos, psycopg, yaml, jsonschema'
limpo uv pip compile --generate-hashes --python-version 3.13 \
  --output-file "$temp_dir/hermes.lock" "$temp_dir/repo/motor/executor/requirements-hermes-real.txt" >/dev/null
limpo uv venv --python python3.13 "$temp_dir/venv-hermes"
limpo uv pip sync --require-hashes --python "$temp_dir/venv-hermes/bin/python" "$temp_dir/hermes.lock"
site_packages=$(limpo "$temp_dir/venv-hermes/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
limpo "$temp_dir/venv-hermes/bin/python" "$temp_dir/repo/motor/hermes-vps/patch-hermes-auth.py" "$site_packages"
limpo "$temp_dir/venv-hermes/bin/python" "$temp_dir/repo/motor/hermes-vps/testar-patch-hermes-auth.py"
limpo "$temp_dir/venv-hermes/bin/python" -c 'import importlib.metadata as m; assert m.version("hermes-agent") == "0.19.0"'
motor_path="$temp_dir/repo/motor/orquestrador:$temp_dir/repo/motor/executor:$temp_dir/repo/motor/validador:$temp_dir/repo/motor/ferramentas"
limpo env PYTHONPATH="$motor_path" "$temp_dir/venv-motor/bin/python" -m pytest -q \
  "$temp_dir/repo/motor/orquestrador/testes/test_configuracao.py" \
  "$temp_dir/repo/motor/orquestrador/testes/test_bancos.py"
cat > "$temp_dir/RELEASE.txt" <<EOF
baseline=$baseline
commit=$commit
bundle_sha256=$(sha256sum "$bundle" | cut -d' ' -f1)
motor_lock_sha256=$(sha256sum "$temp_dir/motor.lock" | cut -d' ' -f1)
hermes_lock_sha256=$(sha256sum "$temp_dir/hermes.lock" | cut -d' ' -f1)
validated_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
status=STAGED_ONLY
EOF
temp_dir=''
printf 'OK: release validado em %s; não ativado.\n' "$final_dir"
