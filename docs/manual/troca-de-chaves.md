# Guia de Gerenciamento e Proteção de Segredos (SECRETS.md)

Este documento descreve os padrões de governança, injeção e rotação de credenciais de voz e telemetria no ecossistema do **Sistema Helena**, com foco no **Google Cloud Text-to-Speech Chirp 3 HD**.

---

## 1. Princípios Fundamentais de Segurança

1. **Zero Exposição no Frontend:**
   - Nenhuma credencial Google Cloud, chave privada ou token de API deve ser exposto ao navegador, APK móvel, código cliente ou bundles públicos.
   - O consumo de Text-to-Speech ocorre **exclusivamente no servidor backend** (`helena-gateway`).

2. **Proibição de Chaves em Repositório:**
   - Nenhum arquivo `.json` de credencial ou `.env` com valores reais pode ser adicionado ao Git.
   - O arquivo `.gitignore` protege explicitamente:
     ```gitignore
     google-tts.json
     google-service-account.json
     *-service-account.json
     credentials/
     secrets/
     .env
     .env.*
     !.env.example
     ```

3. **Injeção em Memória (Sem Escrita em Disco):**
   - O formato preferencial para a Service Account do Google é **Base64** (`GOOGLE_TTS_CREDENTIALS_B64`).
   - O servidor decodifica o Base64 diretamente em objeto JavaScript na memória RAM na inicialização do singleton, sem criar arquivos temporários em disco.

---

## 2. Inventário de Segredos do Chirp 3 HD

| Nome da Variável | Tipo / Formato | Onde Configurar | Consumidor | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GOOGLE_TTS_CREDENTIALS_B64` | String (Base64) | EasyPanel (App Environment) | `helena-gateway` | JSON completo da Service Account codificado em Base64. |
| `GOOGLE_CLOUD_PROJECT_ID` | String | EasyPanel (App Environment) | `helena-gateway` | ID do projeto no Google Cloud (opcional se contido no JSON). |
| `GOOGLE_CALL_TTS_ENABLED` | Boolean (`true`/`false`) | EasyPanel (App Environment) | `helena-gateway` | Feature flag para ativação do Chirp 3 HD ou rollback imediato. |
| `CALL_TTS_PROVIDER` | String (`google_chirp3_hd`) | EasyPanel (App Environment) | `helena-gateway` | Seletor de provedor para o contexto de chamadas telefônicas. |

---

## 3. Como Gerar o Secret em Base64

No seu terminal local (máquina segura do administrador):

### Opção A — Linux / macOS / WSL:
```bash
base64 -w 0 /caminho/para/sua-chave-service-account.json
```

### Opção B — Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\para\sua-chave-service-account.json"))
```

### Opção C — Node.js:
```bash
node -e "const fs = require('fs'); console.log(fs.readFileSync('chave.json').toString('base64'))"
```

Copie a string resultante e insira na variável `GOOGLE_TTS_CREDENTIALS_B64` no painel do EasyPanel ou no gerenciador de segredos do ambiente.

---

## 4. Procedimento de Rotação Segura de Credencial

Para rotacionar a chave sem causar indisponibilidade nas ligações:

1. **Criar Nova Chave:**
   - Acesse o **Google Cloud Console** > **IAM e administração** > **Contas de serviço**.
   - Selecione a Service Account utilizada para o TTS (com permissão `roles/texttospeech.client`).
   - Na aba **Chaves**, clique em **Adicionar chave** > **Criar nova chave** > **JSON**.
   - Baixe a nova chave no seu computador seguro.

2. **Codificar em Base64:**
   - Converta a nova chave baixada para Base64 usando um dos comandos da Seção 3.

3. **Atualizar no EasyPanel:**
   - Acesse o dashboard do EasyPanel > Projeto Helena > Serviço `helena-gateway` > **Environment**.
   - Atualize o valor de `GOOGLE_TTS_CREDENTIALS_B64` com a nova string.
   - Clique em **Save & Redeploy** (ou Restart).

4. **Validar Operação:**
   - Acesse a rota de diagnóstico: `https://seu-gateway/api/integrations/google-chirp3-hd/status`.
   - Confirme que o status reporta `active: true` e `provider: "google_chirp3_hd"`.
   - Realize uma chamada teste.

5. **Revogar a Chave Antiga:**
   - Retorne ao Google Cloud Console na mesma Service Account.
   - Localize a chave anterior e clique em **Excluir**.
   - A chave antiga estará revogada permanentemente.

---

## 5. Procedimento de Rollback Imediato (Kill-Switch)

Caso ocorra qualquer instabilidade na API do Google Cloud:
1. No painel do EasyPanel, altere:
   ```env
   GOOGLE_CALL_TTS_ENABLED=false
   ```
2. Salve e reinicie o serviço.
3. O roteador (`audio-router.mjs`) imediatamente desvia todo o tráfego de telefonia para o provedor de voz anterior (Kokoro) sem tocar no banco de dados e sem queda de chamadas.
