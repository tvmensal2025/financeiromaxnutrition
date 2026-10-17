import type { EventoFundadorV2 } from './repository';

export type ToquePendente = { cardId: string; toque: string; impressao: string };
const prefixo = 'helena-v2-toque:';
const chave = (identidade: string, maquina: EventoFundadorV2['maquina'], alvo: string) => `${prefixo}${identidade}:${maquina}:${alvo}`;
const uuidValido = (valor: unknown): valor is string => typeof valor === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

export function lerToquePendente(identidade: string, maquina: EventoFundadorV2['maquina'], alvo: string, cardId: string): ToquePendente | null {
  try {
    const bruto = sessionStorage.getItem(chave(identidade, maquina, alvo));
    if (!bruto) return null;
    const valor: unknown = JSON.parse(bruto);
    if (!valor || typeof valor !== 'object' || !('cardId' in valor) || valor.cardId !== cardId
        || !('toque' in valor) || !uuidValido(valor.toque)
        || !('impressao' in valor) || typeof valor.impressao !== 'string' || !/^[0-9a-f]{64}$/.test(valor.impressao)) {
      throw new Error('Metadados do toque inválidos.');
    }
    return valor as ToquePendente;
  } catch { throw new Error('Não foi possível recuperar o toque anterior desta etapa. Confirme a situação no banco antes de outra decisão.'); }
}

/** Recupera apenas o identificador; jamais inventa a decisão ou uma impressão ausente. */
export function lerIdentificadorDeToqueInvalido(identidade: string, maquina: EventoFundadorV2['maquina'], alvo: string, cardId: string): string | null {
  try {
    const bruto = sessionStorage.getItem(chave(identidade, maquina, alvo));
    if (!bruto) return null;
    const valor: unknown = JSON.parse(bruto);
    if (!valor || typeof valor !== 'object' || !('cardId' in valor) || valor.cardId !== cardId
        || !('toque' in valor) || !uuidValido(valor.toque)) return null;
    return valor.toque;
  } catch { return null; }
}

export function salvarToquePendente(identidade: string, maquina: EventoFundadorV2['maquina'], alvo: string, valor: ToquePendente) {
  sessionStorage.setItem(chave(identidade, maquina, alvo), JSON.stringify(valor));
}

export function limparToquePendente(identidade: string, maquina: EventoFundadorV2['maquina'], alvo: string) {
  sessionStorage.removeItem(chave(identidade, maquina, alvo));
}

export function limparToquesDaIdentidade(identidade: string) {
  const prefixoDaConta = `${prefixo}${identidade}:`;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const nome = sessionStorage.key(i);
    if (nome?.startsWith(prefixoDaConta)) sessionStorage.removeItem(nome);
  }
}
