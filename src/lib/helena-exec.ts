import { supabase } from "@/lib/supabase";
import {
  classificar,
  prefixoDe,
  proximoId,
  type Contexto,
  type Plano,
} from "@/lib/helena";

async function idsDe(tabela: string, coluna: string) {
  const { data, error } = await supabase.from(tabela).select(coluna);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => String((row as unknown as Record<string, unknown>)[coluna] || ""));
}

async function carregarContexto(): Promise<Contexto> {
  const [foco, portfolio] = await Promise.all([
    supabase.from("foco_executivo").select("id,frente,status").eq("status", "EM EXECUÇÃO"),
    supabase.from("portfolio").select("business_id,negocio,principal_gargalo").order("business_id"),
  ]);
  if (foco.error) throw new Error(foco.error.message);
  if (portfolio.error) throw new Error(portfolio.error.message);
  const atual = (foco.data || [])[0] as { id?: string; frente?: string; status?: string } | undefined;
  return {
    focoId: atual?.id || null,
    focoFrente: atual?.frente || null,
    focoStatus: atual?.status || null,
    negocios: ((portfolio.data || []) as { business_id: string; negocio: string; principal_gargalo: string }[]).map(
      (item) => ({
        business_id: item.business_id,
        negocio: item.negocio,
        gargalo: item.principal_gargalo,
      }),
    ),
  };
}

async function aplicarIds(plano: Plano) {
  const usados = new Map<string, string>();
  for (const escrita of plano.escritas) {
    for (const [campo, valor] of Object.entries(escrita.row)) {
      if (typeof valor !== "string" || !valor.startsWith("{{")) continue;
      const spec = prefixoDe(valor);
      if (!spec) continue;
      if (!usados.has(valor)) {
        const ids = await idsDe(spec.tabela, spec.coluna);
        usados.set(valor, await proximoId(ids, spec.prefixo));
      }
      escrita.row[campo] = usados.get(valor) || valor;
    }
  }

  if (plano.comprovante_financeiro && plano.comprovante_financeiro.finance_id.startsWith("{{")) {
    const finId = usados.get("{{FIN}}");
    if (finId) {
      plano.comprovante_financeiro.finance_id = finId;
    }
  }
}

export async function falarComHelena(texto: string) {
  const ctx = await carregarContexto();
  const agora = new Date().toISOString();
  const plano = classificar(texto, ctx, agora);
  await aplicarIds(plano);

  for (const conta of plano.garantirContas) {
    const { data, error } = await supabase
      .from("contas_financeiras")
      .select("conta_id,business_id")
      .eq("conta_id", conta.conta_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data && data.business_id && data.business_id !== conta.business_id) {
      throw new Error(`A conta ${conta.conta_id} pertence a ${data.business_id}. Não vou usá-la em ${conta.business_id}.`);
    }
    if (!data) {
      const { error: insertError } = await supabase.from("contas_financeiras").insert({
        conta_id: conta.conta_id,
        business_id: conta.business_id,
        nome: conta.conta_id,
        moeda: conta.moeda,
        ativa: "SIM",
        source_system: "HELENA",
        sync_status: "INTERNO",
        observacoes: "Conta citada pelo fundador. Saldo inicial é DADO A COLETAR.",
      });
      if (insertError) throw new Error(insertError.message);
    }
  }

  const gravou: string[] = [];
  for (const escrita of plano.escritas) {
    const { error } = await supabase.from(escrita.tabela).insert(escrita.row);
    if (error) throw new Error(`${escrita.tabela}: ${error.message}`);
    const id = escrita.row.id || escrita.row.finance_id || escrita.row.task_id || escrita.row.job_id || escrita.row.opportunity_id || escrita.row.ticket_id || escrita.row.business_id;
    gravou.push(`${escrita.tabela} ${id || ""}`.trim());
  }

  return { plano, gravou, ctx };
}
