# Continuidade: entregas profissionais por funcao

Fonte de implementacao: `services/helena-gateway/src/agent-quality-contracts.json`, versao `helena-delivery-quality-v1`. Sao 21 contratos qualitativos com missao, insumos, resultados, conferencias e limites. Eles nao concedem permissoes nem substituem papel/revisor do Supabase. Laura continua pessoal. Isabela redige copy; Camila orienta marketing; Maya cria design. Nao despachar todos para cada pedido.

## Alteracoes verificadas localmente

- `get_job` retorna contrato da funcao e identidade da empresa exata. `get_work_context` retorna o contrato do perfil autenticado.
- Toda nova submissao exige `delivery`: titulo, conteudo utilizavel, proximos passos, limites e criterios vinculados a evidencias da entrega. Relatorio operacional fica separado.
- APPROVE exige parecer `quality_review` sobre as evidencias e criterios exatos; o revisor precisa comparar tambem o pedido completo, pois o executor pode omitir criterio. Campos estruturados nao garantem julgamento verdadeiro.
- Design exige marca aprovada, logo autorizado e direcao de arte completa. A conferencia usa os formatos solicitados, sem obrigar quatro artes para um pedido de um story. Aprovar exige revisar os arquivos finais, sua copy e identidade. Hash/dimensoes nao garantem composicao, imagem, ortografia ou qualidade.
- Renderizacao SVG rejeita molduras vazias e texto invisivel; container instala DejaVu. Nao foi comprovado que falta de fonte era a unica causa do incidente antigo.
- O executor oferece somente ilustracao vetorial. Pedido de foto/imagem gerada deve ser bloqueado antes de liberar/gastar modelo ate existir integracao homologada. A imagem referencia verde foi gerada neste Codex; nao e prova da capacidade autonoma da Maya.
- Interface local: `/identidade?empresa=BIZ-003` e `/entregas`. Registro tecnico nao vira texto pronto para copiar. Brand draft/logo pendente permanece pendente, sem aprovacao automatica do fundador.
- Instalador `scripts/apply_quality_protocol.py` confere os 21 SOUL antes de escrever, faz backup e e idempotente. Nao muda MCPs, tokens, permissoes, modelos, habilidades instaladas ou jobs. Execucao remota confirmada: APPLIED, 21 perfis atualizados, zero chamadas de IA.

## Evidencia de verificacao em 30/09/2026

Gateway: suite Node 226/226, zero pulados; suite HTTP adicional passou; verificacoes de integracoes 29/29. Frontend: 135/135, TypeScript e build passaram. Instalador de qualidade: 2/2 testes locais, preservacao/idempotencia e preflight. Estes sao testes deterministas com fixtures; nao sao 21 execucoes de modelos reais.

Supabase consultado no painel autenticado: 21 bindings HERMES ACTIVE; checkpoint atual CP-20260928-V033. `publication` e `visual_review` instalados. Checkpoint historico precisa refletir os ajustes de hoje antes de ser usado como fotografia atual. Nao apagamos o historico.

Gateway publicado no EasyPanel com commit `12b54b9`: `/health` confirma `ok=true`, `supabase=true`, `quality_version=helena-delivery-quality-v1` e `design_generation=ORIGINAL_ILLUSTRATION_ONLY`. A migracao `20260930110000_professional_agent_delivery.sql` foi aplicada pelo SQL Editor autenticado, com transacao confirmada e verificacao de `professional_delivery_installed=true` e `quality_review_installed=true`. Aplicacao manual nao equivale a registro automatico no historico de migrations do CLI.

Hermes: `/data/helena-runtime/quality-manifest.json`; backup `/data/helena-runtime/quality-backup-20260930T161132527847Z`. O verificador somente leitura `validate_quality_profiles.py` confirmou PASS em 21/21: SOUL correspondente ao manifesto, MCP autenticado e contrato correspondente ao agente. Relatorio `/data/helena-runtime/quality-validation.json`. Zero chamadas de modelos nesses testes; nenhuma tarefa de negocio executada por esse verificador. Evidencia: `evidencias/quality-profiles-20260930.jpg`.

Supabase recebeu 22 registros append-only em `memoria_mestre`: `MEM-QUALITY-20260930-V1-CHECKPOINT` com registro completo, evidencias e pendencias; `MEM-QUALITY-20260930-V1-AGT-01` ate `AGT-21` com cada contrato e o escopo exato do teste. Confirmacao SQL: 22 registros, 21 contratos, 21 perfis verificados, ciclo real ainda pendente. SQL sem credenciais e recibo em `evidencias/quality-checkpoint-20260930.sql` e `evidencias/quality-receipt-20260930.json`. Nao marcar agentes OPERATIONAL com base nesse teste de contexto.

O despachante existente estava em `/data/helena-runtime/hermes_dispatch_once.py` e ainda nao exigia o novo contrato de qualidade. Foi corrigido somente o texto do prompt, preservando codigo de roteamento e execucao. O primeiro preflight rejeitou a diferenca de quebra de linha do host antes de escrever; a correcao passou a reconhecer os trechos literais exatos, com verificacao AST local, sem substituir o arquivo inteiro. Backup `/data/helena-runtime/hermes_dispatch_once.py.quality-backup-20260930T162756706157Z`; recibo `/data/helena-runtime/dispatch-quality-receipt.json`; verificacao `/data/helena-runtime/dispatch-quality-verification.json`: PASS, PROMPT_ONLY, routing_and_execution_code_preserved=true, role_contract_prompt=true, delivery_prompt=true, quality_review_prompt=true, ai_calls=0. SHA256 final `bd7af9c7ec717025d0f368ad73616bea0c88edb2ae7beb058c4c03c33694bff5`.

