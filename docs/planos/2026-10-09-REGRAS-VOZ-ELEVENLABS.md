# Regras de voz — ElevenLabs (eLiving) — OBRIGATÓRIAS

> Decisão do dono (06/10/2026): "Tudo tem que usar a versão V4, a mais recente da ElevenLabs API, e usar
> as tags de áudio [ ] para emoção, reações e ritmo." Vale para recados, ligações, agentes, alarmes,
> saudações, dicas e qualquer áudio novo. Nenhuma ferramenta (Claude, Codex, Antigravity) pode
> contrariar estas regras.
>
> Fonte técnica conferida em 06/10/2026: API `GET /v1/models` da conta e documentação oficial
> (Context7 `/websites/elevenlabs_io`): "Eleven v4 and Eleven v3 support audio tags. We recommend Eleven
> v4." / "For real-time applications, Eleven v4 Turbo (`eleven_v4_turbo`) also supports audio tags."
> V4 não usa SSML `<break>`: pausa é tag `[pause]` ou pontuação.

Mapa deste documento: 1 Modelo · 2 Voz de cada personagem (e vozes aposentadas) · 3 Tags de áudio ·
4 Checklist · 5 Ligação (agente de ligação e reserva) · 6 Áudios antigos a regravar · 7 Naturalidade e anti-repetição
(regra permanente: áudio nunca chato nem repetitivo).

## 1. Modelo (fonte única: `supabase/functions/_shared/voice/elevenlabsConfig.ts`)

| Uso | Modelo | Por quê |
|---|---|---|
| Áudio gravado/gerado (recados do dia, saudações com nome, dicas, alarmes, histórias, catálogos novos) | **`eleven_v4`** | o mais emotivo da ElevenLabs, aceita tags |
| Tempo real (ligações, agentes de voz, respostas ao vivo) | **`eleven_v4_turbo`** | V4 com baixa latência e metade do custo por caractere; aceita tags |

- **Proibido em uso novo:** `eleven_multilingual_v2`, `eleven_v3`, `eleven_v3_conversational`,
  `eleven_flash_*`, `eleven_turbo_*`. Nada de modelo escrito "solto" no código: sempre a constante
  da fonte única.
- **Exceção (histórico):** catálogos de áudios JÁ gravados (`*AudioCatalog.json/.ts`) guardam o
  modelo com que foram gerados (`model_id`): é registro de procedência — não alterar. Ao regravar,
  usa-se V4 e o catálogo novo registra V4. Os 12 alarmes não têm metadados: a procedência deles está
  na seção 6.
- **Novo modelo da ElevenLabs:** só trocar depois de conferir `GET /v1/models` e a documentação
  (Context7), e atualizando só a fonte única.

## 2. Voz de cada personagem (uma só voz por personagem, em todo lugar)

Vozes e padrões **salvos pelo dono em 06/10/2026** ("ficou bom, salve esse modelo e os outros, e delete
os antigos para nunca mais misturar"). O padrão (estabilidade · semelhança · estilo · speaker boost ·
velocidade) vai em TODA geração, gravada ou ao vivo, e vem só da fonte única (`voiceFor` devolve voz,
modelo e padrão). As tags de emoção valem por cima do padrão.

> **Decisão posterior do dono (06/10/2026): as vozes antigas FICAM na conta ElevenLabs. Não apagar e não
> mandar apagar.** O "delete os antigos" vale só para o sistema: app, funções, scripts e ligação nunca
> usam uma voz aposentada (o guardião automático barra). Limpar a conta, se um dia fizer sentido, é
> escolha do dono.

| Personagem | Voz (ID) | Nome na conta | Padrão aprovado | Observação |
|---|---|---|---|---|
| Sirlene | `eabgQyq9no9rW5ZiGiaZ` | "Sirlene Correa" (clone pt-BR) | 0,49 · 0,19 · 0,11 · sim · 1,16 | Padrão da amostra aprovada. Os ~2.700 áudios antigos (saudações com nome e dicas) foram gravados com a voz legada "Uneskee": continuam como estão até serem regravados (seção 6). |
| Alex | `TX3LPaxmHKxFdv7VOQHJ` | "Liam" | 0,50 · 0,75 · 0 · sim · 1,00 | Padrão da amostra aprovada. |
| Dr. Vital | `IKpiSijWzlhOL6uX83EH` | "Will - institutional" (brasileiro) | 0,35 · 0,30 · 0 · sim · 1,08 | Padrão da amostra aprovada. |
| Rafael | `B4raRyOeSoCr40rqvhFE` | "Rafael Ferreira Das" (clone) | **Padrão B (calmo e grave)**: 0,75 · 0,90 · 0 · sim · 0,92 | Escolhido pelo dono; também salvo como padrão da voz na conta (antes: 0,37 · 1,0 · 0,48 · 1,03). Substitui "Daniel" e corrige o app, que usava a voz do Alex. |
| eLiving (dono) | a definir | — | — | Recados com quem fala = eLiving: voz do dono quando houver clone aprovado; até lá, gravação própria ou a voz da Sirlene. Sem ligação. |

Amostras de aprovação em `eleven_v4` com tags geradas em 06/10/2026 (Sirlene, Alex, Dr. Vital, Rafael).

