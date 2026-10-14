import { expect, it } from 'vitest';
import { opcoesFundador } from './acoes-fundador';

const escolhas = (maquina: 'card' | 'etapa' | 'acao_externa', estado: string, motivo?: string, temFerramenta?: boolean) =>
  opcoesFundador({ maquina, estado, motivo, temFerramenta, versao: 2, id: 'alvo-local' });

it('oferece somente confirmação permitida no card, com motivos do SQL', () => {
  expect(escolhas('card', 'ESPERANDO_CONFIRMACAO', 'NENHUM').map(e => e.evento)).toEqual(['RESPONDER', 'CANCELAR']);
  expect(escolhas('card', 'ESPERANDO_CONFIRMACAO', 'PLANO_INVALIDO').map(e => e.evento)).toEqual(['CANCELAR']);
  expect(escolhas('card', 'CANCELADO')).toEqual([]);
  expect(escolhas('card', 'PRONTO').some(e => e.evento === 'APROVAR')).toBe(true);
  expect(opcoesFundador({ maquina: 'card', estado: 'PRONTO', versao: 0, id: 'alvo-local' })).toEqual([]);
});

it('oferece aprovação de etapa só em revisão e motivos de ajuste do vocabulário', () => {
  expect(escolhas('etapa', 'ESPERANDO_FUNDADOR', 'REVISAO').map(e => e.evento))
    .toEqual(['APROVAR', 'PEDIR_AJUSTE', 'PEDIR_AJUSTE', 'PEDIR_AJUSTE', 'PEDIR_AJUSTE']);
  expect(escolhas('etapa', 'ESPERANDO_FUNDADOR', 'PERGUNTA').map(e => e.parametros.opcao))
    .toEqual(['RESPOSTA_A', 'RESPOSTA_B', 'RESPOSTA_C']);
  expect(escolhas('etapa', 'NA_FILA')).toEqual([]);
});

it('só oferece autorização externa quando a ação proposta tem ferramenta', () => {
  expect(escolhas('acao_externa', 'PROPOSTA', undefined, false).some(e => e.evento === 'APROVAR')).toBe(false);
  expect(escolhas('acao_externa', 'PROPOSTA', undefined, true).some(e => e.evento === 'APROVAR')).toBe(true);
  expect(escolhas('acao_externa', 'AUTORIZADA').map(e => e.evento)).toEqual(['CANCELAR']);
});
