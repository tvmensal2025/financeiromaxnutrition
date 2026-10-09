# Proposta — ligação do WhatsApp pelo agente de ligação da ElevenLabs (09/10/2026)

> **Só proposta. Nada aqui mexe em produção.** A ligação de dentro do app já usa o agente (ver
> `docs/voz/REGRAS_VOZ_ELEVENLABS.md`, seção 5). Este documento responde à tarefa 6 do
> `docs/releases/COMANDO_VOZ_LIGACAO_20261009.md`: a ligação por WhatsApp (meowcaller + gateway) também pode usar
> o agente?

## Resposta curta

**Pode, mas não pelo caminho "pronto" da ElevenLabs.** A ElevenLabs liga o agente a um telefone de três jeitos
oficiais (documentação conferida no Context7 em 09/10/2026): número da Twilio, tronco SIP e WhatsApp Business
oficial (da Meta). **A nossa linha não é nenhum dos três**: o meowcaller usa uma linha comum de WhatsApp,
pareada pelo celular, e conversa com o gateway por áudio.

O caminho que serve para a linha de hoje é uma **ponte de áudio no gateway**: o gateway recebe a voz da pessoa
do meowcaller, repassa ao agente e devolve a voz do agente ao meowcaller. O número e o meowcaller continuam
os mesmos.

## Como a ligação do WhatsApp funciona hoje (lido no código do gateway, `d159aba`)

| Passo | O que acontece | Onde |
|---|---|---|
| Linha | WhatsApp comum, pareado pelo celular (`/v1/session/pair-phone`), destino `…@s.whatsapp.net` | `src/integrations/meowcaller.mjs` |
| Voz da pessoa | o meowcaller manda PCM16 16 kHz **por fala** (fecha no fim de cada fala) | `POST /api/integrations/voice-agent/user-speech-stream` |
| Entender | o gateway transcreve a fala e monta a resposta com o cérebro dele | `live-transcription.mjs`, `voice-agent.mjs` |
| Voz do personagem | ElevenLabs `eleven_v4_turbo` (créditos de texto) e, sem crédito, Google Chirp 3 HD; sai em PCM 16 kHz | `call-streaming.mjs` → `POST {meowcaller}/v1/calls/{id}/play/stream` |

Ou seja: hoje o WhatsApp gasta **créditos de texto** da ElevenLabs (a cota que acabou em 09/10), não os
**minutos de agente**.

## Opções

### A. Ponte de áudio no gateway (recomendada)

O gateway abre a conversa com o agente do personagem pelo WebSocket da ElevenLabs, com URL assinada pedida no
servidor (a chave nunca sai de lá), do mesmo jeito que a Edge `voice-call-session` faz para o app.

- **Voz da pessoa → agente:** o PCM16 16 kHz que chega do meowcaller vai ao agente como `user_audio_chunk`.
- **Voz do agente → pessoa:** o agente manda áudio em PCM 16 kHz (`pcm_16000`, o padrão dele), que é o mesmo
  formato que o meowcaller já toca. Não precisa converter.
- **Interrupção:** quando a pessoa fala por cima, o agente manda `interruption`; a ponte corta o que estava
  tocando (o `X-Speech-Epoch` que o meowcaller já usa serve para isso).
- **Ficha da pessoa:** `dynamic_variables` e `contextual_update`, como no app. Os agentes continuam com o
  prompt fixo e os overrides fechados.
- **Reserva:** se o agente não abrir (sem minutos, erro) ou cair, a ligação segue no fluxo de hoje do gateway
  (ElevenLabs por texto e, sem crédito, Google Chirp 3 HD).

**O que precisa ser provado antes, com ligação de teste:**

1. **Áudio contínuo.** Hoje o meowcaller manda a voz só enquanto a pessoa fala. O agente decide sozinho quando
   a pessoa terminou e quando foi interrompido, e para isso o ideal é receber o áudio o tempo todo. Ou o
   meowcaller passa a mandar contínuo, ou a ponte preenche o silêncio entre as falas.
2. **Eco.** No app o navegador tira o eco. No WhatsApp, se a voz do agente voltar pelo microfone da pessoa, ele
   pode se interromper sozinho. Testar com viva-voz.
3. **Endereço da URL assinada.** O gateway tem uma função antiga que chama `get_signed_url` (com sublinhado). A
   documentação atual usa `get-signed-url` (com hífen): usar a atual.

**Tamanho do trabalho:** um módulo novo no gateway, com testes, sem tocar em voz, modelo nem na configuração
gerada. O gateway é item fechado da lista única: abrir só com o OK do dono.

### B. WhatsApp Business oficial pela ElevenLabs

A ElevenLabs tem ligação por WhatsApp oficial (`POST /v1/convai/whatsapp/outbound-call`). Ela faz a ligação
inteira e o meowcaller sai do caminho. Em troca:

- precisa de um número WhatsApp Business da Meta ligado à conta da ElevenLabs (não é a linha de hoje);
- a pessoa precisa autorizar a ligação por um modelo de mensagem aprovado pela Meta;
- as variáveis da ficha chegam por um endereço nosso que a ElevenLabs chama no começo da conversa.

É o caminho mais oficial e mais estável no longo prazo, mas é projeto de operação (número, aprovação da Meta),
não só de código.

### C. Telefone comum (Twilio ou SIP)

Só faria sentido com um número de telefone de verdade. O projeto não tem: o "Me ligar no celular" do app é
ligação de WhatsApp.

## Recomendação

1. Primeiro validar a ligação **do app** pelo agente em produção (minutos, fluidez, legenda).
2. Depois, com o OK do dono, fazer a **opção A** no gateway, começando por uma ligação de teste que prove os
   itens 1 e 2 acima.
3. Guardar a opção B para quando o volume de ligações justificar um número oficial.

## Custo

Os minutos de agente são uma cota só para app e WhatsApp. Ligação de WhatsApp tende a durar mais que a do app:
ao ligar o WhatsApp no agente, vale definir um teto de minutos por conta por mês (hoje existe só o limite de
ligações por hora e o teto de 10 minutos por ligação).
