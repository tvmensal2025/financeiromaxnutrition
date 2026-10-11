# Passagem de contexto para outro Claude Code — Sistema Helena

Data: 09/10/2026, atualizado em 10/10/2026 (organização do repositório). Autor: Claude Code (sessão do Fundador). Responda sempre em português do Brasil.
Leia este arquivo primeiro. Depois: `AGENTS.md` (regras do projeto), `docs/plano/PLANO-HELENA-V3.md` (plano atual, motor DBOS) e `helena-v2/` (especificações).

## 0-A. Ramo `v2-primeiro-card` (11/10/2026): primeiro card real com 5 agentes — LEIA ESTE BLOCO PRIMEIRO

Meta única: um card indo de ponta a ponta com Helena, Caio, Isabela, Clara e Ravi. PR rascunho no GitHub (nº 16, para `organizacao-2026-10-10`); não fazer merge sem o fundador. O fundador ficou sem cota em 11/10; este bloco diz o que está pronto e o que falta. Regras que valem acima de tudo: chaves NÃO se trocam agora (DEC-027); voz da v1 não se mexe; nada no Supabase real, EasyPanel, Hermes real ou `scripts/`; código novo nunca traz chave; só o HANDOFF é atualizado (curto); sem dizer "pronto" sem colar a saída dos testes.

**PRONTO (verificado, CI verde no GitHub até o passo 2; números de referência: helena-v2 292, ferramentas 588, validador 677 antigos + 1476 novos = 2153, executor 493, simulador 723, app 181):**
- Passo 1: `.github/workflows/helena-v2.yml` (jobs: especificação, 4 peças do motor, app e banco-v2). Roda em pull request e em envios para `main`/`missao-cumprida-v4`.
- Passo 2: ficha do Ravi v3.1 + dossiê, casos da Isabela (convite e roteiro), roteiro `playbooks/recrutar-10-pessoas.yaml` na v3.1. `PENDENCIAS.yaml` só tem as 13 fichas dos outros agentes. DEC-030: o revisor do relatório final é o Caio.
- Passo 3 (parte feita): validador `motor/validador/` cobre 78 de 78 checagens das entregas dos 5 agentes (quadro: `python -m spec_helena`), cada uma com boa + defeito em `helena-v2/casos/`.
- Passo 4 (parte feita): `supabase/migrations-v2/` com esquema, passagens GERADAS de `passagens.yaml`, função única `helena_v2.aplicar_evento`, travas das 13 regras e testes (README da pasta). Só local; nada aplicado no Supabase real.
- `docs/manual/como-mudar.md` (uma página) e `motor/executor/README.md`.

**FALTA, em ordem (o agente seguinte começa por 1):**
1. **Consertar o que os ataques independentes acharam** — tudo em `docs/auditoria/ATAQUES-2026-10-11.md` (cada achado com como reproduzir; reproduza antes de consertar). Banco: 2 ALTA (tabela temporária pode sombrear as tabelas de regras: falta `pg_temp` no `search_path` das funções SECURITY DEFINER; `abrir_chamada_helena` dá "permission denied" para `service_role`/`authenticated`, e o motor precisa dela), 4 MÉDIA, 2 BAIXA. Validador: 14 achados ALTA que ESCAPAM (convite/treinamento e cálculo/relatório) e vários MÉDIA. Os atacantes do parecer/dossiê e da fidelidade banco x `provar.py` foram interrompidos sem relato: refazer (o arquivo parcial do segundo, 1100 linhas, está em `supabase/migrations-v2/testes/ataque_fidelidade_nao_verificado.py`; rode-o à mão: o que passar vira regressão, o que falhar é achado).
2. Passo 5 — motor DBOS em `motor/orquestrador/` (novo): workflow DBOS (3.2.0, ver `motor/executor/requirements-hermes-real.txt` para o aviso de venv) que, para um card, chama o executor com o Hermes FALSO e o validador, e grava só por `aplicar_evento`. Teste: o card do roteiro das 10 pessoas vai de RASCUNHO a PRONTO sem ninguém destravar (os toques do fundador no teste são só os que o plano prevê: confirmar a leitura e aprovar). Respostas do agente nos testes = as respostas das boas de `helena-v2/casos/` (o adaptador `motor/validador/spec_helena` monta modelo e contexto).
3. Passo 6 — tela simples do card em `src/` lendo o schema `helena_v2` (somente leitura) e o botão "publicar" (só o fundador, no máximo 1 por dia, garantido no BANCO; registra o pedido, não publica nada).
4. Passo 7 — PARAR e pedir a frase do fundador para o "dia de prova" (Hermes real + ChatGPT dele). Deixar escrita só a lista de comandos (`docs/manual/dia-de-prova.md`, curta); não executar. Lembrar: a pasta `verificacao_real/` citada pelo executor não existe.
5. No fim: regenerar o quadro do validador (`python -m spec_helena --atualizar-readme`), atualizar este bloco e tirar o PR de rascunho só com o fundador.

