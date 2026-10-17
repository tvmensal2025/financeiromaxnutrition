-- O que é: Proposta da Helena: interpretação versionada antes de qualquer confirmação.
-- O motor só registra uma interpretação; somente o fundador confirma o plano.

create table helena_v2.pedido_entrada_reserva (
  pedido_id uuid primary key references helena_v2.pedido_entrada(id),
  lease_token uuid not null unique,
  config_revision_id uuid not null references helena_v2.configuracao(id),
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  eventos_hash text not null check (eventos_hash ~ '^[0-9a-f]{64}$'),
  contexto_hash text not null check (contexto_hash ~ '^[0-9a-f]{64}$'),
  expira_em timestamptz not null
);

create table helena_v2.pedido_entrada_resposta_bruta (
  id uuid primary key default gen_random_uuid(),
  lease_token uuid not null unique,
  pedido_id uuid not null references helena_v2.pedido_entrada(id),
  config_revision_id uuid not null references helena_v2.configuracao(id),
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  eventos_hash text not null check (eventos_hash ~ '^[0-9a-f]{64}$'),
  contexto_hash text not null check (contexto_hash ~ '^[0-9a-f]{64}$'),
  resposta jsonb not null check (jsonb_typeof(resposta) = 'object'),
  criado_em timestamptz not null default clock_timestamp(),
  unique (pedido_id, config_revision_id, config_hash, eventos_hash, contexto_hash)
);

create table helena_v2.pedido_entrada_proposta (
  id uuid primary key default gen_random_uuid(),
  lease_token uuid not null unique,
  resultado_hash text not null check (resultado_hash ~ '^[0-9a-f]{64}$'),
  pedido_id uuid not null references helena_v2.pedido_entrada(id),
  fundador_uid uuid not null,
  config_revision_id uuid not null references helena_v2.configuracao(id),
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  eventos_hash text not null check (eventos_hash ~ '^[0-9a-f]{64}$'),
  contexto_hash text not null check (contexto_hash ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('PERGUNTAR','PROPOR')),
  perguntas jsonb not null check (jsonb_typeof(perguntas) = 'array'),
  resumo text not null check (char_length(btrim(resumo)) between 1 and 4000),
  empresa_id text,
  titulo text,
  prazo timestamptz,
  plano jsonb,
  validacao_metadados jsonb not null check (jsonb_typeof(validacao_metadados) = 'object'),
  criado_em timestamptz not null default clock_timestamp(),
  unique (pedido_id, config_revision_id, config_hash, eventos_hash, contexto_hash),
  check ((tipo = 'PERGUNTAR' and jsonb_array_length(perguntas) > 0
          and empresa_id is null and titulo is null and prazo is null and plano is null)
      or (tipo = 'PROPOR' and perguntas = '[]'::jsonb
          and empresa_id is not null and titulo is not null and prazo is not null and plano is not null))
);
create index pedido_proposta_mais_recente on helena_v2.pedido_entrada_proposta
  (pedido_id, criado_em desc, id desc);

alter table helena_v2.pedido_entrada_reserva enable row level security;
alter table helena_v2.pedido_entrada_resposta_bruta enable row level security;
alter table helena_v2.pedido_entrada_proposta enable row level security;

create function helena_v2._pedido_proposta_imutavel() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $f$
begin
  raise exception 'PEDIDO_PROPOSTA_HISTORICO_IMUTAVEL' using errcode='42501';
end;
$f$;
create trigger pedido_resposta_imutavel before update or delete on helena_v2.pedido_entrada_resposta_bruta
  for each row execute function helena_v2._pedido_proposta_imutavel();
create trigger pedido_resposta_sem_truncate before truncate on helena_v2.pedido_entrada_resposta_bruta
  for each statement execute function helena_v2._pedido_proposta_imutavel();
create trigger pedido_proposta_imutavel before update or delete on helena_v2.pedido_entrada_proposta
  for each row execute function helena_v2._pedido_proposta_imutavel();
