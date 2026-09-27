# Integração Hermes e Supabase — 27/09/2026

## Fluxo implementado

Supabase é a fonte canônica. Não há fila paralela no Kanban.

1. `get_work_context`: identidade, papel, checkpoint atual, tarefas, encaminhamentos e revisões pendentes.
2. `create_task_job`: Helena/Marina cria, na mesma transação, tarefa visível, job em DRAFT e handoff.
3. `release_job`: coordenação libera uma execução com executor ativo. WIP global 1 e máximo de duas tentativas.
4. `claim_job` e `start_job`: aceite e início reais; o cartão passa a EM EXECUÇÃO.
5. `record_progress` e `record_memory`: ação, motivo de negócio, evidência, fonte e próximo passo ficam no banco.
6. `submit_delivery`: exige versão lida e evidência; tarefa fica BLOQUEADA aguardando o revisor designado, sem alegar conclusão.
7. `get_job` traz o conteúdo das memórias citadas na entrega, filtrado pelo job e pela empresa, e sinaliza `evidence_missing`. `review_delivery`: revisor da função ou Helena aprova ou devolve; não há autoaprovação. Aprovação fecha tarefa e encaminhamento.
8. `handoff_task`: após revisão, cria a tarefa do próximo responsável com origem e evidência. Continua DRAFT até liberação.

Todas as etapas usam horário do servidor com segundos. Escritas de tarefa usam `row_version`; repetição idêntica usa chave de idempotência; chave repetida com conteúdo diferente é recusada. Uma entrega só gera um próximo encaminhamento; cada cadeia tem até dez jobs. Falhas não reiniciam modelos automaticamente.

## Identidades

Cada perfil recebe um token próprio. O Gateway só guarda o SHA256 na tabela `agent_runtime_credentials`, sem acesso para `anon` ou `authenticated`; a chave fica no `.env` do perfil. O vínculo em `agent_runtime_bindings` é verificado a cada operação. Credencial cadastrada não ativa o vínculo. Não distribuir service_role ou token administrativo.

Helena acompanha empresas; os 19 especialistas empresariais ficam em BIZ-003. Laura permanece fora da fila empresarial e recebe somente a ferramenta de contexto nesta etapa. Gravação pessoal e gravações gerais em CRM, financeiro, produto e demais tabelas de função ainda exigem contratos específicos. O mapeamento descritivo de uma tabela não é permissão de escrita.

## Provisionamento executado e autenticacao validada

Arquivo: `scripts/configurar_perfis.py`. Executar **no host do Hermes Hostinger**, onde existem `/data/profiles/...`, nunca presumir que o serviço homônimo no EasyPanel é a mesma instalação.

O modo padrão simula. `--apply` faz backup privado, preserva modelo/OAuth/configurações existentes, gera tokens individuais, adiciona MCP `helena_operacao`, anexa protocolo a SOUL.md e confere a gravação. Reexecução preserva tokens. Não ativa vínculos, não cria agenda, não inicia tarefas e não imprime segredos. O manifesto `/data/helena-runtime/manifest-publico.json` contém somente perfil e hash.

Operador executou o instalador em 27/09/2026. Backup: `/data/helena-runtime/backup-20260927T103719643399Z`. Foram registrados 21 hashes no Supabase; 21 autenticações `tools/list` passaram e `get_work_context` recusou corretamente o perfil inativo. Relatório: `/data/helena-runtime/verificacao-publica.json`. O filtro MCP foi corrigido para incluir `fail_job` e `waiting_helena` nos 20 perfis empresariais; Laura continua limitada a contexto. Quatro vínculos estão ACTIVE (Helena, Pedro, Clara e Victor); 17 permanecem CONFIGURED.

Piloto real BIZ-003: Helena criou/liberou `JOB-HR-3ebae4abff11a58e457fe779e15705ab`; Pedro assumiu manualmente, registrou progresso e a memória `MEM-HR-6d4c9666d8b09fa03a1162edf949d6ce`, e submeteu. Clara leu o conteúdo pelo MCP, encontrou `evidence_missing` vazio e aprovou **somente o modelo interno de checklist**, sem validar termos de parceiros. Pedro fez `handoff_task` para Victor, criando `JOB-HR-0e91cf1982fa751ce1e4cf93e7af48d7` em DRAFT; Victor confirmou leitura no próprio perfil. O Supabase confirmou job pai COMPLETED/tarefa CONCLUÍDA e filho DRAFT/tarefa NÃO INICIADA. Nenhuma campanha ou contato externo foi feito.

Gateway `3935f92` publicado no EasyPanel, health OK. Ainda falta o acionador real do Hermes: liberar READY não inicia o modelo; o piloto exigiu abrir manualmente o perfil Pedro. O API server documentado do Hermes estava desativado nesta instalação durante o piloto. Nenhum worker/cron novo foi criado. Checkpoint ativo: `CP-20260927-V020`.

## Validação

- Testes Node/HTTP, autenticação e integrações existentes.
- `test/workflow-rollback.sql`: fluxo inteiro no banco, com rollback; inclui recusa de versão antiga, empresa errada, autoaprovação, duplicidade, WIP excedido e terceira tentativa.
- `test/provision_profiles_test.py`: simulação, repetição, preservação do modelo/configurações, ausência de segredo em logs e falha antes de escrever se falta um perfil.

Passaram 97 testes Node, incluindo 12 HTTP, e 22 testes de integração/segurança, além do piloto real acima. Isso não comprova acionamento automático, escrita nas tabelas empresariais de cada função nem limite financeiro mensal. Os 23 jobs legados aguardando Helena permanecem retidos e precisam revisão individual.

Referências oficiais: [MCP Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp), [API Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [funções Supabase](https://supabase.com/docs/guides/database/functions).
