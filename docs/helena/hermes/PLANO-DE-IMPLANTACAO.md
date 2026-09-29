# Mapa de implantação da Helena no Hermes

**Estado atual: piloto real homologado com acionamento manual; automação ainda pendente.** Em 27/09/2026, os 21 perfis estão provisionados: Helena GPT-6 Sol, demais 20 GPT-6 Luna. Quatro vínculos estão ACTIVE (Helena, Pedro, Clara e Victor) e 17 CONFIGURED. Gateway 3935f92 publicado no EasyPanel pela branch codex/hermes-runtime-preparation, sobre main 4aff8c3; health confirmou hermes-workflow-v2. Passaram 97 testes Node (incluindo 12 HTTP) e 22 integrações/segurança. Checkpoint atual CP-20260927-V021; regra PAG-V10-011.

O piloto BIZ-003 comprovou a sequência Helena cria/libera → Pedro assume manualmente, registra progresso e memória → Clara lê a evidência submetida e aprova somente um modelo interno → Pedro cria a próxima tarefa DRAFT → Victor a vê no próprio perfil. Job pai `JOB-HR-3ebae4abff11a58e457fe779e15705ab` ficou COMPLETED; evidência `MEM-HR-6d4c9666d8b09fa03a1162edf949d6ce`; job de Victor `JOB-HR-0e91cf1982fa751ce1e4cf93e7af48d7` permanece DRAFT. A leitura da evidência é limitada ao job, à empresa e à referência submetida. O piloto não validou termos comerciais de parceiros e não fez contato externo. A liberação READY não inicia sozinha o modelo Hermes: falta o acionador, além de escrita específica nas tabelas de domínio, memória pessoal, revisão dos 23 jobs legados e teto financeiro antes de recorrências. Os 21 hashes individuais continuam no Supabase; nenhuma credencial está neste documento. Detalhes: [relatório de instalação](instalacao-2026-09-27.json) e [workflow](../../../services/helena-gateway/HERMES-WORKFLOW.md).

A página **local** `http://localhost:8082/` foi atualizada e conferida: os dois cartões do piloto aparecem, e o job do Pedro mostra aprovação da Clara, motivo e eventos com horários. O rótulo incorreto de aceite não comprovado foi corrigido quando `approval_status=APPROVED`. Passaram 15 testes frontend direcionados, build e ESLint. Essa correção do frontend ainda não foi commitada nem publicada fora do workspace local.

**Fotografia inicial do mapeamento:** consulta em 2026-09-27T06:39:46.862035+00:00, equivalente a 27/09/2026 às 03:39:46 em São Paulo. Naquele momento, o checkpoint era CP-20260926-V012 e a implantação não havia começado. As fases e lacunas abaixo preservam esse plano de base; o estado operacional atual está no relatório e no checkpoint ativo.

## Resultado e limites do inventário

Na fotografia inicial, foram destinados 69 tabelas, 1 visão, 1543 colunas incluindo a visão, 21 agentes, 3 empresas, 11 integrações, 6 automações e 11 ferramentas do Gateway. Após `agent_runtime_bindings` e `agent_runtime_credentials`, o inventário atual tem 71 tabelas, 1 visão, 1559 colunas, 18 ferramentas e 25 funções mapeadas.

A cobertura é do inventário consultado e dos contratos de dados; não significa que todas as linhas, fórmulas de arquivos, permissões ou integrações já foram testadas. O plano está em mapeamento.json, com IDs, origens, colunas, responsáveis, destinos e critérios de aceite. A validação confere omissões e duplicidades.

A consulta encontrou 51 tarefas e 28 jobs, dos quais 23 READY e cinco COMPLETED. Não foram encontrados vínculos em channel_connections, buckets em Supabase Storage ou Edge Functions; pg_cron não está instalado. Isso não exclui agendadores ou arquivos em serviços externos.

## O significado de colocar tudo no Hermes

O **Hermes Web Dashboard será a central de uso**, com uma extensão Helena que reúne empresas, tarefas, decisões, CRM, financeiro, documentos, calendário e indicadores. Perfis, quadro de execução e agendamentos usam o mecanismo do Hermes. A extensão web possui suporte documentado a páginas e rotas de backend; a adaptação das telas da Helena ainda precisa ser construída. O SDK de extensão do Desktop é diferente; não pressupor que o mesmo plugin funciona nas duas interfaces. [Documentação da extensão web](https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard).

