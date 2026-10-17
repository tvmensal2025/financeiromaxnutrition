#!/usr/bin/env bash
# Motor da Helena v2 na VPS (sem Docker, sem EasyPanel). Roda DENTRO da VPS, como root. Etapas repetíveis.
#   preparar -> codigo -> motor-venv -> hermes-venv -> login -> banco -> conferir -> servicos
#   depois, pela tela: Clonar a técnica e Pedir validação  ->  aqui: validar-config  ->  tela: Ativar  ->  aqui: ligar-motor
# O que ele NÃO faz: não mexe no Hermes 0.15.1 do profissional (/usr/local/lib/hermes-agent, /root/.hermes), nem no
# EasyPanel, nem na v1. O motor usa um Hermes 0.19.0 PRÓPRIO, um login PRÓPRIO e um usuário sem privilégio.
# Uso: bash instalar-motor.sh tudo   (ou uma etapa: bash instalar-motor.sh <etapa>)
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive PATH="/root/.local/bin:$PATH"

HELENA_USUARIO="${HELENA_USUARIO:-helena}"
HELENA_BASE="${HELENA_BASE:-/opt/helena-v2}"                 # código e venvs (de helena, só leitura em produção)
HELENA_VAR="${HELENA_VAR:-/var/lib/helena-v2}"               # login do Hermes e pastas das execuções (fora de qualquer repositório)
HELENA_ETC="${HELENA_ETC:-/etc/helena-v2}"                   # motor.env (as duas conexões; só root e helena leem)
HELENA_LOG="${HELENA_LOG:-/var/log/helena-v2}"
HELENA_REPO_URL="${HELENA_REPO_URL:-https://github.com/tvmensal2025/financeiromaxnutrition.git}"
HELENA_REF="${HELENA_REF:-main}"                             # ramo ou commit do código do motor; para atualizar, passe o SHA completo (40 hex)
PYTHON_VERSAO="${PYTHON_VERSAO:-3.13}"
# O Python dos venvs precisa ficar onde o usuario helena le (nao em /root/.local): senao os executaveis dao "Permission denied".
export UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR:-${HELENA_BASE:-/opt/helena-v2}/python}" UV_PYTHON_PREFERENCE=only-managed
PROJETO_REF="wxkgrykduqtsgmjkzlou"
POOLER_PADRAO="aws-0-us-east-1.pooler.supabase.com"          # Session pooler (porta 5432) do projeto; confira em Connect no painel
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"

REPO="$HELENA_BASE/repo"; VENV_MOTOR="$HELENA_BASE/venv-motor"; VENV_HERMES="$HELENA_BASE/venv-hermes"
HERMES_HOME_V2="$HELENA_VAR/hermes-home"; EXECUCOES="$HELENA_VAR/execucoes"; ENV_ARQ="$HELENA_ETC/motor.env"
PYTHONPATH_MOTOR="$REPO/motor/orquestrador:$REPO/motor/executor:$REPO/motor/validador:$REPO/motor/ferramentas"

ok()   { printf 'OK: %s\n' "$*"; }
fail() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }
como_helena() { runuser -u "$HELENA_USUARIO" -- env HOME="$HELENA_VAR" "$@"; }

[ "$(id -u)" = 0 ] || fail "rode como root."

etapa_preparar() {
  command -v git >/dev/null && command -v curl >/dev/null || {
    apt-get update -y >/dev/null && apt-get install -y git curl ca-certificates >/dev/null || fail "falhou instalar git/curl (apt)."; }
  if ! command -v uv >/dev/null && ! test -x /root/.local/bin/uv; then
    curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh && sh /tmp/uv-install.sh >/dev/null 2>&1 || fail "falhou instalar o uv."
    rm -f /tmp/uv-install.sh
  fi
  command -v uv >/dev/null || fail "uv nao ficou disponivel no PATH."
  install -d -m 0755 "$HELENA_BASE"
  uv python install "$PYTHON_VERSAO" >/dev/null 2>&1 || fail "falhou instalar o Python $PYTHON_VERSAO pelo uv."
  chmod -R a+rX "$UV_PYTHON_INSTALL_DIR" "$HELENA_BASE" 2>/dev/null || true
  id "$HELENA_USUARIO" >/dev/null 2>&1 || useradd --system --home-dir "$HELENA_VAR" --shell /usr/sbin/nologin "$HELENA_USUARIO" \
    || fail "falhou criar o usuario $HELENA_USUARIO."
  install -d -m 0755 "$HELENA_BASE"
  install -d -m 0700 -o "$HELENA_USUARIO" -g "$HELENA_USUARIO" "$HELENA_VAR" "$HERMES_HOME_V2" "$EXECUCOES"
  install -d -m 0755 -o "$HELENA_USUARIO" -g "$HELENA_USUARIO" "$HELENA_LOG"
  install -d -m 0750 -o root -g "$HELENA_USUARIO" "$HELENA_ETC"
  ok "servidor preparado (uv, Python $PYTHON_VERSAO, usuario $HELENA_USUARIO, pastas)"
}

