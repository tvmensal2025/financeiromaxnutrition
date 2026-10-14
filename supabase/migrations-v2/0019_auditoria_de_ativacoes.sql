-- 0019 — histórico de ativações de configuração e reversão para a revisão anterior.
-- O que é: registra quem ativou qual revisão e quando (só acréscimo), e deixa o fundador voltar para a revisão
-- que estava ativa antes. A definição de ativar_configuracao é a da 0006 (a única; nenhuma migration 0007–0016 a
-- redefine) com UMA linha a mais: o registro da ativação. Cards em andamento mantêm a revisão em que nasceram.
-- Como mudar: o histórico nunca é editado nem apagado; correção = nova ativação ou nova reversão.

create table helena_v2.configuracao_ativacao (
  id bigint generated always as identity primary key,
  configuracao_id uuid not null references helena_v2.configuracao(id),
  anterior_id uuid references helena_v2.configuracao(id),
  ativada_por uuid not null default auth.uid(),
  ativada_em timestamptz not null default clock_timestamp(),
  tipo text not null check (tipo in ('ATIVACAO', 'REVERSAO')),
  check (anterior_id is distinct from configuracao_id)
);
create index configuracao_ativacao_recentes on helena_v2.configuracao_ativacao (id desc);

create or replace function helena_v2._config_ativacao_so_acrescenta() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'CONFIG_ATIVACAO_SO_ACRESCENTA' using errcode = '42501';
end;
$f$;
create trigger config_ativacao_so_acrescenta before update or delete on helena_v2.configuracao_ativacao
  for each row execute function helena_v2._config_ativacao_so_acrescenta();
create trigger config_ativacao_sem_truncate before truncate on helena_v2.configuracao_ativacao
  for each statement execute function helena_v2._config_ativacao_so_acrescenta();

-- Corpo idêntico ao da 0006; a única diferença é o INSERT no fim. Reativar a revisão que já é a ativa não muda nada
-- e por isso não gera linha (a "anterior" de uma linha nunca é ela mesma).
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
  if v_ponteiro.ativa_id is distinct from p_id then
    insert into helena_v2.configuracao_ativacao(configuracao_id,anterior_id,tipo)
      values (p_id,v_ponteiro.ativa_id,'ATIVACAO');
  end if;
  return helena_v2._config_json(p_id,true);
end;
$f$;

-- Últimas ativações e reversões, da mais nova para a mais antiga. Só o fundador lê.
create or replace function helena_v2.listar_ativacoes(p_limite integer default 20) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_lista jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 200 then
    raise exception 'LIMITE_INVALIDO' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'tipo', t.tipo, 'ativada_por', t.ativada_por, 'ativada_em', t.ativada_em,
      'configuracao_id', t.configuracao_id, 'configuracao_nome', c.nome, 'configuracao_versao', c.versao,
      'anterior_id', t.anterior_id, 'anterior_nome', a.nome, 'anterior_versao', a.versao,
      'anterior_estado', a.estado) order by t.id desc), '[]'::jsonb)
    into v_lista
    from (select * from helena_v2.configuracao_ativacao order by id desc limit p_limite) t
    join helena_v2.configuracao c on c.id = t.configuracao_id
    left join helena_v2.configuracao a on a.id = t.anterior_id;
  return v_lista;
end;
$f$;

-- Reativa a revisão que estava ativa antes da última ativação. Mesma verificação otimista (CAS) e mesmas
-- exigências da máquina que ativar_configuracao; a anterior tem de continuar VALIDADA (aposentada não volta).
create or replace function helena_v2.reverter_configuracao(p_ativa_esperada uuid) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ponteiro helena_v2.configuracao_ponteiro; v_ultima helena_v2.configuracao_ativacao;
        v_config helena_v2.configuracao; v_base helena_v2.configuracao;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  select * into v_ponteiro from helena_v2.configuracao_ponteiro where unico for update;
  if v_ponteiro.ativa_id is distinct from p_ativa_esperada then
    raise exception 'CONFIG_ATIVA_DESATUALIZADA' using errcode = '40001';
  end if;
  select * into v_ultima from helena_v2.configuracao_ativacao order by id desc limit 1;
  if not found or v_ultima.configuracao_id is distinct from v_ponteiro.ativa_id
     or v_ultima.anterior_id is null then
    raise exception 'CONFIG_SEM_ANTERIOR' using errcode = '23514';
  end if;
  select * into v_config from helena_v2.configuracao where id=v_ultima.anterior_id;
  if not found or v_config.estado <> 'VALIDADA' then
    raise exception 'CONFIG_ANTERIOR_NAO_VALIDADA' using errcode = '23514';
  end if;
  select * into v_base from helena_v2.configuracao where id=v_ponteiro.tecnica_id;
  if not found or helena_v2._config_maquina(v_config.conteudo)
        is distinct from helena_v2._config_maquina(v_base.conteudo)
     or v_config.impressao_maquina is distinct from v_base.impressao_maquina
     or not helena_v2.tabela_confere() then
    raise exception 'CONFIG_MAQUINA_EXIGE_MIGRACAO_E_PROVA' using errcode = '23514';
  end if;
  update helena_v2.configuracao_ponteiro set ativa_id=v_config.id,alterada_em=clock_timestamp() where unico;
  insert into helena_v2.configuracao_ativacao(configuracao_id,anterior_id,tipo)
    values (v_config.id,v_ponteiro.ativa_id,'REVERSAO');
  return helena_v2._config_json(v_config.id,true);
end;
$f$;

alter table helena_v2.configuracao_ativacao enable row level security;
revoke all on helena_v2.configuracao_ativacao from public, anon, authenticated, service_role;
revoke all on sequence helena_v2.configuracao_ativacao_id_seq from public, anon, authenticated, service_role;
revoke all on function helena_v2._config_ativacao_so_acrescenta(), helena_v2.ativar_configuracao(uuid,uuid),
  helena_v2.listar_ativacoes(integer), helena_v2.reverter_configuracao(uuid)
  from public, anon, authenticated, service_role;
grant execute on function helena_v2.ativar_configuracao(uuid,uuid), helena_v2.listar_ativacoes(integer),
  helena_v2.reverter_configuracao(uuid) to authenticated;
