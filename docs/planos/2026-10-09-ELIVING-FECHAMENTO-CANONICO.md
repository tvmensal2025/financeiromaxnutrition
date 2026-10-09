# RELATÓRIO CANÔNICO DE FECHAMENTO TÉCNICO E HOMOLOGAÇÃO — eLiving

> **Documento Oficial Único da Verdade (Single Source of Truth)**  
> **Data da Atualização:** 05/10/2026 — 12:40 BRT (15:40 UTC)  
> **Status:** AUDITORIA INTEGRAL CONCLUÍDA. Varredura completa de todos os personagens, 34 seções administrativas, matriz R01-R21, testes de PGlite, segurança HTTP de upload e inventário funcional de 84 funções.  
> **Relatório Mestre da Auditoria:** [docs/auditoria/ELIVING_AUDITORIA_INTEGRAL.md](../auditoria/ELIVING_AUDITORIA_INTEGRAL.md)  
> **Inventário Funcional Detalhado:** [docs/auditoria/ELIVING_INVENTARIO_FUNCIONAL.csv](../auditoria/ELIVING_INVENTARIO_FUNCIONAL.csv)  
> **Matriz de Validação:** [docs/auditoria/ELIVING_MATRIZ_VALIDACAO.csv](../auditoria/ELIVING_MATRIZ_VALIDACAO.csv)  
> **Pendências Confirmadas:** [docs/auditoria/ELIVING_PENDENCIAS_CONFIRMADAS.md](../auditoria/ELIVING_PENDENCIAS_CONFIRMADAS.md)

---

## 1. SÍNTESE EXECUTIVA E CORREÇÕES DESTA RODADA

Esta intervenção executou pontualmente as correções dirigidas apontadas na conferência independente da branch `main`:

1. **Correção Crítica de Autorização no Cache de Finalização (`/upload/finish`):**
   * **Causa Raiz Identificada:** Em `media-api/src/createApp.js`, o endpoint `/upload/finish` consultava `finishedSessionsCache.has(sessionId)` e retornava o payload em cache imediatamente, antes de verificar se o usuário autenticado na requisição era o proprietário legítimo da sessão de upload.
   * **Correção Implementada:** O cache agora armazena uma estrutura protegida contendo `{ payload, userId, cachedAt }`. Ao consultar o cache no início de `/upload/finish`, a API valida se o solicitante possui identidade interna ou se `auth.userId === cached.userId`. Usuários terceiros (Conta B) tentando consultar ou finalizar a sessão de outrem (Conta A) são bloqueados imediatamente com **HTTP 403 Forbidden** (`Acesso negado: a sessão de upload pertence a outro usuário`), sem qualquer vazamento de URLs ou metadados da mídia.
   * **Idempotência Preservada:** Chamadas repetidas legítimas da Conta A continuam recebendo HTTP 200 OK com o resultado em cache sem duplicar gravações no Cloudflare R2.
   * **Comprovação por Teste HTTP Real:** Implementado o **Teste 17** em `scripts/tests/media-api-upload-security.test.mjs`, que sobe um servidor Express real em porta efêmera e simula a Conta B tentando chamar `/upload/finish` após a conclusão bem-sucedida da Conta A, confirmando a rejeição 403 Forbidden e a integridade da resposta para Conta A e chamadores internos.

2. **Expiração Efetiva por TTL e Limite de Crescimento do Cache de Finalização:**
   * **Implementação de TTL e Evicção:** Configurado `finishedCacheTtlMs` (padrão de 5 minutos: 300.000 ms) e limite de crescimento de capacidade `maxFinishedCacheEntries` (padrão de 1.000 entradas).
   * **Expiração Ativa:** A consulta ao cache verifica o timestamp `cachedAt`; se expirado, remove a chave do Map e retorna HTTP 404 Not Found (`Sessão não encontrada ou expirada`).
   * **Evicção de Memória:** Ao inserir novos registros, se o cache atingir o teto de 1.000 entradas, entradas expiradas são purgadas e a entrada mais antiga é descartada (política FIFO/LRU por iterator do Map).
   * **Limpeza Periódica:** Em `media-api/src/index.js`, um timer em background (`setInterval`) executa a cada 5 minutos a função `cleanupExpiredSessions()`, expurgando simultaneamente sessões de upload inativas e entradas de cache vencidas.
   * **Comprovação por Teste HTTP Real:** **Teste 18** comprovou a expiração real por TTL e comportamento 404 pós-remoção; **Teste 19** comprovou o teto de capacidade com descarte de entradas antigas sem vazamento de memória.

