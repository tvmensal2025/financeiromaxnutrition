# Plano dos áudios V4: apagar os antigos e regravar no padrão (eLiving)

> **Decisão do dono (06/10/2026):** "quero excluir os áudios antigos, são muitos e estão bagunçados; assim
> geramos novos e deixamos padrão."
>
> **Regras que valem aqui:** `docs/voz/REGRAS_VOZ_ELEVENLABS.md`, a fonte única
> `supabase/functions/_shared/voice/elevenlabsConfig.ts` (`voiceFor` devolve voz, modelo `eleven_v4` para
> áudio gravado e o padrão aprovado), as tags `[ ]` do dono e o tom "emocionar sem envergonhar"
> (`checkRecadoTone`, em `src/lib/dailyMessages/tone.ts:266`).
>
> **Como este plano foi feito:** só leitura, em 06/10/2026, entre 10:02 e 10:46. No R2 só houve listagem
> (ListObjectsV2), na ElevenLabs só consultas GET e no banco de produção nada. Nenhum áudio foi gerado,
> gravado ou apagado e nenhuma chave foi impressa. Os números vêm de 4 frentes de investigação: inventário
> do R2, uso no app, custo e padrão novo. As evidências estão no Apêndice A.
>
> **Nota de 06/10/2026, depois deste plano: textos reescritos e variantes.** O dono pediu: "sempre os áudios
> podem ser mais normais, sem ser chatos e repetitivos; use estratégias" e "os treinos estão chatos, muito
> repetitivos". Por isso os roteiros em `supabase/functions/_shared/audio/roteiros/` foram **reescritos** (os
> textos da seção 2 e dos números abaixo são os do plano original) e agora existem **variantes**:
>
> - **O que mudou nos textos:** aberturas variadas, emoção só onde ela acontece (a tag nem sempre no início),
>   exclamação só quando cabe, frases de tamanhos diferentes. A regra permanente, as 6 estratégias e as
>   métricas M1 a M6 estão em `REGRAS_VOZ_ELEVENLABS.md`, seção 7; o guardião é
>   `src/lib/audio/__tests__/naturalidade.test.ts`.
> - **Variantes:** o que toca muitas vezes (por sessão ou todo dia) ganha até 3 versões com o mesmo sentido.
>   Slug: a base é a versão 1; depois `<base>__v2` e `<base>__v3`. Mesma categoria, fase e prioridade da
>   base. O carregador (`obterAudioVariado`, `obterAudioDeNome`, `tocarAudio(id, { variar: true })`)
>   alterna entre as versões que existem no catálogo sem repetir a última tocada.
> - **Clipes de nome:** de 615 passam a **1.230** (205 nomes × 3 vozes × 2 versões: a base "Olá, Nome." e
>   a `__v2` com abertura de conversa, ambas neutras, sem tag e sem "!"). Mais 615 clipes de transição
>   `Então, {Nome},` (`<nome>__entao`) ficam na **fase 3**, fora das contas abaixo (seção 4, "O 'Então' volta").
> - **Números ao fechar a reescrita:** os roteiros somam 1.715 itens (1.022 bases e 693 variantes) e
>   cerca de 108 mil caracteres (antes eram 1.022 itens e 91 mil), dos quais cerca de 21,7 mil são das
>   variantes (14,1 mil das 615 versões 2 dos nomes). Por fase: fase 0 com 5.494 (teto 6.000), fase 1 com
>   60.204 (teto 75.000) e fase 2 com 42.692 (teto 70.000): os tetos da seção 5 continuam valendo e todas
>   as fases cabem. As contagens da seção 2 ("270 falas", "128 histórias", "24 dicas") valem para as
>   **bases**.
> - **Custo real do V4 bem abaixo do previsto:** o custo medido ficou em cerca de 4.500 créditos para 441
>   áudios (a conta da seção 5 previa 1 crédito por caractere, com folga de 25%). A conta do plano continua
>   sendo o teto de segurança, e o gerador confere o saldo real a cada 25 itens (seção 3.3); antes de cada
>   fase, reavaliar o orçamento com esse gasto real.

---

## 1. Resumo em 10 linhas

1. Hoje existem **17.405 áudios (mp3) no R2**, 702 MB, todos na pasta `audio/`. O git guarda mais **9.597 cópias** em `public/audio` (cerca de 349 MB), que nem entram no app publicado.
2. O app toca de verdade só **3.988** desses áudios (22,9%, 189 MB). Outros **327** aparecem apenas em código que nenhuma tela abre.
3. **13.090 (75,2%, 438 MB) não são usados por nada.** São 7.525 cópias de backup (`legacy_v1` e `legacy_v2`), 95 testes de voz e 5.470 sobras, a maioria áudios de "Então, Nome" que nenhum código toca.
4. Também há **3.302 cópias idênticas** (146 MB) e mistura de vozes e modelos. A Sirlene fala com a voz aposentada "Uneskee". Os alarmes foram gravados em modelos antigos, e o Dr. Vital nem tem registro de modelo. Os lotes de 04/10 usaram tags fora da lista do dono.
5. **Regravar o essencial (prioridade 1) custa cerca de 60,8 mil caracteres.** São 270 falas que o app usa e 615 clipes curtos de nome. Com 25% de folga para refazer, chega a cerca de 76 mil.
6. **Essencial mais importante (prioridades 1 e 2) custa cerca de 115,5 mil**, contando as 128 histórias do Alex e as dicas diárias. Regravar tudo o que tem texto, do jeito que está hoje, custaria **381,8 mil**, 3,3 vezes mais.
7. **Saldo da ElevenLabs hoje: 14.023 de 131.000 caracteres** (plano Creator, US$ 22 por mês). A renovação é em **12/10/2026 às 00:26 (horário de Brasília)**. Até lá dá para gastar com segurança uns 6 mil: amostras, os 12 alarmes e o onboarding da Sirlene.
8. Depois da renovação, cada ciclo deixa uns **121 mil caracteres livres**, já descontado o uso normal e as ligações. A prioridade 1 cabe no ciclo de 12/10 e a prioridade 2 no de 12/11, **sem pagar nada além do plano**.
9. **Padrão novo:** tudo fica em `audio/v4/<personagem>/<categoria>/`, com um catálogo só, um gerador só e um carregador só no app. Sempre `voiceFor`, `eleven_v4` e as tags do dono, e nunca se sobrescreve um arquivo.
10. **Os antigos só são apagados depois que o novo estiver publicado.** Antes disso: cópia no PC e no Drive. A exclusão segue uma lista fechada, em 2 lotes, e **quem executa é o dono**.

