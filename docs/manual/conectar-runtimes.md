# Conectar um runtime de agente (Hermes, OpenClaw, EVE)

Atualizado em 14/10/2026. Fonte da verdade: o código em `motor/executor/executor_helena/registro.py`. Para ver o estado atual, sem rede e sem banco:

```sh
cd motor/orquestrador
PYTHONPATH=../executor python -m orquestrador conferir-runtime
```

O comando mostra cada runtime, o estado dele, as variáveis que faltam e o que já se sabe de cada garantia. Ele mostra só nomes, nunca valores.

## A regra que vale para todos

- O motor fala com qualquer runtime pela mesma porta: `rodar`, `cancelar`, `limpar` e `capacidades`. Banco, telas, fichas e regras não mudam quando o runtime muda.
- Quem escolhe o runtime é a variável `HELENA_V2_EXECUTOR`. Vazia significa `hermes`.
- Há dois degraus:
  - **APROVADO_PARA_PRODUCAO**: só o Hermes.
  - **PRONTO_PARA_CONECTAR_NAO_APROVADO**: OpenClaw e EVE. O motor **recusa a partida** com eles e diz o que falta.
- Para promover um runtime:
  1. Provar cada garantia no runtime de verdade, no dia de prova, com a frase exata do fundador.
  2. Passar o adaptador de `EM_HOMOLOGACAO` para `APROVADOS` por pull request.
  3. Acrescentar a forma dele em `FORMAS_DOS_APROVADOS`, no `testes/test_conformidade.py`.
- Nada aqui foi rodado contra o runtime real. Os adaptadores passaram nos testes contra um **falso** de cada runtime, feito a partir da documentação oficial. Isso prova o caminho do nosso código, não o runtime.

## Quem pode rodar cada agente hoje

São 8 fichas em `helena-v2/agents/`. Todas usam o provedor `openai-codex`, que é a assinatura do ChatGPT por login (`helena-v2/models.yaml`: "nunca API paga").

| Agente | Ferramentas da ficha | Hermes | OpenClaw | EVE |
|---|---|---|---|---|
| Helena (coordenação) | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Caio | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Isabela | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Augusto | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Laura | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Marina | nenhuma | aprovado | pronto para conectar | recusado: assinatura |
| Clara | `ler_pagina` | aprovado | recusado: ferramentas | recusado: ferramentas |
| Ravi | `ler_pagina`, `buscar` | aprovado | recusado: ferramentas | recusado: ferramentas |

**Por que a EVE recusa a assinatura.** A documentação da EVE (`agent-config.md`, eve 0.79.0) diz que `chatgpt()`, o modelo da assinatura, "cannot run in a deployment". Em servidor, a EVE exige `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`, ou seja, chave paga. Usar a EVE é **decisão do fundador**. Se ele decidir, troca-se o provedor do apelido em `models.yaml`, por exemplo para `openai`, e a EVE passa a aceitar as fichas sem ferramenta.

**Por que Clara e Ravi ficam no Hermes.** O nosso servidor de ferramentas (`motor/ferramentas`, com `buscar` e `ler_pagina`) ainda não está ligado ao OpenClaw nem à EVE (NÃO FEITO). Os dois adaptadores recusam ficha com ferramenta sem lançar nada, e a classe da falha é FERRAMENTA, que não gasta tentativa.

## Hermes (aprovado)

- Variáveis: `HELENA_V2_HERMES_BIN`, `HELENA_V2_HERMES_HOME` e `HELENA_V2_EXECUCOES_DIR`.
- O que ainda falta: o Hermes real continua NÃO COMPROVADO. Ele só se prova no dia de prova (`docs/manual/dia-de-prova.md`, `motor/executor/verificacao_real/`).

## OpenClaw (pronto para conectar)

Adaptador: `motor/executor/executor_helena/adaptador_openclaw.py`. Documentação lida: OpenClaw 2026.10.3.

**Como roda.** Cada execução usa `openclaw agent exec`: um turno embutido, sem Gateway. Os detalhes:

- **Config fixada por execução**:
  - `--config` com `tools.deny: ["*"]`, que nega todas as ferramentas;
  - `--model openai/<modelo da ficha>`;
  - `--json`.
- **Sem modelo reserva**: o adaptador nunca passa `--fallback`.
- **Credencial**: não usa `--auth-env-only`, porque essa opção pula o login da assinatura.
- **Isolamento**:
  - ambiente montado do zero, sem segredo;
  - `HOME` vazio;
  - pasta de trabalho vazia.
- **Tempo**:
  - o **nosso** relógio corta no tempo da ficha e mata o grupo de processos;
  - o `--timeout` do OpenClaw fica só de reserva.

