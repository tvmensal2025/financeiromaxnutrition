# Sequenciador de áudio (eLiving): um tocador só, blocos em ordem e nome na hora certa

> **Pedido do dono (06/10/2026):** "organize para os áudios ficarem sincronizados: um não pode cortar o
> outro, falar por cima ou pular; tem que ser tudo organizado. Analise os momentos de Olá + nome + fixo, e
> Então + nome + fixo; organize tudo isso na plataforma." E logo depois: "cuidado ficar chato sempre, olá,
> então, tem que ser estratégico."
>
> **O que é este documento:** o desenho do tocador central (sequenciador) e o plano de execução. Nenhum código
> mudou para escrevê-lo. As decisões foram tomadas pela IA, como manda o `AGENTS.md`.
>
> **Base:** dois mapas feitos só em leitura em 06/10/2026: os 29 momentos em que um personagem fala e os
> tocadores que existem hoje. Também o `docs/voz/PLANO_AUDIOS_V4.md` (seções 3.4, 4, 5 e 6), o
> `docs/voz/REGRAS_VOZ_ELEVENLABS.md` (inclusive a seção 7, naturalidade) e o carregador
> `src/lib/audio/catalogoAudio.ts`, além do catálogo `catalogoAudioV4.json` (1.715 itens, versão 3).
>
> **Documentação de plataforma:** o Context7 respondeu 429 (cota do mês esgotada). Por isso o desenho usa só
> APIs que o projeto já usa:
>
> - `HTMLAudioElement` (`play`, `pause`, `load`, `preload`, `readyState`, eventos `ended`, `error`, `playing`,
>   `pause`, `timeupdate`, `canplay`);
> - `speechSynthesis`, `AudioContext`, `indexedDB` e `document` `visibilitychange`;
> - `App.addListener('appStateChange')` do `@capacitor/app` 8, com a definição conferida em
>   `node_modules/@capacitor/app/dist/esm/definitions.d.ts:199`.
>
> O autoplay liberado no app nativo foi conferido no código do Capacitor: Android em `Bridge.java:586`,
> com `setMediaPlaybackRequiresUserGesture(false)`, e iOS em `CAPBridgeViewController.swift:122-125`, com
> `mediaTypesRequiringUserActionForPlayback = []`. O resto do comportamento em aparelho está marcado como
> "não verificado em aparelho".

---

## 1. Resumo em 10 linhas

1. **Um tocador só para todas as vozes de personagem**, menos a ligação ao vivo, que só suspende a fila: o
   **sequenciador** (`src/lib/audio/sequenciador.ts`). Todo o resto vira adaptador dele: o coach, o motor do
   treino, o alarme, os onboardings, os guias, as dicas e os recados.
2. **Uma fila com 3 prioridades:** alarme > treino ao vivo > fala de tela. Duas vozes nunca tocam juntas.
3. **Bloco atômico:** "Olá, João." + fixo, "Então, João," + fixo, ou só o fixo. As partes tocam em ordem, com
   pausa de 150 a 300 ms entre elas, e a parte seguinte já fica carregada (2 elementos de áudio reaproveitados).
4. **Ninguém corta ninguém no meio da palavra.** Quem chega com prioridade maior espera o fim da parte atual.
   Numa parte longa (mais de 7 s), espera o fim da frase em andamento. Quem chega com a mesma prioridade
   espera o fim do bloco. Só um comando do aluno (parar, pular, pausar, mudo) para na hora, com um fade de 150 ms.
5. **Nada some sem motivo.** Item velho, repetido, de tela fechada ou que não cabe mais é descartado com
   motivo no registro. Falha de rede ou de arquivo tenta de novo 1 vez, depois mostra o texto e segue para
   o próximo bloco.
6. **Nome estratégico, nunca em toda fala.** O "Olá + nome" entra só no primeiro contato do dia com aquele
   personagem, ou depois de 4 h sem falar com ele. O "Então + nome" entra só numa transição real, no máximo
   1 vez a cada 10 min e nunca em duas falas seguidas. São no máximo 2 nomes por sessão. No treino ao vivo, o
   nome aparece só no início e no fim, e no alarme no máximo 1 vez por dia.
7. **Momentos viram dados:** `src/lib/audio/momentosDeAudio.ts` diz, para cada momento, a composição, os ids
   V4, a prioridade e quando entram o Olá, o Então e o nome (seção 5). As telas só chamam
   `falarMomento('corrida.km', { km: 3 })`.
8. **"Então, Nome," volta como clipe curto e neutro**, só para 7 momentos de transição real. São 615 clipes
   (~8,8 mil caracteres), gerados na fase 3 com o OK do dono. Até lá, o bloco toca sem o nome e nada quebra.
9. **Todos os números ficam num módulo só** (`src/lib/audio/configSequencia.ts`), prontos para o Admin. O
   cache IndexedDB antigo é apagado uma vez, e o app nunca chama a ElevenLabs direto.
10. **Execução:** primeiro o núcleo (8 arquivos novos e 2 ajustes, com testes); depois 4 unidades em
    paralelo, com listas de arquivos que não se cruzam: Alex ao vivo, fachadas e alarmes, telas e onboarding,
    roteiros do "Então". O treino entra pelo `useWorkoutSound` e pelo motor, sem tocar nos arquivos da outra
    sessão.

---

## 2. Por que hoje corta, fala por cima e pula

| # | Causa | Onde | Efeito que o dono ouve |
|---|---|---|---|
| 1 | Não existe fila: são mais de 20 tocadores de mp3 soltos, mais a voz do aparelho e a ligação. Só o coach corta o anterior, e só o que ele mesmo tocou. | `ElevenLabsAudioCoach.ts:407-420`, `alarmVoice.ts:25-69`, `alexCoachAudio.ts`, `sirleneOnboardingAudio.ts`, `SpecialistAudioNote.tsx`, `new Audio` em mais de 10 componentes | um fala por cima do outro (GLP-1: Dr. Vital e Sirlene juntos; alarme por cima do treino) |
| 2 | `speak()` e `playFixed()` voltam quando o som **começa**, não quando termina. | `ElevenLabsAudioCoach.ts:454, 1009, 1054, 1064` | "Olá, X! Tudo bem?" cortado aos 350 ms; "Parabéns, X!" cortado aos 950 ms |
| 3 | O áudio cortado resolve a promessa como se tivesse acabado, e quem esperava continua. | `ElevenLabsAudioCoach.ts:403` | ping-pong: duas sequências se cortam uma à outra |
| 4 | Sequências montadas com `setTimeout` de tempo fixo, que ignoram a duração real. | `RefitWorkoutPlayer.tsx:523-531` (1.200 e 5.500 ms), `useWorkoutSound.ts:150, 195, 199`, `useAudioCoach.ts:60-116` | a dica técnica do V4 (4,5 a 9,3 s) é cortada com cerca de 1 s tocado; a história corta a frase de descanso |
| 5 | Erro engolido: `playAudioUrl` nunca acusa falha. | `ElevenLabsAudioCoach.ts:486-490` | arquivo ausente vira silêncio e todo plano B fica inerte |
| 6 | Estado global trocado no meio da fala (`config.coach`) e mais de um mudo. | `ElevenLabsAudioCoach.ts:509-543, 707-733`; `alarmVoice.ts:115-121` | voz errada, erro 404 e mudo desfeito |
| 7 | Disparo duplicado sem trava. | intro do exercício a cada série e a cada edição de peso (`RefitWorkoutPlayer.tsx:262-270`); passo do onboarding pedido 2 a 3 vezes | a mesma fala repete ou recomeça (o "pulo") |

---

## 3. O desenho

### 3.1 Peças do núcleo

| Arquivo (novo, salvo indicação) | Papel |
|---|---|
| `src/lib/audio/configSequencia.ts` | **Todos os números** (seção 8), com `configSequencia()` e `definirConfigSequencia(parcial)` para o Admin depois |
| `src/lib/audio/sequenciador.ts` | A fila única: blocos, prioridades, interrupção, pré-carregamento com 2 elementos, validade, época, deduplicação, escopos, falhas, celular, registro e estado para a interface |
| `src/lib/audio/frases.ts` | Função pura: onde terminam as frases de uma parte (pela pontuação e pelas tags `[pause]`), para nunca parar no meio da palavra |
| `src/lib/audio/chamadaPeloNome.ts` | A estratégia do Olá, do Então e do nome (regras R1 a R12 da seção 4), com o histórico por personagem |
| `src/lib/audio/momentosDeAudio.ts` | **A tabela da seção 5 em código**: momento → composição, ids V4, prioridade, canal, regra de nome, deduplicação e validade. Também traz `falarMomento()` |
| `src/lib/audio/mapaLegadoParaV4.ts` | Tradução do legado: id antigo de `playFixed` → momento; caminho `/audio/...` antigo → id V4; id da dica → id V4; e a lista fechada do que não tem V4 |
| `src/lib/audio/useFalaDaTela.ts` | Hook React das telas: escopo próprio, cancela ao desmontar, alterna tocar/pausar e mostra o progresso |
| `src/lib/audio/cacheDeVozAntigo.ts` | Apaga uma vez o IndexedDB `max_audio_coach_cache` |
| `src/lib/audio/catalogoAudio.ts` (ajuste) | `obterAudioDeNome` ganha a forma "transição"; a variante só conta como "a última" quando toca de verdade; o `tocadorPadrao` passa a ouvir `pause` |
| `supabase/functions/_shared/audio/roteiros/tipos.ts` (ajuste) | Convenção do clipe de transição: `SUFIXO_DE_TRANSICAO = '__entao'` e `slugDaTransicao(slug)` |

### 3.2 Contrato: o que o resto do app chama

