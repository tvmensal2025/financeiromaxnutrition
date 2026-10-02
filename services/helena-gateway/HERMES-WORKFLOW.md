# Integração Hermes e Supabase — 27/09/2026

## Fluxo implementado

Supabase é a fonte canônica. Não há fila paralela executável no Kanban.

### Quadro Hermes de acompanhamento (02/10/2026)

O Kanban nativo do Hermes é um banco separado e começa vazio; não recebe automaticamente os jobs do Gateway. O espelho `scripts/helena_kanban_mirror.py` lê `kanban_snapshot` com a credencial individual da Helena, cria um quadro por empresa e um cartão por `job_id` usando chave idempotente. Copia apenas objetivo e metadados curtos; não copia instrução, resultado, evidências nem jobs pessoais. O perfil vinculado aparece no cartão. Se o vínculo estiver ausente, o cartão fica bloqueado e sem responsável; nunca presume outro agente.

O quadro é somente acompanhamento. `scripts/install_kanban_mirror_guard.py` configura `kanban.dispatch_profiles: []` no sistema e nos 21 perfis, preservando backups, e mantém `dispatch_in_gateway: false`. A cada sincronização, a trava é revalidada antes de escrever. Assim, inclusive o comando manual de despacho do Kanban não deve escolher estes cartões; apenas o Gateway/Supabase pode liberar e executar trabalho. Alterar o cartão no Kanban não aprova, delega, reprime ou atualiza o job original: a próxima sincronização repõe a situação oficial. A aprovação e a revisão continuam pelas ferramentas do Gateway. Se a leitura falhar, o quadro conserva o último retrato e a sincronização sai com erro; não inventa estado novo.

Estados espelhados: DRAFT/WAITING_APPROVAL/FAILED/CANCELLED → blocked; SCHEDULED → scheduled; READY → ready; CLAIMED/RUNNING → running; WAITING_HELENA → review; COMPLETED → done. O status no cartão mostra o estado técnico do job, não a aprovação comercial da entrega. O quadro `default` do Hermes continua separado; selecionar `helena-biz-003` para Humano Digital.

Implantação de 02/10/2026: Gateway `ff21f96` publicado pelo EasyPanel. No Hermes, o instalador verificou exatamente 21 perfis e aplicou a lista vazia de despacho em 22 arquivos de configuração (sistema + perfis), com 22 backups. Um ensaio sem escrita encontrou 42 jobs de duas empresas; a primeira sincronização criou 7 cartões em `helena-biz-001` e 35 em `helena-biz-003`. Repetição idempotente manteve 35 no quadro do Humano Digital. O Hermes cron `3fc108674435`, `helena-kanban-mirror`, foi criado em modo `no-agent` a cada 5 minutos. Seu script é `/data/scripts/helena_kanban_mirror.sh`; o último recibo bem-sucedido fica em `/data/helena-runtime/kanban-last-sync.json`. O cron técnico anterior `helena-gateway-poll` continua independente. Verificar o `Last run` do novo cron após a primeira rodada automática antes de afirmar continuidade agendada.

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

Gateway `3179502` publicado no EasyPanel durante o piloto, health OK naquela verificação; a mensagem da fila segue o fluxo Hermes V2 com `submit_delivery` e revisão. Liberar READY ainda não inicia o modelo; o piloto exigiu abrir manualmente o perfil Pedro. O API server documentado do Hermes estava desativado nesta instalação durante o piloto. Nenhum worker/cron novo foi criado. A página local mostra o aceite da Clara, o motivo e os eventos; a correção do frontend ainda não foi commitada ou publicada. Após instalar e consultar o acionador, o checkpoint ativo foi sincronizado para `CP-20260928-V026`. A versão atualmente implantada do Gateway não foi revalidada após as mudanças posteriores de voz.

## Acionador pontual preparado