---

## 2. Tabela por categoria

**Legenda da prioridade:**

- **1** = essencial, o app usa hoje: regravar primeiro.
- **2** = importante, o app usa, mas é grande ou precisa de texto novo antes.
- **3** = depois, sob demanda: hoje ninguém ouve, ou depende de outra decisão.
- **0** = descartar: não regravar, só apagar o antigo.

**Como ler as colunas:**

- **"Caracteres"** é o custo para regravar só a parte que entra na prioridade, já com cerca de 10% a mais pelas tags.
- **No V4, cada caractere custa 1 crédito** (`eleven_v4`, multiplicador 1, conferido em `GET /v1/models`).
- **"Usado no app"** segue o método mais rigoroso. Conta só o que é alcançável a partir de `src/main.tsx`.

### 2.1 Saudações com nome

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| **Clipe de nome novo** "[tag] Olá, {Nome}!": 205 nomes × Sirlene, Alex e Dr. Vital | não (novo) | substitui os 3 "Olá" abaixo | sim (lista IBGE em `scripts/audit_top_ibge_r2.mjs`) | **14.117** (615 clipes) | **1** |
| Alex "Olá, {Nome}! Tudo bem?" | 1.506 (40,6 MB) | sim, 1.506 (início da corrida e alarme) | sim | substituído pelo clipe novo | 0 (antigo) |
| Sirlene "Olá, {Nome}" (pasta `sofia`, voz aposentada) | 1.506 (44,6 MB) | 429 (catálogo) | sim | substituído pelo clipe novo | 0 (antigo) |
| Dr. Vital "Olá, {Nome}" | 1.503 (46,2 MB; faltam 3 nomes) | sim (alarmes de sono e pesagem) | sim | substituído pelo clipe novo | 0 (antigo) |
| Sirlene "Então, {Nome}." | 1.506 (35,6 MB) | 155 | sim | a forma "Então" deixa de existir | 0 |
| Alex "Então, {Nome}." | 1.506 (42,2 MB) | **não** | sim | — | 0 |
| Dr. Vital "Então, {Nome}." | 1.503 (32,5 MB) | **não** | sim | — | 0 |

### 2.2 Alex (treino)

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| Falas fixas de corrida e treino (`FIXED_COACH_AUDIOS`) | 60 (5,0 MB) | 45 de 60 | sim | ~3.819 (só as 45) | 1 (as 15 restantes: 0) |
| Saudações e apresentação | 4 (0,25 MB) | 4 | sim | 283 | 1 |
| Dicas de técnica e de séries | 39 (3,9 MB) | 39 | sim | 4.088 | 1 |
| Introdução de cada exercício | 99 (20,6 MB) | 99 | sim | 23.997 | 1 |
| Onboarding do treino | 15 (1,2 MB) | sim | sim, a conferir com o áudio antes de gravar | 1.168 | 1 |
| Guias do montador de treino | 25 (3,1 MB) | 21 de 25 | sim | ~4.965 (só os 21) | 1 (os 4 restantes: 0) |
| Avulsos (painel e pós-treino) | 10 (1,7 MB) | 10 | sim | 2.435 | 1 |
| Histórias de descanso | 128 (41,0 MB) | 128 | sim, mas o tom precisa ser revisto | 48.292 | **2** |

### 2.3 Sirlene (nutrição)

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| Onboarding (11 passos) | 11 (0,8 MB) | 11 | sim | 729 | 1 |
| Falas fixas (cardápio, GLP-1, refeição, hábito) | 36 (5,0 MB) | só 2 (`cardapio_iniciando`, `cardapio_pronto`) | sim | 240 (só as 2) | 1 (as 34 restantes: 0) |
| Guias de nutrição | 14 (3,0 MB) | 3 de 14 | sim | ~816 (só os 3) | 1 (os 11 restantes: 0) |
| Comentário por alimento e por refeição | 163 (33,0 MB) | **não** (o motor nunca é ligado) | sim | 31.767 se fosse regravar | 0 |
| Saudações antigas | 1 (3 faltam) | não | sim | — | 0 |
| Roteiros escritos e nunca gravados | 0 | não | sim (19 textos) | 4.695 | 3 |

### 2.4 Dr. Vital (saúde)

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| Anamnese, GLP-1 e avulsos | 12 (3,2 MB) | 8 de 12 | sim | ~2.192 (só os 8) | 1 (os 4 restantes: 0) |
| Saudações e apresentações | 7 (0,3 MB) | não (a tela que usaria não está no app) | sim | 266 | 3 |
| Laudos fixos de exame | 20 (6,2 MB) | **não** | sim | 5.828 se fosse regravar | 0 |
| 60 resultados clínicos | 60 (19,1 MB) | **não** (só uma página de demonstração) | sim | 17.763 se fosse regravar | 0 |

### 2.5 Uso geral e conteúdo do dono

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| **Alarmes de hábito** (Sirlene 6, Alex 2, Dr. Vital 4) | 12 (2,1 MB), mais 24 embutidos nos apps | 12 | sim (2 MP3 ainda falam o texto antigo, que cobrava) | 1.965 | **1** |
| Dicas diárias | 15 áudios de tema genérico (3,3 MB) | sim, mas o áudio não lê a dica | parcial: falta um roteiro por dica (24) | ~6.400 (estimativa: 24 × ~244) | **2** |
| Biblioteca de especialistas | 34 de 40 (9,3 MB) | **não** | sim | 12.378 se fosse regravar | 0 |
| Matriz de áudio do WhatsApp | 8 de 9 (4,8 MB) | **não** (o webhook só usa a matriz para escolher o personagem) | parcial | — | 0 |
| Recados do dia (84 textos) | 0 (o áudio do dono vai para `audio-coach/`) | a tela usa áudio enviado pelo dono | sim (com `{nome}`) | 19.009 se gerados sem nome | 3 |
| Sessões guiadas do Rafael | 0 | o banco não foi consultado | não (conteúdo do dono) | — | fora do plano (o dono grava) |
| Ligação ao vivo | não é arquivo | sim | — | gasta da mesma cota (`eleven_v4_turbo`, metade do custo) | fora do plano |

