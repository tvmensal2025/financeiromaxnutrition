-- Complementa a V9 sem sobrescrever histórico após corrigir a leitura de app_access.
begin isolation level repeatable read;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
  anterior public.checkpoint_mestre%rowtype;
  snap jsonb; contagens jsonb := '{}'::jsonb; item record; total bigint;
begin
  select * into strict anterior from public.checkpoint_mestre_atual;
  if anterior.snapshot->>'marcador_visibilidade'='helena_founder_inventory_20260926' then return; end if;
  if anterior.snapshot->>'marcador_continuidade' is distinct from 'helena_reconciliacao_20260926' then
    raise exception 'Executar a reconciliação de continuidade primeiro';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='app_access' and policyname='app_access_founder_read') then
    raise exception 'Política de inventário do fundador ausente';
  end if;
  for item in select jsonb_object_keys(anterior.snapshot->'contagens') as tabela loop
    execute format('select count(*) from public.%I',item.tabela) into total;
    contagens:=contagens||jsonb_build_object(item.tabela,total);
  end loop;
  snap:=anterior.snapshot||jsonb_build_object('gerado_em',now(),'contagens',contagens,
    'marcador_visibilidade','helena_founder_inventory_20260926',
    'seguranca',anterior.snapshot->'seguranca'||jsonb_build_object(
      'app_access','Fundador lê inventário completo; membro lê somente seu próprio registro. Sem permissão nova de escrita.',
      'auditoria_com_sessao_founder','Zero divergências de contagem e sete verificações de vínculo sem falhas.'
    ),
    'validacao_local',jsonb_build_object(
      'data','2026-09-26','frontend_testes',108,'gateway_unitarios',45,
      'gateway_servidor',11,'gateway_seguranca',29,'build','PASSOU',
      'observacao','Sem chamadas pagas ou mensagens reais nos testes; produção externa não homologada.'
    ));
  perform public.registrar_checkpoint_mestre(
    p_titulo=>'Checkpoint Mestre — continuidade e leitura do fundador reconciliadas',
    p_resumo_executivo=>'Identidade, planejamento, agenda, fontes e permissões reconciliados. Auditoria com sessão do fundador sem divergências nas contagens; membro mantém isolamento. Pendências operacionais preservadas.',
    p_conteudo_markdown=>anterior.conteudo_markdown||E'\n\n## Correção da auditoria com sessão do fundador\nA RLS de app_access antes retornava somente a própria linha até para o fundador. Agora o fundador lê os três cadastros; o membro continua vendo somente seu próprio acesso. A auditoria da página e a leitura administrativa passam a comparar o mesmo inventário. Nenhuma permissão de escrita foi acrescentada.\n',
    p_snapshot=>snap,
    p_mudancas_desde_anterior=>jsonb_build_array(
      'Corrigida divergência aparente 1/3 de app_access: RLS permitia ao fundador somente leitura própria.',
      'Testes com founder e member comprovam inventário completo para o fundador e isolamento do membro.',
      'Validação local e limitações de implantação registradas; versões anteriores preservadas.'
    ),
    p_fontes=>anterior.fontes||jsonb_build_array('supabase/migrations/20260926223402_allow_founder_access_inventory_read.sql','scripts/validar-checkpoint-continuidade.sql'),
    p_criado_por=>'Codex — reconciliação autorizada pelo fundador',
    p_motivo=>'Concluir a validação pela mesma permissão usada pela auditoria da página, sem divergência falsa de contagem.'
  );
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id from public.checkpoint_mestre_atual;
commit;
