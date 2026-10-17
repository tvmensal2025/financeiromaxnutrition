# Site do Sistema Helena (`src/`) — catálogo para a IA programadora

**O que é:** o catálogo completo e verificado do site v2 (React/Vite em `src/`): cada rota, página, módulo de integração, componente, utilitário, permissão e estilo, com o arquivo:linha de entrada, o contrato (props/tipos), de onde vêm os dados (RPC/tabela com nome exato), os testes que cobrem e o que quebra se você mexer. Serve para qualquer IA programadora (Claude, Codex, o agente Theo) cuidar, editar e ajustar o site sem redescobrir o código. Foi montado **lendo o código**, no commit `09d0047` (merge de `claude/fervent-pasteur-g821nu`), em 17/10/2026. É uma fotografia datada: **não prova implantação nem dados atuais** (veja `AGENTS.md` e [mapa-do-sistema.md](../mapa-do-sistema.md)).

**Como mudar:** antes de editar, ache a peça aqui (use `Ctrl+F` no nome do arquivo), leia a coluna "Como mudar" e rode os comandos da seção 12. Números de linha mudam: confirme com `grep -n`. Ao alterar o site, atualize este arquivo no mesmo commit (rota nova → seção 4; página nova → seção 5; RPC nova → seção 6). O que não pôde ser confirmado fica marcado **NÃO CONFIRMADO** (lista na seção 14). Nunca escreva valores de segredo (senha, token, chave, `service_role`) em código, teste, commit ou documento; use só nomes.

Estado de saúde medido nesta leitura (com `node_modules` do checkout principal ligado ao worktree): `vitest` 73 arquivos / 624 testes passando; `tsc --noEmit -p tsconfig.app.json` sem erros; `eslint .` 0 erros e 22 avisos; `vite build` concluído.

---

## 0. Regras do projeto que valem para qualquer edição no site

- **v2 apenas.** A v1 está parada (DEC-032); sua interface arquivada fica em `docs/arquivo/app-v1/` e serve só de referência. Não restaure a v1 em bloco nem ligue serviços dela por inferência. `services/`, `scripts/` e `supabase/migrations/` seguem protegidos (DEC-028).
- **Banco:** o site só **lê** e chama RPCs já existentes. Criar/alterar tabela, RPC, política ou migration exige autorização explícita do fundador; este catálogo não autoriza nada disso.
- **Sem segredos.** O front só pode conter a URL e a chave **publicável** do Supabase (padrões embutidos em `src/lib/supabase.ts:3-10`, sobrepostos por `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`). Nunca `service_role`, token de bot ou segredo de ingresso.
- **Marca:** a empresa é **eLiving™** (e minúsculo, L maiúsculo, sem hífen; DEC-023). Em textos de tela, preserve exatamente essa grafia.
- **Honestidade de dados:** leitura com erro nunca vira zero; "CONFIGURADA/CONECTADA" não prova "OPERANDO"; "pedido recebido" não prova "card criado" nem "publicado". As telas já seguem isso; preserve.
- **Rótulos de status usados neste arquivo:** JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE / NÃO CONFIRMADO (mesmo sentido do `AGENTS.md`).

---

## 1. O site em um minuto

**Pilha** (`package.json`): Vite 5 + React 18 + TypeScript 5 + `react-router-dom` 6 + Tailwind 3 (+ `tailwindcss-animate`) + componentes Radix/shadcn + `@supabase/supabase-js` 2 + `recharts` + `zod` + `date-fns` + `lucide-react`. Testes: Vitest 4 + Testing Library + jsdom. Alias `@` → `src/` (em `vite.config.ts`, `vitest.config.ts` e `tsconfig.app.json`).

**Ponto de entrada:** `index.html` → `src/main.tsx:1-12` (importa `index.css`, `styles/helena.css`, `styles/negocios.css` e monta `<App/>` em `React.StrictMode`, `:8`) → `src/App.tsx:195` (`AuthProvider` → `BrowserRouter` → `PageBoundary` → `Rotas`).

**Dois mundos de dados** (não misture):

| Mundo | Como acessa | O que tem | Quem usa |
|---|---|---|---|
| **A. Esteira v2** — schema `helena_v2` | `supabase.schema('helena_v2')` com `.from()` (só `card`, `etapa`, `entrega`, `solicitacao_card_real`) e **RPCs**; sempre por `criarRepositorioXxx(cliente)` | cards, etapas, entregas, pedidos, propostas, configuração versionada, pareamento Telegram, publicação | `/`, `/cards`, `/comando`, `/configuracoes`, `/conversa`, `/equipe`, `/integracoes`, `/sistema` (config) |
| **B. Módulos de negócio** — schema `public` | `supabase.from(tabela)` direto; escrita versionada por `escreverRegistro` → RPC `public.helena_write_record` | portfólio, financeiro, CRM, calendário/tarefas, identidade da marca, indicadores e o catálogo de 56 módulos genéricos (55 com contrato) | `/financeiro`, `/crm`, `/calendario`, `/portfolio`, `/empresas`, `/identidade`, `/indicadores`, `/modulo/:tabela`, `/sistema` (checkpoint/decisões) |

**Camadas do mundo A** (padrão a copiar): `página` → `runtime.ts` (`repositorioXxxDoApp()`, faz `import('@/lib/supabase')` dinâmico para não carregar o cliente antes da tela) → `repository.ts` (`criarRepositorioXxx(cliente)`: função pura, valida a resposta, traduz erro) → `supabase`. As páginas e blocos do mundo A aceitam o repositório (ou o hook de dados) por prop opcional; os testes passam um falso e nunca tocam a rede.

**Convenções do código:** estados de leitura `'carregando' | 'pronta' | 'erro'`; "agora" entra por parâmetro (`dados.agora`), nunca `new Date()` dentro de funções `derivar-*`; datas exibidas em `America/Sao_Paulo`; troca de conta/empresa desmonta o estado (chaves `key={...}`); descarte de resposta atrasada por contador (`useRef` de geração) ou flag `ativo/vivo`.

---

## 2. Mapa de pastas (src/)

| Pasta | Conteúdo | Arquivos (não-teste) |
|---|---|---|
| `src/` raiz | `main.tsx`, `App.tsx` (rotas e guardas), `auth.tsx`, `index.css`, `vite-env.d.ts` | 4 + CSS |
| `src/pages/` | 25 telas e blocos de tela (seção 5) | 25 |
| `src/pages/comando-v2/abas/` | as 12 abas da Sala de comando, carregadas por `import.meta.glob` | 12 |
| `src/integrations/` | repositórios do mundo A e a lógica pura da Sala de comando (seção 6) | `cards-v2` 6, `comando-v2` 14, `config-v2` 3, `operacao-v2` 2, `pedidos-v2` 3, `telegram-v2` 2 |
| `src/components/` | `Layout`, `executive/*` (12), `comando-v2/*` (14), `cards-v2/KanbanV2`, `financeiro/*` (2), `pipeline/*` (2), `tarefas/*` (1), `ui/*` (8, shadcn) | seção 7 |
| `src/contexts/` | `BusinessContext`, `SessionBusinessBoundary` | 2 |
| `src/lib/` | utilitários, contratos de módulos, escrita protegida, navegação | 15 |
| `src/data/` | `eliving-brand.json`, `humano-digital-brand.json` (propostas de identidade; lidos por `IdentidadePage`) | 2 JSON |
| `src/styles/` | `helena.css`, `negocios.css` | 2 |

Testes ficam ao lado do arquivo (`*.test.ts(x)`), dentro de `src/` (`vitest.config.ts`: `include: src/**/*.{test,spec}.*`, `environment: jsdom`, `globals: true`).

---

## 3. Identidade, permissões e empresa

### 3.1 Cadeia de montagem (de fora para dentro)

```text
main.tsx → App (App.tsx:195)
  AuthProvider (auth.tsx:36)            ← sessão Supabase + leitura de public.app_access
  BrowserRouter
  PageBoundary (PageBoundary.tsx:20)    ← Suspense + ErrorBoundary por pathname
  Rotas (App.tsx:148)
    /login, /entrar                      ← públicos
    rota-pai sem path (App.tsx:154-160)
      Protegida (App.tsx:36)             ← exige sessão + app_access ativo
      SessionBusinessBoundary            ← BusinessProvider com key=user.id:role
      Layout (Layout.tsx:21)             ← menu, cabeçalho, <Outlet/> dentro de PageBoundary
        rotas livres para membro: /, /cards, /configuracoes (esta mostra "Acesso restrito")
        SomenteFundador (App.tsx:134)    ← exige isFounder; remonta por user.id:role
          /comando /sistema /conversa /equipe /integracoes /oauth/consent …
          AreaNegocios (App.tsx:141)     ← espera o portfólio carregar; remonta por empresa
            /financeiro /crm /calendario /portfolio /empresas /identidade /indicadores /modulo/:tabela
```

### 3.2 `src/auth.tsx` — sessão e `app_access`

- **Entrada:** `AuthProvider` `auth.tsx:36`, `useAuth()` `auth.tsx:229`. Tipos `AppRole = "founder" | "admin" | "member"` (`:5`), `AppAccess {user_id, role, active}` (`:7`).
- **Contrato (`useAuth()`):** `user`, `session`, `appAccess`, `role`, `isFounder`, `isAdmin`, `isMember`, `loading`, `accessCheckFailed`, `entrar(email, senha) → Promise<string|null>` (mensagem de erro ou `null`), `sair()`.
- **Como funciona:** `onAuthStateChange` + `getSession` carregam a sessão (`carregarSessao`, `:48`); em seguida lê **`public.app_access`** (`select user_id,role,active … eq user_id … maybeSingle`) dentro de um `setTimeout` (regra do Supabase: não fazer outra chamada dentro do callback de auth). Um contador (`sessionEpoch`) descarta respostas antigas. `entrar` (`:127`) repete a conferência e, se `active` for falso, faz `signOut`. `sair` (`:183`) trata falha de saída como `accessCheckFailed`.
- **Papéis (calculados em `:202-206`):** `acessoAtual = session.user.id === appAccess.user_id && appAccess.active`; `isFounder = role==='founder'`; `isAdmin = isFounder || role==='admin'`; `isMember = acessoAtual`. **`isAdmin` não é usado em nenhum lugar do app** (grep): `admin` é tratado como `member` nas rotas.
- **Modo de teste sem senha:** `MODO_TESTE_SEM_SENHA` (`:29`) só liga com `import.meta.env.DEV` **e** `MODE !== 'test'` **e** `VITE_MODO_TESTE_SEM_SENHA==='true'` **e** e-mail/senha de teste definidos. Fora de dev, o build ignora. Mantenha as variáveis vazias fora da máquina de desenvolvimento (`.env.example`).
- **Testes:** `auth.test.tsx` (corrida de sessão, troca de pessoa, saída recusada); quase todos os testes de página/rota simulam `@/auth` ou `@/lib/supabase`.
- **Como mudar com segurança:** não leia `app_access` fora daqui; qualquer nova regra de papel passa por `isFounder`/`isMember`. Se mexer em `carregarSessao`/`entrar`/`sair`, rode `auth.test.tsx`, `App.rotas-protegidas.test.tsx` e `Login.test.tsx`: a ordem das atualizações de estado e o descarte por época evitam que um papel antigo apareça após troca de conta.

### 3.3 Matriz de acesso (o que cada situação vê)

| Situação | O que o site faz |
|---|---|
| Sem sessão | `Protegida` redireciona a `/login?redirect=<caminho+busca>` (`App.tsx:71-74`) |
| Consulta de `app_access` falhou | tela "Não foi possível confirmar sua sessão" (`accessCheckFailed`, `App.tsx:55`) |
| Autenticado sem `app_access` ativo | tela "Acesso Não Autorizado" com botão de sair (`App.tsx:77`); nada da rota/Layout é montado |
| `member` ou `admin` ativo | vê `/` (mensagem de área reservada), `/cards` (quadro; ver 3.4), `/configuracoes` ("Acesso restrito"); menu mostra só "Visão geral" e "Cards" (`lib/navegacao.ts:27`); qualquer rota sob `SomenteFundador` mostra "Acesso restrito" |
| `founder` ativo | todas as rotas; `BusinessProvider` carrega o portfólio; menu completo |

### 3.4 `sou_fundador` e RLS (lado do banco)

