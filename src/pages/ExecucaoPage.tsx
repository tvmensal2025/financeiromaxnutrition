import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Lock,
  PlayCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveDrawer } from "@/components/executive/ExecutiveDrawer";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import {
  carregarDadosCentralExecucao,
  calcularProgressoExecutivo,
  determinarStatusVisualAgente,
  isTarefaAtrasada,
  isTarefaBloqueada,
  isTarefaConcluidaHoje,
  obterAreaAgente,
  obterProgressoTecnico,
  obterUltimoDiagnosticoTecnico,
  pertenceAoAgente,
  type AgenteExecucao,
  type AuditoriaExecucao,
  type EventoTimeline,
  type FiltrosExecucao,
  type HandoffExecucao,
  type IndicadoresOperacionais,
  type ItemAtencao,
  type MarcoExecucao,
  type ProjetoExecucao,
  type TarefaExecucao,
} from "@/lib/execucao";

export default function ExecucaoPage() {
  const navigate = useNavigate();
  const { currentBusinessId, isConsolidated, setCurrentBusiness, empresas } = useBusiness();

  // Estados de dados
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<{ mensagem: string; isAuth: boolean; codigo?: string } | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>("");
  const [atualizandoManual, setAtualizandoManual] = useState(false);

  // Dados brutos do Supabase
  const [dadosBrutos, setDadosBrutos] = useState<{
    agentes: any[];
    conexoes: any[];
    projetos: any[];
    marcos: any[];
    tarefas: TarefaExecucao[];
    handoffs: HandoffExecucao[];
    auditorias: AuditoriaExecucao[];
    memoria: any[];
    riscos: any[];
    decisoes: any[];
    portfolio: any[];
  }>({
    agentes: [],
    conexoes: [],
    projetos: [],
    marcos: [],
    tarefas: [],
    handoffs: [],
    auditorias: [],
    memoria: [],
    riscos: [],
    decisoes: [],
    portfolio: [],
  });

  // Filtros da tela
  const [filtros, setFiltros] = useState<FiltrosExecucao>({
    empresaId: currentBusinessId,
    projetoId: "TODOS",
    agenteId: "TODOS",
    status: "TODOS",
    prioridade: "TODAS",
    periodo: "TODOS",
  });

  // Sincroniza o seletor da página com o BusinessContext
  useEffect(() => {
    setFiltros((prev) => ({
      ...prev,
      empresaId: currentBusinessId,
    }));
  }, [currentBusinessId]);

  // Modais / Drawers
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaExecucao | null>(null);
  const [agenteSelecionado, setAgenteSelecionado] = useState<AgenteExecucao | null>(null);
  const [handoffSelecionado, setHandoffSelecionado] = useState<HandoffExecucao | null>(null);

  // Carregamento de dados com tratamento estrito de 401/403
  const buscarDados = async (ehManual = false) => {
    if (ehManual) setAtualizandoManual(true);
    else setCarregando(true);
    setErro(null);

    try {
      const res = await carregarDadosCentralExecucao();
      if (!res.sucesso) {
        setErro({
          mensagem: res.erroMensagem,
          isAuth: res.isAuthError,
          codigo: res.codigoErro,
        });
      } else {
        setDadosBrutos({
          agentes: res.agentes,
          conexoes: res.conexoes,
          projetos: res.projetos,
          marcos: res.marcos,
          tarefas: res.tarefas,
          handoffs: res.handoffs,
          auditorias: res.auditorias,
          memoria: res.memoria,
          riscos: res.riscos,
          decisoes: res.decisoes,
          portfolio: res.portfolio,
        });
        setUltimaAtualizacao(
          new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    } catch (e: any) {
      setErro({
        mensagem: e?.message || "Falha ao consultar dados do Supabase.",
        isAuth: false,
      });
    } finally {
      setCarregando(false);
      setAtualizandoManual(false);
    }
  };

  useEffect(() => {
    buscarDados();
  }, []);

  // -------------------------------------------------------------
  // APLICAÇÃO DOS FILTROS GLOBAIS
  // -------------------------------------------------------------
  const tarefasFiltradas = useMemo(() => {
    return dadosBrutos.tarefas.filter((t) => {
      // Filtro de Empresa
      if (filtros.empresaId !== "TODAS" && filtros.empresaId !== "GRUPO") {
        if (t.business_id && t.business_id !== filtros.empresaId && t.business_id !== "GRUPO") {
          return false;
        }
      }
      // Filtro de Projeto
      if (filtros.projetoId !== "TODOS") {
        if (t.project_id !== filtros.projetoId) return false;
      }
      // Filtro de Agente
      if (filtros.agenteId !== "TODOS") {
        const ag = dadosBrutos.agentes.find((a) => a.agent_id === filtros.agenteId);
        if (ag && !pertenceAoAgente(t.responsavel, ag.agente, ag.agent_id)) {
          return false;
        }
      }
      // Filtro de Status
      if (filtros.status !== "TODOS") {
        if (filtros.status === "BLOQUEADA") {
          if (!isTarefaBloqueada(t)) return false;
        } else {
          if (t.status !== filtros.status) return false;
        }
      }
      // Filtro de Prioridade
      if (filtros.prioridade !== "TODAS") {
        if (t.prioridade !== filtros.prioridade) return false;
      }
      // Filtro de Período
      if (filtros.periodo === "HOJE") {
        if (t.prazo !== "2026-09-25" && !t.atualizado_em?.startsWith("2026-09-25")) {
          return false;
        }
      }
      return true;
    });
  }, [dadosBrutos.tarefas, filtros, dadosBrutos.agentes]);

  // Handoffs filtrados
  const handoffsFiltrados = useMemo(() => {
    return dadosBrutos.handoffs.filter((h) => {
      if (filtros.empresaId !== "TODAS" && filtros.empresaId !== "GRUPO") {
        if (h.business_id_area && h.business_id_area !== filtros.empresaId && h.scope_type !== "GLOBAL") {
          return false;
        }
      }
      if (filtros.projetoId !== "TODOS") {
        if (h.related_object_id !== filtros.projetoId) return false;
      }
      if (filtros.agenteId !== "TODOS") {
        const ag = dadosBrutos.agentes.find((a) => a.agent_id === filtros.agenteId);
        if (ag && !h.de.includes(ag.agente) && !h.para.includes(ag.agente)) {
          return false;
        }
      }
      return true;
    });
  }, [dadosBrutos.handoffs, filtros, dadosBrutos.agentes]);

  // -------------------------------------------------------------
  // LINHA 1 — INDICADORES OPERACIONAIS
  // -------------------------------------------------------------
  const indicadores: IndicadoresOperacionais = useMemo(() => {
    const emExec = tarefasFiltradas.filter((t) => t.status === "EM EXECUÇÃO").length;
    const bloq = tarefasFiltradas.filter((t) => isTarefaBloqueada(t)).length;
    const atrasadas = tarefasFiltradas.filter((t) => isTarefaAtrasada(t, "2026-09-25")).length;
    const concHoje = tarefasFiltradas.filter((t) => isTarefaConcluidaHoje(t, "2026-09-25")).length;
    const handoffsPend = handoffsFiltrados.filter(
      (h) => h.status !== "CONCLUÍDO" && h.status !== "CONCLUIDO" && h.status !== "CANCELADO"
    ).length;

    // Decisões pendentes (decisões ativas sem conclusão ou tarefas com bloqueio de decisão)
    const decsPend = dadosBrutos.tarefas.filter(
      (t) => t.bloqueio && t.bloqueio.toUpperCase().includes("DECISÃO")
    ).length;

    // Agentes com atividade hoje
    const nomesAtivosHoje = new Set<string>();
    dadosBrutos.tarefas.forEach((t) => {
      if (t.atualizado_em?.startsWith("2026-09-25") || t.prazo === "2026-09-25") {
        nomesAtivosHoje.add(t.responsavel);
      }
    });
    dadosBrutos.auditorias.forEach((a) => {
      if (a.data_hora?.includes("2026-09-25") || a.criado_em?.startsWith("2026-09-25")) {
        nomesAtivosHoje.add(a.agente_usuario);
      }
    });
    dadosBrutos.handoffs.forEach((h) => {
      if (h.data_hora?.includes("2026-09-25") || h.criado_em?.startsWith("2026-09-25")) {
        nomesAtivosHoje.add(h.de);
        nomesAtivosHoje.add(h.para);
      }
    });

    const agentesComAtividade = dadosBrutos.agentes.filter((ag) => {
      for (const nome of nomesAtivosHoje) {
        if (nome.includes(ag.agente) || nome.includes(ag.agent_id)) return true;
      }
      return false;
    }).length;

    const totalAgentes = dadosBrutos.agentes.length || 21;
    const agentesSemAtividade = Math.max(0, totalAgentes - agentesComAtividade);

    return {
      tarefas_em_execucao: emExec,
      tarefas_bloqueadas: bloq,
      tarefas_atrasadas: atrasadas,
      concluidas_hoje: concHoje,
      handoffs_pendentes: handoffsPend,
      decisoes_pendentes: decsPend,
      agentes_com_atividade_hoje: agentesComAtividade,
      agentes_sem_atividade: agentesSemAtividade,
    };
  }, [tarefasFiltradas, handoffsFiltrados, dadosBrutos]);

  // -------------------------------------------------------------
  // LINHA 2 — PROJETOS EM EXECUÇÃO
  // -------------------------------------------------------------
  const projetosEstruturados: ProjetoExecucao[] = useMemo(() => {
    return dadosBrutos.projetos
      .filter((p) => {
        if (filtros.empresaId !== "TODAS" && filtros.empresaId !== "GRUPO") {
          if (p.business_id && p.business_id !== filtros.empresaId && p.business_id !== "GRUPO") {
            return false;
          }
        }
        if (filtros.projetoId !== "TODOS" && p.project_id !== filtros.projetoId) {
          return false;
        }
        return true;
      })
      .map((p) => {
        const tarefasDoProjeto = dadosBrutos.tarefas.filter((t) => t.project_id === p.project_id);
        const marcosDoProjeto = dadosBrutos.marcos.filter((m) => m.project_id === p.project_id);

        const progExec = calcularProgressoExecutivo(tarefasDoProjeto);
        const progTec = obterProgressoTecnico(p, dadosBrutos.auditorias);
        const diagTec = obterUltimoDiagnosticoTecnico(p, dadosBrutos.auditorias);

        const concluidas = tarefasDoProjeto.filter((t) => t.status === "CONCLUÍDA").length;
        const emExec = tarefasDoProjeto.filter((t) => t.status === "EM EXECUÇÃO").length;
        const bloq = tarefasDoProjeto.filter((t) => isTarefaBloqueada(t)).length;

        // Próxima entrega: menor prazo entre tarefas abertas ou marco atual
        const prazosAbertos = tarefasDoProjeto
          .filter((t) => t.status !== "CONCLUÍDA" && t.status !== "CANCELADA" && t.prazo)
          .map((t) => t.prazo!)
          .sort();

        const proximaEntrega = prazosAbertos[0] || p.prazo || "Em definição";

        return {
          project_id: p.project_id,
          business_id: p.business_id,
          projeto: p.projeto,
          tipo: p.tipo,
          objetivo: p.objetivo,
          status: p.status,
          prioridade: p.prioridade,
          responsavel: p.responsavel,
          sponsor: p.sponsor,
          inicio: p.inicio,
          prazo: p.prazo,
          criterio_de_conclusao: p.criterio_de_conclusao,
          marco_atual: p.marco_atual,
          dependencias: p.dependencias,
          risco_principal: p.risco_principal,
          progresso_executivo: progExec,
          progresso_tecnico: progTec,
          ultimo_diagnostico_tecnico: diagTec,
          tarefas_totais: tarefasDoProjeto.length,
          concluidas,
          em_execucao: emExec,
          bloqueadas: bloq,
          proxima_entrega: proximaEntrega,
          ultima_atualizacao: p.atualizado_em || p.ultima_atualizacao || "2026-09-25",
          marcos: marcosDoProjeto,
        };
      });
  }, [dadosBrutos.projetos, dadosBrutos.tarefas, dadosBrutos.marcos, dadosBrutos.auditorias, filtros]);

  // -------------------------------------------------------------
  // LINHA 3 — KANBAN OPERACIONAL
  // -------------------------------------------------------------
  const kanbanColunas = useMemo(() => {
    const colunas: Record<"NAO_INICIADA" | "EM_EXECUCAO" | "BLOQUEADA" | "CONCLUIDA", TarefaExecucao[]> = {
      NAO_INICIADA: [],
      EM_EXECUCAO: [],
      BLOQUEADA: [],
      CONCLUIDA: [],
    };

    tarefasFiltradas.forEach((t) => {
      if (t.status === "CONCLUÍDA") {
        colunas.CONCLUIDA.push(t);
      } else if (isTarefaBloqueada(t)) {
        colunas.BLOQUEADA.push(t);
      } else if (t.status === "EM EXECUÇÃO") {
        colunas.EM_EXECUCAO.push(t);
      } else {
        colunas.NAO_INICIADA.push(t);
      }
    });

    return colunas;
  }, [tarefasFiltradas]);

  // -------------------------------------------------------------
  // LINHA 4 — EQUIPE DIGITAL (TODOS OS 21 AGENTES)
  // -------------------------------------------------------------
  const equipeDigital: AgenteExecucao[] = useMemo(() => {
    return dadosBrutos.agentes.map((ag) => {
      const conn = dadosBrutos.conexoes.find((c) => c.agent_id === ag.agent_id);
      const tarefasDoAgente = dadosBrutos.tarefas.filter((t) =>
        pertenceAoAgente(t.responsavel, ag.agente, ag.agent_id)
      );
      const auditoriasDoAgente = dadosBrutos.auditorias.filter(
        (a) => a.agente_usuario && (a.agente_usuario.includes(ag.agente) || a.agente_usuario.includes(ag.agent_id))
      );

      const concluidasHoje = tarefasDoAgente.filter((t) => isTarefaConcluidaHoje(t, "2026-09-25")).length;
      const tarefasPendentes = tarefasDoAgente.filter(
        (t) => t.status !== "CONCLUÍDA" && t.status !== "CANCELADA"
      ).length;
      const bloqueios = tarefasDoAgente.filter((t) => isTarefaBloqueada(t)).length;

      // Tarefa atual (em execução, ou a primeira bloqueada/crítica)
      const tarefaAtual =
        tarefasDoAgente.find((t) => t.status === "EM EXECUÇÃO") ||
        tarefasDoAgente.find((t) => isTarefaBloqueada(t)) ||
        tarefasDoAgente.find((t) => t.status === "NÃO INICIADA") ||
        null;

      // Handoffs
      const handoffsEnviados = dadosBrutos.handoffs.filter((h) => h.de && h.de.includes(ag.agente));
      const handoffsRecebidos = dadosBrutos.handoffs.filter((h) => h.para && h.para.includes(ag.agente));

      const ultimoHandoffEnviado = handoffsEnviados[0] || null;
      const ultimoHandoffRecebido = handoffsRecebidos[0] || null;

      // Decisão pendente no agente
      const temDecisaoPendente = tarefasDoAgente.some(
        (t) => t.bloqueio && t.bloqueio.toUpperCase().includes("DECISÃO")
      );

      const statusVisual = determinarStatusVisualAgente(tarefasDoAgente, temDecisaoPendente);

      // Última atividade
      const ultimaAtividade =
        auditoriasDoAgente[0]?.data_hora ||
        ultimoHandoffEnviado?.data_hora ||
        ultimoHandoffRecebido?.data_hora ||
        tarefasDoAgente[0]?.atualizado_em ||
        conn?.last_seen_at ||
        ag.ultima_atualizacao ||
        "2026-09-25";

      return {
        agent_id: ag.agent_id,
        numero: ag.numero,
        agente: ag.agente,
        cargo_funcao: ag.cargo_funcao,
        missao: ag.missao,
        quando_ativar: ag.quando_ativar,
        area: obterAreaAgente(ag.agent_id),
        provider: conn?.provider || (ag.agent_id === "AGT-01" ? "CHATGPT" : "GROK"),
        connection_status: conn?.connection_status || "CONNECTED",
        capabilities: conn?.capabilities || [],
        status_visual: statusVisual,
        tarefa_atual: tarefaAtual,
        tarefas_pendentes: tarefasPendentes,
        concluidas_hoje: concluidasHoje,
        bloqueios,
        ultima_atividade: ultimaAtividade,
        ultimo_handoff_enviado: ultimoHandoffEnviado,
        ultimo_handoff_recebido: ultimoHandoffRecebido,
        tarefas_atribuidas: tarefasDoAgente,
        auditorias_realizadas: auditoriasDoAgente,
      };
    });
  }, [dadosBrutos]);

  // -------------------------------------------------------------
  // LINHA 6 — TIMELINE OPERACIONAL UNIFICADA
  // -------------------------------------------------------------
  const timelineEventos: EventoTimeline[] = useMemo(() => {
    const eventos: EventoTimeline[] = [];
    const chavesVistas = new Set<string>();

    // 1. Auditorias
    dadosBrutos.auditorias.forEach((a) => {
      const chave = `AUD_${a.audit_id}`;
      if (!chavesVistas.has(chave)) {
        chavesVistas.add(chave);
        eventos.push({
          id: a.audit_id,
          timestamp: a.data_hora || a.criado_em || "2026-09-25 04:25",
          tipo: "AUDITORIA",
          autor: a.agente_usuario || "Sistema",
          titulo: `${a.acao}: ${a.sheet || a.object_id || ""}`.trim(),
          descricao: a.motivo || a.valor_novo || undefined,
          projeto: a.object_id?.startsWith("PRJ-") ? a.object_id : undefined,
          evidencia: a.fonte_evidencia || undefined,
        });
      }
    });

    // 2. Handoffs
    dadosBrutos.handoffs.forEach((h) => {
      const chave = `HND_${h.id}`;
      if (!chavesVistas.has(chave)) {
        chavesVistas.add(chave);
        eventos.push({
          id: h.id,
          timestamp: h.data_hora || h.criado_em || "2026-09-25 04:25",
          tipo: "HANDOFF",
          autor: `${h.de} → ${h.para}`,
          titulo: `Handoff: ${h.assunto}`,
          descricao: h.retorno_conclusao || h.pergunta_tarefa_transferida || undefined,
          projeto: h.related_object_id || undefined,
          empresa: h.business_id_area || undefined,
          evidencia: h.memoria_relacionada || undefined,
        });
      }
    });

    // 3. Memória Mestre relevante recente
    dadosBrutos.memoria.forEach((m) => {
      const chave = `MEM_${m.id}`;
      if (!chavesVistas.has(chave)) {
        chavesVistas.add(chave);
        eventos.push({
          id: m.id,
          timestamp: m.data_hora || m.criado_em || "2026-09-25 04:30",
          tipo: "MEMORIA",
          autor: m.agente_origem || "Helena",
          titulo: `${m.assunto || "Registro de Memória"}`,
          descricao: m.registro?.slice(0, 180) + (m.registro?.length > 180 ? "…" : ""),
          projeto: m.related_object_id || undefined,
          empresa: m.business_id_area || undefined,
          evidencia: m.evidencia_origem || undefined,
        });
      }
    });

    // Ordenação decrescente por data/hora
    return eventos.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 25);
  }, [dadosBrutos]);

  // -------------------------------------------------------------
  // LINHA 7 — BLOQUEIOS E DECISÕES ("PRECISA DE ATENÇÃO")
  // -------------------------------------------------------------
  const itensAtencao: ItemAtencao[] = useMemo(() => {
    const lista: ItemAtencao[] = [];

    // 1. Decisões do Fundador (prioridade máxima)
    dadosBrutos.tarefas.forEach((t) => {
      if (t.responsavel === "Fundador" && t.status !== "CONCLUÍDA") {
        lista.push({
          id: `DEC_FUND_${t.task_id}`,
          categoria: "DECISAO_FUNDADOR",
          titulo: `${t.task_id}: Ação Obrigatória do Fundador`,
          descricao: t.tarefa,
          responsavel: "Fundador",
          projeto: t.project_id || undefined,
          empresa: t.business_id,
          prazo: t.prazo || undefined,
          impacto: t.prioridade === "CRÍTICA" ? "CRÍTICO" : "ALTO",
          acao_necessaria: t.bloqueio || "Executar ação e confirmar no sistema.",
          objeto_id: t.task_id,
        });
      }
    });

    // Tarefas bloqueadas que aguardam decisão do fundador
    dadosBrutos.tarefas.forEach((t) => {
      if (
        t.bloqueio &&
        t.bloqueio.toUpperCase().includes("FUNDADOR") &&
        t.responsavel !== "Fundador" &&
        t.status !== "CONCLUÍDA"
      ) {
        lista.push({
          id: `BLOQ_FUND_${t.task_id}`,
          categoria: "DECISAO_FUNDADOR",
          titulo: `${t.task_id}: Bloqueio dependente do Fundador`,
          descricao: `${t.tarefa} (${t.responsavel})`,
          responsavel: "Fundador",
          projeto: t.project_id || undefined,
          empresa: t.business_id,
          prazo: t.prazo || undefined,
          impacto: t.prioridade === "CRÍTICA" ? "CRÍTICO" : "ALTO",
          acao_necessaria: t.bloqueio,
          objeto_id: t.task_id,
        });
      }
    });

    // 2. Decisão da Helena
    lista.push({
      id: "DEC_HELENA_WIP",
      categoria: "DECISAO_HELENA",
      titulo: "Governança: Enquadramento de PRJ-0002 no Foco Executivo (WIP)",
      descricao:
        "PRJ-0002 (ids-max) está em execução técnica; Helena deve avaliar enquadramento formal no WIP e validação de prazos propostos.",
      responsavel: "Helena (AGT-01)",
      projeto: "PRJ-0002",
      empresa: "BIZ-002",
      impacto: "MÉDIO",
      acao_necessaria: "Validar prazos das tarefas TSK-0012 a TSK-0026.",
    });

    // 3. Bloqueios de Agentes
    dadosBrutos.tarefas.forEach((t) => {
      if (
        isTarefaBloqueada(t) &&
        t.responsavel !== "Fundador" &&
        !t.bloqueio?.toUpperCase().includes("FUNDADOR")
      ) {
        lista.push({
          id: `BLOQ_AGT_${t.task_id}`,
          categoria: "BLOQUEIO_AGENTE",
          titulo: `${t.task_id}: Bloqueio Operacional de Agente`,
          descricao: `${t.tarefa} · Responsável: ${t.responsavel}`,
          responsavel: t.responsavel,
          projeto: t.project_id || undefined,
          empresa: t.business_id,
          prazo: t.prazo || undefined,
          impacto: t.prioridade === "CRÍTICA" ? "CRÍTICO" : "ALTO",
          acao_necessaria: t.bloqueio || "Resolver dependência prévia.",
          objeto_id: t.task_id,
        });
      }
    });

    // 4. Riscos Críticos
    dadosBrutos.riscos.forEach((r) => {
      if (r.status === "ABERTO" && (r.impacto === "ALTO" || r.impacto === "CRÍTICO")) {
        lista.push({
          id: `RISCO_${r.risk_id}`,
          categoria: "RISCO_CRITICO",
          titulo: `${r.risk_id}: ${r.categoria || "Risco Corporativo"}`,
          descricao: r.risco,
          responsavel: r.responsavel || "Fundador + Helena",
          empresa: r.business_id,
          impacto: "ALTO",
          acao_necessaria: r.prevencao_mitigacao || "Plano de contingência.",
          objeto_id: r.risk_id,
        });
      }
    });

    return lista;
  }, [dadosBrutos]);

  // -------------------------------------------------------------
  // LINHA 8 — "O QUE TEMOS PARA FAZER HOJE?" (SEÇÃO "HOJE")
  // -------------------------------------------------------------
  const secaoHoje = useMemo(() => {
    // Tarefa prioritária Nº 1: TSK-0012 (rotação de segredos pelo fundador)
    const prioridadeUm =
      dadosBrutos.tarefas.find((t) => t.task_id === "TSK-0012") ||
      dadosBrutos.tarefas.find((t) => t.prioridade === "CRÍTICA" && t.status !== "CONCLUÍDA") ||
      null;

    // Tarefas Críticas do dia
    const criticas = dadosBrutos.tarefas.filter(
      (t) => t.prioridade === "CRÍTICA" && t.status !== "CONCLUÍDA"
    );

    // Tarefas que destravam outras
    const destravadoras = [
      {
        origem: "TSK-0012 (Fundador)",
        destino: "TSK-0013 (Theo)",
        motivo: "Remoção de chaves commitadas no git depende da rotação prévia nos painéis.",
      },
      {
        origem: "TSK-0014 (Fundador)",
        destino: "TSK-0017 (Theo)",
        motivo: "Habilitação de RLS em food_aliases e user_test_groups depende da definição do projeto Supabase oficial.",
      },
    ];

    return {
      prioridadeUm,
      criticas,
      destravadoras,
      proximaEntrega: "MIL-0002 — Contenção de segurança e base de configuração (28/09/2026)",
      totalHoje: criticas.length,
    };
  }, [dadosBrutos.tarefas]);

  // Se houver erro de permissão / 401 / 403, renderiza explicitamente o erro sem mascarar
  if (erro) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              CENTRAL DE EXECUÇÃO
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ambiente de monitoramento de agentes e tarefas
            </p>
          </div>
        </div>

        {erro.isAuth ? (
          <div className="rounded-xl border border-[#B91C1C]/30 bg-[#B91C1C]/5 p-8 text-center space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171]">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Erro de Autenticação / Acesso Negado (401/403/42501)
              </h2>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                As tabelas operacionais da Central de Execução são estritamente protegidas por RLS.
                Sua sessão não possui autorização ou o token de acesso expirou.
              </p>
              <p className="text-[11px] font-mono text-[#B91C1C] mt-2">
                Detalhe técnico: {erro.mensagem}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => buscarDados(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Tentar Novamente</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#007A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#006030]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Refazer Login</span>
              </button>
            </div>
          </div>
        ) : (
          <ExecutiveErrorState
            moduleName="Central de Execução"
            message={erro.mensagem}
            onRetry={() => buscarDados(true)}
          />
        )}
      </div>
    );
  }

  if (carregando) {
    return <ExecutiveLoadingState message="Conectando aos 21 agentes e sincronizando dados da Central de Execução…" />;
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto pb-24 text-foreground antialiased">
      {/* ========================================================= */}
      {/* TOPO: CENTRAL DE EXECUÇÃO & STATUS EM TEMPO REAL          */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#007A3D] bg-[#007A3D]/10 px-2 py-0.5 rounded-[5px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#007A3D] animate-pulse" />
              Central de Comando
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              RLS Multiempresa Ativo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            CENTRAL DE EXECUÇÃO
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Acompanhe pessoas, tarefas, entregas, bloqueios e handoffs do ecossistema em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Última Atualização
            </p>
            <p className="text-xs font-mono font-medium text-foreground">
              {ultimaAtualizacao || "Agora"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => buscarDados(true)}
            disabled={atualizandoManual}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizandoManual ? "animate-spin text-[#007A3D]" : ""}`} />
            <span>{atualizandoManual ? "Sincronizando…" : "Atualizar"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTROS GLOBAIS                                          */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-[#007A3D]" />
            <span>Filtros Operacionais</span>
          </div>
          {(filtros.empresaId !== "TODAS" ||
            filtros.projetoId !== "TODOS" ||
            filtros.agenteId !== "TODOS" ||
            filtros.status !== "TODOS" ||
            filtros.prioridade !== "TODAS" ||
            filtros.periodo !== "TODOS") && (
            <button
              type="button"
              onClick={() =>
                setFiltros({
                  empresaId: "TODAS",
                  projetoId: "TODOS",
                  agenteId: "TODOS",
                  status: "TODOS",
                  prioridade: "TODAS",
                  periodo: "TODOS",
                })
              }
              className="text-[11px] font-semibold text-[#007A3D] hover:underline"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Empresa */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Empresa
            </label>
            <select
              value={filtros.empresaId}
              onChange={(e) => {
                const val = e.target.value;
                setFiltros((prev) => ({ ...prev, empresaId: val }));
                if (val === "GRUPO" || val === "BIZ-001" || val === "BIZ-002" || val === "BIZ-003") {
                  setCurrentBusiness(val);
                }
              }}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODAS">Todas as Empresas</option>
              <option value="GRUPO">GRUPO CONSOLIDADO</option>
              <option value="BIZ-001">BIZ-001 · iGreen Energy</option>
              <option value="BIZ-002">BIZ-002 · Ecossistema de Saúde</option>
              <option value="BIZ-003">BIZ-003 · Humano Digital</option>
            </select>
          </div>

          {/* Projeto */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Projeto
            </label>
            <select
              value={filtros.projetoId}
              onChange={(e) => setFiltros((prev) => ({ ...prev, projetoId: e.target.value }))}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODOS">Todos os Projetos</option>
              {dadosBrutos.projetos.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_id} · {p.projeto.slice(0, 24)}…
                </option>
              ))}
            </select>
          </div>

          {/* Agente */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Agente
            </label>
            <select
              value={filtros.agenteId}
              onChange={(e) => setFiltros((prev) => ({ ...prev, agenteId: e.target.value }))}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODOS">Todos os 21 Agentes</option>
              {dadosBrutos.agentes.map((ag) => (
                <option key={ag.agent_id} value={ag.agent_id}>
                  {ag.agent_id} · {ag.agente}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Status
            </label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="NÃO INICIADA">NÃO INICIADA</option>
              <option value="EM EXECUÇÃO">EM EXECUÇÃO</option>
              <option value="BLOQUEADA">BLOQUEADA</option>
              <option value="CONCLUÍDA">CONCLUÍDA</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Prioridade
            </label>
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros((prev) => ({ ...prev, prioridade: e.target.value }))}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODAS">Todas as Prioridades</option>
              <option value="CRÍTICA">CRÍTICA (Peso 5)</option>
              <option value="ALTA">ALTA (Peso 3)</option>
              <option value="MÉDIA">MÉDIA (Peso 2)</option>
              <option value="BAIXA">BAIXA (Peso 1)</option>
            </select>
          </div>

          {/* Período */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              Período
            </label>
            <select
              value={filtros.periodo}
              onChange={(e) => setFiltros((prev) => ({ ...prev, periodo: e.target.value as any }))}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            >
              <option value="TODOS">Todo o Período</option>
              <option value="HOJE">Hoje (25/09/2026)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 1 — INDICADORES OPERACIONAIS (8 CARDS)              */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            1. Indicadores Operacionais
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {tarefasFiltradas.length} tarefas sob análise
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Tarefas em Execução */}
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Em Execução
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {indicadores.tarefas_em_execucao}
              </span>
              <span className="h-2 w-2 rounded-full bg-[#007A3D]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Em andamento ativo</span>
          </div>

          {/* 2. Tarefas Bloqueadas */}
          <div className="rounded-xl border border-[#B91C1C]/25 bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B91C1C] dark:text-[#f87171]">
              Bloqueadas
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-[#B91C1C] dark:text-[#f87171]">
                {indicadores.tarefas_bloqueadas}
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-[#B91C1C] dark:text-[#f87171]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Requerem atenção</span>
          </div>

          {/* 3. Tarefas Atrasadas */}
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Atrasadas
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {indicadores.tarefas_atrasadas}
              </span>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[10px] text-muted-foreground">Prazo vencido</span>
          </div>

          {/* 4. Concluídas Hoje */}
          <div className="rounded-xl border border-[#007A3D]/25 bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#007A3D] dark:text-[#22c55e]">
              Concluídas Hoje
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-[#007A3D] dark:text-[#22c55e]">
                {indicadores.concluidas_hoje}
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#007A3D] dark:text-[#22c55e]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Com evidência real</span>
          </div>

          {/* 5. Handoffs Pendentes */}
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Handoffs Pend.
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {indicadores.handoffs_pendentes}
              </span>
              <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[10px] text-muted-foreground">Fila de passagem</span>
          </div>

          {/* 6. Decisões Pendentes */}
          <div className="rounded-xl border border-[#B47D14]/25 bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B47D14] dark:text-[#fbbf24]">
              Decisões Pend.
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-[#B47D14] dark:text-[#fbbf24]">
                {indicadores.decisoes_pendentes}
              </span>
              <Flame className="h-3.5 w-3.5 text-[#B47D14] dark:text-[#fbbf24]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Fundador / Helena</span>
          </div>

          {/* 7. Agentes com Atividade Hoje */}
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agentes Ativos
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {indicadores.agentes_com_atividade_hoje}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ 21</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Atividade registrada</span>
          </div>

          {/* 8. Agentes Sem Atividade */}
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sem Atividade
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {indicadores.agentes_sem_atividade}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ 21</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Disponíveis / fila</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 8 — "O QUE TEMOS PARA FAZER HOJE?" (SEÇÃO "HOJE")   */}
      {/* ========================================================= */}
      <div className="rounded-2xl border-2 border-[#007A3D]/40 bg-gradient-to-br from-card via-card to-[#007A3D]/5 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/80 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#007A3D] text-white font-bold text-sm">
              H
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span>O QUE TEMOS PARA FAZER HOJE?</span>
                <span className="rounded-full bg-[#007A3D]/15 text-[#007A3D] dark:text-[#22c55e] text-[10px] font-bold px-2 py-0.5">
                  Rotina Diária do Fundador
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Diretrizes executivas sincronizadas: prioridade imediata, destravamento em cadeia e decisões pendentes.
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Próxima Entrega: <strong className="text-foreground">{secaoHoje.proximaEntrega}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card Destaque: PRIORIDADE Nº 1 */}
          <div className="lg:col-span-2 rounded-xl border border-[#B91C1C]/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#B91C1C] dark:text-[#f87171] bg-[#B91C1C]/10 px-2 py-0.5 rounded-[5px]">
                <Flame className="h-3 w-3" />
                PRIORIDADE Nº 1 DE HOJE (CRÍTICA)
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Responsável: <strong className="text-foreground">Fundador</strong>
              </span>
            </div>

            {secaoHoje.prioridadeUm ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {secaoHoje.prioridadeUm.task_id} · {secaoHoje.prioridadeUm.tarefa}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {secaoHoje.prioridadeUm.bloqueio ||
                        "Ação primordial para conter riscos de GPU e storage e destravar tarefas técnicas de Theo e Bruno."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarefaSelecionada(secaoHoje.prioridadeUm)}
                    className="shrink-0 text-xs font-semibold text-[#007A3D] hover:underline"
                  >
                    Ver Detalhes
                  </button>
                </div>
                <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Projeto: <strong>{secaoHoje.prioridadeUm.project_id || "PRJ-0002"}</strong></span>
                  <span>·</span>
                  <span>Empresa: <strong>{secaoHoje.prioridadeUm.business_id}</strong></span>
                  <span>·</span>
                  <span>Prazo: <strong>{secaoHoje.prioridadeUm.prazo || "25/09/2026"}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa crítica pendente para hoje.</p>
            )}
          </div>

          {/* Card: Cadeia de Destravamento */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tarefas Que Destravam Outras
            </span>
            <div className="space-y-2.5 text-xs">
              {secaoHoje.destravadoras.map((d, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="text-[#007A3D]">{d.origem}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span>{d.destino}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">{d.motivo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 2 — PROJETOS EM EXECUÇÃO                            */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            2. Projetos em Execução
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {projetosEstruturados.length} projeto(s) ativo(s)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projetosEstruturados.map((prj) => (
            <div
              key={prj.project_id}
              className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs hover:border-border/80 transition-colors"
            >
              {/* Cabeçalho do Card de Projeto */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                      {prj.project_id}
                    </span>
                    <ExecutiveBadge
                      variant={
                        prj.status === "EM EXECUÇÃO"
                          ? "info"
                          : prj.status === "CONCLUÍDO"
                          ? "success"
                          : "default"
                      }
                    >
                      {prj.status}
                    </ExecutiveBadge>
                    <ExecutiveBadge variant={prj.prioridade === "CRÍTICA" ? "danger" : "warning"}>
                      {prj.prioridade}
                    </ExecutiveBadge>
                  </div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {prj.projeto}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {prj.objetivo}
                  </p>
                </div>
              </div>

              {/* Grid dos Dois Percentuais: EXECUTIVO vs TÉCNICO */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border/60">
                {/* Percentual Executivo Ponderado */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                      Progresso Executivo
                    </span>
                    <span className="text-xs font-mono font-bold text-[#007A3D] dark:text-[#22c55e]">
                      {prj.progresso_executivo.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted/80 rounded-full h-2 mt-1.5 overflow-hidden">
                    <div
                      className="bg-[#007A3D] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, prj.progresso_executivo))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Metodologia MEM-0023 (pesos 5/3/2/1)
                  </p>
                </div>

                {/* Percentual Técnico Estruturado */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                      Progresso Técnico
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {prj.progresso_tecnico}
                    </span>
                  </div>
                  <div className="w-full bg-muted/80 rounded-full h-2 mt-1.5 overflow-hidden">
                    <div
                      className="bg-[#2563EB] h-2 rounded-full transition-all duration-500"
                      style={{
                        width: prj.progresso_tecnico.includes("%")
                          ? prj.progresso_tecnico
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {prj.project_id === "PRJ-0002"
                      ? "Registrado por Theo (AUD-0009)"
                      : "Indicador técnico estruturado"}
                  </p>
                </div>
              </div>

              {/* Último Diagnóstico Técnico */}
              {prj.ultimo_diagnostico_tecnico && (
                <div className="p-3 rounded-lg border border-border/80 bg-background text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                    Último Diagnóstico Técnico
                  </span>
                  <p className="text-[11px] text-foreground leading-relaxed font-mono">
                    {prj.ultimo_diagnostico_tecnico}
                  </p>
                </div>
              )}

              {/* Informações Operacionais & Marco Atual */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Marco Atual</span>
                  <strong className="text-foreground text-[11px] truncate block">
                    {prj.marco_atual || "Não definido"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Responsáveis</span>
                  <span className="text-foreground text-[11px] truncate block" title={prj.responsavel}>
                    {prj.responsavel}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tarefas</span>
                  <span className="text-foreground text-[11px] font-mono block">
                    {prj.concluidas}/{prj.tarefas_totais} ({prj.bloqueadas} bloq.)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Próxima Entrega</span>
                  <span className="text-foreground text-[11px] font-mono block">
                    {prj.proxima_entrega}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 3 — O QUE ESTÁ ACONTECENDO AGORA (KANBAN OPERACIONAL)*/}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              3. O Que Está Acontecendo Agora (Quadro Operacional)
            </h2>
            <span className="text-xs text-muted-foreground">
              Clique em qualquer tarefa para abrir os detalhes completos
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Coluna 1: NÃO INICIADA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Não Iniciada
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {kanbanColunas.NAO_INICIADA.length}
              </span>
            </div>
            <div className="space-y-2.5 min-h-[120px]">
              {kanbanColunas.NAO_INICIADA.map((t) => (
                <CardTarefa
                  key={t.task_id}
                  tarefa={t}
                  onClick={() => setTarefaSelecionada(t)}
                />
              ))}
              {kanbanColunas.NAO_INICIADA.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhuma tarefa nesta coluna
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: EM EXECUÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#007A3D]/10 border border-[#007A3D]/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#007A3D] dark:text-[#22c55e]">
                Em Execução
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#007A3D]/20 text-[#007A3D] dark:text-[#22c55e]">
                {kanbanColunas.EM_EXECUCAO.length}
              </span>
            </div>
            <div className="space-y-2.5 min-h-[120px]">
              {kanbanColunas.EM_EXECUCAO.map((t) => (
                <CardTarefa
                  key={t.task_id}
                  tarefa={t}
                  onClick={() => setTarefaSelecionada(t)}
                />
              ))}
              {kanbanColunas.EM_EXECUCAO.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhuma tarefa em execução no momento
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: BLOQUEADA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#B91C1C]/10 border border-[#B91C1C]/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#B91C1C] dark:text-[#f87171]">
                Bloqueada
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#B91C1C]/20 text-[#B91C1C] dark:text-[#f87171]">
                {kanbanColunas.BLOQUEADA.length}
              </span>
            </div>
            <div className="space-y-2.5 min-h-[120px]">
              {kanbanColunas.BLOQUEADA.map((t) => (
                <CardTarefa
                  key={t.task_id}
                  tarefa={t}
                  onClick={() => setTarefaSelecionada(t)}
                />
              ))}
              {kanbanColunas.BLOQUEADA.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhuma tarefa bloqueada
                </div>
              )}
            </div>
          </div>

          {/* Coluna 4: CONCLUÍDA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#007A3D]/10 border border-[#007A3D]/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#007A3D] dark:text-[#22c55e]">
                Concluída
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#007A3D]/20 text-[#007A3D] dark:text-[#22c55e]">
                {kanbanColunas.CONCLUIDA.length}
              </span>
            </div>
            <div className="space-y-2.5 min-h-[120px]">
              {kanbanColunas.CONCLUIDA.map((t) => (
                <CardTarefa
                  key={t.task_id}
                  tarefa={t}
                  onClick={() => setTarefaSelecionada(t)}
                />
              ))}
              {kanbanColunas.CONCLUIDA.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhuma tarefa concluída no filtro
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 4 — EQUIPE DIGITAL (TODOS OS 21 AGENTES)            */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              4. Equipe Digital (21 Especialistas de IA)
            </h2>
            <p className="text-xs text-muted-foreground">
              Helena e os 20 bots Grok conectados. Clique no agente para inspecionar histórico, tarefas e handoffs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {equipeDigital.map((ag) => (
            <CardAgente
              key={ag.agent_id}
              agente={ag}
              onClick={() => setAgenteSelecionado(ag)}
            />
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 5 — FLUXO DE HANDOFFS (FLUXO DE TRABALHO)           */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              5. Fluxo de Trabalho e Handoffs Dinâmicos
            </h2>
            <p className="text-xs text-muted-foreground">
              Cadeia de passagens de bastão auditadas e resultados produzidos (public.handoffs).
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {handoffsFiltrados.length} handoff(s)
          </span>
        </div>

        <div className="space-y-3">
          {handoffsFiltrados.map((h) => (
            <div
              key={h.id}
              onClick={() => setHandoffSelecionado(h)}
              className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-xs hover:border-[#007A3D]/40 transition-colors cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {/* DE -> PARA */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                    {h.id}
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold">
                    <span>{h.de}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{h.para}</span>
                  </div>
                  <ExecutiveBadge
                    variant={h.status === "CONCLUÍDO" ? "success" : "warning"}
                  >
                    {h.status}
                  </ExecutiveBadge>
                  {h.related_object_id && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Projeto: <strong>{h.related_object_id}</strong>
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-muted-foreground">
                  {h.data_hora}
                </div>
              </div>

              {/* Assunto */}
              <h3 className="text-sm font-semibold text-foreground">
                {h.assunto}
              </h3>

              {/* Contexto e Retorno */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {h.pergunta_tarefa_transferida && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                      Tarefa Transferida
                    </span>
                    <p className="text-muted-foreground leading-relaxed line-clamp-3">
                      {h.pergunta_tarefa_transferida}
                    </p>
                  </div>
                )}

                {h.retorno_conclusao && (
                  <div className="p-3 rounded-lg bg-[#007A3D]/5 border border-[#007A3D]/20 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#007A3D] dark:text-[#22c55e] tracking-wider block">
                      Resultado & Evidência
                    </span>
                    <p className="text-foreground leading-relaxed line-clamp-3">
                      {h.retorno_conclusao}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {handoffsFiltrados.length === 0 && (
            <ExecutiveEmptyState
              title="Nenhum handoff encontrado"
              description="Nenhum handoff registrado atende aos filtros atuais."
            />
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* LINHA 6 & 7: TIMELINE OPERACIONAL & PRECISA DE ATENÇÃO    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LINHA 6 — TIMELINE OPERACIONAL (2 COLS) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                6. Timeline Operacional (Atividade Recente)
              </h2>
              <p className="text-xs text-muted-foreground">
                Feed cronológico unificado de auditorias, memórias, tarefas e handoffs sem duplicações.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {timelineEventos.length} eventos
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 max-h-[580px] overflow-y-auto scrollbar-thin">
            {timelineEventos.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors"
              >
                <span
                  className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-wider ${
                    evt.tipo === "AUDITORIA"
                      ? "bg-[#2563EB]/10 text-[#2563EB]"
                      : evt.tipo === "HANDOFF"
                      ? "bg-[#7C3AED]/10 text-[#7C3AED]"
                      : evt.tipo === "MEMORIA"
                      ? "bg-[#007A3D]/10 text-[#007A3D]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {evt.tipo}
                </span>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {evt.autor} · {evt.titulo}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {evt.timestamp}
                    </span>
                  </div>

                  {evt.descricao && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {evt.descricao}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono pt-0.5">
                    {evt.projeto && <span>Projeto: {evt.projeto}</span>}
                    {evt.evidencia && <span className="truncate max-w-[280px]">Evidência: {evt.evidencia}</span>}
                  </div>
                </div>
              </div>
            ))}

            {timelineEventos.length === 0 && (
              <ExecutiveEmptyState
                title="Sem eventos na timeline"
                description="Nenhum evento registrado para o filtro aplicado."
              />
            )}
          </div>
        </div>

        {/* LINHA 7 — BLOQUEIOS E DECISÕES ("PRECISA DE ATENÇÃO") (1 COL) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#B91C1C] dark:text-[#f87171] flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>7. Precisa de Atenção</span>
            </h2>
            <span className="text-xs font-mono font-bold text-[#B91C1C]">
              {itensAtencao.length} item(s)
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-h-[580px] overflow-y-auto scrollbar-thin">
            {itensAtencao.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-border/80 bg-background space-y-2 hover:border-[#B91C1C]/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${
                      item.categoria === "DECISAO_FUNDADOR"
                        ? "bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171]"
                        : item.categoria === "DECISAO_HELENA"
                        ? "bg-[#007A3D]/10 text-[#007A3D]"
                        : item.categoria === "BLOQUEIO_AGENTE"
                        ? "bg-[#B47D14]/10 text-[#B47D14]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.categoria.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Resp: <strong>{item.responsavel}</strong>
                  </span>
                </div>

                <h3 className="text-xs font-semibold text-foreground leading-snug">
                  {item.titulo}
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {item.descricao}
                </p>

                <div className="pt-1.5 border-t border-border/60 text-[10px] text-[#B91C1C] dark:text-[#f87171] font-medium">
                  <strong>Ação:</strong> {item.acao_necessaria}
                </div>
              </div>
            ))}

            {itensAtencao.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Nenhum bloqueio ou decisão crítica pendente no momento.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DRAWER: DETALHES DA TAREFA                                */}
      {/* ========================================================= */}
      <ExecutiveDrawer
        open={Boolean(tarefaSelecionada)}
        onOpenChange={(aberto) => !aberto && setTarefaSelecionada(null)}
        title={tarefaSelecionada?.task_id || "Tarefa"}
        subtitle={tarefaSelecionada?.tarefa}
        badge={
          tarefaSelecionada && (
            <ExecutiveBadge
              variant={
                tarefaSelecionada.status === "CONCLUÍDA"
                  ? "success"
                  : isTarefaBloqueada(tarefaSelecionada)
                  ? "danger"
                  : tarefaSelecionada.status === "EM EXECUÇÃO"
                  ? "info"
                  : "default"
              }
            >
              {tarefaSelecionada.status}
            </ExecutiveBadge>
          )
        }
      >
        {tarefaSelecionada && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Responsável
                </span>
                <span className="font-semibold text-foreground text-xs block mt-0.5">
                  {tarefaSelecionada.responsavel}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Prioridade
                </span>
                <span className="font-semibold text-foreground text-xs block mt-0.5">
                  {tarefaSelecionada.prioridade}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Projeto
                </span>
                <span className="font-mono text-foreground text-xs block mt-0.5">
                  {tarefaSelecionada.project_id || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Empresa
                </span>
                <span className="font-mono text-foreground text-xs block mt-0.5">
                  {tarefaSelecionada.business_id}
                </span>
              </div>
            </div>

            {tarefaSelecionada.prazo && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Prazo de Conclusão
                </span>
                <p className="font-mono text-foreground text-xs bg-muted/40 p-2.5 rounded-lg border border-border">
                  {tarefaSelecionada.prazo}
                </p>
              </div>
            )}

            {tarefaSelecionada.definicao_de_pronto && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Definição de Pronto (DoD)
                </span>
                <p className="text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border">
                  {tarefaSelecionada.definicao_de_pronto}
                </p>
              </div>
            )}

            {tarefaSelecionada.bloqueio && (
              <div className="p-3 rounded-lg border border-[#B91C1C]/30 bg-[#B91C1C]/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#B91C1C] dark:text-[#f87171] block">
                  Bloqueio / Impedimento Registrado
                </span>
                <p className="text-[#B91C1C] dark:text-[#f87171] leading-relaxed">
                  {tarefaSelecionada.bloqueio}
                </p>
              </div>
            )}

            {tarefaSelecionada.evidencia && (
              <div className="p-3 rounded-lg border border-[#007A3D]/30 bg-[#007A3D]/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#007A3D] dark:text-[#22c55e] block">
                  Evidência Verificável
                </span>
                <p className="text-foreground leading-relaxed font-mono text-[11px]">
                  {tarefaSelecionada.evidencia}
                </p>
              </div>
            )}

            {tarefaSelecionada.related_object && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Vínculo / Dependência
                </span>
                <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded-lg border border-border">
                  {tarefaSelecionada.related_object}
                </p>
              </div>
            )}
          </div>
        )}
      </ExecutiveDrawer>

      {/* ========================================================= */}
      {/* DRAWER: ATIVIDADE DO AGENTE                               */}
      {/* ========================================================= */}
      <ExecutiveDrawer
        open={Boolean(agenteSelecionado)}
        onOpenChange={(aberto) => !aberto && setAgenteSelecionado(null)}
        title={`${agenteSelecionado?.agent_id} · ${agenteSelecionado?.agente}`}
        subtitle={agenteSelecionado?.cargo_funcao}
        badge={
          agenteSelecionado && (
            <ExecutiveBadge
              variant={
                agenteSelecionado.status_visual === "TRABALHANDO"
                  ? "success"
                  : agenteSelecionado.status_visual === "BLOQUEADO"
                  ? "danger"
                  : agenteSelecionado.status_visual === "DECISÃO PENDENTE"
                  ? "warning"
                  : agenteSelecionado.status_visual === "AGUARDANDO"
                  ? "info"
                  : "default"
              }
            >
              {agenteSelecionado.status_visual}
            </ExecutiveBadge>
          )
        }
      >
        {agenteSelecionado && (
          <div className="space-y-4 text-xs">
            {/* Metadados do Agente */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Área
                </span>
                <span className="text-foreground font-semibold">{agenteSelecionado.area}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Conexão
                </span>
                <span className="text-foreground font-mono">
                  {agenteSelecionado.provider} · {agenteSelecionado.connection_status}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Tarefas Pendentes
                </span>
                <span className="text-foreground font-bold">{agenteSelecionado.tarefas_pendentes}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Concluídas Hoje
                </span>
                <span className="text-[#007A3D] font-bold">{agenteSelecionado.concluidas_hoje}</span>
              </div>
            </div>

            {/* Missão */}
            {agenteSelecionado.missao && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Missão Operacional
                </span>
                <p className="text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border">
                  {agenteSelecionado.missao}
                </p>
              </div>
            )}

            {/* Tarefas Atribuídas */}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">
                Tarefas Sob Responsabilidade ({agenteSelecionado.tarefas_atribuidas.length})
              </span>
              <div className="space-y-2">
                {agenteSelecionado.tarefas_atribuidas.map((t) => (
                  <div
                    key={t.task_id}
                    onClick={() => setTarefaSelecionada(t)}
                    className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {t.task_id}
                      </span>
                      <ExecutiveBadge
                        size="sm"
                        variant={
                          t.status === "CONCLUÍDA"
                            ? "success"
                            : isTarefaBloqueada(t)
                            ? "danger"
                            : "default"
                        }
                      >
                        {t.status}
                      </ExecutiveBadge>
                    </div>
                    <p className="text-xs text-foreground font-medium">{t.tarefa}</p>
                    {t.bloqueio && (
                      <p className="text-[10px] text-[#B91C1C] dark:text-[#f87171] leading-tight">
                        Bloqueio: {t.bloqueio}
                      </p>
                    )}
                  </div>
                ))}
                {agenteSelecionado.tarefas_atribuidas.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma tarefa atribuída no momento.</p>
                )}
              </div>
            </div>

            {/* Handoffs */}
            {(agenteSelecionado.ultimo_handoff_enviado || agenteSelecionado.ultimo_handoff_recebido) && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">
                  Últimos Handoffs
                </span>
                <div className="space-y-2 text-xs">
                  {agenteSelecionado.ultimo_handoff_enviado && (
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Enviado:
                      </span>
                      <p className="text-foreground font-medium">
                        {agenteSelecionado.ultimo_handoff_enviado.assunto}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Para: <strong>{agenteSelecionado.ultimo_handoff_enviado.para}</strong>
                      </p>
                    </div>
                  )}
                  {agenteSelecionado.ultimo_handoff_recebido && (
                    <div className="p-2.5 rounded-lg bg-[#007A3D]/5 border border-[#007A3D]/20 space-y-1">
                      <span className="text-[10px] font-bold text-[#007A3D] uppercase">
                        Recebido:
                      </span>
                      <p className="text-foreground font-medium">
                        {agenteSelecionado.ultimo_handoff_recebido.assunto}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        De: <strong>{agenteSelecionado.ultimo_handoff_recebido.de}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ExecutiveDrawer>

      {/* ========================================================= */}
      {/* DRAWER: DETALHES DO HANDOFF                               */}
      {/* ========================================================= */}
      <ExecutiveDrawer
        open={Boolean(handoffSelecionado)}
        onOpenChange={(aberto) => !aberto && setHandoffSelecionado(null)}
        title={handoffSelecionado?.id || "Handoff"}
        subtitle={handoffSelecionado?.assunto}
        badge={
          handoffSelecionado && (
            <ExecutiveBadge
              variant={handoffSelecionado.status === "CONCLUÍDO" ? "success" : "warning"}
            >
              {handoffSelecionado.status}
            </ExecutiveBadge>
          )
        }
      >
        {handoffSelecionado && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  De:
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {handoffSelecionado.de}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Para:
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {handoffSelecionado.para}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                Contexto Essencial
              </span>
              <p className="text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border">
                {handoffSelecionado.contexto_essencial}
              </p>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                Tarefa Transferida
              </span>
              <p className="text-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border">
                {handoffSelecionado.pergunta_tarefa_transferida}
              </p>
            </div>

            {handoffSelecionado.pendencias && (
              <div>
                <span className="text-[10px] text-[#B91C1C] dark:text-[#f87171] uppercase font-bold block mb-1">
                  Pendências Transferidas
                </span>
                <p className="text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border">
                  {handoffSelecionado.pendencias}
                </p>
              </div>
            )}

            {handoffSelecionado.retorno_conclusao && (
              <div className="p-3 rounded-lg bg-[#007A3D]/5 border border-[#007A3D]/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#007A3D] dark:text-[#22c55e] block">
                  Retorno / Conclusão
                </span>
                <p className="text-foreground leading-relaxed">
                  {handoffSelecionado.retorno_conclusao}
                </p>
              </div>
            )}
          </div>
        )}
      </ExecutiveDrawer>
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENTES EXECUTIVOS
// -------------------------------------------------------------

function CardTarefa({
  tarefa,
  onClick,
}: {
  tarefa: TarefaExecucao;
  onClick: () => void;
}) {
  const bloq = isTarefaBloqueada(tarefa);
  const atrasada = isTarefaAtrasada(tarefa, "2026-09-25");
  const inicial = tarefa.responsavel.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3.5 space-y-2.5 bg-card hover:border-[#007A3D]/50 transition-all cursor-pointer shadow-xs ${
        bloq
          ? "border-[#B91C1C]/40 bg-[#B91C1C]/5"
          : tarefa.status === "EM EXECUÇÃO"
          ? "border-[#007A3D]/40 bg-[#007A3D]/5"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
          {tarefa.task_id}
        </span>
        <ExecutiveBadge
          size="sm"
          variant={
            tarefa.prioridade === "CRÍTICA"
              ? "danger"
              : tarefa.prioridade === "ALTA"
              ? "warning"
              : "default"
          }
        >
          {tarefa.prioridade}
        </ExecutiveBadge>
      </div>

      <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
        {tarefa.tarefa}
      </h4>

      {bloq && tarefa.bloqueio && (
        <div className="p-2 rounded-md bg-[#B91C1C]/10 border border-[#B91C1C]/25 text-[10px] text-[#B91C1C] dark:text-[#f87171] leading-tight">
          <strong>Bloqueio:</strong> {tarefa.bloqueio}
        </div>
      )}

      {tarefa.evidencia && tarefa.status === "CONCLUÍDA" && (
        <div className="p-1.5 rounded-md bg-[#007A3D]/10 text-[10px] text-[#007A3D] dark:text-[#22c55e] font-mono truncate">
          ✓ {tarefa.evidencia}
        </div>
      )}

      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate max-w-[140px]" title={tarefa.responsavel}>
          <div className="grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] font-bold text-foreground shrink-0">
            {inicial}
          </div>
          <span className="truncate">{tarefa.responsavel}</span>
        </div>

        {tarefa.prazo && (
          <span
            className={`font-mono text-[10px] ${
              atrasada
                ? "text-[#B91C1C] font-bold"
                : tarefa.prazo === "2026-09-25"
                ? "text-[#B47D14] font-bold"
                : ""
            }`}
          >
            {tarefa.prazo === "2026-09-25" ? "Hoje" : tarefa.prazo}
          </span>
        )}
      </div>
    </div>
  );
}

function CardAgente({
  agente,
  onClick,
}: {
  agente: AgenteExecucao;
  onClick: () => void;
}) {
  const inicial = agente.agente.charAt(0).toUpperCase();

  const getStatusBadge = () => {
    switch (agente.status_visual) {
      case "TRABALHANDO":
        return <ExecutiveBadge size="sm" variant="success">TRABALHANDO</ExecutiveBadge>;
      case "BLOQUEADO":
        return <ExecutiveBadge size="sm" variant="danger">BLOQUEADO</ExecutiveBadge>;
      case "DECISÃO PENDENTE":
        return <ExecutiveBadge size="sm" variant="warning">DECISÃO</ExecutiveBadge>;
      case "AGUARDANDO":
        return <ExecutiveBadge size="sm" variant="info">AGUARDANDO</ExecutiveBadge>;
      default:
        return <ExecutiveBadge size="sm" variant="default">SEM TAREFA</ExecutiveBadge>;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3 bg-card hover:border-[#007A3D]/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
        agente.agent_id === "AGT-01" ? "border-[#007A3D]/40 bg-[#007A3D]/5" : "border-border"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                agente.agent_id === "AGT-01"
                  ? "bg-[#007A3D] text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              {inicial}
            </div>
            <div>
              <span className="font-mono text-[10px] font-semibold text-muted-foreground block">
                {agente.agent_id}
              </span>
              <h4 className="text-xs font-semibold text-foreground leading-none">
                {agente.agente}
              </h4>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2">
          {agente.cargo_funcao}
        </p>

        <div className="mb-2">{getStatusBadge()}</div>

        <div className="text-[10px] text-muted-foreground line-clamp-1">
          {agente.tarefa_atual ? (
            <span>
              <strong>Em mãos:</strong> {agente.tarefa_atual.tarefa}
            </span>
          ) : (
            <span className="italic">Nenhuma tarefa atribuída</span>
          )}
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>Pend: {agente.tarefas_pendentes}</span>
        <span>Hoje: {agente.concluidas_hoje}</span>
        {agente.bloqueios > 0 && <span className="text-[#B91C1C] font-bold">Bloq: {agente.bloqueios}</span>}
      </div>
    </div>
  );
}