O **Supabase continua como banco oficial**. O Hermes usa operações empresariais restritas por um adaptador chamado, neste projeto, helena-core. Esse nome é uma proposta, não um pacote instalado. Não copiar as 69 tabelas para um SQLite local e declarar que o Hermes substituiu o sistema empresarial.

O Gateway existente fica inicialmente como serviço de integração reaproveitável. WhatsApp, telefonia, TTS e documentos externos são acessados a partir do Hermes, preservando o serviço que efetivamente executa cada função. Estar acessível dentro da central não significa que todos os serviços passam a rodar dentro de um único processo.

## Empresas e identidade dos agentes

- **BIZ-001 — iGreen:** quadro proposto `helena-biz-001`; ativação posterior, conforme demanda; nenhum quadro criado nesta etapa.
- **BIZ-002 — Ecossistema de Saúde:** quadro proposto `helena-biz-002`; ativação posterior, conforme demanda; nenhum quadro criado nesta etapa.
- **BIZ-003 — Humano Digital:** quadro proposto `helena-biz-003`; primeiro piloto; nenhum quadro criado nesta etapa.

Preservar os 21 IDs de agente. Um papel é um modelo de função; a identidade de execução é composta por papel e escopo. Exemplo proposto: pedro--biz-003. Ao servir outra empresa, o papel pode ser reaproveitado, mas memória privada, arquivos, sessão e autorização não são compartilhados automaticamente. Criar perfis apenas quando houver demanda; não multiplicar 21 processos continuamente por três empresas.

Helena no escopo GRUPO acessa o resumo autorizado da carteira; ao executar uma tarefa, assume um escopo empresarial explícito. Laura mantém o contexto pessoal do fundador separado. A consulta de outra empresa depende da autorização no servidor, não do nome do perfil.

Perfis Hermes têm estado próprio, mas não são uma barreira de acesso ao sistema operacional. Provisionar perfis limpos e credenciais mínimas; não clonar indiscriminadamente o perfil administrativo. [Perfis Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/profiles).

## Destino dos 21 papéis

As missões, entradas, saídas e limites atuais de cada agente foram preservados no manifesto. As permissões escritas no cadastro são material para construir uma lista permitida, não autorização automática de acesso ao banco. O revisor abaixo é responsável pelo aceite; isso não obriga uma chamada de IA em toda tarefa.

- **AGT-01 Helena — CEO Virtual / Central de Comando.** Ativação: P3. Revisão: Fundador: decisões reservadas. Entrega: Resumo executivo, decisão/pendência, responsável e próxima entrega.
- **AGT-02 Laura — Comunicação e Desenvolvimento do Fundador.** Ativação: P5. Revisão: Helena. Entrega: Padrão observado, exercício, evidência de evolução e próxima prática.
- **AGT-03 Augusto — Estratégia Corporativa.** Ativação: P4. Revisão: Helena. Entrega: Opções estratégicas, premissas, trade-offs, evidências faltantes e decisão requerida.
- **AGT-04 Marina — Execução e PMO.** Ativação: P3. Revisão: Helena. Entrega: Plano, marcos, dependências, bloqueios, prazos e definição de pronto.
- **AGT-05 Caio — Finanças / CFO.** Ativação: P4. Revisão: Helena. Entrega: Números, premissas, variações, riscos e decisão financeira requerida.
- **AGT-06 Clara — Risco, Jurídico e Compliance.** Ativação: P4. Revisão: Helena / profissional quando necessário. Entrega: Risco, impacto, controle, evidência necessária e quando buscar profissional humano.
- **AGT-07 Bianca — Pessoas e Cultura.** Ativação: P5. Revisão: Helena. Entrega: Papel, responsabilidade, lacuna, processo de seleção/desempenho e próxima ação.
- **AGT-08 Daniel — Dados e BI.** Ativação: P4. Revisão: Dono da fonte / Helena. Entrega: Métrica, definição, fórmula/fonte, leitura do resultado e lacunas de dados.
- **AGT-09 Theo — Tecnologia e IA.** Ativação: P2. Revisão: Bruno. Entrega: Arquitetura/solução, trade-offs, dependências, riscos e critérios de aceite.
- **AGT-10 Nina — Produto.** Ativação: P5. Revisão: Helena. Entrega: Problema do usuário, hipótese, prioridade, critério de aceite e próximo teste/entrega.
- **AGT-11 Ravi — Pesquisa e Insights.** Ativação: P5. Revisão: Augusto. Entrega: Hipótese, método, evidência, padrão encontrado e implicação.
- **AGT-12 Maya — Design / UX / UI.** Ativação: P5. Revisão: Nina. Entrega: Problema de UX, proposta de design, critérios de usabilidade e handoff para produto/tecnologia.
- **AGT-13 Bruno — Qualidade / QA.** Ativação: P2. Revisão: Helena. Entrega: Cenário testado, esperado, obtido, severidade e evidência.
- **AGT-14 Olívia — Operações.** Ativação: P5. Revisão: Marina. Entrega: Processo, dono, gatilho, passos, controle, gargalo e melhoria.
- **AGT-15 Victor — Vendas.** Ativação: P4. Revisão: Helena. Entrega: Leads/etapas, objeções, conversões, próxima ação e evidência comercial.
- **AGT-16 Camila — Marketing e Growth.** Ativação: P4. Revisão: Augusto. Entrega: Canal, hipótese, audiência, oferta, métrica, resultado e próximo teste.
- **AGT-17 Isabela — Marca, Conteúdo e Copy.** Ativação: P4. Revisão: Camila. Entrega: Mensagem, público, objetivo, versão final e hipótese/resultado quando comercial.
- **AGT-18 Pedro — Parcerias e Desenvolvimento de Negócios.** Ativação: P3. Revisão: Clara. Entrega: Parceiro, tese, valor mútuo, estágio da conversa, risco e próxima ação.
- **AGT-19 Renata — Customer Success.** Ativação: P4. Revisão: Helena. Entrega: Estado do cliente, valor alcançado, risco, feedback e próxima ação.
- **AGT-20 Joana — Atendimento.** Ativação: P4. Revisão: Renata. Entrega: Solicitação, resposta, resolução, evidência e recorrência/problema sistêmico.
- **AGT-21 Felipe — Administração.** Ativação: P5. Revisão: Olívia. Entrega: Registro, documento/fornecedor, vencimento, responsável e próxima ação.

