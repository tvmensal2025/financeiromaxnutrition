# 02 — O banco da v2 (schemas `helena_v2` e `dbos_helena_v2`)

**O que é:** o catálogo, lido do SQL, de tudo que o banco da Helena v2 tem: tabelas, funções (RPC), gatilhos, máquinas de estado, papéis e permissões, a Edge `helena-v2-telegram`, e o roteiro seguro para mudar qualquer uma dessas peças. Serve para qualquer IA programadora (Claude, Codex, o agente Theo) cuidar do banco sem reler as 26 migrations.
**Como mudar:** este arquivo descreve o código; quem manda é o SQL. Mudou uma migration, uma função ou uma permissão? Atualize a linha correspondente aqui no mesmo commit (tabelas na seção 4, funções na seção 5, estados na seção 6). Nunca escreva valores de segredo aqui, só nomes e lugares.
**De onde vem:** leitura de `supabase/migrations-v2/0001`–`0026`, `supabase/migrations-v2/producao/`, `supabase/functions/helena-v2-telegram/` e `supabase/config.toml`, em 17/10/2026, no checkout local. Nada foi consultado no Supabase real, nenhum SQL foi aplicado e nenhum segredo foi lido.
**Confiança:** o que está escrito aqui é **código no Git**. O estado do banco de produção hoje é **NÃO CONFIRMADO**: consulte-o (somente leitura, projeto `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou`) antes de afirmar qualquer coisa sobre produção. A última fotografia datada está em [onde-estamos.md](../onde-estamos.md) e diz que as migrations 0020–0026 foram aplicadas em 17/10/2026; o `README.md` da pasta das migrations ainda diz que a 0020 não foi aplicada (está desatualizado nesse ponto).

Leitura antes deste arquivo: [AGENTS.md](../../../AGENTS.md) e [mapa-do-sistema.md](../mapa-do-sistema.md).

---

## 1. Regras de ouro (leia antes de tocar em qualquer coisa)

1. **Tabelas fechadas, só funções.** Nenhum papel da API (`anon`, `authenticated`, `service_role`) tem `INSERT`, `UPDATE`, `DELETE` ou `TRUNCATE` em tabela da `helena_v2`. Tudo muda por função `SECURITY DEFINER` (RPC). `anon` não enxerga nada. Detalhes na seção 3.
2. **Uma função única muda o estado do card.** `helena_v2.aplicar_evento` é o único caminho que muda o estado de `card`, `etapa` e `acao_externa` (a criação do card passa por `criar_card`, hoje chamável só por dentro de `consumir_solicitacao_card_real` e `consumir_plano_pedido`). Gatilhos e `CHECK` conferem o resultado de novo (as "13 regras de ferro", seção 7).
3. **A regra do card mora no YAML, não no SQL.** As passagens (transições), tetos e guardas vêm de `helena-v2/maquina/passagens.yaml` + `vocabulario.yaml` e são **geradas** em `0002_passagens_geradas.sql`. Nunca edite o 0002 à mão.
4. **Não aplique nada no Supabase real sem autorização explícita do fundador** (AGENTS.md). Escrever o arquivo de migration no repositório é permitido; aplicá-lo, não. Detalhes na seção 9.
5. **Não toque em `supabase/migrations/`** (migrations da v1, história do banco real; DEC-028/DEC-032), nem em `services/` e `scripts/`. O Supabase CLI só olha `supabase/migrations/`; por isso a v2 vive em `supabase/migrations-v2/`, de propósito.
6. **O motor entra como `service_role`.** A conta de login é `helena_motor`, que só faz `SET ROLE service_role`. Quem decide o "papel" de uma chamada é `helena_v2._conta()`, não o usuário de login (seção 3).
7. **Mensagens de exceção em maiúsculas são contrato** (`SOMENTE_FUNDADOR_AUTENTICADO`, `CONFIG_VERSAO_DESATUALIZADA`, `PAREAMENTO_NAO_VALIDO`...): o app (`src/integrations/*`), o motor e a Edge testam esses textos e códigos SQLSTATE. Renomear quebra quem chama.
8. **Todo toque do fundador tem destino** (regra 11): `aplicar_evento` quase nunca levanta erro por regra de negócio; devolve `{"resultado": "RECUSADO" | "COMENTARIO_NO_CARD" | ...}` e grava o histórico. Erro SQL (`raise`) é reservado a permissão, parâmetro inválido ou violação de trava.

---

## 2. Mapa das migrations (0001–0026)

Todas em `supabase/migrations-v2/`. Em instalação nova, aplicam-se em ordem numérica, cada arquivo numa transação única (`psql -v ON_ERROR_STOP=1 -1 -f ...`). O harness de testes descobre os arquivos pelo padrão `[0-9][0-9][0-9][0-9]_*.sql`, então uma 0027 entra sozinha.

| Nº | Arquivo | O que cria ou muda | Origem |
|---|---|---|---|
| 0001 | `0001_esquema.sql` | schema `helena_v2`; sequência `seq_numero_execucao`; tabelas `mensagem`, `card`, `etapa`, `execucao`, `acao_externa`, `historico`, `entrega`, `conta_papel` | à mão |
| 0002 | `0002_passagens_geradas.sql` | 16 tabelas de regras (teto, variavel, estado_def, passagem...), colunas dos contadores e `CHECK` de domínio em card/etapa/acao_externa, funções `guarda()` e `situacao_da_etapa()`, selo (hash) da tabela | **gerado** do YAML por `gerar_passagens.py` |
| 0003 | `0003_funcao_unica.sql` | `aplicar_evento`, `disparar_automaticos`, `abrir_chamada_helena`, `criar_card`, `tabela_confere`, `conferir_historico`, `vigia` e ~25 funções internas | à mão (só mecânica) |
| 0004 | `0004_travas_e_permissoes.sql` | gatilhos e `CHECK` das 13 regras, `conferir_card`, permissões iniciais, linhas de `conta_papel` | à mão |
| 0005 | `0005_publicacao.sql` | `sou_fundador()`, `publicacoes`, `situacao_publicacao`, `pedir_publicacao`, RLS de card/etapa/entrega, `resposta_execucao` e suas duas funções | à mão |
| 0006 | `0006_configuracoes.sql` | `configuracao`, `configuracao_ponteiro`, `configuracao_validacao`, 11 RPCs de configuração e as internas, vínculo imutável `card.ordem_de_servico.config_revision_id` | à mão |
| 0007 | `0007_pedidos_reais.sql` | `solicitacao_card_real`, `solicitar/ler/consumir_solicitacao_card_real`, `conferir_fontes_card_real`, conferência contra `public.*`; **fecha `criar_card` para todos os papéis** | à mão |
| 0008 | `0008_resposta_coordenacao.sql` | `resposta_coordenacao`, `resultado_coordenacao`, 4 funções da coordenação (leitura de volta), gatilho que protege `LER_DE_VOLTA` de card real | à mão |
| 0009 | `0009_confirmacao_real.sql` | redefine `_real_conferir_captura`, `solicitar_card_real`, `consumir_solicitacao_card_real`, `_real_conferir_card_vinculado`; cria `_real_confirmacao_valida` (prazo, critérios, restrições, URLs) | à mão |
| 0010 | `0010_aprovacoes_fontes_reais.sql` | gatilho `a_real_proteger_aprovacao_fundador` no histórico | à mão |
| 0011 | `0011_lista_acoes_fundador.sql` | `listar_acoes_card` | à mão |
| 0012 | `0012_reacoes_fundador.sql` | **redefine** `aplicar_evento` (versão vista e domínio de parâmetros do fundador antes de reação) | à mão |
| 0013 | `0013_interacoes_fundador.sql` | coluna `historico.solicitante_uid`, gatilho `a0_vincular_toque_fundador`, `consultar_toque_fundador`, `ler_pergunta_etapa_fundador` | à mão |
| 0014 | `0014_leitura_card_fundador.sql` | `ler_leitura_card_fundador` | à mão |
| 0015 | `0015_card_real_ligado.sql` | redefine `_real_conferir_card_vinculado` (cadeia de cards ligados, até 16 saltos) | à mão |
| 0016 | `0016_manutencao_so_servico.sql` | só `REVOKE`/`GRANT`: 8 funções de manutenção deixam de ser do `authenticated` | à mão |
| 0017 | `0017_relogio.sql` | `eventos_devidos(p_agora)` (só leitura) | à mão |
| 0018 | `0018_publicacao_execucao.sql` | estados de `publicacoes`, gatilho de transição, 4 portas do trabalhador, redefine `situacao_publicacao` | à mão |
| 0019 | `0019_auditoria_de_ativacoes.sql` | `configuracao_ativacao`, `listar_ativacoes`, `reverter_configuracao`, redefine `ativar_configuracao` | à mão |
| 0020 | `0020_plano_exige_validador.sql` | redefine `_cabe`: `PLANO_VALIDO` nunca dispara como automático | à mão |
| 0021 | `0021_pedido_entrada.sql` | `pedido_entrada`, `pedido_entrada_evento`, `receber/ler/listar_pedido(s)_entrada` | à mão |
| 0022 | `0022_pareamento_telegram.sql` | `telegram_pareamento_codigo`, `telegram_vinculo`, `telegram_update_recebido`, 5 RPCs e 2 internas; redefine `receber_pedido_entrada` | à mão |
| 0023 | `0023_pedido_card_v2.sql` | `pedido_entrada_plano`, `confirmar_plano_pedido`, `ler/consumir_plano_pedido`; **renomeia** `_real_conferir_card_vinculado` para `_real_conferir_card_v1` e cria um roteador com o nome antigo; redefine `_resumo_pedido_entrada` | à mão |
| 0024 | `0024_proposta_pedido.sql` | `pedido_entrada_reserva/_resposta_bruta/_proposta`, 7 RPCs e 5 internas da proposta; redefine `consumir_plano_pedido` (agora `pedido_grande = false`) | à mão |
| 0025 | `0025_telegram_inbox.sql` | `telegram_inbox`, `telegram_trabalho`, `telegram_saida`, 8 funções do transporte | à mão |
| 0026 | `0026_pedido_telegram_avisos.sql` | índice único de avisos e 3 gatilhos que enfileiram avisos no Telegram | à mão |

Pastas e arquivos ao lado das migrations:

- `testes/` — a suíte pytest (seção 9.2).
- `gerar_passagens.py` — gera o 0002 a partir do YAML (`--conferir` só confere; `--stdout` imprime).
- `producao/01_contas_do_motor.sql`, `producao/02_esquema_dbos.sql`, `producao/gerar_esquema_dbos.py`, `producao/LEIA-ANTES.md` — contas do motor e schema do DBOS (seção 8).
- `transporte/` — levar o SQL até o Supabase quando a sessão só alcança o banco pelo conector (MCP); `transporte/gerado/` é o pacote da instalação 0001–0019 (histórico, já executado em 17/10/2026, **não rodar de novo**).
- `README.md` — texto da pasta; partes datadas (ver aviso acima).

Fora de `migrations-v2/`: `supabase/patches/` (patches da v1), `supabase/tests/` (SQL da v1) e `supabase/migrations/` (v1, protegida) **não** fazem parte da v2.

---

## 3. Papéis, permissões e a regra "tabelas fechadas, só funções"

### 3.1 Quem é quem

| Papel | O que é | O que pode |
|---|---|---|
| `anon` | visitante sem login do Supabase | `USAGE` não concedido: não vê nada de `helena_v2` |
| `authenticated` | usuário logado no site (JWT). Só vira **FUNDADOR** se `auth.uid()` estiver ativo com `role = 'founder'` em `public.app_access` (`helena_v2.sou_fundador()`) | `USAGE` no schema; `SELECT` em `card`, `etapa`, `entrega`, `publicacoes` (própria) e `solicitacao_card_real` (própria), todos com RLS; `EXECUTE` nas RPCs do fundador (seção 5, coluna "Quem chama" = FUNDADOR) |
| `service_role` | chave de backend (Edge, motor). Nunca vai ao navegador | `USAGE`; `SELECT` em tabelas de movimento e de regras; `EXECUTE` nas RPCs do motor. **Não** representa a autorização do fundador |
| `helena_motor` | conta de login do motor Python. `LOGIN`, `NOINHERIT`, sem privilégio administrativo, não é dona de schema; só pode `SET ROLE service_role` (sem herdar, sem administrar) | O motor faz `SET ROLE service_role` e passa a ser `_conta() = 'service_role'` |
| `dbos_motor` | conta de login do DBOS. Dona do schema `dbos_helena_v2`; **sem** vínculo com `service_role` | Só o schema do DBOS (seção 8) |
| dono do schema / `postgres` | quem aplica migrations | `_conferir_conta` aceita superusuário ou dono do schema mesmo sem linha em `conta_papel` (é assim que migrations e testes rodam) |

Contas de login, vínculo `SET`/`NOINHERIT` e schema do DBOS estão em `producao/01_contas_do_motor.sql`. Senhas **nunca** vão para o repositório; o fundador define fora do chat (seção 8).

### 3.2 Como a função descobre o papel (`_conta()` e `conta_papel`)

- `helena_v2._conta()` devolve `current_setting('role')` (o papel do `SET ROLE`, é assim que o PostgREST/Supabase entra) ou, se não houve `SET ROLE`, o `session_user`.
- `helena_v2._conferir_conta(papeis[])` (0003) valida o **papel de negócio** pedido contra a tabela `conta_papel`:
  - `authenticated` só pode agir como `FUNDADOR`, e só se `sou_fundador()` for verdadeiro (senão `FUNDADOR_NAO_AUTORIZADO`);
  - `service_role` pode agir como `MOTOR`, `HELENA`, `AUTOR`, `REVISOR`, `RELOGIO`, `VIGIA` (linhas inseridas em `conta_papel` pela 0004); nunca como `FUNDADOR`;
  - conta **sem** linha em `conta_papel` só passa se for superusuária ou dona do schema.
