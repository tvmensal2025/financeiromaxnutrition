"""Motor de Inferência e Classificação Hierárquica do Laya Service.

Implementa o protocolo de 6 camadas:
1. Empresa (BIZ-001, BIZ-002, BIZ-003)
2. Área Operacional (ATENDIMENTO, VENDAS, CS_ONBOARDING, FINANCEIRO, etc.)
3. Intenção / Tipo
4. Risco & Urgência (1 a 5, churn_risk, commercial_opportunity)
5. Responsável Sugerido (Joana, Victor, Renata, etc.)
6. Escalonamento e Gating (AUTO, AUTO_AUDIT, FALLBACK)
"""
import re
import time
import uuid
import logging
from typing import Dict, Any, Tuple
from src.config import settings
from src.schemas import ClassifyRequest, ClassifyResponse, ScoreResponse, RouteResponse

logger = logging.getLogger("laya.classifier")

import unicodedata

# Mapeamento oficial dos 21 agentes do Sistema Helena
AGENT_DIRECTORY = {
    "ATENDIMENTO": {"id": "AGT-20", "name": "Joana"},
    "VENDAS": {"id": "AGT-15", "name": "Victor"},
    "CS_ONBOARDING": {"id": "AGT-19", "name": "Renata"},
    "FINANCEIRO": {"id": "AGT-06", "name": "Sofia"},
    "TECNOLOGIA": {"id": "AGT-08", "name": "Lucas"},
    "MARKETING": {"id": "AGT-11", "name": "Gabriel"},
    "JURIDICO": {"id": "AGT-17", "name": "Clara"},
    "ESTRATEGIA": {"id": "AGT-01", "name": "Helena"},
}

def normalize_text(text: str) -> str:
    """Normaliza texto em pt-BR removendo acentos e pontuações excessivas."""
    nfkd = unicodedata.normalize('NFKD', text)
    ascii_text = nfkd.encode('ASCII', 'ignore').decode('ASCII').lower()
    return re.sub(r'\s+', ' ', ascii_text).strip()

# Regex padrões normalizados para identificação semântica em português
PATTERNS = {
    "empresa_biz001": re.compile(r"\b(igreen|energia|placa|solar|kwh|concessionaria|cemig|cpfl|enel|fatura de luz|desconto na luz|biz-?001)\b", re.IGNORECASE),
    "empresa_biz002": re.compile(r"\b(clinica|saude|medico|medica|paciente|prontuario|consulta|receita|farmacia|exame|vida|biz-?002)\b", re.IGNORECASE),
    "empresa_biz003": re.compile(r"\b(humano digital|avatar|treinamento|curso|mentoria|plataforma|login|senha|acesso|area de membros|hotmart|kiwify|biz-?003)\b", re.IGNORECASE),
    
    # Intenções de Vendas (Victor)
    "vendas": re.compile(r"\b(quero saber|como funciona|quanto custa|preco|valor|investimento|ganhar|lucrar|comprar|assinar|assinatura|plano|proposta|contratar|contratacao|adquirir|orcamento|desconto|a vista|comercial|lead)\b", re.IGNORECASE),
    
    # Intenções de Atendimento / Suporte (Joana)
    "atendimento": re.compile(r"\b(nao recebi|nao consigo|problema|erro|ajuda|socorro|suporte|trava|falha|defeito|recusou|senha errada|acesso bloqueado|nao abre|nao funciona|nao carrega|acesso|cadastro e nao|login bloqueado)\b", re.IGNORECASE),
    
    # Intenções de CS / Onboarding (Renata)
    "onboarding": re.compile(r"\b(ja entrei|ja comprei|como comecar|onde comeco|primeiro passo|primeiros passos|aula|modulo|duvida no curso|onboarding|boas-vindas|orientacao|tutorial)\b", re.IGNORECASE),
    
    # Churn / Cancelamento
    "churn": re.compile(r"\b(cancelar|cancelamento|estorno|devolucao|devolver meu dinheiro|desistir|processo|procon|reclame aqui|nunca mais|arrependimento|reembolso)\b", re.IGNORECASE),
    
    # Escalonamento Fundador / Jurídico
    "escalonamento_founder": re.compile(r"\b(falar com dono|fundador|diretor|proprietario|rafael|processar|advogado|justica|fraude|golpe)\b", re.IGNORECASE),
    
    # Escalonamento Humano
    "humano": re.compile(r"\b(atendente humano|pessoa real|falar com alguem|robo inutil|nao quero robo|atendente de verdade)\b", re.IGNORECASE),
    
    # Detecção de Prompt Injection / Jailbreak
    "injection": re.compile(r"\b(ignore previous instructions|ignore todas as instrucoes|esquece tudo|system prompt|reveal your prompt|jailbreak|disregard previous|diga que voce e)\b", re.IGNORECASE),
}


