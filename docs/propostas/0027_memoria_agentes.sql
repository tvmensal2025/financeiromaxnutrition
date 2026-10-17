-- NÃO APLICADO — exige autorização explícita do fundador.
-- Rascunho em docs/propostas/. NÃO é uma migration: não foi copiado para supabase/migrations-v2/ e não deve ser
-- aplicado no Supabase real (ecosistemadossonhos, ref wxkgrykduqtsgmjkzlou) sem a frase de autorização do fundador.
--
-- 0027 (proposta) — MEMÓRIA COMPACTADA E BUSCA DOS AGENTES
-- O que é: o Supabase como ÚNICA fonte de verdade da memória dos agentes. Quatro tabelas fechadas e as funções que as
--   usam: resumos versionados (com origem, hash, revisão e escopo), trechos indexáveis para busca textual em
--   português (tsvector + GIN), registro do que cada execução recebeu (custo) e as RPCs do fundador para aprovar e
--   esquecer. O agente só escreve conteúdo; o código confere e grava aqui; o banco recusa o que foge das regras.
-- Desenho, números e decisões do fundador: docs/manual/memoria-dos-agentes.md. Código que usa isto (sem banco,
--   desligado por padrão): motor/orquestrador/orquestrador/memoria.py.
-- Escopos: CARD (resumo de um card), AGENTE_EMPRESA (o que um agente/serviço sabe de uma empresa), FUNDADOR
--   (preferências e decisões gerais, aprovadas por ele), PESSOAL (só a Laura; nunca mistura com empresa).
-- Regras de ferro desta proposta (cada uma tem constraint, gatilho ou teste):
--   1. tabelas fechadas (RLS ligada, sem política, sem grant); só funções SECURITY DEFINER escrevem;
--   2. só o motor (service_role) registra; o fundador autenticado aprova e esquece; ninguém apaga linha;
--   3. resumo sem fonte, com fonte inexistente ou de outro escopo, ou com profundidade > 2, é recusado;
--   4. resumo de AGENTE só fica ATIVO com revisor diferente do autor; FUNDADOR/PESSOAL só ATIVO com aprovação dele;
--   5. a leitura filtra por escopo no próprio SQL (empresa A nunca sai numa consulta da empresa B);
--   6. versões imutáveis: texto, fontes e hash nunca mudam (exceto o apagamento controlado por "esquecer").
-- Depende de: 0001–0026, public.portfolio, public.decisoes, public.checkpoint_mestre, extensions.digest (pgcrypto).
-- Como mudar: nova coluna/regra = nova migration numerada, nunca editar esta depois de aplicada. A regra de escopo
--   vive em helena_v2._memoria_escopo_permite e DEVE casar com escopo_permite() em memoria.py (o teste
--   motor/orquestrador/testes/test_memoria_sql_rascunho.py compara as duas).
-- Como validar sem tocar produção: o teste acima aplica 0001–0026 e este arquivo em PostgreSQL descartável local.

-- ----------------------------------------------------------------------------------------------------- tabelas
create table helena_v2.memoria_resumo (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('CARD','AGENTE_EMPRESA','FUNDADOR','PESSOAL')),
  business_id text,
  agente text,
  servico text,
  card_id uuid references helena_v2.card(id),
  chave_escopo text generated always as (
    escopo || '|' || coalesce(business_id,'') || '|' || coalesce(agente,'') || '|' || coalesce(servico,'')
    || '|' || coalesce(card_id::text,'')) stored,
  versao integer not null check (versao >= 1),
  estado text not null default 'PROPOSTO'
    check (estado in ('PROPOSTO','ATIVO','SUPERADO','REJEITADO','EXPIRADO','ESQUECIDO')),
  origem text not null check (origem in ('CODIGO','AGENTE')),
  texto text not null check (char_length(texto) <= 8000),
  afirmacoes jsonb not null default '[]'::jsonb check (jsonb_typeof(afirmacoes) = 'array'),
  fatos_duros jsonb not null default '[]'::jsonb check (jsonb_typeof(fatos_duros) = 'array'),
  texto_hash bytea not null check (octet_length(texto_hash) = 32),
  base_id uuid references helena_v2.memoria_resumo(id),
  profundidade smallint not null default 0 check (profundidade between 0 and 2),
  autor text,
  revisor text,
  execucao_autor bigint references helena_v2.execucao(numero),
  execucao_revisor bigint references helena_v2.execucao(numero),
  chave_idempotencia text not null unique check (char_length(chave_idempotencia) between 8 and 200),
  criado_em timestamptz not null default clock_timestamp(),
  ativado_em timestamptz,
  expira_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo text check (char_length(motivo) <= 500),
  caracteres integer generated always as (char_length(texto)) stored,
  tokens_estimados integer generated always as ((char_length(texto) + 2) / 3) stored,
  unique (chave_escopo, versao),
  -- forma de cada escopo (o escopo decide o que é obrigatório e o que é proibido)
  check (escopo <> 'CARD' or card_id is not null),
  check (escopo <> 'AGENTE_EMPRESA' or (business_id is not null and agente is not null and card_id is null)),
  check (escopo <> 'FUNDADOR' or (business_id is null and agente is null and servico is null and card_id is null)),
  check (escopo <> 'PESSOAL' or (business_id is null and agente is not null and servico is null and card_id is null)),
  check (estado = 'ESQUECIDO' or char_length(texto) >= 1),
  check (origem <> 'AGENTE' or (autor is not null and execucao_autor is not null)),
  -- quem compacta não aprova o próprio resumo (regra 4 da fábrica, aplicada à memória)
  check (origem <> 'AGENTE' or estado not in ('ATIVO','SUPERADO','EXPIRADO')
         or (revisor is not null and execucao_revisor is not null and upper(revisor) <> upper(autor))),
  -- o que vale para todas as empresas ou para a vida pessoal exige o "sim" do fundador
  check (escopo not in ('FUNDADOR','PESSOAL') or estado not in ('ATIVO','SUPERADO','EXPIRADO')
         or aprovado_por is not null)
);
create unique index memoria_resumo_um_ativo on helena_v2.memoria_resumo (chave_escopo) where estado = 'ATIVO';
create index memoria_resumo_leitura on helena_v2.memoria_resumo (escopo, business_id, agente) where estado = 'ATIVO';
create index memoria_resumo_card on helena_v2.memoria_resumo (card_id) where card_id is not null;