Cada perfil deverá receber identidade/função, regras de contexto, ferramentas permitidas, limite de execução, definição de pronto, procedimento de registro e procedimento de bloqueio. Modelos e valores de orçamento permanecem a definir; nenhum valor vazio concede execução ilimitada.

## Destino de cada domínio de dados

### Identidade, papéis e regras

Responsável: Helena / Bianca. Destino: Perfis Hermes + procedimentos versionados + área Helena/Regras.

Exportar somente instruções aprovadas para perfis; regras e versões oficiais permanecem no banco; permissões são aplicadas no servidor.

Fontes preservadas: `agentes`, `equipe`, `protocolo_agentes`, `guia_operacao`, `helena_guia`, `helena_campos`, `sistema_vivo`, `configuracao`, `governanca`.

### Memória, direção e decisões

Responsável: Helena / Augusto. Destino: Contexto por sessão + área Helena/Decisões.

Carregar pacote de contexto por empresa e versão; devolver decisões duráveis ao banco; memória local contém apenas o contexto permitido.

Fontes preservadas: `estado_mestre`, `foco_executivo`, `memoria_mestre`, `checkpoint_mestre`, `decisoes`, `fundador`, `ideias`.

### Tarefas, fila e evidências

Responsável: Marina / Theo. Destino: Kanban Hermes + adaptador helena-core.

Vincular tarefa/job/cartão/run/tentativa; Hermes executa; Supabase decide o aceite empresarial; replicar eventos sem duplicar efeitos.

Fontes preservadas: `tarefas`, `agent_jobs`, `agent_job_events`, `task_activity`, `handoffs`, `agent_connections`.

### Projetos e processos

Responsável: Marina / Olívia / Nina. Destino: Área Helena/Projetos e Indicadores.

Dependências e critérios oficiais no banco; criar trabalho executável no Hermes apenas quando liberado.

Fontes preservadas: `projetos`, `marcos`, `processos`, `produto`, `metas_kpis`.

### Captação, vendas e atendimento

Responsável: Camila / Victor / Renata / Joana. Destino: Área Helena/Comercial + ferramentas dos especialistas.

Entradas por canal autorizado e empresa; propostas de mensagens separadas de envio; rastrear contato até ativação e receita comprovada.

Fontes preservadas: `crm`, `clientes`, `marketing`, `atendimento`, `comunicacoes`.

### Financeiro e conciliação

Responsável: Caio / Daniel. Destino: Área Helena/Financeiro.

Preservar fórmulas, lançamentos e conciliação determinística; agentes explicam e propõem, sem usar texto gerado como comprovação de pagamento.