create trigger pedido_proposta_sem_truncate before truncate on helena_v2.pedido_entrada_proposta
  for each statement execute function helena_v2._pedido_proposta_imutavel();

create function helena_v2._pedido_proposta_eventos(p_pedido_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,pg_temp as $f$
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'origem',e.origem,
    'evento_id',e.evento_id,'texto',e.texto) order by e.id),'[]'::jsonb)
  from helena_v2.pedido_entrada_evento e where e.pedido_id=p_pedido_id;
$f$;

-- Contexto usado na interpretação, com limite explícito: nenhuma decisão vigente
-- pode ficar fora do hash por causa de truncamento silencioso.
create function helena_v2._pedido_proposta_contexto(p_config_revision_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare v_checkpoint jsonb; v_decisoes jsonb; v_portfolio jsonb;
  v_empresas jsonb;
begin
  if (select count(*) from public.checkpoint_mestre where status='ATIVO')<>1 then
    raise exception 'PEDIDO_CONTEXTO_INDISPONIVEL' using errcode='23514';
  end if;
  select jsonb_build_object('checkpoint_id',cp.checkpoint_id,'versao',cp.versao,
    'status',cp.status,'resumo_executivo',cp.resumo_executivo,
    'validado_em',cp.validado_em,'checkpoint_anterior_id',cp.checkpoint_anterior_id)
    into v_checkpoint from public.checkpoint_mestre_atual cp
    where cp.status='ATIVO' and cp.checkpoint_id is not null limit 1;
  if v_checkpoint is null then
    raise exception 'PEDIDO_CONTEXTO_INDISPONIVEL' using errcode='23514';
  end if;
  if (select count(*) from public.decisoes
      where status in ('ATIVO','ATIVA','VIGENTE'))>30 then
    raise exception 'PEDIDO_CONTEXTO_INCOMPLETO' using errcode='23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'decision_id',d.decision_id,'decisao',d.decisao,'row_version',d.row_version,
    'business_id',d.business_id,'status',d.status) order by d.decision_id),'[]'::jsonb)
    into v_decisoes from public.decisoes d
    where d.status in ('ATIVO','ATIVA','VIGENTE');
  select c.conteudo #> '{helena-v2/organograma.yaml,empresas}' into v_empresas
    from helena_v2.configuracao c where c.id=p_config_revision_id;
  if jsonb_typeof(v_empresas) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(v_empresas))>100 then
    raise exception 'PEDIDO_CONTEXTO_INCOMPLETO' using errcode='23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'business_id',p.business_id,'negocio',p.negocio,'estagio',p.estagio,
    'ativo',p.ativo,'row_version',p.row_version)
    order by p.business_id),'[]'::jsonb) into v_portfolio
    from public.portfolio p where v_empresas ? p.business_id;
  return jsonb_build_object('checkpoint',v_checkpoint,
    'decisoes',v_decisoes,'portfolio',v_portfolio);
end;
$f$;

create function helena_v2._pedido_proposta_atual(p helena_v2.pedido_entrada_proposta)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
begin
  return exists (select 1 from helena_v2.configuracao_ponteiro cp
    join helena_v2.configuracao c on c.id=cp.ativa_id
    where cp.unico and c.id=p.config_revision_id and c.estado='VALIDADA'
      and c.hash_sha256=p.config_hash
      and helena_v2._config_hash(c.conteudo)=p.config_hash)
    and helena_v2._config_hash(helena_v2._pedido_proposta_eventos(p.pedido_id))=p.eventos_hash
    and helena_v2._config_hash(helena_v2._pedido_proposta_contexto(p.config_revision_id))=p.contexto_hash;
exception when check_violation then return false;
end;
$f$;

