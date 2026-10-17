import { describe, it, expect, vi } from "vitest";
import { lerPaginas } from "./leitura-paginada";

describe("leitura completa", () => {
  it("lê além do limite do servidor sem omitir registros", async () => {
    const rows = Array.from({ length: 1479 }, (_, id) => ({ id }));
    const ler = vi.fn(async (inicio: number) => ({ data: rows.slice(inicio, inicio + 500), count: rows.length, error: null }));
    const resposta = await lerPaginas(ler);
    expect(resposta.data).toEqual(rows);
    expect(ler.mock.calls.map(c => c[0])).toEqual([0, 500, 1000]);
  });
  it("não transforma falha da segunda página em leitura completa", async () => {
    const ler = vi.fn().mockResolvedValueOnce({ data: [1], count: 2, error: null }).mockResolvedValueOnce({ data: null, count: null, error: "negado" });
    expect(await lerPaginas(ler)).toEqual({ data: null, count: null, error: "negado" });
  });
  it("continua após página curta quando a contagem não está disponível", async () => {
    const rows = [1, 2, 3];
    const ler = vi.fn(async (inicio: number) => ({ data: rows.slice(inicio, inicio + 2), count: null, error: null }));
    expect((await lerPaginas(ler)).data).toEqual(rows);
    expect(ler.mock.calls.map(c => c[0])).toEqual([0, 2, 3]);
  });
  it("interrompe a consulta cancelada", async () => {
    const controller = new AbortController(); controller.abort();
    const ler = vi.fn();
    expect((await lerPaginas(ler, controller.signal)).error).toBeTruthy();
    expect(ler).not.toHaveBeenCalled();
  });
});
