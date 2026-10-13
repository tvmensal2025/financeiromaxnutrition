-- 0004 — AS TRAVAS DAS 13 REGRAS DE FERRO E AS PERMISSÕES.
-- O que é: a segunda chave. A tabela de passagens diz o que pode acontecer; estas travas conferem o RESULTADO e
--          recusam mesmo que a tabela (ou um programa) erre. Gatilho, CHECK, índice único e permissão, por regra:
--   R1  dono e prazo em todo estado aberto ........ CHECK ck_*_regra01_dono_e_prazo (gerado no 0002)
--   R2  todo caminho termina; final não volta ..... SÓ A METADE "final não volta" tem trava (gatilho); o "termina" é prova + relógio
--   R3  uma execução viva; só a chave atual grava . índice único, CHECK, gatilho da entrega, sequência que só sobe
--   R4  revisor não é autor nem quem julga depois . CHECK ck_etapa_regra04_revisor
--   R5  ajuste volta ao autor; teto de cada contador  CHECK de teto (gerado) + gatilho do ajuste
--   R6  sem ciclo; etapa só anda com card ativo ... gatilho adiado conferir_card (e a função única lê o card)
--   R7  prioridade e prazo só do fundador ......... gatilho trg_card_campos_do_fundador
--   R8  nada externo sem o seu ok, só pelo motor, uma vez  índice único (card, etapa), CHECK, gatilho da ação, CHECK do histórico
--   R9  aprovada só com os portões; nenhum padrão aprova  CHECK + gatilho da etapa + gatilho adiado do card pronto
--   R10 nada pronto com informação velha .......... CHECK ck_etapa_regra10_pronta_fresca
--   R11 toque seu gravado uma vez e com destino ... índice único (canal, número), índice do toque, CHECK do histórico
--   R12 falha de infraestrutura não gasta tentativa  NÃO cabe numa trava (depende da origem da falha): tem teste
--   R13 o histórico reconstrói o card ............. histórico só de acréscimo (gatilho), uma linha casa por evento
-- De onde vem: escrito à mão, de propósito independente da tabela (como a especificação de provar.py).
-- Como mudar: uma regra nova do card muda no YAML. Aqui só entra trava nova, e com um teste que TENTA violá-la.

-- ---------------------------------------------------------------------------- gatilhos genéricos
create or replace function helena_v2.trg_so_pela_funcao() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if coalesce(current_setting('helena_v2.funcao_unica', true), 'nao') <> 'sim' then
    raise exception 'REGRA 13: % em % só pela função helena_v2.aplicar_evento (ou criar_card); UPDATE, INSERT e DELETE diretos são recusados',
      tg_op, tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$f$;

create or replace function helena_v2.trg_nunca_apagar() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  raise exception 'REGRA 13: nada se apaga em % (o histórico só cresce)', tg_table_name using errcode = '42501';
end;
$f$;

create or replace function helena_v2.trg_nunca_truncar() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  raise exception 'REGRA 13: TRUNCATE em % é recusado', tg_table_name using errcode = '42501';
end;
$f$;

create or replace function helena_v2.trg_so_acrescenta() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  raise exception 'REGRA 13: % só de acréscimo; % é recusado', tg_table_name, tg_op using errcode = '42501';
end;
$f$;

-- Tabelas de regras: só mudam dentro de uma migração (o arquivo 0002 liga helena_v2.migrando).
create or replace function helena_v2.trg_tabela_de_regras() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if coalesce(current_setting('helena_v2.migrando', true), 'nao') <> 'sim' then
    raise exception 'a tabela de regras % só muda por migração gerada (gerar_passagens.py); % recusado', tg_table_name, tg_op using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'TRUNCATE' then return null; end if;
  return new;
end;
$f$;

-- Regra 2 (a metade que cabe numa trava): um final nunca volta a andar.
create or replace function helena_v2.trg_final_nao_anda() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if new.estado is distinct from old.estado
     and exists (select 1 from estado_def d where d.maquina = tg_table_name and d.estado = old.estado and d.final) then
    raise exception 'REGRA 2: % % já está em um final (%) e não volta a andar (tentou %)', tg_table_name, old.id, old.estado, new.estado
      using errcode = '23514';
  end if;
  return new;