```ts
// src/lib/audio/sequenciador.ts
export type PrioridadeDeFala = 'alarme' | 'treino_ao_vivo' | 'tela';
export type CanalDeFala = 'corrida' | 'treino.serie' | 'treino.descanso';

export type ParteDeFala =
  | { tipo: 'fixo'; id: string; variar?: boolean }        // id do catálogo V4 (exato, ou o grupo se variar)
  | { tipo: 'chamada'; forma: 'abertura' | 'transicao' }   // resolvida quando o bloco COMEÇA (seção 4)
  | { tipo: 'url_do_dono'; url: string; texto: string }    // recado ou sessão enviada pelo dono (audio-coach/)
  | { tipo: 'aparelho'; texto: string };                   // texto dinâmico na voz do aparelho

export interface PedidoDeFala {
  momento: IdMomento;                 // chave de momentosDeAudio.ts
  params?: ParametrosDoMomento;       // primeiroNome, km, exercicio, secao, alarme, nudge, dicaId, url...
  escopo?: string;                    // padrão: 'global' (alarme e treino) ou o escopo da tela
  porToque?: boolean;                 // o aluno pediu (botão Ouvir)
  aindaValido?: () => boolean;        // conferido antes do bloco e entre as partes
  efeito?: { tocar: () => void; duracaoMs: number };  // bipe ou fanfarra que abre o bloco
  aoMostrarTexto?: (texto: string) => void;           // quando o áudio não toca
}

export interface SequenciadorDeAudio {
  falar(pedido: PedidoDeFala): Promise<ResultadoDoBloco>; // resolve quando o bloco TERMINA ou é descartado; nunca lança erro
  cancelarEscopo(escopo: string): void;                   // troca de tela: termina a frase e descarta a fila do escopo
  pararTudo(motivo: 'aluno' | 'mudo'): void;              // comando do aluno: para já, com fade de 150 ms
  pausar(blocoId: string): void;                          // só blocos por toque (dica, guia, recado)
  retomar(blocoId: string): void;                         // continua de onde parou (não recomeça)
  suspender(motivo: 'ligacao' | 'midia_do_dono'): void;
  liberar(motivo: 'ligacao' | 'midia_do_dono'): void;
  novaEpoca(canal: CanalDeFala): void;                    // invalida o que está na fila daquele canal
  estado(): EstadoDoSequenciador;                         // quem fala, momento, tempo, duração e fila
  assinar(ouvinte: (e: EstadoDoSequenciador) => void): () => void;
  registro(): readonly EventoDoSequenciador[];
  aoRegistrar(ouvinte: (e: EventoDoSequenciador) => void): () => void;
}
export const sequenciadorDeAudio: SequenciadorDeAudio;    // instância única do app
export function criarSequenciador(dep: DependenciasDoSequenciador): SequenciadorDeAudio; // testes: tocador, relógio e armazenamento falsos

// src/lib/audio/momentosDeAudio.ts
export function falarMomento(
  momento: IdMomento,
  params?: ParametrosDoMomento,
  opcoes?: Omit<PedidoDeFala, 'momento' | 'params'>,
): Promise<ResultadoDoBloco>;

// src/lib/audio/useFalaDaTela.ts
const { falar, alternar, parar, tocando, progresso } = useFalaDaTela('drvital.anamnese');
```

O `ResultadoDoBloco` traz um `status` (`'tocou' | 'parcial' | 'texto' | 'descartado'`), o `motivo` e as partes
tocadas, cada uma com o id V4 da versão que tocou.

### 3.3 Bloco e partes

**Formas de bloco.** No V4, o clipe de nome já traz a saudação ("Olá, João." ou "E aí, João, tudo certo?"):

| Forma | Partes, em ordem | Pausa entre as partes |
|---|---|---|
| **Olá + nome + fixo** (abertura) | `<p>.nome.<slug>` ou `<p>.nome.<slug>__v2` (alterna sem repetir a última) → fixo | **280 ms** depois do clipe de nome |
| **Olá sem nome + fixo** | `<p>.saudacao.ola` ou `ola__v2` → fixo | **250 ms** |
| **Então + nome + fixo** (transição) | `<p>.nome.<slug>__entao` ("Então, João,") → fixo | **150 ms** (a vírgula pede continuação, sem buraco) |
| **Fixo** | o fixo (versão variada quando o momento diz `variar`) | — |
| **Fixo + fixo** | ex.: o recorde depois da conclusão | **300 ms** |

- **"Nome + fixo" sem Olá e sem Então** (nome solto como vocativo) **não existe no V4 e não será criado**.
  Quando o momento pede nome, ele vem como abertura ou como transição; nos outros casos, a fala vai sem nome.
- **Entre blocos:** 500 ms se é o mesmo personagem e 800 ms se troca de personagem, para não soar como
  atropelo. Quando o bloco abre com um efeito sonoro, a voz entra depois do efeito e mais 150 ms.
- **Nome fora da lista (ou clipe ainda não gerado):** a parte sai, sem voz do aparelho dizendo o nome. A
  abertura cai para "Olá." sem nome se o momento aceitar (senão, nada), e a transição some. A falta é contada
  por `registrarFaltaDeAudio` (motivo `nome_sem_audio`), sem identificar o aluno.
- **Quando se decide o nome:** no momento em que o bloco **começa** a tocar, não quando entra na fila. Assim,
  dois blocos na fila não usam o nome os dois (regra R11).
- **Variantes:** o momento diz se o fixo alterna (`variar: true`). A escolha usa `obterAudioVariado(...,
  { registrar: false })`, e a versão só passa a contar como "a última tocada" quando tocou de verdade
  (`marcarVarianteTocada`). Assim, um bloco descartado não gasta a alternância.
- **De onde vem o nome:** sempre `realFirstName(full_name || name)` (`src/lib/userDisplayName.ts:44`), nunca o
  prefixo do e-mail. Hoje `AlexTrackingDemo.tsx:96` e `HabitAlarmOverlay.tsx:41-49` usam "rafael.ids", que
  vira "rafaelids".

### 3.4 Pré-carregamento (sem buraco entre as partes)

- **Dois `HTMLAudioElement` reaproveitados** (A e B) para o app inteiro, sem `new Audio` por fala. Isso
  ajuda o iOS, não acumula elementos e permite trocar de um para o outro sem buraco.
- Quando um bloco entra na fila, os ids são resolvidos no catálogo e as URLs são montadas (`urlDoAudio`).
- Quando o bloco vira o próximo da fila, a parte 1 começa a carregar no elemento livre (`preload = 'auto'` e
  `load()`).
- Enquanto a parte N toca num elemento, a parte N+1 carrega no outro. Quando começa a última parte do bloco,
  o outro elemento já carrega a parte 1 do próximo bloco.
- No fim da parte, a pausa da tabela 3.3 é contada. Se a próxima parte ainda não estiver pronta
  (`readyState` < 3), a espera vai até mais **1.500 ms** pelo evento `canplay`. Depois disso, `play()` é
  chamado de qualquer jeito, e o teto de 8 s para começar continua valendo.
- O clipe de nome é curto (1 a 2,2 s), então o fixo começa a carregar junto com ele.
- **Tempo de término:** a parte termina no evento `ended`. Como trava, conta a duração do catálogo mais
  5 s; se passar disso, a parte é dada como encerrada, com registro `tempo_esgotado`.

### 3.5 Prioridades e interrupção

| Prioridade | Valor | Quem |
|---|---|---|
| `alarme` | 0 (maior) | alarmes de hábito no app |
| `treino_ao_vivo` | 1 | treino de força, corrida e caminhada, descanso, recorde no fim do treino |
| `tela` | 2 | fala automática de tela e fala por toque (`porToque`) |

**"Parte longa"** é a parte com mais de **7 s** no catálogo: histórias (11 a 25 s), dicas (11 a 20 s),
anamnese (12 a 17 s), mercado e alarmes. Nela, "esperar o fim da parte" vira esperar o **fim da frase em
andamento**: o próximo ponto de corte de `frases.ts` mais 120 ms de margem. Se nenhum fim de frase chegar até
o teto, a voz sai com fade de 150 ms. No iOS o volume do elemento não muda, então lá ela para direto; isso não
foi verificado em aparelho e é raro, porque as frases dos roteiros têm menos de 4 s.

| Chega | O que está tocando | O que acontece | Registro |
|---|---|---|---|
| alarme | treino ou tela | espera o fim da parte atual (parte longa: fim da frase, teto **2,5 s**). O resto do bloco interrompido é descartado e o alarme toca | `interrompido_por_prioridade` |
| treino ao vivo | tela | espera o fim da parte atual (parte longa: fim da frase, teto **1,5 s**). O resto é descartado | `interrompido_por_prioridade` |
| mesma prioridade | — | espera o fim do **bloco**: a fila anda por ordem de chegada | — |
| tela por toque | tela automática | espera o fim da parte atual (fim da frase, teto **1,2 s**) e entra no lugar: o aluno pediu | `substituido_por_toque` |
| tela por toque | outra fala por toque | o mesmo botão de novo é pausar ou parar; outro botão espera o fim da frase (teto 1,2 s) e troca | `substituido_por_toque` |
| prioridade menor | — | entra na fila, com validade (3.6) | `expirou_na_fila`, se vencer |
| **comando do aluno** (parar, pular, pausar o treino, minimizar, mudo) | qualquer | para já, com fade de 150 ms: é o aluno mandando, não outra voz cortando | `parado_pelo_aluno` |
| troca de tela (escopo cancelado) | fala daquele escopo | termina a frase atual (teto 1,2 s) e para; a fila daquele escopo é descartada | `escopo_cancelado` |
| passo novo do mesmo escopo (onboarding) | passo anterior | termina a frase atual (teto 1,2 s) e toca o passo novo | `substituido` |
| ligação ou mídia do dono começa | qualquer | termina a frase (teto **1 s**); a fila fica suspensa e a fala de tela pendente é descartada; alarme e treino esperam e a validade decide | `suspenso` |

### 3.6 Fila: validade, época, deduplicação e tamanho

**Validade na fila.** Se o bloco não começar dentro do prazo, ele é descartado com o registro `expirou_na_fila`:

| Tipo de fala | Prazo |
|---|---|
| alarme | 60 s |
| treino ao vivo | 20 s (padrão) |
| tela automática | 8 s |
| tela por toque | 15 s; nesse caso o texto também aparece na tela |
| bloco por toque pausado | 5 min (depois disso, retomar recomeça do início) |

**Época por canal** (`corrida`, `treino.serie`, `treino.descanso`). `novaEpoca(canal)` descarta o que está
na fila daquele canal (`obsoleto`). É assim que a "série concluída" de uma série que já passou nunca toca:

- a série seguinte começou (`playExerciseIntro`) → `novaEpoca('treino.descanso')`;
- a série terminou (`playSetCompleteBeep`) → `novaEpoca('treino.serie')`;
- a atividade da corrida parou ou foi reiniciada → `novaEpoca('corrida')`.

**`aindaValido()` do pedido.** É conferido antes do bloco e entre as partes. Se deixar de valer no meio, a
parte atual termina e o resto sai, com registro `obsoleto`. O motor do treino usa isto para a **janela de
descanso** (3.11).

**Deduplicação.** A chave é o momento mais os parâmetros (ex.: `corrida.km|3`, `forca.intro_exercicio|supino`).
Bloco igual dentro da janela é descartado (`duplicado`). Bloco igual que já está tocando ou na fila também é
descartado (`ja_na_fila`).

| Caso | Janela |
|---|---|
| padrão | 10 s |
| alarme | 60 s por tipo |
| conquistas | 30 s (`duel_accepted` vem por 2 caminhos) |
| fim do treino ou da corrida | 60 s |
| onboarding | 2 s por passo (cobre os 2 a 3 disparos do mesmo passo e substitui a trava de 700 ms) |
| introdução do exercício | 45 min por exercício; zera no fim do treino |
| marcos de km e de passos | 1 vez por marco por atividade |
| meta de água batida | no máximo 1 por dia |

**Tamanho.** A fila guarda no máximo **12 blocos**. Passando disso, sai o mais velho de menor prioridade
(`fila_cheia`).

### 3.7 Escopos, troca de tela e comandos do aluno

- Toda fala de tela tem um escopo, por exemplo `sirlene.home`, `drvital.anamnese` ou `onboarding_alex`. Alarme
  e treino usam `global`.
- `useFalaDaTela(escopo)` chama `cancelarEscopo(escopo)` ao desmontar. Isso substitui os `coach.stop()` que
  cortavam o treino minimizado ao sair do chat (`useChatLogic.ts:164, 171`).
