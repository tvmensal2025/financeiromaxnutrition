"""Schemas Pydantic para validação e serialização do Laya Service."""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="Texto da mensagem ou transcrição")
    business_id: Optional[str] = Field("BIZ-003", description="ID da empresa (ex: BIZ-001, BIZ-002, BIZ-003)")
    channel: Optional[str] = Field("whatsapp", description="Canal de origem (whatsapp, web, voip, api)")
    customer_status: Optional[str] = Field(None, description="Status do cliente (lead, ativo, cancelado, em_risco)")
    current_owner: Optional[str] = Field(None, description="Responsável ou agente atual")


class ClassifyResponse(BaseModel):
    trace_id: str = Field(..., description="UUID único da requisição para auditoria")
    business_id: str = Field(..., description="Empresa identificada ou confirmada")
    area: str = Field(..., description="Área operacional (VENDAS, ATENDIMENTO, CS_ONBOARDING, FINANCEIRO, TECNOLOGIA, etc.)")
    intent: str = Field(..., description="Intenção principal detectada")
    urgency: int = Field(..., ge=1, le=5, description="Grau de urgência (1=baixa a 5=crítica)")
    risk_score: int = Field(..., ge=1, le=5, description="Grau de risco operacional/jurídico/financeiro (1=baixo a 5=crítico)")
    commercial_opportunity: bool = Field(False, description="Indica potencial de venda ou upgrade")
    churn_risk: bool = Field(False, description="Indica ameaça de cancelamento ou perda de cliente")
    needs_human: bool = Field(False, description="Requer intervenção de operador humano")
    needs_helena: bool = Field(False, description="Requer deliberação da CEO Virtual Helena")
    needs_founder: bool = Field(False, description="Requer escalonamento executivo para o fundador")
    suggested_agent_id: str = Field(..., description="ID canônico do agente (ex: AGT-20, AGT-15, AGT-19)")
    suggested_agent_name: str = Field(..., description="Nome do agente (ex: Joana, Victor, Renata)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Nível de confiança calibrado (0.0 a 1.0)")
    decision_mode: Literal["AUTO", "AUTO_AUDIT", "FALLBACK"] = Field(..., description="Modo de decisão com base na confiança")
    latency_ms: float = Field(..., description="Latência da inferência em milissegundos")
    model_version: str = Field(..., description="Versão do modelo ou motor de decisão")
    model_type: str = Field(..., description="Tipo do motor (laya-system-one ou deterministic-fallback)")


class ScoreRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    business_id: Optional[str] = "BIZ-003"


class ScoreResponse(BaseModel):
    trace_id: str
    urgency: int = Field(..., ge=1, le=5)
    risk_score: int = Field(..., ge=1, le=5)
    churn_risk: bool
    commercial_opportunity: bool
    confidence: float
    latency_ms: float


class RouteRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    business_id: Optional[str] = "BIZ-003"
    current_area: Optional[str] = None


class RouteResponse(BaseModel):
    trace_id: str
    business_id: str
    target_area: str
    target_agent_id: str
    target_agent_name: str
    confidence: float
    decision_mode: Literal["AUTO", "AUTO_AUDIT", "FALLBACK"]
    latency_ms: float


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    service: str = "laya-service"
    version: str = "1.0.0"
    engine_loaded: bool
    device: str
    auto_threshold: float
    audit_threshold: float