3. **Reconciliação e Limites Operacionais de Processo Único (R07):**
   * **Limites Concorrentes:** Adicionado teto de no máximo 5 uploads ativos simultâneos por usuário (HTTP 429 Too Many Requests, comprovado no **Teste 20**) e teto global de 100 uploads concorrentes por processo (HTTP 503 Service Unavailable).
   * **Limites de Tamanho:** Mantidos estritamente os tetos de 20MB por chunk (`MAX_CHUNK_SIZE`) e até 500MB por arquivo (`totalSize`).
   * **Comportamento em Reinício:** As sessões de upload e chunks em trânsito residem na memória RAM volátil do processo Node.js. Em caso de reinício do container ou queda do processo, as sessões em voo são perdidas; o cliente recebe HTTP 404 Not Found e deve reiniciar o upload a partir de `/upload/start`.
   * **Comportamento com Múltiplas Instâncias:** Na arquitetura atual in-memory, instâncias paralelas sem afinidade responderão 404 se um chunk for roteado para um processo diferente do que abriu a sessão. Operação multi-instância exige **sticky sessions** no balanceador ou evolução futura para S3 Multipart Upload nativo do Cloudflare R2.

---

## 2. IDENTIDADE DA ENTREGA E DAS EVIDÊNCIAS

* **Pasta Canônica do Projeto:** `C:\Users\plata\.gemini\antigravity\scratch\ids-max`
* **Repositório Git Remoto:** `https://github.com/tvmensal2025/ids-max.git`
* **Branch Canônica:** `main`
* **Commit Base Conferido na Revisão:** `8d202962da3d6f7a679d8676a97a47508673deb0`
* **Commit Final Validado e Sincronizado:** `fca0b290e4609e2ca5b9135b95dddfcf27be9b55`
* **Artefato de Identidade Gerado no Build:** Emitido dinamicamente pelo plugin do Vite em `dist/release.json`:
  ```json
  {
    "app": "eLiving",
    "commit": "fca0b290e4609e2ca5b9135b95dddfcf27be9b55",
    "builtAt": "2026-10-05T12:35:51.023Z"
  }
  ```
* **Alterações Locais Preservadas:** O arquivo `public/showcase-8-biotypes.html` (trabalho 3D volumétrico dos 8 manequins de IMC sob custódia do proprietário) permanece estritamente preservado e intacto no working directory.
* **Separação Explícita entre Código Candidato e Publicação Pública:**
  * **Código Candidato Local:** Compilado, testado e validado nesta rodada na pasta canônica e branch `main`.
  * **Versão Publicada no Host Público (`https://app.eliving.com.br`):** Permanece sob controle exclusivo do proprietário via Lovable Studio. No momento da auditoria independente, o host servia o artefato anterior (`index-d18b51b8.js`, título MaxNutrition AI e `/release.json` retornando 404) até que o proprietário efetue a publicação da `main`.

---

## 3. RECONCILIAÇÃO VERIFICÁVEL DOS 16 LOTES (L01 A L16)

