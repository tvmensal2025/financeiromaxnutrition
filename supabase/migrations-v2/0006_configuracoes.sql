-- O que é: revisões versionadas das configurações da Helena v2, validação pelo serviço e vínculo durável com cada card.
-- Como mudar: uma mudança na máquina exige nova migração e prova; esta revisão só ativa conteúdo compatível com a máquina já instalada.

create table helena_v2.configuracao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 160),
  conteudo jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  versao integer not null default 1 check (versao > 0),
  estado text not null check (estado in ('RASCUNHO', 'VALIDADA', 'APOSENTADA')),
  tecnica boolean not null default false,
  base_id uuid references helena_v2.configuracao(id),
  criada_por uuid,
  hash_sha256 text,
  impressao_maquina text,
  criada_em timestamptz not null default clock_timestamp(),
  alterada_em timestamptz not null default clock_timestamp(),
  validada_em timestamptz,
  aposentada_em timestamptz,
  check ((estado = 'RASCUNHO' and hash_sha256 is null and validada_em is null)
      or (estado = 'VALIDADA' and hash_sha256 is not null and validada_em is not null)
      or estado = 'APOSENTADA'),
  check (not tecnica or (estado in ('VALIDADA', 'APOSENTADA') and criada_por is null))
);

create table helena_v2.configuracao_ponteiro (
  unico boolean primary key default true check (unico),
  tecnica_id uuid references helena_v2.configuracao(id),
  ativa_id uuid references helena_v2.configuracao(id),
  alterada_em timestamptz not null default clock_timestamp()
);
insert into helena_v2.configuracao_ponteiro (unico) values (true);

create table helena_v2.configuracao_validacao (
  id bigint generated always as identity primary key,
  configuracao_id uuid not null references helena_v2.configuracao(id),
  versao integer not null,
  hash_sha256 text not null,
  solicitada_em timestamptz not null default clock_timestamp(),
  concluida_em timestamptz,
  cancelada_em timestamptz,
  resultado jsonb,
  check (not (concluida_em is not null and cancelada_em is not null))
);
create unique index configuracao_validacao_pendente on helena_v2.configuracao_validacao(configuracao_id)
  where concluida_em is null and cancelada_em is null;

create or replace function helena_v2._config_hash(p_conteudo jsonb) returns text
language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select encode(sha256(convert_to(p_conteudo::text, 'UTF8')), 'hex');
$f$;

create or replace function helena_v2._config_maquina(p_conteudo jsonb) returns jsonb
language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(p_conteudo) as d(k,v) where k like 'helena-v2/maquina/%';
$f$;

create or replace function helena_v2._config_bundle_valido(p_conteudo jsonb) returns boolean
language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select jsonb_typeof(p_conteudo) = 'object'
     and p_conteudo <> '{}'::jsonb
     and not exists (
       select 1 from jsonb_object_keys(p_conteudo) as k(caminho)
       where caminho !~ '^helena-v2/((servicos|organograma|models)\.yaml|(agents|deliverables|playbooks)/[a-z0-9_-]+\.yaml|schemas/[a-z0-9_-]+\.schema\.json|maquina/(passagens|vocabulario)\.yaml|maquina/jornada\.schema\.json)$'
     );
$f$;

create or replace function helena_v2._config_maquina_completa(p_conteudo jsonb) returns boolean
language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select p_conteudo ?& array['helena-v2/maquina/passagens.yaml',
                             'helena-v2/maquina/vocabulario.yaml',
                             'helena-v2/maquina/jornada.schema.json'];
$f$;

-- Impressões dos três documentos da máquina que gerou a 0002 deste conjunto.
-- Um bootstrap diferente exige outra migração da máquina e nova prova.
create or replace function helena_v2._config_maquina_instalada(p_conteudo jsonb) returns boolean
language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select helena_v2._config_hash(p_conteudo -> 'helena-v2/maquina/passagens.yaml')
           = '9e43d86912290c85f7e510fe765b1560896996fb073520e737207850936f3267'
     and helena_v2._config_hash(p_conteudo -> 'helena-v2/maquina/vocabulario.yaml')
           = 'd9ea2e47addcd80e15efbbea146be2d7f7146fa43378c0952a5485d2c7645fc9'
     and helena_v2._config_hash(p_conteudo -> 'helena-v2/maquina/jornada.schema.json')
           = 'a780f0201cbf1347a032d7963fb47b78336daed398b1abb046492b96f1039d69';
