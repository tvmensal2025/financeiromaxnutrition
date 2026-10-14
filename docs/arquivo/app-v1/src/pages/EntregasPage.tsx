import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Clock3, Copy, FileText, LockKeyhole, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { supabase } from "@/lib/supabase";
import { etapaEntrega } from "@/lib/execucoes-comando";
import { deliveryArtifacts } from "@/lib/entrega-artefatos";
import { DeliveryGallery } from "@/components/DeliveryGallery";
import * as Dialog from "@radix-ui/react-dialog";
import { publicationFor, deliveryFor, hasVisualApproval, isFinalDelivery, isFounderDecision } from "@/lib/publicacao";

type Job = {
  job_id: string;
  task_id: string | null;
  business_id: string;
  agent_id: string;
  correlation_id: string | null;
  objective: string | null;
  status: string;
  approval_required: boolean;
  approval_status: string | null;
  result_summary: string | null;
  result_payload: { reviewer_agent_id?: string; reviewed_by?: string; review_reason?: string; review_pending?: boolean; copy?: string; content?: string; caption?: string; message?: string } | null;
  evidence_refs: string[] | null;
  created_at: string;
  updated_at: string | null;
};

type Task = { task_id: string; business_id: string; tarefa: string; definicao_de_pronto: string | null };
type Evidence = { id: string; related_object_id: string; business_id_area: string; assunto: string | null; registro: string | null; evidencia_origem: string | null; criado_em: string | null };
type Agent = { agent_id: string; agente: string };

const PAGE_SIZE = 80;
const statuses = ["Todas", "Aguardando liberação", "Na fila", "Em produção", "Em revisão", "Ajustes solicitados", "Aprovadas", "Aceite a conferir", "Bloqueadas"] as const;
type StatusFilter = typeof statuses[number];

function stage(job: Job): StatusFilter {
  if (etapaEntrega(job) === 'Aprovadas' && deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).length &&
      !hasVisualApproval(job.result_payload, deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).map(a => a.reference))) return 'Aceite a conferir';
  return etapaEntrega(job);
}

function dateTime(value?: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
}

