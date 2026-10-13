# Próximos passos do primeiro card — em detalhe

Para o agente que continuar. Escrito em 13/10/2026. Complementa o bloco `0-A` do `HANDOFF-CLAUDE-CODE.md` (que é o resumo). Se este arquivo e o código divergirem, vale o código: confira antes de agir.

## 0. Onde estamos

Meta única: **um card real indo de RASCUNHO a PRONTO, de ponta a ponta, com 5 agentes** (Helena, Caio, Isabela, Clara, Ravi), sem ninguém destravar à mão. O card de teste é o roteiro `helena-v2/playbooks/recrutar-10-pessoas.yaml` (E1 cálculo, E2 roteiro de treinamento, E3 convite, E4 parecer jurídico, E5 relatório final). Ramo `v2-primeiro-card` (PR nº 16, rascunho, para `organizacao-2026-10-10`).

| Passo | Situação |
|---|---|
| 1 CI | pronto (`.github/workflows/helena-v2.yml`, 7 jobs verdes no commit a05cb0e) |
| 2 os 5 agentes | pronto |
| 3 validador `motor/validador/` | 78 de 78 checagens implementadas; **14 achados ALTA ainda escapam** |
| 4 banco `supabase/migrations-v2/` | esquema, função única e testes prontos; **2 ALTA e 4 MÉDIA por consertar** |
| 5 motor DBOS | **não começou** |
| 6 tela do card no app | **não começou** |
| 7 dia de prova | **não começou** (só preparar; nunca executar) |

Números de referência (devem continuar iguais): helena-v2 292 testes; motor/ferramentas 588; motor/validador 2153 passam e 31 pulam (checagens de outros cards); motor/executor 493; motor/simulador 723; app 181 (Node 20) com build ok; `python validar.py` = "OK com 1 pendência conhecida" (as 13 fichas dos outros agentes); banco passa no CI.

## 1. Primeiro: consertar o que os ataques acharam (nesta ordem)

`docs/auditoria/ATAQUES-2026-10-11.md` tem cada achado com **como reproduzir**. Regra: reproduza antes de consertar (pode ter mudado); conserte na origem; acrescente o teste de regressão; rode a suíte; commit pequeno.

**1a. Banco** (`supabase/migrations-v2/`). Tudo que é regra vem de `helena-v2/maquina/passagens.yaml` via `gerar_passagens.py`; nunca edite o `0002` à mão.
- ALTA: funções SECURITY DEFINER sem `pg_temp` no fim do `search_path`: uma tabela temporária sombreia as tabelas de regras. Conserto: `SET search_path = helena_v2, pg_catalog, pg_temp` nas funções e referências qualificadas.
- ALTA: `abrir_chamada_helena` dá "permission denied" para `service_role` e `authenticated`. **O motor (passo 5) precisa dela**: conserte os GRANTs e teste com os papéis.
- MÉDIA: `vigia()`, `conferir_card()` e `situacao_efetiva()` têm GRANT mas falham para os papéis; a trava "só pela função" depende de uma variável de sessão que um dono de tabela consegue ligar; prazo aceita `infinity`/datas absurdas; `DECISAO_MUDOU` mandado direto pelo motor cancela o card em 4 chamadas.
- BAIXA: toque malformado do fundador não deixa linha no histórico; "fundador" é o papel do Postgres, não a pessoa.
- Depois: rode `python gerar_passagens.py --conferir` e `python -m pytest` nesta pasta. O arquivo `testes/ataque_fidelidade_nao_verificado.py` (1100 linhas, parcial, não coletado pelo pytest) compara a função do banco com `helena-v2/maquina/provar.py`: rode à mão (`python -m pytest testes/ataque_fidelidade_nao_verificado.py`), o que passar vira `test_ataque_fidelidade.py`, o que falhar é achado a consertar.

**1b. Validador** (`motor/validador/`). 14 achados ALTA que **escapam** (defeito real que nenhuma checagem pega) em convite, roteiro de treinamento, cálculo e relatório final, mais MÉDIA e algumas recusas indevidas (resposta honesta recusada) e 1 exceção solta. Para cada um: reproduza (código no relatório), decida se o conserto é no parâmetro do YAML do tipo (`helena-v2/deliverables/<tipo>.yaml`) ou na lógica (`validador/checagens/spec_<tipo>*.py`), e crie o defeito em `helena-v2/casos/<SRV>/defeitos/` (uma boa copiada com UM defeito). O teste `tests/test_prova_na_especificacao.py` exige boa + defeito para cada CHK. **Refazer** o ataque ao parecer e ao dossiê (não terminou). Os scripts dos atacantes estão em `docs/arquivo/ataques-validador-20261011.tar.gz` (descompacte fora do repositório).

Ao terminar 1a e 1b: `python -m spec_helena --atualizar-readme` (motor/validador) e o CI verde.