Fontes preservadas: `financeiro`, `contas_financeiras`, `plano_contas`, `orcamento`, `dre_mensal`, `fluxo_caixa`.

### Empresas e administração

Responsável: Helena / Felipe / Bianca. Destino: Seletor de empresa + área Helena/Cadastros.

Preservar IDs e relacionamentos; perfis separados por empresa quando houver dados específicos; cadastro global com permissões próprias.

Fontes preservadas: `portfolio`, `entidades`, `societario`, `pessoas`, `fornecedores`, `ativos`.

### Documentos, contratos e obrigações

Responsável: Felipe / Clara. Destino: Área Helena/Documentos + ferramentas de arquivos.

Manter referências e versões; anexos duráveis com acesso por empresa; conferir prazos e consentimento antes de ações externas.

Fontes preservadas: `documentos`, `contratos`, `obrigacoes`, `consentimentos`.

### Agenda e rotinas

Responsável: Marina / Caio / Felipe. Destino: Cron Hermes + área Helena/Agenda.

Uma autoridade por ocorrência; scripts fazem checagens; IA recebe somente lote relevante; preservar fuso, idempotência e política de atrasos.

Fontes preservadas: `calendario`, `recorrencias`, `automacoes`.

### Canais, voz e integrações

Responsável: Theo / Helena. Destino: Ferramentas MCP restritas + área Helena/Integrações.

Integrar Gateway existente, WhatsApp e voz sem duplo consumidor; resolver empresa antes do agente; confirmar entrega externa.

Fontes preservadas: `integracoes`, `integration_events`, `channel_connections`, `call_sessions`, `voice_profiles`, `notification_outbox`, `sync_log`.

### Acesso, auditoria e recuperação

Responsável: Theo / Bruno / Clara. Destino: Identidade do operador + adaptador + área Helena/Controle.

Identidade do Hermes não vira automaticamente usuário Supabase; mapear identidade autenticada e autorização; preservar auditoria e testar restauração.

Fontes preservadas: `acessos`, `app_access`, `user_business_access`, `auditoria`, `auditoria_sistema`, `incidentes`, `riscos`, `backups`.

### Dicionário, fórmulas e domínios

Responsável: Daniel / Theo. Destino: Contrato de dados + importação conferida de planilhas.

Normalizar nomes legados, reproduzir cálculos determinísticos e rejeitar importação inconsistente antes de gravar.

Fontes preservadas: `dicionario_dados`, `regras_formula`, `listas_dominio`.

A visão checkpoint_mestre_atual continua sendo a entrada de retomada. Preservar também as funções existentes de gravação com versão, publicação de checkpoint, calendário, finanças e execução. Triggers não devem ser chamados como ferramentas comuns nem reimplementados em prompts.

Aliases legados precisam de resolução explícita: Config corresponde a configuracao; Dashboard é uma projeção de indicadores, não uma tabela que autoriza escrita. As referências de abas e nomes com maiúsculas devem ser normalizadas contra o dicionário.

## Um único caminho de execução

1. O fundador conversa na central Hermes; a empresa selecionada acompanha o comando. O servidor confirma acesso e intenção autorizada.
2. Marina registra ou atualiza a tarefa oficial, suas dependências e critérios de pronto. A gravação usa a versão lida.
3. O adaptador verifica elegibilidade e orçamento e grava o pedido recuperável de execução. Cria um único cartão Hermes usando chave idempotente e vínculo estável com o job.
4. O dispatcher Hermes inicia o especialista. O aceite e o run real são reconciliados com o Supabase; registrar um DISPATCHED não basta.
5. O agente registra marcos: o que fez, motivo, fonte, evidência, impedimento e próximo passo. Sinais de vida são emitidos pelo processo, sem chamar um modelo.
6. A conclusão técnica segue para conferência. Somente a aceitação empresarial, com a versão e as evidências corretas, conclui a tarefa oficial.
7. O adaptador libera o próximo trabalho depois do aceite. O painel mostra o percurso e o responsável seguinte; alertas críticos têm estado de entrega real.

O Kanban fornece mecanismo de execução e revisão, mas seu estado done não deve, sozinho, conceder aceite no sistema Helena. Não pré-carregar dependentes executáveis que possam ser liberados pelo quadro antes da validação empresarial. Manter decomposição automática desativada no piloto; uma proposta de subtarefas deve passar pelos limites e vínculos do adaptador. [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban).

**Autoridade:** o adaptador autoriza e reconcilia o trabalho; o dispatcher Hermes inicia o processo. O Gateway antigo não pode iniciar em paralelo o mesmo job. Na dúvida sobre resposta de criação, consultar pela chave antes de reenviar. Repetição de evento é esperada; a consequência precisa ser idempotente.