- A função **`helena_v2.sou_fundador()`** é definida em `supabase/migrations-v2/0005_publicacao.sql:4`: verdadeira se a conta é `authenticated`, `auth.uid()` existe e há linha em `public.app_access` com `role='founder'` e `active=true`. As políticas de SELECT em `helena_v2.card`, `etapa`, `entrega` (`0005:63-65`), `publicacoes` (`0005:20`), `configuracao` (`0006:478`) e `solicitacao_card_real` (`0007:27`) exigem essa função; várias RPCs a chamam e recusam quem não é fundador (ex.: `0006:149,187,230,371`).
- O site replica a regra no cliente (`isFounder` vem de `app_access`) **só para esconder telas**; a autoridade é o banco. Para um membro, as leituras de `card/etapa/entrega` voltam vazias/recusadas pelo RLS (inferido das políticas; **NÃO CONFIRMADO** no banco real). Nunca confie só no front.
- `src/integrations/comando-v2/repository.ts:3` cita "RLS sou_fundador, grant select da migration 0005" como pré-condição das leituras em lote.

### 3.5 Guardas em `src/App.tsx`

| Peça | Linha | Faz | Como mudar |
|---|---|---|---|
| `EXIGIR_AUTENTICACAO` | `:34` | constante `true`, **sem nenhum uso** (grep) | não é interruptor real; a proteção é a rota-pai `Protegida` |
| `Protegida` | `:36` | `loading`→"Validando credenciais…"; `accessCheckFailed`; sem `user`→`/login?redirect=`; `!isMember`→bloqueio | não monte nada antes de `isMember`; cobre também `*` (404) |
| `Redirecionar` | `:111` | `<Navigate to={para+search} replace>` preservando `?card=` etc. | alias novo = uma entrada no mapa (`:184`) |
| `RedirecionarAba` | `:117` | manda para `/comando?aba=<aba>` preservando os outros parâmetros | `:171` e `:185` |
| `EntradaRaiz` | `:125` | `/?card=` ou `/?pedido=` → `/cards` (preserva busca); senão `PainelV2Page` | links antigos dependem disso (`App.rotas-protegidas.test.tsx`) |
| `SomenteFundador` | `:134` | `!isFounder` → "Acesso restrito"; senão `<Fragment key={user.id:role}><Outlet/>` | a `key` desmonta todo estado ao trocar de conta/papel — não remova |
| `AreaNegocios` | `:141` | enquanto `useBusiness().loading` mostra "Carregando empresas…"; erro → "Empresas indisponíveis"; `key` = empresa atual + ids do portfólio | impede consulta consolidada antes de resolver o portfólio; troca de empresa remonta a página inteira |

### 3.6 `src/contexts/BusinessContext.tsx` — empresa atual

- **Entrada:** `BusinessProvider` `:118`, `useBusiness()` `:347`. `SessionBusinessBoundary` (`contexts/SessionBusinessBoundary.tsx:6`) monta o provider com `key=${user.id}:${role}` e `autorizado={!loading && isFounder}`; sem fundador não consulta nada.
- **Dados:** `supabase.from("portfolio").select("business_id,negocio,estagio,principal_gargalo,ativo,publico,row_version,brand_identity").order("business_id")` (`:141-144`). Falha de leitura → `error` e lista vazia (nunca empresas de exemplo). Linhas com `business_id==='GRUPO'` são descartadas.
- **Contrato:** `Empresa {id, business_id, nome, negocio, sigla, cor, estagio?, principal_gargalo?, ativo?, publico?, row_version?}`; `useBusiness()` devolve `currentBusiness`, `currentBusinessId` (`'GRUPO'` = consolidado), `empresas`/`businesses`, `setCurrentBusiness`/`selecionarEmpresa`, `loading`/`carregandoEmpresas`, `error`, `isConsolidated`, `selecionadas` (ids da consulta: todas ou só a atual), `todasLigadas`, `rotulo`, `alternar`, `ligarTodas`, `incluirEmpresa`, `tirarEmpresa`, `pertence`, `nomeDe`.
- **Persistência local:** `localStorage` `helena_active_business_id` (empresa escolhida, validada contra a lista) e `helena_empresas_ligadas` (legado, mantido por compatibilidade). Cores: tabela fixa `CORES` por `BIZ-00N` (`:19`), substituída pela cor primária da `brand_identity` quando `APPROVED`.
- **Sem uso na interface:** `incluirEmpresa` (insere em `portfolio` com `estagio:'VALIDAÇÃO'`, `source_system:'HELENA'`), `tirarEmpresa` (sempre recusa), `TABELAS_COM_BUSINESS_ID` (`:31`) e `EMPRESAS_BASE` (`:70`) — não há botão que cadastre empresa hoje.
- **Testes:** `contexts/BusinessContext.test.tsx`, `contexts/SessionBusinessBoundary.test.tsx`, `App.restauracao.test.tsx`.
- **Como mudar com segurança:** páginas de negócio devem filtrar por `selecionadas` **antes** da paginação e descartar resposta atrasada (padrão já usado). Se acrescentar campo do portfólio, inclua-o no `select` daqui e em `Empresa`; `PortfolioPage` e `IdentidadePage` leem o `portfolio` por conta própria.

### 3.7 Cliente Supabase e armazenamento do navegador

- `src/lib/supabase.ts:12` cria o cliente (`auth.storage=localStorage`, `persistSession`, `autoRefreshToken`); exporta `supabase` e `supabaseUrl`. URL/chave vêm de `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, com padrão embutido para o projeto oficial `ecosistemadossonhos` (`wxkgrykduqtsgmjkzlou`). Não há teste direto (mockado em todos os outros).
- **Chaves de armazenamento** (para saber o que limpar/migrar):

| Onde | Chave | Quem usa | Conteúdo |
|---|---|---|---|
| localStorage | token do Supabase Auth (nome interno da biblioteca) | `lib/supabase.ts` | sessão |
| localStorage | `helena_active_business_id`, `helena_empresas_ligadas` | `BusinessContext` | empresa escolhida |
| localStorage | `helena_v2_comando_empresa` | `ComandoV2Page.tsx:27` | filtro de empresa da Sala de comando |
| sessionStorage | `helena-v2-entrada:<usuário>`, `helena-v2-ultimo-pedido:<usuário>` | `integrations/pedidos-v2/pendente.ts` | recibo do pedido pendente / último pedido |
| sessionStorage | `helena-v2-esclarecimento:<usuário>:<requestId>` | `pedidos-v2/pendente.ts` | resposta de esclarecimento pendente |
| sessionStorage | `helena-v2-toque:<usuário>:<máquina>:<alvo>` | `cards-v2/toque-pendente.ts` | identificador + impressão SHA-256 de uma decisão em voo (retomada idempotente) |

  Todo acesso a storage está em `try/catch` e a tela deve funcionar sem ele.

---

## 4. Rotas (`src/App.tsx`) — catálogo completo

Legenda de acesso: **público** = sem login; **logado** = qualquer `app_access` ativo (member/admin/founder); **fundador** = `isFounder`. Linha = `<Route>` em `src/App.tsx`. Páginas são `lazy()` (`App.tsx:9-26`); cada uma vira um chunk no build.

### 4.1 Rotas com página

| Caminho | Linha | Página (arquivo) | Quem acessa | O que faz | De onde vêm os dados |
|---|---|---|---|---|---|
| `/login` | `:151` | `Login` (`pages/Login.tsx`) | público | login por e-mail/senha; já autenticado e ativo → vai ao `?redirect=` (só caminho local) | `supabase.auth` + `public.app_access` (via `useAuth`) |
| `/entrar` | `:152` | — | público | `Navigate` para `/login` | — |
| `/` | `:161` | `EntradaRaiz` → `PainelV2Page` | logado (membro vê aviso de área reservada) | visão geral do fundador: cards, pedidos e revisão ativa | `helena_v2.card`; RPC `listar_pedidos_entrada`, `listar_configuracoes`, `ler_configuracao` |
| `/painel` | `:162` | — | logado | redireciona a `/` | — |
| `/cards` | `:163` | `CardV2Page` | logado (conteúdo útil só ao fundador) | quadro Kanban, detalhe do card, decisões do fundador, publicação, pedidos/Telegram/card real | schema `helena_v2` (seção 6.1) |
| `/configuracoes` | `:164` | `ConfiguracoesV2Page` | logado; **membro vê "Acesso restrito"** (a própria página recusa) | revisões da configuração v2: editar rascunho, validar, ativar, reverter, importar JSON | RPCs `listar_configuracoes`, `ler_configuracao`, `salvar_rascunho`, `solicitar_validacao_config`, `ativar_configuracao`, `aposentar_configuracao`, `listar_ativacoes`, `reverter_configuracao` |
| `/comando` | `:166` | `ComandoV2Page` | fundador | Sala de comando: 12 abas (`?aba=`), filtro de empresa, atualização a cada 30 s | `helena_v2.card/etapa/entrega` + `listar_pedidos_entrada` + configuração ativa |
| `/sistema` | `:167` | `GovernancaV2Page` | fundador | checkpoint mestre atual, últimas 30 decisões e revisão ativa | `public.checkpoint_mestre_atual` (view), `public.decisoes`, RPCs de configuração |
| `/conversa` | `:168` | `ConversaV2Page` → `EntradaPedidosV2` | fundador | escrever pedido, receber proposta/perguntas, confirmar | RPCs `receber_pedido_entrada`, `ler_pedido_entrada`, `listar_pedidos_entrada`, `ler_proposta_pedido`, `confirmar_proposta_pedido` |
| `/equipe` | `:169` | `EquipeV2Page` | fundador | agentes e serviços da revisão ativa (configurado ≠ operando) | RPCs `listar_configuracoes` + `ler_configuracao` |
| `/integracoes` | `:170` | `IntegracoesV2Page` → `PareamentoTelegramV2` | fundador | vínculo do Telegram com a conta | RPCs `gerar_pareamento_telegram`, `consultar_pareamento_telegram`, `revogar_pareamento_telegram` |
| `/oauth/consent` | `:172` | `OAuthConsent` | fundador (redireciona a `/login` sem sessão) | aprovar/negar autorização OAuth do Supabase | `supabase.auth.oauth.*` |
| `/financeiro` | `:174` | `FinanceiroPage` | fundador, com portfólio resolvido | 8 abas financeiras | seção 5.4 |
| `/crm` | `:175` | `CrmPage` | idem | funil de oportunidades (Kanban/tabela) | `public.crm` |
| `/calendario` | `:176` | `CalendarioPage` | idem | calendário + agenda unificada de eventos e tarefas | `public.calendario`, `public.tarefas` |
| `/portfolio` | `:177` | `PortfolioPage` | idem | lista das empresas do grupo | `public.portfolio` |
| `/empresas` | `:178` | `PortfolioPage` (mesma tela) | idem | alias de `/portfolio` | idem |
| `/identidade` | `:179` | `IdentidadePage` | idem | identidade visual/de voz da empresa selecionada | `public.portfolio.brand_identity`, Storage `helena-brand-assets` |
| `/indicadores` | `:180` | `IndicadoresPage` | idem | métricas de CRM/financeiro/risco/portfólio | `public.foco_executivo`, `portfolio`, `crm`, `financeiro`, `riscos` |
| `/modulo/:tabela` | `:181` | `Modulo` | idem | tabela genérica do catálogo (56 entradas, 55 com contrato de leitura; escrita em 8) | tabela do contrato (seção 8.4) |
| `*` | `:190` | bloco inline "Página não encontrada" dentro de `Protegida` | logado | 404 | — |

### 4.2 Redirecionamentos

| De | Para | Linha | Observação |
|---|---|---|---|
| `/cards-v2` | `/cards` | `:186` | preserva a busca |
| `/configuracoes-v2` | `/configuracoes` | `:187` | preserva a busca |
| `/painel`, `/helena` | `/` | `:162`, `:184` | |
| `/chat` | `/conversa` | `:184` | destino exige fundador |
| `/central-integracoes`, `/modulo/integracoes` | `/integracoes` | `:184` | |
| `/modulo/financeiro` | `/financeiro` | `:184` | rota estática vence `/modulo/:tabela` |
| `/modulo/crm` | `/crm` | `:184` | idem |
| `/modulo/equipe` | `/equipe` | `:184` | idem |
| `/supervisao`, `/execucao`, `/entregas`, `/consumo`, `/cobertura` | `/comando?aba=<mesmo nome>` | `:171` | dentro de `SomenteFundador` |
| `/inbox`, `/caixa-entrada` | `/comando?aba=supervisao` | `:185` | |
| `/central-execucao` | `/comando?aba=execucao` | `:185` | |
| `/?card=…`, `/?pedido=…` | `/cards` (com a busca) | `EntradaRaiz` `:125` | |

**Testes de rota:** `App.rotas-protegidas.test.tsx` (visitante, `app_access` ausente/inativo, redirecionamentos, membro barrado em `/comando /financeiro /crm /conversa /execucao /modulo/tarefas /sistema /oauth/consent`, destino seguro do login), `App.comando-rotas.test.tsx` (`/comando` e aliases de aba), `App.restauracao.test.tsx` (as 56 entradas do catálogo têm rota; membro não lê tabelas de negócio; troca de papel descarta o portfólio), `components/Layout.test.tsx`.

**Como mudar com segurança:** mexer em `App.tsx` altera segurança. Rotas novas entram no bloco certo (seção 11, receita 2); `SomenteFundador` e `AreaNegocios` não podem ser contornados. As rotas estáticas `/modulo/integracoes|financeiro|crm|equipe` tornam essas quatro tabelas **inalcançáveis** por `Modulo` (por design, são páginas próprias).

---

## 5. Páginas (`src/pages/`)

Padrão de leitura de cada ficha: **Arquivo:linha** (entrada) · **Quem** · **Dados** · **Contrato** · **Testes** · **Como mudar**.

### 5.1 Acesso e autorização

**`Login.tsx:21`** — `export default Login()`. Sem props. Usa `useAuth().entrar`; `getSafeRedirect` (`:10`) aceita só caminho local (rejeita `//`, `://`, `\`, caracteres de controle) e cai em `/`. Já autenticado e ativo → `<Navigate>` ao destino. Testes: `Login.test.tsx` (open-redirect, falha de conexão). Como mudar: preserve `getSafeRedirect`; o `Protegida` só envia caminho local e o Login confere de novo.

