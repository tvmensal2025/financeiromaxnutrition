-- Implantação autorizada de proteção entre conversas. Sem agendamento ou envio.
-- Leitura consistente, versões esperadas e checkpoint com predecessor explícito.
-- Executar uma vez após a migração de concorrência; reexecução é inócua.
begin isolation level repeatable read;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
 anterior public.checkpoint_mestre; snap jsonb; atual jsonb; antes jsonb; plano jsonb;
 contagens jsonb:='{}'; counted_table record; total bigint; campos bigint; mapeados bigint;
 controle jsonb:='{"estado":"APLICADO_NO_SUPABASE; PAINEL_LOCAL_ATUALIZADO","protocolo":"PAG-V9-020","memoria":"MEM-CONCORRENCIA-20260926","tabelas_protegidas":["acessos","agentes","atendimento","ativos","auditoria_sistema","automacoes","backups","calendario","clientes","comunicacoes","configuracao","consentimentos","contas_financeiras","contratos","crm","decisoes","dicionario_dados","documentos","dre_mensal","entidades","equipe","estado_mestre","financeiro","fluxo_caixa","foco_executivo","fornecedores","fundador","governanca","guia_operacao","handoffs","helena_guia","ideias","incidentes","integracoes","listas_dominio","marcos","marketing","memoria_mestre","metas_kpis","obrigacoes","orcamento","pessoas","plano_contas","portfolio","processos","produto","projetos","protocolo_agentes","recorrencias","regras_formula","riscos","sistema_vivo","societario","tarefas"],"quantidade":54,"campo":"row_version","rpc_escrita":"helena_write_record","regra_conflito":"40001: preservar intenção e comparar com o estado atual, sem repetição automática","publicador_checkpoint":"helena_publish_checkpoint","checkpoint_exige":"Identificador do predecessor lido antes da preparação; leitura consistente das fontes","historicos_imutaveis":["auditoria","task_activity","agent_job_events"],"calendario":"Projeção de tarefas e CRM na mesma transação da origem","custo":"Verificação SQL por gravação, sem chamada de IA e sem nova agenda","fora_do_cas":["app_access","user_business_access","agent_jobs","agent_connections","notification_outbox","voice_profiles","channel_connections","call_sessions","integration_events","sync_log","helena_campos"],"limitacoes":["Não homologa bots externos nem duas conversas reais do ChatGPT.","Não garante que uma conversa leia dados atuais antes de responder.","Operadores com permissão de alterar estrutura podem desativar a proteção.","A comparação do predecessor do checkpoint não substitui a leitura consistente e a conferência de mudanças nas fontes."],"verificacao":{"frontend":123,"sql_reversiveis":20,"rls_empresa":3,"duas_sessoes":"Primeira preservada, segunda versão antiga recusada; chamadas sem sobreposição.","build":"PASSOU","typescript":"PASSOU"},"implantacao":{"banco":"APLICADA","painel":"LOCAL; publicação remota não realizada","agenda_codex":"PAUSADA","agenda_chatgpt":"NAO_CONFIGURADA"}}'::jsonb;
 supervisao jsonb:='{"custo":"Sem API separada. Execuções e checagens usam limites do plano ChatGPT; nenhum consumo zero prometido.","fluxo":["Tarefa agendada no ChatGPT carrega checkpoint ativo e mudanças relevantes no Supabase.","Uma revisão compacta do lote, sem IA por tarefa.","Parecer idempotente em auditoria para a aba Supervisão.","Resultado no ChatGPT; outro chat autorizado recupera o parecer do Supabase."],"regra":"Sem mudança relevante, não repetir parecer nem alerta. Sem nova agenda local, e-mail ou WhatsApp neste escopo.","estado":"CODEX_PAUSADO_CHATGPT_A_CONFIGURAR","instrucoes":"Helena — revisão diária no ChatGPT web\n\nCONFIGURAÇÃO INICIAL — executar uma única vez\nQuero uma tarefa agendada no ChatGPT web, independente do Codex e do meu computador, uma vez por dia às 18h no fuso America/Sao_Paulo, sem API paga separada. Antes de agendar, confirme que esta conta oferece tarefas agendadas com acesso ao Supabase e faça um teste de leitura no projeto ecosistemadossonhos, ref wxkgrykduqtsgmjkzlou. Leia public.checkpoint_mestre_atual e public.memoria_mestre, registro MEM-SUPERVISAO-CHAT-20260926. Confirme também se a ferramenta permite gravar pareceres em public.auditoria na execução agendada. Não peça chaves para colar no chat. Se faltar conexão ou recurso, explique exatamente o que falta; não crie um simples lembrete como se fosse uma revisão. Evite duplicatas: confira se já existe esta revisão antes de criar outra. Ao configurar, salve no Supabase o identificador real da nova agenda, seu executor, horário e estado; preserve o registro da agenda Codex pausada. Não marque como homologada antes da primeira execução automática comprovada.\n\nINSTRUÇÕES DA EXECUÇÃO RECORRENTE\nVocê atua como Helena, AGT-01, CEO Virtual. O fundador é a autoridade superior. A fonte canônica é o Supabase autorizado, nunca a memória isolada desta conversa. Comece por checkpoint_mestre_atual; carregue identidade, regras vigentes, foco executivo e a configuração atual de supervisão. A instrução mais recente do fundador prevalece. Não abra outra frente executiva.\n\nCompare o último parecer CHECKPOINT_SUPERVISAO_LOTE em auditoria com mudanças posteriores em task_activity, decisoes e agent_job_events. Confira riscos críticos abertos e pendências do fundador. Leia somente os detalhes necessários em tarefas, agent_jobs e fontes relacionadas. Mantenha os dados separados por business_id. Os 27 jobs legados sem task_id não provam trabalho novo nem vendas.\n\nFaça no máximo uma análise compacta por janela, priorizando cinco ou mais mudanças de tarefas, decisão estratégica, novo bloqueio, falha, WAITING_HELENA, risco crítico novo ou agravado, ou decisão pendente do fundador. Não repita alertas inalterados. Sem mudança relevante, encerre sem novo parecer e sem mensagem.\n\nPara lote relevante, registre uma única linha em auditoria, com acao CHECKPOINT_SUPERVISAO_LOTE e audit_id HCP-WEB-AAAAMMDD-18H, usando a data local e conferindo antes se já existe. Em valor_novo (JSON como texto), inclua resumo, acoes, decisoes_pendentes, fontes com IDs, janela, período coberto e executor real. Confirme a gravação antes de dizer que o painel foi atualizado. Se a gravação falhar, informe a falha. Não altere tarefas, decisões, acessos, jobs ou o Checkpoint Mestre nesta revisão.\n\nPublique um resumo curto no resultado desta tarefa do ChatGPT quando houver mudança relevante ou falha. Não prometa inserir mensagens no chat que o fundador estiver usando. Não envie e-mail nem WhatsApp. Não copie segredos ou dados pessoais desnecessários. Não chame uma API separada.\n\nRETOMADA EM OUTRO CHAT\n“Helena, carregue o checkpoint_mestre_atual do Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou), a memória MEM-SUPERVISAO-CHAT-20260926 e o último parecer CHECKPOINT_SUPERVISAO_LOTE. Confirme seu papel, o foco atual, pendências, decisões e o estado real da agenda antes de continuar.”\nSe o novo chat não tiver acesso autorizado ao Supabase, informe SUPABASE NÃO CONECTADO. Não presuma que a autenticação migrou com a conversa.\n\n\nPROTEÇÃO ENTRE CONVERSAS — gravações autorizadas fora da revisão somente leitura\nLeia public.protocolo_agentes, PAG-V9-020, e public.memoria_mestre, MEM-CONCORRENCIA-20260926. Nas tabelas retornadas por helena_concurrency_tables(), leia a linha operacional completa e conserve row_version da leitura que originou a intenção. Use helena_write_record(p_table, p_id, p_expected_version, p_changes, p_delete) para atualizar ou excluir; envie somente campos alterados. Nunca use UPDATE/DELETE direto ou upsert para sobrescrever essas linhas. Em conflito 40001, preserve a intenção, releia e compare as duas alterações. Não substitua a versão e repita automaticamente. Novos registros usam INSERT; colisões de chave devem ser tratadas como possíveis duplicatas, sem sobrescrita. Correções em auditoria, task_activity e agent_job_events são novos eventos, sem reescrever o histórico. Uma sincronização material de contexto usa helena_publish_checkpoint com o checkpoint_id lido antes de montar o novo retrato. Esta proteção não autoriza novas alterações: a revisão diária continua limitada à leitura e ao parecer em auditoria. O acesso ao banco deve existir em cada chat; nenhum agendamento novo foi ativado por esta regra.\n","memoria_id":"MEM-SUPERVISAO-CHAT-20260926","proxima_acao":"Entrar no ChatGPT, verificar tarefas e conexão Supabase, testar leitura/gravação, configurar a tarefa e homologar a primeira execução.","automation_id":"AUTO-0006","portabilidade":"A memória canônica fica no Supabase; cada chat precisa de acesso autorizado. A tarefa não envia automaticamente para qualquer novo chat.","recurrence_id":"REC-0001","agenda_chatgpt":{"estado":"NAO_CONFIGURADA","motivo":"Navegador disponível sem login no ChatGPT.","external_id":null,"acesso_supabase":"NAO_VERIFICADO_NA_CONTA"},"executor_ativo":null,"integration_id":"INT-0011","janelas_ativas":0,"agenda_anterior":{"estado":"PAUSED","executor":"CODEX_LOCAL","external_id":"helena-checkpoint-di-rio-de-supervis-o","automation_id":"AUTO-0006","recurrence_id":"REC-0001","integration_id":"INT-0011"},"horario_proposto":"18:00 America/Sao_Paulo","destino_escolhido":"CHATGPT_WEB","referencia_oficial":"https://learn.chatgpt.com/docs/automations","tarefa_implantacao":"TSK-0031","preferencia_fundador":"Conversar com Helena no ChatGPT normal, trocar de chat e manter revisão independente do Codex, sem API separada.","janelas_propostas_por_dia":1,"controle_concorrencia":{"protocolo":"PAG-V9-020","memoria":"MEM-CONCORRENCIA-20260926","rpc":"helena_write_record","publicador_checkpoint":"helena_publish_checkpoint","regra_conflito":"40001: preservar intenção e comparar com o estado atual, sem repetição automática"}}'::jsonb;