**Lições deste dia:** (a) o isolamento `worktree` automático dos workflows partiu da `main`, não do ramo — criar os worktrees à mão (`git worktree add -b <ramo> <pasta> v2-primeiro-card`) e juntar com `git cherry-pick`; (b) o Workflow roda no máximo 2 agentes ao mesmo tempo nesta máquina; (c) commits de trabalho em andamento levam `[skip ci]`; (d) um `git commit` leva TUDO o que está no índice: confira com `git status` antes; (e) ao registrar uma CHK de tipo, a prova mora em `helena-v2/casos/` (teste `test_prova_na_especificacao.py`).

## 0. Estado em 10/10/2026 — leia primeiro

**Organização.** O repositório foi organizado no ramo `organizacao-2026-10-10` (a partir de `missao-cumprida-v4`). Onde está cada coisa: `README.md` e `docs/INDICE.md`. A auditoria do que foi feito em 09 e 10/10 está em `docs/auditoria/AUDITORIA-2026-10-10.md`. Nada foi apagado: o antigo está em `docs/arquivo/` (o `LEIA.md` diz o porquê de cada item).

**Decisões de 10/10** (`docs/decisoes/`, números provisórios): DEC-026 motor DBOS; DEC-027 troca das chaves no fim dos testes; DEC-028 desligar a central da v1 (só com a frase dele e com os clientes avisados); DEC-029 códigos das empresas (BIZ-001 iGreen, BIZ-002 Ecossistema de Saúde, BIZ-003 Humano Digital, BIZ-004 eLiving™).

**O que existe da v2 (só arquivos e testes; nada no ar):**

| Peça | Onde | Como conferir |
|---|---|---|
| Regras do card (tabela de passagens) e a prova das 13 regras | `helena-v2/maquina/` | `cd helena-v2 && python -m pytest -q` (cerca de 7 min) |
| Catálogo dos 21 agentes, 7 fichas v3.1, formatos de entrega, casos e jornadas | `helena-v2/` | `cd helena-v2 && python validar.py` (OK com 6 pendências conhecidas, em `PENDENCIAS.yaml`) |
| Servidor de ferramentas dos agentes (só leitura) | `motor/ferramentas/` | `python -m pytest -q` |
| Validador de entregas (portão 1) | `motor/validador/` | `python -m pytest -q` |
| Executor (adaptador do Hermes, com servidor falso) | `motor/executor/` | `python -m pytest -q` (cerca de 2 min) |
| Simulador da esteira | `motor/simulador/` | `python -m pytest -q` |

**Ainda NÃO existe:** o banco da v2 (tabelas e a função única que muda o estado), o motor DBOS rodando, a tela do card no app, o backup e os testes automáticos no GitHub.

**Fila de trabalho, em ordem:**
1. Fichas v3.1 dos 14 agentes que faltam, e os casos do convite e do roteiro de treinamento da Isabela (ver `helena-v2/PENDENCIAS.yaml`). Ao resolver, tire a linha da lista.
2. Reescrever `helena-v2/playbooks/recrutar-10-pessoas.yaml` na v3.1, e criar os roteiros das outras 3 empresas.
3. Ligar o validador de entregas (`motor/validador/`) aos IDs de checagem das entregas: hoje as entregas citam 106 IDs (CHK-...) e o código implementa 28, com só 3 em comum.
4. Simulador: usar só a máquina de `helena-v2/maquina/` (hoje ele tem uma cópia dos nomes e uma segunda implementação das regras em `referencia.py`, o padrão que travou a v1).
5. Executor: escrever o README e confirmar no "dia de prova" (fase 2, na VPS) as suposições sobre o Hermes real.
6. Construção: banco da v2 (testado em Postgres local), motor DBOS, tela do card, backup e testes no GitHub, nesta ordem e cada etapa com testes.
7. Manual do mantenedor e os roteiros de restauração e de publicação (`docs/manual/`). Ainda não existem.

**Lições desta sessão (não repetir):**
- Não diga que algo está pronto sem rodar o teste e mostrar a saída. Workflow "concluído" pode ter agentes que falharam: confira o campo de falhas.
- Não esconda mensagem de erro de comando (ex.: `2>/dev/null` num `git add`).
- Plano é texto curto para o fundador; regra exata mora em arquivo de dados que o validador confere. Atacar texto sem limite só faz o texto crescer.
- Poucos agentes por vez e modelo barato para tarefa repetitiva: a cota do fundador é limitada.

## 1. O que estamos construindo

