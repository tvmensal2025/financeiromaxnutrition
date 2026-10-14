-- 0001 — ESQUEMA DA V2 (schema helena_v2): as tabelas que guardam o que acontece.
-- O que é: card, etapa, ação externa, histórico, entregas, execuções e mensagens. Só a estrutura.
-- De onde vem: escrito à mão, a partir do plano (docs/plano/PLANO-HELENA-V3.md: "A jornada do card",
--              "As 13 regras de ferro" e "O motor: o DBOS executa, o banco manda").
-- Como mudar: as COLUNAS DOS CONTADORES (motivo, ordens, execucoes...) e os tetos NÃO ficam aqui: o
--             0002 (gerado do YAML) as acrescenta. Aqui só mora o que não vem da tabela de passagens.
--             As travas das 13 regras e as permissões ficam no 0004.
-- Aplicar: só em banco LOCAL de teste. No Supabase real, só com a frase exata do fundador (ver README).

create schema if not exists helena_v2;
comment on schema helena_v2 is 'Sistema Helena v2: o banco manda, o motor executa, o agente só escreve conteúdo.';

-- Número da execução: uma sequência do banco. Nunca zera, nem em rodada nova (regra 3).
create sequence if not exists helena_v2.seq_numero_execucao as bigint start with 1 no cycle;

-- Toda mensagem do fundador é gravada UMA vez, com o número único do canal (regra 11).
create table if not exists helena_v2.mensagem (
  id bigint generated always as identity primary key,
  canal text not null,
  numero text not null,
  recebida_em timestamptz not null default now(),
  conteudo text not null default '',
  constraint mensagem_numero_unico unique (canal, numero)
);

-- CARD. O estado e os contadores (colunas geradas no 0002) só mudam pela função helena_v2.aplicar_evento.
create table if not exists helena_v2.card (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  titulo text not null,
  empresa text,
  ordem_de_servico jsonb not null default '{}'::jsonb,   -- o que você quer, como é o pronto, o que não pode
  prioridade integer not null default 0,                 -- só o fundador muda (regra 7)
  prazo timestamptz not null,                            -- só o fundador muda (regra 7)
  estado text not null,
  dono text,                                             -- regra 1: quem tem a bola
  prazo_ate timestamptz,                                 -- regra 1: até quando
  versao integer not null default 1,                     -- versão da pergunta do card (toque sobre versão velha não vale)
  chamada_helena bigint,                                 -- chave da chamada atual da Helena (regra 3)
  card_pai_id uuid references helena_v2.card (id),       -- card novo ligado a um que fechou ou foi substituído
  mensagem_id bigint unique references helena_v2.mensagem (id)
);
create index if not exists card_pai on helena_v2.card (card_pai_id);

-- ETAPA. Cada versão nova de uma etapa que falhou é uma linha nova (a anterior fica como final).
create table if not exists helena_v2.etapa (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  card_id uuid not null references helena_v2.card (id),
  codigo text not null check (codigo ~ '^[A-Z][A-Z0-9_]{0,15}$'),
  ordem integer not null,
  nome text not null default '',
  geracao integer not null default 1,                    -- 1 = original; sobe quando "refazer" faz nascer uma versão nova
  atual boolean not null default true,
  autor text not null,                                   -- um dos 21 agentes (check gerado no 0002)
  revisores text[] not null default '{}',                -- a ficha, na ordem
  revisores_validos text[] not null default '{}',        -- a ficha sem o autor e sem quem julga depois (regra 4), mais o fundador
  julgadores text[] not null default '{}',               -- quem julga esta peça depois (regra 4)
  depende_de text[] not null default '{}',               -- regra 6
  julga text[] not null default '{}',
  tempo_maximo_s integer check (tempo_maximo_s > 0),     -- da ficha do agente (prazo de EXECUTANDO)
  prazo_revisao_s integer check (prazo_revisao_s > 0),   -- da ficha do revisor (prazo de REVISAO)
  estado text not null,
  dono text,
  prazo_ate timestamptz,
  versao integer not null default 1,                     -- sobe a cada entrega e a cada rodada nova
  execucao_atual bigint,                                 -- chave da execução viva (autor ou revisor); nula se não há
  chamada_helena bigint,                                 -- chave da chamada atual da Helena nesta etapa
  pulada boolean not null default false,                 -- o fundador mandou seguir sem esta (etapa com falha)
  respostas_guardadas text[] not null default '{}',      -- respostas suas que chegaram depois do final (RESPOSTA_GUARDADA)
  respostas_da_versao text[] not null default '{}',      -- as que viajaram para esta versão nova
  portao1_ok boolean not null default false,             -- a entrega atual passou no portão 1 (regra 9)
  entrega_fresca boolean not null default true           -- a entrega atual usa a informação atual (regra 10)
);
create unique index if not exists etapa_atual_unica on helena_v2.etapa (card_id, codigo) where atual;
create unique index if not exists etapa_geracao_unica on helena_v2.etapa (card_id, codigo, geracao);
create index if not exists etapa_do_card on helena_v2.etapa (card_id, ordem);