begin
 select * into strict anterior from public.checkpoint_mestre_atual;
 if anterior.snapshot->>'marcador_concorrencia'='helena_concorrencia_20260926' then return; end if;
 if anterior.checkpoint_id<>'CP-20260926-V011' then
  raise exception 'O checkpoint mudou desde a preparação. Releia e reconcilie.' using errcode='40001';
 end if;
 if exists(select 1 from public.protocolo_agentes where protocolo_id='PAG-V9-020')
  or exists(select 1 from public.memoria_mestre where id='MEM-CONCORRENCIA-20260926') then
  raise exception 'Já há registro desta implantação sem checkpoint correspondente; reconciliar antes de gravar';
 end if;
 select jsonb_build_object(
  'memorias',(select jsonb_agg(to_jsonb(m)) from public.memoria_mestre m where id in ('MEM-PLANO-20260926','MEM-SUPERVISAO-CHAT-20260926','MEM-0026')),
  'estado_mestre',(select jsonb_agg(to_jsonb(e)) from public.estado_mestre e where registro_id in(15,16))
 ) into antes;
 insert into public.protocolo_agentes(protocolo_id,versao,secao,regra,aplicacao,responsavel,status,ultima_atualizacao)
 values('PAG-V9-020','9.3','R20 — Concorrência e preservação de histórico','Toda conversa, agente ou pessoa que altere tabelas de domínio protegidas deve ler a linha operacional e conservar row_version da leitura que originou a intenção. Atualizar ou excluir exclusivamente por helena_write_record, com versão esperada e somente campos pretendidos. Em conflito 40001, preservar rascunho/intenção, reler e comparar; nunca renovar versão e repetir automaticamente. Não sobrescrever com UPDATE/DELETE direto ou upsert. Novos registros usam INSERT e colisão de chave não autoriza sobrescrita. Auditoria, histórico de tarefas e eventos de jobs são append-only. Checkpoint material usa helena_publish_checkpoint com o predecessor lido antes de montar o retrato; preservar versões anteriores. O controle opera no banco, sem IA por gravação. Acesso e segregação por empresa continuam obrigatórios. Cobertura e limites em MEM-CONCORRENCIA-20260926; filas, autenticação e configurações técnicas têm protocolos próprios.','TODOS','AGT-01 Helena','ATIVA','2026-09-26');
 insert into public.memoria_mestre(id,data_hora,session_id,tipo,business_id_area,scope_type,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade)
 values('MEM-CONCORRENCIA-20260926',now()::text,'HELENA-CONCORRENCIA-20260926','REGRA','GRUPO','GLOBAL','AGT-01 Helena / Codex',
 'Proteção contra sobrescrita entre conversas e agentes',controle::text,
 'Migração 20260927003507 aplicada; scripts/testar-concorrencia.sql; 123 testes frontend; três testes RLS; docs/helena/controle-concorrencia.md',
 'ATIVA','VERIFICADO NO ESCOPO DESCRITO','PROTOCOLO','PAG-V9-020',
 'Homologar escritores externos e duas conversas reais com acesso autorizado; conservar foco executivo atual.','AGT-01 Helena','INTERNO');
 perform public.helena_write_record('memoria_mestre','MEM-SUPERVISAO-CHAT-20260926',517,jsonb_build_object('registro',supervisao::text));
 select registro::jsonb into plano from public.memoria_mestre where id='MEM-PLANO-20260926';
 plano:=plano||jsonb_build_object('supervisao',supervisao,'controle_concorrencia',controle);
 perform public.helena_write_record('memoria_mestre','MEM-PLANO-20260926',513,jsonb_build_object('registro',plano::text));
 perform public.helena_write_record('memoria_mestre','MEM-0026',514,jsonb_build_object('registro','COMANDO OFICIAL: "Helena, sincronize o Checkpoint Mestre".

FLUXO OBRIGATÓRIO:
1) Registrar primeiro a mudança na tabela operacional correta (ex.: decisoes, estado_mestre, memoria_mestre, handoffs, projetos, tarefas, integracoes, automacoes, recorrencias, riscos etc.).
2) Comparar o estado real atual com public.checkpoint_mestre_atual.
3) Avaliar se a mudança é MATERIAL. Se não for material, não criar nova versão.
4) Agrupar mudanças relacionadas da mesma sessão/bloco de trabalho.
5) Revisar os campos obrigatórios.
6) Criar a nova versão somente via public.helena_publish_checkpoint(p_expected_checkpoint_id, ...).
7) Validar o resultado e comunicar o checkpoint_id/versao.

