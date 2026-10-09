# 11 — Full Visual Sweep (175 surfaces)

## Atualização pós-auditoria (2026-09-22 ~15:00 BRT)

Os P0 abaixo estavam abertos no snapshot estático do executor; **já foram corrigidos no repo Windows** (typecheck exit 0):

| Item | Status |
|---|---|
| SmartSupplements amber/yellow wash (155+10) | **RESOLVIDO** → emerald/teal + SpecialistScope `sirlene` |
| GlobalWorkoutMiniPlayer `#5fc444` + touch 36px | **RESOLVIDO** → SpecialistScope `alex`, tokens, touch ≥44px |
| LuxurySupplementBottle / PersonalizedSupplementsCard amber | **RESOLVIDO** |

Não reaplicar os packs `/workspace/max-pack-p0` ou `/workspace/mini-player-polish` por cima do disco sem diff — o parent já instalou versões equivalentes.

---


**Status:** DIAGNOSIS ONLY — no product source edited
**Generated (America/Sao_Paulo):** 2026-09-22 14:48–15:10 BRT
**Inventory:** `docs/audit/MAX-GROK-DESIGN-AUDIT/01-ALL-DESIGN-SURFACES.json` (generatedAt 2026-09-22T14:58:18.670191+00:00)
**Contract:** Visual Contract v1.0 (`MAX-DASHBOARD-VISUAL-CONTRACT.md`) + Sirlene ruler (Golden Master)
**Prior findings reused:** `fixes.md` waves DES-001…DES-orphan-P0, neon option A, tabs P0, orphan Lora/gap

## Method & limits

