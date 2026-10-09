# fixes.md — Correções aplicadas (Wave crítica)

Data: 2026-09-22
Escopo: 3 achados críticos da auditoria visual
Produto: alterações mínimas; rotas e comportamento preservados

## 1) Redirect `/auth&v=` → `/auth?v=` (DES-001 / P0)

**Arquivo:** `src/components/ui/AppRootErrorFallback.tsx`  
**Função:** `handleCleanAndReload`

**Antes:** o separador de query era escolhido com base na URL *atual* (`?` → `&`). Ao navegar para o path novo `/auth`, isso gerava `/auth&v=<ts>` (404 na SPA).

**Depois:** sempre monta `/auth?v=<timestamp>`.

**Preservado:** limpeza de caches/SW, destino `/auth`, parâmetro `v` anti-cache, botões Tentar Novamente / Tela de Login.

## 2) Overlay de atualização `z-[99999]` → `z-50` (DES-002 / P1)

**Arquivos:**
- `src/components/pwa/ForceUpdateScreen.tsx` — full-screen force update
- `src/components/ui/AppRootErrorFallback.tsx` — fallback “Nova Versão Pronta”
- `src/components/pwa/UpdatePrompt.tsx` — full-screen chunk/update blocker (`z-[9999]` → `z-50`)

**Antes:** `z-[99999]` / `z-[9999]` acima de todo o chrome; risco de cobrir a UI de forma extrema.

**Depois:** `z-50` (camada típica de modal/dialog do design system). O overlay continua `fixed inset-0` e só monta enquanto ativo — bloqueia interação apenas quando visível; não remove o modal.

**Não alterado:** players de treino / activity com z alto próprio (fora do escopo).

## 3) “Hoje” duplicado — top tabs vs bottom nav (DES-005 / P1)

**Arquivos (rótulo visível apenas; `value="hoje"` / rotas intactos):**
- `src/components/dashboard/character-dashboards/AlexDashboardHub.tsx`
- `src/components/dashboard/character-dashboards/RafaelDashboardHub.tsx`
- `src/components/dashboard/character-dashboards/SirleneDashboardHub.tsx`
- `src/components/dr-vital/DrVitalDashboardHub.tsx`

**Antes:** tabs superiores e bottom nav ambas exibiam “Hoje”.

**Depois:** bottom nav mantém **Hoje** (`BottomNavigation` / `getCanonicalNavItems`); tabs superiores passam a **Início** (mesmo `value="hoje"`, mesma navegação/`?tab=hoje`).

**Preservado:** handlers, query params, TabsContent, DrVitalHojeView.

## Fora desta rodada (não alterado)

- Páginas standalone sem bottom nav
- Dr Vital bottom nav no desktop 1440
- Modal refeição Sirlene vs bottom nav
- Dialog espontâneo Comunidade
- Academia chrome stack
- Coach tours

## Status

3/3 correções críticas aplicadas.  
Nenhuma refatoração colateral.  
Registrar continuidade na Wave 1 do `09-DESIGN-FIX-PLAN.json` quando autorizado.

## 4) Neon por especialista (opção A) — 2026-09-22

**Decisão:** opção A aprovada na call (neon por especialista; mesma linguagem, personalidade diferente).

### Token criado
- `--specialist-neon` em `src/lib/specialistTokens.ts` (+ interface, `SPECIALIST_CSS_VARS`, `ALEX_PORTAL_VARS`)
- Fallback em `src/index.css` (`:root`)
- Tailwind: `colors.specialist.neon`