- **Pausar e retomar por toque** (dica, guia, anamnese, recado): `pausar` guarda a parte e o ponto exato.
  Enquanto isso, o bloco fica estacionado e não segura a fila. `retomar` volta a enfileirar o bloco, na
  frente, e continua do ponto menos 0,3 s, em vez de recomeçar (hoje `DrVitalAnamnesisVoiceGuide.tsx:101` e
  `AlexCoachBuilderVoiceGuide.tsx:121` recomeçam).
- **Comandos do aluno:** `pararTudo('aluno')` vale para o "Pular", o "Pausar" e o "Minimizar" do treino (via
  `audioDispatcher.stopAll()`), para o "Silenciar" e para o mudo. Ele para já, com fade, e esvazia a fila.
  Também dispara o evento `alex:audio:stop`, que o motor do treino escuta para fechar a janela de descanso.

### 3.8 Falhas: tenta de novo uma vez, mostra o texto e segue

| Situação | O que acontece | Registro |
|---|---|---|
| falha de rede ou de arquivo numa parte | tenta de novo **1 vez**, depois de **400 ms**, com a mesma URL | — |
| falhou de novo | mostra o `textoNaTela` da parte por `aoMostrarTexto` (e pelo evento global `eliving:audio:texto`, para quem quiser legenda) e registra a falta. Se a parte era nome, abertura ou transição, o bloco segue sem ela. Se era o fixo, o bloco termina e **a fila segue** | `falha_rede` ou `falha_arquivo`, com `registrarFaltaDeAudio` |
| id que não está no catálogo | texto de reserva do momento, e o bloco segue ou termina | `sem_audio_no_catalogo` |
| navegador bloqueou o autoplay | não tenta de novo; mostra o texto e marca "aguardando gesto" (3.9) | `bloqueado_pelo_navegador` |
| voz do aparelho | entra **só** no treino ao vivo (corrida com o celular no bolso), só por falha de **rede**, nunca para o nome, e só se nenhuma parte gravada do bloco já tocou (não mistura vozes no mesmo bloco) | `voz_do_aparelho` |
| exceção inesperada | `falar()` nunca lança erro: o bloco vira `descartado` e a fila segue | `erro_interno` |

### 3.9 Celular

1. **Autoplay.**
   - No app nativo (Capacitor), o WebView já toca sem gesto (código do Capacitor conferido, ver o topo).
   - Na web e no PWA, no primeiro gesto (`pointerdown` ou `keydown`, uma vez, em captura), o sequenciador
     "acorda" os 2 elementos: dá `play` e logo `pause` num silêncio curto gerado em memória.
   - Até esse gesto, a fala automática de tela vira texto. A fala por toque funciona, porque já é um gesto.
2. **Elementos reaproveitados:** nada de `new Audio` por fala, como descrito em 3.4.
3. **Pausa pelo sistema:** é o evento `pause` que o sequenciador não pediu (chamada telefônica, outro app
   pegou o áudio).
   - A parte fica marcada como interrompida.
   - Se o app voltar a ficar visível em até **20 s** e o bloco ainda valer, ele retoma do começo da frase em
     que parou, uma vez só.
   - Fora disso, o bloco é descartado com registro `interrompido_pelo_sistema`.
4. **Segundo plano:** vale para `visibilitychange` igual a `hidden` e para `appStateChange` com
   `isActive = false`.
   - Fala automática de tela: termina a frase (teto 1,5 s) e a fila de tela é descartada
     (`app_em_segundo_plano`).
   - Fala por toque: fica pausada e retoma só por toque.
   - Treino ao vivo (corrida com a tela apagada): continua aceitando enquanto o JS rodar. Não verificado em
     aparelho.
   - Alarme: o sequenciador **não toca alarme com o app escondido**; isso é do canal nativo (`USAGE_ALARM` no
     Android, `.caf` no iOS).
5. **Foco de áudio e música de fundo:** sem plugin novo. Quem treina ouvindo música usa o modo `beeps_only`,
   que já existe. O "abaixar a música" (ducking) fica como pendência.
6. **Alarme nativo e overlay: nunca a mesma voz duas vezes.**
   - Se o canal nativo já tocou a voz daquela ocorrência, o overlay não toca o corpo sozinho; o botão
     "Ouvir" toca.
   - O toque automático do overlay fica só para o recado de adiado (nudge), e só quando não houve som nativo
     naquela ocorrência.
   - O chime do botão "Ouvir" vira o `efeito` do bloco, e a voz entra depois dele.
7. **Ligação e sessão guiada do dono:**
   - `useCharacterVoiceCall` chama `suspender('ligacao')` ao começar e `liberar('ligacao')` ao terminar, dar
     erro ou desmontar.
   - O `<audio>` da sessão guiada do Rafael (`GuidedSessionAudioPlayerModal`) chama
     `suspender('midia_do_dono')` enquanto toca.
   - Durante a suspensão, nada da fila toca por cima.

### 3.10 Registro

- Guarda os últimos **200** eventos em memória. Cada evento tem: hora, tipo (`enfileirado`, `iniciou`,
  `parte`, `terminou`, `descartado`, `falhou`, `interrompido` ou `texto`), bloco, momento, personagem,
  prioridade, ids e motivo.
- `aoRegistrar` permite mandar contagens ao Admin depois. Só os descartes e as falhas vão para o
  `console.info`, e só em desenvolvimento.
- **Lista fechada de motivos:** `duplicado`, `ja_na_fila`, `obsoleto`, `expirou_na_fila`, `fila_cheia`,
  `escopo_cancelado`, `substituido`, `substituido_por_toque`, `parado_pelo_aluno`,
  `interrompido_por_prioridade`, `interrompido_pelo_sistema`, `app_em_segundo_plano`, `suspenso`,
  `descanso_encerrado`, `nao_cabe_no_descanso`, `limite_do_dia`, `sem_audio_no_catalogo`, `nome_sem_audio`,
  `falha_rede`, `falha_arquivo`, `bloqueado_pelo_navegador`, `tempo_esgotado`, `voz_do_aparelho` e
  `erro_interno`.
- **"Nada pula sem motivo registrado"** é cobrado em teste: todo pedido que não termina como `tocou` tem um
  motivo da lista.
- **O aviso "Alex falando"** passa a vir do estado do sequenciador (personagem e prioridade de quem fala), e
  não mais da regex de caminho `/audio/coach/alex/` (`UnifiedAudioDispatcher.ts:60`), que deixa de valer com
  `audio/v4/`.

### 3.11 Treino de força sem tocar no `RefitWorkoutPlayer.tsx` nem no `ActiveWorkoutContext.tsx`

O player continua chamando as mesmas funções de `useWorkoutSound`. A ordem é garantida por dentro do hook e
do motor:

- **`playSetCompleteBeep(ctx)`:**
  - os bipes são o `efeito` do bloco;
  - faz `novaEpoca('treino.serie')`;
  - **abre a janela de descanso**, marcando quando a série terminou;
  - enfileira `forca.serie_concluida` (dica técnica, recorde ou última série, escolhida pelo motor).
- **`playRestVoice(seg)`**, chamado pelo player 1,2 s depois:
  - só vale com a janela aberta (senão: `descanso_encerrado`);
  - marca o fim previsto do descanso;
  - **entra na fila depois da dica técnica**, sem cortá-la.
- **`playRestStory()`**, chamado 5,5 s depois:
  - só vale com a janela aberta;
  - o motor escolhe uma história que **caiba** no descanso que resta (duração mais 3 s); se nenhuma couber:
    `nao_cabe_no_descanso`;
  - a história só passa a contar como "já tocada" se tocou. Hoje ela é marcada antes
    (`alexWorkoutImmersionCatalog.ts:1673-1675`).
- **A janela fecha** em quatro casos: no fim previsto do descanso, em `playExerciseIntro` (uma série nova
  começou, com `novaEpoca('treino.descanso')`), no evento `alex:audio:stop` (pular, pausar ou minimizar, via
  `stopAll`) e em `playFinishBeep`.
  - Com isso, os `setTimeout` de 1.200 e 5.500 ms do player que chegam depois de um "Pular" são
    descartados com registro. O player não precisa mudar.
- **`playExerciseIntro(nome)`:** é deduplicado por exercício por 45 min. Assim, a introdução não repete a
  cada série nem a cada edição de peso, e o efeito do player pode disparar à vontade.
- **`playAlexWarmupMobility()` e a introdução** competem no começo do treino; agora tocam em fila: primeiro o
  aquecimento, depois a introdução, se ela ainda valer.
- **`playFinishBeep()`:** o acorde é o efeito, a conclusão (neutra; somem o `_f` e o `_m`) entra com a
  transição possível, e o recorde do `useExerciseProgram` entra depois, na fila.
- **Fica como pendência** para quando a outra sessão liberar os arquivos:
  - trocar os 3 `setTimeout` do player por uma chamada única ao motor;
  - declarar o alerta de fim de descanso (`ActiveWorkoutContext.tsx:730`) como efeito.

---

## 4. Estratégia de chamada: Olá, Então e nome (anti-chato)

> Regra do dono: "cuidado ficar chato sempre, olá, então, tem que ser estratégico". Ninguém chama o outro
> pelo nome a cada frase. O nome é um gesto de atenção: aparece quando a conversa começa ou muda de assunto,
> e some no meio da conversa.

### 4.1 Regras (cobradas em `chamadaPeloNome.test.ts`)

| # | Regra | Números (`configSequencia.chamada`) |
|---|---|---|
| **R1** | **Abertura** ("Olá, João." / "E aí, João, tudo certo?") só em momento marcado com abertura, e só se for o **primeiro contato do dia** (data local do aparelho) com aquele personagem ou se ele estiver **sem falar há 4 h ou mais**. Fora disso, sem abertura. | `aberturaAposHorasSemFalar: 4` |
| **R2** | Com a abertura permitida, o nome entra se tiver clipe no catálogo, se R5 e R6 deixarem e se o sorteio estável passar. Senão: "Olá." sem nome, quando o momento aceita (`aberturaSemNome: 'ola'`), ou nada. | `probUsarNomeNaAbertura: 0.8` |
| **R3** | **Transição** ("Então, João,") só em momento marcado como transição real (mudança de assunto ou de etapa). Exige tudo isto: já houve fala desse personagem na sessão; pelo menos **10 min** desde o último "Então" dele; a fala anterior dele não foi transição nem teve nome; o clipe `__entao` existe; o sorteio estável passou. Se algo falhar, a fala vai sem "Então" e sem nome. | `transicaoIntervaloMin: 10`, `probUsarTransicao: 0.6` |
| **R4** | Abertura e transição nunca no mesmo bloco. | — |
| **R5** | No máximo **2 falas com nome por sessão** do personagem. A sessão é uma sequência de falas com intervalos menores que 30 min. | `nomeMaxPorSessao: 2`, `sessaoInativaMin: 30` |
| **R6** | **Nunca em falas seguidas:** duas falas seguidas do mesmo personagem nunca levam nome as duas. Entre personagens diferentes, nome no máximo 1 vez a cada 90 s. | `intervaloGlobalEntreNomesS: 90` |
| **R7** | **Alarme:** nome no máximo **1 vez por dia** por personagem, e só se R1 e R6 deixarem. O alarme adiado (nudge) nunca leva nome nem "Olá". | `alarmeNomeMaxPorDia: 1` |
| **R8** | **Treino ao vivo quase nunca usa nome:** só no início (aquecimento ou início da corrida, pela R1) e no fim (fim do treino ou da corrida, pela R3). Km, passos, séries, descanso, técnica e histórias nunca levam nome. | — |
| **R9** | **Nunca nome, Olá ou Então** em: onboarding (as palavras são as da tela), dicas, guias, recado, conquistas, chat, voz do aparelho e prévia de alarme. | — |
| **R10** | **Forma alternada e sorteio estável:** a abertura alterna v1/v2 sem repetir a última (`obterAudioDeNome`). O sorteio usa a semente "dia local + personagem + contador de oportunidades": é estável no dia e testável (os testes injetam `aleatorio`). | — |
| **R11** | A decisão é tomada quando o bloco **começa**, e o histórico só é gravado se a parte de nome **tocou de verdade**. | — |
| **R12** | **Histórico** por personagem, em memória e no `localStorage`, na chave `eliving:audio-v4:chamadas`, sempre com `try/catch` (sem armazenamento, vale a memória da sessão). Guarda só datas e contadores; **nunca o nome do aluno**. | `chaveHistorico` |