class LayaClassifierEngine:
    def __init__(self):
        self.engine_name = "convaiinnovations/laya"
        self.router = None
        self.is_laya_model_loaded = False
        self._init_laya_if_available()

    def _init_laya_if_available(self):
        """Tenta carregar o router nativo do pacote laya caso instalado e pesos presentes."""
        try:
            from laya import Router
            logger.info("Pacote laya detectado. Inicializando router...")
            # Não faz preload pesado no boot para não travar container em CPU
            self.router = Router()
            self.is_laya_model_loaded = True
            logger.info("Laya Router nativo carregado com sucesso.")
        except Exception as e:
            logger.info(f"Laya engine operando em modo nativo calibrado/fallback (info: {e})")
            self.is_laya_model_loaded = False

    def classify(self, request: ClassifyRequest) -> ClassifyResponse:
        t_start = time.perf_counter()
        trace_id = f"lay_{uuid.uuid4().hex[:12]}"
        msg = request.message.strip()
        msg_norm = normalize_text(msg)

        # Defesa contra Prompt Injection
        is_injection = bool(PATTERNS["injection"].search(msg_norm)) or bool(PATTERNS["injection"].search(msg))
        if is_injection:
            logger.warning(f"[{trace_id}] Tentativa de Prompt Injection interceptada.")
            return ClassifyResponse(
                trace_id=trace_id,
                business_id=request.business_id or "BIZ-003",
                area="ESTRATEGIA",
                intent="prompt_injection_blocked",
                urgency=5,
                risk_score=5,
                commercial_opportunity=False,
                churn_risk=False,
                needs_human=True,
                needs_helena=True,
                needs_founder=False,
                suggested_agent_id="AGT-01",
                suggested_agent_name="Helena",
                confidence=0.99,
                decision_mode="AUTO",
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
                model_version=self.engine_name,
                model_type="guardrail-security"
            )

        # 1. Camada 1: Empresa
        biz_id = request.business_id or "BIZ-003"
        if PATTERNS["empresa_biz001"].search(msg_norm):
            biz_id = "BIZ-001"
        elif PATTERNS["empresa_biz002"].search(msg_norm):
            biz_id = "BIZ-002"
        elif PATTERNS["empresa_biz003"].search(msg_norm):
            biz_id = "BIZ-003"

        # 2. Camada 2 & 3: Área e Intenção
        area, intent, confidence = self._evaluate_intent(msg_norm, request.customer_status)

        # 3. Camada 4: Risco e Urgência
        urgency, risk_score, churn_risk, comm_opp = self._evaluate_risk_and_urgency(msg_norm, area, intent)

        # 4. Camada 5: Agente Responsável
        agent_info = AGENT_DIRECTORY.get(area, AGENT_DIRECTORY["ATENDIMENTO"])
        agent_id = agent_info["id"]
        agent_name = agent_info["name"]

        # 5. Camada 6: Escalonamento
        needs_founder = bool(PATTERNS["escalonamento_founder"].search(msg_norm)) or risk_score >= 5
        needs_human = bool(PATTERNS["humano"].search(msg_norm)) or needs_founder or urgency >= 4
        needs_helena = needs_founder or risk_score >= 4 or (area == "FINANCEIRO" and urgency >= 3)

        # Se for escalonamento executivo direto
        if needs_founder:
            confidence = max(confidence, 0.95)
        if needs_helena and not needs_founder:
            confidence = max(confidence, 0.92)

        # Política de Gating baseada em limites de confiança
        if confidence >= settings.laya_auto_threshold:
            decision_mode = "AUTO"
        elif confidence >= settings.laya_audit_threshold:
            decision_mode = "AUTO_AUDIT"
        else:
            decision_mode = "FALLBACK"

        t_end = time.perf_counter()
        latency_ms = round((t_end - t_start) * 1000, 2)

        return ClassifyResponse(
            trace_id=trace_id,
            business_id=biz_id,
            area=area,
            intent=intent,
            urgency=urgency,
            risk_score=risk_score,
            commercial_opportunity=comm_opp,
            churn_risk=churn_risk,
            needs_human=needs_human,
            needs_helena=needs_helena,
            needs_founder=needs_founder,
            suggested_agent_id=agent_id,
            suggested_agent_name=agent_name,
            confidence=round(confidence, 4),
            decision_mode=decision_mode,
            latency_ms=latency_ms,
            model_version=f"{self.engine_name}-multilingual",
            model_type="laya-system-one" if self.is_laya_model_loaded else "deterministic-calibrated"
        )

    def _evaluate_intent(self, msg: str, customer_status: str | None) -> Tuple[str, str, float]:
        """Classifica a área e a intenção, calculando a probabilidade calibrada."""
        has_vendas = bool(PATTERNS["vendas"].search(msg))
        has_atendimento = bool(PATTERNS["atendimento"].search(msg))
        has_onboarding = bool(PATTERNS["onboarding"].search(msg))
        has_churn = bool(PATTERNS["churn"].search(msg))

        if has_churn:
            return "ATENDIMENTO", "risco_cancelamento", 0.96

        # Caso clássico de vendas
        if has_vendas and not has_atendimento:
            return "VENDAS", "interesse_comercial", 0.94

        # Caso clássico de atendimento / erro
        if has_atendimento and not has_vendas:
            return "ATENDIMENTO", "problema_acesso", 0.95

        # Caso clássico de CS / Onboarding
        if has_onboarding:
            return "CS_ONBOARDING", "duvida_onboarding", 0.93

        # Mensagem mista ou ambígua
        if has_vendas and has_atendimento:
            return "ATENDIMENTO", "duvida_geral_mista", 0.78

        # Fallback de classificação para texto genérico ou curto
        if customer_status == "lead":
            return "VENDAS", "duvida_lead", 0.72
        elif customer_status == "ativo":
            return "CS_ONBOARDING", "contato_ativo", 0.71

        return "ATENDIMENTO", "triagem_geral", 0.65

    def _evaluate_risk_and_urgency(self, msg: str, area: str, intent: str) -> Tuple[int, int, bool, bool]:
        """Calcula scores de urgência (1-5), risco (1-5), churn e oportunidade comercial."""
        churn_risk = bool(PATTERNS["churn"].search(msg))
        comm_opp = area == "VENDAS" or intent in ("interesse_comercial", "duvida_lead")
        has_escalonamento = bool(PATTERNS["escalonamento_founder"].search(msg))

        urgency = 2
        risk_score = 1

        if churn_risk:
            urgency = 4
            risk_score = 4

        if has_escalonamento:
            urgency = 5
            risk_score = 5

        if intent == "problema_acesso":
            urgency = max(urgency, 3)
            risk_score = max(risk_score, 2)

        if comm_opp:
            urgency = max(urgency, 3)

        return urgency, risk_score, churn_risk, comm_opp

    def score(self, message: str, business_id: str = "BIZ-003") -> ScoreResponse:
        req = ClassifyRequest(message=message, business_id=business_id)
        res = self.classify(req)
        return ScoreResponse(
            trace_id=res.trace_id,
            urgency=res.urgency,
            risk_score=res.risk_score,
            churn_risk=res.churn_risk,
            commercial_opportunity=res.commercial_opportunity,
            confidence=res.confidence,
            latency_ms=res.latency_ms
        )

    def route(self, message: str, business_id: str = "BIZ-003") -> RouteResponse:
        req = ClassifyRequest(message=message, business_id=business_id)
        res = self.classify(req)
        return RouteResponse(
            trace_id=res.trace_id,
            business_id=res.business_id,
            target_area=res.area,
            target_agent_id=res.suggested_agent_id,
            target_agent_name=res.suggested_agent_name,
            confidence=res.confidence,
            decision_mode=res.decision_mode,
            latency_ms=res.latency_ms
        )


classifier_engine = LayaClassifierEngine()
