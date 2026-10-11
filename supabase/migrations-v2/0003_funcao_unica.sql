-- 0003 — A FUNÇÃO ÚNICA: helena_v2.aplicar_evento (e as poucas funções que a cercam).
-- O que é: o único caminho que muda o estado do card, da etapa e da ação externa. Acha a linha da tabela de
--          passagens, confere a guarda, aplica os efeitos nos contadores, muda o estado, grava o histórico e
--          aplica os sinais e os automáticos NA MESMA TRANSAÇÃO. Se nenhuma linha casa, recusa e registra o motivo.
-- De onde vem: escrito à mão, seguindo provar.py (Maquina.casar, Maquina.aplicar e replay) passo a passo.
--              As REGRAS (guardas, efeitos, tetos, sinais) NÃO estão aqui: vêm das tabelas geradas no 0002.
-- Como mudar: só mude o que for MECÂNICA (como se grava, como se trava). Regra do card muda no YAML.
--             Funções com _ no começo são internas: nenhum papel comum pode chamá-las.

-- ---------------------------------------------------------------------------- entrada e saída (trava de estado)
-- O gatilho de cada tabela só deixa gravar enquanto helena_v2.funcao_unica = 'sim'. Só as funções abaixo ligam isso,
-- e desligam ao sair (a profundidade conta as chamadas dentro de chamadas).
create or replace function helena_v2._entrar() returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare d integer := coalesce(nullif(current_setting('helena_v2.profundidade', true), '')::integer, 0);
begin
  perform set_config('helena_v2.profundidade', (d + 1)::text, true);
  perform set_config('helena_v2.funcao_unica', 'sim', true);
end;
$f$;

create or replace function helena_v2._sair() returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare d integer := coalesce(nullif(current_setting('helena_v2.profundidade', true), '')::integer, 1) - 1;
begin
  perform set_config('helena_v2.profundidade', greatest(d, 0)::text, true);
  if d <= 0 then
    perform set_config('helena_v2.funcao_unica', 'nao', true);
  end if;
end;
$f$;

-- Quem está chamando: o papel do SET ROLE (é assim que o Supabase entra) ou, sem ele, quem fez o login.
create or replace function helena_v2._conta() returns text
language sql stable set search_path = pg_catalog as $f$
  select case when coalesce(nullif(current_setting('role', true), ''), 'none') = 'none'
              then session_user::text else current_setting('role') end;
$f$;

-- A conta pode dizer que é este papel? Conta com linhas em conta_papel só diz o que está lá;
-- conta sem linhas só passa se for superusuária ou a dona do schema (é quem aplica as migrações).
create or replace function helena_v2._conferir_conta(p_papeis text[]) returns void
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare v_conta text := helena_v2._conta();
begin
  if exists (select 1 from conta_papel where conta = v_conta) then
    if not exists (select 1 from conta_papel where conta = v_conta and papel = any (p_papeis)) then
      raise exception 'PAPEL_NAO_PERMITIDO: a conta % não pode agir como %', v_conta, p_papeis using errcode = '42501';
    end if;
  elsif not (exists (select 1 from pg_roles where rolname = v_conta and rolsuper)
             or v_conta = (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'helena_v2')) then
    raise exception 'PAPEL_NAO_PERMITIDO: a conta % não tem nenhum papel em helena_v2.conta_papel', v_conta using errcode = '42501';
  end if;
end;
$f$;

-- ---------------------------------------------------------------------------- leituras que as guardas usam
create or replace function helena_v2._lista_predicado(p_nome text) returns text[]
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select coalesce(array_agg(situacao order by situacao), '{}'::text[]) from predicado_lista where nome = p_nome;
$f$;

-- Como o card enxerga a etapa: a situação do YAML, mais a marca "pulada" que só o fundador põe.
create or replace function helena_v2.situacao_efetiva(e helena_v2.etapa) returns text
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select case when s = any (helena_v2._lista_predicado('falha_que_pergunta')) and e.pulada then 'PULADA' else s end
  from (select helena_v2.situacao_da_etapa(e.estado, to_jsonb(e)) as s) x;
$f$;

create or replace function helena_v2._predicados_card(p_card uuid) returns jsonb
language sql stable set search_path = helena_v2, pg_catalog as $f$
  with et as (
    select e.pulavel, helena_v2.situacao_efetiva(e) as sit from etapa e where e.card_id = p_card and e.atual
  )
  select jsonb_build_object(
    -- um card sem etapa nunca está "todo pronto" (o provar nunca tem card assim)
    'todas_prontas', (select count(*) > 0 and bool_and(sit = any (helena_v2._lista_predicado('conta_como_pronta'))) from et),
    'falha_sem_decisao', (select coalesce(bool_or(sit = any (helena_v2._lista_predicado('falha_que_pergunta'))), false) from et),
    'nao_pode_sem_decisao', (select coalesce(bool_or(sit = 'APROVADA_NAO_PODE'), false) from et),
    'falhas_pulaveis', (select coalesce(bool_and(pulavel) filter (where sit = any (helena_v2._lista_predicado('falha_que_pergunta'))), true) from et)
  );
$f$;

create or replace function helena_v2._anteriores_satisfeitas(p_card uuid, p_depende text[]) returns boolean
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select coalesce(bool_and(helena_v2.situacao_efetiva(d) = any (helena_v2._lista_predicado('satisfaz_dependencia'))), true)
  from etapa d where d.card_id = p_card and d.atual and d.codigo = any (p_depende);
$f$;

-- O que as guardas leem além das variáveis: a ficha da etapa, os predicados calculados e os parâmetros do evento.
create or replace function helena_v2._montar_q(p_maquina text, v jsonb, p_card uuid, p_params jsonb) returns jsonb
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare q jsonb;
begin
  select coalesce(jsonb_object_agg(nome, v -> nome), '{}'::jsonb) into q from config_nome where maquina = p_maquina;
  q := q || coalesce(p_params, '{}'::jsonb);
  if p_maquina = 'card' then
    q := q || helena_v2._predicados_card(p_card);
  elsif p_maquina = 'etapa' then
    q := q || jsonb_build_object('anteriores_satisfeitas',
      helena_v2._anteriores_satisfeitas(p_card, array(select jsonb_array_elements_text(v -> 'depende_de'))));
    if coalesce(p_params, '{}'::jsonb) ? 'escolhido' then
      q := q || jsonb_build_object('revisor_valido', (v -> 'revisores_validos') ? (p_params ->> 'escolhido'));
    end if;
  end if;
  return q;
end;
$f$;

-- Os contadores compartilhados (ordens, perguntas, voltas) moram no card; a etapa os enxerga por aqui.
create or replace function helena_v2._compartilhadas(vc jsonb) returns jsonb
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select coalesce(jsonb_object_agg(nome, vc -> nome), '{}'::jsonb) from variavel where maquina = 'etapa' and compartilhada;
$f$;

-- Carrega o alvo: o card, o estado dele e as variáveis da máquina (a etapa enxerga os contadores compartilhados do card).
create or replace function helena_v2._carregar(p_maquina text, p_alvo uuid, out o_card uuid, out o_v jsonb, out o_vc jsonb)
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
begin
  if p_maquina = 'card' then
    o_card := p_alvo;
  elsif p_maquina = 'etapa' then
    select card_id into o_card from etapa where id = p_alvo;
  elsif p_maquina = 'acao_externa' then
    select card_id into o_card from acao_externa where id = p_alvo;
  else
    raise exception 'máquina desconhecida: %', p_maquina;
  end if;
  if o_card is null then
    raise exception 'alvo não existe: % %', p_maquina, p_alvo;
  end if;
  select to_jsonb(c) into o_vc from card c where c.id = o_card;
  if p_maquina = 'card' then
    o_v := o_vc;
  elsif p_maquina = 'etapa' then
    select to_jsonb(e) into o_v from etapa e where e.id = p_alvo;
    o_v := o_v || helena_v2._compartilhadas(o_vc);
  else
    select to_jsonb(a) into o_v from acao_externa a where a.id = p_alvo;
  end if;