end;
$f$;

-- Regra 7: prioridade e prazo são seus. Só passa dentro de _mudar_campo_do_fundador (toque do FUNDADOR).
create or replace function helena_v2.trg_card_campos_do_fundador() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if (new.prioridade is distinct from old.prioridade or new.prazo is distinct from old.prazo)
     and coalesce(current_setting('helena_v2.campo_do_fundador', true), 'nao') <> 'sim' then
    raise exception 'REGRA 7: prioridade e prazo só mudam por toque do fundador (MUDAR_PRIORIDADE, MUDAR_PRAZO)' using errcode = '42501';
  end if;
  return new;
end;
$f$;

-- A ficha da etapa e da ação não muda no meio do caminho (regras 4 e 6 dependem dela).
create or replace function helena_v2.trg_ficha_imutavel() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare a jsonb := to_jsonb(old); b jsonb := to_jsonb(new); k text;
begin
  foreach k in array tg_argv loop
    if a -> k is distinct from b -> k then
      raise exception 'REGRA 4/6: a coluna % de % não muda depois que o card nasce', k, tg_table_name using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$f$;

-- Regras 5 e 9 na etapa: aprovar só por revisor ou por você (no jurídico, só você); pronta só vem de aprovada;
-- ajuste volta ao autor. Lê quem e qual evento mudou o estado (a função única grava isso antes de gravar a linha).
create or replace function helena_v2.trg_etapa_regras() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  p text := coalesce(current_setting('helena_v2.papel_evento', true), '');
  e text := coalesce(current_setting('helena_v2.evento_atual', true), '');
  dono_novo text;
  final_novo boolean;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;
  if new.estado = 'APROVADA' then
    if p not in ('REVISOR', 'FUNDADOR') then
      raise exception 'REGRA 9: etapa % aprovada por % %; só revisor ou o fundador aprovam, nenhum padrão ou automático', new.codigo, p, e using errcode = '23514';
    end if;
    if new.julgadora and p <> 'FUNDADOR' then
      raise exception 'REGRA 9: parecer da etapa % valeu só com o revisor de IA; no jurídico só o seu Aprovar vale', new.codigo using errcode = '23514';
    end if;
  end if;
  if new.estado = 'PRONTA' and old.estado <> 'APROVADA' then
    raise exception 'REGRA 9: etapa % ficou pronta sem estar aprovada (veio de %)', new.codigo, old.estado using errcode = '23514';
  end if;
  if e in ('REPROVAR', 'AJUSTE_DO_JULGADOR') or (p = 'FUNDADOR' and e = 'PEDIR_AJUSTE') then
    select d.dono, d.final into dono_novo, final_novo from estado_def d where d.maquina = 'etapa' and d.estado = new.estado;
    if not (dono_novo = 'AUTOR' or new.estado = 'EM_RESOLUCAO' or (p = 'FUNDADOR' and final_novo and new.estado <> 'PRONTA')) then
      raise exception 'REGRA 5: o ajuste (%) da etapa % não voltou ao autor (foi para %)', e, new.codigo, new.estado using errcode = '23514';
    end if;
  end if;
  return new;
end;
$f$;

-- Regra 8 na ação externa: o seu ok só vem de um toque seu; a execução só vem do motor; no máximo uma vez.
create or replace function helena_v2.trg_acao_regras() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare p text := coalesce(current_setting('helena_v2.papel_evento', true), '');
begin
  if new.ok_registrado = 1 and old.ok_registrado = 0 and p <> 'FUNDADOR' then
    raise exception 'REGRA 8: o ok da ação % só pode ser registrado por toque do fundador (veio de %)', new.codigo, p using errcode = '23514';
  end if;
  if new.tentativas > old.tentativas and p <> 'MOTOR' then
    raise exception 'REGRA 8: a ação % só é executada pelo motor (veio de %)', new.codigo, p using errcode = '23514';
  end if;
  return new;
end;
$f$;

-- Regra 3 na entrega: só a execução atual da etapa grava, e uma vez só.
create or replace function helena_v2.trg_entrega_regra03() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare atual bigint;
begin
  select execucao_atual into atual from etapa where id = new.etapa_id;
  if atual is null or atual <> new.numero_execucao then
    raise exception 'REGRA 3: a entrega da execução % foi recusada: a execução atual da etapa é %', new.numero_execucao, atual using errcode = '23514';
  end if;
  return new;