**Nota oficial do V4 sobre o padrão** (documentação da ElevenLabs "What is Eleven v4?" e `GET /v1/models`,
conferidos em 06/10/2026): no `eleven_v4` e no `eleven_v4_turbo` só **estabilidade** e **semelhança**
mudam o som. **Estilo** e **speaker boost** não valem (a API devolve `can_use_style=false` e
`can_use_speaker_boost=false`) e a **velocidade não é garantida**. Os cinco campos continuam sendo
enviados em toda geração: são o padrão aprovado pelo dono, não atrapalham e voltam a valer se o modelo
mudar. O ritmo e a emoção vêm da pontuação e das tags, não dos campos de estilo e velocidade.

**Agentes de ligação ElevenLabs, migrados em 06/10/2026 com o OK do dono:** "eLiving Sirlene", "eLiving
Alex", "eLiving Dr. Vital" e "eLiving Rafael" (antes "Max …"), todos em `eleven_v4_turbo`, com a voz e o
padrão acima (o agente aceita estabilidade, semelhança e velocidade), primeira fala com tags e prompt
eLiving (mentor, nunca coach). Os IDs dos agentes não mudaram. **Desde a decisão do dono de 09/10/2026 a
ligação de dentro do app fala por estes agentes** (seção 5); a ligação por WhatsApp ainda passa só pelo
Helena Gateway. Conferir a qualquer momento (só
leitura): `node --experimental-strip-types scripts/ensure-character-voice-agents.mjs`. Gravar na conta
(inclusive a proteção do agente: só entra com URL assinada e ninguém troca prompt, primeira fala ou idioma
por fora) é ação em produção: só com `--confirm-production` e o OK do dono. Cópia da configuração anterior
guardada fora do projeto no dia da migração.

### Vozes aposentadas (nunca usar; continuam na conta)

Todas listadas em `LEGACY_VOICE_IDS` na fonte única. Ficam na conta ElevenLabs por decisão do dono (não
apagar); o sistema só nunca as usa.

| ID | Nome | Observação |
|---|---|---|
| `EJV7H2baGt5ab95tOoSG` | Uneskee | legado dos áudios antigos da Sirlene (saudações com nome, dicas e 6 alarmes), até serem regravados |
| `onwK4e9ZLuTAKqWW03F9` | Daniel | provisória antiga do Rafael, substituída pelo clone do Rafael |
| `pNInz6obpgDQGcFmaJgB` | Adam | teste antigo de voz do Dr. Vital |
| `21m00Tcm4TlvDq8ikWAM` | Janet (antes chamada "Rachel") | teste antigo de voz |
| `EXAVITQu4vr4xnSDxMaL` | Sarah | teste antigo de voz |
| `ErXwobaYiN019PkySvjV` | Adam (ID antigo; antes chamada "Antoni") | teste antigo de voz |
| `IKne3meq5aSn9XLyUdCD` | Charlie | teste antigo de voz |
| `TnTLMCssIRFcYx8EjsS3` | voz de teste do gerador de coach | não existe mais na biblioteca |
| `bIHbv24MWmeRgasZH58o` | Will - Relaxed Optimist | teste antigo de boas-vindas; NÃO é a voz do Dr. Vital |
| `YKrm0N1EAM9Bw27j8kuD` | Leónidas | candidata antiga do Alex |
| `gzwoRNUxuPTaJkY1fixX` | Felipe Machado Justo | candidata antiga do Alex |
| `lUaTJLTsNnLQQ5G5LJen` | Clone Tomaz | candidata antiga do Alex |

Os 46 scripts antigos de geração e teste que usavam modelos e vozes velhas foram removidos em
06/10/2026 (ficam no histórico do git). Gerar áudio novo: script novo que use `voiceFor` da fonte única.
As duas páginas de teste que apresentavam a voz legada como "oficial" (`public/duelo-sirlene.html` e
`public/test_audio_system_preview.html`) também foram removidas em 06/10/2026 (ficam no histórico do git).

### Guardião automático

`src/lib/voice/__tests__/vozSemLegado.test.ts` varre `src/`, `supabase/functions/`, `scripts/` e as
páginas `.html` de `public/` (somente leitura; sem `public/audio` nem `public/models`) e falha se
aparecer modelo antigo, voz aposentada, ID de voz solto no app/funções ou geração de voz que não use a
fonte única. Exceções conscientes: a fonte única, os catálogos JÁ gravados (procedência) e os testes da
própria fonte. Rascunhos locais ignorados pelo git (`public/teste-*.html`) ficam fora da varredura; se
existirem no seu computador com voz antiga, apague-os de lá.

## 3. Tags de áudio (colchetes) — regra do dono

- Toda fala gerada para a ElevenLabs leva tags **entre colchetes** `[tag]`, em inglês, antes ou depois
  do trecho que modificam. **Nunca chaves `{}` no texto enviado à voz.**
- As variáveis do app (`{nome}`, `{sequencia}`…) são resolvidas ANTES de enviar à ElevenLabs; o texto
  final que vai para a voz só tem colchetes. As tags não atrapalham as variáveis: `{nome}` ausente depois
  de uma tag não deixa vírgula solta e a frase recomeça em maiúscula depois da tag
  (`[thoughtful] {nome}, sete dias.` sem nome vira `[thoughtful] Sete dias.`).
