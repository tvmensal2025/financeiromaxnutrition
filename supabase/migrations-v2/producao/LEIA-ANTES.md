# Contas e esquema do motor da v2 no Supabase real

**Estado: APLICADO no Supabase real em 17/10/2026**, pelo conector, com o fundador autorizando ("pode criar") e o SHA-256 de cada arquivo conferido dentro da própria transação antes de executar. Conferido depois: as duas contas com os atributos exatos, vínculo `set=true inherit=false admin=false`, 13 tabelas e 3 funções de `dbos_motor`, migração 123, nenhum outro papel enxerga `dbos_helena_v2`, v1 e `helena_v2` intactas. **As senhas foram definidas pelo fundador no SQL Editor** e as duas contas conectaram da VPS com TLS verificado em 17/10/2026 (o `verify-full` usa a CA raiz do Supabase, que o instalador do motor instala em `/etc/helena-v2/ca-bundle.crt`). O passo das senhas abaixo fica como referência. Para rodar de novo em outro projeto, a frase exata é:

> **AUTORIZO CRIAR AS CONTAS helena_motor E dbos_motor E O ESQUEMA dbos_helena_v2 NO SUPABASE wxkgrykduqtsgmjkzlou**

## Por que existe
O motor de produção (`bancos.py`) recusa partir com credencial administrativa e exige duas contas próprias:

| Conta | Papel | Exigências que a verificação de partida confere |
|---|---|---|
| `helena_motor` | aplicativo | login, sem privilégio administrativo, não é dona de esquema, só **alterna** para `service_role` (sem herdar, sem administrar) |
| `dbos_motor` | DBOS | login, sem privilégio administrativo, dona de `dbos_helena_v2`, sem nenhum vínculo com `service_role` |

O DBOS roda com `run_migrations=False`, então o esquema dele precisa estar pronto antes. O arquivo 02 foi extraído do próprio DBOS 3.2.0 (13 tabelas, 3 funções, migração 123).

## Ordem (como o dono do banco, no SQL Editor ou no conector)
1. `01_contas_do_motor.sql` (2 contas sem senha, vínculo, esquema do DBOS). Pode repetir.
2. `02_esquema_dbos.sql` (tabelas do DBOS, como `dbos_motor`). Para com erro se o esquema já tiver tabelas.

Hashes (SHA-256): `01` = `63061eff3e6c9152554271b831f623c39747843f3230717396fc95f0afb47b2b`, `02` = `b3cbbbb991882199dec17d4f18f4a37cb53b5ac0bd4f7bccb46e7873c4afb167`.

## As senhas (você define, fora do repositório e fora do chat)
No SQL Editor do Supabase, com duas senhas fortes e diferentes:

```sql
alter role helena_motor password 'SENHA_FORTE_1';
alter role dbos_motor password 'SENHA_FORTE_2';
```

As duas senhas vão **só** para o arquivo de ambiente da VPS, dentro dos endereços de conexão:

```
postgresql://helena_motor.wxkgrykduqtsgmjkzlou:SENHA_1@HOST_DO_POOLER:5432/postgres?sslmode=verify-full
postgresql://dbos_motor.wxkgrykduqtsgmjkzlou:SENHA_2@HOST_DO_POOLER:5432/postgres?sslmode=verify-full
```

`HOST_DO_POOLER` é o endereço do **Session pooler** que o painel mostra em Connect (termina em `.pooler.supabase.com`, porta 5432). O motor só aceita esse formato, ou o endereço direto do projeto, e sempre com `sslmode=verify-full`. Se a senha tiver caracteres especiais, codifique-os na URL.

## O que os testes provam (`motor/orquestrador/testes/test_producao_contas.py`, 12 testes)
- As duas contas passam na verificação de partida **real** (`preflight_papel_runtime`), não em dados simulados.
- Uma não enxerga o que é da outra, e nenhuma cria papel, banco ou esquema.
- O DBOS sobe sem migração sobre o esquema pronto e roda um fluxo.
- Aplicar como administrador **sem superusuário**, como o `postgres` do Supabase, funciona e pode repetir. (O primeiro envio real, em 17/10, falhou aí por falta de `SET` sobre a conta nova; o arquivo e o teste já corrigem isso.)
- Conta pré-existente com privilégio administrativo para o arquivo com erro, em vez de ser alterada em silêncio.
- O 02 está em dia com o DBOS instalado: se a versão mudar, o teste falha e manda gerar de novo (`gerar_esquema_dbos.py`).

## Desfazer (só se ainda não houver workflow gravado)
```sql
drop schema dbos_helena_v2 cascade;
drop role if exists helena_motor;
drop role if exists dbos_motor;
```

## O que isto NÃO faz
Não toca em tabelas da v1, não cria senha, não ativa configuração e não liga o motor. Falta ainda o procedimento do primeiro cadastro de configuração em produção (README do motor) e o serviço na VPS.
