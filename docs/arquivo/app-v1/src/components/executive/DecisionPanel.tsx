import { useState } from "react";
import { dataHora } from "@/lib/data-hora";
import { Link } from "react-router-dom";
import { ArrowUpRight, Scale } from "lucide-react";
import { noEscopo, normalizar, type DadosComando } from "@/lib/comando";

export function DecisionPanel({ dados, escopo }: { dados: DadosComando | null; escopo: string }) {
  const [filtro, setFiltro] = useState("VIGENTES");
  const decisoes = (dados?.decisoes.rows || []).filter(d => noEscopo(d.business_id, escopo));
  const visiveis = decisoes.filter(d => filtro === "TODAS" || (filtro === "VIGENTES" ? ["ATIVA", "ATIVO"].includes(normalizar(d.status)) : normalizar(d.status) === filtro)).slice().sort((a,b) => (b.atualizado_em || b.data_hora || "").localeCompare(a.atualizado_em || a.data_hora || ""));
  const vigentes = decisoes.filter(d => ["ATIVA", "ATIVO"].includes(normalizar(d.status))).length;
  return <div className="hc-stack"><div className="hc-section-heading hc-row"><div><span className="hc-eyebrow">LIVRO DE DECISÕES</span><h2>O que foi decidido e por quem</h2><p>Diretrizes registradas no Supabase. Uma decisão vigente orienta a operação; ela não prova que uma tarefa específica foi revisada.</p></div><Link className="hc-text-button" to="/modulo/decisoes">Abrir cadastro <ArrowUpRight size={16}/></Link></div>
    <div className="hc-flow-summary"><Scale size={20}/><strong>{dados?.decisoes.estado === "ok" ? vigentes : "—"}</strong><span>diretrizes vigentes no recorte</span><span className="hc-flow-divider"/><strong>{dados?.decisoes.estado === "ok" ? decisoes.length : "—"}</strong><span>decisões registradas</span></div>
    <div className="hc-decision-filters" role="group" aria-label="Filtrar decisões"><button aria-pressed={filtro === "VIGENTES"} onClick={() => setFiltro("VIGENTES")}>Vigentes</button><button aria-pressed={filtro === "TODAS"} onClick={() => setFiltro("TODAS")}>Todas</button><button aria-pressed={filtro === "SUPERADA"} onClick={() => setFiltro("SUPERADA")}>Superadas</button></div>
    {dados?.decisoes.estado !== "ok" ? <p className="hc-empty">Leitura das decisões indisponível ou parcial; a contagem não foi confirmada.</p> : <div className="hc-decision-grid">{visiveis.map(d => <article className="hc-card hc-decision" key={d.decision_id}><div className="hc-row"><small>{d.decision_id} · {d.business_id || "Grupo / escopo não estruturado"}</small><span className="hc-tag">{d.status || "Sem status"}</span></div><h3>{d.decisao}</h3><div className="hc-decision-meta"><span>Decisor registrado <strong>{d.decisor || "Não informado"}</strong></span><span>Data informada <strong>{d.data_hora || "Não informada"}</strong></span><span>Última atualização <strong>{dataHora(d.atualizado_em)}</strong></span>{d.revisar_em && <span>Revisar em <strong>{d.revisar_em}</strong></span>}</div><details><summary>Motivo, impacto e evidência</summary><dl><dt>Motivo</dt><dd>{d.motivo || "Não registrado"}</dd><dt>Impacto esperado</dt><dd>{d.impacto_esperado || "Não registrado"}</dd><dt>Fonte de evidência</dt><dd>{d.evidencia_fonte || "Não registrada"}</dd><dt>Escopo</dt><dd>{d.escopo || d.business_id || "Não estruturado"}</dd></dl></details></article>)}</div>}
    {dados?.decisoes.estado === "ok" && !visiveis.length && <p className="hc-empty">Nenhuma decisão visível neste filtro.</p>}
    <p className="hc-caption">O cadastro atual não tem vínculo estruturado com tarefas nem confirmação de revisão por IA. A página mostra o decisor informado na fonte e evita atribuir uma aprovação à Helena sem registro.</p>
  </div>;
}