$f$;

create or replace function helena_v2._config_proteger_revisao() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  if tg_op = 'DELETE' then
    raise exception 'CONFIG_HISTORICO_IMUTAVEL' using errcode = '42501';
  end if;
  if old.estado <> 'RASCUNHO' and
     (new.id, new.nome, new.conteudo, new.versao, new.tecnica, new.base_id, new.criada_por,
      new.hash_sha256, new.impressao_maquina, new.criada_em, new.validada_em)
     is distinct from
     (old.id, old.nome, old.conteudo, old.versao, old.tecnica, old.base_id, old.criada_por,
      old.hash_sha256, old.impressao_maquina, old.criada_em, old.validada_em) then
    raise exception 'CONFIG_REVISAO_IMUTAVEL' using errcode = '42501';
  end if;
  if old.estado = 'APOSENTADA' and new.estado <> old.estado then
    raise exception 'CONFIG_APOSENTADA_IMUTAVEL' using errcode = '42501';
  end if;
  return new;
end;
$f$;
create trigger config_revisao_imutavel before update or delete on helena_v2.configuracao
  for each row execute function helena_v2._config_proteger_revisao();

create or replace function helena_v2._config_nunca_truncar() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'CONFIG_HISTORICO_IMUTAVEL' using errcode = '42501';
end;
$f$;
create trigger config_sem_truncate before truncate on helena_v2.configuracao
  for each statement execute function helena_v2._config_nunca_truncar();
create trigger config_validacao_sem_truncate before truncate on helena_v2.configuracao_validacao
  for each statement execute function helena_v2._config_nunca_truncar();
create trigger config_validacao_sem_delete before delete on helena_v2.configuracao_validacao
  for each row execute function helena_v2._config_nunca_truncar();

create or replace function helena_v2._config_json(p_id uuid, p_conteudo boolean default true) returns jsonb
language sql stable security definer set search_path = pg_catalog, pg_temp as $f$
  select jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'versao', c.versao, 'estado', c.estado,
    'tecnica', c.tecnica, 'base_id', c.base_id,
    'ativa', coalesce(c.id = p.ativa_id, false), 'hash_sha256', c.hash_sha256,
    'impressao_maquina', c.impressao_maquina,
    'criada_em', c.criada_em, 'alterada_em', c.alterada_em,
    'validada_em', c.validada_em, 'aposentada_em', c.aposentada_em,
    'validacao_pendente', coalesce(v.concluida_em is null and v.cancelada_em is null, false),
    'resultado_validacao', v.resultado)
    || case when p_conteudo then jsonb_build_object('conteudo', c.conteudo) else '{}'::jsonb end
  from helena_v2.configuracao c
  cross join helena_v2.configuracao_ponteiro p
  left join lateral (
    select q.concluida_em, q.cancelada_em, q.resultado
    from helena_v2.configuracao_validacao q where q.configuracao_id = c.id
    order by q.id desc limit 1
  ) v on true
  where c.id = p_id;
$f$;

create or replace function helena_v2.listar_configuracoes() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_lista jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(helena_v2._config_json(c.id, false) order by c.criada_em desc), '[]'::jsonb)
    into v_lista from helena_v2.configuracao c;
  return v_lista;
end;
$f$;

