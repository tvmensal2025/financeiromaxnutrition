# Mapa do estado atual do Sistema Helena (10/10/2026, só leitura)

## 1) O que existe e roda hoje (v1)

**Peças**
- **Supabase:** 61 tabelas. Em `supabase/migrations/` há 73 migrations e 43 nomes de função distintos.
- **App React/Vite:** pasta `src/`, com 179 arquivos.
- **Gateway:** `services/helena-gateway/` tem 208 arquivos, e só o `src/server.mjs` tem 1.840 linhas. É publicado por upload de zip no EasyPanel.
- **Agentes:** Hermes com 21 perfis.
- **Ciclo de trabalho:** a cada 2 min, o cron do Hermes roda `scripts/helena_dispatch_poll.sh`. Ele chama `hermes_queue_watchdog.py` e depois `hermes_pipeline.py`, que faz até 6 ações (com até 1000 s por componente). As ações rodam em `hermes_dispatch_once.py` (649 linhas) e `hermes_workflow_tick.py` (705 linhas).

**Pontos fracos comprovados**
- **Remendo sobre remendo.** As 73 migrations foram feitas em 16 dias (23/09 a 08/10). A função `gateway_workflow_checkpoint` foi redefinida 7 vezes; `gateway_workflow`, `gateway_start_agent_job` e `gateway_claim_agent_job`, 5 vezes cada. 15 migrations fogem do padrão de data e hora (ex.: `20260925_PATCH_FINAL_CONSOLIDADO.sql`), e `supabase/patches/` fica fora da sequência.
- **O servidor não bate com o repositório.** Os scripts são copiados à mão para `/data/helena-runtime`. Há 20 scripts `install_*`/`patch_*`. O zip `helena-gateway-decisoes.zip` está pronto e não foi publicado (HANDOFF §6).
- **Fila furada.** A meta `JOB-HR-54d05…` está parada em DRAFT atrás de continuações (HANDOFF §4).
- **Segurança:**
  - portas 9119 e 8642 abertas para a internet;
  - modo de teste do app sem login;
  - `helenasistema.publico` ainda com papel de fundador;
  - funções do banco abertas para a chave pública;
  - webhook do WhatsApp sem senha;
  - chaves já apareceram no chat e num log de build.
- **Chaves em arquivos rastreados.** 11 arquivos têm uma chave escrita direto no código: 9 de acesso total ao banco (`service_role`) e 2 públicas (`anon`). Eles estão em `main`, `missao-cumprida-v4`, `antigravity-planos` e na branch atual:
  - `scripts/atualizar-marca-eliving.mjs`
  - `scripts/cadastrar-eliving.mjs`
  - `scripts/detalhes-iliving.mjs`
  - `scripts/diagnostico-iliving.mjs`
  - `scripts/inserir-estado-mestre-eliving.mjs`
  - `scripts/inserir-memoria-eliving.mjs`
  - `scripts/inspecionar-tabelas.mjs`
  - `scripts/publicar-checkpoint-v035.mjs`
  - `scripts/sincronizar-eliving-correto.mjs`
  - `scripts/testar-leitura-supabase-real.mjs`
  - `services/helena-gateway/dev-server.mjs`
- **Banco só pelo PC do fundador.** O `supabase.exe` está bloqueado pelo Windows, e as sessões na nuvem não alcançam `*.supabase.co`.
- **Sem backup** (plano provavelmente grátis).
- **CI incompleta.** Os 3 workflows (`.github/workflows/helena-{gateway,laya,meowcaller}-check.yml`) só rodam checagem e build por pasta. Não testam `helena-v2`, o app nem as migrations, e não publicam nada.
- **Gateway com escopo demais:** voz e ligação (ElevenLabs, Kokoro, Chirp, meowcaller), WhatsApp, finanças, visual e workflow num serviço só.

## 2) O que o plano v3 quer construir (`01-plano-v3.md`)

A ideia: o banco manda, o motor DBOS executa e o agente só escreve conteúdo.

- **Fase 0, segurança e base:**
  - checagem de invasão e varredura de portas;
  - fechar as funções do banco e o cadastro de contas;
  - desligar o modo de teste e tirar o papel antigo de fundador;
  - WhatsApp só do número dele, com senha e sem mensagem duplicada;
  - trocar todas as chaves e fazer a lista delas;
  - verificação em duas etapas nas contas;
  - backup criptografado no GitHub;
  - vigia do vigia (healthchecks.io) e avisos pelo Telegram;
  - botão de publicar e login separado da v2.
- **Fase 1, fichas e roteiro:** "pronta, falta seu ok".
- **Fase 2, esqueleto:**
  - tabela de estados e passagens, com uma função única que muda o estado;
  - as 13 regras travadas no banco;
  - motor DBOS;
  - Hermes travado (`hermes -z`, pasta vazia, sem senhas);
  - servidor de ferramentas próprio ("buscar" e "ler página");
  - validador de conteúdo, relógio de prazos, vigia a cada 5 min;
  - card no app;
  - a E1 do Caio de ponta a ponta.
