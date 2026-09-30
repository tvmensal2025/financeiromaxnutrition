import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, Copy, FileText, Image, LockKeyhole, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { supabase } from "@/lib/supabase";
import { etapaEntrega } from "@/lib/execucoes-comando";
import { deliveryArtifacts } from "@/lib/entrega-artefatos";
import { signedMedia } from "@/lib/media-client";
import { publicationFor, deliveryFor, hasVisualApproval } from "@/lib/publicacao";

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
  const [filter, setFilter] = useState<StatusFilter>("Todas");
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [artifactUrls, setArtifactUrls] = useState<Record<string, string>>({});
  const [artifactError, setArtifactError] = useState<string | null>(null);
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
    if (job && selected?.job_id !== job.job_id) setSelected(job);
  }, [jobs, searchParams, selected?.job_id]);

  useEffect(() => {
    let active = true;
    setArtifactUrls({});
    setArtifactError(null);
    if (!selected) return () => { active = false; };
    const assets = deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id);
    if (!assets.length) return () => { active = false; };
    void signedMedia(selected.business_id, assets.map(asset => asset.reference), selected.job_id)
      .then(data => {
        if (!active) return;
        if (!data) { setArtifactError("Não foi possível abrir os arquivos desta entrega."); return; }
        const urls: Record<string, string> = {};
        for (const item of data) {
          if (item.error || !item.url || !item.path) continue;
          urls[item.path] = item.url;
        }
        setArtifactUrls(urls);
        if (Object.keys(urls).length !== assets.length) setArtifactError("Alguns arquivos ainda não estão disponíveis. A entrega precisa de conferência.");
      }).catch(() => { if (active) setArtifactError("Não foi possível abrir os arquivos desta entrega. Tente novamente."); });
    return () => { active = false; };
  }, [selected]);

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
    if (!["TODAS", "GRUPO"].includes(currentBusinessId) && job.business_id !== currentBusinessId) return false;
    if (filter !== "Todas" && stage(job) !== filter) return false;
    const text = [job.objective, job.job_id, job.result_summary, taskFor(job)?.tarefa, companyFor(job.business_id), nameFor(job.agent_id)].join(" ").toLocaleLowerCase("pt-BR");
    return text.includes(query.trim().toLocaleLowerCase("pt-BR"));
  }), [jobs, tasks, agents, empresas, currentBusinessId, query, filter]);

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
    if (content.startsWith("O agente ainda não")) return;
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
      setCopied(false);
    }
  };

  const fecharEntrega = () => {
    setSelected(null);
    if (searchParams.has("job")) setSearchParams({}, { replace: true });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Sistema Helena / Entregas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sua caixa de entregas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Aqui chega tudo o que a equipe produziu. Abra um cartão para ver o pedido, o material pronto, a revisão e as evidências.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium" onClick={() => void load(false)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="he-delivery-summary" aria-label="Resumo das entregas">
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon neutral"><FileText className="h-4 w-4" /></span><span><strong>{counts.total}</strong><small>entregas visíveis</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon amber"><Clock3 className="h-4 w-4" /></span><span><strong>{counts.review}</strong><small>pedem sua conferência</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon green"><CheckCircle2 className="h-4 w-4" /></span><span><strong>{counts.approved}</strong><small>aprovadas</small></span></div>
        <div className="he-delivery-summary-card"><span className="he-delivery-summary-icon rose"><LockKeyhole className="h-4 w-4" /></span><span><strong>{counts.blocked}</strong><small>com bloqueio ou ajuste</small></span></div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar tarefa, post, agente ou empresa" aria-label="Buscar entregas" className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar entregas">
          {statuses.map(status => <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === status ? "bg-emerald-800 text-white" : "bg-muted text-muted-foreground"}`}>{status}</button>)}
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Falha ao consultar o Supabase: {error}</div>}
      {!loading && !error && visible.length === 0 && <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">Nenhuma entrega encontrada para este filtro.</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map(job => {
          const task = taskFor(job);
          const phase = stage(job);
          const records = evidenceFor(job);
           return <button key={job.job_id} type="button" onClick={() => { setSelected(job); setSearchParams({ job: job.job_id }, { replace: true }); }} className="he-delivery-card">
            <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{companyFor(job.business_id)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${phase === "Aprovadas" ? "bg-emerald-100 text-emerald-800" : phase === "Em revisão" || phase === "Aceite a conferir" ? "bg-amber-100 text-amber-800" : phase === "Ajustes solicitados" || phase === "Bloqueadas" ? "bg-rose-100 text-rose-800" : "bg-muted text-foreground"}`}>{phase}</span></div>
             <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Clique para abrir a entrega completa</p>
            <h2 className="mt-3 line-clamp-2 text-lg font-semibold">{publicationFor(job.result_payload)?.title || deliveryFor(job.result_payload)?.title || task?.tarefa || job.objective || 'Entrega em preparação'}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{publicationFor(job.result_payload)?.caption || deliveryFor(job.result_payload)?.content || "A equipe está preparando o material para sua conferência."}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground"><span>Responsável: {nameFor(job.agent_id)}</span><span>{reviewerFor(job).label}: {reviewerFor(job).name}</span><span>{records.length} registro(s) · {deliveryArtifacts(job.evidence_refs, job.business_id, job.job_id).length} arquivo(s)</span><span>{dateTime(job.updated_at || job.created_at)}</span></div>
          </button>;
        })}
      </div>
      {hasMore && <button disabled={loading} onClick={() => void load(true)} className="rounded-xl border bg-card px-4 py-2 text-sm font-medium">Carregar mais entregas</button>}

      {selected && <div className="he-delivery-overlay" onClick={fecharEntrega}>
        <section role="dialog" aria-modal="true" aria-label="Detalhes da entrega" onClick={event => event.stopPropagation()} className="he-delivery-modal">
          <div className="he-delivery-modal-head"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{companyFor(selected.business_id)} · {stage(selected)}</p><h2 className="mt-2 text-2xl font-semibold">{publicationFor(selected.result_payload)?.title || deliveryFor(selected.result_payload)?.title || taskFor(selected)?.tarefa || selected.objective || 'Entrega em preparação'}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Confira o material, veja quem revisou e encontre o próximo passo.</p></div><button className="he-modal-close" onClick={fecharEntrega} aria-label="Fechar detalhes"><X className="h-5 w-5" /></button></div>
          <div className="he-delivery-stepper" aria-label={`Etapa atual: ${stage(selected)}`}><span className="done">Pedido</span><span className={stage(selected) === "Aguardando liberação" ? "current" : "done"}>Despacho</span><span className={stage(selected) === "Em produção" || stage(selected) === "Na fila" ? "current" : ["Em revisão", "Ajustes solicitados", "Aprovadas", "Aceite a conferir"].includes(stage(selected)) ? "done" : ""}>Produção</span><span className={stage(selected) === "Em revisão" || stage(selected) === "Ajustes solicitados" ? "current" : stage(selected) === "Aprovadas" ? "done" : ""}>Revisão</span><span className={stage(selected) === "Aprovadas" ? "done" : ""}>Pronto</span></div>
          <p className="mt-5 text-sm text-muted-foreground">Criado por {nameFor(selected.agent_id)} · {dateTime(selected.updated_at || selected.created_at)}</p>
          {stage(selected) === 'Aceite a conferir' && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Este material ainda precisa de conferência de conteúdo e qualidade visual. Não está pronto para publicação.</p>}
          {publicationFor(selected.result_payload) && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border p-5"><h3 className="font-semibold">Por que publicar</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{publicationFor(selected.result_payload)?.strategy}</p></article><article className="rounded-xl border p-5"><h3 className="font-semibold">Como usar</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{publicationFor(selected.result_payload)?.instructions}</p></article></section>}
          <section className="he-copy-ready"><div className="he-section-title"><div><p className="he-eyebrow">MATERIAL PARA USAR</p><h3>Texto pronto para copiar</h3><p>O conteúdo preparado para você, separado do histórico interno da equipe.</p></div><button type="button" className="he-copy-button" onClick={() => void copiarMaterial(selected)} disabled={!publicationFor(selected.result_payload) && !deliveryFor(selected.result_payload)}><Copy className="h-4 w-4" />{copied ? "Copiado" : "Copiar texto"}</button></div><textarea readOnly value={contentFor(selected)} aria-label="Texto pronto da entrega" className="he-copy-textarea" /></section>
          {deliveryFor(selected.result_payload) && <section className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border p-5"><h3 className="font-semibold">Seu próximo passo</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{deliveryFor(selected.result_payload)?.next_steps}</p></article><article className="rounded-xl border p-5"><h3 className="font-semibold">O que precisa da sua atenção</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{deliveryFor(selected.result_payload)?.limitations}</p></article></section>}
          <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Histórico da produção e revisão</summary><p className="mt-3 break-all text-xs text-muted-foreground">Tarefa {selected.task_id || '—'} · {selected.job_id}</p><p className="mt-3 text-sm">{taskFor(selected)?.definicao_de_pronto}</p>
          <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" /> Registro interno</h3><p className="mt-3 whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed">{selected.result_summary || "O agente ainda não registrou uma entrega."}</p></section>
          <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> Revisão</h3><p className="mt-3 rounded-xl border bg-card p-4 text-sm">{selected.result_payload?.reviewed_by ? `${nameFor(selected.result_payload.reviewed_by)}: ${selected.result_payload.review_reason || "Revisão registrada sem observação."}` : selected.result_payload?.review_pending ? `Aguardando ${reviewerFor(selected).name}.` : selected.status === "DRAFT" ? "Aguardando liberação da coordenação. O agente ainda não foi chamado." : `Ainda não enviada para revisão. ${reviewerFor(selected).label}: ${reviewerFor(selected).name}.`}</p></section>
          </details>
          <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><Image className="h-5 w-5" /> Suas artes</h3>
            {artifactError && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{artifactError}</p>}
            {deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id).length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{deliveryArtifacts(selected.evidence_refs, selected.business_id, selected.job_id).map(asset => <div key={asset.path} className="rounded-xl border bg-card p-3"><p className="mb-2 text-sm font-semibold">{asset.slot === "post" ? "Post" : `Story ${asset.slot.slice(-1)}`} · versão {asset.version}</p>{artifactUrls[asset.path] ? <><img src={artifactUrls[asset.path]} alt={`Arte ${asset.slot} da entrega`} className="max-h-80 w-full rounded-lg bg-muted object-contain" /><a href={artifactUrls[asset.path]} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-emerald-700 underline">Abrir arquivo</a></> : <p className="text-sm text-muted-foreground">Carregando ou indisponível.</p>}</div>)}</div> : <p className="mt-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">Ainda não há arquivos visuais vinculados a esta entrega.</p>}
          </section>
          <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Consultar fontes e comprovantes</summary>{evidenceFor(selected).map(item => <article key={item.id} className="mt-3 rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{item.assunto || item.id}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.registro || "Sem descrição"}</p><p className="mt-2 text-xs text-muted-foreground">Fonte: {item.evidencia_origem || "Não informada"} · {dateTime(item.criado_em)}</p></article>)}</details>
        </section>
      </div>}
    </main>
  );
}