- As RPCs fora da máquina (0005 em diante) fazem checagem própria no começo do corpo: `if not helena_v2.sou_fundador() then raise 'SOMENTE_FUNDADOR_AUTENTICADO'` (SQLSTATE `42501`) ou `if helena_v2._conta() <> 'service_role' then raise 'SOMENTE_MOTOR'` / `'SOMENTE_SERVICO'` (mesmo papel; só a mensagem muda).
- `sou_fundador()` é `false` para `service_role` mesmo que exista usuário: exige `_conta() = 'authenticated'`.

### 3.3 A regra, camada por camada

| Camada | O que faz | Onde nasceu |
|---|---|---|
| Privilégio | `REVOKE ALL` em todas as tabelas para `public`, `anon`, `authenticated`, `service_role`; depois só `SELECT` onde a tabela abaixo diz | 0004 e o fim de cada migration |
| Função `SECURITY DEFINER` | única porta de escrita; `search_path` fixo | 0003 em diante |
| Gatilho `a_so_pela_funcao` | em `card`, `etapa`, `acao_externa`, `historico`, `entrega`, `execucao`, `mensagem` recusa `INSERT`/`UPDATE` se o parâmetro de sessão `helena_v2.funcao_unica` não for `'sim'` (só `_entrar()` o liga) | 0004 |
| Gatilhos `a_nunca_apagar`, `a_nunca_truncar` | recusam `DELETE`/`TRUNCATE` nas mesmas 7 tabelas | 0004 |
| RLS | ligada em 21 das tabelas (lista na seção 4); sem política nas tabelas "fechadas" | 0005 em diante |
| Tabelas de regras | `trg_tabela_de_regras` só deixa mudar com `helena_v2.migrando = 'sim'` (só o 0002 e o 0004 ligam) | 0004 |
| Histórico imutável | tabelas de auditoria têm gatilho `before update or delete` e `before truncate` que sempre recusa | 0004, 0006, 0007, 0008, 0019, 0023, 0024 |

Observação honesta: `helena_v2.funcao_unica` é um parâmetro de sessão; quem **já tem** privilégio de escrita (dono, superusuário) consegue ligá-lo. A fronteira real contra os papéis da API é a **ausência de `GRANT`**, não o gatilho. Por isso toda migration nova termina com `REVOKE ALL ... FROM public, anon, authenticated, service_role` e só então concede o mínimo.

### 3.4 Matriz de leitura direta de tabela (o que o cliente consegue `select`)

| Tabela | `authenticated` | `service_role` |
|---|---|---|
| `card`, `etapa`, `entrega` | SELECT, RLS `*_fundador` (`sou_fundador()`), **todas as linhas, de todas as empresas** | SELECT (grant 0004; política `*_motor using (true)`) |
| `publicacoes` | SELECT, RLS: `solicitado_por = auth.uid()` e fundador | SELECT (política `publicacoes_motor`) |
| `solicitacao_card_real` | SELECT, RLS: `solicitado_por = auth.uid()` e fundador | nenhum |
| `mensagem`, `execucao`, `acao_externa`, `historico`, 16 tabelas de regras | nenhum | SELECT (grant 0004 abrangeu as tabelas existentes naquela data) |
| `configuracao` | **nenhum** (existe a política `configuracao_fundador_leitura`, mas a 0006 não concede o `SELECT`; a leitura é por RPC) | nenhum (RPC) |
| todas as demais (pedidos, propostas, Telegram, coordenação, resposta_execucao, ponteiro, validação, ativação, `conta_papel`) | nenhum | nenhum (só por função) |

O site lê `card`, `etapa`, `entrega` e `solicitacao_card_real` direto (`src/integrations/cards-v2`, `comando-v2`) e todo o resto por RPC. `listar_acoes_card` existe justamente porque `acao_externa` não tem `SELECT` para o fundador.

### 3.5 Tabelas do `public` que a v2 lê (e nunca escreve)

`public.app_access` (quem é fundador), `public.checkpoint_mestre` e a view `public.checkpoint_mestre_atual`, `public.portfolio`, `public.tarefas`, `public.decisoes`, `public.agent_jobs` (conferência de fontes em `_real_conferir_captura` e `_pedido_proposta_contexto`). Essas funções fazem `LOCK TABLE ... IN SHARE MODE` em `checkpoint_mestre` (e, nas propostas, `decisoes` e `portfolio`) para a conferência e a gravação verem a mesma fotografia. `auth.uid()` e `extensions.digest`/`extensions.gen_random_bytes` (pgcrypto) também são dependências do Supabase. Se uma migration passar a ler coluna nova dessas tabelas, atualize o stub em `testes/integral.py` (seção 9.2).

---

## 4. Catálogo de tabelas (45 no schema `helena_v2`)

Contagem conferida pelas migrations: 8 de movimento + 16 de regras + `publicacoes` + `resposta_execucao` + 4 de configuração + `solicitacao_card_real` + 2 de coordenação + 6 de pedido + 6 de Telegram = 45, o mesmo número da fotografia de [onde-estamos.md](../onde-estamos.md). RLS ligada em 21 (`card`, `etapa`, `entrega`, `publicacoes`, `configuracao`, `configuracao_ponteiro`, `configuracao_validacao`, `configuracao_ativacao`, `solicitacao_card_real`, `pedido_entrada`, `pedido_entrada_evento`, `pedido_entrada_plano`, `pedido_entrada_reserva`, `pedido_entrada_resposta_bruta`, `pedido_entrada_proposta`, `telegram_pareamento_codigo`, `telegram_vinculo`, `telegram_update_recebido`, `telegram_inbox`, `telegram_trabalho`, `telegram_saida`); as demais ficam protegidas só por privilégio e gatilho.

Abreviações: **só pela função** = nenhum papel da API escreve; a função citada escreve como dona. "Lê" lista quem consegue ler **a tabela** (leitura via RPC está na seção 5).

### 4.1 Núcleo da máquina do card (0001, 0004)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê |
|---|---|---|---|---|
| `mensagem` | cada mensagem do fundador, gravada uma vez (regra 11) | `canal`+`numero` únicos, `conteudo` | `criar_card` | `service_role` |
| `card` | o pedido em andamento | `id`, `titulo`, `empresa`, `ordem_de_servico` (jsonb: contém `config_revision_id`, `modo_contexto`, `origem`, `dados_reais`...), `prioridade`, `prazo` (só o fundador muda), `estado`, `dono`, `prazo_ate`, `versao`, `chamada_helena`, `card_pai_id`, `mensagem_id`; contadores gerados no 0002: `pedido_grande`, `motivo`, `ordens`, `perguntas`, `voltas`, `nivel_prazo`, `lembretes`, `falhas_helena`, `validacoes`, `mudancas_prazo`, `fim` | `aplicar_evento`, `criar_card`, `abrir_chamada_helena`, `_mudar_campo_do_fundador` | fundador (RLS), `service_role` |
| `etapa` | uma peça do roteiro do card (uma linha por geração; "refazer" cria linha nova e a antiga fica final) | `card_id`, `codigo`, `ordem`, `geracao`, `atual`, `autor`, `revisores`, `revisores_validos`, `julgadores`, `depende_de`, `julga`, `estado`, `execucao_atual`, `portao1_ok`, `entrega_fresca`, `pulada`, `respostas_guardadas`; gerados: `motivo`, `espera`, `execucoes`, `formato`, `tempo`, `chamadas`, `reprovacoes`, `infra`, `aviso`, `replan`, `exec_viva`, `revisor`, `semaforo`, `fim`, `tem_internet`, `julgadora`, `julgada`, `pulavel`, `permite_perguntar`, `permite_devolver`, `usa_decisao`, `prazo_de_terceiro` (os compartilhados `ordens`, `perguntas`, `voltas` moram no card) | `aplicar_evento` | fundador (RLS), `service_role` |
| `execucao` | cada chamada de agente ou da Helena, com número da sequência que nunca zera (regra 3) | `numero`, `tipo` (AUTOR, REVISOR, HELENA), `card_id`, `etapa_id`, `estado` (VIVA, RESPONDIDA, MORTA, SUBSTITUIDA) | `aplicar_evento`, `abrir_chamada_helena` | `service_role` |
| `acao_externa` | proposta de ação de fora, só nasce do card pronto (regra 8) | `card_id`, `codigo` (A1, A2...), `etapa_id`, `tipo` (SO_FUNDADOR, PELO_MOTOR), `estado`, `ok_registrado`, `tentativas`, `lembretes`, `tem_ferramenta` | `aplicar_evento` (sinal `CRIAR_ACAO_EXTERNA` da linha E110) | `service_role`; fundador só via `listar_acoes_card` |
| `historico` | uma linha por evento, só de acréscimo; reconstrói o card (regra 13) | `card_id`, `maquina`, `alvo_id`, `papel`, `evento`, `linha_id`, `resultado` (APLICADO, CONVERTIDO, REACAO, COMENTARIO_NO_CARD, CARD_NOVO_LIGADO, RESPOSTA_GUARDADA, RECUSADO), `estado_antes/depois`, `vars_antes/depois`, `numero_toque`, `conta`, `solicitante_uid` (0013), `origem` (EXTERNO, AUTOMATICO, SINAL), `origem_id` | `aplicar_evento`, `criar_card`, `_acao_no_card` | `service_role` |
| `entrega` | a resposta do agente por execução, imutável; só o relatório do portão 1 entra depois, uma vez | `etapa_id`, `versao`, `numero_execucao` (único), `parecer`, `acao_externa`, `conteudo`, `portao1` (PASSOU/RECUSOU), `relatorio_validacao` | `aplicar_evento` (eventos `ENTREGAR`, `PORTAO1_OK`, `PORTAO1_RECUSOU`) | fundador (RLS), `service_role` |
| `conta_papel` | quem pode dizer qual papel | `conta`, `papel` | só migration | ninguém (grant revogado) |

### 4.2 Tabelas de regras (0002, geradas; leitura só `service_role`)

`teto`, `variavel`, `config_nome`, `estado_def`, `prazo_def`, `macro`, `passagem`, `ligacao`, `automatico`, `reacao`, `regra_geral`, `vocab_evento`, `predicado_lista`, `entrada`, `identidade`, `meta_tabela`. Só mudam por migration gerada (gatilho `a_so_por_migracao`). `meta_tabela` guarda `versao`, `impressao_digital` (do YAML) e `hash_das_linhas` (selo calculado pelo banco). `helena_v2.tabela_confere()` recalcula o hash das 15 tabelas de regras mais o corpo de `guarda()` e `situacao_da_etapa()` e compara com o selo; editar uma linha à mão faz dar falso e o motor não liga.

### 4.3 Publicação e resposta durável (0005, 0018)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê | RLS |
|---|---|---|---|---|---|
| `publicacoes` | pedido de publicação, no máximo **um por dia de Brasília** (`dia_brasilia` único, global) | `solicitado_por`, `pedido_em`, `dia_brasilia`, `estado`, `destino`, `versao_publicada`, `iniciada_em`, `concluida_em`, `falhou_em`, `revertida_em`, `erro` | `pedir_publicacao`; `reivindicar/concluir/falhar/reverter_publicacao` | fundador (as próprias), `service_role` | `publicacoes_do_fundador`, `publicacoes_motor` |
| `resposta_execucao` | resposta do agente gravada **antes** do portão 1; relida após queda | `numero` (PK, FK `execucao`), `resposta`, `gravada_em` | `registrar_resposta_execucao` | `ler_resposta_execucao` | sem RLS, sem grant |

### 4.4 Configuração versionada (0006, 0019)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê |
|---|---|---|---|---|
| `configuracao` | revisões do bundle (agentes, serviços, organograma, máquina...) | `nome`, `conteudo` (jsonb; chaves são caminhos como `helena-v2/servicos.yaml`), `versao`, `estado` (RASCUNHO, VALIDADA, APOSENTADA), `tecnica`, `base_id`, `hash_sha256`, `impressao_maquina` | `salvar_rascunho`, `registrar_validacao_config`, `registrar_configuracao_tecnica`, `aposentar_configuracao` | só por RPC |
| `configuracao_ponteiro` | linha única (`unico = true`): qual revisão é a técnica e qual é a ativa | `tecnica_id`, `ativa_id` | `registrar_configuracao_tecnica`, `ativar_configuracao`, `reverter_configuracao` | só por RPC |
| `configuracao_validacao` | pedidos de validação (no máximo um pendente por revisão) | `configuracao_id`, `versao`, `hash_sha256`, `concluida_em`, `cancelada_em`, `resultado` | `solicitar_validacao_config`, `registrar_resultado_validacao`, `registrar_validacao_config`, `salvar_rascunho` (cancela) | só por RPC |
| `configuracao_ativacao` | quem ativou ou reverteu qual revisão e quando (só acréscimo) | `configuracao_id`, `anterior_id`, `ativada_por`, `ativada_em`, `tipo` (ATIVACAO, REVERSAO) | `ativar_configuracao`, `reverter_configuracao` | `listar_ativacoes` |

### 4.5 Pedido real da v1 (tarefa existente) e coordenação (0007–0009)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê |
|---|---|---|---|---|
| `solicitacao_card_real` | pedido do fundador para virar card a partir de uma tarefa de `public.tarefas`, com captura conferida | `chave_origem` (id da tarefa), `business_id`, `solicitado_por`, `chave_idempotencia` (único com `solicitado_por`), `plano`, `dados_reais`, `config_revision_id`, `payload_hash`, `card_id`, `roteiro_hash`, `consumida_em` | `solicitar_card_real`; `consumir_solicitacao_card_real` (único `UPDATE` permitido: preenche card/roteiro/consumo) | fundador (própria, RLS) |
| `resposta_coordenacao` | resposta da Helena gravada antes de `LER_DE_VOLTA`, imutável | `numero` (PK, FK `execucao`), `resposta` | `registrar_resposta_coordenacao` | só por RPC |
| `resultado_coordenacao` | marca que a resposta já foi aplicada (recuperação por histórico) | `numero`, `resultado`, `historico_id` (único) | `aplicar_resposta_coordenacao` | só por RPC |

