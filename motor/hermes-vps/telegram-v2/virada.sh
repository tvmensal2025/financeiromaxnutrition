#!/usr/bin/env bash
# virada.sh — pacote de virada do Telegram: do poller do Hermes 0.15.1 para o adapter inbox-worker (Helena v2).
#
# O que é: etapas repetíveis para o FUNDADOR rodar como root NA VPS, uma por vez, na instalação real do
#   Hermes 0.15.1 (v2026.5.29, commit e71a2bd1…): inventario, backup, ensaiar, instalar, parar-poller,
#   iniciar, estado, reverter. Roteiro completo: docs/manual/virada-telegram-passo-a-passo.md.
# Como mudar: constantes e padrões no começo deste arquivo; cada etapa é uma função cmd_<nome>. Mudou o
#   patch ou o adapter? Atualize hashes em patch-hermes-telegram.py (este script não repete hashes) e rode
#   test_virada.py. Nunca imprima valores de .env, auth.json, token ou segredo: só nomes, contagens, modos.
#
# Garantias (conferidas por test_virada.py com diretórios temporários e um systemctl simulado):
#   * nenhuma etapa chama a API do Telegram (setWebhook/deleteWebhook/getWebhookInfo ficam no roteiro, com o
#     token lido pelo próprio fundador); a única chamada de rede é `estado --testar-edge`, à Edge da v2.
#   * o segredo do worker entra só por stdin (oculto se for terminal), nunca por argumento nem por variável
#     exportada; é gravado em /etc/helena-v2/telegram-worker.env com umask 077.
#   * TELEGRAM_BOT_TOKEN nunca vai para o ambiente do serviço novo: instalar o remove do .env (o valor
#     fica só no backup) e recusa se o token estiver em config.yaml/unidade/outro arquivo de ambiente.
#   * `instalar` exige --producao e backup válido; o patch (commit + hashes) é verificado por
#     patch-hermes-telegram.py; qualquer falha desfaz o que a execução fez.
#
# Uso: bash virada.sh <etapa> [opções]   (bash virada.sh ajuda)
set -uo pipefail
set +x
export LC_ALL=C
umask 077
unset TELEGRAM_BOT_TOKEN WORKER_SECRET 2>/dev/null || true

AQUI="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PIN_COMMIT="e71a2bd11b733f3be7cf99deafde0066c343d462"
BROKER_URL="https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram"
DROPIN_NOME="helena-v2-telegram.conf"
TESTE="${HELENA_VIRADA_TESTE:-0}"

HERMES_DIR="${HERMES_DIR:-/usr/local/lib/hermes-agent}"
HERMES_HOME="${HERMES_HOME:-/root/.hermes}"
HERMES_UNIT="${HERMES_UNIT:-hermes-gateway.service}"
HERMES_SCOPE="${HERMES_SCOPE:-}"        # user | system | vazio = detectar (o instalar.sh cria a unidade em escopo user)
PATCHER="$AQUI/patch-hermes-telegram.py"
ESPERA_S=30
ENSAIO_TESTES=1

if [ "$TESTE" = 1 ]; then
  # Modo de teste: caminhos temporários obrigatórios; recusa tocar nos caminhos reais da VPS.
  ETC_DIR="${HELENA_ETC_DIR:?defina HELENA_ETC_DIR}"
  BACKUP_BASE="${HELENA_BACKUP_BASE:?defina HELENA_BACKUP_BASE}"
  USER_UNIT_DIR="${HELENA_USER_UNIT_DIR:?defina HELENA_USER_UNIT_DIR}"
  SYSTEM_UNIT_DIR="${HELENA_SYSTEM_UNIT_DIR:?defina HELENA_SYSTEM_UNIT_DIR}"
  PATCHER="${HELENA_VIRADA_PATCHER:-$PATCHER}"
  PIN_COMMIT="${HELENA_VIRADA_PIN:-$PIN_COMMIT}"   # só para repositórios sintéticos de teste
  ESPERA_S="${HELENA_VIRADA_ESPERA_S:-3}"
  ENSAIO_TESTES="${HELENA_VIRADA_ENSAIO_TESTES:-1}"
  if [ "$HERMES_DIR" = /usr/local/lib/hermes-agent ] || [ "$HERMES_HOME" = /root/.hermes ] || [ "$ETC_DIR" = /etc/helena-v2 ]; then
    printf 'ERRO: modo de teste recusa caminhos reais da VPS.\n' >&2; exit 1
  fi
  printf 'MODO DE TESTE ativo (HELENA_VIRADA_TESTE=1): nada disto deve ser usado na VPS.\n' >&2
else
  ETC_DIR=/etc/helena-v2
  BACKUP_BASE=/root
  USER_UNIT_DIR=/root/.config/systemd/user
  SYSTEM_UNIT_DIR=/etc/systemd/system
fi
WORKER_ENV="$ETC_DIR/telegram-worker.env"

# Git confia só neste diretório (somente para este processo e filhos, inclusive o patcher).
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$HERMES_DIR"

ok()    { printf 'OK: %s\n' "$*"; }
info()  { printf '%s\n' "$*"; }
resultado() { printf '\nRESULTADO: %s\n' "$*"; }
aviso() { printf 'ATENÇÃO: %s\n' "$*"; }
falha() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }
titulo() { printf '\n[%s]\n' "$*"; }
mask()  { sed -E 's/[0-9]{6,}:[A-Za-z0-9_-]{25,}/<TOKEN-OCULTO>/g'; }

exigir_root() { [ "$TESTE" = 1 ] || [ "$(id -u)" = 0 ] || falha "rode como root."; }
tem() { command -v "$1" >/dev/null 2>&1; }

sha() { if [ -f "$1" ]; then sha256sum -- "$1" | cut -d' ' -f1; else printf 'ausente'; fi; }
modo_dono() { stat -c '%a %U:%G' -- "$1" 2>/dev/null || printf 'ausente'; }
data_hora() { date +%Y%m%d-%H%M%S; }

# ---------------------------------------------------------------- systemd

ESCOPO=""; UNIT=""; ERRO_UNIDADE=""; UNIDADE_OK=0; ENSAIO_WORK=""

sc() {
  if [ "$ESCOPO" = user ]; then
    local rt="/run/user/$(id -u)"
    XDG_RUNTIME_DIR="$rt" DBUS_SESSION_BUS_ADDRESS="unix:path=$rt/bus" timeout 60 systemctl --user "$@"
  else
    timeout 60 systemctl "$@"
  fi
}
unit_prop() { sc show "$UNIT" -p "$1" --value 2>/dev/null; }

# Acha a unidade do Hermes 0.15.1 do Telegram. Nunca aceita unidades do motor v2 (helena-*).
detectar_unidade() {
  ERRO_UNIDADE=""; UNIDADE_OK=0
  [[ "$HERMES_UNIT" =~ ^[A-Za-z0-9@._-]+\.service$ ]] || { ERRO_UNIDADE="nome de unidade inválido: $HERMES_UNIT"; return 1; }
  case "$HERMES_UNIT" in
    helena-*|*despachante*|*vigia*|*relogio*) ERRO_UNIDADE="recuso a unidade $HERMES_UNIT: é do motor v2, não do Telegram"; return 1 ;;
  esac
  UNIT="$HERMES_UNIT"
  tem systemctl || { ERRO_UNIDADE="systemctl indisponível"; return 1; }
  local escopos load=""
  if [ -n "$HERMES_SCOPE" ]; then escopos="$HERMES_SCOPE"; else escopos="user system"; fi
  for ESCOPO in $escopos; do
    case "$ESCOPO" in user|system) ;; *) ERRO_UNIDADE="HERMES_SCOPE deve ser user ou system"; return 1 ;; esac
    load="$(unit_prop LoadState)"
    [ "$load" = loaded ] && break
  done
  if [ "$load" != loaded ]; then
    ERRO_UNIDADE="unidade $UNIT não encontrada (escopos testados: $escopos). Se o nome for outro: HERMES_UNIT=<nome>.service HERMES_SCOPE=user|system bash virada.sh ... (escopo user: a sessão do root precisa existir — loginctl enable-linger root && systemctl start user@0.service)"
    return 1
  fi
  case "$(unit_prop ExecStart)" in
    *"$HERMES_DIR/venv/"*) ;;
    *) ERRO_UNIDADE="a unidade $UNIT (escopo $ESCOPO) não executa $HERMES_DIR/venv: não é o Hermes 0.15.1 do Telegram"; return 1 ;;
  esac
  UNIDADE_OK=1
  return 0
}
exigir_unidade() { detectar_unidade || falha "$ERRO_UNIDADE"; }

