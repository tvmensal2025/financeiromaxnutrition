# Piloto Augusto — resultado e correção das fontes

## Entrega concluída — 28/09/2026 09:51:38 America/Sao_Paulo

A retomada autorizada pelo fundador executou Augusto uma vez adicional (attempt_count=2). O agente produziu o memorando estratégico MEM-HR-54de28fab0ad7ef6f88a5c44109751a3, submeteu entrega com review_pending=true e citou a própria memória e as fontes Pedro/Victor. Foi necessário corrigir a conferência dessas citações na revisão (commit 4f021bb, publicado): entradas aprovadas citadas podem compor referências, mas a aprovação continua exigindo evidência produzida pelo próprio job. Os 20 testes de transporte e revisão passaram.

A revisão assistida por Codex foi registrada pelo perfil Helena, com aprovação restrita ao memorando interno. get_job confirmou COMPLETED, tarefa CONCLUÍDA, reviewed_by=AGT-01, três evidências e nenhuma ausente. Não houve terceiro disparo, nem execução autônoma do modelo Helena para revisão. O ciclo observado foi liberação pela Marina → execução real Augusto → memória/entrega no Supabase → revisão assistida → conclusão confirmada no banco. A página local ainda não foi verificada nesta retomada.

Resultado comercial preparado: público inicial como hipótese (adultos interessados em renda complementar e com canal próprio), proposta transparente sem promessa de renda, jornada de entrada consentida até comissão conciliada, métricas e critérios de parada. A hipótese de 10 elegíveis/5 ativações em 14 dias não é meta aprovada nem previsão. Termos dos parceiros, custos, elegibilidade e pagamentos ainda requerem confirmação. Não houve captação, campanha, recebimento ou receita comprovados. A operação autônoma dos 21 agentes permanece sem homologação.

## Atualização confirmada — 28/09/2026 09:24:49 America/Sao_Paulo

O bloqueio por decisão foi resolvido pela nova ferramenta resolve_job_block, publicada no Gateway (56a3d53) e no Supabase. A configuração de Helena e Marina foi atualizada com backup. A chamada real autenticada como Marina retornou sucesso e a consulta independente ao Supabase confirmou: mesmo job e mesma tarefa, DRAFT, attempt_count=1, task row_version=2655, exatamente um evento WORKFLOW_resolve_job_block, resolved_by=AGT-04. Nenhuma nova execução de IA foi iniciada.

Testes transacionais com rollback confirmaram: executor não pode desbloquear; versão antiga é recusada; revisão de entrega não é desviada para desbloqueio; limite de tentativas é preservado; repetição idêntica não duplica evento; chave reutilizada com outro conteúdo é recusada. 138 testes e 22 verificações de integrações passaram; após adicionar o teste HTTP da nova ferramenta, os 15 testes HTTP passaram. A função do banco não é executável por anon/authenticated; somente service_role. O próximo passo agora é liberar e retomar o mesmo job para entregar a estratégia, seguido de revisão e confirmação na página. Os parágrafos abaixo preservam a observação anterior ao desbloqueio.

Verificação: 28/09/2026, 09:15:18, America/Sao_Paulo (12:15:18 UTC). Este registro complementa o checkpoint operacional anterior; não altera seu retrato histórico nem substitui o checkpoint ativo do Supabase.

## Resultado confirmado

- Empresa BIZ-003, tarefa existente TSK-HD-20260927-03, job JOB-HR-ed135142c0c6f852af3c7728e440a5b8; nenhum segundo cartão criado.
- Marina liberou/despachou; Augusto assumiu, iniciou, registrou progresso e memória no Supabase. Uma execução de IA neste piloto.
- Augusto parou em WAITING_HELENA: o briefing citava fontes que get_job não entregava. Não houve entrega estratégica submetida nem aprovação.
- O executável Hermes foi localizado no host e o despachante corrigido com backup. O teste MCP anterior à execução confirmou 15 ferramentas; não consumiu modelo.

## Correção publicada e verificada

Commit 2720def, branch codex/hermes-runtime-preparation, publicado no serviço helena-gateway do EasyPanel.

get_job passou a entregar input_evidence_records: somente memórias explicitamente citadas, da mesma empresa, pertencentes a jobs COMPLETED/APPROVED, com revisor e referência confirmados. Fontes de entrada não contam como evidência de entrega própria. release_job e claim_job recusam fontes ausentes antes de uma chamada ao modelo.

Consulta de produção autenticada como augusto--biz003 confirmou:

- Pedro: MEM-HR-6d4c9666d8b09fa03a1162edf949d6ce, job JOB-HR-3ebae4abff11a58e457fe779e15705ab.
- Victor: MEM-HR-f373f6a965a4ba89f72efc7c0f52f09c, job JOB-HR-0e91cf1982fa751ce1e4cf93e7af48d7.
- Duas fontes retornadas; zero input_evidence_missing; zero evidence_records da entrega própria; status WAITING_HELENA; saúde HTTP 200.
- 138 testes locais passaram; 22 verificações de integrações passaram. Nenhuma segunda execução de IA para verificar a correção.
- O Gateway confirmou a gravação da memória técnica MEM-HR-614751867097aab0686fe1aacf1ba7f0 no Supabase, vinculada ao mesmo job, distinguindo correção feita por Codex de entrega estratégica ainda pendente.

## Próximo passo e limites reais

O bloqueio de acesso às fontes foi corrigido. Ainda falta uma decisão de desbloqueio e retomada do mesmo job pelo fluxo autorizado, a estratégia de Augusto, sua submissão e revisão pela Helena. A ferramenta review_delivery atende entregas submetidas com review_pending; não deve ser usada para fingir aprovação de uma solicitação de decisão sem entrega. A ferramenta release_job aceita DRAFT; não se deve forçar WAITING_HELENA para READY diretamente.

O ciclo automático dos 21 perfis, supervisão em lote, os escritores de CRM/finanças/produto, a decisão do fundador sobre trabalhos da própria Helena e a apresentação integral do ciclo no painel continuam sem homologação completa. O despachante do host recebeu o reparo pontual de executável; não foi comprovada sua equivalência integral com a última versão do repositório. O checkpoint canônico ainda precisa ser comparado e sincronizado com este resultado.

As fontes de Pedro e Victor são modelos internos condicionais. Não comprovam condições comerciais Hub/IMIX, captação externa, conversões ou receita.