**`OAuthConsent.tsx:23`** — sem props; lê `?authorization_id=`. Exige `isFounder && appAccess.active && appAccess.user_id===user.id`. Chama `supabase.auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`; só navega para `redirect_url` aprovada por `validOAuthRedirect` (`lib/oauth-redirect.ts:2`: https, sem usuário/senha). Testes: `OAuthConsent.test.tsx`. Como mudar: nunca navegue para URL não validada; a chave `${user.id}\0${authorizationId}` impede reuso de autorização entre contas. Depende de OAuth Server do Supabase habilitado (**NÃO CONFIRMADO**).

### 5.2 Esteira v2 (cards, pedidos, configuração)

**`PainelV2Page.tsx:186`** (rota `/`) — props opcionais de teste `{repositorioCards, repositorioPedidos, repositorioConfig}`. Não-fundador: mensagem de área reservada e **nenhuma leitura**. Fundador: monta `Painel` (`:63`) com `key=user.id:fundador`, três leituras independentes (cards `listar()` cortados em 200; pedidos `listar()`; configuração: `listar()` + `ler(ativa.id)`, exige **exatamente uma** revisão ativa e `VALIDADA`, confere id/versão após a leitura). Cada fonte tem estado próprio (`—` em erro, botão para repetir só aquela). Testes: `PainelV2Page.test.tsx`. Como mudar: o painel declara "amostra" (200 cards, 50 pedidos); se alterar limites, ajuste os textos.

**`CardV2Page.tsx:142`** (rota `/cards`) — prop `{repositorio?: RepositorioCardsV2}`. Casca `CardV2Page` limpa `sessionStorage` de toques ao perder fundador/trocar de conta (`:142-152`); `ConteudoCardV2` (`:153`) lê `?card=` (UUID, deve existir na lista da conta; caso contrário remove o parâmetro e avisa) e `?pedido=` (só fundador; 0 ou 1 valor; vários → `null`). Blocos: Publicação (só fundador: `situacaoPublicacao`, `pedirPublicacao`; `SituacaoDoPedido` `:82` mostra "No ar" **somente** em `PUBLICADA`), Kanban (`components/cards-v2/KanbanV2`), detalhe (etapas, entrega aprovada como texto via `Entrega` `:66`, "Pedido registrado" via `resumoDaOrdem` `:36`, ações externas), e a seção recolhível "Pedidos e solicitações" (`Recolhivel` `:129`) com `EntradaPedidosV2`, `PareamentoTelegramV2` e `SolicitarCardReal`. Decisões do fundador: `LeituraCardFundadorV2` (card), `AcoesFundadorV2` (etapa/ação), `PerguntaFundadorV2` (etapa em PERGUNTA). Dados: seção 6.1. Testes: `CardV2Page.test.tsx`, `V2.alvo-de-toque.test.tsx`, `App.rotas-protegidas.test.tsx`. Como mudar: toda ação do fundador chama o banco e **reler** (`relerDepoisEvento`); nunca atualize estado local supondo sucesso. Todo botão novo do fundador precisa de `min-h-11`/`h-11` (teste de alvo de toque). `linhasDaEntrega` aqui (`:46`) é **cópia privada** de `integrations/comando-v2/linhas-da-entrega.ts:10`.

**`EntradaPedidosV2.tsx:9`** — `{identidade: string (user.id), repositorio?, pedidoInicial?: string|null}`; remonta por `identidade`. Fluxo: gera `requestId` UUID + `eventoId` `site:<uuid>`, guarda o envio em `sessionStorage` **antes** de chamar `receber` (reenvio idempotente após falha de rede), mostra recibo, lista (limite 50), consulta por ID e mostra `PropostaPedidoV2`. Testes: `EntradaPedidosV2.test.tsx`. Como mudar: o limite de 10.000 caracteres é `LIMITE_TEXTO_PEDIDO` (`pedidos-v2/repository.ts:2`); não troque a ordem "salvar pendente → enviar → apagar pendente".

**`PropostaPedidoV2.tsx:9`** — `{identidade, requestId, repositorio, aoAtualizar(pedido)}`. Lê `lerProposta` + `ler`; se a Helena fez perguntas, envia esclarecimento (`receber` com `eventoId` `site:esclarecimento:…`, pendente em `sessionStorage`); botão de confirmar chama `confirmarProposta(requestId, proposta.id)` — só o ID da proposta atual. Testes: `PropostaPedidoV2.test.tsx`. Como mudar: confirmar **não** cria card (`PLANO_CONFIRMADO` ≠ `CARD_CRIADO`).

**`SolicitarCardReal.tsx:12`** — `{repositorio: RepositorioCardsV2|null, identidade: string|null, onCardCriado()}`. O fundador carrega um JSON de "preparação" (≤ 1.000.000 bytes, `lerPreparacaoCardReal`), revisa prazo (UTC−03:00), 1–5 critérios, restrições, fontes HTTPS, confirma e envia `solicitarCardReal` com chave idempotente `HELENA-REAL-<sha256>`; trata resposta incerta consultando `consultarSolicitacaoPorChave`/`PorTarefa`. Testes: `SolicitarCardReal.test.tsx`, `cards-v2/preparacao-real.test.ts`. Como mudar: regras de validação vivem em `preparacao-real.ts`, não na tela; o banco revalida tudo.

**`AcoesFundadorV2.tsx:10`** — `{alvo: AlvoFundadorV2, identidade, cardId, repositorio, onAtualizar(), opcoesPermitidas?, bloquearConfirmo?}`. Oferece só as opções de `opcoesFundador(alvo)`, confirma em `ExecutiveConfirmDialog`, gera `toque` UUID, grava o toque pendente (impressão SHA-256) e chama `aplicarEventoFundador`; retoma consultando `consultarToqueFundador`. Testes: `AcoesFundadorV2.test.tsx`. Como mudar: as opções refletem as passagens da máquina (`helena-v2/maquina/passagens.yaml`); o banco decide sob lock. Não invente opção nova sem a passagem correspondente.

**`LeituraCardFundadorV2.tsx:23`** — `{card, identidade, pedidoOriginalDisponivel, repositorio, onAtualizar()}`. Fora de `ESPERANDO_CONFIRMACAO` (ou sem motivo `NENHUM|VALIDADOR_FALHOU|HELENA_FALHOU`) só repassa a `AcoesFundadorV2`. Em confirmação com motivo `NENHUM|VALIDADOR_FALHOU`, lê `lerLeituraCardFundador` e passa `bloquearConfirmo` enquanto o pedido original não estiver disponível ou a leitura não for comprovada: `leituraComprovada` (`:9`) exige card, versão, motivo, `historico_id`, `chave` e conteúdo da leitura de volta coerentes. Testes: `LeituraCardFundadorV2.test.tsx`. Como mudar: afrouxar `leituraComprovada` permite confirmar sem prova — não faça.

**`PerguntaFundadorV2.tsx:8`** — `{etapa, cardId, identidade, repositorio, onAtualizar()}`. Lê `lerPerguntaEtapaFundador` (2–3 opções A/B/C com consequência) e delega o envio a `AcoesFundadorV2`. Se a pergunta não bate com card/etapa/versão, não permite resposta. Testes: `PerguntaFundadorV2.test.tsx`.

**`PareamentoTelegramV2.tsx:8`** — `{identidade, repositorio?: RepositorioPareamentoTelegramV2}`. Consulta o vínculo, gera código (48 hex; exibido, **nunca guardado**) com expiração, revoga. Aparece em `/integracoes` e em `/cards`. Testes: `PareamentoTelegramV2.test.tsx`. Como mudar: o vínculo não prova webhook/Edge/resposta do bot (texto na tela já avisa).

**`ConfiguracoesV2Page.tsx:39`** (rota `/configuracoes`) — `{repositorio?: RepositorioConfigV2}`. Não-fundador: "Acesso restrito" (sem leitura). Fundador: histórico de revisões, abas de documentos (`grupos` `:9`: Agentes, Serviços, Roteiros, Modelos, Entregas), editor estruturado (`integrations/config-v2/DocumentEditor`) e JSON avançado, **salvar com `versao_esperada`**, clonar, solicitar validação, ativar com CAS (`ativa_esperada`), reverter (com `window.confirm`), inativar, importar `.json` (≤ 5 MB, caminhos `helena-v2/…`), histórico de ativações (10). Trava `operacao/importando` evita operações concorrentes; `identidade` reinicia tudo ao trocar de conta. Testes: `ConfiguracoesV2Page.test.tsx`, `V2.alvo-de-toque.test.tsx`, `App.rotas-protegidas.test.tsx`. Como mudar: documentos novos só com nomes `helena-v2/(agents|deliverables|playbooks)/[a-z0-9_-]+.yaml` (`caminhoNovoValido` `:22`); regras da máquina, identidades e schemas **não** se editam aqui. O banco valida e decide.

**`ComandoV2Page.tsx:88`** (rota `/comando`) — `{usarDados?: UsarDadosComando, carregadoresAbas?: CarregadoresAbas}` (ambos injetáveis em teste). Cabeçalho (empresa, hora, atualizar), alerta por fonte com erro ("não são zero: estão indisponíveis"), aviso de **amostra**, barra de abas ARIA (setas/Home/End), menu "Mais", painel da aba em `FalhaDaAba` (`:62`, uma aba que quebra não derruba o resto) + `Suspense`. Abas descobertas por `import.meta.glob('./comando-v2/abas/*Aba.tsx')` (`:25`), casadas por `ABAS[i].arquivo`; arquivo ausente → "Esta aba está em construção". Atualização automática a cada 30 s, pausada com a aba do navegador oculta (`:113-135`). `abrirCard(id)` navega para `/cards?card=<id>`. Empresa escolhida em `localStorage` `helena_v2_comando_empresa` (`GRUPO` = consolidado; empresa que sumiu do catálogo volta a `GRUPO` sem apagar o que foi salvo). **Não usa `BusinessContext`.** Testes: `ComandoV2Page.test.tsx`, `App.comando-rotas.test.tsx`. Como mudar: seção 11, receita 1.

**As 12 abas** (`src/pages/comando-v2/abas/`, todas `export default function XAba(props: PropsAba)` com `PropsAba = {dados: DadosComando, empresa: string, abrirCard(id)}`; todas só leem `dados`):

