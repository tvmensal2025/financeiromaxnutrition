-- 0018 — o pedido de publicação ganha ESTADO e um trabalhador que o executa; a tela passa a dizer a verdade.
-- O que é: acrescenta à tabela helena_v2.publicacoes (0005) os estados PEDIDA, EM_EXECUCAO, PUBLICADA, FALHOU e REVERTIDA,
--   as transições legais (gatilho + CHECK) e quatro portas SÓ do service_role: reivindicar_publicacao(),
--   concluir_publicacao(id,destino,versao), falhar_publicacao(id,erro) e reverter_publicacao(id).
--   situacao_publicacao() (do fundador) passa a devolver o estado verdadeiro do pedido de hoje.
-- O que NÃO muda: pedir_publicacao() e o cálculo do dia de Brasília (1 pedido por dia, só fundador) ficam como na 0005.
-- NÃO CONFIRMADO: o DESTINO REAL de uma publicação. Nada aqui publica, chama serviço externo nem conhece destino:
--   `destino` é só um nome que o trabalhador informa ao concluir (hoje, só um destino falso, nos testes).
--   O fundador ainda precisa dizer o que "publicar" significa.
-- Regra do plano: pedido aceito nunca aparece como no ar. "No ar" só existe no estado PUBLICADA, e só quem tem o
--   papel service_role (o motor) consegue levar um pedido até lá.
-- Linhas antigas (sem estado) viram PEDIDA ao acrescentar a coluna; nenhuma linha antiga quebra.
-- Como mudar: estado ou transição nova entra no CHECK, no gatilho e nos testes (testes/test_24_publicacao_execucao.py).

alter table helena_v2.publicacoes
  add column estado text not null default 'PEDIDA',
  add column destino text,
  add column versao_publicada text,
  add column iniciada_em timestamptz,
  add column concluida_em timestamptz,
  add column falhou_em timestamptz,
  add column revertida_em timestamptz,
  add column erro text;

alter table helena_v2.publicacoes add constraint ck_publicacoes_estado
  check (estado in ('PEDIDA', 'EM_EXECUCAO', 'PUBLICADA', 'FALHOU', 'REVERTIDA'));

-- Texto curto e não vazio quando existe.
alter table helena_v2.publicacoes add constraint ck_publicacoes_textos_curtos
  check ((destino is null or (btrim(destino) <> '' and char_length(destino) <= 120))
     and (versao_publicada is null or (btrim(versao_publicada) <> '' and char_length(versao_publicada) <= 120))
     and (erro is null or (btrim(erro) <> '' and char_length(erro) <= 300)));

-- Cada estado só tem os campos que cabem nele: FALHOU nunca carrega versão nem hora de conclusão (nunca foi publicada).
alter table helena_v2.publicacoes add constraint ck_publicacoes_campos_do_estado check (
     (estado = 'PEDIDA'      and iniciada_em is null and concluida_em is null and falhou_em is null and revertida_em is null
                             and destino is null and versao_publicada is null and erro is null)
  or (estado = 'EM_EXECUCAO' and iniciada_em is not null and concluida_em is null and falhou_em is null and revertida_em is null
                             and destino is null and versao_publicada is null and erro is null)
  or (estado = 'PUBLICADA'   and iniciada_em is not null and concluida_em is not null and falhou_em is null and revertida_em is null
                             and destino is not null and versao_publicada is not null and erro is null)
  or (estado = 'FALHOU'      and iniciada_em is not null and falhou_em is not null and concluida_em is null and revertida_em is null
                             and destino is null and versao_publicada is null and erro is not null)
  or (estado = 'REVERTIDA'   and iniciada_em is not null and concluida_em is not null and falhou_em is null and revertida_em is not null
                             and destino is not null and versao_publicada is not null and erro is null));

-- Transições legais: PEDIDA -> EM_EXECUCAO -> PUBLICADA | FALHOU, e PUBLICADA -> REVERTIDA. FALHOU e REVERTIDA são finais.
-- Nunca volta para PEDIDA (um pedido em execução não é repetido: o efeito de fora pode já ter acontecido).
create or replace function helena_v2.trg_publicacao_transicao() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'PEDIDA' then
      raise exception 'PUBLICACAO: um pedido novo nasce PEDIDA, não %', new.estado using errcode = '23514';
    end if;
    return new;
  end if;
  if (new.id, new.solicitado_por, new.pedido_em, new.dia_brasilia)
     is distinct from (old.id, old.solicitado_por, old.pedido_em, old.dia_brasilia) then
    raise exception 'PUBLICACAO: quem pediu, quando e o dia do pedido não mudam' using errcode = '23514';
  end if;
  if not ((old.estado, new.estado) in (('PEDIDA', 'EM_EXECUCAO'), ('EM_EXECUCAO', 'PUBLICADA'),
                                       ('EM_EXECUCAO', 'FALHOU'), ('PUBLICADA', 'REVERTIDA'))) then
    raise exception 'PUBLICACAO: transição % -> % não é permitida', old.estado, new.estado using errcode = '23514';
  end if;
  if (old.iniciada_em is not null and new.iniciada_em is distinct from old.iniciada_em)
     or (old.concluida_em is not null and new.concluida_em is distinct from old.concluida_em)
     or (old.falhou_em is not null and new.falhou_em is distinct from old.falhou_em)
     or (old.destino is not null and new.destino is distinct from old.destino)
     or (old.versao_publicada is not null and new.versao_publicada is distinct from old.versao_publicada)
     or (old.erro is not null and new.erro is distinct from old.erro) then
    raise exception 'PUBLICACAO: o que já foi registrado no pedido não é reescrito' using errcode = '23514';
  end if;
  return new;
