# Retomada pontual da copy — Humano Digital

Autorização: fundador respondeu "faca isso" após implantação da PR #9 e proposta de retomar a copy de forma planejada. Campanha HD-CASA-POST-STORY-20261002: um post e um story, somente revisão interna. A tarefa antiga JOB-HR-070661329e98fdb5f1c39c81e0cbabe7 permanece FAILED, 2/2, sem reset. Replanejamento único após diagnóstico TIMEOUT e correção do runtime, com chave estável HD-CASA-COPY-REPLAN-20261002-01. Não criar outra sucessora se esta falhar; preservar evidência e diagnosticar.

Registro real: criada `JOB-HR-f4968945ad0ab31bfccc6b611b86b0a8`, inicialmente DRAFT, versão 3751, zero tentativas e nenhuma fonte ausente. Conector da Isabela READY. Liberada às 20:18:33 UTC; executor automático iniciou às 20:19:52 UTC, tentativa 1. Jev registrou avaliação consultiva REVIEW_REQUIRED, portanto não escolheu outro modelo; usa-se o perfil vigente. Progresso às 20:20:19 UTC informa redação e conferência, sem substituir submissão ou aprovação.

## Evidências de acompanhamento

- 20:22:17 UTC: Isabela registrou a memória `MEM-HR-9a5338cfe3857b7a9a432e5da7472bdb` e submeteu a copy. As três headlines alternativas e a escolha justificada estão presentes nesta entrega.
- 20:23:45 UTC: Camila fez revisão independente, sessão `20261002_202309_dd654c`, e pediu ajuste no apoio do story, acima do limite de 25 palavras. Estado DRAFT, tentativa 1, versão 3761. O título está dentro de dez palavras. Não promover copy reprovada para design.
- 20:29:22 UTC: Helena corrigiu o briefing e liberou a mesma tarefa automaticamente; estado READY, tentativa 1, versão 3765. Não foi criada outra sucessora nem alterado o teto de tentativas.
- O conector da Maya foi consultado sem geração e respondeu READY. Isso comprova descoberta das ferramentas, não a geração ou qualidade das futuras imagens.
- 20:30:11 UTC: Isabela iniciou a correção, tentativa 2, sessão `20261002_203018_ea3f67`. Três chamadas de check_task_brief foram observadas (primeira recusou estrutura; seguintes passaram); registrar como oportunidade de reduzir verificações desnecessárias da produtora, sem confundir esse validador com revisão de conteúdo.
- 20:36:35 UTC: correção submetida, WAITING_HELENA, versão 3769. A execução ultrapassou os antigos 300 segundos e terminou dentro dos 600 segundos do novo limite de correção. A revisão independente ainda é obrigatória.
- 20:38:32 UTC: Camila aprovou a copy corrigida, COMPLETED, versão 3772; sessão de revisão `20261002_203756_f6c310`, próxima fase HANDOFF. Fonte aprovada desta versão: `MEM-HR-661cdb23eb360b55f48737ebb923e8de`. Apoio do story com 24 palavras. Ciclo real de devolução, coordenação, correção e revisão independente confirmado, sem reset de tentativas. Isso encerra a etapa textual, não o pedido visual.
- 20:39:15 UTC: Helena iniciou HANDOFF, sessão `20261002_203918_706531`. Corrigiu excesso de caracteres e bloco JSON durante o preflight; o último rascunho tinha 6099 unidades UTF-16. Contudo, o preflight antigo só verificava existência/parse do JSON, não o esquema criativo completo.
- O envio real respondeu `Direcao de arte incompleta: confira todos os campos do contrato criativo`. A proposta tinha `logo`, `colors`, `pieces`, objetos de tipografia e slot `story`; o contrato exige campos planos, `logo_asset`, `palette`, tipografia/copy textuais e slot `story-1`. Não era falha de autenticação nem falta da copy. A coordenação chegou ao limite de 480 segundos sem gravar o handoff.
- Corrigido `brief_preflight.py`: valida os campos, tipos, limites, enumerações, formatos únicos e campos extras contra o contrato real. A descrição MCP agora explicita o esquema. Casos compartilhados são testados no Python e no Gateway Node. Nenhuma permissão ou regra de aprovação foi ampliada.
- Recuperação pontual autorizada: convertida apenas a estrutura da proposta registrada pela Helena, preservando cinco segmentos literais da copy aprovada, dois personagens/cenas, identidade e chave de operação. Não houve nova inferência para essa conversão. Script auditável: `artifacts/recover-visual-handoff-20261002.py`, dry run por padrão.
- **20:58:58 UTC:** handoff aceito para **`JOB-HR-ee3060f449310194fda5b585c192332c`**, Maya/AGT-12; DRAFT, tentativa 0, versão 3777 e nenhuma fonte ausente. Essa recuperação foi assistida por Codex; não descrevê-la como uma passagem integralmente autônoma.
- **21:01:36 UTC:** Helena liberou automaticamente a tarefa visual, READY, versão 3780; sessão `20261002_210028_a22e4f`. A liberação normal retomou após o handoff recuperado.
- Instalação final do preflight: backup `/data/helena-runtime/creative-contract-backup-20261002T210104Z`, SHA256 `0230cb7d4b02d4b64f406d951ebe7fcf6a5478658ce40129ba82595c7a819559`; dez testes Python no Hermes e localmente, cinco testes Node criativos/paridade aprovados, sem modelos. Recibo local `artifacts/creative-contract-installed-20261002.json`.