1. Inventory JSON: **175** surfaces clustered by specialist + category (identical chrome shared).
2. Contract + prior audit (`fixes.md`, ruler JSON, existing screenshots) reconciled — **do not reopen fixed items** without live contradicting measure.
3. Static scan of available component copies: `SmartSupplements*`, `GlobalWorkoutMiniPlayer`, `RefitWorkoutPlayer`, `AlexActiveWorkoutView`, `VideoOnboardingModal`.
4. **Live Playwright @ http://127.0.0.1:8085:** unreachable from executor box (HTTP 000). No new live captures this run.
5. Top-10 evidence: curated prior **390×844** shots of worst *remaining* divergences → `C:\Users\plata\agent-tools\max-pack-p0\scan-shots\` (box mirror `/workspace/max-pack-p0/scan-shots/`).

### Known FIXED (do not treat as open P0)

| ID | Fix | Evidence |
|---|---|---|
| DES-001 | `/auth?v=` | fixes §1 |
| DES-002 | Force-update / UpdatePrompt `z-50` | fixes §2 |
| DES-005 | Top tabs **Início** vs bottom **Hoje** | fixes §3 |
| Neon A | `--specialist-neon` per specialist | fixes §4–4b |
| DES-013 | Academia FAB removed | fixes §7 |
| DES-020 | Dr Vital contextual nav removed | fixes §8 |
| DES-orphans shell | SpecialistStandaloneShell on recipes/exams/meus-treinos | fixes §9 |
| DES-tabs-P0 | Hub tabs 44px/14px (Sirlene/Alex/Rafael + Clínica strip) | fixes §13 + tabs-fix-*.png |
| DES-orphan-P0 | Orphan Lora + gap 1.5 **claimed** | fixes §14 — **VERIFY** (ruler pre/partial still Inter/32px) |
| Tours | tour overlay insets | fixes §11 |

### BLOCKED (not counted as applied)

- Mass `h-8/h-10/h-12` swap across 154 files — ambiguous vs Sirlene freeze (fixes §15).

## Executive counts

| Bucket | Surfaces |
|---|---:|
| Assessed | 175 |
| OK (cluster quality bar met) | 50 |
| Diverges **P0** | 43 |
| Diverges **P1** | 44 |
| Diverges **P2** | 38 |

> Counts are **surface membership** under cluster chrome. Specialist **hubs** that meet VC quality are **OK** (minor P2 watches noted, not counted as diverges). Orphan/shared clusters mark every member at the cluster priority until verified fixed.

## Rubric (Visual Contract v1.0)

| Axis | Rule |
|---|---|
| Typography | Inter = UI; **Lora** = `ds-heading` / serif titles |
| Color | `specialistTokens` / `--specialist-*`; no amber/yellow brand spam; neon only alpha emphasis |
| Spacing | Home gap **6px**; gutter 16; compact density |
| Touch | CTA / primary controls **≥44px** |
| Radius | Family 5–10 / 10–16 / 16–20 / 20–24 |
| Surfaces | tokenized border/glow; no hard hex brand |
| States | empty ≠ error ≠ loading; **SEM DADO=`—`**; **ZERO REAL=`0`** |

---

## Sirlene

### hubs — 14 surfaces — **OK** (P2 watch: meal amber semantic)

- Golden Master Home: Inter UI + Lora headings; gap 6px; SEM DADO=— / ZERO=0 verified in sirlene-nutri-dup evidence.
- Hub tabs DES-tabs-P0 claimed FIXED (min-h 44 / text-sm) — post-fix shot tabs-fix-sirlene.png; pre-fix ruler (14:01) stale at 30px — do not reopen without re-measure.
- Neon option A intentional on CTAs/active tab (cyan #22E3F1) — not spam when alpha-controlled.
- Residual: meal card amber "Em andamento" border — treat as semantic status not brand; confirm not Tailwind amber hardcode outside tokens (P2 watch).

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.shopping-list` | dashboard-section | `/dashboard?section=shopping-list` |
| `dashboard.section.sirlene` | dashboard-section | `/dashboard?section=sirlene` |
| `dashboard.section.sofia` | dashboard-section | `/dashboard?section=sofia` |
| `dashboard.section.sofia-nutricional` | dashboard-section | `/dashboard?section=sofia-nutricional` |
| `registry.24.sirlene` | premium-registry-screen | `/sirlene?tab=menu` |
| `registry.25.sirlene` | premium-registry-screen | `/recipes` |
| `registry.26.sirlene` | premium-registry-screen | `/receita/:id` |
| `registry.27.sirlene` | premium-registry-screen | `/mercado` |
| `registry.29.sirlene` | premium-registry-screen | `/dashboard?section=nutrition-360` |
| `registry.30.sirlene` | premium-registry-screen | `/suplementos` |
| `registry.31.sirlene` | premium-registry-screen | `/dashboard?section=nutrition-dossier` |
| `route.sirlene` | app-route | `/sirlene` |
| `route.sirlene-nutricional` | app-route | `/sirlene-nutricional` |
| `sirlene.home` | specialist-home | `/sirlene` |

</details>

### orphans — 13 surfaces — diverges · **P0**