create or replace function helena_v2.ler_configuracao(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if not helena_v2.sou_fundador() and helena_v2._conta() <> 'service_role' then
    raise exception 'CONFIG_LEITURA_NEGADA' using errcode = '42501';
  end if;
  return helena_v2._config_json(p_id, true);
end;
$f$;

create or replace function helena_v2.configuracao_ativa() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_id uuid;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select p.ativa_id into v_id from helena_v2.configuracao_ponteiro p where p.unico;
  return helena_v2._config_json(v_id, true);
end;
$f$;

create or replace function helena_v2.salvar_rascunho(
  p_nome text, p_conteudo jsonb, p_id uuid default null,
  p_versao_esperada integer default null, p_base_id uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_id uuid; v_base helena_v2.configuracao; v_atual helena_v2.configuracao;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_nome is null or length(btrim(p_nome)) not between 1 and 160 then
    raise exception 'CONFIG_NOME_INVALIDO' using errcode = '22023';
  end if;
  if p_id is null then
    if p_base_id is not null then
      select * into v_base from helena_v2.configuracao where id = p_base_id;
      if not found then raise exception 'CONFIG_BASE_INEXISTENTE' using errcode = '22023'; end if;
    end if;
    p_conteudo := coalesce(p_conteudo, v_base.conteudo);
    if not helena_v2._config_bundle_valido(p_conteudo) then
      raise exception 'CONFIG_BUNDLE_INVALIDO' using errcode = '22023';
    end if;
    insert into helena_v2.configuracao(nome,conteudo,estado,criada_por,base_id)
      values (btrim(p_nome),p_conteudo,'RASCUNHO',auth.uid(),p_base_id) returning id into v_id;
  else
    if p_base_id is not null then raise exception 'CONFIG_BASE_SO_NA_CLONAGEM' using errcode = '22023'; end if;
    select * into v_atual from helena_v2.configuracao where id = p_id for update;
    if not found then raise exception 'CONFIG_INEXISTENTE' using errcode = '22023'; end if;
    if v_atual.estado <> 'RASCUNHO' then raise exception 'CONFIG_REVISAO_IMUTAVEL' using errcode = '42501'; end if;
    if p_versao_esperada is distinct from v_atual.versao then
      raise exception 'CONFIG_VERSAO_DESATUALIZADA' using errcode = '40001';
    end if;
    p_conteudo := coalesce(p_conteudo, v_atual.conteudo);
    if not helena_v2._config_bundle_valido(p_conteudo) then
      raise exception 'CONFIG_BUNDLE_INVALIDO' using errcode = '22023';
    end if;
    update helena_v2.configuracao set nome=btrim(p_nome), conteudo=p_conteudo,
      versao=versao+1, alterada_em=clock_timestamp() where id=p_id;
    update helena_v2.configuracao_validacao set cancelada_em=clock_timestamp()
      where configuracao_id=p_id and concluida_em is null and cancelada_em is null;
    v_id := p_id;
  end if;
  return helena_v2._config_json(v_id, true);
end;
$f$;

create or replace function helena_v2.solicitar_validacao_config(p_id uuid, p_versao integer) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_config helena_v2.configuracao;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  select * into v_config from helena_v2.configuracao where id=p_id for update;
  if not found or v_config.estado <> 'RASCUNHO' then
    raise exception 'CONFIG_RASCUNHO_INEXISTENTE' using errcode = '22023';
  end if;
  if p_versao is distinct from v_config.versao then
    raise exception 'CONFIG_VERSAO_DESATUALIZADA' using errcode = '40001';
  end if;
  insert into helena_v2.configuracao_validacao(configuracao_id,versao,hash_sha256)
    values(p_id,p_versao,helena_v2._config_hash(v_config.conteudo)) on conflict do nothing;
  return helena_v2._config_json(p_id,true);
end;
$f$;

create or replace function helena_v2.listar_validacoes_pendentes() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_lista jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'versao',q.versao,
      'hash_sha256',q.hash_sha256,'conteudo',c.conteudo,'solicitada_em',q.solicitada_em)
      order by q.id), '[]'::jsonb) into v_lista
  from helena_v2.configuracao_validacao q
  join helena_v2.configuracao c on c.id=q.configuracao_id
  where q.concluida_em is null and q.cancelada_em is null
    and c.estado='RASCUNHO' and c.versao=q.versao
    and helena_v2._config_hash(c.conteudo)=q.hash_sha256;
  return v_lista;
end;
$f$;