## 2. Passo 5 — motor DBOS (`motor/orquestrador/`, pasta nova)

Princípio do plano (`docs/plano/PLANO-HELENA-V3.md`, seção "O motor"): **o banco manda, o motor executa, o agente só escreve conteúdo**. DEC-026: motor = DBOS Transact (Python, MIT), versão fixa **3.2.0**. O estado do card mora nas nossas tabelas; o DBOS guarda só os passos concluídos (num banco de sistema dele, outro banco no mesmo Postgres local).

O que construir:
1. `README.md` (uma página), `requirements.txt` fixo (dbos==3.2.0, psycopg[binary], pyyaml, pytest) e testes. **Venv à parte do Hermes real**: `motor/executor/requirements-hermes-real.txt` avisa que o hermes-agent briga com o DBOS.
2. Um workflow DBOS por etapa, com **dois passos curtos** (plano, seção "Dois passos curtos por execução"): (a) abre o agente e grava a resposta; (b) lê a resposta gravada, confere e muda o estado. A chave de idempotência é a etapa + o número da execução (`abrir_chamada_helena` e a chave de execução do banco).
3. Quem executa o agente: `motor/executor` (`ExecutorFalso` + `Roteiro`, ou o `hermes_falso`). **Nunca o Hermes real neste passo.** O pacote de cada execução vem da ficha (`helena-v2/agents/<nome>.yaml`) e do catálogo.
4. Quem confere a resposta (portão 1): `motor/validador`, montando modelo e contexto com o adaptador `motor/validador/spec_helena/` (lê o YAML do tipo e os casos). Atenção: o validador roda só as checagens de `modelo.checagens_a_rodar`; o motor real tem de passar essa lista.
5. **Só a função única muda estado**: `helena_v2.aplicar_evento(...)` (ver `supabase/migrations-v2/README.md`). O motor nunca faz UPDATE direto. Revisores de IA (portão 2) nos testes = respostas roteirizadas do Hermes falso (todos os critérios PASSOU nas boas).
6. Validador do plano: quando o card entra em VALIDANDO_PLANO, o motor valida o plano por código (sem ciclo, serviços existem, orçamento cabe) e então dispara `PLANO_VALIDO` (use `p_nao_disparar => '{PLANO_VALIDO}'` como o README do banco descreve).
7. **Teste de aceitação**: um card do roteiro `recrutar-10-pessoas` vai de RASCUNHO a PRONTO sozinho. As respostas de cada agente são as respostas das **boas** de `helena-v2/casos/SRV-*/boas/` (o adaptador entrega a resposta e o contexto de cada caso). Os únicos toques humanos permitidos no teste são os que o plano prevê (confirmar a leitura de volta; aprovar onde o fundador é revisor, como no parecer E4), aplicados como eventos do papel FUNDADOR. Além disso, testes de: queda no meio do passo (retoma sem duplicar), resposta repetida, cancelamento, recusa do portão 1 que volta ao autor, AJUSTE do parecer que refaz E2 e E3.
8. Job novo no CI (service container `postgres:16`, como o job `banco-v2`) e README. Nada de chave: conexão por variável de ambiente (`HELENA_V2_TESTE_DATABASE_URL`).

## 3. Passo 6 — tela simples do card (`src/`)

App React 18 + Vite 5 + vitest 4, rotas em `src/App.tsx`, páginas em `src/pages/`, acesso a dados em `src/integrations/`. Criar:
1. `src/pages/CardV2Page.tsx` (+ teste) e a rota (por exemplo `/cards-v2`): lista de cards e, ao abrir um, as etapas com estado, dono, prazo, revisor e as entregas aprovadas. Só leitura do schema `helena_v2`.
2. Um módulo de dados pequeno em `src/integrations/` com um cliente **injetável**: nos testes, um falso em memória. **Nenhum teste e nenhum código conecta no Supabase de produção.** Nomes de variáveis novas só em `.env.example`.
3. **Botão "publicar"**: só o fundador aperta, **no máximo uma vez por dia**, e a regra mora no **banco** (não só na tela). Nova migration `supabase/migrations-v2/0005_publicacao.sql` (tabela `publicacoes`, função `helena_v2.pedir_publicacao()`, uma por dia no horário de Brasília, só o papel FUNDADOR, histórico) com testes no mesmo pytest do banco. O botão **registra o pedido**; ele não publica nada nem chama servidor. Mostre na tela o estado do pedido ("pedido hoje às HH:MM" / "já usado hoje").
4. Linguagem da tela em português simples (o fundador não é programador). `npm test` e `npm run build` verdes (181 testes de partida mais os novos).

## 4. Passo 7 — PARAR e pedir autorização

