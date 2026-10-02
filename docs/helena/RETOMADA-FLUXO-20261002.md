# Continuidade verificada do fluxo Helena — 02/10/2026

Este registro complementa MAPA-PONTA-A-PONTA-20261002.md. Estado atual do Supabase e recibos do Hermes continuam tendo precedência. Não confundir regras instaladas em 21 perfis com 21 ciclos reais homologados.

## Pedido e limite de atuação

Campanha `HD-CASA-POST-STORY-20261002`, Humano Digital/BIZ-003: **um post 1080×1350 e um story 1080×1920**, para revisão interna. Sem publicação, links inventados, contato com clientes, pagamento ou assinatura. Preservar identidade aprovada, logo único, copy utilizável e imagens realmente inspecionadas. Não duplicar a campanha antiga de quatro peças.

## Falhas comprovadas e correções

1. **Revisão recusada por critérios reescritos.** Augusto executou a sessão `20261002_165118_9e116f`; a ferramenta recusou a correspondência exata dos critérios e um campo acima de 300 caracteres. O erro não era ausência de uma tarefa separada para o revisor. O revisor atua sobre a entrega do produtor.
   - Commit `d7be961`, implantado no Gateway. `get_job.review_contract` fornece IDs curtos e estáveis de critérios e referências exatas da versão. O agente deve acrescentar seu próprio parecer após inspeção. O Gateway converte IDs para o texto canônico antes do banco; não enfraquece o aceite.
   - Migration `20261002173800_workflow_review_recovery.sql` aplicada no Supabase canônico. Permite uma recuperação auditada exclusivamente de REVIEW com recusa de contrato comprovada, snapshot e recibo originais. Preserva histórico, tentativas de produção, escopo e WIP. Falha incerta/timeout não autoriza repetição.
   - Regra instalada nos 21 SOUL.md, hashes atualizados; recibo remoto `/data/helena-runtime/review-contract-install.json`. Backup `review-contract-backup-20261002T182222971604Z`; 24 arquivos alterados, zero chamadas de modelo na instalação.
2. **Contexto acima do limite antes do handoff.** A estratégia aprovada acrescentou conteúdo ao pacote e excedeu 65.000 caracteres. A parada ocorreu antes de nova inferência.
   - `hermes_execution_context.py` agora compartilha valores grandes rigorosamente idênticos mediante referências internas explícitas. Não resume nem corta copy, critérios ou fontes. Valores parecidos permanecem separados.
   - Pacote real de HANDOFF validado com **54.324 caracteres**, cinco referências exatas e `truncated=false`. Correção instalada às 18:35:23 UTC, com backup e hash conferidos. Recibo `exact-references-install.json`.
3. **Encerramento final inconsistente.** O banco e a descoberta de fila já liam `delivery.stage=FINAL`, mas o contrato de submissão não aceitava esse campo e a revisão final enfileirava HANDOFF.
   - Commit `2d53002`: contrato aceita INTERMEDIATE/FINAL; aprovação independente de FINAL termina em DELIVERED, sem novo handoff. REQUEST_CHANGES continua retornando à coordenação. Marcar FINAL não aprova nem publica e não substitui o pacote completo.
   - Gateway implantado. Consumidor instalado às 18:56:41 UTC, após aguardar a trava da rodada; recibo `completion-install.json`, três arquivos alterados e backup `review-contract-backup-20261002T185641276661Z`.
4. **Correção dependia da aprovação do próprio material reprovado.** A memória própria da copy devolvida aparecia em `evidence_records`, mas o leitor classificava qualquer MEM citado no briefing como fonte externa aprovada. Isso gerava `input_evidence_missing` e a Helena reeditou o briefing três vezes sem liberar.
   - Commit `f89dedf`, implantado no Gateway (16 segundos). `revision_evidence_records` separa memórias explicitamente citadas da própria tarefa/empresa, marcadas `REVISION_ONLY`, sem `approved_output`. Podem servir à correção; nunca se tornam fonte externa aprovada por esse mecanismo. Outra tarefa/empresa continua recusada. Os testes preservam esses limites.
   - O pacote do controlador informa se o briefing já foi corrigido para o parecer atual. Orienta conferir e liberar, sem reescrever para repetir a mesma pendência. Conferir recibo `revision-evidence-install.json` para o estado da instalação remota mais recente.
