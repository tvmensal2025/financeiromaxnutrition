-- Transição autorizada pelo fundador: ChatGPT web, sem API separada.
-- Exige a pausa real prévia da agenda Codex via automation_update.
-- Não configura uma tarefa no ChatGPT; conserva esse requisito como pendência.
begin isolation level repeatable read;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
  anterior public.checkpoint_mestre%rowtype;
  snap jsonb; atual jsonb; antes jsonb; contagens jsonb:='{}'::jsonb;
  supervisao jsonb := '{"estado":"CODEX_PAUSADO_CHATGPT_A_CONFIGURAR","destino_escolhido":"CHATGPT_WEB","executor_ativo":null,"janelas_ativas":0,"janelas_propostas_por_dia":1,"horario_proposto":"18:00 America/Sao_Paulo","preferencia_fundador":"Conversar com Helena no ChatGPT normal, trocar de chat e manter revisão independente do Codex, sem API separada.","agenda_anterior":{"executor":"CODEX_LOCAL","estado":"PAUSED","external_id":"helena-checkpoint-di-rio-de-supervis-o","automation_id":"AUTO-0006","integration_id":"INT-0011","recurrence_id":"REC-0001"},"automation_id":"AUTO-0006","integration_id":"INT-0011","recurrence_id":"REC-0001","agenda_chatgpt":{"estado":"NAO_CONFIGURADA","external_id":null,"acesso_supabase":"NAO_VERIFICADO_NA_CONTA","motivo":"Navegador disponível sem login no ChatGPT."},"fluxo":["Tarefa agendada no ChatGPT carrega checkpoint ativo e mudanças relevantes no Supabase.","Uma revisão compacta do lote, sem IA por tarefa.","Parecer idempotente em auditoria para a aba Supervisão.","Resultado no ChatGPT; outro chat autorizado recupera o parecer do Supabase."],"custo":"Sem API separada. Execuções e checagens usam limites do plano ChatGPT; nenhum consumo zero prometido.","portabilidade":"A memória canônica fica no Supabase; cada chat precisa de acesso autorizado. A tarefa não envia automaticamente para qualquer novo chat.","regra":"Sem mudança relevante, não repetir parecer nem alerta. Sem nova agenda local, e-mail ou WhatsApp neste escopo.","proxima_acao":"Entrar no ChatGPT, verificar tarefas e conexão Supabase, testar leitura/gravação, configurar a tarefa e homologar a primeira execução.","memoria_id":"MEM-SUPERVISAO-CHAT-20260926","tarefa_implantacao":"TSK-0031","instrucoes":"Helena — revisão diária no ChatGPT web\n\nCONFIGURAÇÃO INICIAL — executar uma única vez\nQuero uma tarefa agendada no ChatGPT web, independente do Codex e do meu computador, uma vez por dia às 18h no fuso America/Sao_Paulo, sem API paga separada. Antes de agendar, confirme que esta conta oferece tarefas agendadas com acesso ao Supabase e faça um teste de leitura no projeto ecosistemadossonhos, ref wxkgrykduqtsgmjkzlou. Leia public.checkpoint_mestre_atual e public.memoria_mestre, registro MEM-SUPERVISAO-CHAT-20260926. Confirme também se a ferramenta permite gravar pareceres em public.auditoria na execução agendada. Não peça chaves para colar no chat. Se faltar conexão ou recurso, explique exatamente o que falta; não crie um simples lembrete como se fosse uma revisão. Evite duplicatas: confira se já existe esta revisão antes de criar outra. Ao configurar, salve no Supabase o identificador real da nova agenda, seu executor, horário e estado; preserve o registro da agenda Codex pausada. Não marque como homologada antes da primeira execução automática comprovada.\n\nINSTRUÇÕES DA EXECUÇÃO RECORRENTE\nVocê atua como Helena, AGT-01, CEO Virtual. O fundador é a autoridade superior. A fonte canônica é o Supabase autorizado, nunca a memória isolada desta conversa. Comece por checkpoint_mestre_atual; carregue identidade, regras vigentes, foco executivo e a configuração atual de supervisão. A instrução mais recente do fundador prevalece. Não abra outra frente executiva.\n\nCompare o último parecer CHECKPOINT_SUPERVISAO_LOTE em auditoria com mudanças posteriores em task_activity, decisoes e agent_job_events. Confira riscos críticos abertos e pendências do fundador. Leia somente os detalhes necessários em tarefas, agent_jobs e fontes relacionadas. Mantenha os dados separados por business_id. Os 27 jobs legados sem task_id não provam trabalho novo nem vendas.\n\nFaça no máximo uma análise compacta por janela, priorizando cinco ou mais mudanças de tarefas, decisão estratégica, novo bloqueio, falha, WAITING_HELENA, risco crítico novo ou agravado, ou decisão pendente do fundador. Não repita alertas inalterados. Sem mudança relevante, encerre sem novo parecer e sem mensagem.\n\nPara lote relevante, registre uma única linha em auditoria, com acao CHECKPOINT_SUPERVISAO_LOTE e audit_id HCP-WEB-AAAAMMDD-18H, usando a data local e conferindo antes se já existe. Em valor_novo (JSON como texto), inclua resumo, acoes, decisoes_pendentes, fontes com IDs, janela, período coberto e executor real. Confirme a gravação antes de dizer que o painel foi atualizado. Se a gravação falhar, informe a falha. Não altere tarefas, decisões, acessos, jobs ou o Checkpoint Mestre nesta revisão.\n\nPublique um resumo curto no resultado desta tarefa do ChatGPT quando houver mudança relevante ou falha. Não prometa inserir mensagens no chat que o fundador estiver usando. Não envie e-mail nem WhatsApp. Não copie segredos ou dados pessoais desnecessários. Não chame uma API separada.\n\nRETOMADA EM OUTRO CHAT\n“Helena, carregue o checkpoint_mestre_atual do Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou), a memória MEM-SUPERVISAO-CHAT-20260926 e o último parecer CHECKPOINT_SUPERVISAO_LOTE. Confirme seu papel, o foco atual, pendências, decisões e o estado real da agenda antes de continuar.”\nSe o novo chat não tiver acesso autorizado ao Supabase, informe SUPABASE NÃO CONECTADO. Não presuma que a autenticação migrou com a conversa.\n","referencia_oficial":"https://learn.chatgpt.com/docs/automations"}'::jsonb;
  counted_table record; total bigint;