dropin_dir() {
  if [ "$ESCOPO" = user ]; then printf '%s/%s.d' "$USER_UNIT_DIR" "$UNIT"; else printf '%s/%s.d' "$SYSTEM_UNIT_DIR" "$UNIT"; fi
}
dropin_arquivo() { printf '%s/%s' "$(dropin_dir)" "$DROPIN_NOME"; }

# ---------------------------------------------------------------- processos e tokens

# Processos do gateway do Hermes 0.15.1 (pelo caminho do venv); o padrão vai por ambiente para o awk não casar consigo mesmo.
procs_hermes() {
  ps -ww -eo pid=,user=,etime=,args= 2>/dev/null \
    | D="$HERMES_DIR/venv/" awk 'index($0, ENVIRON["D"]) && index($0, "gate" "way")' | mask
}
pids_hermes() { procs_hermes | awk '{print $1}'; }

token_em_arquivo() { [ -f "$1" ] && grep -Eq '^[[:space:]]*(export[[:space:]]+)?TELEGRAM_BOT_TOKEN[[:space:]]*=' "$1"; }
# Linhas (só números) de config.yaml/gateway.* com chave token/bot_token preenchida.
linhas_token_config() {
  local f
  for f in "$HERMES_HOME/config.yaml" "$HERMES_HOME/config.yml" "$HERMES_HOME/gateway.json" "$HERMES_HOME/gateway.yaml"; do
    [ -f "$f" ] || continue
    grep -nEi '^[[:space:]]*"?(bot_)?token"?[[:space:]]*:[[:space:]]*"?[^[:space:]#"]' "$f" 2>/dev/null | cut -d: -f1 | sed "s|^|$(basename "$f"):linha |"
  done
}
nomes_env() { sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=.*/\2/p' "$1" 2>/dev/null | sort -u | tr '\n' ' '; }

env_do_pid_contagem() {  # $1=pid $2=padrão (grep -E, sem imprimir linhas) -> número de linhas casadas ou "?"
  [ -r "/proc/$1/environ" ] || { printf '?'; return; }
  tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | grep -Ec "$2"
}

# ---------------------------------------------------------------- manifesto de backup

m_get() { sed -n "s/^$2=//p" "$1/MANIFESTO.env" 2>/dev/null | head -n1; }
ultimo_backup() { ls -1d "$BACKUP_BASE"/backup-hermes-015-* 2>/dev/null | sort | tail -n1; }

head_hermes() { git -C "$HERMES_DIR" rev-parse HEAD 2>/dev/null || true; }
patch_aplicado() { python3 "$PATCHER" --tree "$HERMES_DIR" --check >/dev/null 2>&1; }

copia_atomica() {  # origem destino — troca atômica no mesmo diretório; mantém modo/dono do destino se existir
  local src="$1" dst="$2" tmp
  tmp="$(mktemp "$(dirname -- "$dst")/.virada.XXXXXX")" || return 1
  if ! cat -- "$src" > "$tmp"; then rm -f -- "$tmp"; return 1; fi
  if [ -e "$dst" ]; then chmod --reference="$dst" -- "$tmp"; chown --reference="$dst" -- "$tmp" 2>/dev/null || true; else chmod 644 -- "$tmp"; fi
  sync -f "$tmp" 2>/dev/null || sync
  mv -f -- "$tmp" "$dst"
}

validar_backup() {  # $1=dir -> 0 se íntegro; mensagem em ERRO_BACKUP
  local d="$1"; ERRO_BACKUP=""
  [ -d "$d" ] && [ -f "$d/MANIFESTO.env" ] && [ -f "$d/MANIFESTO.sha256" ] || { ERRO_BACKUP="$d não é um backup desta virada (falta MANIFESTO)"; return 1; }
  case "$(stat -c '%a' -- "$d")" in 700) ;; *) ERRO_BACKUP="permissão do backup deve ser 700"; return 1 ;; esac
  ( cd "$d" && sha256sum -c --quiet MANIFESTO.sha256 >/dev/null 2>&1 ) || { ERRO_BACKUP="conferência SHA-256 do backup falhou (arquivo alterado ou truncado)"; return 1; }
  [ "$(m_get "$d" hermes_dir)" = "$HERMES_DIR" ] || { ERRO_BACKUP="backup é de outro HERMES_DIR"; return 1; }
  return 0
}

# ---------------------------------------------------------------- inventario