end;
$f$;

-- ---------------------------------------------------------------------------- achar a linha (provar: Maquina.casar)
-- Devolve o linha_id que casa, ou nulo. Aplica as regras gerais da tabela (chave, versão vista, card ativo, ator),
-- confere o domínio dos parâmetros e só então a guarda. Duas linhas para o mesmo evento é defeito da tabela: recusa tudo.
create or replace function helena_v2._achar_linha(
  p_maquina text, p_papel text, p_evento text, v jsonb, q jsonb, p_params jsonb,
  p_ator text, p_chave bigint, p_versao_vista integer, p_estado_card text
) returns text
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare
  c record;
  rg jsonb;
  dom jsonb;
  k text;
  ok boolean;
  achou text[] := '{}';
begin
  if not exists (select 1 from passagem where maquina = p_maquina and de = v ->> 'estado' and evento = p_evento and papel = p_papel) then
    return null;
  end if;
  -- chave da chamada atual (regra 3): autor e revisor pela execução viva da etapa; a Helena pela chamada dela
  select valor into rg from regra_geral where chave = 'respostas_de_agente_exigem_chave_atual';
  if rg ? p_papel then
    if p_papel in ('AUTOR', 'REVISOR') then
      if (v ->> 'execucao_atual') is null or p_chave is distinct from (v ->> 'execucao_atual')::bigint then
        return null;
      end if;
    elsif (v ->> 'chamada_helena') is null or p_chave is distinct from (v ->> 'chamada_helena')::bigint then
      return null;
    end if;
  end if;
  -- toque seu sobre versão que você não viu nunca muda estado (A-6)
  select valor into rg from regra_geral where chave = 'toques_do_fundador_exigem_versao_vista';
  if p_papel = 'FUNDADOR' and rg ? p_evento and p_versao_vista is distinct from (v ->> 'versao')::integer then
    return null;
  end if;
  -- regra 6: a etapa só anda com o card ativo, menos nos eventos que o próprio card manda ao fechar
  if p_maquina = 'etapa' then
    select valor into rg from regra_geral where chave = 'etapa_so_anda_com_card_ativo';
    if not ((rg -> 'exceto') ? p_evento) and not ((rg -> 'card_ativo') ? p_estado_card) then
      return null;
    end if;
    -- só o autor da etapa responde como autor
    if p_papel = 'AUTOR' and p_ator is not null and p_ator <> v ->> 'autor' then
      return null;
    end if;
    -- regra 4: só o revisor designado responde como revisor
    if p_papel = 'REVISOR' and p_ator is distinct from v ->> 'revisor'
       and coalesce((select valor from regra_geral where chave = 'respostas_de_revisor_exigem_revisor_designado')::boolean, true) then
      return null;
    end if;
  end if;
  -- parâmetros: todos os do vocabulário, cada um dentro do domínio fechado, e nenhum a mais
  select parametros into dom from vocab_evento where papel = p_papel and evento = p_evento;
  if dom is null then
    return null;
  end if;
  if exists (select 1 from jsonb_each(dom) d
             where not (coalesce(p_params, '{}'::jsonb) ? d.key) or not (d.value ? (p_params ->> d.key))) then
    return null;
  end if;
  if exists (select 1 from jsonb_object_keys(coalesce(p_params, '{}'::jsonb)) pk where not (dom ? pk)) then
    return null;
  end if;
  for c in select * from passagem where maquina = p_maquina and de = v ->> 'estado' and evento = p_evento and papel = p_papel order by ordem loop
    ok := true;
    for k in select jsonb_object_keys(c.checa_param) loop
      if (p_params ->> k) is null or not ((c.checa_param -> k) ? (p_params ->> k)) then
        ok := false;
      end if;
    end loop;
    if ok and (c.guarda is null or helena_v2.guarda(c.base_id, v, q)) then
      achou := achou || c.linha_id;
    end if;
  end loop;
  if cardinality(achou) > 1 then
    raise exception 'REGRA 13: duas linhas para % % em %: %', p_papel, p_evento, v ->> 'estado', achou using errcode = 'P0001';
  end if;
  return achou[1];
end;
$f$;

-- ---------------------------------------------------------------------------- efeitos, dono e prazo
create or replace function helena_v2._efeitos(v jsonb, p_ops jsonb, p_params jsonb) returns jsonb
language plpgsql immutable set search_path = helena_v2, pg_catalog as $f$
declare op jsonb;
begin
  for op in select * from jsonb_array_elements(p_ops) loop
    case op ->> 'op'
      when 'set' then v := jsonb_set(v, array[op ->> 'v'], op -> 'val');
      when 'add' then v := jsonb_set(v, array[op ->> 'v'], to_jsonb((v ->> (op ->> 'v'))::integer + (op ->> 'n')::integer));
      when 'param' then v := jsonb_set(v, array[op ->> 'v'], to_jsonb(p_params ->> (op ->> 'p')));
      else raise exception 'efeito desconhecido: %', op;
    end case;
  end loop;
  return v;
end;
$f$;

create or replace function helena_v2._dono(p_maquina text, p_estado text, v jsonb) returns text
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select case d.dono when 'AUTOR' then v ->> 'autor'
                     when 'REVISOR' then nullif(v ->> 'revisor', 'NENHUM')
                     else d.dono end
  from estado_def d where d.maquina = p_maquina and d.estado = p_estado;
$f$;

-- Até quando vale o estado (regra 1). 'card' = o prazo do card; 'duracao' = o tempo escrito no YAML;
-- 'ficha' = o da ficha do agente (no roteiro da etapa); 'espera' = o que quem chama disser. Faltando, vale o prazo do card.
create or replace function helena_v2._prazo_ate(p_maquina text, p_estado text, v jsonb, p_card_prazo timestamptz, p_prazo_espera timestamptz)
returns timestamptz
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select case pz.origem
    when 'card' then p_card_prazo
    when 'duracao' then now() + make_interval(secs => pz.segundos)
    when 'ficha' then coalesce(now() + make_interval(secs => (v ->> pz.campo_da_ficha)::integer), p_card_prazo)
    else coalesce(p_prazo_espera, p_card_prazo) end
  from estado_def d join prazo_def pz on pz.nome = d.prazo
  where d.maquina = p_maquina and d.estado = p_estado;
$f$;

-- O estado em que cada máquina nasce (marcado como inicial no YAML).
create or replace function helena_v2._estado_inicial(p_maquina text) returns text
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select estado from estado_def where maquina = p_maquina and inicial;
$f$;

-- Grava a linha inteira de volta (as colunas vêm do catálogo; v é o jsonb novo da linha).
create or replace function helena_v2._gravar(p_tabela text, p_id uuid, v jsonb) returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare v_set text;
begin
  select string_agg(format('%I = r.%I', a.attname, a.attname), ', ' order by a.attnum) into v_set
  from pg_attribute a
  where a.attrelid = format('helena_v2.%I', p_tabela)::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'criado_em');
  execute format('update helena_v2.%I t set %s from jsonb_populate_record(null::helena_v2.%I, $1) r where t.id = $2', p_tabela, v_set, p_tabela)
    using v, p_id;
end;
$f$;

-- As variáveis e o estado de um alvo (o que vai para o histórico). A etapa leva também os contadores do card.
create or replace function helena_v2._so_variaveis(p_maquina text, v jsonb) returns jsonb
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select jsonb_build_object('estado', v -> 'estado', 'versao', v -> 'versao')
         || coalesce((select jsonb_object_agg(nome, v -> nome) from variavel where maquina = p_maquina), '{}'::jsonb)
         || case when p_maquina = 'etapa'
                 then coalesce((select jsonb_object_agg(nome, v -> nome) from variavel where maquina = 'card' and compartilhada), '{}'::jsonb)
                 else '{}'::jsonb end;
$f$;