**Para conectar** (o fundador, depois da frase de autorização):

1. Instalar o OpenClaw no servidor da v2 e anotar o caminho absoluto do binário.
2. Criar uma pasta só para a v2, por exemplo `/srv/helena-v2/openclaw-home`, e fazer nela o login da assinatura, uma única conta:
   ```sh
   OPENCLAW_HOME=/srv/helena-v2/openclaw-home openclaw models auth login --provider openai --device-code
   ```
3. Preencher `HELENA_V2_OPENCLAW_BIN`, `HELENA_V2_OPENCLAW_HOME` e `HELENA_V2_EXECUCOES_DIR`. São caminhos, não segredos. Opcional: `HELENA_V2_OPENCLAW_PATH`, se o `node` não estiver na pasta do binário.
4. Rodar `conferir-runtime` e conferir que as variáveis não aparecem mais em `variaveis_faltando`.

**O que provar no dia de prova.** Enquanto isso não for provado, o OpenClaw continua recusado em produção:

- **Envelope e classificação**:
  - o envelope real é igual ao documentado;
  - os valores reais de `error.kind` para cota, login e queda (a documentação não publica a lista; hoje, kind desconhecido vira DESCONHECIDA).
- **Assinatura**: o `provider` volta `openai` com a assinatura, e não com chave paga. O OpenClaw usa o mesmo nome para os dois, então isso não dá para provar só pelo envelope.
- **Contas e reserva**: com uma pasta e um só login, ele não troca de conta nem de modelo sozinho.
- **Encerramento**: cancelar encerra tudo em até 15 s, sem processo filho sobrando.
- **Ferramentas**: `tools.deny: ["*"]` realmente deixa o modelo sem ferramenta.

## EVE (pronta para conectar, bloqueada pela assinatura)

Adaptador: `motor/executor/executor_helena/adaptador_eve.py`. Documentação lida: pacote npm `eve@0.79.0`, publicado em 13/10/2026.

**Como roda.** O adaptador fala com um servidor da EVE já ligado (`eve build` e `eve start`, ou um deploy):

1. Cria a sessão: `POST /eve/v1/session`, com a identidade da ficha mais o pacote.
2. Lê o fluxo NDJSON da sessão (`GET .../stream`).
3. Corta no tempo da ficha: pede o cancelamento com `POST .../cancel` e espera `turn.cancelled` por até 15 s.

O que ele confere:
- o `modelId` de **cada** passo, e recusa troca de modelo no meio;
- qualquer pedido de ferramenta conta como violação;
- os eventos concluídos são guardados como conversa.

**Para conectar** (depois da decisão sobre chave paga e da frase de autorização):

1. Criar o agente da EVE sem nenhuma ferramenta própria. A rota precisa exigir uma credencial: em `agent/channels/eve.ts`, um verificador de bearer, por exemplo `jwtHmac()` (`guides/auth-and-route-protection.md`). Nunca deixar só `localDev()` nem `placeholderAuth()`.
2. Desligar a telemetria da linha de comando da EVE com `EVE_TELEMETRY_DISABLED=1`.
3. Preencher `HELENA_V2_EVE_URL` (https) e `HELENA_V2_EVE_TOKEN`. O token é segredo: nunca em código, log, relatório ou conversa.
4. Trocar o provedor do apelido em `models.yaml`, se o fundador aprovar chave paga.
5. Rodar `conferir-runtime`.

**O que provar no dia de prova**:

- **Cancelamento e credencial**:
  - o cancelamento real confirma em até 15 s;
  - a rota recusa pedido sem credencial.
- **Erros**: os detalhes de erro (`statusCode`, `semanticErrorId`) aparecem como no código do pacote. Eles foram lidos do código, e não da documentação.
- **Ferramentas**: o agente não recebe ferramenta embutida (`eve__*`, busca do provedor).
- **Reserva do AI Gateway**: a reserva interna do AI Gateway não troca o modelo sem aparecer no `step.started`. Hoje isso é NÃO CONFIRMADO: a EVE repete cada passo até 4 vezes.

## O que falta para "todos os agentes em todos os runtimes"

1. **Ferramentas fora do Hermes.** Ligar o nosso servidor de ferramentas no OpenClaw (MCP configurado) e na EVE (ferramenta na pasta `agent/`), com a lista exata e a prova do que o modelo recebeu. NÃO FEITO.
2. **Decisão do fundador sobre a EVE**: ficar só com a assinatura (EVE fora) ou aprovar chave paga para ela.
3. **Dia de prova de cada runtime**: a frase exata do fundador, cada garantia provada, e o pull request que move o adaptador para `APROVADOS`.