cmd_inventario() {
  exigir_root
  info "Inventário da virada do Telegram — SOMENTE LEITURA; não imprime valores de .env, auth.json, token ou segredo."
  local pendencias=0

  titulo "Hermes 0.15.1: código"
  info "HERMES_DIR=$HERMES_DIR"
  local ver="" head=""
  if [ -d "$HERMES_DIR" ]; then
    if [ -x "$HERMES_DIR/venv/bin/python" ]; then
      ver="$(timeout 20 "$HERMES_DIR/venv/bin/python" -I -c 'import importlib.metadata as m; print(m.version("hermes-agent"))' 2>/dev/null || true)"
    fi
    info "versão do pacote: ${ver:-NÃO CONFIRMADO}"
    case "$ver" in 0.15.*) ;; *) aviso "versão esperada 0.15.x"; pendencias=$((pendencias+1)) ;; esac
    head="$(head_hermes)"
    info "commit: ${head:-NÃO CONFIRMADO}"
    if [ "$head" = "$PIN_COMMIT" ]; then ok "commit igual ao fixado (v2026.5.29)"; else aviso "commit diferente do fixado $PIN_COMMIT: o patch recusará"; pendencias=$((pendencias+1)); fi
    if [ -d "$HERMES_DIR/.git" ]; then
      local mod; mod="$(git -C "$HERMES_DIR" status --porcelain --untracked-files=no 2>/dev/null | wc -l)"
      info "arquivos rastreados alterados: $mod"
      git -C "$HERMES_DIR" status --porcelain --untracked-files=no 2>/dev/null | awk '{print "  " $0}' | head -n 10
    else
      aviso ".git ausente em $HERMES_DIR: o patch exige o checkout Git"; pendencias=$((pendencias+1))
    fi
    if patch_aplicado; then info "patch Helena v2: JÁ APLICADO (hashes conferidos)"; else info "patch Helena v2: NÃO aplicado (ou fonte divergente — o instalar confere)"; fi
    local f
    for f in gateway/run.py gateway/config.py; do
      if git -C "$HERMES_DIR" diff --quiet HEAD -- "$f" 2>/dev/null; then info "  $f: igual ao commit"; else info "  $f: DIFERENTE do commit (patch aplicado ou edição local)"; fi
    done
    [ -e "$HERMES_DIR/gateway/platforms/helena_v2_inbox.py" ] && info "  helena_v2_inbox.py: presente" || info "  helena_v2_inbox.py: ausente"
    [ -f "$HERMES_DIR/.env" ] && info "  $HERMES_DIR/.env (projeto): presente, modo/dono $(modo_dono "$HERMES_DIR/.env"), variáveis: $(nomes_env "$HERMES_DIR/.env")"
    if [ -r /usr/local/bin/hermes ]; then info "wrapper /usr/local/bin/hermes: $(grep -o 'exec "[^"]*"' /usr/local/bin/hermes 2>/dev/null | head -n1)"; fi
  else
    aviso "$HERMES_DIR não existe"; pendencias=$((pendencias+1))
  fi

  titulo "Hermes 0.15.1: configuração ($HERMES_HOME)"
  if [ -d "$HERMES_HOME" ]; then
    info "diretório: modo/dono $(modo_dono "$HERMES_HOME"), tamanho $(du -sh "$HERMES_HOME" 2>/dev/null | cut -f1)"
    if [ -f "$HERMES_HOME/.env" ]; then
      info ".env: modo/dono $(modo_dono "$HERMES_HOME/.env"); variáveis (só nomes): $(nomes_env "$HERMES_HOME/.env")"
      if token_em_arquivo "$HERMES_HOME/.env"; then info "TELEGRAM_BOT_TOKEN no .env: PRESENTE (o instalar vai desativá-lo; o valor fica só no backup)"; else info "TELEGRAM_BOT_TOKEN no .env: ausente"; fi
    else
      info ".env: ausente"
    fi
    for f in config.yaml auth.json gateway.pid gateway_state.json; do
      [ -e "$HERMES_HOME/$f" ] && info "$f: presente, modo/dono $(modo_dono "$HERMES_HOME/$f")" || info "$f: ausente"
    done
    local lt; lt="$(linhas_token_config)"
    if [ -n "$lt" ]; then aviso "chave token preenchida na configuração (valor NÃO exibido): $(printf '%s' "$lt" | tr '\n' ';')"; pendencias=$((pendencias+1)); else info "config sem chave token preenchida"; fi
  else
    aviso "$HERMES_HOME não existe"; pendencias=$((pendencias+1))
  fi

  titulo "Serviço do Hermes (Telegram)"
  if detectar_unidade; then
    info "unidade: $UNIT (escopo $ESCOPO)"
    info "estado: $(unit_prop ActiveState)/$(unit_prop SubState), habilitada: $(unit_prop UnitFileState), MainPID: $(unit_prop MainPID)"
    info "arquivo da unidade: $(unit_prop FragmentPath)"
    info "drop-ins: $(unit_prop DropInPaths | tr '\n' ' ')"
    info "variáveis de ambiente da unidade (só nomes): $(unit_prop Environment | tr ' ' '\n' | sed -n 's/^"\{0,1\}\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' | tr '\n' ' ')"
    info "arquivos de ambiente da unidade: $(unit_prop EnvironmentFiles | tr ' ' '\n' | grep '^/' | tr '\n' ' ')"
    local n; n="$(unit_prop Environment | grep -c 'TELEGRAM_BOT_TOKEN=')"
    [ "${n:-0}" -gt 0 ] && { aviso "a unidade define TELEGRAM_BOT_TOKEN em Environment= (o instalar recusa até você remover)"; pendencias=$((pendencias+1)); }
  else
    aviso "$ERRO_UNIDADE"; pendencias=$((pendencias+1))
  fi
  local procs; procs="$(procs_hermes)"
  if [ -n "$procs" ]; then info "processos do gateway 0.15.1 (pid usuário tempo comando):"; printf '%s\n' "$procs" | awk '{print "  " $0}'; else info "processos do gateway 0.15.1: nenhum"; fi

  titulo "Arquivos da virada"
  if [ -e "$WORKER_ENV" ]; then info "$WORKER_ENV: modo/dono $(modo_dono "$WORKER_ENV"); variáveis: $(nomes_env "$WORKER_ENV")"; else info "$WORKER_ENV: ainda não existe"; fi
  info "último backup: $(ultimo_backup || true)"
  [ -n "$(ultimo_backup)" ] || info "  (nenhum — rode: bash virada.sh backup)"
  info "espaço livre em $BACKUP_BASE: $(df -Ph "$BACKUP_BASE" 2>/dev/null | awk 'NR==2{print $4}')"

  titulo "Resumo"
  if [ "$pendencias" -eq 0 ]; then ok "nenhuma pendência encontrada; pode seguir para o backup"; else aviso "$pendencias pendência(s) acima; resolva ou entenda cada uma antes do backup"; fi
  info "O inventário não prova que o poller atual esteja funcionando nem qual bot ele usa: isso o fundador confere no Telegram."
  return 0
}

# ---------------------------------------------------------------- backup