-- Fontes de cada resumo: o que o banco conferiu que existe e pertence ao escopo. Só acrescenta.
create table helena_v2.memoria_resumo_fonte (
  resumo_id uuid not null references helena_v2.memoria_resumo(id),
  tipo text not null check (tipo in ('ENTREGA','HISTORICO','DECISAO','FONTE_IMPORTADA','CHECKPOINT',
                                      'TELEGRAM_PEDIDO','RESUMO')),
  ref text not null check (char_length(ref) between 1 and 200),
  ref_hash text check (ref_hash ~ '^[0-9a-f]{64}$'),   -- hash da fonte no momento do registro (detecta mudança)
  primary key (resumo_id, tipo, ref)
);

-- Trechos: recortes LITERAIS e curtos de fontes primárias, indexados para busca (recuperação do top-K).
create table helena_v2.memoria_trecho (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('CARD','AGENTE_EMPRESA','FUNDADOR','PESSOAL')),
  business_id text,
  agente text,
  servico text,
  card_id uuid references helena_v2.card(id),
  chave_escopo text generated always as (
    escopo || '|' || coalesce(business_id,'') || '|' || coalesce(agente,'') || '|' || coalesce(servico,'')
    || '|' || coalesce(card_id::text,'')) stored,
  origem_tipo text not null check (origem_tipo in ('ENTREGA','HISTORICO','DECISAO','FONTE_IMPORTADA','CHECKPOINT',
                                                    'TELEGRAM_PEDIDO')),
  origem_ref text not null check (char_length(origem_ref) between 1 and 200),
  origem_hash text not null check (origem_hash ~ '^[0-9a-f]{64}$'),
  ordem integer not null default 0 check (ordem >= 0),
  texto text not null check (char_length(texto) <= 1200),
  texto_hash bytea not null check (octet_length(texto_hash) = 32),
  -- busca textual em português (stemming, sem acento); índice GIN abaixo. O vetor é OPCIONAL (fim do arquivo).
  busca tsvector generated always as (to_tsvector('portuguese', texto)) stored,
  estado text not null default 'ATIVO' check (estado in ('ATIVO','EXPIRADO','ESQUECIDO')),
  criado_em timestamptz not null default clock_timestamp(),
  expira_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo text check (char_length(motivo) <= 500),
  unique (chave_escopo, origem_tipo, origem_ref, texto_hash),
  check (escopo <> 'CARD' or card_id is not null),
  check (escopo <> 'AGENTE_EMPRESA' or (business_id is not null and agente is not null and card_id is null)),
  check (escopo <> 'FUNDADOR' or (business_id is null and agente is null and servico is null and card_id is null)),
  check (escopo <> 'PESSOAL' or (business_id is null and agente is not null and servico is null and card_id is null)),
  check (estado = 'ESQUECIDO' or char_length(texto) >= 1)
);
create index memoria_trecho_busca on helena_v2.memoria_trecho using gin (busca) where estado = 'ATIVO';
create index memoria_trecho_escopo on helena_v2.memoria_trecho (escopo, business_id, agente) where estado = 'ATIVO';

-- O que cada execução recebeu (ids, versões, hashes, tamanho): auditoria e medição de custo. Só acrescenta.
create table helena_v2.memoria_uso (
  id bigint generated always as identity primary key,
  execucao_numero bigint not null references helena_v2.execucao(numero),
  tipo text not null check (tipo in ('RESUMO','TRECHO')),
  item_id uuid not null,
  versao integer,
  texto_hash text not null check (texto_hash ~ '^[0-9a-f]{64}$'),
  caracteres integer not null check (caracteres >= 0),
  tokens_estimados integer not null check (tokens_estimados >= 0),
  registrado_em timestamptz not null default clock_timestamp(),
  unique (execucao_numero, tipo, item_id)
);

alter table helena_v2.memoria_resumo enable row level security;
alter table helena_v2.memoria_resumo_fonte enable row level security;
alter table helena_v2.memoria_trecho enable row level security;
alter table helena_v2.memoria_uso enable row level security;

-- ----------------------------------------------------------------------------------------------- imutabilidade
-- Fontes e uso só acrescentam. Resumo e trecho só mudam de estado (e carimbos); texto/fontes/hash nunca,
-- salvo o apagamento controlado de "esquecer" (marcado por uma variável local da transação).
create function helena_v2._memoria_so_acrescenta() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'MEMORIA_SO_ACRESCENTA' using errcode = '42501';
end;
$f$;
create trigger memoria_fonte_so_acrescenta before update or delete on helena_v2.memoria_resumo_fonte
  for each row execute function helena_v2._memoria_so_acrescenta();
create trigger memoria_fonte_sem_truncate before truncate on helena_v2.memoria_resumo_fonte
  for each statement execute function helena_v2._memoria_so_acrescenta();
create trigger memoria_uso_so_acrescenta before update or delete on helena_v2.memoria_uso
  for each row execute function helena_v2._memoria_so_acrescenta();
create trigger memoria_uso_sem_truncate before truncate on helena_v2.memoria_uso
  for each statement execute function helena_v2._memoria_so_acrescenta();

create function helena_v2._memoria_proteger() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $f$
declare
  v_livres text[];
  v_esquecendo boolean := coalesce(current_setting('helena_v2.esquecendo', true), 'nao') = 'sim'
                          and new.estado = 'ESQUECIDO';
  v_ignorar text[] := array['chave_escopo','caracteres','tokens_estimados','busca'];
begin
  if tg_op in ('DELETE','TRUNCATE') then
    raise exception 'MEMORIA_NAO_SE_APAGA' using errcode = '42501';
  end if;
  if tg_table_name = 'memoria_resumo' then
    v_livres := array['estado','ativado_em','revisor','execucao_revisor','aprovado_por','aprovado_em','motivo','expira_em'];
    if v_esquecendo then v_livres := v_livres || array['texto','afirmacoes','fatos_duros']; end if;
    -- transições permitidas
    if new.estado is distinct from old.estado and not (
         (old.estado = 'PROPOSTO' and new.estado in ('ATIVO','REJEITADO','ESQUECIDO'))
      or (old.estado = 'ATIVO' and new.estado in ('SUPERADO','EXPIRADO','ESQUECIDO'))
      or (old.estado in ('SUPERADO','EXPIRADO','REJEITADO') and new.estado = 'ESQUECIDO')) then
      raise exception 'MEMORIA_TRANSICAO_INVALIDA: % -> %', old.estado, new.estado using errcode = '23514';
    end if;
  else
    v_livres := array['estado','expira_em','aprovado_por','aprovado_em','motivo'];
    if v_esquecendo then v_livres := v_livres || array['texto']; end if;
    if new.estado is distinct from old.estado and not (
         (old.estado = 'ATIVO' and new.estado in ('EXPIRADO','ESQUECIDO'))
      or (old.estado = 'EXPIRADO' and new.estado = 'ESQUECIDO')) then
      raise exception 'MEMORIA_TRANSICAO_INVALIDA: % -> %', old.estado, new.estado using errcode = '23514';
    end if;
  end if;
  if old.estado = 'ESQUECIDO' then
    raise exception 'MEMORIA_ESQUECIDA_E_DEFINITIVA' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_livres - v_ignorar) is distinct from (to_jsonb(old) - v_livres - v_ignorar) then
    raise exception 'MEMORIA_VERSAO_IMUTAVEL' using errcode = '42501';
  end if;
  return new;