end;
$f$;

create or replace function helena_v2.trg_entrega_so_o_relatorio() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare a jsonb := to_jsonb(old) - 'portao1' - 'relatorio_validacao'; b jsonb := to_jsonb(new) - 'portao1' - 'relatorio_validacao';
begin
  if a is distinct from b or old.portao1 is not null then
    raise exception 'REGRA 13: a entrega não muda; só o relatório do portão 1 entra, uma vez' using errcode = '42501';
  end if;
  return new;
end;
$f$;

-- Regra 3: o número da execução só sobe (nem a sequência, se alguém a reiniciar, pode repetir um número velho).
create or replace function helena_v2.trg_execucao_so_sobe() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if new.numero <= coalesce((select max(numero) from execucao), 0) then
    raise exception 'REGRA 3: o número de execução % não passa do maior já usado (nunca zera, nunca repete)', new.numero using errcode = '23514';
  end if;
  return new;
end;
$f$;

create or replace function helena_v2.trg_execucao_so_encerra() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare a jsonb := to_jsonb(old) - 'estado' - 'encerrada_em'; b jsonb := to_jsonb(new) - 'estado' - 'encerrada_em';
begin
  if a is distinct from b or (old.estado <> 'VIVA' and new.estado is distinct from old.estado) then
    raise exception 'REGRA 3: uma execução só muda de viva para encerrada, e o número nunca muda' using errcode = '42501';
  end if;
  return new;
end;
$f$;

-- Regras 6, 9 e 10 olhando o card inteiro (adiado: vale no fim da função única, depois dos sinais).
create or replace function helena_v2._conferir_plano(p_card uuid) returns void
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  codigos text[] := array(select codigo from etapa where card_id = p_card and atual);
  resto text[];
  prox text[];
begin
  if exists (select 1 from etapa e, unnest(e.depende_de) d where e.card_id = p_card and e.atual and not (d = any (codigos))) then
    raise exception 'REGRA 6: etapa que depende de etapa que não existe' using errcode = '23514';
  end if;
  if exists (select 1 from etapa e, unnest(e.julga) j where e.card_id = p_card and e.atual and not (j = any (e.depende_de))) then
    raise exception 'REGRA 6: etapa que julga outra de que não depende' using errcode = '23514';
  end if;
  resto := codigos;
  loop
    prox := array(select e.codigo from etapa e
                  where e.card_id = p_card and e.atual and e.codigo = any (resto)
                    and not exists (select 1 from unnest(e.depende_de) d where d = any (resto)));
    exit when cardinality(prox) = 0;
    resto := array(select x from unnest(resto) x where not (x = any (prox)));
  end loop;
  if cardinality(resto) > 0 then
    raise exception 'REGRA 6: ciclo de dependência entre as etapas %', resto using errcode = '23514';
  end if;
end;
$f$;

create or replace function helena_v2.conferir_card(p_card uuid) returns void
language plpgsql stable security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  c helena_v2.card;
  e record;
  d record;