export default function EntregasPage() {
  const { currentBusinessId, empresas } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [query, setQuery] = useState("");
  const [productionView, setProductionView] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("Todas");
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async (more = false) => {
    const version = ++requestVersion.current;
    if (!more) {
      setJobs([]);
      setTasks([]);
      setEvidence([]);
      setSelected(null);
      setHasMore(false);
    }
    setLoading(true);
    setError(null);
    try {
      const offset = more ? jobs.length : 0;
      let request = supabase.from("agent_jobs").select("job_id,task_id,business_id,agent_id,correlation_id,objective,status,approval_required,approval_status,result_summary,result_payload,evidence_refs,created_at,updated_at")
        .order("updated_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
      if (!(["TODAS", "GRUPO"].includes(currentBusinessId))) request = request.eq("business_id", currentBusinessId);
      const { data, error: jobsError } = await request;
      if (version !== requestVersion.current) return;
      if (jobsError) throw jobsError;
      const batch = (data || []) as Job[];
      const taskIds = [...new Set(batch.map(job => job.task_id).filter((id): id is string => Boolean(id)))];
      const evidenceIds = [...new Set(batch.flatMap(job => Array.isArray(job.evidence_refs) ? job.evidence_refs : []).filter(id => /^MEM-HR-[a-f0-9]{32}$/i.test(id)))];
      const [taskResult, evidenceResult, agentResult] = await Promise.all([
        taskIds.length ? supabase.from("tarefas").select("task_id,business_id,tarefa,definicao_de_pronto").in("task_id", taskIds) : Promise.resolve({ data: [], error: null }),
        evidenceIds.length ? supabase.from("memoria_mestre").select("id,related_object_id,business_id_area,assunto,registro,evidencia_origem,criado_em").in("id", evidenceIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("agentes").select("agent_id,agente"),
      ]);
      if (version !== requestVersion.current) return;
      if (taskResult.error || evidenceResult.error || agentResult.error) throw taskResult.error || evidenceResult.error || agentResult.error;
      setJobs(previous => more ? [...previous, ...batch.filter(job => !previous.some(item => item.job_id === job.job_id))] : batch);
      setTasks(previous => more ? [...previous, ...((taskResult.data || []) as Task[])] : (taskResult.data || []) as Task[]);
      setEvidence(previous => more ? [...previous, ...((evidenceResult.data || []) as Evidence[])] : (evidenceResult.data || []) as Evidence[]);
      setAgents((agentResult.data || []) as Agent[]);
      setHasMore(batch.length === PAGE_SIZE);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : "Não foi possível ler as entregas do Supabase.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [currentBusinessId, jobs.length]);

  useEffect(() => { void load(false); return () => { requestVersion.current++; }; }, [currentBusinessId]);

  useEffect(() => {
    const jobId = searchParams.get("job");
    if (!jobId) return;
    const job = jobs.find(item => item.job_id === jobId);
    if (job && !productionView && !isFounderDecision(job) && !isFinalDelivery(job, deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).map(a => a.reference))) { setSelected(null); return; }
    if (job && selected !== job && (productionView || isFounderDecision(job) || isFinalDelivery(job, deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).map(a => a.reference)))) setSelected(job);
  }, [jobs, searchParams, productionView]);

  useEffect(() => { setCopied(false); setCopyError(false); }, [selected?.job_id]);
  useEffect(() => { setFilter("Todas"); setQuery(""); }, [currentBusinessId]);

  const taskFor = (job: Job) => tasks.find(task => task.task_id === job.task_id && task.business_id === job.business_id);
  const nameFor = (id?: string) => agents.find(agent => agent.agent_id === id)?.agente || id || "Não definido";
  const reviewerFor = (job: Job) => job.result_payload?.reviewed_by
    ? { label: "Revisado por", name: nameFor(job.result_payload.reviewed_by) }
    : job.result_payload?.reviewer_agent_id
      ? { label: "Revisor designado", name: nameFor(job.result_payload.reviewer_agent_id) }
      : job.agent_id === "AGT-12"
        ? { label: "Revisor previsto", name: nameFor("AGT-10") }
        : { label: "Revisor", name: "Atribuído após a entrega" };
  const companyFor = (id: string) => empresas.find(company => company.business_id === id)?.nome || id;
  const evidenceFor = (job: Job) => evidence.filter(item => item.related_object_id === job.job_id && item.business_id_area === job.business_id && job.evidence_refs?.includes(item.id));
  const visible = useMemo(() => jobs.filter(job => {
    if (!productionView && !isFounderDecision(job) && !isFinalDelivery(job, deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).map(a => a.reference))) return false;
    if (!["TODAS", "GRUPO"].includes(currentBusinessId) && job.business_id !== currentBusinessId) return false;
    if (filter !== "Todas" && stage(job) !== filter) return false;
    const text = [job.objective, job.job_id, job.result_summary, taskFor(job)?.tarefa, companyFor(job.business_id), nameFor(job.agent_id)].join(" ").toLocaleLowerCase("pt-BR");
    return text.includes(query.trim().toLocaleLowerCase("pt-BR"));
  }), [jobs, tasks, agents, empresas, currentBusinessId, query, filter, productionView]);

  const counts = useMemo(() => ({
    total: jobs.length,
    review: jobs.filter(job => stage(job) === "Em revisão" || stage(job) === "Aceite a conferir").length,
    approved: jobs.filter(job => stage(job) === "Aprovadas").length,
    blocked: jobs.filter(job => stage(job) === "Bloqueadas" || stage(job) === "Ajustes solicitados").length,
  }), [jobs]);

  const contentFor = (job: Job) => {
    return publicationFor(job.result_payload)?.caption || deliveryFor(job.result_payload)?.content || "A equipe ainda precisa preparar o material pronto para uso. Consulte o andamento da entrega abaixo.";
  };

  const copiarMaterial = async (job: Job) => {
    const content = contentFor(job);
    if (!publicationFor(job.result_payload) && !deliveryFor(job.result_payload)) return;
    setCopyError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const area = document.createElement("textarea");
        area.value = content;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const copiado = document.execCommand("copy");
        area.remove();
        if (!copiado) throw new Error("Clipboard indisponível");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false); setCopyError(true);
    }
  };

  const fecharEntrega = () => {
    setSelected(null);
    window.requestAnimationFrame(() => opener.current?.focus());
    if (searchParams.has("job")) setSearchParams({}, { replace: true });
  };

  return (
    <div className="he-deliveries-library mx-auto max-w-7xl space-y-6 px-4 py-7 md:px-8">
      <div className="he-deliveries-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Sistema Helena / Entregas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ideias que viraram <em>entregas.</em></h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Sua coleção de imagens, textos e materiais aprovados. Tudo reunido para conferir, copiar e usar.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium" onClick={() => void load(false)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher visão de entregas">
        <button className="rounded-full border px-4 py-2 text-sm" aria-pressed={!productionView} onClick={() => { setProductionView(false); setFilter("Todas"); setSelected(null); setSearchParams({}, { replace: true }); }}>Material pronto para usar</button>
        <button className="rounded-full border px-4 py-2 text-sm" aria-pressed={productionView} onClick={() => { setProductionView(true); setFilter("Todas"); }}>Acompanhar produção</button>
      </div>
      {productionView && <p className="rounded-xl border bg-muted p-4 text-sm">Estas são etapas internas da equipe. Um parecer aprovado não significa que a campanha está pronta.</p>}
      {productionView && <div className="he-delivery-summary" aria-label="Resumo das entregas">
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon neutral"><FileText className="h-4 w-4" /></span><span><strong>{counts.total}</strong><small>entregas visíveis</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon amber"><Clock3 className="h-4 w-4" /></span><span><strong>{counts.review}</strong><small>em revisão pela equipe</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon green"><CheckCircle2 className="h-4 w-4" /></span><span><strong>{counts.approved}</strong><small>etapas aprovadas</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon rose"><LockKeyhole className="h-4 w-4" /></span><span><strong>{counts.blocked}</strong><small>com bloqueio ou ajuste</small></span></div>
      </div>}

      <div className="he-library-filters rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar tarefa, post, agente ou empresa" aria-label="Buscar entregas" className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar entregas">
          {(productionView ? statuses : statuses.filter(status => ["Todas", "Aprovadas", "Em revisão"].includes(status))).map(status => <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === status ? "bg-emerald-800 text-white" : "bg-muted text-muted-foreground"}`}>{status}</button>)}
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Falha ao consultar o Supabase: {error}</div>}
      {!loading && !error && visible.length === 0 && <div className="he-library-empty rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground"><div className="he-empty-pages" aria-hidden="true"><span/><span/><span><FileText size={32}/></span></div><h2>{query || filter !== "Todas" ? "Nenhum material com estes filtros." : productionView ? "Nenhuma etapa registrada nesta empresa." : "Seus materiais finais aparecerão aqui."}</h2><p>{query || filter !== "Todas" ? "Limpe a busca ou escolha Todas para ver os materiais disponíveis." : productionView ? "Quando a equipe registrar uma tarefa para esta empresa, você poderá acompanhar aqui." : `${jobs.length}${hasMore ? "+" : ""} registros de produção consultados. As etapas internas ficam em Acompanhar produção; aqui entram as entregas finais e decisões que precisam de você.`}</p>{!productionView && <button type="button" onClick={() => { setProductionView(true); setFilter("Todas"); }}>Acompanhar o que está em produção <ArrowUpRight size={16}/></button>}</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map(job => {
          const task = taskFor(job);
          const phase = stage(job);
          const records = evidenceFor(job);
           return <button key={job.job_id} type="button" onClick={event => { opener.current = event.currentTarget; setSelected(job); setSearchParams({ job: job.job_id }, { replace: true }); }} className="he-delivery-card">
            <DeliveryGallery businessId={job.business_id} jobId={job.job_id} references={job.evidence_refs} title={publicationFor(job.result_payload)?.title || task?.tarefa || "Material da equipe"} compact />
            <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{companyFor(job.business_id)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${phase === "Aprovadas" ? "bg-emerald-100 text-emerald-800" : phase === "Em revisão" || phase === "Aceite a conferir" ? "bg-amber-100 text-amber-800" : phase === "Ajustes solicitados" || phase === "Bloqueadas" ? "bg-rose-100 text-rose-800" : "bg-muted text-foreground"}`}>{phase === "Aprovadas" && !isFinalDelivery(job, deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).map(a => a.reference)) ? "Etapa aprovada" : phase}</span></div>
             <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Clique para abrir a entrega completa</p>
            <h2 className="mt-3 line-clamp-2 text-lg font-semibold">{publicationFor(job.result_payload)?.title || deliveryFor(job.result_payload)?.title || task?.tarefa || job.objective || 'Entrega em preparação'}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{publicationFor(job.result_payload)?.caption || deliveryFor(job.result_payload)?.content || "A equipe está preparando o material para sua conferência."}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground"><span>Responsável: {nameFor(job.agent_id)}</span><span>{reviewerFor(job).label}: {reviewerFor(job).name}</span><span>{records.length} registro(s) · {deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).length} arquivo(s)</span><span>{dateTime(job.updated_at || job.created_at)}</span></div>
          </button>;
        })}
      </div>
      {hasMore && <button disabled={loading} onClick={() => void load(true)} className="rounded-xl border bg-card px-4 py-2 text-sm font-medium">Carregar mais entregas</button>}

      <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) fecharEntrega(); }}>
      {selected && <Dialog.Portal><Dialog.Overlay className="he-delivery-overlay" />
        <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} className="he-delivery-modal he-delivery-accessible-modal">
          <Dialog.Title className="sr-only">Detalhes da entrega</Dialog.Title>
          <div className="he-delivery-modal-head"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{companyFor(selected.business_id)} · {stage(selected)}</p><h2 className="mt-2 text-2xl font-semibold">{publicationFor(selected.result_payload)?.title || deliveryFor(selected.result_payload)?.title || taskFor(selected)?.tarefa || selected.objective || 'Entrega em preparação'}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Confira o material, veja quem revisou e encontre o próximo passo.</p></div><button className="he-modal-close" onClick={fecharEntrega} aria-label="Fechar detalhes"><X className="h-5 w-5" /></button></div>
          <div className="he-delivery-stepper" aria-label={`Etapa atual: ${stage(selected)}`}><span className="done">Pedido</span><span className={stage(selected) === "Aguardando liberação" ? "current" : "done"}>Despacho</span><span className={stage(selected) === "Em produção" || stage(selected) === "Na fila" ? "current" : ["Em revisão", "Ajustes solicitados", "Aprovadas", "Aceite a conferir"].includes(stage(selected)) ? "done" : ""}>Produção</span><span className={stage(selected) === "Em revisão" || stage(selected) === "Ajustes solicitados" ? "current" : stage(selected) === "Aprovadas" ? "done" : ""}>Revisão</span><span className={isFinalDelivery(selected, deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id).map(a => a.reference)) ? "done" : ""}>Pronto</span></div>
          <p className="mt-5 text-sm text-muted-foreground">Criado por {nameFor(selected.agent_id)} · {dateTime(selected.updated_at || selected.created_at)}</p>
          {stage(selected) === 'Aceite a conferir' && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Este material ainda precisa de conferência de conteúdo e qualidade visual. Não está pronto para publicação.</p>}
          {!isFinalDelivery(selected, deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id).map(a => a.reference)) && <p className="he-delivery-review-note" role="status">{isFounderDecision(selected) ? "A equipe precisa de uma decisão sua para continuar." : "Material de produção: a equipe ainda precisa concluir a revisão e a entrega final."}</p>}
          <DeliveryGallery key={selected.job_id} businessId={selected.business_id} jobId={selected.job_id} references={selected.evidence_refs} title={publicationFor(selected.result_payload)?.title || taskFor(selected)?.tarefa || "Material da equipe"} />
          {publicationFor(selected.result_payload) && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border p-5"><h3 className="font-semibold">Estratégia do material</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{publicationFor(selected.result_payload)?.strategy}</p></article><article className="rounded-xl border p-5"><h3 className="font-semibold">Como usar</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{publicationFor(selected.result_payload)?.instructions}</p></article></section>}
          <section className="he-copy-ready"><div className="he-section-title"><div><p className="he-eyebrow">MATERIAL PARA USAR</p><h3>{isFinalDelivery(selected, deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id).map(a => a.reference)) ? "Texto pronto para copiar" : "Texto desta etapa"}</h3><p>O conteúdo preparado para você, separado do histórico interno da equipe.</p></div><button type="button" className="he-copy-button" onClick={() => void copiarMaterial(selected)} disabled={!publicationFor(selected.result_payload) && !deliveryFor(selected.result_payload)}><Copy className="h-4 w-4" />{copied ? "Copiado" : "Copiar texto"}</button></div>{copyError && <p role="alert">Não foi possível copiar automaticamente. Selecione o texto abaixo e copie.</p>}<textarea readOnly value={contentFor(selected)} aria-label="Texto pronto da entrega" className="he-copy-textarea" /></section>
          {!publicationFor(selected.result_payload) && deliveryFor(selected.result_payload) && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border p-5"><h3 className="font-semibold">Seu próximo passo</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{deliveryFor(selected.result_payload)?.next_steps}</p></article><article className="rounded-xl border p-5"><h3 className="font-semibold">O que precisa da sua atenção</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{deliveryFor(selected.result_payload)?.limitations}</p></article></section>}
          <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Histórico da produção e revisão</summary><p className="mt-3 break-all text-xs text-muted-foreground">Tarefa {selected.task_id || '—'} · {selected.job_id}</p><p className="mt-3 text-sm">{taskFor(selected)?.definicao_de_pronto}</p>
          <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" /> Registro interno</h3><p className="mt-3 whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed">{selected.result_summary || "O agente ainda não registrou uma entrega."}</p></section>
          <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> Revisão</h3><p className="mt-3 rounded-xl border bg-card p-4 text-sm">{selected.result_payload?.reviewed_by ? `${nameFor(selected.result_payload.reviewed_by)}: ${selected.result_payload.review_reason || "Revisão registrada sem observação."}` : selected.result_payload?.review_pending ? `Aguardando ${reviewerFor(selected).name}.` : selected.status === "DRAFT" ? "Aguardando liberação da coordenação. O agente ainda não foi chamado." : `Ainda não enviada para revisão. ${reviewerFor(selected).label}: ${reviewerFor(selected).name}.`}</p></section>
          </details>
          <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Consultar fontes e comprovantes</summary>{evidenceFor(selected).map(item => <article key={item.id} className="mt-3 rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{item.assunto || item.id}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.registro || "Sem descrição"}</p><p className="mt-2 text-xs text-muted-foreground">Fonte: {item.evidencia_origem || "Não informada"} · {dateTime(item.criado_em)}</p></article>)}</details>
        </Dialog.Content>
      </Dialog.Portal>}
      </Dialog.Root>
    </div>
  );
}