end;
$f$;
create trigger memoria_resumo_imutavel before update or delete on helena_v2.memoria_resumo
  for each row execute function helena_v2._memoria_proteger();
create trigger memoria_resumo_sem_truncate before truncate on helena_v2.memoria_resumo
  for each statement execute function helena_v2._memoria_proteger();
create trigger memoria_trecho_imutavel before update or delete on helena_v2.memoria_trecho
  for each row execute function helena_v2._memoria_proteger();
create trigger memoria_trecho_sem_truncate before truncate on helena_v2.memoria_trecho
  for each statement execute function helena_v2._memoria_proteger();

-- ----------------------------------------------------------------------------------------- regra de escopo
-- UMA regra para resumos e trechos (espelha escopo_permite() em memoria.py).
--   p_modo: EMPRESA (card de empresa), PESSOAL (card pessoal da Laura), COORDENACAO (triagem, vê todas as empresas).
create function helena_v2._memoria_escopo_permite(
  p_modo text, p_agente text, p_business_id text, p_servico text, p_card_id uuid,
  r_escopo text, r_business_id text, r_agente text, r_servico text, r_card_id uuid
) returns boolean language sql immutable set search_path = pg_catalog, pg_temp as $f$
  select coalesce(case
    when p_modo not in ('EMPRESA','PESSOAL','COORDENACAO') then false
    when r_escopo = 'FUNDADOR' then r_business_id is null and r_agente is null and r_card_id is null
    when p_modo = 'COORDENACAO' then false
    when p_modo = 'EMPRESA' and p_business_id is null then false
    when r_escopo = 'PESSOAL' then p_modo = 'PESSOAL' and r_business_id is null and r_agente is not distinct from p_agente
    when p_modo = 'PESSOAL' then r_escopo = 'CARD' and r_business_id is null and p_card_id is not null
                                  and r_card_id = p_card_id
    when r_business_id is distinct from p_business_id then false
    when r_escopo = 'CARD' then r_card_id is not null and r_card_id = p_card_id
    when r_escopo = 'AGENTE_EMPRESA' then r_agente is not distinct from p_agente and r_card_id is null
                                           and (r_servico is null or r_servico is not distinct from p_servico)
    else false end, false);
$f$;