| Aba (`id` em `ABAS`) | Arquivo:linha | Visível | O que mostra | Lógica em | Teste |
|---|---|---|---|---|---|
| Visão geral (`visao-geral`) | `VisaoGeralAba.tsx:18` | barra | boas-vindas, 4 KPIs, "o que decidir agora", processo em miniatura, atalho do Financeiro, 3 gráficos, linha do tempo 14 dias, entregas por empresa | `derivar-visao-geral.ts` | `VisaoGeralAba.test.tsx` |
| Cards (`cards`) | `CardsAba.tsx:35` | barra | busca, filtros (`todos/precisa/vencido/andamento/prontos`), ordem, lista paginada (25), painel lateral | `derivar-cards.ts` | `CardsAba.test.tsx` |
| Processo (`processo`) | `ProcessoAba.tsx:27` | barra | quadro de **etapas** por estado + texto fixo do ciclo | `derivar-cards.ts` | `ProcessoAba.test.tsx` |
| Acompanhamento (`acompanhamento`) | `AcompanhamentoAba.tsx:64` | barra | sub-abas Execuções/Decisões; pedidos sem card | `derivar-cards.ts` | `AcompanhamentoAba.test.tsx` |
| Empresas (`empresas`) | `EmpresasAba.tsx:85` | barra | cartão por empresa (abertos, esperando, atrasados, prontos, entregas) e aviso de pacote de voz | `supervisao-v2.resumirEmpresas` | `EmpresasAba.test.tsx` |
| Agentes (`agentes`) | `AgentesAba.tsx:21` | barra | agentes do organograma por grupo, carga e serviços | `supervisao-v2.cargaPorAgente` | `AgentesAba.test.tsx` |
| Supervisão (`supervisao`) | `SupervisaoAba.tsx:28` | barra | fila de exceções por severidade/regra | `supervisao-v2.analisarCardsV2` | `SupervisaoAba.test.tsx` |
| Execução (`execucao`) | `ExecucaoAba.tsx:15` | **Mais** | central de execução em blocos de até 5 itens | `derivar-execucao.derivarExecucao` | `ExecucaoAba.test.tsx` |
| Entregas (`entregas`) | `EntregasAba.tsx:10` | **Mais** | galeria de entregas aprovadas; texto sob demanda | `EntregaGaleria` + `derivar-execucao.entregasAprovadas` | `EntregasAba.test.tsx` |
| Cobertura (`cobertura`) | `CoberturaAba.tsx:48` | **Mais** | matriz serviço × empresa (da configuração) + indicador aproximado de entrega aprovada | `supervisao-v2.entregasAprovadas` | `CoberturaAba.test.tsx` |
| Consumo (`consumo`) | `ConsumoAba.tsx:73` | **Mais** | só **volume** (entregas por semana, execuções por etapa); tokens/custo **não medidos** | `derivar-execucao` | `ConsumoAba.test.tsx` |
| Plano de evolução (`plano`) | `PlanoEvolucaoAba.tsx:42` | **Mais** | roteiro fixo Pronto/Em construção/Planejado + agentes por fase | `roteiro-plano.ts` (texto escrito à mão) | `PlanoEvolucaoAba.test.tsx` |

Como mudar qualquer aba: ajuste a regra na função pura `derivar-*`/`supervisao-v2` (com teste), não na aba; erro de leitura mostra erro, nunca zero; respeite o filtro `empresa` (`'GRUPO'` = todas).

**Páginas finas do fundador** (sem props de dado; recusam não-fundador e remontam por `user.id`):

| Página | Arquivo:linha | Dados / função | Teste | Observação |
|---|---|---|---|---|
| `ConversaV2Page` (`/conversa`) | `ConversaV2Page.tsx:5` | hospeda `EntradaPedidosV2` | `RestauracaoOperacaoV2.test.tsx` | |
| `EquipeV2Page` (`/equipe`) | `EquipeV2Page.tsx:8` (prop `repositorio?: RepositorioConfigV2`) | `lerCatalogoAtivo`: agentes e serviços da revisão ativa | `RestauracaoOperacaoV2.test.tsx` | estado = configuração, não runtime |
| `IntegracoesV2Page` (`/integracoes`) | `IntegracoesV2Page.tsx:5` | hospeda `PareamentoTelegramV2` | `RestauracaoOperacaoV2.test.tsx` | link para `/conversa` |
| `GovernancaV2Page` (`/sistema`) | `GovernancaV2Page.tsx:11` (props `repositorio?`, `repositorioConfig?`) | `checkpoint()` primeiro; `decisoes()` e `lerRevisaoGovernanca` em paralelo | `RestauracaoOperacaoV2.test.tsx`, `integrations/operacao-v2/operacao.test.ts` | não compara snapshot do checkpoint (diz isso na tela) |
| `OperacaoV2Page` | `OperacaoV2Page.tsx:17` (props `secao?`, `repositorio?`) | cards v2 em 5 seções | `RestauracaoOperacaoV2.test.tsx` | **ÓRFÃ: nenhuma rota a usa** (as URLs antigas viraram abas da Sala de comando). Candidata a remoção; só o teste a importa |

### 5.3 Módulos de negócio (mundo B)

Todas exigem fundador (rota) e rodam sob `AreaNegocios`. Filtram por empresa (`.in('business_id', selecionadas)`) **antes** de paginar e, em geral, paginam com `lerPaginas` (1000 por página, `count:'exact'`); exceções: `PortfolioPage` e `IdentidadePage` leem `portfolio` por conta própria e `Modulo` pagina de 25 em 25 com `range`. Só o fundador escreve (a tela esconde os controles e o banco confere). `SeloOrigemDados` (fontes, escopo, nº de registros) aparece em Financeiro, CRM, Calendário, Portfólio, Identidade e Indicadores (não em `Modulo`).

**`FinanceiroPage.tsx:147`** — 8 abas (`TABS` `:123`): `visao_geral`, `lancamentos`, `fluxo_caixa`, `dre`, `orcamento`, `recorrencias`, `plano_contas`, `contas_bancarias`. Lê (`carregarDados`): `financeiro` (ordem `finance_id`), `recorrencias`, `fluxo_caixa` (`periodo_inicio` desc), `plano_contas` (**sem filtro de empresa**), `contas_financeiras`, `orcamento`. Caixa e DRE **calculados no cliente** por `lib/caixa.ts` (`lerCaixa`, `lerDre`, `lerDreMes`); valores em centavos via `lib/domain/money.ts`. Escrita: `liquidarRapido` → `escreverRegistro('financeiro', …)`; `LancamentoModal` (insert direto em `financeiro` ou `escreverRegistro`), `OrcamentoModal` (insert direto em `orcamento`). Exporta CSV com `csvCell` (anti-fórmula). Testes: `FinanceiroPage.test.tsx`, `FinanceiroPage.filtros.test.tsx`, `components/financeiro/LancamentoModal.test.tsx`, `lib/caixa.test.ts`. Como mudar: o saldo exibido **não prova saldo real**; lançamento sem conta/competência/BRL é declarado incompleto, não somado. Não use `parseFloat`; use `money.ts`.

**`CrmPage.tsx:103`** — oportunidades de `public.crm` (`select *`, `.in business_id`, ordem `opportunity_id`); Kanban (`components/pipeline/PremiumKanban*`) e tabela; etapas `ETAPAS_CONFIG`/`ETAPAS_ORDEM` (`:59`/`:72`); filtros por etapa/empresa/busca; só fundador cria (`insert` com `opportunity_id: OPP-<uuid>`) ou edita (`escreverRegistro('crm', …)`). Testes: `CrmPage.test.tsx`, `CrmPage.filtros.test.tsx`. Como mudar: nova etapa exige tocar `ETAPAS_CONFIG`, `ETAPAS_ORDEM` e `IndicadoresPage.ETAPAS_ABERTAS`.

**`CalendarioPage.tsx:47`** — `carregarAgenda` (`lib/agenda-unificada.ts:75`) lê `calendario` e `tarefas` (paginado); tarefa com `prazo`/`occurrence_date` vira evento `EVT-TSK-<id>`; eventos do calendário ligados a uma tarefa (`related_object_type='tarefas'`) suprimem o duplicado; tarefa sem data vai para "sem data". Modos calendário/agenda, filtros, `TarefaAgendaModal` para criar/concluir/delegar. Testes: `CalendarioPage.test.tsx`, `lib/agenda-unificada.test.ts`, `components/tarefas/TarefaAgendaModal.test.tsx`. Como mudar: tarefas **não** são cards v2 (esteiras separadas).

**`PortfolioPage.tsx:58`** — `portfolio` com colunas explícitas (`business_id,negocio,ativo,estagio,objetivo_atual,marco_atual,…`); preenche ausentes com "DADO A COLETAR"; abrir empresa chama `setCurrentBusiness` e vai a `/indicadores`. Testes: `PortfolioPage.test.tsx`, `PortfolioPage.filtros.test.tsx`.

**`IdentidadePage.tsx:32`** — lê `portfolio` (`business_id,negocio,brand_identity,row_version`, `.eq(business_id).single()`); sem identidade salva, propõe `src/data/humano-digital-brand.json` (BIZ-003), `src/data/eliving-brand.json` (BIZ-004) ou `emptyBrand`; valida com `brandSchema` (zod, `lib/brand-identity.ts:26`); salva com `escreverRegistro('portfolio', id, row_version, {brand_identity})`; logo/preview via Storage `helena-brand-assets` (`lib/media-client.ts`; URL assinada de 300 s; upload PNG/JPG/WebP ≤ 5 MB). **Aprovar exige logo aprovado.** Testes: `IdentidadePage.test.tsx`, `IdentidadePage.vazio.test.tsx`. Como mudar: o mapeamento BIZ-003/BIZ-004 → JSON é fixo no código (`:55`); a existência do bucket e do RLS é **NÃO CONFIRMADO**.

**`IndicadoresPage.tsx:60`** — cinco leituras paginadas: `foco_executivo` (sem escopo), `portfolio`, `crm`, `financeiro`, `riscos`; falha em qualquer uma mostra erro (não métrica parcial); valores em BRL só com conversão registrada. Testes: `IndicadoresPage.restauracao.test.tsx`, `IndicadoresPage.melhorias.test.tsx`.

**`Modulo.tsx:29`** (`/modulo/:tabela`) — catálogo genérico: `obterModulo(tabela)` (`lib/modulos.ts`) + `CONTRATOS_MODULOS[tabela]` (`lib/modulo-contratos.ts`); seleciona **só as colunas do contrato**, filtra por empresa no servidor (`business_id` ou `business_id_area`; escopo `MISTO` inclui `null/GLOBAL/GRUPO`), busca `ilike` no campo `search`, 25 por página, detalhe em `ExecutiveDrawer`. Escrita só em 8 tabelas (`ideias, marketing, atendimento, projetos, marcos, produto, processos, riscos`: editar campos de `contrato.edit` via `escreverRegistro` e criar com `insert` e ID `PREFIXOS_CRIACAO` `:18`). Sem contrato (`configuracao`) → "Consulta indisponível". Testes: `Modulo.test.tsx`, `App.restauracao.test.tsx`. Como mudar: seção 11, receita 4.

---

## 6. Módulos de integração (`src/integrations/*`)

Regra comum: `criarRepositorioXxx(cliente)` é função pura (não importa o Supabase global); `runtime.ts` faz o `import()` dinâmico e injeta o cliente real; a interface do cliente é mínima (`schema(nome).rpc/from`), o que permite falsos nos testes. Respostas inesperadas viram `Error` (nunca lista vazia).

### 6.1 `cards-v2` — cards, publicação, decisões do fundador

| Arquivo:linha | O que é | Contrato | Testes |
|---|---|---|---|
| `repository.ts:96` `criarRepositorioCardsV2(cliente)` | repositório (`schema('helena_v2')`) | `RepositorioCardsV2` (`:76`): `listar`, `detalhar`, `situacaoPublicacao`, `pedirPublicacao`, `solicitarCardReal`, `consultarSolicitacaoPorChave`, `listarSolicitacoesReais`, `consultarSolicitacaoPorTarefa`, `aplicarEventoFundador`, `consultarToqueFundador`, `lerPerguntaEtapaFundador`, `lerLeituraCardFundador`; tipos `CardV2`, `EtapaV2`, `EntregaV2`, `AcaoExternaV2`, `DetalheCardV2`, `EventoFundadorV2`… | `repository.test.ts` |
| `runtime.ts:4` `repositorioCardsV2DoApp()` | injeta o cliente real | — | — |
| `acoes-fundador.ts:17` `opcoesFundador(alvo)` (+ `alvoCard/alvoEtapa/alvoAcao`, `impressaoDoToque` `:62`) | quais decisões a tela oferece por máquina/estado/motivo; SHA-256 do toque | `AlvoFundadorV2`, `OpcaoFundadorV2` | `acoes-fundador.test.ts` |
| `toque-pendente.ts:9` | guarda/recupera o toque em `sessionStorage` (UUID + impressão de 64 hex) | `ToquePendente` | `toque-pendente.test.ts` |
| `rotulos.ts:5` `ROTULOS_ESTADO_CARD`, `rotuloEstado`, `rotuloMotivo` | códigos de estado/motivo → português; desconhecido vira texto legível, nunca é escondido | — | `rotulos.test.ts` |
| `preparacao-real.ts:25` `lerPreparacaoCardReal`, `validarRevisaoPedidoReal` `:127`, `fonteHttpsPublica` `:159`, `montarSolicitacaoCardReal` `:175`, `chaveDaSolicitacaoReal` `:199` | valida o envelope de preparação, a revisão do fundador e gera a chave idempotente | `PreparacaoCardReal`, `RevisaoPedidoReal` | `preparacao-real.test.ts` |

