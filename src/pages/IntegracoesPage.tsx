import React, { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  fetchIntegrationsStatus,
  fetchEvolutionStatus,
  connectEvolutionSession,
  pairEvolutionSession,
  disconnectEvolutionSession,
  sendEvolutionTestMessage,
  fetchMeowcallerStatus,
  connectMeowcallerSession,
  pairMeowcallerPhone,
  disconnectMeowcallerSession,
  makeMeowcallerCall,
  hangupMeowcallerCall,
  fetchElevenLabsVoices,
  testElevenLabsVoice,
  testLayaClassify,
  testLayaScore,
  testLayaRoute,
  fetchIntegrationEvents,
  fetchCallSessions,
  fetchVoiceProfiles,
  saveVoiceProfile,
  AggregatedHealth,
  ElevenLabsVoice,
  LayaClassifyResponse,
} from "@/lib/integrations-client";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveConfirmDialog } from "@/components/executive/ExecutiveConfirmDialog";
import {
  Layers,
  MessageSquare,
  PhoneCall,
  Mic,
  GitFork,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  Send,
  Play,
  RotateCw,
  PhoneForwarded,
  ShieldAlert,
  Server,
  Volume2,
  ExternalLink,
  Info,
} from "lucide-react";

type TabId = "overview" | "whatsapp" | "calls" | "voices" | "routing" | "events";