**Identificadores:** business_id, task_id, job_id, agent_id, profile_id, board_id, card_id, run_id, attempt_id, event_id, idempotency_key, versão da tarefa e versão do procedimento. Gravar data/hora/segundos em UTC; exibir America/Sao_Paulo. Horário não substitui comparação de versão nem controle de posse.

**Eventos atrasados:** um worker cuja posse expirou não pode concluir a tentativa nova. Cada evento precisa de origem e identificação para deduplicação. O cursor de reconciliação não pode avançar sem salvar o lote correspondente.

## Adaptação das ferramentas existentes

- **list_ready_jobs:** Consulta administrativa filtrada; apenas adaptador/Marina lê fila autorizada.
- **record_dispatch:** Somente telemetria. Acrescentar envio efetivo ao dispatcher Hermes e aguardar aceite; não marcar execução a partir deste evento.
- **get_job:** Consultar pacote mínimo de tarefa + versão + empresa.
- **claim_job:** Espelhar aceite real e posse do worker; adaptar para impedir claim concorrente do legado.
- **start_job:** Marcar início após sinal real do worker, com runtime_run_id.
- **record_progress:** Registrar marcos e por quê; não enviar token por token ao banco.
- **complete_job:** Conclusão técnica do job; encaminhar para aceite empresarial antes de concluir tarefa e liberar dependentes.
- **fail_job:** Falha com motivo e evidência; limitar tentativas e classificar erro permanente.
- **waiting_helena:** Criar revisão/decisão visível; não disparar loops entre agentes.
- **enqueue_job:** Criar uma execução para intenção autorizada e idempotente; validar empresa/role/dependências.
- **queue_summary:** Visão agregada da operação, sem conceder acesso aos detalhes de outras empresas.

O Hermes documenta consumo de MCP HTTP e local. Vamos aproveitar esse caminho para conectar o contrato existente, validando autenticação e filtros de ferramentas. Não entregar ao agente acesso genérico administrativo ao Supabase. [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).

Os nomes agent_runtime_links, agent_runtime_outbox, agent_usage_ledger e agent_budget_reservations no manifesto são propostas de persistência. Antes de criar qualquer tabela, revisar o que pode ser atendido por campos existentes e migrations mínimas. Nada foi criado no banco nesta etapa.

## Integrações, uma por uma

- **INT-0001 Google Drive — cadastro PLANEJADA.** Destino: Workspace + helena-core. Preservar IDs/versões e espelho de metadados; indexar apenas alterações. Aceite: Arquivo e revisão aparecem com acesso correto.
- **INT-0002 Gmail — cadastro PLANEJADA.** Destino: Workspace + fila de comunicações. Importação incremental, deduplicação por ID; rascunhos e envios são ações distintas. Aceite: Mesmo email importado duas vezes gera um registro.
- **INT-0003 Google Calendar — cadastro PLANEJADA.** Destino: Workspace + serviço de calendário. Autoridade por campo, versão e occurrence_id; respeitar timezone. Aceite: Atualização em ambos os lados gera conflito visível, sem sobrescrita silenciosa.
- **INT-0004 Automação de Recorrências — cadastro PLANEJADA.** Destino: Cron sem IA + RPCs existentes. Eleger o único materializador; desligar o anterior no corte da rotina. Aceite: Uma ocorrência gera um conjunto de registros mesmo após repetição.
- **INT-0005 Helena Gateway — cadastro PLANEJADA.** Destino: Adaptador/MCP helena-core. Reutilizar operações empresariais; substituir referência operacional a Grok por vínculo de runtime versionado. Aceite: Tarefa real aceita, executada e devolvida pelo Hermes.
- **INT-0006 Evolution API — cadastro CONFIGURADA.** Destino: Adaptador restrito no Gateway. Manter caminho atual no piloto; não ativar em paralelo outro receptor para o mesmo evento/número. Aceite: Entrada e resposta vinculadas à empresa e confirmação externa.
- **INT-0007 Meowcaller — cadastro CONFIGURADA.** Destino: Serviço de voz externo integrado. Preservar transporte de chamadas; Hermes acompanha resultados e tarefas, sem presumir substituir mídia em tempo real. Aceite: Chamada teste tem início, término e histórico no banco.
- **INT-0008 ElevenLabs — cadastro STANDBY.** Destino: Ferramenta opcional em standby. Manter desativado como padrão; falha do TTS não autoriza troca paga automática. Aceite: Fallback somente se autorizado por política e orçamento.
- **INT-0009 Laya Service — cadastro CONFIGURADA.** Destino: Classificação restrita no Gateway. Preservar triagem; checar quando regra determinística dispensa classificador. Aceite: Classificação rastreada, sem responder diretamente ao cliente.
- **INT-0010 Kokoro TTS VPS — cadastro OFICIAL.** Destino: Serviço TTS integrado. Reutilizar perfis e API; resolver empresa/voz explicitamente. Aceite: Áudio produzido e histórico coerente com perfil.
- **INT-0011 Codex Automations — cadastro PAUSADA.** Destino: Legado preservado, substituição por Cron Hermes. Continuar pausada; criar nova referência de executor durante implantação, preservando histórico. Aceite: Revisão do Hermes funciona sem aplicativo Codex aberto.