- Na TELA, as tags são removidas (`stripAudioTags`): o aluno lê o texto limpo e ouve o áudio expressivo.
  O Admin de recados mostra a prévia e o "Venceria" já sem as tags.
- Se a fala cair no provedor reserva (Google Chirp), as tags são removidas antes (`sanitizeTtsText`),
  senão a voz leria "[laughs]" em voz alta.
- **Até 5 tags por fala** (`MAX_AUDIO_TAGS_POR_FALA`, decisão do dono de 09/10/2026; antes eram 3); não repetir a mesma tag seguida; pausas com `[pause]`/`[short pause]`.
- O Admin de recados **avisa** (sem bloquear o salvamento) tag desconhecida ou proibida com o aluno e
  mostra, ao lado do texto, as tags preferidas de quem fala (`validateAudioTags` e `SPEAKER_TAG_PALETTE`).

### Tags do dono

1. Emoções e tom: `[whispers]` · `[shouts]` `[yelling]` · `[laughing]` `[laughs]` · `[sighs]` `[sighing]`
   · `[crying]` `[tearfully]` · `[excited]` `[enthusiastic]` · `[nervously]` `[cautiously]` ·
   `[angry]` `[frustrated]` · `[sarcastic]` `[deadpan]` · `[curious]` `[thoughtful]`
2. Reações: `[clears throat]` · `[gasps]` · `[giggles]` · `[groans]` · `[snickers]` `[stifling laughter]`
3. Ritmo: `[pause]` · `[short pause]`

**Sobre `[pause]`:** a lista de exemplos da documentação oficial da ElevenLabs traz `[short pause]` e
`[long pause]`, não `[pause]`, e diz que a lista não é exaustiva (o modelo interpreta outras tags). A
`[pause]` fica por ser do dono e por já estar nas paletas e nos recados; conferir de ouvido nas amostras.
Na dúvida, prefira `[short pause]`.

### Voz viva (decisão do dono, 09/10/2026) — substitui a antiga tabela de proibidas

**Todas as tags do dono estão liberadas com o aluno**, inclusive bronca e deboche (`[angry]`,
`[frustrated]`, `[sarcastic]`, `[deadpan]`, `[groans]`, `[snickers]`, `[stifling laughter]`), choro
(`[crying]`, `[tearfully]`) e grito sem precisar de comemoração (`[shouts]`, `[yelling]`). Objetivo do
dono: a voz com mais emoção e mais viva; ele ajusta com o tempo.

- A bronca e a provocação são **de quem se importa**: nunca humilhar a pessoa (peso, corpo, aparência).
- Para voltar a proibir uma tag: acrescentar `{ tag, motivo }` em `FORBIDDEN_WITH_STUDENT`
  (`supabase/functions/_shared/voice/elevenlabsConfig.ts`) e rodar `scripts/sync-voice-config-gateway.mjs`.
- As paletas por personagem (`SPEAKER_TAG_PALETTE`) ganharam emoção própria (ex.: Alex com `[angry]`,
  `[sarcastic]`, `[groans]`; Sirlene com `[sarcastic]`, `[gasps]`), mantendo as tags antigas.

O texto falado também passa pelo verificador de tom (`checkRecadoTone`, que ignora as tags): além de
vergonha, culpa, comparação e ameaça, ele avisa as expressões de cobrança ("arrumando desculpa", "hora de
desculpa", "sem desculpas", "historinha", "furou a dieta", "empurrando", "postergando", "mimimi",
"preguiça", "negligência", "desleixo", "sem tolerância"). A palavra solta "desculpa" não dispara aviso.

Paleta por personagem (preferência, não limite rígido):

- **Sirlene:** `[laughs]` `[giggles]` `[curious]` `[thoughtful]` `[whispers]` (cumplicidade) `[short pause]`
- **Alex:** `[excited]` `[enthusiastic]` `[laughs]` `[shouts]` (só comemoração) `[short pause]`
- **Dr. Vital:** `[clears throat]` `[thoughtful]` `[cautiously]` `[curious]` `[pause]`
- **Rafael:** `[thoughtful]` `[pause]` `[whispers]` (intimidade) `[sighs]` (alívio) `[laughs]`
- **eLiving (dono):** `[thoughtful]` `[pause]` `[laughs]` `[whispers]` `[excited]`

Exemplos no tom eLiving:

- "[thoughtful] Maria, sete dias seguidos. [pause] Isso já não é força de vontade, é rotina ganhando forma."
- "[excited] Fala, Maria! Seis mil passos hoje. [laughs] Teu corpo agradece."
- "[clears throat] Maria, aqui é o Dr. Vital. [short pause] Um copo de água agora já é um começo."
- "[whispers] Posso te contar uma coisa? [pause] Eu reparei que a alimentação é o seu ponto forte."

## 4. Checklist antes de gerar qualquer áudio

1. Modelo vem da fonte única (`eleven_v4` gravado, `eleven_v4_turbo` tempo real).
2. Voz e padrão vêm da tabela da seção 2 via `voiceFor` (nunca ID ou ajuste solto); envie
   `voice_settings` sempre.
