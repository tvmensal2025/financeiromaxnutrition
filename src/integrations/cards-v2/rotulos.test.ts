import { expect, it } from 'vitest';
import { rotuloEstado, rotuloMotivo } from './rotulos';

it('traduz estados de card, etapa e ação para português legível', () => {
  expect(rotuloEstado('ESPERANDO_CONFIRMACAO')).toBe('Esperando confirmação');
  expect(rotuloEstado('ENCERRADO_COM_FALHA')).toBe('Encerrado com falha');
  expect(rotuloEstado('PROPOSTA')).toBe('Proposta');
});

it('estado ou motivo desconhecido vira texto legível, nunca o código cru', () => {
  expect(rotuloEstado('NOVO_ESTADO_DO_BANCO')).toBe('Novo estado do banco');
  expect(rotuloMotivo('DEPENDENCIA')).toBe('Dependência');
  expect(rotuloMotivo('OUTRO_MOTIVO')).toBe('Outro motivo');
});
