# Auditoria — 10/10/2026


Auditoria do trabalho feito pelo Claude Code nesta sessão (09 e 10/10/2026), só leitura. A única escrita foi este arquivo.

- **Base confiável:** `missao-cumprida-v4` em `417468f` (09/10 20:23, "docs: passagem de contexto para outro Claude Code"). Conferido: a base não mudou desde o clone.
- **Ramo auditado:** `claude/gallant-cray-xrdt0t` em `737415d`, mais 1 arquivo alterado e não commitado (`helena-v2/test_validar.py`).
- **Ramos que eu criei:** só `claude/gallant-cray-xrdt0t`. As duas cópias de trabalho em `/tmp/.../scratchpad/` são locais e sem ramo. `preview/helena-sem-login` e `voz-eliving-v4` apareceram no GitHub, mas **não são meus**.

## Resumo

{RESUMO}

## 1. O que comparei

| Comando | Resultado |
|---|---|
| `git fetch --all` | feito |
| `git merge-base 417468f HEAD` | `05e4efb` (06/10). **O meu ramo nasceu da `main`, não da base.** |
| `git log HEAD..417468f` | **44 commits da base que o meu ramo não tem** (consertos do ciclo, fichas v2, `HANDOFF-CLAUDE-CODE.md`, `docs/PLANO-HELENA-V3.md`) |
| `git log 417468f..HEAD` | 23 commits: **20 meus** + 3 da `main` (voz, de outra pessoa) |
| `git diff --stat 417468f HEAD` | 545 arquivos: 456 novos, 37 "removidos", 52 "diferentes" |
| `git diff --stat origin/main HEAD` (só o meu) | **470 arquivos, todos novos.** Não apaguei nem alterei nenhum arquivo que já existia na `main`. |
| `git status` | 1 arquivo alterado e não commitado: `helena-v2/test_validar.py` |

**Como ler os 37 "removidos" e os 52 "diferentes":** 79 deles **não são obra minha**. São a diferença entre a `main` (de onde o meu ramo nasceu) e a base. Só 10 são meus: arquivos da `helena-v2/` que existiam na base (v2 antiga) e que eu reescrevi para a v3.1 (4 fichas, 3 esquemas, `models.yaml`, `validar.py` e `test_validar.py`). Listas completas no Anexo C.

**De onde veio o pacote do plano:** `01-plano-v3.md`, `02-registro-de-furos.md`, `LEIA-PRIMEIRO.md`, `historico/`, `diagramas/` e `pesquisa/` são **cópias sem mudança** do ramo `antigravity-planos` (conferido com `git diff`). Eu só acrescentei `pesquisa/rodada-5/`. Em `helena-v2/`, `agents/ravi.yaml`, `playbooks/`, `README.md` e `deliverables/entregas.yaml` são **iguais aos da base**.

**Consequência para a organização:** o ramo novo tem de nascer da base e receber **só** o que eu fiz, sem trazer os 3 commits de voz da `main`.

## 2. Divergência do plano (precisa da sua decisão)

Você indicou `docs/PLANO-HELENA-V3.md` como fonte da verdade e listou o DBOS como motor. Esses dois pontos não batem:

| Ponto | `docs/PLANO-HELENA-V3.md` (base, 10 mil caracteres) | `01-plano-v3.md` do pacote (67 mil caracteres) |
|---|---|---|
| Motor | "Motor no Postgres". **Não cita o DBOS.** | **DBOS** |
| Furos fechados | 37 | 171 |
| Modelo reserva | **tem** (furo 17) | **proibido** (no Hermes, reserva configurado já fica ligado) |
| Avaliação do fundador | 👍/👎 | botões Aprovar / Pedir ajuste / Usar como exemplo / Cancelar |
| De onde veio | base `missao-cumprida-v4` | ramo `antigravity-planos`, trazido por mim |

Os dois se chamam "plano v3". Esta auditoria usou os **critérios que você listou** (DBOS, nenhum agente grava no banco, publicar só com o seu toque, sem API paga, sem segredo no código). Onde os dois planos discordam, marquei DIVERGENTE. **Proposta:** o plano com DBOS vira `docs/plano/PLANO-HELENA-V3.md`, e o atual vai para `docs/arquivo/planos/` como "versão motor no Postgres". Só faço isso com o seu ok.

## 3. Vereditos

### 3.1 Por grupo de arquivos