### 4.6 Pedido de entrada, plano e proposta (0021, 0023, 0024)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê |
|---|---|---|---|---|
| `pedido_entrada` | um pedido do fundador (site, Codex ou Telegram) | `request_id` (único), `fundador_uid`, `estado` (RECEBIDO, PLANO_CONFIRMADO, CARD_CRIADO), `atualizado_em` | `_receber_pedido_explicit_uid`, `confirmar_plano_pedido`, `consumir_plano_pedido` | `ler/listar_pedido(s)_entrada` |
| `pedido_entrada_evento` | cada mensagem do pedido, imutável (continuações usam o mesmo `request_id`) | `pedido_id`, `origem` (SITE, CODEX, TELEGRAM), `evento_id` (único com fundador e origem), `texto` (até 10.000) | `_receber_pedido_explicit_uid` | `ler_pedido_entrada` |
| `pedido_entrada_plano` | a fotografia do plano confirmado, imutável salvo o preenchimento do card | `pedido_id` (PK), `empresa_id`, `titulo`, `prazo`, `plano`, `config_revision_id`, `eventos`, `dados_reais`, `payload_hash`, `card_id`, `roteiro_hash`, `consumido_em` | `confirmar_plano_pedido`; `consumir_plano_pedido` | `ler_plano_pedido` (motor) |
| `pedido_entrada_reserva` | reserva (lease) do motor para interpretar um pedido; uma por pedido | `lease_token`, `config_revision_id`, hashes (config, eventos, contexto), `expira_em` | `reservar_proposta_pedido`; apagada por `registrar_proposta_pedido` | nenhuma |
| `pedido_entrada_resposta_bruta` | resposta crua do modelo, imutável | `lease_token` (único), hashes, `resposta` | `registrar_resposta_bruta_pedido` | devolvida em `reservar_proposta_pedido` |
| `pedido_entrada_proposta` | interpretação da Helena: `PERGUNTAR` (perguntas) ou `PROPOR` (empresa, título, prazo, plano), imutável | `tipo`, `perguntas`, `resumo`, `empresa_id`, `titulo`, `prazo`, `plano`, `validacao_metadados` (campo `bloqueio` impede confirmar), `resultado_hash`, hashes (único por pedido+config+eventos+contexto) | `registrar_proposta_pedido` | `ler_proposta_pedido` (fundador) |

### 4.7 Telegram (0022, 0025)

| Tabela | Para que serve | Colunas-chave | Escreve | Lê |
|---|---|---|---|---|
| `telegram_pareamento_codigo` | código de pareamento: só o SHA-256 fica; vale 10 minutos; um por fundador | `fundador_uid` (PK), `codigo_hash`, `expira_em` | `gerar_pareamento_telegram`; apagado por `vincular_telegram` e `revogar_pareamento_telegram` | nenhuma |
| `telegram_vinculo` | chat privado vinculado a um fundador; revogar preenche `revogado_em` | `fundador_uid`, `chat_id`, `usuario_id` (iguais), `revogado_em`; índices únicos parciais: um vínculo ativo por fundador, por chat e por usuário | `vincular_telegram`, `revogar_pareamento_telegram` | `consultar_pareamento_telegram` |
| `telegram_update_recebido` | deduplica `update_id` de pedidos e guarda o `request_id` gerado | `update_id` (PK), `mensagem_id`, `texto`, `request_id` | `receber_pedido_telegram` | nenhuma |
| `telegram_inbox` | todo Update recebido, bruto (com o código `/vincular` redigido) e classificado | `update_id` (PK), `bruto`, `bruto_hash`, `tipo` (IGNORADO, VINCULAR, PEDIDO, CONVERSA, MIDIA, CALLBACK), `chat_id`, `fundador_uid`, `vinculo_id`, `request_id` | `registrar_update_telegram` | nenhuma |
| `telegram_trabalho` | fila de trabalho para o adapter do Hermes, com lease de 2 minutos | `update_id`, `estado` (PENDENTE, EM_CURSO, CONCLUIDO), `tentativas`, `lease_token`, `lease_ate`, `proposta` | `registrar_update_telegram`, `reivindicar/renovar/concluir_trabalho_telegram` | nenhuma |
| `telegram_saida` | caixa de saída durável (recibos, respostas, avisos) | `update_id`, `tipo` (RECIBO, RESPOSTA, AVISO), `chave_evento`, `texto` (≤ 4096), `estado` (PENDENTE, EM_CURSO, ENTREGUE), `lease_*`, `telegram_message_id`; únicos: `(update_id, tipo, chave_evento)` e, para `AVISO`, `chave_evento` sozinha (0026) | `registrar_update_telegram`, `concluir_trabalho_telegram`, `_telegram_avisar_pedido`, `reivindicar/concluir/reagendar_saida_telegram` | nenhuma |

---

## 5. Catálogo de funções (RPC e internas)

**Quem chama:**
- **FUNDADOR** = `authenticated` com `sou_fundador()` (JWT do usuário do site);
- **MOTOR** = `service_role` (o motor Python após `SET ROLE service_role`);
- **EDGE** = `service_role` usado pela Edge `helena-v2-telegram` (mesma permissão, mensagem `SOMENTE_SERVICO`);
- **INTERNA** = nenhum papel da API; só outras funções ou gatilhos (EXECUTE revogado).

Todas as de negócio abaixo são `SECURITY DEFINER`. "Redefinida" mostra a **última** migration que reescreveu o corpo (o que vale é a mais recente; as anteriores só explicam a história). Linhas "—" nunca foram reescritas.

### 5.1 Máquina do card (0003, 0004, 0012, 0016, 0020)

| Função e assinatura | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `aplicar_evento(p_maquina text, p_alvo uuid, p_papel text, p_evento text, p_parametros jsonb='{}', p_ator text=null, p_chave bigint=null, p_versao_vista integer=null, p_conteudo jsonb=null, p_toque text=null, p_automaticos boolean=true, p_nao_disparar text[]='{}', p_prazo_espera timestamptz=null) → jsonb` | FUNDADOR (papel `FUNDADOR`) e MOTOR (papéis MOTOR, HELENA, AUTOR, REVISOR, RELOGIO, VIGIA) | **A porta única.** Confere a conta, trava o card (`FOR UPDATE`), acha a linha da tabela de passagens, aplica efeitos, grava histórico, dispara sinais e automáticos na mesma transação. Devolve `{resultado, historico_id, linha, estado, motivo, convertido_em}`. `resultado` pode ser `APLICADO`, `CONVERTIDO`, `REACAO`, `COMENTARIO_NO_CARD`, `CARD_NOVO_LIGADO`, `RESPOSTA_GUARDADA`, `RECUSADO` ou `REPETIDO` (mesmo `p_toque`) | 0003 | **0012** (toque do fundador `APROVAR`/`PEDIR_AJUSTE`/`RESPONDER` com versão velha ou parâmetro fora do domínio vira `COMENTARIO_NO_CARD` antes de qualquer reação). Atenção: o corpo da 0012 repete `_conferir_conta`/`_prazo_valido`; se você mexer na porta, parta da 0012, não da 0003 |
| `disparar_automaticos(p_card uuid, p_nao_disparar text[]='{}') → void` | MOTOR (papel MOTOR) | roda só os eventos automáticos do card | 0003 | privilégios 0016 |
| `abrir_chamada_helena(p_maquina text, p_alvo uuid) → bigint` | MOTOR (papel HELENA ou MOTOR) | abre uma chamada da Helena (card ou etapa), mata a anterior (`SUBSTITUIDA`) e devolve a chave | 0003 | privilégios 0016 |
| `criar_card(p_canal text, p_numero text, p_conteudo text, p_titulo text, p_prazo timestamptz, p_roteiro jsonb, p_empresa text=null, p_ordem_de_servico jsonb='{}', p_prioridade integer=0, p_pedido_grande boolean=true) → jsonb` | **INTERNA** desde a 0007 (só `consumir_solicitacao_card_real` e `consumir_plano_pedido` a chamam) | grava a mensagem uma vez, cria o card em `RASCUNHO` e as etapas do roteiro (calcula revisores válidos pela regra 4). Mesma mensagem outra vez devolve o card existente (`novo=false`) | 0003 | — (0007 revogou de todos) |
| `tabela_confere() → boolean`, `calcular_hash_das_linhas() → text` | MOTOR | selo da tabela de regras (seção 4.2) | 0003 | privilégios 0016 |
| `vigia() → table(regra text, card_id uuid, mensagem text)` | MOTOR | lista inconsistências (tabela não selada, regras quebradas, divergência com o histórico). Vazio = certo. Só lê | 0003 | privilégios 0016 |
| `conferir_historico(p_card uuid) → table(alvo, campo, na_tabela, no_historico)` | MOTOR | compara estado e contadores com a última linha de histórico (regra 13) | 0003 | privilégios 0016 |
| `conferir_card(p_card uuid) → void` | MOTOR | confere plano (sem ciclo), regras 2, 6 e 9 olhando o card inteiro; levanta `REGRA n: ...` | 0004 | privilégios 0016 |
| `situacao_efetiva(e helena_v2.etapa) → text` | MOTOR | como o card enxerga a etapa (`PULADA` se falhou e o fundador mandou seguir) | 0003 | privilégios 0016 |
| `situacao_da_etapa(p_estado text, v jsonb) → text`, `guarda(p_id text, v jsonb, q jsonb) → boolean` | `situacao_da_etapa`: authenticated e service_role (pura, imutável); `guarda`: INTERNA | **geradas** no 0002 a partir do YAML | 0002 | regeneradas a cada geração do 0002 |
| `selar_tabela() → void` | INTERNA (exige `helena_v2.migrando='sim'`) | grava `meta_tabela.hash_das_linhas` | 0003 | — |
| Internas da máquina: `_entrar`, `_sair`, `_conta`, `_prazo_valido`, `_conteudo_fundador_valido`, `_conferir_conta`, `_lista_predicado`, `_predicados_card`, `_anteriores_satisfeitas`, `_montar_q`, `_compartilhadas`, `_carregar`, `_achar_linha`, `_efeitos`, `_dono`, `_prazo_ate`, `_estado_inicial`, `_gravar`, `_so_variaveis`, `_alvos_do_sinal`, `_criar_card_ligado`, `_mudar_campo_do_fundador`, `_acao_no_card`, `_aplicar`, `_automaticos`, `_conferir_plano` | INTERNA | a mecânica (grava a linha inteira, calcula dono e prazo, resolve alvos dos sinais, cria cards ligados e ações externas) | 0003 / 0004 | — |
| `_cabe(p_maquina text, p_alvo uuid, p_papel text, p_evento text) → boolean` | INTERNA | "este automático cabe agora?". **Retorna `false` sempre que for `card`/`MOTOR`/`PLANO_VALIDO`** | 0003 | **0020** |

### 5.2 Publicação e resposta durável (0005, 0018)

| Função | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `sou_fundador() → boolean` | FUNDADOR (também usada por RLS) | `_conta()='authenticated'` e `auth.uid()` ativo como `founder` em `public.app_access` | 0005 | — |
| `situacao_publicacao() → jsonb` | FUNDADOR | pedido de **hoje** (dia de Brasília) com estado verdadeiro; para não fundador devolve `fundador=false` sem levantar erro | 0005 | **0018** |
| `pedir_publicacao() → jsonb` | FUNDADOR | grava no máximo um pedido por dia (`ja_usado_hoje`); **não publica** | 0005 | — |
| `reivindicar_publicacao() → jsonb` | MOTOR | pega o `PEDIDA` mais antigo (`FOR UPDATE SKIP LOCKED`) e marca `EM_EXECUCAO` | 0018 | — |
| `concluir_publicacao(p_id bigint, p_destino text, p_versao text) → jsonb` | MOTOR | `EM_EXECUCAO` → `PUBLICADA` | 0018 | — |
| `falhar_publicacao(p_id bigint, p_erro text) → jsonb` | MOTOR | `EM_EXECUCAO` → `FALHOU`; remove do texto o que parece segredo e corta em 300 caracteres | 0018 | — |
| `reverter_publicacao(p_id bigint) → jsonb` | MOTOR | `PUBLICADA` → `REVERTIDA` (só registra no banco) | 0018 | — |
| `registrar_resposta_execucao(p_numero bigint, p_resposta jsonb) → jsonb` | MOTOR | grava a resposta do agente antes do portão 1; só se a execução é a `VIVA` atual da etapa; idêntica repetida devolve a mesma, diferente falha (`RESPOSTA_JA_REGISTRADA`) | 0005 | — |
| `ler_resposta_execucao(p_numero bigint) → jsonb` | MOTOR | relê a resposta gravada | 0005 | — |
| `_publicacao_json(helena_v2.publicacoes)`, `trg_publicacao_transicao()` | INTERNA | retrato do pedido; gatilho de transição | 0018 | — |

### 5.3 Configuração versionada (0006, 0019)

`configuracao_ativa()` **devolve `jsonb`** (um objeto com `id`, `nome`, `versao`, `estado`, `tecnica`, `hash_sha256`, `impressao_maquina`, `ativa`, `conteudo`...), **não uma linha nem um uuid**; devolve `NULL` se não há revisão ativa. O motor confere `isinstance(ativa, dict)` e `estado = 'VALIDADA'`.