Para WhatsApp, o piloto reaproveita Evolution. A alternativa nativa WhatsApp Cloud existe e pode ser avaliada em etapa própria; não é substituição automática do transporte atual nem prova de equivalência para chamadas de voz. Não ativar dois consumidores para o mesmo número/evento. [WhatsApp Cloud](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud).

## Agendamentos e custo

- **AUTO-0001 Importar emails relevantes:** Script incremental; IA só para itens que exigem interpretação. Aceite: Mesmo message_id não cria duplicação. Estado atual: PLANEJADA; nenhum agendamento novo criado.
- **AUTO-0002 Sincronizar calendário:** Script de sincronização com versão/ETag e empresa. Aceite: Conflito é registrado; datas preservam fuso. Estado atual: PLANEJADA; nenhum agendamento novo criado.
- **AUTO-0003 Indexar documentos:** Script de detecção; extração/classificação sob demanda. Aceite: Revisão inalterada não é reprocessada. Estado atual: PLANEJADA; nenhum agendamento novo criado.
- **AUTO-0004 Materializar recorrências:** Materializador determinístico com chave por ocorrência. Aceite: Uma ocorrência, uma execução, inclusive após reinício. Estado atual: PLANEJADA; nenhum agendamento novo criado.
- **AUTO-0005 Backup periódico:** Backup por código e verificação de restauração. Aceite: Banco e estado local Hermes recuperados com cursor coerente. Estado atual: PLANEJADA; nenhum agendamento novo criado.
- **AUTO-0006 Checkpoint diario de supervisao em lote da Helena:** Coletor sem IA + lote Helena se houver mudança material. Aceite: Uma revisão por lote; painel atualizado e alerta crítico confirmado. Estado atual: PAUSADA; nenhum agendamento novo criado.

A revisão da Helena usará coletor determinístico e cursor de mudanças. Uma ou duas janelas diárias são opções; horário e frequência permanecem a definir. Sem mudança relevante, não chamar IA. Exceções críticas podem entrar antes da janela. O envio ao WhatsApp usa a política já escolhida pelo fundador: somente críticos.

Existe suporte a agendamentos sem agente no Hermes; o script ainda consome recursos de infraestrutura. Preservar o timezone, identificar cada ocorrência e definir o tratamento de períodos em que o servidor esteve desligado. [Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron).

Limites propostos: no máximo dois trabalhos globais e um por empresa; uma tentativa inicial e até uma repetição transitória dentro do limite autorizado. O limite global será aplicado no adaptador, inclusive entre quadros. Não presumir que um limite local por quadro atende sozinho ao limite do grupo.

Toda chamada paga, inclusive revisão, delegação e ferramenta, precisa reservar uso antes de iniciar. Cancelar não desfaz cobrança já consumida. Valores monetários, modelos e fonte de acesso são pendências de configuração; sem eles, o piloto pago permanece bloqueado. O consumo antigo do Grok está fora deste mapeamento.

## Planilhas e documentos

Inventariar arquivo/ID, abas, proprietário, empresa, cabeçalhos, chaves, versões, fórmulas, vínculos e permissões. Ainda não foram examinados os arquivos originais; não marcar essa etapa como pronta apenas porque existe source_sheet.

Preservar original e hash/versão; importar em conferência; validar tipo, moeda, datas, duplicatas, referências e totais; comparar fórmulas relevantes; promover só o resultado aprovado. Reimportar não pode duplicar. Definir autoridade por campo: banco oficial; planilha como entrada controlada ou relatório/exportação.

