-- Instalação da v2 (migrations 0001 a 0019), numa transação só.
-- ATENÇÃO: NÃO aplique sem a frase exata do fundador (LEIA-ANTES.md). Gerado por `python -m orquestrador gerar-instalacao`.
-- ===== 0001_esquema.sql =====
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

-- ===== 0002_passagens_geradas.sql =====
-- ARQUIVO GERADO. NÃO EDITE À MÃO.
-- O que é: as passagens da máquina do card, da etapa e da ação externa, com tetos, guardas, efeitos,
--          ligações, automáticos e a impressão digital da tabela que passou na prova.
-- De onde vem: helena-v2/maquina/passagens.yaml + vocabulario.yaml, pelo script gerar_passagens.py.
-- Como mudar: edite o YAML, rode a prova (python helena-v2/maquina/provar.py) e depois
--             `python supabase/migrations-v2/gerar_passagens.py`. O teste test_02_gerador.py falha se este
--             arquivo guardado for diferente do que o gerador produz hoje.
-- Impressão digital da tabela (provar.impressao_digital): 4d307f25747d5381
select set_config('helena_v2.migrando', 'sim', false);

-- Tabelas de regras (preenchidas abaixo, só por este arquivo).
create table if not exists helena_v2.teto (
  nome text primary key,
  valor integer not null check (valor >= 1),
  por_que text not null
);
create table if not exists helena_v2.variavel (
  maquina text not null,
  nome text not null,
  ordem integer not null,
  tipo text not null check (tipo in ('inteiro', 'texto')),
  teto integer,
  dominio text[],
  inicial jsonb not null,
  compartilhada boolean not null default false,
  primary key (maquina, nome)
);
create table if not exists helena_v2.config_nome (
  maquina text not null,
  nome text not null,
  primary key (maquina, nome)
);
create table if not exists helena_v2.estado_def (
  maquina text not null,
  estado text not null,
  ordem integer not null,
  final boolean not null,
  inicial boolean not null,
  dono text,
  prazo text,
  nota text,
  primary key (maquina, estado)
);
create table if not exists helena_v2.prazo_def (
  nome text primary key,
  quanto text not null,
  papel text not null,
  evento text not null,
  tratado_em text,
  avisos text[] not null,
  origem text not null check (origem in ('card', 'duracao', 'ficha', 'espera')),
  campo_da_ficha text,
  segundos integer
);
create table if not exists helena_v2.macro (
  nome text primary key,
  efeitos jsonb not null
);
create table if not exists helena_v2.passagem (
  maquina text not null,
  linha_id text not null,
  base_id text not null,
  ordem integer not null,
  de text not null,
  evento text not null,
  papel text not null,
  guarda text,
  para text not null,
  efeitos jsonb not null,
  checa_param jsonb not null,
  sinais text[] not null,
  sobe_versao boolean not null,
  nota text,
  primary key (maquina, linha_id)
);
create index if not exists passagem_busca on helena_v2.passagem (maquina, de, evento, papel);
create table if not exists helena_v2.ligacao (
  nome text primary key,
  papel text,
  evento text,
  alvos text[] not null,
  no_card text,
  nota text
);
create table if not exists helena_v2.automatico (
  maquina text not null,
  ordem integer not null,
  evento text not null,
  primary key (maquina, ordem)
);
create table if not exists helena_v2.reacao (
  ordem integer primary key,
  papel text not null,
  evento text not null,
  maquina text not null,
  estados_tipo text not null check (estados_tipo in ('TODOS', 'ABERTOS', 'LISTA')),
  estados text[] not null,
  guarda_id text,
  guarda text,
  muda_campo text,
  abre_card_ligado boolean not null,
  efeito_fora text
);
create table if not exists helena_v2.regra_geral (
  chave text primary key,
  valor jsonb not null
);
create table if not exists helena_v2.vocab_evento (
  papel text not null,
  evento text not null,
  parametros jsonb not null,
  efeito text not null,
  desligado text,
  muda_campo text,
  primary key (papel, evento)
);
create table if not exists helena_v2.predicado_lista (
  nome text not null,
  situacao text not null,
  primary key (nome, situacao)
);
create table if not exists helena_v2.entrada (
  maquina text not null,
  evento text not null,
  primary key (maquina, evento)
);
create table if not exists helena_v2.identidade (
  nome text primary key,
  tipo text not null check (tipo in ('agente', 'fundador')),
  ordem integer not null
);
create table if not exists helena_v2.meta_tabela (
  id boolean primary key default true check (id),
  versao text not null,
  impressao_digital text not null,
  hash_das_linhas text,
  gerado_de text not null
);

-- Limpa as tabelas de regras e grava de novo (este arquivo pode ser aplicado outra vez).
delete from helena_v2.passagem;
delete from helena_v2.ligacao;
delete from helena_v2.automatico;
delete from helena_v2.reacao;
delete from helena_v2.regra_geral;
delete from helena_v2.vocab_evento;
delete from helena_v2.predicado_lista;
delete from helena_v2.entrada;
delete from helena_v2.identidade;
delete from helena_v2.estado_def;
delete from helena_v2.prazo_def;
delete from helena_v2.macro;
delete from helena_v2.variavel;
delete from helena_v2.config_nome;
delete from helena_v2.teto;
delete from helena_v2.meta_tabela;

insert into helena_v2.teto (nome, valor, por_que) values
  ('TETO_EXECUCOES', 6, 'Regra 5 e ''Teto geral'': cada etapa roda no máximo 6 vezes, somando autor e revisor, por qualquer motivo. As suas ordens abrem rodada nova e não gastam esse limite.'),
  ('TETO_FORMATO', 1, 'Formato errado ganha UMA nova tentativa só de formato; na segunda, em resolução (K-13, A-17).'),
  ('TETO_TEMPO', 1, 'Tempo esgotado: mais uma tentativa com 50% mais tempo; na segunda, em resolução (divisão no meio desligada, MEL-24).'),
  ('TETO_CHAMADAS', 1, 'Limite de chamadas: mais chamadas uma vez; na segunda, em resolução.'),
  ('TETO_REPROVACOES', 2, 'Duas voltas ao autor por reprovação; a reprovação seguinte vai para em resolução. Cabe exatamente no teto de 6.'),
  ('TETO_INFRA', 3, 'Regra 12: falha de provedor/servidor não gasta tentativa, mas na 3ª da mesma rodada a etapa para e chama você (plano: ''3ª queda da mesma etapa'').'),
  ('TETO_AVISO_ESPERA', 1, 'Esperando capacidade: um aviso em 1 hora; em 6 horas você escolhe.'),
  ('TETO_REPLANEJAMENTO', 1, 'Em resolução, ''refazer'' vale uma vez por etapa (plano: a etapa é replanejada uma vez).'),
  ('TETO_ORDENS', 3, 'Suas ordens que reabrem trabalho no mesmo card (pedir ajuste, refazer, esperar, modelo menor, decisão nova, confirmar de novo depois de o validador do plano falhar). Não gastam o teto de 6, mas têm teto próprio para o card terminar e a prova acabar (MEL-23). Na 4ª, a ordem é LINHA, não comentário: este card é substituído por um card novo ligado, com as entregas deste e o seu pedido (E96, E97, E98, E117, C17, C29, C33): você nunca perde o poder de pedir e o card nunca fecha com a peça que você marcou como errada. PROPOSTA: depende do seu sim.'),
  ('TETO_PERGUNTAS', 2, 'Limite de perguntas do card (plano l. 84 e 302). Número proposto, a calibrar na fase 3.'),
  ('TETO_LEMBRETES', 2, 'Espera interna por você: lembrete em 24h e 48h; depois, o padrão (que nunca aprova).'),
  ('TETO_VOLTAS_JURIDICO', 2, 'A etapa jurídica manda a peça julgada de volta no máximo 2 vezes; depois, em resolução (MEL-23 pede um teto só: 2, como no plano).'),
  ('TETO_NIVEL_PRAZO', 3, 'Três níveis de prazo do card, cada um dispara uma vez: 80%, vencido, mais 1 hora.'),
  ('TETO_FALHAS_HELENA', 2, 'Se a leitura de volta da Helena falhar duas vezes, o card vai para você sem ela.'),
  ('TETO_EXECUCOES_ACAO', 1, 'Regra 8: uma ação externa é executada no máximo uma vez, só pelo motor.'),
  ('TETO_MUDANCAS_PRAZO', 3, 'Cada mudança de prazo sua rearma os 3 avisos do prazo novo. O teto deixa a prova terminar; na 4ª, o campo muda e os avisos ficam como estão (reação). PROPOSTA: depende do seu sim.'),
  ('TETO_VALIDACAO_PLANO', 2, 'O validador do plano é código nosso e roda na hora: se não responder em 60 s, roda de novo uma vez; na 2ª, o card espera você com o motivo VALIDADOR_FALHOU.');

insert into helena_v2.variavel (maquina, nome, ordem, tipo, teto, dominio, inicial, compartilhada) values
  ('card', 'motivo', 1, 'texto', null, array['NENHUM', 'HELENA_FALHOU', 'PLANO_INVALIDO', 'VALIDADOR_FALHOU', 'DEPENDENCIA', 'NAO_PODE']::text[], '"NENHUM"'::jsonb, false),
  ('card', 'ordens', 2, 'inteiro', 3, null, '0'::jsonb, true),
  ('card', 'perguntas', 3, 'inteiro', 2, null, '0'::jsonb, true),
  ('card', 'voltas', 4, 'inteiro', 2, null, '0'::jsonb, true),
  ('card', 'nivel_prazo', 5, 'inteiro', 3, null, '0'::jsonb, false),
  ('card', 'lembretes', 6, 'inteiro', 2, null, '0'::jsonb, false),
  ('card', 'falhas_helena', 7, 'inteiro', 2, null, '0'::jsonb, false),
  ('card', 'validacoes', 8, 'inteiro', 2, null, '0'::jsonb, false),
  ('card', 'mudancas_prazo', 9, 'inteiro', 3, null, '0'::jsonb, false),
  ('card', 'fim', 10, 'texto', null, array['NENHUM', 'PAI', 'PADRAO', 'PULADA', 'ENCERRAR_CARD', 'CARD_PRONTO', 'FUNDADOR', 'SUBSTITUIDO', 'FALHA']::text[], '"NENHUM"'::jsonb, false),
  ('etapa', 'motivo', 1, 'texto', null, array['NENHUM', 'NORMAL', 'CAPACIDADE', 'PERGUNTA', 'REVISAO', 'RESOLUCAO', 'INFRA']::text[], '"NENHUM"'::jsonb, false),
  ('etapa', 'espera', 2, 'texto', null, array['NENHUMA', 'INTERNA', 'EXTERNA']::text[], '"NENHUMA"'::jsonb, false),
  ('etapa', 'execucoes', 3, 'inteiro', 6, null, '0'::jsonb, false),
  ('etapa', 'formato', 4, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'tempo', 5, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'chamadas', 6, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'reprovacoes', 7, 'inteiro', 2, null, '0'::jsonb, false),
  ('etapa', 'infra', 8, 'inteiro', 3, null, '0'::jsonb, false),
  ('etapa', 'aviso', 9, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'replan', 10, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'ordens', 11, 'inteiro', 3, null, '0'::jsonb, true),
  ('etapa', 'perguntas', 12, 'inteiro', 2, null, '0'::jsonb, true),
  ('etapa', 'voltas', 13, 'inteiro', 2, null, '0'::jsonb, true),
  ('etapa', 'lembretes', 14, 'inteiro', 2, null, '0'::jsonb, false),
  ('etapa', 'exec_viva', 15, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'leu_internet', 16, 'inteiro', 1, null, '0'::jsonb, false),
  ('etapa', 'revisor', 17, 'texto', null, array['NENHUM', 'HELENA', 'LAURA', 'AUGUSTO', 'MARINA', 'CAIO', 'CLARA', 'BIANCA', 'DANIEL', 'THEO', 'NINA', 'RAVI', 'MAYA', 'BRUNO', 'OLIVIA', 'VICTOR', 'CAMILA', 'ISABELA', 'PEDRO', 'RENATA', 'JOANA', 'FELIPE', 'FUNDADOR']::text[], '"NENHUM"'::jsonb, false),
  ('etapa', 'semaforo', 18, 'texto', null, array['NENHUM', 'OK', 'AJUSTE', 'NAO_PODE']::text[], '"NENHUM"'::jsonb, false),
  ('etapa', 'fim', 19, 'texto', null, array['NENHUM', 'PAI', 'PADRAO', 'PULADA', 'ENCERRAR_CARD', 'CARD_PRONTO', 'FUNDADOR', 'SUBSTITUIDO', 'FALHA']::text[], '"NENHUM"'::jsonb, false),
  ('acao_externa', 'ok_registrado', 1, 'inteiro', 1, null, '0'::jsonb, false),
  ('acao_externa', 'tentativas', 2, 'inteiro', 1, null, '0'::jsonb, false),
  ('acao_externa', 'lembretes', 3, 'inteiro', 2, null, '0'::jsonb, false),
  ('acao_externa', 'fim', 4, 'texto', null, array['NENHUM', 'PAI', 'PADRAO', 'FUNDADOR', 'FALHA']::text[], '"NENHUM"'::jsonb, false);

insert into helena_v2.config_nome (maquina, nome) values
  ('card', 'pedido_grande'),
  ('etapa', 'tem_internet'),
  ('etapa', 'julgadora'),
  ('etapa', 'julgada'),
  ('etapa', 'pulavel'),
  ('etapa', 'permite_perguntar'),
  ('etapa', 'permite_devolver'),
  ('etapa', 'usa_decisao'),
  ('etapa', 'prazo_de_terceiro'),
  ('acao_externa', 'tem_ferramenta');

insert into helena_v2.estado_def (maquina, estado, ordem, final, inicial, dono, prazo, nota) values
  ('card', 'RASCUNHO', 1, false, true, 'HELENA', 'leitura_de_volta', null),
  ('card', 'ESPERANDO_CONFIRMACAO', 2, false, false, 'FUNDADOR', 'espera_do_fundador', null),
  ('card', 'VALIDANDO_PLANO', 3, false, false, 'MOTOR', 'na_hora', null),
  ('card', 'EM_ANDAMENTO', 4, false, false, 'HELENA', 'prazo_do_card', null),
  ('card', 'ESPERANDO_FUNDADOR', 5, false, false, 'FUNDADOR', 'espera_do_fundador', null),
  ('card', 'PRONTO', 6, true, false, null, null, null),
  ('card', 'CANCELADO', 7, true, false, null, null, null),
  ('card', 'ENCERRADO_COM_FALHA', 8, true, false, null, null, null),
  ('etapa', 'AGUARDANDO_ANTERIORES', 1, false, true, 'HELENA', 'prazo_do_card', null),
  ('etapa', 'NA_FILA', 2, false, false, 'AUTOR', 'prazo_do_card', 'Fila por prioridade (só você muda). O atraso aparece nos avisos do prazo do card.'),
  ('etapa', 'EXECUTANDO', 3, false, false, 'AUTOR', 'tempo_maximo_da_ficha', null),
  ('etapa', 'VALIDACAO', 4, false, false, 'MOTOR', 'na_hora', null),
  ('etapa', 'REVISAO', 5, false, false, 'REVISOR', 'prazo_da_revisao', null),
  ('etapa', 'ESPERANDO_FUNDADOR', 6, false, false, 'FUNDADOR', 'espera_do_fundador', null),
  ('etapa', 'EM_RESOLUCAO', 7, false, false, 'HELENA', 'recomendacao_da_helena', null),
  ('etapa', 'APROVADA', 8, false, false, 'HELENA', 'prazo_do_card', 'Aprovada, esperando o card fechar; pode ser reaberta pela regra 10 enquanto o card estiver aberto.'),
  ('etapa', 'PRONTA', 9, true, false, null, null, null),
  ('etapa', 'CANCELADA', 10, true, false, null, null, null),
  ('etapa', 'ENCERRADA_COM_FALHA', 11, true, false, null, null, null),
  ('acao_externa', 'PROPOSTA', 1, false, true, 'FUNDADOR', 'espera_do_fundador', null),
  ('acao_externa', 'AUTORIZADA', 2, false, false, 'MOTOR', 'na_hora', null),
  ('acao_externa', 'EXECUTANDO_ACAO', 3, false, false, 'MOTOR', 'execucao_da_acao', null),
  ('acao_externa', 'INCERTA', 4, false, false, 'FUNDADOR', 'espera_do_fundador', null),
  ('acao_externa', 'EXECUTADA', 5, true, false, null, null, null),
  ('acao_externa', 'FEITA_PELO_FUNDADOR', 6, true, false, null, null, null),
  ('acao_externa', 'RECUSADA', 7, true, false, null, null, null),
  ('acao_externa', 'EXPIRADA', 8, true, false, null, null, null),
  ('acao_externa', 'FALHOU', 9, true, false, null, null, null),
  ('acao_externa', 'NAO_CONFIRMADA', 10, true, false, null, null, 'Pode ter acontecido: nunca é refeita por este card.'),
  ('acao_externa', 'CANCELADA', 11, true, false, null, null, null);

insert into helena_v2.prazo_def (nome, quanto, papel, evento, tratado_em, avisos, origem, campo_da_ficha, segundos) values
  ('leitura_de_volta', '15 min', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'duracao', null, 900),
  ('espera_do_fundador', 'interna: lembrete em 24h e 48h e depois o padrão; externa: o padrão no prazo da pergunta', 'RELOGIO', 'PRAZO_ESPERA_VENCIDO', null, '{}'::text[], 'espera', null, null),
  ('na_hora', 'até 60 s; sem resposta, o relógio dispara TEMPO_ESGOTADO', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'duracao', null, 60),
  ('prazo_do_card', 'o do card (só você muda; cada mudança rearma os avisos)', 'RELOGIO', 'PRAZO_VENCIDO', 'card', array['PRAZO_80', 'PRAZO_MAIS_1H']::text[], 'card', null, null),
  ('tempo_maximo_da_ficha', 'o da ficha (ex.: Clara 15 min)', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'ficha', 'tempo_maximo_s', null),
  ('prazo_da_revisao', 'o da ficha do revisor', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'ficha', 'prazo_revisao_s', null),
  ('recomendacao_da_helena', '30 min; depois vira cartão para você sem recomendação', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'duracao', null, 1800),
  ('execucao_da_acao', '15 min; sem confirmação, vira conferência sua (nunca repete)', 'RELOGIO', 'TEMPO_ESGOTADO', null, '{}'::text[], 'duracao', null, 900);

insert into helena_v2.macro (nome, efeitos) values
  ('ZERAR_TENTATIVAS', '{"aviso":0,"chamadas":0,"execucoes":0,"formato":0,"infra":0,"reprovacoes":0,"tempo":0}'::jsonb),
  ('NOVA_RODADA', '{"aviso":0,"chamadas":0,"espera":"NENHUMA","exec_viva":0,"execucoes":0,"formato":0,"infra":0,"lembretes":0,"leu_internet":0,"motivo":"NORMAL","reprovacoes":0,"revisor":"NENHUM","semaforo":"NENHUM","tempo":0}'::jsonb),
  ('LIMPAR_ENTREGA', '{"revisor":"NENHUM","semaforo":"NENHUM"}'::jsonb);