### 2.6 Lixo (nada a regravar)

| Categoria | Existe no R2 | Usado no app | Texto disponível | Caracteres | Prioridade |
|---|---|---|---|---|---|
| Backups `legacy_v1` e `legacy_v2` | 7.525 (275,6 MB) | não | — | — | 0 |
| Testes de voz e amostras (`test-voices`, `sirlene-duel*`, `sirlene-round*`, `test-sirlene`, `dr-vital/candidates`, `test-adam`, `coach/sirlene_v4`) | 93 (19,1 MB) | não | — | — | 0 |
| `sirlene-oficial-hoje` | 5 (1,3 MB) | não (3 citados só pela matriz do WhatsApp, que não os envia) | não | — | 0 |
| Outras sobras avulsas dentro de pastas vivas | 33 | não | — | — | 0 |
| JSON de catálogo antigo dentro de `audio/` | 7 (0,18 MB) | não | — | — | 0 |

### 2.7 Totais

| Prioridade | Arquivos novos | Caracteres (créditos V4) | Com folga de 25% |
|---|---|---|---|
| **1 (essencial)** | 270 falas + 615 clipes de nome = **885** | **60.814** | 76.018 |
| **2 (importante)** | 128 histórias + 24 dicas = **152** | **~54.700** | ~68.400 |
| **1 + 2** | **1.037** | **~115.500** | ~144.400 |
| 3 (sob demanda) | até ~110 + nomes novos | ~24.000 + ~70 por nome novo (3 vozes) | — |
| Regravar "tudo que tem texto" como está hoje (para comparar) | ~9.900 | 381.762 | 477.203 |

**Economia de não regravar o que ninguém toca: cerca de 266 mil créditos** (381.762 − ~115.500).

---

## 3. Padrão novo (decidido)

Estas decisões foram tomadas pela IA, como manda o `AGENTS.md`. O dono não precisa escolher nada aqui.

### 3.1 Onde ficam os arquivos no R2

Todos os arquivos novos seguem o caminho `audio/v4/<personagem>/<categoria>/<slug>-<h8>.mp3`.

- **Personagem:** usa o mesmo nome da fonte única (`CharacterId`, em `elevenlabsConfig.ts:61`):
  - `sirlene`, `alex`, `drvital`, `rafael`;
  - os nomes antigos "sofia", "dr-vital" e "will" somem do caminho;
  - `eliving` não tem voz e não entra.
- **Categoria:** vem de uma lista fechada: `nome`, `saudacao`, `onboarding`, `alarme`, `treino`, `tecnica`, `imersao`, `nutricao`, `exame`, `anamnese`, `dica`, `biblioteca`, `montador`, `painel`.
- **Slug:** só letras minúsculas sem acento, números e `_`, com até 60 caracteres. Por exemplo, `maria` ou `agua_lembrete`.
- **h8:** são os 8 primeiros caracteres de uma impressão digital (sha256) da receita: voz, modelo, padrão, formato e texto com as tags.
  - Mesma receita gera o mesmo nome de arquivo. Retomar uma geração não gasta de novo.
  - Qualquer mudança na receita gera um nome novo. **Nunca se sobrescreve um arquivo.**
- **Envio de cada arquivo:**
  - tipo `audio/mpeg` e formato `mp3_44100_128`;
  - cache `public, max-age=31536000, immutable`, que é seguro porque o nome nunca muda;
  - trava `If-None-Match: *`: se o arquivo já existir, o R2 recusa.
- **Por que assim:**
  - A pasta `v4` separa o novo do velho. A limpeza vira "tudo em `audio/` que não está em `audio/v4/`", sem adivinhação.
  - O personagem vem antes da categoria, então a mesma voz fica junta.

### 3.2 Um catálogo só

- **Onde fica:** um arquivo JSON gerado, `supabase/functions/_shared/audio/catalogoAudioV4.json`, no mesmo padrão da fonte única de voz.
  - O app lê esse arquivo por um módulo em `src/lib/audio/`.
  - A Edge Function importa o mesmo arquivo.
  - Hoje nenhuma dessas pastas existe; foi conferido.
- **Cabeçalho:**
  - `schema: "eliving.audio.v4"` e a versão;
  - a data da geração;
  - o sha256 da fonte única de voz no momento da geração.
- **O que cada item registra:**
  - identificação: `id` (`personagem.categoria.slug`), personagem, categoria, slug, caminho, chave e url;
  - texto: o texto com as tags e o sha256 dele, a receita e se a fala é com o aluno (`comAluno`);
  - voz: `voiceId`, `modelId`, `voiceSettings` e `outputFormat`;
  - resultado: duração, bytes, caracteres cobrados (cabeçalho `character-cost`) e `requestId`;
  - conferência: data da geração, resultado do tom (`ok` e exceções) e data em que foi ouvido (`conferidoDeOuvido`).
- **Textos de entrada:** ficam numa fonte única de roteiros, `supabase/functions/_shared/audio/roteiros/<personagem>.ts`.
- **Catálogos de assunto** (treino, nutrição, exames): mantêm os próprios dados (palavras-chave, horário, eixo) e trocam `audioUrl` e `text` por `audioId`.
- **Validação:** com Zod, que já está no projeto. A IA consulta o Context7 antes de escrever.
- **O que sai:** os 13 catálogos atuais, que têm 9 formatos diferentes, depois da troca (seção 5, Fase 4).

### 3.3 Um gerador só: `scripts/audio-v4-gerar.mts` (roda com `npx tsx`)

- **Reaproveita a fonte única:** `voiceFor(personagem, 'gravado')`, `validateAudioTags`, `sanitizeTtsText(texto, 'elevenlabs')` (que recusa `{}`), `stripAudioTags` e `checkRecadoTone`.
  - Com isso, passa no guardião `src/lib/voice/__tests__/vozSemLegado.test.ts`.
