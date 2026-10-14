import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, FileCheck2, Flag, UserRound } from "lucide-react";
import { AgentAvatar } from "./AgentCard";
import { atribuidoA, atrasada, encerrada, normalizar, pendenciasCadastro, temInformacao, type AgenteComando, type TarefaComando } from "@/lib/comando";
import type { DadosComando } from "@/lib/comando";
import { ExecutionTrail } from "./ExecutionPanel";
import { dataHora } from "@/lib/data-hora";

export function TaskBrief({ tarefa: t, agentes, dados }: { tarefa: TarefaComando; agentes: AgenteComando[]; dados: DadosComando | null }) {
  const donos = agentes.filter(a => atribuidoA(t.responsavel, a));
  const lacunas = pendenciasCadastro(t);
  const bloqueada = normalizar(t.status) === "BLOQUEADA";
  const cancelada = ["CANCELADA", "CANCELADO"].includes(normalizar(t.status));
  const prazo = t.prazo && /^\d{4}-\d{2}-\d{2}$/.test(t.prazo) ? t.prazo.split("-").reverse().join("/") : t.prazo || "A combinar";
  const jobs = (dados?.jobs.rows || []).filter(j => j.task_id === t.task_id);
  const auditorias = (dados?.auditoria.rows || []).filter(a => a.sheet === "tarefas" && !!a.object_id && new RegExp(`^${t.task_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s*\\(|$)`, "i").test(a.object_id));
  const atividades = (dados?.atividade.rows || []).filter(a => a.task_id === t.task_id).slice().sort((a,b) => b.occurred_at.localeCompare(a.occurred_at));
  const nomeAgente = (id: string | null) => agentes.find(a => a.agent_id === id)?.agente || id || "Agente não informado";
  return <div className="brief">
    <div className="brief-meta"><span>{t.task_id}</span><span>{t.business_id || "Empresa não informada"}</span><span className={bloqueada ? "brief-status is-blocked" : "brief-status"}>{t.status || "Status não informado"}</span></div>
    <div className="brief-layout">
      <div className="brief-main">
        <section className={`brief-next ${bloqueada ? "is-blocked" : ""}`}>
          <div className="brief-label"><AlertCircle size={16}/>{encerrada(t.status) ? "CONFERÊNCIA DA ENTREGA" : "O QUE FALTA PARA AVANÇAR"}</div>
          <h3>{cancelada ? "Tarefa cancelada" : bloqueada ? "Destravar a dependência" : encerrada(t.status) ? "Conferir o resultado registrado" : "Concluir a entrega combinada"}</h3>
          <p>{cancelada ? "O cancelamento está registrado. Consulte as observações para entender o motivo e o escopo encerrado." : bloqueada ? "O responsável depende da resolução do bloqueio abaixo para avançar." : encerrada(t.status) ? "A tarefa está encerrada na fonte. Consulte a evidência e os critérios antes de considerar o resultado validado." : "A tarefa ainda está aberta. O critério de entrega abaixo orienta o responsável; as etapas restantes não estão estruturadas no cadastro."}</p>
          {!encerrada(t.status) && temInformacao(t.bloqueio) && <div className="brief-block-preview"><small>DEPENDÊNCIA DESCRITA NA FONTE</small><p>{t.bloqueio!.length > 340 ? `${t.bloqueio!.slice(0,340)}…` : t.bloqueio}</p></div>}
        </section>
        <section className="brief-section"><h3><Flag size={17}/> Entrega esperada</h3><p>{temInformacao(t.definicao_de_pronto) ? t.definicao_de_pronto : "O critério de aceite ainda não foi registrado. Precisa ser definido com o responsável."}</p></section>
        <section className="brief-section"><h3><AlertCircle size={17}/> {bloqueada ? "Bloqueio registrado" : "Dependências e observações"}</h3>{temInformacao(t.bloqueio) ? <details className="brief-evidence" open={t.bloqueio!.length < 650}><summary>Consultar registro completo</summary><p>{t.bloqueio}</p></details> : <p>{bloqueada ? "A tarefa está bloqueada, mas o motivo não foi informado na fonte." : "Nenhuma dependência descrita neste campo. Isso não confirma ausência de impedimentos."}</p>}</section>
        <section className="brief-section"><h3><FileCheck2 size={17}/> Evidência da entrega</h3>{temInformacao(t.evidencia) ? <details className="brief-evidence"><summary>Ver evidência registrada <ArrowRight size={15}/></summary><p>{t.evidencia}</p></details> : <p>Ainda não há evidência informada. O resultado não pode ser comprovado por este campo.</p>}</section>
        <section className="brief-section"><h3><FileCheck2 size={17}/> Execução e passos vinculados</h3>{jobs.some(j => j.business_id !== t.business_id) && <p className="hc-warning">Há execução com empresa diferente da tarefa ou sem empresa definida. Confira a origem antes de aceitar a entrega.</p>}{dados?.jobs.estado !== "ok" ? <p>A leitura das execuções está indisponível ou parcial.</p> : jobs.length ? <ExecutionTrail jobs={jobs} eventos={dados.eventos.rows} eventosDisponiveis={dados.eventos.estado === "ok"} nomeAgente={nomeAgente}/> : <p>Nenhuma execução está ligada pelo identificador desta tarefa. As execuções sem vínculo aparecem na seção Execuções; não é seguro atribuí-las a esta entrega por semelhança de texto.</p>}</section>
        <section className="brief-section"><h3><FileCheck2 size={17}/> Mudanças registradas no fluxo</h3>{dados?.atividade.estado !== "ok" ? <p>A leitura das mudanças automáticas está indisponível ou parcial.</p> : atividades.length ? <ol className="brief-audit">{atividades.map(a => <li key={a.event_id}><strong>{a.status_before !== a.status_after ? `${a.status_before || "Sem status"} → ${a.status_after || "Sem status"}` : a.event_type === "INSERT" ? "Tarefa criada" : a.event_type === "DELETE" ? "Tarefa excluída" : "Cadastro atualizado"}</strong><span>{dataHora(a.occurred_at)} · {a.actor_uid ? "Usuário autenticado" : a.actor_role === "service_role" ? "Serviço" : "Origem individual não registrada"}</span><small>Campos: {a.changed_fields.join(", ") || "não informados"}</small></li>)}</ol> : <p>Ainda não há mudanças automáticas registradas para esta tarefa. A captura começou nesta atualização e não recria passos anteriores.</p>}</section>
        <section className="brief-section"><h3><FileCheck2 size={17}/> Alterações auditadas</h3>{dados?.auditoria.estado !== "ok" ? <p>Leitura da auditoria indisponível ou parcial.</p> : auditorias.length ? <ol className="brief-audit">{auditorias.map(a => <li key={a.audit_id}><strong>{a.acao || "Alteração"} · {a.campo || "Campo não informado"}</strong><span>Gravado no banco: {dataHora(a.criado_em)} · {a.agente_usuario || "Autor não informado"}</span>{a.data_hora && <small>Data informada na origem: {a.data_hora}</small>}{a.motivo && <p>{a.motivo}</p>}</li>)}</ol> : <p>Nenhuma alteração individualizada visível nesta consulta. O acesso à auditoria também depende da sua permissão.</p>}<small>Esta trilha reflete os registros disponíveis; não comprova que toda ação externa foi capturada.</small></section>
      </div>
      <aside className="brief-sidebar">
        <div className="brief-label">RESPONSÁVEL PELA ENTREGA</div>
        <div className="brief-owners">{donos.length ? donos.map(a => <div key={a.agent_id}><AgentAvatar agentId={a.agent_id} nome={a.agente} size={38}/><span><strong>{a.agente}</strong><small>{a.cargo_funcao}</small></span></div>) : <div><span className="brief-user"><UserRound size={20}/></span><strong>{t.responsavel || "A definir"}</strong></div>}</div>
        {donos.length > 0 && <small className="brief-original">Cadastro: {t.responsavel}</small>}
        <div className="brief-fact"><CalendarDays size={17}/><span>Prazo<strong>{prazo}</strong>{atrasada(t) && <small className="brief-overdue">Prazo anterior a hoje</small>}</span></div>
        <div className="brief-fact"><Flag size={17}/><span>Prioridade<strong>{t.prioridade || "Não informada"}</strong></span></div>
        <div className="brief-fact"><FileCheck2 size={17}/><span>Projeto<strong>{t.project_id || "Sem vínculo registrado"}</strong></span></div>
        <div className="brief-gaps"><h3>{lacunas.length ? "Informações a completar" : "Cadastro preenchido"}</h3>{lacunas.length ? <ul>{lacunas.map(l => <li key={l}><span/>{l}</li>)}</ul> : <p><CheckCircle2 size={16}/> Os campos essenciais têm conteúdo. A qualidade da entrega ainda depende de validação.</p>}<small>Conferência do cadastro, não uma lista de subtarefas executadas.</small></div>
      </aside>
    </div>
  </div>;
}