GATILHOS DE NOVA VERSÃO:
- nova decisão canônica ou substituição de decisão vigente;
- mudança de FOC/WIP/prioridade executiva;
- mudança de estágio, objetivo, gargalo, responsável ou direção material de negócio;
- projeto/marco crítico iniciado, concluído, bloqueado ou reaberto;
- agente muda de PLANNED/CONNECTED/OPERATIONAL ou ocorre alteração relevante de plataforma/conexão;
- integração/automação/recorrência muda de planejada/configurada/ativa/pausada/homologada/operacional ou equivalente;
- alteração relevante de arquitetura;
- mudança de Auth, RLS, grants, policies ou outra segurança importante;
- risco, bloqueio ou handoff crítico criado ou resolvido;
- correção de informação relevante de checkpoint anterior;
- mudança material em pendências/próxima ação que altere continuidade.

NÃO É GATILHO SOZINHO:
- passagem de dia;
- comentário;
- pequena atualização rotineira;
- progresso de tarefa sem impacto consolidado;
- atualização repetida sem mudança de estado.

CAMPOS/BLOCOS A REVISAR ANTES DE VERSIONAR:
- resumo_executivo;
- foco executivo e WIP;
- portfolio: estágio, objetivo, gargalo, KPI, responsáveis e riscos;
- decisoes vigentes;
- estado_mestre;
- memorias relevantes recentes;
- handoffs abertos/críticos;
- projetos, marcos e tarefas críticas;
- agentes, conexões e qualificação de operação;
- jobs e status relevantes;
- integracoes;
- automacoes;
- recorrencias;
- Auth/RLS/segurança;
- bloqueios e riscos;
- próximas ações e responsáveis;
- evidências/fontes;
- mudancas_desde_anterior.