Continuidade mais recente deste ajuste: `MEM-QUALITY-20260930-V2-CHECKPOINT` em `memoria_mestre`, preservando V1 e seus 21 registros individuais. V2 incorpora a verificacao do despachante e retira essa pendencia. Nao substitui silenciosamente o apontador geral `checkpoint_mestre_atual`: consultar o estado atual e esta continuidade tecnica juntos. Recibo e SQL em `evidencias/quality-receipt-v2-20260930.json` e `evidencias/quality-checkpoint-v2-20260930.sql`.

## Pendencias de homologacao

Conferir logo/identidade da Humano Digital com fundador. Integrar geracao de imagem real e capacidade de inspecao visual ao executor/revisor antes de prometer pacote fotografico automatico. Depois executar um ciclo pequeno: estrategia → copy → revisao → design → revisao visual → entrega na pagina. Aprovacao reservada ao fundador e escrita de dominios/escope pessoal continuam dependentes dos contratos existentes; nao confundir ferramenta de tarefas/memoria com lancamento financeiro/CRM.

A auditoria historica de 29/09 registrou 24 skills e 19 perfis sem skill especializada. O nome `autonomous-ai-agents` era da pasta; o nome real no frontmatter e `hermes-agent`. Inventario historico: `docs/helena/hermes/auditoria-skills-20260929.json`. A instalacao abaixo atualiza esse estado.

## Skills profissionais instaladas nos 21 perfis

Em 30/09, pacote `helena-role-skills-v1` instalado e verificado: 21 skills de funcao novas, 45 arquivos SKILL.md no total, preservando as 24 skills anteriores. Cada perfil recebeu apenas seu procedimento especializado. Como o despacho restringe os toolsets, o mesmo procedimento foi incorporado ao SOUL para chegar ao agente mesmo quando a ferramenta de carregamento de skills nao participa daquela execucao. Isso nao concede ferramentas ou permissoes adicionais.

Backup real: `/data/helena-runtime/role-skills-backup-20260930T165251025636Z`. Inventario: `/data/helena-runtime/role-skills-manifest.json`. Pacote instalado: `/data/helena-runtime/role-skills-package-v1/`. A verificacao nativa `hermes -p maya--biz003 skills list` confirmou descoberta de `helena-role-agt-12`. Os outros 20 foram conferidos por arquivos, manifestos e contexto autenticado, nao por 20 comandos nativos individuais.

Depois da mudanca dos SOUL, o verificador de contexto confirmou novamente PASS em 21/21. Foram zero chamadas de modelos ou execucoes de tarefas de negocio nesses testes. Os tres testes locais do instalador cobrem preservacao/idempotencia, divergencia no ultimo perfil impedindo todas as escritas e rollback apos falha. Reaplicar sem mudancas preserva o recibo e o caminho real do backup.

Supabase confirmou 45 skills registradas, 21 agentes e 21 skills novas. Continuidade tecnica `MEM-QUALITY-20260930-V3-CHECKPOINT`, com as 45 linhas `MEM-SKILL-20260930-*` em `memoria_mestre`; preservadas V1/V2 e o apontador geral. As 21 skills novas foram registradas com conteudo completo. As 24 anteriores possuem registro de inventario/estado; nao alegamos releitura integral de seus procedimentos. Evidencias e SQL: `evidencias/role-skills-*20260930*`.

A qualidade exigida significa conferir todos os requisitos, pesquisar com fontes acessiveis, produzir resultado utilizavel e corrigir defeitos antes da submissao. Tamanho de prompt, modelo escolhido e campos preenchidos isoladamente nao demonstram qualidade. Os procedimentos nao garantem geracao fotografica, pesquisa externa ou escrita financeira quando a ferramenta correspondente esta ausente. O roteamento Luna/Sol/Astra existente foi preservado, sem afirmar que todos os modelos foram testados nesta rodada.

A marca da Humano Digital foi ajustada e aprovada pelo fundador na pagina. SQL confirmou `portfolio.business_id=BIZ-003`, `row_version=3033`, status APPROVED, logo_approved=true, logo privado `storage://helena-brand-assets/BIZ-003/17386ca9-8970-470b-bd3d-17f4f8cf62af.png`, paleta #075E47/#163D32/#F4F5EB/#BCD2B5. A descricao atual enfatiza pessoas em projetos de dados de IA e atividades cotidianas; nao assumir oportunidade remunerada ativa nem inventar canais oficiais. A marca salva substitui o antigo logo proposto para novos briefs.

Continuidade atualizada: `MEM-QUALITY-20260930-V4-CHECKPOINT`, preservando V3, com a aprovacao e a reaplicacao remota UNCHANGED (21 perfis, zero arquivos alterados, zero chamadas de IA). Geracao real de imagem, inspecao visual remota e um ciclo de negocio com o contrato novo continuam pendentes; a verificacao de configuracao nao homologa automaticamente as 21 entregas profissionais.