O Fundador quer uma **empresa operada por agentes de IA**, no lugar de funcionários:

- Ele conversa com a **Helena** (CEO virtual), que vira a ponte.
- Tudo o que ele pede vira um **card**. O card anda sozinho entre agentes especialistas: cada um executa, outro revisa.
- O card volta com um **relatório final bonito e legível**.
- O Fundador avalia pelos botões do card (Aprovar, Pedir ajuste com motivo, Usar como exemplo, Cancelar) e assim "treina" os agentes no jeito dele.

Exigências dele: lógica exata, zero erro de processo, manutenção rápida e organização melhor que a dos cursos e guias de mercado.

Empresas do grupo:

| Código | Empresa | Observação |
|---|---|---|
| BIZ-001 | iGreen | DEC-029 |
| BIZ-002 | Ecossistema de Saúde | DEC-029 |
| BIZ-003 | Humano Digital | Empresa de teste agora |
| BIZ-004 | eLiving™ | Grafia exata "eLiving™"; regras em `docs/manual/eliving/` |

A marca eLiving™ tem regras próprias em `AGENTS.md`.

Modelo de negócio da Humano Digital (decisões DEC-024 e DEC-025 no banco):

- Pessoas gravam atividades do dia a dia como dados para IA, em plataformas como Mimix e Hub.
- O participante recebe cerca de US$ 5 por hora aprovada, integral.
- A Humano Digital recebe por cima, via programa de indicação ou equipe da plataforma: referência US$ 0,50 por hora, valor que varia por plataforma.
- **Meta atual do Fundador:** em 7 dias, ter o plano para recrutar as primeiras 10 pessoas.

## 2. Sistema atual (v1) — em produção

| Peça | Onde | Notas |
|---|---|---|
| Banco | Supabase `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou` | Fonte canônica. Comece por `public.checkpoint_mestre_atual`. Consultas de auditoria em `READ ONLY`. |
| Gateway | `services/helena-gateway/` (Node), serviço `helena-gateway` no EasyPanel do VPS | Deploy **só por upload de zip** com o Dockerfile na raiz (arrastar no EasyPanel). Ferramentas MCP `helena_operacao` e `helena_contracts`. |
| Agentes | 21 perfis Hermes (`/data/profiles/<nome>--biz003`, `helena--grupo`), contêiner `helena-automation_hermes` | Modelos via OAuth openai-codex (gpt-6-sol / gpt-6.1-sol). Arquivos do perfil pertencem ao uid 10000: editar com `docker exec -u 10000`. |
| Ciclo | Cron Hermes `helena-gateway-poll` a cada 2 min → `/data/helena-runtime/hermes_pipeline.py` | Executa `hermes_dispatch_once.py` (executor) e `hermes_workflow_tick.py` (Helena: COORDINATE / REVIEW / HANDOFF / RESOLVE / REPLAN). Fontes em `services/helena-gateway/scripts/`. Deploy no servidor: copiar para `/data/helena-runtime/` (root, 644, backup `.bak-*`). |
| Migrations | `supabase/migrations/` | Funções `gateway_workflow`, `gateway_workflow_checkpoint`, `gateway_record_coordination_note`, `gateway_replan_job` etc. |

Ramo base: `missao-cumprida-v4`. Organização de 10/10: `organizacao-2026-10-10` (ainda não juntado).

## 3. O que foi corrigido em 08–09/10 (commits na branch)

- Encaminhamento parado em silêncio: a nota da Helena não chegava ao Fundador.
  - `close_handoff` + `founder_question` geram uma pendência ABERTA no app.
  - Evento `HANDOFF_CLOSED`.
  - O checkpoint aceita o encerramento.
- Nova tentativa única quando a regra do ciclo muda:
  - `HANDOFF_RULE_VERSION` entra na impressão digital;
  - o índice de estado ignora encaminhamentos (`phase <> 'HANDOFF'`).
- Continuação com o mesmo agente permitida, porque a revisão independente continua obrigatória.
- Lista da equipe (AGT → nome/função) no prompt da coordenação: a Helena usava "Pedro" em vez de AGT-18.
- Diagnóstico de falha:
  - números soltos do log eram lidos como HTTP 401;
  - novas classes `DELIVERY_TOO_LONG` e `MAX_TURNS`.
- Pesquisa:
  - orientação para usar `web_extract` da página oficial;
  - teto de buscas por rodada subiu de 10 para 25 nos 22 configs.
- Decisões do Fundador passam a entrar no `get_job` (`founder_decisions`).
  - Código pronto; **zip do gateway ainda não publicado**: `helena-gateway-decisoes.zip`.
- Coordenação:
  - prioriza a meta vigente;
  - timeout de 570 s, abaixo do lease de 600 s;
  - missões criadas fora de encaminhamento entram no ciclo.

