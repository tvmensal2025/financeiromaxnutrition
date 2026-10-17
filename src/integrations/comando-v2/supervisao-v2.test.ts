import { describe, expect, it } from 'vitest';
import {
  analisarCardsV2, cargaPorAgente, entregasAprovadas, filtrarPorEmpresa, haQuantoTempo, resumirEmpresas,
  resumirExcecoes, traduzirMotivo, type Excecao, type RegraSupervisao,
} from './supervisao-v2';
import { dadosVazios, type CardComando, type DadosComando, type EtapaComando, type EntregaResumo } from './tipos';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';

const AGORA = new Date('2026-10-17T15:00:00Z');
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString();
const horasAdiante = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString();

const card = (id: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: horasAdiante(48),
  criado_em: horasAtras(5), atualizado_em: horasAtras(0.2), prazo_ate: horasAdiante(48), prioridade: 1, ...extra,
});
const etapa = (id: string, cardId: string, extra: Partial<EtapaComando> = {}): EtapaComando => ({
  id, codigo: `E-${id}`, nome: `Etapa ${id}`, estado: 'NA_FILA', autor: 'BIANCA', dono: 'BIANCA', prazo_ate: horasAdiante(5),
  revisores: [], versao: 1, portao1_ok: false, entrega_fresca: true, card_id: cardId, ordem: 1,
  atualizado_em: horasAtras(0.1), execucoes: 0, ...extra,
});
const pedido = (id: string, extra: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  pedido_id: id, request_id: id, estado: 'RECEBIDO', texto_inicial: `Pedido ${id}`, total_eventos: 1,
  criado_em: horasAtras(0.2), atualizado_em: horasAtras(0.2), origem_inicial: 'SITE', card_id: null, ...extra,
});
function montar(extra: Partial<DadosComando> = {}): DadosComando {
  return {
    ...dadosVazios(AGORA),
    catalogo: {
      revisao: 'rev-1',
      empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'iGreen', pacote: 'NAO_CONFIRMADO' }],
      agentes: [{ id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'CEO', grupo: 'Coordenação', estado: 'ESTAGIO' },
        { id: 'AGT-02', identidade: 'BIANCA', nome: 'Bianca', cargo: 'Pessoas', grupo: 'Execução', estado: 'ATIVO' }],
      servicos: [{ id: 'SRV-A', nome: 'Análise', dono: 'BIANCA', revisor: 'HELENA', estado: 'ATIVO', empresas: ['BIZ-003'] }],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    ...extra,
  };
}
const regras = (lista: Excecao[], regra: RegraSupervisao) => lista.filter(e => e.regra === regra);
const analisar = (extra: Partial<DadosComando>) => analisarCardsV2(montar(extra), AGORA);

