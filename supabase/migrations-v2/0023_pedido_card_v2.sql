-- O que é: Um plano confirmado pelo fundador converte a entrada v2 em card, sem criar tarefa v1.
-- O texto e os eventos são fontes do pedido; o pacote vem da revisão v2 fixada.

alter table helena_v2.pedido_entrada drop constraint pedido_entrada_estado_check;
alter table helena_v2.pedido_entrada add constraint pedido_entrada_estado_check
  check (estado in ('RECEBIDO', 'PLANO_CONFIRMADO', 'CARD_CRIADO'));

create table helena_v2.pedido_entrada_plano (
  pedido_id uuid primary key references helena_v2.pedido_entrada(id),
  fundador_uid uuid not null,
  empresa_id text not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  prazo timestamptz not null,
  plano jsonb not null,
  config_revision_id uuid not null references helena_v2.configuracao(id),
  eventos jsonb not null,
  dados_reais jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  confirmado_em timestamptz not null default clock_timestamp(),
  card_id uuid unique references helena_v2.card(id),
  roteiro_hash text,
  consumido_em timestamptz,
  check ((card_id is null and roteiro_hash is null and consumido_em is null)
      or (card_id is not null and roteiro_hash is not null and consumido_em is not null))
);
alter table helena_v2.pedido_entrada_plano enable row level security;

create function helena_v2._pedido_plano_imutavel() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'PEDIDO_PLANO_HISTORICO_IMUTAVEL' using errcode='42501';
  end if;
  if old.card_id is not null
     or (to_jsonb(new) - 'card_id' - 'roteiro_hash' - 'consumido_em')
        is distinct from (to_jsonb(old) - 'card_id' - 'roteiro_hash' - 'consumido_em')
     or new.card_id is null or new.roteiro_hash is null or new.consumido_em is null then
    raise exception 'PEDIDO_PLANO_IMUTAVEL' using errcode='42501';
  end if;
  return new;
end;
$f$;

create function helena_v2._pedido_evento_imutavel() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'PEDIDO_EVENTO_IMUTAVEL' using errcode='42501';
end;
$f$;
create trigger pedido_evento_imutavel before update or delete on helena_v2.pedido_entrada_evento
  for each row execute function helena_v2._pedido_evento_imutavel();
create trigger pedido_evento_sem_truncate before truncate on helena_v2.pedido_entrada_evento
  for each statement execute function helena_v2._pedido_evento_imutavel();