# O repositório é PRIVADO: pede um token de leitura do GitHub (fine-grained, só Contents: read), usa-o uma vez pelo
# GIT_ASKPASS e nao o grava em lugar nenhum (a URL do remoto fica limpa).
etapa_codigo() {
  # Repositorio publico: clona sem token. Privado: pede o token de leitura (HELENA_REPO_TOKEN ou digitado).
  askpass=""
  git config --global --get-all safe.directory 2>/dev/null | grep -qx "$REPO" || git config --global --add safe.directory "$REPO"
  if [ -z "${HELENA_REPO_TOKEN:-}" ] && ! GIT_TERMINAL_PROMPT=0 git ls-remote -q "$HELENA_REPO_URL" HEAD >/dev/null 2>&1; then
    [ -r /dev/tty ] || fail "repositorio privado e sem terminal para pedir o token. Defina HELENA_REPO_TOKEN."
    read -rs -p "Token de LEITURA do GitHub para o repositorio (nao aparece na tela): " HELENA_REPO_TOKEN </dev/tty \
      || fail "nao consegui ler o token."; echo
    [ -n "$HELENA_REPO_TOKEN" ] || fail "token vazio."
  fi
  export GIT_TERMINAL_PROMPT=0
  if [ -n "${HELENA_REPO_TOKEN:-}" ]; then
    askpass="$(mktemp)"; chmod 700 "$askpass"
    printf '#!/bin/sh\ncase "$1" in *sername*) echo x-access-token;; *) echo "$HELENA_REPO_TOKEN";; esac\n' > "$askpass"
    export GIT_ASKPASS="$askpass" HELENA_REPO_TOKEN
  fi
  if [ -d "$REPO/.git" ]; then
    git -C "$REPO" fetch --quiet origin "$HELENA_REF" || { rm -f "$askpass"; fail "falhou atualizar o codigo (rede ou ramo $HELENA_REF)."; }
  else
    rm -rf "$REPO"
    git clone --quiet --no-single-branch "$HELENA_REPO_URL" "$REPO" || { rm -f "$askpass"; fail "falhou clonar o repositorio (rede ou token)."; }
  fi
  [ -n "$askpass" ] && rm -f "$askpass"; unset GIT_ASKPASS HELENA_REPO_TOKEN
  git -C "$REPO" checkout --quiet --detach "origin/$HELENA_REF" 2>/dev/null || git -C "$REPO" checkout --quiet --detach "$HELENA_REF" \
    || fail "ramo ou commit $HELENA_REF nao encontrado."
  grep -q "x-access-token\|@github.com" "$REPO/.git/config" && fail "a URL do remoto ficou com credencial; apague $REPO e repita."
  chown -R "$HELENA_USUARIO:$HELENA_USUARIO" "$REPO"
  ok "codigo em $REPO no commit $(git -C "$REPO" rev-parse --short HEAD) ($HELENA_REF)"
}

etapa_motor_venv() {
  [ -f "$REPO/motor/orquestrador/requirements.txt" ] || fail "codigo ausente: rode a etapa codigo."
  uv venv --quiet --clear --python "$PYTHON_VERSAO" "$VENV_MOTOR" || fail "falhou criar o venv do motor."
  uv pip install --quiet --python "$VENV_MOTOR/bin/python" -r "$REPO/motor/orquestrador/requirements.txt" \
    || fail "falhou instalar as dependencias do motor."
  "$VENV_MOTOR/bin/python" -c 'import dbos, psycopg, yaml, jsonschema' || fail "dependencias do motor nao importam."
  chown -R "$HELENA_USUARIO:$HELENA_USUARIO" "$VENV_MOTOR"
  ok "venv do motor em $VENV_MOTOR"
}

