import { describe, expect, it } from 'vitest';
import {
  dataHoraSP, derivarExecucao, entregasAprovadas, entregasPorSemana, estadoCombinado, execucoesPorEtapa, inicioDaSemanaSP, ultimasSemanas,
} from './derivar-execucao';
import { card, dadosDeTeste, entrega, etapa } from './dados-de-teste-execucao';

const chaves = (b: { itens: { chave: string }[] }) => b.itens.map(i => i.chave).sort();

describe('datas no fuso de Brasília', () => {
  it('formata data e hora sem deslocar dia puro', () => {
    expect(dataHoraSP('2026-10-17')).toBe('17/10/2026');
    expect(dataHoraSP('2026-10-17T02:30:00Z')).toContain('16/10/2026');
    expect(dataHoraSP(null, 'Sem prazo')).toBe('Sem prazo');
    expect(dataHoraSP('lixo')).toBe('Data indisponível');
  });
  it('acha a segunda-feira da semana pelo dia de Brasília', () => {
    expect(inicioDaSemanaSP(new Date('2026-10-17T15:00:00Z'))).toBe('2026-10-12');
    // Domingo 18/10 às 01:00 em Brasília ainda é a mesma semana; segunda 12/10 às 00:30 UTC ainda é domingo em Brasília.
    expect(inicioDaSemanaSP(new Date('2026-10-18T04:00:00Z'))).toBe('2026-10-12');
    expect(inicioDaSemanaSP(new Date('2026-10-12T00:30:00Z'))).toBe('2026-10-05');
  });
  it('lista 8 semanas, da mais antiga para a atual', () => {
    const semanas = ultimasSemanas(new Date('2026-10-17T15:00:00Z'));
    expect(semanas).toHaveLength(8);
    expect(semanas[0]).toBe('2026-08-24');
    expect(semanas[7]).toBe('2026-10-12');
  });
});

describe('estadoCombinado', () => {
  it('erro vence carregando, que vence pronta', () => {
    expect(estadoCombinado('pronta', 'carregando', 'erro')).toBe('erro');
    expect(estadoCombinado('pronta', 'carregando')).toBe('carregando');
    expect(estadoCombinado('pronta', 'pronta')).toBe('pronta');
  });
});

describe('derivarExecucao', () => {
  it('monta cada bloco do grupo todo', () => {
    const e = derivarExecucao(dadosDeTeste(), 'GRUPO');
    expect(chaves(e.esperando)).toEqual(['card:c1:esperando', 'card:c2:esperando']);
    expect(chaves(e.trabalho)).toEqual(['etapa:e1', 'etapa:e3']);
    expect(chaves(e.revisao)).toEqual(['etapa:e2']);
    expect(chaves(e.falhas)).toEqual(['card:c4:falha', 'card:c5:falha', 'etapa:e4']);
    expect(chaves(e.atrasados)).toEqual(['card:c3:atrasado']);
    expect(chaves(e.pedidos)).toEqual(['pedido:p1', 'pedido:p2']);
    expect(e.pedidosSemEmpresa).toBe(0);
  });

  it('não conta card pronto com prazo vencido nem etapa na fila sem entrega como falha', () => {
    const dados = dadosDeTeste();
    dados.etapas.push(etapa('e9', 'c3', { estado: 'NA_FILA', portao1_ok: false }));
    const e = derivarExecucao(dados, 'GRUPO');
    expect(chaves(e.atrasados)).toEqual(['card:c3:atrasado']);
    expect(chaves(e.falhas)).not.toContain('etapa:e9');
  });

  it('respeita o filtro de empresa e avisa dos pedidos sem empresa', () => {
    const e = derivarExecucao(dadosDeTeste(), 'BIZ-003');
    expect(chaves(e.esperando)).toEqual(['card:c1:esperando']);
    expect(chaves(e.trabalho)).toEqual(['etapa:e1']);
    expect(chaves(e.falhas)).toEqual(['card:c4:falha', 'etapa:e4']);
    expect(chaves(e.pedidos)).toEqual(['pedido:p2']);
    expect(e.pedidosSemEmpresa).toBe(1);
    expect(e.pedidos.itens[0].titulo).toBe('E-mails de lançamento');
    expect(e.pedidos.itens[0].empresa).toBe('Humano Digital');
  });

  it('filtra por agente, menos os pedidos (que não têm agente)', () => {
    const e = derivarExecucao(dadosDeTeste(), 'GRUPO', 'REVISOR');
    expect(chaves(e.revisao)).toEqual(['etapa:e2']);
    expect(e.trabalho.total).toBe(0);
    expect(e.esperando.total).toBe(0);
    expect(e.falhas.total).toBe(0);
    expect(chaves(e.atrasados)).toEqual(['card:c3:atrasado']);
    expect(e.pedidos.total).toBe(2);
  });

  it('dá nome de agente e de empresa e mostra autor e revisor', () => {
    const e = derivarExecucao(dadosDeTeste(), 'GRUPO');
    const trabalho = e.trabalho.itens.find(i => i.chave === 'etapa:e1')!;
    expect(trabalho.quem).toBe('Autor: Helena');
    expect(trabalho.empresa).toBe('Humano Digital');
    expect(trabalho.titulo).toBe('Post semanal');
    const revisao = e.revisao.itens[0];
    expect(revisao.quem).toBe('Revisor: Rafael');
    expect(revisao.detalhe).toContain('Autor: Sirlene');
  });

  it('marca prazo vencido e descreve o atraso', () => {
    const atrasado = derivarExecucao(dadosDeTeste(), 'GRUPO').atrasados.itens[0];
    expect(atrasado.prazoVencido).toBe(true);
    expect(atrasado.detalhe).toBe('Atrasado há 7 dias');
  });

  it('etapa de card fora da leitura só entra na visão do grupo', () => {
    const dados = dadosDeTeste();
    dados.etapas.push(etapa('e8', 'fantasma', { estado: 'EXECUTANDO' }));
    expect(derivarExecucao(dados, 'GRUPO').trabalho.itens.find(i => i.chave === 'etapa:e8')?.titulo).toBe('Card fora da amostra lida');
    expect(derivarExecucao(dados, 'BIZ-003').trabalho.itens.find(i => i.chave === 'etapa:e8')).toBeUndefined();
  });

  it('card cancelado ou pronto com motivo antigo não é trava', () => {
    const dados = dadosDeTeste();
    dados.cards.push(card('c7', { estado: 'CANCELADO', motivo: 'INFRA' }), card('c8', { estado: 'PRONTO', motivo: 'INFRA' }));
    expect(chaves(derivarExecucao(dados, 'GRUPO').falhas)).toEqual(['card:c4:falha', 'card:c5:falha', 'etapa:e4']);
  });
});