begin
  select * into c from card where id = p_card;
  if c.id is null then
    return;
  end if;
  perform helena_v2._conferir_plano(p_card);
  for e in select et.codigo, et.depende_de, helena_v2.situacao_efetiva(et) as sit from etapa et
           where et.card_id = p_card and et.atual order by et.ordem loop
    if c.estado in ('PRONTO', 'CANCELADO', 'ENCERRADO_COM_FALHA') then
      -- regra 2: card fechado, etapa fechada; regra 9: card pronto só com todas prontas (ou puladas)
      if e.sit not in ('PRONTA', 'FIM_PAI', 'FALHOU', 'PULADA', 'ENCERROU') then
        raise exception 'REGRA 2: a etapa % continua em % com o card %', e.codigo, e.sit, c.estado using errcode = '23514';
      end if;
      if c.estado = 'PRONTO' and e.sit not in ('PRONTA', 'PULADA') then
        raise exception 'REGRA 9: card pronto com a etapa % em %', e.codigo, e.sit using errcode = '23514';
      end if;
    elsif c.estado not in ('EM_ANDAMENTO', 'ESPERANDO_FUNDADOR') then
      -- regra 6: etapa só anda com o card ativo
      if e.sit <> 'ESPERA' then
        raise exception 'REGRA 6: a etapa % anda (%) com o card em %', e.codigo, e.sit, c.estado using errcode = '23514';
      end if;
    else
      if e.sit in ('PRONTA', 'FIM_PAI') then
        raise exception 'REGRA 2: a etapa % está em % com o card aberto', e.codigo, e.sit using errcode = '23514';
      end if;
      if e.sit in ('TRABALHO', 'APROVADA', 'APROVADA_NAO_PODE') then
        -- regra 6: ninguém trabalha sem a anterior aprovada
        for d in select dd.codigo, helena_v2.situacao_efetiva(dd) as sit from etapa dd
                 where dd.card_id = p_card and dd.atual and dd.codigo = any (e.depende_de) loop
          if d.sit not in ('APROVADA', 'PULADA') then
            raise exception 'REGRA 6: a etapa % está em % com a anterior % em %', e.codigo, e.sit, d.codigo, d.sit using errcode = '23514';
          end if;
        end loop;
      end if;
    end if;
  end loop;
end;
$f$;

create or replace function helena_v2.trg_conferir_card_da_etapa() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  perform helena_v2.conferir_card(new.card_id);
  return null;
end;
$f$;

create or replace function helena_v2.trg_conferir_card_do_card() returns trigger
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  perform helena_v2.conferir_card(new.id);
  return null;
end;
$f$;

-- ---------------------------------------------------------------------------- CHECKs que citam colunas geradas
alter table helena_v2.card drop constraint if exists ck_card_prazo_finito;
alter table helena_v2.card add constraint ck_card_prazo_finito
  check (isfinite(prazo) and (prazo_ate is null or isfinite(prazo_ate)));
alter table helena_v2.etapa drop constraint if exists ck_etapa_prazo_finito;
alter table helena_v2.etapa add constraint ck_etapa_prazo_finito
  check (prazo_ate is null or isfinite(prazo_ate));
alter table helena_v2.acao_externa drop constraint if exists ck_acao_prazo_finito;
alter table helena_v2.acao_externa add constraint ck_acao_prazo_finito
  check (prazo_ate is null or isfinite(prazo_ate));

alter table helena_v2.etapa drop constraint if exists ck_etapa_regra03_execucao_viva;
alter table helena_v2.etapa add constraint ck_etapa_regra03_execucao_viva
  check ((exec_viva = 1) = (execucao_atual is not null));

-- regra 3: etapa executando sem execução viva (e sem número) não existe
alter table helena_v2.etapa drop constraint if exists ck_etapa_regra03_executando_tem_execucao;
alter table helena_v2.etapa add constraint ck_etapa_regra03_executando_tem_execucao
  check (estado <> 'EXECUTANDO' or exec_viva = 1);

alter table helena_v2.etapa drop constraint if exists ck_etapa_regra04_revisor;
alter table helena_v2.etapa add constraint ck_etapa_regra04_revisor
  check (revisor = 'NENHUM' or (revisor <> autor and revisor = any (revisores_validos) and not (revisor = any (julgadores))));

alter table helena_v2.etapa drop constraint if exists ck_etapa_regra09_aprovada_passou_portao;
alter table helena_v2.etapa add constraint ck_etapa_regra09_aprovada_passou_portao
  check (estado <> 'APROVADA' or (portao1_ok and entrega_fresca));

alter table helena_v2.etapa drop constraint if exists ck_etapa_regra10_pronta_fresca;
alter table helena_v2.etapa add constraint ck_etapa_regra10_pronta_fresca
  check (estado <> 'PRONTA' or entrega_fresca);

alter table helena_v2.acao_externa drop constraint if exists ck_acao_regra08_ok_antes_de_executar;
alter table helena_v2.acao_externa add constraint ck_acao_regra08_ok_antes_de_executar
  check (tentativas = 0 or ok_registrado = 1);

alter table helena_v2.historico drop constraint if exists ck_historico_regra08_so_o_motor_executa;
alter table helena_v2.historico add constraint ck_historico_regra08_so_o_motor_executa
  check (evento <> 'EXECUTAR_ACAO' or papel = 'MOTOR');

