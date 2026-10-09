# Gerenciamento de Vozes Google Cloud Chirp 3 HD para Chamadas (CALL)

> **Documentação de Engenharia e Operação Administrativa**  
> Contexto: Exclusivo para síntese de áudio durante ligações telefônicas (VoIP / Helena Laya / Meowcaller).

---

## 1. Visão Geral da Arquitetura

O sistema de geração de áudio do ecossistema mantém separação estrita por contexto:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          ROTEAMENTO DE ÁUDIO                           │
├───────────────────────┬──────────────────────┬─────────────────────────┤
│ Contexto              │ Motor TTS            │ Finalidade              │
├───────────────────────┼──────────────────────┼─────────────────────────┤
│ CALL (Ligações VoIP)  │ Google Chirp 3 HD    │ Fala durante a chamada  │
│ VARIABLE (WhatsApp)   │ ElevenLabs           │ Áudios dinâmicos        │
│ FIXED (Estáticos)     │ Cloudflare R2 / Cache│ Mensagens prontas       │
│ INTERNO / OFICIAL     │ Kokoro TTS           │ Motor padrão do gateway │
└───────────────────────┴──────────────────────┴─────────────────────────┘
```

A alteração da voz das ligações não afeta em hipótese alguma o WhatsApp, áudios fixos, Kokoro, STT ou o modelo de linguagem DeepSeek.

---

## 2. Como Funciona a Gestão de Vozes no Painel

O painel administrativo dispõe de um módulo dedicado acessível via:
**Configurações** → **Vozes e Ligações (Google Chirp)** ou rota interna `call-voices`.

### Recursos do Painel:
1. **Status e Voz Ativa em Produção:** Exibe a voz atual em execução nas chamadas (ex: `pt-BR-Chirp3-HD-Achernar`), status de ativação (`Ativa` ou `Google Chirp Desabilitado`), idioma (`pt-BR`) e provedor (`google_chirp3_hd`).
2. **Estúdio de Prévia e Teste:**
   - Permite digitar qualquer frase personalizada.
   - Botão **Gerar Prévia da Voz**: requisita ao backend a síntese direta sem gerar ligação telefônica.
   - Player nativo com controle de volume, reprodução instantânea e métricas de latência em milissegundos e codec.
3. **Catálogo Completo pt-BR Chirp 3 HD:**
   - 40 vozes oficiais catalogadas (23 femininas, 17 masculinas).
   - Botão **Atualizar do Google** com suporte a descoberta dinâmica via API e fallback resiliente.
   - Filtros de visualização: *Todas*, *Femininas* e *Masculinas*.
4. **Ativação sem Redeploy (Hot-Swap):**
   - Ao clicar em **Usar esta voz nas ligações**, o backend altera imediatamente a voz em memória RAM e persiste o valor no Supabase (`configuracao`).
   - A alteração entra em vigor instantaneamente no próximo turno telefônico sem reiniciar o servidor.
5. **Restauração de Voz Anterior:**
   - O painel preserva o histórico da última voz ativa.
   - Botão **Restaurar voz anterior** permite desfazer a troca com 1 clique.

---

## 3. Fluxo de Segurança (Nenhum Secret no Frontend)

O frontend nunca recebe e nunca armazena:
- `GOOGLE_TTS_CREDENTIALS_B64`
- `private_key` ou `client_email` da Service Account
- Tokens de acesso ou headers de autorização do Google

### Diagrama de Comunicação:

```text
[ Navegador / Painel Admin ]
             │ (JWT do Supabase Auth / RBAC Admin)
             ▼
[ Backend: /api/integrations/google-chirp3-hd/* ]
             │
             ├── Validação de Permissão (ADMIN / ADMIN_MAX)
             ├── Registro de Auditoria (quem, quando, voz anterior, voz nova)
             ▼
[ Google Cloud Text-to-Speech API ] (Credencial em memória do Gateway)
             ▼
[ Retorno: Apenas áudio codificado em Base64 e métricas públicas ]
```

---

## 4. Onde Ficam Armazenados os Dados

### ✅ Armazenado no Banco / Cache:
- `voice_name`: Nome da voz (ex: `pt-BR-Chirp3-HD-Aoede`)
- `language`: `pt-BR`
- `provider`: `google_chirp3_hd`
- `updated_at`: Timestamp ISO da última alteração
- `updated_by`: Identificador do administrador que realizou a alteração
- `previous_voice`: Nome da voz anterior para rollback imediato

### ❌ TERMINANTEMENTE PROIBIDO no Banco:
- Service Account JSON
- Private Keys
- Tokens do Google Cloud

---

## 5. Endpoints Disponíveis no Gateway

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/integrations/google-chirp3-hd/status` | Retorna status do serviço, voz ativa, voz anterior e flag `can_restore` |
| `GET` | `/api/integrations/google-chirp3-hd/voices?refresh=true` | Lista catálogo de vozes pt-BR Chirp 3 HD |
| `POST` | `/api/integrations/google-chirp3-hd/preview` | Sintetiza áudio de teste no navegador |
| `POST` | `/api/integrations/google-chirp3-hd/set-voice` | Define e persiste a nova voz padrão de chamadas |
| `POST` | `/api/integrations/google-chirp3-hd/restore-voice` | Restaura a voz anterior em produção |
| `GET` | `/api/integrations/google-chirp3-hd/custom-voice-status` | Verifica elegibilidade para Instant Custom Voice |