end;
$f$;

create trigger b_publicacao_transicao before insert or update on helena_v2.publicacoes
  for each row execute function helena_v2.trg_publicacao_transicao();

-- O mesmo retrato do pedido para o fundador (situacao_publicacao) e para o trabalhador (as quatro portas).
create or replace function helena_v2._publicacao_json(p helena_v2.publicacoes) returns jsonb
language sql stable set search_path = pg_catalog, pg_temp as $f$
  select jsonb_build_object('id', p.id, 'pedido_em', p.pedido_em, 'dia_brasilia', p.dia_brasilia,
    'estado', p.estado, 'destino', p.destino, 'versao_publicada', p.versao_publicada,
    'iniciada_em', p.iniciada_em, 'concluida_em', p.concluida_em, 'falhou_em', p.falhou_em,
    'revertida_em', p.revertida_em, 'erro', p.erro);
$f$;

-- Do fundador: o pedido de HOJE com o estado verdadeiro. Sem pedido hoje, `pedido` é nulo (e a tela oferece o botão).
create or replace function helena_v2.situacao_publicacao() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pedido jsonb;
begin
  if not helena_v2.sou_fundador() then
    return jsonb_build_object('fundador', false, 'dia_brasilia', v_dia, 'pedido', null);
  end if;
  select helena_v2._publicacao_json(p) into v_pedido from helena_v2.publicacoes p where p.dia_brasilia = v_dia;
  return jsonb_build_object('fundador', true, 'dia_brasilia', v_dia, 'pedido', v_pedido);
end;
$f$;

-- Do trabalhador: pega o pedido PEDIDA mais antigo e o marca EM_EXECUCAO na mesma transação.
-- FOR UPDATE SKIP LOCKED: dois trabalhadores ao mesmo tempo nunca levam o mesmo pedido. Nunca devolve um pedido já
-- EM_EXECUCAO (ele não é retentado sozinho; se travar, vira alarme). Sem pedido pendente, devolve nulo.
create or replace function helena_v2.reivindicar_publicacao() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_id bigint;
  v_p helena_v2.publicacoes;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select p.id into v_id from helena_v2.publicacoes p where p.estado = 'PEDIDA'
    order by p.pedido_em, p.id limit 1 for update skip locked;
  if v_id is null then
    return null;
  end if;
  update helena_v2.publicacoes p set estado = 'EM_EXECUCAO', iniciada_em = clock_timestamp()
    where p.id = v_id and p.estado = 'PEDIDA' returning p.* into v_p;
  return helena_v2._publicacao_json(v_p);
end;
$f$;