- **Sem opção nenhuma, é ensaio.** Não gasta nem grava nada:
  - valida todos os roteiros;
  - calcula os nomes dos arquivos;
  - confere o R2 só com HEAD;
  - consulta o saldo (`GET /v1/user/subscription`);
  - mostra quantos itens e quantos caracteres vai gastar.
- **`--gerar`** gasta caracteres e salva os mp3 numa pasta local fora do git (`.audio-v4/`). Cada resposta é conferida:
  - é áudio de verdade;
  - tem mais de 1 KB;
  - a duração foi medida (alarme com no máximo 30 s, por causa do iOS).
- **Trava de gasto:**
  - `--max-caracteres` (padrão 5.000) e `--reserva-minima` (padrão 3.000);
  - o saldo é consultado de novo a cada 25 itens;
  - uma resposta 429 ou cota esgotada para tudo e salva o que já foi feito;
  - gera um item por vez, em sequência.
- **Filtros:** `--somente=personagem[.categoria]` e `--amostra=N` (gera amostras para o dono ouvir).
- **`--confirm-production`** sobe ao R2, mas só dentro de `audio/v4/`, com a trava de não sobrescrever. Depois atualiza o catálogo.
- **Relatório de cada rodada:** gerados, pulados, reprovados por tom ou por tag, caracteres gastos e saldo antes e depois.
- **Chave:** a chave da ElevenLabs só é lida no servidor ou no PC (`ELEVENLABS_API_KEY`) e nunca é impressa.
- **Comandos (feito na Fase 0; sem script no `package.json`, que é da sessão de mídia):**
  - ensaio de tudo ou de uma fase: `npx tsx scripts/audio-v4-gerar.mts` e `npx tsx scripts/audio-v4-gerar.mts --fase=0`;
  - gerar a fase 0 (gasta saldo, só com o OK do dono): `npx tsx scripts/audio-v4-gerar.mts --gerar --fase=0 --max-caracteres=6000 --reserva-minima=6000`:
    - `--max-caracteres=6000` é o teto da fase 0 (seção 5). A fase tem 5.816 caracteres, e o teto padrão da rodada, 5.000, não daria;
    - `--reserva-minima=6000` é a reserva que a fase 0 deixa para as ligações (seção 5). Sem ela, valeria a reserva padrão de 3.000: se o saldo cair abaixo de 11.816 antes do OK, o gerador gastaria até sobrarem só 3.000;
    - nas Fases 1 e 2, use o teto da fase e `--reserva-minima=25000` (ex.: `--gerar --fase=1 --max-caracteres=75000 --reserva-minima=25000`);
  - subir ao R2 depois de ouvir (produção, só com o OK do dono): `npx tsx scripts/audio-v4-gerar.mts --confirm-production --fase=0 --conferido-em=AAAA-MM-DD`;
  - testes sem rede: `node --import tsx --test scripts/tests/audio-v4-gerar.test.mjs` e `npx vitest run src/lib/audio src/lib/voice`;
  - roda com `tsx` (e não com `node --experimental-strip-types`) porque o verificador de tom usa o atalho `@/` do app;
  - os mp3 gerados e os relatórios ficam em `.audio-v4/` (fora do git); o catálogo só muda com `--confirm-production`.

### 3.4 Um carregador só no app: `src/lib/audio/catalogoAudio.ts`

- **Funções:**
  - `obterAudio(id)` e `obterAudioDeNome(personagem, primeiroNome)`;
  - `urlDoAudio`, que reaproveita o `resolveAudioUrl` de `src/utils/mediaStorage.ts:111`;
  - `textoNaTela` (sem as tags) e `tocarAudio(id)`;
  - `obterAudioVariado(idBase)` e `tocarAudio(id, { variar: true })`: alternam entre as versões do grupo
    (`<base>`, `<base>__v2`, `<base>__v3`) que existem no catálogo, sem repetir a última tocada
    (`obterAudioDeNome` já faz isso com os clipes de nome). Detalhes em `REGRAS_VOZ_ELEVENLABS.md`, seção 7.
- **Carga:** o catálogo de cada personagem é carregado só quando a tela precisa, para não pesar a abertura do app.
- **Se o arquivo faltar:**
  - aparece o texto na tela e a falta é registrada para a próxima rodada;
  - a voz do sistema do aparelho só entra se o arquivo falhar por rede, e **nunca para o nome**;
  - corrige-se o `playAudioUrl`, que hoje "engole" o erro (`ElevenLabsAudioCoach.ts:487-490`), para que o plano B funcione de verdade.
- **O app nunca chama a ElevenLabs direto.** Sai o caminho que lê a chave no navegador (`ElevenLabsAudioCoach.ts:186` e `:1039`).
- **A troca é por categoria inteira**, e só quando ela está 100% gerada, ouvida e conferida.
- **Na troca, apaga-se o cache local antigo** (IndexedDB `max_audio_coach_cache`, `ElevenLabsAudioCoach.ts:139`), que tocaria o áudio velho.
- **Pontos que hoje montam caminho na mão e passam a usar o carregador:**
  - `ElevenLabsAudioCoach.ts:433` e `:709`;
  - `vitalAudioCatalog.ts:114` e `:128`;
  - `alexOnboardingAudio.ts:12`;
  - `sirleneOnboardingScript.ts:37` (`?v=ejv7`);
  - a regex de `UnifiedAudioDispatcher.ts:60`;
  - a matriz do WhatsApp (`_shared/audio-keyword-matrix.ts`), que perde as URLs e fica só com a escolha do personagem;
  - os alarmes: `localUrl`, depois `npm run alarm:sounds`, mantendo os mesmos 12 nomes nos apps e o canal `v3`.
- **Os 3 normalizadores de nome** (Alex, Sirlene e Dr. Vital) viram um só.

### 3.5 O que o guardião automático vai cobrar (teste Vitest novo)

O teste falha se encontrar:

