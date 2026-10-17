import { parseDatabaseCents } from "@/lib/domain/money";

export type Lancamento = {
  business_id?: string | null;
  fluxo?: string | null;
  status?: string | null;
  moeda?: string | null;
  valor_original?: number | string | null;
  valor_brl?: number | string | null;
  valor_liquidado_informado_brl?: number | string | null;
  conta_id?: string | null;
  conta_destino_id?: string | null;
  competencia?: string | null;
  liquidacao?: string | null;
};

const FORA_CAIXA = new Set(["PREVISTO", "CANCELADO", "ABERTO", "VENCIDO"]);
const FORA_DRE = new Set(["PREVISTO", "CANCELADO"]);

function numero(valor: number | string | null | undefined): number | null {
  const cents = parseDatabaseCents(valor);
  return cents === null ? null : cents / 100;
}

/** Usa conversão registrada em BRL; o valor original só é BRL com moeda explícita. */
export function valorEmBrl(linha: Lancamento): number | null {
  if (linha.valor_brl != null) return numero(linha.valor_brl);
  return linha.moeda?.toUpperCase() === "BRL" ? numero(linha.valor_original) : null;
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
    if (FORA_CAIXA.has(status) || !fluxo) continue;
    if (fluxo.startsWith("TRANSFER")) continue;
    if (!["PARCIAL", "PAGO", "RECEBIDO", "ESTORNADO", "LIQUIDADO"].includes(status)) continue;
    if (!linha.business_id || !linha.conta_id) {
      motivos.push("Lançamento liquidado sem empresa ou conta não permite fechar o caixa.");
      continue;
    }

    let valor: number | null = null;
    if (status === "PARCIAL") {
      valor = numero(linha.valor_liquidado_informado_brl);
      if (valor === null) {
        motivos.push("Parcial sem valor liquidado informado fica fora do caixa.");
        continue;
      }
    } else if (status === "PAGO" || status === "RECEBIDO" || status === "ESTORNADO") {
      valor = valorEmBrl(linha);
    }
    if (valor === null) {
      motivos.push(linha.moeda && linha.moeda.toUpperCase() !== "BRL" && linha.valor_brl == null
        ? "Lançamento em outra moeda fica fora do caixa em BRL até a taxa existir."
        : "Lançamento sem valor válido ou conversão confirmada em BRL não permite fechar o caixa.");
      continue;
    }
    if (fluxo.startsWith("SA")) saldo -= valor;
    else if (fluxo.startsWith("ENTRADA")) saldo += valor;
    else continue;
    usados += 1;
  }

  return {
    saldo,
    usados,
    vazio: usados === 0,
    incompleto: motivos.length > 0,
    motivos: [...new Set(motivos)],
  };
}

export function lerDre(linhas: Lancamento[], businessId?: string | readonly string[]) {
  let entradas = 0;
  let saidas = 0;
  let usados = 0;
  const motivos: string[] = [];
  for (const linha of linhas) {
    if (!daEmpresa(linha.business_id, businessId)) continue;
    const status = (linha.status || "").toUpperCase();
    const fluxo = (linha.fluxo || "").toUpperCase();
    if (FORA_DRE.has(status) || fluxo.startsWith("TRANSFER")) continue;
    if (!linha.competencia) { motivos.push("Lançamento sem competência não permite fechar a DRE."); continue; }
    const valor = valorEmBrl(linha);
    if (valor === null) { motivos.push("Lançamento sem valor válido ou conversão confirmada em BRL não permite fechar a DRE."); continue; }
    if (fluxo.startsWith("SA")) saidas += valor;
    else if (fluxo.startsWith("ENTRADA")) entradas += valor;
    else continue;
    usados += 1;
  }
  return { entradas, saidas, resultado: entradas - saidas, usados, vazio: usados === 0, incompleto: motivos.length > 0, motivos: [...new Set(motivos)] };
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