cmd_backup() {
  exigir_root
  local com_venv=0
  while [ $# -gt 0 ]; do case "$1" in --com-venv) com_venv=1 ;; *) falha "opção desconhecida: $1" ;; esac; shift; done
  [ -d "$HERMES_DIR" ] || falha "$HERMES_DIR não existe."
  [ -d "$HERMES_HOME" ] || falha "$HERMES_HOME não existe."
  tem tar && tem gzip && tem sha256sum || falha "tar/gzip/sha256sum são necessários."
  local head; head="$(head_hermes)"
  [ -n "$head" ] || falha "não consegui ler o commit de $HERMES_DIR (não é checkout Git?)."
  [ "$head" = "$PIN_COMMIT" ] || aviso "commit $head difere do fixado; o backup é feito, mas o instalar vai recusar."
  local aplicado=nao; patch_aplicado && aplicado=sim
  [ "$aplicado" = sim ] && aviso "o patch JÁ está aplicado: este backup não guardará o Hermes original; o instalar/reverter vão recusá-lo."

  local excl_du="--exclude=node_modules --exclude=__pycache__"
  local excl_tar=(--exclude=node_modules --exclude=__pycache__)
  if [ "$com_venv" = 0 ]; then excl_du="$excl_du --exclude=venv"; excl_tar+=(--exclude=./venv); fi
  local kb_code kb_home need avail
  kb_code="$(du -sk $excl_du "$HERMES_DIR" 2>/dev/null | cut -f1)"; kb_home="$(du -sk "$HERMES_HOME" 2>/dev/null | cut -f1)"
  need=$(( (${kb_code:-0} + ${kb_home:-0}) * 12 / 10 + 10240 ))
  avail="$(df -Pk "$BACKUP_BASE" | awk 'NR==2{print $4}')"
  [ "${avail:-0}" -ge "$need" ] || falha "espaço insuficiente em $BACKUP_BASE (livre ${avail:-0} KB, preciso de ~$need KB)."

  local dest="$BACKUP_BASE/backup-hermes-015-$(data_hora)"
  [ ! -e "$dest" ] || falha "$dest já existe; espere um segundo e rode de novo."
  mkdir -m 700 -- "$dest" || falha "não consegui criar $dest."
  mkdir -m 700 -- "$dest/arquivos-originais" "$dest/arquivos-originais/gateway" "$dest/unidade"

  info "Guardando o código do Hermes (sem venv e node_modules, salvo --com-venv) …"
  tar --warning=no-file-changed -czf "$dest/codigo-hermes-agent.tar.gz" -C "$HERMES_DIR" "${excl_tar[@]}" . ; local rc=$?
  [ "$rc" -le 1 ] || { rm -rf -- "$dest"; falha "tar do código falhou (código $rc); backup removido."; }
  info "Guardando $HERMES_HOME (inclui .env e auth.json — o backup é secreto) …"
  tar --warning=no-file-changed -czf "$dest/hermes-home.tar.gz" -C "$HERMES_HOME" . ; rc=$?
  [ "$rc" -le 1 ] || { rm -rf -- "$dest"; falha "tar de $HERMES_HOME falhou (código $rc); backup removido."; }

  # Cópias simples dos poucos arquivos que a virada altera (restauração rápida e conferível).
  local f
  for f in gateway/run.py gateway/config.py; do cp -p -- "$HERMES_DIR/$f" "$dest/arquivos-originais/$f" || { rm -rf -- "$dest"; falha "não copiei $f."; }; done
  [ -f "$HERMES_HOME/.env" ] && cp -p -- "$HERMES_HOME/.env" "$dest/arquivos-originais/home.env"
  [ -f "$HERMES_DIR/.env" ] && cp -p -- "$HERMES_DIR/.env" "$dest/arquivos-originais/projeto.env"
  if detectar_unidade; then
    local frag; frag="$(unit_prop FragmentPath)"; [ -f "$frag" ] && cp -p -- "$frag" "$dest/unidade/$(basename "$frag")"
    [ -d "$(dropin_dir)" ] && cp -a -- "$(dropin_dir)" "$dest/unidade/dropins-antes"
    printf 'unit=%s\nescopo=%s\nativa=%s\n' "$UNIT" "$ESCOPO" "$(unit_prop ActiveState)" > "$dest/unidade/estado.txt"
  else
    aviso "unidade systemd não encontrada ($ERRO_UNIDADE); o backup segue sem ela."
  fi

  titulo "Conferência"
  local alvo ok_tudo=1 lst n_tar n_src bytes_arq
  for alvo in codigo-hermes-agent.tar.gz hermes-home.tar.gz; do
    lst="$(mktemp)"
    if ! tar -tzf "$dest/$alvo" > "$lst" 2>/dev/null; then aviso "$alvo ilegível"; ok_tudo=0; rm -f "$lst"; continue; fi
    n_tar="$(wc -l < "$lst")"; bytes_arq="$(stat -c %s -- "$dest/$alvo")"
    if [ "$alvo" = hermes-home.tar.gz ]; then
      n_src="$(find "$HERMES_HOME" -mindepth 1 2>/dev/null | wc -l)"
      [ -f "$HERMES_HOME/.env" ] && { grep -qx '\./\.env' "$lst" || { aviso ".env ausente do $alvo"; ok_tudo=0; }; }
      [ -f "$HERMES_HOME/auth.json" ] && { grep -qx '\./auth\.json' "$lst" || { aviso "auth.json ausente do $alvo"; ok_tudo=0; }; }
    else
      n_src="$(find "$HERMES_DIR" -mindepth 1 \( -name node_modules -o -name __pycache__ $( [ "$com_venv" = 0 ] && printf -- '-o -path %s' "$HERMES_DIR/venv" ) \) -prune -o -print 2>/dev/null | wc -l)"
      grep -qx '\./gateway/run\.py' "$lst" || { aviso "gateway/run.py ausente do $alvo"; ok_tudo=0; }
    fi
    [ "$bytes_arq" -ge 100 ] || { aviso "$alvo pequeno demais ($bytes_arq bytes)"; ok_tudo=0; }
    # Tolera 5% de diferença: o Hermes pode estar gravando enquanto o tar lê.
    [ $(( n_tar * 100 )) -ge $(( ${n_src:-0} * 95 )) ] || { aviso "$alvo tem $n_tar itens, a origem tem ~$n_src"; ok_tudo=0; }
    info "$alvo: $bytes_arq bytes, $n_tar itens (origem ~$n_src)"
    rm -f "$lst"
  done
  [ "$ok_tudo" = 1 ] || { aviso "backup incompleto; removendo $dest"; rm -rf -- "$dest"; falha "backup reprovado na conferência."; }

  {
    printf 'data=%s\nhermes_dir=%s\nhermes_home=%s\ncommit=%s\npatch_aplicado=%s\n' "$(data_hora)" "$HERMES_DIR" "$HERMES_HOME" "$head" "$aplicado"
    printf 'unit=%s\nescopo=%s\nunidade_ativa=%s\n' "${UNIT:-}" "${ESCOPO:-}" "$( [ "$UNIDADE_OK" = 1 ] && unit_prop ActiveState )"
    printf 'run_py_sha=%s\nconfig_py_sha=%s\n' "$(sha "$dest/arquivos-originais/gateway/run.py")" "$(sha "$dest/arquivos-originais/gateway/config.py")"
    [ -e "$HERMES_DIR/gateway/platforms/helena_v2_inbox.py" ] && printf 'helper_existia=sim\n' || printf 'helper_existia=nao\n'
    printf 'home_env_sha=%s\nprojeto_env_sha=%s\n' "$(sha "$HERMES_HOME/.env")" "$(sha "$HERMES_DIR/.env")"
    printf 'com_venv=%s\n' "$com_venv"
  } > "$dest/MANIFESTO.env"
  ( cd "$dest" && sha256sum codigo-hermes-agent.tar.gz hermes-home.tar.gz MANIFESTO.env $(find arquivos-originais unidade -type f | sort) > MANIFESTO.sha256 )
  find "$dest" -type f -exec chmod 600 {} +
  find "$dest" -type d -exec chmod 700 {} +
  validar_backup "$dest" || { rm -rf -- "$dest"; falha "o backup recém-criado não passou na validação: $ERRO_BACKUP"; }
  resultado "BACKUP OK em $dest ($(du -sh "$dest" | cut -f1)); permissão 700/600; SHA-256 em MANIFESTO.sha256"
  aviso "este backup contém .env e auth.json: não copie para fora da VPS nem cole no chat."
}

# ---------------------------------------------------------------- ensaiar

cmd_ensaiar() {
  exigir_root
  local manter=0
  while [ $# -gt 0 ]; do case "$1" in --manter) manter=1 ;; *) falha "opção desconhecida: $1" ;; esac; shift; done
  [ -d "$HERMES_DIR/.git" ] || falha "$HERMES_DIR não é um checkout Git."
  tem git && tem python3 || falha "git e python3 são necessários."
  [ "$(head_hermes)" = "$PIN_COMMIT" ] || falha "commit de $HERMES_DIR diferente do fixado; o patch recusaria."
  bash -n "$AQUI/virada.sh" || falha "virada.sh com erro de sintaxe."
  local work; work="$(mktemp -d /tmp/helena-ensaio.XXXXXX)" || falha "mktemp falhou."
  chmod 700 "$work"
  ENSAIO_WORK="$work"
  [ "$manter" = 1 ] || trap 'rm -rf -- "$ENSAIO_WORK"' EXIT
  info "Área do ensaio: $work (nada em $HERMES_DIR nem em $HERMES_HOME é alterado)"

  # Cópia do commit fixado, limpa (git clone local): vale mesmo que a instalação real já tenha o patch.
  git clone --quiet --local --no-hardlinks "$HERMES_DIR" "$work/original" 2>/dev/null || falha "git clone local falhou."
  [ "$(git -C "$work/original" rev-parse HEAD)" = "$PIN_COMMIT" ] || falha "cópia sem o commit fixado."
  cp -a -- "$work/original" "$work/copia" || falha "cópia falhou."

  python3 "$PATCHER" --tree "$work/copia" --apply || falha "ENSAIO REPROVADO: o patch não aplicou na cópia."
  python3 "$PATCHER" --tree "$work/copia" --check || falha "ENSAIO REPROVADO: --check falhou na cópia."
  python3 "$PATCHER" --tree "$work/copia" --apply >/dev/null || falha "ENSAIO REPROVADO: reaplicar não foi idempotente."
  ok "patch aplicado na cópia, conferido e idempotente"

  # O arquivo real, hoje, é igual ao commit (ou ao patch conhecido)?
  local f estado_real=""
  for f in gateway/run.py gateway/config.py; do
    if cmp -s -- "$HERMES_DIR/$f" "$work/original/$f"; then estado_real="$estado_real $f=original"
    elif cmp -s -- "$HERMES_DIR/$f" "$work/copia/$f"; then estado_real="$estado_real $f=patch-conhecido"
    else estado_real="$estado_real $f=DIVERGENTE"; fi
  done
  info "arquivos reais:$estado_real"
  case "$estado_real" in *DIVERGENTE*) aviso "a instalação real diverge do commit e do patch: o instalar vai recusar" ;; esac

  if [ "$ENSAIO_TESTES" = 1 ]; then
    local py="$HERMES_DIR/venv/bin/python"
    [ -x "$py" ] || { aviso "sem $py: testes do adapter NÃO executados (ENSAIO PARCIAL)"; return 0; }
    info "Rodando os testes offline do adapter (Edge e modelo sintéticos, sem rede) com o Python do próprio Hermes …"
    mkdir -p -m 700 "$work/home-teste"
    local saida="$work/testes.txt" rc
    ( cd "$work" && env -u TELEGRAM_BOT_TOKEN HERMES_HOME="$work/home-teste" HERMES_015_SOURCE="$work/original" PYTHONPATH="$work/original" \
      "$py" -m unittest discover -s "$AQUI" -p test_telegram_v2.py > "$saida" 2>&1 ); rc=$?
    tail -n 6 "$saida" | mask
    if [ "$rc" -ne 0 ]; then falha "ENSAIO REPROVADO: testes do adapter falharam (saída completa em $saida; use --manter)."; fi
    grep -q 'skipped' "$saida" && falha "ENSAIO REPROVADO: testes foram pulados (fonte do Hermes não encontrada)."
    ok "testes do adapter passaram"
  else
    aviso "testes do adapter desligados por HELENA_VIRADA_ENSAIO_TESTES=0 (somente modo de teste)"
  fi
  if [ "$manter" = 1 ]; then resultado "ENSAIO OK (cópia mantida em $work)"; else resultado "ENSAIO OK (cópia descartada; nada na instalação real foi alterado)"; fi
}

# ---------------------------------------------------------------- instalar

ler_segredo() {
  local a b
  if [ -t 0 ]; then
    printf 'Cole o segredo do worker (não aparece na tela) e tecle Enter: ' >&2
    IFS= read -rs a || falha "leitura cancelada."; printf '\n' >&2
    printf 'Repita o segredo (não aparece na tela): ' >&2
    IFS= read -rs b || falha "leitura cancelada."; printf '\n' >&2
    [ "$a" = "$b" ] || falha "os dois valores não coincidem; nada foi gravado."
  else
    IFS= read -r a || falha "nenhum segredo recebido em stdin."
  fi
  [[ "$a" =~ ^[A-Za-z0-9_-]{32,256}$ ]] || falha "formato inválido: use 32 a 256 caracteres de A-Z a-z 0-9 _ - (gere com: openssl rand -hex 32). Nada foi gravado."
  WORKER_SECRET="$a"
}

neutralizar_token_env() {  # $1=arquivo .env -> troca as linhas TELEGRAM_BOT_TOKEN= por comentário sem o valor
  local f="$1" tmp antes depois
  token_em_arquivo "$f" || return 0
  tmp="$(mktemp "$(dirname -- "$f")/.virada.XXXXXX")" || return 1
  antes="$(awk 'END{print NR}' "$f")"
  if ! awk -v d="$(date +%Y-%m-%d)" '
      /^[[:space:]]*(export[[:space:]]+)?TELEGRAM_BOT_TOKEN[[:space:]]*=/ { print "# TELEGRAM_BOT_TOKEN desativado pela virada Helena v2 em " d " (o valor ficou só no backup)"; next }
      { print }' "$f" > "$tmp"; then rm -f -- "$tmp"; return 1; fi
  depois="$(awk 'END{print NR}' "$tmp")"
  if [ "$antes" != "$depois" ] || token_em_arquivo "$tmp"; then rm -f -- "$tmp"; return 1; fi
  chmod --reference="$f" -- "$tmp"; chown --reference="$f" -- "$tmp" 2>/dev/null || true
  sync -f "$tmp" 2>/dev/null || sync
  mv -f -- "$tmp" "$f"
}

DESFAZER_PATCH=0; DESFAZER_HOME_ENV=0; DESFAZER_PROJ_ENV=0; DESFAZER_WORKER=0; DESFAZER_DROPIN=0; BK=""

restaurar_codigo() {  # $1=backup
  local bk="$1" f rc=0
  for f in gateway/run.py gateway/config.py; do copia_atomica "$bk/arquivos-originais/$f" "$HERMES_DIR/$f" || rc=1; done
  if [ "$(m_get "$bk" helper_existia)" = nao ]; then rm -f -- "$HERMES_DIR/gateway/platforms/helena_v2_inbox.py"; fi
  [ "$(sha "$HERMES_DIR/gateway/run.py")" = "$(m_get "$bk" run_py_sha)" ] && [ "$(sha "$HERMES_DIR/gateway/config.py")" = "$(m_get "$bk" config_py_sha)" ] || rc=1
  return "$rc"
}

desfazer_instalar() {
  aviso "desfazendo o que esta execução do instalar já tinha feito …"
  [ "$DESFAZER_DROPIN" = 1 ] && rm -f -- "$(dropin_arquivo)"
  [ "$DESFAZER_WORKER" = 1 ] && rm -f -- "$WORKER_ENV"
  [ "$DESFAZER_HOME_ENV" = 1 ] && copia_atomica "$BK/arquivos-originais/home.env" "$HERMES_HOME/.env"
  [ "$DESFAZER_PROJ_ENV" = 1 ] && copia_atomica "$BK/arquivos-originais/projeto.env" "$HERMES_DIR/.env"
  if [ "$DESFAZER_PATCH" = 1 ]; then restaurar_codigo "$BK" && info "código restaurado do backup" || aviso "NÃO consegui restaurar o código sozinho: rode bash virada.sh reverter"; fi
  sc daemon-reload >/dev/null 2>&1 || true
}
abortar_instalar() { printf 'ERRO: %s\n' "$*" >&2; desfazer_instalar; exit 1; }

cmd_instalar() {
  exigir_root
  local producao=0 manter_segredo=0 aceitar_cfg=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --producao) producao=1 ;;
      --manter-segredo) manter_segredo=1 ;;
      --aceitar-token-config) aceitar_cfg=1 ;;
      *) falha "opção desconhecida: $1 (o segredo NUNCA vai por argumento: ele é lido de stdin)" ;;
    esac; shift
  done
  [ "$producao" = 1 ] || falha "instalar mexe na instalação REAL do Hermes. Confirme com --producao (depois de inventario, backup e ensaiar)."
  [ -d "$HERMES_DIR/.git" ] && [ -d "$HERMES_HOME" ] || falha "instalação do Hermes não encontrada em $HERMES_DIR / $HERMES_HOME."
  tem python3 && tem git || falha "python3 e git são necessários."
  exigir_unidade

  # 1. Pré-condições (nada é alterado ainda).
  BK="$(ultimo_backup)"; [ -n "$BK" ] || falha "nenhum backup encontrado em $BACKUP_BASE: rode antes bash virada.sh backup."
  validar_backup "$BK" || falha "backup $BK reprovado: $ERRO_BACKUP. Rode bash virada.sh backup de novo."
  [ "$(m_get "$BK" patch_aplicado)" = nao ] || falha "o backup foi feito com o patch já aplicado; refaça o backup a partir do Hermes original."
  [ "$(head_hermes)" = "$PIN_COMMIT" ] || falha "o commit de $HERMES_DIR não é o fixado ($PIN_COMMIT, v2026.5.29): o patch recusaria. Nada foi alterado."
  [ "$(m_get "$BK" commit)" = "$(head_hermes)" ] || falha "o commit do Hermes mudou depois do backup; rode backup de novo."
  info "Backup usado: $BK"

  local aplicado=nao; patch_aplicado && aplicado=sim
  if [ "$aplicado" = nao ]; then
    [ "$(sha "$HERMES_DIR/gateway/run.py")" = "$(m_get "$BK" run_py_sha)" ] && [ "$(sha "$HERMES_DIR/gateway/config.py")" = "$(m_get "$BK" config_py_sha)" ] \
      || falha "gateway/run.py ou config.py mudaram depois do backup (e não são o patch conhecido). Pare e revise."
  fi
  local f
  for f in "$HERMES_HOME/.env:home_env_sha" "$HERMES_DIR/.env:projeto_env_sha"; do
    local arq="${f%%:*}" chave="${f##*:}"
    if [ -f "$arq" ] && token_em_arquivo "$arq" && [ "$(sha "$arq")" != "$(m_get "$BK" "$chave")" ]; then
      falha "$arq mudou depois do backup e ainda tem o token: rode backup de novo para não perder o valor original."
    fi
  done

  local lt; lt="$(linhas_token_config)"
  if [ -n "$lt" ] && [ "$aceitar_cfg" != 1 ]; then
    falha "há chave token preenchida na configuração do Hermes ($(printf '%s' "$lt" | tr '\n' ';')). O adapter novo exige token vazio. Edite o arquivo (sem colar o valor em lugar nenhum) ou, se a chave NÃO for do Telegram, repita com --aceitar-token-config."
  fi
  local n; n="$(unit_prop Environment | grep -c 'TELEGRAM_BOT_TOKEN=')"
  [ "${n:-0}" -eq 0 ] || falha "a unidade $UNIT define TELEGRAM_BOT_TOKEN em Environment=. Remova do arquivo da unidade e repita."
  local ef
  for ef in $(unit_prop EnvironmentFiles | tr ' ' '\n' | grep '^/' || true); do
    [ "$ef" = "$WORKER_ENV" ] && continue
    if token_em_arquivo "$ef"; then falha "o arquivo de ambiente $ef (da unidade) define TELEGRAM_BOT_TOKEN. Remova e repita."; fi
  done

  # 2. Segredo do worker (stdin; nunca argumento).
  local WORKER_SECRET=""
  if [ "$manter_segredo" = 1 ]; then
    [ -f "$WORKER_ENV" ] || falha "--manter-segredo exige $WORKER_ENV existente."
    WORKER_SECRET="$(sed -n 's/^HELENA_V2_TELEGRAM_WORKER_SECRET=//p' "$WORKER_ENV" | head -n1)"
    [[ "$WORKER_SECRET" =~ ^[A-Za-z0-9_-]{32,256}$ ]] || falha "o segredo existente em $WORKER_ENV tem formato inválido; rode sem --manter-segredo."
    info "Mantendo o segredo já gravado em $WORKER_ENV."
  else
    ler_segredo
  fi

  # 3. Patch na instalação real (troca atômica por arquivo + verificação de commit e hashes + desfazer em caso de falha).
  titulo "Patch do Hermes"
  if [ "$aplicado" = sim ]; then
    ok "patch já aplicado e conferido (nada a fazer)"
  else
    DESFAZER_PATCH=1
    python3 "$PATCHER" --tree "$HERMES_DIR" --apply --producao || abortar_instalar "patch recusado ou falhou (commit/hashes)."
    python3 "$PATCHER" --tree "$HERMES_DIR" --check || abortar_instalar "conferência pós-patch falhou."
    ok "patch aplicado e conferido (commit fixado + hashes)"
  fi

  # 4. Token fora do .env.
  titulo "Token do bot no Hermes antigo"
  if token_em_arquivo "$HERMES_HOME/.env"; then
    DESFAZER_HOME_ENV=1
    neutralizar_token_env "$HERMES_HOME/.env" || abortar_instalar "não consegui desativar o token em $HERMES_HOME/.env."
    ok "TELEGRAM_BOT_TOKEN desativado em $HERMES_HOME/.env (linha trocada por comentário; demais variáveis intactas)"
  else
    info "$HERMES_HOME/.env já está sem TELEGRAM_BOT_TOKEN"
  fi
  if token_em_arquivo "$HERMES_DIR/.env"; then
    DESFAZER_PROJ_ENV=1
    neutralizar_token_env "$HERMES_DIR/.env" || abortar_instalar "não consegui desativar o token em $HERMES_DIR/.env."
    ok "TELEGRAM_BOT_TOKEN desativado em $HERMES_DIR/.env"
  fi

  # 5. Arquivo de ambiente do worker e drop-in da unidade.
  titulo "Ambiente do worker"
  mkdir -p -m 750 -- "$ETC_DIR" || abortar_instalar "não criei $ETC_DIR."
  local tmp
  tmp="$(mktemp "$ETC_DIR/.telegram-worker.env.XXXXXX")" || abortar_instalar "mktemp em $ETC_DIR falhou."
  chmod 600 -- "$tmp"
  { printf 'HELENA_V2_TELEGRAM_MODE=inbox-worker\n'; printf 'HELENA_V2_TELEGRAM_BROKER_URL=%s\n' "$BROKER_URL"; printf 'HELENA_V2_TELEGRAM_WORKER_SECRET=%s\n' "$WORKER_SECRET"; } > "$tmp" \
    || { rm -f -- "$tmp"; abortar_instalar "falha ao gravar o ambiente do worker."; }
  chown root:root -- "$tmp" 2>/dev/null || true
  sync -f "$tmp" 2>/dev/null || sync
  [ -e "$WORKER_ENV" ] || DESFAZER_WORKER=1
  mv -f -- "$tmp" "$WORKER_ENV" || abortar_instalar "não consegui gravar $WORKER_ENV."
  WORKER_SECRET=""; unset WORKER_SECRET
  ok "$WORKER_ENV gravado (modo $(stat -c %a "$WORKER_ENV"); variáveis: $(nomes_env "$WORKER_ENV"))"

  local di; di="$(dropin_arquivo)"
  mkdir -p -m 755 -- "$(dropin_dir)" || abortar_instalar "não criei o drop-in."
  [ -e "$di" ] || DESFAZER_DROPIN=1
  printf '[Service]\nEnvironmentFile=%s\n' "$WORKER_ENV" > "$di" || abortar_instalar "não gravei o drop-in."
  chmod 644 -- "$di"
  sc daemon-reload || abortar_instalar "systemctl daemon-reload falhou."
  unit_prop EnvironmentFiles | grep -qF "$WORKER_ENV" || abortar_instalar "o systemd não listou $WORKER_ENV em EnvironmentFiles (drop-in não carregado)."
  ok "drop-in $di carregado: a unidade lerá $WORKER_ENV na próxima partida"

  # 6. Garantias finais.
  titulo "Garantias"
  local falhou=0
  token_em_arquivo "$HERMES_HOME/.env" && { aviso "ainda há token em $HERMES_HOME/.env"; falhou=1; }
  token_em_arquivo "$HERMES_DIR/.env" && { aviso "ainda há token em $HERMES_DIR/.env"; falhou=1; }
  [ "$(unit_prop Environment | grep -c 'TELEGRAM_BOT_TOKEN=')" -eq 0 ] || { aviso "unidade define o token"; falhou=1; }
  [ "$(stat -c %a "$WORKER_ENV")" = 600 ] || { aviso "modo do ambiente do worker diferente de 600"; falhou=1; }
  patch_aplicado || { aviso "patch não confere"; falhou=1; }
  [ "$falhou" = 0 ] || abortar_instalar "garantias finais reprovadas."
  ok "token fora do .env, da unidade e da configuração; patch conferido; segredo do worker em arquivo 600"

  titulo "O que acontece com o token no .env do Hermes 0.15.1"
  info "* A linha TELEGRAM_BOT_TOKEN= foi trocada por um comentário SEM o valor; as outras linhas (TELEGRAM_ALLOWED_USERS, TELEGRAM_REACTIONS, …) ficaram como estavam."
  info "* O valor original existe só no backup ($BK/arquivos-originais/home.env e hermes-home.tar.gz, modo 600) e no @BotFather."
  info "* O Hermes 0.15.1 deixa de falar com o Telegram por conta própria: sem polling, sem envio proativo/cron para o Telegram. O envio passa a ser sempre pela Edge."
  info "* O token passa a existir só nos segredos da Edge (HELENA_V2_TELEGRAM_BOT_TOKEN). Se ele vazar em qualquer momento: /revoke no @BotFather e atualizar o segredo da Edge."
  info "* Reverter restaura a linha original do backup."
  info ""
  resultado "INSTALAÇÃO CONCLUÍDA. O serviço ainda NÃO foi reiniciado: próximos passos, na ordem: parar-poller, iniciar."
}