etapa_hermes_venv() {
  [ -f "$REPO/motor/executor/requirements-hermes-real.txt" ] || fail "codigo ausente: rode a etapa codigo."
  uv venv --quiet --clear --python "$PYTHON_VERSAO" "$VENV_HERMES" || fail "falhou criar o venv do Hermes 0.19.0."
  uv pip install --quiet --python "$VENV_HERMES/bin/python" -r "$REPO/motor/executor/requirements-hermes-real.txt" \
    || fail "falhou instalar o hermes-agent 0.19.0."
  site_packages="$("$VENV_HERMES/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')" \
    || fail "nao achei o site-packages do Hermes."
  "$VENV_HERMES/bin/python" "$REPO/motor/hermes-vps/patch-hermes-auth.py" "$site_packages" \
    || fail "correcao de autenticacao do Hermes nao aplicada; login e motor bloqueados."
  "$VENV_HERMES/bin/python" "$REPO/motor/hermes-vps/testar-patch-hermes-auth.py" \
    || fail "testes locais da autenticacao do Hermes falharam; login e motor bloqueados."
  "$VENV_HERMES/bin/hermes" --version 2>/dev/null | grep -q "v0.19.0" || fail "o Hermes do motor nao e a 0.19.0."
  chown -R "$HELENA_USUARIO:$HELENA_USUARIO" "$VENV_HERMES"
  ok "Hermes 0.19.0 do motor em $VENV_HERMES (separado do Hermes do Telegram)"
}

conferir_patch_hermes() {
  [ -x "$VENV_HERMES/bin/python" ] || fail "rode a etapa hermes-venv antes."
  site_packages="$("$VENV_HERMES/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')" \
    || fail "nao achei o site-packages do Hermes."
  "$VENV_HERMES/bin/python" "$REPO/motor/hermes-vps/patch-hermes-auth.py" --check "$site_packages" \
    || fail "correcao de autenticacao do Hermes ausente ou incompleta; rode hermes-venv antes."
}

# Login PROPRIO da v2 (plano v3: um login so da v2, separado), na pasta que o motor usa como HELENA_V2_HERMES_HOME.
etapa_login() {
  conferir_patch_hermes
  [ -x "$VENV_HERMES/bin/hermes" ] || fail "rode a etapa hermes-venv antes."
  if como_helena env HERMES_HOME="$HERMES_HOME_V2" "$VENV_HERMES/bin/hermes" auth status openai-codex 2>/dev/null | grep -q "logged in"; then
    ok "login da v2 ja feito em $HERMES_HOME_V2"; return
  fi
  echo "Vai aparecer um link e um codigo. Abra o link, entre com a conta do ChatGPT da v2 e digite o codigo."
  como_helena env HERMES_HOME="$HERMES_HOME_V2" NO_COLOR=1 "$VENV_HERMES/bin/hermes" auth add openai-codex --no-browser </dev/tty \
    || fail "o login do ChatGPT nao terminou. Rode a etapa login de novo."
  como_helena env HERMES_HOME="$HERMES_HOME_V2" "$VENV_HERMES/bin/hermes" auth status openai-codex 2>/dev/null | grep -q "logged in" \
    || fail "o login nao ficou utilizavel."
  chmod 0600 "$HERMES_HOME_V2/auth.json" 2>/dev/null || true
  ok "login da v2 em $HERMES_HOME_V2/auth.json (so o usuario $HELENA_USUARIO le)"
}

# Monta o endereco de conexao no UNICO formato que o motor aceita (bancos.py): senha codificada, porta 5432, /postgres, verify-full.
montar_url() { # usuario senha host
  "$VENV_MOTOR/bin/python" - "$1" "$2" "$3" <<'PY'
import sys, urllib.parse
usuario, senha, host = sys.argv[1], sys.argv[2], sys.argv[3]
print(f"postgresql://{usuario}:{urllib.parse.quote(senha, safe='')}@{host}:5432/postgres?sslmode=verify-full")
PY
}