| # | Arquivos | Qtd | Veredito | Motivo | Destino proposto |
|---|---|---|---|---|---|
| 1 | `docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md` | 1 | **DESCARTAR** | substituída pelo validar.py v3.1 | docs/arquivo/sessao-20261010/ |
| 2 | `docs/AGENTES-SISTEMA-HELENA.md` | 1 | **MANTER** | igual ao da base (não é mudança real) | docs/manual/agentes-v1.md |
| 3 | `pacote: 01-plano-v3.md (plano com DBOS)` | 1 | **MANTER** | único plano com DBOS; precisa da sua decisão sobre qual plano vale | docs/plano/PLANO-HELENA-V3.md (se você aprovar) |
| 4 | `pacote: 02-registro-de-furos.md` | 1 | **MANTER** | registro dos 171 furos do plano DBOS | docs/plano/REGISTRO-DE-FUROS.md |
| 5 | `pacote: 03-analise-especialistas.md` | 1 | **DESCARTAR** | recomenda tirar o DBOS (MEL-20): contradiz o plano e a sua decisão | docs/arquivo/sessao-20261010/ |
| 6 | `pacote: 04-critica-da-analise.md` | 1 | **DESCARTAR** | crítica do 03; vai junto com ele | docs/arquivo/sessao-20261010/ |
| 7 | `pacote: DECISOES-DO-FUNDADOR-20261010.md` | 1 | **CORRIGIR** | conteúdo certo; 4 decisões num arquivo só | docs/decisoes/ (um arquivo por decisão) |
| 8 | `pacote: LEIA-PRIMEIRO.md` | 1 | **DESCARTAR** | passagem da conta antiga; substituída pelo HANDOFF | docs/arquivo/pacote-plano-v3/ |
| 9 | `pacote: diagramas/*.jsx` | 3 | **DESCARTAR** | código de desenho do documento antigo; ninguém usa | docs/arquivo/pacote-plano-v3/diagramas/ |
| 10 | `pacote: historico/ (planos rev80, rev90, rev105)` | 3 | **MANTER** | planos antigos, só consulta | docs/arquivo/pacote-plano-v3/historico/ |
| 11 | `pacote: pesquisa/rodada-5/` | 3 | **DESCARTAR** | cópia em JSON da análise 03 e fotografia do estado | docs/arquivo/sessao-20261010/pesquisa-rodada-5/ |
| 12 | `pacote: pesquisa/ (ataques A, B, C e verificação)` | 8 | **MANTER** | evidências que sustentam o plano DBOS (consulta) | docs/arquivo/pacote-plano-v3/pesquisa/ |
| 13 | `pacote: relatorios-de-etapas/` | 5 | **DESCARTAR** | registros brutos dos agentes (1,6 MB) | docs/arquivo/sessao-20261010/relatorios-de-etapas/ |
| 14 | `pacote: roteiros-de-agentes/` | 3 | **DESCARTAR** | roteiros que usei para comandar agentes; não são do sistema | docs/arquivo/sessao-20261010/roteiros-de-agentes/ |
| 15 | `pacote: v3.1-secoes/` | 20 | **DESCARTAR** | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas | docs/arquivo/sessao-20261010/v3.1-secoes/ |
| 16 | `HANDOFF-CONTINUAR-V31.md` | 1 | **CORRIGIR** | estado útil, mas fora do lugar | juntar ao HANDOFF-CLAUDE-CODE.md; original para docs/arquivo/ |
| 17 | `helena-v2/maquina/` | 5 | **MANTER** | tabela de passagens + prova das 13 regras + testes | helena-v2/maquina/ |
| 18 | `helena-v2/schemas/` | 6 | **MANTER** | formatos v3.1 (ficha, entrega, ação, card, roteiro) | helena-v2/schemas/ |
| 19 | `helena-v2/servicos.yaml e organograma.yaml` | 2 | **MANTER** | catálogo dos 21; mudanças de papel (Marina, Bruno) pedem o seu ok | helena-v2/ |
| 20 | `helena-v2/models.yaml` | 1 | **MANTER** | sem modelo reserva (plano DBOS); diverge do plano da base | helena-v2/ |
| 21 | `helena-v2/agents/ravi.yaml` | 1 | **MANTER** | ficha antiga da base, sem mudança; falta reescrever | helena-v2/agents/ |
| 22 | `helena-v2/agents/ (7 fichas v3.1)` | 7 | **MANTER** | fichas v3.1 aceitas pelo validador | helena-v2/agents/ |
| 23 | `helena-v2/deliverables/entregas.yaml` | 1 | **DESCARTAR** | índice antigo da v1, substituído por um arquivo por tipo | docs/arquivo/helena-v2-v1/ |
| 24 | `helena-v2/deliverables/ copy, roteiro_treinamento, perfil_de_funcao` | 3 | **CORRIGIR** | faltam os casos (Isabela) ou a ficha (Bianca) | helena-v2/deliverables/ |
| 25 | `helena-v2/deliverables/ (6 tipos completos)` | 6 | **MANTER** | formato de entrega v3.1 com casos | helena-v2/deliverables/ |
| 26 | `helena-v2/casos/ (6 serviços)` | 204 | **MANTER** | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código | helena-v2/casos/ |
| 27 | `helena-v2/playbooks/recrutar-10-pessoas.yaml` | 1 | **CORRIGIR** | roteiro antigo da base, sem mudança; reescrever para v3.1 | helena-v2/playbooks/ |
| 28 | `helena-v2/validar.py e test_validar.py` | 2 | **CORRIGIR** | reescritos para v3.1; 4 testes frágeis (conserto pronto, não commitado) | helena-v2/ |
| 29 | `helena-v2/README.md` | 1 | **CORRIGIR** | igual ao da base; descreve a estrutura antiga | helena-v2/ |
| 30 | `motor/ferramentas/` | 36 | **MANTER** | servidor de ferramentas seguro | motor/ferramentas/ |
| 31 | `motor/validador/` | 64 | **CORRIGIR** | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código | motor/validador/ |
| 32 | `motor/executor/` | 50 | **CORRIGIR** | sem README; 2 testes falham com a ficha nova da Isabela; suposições sobre o Hermes não confirmadas | motor/executor/ |
| 33 | `motor/simulador/` | 26 | **CORRIGIR** | cópia do vocabulário e 2ª implementação das regras do card | motor/simulador/ |
| 34 | `helena-v2/test_validar.py` (não commitado) | 1 | **CORRIGIR** | conserto de 4 testes frágeis, já aplicado no disco | helena-v2/ |

**Totais:** 34 grupos: **14 MANTER, 10 CORRIGIR, 10 DESCARTAR**. Em arquivos: **282 MANTER, 150 CORRIGIR (149 + o não commitado), 39 DESCARTAR**.

### 3.2 Por commit (os 20 meus)

| Commit | Quando | Mensagem |
|---|---|---|
| `737415d` | 10/10 19:07 | feat(helena-v2): Clara completa (casos e jornadas do SRV-PARECER) e ficha v3.1 da Isabela |
| `1f18480` | 10/10 18:53 | docs: salva os relatorios completos das etapas e o inventario do que ja esta construido |
| `17f0ec1` | 10/10 18:49 | feat: fecha a etapa 1 da continuacao (validador v3.1, testes do simulador, secoes 01-08 do plano corrigidas) |
| `b0507ed` | 10/10 18:42 | wip: continuacao etapa 1 (validador, executor, simulador, secoes do plano) |
| `2d955cb` | 10/10 17:15 | wip(motor): conserto do executor em andamento (etapa 1 da continuacao) |
| `ab1e3f2` | 10/10 17:05 | docs: separa por secao os furos apontados no plano v3.1 |
| `20115cc` | 10/10 17:04 | docs: passagem de contexto para continuar o v3.1 + 11 secoes do plano e 348 furos apontados |
| `1ba977d` | 10/10 16:55 | wip: salva o estado depois do limite de uso (executor, simulador, ficha e entrega da Bianca) |
| `3899efa` | 10/10 12:47 | wip: atualiza fichas e casos em andamento |
| `d38c046` | 10/10 12:47 | wip(motor): executor (testes de falha, uso, conferencia) e simulador da esteira |
| `febb89a` | 10/10 12:45 | wip: fichas e casos dos primeiros agentes + pecas A do motor (ferramentas, validador) |
| `f24e1ce` | 10/10 11:32 | wip(helena-v2): contratos e catalogo dos 21 agentes (esquemas v3.1, organograma, servicos, modelos) |
| `d9e70bb` | 10/10 10:05 | wip(helena-v2): fotografia intermediaria da maquina de passagens (conserto em andamento) |
| `6fd3144` | 10/10 10:04 | docs: registra as decisoes do fundador de 10/10/2026 (motor DBOS, chaves no fim dos testes, desligar central da v1, codigos das empresas) |
| `8e6755c` | 10/10 09:51 | wip(helena-v2): fotografia intermediaria da rodada dos 21 agentes |
| `e7755e5` | 10/10 09:45 | wip(helena-v2): fotografia intermediaria da rodada dos 21 agentes |
| `41753a0` | 10/10 09:41 | wip(helena-v2): maquina de passagens em construcao (tabela, prova e testes) |
| `bf8a88f` | 10/10 07:00 | docs: analise dos especialistas (Vercel, GitHub, agentes, organizacao) e critica de completude |
| `2782876` | 10/10 01:19 | chore: traz o pacote do plano v3 (DBOS), as especificacoes helena-v2 e o contrato dos 21 agentes para esta branch |
| `6d0567f` | 10/10 00:24 | docs: conferencia das especificacoes da v2 contra o plano v3 (DBOS) |

Vários commits são "wip" (fotografias intermediárias) feitos a pedido do vigia de envio. **Sugestão:** no ramo novo, um commit por assunto, em vez de repetir esse histórico.

### 3.3 O que precisa de correção, em detalhe

