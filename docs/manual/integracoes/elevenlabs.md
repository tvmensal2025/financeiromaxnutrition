# Integração de Voz e IA Conversacional — ElevenLabs

## 1. Visão Geral

A infraestrutura **ElevenLabs** provê síntese de voz neural ultrarrealista (TTS), reconhecimento de fala e agentes conversacionais com baixa latência para o Sistema Helena.

---

## 2. Configurações de Ambiente

No `helena-gateway`, configure as seguintes variáveis no arquivo `.env` ou no painel do EasyPanel:

```bash
ELEVENLABS_API_KEY=sua_chave_secreta_elevenlabs
ELEVENLABS_AGENT_ID=id_do_agente_conversacional_opcional
```

---

## 3. Gestão e Perfis de Voz

O Sistema Helena mapeia as vozes disponíveis na conta ElevenLabs para os agentes da organização através da tabela `public.voice_profiles`.

### Campos do Perfil de Voz:
- `id`: Identificador interno do perfil (`VOICE-HELENA-PADRAO`, `VOICE-HELENA-CALMA`, etc.).
- `agent_id`: Código do agente vinculado (ex: `AG-0001` - Helena Diretora).
- `provider`: `ELEVENLABS`.
- `voice_id`: ID canônico da voz no catálogo da ElevenLabs.
- `voice_name`: Nome da voz (ex: `Helena Executiva BR`, `Rachel`, `George`).
- `stability`: Parâmetro de estabilidade da síntese (padrão: 0.75).
- `similarity_boost`: Intensidade de fidelidade à amostra original (padrão: 0.85).
- `is_active`: Define a voz padrão em uso.

---

## 4. Teste de Síntese em Tempo Real (TTS)

Na **Aba Vozes** da Central de Integrações:
1. O usuário pode selecionar qualquer voz listada da sua conta ElevenLabs.
2. Inserir uma frase de demonstração executiva.
3. Clicar em **Ouvir Demonstração**.
4. O Helena Gateway processa a requisição via `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` e retorna o stream de áudio em base64 com reprodução nativa no navegador, sem expor a API Key.

---

## 5. Sessões Conversacionais Seguras (Signed URLs)

Para conversas em tempo real via WebSocket de baixa latência:
- O frontend solicita `POST /api/integrations/elevenlabs/signed-url` ao Helena Gateway.
- O Gateway valida o token JWT do usuário e gera uma **Signed URL efêmera** através da API de Conversational AI da ElevenLabs.
- A conexão WebSocket é aberta diretamente com a URL assinada, garantindo que o segredo mestre permaneça 100% protegido no servidor.