| Função | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `listar_configuracoes() → jsonb` | FUNDADOR | lista revisões (sem o conteúdo) | 0006 | — |
| `ler_configuracao(p_id uuid) → jsonb` | FUNDADOR e MOTOR | uma revisão com o conteúdo | 0006 | — |
| `configuracao_ativa() → jsonb` | MOTOR | a revisão ativa (ver acima) | 0006 | — |
| `salvar_rascunho(p_nome text, p_conteudo jsonb, p_id uuid=null, p_versao_esperada integer=null, p_base_id uuid=null) → jsonb` | FUNDADOR | cria rascunho (ou clona de `p_base_id`) ou edita com versão otimista (`CONFIG_VERSAO_DESATUALIZADA`); só aceita caminhos permitidos no bundle (`_config_bundle_valido`); cancela validação pendente | 0006 | — |
| `solicitar_validacao_config(p_id uuid, p_versao integer) → jsonb` | FUNDADOR | abre pedido de validação | 0006 | — |
| `listar_validacoes_pendentes() → jsonb` | MOTOR | fila do worker técnico | 0006 | — |
| `registrar_resultado_validacao(p_id uuid, p_versao integer, p_hash_sha256 text, p_resultado jsonb) → jsonb` | MOTOR | só resultado **negativo** (`ok=false`) | 0006 | — |
| `registrar_validacao_config(p_id uuid, p_versao integer, p_hash_sha256 text, p_impressao_maquina text) → jsonb` | MOTOR | marca `VALIDADA` se a máquina do bundle é idêntica à técnica e `tabela_confere()` | 0006 | — |
| `registrar_configuracao_tecnica(p_nome text, p_conteudo jsonb, p_impressao_maquina text) → jsonb` | MOTOR | registra a base técnica uma única vez (idempotente se igual); confere os 3 documentos da máquina por hash fixo em `_config_maquina_instalada` | 0006 | — |
| `ativar_configuracao(p_id uuid, p_ativa_esperada uuid=null) → jsonb` | FUNDADOR | troca o ponteiro da revisão ativa por comparação atômica (`CONFIG_ATIVA_DESATUALIZADA`); grava a auditoria | 0006 | **0019** |
| `aposentar_configuracao(p_id uuid) → jsonb` | FUNDADOR | `APOSENTADA` (não pode ser a técnica nem a ativa) | 0006 | — |
| `listar_ativacoes(p_limite integer=20) → jsonb` | FUNDADOR | auditoria (1 a 200) | 0019 | — |
| `reverter_configuracao(p_ativa_esperada uuid) → jsonb` | FUNDADOR | volta à revisão anterior (precisa continuar `VALIDADA`) | 0019 | — |
| Internas: `_config_hash`, `_config_maquina`, `_config_bundle_valido`, `_config_maquina_completa`, `_config_maquina_instalada`, `_config_json`, `_config_proteger_revisao`, `_config_nunca_truncar`, `_config_ativacao_so_acrescenta`, `_config_vincular_card`, `_config_preservar_card` | INTERNA | hash, filtros do bundle e gatilhos | 0006 / 0019 | — |

### 5.4 Pedido real a partir de tarefa e coordenação (0007–0010, 0015)

| Função | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `solicitar_card_real(p_tarefa_id text, p_prazo timestamptz, p_plano jsonb, p_dados_reais jsonb, p_config_revision_id uuid, p_chave_idempotencia text) → jsonb` | FUNDADOR | grava a solicitação depois de conferir a captura contra `public.*` e a confirmação (prazo, critérios, restrições, URLs) | 0007 | **0009** |
| `ler_solicitacao_card_real(p_id uuid) → jsonb` | MOTOR | lê a solicitação | 0007 | — |
| `consumir_solicitacao_card_real(p_id uuid, p_roteiro jsonb) → jsonb` | MOTOR | confere roteiro e fontes de novo e chama `criar_card` (idempotente: repetir com o mesmo roteiro devolve o card) | 0007 | **0009** |
| `conferir_fontes_card_real(p_card_id uuid) → boolean` | MOTOR | porta pública da conferência de fontes antes de aplicar (o gatilho usa a privada) | 0007 | — |
| `obter_chamada_coordenacao(p_card_id uuid) → bigint` | MOTOR | trava o card em `RASCUNHO` e devolve a chave viva da Helena (ou abre uma) | 0008 | — |
| `registrar_resposta_coordenacao(p_numero bigint, p_resposta jsonb) → jsonb` | MOTOR | grava a resposta (`texto`, `evidencias`, `config_revision_id`, `card_id`), imutável | 0008 | — |
| `ler_resposta_coordenacao(p_numero bigint) → jsonb` | MOTOR | relê | 0008 | — |
| `aplicar_resposta_coordenacao(p_numero bigint) → jsonb` | MOTOR | chama `aplicar_evento('card', ..., 'HELENA', 'LER_DE_VOLTA', ..., p_nao_disparar => '{PLANO_VALIDO}')` e grava `resultado_coordenacao`; repetição após queda devolve o resultado provado pelo histórico | 0008 | — |
| `listar_acoes_card(p_card_id uuid) → jsonb` | FUNDADOR | projeção mínima das ações externas | 0011 | — |
| `consultar_toque_fundador(p_card_id uuid, p_toque text) → jsonb` | FUNDADOR | reconcilia um toque do próprio fundador (resultado no histórico) | 0013 | — |
| `ler_pergunta_etapa_fundador(p_etapa_id uuid) → jsonb` | FUNDADOR | a pergunta corrente de uma etapa em `ESPERANDO_FUNDADOR/PERGUNTA`, validada contra a resposta gravada (2 ou 3 opções) | 0013 | — |
| `ler_leitura_card_fundador(p_card_id uuid) → jsonb` | FUNDADOR | a "leitura de volta" aplicada (linha C01) para confirmação | 0014 | — |
| `eventos_devidos(p_agora timestamptz=clock_timestamp()) → table(maquina, alvo_id, card_id, evento, vencimento)` | MOTOR | **só leitura**: prazos vencidos (tempo da ficha, escada do prazo do card, lembretes 24h/48h). Quem aplica é `motor/orquestrador/orquestrador/relogio.py`, um por um, com papel `RELOGIO` | 0017 | — |
| `_real_conferir_captura(p_tarefa_id text, p_plano jsonb, p_dados jsonb) → jsonb` | INTERNA | confere checkpoint ativo único, tarefa, empresa, marca, decisões, fontes contra `public.*` com `FOR SHARE` | 0007 | **0009** |
| `_real_confirmacao_valida(p_dados jsonb, p_prazo timestamptz) → boolean` | INTERNA | valida prazo (fuso explícito), 1 a 5 critérios, restrições, até 20 URLs `https` | 0009 | — |
| `_real_conferir_card_vinculado(p_card_id uuid) → boolean` | INTERNA | **roteador** desde a 0023: `origem = 'pedido_entrada'` → `_pedido_conferir_card_vinculado`; senão → `_real_conferir_card_v1` | 0007 | 0009, 0015, **0023** (ver armadilha 10.7) |
| `_real_conferir_card_v1(p_card_id uuid) → boolean` | INTERNA | o corpo da 0015 (renomeado pela 0023): cadeia de cards ligados até a solicitação raiz, máximo 16 saltos, recusa ciclo | 0015 (nome atual desde 0023) | — |
| Gatilhos: `_real_proteger_solicitacao`, `_real_proteger_promocao`, `_real_proteger_aprovacao_fundador`, `_coordenacao_proteger_leitura_real`, `_vincular_toque_fundador`, `_coordenacao_imutavel` e auxiliares `_real_json_solicitacao`, `_coordenacao_card_real` | INTERNA | ver seção 7.2 | 0007–0013 | — |

### 5.5 Pedido de entrada, plano e proposta (0021–0024)

| Função | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `receber_pedido_entrada(p_request_id uuid, p_origem text, p_evento_id text, p_texto text) → jsonb` | FUNDADOR | registra pedido ou continuação, idempotente por `(fundador, origem, evento_id)`; divergência de texto/`request_id` = `ENTRADA_EVENTO_DIVERGENTE` | 0021 | **0022** (agora só valida o fundador e delega a `_receber_pedido_explicit_uid`) |
| `ler_pedido_entrada(p_request_id uuid) → jsonb`, `listar_pedidos_entrada(p_limite integer=50) → jsonb` | FUNDADOR | só os pedidos do próprio fundador (limite 1 a 100) | 0021 | — |
| `confirmar_plano_pedido(p_request_id uuid, p_empresa text, p_titulo text, p_prazo timestamptz, p_plano jsonb, p_config_revision_id uuid) → jsonb` | FUNDADOR (concedida direto, além de ser chamada por `confirmar_proposta_pedido`) | fixa o plano: exige revisão ativa `VALIDADA`, pacote da empresa `CONFIRMADO`, serviços em `ESTAGIO`/`ATIVO` da empresa; recusa `SRV-PARECER` (sem `FON-LEIS`); monta `dados_reais` canônicos; pedido vira `PLANO_CONFIRMADO` | 0023 | — |
| `confirmar_proposta_pedido(p_request_id uuid, p_proposta_id uuid) → jsonb` | FUNDADOR | confirma uma proposta `PROPOR` sem bloqueio e **atual** (hashes batem com config, eventos e contexto de agora) | 0024 | — |
| `ler_proposta_pedido(p_request_id uuid) → jsonb` | FUNDADOR | resumo do pedido + proposta mais recente, com `atual` calculado | 0024 | — |
| `ler_plano_pedido(p_pedido_id uuid) → jsonb` | MOTOR | plano confirmado | 0023 | — |
| `consumir_plano_pedido(p_pedido_id uuid, p_roteiro jsonb) → jsonb` | MOTOR | confere roteiro igual ao plano e fontes; chama `criar_card('pedido_entrada', ...)`; pedido vira `CARD_CRIADO`. **`pedido_grande = false`** a partir da 0024: o card vai direto de `RASCUNHO` por C02 para `VALIDANDO_PLANO`, sem segunda confirmação | 0023 | **0024** |
| `listar_planos_pedido_pendentes(p_limite integer=50) → jsonb` | MOTOR | planos confirmados ainda sem card | 0024 | — |
| `listar_trabalho_proposta_pedido(p_limite integer=50) → jsonb` | MOTOR | pedidos `RECEBIDO` sem proposta atual e sem reserva viva | 0024 | — |
| `reservar_proposta_pedido(p_request_id uuid, p_lease_s integer=120) → jsonb` | MOTOR | abre a reserva (30 a 900 s) e entrega eventos, contexto, conteúdo da revisão ativa e a resposta bruta já gravada, se houver | 0024 | — |
| `registrar_resposta_bruta_pedido(p_request_id uuid, p_lease_token uuid, p_resposta jsonb) → jsonb` | MOTOR | guarda a resposta crua antes de interpretar (replay seguro) | 0024 | — |
| `registrar_proposta_pedido(p_request_id uuid, p_lease_token uuid, p_resultado jsonb) → jsonb` | MOTOR | grava `PERGUNTAR` ou `PROPOR` (validação estrita do formato), apaga a reserva | 0024 | — |
| Internas: `_resumo_pedido_entrada` (0021→**0023**), `_receber_pedido_explicit_uid`, `_pedido_plano_imutavel`, `_pedido_evento_imutavel`, `_pedido_dados_canonicos`, `_pedido_ordem`, `_pedido_conferir_fontes`, `_pedido_conferir_card_vinculado`, `_pedido_proposta_imutavel`, `_pedido_proposta_eventos`, `_pedido_proposta_contexto`, `_pedido_proposta_atual`, `_pedido_reserva_valida` | INTERNA | resumo, fotografia canônica, conferências e gatilhos | 0021–0024 | — |

### 5.6 Telegram (0022, 0025, 0026)

| Função | Quem chama | O que faz | Nasceu | Redefinida |
|---|---|---|---|---|
| `gerar_pareamento_telegram() → jsonb` | FUNDADOR | gera código aleatório (24 bytes em hex = 48 caracteres), guarda só o SHA-256, vale 10 minutos; devolve o código **uma vez** | 0022 | — |
| `consultar_pareamento_telegram() → jsonb`, `revogar_pareamento_telegram() → jsonb` | FUNDADOR | estado do vínculo; revoga vínculo e código | 0022 | — |
| `vincular_telegram(p_codigo text, p_chat_id bigint, p_usuario_id bigint) → jsonb` | EDGE | consome o código e cria o vínculo (chat privado: `chat_id = usuario_id`); erro genérico `PAREAMENTO_NAO_VALIDO` | 0022 | — |
| `receber_pedido_telegram(p_chat_id bigint, p_usuario_id bigint, p_update_id bigint, p_mensagem_id bigint, p_texto text, p_request_id uuid=null) → jsonb` | EDGE | transforma `/pedido` de um chat vinculado em pedido de entrada (origem `TELEGRAM`, `evento_id = 'telegram:update:<id>'`) | 0022 | — |
| `registrar_update_telegram(p_update jsonb) → jsonb` | EDGE | **única entrada do webhook**: grava o Update bruto (redigindo `/vincular <48 hex>` em qualquer profundidade), deduplica por `update_id` (conteúdo diferente = `TELEGRAM_UPDATE_DIVERGENTE`), classifica e, na mesma transação, vincula, cria pedido/recibo ou enfileira trabalho. Só chat privado com humano; mídia e callback são só registrados | 0025 | — |
| `reivindicar_trabalho_telegram() → jsonb`, `renovar_trabalho_telegram(p_update_id bigint, p_lease_token uuid) → jsonb`, `concluir_trabalho_telegram(p_update_id bigint, p_lease_token uuid, p_resposta text, p_proposta jsonb=null) → jsonb` | EDGE (rotas do worker) | fila de trabalho do adapter do Hermes (lease de 2 minutos); só entrega item cujo vínculo continua ativo | 0025 | — |
| `reivindicar_saida_telegram() → jsonb`, `concluir_saida_telegram(p_id uuid, p_lease_token uuid, p_message_id bigint=null) → jsonb`, `reagendar_saida_telegram(p_id uuid, p_lease_token uuid) → jsonb` | EDGE | caixa de saída em ordem por Update, com lease; falha reagenda com recuo exponencial (2^tentativas segundos, teto de 1024 s, cerca de 17 minutos) | 0025 | — |
| Internas: `_estado_pareamento_telegram`, `_redigir_codigo_telegram`, `_telegram_avisar_pedido`, `_telegram_avisar_proposta`, `_telegram_avisar_card_criado`, `_telegram_avisar_estado_card` | INTERNA | avisos (seção 7.2); os textos trazem a URL do site fixa no SQL | 0022 / 0025 / 0026 | — |

### 5.7 Funções que existem mas nenhum papel pode chamar

`criar_card` (0007), todas as `_*` e `trg_*`. Só são alcançadas por `SECURITY DEFINER` ou por gatilho. Em migration nova, **toda função começa com EXECUTE para `PUBLIC`** (padrão do PostgreSQL): sem `REVOKE` explícito ela fica aberta.