create or replace function helena_v2.registrar_resultado_validacao(
  p_id uuid, p_versao integer, p_hash_sha256 text, p_resultado jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_config helena_v2.configuracao; v_pedido bigint;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if jsonb_typeof(p_resultado) <> 'object' or p_resultado -> 'ok' <> 'false'::jsonb
     or jsonb_typeof(p_resultado -> 'erros') <> 'array' then
    raise exception 'CONFIG_RESULTADO_INVALIDO' using errcode = '22023';
  end if;
  select * into v_config from helena_v2.configuracao where id=p_id for update;
  if not found or v_config.estado <> 'RASCUNHO' or v_config.versao is distinct from p_versao
     or helena_v2._config_hash(v_config.conteudo) is distinct from p_hash_sha256 then
    raise exception 'CONFIG_VALIDACAO_DESATUALIZADA' using errcode = '40001';
  end if;
  select id into v_pedido from helena_v2.configuracao_validacao
    where configuracao_id=p_id and versao=p_versao and hash_sha256=p_hash_sha256
      and concluida_em is null and cancelada_em is null for update;
  if not found then raise exception 'CONFIG_SEM_PEDIDO_PENDENTE' using errcode = '40001'; end if;
  update helena_v2.configuracao_validacao set concluida_em=clock_timestamp(),resultado=p_resultado
    where id=v_pedido;
  return helena_v2._config_json(p_id,true);
end;
$f$;

create or replace function helena_v2.registrar_configuracao_tecnica(
  p_nome text, p_conteudo jsonb, p_impressao_maquina text
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ponteiro helena_v2.configuracao_ponteiro; v_existente helena_v2.configuracao; v_id uuid;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if not helena_v2._config_bundle_valido(p_conteudo)
     or not helena_v2._config_maquina_completa(p_conteudo)
     or not helena_v2._config_maquina_instalada(p_conteudo) then
    raise exception 'CONFIG_BUNDLE_INVALIDO' using errcode = '22023';
  end if;
  if not helena_v2.tabela_confere()
     or p_impressao_maquina is distinct from
        (select m.impressao_digital from helena_v2.meta_tabela m limit 1) then
    raise exception 'CONFIG_MAQUINA_SEM_PROVA' using errcode = '23514';
  end if;
  select * into v_ponteiro from helena_v2.configuracao_ponteiro where unico for update;
  if v_ponteiro.tecnica_id is not null then
    select * into v_existente from helena_v2.configuracao where id=v_ponteiro.tecnica_id;
    if v_existente.conteudo is distinct from p_conteudo
       or v_existente.impressao_maquina is distinct from p_impressao_maquina then
      raise exception 'CONFIG_BASE_TECNICA_DIFERENTE' using errcode = '23514';
    end if;
    return helena_v2._config_json(v_existente.id,true);
  end if;
  insert into helena_v2.configuracao(nome,conteudo,estado,tecnica,hash_sha256,
    impressao_maquina,validada_em)
    values(btrim(p_nome),p_conteudo,'VALIDADA',true,helena_v2._config_hash(p_conteudo),
      p_impressao_maquina,clock_timestamp()) returning id into v_id;
  update helena_v2.configuracao_ponteiro set tecnica_id=v_id,alterada_em=clock_timestamp() where unico;
  return helena_v2._config_json(v_id,true);
end;
$f$;

create or replace function helena_v2.registrar_validacao_config(
  p_id uuid, p_versao integer, p_hash_sha256 text, p_impressao_maquina text
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_config helena_v2.configuracao; v_base helena_v2.configuracao; v_pedido bigint;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into v_config from helena_v2.configuracao where id=p_id for update;
  if not found or v_config.estado <> 'RASCUNHO' or v_config.versao is distinct from p_versao
     or helena_v2._config_hash(v_config.conteudo) is distinct from p_hash_sha256 then
    raise exception 'CONFIG_VALIDACAO_DESATUALIZADA' using errcode = '40001';
  end if;
  select q.id into v_pedido from helena_v2.configuracao_validacao q
    where q.configuracao_id=p_id and q.versao=p_versao and q.hash_sha256=p_hash_sha256
      and q.concluida_em is null and q.cancelada_em is null for update;
  if not found then raise exception 'CONFIG_SEM_PEDIDO_PENDENTE' using errcode = '40001'; end if;
  select b.* into v_base from helena_v2.configuracao_ponteiro p
    join helena_v2.configuracao b on b.id=p.tecnica_id where p.unico;
  if not found or not helena_v2._config_maquina_completa(v_config.conteudo)
     or helena_v2._config_maquina(v_config.conteudo) is distinct from helena_v2._config_maquina(v_base.conteudo)
     or p_impressao_maquina is distinct from v_base.impressao_maquina
     or p_impressao_maquina is distinct from
        (select m.impressao_digital from helena_v2.meta_tabela m limit 1)
     or not helena_v2.tabela_confere() then
    raise exception 'CONFIG_MAQUINA_EXIGE_MIGRACAO_E_PROVA' using errcode = '23514';
  end if;
  update helena_v2.configuracao set estado='VALIDADA',hash_sha256=p_hash_sha256,
    impressao_maquina=p_impressao_maquina,validada_em=clock_timestamp(),alterada_em=clock_timestamp()
    where id=p_id;
  update helena_v2.configuracao_validacao set concluida_em=clock_timestamp(),resultado='{"ok":true}'::jsonb
    where id=v_pedido;
  return helena_v2._config_json(p_id,true);
end;
$f$;

create or replace function helena_v2.ativar_configuracao(p_id uuid, p_ativa_esperada uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ponteiro helena_v2.configuracao_ponteiro; v_config helena_v2.configuracao; v_base helena_v2.configuracao;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  select * into v_ponteiro from helena_v2.configuracao_ponteiro where unico for update;
  if v_ponteiro.ativa_id is distinct from p_ativa_esperada then
    raise exception 'CONFIG_ATIVA_DESATUALIZADA' using errcode = '40001';
  end if;
  select * into v_config from helena_v2.configuracao where id=p_id;
  if not found or v_config.estado <> 'VALIDADA' then
    raise exception 'CONFIG_NAO_VALIDADA' using errcode = '23514';
  end if;
  select * into v_base from helena_v2.configuracao where id=v_ponteiro.tecnica_id;
  if not found or helena_v2._config_maquina(v_config.conteudo)
        is distinct from helena_v2._config_maquina(v_base.conteudo)
     or v_config.impressao_maquina is distinct from v_base.impressao_maquina
     or not helena_v2.tabela_confere() then
    raise exception 'CONFIG_MAQUINA_EXIGE_MIGRACAO_E_PROVA' using errcode = '23514';
  end if;
  update helena_v2.configuracao_ponteiro set ativa_id=p_id,alterada_em=clock_timestamp() where unico;
  return helena_v2._config_json(p_id,true);
end;
$f$;

create or replace function helena_v2.aposentar_configuracao(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ponteiro helena_v2.configuracao_ponteiro; v_config helena_v2.configuracao;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  select * into v_ponteiro from helena_v2.configuracao_ponteiro where unico for update;
  if p_id = v_ponteiro.tecnica_id or p_id = v_ponteiro.ativa_id then
    raise exception 'CONFIG_EM_USO' using errcode = '23514';
  end if;
  select * into v_config from helena_v2.configuracao where id=p_id for update;
  if not found then raise exception 'CONFIG_INEXISTENTE' using errcode = '22023'; end if;
  if v_config.estado = 'APOSENTADA' then return helena_v2._config_json(p_id,true); end if;
  update helena_v2.configuracao set estado='APOSENTADA',aposentada_em=clock_timestamp(),
    alterada_em=clock_timestamp() where id=p_id;
  update helena_v2.configuracao_validacao set cancelada_em=clock_timestamp()
    where configuracao_id=p_id and concluida_em is null and cancelada_em is null;
  return helena_v2._config_json(p_id,true);
end;
$f$;

create or replace function helena_v2._config_vincular_card() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
declare v_id uuid; v_ativa uuid; v_tecnica uuid; v_estado text; v_pai uuid;
begin
  select p.ativa_id,p.tecnica_id into v_ativa,v_tecnica
    from helena_v2.configuracao_ponteiro p where p.unico;
  if jsonb_typeof(new.ordem_de_servico) <> 'object' then
    raise exception 'CONFIG_ORDEM_INVALIDA' using errcode = '22023';
  end if;
  if new.card_pai_id is not null then
    select (c.ordem_de_servico ->> 'config_revision_id')::uuid into v_pai
      from helena_v2.card c where c.id=new.card_pai_id;
    if new.ordem_de_servico ? 'config_revision_id'
       and (new.ordem_de_servico ->> 'config_revision_id')::uuid is distinct from v_pai then
      raise exception 'CONFIG_REVISAO_DIFERE_DO_PAI' using errcode = '23514';
    end if;
    v_id := v_pai;
  elsif new.ordem_de_servico ? 'config_revision_id' then
    v_id := (new.ordem_de_servico ->> 'config_revision_id')::uuid;
    if v_id is null then raise exception 'CONFIG_ID_INVALIDO' using errcode = '22023'; end if;
    if v_ativa is null and (helena_v2._conta() <> 'service_role'
                            or v_id is distinct from v_tecnica) then
      raise exception 'CONFIG_SEM_ATIVACAO' using errcode = '42501';
    end if;
    if v_ativa is not null and v_id <> v_ativa then
      raise exception 'CONFIG_ATIVA_DIFERENTE' using errcode = '23514';
    end if;
  else
    v_id := v_ativa;
    if v_id is null and v_tecnica is not null then
      raise exception 'CONFIG_SEM_ATIVACAO' using errcode = '42501';
    end if;
  end if;
  if v_id is not null then
    select c.estado into v_estado from helena_v2.configuracao c where c.id=v_id;
    if not found or (v_estado <> 'VALIDADA' and new.card_pai_id is null) then
      raise exception 'CONFIG_REVISAO_INATIVA' using errcode = '23514';
    end if;
    new.ordem_de_servico := jsonb_set(new.ordem_de_servico,'{config_revision_id}',to_jsonb(v_id::text),true);
  end if;
  return new;
end;
$f$;
create trigger b_config_vincular_card before insert on helena_v2.card
  for each row execute function helena_v2._config_vincular_card();

create or replace function helena_v2._config_preservar_card() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  if new.ordem_de_servico -> 'config_revision_id'
     is distinct from old.ordem_de_servico -> 'config_revision_id' then
    raise exception 'CONFIG_VINCULO_IMUTAVEL' using errcode = '42501';
  end if;
  return new;
end;
$f$;
create trigger b_config_preservar_card before update on helena_v2.card
  for each row execute function helena_v2._config_preservar_card();

alter table helena_v2.configuracao enable row level security;
alter table helena_v2.configuracao_ponteiro enable row level security;
alter table helena_v2.configuracao_validacao enable row level security;
create policy configuracao_fundador_leitura on helena_v2.configuracao for select to authenticated
  using (helena_v2.sou_fundador());

revoke all on helena_v2.configuracao, helena_v2.configuracao_ponteiro,
  helena_v2.configuracao_validacao from public, anon, authenticated, service_role;
-- Revoga apenas as funções desta migração; as portas anteriores mantêm seus privilégios.
revoke all on function helena_v2._config_hash(jsonb),helena_v2._config_maquina(jsonb),
  helena_v2._config_bundle_valido(jsonb),helena_v2._config_maquina_completa(jsonb),
  helena_v2._config_maquina_instalada(jsonb),
  helena_v2._config_proteger_revisao(),helena_v2._config_nunca_truncar(),
  helena_v2._config_json(uuid,boolean),helena_v2.listar_configuracoes(),
  helena_v2.ler_configuracao(uuid),helena_v2.configuracao_ativa(),
  helena_v2.salvar_rascunho(text,jsonb,uuid,integer,uuid),
  helena_v2.solicitar_validacao_config(uuid,integer),
  helena_v2.listar_validacoes_pendentes(),
  helena_v2.registrar_resultado_validacao(uuid,integer,text,jsonb),
  helena_v2.registrar_configuracao_tecnica(text,jsonb,text),
  helena_v2.registrar_validacao_config(uuid,integer,text,text),
  helena_v2.ativar_configuracao(uuid,uuid),helena_v2.aposentar_configuracao(uuid),
  helena_v2._config_vincular_card(),helena_v2._config_preservar_card()
  from public, anon, authenticated, service_role;

grant execute on function helena_v2.listar_configuracoes(),
  helena_v2.ler_configuracao(uuid),helena_v2.salvar_rascunho(text,jsonb,uuid,integer,uuid),
  helena_v2.solicitar_validacao_config(uuid,integer),
  helena_v2.ativar_configuracao(uuid,uuid),helena_v2.aposentar_configuracao(uuid)
  to authenticated;
grant execute on function helena_v2.ler_resposta_execucao(bigint),
  helena_v2.registrar_resposta_execucao(bigint,jsonb),helena_v2.ler_configuracao(uuid),
  helena_v2.configuracao_ativa(),helena_v2.listar_validacoes_pendentes(),
  helena_v2.registrar_resultado_validacao(uuid,integer,text,jsonb),
  helena_v2.registrar_validacao_config(uuid,integer,text,text),
  helena_v2.registrar_configuracao_tecnica(text,jsonb,text)
  to service_role;
