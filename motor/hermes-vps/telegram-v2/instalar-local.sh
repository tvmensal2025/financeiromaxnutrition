#!/usr/bin/env bash
# Verifica ou prepara GatewayRunner, config e adapter inbox no Hermes 0.15.1 fixado.
# Nao toca .env, auth.json, bot token, systemd, webhook nem processo em execucao.
set -euo pipefail

usage() {
  printf 'Uso: HERMES_015_TREE=/tmp/copia-hermes-015 bash instalar-local.sh --check|--apply\n' >&2
  exit 2
}

[[ $# -eq 1 ]] || usage
case "$1" in
  --check|--apply) action="$1" ;;
  *) usage ;;
esac

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -n "${HERMES_015_TREE:-}" ]] || usage
hermes_015_tree="$(realpath -e -- "$HERMES_015_TREE")"
case "$hermes_015_tree" in
  /tmp/*|/workspace/*) ;;
  *) printf 'ERRO: esta versao so aceita copia isolada em /tmp ou /workspace.\n' >&2; exit 1 ;;
esac
python3 "$script_dir/patch-hermes-telegram.py" --tree "$hermes_015_tree" "$action"
