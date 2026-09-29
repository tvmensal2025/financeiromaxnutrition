# Helena-HUB — validação inicial do Sistema Helena

**Resultado: CARREGADO COM DIVERGÊNCIAS. CHECKPOINT REQUER SINCRONIZAÇÃO.**

Consulta final: **26/09/2026, 06:04:39 America/Sao_Paulo** (2026-09-26 09:04:39.505194+00). Fonte confirmada pelo conector: **ecosistemadossonhos / wxkgrykduqtsgmjkzlou**, estado ACTIVE_HEALTHY. Todas as consultas desta auditoria foram executadas em transações READ ONLY. Nenhuma alteração, execução de job, rotação, sincronização ou publicação foi realizada.

## Projeto local

Pasta criada: `C:\Users\USUARIO\Documents\Codex\Helena-HUB`.

A base contém instruções de continuidade, o comando mestre original, identificação do projeto sem credenciais e este relatório. É um espaço local de colaboração; o banco continua no Supabase. O código dos aplicativos existentes não foi importado. O cadastro da pasta na barra lateral do Codex ainda depende da seleção pela interface.

## Checkpoint

- **ID:** CP-20260925-V005.
- **Versão:** 5. **Status no banco:** ATIVO.
- **Anterior:** CP-20260925-V004.
- **Criado/validado:** 25/09/2026, 18:12:18 America/Sao_Paulo.
- **snapshot.gerado_em:** 25/09/2026, 15:31:02 America/Sao_Paulo, anterior à criação da V5.
- A view retornou exatamente um registro. A tabela contém exatamente um ATIVO, que também é a maior versão.
- Cadeia V1 → V2 → V3 → V4 → V5 íntegra na leitura atual; V1–V4 estão SUPERADO e os ponteiros de versão anterior conferem.
- Identificador, versão, resumo, markdown, snapshot, fontes e mudanças estão preenchidos.
- Os conteúdos e hashes das cinco versões estão preservados na leitura atual. Isso não prova, isoladamente, que nunca houve alteração histórica; essa garantia exigiria logs ou uma referência independente.
- O título do registro é V5, mas o cabeçalho interno do markdown ainda diz V1 e mantém um bloco explicitamente histórico de contagens da V1.

## Regras de continuidade

DEC-016, DEC-017, DEC-018 e DEC-019 existem e estão ATIVO. MEM-0025, MEM-0026, MEM-0027 e MEM-0028 existem e estão ATIVO.

Os quatro itens de Continuidade estão CONFIRMADO no Estado Mestre: Checkpoint Mestre Versionado (15), Rotina de Atualização (16), Comando de Carregamento (17) e Checklist de Validação (18).

- **“Helena, carregue o Checkpoint Mestre.”:** consulta e valida; não cria versão nem altera dados.
- **“Helena, sincronize o Checkpoint Mestre.”:** só cria nova versão com mudança material, preservando o histórico.
- DEC-020/MEM-0030 acrescentam o precheck: JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE; sem evidência suficiente, NÃO CONFIRMADO.
- Precedência aplicada: estado real Supabase/produção → decisões e Estado Mestre → checkpoint ativo → memórias/handoffs → arquivos e conversas históricos.

Há textos de “próxima ação” antigos no Estado Mestre: o registro 15 ainda pede criar/manter V1 e o 16 pede gerar V2. São pendências de reconciliação textual, pois V5 já existe.

## Foco atual

**FOC-004 — Homologação técnica do Sistema Helena — EM EXECUÇÃO**, responsável Helena.

**Critério de saída:** bateria reproduzível executada, falha crítica interna tratada e parecer com escopo declarado.

FOC-002 — Caixa continua PLANEJADO. FOC-001 e FOC-003 estão CONCLUÍDO. Há **1 foco em execução**, sem violação numérica do WIP executivo = 1.