-- ---------------------------------------------------------------------------- alvos dos sinais (provar: entregar)
create or replace function helena_v2._alvos_do_sinal(p_card uuid, p_alvo text, p_origem uuid) returns uuid[]
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare
  o helena_v2.etapa;
  r uuid[];
  aberta text[] := helena_v2._lista_predicado('aberta');
begin
  if p_origem is not null then
    select * into o from etapa where id = p_origem;
  end if;
  case p_alvo
    when 'card' then
      return array[p_card];
    when 'acoes_abertas' then
      select coalesce(array_agg(a.id order by substring(a.codigo from 2)::integer), '{}') into r
      from acao_externa a join estado_def d on d.maquina = 'acao_externa' and d.estado = a.estado
      where a.card_id = p_card and not d.final;
    when 'etapas_abertas' then
      select coalesce(array_agg(e.id order by e.ordem), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and helena_v2.situacao_efetiva(e) = any (aberta);
    when 'etapas_aprovadas' then
      select coalesce(array_agg(e.id order by e.ordem), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and helena_v2.situacao_efetiva(e) in ('APROVADA', 'APROVADA_NAO_PODE');
    when 'etapas_abertas_que_usam_decisao' then
      select coalesce(array_agg(e.id order by e.ordem), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and e.usa_decisao and helena_v2.situacao_efetiva(e) = any (aberta);
    when 'dependentes_diretos_abertos' then
      select coalesce(array_agg(e.id order by e.ordem), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and o.codigo = any (e.depende_de) and helena_v2.situacao_efetiva(e) = any (aberta);
    when 'julgadas_abertas' then
      select coalesce(array_agg(e.id order by array_position(o.julga, e.codigo)), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and e.codigo = any (o.julga) and helena_v2.situacao_efetiva(e) = any (aberta);
    when 'julgadas_de_nao_pode' then
      select coalesce(array_agg(e.id order by e.codigo collate "C"), '{}') into r from etapa e
      where e.card_id = p_card and e.atual and helena_v2.situacao_efetiva(e) = any (aberta)
        and e.codigo in (select unnest(j.julga) from etapa j
                         where j.card_id = p_card and j.atual and helena_v2.situacao_efetiva(j) = 'APROVADA_NAO_PODE');
    else
      raise exception 'alvo de sinal desconhecido: %', p_alvo;
  end case;
  return r;
end;
$f$;

-- ---------------------------------------------------------------------------- card novo ligado
create or replace function helena_v2._criar_card_ligado(p_origem uuid, p_motivo text, p_hist bigint) returns uuid
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare
  o helena_v2.card;
  v_novo uuid;
  v jsonb;
begin
  select * into o from card where id = p_origem;
  insert into card (titulo, empresa, ordem_de_servico, prioridade, prazo, card_pai_id, pedido_grande, dono, prazo_ate)
  values (o.titulo, o.empresa, o.ordem_de_servico, o.prioridade, o.prazo, p_origem, o.pedido_grande,
          helena_v2._dono('card', helena_v2._estado_inicial('card'), '{}'::jsonb),
          helena_v2._prazo_ate('card', helena_v2._estado_inicial('card'), '{}'::jsonb, o.prazo, null))
  returning id into v_novo;
  select to_jsonb(c) into v from card c where c.id = v_novo;
  insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, conteudo, resultado, motivo, origem, origem_id,
                         estado_depois, vars_depois, conta)
  values (v_novo, 'card', v_novo, 'card', 'MOTOR', 'CARD_CRIADO', '{}'::jsonb,
          jsonb_build_object('ligado_a', p_origem, 'motivo', p_motivo), 'APLICADO', null,
          case when p_hist is null then 'EXTERNO' else 'SINAL' end, p_hist,
          v ->> 'estado', helena_v2._so_variaveis('card', v), helena_v2._conta());
  return v_novo;
end;
$f$;

-- ---------------------------------------------------------------------------- campos que só o fundador muda (regra 7)
create or replace function helena_v2._mudar_campo_do_fundador(p_card uuid, p_campo text, p_conteudo jsonb) returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare novo text := p_conteudo ->> p_campo;
begin
  if novo is null then
    raise exception 'REGRA 7: mudar % exige o valor novo em conteudo.%', p_campo, p_campo;
  end if;
  perform set_config('helena_v2.campo_do_fundador', 'sim', true);
  if p_campo = 'prazo' then
    update card set prazo = novo::timestamptz, atualizado_em = now() where id = p_card;
    -- o prazo do card vale para o card e para as etapas que esperam dentro dele
    update card c set prazo_ate = c.prazo from estado_def d join prazo_def pz on pz.nome = d.prazo
      where c.id = p_card and d.maquina = 'card' and d.estado = c.estado and pz.origem = 'card';
    update etapa e set prazo_ate = c.prazo from card c, estado_def d join prazo_def pz on pz.nome = d.prazo
      where e.card_id = p_card and c.id = p_card and e.atual and d.maquina = 'etapa' and d.estado = e.estado and pz.origem = 'card';
  elsif p_campo = 'prioridade' then
    update card set prioridade = novo::integer, atualizado_em = now() where id = p_card;
  else
    raise exception 'campo desconhecido: %', p_campo;
  end if;
  perform set_config('helena_v2.campo_do_fundador', 'nao', true);
end;
$f$;

-- ---------------------------------------------------------------------------- ações dos sinais "no card"
create or replace function helena_v2._acao_no_card(p_nome text, p_sinal text, p_card uuid, p_maquina text, p_alvo uuid, p_hist bigint) returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare
  e helena_v2.etapa;
  n helena_v2.etapa;
  vn jsonb;
  vc jsonb;
  v_prazo timestamptz;
  falha text[] := helena_v2._lista_predicado('falha_que_pergunta');
  v_tipo text;
  v_cod text;
  v_id uuid;
  va jsonb;
begin
  select to_jsonb(c) into vc from card c where c.id = p_card;
  v_prazo := (vc ->> 'prazo')::timestamptz;
  if p_nome = 'marcar_falhas_como_puladas' then
    for e in select * from etapa where card_id = p_card and atual order by ordem loop
      if helena_v2.situacao_da_etapa(e.estado, to_jsonb(e)) = any (falha) then
        update etapa set pulada = true, atualizado_em = now() where id = e.id;
        insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, resultado, origem, origem_id, estado_antes, estado_depois, vars_antes, vars_depois, conta)
        values (p_card, 'etapa', e.id, e.codigo, 'MOTOR', p_sinal, 'APLICADO', 'SINAL', p_hist, e.estado, e.estado,
                helena_v2._so_variaveis('etapa', to_jsonb(e) || helena_v2._compartilhadas(vc)), helena_v2._so_variaveis('etapa', to_jsonb(e) || helena_v2._compartilhadas(vc)), helena_v2._conta());
      end if;
    end loop;
  elsif p_nome = 'nova_versao_das_falhas' then
    -- a etapa final continua final no histórico; nasce uma versão nova dela, com as suas respostas guardadas
    for e in select * from etapa where card_id = p_card and atual and not pulada order by ordem loop
      if helena_v2.situacao_da_etapa(e.estado, to_jsonb(e)) = any (falha) then
        update etapa set atual = false, atualizado_em = now() where id = e.id;
        vn := to_jsonb(e)
              || (select jsonb_object_agg(nome, inicial) from variavel where maquina = 'etapa' and not compartilhada)
              || jsonb_build_object(
                   'id', gen_random_uuid(), 'criado_em', now(), 'atualizado_em', now(), 'geracao', e.geracao + 1, 'atual', true,
                   'estado', (select estado from estado_def where maquina = 'etapa' and inicial),
                   'versao', 1, 'execucao_atual', null, 'chamada_helena', null, 'pulada', false,
                   'respostas_guardadas', '[]'::jsonb, 'respostas_da_versao', to_jsonb(e.respostas_guardadas),
                   'portao1_ok', false, 'entrega_fresca', true);
        vn := vn || jsonb_build_object('dono', helena_v2._dono('etapa', vn ->> 'estado', vn),
                                       'prazo_ate', helena_v2._prazo_ate('etapa', vn ->> 'estado', vn, v_prazo, null));
        insert into etapa select * from jsonb_populate_record(null::helena_v2.etapa, vn);
        insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, resultado, origem, origem_id, estado_antes, estado_depois, vars_antes, vars_depois, conta)
        values (p_card, 'etapa', (vn ->> 'id')::uuid, e.codigo, 'MOTOR', p_sinal, 'APLICADO', 'SINAL', p_hist, e.estado, vn ->> 'estado',
                helena_v2._so_variaveis('etapa', to_jsonb(e) || helena_v2._compartilhadas(vc)), helena_v2._so_variaveis('etapa', vn || helena_v2._compartilhadas(vc)), helena_v2._conta());
      end if;
    end loop;
  elsif p_nome = 'criar_acao_externa' then
    -- só a E110 emite: etapa pronta, card pronto, entrega fresca; no máximo uma ação por etapa (índice único)
    select * into e from etapa where id = p_alvo;
    if e.estado <> 'PRONTA' or vc ->> 'estado' <> 'PRONTO' then
      raise exception 'REGRA 8: a ação externa só nasce de etapa pronta com o card pronto (etapa %, card %)', e.estado, vc ->> 'estado';
    end if;
    if not e.entrega_fresca then
      raise exception 'REGRA 10: a ação externa não nasce de entrega velha (etapa %)', e.codigo;
    end if;
    select acao_externa into v_tipo from entrega where etapa_id = e.id order by id desc limit 1;
    if coalesce(v_tipo, 'NENHUMA') <> 'NENHUMA' then
      select 'A' || (count(*) + 1)::text into v_cod from acao_externa where card_id = p_card;
      insert into acao_externa (card_id, codigo, etapa_id, etapa_codigo, tipo, tem_ferramenta, dono, prazo_ate)
      values (p_card, v_cod, e.id, e.codigo, v_tipo, v_tipo = 'PELO_MOTOR',
              helena_v2._dono('acao_externa', helena_v2._estado_inicial('acao_externa'), '{}'::jsonb),
              helena_v2._prazo_ate('acao_externa', helena_v2._estado_inicial('acao_externa'), '{}'::jsonb, v_prazo, null))
      returning id into v_id;
      select to_jsonb(a) into va from acao_externa a where a.id = v_id;
      insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, resultado, origem, origem_id, estado_depois, vars_depois, conta)
      values (p_card, 'acao_externa', v_id, v_cod, 'MOTOR', p_sinal, jsonb_build_object('origem', e.codigo, 'tipo', v_tipo),
              'APLICADO', 'SINAL', p_hist, va ->> 'estado', helena_v2._so_variaveis('acao_externa', va), helena_v2._conta());
    end if;
  elsif p_nome = 'criar_card_ligado' then
    perform helena_v2._criar_card_ligado(p_card, p_sinal, p_hist);
  else
    raise exception 'ação no card desconhecida: %', p_nome;
  end if;
end;
$f$;

-- ---------------------------------------------------------------------------- aplicar UM evento (provar: replay.um_evento + aplicar)
create or replace function helena_v2._aplicar(
  p_maquina text, p_alvo uuid, p_papel text, p_evento text, p_params jsonb,
  p_ator text, p_chave bigint, p_versao_vista integer, p_conteudo jsonb,
  p_origem text, p_origem_id bigint, p_toque text, p_prazo_espera timestamptz
) returns jsonb
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare
  v_params jsonb := coalesce(p_params, '{}'::jsonb);
  v_params_ef jsonb;
  v_papel_ef text := p_papel;
  v_evento_ef text := p_evento;
  v_card uuid;
  v jsonb;
  vc jsonb;
  q jsonb;
  v_estado_card text;
  v_codigo text;
  v_linha_id text := null;
  v_linha helena_v2.passagem;
  v_novo jsonb;
  v_motivo text;
  v_conv text := null;
  v_resultado text;
  v_hist bigint;
  v_reacao helena_v2.reacao;
  v_num bigint;
  v_antes integer;
  v_depois integer;
  v_gp boolean;
  v_gf boolean;
  v_campo text;
  v_sinal text;
  v_lig helena_v2.ligacao;
  v_alvo_nome text;
  v_alvo uuid;
  v_alvos uuid[];
  v_r jsonb;
  v_maq_alvo text;
  rec jsonb;
  abre jsonb;
  final_dest text;
  v_card_final boolean;
  v_e_final boolean;
  v_tem_vocab boolean;
  v_vars_antes jsonb;
  v_vars_depois jsonb;
  v_novo_card jsonb;
begin
  select o_card, o_v, o_vc into v_card, v, vc from helena_v2._carregar(p_maquina, p_alvo);
  perform 1 from card where id = v_card for update;          -- um evento por vez em cada card
  select o_card, o_v, o_vc into v_card, v, vc from helena_v2._carregar(p_maquina, p_alvo);
  v_estado_card := vc ->> 'estado';
  v_codigo := case p_maquina when 'card' then 'card' else v ->> 'codigo' end;

  -- o mesmo toque (número único) nunca repete o efeito
  if p_toque is not null then
    select id into v_hist from historico where card_id = v_card and numero_toque = p_toque;
    if found then
      return jsonb_build_object('resultado', 'REPETIDO', 'historico_id', v_hist);
    end if;
  end if;

  select exists (select 1 from vocab_evento where papel = p_papel and evento = p_evento) into v_tem_vocab;
  if not v_tem_vocab then
    v_motivo := 'FORA_DO_VOCABULARIO';
  elsif p_origem <> 'SINAL' and exists (select 1 from regra_geral where chave = 'entradas_so_por_sinal' and valor = 'true'::jsonb)
        and exists (select 1 from entrada where maquina = p_maquina and evento = p_evento) then
    v_motivo := 'ENTRADA_SO_POR_SINAL';
  else
    q := helena_v2._montar_q(p_maquina, v, v_card, v_params);
    v_linha_id := helena_v2._achar_linha(p_maquina, p_papel, p_evento, v, q, v_params, p_ator, p_chave, p_versao_vista, v_estado_card);
    v_params_ef := v_params;
    v_motivo := 'SEM_PASSAGEM_NESTE_ESTADO';
    if v_linha_id is null and p_maquina = 'etapa' and p_papel in ('AUTOR', 'REVISOR')
       and (v ->> 'execucao_atual') is not null and p_chave = (v ->> 'execucao_atual')::bigint
       and ((p_papel = 'AUTOR' and coalesce(p_ator, v ->> 'autor') = v ->> 'autor') or (p_papel = 'REVISOR' and p_ator = v ->> 'revisor')) then
      -- resposta de agente sem linha = FORMATO_ERRADO (regras_gerais.resposta_de_agente_sem_linha)
      select valor into rec from regra_geral where chave = 'resposta_de_agente_sem_linha';
      v_params_ef := coalesce(rec -> 'parametros', '{}'::jsonb);
      q := helena_v2._montar_q(p_maquina, v, v_card, v_params_ef);
      v_linha_id := helena_v2._achar_linha(p_maquina, rec ->> 'papel', rec ->> 'evento', v, q, v_params_ef, null, null, null, v_estado_card);
      if v_linha_id is not null then
        v_conv := (rec ->> 'papel') || ' ' || (rec ->> 'evento');
        v_papel_ef := rec ->> 'papel';
        v_evento_ef := rec ->> 'evento';
      end if;
    end if;
  end if;

  v_vars_antes := helena_v2._so_variaveis(p_maquina, v);

  -- ======================================================= a linha casou: aplica
  if v_linha_id is not null then
    select * into v_linha from passagem where maquina = p_maquina and linha_id = v_linha_id;
    v_novo := helena_v2._efeitos(v, v_linha.efeitos, v_params_ef) || jsonb_build_object('estado', v_linha.para);
    if v_linha.sobe_versao then
      v_novo := jsonb_set(v_novo, '{versao}', to_jsonb((v ->> 'versao')::integer + 1));
    end if;
    if p_maquina = 'etapa' then
      -- regra 3: a execução viva ganha um número da sequência (nunca zera); ao sair de viva, o número morre
      v_antes := (v ->> 'exec_viva')::integer;
      v_depois := (v_novo ->> 'exec_viva')::integer;
      if v_antes = 0 and v_depois = 1 then
        insert into execucao (tipo, card_id, etapa_id)
        values (case when v_linha.para = 'EXECUTANDO' then 'AUTOR' else 'REVISOR' end, v_card, p_alvo)
        returning numero into v_num;
        v_novo := jsonb_set(v_novo, '{execucao_atual}', to_jsonb(v_num));
      elsif v_depois = 0 then
        v_novo := jsonb_set(v_novo, '{execucao_atual}', 'null'::jsonb);
      end if;
      -- regras 9 e 10: a entrega atual passou no portão 1? usa a informação atual?
      v_gp := (v ->> 'portao1_ok')::boolean;
      v_gf := (v ->> 'entrega_fresca')::boolean;
      if v_evento_ef = 'INICIAR_EXECUCAO' then
        v_gf := true;
        v_gp := false;
      elsif exists (select 1 from regra_geral where chave = 'eventos_que_envelhecem' and valor ? v_evento_ef)
            or exists (select 1 from regra_geral g, jsonb_array_elements(g.valor) t
                       where g.chave = 'toques_que_envelhecem' and t ->> 'papel' = v_papel_ef and t ->> 'evento' = v_evento_ef) then
        v_gf := false;
        v_gp := false;
      end if;
      if v_evento_ef = 'ENTREGAR' or v_novo ->> 'semaforo' = 'NENHUM' or v_evento_ef = 'PORTAO1_RECUSOU' then
        v_gp := false;
      end if;
      if v_evento_ef = 'PORTAO1_OK' then
        v_gp := true;
      end if;
      v_novo := v_novo || jsonb_build_object('portao1_ok', v_gp, 'entrega_fresca', v_gf);
    end if;
    -- a chamada da Helena é de uso único: ao responder, a chave morre
    if p_papel = 'HELENA' then
      v_novo := jsonb_set(v_novo, '{chamada_helena}', 'null'::jsonb);
    end if;
    -- regra 1: dono e prazo do estado novo
    v_novo := v_novo || jsonb_build_object('dono', helena_v2._dono(p_maquina, v_linha.para, v_novo),
                                           'prazo_ate', helena_v2._prazo_ate(p_maquina, v_linha.para, v_novo, (vc ->> 'prazo')::timestamptz, p_prazo_espera),
                                           'atualizado_em', now());
    v_vars_depois := helena_v2._so_variaveis(p_maquina, v_novo);
    v_resultado := case when v_conv is null then 'APLICADO' else 'CONVERTIDO' end;

    insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, ator, chave, versao_vista, conteudo, linha_id,
                           resultado, origem, origem_id, estado_antes, estado_depois, vars_antes, vars_depois, convertido_em, numero_toque, conta)
    values (v_card, p_maquina, p_alvo, v_codigo, p_papel, p_evento, v_params, p_ator, p_chave, p_versao_vista, p_conteudo, v_linha_id,
            v_resultado, p_origem, p_origem_id, v ->> 'estado', v_linha.para, v_vars_antes, v_vars_depois, v_conv, p_toque, helena_v2._conta())
    returning id into v_hist;

    if p_maquina = 'etapa' then
      if v_evento_ef = 'ENTREGAR' then
        insert into entrega (card_id, etapa_id, etapa_codigo, versao, numero_execucao, autor, parecer, acao_externa, usou_internet, conteudo, historico_id)
        values (v_card, p_alvo, v_codigo, (v_novo ->> 'versao')::integer, (v ->> 'execucao_atual')::bigint, v ->> 'autor',
                v_params ->> 'parecer', v_params ->> 'acao_externa', v_params ->> 'usou_internet', coalesce(p_conteudo, '{}'::jsonb), v_hist);
      elsif v_evento_ef in ('PORTAO1_OK', 'PORTAO1_RECUSOU') then
        update entrega set portao1 = case v_evento_ef when 'PORTAO1_OK' then 'PASSOU' else 'RECUSOU' end, relatorio_validacao = p_conteudo
        where id = (select max(id) from entrega where etapa_id = p_alvo and portao1 is null);
        if not found then
          raise exception 'REGRA 9: portão 1 sem entrega para conferir (etapa %)', v_codigo;
        end if;
      end if;
      if v_antes = 1 and v_depois = 0 then
        update execucao set estado = case when p_papel in ('AUTOR', 'REVISOR') then 'RESPONDIDA' else 'MORTA' end, encerrada_em = now()
        where numero = (v ->> 'execucao_atual')::bigint;
      end if;
    end if;
    if p_papel = 'HELENA' and (v ->> 'chamada_helena') is not null then
      update execucao set estado = 'RESPONDIDA', encerrada_em = now() where numero = (v ->> 'chamada_helena')::bigint;
    end if;

    -- quem e o quê mudou o estado: as travas das regras 5, 8 e 9 leem isto (não confiam na tabela)
    perform set_config('helena_v2.papel_evento', v_papel_ef, true);
    perform set_config('helena_v2.evento_atual', v_evento_ef, true);
    perform helena_v2._gravar(p_maquina, p_alvo, v_novo);
    if p_maquina = 'etapa' then
      -- os contadores compartilhados (ordens, perguntas, voltas) moram no card
      v_novo_card := vc || helena_v2._compartilhadas(v_novo);
      if v_novo_card is distinct from vc then
        perform helena_v2._gravar('card', v_card, v_novo_card || jsonb_build_object('atualizado_em', now()));
      end if;
    end if;
    -- regra 7: só o fundador muda prioridade e prazo
    select muda_campo into v_campo from vocab_evento where papel = p_papel and evento = p_evento;
    if v_campo is not null and p_maquina = 'card' and p_papel = 'FUNDADOR' then
      perform helena_v2._mudar_campo_do_fundador(v_card, v_campo, p_conteudo);
    end if;

    -- sinais: na mesma transação, com a linha de histórico de origem
    foreach v_sinal in array v_linha.sinais loop
      select * into v_lig from ligacao where nome = v_sinal;
      if v_lig.no_card is not null then
        perform helena_v2._acao_no_card(v_lig.no_card, v_sinal, v_card, p_maquina, p_alvo, v_hist);
      else
        foreach v_alvo_nome in array v_lig.alvos loop
          v_alvos := helena_v2._alvos_do_sinal(v_card, v_alvo_nome, case when p_maquina = 'etapa' then p_alvo end);
          v_maq_alvo := case v_alvo_nome when 'card' then 'card' when 'acoes_abertas' then 'acao_externa' else 'etapa' end;
          foreach v_alvo in array v_alvos loop
            v_r := helena_v2._aplicar(v_maq_alvo, v_alvo, v_lig.papel, v_lig.evento, '{}'::jsonb, null, null, null, null, 'SINAL', v_hist, null, null);
            if v_r ->> 'resultado' <> 'APLICADO' then
              raise exception 'LIGACAO: o sinal % (% %) foi perdido em % %: %', v_sinal, v_lig.papel, v_lig.evento, v_maq_alvo, v_alvo, v_r;
            end if;
          end loop;
        end loop;
      end if;
    end loop;
    return jsonb_build_object('resultado', v_resultado, 'linha', v_linha_id, 'historico_id', v_hist,
                              'estado', v_linha.para, 'convertido_em', v_conv);
  end if;

  -- ======================================================= nenhuma linha casou
  if p_origem = 'SINAL' then
    raise exception 'LIGACAO: o sinal % não foi aceito por % % (estado %)', p_evento, p_maquina, v_codigo, v ->> 'estado';
  end if;
  v_vars_depois := v_vars_antes;
  v_resultado := 'RECUSADO';
  v_reacao := null;
  -- reação: toque que não muda estado (comentário, campo do fundador, card novo ligado)
  if p_maquina in ('card', 'etapa') and v_tem_vocab then
    select r.* into v_reacao from reacao r
    where r.papel = p_papel and r.evento = p_evento and r.maquina = p_maquina
      and (r.estados_tipo = 'TODOS'
           or (r.estados_tipo = 'ABERTOS' and exists (select 1 from estado_def d where d.maquina = p_maquina and d.estado = v ->> 'estado' and not d.final))
           or (r.estados_tipo = 'LISTA' and (v ->> 'estado') = any (r.estados)))
      and (r.guarda_id is null or helena_v2.guarda(r.guarda_id, v, '{}'::jsonb))
    order by r.ordem limit 1;
  end if;
  if v_reacao.ordem is not null then
    v_resultado := 'REACAO';
    v_motivo := v_reacao.efeito_fora;
  elsif p_papel = 'FUNDADOR' and v_tem_vocab then
    -- regra 11: todo toque seu tem destino (recusa_do_fundador)
    select valor into rec from regra_geral where chave = 'recusa_do_fundador';
    select coalesce(d.final, false) into v_card_final from estado_def d where d.maquina = 'card' and d.estado = v_estado_card;
    abre := rec -> 'final_abre_card_para';
    final_dest := case when abre is null or abre ? p_evento then rec ->> 'final'
                       else coalesce(rec ->> 'final_outros_botoes', rec ->> 'final') end;
    if p_maquina = 'card' then
      v_resultado := case when v_card_final then final_dest else rec ->> 'aberto' end;
    elsif p_maquina = 'etapa' then
      select coalesce(d.final, false) into v_e_final from estado_def d where d.maquina = 'etapa' and d.estado = v ->> 'estado';
      if v_card_final then
        v_resultado := final_dest;
      elsif v_e_final and p_evento = 'RESPONDER' and rec ? 'resposta_tardia_com_card_aberto' then
        v_resultado := rec ->> 'resposta_tardia_com_card_aberto';
      elsif p_versao_vista is distinct from (v ->> 'versao')::integer
            and exists (select 1 from regra_geral where chave = 'toques_do_fundador_exigem_versao_vista' and valor ? p_evento) then
        v_resultado := coalesce(rec ->> 'versao_antiga', rec ->> 'aberto');
      else
        v_resultado := rec ->> 'aberto';
      end if;
    else
      select coalesce(d.final, false) into v_e_final from estado_def d where d.maquina = 'acao_externa' and d.estado = v ->> 'estado';
      v_resultado := coalesce(rec ->> case when v_e_final then 'final'
                                           when p_versao_vista is distinct from (v ->> 'versao')::integer then 'versao_antiga'
                                           else 'aberto' end, rec ->> 'aberto');
    end if;
    if v_resultado is null then
      raise exception 'REGRA 11: o toque % % ficou sem destino', p_papel, p_evento;
    end if;
    v_motivo := v_resultado;
  end if;

  insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, ator, chave, versao_vista, conteudo, linha_id,
                         resultado, motivo, origem, origem_id, estado_antes, estado_depois, vars_antes, vars_depois, numero_toque, conta)
  values (v_card, p_maquina, p_alvo, v_codigo, p_papel, p_evento, v_params, p_ator, p_chave, p_versao_vista, p_conteudo, null,
          v_resultado, v_motivo, p_origem, p_origem_id, v ->> 'estado', v ->> 'estado', v_vars_antes, v_vars_depois, p_toque, helena_v2._conta())
  returning id into v_hist;

  if v_resultado = 'REACAO' then
    if v_reacao.abre_card_ligado then
      perform helena_v2._criar_card_ligado(v_card, 'REACAO ' || p_evento, v_hist);
    end if;
    if v_reacao.muda_campo is not null and p_papel = 'FUNDADOR' then
      perform helena_v2._mudar_campo_do_fundador(v_card, v_reacao.muda_campo, p_conteudo);
    end if;
  elsif v_resultado = 'CARD_NOVO_LIGADO' then
    perform helena_v2._criar_card_ligado(v_card, p_papel || ' ' || p_evento, v_hist);
  elsif v_resultado = 'RESPOSTA_GUARDADA' then
    update etapa set respostas_guardadas = respostas_guardadas || (v_params ->> 'opcao'), atualizado_em = now() where id = p_alvo;
  end if;
  return jsonb_build_object('resultado', v_resultado, 'historico_id', v_hist, 'motivo', v_motivo);