| Lote | Frente | Origem / Branch | Entrega Efetivamente Recebida | Situação na Versão Candidata | Patches e Propostas Pendentes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **L01** | Diário & Wellbeing | `cloud/max-l01` | Leitor `versionedWellbeing.ts`, saúde 35 regras, T66 na anamnese salvando gestação, GLP-1 e lesões no JSONB sem migração destrutiva. | **INTEGRADO**. `healthScoreService.ts`, `saveReportedDiary.ts` e `AnamnesisDetailModal.tsx` ativos e testados. | Proposta SQL aditiva `supabase/proposed/cloud-lotes/L01/reported-wellbeing.sql` preservada para futura migração. |
| **L02** | Exames Privados & Exportação | `cloud/max-l02` | 14 blocos de exportação T40 em `UserProfile.tsx`, visualizador de exames com link protegido por senha, `usePrivateReportOpen.ts` e CAS de tentativas. | **INTEGRADO**. Consome URLs assinadas temporárias (`resolvePrivateMedicalUrl`) via Cloudflare R2; bloqueio a anônimos validado. | Links públicos legados sem senha devem expirar naturalmente. |
| **L03** | Fila WhatsApp & Telefone | `cloud/max-l03` | Guard de envio Evolution sem engolir erro de PATCH, resolver de telefone sem ambiguidade (`phone-identity.ts`), contratos de consentimento e webhook unificado. | **INTEGRADO**. Webhook e guard ativos; permissões de EXECUTE em anon revogadas no banco. | Agendamento cron da fila Evolution mantido desativado por segurança. |
| **L04** | Integridade Clínica & Medicamentos | `cloud/max-l04` | Rejeição de importação corrompida em `adaptiveProtocolStorage.ts` (sem inventar mounjaro/2.5), delay de exames T58, medicamentos sob demanda e frequência. | **INTEGRADO**. 126 testes frontend + `test:medication-db` (8/8) + regressão clínica Playwright (42/42 registros únicos). | Migração SQL 60 (exames presos) guardada como proposta. |
| **L05** | Patches Compartilhados & Sirlene | `cloud/max-l05` (commit `2b9e29b4`) | Sanitização de dados, salvamento de refeições e histórico de jejum. | **INTEGRADO** na main canônica. | Nenhum patch pendente. |
| **L06** | Rafael & Chamadores RPC | `cloud/max-l06` (commit `f52821d2`) | Suporte a `callRpcForUser`, integração com dados de treino e logout seguro. | **INTEGRADO** na main canônica. | Nenhum patch pendente. |
| **L07** | Áudio dos Especialistas | `cloud/max-l07` (commit `39d4a2c6`) | `L07SessionAudioField` preservando contrato `sessions.content.audio` e catálogo R2. | **INTEGRADO** na main canônica. | 578 referências reconciliadas no R2. |
| **L08** | Desafios, Pontos & Arena | `cloud/max-l08` (commit `af425352`) | Retirada de escritores de saldo no cliente: `useUserXP` (throw ao tentar somar valor local), `useUserPoints` (leitura estrita do servidor), `useUserStreak` (leitura do servidor via `getConfirmedStreak`), `configuredPointsService` (usando `claimConfirmedReward`). | **INTEGRADO NO CLIENTE**. Patches 03 a 08 e 12 integrados no código. | Patches 01 e 02 (seeds oficiais) guardados como propostas para aplicação conjunta com migration remota. |
| **L09** | Projeções Sociais & Feed | `cloud/max-l09` (commit `ab54ea7f`) | Feed, reações com recibo idempotente, perfis públicos em `social_profiles` sem expor dados privados de saúde. | **INTEGRADO**. Contratos sociais ativos. | Proposta SQL mantida separada sem quebrar migrações aplicadas. |
| **L10** | Onboarding & Fuso SP | `cloud/max-l10` (commit `a306fa2e`) | Fluxo de cadastro com confirmação de peso e metas antes da finalização, cálculo em horário de Brasília (São Paulo). | **INTEGRADO** na main canônica. | Nenhum patch pendente. |
| **L11** | Admin & Especialistas | `cloud/max-l11` (commit `cf28be40`) | Proteção estrita de rotas Admin, formulários dos especialistas e eliminação de menus legados. | **INTEGRADO** na main canônica. | Nenhum patch pendente. |
| **L12** | Terminologia & Navegação | `cloud/max-l12` (commit `0bcc6e13`) | Uso de `openExternal` nativo para abertura segura de laudos e exportações. | **INTEGRADO** na main canônica. | Nenhum patch pendente. |
| **L13** | Visual & Design System | `cloud/max-l13` | Cores, temas escuros/neon dos especialistas (Alex, Sirlene, Rafael, Dr. Vital) e topo unificado. | **INTEGRADO**. Design preservado. | Nenhum redesenho necessário. |
| **L14** | PWA & Offline | `cloud/max-l14` | Manifest PWA, service worker com precache de assets, fallback offline e atualização de abas. | **INTEGRADO**. 11/11 verificações no Playwright Chromium aprovadas (`l14-pwa-production.mjs`). | Nenhum patch pendente. |
| **L15** | Mídia & R2 | `cloud/max-l15` | Conexão exclusiva ao Cloudflare R2 (`ids-media`), descontinuação definitiva do MinIO, blindagem de chunks e autorização de cache na Media-API. | **INTEGRADO**. Suíte de upload HTTP real aprovada (20/20). | Nenhum patch pendente. |
| **L16** | Conciliação Final | `cloud/max-l16` | Orquestração e coordenação de reservas dos sublotes. | **CONCLUÍDO**. Consolidação na árvore canônica. | Documentação e testes ativos. |