---

## 6. Máquinas de estado

A fonte é a tabela `helena_v2.passagem` (linhas `C**` para card, `E**` para etapa, `X**` para ação externa), gerada do YAML. Para a lista completa e atual: `select linha_id, de, evento, papel, guarda, para from helena_v2.passagem where maquina = '...' order by ordem`. Abaixo, o resumo lido do 0002 (selo `4d307f25747d5381`). Quem faz cada passo: **F** = fundador, **M** = motor (`MOTOR`), **R** = relógio, **A** = autor, **Rv** = revisor, **H** = Helena, **V** = vigia.

Linhas `C22`, `C23`–`C26` valem em todos os estados abertos do card: `CANCELAR` (F) → `CANCELADO`; `PRAZO_80`, `PRAZO_VENCIDO`, `PRAZO_MAIS_1H` (R, escada de 3 níveis, cada um dispara uma vez); `MUDAR_PRAZO` (F, até 3 vezes; na 4ª o campo muda por reação sem rearmar avisos).

### 6.1 Card (`card.estado`; CHECK `ck_card_estado`; final: `PRONTO`, `CANCELADO`, `ENCERRADO_COM_FALHA`)

| De | Evento (quem) | Para | Linha e condição |
|---|---|---|---|
| `RASCUNHO` | `LER_DE_VOLTA` (H) | `ESPERANDO_CONFIRMACAO` | C01: pedido grande (versão +1) |
| `RASCUNHO` | `LER_DE_VOLTA` (H) | `VALIDANDO_PLANO` | C02: pedido pequeno (**é o caminho dos pedidos da 0024 em diante**) |
| `RASCUNHO` | `FALHA` (M) | `RASCUNHO` / `ESPERANDO_CONFIRMACAO` | C03 (1ª falha da Helena) / C04 (2ª falha: motivo `HELENA_FALHOU`) |
| `RASCUNHO` | `TEMPO_ESGOTADO` (R, 15 min) | `ESPERANDO_CONFIRMACAO` | C05 |
| `ESPERANDO_CONFIRMACAO` | `RESPONDER` `CONFIRMO` (F) | `VALIDANDO_PLANO` | C06 (motivo NENHUM ou HELENA_FALHOU); C32 (motivo `VALIDADOR_FALHOU`, ordens < 3, gasta 1 ordem) |
| `ESPERANDO_CONFIRMACAO` | `RESPONDER` `CONFIRMO` (F) | `CANCELADO` | C33 (VALIDADOR_FALHOU e ordens ≥ 3; abre card ligado) |
| `ESPERANDO_CONFIRMACAO`, `ESPERANDO_FUNDADOR` | `LEMBRETE_24H`/`48H` (R); `PRAZO_ESPERA_VENCIDO` (R) | mesmo / `CANCELADO` | C07, C08; C09 (após 2 lembretes) |
| `VALIDANDO_PLANO` | `PLANO_VALIDO` (M) | `EM_ANDAMENTO` | C10. **Só por chamada explícita do motor** (0020) |
| `VALIDANDO_PLANO` | `PLANO_INVALIDO` (M) | `ESPERANDO_CONFIRMACAO` | C11 (motivo `PLANO_INVALIDO`, versão +1) |
| `VALIDANDO_PLANO` | `TEMPO_ESGOTADO` (R, 60 s) | `VALIDANDO_PLANO` / `ESPERANDO_CONFIRMACAO` | C30 (1ª vez) / C31 (2ª: motivo `VALIDADOR_FALHOU`) |
| `EM_ANDAMENTO` | `TODAS_PRONTAS` (M) | `PRONTO` | C12: todas as etapas atuais `APROVADA` ou `PULADA`; sinal `CARD_PRONTO` leva as etapas a `PRONTA` |
| `EM_ANDAMENTO` | `PERGUNTAR_AO_FUNDADOR` (M) | `ESPERANDO_FUNDADOR` | C13 (motivo `DEPENDENCIA`: etapa final com falha); C14 (motivo `NAO_PODE`) |
| `ESPERANDO_FUNDADOR` | `MOTIVO_RESOLVIDO` (M) | `EM_ANDAMENTO` | C27: a pergunta perdeu o objeto |
| `ESPERANDO_FUNDADOR` | `RESPONDER` (F) | `EM_ANDAMENTO` | C18 `PULAR` (falhas puláveis); C19 `REFAZER` (dependência, ordens < 3); C20 `REFAZER` (não pode, ordens < 3) |
| `ESPERANDO_FUNDADOR` | `RESPONDER` (F) | `CANCELADO` / `ENCERRADO_COM_FALHA` | C29 (REFAZER com ordens ≥ 3, abre card ligado) / C21 (`ENCERRAR`) |
| `EM_ANDAMENTO`, `ESPERANDO_FUNDADOR` | `ENCERRAR_CARD` (M, só por sinal) | `ENCERRADO_COM_FALHA` | C15 |
| `EM_ANDAMENTO`, `ESPERANDO_FUNDADOR` | `SUBSTITUIR_CARD` (M, só por sinal) | `CANCELADO` | C28 (abre card ligado) |
| `EM_ANDAMENTO`, `ESPERANDO_FUNDADOR` | `PEDIR_AJUSTE` (F) | mesmo estado | C34: emite `DECISAO_MUDOU` para as etapas |
| `EM_ANDAMENTO`, `ESPERANDO_FUNDADOR` | `DECISAO_MUDOU` (M, só por sinal) | mesmo / `CANCELADO` | C16 (ordens < 3) / C17 (ordens ≥ 3, abre card ligado) |

Estados finais não andam (gatilho `b_final_nao_anda`, regra 2). Toque do fundador em card final (regra 11, `regra_geral.recusa_do_fundador` e tabela `reacao`): `PEDIR_AJUSTE` em `PRONTO`/`CANCELADO`/`ENCERRADO_COM_FALHA` é uma **reação** (`REACAO`) que abre card novo ligado; `RESPONDER` vira `CARD_NOVO_LIGADO`; `APROVAR` em `PRONTO` é reação (registra a aprovação e relê as fontes); os demais botões viram `COMENTARIO_NO_CARD`.

Automáticos do card (tabela `automatico`, ordem de teste): `PLANO_VALIDO` (bloqueado por `_cabe` desde a 0020), `TODAS_PRONTAS`, `PERGUNTAR_AO_FUNDADOR`, `MOTIVO_RESOLVIDO`. `p_nao_disparar` deixa o motor decidir um automático sozinho.

### 6.2 Etapa (`etapa.estado`; CHECK `ck_etapa_estado`; final: `PRONTA`, `CANCELADA`, `ENCERRADA_COM_FALHA`)

Só anda com o card em `EM_ANDAMENTO` ou `ESPERANDO_FUNDADOR` (regra 6), exceto `CANCELADO_PAI` e `CARD_PRONTO`. O resumo por estado de origem (a coluna "Linhas" são os `linha_id` da tabela; a condição completa está em `guarda`):

| De | Evento (quem) → Para | Linhas |
|---|---|---|
| `AGUARDANDO_ANTERIORES` | `DEPENDENCIAS_PRONTAS` (M) → `NA_FILA` (anteriores aprovadas ou puladas); `CANCELADO_PAI` → `CANCELADA` | E01, E04 (E02, E03: `DEPENDENCIA_MUDOU`/`DECISAO_MUDOU` sem mudar estado) |
| `NA_FILA` | `INICIAR_EXECUCAO` (M) → `EXECUTANDO` (motivo NORMAL, execuções < 6); `TETO_EXECUCOES` (M) → `EM_RESOLUCAO`; `SEM_CAPACIDADE` (M) → `NA_FILA` / `ESPERANDO_FUNDADOR` (infra ≥ 2); `AVISO_1H`/`ESPERA_6H` (R) → `NA_FILA` / `ESPERANDO_FUNDADOR`; `DEPENDENCIA_MUDOU` → `AGUARDANDO_ANTERIORES`; `CANCELADO_PAI` → `CANCELADA` | E10, E11, E12, E13, E14, E15, E16, E17, E18, E19 |
| `EXECUTANDO` | `ENTREGAR` (A) → `VALIDACAO` (parecer OK, ou etapa julgadora); `PERGUNTAR` (A) → `ESPERANDO_FUNDADOR` (sem internet na execução, até 2 perguntas por card); `DEVOLVER_A_QUEM_PEDIU` e `REGISTRAR_FALHA` (A) → `EM_RESOLUCAO`; `FALHA` (M) → `NA_FILA` (formato e chamadas: 1 nova tentativa) ou `EM_RESOLUCAO`; `TEMPO_ESGOTADO` (R) → `NA_FILA` (1×) ou `EM_RESOLUCAO`; `FALHA_INFRA` e `SEM_EXECUCAO_VIVA` (M, V) → `NA_FILA`, e `ESPERANDO_FUNDADOR` na 3ª; `DEPENDENCIA_MUDOU`/`DECISAO_MUDOU`/`CANCELADO_PAI` | E20–E39, E120, E121 |
| `VALIDACAO` | `PORTAO1_OK` (M) → `REVISAO` (revisor válido, não fundador) ou `ESPERANDO_FUNDADOR` (revisor = fundador); `PORTAO1_RECUSOU` (M) → `NA_FILA`; `FALHA_INFRA`/`TEMPO_ESGOTADO` → `VALIDACAO` ou `ESPERANDO_FUNDADOR`; mudanças de dependência/decisão/pai | E40–E49 |
| `REVISAO` | `INICIAR_REVISAO` (M, automático); `APROVAR` (Rv) → `APROVADA` (não julgadora) ou `ESPERANDO_FUNDADOR` (julgadora: o fundador é segundo revisor); `REPROVAR` (Rv) → `NA_FILA` (reprovações < 2) ou `EM_RESOLUCAO`; `NAO_CONSIGO_CONFERIR` (Rv) → `ESPERANDO_FUNDADOR`; falhas, tempo e infra como em EXECUTANDO | E50–E54, E57–E74 |
| `ESPERANDO_FUNDADOR` | `RESPONDER` (F): `RESPOSTA_A/B/C` → `NA_FILA` (pergunta); `REFAZER`/`ESPERAR`/`MODELO_MENOR` → `NA_FILA` ou `CANCELADA` (ordens ≥ 3); `SEGUIR_SEM` → `ENCERRADA_COM_FALHA` (etapa pulável); `ENCERRAR` → `ENCERRADA_COM_FALHA`. `APROVAR` (F, motivo REVISAO) → `APROVADA`, ou devolve à peça julgada (E82) ou `EM_RESOLUCAO` (E83, voltas ≥ 2). `PEDIR_AJUSTE` (F) → `NA_FILA` / `CANCELADA`. Relógio: lembretes 24h/48h, `PRAZO_ESPERA_VENCIDO` → `CANCELADA`. `CAPACIDADE_VOLTOU` → `NA_FILA` | E80–E99 |
| `EM_RESOLUCAO` | `RECOMENDAR` (H) → `ESPERANDO_FUNDADOR` (opções `REFAZER`, `SEGUIR_SEM`, `ENCERRAR`); `TEMPO_ESGOTADO` (R, 30 min) → `ESPERANDO_FUNDADOR` sem recomendação | E100–E104 |
| `APROVADA` | `CARD_PRONTO` (M) → `PRONTA` (E110, cria a ação externa se a entrega aprovada propõe uma); `PEDIR_AJUSTE` (F), `AJUSTE_DO_JULGADOR`, `REABRIR_POR_ORDEM`, `DECISAO_MUDOU` (M) → `NA_FILA` (reabre dependentes); `DEPENDENCIA_MUDOU` → `AGUARDANDO_ANTERIORES`; `CANCELADO_PAI` | E110–E117 |

Automáticos da etapa: `DEPENDENCIAS_PRONTAS`, `INICIAR_EXECUCAO`, `INICIAR_REVISAO`, `TETO_EXECUCOES`. Nenhuma etapa vira `APROVADA` por padrão ou automático: o gatilho `b_etapa_regras` exige papel `REVISOR` ou `FUNDADOR` (e só o fundador, se a etapa é julgadora). `PRONTA` só vem de `APROVADA` (CHECK `ck_etapa_regra09_aprovada_passou_portao`: aprovada exige `portao1_ok` e `entrega_fresca`).

### 6.3 Ação externa (`acao_externa.estado`; final: `EXECUTADA`, `FEITA_PELO_FUNDADOR`, `RECUSADA`, `EXPIRADA`, `FALHOU`, `NAO_CONFIRMADA`, `CANCELADA`)

| De | Evento (quem) → Para | Linhas |
|---|---|---|
| `PROPOSTA` | `APROVAR` (F, só se `tem_ferramenta`) → `AUTORIZADA` (grava `ok_registrado=1`); `RESPONDER FEITO_POR_MIM` (F) → `FEITA_PELO_FUNDADOR`; `CANCELAR` (F) → `RECUSADA`; `LEMBRETE_24H` (R); `PRAZO_ESPERA_VENCIDO` (R) → `EXPIRADA`; `CANCELADO_PAI` → `CANCELADA` | X01–X06 |
| `AUTORIZADA` | `EXECUTAR_ACAO` (M, automático; exige `ok_registrado=1` e tentativas < 1) → `EXECUTANDO_ACAO`; `CANCELAR` (F) → `RECUSADA`; `TEMPO_ESGOTADO` (R) → `EXPIRADA`; `CANCELADO_PAI` | X10–X13 |
| `EXECUTANDO_ACAO` | `ACAO_CONCLUIDA` (M) → `EXECUTADA`; `ACAO_FALHOU` (M) → `FALHOU`; `TEMPO_ESGOTADO` (R, 15 min) → `INCERTA` (nunca se repete); `CANCELADO_PAI` não muda estado | X20–X23 |
| `INCERTA` | `RESPONDER ACONTECEU` (F) → `EXECUTADA`; `NAO_ACONTECEU` (F) → `FALHOU`; lembretes 24h/48h; `PRAZO_ESPERA_VENCIDO` (R) → `NAO_CONFIRMADA` | X30–X35 |