3. Texto com variáveis já resolvidas; só colchetes; tags permitidas (validador `validateAudioTags`).
4. Texto passou no verificador de tom (`checkRecadoTone`), que ignora as tags.
5. Saldo de caracteres conferido (`GET /v1/user/subscription`); V4 Turbo custa metade.
6. Ação em produção (agentes, R2, Edge, gateway) só com OK do dono.
7. Fala nova ou reescrita: conferida na seção 7 (naturalidade). O guardião
   `src/lib/audio/__tests__/naturalidade.test.ts` reprova o molde repetido.

## 5. Ligação (agente de ligação da ElevenLabs e reserva)

> **Decisão do dono (09/10/2026):** "Está usando errado: temos que usar o **agente de ligação**; temos mais de
> 200 minutos disponíveis." A ligação usa os agentes de ligação da ElevenLabs (um por personagem,
> `eleven_v4_turbo`). O agente fala e escuta ao mesmo tempo (interrupção) e interpreta as tags `[ ]`.
> **O Google Chirp 3 HD só entra quando os minutos do agente acabam ou o agente falha.**
>
> **FECHADO em 09/10/2026.** O selo `src/features/voice-call/__tests__/ligacaoPeloAgente.selo.test.ts` falha se
> alguém mexer nos arquivos desta ligação. Só se reabre com um teste que falha provando o defeito **e** o OK do
> dono (AGENTS.md, regra 7). Depois: `node scripts/selo-ligacao-agente.mjs --gravar --motivo "<item e OK>"`.

### 5.1 Ligação dentro do app: agente primeiro

**Caminho:** app → Edge `voice-call-session` (login obrigatório, `verify_jwt = true`) → ElevenLabs → o app
conversa com o agente pelo SDK oficial `@elevenlabs/client` (`src/features/voice-call/agentCall.ts`).

- **O servidor escolhe o agente.** O app manda só o personagem e o modo. O mapa personagem → agente fica em
  `supabase/functions/_shared/voice-call/characters.ts`; `agent_id` vindo do app não é lido.
- **A chave da ElevenLabs fica só no servidor** (segredo `ELEVENLABS_API_KEY` das Edge Functions). O app recebe
  um acesso temporário: token de conversa (WebRTC, padrão) ou URL assinada (WebSocket, com
  `ELEVENLABS_AGENT_TRANSPORT=websocket`).
- **O prompt do agente é fixo** e os overrides são fechados (seção 2). A ficha da pessoa vai como contexto
  (`contextUpdates`) e variáveis (`dynamicVariables`: `personagem`, `tom`, `nome_pessoa`), nunca como troca de
  prompt. A ficha é o `context` de `buildCallPersona`: conduta da ligação, modo, os dados lidos da base e, por
  último, a memória (com teto menor). A ordem importa: se a ficha passar do teto ela é resumida pelo fim.
- **Sem ficha, sem agente.** Se a ficha não fica pronta em 5 segundos, a ligação segue pela reserva. Se o que
  falha é só a leitura dos dados, a ficha vai com a conduta e o aviso "a base não respondeu, não invente": o
  agente abre e não inventa. No app, ficha que não chega ao agente (falha de envio) encerra a conversa.
- **Legenda sem tags.** A fala do agente chega com as tags e a tela remove (`stripAudioTagsForDisplay`). Quando
  a pessoa interrompe, a legenda fica só com o que o agente chegou a dizer.
- **Minutos protegidos.** A conversa do agente é encerrada quando a pessoa desliga, sai da tela, vai para a
  aba "Me Ligar no Celular" ou liga de novo, e quando a conversa abre atrasada. Cada ligação tem teto de 10
  minutos, no agente e também no app: ao chegar nele a ligação termina. Sem a pessoa falar por 90 segundos o
  agente encerra (depois de os ajustes serem gravados na conta). Cada conta abre 10 ligações por hora
  (`VOICE_AGENT_CALLS_PER_HOUR`; contam todas, pelo agente ou pela reserva); acima disso a ligação segue pela
  reserva. **O agente só abre com a medição gravada**: sem ela, reserva.
- **Medição:** a Edge `voice-call-end` grava a duração em `voice_calls`, com o id da conversa da ElevenLabs e o
  motivo do fim (inclusive o motivo de ter ido para a reserva). A duração é da ligação inteira; os minutos
  pagos de verdade são os do painel da ElevenLabs.
- **Desligar o agente sem publicar o app:** segredo `VOICE_CALL_AGENT=off` nas Edge Functions. A ligação passa
  a abrir direto pela reserva.

**Ajustes de conversa dos agentes** (`scripts/ensure-character-voice-agents.mjs`; conferidos na documentação
da ElevenLabs pelo Context7 em 09/10/2026):

