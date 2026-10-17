import { useEffect, useMemo, useState } from "react";
import { dataHora } from "@/lib/data-hora";
import { Link } from "react-router-dom";
import { Database, RefreshCw, Search, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth";
import { obterModulo } from "@/lib/modulos";
import { fonteLegivel, NOMES_VINCULOS, resumoCobertura, type AuditoriaCobertura } from "@/lib/cobertura";
import type { Fonte, JobComando } from "@/lib/comando";
import { origemJob } from "@/lib/execucoes-comando";

export function CoveragePanel({ jobs }: { jobs?: Fonte<JobComando> }) {
  const { isFounder } = useAuth();
  const [auditoria, setAuditoria] = useState<AuditoriaCobertura | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState(0);
  const [busca, setBusca] = useState("");
  const [somentePendencias, setSomentePendencias] = useState(false);

  useEffect(() => {
    if (!isFounder) { setCarregando(false); return; }
    const controller = new AbortController();
    let ativo = true;
    setCarregando(true); setErro("");
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("helena_auditar_cobertura").abortSignal(controller.signal);
        if (error || !data) throw new Error("Não foi possível concluir a auditoria no Supabase. Tente novamente.");
        if (ativo) setAuditoria(data as AuditoriaCobertura);
      } catch {
        if (ativo) { setAuditoria(null); setErro("Auditoria indisponível. Não é possível confirmar a cobertura nesta consulta."); }
      } finally {
        window.clearTimeout(timeout);
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; controller.abort(); window.clearTimeout(timeout); };
  }, [isFounder, ciclo]);

  const resumo = auditoria ? resumoCobertura(auditoria) : null;
  const fontesSemModulo = auditoria?.fontes.filter(f => !obterModulo(f.tabela)).length ?? 0;
  const fontes = useMemo(() => (auditoria?.fontes ?? []).filter(f => {
    const nome = `${f.tabela} ${obterModulo(f.tabela)?.titulo ?? ""}`.toLocaleLowerCase("pt-BR");
    return nome.includes(busca.toLocaleLowerCase("pt-BR")) &&
      (!somentePendencias || !fonteLegivel(f) || f.colunas.some(c => !c.mapeado));
  }), [auditoria, busca, somentePendencias]);

  if (!isFounder) return <div className="hc-card"><h2>Auditoria consolidada do fundador</h2><p>O mapa completo é restrito ao fundador. Os módulos continuam respeitando as empresas autorizadas para sua sessão.</p></div>;

  return <div className="hc-stack" aria-label="Auditoria de cobertura do Supabase">
    <div className="hc-section-heading hc-coverage-heading"><div><div className="hc-eyebrow"><Database size={15}/> SUPABASE / MAPA COMPLETO</div><h2>Cada fonte identificada. Cada lacuna visível.</h2><p>Inventário consultado diretamente no banco, incluindo tabelas, campos, permissões de leitura e vínculos de execução. Visão consolidada do fundador.</p></div><button className="hc-button" disabled={carregando} onClick={() => setCiclo(c => c + 1)}><RefreshCw size={16} className={carregando ? "animate-spin" : ""}/>{carregando ? "Verificando…" : "Verificar cobertura"}</button></div>
    {erro && <div className="hc-warning" role="alert">{erro}</div>}
    {carregando && <p role="status">Consultando o catálogo e as contagens no Supabase…</p>}
    {auditoria && resumo && <>
      <div className="hc-coverage-metrics">
        <article className="hc-card"><span>Campos mapeados</span><strong>{resumo.percentual === null ? "—" : `${resumo.percentual}%`}</strong><small>{resumo.mapeados} de {resumo.campos} no dicionário</small></article>
        <article className="hc-card"><span>Fontes com leitura verificada</span><strong>{resumo.legiveis} / {resumo.fontes}</strong><small>Tabelas e visões do esquema público</small></article>
        <article className="hc-card"><span>Falhas nos vínculos verificados</span><strong>{resumo.falhasVinculos}</strong><small>{Object.keys(auditoria.integridade).length} verificações de integridade</small></article>
        <article className="hc-card"><span>Diferenças no checkpoint</span><strong>{auditoria.divergencias_checkpoint.length}</strong><small>{auditoria.checkpoint?.id ?? "Checkpoint ausente"}</small></article>
      </div>
      {jobs?.estado === "ok" && jobs.rows.some(j => !j.task_id) && <div className="hc-warning"><strong>Jobs sem tarefa vinculada: {jobs.rows.filter(j => !j.task_id).length}.</strong> Destes, {jobs.rows.filter(j => !j.task_id && origemJob(j) === "HOMOLOGACAO").length} são do lote de teste do Gateway. Os demais continuam sem vínculo para aparecer no fluxo de uma tarefa; veja origem, etapa e resultado em Acompanhamento.</div>}
      {jobs?.estado === "ok" && jobs.rows.some(j => !j.business_id) && <div className="hc-warning"><strong>Jobs sem empresa: {jobs.rows.filter(j => !j.business_id).length}.</strong> {jobs.rows.filter(j => !j.business_id && origemJob(j) === "HOMOLOGACAO").length} pertencem ao lote global de homologação. Outros jobs sem empresa, se houver, exigem classificação de origem.</div>}
      <p className="hc-caption">Consulta: {dataHora(auditoria.verificado_em)}. O percentual cobre as tabelas e colunas do esquema público; {fontesSemModulo} fontes estão inventariadas fora do catálogo de módulos, embora algumas apareçam em telas especializadas. Contas do Auth, Storage, Edge Functions e execução externa exigem verificações próprias. Consumo do Grok fora do escopo.</p>
      <div className="hc-two">
        <article className="hc-card"><div className="hc-eyebrow">CONTINUIDADE</div><h3>Checkpoint mestre</h3>{!auditoria.checkpoint ? <p>Checkpoint ativo não encontrado.</p> : auditoria.divergencias_checkpoint.length ? <><p className="hc-checkpoint-alert"><AlertTriangle size={17}/> CHECKPOINT REQUER SINCRONIZAÇÃO</p><ul className="hc-list">{auditoria.divergencias_checkpoint.map(d => <li key={d.tabela}>{d.tabela}: {d.checkpoint} no checkpoint → {d.atual} no banco.</li>)}</ul></> : <p><CheckCircle2 size={17}/> Contagens comparadas sem divergência.</p>}<p className="hc-caption">A comparação de contagens não comprova igualdade do conteúdo nem homologação dos agentes.</p></article>
        <article className="hc-card"><div className="hc-eyebrow">INTEGRIDADE DA EXECUÇÃO</div><h3>Vínculos entre os registros</h3><ul className="hc-integrity-list">{Object.entries(auditoria.integridade).map(([k, n]) => <li key={k}>{n ? <AlertTriangle size={15}/> : <CheckCircle2 size={15}/>}<span>{NOMES_VINCULOS[k] ?? k}</span><b>{n ? `${n} falhas` : "OK"}</b></li>)}</ul></article>
      </div>
      {auditoria.campos_obsoletos > 0 && <div className="hc-warning">{auditoria.campos_obsoletos} entradas do dicionário referenciam campos ausentes no banco.</div>}
      <div className="hc-coverage-tools"><label className="hc-search"><Search size={16}/><input aria-label="Buscar fonte do Supabase" placeholder="Buscar tabela ou área…" value={busca} onChange={e => setBusca(e.target.value)}/></label><label><input type="checkbox" checked={somentePendencias} onChange={e => setSomentePendencias(e.target.checked)}/> Somente pendências</label><span>{fontes.length} fontes neste filtro</span></div>
      <div className="hc-coverage-grid">{fontes.map(f => {
        const modulo = obterModulo(f.tabela);
        const mapeados = f.colunas.filter(c => c.mapeado).length;
        const legivel = fonteLegivel(f);
        return <article key={f.tabela} className={`hc-card hc-coverage-card ${!legivel || mapeados < f.colunas.length ? "is-divergent" : ""}`}>
          <div className="hc-coverage-card-top"><span className="hc-eyebrow">{modulo?.grupo ?? "Fora do catálogo de módulos"}</span><span className="hc-tag">{legivel ? "Leitura verificada" : "Verificar acesso"}</span></div>
          <h3>{modulo?.titulo ?? f.tabela.replace(/_/g, " ")}</h3><code>{f.tabela}</code>
          <p><strong>{f.registros === null ? "—" : f.registros.toLocaleString("pt-BR")}</strong> registros · {mapeados}/{f.colunas.length} campos mapeados</p>
          <small>{f.tipo === "view" ? "Visão com permissões da sessão" : "Tabela com proteção de acesso"}</small>
          <details className="hc-details"><summary>Ver campos e tipos</summary><ul className="hc-column-list">{f.colunas.map(c => <li key={c.nome}><code>{c.nome}</code><span>{c.tipo}</span><b>{c.mapeado ? "Mapeado" : "Ausente"}</b></li>)}</ul></details>
          {modulo && <Link className="hc-text-link" to={modulo.rota ?? `/modulo/${modulo.tabela}`}>Abrir módulo <ArrowUpRight size={14}/></Link>}
        </article>;
      })}</div>
      {!fontes.length && <p>Nenhuma fonte corresponde ao filtro.</p>}
    </>}
  </div>;
}