Importante: **esta migration não executa efeito externo.** `EXECUTAR_ACAO` é o único evento do vocabulário com `efeito = 'externo'`; a trava `ck_historico_regra08_so_o_motor_executa` e o gatilho `b_acao_regras` garantem que só o papel `MOTOR` o emite e só depois do `ok` do fundador. O destino real da ação e da publicação continua **NÃO CONFIRMADO**.

### 6.4 Execução (`execucao.estado`)

`VIVA` → `RESPONDIDA` (autor, revisor ou Helena respondeu com a chave certa), `MORTA` (substituída/expirada), `SUBSTITUIDA` (nova chamada da Helena). O gatilho `b_execucao_so_encerra` só deixa mudar `estado` e `encerrada_em`, e só a partir de `VIVA`. O número da sequência só sobe (`b_execucao_so_sobe`). Uma execução viva por etapa (índice único `execucao_uma_viva_por_etapa`); resposta com chave antiga não grava (regra 3).

### 6.5 Pedido de entrada (`pedido_entrada.estado`)

```
RECEBIDO ──confirmar_plano_pedido / confirmar_proposta_pedido (F)──▶ PLANO_CONFIRMADO ──consumir_plano_pedido (M)──▶ CARD_CRIADO
```

- Constraint: `pedido_entrada_estado_check` (0023) aceita só esses três valores.
- **Não há gatilho de transição em `pedido_entrada`**: a ordem é garantida pela lógica das funções e pela ausência de privilégio de escrita. Se você criar uma função que escreve nesta tabela, ela precisa respeitar a ordem.
- `confirmar_plano_pedido` trava o pedido do próprio fundador (`FOR UPDATE`) e só grava plano se ainda não há plano (na prática, pedido `RECEBIDO`); repetição com o mesmo conteúdo devolve o mesmo resumo; conteúdo diferente = `PEDIDO_PLANO_DIVERGENTE`. `consumir_plano_pedido` só avança se o estado ainda é `PLANO_CONFIRMADO` (senão `PEDIDO_ESTADO_DIVERGENTE`).
- O plano confirmado é imutável (`pedido_plano_imutavel`): o único `UPDATE` permitido preenche `card_id`, `roteiro_hash` e `consumido_em` de uma vez.

### 6.6 Proposta da Helena (`pedido_entrada_proposta`)

Não tem coluna de estado; é um ciclo, e a "validade" é calculada:

```
RECEBIDO sem proposta atual ──reservar_proposta_pedido──▶ reserva (lease 30–900 s, padrão 120)
   ──registrar_resposta_bruta_pedido──▶ resposta bruta (imutável)
   ──registrar_proposta_pedido──▶ proposta PERGUNTAR | PROPOR (imutável) e a reserva é apagada
```

- `tipo = 'PERGUNTAR'`: tem perguntas e nenhum campo de plano. `tipo = 'PROPOR'`: sem perguntas e com empresa, título, prazo e plano (CHECK na tabela).
- Uma proposta é **atual** (`_pedido_proposta_atual`) quando a revisão ativa é a mesma e `VALIDADA`, e os hashes de config, de eventos e de contexto (checkpoint, decisões vigentes, portfólio) ainda batem. Pedido novo, decisão nova ou outra configuração ativa deixam a proposta velha: `confirmar_proposta_pedido` recusa (`PEDIDO_PROPOSTA_OBSOLETA`) enquanto o pedido está `RECEBIDO`. Só `PROPOR` sem `validacao_metadados.bloqueio` é confirmável.
- Contexto é limitado de propósito: mais de 30 decisões vigentes ou mais de 100 empresas = `PEDIDO_CONTEXTO_INCOMPLETO`, sem truncar em silêncio.

### 6.7 Publicação (`publicacoes.estado`)

```
PEDIDA ──reivindicar_publicacao──▶ EM_EXECUCAO ──concluir_publicacao──▶ PUBLICADA ──reverter_publicacao──▶ REVERTIDA
                                         └──falhar_publicacao──▶ FALHOU
```

Imposto por `trg_publicacao_transicao` (transições legais; nunca volta a `PEDIDA`; o que já foi registrado não é reescrito) e pelos `CHECK` `ck_publicacoes_estado` / `ck_publicacoes_campos_do_estado` (cada estado só carrega os campos que cabem nele; `FALHOU` nunca tem versão). `FALHOU` e `REVERTIDA` são finais. "No ar" só existe em `PUBLICADA`. Um pedido `EM_EXECUCAO` não é retentado sozinho (o efeito de fora pode já ter acontecido). Pedido aceito não prova publicação; o `destino` é só um nome informado pelo trabalhador, e o **destino real é NÃO CONFIRMADO**.

### 6.8 Configuração (`configuracao.estado`)

`RASCUNHO` → `VALIDADA` (por `registrar_validacao_config`, só o motor) → `APOSENTADA`; um rascunho também pode ser aposentado. A configuração técnica nasce `VALIDADA` (`tecnica = true`, `criada_por` nulo). `APOSENTADA` e `VALIDADA` são imutáveis (`config_revisao_imutavel`); `APOSENTADA` não volta. A **ativa** é só o ponteiro `configuracao_ponteiro.ativa_id` (revisão `VALIDADA` cuja máquina é idêntica à técnica). Cada card fixa sua revisão em `ordem_de_servico.config_revision_id` e não muda mais (`b_config_preservar_card`). Sem revisão ativa, card raiz novo é recusado (`CONFIG_SEM_ATIVACAO`), a menos que o motor use o ID técnico explicitamente; antes de existir qualquer configuração técnica, cards sem revisão ainda são aceitos (limite do legado, README).

### 6.9 Telegram (trabalho e saída)

`telegram_trabalho`: `PENDENTE` → `EM_CURSO` (lease de 2 min, `tentativas`+1) → `CONCLUIDO`; lease vencido volta a ser elegível. `telegram_saida`: `PENDENTE` → `EM_CURSO` → `ENTREGUE` (precisa de `telegram_message_id`); `reagendar_saida_telegram` volta a `PENDENTE` com atraso de 2^min(tentativas, 10) segundos (no máximo 1024 s). Saída só é entregue se o vínculo do Update original continua ativo e o fundador continua ativo. Uma saída por Update vai em ordem (`criado_em`, `id`).

---

## 7. As 13 regras de ferro, gatilhos e restrições

### 7.1 Onde cada regra é imposta (0004, com os CHECK gerados no 0002)

| Regra | Trava |
|---|---|
| R1 dono e prazo em todo estado aberto | `CHECK ck_*_regra01_dono_e_prazo` (0002) |
| R2 todo caminho termina; final não volta | só a metade "final não volta": gatilho `b_final_nao_anda`. O "termina" é prova mais relógio, não trava |
| R3 uma execução viva; só a chave atual grava | índices `execucao_uma_viva_por_etapa`, `execucao_uma_chamada_helena_viva`; `ck_etapa_regra03_*`; gatilhos `b_entrega_regra03`, `b_execucao_so_sobe`, `b_execucao_so_encerra` |
| R4 revisor não é autor nem quem julga depois | `ck_etapa_regra04_revisor`; `b_ficha_imutavel` |
| R5 ajuste volta ao autor; teto de cada contador | `CHECK` de teto gerado (`between 0 and N`); gatilho `b_etapa_regras` |
| R6 sem ciclo; etapa só anda com card ativo | gatilho adiado `c_conferir_card` → `conferir_card` |
| R7 prioridade e prazo só do fundador | gatilho `b_campos_do_fundador` (`helena_v2.campo_do_fundador='sim'` só dentro de `_mudar_campo_do_fundador`) |
| R8 nada externo sem o ok, só pelo motor, uma vez | índices únicos `(card_id, etapa_codigo)`; `ck_acao_regra08_ok_antes_de_executar`; `b_acao_regras`; `ck_historico_regra08_so_o_motor_executa` |
| R9 aprovada só com os portões; nenhum padrão aprova | `ck_etapa_regra09_aprovada_passou_portao`; `b_etapa_regras`; `c_conferir_card` |
| R10 nada pronto com informação velha | `ck_etapa_regra10_pronta_fresca` |
| R11 toque seu gravado uma vez e com destino | `mensagem_numero_unico`, `historico_toque_unico`, `ck_historico_regra11_toque_tem_destino` |
| R12 falha de infraestrutura não gasta tentativa | **não cabe numa trava** (depende da origem da falha): coberta por teste |
| R13 o histórico reconstrói o card | `b_historico_so_acrescenta`, `a_nunca_apagar`, `a_nunca_truncar`; `_achar_linha` recusa duas linhas para o mesmo evento; `conferir_historico` |

Os `CHECK` e gatilhos de domínio (`ck_card_estado`, `ck_etapa_estado`, `ck_acao_externa_estado`, tetos) vêm do 0002; trocar um estado ou teto é mudança de YAML (seção 9.3).

### 7.2 Gatilhos fora das 13 regras

| Gatilho | Tabela | Migration | O que faz |
|---|---|---|---|
| `a0_vincular_toque_fundador` | `historico` (before insert) | 0013 | grava `solicitante_uid = auth.uid()` em toque do fundador vindo de `authenticated`; recusa se não for fundador |
| `a_real_proteger_aprovacao_fundador` | `historico` (before insert) | 0010 | em card real, `APROVAR` do fundador (etapa, ação, reação no card pronto) relê as fontes na mesma transação |
| `b_real_proteger_promocao` | `etapa`, `card` | 0007 | promoção a `APROVADA`/`PRONTA`/`PRONTO` em card real confere fontes; ordem do card não pode mudar |
| `b_coordenacao_leitura_real` | `card` | 0008 | em card real, `LER_DE_VOLTA` só passa se a resposta da chave atual já está gravada e o histórico tem o mesmo conteúdo |
| `b_config_vincular_card`, `b_config_preservar_card` | `card` | 0006 | fixa `config_revision_id` na criação (herdado do pai em card filho) e proíbe mudá-lo |
| `config_revisao_imutavel`, `config_sem_truncate`, `config_validacao_sem_*` | `configuracao`, `configuracao_validacao` | 0006 | revisão não-rascunho imutável; sem apagar nem truncar |
| `config_ativacao_so_acrescenta` | `configuracao_ativacao` | 0019 | só acréscimo |
| `b_publicacao_transicao` | `publicacoes` | 0018 | transições legais da publicação |
| `solicitacao_card_real_imutavel` | `solicitacao_card_real` | 0007 | só permite preencher consumo uma vez |
| `resposta_coordenacao_imutavel`, `resultado_coordenacao_imutavel` | duas tabelas | 0008 | imutáveis |
| `pedido_evento_imutavel`, `pedido_plano_imutavel` | `pedido_entrada_evento`, `pedido_entrada_plano` | 0023 | evento imutável; plano só aceita o preenchimento do card |
| `pedido_resposta_imutavel`, `pedido_proposta_imutavel` | resposta bruta e proposta | 0024 | imutáveis |
| `pedido_proposta_telegram_aviso` | `pedido_entrada_proposta` (after insert) | 0026 | aviso `PERGUNTAR`/`PROPOR` |
| `pedido_card_telegram_aviso` | `pedido_entrada_plano` (after update of `card_id`) | 0026 | aviso "card criado" |
| `pedido_estado_card_telegram_aviso` | `card` (after update of `estado`) | 0026 | aviso quando o card entra em `ESPERANDO_CONFIRMACAO`, `ESPERANDO_FUNDADOR`, `PRONTO` ou `ENCERRADO_COM_FALHA` (usa a linha de histórico como chave estável) |

Os avisos só saem se a **primeira** mensagem do pedido veio do Telegram, pelo mesmo chat privado, com o vínculo ainda ativo (`_telegram_avisar_pedido`). Chave de aviso repetida é ignorada (`telegram_aviso_fato_unico`).

---

## 8. O schema `dbos_helena_v2` e as contas do motor

- **O que é:** o schema do DBOS Transact (versão 3.2.0, DEC-026), usado pelo motor para fluxos duráveis. **13 tabelas** (`application_versions`, `dbos_migrations`, `event_dispatch_kv`, `notifications`, `operation_outputs`, `queues`, `streams`, `workflow_events`, `workflow_events_history`, `workflow_input`, `workflow_output`, `workflow_schedules`, `workflow_status`) e **3 funções** (`enqueue_workflow`, `notifications_function`, `send_message`).
- **Arquivos:** `producao/01_contas_do_motor.sql` (cria `helena_motor` e `dbos_motor` sem senha, vínculos e o schema vazio, pertencente a `dbos_motor`) e `producao/02_esquema_dbos.sql` (as tabelas, **gerado** por `producao/gerar_esquema_dbos.py` a partir do DBOS instalado; não edite à mão). O motor roda o DBOS com `run_migrations=False`, então o schema precisa estar pronto antes. O 02 para com erro se o schema já tiver tabelas.
- **Versão do DBOS mudou?** Rode `gerar_esquema_dbos.py` de novo; um teste do motor (`test_producao_contas.py`) falha se o 02 não bate com o DBOS instalado.
- **Contas:** `helena_motor` = conta do aplicativo (`SET` para `service_role`, sem herdar, sem admin); `dbos_motor` = dona do schema, sem nenhum vínculo com `service_role`; nenhum outro papel enxerga `dbos_helena_v2`. O motor recusa partir com credencial administrativa (`motor/orquestrador/orquestrador/bancos.py`, `preflight_papel_runtime`, que roda antes do `SET ROLE`).
- **Senhas:** definidas pelo fundador, fora do repositório e do chat (`alter role ... password` no SQL Editor), e usadas só nos endereços de conexão do arquivo de ambiente da VPS, com `sslmode=verify-full`. Nunca copie valores para documentos.
- **Estado em produção:** `LEIA-ANTES.md` registra aplicação em 17/10/2026 com o fundador autorizando e SHA-256 conferido. **Estado atual: NÃO CONFIRMADO** (consulte). O `helena_v2` e o `dbos_helena_v2` nunca se misturam: uma migration `helena_v2` não cria nem altera nada em `dbos_helena_v2`.

