-- ARQUIVO GERADO. NÃO EDITE À MÃO.
-- O que é: as passagens da máquina do card, da etapa e da ação externa, com tetos, guardas, efeitos,
--          ligações, automáticos e a impressão digital da tabela que passou na prova.
-- De onde vem: helena-v2/maquina/passagens.yaml + vocabulario.yaml, pelo script gerar_passagens.py.
-- Como mudar: edite o YAML, rode a prova (python helena-v2/maquina/provar.py) e depois
--             `python supabase/migrations-v2/gerar_passagens.py`. O teste test_02_gerador.py falha se este
--             arquivo guardado for diferente do que o gerador produz hoje.
-- Impressão digital da tabela (provar.impressao_digital): cf95deb1ff066e4f
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
  ('card', 'C16@EM_ANDAMENTO', 'C16', 27, 'EM_ANDAMENTO', 'DECISAO_MUDOU', 'MOTOR', 'ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['DECISAO_MUDOU']::text[], false, 'Regra 10: o que usava a decisão é refeito.'),
  ('card', 'C16@ESPERANDO_FUNDADOR', 'C16', 28, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'ordens < TETO_ORDENS', 'ESPERANDO_FUNDADOR', '[{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['DECISAO_MUDOU']::text[], false, 'Regra 10: o que usava a decisão é refeito.'),
  ('card', 'C17@EM_ANDAMENTO', 'C17', 29, 'EM_ANDAMENTO', 'DECISAO_MUDOU', 'MOTOR', 'ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Acima do teto de ordens, o card não pode terminar com informação velha: é substituído por um card novo ligado, com as entregas e a decisão nova.'),
  ('card', 'C17@ESPERANDO_FUNDADOR', 'C17', 30, 'ESPERANDO_FUNDADOR', 'DECISAO_MUDOU', 'MOTOR', 'ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Acima do teto de ordens, o card não pode terminar com informação velha: é substituído por um card novo ligado, com as entregas e a decisão nova.'),
  ('card', 'C18', 'C18', 31, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''DEPENDENCIA'' and opcao == ''PULAR'' and falhas_pulaveis', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0}]'::jsonb, '{}'::jsonb, array['PULAR_FALHAS']::text[], false, null),
  ('card', 'C19', 'C19', 32, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''DEPENDENCIA'' and opcao == ''REFAZER'' and ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['REFAZER_FALHAS']::text[], false, null),
  ('card', 'C20', 'C20', 33, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo == ''NAO_PODE'' and opcao == ''REFAZER'' and ordens < TETO_ORDENS', 'EM_ANDAMENTO', '[{"op":"set","v":"motivo","val":"NENHUM"},{"op":"set","v":"lembretes","val":0},{"n":1,"op":"add","v":"ordens"}]'::jsonb, '{}'::jsonb, array['REABRIR_JULGADAS']::text[], false, null),
  ('card', 'C29', 'C29', 34, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'motivo in (''DEPENDENCIA'', ''NAO_PODE'') and opcao == ''REFAZER'' and ordens >= TETO_ORDENS', 'CANCELADO', '[{"op":"set","v":"fim","val":"SUBSTITUIDO"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS', 'CARD_LIGADO']::text[], false, 'Refazer acima do teto de ordens: card novo ligado, com as entregas deste (nunca vira comentário).'),
  ('card', 'C21', 'C21', 35, 'ESPERANDO_FUNDADOR', 'RESPONDER', 'FUNDADOR', 'opcao == ''ENCERRAR''', 'ENCERRADO_COM_FALHA', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, null),
  ('card', 'C22@RASCUNHO', 'C22', 36, 'RASCUNHO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@ESPERANDO_CONFIRMACAO', 'C22', 37, 'ESPERANDO_CONFIRMACAO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@VALIDANDO_PLANO', 'C22', 38, 'VALIDANDO_PLANO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@EM_ANDAMENTO', 'C22', 39, 'EM_ANDAMENTO', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C22@ESPERANDO_FUNDADOR', 'C22', 40, 'ESPERANDO_FUNDADOR', 'CANCELAR', 'FUNDADOR', null, 'CANCELADO', '[{"op":"set","v":"fim","val":"FUNDADOR"}]'::jsonb, '{}'::jsonb, array['CANCELAR_ETAPAS']::text[], false, 'Cancelar não depende de IA nem da versão vista; o motor encerra o agente em até 15 s.'),
  ('card', 'C23@RASCUNHO', 'C23', 41, 'RASCUNHO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@ESPERANDO_CONFIRMACAO', 'C23', 42, 'ESPERANDO_CONFIRMACAO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@VALIDANDO_PLANO', 'C23', 43, 'VALIDANDO_PLANO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@EM_ANDAMENTO', 'C23', 44, 'EM_ANDAMENTO', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C23@ESPERANDO_FUNDADOR', 'C23', 45, 'ESPERANDO_FUNDADOR', 'PRAZO_80', 'RELOGIO', 'nivel_prazo < 1', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":1}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Card amarelo.'),
  ('card', 'C24@RASCUNHO', 'C24', 46, 'RASCUNHO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@ESPERANDO_CONFIRMACAO', 'C24', 47, 'ESPERANDO_CONFIRMACAO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@VALIDANDO_PLANO', 'C24', 48, 'VALIDANDO_PLANO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@EM_ANDAMENTO', 'C24', 49, 'EM_ANDAMENTO', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C24@ESPERANDO_FUNDADOR', 'C24', 50, 'ESPERANDO_FUNDADOR', 'PRAZO_VENCIDO', 'RELOGIO', 'nivel_prazo < 2', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":2}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Chama a Helena para destravar; se o card espera você, o aviso vai direto para você.'),
  ('card', 'C25@RASCUNHO', 'C25', 51, 'RASCUNHO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@ESPERANDO_CONFIRMACAO', 'C25', 52, 'ESPERANDO_CONFIRMACAO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@VALIDANDO_PLANO', 'C25', 53, 'VALIDANDO_PLANO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@EM_ANDAMENTO', 'C25', 54, 'EM_ANDAMENTO', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C25@ESPERANDO_FUNDADOR', 'C25', 55, 'ESPERANDO_FUNDADOR', 'PRAZO_MAIS_1H', 'RELOGIO', 'nivel_prazo < 3', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":3}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Aviso para você.'),
  ('card', 'C26@RASCUNHO', 'C26', 56, 'RASCUNHO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'RASCUNHO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@ESPERANDO_CONFIRMACAO', 'C26', 57, 'ESPERANDO_CONFIRMACAO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'ESPERANDO_CONFIRMACAO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@VALIDANDO_PLANO', 'C26', 58, 'VALIDANDO_PLANO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'VALIDANDO_PLANO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@EM_ANDAMENTO', 'C26', 59, 'EM_ANDAMENTO', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'EM_ANDAMENTO', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
  ('card', 'C26@ESPERANDO_FUNDADOR', 'C26', 60, 'ESPERANDO_FUNDADOR', 'MUDAR_PRAZO', 'FUNDADOR', 'mudancas_prazo < TETO_MUDANCAS_PRAZO', 'ESPERANDO_FUNDADOR', '[{"op":"set","v":"nivel_prazo","val":0},{"n":1,"op":"add","v":"mudancas_prazo"}]'::jsonb, '{}'::jsonb, '{}'::text[], false, 'Muda o campo prazo (só você) e rearma os 3 avisos para o prazo novo; o relógio dispara na hora o nível que o prazo novo já passou.'),
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
  (true, '2.0.0', 'cf95deb1ff066e4f', null, 'helena-v2/maquina/passagens.yaml + vocabulario.yaml');

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