**Banco acessado (exatamente):**

| Chamada | Tipo | Migration |
|---|---|---|
| `helena_v2.card` `select id,titulo,empresa,estado,dono,prazo,criado_em,versao,motivo,pedido_grande` (ordem `criado_em` desc) | tabela (RLS fundador) | 0001/0002/0005 |
| `helena_v2.etapa` `select id,codigo,nome,estado,autor,dono,prazo_ate,revisores,versao,portao1_ok,entrega_fresca,motivo,revisor,julgadora` `eq card_id, atual=true` | tabela | idem |
| `helena_v2.entrega` `select id,etapa_id,versao,portao1,conteudo,criada_em` `eq card_id, portao1='PASSOU'` — o repositório **filtra de novo**: só etapa `APROVADA/PRONTA` com `portao1_ok`, `entrega_fresca` e mesma versão | tabela | idem |
| `helena_v2.card` projeção `ordem_de_servico->>pedido_original`, `->como_e_o_pronto`, `->nao_pode`, `->fontes_que_pode_ler` | tabela | 0001 |
| RPC `listar_acoes_card(p_card_id)` | RPC | 0011 |
| RPC `situacao_publicacao()` / `pedir_publicacao()` | RPC | 0005, 0018 |
| RPC `solicitar_card_real(p_tarefa_id,p_prazo,p_plano,p_dados_reais,p_config_revision_id,p_chave_idempotencia)` | RPC | 0007, 0009 |
| `helena_v2.solicitacao_card_real` `select id,card_id[,chave_origem,criado_em]` | tabela | 0007 |
| RPC `aplicar_evento(p_maquina,p_alvo,p_papel='FUNDADOR',p_evento,p_parametros,p_ator,p_chave,p_versao_vista,p_conteudo,p_toque,p_automaticos)` | RPC (função única da máquina) | 0003, 0012 |
| RPC `consultar_toque_fundador(p_card_id,p_toque)`, `ler_pergunta_etapa_fundador(p_etapa_id)` | RPC | 0013 |
| RPC `ler_leitura_card_fundador(p_card_id)` | RPC | 0014 |

**Como mudar:** acrescentar coluna só se existir nas migrations 0001/0002 (cite a migration); a tela só **oferece** o que `opcoesFundador` descreve, o banco decide sob lock; o `toque` UUID + impressão garante retomada sem duplicar decisão — não gere `toque` novo ao repetir.

### 6.2 `pedidos-v2` — entrada de pedidos e propostas

| Arquivo:linha | O que é | Testes |
|---|---|---|
| `repository.ts:126` `criarRepositorioPedidosV2` | `receber` `:137`, `ler` `:145`, `listar` `:165`, `lerProposta` `:173`, `confirmarProposta` `:190`; valida recibo (`lerRecibo`), proposta (`lerPropostaValor`) e envio (`validarEnvioPedido` `:120`); `ErroEntradaPedidos` `:38` traduz códigos (`42501`, `23505`, `PGRST202/42883`, `40001`, `23514`, `22023`) sem vazar a mensagem do banco | `repository.test.ts` |
| `runtime.ts:3` | `repositorioPedidosV2DoApp()` | — |
| `pendente.ts:5-55` | recibos pendentes em `sessionStorage` (`lerPedidoPendente`, `salvarPedidoPendente`, `apagarPedidoPendente`, `guardarUltimoPedido`, `lerUltimoPedido`, esclarecimentos) | `EntradaPedidosV2.test.tsx` |

RPCs (todas `helena_v2`): `receber_pedido_entrada(p_request_id,p_origem='SITE',p_evento_id,p_texto)` (0021/0022), `ler_pedido_entrada(p_request_id)` (0021), `listar_pedidos_entrada(p_limite=50)` (0021), `ler_proposta_pedido(p_request_id)` e `confirmar_proposta_pedido(p_request_id,p_proposta_id)` (0024). Estados: `RECEBIDO → PLANO_CONFIRMADO → CARD_CRIADO` (coerência de campos validada em `lerRecibo`). **Como mudar:** estado novo exige atualizar `lerRecibo`, `EstadoPedidoEntrada`, `EntradaPedidosV2.AndamentoPedido`, `PainelV2Page.descricaoDoPedido` e a Sala de comando.

### 6.3 `config-v2` — revisões da configuração

| Arquivo:linha | O que é | Testes |
|---|---|---|
| `repository.ts:66` `criarRepositorioConfigV2` | `listar`, `ler`, `salvar`, `solicitarValidacao`, `ativar`, `aposentar`, `listarAtivacoes`, `reverter`; `erroDaResposta` `:49` traduz `CONFIG_SEM_ANTERIOR`, `CONFIG_ANTERIOR_NAO_VALIDADA`, `CONFIG_ATIVA_DESATUALIZADA`, códigos `40001`/`23514` | `repository.test.ts` (inclui **conferência dos argumentos contra o SQL da 0019**) |
| `runtime.ts:4` | `repositorioConfigV2DoApp()` | — |
| `DocumentEditor.tsx:9` | editor recursivo de JSON (`{label, value: JsonValue, onChange, onRemove?, depth?}`) | indireto: `ConfiguracoesV2Page.test.tsx` |

RPCs (`helena_v2`): `listar_configuracoes()`, `ler_configuracao(p_id)`, `salvar_rascunho(p_nome,p_conteudo,p_id,p_versao_esperada,p_base_id)`, `solicitar_validacao_config(p_id,p_versao)`, `ativar_configuracao(p_id,p_ativa_esperada)`, `aposentar_configuracao(p_id)` (todas 0006); `listar_ativacoes(p_limite)` e `reverter_configuracao(p_ativa_esperada)` (0019). **Como mudar:** `p_versao_esperada` e `p_ativa_esperada` são o controle otimista de concorrência; nunca os omita. Renomear parâmetro quebra o teste de contrato com a 0019.

### 6.4 `telegram-v2` — pareamento

`repository.ts:60` `criarRepositorioPareamentoTelegramV2`: `gerar()` → RPC `gerar_pareamento_telegram`; `consultar()` → `consultar_pareamento_telegram`; `revogar()` → `revogar_pareamento_telegram` (todas 0022, sem argumentos). Valida: código `^[0-9a-f]{48}$`, coerência `vinculado`/`chat_id`/`codigo_pendente`; `revogar` falha se o banco ainda diz `vinculado`. `runtime.ts:3`. Testes: `repository.test.ts`, `pages/PareamentoTelegramV2.test.tsx`. Como mudar: nunca persista o código no navegador.

### 6.5 `operacao-v2` — catálogo e governança

- `catalogo.ts:20` `catalogoDaConfig(detalhe)`, `:38` `lerCatalogoAtivo(repo)`: extrai `agentes` de `helena-v2/organograma.yaml` e `servicos` de `helena-v2/servicos.yaml` do `conteudo` da revisão; exige **exatamente uma** revisão ativa e `VALIDADA` e confere id/versão/hash entre `listar` e `ler`. Formato inesperado lança erro claro.
- `governanca.ts:18` `criarRepositorioGovernancaV2(cliente)`: `checkpoint()` lê `public.checkpoint_mestre_atual` com **projeção explícita** `checkpoint_id,versao,status,atualizado_em` (`limit 2`; >1 linha = "ambíguo"); `decisoes()` lê `public.decisoes` `decision_id,status,data_hora,escopo`, ordem `data_hora` desc, `limit 30` (nunca o texto/motivo). `:42` `repositorioGovernancaV2DoApp()`, `:47` `lerRevisaoGovernanca`.
- Testes: `operacao.test.ts`. A definição da view `checkpoint_mestre_atual` **não está nas migrations do repositório** (só em stubs de teste): origem **NÃO CONFIRMADA**.

### 6.6 `comando-v2` — leituras em lote e lógica da Sala de comando

| Arquivo:linha | Função | Testes |
|---|---|---|
| `tipos.ts:12-129` | contrato: `AbaId`, `ABAS` (ordem/arquivo/`visivel`), `DadosComando`, `PropsAba`, `EstadoLeitura`, `CardComando`, `EtapaComando`, `EntregaResumo`, `CatalogoComando`, `ESTADOS_ESPERA_FUNDADOR`, `ESTADOS_FINAIS`, `dadosVazios` | indireto em quase tudo |
| `repository.ts:62` `criarRepositorioComandoV2` | `lerCards` (`:66`, limite 500), `lerEtapasAtuais` (`:77`, 3000, `atual=true`), `lerEntregas` (`:88`, 1500, **sem `conteudo`**); páginas de 1000; `amostra=true` quando bate no limite; colunas em `COLUNAS_CARD/ETAPA/ENTREGA` (`:35-40`) | `repository.test.ts` |
| `runtime.ts:4` | `repositorioComandoV2DoApp()` | — |
| `useDadosComando.ts:60` `criarUseDadosComando(deps)` / `:100` `useDadosComando` | 5 fontes independentes (`cards`, `etapas`, `entregas`, `pedidos`, `catalogo`); falha de uma marca só o `estado` dela como `'erro'` (mantém itens anteriores); recarga: a última vence | `useDadosComando.test.tsx` |
| `catalogo-comando.ts:16`/`:45` `catalogoComando`, `lerCatalogoComandoAtivo` | empresas (`organograma.empresas`, com `pacote`), agentes (`id,identidade,nome,cargo,grupo,estado,fase`) e serviços da revisão ativa | `catalogo-comando.test.ts` |
| `derivar-cards.ts` | filtro/ordem/rótulos/prazos das abas Cards/Processo/Acompanhamento (`filtrarCards:194`, `contarPorFiltro:201`, `etapaAtrasada:209`, `etapaParada:214`, `prazoRelativo:98`…) | `derivar-cards.test.ts` |
| `derivar-execucao.ts:159` `derivarExecucao` e `entregasAprovadas:274`, `entregasPorSemana:289`, `execucoesPorEtapa:309` | blocos da Central de execução, galeria e Consumo | `derivar-execucao.test.ts` |
| `derivar-visao-geral.ts` | `kpis:326`, `prioridades:284`, `porEstado:104`, `porEmpresa:129`, `etapasPorAgente:171`, `serieDiaria:203`, `COLUNAS_PROCESSO:45`… | `derivar-visao-geral.test.ts` |
| `supervisao-v2.ts:157` `analisarCardsV2` | 9 regras de exceção: `SEM_DONO, SEM_PRAZO, PRAZO_VENCIDO, ESPERANDO_VOCE, ENCERRADO_COM_FALHA, PORTAO_OU_ENTREGA, EXECUCAO_PARADA, SEM_EMPRESA, PEDIDO_SEM_CARD`; limites `LIMITE_ESPERA_MEDIA_H=24`, `…ALTA_H=72`, `EXECUCAO_PARADA_H=1`, `PEDIDO_SEM_CARD_H=1`; também `resumirEmpresas:292`, `cargaPorAgente:318`, `entregasAprovadas:277` | `supervisao-v2.test.ts` |
| `linhas-da-entrega.ts:10` | JSON da entrega → linhas legíveis (laço iterativo), `textoParaCopiar`, `copiarTexto` | `linhas-da-entrega.test.ts` |
| `roteiro-plano.ts:25` `ITENS_ROTEIRO` | texto **fixo** do "Plano de evolução" (não é leitura do banco) | indireto: `PlanoEvolucaoAba.test.tsx` |
| `*.fixtures.ts`, `dados-de-teste-execucao.ts` | dados à mão **só para teste** (não importados pelo app) | — |

**Como mudar:** `DadosComando`/`PropsAba` só ganham campos **opcionais**; nunca renomeie nem remova. Funções `derivar-*` e `supervisao-v2` ficam puras (sem rede, sem relógio escondido, sem importar cliente). Ver armadilhas 1–3 (seção 13) antes de mexer em "entrega aprovada" ou rótulos.

---

## 7. Componentes compartilhados (`src/components/`)

### 7.1 Casca e navegação

