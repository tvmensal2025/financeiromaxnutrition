# Diagnóstico de continuidade — 01/10/2026

Verificação de leitura no servidor Hermes e no Gateway, sem chamadas a modelos ou alterações de tarefas.

## Estado confirmado

- JOB-HR-fd62fc9a1659086444127a218432d958: DRAFT, aprovação PENDING, versão de tarefa 3655; atualizado em 2026-10-01T11:58:01.327413Z. Nenhum artefato e nenhum evento nas seções do manifesto.
- Instalação de autonomia: INSTALLED, 21 perfis conferidos. O recibo explicitamente informa jobs_changed=false e schedule_changed=false.
- Nenhuma nova sessão da Maya vinculada a esta execução foi demonstrada; as três sessões mais recentes consultadas são anteriores à criação da sucessora.
- workflow-state.json ainda tem como pendência o HANDOFF do relatório JOB-HR-4c1ad7a12227adf8c2ab535120692df5. A sucessora fd62 não aparece em pending.
- workflow-config.json não inclui fd62 em adopt_job_ids.
- workflow-last-result.json, de 12:00:48Z, registra LAUNCHER_UNAVAILABLE/RUNTIME_SYNTAX para o relatório 4c1. Os arquivos de execução foram atualizados às 12:12:04Z; ambos passam no parser de sintaxe Python atual. Isso não prova uma nova execução bem-sucedida do lançador.

## Lacuna identificada

O despachante executa tarefas READY com aprovação vigente. Criar uma tarefa DRAFT não libera sua execução. A seleção de continuidade consulta pendências persistidas, revisões pendentes e IDs adotados; uma tarefa criada por chamada externa pode ficar fora desse conjunto. A existência do corte new_jobs_after autoriza elegibilidade, mas não equivale a descoberta de todas as novas tarefas DRAFT.

Assim, corrigir tamanho de briefing e instalar orientação de autonomia não completou a passagem criação → coordenação → liberação → execução. A causa atual é uma continuidade ainda não registrada/concluída; não foi demonstrada uma nova falha de geração de imagem.

## Critério para encerrar a correção

Reconciliar pelo ID da tarefa e pela chave de idempotência, confirmar a sucessora já existente sem recriá-la, encaminhá-la à coordenação autorizada, validar briefing/insumos/ferramentas e liberar somente se os critérios forem satisfeitos. Depois demonstrar READY → execução Maya → revisão Nina → ajustes se necessários → aprovação final e pacote utilizável. Não reiniciar tarefas com tentativas esgotadas, alterar permissões, aprovar automaticamente nem ampliar orçamento para resolver a descoberta da fila.

O resultado antigo do lançador precisa ser superado por uma execução nova comprovada. Regras instaladas não constituem prova de recuperação autônoma nem de funcionamento integral dos 21 agentes.