export default function IntegracoesPage() {
  const { isFounder } = useAuth();
  const { currentBusinessId } = useBusiness();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status Geral
  const [health, setHealth] = useState<AggregatedHealth | null>(null);

  // Evolution
  const [evolutionStatus, setEvolutionStatus] = useState<any>(null);
  const [evolutionQr, setEvolutionQr] = useState<string | null>(null);
  const [evolutionPairingCode, setEvolutionPairingCode] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Olá! Teste de comunicação oficial do Sistema Helena.");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [evoFeedback, setEvoFeedback] = useState<string | null>(null);

  // Meowcaller
  const [meowcallerStatus, setMeowcallerStatus] = useState<any>(null);
  const [meowcallerQr, setMeowcallerQr] = useState<string | null>(null);
  const [meowcallerFeedback, setMeowcallerFeedback] = useState<string | null>(null);
  const [meowPairPhone, setMeowPairPhone] = useState("11971254913");
  const [meowPairCode, setMeowPairCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingMode, setPairingMode] = useState<"phone" | "qrcode">("phone");
  const [callPhone, setCallPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);

  // ElevenLabs
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [audioSampleUrl, setAudioSampleUrl] = useState<string | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([]);

  // Laya
  const [layaMessage, setLayaMessage] = useState("Preciso de ajuda urgente com a fatura da iGreen!");
  const [layaBusinessId, setLayaBusinessId] = useState(currentBusinessId || "BIZ-001");
  const [layaChannel, setLayaChannel] = useState("whatsapp");
  const [layaResult, setLayaResult] = useState<LayaClassifyResponse | null>(null);
  const [layaLoading, setLayaLoading] = useState(false);
  const [layaError, setLayaError] = useState<string | null>(null);

  // Eventos
  const [events, setEvents] = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState("ALL");

  // Diálogos de confirmação
  const [confirmDisconnectEvo, setConfirmDisconnectEvo] = useState(false);
  const [confirmDisconnectMeow, setConfirmDisconnectMeow] = useState(false);

  // Carrega status agregado
  const loadAll = async () => {
    try {
      setRefreshing(true);
      const [h, ev, mc, vc, evts, calls] = await Promise.all([
        fetchIntegrationsStatus().catch(() => null),
        fetchEvolutionStatus().catch(() => null),
        fetchMeowcallerStatus().catch(() => null),
        fetchVoiceProfiles().catch(() => []),
        fetchIntegrationEvents().catch(() => []),
        fetchCallSessions().catch(() => []),
      ]);

      if (h) {
        setHealth(h);
        if (h.meowcaller?.qrcode) {
          setMeowcallerQr(h.meowcaller.qrcode);
        }
      }
      if (ev) setEvolutionStatus(ev.status);
      if (mc) {
        setMeowcallerStatus(mc.session);
        if (mc.session?.qrcode) {
          setMeowcallerQr(mc.session.qrcode);
        }
      }
      // Se a engine Meowcaller requer pareamento e o QR Code ainda não está em tela, requisita automaticamente
      const currentQr = mc?.session?.qrcode || h?.meowcaller?.qrcode;
      const isPairing =
        h?.meowcaller?.whatsapp_status === "PAIRING_REQUIRED" ||
        mc?.session?.status === "PAIRING_REQUIRED" ||
        mc?.session?.whatsapp_status === "PAIRING_REQUIRED";
      if (!currentQr && isPairing) {
        connectMeowcallerSession().then((res) => {
          const qr = res?.result?.qrcode || res?.session?.qrcode || (res as any)?.qrcode;
          if (qr) setMeowcallerQr(qr);
        }).catch(() => {});
      }
      setVoiceProfiles(vc);
      setEvents(evts);
      setCallHistory(calls);
    } catch (err: any) {
      console.error("Erro ao carregar integrações:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Polling automático para atualizar o status e QR code em tempo real
  useEffect(() => {
    const isMeowPairing =
      health?.meowcaller?.whatsapp_status === "PAIRING_REQUIRED" ||
      meowcallerStatus?.whatsapp_status === "PAIRING_REQUIRED" ||
      meowcallerStatus?.status === "PAIRING_REQUIRED";

    if (!isMeowPairing) return;

    const interval = setInterval(() => {
      fetchMeowcallerStatus().then((mc) => {
        if (mc?.session) {
          setMeowcallerStatus(mc.session);
          if (mc.session.qrcode) {
            setMeowcallerQr(mc.session.qrcode);
          }
          if (mc.session.status === "CONNECTED" || mc.session.whatsapp_status === "CONNECTED") {
            loadAll();
          }
        }
      }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [health?.meowcaller?.whatsapp_status, meowcallerStatus?.whatsapp_status, meowcallerStatus?.status]);

  // Carrega vozes ElevenLabs sob demanda
  useEffect(() => {
    if (activeTab === "voices" && voices.length === 0) {
      setLoadingVoices(true);
      fetchElevenLabsVoices()
        .then((res) => {
          if (res.data?.voices) {
            setVoices(res.data.voices);
            if (res.data.voices.length > 0 && !selectedVoiceId) {
              setSelectedVoiceId(res.data.default_voice_id || res.data.voices[0].voice_id);
            }
          }
        })
        .catch((err) => console.error("Erro vozes ElevenLabs:", err))
        .finally(() => setLoadingVoices(false));
    }
  }, [activeTab]);

  // Ações Evolution
  const handleConnectEvolution = async () => {
    try {
      setEvoFeedback("Iniciando conexão Evolution...");
      const res = await connectEvolutionSession();
      if (res.result?.qrcode) {
        setEvolutionQr(res.result.qrcode);
      }
      if (res.result?.pairingCode) {
        setEvolutionPairingCode(res.result.pairingCode);
      }
      setEvoFeedback("Sessão iniciada. Escaneie o QR Code no WhatsApp.");
      loadAll();
    } catch (err: any) {
      setEvoFeedback(`Erro: ${err.message}`);
    }
  };

  const handlePairEvolution = async () => {
    if (!testPhone) return;
    try {
      setEvoFeedback("Solicitando código de pareamento...");
      const res = await pairEvolutionSession(testPhone);
      setEvolutionPairingCode(res.result?.pairingCode || res.result?.code || "Código solicitado");
      setEvoFeedback("Código de pareamento gerado com sucesso.");
    } catch (err: any) {
      setEvoFeedback(`Erro no pareamento: ${err.message}`);
    }
  };

  const handleDisconnectEvolution = async () => {
    try {
      await disconnectEvolutionSession();
      setEvolutionQr(null);
      setEvolutionPairingCode(null);
      setEvoFeedback("Instância desconectada.");
      loadAll();
    } catch (err: any) {
      setEvoFeedback(`Erro ao desconectar: ${err.message}`);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || !testMessage) return;
    try {
      setSendingMsg(true);
      setEvoFeedback(null);
      const res = await sendEvolutionTestMessage(testPhone, testMessage);
      setEvoFeedback(`Mensagem enviada com sucesso! ID: ${res.result?.messageId || "OK"}`);
      loadAll();
    } catch (err: any) {
      setEvoFeedback(`Falha no envio: ${err.message}`);
    } finally {
      setSendingMsg(false);
    }
  };

  // Ações Meowcaller
  const handleConnectMeowcaller = async () => {
    try {
      setMeowcallerFeedback("Consultando sessão VoIP Meowcaller...");
      const res = await connectMeowcallerSession();
      const qr = res?.result?.qrcode || res?.session?.qrcode || (res as any)?.qrcode;
      if (qr) {
        setMeowcallerQr(qr);
        setMeowcallerFeedback("QR Code de chamadas gerado com sucesso. Aponte a câmera do WhatsApp para conectar.");
      } else {
        const st = res?.result?.status || res?.session?.status || (typeof res === "object" ? (res as any).status : "DISCONNECTED");
        setMeowcallerFeedback(
          st === "CONNECTED"
            ? "Canal Meowcaller conectado e pronto para ligações."
            : `Canal VoIP Meowcaller em prontidão (${st}). Aguardando ativação de chip de voz dedicado.`
        );
      }
      await loadAll();
    } catch (err: any) {
      setMeowcallerFeedback(`Aviso Meowcaller: ${err.message}`);
    }
  };

  const handlePairMeowPhone = async () => {
    if (!meowPairPhone) return;
    try {
      setPairingLoading(true);
      setMeowcallerFeedback("Gerando código de 8 dígitos para o WhatsApp...");
      const res = await pairMeowcallerPhone(meowPairPhone);
      const code = res?.result?.pairing_code || (res as any)?.pairing_code;
      if (code) {
        setMeowPairCode(code);
        setMeowcallerFeedback(`Código gerado: ${code}. Digite no seu celular.`);
      }
    } catch (err: any) {
      setMeowcallerFeedback(`Erro ao gerar código por telefone: ${err.message}`);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDisconnectMeowcaller = async () => {
    try {
      setMeowcallerFeedback("Desconectando sessão VoIP...");
      await disconnectMeowcallerSession();
      setMeowcallerQr(null);
      setMeowcallerFeedback("Sessão Meowcaller desconectada.");
      loadAll();
    } catch (err: any) {
      setMeowcallerFeedback(`Falha ao desconectar: ${err.message}`);
    }
  };

  const handleOriginateCall = async () => {
    if (!callPhone) return;
    let clean = callPhone.replace(/\D/g, "");
    if ((clean.length === 10 || clean.length === 11) && !clean.startsWith("55")) {
      clean = `55${clean}`;
    }

    try {
      setCalling(true);
      setMeowcallerFeedback(`Originando chamada para +${clean}...`);
      const res = await makeMeowcallerCall(clean, layaBusinessId, selectedVoiceId);
      setActiveCallId(res.call_id);
      setMeowcallerFeedback(`Chamada iniciada com sucesso (ID: ${res.call_id}).`);
      loadAll();
    } catch (err: any) {
      setMeowcallerFeedback(`Aviso Meowcaller: ${err.message}`);
    } finally {
      setCalling(false);
    }
  };

  const handleHangupCall = async () => {
    if (!activeCallId) return;
    try {
      await hangupMeowcallerCall(activeCallId);
      setActiveCallId(null);
      setMeowcallerFeedback("Chamada encerrada.");
      loadAll();
    } catch (err: any) {
      setMeowcallerFeedback(`Falha ao encerrar: ${err.message}`);
    }
  };

  // Ações ElevenLabs
  const handleTestVoiceSample = async () => {
    if (!selectedVoiceId) return;
    try {
      setGeneratingSample(true);
      setAudioSampleUrl(null);
      const res = await testElevenLabsVoice(selectedVoiceId, "Olá! Esta é uma demonstração da voz executiva do Sistema Helena.");
      if (res.sample?.audio_base64) {
        setAudioSampleUrl(res.sample.audio_base64);
      }
    } catch (err: any) {
      alert(`Erro ao gerar prévia de voz: ${err.message}`);
    } finally {
      setGeneratingSample(false);
    }
  };

  const handleSaveVoiceProfile = async () => {
    if (!selectedVoiceId) return;
    const v = voices.find((x) => x.voice_id === selectedVoiceId);
    try {
      await saveVoiceProfile({
        profile_id: `VP-${selectedVoiceId.slice(0, 8).toUpperCase()}`,
        nome: v?.name || "Voz Helena",
        business_id: layaBusinessId,
        voice_id: selectedVoiceId,
        is_default: true,
      });
      alert("Perfil de voz salvo com sucesso no Supabase!");
      loadAll();
    } catch (err: any) {
      alert(`Erro ao salvar perfil: ${err.message}`);
    }
  };

  // Ações Laya
  const handleLayaClassify = async () => {
    if (!layaMessage) return;
    try {
      setLayaLoading(true);
      setLayaError(null);
      const res = await testLayaClassify({
        message: layaMessage,
        business_id: layaBusinessId,
        channel: layaChannel,
      });
      setLayaResult(res.result);
    } catch (err: any) {
      setLayaError(err.message || "Erro na comunicação com a Laya");
    } finally {
      setLayaLoading(false);
    }
  };

  if (loading) {
    return <ExecutiveLoadingState message="Carregando Central de Canais e Integrações..." />;
  }

  const isMeowConnected =
    (typeof meowcallerStatus === "string" ? meowcallerStatus : meowcallerStatus?.whatsapp_status || meowcallerStatus?.status) === "CONNECTED" ||
    health?.meowcaller?.whatsapp_status === "CONNECTED";

  const isEvolutionConnected =
    (typeof evolutionStatus === "string" ? evolutionStatus : evolutionStatus?.status) === "OPEN" ||
    Boolean(health?.evolution?.connected);

  const activeMeowQr =
    meowcallerQr ||
    (typeof meowcallerStatus === "object" ? meowcallerStatus?.qrcode : null) ||
    health?.meowcaller?.qrcode ||
    null;

  const renderMeowcallerPairingWidget = (isCompact = false) => (
    <div className={`space-y-4 w-full ${isCompact ? "max-w-md" : "max-w-xl"}`}>
      {/* Seletor de Modo: Código de Telefone vs QR Code */}
      <div className="flex rounded-xl bg-muted/60 p-1 gap-1 text-xs font-semibold border border-border">
        <button
          type="button"
          onClick={() => setPairingMode("phone")}
          className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            pairingMode === "phone"
              ? "bg-[#007A3D] text-white shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          <span>📲 Código no WhatsApp</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-normal">Recomendado</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setPairingMode("qrcode");
            handleConnectMeowcaller();
          }}
          className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            pairingMode === "qrcode"
              ? "bg-[#007A3D] text-white shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>Escanear QR Code</span>
        </button>
      </div>

      {pairingMode === "phone" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-3">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">
              Conectar sem Câmera (Código de 8 Dígitos)
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Insira o número do chip de ligações para receber o código e digitar no WhatsApp:
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={meowPairPhone}
              onChange={(e) => setMeowPairPhone(e.target.value)}
              placeholder="DDD + Número (ex: 11971254913)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
            />
            <button
              type="button"
              onClick={handlePairMeowPhone}
              disabled={pairingLoading || !meowPairPhone}
              className="rounded-lg bg-[#007A3D] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007A3D]/90 disabled:opacity-50 whitespace-nowrap"
            >
              {pairingLoading ? "Gerando..." : "Gerar Código"}
            </button>
          </div>

          {meowPairCode && (
            <div className="rounded-xl border-2 border-emerald-500 bg-card p-4 text-center space-y-2.5 shadow-sm">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Seu código de pareamento:
              </span>
              <div className="text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-widest py-1 select-all">
                {meowPairCode}
              </div>
              <div className="text-[11px] text-muted-foreground text-left space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border">
                <p><strong>1.</strong> No celular com chip <strong>{meowPairPhone}</strong>, abra o WhatsApp.</p>
                <p><strong>2.</strong> Toque em <strong>Aparelhos Conectados &gt; Conectar um Aparelho</strong>.</p>
                <p><strong>3.</strong> Na tela onde a câmera abre, toque na opção <strong>&ldquo;Conectar com número de telefone&rdquo;</strong> (fica na parte inferior).</p>
                <p><strong>4.</strong> Digite o código <strong>{meowPairCode}</strong> acima e confirme!</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-3 flex flex-col items-center">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">
              Escanear QR Code com a Câmera do WhatsApp
            </h4>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              O QR Code do WhatsApp expira em 20 segundos por segurança. Aponte a câmera imediatamente após gerar:
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-border shadow-md inline-block">
            {activeMeowQr ? (
              <img
                src={
                  activeMeowQr.startsWith("data:")
                    ? activeMeowQr
                    : `data:image/png;base64,${activeMeowQr}`
                }
                alt="QR Code WhatsApp Ligações"
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex flex-col items-center justify-center text-center p-4 space-y-2">
                <QrCode className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">Carregando QR Code...</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleConnectMeowcaller}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#007A3D] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007A3D]/90"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>🔄 Gerar QR Code Fresco Agora</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500">
            WhatsApp &gt; Aparelhos Conectados &gt; Conectar Dispositivo
          </span>
        </div>
      )}
    </div>
  );

  const tabs: {
    id: TabId;
    label: string;
    icon: any;
    badge?: { text: string; variant: "success" | "warning" | "default" };
  }[] = [
    { id: "overview", label: "Visão Geral", icon: Layers },
    {
      id: "whatsapp",
      label: "WhatsApp Mensagens (Evolution)",
      icon: MessageSquare,
      badge: {
        text: isEvolutionConnected ? "Conectado" : "Desconectado",
        variant: isEvolutionConnected ? "success" : "warning",
      },
    },
    {
      id: "calls",
      label: "Ligações VoIP (Meowcaller)",
      icon: PhoneCall,
      badge: {
        text: isMeowConnected ? "Conectado" : "Escanear QR",
        variant: isMeowConnected ? "success" : "warning",
      },
    },
    { id: "voices", label: "Vozes (ElevenLabs)", icon: Mic },
    { id: "routing", label: "Roteamento (Laya)", icon: GitFork },
    { id: "events", label: "Eventos & Testes", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header Executivo */}
      <ExecutivePageHeader
        title="Central de Canais, Voz e Roteamento"
        subtitle="Infraestrutura operacional de mensageria WhatsApp, chamadas VoIP, síntese de voz e inteligência de Sistema 1"
        action={
          <button
            type="button"
            onClick={loadAll}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Atualizar Status</span>
          </button>
        }
      />

      {/* Navegação por Abas Executivas com Badges */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-[#007A3D] text-[#007A3D] font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    tab.badge.variant === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse"
                  }`}
                >
                  {tab.badge.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================================
          ABA 1: VISÃO GERAL
          ====================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* BANNER / HERO CARD DE PAREAMENTO DO QR CODE (SE NÃO CONECTADO) */}
          {!isMeowConnected && (
            <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="space-y-3 text-center lg:text-left flex-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Pareamento Pendente — Linha de Voz WhatsApp (VoIP)</span>
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Habilite as Ligações da Helena (Discador & Atendimento por Voz)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Conecte seu WhatsApp de ligações diretamente usando o <strong>Código de 8 Dígitos</strong> (sem precisar de câmera) ou escaneando o <strong>QR Code</strong> atualizado em tempo real. Esta conexão é exclusiva para voz e não interfere no WhatsApp de mensagens.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1 justify-center lg:justify-start">
                  <button
                    type="button"
                    onClick={() => setActiveTab("calls")}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <PhoneCall className="h-3.5 w-3.5 text-sky-600" />
                    <span>Abrir Discador de Chamadas</span>
                  </button>
                </div>
              </div>

              {/* Widget de Pareamento Completo */}
              <div className="shrink-0 w-full lg:w-[420px]">
                {renderMeowcallerPairingWidget(true)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* HELENA GATEWAY */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Server className="h-5 w-5 text-[#007A3D]" />
                  <span className="text-sm font-semibold text-foreground">Helena Gateway</span>
                </div>
                <ExecutiveBadge variant={health?.gateway?.healthy ? "success" : "danger"}>
                  {health?.gateway?.healthy ? "OPERACIONAL" : "OFFLINE"}
                </ExecutiveBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                Backend de orquestração MCP, validação de tokens JWT Supabase e controle de fila outbox.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-mono text-foreground">{health?.gateway?.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versão:</span>
                  <span className="font-mono text-foreground">{health?.gateway?.version}</span>
                </div>
              </div>
            </div>

            {/* EVOLUTION API */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-semibold text-foreground">Evolution API</span>
                  </div>
                  <ExecutiveBadge variant={isEvolutionConnected ? "success" : "warning"}>
                    {isEvolutionConnected ? "CONECTADA" : health?.evolution?.status || "CONFIGURADA"}
                  </ExecutiveBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sessão dedicada para WhatsApp de texto, URA automática (1, 2, 3...) e atendimento inbound.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instância:</span>
                    <span className="font-mono text-foreground">{health?.evolution?.instance || "helena_mensagens"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conectado:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isEvolutionConnected ? "SIM (Online)" : "NÃO"}</span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("whatsapp")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Ver Auto-Atendimento & Mensagens</span>
                </button>
              </div>
            </div>

            {/* MEOWCALLER */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PhoneCall className="h-5 w-5 text-sky-600" />
                    <span className="text-sm font-semibold text-foreground">Meowcaller Service</span>
                  </div>
                  <ExecutiveBadge variant={isMeowConnected ? "success" : "warning"}>
                    {isMeowConnected ? "CONECTADO" : "QR CODE PENDENTE"}
                  </ExecutiveBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sessão exclusiva para transporte de chamadas de voz WhatsApp e ponte bidirecional com a IA.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chamadas Ativas:</span>
                    <span className="font-mono text-foreground">{health?.meowcaller?.active_calls ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">JID Conectado:</span>
                    <span className="font-mono text-foreground truncate max-w-[150px]">
                      {health?.meowcaller?.connected_jid || "Aguardando pareamento"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("calls")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#007A3D] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#007A3D]/90"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{isMeowConnected ? "Abrir Discador VoIP" : "Escanear QR Code de Voz"}</span>
                </button>
              </div>
            </div>

            {/* ELEVENLABS */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mic className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-semibold text-foreground">ElevenLabs</span>
                </div>
                <ExecutiveBadge variant={health?.elevenlabs?.reachable ? "success" : "default"}>
                  {health?.elevenlabs?.reachable ? "CONECTADO" : "CONFIGURADA"}
                </ExecutiveBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                Síntese de voz neural multilíngue, agentes conversacionais em tempo real e perfis de personas.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vozes Carregadas:</span>
                  <span className="font-mono text-foreground">{health?.elevenlabs?.voices_count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Autenticação:</span>
                  <span className="text-foreground">Protegida no Backend</span>
                </div>
              </div>
            </div>

            {/* LAYA SERVICE */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <GitFork className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-semibold text-foreground">Laya Service (Sistema 1)</span>
                </div>
                <ExecutiveBadge variant={health?.laya?.healthy ? "success" : "danger"}>
                  {health?.laya?.healthy ? "OPERACIONAL" : "OFFLINE"}
                </ExecutiveBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                Classificação rápida, score de risco/churn, roteamento canônico para 21 agentes e gating executivo.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dispositivo / Motor:</span>
                  <span className="font-mono text-foreground">{health?.laya?.device || "cpu"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thresholds:</span>
                  <span className="text-foreground">
                    Auto: {health?.laya?.auto_threshold ?? 0.9} / Audit: {health?.laya?.audit_threshold ?? 0.7}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          ABA 2: WHATSAPP (EVOLUTION API)
          ====================================================================== */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status e Controles da Sessão */}
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Sessão de Mensagens WhatsApp</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerenciamento da conexão da Evolution API para envio e recebimento de mensagens.
                    </p>
                  </div>
                  <ExecutiveBadge
                    variant={
                      (typeof evolutionStatus === "string" ? evolutionStatus : evolutionStatus?.status) === "OPEN"
                        ? "success"
                        : "default"
                    }
                  >
                    {typeof evolutionStatus === "string"
                      ? evolutionStatus
                      : evolutionStatus?.status || "DISCONNECTED"}
                  </ExecutiveBadge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-lg border border-border/70 p-3 text-xs space-y-1 bg-muted/20">
                    <span className="text-muted-foreground">Instância WhatsApp</span>
                    <p className="font-mono font-medium text-foreground">{evolutionStatus?.instance || "helena_mensagens"}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3 text-xs space-y-1 bg-muted/20">
                    <span className="text-muted-foreground">Auto-Atendimento & Webhook</span>
                    <p className="font-mono font-medium text-emerald-600 dark:text-emerald-400">ATIVO (Menu URA 1, 2, 3 + Laya IA)</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleConnectEvolution}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#007A3D] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#007A3D]/90"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Conectar WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePairEvolution}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <span>Conectar com Código</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectEvo(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-rose-600 shadow-sm transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <span>Desconectar</span>
                  </button>
                </div>

                {evoFeedback && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#007A3D] shrink-0" />
                    <span>{evoFeedback}</span>
                  </div>
                )}
              </div>

              {/* Envio de Mensagem de Teste */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Enviar Mensagem de Teste</h3>
                <p className="text-xs text-muted-foreground">
                  Teste controlado de envio para um número WhatsApp autorizado (formato internacional: 5511999999999).
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Telefone Internacional</label>
                    <input
                      type="text"
                      placeholder="5511999999999"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Mensagem</label>
                    <textarea
                      rows={3}
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={sendingMsg || !testPhone || !testMessage}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#007A3D]/90 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{sendingMsg ? "Enviando..." : "Confirmar e Enviar Mensagem"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Painel de Pareamento / QR Code */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Pareamento de Dispositivo</h3>
              {evolutionQr ? (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-border shadow-sm inline-block">
                    <img
                      src={evolutionQr.startsWith("data:") ? evolutionQr : `data:image/png;base64,${evolutionQr}`}
                      alt="Evolution QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Abra o WhatsApp &gt; Dispositivos conectados &gt; Conectar um dispositivo.
                  </p>
                </div>
              ) : evolutionPairingCode ? (
                <div className="p-4 rounded-xl border border-[#007A3D]/30 bg-[#007A3D]/5 space-y-2">
                  <span className="text-xs text-muted-foreground">Código de Pareamento</span>
                  <div className="text-2xl font-mono font-bold text-[#007A3D] tracking-widest">
                    {evolutionPairingCode}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Insira este código na notificação do WhatsApp.</p>
                </div>
              ) : isEvolutionConnected ? (
                <div className="space-y-4 max-w-md w-full">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>WhatsApp de Mensagens & URA Conectado!</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      A instância <strong className="text-foreground">{evolutionStatus?.instance || "helena_mensagens"}</strong> já está online e respondendo mensagens automaticamente com URA (1, 2, 3...) e IA Laya.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnectEvo(true)}
                      className="text-[10px] text-muted-foreground hover:text-rose-600 underline pt-1 block mx-auto"
                    >
                      Deseja trocar o chip de mensagens? Desconectar sessão
                    </button>
                  </div>

                  {!isMeowConnected && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center space-y-3">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <QrCode className="h-4 w-4" />
                        <span>QR Code Pendente: WhatsApp de Ligações VoIP</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Como você observou, mensagens e ligações são canais separados. O WhatsApp de mensagens já está ativo. Escaneie este QR Code com o WhatsApp do chip de ligações para habilitar chamadas de voz:
                      </p>
                      {activeMeowQr ? (
                        <div className="p-3 bg-white rounded-xl border border-border shadow-sm inline-block mx-auto">
                          <img
                            src={
                              activeMeowQr.startsWith("data:")
                                ? activeMeowQr
                                : `data:image/png;base64,${activeMeowQr}`
                            }
                            alt="QR Code WhatsApp Ligações"
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-48 h-48 flex flex-col items-center justify-center text-center p-4 space-y-2 mx-auto bg-white rounded-xl border border-border">
                          <QrCode className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
                          <span className="text-xs text-muted-foreground font-medium">Carregando QR Code...</span>
                          <button
                            type="button"
                            onClick={handleConnectMeowcaller}
                            className="text-xs text-[#007A3D] underline font-semibold"
                          >
                            Clique para gerar
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-zinc-500">
                        WhatsApp &gt; Dispositivos Conectados &gt; Conectar Dispositivo
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <QrCode className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum QR Code ativo no momento. Clique em &ldquo;Conectar WhatsApp&rdquo; para gerar.
                  </p>
                </div>
              )}

              {/* Guia Didático de Auto-Atendimento */}
              <div className="w-full text-left rounded-lg border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-[#007A3D]" />
                  Como funciona o Auto-Atendimento Helena:
                </span>
                <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                  <li><strong className="text-foreground">Conexão:</strong> Aponte seu WhatsApp para o QR Code acima.</li>
                  <li><strong className="text-foreground">Atendimento 24/7:</strong> Quando o cliente envia mensagem, a Helena atende sozinha.</li>
                  <li><strong className="text-foreground">Menu de Opções (URA):</strong>
                    <div className="ml-4 mt-1 space-y-0.5 font-mono text-[11px] text-foreground">
                      <div>1️⃣ Vendas & Comercial (Victor)</div>
                      <div>2️⃣ Suporte & Acessos (Joana)</div>
                      <div>3️⃣ Financeiro & Boletos (Analista)</div>
                      <div>4️⃣ Diretoria Executiva (Helena)</div>
                    </div>
                  </li>
                  <li><strong className="text-foreground">Inteligência Laya:</strong> O cliente também pode digitar normalmente (&ldquo;quero 2ª via&rdquo;) que a IA entende e encaminha.</li>
                  <li><strong className="text-foreground">Registro:</strong> Tudo é salvo no Supabase e na esteira de atendimento.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          ABA 3: LIGAÇÕES (MEOWCALLER)
          ====================================================================== */}
      {activeTab === "calls" && (
        <div className="space-y-6">
          {/* Alerta de Arquitetura Obrigatória */}
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-foreground">Sessão Exclusiva para Chamadas WhatsApp</span>
              <p className="text-muted-foreground">
                Esta conexão é utilizada exclusivamente para transporte de chamadas via WhatsApp pelo Meowcaller. Não misturar com a sessão de mensagens da Evolution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Controles de Chamada */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Transporte de Voz (Meowcaller)</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Status da sessão VoIP e discador de chamadas ativas.
                    </p>
                  </div>
                  <ExecutiveBadge
                    variant={
                      (typeof meowcallerStatus === "string" ? meowcallerStatus : meowcallerStatus?.whatsapp_status) === "CONNECTED"
                        ? "success"
                        : "default"
                    }
                  >
                    {typeof meowcallerStatus === "string"
                      ? meowcallerStatus
                      : meowcallerStatus?.whatsapp_status || "DISCONNECTED"}
                  </ExecutiveBadge>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleConnectMeowcaller}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#007A3D] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#007A3D]/90"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Conectar WhatsApp de Ligações</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectMeow(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-rose-600 shadow-sm transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <span>Desconectar Sessão</span>
                  </button>
                </div>

                {meowcallerFeedback && (
                  <div className="p-3 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    {meowcallerFeedback}
                  </div>
                )}

                <div className="pt-4 border-t border-border/60 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground">Fazer Ligação de Teste</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Telefone internacional (ex: 5511999999999)"
                      value={callPhone}
                      onChange={(e) => setCallPhone(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                    />
                    <button
                      type="button"
                      onClick={handleOriginateCall}
                      disabled={calling || !callPhone}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50"
                    >
                      <PhoneForwarded className="h-4 w-4" />
                      <span>{calling ? "Disparando..." : "Disparar Ligação"}</span>
                    </button>
                  </div>

                  {activeCallId && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                        <span className="font-medium text-foreground">Chamada em andamento: {activeCallId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleHangupCall}
                        className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500"
                      >
                        Encerrar Chamada
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico Recente de Chamadas */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Histórico de Chamadas Recentes</h3>
                {callHistory.length === 0 ? (
                  <ExecutiveEmptyState title="Nenhuma chamada recente" description="As chamadas originadas ou recebidas serão registradas aqui." />
                ) : (
                  <div className="divide-y divide-border/60 text-xs">
                    {callHistory.map((c) => (
                      <div key={c.call_id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium text-foreground">{c.remote_number}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {c.direction} · {new Date(c.started_at).toLocaleTimeString()} · {c.duration_seconds}s
                          </span>
                        </div>
                        <ExecutiveBadge variant={c.status === "ENDED" ? "default" : "success"}>
                          {c.status}
                        </ExecutiveBadge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* QR Code de Ligações */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Pareamento VoIP de Ligações</h3>
              {isMeowConnected ? (
                <div className="p-6 text-center space-y-3 max-w-xs">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-[#007A3D] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Linha VoIP Conectada!</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      O WhatsApp exclusivo de voz está online e pronto para originar chamadas ativas ou receber ligações.
                    </p>
                    {meowcallerStatus?.connected_jid && (
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        {meowcallerStatus.connected_jid}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full flex justify-center">
                  {renderMeowcallerPairingWidget(false)}
                </div>
              )}

              {/* Guia Didático de Ligações */}
              <div className="w-full text-left rounded-lg border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-[#007A3D]" />
                  Como funcionam as Ligações de Voz Helena:
                </span>
                <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                  <li><strong className="text-foreground">Canal Dedicado:</strong> O Meowcaller estabelece o áudio em tempo real via WhatsApp VoIP.</li>
                  <li><strong className="text-foreground">Voz da Helena:</strong> A fala é gerada com sintetização ElevenLabs ultra-realista.</li>
                  <li><strong className="text-foreground">Discagem Direta:</strong> Digite o DDD + Número (ex: 11971254913) e clique em &ldquo;Disparar Ligação&rdquo;.</li>
                  <li><strong className="text-foreground">Independência:</strong> Não interfere nas mensagens da Evolution API.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          ABA 4: VOZES (ELEVENLABS)
          ====================================================================== */}
      {activeTab === "voices" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Biblioteca de Vozes da Conta</h3>
              <p className="text-xs text-muted-foreground">
                Vozes e agentes conversacionais sincronizados via API oficial da ElevenLabs com chave protegida no servidor.
              </p>
            </div>
            {selectedVoiceId && (
              <button
                type="button"
                onClick={handleSaveVoiceProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-[#007A3D] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007A3D]/90"
              >
                <span>Associar Voz à Empresa</span>
              </button>
            )}
          </div>

          {loadingVoices ? (
            <ExecutiveLoadingState message="Buscando vozes na ElevenLabs..." />
          ) : voices.length === 0 ? (
            <ExecutiveEmptyState
              title="Nenhuma voz encontrada ou chave não configurada"
              description="Configure a variável ELEVENLABS_API_KEY no EasyPanel para sincronizar a biblioteca."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {voices.map((v) => {
                const isSelected = selectedVoiceId === v.voice_id;
                return (
                  <div
                    key={v.voice_id}
                    onClick={() => setSelectedVoiceId(v.voice_id)}
                    className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#007A3D] bg-[#007A3D]/5 shadow-sm"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{v.name}</h4>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {v.voice_id.slice(0, 10)}...
                        </span>
                      </div>
                      <ExecutiveBadge variant="default">{v.category}</ExecutiveBadge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {v.description || "Voz neural multilíngue de alta fidelidade."}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                      {v.preview_url ? (
                        <audio controls src={v.preview_url} className="h-7 w-40" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sem áudio prévio</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoiceId(v.voice_id);
                          handleTestVoiceSample();
                        }}
                        className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                      >
                        {generatingSample && isSelected ? "Gerando..." : "Testar Fala"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Player do teste customizado */}
          {audioSampleUrl && (
            <div className="rounded-xl border border-[#007A3D]/30 bg-[#007A3D]/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-[#007A3D]" />
                <span className="text-xs font-semibold text-foreground">Prévia Gerada com Sucesso</span>
              </div>
              <audio controls autoPlay src={audioSampleUrl} className="h-8" />
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          ABA 5: ROTEAMENTO (LAYA SERVICE)
          ====================================================================== */}
      {activeTab === "routing" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-foreground">Papel Estrito da Laya (Sistema 1)</span>
              <p className="text-muted-foreground">
                A Laya não é funcionária, não fala com clientes e não substitui os 21 especialistas. Ela atua exclusivamente como camada rápida de classificação, score de risco e gating executivo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Teste */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Simulador de Decisão Rápida</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Empresa Alvo</label>
                  <select
                    value={layaBusinessId}
                    onChange={(e) => setLayaBusinessId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                  >
                    <option value="BIZ-001">BIZ-001 · iGreen (Vendas)</option>
                    <option value="BIZ-002">BIZ-002 · Ecossistema de Saúde (Produto)</option>
                    <option value="BIZ-003">BIZ-003 · Humano Digital (Validação)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Canal</label>
                  <select
                    value={layaChannel}
                    onChange={(e) => setLayaChannel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="voip">Chamada de Voz (VoIP)</option>
                    <option value="web">Web Chat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Texto da Mensagem ou Transcrição</label>
                  <textarea
                    rows={4}
                    value={layaMessage}
                    onChange={(e) => setLayaMessage(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleLayaClassify}
                    disabled={layaLoading || !layaMessage}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007A3D]/90 disabled:opacity-50"
                  >
                    <span>{layaLoading ? "Classificando..." : "Testar Classify"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado da Laya */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Diagnóstico Estruturado (6 Camadas)</h3>

              {layaError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Falha na Classificação</span>
                    <p className="text-[11px] opacity-90">{layaError}</p>
                  </div>
                </div>
              )}

              {layaResult ? (
                <div className="space-y-3 text-xs">
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1">
                    <span className="text-[11px] text-muted-foreground font-mono">Trace ID</span>
                    <p className="font-mono text-foreground">{layaResult.trace_id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/80 p-3 bg-muted/10 space-y-1">
                      <span className="text-muted-foreground">Área / Intenção</span>
                      <p className="font-semibold text-foreground">{layaResult.area} · {layaResult.intent}</p>
                    </div>

                    <div className="rounded-lg border border-border/80 p-3 bg-muted/10 space-y-1">
                      <span className="text-muted-foreground">Agente Canônico</span>
                      <p className="font-semibold text-[#007A3D]">
                        {layaResult.suggested_agent_name} ({layaResult.suggested_agent_id})
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border/80 p-2.5 bg-muted/10">
                      <span className="text-[11px] text-muted-foreground">Urgência</span>
                      <p className="text-base font-bold text-foreground mt-0.5">{layaResult.urgency} / 5</p>
                    </div>
                    <div className="rounded-lg border border-border/80 p-2.5 bg-muted/10">
                      <span className="text-[11px] text-muted-foreground">Risco</span>
                      <p className="text-base font-bold text-foreground mt-0.5">{layaResult.risk_score} / 5</p>
                    </div>
                    <div className="rounded-lg border border-border/80 p-2.5 bg-muted/10">
                      <span className="text-[11px] text-muted-foreground">Confiança</span>
                      <p className="text-base font-bold text-emerald-600 mt-0.5">
                        {Math.round(layaResult.confidence * 100)}%
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
                    {layaResult.needs_founder && <ExecutiveBadge variant="danger">Escala para Fundador</ExecutiveBadge>}
                    {layaResult.needs_helena && <ExecutiveBadge variant="warning">Deliberação Helena</ExecutiveBadge>}
                    {layaResult.needs_human && <ExecutiveBadge variant="default">Atendimento Humano</ExecutiveBadge>}
                    {layaResult.commercial_opportunity && <ExecutiveBadge variant="success">Oportunidade Comercial</ExecutiveBadge>}
                    {layaResult.churn_risk && <ExecutiveBadge variant="danger">Risco de Churn</ExecutiveBadge>}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <GitFork className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Envie uma mensagem de teste para inspecionar a classificação e roteamento da Laya.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          ABA 6: EVENTOS & TESTES
          ====================================================================== */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Registro de Eventos Técnicos</h3>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="ALL">Todos os Provedores</option>
              <option value="EVOLUTION">Evolution</option>
              <option value="MEOWCALLER">Meowcaller</option>
              <option value="ELEVENLABS">ElevenLabs</option>
              <option value="LAYA">Laya</option>
            </select>
          </div>

          {events.length === 0 ? (
            <ExecutiveEmptyState title="Nenhum evento registrado" description="Eventos de conexões, chamadas e mensagens aparecerão aqui." />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60 text-xs">
              {events
                .filter((e) => eventFilter === "ALL" || e.provider?.includes(eventFilter))
                .map((e) => (
                  <div key={e.event_id} className="p-3.5 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{e.event_type}</span>
                        <ExecutiveBadge variant="default">{e.provider}</ExecutiveBadge>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(e.created_at).toLocaleString()} · ID: {e.event_id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {JSON.stringify(e.payload || {}).slice(0, 50)}...
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmação de Desconexão Evolution */}
      <ExecutiveConfirmDialog
        open={confirmDisconnectEvo}
        onOpenChange={setConfirmDisconnectEvo}
        title="Desconectar sessão da Evolution API?"
        description="Esta ação encerrará a sessão do WhatsApp de mensagens. Será necessário escanear o QR Code novamente para reconectar."
        confirmLabel="Desconectar"
        onConfirm={handleDisconnectEvolution}
      />

      {/* Confirmação de Desconexão Meowcaller */}
      <ExecutiveConfirmDialog
        open={confirmDisconnectMeow}
        onOpenChange={setConfirmDisconnectMeow}
        title="Desconectar sessão do Meowcaller?"
        description="Esta ação encerrará a sessão de chamadas de voz via WhatsApp. Chamadas em andamento serão canceladas."
        confirmLabel="Desconectar"
        onConfirm={handleDisconnectMeowcaller}
      />
    </div>
  );
}
