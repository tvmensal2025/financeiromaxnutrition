import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Compass, ExternalLink, Receipt, Shield, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { lerPaginas } from "@/lib/leitura-paginada";
const diaSaoPaulo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

type Foco = { id: string; frente: string | null; status: string | null; responsavel: string | null; criterio_de_saida: string | null };
type Portfolio = { business_id: string; negocio: string | null; principal_gargalo: string | null; objetivo_atual: string | null; kpi_principal: string | null };
type Valor = number | string | null;
type Oportunidade = { business_id: string; etapa: string | null; status: string | null; valor_potencial: Valor; valor_potencial_brl: Valor; moeda: string | null; probabilidade: Valor };
type Lancamento = { business_id: string; fluxo: string | null; status: string | null; valor_original: Valor; valor_brl: Valor; valor_assinado_brl: Valor; movimento_caixa_brl: Valor; moeda: string | null; liquidacao: string | null };
type Risco = { risk_id: string; business_id: string; risco: string | null; impacto: string | null; status: string | null };
type Dados = { focos: Foco[]; portfolio: Portfolio[]; oportunidades: Oportunidade[]; lancamentos: Lancamento[]; riscos: Risco[] };
type Estado = { chave: string; dados: Dados | null; erro: boolean; carregando: boolean };

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function numero(valor: Valor | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = valor.trim();
  const padronizado = /^-?\d{1,3}(\.\d{3})+,\d+$/.test(texto)
    ? texto.replace(/\./g, "").replace(",", ".")
    : /^-?\d+,\d+$/.test(texto) ? texto.replace(",", ".") : texto;
  return /^-?\d+(\.\d+)?$/.test(padronizado) && Number.isFinite(Number(padronizado)) ? Number(padronizado) : null;
}
const fluxoDe = (fluxo: string | null) => (fluxo ?? "").trim().toUpperCase();
function valorFinanceiroBrl(item: Lancamento): number | null {
  const movimento = numero(item.movimento_caixa_brl);
  if (movimento !== null) return movimento;
  const assinado = numero(item.valor_assinado_brl);
  if (assinado !== null) return assinado;
  const valor = numero(item.valor_brl) ?? (item.moeda?.toUpperCase() === "BRL" ? numero(item.valor_original) : null);
  if (valor === null) return null;
  return fluxoDe(item.fluxo) === "ENTRADA" ? valor : -valor;
}
function valorCrmBrl(item: Oportunidade): number | null {
  return numero(item.valor_potencial_brl) ?? (item.moeda?.toUpperCase() === "BRL" ? numero(item.valor_potencial) : null);
}
const ETAPAS_ABERTAS = new Set(["PROSPECCAO", "PROSPECÇÃO", "QUALIFICACAO", "QUALIFICAÇÃO", "APRESENTACAO", "APRESENTAÇÃO", "PROPOSTA", "NEGOCIACAO", "NEGOCIAÇÃO"]);
const STATUS_ABERTOS = new Set(["ATIVO", "ABERTO", "EM ANDAMENTO"]);
const oportunidadeAberta = (item: Oportunidade) =>
  ETAPAS_ABERTAS.has((item.etapa ?? "").trim().toUpperCase()) && STATUS_ABERTOS.has((item.status ?? "").trim().toUpperCase());