O fechamento permanece sem evidência consolidada suficiente nos registros consultados: HND-0014 segue aberto com identidade incorreta do despachante; REC-0005 continua pausada; HND-0003 ainda pede definição do enquadramento de PRJ-0002 no WIP. PRJ-0002 em execução e atividades posteriores de voz precisam ser reconciliados com o escopo registrado de FOC-004, que diz não iniciar integração externa nesta frente. Isso é uma tensão de governança, não a comprovação de um segundo FOC ativo.

## Estado do sistema

- **3 negócios ativos**, 21 agentes e 21 conexões.
- **27 jobs:** 22 READY e 5 COMPLETED; **36 eventos**, sem jobs RUNNING registrados.
- **10 integrações:** 5 PLANEJADA, 3 CONFIGURADA, 1 STANDBY, 1 OFICIAL.
- **5 automações**, todas PLANEJADA.
- **6 recorrências:** 2 ATIVA, 1 PAUSADA e 3 CONFIGURAÇÃO PENDENTE.
- 2 projetos, 5 marcos, 30 tarefas, 9 riscos, 19 decisões, 18 registros de Estado Mestre e 27 memórias.
- 26 handoffs, sendo **6 ABERTO**. Notification outbox: 0 registros.
- PRJ-0001 está CONCLUÍDO. PRJ-0002 está EM EXECUÇÃO; MIL-0002 em execução e MIL-0003/4/5 planejados.

### Portfólio ativo

**BIZ-001 — iGreen | VENDAS**
- Objetivo: Validar e destravar aquisição de clientes.
- Gargalo: Comercial / conseguir clientes.
- KPI: Leads → conversas → propostas → vendas
- Responsável: Helena + Victor + Daniel
- Riscos registrados: Excesso de produto sem validação comercial; baixa aquisição.
- Próxima entrega: Diagnóstico comercial com dados reais.

**BIZ-002 — Ecossistema de Saúde | PRODUTO**
- Objetivo: Consolidar visão, arquitetura do produto e modelo de negócio.
- Gargalo: Escopo amplo ainda não consolidado.
- KPI: DADO A COLETAR
- Responsável: Helena + Nina + Clara
- Riscos registrados: Regulatório, privacidade, segurança, escopo excessivo e risco médico.
- Próxima entrega: Mapa do MVP e das hipóteses a validar.

**BIZ-003 — Humano Digital | VALIDAÇÃO**
- Objetivo: Validar e escalar aquisição de trabalhadores, ativação nas USUARIOformas parceiras e receita de comissão com rastreabilidade ponta a ponta.
- Gargalo: Aquisição e ativação de pessoas com rastreamento confiável até a comissão recebida.
- KPI: Pessoas captadas → cadastradas → ativas → horas aprovadas → comissão prevista → comissão recebida
- Responsável: Helena + Victor + Camila + Pedro + Clara
- Riscos registrados: Dependência de parceiros, mudanças de comissão, falta de tarefas, reprovação de trabalho, privacidade/consentimento, comunicação enganosa de renda e enquadramento jurídico da intermediação.
- Próxima entrega: Mapa operacional do funil do Humano Digital usando tabelas existentes, sem duplicação, e painel mínimo de caixa/comissões.

“DADO A COLETAR” foi preservado onde consta no banco; não foi substituído por estimativa.

### Agentes e jobs

Todos os 21 agentes estão ATIVO no catálogo e CONNECTED nas conexões. Helena usa CHATGPT; os 20 especialistas usam GROK e possuem external_agent_id. Nenhuma conexão está marcada OPERATIONAL.

Há um job de homologação do Gateway concluído e quatro jobs de teste do fundador encerrados **sem resposta ao cliente**, conforme seus registros. Os cinco COMPLETED não comprovam operação contínua, atendimento enviado ou homologação de todos os agentes. Os três jobs novos READY de WhatsApp não foram executados nesta auditoria.

O catálogo completo, cargos, estado de execução, external_agent_id e data do último teste ficam no arquivo local `EVIDENCIAS-RESUMIDAS.json`. Catálogo nominal:

- AGT-01: Helena — CEO Virtual / Central de Comando.
- AGT-02: Laura — Comunicação e Desenvolvimento do Fundador.
- AGT-03: Augusto — Estratégia Corporativa.
- AGT-04: Marina — Execução e PMO.
- AGT-05: Caio — Finanças / CFO.
- AGT-06: Clara — Risco, Jurídico e Compliance.
- AGT-07: Bianca — Pessoas e Cultura.
- AGT-08: Daniel — Dados e BI.
- AGT-09: Theo — Tecnologia e IA.
- AGT-10: Nina — Produto.
- AGT-11: Ravi — Pesquisa e Insights.
- AGT-12: Maya — Design / UX / UI.
- AGT-13: Bruno — Qualidade / QA.
- AGT-14: Olívia — Operações.
- AGT-15: Victor — Vendas.
- AGT-16: Camila — Marketing e Growth.
- AGT-17: Isabela — Marca, Conteúdo e Copy.
- AGT-18: Pedro — Parcerias e Desenvolvimento de Negócios.
- AGT-19: Renata — Customer Success.
- AGT-20: Joana — Atendimento.
- AGT-21: Felipe — Administração.

### Integrações

- **INT-0001 — Google Drive: PLANEJADA.** Responsável: Theo + Felipe.
- **INT-0002 — Gmail: PLANEJADA.** Responsável: Theo + Joana.
- **INT-0003 — Google Calendar: PLANEJADA.** Responsável: Theo + Marina.
- **INT-0004 — Automação de Recorrências: PLANEJADA.** Responsável: Theo + Marina + Caio.
- **INT-0005 — Helena Gateway: PLANEJADA.** Responsável: Helena + Theo + Marina.
- **INT-0006 — Evolution API: CONFIGURADA.** Responsável: Theo + Helena.
- **INT-0007 — Meowcaller: CONFIGURADA.** Responsável: Theo + Helena.
- **INT-0008 — ElevenLabs: STANDBY.** Responsável: Theo + Nina + Helena.
- **INT-0009 — Laya Service: CONFIGURADA.** Responsável: Theo + Helena.
- **INT-0010 — Kokoro TTS VPS: OFICIAL.** Responsável: Theo + Helena.

INT-0010 Kokoro TTS VPS passou a ser o motor de voz OFICIAL no cadastro, e INT-0008 ElevenLabs ficou STANDBY. “OFICIAL” descreve a escolha registrada; não comprova disponibilidade ou homologação ponta a ponta. INT-0005 mantém PLANEJADA, embora suas observações registrem implantação e um teste de saúde anterior. Não foi feito teste externo nesta sessão.

### Automações e recorrências

As cinco automações permanecem planejadas. A separação abaixo classifica a natureza da execução, sem declarar que um agendador esteja ativo:

- **Regra/evento/agendamento de sistema:** AUTO-0004 (materializar recorrências) e AUTO-0005 (backup) são executáveis por lógica determinística. Não há execução ativa comprovada; pg_cron e pg_net não estão instalados no projeto consultado.
- **Conectores/executor de integração:** AUTO-0001 (Gmail), AUTO-0002 (Calendar) e AUTO-0003 (Drive) dependem das conexões externas correspondentes, ainda planejadas. Um agente de IA não é necessariamente exigido para a sincronização.
- **Execução por responsável/agente:** REC-0004 está ATIVA, mas explicitamente manual por Daniel, com gerar_automaticamente = NÃO. Não há ocorrência materializada registrada.
- **REC-0005:** PAUSADA; regra atual a cada duas horas. Depende da correção e do teste de dispatcher_agent_id em HND-0014. O nome ainda menciona “a cada 30 minutos”, um texto desatualizado.
- **REC-0006:** ATIVA, responsável Marina; primeira execução registrada em 25/09 às 18:39, próxima ocorrência em 28/09 às 18:28. O automation_id permanece sem confirmação no cadastro.
- REC-0001/2/3 seguem CONFIGURAÇÃO PENDENTE.

Nenhuma evidência consultada permite assumir Blockbot ou n8n como dependência operacional ativa.