- **Fase 3:** a meta E1 a E5, rubrica do revisor e o sistema de treino (lições e exemplos).
- **Fase 4:** os outros 16 agentes, um por vez; o laboratório de troca de modelo; o Codex.
- **Testes:** 11 testes de portão (cota, login de 48 h, Hermes travado, quedas, validador, servidor, avisos, backup, revisor, tamanho do banco e segurança). Mais 5 provas automáticas a cada mudança, entre elas o teste que percorre todas as combinações da tabela e o simulador da esteira.

## 3) v2 pronta × divergente (`docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md`)

- **Já existe (4):**
  - revisor nunca julga depois o que revisou;
  - Ravi fora da primeira meta;
  - prioridade guardada como dado;
  - ciclos, destinos e apelidos de modelo inexistentes são barrados.
- **Parciais (6):**
  - decisões sem escopo e sem dizer o que substituem;
  - cota com `reserva_prioritaria_pct: 30`;
  - card sem `como_e_o_pronto`, `card_anterior` e versão;
  - citação sem a regra das 12 palavras;
  - conta do Caio em texto livre, que o código não consegue refazer;
  - só o limite de tamanho é conferido (falta português e "sem HTML").
- **Divergentes (12), com destaque para seis furos que o registro diz fechados na fase 1 (que está marcada como pronta):**
  - a E3 depende da E1 (`recrutar-10-pessoas.yaml`), mas o plano diz que o convite nem recebe os números do Caio;
  - não há checagem de termos de ganho no `copy`;
  - a E5 tem `revisor: CODIGO` mais 👍/👎, em vez da Clara;
  - `max_ciclos: 1`, em vez de 2 voltas.
- **Ausentes (4):**
  - tabela de leis e temas obrigatórios do jurídico;
  - revisor reserva por etapa;
  - campo de ações permitidas e efeito de cada ferramenta;
  - recusa de texto que diz "enviei" ou "cadastrei".
- **O validador passa, mas confere o plano errado.** `helena-v2/validar.py` aponta para o plano antigo, `docs/PLANO-HELENA-V3.md`.
- **Divergências de desenho que mudam as fichas:**
  - as fichas usam `web_search`/`web_extract`, e não as ferramentas próprias do plano;
  - o orçamento é em "passos", mas nesse modo do Hermes o limite é de chamadas;
  - `models.yaml` tem modelo reserva, que o plano proíbe;
  - o card ainda usa os 14 estados antigos;
  - mensagem repetida é barrada por `dedupe_hash`, e não pelo número único da mensagem;
  - a ficha da Helena exige confirmação em todo card, e o plano só no pedido grande.

## 4) Complexidade das peças novas

Escala para sessões de IA, com revisão: pequena = 1 a 2 sessões; média = 3 a 6; grande = 7 ou mais.

| Peça | Tamanho |
|---|---|
| Alinhar as fichas da v2 (16 itens) e testes de mutação no validador | Pequena a média |
| Checagem de invasão e varredura de portas | Pequena (depende do fundador no console) |
| Fechar ~43 funções para a chave pública, cadastro, modo de teste e papel antigo | Média (alto risco de quebrar a v1) |
| WhatsApp com senha, só o número dele e número único da mensagem | Média |
| Lista e troca de chaves; tirar as chaves dos 11 arquivos | Média |
| Backup noturno criptografado e restauração semanal no GitHub | Média a grande |
| Vigia do vigia, Telegram e tabela de avisos reenviados | Média |
| Botão de publicar, ramo de produção, EasyPanel puxando do GitHub e volta automática | Grande |
| Cartão de diagnóstico a cada 3 h | Pequena a média |
| Esquema novo (caixa de entrada, cards, etapas, execuções, histórico) com a tabela de estados, a função única, as 13 regras e a impressão digital | Grande |
| Prova de todas as combinações e simulador da esteira | Grande |
| Motor DBOS (vagas, prioridade, 2 passos, cancelamento em 15 s, trava única, autoverificação, versão) | Grande |
| Lançador do Hermes travado, leitura do registro de uso e classificação de falhas | Média a grande |
| Servidor de ferramentas (partes de 20 mil caracteres, proteção contra endereços internos, contador de chamadas, cópia das páginas) | Média a grande |
| Validador de conteúdo (citação, idioma, termos de ganho, conta do Caio refeita) | Média |
| Tabela de leis com texto oficial e jurisprudência | Média a grande (curadoria humana) |
| Relógio de prazos e vigia das 13 regras no Supabase | Média |
| Classificação de mensagens, desfazer, código OK, listas "sem classificar"/"sem card" | Média a grande |
| Card no app (faixa do código, botões com versão, aba Técnico, trava do navegador) e painel | Grande |
| Troca de canal v1 → v2 | Média |
| Testes de portão 1 a 11 (vários longos, alguns exigem o fundador) | Grande no conjunto |
| Rubrica do revisor e teste 9 | Média |
| Treino (lições, exemplos, regras, contradição) | Grande |
| Laboratório de troca de modelo e os 16 agentes restantes | Grande |

