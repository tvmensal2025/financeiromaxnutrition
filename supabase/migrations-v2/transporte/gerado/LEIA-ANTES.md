# Instalar a v2 no Supabase — LEIA ANTES (roteiro gerado para revisão)

**HISTÓRICO: este roteiro JÁ FOI EXECUTADO em 17/10/2026** (pelo conector, com a frase exata abaixo; ver bloco E-2 do HANDOFF). Não rode de novo. Os itens de "Antes de aplicar" ficam como registro: o item 2 (cópia de segurança) não foi feito, porque o conector não faz `pg_dump`, e o item 4 foi decidido ao contrário (o app exige `helena_v2` exposto na API). Os hashes valem os do `manifesto.json`. A frase exata era:

> **AUTORIZO INSTALAR A V2 (MIGRATIONS 0001 A 0019) NO SUPABASE wxkgrykduqtsgmjkzlou**

Até recebê-la, este roteiro fica parado.

## Antes de aplicar (conferir, sem mudar nada)
1. **Projeto certo.** O projeto canônico é `wxkgrykduqtsgmjkzlou` (ecosistemadossonhos). O projeto `imvfmjgmacrulhztrqlh` é histórico: **não** aplicar nele. Confirme o endereço do projeto na tela do Supabase antes de colar qualquer coisa.
2. **Cópia de segurança feita e restaurável.** Faça a cópia completa do banco e guarde. O ensaio local (`supabase/migrations-v2/testes/test_22_backup_e_restauracao.py`) prova o método num banco de teste; o tempo real só se mede no banco real. Sem cópia, não aplique.
3. **Nenhum job crítico rodando** (125 jobs, 148 tarefas e 241 handoffs existem hoje no banco: este roteiro **não** mexe neles; só cria o esquema `helena_v2`).
4. **Esquema não exposto na API.** Confirme que `helena_v2` **não** está na lista de esquemas expostos da API do projeto. As telas falam com as funções (RPC) por permissão; a lista de exposição é decisão do fundador e **NÃO CONFIRMADA** aqui.
5. **Hash dos arquivos.** Os arquivos abaixo têm de bater com `manifesto.json` (`sha256sum`).
- `01_instalar_v2.sql`: `d2fe3c96b3a12f25120fb113009cb9e1d938173929c4ca6f248e6e14d877c350`
- `02_base_tecnica.sql`: `cd4330513b9803120b7c29de6422529256d204ea88291d2c36df53c593e213d3`
- `03_conferir_depois.sql`: `1c81a2e7dbdaf8f8267ef3f0bc0d6c9dea25e020e319b18b445ca9e98cf900db`
   Hash do conteúdo da configuração técnica: `7000b2b142cd2da162c8183a00846a2c411d2796c93710ab2a00803bf42da2bf`.

## Ordem
1. `01_instalar_v2.sql` (uma transação: ou entra tudo, ou nada).
2. `02_base_tecnica.sql` (regista a configuração técnica).
3. `03_conferir_depois.sql` (todas as linhas devem dizer `ok = true`).
4. Só então o fundador ativa uma revisão pela tela de configuração.

## Se algo der errado
- Falha em `01`: a transação desfaz tudo; o banco volta como estava. Não tente consertar à mão.
- Falha em `03` depois de `01` e `02`: **não use a v2**. Se nenhum card real existir, o esquema pode ser removido restaurando a cópia de segurança. Não apague tabelas à mão e não mexa na v1.
- Qualquer dúvida: pare e avise o fundador.

## O que este roteiro NÃO faz
Não toca no Hermes, no EasyPanel, em chaves, nem nas tabelas da v1. Não ativa revisão, não cria card e não chama agente.