begin
  select * into strict anterior from public.checkpoint_mestre_atual;
  if anterior.snapshot->>'marcador_supervisao_portatil'='helena_chatgpt_web_20260926' then return; end if;
  if not exists(select 1 from public.automacoes where automation_id='AUTO-0006' and external_automation_id='helena-checkpoint-di-rio-de-supervis-o') then
    raise exception 'Executor anterior não corresponde à agenda pausada';
  end if;
  select jsonb_build_object(
    'automacao',(select to_jsonb(a) from public.automacoes a where automation_id='AUTO-0006'),
    'integracao',(select to_jsonb(i) from public.integracoes i where integration_id='INT-0011'),
    'recorrencia',(select to_jsonb(r) from public.recorrencias r where recurrence_id='REC-0001'),
    'tarefa',(select to_jsonb(t) from public.tarefas t where task_id='TSK-0031'),
    'supervisao',anterior.snapshot->'supervisao_em_lote'
  ) into antes;

  update public.automacoes set status='PAUSADA',proxima_execucao=null,
    observacoes='Agenda local pausada via Codex automation_update em 26/09/2026 por solicitação do fundador. Substituição escolhida: ChatGPT web, sem API separada. Nova agenda ainda não configurada. Executor e horário antigos preservados como histórico.',
    atualizado_em=now()
  where automation_id='AUTO-0006';
  update public.integracoes set status='PAUSADA',
    observacoes='Integração da agenda Codex pausada. O fundador escolheu ChatGPT web com Supabase, sem API separada. A conexão e a agenda do ChatGPT ainda precisam ser verificadas e configuradas; este registro identifica somente o executor anterior.',
    atualizado_em=now()
  where integration_id='INT-0011';
  update public.recorrencias set status='PAUSADA',sync_status='PAUSADA',
    gerar_automaticamente='NÃO',proxima_ocorrencia=null,
    observacoes='Agenda Codex pausada em 26/09/2026. ChatGPT web escolhido; nova tarefa ainda não configurada. Horário anterior de 18h preservado como proposta, não como próxima execução. Não materializar agenda via AUTO-0004.',
    regra_canonica='Uma revisão por lote ao dia. Executor Codex pausado; substituição por ChatGPT web depende de configuração e teste. Não duplicar a agenda nem gerar ocorrências automaticamente.',
    atualizado_em=now()
  where recurrence_id='REC-0001';
  update public.governanca set
    dia_hora='Proposta: 18h America/Sao_Paulo; agenda Codex pausada, ChatGPT ainda não configurado',
    proxima_realizacao=null,
    observacoes='Ritual de gestão mantido. Execução agendada anterior pausada. Fundador escolheu ChatGPT web, sem API separada. TSK-0031 acompanha acesso, configuração e primeira rodada automática. Parecer assistido histórico não comprova agendamento.',
    atualizado_em=now()
  where governance_id='GOV-0001';
  update public.tarefas set
    tarefa='Implantar revisão diária da Helena no ChatGPT com memória no Supabase',
    evidencia='26/09/2026: fundador escolheu ChatGPT web, independente do Codex, sem API separada. Agenda Codex pausada via automation_update; AUTO-0006/INT-0011/REC-0001 atualizados. Instruções persistidas em MEM-SUPERVISAO-CHAT-20260926. Navegador disponível sem login; acesso ao Supabase e agendamento na conta ainda não verificados. AUD-HCP-20260926-BASE continua sendo revisão assistida histórica.',
    definicao_de_pronto='Uma revisão diária no ChatGPT web funcionando sem Codex local, com instruções persistentes e Supabase autorizado; leitura por lote; no máximo um parecer idempotente por janela; resultado no ChatGPT; recuperação em outro chat autorizado; identificador real da agenda registrado; primeira execução automática comprovada no banco e painel. Sem API separada, WhatsApp ou duplicação de agenda.',
    bloqueio='Para ativar: entrar no ChatGPT e confirmar tarefas agendadas com leitura e gravação no Supabase.',
    atualizado_em=now()
  where task_id='TSK-0031';

  update public.estado_mestre set
    estado_atual='Agenda Codex PAUSADA. Fundador escolheu revisão no ChatGPT web, sem API separada, independente desta conversa e com memória no Supabase. Nova agenda NÃO CONFIGURADA.',
    proxima_acao=supervisao->>'proxima_acao',
    confirmacao='PAUSA CODEX CONFIRMADA; CHATGPT ESCOLHIDO; ACESSO E AGENDA WEB A VALIDAR',
    fonte='Solicitação e escolha explícitas do fundador em 26/09/2026; automation_update PAUSED; MEM-SUPERVISAO-CHAT-20260926',
    atualizado_em=now()
  where registro_id=20 and related_id='AUTO-0006';
  if not found then raise exception 'Estado Mestre de supervisão não encontrado'; end if;
  update public.estado_mestre set
    estado_atual=(select string_agg(integration_id||' — '||sistema||': '||coalesce(status,'NÃO INFORMADO'),'; ' order by integration_id) from public.integracoes),
    atualizado_em=now()
  where registro_id=10;

  update public.memoria_mestre set
    registro=jsonb_set(registro::jsonb,'{supervisao}',supervisao)::text,
    atualizado_em=now()
  where id='MEM-PLANO-20260926';
  insert into public.memoria_mestre
    (id,data_hora,session_id,tipo,business_id_area,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade,scope_type)
  values
    ('MEM-SUPERVISAO-CHAT-20260926',now()::text,'HELENA-SUPERVISAO-CHAT-20260926','DIRETRIZ','GRUPO',
     'Codex — registro de escolha explícita do fundador','Helena no ChatGPT web: agenda independente e memória canônica',
     supervisao::text,'Escolha do fundador: No ChatGPT pela web, com acesso ao Supabase, sem API separada. Agenda Codex pausada confirmada por automation_update.',
     'ATIVA','ESCOLHA CONFIRMADA; ATIVAÇÃO WEB PENDENTE','TAREFA','TSK-0031',supervisao->>'proxima_acao','AGT-01 Helena','INTERNO','GLOBAL');

  insert into public.auditoria
    (audit_id,data_hora,session_id,agente_usuario,acao,sheet,object_id,campo,valor_anterior,valor_novo,motivo,fonte_evidencia,sensibilidade)
  values
    ('AUD-HELENA-SUPERVISAO-CHAT-20260926',now()::text,'HELENA-SUPERVISAO-CHAT-20260926',
     'Codex — ajuste solicitado pelo fundador','RECONFIGURACAO_SUPERVISAO','automacoes','AUTO-0006','executor_e_estado',
     antes::text,supervisao::text,
     'Fundador usará ChatGPT normal e trocará de conversa; agenda local não atende. Escolhido ChatGPT web sem API separada.',
     'automation_update: status PAUSED; escolha explícita do fundador; navegador ChatGPT sem login. Não é uma execução agendada.','INTERNO');

  snap:=anterior.snapshot||jsonb_build_object(
    'gerado_em',now(),'marcador_supervisao_portatil','helena_chatgpt_web_20260926',
    'supervisao_em_lote',supervisao,'pendencias','["Publicar e homologar o Gateway e a interface locais; teste local não comprova produção.","Confirmar identidade de cada bot e autorização de todas as ferramentas antes da operação comercial multiempresa.","Vincular novas execuções à tarefa correta; reconciliar jobs legados somente com evidência.","Resolver canal → empresa antes de ampliar para operações simultâneas; não criar empresas fictícias para GRUPO/Sistema.","TSK-0031: configurar revisão no ChatGPT web após login e teste de acesso ao Supabase; comprovar a primeira execução. Codex pausado; sem API separada ou WhatsApp.","Manter risco RSK-0007 e bloqueios reais até ação comprovada; DEC-019 adiou a rotação.","Histórico detalhado de voz, cadeia de aceite das decisões e recuperação de eventos antigos continuam incompletos.","Sincronizadores externos de calendário precisam de validação de falhas e remoção de datas."]'::jsonb,
    'lacunas_operacionais',(anterior.snapshot->'lacunas_operacionais')||jsonb_build_object('revisao_automatica_helena','CODEX_PAUSADO_CHATGPT_ESCOLHIDO_A_CONFIGURAR')
  );
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,agente,cargo_funcao,missao,quando_ativar,ler_antes_de_responder,pode_atualizar,saida_obrigatoria,escalar_para,prompt_base,status,versao_prompt,estado_execucao,atualizado_em from public.agentes) x;
  snap := jsonb_set(snap,array['agentes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.task_id),'[]'::jsonb) into atual from (select task_id,tarefa,business_id,project_id,responsavel,status,prioridade,prazo,definicao_de_pronto,bloqueio,atualizado_em from public.tarefas) x;
  snap := jsonb_set(snap,array['tarefas'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.project_id),'[]'::jsonb) into atual from (select project_id,projeto,business_id,objetivo,status,responsavel,criterio_de_conclusao from public.projetos) x;
  snap := jsonb_set(snap,array['projetos'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_id),'[]'::jsonb) into atual from (select business_id,negocio,ativo,estagio,objetivo_atual,principal_gargalo,kpi_principal,responsavel_executivo,proxima_entrega,riscos,atualizado_em from public.portfolio) x;
  snap := jsonb_set(snap,array['portfolio'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.decision_id),'[]'::jsonb) into atual from (select decision_id,business_id,tipo,decisao,motivo,decisor,status,substitui_decision_id,atualizado_em from public.decisoes) x;
  snap := jsonb_set(snap,array['decisoes_vigentes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.registro_id),'[]'::jsonb) into atual from (select registro_id,area,item,estado_atual,proxima_acao,fonte,confirmacao,responsavel,related_id,atualizado_em from public.estado_mestre) x;
  snap := jsonb_set(snap,array['estado_mestre'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,tipo,business_id_area,agente_origem,assunto,status,related_object_id,proxima_acao,atualizado_em from public.memoria_mestre) x;
  snap := jsonb_set(snap,array['memorias_recentes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,de,para,business_id_area,assunto,status,prioridade,prazo,atualizado_em from public.handoffs) x;
  snap := jsonb_set(snap,array['handoffs'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,frente,status,responsavel,criterio_de_saida,atualizado_em from public.foco_executivo) x;
  snap := jsonb_set(snap,array['foco_executivo'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,provider,connection_status,last_seen_at,last_tested_at,updated_at from public.agent_connections) x;
  snap := jsonb_set(snap,array['conexoes_agentes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.job_id),'[]'::jsonb) into atual from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs) x;
  snap := jsonb_set(snap,array['agent_jobs'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events) x;
  snap := jsonb_set(snap,array['agent_job_events'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.integration_id),'[]'::jsonb) into atual from (select integration_id,sistema,objeto,direcao,business_id,dono,status,ultima_sync,source_system,frequencia,observacoes,atualizado_em from public.integracoes) x;
  snap := jsonb_set(snap,array['integracoes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.automation_id),'[]'::jsonb) into atual from (select automation_id,nome,business_id,status,responsavel,gatilho,condicao,acao,frequencia,external_automation_id,integration_id,ultima_execucao,proxima_execucao,observacoes,atualizado_em from public.automacoes) x;
  snap := jsonb_set(snap,array['automacoes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.recurrence_id),'[]'::jsonb) into atual from (select recurrence_id,nome,business_id,status,responsavel,frequencia,regra_rrule,timezone,automation_id,integration_id,external_id,gerar_automaticamente,horario_confirmado,proxima_ocorrencia,observacoes,atualizado_em from public.recorrencias) x;
  snap := jsonb_set(snap,array['recorrencias'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_id),'[]'::jsonb) into atual from (select risk_id,business_id,project_id,categoria,risco,probabilidade,impacto,status,responsavel,prevencao_mitigacao,atualizado_em from public.riscos) x;
  snap := jsonb_set(snap,array['riscos'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.milestone_id),'[]'::jsonb) into atual from (select milestone_id,project_id,business_id,status,responsavel from public.marcos) x;
  snap := jsonb_set(snap,array['marcos'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,actor_role,occurred_at from public.task_activity) x;
  snap := jsonb_set(snap,array['task_activity'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo_id),'[]'::jsonb) into atual from (select protocolo_id,versao,secao,regra,aplicacao,responsavel,status,atualizado_em from public.protocolo_agentes) x;
  snap := jsonb_set(snap,array['protocolo_agentes'],atual);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.governance_id),'[]'::jsonb) into atual from (select governance_id,ritual,escopo,cadencia,dono,pauta_fixa,entrega_esperada,dia_hora,recurrence_id,status,observacoes,atualizado_em from public.governanca) x;
  snap := jsonb_set(snap,array['governanca'],atual);
  for counted_table in select jsonb_object_keys(anterior.snapshot->'contagens') as tabela loop
    execute format('select count(*) from public.%I',counted_table.tabela) into total;
    contagens:=contagens||jsonb_build_object(counted_table.tabela,total);
  end loop;
  snap:=jsonb_set(snap,'{contagens}',contagens);
  perform public.registrar_checkpoint_mestre(
    p_titulo=>'Checkpoint Mestre — revisão no ChatGPT escolhida; Codex pausado',
    p_resumo_executivo=>'Memória e planejamento continuam no Supabase. Fundador escolheu revisão diária no ChatGPT web sem API separada. Agenda Codex pausada; nova tarefa aguarda acesso e configuração na conta, sem execução automática comprovada.',
    p_conteudo_markdown=>'# Continuidade do Sistema Helena

Helena é AGT-01, CEO Virtual / Central de Comando. O fundador é a autoridade superior.
A missão e as regras integrais estão em snapshot.identidade_helena, agentes e protocolo_agentes.

## Retomada
Conectar ao Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) com acesso autorizado.
Ler checkpoint_mestre_atual, validar versão e cadeia e conferir fontes voláteis.
Usar fontes_de_retomada para recuperar história, decisões, pendências e planos completos.
O comando de carregamento é somente leitura. O comando de sincronização cria versão apenas por mudança material.
Não presumir que uma nova conversa herda autenticação ou a agenda local do Codex.

## Reconciliação
Corrigidos vínculo do foco antigo, instruções antigas de V1/V2, resumo de integrações e conexão da revisão diária ao executor existente.
Plano de evolução e mapeamento multiempresa registrados em MEM-PLANO-20260926.
Restrições de escrita global, portfólio por empresa e grants estruturais aplicadas no banco.
Contagens e projeções foram reconstruídas na mesma transação; versões antigas preservadas.

## Supervisão e custo
O fundador escolheu ChatGPT web, sem API separada, com memória canônica no Supabase.
A agenda local do Codex foi PAUSADA; AUTO-0006 / INT-0011 / REC-0001 preservam o executor anterior.
A revisão no ChatGPT ainda NÃO FOI CONFIGURADA: navegador disponível sem login e acesso ao Supabase nessa conta não verificado.
Cadência proposta: uma janela diária às 18h de São Paulo. Nenhuma próxima execução está confirmada.
Testar acesso e gravação, configurar a tarefa no ChatGPT e homologar a primeira execução: TSK-0031 continua aberta.
Instruções completas em MEM-SUPERVISAO-CHAT-20260926; o novo chat deve carregar esta memória e o checkpoint ativo.
Resultado na tarefa do ChatGPT; outro chat autorizado recupera o parecer do Supabase. Não há envio automático a qualquer conversa nova.
Sem IA por tarefa ou atualização da página, API separada, Gmail ou WhatsApp. As checagens usam o plano ChatGPT; silêncio não significa custo zero.

## Limites
27 jobs legados sem tarefa não são falhas de referência inexistente nem prova de venda.
Não atribuir autoria, tarefa ou empresa sem evidência. GRUPO/Sistema são escopos internos.
Produção externa, identidade dos bots, histórico de voz e aceite de decisões ainda precisam de homologação.
RSK-0007 não foi encerrado; a rotação segue adiada conforme DEC-019.
Mudanças do código são locais e não foram publicadas nesta reconciliação.


## Correção da auditoria com sessão do fundador
A RLS de app_access antes retornava somente a própria linha até para o fundador. Agora o fundador lê os três cadastros; o membro continua vendo somente seu próprio acesso. A auditoria da página e a leitura administrativa passam a comparar o mesmo inventário. Nenhuma permissão de escrita foi acrescentada.
',p_snapshot=>snap,
    p_mudancas_desde_anterior=>jsonb_build_array(
      'Agenda Codex realmente pausada e metadados reconciliados.',
      'Escolha ChatGPT web registrada em Memória Mestre; instruções completas disponíveis sem pasta local.',
      'Tarefa de implantação e Estado Mestre atualizados; nenhuma agenda web declarada ativa.',
      'Projeções e contagens atualizadas atomicamente, preservando versões anteriores.'
    ),
    p_fontes=>anterior.fontes||jsonb_build_array('docs/helena/prompt-revisao-chatgpt.txt','scripts/sincronizar-supervisao-chatgpt.sql','MEM-SUPERVISAO-CHAT-20260926'),
    p_criado_por=>'Codex — ajuste solicitado pelo fundador',
    p_motivo=>'Substituir dependência do Codex por revisão no ChatGPT, preservando histórico e sinalizando a configuração ainda pendente.'
  );
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id from public.checkpoint_mestre_atual;
commit;