-- Do trabalhador: EM_EXECUCAO -> PUBLICADA, com o nome do destino e a versão que o destino devolveu.
create or replace function helena_v2.concluir_publicacao(p_id bigint, p_destino text, p_versao text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_p helena_v2.publicacoes;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if p_destino is null or btrim(p_destino) = '' or char_length(p_destino) > 120
     or p_versao is null or btrim(p_versao) = '' or char_length(p_versao) > 120 then
    raise exception 'DESTINO_E_VERSAO_OBRIGATORIOS' using errcode = '22023';
  end if;
  select * into v_p from helena_v2.publicacoes p where p.id = p_id for update;
  if not found then
    raise exception 'PUBLICACAO_INEXISTENTE' using errcode = 'P0002';
  end if;
  if v_p.estado <> 'EM_EXECUCAO' then
    raise exception 'PUBLICACAO: só um pedido EM_EXECUCAO conclui (está %)', v_p.estado using errcode = '23514';
  end if;
  update helena_v2.publicacoes p set estado = 'PUBLICADA', destino = btrim(p_destino),
      versao_publicada = btrim(p_versao), concluida_em = clock_timestamp()
    where p.id = p_id returning p.* into v_p;
  return helena_v2._publicacao_json(v_p);
end;
$f$;

-- Do trabalhador: EM_EXECUCAO -> FALHOU, com um erro curto. O banco ainda tira o que parece segredo (a limpeza principal é
-- do trabalhador, antes de chamar), corta em 300 caracteres e nunca guarda texto vazio. FALHOU nunca vira PUBLICADA.
create or replace function helena_v2.falhar_publicacao(p_id bigint, p_erro text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_p helena_v2.publicacoes;
  v_erro text := btrim(coalesce(p_erro, ''));
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  v_erro := regexp_replace(v_erro, '[[:cntrl:]]+', ' ', 'g');
  v_erro := regexp_replace(v_erro, '-----BEGIN [A-Z ]*PRIVATE KEY-----', '[REMOVIDO:CHAVE_PRIVADA]', 'g');
  v_erro := regexp_replace(v_erro, '\msk-[A-Za-z0-9_-]{16,}', '[REMOVIDO:CHAVE_SK]', 'g');
  v_erro := regexp_replace(v_erro, '\m(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,}', '[REMOVIDO:TOKEN_GITHUB]', 'g');
  v_erro := regexp_replace(v_erro, '\meyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}', '[REMOVIDO:JWT]', 'g');
  v_erro := regexp_replace(v_erro, '\m[a-z][a-z0-9+.-]*://[^\s/:@]+:[^\s/@]+@', '[REMOVIDO:URL_COM_SENHA]', 'g');
  v_erro := regexp_replace(v_erro, '\mBearer\s+[A-Za-z0-9._-]{20,}', '[REMOVIDO:BEARER]', 'g');
  v_erro := regexp_replace(v_erro, '\m(password|passwd|senha|secret|token|apikey|api_key)\s*[=:]\s*\S+', '\1=[REMOVIDO]', 'gi');
  v_erro := left(btrim(v_erro), 300);
  if v_erro = '' then
    v_erro := 'ERRO_NAO_INFORMADO';
  end if;
  select * into v_p from helena_v2.publicacoes p where p.id = p_id for update;
  if not found then
    raise exception 'PUBLICACAO_INEXISTENTE' using errcode = 'P0002';
  end if;
  if v_p.estado <> 'EM_EXECUCAO' then
    raise exception 'PUBLICACAO: só um pedido EM_EXECUCAO falha (está %)', v_p.estado using errcode = '23514';
  end if;
  update helena_v2.publicacoes p set estado = 'FALHOU', erro = v_erro, falhou_em = clock_timestamp()
    where p.id = p_id returning p.* into v_p;
  return helena_v2._publicacao_json(v_p);
end;
$f$;

-- Do trabalhador: PUBLICADA -> REVERTIDA. Só registra no banco; desfazer no destino é outro passo (hoje, sem destino real).
create or replace function helena_v2.reverter_publicacao(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_p helena_v2.publicacoes;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into v_p from helena_v2.publicacoes p where p.id = p_id for update;
  if not found then
    raise exception 'PUBLICACAO_INEXISTENTE' using errcode = 'P0002';
  end if;
  if v_p.estado <> 'PUBLICADA' then
    raise exception 'PUBLICACAO: só um pedido PUBLICADA reverte (está %)', v_p.estado using errcode = '23514';
  end if;
  update helena_v2.publicacoes p set estado = 'REVERTIDA', revertida_em = clock_timestamp()
    where p.id = p_id returning p.* into v_p;
  return helena_v2._publicacao_json(v_p);
end;
$f$;

-- Permissões no padrão da 0005 e da 0016: tudo fechado, depois só o que cada papel precisa.
-- O fundador continua só lendo o próprio pedido e pedindo; as quatro portas novas são do service_role.
-- O motor também lê a tabela (como lê card/etapa/entrega) para o alarme de pedido EM_EXECUCAO parado há muito tempo.
create policy publicacoes_motor on helena_v2.publicacoes for select to service_role using (true);
revoke all on helena_v2.publicacoes from public, anon, authenticated, service_role;
grant select on helena_v2.publicacoes to authenticated, service_role;

revoke all on function helena_v2.trg_publicacao_transicao(), helena_v2._publicacao_json(helena_v2.publicacoes),
  helena_v2.situacao_publicacao(), helena_v2.reivindicar_publicacao(),
  helena_v2.concluir_publicacao(bigint,text,text), helena_v2.falhar_publicacao(bigint,text),
  helena_v2.reverter_publicacao(bigint) from public, anon, authenticated, service_role;
grant execute on function helena_v2.situacao_publicacao() to authenticated;
grant execute on function helena_v2.reivindicar_publicacao(),
  helena_v2.concluir_publicacao(bigint,text,text), helena_v2.falhar_publicacao(bigint,text),
  helena_v2.reverter_publicacao(bigint) to service_role;