`scripts/hermes_dispatch_once.py` foi copiado para `/data/helena-runtime/hermes_dispatch_once.py` no host do Hermes. O arquivo fica **desligado por padrão**: sem `--job-id`, consulta apenas a contagem da fila; com `--job-id`, confere job READY, tarefa, empresa e vínculo ACTIVE sem alterar o banco. `--execute` só funciona com `HELENA_DISPATCH_ENABLED=1`, exige o ID exato, usa lock local, confirma `claim_job` e `start_job` antes de chamar o perfil uma única vez, com máximo de 12 turnos e 180 segundos. A sessão Hermes recebe somente o toolset dinâmico `mcp-helena_operacao`, sem terminal, web ou delegação. Depois relê o estado no Gateway; se não houver entrega confirmada, registra falha em vez de declarar sucesso. Não existe cron, loop contínuo, auto-retry ou execução dos 23 legados.

O arquivo e a leitura da fila foram validados **no host** sem consumir modelo. O CLI instalado também aceitou a seleção do perfil Pedro e exibiu os parâmetros usados pelo despachante (`--query-file`, `--oneshot`, `--toolsets`, `--max-turns`). Em 28/09, um piloto técnico novo e isolado (`JOB-HR-086da9551ac8c1ea633056348daea71c`, BIZ-003/Pedro) passou por READY, CLAIMED e RUNNING, mas o processo Hermes saiu com código 1 sem entregar; o despachante registrou FAILED em vez de repetir ou alegar sucesso. Os logs do perfil confirmaram HTTP 429 `usage_limit_reached` no provedor `openai-codex` para `gpt-6-luna`; a janela de sessão estava em 100% (semanal em 47%). O reset informado pelo provedor foi 2026-09-28 08:48:49 UTC. O job de Victor continua DRAFT até liberação explícita, e os outros 17 vínculos continuam CONFIGURED. O limite mensal de custo e os contratos de escrita nas tabelas de CRM/financeiro/produto por função ainda não foram definidos.

## Validação

Atualização de 28/09/2026: o acionador agora retorna reconciliação com ID do job e etapa quando perde a resposta de aceite, início, consulta da entrega ou registro de falha. Não repete a chamada nem inicia outro modelo. Grava recibo local privado `dispatcher-last-result.json` com data, hora e segundos UTC, sem credenciais. Esse recibo não substitui os eventos no Supabase e não cobre encerramento forçado do processo antes da gravação. Os 16 testes Python passaram (13 do acionador e 3 do provisionamento). A revisão `2f0603d` foi instalada no novo host Hermes Hostinger. O SHA-256 remoto de `/data/helena-runtime/hermes_dispatch_once.py` coincidiu com o arquivo testado no checkout local (`0ea3075668b9126fe63a09c12c471786d413e1b562774b2be525fded89ebe10a`). O comando padrão no host retornou `DRY_RUN_QUEUE_ONLY` com `ready_count: 0`. Esse teste confirma leitura da fila pelo Gateway sem iniciar modelo; ainda não comprova `claim_job`, `start_job` ou entrega automática de um job READY. O acionador permanece desligado por padrão, sem cron e sem liberar os jobs legados.

Após o piloto falhar, o código local passou a classificar apenas o tipo de erro do CLI (limite de cota, autenticação, configuração ou desconhecido), descartando a saída bruta que pode conter informações sensíveis. Acrescentou-se uma leitura prévia de `hermes usage --json` para recusar `claim_job` quando qualquer janela estiver em 95% ou mais ou quando a leitura não for confiável. Os 20 testes Python passaram. **Esta revisão ainda precisa ser instalada e validada no host**. O acionador segue sem cron e só executa com `--job-id` exato e habilitação explícita.

- Testes Node/HTTP, autenticação e integrações existentes.
- `test/workflow-rollback.sql`: fluxo inteiro no banco, com rollback; inclui recusa de versão antiga, empresa errada, autoaprovação, duplicidade, WIP excedido e terceira tentativa.
- `test/provision_profiles_test.py`: simulação, repetição, preservação do modelo/configurações, ausência de segredo em logs e falha antes de escrever se falta um perfil.

Passaram 97 testes Node, incluindo 12 HTTP, e 22 testes de integração/segurança, além do piloto real acima. Isso não comprova acionamento automático, escrita nas tabelas empresariais de cada função nem limite financeiro mensal. Os 23 jobs legados aguardando Helena permanecem retidos e precisam revisão individual.

Referências oficiais: [MCP Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp), [API Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [funções Supabase](https://supabase.com/docs/guides/database/functions).