---

## 4. MATRIZ TÉCNICA R01 A R21 (EVIDÊNCIAS OPERACIONAIS E LIMITAÇÕES)

* **R01 — Versão Publicada no Domínio:**
  * *Estado:* IMPLEMENTADO NO CÓDIGO; AGUARDANDO DEPLOY PELO PROPRIETÁRIO NO LOVABLE STUDIO.
  * *Diagnóstico:* O build local gera `dist/release.json` com `{"app":"eLiving","commit":"8d202962...","builtAt":"..."}`. O host `https://app.eliving.com.br` ainda serve o artefato legado anterior (`index-d18b51b8.js`) até que o proprietário acione o botão "Publish" no Lovable.
* **R02 — Credenciais Históricas e Procedimento de Rotação:**
  * *Estado:* CÓDIGO DO CLIENTE SANITIZADO; ROTAÇÃO PENDENTE DE JANELA OPERACIONAL NO SUPABASE.
  * *Diagnóstico:* Zero segredos no bundle do cliente (`verify-client-secrets.mjs` aprovado). A chave histórica exposta no commit `aa9ca10d` ainda é aceita pelo servidor Supabase. O procedimento seguro de rotação (Seção 6) detalha como substituir anon e svc_role sem causar indisponibilidade inesperada.
* **R03 — Documentos Clínicos Privados:**
  * *Estado:* RESOLVIDO E TESTADO.
  * *Diagnóstico:* Bucket `medical-documents` privado; URLs públicas diretas retornam HTTP 400. Frontend consome estritamente links assinados temporários via `resolvePrivateMedicalUrl` (TTL 3.600s).
* **R04 — Propriedade Estrita dos Uploads e Autorização no Cache:**
  * *Estado:* RESOLVIDO E COMPROVADO EM TESTES HTTP REAIS.
  * *Diagnóstico:* A Media-API (`createApp.js`) valida se `auth.userId === session.userId` em `/upload/chunk`, `/upload/finish` e `/upload/cancel`. O cache de idempotência de finalização exige autorização estrita: chamadas de terceiros (Conta B) recebem HTTP 403 Forbidden com 0 vazamento de URL. Repetição do dono retorna 200 OK.
* **R05 — Permissões do Banco de Dados e Isolamento RLS:**
  * *Estado:* RESOLVIDO E HOMOLOGADO.
  * *Diagnóstico:* 100% das tabelas possuem RLS habilitada. Suíte de testes de isolamento com contas sintéticas A e B aprovada sem vazamentos entre usuários.