# ---------------------------------------------------------------- parar-poller / iniciar

esperar_sem_processos() {  # espera até ESPERA_S segundos
  local i
  for i in $(seq 1 "$ESPERA_S"); do [ -z "$(pids_hermes)" ] && return 0; sleep 1; done
  [ -z "$(pids_hermes)" ]
}

cmd_parar_poller() {
  exigir_root
  local forcar=0
  while [ $# -gt 0 ]; do case "$1" in --forcar) forcar=1 ;; *) falha "opção desconhecida: $1" ;; esac; shift; done
  exigir_unidade
  info "Parando SOMENTE a unidade $UNIT (escopo $ESCOPO): o Hermes 0.15.1 do Telegram. Motor v2, EasyPanel e v1 não são tocados."
  info "estado antes: $(unit_prop ActiveState)"
  sc stop "$UNIT" || aviso "systemctl stop retornou erro; vou conferir os processos mesmo assim."
  if ! esperar_sem_processos; then
    aviso "sobraram processos do gateway 0.15.1 depois do stop:"
    procs_hermes | awk '{print "  " $0}'
    if [ "$forcar" = 1 ]; then
      pids_hermes | while read -r p; do [ -n "$p" ] && kill -TERM "$p" 2>/dev/null; done
      esperar_sem_processos || { pids_hermes | while read -r p; do [ -n "$p" ] && kill -KILL "$p" 2>/dev/null; done; sleep 1; }
    fi
    [ -z "$(pids_hermes)" ] || falha "ainda há processo do Hermes 0.15.1 vivo (poller possível). Repita com --forcar ou investigue; NÃO registre o webhook."
  fi
  [ "$(unit_prop ActiveState)" != active ] || falha "a unidade continua ativa."
  ok "unidade $UNIT parada (estado: $(unit_prop ActiveState)) e nenhum processo do gateway 0.15.1 sobrou"
  info "Próximo: bash virada.sh iniciar"
}

cmd_iniciar() {
  exigir_root
  exigir_unidade
  [ -z "$(pids_hermes)" ] || falha "ainda há processo do Hermes antigo (poller possível). Rode parar-poller antes."
  patch_aplicado || falha "o patch não está aplicado/conferido: rode instalar --producao."
  [ -f "$WORKER_ENV" ] && [ "$(stat -c %a "$WORKER_ENV")" = 600 ] || falha "$WORKER_ENV ausente ou com modo diferente de 600."
  token_em_arquivo "$HERMES_HOME/.env" && falha "TELEGRAM_BOT_TOKEN ainda está em $HERMES_HOME/.env: o adapter falharia fechado. Rode instalar."
  token_em_arquivo "$HERMES_DIR/.env" && falha "TELEGRAM_BOT_TOKEN ainda está em $HERMES_DIR/.env."
  sc daemon-reload || falha "daemon-reload falhou."
  unit_prop EnvironmentFiles | grep -qF "$WORKER_ENV" || falha "a unidade não lista $WORKER_ENV em EnvironmentFiles (drop-in ausente): rode instalar."

  local log="$HERMES_HOME/logs/gateway.log" antes=0
  [ -f "$log" ] && antes="$(wc -l < "$log")"
  sc start "$UNIT" || falha "systemctl start falhou."
  sleep 2
  [ "$(unit_prop ActiveState)" = active ] || falha "a unidade não ficou ativa. Veja: journalctl $( [ "$ESCOPO" = user ] && printf -- '--user ' )-u $UNIT -n 40 --no-pager"
  ok "unidade $UNIT ativa (MainPID $(unit_prop MainPID))"

  titulo "Conferência do processo"
  local p modo_ok=0 tok=0
  for p in $(pids_hermes); do
    local t m
    t="$(env_do_pid_contagem "$p" '^TELEGRAM_BOT_TOKEN=')"; m="$(env_do_pid_contagem "$p" '^HELENA_V2_TELEGRAM_MODE=inbox-worker$')"
    info "pid $p: TELEGRAM_BOT_TOKEN no ambiente=$t (esperado 0); modo inbox-worker=$m (esperado 1)"
    [ "$t" = 0 ] || { [ "$t" = '?' ] && aviso "não consegui ler /proc/$p/environ (NÃO CONFIRMADO)" || tok=1; }
    [ "$m" = 1 ] && modo_ok=1
  done
  [ "$tok" = 0 ] || falha "o processo tem TELEGRAM_BOT_TOKEN no ambiente: PARE (bash virada.sh parar-poller) e revise a unidade."
  [ "$modo_ok" = 1 ] || aviso "não confirmei HELENA_V2_TELEGRAM_MODE no ambiente do processo."

  titulo "Log do gateway (linhas novas, sem valores)"
  local i res=""
  for i in $(seq 1 "$ESPERA_S"); do
    if [ -f "$log" ]; then
      novas="$(tail -n +"$((antes+1))" "$log" 2>/dev/null)"
      if printf '%s' "$novas" | grep -q 'telegram connected'; then res=conectou; break; fi
      if printf '%s' "$novas" | grep -q 'telegram failed to connect'; then res=falhou; break; fi
    fi
    sleep 1
  done
  [ -f "$log" ] && tail -n +"$((antes+1))" "$log" 2>/dev/null | grep -Ei 'telegram|conflict|409|error' | tail -n 12 | mask
  case "$res" in
    conectou) ok "o gateway registrou 'telegram connected' (adapter inbox-worker carregado, sem token no processo)" ;;
    falhou) falha "o gateway registrou 'telegram failed to connect': o adapter falha fechado (token presente, URL ou segredo inválidos?). Rode: bash virada.sh estado" ;;
    *) aviso "NÃO CONFIRMADO: nenhuma linha 'telegram connected' em ${ESPERA_S}s. Leia o log: tail -n 50 $log" ;;
  esac
  info "Atenção: o adapter repete a chamada à Edge sem registrar erro; um segredo errado não aparece no log. Confira com: bash virada.sh estado --testar-edge"
  info "Próximo: registrar o webhook (roteiro, passo do setWebhook)."
}

