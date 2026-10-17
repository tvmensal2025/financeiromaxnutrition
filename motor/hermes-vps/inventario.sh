#!/usr/bin/env bash
# Inventário SOMENTE LEITURA para execução manual na VPS.
# Compartilhe a saída: este script imprime apenas nomes, estados, versões e metadados.
# Não lê .env/auth.json, logs ou processos; não acessa rede nem executa agente.
# O Hermes do EasyPanel fica dentro de container/volume; sem entrar no container,
# seu conteúdo no host é NÃO CONFIRMADO. Docker mostra somente nome, réplicas/status e imagem.
set -u
export LC_ALL=C

nao_confirmado() { printf 'NÃO CONFIRMADO (%s)\n' "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }

# Modo de validação desta máquina: não consultar systemd, Docker ou os caminhos locais.
if [ "${HELENA_INVENTARIO_TESTE_LOCAL:-0}" = 1 ]; then
  echo 'Teste local do formato: este host NÃO foi tratado como VPS; nenhuma consulta ao sistema foi feita.'
  for item in systemd docker diretorios git versoes; do printf '%s: ' "$item"; nao_confirmado 'teste local deliberado, sem inspeção'; done
  exit 0
fi

run_bounded() {
  # timeout limita esperas em ferramentas que consultam systemd/Docker ou percorrem disco.
  if ! has timeout; then nao_confirmado 'timeout indisponível'; return 127; fi
  timeout --signal=TERM --kill-after=2 8 "$@"
}

echo 'Inventário Helena/Hermes — leitura somente; sem consulta a segredos/logs/rede'
echo 'Este host só é tratado como VPS se você executar este arquivo manualmente nela.'

echo
echo '[systemd: serviços Helena conhecidos]'
if has systemctl; then
  for unit in helena-vigia.service helena-relogio.service helena-despachante.service; do
    props="$(run_bounded systemctl show "$unit" --no-pager --property=LoadState,ActiveState,SubState,UnitFileState,User 2>/dev/null)"
    rc=$?
    if [ "$rc" -eq 0 ] && [ -n "$props" ] && [[ "$props" != *'LoadState=not-found'* ]]; then
      printf '%s | %s\n' "$unit" "$(printf '%s' "$props" | tr '\n' ' ')"
    else
      printf '%s | ' "$unit"; nao_confirmado 'systemctl sem resposta/permissão/serviço ausente'
    fi
  done

  echo '[systemd: unidades cujo nome contém hermes]'
  for mode in system user; do
    if [ "$mode" = system ]; then
      listing="$(run_bounded systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null)"; rc=$?
      show_prefix=(systemctl)
    else
      listing="$(run_bounded systemctl --user list-unit-files --type=service --no-legend --no-pager 2>/dev/null)"; rc=$?
      show_prefix=(systemctl --user)
    fi
    if [ "$rc" -ne 0 ]; then
      printf '%s: ' "$mode"; nao_confirmado 'enumeração systemd indisponível/permissão'; continue
    fi
    found=0
    while IFS= read -r unit; do
      [ -n "$unit" ] || continue
      case "$unit" in *hermes*)
        found=1
        props="$(run_bounded "${show_prefix[@]}" show "$unit" --no-pager --property=LoadState,ActiveState,SubState,UnitFileState,User 2>/dev/null)"; prc=$?
        if [ "$prc" -eq 0 ]; then printf '%s/%s | %s\n' "$mode" "$unit" "$(printf '%s' "$props" | tr '\n' ' ')"; else printf '%s/%s | ' "$mode" "$unit"; nao_confirmado 'systemctl show indisponível'; fi
      esac
    done < <(printf '%s\n' "$listing" | awk 'NF {print $1}')
    [ "$found" -eq 1 ] || printf '%s: nenhuma unidade com nome hermes encontrada\n' "$mode"
  done
else
  nao_confirmado 'systemctl indisponível'
fi

