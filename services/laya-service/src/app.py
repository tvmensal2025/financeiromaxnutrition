"""FastAPI Application do Laya Service (Sistema Helena)."""
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.schemas import (
    ClassifyRequest, ClassifyResponse,
    ScoreRequest, ScoreResponse,
    RouteRequest, RouteResponse,
    HealthResponse
)
from src.classifier import classifier_engine

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("laya.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Laya Service inicializado. Thresholds: Auto={settings.laya_auto_threshold}, Audit={settings.laya_audit_threshold}")
    yield
    logger.info("Laya Service finalizando...")


app = FastAPI(
    title="Helena Laya Service",
    description="Camada de Sistema 1: Decisão rápida, classificação, roteamento e gating calibrado",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_and_limit_middleware(request: Request, call_next):
    # Proteção de tamanho de payload
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_payload_bytes:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Payload excede o limite máximo permitido."}
        )

    # Validação de API Key interna (se configurada)
    if settings.laya_api_key and request.url.path not in ("/health", "/docs", "/openapi.json"):
        auth_header = request.headers.get("x-api-key") or request.headers.get("authorization")
        expected = settings.laya_api_key
        token = auth_header.replace("Bearer ", "") if auth_header else ""
        if token != expected:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Acesso não autorizado. Chave de API inválida."}
            )

    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Healthcheck rápido e sem dependências pesadas para EasyPanel/Docker."""
    return HealthResponse(
        status="healthy",
        service="laya-service",
        version="1.0.0",
        engine_loaded=classifier_engine.is_laya_model_loaded,
        device=settings.laya_device,
        auto_threshold=settings.laya_auto_threshold,
        audit_threshold=settings.laya_audit_threshold
    )


@app.post("/v1/classify", response_model=ClassifyResponse)
def classify_message(request: ClassifyRequest):
    """Classifica mensagem em 6 camadas estruturadas retornando decisão e confidence calibrada."""
    try:
        return classifier_engine.classify(request)
    except Exception as e:
        logger.error(f"Erro durante classificação: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha interna ao processar classificação."
        )


@app.post("/v1/score", response_model=ScoreResponse)
def score_message(request: ScoreRequest):
    """Calcula pontuação de urgência, risco e churn para triagem executiva."""
    try:
        return classifier_engine.score(request.message, request.business_id or "BIZ-003")
    except Exception as e:
        logger.error(f"Erro durante scoring: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha interna ao processar pontuação."
        )


@app.post("/v1/route", response_model=RouteResponse)
def route_message(request: RouteRequest):
    """Determina a área e o agente de destino para a fila de atendimento."""
    try:
        return classifier_engine.route(request.message, request.business_id or "BIZ-003")
    except Exception as e:
        logger.error(f"Erro durante roteamento: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha interna ao processar roteamento."
        )
