# Google Cloud Chirp 3 Instant Custom Voice

> **STATUS OFICIAL:** DESABILITADO POR DECISÃO DE PRODUTO  
> **MOTIVO:** Não será utilizado neste projeto. O ecossistema opera exclusivamente com o catálogo oficial do Google Cloud Chirp 3 HD.  
> **CLASSIFICAÇÃO:** Não constitui pendência do sistema (recurso fora de escopo).

---

## 1. Decisão de Arquitetura e Produto

Por decisão estratégica de produto, a funcionalidade de clonagem de voz (**Google Chirp 3 Instant Custom Voice**) foi descontinuada e desabilitada do painel administrativo.

O fluxo de telefonia (CALL) opera exclusivamente com o modelo oficial **Google Cloud Chirp 3 HD** em português brasileiro (com a voz ativa oficial `pt-BR-Chirp3-HD-Achernar` e catálogo dinâmico de 40 vozes homologadas), garantindo estabilidade, conformidade ética e latência telefônica ideal.

---

## 2. Painel Administrativo Focado e Limpo

O painel administrativo em `Configurações` → `Vozes e Ligações (Google Chirp)` concentra-se estritamente na gestão do **Google Chirp 3 HD**:
- Visualização da voz ativa em produção;
- Catálogo de vozes pt-BR Chirp 3 HD disponíveis;
- Teste e prévia de frases personalizadas no navegador (sem chamadas telefônicas reais);
- Seleção e ativação da voz de chamadas com hot-swap (sem redeploy);
- Restauração de voz anterior com 1 clique;
- Telemetria de latência e consumo em tempo real.

---

## 3. Preservação dos Demais Motores de Áudio

A desativação do Instant Custom Voice não afeta nenhum outro subsistema:
- **CALL:** Google Cloud Chirp 3 HD (100% operacional)
- **WhatsApp / Áudios Dinâmicos:** ElevenLabs (100% intacto)
- **Áudios Fixos / Cache:** Cloudflare R2 (100% intacto)
- **Motor Oficial Interno:** Kokoro TTS (100% intacto)
- **Inteligência / LLM:** DeepSeek-V4.1-Flash (100% intacto)
- **Reconhecimento de Fala:** ElevenLabs Scribe / Whisper (100% intacto)