create function helena_v2.listar_trabalho_proposta_pedido(p_limite integer default 50)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare v_itens jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'LIMITE_INVALIDO' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('pedido_id',q.id,'request_id',q.request_id)
    order by q.criado_em,q.id),'[]'::jsonb) into v_itens from (
      select p.id,p.request_id,p.criado_em from helena_v2.pedido_entrada p
      where p.estado='RECEBIDO' and exists (select 1 from public.app_access a
        where a.user_id=p.fundador_uid and a.role='founder' and a.active=true)
        and exists (
        select 1 from helena_v2.configuracao_ponteiro cp where cp.unico and cp.ativa_id is not null)
        and not exists (select 1 from helena_v2.pedido_entrada_reserva r
          where r.pedido_id=p.id and r.expira_em>clock_timestamp())
        and not exists (select 1 from helena_v2.pedido_entrada_proposta x
          join helena_v2.configuracao_ponteiro cp on cp.ativa_id=x.config_revision_id
          join helena_v2.configuracao c on c.id=x.config_revision_id
          where x.pedido_id=p.id and x.config_hash=c.hash_sha256
            and x.eventos_hash=helena_v2._config_hash(helena_v2._pedido_proposta_eventos(p.id))
            and x.contexto_hash=helena_v2._config_hash(
              helena_v2._pedido_proposta_contexto(x.config_revision_id)))
      order by p.criado_em,p.id limit p_limite
    ) q;
  return jsonb_build_object('itens',v_itens,'limite',p_limite);
end;
$f$;

