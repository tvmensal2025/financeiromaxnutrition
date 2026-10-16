#!/usr/bin/env bash
# Instalador Hermes, Plano B. Roda DENTRO da VPS do aluno, como root.
# Cada etapa e identica ao que o instalador do site faz, na mesma ordem:
#   preparar -> hermes -> telegram -> oauth-iniciar -> oauth-aguardar -> gateway -> verificar
# Uso: bash instalar-na-vps.sh <etapa>
# Etapas que ja estiverem prontas sao puladas (pode repetir sem medo).
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive PATH="/root/.local/bin:$PATH"

HERMES_TAG="v2026.5.29"
HERMES_COMMIT="e71a2bd11b733f3be7cf99deafde0066c343d462"
HERMES_SHA256="62576fb39ff2f2ba7fcaa135e56435fcc525748cefbfc41f131f8b7c228326e5"
HERMES_FILE="hermes-v2026.5.29-e71a2bd1.tar.gz"
HERMES_DIR="/usr/local/lib/hermes-agent"
HERMES_HOME="/root/.hermes"
WORK="/opt/hermes-install"
OAUTH_OUT="$WORK/oauth.out"
PKG="$WORK/$HERMES_FILE"

ok()   { printf 'OK: %s\n' "$*"; }
fail() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

auth_ok() {
  "$HERMES_DIR/venv/bin/python" -c 'from hermes_cli.auth import get_codex_auth_status; import sys; s=get_codex_auth_status(); sys.exit(0 if s and s.get("logged_in") and s.get("api_key") else 1)' >/dev/null 2>&1
}

[ "$(id -u)" = 0 ] || fail "rode como root."
mkdir -p "$WORK"

etapa_conectar() { echo ok; }

etapa_preparar() {
  if command -v git >/dev/null && command -v ffmpeg >/dev/null && command -v screen >/dev/null && test -x /root/.local/bin/uv; then
    ok "servidor ja estava preparado"; return
  fi
  (
    set -e
    for n in $(seq 1 30); do if ! fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock >/dev/null 2>&1; then break; fi; sleep 4; done
    dpkg --configure -a
    for n in 1 2 3; do
      apt-get update -y && apt-get install -y git curl ca-certificates ffmpeg ripgrep build-essential python3 python3-venv python3-pip screen && exit 0
      sleep $((n*5))
    done
    exit 1
  ) || fail "falhou instalar os programas base no servidor (apt)."
  command -v uv >/dev/null 2>&1 || test -x /root/.local/bin/uv || curl -LsSf https://astral.sh/uv/install.sh | sh || fail "falhou instalar o uv."
  test -x /root/.local/bin/uv || command -v uv >/dev/null || fail "uv nao ficou disponivel."
  ok "servidor preparado"
}

etapa_hermes() {
  if test -x /usr/local/bin/hermes && test -x "$HERMES_DIR/venv/bin/hermes"; then ok "Hermes ja estava instalado"; return; fi
  if ! { test -f "$HERMES_DIR/setup-hermes.sh" && test "$(git -C "$HERMES_DIR" rev-parse HEAD 2>/dev/null)" = "$HERMES_COMMIT"; }; then
    test -f "$PKG" || fail "pacote $PKG nao encontrado. Envie a pasta pacote/ para $WORK antes."
    echo "$HERMES_SHA256  $PKG" | sha256sum -c - >/dev/null 2>&1 || fail "o pacote do Hermes chegou incompleto (sha256 diferente). Envie de novo."
    stage="$HERMES_DIR.cache-planob"; backup="$HERMES_DIR.before-planob-$(date +%s)"
    rm -rf "$stage"; mkdir -p "$stage"
    tar -xzf "$PKG" --no-same-owner -C "$stage" || fail "nao consegui extrair o pacote do Hermes."
    git config --global --add safe.directory "$stage" >/dev/null 2>&1 || true
    git config --global --add safe.directory "$HERMES_DIR" >/dev/null 2>&1 || true
    test "$(git -C "$stage" rev-parse HEAD)" = "$HERMES_COMMIT" || fail "o pacote nao corresponde a versao $HERMES_TAG."
    if [ -e "$HERMES_DIR" ]; then mv "$HERMES_DIR" "$backup"; fi
    mv "$stage" "$HERMES_DIR"
  fi
  cd "$HERMES_DIR" || fail "pasta $HERMES_DIR ausente."
  export UV_NO_CONFIG=1 HERMES_SETUP_NONINTERACTIVE=1 UV_VENV_CLEAR=1
  chmod +x setup-hermes.sh
  if ! ./setup-hermes.sh </dev/null; then
    { test -x "$HERMES_DIR/venv/bin/hermes" && "$HERMES_DIR/venv/bin/hermes" --version >/dev/null; } || fail "nao consegui instalar o Hermes (setup-hermes.sh falhou)."
  fi
  printf '#!/usr/bin/env bash\nunset PYTHONPATH PYTHONHOME\nexec "%s/venv/bin/hermes" "$@"\n' "$HERMES_DIR" > /usr/local/bin/hermes
  chmod 755 /usr/local/bin/hermes
  ok "Hermes $HERMES_TAG instalado em $HERMES_DIR"
}

# Le TELEGRAM_BOT_TOKEN e TELEGRAM_ALLOWED_USERS do ambiente (nunca da linha de comando).
etapa_telegram() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || fail "TELEGRAM_BOT_TOKEN nao informado."
  [[ "${TELEGRAM_ALLOWED_USERS:-}" =~ ^[0-9]{1,15}$ ]] || fail "TELEGRAM_ALLOWED_USERS deve ter so numeros."
  mkdir -p "$HERMES_HOME"
  umask 077
  printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_ALLOWED_USERS=%s\nTELEGRAM_REACTIONS=true\n' "$TELEGRAM_BOT_TOKEN" "$TELEGRAM_ALLOWED_USERS" > "$HERMES_HOME/.env"
  chmod 600 "$HERMES_HOME/.env"
  ok "Telegram configurado em $HERMES_HOME/.env"
}

