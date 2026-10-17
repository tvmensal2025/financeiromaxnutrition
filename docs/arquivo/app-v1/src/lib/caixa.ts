export type Lancamento = {
  business_id?: string | null;
  fluxo?: string | null;
  status?: string | null;
  moeda?: string | null;
  valor_original?: number | string | null;
  valor_liquidado_informado_brl?: number | string | null;
  conta_id?: string | null;
  conta_destino_id?: string | null;
  competencia?: string | null;
  liquidacao?: string | null;
};

const FORA_CAIXA = new Set(["PREVISTO", "CANCELADO", "ABERTO", "VENCIDO"]);
const FORA_DRE = new Set(["PREVISTO", "CANCELADO"]);

function numero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function daEmpresa(id: string | null | undefined, filtro?: string | readonly string[]) {
  if (!filtro) return true;
  const lista = typeof filtro === "string" ? [filtro] : filtro;
  return !!id && lista.includes(id);
}

export function lerCaixa(linhas: Lancamento[], businessId?: string | readonly string[]) {
  const motivos: string[] = [];
  let saldo = 0;
  let usados = 0;

  for (const linha of linhas) {
    if (!daEmpresa(linha.business_id, businessId)) continue;
    const status = (linha.status || "").toUpperCase();
    const fluxo = (linha.fluxo || "").toUpperCase();
    if (!linha.business_id || !linha.conta_id || FORA_CAIXA.has(status) || !fluxo) continue;
    if (fluxo.startsWith("TRANSFER")) continue;

    let valor: number | null = null;
    if (status === "PARCIAL") {
      valor = numero(linha.valor_liquidado_informado_brl);
      if (valor === null) {
        motivos.push("Parcial sem valor liquidado informado fica fora do caixa.");
        continue;
      }
    } else if (status === "PAGO" || status === "RECEBIDO" || status === "ESTORNADO") {
      if ((linha.moeda || "BRL").toUpperCase() !== "BRL") {
        motivos.push("Lançamento em outra moeda fica fora do caixa em BRL até a taxa existir.");
        continue;
      }
      valor = numero(linha.valor_original);
    }
    if (valor === null) continue;
    if (fluxo.startsWith("SA")) saldo -= valor;
    else if (fluxo.startsWith("ENTRADA")) saldo += valor;
    usados += 1;
  }

  return {
    saldo,
    usados,
    vazio: usados === 0,
    motivos: [...new Set(motivos)],
  };
}

export function lerDre(linhas: Lancamento[], businessId?: string | readonly string[]) {
  let entradas = 0;
  let saidas = 0;
  let usados = 0;
  for (const linha of linhas) {
    if (!daEmpresa(linha.business_id, businessId)) continue;
    const status = (linha.status || "").toUpperCase();
    const fluxo = (linha.fluxo || "").toUpperCase();
    if (!linha.competencia || FORA_DRE.has(status) || fluxo.startsWith("TRANSFER")) continue;
    if ((linha.moeda || "BRL").toUpperCase() !== "BRL") continue;
    const valor = numero(linha.valor_original);
    if (valor === null) continue;
    if (fluxo.startsWith("SA")) saidas += valor;
    else if (fluxo.startsWith("ENTRADA")) entradas += valor;
    else continue;
    usados += 1;
  }
  return { entradas, saidas, resultado: entradas - saidas, usados, vazio: usados === 0 };
}

/** DRE restrita a um mês de competência (AAAA-MM). */
export function lerDreMes(linhas: Lancamento[], yyyyMm: string, businessId?: string | readonly string[]) {
  const noMes = linhas.filter((l) => (l.competencia || "").slice(0, 7) === yyyyMm);
  return lerDre(noMes, businessId);
}

export function variacaoPercentual(atual: number, anterior: number): number | undefined {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return undefined;
  if (anterior === 0) return atual === 0 ? undefined : undefined;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