- um arquivo de áudio no repositório fora dos 24 alarmes nativos;
- um caminho `/audio/` escrito no código fora do catálogo e do carregador;
- um item de catálogo fora do padrão de nome, ou com voz ou modelo diferente de `voiceFor`;
- uma voz da lista `LEGACY_VOICE_IDS`;
- uma tag inválida, ou tom reprovado sem exceção registrada;
- um `audioId` que não existe no catálogo;
- um script que grave fora de `audio/v4/`.

Depois da troca, sai também a exceção "catálogo já gravado" do `vozSemLegado`.

### 3.6 Scripts antigos que voltariam a bagunçar (a IA neutraliza na Fase 0)

- `scripts/upload-all-assets-to-r2.mjs`: reenvia `public/audio` para `audio/` com PUT sem trava e com `immutable` (linha 57). Deixa de enviar áudio.
- `scripts/backup_audios.mjs`, `backup_audios_v2.mjs`, `backup_alex_audios.mjs` e `restore_alex_mistakes.mjs`: copiam para `legacy_*` dentro do próprio bucket. São removidos; o backup passa a ser fora do R2.
- `scripts/audit-and-clean-r2.mjs`: apaga por prefixo (`names/`, `test/`) sem ensaio (linhas 146-161). É removido; nada pode apagar por prefixo.

---

## 4. Saudações com nome: estratégia e custo

**Como fica:** a fala principal passa a ser **sem nome**. O nome aparece escrito na tela e é dito num **clipe curto separado**, na voz do mesmo personagem, tocado logo antes. O alarme já funciona assim hoje (`alarmVoice.ts:104-110`).

| Opção | Clipes | Caracteres | Decisão |
|---|---|---|---|
| Manter como hoje: 1.503 nomes × 6 formas (Olá e Então nos 3 personagens) | ~9.000 | 182.853 | rejeitada |
| 1.503 nomes × 3 personagens, forma única curta | ~4.500 | ~104.000 | rejeitada (79% de um ciclo) |
| **205 nomes mais comuns × 3 personagens, "[tag] Olá, {Nome}!"** | **615** | **14.117** | **escolhida (Fase 1)** |
| Nome sob demanda, gerado no servidor na primeira vez | 1 por personagem por nome novo | ~23 por personagem (~70 nos 3), uma vez só | Fase 3, com o OK do dono |
| Sem nome na voz (só na tela) | 0 | 0 | é o que acontece com nome fora da lista até a Fase 3 |

**Detalhes decididos:**

- **Lista de nomes:**
  - os 205 nomes do ranking do IBGE que já estão no projeto (`scripts/audit_top_ibge_r2.mjs`);
  - a fala usa a grafia com acento (José, João), e o nome do arquivo não leva acento;
  - a conta de 14.117 caracteres foi medida com a tag de cada um: Sirlene `[laughs]`, Alex `[excited]`, Dr. Vital `[thoughtful]`; nome médio de 6,3 letras.
- **Acaba o "Então, {Nome}":**
  - as frases de transição da Sirlene ficam sem nome;
  - 4.515 arquivos deixam de ser necessários (os de Alex e Dr. Vital nem tocavam).
- **O "Então" volta, só como clipe curto de transição (revisão de 06/10/2026, depois do pedido do dono "cuidado ficar chato sempre, olá, então, tem que ser estratégico"):**
  - a linha acima continua valendo para o **antigo** "Então, {Nome}" colado em toda fala (1.503 nomes × 3 personagens, com tag e exclamação). Ele não volta;
  - volta **só** o clipe curto `Então, {Nome},`, **neutro** (sem tag, sem "!", com acento, terminando em vírgula), id `<personagem>.nome.<slug>__entao`, para Sirlene, Alex e Dr. Vital (o Rafael não ganha). Não é variante `__vN`: cada um é um grupo próprio;
  - toca em **7 momentos de transição real**, sob a regra **R3** do sequenciador (já houve fala do personagem na sessão, pelo menos 10 min desde o último "Então" dele, fala anterior sem nome, sorteio estável): Alex `corrida.fim` e `forca.fim`; Sirlene `nutricao.cardapio_pronto` e `nutricao.pesagem`; Dr. Vital `anamnese.secao` nas seções 2 a 8. Fora desses momentos (chat, alarmes, meio do treino, dicas, onboarding, conquistas) nunca entra. Regra e desenho: `docs/voz/SEQUENCIADOR_DE_AUDIO.md`, seções 4 e 6;
  - **615 clipes** (205 nomes × 3 personagens) e cerca de **8,8 mil caracteres** (2.929 por personagem; 8.787 no total), na **fase 3** (sob demanda, prioridade 3), em **3 rodadas** (uma por personagem, cada uma abaixo do teto de 5.000 da fase 3), **só com o OK do dono**: gastam saldo e gravam no R2. Antes, as 3 amostras (`sirlene.nome.maria__entao`, `alex.nome.joao__entao`, `drvital.nome.antonio__entao`);
  - a fonte do texto é `supabase/functions/_shared/audio/roteiros/nomes.ts` (`textoDoClipeDeNome(..., 'transicao')` e `clipesDeNome`), cobrada por `src/lib/audio/__tests__/roteiros.test.ts`;
  - **até serem gerados, nada quebra:** `obterAudioDeNome(p, nome, { forma: 'transicao' })` devolve `null`, o bloco toca só a fala fixa e o sequenciador registra `nome_sem_audio`. As contas da tabela acima e os 1.230 clipes de abertura ("Olá, Nome." e a versão 2, fases 0 e 1) seguem como estão; os 615 de transição são um conjunto à parte, na fase 3.
- **Rafael não ganha clipe de nome.** Hoje nenhuma tela usa o nome dito por ele.
- **Nome que não está na lista:**
  - toca a fala sem nome, nunca a voz robótica do aparelho dizendo o nome, para não misturar vozes;
  - o app registra só a contagem por primeiro nome, sem identificar o aluno;
  - essa contagem aparece no Admin como "nomes mais pedidos sem áudio", para o próximo lote.
- **Fase 3, nome sob demanda:**
  - uma Edge Function gera o nome que falta com `voiceFor(personagem, 'gravado')` e guarda em `audio/v4/<personagem>/nome/`;
  - tem liga e desliga e um teto diário de caracteres, os dois editáveis no Admin (`system_settings`);
  - nunca roda pelo navegador.
