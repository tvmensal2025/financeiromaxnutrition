# Executor — o adaptador do Hermes

Roda UM agente por vez, numa pasta limpa, e devolve sempre um `Resultado`. O motor só enxerga o contrato `Executor` (`rodar` e `cancelar`); o Hermes fica atrás dele. Trocar de executor é escrever outra classe com os mesmos dois métodos e passar em `testes/test_conformidade.py`.

## O que ele faz em cada execução

1. Lê a ficha (`helena-v2/agents/*.yaml`) e o `models.yaml` e gera um perfil do Hermes (`config.yaml` e `SOUL.md`) numa pasta nova, com uma pasta de trabalho vazia, `HOME` vazio e sem login do Codex.
2. Confere o perfil contra o gabarito (memória, curadoria, resumo automático e nova tentativa: desligados; sem modelo reserva; lista de ferramentas por extenso). Perfil fora do gabarito não roda.
3. Monta o ambiente do zero (nenhum nome nem valor que pareça segredo entra) e lança `hermes -z` em grupo de processos próprio.
4. Vigia tempo, cancelamento (até 15 s) e limite de chamadas das ferramentas.
5. Lê o registro de uso do Hermes e classifica a falha. A falha é lida do registro, nunca do texto do agente.
6. Confere modelo, provedor e ferramentas recebidas. Só devolve `texto` se a execução terminou inteira e passou na conferência.

Quem decide estado, destino e liberação é o motor. O executor não grava em banco nenhum.

## Como usar

```python
resultado = executor.rodar(execucao)    # bloqueia; devolve SEMPRE um Resultado
executor.cancelar("E-123-n4")           # de outra thread
resultado.ok, resultado.texto, resultado.falha.classe
```

- `ExecutorHermes`: o real (precisa do Hermes instalado). `ExecutorFalso` + `Roteiro`: o falso, sem processo nenhum, usado pelo simulador e pelos testes do motor.
- `hermes_falso.py` imita só o que importa do `hermes -z` do hermes-agent 0.19.0 e é o que os testes rodam por padrão.
- As 10 classes de falha são as de `helena-v2/maquina/vocabulario.yaml` (COTA, LOGIN, PROVEDOR, QUEDA, FERRAMENTA, TEMPO, LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO, DESCONHECIDA). Só TEMPO, LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO e DESCONHECIDA gastam tentativa.

## Fichas aceitas

| Formato | Quem usa | Observação |
|---|---|---|
| `3.1` | as fichas novas (`servicos[]`, `revisao`, `modelo{}`) | o orçamento vem pronto |
| `antigo` | fichas da fase 1 | é convertido e a conversão vira aviso: `chamadas_total = max(passos, buscas + partes + 1)` e `partes_de_pagina = passos - buscas - 1` |

Ficha com mais de um serviço exige `servico=...` ao ler.

## A porta: qualquer runtime, o mesmo motor

O motor só enxerga a classe `Executor` (`executor_helena/executor.py`): `rodar`, `cancelar`, `limpar` e `capacidades`, todos obrigatórios. O Hermes é o primeiro adaptador, não o único. Nada no banco, nas fichas, nas telas nem no motor sabe o nome do runtime: o nome vem de `HELENA_V2_EXECUTOR` (vazio = `hermes`) e a lista de nomes aceitos mora no código, em `executor_helena/registro.py`.

| Você quer | Mude aqui | O que NÃO muda |
|---|---|---|
| Trocar o modelo de um agente (ou de todos) | uma linha do apelido em `helena-v2/models.yaml` | código, fichas, banco, telas |
| Mudar missão, limite ou ferramenta de um agente | a ficha em `helena-v2/agents/` (ou uma revisão pela tela de configuração) | código do executor |
| Trocar de runtime (Hermes, EVE, OpenClaw...) | `HELENA_V2_EXECUTOR=<nome>` e as variáveis que o adaptador pede | motor, fichas, banco, telas |

`testes/test_troca_de_modelo.py` prova a primeira linha com as fichas reais; `testes/test_registro.py` e `testes/test_conformidade.py` provam a porta.

### Como adicionar um executor novo (EVE, OpenClaw ou outro)