**Histórico guardado por personagem:**

- `ultimaFalaEm` e `sessaoIniciadaEm`;
- `ultimaAberturaEm` e `ultimaTransicaoEm`;
- `nomesNaSessao`;
- `ultimaFalaTeveNome` e `ultimaFalaFoiTransicao`;
- `diaDoUltimoNomeNoAlarme`;
- `contadorDeOportunidades`.

Mais um campo global: `ultimoNomeEm`. Qualquer bloco do personagem que tocou pelo menos uma parte conta como
"contato".

### 4.2 Um dia de exemplo (quantas vezes o aluno ouve o próprio nome)

| Hora | O que acontece | Fala | Por quê |
|---|---|---|---|
| 07:10 | começa a corrida | "E aí, João, tudo certo?" + "Manhã de treino, que beleza…" | R1: primeiro contato do dia com o Alex |
| 07:15 a 07:40 | km 1 a 5 | só os marcos | R8 |
| 07:45 | fim da corrida | "Então, João," + "Manhã vencida!…" | R3: conquista, mais de 10 min, fala anterior sem nome, 1 nome na sessão |
| 12:00 | alarme de água | "Olá, João." + corpo do alarme | R1 e R7: primeiro contato do dia com a Sirlene |
| 12:40 | meta de água batida | só a fala | R9: não é momento de nome |
| 15:00 | alarme da tarde (fissura) | só o corpo | R7: o nome no alarme da Sirlene já foi usado hoje; R1: menos de 4 h desde 12:40 |
| 19:00 | treino de força | "Olá, João." + aquecimento | R1: o Alex está sem falar há mais de 4 h |
| 19:05 a 19:50 | séries e descansos | sem nome | R8 |
| 19:55 | fim do treino | só a conclusão | R6 ou R3: dependendo do sorteio, às vezes vem o "Então, João," |

O resultado é de 3 a 5 vezes o nome num dia cheio, espalhadas por 3 personagens e sempre em momentos que
fazem sentido.

---

## 5. Tabela de momentos

**Como ler as colunas:**

- **Prioridade:** A = alarme, T = treino ao vivo, Tl = tela. "(toque)" quer dizer que a fala é por toque do
  aluno.
- **Olá/nome** e **Então/nome** dizem quando cada um entra (regras da seção 4).
- Ids com `(var)` alternam entre as versões `__v2` e `__v3` sem repetir a última.
- O id do momento é a chave de `momentosDeAudio.ts`.

### 5.1 Alex: treino ao vivo

| Momento | Quem dispara | Composição | Ids V4 | Prioridade · validade · dedupe | Olá/nome | Então/nome |
|---|---|---|---|---|---|---|
| `corrida.inicio` | `useAudioCoach.announceStart` ← `AlexTrackingDemo.tsx:1125` | 1º contato do dia (ou 4 h ou mais): [abertura] + saudação de horário. Senão: início da atividade | `alex.nome.<slug>` (var v2); `alex.saudacao.greeting_morning\|afternoon\|night` (var); `alex.treino.start_run\|start_walk` (var) | T · canal `corrida` · 20 s · 30 s | R1. Sem nome: nada, porque a saudação de horário já cumprimenta | nunca |
| `corrida.km` | `useAudioCoach` ← `AlexTrackingDemo.tsx:643` | efeito (ping) + fixo | `alex.treino.split_1km` a `split_5km` (var), `split_10km` | T · 20 s · o km novo substitui o km que ainda não tocou · 1 por km | nunca | nunca |
| `corrida.km` (6 a 9 km e de 11 km em diante) | idem | só texto (sem voz do aparelho) | **sem V4** (pendência) | — | — | — |
| `corrida.passos` | `useAudioCoach` ← `AlexTrackingDemo.tsx:793` | efeito (fanfarra de ~1,1 s) + fixo | `alex.treino.step_1k\|step_2k5\|step_5k\|step_10k` (var) | T · 20 s · 1 por marco | nunca | nunca |
| `corrida.moeda_perto` | `useAudioCoach.announceCoinRadar` (sem chamador hoje) | fixo | `alex.treino.radar_coin_near` | T · 15 s · 60 s | nunca | nunca |
| `corrida.fim` | `useAudioCoach.announceFinish` ← `AlexTrackingDemo.tsx:1378, 1430` | [transição] + fim por horário. Sai o "Parabéns, {nome}!" na voz do aparelho | `alex.nome.<slug>__entao`; `alex.treino.finish_morning\|afternoon\|night` (var) | T · 30 s · 60 s | nunca | **R3** (conquista grande) |
| `forca.aquecimento` | `useWorkoutSound.playAlexWarmupMobility` ← `RefitWorkoutPlayer.tsx:295-300` | [abertura] + fixo, 1 vez por treino | `alex.nome.<slug>` (var v2); `alex.treino.treino_aquecimento_mobilidade` (var) | T · `treino.serie` · 30 s | **R1** (só aqui no treino). Sem nome: nada | nunca |
| `forca.intro_exercicio` | `useWorkoutSound.playExerciseIntro` ← `RefitWorkoutPlayer.tsx:262-270` | fixo | `alex.imersao.intro_<exercicio>` (99, pelo mapa) | T · `treino.serie` · vale até a série terminar · **45 min por exercício** | nunca | nunca |
| `forca.serie_concluida` | `useWorkoutSound.playSetCompleteBeep(ctx)` ← `RefitWorkoutPlayer.tsx:503/509` | efeito (bipes) + fixo escolhido pelo motor (técnica, recorde ou última série) | `alex.tecnica.<cue>` (39 de 39) | T · `treino.descanso` · vale até o fim do descanso | nunca | nunca |
| `forca.descanso_voz` | `useWorkoutSound.playRestVoice` ← `RefitWorkoutPlayer.tsx:523` | fixo, depois da dica técnica | `alex.treino.strength_rest_30s\|strength_rest_60s` (var) | T · `treino.descanso` · só com a janela de descanso aberta | nunca | nunca |
| `forca.descanso_historia` | `useWorkoutSound.playRestStory` ← `RefitWorkoutPlayer.tsx:527` | fixo longo | `alex.imersao.story_<slug>` (128) | T · `treino.descanso` · só se couber no descanso que resta (+3 s) | nunca | nunca |
| `forca.fim` | `useWorkoutSound.playFinishBeep` ← `RefitWorkoutPlayer.tsx:1808` | efeito (acorde) + [transição] + fixo | `alex.nome.<slug>__entao`; `alex.treino.treino_concluido_sucesso` (var; neutro, somem `_f` e `_m`) | T · 30 s · 60 s | nunca | **R3** |
| `forca.recorde` | `coach.playFixed('personal_record')` ← `useExerciseProgram.ts:264`, pela fachada | fixo, na fila depois do fim | `alex.treino.personal_record` | T · 30 s · 60 s | nunca | nunca |
| `forca.dica_avulsa` | `useWorkoutSound.playTechniqueCue`, `playLastRepPrompt` etc., pela fachada (sem chamador no player) | fixo | `alex.treino.rep_cadence\|rep_focus_squeeze\|weight_increase\|cadence_tip\|train_to_failure\|strength_last_rep\|countdown_321\|hydration_reminder\|strength_halfway\|recovery_protein\|cardio_pos_treino\|strength_start\|strength_set_complete\|strength_finish` (var onde há) | T · 20 s · 10 s | nunca | nunca |
| `academia.descanso_foco` | `InlineRestEngine` botão "Ouvir Alex" ← `GymVerificationPage.tsx:66` | fixo | `alex.treino.treino_descanso_foco` (var) | Tl (toque) · escopo da tela | nunca | nunca |

### 5.2 Alex: telas

| Momento | Quem dispara | Composição | Ids V4 | Prioridade | Olá/nome | Então/nome |
|---|---|---|---|---|---|---|
| `montador.guia` | `AlexCoachBuilderVoiceGuide` (toque) | fixo; pausar e retomar continua do ponto | `alex.montador.como_adicionar_reordenar\|sobrecarga_progressiva\|alerta_lesoes\|alerta_gestante\|conclusao_treino_pronto`, `alex.saudacao.intro_personal_virtual`, `alex.treino.treino_aquecimento_mobilidade\|cardio_pos_treino\|treino_concluido_sucesso` | Tl (toque) | nunca | nunca |
| `montador.divisao` | `alexSplitAudio` ← `onboarding/index.tsx:342` | fixo | `alex.montador.split_ab\|split_abc\|split_abcd\|split_abcde\|split_fullbody` | Tl · escopo `onboarding_alex` | nunca | nunca |
| `onboarding_alex.passo` | `useOnboardingState`, `useAlexOnboardingGuide`, `AlexOnboardingMuteButton` → `alexCoachAudio` | fixo (palavras da tela, sem variar) | `alex.onboarding.<passo>` (15) | Tl · escopo `onboarding_alex` · dedupe 2 s · o passo novo substitui o anterior | nunca | nunca |
| `painel.bom_dia` | `AppleHealthHeroCard` (toque) | [abertura] + fixo | `alex.nome.<slug>` (var v2); `alex.painel.dashboard_bom_dia` (var) | Tl (toque) | **R1**. Sem nome: nada | nunca |
| `painel.sequencia_7` | `AppleHealthHeroCard` (toque; sequência de 7 dias ou mais) | fixo | `alex.painel.streak_7dias` | Tl (toque) | nunca | nunca |
| `conquista.*` | fachada `playFixed` ← `ChallengesDashboard.tsx:575/608/674`, `CreateDuelModal.tsx:310/364`, `DuelCard.tsx:143`, `FlashChallengeBanner.tsx:169`, `MentorChallengesWidget.tsx:534`, `SirleneChallengesPremium.tsx:505`, `useChallengesV2.ts:454/834/964` | fixo | `alex.treino.level_up`, `quest_completed`, `challenge_flash`, `duel_issued\|duel_received\|duel_accepted\|duel_won\|duel_lost`, `streak_3days\|streak_7days` | Tl · 8 s · 30 s | nunca | nunca |
| `apresentacao.alex` | `useAudioCoach.testVoice` (hoje "Olá! Eu sou o Alex" na voz do aparelho) | fixo | `alex.saudacao.intro_personal_virtual` | Tl (toque) | nunca | nunca |

