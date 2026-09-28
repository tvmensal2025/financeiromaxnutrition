# Piloto Augusto — resultado e correção das fontes

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