1. Antes de tudo, leia a documentação oficial ATUAL do runtime. Não escreva adaptador por suposição: se algo não estiver confirmado, marque **NÃO CONFIRMADO** no código e nos testes.
2. Escreva uma classe `Executor` com `capacidades` (atributo de classe do tipo `Capacidades`), `rodar`, `cancelar` e `limpar`. Ela traduz o registro NATIVO do runtime para `Evidencias` e deixa `decisao.decidir` e `conferencia.conferir_*` classificarem a execução, como faz o Hermes (`runtime_alternativo.py` é o exemplo mínimo: outro runtime, mesmo núcleo).
3. As garantias de `Capacidades` não são enfeite: o runtime precisa receber a lista EXATA de ferramentas (vazia = nenhuma), informar qual modelo e provedor rodaram, nunca trocar de modelo sozinho, cortar o laço de chamadas, cancelar em até 15 s, classificar a falha pelo registro e nunca pelo texto do agente, e devolver a conversa.
4. Escreva a "forma" dele em `testes/test_conformidade.py` (e inclua em `FORMAS_DOS_APROVADOS`). Sem isso o teste `test_todo_executor_aprovado_tem_forma_de_conformidade` falha.
5. Acrescente um `Adaptador` em `APROVADOS` (`registro.py`) com os NOMES das variáveis de ambiente que ele exige (nunca valores) e liste esses nomes em `.env.example`.
6. Revisão de código e de segurança antes do pull request. O motor de produção recusa qualquer classe fora do registro e qualquer runtime que não declare todas as garantias.
7. Antes de usar de verdade: um "dia de prova" para o runtime novo, com a frase exata do fundador. Conformidade de teste não prova o runtime real.

## Como testar

```sh
pip install -r requirements.txt
python -m pytest -q        # 555 testes e 7 pulados de propósito (simulações só do Hermes), cerca de 2 minutos; sem Hermes real, sem rede, sem gastar cota
```

## O que NÃO está provado

- O Hermes de mentira foi copiado de execuções reais do hermes-agent 0.19.0. A pasta `verificacao_real/` agora reúne 19 casos para rodar depois da autorização do fundador; eles ainda **não foram executados com o Hermes real**. Portanto, a equivalência com o Hermes de verdade continua **NÃO CONFIRMADA**.
- As suposições sobre o Hermes real (opções da linha de comando, nomes das chaves de configuração, formato do registro de uso) só se confirmam no "dia de prova" (fase 2, na VPS), com a frase exata do fundador. `requirements-hermes-real.txt` serve só para esse dia e deve ir para um ambiente à parte, nunca o dos testes.
- Nada aqui toca em Supabase, EasyPanel nem Evolution API.

## O que se sabe (e o que não) sobre EVE e OpenClaw