### 5.3 Alarmes (os 3 personagens)

| Momento | Quem dispara | Composição | Ids V4 | Prioridade | Olá/nome | Então/nome |
|---|---|---|---|---|---|---|
| `alarme.habito` | `HabitAlarmOverlay` (botão "Ouvir"; toque automático só no adiado, ver 3.9) → `alarmVoice` | efeito (chime, quando houver) + [abertura] + corpo exato (sem variar) | abertura: `<p>.nome.<slug>` (var v2) ou `<p>.saudacao.ola` (var; o Alex só tem "Olá."). Corpo: `sirlene.alarme.sirlene_alarm_water\|_craving\|_challenge` (+`_nudge`), `alex.alarme.alex_alarm_mission` (+`_nudge`), `drvital.alarme.vital_alarm_sleep\|_weight` (+`_nudge`) | **A** · escopo `alarme` · 60 s · 60 s por tipo | **R7**: nome 1 vez por dia por personagem. Sem nome: "Olá." só se R1 deixar. Adiado: nada | nunca |
| `alarme.previa` | `HabitAlarmVoicePanel` → `previewHabitAlarmClip` | só o corpo | os 12 acima | Tl (toque) | nunca | nunca |

### 5.4 Sirlene

| Momento | Quem dispara | Composição | Ids V4 | Prioridade | Olá/nome | Então/nome |
|---|---|---|---|---|---|---|
| `onboarding_sirlene.passo` | `SirleneSpokenGuide.tsx:196/275/282/289` → `sirleneOnboardingAudio` | fixo (palavras da tela) | `sirlene.onboarding.welcome\|name\|height\|weight\|goal\|activity\|gender\|age\|rules\|meal\|nav` | Tl · escopo `onboarding_sirlene` · dedupe 2 s · o passo novo substitui | nunca (o passo "name" pergunta o nome, mas nenhum passo o diz) | nunca |
| `nutricao.cardapio_iniciando` | `useMealPlanGeneratorV2.ts:119` | fixo | `sirlene.nutricao.cardapio_iniciando` | Tl · 8 s · o "pronto" substitui o "iniciando" que ainda não começou | nunca | nunca |
| `nutricao.cardapio_pronto` | `useMealPlanGeneratorV2.ts:287` | [transição] + fixo | `sirlene.nome.<slug>__entao`; `sirlene.nutricao.cardapio_pronto` | Tl · 8 s · 60 s | nunca | **R3** (etapa nova: preparando → pronto) |
| `nutricao.pesagem` | `SimpleWeightForm.tsx:200` (pesagem salva) | [transição] + fixo | `sirlene.nome.<slug>__entao`; `sirlene.nutricao.pesagem_sucesso` (var) | Tl · 8 s · 60 s | nunca | **R3** |
| `nutricao.agua_meta` | `QuickWaterModal.tsx:154` (meta batida) | fixo | `sirlene.nutricao.agua_meta_batida` (var) | Tl · 8 s · **1 por dia** | nunca | nunca |
| `nutricao.mercado` | `ShoppingListSheet.tsx:108` (toque) | fixo; o mesmo toque para | `sirlene.nutricao.mercado_dica` | Tl (toque) | nunca | nunca |
| `nutricao.refeicao_trocada` | `SwipeToSwapMeal.tsx:74` | **sem V4**: sem voz; a tela já mostra o texto | — | — | — | — |
| `glp1.massa_magra` | `GLP1MuscleDefenseCard.tsx:45-70`, `GLP1ProteinBanner.tsx:45-70` | fixo | `sirlene.dica.glp1_preservacao_musculo` | Tl (toque) | nunca | nunca |
| `glp1.*` (dia da dose, dose registrada; Dr. Vital: introdução, sintomas, sucesso) | `GLP1InjectionCard.tsx:108`, `GLP1InjectionModal.tsx:149-209` | **sem V4**: sem voz (acaba a sobreposição Dr. Vital + Sirlene); a tela já mostra o texto | — | — | — | — |
| `dica.do_dia` | `useDailySpecialistTips` (card) e `SirleneToday.tsx:669` (`SpecialistAudioNote` com `sirleneHomeAudioTips`) | fixo; pausar e retomar | `<p>.dica.<id da dica com _>` (24 de 24, nos 3 personagens) | Tl (toque) · escopo da tela | nunca | nunca |
| `chat.resposta` | `useChatLogic.ts:520-542` (voz ligada) | voz do aparelho (texto dinâmico), nunca junto de parte gravada | nenhum | Tl · escopo `sirlene.chat` · a resposta nova espera a anterior | nunca | **nunca** (sai o "Então, Maria" do chat: ele misturaria a voz gravada com a do aparelho) |

### 5.5 Dr. Vital

| Momento | Quem dispara | Composição | Ids V4 | Prioridade | Olá/nome | Então/nome |
|---|---|---|---|---|---|---|
| `anamnese.secao` | `DrVitalAnamnesisVoiceGuide` (toque; `SystemicAnamnesis.tsx:1522`) | seção 1: [abertura] + fixo. Seções 2 a 8: [transição] + fixo. Pausar e retomar continua do ponto | `drvital.nome.<slug>` (var v2) ou `drvital.saudacao.ola` (var); `drvital.nome.<slug>__entao`; `drvital.anamnese.sec1_dados_pessoais` … `sec8_objetivos_expectativas` | Tl (toque) · escopo `drvital.anamnese` | **R1** na seção 1 (sem nome: "Olá.") | **R3** nas seções 2 a 8 (com o intervalo de 10 min, em geral 1 ou 2 vezes na anamnese inteira) |
| `painel.sequencia_30` | `AppleHealthHeroCard` (toque; sequência de 30 dias ou mais) | fixo | `drvital.painel.streak_30dias` (var) | Tl (toque) | nunca | nunca |
| `assistente.resposta` | `useVoiceAssistant.ts:225-248` (`VoiceInputButton`) | voz do aparelho | nenhum | Tl | nunca | nunca |

### 5.6 Conteúdo do dono, Rafael e o que fica fora

| Momento | Quem dispara | Composição | Ids V4 | Prioridade | Nome |
|---|---|---|---|---|---|
| `recado.do_dia` | `DailyMessageCard.tsx:216-223` → `SpecialistAudioNote` (`audioUrl` do banco) | `url_do_dono` | nenhum (`audio-coach/`, fora do catálogo; o `{nome}` fica só na tela) | Tl (toque); pausar e retomar | nunca |
| `afirmacao.rafael` | `AffirmationsModal.tsx:70-85` | voz do aparelho | nenhum (o Rafael não tem clipes) | Tl (toque) | nunca |
| sessão guiada (Rafael) | `GuidedSessionAudioPlayerModal` (`<audio>` com controles) | **fora da fila**: suspende a fila enquanto toca | — | `suspender('midia_do_dono')` | — |
| ligação | `CharacterCallScreen` / `useCharacterVoiceCall` | **fora da fila**: suspende a fila | — | `suspender('ligacao')` | — |
| saudação ao abrir tela (Hoje, Sirlene, Dr. Vital) | hoje não existe | **não criar**: abrir uma tela não fala sozinho (seria a fala mais repetida do app). A saudação fica no texto do Hero | — | — | — |

O código com áudio que nenhuma tela monta fica fora da fila e é removido em tarefa separada (pendência 11):
`ActiveWorkoutModal`, `SessionExecution`, `SirleneNutritionAudioEngine`, `DrVitalDailyOpinion`,
`integrationManager`, `announce*Greeting`, `announceAlexTransition` e `getVitalEntaoAudio`.

---

## 6. Clipes "Então, Nome,": decisão

**Decisão: SIM, para Sirlene, Alex e Dr. Vital, só como clipe curto e neutro de transição.** Isto revisa a
linha "Acaba o Então" do plano (seção 4): o "Então" volta, mas em poucos momentos e sob a regra R3.

- **Onde entra (7 momentos de transição real):**
  - Alex: `corrida.fim` e `forca.fim`;
  - Sirlene: `nutricao.cardapio_pronto` e `nutricao.pesagem`;
  - Dr. Vital: `anamnese.secao`, nas seções 2 a 8.
- **Onde NÃO entra:**
  - no chat (a resposta é dinâmica e misturaria vozes);
  - nos alarmes (já têm a abertura);
  - no meio do treino, nas dicas, no onboarding e nas conquistas.
- **Os textos de destino encaixam depois de "Então, João,":** "Então, João, manhã vencida!"; "Então, Maria,
  seu cardápio personalizado está pronto!"; "Então, Antônio, para fechar esta etapa…".
- **Texto exato** (neutro: sem tag, sem "!", com acento, terminando em vírgula): `Então, {Grafia},`. Exemplos:
  "Então, João,", "Então, Maria,", "Então, Antônio,", "Então, Luíza,".
- **Id:** `<personagem>.nome.<slug>__entao`, categoria `nome`. Por exemplo: `sirlene.nome.maria__entao`,
  `alex.nome.joao__entao` e `drvital.nome.antonio__entao`.
  - O slug cabe em `[a-z0-9_]{1,60}`: o maior é `elisangela__entao`, com 17 caracteres.
  - Não é variante (`__vN`): cada um é um grupo próprio, e `grupoDoSlug` não muda.
- **Atributos:** fase **3** (sob demanda), prioridade **3**, `comAluno: true`, origem
  `docs/voz/SEQUENCIADOR_DE_AUDIO.md, seção 6`. Os mesmos 205 nomes de `NOMES_IBGE_205`, com a mesma grafia;
  o Rafael não ganha clipe. São **615 clipes**.
- **Custo:**
  - 2.929 caracteres por personagem (média de 14,3), **8.787** no total. O gasto real do V4 tem ficado bem
    abaixo da conta.
  - A geração é feita em 3 rodadas, uma por personagem, cada uma abaixo do teto de 5.000 da fase 3.
  - Antes, as amostras: `sirlene.nome.maria__entao`, `alex.nome.joao__entao` e
    `drvital.nome.antonio__entao`.
  - Se a vírgula final soar cortada de ouvido, troca-se por reticências ("Então, João…"). A receita muda,
    gera um arquivo novo e o custo não pesa.
- **Antes da geração, nada quebra:** `obterAudioDeNome(p, nome, { forma: 'transicao' })` devolve `null` e o
  bloco toca só o fixo, com registro `nome_sem_audio`.
- **Comandos** (gastam saldo e gravam no R2, por isso **só com o OK do dono**):
  - amostras: `npx tsx scripts/audio-v4-gerar.mts --gerar --fase=3 --somente=sirlene.nome.maria__entao,alex.nome.joao__entao,drvital.nome.antonio__entao --max-caracteres=100 --reserva-minima=25000`;
  - cada rodada: `npx tsx scripts/audio-v4-gerar.mts --gerar --fase=3 --somente=alex.nome --max-caracteres=3200 --reserva-minima=25000`, e o mesmo com `sirlene.nome` e `drvital.nome`;
  - depois de ouvir: `npx tsx scripts/audio-v4-gerar.mts --confirm-production --fase=3 --conferido-em=AAAA-MM-DD`.