### Paleta aplicada (HSL triples)
| Especialista | neon (hex ref) | glow |
|---|---|---|
| Sirlene | 185 88% 54% (#22E3F1) | ciano colorido |
| Alex | 218 100% 65% (#4D8FFF) | azul elétrico (era quase preto) |
| Dr Vital | 350 100% 65% (#FF4D6A) | vermelho |
| Rafael | 266 100% 74% (#B57BFF) | violeta |
| Max | 196 83% 65% (#5EC8F0) | ciano-hub |

### Onde aplicado (somente ênfase)
- `index.css` bloco **NEON LANGUAGE**: CTA `.bg-primary`, aba `[role=tab][data-state=active]`, nav Dr Vital `.active`, `:focus-visible`, `[data-emphasis]/status-emphasis`
- Abas Alex/Sirlene/Rafael: texto/borda/sombra ativa → `--specialist-neon`
- `alex-color-system.css`: `--alex-glow` colorido de novo
- `SpecialistScope` injeta `--specialist-neon` automaticamente via CSS vars

### Não alterado
- Layout, espaçamento, tipografia
- As 3 correções críticas permanecem intactas:
  1. auth `/auth?v=` (não `&`)
  2. overlays de update em `z-50`
  3. tabs superiores **Início** (bottom nav **Hoje**)



## 4b) Neon visibility boost (same option A)

**Diagnóstico:** token `--specialist-neon` já estava no CSS servido pelo Vite (HMR ok), mas o efeito era só glow fraco — fácil de não notar. CTAs dos hubs muitas vezes não dependem só de `shadow`.

**Correção mínima:** dentro de `[data-specialist]`, remapear `--primary`, `--ring` e `--shadow-glow` para o neon; reforçar borda/halo do CTA e aba ativa. Sem mudar layout/tipo/espaço. Críticas 1–3 intactas.

## 5) VideoOnboardingModal — redesign premium + remoção do step de cor (2026-09-22)

**Arquivo:** `src/components/onboarding/VideoOnboardingModal.tsx`  
**Docs/testes:** batch22 #14/#15, batch23 #8; registro neste `fixes.md`.

### Mudanças
1. **Removido step 0 (escolha de tema/cor).** Cor do especialista vem de `SpecialistScope` + tokens `--specialist-neon`, `--specialist-primary`, `--specialist-glow`, `--specialist-accent`, `--specialist-on-primary` (e `--primary`/`--ring` já remapeados no neon language).
2. **Fluxo:** step 2 (dados corporais) → step 3 (metas). Progresso 1/2 e 2/2. Rascunho antigo em step 0 mapeia para step 2.
3. **UI premium** nos steps 2 e 3: inputs, radios, bordas, ícones, título e CTAs no neon do especialista ativo (sem amber/orange no chrome do formulário). Cards de macro no step 3 mantêm cores semânticas.
4. **Badge** “Com {Sirlene|Alex|Dr. Vital|Rafael|Max}” conforme personagem do menu (`useMenuStyleContextSafe` → `specialistFromCharacter`).
5. **Conclusão:** `handleSaveAndComplete` grava perfil + medição + `nutritional_goals`, seta `onboarding_completed: true`, flags localStorage, celebração, `onComplete()` (fecha no `InteractiveTutorial` via `closeCompletion`), navega com `getCharacterDashboardRoute(selectedCharacter)` e dispara tour do personagem ativo.
6. **Guard:** se step 3 restaurar sem `calculatedGoals`, UI usa `effectiveStep = 2` (evita modal em branco).
7. **Críticas 1–3 e token neon base:** intocados.

### Teste do botão avançar/concluir
- Wiring: **Calcular metas** → `handleCalculate` → step 3; **Começar** → `handleSaveAndComplete` → `onboarding_completed: true` + `onComplete()`.
- `npm run typecheck:app`: passou após o rewrite.
- Certificação onboarding atualizada para o fluxo sem step de cor (execução na mesma sessão).

## 6) VideoOnboardingModal — remoção do vídeo (2026-09-22)

**Arquivo:** `src/components/onboarding/VideoOnboardingModal.tsx` (+ `InteractiveTutorial.tsx`)

### Decisão
Não havia player/iframe/`<video>` no JSX do modal redesenhado — só resíduos de API (`videoUrl?: string`) e comentário no `InteractiveTutorial` passando `videoUrl=""`. Nenhum asset `.mp4`/`.webm` exclusivo deste onboarding foi encontrado em `public/` ou `src/` (URLs de exercício/YouTube em outros módulos permanecem intactas).

### O que foi removido
- Prop `videoUrl` da interface e qualquer passagem no `InteractiveTutorial`
- Comentário “Modal de Onboarding com Vídeo”
- Sem apagar parsers/schemas de vídeo de treino (`videoUrlParser`, `VideoUrlSchema`, etc.) — uso compartilhado

### Layout
Formulário premium (dados corporais → metas) já ocupava 100% do card com `SpecialistScope` + neon; sem faixa de vídeo residual para recolher. Mantidos steps 2 e 3.

### Intocado
Críticas 1–3 (auth `?`, `z-50`, Início/Hoje) e token `--specialist-neon`.

### Screenshot
`docs/audit/MAX-GROK-DESIGN-AUDIT/screenshots/video-onboarding-modal-premium.png` (390×844, especialista Rafael, sem vídeo / sem step de cor).

## 7) Academia — FAB flutuante redundante removido (DES-013) — 2026-09-22

**Arquivo:** `src/components/exercise/ExerciseDashboard.tsx`

### Problema
Chrome empilhava Back + tabs locais + bottom nav + FAB flutuante de criar/importar (além de CTAs no header/Planos).

### Correção
- Removido o FAB flutuante via `createPortal` ("Montar treino" / "Importar ficha").
- Ações de criar/importar permanecem na aba Planos / `openCreateWorkout` (sem perda de função).
- Bottom nav global e tabs locais da Academia mantidos; comentário DES-013 no arquivo.

### Intocado
Auth `?`, overlays `z-50`, Início/Hoje, neon opção A, VideoOnboardingModal.

## 8) Dr Vital — nav contextual removida; Cuidados via Mais (DES-020) — 2026-09-22

**Arquivos:**
- `src/components/dr-vital/DrVitalDashboardHub.tsx`
- `src/components/dr-vital/views/DrVitalMaisView.tsx`
- `DrVitalBottomNav` (já ≤5: Hoje / Desafios / Clínica / Saúde 360 / Mais)

### Problema
Nav contextual superior (Início/Cuidados/Clínica/Evolução) somava itens ao chrome mobile e competia com a bottom nav.

### Correção
- Removida a nav contextual superior (`dr-vital-context-nav`).
- Bottom nav permanece com no máximo 5 itens visíveis.
- Ferramenta `cuidados` adicionada em Mais; `onNavigateAction('cuidados')` → `handleTabChange('cuidados')` (rota/view preservada).

### Intocado
Críticas 1–3, neon, onboarding redesign.

## 9) Páginas órfãs — SpecialistStandaloneShell nas rotas (DES-orphans) — 2026-09-22

**Arquivos:**
- `src/components/layout/SpecialistStandaloneShell.tsx` (novo)
- `src/App.tsx` — wrap em `/recipes`, `/exams`, `/exames`, `/meus-treinos`

### Problema
Receitas, exames e meus-treinos abriam sem SpecialistScope / bottom nav do especialista ativo.

### Correção
- Shell mínimo: `SpecialistScope` + `BottomNavigation` (`getCanonicalNavItems`) + padding inferior seguro.
- Header do shell opcional (`hideHeader` nas rotas que já têm Voltar próprio).
- Navegação das seções → `/dashboard?section=…` sem perder rotas.

### Intocado
Páginas internas restauradas sem wrap JSX quebrado; só wrap no nível de Route.

## 10) Help FAB duplicado — só flutuante (DES-008) — 2026-09-22

**Arquivo:** `src/features/character-tour/CharacterTourProvider.tsx` (`data-tour="help-fab"`)

### Achado
Não havia segundo HelpCircle de tour no `MobileHeader` — apenas o FAB flutuante do provider. Nenhuma remoção adicional necessária.

### Ajuste de posição
FAB permanece `fixed` acima da bottom nav (`bottom: calc(68px + safe-area + 12px)`), z-40 (sobe no passo do tour).

## 11) Tours / force-update vs chrome (DES-tours) — 2026-09-22

**Arquivos:**
- `src/features/character-tour/CharacterTourProvider.tsx`
- `src/components/pwa/ForceUpdateScreen.tsx` (já `z-50`)

### Correção
- Overlay do tour: `fixed inset-x-0 z-[45] top-12 bottom-[calc(64px+env(safe-area-inset-bottom,0px))]` — não cobre header nem bottom nav de forma permanente.
- Catcher de clique: `absolute inset-0` dentro do container com insets.
- Card do tour permanece `z-[10015]` só enquanto o passo está aberto.
- `ForceUpdateScreen` permanece `z-50` e só bloqueia enquanto visível.

### Intocado
Auth `?`, Início/Hoje, neon, VideoOnboardingModal.

## 12) VideoOnboardingModal — paleta neutra quente fixa (2026-09-22)

**Arquivo:** `src/components/onboarding/VideoOnboardingModal.tsx`

### Decisão
- Removido `SpecialistScope` e herança de tokens do especialista (ex.: Rafael / neon violeta).
- Paleta neutra quente FIXA: accent verde-floresta `#2F6B4F`, fundo carvão `#1A1A1A`, texto `#F5F5F5`.
- Rótulo do cabeçalho: **Saúde 360** (sem nome de especialista).
- Fluxo em uma página (dados + metas em scroll); sem vídeo; sem step de cor.
- Botão Concluir / salvar metas preservado.

### Intocado
Auth `?`, overlays `z-50`, Início/Hoje, neon dos hubs, demais correções da auditoria visual.

## 13) Hub tabs 30px/12px → 44px/14px (DES-tabs-P0) — 2026-09-22

**Problema:** Tabs segmentadas dos hubs mediam ~30px de altura e ~12px de fonte (text-xs), abaixo do contrato (CTA ≥44px; tipografia de controle alinhada ao utton.tsx text-sm / h-11).

**Componentes distintos (4), não um átomo único:**
1. `src/components/dashboard/character-dashboards/SirleneDashboardHub.tsx` — `TAB_CLASS` + `TabsList`
2. `src/components/dashboard/character-dashboards/RafaelDashboardHub.tsx` — `TAB_CLASS` + `TabsList`
3. `src/lib/alex/alexHubChrome.ts` — `ALEX_HUB_TAB_TRIGGER_CLASS` + `ALEX_HUB_TABS_LIST_CLASS` (consumido por `AlexDashboardHub`)
4. `src/components/dr-vital/views/DrVitalClinicaView.tsx` — faixa segmentada da Clínica (botões custom, não TabsTrigger)

**Max:** `CompleteDashboard` (personagem complete) não tem essa faixa h-[30px]; sem alteração.

### Correção
- Trigger: `min-h-[44px] h-11` + `text-sm` (14px), removido `no-min-h` / `h-[30px]` / `text-xs`.
- Lista: `h-12 min-h-[48px]` (cabe o trigger 44px + `p-0.5` sem colidir com Header 52 / BottomNav 61).
- Cores, neon, tipografia Inter/Lora, spacing de seções e demais fixes da auditoria: intocados.

### Intocado
Auth `?`, overlays `z-50`, Início/Hoje, neon dos hubs, VideoOnboardingModal, BottomNavigation labels (chrome separado).


## 14) Órfãs — headings Lora + ritmo de gap 6px (DES-orphan-P0) — 2026-09-22

**Problema:** Academia (chrome MobileHeader), Receitas, Exames e Meus Treinos usavam títulos Inter bold soltos (text-lg/xl/2xl) e stacks space-y-8 / space-y-4 / gap-4 (~32px / 16px) vs régua Home gap 6px + Lora `ds-heading`.

**Arquivos:**
- `src/pages/RecipesPage.tsx` — h1 Hero Lora 22px; h2 seção Lora 15px; `space-y-8` → `space-y-1.5`
- `src/components/exams/ExamsPage.tsx` — h1 Hero Lora 22px; h2 Lora 15px; `space-y-4` → `space-y-1.5`; grid `gap-4` → `gap-1.5`
- `src/pages/MyWorkoutsPage.tsx` — h1/h2 Lora; stacks `space-y-4/6` → `space-y-1.5`
- `src/components/navigation/MobileHeader.tsx` — título de subpágina (ex.: Academia) `ds-heading` Lora 15px

### Intocado
Sirlene congelada, tabs dos hubs, controles h-8/h-10 em massa, neon/cores.

## 15) Controles h-8/h-10/h-12 em 154 arquivos — BLOQUEADO (ambíguo)

Pedido de substituição em massa em 154 arquivos (chat/modais Sirlene + Alex) conflita com “não alterar Sirlene congelada geometricamente” e mistura átomos clicáveis vs chrome decorativo. **Parado sem editar** — aguarda escopo (lista P0 de componentes clicáveis) antes de aplicar.


## 16) Fila tipografia/densidade P0–P2 (2026-09-22)

### P0 Headings órfãs (já em §14)
Receitas / Exames / Meus Treinos / MobileHeader Academia → `ds-heading` Lora Hero 22px / seção 15px.

### P1 Densidade órfãs (já em §14)
Receitas `space-y-8`→`space-y-1.5`; Exames `space-y-4`/`gap-4`→`1.5`.

### P1 Controles chat/modais Sirlene (sem tocar Home `today/`)
- `sirlene/chat/ChatHeader.tsx`, `MessageInput.tsx`: hit-area `h-11`
- `SirleneConfirmationModal.tsx`: input/select/button `h-11`
- `PremiumExamUploader.tsx`, `ScientificArticleModal.tsx`, `SirleneIntegratedChat.tsx`, `NutritionDossierPage.tsx`, `SmartSupplementsPageContent.tsx`: botões ícone `h-11`
- Átomo `button.tsx` permanece `h-11` para todos os sizes

### P2 Métricas Alex
- `dashboard/alex/alex-home.css` `.alex-movement-stats strong`: 17px → **15px** tabular (hierarquia seção); labels `small` 9.5px mantidos

### Intocado
Home Sirlene (`today/`), tabs hubs, hex/tokens, dados.

## 2026-09-22 — Merge player vivo Alex + Refit (runtime)

**Pedido:** usar `AlexActiveWorkoutView` como base visual completa do player ao vivo e preservar play/pause do Refit; substituir a TELA 5 do `RefitWorkoutPlayer` no runtime (`App.tsx` já monta o Refit).

**O que mudou:**
- `AlexActiveWorkoutView.tsx`: botão Pausar (`pauseWorkout`), sync de séries com a sessão, descanso espelhado do contexto, `startRestTimer` ao concluir série / iniciar descanso, `updateSet` ao anotar carga.
- `RefitWorkoutPlayer.tsx`: mantém TELA 7 (pausa) + modais; desativa descanso fullscreen; TELA 5 renderiza `AlexActiveWorkoutView` dentro de `SpecialistScope id="alex"`.
- Sirlene: não alterada.
- Dados: sem inventar — só sessão real / `—`.

**Typecheck:** `npm run typecheck:app` (a registrar).

**Screenshots:** play + pause 390×844 (a anexar).

## 2026-09-22 — Player vivo: Alex visual + pause Refit (runtime)

**Pedido:** mesclar o pack visual `AlexActiveWorkoutView` no player ao vivo, preservar play/pause do Refit, substituir a TELA 5 no runtime (`App` já monta `RefitWorkoutPlayer`).

**Arquivos:**
- `src/components/exercise/AlexActiveWorkoutView.tsx` — Pausar, sync de séries, `startRestTimer`, `updateSet`
- `src/components/exercise/RefitWorkoutPlayer.tsx` — TELA 5 = Alex + `SpecialistScope id="alex"`; TELA 7 pause preservada; descanso fullscreen desativado
- `docs/audit/MAX-GROK-DESIGN-AUDIT/fixes.md` — este registro

**Não alterado:** Sirlene; schema/auth/billing; dados inventados.

**Typecheck:** `npm run typecheck:app` — exit 0.

**Screenshots 390×844:** play (`player-play-390x844.png`) e pause (`player-pause-390x844.png`).

## 2026-09-22 — Pacote player+miniplayer + P0 Suplementação Inteligente

### Miniplayer (`GlobalWorkoutMiniPlayer.tsx`)
- SpecialistScope `id="alex"`; tokens `--specialist-*` (azul Alex, glow controlado)
- Títulos curtos em `font-serif` (Lora); UI Inter; touch ≥44px play/pause/expand
- Play/pause e reopen do player principal preservados; Sirlene Home intocada

### Suplementação Inteligente (P0)
- Causa: 155× `amber-*` + 10× no card (amarelo/âmbar dominante em tela Sirlene)
- Troca mecânica amber→emerald / yellow→teal; accent helper sem gold/amber
- `SuplementosPage` envolvida em SpecialistScope `id="sirlene"`
- Home Sirlene / SirleneDashboardHub: não alterados

### Typecheck
`npm run typecheck:app` — exit 0

### Screenshots
390×844: miniplayer play/pause, player (já no pacote anterior), suplementação pós-fix

## 11) Receitas órfã `/recipes` — typography P0 (Inter→Lora) + ritmo/touch (2026-09-22)

**Arquivo:** `src/pages/RecipesPage.tsx`  
**Rota:** `/recipes` (alias `/receitas`) via `SpecialistStandaloneShell` + `SpecialistScope id="sirlene"`

**Antes (relatório 11-FULL-VISUAL-SWEEP-175):**
- `h1` Inter ~30px (CSS opt-out `h1:not(.ds-heading)`)
- `h2` Inter ~24px
- gaps de seção ~32px (fora do ritmo Home 6px)
- chips/CTA abaixo de 44px em pontos

**Depois:**
- `h1`/`h2`/`h3` com `ds-heading font-serif` + `fontFamily: Lora` (hero/seções)
- UI restante em Inter; tokens via `SpecialistScope` Sirlene (página) + shell do especialista ativo
- seções `space-y-1.5` (~6px); header/filtros densificados (`mb-1.5`, `gap-1.5`, `py-3`)
- touch ≥44px: voltar, Nova Receita, SourceTab, CTA empty
- empty copy preservada; regra SEM DADO=`—` / ZERO REAL=`0` mantida no produto (esta tela não inventa métricas)

**Preservado:** Sirlene Home congelada (não editada); sem mudança de schema/dados.

**Verificação:**
- `npm run typecheck:app` → exit 0
- live Playwright 390×844: `h1` Lora 22px `ds-heading`; `h2` Lora 15px `ds-heading`
- screenshot: `screenshots/grok-design-director/receitas/recipes-p0-after-390x844.png`

**Próximo (aguardando autorização):** Exames.

## 12) Receitas `/recipes` — cor alinhada aos tokens Sirlene (2026-09-22)

**Arquivo:** `src/pages/RecipesPage.tsx`

**Problema:** Usuária reportou que "não tá a cor do dashboard". A página já tinha `SpecialistScope id="sirlene"` (sem hex), mas ainda usava `bg-background` / `bg-primary` / `border-border` genéricos — identidade visual fraca vs hub Sirlene.

**Depois:**
- Root/header/empty/search/tabs/CTAs migrados para `bg-specialist-surface`, `bg-specialist-surface-strong`, `bg-specialist-primary`, `text-specialist-on-primary`, `border-specialist-border`, `shadow-specialist-glow`
- Zero hex hardcoded na página
- Tipografia P0 anterior preservada (Lora `ds-heading`, gaps `space-y-1.5`, touch ≥44px)
- Sirlene Home não alterada

**Verificação:**
- `npm run typecheck:app` → exit 0
- Live: `data-specialist=sirlene`; `--specialist-primary: 184 80.3% 47.8%` (≈ #18CFDC); h1 Lora 22px
- Screenshot: `screenshots/grok-design-director/receitas/recipes-color-tokens-390x844.png`

## 13) Receitas — anti-âmbar: forçar Sirlene no shell + CTAs (2026-09-22)

**Relato:** botões dourados/âmbar na página Receitas (mesmo padrão da Suplementação).

**Causa:** não havia `amber-*` hardcoded em `RecipesPage`. O `SpecialistStandaloneShell` herdava o personagem ativo (ex.: Rafael, secondary HSL 38° âmbar) no escopo externo e no dock; drawers/portais saíam do escopo Sirlene e podiam herdar primary/secondary do tema.

**Correção:**
- `SpecialistStandaloneShell`: prop `forceSpecialistId`; rota `/recipes` com `forceSpecialistId="sirlene"` (nav canônica nutrition)
- Cards/drawer/sheet: `bg-primary` → `bg-specialist-primary` / on-primary; `SIRLENE_PORTAL_VARS` + `data-specialist="sirlene"` no `SheetContent`
- Zero hex amber/yellow na árvore de Receitas; CTAs ciano Sirlene (#18CFDC / neon)

**Verificação:** `npm run typecheck:app` exit 0; medição live: botões hue≈184 (ciano), 0 botões âmbar.

## 14) Receitas — inspeção pontual de botões âmbar (2026-09-22)

**Pedido:** corrigir só os botões específicos dourados/âmbar (não todos).

**Inspeção live 390×844 (`/recipes` + drawer Nova Receita + sheet detalhe):**
- 0 botões/CTAs com hue âmbar (18–55°) em background ou texto
- CTAs medidos em ciano Sirlene `rgb(24,207,220)` ≈ `#18CFDC` (Nova Receita, Todas, step ativo, Próximo, Salvar Receita)
- Grep em `src/components/recipes/**`: zero `amber-*` / `yellow-*` / `#F59E0B` / `#FBBF24` / `#F5A314`
- Pixels âmbar no screenshot = fotos de comida nos cards (pão/ovos), não controles UI

**Ação:** nenhuma alteração adicional de botão nesta passada (já cobertos pela correção #13: shell `forceSpecialistId="sirlene"` + CTAs `specialist-primary`). Typecheck ok.

**Se ainda aparecer âmbar no device:** pedir qual controle (texto do botão / posição) — possível cache ou tela diferente.

## 15) Exames `/exams` `/exames` — P0 tipografia + Sirlene + anti-âmbar (2026-09-22)

**Arquivos:**
- `src/App.tsx` — `forceSpecialistId="sirlene"` no `SpecialistStandaloneShell` das rotas `/exams` e `/exames`
- `src/components/exams/ExamsPage.tsx` — `SpecialistScope id="sirlene"`; h1/h2/h3 Lora `ds-heading`; gaps Home-like (`gap-1.5` / `mb-1.5`); touch ≥44px; FAB/CTAs em `specialist-primary` (sem emerald hardcoded)
- `src/components/exams/ExamStatusBadge.tsx` — removeu `amber/blue/green` Tailwind → tokens specialist/destructive
- `src/components/exams/ExamCard.tsx` — CTA Ver Relatório specialist-primary ≥44px; risco moderado sem amber; título Lora
- `src/components/exams/utils/clinicalExamMapper.ts` — chip lipídios sem amber

**Preservado:** Sirlene Home; schema/dados; SEM DADO=`—` / ZERO REAL=`0` (contagens reais).

**Verificação:** `npm run typecheck:app` exit 0; screenshot live 390×844.

## 16) Meus Treinos `/meus-treinos` — P0 tipografia + Sirlene + anti-âmbar (2026-09-22)

**Arquivos:**
- `src/App.tsx` — `forceSpecialistId="sirlene"` no shell da rota `/meus-treinos`
- `src/pages/MyWorkoutsPage.tsx` — `SpecialistScope id="sirlene"`; h1/h2/h3 Lora `ds-heading`; gaps Home-like; CTAs/banner/empty sem amber/orange/hex; touch ≥44px
- `src/components/exercise/WorkoutProgramCard.tsx` — título Lora; menu ícone ≥44px; remove amber do export PDF

**Preservado:** Sirlene Home; contagens reais (0 = zero real).

**Verificação:** `npm run typecheck:app` exit 0; screenshot live 390×844.

## 17. Wave P0 — orfas Receitas/Exames + chrome Academia/Comunidade (2026-09-22 17:15 BRT)

### Arquivos
- src/pages/RecipesPage.tsx (recheck; Lora ja aplicado)
- src/components/exams/ExamsPage.tsx (recheck; Lora ja aplicado)
- src/components/exercise/ExerciseDashboard.tsx — headings ds-heading Lora 22/15; gaps space-y-1.5; CTAs min-h-[44px]; wrapper academia space-y-1.5 em MaxDashboardPage
- src/pages/HealthFeedPage.tsx — h1 Lora 22; back/CTA >=44; purple CTA -> specialist-primary; stacks space-y-1.5
- src/components/community/CommunityHeroHeader.tsx — titulo Lora 22

### Nao tocado
- Sirlene Home / Sirlene congelada
- tokens / neon / Inter+Lora globais / BottomNav 61 / Header 52

### typecheck
- 
pm run typecheck:app → exit 0

### Medicao live 390x844 (auth)
- /recipes: h1 **Lora 22px**, specialist sirlene, smallButtons=0
- /exames: h1 **Lora 22px**, empty h3 Lora 15, specialist sirlene, space-y-1.5
- /dashboard?section=exercicios: MobileHeader Academia Lora 15; ExerciseDashboard com Lora nos h3/h4 e touch>=44 no codigo; smallButtons=0; space-y-1.5
- /dashboard?section=comunidade: hero/titulo **Lora 22px**, space-y-1.5, smallButtons=0

### Screenshots
- docs/audit/MAX-GROK-DESIGN-AUDIT/recipes-p0-recheck-390x844.png
- docs/audit/MAX-GROK-DESIGN-AUDIT/exams-p0-recheck-390x844.png
- docs/audit/MAX-GROK-DESIGN-AUDIT/academia-p0-chrome-390x844.png
- docs/audit/MAX-GROK-DESIGN-AUDIT/comunidade-p0-chrome-390x844.png
- measure: wave2-measure-390.json

### Pendente (proxima autorizacao)
- Academia: validar hero 22px no viewport apos carregar ficha/treino (hoje o hub mostra tabs; headings de secao Lora 15 no codigo)
- Comunidade: medalhas/rank ainda usam yellow/amber de gamificacao (proposital); badge w-7 h-7 decorativo
- ExerciseDashboard: tile Meus Treinos ainda com gradiente amber de personalidade Alex (nao shell leak)
- Outras orfas / hubs P0 restantes do sweep