# Escreve motor.env. As senhas vem de variaveis ou do terminal (sem eco) e so existem dentro das URLs do arquivo (0640 root:helena).
etapa_banco() {
  [ -x "$VENV_MOTOR/bin/python" ] || fail "rode a etapa motor-venv antes."
  host="${HELENA_DB_HOST:-}"
  if [ -z "$host" ]; then
    [ -r /dev/tty ] || fail "sem terminal. Defina HELENA_DB_HOST, HELENA_SENHA_MOTOR e HELENA_SENHA_DBOS."
    read -r -p "Host do Session pooler [$POOLER_PADRAO]: " host </dev/tty; host="${host:-$POOLER_PADRAO}"
  fi
  if [ -z "${HELENA_SENHA_MOTOR:-}" ]; then read -rs -p "Senha de helena_motor (nao aparece): " HELENA_SENHA_MOTOR </dev/tty; echo; fi
  if [ -z "${HELENA_SENHA_DBOS:-}" ]; then read -rs -p "Senha de dbos_motor (nao aparece): " HELENA_SENHA_DBOS </dev/tty; echo; fi
  [ -n "$HELENA_SENHA_MOTOR" ] && [ -n "$HELENA_SENHA_DBOS" ] || fail "senha vazia."
  case "$host" in
    db.$PROJETO_REF.supabase.co) u_motor="helena_motor"; u_dbos="dbos_motor" ;;
    *.pooler.supabase.com)       u_motor="helena_motor.$PROJETO_REF"; u_dbos="dbos_motor.$PROJETO_REF" ;;
    *) fail "host fora do projeto $PROJETO_REF: use o Session pooler (*.pooler.supabase.com) ou db.$PROJETO_REF.supabase.co." ;;
  esac
  url_motor="$(montar_url "$u_motor" "$HELENA_SENHA_MOTOR" "$host")"
  url_dbos="$(montar_url "$u_dbos" "$HELENA_SENHA_DBOS" "$host")"
  umask 027
  cat > "$ENV_ARQ" <<EOF
# Motor da Helena v2. Gerado por instalar-motor.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ). So root e $HELENA_USUARIO leem.
HELENA_V2_DATABASE_URL=$url_motor
HELENA_V2_DBOS_SYSTEM_DATABASE_URL=$url_dbos
HELENA_V2_HERMES_BIN=$VENV_HERMES/bin/hermes
HELENA_V2_HERMES_HOME=$HERMES_HOME_V2
HELENA_V2_EXECUCOES_DIR=$EXECUCOES
PYTHONPATH=$PYTHONPATH_MOTOR
PYTHONDONTWRITEBYTECODE=1
SSL_CERT_FILE=$CA_BUNDLE
# HELENA_V2_EXECUTOR vazio = hermes (unico aprovado). HELENA_V2_ALARME_WEBHOOK_URL: opcional, canal de alarme do vigia.
# SUPABASE_ACCESS_TOKEN: so para preparar-tarefa-real (captura pela API de gestao); o despachante nao precisa. NAO CONFIRMADO.
EOF
  chown root:"$HELENA_USUARIO" "$ENV_ARQ"; chmod 0640 "$ENV_ARQ"
  unset HELENA_SENHA_MOTOR HELENA_SENHA_DBOS url_motor url_dbos
  ok "motor.env gravado em $ENV_ARQ"
  testar_banco
}

# O pooler do Supabase usa a CA propria do Supabase (Supabase Root 2021 CA), que nao esta no pacote do sistema.
# Monta CA do sistema + essa CA em um arquivo so e aponta SSL_CERT_FILE para ele no motor.env (o motor exige TLS verificado
# contra a CA "do sistema" e nao aceita desligar a verificacao). A CA baixada so vale se a impressao digital bater.
CA_SUPABASE_URL="https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt"
CA_SUPABASE_SHA256="80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA"
CA_BUNDLE="${CA_BUNDLE:-$HELENA_ETC/ca-bundle.crt}"
preparar_ca() {
  [ -r "$ENV_ARQ" ] || fail "sem $ENV_ARQ: rode a etapa banco."
  [ -r /etc/ssl/certs/ca-certificates.crt ] || { apt-get install -y ca-certificates >/dev/null 2>&1; update-ca-certificates >/dev/null 2>&1; }
  command -v openssl >/dev/null || apt-get install -y openssl >/dev/null 2>&1
  tmp_ca="$(mktemp)"
  curl -fsSL -m 30 "$CA_SUPABASE_URL" -o "$tmp_ca" || { rm -f "$tmp_ca"; fail "nao consegui baixar a CA do Supabase."; }
  fp="$(openssl x509 -in "$tmp_ca" -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2)"
  [ "$fp" = "$CA_SUPABASE_SHA256" ] || { rm -f "$tmp_ca"; fail "a CA baixada nao tem a impressao digital esperada ($fp)."; }
  cat /etc/ssl/certs/ca-certificates.crt "$tmp_ca" > "$CA_BUNDLE"; rm -f "$tmp_ca"
  chown root:"$HELENA_USUARIO" "$CA_BUNDLE"; chmod 0640 "$CA_BUNDLE"
  sed -i '/^SSL_CERT_FILE=/d' "$ENV_ARQ"; echo "SSL_CERT_FILE=$CA_BUNDLE" >> "$ENV_ARQ"
  ok "CA do Supabase conferida e adicionada em $CA_BUNDLE"
}