- **Custo de um aluno novo com nome raro:** cerca de 70 créditos, uma vez só, e depois serve para todos com o mesmo nome.

---

## 5. Fases, orçamento e o que o dono aprova

**Base do orçamento:**

- **Saldo hoje:** 14.023 caracteres.
- **Até 12/10:** o uso normal do app e das ligações gasta cerca de 331 por dia. Sobram uns **12,2 mil** para planejar.
- **Depois da renovação:** cada ciclo dá 131.000, menos uns 10 mil de uso normal: cerca de **121 mil úteis**.
- **Ligações:** as ligações ao vivo gastam da mesma cota. Por isso cada fase deixa uma reserva.

| Fase | Quando | O que entra | Caracteres (base) | Teto da fase | Reserva que fica | O dono aprova |
|---|---|---|---|---|---|---|
| **0. Preparar** | agora até 12/10, 00:26 | Pela IA, no PC, sem custo: roteiros na fonte única, revisão de tom, gerador, carregador, guardião, testes e backup local. Com o OK do dono: ~28 amostras (2 por categoria), os **12 alarmes** e o **onboarding da Sirlene** | ~5.200 | **6.000** | ≥ 6.000 | gerar (gasta saldo) |
| **1. Essencial** | ciclo de 12/10 a 12/11 | o restante da prioridade 1: 247 falas e **615 clipes de nome** | ~58.100 | **75.000** | ≥ 25.000 | gerar, subir ao R2, publicar o app, a Edge e o build nativo |
| **2. Importante** | ciclo de 12/11 a 12/12 | 128 histórias do Alex (com o tom revisto) e 24 roteiros de dicas diárias | ~54.700 | **70.000** | ≥ 25.000 | gerar, subir ao R2, publicar |
| **3. Sob demanda** | a partir de 12/12 | Itens de prioridade 3 quando uma tela passar a usá-los (já previstos: os 615 clipes `Então, {Nome},` da seção 4, em 3 rodadas de cerca de 2,9 mil caracteres, só com o OK do dono), e a Edge Function de nome sob demanda | ~24.000 + nomes novos | por rodada (padrão 5.000) | ≥ 25.000 | gerar, publicar a Edge, ligar no Admin |
| **4. Apagar os antigos** | Lote 1 depois da Fase 1 publicada. Lote 2 depois da Fase 2 publicada e mais 14 dias | Exclusão (seção 6) | 0 | — | — | o dono executa o comando |

**Em cada fase com geração, a ordem é:**

1. A IA roda o ensaio e mostra os itens, os caracteres e o saldo.
2. O dono dá o OK.
3. A IA roda `--gerar`.
4. O dono ouve as amostras: 5% de cada categoria e todos os alarmes.
5. Com o OK do dono, `--confirm-production` sobe ao R2.
6. A IA confere que 100% dos arquivos respondem no R2 (HEAD 200) e que a duração e o tipo estão certos.
7. A IA troca no app, categoria por categoria, com testes, build e capturas em 360, 390 e 430 px nas telas que tocam áudio.
8. O dono publica.

**As amostras aprovadas viram o arquivo final.** Mesma receita dá o mesmo nome de arquivo, então não se paga duas vezes.

**O que o dono precisa aprovar, em resumo:**

1. **Custo:**
   - **Upgrade de plano:** não é necessário. Tudo cabe no Creator atual, com custo extra de **US$ 0**.
   - **Pay As You Go:** só se o dono quiser terminar antes. É uma recarga mínima de US$ 5, que cobre uns 62 mil créditos a US$ 0,08 por mil. Conferir o preço no painel antes; a promoção de US$ 0,022 por mil termina em 12/10. A IA não recomenda, porque as fases dão tempo de ouvir e trocar com calma.
2. **Gerar:** o OK do dono em cada fase (Fases 0, 1, 2 e 3).
3. **Subir ao R2:** o OK do dono em cada fase. Só em `audio/v4/` e sem sobrescrever.
4. **Publicar:**
   - o app (Lovable, merge e push na `main`);
   - a Edge Function do WhatsApp (matriz sem URLs);
   - o build nativo com os alarmes novos;
   - mais tarde, a Edge do nome sob demanda.
5. **Ouvir e aprovar** as amostras de cada categoria.
6. **Copiar o backup** do PC para o Drive.
7. **Rodar a exclusão** (seção 6).
8. **Autorizar a consulta só de leitura** no banco de produção (seção 6, pré-condição 4).

---

## 6. Exclusão dos antigos

### 6.1 Quando

Só depois que a troca estiver **publicada**. Antes de cada lote, todas estas condições precisam valer:

1. A fase correspondente está publicada: o app, a Edge e, para os alarmes, o build nativo.
2. Para o Lote 2: passaram **14 dias** de convivência. É o tempo do cache de mídia do app (`r2-media-cache`, 14 dias, `vite.config.ts:231-238`).
3. Para o Lote 2: o app publicado (`dist/`) e o código têm **zero caminhos `/audio/` fora de `/audio/v4/`** (o guardião confirma).
4. Consulta **só de leitura** no banco de produção, preparada pela IA e rodada com o OK do dono:
   - `select id, title, content::jsonb->'audio'->>'url' from sessions where content::text like '%"audio"%';`
   - `select to_regclass('public.daily_messages');`

   Nenhuma das URLs pode apontar para áudio antigo.
5. Conferir o Helena Gateway (repositório `financeiromaxnutrition`, `routeFixedAudio`, `docs/AUDIO-ROUTING.md:18`). Ele não pode ler nenhum áudio antigo do R2.
6. O backup está completo e conferido (6.2).
7. Uma nova listagem do bucket bate com a lista fechada: mesmas chaves e mesmos ETags. Outra automação mexe no projeto em paralelo, então a lista é refeita na hora.

### 6.2 Backup antes de apagar