end;
$f$;

-- ---------------------------------------------------------------------------- automáticos (provar: replay.automaticos)
create or replace function helena_v2._cabe(p_maquina text, p_alvo uuid, p_papel text, p_evento text) returns boolean
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare c uuid; v jsonb; vc jsonb; q jsonb;
begin
  select o_card, o_v, o_vc into c, v, vc from helena_v2._carregar(p_maquina, p_alvo);
  q := helena_v2._montar_q(p_maquina, v, c, '{}'::jsonb);
  return helena_v2._achar_linha(p_maquina, p_papel, p_evento, v, q, '{}'::jsonb, null, null, null, vc ->> 'estado') is not null;
end;
$f$;

create or replace function helena_v2._automaticos(p_card uuid, p_nao_disparar text[], p_origem_id bigint) returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
declare
  n integer := 0;
  feito boolean;
  ev text;
  e record;
  a record;
  r jsonb;
begin
  loop
    n := n + 1;
    if n > 1000 then
      raise exception 'REGRA 2: os eventos automáticos não pararam (laço)';
    end if;
    feito := false;
    for ev in select evento from automatico where maquina = 'card' order by ordem loop
      continue when ev = any (p_nao_disparar);
      if helena_v2._cabe('card', p_card, 'MOTOR', ev) then
        r := helena_v2._aplicar('card', p_card, 'MOTOR', ev, '{}'::jsonb, null, null, null, null, 'AUTOMATICO', p_origem_id, null, null);
        feito := true;
        exit;
      end if;
    end loop;
    if not feito then
      for e in select id from etapa where card_id = p_card and atual order by ordem loop
        for ev in select evento from automatico where maquina = 'etapa' order by ordem loop
          continue when ev = any (p_nao_disparar);
          if helena_v2._cabe('etapa', e.id, 'MOTOR', ev) then
            r := helena_v2._aplicar('etapa', e.id, 'MOTOR', ev, '{}'::jsonb, null, null, null, null, 'AUTOMATICO', p_origem_id, null, null);
            feito := true;
            exit;
          end if;
        end loop;
        exit when feito;
      end loop;
    end if;
    if not feito then
      for a in select id from acao_externa where card_id = p_card order by substring(codigo from 2)::integer loop
        for ev in select evento from automatico where maquina = 'acao_externa' order by ordem loop
          continue when ev = any (p_nao_disparar);
          if helena_v2._cabe('acao_externa', a.id, 'MOTOR', ev) then
            r := helena_v2._aplicar('acao_externa', a.id, 'MOTOR', ev, '{}'::jsonb, null, null, null, null, 'AUTOMATICO', p_origem_id, null, null);
            feito := true;
            exit;
          end if;
        end loop;
        exit when feito;
      end loop;
    end if;
    exit when not feito;
  end loop;