5. **Vigilância de exceções não estava instalada.** Migration `20261002190500_queue_attention_workflow.sql` aplicada e testes com rollback aprovados. Leitor e escritor aceitam apenas coordenação autorizada, registram alerta idempotente e não mudam jobs, tentativas ou aprovações. Recibos antigos de snapshots já superados não geram falso bloqueio.
   - `hermes_queue_watchdog.py` instalado às 19:07:24 UTC, integrado ao poll existente; recibo `queue-watchdog-install.json`. Hash `ada93f1f04ce59d4b0f008781c059dc4336de3419625c71ec0da1c0754b83ef6`.
   - O monitor não chama IA e não repete automaticamente falhas desconhecidas. Sua falha não deve impedir o dispatcher: invocação contém `|| true`. É necessário conferir a execução automática pelo arquivo `queue-watchdog-last-result.json`; instalação sozinha não comprova agendamento executado.

## Provas da execução real

- Estratégia de Camila: `JOB-HR-20b2a6f253ee5c5377e994e8da2b8595`.
- Diagnóstico antigo vinculado ao recibo somente após conferir sessão, erro, snapshot 3722 e revisor AGT-03. Uma recuperação, sem reiniciar produção.
- **18:26:39 UTC:** revisão aprovada por Augusto (AGT-03), sessão `20261002_182608_54c147`; estratégia COMPLETED, versão 3725.
- **18:40:05 UTC:** Helena gravou o handoff para a copy, sucessora única `JOB-HR-070661329e98fdb5f1c39c81e0cbabe7`, responsável Isabela (AGT-17).
- **18:46:10 UTC:** Isabela submeteu a copy; memória própria `MEM-HR-34f03999c5c41f33fca2eef599815166`.
- **18:47:40 UTC:** Camila (AGT-16) fez revisão independente e pediu ajustes; a mesma tarefa voltou a DRAFT, versão 3739. A devolução é uma decisão de qualidade, não uma falha de transporte.
- **18:48:31 UTC:** consumidor iniciou COORDINATE com Helena para tratar os apontamentos. Não há prova de arte final aprovada neste ponto.

## Verificações

- Suíte atual do Gateway: 319 testes Node aprovados; servidor e 29 verificações de integração também passaram.
- Python atual: 237 testes executados, 236 aprovados e um teste visual específico de fcntl omitido no Windows. Não contar esse skip como aprovação.
- Hermes Linux: 146 testes do fluxo, contexto, recuperação e encerramento aprovados, sem inferência.
- Hermes Linux: seis testes visuais passaram com o runtime real e provedor simulado, incluindo o teste omitido no Windows; nenhuma geração paga foi disparada por essa suíte. Oito testes do watchdog também passaram.
- Supabase: oito asserções de recuperação executadas com rollback; coordenação, identidade, snapshot, token, histórico, teto de uma recuperação e ausência de mudança no job conferidos.
- Agendamento real conferido: poll a cada dois minutos e espelho Kanban a cada cinco. Ambos já existiam; não criar um segundo despachante.

## O que ainda precisa de prova

1. Conferir recibo da última correção `revision-evidence-install.json` e primeiro ciclo automático do watchdog; o runtime de encerramento de 18:56 foi confirmado.
2. Acompanhar correção da copy, segunda revisão e encaminhamento ao design, sem substituir os agentes nem gastar tentativas sem diagnóstico.
3. Abrir os pixels de cada imagem e confirmar marca, composição, variedade, texto e legenda antes de dizer que o pedido terminou.
4. Não há homologação individual de todos os 21 agentes. Financeiro ainda não tem ferramenta própria de lançamento no conector; parecer jurídico não é assinatura. Preservar essas distinções.
5. Uma falha desconhecida gera atenção, não permissão para retentar sem limite. Recuperação autônoma comprovada nesta rodada é específica do contrato de revisão, com teto de uma tentativa e evidência do erro original.

## Regras para a próxima conversa

- Consultar primeiro os dois jobs acima e seus eventos; seguir o filho gravado no evento WORKFLOW_handoff. Nunca inferir ID de sucessora nem criar outra para ultrapassar o limite.
- Ler apenas resultados de ferramentas e metadados das sessões necessárias; não extrair raciocínio interno, credenciais ou histórico de outros pedidos.
- Verificar versão, empresa, papel, evidências e efeito confirmado de cada escrita. Mantém-se revisão independente e WIP 1.
- Usar o contrato vigente e corrigir argumentos recusados uma vez. Uma resposta incerta exige reconciliação, não repetição paga.
- O material do fundador contém imagens, copy e instruções de uso. Logs, IDs e diagnósticos pertencem à auditoria.
- Há alterações locais anteriores preservadas, ainda não incluídas nos dois commits citados. Não usar `git add .` nem descartar essas alterações.