alter table helena_v2.historico drop constraint if exists ck_historico_regra11_toque_tem_destino;
alter table helena_v2.historico add constraint ck_historico_regra11_toque_tem_destino
  check (papel <> 'FUNDADOR' or resultado <> 'RECUSADO' or coalesce(motivo, '') in ('FORA_DO_VOCABULARIO', 'CONTEUDO_INVALIDO'));

-- ---------------------------------------------------------------------------- gatilhos nas tabelas
do $gatilhos$
declare
  t text;
begin
  -- tabelas de movimento: só a função única grava; ninguém apaga; ninguém trunca
  foreach t in array array['card', 'etapa', 'acao_externa', 'historico', 'entrega', 'execucao', 'mensagem'] loop
    execute format('drop trigger if exists a_so_pela_funcao on helena_v2.%I', t);
    execute format('create trigger a_so_pela_funcao before insert or update on helena_v2.%I for each row execute function helena_v2.trg_so_pela_funcao()', t);
    execute format('drop trigger if exists a_nunca_apagar on helena_v2.%I', t);
    execute format('create trigger a_nunca_apagar before delete on helena_v2.%I for each row execute function helena_v2.trg_nunca_apagar()', t);
    execute format('drop trigger if exists a_nunca_truncar on helena_v2.%I', t);
    execute format('create trigger a_nunca_truncar before truncate on helena_v2.%I for each statement execute function helena_v2.trg_nunca_truncar()', t);
  end loop;
  -- tabelas de regras: só por migração
  foreach t in array array['teto', 'variavel', 'config_nome', 'estado_def', 'prazo_def', 'macro', 'passagem', 'ligacao', 'automatico', 'reacao',
                           'regra_geral', 'vocab_evento', 'predicado_lista', 'entrada', 'identidade', 'meta_tabela'] loop
    execute format('drop trigger if exists a_so_por_migracao on helena_v2.%I', t);
    execute format('create trigger a_so_por_migracao before insert or update or delete on helena_v2.%I for each row execute function helena_v2.trg_tabela_de_regras()', t);
    execute format('drop trigger if exists a_so_por_migracao_truncar on helena_v2.%I', t);
    execute format('create trigger a_so_por_migracao_truncar before truncate on helena_v2.%I for each statement execute function helena_v2.trg_tabela_de_regras()', t);
  end loop;
end;
$gatilhos$;

drop trigger if exists b_historico_so_acrescenta on helena_v2.historico;
create trigger b_historico_so_acrescenta before update on helena_v2.historico for each row execute function helena_v2.trg_so_acrescenta();
drop trigger if exists b_mensagem_so_acrescenta on helena_v2.mensagem;
create trigger b_mensagem_so_acrescenta before update on helena_v2.mensagem for each row execute function helena_v2.trg_so_acrescenta();

drop trigger if exists b_final_nao_anda on helena_v2.card;
create trigger b_final_nao_anda before update on helena_v2.card for each row execute function helena_v2.trg_final_nao_anda();
drop trigger if exists b_final_nao_anda on helena_v2.etapa;
create trigger b_final_nao_anda before update on helena_v2.etapa for each row execute function helena_v2.trg_final_nao_anda();
drop trigger if exists b_final_nao_anda on helena_v2.acao_externa;
create trigger b_final_nao_anda before update on helena_v2.acao_externa for each row execute function helena_v2.trg_final_nao_anda();

drop trigger if exists b_campos_do_fundador on helena_v2.card;
create trigger b_campos_do_fundador before update on helena_v2.card for each row execute function helena_v2.trg_card_campos_do_fundador();

drop trigger if exists b_ficha_imutavel on helena_v2.etapa;
create trigger b_ficha_imutavel before update on helena_v2.etapa for each row
  execute function helena_v2.trg_ficha_imutavel('card_id', 'codigo', 'ordem', 'geracao', 'autor', 'revisores', 'revisores_validos', 'julgadores', 'depende_de', 'julga');
drop trigger if exists b_ficha_imutavel on helena_v2.acao_externa;
create trigger b_ficha_imutavel before update on helena_v2.acao_externa for each row
  execute function helena_v2.trg_ficha_imutavel('card_id', 'codigo', 'etapa_id', 'etapa_codigo', 'tipo');