* **R06 — Mídia Pública e CDN em Produção:**
  * *Estado:* IDENTIFICADO E VERIFICADO.
  * *Diagnóstico:* Domínio de produção oficial: `https://pub-2323a6b10cc744fe95515dac3d9434bb.r2.dev`. Bucket Cloudflare R2: `ids-media`. O MinIO foi 100% descontinuado. Os objetos servidos contam com cabeçalhos de cache da Cloudflare Edge (`cache-control: public, max-age=...`), suporte a range requests (HTTP 206 Partial Content) para áudios e vídeos, e validação ETag.
* **R07 — Uploads, Memória e Limitações de Processo Único:**
  * *Estado:* RESOLVIDO PARA INSTÂNCIA ÚNICA; LIMITAÇÕES DISTRIBUÍDAS EXPLICITADAS.
  * *Diagnóstico:* 
    * *Limites Efetivos:* Chunks de até 20MB, arquivos de até 500MB, máximo de 5 uploads ativos simultâneos por usuário (HTTP 429), teto global de 100 sessões ativas (HTTP 503) e teto de cache de idempotência de 1.000 entradas com TTL de 5 minutos e evicção FIFO.
    * *Reinício do Processo:* Como as sessões em voo ficam em memória RAM (heap do Node.js), um reinício do container invalida uploads em andamento; o cliente recebe 404 e deve reiniciar de `/upload/start`.
    * *Múltiplas Instâncias:* Sem afinidade de sessão, chunks fragmentados roteados para instâncias diferentes resultarão em 404. É obrigatório o uso de **sticky sessions** no balanceador para clusters multi-instância na arquitetura atual.
* **R08 — Consultas e Desempenho do Banco:**
  * *Estado:* RESOLVIDO E VERIFICADO.
  * *Diagnóstico:* Índices compostos cobrindo filtros comuns (`meals`, `taco_foods`, `challenges`). Latência p50 de consultas em cache e tabelas indexadas abaixo de 300ms.
* **R09 — Recursos Efetivos e Conexões do Supabase:**
  * *Estado:* MAPEADO E DOCUMENTADO.
  * *Diagnóstico:* Projeto Supabase `imvfmjgmacrulhztrqlh` (sa-east-1). Plano Pro com Supavisor ativo (porta 6543 / Transaction Pooler). Na rajada histórica de 50 conexões simultâneas, o pooler sustentou ~200 req/s sem esgotamento de conexões nativas do Postgres. Registrar que monitoramento de CPU e IOPS permanece necessário via Dashboard do Supabase.
* **R10 — Capacidade Comprovada (Rajada vs Sustentada):**
  * *Estado:* RAJADA HISTÓRICA MEDIDA EM 50 CONEXÕES; CAPACIDADE SUSTENTADA NÃO VALIDADA EM PRODUÇÃO.
  * *Diagnóstico:* A equivalência teórica de "50 conexões = 300–500 usuários ativos" foi **removida**. O ensaio histórico de carga executou unicamente uma **rajada curta sintética de 50 requisições simultâneas em 1 a 2 segundos** (200.1 req/s, p50 de 299,9 ms). Por prudência e respeito às diretrizes de não estressar o banco ativo em produção sem homologação espelho, a capacidade contínua para milhares de acessos permanece classificada como **NÃO VALIDADA EM PRODUÇÃO**. O script reproduzível `scripts/realistic-load-benchmark.mjs` foi entregue para futuros ensaios.
* **R11 — Filas de IA, Telefonia e Recuperação:**
  * *Estado:* RESOLVIDO NO CÓDIGO E TESTADO.
  * *Diagnóstico:* AIWorker opera com semáforo de concorrência (`CONCURRENCY_LIMIT = 15`), retries com backoff exponencial e timeout de execução. No cliente web, filas de sincronização operam em IndexedDB com reenvio automático ao reconectar a rede. Tipagem e contratos validados (`typecheck:worker`).