| Ajuste | Valor | Para quê |
|---|---|---|
| `tts.model_id` | `eleven_v4_turbo` | a documentação recomenda este modelo para agentes: "the most expressive delivery"; aceita as tags |
| `turn.turn_eagerness` | `eager` | o agente responde na primeira brecha. Se cortar quem fala devagar, voltar a `normal` |
| `turn.silence_end_call_timeout` | `90` | sem a pessoa falar por 90 s o agente encerra (o padrão é nunca encerrar) |
| `conversation.client_events` | `audio`, `interruption`, `user_transcript`, `agent_response`, `agent_response_correction`, `agent_tool_response` | legenda do app (os três do meio); o último só serve se o agente tiver a ferramenta de encerrar a ligação, que o script não liga |
| `conversation.max_duration_seconds` | `600` | teto de cada ligação |
| `platform_settings.auth.enable_auth` | `true` | só entra quem tem acesso temporário pedido pelo servidor |
| `platform_settings.overrides` | as 20 chaves em `false` | ninguém troca roteiro, primeira fala, idioma, cérebro, ferramentas, voz, modelo ou duração por fora |
| `platform_settings.call_limits.bursting_enabled` | `false` | o padrão deixa passar da concorrência do plano cobrando o dobro |

O script configura **o agente que a ligação usa**: o id do segredo `ELEVENLABS_AGENT_<NOME>` (lido do ambiente
de quem roda o script) ou, sem segredo, o do mapa do servidor. Se esse id não existe na conta e há um agente
com o nome do personagem e outro id, o DRY-RUN mostra ATENÇÃO e a gravação é recusada.

O script **não troca o cérebro (LLM)** do agente; o DRY-RUN com a chave mostra qual é e se o modo expressivo
está ligado. Não foram alterados: `suggested_audio_tags` (a documentação fala em modelos v3),
`speculative_turn` (pode aumentar o custo do cérebro), `optimize_streaming_latency` (a documentação diz que o
campo não faz mais nada), a ferramenta de encerrar a ligação e a configuração de privacidade (retenção e
gravação do áudio), que é decisão do dono.

**No modelo v4 a velocidade da voz não é garantida** (a documentação diz que o controle de velocidade não
existe no Eleven v4). O script continua mandando o padrão do dono; quem dá o ritmo são a pontuação e as tags.

**Padrão de voz:** os padrões de cada personagem são escolha do dono (seção 2) e não mudaram.

### 5.2 Reserva: Helena Gateway (sem mudança)

A ligação segue pelo gateway, sem a pessoa religar, quando:

- o servidor avisa que não há agente: sem minutos, sem chave, agente desligado, erro da ElevenLabs, ElevenLabs
  ocupada, limite por hora, medição que não gravou ou ficha que não ficou pronta;
- a Edge não responde em 8 segundos ou o agente não abre em 20 segundos (contando o download do SDK; no Android
  o SDK espera 3 segundos fixos antes de conectar);
- o download do SDK falha (o app não recarrega: segue pela reserva);
- a conversa conecta e **o agente não fala em 10 segundos**, ou cai **antes de ele falar** (é assim que a falta
  de minutos ou uma recusa do servidor costuma aparecer);
- a ficha não chega ao agente.

**Queda depois de o agente já ter falado não vai para a reserva:** a ligação termina com o aviso "A ligação
caiu. Ligue de novo." No WebRTC a queda de rede e o fechamento da conversa pelo servidor chegam iguais ao app;
recomeçar pela reserva daria outra saudação no meio da conversa. A ligação seguinte já abre pela reserva se o
agente continuar fora.

**Caminho:** app → **Helena Gateway** (`services/helena-gateway` do repositório `financeiromaxnutrition`,
roteador `audio-router`). É o caminho por turnos que já existia; o gateway não mudou.

**Ordem de voz no gateway, regra do dono (06/10/2026):**

1. **Primeiro, sempre, a ElevenLabs `eleven_v4_turbo`** com a voz e o padrão do PERSONAGEM da ligação
   (`voiceFor(personagem, 'tempoReal')`), com tags de áudio entre colchetes.
2. **Google Cloud Chirp 3 HD é só RESERVA** e entra **somente** quando acabam os créditos/minutos da
   ElevenLabs (HTTP 429 / cota esgotada) ou ela falha. Antes de ir ao Google, as tags `[ ]` saem
   (`sanitizeTtsText(texto, 'google')`), senão a voz leria "[laughs]" em voz alta.

**Voz Google de reserva: uma por personagem, sem repetir, sem trocar por modo** (`GOOGLE_FALLBACK_VOICES`
na fonte única):

| Personagem | Voz Google (reserva) |
|---|---|
| Sirlene | `pt-BR-Chirp3-HD-Achernar` |
| Alex | `pt-BR-Chirp3-HD-Alkaid` |
| Dr. Vital | `pt-BR-Chirp3-HD-Charon` |
| Rafael | `pt-BR-Chirp3-HD-Achird` |

(eLiving, o dono, não tem ligação.)

**Uma voz por personagem nos DOIS provedores:** a voz depende só do PERSONAGEM da ligação. Nunca de uma
voz Google escolhida no painel nem de uma voz salva no aparelho: o painel não troca voz.

**Configuração do gateway gerada, nunca à mão:** o gateway não guarda ID, modelo nem padrão soltos. O
arquivo `src/integrations/eliving-voice-config.mjs` do gateway é gerado a partir da fonte única por
`node --experimental-strip-types scripts/sync-voice-config-gateway.mjs` (com `--check` só confere e sai 1
se estiver diferente). Mudou voz, padrão, modelo ou tag na fonte única: rode o script e publique o gateway.

