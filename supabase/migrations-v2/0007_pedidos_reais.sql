-- O QUE É: Solicitações autenticadas de cards reais. A captura é conferida contra public.*
-- antes de gravar e novamente, sob locks, antes de consumir. Nenhuma fonte é criada aqui.
create table helena_v2.solicitacao_card_real (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'supabase' check (origem = 'supabase'),
  chave_origem text not null,
  business_id text not null,
  solicitado_por uuid not null,
  chave_idempotencia text not null,
  titulo text not null,
  pedido_original text not null,
  prazo timestamptz not null,
  plano jsonb not null,
  dados_reais jsonb not null,
  config_revision_id uuid not null references helena_v2.configuracao(id),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default clock_timestamp(),
  consumida_em timestamptz,
  card_id uuid unique references helena_v2.card(id),
  roteiro_hash text,
  unique (solicitado_por, chave_idempotencia),
  check ((consumida_em is null and card_id is null and roteiro_hash is null)
      or (consumida_em is not null and card_id is not null and roteiro_hash is not null))
);
create index solicitacao_card_real_tarefa on helena_v2.solicitacao_card_real(chave_origem, criado_em desc);
alter table helena_v2.solicitacao_card_real enable row level security;
create policy solicitacao_card_real_fundador on helena_v2.solicitacao_card_real
  for select to authenticated using (solicitado_por = auth.uid() and helena_v2.sou_fundador());

create function helena_v2._real_proteger_solicitacao() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'SOLICITACAO_HISTORICO_IMUTAVEL' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'consumida_em' - 'card_id' - 'roteiro_hash')
     is distinct from (to_jsonb(old) - 'consumida_em' - 'card_id' - 'roteiro_hash')
     or old.consumida_em is not null or new.consumida_em is null or new.card_id is null
     or new.roteiro_hash is null then
    raise exception 'SOLICITACAO_IMUTAVEL' using errcode = '42501';
  end if;
  return new;
end;
$f$;
create trigger solicitacao_card_real_imutavel before update or delete on helena_v2.solicitacao_card_real
  for each row execute function helena_v2._real_proteger_solicitacao();
create trigger solicitacao_card_real_sem_truncate before truncate on helena_v2.solicitacao_card_real
  for each statement execute function helena_v2._real_proteger_solicitacao();