end;
$f$;

-- ---------------------------------------------------------------------------- PORTA PÚBLICA 1: aplicar_evento
create or replace function helena_v2.aplicar_evento(
  p_maquina text,                         -- 'card', 'etapa' ou 'acao_externa'
  p_alvo uuid,                            -- o id do card, da etapa ou da ação
  p_papel text,                           -- AUTOR, REVISOR, HELENA, FUNDADOR, MOTOR, RELOGIO ou VIGIA
  p_evento text,                          -- um evento do vocabulário
  p_parametros jsonb default '{}'::jsonb, -- parâmetros do evento (domínio fechado do vocabulário)
  p_ator text default null,               -- o agente que respondeu (AUTOR e REVISOR)
  p_chave bigint default null,            -- chave da execução (AUTOR, REVISOR) ou da chamada da Helena
  p_versao_vista integer default null,    -- a versão que o fundador viu ao tocar (Aprovar, Pedir ajuste, Responder)
  p_conteudo jsonb default null,          -- a carga: resposta do agente, relatório do validador, prazo ou prioridade novos
  p_toque text default null,              -- número único do toque (repetir o mesmo número não repete o efeito)
  p_automaticos boolean default true,     -- depois do evento, dispara os automáticos da tabela
  p_nao_disparar text[] default '{}'::text[], -- automáticos que o motor quer decidir sozinho (ex.: PLANO_VALIDO)
  p_prazo_espera timestamptz default null -- prazo de quem espera o fundador, quando o motor sabe
) returns jsonb
language plpgsql security definer set search_path = helena_v2, pg_catalog as $f$
declare
  r jsonb;
  v_card uuid;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array[p_papel]);
  r := helena_v2._aplicar(p_maquina, p_alvo, p_papel, p_evento, p_parametros, p_ator, p_chave, p_versao_vista, p_conteudo,
                          'EXTERNO', null, p_toque, p_prazo_espera);
  if p_automaticos and r ->> 'resultado' in ('APLICADO', 'CONVERTIDO') then
    select o_card into v_card from helena_v2._carregar(p_maquina, p_alvo);
    perform helena_v2._automaticos(v_card, p_nao_disparar, (r ->> 'historico_id')::bigint);
  end if;
  set constraints all immediate;     -- as travas adiadas (regras 6, 9 e 10) valem já, dentro da chamada
  set constraints all deferred;
  perform helena_v2._sair();
  return r;