**Publicar o gateway é produção, só com OK do dono:** o Easypanel publica a partir da `main` do GitHub do
repositório `financeiromaxnutrition`; merge ou push na `main` de lá publica. A correção da ligação
(`voz-eliving-v4`) foi publicada em 09/10/2026 (ver a lista única).

**Conferido na documentação oficial do Google (Chirp 3: HD, 09/10/2026):** são 30 vozes, com nome no formato
`<idioma>-Chirp3-HD-<voz>`, e `pt-BR` é atendido. Em streaming o Google aceita PCM, ALAW, MULAW e OGG_OPUS (o
gateway usa PCM 16 kHz) e não aceita SSML (o gateway manda texto puro, sem as tags). Pausa por marcação
(`[pause]`, `[pause short]`, `[pause long]`) só vale no campo `markup`, que o gateway não usa.

> **PENDÊNCIA DO DONO (achada em 09/10/2026): a voz de reserva do Alex não existe no Google.**
> `pt-BR-Chirp3-HD-Alkaid` não está entre as 30 vozes da documentação oficial nem no catálogo validado do
> gateway. As outras três existem (Achernar, Charon, Achird). Como o gateway repassa o nome sem conferir e não
> tem outra saída depois do Google, **a ligação do Alex pela reserva tende a ficar sem voz**. Não foi possível
> testar ao vivo (esta máquina não tem a credencial do Google). Trocar voz é escolha do dono: escolher uma das
> 14 masculinas livres (Algenib, Algieba, Alnilam, Enceladus, Fenrir, Iapetus, Orus, Puck, Rasalgethi,
> Sadachbia, Sadaltager, Schedar, Umbriel, Zubenelgenubi), trocar a linha `alex` em `GOOGLE_FALLBACK_VOICES`,
> rodar `scripts/sync-voice-config-gateway.mjs` e publicar o gateway. O guardião
> `src/lib/voice/__tests__/vozReservaGoogleOficial.test.ts` mantém a pendência à vista e barra qualquer outra
> voz fora da lista oficial.

### 5.3 Ligação por WhatsApp (meowcaller)

Passa só pelo gateway (créditos de texto da ElevenLabs e, sem crédito, Google). Ligar o agente nela é a
proposta de `docs/voz/PROPOSTA_LIGACAO_WHATSAPP_PELO_AGENTE_20261009.md`; nada foi mudado.

### 5.4 Conferir a conta e gravar os ajustes dos agentes

```
# Só leitura: mostra voz, modelo, padrão, prompt, proteção, ajustes de conversa e o cérebro de cada agente.
node --experimental-strip-types scripts/ensure-character-voice-agents.mjs

# Grava na conta. Produção: só com o OK do dono.
node --experimental-strip-types scripts/ensure-character-voice-agents.mjs --confirm-production
```

A chave entra só pelo ambiente (`ELEVENLABS_API_KEY`), nunca em arquivo nem no chat.

## 6. Áudios antigos a regravar

Gravados antes da V4 e ainda em uso, até serem regravados em `eleven_v4` com `voiceFor` (só com o OK do
dono: custo e produção; confira o saldo de caracteres antes):

1. **Saudações com nome e dicas da Sirlene** (~2.700 áudios): voz legada "Uneskee".
2. **Os 12 alarmes de hábito** (`HABIT_ALARM_CLIPS` em `src/services/native-reminders/alarmCatalog.ts`).
   Os MP3 não guardam metadados de modelo nem de voz: a procedência é este registro.

| Alarmes | Voz e modelo com que foram gravados |
|---|---|
| Sirlene (6): `sirlene_alarm_water`, `_water_nudge`, `_craving`, `_craving_nudge`, `_challenge`, `_challenge_nudge` | voz legada "Uneskee" + `eleven_v3` |
| Alex (2): `alex_alarm_mission`, `alex_alarm_mission_nudge` | `eleven_multilingual_v2` |
| Dr. Vital (4): `vital_alarm_sleep`, `_sleep_nudge`, `_weight`, `_weight_nudge` | `eleven_multilingual_v2` |

**Pendência do dono:** os MP3 de `sirlene_alarm_water_nudge` e `alex_alarm_mission_nudge` ainda dizem o
**texto antigo** (que cobrava: "não é legal ficar empurrando a hidratação" e "uma hora de desculpa"). No
código o texto já é o acolhedor e curto; ao regravar, use o texto do catálogo. Em `alex_alarm_mission` só
a pontuação mudou (uma exclamação a menos, mesmas palavras): o MP3 segue valendo. Depois de regravar, rode
`npm run alarm:sounds` para levar os arquivos aos apps nativos.

## 7. Naturalidade e anti-repetição (regra permanente do dono, 06/10/2026)

> Decisão do dono (06/10/2026): "sempre os áudios podem ser mais normais, sem ser chatos e repetitivos; use
> estratégias" e "os treinos estão chatos, muito repetitivos". Vale para TODO áudio novo ou reescrito, de
> qualquer personagem (roteiros V4 em `supabase/functions/_shared/audio/roteiros/`, recados, alarmes,
> ligações). Quem escreve uma fala pensa em como uma pessoa de verdade falaria aquilo, a décima vez que
> fala.