São cerca de 24 peças, 9 delas grandes. Com WIP = 1, a fase 2 sozinha já é um produto inteiro.

## 5) Organização do repositório hoje

- **O trabalho da Helena não está na `main`.**
  - `missao-cumprida-v4` está 44 commits à frente; `antigravity-planos`, 46.
  - A conferência está numa terceira branch, `claude/gallant-cray-xrdt0t`, que saiu da `main` e não tem `helena-v2`.
  - Há 33 branches remotas (muitas `codex/*` e `cursor/*` de 28/09 a 05/10).
- **Plano v3 em três arquivos, com duas frases de aprovação diferentes** (furo M-2 aberto):
  - `docs/PLANO-HELENA-V3.md`;
  - `docs/planos/2026-10-09-PLANO-HELENA-V3.md` (cópia idêntica);
  - `docs/planos/sistema-helena-pacote/01-plano-v3.md`.
  - O HANDOFF aponta para o antigo; o `LEIA-PRIMEIRO.md`, para o novo.
- **Documentos soltos e duplicados:**
  - 10 `.md` na raiz, sendo 6 relatórios ou resumos (`RELATORIO_*.md`, `RESUMO_PARA_HELENA.md`);
  - `KOKORO_TTS_DOCUMENTACAO_OFICIAL.md` idêntico na raiz e em `docs/`;
  - `docs/` tem 156 arquivos; em `docs/planos/`, 62 dos 98 são cópias idênticas de arquivos que já estão em `docs/`;
  - há zip e jpg rastreados (`docs/CONTINUIDADE-HELENA-20261001.zip`).
- **Evidências de execução no git:** `artifacts/` tem 3,5 MB (zips, saídas de teste, jpg) e `screenshots/` tem 2,5 MB. O `saudacao_pedro.mp3` está duplicado em dois serviços.
- **Excesso de scripts e configurações:**
  - 130 scripts em `scripts/`, vários de uso único (eliving/iliving);
  - `package-lock.json` e `bun.lockb` juntos;
  - instruções de quatro ferramentas de IA: `.agents/`, `.cursor/`, `.kiro/` e `AGENTS.md`.
- **Chaves:** os 11 arquivos citados na seção 1. Apagar o arquivo não tira a chave do histórico do git; o conserto de verdade é trocar a chave.
- **O próprio pacote do plano tem falhas:**
  - o registro de furos não tem M-12 nem M-17 a M-22;
  - a rodada 3 mostra só 6 exemplos dos 37 (a lista está na seção 4 do plano antigo);
  - `diagramas/fases.jsx` põe a troca de chaves na fase 3, e o texto põe na fase 0;
  - o portão da fase 2 no diagrama cita "testes 1 a 8" e omite os testes 10 e 11;
  - o plano pede ao fundador para "criar o repositório privado", que já existe;
  - o plano não diz qual serviço de busca a ferramenta "buscar" vai usar;
  - o nome do repositório (`financeiromaxnutrition`) não reflete o projeto.

## 6) Decisões em aberto que dependem do fundador

1. **Qual é o plano único:** DBOS (`01-plano-v3.md`) ou motor no Postgres. Depois, a frase exata de aprovação.
2. **Quando trocar as chaves:** na fase 0 (recomendado) ou no fim dos testes. E se o histórico do git deve ser reescrito ou se basta trocar as chaves.
3. **Plano do Supabase:** ficar no grátis (sem backup, 500 MB) com o backup feito pelo GitHub, ou pagar o Pro.
4. **Serviço de busca da ferramenta "buscar":** o plano não define. A maioria desses serviços cobra, e a DEC-014 só fala da OpenAI.
5. **Onde o app e o gateway vão rodar:** continuar no EasyPanel (o gateway por zip hoje) ou passar o app para a Vercel. E o deploy pelo GitHub com o botão dele. O plano não cita a Vercel.
6. **Política de branches:** qual vira a `main`, e se as cerca de 30 branches antigas podem ser arquivadas.
7. **Se a cota não bastar no teste 1:** usar o GPT-6 Luna, assinar o Pro ou comprar créditos.
8. **Contas que só ele cria:** Telegram, healthchecks.io e a verificação em duas etapas.
9. **Escopo da v2:** só os 5 agentes, sem voz, ligação ou visual? E o que continua na v1 até a troca.
10. **Tabela de leis:** quem valida o conteúdo, e se um advogado revisa.
11. **Regra 4 e a E5:** aceitar que a Clara, que é autora da E4, revise o relatório final, conferindo só a fidelidade às entregas e a linguagem.