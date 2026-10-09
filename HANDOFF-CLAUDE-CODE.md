# Passagem de contexto para outro Claude Code — Sistema Helena

Data: 09/10/2026. Autor: Claude Code (sessão do Fundador). Responda sempre em português do Brasil.
Leia este arquivo primeiro. Depois: `AGENTS.md` (regras do projeto), `docs/PLANO-HELENA-V3.md` (plano atual) e `helena-v2/` (especificações).

## 1. O que estamos construindo

O Fundador quer uma **empresa operada por agentes de IA**, no lugar de funcionários:

- Ele conversa com a **Helena** (CEO virtual), que vira a ponte.
- Tudo o que ele pede vira um **card**. O card anda sozinho entre agentes especialistas: cada um executa, outro revisa.
- O card volta com um **relatório final bonito e legível**.
- O Fundador avalia com 👍/👎 e assim "treina" os agentes no jeito dele.

Exigências dele: lógica exata, zero erro de processo, manutenção rápida e organização melhor que a dos cursos e guias de mercado.

Empresas do grupo:

| Código | Empresa | Observação |
|---|---|---|
| BIZ-001 | — | — |
| BIZ-002 | — | — |
| BIZ-003 | Humano Digital | Empresa de teste agora |
| BIZ-004 | — | — |

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

Branch de trabalho: `missao-cumprida-v4`.

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

## 5. Plano atual: Helena v3

`docs/PLANO-HELENA-V3.md` (consolidado após uma revisão adversarial independente: 37 furos fechados).

- Princípio: o **código decide o processo** (estados, destino, prioridade, divisão, orçamento); a **IA decide o conteúdo**.
- 13 invariantes no Postgres.
- Máquinas de estado de card e etapa.
- Fases:
  - Fase 0 — segurança;
  - Fase 1 — especificações (**pronta**);
  - Fase 2 — motor no Postgres + workers + simulador + banco de casos;
  - Fase 3 — card no app + meta de ponta a ponta;
  - Fase 4 — demais agentes.

Especificações em `helena-v2/`:

- **Fichas** (`agents/`): Helena, Ravi, Isabela, Clara, Caio.
- **Modelos de entrega** (`deliverables/entregas.yaml`).
- **Roteiro** `playbooks/recrutar-10-pessoas.yaml`.
- **Esquemas** (`schemas/`).
- **Catálogo de modelos** (`models.yaml`).
- **Validador:** `cd helena-v2 && python validar.py`, que deve imprimir "OK: especificações coerentes".
- **Testes:** `python -m pytest -q test_validar.py` (9 testes de mutação). Requer `pyyaml` e `jsonschema`.

Próxima decisão do Fundador: "aprovo o plano v3 e o roteiro das 10 pessoas".

## 6. Pendências do Fundador

1. Fechar as portas 9119 (painel Hermes) e 8642, publicadas pelo Docker e acessíveis na internet: EasyPanel → serviço hermes → Ports.
2. Publicar o `helena-gateway-decisoes.zip` (Downloads) no EasyPanel.
3. **Trocar chaves.**
   - Segredos vazaram em log de build.
   - A chave `service_role` do Supabase está gravada em 11 arquivos rastreados (`scripts/*eliving*.mjs`, `scripts/inspecionar-tabelas.mjs`, `scripts/publicar-checkpoint-v035.mjs`, `scripts/testar-leitura-supabase-real.mjs`, `services/helena-gateway/dev-server.mjs`). Esses arquivos foram **excluídos deste pacote**.
   - Rotacionar a `service_role` e trocar os scripts para variável de ambiente.
4. Liberar `supabase.exe` no Windows, se quiser o CLI local de volta.
5. Missões antigas da Marina em WAITING_APPROVAL (`...683aabcc`, `...218deee`), já substituídas: encerrar com o ok dele.

## 7. Regras de trabalho com este Fundador

- Alterações em banco, VPS ou deploy só com autorização explícita para aquela ação. Já autorizado não se pede de novo.
- Nunca copiar ou imprimir valores de senhas, tokens ou chaves. Usar nomes e locais.
- Não criar contas externas nem digitar senhas: o Fundador faz os cadastros.
- Linguagem simples nas respostas. Ele quer ver resultado e progresso, sem jargão. Ser honesto sobre limites (ex.: "zero erro de conteúdo" não existe; "zero erro de processo" se garante por código).
- Não apagar o Hermes da Hostinger. `docs/backup-local/*` fica fora do git.