describe('entregas e consumo', () => {
  it('só considera entregas que passaram no portão 1, da mais nova para a mais antiga', () => {
    const { itens, ocultas } = entregasAprovadas(dadosDeTeste(), 'GRUPO');
    expect(itens.map(e => e.id)).toEqual(['1', '2', '3', '4']);
    expect(ocultas).toBe(0);
  });

  it('separa por empresa pelo card e conta as que não puderam ser ligadas', () => {
    const dados = dadosDeTeste();
    dados.entregas.push(entrega('9', 'fantasma'));
    const max = entregasAprovadas(dados, 'BIZ-001');
    expect(max.itens.map(e => e.id)).toEqual(['3']);
    expect(max.ocultas).toBe(1);
  });

  it('conta entregas aprovadas nas últimas 8 semanas', () => {
    const { semanas, total } = entregasPorSemana(dadosDeTeste(), 'GRUPO');
    expect(semanas).toHaveLength(8);
    expect(total).toBe(4);
    expect(semanas.find(s => s.chave === '2026-10-12')?.total).toBe(2);
    expect(semanas.find(s => s.chave === '2026-10-05')?.total).toBe(1);
    expect(semanas.find(s => s.chave === '2026-08-24')?.total).toBe(1);
    expect(semanas[0].rotulo).toBe('24/08');
  });

  it('ignora entrega mais velha que 8 semanas', () => {
    const dados = dadosDeTeste();
    dados.entregas.push(entrega('7', 'c3', { criada_em: '2026-08-10T15:00:00Z' }));
    expect(entregasPorSemana(dados, 'GRUPO').total).toBe(4);
  });

  it('soma execuções por tipo de etapa e conta abertas', () => {
    const r = execucoesPorEtapa(dadosDeTeste(), 'GRUPO');
    expect(r.abertas).toBe(4);
    expect(r.totalExecucoes).toBe(6);
    expect(r.grupos).toEqual([{ nome: 'Redigir', execucoes: 5, etapas: 2 }, { nome: 'Revisar', execucoes: 1, etapas: 1 }]);
    expect(r.semLeitura).toBe(2);
    expect(execucoesPorEtapa(dadosDeTeste(), 'BIZ-001').totalExecucoes).toBe(3);
  });

  it('devolve null (não zero) quando nenhuma etapa trouxe o número de execuções', () => {
    const dados = dadosDeTeste();
    dados.etapas = dados.etapas.map(e => ({ ...e, execucoes: null }));
    const r = execucoesPorEtapa(dados, 'GRUPO');
    expect(r.totalExecucoes).toBeNull();
    expect(r.grupos).toEqual([]);
    expect(r.abertas).toBe(4);
  });
});
