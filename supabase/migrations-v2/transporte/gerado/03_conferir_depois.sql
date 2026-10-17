-- Só leituras. Cada linha deve dizer ok = true. Se alguma disser false, PARE e não siga com a v2.
select 'tabela de regras confere' as conferencia, helena_v2.tabela_confere() as ok;
select 'base técnica registrada' as conferencia,
       exists (select 1 from helena_v2.configuracao_ponteiro where tecnica_id is not null) as ok;
select 'nenhuma revisão ativa ainda (o fundador ativa depois, pela tela)' as conferencia,
       not exists (select 1 from helena_v2.configuracao_ponteiro where ativa_id is not null) as ok;
select 'anon não executa nada de manutenção' as conferencia, not (
  has_function_privilege('anon', 'helena_v2.vigia()', 'execute')
  or has_function_privilege('anon', 'helena_v2.conferir_card(uuid)', 'execute')) as ok;
select 'authenticated não executa as portas de manutenção' as conferencia, not (
  has_function_privilege('authenticated', 'helena_v2.vigia()', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.conferir_card(uuid)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.calcular_hash_das_linhas()', 'execute')) as ok;
select 'service_role executa o vigia' as conferencia,
       has_function_privilege('service_role', 'helena_v2.vigia()', 'execute') as ok;
select 'nenhum card existe ainda' as conferencia, not exists (select 1 from helena_v2.card) as ok;
select 'relógio: eventos_devidos só para o service_role' as conferencia, not (
  has_function_privilege('anon', 'helena_v2.eventos_devidos(timestamptz)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.eventos_devidos(timestamptz)', 'execute'))
  and has_function_privilege('service_role', 'helena_v2.eventos_devidos(timestamptz)', 'execute') as ok;
select 'publicação: só o service_role reivindica, conclui, falha e reverte pedidos' as conferencia, not (
  has_function_privilege('anon', 'helena_v2.reivindicar_publicacao()', 'execute')
  or has_function_privilege('anon', 'helena_v2.concluir_publicacao(bigint,text,text)', 'execute')
  or has_function_privilege('anon', 'helena_v2.falhar_publicacao(bigint,text)', 'execute')
  or has_function_privilege('anon', 'helena_v2.reverter_publicacao(bigint)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.reivindicar_publicacao()', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.concluir_publicacao(bigint,text,text)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.falhar_publicacao(bigint,text)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.reverter_publicacao(bigint)', 'execute'))
  and has_function_privilege('service_role', 'helena_v2.reivindicar_publicacao()', 'execute') as ok;
select 'publicação: anon não lê pedidos nem a situação' as conferencia, not (
  has_table_privilege('anon', 'helena_v2.publicacoes', 'select')
  or has_function_privilege('anon', 'helena_v2.situacao_publicacao()', 'execute')) as ok;
select 'ativações: anon não ativa, não lista e não reverte configuração' as conferencia, not (
  has_function_privilege('anon', 'helena_v2.ativar_configuracao(uuid,uuid)', 'execute')
  or has_function_privilege('anon', 'helena_v2.listar_ativacoes(integer)', 'execute')
  or has_function_privilege('anon', 'helena_v2.reverter_configuracao(uuid)', 'execute')) as ok;
select 'nenhum pedido de publicação existe ainda' as conferencia, not exists (select 1 from helena_v2.publicacoes) as ok;