**Por que:** o diagnóstico medido nos roteiros de 06/10/2026 mostrou o molde repetido. Na imersão do Alex,
98 de 227 falas começavam com "Agora vamos para o…!" e 156 começavam com `[enthusiastic]`; quase toda fala
do Alex abria com `[excited]` ou `[enthusiastic]` e terminava em "!"; os marcos de corrida seguiam um molde
só ("X quilômetros concluídos! …"). Ouvido em série, isso cansa e soa robô.

### 7.1 As 6 estratégias (aplique e confira com números)

1. **Abertura variada.** Varie o começo das falas: afirmação do benefício, comando direto e curto, pergunta,
   contexto, transição ("Próximo:", "Troca de aparelho:", "Chegou a vez do…", "Hora do…", "Seguimos com…",
   "Bora de…") ou começar pelo nome do exercício. Nunca o mesmo molde em série.
2. **Emoção onde ela acontece.** A tag nem sempre vai no início, e nem toda fala leva `[excited]` ou
   `[enthusiastic]`. Fala técnica ou de instrução pode levar só ritmo (`[short pause]`) ou `[thoughtful]` e
   `[curious]` quando a paleta do personagem tem. Comemoração com emoção alta só quando há conquista real.
3. **Pontuação humana.** Exclamação só quando cabe (no máximo metade das falas da categoria), frases de
   tamanhos diferentes, vírgulas como respiração, fala de pessoa real em pt-BR natural. Gírias do Alex
   ("bora", "segura", "beleza") com moderação, nunca a mesma em série.
4. **Variantes alternadas para o que toca MUITAS vezes** (por sessão ou todo dia): 3 versões com palavras e
   começos diferentes e o mesmo sentido (seção 7.3). O app alterna sem repetir a anterior (seção 7.4).
5. **Sem duplicata.** Nenhuma fala do mesmo personagem com o mesmo texto (sem tags) de outra. Variantes não
   compartilham as 3 primeiras palavras e diferem em mais da metade das palavras.
6. **Continuam valendo** as regras de sempre: 1 a 2 tags por fala (chamada de nome e "Olá." continuam
   NEUTRAS: 0 tags e sem "!"), só tags do dono e da paleta do personagem, nenhuma proibida com o aluno,
   `checkRecadoTone` ok, sem chaves `{}`, sem "(a)", mentor e eLiving, fatos e segurança preservados (não
   inventar dado, não prometer resultado). **Alarmes e onboarding:** as PALAVRAS continuam iguais às da tela
   (os testes comparam com `HABIT_ALARM_CLIPS` e com as falas de onboarding); neles só se muda a tag e a
   posição da tag, a não ser que o item seja uma variante nova.

### 7.2 Métricas M1 a M6 (cobradas pelo guardião)

Definição única em `supabase/functions/_shared/audio/roteiros/index.ts` (`LIMITES_NATURALIDADE`,
`medirNaturalidade`); guardião em `src/lib/audio/__tests__/naturalidade.test.ts`
(`npx vitest run src/lib/audio/__tests__/naturalidade.test.ts`).

**Escopo de M1 a M5:** cada par personagem × categoria com **8 ou mais falas**, sem contar a categoria
`nome` (os clipes curtos de chamada). As variantes contam como falas. **Palavra** = letras e números da fala
sem as tags `[ ]`, em minúsculas, sem pontuação.

| Métrica | O que mede | Limite |
|---|---|---|
| **M1** | as mesmas 2 primeiras palavras | em no máximo **15%** das falas |
| **M2** | a mesma tag de abertura / falas que começam com tag | no máximo **40%** / no máximo **70%** |
| **M3** | falas com "!" / com dois ou mais "!" | no máximo **50%** / no máximo **10%** |
| **M4** | a tag de emoção mais usada | no máximo **45%** de todas as tags da categoria (`[pause]` e `[short pause]` entram no total, mas não contam como emoção; reações como `[clears throat]` contam como emoção) |
| **M5** | o mesmo final de frase (3 últimas palavras) | no máximo **3 vezes** |
| **M6** | variantes de um grupo (vale também para os clipes de nome) | começos diferentes (3 primeiras palavras) e **Jaccard de palavras ≤ 0,5** |

Além de M1 a M6, o guardião cobra: nenhuma fala do mesmo personagem com o mesmo texto (sem tags e sem
diferença de maiúsculas) e grupos de variantes válidos (seção 7.3). Para ver os números por categoria,
use a função `medirNaturalidade(ROTEIROS_AUDIO_V4)`: devolve cada medida e a lista de reprovações.

### 7.3 Variantes (convenção)

- **Slug:** a base (sem sufixo) é a **versão 1**; depois `<base>__v2` e `<base>__v3` (dois sublinhados;
  continua cabendo em `[a-z0-9_]{1,60}`). Exemplo: `alex.treino.proximo_aparelho`,
  `alex.treino.proximo_aparelho__v2`, `alex.treino.proximo_aparelho__v3`.
- **Regras:** `__vN` só com N ≥ 2 (sem zero à esquerda) e só se a base existir; as versões ficam na mesma
  personagem, categoria, fase, prioridade e "com o aluno" da base; sem buracos (não existe `__v3` sem
  `__v2`). Conferido por `problemasDasVariantes` e `problemasDoRoteiro`.
