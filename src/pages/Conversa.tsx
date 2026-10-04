import { FormEvent, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Clock,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Zap,
  Activity,
  ShieldCheck,
  History,
  Mic,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  FileText,
  Printer,
  Copy,
  ExternalLink,
  Eye,
  Check,
  Layers,
  ChevronRight,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { falarComHelena } from "@/lib/helena-exec";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import type { EntregaConteudo, Plano } from "@/lib/helena";

type Memoria = {
  id: string;
  data_hora: string;
  assunto: string;
  registro: string;
  proxima_acao: string;
  business_id_area?: string | null;
  agente_origem?: string | null;
};

interface MensagemChat {
  id: string;
  remetente: "fundador" | "helena";
  texto: string;
  timestamp: string;
  plano?: Plano;
  gravou?: string[];
}

export default function Conversa() {
  const { currentBusiness, currentBusinessId, isConsolidated, selecionadas, todasLigadas, rotulo } = useBusiness();
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    {
      id: "boas-vindas",
      remetente: "helena",
      texto:
        "Olá, Fundador. Sou a Helena, sua Chief of Staff. Monitoro os 3 negócios do ecossistema (iGreen, Saúde, Humano Digital) com 21 agentes especializados. O que deseja relatar, decidir ou lançar hoje?",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [historico, setHistorico] = useState<Memoria[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [abaConteudo, setAbaConteudo] = useState<Record<string, "instagram" | "dialogo" | "dossie">>({});
  const [dossieModal, setDossieModal] = useState<{ tema: string; empresa: string; dossie: EntregaConteudo["dossie_executivo"] } | null>(null);
  const [enqueteVotos, setEnqueteVotos] = useState<Record<string, number>>({});
  const [curtidoPost, setCurtidoPost] = useState<Record<string, boolean>>({});

  const carregarMemoria = async () => {
    let query = supabase
      .from("memoria_mestre")
      .select("id,data_hora,assunto,registro,proxima_acao,business_id_area,agente_origem")
      .order("data_hora", { ascending: false })
      .limit(10);

    if (!isConsolidated && currentBusinessId) {
      query = query.eq("business_id_area", currentBusinessId);
    } else if (isConsolidated && selecionadas.length > 0) {
      query = query.in("business_id_area", [...selecionadas]);
    }

    const { data, error } = await query;
    if (!error && data) {
      setHistorico(data as Memoria[]);
    }
  };

  useEffect(() => {
    carregarMemoria();
  }, [currentBusinessId, isConsolidated]);

  const atalhosComando = [
    {
      label: "Entrada R$ 10.000 iGreen",
      comando: "Recebi R$ 10.000,00 na conta ACC-IG da iGreen referente a contratos de energia",
    },
    {
      label: "Ideia para Humano Digital",
      comando: "Ideia para Humano Digital: Criar módulo de atendimento com voz neural para clientes",
    },
    {
      label: "Lead App de Saúde R$ 4.500",
      comando: "Novo lead Clinica Vida no App de Saude valor R$ 4.500,00 para avaliar com Victor",
    },
    {
      label: "Consulta Status Caixa",
      comando: "Qual é o saldo atual do caixa e a previsão de saída para este mês?",
    },
  ];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!texto.trim() || enviando) return;

    const textoUsuario = texto.trim();
    const horaAtual = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const novaMensagemUsuario: MensagemChat = {
      id: Date.now().toString(),
      remetente: "fundador",
      texto: textoUsuario,
      timestamp: horaAtual,
    };

    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setTexto("");
    setEnviando(true);
    setErro("");

    try {
      const resultado = await falarComHelena(textoUsuario);
      const p = resultado.plano;

      const novaRespostaHelena: MensagemChat = {
        id: (Date.now() + 1).toString(),
        remetente: "helena",
        texto: p.conclusao || "Comando processado e registrado na orquestração mestre.",
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        plano: p,
        gravou: resultado.gravou,
      };

      setMensagens((prev) => [...prev, novaRespostaHelena]);
      await carregarMemoria();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui gravar no banco.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="pe-page-header">
        <h1 className="pe-page-title">Helena</h1>
        <p className="pe-page-sub">Chief of Staff. Ela grava na tabela do assunto e não abre uma segunda frente. Vendo {rotulo}.</p>
      </header>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{erro}</span>
        </div>
      )}

      {/* Grid Principal: Chat Interativo + Timeline de Memória */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Coluna do Chat */}
        <div className="flex flex-col rounded-3xl border border-border/50 bg-card/60 shadow-lg backdrop-blur-xl h-[650px] overflow-hidden">
          {/* Thread de Mensagens com visual Premium */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-thin">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.remetente === "fundador" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.remetente === "helena" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] md:max-w-[75%] space-y-2 ${
                    msg.remetente === "fundador" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Balão de Texto */}
                  <div
                    className={`rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                      msg.remetente === "fundador"
                        ? "bg-primary text-primary-foreground shadow-md rounded-tr-xs"
                        : "bg-muted/70 text-foreground border border-border/40 rounded-tl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.texto}</p>
                    <span
                      className={`block mt-2 text-[10px] ${
                        msg.remetente === "fundador"
                          ? "text-primary-foreground/70 text-right"
                          : "text-muted-foreground text-left"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Opções de Resposta Rápida (quando a Helena solicita esclarecimento) */}
                  {msg.plano?.opcoes_resposta && msg.plano.opcoes_resposta.length > 0 && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 shadow-sm">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        {msg.plano.pergunta_esclarecimento || "Escolha uma das opções abaixo para prosseguir:"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.plano.opcoes_resposta.map((op, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setTexto(op.comando);
                            }}
                            className="rounded-xl border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-xs"
                          >
                            {op.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Visual de Entrega de Conteúdo (Post + Stories 100% prontos de padrão de mercado) */}
                  {msg.plano?.entrega_conteudo && (() => {
                    const c = msg.plano.entrega_conteudo!;
                    const abaAtual = abaConteudo[msg.id] || "instagram";
                    const curtido = curtidoPost[msg.id] || false;

                    return (
                      <div className="rounded-3xl border border-emerald-500/40 bg-card/95 p-4 md:p-5 space-y-4 shadow-xl backdrop-blur-xl">
                        {/* CABEÇALHO DO PACOTE */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm md:text-base font-bold text-foreground">
                                {c.tema}
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Empresa: <strong className="text-foreground">{c.empresa}</strong> · Produzido por Helena, Marina, Isabela, Maya e Bruno
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ 100% PRONTO PARA PUBLICAR
                            </span>
                            <button
                              type="button"
                              onClick={() => setDossieModal({ tema: c.tema, empresa: c.empresa, dossie: c.dossie_executivo })}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-xs"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>Dossiê da Campanha</span>
                            </button>
                          </div>
                        </div>

                        {/* SELETOR DE ABAS DE VISUALIZAÇÃO */}
                        <div className="flex flex-wrap gap-2 border-b border-border/30 pb-3">
                          <button
                            type="button"
                            onClick={() => setAbaConteudo((prev) => ({ ...prev, [msg.id]: "instagram" }))}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                              abaAtual === "instagram"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>📱 Mockup Instagram (Feed + 4 Stories)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAbaConteudo((prev) => ({ ...prev, [msg.id]: "dialogo" }))}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                              abaAtual === "dialogo"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>💬 Diálogo da Equipe ({c.dialogo_equipe.length} Agentes)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAbaConteudo((prev) => ({ ...prev, [msg.id]: "dossie" }))}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                              abaAtual === "dossie"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>📊 Relatório Executivo</span>
                          </button>
                        </div>

                        {/* ABA 1: VISUAL INSTAGRAM REAL (FEED + STORIES 9:16) */}
                        {abaAtual === "instagram" && (
                          <div className="space-y-6">
                            {/* MOCKUP DO FEED DO INSTAGRAM */}
                            <div className="rounded-2xl border border-border/70 bg-[#0f1214] text-white p-4 md:p-5 max-w-xl mx-auto shadow-2xl space-y-3.5">
                              {/* Header do Perfil Instagram */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-[2px]">
                                    <div className="h-full w-full rounded-full bg-[#101312] flex items-center justify-center text-xs font-bold text-emerald-400">
                                      HD
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold tracking-tight">humanodigital.ia</span>
                                      <span className="h-3 w-3 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px]">✓</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-400 block -mt-0.5">São Paulo, Brasil</span>
                                  </div>
                                </div>
                                <span className="text-zinc-400 text-sm">•••</span>
                              </div>

                              {/* Arte Visual Simulada do Post (Banner de Alto Impacto) */}
                              <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#0f172a] p-6 text-center space-y-4 shadow-inner">
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                  ⚡ Oportunidade 2026 · Humano Digital
                                </div>
                                <h3 className="text-lg md:text-xl font-extrabold text-white leading-tight drop-shadow-md">
                                  {c.post.headline}
                                </h3>
                                <p className="text-xs text-emerald-100/90 max-w-md mx-auto leading-relaxed">
                                  Conectamos pessoas reais ao treinamento dos modelos de IA mais inovadores do planeta. Renda extra consistente, ética e no seu próprio ritmo.
                                </p>
                                <div className="pt-2 flex items-center justify-center gap-2 text-[10px] text-emerald-300/80 font-mono">
                                  <span>🔒 100% Remoto</span>
                                  <span>•</span>
                                  <span>👥 Vagas Limitadas</span>
                                  <span>•</span>
                                  <span>💰 Sem Promessas Fáceis</span>
                                </div>
                              </div>

                              {/* Barra de Ações do Instagram */}
                              <div className="flex items-center justify-between text-zinc-300 pt-1">
                                <div className="flex items-center gap-4">
                                  <button
                                    type="button"
                                    onClick={() => setCurtidoPost((prev) => ({ ...prev, [msg.id]: !curtido }))}
                                    className={`flex items-center gap-1.5 transition-colors ${curtido ? "text-red-500" : "hover:text-red-400"}`}
                                  >
                                    <Heart className={`h-5 w-5 ${curtido ? "fill-red-500" : ""}`} />
                                  </button>
                                  <MessageCircle className="h-5 w-5 hover:text-white cursor-pointer" />
                                  <Share2 className="h-5 w-5 hover:text-white cursor-pointer" />
                                </div>
                                <Bookmark className="h-5 w-5 hover:text-white cursor-pointer" />
                              </div>

                              <div className="text-[11px] font-bold text-zinc-200">
                                {curtido ? "1.429 curtidas" : "1.428 curtidas"}
                              </div>

                              {/* Legenda do Post */}
                              <div className="text-xs text-zinc-300 space-y-2 whitespace-pre-line leading-relaxed">
                                <span className="font-bold text-white mr-1.5">humanodigital.ia</span>
                                {c.post.corpo}
                                <p className="text-emerald-400 font-semibold pt-1">{c.post.cta}</p>
                                <p className="text-[11px] text-blue-400 font-mono">{c.post.hashtags.join(" ")}</p>
                              </div>

                              {/* Botão de Cópia Rápida */}
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullText = `${c.post.headline}\n\n${c.post.corpo}\n\n${c.post.cta}\n\n${c.post.hashtags.join(" ")}`;
                                    navigator.clipboard.writeText(fullText);
                                    alert("Legenda copiada com sucesso! Pronto para colar no Instagram/Facebook.");
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-xs font-bold transition-all shadow-md"
                                >
                                  <Copy className="h-4 w-4" />
                                  <span>Copiar Post Completo (Legenda + Hashtags)</span>
                                </button>
                              </div>
                            </div>

                            {/* CARROSSEL DOS 4 STORIES VERTICAIS (9:16) */}
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs md:text-sm font-bold text-foreground flex items-center gap-2">
                                  <span>📱 4 Stories Verticais (Formato 9:16 Oficial)</span>
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">Prontos para postar</span>
                                </h5>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const storiesText = c.stories
                                      .map((s) => `${s.titulo}\nTexto: ${s.texto}\nInteração/Adesivo: ${s.interacao}`)
                                      .join("\n\n---\n\n");
                                    navigator.clipboard.writeText(storiesText);
                                    alert("Roteiro dos 4 Stories copiado para a área de transferência!");
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
                                >
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar Roteiro dos 4 Stories</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                {c.stories.map((st) => {
                                  const votoKey = `${msg.id}-${st.numero}`;
                                  const voto = enqueteVotos[votoKey];

                                  return (
                                    <div
                                      key={st.numero}
                                      className="rounded-2xl border border-zinc-800 bg-[#0f1214] text-white p-3.5 flex flex-col justify-between h-[360px] shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all"
                                    >
                                      {/* Barra superior de Story do Instagram */}
                                      <div>
                                        <div className="flex gap-1 mb-2.5">
                                          <div className="h-1 flex-1 rounded-full bg-white/80" />
                                          <div className="h-1 flex-1 rounded-full bg-white/30" />
                                          <div className="h-1 flex-1 rounded-full bg-white/30" />
                                          <div className="h-1 flex-1 rounded-full bg-white/30" />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white">humanodigital.ia</span>
                                            <span>2h</span>
                                          </div>
                                          <span className="rounded bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 text-[9px]">
                                            9:16
                                          </span>
                                        </div>

                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mt-2">
                                          {st.titulo}
                                        </span>

                                        <p className="text-xs md:text-sm font-bold text-white mt-3 leading-snug">
                                          "{st.texto}"
                                        </p>
                                      </div>

                                      {/* Adesivo Interativo Simulado */}
                                      <div className="my-auto">
                                        {st.tipo_adesivo === "enquete" && (
                                          <div className="rounded-xl border border-white/20 bg-white/10 p-2.5 space-y-1.5 backdrop-blur-md">
                                            <span className="text-[10px] font-bold text-zinc-200 block text-center">
                                              📊 Enquete do Instagram (Clique para votar)
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setEnqueteVotos((prev) => ({ ...prev, [votoKey]: 1 }))}
                                              className={`w-full rounded-lg py-1.5 px-2 text-[10px] font-bold text-left transition-all ${
                                                voto === 1 ? "bg-emerald-500 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                                              }`}
                                            >
                                              {voto ? "72% · Nunca pensei nisso 🤔" : "Nunca pensei nisso 🤔"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEnqueteVotos((prev) => ({ ...prev, [votoKey]: 2 }))}
                                              className={`w-full rounded-lg py-1.5 px-2 text-[10px] font-bold text-left transition-all ${
                                                voto === 2 ? "bg-emerald-500 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                                              }`}
                                            >
                                              {voto ? "28% · Sim, sei como funciona 💡" : "Sim, sei como funciona 💡"}
                                            </button>
                                          </div>
                                        )}

                                        {st.tipo_adesivo === "dm" && (
                                          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-2.5 text-center space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-300 block">
                                              💬 Adesivo de Direct
                                            </span>
                                            <span className="text-xs font-extrabold text-white block">
                                              Envie "QUERO" aqui!
                                            </span>
                                          </div>
                                        )}

                                        {st.tipo_adesivo === "destaque" && (
                                          <div className="rounded-xl border border-white/20 bg-black/40 p-2 text-center">
                                            <span className="text-[10px] text-emerald-300 font-semibold">
                                              ✨ {st.interacao}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Rodapé do Story */}
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(`${st.titulo}\nTexto: ${st.texto}\nAdesivo: ${st.interacao}`);
                                            alert(`Story ${st.numero} copiado!`);
                                          }}
                                          className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white py-1.5 text-[10px] font-semibold transition-all"
                                        >
                                          <Copy className="h-3 w-3" />
                                          <span>Copiar Este Story</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ABA 2: DIÁLOGO REAL DA EQUIPE DE AGENTES */}
                        {abaAtual === "dialogo" && (
                          <div className="space-y-3 rounded-2xl border border-border/50 bg-background/50 p-4">
                            <div className="flex items-center justify-between border-b border-border/30 pb-2">
                              <span className="text-xs font-bold text-foreground">
                                🎙️ Esteira de Produção e Handoffs entre Especialistas
                              </span>
                              <span className="text-[10px] text-muted-foreground">Ordem sequencial executada</span>
                            </div>

                            <div className="space-y-3">
                              {c.dialogo_equipe.map((dlg, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card/70 hover:border-primary/30 transition-all">
                                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-base shadow-xs">
                                    {dlg.avatar_emoji}
                                  </div>
                                  <div className="flex-1 space-y-1 text-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <strong className="text-foreground">{dlg.agente}</strong>
                                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">({dlg.agente_id})</span>
                                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                          {dlg.papel}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground font-mono">{dlg.horario}</span>
                                    </div>
                                    <p className="text-foreground/90 leading-relaxed font-normal">
                                      "{dlg.fala}"
                                    </p>
                                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Ação: {dlg.acao}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ABA 3: RELATÓRIO EXECUTIVO (DOSSIÊ) */}
                        {abaAtual === "dossie" && (
                          <div className="rounded-2xl border border-border/50 bg-background/60 p-4 space-y-3 text-xs">
                            <div className="flex items-center justify-between border-b border-border/30 pb-2">
                              <span className="font-bold text-foreground">
                                📊 Resumo Executivo da Campanha para Diretoria
                              </span>
                              <button
                                type="button"
                                onClick={() => setDossieModal({ tema: c.tema, empresa: c.empresa, dossie: c.dossie_executivo })}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Visualizar Completo para Imprimir</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              <div className="p-3 rounded-xl border border-border/40 bg-card space-y-1">
                                <span className="font-bold text-muted-foreground block text-[10px] uppercase">Objetivo Estratégico</span>
                                <p className="text-foreground leading-relaxed">{c.dossie_executivo.objetivo_estrategico}</p>
                              </div>
                              <div className="p-3 rounded-xl border border-border/40 bg-card space-y-1">
                                <span className="font-bold text-muted-foreground block text-[10px] uppercase">Público-Alvo & Persona</span>
                                <p className="text-foreground leading-relaxed">{c.dossie_executivo.publico_alvo}</p>
                              </div>
                              <div className="p-3 rounded-xl border border-border/40 bg-card space-y-1">
                                <span className="font-bold text-muted-foreground block text-[10px] uppercase">Canais de Distribuição</span>
                                <p className="text-foreground leading-relaxed">{c.dossie_executivo.canais_distribuicao}</p>
                              </div>
                              <div className="p-3 rounded-xl border border-border/40 bg-card space-y-1">
                                <span className="font-bold text-muted-foreground block text-[10px] uppercase">Métricas de Sucesso Esperadas</span>
                                <p className="text-foreground leading-relaxed">{c.dossie_executivo.metricas_sucesso}</p>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                              <span className="font-bold text-[10px] uppercase block">Parecer de Controle de Qualidade (QA Bruno AGT-13)</span>
                              <p className="mt-0.5">{c.dossie_executivo.parecer_qualidade}</p>
                            </div>
                          </div>
                        )}

                        {/* RODAPÉ DO CARD COM DIRETRIZES */}
                        <div className="border-t border-border/30 pt-3 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Disponível para cópia imediata no Instagram e Facebook
                          </span>
                          <span className="font-semibold text-foreground">
                            {c.direcao_arte}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Comprovante Financeiro Executivo (quando há lançamento ou despesa) */}
                  {msg.plano?.comprovante_financeiro && (() => {
                    const comp = msg.plano.comprovante_financeiro;
                    const valorFmt = `R$ ${comp.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                    return (
                      <div className="rounded-3xl border border-primary/40 bg-card/95 p-4 md:p-5 space-y-3.5 shadow-xl backdrop-blur-xl">
                        {/* Cabeçalho do Comprovante */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-xs">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2">
                                <span>Comprovante de Lançamento Financeiro</span>
                                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                  {comp.finance_id}
                                </span>
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Empresa: <strong className="text-foreground">{comp.empresa_nome}</strong> · Conciliado por {comp.conciliado_por}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ CONCILIADO NO CAIXA
                          </span>
                        </div>

                        {/* Grid com Dados da Transação */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 rounded-2xl border border-border/40 bg-background/60">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Fluxo</span>
                            <span className="text-xs font-bold text-red-500 flex items-center gap-1 mt-0.5">
                              <ArrowRight className="h-3 w-3 rotate-45" /> {comp.fluxo}
                            </span>
                          </div>
                          <div className="p-3 rounded-2xl border border-border/40 bg-background/60">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Valor Liquidado</span>
                            <span className="text-sm font-extrabold text-foreground mt-0.5">{valorFmt}</span>
                          </div>
                          <div className="p-3 rounded-2xl border border-border/40 bg-background/60">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Conta de Débito</span>
                            <span className="font-mono text-xs font-bold text-primary mt-0.5 block">{comp.conta}</span>
                          </div>
                          <div className="p-3 rounded-2xl border border-border/40 bg-background/60">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Data</span>
                            <span className="text-xs font-medium text-foreground mt-0.5 block">{comp.data}</span>
                          </div>
                        </div>

                        {/* Descrição e Centro de Custo */}
                        <div className="p-3 rounded-2xl border border-border/40 bg-background/50 text-xs space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Descrição do Lançamento:</span>
                          <p className="text-foreground font-medium">{comp.descricao}</p>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30 text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Registrado na tabela <code className="font-mono text-foreground font-semibold">financeiro</code> e auditado
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              to="/financeiro"
                              className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-all"
                            >
                              <span>Ver no Fluxo de Caixa</span>
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                            <Link
                              to="/modulo/financeiro"
                              className="inline-flex items-center gap-1 rounded-xl bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-xs"
                            >
                              <Database className="h-3 w-3" />
                              <span>Módulo Financeiro</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detalhes Estruturados do Plano Executivo da Helena */}
                  {msg.plano && (
                    <div className="rounded-2xl border border-border/50 bg-background/80 p-3.5 space-y-2 text-xs shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/30 pb-2">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          Plano de Ação da Helena
                        </span>
                        <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                          {msg.plano.responsavel}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="font-semibold text-muted-foreground">Decisão: </span>
                          <span className="font-medium text-foreground">{msg.plano.decisao}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-muted-foreground">Próximo passo: </span>
                          <span className="text-foreground">{msg.plano.proxima}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 italic">
                          Motivo: {msg.plano.evidencia}
                        </div>
                      </div>

                      {/* Tabelas e IDs Gravados com Links Rápidos */}
                      {msg.gravou && msg.gravou.length > 0 && (
                        <div className="mt-2.5 border-t border-border/30 pt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Salvo no Sistema:
                          </span>
                          {msg.gravou.map((item, idx) => {
                            const [tab, id] = item.split(" ");
                            return (
                              <Link
                                key={idx}
                                to={`/modulo/${tab}`}
                                className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Database className="h-3 w-3" />
                                <span>{item}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.remetente === "fundador" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-card border border-border/60 text-foreground shadow-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {enviando && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground animate-pulse">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4 animate-spin" />
                </div>
                <span>Helena está analisando e organizando as informações…</span>
              </div>
            )}
          </div>

          {/* Atalhos Rápidos de Comando */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-border/30 bg-muted/20 px-4 py-2 scrollbar-hide">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground whitespace-nowrap">
              Atalhos:
            </span>
            <button
              type="button"
              onClick={() => setTexto("Gastei 100 reais")}
              className="whitespace-nowrap rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
            >
              💳 Gastei 100 reais
            </button>
            <button
              type="button"
              onClick={() => setTexto("Quero fazer uma publicacao hoje sobre OPORTUNIDADE DE RENDA EXTRA, eles criam o story 100% e o post")}
              className="whitespace-nowrap rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
            >
              📢 Post + Stories Renda Extra
            </button>
            {atalhosComando.map((at, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTexto(at.comando)}
                className="whitespace-nowrap rounded-lg border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
              >
                {at.label}
              </button>
            ))}
          </div>

          {/* Input de Envio Executivo com Microfone */}
          <form onSubmit={onSubmit} className="p-3 bg-card border-t border-border/40">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Fale com a Helena (ex: gastei 100 reais, ou quero publicação sobre renda extra)…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={enviando}
                className="w-full rounded-2xl border border-border/60 bg-background/90 py-3.5 pl-4 pr-32 text-xs md:text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none shadow-inner"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  title="Falar por voz"
                  onClick={() => {
                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (!SpeechRecognition) {
                      alert("Reconhecimento de voz não suportado neste navegador. Digite sua mensagem normalmente.");
                      return;
                    }
                    const recognition = new SpeechRecognition();
                    recognition.lang = "pt-BR";
                    recognition.interimResults = false;
                    recognition.onresult = (ev: any) => {
                      const transcript = ev.results[0][0].transcript;
                      setTexto(transcript);
                    };
                    recognition.start();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={enviando || !texto.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  <span>Enviar</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Coluna da Direita: Memória Mestre Recente */}
        <div className="flex flex-col rounded-3xl border border-border/50 bg-card/60 p-5 shadow-sm backdrop-blur-xl h-[650px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Memória Mestre Recente
              </h3>
            </div>
            <Link to="/modulo/memoria_mestre" className="text-[11px] text-primary hover:underline">
              Ver Todas
            </Link>
          </div>

          <div className="flex-1 mt-3 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {historico.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border/40 bg-background/50 p-3 text-xs space-y-1.5 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{item.id}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    {item.business_id_area || "GRUPO"}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground text-xs leading-snug">
                  {item.assunto}
                </h4>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.registro}
                </p>
                {item.proxima_acao && (
                  <p className="pt-1 text-[10px] text-primary/80 flex items-center gap-1 truncate">
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span>{item.proxima_acao}</span>
                  </p>
                )}
              </div>
            ))}

            {historico.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Ainda não há conversas gravadas nesta empresa.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DO DOSSIÊ EXECUTIVO DA CAMPANHA (Para Apresentação Formal ou Impressão PDF) */}
      {dossieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-border/70 bg-card text-card-foreground shadow-2xl overflow-hidden">
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Dossiê Executivo de Campanha
                    </h3>
                    <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary">
                      DOCUMENTO OFICIAL
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dossieModal.tema} · Empresa: <strong className="text-foreground">{dossieModal.empresa}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDossieModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conteúdo Imprimível do Relatório */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* Metadados Executivos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-border/50 bg-background/60">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Data de Emissão</span>
                  <span className="font-medium text-foreground">{new Date().toLocaleDateString("pt-BR")}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Coordenação Responsável</span>
                  <span className="font-medium text-foreground">Helena (AGT-01) & Marina (AGT-04)</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Status de Aprovação</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">APROVADO PARA MERCADO</span>
                </div>
              </div>

              {/* Blocos de Conteúdo do Dossiê */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-border/40 bg-background/40 space-y-1.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    1. Objetivo Estratégico & Justificativa de Negócio
                  </h5>
                  <p className="text-foreground leading-relaxed text-xs md:text-sm">
                    {dossieModal.dossie.objetivo_estrategico}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border/40 bg-background/40 space-y-1.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    2. Público-Alvo, Personas & Posicionamento
                  </h5>
                  <p className="text-foreground leading-relaxed text-xs md:text-sm">
                    {dossieModal.dossie.publico_alvo}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border/40 bg-background/40 space-y-1.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    3. Canais de Distribuição & Frequência Recomendada
                  </h5>
                  <p className="text-foreground leading-relaxed text-xs md:text-sm">
                    {dossieModal.dossie.canais_distribuicao}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border/40 bg-background/40 space-y-1.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    4. Métricas de Sucesso Esperadas (KPIs)
                  </h5>
                  <p className="text-foreground leading-relaxed text-xs md:text-sm">
                    {dossieModal.dossie.metricas_sucesso}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 space-y-1.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    5. Parecer de Controle de Qualidade & Compliance (QA Bruno AGT-13)
                  </h5>
                  <p className="leading-relaxed text-xs md:text-sm">
                    {dossieModal.dossie.parecer_qualidade}
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-6 py-3">
              <span className="text-xs text-muted-foreground">
                Documento oficial gerado pela inteligência de agentes da Helena.
              </span>
              <button
                type="button"
                onClick={() => setDossieModal(null)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-sm"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
