const formatoBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Exibe o instante persistido; não inventa horário ou fuso para texto legado. */
export function dataHora(valor: string | null | undefined): string {
  if (!valor?.trim()) return 'Sem horário registrado';
  const texto = valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(texto)) {
    return 'Horário não confirmado';
  }
  const normalizado = texto.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const instante = new Date(normalizado);
  return Number.isNaN(instante.getTime()) ? 'Horário não confirmado' : `${formatoBrasilia.format(instante)} · Brasília`;
}
