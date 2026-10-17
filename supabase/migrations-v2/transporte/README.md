# Transporte da instalação da v2 até o Supabase (sessões sem acesso direto ao banco)

Quando a sessão só alcança o Supabase pelo conector (MCP) e não pela rede, o SQL da instalação não cabe
nas chamadas do conector sem ser redigitado. Este transporte leva os bytes intactos:

1. `python -m orquestrador gerar-instalacao --saida PASTA` (em `motor/orquestrador`, com `PYTHONPATH=.:../executor:../validador:../ferramentas`).
2. `python3 preparar.py PASTA SAIDA`: tira `begin;`/`commit;` do `01` e do `02` (o DO block já é uma transação) e gera os JSON com o conteúdo inteiro de cada arquivo.
3. No banco, pelo conector, criar a tabela de transporte (`tabela.sql`).
4. `./enviar.sh SAIDA/01.json` e `./enviar.sh SAIDA/02.json`: POST na API REST do projeto com a chave **anon** (pública), que só pode inserir. Exige que a rede da sessão alcance `wxkgrykduqtsgmjkzlou.supabase.co` (domínio permitido no ambiente).
5. No banco, conferir o SHA-256 de cada arquivo contra o `manifesto.json` e só então executar (`executar.sql`).
6. Apagar a tabela de transporte (`limpar.sql`).

Nada aqui contém segredo: a chave anon é lida de `scripts/testar-leitura-supabase-real.mjs` e nunca é impressa.