Habilidades Google Workspace oferecem operações sobre Sheets e Drive, mas regras empresariais e conciliação serão nossas. [Google Workspace](https://hermes-agent.nousresearch.com/docs/user-guide/skills/google-workspace).

Anexos produzidos precisam de armazenamento durável fora de pastas temporárias de execução. Como não há bucket de Storage encontrado, escolher e configurar o destino autorizado, com acesso por empresa, hash, versão e referência em documentos/evidências. Pode ser Storage ou Drive após homologação; não presumir que já está disponível.

## Interface e hospedagem

O destino é uma área Helena no Hermes Web Dashboard; o manifesto também cobre as rotas atuais, inclusive aliases e módulos dinâmicos. Os cartões abrirão responsável, objetivo, motivo, etapa atual, evidências, pendências, revisor e próximo passo. As ações do painel usam o mesmo serviço de autorização dos agentes.

O login do Hermes não fornece automaticamente um token Supabase ou permissão sobre todas as empresas. O plugin deve mapear identidade autenticada ao acesso empresarial; evitar tanto duas sessões independentes sem vínculo quanto uma credencial administrativa entregue ao navegador. [Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard).

Manter o painel atual como referência e retorno até paridade validada. O Desktop Hermes é opcional, conectado ao mesmo backend quando configurado; não iniciar outro dispatcher e outra agenda com as mesmas identidades.

Proposta de produção: um host Linux persistente inicialmente, sem GPU dedicada; Windows permanece útil para desenvolvimento. Host, região, capacidade e orçamento ainda não foram escolhidos. Fechar o aplicativo do operador deve deixar o serviço do servidor funcionando. A fila local Hermes não deve ser compartilhada por dois hosts via arquivo SQLite; expansão distribuída exigirá coordenação explícita.

## Ordem de implementação

### P1 — Preservar e reconciliar

Dono: Helena / Marina / Theo. Dependências: nenhuma.

- Inventário e restauração testada.
- Revisar direção, checkpoint e fila legada.
- Inventário de planilhas e canais.

**Avançar quando:** Nenhum registro órfão introduzido; decisões reconciliadas e sem duplicar autorizações.

### P2 — Montar base e adaptador

Dono: Theo / Bruno. Dependências: P1.

- Hermes com versão fixada e serviço persistente.
- Identidade + ferramentas restritas + orçamento.
- Vínculos de runtime, outbox e anexos.

**Avançar quando:** Autenticação, gravação concorrente e limite de uso testados sem dados de outra empresa.

### P3 — Provar um ciclo

Dono: Marina / Pedro / Helena. Dependências: P2.

- Perfis piloto e quadro BIZ-003.
- Tarefa piloto completa + portal Helena mínimo.
- Revisão por lote sem dependência do Codex.

**Avançar quando:** Aceite, início, evidência e revisão aparecem com os mesmos IDs; custo conhecido.

### P4 — Trazer a operação comercial

Dono: Especialistas / Marina. Dependências: P3.

- Planilha reconciliada e CRM.
- Documentos, agenda e automações homologadas.
- Canal por empresa e notificações.

**Avançar quando:** 20 tarefas representativas avaliadas; reimportação/evento repetido sem efeito duplicado.

### P5 — Concluir corte e ampliar

Dono: Helena / Theo / Bruno. Dependências: P4.

- Demais papéis e módulos.
- Voz homologada por fluxo.
- Corte por domínio, backup e retorno ensaiado.

**Avançar quando:** Um executor responsável por job; nenhum legado ativo disputando ocorrências migradas.

No primeiro ciclo, usar uma cópia identificada da tarefa de Pedro TSK-0007. Preservar a TSK-0008 que já aparece em execução; investigar sua autoria antes de migrá-la. Não converter toda a fila READY em autorização de disparo. O piloto de receita continua Humano Digital, sem promessa de renda e com comprovação separada de pagamento de tarefa e comissão.

## Critérios de homologação

- **T01 Dois chats gravam a mesma versão:** A segunda escrita recebe conflito; o dado confirmado permanece.
- **T02 Webhook ou polling entrega duas vezes:** Um cartão e um efeito empresarial por chave.
- **T03 Queda após criação/aceite:** Reconciliar job/cartão; retomar ou bloquear, sem iniciar um duplicado.
- **T04 Worker antigo responde após perder posse:** Recusar conclusão e anexação na tentativa nova.
- **T05 Empresa A tenta operar B:** Negar por autorização do servidor, mesmo alterando prompt/tenant.
- **T06 Cartão Hermes é marcado done sem evidência:** Tarefa empresarial continua pendente de aceite; dependente não é liberado.
- **T07 Saldo autorizado acaba em chamadas paralelas:** Reservas atômicas impedem nova chamada além do limite.
- **T08 Reimportar mesma planilha:** Sem duplicar registros; conflito e fórmula divergente visíveis.
- **T09 Fechar o aplicativo do operador:** Execução segue no host persistente; nenhuma execução local extra.
- **T10 Restaurar backup:** Recuperar banco e estado Hermes; reconciliar cursor e jobs em voo antes de retomar.
- **T11 Mensagem crítica falha:** Estado de envio real registrado; nova tentativa limitada, sem alegar entrega.
- **T12 Alterar instrução de agente:** Nova versão só entra em sessão compatível; tentativa em andamento mantém versão registrada.

Os doze critérios acima ainda não foram homologados integralmente. A suíte local, o fluxo SQL com rollback e o piloto manual cobrem apenas parte dos cenários; não comprovam recuperação após queda, disparo automático, orçamento nem canal externo.

## Corte e retorno

Escolher uma janela por domínio. Suspender novos despachos do caminho antigo, terminar ou cancelar explicitamente trabalhos em voo, reconciliar IDs/versões, habilitar o novo dono de execução e verificar os primeiros resultados. Nunca apagar histórico para resolver divergência.

Se houver falha, parar novas liberações do Hermes, preservar eventos e evidências, reconciliar efeitos já confirmados e retornar somente os jobs elegíveis ao executor anterior. Backup de banco e exportação do estado Hermes são complementares; uma restauração precisa recuperar também o cursor e impedir repetição de mensagens ou lançamentos.

## Pendências identificadas

- **G01 Execução real:** O piloto Pedro → Clara → Victor funcionou com abertura manual dos perfis no Hermes. O Gateway ainda não inicia um perfil quando o job vira READY; construir acionador com identidade, idempotência, retomada e limite de custo. Dono: Theo; fase P2.
- **G02 Continuidade:** Resolvida para a direção GPT-6/Hermes em CP-20260927-V014, PAG-V10-010 e MEM-HERMES-GPT6-20260927. Próximos checkpoints devem usar as fontes operacionais atuais. Dono: Helena; fase P1.
- **G03 Canal sem empresa:** channel_connections tem zero registros. Mapear conta/número/evento para empresa antes de chamada ao agente. Dono: Theo; fase P4.
- **G04 Planilhas originais:** Arquivos, IDs de Sheets e fórmulas não foram inspecionados. source_sheet não prova conexão ativa. Dono: Daniel / Felipe; fase P4.
- **G05 Evidências duráveis:** A evidência textual do piloto foi salva em `memoria_mestre` e lida pela revisora. Anexos continuam sem destino homologado; escolher armazenamento autorizado e testar arquivos. Dono: Theo / Felipe; fase P2.
- **G06 Permissões legadas:** Referências a Config, Dashboard e abas de gestão são instruções; resolver aliases e listas de operações permitidas, não importar como autorização irrestrita. Dono: Theo / Clara; fase P2.
- **G07 Orçamento e provedor:** GPT-6 Sol/Luna configurados e testados em sessões curtas; teto mensal e bloqueio de novas chamadas ainda não definidos. Não ativar trabalho recorrente antes disso. Dono: Fundador / Caio; fase P2.
- **G08 Portal dentro do Hermes:** Extensão web é suportada; portar/adaptar as telas empresariais e mapear identidade. Plugin do Desktop usa SDK diferente. Dono: Theo / Maya; fase P3.
- **G09 Jobs legados:** 23 WAITING_HELENA com eventos de retenção e cinco COMPLETED históricos continuam intactos; há ainda um COMPLETED do piloto e um DRAFT para Victor, zero READY. Reconciliar agente, empresa, tarefa e atualidade dos legados um por um. Dono: Marina; fase P1.
- **G10 Hospedagem e disponibilidade:** Hermes escolhido na Hostinger e painel acessível; disponibilidade do worker e recuperação após reinício ainda não homologadas. Dono: Theo / Fundador; fase P2.

## Entrega desta etapa

Na fase inicial foram criados o mapa estruturado, este guia e uma visualização navegável. A implantação posterior está registrada no relatório e no checkpoint V014: perfis e modelos já configurados, Grok e fila antiga suspensos, sem agendamento ou execução empresarial homologada. O próximo trabalho técnico é conectar o Supabase ao Hermes com permissão restrita, montar o adaptador e provar um piloto com evidência.
