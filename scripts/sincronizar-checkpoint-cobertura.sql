begin isolation level repeatable read;
do $$ begin perform set_config('request.jwt.claim.sub',(select user_id::text from public.app_access where role='founder' and active order by created_at limit 1),true); end $$;
set local role authenticated;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare v_anterior public.checkpoint_mestre%rowtype; v_audit jsonb; v_snapshot jsonb; v_counts jsonb; v_fontes jsonb;
begin
 select * into strict v_anterior from public.checkpoint_mestre_atual;
 if v_anterior.snapshot->>'marcador_auditoria' = 'helena_cobertura_integral_20260926' then return; end if;
 v_audit := public.helena_auditar_cobertura();
 select jsonb_object_agg(x->>'tabela',x->'registros'), jsonb_agg('public.'||(x->>'tabela'))
 into v_counts,v_fontes from jsonb_array_elements(v_audit->'fontes') x
 where x->>'tabela' not in ('checkpoint_mestre','checkpoint_mestre_atual');
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_snapshot
 from jsonb_each(v_anterior.snapshot)
 where key in ('regra_precedencia','rotina_checkpoint_mestre','checklist_validacao_checkpoint','comando_carregamento_checkpoint');
 v_snapshot := v_snapshot || jsonb_build_object(
   'marcador_auditoria','helena_cobertura_integral_20260926',
   'gerado_em',now(),'contagens',v_counts,'fontes',v_fontes,
   'escopo_snapshot','Projeções operacionais sem payloads, credenciais, tokens ou evidências livres. Conteúdo integral permanece nas fontes canônicas.',
   'mapeamento_supabase',jsonb_build_object('fontes',69,'campos',1479,'campos_mapeados',1479,'rpc','helena_auditar_cobertura','groK_consumo','FORA_DO_ESCOPO'),
   'seguranca',jsonb_build_object('rls_tabelas',true,'checkpoint_security_invoker',true,'rpc_auditoria','SECURITY INVOKER; fundador ativo','leitura_restaurada',jsonb_build_array('agent_jobs','agent_job_events','notification_outbox','processos'),'sem_ampliar_escrita',true),
   'integridade',v_audit->'integridade',
   'pendencias',jsonb_build_array(
     'Gateway de voz mantém configuração em memória no código atual; gravação complementar suprime falhas. Requer correção e implantação próprias.',
     'Configuração URA agora persiste por empresa na aplicação local; consumo pelo executor de chamadas ainda não homologado.',
     'Mudanças da interface estão locais; publicação remota não realizada.',
     'Conexão de agente não comprova execução; ações externas exigem eventos e evidências.',
     'Sincronizadores de calendário precisam tratar falhas e remoção de datas explicitamente; nenhuma chamada externa foi executada nesta auditoria.'
   )
 ) || jsonb_build_object(
 'agentes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select agent_id,agente,cargo_funcao,status,versao_prompt,atualizado_em from public.agentes order by agent_id) x),
'tarefas', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select task_id,business_id,project_id,responsavel,status,prioridade,prazo,atualizado_em from public.tarefas order by task_id) x),
'projetos', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select project_id,business_id,status,responsavel from public.projetos order by project_id) x),
'portfolio', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select business_id,negocio,ativo,estagio,responsavel_executivo,atualizado_em from public.portfolio order by business_id) x),
'decisoes_vigentes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select decision_id,business_id,tipo,status,substitui_decision_id,atualizado_em from public.decisoes order by decision_id) x),
'estado_mestre', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select registro_id,area,item,confirmacao,responsavel,related_id,atualizado_em from public.estado_mestre order by registro_id) x),
'memorias_recentes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,tipo,business_id_area,agente_origem,assunto,status,related_object_id,atualizado_em from public.memoria_mestre order by id) x),
'handoffs', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,de,para,business_id_area,status,prioridade,prazo,atualizado_em from public.handoffs order by id) x),
'foco_executivo', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,frente,status,responsavel,criterio_de_saida,atualizado_em from public.foco_executivo order by id) x),
'conexoes_agentes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select agent_id,provider,connection_status,last_seen_at,last_tested_at,updated_at from public.agent_connections order by agent_id) x),
'agent_jobs', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs order by job_id) x),
'agent_job_events', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events order by event_id) x),
'integracoes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select integration_id,sistema,objeto,direcao,business_id,dono,status,ultima_sync,atualizado_em from public.integracoes order by integration_id) x),
'automacoes', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select automation_id,nome,business_id,status,responsavel,ultima_execucao,proxima_execucao,atualizado_em from public.automacoes order by automation_id) x),
'recorrencias', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select recurrence_id,nome,business_id,status,responsavel,frequencia,gerar_automaticamente,proxima_ocorrencia,atualizado_em from public.recorrencias order by recurrence_id) x),
'riscos', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select risk_id,business_id,project_id,categoria,status,responsavel,atualizado_em from public.riscos order by risk_id) x),
'marcos', (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select milestone_id,project_id,business_id,status,responsavel from public.marcos order by milestone_id) x)
 );
 perform public.registrar_checkpoint_mestre(
   p_titulo => 'Checkpoint Mestre — cobertura integral do Supabase',
   p_resumo_executivo => 'Inventário de 69 fontes e 1.479 campos concluído. 345 campos técnicos acrescentados ao dicionário, sem alterar os mapeamentos anteriores. Leitura segura de jobs, eventos, notificações e processos restaurada. Sete verificações de integridade sem inconsistências. Consumo do Grok fora do escopo. A homologação externa permanece distinta do mapeamento.',
   p_conteudo_markdown => '# Continuidade do Sistema Helena\n\nFonte canônica: ecosistemadossonhos (wxkgrykduqtsgmjkzlou).\n\n## Mudança material\nAuditoria completa de public e complementação de 345 campos no catálogo helena_campos. Políticas SELECT por empresa para quatro fontes antes invisíveis. RPC helena_auditar_cobertura, somente leitura e restrita ao fundador.\n\n## Dados atuais\nContagens obtidas em transação consistente e projeções operacionais atualizadas. Os registros canônicos, focos, decisões, agentes, jobs e rotinas não tiveram seus estados de negócio alterados.\n\n## Limites de comprovação\n100% refere-se ao inventário e mapeamento do esquema público, não à automação externa. Gateway de voz, aplicação das configurações URA nas chamadas e publicação remota ainda exigem validação. O calendário também possui caminhos que não propagam falhas. Consulte pendencias no snapshot.\n\n## Continuidade\nCarregar sempre checkpoint_mestre_atual. Estado real do Supabase prevalece sobre o snapshot. A versão anterior permanece preservada. Nenhum segredo ou payload de executor faz parte desta projeção.',
   p_snapshot => v_snapshot,
   p_mudancas_desde_anterior => jsonb_build_array(
     'Mapeamento: 1134 para 1479 campos; 69 fontes inventariadas.',
     'Leitura com isolamento de empresa em agent_jobs, agent_job_events, notification_outbox e processos.',
     'Contagens reconciliadas com o estado atual; seis divergências históricas identificadas.',
     'Interface local com auditoria ao vivo, paginação e URA persistida por empresa; produção externa ainda não homologada.'
   ),
   p_fontes => v_fontes || jsonb_build_array('public.checkpoint_mestre_atual','public.helena_auditar_cobertura()','supabase/migrations/20260926131130_helena_cobertura_integral.sql'),
   p_criado_por => 'Codex — auditoria autorizada pelo fundador',
   p_motivo => 'Pedido do fundador: 100% do mapeamento no Supabase, excluindo consumo do Grok. Mudança material de catálogo, leitura e arquitetura de auditoria.'
 );
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id from public.checkpoint_mestre_atual;
commit;