-- EXECUÇÕES: cada chamada de agente (autor, revisor) ou da Helena ganha um número da sequência.
create table if not exists helena_v2.execucao (
  numero bigint primary key default nextval('helena_v2.seq_numero_execucao'),
  tipo text not null check (tipo in ('AUTOR', 'REVISOR', 'HELENA')),
  card_id uuid not null references helena_v2.card (id),
  etapa_id uuid references helena_v2.etapa (id),
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  estado text not null default 'VIVA' check (estado in ('VIVA', 'RESPONDIDA', 'MORTA', 'SUBSTITUIDA'))
);
-- Regra 3: uma execução viva por etapa (autor ou revisor) e uma chamada viva da Helena por alvo.
create unique index if not exists execucao_uma_viva_por_etapa on helena_v2.execucao (etapa_id)
  where estado = 'VIVA' and tipo in ('AUTOR', 'REVISOR');
create unique index if not exists execucao_uma_chamada_helena_viva on helena_v2.execucao
  (card_id, coalesce(etapa_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where estado = 'VIVA' and tipo = 'HELENA';
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'etapa_execucao_atual_fk') then
    alter table helena_v2.etapa add constraint etapa_execucao_atual_fk
      foreign key (execucao_atual) references helena_v2.execucao (numero);
  end if;
end;
$fk$;

-- AÇÃO EXTERNA. Só nasce do card pronto (E110), no máximo uma por etapa (regra 8).
create table if not exists helena_v2.acao_externa (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  card_id uuid not null references helena_v2.card (id),
  codigo text not null,                                  -- A1, A2... dentro do card
  etapa_id uuid not null references helena_v2.etapa (id),
  etapa_codigo text not null,
  tipo text not null,                                    -- o que a entrega propôs (SO_FUNDADOR ou PELO_MOTOR)
  estado text not null,
  dono text,
  prazo_ate timestamptz,
  versao integer not null default 1,
  constraint acao_codigo_unico unique (card_id, codigo),
  constraint acao_uma_por_etapa unique (card_id, etapa_codigo)
);

-- HISTÓRICO: uma linha por evento, só de acréscimo. Reconstrói o card (regra 13).
create table if not exists helena_v2.historico (
  id bigint generated always as identity primary key,
  momento timestamptz not null default clock_timestamp(),
  card_id uuid not null references helena_v2.card (id),
  maquina text not null check (maquina in ('card', 'etapa', 'acao_externa')),
  alvo_id uuid not null,
  alvo_codigo text not null,
  papel text not null,
  evento text not null,
  parametros jsonb not null default '{}'::jsonb,
  ator text,
  chave bigint,                                          -- chave da execução que respondeu
  versao_vista integer,                                  -- versão que o fundador viu ao tocar
  conteudo jsonb,                                        -- a carga do evento (resposta do agente, relatório, novo prazo...)
  linha_id text,                                         -- a linha da tabela de passagens que casou (nula se não casou)
  resultado text not null check (resultado in
    ('APLICADO', 'CONVERTIDO', 'REACAO', 'COMENTARIO_NO_CARD', 'CARD_NOVO_LIGADO', 'RESPOSTA_GUARDADA', 'RECUSADO')),
  motivo text,
  origem text not null default 'EXTERNO' check (origem in ('EXTERNO', 'AUTOMATICO', 'SINAL')),
  origem_id bigint references helena_v2.historico (id), -- a linha de histórico que emitiu o sinal ou disparou o automático
  estado_antes text,
  estado_depois text,
  vars_antes jsonb,
  vars_depois jsonb,
  convertido_em text,                                    -- resposta de agente sem linha vira "MOTOR FALHA"
  numero_toque text,                                     -- número único do toque do fundador (repetir não repete o efeito)
  conta text not null                                    -- quem chamou
);
create unique index if not exists historico_toque_unico on helena_v2.historico (card_id, numero_toque) where numero_toque is not null;
create index if not exists historico_do_card on helena_v2.historico (card_id, id);
create index if not exists historico_do_alvo on helena_v2.historico (alvo_id, id);

-- ENTREGAS: a resposta do agente, a versão, o número da execução e o relatório de validação.
create table if not exists helena_v2.entrega (
  id bigint generated always as identity primary key,
  card_id uuid not null references helena_v2.card (id),
  etapa_id uuid not null references helena_v2.etapa (id),
  etapa_codigo text not null,
  versao integer not null,                               -- versão da peça no momento da entrega
  numero_execucao bigint not null unique references helena_v2.execucao (numero),
  autor text not null,
  parecer text,
  acao_externa text,                                     -- campo da entrega (dado): só vira proposta no card pronto
  usou_internet text,
  conteudo jsonb not null default '{}'::jsonb,           -- a resposta do agente
  portao1 text check (portao1 in ('PASSOU', 'RECUSOU')),
  relatorio_validacao jsonb,                             -- o que o validador (código) conferiu
  criada_em timestamptz not null default now(),
  historico_id bigint references helena_v2.historico (id)
);
create index if not exists entrega_da_etapa on helena_v2.entrega (etapa_id, id);

-- Quem pode dizer qual papel (a função única confere a conta que chama). Preenchida no 0004.
create table if not exists helena_v2.conta_papel (
  conta text not null,
  papel text not null,
  primary key (conta, papel)
);