- Recipes/Exams/Mercado/Suplementos/Nutrition360/Dossier: DES-orphan-P0 claims Lora+gap1.5 applied, but ruler+fresh-recipes still show Inter page title 30px and recipes gaps≈32px — VERIFY on Windows tree; residual P0 until re-measure PASS.
- SmartSupplements*: heavy emerald/cyan hex hardcodes (#05110a…), gradient neon cards, CTA text-xs / py-1.5 <44 — static scan P0.
- SpecialistStandaloneShell wrap claimed for /recipes,/exams — chrome OK if present; density/typography still diverge.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.nutrition-360` | dashboard-section | `/dashboard?section=nutrition-360` |
| `dashboard.section.nutrition-dossier` | dashboard-section | `/dashboard?section=nutrition-dossier` |
| `route.diario-alimentar` | app-route | `/diario-alimentar` |
| `route.mercado` | app-route | `/mercado` |
| `route.nutricao` | app-route | `/nutricao` |
| `route.nutrition-360` | app-route | `/nutrition-360` |
| `route.nutrition-dossier` | app-route | `/nutrition-dossier` |
| `route.nutrition-tracking` | app-route | `/nutrition-tracking` |
| `route.receita-id` | app-route | `/receita/:id` |
| `route.receitas` | app-route | `/receitas` |
| `route.recipes` | app-route | `/recipes` |
| `route.suplementacao` | app-route | `/suplementacao` |
| `route.suplementos` | app-route | `/suplementos` |

</details>

## Alex

### hubs — 9 surfaces — **OK** (P2 watch: greeting Inter vs Lora)

- Hub gaps 6px PASS (ruler). Tabs DES-tabs-P0 FIXED. Neon blue intentional.
- h2 "Boa tarde" measured Inter 25px — prefer Lora ds-heading (P2).

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `alex.home` | specialist-home | `/alex` |
| `registry.1.alex` | premium-registry-screen | `/dashboard?section=dashboard&tab=evolucao` |
| `registry.2.alex` | premium-registry-screen | `/dashboard?section=exercicios` |
| `registry.4.alex` | premium-registry-screen | `/alex-tracking` |
| `registry.5.alex` | premium-registry-screen | `/dashboard?section=especialista-desafios` |
| `registry.6.alex` | premium-registry-screen | `/dashboard?section=especialista-desafios&mode=arena` |
| `registry.7.alex` | premium-registry-screen | `/dashboard?section=physical-360` |
| `registry.8.alex` | premium-registry-screen | `/dashboard?section=alex-mais` |
| `route.alex` | app-route | `/alex` |

</details>

### orphans — 22 surfaces — diverges · **P0**

- Academia local tabs Treino/Evolução/Desafios/+Novo still 30px/12px in ruler — outside hub TAB_CLASS fix set → open P0.
- Academia h1 Inter 30px (MobileHeader claimed Lora in §14) — VERIFY.
- Meus Treinos: Inter headings + 13× ~28px icon buttons (ruler) — P0 touch.
- GlobalWorkoutMiniPlayer: hardcoded #5fc444 (not --specialist-*), play control w-9 h-9 (~36px) — P0 shared chrome on Alex flows.
- Physical360 / treino dock empty state quality OK visually; Lora empty heading good.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.camera-workout` | dashboard-section | `/dashboard?section=camera-workout` |
| `dashboard.section.exercicios` | dashboard-section | `/dashboard?section=exercicios` |
| `dashboard.section.physical-360` | dashboard-section | `/dashboard?section=physical-360` |
| `route.academia` | app-route | `/academia` |
| `route.camera-workout` | app-route | `/camera-workout` |
| `route.exercicios` | app-route | `/exercicios` |
| `route.google-fit` | app-route | `/google-fit` |
| `route.google-fit-callback` | app-route | `/google-fit-callback` |
| `route.google-fit-oauth` | app-route | `/google-fit-oauth` |
| `route.google-fit-test` | app-route | `/google-fit-test` |
| `route.gym-verification` | app-route | `/gym-verification` |
| `route.heatmap` | app-route | `/heatmap` |
| `route.meus-treinos` | app-route | `/meus-treinos` |
| `route.physical-360` | app-route | `/physical-360` |
| `route.planos` | app-route | `/planos` |
| `route.replay` | app-route | `/replay` |
| `route.replay-id` | app-route | `/replay/:id` |
| `route.replay-salto` | app-route | `/replay/salto` |
| `route.trainer` | app-route | `/trainer` |
| `route.treino` | app-route | `/treino` |
| `route.treinos` | app-route | `/treinos` |
| `route.wearable-connect` | app-route | `/wearable-connect` |

</details>

### shared — 2 surfaces — diverges · **P1**

- Tracking/outdoor/google-fit/wearable routes inherit Alex or shared chrome inconsistently.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `route.alex-outdoor` | app-route | `/alex-outdoor` |
| `route.alex-tracking` | app-route | `/alex-tracking` |

</details>

## Dr Vital

### hubs — 11 surfaces — **OK** (P2 watch: desktop 1440)

- Home Lora greeting PASS; contextual top nav REMOVED (DES-020); bottom ≤5.
- Desktop 1440 bottom-nav/layout still flagged out-of-scope historically — P2.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `drvital.home` | specialist-home | `/dr-vital` |
| `registry.10.vital` | premium-registry-screen | `/dr-vital?tab=cuidados` |
| `registry.11.vital` | premium-registry-screen | `/dr-vital?tab=sinais` |
| `registry.12.vital` | premium-registry-screen | `/exames` |
| `registry.13.vital` | premium-registry-screen | `/dr-vital?tab=medicamentos` |
| `registry.14.vital` | premium-registry-screen | `/dr-vital?tab=cardio` |
| `registry.15.vital` | premium-registry-screen | `/dashboard?section=vital-360` |
| `registry.16.vital` | premium-registry-screen | `/dr-vital?tab=mais` |
| `registry.9.vital` | premium-registry-screen | `/dr-vital` |
| `route.dr-vital` | app-route | `/dr-vital` |
| `route.drvital` | app-route | `/drvital` |

</details>

### orphans — 8 surfaces — diverges · **P0**

- Exames: page title Inter (ruler+shot); empty state honest but dashed-card pattern + green CTA may ignore vital brand tokens (uses generic emerald) — P0 typography / P1 tokens.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.dr-vital` | dashboard-section | `/dashboard?section=dr-vital` |
| `dashboard.section.health-360` | dashboard-section | `/dashboard?section=health-360` |
| `dashboard.section.vital-360` | dashboard-section | `/dashboard?section=vital-360` |
| `route.exames` | app-route | `/exames` |
| `route.exams` | app-route | `/exams` |
| `route.health-360` | app-route | `/health-360` |
| `route.health-dashboard` | app-route | `/health-dashboard` |
| `route.vital-360` | app-route | `/vital-360` |

</details>

### shared — 7 surfaces — diverges · **P2**

- vital-360 / health-360 / analise-saude: shared shells; ensure SpecialistScope=drvital.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `route.admin-system-health` | app-route | `/admin/system-health` |
| `route.analise-saude` | app-route | `/analise-saude` |
| `route.anamnesis` | app-route | `/anamnesis` |
| `route.avaliacao-profissional` | app-route | `/avaliacao-profissional` |
| `route.dr-vital-enhanced` | app-route | `/dr-vital-enhanced` |
| `route.dr-vital-portal` | app-route | `/dr-vital-portal` |
| `route.professional-evaluation` | app-route | `/professional-evaluation` |

</details>

## Rafael

### hubs — 16 surfaces — **OK** (P2 watch: section Inter labels)

- Lora greeting PASS; tabs FIXED; amber #F5A314 is brand (not warning) per VC.
- Early rafael-home.png blank = capture/auth miss, not product chrome.
- Section titles like RITUAIS DE HOJE measured Inter 16px — prefer Lora 15px section (P2).

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.challenges` | dashboard-section | `/dashboard?section=challenges` |
| `dashboard.section.comunidade` | dashboard-section | `/dashboard?section=comunidade` |
| `dashboard.section.especialista-desafios` | dashboard-section | `/dashboard?section=especialista-desafios` |
| `dashboard.section.goals` | dashboard-section | `/dashboard?section=goals` |
| `dashboard.section.missions` | dashboard-section | `/dashboard?section=missions` |
| `dashboard.section.progress` | dashboard-section | `/dashboard?section=progress` |
| `dashboard.section.saboteur-test` | dashboard-section | `/dashboard?section=saboteur-test` |
| `dashboard.section.sessions` | dashboard-section | `/dashboard?section=sessions` |
| `rafael.home` | specialist-home | `/rafael` |
| `registry.17.rafael` | premium-registry-screen | `/rafael` |
| `registry.19.rafael` | premium-registry-screen | `/dashboard?section=sessions` |
| `registry.20.rafael` | premium-registry-screen | `/rafael?tab=checkin` |
| `registry.21.rafael` | premium-registry-screen | `/rafael?tab=plano90` |
| `registry.22.rafael` | premium-registry-screen | `/dashboard?section=progress` |
| `registry.23.rafael` | premium-registry-screen | `/rafael?tab=mais` |
| `route.rafael` | app-route | `/rafael` |

</details>

### modals — 2 surfaces — diverges · **P1**

- Check-in / saboteur flows: confirm — vs 0; avoid inventing streak.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `route.missao-concluida` | app-route | `/missao-concluida` |
| `route.mission-complete` | app-route | `/mission-complete` |

</details>

### shared — 23 surfaces — diverges · **P1**

- Comunidade under Alex chrome in p6 shot: Inter hero, green neon FAB vs Alex blue dock — identity clash P1.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `route.app-goals` | app-route | `/app/goals` |
| `route.app-progress` | app-route | `/app/progress` |
| `route.challenges` | app-route | `/challenges` |
| `route.challenges-id` | app-route | `/challenges/:id` |
| `route.community-post-postId` | app-route | `/community/post/:postId` |
| `route.comunidade` | app-route | `/comunidade` |
| `route.desafios` | app-route | `/desafios` |
| `route.especialista-desafios` | app-route | `/especialista-desafios` |
| `route.feed` | app-route | `/feed` |
| `route.goals` | app-route | `/goals` |
| `route.metas` | app-route | `/metas` |
| `route.missions` | app-route | `/missions` |
| `route.missoes` | app-route | `/missoes` |
| `route.progress` | app-route | `/progress` |
| `route.progresso` | app-route | `/progresso` |
| `route.sabotadores` | app-route | `/sabotadores` |
| `route.saboteur-test` | app-route | `/saboteur-test` |
| `route.segments` | app-route | `/segments` |
| `route.segments-id` | app-route | `/segments/:id` |
| `route.sessions` | app-route | `/sessions` |
| `route.sessions-sessionId` | app-route | `/sessions/:sessionId` |
| `route.sessoes` | app-route | `/sessoes` |
| `route.sessoes-sessionId` | app-route | `/sessoes/:sessionId` |

</details>

## Central MAX/shared

### hubs — 6 surfaces — diverges · **P1**

- CompleteDashboard /dashboard synthesis: must not clone 4 homes; neon max #5EC8F0 OK.
- Help FAB + force-update: z-50 FIXED; FAB position OK; tours insets FIXED.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.courses` | dashboard-section | `/dashboard?section=courses` |
| `dashboard.section.dashboard` | dashboard-section | `/dashboard?section=dashboard` |
| `dashboard.section.subscriptions` | dashboard-section | `/dashboard?section=subscriptions` |
| `max.dashboard` | specialist-home | `/dashboard` |
| `route.dashboard` | app-route | `/dashboard` |
| `route.max` | app-route | `/max` |

</details>

### orphans — 7 surfaces — diverges · **P1**

- Gallery/apps/admin/AR routes often outside SpecialistScope.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.apps` | dashboard-section | `/dashboard?section=apps` |
| `dashboard.section.gallery` | dashboard-section | `/dashboard?section=gallery` |
| `route.ar-lab` | app-route | `/ar-lab` |
| `route.dossie` | app-route | `/dossie` |
| `route.galeria` | app-route | `/galeria` |
| `route.gallery` | app-route | `/gallery` |
| `route.laboratorio-ra` | app-route | `/laboratorio-ra` |

</details>

### modals — 4 surfaces — diverges · **P1**

- VideoOnboardingModal: intentional warm-neutral #2F6B4F/#1A1A1A (fixes §12) — heading Inter not Lora (P2); chips may be <44 (P1).
- Auth `/auth?v=` FIXED (DES-001). Character-select OK visually.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `route.auth` | app-route | `/auth` |
| `route.auto-login` | app-route | `/auto-login` |
| `route.character-select` | app-route | `/character-select` |
| `route.install` | app-route | `/install` |

</details>

### shared — 31 surfaces — diverges · **P2**

- Shared settings/billing/legal/admin — functional chrome; low visual priority vs specialist homes.

<details><summary>Surface IDs</summary>

| id | kind | route |
|---|---|---|
| `dashboard.section.chat` | dashboard-section | `/dashboard?section=chat` |
| `dashboard.section.help` | dashboard-section | `/dashboard?section=help` |
| `dashboard.section.profile` | dashboard-section | `/dashboard?section=profile` |
| `route.activity-id` | app-route | `/activity/:id` |
| `route.admin` | app-route | `/admin` |
| `route.admin-autoaprendizado` | app-route | `/admin/autoaprendizado` |
| `route.admin-monitoring` | app-route | `/admin/monitoring` |
| `route.ai-hub` | app-route | `/ai-hub` |
| `route.app-courses` | app-route | `/app/courses` |
| `route.assinatura` | app-route | `/assinatura` |
| `route.billing` | app-route | `/billing` |
| `route.chat` | app-route | `/chat` |
| `route.configuracoes` | app-route | `/configuracoes` |
| `route.courses` | app-route | `/courses` |
| `route.cursos` | app-route | `/cursos` |
| `route.historico` | app-route | `/historico` |
| `route.l-token` | app-route | `/l/:token` |
| `route.lista-token` | app-route | `/lista/:token` |
| `route.map-coins` | app-route | `/map-coins` |
| `route.mapa-moedas` | app-route | `/mapa-moedas` |
| `route.minha-colecao-moedas` | app-route | `/minha-colecao-moedas` |
| `route.moedas` | app-route | `/moedas` |
| `route.perfil` | app-route | `/perfil` |
| `route.privacidade` | app-route | `/privacidade` |
| `route.profile` | app-route | `/profile` |
| `route.relatorio-token` | app-route | `/relatorio/:token` |
| `route.settings` | app-route | `/settings` |
| `route.subscription` | app-route | `/subscription` |
| `route.subscriptions` | app-route | `/subscriptions` |
| `route.termos` | app-route | `/termos` |
| `route.terms` | app-route | `/terms` |

</details>

---

## Cross-cutting findings (priority queue)

### P0

1. **Academia local tab strip** still ~30px/12px (ruler `/academia`) — not covered by hub TAB_CLASS set.
2. **Meus Treinos** Inter titles + ~28px icon buttons (ruler).
3. **Recipes / Exams page titles** still Inter in ruler + shots — contradict or incomplete DES-orphan-P0; re-measure required.
4. **SmartSupplements** hex/neon emerald hardcodes + undersized CTAs (static).
5. **GlobalWorkoutMiniPlayer** `#5fc444` + 36px play control (static).

### P1

1. Clickable `h-8/h-10` remainder (blocked mass fix) — Sirlene chat/modals + Alex modals scoped list.
2. **RefitWorkoutPlayer** amber Tailwind celebration/pause chrome.
3. **Comunidade** Inter hero + green FAB vs Alex blue dock.
4. Onboarding chips touch <44 possible; VideoOnboarding heading Inter (neutral palette intentional).
5. Standalone 360 routes without consistent SpecialistScope.

### P2

1. Alex/Rafael section labels Inter where Lora 15px expected.
2. Sirlene meal amber “Em andamento” — confirm semantic vs hardcode.
3. Dr Vital desktop 1440 nav chrome.
4. Glow intensity on dock/CTAs (neon A intentional; watch spam).

---

## Top 10 worst (evidence paths)

| # | Issue | Pri | Screenshot (Windows) | Box mirror |
|---:|---|---|---|---|
| 1 | Recipes Inter title + large section gaps | P0 | `C:\Users\plata\agent-tools\max-pack-p0\scan-shots\01-recipes-inter-heading-gap32.png` | `/workspace/max-pack-p0/scan-shots/01-recipes-inter-heading-gap32.png` |
| 2 | Exams Inter title / empty chrome | P0 | `...\02-exams-inter-heading-empty.png` | `/workspace/max-pack-p0/scan-shots/02-exams-inter-heading-empty.png` |
| 3 | Academia chrome stack / local tabs | P0 | `...\03-academia-chrome-stack.png` | `/workspace/max-pack-p0/scan-shots/03-academia-chrome-stack.png` |
| 4 | Comunidade Inter + neon FAB clash | P1 | `...\04-comunidade-inter-neon-fab.png` | `/workspace/max-pack-p0/scan-shots/04-comunidade-inter-neon-fab.png` |
| 5 | Sirlene Home amber meal + strong neon CTAs | P2 | `...\05-sirlene-home-amber-meal-neon-cta.png` | `/workspace/max-pack-p0/scan-shots/05-sirlene-home-amber-meal-neon-cta.png` |
| 6 | Onboarding Saúde 360 Inter heading | P1/P2 | `...\06-onboarding-inter-heading-neutral.png` | `/workspace/max-pack-p0/scan-shots/06-onboarding-inter-heading-neutral.png` |
| 7 | Alex live player baseline (OK reference) | OK | `...\07-alex-player-live-ok-baseline.png` | `/workspace/max-pack-p0/scan-shots/07-alex-player-live-ok-baseline.png` |
| 8 | Dr Vital desktop 1440 | P2 | `...\08-drvital-desktop-1440-nav.png` | `/workspace/max-pack-p0/scan-shots/08-drvital-desktop-1440-nav.png` |
| 9 | Physical 360 orphan chrome | P1 | `...\09-physical360-orphan-chrome.png` | `/workspace/max-pack-p0/scan-shots/09-physical360-orphan-chrome.png` |
| 10 | Character select (shared modal chrome) | P2 | `...\10-character-select-sirlene.png` | `/workspace/max-pack-p0/scan-shots/10-character-select-sirlene.png` |

Path list file: `C:\Users\plata\agent-tools\max-pack-p0\scan-shots\WINDOWS-PATHS.txt` (box: `/workspace/max-pack-p0/scan-shots/WINDOWS-PATHS.txt`).

> **Note:** Items 1–6/8–10 are worst *remaining* divergences from prior 390×844 captures. Item 7 is a positive baseline after player merge. Live re-shot blocked (dev server not reachable from this executor).

---

## Coverage matrix (175)

| Specialist | hubs | orphans | modals | shared | Total |
|---|---:|---:|---:|---:|---:|
| Sirlene | 14 | 13 | 0 | 0 | 27 |
| Alex | 9 | 22 | 0 | 2 | 33 |
| Dr Vital | 11 | 8 | 0 | 7 | 26 |
| Rafael | 16 | 0 | 2 | 23 | 41 |
| Central MAX/shared | 6 | 7 | 4 | 31 | 48 |
| **Total** | 56 | 50 | 6 | 63 | **175** |

---

## Confirmation

- **No product source code was edited** in this diagnosis run.
- Only docs/audit artifacts + scan-shot copies under `/workspace/max-pack*/` were written.
- Report path (repo-relative): `docs/audit/MAX-GROK-DESIGN-AUDIT/11-FULL-VISUAL-SWEEP-175.md`
- Box write: `/workspace/max-pack/docs/audit/MAX-GROK-DESIGN-AUDIT/11-FULL-VISUAL-SWEEP-175.md` — copy onto `D:\DEV\Cursor\Max\docs\audit\MAX-GROK-DESIGN-AUDIT\` on machine Rafael.

### Follow-ups for parent / Windows agent

1. Sync this markdown + `scan-shots/` onto Rafael machine paths above.
2. Re-run Playwright 390×844 against live `8085` for P0 list (Academia tabs, Recipes/Exams/Meus Treinos titles+gaps, Supplements, MiniPlayer).
3. Do **not** reopen DES-tabs-P0 hubs without failing live measure.