-- Hash atual de uma fonte (hex SHA-256) ou null se ela não existe mais. Usado ao registrar e para achar fonte mudada.
create function helena_v2._memoria_hash_fonte(p_tipo text, p_ref text, p_card_id uuid default null) returns text
language plpgsql stable set search_path = pg_catalog, pg_temp as $f$
declare v_base text;
begin
  case p_tipo
    when 'ENTREGA' then
      if p_ref !~ '^[0-9]{1,18}$' then return null; end if;
      select e.conteudo::text into v_base from helena_v2.entrega e where e.id = p_ref::bigint;
    when 'HISTORICO' then
      if p_ref !~ '^[0-9]{1,18}$' then return null; end if;
      select h.evento || ':' || coalesce(h.conteudo::text,'') || ':' || h.parametros::text into v_base
        from helena_v2.historico h where h.id = p_ref::bigint;
    when 'DECISAO' then
      select d.decisao || ':' || coalesce(d.row_version::text,'') into v_base
        from public.decisoes d where d.decision_id = p_ref;
    when 'CHECKPOINT' then
      select coalesce(c.resumo_executivo,'') || ':' || coalesce(c.versao::text,'') into v_base
        from public.checkpoint_mestre c where c.checkpoint_id = p_ref;
    when 'FONTE_IMPORTADA' then
      select c.ordem_de_servico #>> array['dados_reais','fontes_importadas',p_ref] into v_base
        from helena_v2.card c
       where (p_card_id is null or c.id = p_card_id)
         and (c.ordem_de_servico #> array['dados_reais','fontes_importadas']) ? p_ref
       order by c.criado_em limit 1;
    when 'TELEGRAM_PEDIDO' then
      if p_ref !~ '^[0-9]{1,18}$' then return null; end if;
      select encode(i.bruto_hash,'hex') into v_base from helena_v2.telegram_inbox i where i.update_id = p_ref::bigint;
    when 'RESUMO' then
      if p_ref !~ '^[0-9a-f-]{36}$' then return null; end if;
      select encode(r.texto_hash,'hex') into v_base from helena_v2.memoria_resumo r where r.id = p_ref::uuid;
    else return null;
  end case;
  if v_base is null then return null; end if;
  return encode(extensions.digest(v_base,'sha256'),'hex');
end;
$f$;

-- A fonte existe E pertence ao escopo? É aqui que a empresa A é impedida de citar a empresa B.
--   ENTREGA/FONTE_IMPORTADA: só escopos de empresa/card, da mesma empresa (e do mesmo card no escopo CARD);
--   HISTORICO: do card (CARD) ou de card da empresa (AGENTE_EMPRESA); nunca nos escopos gerais;
--   DECISAO: vigente e global ou da mesma empresa; CHECKPOINT: só FUNDADOR; TELEGRAM_PEDIDO: só /pedido de
--   chat pareado (nunca CONVERSA/MIDIA) e só em escopos gerais; RESUMO: da mesma empresa e escopo compatível.
create function helena_v2._memoria_fonte_pertence(
  p_escopo text, p_business_id text, p_agente text, p_card_id uuid, p_tipo text, p_ref text
) returns boolean language plpgsql stable set search_path = pg_catalog, pg_temp as $f$
declare v_ok boolean := false;
begin
  case p_tipo
    when 'ENTREGA' then
      if p_escopo in ('CARD','AGENTE_EMPRESA') and p_ref ~ '^[0-9]{1,18}$' then
        select exists (select 1 from helena_v2.entrega e
            join helena_v2.card c on c.id = e.card_id
            join helena_v2.etapa t on t.id = e.etapa_id
           where e.id = p_ref::bigint and e.portao1 = 'PASSOU' and t.estado in ('APROVADA','PRONTA')
             and c.empresa is not distinct from p_business_id
             and (p_escopo <> 'CARD' or e.card_id = p_card_id)) into v_ok;
      end if;
    when 'HISTORICO' then
      if p_escopo in ('CARD','AGENTE_EMPRESA') and p_ref ~ '^[0-9]{1,18}$' then
        select exists (select 1 from helena_v2.historico h
            join helena_v2.card c on c.id = h.card_id
           where h.id = p_ref::bigint and c.empresa is not distinct from p_business_id
             and (p_escopo <> 'CARD' or h.card_id = p_card_id)) into v_ok;
      end if;
    when 'DECISAO' then
      select exists (select 1 from public.decisoes d
         where d.decision_id = p_ref and d.status in ('ATIVO','ATIVA','VIGENTE')
           and (d.business_id is null or d.business_id = p_business_id)) into v_ok;
    when 'CHECKPOINT' then
      if p_escopo = 'FUNDADOR' then
        select exists (select 1 from public.checkpoint_mestre c where c.checkpoint_id = p_ref) into v_ok;
      end if;
    when 'FONTE_IMPORTADA' then
      if p_escopo in ('CARD','AGENTE_EMPRESA') then
        select exists (select 1 from helena_v2.card c
           where c.empresa is not distinct from p_business_id and (p_escopo <> 'CARD' or c.id = p_card_id)
             and (c.ordem_de_servico #> array['dados_reais','fontes_importadas']) ? p_ref) into v_ok;
      end if;
    when 'TELEGRAM_PEDIDO' then
      if p_escopo in ('FUNDADOR','PESSOAL') and p_ref ~ '^[0-9]{1,18}$' then
        select exists (select 1 from helena_v2.telegram_inbox i
           where i.update_id = p_ref::bigint and i.tipo = 'PEDIDO' and i.fundador_uid is not null) into v_ok;
      end if;
    when 'RESUMO' then
      if p_ref ~ '^[0-9a-f-]{36}$' then
        select exists (select 1 from helena_v2.memoria_resumo r
           where r.id = p_ref::uuid and r.estado in ('ATIVO','SUPERADO')
             and r.business_id is not distinct from p_business_id
             and (r.escopo <> 'PESSOAL' or r.agente is not distinct from p_agente)
             and (r.escopo = p_escopo or (p_escopo = 'AGENTE_EMPRESA' and r.escopo = 'CARD'))
             and (p_escopo <> 'CARD' or r.card_id = p_card_id)) into v_ok;
      end if;
    else v_ok := false;
  end case;
  return coalesce(v_ok, false);
end;
$f$;

-- --------------------------------------------------------------------------------- escrita (só o motor)
-- Registra uma PROPOSTA de resumo (ainda não vale). Idempotente pela chave: a mesma chave devolve a mesma linha.
create function helena_v2.registrar_resumo_memoria(
  p_escopo text, p_business_id text, p_agente text, p_servico text, p_card_id uuid,
  p_texto text, p_afirmacoes jsonb, p_fatos_duros jsonb, p_fontes jsonb,
  p_origem text, p_autor text, p_execucao_autor bigint, p_chave_idempotencia text,
  p_expira_em timestamptz default null
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_chave text; v_exist helena_v2.memoria_resumo; v_hash bytea; v_versao integer; v_base uuid;
  v_prof integer := 0; v_primarias integer := 0; v_resumos integer := 0; v_id uuid;
  f jsonb; a jsonb; v_prof_citado smallint;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_escopo is null or p_escopo not in ('CARD','AGENTE_EMPRESA','FUNDADOR','PESSOAL') then
    raise exception 'MEMORIA_ESCOPO_INVALIDO' using errcode = '22023';
  end if;
  if p_texto is null or char_length(p_texto) not between 1 and 8000 then
    raise exception 'MEMORIA_TEXTO_INVALIDO' using errcode = '22023';
  end if;
  if jsonb_typeof(p_afirmacoes) is distinct from 'array' or jsonb_array_length(p_afirmacoes) > 60
     or jsonb_typeof(p_fatos_duros) is distinct from 'array' or jsonb_array_length(p_fatos_duros) > 60 then
    raise exception 'MEMORIA_CONTEUDO_INVALIDO' using errcode = '22023';
  end if;
  if jsonb_typeof(p_fontes) is distinct from 'array' or jsonb_array_length(p_fontes) not between 1 and 200 then
    raise exception 'MEMORIA_SEM_FONTES' using errcode = '23514';
  end if;
  if p_origem is null or p_origem not in ('CODIGO','AGENTE')
     or (p_origem = 'AGENTE' and (p_autor is null or p_execucao_autor is null)) then
    raise exception 'MEMORIA_ORIGEM_INVALIDA' using errcode = '22023';
  end if;
  if p_chave_idempotencia is null or char_length(p_chave_idempotencia) not between 8 and 200 then
    raise exception 'MEMORIA_CHAVE_INVALIDA' using errcode = '22023';
  end if;
  if p_business_id is not null and not exists (
       select 1 from public.portfolio p where p.business_id = p_business_id and p.ativo = 'SIM') then
    raise exception 'MEMORIA_EMPRESA_INVALIDA' using errcode = '23514';
  end if;
  if p_card_id is not null and not exists (
       select 1 from helena_v2.card c where c.id = p_card_id and c.empresa is not distinct from p_business_id) then
    raise exception 'MEMORIA_CARD_FORA_DA_EMPRESA' using errcode = '23514';
  end if;
  v_hash := extensions.digest(p_texto,'sha256');
  v_chave := p_escopo || '|' || coalesce(p_business_id,'') || '|' || coalesce(p_agente,'') || '|'
             || coalesce(p_servico,'') || '|' || coalesce(p_card_id::text,'');
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 0));
  select * into v_exist from helena_v2.memoria_resumo where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_exist.chave_escopo <> v_chave or v_exist.texto_hash <> v_hash then
      raise exception 'MEMORIA_IDEMPOTENCIA_DIVERGENTE' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_exist.id, 'versao', v_exist.versao, 'estado', v_exist.estado, 'novo', false);
  end if;

  if (select count(distinct (value ->> 'tipo') || ':' || (value ->> 'ref')) from jsonb_array_elements(p_fontes))
     <> jsonb_array_length(p_fontes) then
    raise exception 'MEMORIA_FONTE_REPETIDA' using errcode = '22023';
  end if;
  for f in select value from jsonb_array_elements(p_fontes) loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f -> 'tipo') <> 'string' or jsonb_typeof(f -> 'ref') <> 'string' then
      raise exception 'MEMORIA_FONTE_INVALIDA' using errcode = '22023';
    end if;
    if not helena_v2._memoria_fonte_pertence(p_escopo, p_business_id, p_agente, p_card_id, f ->> 'tipo', f ->> 'ref') then
      raise exception 'MEMORIA_FONTE_INEXISTENTE_OU_FORA_DE_ESCOPO: %:%', f ->> 'tipo', f ->> 'ref'
        using errcode = '23514';
    end if;
    if f ->> 'tipo' = 'RESUMO' then
      v_resumos := v_resumos + 1;
      select profundidade into v_prof_citado from helena_v2.memoria_resumo where id = (f ->> 'ref')::uuid;
      v_prof := greatest(v_prof, v_prof_citado + 1);
    else
      v_primarias := v_primarias + 1;
    end if;
  end loop;
  if v_prof > 2 then
    raise exception 'MEMORIA_PROFUNDIDADE_EXCEDIDA' using errcode = '23514';
  end if;
  if v_resumos > 0 and v_primarias = 0 then
    raise exception 'MEMORIA_SEM_ANCORA_PRIMARIA' using errcode = '23514';
  end if;
  for a in select value from jsonb_array_elements(p_afirmacoes) loop
    if jsonb_typeof(a) <> 'object' or coalesce(a ->> 'texto','') = '' or jsonb_typeof(a -> 'fontes') <> 'array'
       or jsonb_array_length(a -> 'fontes') = 0 then
      raise exception 'MEMORIA_AFIRMACAO_SEM_FONTE' using errcode = '23514';
    end if;
    for f in select value from jsonb_array_elements(a -> 'fontes') loop
      if not (p_fontes @> jsonb_build_array(jsonb_build_object('tipo', f ->> 'tipo', 'ref', f ->> 'ref'))) then
        raise exception 'MEMORIA_AFIRMACAO_CITA_FONTE_NAO_DECLARADA' using errcode = '23514';
      end if;
    end loop;
  end loop;

  select coalesce(max(versao), 0) + 1, (array_agg(id) filter (where estado = 'ATIVO'))[1]
    into v_versao, v_base from helena_v2.memoria_resumo where chave_escopo = v_chave;
  insert into helena_v2.memoria_resumo(escopo, business_id, agente, servico, card_id, versao, origem, texto,
      afirmacoes, fatos_duros, texto_hash, base_id, profundidade, autor, execucao_autor, chave_idempotencia, expira_em)
    values (p_escopo, p_business_id, p_agente, p_servico, p_card_id, v_versao, p_origem, p_texto,
      p_afirmacoes, p_fatos_duros, v_hash, v_base, v_prof, p_autor, p_execucao_autor, p_chave_idempotencia, p_expira_em)
    returning id into v_id;
  insert into helena_v2.memoria_resumo_fonte(resumo_id, tipo, ref, ref_hash)
    select v_id, x ->> 'tipo', x ->> 'ref', helena_v2._memoria_hash_fonte(x ->> 'tipo', x ->> 'ref', p_card_id)
      from jsonb_array_elements(p_fontes) x;
  return jsonb_build_object('id', v_id, 'versao', v_versao, 'estado', 'PROPOSTO', 'base_id', v_base,
                            'profundidade', v_prof, 'novo', true);
