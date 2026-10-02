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
   - O pacote do controlador informa se o briefing já foi corrigido para o parecer atual. Orienta conferir e liberar, sem reescrever para repetir a mesma pendência. Instalação remota confirmada às **19:39:44 UTC**, dois arquivos, backup `revision-evidence-backup-20261002T193944Z`, recibo `revision-evidence-install.json`, sem nova chamada de modelo. Hash do controlador `bd5cd7094c51130cc20a23ff72c0731515b52bf94169348c22921cca95741515`; contexto `c5df5b7fcf2040e70b5243fd2f81d0c6f1fdffa58b72a500a72c88090dbe6bc6`.
5. **Vigilância de exceções não estava instalada.** Migration `20261002190500_queue_attention_workflow.sql` aplicada e testes com rollback aprovados. Leitor e escritor aceitam apenas coordenação autorizada, registram alerta idempotente e não mudam jobs, tentativas ou aprovações. Recibos antigos de snapshots já superados não geram falso bloqueio.
   - `hermes_queue_watchdog.py` instalado às 19:07:24 UTC, integrado ao poll existente; recibo `queue-watchdog-install.json`. Hash `ada93f1f04ce59d4b0f008781c059dc4336de3419625c71ec0da1c0754b83ef6`.
   - O monitor não chama IA e não repete automaticamente falhas desconhecidas. Sua falha não deve impedir o dispatcher: invocação contém `|| true`. Execução automática conferida em `queue-watchdog-last-result.json`: nove ocorrências, `model_started=false`. Depois de duas varreduras adicionais controladas, consulta ao Supabase confirmou **um único QUEUE_ATTENTION** para a copy atual, sem mudar job ou tentativas. Isso comprova detecção e deduplicação; não comprova correção automática de qualquer erro.
