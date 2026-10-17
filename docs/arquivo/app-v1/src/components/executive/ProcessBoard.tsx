import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, CircleCheck, Clock3, LockKeyhole } from "lucide-react";
import { atrasada, normalizar, resumoExecutivoTarefa, scorePrioridade, temInformacao, type TarefaComando } from "@/lib/comando";

const etapas = [
  { id: "NÃO INICIADA", titulo: "A fazer", dica: "Aguardando início", icon: Clock3 },
  { id: "EM EXECUÇÃO", titulo: "Em andamento", dica: "Trabalho iniciado", icon: ChevronRight },
  { id: "BLOQUEADA", titulo: "Travadas", dica: "Precisam ser destravadas", icon: LockKeyhole },
  { id: "CONCLUÍDA", titulo: "Entregues", dica: "Conclusão registrada", icon: CircleCheck },
  { id: "CANCELADA", titulo: "Encerradas", dica: "Cancelamento registrado", icon: CircleCheck },
] as const;

function etapaDe(status: string | null) {
  return etapas.find(e => normalizar(e.id) === normalizar(status))?.id ?? "OUTROS";
}

export function ProcessBoard({ tarefas, disponivel, consolidado, escopo, nomeEmpresa, abrirTarefa }: {
  tarefas: TarefaComando[];
  disponivel: boolean;
  consolidado: boolean;
  escopo: string;
  nomeEmpresa?: (id: string) => string;
  abrirTarefa: (id: string) => void;
}) {
  const [empresa, setEmpresa] = useState("");
  useEffect(() => { setEmpresa(""); }, [escopo]);
  const [expandidas, setExpandidas] = useState<string[]>([]);
  const empresas = [...new Set(tarefas.map(t => t.business_id || "SEM EMPRESA"))].sort();
  const empresaAtiva = consolidado && empresas.includes(empresa) ? empresa : "";
  const visiveis = empresaAtiva ? tarefas.filter(t => (t.business_id || "SEM EMPRESA") === empresaAtiva) : tarefas;
  const concluidas = visiveis.filter(t => etapaDe(t.status) === "CONCLUÍDA").length;
  const abertas = visiveis.filter(t => !["CONCLUÍDA", "CANCELADA"].includes(etapaDe(t.status))).length;
  const colunas = [...etapas, { id: "OUTROS", titulo: "A classificar", dica: "Status fora do fluxo", icon: Clock3 }];
  const usadas = colunas.filter(c => c.id !== "OUTROS" || visiveis.some(t => etapaDe(t.status) === "OUTROS"));

  return <section className="hc-flow" aria-label="Fluxo visual das tarefas">
    <div className="hc-flow-head">
      <div><span className="hc-eyebrow">FLUXO REAL · SUPABASE</span><h2>Onde está cada entrega</h2><p>Os cartões seguem o status registrado. Abra uma tarefa para ver responsável, bloqueio, evidência e histórico disponível.</p></div>
      {consolidado && empresas.length > 1 && <label className="hc-select">Empresa<select aria-label="Empresa no fluxo" value={empresaAtiva} onChange={e => setEmpresa(e.target.value)}><option value="">Todas as empresas</option>{empresas.map(id => <option key={id} value={id}>{nomeEmpresa?.(id) || id}</option>)}</select></label>}
    </div>
    <div className="hc-flow-summary"><strong>{disponivel ? abertas : "—"}</strong><span>em aberto</span><span className="hc-flow-divider"/><strong>{disponivel ? concluidas : "—"}</strong><span>entregues no cadastro</span><small>Entregue não significa aprovada.</small></div>
    <div className="hc-flow-scroll"><div className="hc-flow-columns">
      {usadas.map((etapa, indice) => {
        const itens = visiveis.filter(t => etapaDe(t.status) === etapa.id).slice().sort((a,b) => scorePrioridade(b) - scorePrioridade(a) || (a.prazo || "9999").localeCompare(b.prazo || "9999"));
        const aberta = expandidas.includes(etapa.id);
        return <div className={`hc-flow-column stage-${indice}`} key={etapa.id}>
          <div className="hc-flow-column-head"><div className="hc-flow-step"><etapa.icon size={16}/><span>{String(indice + 1).padStart(2, "0")}</span></div><strong>{etapa.titulo}</strong><b>{disponivel ? itens.length : "—"}</b><small>{etapa.dica}</small></div>
          <div className="hc-flow-card-list">{disponivel ? itens.slice(0, aberta ? undefined : 4).map(t => <button type="button" className="hc-flow-card" key={t.task_id} onClick={() => abrirTarefa(t.task_id)}>
            <span className="hc-flow-card-top"><small>{t.business_id || "Sem empresa"}</small><small>{t.task_id}</small></span>
            <strong>{resumoExecutivoTarefa(t)}</strong>
            <span className="hc-flow-owner">{t.responsavel || "Responsável a definir"}</span>
            <span className="hc-flow-card-foot"><span>{etapa.id === "CONCLUÍDA" ? temInformacao(t.evidencia) ? "Evidência registrada" : "Sem evidência" : atrasada(t) ? "Prazo vencido" : t.prazo ? `Prazo ${t.prazo}` : "Prazo a definir"}</span><ArrowUpRight size={16}/></span>
          </button>) : <p className="hc-flow-empty">Consulta indisponível.</p>}
          {disponivel && !itens.length && <p className="hc-flow-empty">Nenhuma tarefa nesta etapa.</p>}
          {disponivel && itens.length > 4 && <button type="button" className="hc-flow-more" onClick={() => setExpandidas(antigas => aberta ? antigas.filter(e => e !== etapa.id) : [...antigas, etapa.id])}>{aberta ? "Mostrar menos" : `Ver mais ${itens.length - 4} tarefas`} <ChevronRight size={15}/></button>}</div>
        </div>;
      })}
    </div></div>
    <p className="hc-flow-swipe">Deslize para ver as próximas etapas →</p><p className="hc-caption">As etapas são uma leitura dos status existentes. Bloqueios podem surgir em qualquer momento. Mover um cartão exige uma alteração autorizada no cadastro; esta visualização não executa nem aprova trabalhos.</p>
  </section>;
}
