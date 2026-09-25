# Camada Rápida de Triagem e Roteamento — Laya Service

## 1. Visão Geral

O **Laya Service** é um microsserviço otimizado para inferência neural ultrarrápida (Sistema 1). Ele atua como um "filtro cognitivo de reflexo" com latência sub-50ms antes que qualquer requisição complexa seja encaminhada para o modelo de Sistema 2 (Helena Core / LLM principal).

---

## 2. Configurações de Ambiente

No `helena-gateway`, configure as seguintes variáveis no arquivo `.env` ou no painel do EasyPanel:

```bash
LAYA_BASE_URL=https://helena-automation-laya-service.d9v63q.easypanel.host
LAYA_TIMEOUT_MS=3000
```

---

## 3. Diretriz de Isolamento e Segurança

> **REGRA FUNDAMENTAL:**
> O Laya Service **NUNCA** conversa diretamente com clientes ou contatos externos. Ele é estritamente um módulo analítico interno de roteamento e decisão.

---

## 4. Endpoints e Contratos OpenAPI

### 1. `POST /v1/classify`
Classifica a intenção e a complexidade do texto de entrada.
- **Entrada**:
  ```json
  { "text": "Preciso urgente de um relatório das vendas de ontem da Max Nutrition", "context": {} }
  ```
- **Saída**:
  ```json
  {
    "category": "RELATORIO_FINANCEIRO",
    "confidence": 0.94,
    "intent": "SOLICITACAO_DADOS",
    "entities": ["Max Nutrition", "ontem"],
    "requires_system_2": false
  }
  ```

### 2. `POST /v1/score`
Calcula o índice de sentimento, urgência e risco de escalada.
- **Saída**:
  ```json
  {
    "sentiment": "NEUTRAL",
    "urgency_score": 0.85,
    "risk_level": "LOW",
    "actionable": true
  }
  ```

### 3. `POST /v1/route`
Determina para qual agente ou fila executiva a solicitação deve ser encaminhada.
- **Saída**:
  ```json
  {
    "target_agent": "AG-0004",
    "agent_name": "Analista Financeiro",
    "routing_rule": "FINANCEIRO_AUTO",
    "priority": "HIGH"
  }
  ```

---

## 5. Simulador no Painel Executivo

Na **Aba Roteamento (Laya)** da Central de Integrações, o Fundador e os administradores podem simular mensagens em tempo real para verificar a resposta imediata da rede neural, taxas de confiança e alocação de agentes.