- **Quem ganha variantes:** o que toca muitas vezes (a cada sessão ou todo dia): introdução de exercício,
  marcos de corrida, transições, saudações, dicas diárias, falas de painel. Fala que toca raramente não
  precisa. Alarme e onboarding só ganham variante se a tela também alternar as palavras.
- **Clipes de nome:** cada nome tem 2 versões neutras (0 tags, sem "!"): a base `Olá, {Nome}.` e a
  `<nome>__v2` com abertura de conversa ("Oi, {Nome}, tudo bem?", "E aí, {Nome}, tudo certo?" ou "Olá,
  {Nome}, tudo bem?", conforme o personagem). São 205 nomes × 3 vozes × 2 versões = **1.230 clipes**. A
  saudação sem nome `Olá.` também aceita `ola__v2`, neutra.
- **Clipe de transição "Então, {Nome}," (NÃO é variante):** além da abertura (as duas versões acima), cada
  nome ganha, para Sirlene, Alex e Dr. Vital (o Rafael não), o clipe curto `Então, {Nome},` com o slug
  `<nome>__entao` (ex.: `alex.nome.joao__entao`; convenção em `roteiros/tipos.ts`: `SUFIXO_DE_TRANSICAO`,
  `slugDaTransicao`, `ehTransicao`). Regras:
  - **Não é `__vN`:** é um grupo próprio, `grupoDoSlug` não muda, não entra na alternância da abertura
    (`obterAudioDeNome` com `forma: 'transicao'` devolve sempre esse clipe, sem alternar) e não conta como
    versão do "Olá, {Nome}." em `problemasDasVariantes` nem em M6.
  - **É neutro, como toda chamada de nome:** 0 tags, sem "!", com acento, em NFC, terminando em vírgula
    porque a fala fixa continua logo depois ("Então, João," + "manhã vencida!…"). Molde único nas 3 vozes:
    `Então, {Grafia},`. Se a vírgula soar cortada de ouvido, troca-se por reticências (a receita muda e gera
    arquivo novo).
  - **Quem usa é o sequenciador** (`src/lib/audio/`, regra **R3** de `chamadaPeloNome.ts`), só em 7 momentos
    de transição real: Alex `corrida.fim` e `forca.fim`; Sirlene `nutricao.cardapio_pronto` e
    `nutricao.pesagem`; Dr. Vital `anamnese.secao` nas seções 2 a 8. Nunca no chat, nos alarmes, no meio do
    treino, nas dicas, no onboarding nem nas conquistas (`docs/voz/SEQUENCIADOR_DE_AUDIO.md`, seções 4 e 6).
    Não o use como "palavra de enchimento" em fala nova: o "Então" é um gesto de atenção, e em toda fala
    viraria o molde repetido que a regra de naturalidade proíbe.
  - **Fase 3, prioridade 3, sob demanda:** 615 clipes (205 × 3 personagens), 2.929 caracteres por personagem
    (8.787 no total), em 3 rodadas abaixo do teto de 5.000 da fase 3, só com o OK do dono (gasta saldo e
    grava no R2). Até serem gerados o sequenciador toca só a fala fixa. Conferido em `roteiros.test.ts`.
- **Como escrever uma variante:** mesmo sentido e mesmos fatos, começo diferente, mais da metade das
  palavras trocadas; troque também a posição e o tipo da tag. Não basta trocar um sinônimo.

### 7.4 Alternância no app (`src/lib/audio/catalogoAudio.ts`)

- `obterAudioVariado(idBase, opcoes?)` escolhe entre as versões que EXISTEM NO CATÁLOGO (nunca inventa uma
  versão que não foi gerada) **sem repetir a última tocada** daquele grupo. Sem variante no catálogo, toca a
  versão 1. O id com `__vN` vale pelo grupo inteiro.
- `obterAudioDeNome(personagem, primeiroNome, opcoes?)` faz o mesmo com os clipes de nome. Para o nome, o app
  lembra só "a última do personagem" (não grava o nome do aluno no aparelho).
- `tocarAudio(id, { variar: true })` toca a versão sorteada e devolve o id dela; sem `variar`, toca exatamente
  o id pedido (é o que alarmes e onboarding usam).
- **Memória da última:** por grupo, em memória e no `localStorage` (chave `eliving:audio-v4:ultimas-variantes`,
  até 200 grupos, sempre com `try/catch`: sem armazenamento, vale a memória da sessão).
- **Escolha testável:** `opcoes.aleatorio` (função que devolve um número em [0, 1)) ou `opcoes.semente`
  (número; mesma semente, mesma escolha, útil para "uma por dia"); `registrar: false` só consulta.

### 7.5 Checklist ao escrever ou revisar uma fala

1. Leia 5 falas seguidas da mesma categoria em voz alta: o começo se repete? A emoção é a mesma? Tudo
   termina em "!"? Se sim, reescreva antes de gerar.
2. Rode `npx vitest run src/lib/audio` e leia as reprovações (cada uma diz a métrica, a categoria e o
   número).
3. Fala que toca muitas vezes: crie as versões 2 e 3 (seção 7.3) e confira M6.
4. Só então o ensaio do gerador e, com o OK do dono, a geração (seção 4).