end;
$f$;

-- Torna o resumo ATIVO (e supera o anterior) com comparação otimista: a base precisa continuar a ativa.
create function helena_v2.ativar_resumo_memoria(
  p_id uuid, p_revisor text default null, p_execucao_revisor bigint default null
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.memoria_resumo; v_ativo uuid;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  select * into v from helena_v2.memoria_resumo where id = p_id for update;
  if not found or v.estado <> 'PROPOSTO' then
    raise exception 'MEMORIA_NAO_ESTA_PROPOSTA' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v.chave_escopo, 0));
  select id into v_ativo from helena_v2.memoria_resumo where chave_escopo = v.chave_escopo and estado = 'ATIVO';
  if v_ativo is distinct from v.base_id then
    raise exception 'MEMORIA_BASE_DESATUALIZADA' using errcode = '40001';
  end if;
  if v.origem = 'AGENTE' then
    if p_revisor is null or p_execucao_revisor is null or upper(p_revisor) = upper(v.autor)
       or not exists (select 1 from helena_v2.execucao x
                       join helena_v2.resposta_execucao r on r.numero = x.numero
                      where x.numero = p_execucao_revisor and x.tipo = 'REVISOR') then
      raise exception 'MEMORIA_REVISAO_INDEPENDENTE_OBRIGATORIA' using errcode = '42501';
    end if;
  end if;
  if v.escopo in ('FUNDADOR','PESSOAL') and v.aprovado_por is null then
    raise exception 'MEMORIA_EXIGE_APROVACAO_DO_FUNDADOR' using errcode = '42501';
  end if;
  if v_ativo is not null then
    update helena_v2.memoria_resumo set estado = 'SUPERADO' where id = v_ativo;
  end if;
  update helena_v2.memoria_resumo set estado = 'ATIVO', ativado_em = clock_timestamp(),
      revisor = coalesce(p_revisor, revisor), execucao_revisor = coalesce(p_execucao_revisor, execucao_revisor)
    where id = p_id;
  return jsonb_build_object('id', p_id, 'versao', v.versao, 'estado', 'ATIVO', 'superou', v_ativo);
end;
$f$;