# ---------------------------------------------------------------- estado

cmd_estado() {
  exigir_root
  local edge=0 mostrar_log=0
  while [ $# -gt 0 ]; do case "$1" in --testar-edge) edge=1 ;; --log) mostrar_log=1 ;; *) falha "opção desconhecida: $1" ;; esac; shift; done
  titulo "Serviço"
  if detectar_unidade; then
    info "unidade $UNIT (escopo $ESCOPO): $(unit_prop ActiveState)/$(unit_prop SubState), MainPID $(unit_prop MainPID), habilitada: $(unit_prop UnitFileState)"
    info "drop-in da virada: $( [ -f "$(dropin_arquivo)" ] && printf presente || printf ausente )"
    unit_prop EnvironmentFiles | grep -qF "$WORKER_ENV" && info "a unidade lê $WORKER_ENV" || info "a unidade NÃO lê $WORKER_ENV"
  else
    aviso "$ERRO_UNIDADE"
  fi
  local procs; procs="$(procs_hermes)"
  if [ -n "$procs" ]; then
    info "processos do gateway 0.15.1:"; printf '%s\n' "$procs" | awk '{print "  " $0}'
    local p; for p in $(pids_hermes); do info "  pid $p: TELEGRAM_BOT_TOKEN no ambiente=$(env_do_pid_contagem "$p" '^TELEGRAM_BOT_TOKEN='); modo inbox-worker=$(env_do_pid_contagem "$p" '^HELENA_V2_TELEGRAM_MODE=inbox-worker$')"; done
  else
    info "processos do gateway 0.15.1: nenhum"
  fi
  titulo "Arquivos"
  if patch_aplicado; then info "patch Helena v2: APLICADO e conferido"; else info "patch Helena v2: NÃO aplicado/conferido"; fi
  if token_em_arquivo "$HERMES_HOME/.env"; then aviso "TELEGRAM_BOT_TOKEN presente em $HERMES_HOME/.env"; else info "TELEGRAM_BOT_TOKEN: ausente de $HERMES_HOME/.env"; fi
  if [ -e "$WORKER_ENV" ]; then info "$WORKER_ENV: modo/dono $(modo_dono "$WORKER_ENV"), variáveis: $(nomes_env "$WORKER_ENV")"; else info "$WORKER_ENV: ausente"; fi
  local lt; lt="$(linhas_token_config)"; [ -z "$lt" ] || aviso "chave token preenchida na configuração: $(printf '%s' "$lt" | tr '\n' ';')"
  info "último backup: $(ultimo_backup)"
  if [ "$mostrar_log" = 1 ]; then
    titulo "Últimas linhas do log do gateway (mascaradas; podem conter trechos de conversa — não cole no chat)"
    [ -f "$HERMES_HOME/logs/gateway.log" ] && tail -n 25 "$HERMES_HOME/logs/gateway.log" | mask || info "(sem $HERMES_HOME/logs/gateway.log)"
  fi
  if [ "$edge" = 1 ]; then
    titulo "Teste da Edge (worker/claim)"
    tem curl || falha "curl é necessário."
    [ -f "$WORKER_ENV" ] || falha "$WORKER_ENV ausente."
    local sec body code
    sec="$(sed -n 's/^HELENA_V2_TELEGRAM_WORKER_SECRET=//p' "$WORKER_ENV" | head -n1)"
    [[ "$sec" =~ ^[A-Za-z0-9_-]{32,256}$ ]] || falha "segredo do worker ilegível/inválido em $WORKER_ENV."
    body="$(mktemp)"
    # A configuração do curl vai por stdin: o segredo nunca aparece em argumento/ps.
    code="$(printf 'url = "%s/worker/claim"\nrequest = "POST"\nheader = "X-Helena-Telegram-Worker-Secret: %s"\nheader = "Content-Type: application/json"\ndata = "{}"\nmax-time = 20\nsilent\noutput = "%s"\nwrite-out = "%%{http_code}"\n' "$BROKER_URL" "$sec" "$body" | curl -K - 2>/dev/null)"
    sec=""
    case "$code" in
      200)
        if grep -Eq '"job"[[:space:]]*:[[:space:]]*null' "$body"; then ok "Edge aceitou o segredo do worker (HTTP 200, sem trabalho na fila)"
        else aviso "Edge aceitou o segredo (HTTP 200), mas havia trabalho real: ele foi reivindicado agora e volta à fila quando a lease expirar (conteúdo não exibido)"; fi ;;
      401) rm -f "$body"; falha "Edge recusou o segredo do worker (HTTP 401): ele difere do segredo gravado na Edge. Regrave com instalar --producao (sem --manter-segredo)." ;;
      503) rm -f "$body"; falha "Edge sem segredos configurados (HTTP 503)." ;;
      *) rm -f "$body"; falha "resposta inesperada da Edge: HTTP ${code:-sem resposta}." ;;
    esac
    rm -f "$body"
  fi
}