---

## 7. Ligação ao catálogo V4, categoria por categoria

A troca é por categoria inteira. O app passa a tocar **só ids V4** (`audio/v4/...`). O caminho antigo sai de
quem toca.

| Categoria V4 | Quem passa a usar | O que sai |
|---|---|---|
| `alex.treino` (corrida, força, conquistas) | momentos via `useAudioCoach`, `useWorkoutSound` e a fachada `playFixed` | `ElevenLabsAudioCoach.ts:433` (`/audio/coach/alex/{id}.mp3` montado à mão); `useWorkoutSound.ts:154, 170, 180`; `InlineRestEngine.tsx:197`; a escolha `_f`/`_m` |
| `alex.tecnica`, `alex.imersao` | motor do treino, pelo `mapaLegadoParaV4` (o teste exige 100% dos itens dos catálogos de técnica e imersão traduzidos) | o `audioUrl` dos catálogos deixa de ser tocado. O dado sai na fase 4 do plano, sem troca em massa agora |
| `alex.saudacao` | `corrida.inicio`, `apresentacao.alex` e o guia do montador | `greeting_*` montado à mão; `testVoice` na voz do aparelho |
| `alex.onboarding`, `alex.montador` | `alexCoachAudio`, `alexSplitAudio` e o guia do montador | `alexOnboardingAudio.ts:12`, `/audio/coach/alex/builder/*`, `/audio/coach/alex/onboarding/*` |
| `alex.painel`, `drvital.painel` | `AppleHealthHeroCard` | os arquivos `_f`/`_m` e `/audio/dr-vital/vital_streak_30dias.mp3` |
| `*.alarme` | `alarmVoice` (no app) | `HABIT_ALARM_CLIPS.localUrl` (`/audio/alarms/*`) no app. Os 24 sons nativos só mudam no build nativo (`npm run alarm:sounds`, produção) |
| `*.nome` e `*.saudacao.ola` | o sequenciador (abertura e transição) | `ola_names` e `entao_names` dos catálogos antigos; `vitalAudioCatalog.ts:106-132` (URL montada); os 3 normalizadores (troca por `slugDoNome`) |
| `*.dica` | `useDailySpecialistTips` e `sirleneHomeAudioTips` (via `idV4DaDica`) | `tip.audioUrl`. Também acaba o áudio que não bate com o texto, porque o V4 tem 1 áudio por dica |
| `sirlene.onboarding` | `sirleneOnboardingAudio` | `sirleneOnboardingScript.ts:36-38` (`?v=ejv7`); o export `SIRLENE_ONBOARDING_LINES` continua, porque o teste de roteiros usa |
| `sirlene.nutricao` | cardápio, água, pesagem e mercado | `ElevenLabsAudioCoach.ts:709` e os `new Audio` de `QuickWaterModal`, `SimpleWeightForm` e `ShoppingListSheet` |
| `sirlene.dica.glp1_preservacao_musculo` | `GLP1MuscleDefenseCard` e `GLP1ProteinBanner` | `/audio/coach/sofia/nutricao/sirlene_glp1_cuidado_massa_magra.mp3` e o plano B `announceSirleneGLP1` |
| `drvital.anamnese` | `DrVitalAnamnesisVoiceGuide` | `/audio/dr-vital/anamnese/*` |
| sem V4 | texto que a tela já mostra (pendência 5) | os `new Audio` de GLP-1 (5 falas) e de `refeicao_trocada` |

- **Cache antigo:** `limparCacheDeVozAntigo()` roda na primeira fala e quando a fachada é criada.
  - Chama `indexedDB.deleteDatabase('max_audio_coach_cache')` uma vez só e marca
    `eliving:audio-v4:cache-antigo-limpo` no `localStorage`, com `try/catch`.
  - A fachada deixa de abrir e de gravar esse banco (`ElevenLabsAudioCoach.ts:139, 311-315, 1006-1011`).
- **O app nunca chama a ElevenLabs:** saem a leitura de `VITE_ELEVENLABS_API_KEY` (`ElevenLabsAudioCoach.ts:186,
  1035-1040`) e o ramo de síntese dinâmica. Um teste novo barra `VITE_ELEVENLABS_API_KEY` e
  `api.elevenlabs.io` em `src/`. Rotacionar a chave do `.env` é ação de produção: fica com o dono.
- **Guardião:** os ids literais vivem em `src/lib/audio/momentosDeAudio.ts`, que o `audioV4Guardiao` não varre.
  Por isso `momentosDeAudio.test.ts` confere que **todo** id de todo momento existe no catálogo. A única
  exceção é a forma `__entao`, que é opcional e está listada até ser gerada. A chave `TROCA_CONCLUIDA` do
  guardião só liga depois das 4 unidades e da fase 4.

---

## 8. Módulo de configuração (`src/lib/audio/configSequencia.ts`)

Regra do dono: tudo que é regra deve poder ir ao Admin depois. Todos os números ficam aqui e mais nenhum fica
solto no código. `definirConfigSequencia(parcial)` já aceita sobrescrever (com faixas validadas), sem
persistência por enquanto. O registro no catálogo de regras (`src/lib/rules/catalog.ts`) fica pendente, porque
o arquivo é da outra sessão.

| Chave | Valor | O que controla |
|---|---|---|
| `pausas.aposAberturaMs` | 280 | "Olá, João." → fixo |
| `pausas.aposOlaSemNomeMs` | 250 | "Olá." → fixo |
| `pausas.aposTransicaoMs` | 150 | "Então, João," → fixo |
| `pausas.entreFixosMs` | 300 | fixo → fixo no mesmo bloco |
| `pausas.entreBlocosMs` | 500 | entre blocos do mesmo personagem |
| `pausas.trocaDePersonagemMs` | 800 | entre blocos de personagens diferentes |
| `pausas.aposEfeitoMs` | 150 | depois do efeito sonoro que abre o bloco |
| `preCarga.esperaMaxMs` | 1.500 | espera extra se a próxima parte não carregou |
| `reproducao.tempoParaComecarMs` | 8.000 | sem `playing` nesse tempo = falha de rede (hoje fixo no carregador) |
| `reproducao.folgaParaTerminarMs` | 5.000 | trava: duração + folga |
| `reproducao.semDuracaoMaxMs` | 120.000 | trava sem duração conhecida |
| `retentativa.vezes` / `retentativa.esperaMs` | 1 / 400 | nova tentativa em falha de rede ou de arquivo |
| `interrupcao.parteLongaS` | 7 | acima disso, interrompe no fim da frase |
| `interrupcao.margemFimDeFraseMs` | 120 | margem depois do fim estimado da frase |
| `interrupcao.tetoFimDeFraseMs` | alarme 2.500 · treino 1.500 · por toque 1.200 · escopo 1.200 · segundo plano 1.500 · ligação 1.000 | quanto esperar pelo fim da frase |
| `interrupcao.fadeMs` | 150 | fade de parada (comando do aluno ou teto estourado) |
| `prioridades` | alarme 0 · treino ao vivo 1 · tela 2 | ordem da fila |
| `validadeMs` | alarme 60.000 · treino 20.000 · tela 8.000 · tela por toque 15.000 · pausado por toque 300.000 | validade na fila |
| `dedupeMs` | padrão 10.000 · alarme 60.000 · conquista 30.000 · onboarding 2.000 · fim do treino 60.000 | janela de deduplicação |
| `introExercicioJanelaMin` | 45 | introdução do mesmo exercício |
| `historiaFolgaFimDoDescansoS` | 3 | a história só começa se couber no descanso |
| `maxPorDia` | `nutricao.agua_meta`: 1 | falas automáticas longas |
| `fila.maxItens` | 12 | tamanho da fila |
| `segundoPlano.retomarSeVoltarEmS` | 20 | retomada depois de uma pausa do sistema |
| `vozDoAparelhoNaFalha` | alarme não · treino ao vivo sim · tela não | voz do aparelho em falha de rede (nunca nome) |
| `registro.maxEventos` | 200 | memória do registro |
| `chamada.sessaoInativaMin` | 30 | fim da sessão com o personagem |
| `chamada.aberturaAposHorasSemFalar` | 4 | R1 |
| `chamada.transicaoIntervaloMin` | 10 | R3 |
| `chamada.nomeMaxPorSessao` | 2 | R5 |
| `chamada.intervaloGlobalEntreNomesS` | 90 | R6 |
| `chamada.probUsarNomeNaAbertura` | 0,8 | R2 |
| `chamada.probUsarTransicao` | 0,6 | R3 |
| `chamada.alarmeNomeMaxPorDia` | 1 | R7 |
| `chamada.chaveHistorico` | `eliving:audio-v4:chamadas` | R12 |
| `cache.chaveLimpo` | `eliving:audio-v4:cache-antigo-limpo` | limpeza do IndexedDB uma vez só |

---

## 9. Plano de execução

**Ordem:** primeiro o **núcleo**, sozinho; depois as **4 unidades em paralelo**.

**Regras que valem para todas:**

- **Arquivos:** as listas não se cruzam e nenhuma traz arquivo da outra sessão. Os arquivos da outra sessão só
  são lidos e têm os testes rodados (ex.:
  `npx vitest run src/components/exercise/__tests__/RefitWorkoutPlayer`).
- **Produção e commit:** nada de gerar áudio, gravar ou apagar no R2, push, deploy ou commit (o dono commita).
- **Tom:** português do Brasil, sem tom de bronca, sem "coach" e sem "Sofia" no texto visível.
- **Bibliotecas:** só APIs já usadas no projeto enquanto o Context7 estiver sem cota.
- **Visual:** se uma unidade mudar algo visível, segue o padrão v2 e faz capturas em 360, 390 e 430 px.
- **Verificação de cada unidade:** `npx vitest run src/lib/audio src/lib/voice`, os testes da própria unidade
  e `npm run build`.

### 9.1 Núcleo

**Arquivos:**

- novos: `src/lib/audio/configSequencia.ts`, `src/lib/audio/sequenciador.ts`, `src/lib/audio/frases.ts`,
  `src/lib/audio/chamadaPeloNome.ts`, `src/lib/audio/momentosDeAudio.ts`, `src/lib/audio/mapaLegadoParaV4.ts`,
  `src/lib/audio/useFalaDaTela.ts`, `src/lib/audio/cacheDeVozAntigo.ts`;
- ajustes: `src/lib/audio/catalogoAudio.ts` e `supabase/functions/_shared/audio/roteiros/tipos.ts`;
- testes: `src/lib/audio/__tests__/sequenciador.test.ts`, `frases.test.ts`, `chamadaPeloNome.test.ts`,
  `momentosDeAudio.test.ts`, `mapaLegadoParaV4.test.ts`, `useFalaDaTela.test.tsx` e
  `src/lib/audio/__tests__/catalogoAudio.test.ts` (casos novos).

**O que fazer:**

1. Implementar o contrato da seção 3.2 e o comportamento das seções 3.3 a 3.10, com os números da seção 8 e a
   estratégia da seção 4.
2. Dependências injetáveis: tocador, relógio, armazenamento, visibilidade e `appStateChange`. A instância
   real instala os ouvintes de gesto, de visibilidade e do Capacitor na primeira fala.