| Arquivo:linha | Contrato | Usado por | Testes | Como mudar |
|---|---|---|---|---|
| `Layout.tsx:21` `Layout` | sem props; usa `useAuth` e `gruposNavegacao(isFounder)`; menu lateral pesquisável (normaliza acentos), grupos recolhíveis, painel móvel com foco preso e `Esc`; cabeçalho "Central Executiva" com e-mail e **Sair**; mostra `ExecutiveBusinessSwitcher` só nos caminhos de negócio (regex `:48`); `<main id="conteudo-principal">` dentro de `PageBoundary` | `App.tsx` (rota-pai) | `Layout.test.tsx` | `destinoAtivo` (`:13`) trata `/comando?aba=` (a aba decide o item ativo); caminho de negócio novo precisa entrar no regex `:48`; manter alvos ≥ 44 px |
| `lib/navegacao.ts:26` `gruposNavegacao(fundador)` | membro → só "Visão geral" e "Cards" (`:27`); fundador → 4 grupos fixos + módulos do catálogo ainda sem item, agrupados em "Módulos · <grupo>" (51 hoje: 56 menos os 5 com rota própria) | `Layout` | `Layout.test.tsx`, `App.restauracao.test.tsx` | todo módulo do catálogo precisa ter destino (teste de 56 entradas) |
| `executive/PageBoundary.tsx:20` | `{children}`: `ErrorBoundary` + `Suspense` com `key=pathname`; erro → "Vamos recuperar esta página" com recarga | `App.tsx`, `Layout` | indireto | falha de rota lazy cai aqui |

### 7.2 Kit executivo (`components/executive/`)

| Componente (arquivo:linha) | Props principais | Observação |
|---|---|---|
| `ExecutiveBadge.tsx:21` | `variant: neutral/default/success/warning/danger/info/purple/outline`, `size`, `dot` | cores fixas hexadecimais |
| `ExecutiveBusinessSwitcher.tsx:14` | sem props; `useBusiness()` | alterna `GRUPO`/empresa |
| `ExecutiveConfirmDialog.tsx:26` | `{open, onOpenChange, title?, description?, confirmLabel?, danger?, onConfirm}` | usa `ui/alert-dialog`; só `AcoesFundadorV2` |
| `ExecutiveDrawer.tsx:22` | `{open, onOpenChange, title, subtitle?, description?, badge?, footer?, width?}` | usa `ui/sheet`; `Modulo`, `PainelCardLateral` |
| `ExecutiveEmptyState.tsx:13` | `{title, description, icon?, actionLabel?, onAction?}` | estado vazio padrão |
| `ExecutiveErrorState.tsx:12` | `{title?, moduleName?, message?, onRetry?}` | texto padrão fala "Supabase" |
| `ExecutiveLoadingState.tsx:11` | `{message?, rows?, type: table/cards/details}` | `role="status"` |
| `ExecutiveLogo.tsx:9` | `{collapsed?, size?}` | texto "Sistema Helena / Central Executiva" |
| `ExecutiveMetricCard.tsx:19` | `{label, value, subtext?, icon?, badge?, hasData?, trend?}` | valor ausente (`null`/vazio/`hasData=false`) mostra "—", não zero |
| `ExecutivePageHeader.tsx:16` | `{title, description?, icon?, badge?, actions?, breadcrumb?}` | |
| `SeloOrigemDados.tsx:19` | `{fontes: string[], escopo?, registros?, unidade?}` | só descreve a consulta; **não prova saldo/operação** |

Sem testes próprios (cobertura indireta pelas páginas). Como mudar: são usados por dezenas de telas; mantenha as props atuais e acrescente só opcionais.

### 7.3 Sala de comando (`components/comando-v2/`)

| Arquivo:linha | Props principais | Usado por | Teste |
|---|---|---|---|
| `AgenteCartao.tsx:30` | `{agente, carga: CargaAgente/null, servicos, recorte?}` | `AgentesAba` | `AgenteCartao.test.tsx` |
| `BlocoExecucao.tsx:36` | `{id, titulo, descricao, icone, tom?, estado?, itens?, total?, vazio?, nota?, abrirCard?, children?}` | `ExecucaoAba` | indireto |
| `BoasVindas.tsx:11` | `PropsVisao`; usa `useAuth` para o nome | `VisaoGeralAba` | indireto |
| `EntregaGaleria.tsx:51` | `{dados, empresa, abrirCard, carregarDetalhe?}`; busca, agrupa (`empresa/agente/etapa/nenhum`), abre texto **sob demanda** com `repositorioCardsV2DoApp().detalhar` | `EntregasAba` | `EntregaGaleria.test.tsx` |
| `EntregasPorEmpresa.tsx:10` | `PropsVisao` | `VisaoGeralAba` | indireto |
| `ExcecaoCard.tsx:24` | `{excecao, nomeEmpresa?, agora, abrirCard?}` | `SupervisaoAba` | `ExcecaoCard.test.tsx` |
| `GraficosComando.tsx:161` (+ `CartaoGrafico:20`, `ValoresEmTexto:28`, `GraficoEstados:37`, `GraficoEmpresas:79`, `GraficoAgentes:119`) | `PropsVisao`; recharts sem animação, com `role="img"` e lista em texto | `VisaoGeralAba`, `LinhaDoTempo` | indireto |
| `KpisComando.tsx:36` (+ `PorLeitura:17`, `AvisoAmostra:28`, `PropsVisao:14`) | 4 números; `PorLeitura` troca por erro/carregando em vez de zero | várias | indireto |
| `LinhaDoTempo.tsx:23` | `PropsVisao`; 14 dias (`DIAS_LINHA_DO_TEMPO`) | `VisaoGeralAba` | indireto |
| `ListaCards.tsx:34` (+ `AvisoAmostra:13`) | `{cards, catalogo, agora, selecionadoId, onSelecionar, total, onMostrarMais?, passo?}` | `CardsAba`, `ProcessoAba`, `AcompanhamentoAba` | indireto |
| `PainelCardLateral.tsx:46` | `{card, etapas, entregas, estadoEtapas, estadoEntregas, catalogo, agora, posicao, onAnterior?, onProximo?, onFechar, abrirCard}` | `CardsAba` | indireto |
| `PrioridadesComando.tsx:23` | `PropsAba`; até 8 itens (`LIMITE_PRIORIDADES`) | `VisaoGeralAba` | indireto |
| `ProcessoBoard.tsx:26` | `{etapas, cards, catalogo, agora, onAbrirCard, porColuna?}` (agrupa por estado da **etapa**) | `ProcessoAba` | indireto |
| `ProcessoCompacto.tsx:9` | `PropsVisao` (colunas do card, `COLUNAS_PROCESSO`) | `VisaoGeralAba` | indireto |

Como mudar: cada componente só apresenta o que recebe; o cálculo mora em `integrations/comando-v2`. Linhas/botões ≥ 44 px, sem rolagem horizontal em 390 px, cores só por tokens do tema.

### 7.4 Outros

| Arquivo:linha | Contrato | Usado por | Teste | Como mudar |
|---|---|---|---|---|
| `cards-v2/KanbanV2.tsx:34` | `{cards: CardV2[], selecionado, onSelecionar(id), formatarPrazo}`; 5 colunas por estado do card (Preparação, Aguardando você, Em trabalho, Pronto, Encerrado) + "Estado não reconhecido" | `CardV2Page` | indireto (`CardV2Page.test.tsx`) | estado novo de card: ver armadilha 2; "Pronto" ≠ publicado |
| `financeiro/LancamentoModal.tsx:36` | `{aberto, onFechar, onSalvo, lancamentoParaEditar?, contasDisponiveis?, planosDisponiveis?}`; só fundador, empresa dentre `selecionadas`; valor por `parseBRLCents` | `FinanceiroPage` | `LancamentoModal.test.tsx` | `finance_id` novo gerado no cliente; edição por `escreverRegistro` |
| `financeiro/OrcamentoModal.tsx:15` | `{aberto, onFechar, onSalvo, planosDisponiveis?}`; insert em `orcamento` | `FinanceiroPage` | indireto | sem teste próprio |
| `pipeline/PremiumKanbanCard.tsx:18` / `PremiumKanbanColumn.tsx:14` | cartão `{title, value, probability, customerName?, expectedCloseDate?, nextActionDate?, onClick}`; coluna `{title, count, totalValue, color, icon, children}` | `CrmPage` | indireto | datas só `AAAA-MM-DD` válidas |
| `tarefas/TarefaAgendaModal.tsx:56` | `{aberto, onFechar, taskIdInicial?, acaoInicial?: 'nova'/'delegar'/null, dataPrazoSugerida?, onAtualizado?}`; lê `tarefas`, cria/conclui/delega via `lib/tarefa-acoes.ts` | `CalendarioPage` | `TarefaAgendaModal.test.tsx` | novo `task_id` = próximo `TSK-NNNN` (`proximoTaskId`) |
| `ui/*` (8 arquivos shadcn: `alert-dialog, avatar, badge, button, card, dropdown-menu, sheet, skeleton`) | padrão shadcn (`components.json`, estilo default, `cssVariables`) | kit executivo e telas | — | gerados; use `cn()` de `lib/utils.ts` |

---

## 8. Biblioteca (`src/lib/`)

| Arquivo:linha | Para que serve | Contrato | Usado por | Testes | Como mudar |
|---|---|---|---|---|---|
| `supabase.ts:12` | cliente único | `supabase`, `supabaseUrl` | tudo | — | seção 3.7 |
| `utils.ts:4` | `cn(...classes)` (clsx+twMerge) | — | `ui/*` | — | — |
| `escrita-protegida.ts:13` `escreverRegistro(tabela, id, versao, alteracoes, excluir)` | **única** porta de escrita versionada: valida tabela (`TABELAS_PROTEGIDAS` `:5`, 54 nomes), id, versão `^[1-9][0-9]*$`, chave primária via `CONTRATOS_MODULOS`, recusa mudar PK/`business_id`/`scope_type`/`source_system`, remove colunas de sistema, chama RPC **`public.helena_write_record(p_table,p_id,p_expected_version,p_changes,p_delete)`**; conflito `PT409`/`40001` → `MENSAGEM_CONFLITO` | retorna `{data, error}` | Financeiro, Lançamento, CRM, Identidade, Modulo, tarefa-acoes | `escrita-protegida.test.ts` | a versão vem **da leitura que originou a edição**, nunca busque outra para repetir; tabela nova de escrita exige entrada em `TABELAS_PROTEGIDAS` **e** contrato com PK |
| `leitura-paginada.ts:4` `lerPaginas(consultar, signal?)` | pagina de 1000 em 1000 até a página vazia (ou `count`) | `Pagina<T>` | Financeiro, CRM, Portfólio, Indicadores, Agenda, TarefaAgendaModal | `leitura-paginada.test.ts` | com `count` desconhecido só página vazia encerra |
| `modulos.ts:13` `MODULOS` (56), `obterModulo:91` | catálogo (tabela, título, grupo, escopo `BUSINESS/GLOBAL/MISTO`, `rota?`, `somenteLeitura?`). Sem uso fora do arquivo: `GRUPOS`, `obterEscopoModulo`, `SEM_EXCLUSAO`, `COLUNAS_SISTEMA` | | `navegacao`, `Modulo` | `App.restauracao.test.tsx`, `Layout.test.tsx` | entrada nova → receita 4 |
| `modulo-contratos.ts:18` `CONTRATOS_MODULOS` (55) | colunas **históricas** permitidas por tabela (`id`, `business?`, `global?`, `columns`, `search?`, `edit?`, `create?`) — não é o esquema vivo | | `Modulo`, `escrita-protegida` | indireto | coluna inexistente no banco real quebra a leitura do módulo |
| `navegacao.ts:26` | menu (seção 7.1) | | `Layout` | `Layout.test.tsx` | |
| `caixa.ts:37` `lerCaixa`, `:85` `lerDre`, `:107` `lerDreMes`, `valorEmBrl:26`, `variacaoPercentual:112` | caixa/DRE em BRL a partir de lançamentos; exclui `PREVISTO/CANCELADO/ABERTO/VENCIDO` do caixa, transferências, parcial sem valor informado e moeda sem conversão (devolve `incompleto` + `motivos`) | | `FinanceiroPage` | `caixa.test.ts` | nunca some valor não confirmado em BRL |
| `domain/money.ts` | centavos inteiros: `parseBRLCents:8`, `parseDatabaseCents:19`, `parseSignedDatabaseCents:62`, `extractBRLCents:27`, `formatBRL:56`, `csvCell:70` (aspa-protege fórmula de planilha) | | Financeiro, modais, CRM, caixa | indireto (`caixa.test.ts`, `LancamentoModal.test.tsx`) | sem `parseFloat` |
| `agenda-unificada.ts:75` `carregarAgenda(selecionadas, _todasLigadas, signal?)` | une `calendario` + `tarefas` (colunas listadas em `:79-90`); `tarefaParaEvento:55`; `TarefaRow`, `EventoAgenda` | | Calendário, modal, tarefa-acoes | `agenda-unificada.test.ts` | evento de calendário ligado a tarefa esconde a tarefa duplicada |
| `tarefa-acoes.ts` | `criarTarefaNova` (insert em `tarefas` com `status:'NÃO INICIADA'`, `source_system:'HELENA'`), `atualizarTarefa`/`concluirTarefa`/`delegarTarefa` (via `escreverRegistro`), `concluirTarefaPorId`, `proximoTaskId` | | Calendário, modal | indireto (`TarefaAgendaModal.test.tsx`) | status de conclusão = contém "CONCLU" |
| `tarefa-calendario.ts:5` `sincronizarTarefaNoCalendario` | RPC **`public.helena_sync_calendar(p_source,p_id,p_expected_version)`** | | **ninguém importa** (código morto) | — | só reative com decisão explícita |
| `brand-identity.ts` | `BRAND_FIELDS`, `brandSchema` (zod), `emptyBrand`, `brandMissing`, `safeBrandAsset` | | `IdentidadePage` | indireto | `schema_version` literal `1` |
| `media-client.ts:11/17` | `brandPreview`, `uploadBrand` (bucket `helena-brand-assets`, caminho `BIZ-NNN/<uuid>.<ext>`) | | `IdentidadePage` | `media-client.test.ts` | referência só `storage://helena-brand-assets/BIZ-NNN/<arquivo>` |
| `oauth-redirect.ts:2` | `validOAuthRedirect` | | `OAuthConsent` | `OAuthConsent.test.tsx` | |