---

## 9. Como mudar o banco com segurança

### 9.1 Antes de escrever

1. Confirme o que já existe (AGENTS.md: JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE / NÃO CONFIRMADO). Procure a função nas seções 5 e 6 e no SQL; veja **qual migration a redefiniu por último**. Edite a versão mais recente, nunca a original.
2. Escolha o lugar certo:
   - **Mudar uma regra do card** (estado, passagem, teto, prazo, vocabulário)? É YAML, não SQL: `helena-v2/maquina/passagens.yaml`/`vocabulario.yaml` → `python helena-v2/maquina/provar.py` → `python supabase/migrations-v2/gerar_passagens.py` → testes. O 0002 é regenerado; `test_02_gerador.py` e o passo `gerar_passagens.py --conferir` do CI falham se o arquivo guardado difere. **Ver armadilha 10.5 antes de levar isso à produção.**
   - **Tabela, função, gatilho ou permissão nova?** Migration nova, numerada.
3. Nunca coloque SQL da v2 em `supabase/migrations/` (v1, DEC-028/DEC-032).

### 9.2 Escrever a migration e o teste

1. **Arquivo novo e numerado:** `supabase/migrations-v2/0027_nome_curto.sql` (próximo número livre). Não edite migration já aplicada. Cabeçalho no padrão da casa: `O que é:`, `Como mudar:` e o que a migration **não** faz.
2. **Uma transação, idempotência consciente.** Funções com `create or replace`; tabelas/colunas com `create table`/`alter table` simples (a 0006 avisa: "usa `CREATE TABLE` e não deve ser reaplicada").
3. **Função nova de negócio:** `language plpgsql ... security definer set search_path = pg_catalog, pg_temp` (padrão de 0005 em diante, com nomes sempre qualificados `helena_v2.x`, `public.x`, `auth.uid()`, `extensions.digest`). Comece pela checagem de papel (`sou_fundador()` ou `_conta() <> 'service_role'`). Use `FOR UPDATE`/`FOR SHARE` e `set lock_timeout = '5s'` onde a conferência precisa ser atômica com a gravação.
4. **Permissões no fim da migration, sempre:**
   ```sql
   revoke all on helena_v2.tabela_nova from public, anon, authenticated, service_role;
   revoke all on sequence helena_v2.tabela_nova_id_seq from public, anon, authenticated, service_role; -- se tiver identity
   revoke all on function helena_v2.funcao_nova(assinatura) from public, anon, authenticated, service_role;
   grant execute on function helena_v2.funcao_nova(assinatura) to authenticated;   -- ou service_role, conforme a seção 5
   ```
   Tabela nova: `alter table ... enable row level security;` e, se for histórico, gatilhos `before update or delete` e `before truncate` que sempre levantam `42501`, copiando `_pedido_proposta_imutavel` (0024).
5. **Redefinir função existente:** use `create or replace` com a **mesma assinatura**; os `GRANT` anteriores permanecem. Se a assinatura mudar (argumento novo, outro tipo, outro default), nasce uma **segunda função** (sobrecarga) com `EXECUTE` aberto para `PUBLIC` e a antiga continua com os grants antigos: faça `drop function` da antiga e `revoke`/`grant` da nova, e confira chamadores (`src/integrations/*`, `motor/orquestrador`, `supabase/functions`).
6. **Teste obrigatório,** em `supabase/migrations-v2/testes/test_NN_nome.py` (a numeração dos testes não segue a das migrations; olhe o último). Use `from integral import banco_integral`, que monta um PostgreSQL descartável com `auth.uid()` de mentira (lê `request.jwt.claim.sub`), `public.app_access` com um fundador e um membro, o pgcrypto no schema `extensions`, os stubs de `public.checkpoint_mestre`, `portfolio`, `tarefas`, `decisoes`, `agent_jobs` e **todas** as migrations em ordem (`ate=N` para parar antes). Entre como `authenticated` (fundador) ou `service_role` com `integral.conectar('authenticated')`. Teste o caso permitido **e** a tentativa de violar (padrão `test_ataque_bypass.py`, `test_21_seguranca_papeis_local.py`). Mapa dos testes: 01 esquema, 02 gerador, 03 jornadas, 04 diferencial, 05 regras, 06 estado direto, 07 cenários, 08 achados, 09 publicação, 10 resposta de execução, 11 contrato da tela, 12 configuração, 13 pedido real, 14 confirmação real e coordenação, 15 fontes na aprovação, 16 ações, 17 reações, 18 interações, 19 leitura do card, 20 card ligado, 21 matriz de papéis, 22 backup/restauração, 23 relógio, 24 publicação (0018), 25 ativações (0019), 26 validador (0020), 27 pedido (0021), 28 pareamento, 29 pedido→card, 30 proposta, 31 inbox, 32 avisos.
7. **Se a função muda o que o app ou o motor recebe,** atualize no mesmo commit o chamador (`src/integrations/<área>/repository.ts` ou o módulo do `motor/orquestrador`) e o teste de contrato (`test_11_contrato_tela.py`). Se a migration lê coluna nova de `public.*`, atualize o stub de `testes/integral.py`.
8. **Atualize este arquivo** (seções 2, 4, 5 e 6).

### 9.3 Rodar os testes (tudo local, nada toca o Supabase real)

```sh
cd supabase/migrations-v2
pip install -r requirements.txt            # pyyaml, jsonschema, psycopg, pytest (versões fixas)
python gerar_passagens.py --conferir        # o 0002 confere com o YAML?
python -m pytest                            # sobe um PostgreSQL 16 descartável em /tmp/pg-helena-v2-*, porta 54329, só 127.0.0.1
python -m pytest testes/test_26_plano_exige_validador.py    # um arquivo só
```

- Precisa de PostgreSQL 16 instalado; `HELENA_V2_PG_BIN` aponta a pasta `bin` se estiver fora do lugar comum.
- `HELENA_V2_TESTE_DATABASE_URL` faz o teste usar um servidor existente e criar nele um banco descartável. O código **recusa host remoto** (`exigir_banco_local`): só localhost ou o service container do CI. Nunca aponte para o Supabase.
- Mais sequências aleatórias: `HELENA_V2_DIF_SEMENTES=30 python -m pytest testes/test_04_diferencial.py`. Cobertura da tabela de passagens: `HELENA_V2_COBERTURA=1 python -m pytest -s`.
- A fixture `banco` de `conftest.py` aplica só a base histórica 0001–0006 (provas de equivalência com o YAML). Para o estado atual use sempre `banco_integral`.
- Quando mexer em `motor/orquestrador`, rode também os testes dele (precisam do mesmo `HELENA_V2_TESTE_DATABASE_URL` ou do PostgreSQL local): `cd motor/orquestrador && PYTHONPATH=.:../executor:../validador:../ferramentas python -m pytest -q`.
- Edge Function: `node --test supabase/functions/helena-v2-telegram/core.test.mjs` (8 testes; Node 22). **Não está no workflow do CI** hoje (NÃO CONFIRMADO em outro lugar): rode à mão.

### 9.4 O CI (`.github/workflows/helena-v2.yml`)

Roda em todo pull request e em push para `main` e `missao-cumprida-v4` (e `workflow_dispatch`). Jobs relevantes ao banco:

| Job | O que roda |
|---|---|
| `banco-v2` | `postgres:16` como *service container* (`POSTGRES_HOST_AUTH_METHOD: trust`, só dentro do job); `HELENA_V2_TESTE_DATABASE_URL=postgresql://postgres@localhost:5432/postgres`; em `supabase/migrations-v2`: `pip install -r requirements.txt`, `python gerar_passagens.py --conferir`, `python -m pytest` |
| `orquestrador-v2` (3 grupos: rápidos, durabilidade, despacho) | cada um com seu PostgreSQL 16 e a mesma variável de teste; `PYTHONPATH=.:../executor:../validador:../ferramentas`; `pytest` de `motor/orquestrador` (testes do motor contra um PostgreSQL de teste) |
| `especificacao`, `motor`, `app` | YAML (`python validar.py`), as peças do motor, `npm test`, `tsc`, build |

Verde = pode seguir; vermelho = não junte. O CI **nunca** toca Supabase, EasyPanel ou Hermes. Branch de trabalho sem PR não dispara sozinha: abra o PR como rascunho ou use "Run workflow".

### 9.5 Aplicar em produção: só com autorização explícita do fundador

- **Regra (AGENTS.md):** alterações no banco exigem autorização explícita do fundador para aquela ação; não peça de novo se já foi concedida para a mesma ação. O histórico mostra o formato: o fundador escreve uma frase exata, por exemplo "AUTORIZO CRIAR AS CONTAS helena_motor E dbos_motor E O ESQUEMA dbos_helena_v2 NO SUPABASE wxkgrykduqtsgmjkzlou" (`producao/LEIA-ANTES.md`). Sem frase, **só escreva e teste**.
- **Consulta é permitida, sempre somente leitura:** `begin read only; ...; rollback;`. Antes de qualquer coisa, confirme o projeto (`wxkgrykduqtsgmjkzlou`, `ecosistemadossonhos`); o projeto `imvfmjgmacrulhztrqlh` é histórico, **não aplicar nele** (`transporte/gerado/LEIA-ANTES.md`).
- **Antes de aplicar** (README das migrations): privilégios do dono das funções `SECURITY DEFINER` sobre as fontes públicas (leitura e locks de `public.*`), RLS, exposição do schema na API, contas dedicadas, backup e retorno. Testes locais **não provam** esses privilégios no projeto real.
- **Como aplicar quando autorizado:** o arquivo inteiro, numa única transação, na ordem; confira o SHA-256 do arquivo antes (padrão de `producao/` e `transporte/`). Não reaplique migrations históricas isoladamente: a 0004 reaplicada revoga os `GRANT` das RPCs de 0005 em diante; a 0006 usa `CREATE TABLE`.
- **Depois:** verificação somente leitura (seção 9.6), registro no `onde-estamos.md` com data e o que **não** foi verificado.
- **Desfazer:** não há `DOWN`. Tabelas de histórico não aceitam `DELETE`/`TRUNCATE` por gatilho. A correção é uma migration nova de compensação (e restauração de backup só com autorização).
- **Ferramentas do Supabase (MCP, CLI, SQL Editor):** só leitura sem frase do fundador. `apply_migration`, `execute_sql` de escrita, `deploy_edge_function` e criação de segredo são escrita remota: pare e peça a frase.

### 9.6 Checklist de verificação somente leitura (conexão autorizada; `begin read only`)

```sql
-- schema e tabelas
select count(*) from pg_tables where schemaname = 'helena_v2';                      -- esperado pelo código: 45
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'helena_v2' and c.relkind = 'r' and relrowsecurity;               -- esperado: as 21 da seção 4
-- ninguém escreve direto
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_schema = 'helena_v2' and privilege_type <> 'SELECT';                    -- esperado: nenhuma linha para os papéis da API
-- quem executa o quê
select p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'execute') as auth,
       has_function_privilege('service_role', p.oid, 'execute') as servico
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'helena_v2' order by 1;
-- compare com a coluna "Quem chama" da seção 5; funções _* e trg_* devem dar false/false
select polname, polrelid::regclass from pg_policy where polrelid::regclass::text like 'helena_v2.%';
-- selo da tabela de regras e configuração ativa
select impressao_digital, hash_das_linhas from helena_v2.meta_tabela;                -- esperado: impressão 4d307f25747d5381
```

(`helena_v2.tabela_confere()` e `vigia()` são `EXECUTE` do `service_role`; chame-as como o motor, não como `authenticated`.)

---

## 10. Armadilhas conhecidas