### Falha de argumento visual e recuperação limitada

- 21:02:36 UTC: Maya iniciou a tarefa visual, tentativa 1, versão da tarefa 3781. Usou `version=3781` em `generate_design`, confundindo versão do registro com versão da imagem. A primeira imagem de cada slot usa **1**; intervalo permitido 1..5.
- 21:04:11 UTC: job FAILED, código `VISUAL_GENERATION_PARAMETER_REJECTED`, tentativa 1/2, tarefa versão 3782. Verificado no Hermes: zero recibos de geração, zero arquivos finais e zero artefatos canônicos. A recusa ocorreu antes de chamar o provedor de imagem.
- Corrigido o adaptador compartilhado `hermes_visual.py`: documentação explícita da versão por slot; argumentos inválidos recebem `INVALID_ARGUMENTS`, `phase=PREFLIGHT`, nomes dos campos e `generation_started=false`. O agente pode corrigir esse argumento uma vez na mesma execução. Após geração iniciada ou resultado incerto, reconciliar recibo; essa regra NÃO autoriza repetir geração paga.
- Testes da camada visual: oito no Linux/Hermes aprovados; no Windows, sete aprovados e um teste específico de `fcntl` ignorado. Nenhum modelo consumido pelos testes. Backup `/data/helena-runtime/visual-version-backup-20261002T210853Z`; SHA256 `5ad56a45c5c28f6e315ef72b21b82e34fdf05939d5515e4bccfc2ca8675c2f2d`.
- Aplicado `scripts/recover-visual-version-20261002.sql` ao mesmo job, com trava global, versão/data/erro exatos, chave idempotente e histórico `OPERATOR_CONTROLLED_RETRY`. Resultado confirmado: DRAFT, aprovação PENDING, tentativa **1/2 preservada**. Não foi criado novo job nem zerado contador. Helena ainda precisa liberar; Nina permanece revisora independente. Recuperação assistida, não prova de autonomia completa.
- PR #10 incorporada em `8d503039999fd460931acb0f2c05906c7a5f878e`; CI aprovado para o preflight criativo. A correção visual acima é posterior e deve ser versionada separadamente.

Pendência atual: acompanhar a liberação normal, a única tentativa restante de Maya e a revisão independente de Nina. Não confundir copy aprovada ou handoff aceito com campanha entregue. Se a tentativa restante falhar, preservar o bloqueio e diagnosticar; não criar sucessora ou aumentar teto automaticamente.