-- Compara as colunas lidas pela FonteSupabase, sem confiar em hash informado pelo chamador.
-- O bloqueio de linhas faz a comparação e a criação usarem o mesmo estado da tarefa.
create function helena_v2._real_conferir_captura(p_tarefa_id text, p_plano jsonb, p_dados jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare
  c jsonb := p_dados -> 'captura';
  t jsonb; b jsonb; ck jsonb; d jsonb; j jsonb;
  did text; rotulo text; jid text; fonte_id text; refs jsonb; vistos jsonb; q jsonb; payload jsonb;
  esperado jsonb; pacote jsonb; ordem jsonb; esperado_proveniencia jsonb; marca jsonb;
  esperado_decisoes jsonb;
  ativos bigint; maior_versao bigint; atuais bigint;
begin
  if jsonb_typeof(p_plano) is distinct from 'object'
     or jsonb_typeof(p_plano -> 'etapas') is distinct from 'array'
     or jsonb_array_length(p_plano -> 'etapas') = 0
     or jsonb_typeof(p_plano -> 'decisoes') is distinct from 'array'
     or jsonb_typeof(p_plano -> 'entradas_externas') is distinct from 'object'
     or jsonb_typeof(p_plano -> 'empresas') is distinct from 'array'
     or jsonb_typeof(p_dados) is distinct from 'object' or jsonb_typeof(c) is distinct from 'object'
     or jsonb_typeof(p_dados -> 'pedido') is distinct from 'object'
     or jsonb_typeof(p_dados -> 'fontes_importadas') is distinct from 'object'
     or jsonb_typeof(p_dados -> 'decisoes') is distinct from 'array'
     or jsonb_typeof(p_dados -> 'entradas_externas') is distinct from 'object'
     or jsonb_typeof(p_dados -> 'proveniencia') is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_dados)) <> 6
     or c ->> 'fonte' is distinct from 'management_read_only'
     or c #>> '{projeto,ref}' is distinct from 'wxkgrykduqtsgmjkzlou'
     or c ->> 'observado_em' is null
     or (select count(*) from jsonb_object_keys(c)) <> 10
     or jsonb_typeof(c -> 'proveniencia') is distinct from 'object'
     or jsonb_typeof(c -> 'decisoes') is distinct from 'array'
     or jsonb_typeof(c -> 'entradas_externas') is distinct from 'object' then
    raise exception 'CAPTURA_REAL_INVALIDA' using errcode = '22023';
  end if;
  if jsonb_array_length(p_plano -> 'decisoes') > 20
     or (select count(*) from jsonb_object_keys(p_plano -> 'entradas_externas')) > 20 then
    raise exception 'CAPTURA_REAL_EXCEDE_LIMITE' using errcode = '22023';
  end if;
  -- SHARE conflita com INSERT/UPDATE (ROW EXCLUSIVE): a conferência e o card
  -- usam o mesmo checkpoint até o commit da solicitação/consumo.
  lock table public.checkpoint_mestre in share mode;
  select count(*) filter (where status='ATIVO'),max(versao) into ativos,maior_versao
    from public.checkpoint_mestre;
  if ativos <> 1 then
    raise exception 'CHECKPOINT_REAL_AMBIGUO' using errcode = '40001';
  end if;
  select count(*) into atuais from public.checkpoint_mestre_atual;
  if atuais <> 1 then
    raise exception 'CHECKPOINT_REAL_AMBIGUO' using errcode = '40001';
  end if;
  select to_jsonb(x) into ck from (
    select checkpoint_id,versao,status,resumo_executivo,validado_em,atualizado_em,
           checkpoint_anterior_id from public.checkpoint_mestre_atual where status='ATIVO'
  ) x;
  if ck is null or ck is distinct from c -> 'checkpoint'
     or (ck ->> 'versao')::bigint is distinct from maior_versao then
    raise exception 'CHECKPOINT_REAL_MUDOU' using errcode = '40001';
  end if;
  perform 1 from public.checkpoint_mestre where checkpoint_id=ck ->> 'checkpoint_id'
    and status='ATIVO' for share;
  if not found then raise exception 'CHECKPOINT_REAL_MUDOU' using errcode = '40001'; end if;
  select to_jsonb(x) into t from (
    select task_id,business_id,tarefa,status,prioridade,prazo,definicao_de_pronto,
           row_version,criado_em,atualizado_em from public.tarefas
    where task_id=p_tarefa_id for share
  ) x;
  if t is null or t is distinct from c -> 'tarefa'
     or coalesce(t ->> 'status','') not in ('NÃO INICIADA','EM EXECUÇÃO','ABERTO')
     or t ->> 'business_id' is null or t ->> 'tarefa' is null
     or c ->> 'business_id' is distinct from t ->> 'business_id'
     or c #>> '{proveniencia,tarefa,pk}' is distinct from p_tarefa_id
     or c #>> '{proveniencia,tarefa,row_version}' is distinct from t ->> 'row_version' then
    raise exception 'TAREFA_REAL_MUDOU' using errcode = '40001';
  end if;
  select jsonb_build_object('business_id',p.business_id,'negocio',p.negocio,
    'estagio',p.estagio,'ativo',p.ativo,'publico',p.publico,
    'portfolio_row_version',p.row_version,'brand_identity',p.brand_identity)
    into b from public.portfolio p where p.business_id=t ->> 'business_id' for share;
  if b is null or b is distinct from c -> 'empresa' or b ->> 'ativo' is distinct from 'SIM'
     or c #>> '{proveniencia,empresa,pk}' is distinct from b ->> 'business_id'
     or c #>> '{proveniencia,empresa,row_version}' is distinct from b ->> 'portfolio_row_version' then
    raise exception 'EMPRESA_REAL_MUDOU' using errcode = '40001';
  end if;
  marca := b -> 'brand_identity';
  if jsonb_typeof(marca) is distinct from 'object'
     or marca ->> 'status' is distinct from 'APPROVED'
     or marca ->> 'business_id' is distinct from b ->> 'business_id'
     or jsonb_typeof(marca -> 'schema_version') is distinct from 'number'
     or coalesce(marca ->> 'schema_version','') !~ '^[1-9][0-9]*$'
     or jsonb_typeof(marca -> 'name') is distinct from 'string'
     or nullif(btrim(coalesce(marca ->> 'name','')),'') is null then
    raise exception 'MARCA_SEM_APROVACAO' using errcode = '22023';
  end if;
  if not (p_plano -> 'empresas') ? (b ->> 'business_id') then
    raise exception 'PLANO_FORA_DA_EMPRESA' using errcode = '22023';
  end if;
  if p_dados #>> '{pedido,ordem_de_servico,pedido_original}' is distinct from t ->> 'tarefa'
     or p_dados #>> array['fontes_importadas','FON-PEDIDO-' || p_tarefa_id] is distinct from t ->> 'tarefa' then
    raise exception 'PEDIDO_REAL_DIVERGENTE' using errcode = '22023';
  end if;
  esperado_proveniencia := jsonb_build_object(
    'project_ref','wxkgrykduqtsgmjkzlou','checkpoint_id',ck -> 'checkpoint_id',
    'observado_em',c -> 'observado_em','tarefa_id',t -> 'task_id',
    'tarefa_row_version',t -> 'row_version','business_id',b -> 'business_id',
    'hash_sha256',c #> '{proveniencia,hash_sha256}');
  if coalesce(c #>> '{proveniencia,hash_sha256}','') !~ '^[0-9a-f]{64}$'
     or p_dados -> 'proveniencia' is distinct from esperado_proveniencia
     or jsonb_typeof(p_dados #> '{pedido,ordem_de_servico,como_e_o_pronto}') is distinct from 'array'
     or jsonb_typeof(p_dados #> '{pedido,ordem_de_servico,nao_pode}') is distinct from 'array' then
    raise exception 'PROVENIENCIA_REAL_DIVERGENTE' using errcode = '22023';
  end if;
  pacote := jsonb_build_object('empresa',b -> 'business_id','nome',b -> 'negocio',
    'estado','CONFIRMADO','fonte_importada_id','FON-PACOTE-' || (b ->> 'business_id'),
    'dados_do_portfolio',b,'decisoes',p_plano -> 'decisoes');
  ordem := jsonb_build_object('empresa',b -> 'business_id',
    'pedido_original',t -> 'tarefa','o_que_quer',t -> 'tarefa',
    'prazo',t -> 'prazo','prioridade_na_fonte',t -> 'prioridade',
    'definicao_de_pronto_na_fonte',t -> 'definicao_de_pronto',
    'fontes_que_pode_ler','[]'::jsonb,
    'como_e_o_pronto',p_dados #> '{pedido,ordem_de_servico,como_e_o_pronto}',
    'nao_pode',p_dados #> '{pedido,ordem_de_servico,nao_pode}');
  esperado := jsonb_build_object('empresa',b -> 'business_id','criado_em',t -> 'criado_em',
    'ordem_de_servico',ordem,'plano',p_plano,'pacote_da_empresa',pacote);
  if p_dados -> 'pedido' is distinct from esperado then
    raise exception 'PEDIDO_REAL_DIVERGENTE' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_dados -> 'fontes_importadas')) <>
      2 + (select count(*) from jsonb_object_keys(p_plano -> 'entradas_externas'))
     or (p_dados #>> array['fontes_importadas','FON-PACOTE-' || (b ->> 'business_id')])::jsonb
        is distinct from b then
    raise exception 'FONTES_REAIS_DIVERGENTES' using errcode = '22023';
  end if;
  if jsonb_array_length(c -> 'decisoes') <> jsonb_array_length(p_plano -> 'decisoes')
     or jsonb_array_length(p_dados -> 'decisoes') <> jsonb_array_length(p_plano -> 'decisoes')
     or (select count(*) from jsonb_object_keys(c -> 'entradas_externas')) <>
        (select count(*) from jsonb_object_keys(p_plano -> 'entradas_externas'))
     or (select count(*) from jsonb_object_keys(p_dados -> 'entradas_externas')) <>
        (select count(*) from jsonb_object_keys(p_plano -> 'entradas_externas')) then
    raise exception 'FONTES_REAIS_DIVERGENTES' using errcode = '22023';
  end if;
  for did in select jsonb_array_elements_text(p_plano -> 'decisoes') loop
    select to_jsonb(x) into d from (
      select decision_id,decisao,row_version,status,business_id
      from public.decisoes where decision_id=did for share
    ) x;
    if d is null or coalesce(d ->> 'status','') not in ('ATIVO','ATIVA','VIGENTE')
       or (d ->> 'business_id' is not null and d ->> 'business_id' <> b ->> 'business_id')
       or not (c -> 'decisoes') @> jsonb_build_array(d) then
      raise exception 'DECISAO_REAL_MUDOU' using errcode = '40001';
    end if;
    if not (p_dados -> 'decisoes') @> jsonb_build_array(jsonb_build_object(
           'id',did,'versao',d -> 'row_version','row_version',d -> 'row_version',
           'texto',d -> 'decisao')) then
      raise exception 'DECISAO_DERIVADA_DIVERGENTE' using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct x) from jsonb_array_elements_text(p_plano -> 'decisoes') x)
     <> jsonb_array_length(p_plano -> 'decisoes') then
    raise exception 'DECISOES_REPETIDAS' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.d -> 'decision_id',
      'versao',x.d -> 'row_version','row_version',x.d -> 'row_version','texto',x.d -> 'decisao')
      order by x.n),'[]'::jsonb) into esperado_decisoes
    from jsonb_array_elements(c -> 'decisoes') with ordinality as x(d,n);
  if p_dados -> 'decisoes' is distinct from esperado_decisoes
     or exists (select 1 from jsonb_array_elements(c -> 'decisoes') with ordinality as x(d,n)
                where x.d ->> 'decision_id' is distinct from
                  p_plano -> 'decisoes' ->> (x.n::integer - 1)) then
    raise exception 'DECISOES_DERIVADAS_DIVERGENTES' using errcode = '22023';
  end if;
  for rotulo,jid in select key, value #>> '{}' from jsonb_each(p_plano -> 'entradas_externas') loop
    select to_jsonb(x) into j from (
      select job_id,task_id,business_id,agent_id,status,approval_status,
             result_payload,result_summary,evidence_refs,updated_at
      from public.agent_jobs where job_id=jid for share
    ) x;
    if j is null or j ->> 'business_id' is distinct from b ->> 'business_id'
       or j ->> 'status' is distinct from 'COMPLETED'
       or j ->> 'approval_status' is distinct from 'APPROVED'
       or c #> array['entradas_externas',rotulo] is distinct from j then
      raise exception 'JOB_REAL_MUDOU' using errcode = '40001';
    end if;
    perform 1 from public.tarefas origem where origem.task_id=j ->> 'task_id'
      and origem.business_id=b ->> 'business_id' for share;
    if not found then raise exception 'JOB_ORIGEM_MUDOU' using errcode = '40001'; end if;
    payload := j -> 'result_payload'; q := payload -> 'quality_review';
    refs := j -> 'evidence_refs'; vistos := q -> 'inspected_evidence_refs';
    if jsonb_typeof(payload) is distinct from 'object'
       or payload -> 'review_pending' is distinct from 'false'::jsonb
       or jsonb_typeof(q) is distinct from 'object'
       or q -> 'requirements_met' is distinct from 'true'::jsonb
       or coalesce(payload ->> 'reviewer_agent_id','') !~ '^AGT-[0-9]{2}$'
       or payload ->> 'reviewer_agent_id' is not distinct from j ->> 'agent_id'
       or nullif(btrim(coalesce(j ->> 'agent_id','')),'') is null
       or jsonb_typeof(payload -> 'reviewed_by') is distinct from 'string'
       or nullif(btrim(payload ->> 'reviewed_by'),'') is null
       or jsonb_typeof(refs) is distinct from 'array' or jsonb_array_length(refs) = 0
       or jsonb_typeof(vistos) is distinct from 'array'
       or jsonb_array_length(refs) is distinct from jsonb_array_length(vistos)
       or exists (select 1 from jsonb_array_elements(refs) as r(v)
                  where jsonb_typeof(r.v) is distinct from 'string')
       or exists (select 1 from jsonb_array_elements(vistos) as r(v)
                  where jsonb_typeof(r.v) is distinct from 'string')
       or exists (select 1 from jsonb_array_elements_text(refs) r
                  where not vistos ? r or r = '')
       or exists (select 1 from jsonb_array_elements_text(vistos) r where not refs ? r)
       or (select count(distinct r) from jsonb_array_elements_text(refs) r) <> jsonb_array_length(refs) then
      raise exception 'JOB_SEM_REVISAO_DOCUMENTAL' using errcode = '22023';
    end if;
    if jsonb_typeof(payload -> 'delivery') is distinct from 'object'
       or jsonb_typeof(payload #> '{delivery,content}') is distinct from 'string' then
      raise exception 'JOB_SEM_CONTEUDO_DOCUMENTAL' using errcode = '22023';
    end if;
    fonte_id := 'FON-JOB-' || jid;
    esperado := jsonb_build_object('delivery',payload -> 'delivery',
      'quality_review',q,'review_reason',payload -> 'review_reason','evidence_refs',refs);
    if (p_dados #>> array['fontes_importadas',fonte_id])::jsonb is distinct from esperado
       or p_dados #> array['entradas_externas',rotulo] is distinct from
          jsonb_build_object('job_id',jid,'fonte_ids',jsonb_build_array(fonte_id),
            'conteudo',payload -> 'delivery','evidence_refs',refs,'updated_at',j -> 'updated_at') then
      raise exception 'FONTE_JOB_DIVERGENTE' using errcode = '22023';
    end if;
  end loop;
  return jsonb_build_object('tarefa',t,'empresa',b);
end;
$f$;

create function helena_v2._real_json_solicitacao(p helena_v2.solicitacao_card_real) returns jsonb
language sql stable set search_path = pg_catalog, pg_temp as $f$
  select to_jsonb(p);
$f$;

create function helena_v2.solicitar_card_real(
  p_tarefa_id text,p_prazo timestamptz,p_plano jsonb,p_dados_reais jsonb,
  p_config_revision_id uuid,p_chave_idempotencia text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v jsonb; atual helena_v2.solicitacao_card_real; v_hash text; v_estado text;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_tarefa_id is null or p_tarefa_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'
     or p_chave_idempotencia is null or length(btrim(p_chave_idempotencia)) not between 1 and 160
     or not helena_v2._prazo_valido(p_prazo)
     or octet_length(p_plano::text) > 200000
     or octet_length(p_dados_reais::text) > 1000000 then
    raise exception 'SOLICITACAO_PARAMETROS_INVALIDOS' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('tarefa_id',p_tarefa_id,
      'prazo',p_prazo,'plano',p_plano,'dados_reais',p_dados_reais,
      'config_revision_id',p_config_revision_id)::text,'UTF8')),'hex');
  select * into atual from helena_v2.solicitacao_card_real
    where solicitado_por=auth.uid() and chave_idempotencia=p_chave_idempotencia;
  if found then
    if atual.payload_hash is distinct from v_hash then
      raise exception 'CHAVE_IDEMPOTENCIA_PAYLOAD_DIVERGENTE' using errcode = '23505';
    end if;
    return helena_v2._real_json_solicitacao(atual);
  end if;
  select c.estado into v_estado from helena_v2.configuracao c
    join helena_v2.configuracao_ponteiro cp on cp.ativa_id=c.id
    where c.id=p_config_revision_id for share of c,cp;
  if v_estado is distinct from 'VALIDADA' then
    raise exception 'CONFIG_REVISAO_NAO_ATIVA' using errcode = '23514';
  end if;
  v := helena_v2._real_conferir_captura(p_tarefa_id,p_plano,p_dados_reais);
  insert into helena_v2.solicitacao_card_real
    (chave_origem,business_id,solicitado_por,chave_idempotencia,titulo,pedido_original,
     prazo,plano,dados_reais,config_revision_id,payload_hash)
  values (p_tarefa_id,v #>> '{empresa,business_id}',auth.uid(),p_chave_idempotencia,
          v #>> '{tarefa,tarefa}',v #>> '{tarefa,tarefa}',p_prazo,p_plano,p_dados_reais,
          p_config_revision_id,v_hash)
  on conflict (solicitado_por,chave_idempotencia) do nothing returning * into atual;
  if not found then
    select * into atual from helena_v2.solicitacao_card_real
      where solicitado_por=auth.uid() and chave_idempotencia=p_chave_idempotencia;
    if atual.payload_hash is distinct from v_hash then
      raise exception 'CHAVE_IDEMPOTENCIA_PAYLOAD_DIVERGENTE' using errcode = '23505';
    end if;
  end if;
  return helena_v2._real_json_solicitacao(atual);