## Segurança

**RSK-0007 continua ABERTO e CRÍTICO. DEC-019 mantém a rotação temporariamente adiada pelo fundador. TSK-0012 está BLOQUEADA no estado atual, e não NÃO INICIADA como no snapshot.** O prazo registrado é 25/09/2026; em 26/09 ele está no passado. O adiamento não equivale à mitigação.

Os riscos RSK-0007/8/9 referem-se ao aplicativo ids-max e ao projeto de produção `imvfmjgmacrulhztrqlh`. Nesta sessão foram lidos seus registros no banco Helena; esse outro projeto, seus repositórios e seus painéis não foram auditados diretamente.

### Auth e controle de acesso no projeto Helena

- 4 usuários de Auth confirmados, nenhum anônimo.
- app_access: 3 acessos ativos, sendo **2 founder e 1 member**. O snapshot tinha 1 ativo.
- user_business_access: 1 vínculo ativo de member à BIZ-002. O snapshot tinha zero.
- **68 tabelas públicas com RLS habilitado; zero grants de tabela para anon** na consulta ao catálogo.
- A view checkpoint_mestre_atual usa security_invoker=true.
- agent_jobs, agent_job_events, notification_outbox e processos têm RLS e nenhuma policy: o advisor informa essa condição; isso representa fechamento para os papéis sujeitos a RLS, não prova de exposição pública.
- A proteção contra senhas vazadas continua **desativada**, confirmada pelo advisor.
- is_founder e user_has_business_access são SECURITY DEFINER acessíveis a authenticated, mas não a anon. As definições verificadas consultam auth.uid(), acesso ativo e vínculo de negócio; não usam user_metadata. Esse uso merece revisão contextual, mas o alerta sozinho não comprova exploração.

### Teste de leitura como member

Foi usada uma transação READ ONLY com papel authenticated e o identificador do member já existente, finalizada com ROLLBACK. Nenhum usuário foi criado ou modificado.

Resultado: is_founder=false; BIZ-001 e BIZ-003 negadas pelo helper, BIZ-002 permitida; somente 20 tarefas da BIZ-002 visíveis e zero checkpoints visíveis.

**Ponto de atenção de governança:** esse mesmo member consegue ler os três negócios do portfólio, todas as 19 decisões e os 26 handoffs. As policies authenticated_access de decisões, Estado Mestre, foco, integrações, conexões e handoffs usam apenas o acesso ativo ao aplicativo e são ALL; grants INSERT/UPDATE/DELETE também estão presentes. Portanto o desenho concede escrita ampla nessas áreas a membros ativos, sem isolamento por negócio ou papel executivo. **Nenhuma escrita foi testada.** É necessário confirmar se essa amplitude é intencional; não foi tratada como um incidente comprovado nem corrigida automaticamente.