6. **Prazo do modelo de correção insuficiente.** A segunda execução da Isabela expirou em 300 segundos, sem nova submissão confirmada. O produtor não chegara à etapa de imagens.
   - Commit `fec8ed2`, [PR #9](https://github.com/tvmensal2025/financeiromaxnutrition/pull/9): limite finito de 600 segundos para produção com o modelo de correção configurado; 300 segundos para demais produtores e 900 para Maya. O tempo não se renova automaticamente. A coordenação conserva seu limite próprio de 480 segundos, inferior ao prazo do recibo no banco.
   - A mesma proposta bloqueia inferência se o briefing já foi corrigido para o parecer atual e continua faltando fonte. Ao resolver a fonte, a condição deixa de bloquear. Teste comprova ausência de chamada ao modelo e de alteração de estado.
   - **Incorporada e instalada.** Após autorização explícita do fundador ("pode implementar"), PR #9 mesclada em `f758ba243508f1b0742a4b7364862d7c643cca2c`. CI do head `539c553` aprovado antes da incorporação. Instalação no Hermes em **02/10/2026, 20:05:22 UTC / 17:05:22 Brasília**, com trava do despachante, verificação dos hashes anteriores, substituição atômica e restauração automática em caso de teste falhar. Três arquivos alterados; **97 testes aprovados no servidor**, nenhuma chamada de modelo e nenhuma mudança em tarefas ou tentativas.
   - Backup `/data/helena-runtime/execution-policy-backup-20261002T200521Z`; recibos `/data/helena-runtime/execution-policy-install.json` e `execution-policy-verification.json`. Hashes: `execution_policy.py=c674fb4a97951f14705699dc7cc057399496d46b030edbc1e35115ba861d6491`, `hermes_workflow_tick.py=1dc963e0ba226814b108ad418dcab500b8435099660ced0fa9ba502f4a4c6f84`, `hermes_dispatch_once.py=55f9e8da0ae566b4d5b8c3a1e745c0837370076c92117b3406b975b4a08050bd`.
   - A verificação pós-instalação consultou o Gateway real e confirmou a campanha ainda FAILED, 2/2 tentativas, versão 3749 e atualização original de 19:35:05 UTC. O Gateway não recebeu alteração Node nesta proposta; sua implantação funcional anterior contém `f89dedf`. O despachante inicia um processo Python novo por etapa, portanto usa os arquivos atualizados sem reiniciar sessões do Hermes.

## Provas da execução real

- Estratégia de Camila: `JOB-HR-20b2a6f253ee5c5377e994e8da2b8595`.
- Diagnóstico antigo vinculado ao recibo somente após conferir sessão, erro, snapshot 3722 e revisor AGT-03. Uma recuperação, sem reiniciar produção.
- **18:26:39 UTC:** revisão aprovada por Augusto (AGT-03), sessão `20261002_182608_54c147`; estratégia COMPLETED, versão 3725.
- **18:40:05 UTC:** Helena gravou o handoff para a copy, sucessora única `JOB-HR-070661329e98fdb5f1c39c81e0cbabe7`, responsável Isabela (AGT-17).
- **18:46:10 UTC:** Isabela submeteu a copy; memória própria `MEM-HR-34f03999c5c41f33fca2eef599815166`.
- **18:47:40 UTC:** Camila (AGT-16) fez revisão independente e pediu ajustes; a mesma tarefa voltou a DRAFT, versão 3739. A devolução é uma decisão de qualidade, não uma falha de transporte.
- **18:48:31 UTC:** consumidor iniciou COORDINATE com Helena para tratar os apontamentos. Não há prova de arte final aprovada neste ponto.
- Cinco revisões do briefing ficaram registradas antes da correção da classificação das fontes; preservar esse histórico como evidência do ciclo improdutivo.
- **19:29:54 UTC:** Isabela iniciou a segunda tentativa, sessão `20261002_193002_94b349`.
- **19:32:49 UTC:** registro de progresso. Progresso não equivale a entrega.
- **19:35:05.630646 UTC:** estado **FAILED**, motivo **TIMEOUT**, **2/2 tentativas**, tarefa versão **3749**. Não houve nova copy submetida nem imagem final desta campanha. Não reiniciar tentativas nem criar sucessora só para ultrapassar o teto.
- Prova visual da consulta: `artifacts/campaign-timeout-and-watchdog-proof-20261002.png`; `alertas_unicos=1`.

## Verificações

- Suíte atual do Gateway: 319 testes Node aprovados; servidor e 29 verificações de integração também passaram.
- Python final desta rodada: **243 testes executados, 242 aprovados** e um teste visual específico de fcntl omitido no Windows. Não contar esse skip como aprovação. Resultado em `artifacts/execution-policy-python-tests-final.txt`.
- CI do commit `fec8ed2`: verificação e build de contêiner concluídos com sucesso no GitHub. Isso não comprova implantação nem entrega da campanha.
- Hermes Linux: 146 testes do fluxo, contexto, recuperação e encerramento aprovados, sem inferência.
- Hermes Linux: seis testes visuais passaram com o runtime real e provedor simulado, incluindo o teste omitido no Windows; nenhuma geração paga foi disparada por essa suíte. Oito testes do watchdog também passaram.
- Hermes Linux após incorporar PR #9: **97 testes de controlador e política de execução aprovados** contra os módulos instalados. Conferência real posterior validou os três hashes e os limites 300/600/900 segundos. Evidência local em `artifacts/execution-policy-installed-20261002.json` e `artifacts/execution-policy-installed-20261002.png`.
- Supabase: oito asserções de recuperação executadas com rollback; coordenação, identidade, snapshot, token, histórico, teto de uma recuperação e ausência de mudança no job conferidos.
- Agendamento real conferido: poll a cada dois minutos e espelho Kanban a cada cinco. Ambos já existiam; não criar um segundo despachante.

## O que ainda precisa de prova

**Atualização posterior:** a retomada textual foi criada e concluiu devolução/correção/aprovação real em 02/10 às 20:38 UTC. A continuação vigente está em `RETOMADA-COPY-CASA-20261002.md`: copy `JOB-HR-f4968945ad0ab31bfccc6b611b86b0a8`, visual `JOB-HR-ee3060f449310194fda5b585c192332c`. Ler essa continuação antes de agir; as pendências abaixo registram o estado anterior. Não duplicar campanha nem recuperar o job de copy antigo esgotado.

1. Implantação da PR #9 concluída e conferida. Ainda falta uma execução real com entrega aprovada utilizando o novo limite; testes controlados não substituem essa prova.
2. A tarefa de copy atingiu o teto de duas tentativas. Preparar replanejamento explícito e finito da etapa pendente, reaproveitando estratégia aprovada e apontamentos de Camila. Não há autorização implícita para apagar tentativas, repetir indefinidamente ou chamar de homologado o que não chegou ao fim.
3. Abrir os pixels de cada imagem e confirmar marca, composição, variedade, texto e legenda antes de dizer que o pedido terminou.
4. Não há homologação individual de todos os 21 agentes. Financeiro ainda não tem ferramenta própria de lançamento no conector; parecer jurídico não é assinatura. Preservar essas distinções.
5. Uma falha desconhecida gera atenção, não permissão para retentar sem limite. Recuperação autônoma comprovada nesta rodada é específica do contrato de revisão, com teto de uma tentativa e evidência do erro original.

## Regras para a próxima conversa

- Consultar primeiro os dois jobs acima e seus eventos; seguir o filho gravado no evento WORKFLOW_handoff. Nunca inferir ID de sucessora nem criar outra para ultrapassar o limite.
- Ler apenas resultados de ferramentas e metadados das sessões necessárias; não extrair raciocínio interno, credenciais ou histórico de outros pedidos.
- Verificar versão, empresa, papel, evidências e efeito confirmado de cada escrita. Mantém-se revisão independente e WIP 1.
- Usar o contrato vigente e corrigir argumentos recusados uma vez. Uma resposta incerta exige reconciliação, não repetição paga.
- O material do fundador contém imagens, copy e instruções de uso. Logs, IDs e diagnósticos pertencem à auditoria.
- Há alterações locais anteriores preservadas, ainda não incluídas nos commits desta correção. Não usar `git add .` nem descartar essas alterações.