3. A tabela da seção 5 em `momentosDeAudio.ts`. Em `mapaLegadoParaV4.ts`:
   - `momentoDoIdAntigo`, para todos os ids de `FIXED_COACH_AUDIOS` e os do `useWorkoutSound`;
   - `idV4DoCaminhoAntigo`, para a técnica (`alex_<cue>` → `alex.tecnica.<cue>`), a imersão
     (`alex_intro_*` e `story_*` → `alex.imersao.*`), o onboarding, o montador e os alarmes;
   - `idV4DaDica`, onde `sirlene-prato-colorido` vira `sirlene.dica.prato_colorido`;
   - a lista fechada `IDS_ANTIGOS_SEM_V4`.
4. Em `catalogoAudio.ts`:
   - `obterAudioDeNome(p, nome, { forma: 'transicao' })` passa a usar `slugDaTransicao` (sem alternar;
     a falta é contada uma vez por sessão);
   - exportar `marcarVarianteTocada(item)`;
   - o `tocadorPadrao` resolve `cancelado` num `pause` externo, em vez de ficar pendurado até duração + 5 s;
   - as constantes de tempo passam a vir da configuração.
5. Em `tipos.ts`: `SUFIXO_DE_TRANSICAO = '__entao'`, `slugDaTransicao` e `ehTransicao`, sem mudar
   `grupoDoSlug`.

**Testes obrigatórios:**

- Ordem e fila: 2 blocos nunca tocam juntos; partes em ordem com as pausas exatas; pré-carregamento da parte
  seguinte e do próximo bloco.
- Interrupção: alarme espera o fim da parte e descarta o resto; parte longa para no fim da frase; mesma
  prioridade em ordem de chegada; o toque substitui a fala automática.
- Fila: validade; época; deduplicação e `ja_na_fila`; `cancelarEscopo` no fim da frase; `pararTudo` com fade;
  pausar e retomar no mesmo ponto.
- Falhas: retentativa única e depois o texto, com a fila seguindo; bloqueio do autoplay; nome fora da lista;
  voz do aparelho só nos casos da seção 3.8.
- Celular: segundo plano; suspender e liberar.
- Registro e garantias: todo descarte tem motivo; `falar()` nunca lança erro.
- Estratégia: R1 a R12, cada uma com caso positivo e negativo; `localStorage` que lança erro.
- Momentos: todos os ids existem no catálogo.
- Mapa: 100% dos cues de técnica e imersão traduzidos para ids V4 que existem.

### 9.2 Unidade 1: Alex ao vivo (`alex-ao-vivo`)

**Arquivos:**

- código: `src/hooks/useWorkoutSound.ts`, `src/features/audio-coach/services/AlexWorkoutAudioEngine.ts`,
  `src/features/audio-coach/constants/alexWorkoutImmersionCatalog.ts` e
  `src/features/audio-coach/constants/alexWorkoutTechniqueCatalog.ts` (só as funções de escolher e marcar,
  sem mexer nos dados), `src/features/audio-coach/hooks/useAudioCoach.ts`, `src/pages/alex/AlexTrackingDemo.tsx`
  (só a origem do nome) e `src/components/exercise/workout/InlineRestEngine.tsx`;
- testes existentes: `src/features/audio-coach/__tests__/AlexWorkoutAudioEngine.test.ts`,
  `src/features/audio-coach/__tests__/AlexWorkoutImmersionCatalog.test.ts` e
  `src/components/exercise/workout/__tests__/WorkoutComponents.test.tsx`;
- testes novos: `src/hooks/__tests__/useWorkoutSound.sequenciador.test.tsx` e
  `src/features/audio-coach/__tests__/useAudioCoach.sequenciador.test.ts`.

**O que fazer:** ligar os momentos `corrida.*`, `forca.*` e `academia.descanso_foco` (5.1) ao sequenciador.

- **`useWorkoutSound`:**
  - mantém **os mesmos nomes exportados e as mesmas assinaturas**, porque `RefitWorkoutPlayer` e os testes
    dele, que não são editáveis, dependem disso;
  - a voz sai por `falarMomento`;
  - os bipes continuam no Web Audio, mas viram `efeito` quando abrem uma fala;
  - implementa a janela de descanso, as épocas e a deduplicação da introdução (3.11) e escuta `alex:audio:stop`;
  - respeita `audioDispatcher.getMode() === 'coach_voice'`;
  - some a escolha `_f`/`_m`.
- **Motor:**
  - escolhe a técnica, a introdução e a história e devolve o momento e os parâmetros;
  - marca "já tocada" só com o resultado `tocou`;
  - a história precisa caber no descanso;
  - saem os `.catch(() => speak(...))`, que nunca rodavam.
- **`useAudioCoach`:**
  - `announceStart` vira `corrida.inicio`;
  - os km viram `corrida.km` (6 a 9 km e de 11 km em diante: só texto, sem voz do aparelho);
  - os passos e o radar viram os momentos com efeito;
  - `announceFinish` vira `corrida.fim`, sem o "Parabéns, nome";
  - "moeda coletada" vira só texto;
  - `testVoice` vira `apresentacao.alex`;
  - parar ou reiniciar a atividade chama `novaEpoca('corrida')`.
- **`AlexTrackingDemo.tsx:96`:** o nome vem de `realFirstName`, sem o e-mail. Só essa linha muda.
- **`InlineRestEngine`:**
  - o botão "Ouvir Alex" passa a usar `useFalaDaTela`;
  - um `AudioContext` só, reaproveitado e fechado ao desmontar;
  - um bipe por marca (hoje toca dois);
  - `onComplete` fora do atualizador do `setState`.

**Verificação:** os testes da unidade e mais `npx vitest run src/components/exercise/__tests__/RefitWorkoutPlayer
src/tests/alex src/pages/alex`, todos verdes sem editar os arquivos da outra sessão.

### 9.3 Unidade 2: fachadas, alarmes, chat e ligação (`fachadas-alarmes-chat`)

**Arquivos:**

- código: `src/features/audio-coach/services/ElevenLabsAudioCoach.ts`,
  `src/features/audio-coach/services/UnifiedAudioDispatcher.ts`,
  `src/features/audio-coach/components/AlexAudioQuickControl.tsx`, `src/services/native-reminders/alarmVoice.ts`,
  `src/components/native-reminders/HabitAlarmOverlay.tsx`, `src/components/sirlene/chat/hooks/useChatLogic.ts`,
  `src/hooks/useMealPlanGeneratorV2.ts`, `src/components/meal-plan/creative/SwipeToSwapMeal.tsx`,
  `src/features/voice-call/useCharacterVoiceCall.ts` e
  `src/components/dashboard/rafael/modals/GuidedSessionAudioPlayerModal.tsx`;
- testes existentes: `src/features/audio-coach/__tests__/ElevenLabsAudioCoach.test.ts`, `AlexAudioCoach.test.ts`,
  `SirleneAudioCoach.test.ts`, `AudioCoachCancellation.test.ts`, `src/services/native-reminders/alarmVoice.test.ts`
  e `src/components/native-reminders/HabitAlarmOverlay.test.tsx`;
- testes novos: `src/features/audio-coach/__tests__/fachadaSequenciador.test.ts` e
  `src/features/voice-call/__tests__/useCharacterVoiceCall.sequenciador.test.tsx`.

**O que fazer:**

- **`ElevenLabsAudioCoach` vira uma fachada fina.** A API pública continua (`getInstance`, `getConfig`,
  `saveConfig`, `stop`, `playFixed`, `playAudioUrl`, `speak`, `isSpeaking`, `onSpeakingChange` e
  `getCurrentAudioId`), porque os desafios, o `useExerciseProgram` e os testes usam. Por dentro:
  - `playFixed(id)` vira `falarMomento(momentoDoIdAntigo(id))`;
  - `playAudioUrl(url)` passa pelo `idV4DoCaminhoAntigo`;
  - `speak` vira a parte `aparelho`, numa fala de tela;
  - `stop()` vira `pararTudo('aluno')`;
  - o estado vem do sequenciador.
- **Sai da fachada:**
  - a síntese dinâmica e a chave `VITE_ELEVENLABS_API_KEY`;
  - o IndexedDB (passa a chamar `limparCacheDeVozAntigo`);
  - a troca de `config.coach` durante a fala;
  - os `announce*` com nome e `announceSirleneTransition`;
  - o plano B duplo (`ElevenLabsAudioCoach.ts:447-461, 720-731`).
- **`UnifiedAudioDispatcher`:**
  - `stopAll()` vira `pararTudo('aluno')` e só para os elementos de terceiros, nunca os do sequenciador;
  - o evento `alex:audio:stop` continua sendo disparado;
  - "Alex falando" passa a vir de `sequenciadorDeAudio.assinar` (sai a regex `/audio/coach/alex/`);
  - `setMode('silent' | 'beeps_only')` chama `pararTudo`;
  - saem os métodos de voz sem chamador.
- **`AlexAudioQuickControl`:**
  - o aviso mostra o personagem que fala;
  - "Silenciar" não grava `silent` quando o que toca não é o treino.
- **Alarmes:**
  - `alarme.habito` com a regra R7 e `alarme.previa`; o Olá vem do V4 (saem `getAlexOlaAudio`,
    `getSirleneOlaAudio` e `getVitalOlaAudio`);
  - o chime vira efeito;
  - não há voz duplicada com o canal nativo (3.9);
  - o plano B não grava mais `saveConfig`;
  - `stopHabitAlarmVoice` passa a cancelar só o escopo `alarme`, sem cortar o treino;
  - o nome vem de `realFirstName`, sem o e-mail.
- **Chat:**
  - sai o "Então, Nome";
  - a resposta com a voz ligada vira `chat.resposta`;
  - ao desmontar, `cancelarEscopo('sirlene.chat')`.
- **Cardápio:**
  - `nutricao.cardapio_iniciando` e `nutricao.cardapio_pronto`, este com a transição quando houver o
    primeiro nome real;
  - `refeicao_trocada` fica sem voz.
- **Ligação e sessão guiada:** `suspender` e `liberar` (3.9).

**Testes obrigatórios:**

- um teste novo barra `VITE_ELEVENLABS_API_KEY` e `api.elevenlabs.io` em `src/`;
- os testes de desafios, GLP-1, chat e cardápio que dependem da fachada continuam verdes;
- verificação: `npx vitest run src/features/audio-coach src/services/native-reminders src/components/native-reminders src/components/sirlene src/components/challenges-v2 src/hooks src/features/voice-call src/components/dashboard/rafael src/tests/certification/batch21-core-secondary.test.tsx`.

### 9.4 Unidade 3: telas, onboarding e falas por toque (`telas-onboarding-toque`)

**Arquivos:**

- onboarding: `src/components/onboarding/sirleneOnboardingAudio.ts`,
  `src/components/onboarding/sirleneOnboardingScript.ts`, `src/components/onboarding/SirleneSpokenGuide.tsx`,
  `src/components/exercise/onboarding/alexCoachAudio.ts`, `src/components/exercise/onboarding/alexOnboardingAudio.ts`,
  `src/components/exercise/onboarding/alexSplitAudio.ts`, `src/components/exercise/onboarding/useAlexOnboardingGuide.ts`,
  `src/components/exercise/onboarding/AlexOnboardingMuteButton.tsx` e
  `src/components/exercise/onboarding/hooks/useOnboardingState.ts`;
