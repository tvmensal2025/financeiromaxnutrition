import { afterEach, describe, expect, it, vi } from 'vitest';
import { copiarTexto, linhasDaEntrega, textoParaCopiar } from './linhas-da-entrega';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('linhasDaEntrega', () => {
  it('transforma objetos e listas em rótulo e valor, na ordem', () => {
    const linhas = linhasDaEntrega({ titulo_do_post: 'Olá', legenda: { curta: 'a', longa: 'b' }, hashtags: ['x', 'y'] });
    expect(linhas).toEqual([
      { rotulo: 'titulo do post', valor: 'Olá' },
      { rotulo: 'legenda curta', valor: 'a' },
      { rotulo: 'legenda longa', valor: 'b' },
      { rotulo: 'hashtags 1', valor: 'x' },
      { rotulo: 'hashtags 2', valor: 'y' },
    ]);
  });
  it('trata texto simples, nulo e vazio', () => {
    expect(linhasDaEntrega('só texto')).toEqual([{ rotulo: 'Texto', valor: 'só texto' }]);
    expect(linhasDaEntrega({ a: null, b: {}, c: [] })).toEqual([
      { rotulo: 'a', valor: 'nulo' }, { rotulo: 'b', valor: 'vazio' }, { rotulo: 'c', valor: 'vazio' },
    ]);
  });
});

describe('textoParaCopiar', () => {
  it('copia texto simples sem rótulo e o resto como "rótulo: valor"', () => {
    expect(textoParaCopiar([{ rotulo: 'Texto', valor: 'oi' }])).toBe('oi');
    expect(textoParaCopiar([{ rotulo: 'a', valor: '1' }, { rotulo: 'b', valor: '2' }])).toBe('a: 1\nb: 2');
  });
});

describe('copiarTexto', () => {
  it('usa a área de transferência moderna quando existe', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: escrever } });
    expect(await copiarTexto('abc')).toBe(true);
    expect(escrever).toHaveBeenCalledWith('abc');
  });
  it('cai para o método antigo quando a moderna é recusada', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } });
    const antigo = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: antigo, configurable: true, writable: true });
    expect(await copiarTexto('abc')).toBe(true);
    expect(antigo).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('devolve false quando nada funciona', async () => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true, writable: true });
    expect(await copiarTexto('abc')).toBe(false);
  });
});