# Conecta como as duas contas com o PROPRIO codigo do motor: formato da URL, TLS verificado e preflight do papel.
testar_banco() {
  [ -r "$ENV_ARQ" ] || fail "sem $ENV_ARQ: rode a etapa banco."
  preparar_ca
  como_helena env -i PATH="$PATH" HOME="$HELENA_VAR" bash -c "set -a; . '$ENV_ARQ'; set +a; exec '$VENV_MOTOR/bin/python' - <<'PY'
import os, psycopg
from psycopg.rows import dict_row
from orquestrador.bancos import validar_destinos_reais, parametros_conexao_real, preflight_papel_runtime
validar_destinos_reais(os.environ['HELENA_V2_DATABASE_URL'], os.environ['HELENA_V2_DBOS_SYSTEM_DATABASE_URL'])
p = parametros_conexao_real()
for nome, sistema in (('HELENA_V2_DATABASE_URL', False), ('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', True)):
    with psycopg.connect(os.environ[nome].replace('postgresql+psycopg://', 'postgresql://', 1), autocommit=True, row_factory=dict_row, **p) as con:
        r = preflight_papel_runtime(con, sistema=sistema)
        print('OK: conexao', 'DBOS' if sistema else 'aplicativo', 'como', r['papel_atual'])
        if not sistema:
            con.execute('SET ROLE service_role')
            print('OK: tabela de regras confere =', con.execute('SELECT helena_v2.tabela_confere() AS c').fetchone()['c'])
        else:
            print('OK: esquema DBOS com', con.execute(\"SELECT count(*) AS n FROM pg_tables WHERE schemaname='dbos_helena_v2'\").fetchone()['n'], 'tabelas')
PY" || fail "a conexao com o banco falhou (senha, host do pooler, TLS ou papel). Corrija e rode a etapa banco de novo."
}

etapa_conferir() {
  conferir_patch_hermes
  [ -r "$ENV_ARQ" ] || fail "sem $ENV_ARQ: rode a etapa banco."
  saida="$(como_helena env -i PATH="$PATH" HOME="$HELENA_VAR" bash -c "set -a; . '$ENV_ARQ'; set +a; cd '$REPO/motor/orquestrador' && exec '$VENV_MOTOR/bin/python' -m orquestrador conferir-runtime")" \
    || fail "conferir-runtime falhou."
  printf '%s\n' "$saida" | "$VENV_MOTOR/bin/python" -c 'import json,sys; d=json.load(sys.stdin); h=[r for r in d["runtimes"] if r["nome"]=="hermes"][0]; print("hermes:", h["estado"], "faltando:", h["variaveis_faltando"] or "nada"); sys.exit(1 if h["variaveis_faltando"] else 0)' \
    || fail "faltam variaveis para o Hermes do motor."
  ok "runtime do motor conferido"
}

etapa_validar_config() {
  [ -r "$ENV_ARQ" ] || fail "sem $ENV_ARQ: rode a etapa banco."
  como_helena env -i PATH="$PATH" HOME="$HELENA_VAR" bash -c "set -a; . '$ENV_ARQ'; set +a; unset HELENA_V2_CONFIG_DATABASE_URL; cd '$REPO/motor/orquestrador' && exec '$VENV_MOTOR/bin/python' -m orquestrador validar-configuracoes" \
    || fail "validar-configuracoes falhou."
  ok "validacao rodada (se 'processadas' deu 0, o fundador ainda nao pediu validacao pela tela)"
}

unidade() { # nome descricao comando memoria
  cat > "$SYSTEMD_DIR/$1.service" <<EOF
[Unit]
Description=$2
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$HELENA_USUARIO
Group=$HELENA_USUARIO
EnvironmentFile=$ENV_ARQ
Environment=HOME=$HELENA_VAR
WorkingDirectory=$REPO/motor/orquestrador
ExecStart=$VENV_MOTOR/bin/python -m orquestrador $3
Restart=always
RestartSec=10
KillMode=mixed
TimeoutStopSec=30
MemoryMax=$4
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$HELENA_VAR $HELENA_LOG
[Install]
WantedBy=multi-user.target
EOF
  chmod 0644 "$SYSTEMD_DIR/$1.service"
}

etapa_servicos() {
  [ -r "$ENV_ARQ" ] || fail "sem $ENV_ARQ: rode a etapa banco."
  unidade helena-vigia "Helena v2 - vigia (so le o banco e grava alarmes)" "vigiar --saida $HELENA_LOG/alarmes.log" 256M
  unidade helena-relogio "Helena v2 - relogio dos prazos" "relogio" 256M
  unidade helena-despachante "Helena v2 - despachante (chama o Hermes; gasta cota)" "despachar --vagas 1" 1536M
  systemctl daemon-reload
  systemctl enable --now helena-vigia.service helena-relogio.service >/dev/null 2>&1 || fail "nao consegui ligar vigia e relogio."
  sleep 3
  systemctl is-active --quiet helena-vigia.service || fail "helena-vigia nao ficou ativo (journalctl -u helena-vigia -n 50)."
  systemctl is-active --quiet helena-relogio.service || fail "helena-relogio nao ficou ativo (journalctl -u helena-relogio -n 50)."
  ok "vigia e relogio ligados; despachante instalado mas DESLIGADO (liga com: bash $0 ligar-motor, depois de ativar a configuracao)"
}

etapa_ligar_motor() {
  conferir_patch_hermes
  [ -f "$SYSTEMD_DIR/helena-despachante.service" ] || fail "rode a etapa servicos antes."
  ativa="$(como_helena env -i PATH="$PATH" HOME="$HELENA_VAR" bash -c "set -a; . '$ENV_ARQ'; set +a; exec '$VENV_MOTOR/bin/python' - <<'PY'
import os, psycopg
from psycopg.rows import dict_row
from orquestrador.bancos import parametros_conexao_real
with psycopg.connect(os.environ['HELENA_V2_DATABASE_URL'], autocommit=True, row_factory=dict_row, **parametros_conexao_real()) as con:
    con.execute('SET ROLE service_role')
    # As tabelas so abrem por funcao (nem o service_role le configuracao_ponteiro): usa a mesma funcao do motor.
    r = con.execute('SELECT helena_v2.configuracao_ativa() AS revisao').fetchone()['revisao']
    print(r['id'] if r else '')
PY")" || fail "nao consegui ler o ponteiro de configuracao."
  [ -n "$ativa" ] || fail "nenhuma revisao de configuracao ATIVA: pela tela, Clonar -> Pedir validacao; aqui: validar-config; tela: Ativar."
  systemctl enable --now helena-despachante.service || fail "nao consegui ligar o despachante."
  sleep 5
  systemctl is-active --quiet helena-despachante.service || fail "despachante nao ficou ativo (journalctl -u helena-despachante -n 80)."
  ok "despachante ligado com a revisao ativa $ativa. Acompanhe: journalctl -u helena-despachante -f"
}

etapa_estado() {
  for s in helena-vigia helena-relogio helena-despachante; do printf '%-20s %s\n' "$s" "$(systemctl is-active "$s.service" 2>/dev/null || echo ausente)"; done
  [ -f "$HELENA_LOG/alarmes.log" ] && { echo "ultimos alarmes:"; tail -n 5 "$HELENA_LOG/alarmes.log"; } || echo "sem alarmes gravados"
  [ -d "$REPO/.git" ] && echo "codigo: $(git -C "$REPO" rev-parse --short HEAD)"
}

etapa_tudo() {
  etapa_preparar; etapa_codigo; etapa_motor_venv; etapa_hermes_venv; etapa_login; etapa_banco; etapa_conferir; etapa_servicos
  echo
  echo "PRONTO ATE AQUI. Falta, nesta ordem:"
  echo "  1. Na tela /configuracoes do site: Clonar a revisao tecnica e Pedir validacao."
  echo "  2. Aqui: bash $0 validar-config"
  echo "  3. Na tela: Ativar a revisao validada."
  echo "  4. Aqui: bash $0 ligar-motor"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    tudo) etapa_tudo ;;
    preparar) etapa_preparar ;;
    codigo) etapa_codigo ;;
    motor-venv) etapa_motor_venv ;;
    hermes-venv) etapa_hermes_venv ;;
    login) etapa_login ;;
    banco) etapa_banco ;;
    testar-banco) testar_banco ;;
    conferir) etapa_conferir ;;
    validar-config) etapa_validar_config ;;
    servicos) etapa_servicos ;;
    ligar-motor) etapa_ligar_motor ;;
    estado) etapa_estado ;;
    *) echo "Uso: bash $0 tudo | preparar|codigo|motor-venv|hermes-venv|login|banco|testar-banco|conferir|validar-config|servicos|ligar-motor|estado" >&2; exit 2 ;;
  esac
fi
