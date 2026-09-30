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
- Instalador `scripts/apply_quality_protocol.py` confere os 21 SOUL antes de escrever, faz backup e e idempotente. Nao muda MCPs, tokens, permissoes, modelos, habilidades instaladas ou jobs. Ainda e preciso confirmar a execucao no host real.

## Evidencia de verificacao em 30/09/2026

Gateway: suite Node 226/226, zero pulados; suite HTTP adicional passou; verificacoes de integracoes 29/29. Frontend: 135/135, TypeScript e build passaram. Instalador de qualidade: 2/2 testes locais, preservacao/idempotencia e preflight. Estes sao testes deterministas com fixtures; nao sao 21 execucoes de modelos reais.

Supabase consultado no painel autenticado: 21 bindings HERMES ACTIVE; checkpoint atual CP-20260928-V033. `publication` e `visual_review` instalados. Checkpoint historico precisa refletir os ajustes de hoje antes de ser usado como fotografia atual. Nao apagamos o historico.

## Pendencias de homologacao

Conferir migracao `20260930110000_professional_agent_delivery.sql`, commit implantado no Gateway e manifest dos SOUL remotos. Conferir logo/identidade da Humano Digital com fundador. Integrar geracao de imagem real e capacidade de inspecao visual ao executor/revisor antes de prometer pacote fotografico automatico. Depois executar um ciclo pequeno: estrategia → copy → revisao → design → revisao visual → entrega na pagina. Aprovacao reservada ao fundador e escrita de dominios/escope pessoal continuam dependentes dos contratos existentes; nao confundir ferramenta de tarefas/memoria com lancamento financeiro/CRM.

A auditoria de Skills de 29/09 registrou 24 skills nos 21 perfis, sendo 21 copias de `autonomous-ai-agents` e 19 perfis sem skill especializada. Este ajuste adiciona orientacao profissional e contratos, nao instala silenciosamente aquelas skills nem comprova que todas estejam completas hoje. Inventario historico: `docs/helena/hermes/auditoria-skills-20260929.json`.
