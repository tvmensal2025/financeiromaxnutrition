/** Valores em centavos inteiros. Não usa parseFloat nem aceita prefixos parciais. */
export function centsFromNumber(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(value * 100 - cents) < 0.00001 ? cents : null;
}

export function parseBRLCents(input: unknown): number | null {
  if (typeof input === 'number') return centsFromNumber(input);
  if (typeof input !== 'string' || input.length > 100) return null;
  const text = input.trim().replace(/^R\$\s*/i, '').replace(/\u00a0/g, ' ');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.replace(/\./g, '').split(',');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

/** Decimais canônicos retornados pelo banco/inputs type=number, não texto livre pt-BR. */
export function parseDatabaseCents(input: unknown): number | null {
  if (typeof input === 'number') return centsFromNumber(input);
  if (typeof input !== 'string' || input.length > 100 || !/^\d+(?:\.\d{1,2}0*)?$/.test(input.trim())) return null;
  const [whole, fraction = ''] = input.trim().split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

export function extractBRLCents(text: string): number | null {
  if (typeof text !== 'string' || text.length > 20000) return null;
  // Capture spans, not only values: "R$ 10 reais" is one amount, but
  // "10 reais e R$ 20" is two. Never prefer a currency symbol over other amounts.
  const amounts: { start: number; end: number; cents: number | null }[] = [];
  for (const match of text.matchAll(/R\$\s*([^\s;!?\n]+)/gi)) {
    amounts.push({ start: match.index!, end: match.index! + match[0].length, cents: parseBRLCents(match[1]) });
  }
  for (const match of text.matchAll(/(^|\s)([-+\d][\d.,]*)\s*(?:reais|heais|contos?|pilas?)\b/gi)) {
    const start = match.index! + match[1].length;
    if (!amounts.some(a => start >= a.start && start < a.end)) {
      amounts.push({ start, end: match.index! + match[0].length, cents: parseBRLCents(match[2]) });
    }
  }
  const words: Record<string, number> = { cem: 10000, duzentos: 20000, quinhentos: 50000, mil: 100000 };
  // A supported word inside "dois mil reais" or "cento e cem reais" is NOT
  // the complete amount. Unsupported written amounts stay unconfirmed.
  const written = [...text.toLowerCase().matchAll(/\b([a-zà-ú]+(?:\s+[a-zà-ú]+){0,4})\s+(?:reais|heais|contos?)\b/gu)];
  for (const match of written) {
    const parts = match[1].trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (!(last in words)) continue;
    const previous = parts[parts.length - 2] || '';
    const compound = /^(?:e|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|cem|cento|duzentos|quinhentos|mil)$/.test(previous);
    amounts.push({ start: match.index!, end: match.index! + match[0].length, cents: compound ? null : words[last] });
  }
  return amounts.length === 1 ? amounts[0].cents : null;
}

export function formatBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor em centavos inválido.');
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valores assinados de saldos calculados; lançamentos continuam exigindo magnitude positiva. */
export function parseSignedDatabaseCents(input: unknown): number | null {
  if (typeof input === 'number') { const n = centsFromNumber(Math.abs(input)); return n === null ? null : input < 0 ? -n : n; }
  if (typeof input !== 'string') return null;
  const text = input.trim(); const negative = text.startsWith('-');
  const cents = parseDatabaseCents(negative ? text.slice(1) : text);
  return cents === null ? null : negative ? -cents : cents;
}
/** CSV de planilha: texto não pode virar fórmula ao abrir no Excel. */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