create function helena_v2.rejeitar_resumo_memoria(p_id uuid, p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_motivo is null or char_length(p_motivo) not between 1 and 500 then
    raise exception 'MEMORIA_MOTIVO_INVALIDO' using errcode = '22023';
  end if;
  update helena_v2.memoria_resumo set estado = 'REJEITADO', motivo = p_motivo
    where id = p_id and estado = 'PROPOSTO';
  if not found then
    raise exception 'MEMORIA_NAO_ESTA_PROPOSTA' using errcode = '23514';
  end if;
  return jsonb_build_object('id', p_id, 'estado', 'REJEITADO');
end;
$f$;

-- Indexa um trecho literal (a literalidade é conferida pelo código antes; aqui ficam origem e hash da fonte inteira).
create function helena_v2.indexar_trecho_memoria(
  p_escopo text, p_business_id text, p_agente text, p_servico text, p_card_id uuid,
  p_origem_tipo text, p_origem_ref text, p_ordem integer, p_texto text, p_expira_em timestamptz default null
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_hash bytea; v_origem text; v_id uuid;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_texto is null or char_length(p_texto) not between 1 and 1200 or p_ordem is null or p_ordem < 0 then
    raise exception 'MEMORIA_TRECHO_INVALIDO' using errcode = '22023';
  end if;
  if p_business_id is not null and not exists (
       select 1 from public.portfolio p where p.business_id = p_business_id and p.ativo = 'SIM') then
    raise exception 'MEMORIA_EMPRESA_INVALIDA' using errcode = '23514';
  end if;
  if p_card_id is not null and not exists (
       select 1 from helena_v2.card c where c.id = p_card_id and c.empresa is not distinct from p_business_id) then
    raise exception 'MEMORIA_CARD_FORA_DA_EMPRESA' using errcode = '23514';
  end if;
  if p_origem_tipo = 'RESUMO' or not helena_v2._memoria_fonte_pertence(
       p_escopo, p_business_id, p_agente, p_card_id, p_origem_tipo, p_origem_ref) then
    raise exception 'MEMORIA_FONTE_INEXISTENTE_OU_FORA_DE_ESCOPO' using errcode = '23514';
  end if;
  v_origem := helena_v2._memoria_hash_fonte(p_origem_tipo, p_origem_ref, p_card_id);
  v_hash := extensions.digest(p_texto,'sha256');
  insert into helena_v2.memoria_trecho(escopo, business_id, agente, servico, card_id, origem_tipo, origem_ref,
      origem_hash, ordem, texto, texto_hash, expira_em)
    values (p_escopo, p_business_id, p_agente, p_servico, p_card_id, p_origem_tipo, p_origem_ref,
      v_origem, p_ordem, p_texto, v_hash, p_expira_em)
    on conflict (chave_escopo, origem_tipo, origem_ref, texto_hash) do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from helena_v2.memoria_trecho
     where chave_escopo = p_escopo || '|' || coalesce(p_business_id,'') || '|' || coalesce(p_agente,'') || '|'
                          || coalesce(p_servico,'') || '|' || coalesce(p_card_id::text,'')
       and origem_tipo = p_origem_tipo and origem_ref = p_origem_ref and texto_hash = v_hash;
    return jsonb_build_object('id', v_id, 'novo', false);
  end if;
  return jsonb_build_object('id', v_id, 'novo', true);
end;
$f$;

-- ---------------------------------------------------------------------------------- leitura (só o motor)
-- Resumos ATIVOS, vigentes, aprovados (quando exigido) e do escopo pedido. Sem escopo válido não devolve nada.
create function helena_v2.ler_memoria_execucao(
  p_modo text, p_agente text, p_business_id text, p_servico text, p_card_id uuid,
  p_agora timestamptz default clock_timestamp(), p_maximo integer default 6
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_lista jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_modo not in ('EMPRESA','PESSOAL','COORDENACAO')
     or (p_modo = 'EMPRESA' and p_business_id is null)
     or (p_modo = 'PESSOAL' and (p_business_id is not null or p_agente is null))
     or (p_modo = 'COORDENACAO' and (p_business_id is not null or p_card_id is not null))
     or (p_card_id is not null and not exists (
          select 1 from helena_v2.card c where c.id = p_card_id and c.empresa is not distinct from p_business_id)) then
    raise exception 'MEMORIA_ESCOPO_INCONSISTENTE' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'versao', r.versao, 'escopo', r.escopo, 'business_id', r.business_id, 'agente', r.agente,
      'servico', r.servico, 'card_id', r.card_id, 'estado', r.estado, 'origem', r.origem,
      'profundidade', r.profundidade, 'texto', r.texto, 'afirmacoes', r.afirmacoes, 'fatos_duros', r.fatos_duros,
      'fontes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', f.tipo, 'ref', f.ref) order by f.tipo, f.ref),
                                 '[]'::jsonb) from helena_v2.memoria_resumo_fonte f where f.resumo_id = r.id),
      'texto_hash', encode(r.texto_hash, 'hex'), 'expira_em', r.expira_em, 'aprovado_por', r.aprovado_por,
      'autor', r.autor, 'revisor', r.revisor) order by r.prio, r.versao desc, r.id), '[]'::jsonb)
    into v_lista
    from (select r.*, case r.escopo when 'CARD' then 0 when 'FUNDADOR' then 2 else 1 end as prio
            from helena_v2.memoria_resumo r
           where r.estado = 'ATIVO' and (r.expira_em is null or r.expira_em > p_agora)
             and (r.escopo not in ('FUNDADOR','PESSOAL') or r.aprovado_por is not null)
             and helena_v2._memoria_escopo_permite(p_modo, p_agente, p_business_id, p_servico, p_card_id,
                   r.escopo, r.business_id, r.agente, r.servico, r.card_id)
           order by prio, r.versao desc, r.id limit least(greatest(coalesce(p_maximo, 6), 1), 10)) r;
  return v_lista;
end;
$f$;

-- Busca textual (português) com filtro de escopo OBRIGATÓRIO, top-K e teto de caracteres (≈ tokens).
-- Quem monta a consulta é o código (memoria.montar_consulta), nunca o agente.
create function helena_v2.buscar_memoria(
  p_modo text, p_agente text, p_business_id text, p_servico text, p_card_id uuid, p_consulta text,
  p_limite integer default 5, p_max_caracteres integer default 6000, p_agora timestamptz default clock_timestamp()
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_q tsquery; v_lista jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_modo not in ('EMPRESA','PESSOAL','COORDENACAO')
     or (p_modo = 'EMPRESA' and p_business_id is null)
     or (p_modo = 'PESSOAL' and (p_business_id is not null or p_agente is null))
     or (p_modo = 'COORDENACAO' and (p_business_id is not null or p_card_id is not null))
     or (p_card_id is not null and not exists (
          select 1 from helena_v2.card c where c.id = p_card_id and c.empresa is not distinct from p_business_id)) then
    raise exception 'MEMORIA_ESCOPO_INCONSISTENTE' using errcode = '22023';
  end if;
  if p_consulta is null or char_length(btrim(p_consulta)) not between 1 and 300 then
    return '[]'::jsonb;
  end if;
  v_q := websearch_to_tsquery('portuguese', p_consulta);
  if numnode(v_q) = 0 then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'origem_tipo', s.origem_tipo, 'origem_ref', s.origem_ref, 'texto', s.texto,
      'escopo', s.escopo, 'business_id', s.business_id, 'agente', s.agente, 'servico', s.servico,
      'card_id', s.card_id, 'estado', s.estado, 'pontuacao', s.rk, 'aprovado_por', s.aprovado_por,
      'expira_em', s.expira_em) order by s.rk desc, s.id), '[]'::jsonb)
    into v_lista
    from (select * from (
            select t.*, ts_rank_cd(t.busca, v_q) as rk,
                   sum(char_length(t.texto)) over (order by ts_rank_cd(t.busca, v_q) desc, t.id) as acumulado
              from helena_v2.memoria_trecho t
             where t.estado = 'ATIVO' and t.busca @@ v_q
               and (t.expira_em is null or t.expira_em > p_agora)
               and (t.escopo not in ('FUNDADOR','PESSOAL') or t.aprovado_por is not null)
               and helena_v2._memoria_escopo_permite(p_modo, p_agente, p_business_id, p_servico, p_card_id,
                     t.escopo, t.business_id, t.agente, t.servico, t.card_id)) c
           where c.acumulado <= least(greatest(coalesce(p_max_caracteres, 6000), 200), 12000)
           order by c.rk desc, c.id
           limit least(greatest(coalesce(p_limite, 5), 1), 10)) s;
  return v_lista;
