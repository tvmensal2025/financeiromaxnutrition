-- Contas do motor da v2 no Supabase real. Idempotente. NÃO cria senha: o fundador define as duas senhas
-- fora do repositório (ver LEIA-ANTES.md) e as coloca só no endereço de conexão da VPS.
--
-- O contrato vem de motor/orquestrador/orquestrador/bancos.py (preflight_papel_runtime):
--   helena_motor  conta do aplicativo. LOGIN, sem nenhum privilégio administrativo, NÃO é dona de nenhum esquema,
--                 e só pode ALTERNAR para service_role (SET), sem herdar e sem administrar.
--   dbos_motor    conta do DBOS. LOGIN, sem privilégio administrativo, DONA do esquema dbos_helena_v2 e SEM
--                 nenhum vínculo com service_role.
-- Rodar como o dono do banco (papel postgres do SQL Editor ou do conector).

do $contas$
begin
  if not exists (select 1 from pg_roles where rolname = 'helena_motor') then
    create role helena_motor login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 10;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'dbos_motor') then
    create role dbos_motor login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 10;
  end if;

  -- Contas que já existiam: um administrador comum (o postgres do Supabase) não pode nem repetir NOSUPERUSER num ALTER ROLE.
  -- Então só se ajusta o que ele pode mexer, e qualquer privilégio administrativo encontrado PARA o arquivo com erro.
  if exists (select 1 from pg_roles where rolname in ('helena_motor', 'dbos_motor')
             and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
    raise exception 'CONTAS DO MOTOR: helena_motor ou dbos_motor ja existem com privilegio administrativo; corrija antes com alter role ... nosuperuser nocreatedb nocreaterole noreplication nobypassrls';
  end if;
  alter role helena_motor login noinherit connection limit 10;
  alter role dbos_motor login noinherit connection limit 10;
end
$contas$;

-- No Supabase o postgres NÃO é superusuário: ao criar os papéis ele só ganha ADMIN sobre eles, sem poder assumi-los.
-- Criar o esquema como dbos_motor e rodar o 02 como dbos_motor exige SET. Só quem aplica este arquivo ganha isso.
grant dbos_motor to current_user with set true, inherit false;

-- Só alternar (SET). Sem herança, sem administração: a verificação de partida recusa qualquer outra forma.
grant service_role to helena_motor with set true, inherit false, admin false;

-- A conta do DBOS nunca pertence a service_role (nem alcança outro papel).
do $dbos$
begin
  if pg_has_role('dbos_motor', 'service_role', 'MEMBER') then
    revoke service_role from dbos_motor;
  end if;
end
$dbos$;

-- O esquema do DBOS é da conta do DBOS e de mais ninguém. As tabelas entram em 02_esquema_dbos.sql.
create schema if not exists dbos_helena_v2 authorization dbos_motor;

-- Só troca o dono se o esquema já existia com outro dono (quem aplica só tem SET, sem herança: não pode mexer no que já é do dono certo).
do $dono$
begin
  if not exists (select 1 from pg_namespace n join pg_roles r on r.oid = n.nspowner
                 where n.nspname = 'dbos_helena_v2' and r.rolname = 'dbos_motor') then
    alter schema dbos_helena_v2 owner to dbos_motor;
  end if;
end
$dono$;

-- Revogar o acesso de todos os outros precisa rodar como o dono do esquema.
set local role dbos_motor;
revoke all on schema dbos_helena_v2 from public;
reset role;
