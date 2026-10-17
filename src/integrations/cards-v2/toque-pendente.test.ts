import { afterEach, expect, it } from 'vitest';
import { lerIdentificadorDeToqueInvalido, lerToquePendente, limparToquesDaIdentidade, salvarToquePendente } from './toque-pendente';

afterEach(() => sessionStorage.clear());

it('guarda só identificadores e impressão, separa identidades e remove na revogação', () => {
  const valor = { cardId: 'card-local', toque: '12345678-1234-1234-1234-123456789abc', impressao: 'a'.repeat(64) };
  salvarToquePendente('conta-a', 'card', 'card-local', valor);
  expect(lerToquePendente('conta-a', 'card', 'card-local', 'card-local')).toEqual(valor);
  expect(lerToquePendente('conta-b', 'card', 'card-local', 'card-local')).toBeNull();
  const armazenado = sessionStorage.getItem('helena-v2-toque:conta-a:card:card-local');
  expect(JSON.parse(armazenado!)).toEqual(valor);
  limparToquesDaIdentidade('conta-a');
  expect(lerToquePendente('conta-a', 'card', 'card-local', 'card-local')).toBeNull();
});

it('recusa UUID de toque malformado recuperado da sessão', () => {
  sessionStorage.setItem('helena-v2-toque:conta-a:card:card-local', JSON.stringify({
    cardId: 'card-local', toque: '123456781234-1234-1234-123456789abc-', impressao: 'a'.repeat(64),
  }));
  expect(() => lerToquePendente('conta-a', 'card', 'card-local', 'card-local')).toThrow('Não foi possível recuperar');
  expect(lerIdentificadorDeToqueInvalido('conta-a', 'card', 'card-local', 'card-local')).toBeNull();
});

it('extrai só um UUID íntegro do mesmo card para consulta sem reconstruir a decisão', () => {
  const toque = '12345678-1234-1234-1234-123456789abc';
  sessionStorage.setItem('helena-v2-toque:conta-a:card:card-local', JSON.stringify({ cardId: 'card-local', toque, impressao: 'corrompida' }));
  expect(() => lerToquePendente('conta-a', 'card', 'card-local', 'card-local')).toThrow();
  expect(lerIdentificadorDeToqueInvalido('conta-a', 'card', 'card-local', 'card-local')).toBe(toque);
  expect(lerIdentificadorDeToqueInvalido('conta-a', 'card', 'card-local', 'outro-card')).toBeNull();
});