Pesquisa de 14/10/2026, só leitura de documentação; nada foi instalado nem rodado. Os sites eve.dev e docs.openclaw.ai não abriram daqui (rede bloqueada); li os mesmos textos no pacote npm `eve@0.79.0` (**E** = pasta `docs/` de https://registry.npmjs.org/eve/-/eve-0.79.0.tgz, código em https://github.com/vercel/eve) e na pasta `docs/` do OpenClaw 2026.10.3 (**O** = https://raw.githubusercontent.com/openclaw/openclaw/main/docs/ARQUIVO.md). O molde `executor_helena/adaptador_modelo.py` falha fechado e NÃO está em `APROVADOS`.

- **EVE existe.** CONFIRMADO (https://registry.npmjs.org/eve e https://github.com/vercel/eve; E: `README.md`): framework TypeScript da Vercel para agentes duráveis, em prévia (beta, versão 0.x, a API pode mudar), Apache-2.0. O agente é uma pasta `agent/` que vira um servidor HTTP (`eve build` + `eve start`): `POST /eve/v1/session`, `GET .../stream` (NDJSON), `POST .../cancel` (E: `concepts/sessions-runs-and-streaming.md`, `guides/deployment/self-hosting.md`). NÃO CONFIRMADO: um comando que roda um turno local e sai (só achei `eve remote invoke --url`, que precisa de servidor já ligado).
- **OpenClaw existe.** CONFIRMADO (https://github.com/openclaw/openclaw, MIT): assistente de código aberto com Gateway. Modo sem interação: `openclaw agent exec "<texto>" --json --model <provedor/modelo> --state-dir <pasta> --timeout <s>` mais `--config <arquivo>` OU `--auth-env-only` (a doc rejeita os dois juntos); saída 0 = ok, 1 = erro, 2 = tempo (O: `cli/agent`).
- Pasta de perfil e credencial: OpenClaw tem `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR` e `OPENCLAW_CONFIG_PATH`; chave só pelo ambiente com `--auth-env-only` (O: `help/environment`) = CONFIRMADO. EVE: `HOME` isolado e autenticação da rota em `eve start` = NÃO CONFIRMADO (`localDev()` só vale em `eve dev`; E: `guides/auth-and-route-protection.md`); a chave do modelo vem de `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` = CONFIRMADO (E: `agent-config.md`). A EVE manda telemetria da linha de comando por padrão: desligar com `EVE_TELEMETRY_DISABLED=1` (E: `reference/cli.md`).

| Campo de `Capacidades`: o que o adaptador tem de responder | EVE | OpenClaw |
|---|---|---|
| `nome`: nome curto para `HELENA_V2_EXECUTOR` | decisão nossa (`eve`) | decisão nossa (`openclaw`) |
| `cancela_em_ate_s`: como encerrar e provar ≤ 15 s? | cancelar existe (`POST .../cancel`, assíncrono); prazo NÃO CONFIRMADO | `SIGINT`/`SIGTERM` têm tratamento descrito; prazo NÃO CONFIRMADO (a doc recomenda `timeout -k 60` de reserva) |
| `ferramentas_por_extenso`: lista exata (vazia = nenhuma) e prova do que o modelo recebeu? | forma CONFIRMADA (`defaultTools: false`, `disableTool()`); "exata" NÃO CONFIRMADO (`eve__*` e a busca do provedor não aparecem em `eve info --json`) | forma CONFIRMADA (`tools.allow`/`tools.deny` em `--config`; `tools.json` na trajetória); "vazia = nenhuma" NÃO CONFIRMADO |
| `confere_modelo_e_provedor`: que registro do runtime diz o que rodou? | modelo CONFIRMADO (`step.started` traz `modelId`); provedor real atrás do AI Gateway NÃO CONFIRMADO | CONFIRMADO (`--json`: `model`, `provider`; trajetória `model.completed`) |
| `sem_reserva_escondida`: nunca troca modelo, provedor ou conta sozinho? | NÃO CONFIRMADO (o AI Gateway tem fallback próprio; cada passo repete até 4 vezes) | NÃO CONFIRMADO (a doc só diz que `--fallback` explícito vale junto de `--model`; há rotação de conta fora do `--auth-env-only`) |
| `limita_chamadas`: cortar o laço pelo orçamento da ficha? | limite de tokens e custo por sessão CONFIRMADO; por chamadas NÃO CONFIRMADO (contar eventos e cancelar seria nosso) | só `--timeout` e 3 erros iguais seguidos CONFIRMADOS; por chamadas NÃO CONFIRMADO |
| `falha_vem_do_registro`: onde está o motivo da falha? | existe, CONFIRMADO (`step.failed`/`turn.failed` com `code`); tabela completa de códigos NÃO CONFIRMADO | existe, CONFIRMADO (`status`, `error.kind`); lista de `kind` NÃO CONFIRMADO |
| `guarda_conversa`: de onde sai a conversa completa? | CONFIRMADO (o fluxo NDJSON da sessão pode ser relido) | gravada no SQLite do agente, CONFIRMADO; leitura estável NÃO CONFIRMADO (a exportação é "redigida" e o `exec` apaga o estado sem `--state-dir`) |

Um adaptador só passa uma garantia para `True` depois de teste de conformidade e do "dia de prova"; tudo o que está NÃO CONFIRMADO acima continua `False`. As perguntas completas estão em `PERGUNTAS_POR_GARANTIA` (`adaptador_modelo.py`).