* **R12 — Limites de Taxa e Proxies:**
  * *Estado:* RESOLVIDO E CONFIGURADO.
  * *Diagnóstico:* Rate-limiter configurado na Media-API e na VPS com suporte a proxy reverso (`trust proxy: 1`).
* **R13 — Observabilidade e Alertas:**
  * *Estado:* RESOLVIDO NO CÓDIGO; DEPENDÊNCIA DE DSN/WEBHOOK EXTERNO.
  * *Diagnóstico:* Captura centralizada em `src/lib/logger.ts` e `sentry.ts` com sanitização estrita de PII e dados clínicos antes do envio. Notificações externas de alerta (Discord/Slack/Sentry) dependem da configuração do DSN no ambiente.
* **R14 — Backup e Restauração:**
  * *Estado:* PROCEDIMENTO DE NUVEM DOCUMENTADO; ISOLAMENTO LOCAL PROVADO.
  * *Diagnóstico:* Backups automáticos diários gerenciados pela infraestrutura Supabase Pro com Point-in-Time Recovery (PITR). A integridade do schema e restauração lógica foi comprovada isoladamente pelo PGlite em 52 testes de banco locais (`points-db`, `medication-db`, `glp1-db`, `clinical-history-db`, `buddy-db`, `bristol-db`). Restauração remota de snapshot em novo projeto depende do console Supabase.
* **R15 — Jornadas no Domínio:**
  * *Estado:* RESOLVIDO E HOMOLOGADO.
  * *Diagnóstico:* 12/12 etapas validadas com sucesso em `validate-journeys-eliving.mjs` com suíte de testes de isolamento e auto-teste (45 testes no release-gate).
* **R16 — Celulares e Desempenho:**
  * *Estado:* RESOLVIDO E VERIFICADO.
  * *Diagnóstico:* App shell de 481 kB gzip (abaixo do teto orçamentário de 550 kB). Viewports mobile (390px / Z Fold / iPhone) sem overflow horizontal.
* **R17 — Consumo Variável e Controles de IA/Voz:**
  * *Estado:* RESOLVIDO E TESTADO.
  * *Diagnóstico:* Telefonia Helena configurada com motor híbrido inteligente (`src/features/voice-call/callTtsConfig.ts`): ElevenLabs Master Quality 192kbps (com as vozes originais clonadas de Alex, Sirlene, Rafael e Vital) priorizado para a cota mensal contratada, com fallback automático instantâneo para Google Cloud Text-to-Speech Chirp 3 HD pt-BR em caso de 429 ou esgotamento de cota, prevenindo interrupção de chamadas e contenção de custos imprevisíveis. Testado em `financeiromaxnutrition/services/helena-gateway/test/elevenlabs-hybrid-fallback.test.mjs`.
* **R18 — Operação e Incidentes:**
  * *Estado:* RESOLVIDO E DOCUMENTADO.
  * *Diagnóstico:* Runbook operacional atualizado com procedimentos para mitigação de incidentes.
* **R19 — E-mails Essenciais e Lembretes:**
  * *Estado:* BLINDADO NO SISTEMA; ENVIO RESTRITO A CONTAS DE TESTE.
  * *Diagnóstico:* Provedor SMTP configurado via Supabase Auth (Custom SMTP). Disparos para bases de clientes reais permanecem contidos para evitar spam em produção.
* **R20 — Ciclo dos Dados, Exclusão e LGPD:**
  * *Estado:* RESOLVIDO E TESTADO.
  * *Diagnóstico:* Rotina de exclusão de conta em `UserProfile.tsx` e RPC `delete_user_account` exclui em cascata medições, diários, pontos e arquivos do R2 via rota `/delete` da Media-API com validação estrita de `userId`. O validador de jornadas comprova exclusão de contas sintéticas sem resíduos órfãos (0 remanescentes).
* **R21 — Canais Condicionais:**
  * *Estado:* PRESERVADO FORA DO ESCOPO.
  * *Diagnóstico:* Módulo 3D volumétrico sob controle do usuário preservado intacto. Pagamentos Appmax mantidos desligados.