drop trigger if exists b_ficha_imutavel on helena_v2.card;
create trigger b_ficha_imutavel before update on helena_v2.card for each row
  execute function helena_v2.trg_ficha_imutavel('card_pai_id', 'mensagem_id');

drop trigger if exists b_etapa_regras on helena_v2.etapa;
create trigger b_etapa_regras before update on helena_v2.etapa for each row execute function helena_v2.trg_etapa_regras();
drop trigger if exists b_acao_regras on helena_v2.acao_externa;
create trigger b_acao_regras before update on helena_v2.acao_externa for each row execute function helena_v2.trg_acao_regras();
drop trigger if exists b_entrega_regra03 on helena_v2.entrega;
create trigger b_entrega_regra03 before insert on helena_v2.entrega for each row execute function helena_v2.trg_entrega_regra03();
drop trigger if exists b_entrega_so_o_relatorio on helena_v2.entrega;
create trigger b_entrega_so_o_relatorio before update on helena_v2.entrega for each row execute function helena_v2.trg_entrega_so_o_relatorio();
drop trigger if exists b_execucao_so_sobe on helena_v2.execucao;
create trigger b_execucao_so_sobe before insert on helena_v2.execucao for each row execute function helena_v2.trg_execucao_so_sobe();
drop trigger if exists b_execucao_so_encerra on helena_v2.execucao;
create trigger b_execucao_so_encerra before update on helena_v2.execucao for each row execute function helena_v2.trg_execucao_so_encerra();

drop trigger if exists c_conferir_card on helena_v2.etapa;
create constraint trigger c_conferir_card after insert or update on helena_v2.etapa
  deferrable initially deferred for each row execute function helena_v2.trg_conferir_card_da_etapa();
drop trigger if exists c_conferir_card on helena_v2.card;
create constraint trigger c_conferir_card after insert or update on helena_v2.card
  deferrable initially deferred for each row execute function helena_v2.trg_conferir_card_do_card();

-- ---------------------------------------------------------------------------- permissões
-- Ninguém grava nas tabelas: os papéis comuns (anon, authenticated, service_role, se existirem) só leem e chamam a função.
revoke all on schema helena_v2 from public;
revoke all on all tables in schema helena_v2 from public;
revoke all on all sequences in schema helena_v2 from public;
revoke all on all functions in schema helena_v2 from public;

do $permissoes$
declare
  r text;
  f record;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    continue when not exists (select 1 from pg_roles where rolname = r);
    execute format('revoke all on all tables in schema helena_v2 from %I', r);
    execute format('revoke all on all sequences in schema helena_v2 from %I', r);
    execute format('revoke all on all functions in schema helena_v2 from %I', r);
    continue when r = 'anon';      -- quem não entrou não vê nada
    execute format('grant usage on schema helena_v2 to %I', r);
    if r = 'service_role' then
      execute format('grant select on all tables in schema helena_v2 to %I', r);
    end if;
    execute format('revoke all on helena_v2.conta_papel from %I', r);
    for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'helena_v2'
               and p.proname in ('aplicar_evento', 'disparar_automaticos', 'abrir_chamada_helena', 'criar_card',
                                 'tabela_confere', 'calcular_hash_das_linhas', 'vigia', 'conferir_historico', 'conferir_card', 'situacao_efetiva', 'situacao_da_etapa') loop
      execute format('grant execute on function %s to %I', f.assinatura, r);
    end loop;
  end loop;
  -- quem pode dizer qual papel: o app (usuário logado) é o fundador; o motor (service_role) é o resto
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    insert into helena_v2.conta_papel values ('authenticated', 'FUNDADOR') on conflict do nothing;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    insert into helena_v2.conta_papel
    select 'service_role', p from unnest(array['MOTOR', 'HELENA', 'AUTOR', 'REVISOR', 'RELOGIO', 'VIGIA']) p
    on conflict do nothing;
  end if;
end;
$permissoes$;

-- Sela a tabela: o banco guarda o hash das linhas que acabou de receber.
select set_config('helena_v2.migrando', 'sim', false);
select helena_v2.selar_tabela();
select set_config('helena_v2.migrando', 'nao', false);