-- O pacote e a fonte são construídos pelo banco; o cliente só escolhe empresa,
-- prazo e plano. Eventos posteriores permanecem no pedido, mas não reescrevem
-- a fotografia assinada desta execução.
create function helena_v2._pedido_dados_canonicos(
  p_pedido_id uuid, p_empresa text, p_plano jsonb, p_config uuid, p_eventos jsonb
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare pacote jsonb; hash_config text; texto_inicial text; fontes_extras jsonb;
begin
  select c.conteudo #> array['helena-v2/organograma.yaml','empresas',p_empresa,'pacote'], c.hash_sha256
    into pacote, hash_config from helena_v2.configuracao c where c.id=p_config;
  texto_inicial := p_eventos -> 0 ->> 'texto';
  select coalesce(jsonb_object_agg('FON-PEDIDO-EVENTO-' || (x.valor ->> 'id'),
    x.valor ->> 'texto'),'{}'::jsonb) into fontes_extras
    from jsonb_array_elements(p_eventos) with ordinality as x(valor,n) where x.n>1;
  return jsonb_build_object(
    'pedido',jsonb_build_object(
      'ordem_de_servico',jsonb_build_object('pedido_original',texto_inicial,'empresa',p_empresa),
      'plano',p_plano,'pacote_da_empresa',pacote || jsonb_build_object(
        'fonte_importada_id','FON-PACOTE-' || p_empresa)),
    'fontes_importadas',jsonb_build_object(
      'FON-PEDIDO-' || p_pedido_id::text,texto_inicial,
      'FON-PACOTE-' || p_empresa,pacote::text) || fontes_extras,
    'decisoes','[]'::jsonb,'entradas_externas','{}'::jsonb,
    'proveniencia',jsonb_build_object('pedido_id',p_pedido_id,'config_revision_id',p_config,
      'config_hash',hash_config,'eventos_hash',helena_v2._config_hash(p_eventos),
      'business_id',p_empresa,
      'evento_ids',(select coalesce(jsonb_agg(x.valor ->> 'id' order by x.n),'[]'::jsonb)
         from jsonb_array_elements(p_eventos) with ordinality as x(valor,n))),
    'captura',jsonb_build_object('fonte','pedido_entrada','eventos',p_eventos,
      'config_revision_id',p_config,'config_hash',hash_config));
end;
$f$;

create function helena_v2._pedido_ordem(p helena_v2.pedido_entrada_plano) returns jsonb
language sql stable set search_path=pg_catalog,pg_temp as $f$
  select p.plano || jsonb_build_object(
    'config_revision_id',p.config_revision_id,'modo_contexto','real',
    'origem','pedido_entrada','chave_origem',p.pedido_id::text,
    'pedido_original',p.eventos -> 0 ->> 'texto',
    'business_id',p.empresa_id,'dados_reais',p.dados_reais);
$f$;

create function helena_v2._pedido_conferir_fontes(p helena_v2.pedido_entrada_plano,
  p_exigir_ativa boolean default false) returns boolean
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp
set lock_timeout='5s' as $f$
declare c helena_v2.configuracao; ativos jsonb; e jsonb;
begin
  select * into c from helena_v2.configuracao where id=p.config_revision_id for share;
  if c.id is null or c.estado not in ('VALIDADA','APOSENTADA')
     or (p_exigir_ativa and (c.estado <> 'VALIDADA' or not exists (
       select 1 from helena_v2.configuracao_ponteiro where ativa_id=c.id))) then
    raise exception 'PEDIDO_CONFIG_NAO_VIGENTE' using errcode='23514';
  end if;
  if c.conteudo #>> array['helena-v2/organograma.yaml','empresas',p.empresa_id,'pacote','estado']
       is distinct from 'CONFIRMADO' then
    raise exception 'PEDIDO_PACOTE_NAO_CONFIRMADO' using errcode='23514';
  end if;
  if not exists (select 1 from helena_v2.pedido_entrada i
      where i.id=p.pedido_id and i.fundador_uid=p.fundador_uid
        and i.estado in ('PLANO_CONFIRMADO','CARD_CRIADO')) then
    raise exception 'PEDIDO_DONO_OU_ESTADO_DIVERGENTE' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',ev.id,'origem',ev.origem,
    'evento_id',ev.evento_id,'texto',ev.texto) order by ev.id),'[]'::jsonb) into ativos
    from helena_v2.pedido_entrada_evento ev
    where ev.pedido_id=p.pedido_id and ev.fundador_uid=p.fundador_uid and ev.id in (
      select (item ->> 'id')::bigint from jsonb_array_elements(p.eventos) as item);
  if ativos is distinct from p.eventos or p.dados_reais is distinct from
       helena_v2._pedido_dados_canonicos(p.pedido_id,p.empresa_id,p.plano,
                                         p.config_revision_id,p.eventos) then
    raise exception 'PEDIDO_FONTES_MUDARAM' using errcode='40001';
  end if;
  return true;
end;
$f$;