end;
$f$;

-- Registra o que a execução recebeu (idempotente). O hash precisa casar com o do banco: o Python e o SQL
-- calculam o SHA-256 do mesmo texto canônico. Serve à auditoria e a medir_custo_memoria.
create function helena_v2.registrar_uso_memoria(p_numero bigint, p_itens jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare i jsonb; v_hash text; v_n integer := 0;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) > 40
     or not exists (select 1 from helena_v2.execucao x where x.numero = p_numero and x.tipo in ('AUTOR','HELENA')) then
    raise exception 'MEMORIA_USO_INVALIDO' using errcode = '22023';
  end if;
  for i in select value from jsonb_array_elements(p_itens) loop
    if i ->> 'tipo' = 'RESUMO' then
      select encode(texto_hash, 'hex') into v_hash from helena_v2.memoria_resumo where id = (i ->> 'id')::uuid;
    elsif i ->> 'tipo' = 'TRECHO' then
      select encode(texto_hash, 'hex') into v_hash from helena_v2.memoria_trecho where id = (i ->> 'id')::uuid;
    else
      raise exception 'MEMORIA_USO_INVALIDO' using errcode = '22023';
    end if;
    if v_hash is null or (i ->> 'tipo' = 'RESUMO' and (i ->> 'hash') is distinct from v_hash)
       or (i ->> 'tipo' = 'TRECHO' and (i ->> 'hash') is distinct from v_hash) then
      raise exception 'MEMORIA_USO_HASH_DIVERGENTE' using errcode = '23514';
    end if;
    insert into helena_v2.memoria_uso(execucao_numero, tipo, item_id, versao, texto_hash, caracteres, tokens_estimados)
      values (p_numero, i ->> 'tipo', (i ->> 'id')::uuid, nullif(i ->> 'versao','')::integer, v_hash,
              (i ->> 'caracteres')::integer, ((i ->> 'caracteres')::integer + 2) / 3)
      on conflict (execucao_numero, tipo, item_id) do nothing;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('numero', p_numero, 'itens', v_n);
end;
$f$;

create function helena_v2.expirar_memorias(p_agora timestamptz default clock_timestamp()) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_r integer; v_t integer;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  update helena_v2.memoria_resumo set estado = 'EXPIRADO' where estado = 'ATIVO' and expira_em <= p_agora;
  get diagnostics v_r = row_count;
  update helena_v2.memoria_trecho set estado = 'EXPIRADO' where estado = 'ATIVO' and expira_em <= p_agora;
  get diagnostics v_t = row_count;
  return jsonb_build_object('resumos', v_r, 'trechos', v_t);
end;
$f$;

-- Tokens de memória estimados x tokens de entrada reais (uso.json gravado em resposta_execucao) por execução.
create function helena_v2.medir_custo_memoria(p_desde timestamptz default clock_timestamp() - interval '30 days')
returns table (execucao_numero bigint, itens bigint, caracteres_memoria bigint, tokens_memoria_estimados bigint,
               tokens_entrada_real bigint)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  return query
    select u.execucao_numero, count(*), sum(u.caracteres)::bigint, sum(u.tokens_estimados)::bigint,
           max(nullif(r.resposta #>> '{uso,tokens_entrada}', '')::bigint)
      from helena_v2.memoria_uso u
      left join helena_v2.resposta_execucao r on r.numero = u.execucao_numero
     where u.registrado_em >= p_desde
     group by u.execucao_numero order by u.execucao_numero;
end;
$f$;

-- Resumos ATIVOS cuja fonte mudou ou sumiu desde o registro: candidatos a nova compactação (re-ancoragem).
create function helena_v2.resumos_com_fonte_alterada()
returns table (resumo_id uuid, tipo text, ref text, hash_registrado text, hash_atual text)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  return query
    select f.resumo_id, f.tipo, f.ref, f.ref_hash, helena_v2._memoria_hash_fonte(f.tipo, f.ref, r.card_id)
      from helena_v2.memoria_resumo_fonte f
      join helena_v2.memoria_resumo r on r.id = f.resumo_id and r.estado = 'ATIVO'
     where f.ref_hash is distinct from helena_v2._memoria_hash_fonte(f.tipo, f.ref, r.card_id);
end;
$f$;

-- --------------------------------------------------------------------------- fundador (sessão autenticada)
create function helena_v2.listar_memorias_fundador(p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_res jsonb; v_tre jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 200 then
    raise exception 'LIMITE_INVALIDO' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc), '[]'::jsonb) into v_res from (
    select id, escopo, business_id, agente, servico, card_id, versao, estado, origem, profundidade, texto,
           autor, revisor, criado_em, ativado_em, expira_em, aprovado_por, aprovado_em
      from helena_v2.memoria_resumo where estado in ('PROPOSTO','ATIVO') order by criado_em desc limit p_limite) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc), '[]'::jsonb) into v_tre from (
    select id, escopo, business_id, agente, origem_tipo, origem_ref, texto, estado, criado_em, expira_em,
           aprovado_por, aprovado_em
      from helena_v2.memoria_trecho where estado = 'ATIVO' and escopo in ('FUNDADOR','PESSOAL')
     order by criado_em desc limit p_limite) x;
  return jsonb_build_object('resumos', v_res, 'trechos', v_tre);
end;
$f$;