end;
$f$;

-- ---------------------------------------------------------------------------- PORTA PÚBLICA 2: disparar_automaticos
create or replace function helena_v2.disparar_automaticos(p_card uuid, p_nao_disparar text[] default '{}'::text[]) returns void
language plpgsql security definer set search_path = helena_v2, pg_catalog as $f$
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array['MOTOR']);
  perform 1 from card where id = p_card for update;
  perform helena_v2._automaticos(p_card, p_nao_disparar, null);
  set constraints all immediate;
  set constraints all deferred;
  perform helena_v2._sair();
end;
$f$;

-- ---------------------------------------------------------------------------- PORTA PÚBLICA 3: abrir_chamada_helena
-- Cada chamada da Helena (leitura de volta, recomendação) ganha um número. Só a resposta com o número da
-- chamada atual grava (regra 3); abrir uma chamada nova mata a anterior.
create or replace function helena_v2.abrir_chamada_helena(p_maquina text, p_alvo uuid) returns bigint
language plpgsql security definer set search_path = helena_v2, pg_catalog as $f$
declare
  v_card uuid;
  v_etapa uuid := case when p_maquina = 'etapa' then p_alvo end;
  v_num bigint;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array['HELENA', 'MOTOR']);
  if p_maquina not in ('card', 'etapa') then
    raise exception 'a Helena só é chamada para o card ou para a etapa';
  end if;
  select o_card into v_card from helena_v2._carregar(p_maquina, p_alvo);
  perform 1 from card where id = v_card for update;
  update execucao set estado = 'SUBSTITUIDA', encerrada_em = now()
  where card_id = v_card and etapa_id is not distinct from v_etapa and tipo = 'HELENA' and estado = 'VIVA';
  insert into execucao (tipo, card_id, etapa_id) values ('HELENA', v_card, v_etapa) returning numero into v_num;
  if p_maquina = 'card' then
    update card set chamada_helena = v_num, atualizado_em = now() where id = p_alvo;
  else
    update etapa set chamada_helena = v_num, atualizado_em = now() where id = p_alvo;
  end if;
  perform helena_v2._sair();
  return v_num;