create function helena_v2.confirmar_plano_pedido(
  p_request_id uuid,p_empresa text,p_titulo text,p_prazo timestamptz,
  p_plano jsonb,p_config_revision_id uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $f$
declare pedido helena_v2.pedido_entrada; confirmado helena_v2.pedido_entrada_plano;
  v_config helena_v2.configuracao; eventos jsonb; dados jsonb; hash_payload text;
  etapa jsonb; servico jsonb;
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  if p_request_id is null or p_empresa is null or p_titulo is null or p_prazo is null
     or p_config_revision_id is null or not helena_v2._prazo_valido(p_prazo)
     or char_length(btrim(p_titulo)) not between 1 and 160
     or jsonb_typeof(p_plano) is distinct from 'object'
     or jsonb_typeof(p_plano -> 'etapas') is distinct from 'array'
     or jsonb_array_length(p_plano -> 'etapas')=0
     or jsonb_typeof(p_plano -> 'empresas') is distinct from 'array'
     or not (p_plano -> 'empresas') ? p_empresa
     or p_plano -> 'decisoes' is distinct from '[]'::jsonb
     or p_plano -> 'entradas_externas' is distinct from '{}'::jsonb
     or octet_length(p_plano::text)>200000 then
    raise exception 'PEDIDO_PLANO_PARAMETROS_INVALIDOS' using errcode='22023';
  end if;
  select * into pedido from helena_v2.pedido_entrada
    where request_id=p_request_id and fundador_uid=auth.uid() for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='22023'; end if;
  select * into confirmado from helena_v2.pedido_entrada_plano where pedido_id=pedido.id;
  hash_payload := helena_v2._config_hash(jsonb_build_object(
    'request_id',p_request_id,'empresa',p_empresa,'titulo',p_titulo,'prazo',p_prazo,
    'plano',p_plano,'config_revision_id',p_config_revision_id));
  if found then
    if confirmado.payload_hash is distinct from hash_payload then
      raise exception 'PEDIDO_PLANO_DIVERGENTE' using errcode='23505';
    end if;
    return helena_v2._resumo_pedido_entrada(pedido.id,false);
  end if;
  select c.* into v_config from helena_v2.configuracao c
    join helena_v2.configuracao_ponteiro cp on cp.ativa_id=c.id
    where c.id=p_config_revision_id and c.estado='VALIDADA' for share of c,cp;
  if v_config.id is null then raise exception 'CONFIG_REVISAO_NAO_ATIVA' using errcode='23514'; end if;
  if v_config.conteudo #>> array['helena-v2/organograma.yaml','empresas',p_empresa,'pacote','estado']
      is distinct from 'CONFIRMADO' then
    raise exception 'PEDIDO_PACOTE_NAO_CONFIRMADO' using errcode='23514';
  end if;
  for etapa in select value from jsonb_array_elements(p_plano -> 'etapas') loop
    select value into servico from jsonb_array_elements(v_config.conteudo #> '{helena-v2/servicos.yaml,servicos}')
      where value ->> 'id'=etapa ->> 'servico';
    if servico is null or servico ->> 'estado' not in ('ESTAGIO','ATIVO')
       or not (servico -> 'empresas') ? p_empresa then
      raise exception 'PEDIDO_SERVICO_INDISPONIVEL: %', etapa ->> 'servico' using errcode='23514';
    end if;
    if servico ->> 'julgado_pelo_parecer' = 'SEMPRE' and not exists (
      select 1 from jsonb_array_elements(p_plano -> 'etapas') as j(e)
      where j.e ->> 'servico'='SRV-PARECER'
        and (j.e -> 'depende_de') ? (etapa ->> 'id')
        and (j.e -> 'julga') ? (etapa ->> 'id')) then
      raise exception 'PEDIDO_PARECER_OBRIGATORIO: %', etapa ->> 'id' using errcode='23514';
    end if;
    if etapa ->> 'servico' = 'SRV-PARECER' then
      -- 0023 só captura mensagem e pacote v2. Ainda não há fonte publicada
      -- FON-LEIS transportada por esse adaptador; não confirmar plano inexequível.
      raise exception 'PEDIDO_FONTE_LEIS_AUSENTE' using errcode='23514';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'origem',e.origem,
    'evento_id',e.evento_id,'texto',e.texto) order by e.id),'[]'::jsonb) into eventos
    from helena_v2.pedido_entrada_evento e where e.pedido_id=pedido.id;
  if jsonb_array_length(eventos)=0 then
    raise exception 'PEDIDO_SEM_EVENTOS' using errcode='22023';
  end if;
  dados := helena_v2._pedido_dados_canonicos(pedido.id,p_empresa,p_plano,p_config_revision_id,eventos);
  if octet_length(dados::text)>1000000 then
    raise exception 'PEDIDO_FONTES_EXCEDEM_LIMITE' using errcode='22023';
  end if;
  insert into helena_v2.pedido_entrada_plano
    (pedido_id,fundador_uid,empresa_id,titulo,prazo,plano,config_revision_id,
     eventos,dados_reais,payload_hash)
    values (pedido.id,auth.uid(),p_empresa,p_titulo,p_prazo,p_plano,
            p_config_revision_id,eventos,dados,hash_payload);
  update helena_v2.pedido_entrada set estado='PLANO_CONFIRMADO',atualizado_em=clock_timestamp()
    where id=pedido.id;
  return helena_v2._resumo_pedido_entrada(pedido.id,false);
