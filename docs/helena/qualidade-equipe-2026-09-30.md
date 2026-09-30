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

A auditoria de Skills de 29/09 registrou 24 skills nos 21 perfis, sendo 21 copias de `autonomous-ai-agents` e 19 perfis sem skill especializada. Este ajuste adiciona orientacao profissional e contratos, nao instala silenciosamente aquelas skills nem comprova que todas estejam completas hoje. Inventario historico: `docs/helena/hermes/auditoria-skills-20260929.json`.