etapa_oauth_iniciar() {
  if auth_ok; then echo "JA_AUTENTICADO"; return; fi
  cat > "$WORK/oauth-login.py" <<'PY'
import os
os.environ.setdefault('HERMES_HOME','/root/.hermes')
from hermes_cli.auth import _codex_device_code_login,_save_codex_tokens,_update_config_for_provider,DEFAULT_CODEX_BASE_URL
c=_codex_device_code_login(); _save_codex_tokens(c['tokens'],c.get('last_refresh')); _update_config_for_provider('openai-codex',c.get('base_url',DEFAULT_CODEX_BASE_URL)); print('HERMES_OAUTH_DONE',flush=True)
PY
  chmod 600 "$WORK/oauth-login.py"
  if test -s "$WORK/oauth.pid" && kill -0 "$(cat "$WORK/oauth.pid")" 2>/dev/null; then kill "$(cat "$WORK/oauth.pid")"; fi
  rm -f "$OAUTH_OUT"
  nohup setsid bash -lc "$HERMES_DIR/venv/bin/python -u $WORK/oauth-login.py >$OAUTH_OUT 2>&1; echo EXIT=\$? >>$OAUTH_OUT" >/dev/null 2>&1 &
  echo $! > "$WORK/oauth.pid"
  url=""; code=""
  for _ in $(seq 1 45); do
    sleep 2
    clean="$(tail -c 8192 "$OAUTH_OUT" 2>/dev/null | sed -e 's/\x1b\[[0-9;?]*[A-Za-z]//g' -e 's/\r//g')"
    url="$(printf '%s' "$clean" | grep -oE 'https://auth\.openai\.com/codex/device[^[:space:]]*' | tail -1 | sed -e 's/[).,"]*$//')"
    code="$(printf '%s' "$clean" | tr '\n' ' ' | grep -oiE '(enter this code|user code)[[:space:]]*:?[[:space:]]*[A-Z0-9]{4,8}-[A-Z0-9]{4,8}' | tail -1 | grep -oE '[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$')"
    [ -n "$url" ] && [ -n "$code" ] && break
    printf '%s' "$clean" | grep -qE 'EXIT=[1-9]' && break
  done
  [ -n "$url" ] && [ -n "$code" ] || { tail -n 20 "$OAUTH_OUT" >&2 2>/dev/null; fail "nao consegui obter o link de autorizacao da OpenAI."; }
  echo "OAUTH_URL=$url"
  echo "OAUTH_CODIGO=$code"
  echo "O link e o codigo valem por cerca de 15 minutos."
}

# Espera o aluno autorizar (ate 15 min), igual ao monitor do instalador (checa a cada 10 s).
etapa_oauth_aguardar() {
  for _ in $(seq 1 90); do
    if auth_ok; then echo "AUTENTICADO"; return; fi
    if grep -qE 'EXIT=[1-9]' "$OAUTH_OUT" 2>/dev/null; then tail -n 20 "$OAUTH_OUT" >&2; fail "a autorizacao da OpenAI terminou com erro. Rode oauth-iniciar de novo."; fi
    sleep 10
  done
  fail "tempo esgotado na autorizacao (15 min). Rode oauth-iniciar de novo."
}

etapa_oauth_status() { if auth_ok; then echo "AUTENTICADO"; else echo "AGUARDANDO"; fi; }

etapa_gateway() {
  loginctl enable-linger root; mkdir -p /root/.config/systemd/user
  cat > /root/.config/systemd/user/hermes-gateway.service <<EOF
[Unit]
Description=Hermes Gateway
[Service]
Type=simple
ExecStart=$HERMES_DIR/venv/bin/python -m hermes_cli.main gateway run --replace
WorkingDirectory=$HERMES_HOME
Environment=HERMES_HOME=$HERMES_HOME
Restart=always
RestartSec=5
RestartForceExitStatus=75
[Install]
WantedBy=default.target
EOF
  chmod 644 /root/.config/systemd/user/hermes-gateway.service
  export XDG_RUNTIME_DIR=/run/user/0
  systemctl start user@0.service || true
  systemctl --user daemon-reload
  systemctl --user enable --now hermes-gateway.service
  sleep 3
  systemctl --user is-active hermes-gateway.service || fail "nao consegui ligar o agente (hermes-gateway)."
  ok "agente ligado"
}

etapa_verificar() {
  export XDG_RUNTIME_DIR=/run/user/0
  test "$(systemctl --user is-active hermes-gateway.service)" = active || fail "o servico hermes-gateway nao esta ativo."
  auth_ok || fail "o agente subiu, mas a autenticacao da OpenAI nao esta utilizavel."
  ok "VERIFICACAO FINAL: gateway ativo e OpenAI autenticada"
}

case "${1:-}" in
  conectar) etapa_conectar ;;
  preparar) etapa_preparar ;;
  hermes) etapa_hermes ;;
  telegram) etapa_telegram ;;
  oauth-iniciar) etapa_oauth_iniciar ;;
  oauth-aguardar) etapa_oauth_aguardar ;;
  oauth-status) etapa_oauth_status ;;
  gateway) etapa_gateway ;;
  verificar) etapa_verificar ;;
  *) echo "Uso: bash $0 conectar|preparar|hermes|telegram|oauth-iniciar|oauth-aguardar|oauth-status|gateway|verificar" >&2; exit 2 ;;
esac