# ---------------------------------------------------------------- reverter

cmd_reverter() {
  exigir_root
  local bk="" webhook_removido=0 home_completo=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --backup) shift; bk="${1:-}" ;;
      --confirmo-webhook-removido) webhook_removido=1 ;;
      --home-completo) home_completo=1 ;;
      *) falha "opção desconhecida: $1" ;;
    esac; shift
  done
  [ -n "$bk" ] || bk="$(ultimo_backup)"
  [ -n "$bk" ] || falha "nenhum backup em $BACKUP_BASE."
  validar_backup "$bk" || falha "backup $bk reprovado: $ERRO_BACKUP"
  [ "$(m_get "$bk" patch_aplicado)" = nao ] || falha "este backup foi feito com o patch já aplicado: não contém o Hermes original."
  BK="$bk"
  exigir_unidade
  info "Revertendo com o backup $bk"

  if [ "$webhook_removido" != 1 ]; then
    aviso "SEM --confirmo-webhook-removido: restauro tudo, mas NÃO religo o poller antigo (com webhook ativo ele daria erro 409)."
  fi

  titulo "1. Parar o Hermes novo"
  sc stop "$UNIT" || true
  esperar_sem_processos || falha "ainda há processo do Hermes vivo; repita com parar-poller --forcar e depois reverter."
  ok "unidade parada"

  titulo "2. Restaurar código e .env"
  restaurar_codigo "$bk" || falha "restauração do código falhou (hashes não batem)."
  ok "gateway/run.py e config.py voltaram aos originais; helper removido se não existia"
  if [ -f "$bk/arquivos-originais/home.env" ]; then
    copia_atomica "$bk/arquivos-originais/home.env" "$HERMES_HOME/.env" || falha "não restaurei $HERMES_HOME/.env."
    [ "$(sha "$HERMES_HOME/.env")" = "$(m_get "$bk" home_env_sha)" ] || falha "$HERMES_HOME/.env restaurado não confere com o backup."
    ok "$HERMES_HOME/.env restaurado (inclui a linha TELEGRAM_BOT_TOKEN original)"
  fi
  if [ -f "$bk/arquivos-originais/projeto.env" ]; then
    copia_atomica "$bk/arquivos-originais/projeto.env" "$HERMES_DIR/.env" || falha "não restaurei $HERMES_DIR/.env."
  fi
  if [ "$home_completo" = 1 ]; then
    local aside="${HERMES_HOME}.pos-virada-$(data_hora)"
    mv -- "$HERMES_HOME" "$aside" || falha "não movi $HERMES_HOME."
    mkdir -m 700 -- "$HERMES_HOME" && tar -xzf "$bk/hermes-home.tar.gz" -C "$HERMES_HOME" --same-owner -p || falha "extração do hermes-home falhou; o estado de antes está em $aside."
    ok "$HERMES_HOME restaurado por inteiro; a versão pós-virada ficou em $aside (contém conversas novas)"
  fi

  titulo "3. Remover o drop-in da virada"
  rm -f -- "$(dropin_arquivo)"; rmdir -- "$(dropin_dir)" 2>/dev/null || true
  sc daemon-reload || true
  unit_prop EnvironmentFiles | grep -qF "$WORKER_ENV" && aviso "a unidade ainda lista $WORKER_ENV" || ok "unidade não lê mais $WORKER_ENV"
  info "$WORKER_ENV foi MANTIDO (permissão 600, não é lido por ninguém). Para apagar: rm -f $WORKER_ENV"

  titulo "4. Poller antigo"
  if [ "$webhook_removido" = 1 ]; then
    sc start "$UNIT" || falha "systemctl start falhou."
    sleep 2
    [ "$(unit_prop ActiveState)" = active ] || falha "a unidade não ficou ativa."
    ok "poller antigo religado (unidade $UNIT ativa)"
    local p
    for p in $(pids_hermes); do info "pid $p: TELEGRAM_BOT_TOKEN no ambiente=$(env_do_pid_contagem "$p" '^TELEGRAM_BOT_TOKEN=') (o .env é lido pelo próprio Hermes; 0 é normal)"; done
  else
    info "Para religar depois de apagar o webhook: bash virada.sh reverter --confirmo-webhook-removido"
  fi

  titulo "Checagem que você precisa fazer (a IA e este script não usam o token)"
  info "No SEU COMPUTADOR (o token nunca vai para a VPS), cole o bloco 'getWebhookInfo' do roteiro (docs/manual/virada-telegram-passo-a-passo.md)."
  info "Esperado: \"url\":\"\" (vazio), sem \"last_error_message\". Se url NÃO estiver vazio, rode primeiro o bloco 'deleteWebhook' (com drop_pending_updates=false)."
  info "Depois mande uma mensagem comum ao bot: o Hermes antigo deve responder."
  resultado "REVERSÃO CONCLUÍDA"
}

