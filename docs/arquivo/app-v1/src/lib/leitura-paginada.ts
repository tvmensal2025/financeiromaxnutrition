export type Pagina<T> = { data: T[] | null; error: unknown; count: number | null };

// Avança pelo número efetivamente recebido, inclusive quando o servidor limita a página.
export async function lerPaginas<T>(consultar: (inicio: number, fim: number) => PromiseLike<Pagina<T>>, signal?: AbortSignal): Promise<Pagina<T>> {
  const data: T[] = [];
  let count: number | null = null;
  while (!signal?.aborted) {
    const pagina = await consultar(data.length, data.length + 999);
    if (pagina.error) return { data: null, error: pagina.error, count: pagina.count };
    count = pagina.count;
    const rows = pagina.data ?? [];
    data.push(...rows);
    if (!rows.length || (count !== null && data.length >= count)) return { data, error: null, count };
    if (count === null && rows.length < 1000) return { data, error: null, count };
  }
  return { data: null, error: new Error("Consulta interrompida"), count };
}
