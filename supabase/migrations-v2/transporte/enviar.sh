#!/usr/bin/env bash
# Envia um JSON ({arquivo, parte, conteudo}) para public.helena_v2_instalacao_pedacos pela API REST do projeto.
# A chave anon (pública) é lida do script da v1 e nunca impressa. Só INSERT é permitido a ela nessa tabela.
set -euo pipefail
ARQ="$1"; RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
K=$(python3 -c "import re;t=open('$RAIZ/scripts/testar-leitura-supabase-real.mjs').read();print(re.search(r\"SUPABASE_KEY = '([^']+)'\",t).group(1))")
curl -sS -m 180 -o /dev/null -w "%{http_code}" -X POST "https://wxkgrykduqtsgmjkzlou.supabase.co/rest/v1/helena_v2_instalacao_pedacos" \
  -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -H "Prefer: return=minimal" --data-binary @"$ARQ"
echo " $ARQ"