insert into helena_v2.passagem (maquina, linha_id, base_id, ordem, de, evento, papel, guarda, para, efeitos, checa_param, sinais, sobe_versao, nota) values
  ('card', 'C01', 'C01', 1, 'RASCUNHO', 'LER_DE_VOLTA', 'HELENA', 'pedido_grande', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"lembretes","val":0},{"op":"set","v":"falhas_helena","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Pedido grande: ''Entendi assim: objetivo, prazo e como é o pronto. Confirma?'''),
  ('card', 'C02', 'C02', 2, 'RASCUNHO', 'LER_DE_VOLTA', 'HELENA', 'not pedido_grande', 'VALIDANDO_PLANO', '[{"op":"set","v":"falhas_helena","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Pedido pequeno vale na hora, com botão de desfazer (Cancelar).'),
  ('card', 'C03', 'C03', 3, 'RASCUNHO', 'FALHA', 'MOTOR', 'falhas_helena < TETO_FALHAS_HELENA - 1', 'RASCUNHO', '[{"n":1,"op":"add","v":"falhas_helena"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C04', 'C04', 4, 'RASCUNHO', 'FALHA', 'MOTOR', 'falhas_helena >= TETO_FALHAS_HELENA - 1', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"falhas_helena","val":0},{"op":"set","v":"motivo","val":"HELENA_FALHOU"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Na 2ª falha da Helena o rascunho vai para você sem a leitura de volta.'),
  ('card', 'C05', 'C05', 5, 'RASCUNHO', 'TEMPO_ESGOTADO', 'RELOGIO', null, 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"motivo","val":"HELENA_FALHOU"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"falhas_helena","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('card', 'C06', 'C06', 6, 'ESPERANDO_CONFIRMACAO', 'RESPONDER', 'FUNDADOR', 'opcao == ''CONFIRMO'' and motivo in (''NENHUM'', ''HELENA_FALHOU'')', 'VALIDANDO_PLANO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C07@ESPERANDO_CONFIRMACAO', 'C07', 7, 'ESPERANDO_CONFIRMACAO', 'LEMBRETE_24H', 'RELOGIO', 'lembretes == 0', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"lembretes","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C07@ESPERANDO_FUNDADOR', 'C07', 8, 'ESPERANDO_FUNDADOR', 'LEMBRETE_24H', 'RELOGIO', 'lembretes == 0', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"lembretes","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C08@ESPERANDO_CONFIRMACAO', 'C08', 9, 'ESPERANDO_CONFIRMACAO', 'LEMBRETE_48H', 'RELOGIO', 'lembretes == 1', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"lembretes","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C08@ESPERANDO_FUNDADOR', 'C08', 10, 'ESPERANDO_FUNDADOR', 'LEMBRETE_48H', 'RELOGIO', 'lembretes == 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"lembretes","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C09@ESPERANDO_CONFIRMACAO', 'C09', 11, 'ESPERANDO_CONFIRMACAO', 'PRAZO_ESPERA_VENCIDO', 'RELOGIO', 'lembretes >= TETO_LEMBRETES', 'CANCELADO', '[{"op":"set","v":"fim","val":"PADRAO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Padrão registrado como padrão, nunca como decisão sua; nunca aprova.'),
  ('card', 'C09@ESPERANDO_FUNDADOR', 'C09', 12, 'ESPERANDO_FUNDADOR', 'PRAZO_ESPERA_VENCIDO', 'RELOGIO', 'lembretes >= TETO_LEMBRETES', 'CANCELADO', '[{"op":"set","v":"fim","val":"PADRAO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Padrão registrado como padrão, nunca como decisão sua; nunca aprova.'),
  ('card', 'C10', 'C10', 13, 'VALIDANDO_PLANO', 'PLANO_VALIDO', 'MOTOR', null, 'EM_ANDAMENTO', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C11', 'C11', 14, 'VALIDANDO_PLANO', 'PLANO_INVALIDO', 'MOTOR', null, 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"motivo","val":"PLANO_INVALIDO"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Plano que não passa na conferência: o card espera você com o motivo; só cancelar (ou o padrão). Nenhuma etapa anda: a trava é regras_gerais.etapa_so_anda_com_card_ativo.'),
  ('card', 'C30', 'C30', 15, 'VALIDANDO_PLANO', 'TEMPO_ESGOTADO', 'RELOGIO', 'validacoes < TETO_VALIDACAO_PLANO - 1', 'VALIDANDO_PLANO', '[{"n":1,"op":"add","v":"validacoes"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O validador do plano (código nosso) não respondeu em 60 s: roda de novo, uma vez.'),
  ('card', 'C31', 'C31', 16, 'VALIDANDO_PLANO', 'TEMPO_ESGOTADO', 'RELOGIO', 'validacoes >= TETO_VALIDACAO_PLANO - 1', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"validacoes","val":2},{"op":"set","v":"motivo","val":"VALIDADOR_FALHOU"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Nenhuma etapa andou. Você escolhe confirmar de novo (é uma ordem sua) ou cancelar.'),
  ('card', 'C32', 'C32', 17, 'ESPERANDO_CONFIRMACAO', 'RESPONDER', 'FUNDADOR', 'opcao == ''CONFIRMO'' and motivo == ''VALIDADOR_FALHOU'' and ordens < TETO_ORDENS', 'VALIDANDO_PLANO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"validacoes","val":0},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('card', 'C33', 'C33', 18, 'ESPERANDO_CONFIRMACAO', 'RESPONDER', 'FUNDADOR', 'opcao == ''CONFIRMO'' and motivo == ''VALIDADOR_FALHOU'' and ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Acima do teto de ordens: card novo ligado, com o mesmo pedido.'),
  ('card', 'C12', 'C12', 19, 'EM_ANDAMENTO', 'TODAS_PRONTAS', 'MOTOR', 'todas_prontas', 'PRONTO', '[{"op":"set","v":"fim","val":"CARD_PRONTO"}]'::jsonb, '{}'::jsonb, array['CARD_PRONTO']::text[], false, null),
  ('card', 'C13', 'C13', 20, 'EM_ANDAMENTO', 'PERGUNTAR_AO_FUNDADOR', 'MOTOR', 'falha_sem_decisao', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"DEPENDENCIA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Regra 6: etapa cancelada ou com falha para quem depende dela e o card pergunta: pular, refazer ou encerrar/cancelar.'),
  ('card', 'C14', 'C14', 21, 'EM_ANDAMENTO', 'PERGUNTAR_AO_FUNDADOR', 'MOTOR', 'nao_pode_sem_decisao and not falha_sem_decisao', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"NAO_PODE"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('card', 'C27', 'C27', 22, 'ESPERANDO_FUNDADOR', 'MOTIVO_RESOLVIDO', 'MOTOR', '(motivo == ''NAO_PODE'' and not nao_pode_sem_decisao) or (motivo == ''DEPENDENCIA'' and not falha_sem_decisao)', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'A pergunta perdeu o objeto (a etapa que a causou foi reaberta ou refeita): o card volta a andar sozinho, sem gastar ordem sua, e o app avisa que a pergunta foi retirada. Sem esta linha, um card com tudo aprovado ficaria preso e o padrão o cancelaria.'),
  ('card', 'C15@EM_ANDAMENTO', 'C15', 23, 'EM_ANDAMENTO', 'ENCERRAR_CARD', 'MOTOR', null, 'ENCERRADO_COM_FALHA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Entrada só por sinal, e o único emissor é a E87 (o seu Encerrar numa etapa): por isso o fim fica registrado como seu.'),
  ('card', 'C15@ESPERANDO_FUNDADOR', 'C15', 24, 'ESPERANDO_FUNDADOR', 'ENCERRAR_CARD', 'MOTOR', null, 'ENCERRADO_COM_FALHA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Entrada só por sinal, e o único emissor é a E87 (o seu Encerrar numa etapa): por isso o fim fica registrado como seu.'),
  ('card', 'C28@EM_ANDAMENTO', 'C28', 25, 'EM_ANDAMENTO', 'SUBSTITUIR_CARD', 'MOTOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Entrada só por sinal de uma ordem sua acima do teto numa etapa (E96, E97, E98, E117): card novo ligado, com as entregas e o seu pedido.'),
  ('card', 'C28@ESPERANDO_FUNDADOR', 'C28', 26, 'ESPERANDO_FUNDADOR', 'SUBSTITUIR_CARD', 'MOTOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Entrada só por sinal de uma ordem sua acima do teto numa etapa (E96, E97, E98, E117): card novo ligado, com as entregas e o seu pedido.'),
  ('card', 'C34@EM_ANDAMENTO', 'C34', 27, 'EM_ANDAMENTO', 'PEDIR_AJUSTE', 'FUNDADOR', null, 'EM_ANDAMENTO', '[]'::jsonb, '{}'::jsonb, array['DECISAO_DO_FUNDADOR']::text[], false, 'Seu ajuste global no card aberto, com motivo e versão vista, emite o sinal que chega ao card como DECISAO_MUDOU. C16/C17 contam a ordem e a propagam às etapas. No card fechado, Pedir ajuste continua abrindo card ligado.'),
  ('card', 'C34@ESPERANDO_FUNDADOR', 'C34', 28, 'ESPERANDO_FUNDADOR', 'PEDIR_AJUSTE', 'FUNDADOR', null, 'ESPERANDO_FUNDADOR', '[]'::jsonb, '{}'::jsonb, array['DECISAO_DO_FUNDADOR']::text[], false, 'Seu ajuste global no card aberto, com motivo e versão vista, emite o sinal que chega ao card como DECISAO_MUDOU. C16/C17 contam a ordem e a propagam às etapas. No card fechado, Pedir ajuste continua abrindo card ligado.'),
  ('card', 'C16@EM_ANDAMENTO', 'C16', 29, 'EM_ANDAMENTO', 'DECISAO_MUDOU', 'MOTOR', 'ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['DECISAO_MUDOU']::text[], false, 'Regra 10: o que usava a decisão é refeito.'),
  ('card', 'C16@ESPERANDO_FUNDADOR', 'C16', 30, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'ordens < TETO_ORDENS', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['DECISAO_MUDOU']::text[], false, 'Regra 10: o que usava a decisão é refeito.'),
  ('card', 'C17@EM_ANDAMENTO', 'C17', 31, 'EM_ANDAMENTO', 'DECISAO_MUDOU', 'MOTOR', 'ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Acima do teto de ordens, o card não pode terminar com informação velha: é substituído por um card novo ligado, com as entregas e a decisão nova.'),
  ('card', 'C17@ESPERANDO_FUNDADOR', 'C17', 32, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Acima do teto de ordens, o card não pode terminar com informação velha: é substituído por um card novo ligado, com as entregas e a decisão nova.'),
  ('card', 'C18', 'C18', 33, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''DEPENDENCIA'' and opcao == ''PULAR'' and falhas_pulaveis', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, array['PULAR_FALHAS']::text[], false, null),
  ('card', 'C19', 'C19', 34, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''DEPENDENCIA'' and opcao == ''REFAZER'' and ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['REFAZER_FALHAS']::text[], false, null),
  ('card', 'C20', 'C20', 35, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''NAO_PODE'' and opcao == ''REFAZER'' and ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['REABRIR_JULGADAS']::text[], false, null),
  ('card', 'C29', 'C29', 36, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo in (''DEPENDENCIA'', ''NAO_PODE'') and opcao == ''REFAZER'' and ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Refazer acima do teto de ordens: card novo ligado, com as entregas deste (nunca vira comentário).'),
  ('card', 'C21', 'C21', 37, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'opcao == ''ENCERRAR''', 'ENCERRADO_COM_FALHA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, null),
  ('card', 'C22@RASCUNHO', 'C22', 38, 'RASCUNHO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@ESPERANDO_CONFIRMACAO', 'C22', 39, 'ESPERANDO_CONFIRMACAO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@VALIDANDO_PLANO', 'C22', 40, 'VALIDANDO_PLANO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@EM_ANDAMENTO', 'C22', 41, 'EM_ANDAMENTO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@ESPERANDO_FUNDADOR', 'C22', 42, 'ESPERANDO_FUNDADOR', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C23@RASCUNHO', 'C23', 43, 'RASCUNHO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@ESPERANDO_CONFIRMACAO', 'C23', 44, 'ESPERANDO_CONFIRMACAO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@VALIDANDO_PLANO', 'C23', 45, 'VALIDANDO_PLANO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@EM_ANDAMENTO', 'C23', 46, 'EM_ANDAMENTO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@ESPERANDO_FUNDADOR', 'C23', 47, 'ESPERANDO_FUNDADOR', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C24@RASCUNHO', 'C24', 48, 'RASCUNHO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@ESPERANDO_CONFIRMACAO', 'C24', 49, 'ESPERANDO_CONFIRMACAO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@VALIDANDO_PLANO', 'C24', 50, 'VALIDANDO_PLANO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@EM_ANDAMENTO', 'C24', 51, 'EM_ANDAMENTO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@ESPERANDO_FUNDADOR', 'C24', 52, 'ESPERANDO_FUNDADOR', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C25@RASCUNHO', 'C25', 53, 'RASCUNHO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@ESPERANDO_CONFIRMACAO', 'C25', 54, 'ESPERANDO_CONFIRMACAO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@VALIDANDO_PLANO', 'C25', 55, 'VALIDANDO_PLANO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@EM_ANDAMENTO', 'C25', 56, 'EM_ANDAMENTO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@ESPERANDO_FUNDADOR', 'C25', 57, 'ESPERANDO_FUNDADOR', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C26@RASCUNHO', 'C26', 58, 'RASCUNHO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@ESPERANDO_CONFIRMACAO', 'C26', 59, 'ESPERANDO_CONFIRMACAO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@VALIDANDO_PLANO', 'C26', 60, 'VALIDANDO_PLANO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@EM_ANDAMENTO', 'C26', 61, 'EM_ANDAMENTO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@ESPERANDO_FUNDADOR', 'C26', 62, 'ESPERANDO_FUNDADOR', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('etapa', 'E01', 'E01', 1, 'AGUARDANDO_ANTERIORES', 'DEPENDENCIAS_PRONTAS', 'MOTOR', 'anteriores_satisfeitas', 'NA_FILA', '[{"op":"set","v":"motivo","val":"NORMAL"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'anteriores_satisfeitas é calculada pelo banco na mesma transação: toda anterior aprovada ou pulada (predicados.satisfaz_dependencia).'),
  ('etapa', 'E02', 'E02', 2, 'AGUARDANDO_ANTERIORES', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E03', 'E03', 3, 'AGUARDANDO_ANTERIORES', 'DECISAO_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E04', 'E04', 4, 'AGUARDANDO_ANTERIORES', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E10', 'E10', 5, 'NA_FILA', 'INICIAR_EXECUCAO', 'MOTOR', 'motivo == ''NORMAL'' and execucoes < TETO_EXECUCOES', 'EXECUTANDO', '[{"op":"set","v":"exec_viva","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Uma única entrada na fila: agente, prioridade e versão; número de execução novo (regras_gerais.numero_de_execucao).'),
  ('etapa', 'E11', 'E11', 6, 'NA_FILA', 'TETO_EXECUCOES', 'MOTOR', 'execucoes >= TETO_EXECUCOES', 'EM_RESOLUCAO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"aviso","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E12', 'E12', 7, 'NA_FILA', 'SEM_CAPACIDADE', 'MOTOR', 'motivo == ''NORMAL'' and infra < TETO_INFRA - 1', 'NA_FILA', '[{"op":"set","v":"motivo","val":"CAPACIDADE"},{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E13', 'E13', 8, 'NA_FILA', 'SEM_CAPACIDADE', 'MOTOR', 'motivo == ''NORMAL'' and infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"infra","val":3},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E14', 'E14', 9, 'NA_FILA', 'CAPACIDADE_VOLTOU', 'MOTOR', 'motivo == ''CAPACIDADE''', 'NA_FILA', '[{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"aviso","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E15', 'E15', 10, 'NA_FILA', 'AVISO_1H', 'RELOGIO', 'motivo == ''CAPACIDADE'' and aviso < TETO_AVISO_ESPERA', 'NA_FILA', '[{"n":1,"op":"add","v":"aviso"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E16', 'E16', 11, 'NA_FILA', 'ESPERA_6H', 'RELOGIO', 'motivo == ''CAPACIDADE'' and aviso >= TETO_AVISO_ESPERA', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E17', 'E17', 12, 'NA_FILA', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"aviso","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E18', 'E18', 13, 'NA_FILA', 'DECISAO_MUDOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E19', 'E19', 14, 'NA_FILA', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E20', 'E20', 15, 'EXECUTANDO', 'ENTREGAR', 'AUTOR', 'parecer == ''OK'' or julgadora', 'VALIDACAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"param","p":"parecer","v":"semaforo"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{"parecer":["AJUSTE","NAO_PODE","NENHUM","OK"]}'::jsonb, '{}'::text[], true, 'A ação externa proposta é um campo desta entrega (dado, não estado): só vira proposta na sua lista quando o card fica pronto (E110), e só a da entrega que passou pelos portões.'),
  ('etapa', 'E21', 'E21', 16, 'EXECUTANDO', 'PERGUNTAR', 'AUTOR', '(leu_internet == 0 or not tem_internet) and usou_internet == ''NAO'' and permite_perguntar and perguntas < TETO_PERGUNTAS and not prazo_de_terceiro', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"perguntas"},{"op":"set","v":"motivo","val":"PERGUNTA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Quem leu a internet (nesta execução, pelo registro de uso, ou na anterior de que esta é continuação de formato) só entrega ou registra falha.'),
  ('etapa', 'E120', 'E120', 17, 'EXECUTANDO', 'PERGUNTAR', 'AUTOR', '(leu_internet == 0 or not tem_internet) and usou_internet == ''NAO'' and permite_perguntar and perguntas < TETO_PERGUNTAS and prazo_de_terceiro', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"perguntas"},{"op":"set","v":"motivo","val":"PERGUNTA"},{"op":"set","v":"espera","val":"EXTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Espera externa só quando o roteiro declara prazo de terceiro na etapa; o agente nunca escolhe o tipo.'),
  ('etapa', 'E22', 'E22', 18, 'EXECUTANDO', 'DEVOLVER_A_QUEM_PEDIU', 'AUTOR', '(leu_internet == 0 or not tem_internet) and usou_internet == ''NAO'' and permite_devolver', 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Sem sub-card, quem pediu é o card: vira cartão de resolução para você.'),
  ('etapa', 'E23', 'E23', 19, 'EXECUTANDO', 'REGISTRAR_FALHA', 'AUTOR', null, 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E24', 'E24', 20, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe == ''FORMATO_ERRADO'' and formato < TETO_FORMATO and tem_internet', 'NA_FILA', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"formato"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Nova tentativa só de formato, sobre o mesmo texto: numa etapa com internet a restrição continua valendo (MEL-27 d), porque a execução que falhou pode ter lido a internet.'),
  ('etapa', 'E121', 'E121', 21, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe == ''FORMATO_ERRADO'' and formato < TETO_FORMATO and not tem_internet', 'NA_FILA', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"formato"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Etapa sem internet (servidor de ferramentas vazio): a nova tentativa de formato não herda restrição.'),
  ('etapa', 'E25', 'E25', 22, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe == ''FORMATO_ERRADO'' and formato >= TETO_FORMATO', 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E26', 'E26', 23, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe == ''LIMITE_CHAMADAS'' and chamadas < TETO_CHAMADAS', 'NA_FILA', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"chamadas"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E27', 'E27', 24, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe == ''LIMITE_CHAMADAS'' and chamadas >= TETO_CHAMADAS', 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E28', 'E28', 25, 'EXECUTANDO', 'FALHA', 'MOTOR', 'classe in (''GRANDE_DEMAIS'', ''SITE'', ''DESCONHECIDA'')', 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E29', 'E29', 26, 'EXECUTANDO', 'TEMPO_ESGOTADO', 'RELOGIO', 'tempo < TETO_TEMPO', 'NA_FILA', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"tempo"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E30', 'E30', 27, 'EXECUTANDO', 'TEMPO_ESGOTADO', 'RELOGIO', 'tempo >= TETO_TEMPO', 'EM_RESOLUCAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E31', 'E31', 28, 'EXECUTANDO', 'FALHA_INFRA', 'MOTOR', 'classe in (''PROVEDOR'', ''QUEDA'', ''FERRAMENTA'') and infra < TETO_INFRA - 1', 'NA_FILA', '[{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"infra"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Regra 12: não gasta tentativa.'),
  ('etapa', 'E32', 'E32', 29, 'EXECUTANDO', 'FALHA_INFRA', 'MOTOR', 'classe in (''COTA'', ''LOGIN'', ''BANCO'') and infra < TETO_INFRA - 1', 'NA_FILA', '[{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"infra"},{"op":"set","v":"motivo","val":"CAPACIDADE"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E33', 'E33', 30, 'EXECUTANDO', 'FALHA_INFRA', 'MOTOR', 'infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Regra 12: no teto, chama você.'),
  ('etapa', 'E34', 'E34', 31, 'EXECUTANDO', 'SEM_EXECUCAO_VIVA', 'VIGIA', 'infra < TETO_INFRA - 1', 'NA_FILA', '[{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"infra"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O número da execução dada como morta é marcado morto antes do próximo INICIAR (regras_gerais.numero_de_execucao).'),
  ('etapa', 'E35', 'E35', 32, 'EXECUTANDO', 'SEM_EXECUCAO_VIVA', 'VIGIA', 'infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E37', 'E37', 33, 'EXECUTANDO', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E38', 'E38', 34, 'EXECUTANDO', 'DECISAO_MUDOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E39', 'E39', 35, 'EXECUTANDO', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E40', 'E40', 36, 'VALIDACAO', 'PORTAO1_OK', 'MOTOR', 'revisor_valido and escolhido != ''FUNDADOR''', 'REVISAO', '[{"op":"param","p":"escolhido","v":"revisor"},{"op":"set","v":"exec_viva","val":0}]'::jsonb, '{"escolhido":["AUGUSTO","BIANCA","BRUNO","CAIO","CAMILA","CLARA","DANIEL","FELIPE","FUNDADOR","HELENA","ISABELA","JOANA","LAURA","MARINA","MAYA","NENHUM","NINA","OLIVIA","PEDRO","RAVI","RENATA","THEO","VICTOR"]}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E41', 'E41', 37, 'VALIDACAO', 'PORTAO1_OK', 'MOTOR', 'revisor_valido and escolhido == ''FUNDADOR''', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"revisor","val":"FUNDADOR"},{"op":"set","v":"motivo","val":"REVISAO"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Você é sempre a última reserva: se a regra 4 impedir todos os reservas, a revisão vem para você, já validada pelo portão 1.'),
  ('etapa', 'E43', 'E43', 38, 'VALIDACAO', 'PORTAO1_RECUSOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Volta ao autor com o item exato recusado. PORTAO1_RECUSOU quer dizer que a ENTREGA falhou na conferência; validador que não rodou é FALHA_INFRA ou TEMPO_ESGOTADO (E47-E49, E42).'),
  ('etapa', 'E44', 'E44', 39, 'VALIDACAO', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E45', 'E45', 40, 'VALIDACAO', 'DECISAO_MUDOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E46', 'E46', 41, 'VALIDACAO', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E47', 'E47', 42, 'VALIDACAO', 'FALHA_INFRA', 'MOTOR', 'infra < TETO_INFRA - 1', 'VALIDACAO', '[{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O validador (código nosso) não rodou: roda de novo sobre a mesma entrega, sem gastar tentativa do autor (regra 12).'),
  ('etapa', 'E48', 'E48', 43, 'VALIDACAO', 'FALHA_INFRA', 'MOTOR', 'infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Regra 12: na 3ª falha do validador, chama você.'),
  ('etapa', 'E49', 'E49', 44, 'VALIDACAO', 'TEMPO_ESGOTADO', 'RELOGIO', 'infra < TETO_INFRA - 1', 'VALIDACAO', '[{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Validação sem resposta em 60 s: conta como falha de infraestrutura, nunca como tentativa do autor.'),
  ('etapa', 'E42', 'E42', 45, 'VALIDACAO', 'TEMPO_ESGOTADO', 'RELOGIO', 'infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E50', 'E50', 46, 'REVISAO', 'INICIAR_REVISAO', 'MOTOR', 'exec_viva == 0 and execucoes < TETO_EXECUCOES', 'REVISAO', '[{"op":"set","v":"exec_viva","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E51', 'E51', 47, 'REVISAO', 'TETO_EXECUCOES', 'MOTOR', 'exec_viva == 0 and execucoes >= TETO_EXECUCOES', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E52', 'E52', 48, 'REVISAO', 'SEM_CAPACIDADE', 'MOTOR', 'exec_viva == 0 and infra < TETO_INFRA - 1', 'REVISAO', '[{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E53', 'E53', 49, 'REVISAO', 'SEM_CAPACIDADE', 'MOTOR', 'exec_viva == 0 and infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E54', 'E54', 50, 'REVISAO', 'APROVAR', 'REVISOR', 'exec_viva == 1 and not julgadora', 'APROVADA', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E74', 'E74', 51, 'REVISAO', 'APROVAR', 'REVISOR', 'exec_viva == 1 and julgadora', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"revisor","val":"FUNDADOR"},{"op":"set","v":"motivo","val":"REVISAO"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'No jurídico você é o segundo revisor (plano l. 142 e 367): o card marca ''leia antes de agir''. O parecer só vale (aprovado, ajuste na peça julgada ou não pode) com o SEU Aprovar (E81, E82, E83).'),
  ('etapa', 'E57', 'E57', 52, 'REVISAO', 'REPROVAR', 'REVISOR', 'exec_viva == 1 and reprovacoes < TETO_REPROVACOES', 'NA_FILA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"reprovacoes"},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Volta ao autor com os critérios reprovados.'),
  ('etapa', 'E58', 'E58', 53, 'REVISAO', 'REPROVAR', 'REVISOR', 'exec_viva == 1 and reprovacoes >= TETO_REPROVACOES', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E59', 'E59', 54, 'REVISAO', 'NAO_CONSIGO_CONFERIR', 'REVISOR', 'exec_viva == 1', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"revisor","val":"FUNDADOR"},{"op":"set","v":"motivo","val":"REVISAO"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Risco alto fora do alcance do revisor: cartão de revisão com texto montado pelo código.'),
  ('etapa', 'E60', 'E60', 55, 'REVISAO', 'FALHA', 'MOTOR', 'exec_viva == 1 and classe == ''FORMATO_ERRADO'' and formato < TETO_FORMATO', 'REVISAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"formato"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E61', 'E61', 56, 'REVISAO', 'FALHA', 'MOTOR', 'exec_viva == 1 and classe == ''FORMATO_ERRADO'' and formato >= TETO_FORMATO', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E62', 'E62', 57, 'REVISAO', 'FALHA', 'MOTOR', 'exec_viva == 1 and classe == ''LIMITE_CHAMADAS'' and chamadas < TETO_CHAMADAS', 'REVISAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"chamadas"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E63', 'E63', 58, 'REVISAO', 'FALHA', 'MOTOR', 'exec_viva == 1 and classe == ''LIMITE_CHAMADAS'' and chamadas >= TETO_CHAMADAS', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E64', 'E64', 59, 'REVISAO', 'FALHA', 'MOTOR', 'exec_viva == 1 and classe in (''GRANDE_DEMAIS'', ''SITE'', ''DESCONHECIDA'')', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E65', 'E65', 60, 'REVISAO', 'TEMPO_ESGOTADO', 'RELOGIO', 'exec_viva == 1 and tempo < TETO_TEMPO', 'REVISAO', '[{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"tempo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E66', 'E66', 61, 'REVISAO', 'TEMPO_ESGOTADO', 'RELOGIO', 'exec_viva == 1 and tempo >= TETO_TEMPO', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"execucoes"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E67', 'E67', 62, 'REVISAO', 'FALHA_INFRA', 'MOTOR', 'exec_viva == 1 and infra < TETO_INFRA - 1', 'REVISAO', '[{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E68', 'E68', 63, 'REVISAO', 'FALHA_INFRA', 'MOTOR', 'exec_viva == 1 and infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E69', 'E69', 64, 'REVISAO', 'SEM_EXECUCAO_VIVA', 'VIGIA', 'exec_viva == 1 and infra < TETO_INFRA - 1', 'REVISAO', '[{"op":"set","v":"exec_viva","val":0},{"n":1,"op":"add","v":"infra"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O número da revisão dada como morta é marcado morto antes do próximo INICIAR_REVISAO.'),
  ('etapa', 'E70', 'E70', 65, 'REVISAO', 'SEM_EXECUCAO_VIVA', 'VIGIA', 'exec_viva == 1 and infra >= TETO_INFRA - 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"infra","val":3},{"op":"set","v":"motivo","val":"INFRA"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E71', 'E71', 66, 'REVISAO', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E72', 'E72', 67, 'REVISAO', 'DECISAO_MUDOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E73', 'E73', 68, 'REVISAO', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E80', 'E80', 69, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''PERGUNTA'' and opcao in (''RESPOSTA_A'', ''RESPOSTA_B'', ''RESPOSTA_C'')', 'NA_FILA', '[{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E81', 'E81', 70, 'ESPERANDO_FUNDADOR', 'APROVAR', 'FUNDADOR', 'motivo == ''REVISAO'' and not (julgadora and semaforo == ''AJUSTE'')', 'APROVADA', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E82', 'E82', 71, 'ESPERANDO_FUNDADOR', 'APROVAR', 'FUNDADOR', 'motivo == ''REVISAO'' and julgadora and semaforo == ''AJUSTE'' and voltas < TETO_VOLTAS_JURIDICO', 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"voltas"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, array['AJUSTE_DO_JULGADOR']::text[], false, 'Parecer de ajuste aprovado por você: a peça julgada volta ao autor e o jurídico refaz sobre o texto novo.'),
  ('etapa', 'E83', 'E83', 72, 'ESPERANDO_FUNDADOR', 'APROVAR', 'FUNDADOR', 'motivo == ''REVISAO'' and julgadora and semaforo == ''AJUSTE'' and voltas >= TETO_VOLTAS_JURIDICO', 'EM_RESOLUCAO', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E84', 'E84', 73, 'ESPERANDO_FUNDADOR', 'PEDIR_AJUSTE', 'FUNDADOR', 'motivo == ''REVISAO'' and ordens < TETO_ORDENS', 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Seu ajuste volta ao autor e não gasta o teto de 6.'),
  ('etapa', 'E96', 'E96', 74, 'ESPERANDO_FUNDADOR', 'PEDIR_AJUSTE', 'FUNDADOR', 'motivo == ''REVISAO'' and ordens >= TETO_ORDENS', 'CANCELADA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"fim","val":"SUBSTITUIDO"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, array['SUBSTITUIR_CARD']::text[], false, 'Teto de ordens: o seu ajuste substitui o card por um card novo ligado (C28); a peça que você marcou nunca fica aprovada.'),
  ('etapa', 'E85', 'E85', 75, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''RESOLUCAO'' and opcao == ''REFAZER'' and replan < TETO_REPLANEJAMENTO and ordens < TETO_ORDENS', 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"replan"},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E97', 'E97', 76, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''RESOLUCAO'' and opcao == ''REFAZER'' and (replan >= TETO_REPLANEJAMENTO or ordens >= TETO_ORDENS)', 'CANCELADA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"fim","val":"SUBSTITUIDO"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, array['SUBSTITUIR_CARD']::text[], false, 'Refazer já usado nesta etapa ou teto de ordens: card novo ligado, replanejado do zero (nunca vira comentário).'),
  ('etapa', 'E86', 'E86', 77, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''RESOLUCAO'' and opcao == ''SEGUIR_SEM'' and pulavel', 'ENCERRADA_COM_FALHA', '[{"op":"set","v":"fim","val":"PULADA"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Só se o roteiro permitir; nunca no jurídico nem no relatório (MEL-24).'),
  ('etapa', 'E87', 'E87', 78, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo in (''RESOLUCAO'', ''INFRA'') and opcao == ''ENCERRAR''', 'ENCERRADA_COM_FALHA', '[{"op":"set","v":"fim","val":"ENCERRAR_CARD"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, array['ENCERRAR_CARD']::text[], false, null),
  ('etapa', 'E88', 'E88', 79, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''INFRA'' and opcao in (''ESPERAR'', ''MODELO_MENOR'') and ordens < TETO_ORDENS', 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E98', 'E98', 80, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''INFRA'' and opcao in (''ESPERAR'', ''MODELO_MENOR'') and ordens >= TETO_ORDENS', 'CANCELADA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"fim","val":"SUBSTITUIDO"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, array['SUBSTITUIR_CARD']::text[], false, 'Teto de ordens: a sua escolha vale e abre o card novo ligado; o padrão não corre por cima dela.'),
  ('etapa', 'E89', 'E89', 81, 'ESPERANDO_FUNDADOR', 'LEMBRETE_24H', 'RELOGIO', 'espera in (''INTERNA'', ''EXTERNA'') and lembretes == 0', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"lembretes","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Na espera externa, o relógio manda este lembrete antes do prazo da pergunta (MEL-37: nenhum padrão sem lembrete entregue).'),
  ('etapa', 'E90', 'E90', 82, 'ESPERANDO_FUNDADOR', 'LEMBRETE_48H', 'RELOGIO', 'espera == ''INTERNA'' and lembretes == 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"lembretes","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E91', 'E91', 83, 'ESPERANDO_FUNDADOR', 'PRAZO_ESPERA_VENCIDO', 'RELOGIO', '(espera == ''INTERNA'' and lembretes >= TETO_LEMBRETES) or (espera == ''EXTERNA'' and lembretes >= 1)', 'CANCELADA', '[{"op":"set","v":"fim","val":"PADRAO"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O padrão cancela a etapa e fica registrado como padrão; nunca aprova entrega.'),
  ('etapa', 'E92', 'E92', 84, 'ESPERANDO_FUNDADOR', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E93', 'E93', 85, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'motivo == ''REVISAO''', 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E94', 'E94', 86, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'motivo != ''REVISAO''', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E95', 'E95', 87, 'ESPERANDO_FUNDADOR', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E99', 'E99', 88, 'ESPERANDO_FUNDADOR', 'CAPACIDADE_VOLTOU', 'MOTOR', 'motivo == ''INFRA'' and infra < TETO_INFRA', 'NA_FILA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"infra","val":3},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Espera de capacidade (cota, login, banco: 6 horas sem voltar) e a capacidade voltou antes da sua resposta: a etapa volta sozinha à fila, sem gastar tentativa nem ordem. O infra vai ao teto: a próxima falha chama você na hora e esta linha não vale de novo nesta rodada (sem laço). Na 3ª falha seguida (infra já no teto), quem decide é você.'),
  ('etapa', 'E100', 'E100', 89, 'EM_RESOLUCAO', 'RECOMENDAR', 'HELENA', '(opcao != ''SEGUIR_SEM'' or pulavel) and (opcao != ''REFAZER'' or (replan < TETO_REPLANEJAMENTO and ordens < TETO_ORDENS))', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"RESOLUCAO"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, 'Só a chave da chamada atual da Helena grava (regra 3).'),
  ('etapa', 'E101', 'E101', 90, 'EM_RESOLUCAO', 'TEMPO_ESGOTADO', 'RELOGIO', null, 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"motivo","val":"RESOLUCAO"},{"op":"set","v":"espera","val":"INTERNA"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], true, null),
  ('etapa', 'E102', 'E102', 91, 'EM_RESOLUCAO', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E103', 'E103', 92, 'EM_RESOLUCAO', 'DECISAO_MUDOU', 'MOTOR', null, 'EM_RESOLUCAO', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E104', 'E104', 93, 'EM_RESOLUCAO', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('etapa', 'E110', 'E110', 94, 'APROVADA', 'CARD_PRONTO', 'MOTOR', null, 'PRONTA', '[{"op":"set","v":"fim","val":"CARD_PRONTO"}]'::jsonb, '{}'::jsonb, array['CRIAR_ACAO_EXTERNA']::text[], false, 'Só aqui nasce a ação externa proposta: depois dos portões 1 e 2, do jurídico e do card pronto, a partir da entrega aprovada (se ela propõe uma). No máximo uma por etapa (identidade: card + etapa).'),
  ('etapa', 'E111', 'E111', 95, 'APROVADA', 'PEDIR_AJUSTE', 'FUNDADOR', 'ordens < TETO_ORDENS', 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['DEPENDENTES_MUDOU']::text[], true, 'Volta ao autor; quem dependia dela é refeito (regra 10).'),
  ('etapa', 'E117', 'E117', 96, 'APROVADA', 'PEDIR_AJUSTE', 'FUNDADOR', 'ordens >= TETO_ORDENS', 'CANCELADA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['SUBSTITUIR_CARD']::text[], false, 'Teto de ordens: o seu ajuste substitui o card por um card novo ligado (C28); o card nunca fecha com a peça que você marcou como errada.'),
  ('etapa', 'E112', 'E112', 97, 'APROVADA', 'AJUSTE_DO_JULGADOR', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"leu_internet","val":0}]'::jsonb, '{}'::jsonb, array['DEPENDENTES_MUDOU']::text[], false, null),
  ('etapa', 'E113', 'E113', 98, 'APROVADA', 'REABRIR_POR_ORDEM', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, array['DEPENDENTES_MUDOU']::text[], true, null),
  ('etapa', 'E114', 'E114', 99, 'APROVADA', 'DEPENDENCIA_MUDOU', 'MOTOR', null, 'AGUARDANDO_ANTERIORES', '[{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"},{"op":"set","v":"motivo","val":"NENHUM"}]'::jsonb, '{}'::jsonb, array['DEPENDENTES_MUDOU']::text[], false, null),
  ('etapa', 'E115', 'E115', 100, 'APROVADA', 'DECISAO_MUDOU', 'MOTOR', null, 'NA_FILA', '[{"op":"set","v":"execucoes","val":0},{"op":"set","v":"formato","val":0},{"op":"set","v":"tempo","val":0},{"op":"set","v":"chamadas","val":0},{"op":"set","v":"reprovacoes","val":0},{"op":"set","v":"infra","val":0},{"op":"set","v":"aviso","val":0},{"op":"set","v":"lembretes","val":0},{"op":"set","v":"exec_viva","val":0},{"op":"set","v":"leu_internet","val":0},{"op":"set","v":"motivo","val":"NORMAL"},{"op":"set","v":"espera","val":"NENHUMA"},{"op":"set","v":"semaforo","val":"NENHUM"},{"op":"set","v":"revisor","val":"NENHUM"}]'::jsonb, '{}'::jsonb, array['DEPENDENTES_MUDOU']::text[], true, null),
  ('etapa', 'E116', 'E116', 101, 'APROVADA', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X01', 'X01', 1, 'PROPOSTA', 'APROVAR', 'FUNDADOR', 'tem_ferramenta', 'AUTORIZADA', '[{"op":"set","v":"ok_registrado","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Só no app, com a versão vista (e código do autenticador a partir da fase 4).'),
  ('acao_externa', 'X02', 'X02', 2, 'PROPOSTA', 'RESPONDER', 'FUNDADOR', 'opcao == ''FEITO_POR_MIM''', 'FEITA_PELO_FUNDADOR', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X03', 'X03', 3, 'PROPOSTA', 'CANCELAR', 'FUNDADOR', null, 'RECUSADA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X06', 'X06', 4, 'PROPOSTA', 'LEMBRETE_24H', 'RELOGIO', 'lembretes == 0', 'PROPOSTA', '[{"op":"set","v":"lembretes","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Lembrete antes do prazo da ação (MEL-37).'),
  ('acao_externa', 'X04', 'X04', 5, 'PROPOSTA', 'PRAZO_ESPERA_VENCIDO', 'RELOGIO', 'lembretes >= 1', 'EXPIRADA', '[{"op":"set","v":"fim","val":"PADRAO"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Só depois do lembrete entregue; o padrão nunca executa.'),
  ('acao_externa', 'X05', 'X05', 6, 'PROPOSTA', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X10', 'X10', 7, 'AUTORIZADA', 'EXECUTAR_ACAO', 'MOTOR', 'ok_registrado == 1 and tentativas < TETO_EXECUCOES_ACAO', 'EXECUTANDO_ACAO', '[{"n":1,"op":"add","v":"tentativas"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chave única da ação: repetir o passo nunca executa duas vezes.'),
  ('acao_externa', 'X11', 'X11', 8, 'AUTORIZADA', 'CANCELAR', 'FUNDADOR', null, 'RECUSADA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X12', 'X12', 9, 'AUTORIZADA', 'CANCELADO_PAI', 'MOTOR', null, 'CANCELADA', '[{"op":"set","v":"fim","val":"PAI"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X13', 'X13', 10, 'AUTORIZADA', 'TEMPO_ESGOTADO', 'RELOGIO', null, 'EXPIRADA', '[{"op":"set","v":"fim","val":"PADRAO"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'O motor não começou em 60 s: o seu ok vence e nada foi feito. Um ok vencido nunca é usado depois.'),
  ('acao_externa', 'X20', 'X20', 11, 'EXECUTANDO_ACAO', 'ACAO_CONCLUIDA', 'MOTOR', null, 'EXECUTADA', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X21', 'X21', 12, 'EXECUTANDO_ACAO', 'ACAO_FALHOU', 'MOTOR', null, 'FALHOU', '[{"op":"set","v":"fim","val":"FALHA"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X22', 'X22', 13, 'EXECUTANDO_ACAO', 'TEMPO_ESGOTADO', 'RELOGIO', null, 'INCERTA', '[{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Sem confirmação não se repete: você confere se aconteceu.'),
  ('acao_externa', 'X23', 'X23', 14, 'EXECUTANDO_ACAO', 'CANCELADO_PAI', 'MOTOR', null, 'EXECUTANDO_ACAO', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Já em execução: não dá para desfazer; termina e registra.'),
  ('acao_externa', 'X30', 'X30', 15, 'INCERTA', 'RESPONDER', 'FUNDADOR', 'opcao == ''ACONTECEU''', 'EXECUTADA', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X31', 'X31', 16, 'INCERTA', 'RESPONDER', 'FUNDADOR', 'opcao == ''NAO_ACONTECEU''', 'FALHOU', '[{"op":"set","v":"fim","val":"FALHA"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X32', 'X32', 17, 'INCERTA', 'LEMBRETE_24H', 'RELOGIO', 'lembretes == 0', 'INCERTA', '[{"op":"set","v":"lembretes","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X33', 'X33', 18, 'INCERTA', 'LEMBRETE_48H', 'RELOGIO', 'lembretes == 1', 'INCERTA', '[{"op":"set","v":"lembretes","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, null),
  ('acao_externa', 'X34', 'X34', 19, 'INCERTA', 'PRAZO_ESPERA_VENCIDO', 'RELOGIO', 'lembretes >= TETO_LEMBRETES', 'NAO_CONFIRMADA', '[{"op":"set","v":"fim","val":"PADRAO"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Sem sua confirmação, fica ''não confirmada'' (pode ter acontecido): nunca é marcada como falha e nunca é refeita por este card.'),
  ('acao_externa', 'X35', 'X35', 20, 'INCERTA', 'CANCELADO_PAI', 'MOTOR', null, 'INCERTA', '[]'::jsonb, '{}'::jsonb, '{}'::text[], false, null);

insert into helena_v2.ligacao (nome, papel, evento, alvos, no_card, nota) values
  ('CANCELAR_ETAPAS', 'MOTOR', 'CANCELADO_PAI', array['etapas_abertas', 'acoes_abertas']::text[], null, 'Cascata: sub-etapas e ações ainda não executadas são canceladas junto.'),
  ('CARD_PRONTO', 'MOTOR', 'CARD_PRONTO', array['etapas_aprovadas']::text[], null, null),
  ('DECISAO_DO_FUNDADOR', 'MOTOR', 'DECISAO_MUDOU', array['card']::text[], null, 'Só PEDIR_AJUSTE do fundador no card aberto emite; o histórico de C16/C17 aponta para esse toque.'),
  ('DECISAO_MUDOU', 'MOTOR', 'DECISAO_MUDOU', array['etapas_abertas_que_usam_decisao']::text[], null, null),
  ('DEPENDENTES_MUDOU', 'MOTOR', 'DEPENDENCIA_MUDOU', array['dependentes_diretos_abertos']::text[], null, null),
  ('AJUSTE_DO_JULGADOR', 'MOTOR', 'AJUSTE_DO_JULGADOR', array['julgadas_abertas']::text[], null, null),
  ('REABRIR_JULGADAS', 'MOTOR', 'REABRIR_POR_ORDEM', array['julgadas_de_nao_pode']::text[], null, null),
  ('ENCERRAR_CARD', 'MOTOR', 'ENCERRAR_CARD', array['card']::text[], null, null),
  ('SUBSTITUIR_CARD', 'MOTOR', 'SUBSTITUIR_CARD', array['card']::text[], null, null),
  ('PULAR_FALHAS', null, null, '{}'::text[], 'marcar_falhas_como_puladas', null),
  ('REFAZER_FALHAS', null, null, '{}'::text[], 'nova_versao_das_falhas', 'A etapa final continua final no histórico; nasce uma versão nova dela, que leva as suas respostas guardadas (recusa_do_fundador.resposta_tardia_com_card_aberto).'),
  ('CRIAR_ACAO_EXTERNA', null, null, '{}'::text[], 'criar_acao_externa', 'Só a E110 emite (etapa pronta, card pronto). Cria a proposta se a entrega aprovada propõe ação externa (campo acao_externa da última entrega, a que passou pelos portões). Vai para a lista do que só você faz; nunca é executada pelo agente. Identidade card + etapa: no máximo uma; índice único no banco.'),
  ('CARD_LIGADO', null, null, '{}'::text[], 'criar_card_ligado', null);

insert into helena_v2.automatico (maquina, ordem, evento) values
  ('card', 1, 'PLANO_VALIDO'),
  ('card', 2, 'TODAS_PRONTAS'),
  ('card', 3, 'PERGUNTAR_AO_FUNDADOR'),
  ('card', 4, 'MOTIVO_RESOLVIDO'),
  ('etapa', 1, 'DEPENDENCIAS_PRONTAS'),
  ('etapa', 2, 'INICIAR_EXECUCAO'),
  ('etapa', 3, 'INICIAR_REVISAO'),
  ('etapa', 4, 'TETO_EXECUCOES'),
  ('acao_externa', 1, 'EXECUTAR_ACAO');

insert into helena_v2.reacao (ordem, papel, evento, maquina, estados_tipo, estados, guarda_id, guarda, muda_campo, abre_card_ligado, efeito_fora) values
  (1, 'FUNDADOR', 'USAR_COMO_EXEMPLO', 'etapa', 'LISTA', array['APROVADA', 'PRONTA']::text[], null, null, null, false, 'exemplo de ouro com data (90 dias, até 3 por serviço); só em entrega com tudo conferido'),
  (2, 'FUNDADOR', 'APROVAR', 'card', 'LISTA', array['PRONTO']::text[], null, null, null, false, 'registra a sua aprovação do card pronto e relê cada fonte; avisa se uma página mudou'),
  (3, 'FUNDADOR', 'PEDIR_AJUSTE', 'card', 'LISTA', array['PRONTO', 'CANCELADO', 'ENCERRADO_COM_FALHA']::text[], null, null, null, true, 'abre card novo ligado, com as entregas deste, para o mesmo responsável (card fechado não volta a andar)'),
  (4, 'FUNDADOR', 'PAUSAR_TUDO', 'card', 'TODOS', '{}'::text[], null, null, null, false, 'pausa a fila por 20 minutos e desliga sozinha; execuções vivas terminam; nenhuma passagem muda'),
  (5, 'FUNDADOR', 'MUDAR_PRIORIDADE', 'card', 'ABERTOS', '{}'::text[], null, null, 'prioridade', false, 'muda o campo prioridade; só você'),
  (6, 'FUNDADOR', 'MUDAR_PRAZO', 'card', 'ABERTOS', '{}'::text[], 'reacao_6', 'mudancas_prazo >= TETO_MUDANCAS_PRAZO', 'prazo', false, 'teto de mudanças de prazo deste card: o campo muda e os avisos ficam no nível em que estão (o card continua marcado se já passou do prazo)'),
  (7, 'HELENA', 'SUGERIR_PRAZO', 'card', 'ABERTOS', '{}'::text[], null, null, null, false, 'vira item na sua lista; o prazo original continua'),
  (8, 'VIGIA', 'REGRA_QUEBRADA', 'card', 'TODOS', '{}'::text[], null, null, null, false, 'luz vermelha e um aviso por regra a cada 6 horas; nunca congela card (B-20)');

insert into helena_v2.regra_geral (chave, valor) values
  ('respostas_de_agente_exigem_chave_atual', '["AUTOR","REVISOR","HELENA"]'::jsonb),
  ('numero_de_execucao', '{"morte":"E34, E35, E69 e E70 marcam o número da execução dada como morta ANTES de liberar o próximo INICIAR; uma resposta dela chega depois como chave antiga e não grava.","nao_e":"execucoes","nunca_zera":true,"o_que":"Chave de cada chamada de agente: card, etapa (ou o próprio card, na Helena), versão e número.","sobe_em":["INICIAR_EXECUCAO","INICIAR_REVISAO","cada chamada da Helena (leitura de volta e recomendação)"]}'::jsonb),
  ('respostas_de_revisor_exigem_revisor_designado', 'true'::jsonb),
  ('toques_do_fundador_exigem_versao_vista', '["APROVAR","PEDIR_AJUSTE","RESPONDER"]'::jsonb),
  ('etapa_so_anda_com_card_ativo', '{"card_ativo":["EM_ANDAMENTO","ESPERANDO_FUNDADOR"],"exceto":["CANCELADO_PAI","CARD_PRONTO"]}'::jsonb),
  ('entradas_so_por_sinal', 'true'::jsonb),
  ('resposta_de_agente_sem_linha', '{"evento":"FALHA","papel":"MOTOR","parametros":{"classe":"FORMATO_ERRADO"}}'::jsonb),
  ('sinais_atomicos', 'true'::jsonb),
  ('subcards_desligados', 'true'::jsonb),
  ('recusa_do_fundador', '{"aberto":"COMENTARIO_NO_CARD","final":"CARD_NOVO_LIGADO","final_abre_card_para":["RESPONDER","PEDIR_AJUSTE"],"final_outros_botoes":"COMENTARIO_NO_CARD","resposta_tardia_com_card_aberto":"RESPOSTA_GUARDADA","versao_antiga":"COMENTARIO_NO_CARD"}'::jsonb),
  ('designacao_de_revisor', '{"candidatos":"revisores_da_ficha","excluir":["AUTOR_DA_ETAPA","AUTORES_DOS_JULGADORES","REVISORES_DOS_JULGADORES"],"julgadora_tem_segundo_revisor":"FUNDADOR","ultima_reserva":"FUNDADOR"}'::jsonb),
  ('eventos_que_envelhecem', '["DECISAO_MUDOU","DEPENDENCIA_MUDOU","AJUSTE_DO_JULGADOR","REABRIR_POR_ORDEM"]'::jsonb),
  ('toques_que_envelhecem', '[{"evento":"PEDIR_AJUSTE","papel":"FUNDADOR"}]'::jsonb);

insert into helena_v2.vocab_evento (papel, evento, parametros, efeito, desligado, muda_campo) values
  ('AUTOR', 'ENTREGAR', '{"acao_externa":["NENHUMA","SO_FUNDADOR","PELO_MOTOR"],"parecer":["OK","AJUSTE","NAO_PODE"],"usou_internet":["NAO","SIM"]}'::jsonb, 'interno', null, null),
  ('AUTOR', 'PERGUNTAR', '{"usou_internet":["NAO","SIM"]}'::jsonb, 'interno', null, null),
  ('AUTOR', 'DEVOLVER_A_QUEM_PEDIU', '{"usou_internet":["NAO","SIM"]}'::jsonb, 'interno', null, null),
  ('AUTOR', 'REGISTRAR_FALHA', '{"motivo_falha":["NAO_CONSIGO","FALTAM_DADOS","FONTE_INSUFICIENTE"],"usou_internet":["NAO","SIM"]}'::jsonb, 'interno', null, null),
  ('AUTOR', 'PEDIR_SUBCARD', '{"usou_internet":["NAO","SIM"]}'::jsonb, 'interno', 'v2.0 (MEL-24): sem sub-card até a fase 4; se chegar, conta como FORMATO_ERRADO', null),
  ('REVISOR', 'APROVAR', '{}'::jsonb, 'interno', null, null),
  ('REVISOR', 'REPROVAR', '{}'::jsonb, 'interno', null, null),
  ('REVISOR', 'NAO_CONSIGO_CONFERIR', '{}'::jsonb, 'interno', null, null),
  ('HELENA', 'LER_DE_VOLTA', '{}'::jsonb, 'interno', null, null),
  ('HELENA', 'RECOMENDAR', '{"opcao":["REFAZER","SEGUIR_SEM","ENCERRAR"]}'::jsonb, 'interno', null, null),
  ('HELENA', 'SUGERIR_PRAZO', '{}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'APROVAR', '{}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'PEDIR_AJUSTE', '{"motivo_ajuste":["ERRO_DE_FATO","FALTOU_TEMA","TOM","FORMATO"]}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'USAR_COMO_EXEMPLO', '{}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'CANCELAR', '{}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'RESPONDER', '{"opcao":["RESPOSTA_A","RESPOSTA_B","RESPOSTA_C","CONFIRMO","REFAZER","SEGUIR_SEM","ENCERRAR","PULAR","ESPERAR","MODELO_MENOR","ACONTECEU","NAO_ACONTECEU","FEITO_POR_MIM"]}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'PAUSAR_TUDO', '{}'::jsonb, 'interno', null, null),
  ('FUNDADOR', 'MUDAR_PRIORIDADE', '{}'::jsonb, 'interno', null, 'prioridade'),
  ('FUNDADOR', 'MUDAR_PRAZO', '{}'::jsonb, 'interno', null, 'prazo'),
  ('MOTOR', 'INICIAR_EXECUCAO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'INICIAR_REVISAO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'PORTAO1_OK', '{"escolhido":["HELENA","LAURA","AUGUSTO","MARINA","CAIO","CLARA","BIANCA","DANIEL","THEO","NINA","RAVI","MAYA","BRUNO","OLIVIA","VICTOR","CAMILA","ISABELA","PEDRO","RENATA","JOANA","FELIPE","FUNDADOR"]}'::jsonb, 'interno', null, null),
  ('MOTOR', 'PORTAO1_RECUSOU', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'FALHA', '{"classe":["FORMATO_ERRADO","LIMITE_CHAMADAS","GRANDE_DEMAIS","SITE","DESCONHECIDA"]}'::jsonb, 'interno', null, null),
  ('MOTOR', 'FALHA_INFRA', '{"classe":["COTA","LOGIN","PROVEDOR","QUEDA","BANCO","FERRAMENTA"]}'::jsonb, 'interno', null, null),
  ('MOTOR', 'SEM_CAPACIDADE', '{"classe":["COTA","LOGIN","BANCO","AGENTE_PAUSADO"]}'::jsonb, 'interno', null, null),
  ('MOTOR', 'CAPACIDADE_VOLTOU', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'TETO_EXECUCOES', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'DEPENDENCIAS_PRONTAS', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'DEPENDENCIA_MUDOU', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'DECISAO_MUDOU', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'AJUSTE_DO_JULGADOR', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'REABRIR_POR_ORDEM', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'CANCELADO_PAI', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'CARD_PRONTO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'PLANO_VALIDO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'PLANO_INVALIDO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'TODAS_PRONTAS', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'PERGUNTAR_AO_FUNDADOR', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'MOTIVO_RESOLVIDO', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'ENCERRAR_CARD', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'SUBSTITUIR_CARD', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'EXECUTAR_ACAO', '{}'::jsonb, 'externo', null, null),
  ('MOTOR', 'ACAO_CONCLUIDA', '{}'::jsonb, 'interno', null, null),
  ('MOTOR', 'ACAO_FALHOU', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'TEMPO_ESGOTADO', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'PRAZO_80', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'PRAZO_VENCIDO', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'PRAZO_MAIS_1H', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'LEMBRETE_24H', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'LEMBRETE_48H', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'PRAZO_ESPERA_VENCIDO', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'AVISO_1H', '{}'::jsonb, 'interno', null, null),
  ('RELOGIO', 'ESPERA_6H', '{}'::jsonb, 'interno', null, null),
  ('VIGIA', 'SEM_EXECUCAO_VIVA', '{}'::jsonb, 'interno', null, null),
  ('VIGIA', 'REGRA_QUEBRADA', '{}'::jsonb, 'interno', null, null);

insert into helena_v2.predicado_lista (nome, situacao) values
  ('satisfaz_dependencia', 'APROVADA'),
  ('satisfaz_dependencia', 'PULADA'),
  ('conta_como_pronta', 'APROVADA'),
  ('conta_como_pronta', 'PULADA'),
  ('falha_que_pergunta', 'FALHOU'),
  ('aberta', 'ESPERA'),
  ('aberta', 'TRABALHO'),
  ('aberta', 'APROVADA'),
  ('aberta', 'APROVADA_NAO_PODE');

insert into helena_v2.entrada (maquina, evento) values
  ('etapa', 'DEPENDENCIA_MUDOU'),
  ('etapa', 'DECISAO_MUDOU'),
  ('etapa', 'AJUSTE_DO_JULGADOR'),
  ('etapa', 'REABRIR_POR_ORDEM'),
  ('etapa', 'CANCELADO_PAI'),
  ('etapa', 'CARD_PRONTO'),
  ('acao_externa', 'CANCELADO_PAI'),
  ('card', 'DECISAO_MUDOU'),
  ('card', 'ENCERRAR_CARD'),
  ('card', 'SUBSTITUIR_CARD');

insert into helena_v2.identidade (nome, tipo, ordem) values
  ('HELENA', 'agente', 1),
  ('LAURA', 'agente', 2),
  ('AUGUSTO', 'agente', 3),
  ('MARINA', 'agente', 4),
  ('CAIO', 'agente', 5),
  ('CLARA', 'agente', 6),
  ('BIANCA', 'agente', 7),
  ('DANIEL', 'agente', 8),
  ('THEO', 'agente', 9),
  ('NINA', 'agente', 10),
  ('RAVI', 'agente', 11),
  ('MAYA', 'agente', 12),
  ('BRUNO', 'agente', 13),
  ('OLIVIA', 'agente', 14),
  ('VICTOR', 'agente', 15),
  ('CAMILA', 'agente', 16),
  ('ISABELA', 'agente', 17),
  ('PEDRO', 'agente', 18),
  ('RENATA', 'agente', 19),
  ('JOANA', 'agente', 20),
  ('FELIPE', 'agente', 21),
  ('FUNDADOR', 'fundador', 22);

insert into helena_v2.meta_tabela (id, versao, impressao_digital, hash_das_linhas, gerado_de) values
  (true, '2.0.0', '4d307f25747d5381', null, 'helena-v2/maquina/passagens.yaml + vocabulario.yaml');

-- Colunas dos contadores, da configuração e do estado (os tetos e domínios vêm do YAML).
-- card
alter table helena_v2.card alter column estado set default 'RASCUNHO';
alter table helena_v2.card drop constraint if exists ck_card_estado;
alter table helena_v2.card add constraint ck_card_estado check (estado in ('RASCUNHO', 'ESPERANDO_CONFIRMACAO', 'VALIDANDO_PLANO', 'EM_ANDAMENTO', 'ESPERANDO_FUNDADOR', 'PRONTO', 'CANCELADO', 'ENCERRADO_COM_FALHA'));
alter table helena_v2.card drop constraint if exists ck_card_regra01_dono_e_prazo;
alter table helena_v2.card add constraint ck_card_regra01_dono_e_prazo check (estado in ('CANCELADO', 'ENCERRADO_COM_FALHA', 'PRONTO') or (dono is not null and prazo_ate is not null));
alter table helena_v2.card add column if not exists pedido_grande boolean not null default false;
alter table helena_v2.card drop constraint if exists ck_card_motivo;
alter table helena_v2.card add column if not exists motivo text not null default 'NENHUM';
alter table helena_v2.card add constraint ck_card_motivo check (motivo in ('NENHUM', 'HELENA_FALHOU', 'PLANO_INVALIDO', 'VALIDADOR_FALHOU', 'DEPENDENCIA', 'NAO_PODE'));
alter table helena_v2.card drop constraint if exists ck_card_ordens;
alter table helena_v2.card add column if not exists ordens integer not null default 0;
alter table helena_v2.card add constraint ck_card_ordens check (ordens between 0 and 3);
alter table helena_v2.card drop constraint if exists ck_card_perguntas;
alter table helena_v2.card add column if not exists perguntas integer not null default 0;
alter table helena_v2.card add constraint ck_card_perguntas check (perguntas between 0 and 2);
alter table helena_v2.card drop constraint if exists ck_card_voltas;
alter table helena_v2.card add column if not exists voltas integer not null default 0;
alter table helena_v2.card add constraint ck_card_voltas check (voltas between 0 and 2);
alter table helena_v2.card drop constraint if exists ck_card_nivel_prazo;
alter table helena_v2.card add column if not exists nivel_prazo integer not null default 0;
alter table helena_v2.card add constraint ck_card_nivel_prazo check (nivel_prazo between 0 and 3);
alter table helena_v2.card drop constraint if exists ck_card_lembretes;
alter table helena_v2.card add column if not exists lembretes integer not null default 0;
alter table helena_v2.card add constraint ck_card_lembretes check (lembretes between 0 and 2);
alter table helena_v2.card drop constraint if exists ck_card_falhas_helena;
alter table helena_v2.card add column if not exists falhas_helena integer not null default 0;
alter table helena_v2.card add constraint ck_card_falhas_helena check (falhas_helena between 0 and 2);
alter table helena_v2.card drop constraint if exists ck_card_validacoes;
alter table helena_v2.card add column if not exists validacoes integer not null default 0;
alter table helena_v2.card add constraint ck_card_validacoes check (validacoes between 0 and 2);
alter table helena_v2.card drop constraint if exists ck_card_mudancas_prazo;
alter table helena_v2.card add column if not exists mudancas_prazo integer not null default 0;
alter table helena_v2.card add constraint ck_card_mudancas_prazo check (mudancas_prazo between 0 and 3);
alter table helena_v2.card drop constraint if exists ck_card_fim;
alter table helena_v2.card add column if not exists fim text not null default 'NENHUM';
alter table helena_v2.card add constraint ck_card_fim check (fim in ('NENHUM', 'PAI', 'PADRAO', 'PULADA', 'ENCERRAR_CARD', 'CARD_PRONTO', 'FUNDADOR', 'SUBSTITUIDO', 'FALHA'));

-- etapa
alter table helena_v2.etapa alter column estado set default 'AGUARDANDO_ANTERIORES';
alter table helena_v2.etapa drop constraint if exists ck_etapa_estado;
alter table helena_v2.etapa add constraint ck_etapa_estado check (estado in ('AGUARDANDO_ANTERIORES', 'NA_FILA', 'EXECUTANDO', 'VALIDACAO', 'REVISAO', 'ESPERANDO_FUNDADOR', 'EM_RESOLUCAO', 'APROVADA', 'PRONTA', 'CANCELADA', 'ENCERRADA_COM_FALHA'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_regra01_dono_e_prazo;
alter table helena_v2.etapa add constraint ck_etapa_regra01_dono_e_prazo check (estado in ('CANCELADA', 'ENCERRADA_COM_FALHA', 'PRONTA') or (dono is not null and prazo_ate is not null));
alter table helena_v2.etapa add column if not exists tem_internet boolean not null default false;
alter table helena_v2.etapa add column if not exists julgadora boolean not null default false;
alter table helena_v2.etapa add column if not exists julgada boolean not null default false;
alter table helena_v2.etapa add column if not exists pulavel boolean not null default false;
alter table helena_v2.etapa add column if not exists permite_perguntar boolean not null default false;
alter table helena_v2.etapa add column if not exists permite_devolver boolean not null default false;
alter table helena_v2.etapa add column if not exists usa_decisao boolean not null default false;
alter table helena_v2.etapa add column if not exists prazo_de_terceiro boolean not null default false;
alter table helena_v2.etapa drop constraint if exists ck_etapa_motivo;
alter table helena_v2.etapa add column if not exists motivo text not null default 'NENHUM';
alter table helena_v2.etapa add constraint ck_etapa_motivo check (motivo in ('NENHUM', 'NORMAL', 'CAPACIDADE', 'PERGUNTA', 'REVISAO', 'RESOLUCAO', 'INFRA'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_espera;
alter table helena_v2.etapa add column if not exists espera text not null default 'NENHUMA';
alter table helena_v2.etapa add constraint ck_etapa_espera check (espera in ('NENHUMA', 'INTERNA', 'EXTERNA'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_execucoes;
alter table helena_v2.etapa add column if not exists execucoes integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_execucoes check (execucoes between 0 and 6);
alter table helena_v2.etapa drop constraint if exists ck_etapa_formato;
alter table helena_v2.etapa add column if not exists formato integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_formato check (formato between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_tempo;
alter table helena_v2.etapa add column if not exists tempo integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_tempo check (tempo between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_chamadas;
alter table helena_v2.etapa add column if not exists chamadas integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_chamadas check (chamadas between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_reprovacoes;
alter table helena_v2.etapa add column if not exists reprovacoes integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_reprovacoes check (reprovacoes between 0 and 2);
alter table helena_v2.etapa drop constraint if exists ck_etapa_infra;
alter table helena_v2.etapa add column if not exists infra integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_infra check (infra between 0 and 3);
alter table helena_v2.etapa drop constraint if exists ck_etapa_aviso;
alter table helena_v2.etapa add column if not exists aviso integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_aviso check (aviso between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_replan;
alter table helena_v2.etapa add column if not exists replan integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_replan check (replan between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_lembretes;
alter table helena_v2.etapa add column if not exists lembretes integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_lembretes check (lembretes between 0 and 2);
alter table helena_v2.etapa drop constraint if exists ck_etapa_exec_viva;
alter table helena_v2.etapa add column if not exists exec_viva integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_exec_viva check (exec_viva between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_leu_internet;
alter table helena_v2.etapa add column if not exists leu_internet integer not null default 0;
alter table helena_v2.etapa add constraint ck_etapa_leu_internet check (leu_internet between 0 and 1);
alter table helena_v2.etapa drop constraint if exists ck_etapa_revisor;
alter table helena_v2.etapa add column if not exists revisor text not null default 'NENHUM';
alter table helena_v2.etapa add constraint ck_etapa_revisor check (revisor in ('NENHUM', 'HELENA', 'LAURA', 'AUGUSTO', 'MARINA', 'CAIO', 'CLARA', 'BIANCA', 'DANIEL', 'THEO', 'NINA', 'RAVI', 'MAYA', 'BRUNO', 'OLIVIA', 'VICTOR', 'CAMILA', 'ISABELA', 'PEDRO', 'RENATA', 'JOANA', 'FELIPE', 'FUNDADOR'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_semaforo;
alter table helena_v2.etapa add column if not exists semaforo text not null default 'NENHUM';
alter table helena_v2.etapa add constraint ck_etapa_semaforo check (semaforo in ('NENHUM', 'OK', 'AJUSTE', 'NAO_PODE'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_fim;
alter table helena_v2.etapa add column if not exists fim text not null default 'NENHUM';
alter table helena_v2.etapa add constraint ck_etapa_fim check (fim in ('NENHUM', 'PAI', 'PADRAO', 'PULADA', 'ENCERRAR_CARD', 'CARD_PRONTO', 'FUNDADOR', 'SUBSTITUIDO', 'FALHA'));
alter table helena_v2.etapa drop constraint if exists ck_etapa_autor;
alter table helena_v2.etapa add constraint ck_etapa_autor check (autor in ('HELENA', 'LAURA', 'AUGUSTO', 'MARINA', 'CAIO', 'CLARA', 'BIANCA', 'DANIEL', 'THEO', 'NINA', 'RAVI', 'MAYA', 'BRUNO', 'OLIVIA', 'VICTOR', 'CAMILA', 'ISABELA', 'PEDRO', 'RENATA', 'JOANA', 'FELIPE'));

-- acao_externa
alter table helena_v2.acao_externa alter column estado set default 'PROPOSTA';
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_estado;
alter table helena_v2.acao_externa add constraint ck_acao_externa_estado check (estado in ('PROPOSTA', 'AUTORIZADA', 'EXECUTANDO_ACAO', 'INCERTA', 'EXECUTADA', 'FEITA_PELO_FUNDADOR', 'RECUSADA', 'EXPIRADA', 'FALHOU', 'NAO_CONFIRMADA', 'CANCELADA'));
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_regra01_dono_e_prazo;
alter table helena_v2.acao_externa add constraint ck_acao_externa_regra01_dono_e_prazo check (estado in ('CANCELADA', 'EXECUTADA', 'EXPIRADA', 'FALHOU', 'FEITA_PELO_FUNDADOR', 'NAO_CONFIRMADA', 'RECUSADA') or (dono is not null and prazo_ate is not null));
alter table helena_v2.acao_externa add column if not exists tem_ferramenta boolean not null default false;
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_ok_registrado;
alter table helena_v2.acao_externa add column if not exists ok_registrado integer not null default 0;
alter table helena_v2.acao_externa add constraint ck_acao_externa_ok_registrado check (ok_registrado between 0 and 1);
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_tentativas;
alter table helena_v2.acao_externa add column if not exists tentativas integer not null default 0;
alter table helena_v2.acao_externa add constraint ck_acao_externa_tentativas check (tentativas between 0 and 1);
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_lembretes;
alter table helena_v2.acao_externa add column if not exists lembretes integer not null default 0;
alter table helena_v2.acao_externa add constraint ck_acao_externa_lembretes check (lembretes between 0 and 2);
alter table helena_v2.acao_externa drop constraint if exists ck_acao_externa_fim;
alter table helena_v2.acao_externa add column if not exists fim text not null default 'NENHUM';
alter table helena_v2.acao_externa add constraint ck_acao_externa_fim check (fim in ('NENHUM', 'PAI', 'PADRAO', 'FUNDADOR', 'FALHA'));

create or replace function helena_v2.guarda(p_id text, v jsonb, q jsonb)
returns boolean language plpgsql immutable
set search_path = helena_v2, pg_catalog, pg_temp
as $guarda$
begin
  -- Gerada de passagens.yaml (guardas Python restritas traduzidas com ast). v = variáveis, q = ficha, predicados e parâmetros.
  case p_id
    -- pedido_grande
    when 'C01' then return coalesce((q->>'pedido_grande')::boolean, false);
    -- not pedido_grande
    when 'C02' then return coalesce((NOT (q->>'pedido_grande')::boolean), false);
    -- falhas_helena < TETO_FALHAS_HELENA - 1
    when 'C03' then return coalesce(((v->>'falhas_helena')::integer < (2 - 1)), false);
    -- falhas_helena >= TETO_FALHAS_HELENA - 1
    when 'C04' then return coalesce(((v->>'falhas_helena')::integer >= (2 - 1)), false);
    -- opcao == 'CONFIRMO' and motivo in ('NENHUM', 'HELENA_FALHOU')
    when 'C06' then return coalesce((((q->>'opcao') = 'CONFIRMO') AND ((v->>'motivo') IN ('NENHUM', 'HELENA_FALHOU'))), false);
    -- lembretes == 0
    when 'C07' then return coalesce(((v->>'lembretes')::integer = 0), false);
    -- lembretes == 1
    when 'C08' then return coalesce(((v->>'lembretes')::integer = 1), false);
    -- lembretes >= TETO_LEMBRETES
    when 'C09' then return coalesce(((v->>'lembretes')::integer >= 2), false);
    -- validacoes < TETO_VALIDACAO_PLANO - 1
    when 'C30' then return coalesce(((v->>'validacoes')::integer < (2 - 1)), false);
    -- validacoes >= TETO_VALIDACAO_PLANO - 1
    when 'C31' then return coalesce(((v->>'validacoes')::integer >= (2 - 1)), false);
    -- opcao == 'CONFIRMO' and motivo == 'VALIDADOR_FALHOU' and ordens < TETO_ORDENS
    when 'C32' then return coalesce((((q->>'opcao') = 'CONFIRMO') AND ((v->>'motivo') = 'VALIDADOR_FALHOU') AND ((v->>'ordens')::integer < 3)), false);
    -- opcao == 'CONFIRMO' and motivo == 'VALIDADOR_FALHOU' and ordens >= TETO_ORDENS
    when 'C33' then return coalesce((((q->>'opcao') = 'CONFIRMO') AND ((v->>'motivo') = 'VALIDADOR_FALHOU') AND ((v->>'ordens')::integer >= 3)), false);
    -- todas_prontas
    when 'C12' then return coalesce((q->>'todas_prontas')::boolean, false);
    -- falha_sem_decisao
    when 'C13' then return coalesce((q->>'falha_sem_decisao')::boolean, false);
    -- nao_pode_sem_decisao and not falha_sem_decisao
    when 'C14' then return coalesce(((q->>'nao_pode_sem_decisao')::boolean AND (NOT (q->>'falha_sem_decisao')::boolean)), false);
    -- (motivo == 'NAO_PODE' and not nao_pode_sem_decisao) or (motivo == 'DEPENDENCIA' and not falha_sem_decisao)
    when 'C27' then return coalesce(((((v->>'motivo') = 'NAO_PODE') AND (NOT (q->>'nao_pode_sem_decisao')::boolean)) OR (((v->>'motivo') = 'DEPENDENCIA') AND (NOT (q->>'falha_sem_decisao')::boolean))), false);
    -- ordens < TETO_ORDENS
    when 'C16' then return coalesce(((v->>'ordens')::integer < 3), false);
    -- ordens >= TETO_ORDENS
    when 'C17' then return coalesce(((v->>'ordens')::integer >= 3), false);
    -- motivo == 'DEPENDENCIA' and opcao == 'PULAR' and falhas_pulaveis
    when 'C18' then return coalesce((((v->>'motivo') = 'DEPENDENCIA') AND ((q->>'opcao') = 'PULAR') AND (q->>'falhas_pulaveis')::boolean), false);
    -- motivo == 'DEPENDENCIA' and opcao == 'REFAZER' and ordens < TETO_ORDENS
    when 'C19' then return coalesce((((v->>'motivo') = 'DEPENDENCIA') AND ((q->>'opcao') = 'REFAZER') AND ((v->>'ordens')::integer < 3)), false);
    -- motivo == 'NAO_PODE' and opcao == 'REFAZER' and ordens < TETO_ORDENS
    when 'C20' then return coalesce((((v->>'motivo') = 'NAO_PODE') AND ((q->>'opcao') = 'REFAZER') AND ((v->>'ordens')::integer < 3)), false);
    -- motivo in ('DEPENDENCIA', 'NAO_PODE') and opcao == 'REFAZER' and ordens >= TETO_ORDENS
    when 'C29' then return coalesce((((v->>'motivo') IN ('DEPENDENCIA', 'NAO_PODE')) AND ((q->>'opcao') = 'REFAZER') AND ((v->>'ordens')::integer >= 3)), false);
    -- opcao == 'ENCERRAR'
    when 'C21' then return coalesce(((q->>'opcao') = 'ENCERRAR'), false);
    -- nivel_prazo < 1
    when 'C23' then return coalesce(((v->>'nivel_prazo')::integer < 1), false);
    -- nivel_prazo < 2
    when 'C24' then return coalesce(((v->>'nivel_prazo')::integer < 2), false);
    -- nivel_prazo < 3
    when 'C25' then return coalesce(((v->>'nivel_prazo')::integer < 3), false);
    -- mudancas_prazo < TETO_MUDANCAS_PRAZO
    when 'C26' then return coalesce(((v->>'mudancas_prazo')::integer < 3), false);
    -- anteriores_satisfeitas
    when 'E01' then return coalesce((q->>'anteriores_satisfeitas')::boolean, false);
    -- motivo == 'NORMAL' and execucoes < TETO_EXECUCOES
    when 'E10' then return coalesce((((v->>'motivo') = 'NORMAL') AND ((v->>'execucoes')::integer < 6)), false);
    -- execucoes >= TETO_EXECUCOES
    when 'E11' then return coalesce(((v->>'execucoes')::integer >= 6), false);
    -- motivo == 'NORMAL' and infra < TETO_INFRA - 1
    when 'E12' then return coalesce((((v->>'motivo') = 'NORMAL') AND ((v->>'infra')::integer < (3 - 1))), false);
    -- motivo == 'NORMAL' and infra >= TETO_INFRA - 1
    when 'E13' then return coalesce((((v->>'motivo') = 'NORMAL') AND ((v->>'infra')::integer >= (3 - 1))), false);
    -- motivo == 'CAPACIDADE'
    when 'E14' then return coalesce(((v->>'motivo') = 'CAPACIDADE'), false);
    -- motivo == 'CAPACIDADE' and aviso < TETO_AVISO_ESPERA
    when 'E15' then return coalesce((((v->>'motivo') = 'CAPACIDADE') AND ((v->>'aviso')::integer < 1)), false);
    -- motivo == 'CAPACIDADE' and aviso >= TETO_AVISO_ESPERA
    when 'E16' then return coalesce((((v->>'motivo') = 'CAPACIDADE') AND ((v->>'aviso')::integer >= 1)), false);
    -- parecer == 'OK' or julgadora
    when 'E20' then return coalesce((((q->>'parecer') = 'OK') OR (q->>'julgadora')::boolean), false);
    -- (leu_internet == 0 or not tem_internet) and usou_internet == 'NAO' and permite_perguntar and perguntas < TETO_PERGUNTAS and not prazo_de_terceiro
    when 'E21' then return coalesce(((((v->>'leu_internet')::integer = 0) OR (NOT (q->>'tem_internet')::boolean)) AND ((q->>'usou_internet') = 'NAO') AND (q->>'permite_perguntar')::boolean AND ((v->>'perguntas')::integer < 2) AND (NOT (q->>'prazo_de_terceiro')::boolean)), false);
    -- (leu_internet == 0 or not tem_internet) and usou_internet == 'NAO' and permite_perguntar and perguntas < TETO_PERGUNTAS and prazo_de_terceiro
    when 'E120' then return coalesce(((((v->>'leu_internet')::integer = 0) OR (NOT (q->>'tem_internet')::boolean)) AND ((q->>'usou_internet') = 'NAO') AND (q->>'permite_perguntar')::boolean AND ((v->>'perguntas')::integer < 2) AND (q->>'prazo_de_terceiro')::boolean), false);
    -- (leu_internet == 0 or not tem_internet) and usou_internet == 'NAO' and permite_devolver
    when 'E22' then return coalesce(((((v->>'leu_internet')::integer = 0) OR (NOT (q->>'tem_internet')::boolean)) AND ((q->>'usou_internet') = 'NAO') AND (q->>'permite_devolver')::boolean), false);
    -- classe == 'FORMATO_ERRADO' and formato < TETO_FORMATO and tem_internet
    when 'E24' then return coalesce((((q->>'classe') = 'FORMATO_ERRADO') AND ((v->>'formato')::integer < 1) AND (q->>'tem_internet')::boolean), false);
    -- classe == 'FORMATO_ERRADO' and formato < TETO_FORMATO and not tem_internet
    when 'E121' then return coalesce((((q->>'classe') = 'FORMATO_ERRADO') AND ((v->>'formato')::integer < 1) AND (NOT (q->>'tem_internet')::boolean)), false);
    -- classe == 'FORMATO_ERRADO' and formato >= TETO_FORMATO
    when 'E25' then return coalesce((((q->>'classe') = 'FORMATO_ERRADO') AND ((v->>'formato')::integer >= 1)), false);
    -- classe == 'LIMITE_CHAMADAS' and chamadas < TETO_CHAMADAS
    when 'E26' then return coalesce((((q->>'classe') = 'LIMITE_CHAMADAS') AND ((v->>'chamadas')::integer < 1)), false);
    -- classe == 'LIMITE_CHAMADAS' and chamadas >= TETO_CHAMADAS
    when 'E27' then return coalesce((((q->>'classe') = 'LIMITE_CHAMADAS') AND ((v->>'chamadas')::integer >= 1)), false);
    -- classe in ('GRANDE_DEMAIS', 'SITE', 'DESCONHECIDA')
    when 'E28' then return coalesce(((q->>'classe') IN ('GRANDE_DEMAIS', 'SITE', 'DESCONHECIDA')), false);
    -- tempo < TETO_TEMPO
    when 'E29' then return coalesce(((v->>'tempo')::integer < 1), false);
    -- tempo >= TETO_TEMPO
    when 'E30' then return coalesce(((v->>'tempo')::integer >= 1), false);
    -- classe in ('PROVEDOR', 'QUEDA', 'FERRAMENTA') and infra < TETO_INFRA - 1
    when 'E31' then return coalesce((((q->>'classe') IN ('PROVEDOR', 'QUEDA', 'FERRAMENTA')) AND ((v->>'infra')::integer < (3 - 1))), false);
    -- classe in ('COTA', 'LOGIN', 'BANCO') and infra < TETO_INFRA - 1
    when 'E32' then return coalesce((((q->>'classe') IN ('COTA', 'LOGIN', 'BANCO')) AND ((v->>'infra')::integer < (3 - 1))), false);
    -- infra >= TETO_INFRA - 1
    when 'E33' then return coalesce(((v->>'infra')::integer >= (3 - 1)), false);
    -- infra < TETO_INFRA - 1
    when 'E34' then return coalesce(((v->>'infra')::integer < (3 - 1)), false);
    -- infra >= TETO_INFRA - 1
    when 'E35' then return coalesce(((v->>'infra')::integer >= (3 - 1)), false);
    -- revisor_valido and escolhido != 'FUNDADOR'
    when 'E40' then return coalesce(((q->>'revisor_valido')::boolean AND ((q->>'escolhido') <> 'FUNDADOR')), false);
    -- revisor_valido and escolhido == 'FUNDADOR'
    when 'E41' then return coalesce(((q->>'revisor_valido')::boolean AND ((q->>'escolhido') = 'FUNDADOR')), false);
    -- infra < TETO_INFRA - 1
    when 'E47' then return coalesce(((v->>'infra')::integer < (3 - 1)), false);
    -- infra >= TETO_INFRA - 1
    when 'E48' then return coalesce(((v->>'infra')::integer >= (3 - 1)), false);
    -- infra < TETO_INFRA - 1
    when 'E49' then return coalesce(((v->>'infra')::integer < (3 - 1)), false);
    -- infra >= TETO_INFRA - 1
    when 'E42' then return coalesce(((v->>'infra')::integer >= (3 - 1)), false);
    -- exec_viva == 0 and execucoes < TETO_EXECUCOES
    when 'E50' then return coalesce((((v->>'exec_viva')::integer = 0) AND ((v->>'execucoes')::integer < 6)), false);
    -- exec_viva == 0 and execucoes >= TETO_EXECUCOES
    when 'E51' then return coalesce((((v->>'exec_viva')::integer = 0) AND ((v->>'execucoes')::integer >= 6)), false);
    -- exec_viva == 0 and infra < TETO_INFRA - 1
    when 'E52' then return coalesce((((v->>'exec_viva')::integer = 0) AND ((v->>'infra')::integer < (3 - 1))), false);
    -- exec_viva == 0 and infra >= TETO_INFRA - 1
    when 'E53' then return coalesce((((v->>'exec_viva')::integer = 0) AND ((v->>'infra')::integer >= (3 - 1))), false);
    -- exec_viva == 1 and not julgadora
    when 'E54' then return coalesce((((v->>'exec_viva')::integer = 1) AND (NOT (q->>'julgadora')::boolean)), false);
    -- exec_viva == 1 and julgadora
    when 'E74' then return coalesce((((v->>'exec_viva')::integer = 1) AND (q->>'julgadora')::boolean), false);
    -- exec_viva == 1 and reprovacoes < TETO_REPROVACOES
    when 'E57' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'reprovacoes')::integer < 2)), false);
    -- exec_viva == 1 and reprovacoes >= TETO_REPROVACOES
    when 'E58' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'reprovacoes')::integer >= 2)), false);
    -- exec_viva == 1
    when 'E59' then return coalesce(((v->>'exec_viva')::integer = 1), false);
    -- exec_viva == 1 and classe == 'FORMATO_ERRADO' and formato < TETO_FORMATO
    when 'E60' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((q->>'classe') = 'FORMATO_ERRADO') AND ((v->>'formato')::integer < 1)), false);
    -- exec_viva == 1 and classe == 'FORMATO_ERRADO' and formato >= TETO_FORMATO
    when 'E61' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((q->>'classe') = 'FORMATO_ERRADO') AND ((v->>'formato')::integer >= 1)), false);
    -- exec_viva == 1 and classe == 'LIMITE_CHAMADAS' and chamadas < TETO_CHAMADAS
    when 'E62' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((q->>'classe') = 'LIMITE_CHAMADAS') AND ((v->>'chamadas')::integer < 1)), false);
    -- exec_viva == 1 and classe == 'LIMITE_CHAMADAS' and chamadas >= TETO_CHAMADAS
    when 'E63' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((q->>'classe') = 'LIMITE_CHAMADAS') AND ((v->>'chamadas')::integer >= 1)), false);
    -- exec_viva == 1 and classe in ('GRANDE_DEMAIS', 'SITE', 'DESCONHECIDA')
    when 'E64' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((q->>'classe') IN ('GRANDE_DEMAIS', 'SITE', 'DESCONHECIDA'))), false);
    -- exec_viva == 1 and tempo < TETO_TEMPO
    when 'E65' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'tempo')::integer < 1)), false);
    -- exec_viva == 1 and tempo >= TETO_TEMPO
    when 'E66' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'tempo')::integer >= 1)), false);
    -- exec_viva == 1 and infra < TETO_INFRA - 1
    when 'E67' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'infra')::integer < (3 - 1))), false);
    -- exec_viva == 1 and infra >= TETO_INFRA - 1
    when 'E68' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'infra')::integer >= (3 - 1))), false);
    -- exec_viva == 1 and infra < TETO_INFRA - 1
    when 'E69' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'infra')::integer < (3 - 1))), false);
    -- exec_viva == 1 and infra >= TETO_INFRA - 1
    when 'E70' then return coalesce((((v->>'exec_viva')::integer = 1) AND ((v->>'infra')::integer >= (3 - 1))), false);
    -- motivo == 'PERGUNTA' and opcao in ('RESPOSTA_A', 'RESPOSTA_B', 'RESPOSTA_C')
    when 'E80' then return coalesce((((v->>'motivo') = 'PERGUNTA') AND ((q->>'opcao') IN ('RESPOSTA_A', 'RESPOSTA_B', 'RESPOSTA_C'))), false);
    -- motivo == 'REVISAO' and not (julgadora and semaforo == 'AJUSTE')
    when 'E81' then return coalesce((((v->>'motivo') = 'REVISAO') AND (NOT ((q->>'julgadora')::boolean AND ((v->>'semaforo') = 'AJUSTE')))), false);
    -- motivo == 'REVISAO' and julgadora and semaforo == 'AJUSTE' and voltas < TETO_VOLTAS_JURIDICO
    when 'E82' then return coalesce((((v->>'motivo') = 'REVISAO') AND (q->>'julgadora')::boolean AND ((v->>'semaforo') = 'AJUSTE') AND ((v->>'voltas')::integer < 2)), false);
    -- motivo == 'REVISAO' and julgadora and semaforo == 'AJUSTE' and voltas >= TETO_VOLTAS_JURIDICO
    when 'E83' then return coalesce((((v->>'motivo') = 'REVISAO') AND (q->>'julgadora')::boolean AND ((v->>'semaforo') = 'AJUSTE') AND ((v->>'voltas')::integer >= 2)), false);
    -- motivo == 'REVISAO' and ordens < TETO_ORDENS
    when 'E84' then return coalesce((((v->>'motivo') = 'REVISAO') AND ((v->>'ordens')::integer < 3)), false);
    -- motivo == 'REVISAO' and ordens >= TETO_ORDENS
    when 'E96' then return coalesce((((v->>'motivo') = 'REVISAO') AND ((v->>'ordens')::integer >= 3)), false);
    -- motivo == 'RESOLUCAO' and opcao == 'REFAZER' and replan < TETO_REPLANEJAMENTO and ordens < TETO_ORDENS
    when 'E85' then return coalesce((((v->>'motivo') = 'RESOLUCAO') AND ((q->>'opcao') = 'REFAZER') AND ((v->>'replan')::integer < 1) AND ((v->>'ordens')::integer < 3)), false);
    -- motivo == 'RESOLUCAO' and opcao == 'REFAZER' and (replan >= TETO_REPLANEJAMENTO or ordens >= TETO_ORDENS)
    when 'E97' then return coalesce((((v->>'motivo') = 'RESOLUCAO') AND ((q->>'opcao') = 'REFAZER') AND (((v->>'replan')::integer >= 1) OR ((v->>'ordens')::integer >= 3))), false);
    -- motivo == 'RESOLUCAO' and opcao == 'SEGUIR_SEM' and pulavel
    when 'E86' then return coalesce((((v->>'motivo') = 'RESOLUCAO') AND ((q->>'opcao') = 'SEGUIR_SEM') AND (q->>'pulavel')::boolean), false);
    -- motivo in ('RESOLUCAO', 'INFRA') and opcao == 'ENCERRAR'
    when 'E87' then return coalesce((((v->>'motivo') IN ('RESOLUCAO', 'INFRA')) AND ((q->>'opcao') = 'ENCERRAR')), false);
    -- motivo == 'INFRA' and opcao in ('ESPERAR', 'MODELO_MENOR') and ordens < TETO_ORDENS
    when 'E88' then return coalesce((((v->>'motivo') = 'INFRA') AND ((q->>'opcao') IN ('ESPERAR', 'MODELO_MENOR')) AND ((v->>'ordens')::integer < 3)), false);
    -- motivo == 'INFRA' and opcao in ('ESPERAR', 'MODELO_MENOR') and ordens >= TETO_ORDENS
    when 'E98' then return coalesce((((v->>'motivo') = 'INFRA') AND ((q->>'opcao') IN ('ESPERAR', 'MODELO_MENOR')) AND ((v->>'ordens')::integer >= 3)), false);
    -- espera in ('INTERNA', 'EXTERNA') and lembretes == 0
    when 'E89' then return coalesce((((v->>'espera') IN ('INTERNA', 'EXTERNA')) AND ((v->>'lembretes')::integer = 0)), false);
    -- espera == 'INTERNA' and lembretes == 1
    when 'E90' then return coalesce((((v->>'espera') = 'INTERNA') AND ((v->>'lembretes')::integer = 1)), false);
    -- (espera == 'INTERNA' and lembretes >= TETO_LEMBRETES) or (espera == 'EXTERNA' and lembretes >= 1)
    when 'E91' then return coalesce(((((v->>'espera') = 'INTERNA') AND ((v->>'lembretes')::integer >= 2)) OR (((v->>'espera') = 'EXTERNA') AND ((v->>'lembretes')::integer >= 1))), false);
    -- motivo == 'REVISAO'
    when 'E93' then return coalesce(((v->>'motivo') = 'REVISAO'), false);
    -- motivo != 'REVISAO'
    when 'E94' then return coalesce(((v->>'motivo') <> 'REVISAO'), false);
    -- motivo == 'INFRA' and infra < TETO_INFRA
    when 'E99' then return coalesce((((v->>'motivo') = 'INFRA') AND ((v->>'infra')::integer < 3)), false);
    -- (opcao != 'SEGUIR_SEM' or pulavel) and (opcao != 'REFAZER' or (replan < TETO_REPLANEJAMENTO and ordens < TETO_ORDENS))
    when 'E100' then return coalesce(((((q->>'opcao') <> 'SEGUIR_SEM') OR (q->>'pulavel')::boolean) AND (((q->>'opcao') <> 'REFAZER') OR (((v->>'replan')::integer < 1) AND ((v->>'ordens')::integer < 3)))), false);
    -- ordens < TETO_ORDENS
    when 'E111' then return coalesce(((v->>'ordens')::integer < 3), false);
    -- ordens >= TETO_ORDENS
    when 'E117' then return coalesce(((v->>'ordens')::integer >= 3), false);
    -- tem_ferramenta
    when 'X01' then return coalesce((q->>'tem_ferramenta')::boolean, false);
    -- opcao == 'FEITO_POR_MIM'
    when 'X02' then return coalesce(((q->>'opcao') = 'FEITO_POR_MIM'), false);
    -- lembretes == 0
    when 'X06' then return coalesce(((v->>'lembretes')::integer = 0), false);
    -- lembretes >= 1
    when 'X04' then return coalesce(((v->>'lembretes')::integer >= 1), false);
    -- ok_registrado == 1 and tentativas < TETO_EXECUCOES_ACAO
    when 'X10' then return coalesce((((v->>'ok_registrado')::integer = 1) AND ((v->>'tentativas')::integer < 1)), false);
    -- opcao == 'ACONTECEU'
    when 'X30' then return coalesce(((q->>'opcao') = 'ACONTECEU'), false);
    -- opcao == 'NAO_ACONTECEU'
    when 'X31' then return coalesce(((q->>'opcao') = 'NAO_ACONTECEU'), false);
    -- lembretes == 0
    when 'X32' then return coalesce(((v->>'lembretes')::integer = 0), false);
    -- lembretes == 1
    when 'X33' then return coalesce(((v->>'lembretes')::integer = 1), false);
    -- lembretes >= TETO_LEMBRETES
    when 'X34' then return coalesce(((v->>'lembretes')::integer >= 2), false);
    -- mudancas_prazo >= TETO_MUDANCAS_PRAZO
    when 'reacao_6' then return coalesce(((v->>'mudancas_prazo')::integer >= 3), false);
    else raise exception 'guarda desconhecida: %', p_id using errcode = 'P0001';
  end case;
end;
$guarda$;

create or replace function helena_v2.situacao_da_etapa(p_estado text, v jsonb)
returns text language sql immutable
set search_path = helena_v2, pg_catalog, pg_temp
as $situacao$
  -- Gerada de passagens.yaml (situacao_da_etapa): como o card enxerga cada etapa. A primeira regra que casa vale.
  select case
    when p_estado in ('AGUARDANDO_ANTERIORES') then 'ESPERA'
    when p_estado in ('NA_FILA', 'EXECUTANDO', 'VALIDACAO', 'REVISAO', 'ESPERANDO_FUNDADOR', 'EM_RESOLUCAO') then 'TRABALHO'
    when p_estado in ('APROVADA') and (v->>'semaforo') = 'NAO_PODE' then 'APROVADA_NAO_PODE'
    when p_estado in ('APROVADA') then 'APROVADA'
    when p_estado in ('PRONTA') then 'PRONTA'
    when p_estado in ('CANCELADA') and (v->>'fim') = 'PAI' then 'FIM_PAI'
    when p_estado in ('CANCELADA') and (v->>'fim') = 'SUBSTITUIDO' then 'FIM_PAI'
    when p_estado in ('CANCELADA') then 'FALHOU'
    when p_estado in ('ENCERRADA_COM_FALHA') and (v->>'fim') = 'PULADA' then 'PULADA'
    when p_estado in ('ENCERRADA_COM_FALHA') then 'ENCERROU'
    else null end;
$situacao$;

-- Sela a tabela: o banco calcula o hash das linhas gravadas (a função existe depois do 0003).
do $selar$
begin
  if to_regprocedure('helena_v2.selar_tabela()') is not null then
    perform helena_v2.selar_tabela();
  end if;
end;
$selar$;
select set_config('helena_v2.migrando', 'nao', false);

-- ===== 0003_funcao_unica.sql =====
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare d integer := coalesce(nullif(current_setting('helena_v2.profundidade', true), '')::integer, 0);
begin
  perform set_config('helena_v2.profundidade', (d + 1)::text, true);
  perform set_config('helena_v2.funcao_unica', 'sim', true);
end;
$f$;

create or replace function helena_v2._sair() returns void
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select case when coalesce(nullif(current_setting('role', true), ''), 'none') = 'none'
              then session_user::text else current_setting('role') end;
$f$;

create or replace function helena_v2._prazo_valido(p_prazo timestamptz) returns boolean
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select p_prazo is not null and isfinite(p_prazo)
     and p_prazo >= now() - interval '30 days'
     and p_prazo <= now() + interval '10 years';
$f$;

create or replace function helena_v2._conteudo_fundador_valido(p_evento text, p_conteudo jsonb) returns boolean
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare v_texto text;
begin
  if p_evento = 'MUDAR_PRAZO' then
    if jsonb_typeof(p_conteudo -> 'prazo') is distinct from 'string' then return false; end if;
    v_texto := p_conteudo ->> 'prazo';
    return helena_v2._prazo_valido(v_texto::timestamptz);
  elsif p_evento = 'MUDAR_PRIORIDADE' then
    if jsonb_typeof(p_conteudo -> 'prioridade') is null
       or jsonb_typeof(p_conteudo -> 'prioridade') not in ('string', 'number') then return false; end if;
    v_texto := p_conteudo ->> 'prioridade';
    if v_texto !~ '^-?[0-9]{1,10}$' then return false; end if;
    perform v_texto::integer;
  end if;
  return true;
exception when invalid_text_representation or invalid_datetime_format or numeric_value_out_of_range or datetime_field_overflow then
  return false;
end;
$f$;

-- A conta pode dizer que é este papel? Conta com linhas em conta_papel só diz o que está lá;
-- conta sem linhas só passa se for superusuária ou a dona do schema (é quem aplica as migrações).
create or replace function helena_v2._conferir_conta(p_papeis text[]) returns void
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare v_conta text := helena_v2._conta();
begin
  if v_conta = 'authenticated' and 'FUNDADOR' = any (p_papeis)
     and not helena_v2.sou_fundador() then
    raise exception 'FUNDADOR_NAO_AUTORIZADO' using errcode = '42501';
  end if;
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select coalesce(array_agg(situacao order by situacao), '{}'::text[]) from predicado_lista where nome = p_nome;
$f$;

-- Como o card enxerga a etapa: a situação do YAML, mais a marca "pulada" que só o fundador põe.
create or replace function helena_v2.situacao_efetiva(e helena_v2.etapa) returns text
language sql stable security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select case when s = any (helena_v2._lista_predicado('falha_que_pergunta')) and e.pulada then 'PULADA' else s end
  from (select helena_v2.situacao_da_etapa(e.estado, to_jsonb(e)) as s) x;
$f$;

create or replace function helena_v2._predicados_card(p_card uuid) returns jsonb
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select coalesce(bool_and(helena_v2.situacao_efetiva(d) = any (helena_v2._lista_predicado('satisfaz_dependencia'))), true)
  from etapa d where d.card_id = p_card and d.atual and d.codigo = any (p_depende);
$f$;

-- O que as guardas leem além das variáveis: a ficha da etapa, os predicados calculados e os parâmetros do evento.
create or replace function helena_v2._montar_q(p_maquina text, v jsonb, p_card uuid, p_params jsonb) returns jsonb
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select coalesce(jsonb_object_agg(nome, vc -> nome), '{}'::jsonb) from variavel where maquina = 'etapa' and compartilhada;
$f$;

-- Carrega o alvo: o card, o estado dele e as variáveis da máquina (a etapa enxerga os contadores compartilhados do card).
create or replace function helena_v2._carregar(p_maquina text, p_alvo uuid, out o_card uuid, out o_v jsonb, out o_vc jsonb)
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql immutable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select case d.dono when 'AUTOR' then v ->> 'autor'
                     when 'REVISOR' then nullif(v ->> 'revisor', 'NENHUM')
                     else d.dono end
  from estado_def d where d.maquina = p_maquina and d.estado = p_estado;
$f$;

-- Até quando vale o estado (regra 1). 'card' = o prazo do card; 'duracao' = o tempo escrito no YAML;
-- 'ficha' = o da ficha do agente (no roteiro da etapa); 'espera' = o que quem chama disser. Faltando, vale o prazo do card.
create or replace function helena_v2._prazo_ate(p_maquina text, p_estado text, v jsonb, p_card_prazo timestamptz, p_prazo_espera timestamptz)
returns timestamptz
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select estado from estado_def where maquina = p_maquina and inicial;
$f$;

-- Grava a linha inteira de volta (as colunas vêm do catálogo; v é o jsonb novo da linha).
create or replace function helena_v2._gravar(p_tabela text, p_id uuid, v jsonb) returns void
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language sql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select jsonb_build_object('estado', v -> 'estado', 'versao', v -> 'versao')
         || coalesce((select jsonb_object_agg(nome, v -> nome) from variavel where maquina = p_maquina), '{}'::jsonb)
         || case when p_maquina = 'etapa'
                 then coalesce((select jsonb_object_agg(nome, v -> nome) from variavel where maquina = 'card' and compartilhada), '{}'::jsonb)
                 else '{}'::jsonb end;
$f$;

-- ---------------------------------------------------------------------------- alvos dos sinais (provar: entregar)
create or replace function helena_v2._alvos_do_sinal(p_card uuid, p_alvo text, p_origem uuid) returns uuid[]
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
  if p_papel = 'FUNDADOR' and p_evento in ('MUDAR_PRAZO', 'MUDAR_PRIORIDADE')
     and not helena_v2._conteudo_fundador_valido(p_evento, p_conteudo) then
    v_motivo := 'CONTEUDO_INVALIDO';
  elsif not v_tem_vocab then
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
  if p_maquina in ('card', 'etapa') and v_tem_vocab and v_motivo <> 'CONTEUDO_INVALIDO' then
    select r.* into v_reacao from reacao r
    where r.papel = p_papel and r.evento = p_evento and r.maquina = p_maquina
      and (r.estados_tipo = 'TODOS'
           or (r.estados_tipo = 'ABERTOS' and exists (select 1 from estado_def d where d.maquina = p_maquina and d.estado = v ->> 'estado' and not d.final))
           or (r.estados_tipo = 'LISTA' and (v ->> 'estado') = any (r.estados)))
      and (r.guarda_id is null or helena_v2.guarda(r.guarda_id, v, '{}'::jsonb))
    order by r.ordem limit 1;
  end if;
  if v_motivo = 'CONTEUDO_INVALIDO' then
    v_resultado := 'RECUSADO';
  elsif v_reacao.ordem is not null then
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
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare c uuid; v jsonb; vc jsonb; q jsonb;
begin
  select o_card, o_v, o_vc into c, v, vc from helena_v2._carregar(p_maquina, p_alvo);
  q := helena_v2._montar_q(p_maquina, v, c, '{}'::jsonb);
  return helena_v2._achar_linha(p_maquina, p_papel, p_evento, v, q, '{}'::jsonb, null, null, null, vc ->> 'estado') is not null;
end;
$f$;

create or replace function helena_v2._automaticos(p_card uuid, p_nao_disparar text[], p_origem_id bigint) returns void
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  r jsonb;
  v_card uuid;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array[p_papel]);
  if p_prazo_espera is not null and not helena_v2._prazo_valido(p_prazo_espera) then
    raise exception 'PRAZO_ESPERA_INVALIDO' using errcode = '23514';
  end if;
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
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
  set constraints all immediate;
  set constraints all deferred;
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
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
  v_criado bigint;
  ve jsonb;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array['MOTOR', 'FUNDADOR']);
  if not helena_v2._prazo_valido(p_prazo) then
    raise exception 'PRAZO_INVALIDO' using errcode = '23514';
  end if;
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

  insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, parametros, conteudo, resultado, origem,
                         estado_depois, vars_depois, conta)
  values (v_card, 'card', v_card, 'card', 'MOTOR', 'CARD_CRIADO', jsonb_build_object('pedido_grande', p_pedido_grande),
          jsonb_build_object('canal', p_canal, 'numero', p_numero, 'titulo', p_titulo, 'prazo', p_prazo, 'empresa', p_empresa,
                             'prioridade', p_prioridade, 'ordem_de_servico', p_ordem_de_servico, 'roteiro', p_roteiro),
          'APLICADO', 'EXTERNO', v ->> 'estado', helena_v2._so_variaveis('card', v), helena_v2._conta())
  returning id into v_criado;

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
    select to_jsonb(x) into ve from etapa x where x.id = v_et;
    insert into historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, conteudo, resultado, origem, origem_id,
                           estado_depois, vars_depois, conta)
    values (v_card, 'etapa', v_et, e ->> 'id', 'MOTOR', 'ETAPA_CRIADA', e, 'APLICADO', 'SINAL', v_criado,
            ve ->> 'estado', helena_v2._so_variaveis('etapa', ve || helena_v2._compartilhadas(v)), helena_v2._conta());
  end loop;
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
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
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
language plpgsql set search_path = helena_v2, pg_catalog, pg_temp as $f$
begin
  if coalesce(current_setting('helena_v2.migrando', true), 'nao') <> 'sim' then
    raise exception 'só uma migração sela a tabela';
  end if;
  update meta_tabela set hash_das_linhas = helena_v2.calcular_hash_das_linhas();
end;
$f$;

create or replace function helena_v2.tabela_confere() returns boolean
language sql stable security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
  select coalesce((select hash_das_linhas = helena_v2.calcular_hash_das_linhas() from meta_tabela), false);
$f$;

-- ---------------------------------------------------------------------------- o histórico reconstrói o card? (regra 13)
-- Devolve uma linha por divergência: o estado ou o contador da tabela que não bate com a última linha do histórico.
create or replace function helena_v2.conferir_historico(p_card uuid)
returns table (alvo text, campo text, na_tabela text, no_historico text)
language plpgsql stable security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
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

-- ---------------------------------------------------------------------------- o vigia (só a conferência; quem chama a cada 5 minutos é o motor)
-- Uma linha por problema achado: a regra, o card e o que está errado. Vazio = tudo certo. Não muda nada.
create or replace function helena_v2.vigia()
returns table (regra text, card_id uuid, mensagem text)
language plpgsql stable security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  c record;
  d record;
  x record;
begin
  if not helena_v2.tabela_confere() then
    regra := 'TABELA'; card_id := null; mensagem := 'a tabela de passagens do banco não é a que foi selada na migração';
    return next;
  end if;
  for c in select id from card where estado not in (select estado from estado_def where maquina = 'card' and final) loop
    begin
      perform helena_v2.conferir_card(c.id);
    exception when others then
      regra := coalesce(substring(sqlerrm from 'REGRA ([0-9]+)'), 'ESTRUTURA'); card_id := c.id; mensagem := sqlerrm;
      return next;
    end;
  end loop;
  for d in select distinct h.card_id as id from historico h loop
    for x in select * from helena_v2.conferir_historico(d.id) loop
      regra := '13'; card_id := d.id;
      mensagem := 'alvo ' || x.alvo || ', campo ' || x.campo || ': tabela=' || coalesce(x.na_tabela, '-') || ' histórico=' || coalesce(x.no_historico, '-');
      return next;
    end loop;
  end loop;
end;
$f$;

-- ===== 0004_travas_e_permissoes.sql =====
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

-- ===== 0005_publicacao.sql =====
-- O que é: pedido de publicação da V2 e resposta durável do executor. Não publica nem chama serviços externos.
-- A pessoa do fundador é conferida no cadastro existente do app com o JWT autenticado.

create or replace function helena_v2.sou_fundador() returns boolean
language sql stable security definer set search_path = pg_catalog, pg_temp as $f$
  select helena_v2._conta() = 'authenticated'
     and auth.uid() is not null
     and exists (select 1 from public.app_access a
                 where a.user_id = auth.uid() and a.role = 'founder' and a.active = true);
$f$;

create table helena_v2.publicacoes (
  id bigint generated always as identity primary key,
  solicitado_por uuid not null,
  pedido_em timestamptz not null,
  dia_brasilia date not null unique
);
create index publicacoes_por_pessoa on helena_v2.publicacoes (solicitado_por, pedido_em desc);
alter table helena_v2.publicacoes enable row level security;
create policy publicacoes_do_fundador on helena_v2.publicacoes for select to authenticated
  using (solicitado_por = auth.uid() and helena_v2.sou_fundador());

create or replace function helena_v2.situacao_publicacao() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pedido jsonb;
begin
  if not helena_v2.sou_fundador() then
    return jsonb_build_object('fundador', false, 'dia_brasilia', v_dia, 'pedido', null);
  end if;
  select jsonb_build_object('id', p.id, 'pedido_em', p.pedido_em, 'dia_brasilia', p.dia_brasilia)
    into v_pedido from helena_v2.publicacoes p where p.dia_brasilia = v_dia;
  return jsonb_build_object('fundador', true, 'dia_brasilia', v_dia, 'pedido', v_pedido);
end;
$f$;

create or replace function helena_v2.pedir_publicacao() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_agora timestamptz := clock_timestamp();
  v_dia date := (v_agora at time zone 'America/Sao_Paulo')::date;
  v_pedido jsonb;
  v_novo boolean := false;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  insert into helena_v2.publicacoes (solicitado_por, pedido_em, dia_brasilia)
    values (auth.uid(), v_agora, v_dia) on conflict (dia_brasilia) do nothing;
  v_novo := found;
  select jsonb_build_object('id', p.id, 'pedido_em', p.pedido_em, 'dia_brasilia', p.dia_brasilia)
    into v_pedido from helena_v2.publicacoes p where p.dia_brasilia = v_dia;
  return jsonb_build_object('fundador', true, 'dia_brasilia', v_dia, 'pedido', v_pedido,
                            'ja_usado_hoje', not v_novo);
end;
$f$;

-- Só o fundador lê os dados que a tela do card consome; o motor conserva leitura pelo service_role.
alter table helena_v2.card enable row level security;
alter table helena_v2.etapa enable row level security;
alter table helena_v2.entrega enable row level security;
create policy card_fundador on helena_v2.card for select to authenticated using (helena_v2.sou_fundador());
create policy etapa_fundador on helena_v2.etapa for select to authenticated using (helena_v2.sou_fundador());
create policy entrega_fundador on helena_v2.entrega for select to authenticated using (helena_v2.sou_fundador());
create policy card_motor on helena_v2.card for select to service_role using (true);
create policy etapa_motor on helena_v2.etapa for select to service_role using (true);
create policy entrega_motor on helena_v2.entrega for select to service_role using (true);

-- Resposta gravada antes do portão 1. O número é a chave da execução, e o conteúdo é imutável.
create table helena_v2.resposta_execucao (
  numero bigint primary key references helena_v2.execucao(numero),
  resposta jsonb not null,
  gravada_em timestamptz not null default clock_timestamp()
);

create or replace function helena_v2.registrar_resposta_execucao(p_numero bigint, p_resposta jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if p_resposta is null then
    raise exception 'RESPOSTA_VAZIA' using errcode = '22023';
  end if;
  perform 1 from helena_v2.execucao x join helena_v2.etapa e on e.id = x.etapa_id
    where x.numero = p_numero and x.tipo in ('AUTOR', 'REVISOR') and x.estado = 'VIVA'
      and e.execucao_atual = x.numero
      and ((x.tipo = 'AUTOR' and e.estado = 'EXECUTANDO')
        or (x.tipo = 'REVISOR' and e.estado = 'REVISAO')) for update of x;
  if not found then
    raise exception 'EXECUCAO_NAO_ATUAL' using errcode = '42501';
  end if;
  insert into helena_v2.resposta_execucao (numero, resposta) values (p_numero, p_resposta)
    on conflict (numero) do nothing;
  select r.resposta into v_resposta from helena_v2.resposta_execucao r where r.numero = p_numero;
  if v_resposta is distinct from p_resposta then
    raise exception 'RESPOSTA_JA_REGISTRADA' using errcode = '42501';
  end if;
  return v_resposta;
end;
$f$;

create or replace function helena_v2.ler_resposta_execucao(p_numero bigint) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select r.resposta into v_resposta from helena_v2.resposta_execucao r where r.numero = p_numero;
  return v_resposta;
end;
$f$;

revoke all on helena_v2.publicacoes, helena_v2.resposta_execucao from public, anon, authenticated, service_role;
revoke all on function helena_v2.sou_fundador(), helena_v2.situacao_publicacao(),
  helena_v2.pedir_publicacao(), helena_v2.registrar_resposta_execucao(bigint,jsonb),
  helena_v2.ler_resposta_execucao(bigint) from public, anon, authenticated, service_role;
grant select on helena_v2.publicacoes to authenticated;
grant select on helena_v2.card, helena_v2.etapa, helena_v2.entrega to authenticated;
grant execute on function helena_v2.sou_fundador(), helena_v2.situacao_publicacao(),
  helena_v2.pedir_publicacao() to authenticated;
grant execute on function helena_v2.registrar_resposta_execucao(bigint,jsonb),
  helena_v2.ler_resposta_execucao(bigint) to service_role;

-- ===== 0006_configuracoes.sql =====
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

-- ===== 0007_pedidos_reais.sql =====
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

-- ===== 0008_resposta_coordenacao.sql =====
-- O QUE É: Resposta da coordenadora persistida antes de LER_DE_VOLTA. Nenhuma execução
-- externa é iniciada pelo banco; a transição continua em aplicar_evento.
create table helena_v2.resposta_coordenacao (
  numero bigint primary key references helena_v2.execucao(numero),
  resposta jsonb not null,
  gravada_em timestamptz not null default clock_timestamp()
);
create table helena_v2.resultado_coordenacao (
  numero bigint primary key references helena_v2.resposta_coordenacao(numero),
  resultado jsonb not null,
  historico_id bigint not null unique references helena_v2.historico(id),
  aplicada_em timestamptz not null default clock_timestamp()
);

create function helena_v2._coordenacao_imutavel() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'COORDENACAO_IMUTAVEL' using errcode = '42501';
end;
$f$;
create trigger resposta_coordenacao_imutavel before update or delete on helena_v2.resposta_coordenacao
  for each row execute function helena_v2._coordenacao_imutavel();
create trigger resposta_coordenacao_sem_truncate before truncate on helena_v2.resposta_coordenacao
  for each statement execute function helena_v2._coordenacao_imutavel();
create trigger resultado_coordenacao_imutavel before update or delete on helena_v2.resultado_coordenacao
  for each row execute function helena_v2._coordenacao_imutavel();
create trigger resultado_coordenacao_sem_truncate before truncate on helena_v2.resultado_coordenacao
  for each statement execute function helena_v2._coordenacao_imutavel();

-- O harness sintético instala 0008 sobre 0006. Na instalação real, 0007 já
-- existe e a solicitação consumida identifica o card mesmo se o modo sumir.
create function helena_v2._coordenacao_card_real(p_card_id uuid, p_ordem jsonb) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ligado boolean;
begin
  if p_ordem ->> 'modo_contexto' = 'real' then return true; end if;
  if to_regclass('helena_v2.solicitacao_card_real') is null then return false; end if;
  execute 'select exists(select 1 from helena_v2.solicitacao_card_real where card_id=$1)'
    into v_ligado using p_card_id;
  return v_ligado;
end;
$f$;

-- A porta geral de eventos continua autorizada para outras passagens. Em
-- cards reais, LER_DE_VOLTA só entra se a resposta da chave atual já está
-- persistida e se o histórico da própria transição contém o mesmo conteúdo.
create function helena_v2._coordenacao_proteger_leitura_real() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare v_resposta jsonb; v_conteudo jsonb;
begin
  if old.estado <> 'RASCUNHO'
     or current_setting('helena_v2.evento_atual',true) is distinct from 'LER_DE_VOLTA'
     or not helena_v2._coordenacao_card_real(old.id,old.ordem_de_servico) then
    return new;
  end if;
  if new.estado not in ('ESPERANDO_CONFIRMACAO','VALIDANDO_PLANO') then
    raise exception 'LER_DE_VOLTA_ESTADO_INESPERADO' using errcode = '23514';
  end if;
  select resposta into v_resposta from helena_v2.resposta_coordenacao
    where numero=old.chamada_helena for share;
  if v_resposta is null then
    raise exception 'RESPOSTA_COORDENACAO_AUSENTE' using errcode = '42501';
  end if;
  v_conteudo := jsonb_build_object('resposta',(v_resposta ->> 'texto')::jsonb);
  perform 1 from helena_v2.historico h where h.card_id=old.id and h.alvo_id=old.id
    and h.maquina='card' and h.papel='HELENA' and h.evento='LER_DE_VOLTA'
    and h.chave=old.chamada_helena and h.conteudo=v_conteudo and h.resultado='APLICADO';
  if not found then
    raise exception 'LER_DE_VOLTA_SEM_RESPOSTA_PERSISTIDA' using errcode = '42501';
  end if;
  perform helena_v2._real_conferir_card_vinculado(old.id);
  return new;
end;
$f$;
create trigger b_coordenacao_leitura_real before update on helena_v2.card
  for each row execute function helena_v2._coordenacao_proteger_leitura_real();

-- O card é travado antes de conferir/abrir a chamada. Repetir após queda
-- preserva a chave e a resposta já salva.
create function helena_v2.obter_chamada_coordenacao(p_card_id uuid) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare c helena_v2.card; v_num bigint;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=p_card_id for update;
  if c.id is null or c.estado <> 'RASCUNHO' then
    raise exception 'COORDENACAO_FORA_DO_RASCUNHO' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(p_card_id);
  end if;
  select x.numero into v_num from helena_v2.execucao x
    where x.numero=c.chamada_helena and x.card_id=c.id and x.etapa_id is null
      and x.tipo='HELENA' and x.estado='VIVA' for update;
  if v_num is not null then return v_num; end if;
  return helena_v2.abrir_chamada_helena('card',p_card_id);
end;
$f$;

create function helena_v2.ler_resposta_coordenacao(p_numero bigint) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select resposta into v_resposta from helena_v2.resposta_coordenacao where numero=p_numero;
  return v_resposta;
end;
$f$;

create function helena_v2.registrar_resposta_coordenacao(p_numero bigint, p_resposta jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare x helena_v2.execucao; c helena_v2.card; v_antiga jsonb; v_texto jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if jsonb_typeof(p_resposta) is distinct from 'object'
     or jsonb_typeof(p_resposta -> 'texto') is distinct from 'string'
     or btrim(p_resposta ->> 'texto') = ''
     or jsonb_typeof(p_resposta -> 'evidencias') is distinct from 'object'
     or jsonb_typeof(p_resposta -> 'config_revision_id') is distinct from 'string'
     or jsonb_typeof(p_resposta -> 'card_id') is distinct from 'string'
     or (p_resposta - 'texto' - 'evidencias' - 'config_revision_id' - 'card_id') <> '{}'::jsonb
     or octet_length(p_resposta::text) > 1000000 then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end if;
  begin
    v_texto := (p_resposta ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end;
  if jsonb_typeof(v_texto) is distinct from 'object' then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end if;
  select * into x from helena_v2.execucao where numero=p_numero;
  if x.numero is null or x.tipo <> 'HELENA' or x.etapa_id is not null then
    raise exception 'CHAMADA_COORDENACAO_INVALIDA' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=x.card_id for update;
  perform 1 from helena_v2.execucao where numero=p_numero for update;
  if p_resposta ->> 'card_id' is distinct from c.id::text
     or p_resposta ->> 'config_revision_id' is distinct from c.ordem_de_servico ->> 'config_revision_id' then
    raise exception 'RESPOSTA_COORDENACAO_SEM_PIN' using errcode = '42501';
  end if;
  select resposta into v_antiga from helena_v2.resposta_coordenacao where numero=p_numero for share;
  if found then
    if v_antiga is distinct from p_resposta then
      raise exception 'RESPOSTA_COORDENACAO_DIVERGENTE' using errcode = '23505';
    end if;
    return v_antiga;
  end if;
  if c.estado <> 'RASCUNHO' or c.chamada_helena is distinct from p_numero or x.estado <> 'VIVA' then
    raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(c.id);
  end if;
  insert into helena_v2.resposta_coordenacao(numero,resposta) values(p_numero,p_resposta);
  return p_resposta;
end;
$f$;

-- A resposta e o resultado pertencem à mesma chave. Se o commit ocorreu e o
-- checkpoint DBOS não, a repetição comprova o histórico e devolve o resultado.
create function helena_v2.aplicar_resposta_coordenacao(p_numero bigint) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare x helena_v2.execucao; c helena_v2.card; v_resposta jsonb; v_conteudo jsonb;
        v_resultado jsonb; v_hist bigint; v_salvo helena_v2.resultado_coordenacao;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into x from helena_v2.execucao where numero=p_numero;
  if x.numero is null or x.tipo <> 'HELENA' or x.etapa_id is not null then
    raise exception 'CHAMADA_COORDENACAO_INVALIDA' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=x.card_id for update;
  perform 1 from helena_v2.execucao where numero=p_numero for update;
  select resposta into v_resposta from helena_v2.resposta_coordenacao where numero=p_numero for share;
  if v_resposta is null then
    raise exception 'RESPOSTA_COORDENACAO_AUSENTE' using errcode = '42501';
  end if;
  v_conteudo := jsonb_build_object('resposta',(v_resposta ->> 'texto')::jsonb);
  select * into v_salvo from helena_v2.resultado_coordenacao where numero=p_numero for share;
  if found then
    perform 1 from helena_v2.historico h where h.id=v_salvo.historico_id
      and h.card_id=x.card_id and h.alvo_id=x.card_id and h.maquina='card'
      and h.papel='HELENA' and h.evento='LER_DE_VOLTA' and h.chave=p_numero
      and h.conteudo=v_conteudo and h.resultado=v_salvo.resultado ->> 'resultado';
    if not found then
      raise exception 'RESULTADO_COORDENACAO_SEM_HISTORICO' using errcode = '23514';
    end if;
    return v_salvo.resultado;
  end if;
  -- Outra chamada autorizada pode ter aplicado o mesmo evento após salvar a
  -- resposta, mas antes do wrapper gravar seu marcador. Recupera apenas se o
  -- histórico comprova card, chave, evento e conteúdo exatos.
  if c.estado <> 'RASCUNHO' then
    select h.id, jsonb_build_object('resultado',h.resultado,'linha',h.linha_id,
      'historico_id',h.id,'estado',h.estado_depois,'convertido_em',h.convertido_em)
      into v_hist,v_resultado from helena_v2.historico h
      where h.card_id=x.card_id and h.alvo_id=x.card_id and h.maquina='card'
        and h.papel='HELENA' and h.evento='LER_DE_VOLTA' and h.chave=p_numero
        and h.conteudo=v_conteudo and h.resultado in ('APLICADO','CONVERTIDO')
      order by h.id desc limit 1;
    if v_hist is null then
      raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
    end if;
    insert into helena_v2.resultado_coordenacao(numero,resultado,historico_id)
      values(p_numero,v_resultado,v_hist);
    return v_resultado;
  end if;
  if c.estado <> 'RASCUNHO' or c.chamada_helena is distinct from p_numero or x.estado <> 'VIVA'
     or v_resposta ->> 'card_id' is distinct from c.id::text
     or v_resposta ->> 'config_revision_id' is distinct from c.ordem_de_servico ->> 'config_revision_id' then
    raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(c.id);
  end if;
  v_resultado := helena_v2.aplicar_evento('card',c.id,'HELENA','LER_DE_VOLTA',
    '{}'::jsonb,null,p_numero,null,v_conteudo,null,true,array['PLANO_VALIDO']::text[]);
  if v_resultado ->> 'resultado' not in ('APLICADO','CONVERTIDO') then
    raise exception 'LER_DE_VOLTA_NAO_APLICADA' using errcode = '23514';
  end if;
  v_hist := (v_resultado ->> 'historico_id')::bigint;
  insert into helena_v2.resultado_coordenacao(numero,resultado,historico_id)
    values(p_numero,v_resultado,v_hist);
  return v_resultado;
end;
$f$;

revoke all on helena_v2.resposta_coordenacao, helena_v2.resultado_coordenacao
  from public,anon,authenticated,service_role;
revoke execute on function helena_v2._coordenacao_imutavel(),
  helena_v2._coordenacao_card_real(uuid,jsonb),
  helena_v2._coordenacao_proteger_leitura_real(),
  helena_v2.obter_chamada_coordenacao(uuid), helena_v2.ler_resposta_coordenacao(bigint),
  helena_v2.registrar_resposta_coordenacao(bigint,jsonb), helena_v2.aplicar_resposta_coordenacao(bigint)
  from public,anon,authenticated,service_role;
grant execute on function helena_v2.obter_chamada_coordenacao(uuid),
  helena_v2.ler_resposta_coordenacao(bigint), helena_v2.registrar_resposta_coordenacao(bigint,jsonb),
  helena_v2.aplicar_resposta_coordenacao(bigint) to service_role;

-- ===== 0009_confirmacao_real.sql =====
-- O QUE É: Escolhas autenticadas do fundador para o pedido real. A observação da
-- Management API permanece intacta; o banco revalida seus fatos sob locks.
-- Nenhuma URL é acessada por esta migração.
create or replace function helena_v2._real_confirmacao_valida(p_dados jsonb, p_prazo timestamptz)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare ordem jsonb := p_dados #> '{pedido,ordem_de_servico}';
  cs jsonb := ordem -> 'como_e_o_pronto'; rs jsonb := ordem -> 'nao_pode';
  fs jsonb := ordem -> 'fontes_que_pode_ler'; i integer; item jsonb; url text;
  host text; caminho text; texto_prazo text;
begin
  texto_prazo := ordem ->> 'prazo';
  if jsonb_typeof(ordem) is distinct from 'object'
     or texto_prazo is null or length(texto_prazo) not between 20 and 35
     or texto_prazo !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or texto_prazo::timestamptz is distinct from p_prazo
     or jsonb_typeof(cs) is distinct from 'array'
     or jsonb_typeof(rs) is distinct from 'array'
     or jsonb_typeof(fs) is distinct from 'array' then return false; end if;
  if jsonb_array_length(cs) not between 1 and 5
     or jsonb_array_length(rs) > 5 or jsonb_array_length(fs) > 20 then return false; end if;
  for i in 0..jsonb_array_length(cs)-1 loop
    item := cs -> i;
    if jsonb_typeof(item) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(item)) <> 4
       or item ->> 'id' is distinct from 'CARD-' || (i+1)::text
       or item ->> 'quem_confere' is distinct from 'IA'
       or coalesce(item ->> 'risco','') not in ('ALTO','BAIXO')
       or jsonb_typeof(item -> 'texto') is distinct from 'string'
       or length(btrim(item ->> 'texto')) not between 3 and 200
       or item ->> 'texto' is distinct from btrim(item ->> 'texto') then return false; end if;
  end loop;
  if (select count(distinct v ->> 'texto') from jsonb_array_elements(cs) as c(v))
     <> jsonb_array_length(cs) then return false; end if;
  for item in select value from jsonb_array_elements(rs) loop
    if jsonb_typeof(item) is distinct from 'string'
       or length(btrim(item #>> '{}')) not between 3 and 200
       or item #>> '{}' is distinct from btrim(item #>> '{}') then return false; end if;
    if (select count(*) from jsonb_array_elements(cs) as c(v)
        where c.v ->> 'texto' = item #>> '{}' and c.v ->> 'risco' = 'ALTO') <> 1
       then return false; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(rs)) <> jsonb_array_length(rs)
     then return false; end if;
  if (select count(distinct value) from jsonb_array_elements(fs)) <> jsonb_array_length(fs)
     then return false; end if;
  for item in select value from jsonb_array_elements(fs) loop
    if jsonb_typeof(item) is distinct from 'string' then return false; end if;
    url := item #>> '{}';
    if length(url) > 500 or octet_length(url) <> length(url) or position('%' in url) > 0
       or url !~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}/[^?#[:space:]\\]*$'
       then return false; end if;
    host := split_part(substr(url,9),'/',1);
    caminho := substr(url,9+length(host));
    if caminho !~ '^[A-Za-z0-9/._~:@!$&''()*+,;=-]*$'
       or caminho ~* '(^|[^a-z0-9])(confirmar|confirm|verificar|verify|aceitar|accept|convite|invite|indicacao|ref|descadastrar|unsubscribe|token|login|signin|signup|cadastro|register|checkout|pagar|pay)([^a-z0-9]|$)'
       or host in ('localhost','metadata','metadata.google.internal','instance-data','kubernetes.default')
       or host ~ '(\.localhost|\.local|\.internal|\.lan|\.home\.arpa|\.intranet|\.corp|\.private|\.svc|\.localdomain)$'
       or host ~ '^[0-9.]+$' then return false; end if;
  end loop;
  return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$f$;

create or replace function helena_v2._real_conferir_captura(p_tarefa_id text, p_plano jsonb, p_dados jsonb) returns jsonb
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
    'prazo',p_dados #> '{pedido,ordem_de_servico,prazo}',
    'prioridade_na_fonte',t -> 'prioridade',
    'definicao_de_pronto_na_fonte',t -> 'definicao_de_pronto',
    'fontes_que_pode_ler',p_dados #> '{pedido,ordem_de_servico,fontes_que_pode_ler}',
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

create or replace function helena_v2.solicitar_card_real(
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
  if p_prazo <= now() or p_prazo > now() + interval '10 years'
     or not helena_v2._real_confirmacao_valida(p_dados_reais,p_prazo) then
    raise exception 'CONFIRMACAO_REAL_INVALIDA' using errcode = '22023';
  end if;
  if p_config_revision_id is null then
    select ativa_id into p_config_revision_id from helena_v2.configuracao_ponteiro;
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

create or replace function helena_v2.consumir_solicitacao_card_real(p_id uuid,p_roteiro jsonb) returns jsonb
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
  if p.prazo <= now() or not helena_v2._real_confirmacao_valida(p.dados_reais,p.prazo) then
    raise exception 'CONFIRMACAO_REAL_INVALIDA' using errcode = '22023';
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

-- Card real antigo sem confirmação completa não é promovido silenciosamente:
-- exige nova solicitação autenticada. Cancelamento/falha não passa por este gate.
create or replace function helena_v2._real_conferir_card_vinculado(p_card_id uuid) returns boolean
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
  if not helena_v2._real_confirmacao_valida(p.dados_reais,p.prazo) then
    raise exception 'CARD_REAL_SEM_CONFIRMACAO' using errcode = '42501';
  end if;
  perform helena_v2._real_conferir_captura(p.chave_origem,p.plano,p.dados_reais);
  return true;
end;
$f$;

revoke execute on function helena_v2._real_confirmacao_valida(jsonb,timestamptz) from public,anon,authenticated,service_role;

-- ===== 0010_aprovacoes_fontes_reais.sql =====
-- O QUE É: revalidação de fontes nas aprovações positivas de card real.
-- Uma reação no card PRONTO não atualiza o card; a autorização de ação externa
-- também passa por outra máquina. O histórico intercepta ambos na transação.

create function helena_v2._real_proteger_aprovacao_fundador() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare v_ordem jsonb;
begin
  if new.papel is distinct from 'FUNDADOR' or new.evento is distinct from 'APROVAR'
     or new.resultado not in ('APLICADO', 'CONVERTIDO', 'REACAO') then
    return new;
  end if;

  -- Card final: reação sem UPDATE. Etapa: E81/E82/E83; ação: X01.
  if not ((new.maquina = 'card' and new.estado_antes = 'PRONTO'
           and new.resultado = 'REACAO')
          or (new.maquina = 'etapa' and new.resultado in ('APLICADO', 'CONVERTIDO'))
          or (new.maquina = 'acao_externa' and new.estado_antes = 'PROPOSTA'
              and new.estado_depois = 'AUTORIZADA'
              and new.resultado in ('APLICADO', 'CONVERTIDO'))) then
    return new;
  end if;

  select c.ordem_de_servico into v_ordem from helena_v2.card c where c.id=new.card_id;
  if v_ordem ->> 'modo_contexto' = 'real'
     or exists (select 1 from helena_v2.solicitacao_card_real s
                where s.card_id=new.card_id) then
    perform helena_v2._real_conferir_card_vinculado(new.card_id);
  end if;
  return new;
end;
$f$;

create trigger a_real_proteger_aprovacao_fundador
before insert on helena_v2.historico
for each row execute function helena_v2._real_proteger_aprovacao_fundador();

revoke execute on function helena_v2._real_proteger_aprovacao_fundador()
from public, anon, authenticated, service_role;

-- ===== 0011_lista_acoes_fundador.sql =====
-- O QUE É: projeção mínima das ações externas de um card para o fundador.
-- A tabela mantém SELECT direto fechado ao authenticated; a função não modifica ações.

create function helena_v2.listar_acoes_card(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_acoes jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_card_id is null then
    raise exception 'CARD_OBRIGATORIO' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'codigo', a.codigo, 'etapa_codigo', a.etapa_codigo,
      'tipo', a.tipo, 'estado', a.estado, 'dono', a.dono,
      'prazo_ate', a.prazo_ate, 'versao', a.versao,
      'tem_ferramenta', a.tem_ferramenta)
    order by a.criado_em, a.codigo), '[]'::jsonb)
    into v_acoes
    from helena_v2.acao_externa a where a.card_id = p_card_id;
  return v_acoes;
end;
$f$;

revoke execute on function helena_v2.listar_acoes_card(uuid)
from public, anon, authenticated, service_role;
grant execute on function helena_v2.listar_acoes_card(uuid) to authenticated;

-- ===== 0012_reacoes_fundador.sql =====
-- O QUE É: aplica versão vista e domínio do vocabulário também aos toques
-- do fundador sem passagem, antes de reação ou card ligado.
-- Redefine apenas a porta pública; a máquina gerada em 0003 permanece intacta.

create or replace function helena_v2.aplicar_evento(
  p_maquina text, p_alvo uuid, p_papel text, p_evento text,
  p_parametros jsonb default '{}'::jsonb, p_ator text default null,
  p_chave bigint default null, p_versao_vista integer default null,
  p_conteudo jsonb default null, p_toque text default null,
  p_automaticos boolean default true, p_nao_disparar text[] default '{}'::text[],
  p_prazo_espera timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  r jsonb;
  v_card uuid;
  v_alvo jsonb;
  v_dominio jsonb;
  v_regra jsonb;
  v_parametros jsonb := coalesce(p_parametros, '{}'::jsonb);
  v_versao_antiga boolean := false;
  v_parametros_invalidos boolean := false;
  v_resultado text;
  v_hist bigint;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array[p_papel]);
  if p_prazo_espera is not null and not helena_v2._prazo_valido(p_prazo_espera) then
    raise exception 'PRAZO_ESPERA_INVALIDO' using errcode = '23514';
  end if;

  if p_papel = 'FUNDADOR' and p_evento in ('APROVAR','PEDIR_AJUSTE','RESPONDER') then
    select o_card,o_v into v_card,v_alvo
      from helena_v2._carregar(p_maquina,p_alvo);
    perform 1 from helena_v2.card where id=v_card for update;
    select o_card,o_v into v_card,v_alvo
      from helena_v2._carregar(p_maquina,p_alvo);

    -- O toque já gravado é idempotente mesmo se a ficha ou o card mudou.
    if p_toque is null or not exists
        (select 1 from helena_v2.historico h
         where h.card_id=v_card and h.numero_toque=p_toque) then
      select valor into v_regra from helena_v2.regra_geral
        where chave='toques_do_fundador_exigem_versao_vista';
      if coalesce(v_regra ? p_evento,false) then
        v_versao_antiga := p_versao_vista is distinct from (v_alvo ->> 'versao')::integer;
      end if;

      select parametros into v_dominio from helena_v2.vocab_evento
        where papel=p_papel and evento=p_evento;
      if jsonb_typeof(v_dominio) is distinct from 'object'
         or jsonb_typeof(v_parametros) is distinct from 'object' then
        v_parametros_invalidos := true;
      else
        v_parametros_invalidos := exists (
          select 1 from jsonb_each(v_dominio) d
          where jsonb_typeof(d.value) is distinct from 'array'
             or not (v_parametros ? d.key)
             or jsonb_typeof(v_parametros -> d.key) is distinct from 'string'
             or not coalesce(d.value ? (v_parametros ->> d.key),false)
        ) or exists (
          select 1 from jsonb_object_keys(v_parametros) k(chave)
          where not (v_dominio ? k.chave)
        );
      end if;

      if v_versao_antiga or v_parametros_invalidos then
        select valor into v_regra from helena_v2.regra_geral
          where chave='recusa_do_fundador';
        v_resultado := case when v_versao_antiga then v_regra ->> 'versao_antiga'
                            else v_regra ->> 'aberto' end;
        if v_resultado is distinct from 'COMENTARIO_NO_CARD' then
          raise exception 'RECUSA_FUNDADOR_NAO_INERTE' using errcode='23514';
        end if;
        insert into helena_v2.historico
          (card_id,maquina,alvo_id,alvo_codigo,papel,evento,parametros,ator,chave,
           versao_vista,conteudo,resultado,motivo,origem,estado_antes,estado_depois,
           vars_antes,vars_depois,numero_toque,conta)
        values
          (v_card,p_maquina,p_alvo,
           case when p_maquina='card' then 'card' else v_alvo ->> 'codigo' end,
           p_papel,p_evento,v_parametros,p_ator,p_chave,p_versao_vista,p_conteudo,
           v_resultado,v_resultado,'EXTERNO',v_alvo ->> 'estado',v_alvo ->> 'estado',
           helena_v2._so_variaveis(p_maquina,v_alvo),
           helena_v2._so_variaveis(p_maquina,v_alvo),p_toque,helena_v2._conta())
        returning id into v_hist;
        r := jsonb_build_object('resultado',v_resultado,'historico_id',v_hist,'motivo',v_resultado);
      end if;
    end if;
  end if;

  if r is null then
    r := helena_v2._aplicar(p_maquina,p_alvo,p_papel,p_evento,p_parametros,p_ator,
                            p_chave,p_versao_vista,p_conteudo,'EXTERNO',null,p_toque,p_prazo_espera);
  end if;
  if p_automaticos and r ->> 'resultado' in ('APLICADO','CONVERTIDO') then
    select o_card into v_card from helena_v2._carregar(p_maquina,p_alvo);
    perform helena_v2._automaticos(v_card,p_nao_disparar,(r ->> 'historico_id')::bigint);
  end if;
  set constraints all immediate;
  set constraints all deferred;
  perform helena_v2._sair();
  return r;
end;
$f$;

-- ===== 0013_interacoes_fundador.sql =====
-- O QUE É: leitura mínima de um toque próprio e da pergunta atual ao fundador.
-- Não expõe histórico, resposta integral do agente nem dados de execução.

alter table helena_v2.historico add column solicitante_uid uuid;

create function helena_v2._vincular_toque_fundador() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if new.papel='FUNDADOR' and new.conta='authenticated' then
    if auth.uid() is null or not helena_v2.sou_fundador() then
      raise exception 'FUNDADOR_NAO_AUTORIZADO' using errcode='42501';
    end if;
    new.solicitante_uid := auth.uid();
  else
    new.solicitante_uid := null;
  end if;
  return new;
end;
$f$;

create trigger a0_vincular_toque_fundador
before insert on helena_v2.historico
for each row execute function helena_v2._vincular_toque_fundador();

create function helena_v2.consultar_toque_fundador(p_card_id uuid, p_toque text)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_linha jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  if p_card_id is null or p_toque is null or octet_length(p_toque) not between 1 and 200
     or btrim(p_toque)='' then
    raise exception 'TOQUE_INVALIDO' using errcode='22023';
  end if;
  select jsonb_build_object('historico_id',h.id,'resultado',h.resultado,
      'momento',h.momento,'maquina',h.maquina,'alvo_id',h.alvo_id,
      'evento',h.evento)
    into v_linha from helena_v2.historico h
    where h.card_id=p_card_id and h.numero_toque=p_toque
      and h.papel='FUNDADOR' and h.conta='authenticated'
      and h.solicitante_uid=auth.uid();
  return v_linha;
end;
$f$;

create function helena_v2.ler_pergunta_etapa_fundador(p_etapa_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  e helena_v2.etapa;
  h helena_v2.historico;
  v_resposta jsonb;
  v_salva jsonb;
  v_texto jsonb;
  v_opcoes jsonb;
  v_total integer;
  v_validas boolean;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  select * into e from helena_v2.etapa where id=p_etapa_id
    and atual and estado='ESPERANDO_FUNDADOR' and motivo='PERGUNTA';
  if not found then return null; end if;

  -- Última transição efetiva da etapa deve ser a pergunta desta geração.
  select * into h from helena_v2.historico
    where card_id=e.card_id and maquina='etapa' and alvo_id=e.id
      and resultado in ('APLICADO','CONVERTIDO')
      and estado_antes is distinct from estado_depois
    order by id desc limit 1;
  if h.id is null or h.papel is distinct from 'AUTOR'
     or h.evento is distinct from 'PERGUNTAR'
     or (h.linha_id is distinct from 'E21' and h.linha_id is distinct from 'E120')
     or h.resultado is distinct from 'APLICADO'
     or h.estado_depois is distinct from 'ESPERANDO_FUNDADOR'
     or h.chave is null
     or not exists (select 1 from helena_v2.execucao x
                    where x.numero=h.chave and x.card_id=e.card_id
                      and x.etapa_id=e.id and x.tipo='AUTOR'
                      and x.estado='RESPONDIDA') then
    return null;
  end if;

  v_resposta := h.conteudo -> 'resposta';
  select resposta into v_salva from helena_v2.resposta_execucao
    where numero=h.chave;
  if jsonb_typeof(v_salva) is distinct from 'object'
     or jsonb_typeof(v_salva -> 'texto') is distinct from 'string'
     or jsonb_typeof(v_salva -> 'config_revision_id') is distinct from 'string'
     or v_salva ->> 'config_revision_id' is distinct from
        (select c.ordem_de_servico ->> 'config_revision_id'
         from helena_v2.card c where c.id=e.card_id) then
    return null;
  end if;
  begin
    v_texto := (v_salva ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    return null;
  end;
  if v_texto is distinct from v_resposta then return null; end if;
  if jsonb_typeof(v_resposta) is distinct from 'object'
     or v_resposta ->> 'acao' is distinct from 'PERGUNTAR'
     or jsonb_typeof(v_resposta -> 'pergunta') is distinct from 'string'
     or char_length(btrim(v_resposta ->> 'pergunta')) not between 10 and 300
     or jsonb_typeof(v_resposta -> 'opcoes') is distinct from 'array' then
    return null;
  end if;
  select count(*),bool_and(coalesce(
      jsonb_typeof(o.valor)='object'
      and jsonb_typeof(o.valor -> 'letra')='string'
      and o.valor ->> 'letra'=substr('ABC',o.ord::integer,1)
      and jsonb_typeof(o.valor -> 'texto')='string'
      and char_length(btrim(o.valor ->> 'texto')) between 1 and 500
      and jsonb_typeof(o.valor -> 'consequencia')='string'
      and char_length(btrim(o.valor ->> 'consequencia')) between 1 and 500,false)),
      jsonb_agg(jsonb_build_object('letra',o.valor ->> 'letra',
          'texto',o.valor ->> 'texto',
          'consequencia',o.valor ->> 'consequencia') order by o.ord)
    into v_total,v_validas,v_opcoes
    from jsonb_array_elements(v_resposta -> 'opcoes') with ordinality o(valor,ord);
  if v_total not between 2 and 3 or v_validas is distinct from true then
    return null;
  end if;
  return jsonb_build_object('card_id',e.card_id,'etapa_id',e.id,
    'versao',e.versao,'chave',h.chave,'historico_id',h.id,
    'pergunta',v_resposta ->> 'pergunta','opcoes',v_opcoes);
end;
$f$;

revoke execute on function helena_v2._vincular_toque_fundador(),
  helena_v2.consultar_toque_fundador(uuid,text),
  helena_v2.ler_pergunta_etapa_fundador(uuid)
from public,anon,authenticated,service_role;
grant execute on function helena_v2.consultar_toque_fundador(uuid,text),
  helena_v2.ler_pergunta_etapa_fundador(uuid) to authenticated;

-- ===== 0014_leitura_card_fundador.sql =====
-- O QUE É: leitura de volta aplicada e durável, projetada para confirmação.
-- A chave vem do histórico C01, pois chamada_helena é limpa após aplicar.

create function helena_v2.ler_leitura_card_fundador(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  c helena_v2.card;
  h helena_v2.historico;
  v_salva jsonb;
  v_resultado jsonb;
  v_texto jsonb;
  v_entendi jsonb;
  v_pronto jsonb;
  v_nao_pode jsonb;
  v_leitura jsonb;
  v_escolha jsonb;
  v_total integer;
  v_validos boolean;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  select * into c from helena_v2.card where id=p_card_id;
  if c.id is null or c.estado is distinct from 'ESPERANDO_CONFIRMACAO'
     or (c.motivo is distinct from 'NENHUM'
         and c.motivo is distinct from 'VALIDADOR_FALHOU') then
    return null;
  end if;

  select * into h from helena_v2.historico
    where card_id=c.id and maquina='card' and alvo_id=c.id
      and papel='HELENA' and evento='LER_DE_VOLTA'
      and linha_id='C01' and resultado='APLICADO'
      and estado_antes='RASCUNHO' and estado_depois='ESPERANDO_CONFIRMACAO'
    order by id desc limit 1;
  if h.id is null or h.chave is null then return null; end if;
  select s.resposta,r.resultado into v_salva,v_resultado
    from helena_v2.resultado_coordenacao r
    join helena_v2.resposta_coordenacao s on s.numero=r.numero
    join helena_v2.execucao x on x.numero=r.numero
    where r.numero=h.chave and r.historico_id=h.id
      and x.card_id=c.id and x.etapa_id is null
      and x.tipo='HELENA' and x.estado='RESPONDIDA';
  if jsonb_typeof(v_salva) is distinct from 'object'
     or jsonb_typeof(v_salva -> 'texto') is distinct from 'string'
     or jsonb_typeof(v_salva -> 'config_revision_id') is distinct from 'string'
     or v_salva ->> 'card_id' is distinct from c.id::text
     or v_salva ->> 'config_revision_id' is distinct from
        c.ordem_de_servico ->> 'config_revision_id'
     or v_resultado ->> 'resultado' is distinct from 'APLICADO'
     or v_resultado ->> 'linha' is distinct from 'C01'
     or v_resultado ->> 'historico_id' is distinct from h.id::text then
    return null;
  end if;
  begin
    v_texto := (v_salva ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    return null;
  end;
  if jsonb_typeof(v_texto) is distinct from 'object'
     or h.conteudo is distinct from jsonb_build_object('resposta',v_texto) then
    return null;
  end if;

  v_entendi := v_texto -> 'entendi_assim';
  if v_entendi is not null then
    if jsonb_typeof(v_entendi) is distinct from 'object'
       or octet_length(v_entendi::text)>16000
       or jsonb_typeof(v_entendi -> 'o_que_quer') is distinct from 'string'
       or char_length(btrim(v_entendi ->> 'o_que_quer')) not between 10 and 400
       or jsonb_typeof(v_entendi -> 'como_e_o_pronto') is distinct from 'array'
       or jsonb_typeof(v_entendi -> 'nao_pode') is distinct from 'array' then
      return null;
    end if;
    select count(*),bool_and(coalesce(
        jsonb_typeof(i.valor)='object'
        and jsonb_typeof(i.valor -> 'texto')='string'
        and char_length(btrim(i.valor ->> 'texto')) between 3 and 200,false)),
        jsonb_agg(to_jsonb(i.valor ->> 'texto') order by i.ord)
      into v_total,v_validos,v_pronto
      from jsonb_array_elements(v_entendi -> 'como_e_o_pronto')
        with ordinality i(valor,ord);
    if v_total not between 1 and 5 or v_validos is distinct from true then
      return null;
    end if;
    select count(*),coalesce(bool_and(coalesce(
        jsonb_typeof(i.valor)='string'
        and char_length(btrim(i.valor #>> '{}')) between 3 and 200,false)),true),
        coalesce(jsonb_agg(i.valor order by i.ord),'[]'::jsonb)
      into v_total,v_validos,v_nao_pode
      from jsonb_array_elements(v_entendi -> 'nao_pode')
        with ordinality i(valor,ord);
    if v_total>20 or v_validos is distinct from true then return null; end if;
    v_leitura := jsonb_build_object('o_que_quer',v_entendi ->> 'o_que_quer',
      'como_e_o_pronto',v_pronto,'nao_pode',v_nao_pode);
  else
    v_leitura := coalesce(v_texto -> 'leitura_de_volta',v_texto -> 'resumo');
    if jsonb_typeof(v_leitura) is distinct from 'string'
       or char_length(btrim(v_leitura #>> '{}')) not between 1 and 2000 then
      return null;
    end if;
  end if;

  v_escolha := v_texto -> 'escolha';
  if jsonb_typeof(v_escolha)='object'
     and v_escolha ->> 'tipo' in ('SERVICO','ROTEIRO')
     and jsonb_typeof(v_escolha -> 'id')='string'
     and char_length(v_escolha ->> 'id') between 1 and 80
     and v_escolha ->> 'id' ~ '^[A-Za-z0-9-]+$' then
    v_escolha := jsonb_build_object('tipo',v_escolha ->> 'tipo',
                                    'id',v_escolha ->> 'id');
  else
    v_escolha := null;
  end if;
  return jsonb_build_object('card_id',c.id,'versao',c.versao,
    'chave',h.chave,'historico_id',h.id,'momento',h.momento,
    'motivo_atual',c.motivo,'leitura_de_volta',v_leitura,
    'escolha',v_escolha);
end;
$f$;

revoke execute on function helena_v2.ler_leitura_card_fundador(uuid)
from public,anon,authenticated,service_role;
grant execute on function helena_v2.ler_leitura_card_fundador(uuid)
to authenticated;

-- ===== 0015_card_real_ligado.sql =====
-- O QUE É: confere a solicitação original também para cards reais ligados.
-- Cada salto exige o CARD_CRIADO por sinal, a passagem ou reação de origem,
-- e a mesma empresa, ordem e revisão pinada; fontes são relidas na raiz.
-- COMO MUDAR: ao criar outro tipo de card ligado, vincular seu sinal e origem
-- no histórico e ampliar os testes adversariais antes de alterar este leitor.

create or replace function helena_v2._real_conferir_card_vinculado(p_card_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare
  p helena_v2.solicitacao_card_real;
  c helena_v2.card;
  pai helena_v2.card;
  criacao helena_v2.historico;
  origem helena_v2.historico;
  ordem jsonb;
  v_estado text;
  v_saltos integer := 0;
  v_visitados uuid[] := '{}'::uuid[];
  v_criacoes integer;
begin
  select * into c from helena_v2.card where id=p_card_id for share;
  if c.id is null then
    raise exception 'CARD_REAL_NAO_ENCONTRADO' using errcode='22023';
  end if;
  loop
    if c.id=any(v_visitados) then
      raise exception 'CARD_REAL_CADEIA_CICLICA' using errcode='42501';
    end if;
    v_visitados := array_append(v_visitados,c.id);
    select * into p from helena_v2.solicitacao_card_real
      where card_id=c.id and consumida_em is not null for share;
    exit when found;
    if c.card_pai_id is null or v_saltos >= 16 then
      raise exception 'CARD_REAL_SEM_SOLICITACAO_CONSUMIDA' using errcode='22023';
    end if;
    select * into pai from helena_v2.card where id=c.card_pai_id for share;
    if pai.id is null or pai.id=c.id
       or c.empresa is distinct from pai.empresa
       or c.ordem_de_servico is distinct from pai.ordem_de_servico
       or c.ordem_de_servico ->> 'config_revision_id' is distinct from
          pai.ordem_de_servico ->> 'config_revision_id'
       or c.titulo is distinct from pai.titulo then
      raise exception 'CARD_REAL_CADEIA_DIVERGENTE' using errcode='42501';
    end if;
    select count(*) into v_criacoes from helena_v2.historico h
      where h.card_id=c.id and h.evento='CARD_CRIADO';
    if v_criacoes<>1 then
      raise exception 'CARD_REAL_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into criacao from helena_v2.historico h
      where h.card_id=c.id and h.maquina='card' and h.alvo_id=c.id
        and h.papel='MOTOR' and h.evento='CARD_CRIADO' and h.resultado='APLICADO'
        and h.origem='SINAL' and h.conteudo ->> 'ligado_a'=pai.id::text;
    if criacao.id is null or criacao.origem_id is null then
      raise exception 'CARD_REAL_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into origem from helena_v2.historico h
      where h.id=criacao.origem_id and h.card_id=pai.id;
    if origem.id is null or (
      (origem.maquina='card' and origem.alvo_id=pai.id)
      or (origem.maquina='etapa' and exists
          (select 1 from helena_v2.etapa e
           where e.id=origem.alvo_id and e.card_id=pai.id))
      or (origem.maquina='acao_externa' and exists
          (select 1 from helena_v2.acao_externa a
           where a.id=origem.alvo_id and a.card_id=pai.id))
    ) is distinct from true then
      raise exception 'CARD_REAL_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    if (
      (origem.resultado='REACAO' and origem.papel='FUNDADOR'
       and criacao.conteudo ->> 'motivo'='REACAO ' || origem.evento
       and exists (select 1 from helena_v2.reacao r
                   where r.maquina=origem.maquina and r.papel=origem.papel
                     and r.evento=origem.evento and r.abre_card_ligado))
      or (origem.resultado='CARD_NOVO_LIGADO' and origem.papel='FUNDADOR'
          and criacao.conteudo ->> 'motivo'=origem.papel || ' ' || origem.evento)
      or (origem.resultado in ('APLICADO','CONVERTIDO')
          and exists (select 1 from helena_v2.passagem t
                      join helena_v2.ligacao l
                        on l.nome=any(t.sinais) and l.no_card='criar_card_ligado'
                      where t.maquina=origem.maquina and t.linha_id=origem.linha_id
                        and t.evento=origem.evento and t.papel=origem.papel
                        and l.nome=criacao.conteudo ->> 'motivo'))
    ) is distinct from true then
      raise exception 'CARD_REAL_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    c := pai;
    v_saltos := v_saltos+1;
  end loop;

  if c.card_pai_id is not null then
    raise exception 'CARD_REAL_RAIZ_DIVERGENTE' using errcode='42501';
  end if;
  ordem := p.plano || jsonb_build_object(
    'config_revision_id',p.config_revision_id,'modo_contexto','real',
    'origem',p.origem,'chave_origem',p.chave_origem,'pedido_original',p.pedido_original,
    'business_id',p.business_id,'dados_reais',p.dados_reais);
  if c.empresa is distinct from p.business_id
     or c.ordem_de_servico is distinct from ordem
     or c.ordem_de_servico ->> 'config_revision_id' is distinct from
        p.config_revision_id::text then
    raise exception 'CARD_REAL_VINCULO_DIVERGENTE' using errcode='42501';
  end if;
  select estado into v_estado from helena_v2.configuracao
    where id=p.config_revision_id for share;
  if v_estado is null or v_estado not in ('VALIDADA','APOSENTADA') then
    raise exception 'CONFIG_PIN_REAL_INVALIDO' using errcode='42501';
  end if;
  if not helena_v2._real_confirmacao_valida(p.dados_reais,p.prazo) then
    raise exception 'CARD_REAL_SEM_CONFIRMACAO' using errcode='42501';
  end if;
  perform helena_v2._real_conferir_captura(p.chave_origem,p.plano,p.dados_reais);
  return true;
end;
$f$;

revoke execute on function helena_v2._real_conferir_card_vinculado(uuid)
from public,anon,authenticated,service_role;

-- ===== 0016_manutencao_so_servico.sql =====
-- 0016 — funções de manutenção não são portas da sessão do fundador.
-- O que é: ajuste de privilégios depois de 0001–0015, sem modificar dados.
-- A 0004 concedia EXECUTE a authenticated para toda a lista abaixo.
-- Algumas funções SECURITY DEFINER percorrem cards de todas as empresas e
-- podem devolver identificadores ou detalhes de inconsistências.
-- A tela continua usando as RPCs específicas do fundador (0005–0015).
revoke execute on function helena_v2.disparar_automaticos(uuid,text[]),
  helena_v2.abrir_chamada_helena(text,uuid),
  helena_v2.calcular_hash_das_linhas(),
  helena_v2.tabela_confere(),
  helena_v2.conferir_historico(uuid),
  helena_v2.vigia(),
  helena_v2.conferir_card(uuid),
  helena_v2.situacao_efetiva(helena_v2.etapa)
  from public, anon, authenticated;

grant execute on function helena_v2.disparar_automaticos(uuid,text[]),
  helena_v2.abrir_chamada_helena(text,uuid),
  helena_v2.calcular_hash_das_linhas(),
  helena_v2.tabela_confere(),
  helena_v2.conferir_historico(uuid),
  helena_v2.vigia(),
  helena_v2.conferir_card(uuid),
  helena_v2.situacao_efetiva(helena_v2.etapa)
  to service_role;

-- ===== 0017_relogio.sql =====
-- 0017 — O RELÓGIO DOS PRAZOS: helena_v2.eventos_devidos(p_agora) diz quais eventos de tempo (papel RELOGIO) venceram.
-- O que é: SÓ LEITURA. Devolve (maquina, alvo_id, card_id, evento, vencimento) na ordem em que devem ser aplicados.
--          Quem aplica é o emissor motor/orquestrador/orquestrador/relogio.py, um por um, por helena_v2.aplicar_evento com
--          o papel RELOGIO. Esta função não muda nada: a guarda e o efeito continuam na tabela de passagens (0002).
-- De onde vem: helena-v2/maquina/passagens.yaml (bloco "prazos" e as linhas com papel RELOGIO), estado_def.prazo -> prazo_def.
--   1. Vencimento simples: estado aberto cujo prazo tem tratado_em nulo e origem diferente de 'espera', com
--      prazo_ate <= p_agora -> prazo_def.evento (TEMPO_ESGOTADO). Etapa só com o card ativo (regra 6).
--   2. Escada do prazo do card (estados abertos do card): PRAZO_80 em criado_em + 80% de (prazo - criado_em),
--      PRAZO_VENCIDO no prazo, PRAZO_MAIS_1H uma hora depois. Só os degraus acima de nivel_prazo; MUDAR_PRAZO zera e rearma.
--   3. Lembretes da espera INTERNA por você: LEMBRETE_24H e LEMBRETE_48H, 24 e 48 horas depois de o alvo ENTRAR no estado
--      de espera (o momento vem do histórico). Vale onde a tabela tem a escada 24h/48h (card e ação INCERTA) e, na etapa,
--      só com espera = 'INTERNA'. Só os degraus acima de lembretes.
--   NÃO entram (a especificação não diz o instante sem adivinhar): PRAZO_ESPERA_VENCIDO (o padrão), o lembrete da espera
--   externa e o da ação proposta ("antes do prazo"), AVISO_1H e ESPERA_6H (fila por capacidade).
-- Sem repetição: um (alvo, evento) que o relógio já mandou DEPOIS da última mudança APLICADA no alvo não volta. Toda
--   mudança aplicada recalcula prazo_ate; assim o mesmo vencimento nunca é devolvido duas vezes (nem vira RECUSADO a cada
--   volta), e um vencimento novo no mesmo estado (ex.: revisão reiniciada) volta a valer.
-- Como mudar: instantes e escadas moram aqui; quem pode o quê continua no YAML. Só service_role executa (como o vigia, 0016).

create or replace function helena_v2.eventos_devidos(p_agora timestamptz default clock_timestamp())
returns table (maquina text, alvo_id uuid, card_id uuid, evento text, vencimento timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
#variable_conflict use_column
begin
  if p_agora is null or not isfinite(p_agora) then
    raise exception 'AGORA_INVALIDO: eventos_devidos precisa de um instante finito' using errcode = '22023';
  end if;
  return query
  with alvo as (
    select 'card'::text as maq, 1 as maq_ordem, c.id as alvo, c.id as card, c.estado as est, c.prazo_ate as ate,
           c.lembretes as lemb, null::text as esp
      from helena_v2.card c
    union all
    select 'etapa', 2, e.id, e.card_id, e.estado, e.prazo_ate, e.lembretes, e.espera from helena_v2.etapa e
    union all
    select 'acao_externa', 3, a.id, a.card_id, a.estado, a.prazo_ate, a.lembretes, null from helena_v2.acao_externa a
  ),
  aberto as (
    select x.*, d.prazo as prazo_nome
      from alvo x
      join helena_v2.estado_def d on d.maquina = x.maq and d.estado = x.est and not d.final
  ),
  candidato as (
    -- 1. vencimento simples (tempo da ficha, na hora, leitura de volta, recomendação, execução da ação)
    select x.maq, x.maq_ordem, x.alvo, x.card, x.est, pz.evento as ev, x.ate as venc, 0 as degrau
      from aberto x
      join helena_v2.prazo_def pz on pz.nome = x.prazo_nome
     where pz.tratado_em is null and pz.origem <> 'espera' and pz.papel = 'RELOGIO'
       and x.ate <= p_agora
    union all
    -- 2. escada do prazo do card: cada degrau dispara uma vez (nivel_prazo)
    select 'card', 1, c.id, c.id, c.estado, g.ev, g.venc, g.degrau
      from helena_v2.card c
      join helena_v2.estado_def d on d.maquina = 'card' and d.estado = c.estado and not d.final
      cross join lateral (values
        (1, 'PRAZO_80'::text, c.criado_em + (c.prazo - c.criado_em) * 0.8::float8),
        (2, 'PRAZO_VENCIDO'::text, c.prazo),
        (3, 'PRAZO_MAIS_1H'::text, c.prazo + interval '1 hour')) g(degrau, ev, venc)
     where c.nivel_prazo < g.degrau and g.venc <= p_agora
    union all
    -- 3. lembretes da espera interna: 24 h e 48 h depois de entrar no estado de espera
    select x.maq, x.maq_ordem, x.alvo, x.card, x.est, g.ev, ent.momento + g.depois, g.degrau
      from aberto x
      join helena_v2.prazo_def pz on pz.nome = x.prazo_nome and pz.origem = 'espera'
      cross join lateral (
        select h.momento, h.estado_depois from helena_v2.historico h
         where h.alvo_id = x.alvo and h.resultado in ('APLICADO', 'CONVERTIDO')
           and h.estado_antes is distinct from h.estado_depois
         order by h.id desc limit 1) ent
      cross join lateral (values
        (1, 'LEMBRETE_24H'::text, interval '24 hours'),
        (2, 'LEMBRETE_48H'::text, interval '48 hours')) g(degrau, ev, depois)
     where ent.estado_depois = x.est
       and x.lemb < g.degrau and ent.momento + g.depois <= p_agora
       and (x.maq <> 'etapa' or x.esp = 'INTERNA')
       and exists (select 1 from helena_v2.passagem p
                    where p.maquina = x.maq and p.de = x.est and p.papel = 'RELOGIO' and p.evento = 'LEMBRETE_48H')
  )
  select k.maq, k.alvo, k.card, k.ev, k.venc
    from candidato k
    join helena_v2.card cc on cc.id = k.card
   -- a tabela tem linha do RELOGIO para este evento neste estado
   where exists (select 1 from helena_v2.passagem p
                  where p.maquina = k.maq and p.de = k.est and p.papel = 'RELOGIO' and p.evento = k.ev)
     -- regra 6: etapa só anda com o card ativo
     and (k.maq <> 'etapa' or cc.estado in (
           select jsonb_array_elements_text(g.valor -> 'card_ativo') from helena_v2.regra_geral g
            where g.chave = 'etapa_so_anda_com_card_ativo'))
     -- sem repetição: nada do mesmo evento mandado pelo relógio depois da última mudança aplicada no alvo
     and not exists (
           select 1 from helena_v2.historico h
            where h.alvo_id = k.alvo and h.papel = 'RELOGIO' and h.evento = k.ev
              and h.id > coalesce((select max(u.id) from helena_v2.historico u
                                    where u.alvo_id = k.alvo and u.resultado in ('APLICADO', 'CONVERTIDO')), 0))
   order by k.venc, k.card, k.maq_ordem, k.alvo, k.degrau;
end;
$f$;

comment on function helena_v2.eventos_devidos(timestamptz) is
  'Relógio dos prazos (só leitura): eventos RELOGIO devidos em p_agora, na ordem de aplicar. Ver 0017_relogio.sql.';

revoke execute on function helena_v2.eventos_devidos(timestamptz) from public, anon, authenticated;
grant execute on function helena_v2.eventos_devidos(timestamptz) to service_role;

-- ===== 0018_publicacao_execucao.sql =====
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

-- ===== 0019_auditoria_de_ativacoes.sql =====
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