end;
$f$;

-- ---------------------------------------------------------------------------- PORTA PÚBLICA 4: criar_card
-- Grava a mensagem do fundador UMA vez (regra 11: canal + número únicos) e cria o card em RASCUNHO, com o
-- roteiro (as etapas, em AGUARDANDO_ANTERIORES). A mesma mensagem outra vez devolve o card que já existe.
create or replace function helena_v2.criar_card(
  p_canal text, p_numero text, p_conteudo text,
  p_titulo text, p_prazo timestamptz,
  p_roteiro jsonb,
  p_empresa text default null,
  p_ordem_de_servico jsonb default '{}'::jsonb,
  p_prioridade integer default 0,
  p_pedido_grande boolean default true
) returns jsonb
language plpgsql security definer set search_path = helena_v2, pg_catalog as $f$
declare
  v_msg bigint;
  v_card uuid;
  v jsonb;
  e jsonb;
  ids text[];
  v_ordem integer := 0;
  fundador text;
  agentes text[];
  excluir jsonb;
  ultima text;
  autores_julg text[];
  revisores_julg text[];
  validos text[];
  r text;
  perm jsonb;
  julgada boolean;
  julga text[];
  deps text[];
  revs text[];
  v_et uuid;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array['MOTOR', 'FUNDADOR']);
  insert into mensagem (canal, numero, conteudo) values (p_canal, p_numero, coalesce(p_conteudo, ''))
  on conflict (canal, numero) do nothing returning id into v_msg;
  if v_msg is null then
    select c.id into v_card from card c join mensagem m on m.id = c.mensagem_id where m.canal = p_canal and m.numero = p_numero;
    perform helena_v2._sair();
    return jsonb_build_object('card_id', v_card, 'novo', false);
  end if;
  insert into card (titulo, empresa, ordem_de_servico, prioridade, prazo, mensagem_id, pedido_grande, dono, prazo_ate)
  values (p_titulo, p_empresa, coalesce(p_ordem_de_servico, '{}'::jsonb), p_prioridade, p_prazo, v_msg, p_pedido_grande,
          helena_v2._dono('card', helena_v2._estado_inicial('card'), '{}'::jsonb),
          helena_v2._prazo_ate('card', helena_v2._estado_inicial('card'), '{}'::jsonb, p_prazo, null))
  returning id into v_card;
  select to_jsonb(c) into v from card c where c.id = v_card;

  -- as etapas (provar.perfis_do_roteiro): quem julga quem, os revisores válidos pela regra 4, a ficha de cada uma
  select nome into fundador from identidade where tipo = 'fundador';
  agentes := array(select nome from identidade where tipo = 'agente' order by ordem);
  select valor -> 'excluir', valor ->> 'ultima_reserva' into excluir, ultima from regra_geral where chave = 'designacao_de_revisor';
  ids := array(select x ->> 'id' from jsonb_array_elements(p_roteiro -> 'etapas') x);
  if cardinality(ids) = 0 or cardinality(ids) <> (select count(distinct i) from unnest(ids) i) then
    raise exception 'roteiro sem etapas ou com etapa repetida';
  end if;
  for e in select * from jsonb_array_elements(p_roteiro -> 'etapas') loop
    v_ordem := v_ordem + 1;
    if not ((e ->> 'autor') = any (agentes)) then
      raise exception 'REGRA 4: o autor % da etapa % não é um dos agentes', e ->> 'autor', e ->> 'id';
    end if;
    revs := array(select jsonb_array_elements_text(coalesce(e -> 'revisores', '[]'::jsonb)));
    if exists (select 1 from unnest(revs) x where not (x = any (agentes) or x = fundador)) then
      raise exception 'REGRA 4: revisor fora dos agentes na etapa %', e ->> 'id';
    end if;
    julga := array(select jsonb_array_elements_text(coalesce(e -> 'julga', '[]'::jsonb)));
    deps := array(select jsonb_array_elements_text(coalesce(e -> 'depende_de', '[]'::jsonb)));
    if exists (select 1 from unnest(deps) d where not (d = any (ids))) then
      raise exception 'REGRA 6: a etapa % depende de uma etapa que não existe', e ->> 'id';
    end if;
    if exists (select 1 from unnest(julga) j where not (j = any (deps))) then
      raise exception 'REGRA 6: a etapa % julga etapa de que não depende', e ->> 'id';
    end if;
    -- quem julga esta peça depois: o autor de cada etapa que a julga e os revisores possíveis dessa julgadora
    select coalesce(array_agg(x ->> 'autor'), '{}') into autores_julg
      from jsonb_array_elements(p_roteiro -> 'etapas') x where (x -> 'julga') ? (e ->> 'id');
    select coalesce(array_agg(rv), '{}') into revisores_julg
      from jsonb_array_elements(p_roteiro -> 'etapas') x,
           jsonb_array_elements_text(coalesce(x -> 'revisores', '[]'::jsonb)) rv
      where (x -> 'julga') ? (e ->> 'id') and rv <> (x ->> 'autor') and rv <> fundador;
    julgada := cardinality(autores_julg) > 0;
    validos := '{}';
    foreach r in array revs loop
      if not (((excluir ? 'AUTOR_DA_ETAPA') and r = e ->> 'autor')
              or ((excluir ? 'AUTORES_DOS_JULGADORES') and r = any (autores_julg))
              or ((excluir ? 'REVISORES_DOS_JULGADORES') and r = any (revisores_julg)))
         and not (r = any (validos)) then
        validos := validos || r;
      end if;
    end loop;
    if ultima is not null and not (ultima = any (validos)) then
      validos := validos || ultima;
    end if;
    perm := coalesce(e -> 'acoes_permitidas', '["ENTREGAR", "REGISTRAR_FALHA"]'::jsonb);
    insert into etapa (card_id, codigo, ordem, nome, autor, revisores, revisores_validos, julgadores, depende_de, julga,
                       tempo_maximo_s, prazo_revisao_s, dono, prazo_ate,
                       tem_internet, julgadora, julgada, pulavel, permite_perguntar, permite_devolver, usa_decisao, prazo_de_terceiro)
    values (v_card, e ->> 'id', v_ordem, coalesce(e ->> 'nome', e ->> 'id'), e ->> 'autor', revs, validos,
            array(select distinct x from unnest(autores_julg || revisores_julg) x order by x), deps, julga,
            (e ->> 'tempo_maximo_s')::integer, (e ->> 'prazo_revisao_s')::integer,
            helena_v2._dono('etapa', helena_v2._estado_inicial('etapa'), jsonb_build_object('autor', e ->> 'autor', 'revisor', 'NENHUM')),
            helena_v2._prazo_ate('etapa', helena_v2._estado_inicial('etapa'), '{}'::jsonb, p_prazo, null),
            coalesce((e ->> 'internet')::boolean, false), cardinality(julga) > 0, julgada,
            coalesce((e ->> 'pulavel')::boolean, false) and not julgada and cardinality(julga) = 0,
            perm ? 'PERGUNTAR', perm ? 'DEVOLVER_A_QUEM_PEDIU',
            coalesce((e ->> 'usa_decisao')::boolean, true), coalesce((e ->> 'prazo_de_terceiro')::boolean, false))
    returning id into v_et;
  end loop;
  insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, conteudo, resultado, origem,
                         estado_depois, vars_depois, conta)
  values (v_card, 'card', v_card, 'card', 'MOTOR', 'CARD_CRIADO', jsonb_build_object('pedido_grande', p_pedido_grande),
          jsonb_build_object('canal', p_canal, 'numero', p_numero, 'titulo', p_titulo, 'prazo', p_prazo, 'empresa', p_empresa,
                             'prioridade', p_prioridade, 'ordem_de_servico', p_ordem_de_servico, 'roteiro', p_roteiro),
          'APLICADO', 'EXTERNO', v ->> 'estado', helena_v2._so_variaveis('card', v), helena_v2._conta());
  set constraints all immediate;
  set constraints all deferred;
  perform helena_v2._sair();
  return jsonb_build_object('card_id', v_card, 'novo', true);
