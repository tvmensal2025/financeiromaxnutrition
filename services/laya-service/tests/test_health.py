"""Testes do endpoint /health do Laya Service."""
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "laya-service"
    assert data["version"] == "1.0.0"
    assert "auto_threshold" in data
    assert "audit_threshold" in data


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "laya-service"
    assert data["status"] == "online"
    assert data["version"] == "1.0.0"
    assert "endpoints" in data
    assert data["endpoints"]["health"] == "/health"

