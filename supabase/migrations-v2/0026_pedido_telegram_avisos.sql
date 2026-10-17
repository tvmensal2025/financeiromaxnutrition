-- Avisos da triagem v2. A saída usa exclusivamente o inbox PEDIDO que originou
-- este request_id e o mesmo vínculo privado, ainda ativo no instante do envio.
-- Nenhum aviso confirma proposta, executa card ou autoriza publicação.

-- Cada chave representa um fato imutável e é única mesmo se houver outro
-- update PEDIDO do mesmo protocolo antes de um retry do gatilho.
create unique index telegram_aviso_fato_unico on helena_v2.telegram_saida(chave_evento)
  where tipo='AVISO';

create function helena_v2._telegram_avisar_pedido(
  p_pedido_id uuid, p_chave text, p_texto text
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare v_update_id bigint;
begin
  if p_pedido_id is null or p_chave is null or char_length(p_chave) not between 1 and 160
     or p_texto is null or char_length(p_texto) not between 1 and 4096 then
    raise exception 'AVISO_PEDIDO_INVALIDO' using errcode='22023';
  end if;
  select i.update_id into v_update_id
    from helena_v2.pedido_entrada p
    join helena_v2.telegram_inbox i on i.request_id=p.request_id
      and i.fundador_uid=p.fundador_uid and i.tipo='PEDIDO'
    join helena_v2.telegram_vinculo v on v.id=i.vinculo_id
      and v.fundador_uid=i.fundador_uid and v.chat_id=i.chat_id
      and v.usuario_id=i.usuario_id and v.revogado_em is null
    join public.app_access a on a.user_id=p.fundador_uid
      and a.role='founder' and a.active
    where p.id=p_pedido_id
      and (select e.origem from helena_v2.pedido_entrada_evento e
           where e.pedido_id=p.id order by e.id limit 1)='TELEGRAM'
    order by i.recebido_em desc,i.update_id desc limit 1;
  if v_update_id is null then return; end if;
  insert into helena_v2.telegram_saida(update_id,tipo,chave_evento,texto)
    values (v_update_id,'AVISO',p_chave,p_texto)
    on conflict do nothing;
end;
$f$;

create function helena_v2._telegram_avisar_proposta() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $f$
declare v_request_id uuid; v_texto text; v_servicos text;
begin
  select p.request_id into v_request_id from helena_v2.pedido_entrada p
    where p.id=new.pedido_id and p.fundador_uid=new.fundador_uid;
  if v_request_id is null then return new; end if;
  if new.tipo='PERGUNTAR' then
    v_texto := 'Helena precisa de esclarecimento para o pedido ' || v_request_id::text ||
      '. Resumo: ' || left(new.resumo,1000) || '. Perguntas: ' || left(new.perguntas::text,1200) ||
      '. Responda pelo site autenticado: https://financeiro.oficialmaxnutrition.com.br/ (use o protocolo ' ||
      v_request_id::text || '). O pedido continua em triagem; nenhum trabalho foi executado.';
  else
    select string_agg(distinct etapas.item->>'servico', ', ') into v_servicos
      from jsonb_array_elements(new.plano->'etapas') as etapas(item);
    v_texto := 'Helena preparou uma proposta para o pedido ' || v_request_id::text ||
      '. Empresa: ' || left(new.empresa_id,80) || '. Serviços: ' || left(coalesce(v_servicos,'não informados'),300) ||
      '. Prazo proposto: ' || to_char(new.prazo at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      ' (horário de Brasília). Resumo: ' || left(new.resumo,1600) ||
      case when nullif(new.validacao_metadados->>'bloqueio','') is null then
        '. Confira etapas, fontes e ambiguidades e confirme explicitamente no site autenticado: '
        else '. Há um impedimento na validação; esta proposta ainda não pode ser confirmada. Confira no site autenticado: ' end ||
      'https://financeiro.oficialmaxnutrition.com.br/ (use o protocolo ' || v_request_id::text ||
      '). Ainda não existe autorização para executar ou publicar.';
  end if;
  perform helena_v2._telegram_avisar_pedido(new.pedido_id,'proposta:' || new.id::text,
    left(v_texto,4096));
  return new;
end;
$f$;
create trigger pedido_proposta_telegram_aviso after insert on helena_v2.pedido_entrada_proposta
  for each row execute function helena_v2._telegram_avisar_proposta();

create function helena_v2._telegram_avisar_card_criado() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $f$
declare v_request_id uuid;
begin
  if old.card_id is not null or new.card_id is null then return new; end if;
  select p.request_id into v_request_id from helena_v2.pedido_entrada p
    where p.id=new.pedido_id and p.fundador_uid=new.fundador_uid;
  if v_request_id is null then return new; end if;
  perform helena_v2._telegram_avisar_pedido(new.pedido_id,
    'card:' || new.card_id::text || ':criado',
    'Card criado para o pedido ' || v_request_id::text ||
    '. O plano foi confirmado; acompanhe o estado real no Kanban autenticado: ' ||
    'https://financeiro.oficialmaxnutrition.com.br/?card=' || new.card_id::text ||
    '. Card criado não significa execução concluída nem publicação.');
  return new;
end;
$f$;
create trigger pedido_card_telegram_aviso after update of card_id on helena_v2.pedido_entrada_plano
  for each row execute function helena_v2._telegram_avisar_card_criado();

create function helena_v2._telegram_avisar_estado_card() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $f$
declare v_pedido_id uuid; v_request_id uuid; v_hist bigint; v_texto text;
begin
  if new.estado is not distinct from old.estado
     or new.estado not in ('ESPERANDO_CONFIRMACAO','ESPERANDO_FUNDADOR','PRONTO','ENCERRADO_COM_FALHA') then
    return new;
  end if;
  select pl.pedido_id,p.request_id into v_pedido_id,v_request_id
    from helena_v2.pedido_entrada_plano pl
    join helena_v2.pedido_entrada p on p.id=pl.pedido_id
      and p.fundador_uid=pl.fundador_uid
    where pl.card_id=new.id and pl.consumido_em is not null;
  if v_pedido_id is null then return new; end if;
  -- O motor escreve o histórico antes de atualizar o card. Usar essa linha
  -- dá uma chave estável ao aviso; as guardas da máquina vetam UPDATE direto.
  select h.id into v_hist from helena_v2.historico h
    where h.card_id=new.id and h.maquina='card' and h.alvo_id=new.id
      and h.estado_antes=old.estado and h.estado_depois=new.estado
      and h.resultado in ('APLICADO','CONVERTIDO')
    order by h.id desc limit 1;
  if v_hist is null then return new; end if;
  if new.estado='PRONTO' then
    v_texto := 'O card do pedido ' || v_request_id::text ||
      ' chegou ao estado PRONTO no Kanban. Isso indica conclusão interna do card; não comprova publicação ou contato externo.';
  elsif new.estado='ESPERANDO_CONFIRMACAO' then
    v_texto := 'O card do pedido ' || v_request_id::text ||
      ' está ESPERANDO_CONFIRMACAO. Confira a leitura de volta no Kanban; nenhuma ação foi aprovada automaticamente.';
  elsif new.estado='ESPERANDO_FUNDADOR' then
    v_texto := 'O card do pedido ' || v_request_id::text ||
      ' está ESPERANDO_FUNDADOR. Abra o Kanban para avaliar a solicitação; esta mensagem não aprova nenhuma ação.';
  else
    v_texto := 'O card do pedido ' || v_request_id::text ||
      ' foi ENCERRADO_COM_FALHA. Confira o histórico e os próximos passos no Kanban.';
  end if;
  perform helena_v2._telegram_avisar_pedido(v_pedido_id,
    'card:' || new.id::text || ':' || v_hist::text,
    v_texto || ' https://financeiro.oficialmaxnutrition.com.br/?card=' || new.id::text);
  return new;
end;
$f$;
create trigger pedido_estado_card_telegram_aviso after update of estado on helena_v2.card
  for each row execute function helena_v2._telegram_avisar_estado_card();

revoke all on function helena_v2._telegram_avisar_pedido(uuid,text,text),
  helena_v2._telegram_avisar_proposta(),
  helena_v2._telegram_avisar_card_criado(),
  helena_v2._telegram_avisar_estado_card()
  from public,anon,authenticated,service_role;