describe('analisarCardsV2: cada regra tem caso positivo e negativo', () => {
  it('card saudável não gera exceção', () => {
    expect(analisar({ cards: [card('a')], etapas: [etapa('e1', 'a')], pedidos: [pedido('p1')] })).toEqual([]);
  });

  it('SEM_DONO: card aberto sem dono aponta; com dono ou já finalizado não', () => {
    const r = analisar({ cards: [card('a', { dono: null }), card('b', { dono: '  ' }), card('c'), card('d', { dono: null, estado: 'CANCELADO' })] });
    expect(regras(r, 'SEM_DONO').map(e => e.cardId).sort()).toEqual(['a', 'b']);
  });

  it('SEM_PRAZO: aberto sem prazo aponta; com prazo ou finalizado não', () => {
    const r = analisar({ cards: [card('a', { prazo: '', prazo_ate: null }), card('b'), card('c', { prazo: '', prazo_ate: null, estado: 'PRONTO' })] });
    expect(regras(r, 'SEM_PRAZO').map(e => e.cardId)).toEqual(['a']);
  });

  it('PRAZO_VENCIDO: aberto com prazo no passado é ALTA; no futuro ou finalizado não', () => {
    const r = analisar({ cards: [card('a', { prazo_ate: horasAtras(2) }), card('b'), card('c', { prazo_ate: horasAtras(2), estado: 'PRONTO' })] });
    const achados = regras(r, 'PRAZO_VENCIDO');
    expect(achados.map(e => e.cardId)).toEqual(['a']);
    expect(achados[0].severidade).toBe('ALTA');
    expect(achados[0].desde).toBe(horasAtras(2));
  });

  it('PRAZO_VENCIDO: usa prazo quando prazo_ate não veio', () => {
    const r = analisar({ cards: [card('a', { prazo_ate: null, prazo: horasAtras(1) })] });
    expect(regras(r, 'PRAZO_VENCIDO')).toHaveLength(1);
  });

  it('ESPERANDO_VOCE: 24 h exatas não aponta; acima de 24 h é MEDIA; acima de 72 h é ALTA; recente não', () => {
    const r = analisar({ cards: [
      card('exato', { estado: 'ESPERANDO_FUNDADOR', atualizado_em: horasAtras(24) }),
      card('media', { estado: 'ESPERANDO_FUNDADOR', atualizado_em: horasAtras(30) }),
      card('alta', { estado: 'ESPERANDO_CONFIRMACAO', atualizado_em: horasAtras(80) }),
      card('limite-alta', { estado: 'ESPERANDO_CONFIRMACAO', atualizado_em: horasAtras(72) }),
      card('recente', { estado: 'ESPERANDO_FUNDADOR', atualizado_em: horasAtras(2) }),
      card('andando', { estado: 'EM_ANDAMENTO', atualizado_em: horasAtras(100) }),
      card('sem-data', { estado: 'ESPERANDO_FUNDADOR', atualizado_em: null }),
    ] });
    const achados = regras(r, 'ESPERANDO_VOCE');
    expect(Object.fromEntries(achados.map(e => [e.cardId, e.severidade]))).toEqual({ media: 'MEDIA', alta: 'ALTA', 'limite-alta': 'MEDIA' });
  });

  it('ENCERRADO_COM_FALHA: é ALTA e traduz o motivo; PRONTO não aponta', () => {
    const r = analisar({ cards: [card('a', { estado: 'ENCERRADO_COM_FALHA', motivo: 'DEPENDENCIA', dono: null, prazo: '', prazo_ate: null }), card('b', { estado: 'PRONTO' })] });
    const achados = regras(r, 'ENCERRADO_COM_FALHA');
    expect(achados).toHaveLength(1);
    expect(achados[0].severidade).toBe('ALTA');
    expect(achados[0].detalhe).toContain('uma etapa de que outras dependiam falhou');
    expect(achados[0].detalhe).not.toContain('DEPENDENCIA');
    // card finalizado sem dono/prazo não vira "sem dono" nem "sem prazo"
    expect(regras(r, 'SEM_DONO')).toHaveLength(0);
    expect(regras(r, 'SEM_PRAZO')).toHaveLength(0);
  });

  it('PORTAO_OU_ENTREGA: etapa em revisão/aprovada com portão falso ou entrega velha aponta; fila e etapa boa não', () => {
    const r = analisar({ cards: [card('a'), card('b')], etapas: [
      etapa('sem-portao', 'a', { estado: 'REVISAO', portao1_ok: false, atualizado_em: horasAtras(0.1) }),
      etapa('velha', 'a', { estado: 'APROVADA', portao1_ok: true, entrega_fresca: false }),
      etapa('boa', 'a', { estado: 'APROVADA', portao1_ok: true, entrega_fresca: true }),
      etapa('fila', 'b', { estado: 'NA_FILA', portao1_ok: false }),
      etapa('executando', 'b', { estado: 'EXECUTANDO', portao1_ok: false }),
    ] });
    const achados = regras(r, 'PORTAO_OU_ENTREGA');
    expect(Object.fromEntries(achados.map(e => [e.etapaId, e.severidade]))).toEqual({ 'sem-portao': 'ALTA', velha: 'MEDIA' });
    expect(achados.find(e => e.etapaId === 'velha')?.cardId).toBe('a');
  });

  it('EXECUCAO_PARADA: executando/revisão sem atualização há mais de 1 h aponta; recente, outro estado ou sem data não', () => {
    const r = analisar({ cards: [card('a')], etapas: [
      etapa('parada', 'a', { estado: 'EXECUTANDO', atualizado_em: horasAtras(2) }),
      etapa('revisao-parada', 'a', { estado: 'REVISAO', portao1_ok: true, atualizado_em: horasAtras(1.5) }),
      etapa('limite', 'a', { estado: 'EXECUTANDO', atualizado_em: horasAtras(1) }),
      etapa('recente', 'a', { estado: 'EXECUTANDO', atualizado_em: horasAtras(0.3) }),
      etapa('fila-antiga', 'a', { estado: 'NA_FILA', atualizado_em: horasAtras(10) }),
      etapa('sem-data', 'a', { estado: 'EXECUTANDO', atualizado_em: null }),
    ] });
    expect(regras(r, 'EXECUCAO_PARADA').map(e => e.etapaId).sort()).toEqual(['parada', 'revisao-parada']);
  });

  it('etapas de card cancelado são ignoradas', () => {
    const r = analisar({ cards: [card('a', { estado: 'CANCELADO' })], etapas: [etapa('e', 'a', { estado: 'EXECUTANDO', atualizado_em: horasAtras(9) })] });
    expect(r).toEqual([]);
  });

  it('SEM_EMPRESA: card aberto sem empresa é BAIXA; com empresa ou finalizado não', () => {
    const r = analisar({ cards: [card('a', { empresa: null }), card('b'), card('c', { empresa: null, estado: 'CANCELADO' })] });
    const achados = regras(r, 'SEM_EMPRESA');
    expect(achados.map(e => e.cardId)).toEqual(['a']);
    expect(achados[0].severidade).toBe('BAIXA');
  });

  it('PEDIDO_SEM_CARD: recebido há mais de 1 h sem card aponta; recente, com card ou em outro estado não', () => {
    const r = analisar({ pedidos: [
      pedido('velho', { criado_em: horasAtras(3), empresa_id: 'BIZ-001' }),
      pedido('limite', { criado_em: horasAtras(1) }),
      pedido('recente', { criado_em: horasAtras(0.5) }),
      pedido('com-card', { criado_em: horasAtras(5), card_id: 'x' }),
      pedido('confirmado', { criado_em: horasAtras(5), estado: 'PLANO_CONFIRMADO' }),
    ] });
    const achados = regras(r, 'PEDIDO_SEM_CARD');
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({ severidade: 'MEDIA', empresa: 'BIZ-001', titulo: 'Pedido velho' });
    expect(achados[0].cardId).toBeUndefined();
  });

  it('ordena por severidade e, dentro dela, pelo mais antigo', () => {
    const r = analisar({ cards: [
      card('baixa', { empresa: null, criado_em: horasAtras(100) }),
      card('alta-nova', { prazo_ate: horasAtras(1) }),
      card('alta-velha', { prazo_ate: horasAtras(50) }),
      card('media', { dono: null, criado_em: horasAtras(9) }),
    ] });
    expect(r.map(e => `${e.severidade}:${e.cardId}`)).toEqual(['ALTA:alta-velha', 'ALTA:alta-nova', 'MEDIA:media', 'BAIXA:baixa']);
  });
});