## 4. Estado no momento da passagem

- Esteira rodando sozinha. Entregas aprovadas em sequência (D3–D6 e dossiê Clickworker), maioria na 1ª tentativa.
- Problema estrutural observado: continuações de diligência furam a fila na frente da missão da meta, `JOB-HR-54d05d6e9fe145997abf038235d326d2`, que segue em DRAFT. É resolvido pelo escalonador da v3 (invariante 9).
- No PC do Fundador, o Windows "Controle de Aplicativo" passou a bloquear `supabase.exe`. Não altere configurações de segurança; acompanhe pelo servidor (Gateway com token de perfil, lido no servidor e nunca impresso).

## 5. Plano atual: Helena v3 (motor DBOS)

`docs/plano/PLANO-HELENA-V3.md` (motor DBOS; 171 furos com conserto, teste e fase em `docs/plano/REGISTRO-DE-FUROS.md`). A versão anterior, com motor no Postgres e 37 furos, está em `docs/arquivo/planos/plano-helena-v3-motor-postgres.md`.

- Princípio: o banco manda, o motor executa e o agente só escreve conteúdo. O código decide o processo; a IA decide o conteúdo.
- 13 regras de ferro: a tabela de passagens está em `helena-v2/maquina/passagens.yaml`, e a prova delas em `helena-v2/maquina/provar.py`.
- Agente: devolve uma de 5 ações, sem ferramenta que grava; no máximo "buscar" e "ler página", que são nossas (`motor/ferramentas/`).
- Qualidade em 3 portões: validador por código (`motor/validador/`), revisor com rubrica e o fundador no plano da meta e em ação externa.
- Fases: 0 segurança; 1 especificação (em andamento: 7 de 21 fichas); 2 motor e testes de base; 3 primeira meta real; 4 demais agentes. Nenhuma fase avança por data, só por teste.

Especificação em `helena-v2/` (ver `helena-v2/README.md`):

- `python validar.py` deve terminar em "OK" ou "OK com N pendência(s) conhecida(s)". Erro novo sai com código 1.
- `python -m pytest -q` roda os testes do validador e da máquina.

Frase de aprovação proposta ao fundador: "aprovo o plano v3 e o roteiro das 10 pessoas, com o motor DBOS".

## 6. Pendências do Fundador

1. Fechar as portas 9119 (painel Hermes) e 8642, publicadas pelo Docker e acessíveis na internet: EasyPanel → serviço hermes → Ports.
2. Publicar o `helena-gateway-decisoes.zip` (Downloads) no EasyPanel.
3. **Trocar chaves.**
   - Segredos vazaram em log de build.
   - Há chave do Supabase escrita em 11 arquivos rastreados do repositório (9 com a chave de acesso total e 2 com a chave pública), em `scripts/` e em `services/helena-gateway/dev-server.mjs`. **Eles continuam no repositório** (o texto antigo dizia que tinham sido excluídos do pacote; não foram). Lista: `git grep -l eyJhbGciOi`.
   - Por decisão do fundador (DEC-027), a troca fica para o fim dos testes. Até lá: repositório privado e nenhum arquivo novo com chave. Roteiro: `docs/manual/troca-de-chaves.md`.
4. Liberar `supabase.exe` no Windows, se quiser o CLI local de volta.
5. Missões antigas da Marina em WAITING_APPROVAL (`...683aabcc`, `...218deee`), já substituídas: encerrar com o ok dele.
6. Hostinger: conferir no painel o que vence em 27/10/2026 (sem recomendação até ele conferir).
7. Conferir no Supabase (só leitura) se os números DEC-026 a DEC-029 estão livres antes de gravar as decisões lá.
8. Pesquisa jurídica sobre recrutar pessoas para Mimix e Hub (pirâmide e marketing multinível, LGPD) antes do plano da meta.
9. Central da v1 (DEC-028): inventário só de leitura, aviso aos clientes e só então a frase dele para desligar. No mesmo inventário, ver se a voz da v1 usa API paga da OpenAI (DEC-014).

## 7. Regras de trabalho com este Fundador

- Alterações em banco, VPS ou deploy só com autorização explícita para aquela ação. Já autorizado não se pede de novo.
- Nunca copiar ou imprimir valores de senhas, tokens ou chaves. Usar nomes e locais.
- Não criar contas externas nem digitar senhas: o Fundador faz os cadastros.
- Linguagem simples nas respostas. Ele quer ver resultado e progresso, sem jargão. Ser honesto sobre limites (ex.: "zero erro de conteúdo" não existe; "zero erro de processo" se garante por código).
- Não apagar o Hermes da Hostinger. `docs/backup-local/*` fica fora do git.