### 8.4 Tabelas `public.*` que o site toca (mundo B)

Leitura: `app_access`, `portfolio`, `financeiro`, `recorrencias`, `fluxo_caixa`, `plano_contas`, `contas_financeiras`, `orcamento`, `crm`, `calendario`, `tarefas`, `foco_executivo`, `riscos`, `decisoes`, view `checkpoint_mestre_atual`, e as 55 tabelas do catálogo via `Modulo`. Escrita direta (`insert`): `portfolio` (só `incluirEmpresa`, sem UI), `financeiro`, `orcamento`, `crm`, `tarefas`, `ideias|marketing|atendimento|projetos|marcos|produto|processos|riscos` (criação em `Modulo`). Escrita versionada (`rpc helena_write_record`): as demais edições. Se esses `insert` diretos são permitidos pelo RLS real é **NÃO CONFIRMADO**.

---

## 9. Tema e estilos

- **Tailwind** (`tailwind.config.ts`): `darkMode: ["class"]`, cores por variável (`hsl(var(--background))` etc., inclusive `success`, `warning`, `sidebar-*`), fonte `Figtree`, raios por `--radius`, animações `fade-in/slide-up/scale-in`. PostCSS: `tailwindcss` + `autoprefixer`.
- **`src/index.css`**: importa fontes (Figtree, Outfit), `@tailwind`; tokens em `:root` (`:17`, tema claro, primária verde `150 100% 24%`) e `.dark` (`:82`); `@layer base/components` (corpo, `.metric-card`…).
- **`src/styles/helena.css`**: casca do app (`.he-app`, `.he-workspace*`, `.he-nav-link`, `.he-skip-link`, `.he-brand*`), páginas v2 (`.he-v2-card-page`, `.he-v2-config-page`), login/acesso (`.he-login-*`, `.he-access-*`), `.he-page-recovery`/`.he-page-skeleton`; variáveis próprias `--he-line`, `--pe-border` etc. com ramo `html.dark`.
- **`src/styles/negocios.css`**: classes `.pe-*` do calendário/modais de tarefa (`.pe-tab`, `.pe-cal-dia`, `.pe-modal-premium*`, `.pe-acao-tarefa*`), todas sob `.he-app`.
- **Tema escuro:** as variáveis existem, mas **nenhum código em `src/` aplica a classe `dark`** (grep de `next-themes`, `ThemeProvider`, `classList` não encontra); o tema segue o que o navegador/HTML definir. Alternância de tema: **NÃO CONFIRMADO**.
- **Acessibilidade exigida pelos testes:** alvo de toque ≥ 44 px (`min-h-11`/`h-11`), `role="status"/"alert"`, `aria-*` nas abas; `V2.alvo-de-toque.test.tsx` varre botões e links do fundador em `/cards` e `/configuracoes`.
- **Como mudar:** use tokens (`bg-background`, `text-foreground`, `border-border`…), nunca cor fixa nova em tela v2 (os componentes `Executive*` ainda têm hexadecimais legados). Evite acoplar CSS a `aria-label` (armadilha 8).

---

## 10. Testes: como são organizados

- **Executar:** seção 12. Pasta única `src/**/*.test.ts(x)`: 73 arquivos, 624 testes no commit lido. Configuração `vitest.config.ts` (jsdom, globals, alias `@`, `--pool=threads` no `npm test`).
- **Padrões:** (a) **repositório**: cliente falso que registra `schema`, nome da RPC e argumentos e os compara exatamente (`config-v2/repository.test.ts`); (b) **página**: `vi.mock('@/auth')` e/ou `vi.mock('@/lib/supabase')` e injeção de `repositorio`/`usarDados`; (c) **rotas**: `App.*.test.tsx` simulam `supabase.auth` + `from('app_access')`; (d) **puros**: `derivar-*.test.ts` com `fixtures`; (e) **acessibilidade**: `V2.alvo-de-toque.test.tsx`.
- **Efeitos colaterais comuns:** `ComandoV2Page.test.tsx` stuba `ResizeObserver` (recharts); `configure({asyncUtilTimeout})` e `vi.setConfig({testTimeout: 60000})` nos testes de rota pesados.
- **Cobertura por área:** rotas/guardas (`App.*`), auth (`auth.test.tsx`), empresa (`contexts/*`), cards (`cards-v2/*`, `CardV2Page`, `AcoesFundadorV2`, `LeituraCardFundadorV2`, `PerguntaFundadorV2`, `SolicitarCardReal`, `EntradaPedidosV2`, `PropostaPedidoV2`, `PareamentoTelegramV2`), configuração (`config-v2`, `ConfiguracoesV2Page`), Sala de comando (12 testes de aba + `ComandoV2Page` + `comando-v2/*` + 3 de componentes), negócio (`Financeiro*`, `Crm*`, `Calendario*`, `Portfolio*`, `Identidade*`, `Indicadores*`, `Modulo`, `lib/*`).
- **Sem teste direto:** `lib/supabase.ts`, `lib/tarefa-calendario.ts` (morto), `lib/domain/money.ts` (indireto), `integrations/*/runtime.ts`, `OrcamentoModal`, `components/executive/*`, `components/ui/*`, `roteiro-plano.ts` (indireto), `useDadosComando` default (o factory é testado), `OperacaoV2Page` (testada mas sem rota).

---

## 11. Receitas

### Receita 1 — Adicionar uma aba na Sala de comando

1. **Contrato (`src/integrations/comando-v2/tipos.ts`)**: acrescente o id em `AbaId` (`:87`) e uma linha em `ABAS` (`:92-105`): `{ id: 'minha-aba', rotulo: 'Minha aba', arquivo: 'MinhaAba', visivel: true|false }` (`false` = menu "Mais"). O `arquivo` **deve terminar em `Aba`**.
2. **Arquivo da aba**: crie `src/pages/comando-v2/abas/MinhaAba.tsx` com `export default function MinhaAba({ dados, empresa, abrirCard }: PropsAba)`. Não há mais nada a registrar: `ComandoV2Page` usa `import.meta.glob('./comando-v2/abas/*Aba.tsx')` (`ComandoV2Page.tsx:25`) e casa pelo nome do arquivo.
3. **Dados**: leia só `dados` (cards, etapas, entregas, pedidos, catalogo, `agora`, `estado`, `amostra`). Para cada fonte, trate `dados.estado.<fonte>`: `'carregando'` → `ExecutiveLoadingState`; `'erro'` → `ExecutiveErrorState` (**nunca zero**); `'pronta'` → conteúdo. Há ajudantes: `PorLeitura` (`KpisComando`), `combinarLeituras`/`mensagemFalha` (`derivar-cards.ts`), `estadoCombinado` (`derivar-execucao.ts`), `situacaoDasLeituras` (`supervisao-v2.ts`). Filtre por `empresa` (`'GRUPO'` = todas) e mostre `AvisoAmostra` quando `dados.amostra`.
4. **Cálculos**: ponha em função pura (`derivar-*.ts` existente ou novo arquivo em `integrations/comando-v2/`), sem `new Date()` (use `dados.agora`), com teste ao lado.
5. **Fonte de dado nova** (só se as 5 não bastam): acrescente a chave em `DadosComando.estado` (`tipos.ts`), em `dadosVazios`, em `useDadosComando.ts` (nova chamada `fonte(...)` + `Cortes`), no repositório (`repository.ts`) e em `NOMES_DAS_LEITURAS` (`ComandoV2Page.tsx:81`); atualize `fixtures`/`dados-de-teste`. Qualquer coluna nova precisa existir nas migrations (cite-a).
6. **Atalho no menu (opcional)**: item `{ to: '/comando?aba=minha-aba', label }` em `src/lib/navegacao.ts` (grupo "Central" ou "Operação da Helena"); `Layout.destinoAtivo` já distingue pela aba. Para manter um endereço antigo, acrescente o nome ao array de `App.tsx:171`.
7. **Testes**: `MinhaAba.test.tsx` (padrão de `CardsAba.test.tsx`: renderize com `dadosDeTeste()`/fixtures e verifique estados carregando/erro/vazio/amostra e a empresa). `ComandoV2Page.test.tsx` já deriva as abas visíveis de `ABAS`; não precisa mudar.
8. **Verifique** (seção 12) e confira em tela estreita (390 px): sem rolagem horizontal, alvos ≥ 44 px.

### Receita 2 — Adicionar uma rota

1. **Página**: `src/pages/MinhaPage.tsx` com `export default`. Defesa em profundidade: se for reservada, trate `!isFounder` dentro da página (padrão `EquipeV2Page`) além da rota.
2. **Registro em `src/App.tsx`**: `const MinhaPage = lazy(() => import("@/pages/MinhaPage"));` no topo (`:9-26`) e `<Route path="/minha" element={<MinhaPage />} />` no bloco certo:
   - para qualquer pessoa autorizada: junto de `/cards` (`:163`);
   - só fundador: dentro de `<Route element={<SomenteFundador />}>` (`:165`);
   - fundador que precisa de empresa/portfólio resolvido: dentro de `<Route element={<AreaNegocios />}>` (`:173`).
   Nunca coloque rota nova fora da rota-pai `Protegida` (`:154-160`); só `/login` e `/entrar` são públicos.
3. **Alias/redirecionamento**: entrada no mapa de `App.tsx:184` (usa `Redirecionar`, preserva a busca) ou em `:185` (aba da Sala de comando).
4. **Menu**: fundador → item em `paginas` (`src/lib/navegacao.ts:4`); módulo de catálogo → `MODULOS` (`src/lib/modulos.ts`). Se a rota escolhe empresa, acrescente o prefixo ao regex de `Layout.tsx:48` para mostrar o seletor.
5. **Testes**: em `App.rotas-protegidas.test.tsx` inclua a rota na lista de rotas barradas para membro (`it.each([... '/comando','/financeiro' ...])`, final do arquivo); `Layout.test.tsx` se mexeu no menu; teste da página. Botões do fundador: `min-h-11`.
6. **Atualize** a tabela da seção 4 deste arquivo.

### Receita 3 — Adicionar uma leitura nova de RPC (mundo A, schema `helena_v2`)