- guias, dicas e painel: `src/components/exercise/AlexCoachBuilderVoiceGuide.tsx`,
  `src/features/daily-tips/hooks/useDailySpecialistTips.ts`, `src/components/design-system/SpecialistAudioNote.tsx`,
  `src/lib/sirlene/sirleneHomeAudioTips.ts`, `src/components/dashboard/AppleHealthHeroCard.tsx` e
  `src/components/clinical/DrVitalAnamnesisVoiceGuide.tsx`;
- nutrição e GLP-1: `src/components/tracking/QuickWaterModal.tsx`, `src/components/weighing/SimpleWeightForm.tsx`,
  `src/components/shopping/ShoppingListSheet.tsx`, `src/components/glp1/GLP1InjectionCard.tsx`,
  `src/components/glp1/GLP1InjectionModal.tsx`, `src/components/glp1/GLP1MuscleDefenseCard.tsx` e
  `src/components/glp1/GLP1ProteinBanner.tsx`;
- voz do aparelho: `src/components/dashboard/rafael/modals/AffirmationsModal.tsx` e
  `src/hooks/dr-vital/useVoiceAssistant.ts`;
- testes existentes: `src/components/onboarding/SirleneSpokenGuide.integration.test.tsx`,
  `src/components/onboarding/SirleneSpokenGuide.test.tsx`, `src/components/onboarding/sirleneOnboardingScript.test.ts`,
  `src/components/exercise/onboarding/alexCoachAudio.test.ts`, `src/components/exercise/onboarding/alexOnboardingAudio.test.ts`,
  `src/components/exercise/onboarding/alexSplitAudio.test.ts` e `src/lib/sirlene/sirleneHomeAudioTips.test.ts`;
- testes novos: `src/components/design-system/__tests__/SpecialistAudioNote.sequenciador.test.tsx` e
  `src/components/clinical/__tests__/DrVitalAnamnesisVoiceGuide.sequenciador.test.tsx`.

**O que fazer:** ligar os momentos `onboarding_alex.passo`, `onboarding_sirlene.passo`, `montador.*`,
`painel.*`, `dica.do_dia`, `nutricao.agua_meta`, `nutricao.pesagem`, `nutricao.mercado`, `glp1.massa_magra`,
`anamnese.secao`, `recado.do_dia`, `afirmacao.rafael` e `assistente.resposta` (seção 5). Tudo por
`useFalaDaTela` ou `falarMomento`, sem nenhum `new Audio` nem `speechSynthesis` direto nesses arquivos.

- **Onboardings:**
  - um passo por vez, com deduplicação de 2 s (sai a trava de 700 ms) e o passo novo substituindo o anterior
    no fim da frase;
  - os mudos de cada onboarding continuam valendo;
  - `SIRLENE_ONBOARDING_LINES` e `ALEX_ONBOARDING_GUIDE` seguem exportados.
- **`SpecialistAudioNote`:**
  - aceita `audioId` (V4) ou `audioUrl` (recado do dono, como `url_do_dono`);
  - pausar e retomar continua do ponto, e o progresso vem do estado do sequenciador;
  - sem `Audio` criado à toa ao montar.
- **Dicas:** `idV4DaDica`; a dica sem áudio mostra só o texto (sem voz do aparelho).
- **Anamnese:**
  - o primeiro nome vem do hook de autenticação que já existe (buscar antes de criar; não editar
    `SystemicAnamnesis.tsx`);
  - abertura na seção 1 e transição nas seções 2 a 8.
- **GLP-1:** as falas sem V4 param de tocar e a tela mantém o texto.
- **Painel:** as escolhas `_f`/`_m` somem.
- **Afirmações e assistente:** viram a parte `aparelho`, na fila.

**Verificação:** os testes da unidade e mais `npx vitest run src/components/onboarding src/components/exercise/onboarding
src/components/dashboard src/components/__tests__/SystemicAnamnesis src/components/glp1 src/components/tracking
src/components/weighing src/pages/__tests__/MaxDashboardPage src/tests/certification/batch01-anamnesis.test.tsx
src/tests/certification/batch17-rafael-features.test.tsx`. Se algo visível mudar, capturas em 360, 390 e 430 px.

### 9.5 Unidade 4: roteiros do "Então" (`roteiros-entao`)

**Arquivos:** `supabase/functions/_shared/audio/roteiros/nomes.ts`, `src/lib/audio/__tests__/roteiros.test.ts`,
`docs/voz/PLANO_AUDIOS_V4.md` e `docs/voz/REGRAS_VOZ_ELEVENLABS.md`.

**O que fazer:**

1. Em `nomes.ts`, acrescentar a forma de transição (seção 6): `textoDoClipeDeNome` ganha a forma `'transicao'`,
   que devolve `Então, {grafia},`. `clipesDeNome` acrescenta, **depois** das 205 versões 1 e das 205 versões 2
   (a ordem e os textos atuais não mudam), os 205 itens `<slug>__entao` (com `slugDaTransicao` de `tipos.ts`),
   fase 3, prioridade 3 e origem da seção 6. As 3 amostras também ficam na fase 3.
2. Em `roteiros.test.ts`:
   - a categoria `nome` passa a ter 1.845 itens (615 por personagem);
   - o "Olá, Nome." continua sendo a base;
   - um teste novo: os 615 `__entao` são neutros (0 tags, sem "!"), seguem o molde único `Então, {Grafia},` e
     estão na fase 3 com prioridade 3;
   - a regra "nenhum item na fase 3" passa a aceitar só os `__entao`;
   - os caracteres da fase 3 por personagem ficam no máximo no teto de 5.000.
3. Nos documentos:
   - registrar no plano, seção 4, que o "Então" volta só como clipe curto de transição, com a regra R3 e o custo;
   - em `REGRAS_VOZ_ELEVENLABS.md`, seção 7.3, explicar o clipe de transição (não é variante, é neutro e é
     usado pelo sequenciador).
4. **Não rodar o ensaio do gerador com rede nem gerar nada.**

**Verificação:** `npx vitest run src/lib/audio` (roteiros, naturalidade e guardião) e
`node --import tsx --test scripts/tests/audio-v4-gerar.test.mjs`.

---

## 10. Pendências

1. **`RefitWorkoutPlayer.tsx` (outra sessão):**
   - trocar os 3 `setTimeout` (`:523-531`) por uma chamada única ao motor;
   - pôr uma trava "já tocou neste exercício" no efeito `:262-270`.

   O motor já compensa os dois (janela de descanso e deduplicação), então isso é só limpeza.
2. **`ActiveWorkoutContext.tsx` (outra sessão):** o alerta de fim do descanso (`:730`) toca por cima da voz.
   Quando o arquivo for liberado, ele vira o `efeito` do sequenciador.
3. **`src/lib/rules/catalog.ts` (outra sessão):** registrar os números da seção 8 como regras editáveis no Admin.
4. **Gerar os 615 clipes "Então, Nome,"** (fase 3, 3 rodadas de cerca de 2,9 mil caracteres, mais as
   amostras) e subir ao R2. É produção: só com o OK do dono (comandos na seção 6).
5. **Falas usadas que não têm V4:**
   - `split_6km` a `split_9km` e de 11 km em diante;
   - `cardapio_refeicao_trocada`;
   - GLP-1: `glp1_dia_dose`, `glp1_dose_registrada` e, do Dr. Vital, `glp1_intro_aplicacao`,
     `glp1_alerta_sintomas` e `glp1_sucesso_registro`;
   - saudação de horário e apresentação da Sirlene e do Dr. Vital;
   - guias de nutrição;
   - "moeda coletada".

   Até serem gerados, ficam só no texto da tela.
6. **Mudo único:** hoje `max_workout_audio_mode`, `max_audio_coach_config.enabled` e `alarmVoicePrefs` são
   separados. Unificar é decisão de produto e do Admin; até lá, cada chamador confere o seu.
7. **Rotacionar `VITE_ELEVENLABS_API_KEY`** do `.env`: produção, ação do dono.
8. **Os 24 sons nativos de alarme** seguem antigos até o build nativo (`npm run alarm:sounds`): produção.
9. **Conferir em aparelho:**
   - autoplay sem gesto no iOS e no PWA;
   - JS e áudio da corrida com a tela apagada (Android e iOS);
   - fade no iOS (o volume do elemento não muda);
   - `preload` no iOS.
10. **Context7 sem cota (429):** quando a cota voltar, conferir `HTMLMediaElement` (`preload`, `readyState`,
    `pause` do sistema) e `@capacitor/app` (`appStateChange`) antes de mexer de novo no sequenciador.
11. **Remover o código morto com áudio** (lista na seção 5.6) em tarefa separada.
12. **`public/dr-vital-audio-player.html`** monta caminhos `/ola/` e `/entao/` antigos: atualizar ou remover
    em tarefa separada.
13. **`src/components/exercise/unified-timer/hooks/useTimerSound.ts:41`** cria um `AudioContext` por bipe:
    tarefa separada.
14. **Abaixar a música de fundo (ducking) com foco de áudio nativo** exige plugin: fora do escopo.
15. **Catálogos antigos e normalizadores** (`alexAudioCatalog`, `sirleneAudioCatalog`, `vitalAudioCatalog`,
    `audioCatalog`, `public/specialist_audio_catalog.json`) e o `audioUrl` dos catálogos de técnica e imersão
    saem na fase 4 do plano. `TROCA_CONCLUIDA` do guardião só liga depois disso.
16. **`quest_completed` numa tela da Sirlene** continua na voz do Alex, porque não há clipe da Sirlene.
    Mantém-se o Alex até o dono decidir.
17. **Enviar ao Admin a contagem de faltas** (`aoFaltarAudio` e o registro): "nomes mais pedidos sem áudio" e
    "falas que falharam".
18. **Voz do aparelho nas respostas do chat e do assistente** não é a voz do personagem. Quando houver, essas
    respostas devem ir pela ligação ou pelo gateway.

---

## 11. Como conferir

- **Núcleo e regras:** `npx vitest run src/lib/audio src/lib/voice`.
- **Treino sem editar a outra sessão:** `npx vitest run src/components/exercise/__tests__/RefitWorkoutPlayer src/tests/alex`.
- **Tudo junto:** `npx vitest run` nas pastas da seção 9 e `npm run build`.
- **De ouvido, depois da troca publicada:**
  - corrida de 2 km com o celular no bolso: saudação, 2 marcos e o fim, sem corte;
  - treino de força com descanso de 60 s: dica técnica inteira, depois o descanso, depois a história que cabe,
    e "Pular" silencia sem a história voltar;
  - alarme durante o treino: espera o fim da frase do Alex e toca;
  - onboarding tocando "Próximo" rápido: um passo por vez, sem repetir;
  - anamnese: "Olá, Antônio." na seção 1 e, em geral, um único "Então, Antônio," até o fim.
- **Registro:** `sequenciadorDeAudio.registro()` no console do app em desenvolvimento mostra cada descarte com
  o motivo.