Escrever `docs/manual/dia-de-prova.md` (uma página): a lista **exata** de comandos do "dia de prova" da fase 2 do plano, **sem executar nenhum**: criar a pasta `motor/executor/verificacao_real/` (citada nos testes e inexistente) que roda os mesmos cenários contra o hermes-agent 0.19.0 de verdade (venv à parte, `requirements-hermes-real.txt`), login único da v2 do ChatGPT (feito pelo fundador, nunca por token colado no chat), e os testes 1, 2 e 3 da seção "Os testes que decidem" do plano. Termine pedindo ao fundador a frase exata de autorização e **espere**. Sem a frase: nada de Hermes real, ChatGPT, Supabase real, EasyPanel, Hostinger, Evolution API.

## 5. Fechamento

`python -m spec_helena --atualizar-readme`; atualizar o bloco `0-A` do HANDOFF (até 10 linhas); atualizar a lista de passos no PR nº 16; CI verde nos jobs. **Não fazer merge no `main` nem tirar o PR de rascunho sem pedido explícito do fundador.** (Ele pediu para juntar tudo no `main` e mandou parar antes de começar: o `main` tem 4 commits de voz que o ramo não tem. Se ele pedir de novo: juntar numa cópia, resolver conflitos sem apagar nada, testar o app e o gateway, enviar sem `--force`.)

## 6. Ambiente

- Python 3.13, Node 20 (o CI usa 20; a máquina antiga tinha 22). Venvs separados por peça (`requirements.txt` de cada pasta).
- Postgres 16 local: binários em `/usr/lib/postgresql/16/bin`; **não roda como root** (use o usuário `postgres`); os testes do banco sobem o próprio cluster na porta 54329 (`HELENA_V2_PG_BIN` se o caminho for outro).
- As pastas `/tmp/...` da sessão antiga não existem mais: tudo o que importa está no repositório.
- Comandos de conferência: ver `docs/manual/como-mudar.md`.

## 7. Lições (não repetir)

- Workflows/agentes: o isolamento automático por worktree partiu da `main`; crie worktrees à mão (`git worktree add -b <ramo> <pasta> v2-primeiro-card`) e junte com `git cherry-pick`. No máximo 2 agentes ao mesmo tempo na máquina antiga.
- `git commit` leva TUDO o que está no índice: confira `git status` antes. Commits de trabalho em andamento levam `[skip ci]`.
- Não esconda erro de comando; não diga "pronto" sem colar a saída dos testes; confira o CI no GitHub depois de enviar (um teste do executor só falhou lá, não nos testes locais que eu tinha rodado).
- A cota do fundador é curta: modelo barato (Sonnet/Haiku) para o que é repetitivo, poucos agentes por vez, mensagens curtas.

## 8. Depois do primeiro card local: ligar de verdade (cada item só com a frase exata do fundador)

O fundador quer a configuração completa, de ponta a ponta. Isso é o resto do plano (`docs/plano/PLANO-HELENA-V3.md`: "Fases com portão", "Os testes que decidem", "O que preciso de você"). O agente **prepara tudo no repositório** (scripts, passo a passo em português simples, testes) e **para em cada portão pedindo a frase**; nunca executa sozinho. Para cada ação, proponha a frase exata (ex.: "AUTORIZO APLICAR AS MIGRATIONS DA V2 NO SUPABASE REAL"); ela vale para aquela ação, uma vez.

| Fase | O que o fundador faz | O que o agente prepara |
|---|---|---|
| 0 Segurança, primeiro de tudo | remover as portas 9119 e 8642; rodar a checagem de invasão no console do EasyPanel; ligar a verificação em duas etapas; criar a conta do vigia (healthchecks.io) e o robô do Telegram | passo a passo numa mensagem só; migration separada que fecha as funções abertas do banco da v1; roteiro de troca das chaves (`docs/manual/troca-de-chaves.md`), que fica para o FIM dos testes (DEC-027) |
| 2 Base | digitar a frase de cada mudança no servidor e no banco; fazer o login único da v2 do ChatGPT | dia de prova (Hermes real, testes 1, 2 e 3); aplicar `supabase/migrations-v2/` no Supabase real; motor DBOS como serviço novo no EasyPanel; relógio dos prazos e vigia de 5 minutos no Supabase; avisos pelo Telegram; backup noturno no GitHub e restauração semanal (teste 8); testes 4 a 11 do plano; revisão independente no fim da fase |
| 3 Provar | aprovar | teste 9 do revisor (30 entregas com 7 tipos de erro); só depois, trocar o canal do WhatsApp da v1 para a v2 (um registro muda o canal; o que está em andamento termina na v1) |
| 4 Ampliar | aprovar cada agente | ligar os outros agentes um por vez (fichas v3.1 dos 13 que faltam, casos e checagens); o Codex só depois dos testes 3 e 5 |

Ninguém promete "zero furo": cada fase só avança com os testes dela passando e uma revisão independente que tenta quebrar o que foi feito. A tela do card (passo 6) tem o botão "publicar": só o fundador aperta, no máximo uma vez por dia.
