# Central de Canais, Voz e Roteamento do Sistema Helena

## 1. Visão Geral

A **Central de Canais, Voz e Roteamento** do Sistema Helena é a infraestrutura unificada responsável por gerenciar as conexões externas de comunicação síncrona e assíncrona da inteligência executiva com o mundo exterior.

O sistema integra de forma desacoplada e segura:
1. **Evolution API**: Canal dedicado e exclusivo para mensagens de texto e mídia via WhatsApp.
2. **Meowcaller Service**: Instância independente para chamadas de áudio VoIP via WhatsApp.
3. **ElevenLabs**: Infraestrutura de síntese de voz (TTS) e inteligência conversacional ultrarrápida.
4. **Laya Service**: Rede neural rápida de Sistema 1 para classificação, triagem e roteamento de intenções em milissegundos.
5. **Helena Gateway**: Backend facade seguro que orquestra conexões, esconde credenciais mestras e expõe APIs REST/Webhooks.
6. **Supabase Operacional**: Fonte única da verdade para persistência de perfis de voz, sessões de chamada, comunicações e trilhas de auditoria.

---

## 2. Princípios de Arquitetura e Isolamento

```
                           +---------------------------+
                           |     Painel Executivo      |
                           |       (/integracoes)      |
                           +-------------+-------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                            HELENA GATEWAY (FACADE)                                |
|                        /api/integrations/* | /webhooks/*                          |
+---------+--------------------+---------------------+--------------------+---------+
          |                    |                     |                    |
          v                    v                     v                    v
+------------------+  +------------------+  +------------------+  +------------------+
|  Evolution API   |  |   Meowcaller     |  |   ElevenLabs     |  |   Laya Service   |
| (WhatsApp Texto) |  | (WhatsApp Voz)   |  |  (Voz & Conv AI) |  |  (Triagem Rápida)|
+------------------+  +------------------+  +------------------+  +------------------+
          |                    |                     |                    |
          +--------------------+----------+----------+--------------------+
                                          |
                                          v
                              +-----------------------+
                              |   Supabase Operacional |
                              | (Tabelas de Auditoria)|
                              +-----------------------+
```

### Regras de Isolamento Inegociáveis
1. **Separação de Linhas WhatsApp**: A linha telefônica conectada à Evolution API para mensagens de texto **NUNCA** pode ser a mesma conectada ao Meowcaller para chamadas de voz. A sobreposição em um mesmo número derruba a sessão de sinalização do WhatsApp Web.
2. **Gating Rápido (Laya)**: O Laya Service atua estritamente como Sistema 1 de triagem (classificação de intenção, scoring de risco e roteamento interno). O Laya **NUNCA** envia respostas diretas ao cliente.
3. **Segurança de Credenciais (Zero Secret Exposure)**: Nenhuma chave mestra (`EVOLUTION_API_KEY`, `MEOWCALLER_TOKEN`, `ELEVENLABS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) é transmitida ao frontend. O painel interage com o Helena Gateway utilizando tokens JWT emitidos pelo Supabase Auth.
4. **Auditoria no Supabase**: Toda chamada originada ou recebida, mensagem processada e evento de infraestrutura é gravado com rastreabilidade nas tabelas `call_sessions`, `comunicacoes` e `integration_events`.

---

## 3. Estrutura de Tabelas no Supabase

| Tabela | Função | Permissões / RLS |
| :--- | :--- | :--- |
| `public.channel_connections` | Estado e metadados das conexões de canal (Evolution, Meowcaller, etc.). | `authenticated` (leitura), `service_role` (total) |
| `public.voice_profiles` | Vozes cadastradas e configuradas para os agentes da Helena. | `authenticated` (leitura/escrita), `service_role` (total) |
| `public.call_sessions` | Histórico completo de sessões de voz originadas ou atendidas. | `authenticated` (leitura), `service_role` (total) |
| `public.integration_events` | Log cronológico de eventos e webhooks de integrações. | `authenticated` (leitura), `service_role` (total) |
| `public.comunicacoes` | Mensagens de texto trafegadas via WhatsApp e canais externos. | `authenticated` (leitura/escrita conforme empresa) |
| `public.integracoes` | Registro canônico de governança das integrações habilitadas no grupo. | `authenticated` (leitura), `service_role` (total) |

---

## 4. Endpoints Unificados do Gateway

A facade `helena-gateway` expõe os seguintes serviços sob `/api/integrations`:

- `GET /api/integrations/status`: Diagnóstico consolidado de saúde dos 5 provedores.
- `GET /api/integrations/evolution/status`: Status da sessão Evolution API.
- `POST /api/integrations/evolution/connect`: Inicialização de sessão e obtenção de QR Code.
- `POST /api/integrations/evolution/pair`: Pareamento via código de telefone.
- `POST /api/integrations/evolution/send`: Disparo de mensagem de texto WhatsApp.
- `GET /api/integrations/meowcaller/status`: Status e sessões de voz do Meowcaller.
- `POST /api/integrations/meowcaller/session/start`: Inicia nova sessão WhatsApp de chamadas.
- `POST /api/integrations/meowcaller/calls/originate`: Origina chamada VoIP para número remoto.
- `POST /api/integrations/meowcaller/calls/hangup`: Encerra chamada ativa.
- `GET /api/integrations/elevenlabs/voices`: Lista vozes da conta ElevenLabs com metadados.
- `POST /api/integrations/elevenlabs/sample`: Gera áudio de teste (TTS) em formato base64.
- `POST /api/integrations/elevenlabs/signed-url`: Gera signed URL efêmera para WebSocket.
- `POST /api/integrations/laya/classify`: Classificação semântica de intenções (Sistema 1).
- `POST /api/integrations/laya/score`: Análise de sentimento, urgência e risco.
- `POST /api/integrations/laya/route`: Roteamento e decisão de agente executor.
- `POST /api/integrations/webhooks/evolution`: Endpoint de recebimento de eventos da Evolution.
- `POST /api/integrations/webhooks/meowcaller`: Endpoint de recebimento de eventos do Meowcaller.
