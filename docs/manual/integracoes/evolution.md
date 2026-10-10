# Integração WhatsApp Mensagens — Evolution API

## 1. Visão Geral

A **Evolution API** é o motor exclusivo para envio e recepção de mensagens de texto, mídias e notificações operacionais via WhatsApp no Sistema Helena.

---

## 2. Configurações de Ambiente

No `helena-gateway`, configure as seguintes variáveis no arquivo `.env` ou no painel do EasyPanel:

```bash
EVOLUTION_BASE_URL=https://sua-evolution-api.dominio.com
EVOLUTION_API_KEY=sua_api_key_global_evolution
EVOLUTION_INSTANCE=helena_mensagens
```

---

## 3. Fluxo de Pareamento (QR Code & Código de Pareamento)

1. **Acesso à Interface**: No Painel Executivo, navegue até **Central de Integrações (`/integracoes`) -> WhatsApp Mensagens**.
2. **Conexão**: Clique em **Iniciar / Reconectar Instância**.
3. **Escaneamento do QR Code**:
   - A interface exibirá o QR Code gerado em tempo real pelo backend.
   - Abra o WhatsApp no aparelho exclusivo de mensagens (WhatsApp -> Aparelhos conectados -> Conectar aparelho) e aponte a câmera.
4. **Pareamento via Código (Alternativa)**:
   - Se preferir conectar sem câmera, insira o número do telefone com DDI e DDD (ex: `5511999998888`) e clique em **Gerar Código de Pareamento**.
   - No WhatsApp, selecione "Conectar com número de telefone" e digite o código de 8 dígitos.

---

## 4. Webhook de Recebimento e Gravação no Supabase

O webhook da Evolution deve ser apontado para:
```
POST https://helena-automation-helena-gateway.d9v63q.easypanel.host/webhooks/evolution
```

### Eventos Processados:
- `MESSAGES_UPSERT`: Quando uma nova mensagem de texto é recebida de um contato externo, o Helena Gateway normaliza a carga útil e executa:
  1. Criação/Atualização do contato em `public.comunicacoes`.
  2. Registro da mensagem com tipo `WHATSAPP_TEXTO`, direção `ENTRADA` e metadados de entrega.
  3. Log de auditoria em `public.integration_events`.
- `CONNECTION_UPDATE`: Atualiza o registro em `public.channel_connections` com status (`open`, `connecting`, `close`).

---

## 5. Cuidados Operacionais e Isolamento

- **NUNCA compartilhe o chip da Evolution com o Meowcaller**.
- A Evolution API foi dimensionada exclusivamente para fluxo textual. Chamadas recebidas nessa linha devem ser configuradas para rejeição automática ou mensagem informativa com encaminhamento para a linha de voz oficial.
