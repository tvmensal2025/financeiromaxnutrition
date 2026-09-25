"""Testes da classificação de BIZ-003 e roteamento de agentes."""
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_classify_atendimento_joana():
    payload = {
        "message": "Fiz meu cadastro e não recebi acesso à plataforma.",
        "business_id": "BIZ-003",
        "channel": "whatsapp"
    }
    response = client.post("/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["business_id"] == "BIZ-003"
    assert data["area"] == "ATENDIMENTO"
    assert data["intent"] == "problema_acesso"
    assert data["suggested_agent_id"] == "AGT-20"
    assert data["suggested_agent_name"] == "Joana"
    assert data["confidence"] >= 0.90
    assert data["decision_mode"] == "AUTO"
    assert data["latency_ms"] > 0


def test_classify_vendas_victor():
    payload = {
        "message": "Quero saber como funciona e quanto posso ganhar com o plano.",
        "business_id": "BIZ-003",
        "channel": "whatsapp"
    }
    response = client.post("/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["business_id"] == "BIZ-003"
    assert data["area"] == "VENDAS"
    assert data["commercial_opportunity"] is True
    assert data["suggested_agent_id"] == "AGT-15"
    assert data["suggested_agent_name"] == "Victor"
    assert data["confidence"] >= 0.90
    assert data["decision_mode"] == "AUTO"


def test_classify_onboarding_renata():
    payload = {
        "message": "Já entrei, mas não sei como começar os primeiros passos.",
        "business_id": "BIZ-003",
        "channel": "whatsapp"
    }
    response = client.post("/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["business_id"] == "BIZ-003"
    assert data["area"] == "CS_ONBOARDING"
    assert data["intent"] == "duvida_onboarding"
    assert data["suggested_agent_id"] == "AGT-19"
    assert data["suggested_agent_name"] == "Renata"
    assert data["confidence"] >= 0.90
    assert data["decision_mode"] == "AUTO"


def test_route_and_score_endpoints():
    score_res = client.post("/v1/score", json={"message": "Quero cancelar imediatamente e ter meu reembolso!"})
    assert score_res.status_code == 200
    score_data = score_res.json()
    assert score_data["churn_risk"] is True
    assert score_data["urgency"] >= 4

    route_res = client.post("/v1/route", json={"message": "Gostaria de agendar uma reunião comercial para proposta."})
    assert route_res.status_code == 200
    route_data = route_res.json()
    assert route_data["target_area"] == "VENDAS"
    assert route_data["target_agent_id"] == "AGT-15"