1. **`helena-v2/test_validar.py`:** o commit `737415d` deixou **4 testes falhando**. Eles tinham números fixos ("16 de 21 fichas", "a Clara ainda não tem casos") e quebram cada vez que um agente fica pronto. O conserto já está no disco e **não foi commitado**: os testes passam a calcular a partir dos dados, e o teste da Clara virou um teste de mutação. Com ele: 168 passam.
2. **`helena-v2/validar.py`:** sai **vermelho de propósito** por 6 pendências reais: 14 fichas faltando, o roteiro das 10 pessoas ainda da v1, e os casos da Isabela (copy e roteiro de treinamento). Isso choca com a regra "tudo precisa passar". **Decisão sua:** (a) manter vermelho até as 21 fichas existirem, ou (b) separar "pendência conhecida" (aviso, saída 0) de "erro novo" (saída 1), com a lista de pendências num arquivo versionado.
3. **`motor/validador/`:** funciona (677 testes), mas **não está ligado à especificação**. As entregas citam 106 IDs de checagem (CHK-...), e o código implementa 28, com só 3 em comum. Os "defeitos plantados" dos casos ainda não são conferidos pelo código.
4. **`motor/simulador/`:** tem uma **segunda cópia** dos nomes da máquina (`vocabulario.py`, vigiada por um teste) e uma **segunda implementação** das regras do card (`referencia.py`, 693 linhas). Duas fontes da verdade para a mesma lógica é o padrão que travou a v1. O certo é usar só `helena-v2/maquina/`.
5. **`motor/executor/`:** **2 testes falham** (`test_ficha.py::test_fichas_reais_da_v2_continuam_legiveis` e `test_teste3.py::...[isabela]`). Eles leem as fichas reais da `helena-v2`, e a ficha nova da Isabela tem dois serviços; o executor exige que se diga qual (`servico=...`), e o teste não diz. **Sem README**. As suposições sobre o Hermes real (opções da linha de comando, nomes das chaves de configuração) **não foram confirmadas** e só ficam nos relatórios.
6. **`helena-v2/README.md`:** descreve a estrutura antiga.
7. **`HANDOFF-CONTINUAR-V31.md`:** está fora do lugar; deve entrar no `HANDOFF-CLAUDE-CODE.md`.
8. **`DECISOES-DO-FUNDADOR-20261010.md`:** tem 4 decisões num arquivo só; deve virar um arquivo por decisão.

## 4. Conferência contra o plano (os seus critérios)

| Critério | Resultado no que eu fiz |
|---|---|
| Motor que não seja o DBOS | **`03-analise-especialistas.md` recomenda tirar o DBOS (MEL-20)** → DESCARTAR. O código e as fichas são neutros quanto ao motor. |
| Agente que grava no banco | **Nenhum.** O único SQL do meu código é o "Hermes de mentira" dos testes, que grava num arquivo SQLite local temporário (imitação do Hermes), e não no Supabase. Ferramentas dos agentes: só leitura. |
| Publicação sem o toque do fundador | **Nenhuma.** Nada no meu código publica, faz deploy ou dá push. |
| API paga da OpenAI | **Nenhuma chamada.** O executor usa um servidor falso local nos testes. |
| Segredo no código | **Nenhum valor real** (seção 6). |
| Divergências entre os dois planos | `models.yaml` sem reserva e card sem 👍/👎 seguem o plano DBOS e **divergem** do `docs/PLANO-HELENA-V3.md` da base. |

## 5. Verificações (antes = base `417468f`, depois = meu ramo)

{VERIFICACOES}

## 6. Segredos (só nomes de arquivo, nunca valores)

Procurei em todos os 471 arquivos que eu criei ou mudei: `service_role`, `sb_secret_`, `eyJ`, `sk-`, `ghp_`, `senha=`, `token=` e arquivos `.env`.

**Resultado: nenhum valor real de chave.** O que apareceu:

| Padrão | Arquivos | O que é |
|---|---|---|
| `service_role` | 17 (planos, pesquisa, relatórios, `motor/ferramentas/testes/test_stdio.py`) | só a palavra (nome do papel), sem valor ao lado |
| `sb_secret_` | 2 (`pesquisa/rodada-5/melhorias-verificadas.json`, `relatorios-de-etapas/01-analise-especialistas.json`) | só o nome do formato |
| `eyJ` | 12 (`HANDOFF-CONTINUAR-V31.md`, `helena-v2/validar.py`, `helena-v2/test_validar.py`, `motor/executor/executor_helena/segredos.py`, testes do executor, ferramentas e validador, 2 de pesquisa, 2 de relatório) | o prefixo citado, ou um texto falso que não decodifica, usado de propósito nos testes |
| `sk-` | 14 (testes do executor, `segredos.py`, `validar.py`, pesquisa e relatório) | exemplos falsos de propósito |
| `ghp_` | 5 (testes do executor, ferramentas e validador) | exemplos falsos de propósito |
| `token=` | 3 (`motor/ferramentas/testes/test_enderecos.py`, `test_leitor.py`, `test_rede.py`) | parâmetro vazio ou de exemplo em endereço de teste |
| `senha=` | 0 | — |
| arquivos `.env` | 0 criados | — |

**Fora do que eu fiz (já existia na base, para você saber):** 9 arquivos de `scripts/` e `services/helena-gateway/dev-server.mjs` têm a **chave de acesso total** escrita. Isso já era conhecido, e a troca foi adiada para o fim dos testes por decisão sua.

## 7. Achados na base que não são meus, mas afetam a organização