1. **`configuracao_ativa()` devolve `jsonb`, não uma linha.** Use `select helena_v2.configuracao_ativa() as ativa` (ou `->> 'id'`, `->> 'estado'`), nunca `select * from`. É `NULL` sem revisão ativa, e `conteudo` é o bundle inteiro cujas **chaves são caminhos** (`'helena-v2/organograma.yaml'`): acesse com `#> array['helena-v2/organograma.yaml','empresas',p_empresa,'pacote']`, como faz a 0023. Só `service_role` a chama; o fundador usa `ler_configuracao(id)` ou `listar_configuracoes()`.
2. **`service_role` é o motor.** Não existe papel "motor" no banco além de `conta_papel`. Em teste, `SET ROLE service_role`; em produção, o motor conecta como `helena_motor` e faz `SET ROLE service_role` **depois** do preflight. Sem `SET ROLE`, `_conta()` devolve `helena_motor` e a chamada falha (`PAPEL_NAO_PERMITIDO` em `aplicar_evento`; `SOMENTE_MOTOR` nas demais RPCs). `service_role` **não** é o fundador: a autorização do fundador exige a sessão autenticada dele (`SOMENTE_FUNDADOR_AUTENTICADO`). O README dos pedidos reais avisa que o modelo não protege de um worker comprometido que consiga alterar as próprias fontes.
3. **`aplicar_evento` não levanta erro por recusa de negócio.** Quem chama precisa ler `resultado`. `RECUSADO`, `COMENTARIO_NO_CARD`, `RESPOSTA_GUARDADA` e `REPETIDO` **não** mudam o estado. Erro de regra de ferro (`REGRA n: ...`) é o banco recusando um estado impossível, e aí a transação inteira volta.
4. **`PLANO_VALIDO` nunca é automático (0020).** O YAML ainda lista `PLANO_VALIDO` entre os automáticos, mas `_cabe` devolve `false` para ele. O motor tem de emitir `aplicar_evento('card', id, 'MOTOR', 'PLANO_VALIDO')` explicitamente depois de `validar_plano`. Cards que avançaram antes da 0020 não foram reverificados. `aplicar_resposta_coordenacao` passa `p_nao_disparar => '{PLANO_VALIDO}'` por redundância.
5. **A tabela de passagens é selada.** Editar linha à mão faz `tabela_confere()` dar falso e bloqueia `registrar_validacao_config`/`ativar_configuracao`/`registrar_configuracao_tecnica` e o motor. Além disso, `_config_maquina_instalada` (0006) compara os três documentos da máquina (`passagens.yaml`, `vocabulario.yaml`, `jornada.schema.json`) com **hashes fixos no código**: mudar a máquina exige nova migration que atualize esses hashes **e** o `impressao_maquina` da configuração técnica. O README diz que "a configuração não troca a máquina global: isso exige migração e prova". Não há, nas 26 migrations, um precedente de regeneração do 0002 sobre produção já instalada (a única mudança de comportamento da máquina, a 0020, foi feita como trava em `_cabe`, sem tocar no YAML). O procedimento seguro para mudar a máquina em produção é **NÃO CONFIRMADO**: pergunte ao fundador e planeje a migration (hashes + selo + configuração técnica) antes de começar.
6. **Reaplicar `0004` isoladamente** revoga os `GRANT` de todas as RPCs posteriores. **Reaplicar `0002`** apaga e regrava as tabelas de regras (precisa de `helena_v2.migrando = 'sim'`, que o próprio arquivo liga; rode sempre em transação para esse parâmetro de sessão não vazar). Nenhum dos dois é rotina.
7. **Funções que redefinem outras.** Antes de mexer, olhe a coluna "Redefinida" da seção 5. Casos que enganam: `aplicar_evento` (0003 → 0012; a porta pública é a da 0012), `_cabe` (0003 → 0020), `ativar_configuracao` (0006 → 0019: a 0019 diz "corpo idêntico ao da 0006 mais o INSERT"; se alterar uma, altere a outra versão-base com cuidado), `situacao_publicacao` (0005 → 0018), `receber_pedido_entrada` (0021 → 0022), `consumir_plano_pedido` (0023 → 0024, com `pedido_grande` mudando de `true` para `false`) e, sobretudo, **`_real_conferir_card_vinculado`**: nasceu na 0007, foi redefinida em 0009 e 0015 e, na 0023, o corpo da 0015 foi **renomeado** para `_real_conferir_card_v1` e o nome antigo passou a ser um roteador (`origem = 'pedido_entrada'` → `_pedido_conferir_card_vinculado`). Os gatilhos de 0007/0008/0010 continuam chamando o nome antigo. Consertar "a conferência de card real" sem saber disso edita a função errada.
8. **`criar_card` fechada (0007).** Nenhum papel a chama; para criar card use `consumir_solicitacao_card_real` ou `consumir_plano_pedido`. Chamar `criar_card` por RPC dá `permission denied`. A deduplicação dela é só por `(canal, numero)`, sem comparar carga, e foi por isso que a 0007 a fechou.
9. **`confirmar_plano_pedido` tem `GRANT` direto ao `authenticated` (0023)**, além do caminho `confirmar_proposta_pedido` (0024) que o site usa. Ela aplica as mesmas conferências de serviço, pacote e fontes, mas **não** exige proposta atual nem passa pelo `bloqueio`. Se a intenção for que só a proposta confirme, é decisão do fundador revogar (migration nova). Hoje: AUSENTE de revogação.
10. **`search_path` muda no meio da história.** 0001–0004 usam `helena_v2, pg_catalog, pg_temp` (nomes sem prefixo funcionam); 0005 em diante usam `pg_catalog, pg_temp` e **exigem nome qualificado** (`helena_v2.tabela`). Função nova escrita com nome sem prefixo falha ou, pior, resolve para outro objeto.
11. **Identity sequences** (`...id_seq`) precisam de `REVOKE` próprio (as migrations de 0019, 0021 e 0022 fazem). Esquecer deixa um furo pequeno.
12. **URL fixa em texto:** as mensagens de aviso do Telegram (0026) trazem a URL do site escrita no SQL. Mudar o domínio exige migration que redefina as quatro funções `_telegram_avisar_*`.
13. **O harness de teste não é o Supabase.** `auth.uid()` do teste lê `request.jwt.claim.sub`; o do Supabase lê `request.jwt.claims`. Só `auth.uid()` existe no stub (nada de `auth.jwt()`/`auth.role()`); só as colunas listadas em `integral.py` existem nos stubs de `public.*`; os papéis são criados sem login. A suíte prova a lógica, **não** os privilégios do projeto real (README).
14. **Exposição do schema na API.** O site (`.schema('helena_v2')`) e a Edge (cabeçalho `content-profile: helena_v2`) só alcançam as RPCs se `helena_v2` estiver exposto no PostgREST. O briefing datado de 17/10/2026 diz "API exposta"; o README fala que depende da configuração de implantação. **NÃO CONFIRMADO hoje.**
15. **Tempo.** `aplicar_evento` usa `now()` (tempo da transação); `eventos_devidos` e publicações usam `clock_timestamp()`. O dia da publicação é o de Brasília (`America/Sao_Paulo`). Prazos aceitos: de 30 dias atrás a 10 anos à frente (`_prazo_valido`).
16. **Toques do fundador exigem `p_versao_vista` igual à versão atual** do alvo para `APROVAR`, `PEDIR_AJUSTE` e `RESPONDER`; senão vira `COMENTARIO_NO_CARD`. Reenvie com `p_toque` estável: o mesmo `p_toque` nunca repete o efeito.

---

## 11. A Edge Function `helena-v2-telegram`

**Onde:** `supabase/functions/helena-v2-telegram/` (`index.ts`, `core.ts`, `transport.ts`, `core.test.mjs`). **Papel:** único ingresso confiável do Telegram. Recebe o webhook do bot, grava o Update de forma durável no banco (`registrar_update_telegram`) e só então responde `200`; entrega a caixa de saída ao Telegram; expõe ao adapter do Hermes (`motor/hermes-vps/telegram-v2/`) uma capacidade restrita. Quem chama o banco é a Edge, com a chave de `service_role`; o token do bot, a chave de serviço e os segredos de ingresso **só existem na Edge** (o motor e o Hermes não os têm).

**`supabase/config.toml`:**
```toml
project_id = "wxkgrykduqtsgmjkzlou"
[functions.receive-leads]      # só configuração: não há código dessa função neste repositório
verify_jwt = false
[functions.helena-v2-telegram]
verify_jwt = false
```
`verify_jwt = false` é necessário porque o Telegram não envia JWT; a autenticação é feita pela própria função com cabeçalhos secretos (comparação por SHA-256 em tempo constante). `receive-leads` não tem pasta em `supabase/functions/`: se está implantada é NÃO CONFIRMADO. Deploy: `supabase functions deploy helena-v2-telegram --no-verify-jwt` (roteiro em [telegram-virada-para-v2.md](../telegram-virada-para-v2.md)); é escrita remota e exige a frase do fundador.

**Segredos (somente nomes):**

| Nome | Para que serve | Observação |
|---|---|---|
| `HELENA_V2_TELEGRAM_WEBHOOK_SECRET` | confere o cabeçalho `x-telegram-bot-api-secret-token` do webhook | formato `[A-Za-z0-9_-]{32,256}` |
| `HELENA_V2_TELEGRAM_WORKER_SECRET` | confere o cabeçalho `x-helena-telegram-worker-secret` das rotas do worker | mesmo formato; **tem de ser diferente** do segredo do webhook (senão a função não parte) |
| `HELENA_V2_TELEGRAM_BOT_TOKEN` | enviar mensagens (`sendMessage`) | formato `<números>:<texto>` |
| `SUPABASE_URL` | endereço do projeto | o código só aceita `https://wxkgrykduqtsgmjkzlou.supabase.co`, sem caminho, porta ou credencial |
| `SUPABASE_SERVICE_ROLE_KEY` | chamar as RPCs como `service_role` | a Edge a lê do ambiente; se a plataforma a injeta é NÃO CONFIRMADO |
| `HELENA_V2_TELEGRAM_MODE` | opcional; só vazio ou `webhook` liga a Edge | qualquer outro valor (por exemplo, o modo de poller legado) deixa tudo desligado |

Falta qualquer um, ou os dois segredos iguais: a função responde `503 {"ok":false}` a tudo (falha fechada). Nunca grave valores no repositório.

**Rotas (todas `POST`; outro método = `405`):**

| Caminho (o final da URL) | Cabeçalho secreto | Corpo | O que faz | RPC chamada |
|---|---|---|---|---|
| qualquer outro (a raiz da função) = **webhook** | `x-telegram-bot-api-secret-token` | o Update do Telegram (JSON, até 64 KiB, precisa de `update_id` inteiro positivo) | grava o Update; confere que o recibo devolve o mesmo `update_id`; tenta entregar um item da saída (melhor esforço); responde `200 {"ok":true}` só depois do commit | `registrar_update_telegram`, depois `reivindicar_saida_telegram` / `concluir_saida_telegram` / `reagendar_saida_telegram` |
| `…/worker/claim` | `x-helena-telegram-worker-secret` | vazio | reivindica o próximo trabalho; `200 {"ok":true,"job":{...}|null}` | `reivindicar_trabalho_telegram` |
| `…/worker/renew` | idem | `{update_id: "<string numérica>", lease_token}` | renova o lease | `renovar_trabalho_telegram` |
| `…/worker/complete` | idem | `{update_id, lease_token, resposta?: string, proposta?: objeto}` | conclui o trabalho e enfileira a resposta | `concluir_trabalho_telegram` |
| `…/drain` | idem | vazio | entrega até 10 itens da saída pelo Telegram e responde `{"ok":true,"processed":n}` | `reivindicar_saida_telegram`, `concluir_saida_telegram`, `reagendar_saida_telegram` |

Códigos: `401` segredo errado ou ausente; `400` corpo inválido; `413` corpo maior que 64 KiB; `503` erro de configuração ou de RPC (a resposta nunca repete a mensagem do backend). A capacidade do worker é um **subconjunto fixo** de sete RPCs (tipo `RpcName` em `core.ts`); não dá acesso a mais nada do banco. O texto de saída é conferido (1 a 4096 caracteres Unicode) antes de enviar e, se o envio falhar, o item volta à fila com recuo (pode duplicar mensagem se o Telegram aceitou e a resposta se perdeu; o recibo durável fica no SQL).

**O que o banco faz com o Update** (`registrar_update_telegram`, 0025): só chat privado com humano; `/vincular <48 hex>` consome o código de pareamento (`vincular_telegram`); `/pedido <texto>` de chat vinculado vira pedido (`receber_pedido_telegram`, origem `TELEGRAM`) com recibo; mídia vira `MIDIA` e callback vira `CALLBACK` (só registrados, sem interpretação nem autorização); texto comum vira `CONVERSA`; qualquer outro é `IGNORADO`. Tokens `/vincular` válidos são redigidos recursivamente antes de persistir.

**Estado de implantação:** NÃO CONFIRMADO. `onde-estamos.md` e `mapa-do-sistema.md` dizem que não houve deploy da Edge, webhook, VPS nem mensagem real nesta rodada; `telegram-virada-para-v2.md` diz "deploy foi feito, segredos não confirmados". Fontes em conflito: consulte (`list_edge_functions` somente leitura, ou o painel) antes de afirmar.

**Para mudar a Edge:** edite `core.ts`/`transport.ts`/`index.ts`, rode `node --test supabase/functions/helena-v2-telegram/core.test.mjs`, e se mudar um nome de RPC ou argumento mude também a migration 0025 e seu teste (`test_31_telegram_inbox.py`). Os identificadores de erro que a Edge repassa (`PAREAMENTO_NAO_VALIDO`, `TELEGRAM_NAO_VINCULADO`, `TELEGRAM_UPDATE_DIVERGENTE`, `ENTRADA_EVENTO_DIVERGENTE`) são contrato com o SQL.

---

## 12. Quem chama o banco (mapa de consumidores)

| Consumidor | Onde | Papel no banco | O que usa |
|---|---|---|---|
| Site (React) | `src/integrations/cards-v2`, `pedidos-v2`, `config-v2`, `telegram-v2`, `comando-v2` | `authenticated` (fundador) | RPCs do fundador; `select` em `card`, `etapa`, `entrega`, `solicitacao_card_real` |
| Motor (orquestrador DBOS) | `motor/orquestrador/orquestrador/` (`motor.py`, `triagem_pedido.py`, `despacho.py`, `relogio.py`, `publicacao.py`, `vigilancia.py`, `instalacao.py`) | `helena_motor` → `service_role` | RPCs do motor; `aplicar_evento` com os papéis de máquina; DBOS em `dbos_helena_v2` via `dbos_motor` |
| Edge Telegram | `supabase/functions/helena-v2-telegram/` | `service_role` (via PostgREST) | as 7 RPCs do transporte |
| Adapter Hermes | `motor/hermes-vps/telegram-v2/` | nenhum (fala só com a Edge) | rotas `worker/*` e `drain` com o segredo do worker |

---

## 13. O que este documento NÃO confirma

- O estado do banco real hoje (migrations aplicadas, tabelas, ACL, RLS, configuração ativa, dados): **NÃO CONFIRMADO**. Consulte antes.
- Deploy da Edge, webhook, segredos gravados, VPS, bot: **NÃO CONFIRMADO**.
- Exposição de `helena_v2` na API do projeto real: **NÃO CONFIRMADO**.
- O destino real de uma publicação e de uma ação externa: **AUSENTE** (a máquina existe; o efeito externo, não).
- Procedimento de mudança da máquina de estados sobre produção já instalada (armadilha 10.5): **NÃO CONFIRMADO**.
- Fonte de leis `FON-LEIS` para `SRV-PARECER`: **AUSENTE** (`confirmar_plano_pedido` recusa o serviço com `PEDIDO_FONTE_LEIS_AUSENTE`).

Verificações feitas ao escrever (todas locais, no checkout): `python gerar_passagens.py --conferir` confirmou que o 0002 guardado confere com o YAML (impressão digital `4d307f25747d5381`); a suíte completa de `supabase/migrations-v2` (`python -m pytest`, PostgreSQL 16 descartável local, 17min33s) terminou com 535 passados e 1 ignorado; `node --test` da Edge passou os 8 testes. Isso prova o **código**, não a produção.
