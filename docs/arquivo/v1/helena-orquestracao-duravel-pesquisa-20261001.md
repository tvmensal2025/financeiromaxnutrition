# Pesquisa e recomendação de continuidade — Sistema Helena

Data: 01/10/2026. Este documento é uma proposta técnica, não uma implantação ou declaração de homologação. Pesquisa baseada em documentação oficial e no código local. O estado vivo da tarefa foi consultado na análise anterior; não houve nova consulta de produção nesta pesquisa.

## Recomendação

Fechar a continuidade no Gateway e no Supabase com uma máquina de estados persistida e um consumidor dedicado no EasyPanel. Manter Hermes como executor dos perfis, Supabase como fonte canônica e R2 como repositório de arquivos. Avaliar Supabase Queues/PGMQ apenas após conferir disponibilidade e os contratos existentes; não criar uma segunda fila concorrente sem necessidade. Usar n8n posteriormente para integrações e acompanhamento visual, se isso trouxer benefício operacional. Temporal é alternativa forte para execução durável em uma migração planejada, mas não é necessário para corrigir a lacuna atual.

## Evidência local

- `hermes_workflow_tick.py`: a seleção combina pendências em JSON local, revisões pendentes e IDs adotados. O corte de data limita elegibilidade, mas não descobre por si só todos os DRAFT recém-criados.
- `enqueue_follow`: registra continuação no arquivo local após observar o resultado. Essa coordenação deve poder ser reconstruída a partir dos registros canônicos mesmo se a sessão morrer, o arquivo desaparecer ou a tarefa vier de uma chamada externa.
- `20261001090000_durable_agent_recovery.sql`: a consulta proposta considera FAILED, WAITING_HELENA e CLAIMED/RUNNING antigos; não inclui DRAFT. A existência da migration no repositório não comprova sua aplicação em produção.
- A tarefa fd62 permaneceu DRAFT/PENDING na última consulta; instalar instruções em SOUL não libera sua execução.

## Comparação

- Supabase/Postgres + consumidor Gateway: aproveita a fonte canônica e os controles existentes. É a recomendação para o escopo atual, por julgamento de integração e migração, não por benchmark universal. Exige concluir e testar a lógica de transição, concorrência e retomada.
- n8n: oferece fluxos visuais, espera persistida no banco, retomada por webhook e fluxos de tratamento de erro. Queue mode usa Redis, banco e workers. Os contratos de aprovação, deduplicação de chamadas pagas e isolamento de empresas continuam sendo responsabilidade da integração. N8n não transforma automaticamente um rascunho em execução autorizada.
- Temporal: oferece workflows, activities, workers, timeouts e políticas de retry; é apropriado para processos duradouros com falhas e retomada. A integração com Hermes, permissões e efeitos externos ainda precisa ser escrita. Maior mudança arquitetural no projeto atual.
- BullMQ: fornece fila e mecanismos de detecção de tarefas travadas. Exige implementar o fluxo de negócio; sua documentação pede que os jobs sejam idempotentes. Não elimina a necessidade dos contratos de aprovação.

## Contrato de continuidade proposto

1. Toda criação e transição grava o estado e a próxima ação na mesma transação do banco, com uma chave estável por tarefa, etapa e versão. Reaproveitar estruturas existentes onde cumpram esse papel.
2. Um único consumidor lógico descobre todas as ações elegíveis dentro das empresas e autorizações permitidas, sem depender de listas manuais ou de uma conversa aberta. A coordenação ainda valida e libera; descobrir uma ação não significa aprová-la.
3. Cada execução obtém uma reserva com prazo e renovação de atividade. Só um executor pode possuir a mesma etapa; respeitar WIP e limite de tentativas.
4. Antes de qualquer chamada paga, gravar intenção, sessão/identificador quando disponível e orçamento autorizado. Após uma resposta incerta, reconciliar estado e registros do provedor antes de decidir por repetição.
5. Separar conclusão da produção, aprovação da revisão e conclusão do pacote. Um relatório interno aprovado não conclui a campanha.
6. REQUEST_CHANGES guarda achado, peça/versão, correção e critério de aceite, encaminha ao produtor e volta para revisão independente após nova entrega.
7. Um verificador sem IA detecta pendências e atividade vencida. Intervalo sugerido inicial: 1–2 minutos, ajustado à carga e aos limites do serviço. Não aciona os 21 modelos por intervalo e não repete geração incerta.
8. Manter bloqueio explícito com causa, dono e ação necessária quando faltar informação, credencial, permissão ou orçamento. Isso é diferente de uma tarefa esquecida.
9. Entrega ao fundador exige pacote final aprovado com arquivos acessíveis, copy utilizável e canal/CTA confirmado quando necessário; relatório técnico fica no acompanhamento interno.

## Primeiro recorte de implantação

Corrigir descoberta de DRAFT autorizado e recuperar a tarefa existente fd62 sem recriá-la. Persistir a continuidade canônica, ligar um consumidor supervisionado e validar a liberação da Helena. Depois testar produção Maya, revisão Nina, uma devolução com apontamentos e nova revisão. Expandir o mesmo mecanismo para os outros perfis mantendo regras específicas de cada função, empresa e escopo pessoal. Não colocar todos os 21 agentes em toda tarefa.

## Testes que precisam passar

- Tarefa criada fora do consumidor é descoberta e encaminhada à coordenação.
- Falha após salvar a tarefa, antes de encaminhar, é recuperada.
- Dois consumidores ou evento duplicado não iniciam dois trabalhos.
- Queda após iniciar chamada paga não dispara repetição automática incerta.
- Devolução com REQUEST_CHANGES retorna ao produtor, preserva histórico e passa por revisão da nova versão.
- Permissão, empresa e escopo pessoal são respeitados em toda transição.
- Reinício do serviço recupera pendências sem depender de JSON local.
- Pacote final contém imagem real, logo correto, copy final e links acessíveis; falha visual não é aprovada por existir um PNG.

Começar com testes determinísticos e executores simulados sem IA. Só após esses testes passar executar uma campanha controlada real. Não existe promessa de ausência total de erros; o critério é recuperação demonstrada, deduplicação e bloqueios acionáveis.

## Fontes oficiais consultadas

- Supabase Queues: https://supabase.com/docs/guides/queues
- n8n queue mode: https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode.md
- n8n Wait: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait.md
- n8n tratamento de erros: https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md
- n8n armazenamento externo: https://docs.n8n.io/hosting/scaling/external-storage/
- Temporal primitivas: https://docs.temporal.io/evaluate/features/core-primitives
- Temporal timeouts e retries: https://docs.temporal.io/evaluate/features/timeouts-and-retries
- BullMQ idempotência: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ tarefas travadas: https://docs.bullmq.io/guide/workers/stalled-jobs

Nota sobre arquivos: se n8n for usado, os workflows podem transportar referências privadas do R2 enquanto o Gateway mantém upload e geração. Isso evita passar imagens/base64 pelo contexto e não depende de usar o armazenamento binário interno do n8n. O recurso próprio de armazenamento externo tem condições de licença específicas; conferir a edição antes de adotá-lo.