end;
$f$;

create function helena_v2.ler_solicitacao_card_real(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare p helena_v2.solicitacao_card_real;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into p from helena_v2.solicitacao_card_real where id=p_id;
  return case when found then helena_v2._real_json_solicitacao(p) else null end;
end;
$f$;

create function helena_v2.consumir_solicitacao_card_real(p_id uuid,p_roteiro jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare p helena_v2.solicitacao_card_real; v jsonb; ordem jsonb; hash_roteiro text; v_estado text;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if jsonb_typeof(p_roteiro) is distinct from 'object'
     or jsonb_typeof(p_roteiro -> 'etapas') is distinct from 'array'
     or octet_length(p_roteiro::text) > 200000 then
    raise exception 'ROTEIRO_REAL_INVALIDO' using errcode = '22023';
  end if;
  hash_roteiro := encode(sha256(convert_to(p_roteiro::text,'UTF8')),'hex');
  select * into p from helena_v2.solicitacao_card_real where id=p_id for update;
  if not found then raise exception 'SOLICITACAO_INEXISTENTE' using errcode = '22023'; end if;
  if p.card_id is not null then
    if p.roteiro_hash is distinct from hash_roteiro then
      raise exception 'ROTEIRO_REAL_DIVERGENTE' using errcode = '23505';
    end if;
    return jsonb_build_object('card_id',p.card_id,'novo',false);
  end if;
  if jsonb_array_length(p_roteiro -> 'etapas') <> jsonb_array_length(p.plano -> 'etapas')
     or exists (
       select 1 from jsonb_array_elements(p_roteiro -> 'etapas') with ordinality as r(e,n)
       where r.e ->> 'id' is distinct from p.plano -> 'etapas' -> (r.n::integer - 1) ->> 'id'
          or (r.e ? 'servico' and r.e ->> 'servico' is distinct from
              p.plano -> 'etapas' -> (r.n::integer - 1) ->> 'servico')
     ) then
    raise exception 'ROTEIRO_REAL_DIVERGENTE' using errcode = '22023';
  end if;
  select c.estado into v_estado from helena_v2.configuracao c
    join helena_v2.configuracao_ponteiro cp on cp.ativa_id=c.id
    where c.id=p.config_revision_id for share of c,cp;
  if v_estado is distinct from 'VALIDADA' then
    raise exception 'CONFIG_REVISAO_NAO_ATIVA' using errcode = '23514';
  end if;
  perform helena_v2._real_conferir_captura(p.chave_origem,p.plano,p.dados_reais);
  ordem := p.plano || jsonb_build_object(
    'config_revision_id',p.config_revision_id,'modo_contexto','real',
    'origem',p.origem,'chave_origem',p.chave_origem,'pedido_original',p.pedido_original,
    'business_id',p.business_id,'dados_reais',p.dados_reais);
  v := helena_v2.criar_card('solicitacao_card_real',p.id::text,p.pedido_original,
    p.titulo,p.prazo,p_roteiro,p.business_id,ordem,0,true);
  if v ->> 'card_id' is null or (v ->> 'novo')::boolean is not true then
    raise exception 'CARD_REAL_NAO_CRIADO' using errcode = '23505';
  end if;
  update helena_v2.solicitacao_card_real set card_id=(v ->> 'card_id')::uuid,
    consumida_em=clock_timestamp(),roteiro_hash=hash_roteiro where id=p.id;
  return v;
end;
$f$;

-- Conferência privada compartilhada pelo portão do Motor e pelas transições
-- positivas do banco. Permanece na transação até a atualização do estado.
create function helena_v2._real_conferir_card_vinculado(p_card_id uuid) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare p helena_v2.solicitacao_card_real; c helena_v2.card; ordem jsonb; v_estado text;
begin
  select * into p from helena_v2.solicitacao_card_real
    where card_id=p_card_id and consumida_em is not null for share;
  if not found then
    raise exception 'CARD_REAL_SEM_SOLICITACAO_CONSUMIDA' using errcode = '22023';
  end if;
  select * into c from helena_v2.card where id=p_card_id for share;
  ordem := p.plano || jsonb_build_object(
    'config_revision_id',p.config_revision_id,'modo_contexto','real',
    'origem',p.origem,'chave_origem',p.chave_origem,'pedido_original',p.pedido_original,
    'business_id',p.business_id,'dados_reais',p.dados_reais);
  if c.id is null or c.empresa is distinct from p.business_id
     or c.ordem_de_servico is distinct from ordem
     or c.ordem_de_servico ->> 'config_revision_id' is distinct from p.config_revision_id::text then
    raise exception 'CARD_REAL_VINCULO_DIVERGENTE' using errcode = '42501';
  end if;
  select estado into v_estado from helena_v2.configuracao where id=p.config_revision_id for share;
  if v_estado is null or v_estado not in ('VALIDADA','APOSENTADA') then
    raise exception 'CONFIG_PIN_REAL_INVALIDO' using errcode = '42501';
  end if;
  perform helena_v2._real_conferir_captura(p.chave_origem,p.plano,p.dados_reais);
  return true;
end;
$f$;

-- O Motor faz a leitura e a aplicação na mesma transação. A função pública
-- continua exclusiva do service_role; o gatilho chama só a função privada.
create function helena_v2.conferir_fontes_card_real(p_card_id uuid) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  return helena_v2._real_conferir_card_vinculado(p_card_id);
end;
$f$;

-- Toda promoção real a APROVADA/PRONTA é conferida, inclusive eventos
-- chamados diretamente por fundador ou service_role fora do Motor. Caminhos
-- de cancelamento, ajuste e falha continuam disponíveis com fonte antiga.
create function helena_v2._real_proteger_promocao() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare v_card_id uuid; v_ordem jsonb;
begin
  if tg_table_name = 'etapa' then
    if new.estado is not distinct from old.estado
       or new.estado not in ('APROVADA','PRONTA') then return new; end if;
    v_card_id := new.card_id;
    select ordem_de_servico into v_ordem from helena_v2.card where id=v_card_id;
  elsif tg_table_name = 'card' then
    if new.estado is distinct from 'PRONTO' or old.estado = 'PRONTO' then return new; end if;
    v_card_id := new.id;
    v_ordem := old.ordem_de_servico;
  else
    raise exception 'GATILHO_REAL_INVALIDO' using errcode = 'XX000';
  end if;
  if v_ordem ->> 'modo_contexto' = 'real' or exists (
      select 1 from helena_v2.solicitacao_card_real where card_id=v_card_id) then
    if tg_table_name = 'card' then
      if new.ordem_de_servico is distinct from old.ordem_de_servico then
        raise exception 'CARD_REAL_ORDEM_MUDOU' using errcode = '42501';
      end if;
    end if;
    perform helena_v2._real_conferir_card_vinculado(v_card_id);
  end if;
  return new;
end;
$f$;
create trigger b_real_proteger_promocao before update on helena_v2.etapa
  for each row execute function helena_v2._real_proteger_promocao();
create trigger b_real_proteger_promocao before update on helena_v2.card
  for each row execute function helena_v2._real_proteger_promocao();

-- A porta antiga deduplica só pelo número da mensagem, sem comparar carga.
-- Após esta migração, apenas a função definer acima pode chamá-la.
revoke execute on function helena_v2.criar_card(text,text,text,text,timestamptz,jsonb,text,jsonb,integer,boolean)
  from public,anon,authenticated,service_role;
revoke all on helena_v2.solicitacao_card_real from public,anon,authenticated,service_role;
revoke execute on function helena_v2._real_proteger_solicitacao(),
  helena_v2._real_conferir_captura(text,jsonb,jsonb),
  helena_v2._real_conferir_card_vinculado(uuid),
  helena_v2._real_proteger_promocao(),
  helena_v2._real_json_solicitacao(helena_v2.solicitacao_card_real),
  helena_v2.solicitar_card_real(text,timestamptz,jsonb,jsonb,uuid,text),
  helena_v2.ler_solicitacao_card_real(uuid),
  helena_v2.consumir_solicitacao_card_real(uuid,jsonb),
  helena_v2.conferir_fontes_card_real(uuid)
  from public,anon,authenticated,service_role;
grant select on helena_v2.solicitacao_card_real to authenticated;
grant execute on function helena_v2.solicitar_card_real(text,timestamptz,jsonb,jsonb,uuid,text)
  to authenticated;
grant execute on function helena_v2.ler_solicitacao_card_real(uuid),
  helena_v2.consumir_solicitacao_card_real(uuid,jsonb),
  helena_v2.conferir_fontes_card_real(uuid) to service_role;