echo
echo '[Docker: serviços/containers com nome helena ou hermes]'
if has docker; then
  svc="$(run_bounded docker service ls --format '{{.Name}} | {{.Replicas}} | {{.Image}}' 2>/dev/null)"; src=$?
  if [ "$src" -eq 0 ]; then
    matches="$(printf '%s\n' "$svc" | awk -F ' *\\| *' 'tolower($1) ~ /helena|hermes/')"
    [ -n "$matches" ] && printf 'services: %s\n' "$matches" || echo 'services: nenhum nome correspondente'
  else nao_confirmado 'docker service ls indisponível/permissão'; fi
  ctr="$(run_bounded docker ps --all --format '{{.Names}} | {{.Status}} | {{.Image}}' 2>/dev/null)"; crc=$?
  if [ "$crc" -eq 0 ]; then
    matches="$(printf '%s\n' "$ctr" | awk -F ' *\\| *' 'tolower($1) ~ /helena|hermes/')"
    [ -n "$matches" ] && printf 'containers: %s\n' "$matches" || echo 'containers: nenhum nome correspondente'
  else nao_confirmado 'docker ps indisponível/permissão'; fi
else
  nao_confirmado 'docker indisponível'
fi

echo
echo '[Metadados de diretórios: somente stat/du, sem abrir arquivos]'
echo 'Hermes EasyPanel: NÃO CONFIRMADO (instalação dentro de container; caminho host desconhecido, sem docker exec).'
for entry in \
  'Hermes profissional|/usr/local/lib/hermes-agent' \
  'Motor Helena v2|/opt/helena-v2' \
  'Login profissional (diretório)|/root/.hermes' \
  'Backup EasyPanel|/root/backup-hermes-easypanel'; do
  label=${entry%%|*}; path=${entry#*|}
  printf '%s (%s): ' "$label" "$path"
  if [ ! -e "$path" ]; then nao_confirmado 'caminho ausente/inacessível'; continue; fi
  if has stat; then
    run_bounded stat -c 'tipo=%F modo=%a uid=%u gid=%g mtime=%y' -- "$path" 2>/dev/null || nao_confirmado 'stat indisponível/permissão/timeout'
  else nao_confirmado 'stat indisponível'; fi
  if has du; then
    run_bounded du -sh -- "$path" 2>/dev/null || nao_confirmado 'du indisponível/permissão/timeout'
  else nao_confirmado 'du indisponível'; fi
done
echo 'EasyPanel: conteúdo do container/volume não inspecionado; use apenas a linha de metadados do Docker acima.'

echo
echo '[Git: somente HEAD e estado dirty de /opt/helena-v2/repo]'
repo=/opt/helena-v2/repo
if [ -d "$repo/.git" ] && has git; then
  head="$(run_bounded git -C "$repo" rev-parse HEAD 2>/dev/null)"; hrc=$?
  if [ "$hrc" -ne 0 ] || [ -z "$head" ]; then nao_confirmado 'HEAD indisponível';
  else
    estado="$(run_bounded env GIT_OPTIONAL_LOCKS=0 git -c core.fsmonitor=false -C "$repo" status --porcelain=v1 --untracked-files=normal 2>/dev/null)"; drc=$?
    if [ "$drc" -ne 0 ]; then printf 'HEAD=%s ' "$head"; nao_confirmado 'estado dirty indisponível';
    elif [ -n "$estado" ]; then printf 'HEAD=%s dirty=sim\n' "$head";
    else printf 'HEAD=%s dirty=nao\n' "$head"; fi
  fi
else nao_confirmado 'repo Git ausente/inacessível'; fi

echo
echo '[Versões instaladas: importlib.metadata isolado; nenhum agente é iniciado]'
for entry in \
  'Hermes profissional|/usr/local/lib/hermes-agent/venv/bin/python' \
  'Hermes do motor v2|/opt/helena-v2/venv-hermes/bin/python'; do
  label=${entry%%|*}; py=${entry#*|}
  printf '%s: ' "$label"
  if [ -x "$py" ]; then
    out="$(run_bounded "$py" -I -c 'import importlib.metadata as m; print("hermes-agent=" + m.version("hermes-agent"))' 2>/dev/null)"; vrc=$?
    [ "$vrc" -eq 0 ] && printf '%s\n' "$out" || nao_confirmado 'distribuição ausente/erro/timeout'
  else nao_confirmado 'Python da venv ausente/inacessível'; fi
done
echo 'Hermes EasyPanel: versão dentro do container não consultada; NÃO CONFIRMADO.'