export default function IndicadoresPage() {
  const { currentBusinessId, isConsolidated, selecionadas } = useBusiness();
  const idsSelecionados = isConsolidated ? [...selecionadas].sort().join("|") : currentBusinessId;
  const chave = isConsolidated ? `consolidado:${idsSelecionados}` : currentBusinessId;
  const [revisao, setRevisao] = useState(0);
  const [estado, setEstado] = useState<Estado>({ chave, dados: null, erro: false, carregando: true });

  useEffect(() => {
    let ativo = true;
    setEstado({ chave, dados: null, erro: false, carregando: true });
    async function carregar() {
      if (!isConsolidated && !currentBusinessId) {
        if (ativo) setEstado({ chave, dados: null, erro: false, carregando: false });
        return;
      }
      try {
        const ids = isConsolidated ? idsSelecionados.split('|').filter(Boolean) : [currentBusinessId];
        const ler = <T,>(tabela: string, colunas: string, chavePrimaria: string, escopo = true) => lerPaginas<T>((inicio, fim) => {
          let q = supabase.from(tabela).select(colunas, { count: 'exact' }).order(chavePrimaria).range(inicio, fim);
          if (escopo) q = q.in('business_id', ids);
          return q.returns<T[]>();
        });
        const [foco, portfolio, crm, financeiro, riscos] = await Promise.all([
          ler<Foco>('foco_executivo', 'id,frente,status,responsavel,criterio_de_saida', 'id', false),
          ler<Portfolio>('portfolio', 'business_id,negocio,principal_gargalo,objetivo_atual,kpi_principal', 'business_id'),
          ler<Oportunidade>('crm', 'business_id,etapa,status,valor_potencial,valor_potencial_brl,moeda,probabilidade', 'opportunity_id'),
          ler<Lancamento>('financeiro', 'business_id,fluxo,status,valor_original,valor_brl,valor_assinado_brl,movimento_caixa_brl,moeda,liquidacao', 'finance_id'),
          ler<Risco>('riscos', 'risk_id,business_id,risco,impacto,status', 'risk_id'),
        ]);
        if ([foco, portfolio, crm, financeiro, riscos].some((item) => item.error)) throw new Error("Consulta indisponível");
        const noEscopo = (businessId: string) => isConsolidated ? idsSelecionados.split("|").includes(businessId) : businessId === currentBusinessId;
        if (ativo) setEstado({
          chave, erro: false, carregando: false,
          dados: {
            focos: (foco.data ?? []) as Foco[],
            portfolio: ((portfolio.data ?? []) as Portfolio[]).filter((item) => noEscopo(item.business_id)),
            oportunidades: ((crm.data ?? []) as Oportunidade[]).filter((item) => noEscopo(item.business_id)),
            lancamentos: ((financeiro.data ?? []) as Lancamento[]).filter((item) => noEscopo(item.business_id)),
            riscos: ((riscos.data ?? []) as Risco[]).filter((item) => noEscopo(item.business_id)),
          },
        });
      } catch {
        if (ativo) setEstado({ chave, dados: null, erro: true, carregando: false });
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [chave, currentBusinessId, isConsolidated, idsSelecionados, revisao]);

  // A chave bloqueia a exibição da empresa anterior antes mesmo de o novo efeito executar.
  const dados = estado.chave === chave ? estado.dados : null;
  const carregando = estado.chave !== chave || estado.carregando;
  const focoAtivo = dados?.focos.find((item) => item.status?.toUpperCase() === "EM EXECUÇÃO");
  const proximoFoco = dados?.focos.find((item) => /PLANEJADO|AGUARDANDO/i.test(item.status ?? ""));
  const negocio = isConsolidated ? null : dados?.portfolio.find((item) => item.business_id === currentBusinessId);
  const riscosAbertos = dados?.riscos.filter((item) => item.status?.trim().toUpperCase() === "ABERTO") ?? [];
  const escopo = isConsolidated ? "Grupo consolidado" : negocio?.negocio || currentBusinessId || "Empresa não selecionada";

  const metricas = useMemo(() => {
    const lancamentos = dados?.lancamentos ?? [];
    const oportunidades = dados?.oportunidades ?? [];
    const liquidados = lancamentos.filter((item) => /^(RECEBIDO|PAGO|LIQUIDADO)$/i.test(item.status ?? ""));
    const validos = liquidados.filter((item) => valorFinanceiroBrl(item) !== null && /^(ENTRADA|SAÍDA|SAIDA)$/.test(fluxoDe(item.fluxo)));
    const caixa = validos.length === liquidados.length && validos.length > 0
      ? moeda(validos.reduce((total, item) => total + valorFinanceiroBrl(item)!, 0)) : null;
    const abertas = oportunidades.filter(oportunidadeAberta);
    const comValor = abertas.filter((item) => valorCrmBrl(item) !== null);
    const pipeline = comValor.length === abertas.length && abertas.length > 0
      ? moeda(comValor.reduce((total, item) => total + valorCrmBrl(item)!, 0)) : null;
    const comProbabilidade = comValor.filter((item) => {
      const probabilidade = numero(item.probabilidade);
      return probabilidade !== null && probabilidade >= 0 && probabilidade <= 100;
    });
    const previsao = comProbabilidade.length === abertas.length && abertas.length > 0
      ? moeda(comProbabilidade.reduce((total, item) => total + valorCrmBrl(item)! * numero(item.probabilidade)! / 100, 0)) : null;
    const mesAtual = diaSaoPaulo().slice(0, 7);
    const entradas = liquidados.filter((item) => fluxoDe(item.fluxo) === "ENTRADA" && item.liquidacao?.startsWith(mesAtual));
    const receita = entradas.length > 0 && entradas.every((item) => valorFinanceiroBrl(item) !== null)
      ? moeda(entradas.reduce((total, item) => total + valorFinanceiroBrl(item)!, 0)) : null;
    return { caixa, pipeline, previsao, receita, abertas: abertas.length };
  }, [dados]);

  if (carregando) return <ExecutiveLoadingState type="cards" rows={4} />;
  if (estado.erro) return <ExecutiveErrorState moduleName="o painel" message="Não foi possível consultar os dados agora. Tente novamente." onRetry={() => setRevisao((valor) => valor + 1)} />;

  return (
    <div className="he-business-indicators space-y-6 pb-8">
      <ExecutivePageHeader title="Indicadores do negócio" icon={Target} description={`Prioridades e resultados · ${escopo}`} />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]" aria-label="Foco executivo do grupo">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foco executivo do grupo</p>
          {focoAtivo ? <div className="mt-4 space-y-3">
            <h2 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{focoAtivo.frente || "Foco sem título"}</h2>
            <div className="flex flex-wrap items-center gap-2"><ExecutiveBadge variant="success" size="sm">{focoAtivo.status}</ExecutiveBadge><span className="text-xs text-muted-foreground">{focoAtivo.id}</span></div>
            {focoAtivo.criterio_de_saida && <p className="text-sm leading-relaxed text-muted-foreground">Critério de saída: {focoAtivo.criterio_de_saida}</p>}
            {focoAtivo.responsavel && <p className="text-xs text-muted-foreground">Responsável: {focoAtivo.responsavel}</p>}
          </div> : <p className="mt-4 text-sm text-muted-foreground">Nenhum foco em execução foi encontrado na consulta.</p>}
          <Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline" to="/modulo/foco_executivo">Consultar focos <ArrowRight size={16} /></Link>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próxima prioridade do grupo</p>
          {proximoFoco ? <div className="mt-4 space-y-2"><h3 className="break-words text-base font-semibold text-foreground">{proximoFoco.frente || "Prioridade sem título"}</h3><p className="text-xs text-muted-foreground">{proximoFoco.id} · {proximoFoco.status}</p>{proximoFoco.responsavel && <p className="text-xs text-muted-foreground">Responsável: {proximoFoco.responsavel}</p>}</div> : <p className="mt-4 text-sm text-muted-foreground">Nenhuma próxima prioridade foi encontrada.</p>}
        </div>
      </section>
      <section className="space-y-3" aria-label="Números essenciais">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold text-foreground">Números essenciais · {escopo}</h2><p className="text-xs text-muted-foreground">Dados consultados em CRM e financeiro</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ExecutiveMetricCard label="Caixa realizado" value={metricas.caixa} hasData={metricas.caixa !== null} subtext="Saldo dos lançamentos liquidados consultados." icon={Receipt} />
          <ExecutiveMetricCard label="Pipeline comercial" value={metricas.pipeline} hasData={metricas.pipeline !== null} subtext={metricas.abertas ? `${metricas.abertas} ${metricas.abertas === 1 ? "oportunidade" : "oportunidades"} com etapa e status abertos reconhecidos.` : "Nenhuma oportunidade com etapa e status abertos reconhecidos."} icon={Target} />
          <ExecutiveMetricCard label="Previsão ponderada" value={metricas.previsao} hasData={metricas.previsao !== null} subtext="Exige valor e probabilidade registrados." icon={Compass} />
          <ExecutiveMetricCard label="Receita do mês" value={metricas.receita} hasData={metricas.receita !== null} subtext="Entradas com liquidação registrada no mês." icon={Building2} />
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Acompanhamento">
        <div className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-foreground">Riscos registrados · {escopo}</h2><Link className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline" to="/modulo/riscos">Ver riscos <ExternalLink size={14} className="ml-1" /></Link></div>
          {riscosAbertos.length ? <div className="mt-3 space-y-2">{riscosAbertos.slice(0, 3).map((item) => <div key={item.risk_id} className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words text-sm font-medium text-foreground">{item.risco || "Risco sem descrição"}</p>{item.impacto && <ExecutiveBadge variant="default" size="sm">{item.impacto}</ExecutiveBadge>}</div><p className="mt-1 text-xs text-muted-foreground">{[isConsolidated && item.business_id, item.status].filter(Boolean).join(" · ")}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum risco em aberto foi encontrado na consulta.</p>}
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-foreground">Contexto do portfólio · {escopo}</h2><Link className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline" to="/portfolio">Abrir portfólio <ExternalLink size={14} className="ml-1" /></Link></div>
          {isConsolidated ? <p className="mt-3 text-sm text-muted-foreground">{dados?.portfolio.length ? `${dados.portfolio.length} ${dados.portfolio.length === 1 ? "empresa retornada" : "empresas retornadas"} na consulta. Selecione uma empresa para ver seus objetivos e indicadores.` : "Nenhuma empresa foi encontrada no portfólio consultado."}</p> : negocio ? <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><div><dt className="text-xs font-semibold text-muted-foreground">Principal gargalo</dt><dd className="mt-1 break-words text-sm text-foreground">{negocio.principal_gargalo || "Sem registro"}</dd></div><div><dt className="text-xs font-semibold text-muted-foreground">Objetivo atual</dt><dd className="mt-1 break-words text-sm text-foreground">{negocio.objetivo_atual || "Sem registro"}</dd></div><div><dt className="text-xs font-semibold text-muted-foreground">KPI principal</dt><dd className="mt-1 break-words text-sm text-foreground">{negocio.kpi_principal || "Sem registro"}</dd></div></dl> : <p className="mt-3 text-sm text-muted-foreground">Nenhum registro desta empresa foi encontrado no portfólio consultado.</p>}
        </div>
      </section>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Shield size={14} /> Os números exibidos refletem apenas os registros retornados para o escopo selecionado.</p>
    </div>
  );
}