create function helena_v2.reservar_proposta_pedido(
  p_request_id uuid,p_lease_s integer default 120
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada; c helena_v2.configuracao;
  v_eventos jsonb; v_hash text; v_contexto jsonb; v_contexto_hash text;
  v_token uuid; v_expira timestamptz; v_bruta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if p_request_id is null or p_lease_s is null or p_lease_s not between 30 and 900 then
    raise exception 'RESERVA_PARAMETROS_INVALIDOS' using errcode='22023';
  end if;
  select * into p from helena_v2.pedido_entrada where request_id=p_request_id for update;
  if not found or p.estado<>'RECEBIDO' then return null; end if;
  if not exists (select 1 from public.app_access a
    where a.user_id=p.fundador_uid and a.role='founder' and a.active=true) then
    return null;
  end if;
  select cfg.* into c from helena_v2.configuracao_ponteiro cp
    join helena_v2.configuracao cfg on cfg.id=cp.ativa_id
    where cp.unico and cfg.estado='VALIDADA' for share of cp,cfg;
  if c.id is null or c.hash_sha256 is distinct from helena_v2._config_hash(c.conteudo) then
    raise exception 'PEDIDO_CONFIG_NAO_VIGENTE' using errcode='23514';
  end if;
  lock table public.checkpoint_mestre,public.decisoes,public.portfolio in share mode;
  v_eventos := helena_v2._pedido_proposta_eventos(p.id);
  if jsonb_array_length(v_eventos)=0 then return null; end if;
  v_hash := helena_v2._config_hash(v_eventos);
  v_contexto := helena_v2._pedido_proposta_contexto(c.id);
  v_contexto_hash := helena_v2._config_hash(v_contexto);
  if exists (select 1 from helena_v2.pedido_entrada_proposta x
    where x.pedido_id=p.id and x.config_revision_id=c.id
      and x.config_hash=c.hash_sha256 and x.eventos_hash=v_hash
      and x.contexto_hash=v_contexto_hash) then return null; end if;
  if exists (select 1 from helena_v2.pedido_entrada_reserva r
    where r.pedido_id=p.id and r.expira_em>clock_timestamp()) then return null; end if;
  v_token := gen_random_uuid();
  v_expira := clock_timestamp()+make_interval(secs=>p_lease_s);
  insert into helena_v2.pedido_entrada_reserva
    (pedido_id,lease_token,config_revision_id,config_hash,eventos_hash,contexto_hash,expira_em)
    values (p.id,v_token,c.id,c.hash_sha256,v_hash,v_contexto_hash,v_expira)
    on conflict (pedido_id) do update set lease_token=excluded.lease_token,
      config_revision_id=excluded.config_revision_id,config_hash=excluded.config_hash,
      eventos_hash=excluded.eventos_hash,contexto_hash=excluded.contexto_hash,
      expira_em=excluded.expira_em;
  select b.resposta into v_bruta from helena_v2.pedido_entrada_resposta_bruta b
    where b.pedido_id=p.id and b.config_revision_id=c.id
      and b.config_hash=c.hash_sha256 and b.eventos_hash=v_hash
      and b.contexto_hash=v_contexto_hash;
  return jsonb_build_object('pedido_id',p.id,'request_id',p.request_id,
    'fundador_uid',p.fundador_uid,'eventos',v_eventos,'eventos_hash',v_hash,
    'config_revision_id',c.id,'config_hash',c.hash_sha256,
    'contexto_hash',v_contexto_hash,
    'config_conteudo',c.conteudo,'lease_token',v_token,'expira_em',v_expira,
    'resposta_bruta',v_bruta,'contexto',v_contexto);
end;
$f$;

create function helena_v2._pedido_reserva_valida(p_request_id uuid,p_token uuid)
returns helena_v2.pedido_entrada_reserva language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada; r helena_v2.pedido_entrada_reserva;
  c helena_v2.configuracao;
begin
  select * into p from helena_v2.pedido_entrada where request_id=p_request_id for update;
  if p.id is null or p.estado<>'RECEBIDO' then
    raise exception 'PEDIDO_PROPOSTA_OBSOLETA' using errcode='40001';
  end if;
  if not exists (select 1 from public.app_access a
    where a.user_id=p.fundador_uid and a.role='founder' and a.active=true) then
    raise exception 'PEDIDO_PROPOSTA_OBSOLETA' using errcode='40001';
  end if;
  select * into r from helena_v2.pedido_entrada_reserva
    where pedido_id=p.id and lease_token=p_token for update;
  if r.pedido_id is null or r.expira_em<=clock_timestamp() then
    raise exception 'PEDIDO_RESERVA_EXPIRADA' using errcode='40001';
  end if;
  select cfg.* into c from helena_v2.configuracao_ponteiro cp
    join helena_v2.configuracao cfg on cfg.id=cp.ativa_id
    where cp.unico for share of cp,cfg;
  if c.id is distinct from r.config_revision_id
     or c.estado is distinct from 'VALIDADA'
     or c.hash_sha256 is distinct from r.config_hash
     or helena_v2._config_hash(c.conteudo) is distinct from r.config_hash
     or helena_v2._config_hash(helena_v2._pedido_proposta_eventos(p.id)) is distinct from r.eventos_hash then
    raise exception 'PEDIDO_PROPOSTA_OBSOLETA' using errcode='40001';
  end if;
  lock table public.checkpoint_mestre,public.decisoes,public.portfolio in share mode;
  if helena_v2._config_hash(helena_v2._pedido_proposta_contexto(r.config_revision_id))
     is distinct from r.contexto_hash then
    raise exception 'PEDIDO_PROPOSTA_OBSOLETA' using errcode='40001';
  end if;
  return r;
end;
$f$;

create function helena_v2.registrar_resposta_bruta_pedido(
  p_request_id uuid,p_lease_token uuid,p_resposta jsonb
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare r helena_v2.pedido_entrada_reserva; b helena_v2.pedido_entrada_resposta_bruta;
begin
  if helena_v2._conta()<>'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if jsonb_typeof(p_resposta) is distinct from 'object' or octet_length(p_resposta::text)>200000 then
    raise exception 'RESPOSTA_BRUTA_INVALIDA' using errcode='22023';
  end if;
  select br.* into b from helena_v2.pedido_entrada_resposta_bruta br
    join helena_v2.pedido_entrada pe on pe.id=br.pedido_id
    where pe.request_id=p_request_id and br.lease_token=p_lease_token;
  if found then
    if b.resposta is distinct from p_resposta then
      raise exception 'PEDIDO_RESPOSTA_DIVERGENTE' using errcode='23505';
    end if;
    return jsonb_build_object('id',b.id);
  end if;
  r := helena_v2._pedido_reserva_valida(p_request_id,p_lease_token);
  insert into helena_v2.pedido_entrada_resposta_bruta
    (lease_token,pedido_id,config_revision_id,config_hash,eventos_hash,contexto_hash,resposta)
    values (p_lease_token,r.pedido_id,r.config_revision_id,r.config_hash,
      r.eventos_hash,r.contexto_hash,p_resposta)
    on conflict (pedido_id,config_revision_id,config_hash,eventos_hash,contexto_hash) do nothing;
  select * into b from helena_v2.pedido_entrada_resposta_bruta
    where pedido_id=r.pedido_id and config_revision_id=r.config_revision_id
      and config_hash=r.config_hash and eventos_hash=r.eventos_hash
      and contexto_hash=r.contexto_hash;
  if b.resposta is distinct from p_resposta then
    raise exception 'PEDIDO_RESPOSTA_DIVERGENTE' using errcode='23505';
  end if;
  return jsonb_build_object('id',b.id);
end;
$f$;

create function helena_v2.registrar_proposta_pedido(
  p_request_id uuid,p_lease_token uuid,p_resultado jsonb
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare r helena_v2.pedido_entrada_reserva; p helena_v2.pedido_entrada;
  x helena_v2.pedido_entrada_proposta; v_tipo text; v_perguntas jsonb;
begin
  if helena_v2._conta()<>'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object'
     or octet_length(p_resultado::text)>200000 then
    raise exception 'PEDIDO_PROPOSTA_INVALIDA' using errcode='22023';
  end if;
  v_tipo := p_resultado->>'tipo'; v_perguntas := p_resultado->'perguntas';
  if v_tipo not in ('PERGUNTAR','PROPOR') or v_tipo is null
     or jsonb_typeof(v_perguntas) is distinct from 'array'
     or p_resultado->>'resumo' is null
     or char_length(btrim(p_resultado->>'resumo')) not between 1 and 4000
     or jsonb_typeof(p_resultado->'validacao_metadados') is distinct from 'object'
     or exists (select 1 from jsonb_array_elements(v_perguntas) as q(value)
       where jsonb_typeof(q.value)<>'string' or char_length(btrim(q.value #>> '{}')) not between 1 and 1000)
     or (v_tipo='PERGUNTAR' and (jsonb_array_length(v_perguntas)=0
       or p_resultado->'plano' is distinct from 'null'::jsonb and p_resultado ? 'plano'
       or p_resultado->>'empresa_id' is not null or p_resultado->>'titulo' is not null
       or p_resultado->>'prazo' is not null))
     or (v_tipo='PROPOR' and (v_perguntas<>'[]'::jsonb
       or nullif(btrim(p_resultado->>'empresa_id'),'') is null
       or char_length(btrim(p_resultado->>'titulo')) not between 1 and 160
       or (p_resultado->>'prazo') is null
       or jsonb_typeof(p_resultado->'plano') is distinct from 'object'
       or jsonb_typeof(p_resultado #> '{plano,etapas}') is distinct from 'array'
       or p_resultado #> '{plano,etapas}' = '[]'::jsonb
       or jsonb_typeof(p_resultado #> '{plano,empresas}') is distinct from 'array'
       or not (p_resultado #> '{plano,empresas}') ? (p_resultado->>'empresa_id')
       or p_resultado #> '{plano,decisoes}' is distinct from '[]'::jsonb
       or p_resultado #> '{plano,entradas_externas}' is distinct from '{}'::jsonb)) then
    raise exception 'PEDIDO_PROPOSTA_INVALIDA' using errcode='22023';
  end if;
  select proposta.* into x from helena_v2.pedido_entrada_proposta proposta
    join helena_v2.pedido_entrada pedido on pedido.id=proposta.pedido_id
    where pedido.request_id=p_request_id and proposta.lease_token=p_lease_token;
  if found then
    if x.resultado_hash is distinct from helena_v2._config_hash(p_resultado) then
      raise exception 'PEDIDO_PROPOSTA_DIVERGENTE' using errcode='23505';
    end if;
    return to_jsonb(x);
  end if;
  r := helena_v2._pedido_reserva_valida(p_request_id,p_lease_token);
  if not exists (select 1 from helena_v2.pedido_entrada_resposta_bruta b
    where b.pedido_id=r.pedido_id and b.config_revision_id=r.config_revision_id
      and b.config_hash=r.config_hash and b.eventos_hash=r.eventos_hash
      and b.contexto_hash=r.contexto_hash) then
    raise exception 'PEDIDO_RESPOSTA_BRUTA_AUSENTE' using errcode='23514';
  end if;
  select * into p from helena_v2.pedido_entrada where id=r.pedido_id;
  insert into helena_v2.pedido_entrada_proposta
    (lease_token,resultado_hash,pedido_id,fundador_uid,config_revision_id,
     config_hash,eventos_hash,contexto_hash,tipo,
     perguntas,resumo,empresa_id,titulo,prazo,plano,validacao_metadados)
    values (p_lease_token,helena_v2._config_hash(p_resultado),
      r.pedido_id,p.fundador_uid,r.config_revision_id,r.config_hash,r.eventos_hash,
      r.contexto_hash,
      v_tipo,v_perguntas,p_resultado->>'resumo',p_resultado->>'empresa_id',
      p_resultado->>'titulo',(p_resultado->>'prazo')::timestamptz,
      case when v_tipo='PROPOR' then p_resultado->'plano' else null end,
      p_resultado->'validacao_metadados')
    on conflict (pedido_id,config_revision_id,config_hash,eventos_hash,contexto_hash) do nothing;
  select * into x from helena_v2.pedido_entrada_proposta
    where pedido_id=r.pedido_id and config_revision_id=r.config_revision_id
      and config_hash=r.config_hash and eventos_hash=r.eventos_hash
      and contexto_hash=r.contexto_hash;
  if x.tipo is distinct from v_tipo or x.perguntas is distinct from v_perguntas
     or x.resumo is distinct from p_resultado->>'resumo'
     or x.empresa_id is distinct from p_resultado->>'empresa_id'
     or x.titulo is distinct from p_resultado->>'titulo'
     or x.prazo is distinct from (p_resultado->>'prazo')::timestamptz
     or x.plano is distinct from (case when v_tipo='PROPOR' then p_resultado->'plano' else null end)
     or x.validacao_metadados is distinct from p_resultado->'validacao_metadados' then
    raise exception 'PEDIDO_PROPOSTA_DIVERGENTE' using errcode='23505';
  end if;
  delete from helena_v2.pedido_entrada_reserva where pedido_id=r.pedido_id;
  return to_jsonb(x);
end;
$f$;

create function helena_v2.ler_proposta_pedido(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada; x helena_v2.pedido_entrada_proposta;
  v_resumo jsonb; v_atual boolean;
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'ENTRADA_INVALIDA' using errcode='22023'; end if;
  select * into p from helena_v2.pedido_entrada
    where request_id=p_request_id and fundador_uid=auth.uid();
  if not found then return null; end if;
  v_resumo := helena_v2._resumo_pedido_entrada(p.id,true);
  select * into x from helena_v2.pedido_entrada_proposta as proposta
    where proposta.pedido_id=p.id
    order by helena_v2._pedido_proposta_atual(proposta) desc,
      proposta.criado_em desc,proposta.id desc limit 1;
  if not found then return v_resumo; end if;
  v_atual := helena_v2._pedido_proposta_atual(x);
  return v_resumo || jsonb_build_object('perguntas',x.perguntas,
    'proposta_helena',(to_jsonb(x)-'lease_token'-'resultado_hash'-'fundador_uid')
      || jsonb_build_object('atual',v_atual));
end;
$f$;

create function helena_v2.confirmar_proposta_pedido(
  p_request_id uuid,p_proposta_id uuid
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,pg_temp as $f$
declare p helena_v2.pedido_entrada; x helena_v2.pedido_entrada_proposta;
  v_resumo jsonb;
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  if p_request_id is null or p_proposta_id is null then
    raise exception 'ENTRADA_INVALIDA' using errcode='22023';
  end if;
  select * into p from helena_v2.pedido_entrada
    where request_id=p_request_id and fundador_uid=auth.uid() for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='22023'; end if;
  select * into x from helena_v2.pedido_entrada_proposta
    where id=p_proposta_id and pedido_id=p.id and fundador_uid=auth.uid();
  if not found then raise exception 'PEDIDO_PROPOSTA_NAO_ENCONTRADA' using errcode='22023'; end if;
  if x.tipo<>'PROPOR' or x.perguntas<>'[]'::jsonb
     or nullif(x.validacao_metadados->>'bloqueio','') is not null then
    raise exception 'PEDIDO_PROPOSTA_NAO_CONFIRMAVEL' using errcode='23514';
  end if;
  lock table public.checkpoint_mestre,public.decisoes,public.portfolio in share mode;
  if p.estado='RECEBIDO' and not helena_v2._pedido_proposta_atual(x) then
    raise exception 'PEDIDO_PROPOSTA_OBSOLETA' using errcode='40001';
  end if;
  v_resumo := helena_v2.confirmar_plano_pedido(
    p_request_id,x.empresa_id,x.titulo,x.prazo,x.plano,x.config_revision_id);
  return v_resumo;
end;
$f$;

create function helena_v2.listar_planos_pedido_pendentes(p_limite integer default 50)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $f$
declare v_itens jsonb;
begin
  if helena_v2._conta()<>'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'LIMITE_INVALIDO' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('pedido_id',q.pedido_id,
    'request_id',q.request_id) order by q.confirmado_em,q.pedido_id),'[]'::jsonb)
    into v_itens from (select pl.pedido_id,p.request_id,pl.confirmado_em
      from helena_v2.pedido_entrada_plano pl
      join helena_v2.pedido_entrada p on p.id=pl.pedido_id
      where pl.card_id is null and p.estado='PLANO_CONFIRMADO'
      order by pl.confirmado_em,pl.pedido_id limit p_limite) q;
  return jsonb_build_object('itens',v_itens,'limite',p_limite);
end;
$f$;

revoke all on helena_v2.pedido_entrada_reserva,helena_v2.pedido_entrada_resposta_bruta,
  helena_v2.pedido_entrada_proposta from public,anon,authenticated,service_role;
revoke all on function helena_v2._pedido_proposta_imutavel(),
  helena_v2._pedido_proposta_eventos(uuid),
  helena_v2._pedido_proposta_contexto(uuid),
  helena_v2._pedido_proposta_atual(helena_v2.pedido_entrada_proposta),
  helena_v2._pedido_reserva_valida(uuid,uuid),
  helena_v2.listar_trabalho_proposta_pedido(integer),
  helena_v2.reservar_proposta_pedido(uuid,integer),
  helena_v2.registrar_resposta_bruta_pedido(uuid,uuid,jsonb),
  helena_v2.registrar_proposta_pedido(uuid,uuid,jsonb),
  helena_v2.ler_proposta_pedido(uuid),
  helena_v2.confirmar_proposta_pedido(uuid,uuid),
  helena_v2.listar_planos_pedido_pendentes(integer)
  from public,anon,authenticated,service_role;
grant execute on function helena_v2.listar_trabalho_proposta_pedido(integer),
  helena_v2.reservar_proposta_pedido(uuid,integer),
  helena_v2.registrar_resposta_bruta_pedido(uuid,uuid,jsonb),
  helena_v2.registrar_proposta_pedido(uuid,uuid,jsonb),
  helena_v2.listar_planos_pedido_pendentes(integer) to service_role;
grant execute on function helena_v2.ler_proposta_pedido(uuid),
  helena_v2.confirmar_proposta_pedido(uuid,uuid) to authenticated;

-- 0023 já confirmou o plano por ordem explícita do fundador. O card conserva
-- RASCUNHO até LER_DE_VOLTA, depois C02 segue para VALIDANDO_PLANO; o motor
-- ainda precisa emitir PLANO_VALIDO. Não pedir uma segunda confirmação C01.
create or replace function helena_v2.consumir_plano_pedido(p_pedido_id uuid,p_roteiro jsonb)
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
    helena_v2._pedido_ordem(p),0,false);
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