1. **Confirme que a RPC existe** (nome, parâmetros `p_*`, tipo de retorno e `grant execute` para `authenticated`) em `supabase/migrations-v2/` (`grep -n "function helena_v2.<nome>"`). Se não existir, **pare**: criar função/migration exige autorização do fundador. Se existir só no repositório e não no banco real, trate a ausência (`PGRST202`/`42883`) como "ainda não disponível" (padrão `ErroEntradaPedidos`).
2. **Repositório** do módulo certo (`src/integrations/<modulo>/repository.ts`): declare o tipo de retorno, acrescente o método na interface `RepositorioXxxV2` e a implementação em `criarRepositorioXxxV2`, sempre via `cliente.schema('helena_v2').rpc('nome', { p_param: valor })`. Valide a resposta (`objeto`, `Array.isArray`, regex de UUID/data) e **lance erro** em formato inesperado: `null` nunca vira lista vazia. Traduza o erro por código, sem repassar a mensagem do banco. `runtime.ts` não muda.
3. **Teste do repositório**: copie o padrão de `config-v2/repository.test.ts` — cliente falso que grava `[schema, nome, args]` e `expect` exato; cubra resposta válida, `null`, estrutura errada, erro por código e rejeição de rede. Quando houver migration, compare a assinatura com o SQL como o teste da 0019.
4. **Consumo na tela**: `useEffect` com flag `ativo`/`vivo` (ou contador de geração), estado `'carregando'|'pronta'|'erro'`, botão de repetir só a fonte que falhou, prop `repositorio?` para teste e `key` por `user.id` quando a leitura é do fundador. Na Sala de comando, vá pela receita 1 passo 5.
5. **Teste da página** com repositório falso (resposta, erro, troca de conta descartando resposta antiga).
6. **Documente** aqui (seção 6) o nome exato da RPC e a migration.

### Receita 4 — Adicionar/alterar um módulo genérico (`/modulo/:tabela`)

1. `src/lib/modulos.ts`: nova entrada em `MODULOS` (`tabela`, `titulo`, `grupo`, `escopo`, `rota?`). Sem `rota`, o destino é `/modulo/<tabela>` e o menu o inclui sozinho.
2. `src/lib/modulo-contratos.ts`: contrato `{id, business?, columns, search?, edit?, create?}` com colunas **existentes** no banco (confirme antes; contratos são históricos).
3. Escrita: tabela em `TABELAS_PROTEGIDAS` (`escrita-protegida.ts:5`) e `edit` no contrato; criação: `create:true`, `business` definido e prefixo em `PREFIXOS_CRIACAO` (`Modulo.tsx:18`).
4. Testes: `App.restauracao.test.tsx` exige rota para todas as entradas do catálogo e o `Modulo.test.tsx` cobre leitura/escrita; acrescente o caso.

### Receita 5 — Novo estado ou rótulo de card/etapa

Os rótulos estão duplicados (armadilha 2). Para um estado novo vindo da máquina (`helena-v2/maquina/passagens.yaml`): `cards-v2/rotulos.ts` (`ROTULOS_ESTADO_CARD`), `comando-v2/derivar-cards.ts` (`ROTULOS_CARD`/`ROTULOS_ETAPA`/`ROTULOS_MOTIVO`/`varianteEstado`), `comando-v2/derivar-visao-geral.ts` (`ROTULO_ESTADO`, `COR_ESTADO`, `COLUNAS_PROCESSO`, `MOTIVOS`), `comando-v2/supervisao-v2.ts` (`MOTIVOS`), `components/cards-v2/KanbanV2.tsx` (colunas) e `PainelV2Page.tsx` (`ESTADOS_FUNDADOR`, `ESTADOS_EM_CURSO`). Estado desconhecido nunca é escondido (aparece como "Estado não reconhecido"/texto legível), então esquecer um lugar gera divergência visível, não erro.

---

## 12. Comandos de verificação

Rode na raiz do repositório (ou do worktree) com `node_modules` instalado (`npm ci`). Não exigem banco nem rede além do `npm`.

```bash
npx vitest run --pool=threads                 # = npm test ; todos os testes (≈ 60 s; 73 arquivos / 624 testes no commit lido)
npx vitest run src/pages/ComandoV2Page.test.tsx   # um arquivo
npx vitest run -t "nome parcial do teste"     # por nome
npx tsc --noEmit -p tsconfig.app.json         # tipos (o `tsconfig.json` da raiz só referencia; use -p)
npx eslint .                                  # = npm run lint ; baseline: 0 erros, 22 avisos (react-hooks/exhaustive-deps)
npm run build                                 # = vite build ; gera dist/ (ignorado pelo git)
npm run dev                                   # vite em 0.0.0.0:8080
```

A integração contínua (`.github/workflows/helena-v2.yml`, job "App") executa, nesta ordem: `npm ci`, `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. **Não roda `eslint`** (rode você). Sempre rode os quatro antes de commitar mudança em `src/`. Em ambiente novo sem `node_modules`, instale antes; `vitest`/`tsc` falham sem isso.

---

## 13. Armadilhas conhecidas (verificadas no código)

1. **Três definições de "entrega aprovada" (DIVERGENTE).** (a) `cards-v2/repository.ts:101-115` e `supervisao-v2.ts:277` (Empresas, Cobertura): `portao1='PASSOU'` **e** etapa `APROVADA/PRONTA` com `portao1_ok` e `entrega_fresca` **e** mesma versão; devolve `null` se etapas ou entregas não estão prontas. (b) `derivar-execucao.ts:274` (galeria Entregas, Consumo): só `portao1==='PASSOU'`. (c) `derivar-visao-geral.ts` (Visão geral): "entrega aprovada = portao1 PASSOU" (cabeçalho do arquivo). Os totais podem diferir entre abas. **Atualização de 17/10/2026 (fim do dia):** (a) passou a valer também em `derivar-execucao` (galeria Entregas, Consumo, entregas por semana) e na linha do tempo; só "Entregas por empresa" e o painel lateral do card seguem com a definição larga, rotulada "passaram no primeiro portão". Confira no código antes de afirmar.
2. **Rótulos e motivos duplicados** em `cards-v2/rotulos.ts`, `derivar-cards.ts`, `derivar-visao-geral.ts`, `supervisao-v2.ts` e `PainelV2Page.tsx` (receita 5). Funções homônimas com semânticas distintas (`cardsDaEmpresa`, `nomeEmpresa`, `entregasAprovadas`, `rotuloMotivo`) existem em mais de um arquivo — confira o import.
3. **Cópias deliberadas:** `linhasDaEntrega` em `CardV2Page.tsx:46` e `integrations/comando-v2/linhas-da-entrega.ts:10` (o comentário do segundo pede para mudar os dois).
4. **Código sem uso/órfão:** `OperacaoV2Page` (sem rota), `lib/tarefa-calendario.ts`, `EXIGIR_AUTENTICACAO`, `isAdmin`, `incluirEmpresa/tirarEmpresa/TABELAS_COM_BUSINESS_ID/EMPRESAS_BASE`, `lib/modulos.ts` (`GRUPOS`, `obterEscopoModulo`, `SEM_EXCLUSAO`, `COLUNAS_SISTEMA`). Não remova sem antes `grep` e rodar a suíte; não "reative" achando que está ligado.
5. **Membro em rotas "logado":** `/configuracoes` abre e mostra "Acesso restrito" (não redireciona; teste exige). `/` mostra área reservada. `/cards` carrega, mas o RLS do banco só entrega `card/etapa/entrega` ao fundador (inferido; NÃO CONFIRMADO no banco real).
6. **Rotas estáticas vencem `/modulo/:tabela`:** `/modulo/integracoes|financeiro|crm|equipe` redirecionam (`App.tsx:184`); `Modulo` nunca as abre.
7. **Escrita:** `escreverRegistro` exige a `row_version` **da leitura que originou a edição**; conflito é `PT409`/`40001` e a mensagem preserva o rascunho — não rebusque versão para "repetir". Mas `insert` direto (Modulo, CRM, financeiro, orçamento, tarefas) **não passa** por essa porta.
8. **CSS acoplado a `aria-label`/`role`:** `helena.css:47-63` seleciona `[aria-label='Publicação']`, `[role='tablist']`, `textarea[aria-label='JSON do documento']`. A regra `[aria-label='Lista de cards']` dentro de `.he-v2-card-page` hoje não casa nada (esse rótulo só existe em `ListaCards.tsx`, na Sala de comando) — provável resto legado, sem efeito (visual NÃO CONFIRMADO).
9. **Teste de alvo de toque:** `V2.alvo-de-toque.test.tsx` falha se um botão/link do fundador em `/cards` ou `/configuracoes` não declarar `min-h-11`/`h-11`/`size-11…` (variantes `sm:`/`md:` não contam).
10. **Limites de leitura:** Sala de comando lê no máximo 500 cards, 3000 etapas, 1500 entregas e 50 pedidos; ao bater, `amostra=true` e a tela avisa. `PainelV2Page` corta em 200 cards. `lerPaginas` pagina de 1000 em 1000.
11. **Atualização automática de 30 s** na Sala de comando refaz as 5 leituras (`ComandoV2Page.tsx:28`); aba nova cara multiplica carga. Pausa com a aba do navegador oculta.
12. **`key` de remontagem:** `SomenteFundador`, `AreaNegocios`, `SessionBusinessBoundary` e várias páginas usam `key` para descartar estado ao trocar conta/empresa. Remover a `key` vaza dados de outra identidade.
13. **Datas/fuso:** exibição em `America/Sao_Paulo`; funções `derivar-*` recebem `agora` por parâmetro. `new Date()` direto em função pura quebra os testes (que fixam `2026-10-17T15:00:00Z`).
14. **Dinheiro:** centavos inteiros; `valor_brl` ausente com moeda ≠ BRL deixa o lançamento fora do caixa/DRE (`incompleto`). CSV usa `csvCell` contra injeção de fórmula.
15. **Chave publicável embutida:** `src/lib/supabase.ts:3-10` tem URL e chave publicável padrão; é intencional, mas nunca a substitua por chave secreta nem registre valores em docs/commits.
16. **`MODO_TESTE_SEM_SENHA`:** só em `DEV`; mantenha `VITE_MODO_TESTE_SEM_SENHA`, `VITE_TESTE_EMAIL`, `VITE_TESTE_SENHA` vazias fora da máquina de desenvolvimento.
17. **`eslint`:** `@typescript-eslint/no-unused-vars` está desligado; 22 avisos de `exhaustive-deps` são baseline (não os "conserte" misturando com outra mudança). `tsconfig.app.json` é `strict`, mas com `noImplicitAny:false`; só `src/` é checado.
18. **Documentos desatualizados:** `docs/manual/restauracao-funcionalidades.md` ainda descreve `/comando` como "governança v2, sem equivalência das 10 abas" — hoje `/comando` é a Sala de comando de 12 abas e a governança está em `/sistema` (DIVERGENTE; este catálogo vale mais, o código vale mais que ambos).
19. **Rótulo "pronto" ≠ publicado.** `PRONTO`, `CARD_CRIADO`, `PUBLICADA` e entrega externa são fatos diferentes; "No ar" só aparece em `PUBLICADA`.
20. **Marca:** use **eLiving™** em textos; `siglaDe()` (`BusinessContext.tsx:72`) abrevia como "eLiving" sem ™ na sigla do menu — não generalize para título de documento.

---

## 14. NÃO CONFIRMADO / lacunas desta leitura

- Deploy/hospedagem do site (Lovable ou outro) e se o build publicado equivale a este commit.
- Que o schema `helena_v2` está exposto na API do Supabase real e que as migrations 0001–0026 estão aplicadas lá (o repositório diz que não consultou o banco real; `AGENTS.md` manda consultar `public.checkpoint_mestre_atual` agora).
- Definição e existência da view `public.checkpoint_mestre_atual` e da tabela `public.decisoes` no banco real (não estão nas migrations do repositório).
- RLS/grants de `insert` direto em `portfolio`, `financeiro`, `orcamento`, `crm`, `tarefas` e dos 8 módulos criáveis; se `helena_write_record` aceita hoje todas as 54 tabelas de `TABELAS_PROTEGIDAS` (5 delas — `configuracao`, `dre_mensal`, `entidades`, `fluxo_caixa`, `guia_operacao` — não têm contrato em `modulo-contratos.ts`, logo a escrita por `escreverRegistro` é recusada por "chave primária não configurada").
- Colunas reais das tabelas `public.*` (os contratos são históricos).
- Existência e RLS do bucket `helena-brand-assets`; OAuth Server do Supabase habilitado.
- Alternância de tema claro/escuro (nenhum código a aciona).
- Comportamento visual em navegador real (esta leitura não abriu o site; só código e testes sintéticos).
- Outros catálogos para IA programadora (backend/motor/banco/deploy): este arquivo cobre **apenas** `src/`. Para motor, banco e VPS veja `docs/manual/como-mudar.md`, `supabase/migrations-v2/README.md`, `motor/` e `docs/manual/retomada-hermes-vps.md`.