- **A IA baixa tudo para o PC**, fora do repositório: `C:\Users\plata\backup-r2\AAAA-MM-DD\audio\`.
  - Reaproveita `scripts/inventario_r2_completo.mjs`, que já existe e só lê, como decidido no item 8.2 do plano de mídia.
- **O manifesto** traz chave, bytes, ETag e sha256 de cada arquivo.
- **Conferência:** 17.412 itens (17.405 mp3 e 7 JSON) e 702,2 MB.
  - O `legacy_v2` é a única cópia da geração anterior do Alex: 3.097 de 3.292 arquivos diferem do que está no ar. Por isso o backup vem antes de qualquer exclusão.
- **O dono copia a pasta para o Drive.**
- **Prazo:** o backup fica guardado por pelo menos 12 meses.
- **Nada de mp3 no git.**

### 6.3 Os dois lotes (lista fechada)

| Lote | O que | Arquivos | Tamanho | Quando |
|---|---|---|---|---|
| **1** | backups `legacy_v1` e `legacy_v2` (7.525), testes e amostras (83) e `coach/sirlene_v4` (10); nada disso tem referência no código | **7.618** | 294,7 MB | depois do backup e da Fase 1 publicada |
| **2** | todo o resto de `audio/` fora de `audio/v4/`: 9.787 mp3 e os 7 JSON de catálogo antigo | **9.794** | ~407,5 MB | depois da Fase 2 publicada e mais 14 dias |
| **Total** | | **17.412** | **702,2 MB** | |

A lista candidata já foi gerada em modo leitura, com 17.412 chaves. Na execução ela é refeita e gravada como lista versionada em `docs/voz/evidencias/`.

### 6.4 O script de exclusão: `scripts/audio-legado-apagar.mts`

**Quem executa a exclusão é o dono.** A IA escreve o script, testa no PC com uma lista de mentira e deixa o comando pronto.

- **Sem opção nenhuma, ele só LISTA.** Mostra quantos arquivos e quantos MB, e confere cada chave com a listagem atual do bucket.
- **Para tudo antes de apagar qualquer coisa** se alguma chave da lista:
  - não começar com `audio/` (com a barra);
  - começar com `audio/v4/`;
  - não terminar em `.mp3` e não for um dos 7 JSON nomeados;
  - cair num prefixo protegido (6.5);
  - estiver repetida, não existir mais ou tiver mudado de ETag;
  - ou se o total for diferente do cabeçalho da lista.
- **`--backup <pasta>`** baixa e confere o backup (6.2).
- **`--confirm-production --lista <arquivo> --manifesto-backup <arquivo>`** apaga:
  - **só as chaves exatas** da lista, em lotes pequenos (até 100 por pedido; a IA confere o limite do R2 no Context7 antes de escrever);
  - registra o resultado de cada chave;
  - no fim, lista o bucket de novo e confere que as chaves sumiram e que os prefixos protegidos continuam com a mesma contagem.
- **Nunca apaga por prefixo.**
- **No repositório**, depois do Lote 2:
  - a IA faz o commit local de `git rm -r public/audio` (9.601 arquivos, cerca de 349 MB);
  - apaga os catálogos antigos e as sobras na raiz (`generated_*_v4_manifest.json`, `remaining_audios_to_generate.json`, `alex_r2_all_keys.json`, `nomes_*.json`);
  - acrescenta `public/audio/` e `.audio-v4/` ao `.gitignore`;
  - isso só chega à `main` com o push do dono;
  - o histórico do git não é reescrito.

### 6.5 O que NUNCA pode ser apagado

- **Tudo fora de `audio/` no bucket:**
  - `images/`, `models/` e `characters/` (o 3D é custódia do dono);
  - `assets/`, `banners/`, `exercises/`, `products/` e `courses/`;
  - os arquivos da raiz: logos, ícones do app, silhueta e `nomes_master_catalog.json`;
  - os prefixos vazios `feed/`, `medical-docs/`, `profiles/`, `progress/`, `reels/`, `runs/` e `tiles/`.
- **`audio-coach/`** (atenção: começa com "audio", mas não é `audio/`). É onde chegam os áudios que o dono envia para recados e sessões e os áudios recebidos pelo WhatsApp.
- **`audio/v4/`**, o padrão novo.
- **Os 24 arquivos de alarme embutidos nos apps:** 12 mp3 no Android (`res/raw`) e 12 `.caf` no iOS. Troca-se o conteúdo, mas os nomes ficam (canal `v3`, `HabitAlarmChannels.java:32,67`).
- **As vozes antigas na conta da ElevenLabs**, por decisão do dono (`REGRAS_VOZ_ELEVENLABS.md:40-43`). O sistema só nunca as usa.
- **O backup no PC e no Drive**, por pelo menos 12 meses.

---

## 7. Riscos e como evitamos

| Risco | O que pode acontecer | Como evitamos |
|---|---|---|
| **App mudo** | Em 10 categorias, como treino do Alex, nomes, onboardings e avulsos, o app fica em silêncio se o arquivo sumir, porque `playAudioUrl` nunca acusa erro (`ElevenLabsAudioCoach.ts:487-490`). | Apagar só depois da troca publicada e mais 14 dias. HEAD 200 em 100% dos arquivos novos antes da troca. O carregador novo mostra o texto e registra a falta, e o `playAudioUrl` é corrigido. |
| **Quebra de telas** | Caminhos montados na mão (seção 3.4), a regex do dispatcher e a matriz do WhatsApp apontam para arquivos antigos. | Troca por categoria, com testes, `npm run build` e capturas em 360, 390 e 430 px. O guardião barra qualquer `/audio/` antigo no código. |
| **Áudio velho no cache** | O cache do app (14 dias) e o IndexedDB tocam o arquivo antigo. | O nome do arquivo novo é sempre diferente, o IndexedDB é limpo na troca e o Lote 2 espera 14 dias. |
| **Gasto acima do saldo** | Uma geração em lote come a cota das ligações. | Ensaio como padrão, teto por fase (`--max-caracteres`), reserva mínima, saldo consultado a cada 25 itens e parada em 429. O app nunca chama a ElevenLabs pelo navegador. |
| **Mistura de vozes** | Nome numa voz e frase em outra, ou alarme novo no app e antigo na notificação. | Troca por categoria inteira. Nome e fala do mesmo personagem trocam juntos. Alarmes trocam junto com o build nativo. O catálogo registra voz e modelo por item, e o guardião compara com `voiceFor` e barra `LEGACY_VOICE_IDS`. Nome fora da lista não usa voz robótica. |
| **Perda sem volta** | O R2 não tem versionamento nem lixeira. | Backup no PC e no Drive com sha256, lista fechada, 2 lotes, nunca por prefixo e o dono executa. |
| **Referência fora do repositório** | O banco (`sessions`) ou o Helena Gateway apontam para áudio antigo. | Pré-condições 4 e 5 da seção 6.1. |
| **Tom errado** | 261 de 679 textos atuais têm aviso de tom (25 com termo que constrange), e os lotes de 04/10 usaram tags fora da lista (como `[encouraging]`, 3.053 vezes). | A IA revisa os roteiros antes de gastar. O gerador recusa tag inválida e tom reprovado sem exceção registrada. Com o aluno, nunca bronca, deboche ou decepção. |
| **Bagunça voltar** | Scripts antigos reenviam `public/audio` ou copiam para `legacy_*`. | Neutralizados na Fase 0 (seção 3.6), e o guardião barra a gravação fora de `audio/v4/`. |
| **Números mudarem** | Outra automação edita código de voz em paralelo, e o bucket pode mudar. | Antes de cada fase e de cada lote, listar de novo e comparar com o manifesto. |

---

## 8. Registro da decisão

- **A decisão do dono de 06/10/2026 substitui, só para os ÁUDIOS, a decisão 11 do plano de mídia.** A decisão 11 dizia "Sem `audio/v4/…` e sem `_archive` por enquanto" (`docs/releases/PLANO_MIDIA_R2_REVISADO_20261006.md:164`).
  - O que muda: os áudios passam a ficar em `audio/v4/` e os antigos são apagados depois da troca.
  - O que não muda: `_archive` continua sem ser usado. O backup vai para fora do R2 (PC e Drive), como manda o item 8.2 do mesmo plano.
- **Para os áudios, também deixam de valer:**
  - "nada é copiado, renomeado nem movido" (mesmo plano, linha 97);
  - "Não renomear nem mover o catálogo de áudio e 3D no R2" (`MAPA_DO_QUE_JA_FOI_FEITO_20261006.md:510`);
  - "`legacy_v2` fica documentado como pré-V4" (item 8.2.5 do plano de mídia): ele é apagado no Lote 1, depois do backup externo.
- **Imagens, 3D e conteúdo dos usuários continuam exatamente como no plano de mídia.**
- **Documentos a atualizar quando cada fase for executada:**
  - `REGRAS_VOZ_ELEVENLABS.md`: seção 1 (exceção dos catálogos antigos) e seção 6 (áudios a regravar);
  - a decisão 11 do plano de mídia;
  - `MAPA_DO_QUE_JA_FOI_FEITO_20261006.md`;
  - `CONTINUE_AQUI.md`.

---

## Apêndice A: Evidências (06/10/2026)

| Número | Como foi obtido |
|---|---|
| 17.887 objetos e 878,5 MB no bucket; 17.405 mp3 e 702,02 MB em `audio/` | `node scripts/inventario_r2_completo.mjs` ("Total: 17887 objetos, 878.5 MB") e uma ListObjectsV2 própria, repetida sem diferença |
| 3.988 usados, 327 só em código morto, 13.090 sem referência | Grafo de imports a partir de `src/main.tsx` (1.417 arquivos alcançados) cruzado com as chaves do R2. 3.988 + 327 + 13.090 = 17.405 |
| 7.525 backups `legacy` | Criados por `scripts/backup_audios_v2.mjs:66-68` (CopyObject). Busca por `legacy_v` em src, supabase, server e public: 0 arquivos |
| 2.814 grupos e 3.302 cópias idênticas (146,4 MB) | ETag igual. Nenhum objeto multipart, então o ETag vale como MD5 |
| WhatsApp não envia os áudios da matriz | `whatsapp-webhook-unified/index.ts:1696-1697` usa só `match.persona` e responde com texto |
| `motivation-daily.mp3` não existe no R2 | Citado em `_shared/audio-keyword-matrix.ts:190` |
| Saldo 14.023 de 131.000, renova `2026-10-12T03:26:07Z` | `GET /v1/user/subscription`: `tier=creator`, `character_count=116977`, `can_extend_character_limit=false` |
| `eleven_v4` custa 1 por caractere e `eleven_v4_turbo` 0,5 | `GET /v1/models` (`character_cost_multiplier`) |
| Uso normal de ~331 caracteres por dia | `GET /v1/usage/character-stats` (27/08 a 06/10): 117.115 no período, dos quais 111.153 em 7 dias de testes |
| 205 nomes em 615 clipes custam 14.117 caracteres | Medido com a lista de `scripts/audit_top_ibge_r2.mjs` e a tag de cada personagem |
| Lote 1 = 7.618 arquivos e 294,66 MB | Filtro por prefixo sobre a listagem completa (legacy, testes e `sirlene_v4`) |
| Lotes de 04/10 com tags fora da lista do dono | `generated_alex_v4_manifest.json` (3.160 itens, voz do Alex, `eleven_v4`) e `generated_audios_v4_manifest.json` (1.073 itens da Sirlene, sem voz registrada) |

**Por que o número de "usados" varia entre as frentes:**

| Frente | Número | Por quê |
|---|---|---|
| Uso no app (o mais rigoroso, usado neste plano) | **3.988** | Conta só o que uma tela alcançável toca |
| Padrão | ~5.817 | Soma também os 327 citados por código morto e os 1.503 "Então" do Dr. Vital, cujo caminho é montado no código mas que ninguém chama |
| Custo | 9.782 | Conta tudo o que está em pastas vivas (9.030 nomes e 752 falas), sem olhar se toca |

Os arquivos de trabalho das frentes (JSON, listas e scripts de leitura) ficaram numa pasta temporária da sessão. Por isso, na execução, a IA refaz as listas a partir do bucket e grava as listas finais em `docs/voz/evidencias/`.