cmd_ajuda() {
  cat <<'AJUDA'
bash virada.sh <etapa> [opções]   (rode como root, na VPS)

  inventario                  somente leitura: instalação, versão, commit, unidade, config (sem valores)
  backup [--com-venv]         /root/backup-hermes-015-<data> (700/600) com código, ~/.hermes e conferência
  ensaiar [--manter]          aplica o patch numa CÓPIA e roda os testes offline do adapter
  instalar --producao         patch real + token fora do .env + /etc/helena-v2/telegram-worker.env (segredo por stdin)
        [--manter-segredo] [--aceitar-token-config]
  parar-poller [--forcar]     para só a unidade do Hermes do Telegram e confere que não sobrou processo
  iniciar                     sobe o Hermes no modo inbox-worker e confere processo e log
  estado [--testar-edge] [--log]
  reverter [--backup DIR] [--confirmo-webhook-removido] [--home-completo]

Roteiro completo: docs/manual/virada-telegram-passo-a-passo.md
AJUDA
}

etapa="${1:-}"; [ $# -gt 0 ] && shift
case "$etapa" in
  inventario) cmd_inventario "$@" ;;
  backup) cmd_backup "$@" ;;
  ensaiar) cmd_ensaiar "$@" ;;
  instalar) cmd_instalar "$@" ;;
  parar-poller) cmd_parar_poller "$@" ;;
  iniciar) cmd_iniciar "$@" ;;
  estado) cmd_estado "$@" ;;
  reverter) cmd_reverter "$@" ;;
  ajuda|-h|--help|"") cmd_ajuda; [ -n "$etapa" ] || exit 2 ;;
  *) printf 'Etapa desconhecida: %s\n' "$etapa" >&2; cmd_ajuda >&2; exit 2 ;;
esac