describe('auxiliares', () => {
  it('traduzirMotivo nunca devolve vazio nem código cru de um motivo novo', () => {
    expect(traduzirMotivo(undefined)).toBe('sem motivo registrado');
    expect(traduzirMotivo('MOTIVO_NOVO_QUALQUER')).toBe('motivo novo qualquer');
  });

  it('haQuantoTempo escreve em português simples', () => {
    expect(haQuantoTempo(horasAtras(0.1), AGORA)).toBe('há 6 min');
    expect(haQuantoTempo(horasAtras(5), AGORA)).toBe('há 5 h');
    expect(haQuantoTempo(horasAtras(72), AGORA)).toBe('há 3 dias');
    expect(haQuantoTempo(null, AGORA)).toBe('data não informada');
  });

  it('resumirExcecoes e filtrarPorEmpresa', () => {
    const lista = analisar({ cards: [card('a', { dono: null }), card('b', { empresa: null }), card('c', { empresa: 'BIZ-001', prazo_ate: horasAtras(2) })] });
    const resumo = resumirExcecoes(lista);
    expect(resumo.porSeveridade).toEqual({ ALTA: 1, MEDIA: 1, BAIXA: 1 });
    expect(resumo.porRegra.PRAZO_VENCIDO).toBe(1);
    expect(filtrarPorEmpresa(lista, 'GRUPO').itens).toHaveLength(3);
    const filtrado = filtrarPorEmpresa(lista, 'BIZ-003');
    expect(filtrado.itens.map(e => e.cardId)).toEqual(['a']);
    expect(filtrado.semEmpresa).toBe(1);
  });

  it('entregasAprovadas segue a regra do card (etapa aprovada, portão passou, entrega fresca, versão atual)', () => {
    const entrega = (id: string, etapaId: string, versao: number, extra: Partial<EntregaResumo> = {}): EntregaResumo => ({
      id, card_id: 'a', etapa_id: etapaId, etapa_codigo: null, versao, autor: 'BIANCA', portao1: 'PASSOU', criada_em: horasAtras(1),
      parecer: null, usou_internet: null, ...extra });
    const dados = montar({ cards: [card('a')],
      etapas: [etapa('ok', 'a', { estado: 'APROVADA', portao1_ok: true, versao: 2 }), etapa('rev', 'a', { estado: 'REVISAO', portao1_ok: true })],
      entregas: [entrega('1', 'ok', 2), entrega('2', 'ok', 1), entrega('3', 'rev', 1), entrega('4', 'ok', 2, { portao1: 'FALHOU' })] });
    expect(entregasAprovadas(dados)?.map(e => e.id)).toEqual(['1']);
    expect(entregasAprovadas({ ...dados, estado: { ...dados.estado, entregas: 'erro' } })).toBeNull();
  });

  it('resumirEmpresas conta por empresa e respeita o filtro', () => {
    const dados = montar({
      cards: [card('a'), card('b', { estado: 'ESPERANDO_FUNDADOR' }), card('c', { prazo_ate: horasAtras(3) }), card('d', { estado: 'PRONTO' }),
        card('e', { empresa: 'BIZ-001' }), card('f', { empresa: null })],
    });
    const grupo = resumirEmpresas(dados, 'GRUPO', AGORA);
    const humano = grupo.empresas.find(e => e.id === 'BIZ-003')!;
    expect(humano).toMatchObject({ abertos: 3, esperandoVoce: 1, atrasados: 1, prontos: 1, pacoteConfirmado: true, entregasAprovadas: 0 });
    expect(grupo.empresas.find(e => e.id === 'BIZ-001')).toMatchObject({ abertos: 1, pacoteConfirmado: false });
    expect(grupo.semEmpresa).toBe(1);
    const so = resumirEmpresas(dados, 'BIZ-001', AGORA);
    expect(so.empresas.map(e => e.id)).toEqual(['BIZ-001']);
    expect(so.semEmpresa).toBe(0);
  });

  it('cargaPorAgente conta etapas abertas como autor e revisões pendentes', () => {
    const dados = montar({
      cards: [card('a'), card('b', { empresa: 'BIZ-001' })],
      etapas: [
        etapa('1', 'a', { autor: 'BIANCA', estado: 'EXECUTANDO' }),
        etapa('2', 'a', { autor: 'bianca', estado: 'NA_FILA' }),
        etapa('3', 'a', { autor: 'BIANCA', estado: 'APROVADA' }),
        etapa('4', 'a', { autor: 'HELENA', estado: 'REVISAO', revisores: ['BIANCA'] }),
        etapa('5', 'a', { autor: 'HELENA', estado: 'EXECUTANDO', revisores: ['BIANCA'] }),
        etapa('6', 'b', { autor: 'BIANCA', estado: 'EXECUTANDO' }),
      ],
    });
    expect(cargaPorAgente(dados, 'GRUPO').get('BIANCA')).toEqual({ etapasAbertas: 3, revisoesPendentes: 1 });
    expect(cargaPorAgente(dados, 'BIZ-001').get('BIANCA')).toEqual({ etapasAbertas: 1, revisoesPendentes: 0 });
    expect(cargaPorAgente(dados, 'GRUPO').get('HELENA')).toEqual({ etapasAbertas: 2, revisoesPendentes: 0 });
  });
});
