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
} from "lucide-react";
import { falarComHelena } from "@/lib/helena-exec";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";

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
  plano?: {
    conclusao: string;
    evidencia: string;
    decisao: string;
    responsavel: string;
    proxima: string;
  };
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

          {/* Input de Envio Executivo */}
          <form onSubmit={onSubmit} className="p-3 bg-card border-t border-border/40">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Fale com a Helena (ex: recebi R$ 5.000 da iGreen na conta ACC-IG)…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={enviando}
                className="w-full rounded-2xl border border-border/60 bg-background/90 py-3.5 pl-4 pr-24 text-xs md:text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none shadow-inner"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
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
    </div>
  );
}
