# Helena Laya Service — Sistema 1 Decision & Routing Engine

Serviço independente e desacoplado do **Sistema Helena**, responsável por **classificação em alta velocidade, roteamento, scoring calibrado e gating** de eventos, mensagens e áudios transcritos.

---

## 1. Função Canônica

- Responder perguntas estruturadas em ~30 ms sobre:
  - **Empresa** (`business_id`: BIZ-001, BIZ-002, BIZ-003)
  - **Área** (VENDAS, ATENDIMENTO, CS_ONBOARDING, FINANCEIRO, etc.)
  - **Intenção** (problema_acesso, interesse_comercial, duvida_onboarding, etc.)
  - **Urgência e Risco** (Scores calibrados de 1 a 5, risco de churn)
  - **Agente Responsável** (Joana AGT-20, Victor AGT-15, Renata AGT-19, etc.)
  - **Necessidade de Escalonamento** (Humano, Helena AGT-01 ou Fundador)
- Proteger IAs maiores e LLMs generativas de receberem decisões repetitivas ou de triagem básica.

## 2. O que a Laya NÃO Faz

- **NÃO conversa** com o cliente.
- **NÃO escreve** mensagens em linguagem natural.
- **NÃO executa tarefas** de negócio ou código arbitrário.
- **NÃO substitui Helena** nem os agentes especialistas.
- **NÃO é autoridade executiva final** (o orquestrador aplica a regra).
- **NÃO vira ponto único de falha** (possui fallback obrigatório).

---

## 3. Endpoints HTTP da API

### `GET /health`
Verifica a integridade do serviço, thresholds e status do motor.
- **Resposta**: `{"status": "healthy", "service": "laya-service", "version": "1.0.0", "engine_loaded": false, ...}`

### `POST /v1/classify`
Executa a classificação completa de 6 camadas.
- **Entrada**:
  ```json
  {
    "message": "Fiz meu cadastro e não recebi acesso.",
    "business_id": "BIZ-003",
    "channel": "whatsapp"
  }
  ```
- **Saída**:
  ```json
  {
    "trace_id": "lay_9b4e7a1c8f20",
    "business_id": "BIZ-003",
    "area": "ATENDIMENTO",
    "intent": "problema_acesso",
    "urgency": 3,
    "risk_score": 2,
    "commercial_opportunity": false,
    "churn_risk": false,
    "needs_human": false,
    "needs_helena": false,
    "needs_founder": false,
    "suggested_agent_id": "AGT-20",
    "suggested_agent_name": "Joana",
    "confidence": 0.95,
    "decision_mode": "AUTO",
    "latency_ms": 1.25,
    "model_version": "convaiinnovations/laya-multilingual",
    "model_type": "laya-system-one"
  }
  ```

### `POST /v1/score`
Retorna somente métricas de urgência, risco e churn.

### `POST /v1/route`
Retorna a área e o agente de destino.

---

## 4. Política de Confiança e Gating

| Confiança | Modo | Ação |
| :--- | :--- | :--- |
| $\ge 0.90$ | `AUTO` | Roteamento automático direto para a fila do agente. |
| $0.70$ a $0.899$ | `AUTO_AUDIT` | Roteamento automático com tag de auditoria. |
| $< 0.70$ | `FALLBACK` | Encaminhamento para triagem padrão ou revisão humana. |

---

## 5. Docker e EasyPanel

### Variáveis de Ambiente (`.env`):
```env
PORT=8001
LAYA_API_KEY=sua_chave_secreta_aqui
LAYA_MODEL=convaiinnovations/laya
LAYA_DEVICE=cpu
LAYA_AUTO_THRESHOLD=0.90
LAYA_AUDIT_THRESHOLD=0.70
LOG_LEVEL=INFO
```

### Build e Execução Docker:
```bash
docker build -t laya-service:latest .
docker run -d -p 8001:8001 --name laya laya-service:latest
```

---

## 6. Segurança e Observabilidade

- **Zero Secrets no Git**: Nenhuma chave real é versionada.
- **Proteção contra Prompt Injection**: Mensagens maliciosas de escape ("ignore previous instructions") são barradas e classificadas com `risk_score=5`, alertando a governança executiva da Helena.
- **Body Limit**: Bloqueio de payloads maiores que 64 KB contra ataques de memória.
- **Trace ID**: Toda requisição carrega `trace_id` exclusivo para reconciliação com o Supabase.