CAMPOS TÉCNICOS OBRIGATÓRIOS DA NOVA VERSÃO:
titulo; resumo_executivo; conteudo_markdown; snapshot JSONB; mudancas_desde_anterior JSONB; fontes JSONB; criado_por; motivo. checkpoint_id, versao, status, checkpoint_anterior_id e timestamps seguem o mecanismo versionado.

VALIDAÇÕES OBRIGATÓRIAS:
- exatamente um checkpoint ATIVO;
- versão incrementada em 1;
- checkpoint_anterior_id correto;
- snapshot não vazio;
- fontes presentes;
- mudancas_desde_anterior descrevendo o delta material;
- contagens e estados principais compatíveis com o Supabase atual;
- nenhuma afirmação de OPERACIONAL/CONCLUÍDO/TESTADO sem evidência;
- nenhum segredo, token, senha ou chave gravado no checkpoint;
- conflito resolvido pela precedência: Supabase/produção > decisões/estado atuais > checkpoint ativo > memória/histórico;
- versão anterior permanece preservada como SUPERADO.

SEM MUDANÇA MATERIAL:
Ao receber o comando e não encontrar mudança material, Helena deve informar que o checkpoint atual permanece vigente e NÃO criar versão artificial.

Proteção implantada em 26/09/2026: ler e conservar o checkpoint_id antes de preparar o retrato; em conflito, reler e reconciliar. Gravações operacionais usam row_version e helena_write_record conforme PAG-V9-020. A função antiga não é mais uma entrada direta autorizada.'));
 perform public.helena_write_record('estado_mestre','15',434,'{"estado_atual":"ATIVO NO SUPABASE. Checkpoint versionado, exatamente uma versão ATIVA, anteriores preservadas. helena_publish_checkpoint exige o predecessor lido; publicação com predecessor antigo é recusada. A função antiga não deve ser chamada diretamente.","proxima_acao":"Consultar checkpoint_mestre_atual. Registrar mudanças autorizadas com versão esperada, preservar história e validar a nova versão.","fonte":"DEC-016 / migrações create_versioned_checkpoint_mestre e add_checkpoint_registration_function / PAG-V9-020 / MEM-CONCORRENCIA-20260926"}'::jsonb);
 perform public.helena_write_record('estado_mestre','16',435,'{"estado_atual":"REGRA OFICIAL ATIVA. Sincronizar apenas após mudança material registrada na fonte; preparar retrato consistente e publicar via helena_publish_checkpoint com o predecessor lido. Em conflito, reler e reconciliar, sem repetir automaticamente.","proxima_acao":"Consultar checkpoint_mestre_atual. Registrar mudanças autorizadas com versão esperada, preservar história e validar a nova versão.","fonte":"DEC-017 / MEM-0026 / PAG-V9-020 / MEM-CONCORRENCIA-20260926"}'::jsonb);
 insert into public.auditoria(audit_id,data_hora,session_id,agente_usuario,acao,sheet,object_id,campo,valor_anterior,valor_novo,motivo,fonte_evidencia,sensibilidade)
 values('AUD-HELENA-CONCORRENCIA-20260926',now()::text,'HELENA-CONCORRENCIA-20260926','AGT-01 Helena / Codex',
 'IMPLANTACAO_CONTROLE_CONCORRENCIA','protocolo_agentes','PAG-V9-020','contrato_e_continuidade',antes::text,controle::text,
 'Solicitação do fundador para uma conversa não sobrescrever trabalho de outra. Nenhuma agenda ou IA paga ativada.',
 'supabase/migrations/20260927003507_helena_optimistic_concurrency.sql; scripts/testar-concorrencia.sql; testes locais; docs/helena/controle-concorrencia.md','INTERNO');

 snap:=anterior.snapshot||jsonb_build_object('marcador_concorrencia','helena_concorrencia_20260926',
  'gerado_em',now(),'controle_concorrencia',controle,'supervisao_em_lote',supervisao);
 snap:=jsonb_set(snap,'{fontes_de_retomada,concorrencia}',to_jsonb('PAG-V9-020; MEM-CONCORRENCIA-20260926; helena_concurrency_tables; row_version lida na fonte operacional'::text));
 snap:=jsonb_set(snap,'{rotina_checkpoint_mestre,publicador}',to_jsonb('helena_publish_checkpoint com predecessor lido; em conflito, reconciliar'::text));
 snap:=jsonb_set(snap,'{registro_operacional}',coalesce(snap->'registro_operacional','{}')||jsonb_build_object('protocolo_concorrencia','PAG-V9-020','rpc_edicao','helena_write_record','historico','Correções por novos eventos'));
 snap:=jsonb_set(snap,'{validacao_local}',coalesce(snap->'validacao_local','{}')||jsonb_build_object('data','2026-09-26','frontend_testes',123,'build','PASSOU','typescript','PASSOU','sql_concorrencia',20,'sql_rls',3,'gateway_nesta_rodada','Não reexecutado; resultados anteriores preservados como históricos','observacao','Testes sem IA paga ou mensagens reais. Produção externa e duas conversas ChatGPT não homologadas.'));
 select count(*) into campos from information_schema.columns where table_schema='public';
 select count(*) into mapeados from information_schema.columns c where table_schema='public' and exists(select 1 from public.helena_campos h where h.tabela=c.table_name and h.coluna=c.column_name);
 if campos<>mapeados then raise exception 'Mapeamento físico incompleto'; end if;
 snap:=jsonb_set(snap,'{mapeamento_supabase}',snap->'mapeamento_supabase'||jsonb_build_object('campos',campos,'campos_mapeados',mapeados));
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,agente,cargo_funcao,missao,quando_ativar,ler_antes_de_responder,pode_atualizar,saida_obrigatoria,escalar_para,prompt_base,status,versao_prompt,estado_execucao,atualizado_em from public.agentes) x;
  snap:=jsonb_set(snap,'{agentes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.task_id),'[]'::jsonb) into atual from (select task_id,tarefa,business_id,project_id,responsavel,status,prioridade,prazo,definicao_de_pronto,bloqueio,atualizado_em from public.tarefas) x;
  snap:=jsonb_set(snap,'{tarefas}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.project_id),'[]'::jsonb) into atual from (select project_id,projeto,business_id,objetivo,status,responsavel,criterio_de_conclusao from public.projetos) x;
  snap:=jsonb_set(snap,'{projetos}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_id),'[]'::jsonb) into atual from (select business_id,negocio,ativo,estagio,objetivo_atual,principal_gargalo,kpi_principal,responsavel_executivo,proxima_entrega,riscos,atualizado_em from public.portfolio) x;
  snap:=jsonb_set(snap,'{portfolio}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.decision_id),'[]'::jsonb) into atual from (select decision_id,business_id,tipo,decisao,motivo,decisor,status,substitui_decision_id,atualizado_em from public.decisoes) x;
  snap:=jsonb_set(snap,'{decisoes_vigentes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.registro_id),'[]'::jsonb) into atual from (select registro_id,area,item,estado_atual,proxima_acao,fonte,confirmacao,responsavel,related_id,atualizado_em from public.estado_mestre) x;
  snap:=jsonb_set(snap,'{estado_mestre}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,tipo,business_id_area,agente_origem,assunto,status,related_object_id,proxima_acao,atualizado_em from public.memoria_mestre) x;
  snap:=jsonb_set(snap,'{memorias_recentes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,de,para,business_id_area,assunto,status,prioridade,prazo,atualizado_em from public.handoffs) x;
  snap:=jsonb_set(snap,'{handoffs}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,frente,status,responsavel,criterio_de_saida,atualizado_em from public.foco_executivo) x;
  snap:=jsonb_set(snap,'{foco_executivo}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,provider,connection_status,last_seen_at,last_tested_at,updated_at from public.agent_connections) x;
  snap:=jsonb_set(snap,'{conexoes_agentes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.job_id),'[]'::jsonb) into atual from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs) x;
  snap:=jsonb_set(snap,'{agent_jobs}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events) x;
  snap:=jsonb_set(snap,'{agent_job_events}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.integration_id),'[]'::jsonb) into atual from (select integration_id,sistema,objeto,direcao,business_id,dono,status,ultima_sync,source_system,frequencia,observacoes,atualizado_em from public.integracoes) x;
  snap:=jsonb_set(snap,'{integracoes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.automation_id),'[]'::jsonb) into atual from (select automation_id,nome,business_id,status,responsavel,gatilho,condicao,acao,frequencia,external_automation_id,integration_id,ultima_execucao,proxima_execucao,observacoes,atualizado_em from public.automacoes) x;
  snap:=jsonb_set(snap,'{automacoes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.recurrence_id),'[]'::jsonb) into atual from (select recurrence_id,nome,business_id,status,responsavel,frequencia,regra_rrule,timezone,automation_id,integration_id,external_id,gerar_automaticamente,horario_confirmado,proxima_ocorrencia,observacoes,atualizado_em from public.recorrencias) x;
  snap:=jsonb_set(snap,'{recorrencias}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_id),'[]'::jsonb) into atual from (select risk_id,business_id,project_id,categoria,risco,probabilidade,impacto,status,responsavel,prevencao_mitigacao,atualizado_em from public.riscos) x;
  snap:=jsonb_set(snap,'{riscos}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.milestone_id),'[]'::jsonb) into atual from (select milestone_id,project_id,business_id,status,responsavel from public.marcos) x;
  snap:=jsonb_set(snap,'{marcos}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,actor_role,occurred_at from public.task_activity) x;
  snap:=jsonb_set(snap,'{task_activity}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo_id),'[]'::jsonb) into atual from (select protocolo_id,versao,secao,regra,aplicacao,responsavel,status,atualizado_em from public.protocolo_agentes) x;
  snap:=jsonb_set(snap,'{protocolo_agentes}',atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.governance_id),'[]'::jsonb) into atual from (select governance_id,ritual,escopo,cadencia,dono,pauta_fixa,entrega_esperada,dia_hora,recurrence_id,status,observacoes,atualizado_em from public.governanca) x;
  snap:=jsonb_set(snap,'{governanca}',atual);
 for counted_table in select jsonb_object_keys(anterior.snapshot->'contagens') as table_name loop
  execute format('select count(*) from public.%I',counted_table.table_name) into total;
  contagens:=contagens||jsonb_build_object(counted_table.table_name,total);
 end loop;
 snap:=jsonb_set(snap,'{contagens}',contagens);
 perform public.helena_publish_checkpoint(
  anterior.checkpoint_id,'Continuidade protegida entre conversas da Helena',
  anterior.resumo_executivo||E'\nProteção de concorrência aplicada em 54 tabelas. Histórico preservado e checkpoint exige predecessor lido. Painel ajustado localmente. Escritores externos e duas conversas reais ainda precisam de homologação.',
  replace(anterior.conteudo_markdown,'registrar_checkpoint_mestre','helena_publish_checkpoint')||E'\n\n## Concorrência entre conversas — 26/09/2026\nPAG-V9-020 e MEM-CONCORRENCIA-20260926: alterações exigem row_version da leitura original, por helena_write_record. Conflito preserva a primeira gravação; comparar antes de nova tentativa. Novo checkpoint exige predecessor lido, sem sobrescrever versões antigas. Auditoria e eventos aceitam acréscimos; tarefas/CRM e calendário são gravados na mesma transação. São 54 tabelas com CAS; filas, autenticação e configurações técnicas conservam controles próprios. 123 testes frontend, 20 controles SQL e três verificações RLS passaram. O teste em duas sessões não teve sobreposição. Agenda Codex segue pausada; ChatGPT não configurado. Sem homologação de bots externos nem garantia de que todo chat lerá o banco antes de responder.',
  snap,jsonb_build_array('Proteção de versão e calendário atômico aplicada no banco','Painel usa versão da leitura e conserva rascunho ao conflitar','Regra e memória persistidas; rotina do checkpoint atualizada para predecessor explícito','1.543 campos físicos mapeados; 20 projeções e contagens atualizadas; agenda permanece pausada'),
  anterior.fontes||jsonb_build_array('public.protocolo_agentes:PAG-V9-020','public.memoria_mestre:MEM-CONCORRENCIA-20260926','public.auditoria:AUD-HELENA-CONCORRENCIA-20260926'),
  'AGT-01 Helena / Codex','Implantar proteção autorizada contra sobrescrita entre conversas e reconciliar continuidade');
end;
$sync$;
commit;
select checkpoint_id,versao,checkpoint_anterior_id,status from public.checkpoint_mestre_atual;