end;
$f$;

-- ---------------------------------------------------------------------------- a tabela é a que passou na prova
-- O banco calcula o hash das linhas gravadas (e das duas funções geradas). Se alguém editar uma linha à mão,
-- o hash muda e tabela_confere() devolve falso: o motor não liga e o vigia avisa (plano: "A tabela testada é a que roda").
create or replace function helena_v2.calcular_hash_das_linhas() returns text
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare
  t text;
  parte text;
  tudo text := '';
begin
  foreach t in array array['teto', 'variavel', 'config_nome', 'estado_def', 'prazo_def', 'macro', 'passagem', 'ligacao', 'automatico',
                           'reacao', 'regra_geral', 'vocab_evento', 'predicado_lista', 'entrada', 'identidade'] loop
    execute format('select coalesce(string_agg(to_jsonb(x)::text, E''\n'' order by to_jsonb(x)::text collate "C"), '''') from helena_v2.%I x', t) into parte;
    tudo := tudo || t || E'\n' || parte || E'\n';
  end loop;
  tudo := tudo || (select prosrc from pg_proc where oid = 'helena_v2.guarda(text,jsonb,jsonb)'::regprocedure)
               || (select prosrc from pg_proc where oid = 'helena_v2.situacao_da_etapa(text,jsonb)'::regprocedure);
  return encode(sha256(convert_to(tudo, 'UTF8')), 'hex');
end;
$f$;

create or replace function helena_v2.selar_tabela() returns void
language plpgsql set search_path = helena_v2, pg_catalog as $f$
begin
  if coalesce(current_setting('helena_v2.migrando', true), 'nao') <> 'sim' then
    raise exception 'só uma migração sela a tabela';
  end if;
  update meta_tabela set hash_das_linhas = helena_v2.calcular_hash_das_linhas();
end;
$f$;

create or replace function helena_v2.tabela_confere() returns boolean
language sql stable set search_path = helena_v2, pg_catalog as $f$
  select coalesce((select hash_das_linhas = helena_v2.calcular_hash_das_linhas() from meta_tabela), false);
$f$;

-- ---------------------------------------------------------------------------- o histórico reconstrói o card? (regra 13)
-- Devolve uma linha por divergência: o estado ou o contador da tabela que não bate com a última linha do histórico.
create or replace function helena_v2.conferir_historico(p_card uuid)
returns table (alvo text, campo text, na_tabela text, no_historico text)
language plpgsql stable set search_path = helena_v2, pg_catalog as $f$
declare
  a record;
  h jsonb;
  v jsonb;
  k record;
  atual jsonb;
begin
  for a in select 'card'::text as maquina, c.id as id, 'card'::text as codigo, to_jsonb(c) as v from card c where c.id = p_card
           union all select 'etapa', e.id, e.codigo, to_jsonb(e) from etapa e where e.card_id = p_card
           union all select 'acao_externa', x.id, x.codigo, to_jsonb(x) from acao_externa x where x.card_id = p_card loop
    select vars_depois into h from historico where alvo_id = a.id and resultado in ('APLICADO', 'CONVERTIDO') order by id desc limit 1;
    if h is null then
      alvo := a.codigo; campo := '(sem histórico)'; na_tabela := a.v ->> 'estado'; no_historico := null;
      return next;
      continue;
    end if;
    for k in select nome from variavel where maquina = a.maquina and not compartilhada
             union select 'estado' union select 'versao' loop
      if (h ->> k.nome) is distinct from (a.v ->> k.nome) then
        alvo := a.codigo; campo := k.nome; na_tabela := a.v ->> k.nome; no_historico := h ->> k.nome;
        return next;
      end if;
    end loop;
  end loop;
  -- contadores compartilhados do card: o valor da última linha de histórico (de qualquer alvo do card) que os trouxe
  for k in select nome from variavel where maquina = 'card' and compartilhada loop
    select vars_depois ->> k.nome into no_historico from historico
      where card_id = p_card and vars_depois ? k.nome and resultado in ('APLICADO', 'CONVERTIDO') order by id desc limit 1;
    select to_jsonb(c) ->> k.nome into na_tabela from card c where c.id = p_card;
    if na_tabela is distinct from no_historico then
      alvo := 'card'; campo := k.nome;
      return next;
    end if;
  end loop;
end;
$f$;