end;
$f$;

create function helena_v2.ler_plano_pedido(p_pedido_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada_plano;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode='42501';
  end if;
  select * into p from helena_v2.pedido_entrada_plano where pedido_id=p_pedido_id;
  return case when found then to_jsonb(p) else null end;
end;
$f$;

create function helena_v2.consumir_plano_pedido(p_pedido_id uuid,p_roteiro jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada_plano; v jsonb; hash_roteiro text;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode='42501';
  end if;
  if p_pedido_id is null or jsonb_typeof(p_roteiro) is distinct from 'object'
     or jsonb_typeof(p_roteiro -> 'etapas') is distinct from 'array'
     or octet_length(p_roteiro::text)>200000 then
    raise exception 'ROTEIRO_PEDIDO_INVALIDO' using errcode='22023';
  end if;
  hash_roteiro := helena_v2._config_hash(p_roteiro);
  select * into p from helena_v2.pedido_entrada_plano where pedido_id=p_pedido_id for update;
  if not found then raise exception 'PEDIDO_PLANO_NAO_ENCONTRADO' using errcode='22023'; end if;
  if p.card_id is not null then
    if p.roteiro_hash is distinct from hash_roteiro then
      raise exception 'ROTEIRO_PEDIDO_DIVERGENTE' using errcode='23505';
    end if;
    return jsonb_build_object('card_id',p.card_id,'novo',false);
  end if;
  if jsonb_array_length(p_roteiro -> 'etapas') <> jsonb_array_length(p.plano -> 'etapas')
     or exists (select 1 from jsonb_array_elements(p_roteiro -> 'etapas') with ordinality as r(e,n)
       where r.e ->> 'id' is distinct from p.plano -> 'etapas' -> (r.n::integer-1) ->> 'id'
          or r.e ->> 'servico' is distinct from
             p.plano -> 'etapas' -> (r.n::integer-1) ->> 'servico') then
    raise exception 'ROTEIRO_PEDIDO_DIVERGENTE' using errcode='22023';
  end if;
  perform helena_v2._pedido_conferir_fontes(p,true);
  v := helena_v2.criar_card('pedido_entrada',p.pedido_id::text,
    p.eventos -> 0 ->> 'texto',p.titulo,p.prazo,p_roteiro,p.empresa_id,
    helena_v2._pedido_ordem(p),0,true);
  if v ->> 'card_id' is null or (v ->> 'novo')::boolean is not true then
    raise exception 'CARD_PEDIDO_NAO_CRIADO' using errcode='23505';
  end if;
  update helena_v2.pedido_entrada_plano set card_id=(v ->> 'card_id')::uuid,
    roteiro_hash=hash_roteiro,consumido_em=clock_timestamp() where pedido_id=p_pedido_id;
  update helena_v2.pedido_entrada set estado='CARD_CRIADO',atualizado_em=clock_timestamp()
    where id=p_pedido_id and estado='PLANO_CONFIRMADO';
  if not found then raise exception 'PEDIDO_ESTADO_DIVERGENTE' using errcode='40001'; end if;
  return v;
end;
$f$;

create or replace function helena_v2._resumo_pedido_entrada(p_pedido_id uuid, p_com_eventos boolean)
returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $f$
  select jsonb_build_object(
    'pedido_id',p.id,'request_id',p.request_id,'estado',p.estado,
    'texto_inicial',primeiro.texto,'origem_inicial',primeiro.origem,
    'total_eventos',(select count(*) from helena_v2.pedido_entrada_evento e where e.pedido_id=p.id),
    'criado_em',p.criado_em,'atualizado_em',p.atualizado_em,
    'perguntas','[]'::jsonb,'proposta_helena',null,
    'empresa_id',pl.empresa_id,'empresa_confirmada',pl.pedido_id is not null,
    'config_revision_id',pl.config_revision_id,'card_id',pl.card_id,
    'titulo_confirmado',pl.titulo,'prazo_confirmado',pl.prazo,
    'plano_hash',pl.payload_hash
  ) || case when p_com_eventos then jsonb_build_object(
    'eventos',coalesce((select jsonb_agg(jsonb_build_object(
      'origem',e.origem,'evento_id',e.evento_id,'texto',e.texto,
      'recebido_em',e.recebido_em) order by e.id)
      from helena_v2.pedido_entrada_evento e where e.pedido_id=p.id),'[]'::jsonb)
  ) else '{}'::jsonb end
  from helena_v2.pedido_entrada p
  left join helena_v2.pedido_entrada_plano pl on pl.pedido_id=p.id
  left join lateral (select e.texto,e.origem from helena_v2.pedido_entrada_evento e
    where e.pedido_id=p.id order by e.id limit 1) primeiro on true
  where p.id=p_pedido_id;
$f$;

create function helena_v2._pedido_conferir_card_vinculado(p_card_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare
  p helena_v2.pedido_entrada_plano;
  c helena_v2.card;
  pai helena_v2.card;
  criacao helena_v2.historico;
  origem helena_v2.historico;
  ordem jsonb;
  v_estado text;
  v_saltos integer := 0;
  v_visitados uuid[] := '{}'::uuid[];
  v_criacoes integer;
begin
  select * into c from helena_v2.card where id=p_card_id for share;
  if c.id is null then
    raise exception 'CARD_PEDIDO_NAO_ENCONTRADO' using errcode='22023';
  end if;
  loop
    if c.id=any(v_visitados) then
      raise exception 'CARD_PEDIDO_CADEIA_CICLICA' using errcode='42501';
    end if;
    v_visitados := array_append(v_visitados,c.id);
    select * into p from helena_v2.pedido_entrada_plano
      where card_id=c.id and consumido_em is not null for share;
    exit when found;
    if c.card_pai_id is null or v_saltos >= 16 then
      raise exception 'CARD_PEDIDO_SEM_SOLICITACAO_CONSUMIDA' using errcode='22023';
    end if;
    select * into pai from helena_v2.card where id=c.card_pai_id for share;
    if pai.id is null or pai.id=c.id
       or c.empresa is distinct from pai.empresa
       or c.ordem_de_servico is distinct from pai.ordem_de_servico
       or c.ordem_de_servico ->> 'config_revision_id' is distinct from
          pai.ordem_de_servico ->> 'config_revision_id'
       or c.titulo is distinct from pai.titulo then
      raise exception 'CARD_PEDIDO_CADEIA_DIVERGENTE' using errcode='42501';
    end if;
    select count(*) into v_criacoes from helena_v2.historico h
      where h.card_id=c.id and h.evento='CARD_CRIADO';
    if v_criacoes<>1 then
      raise exception 'CARD_PEDIDO_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into criacao from helena_v2.historico h
      where h.card_id=c.id and h.maquina='card' and h.alvo_id=c.id
        and h.papel='MOTOR' and h.evento='CARD_CRIADO' and h.resultado='APLICADO'
        and h.origem='SINAL' and h.conteudo ->> 'ligado_a'=pai.id::text;
    if criacao.id is null or criacao.origem_id is null then
      raise exception 'CARD_PEDIDO_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into origem from helena_v2.historico h
      where h.id=criacao.origem_id and h.card_id=pai.id;
    if origem.id is null or (
      (origem.maquina='card' and origem.alvo_id=pai.id)
      or (origem.maquina='etapa' and exists
          (select 1 from helena_v2.etapa e
           where e.id=origem.alvo_id and e.card_id=pai.id))
      or (origem.maquina='acao_externa' and exists
          (select 1 from helena_v2.acao_externa a
           where a.id=origem.alvo_id and a.card_id=pai.id))
    ) is distinct from true then
      raise exception 'CARD_PEDIDO_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    if (
      (origem.resultado='REACAO' and origem.papel='FUNDADOR'
       and criacao.conteudo ->> 'motivo'='REACAO ' || origem.evento
       and exists (select 1 from helena_v2.reacao r
                   where r.maquina=origem.maquina and r.papel=origem.papel
                     and r.evento=origem.evento and r.abre_card_ligado))
      or (origem.resultado='CARD_NOVO_LIGADO' and origem.papel='FUNDADOR'
          and criacao.conteudo ->> 'motivo'=origem.papel || ' ' || origem.evento)
      or (origem.resultado in ('APLICADO','CONVERTIDO')
          and exists (select 1 from helena_v2.passagem t
                      join helena_v2.ligacao l
                        on l.nome=any(t.sinais) and l.no_card='criar_card_ligado'
                      where t.maquina=origem.maquina and t.linha_id=origem.linha_id
                        and t.evento=origem.evento and t.papel=origem.papel
                        and l.nome=criacao.conteudo ->> 'motivo'))
    ) is distinct from true then
      raise exception 'CARD_PEDIDO_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    c := pai;
    v_saltos := v_saltos+1;
  end loop;

  if c.card_pai_id is not null then
    raise exception 'CARD_PEDIDO_RAIZ_DIVERGENTE' using errcode='42501';
  end if;
  ordem := helena_v2._pedido_ordem(p);
  if c.empresa is distinct from p.empresa_id
     or c.titulo is distinct from p.titulo
     or c.prazo is distinct from p.prazo
     or c.ordem_de_servico is distinct from ordem then
    raise exception 'CARD_PEDIDO_VINCULO_DIVERGENTE' using errcode='42501';
  end if;
  perform helena_v2._pedido_conferir_fontes(p,false);
  return true;
end;
$f$;

-- A função de 0015 permanece intacta sob nome privado; a porta de fontes
-- encaminha por origem exata e os triggers de 0007/0010 continuam chamando-a.
alter function helena_v2._real_conferir_card_vinculado(uuid)
  rename to _real_conferir_card_v1;
create function helena_v2._real_conferir_card_vinculado(p_card_id uuid)
returns boolean language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $f$
declare ordem jsonb;
begin
  select c.ordem_de_servico into ordem from helena_v2.card c where c.id=p_card_id for share;
  if ordem is null then raise exception 'CARD_REAL_NAO_ENCONTRADO' using errcode='22023'; end if;
  if ordem ->> 'origem' = 'pedido_entrada' then
    if ordem ->> 'modo_contexto' is distinct from 'real' then
      raise exception 'CARD_PEDIDO_MODO_DIVERGENTE' using errcode='42501';
    end if;
    return helena_v2._pedido_conferir_card_vinculado(p_card_id);
  end if;
  return helena_v2._real_conferir_card_v1(p_card_id);
end;
$f$;

revoke all on helena_v2.pedido_entrada_plano from public,anon,authenticated,service_role;
revoke all on function helena_v2._pedido_plano_imutavel(),
  helena_v2._pedido_evento_imutavel(),
  helena_v2._pedido_dados_canonicos(uuid,text,jsonb,uuid,jsonb),
  helena_v2._pedido_ordem(helena_v2.pedido_entrada_plano),
  helena_v2._pedido_conferir_fontes(helena_v2.pedido_entrada_plano,boolean),
  helena_v2._pedido_conferir_card_vinculado(uuid),
  helena_v2._real_conferir_card_vinculado(uuid),
  helena_v2.confirmar_plano_pedido(uuid,text,text,timestamptz,jsonb,uuid),
  helena_v2.ler_plano_pedido(uuid),helena_v2.consumir_plano_pedido(uuid,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function helena_v2.confirmar_plano_pedido(uuid,text,text,timestamptz,jsonb,uuid)
  to authenticated;
grant execute on function helena_v2.ler_plano_pedido(uuid),
  helena_v2.consumir_plano_pedido(uuid,jsonb) to service_role;
create trigger pedido_plano_imutavel before update or delete on helena_v2.pedido_entrada_plano
  for each row execute function helena_v2._pedido_plano_imutavel();
create trigger pedido_plano_sem_truncate before truncate on helena_v2.pedido_entrada_plano
  for each statement execute function helena_v2._pedido_plano_imutavel();