## Contexto e fontes
Humano Digital/BIZ-003. Reaproveitar exclusivamente a estratégia atual aprovada em JOB-HR-20b2a6f253ee5c5377e994e8da2b8595, fonte MEM-HR-8f76450c2f464ef4def3521b8781c5f8. A identidade da empresa aprovada é a referência de fatos e voz. Esta etapa substitui somente a copy interrompida por TIMEOUT da tarefa JOB-HR-070661329e98fdb5f1c39c81e0cbabe7; não herda aprovação nem apaga seu histórico. Fundador autorizou a retomada planejada após a correção do executor.

## Objetivo e impacto
Isabela/AGT-17: produzir copy persuasiva e clara sobre participação em projetos de IA e interesse em trabalhar de casa, com exemplo concreto do cotidiano e o papel da Humano Digital. A marca orienta e conecta pessoas a projetos compatíveis. Não afirmar vaga, renda ou modalidade remota disponível sem fato confirmado.

## Escopo e limites
Exatamente um post 1080x1350 e um story 1080x1920; nesta etapa somente textos, sem gerar imagens. Revisão interna, sem publicação, link, cadastro, contato, pagamento ou promessa de contratação. Reaproveitar a fonte aprovada; não pesquisar outra campanha nem recriar estratégia. Uma execução inicial controlada desta retomada; falha técnica não autoriza nova sucessora ou repetição paga sem diagnóstico.

## Plano de trabalho
Escrever três opções curtas de headline com ângulos diferentes; escolher uma e explicar a escolha em uma frase. Produzir post com identificação por atividade cotidiana e story complementar explicando o mecanismo humano-dados-IA. Deixar clara a condição "conforme o projeto" de modo natural. Legenda complementa a arte; não transformar o texto em relatório ou coleção de ressalvas. Conferir tudo e usar submit_work dentro do tempo disponível, sem consultas repetidas ao contexto já recebido.

## Entregáveis
No delivery.content: três headlines, escolha e justificativa; texto exato do post; texto exato do story; legenda pronta; breve orientação visual e alt_text de cada peça. Opções são alternativas de texto, não peças extras. Post e story têm papéis e composições distintos. Texto do story: título até dez palavras, apoio até 25. Manter content abaixo de 4500 caracteres; dados técnicos somente no summary interno.

## Critérios de pronto
As três alternativas e a escolha justificada aparecem de fato no material. Há exatamente um post e um story, com gancho específico, mecanismo compreensível e benefício sustentado. Legenda limpa, português correto e condições claras, sem oferta ou destino inventado. Referências de layout respeitam identidade aprovada, logo único, enquadramentos distintos e nenhuma faixa inferior artificial. Cada finding comprova o que está entregue; não declarar item inexistente.

## Evidências e registro
Submeter uma vez com chave estável e versão atual. delivery: schema_version=1, stage=INTERMEDIATE, title, content, next_steps, limitations e até seis acceptance_checks com criterion de até 240 caracteres e finding objetivo. Gateway cria a memória e referências; não inventar evidence_ref. Publication deve conter legenda e instruções limpas quando exigido pelo contrato. Confirmar o efeito; resposta incerta exige consulta antes de reenviar a mesma chave.

## Revisão e encaminhamento
Camila/AGT-16 revisa a copy de forma independente, incluindo alternativas e justificativa. Após aprovação, Helena encaminha somente a etapa visual a Maya/AGT-12: um post e um story, copy literal aprovada, identidade atual, logo oficial único, duas cenas/enquadramentos diferentes e arquivos finais no R2 privado. Nina/AGT-10 inspeciona pixels e conjunto. A entrega visual marca stage=FINAL somente quando inclui ambas as imagens, copy e legenda e está pronta para revisão. Nenhuma publicação. Não criar outro pedido paralelo.