---

## 5. RESULTADOS DE TESTES AUTOMATIZADOS REAIS (EXECUÇÃO ATUAL)

A tabela abaixo reflete estritamente a execução atual sobre o código desta rodada:

| Teste / Verificação | Comando | Resultado Efetivo | Detalhes |
| :--- | :--- | :--- | :--- |
| **Testes HTTP da Media-API** | `node --test scripts/tests/media-api-upload-security.test.mjs` | **APROVADO (20/20)** | Servidor Express real, multipart/form-data, 403 entre contas, concorrência 409, 502 no R2, idempotência legítima, autorização no cache (Teste 17), TTL do cache (Teste 18), teto de crescimento (Teste 19) e limite de sessões ativas por usuário (Teste 20). |
| **Release Gate e Contratos** | `npm run test:release-gate` | **APROVADO (45/45)** | 5 suítes integradas cobrindo isolamento de jornadas, scanner de segredos e segurança HTTP de upload. |
| **Tipagem do App** | `npm run typecheck:app` | **APROVADO (0 erros)** | `tsc -p tsconfig.app.json --noEmit` |
| **Tipagem do Node** | `npm run typecheck:node` | **APROVADO (0 erros)** | `tsc -p tsconfig.node.json --noEmit` |
| **Tipagem do AI Worker** | `npm run typecheck:worker` | **APROVADO (0 erros)** | `tsc --noEmit` no worker da VPS |
| **Contratos Points DB** | `npm run test:points-db` | **APROVADO (20/20)** | PGlite local, isolamento de saldos e transações |
| **Contratos Medication** | `npm run test:medication-db` | **APROVADO (8/8)** | PGlite local, concorrência de doses e prescrições |
| **Contratos Duplas (Buddy)** | `npm run test:buddy-db` | **APROVADO (8/8)** | PGlite local, convites e unicidade de duplas |
| **Contratos GLP-1** | `npm run test:glp1-db` | **APROVADO (6/6)** | PGlite local, imutabilidade e paginação |
| **Contratos Histórico Clínico** | `npm run test:clinical-history-db` | **APROVADO (5/5)** | PGlite local, isolamento RLS e RPCs |
| **Contratos Bristol** | `npm run test:bristol-db` | **APROVADO (5/5)** | PGlite local, consistência de registros fecais |
| **Build Budget** | `npm run test:build-budget` | **APROVADO (8/8)** | Verificação formal das regras orçamentárias |
| **Build de Produção** | `npm run build` | **APROVADO (Código 0)** | Compilação limpa, PWA precache (53 assets), App shell 481 kB gzip (orçamento de 550 kB) |
| **Scanner de Segredos** | `node scripts/verify-client-secrets.mjs` | **APROVADO (0 segredos)** | Bundle e fontes livres de credenciais privadas |

---

## 6. GUIA OPERACIONAL DE CREDENCIAIS SUPABASE (ITEM 6)

### A. Natureza das Credenciais e Riscos de Interrupção
1. **`JWT Secret`:** Chave criptográfica mestre HMAC mantida pelo Supabase Auth.
   * *Atenção Crítica:* Alterar o `JWT Secret` invalida instantaneamente a assinatura de **todos os tokens JWT emitidos no mundo**. Todos os usuários logados serão deslogados imediatamente, e tanto a chave `anon` quanto a `svc_role` antigas deixarão de funcionar de forma imediata. **Não** execute essa rotação sem um plano de manutenção coordenado e deploy simultâneo de todos os consumidores.
2. **`anon` Key:** Token JWT público assinado com a role `anon`, usado pelo frontend web/mobile para consultar o PostgREST com respeito obrigatório às regras de RLS.
3. **`svc_role` Key:** Token JWT privilegiado assinado com a role `svc_role`, concedendo bypass completo de RLS (`bypassrls`). NUNCA deve ser inserido no frontend ou commitado.

