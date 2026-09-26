# Arquitetura Laya — Classificação, Roteamento e Gating Rápido

## 1. Visão Geral e Propósito

O **Laya Service** é a camada de **Sistema 1 (decisão rápida, não-autoregressiva e reflexiva)** do Sistema Helena. Seu objetivo exclusivo é receber eventos e mensagens (de WhatsApp, formulários, sistemas ou voz transcrita) e responder perguntas estruturadas de alta velocidade (~30-50 ms) sobre classificação, roteamento e risco:

1. **Qual a Empresa?** (`business_id`: BIZ-001, BIZ-002, BIZ-003, etc.)
2. **Qual a Área Operacional?** (`ATENDIMENTO`, `VENDAS`, `CS_ONBOARDING`, `FINANCEIRO`, `TECNOLOGIA`, etc.)
3. **Qual a Intenção ou Tipo de Demanda?** (`problema_acesso`, `interesse_comercial`, `duvida_onboarding`, etc.)
4. **Qual a Urgência e Risco?** (escala calibrada de 1 a 5, risco de churn, etc.)
5. **Qual o Agente Responsável Provável?** (`AGT-20 Joana`, `AGT-15 Victor`, `AGT-19 Renata`, etc.)
6. **Requer Escalonamento Executivo?** (`needs_human`, `needs_helena`, `needs_founder`)

---

## 2. O que a Laya NÃO Faz (Fronteiras e Guardrails)

Para proteger o ecossistema e evitar alucinações ou sobreposição de papéis:
- **Laya NÃO conversa com o cliente** nem gera mensagens em linguagem natural.
- **Laya NÃO escreve proposta comercial** nem executa tarefas de negócio.
- **Laya NÃO toma decisões financeiras** nem movimenta dinheiro.
- **Laya NÃO substitui a Helena** (Helena é o comando executivo supremo e governança).
- **Laya NÃO substitui os agentes especialistas** (cada agente possui sua própria inteligência e ferramentas).
- **Laya NÃO é fonte da verdade** (o banco canônico de estado é o Supabase).
- **Laya NÃO altera dados críticos do banco** por iniciativa própria.

---

## 3. Modelo Base: Auditoria Técnica de `convaiinnovations/laya`

Auditamos a especificação oficial do modelo hospedado em HuggingFace (`convaiinnovations/laya`) e seu código-fonte:

| Item | Especificação Auditada |
| :--- | :--- |
| **Criador / Organização** | Convai Innovations / NandhaKishorM |
| **Licença** | Apache 2.0 (Permite uso comercial) |
| **Pipeline Tag** | `text-classification` |
| **Arquitetura** | Não-autoregressiva (RLCD — Reinforcement Learning with Calibrated Decisions) |
| **Modelos / Checkpoints** | 1. `english` (`answerdotai/ModernBERT-large`, 512–1024 tokens)<br>2. `multilingual` (`jhu-clsp/mmBERT-base`, 1024–8192 tokens)<br>3. `typed-decisions` (ModernBERT-large com fine-tuning de scoring calibrado) |
| **Suporte a Português** | **SIM** (Checkpoint `multilingual` cobre mais de 100 idiomas incluindo pt-BR com detecção automática de script/língua) |
| **Formato dos Pesos** | SafeTensors (`model.safetensors`) |
| **Tipos de Perguntas** | `choice` (seleção entre critérios estruturados), `score` (grau de intensidade/urgência), `noul` (probabilidade booleana calibrada) |
| **Latência de Inferência** | ~33 ms em forward pass direto |
| **Recursos Mínimos (CPU)** | 2 vCPU, 4 GB RAM (Inference via ONNX ou PyTorch CPU) |
| **Recursos Recomendados (GPU)** | 1x NVIDIA T4 / L4 (VRAM ~4–8 GB com bf16/fp16) |

---

## 4. Hierarquia Decisória em 6 Camadas

A Laya processa a decisão em uma cascata hierárquica e estruturada, evitando a sobrecarga de selecionar entre centenas de opções soltas:

```
[ Entrada / Mensagem ]
        ↓
CAMADA 1: EMPRESA (BIZ-001 iGreen, BIZ-002 Saúde, BIZ-003 Humano Digital, etc.)
        ↓
CAMADA 2: ÁREA OPERACIONAL (VENDAS, ATENDIMENTO, CS/ONBOARDING, FINANCEIRO, etc.)
        ↓
CAMADA 3: INTENÇÃO / TIPO ESPECÍFICO (ex: problema_acesso, compra_lead, integracao_api)
        ↓
CAMADA 4: RISCO & URGÊNCIA (Score 1 a 5, risco de perda de receita, churn_risk)
        ↓
CAMADA 5: AGENTE RESPONSÁVEL SUGERIDO (ex: Joana, Victor, Renata, etc.)
        ↓
CAMADA 6: ESCALONAMENTO E GATING (Helena, Fundador ou Fila de Revisão Humana)
```

---

## 5. Calibração de Probabilidades e Política de Gating

Cada classificação emite um índice de confiança (`confidence` entre 0.00 e 1.00). O serviço adota três faixas operacionais configuráveis:

| Faixa de Confiança | Modo de Decisão | Comportamento Operacional |
| :--- | :--- | :--- |
| **$\ge$ 0.90** | `AUTO` | Roteamento imediato direto para o agente responsável na fila do Supabase. |
| **0.70 a 0.899** | `AUTO + AUDITORIA` | Roteamento executado, mas com marcação de auditoria para inspeção posterior. |
| **$<$ 0.70** | `FALLBACK` | O orquestrador aciona a regra determinística canônica ou encaminha para revisão da Helena/humano. |

> [!IMPORTANT]
> **Resiliência e Continuidade de Negócio**: Se o `laya-service` estiver indisponível, sofrendo timeout ou instabilidade de hardware, o Sistema Helena **NUNCA PARA**. O orquestrador chaveia automaticamente para a camada de regras determinísticas e mantém as operações ativas.

---

## 6. Caso de Uso Piloto: BIZ-003 (Humano Digital)

No ecossistema piloto de validação (BIZ-003), a Laya foi mapeada para as 3 rotas primárias de agentes:

1. **Atendimento ao Cliente (`AGT-20 Joana`)**:
   - *Exemplo*: `"Fiz meu cadastro e não recebi acesso à plataforma."`
   - *Classificação*: `area = ATENDIMENTO`, `intent = problema_acesso`, `urgency = 3`, `suggested_agent = AGT-20 Joana`.
2. **Vendas e Aquisição (`AGT-15 Victor`)**:
   - *Exemplo*: `"Quero saber como funciona o plano e quanto posso lucrar."`
   - *Classificação*: `area = VENDAS`, `intent = interesse_comercial`, `commercial_opportunity = true`, `suggested_agent = AGT-15 Victor`.
3. **Customer Success e Onboarding (`AGT-19 Renata`)**:
   - *Exemplo*: `"Já entrei no grupo, mas não sei por qual aula começar."`
   - *Classificação*: `area = CS_ONBOARDING`, `intent = duvida_onboarding`, `churn_risk = false`, `suggested_agent = AGT-19 Renata`.

---

## 7. Integração e Rastreabilidade (Auditoria)

Toda predição gera um trace estruturado:
- `trace_id`: UUID único da predição.
- `business_id`: Chave da empresa.
- `model_version`: Identificador do checkpoint/motor.
- `confidence`: Pontuação de calibração.
- `latency_ms`: Tempo de resposta em milissegundos.
- `decision_mode`: `AUTO`, `AUTO_AUDIT` ou `FALLBACK`.
- `suggested_agent`: Agente indicado para a orquestração.
