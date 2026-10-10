# Ciclo real solicitado pelo fundador em 01/10/2026

Pedido: executar um ciclo completo na campanha existente da Humano Digital.

## Estado confirmado antes da retomada

- Job de coordenação Marina: `JOB-HR-794692b1e94a8ee7aa1b0f1268b1ed2b`.
- Supabase: FAILED / HERMES_PROCESS_FAILED, diagnóstico UNKNOWN, tentativa 1/2, sem evidências, atualizado em `2026-10-01T02:51:50.353884Z`, tarefa versão 3614.
- O arquivo original e os jobs visuais esgotados não foram reiniciados.
- Resolução do perfil pela chamada nativa e parser do CLI passaram sem inferência. Entrada vazia foi recusada antes de iniciar conversa. Não há hooks no config da Marina.

## Retomada controlada aplicada

Foi aplicada uma transação específica do mesmo pedido com bloqueio de WIP e verificação de identidade, versão, status, timestamp, evidências e orçamento de tentativas. Evento `OPERATOR_CONTROLLED_RETRY`, chave `marina-full-cycle-20261001-v1`.

Resultado confirmado no Supabase: DRAFT, aprovação pendente, tentativa 1/2 preservada, tarefa versão 3618. Nenhum novo job, reset de tentativas ou aprovação de entrega.

A causa da inicialização anterior continua **não confirmada**. Esta retomada não representa uma declaração de correção dessa causa: é uma execução manual limitada solicitada pelo fundador, após instalação do runtime delimitado, com captura de diagnóstico na coordenação.

## Acompanhamento

- A primeira consulta do workflow retornou NO_NEW_REVIEW sem iniciar IA: um DRAFT recuperado não é selecionado sem continuação persistida.
- A continuação COORDINATE do mesmo job foi persistida usando o mecanismo existente.
- A primeira ativação pelo terminal recusou Execution is disabled antes da inferência. O terminal não herda o sinal usado pelo poll. Uma chamada pontual autorizada definiu o sinal apenas para seu processo.
- `/data/helena-runtime/observe_cycle_once.py` mantém o bloqueio do despachante, usa os parâmetros nativos existentes e captura linhas de erro redigidas em arquivo privado na falha. Não altera o modelo, permissões, cron ou tentativas.
- Liberação, execução da Marina, revisão e encaminhamento ainda precisam ser confirmados por eventos reais. Não declarar ciclo encerrado a partir de parser, preflight ou uma chamada iniciada.

## Resultado real confirmado posteriormente

- Helena COORDINATE: CONFIRMED, saída 0, job READY. Evento WORKFLOW_release_job em 2026-10-01T08:47:29.517010Z.
- Marina assumiu em 08:49:24.333823Z e iniciou em 08:49:25.452660Z. Processo terminou com saída 0 e job WAITING_HELENA, tentativa 2/2.
- Marina registrou PROGRESS e WAITING_HELENA, pedindo confirmação do mecanismo de inspeção de Maya/Nina e do responsável técnico. Não submeteu entrega nem gerou novas imagens. Logo, revisão e conclusão **não ocorreram**.
- get_work_context autenticado individualmente confirmou Maya AGT-12 e Nina AGT-10 ACTIVE, BUSINESS/BIZ-003, contexto v2 não truncado.
- Maya conseguiu get_job view=manifest no original c392de57. A leitura integral sem view retornou HTTP 400, não indicando vínculo inativo.
- Nina recebeu HTTP 400 com mensagem explícita `Job pertence a outro agente` para o original c392de57.
- Consulta direta do result_payload do original confirmou um bloqueio por decisão: não existe reviewer_agent_id/review_pending da submissão. A RPC vigente só atribui Nina ao ocorrer submit_delivery. A regra de leitura corretamente não concedeu acesso à Nina a partir de uma menção textual no briefing.

Não ampliar acesso geral, fingir submissão, atribuir este problema ao modelo ou zerar tentativas. A continuidade exige um fluxo explícito para inspeção de produção interrompida antes da submissão, com designação e escopo registrados, ou replanejamento legítimo da coordenação. A simples ativação dos perfis não resolve essa transição.