-- O "sim" do fundador para o que vale para todas as empresas (FUNDADOR) ou para a vida pessoal (PESSOAL).
create function helena_v2.aprovar_memoria_fundador(p_tipo text, p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_tipo = 'RESUMO' then
    update helena_v2.memoria_resumo set aprovado_por = auth.uid(), aprovado_em = clock_timestamp()
      where id = p_id and escopo in ('FUNDADOR','PESSOAL') and estado = 'PROPOSTO' and aprovado_por is null;
  elsif p_tipo = 'TRECHO' then
    update helena_v2.memoria_trecho set aprovado_por = auth.uid(), aprovado_em = clock_timestamp()
      where id = p_id and escopo in ('FUNDADOR','PESSOAL') and estado = 'ATIVO' and aprovado_por is null;
  else
    raise exception 'MEMORIA_TIPO_INVALIDO' using errcode = '22023';
  end if;
  if not found then
    raise exception 'MEMORIA_NAO_APROVAVEL' using errcode = '23514';
  end if;
  return jsonb_build_object('tipo', p_tipo, 'id', p_id, 'aprovado', true);
end;
$f$;

-- Esquecer: apaga o TEXTO da memória derivada (mantém ids, hashes e a trilha) e, em cascata, os resumos feitos a
-- partir dela. NÃO apaga os registros de negócio (entregas, histórico, decisões): esses seguem a política própria.
create function helena_v2.esquecer_memoria_fundador(p_tipo text, p_id uuid, p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_n integer := 0; v_ids uuid[];
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_motivo is null or char_length(p_motivo) not between 1 and 500 then
    raise exception 'MEMORIA_MOTIVO_INVALIDO' using errcode = '22023';
  end if;
  perform set_config('helena_v2.esquecendo', 'sim', true);
  if p_tipo = 'TRECHO' then
    update helena_v2.memoria_trecho set estado = 'ESQUECIDO', texto = '', motivo = p_motivo
      where id = p_id and estado in ('ATIVO','EXPIRADO');
    get diagnostics v_n = row_count;
  elsif p_tipo = 'RESUMO' then
    with recursive cadeia(id) as (
      select p_id
      union
      select f.resumo_id from helena_v2.memoria_resumo_fonte f join cadeia c on f.tipo = 'RESUMO' and f.ref = c.id::text)
    select array_agg(id) into v_ids from cadeia;
    update helena_v2.memoria_resumo set estado = 'ESQUECIDO', texto = '', afirmacoes = '[]'::jsonb,
        fatos_duros = '[]'::jsonb, motivo = p_motivo
      where id = any(v_ids) and estado <> 'ESQUECIDO';
    get diagnostics v_n = row_count;
  else
    perform set_config('helena_v2.esquecendo', 'nao', true);
    raise exception 'MEMORIA_TIPO_INVALIDO' using errcode = '22023';
  end if;
  perform set_config('helena_v2.esquecendo', 'nao', true);
  if v_n = 0 then
    raise exception 'MEMORIA_NADA_A_ESQUECER' using errcode = '23514';
  end if;
  return jsonb_build_object('tipo', p_tipo, 'id', p_id, 'esquecidos', v_n);
end;
$f$;

-- ---------------------------------------------------------------------------------------------- permissões
revoke all on helena_v2.memoria_resumo, helena_v2.memoria_resumo_fonte, helena_v2.memoria_trecho,
  helena_v2.memoria_uso from public, anon, authenticated, service_role;
revoke all on function helena_v2._memoria_so_acrescenta(), helena_v2._memoria_proteger(),
  helena_v2._memoria_escopo_permite(text,text,text,text,uuid,text,text,text,text,uuid),
  helena_v2._memoria_hash_fonte(text,text,uuid),
  helena_v2._memoria_fonte_pertence(text,text,text,uuid,text,text),
  helena_v2.registrar_resumo_memoria(text,text,text,text,uuid,text,jsonb,jsonb,jsonb,text,text,bigint,text,timestamptz),
  helena_v2.ativar_resumo_memoria(uuid,text,bigint),
  helena_v2.rejeitar_resumo_memoria(uuid,text),
  helena_v2.indexar_trecho_memoria(text,text,text,text,uuid,text,text,integer,text,timestamptz),
  helena_v2.ler_memoria_execucao(text,text,text,text,uuid,timestamptz,integer),
  helena_v2.buscar_memoria(text,text,text,text,uuid,text,integer,integer,timestamptz),
  helena_v2.registrar_uso_memoria(bigint,jsonb),
  helena_v2.expirar_memorias(timestamptz),
  helena_v2.medir_custo_memoria(timestamptz),
  helena_v2.resumos_com_fonte_alterada(),
  helena_v2.listar_memorias_fundador(integer),
  helena_v2.aprovar_memoria_fundador(text,uuid),
  helena_v2.esquecer_memoria_fundador(text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function
  helena_v2.registrar_resumo_memoria(text,text,text,text,uuid,text,jsonb,jsonb,jsonb,text,text,bigint,text,timestamptz),
  helena_v2.ativar_resumo_memoria(uuid,text,bigint),
  helena_v2.rejeitar_resumo_memoria(uuid,text),
  helena_v2.indexar_trecho_memoria(text,text,text,text,uuid,text,text,integer,text,timestamptz),
  helena_v2.ler_memoria_execucao(text,text,text,text,uuid,timestamptz,integer),
  helena_v2.buscar_memoria(text,text,text,text,uuid,text,integer,integer,timestamptz),
  helena_v2.registrar_uso_memoria(bigint,jsonb),
  helena_v2.expirar_memorias(timestamptz),
  helena_v2.medir_custo_memoria(timestamptz),
  helena_v2.resumos_com_fonte_alterada() to service_role;
grant execute on function
  helena_v2.listar_memorias_fundador(integer),
  helena_v2.aprovar_memoria_fundador(text,uuid),
  helena_v2.esquecer_memoria_fundador(text,uuid,text) to authenticated;

-- ------------------------------------------------------------------------------------ OPCIONAL: vetores
-- DECISÃO DO FUNDADOR (ver o manual, seção de decisões). NÃO CONFIRMADO que a extensão `vector` (pgvector) esteja
-- disponível/habilitada no projeto: nada nos docs ou nas migrations do repositório a menciona. Para conferir em modo
-- leitura (por quem tiver acesso ao banco, não por este rascunho):
--     select name, default_version, installed_version from pg_available_extensions where name = 'vector';
-- Só descomentar depois de (1) a extensão confirmada, (2) um modelo de embedding escolhido (a dimensão abaixo é de
-- exemplo e depende dele), (3) o custo e o envio de texto ao provedor de embedding aprovados, e (4) a busca vetorial
-- continuar OBRIGATORIAMENTE filtrada pelo mesmo _memoria_escopo_permite (filtro por escopo ANTES de ordenar por
-- distância; índices aproximados podem devolver menos linhas quando o filtro é seletivo).
--
-- create extension if not exists vector with schema extensions;
-- alter table helena_v2.memoria_trecho add column embedding extensions.vector(1536);
-- create index memoria_trecho_vetor on helena_v2.memoria_trecho
--   using hnsw (embedding extensions.vector_cosine_ops) where estado = 'ATIVO';
-- A função de busca vetorial seria uma irmã de buscar_memoria (mesmos parâmetros de escopo, limite e caracteres),
-- ordenando por `embedding <=> p_vetor` depois do filtro de escopo; o embedding é calculado pelo código, nunca pelo agente.