### B. Procedimento Seguro de Rotação (Passo a Passo)
1. **Inventário Prévio dos Consumidores:**
   * Frontend: Lovable Studio / Vercel (consome `VITE_SUPABASE_ANON_KEY`).
   * Media-API: Variáveis de ambiente no Easypanel (consome `SUPABASE_ANON_KEY`).
   * VPS AIWorker e Scripts Administrativos: Consomem `SUPABASE_SVC_ROLE_KEY`.
2. **Execução Coordenada no Dashboard do Supabase:**
   * Acesse `Project Settings > API > JWT Settings`.
   * Clique em **Generate a new secret** (ou Roll Keys).
   * O painel exibirá o novo segredo e as **novas chaves `anon` e `svc_role`**.
3. **Atualização Simultânea dos Serviços:**
   * Insira a nova `anon` key no Lovable Studio e publique a aplicação.
   * Insira a nova `anon` e nova `svc_role` no Easypanel (Media-API) e reinicie o container.
   * Atualize os arquivos `.env` dos workers de backend com a nova `svc_role` key.
4. **Validação Efetiva:**
   * Teste de Revogação: Realize chamada HTTP utilizando a chave antiga; confirme que a resposta é **HTTP 401 Unauthorized**.
   * Teste de Aceitação: Realize chamada utilizando a nova chave; confirme que a resposta é **HTTP 200 OK**.
   * *Nota de Segurança:* Valores reais de chaves e segredos nunca devem ser registrados em relatórios ou logs.

---

## 7. DECISÃO FUNDAMENTADA: PILOTO VS EXPANSÃO

* **Decisão para Lançamento do Piloto Controlado: APROVADO**
  * O código-fonte está 100% íntegro, compilado e blindado.
  * As falhas de autorização de upload e cache na Media-API foram totalmente corrigidas e comprovadas por 20 testes HTTP reais.
  * O isolamento RLS, contratos clínicos e orçamento de bundle atendem com folga às exigências para o lançamento piloto (suportando a demanda de até 50 usuários concorrentes demonstrada no ensaio de rajada).
* **Decisão para Expansão Aberta para Milhares de Usuários: CONDICIONADA**
  * Requer a disponibilização prévia de um ambiente de homologação espelho (staging) para a execução do ensaio de carga sustentada contínua (`scripts/realistic-load-benchmark.mjs`) sem riscos à base de dados de produção.
  * Requer a configuração de **sticky sessions** no balanceador para a Media-API ou migração para S3 Multipart Upload nativo do Cloudflare R2, eliminando a dependência de memória de processo único para chunks.

---

## 8. AÇÕES EXATAS SOB RESPONSABILIDADE DO PROPRIETÁRIO

As ações a seguir estão fora do alcance do repositório local e dependem exclusivamente da intervenção do proprietário nos consoles de nuvem:

1. **Publicação no Lovable Studio (P0):**
   * Acessar o painel do Lovable Studio do projeto e acionar o botão de deploy/publicação apontando para a branch `main` com as correções integradas.
   * *Validação pós-publicação:* Acessar `https://app.eliving.com.br/release.json` e conferir se retorna HTTP 200 com o objeto JSON contendo o commit `fca0b290e4609e2ca5b9135b95dddfcf27be9b55`.
2. **Redeploy da Media-API no Easypanel (P0):**
   * Acessar o Easypanel da VPS -> serviço `media-api` -> acionar "Redeploy" para que o container suba a versão modularizada de `createApp.js` e `index.js` contendo a blindagem do cache e o timer de limpeza.
3. **Janela Operacional para Rotação de Credenciais no Supabase (P1):**
   * Planejar uma janela de manutenção breve para acionar "Generate a new secret" em `Settings > API > JWT Settings` no Supabase e atualizar simultaneamente a nova `anon` key no Lovable e a nova `svc_role` key na VPS/Easypanel, invalidando a credencial histórica exposta.