Orientações oficiais: [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [combinação de grants e policies](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Tarefas críticas não concluídas

- **TSK-0012 — BLOQUEADA**, Fundador. Rotação de credenciais adiada pela DEC-019. Prazo cadastrado: 2026-09-25.
- **TSK-0013 — EM EXECUÇÃO**, AGT-09 (Theo). Remover segredos do git e mover chaves novas para secret store (gitleaks bloqueando) Prazo cadastrado: 2026-09-26.
- **TSK-0017 — NÃO INICIADA**, AGT-09 (Theo). Habilitar e comprovar RLS em food_aliases e user_test_groups Prazo cadastrado: 2026-09-29.
- **TSK-0019 — NÃO INICIADA**, AGT-09 (Theo). Sanear npm audit de runtime (jspdf e transitivas críticas) Prazo cadastrado: 2026-09-30.
- **TSK-0023 — NÃO INICIADA**, AGT-13 (Bruno). Configurar credenciais E2E de staging e rodar smoke Playwright Prazo cadastrado: 2026-10-06.
- **TSK-0028 — NÃO INICIADA**, AGT-09 (Theo). Reconciliar o histórico de migrations do projeto Supabase imvfmjgmacrulhztrqlh antes de qualquer db push Prazo cadastrado: 2026-09-28.

São **6 tarefas críticas abertas**. Os prazos do PRJ-0002 continuam sujeitos à aprovação indicada em HND-0003; o relatório não transforma prazo proposto em compromisso formal.

### Riscos abertos

- **RSK-0001 — ALTO / ABERTO**: Continuar construindo produto sem resolver aquisição. Responsável: Helena + Victor.
- **RSK-0002 — ALTO / ABERTO**: Escopo excessivo do MVP. Responsável: Nina + Helena.
- **RSK-0003 — ALTO / ABERTO**: Risco médico/regulatório/privacidade. Responsável: Clara.
- **RSK-0004 — ALTO / ABERTO**: Ausência de comprador/demanda validada. Responsável: Pedro + Augusto.
- **RSK-0005 — ALTO / ABERTO**: Privacidade, consentimento, fraude e qualidade dos dados. Responsável: Clara + Bruno.
- **RSK-0006 — ALTO / ABERTO**: Iniciar nova frente antes de concluir a estrutura atual. Responsável: Helena.
- **RSK-0007 — CRÍTICO / ABERTO**: credenciais de produção expostas; rotação pendente Responsável: Fundador (rotação, TSK-0012) + AGT-09 (Theo) (remoção do git, TSK-0013).
- **RSK-0008 — ALTO / ABERTO**: histórico de migrations divergente na produção do ids-max Responsável: AGT-09 (Theo).
- **RSK-0009 — CRÍTICO / ABERTO**: RLS, views e funções de produção do ids-max com problemas registrados Responsável: AGT-09 (Theo).

Nenhum valor secreto foi incluído nos arquivos de entrega.

## Handoffs e bloqueios

- **HND-0001 — ALTA**; destinatário Todos. Adoção do protocolo vivo.
- **HND-0003 — ALTA**; destinatário Helena / AGT-01. DECISÃO NECESSÁRIA — HELENA: prazos propostos, foco/WIP e prioridade do PRJ-0002 (ids-max / MaxNutrition AI).
- **HND-0004 — CRÍTICA**; destinatário AGT-09 (Theo). Execução técnica do PRJ-0002 — iniciar a TSK-0013 (segredos fora do git) e a TSK-0014 (projeto Supabase oficial).
- **HND-0012 — ALTA**; destinatário AGT-09 (Theo). Entrega da TSK-0029: corrigir o job de CI "AI worker (testes)" (PostCSS/tailwindcss).
- **HND-0014 — ALTA**; destinatário Helena / AGT-01. EXCEÇÃO DE IDENTIDADE NO HELENA GATEWAY: record_dispatch da Marina (AGT-04) gravado como AGT-17 (Isabela).
- **HND-0026 — BAIXA**; destinatário AGT-12 (Maya). Melhorias BAIXA da página Equipe (QA-PR6-03, 06, 07) em PR NOVO a partir da main, após a decisão do fundador sobre o merge do PR #6.

**Dependências do fundador:** retomada da TSK-0012; decisão sobre merge do PR 13 para concluir TSK-0013; projeto Supabase do aplicativo em TSK-0014; situação do trabalho local em TSK-0016; credenciais de staging da TSK-0023; hospedagem para TSK-0025; decisão de merge do PR 6 antes das melhorias de HND-0026. O estado desses PRs vem dos registros consultados e não foi reconfirmado no GitHub nesta sessão.

**Dependências dos agentes:** Theo trata CI e saneamento técnico; Bruno valida staging/QA; Nina decide o escopo de GPS público em TSK-0021; Helena precisa resolver enquadramento no WIP/prazos e validar a identidade do despachante.

**Cadeias principais:** TSK-0012 → conclusão da TSK-0013; TSK-0014 → TSK-0028 → TSK-0017; correção/teste de HND-0014 → possível reativação da REC-0005; decisão do fundador sobre PR 6 → HND-0026. TSK-0029 consta sem bloqueio e não depende da reconciliação de migrations.

## Divergências entre checkpoint e estado atual

1. **Integrações:** 9 → 10; Kokoro TTS VPS INT-0010 foi incluído como OFICIAL; ElevenLabs INT-0008 mudou CONFIGURADA → STANDBY.
2. **Jobs:** 20 → 27; READY 19 → 22; COMPLETED 1 → 5. Eventos 24 → 36. Os quatro novos COMPLETED são encerramentos de testes sem resposta a cliente.
3. **Handoffs:** 14 → 26; ABERTO 5 → 6; HND-0026 é um novo aberto. HND-0003 recebeu atualização de pendências.
4. **Tarefas:** 29 → 30; TSK-0030 foi incluída e está concluída após reteste de QA; TSK-0012 mudou NÃO INICIADA → BLOQUEADA; o bloqueio em cadeia de TSK-0013 foi explicitado.
5. **REC-0006:** snapshot indicava próxima ocorrência em 25/09; o banco registra execução em 25/09 e próxima em 28/09.
6. **Acessos:** usuários Auth 3 → 4; acessos ativos 1 → 3; vínculos de negócio 0 → 1. A revisão de permissões precisa considerar o member e os dois founders atuais.
7. **Memórias:** contagem 26 → 27. A seleção de memórias recentes do snapshot não inclui MEM-0029 e MEM-0030; MEM-0030 aparece referenciada no bloco de precheck.
8. **DEC-020:** vigente no banco e referenciada no bloco de precheck, mas ausente do array decisoes_vigentes do snapshot.
9. **Metadados internos:** snapshot.gerado_em antecede a V5; o markdown mantém título V1 e histórico V1. É necessário separar explicitamente histórico e retrato atual ao sincronizar.
10. **Blocos obrigatórios do snapshot:** comandos de leitura/sincronização, checklist, foco, portfólio, decisões, Estado Mestre, memórias, handoffs, agentes, jobs, integrações, automações, recorrências e segurança estão presentes. **fontes e mudancas_desde_anterior não existem dentro do snapshot**, embora estejam preenchidos nas colunas próprias do checkpoint. Pelo checklist enviado, essa duplicação obrigatória está ausente. Marcos e riscos completos também não estão consolidados no snapshot; há referências de segurança, e os dados atuais foram consultados diretamente.
11. **Textos operacionais antigos:** próximos passos de Estado Mestre 15/16 ainda mencionam V1/V2; nome de REC-0005 ainda fala em 30 minutos, contra a regra de duas horas; MEM-0024 chama 26/09/2026 de “próximo dia útil”, embora seja sábado e REC-0006 esteja agendada para segunda-feira 28/09.

Foco, portfólio, catálogo/conexões de agentes e estados das cinco automações não mostraram mudança material nos campos comparáveis. As divergências foram registradas localmente; nada foi reconciliado por escrita.

## Próxima ação

**Sincronizar o Checkpoint Mestre com esses deltas, dentro de FOC-004, quando o fundador autorizar pelo comando “Helena, sincronize o Checkpoint Mestre.”** A sincronização deverá partir de uma nova leitura atual, incluir as mudanças de acesso e manter os riscos/bloqueios abertos. Nenhuma nova frente foi ativada.

## Escopo e limites

Foram consultadas todas as 19 tabelas operacionais do comando, a view de entrada, a tabela de versões, catálogos de RLS/grants/policies, metadados de Auth e o advisor de segurança. Projeções de jobs/eventos e conexões omitiram payloads e referências de credenciais; foram usados os estados, evidências e metadados necessários. As leituras ocorreram em transações separadas; checkpoint e contagens principais foram reconferidos ao final.

Este relatório é um registro local datado, não uma cópia completa do banco, uma réplica local nem uma homologação de endpoints externos. A consulta ao sistema vigente sempre prevalece.

**CHECKPOINT CARREGADO: CP-20260925-V005 / V5**  
**STATUS: CARREGADO COM DIVERGÊNCIAS**