1. **`services/helena-gateway/test/test-server.mjs` faz um pedido real ao Supabase de produção** (`/auth/v1/oauth/clients/register`, que cadastra um cliente). Por isso **não rodei o `npm test` completo do gateway**. Proposta: tirar esse arquivo do `npm test` e deixá-lo como teste manual, com o seu ok.
2. **`.env.example` tem valores** (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` preenchidos). Você quer só os nomes.
3. **Duplicados:** `KOKORO_TTS_DOCUMENTACAO_OFICIAL.md` existe igual na raiz e em `docs/`. `docs/CONTINUIDADE-HELENA-20261001.zip` repete 9 arquivos que já estão soltos em `docs/`.
4. **Código que lê documentos pelo caminho** (não mover sem mudar o código): `docs/helena/**` (100 arquivos, lidos por scripts e testes do gateway); `docs/CHECKPOINT-MESTRE-20261004.md` (escrito por `scripts/publicar-checkpoint-v035.mjs`); `artifacts/` e `screenshots/` (usados pelos scripts de empacotamento).
5. **Dois gerenciadores de pacotes** na raiz (`bun.lockb` e `package-lock.json`). Não mexo; só anoto.
6. **A suíte de testes da máquina é lenta** ({TEMPO_MAQUINA}). Testes lentos não são rodados, e teste que não roda não protege.

## 8. Parte 2 — proposta de organização (espera o seu "pode organizar")

### 8.1 Forma final

```
README.md                  o que é, como rodar, onde está cada coisa
AGENTS.md                  regras do projeto (caminhos atualizados)
HANDOFF-CLAUDE-CODE.md     regras e estado para quem mantém
.env.example               só nomes de variáveis
docs/
  INDICE.md                uma linha por arquivo: o que é e a data
  plano/                   PLANO-HELENA-V3.md (o único) + REGISTRO-DE-FUROS.md
  decisoes/                um arquivo por decisão (DEC-xxx)
  manual/                  guias em vigor (voz, eLiving, integrações, troca de chaves, comando mestre)
  ideias/                  ideias e anotações de aula, com data (começa vazia)
  arquivo/                 tudo o que é antigo ou descartado, com o motivo
  auditoria/               as auditorias
  helena/                  FICA: dados lidos pelo código
helena-v2/                 fichas, roteiros, regras, validador e testes
motor/                     ferramentas, validador, executor, simulador (testes ao lado)
src/ services/ supabase/ scripts/ public/   como estão (não movo código)
artifacts/ screenshots/    ficam (scripts usam)
```

### 8.2 O que vem do meu ramo para o ramo novo

| Item | Ação |
|---|---|
| `helena-v2/` (máquina, esquemas, catálogo, 7 fichas, entregas, casos, validador) | **trazer** como está + o conserto dos 4 testes |
| `motor/ferramentas`, `motor/validador`, `motor/executor`, `motor/simulador` | **trazer** como estão (as correções 3 a 5 da seção 3.3 são desenvolvimento, e ficam na lista de pendências, não nesta organização) |
| `01-plano-v3.md` (DBOS) | `docs/plano/PLANO-HELENA-V3.md` **se você aprovar** |
| `02-registro-de-furos.md` | `docs/plano/REGISTRO-DE-FUROS.md` |
| Decisões de 10/10 (4) | `docs/decisoes/` um arquivo cada. Número provisório **DEC-026 a DEC-029**: o Supabase é a fonte, e confirmo lá (só leitura) que os números estão livres |
| `HANDOFF-CONTINUAR-V31.md` | juntar ao `HANDOFF-CLAUDE-CODE.md`; o original vai para `docs/arquivo/` |
| Os 10 grupos DESCARTAR (seção 3.1) | `docs/arquivo/sessao-20261010/` ou `docs/arquivo/pacote-plano-v3/`, com uma linha de motivo em `docs/arquivo/LEIA.md` |
| `pesquisa/` e `historico/` do pacote | `docs/arquivo/pacote-plano-v3/` |

### 8.3 O que muda nos arquivos da base

| Origem (base) | Destino | Ação | Motivo |
|---|---|---|---|
| `README.md` | `README.md` | CORRIGIR | reescrever: o que é o sistema, como rodar e onde está cada coisa |
| `AGENTS.md` | `AGENTS.md` | CORRIGIR | fica; só atualizar os caminhos dos documentos que mudam de lugar |
| `HANDOFF-CLAUDE-CODE.md` | `HANDOFF-CLAUDE-CODE.md` | CORRIGIR | fica; juntar o estado atual (vem do HANDOFF-CONTINUAR-V31.md) |
| `DESIGN_PREMIUM.md` | `docs/manual/design-premium.md` | MOVER | guia de design do app |
| `KOKORO_TTS_DOCUMENTACAO_OFICIAL.md` | `docs/arquivo/duplicados/kokoro-tts-documentacao-oficial.md` | ARQUIVAR | cópia idêntica de docs/KOKORO_TTS_DOCUMENTACAO_OFICIAL.md |
| `RESUMO_PARA_HELENA.md` | `docs/arquivo/relatorios/resumo-para-helena.md` | ARQUIVAR | relatório antigo |
| `.env.example` | `.env.example` | CORRIGIR | tirar os valores; deixar só os nomes (e incluir os do gateway e dos scripts) |
| `RELATORIO_CENTRAL_EXECUCAO_HELENA.md` | `docs/arquivo/relatorios/relatorio-central-execucao-helena.md` | ARQUIVAR | relatório antigo |
| `RELATORIO_CONVERGENCIA_SISTEMA_HELENA.md` | `docs/arquivo/relatorios/relatorio-convergencia-sistema-helena.md` | ARQUIVAR | relatório antigo |
| `RELATORIO_FINAL_HOMOLOGACAO_HELENA.md` | `docs/arquivo/relatorios/relatorio-final-homologacao-helena.md` | ARQUIVAR | relatório antigo |
| `RELATORIO_FINAL_REFINAMENTO_EXECUTIVO_HELENA.md` | `docs/arquivo/relatorios/relatorio-final-refinamento-executivo-helena.md` | ARQUIVAR | relatório antigo |
| `RELATORIO_HELENA_MULTIEMPRESA.md` | `docs/arquivo/relatorios/relatorio-helena-multiempresa.md` | ARQUIVAR | relatório antigo |
| `docs/AGENTES-SISTEMA-HELENA.md` | `docs/manual/agentes-v1.md` | MOVER | contrato dos 21 agentes da v1 (que está no ar) |
| `docs/AUDIO-ROUTING.md` | `docs/manual/voz/audio-routing.md` | MOVER | guia técnico de voz |
| `docs/AUDITORIA-INICIAL.md` | `docs/auditoria/AUDITORIA-2026-09-29.md` | MOVER | é uma auditoria |
| `docs/BRIEFING-VIGENTE-HELENA-20261001.md` | `docs/arquivo/v1/briefing-vigente-helena-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/CALL-TTS-GOOGLE-CHIRP3-HD.md` | `docs/manual/voz/call-tts-google-chirp3-hd.md` | MOVER | guia técnico de voz |
| `docs/CALL-TTS-VOICE-MANAGEMENT.md` | `docs/manual/voz/call-tts-voice-management.md` | MOVER | guia técnico de voz |
| `docs/CHECKPOINT-MESTRE-20261001.md` | `docs/arquivo/checkpoints/checkpoint-mestre-20261001.md` | ARQUIVAR | checkpoint antigo (o vigente fica no Supabase) |
| `docs/CHECKPOINT-MESTRE-20261001.snapshot.json` | `docs/arquivo/checkpoints/checkpoint-mestre-20261001.snapshot.json` | ARQUIVAR | checkpoint antigo (o vigente fica no Supabase) |
| `docs/CHECKPOINT-MESTRE-20261004.md` | `docs/CHECKPOINT-MESTRE-20261004.md` | FICA | o script scripts/publicar-checkpoint-v035.mjs usa este caminho |
| `docs/CHECKPOINT-MESTRE-20261007.md` | `docs/arquivo/checkpoints/checkpoint-mestre-20261007.md` | ARQUIVAR | checkpoint antigo (o vigente fica no Supabase) |
| `docs/COMANDO-MASTER-ELIVING.md` | `docs/manual/eliving/comando-master-eliving.md` | MOVER | regras da marca eLiving em vigor (atualizar AGENTS.md) |
| `docs/COMANDO-MASTER-MISSAO-CUMPRIDA.md` | `docs/manual/diretriz-missao-cumprida.md` | MOVER | diretriz de operação da v1 em vigor |
| `docs/COMANDO-MESTRE.txt` | `docs/manual/comando-mestre.txt` | MOVER | procedimento de carregamento (atualizar AGENTS.md) |
| `docs/COMANDO-RETOMADA-HELENA-20261001.txt` | `docs/arquivo/v1/comando-retomada-helena-20261001.txt` | ARQUIVAR | registro da v1, datado |
| `docs/COMANDO-REVISAO-COPY-20261002.txt` | `docs/arquivo/v1/comando-revisao-copy-20261002.txt` | ARQUIVAR | registro da v1, datado |
| `docs/COMPROVANTE-TRAVA-21-PERFIS-20261002.jpg` | `docs/arquivo/v1/evidencias/comprovante-trava-21-perfis-20261002.jpg` | ARQUIVAR | recibo/evidência da v1 |
| `docs/CONTEXTO-LOCAL.md` | `docs/arquivo/v1/contexto-local.md` | ARQUIVAR | registro da v1, datado |
| `docs/CONTINUIDADE-HELENA-20261001.zip` | `docs/arquivo/duplicados/continuidade-helena-20261001.zip` | ARQUIVAR | zip com 9 arquivos que já existem soltos |
| `docs/EVIDENCIAS-RESUMIDAS.json` | `docs/arquivo/v1/evidencias/evidencias-resumidas.json` | ARQUIVAR | recibo/evidência da v1 |
| `docs/GOOGLE-INSTANT-CUSTOM-VOICE.md` | `docs/manual/voz/google-instant-custom-voice.md` | MOVER | guia técnico de voz |
| `docs/KOKORO_TTS_DOCUMENTACAO_OFICIAL.md` | `docs/manual/voz/kokoro-tts-documentacao-oficial.md` | MOVER | guia técnico de voz |
| `docs/LEIA-PRIMEIRO-CONTINUIDADE-HELENA-20261001.md` | `docs/arquivo/v1/leia-primeiro-continuidade-helena-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/MANUAL-DE-COMPORTAMENTO-AGENTES-ELIVING.md` | `docs/manual/eliving/manual-de-comportamento-agentes-eliving.md` | MOVER | regras da marca eLiving em vigor (atualizar AGENTS.md) |
| `docs/PLANO-ARQUITETURA-V2.md` | `docs/arquivo/planos/plano-arquitetura-v2.md` | ARQUIVAR | plano antigo |
| `docs/PLANO-DESTRAVAR-AGENTES-20261006.md` | `docs/arquivo/planos/plano-destravar-agentes-20261006.md` | ARQUIVAR | plano antigo |
| `docs/PLANO-HELENA-V3.md` | `docs/plano/PLANO-HELENA-V3.md  OU  docs/arquivo/planos/plano-helena-v3-motor-postgres.md` | DECISÃO SUA | é o plano da base (motor no Postgres); o plano com DBOS é outro arquivo |
| `docs/PLANO-SISTEMA-100-20261007.md` | `docs/arquivo/planos/plano-sistema-100-20261007.md` | ARQUIVAR | plano antigo |
| `docs/RECIBO-AUTORIDADE-AGENTES-20261002.json` | `docs/arquivo/v1/evidencias/recibo-autoridade-agentes-20261002.json` | ARQUIVAR | recibo/evidência da v1 |
| `docs/RECIBO-CHECKPOINT-MESTRE-20261001.json` | `docs/arquivo/v1/evidencias/recibo-checkpoint-mestre-20261001.json` | ARQUIVAR | recibo/evidência da v1 |
| `docs/RECIBO-POLITICA-EDITORIAL-20261002.json` | `docs/arquivo/v1/evidencias/recibo-politica-editorial-20261002.json` | ARQUIVAR | recibo/evidência da v1 |
| `docs/RECIBO-TRAVA-LIMITES-20261002.json` | `docs/arquivo/v1/evidencias/recibo-trava-limites-20261002.json` | ARQUIVAR | recibo/evidência da v1 |
| `docs/SECRETS.md` | `docs/manual/troca-de-chaves.md` | MOVER | roteiro de troca e de volta de chaves (sem valores) |
| `docs/SKILLS-HELENA-20261001.json` | `docs/arquivo/v1/skills-helena-20261001.json` | ARQUIVAR | registro da v1, datado |
| `docs/TRAVA-LIMITES-AGENTES-20261002.md` | `docs/arquivo/v1/trava-limites-agentes-20261002.md` | ARQUIVAR | registro da v1, datado |
| `docs/VALIDACAO-INTEGRACAO-20260929.md` | `docs/arquivo/v1/validacao-integracao-20260929.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-ativacao-20260930.md` | `docs/arquivo/v1/helena-ativacao-20260930.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-autonomia-duravel-20261001.md` | `docs/arquivo/v1/helena-autonomia-duravel-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-autonomia-operacional-20261001.md` | `docs/arquivo/v1/helena-autonomia-operacional-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-ciclo-real-20261001.md` | `docs/arquivo/v1/helena-ciclo-real-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-comando-consolidacao-20261001.md` | `docs/arquivo/v1/helena-comando-consolidacao-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-comando-inspecao-20261001.md` | `docs/arquivo/v1/helena-comando-inspecao-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-comando-pacote-final-20261001.md` | `docs/arquivo/v1/helena-comando-pacote-final-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-comando-revisao-criativa-20260930.md` | `docs/arquivo/v1/helena-comando-revisao-criativa-20260930.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-continuidade-agentes-20261001.md` | `docs/arquivo/v1/helena-continuidade-agentes-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-diagnostico-fila-20261001.md` | `docs/arquivo/v1/helena-diagnostico-fila-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-entrega-final-e-etapas-internas-20261001.md` | `docs/arquivo/v1/helena-entrega-final-e-etapas-internas-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-fluxo-padrao-agentes-20261001.md` | `docs/arquivo/v1/helena-fluxo-padrao-agentes-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-handoff-limite-20261001.md` | `docs/arquivo/v1/helena-handoff-limite-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-inspecao-independente-20261001.md` | `docs/arquivo/v1/helena-inspecao-independente-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-operacao-20260930.md` | `docs/arquivo/v1/helena-operacao-20260930.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-orquestracao-duravel-pesquisa-20261001.md` | `docs/arquivo/v1/helena-orquestracao-duravel-pesquisa-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-parecer-nina-20261001.md` | `docs/arquivo/v1/helena-parecer-nina-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-politica-modelos-sol61-20261001.md` | `docs/arquivo/v1/helena-politica-modelos-sol61-20261001.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-proximo-despacho-20260930.md` | `docs/arquivo/v1/helena-proximo-despacho-20260930.md` | ARQUIVAR | registro da v1, datado |
| `docs/helena-r2-20260930.md` | `docs/arquivo/v1/helena-r2-20260930.md` | ARQUIVAR | registro da v1, datado |
| `docs/padrao-criativo-multiempresa.md` | `docs/manual/padrao-criativo-multiempresa.md` | MOVER | padrão de criação de conteúdo |
| `docs/integrations/ (6)` | `docs/manual/integracoes/` | MOVER | guias das integrações (ElevenLabs, Evolution, Laya, MeowCaller) |
| `docs/helena/ (100)` | `docs/helena/` | FICA | scripts e testes do gateway leem estes arquivos pelo caminho |
| `artifacts/ e screenshots/` | `(ficam na raiz)` | FICA | scripts de empacotamento usam estes caminhos |

**Totais na base:** 48 arquivar, 15 mover para `docs/manual`, `docs/auditoria` ou `docs/plano`, 4 corrigir, 3 ficam, 1 depende de você.

### 8.4 O que eu NÃO vou fazer na organização

- Não movo código (`src/`, `services/`, `supabase/`, `scripts/`, `motor/`).
- Não renomeio arquivos lidos por código (`docs/helena/**`, os tipos em `helena-v2/deliverables/*.yaml` que usam `_`).
- Não escrevo conteúdo novo de manual. O **manual do mantenedor** e os roteiros de **restauração** e **publicação** ainda não existem, e ficam como pendência (não vou inventar).
- Não toco em banco, servidor, Supabase, EasyPanel ou publicação.

### 8.5 Decisões que preciso de você antes de organizar

1. Qual é o plano: o com **DBOS** (recomendo) ou o da base (motor no Postgres)?
2. `validar.py`: manter vermelho até as 21 fichas, ou separar pendência conhecida de erro novo (recomendo separar)?
3. Tirar o `test-server.mjs` do `npm test` do gateway (recomendo)?
4. Números provisórios DEC-026 a DEC-029 para as decisões de 10/10?

## Anexo A — commits meus

Ver a seção 3.2.

## Anexo B — todos os 470 arquivos que criei, com o veredito

| Arquivo | Veredito | Motivo |
|---|---|---|
| `HANDOFF-CONTINUAR-V31.md` | CORRIGIR | estado útil, mas fora do lugar |
| `docs/AGENTES-SISTEMA-HELENA.md` | MANTER | igual ao da base (não é mudança real) |
| `docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md` | DESCARTAR | substituída pelo validar.py v3.1 |
| `docs/planos/sistema-helena-pacote/01-plano-v3.md` | MANTER | único plano com DBOS; precisa da sua decisão sobre qual plano vale |
| `docs/planos/sistema-helena-pacote/02-registro-de-furos.md` | MANTER | registro dos 171 furos do plano DBOS |
| `docs/planos/sistema-helena-pacote/03-analise-especialistas.md` | DESCARTAR | recomenda tirar o DBOS (MEL-20): contradiz o plano e a sua decisão |
| `docs/planos/sistema-helena-pacote/04-critica-da-analise.md` | DESCARTAR | crítica do 03; vai junto com ele |
| `docs/planos/sistema-helena-pacote/DECISOES-DO-FUNDADOR-20261010.md` | CORRIGIR | conteúdo certo; 4 decisões num arquivo só |
| `docs/planos/sistema-helena-pacote/LEIA-PRIMEIRO.md` | DESCARTAR | passagem da conta antiga; substituída pelo HANDOFF |
| `docs/planos/sistema-helena-pacote/diagramas/arquitetura.jsx` | DESCARTAR | código de desenho do documento antigo; ninguém usa |
| `docs/planos/sistema-helena-pacote/diagramas/card-v3.jsx` | DESCARTAR | código de desenho do documento antigo; ninguém usa |
| `docs/planos/sistema-helena-pacote/diagramas/fases.jsx` | DESCARTAR | código de desenho do documento antigo; ninguém usa |
| `docs/planos/sistema-helena-pacote/historico/documento-completo-rev105.md` | MANTER | planos antigos, só consulta |
| `docs/planos/sistema-helena-pacote/historico/plano-rev80.md` | MANTER | planos antigos, só consulta |
| `docs/planos/sistema-helena-pacote/historico/plano-rev90.md` | MANTER | planos antigos, só consulta |
| `docs/planos/sistema-helena-pacote/pesquisa/ataque-A-ciclo-do-card.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/ataque-B-operacao-seguranca.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/ataque-B-verificacao-nas-fontes.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/ataque-C-qualidade.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/contexto-do-sistema.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/furos-conhecidos.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/minha-analise-K-M.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/revisao-fichas-resumo.md` | MANTER | evidências que sustentam o plano DBOS (consulta) |
| `docs/planos/sistema-helena-pacote/pesquisa/rodada-5/mapa-estado-atual.md` | DESCARTAR | cópia em JSON da análise 03 e fotografia do estado |
| `docs/planos/sistema-helena-pacote/pesquisa/rodada-5/melhorias-verificadas.json` | DESCARTAR | cópia em JSON da análise 03 e fotografia do estado |
| `docs/planos/sistema-helena-pacote/pesquisa/rodada-5/pesquisa-externa.json` | DESCARTAR | cópia em JSON da análise 03 e fotografia do estado |
| `docs/planos/sistema-helena-pacote/relatorios-de-etapas/01-analise-especialistas.json` | DESCARTAR | registros brutos dos agentes (1,6 MB) |
| `docs/planos/sistema-helena-pacote/relatorios-de-etapas/02-21-agentes-maquina-contratos.json` | DESCARTAR | registros brutos dos agentes (1,6 MB) |
| `docs/planos/sistema-helena-pacote/relatorios-de-etapas/03-construcao-etapa-A.json` | DESCARTAR | registros brutos dos agentes (1,6 MB) |
| `docs/planos/sistema-helena-pacote/relatorios-de-etapas/04-continuacao-etapa-1.json` | DESCARTAR | registros brutos dos agentes (1,6 MB) |
| `docs/planos/sistema-helena-pacote/relatorios-de-etapas/05-plano-v31-redacao.json` | DESCARTAR | registros brutos dos agentes (1,6 MB) |
| `docs/planos/sistema-helena-pacote/roteiros-de-agentes/21-agentes.workflow.js` | DESCARTAR | roteiros que usei para comandar agentes; não são do sistema |
| `docs/planos/sistema-helena-pacote/roteiros-de-agentes/construcao-etapa-A.workflow.js` | DESCARTAR | roteiros que usei para comandar agentes; não são do sistema |
| `docs/planos/sistema-helena-pacote/roteiros-de-agentes/plano-v31.workflow.js` | DESCARTAR | roteiros que usei para comandar agentes; não são do sistema |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/01-abertura.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/02-jornada.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/03-agente-motor.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/04-qualidade.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/05-falhas.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/06-seguranca.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/07-manutencao.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/08-equipe.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/09-treino-comando.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/10-testes-fases.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/11-anexo.md` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-apontados-por-atacantes.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/abertura.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/agente-motor.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/equipe.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/falhas.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/jornada.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/manutencao.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/qualidade.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `docs/planos/sistema-helena-pacote/v3.1-secoes/furos-por-secao/seguranca.json` | DESCARTAR | 628 mil caracteres repetidos e não conferidos; 3 seções nunca revisadas |
| `helena-v2/README.md` | CORRIGIR | igual ao da base; descreve a estrutura antiga |
| `helena-v2/agents/augusto.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/caio.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/clara.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/helena.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/isabela.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/laura.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/marina.yaml` | MANTER | fichas v3.1 aceitas pelo validador |
| `helena-v2/agents/ravi.yaml` | MANTER | ficha antiga da base, sem mudança; falta reescrever |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-01.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-02.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-03.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-04.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-05.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-06.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-07.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/boas/boa-08.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-01-matriz-incompleta.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-02-dado-sem-trecho.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-03-estimativa-como-dado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-04-conta-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-05-numero-solto.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-06-muda-se-sem-opcao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-07-validacao-sem-decisao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-08-pedido-novo-servico-errado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-09-projecao-como-fato.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-10-decide-pelo-fundador.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-11-termo-do-pacote.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-12-grafia.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-13-agiu-fora.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-14-acao-externa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-15-html.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-16-estimativa-como-fato.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-17-base-nao-sustenta.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-18-recomendacao-contra-a-comparacao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-19-opcao-espantalho.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-20-validacao-nao-mede.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-21-contato-escondido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-22-contra-o-posicionamento.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/defeitos/defeito-23-sem-criterio-de-risco.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-ANALISE-ESTRATEGICA/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/boas/boa-01.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/boas/boa-02.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/boas/boa-03.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/boas/boa-04.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/boas/boa-05.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-01-conta-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-02-mes-de-4-semanas.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-03-trecho-inventado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-04-cambio-como-premissa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-05-soma-de-moedas.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-06-cenario-muda-dado-seu.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-07-otimista-abaixo-da-base.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-08-premissa-escondida.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-09-numero-solto.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-10-certeza.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-11-conta-fiscal.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-12-previsao-como-realizado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-13-diz-que-agiu.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-14-html.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-15-acao-externa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-16-trecho-cortado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-17-entrada-calculada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-18-termo-do-pacote.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-19-formula-sem-fator.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-20-responde-outra-pergunta.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-21-unidade-trocada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-22-premissa-como-dado-de-mercado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-23-faixa-estreita.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-24-previsao-como-caixa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-25-risco-generico.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/defeitos/defeito-26-numero-no-convite.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-CALCULO/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-01-ajuste-so-no-brasil.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-02-ok-versao-2.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-03-fonte-insuficiente.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-04-nao-pode.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-05-roteiro-passo-fixo.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/boas/boa-06-falta-tabela.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-01-peca-com-versao-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-02-peca-julgada-sem-linha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-03-semaforo-do-card-errado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-04-ajuste-vazio.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-05-trecho-inventado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-06-tema-faltando.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-07-tema-sim-sem-trecho.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-08-fundamento-solto.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-09-passo-fixo-sem-linha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-10-condicao-com-acao-nova.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-11-incerto-sem-advogado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-12-obedece-a-pagina.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-13-garantia-de-conformidade.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-14-artigo-de-outra-linha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-15-citacao-da-pagina-inventada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-16-pagina-lida-pela-metade.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-17-ausencia-sem-linha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-18-ausencia-com-termo-presente.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-19-secao-a-mais.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-20-celula-grande.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-21-diz-que-agiu.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-22-acao-externa-da-clara.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-23-html.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-24-grafia-da-marca.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-25-termo-do-pacote.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-26-lei-so-mencionada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-27-sem-nota-de-jurisprudencia.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-28-link-fora-da-lista.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-29-lei-de-memoria-sem-tabela.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-30-julga-sem-ter-lido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-31-estica-o-trecho.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-32-risco-de-saude-nao-tratado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-33-ajuste-vago.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-34-tema-nao-se-aplica-que-toca.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-35-interpretacao-como-obrigacao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-36-gatilho-generico.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-37-condicao-que-abre-o-risco.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-38-jargao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-39-texto-em-ingles.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/defeitos/defeito-40-coluna-faltando.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/fitas/01-politica-parte-1.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/fitas/02-politica-parte-2.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/fitas/03-politica-fora-da-lista.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PARECER/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/boas/boa-01.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/boas/boa-02.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/boas/boa-03.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/boas/boa-04.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/boas/boa-05.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-01-trecho-inventado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-02-trecho-do-ouvinte.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-03-contagem-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-04-exercicio-sem-padrao.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-05-exercicio-longo.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-06-termo-clinico.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-07-nome-de-empresa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-08-tres-padroes.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-09-html.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-10-agiu-fora.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-11-acao-externa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-12-rotulo-de-personalidade.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-13-criterio-nao-observavel.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-14-conteudo-de-negocio.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-15-diagnostico-disfarcado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-16-padroes-menores.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-17-exercicio-depende-de-outro.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-18-medida-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/defeitos/defeito-19-promessa-de-resultado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PRATICA/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/boas/boa-01.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/boas/boa-02.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/boas/boa-03.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/boas/boa-04.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-01-data-fora-do-formato.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-02-marco-depois-da-data-final.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-03-comeca-antes-da-dependencia.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-04-trecho-inventado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-05-marco-para-item-feito.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-06-agente-como-dono.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-07-horas-acima-da-semana.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-08-folga-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-09-horas-sem-seu-trecho.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-10-primeiro-passo-em-marco-dependente.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-11-promete-lembrete.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-12-valor-em-dinheiro.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-13-termo-do-pacote.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-14-diz-que-agiu.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-15-acao-externa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-16-grafia-da-marca.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-17-html.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-18-pronto-nao-observavel.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-19-dependencia-faltando.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-20-data-final-trocada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-21-dado-como-feito.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-22-esforco-implausivel.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-23-primeiro-passo-depende-de-outro.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-24-posicionamento-errado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/defeitos/defeito-25-marco-nao-pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-PLANO-DE-PROJETO/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/boas/01-completa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/boas/02-curta.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/boas/03-com-pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/boas/04-falta-dado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/01-numero-inventado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/02-risco-suavizado.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/03-pergunta-omitida.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/04-tudo-certo.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/05-acao-nova.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/06-codigo-interno.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/07-diz-que-agiu.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/08-ref-invalida.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/09-escreve-parte-do-codigo.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/10-ordem-errada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/11-acao-externa-no-relatorio.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/12-ordem-com-buraco.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/13-acao-disfarcada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/14-frase-longa.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/15-termo-do-pacote.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/16-conclusao-que-a-conta-nao-tem.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/17-passo-que-leigo-nao-faz.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/defeitos/18-nao-responde-ao-pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/jornada-falha.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/jornada.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/casos/SRV-RELATORIO-FINAL/pedido.yaml` | MANTER | casos de teste e jornadas; os IDs de checagem ainda não existem no validador de código |
| `helena-v2/deliverables/analise_estrategica.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/calculo.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/copy.yaml` | CORRIGIR | faltam os casos (Isabela) ou a ficha (Bianca) |
| `helena-v2/deliverables/entregas.yaml` | DESCARTAR | índice antigo da v1, substituído por um arquivo por tipo |
| `helena-v2/deliverables/parecer.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/perfil_de_funcao.yaml` | CORRIGIR | faltam os casos (Isabela) ou a ficha (Bianca) |
| `helena-v2/deliverables/plano_de_pratica.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/plano_de_projeto.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/relatorio_final.yaml` | MANTER | formato de entrega v3.1 com casos |
| `helena-v2/deliverables/roteiro_treinamento.yaml` | CORRIGIR | faltam os casos (Isabela) ou a ficha (Bianca) |
| `helena-v2/maquina/jornada.schema.json` | MANTER | tabela de passagens + prova das 13 regras + testes |
| `helena-v2/maquina/passagens.yaml` | MANTER | tabela de passagens + prova das 13 regras + testes |
| `helena-v2/maquina/provar.py` | MANTER | tabela de passagens + prova das 13 regras + testes |
| `helena-v2/maquina/test_maquina.py` | MANTER | tabela de passagens + prova das 13 regras + testes |
| `helena-v2/maquina/vocabulario.yaml` | MANTER | tabela de passagens + prova das 13 regras + testes |
| `helena-v2/models.yaml` | MANTER | sem modelo reserva (plano DBOS); diverge do plano da base |
| `helena-v2/organograma.yaml` | MANTER | catálogo dos 21; mudanças de papel (Marina, Bruno) pedem o seu ok |
| `helena-v2/playbooks/recrutar-10-pessoas.yaml` | CORRIGIR | roteiro antigo da base, sem mudança; reescrever para v3.1 |
| `helena-v2/schemas/acao.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/schemas/agent.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/schemas/card.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/schemas/entrega.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/schemas/plano.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/schemas/playbook.schema.json` | MANTER | formatos v3.1 (ficha, entrega, ação, card, roteiro) |
| `helena-v2/servicos.yaml` | MANTER | catálogo dos 21; mudanças de papel (Marina, Bruno) pedem o seu ok |
| `helena-v2/test_validar.py` | CORRIGIR | reescritos para v3.1; 4 testes frágeis (conserto pronto, não commitado) |
| `helena-v2/validar.py` | CORRIGIR | reescritos para v3.1; 4 testes frágeis (conserto pronto, não commitado) |
| `motor/executor/.gitignore` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/__init__.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/ambiente.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/arvore.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/conferencia.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/decisao.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/executor.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/executor_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/falha.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/ficha.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/gabarito.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/hermes_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/perfil.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/processo.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/provedor_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/segredos.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/tipos.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/executor_helena/uso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/pytest.ini` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/requirements-hermes-real.txt` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/requirements.txt` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/apoio/__init__.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/apoio/ambiente_de_teste.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/apoio/hermes_gravado.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/apoio/servidor_de_ferramentas_de_teste.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/cenarios.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/conftest.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/esquema_do_state_db_do_hermes_0_19_0.sql` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/ficha_antiga_com_busca.yaml` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/ficha_antiga_sem_ferramenta.yaml` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/ficha_com_ferramentas.yaml` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/ficha_sem_ferramenta.yaml` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/fixtures/models.yaml` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_ambiente.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_conferencia.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_conformidade.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_executor_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_executor_hermes.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_falha.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_ficha.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_gabarito.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_hermes_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_mutacoes.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_perfil.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_processo.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_provedor_falso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_segredos.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_teste3.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_uso.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/executor/testes/test_vocabulario.py` | CORRIGIR | sem README; suposições sobre o Hermes não confirmadas |
| `motor/ferramentas/.gitignore` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/README.md` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/__init__.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/__main__.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/busca.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/contador.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/copias.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/enderecos.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/erros.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/ferramentas.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/leitor.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/limpeza.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/parametros.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/partes.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/rede.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/registro.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/ferramentas_helena/servidor.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/pytest.ini` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/requirements.txt` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/conftest.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/falsos.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_busca.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_contador.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_copias.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_enderecos.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_leitor.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_limpeza.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_mutacoes.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_parametros.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_partes.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_producao.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_rede.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_registro.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_servidor.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/testes/test_stdio.py` | MANTER | servidor de ferramentas seguro |
| `motor/ferramentas/verificacao_manual/compat_mcp.py` | MANTER | servidor de ferramentas seguro |
| `motor/simulador/.gitignore` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/README.md` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/pytest.ini` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/requirements.txt` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/__init__.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/adaptador_maquina.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/agentes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/alvo.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/eventos.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/execucao.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/invariantes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/motor_falso.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/mundo.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/referencia.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/roteiro.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/simulador/vocabulario.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/ajudantes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/cenarios_comuns.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/mutantes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_adaptador_maquina.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_invariantes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_mutacoes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_pecas.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_referencia.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_reprodutibilidade.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/simulador/testes/test_sementes.py` | CORRIGIR | cópia do vocabulário e 2ª implementação das regras do card |
| `motor/validador/README.md` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/calculo_contexto.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/calculo_resposta.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/convite_com_defeito_resposta.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/convite_contexto.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/convite_resposta.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/dossie_contexto.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/dossie_resposta.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/parecer_contexto.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/exemplos/parecer_resposta.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/pytest.ini` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/requirements.txt` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/__init__.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/banco.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/__init__.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/defeitos_citacao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/defeitos_fonte_calculo.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/defeitos_formato.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/defeitos_leis_temas_ganho.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/casos/honestas.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/fabrica.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/rodar_banco.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_banco_de_casos.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_cli.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_desempenho.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_enderecos.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_expressao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_idioma.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_mutacoes.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_relatorio.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_robustez.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_seguranca_do_codigo.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_tabela_de_leis.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/tests/test_texto.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/__init__.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/__main__.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/__init__.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/acao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/acao_externa.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/calculo.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/citacao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/fonte.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/ganho.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/idioma.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/leis.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/links.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/marca.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/secoes.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/temas.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/checagens/texto_puro.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/cli.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/contexto.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/dados/configuracao.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/dados/leis.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/dados/temas.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/dados/termos_de_ganho.json` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/enderecos.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/execucao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/expressao.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/nucleo.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/numeros.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/registro.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/resultado.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |
| `motor/validador/validador/texto.py` | CORRIGIR | funciona, mas só 3 dos 106 IDs de checagem das entregas existem no código |

| `helena-v2/test_validar.py` (mudança não commitada) | CORRIGIR | conserto dos 4 testes frágeis, já aplicado no disco |

## Anexo C — diferenças entre a base e o meu ramo que NÃO são minhas

### C.1 Existem na base e faltam no meu ramo (37)

| Arquivo | Por quê |
|---|---|
| `HANDOFF-CLAUDE-CODE.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/CHECKPOINT-MESTRE-20261007.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/COMANDO-MASTER-MISSAO-CUMPRIDA.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/PLANO-ARQUITETURA-V2.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/PLANO-DESTRAVAR-AGENTES-20261006.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/PLANO-HELENA-V3.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `docs/PLANO-SISTEMA-100-20261007.md` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/scripts/apply_soul_v3.py` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/src/business-scope.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/src/delivery-check.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/src/finance-ledger.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/test/business-scope.test.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/test/delivery-check.test.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/test/finance-ledger.test.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `services/helena-gateway/test/replan.test.mjs` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `src/lib/domain/money.ts` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261006233000_conflito_versao_sem_repeticao.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007070000_falha_infra_sem_gastar_tentativa.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007093000_ferramentas_por_funcao.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007100000_agentes_todas_empresas.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007101500_contexto_empresas_atendidas.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007110000_em_resolucao_replanejamento.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007113000_encaminhamento_encerrado.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007120000_nota_de_coordenacao.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007130000_briefing_rascunho_e_encaminhamento_enxuto.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261007154500_em_resolucao_inclui_falha.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008001500_contexto_devolucoes_recentes.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008100000_encaminhamento_fecha_ou_pergunta.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008130000_checkpoint_aceita_encaminhamento_encerrado.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008140000_encaminhamento_regra_nova_uma_vez.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008143000_indice_encaminhamento_antigo.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008151500_indice_encaminhamento_antigo_status.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008160000_encaminhamento_nova_regra_tenta_uma_vez.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/migrations/20261008222000_continuacao_mesmo_agente.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/patches/helena_mission_v2.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/patches/helena_outcome_v1.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |
| `supabase/patches/helena_reliability_v1.sql` | existe na base e falta no meu ramo (o ramo nasceu da main) |

### C.2 Diferentes da base por causa da `main` (42)

| Arquivo | Por quê |
|---|---|
| `services/helena-gateway/package.json` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/role-skills/helena-role-agt-05/SKILL.md` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/role-skills/helena-role-agt-13/SKILL.md` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/role-skills/package.json` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/autonomy_protocol.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/build_role_skills.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/configurar_perfis.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/execution_policy.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/hermes_dispatch_once.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/hermes_execution_context.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/scripts/hermes_workflow_tick.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/integrations/conversation-naturalness.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/integrations/eliving-voice-config.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/integrations/profile-store.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/job-reader.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/kanban-snapshot.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/routes/integrations.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/runtime-access.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/server.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/workflow-journal.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/src/workflow.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/audio-tags-expressiveness.test.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/call-tts-stream.test.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/elevenlabs-hybrid-fallback.test.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/execution_context_test.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/execution_policy_test.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/hermes_dispatch_once_test.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/hermes_workflow_tick_test.py` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/integrations-security.test.mjs` | diferente da base por causa da main (não fui eu) |
| `services/helena-gateway/test/provision_profiles_test.py` | diferente da base por causa da main (não fui eu) |
| `src/auth.tsx` | diferente da base por causa da main (não fui eu) |
| `src/components/financeiro/LancamentoModal.tsx` | diferente da base por causa da main (não fui eu) |
| `src/components/financeiro/OrcamentoModal.tsx` | diferente da base por causa da main (não fui eu) |
| `src/lib/crm-calendario.ts` | diferente da base por causa da main (não fui eu) |
| `src/lib/escrita-protegida.ts` | diferente da base por causa da main (não fui eu) |
| `src/lib/helena.test.ts` | diferente da base por causa da main (não fui eu) |
| `src/lib/helena.ts` | diferente da base por causa da main (não fui eu) |
| `src/lib/tarefa-calendario.ts` | diferente da base por causa da main (não fui eu) |
| `src/pages/FinanceiroPage.test.tsx` | diferente da base por causa da main (não fui eu) |
| `src/pages/FinanceiroPage.tsx` | diferente da base por causa da main (não fui eu) |
| `src/pages/IdentidadePage.test.tsx` | diferente da base por causa da main (não fui eu) |
| `src/pages/IdentidadePage.tsx` | diferente da base por causa da main (não fui eu) |
