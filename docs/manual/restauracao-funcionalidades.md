# Restauração verificável das páginas e subpáginas

Inventário de código em 17/10/2026. Fonte histórica: [`App.tsx`](../arquivo/app-v1/src/App.tsx), [`Layout.tsx`](../arquivo/app-v1/src/components/Layout.tsx) e [`modulos.ts`](../arquivo/app-v1/src/lib/modulos.ts) arquivados. Destino: `src/` ativo. **Implementado** significa código e rota ligados no checkout, sujeito a sessão, `app_access`, RLS, esquema e serviço disponíveis. **Leitura** indica ausência de escrita nessa tela. **Indisponível** indica que a rota ou função antiga não foi conectada. **Não implantado/confirmado** vale para todas as linhas: este inventário não prova publicação do site, Edge, Gateway, VPS, OAuth Server, dados reais ou permissões no Supabase.

O arquivo v1 declara **35 padrões de `Route path`**: 31 fixos não condicionais, 2 condicionais (`/cards-v2`, `/configuracoes-v2`), 1 parametrizado (`/modulo/:tabela`) e 1 fallback (`*`). A lista abaixo cobre todos. O catálogo histórico tem **56 entradas únicas em 9 grupos**; entradas catalogadas não provam tabelas ou registros no banco atual.

| Rotas arquivadas | Função v1 | Estado no código ativo |
|---|---|---|
| `/login`, `/entrar` | Login por senha, alias. | **Implementado**: Auth Supabase e alias; exige `app_access.active`. |
| `/oauth/consent` | Detalhes e decisão OAuth via `supabase.auth.oauth`. | **Implementado no código e na rota protegida**: exige fundador e contexto da autorização atual; depende de OAuth Server/cliente configurados. Não há prova de servidor ou cliente ativo. |
| `/`, `/comando` | Sala de comando e visão geral. | **Parcial**: `/` é painel v2; `/comando` é governança v2, sem equivalência das 10 abas antigas. |
| `/indicadores` | Indicadores de CRM/financeiro/risco/portfólio. | **Parcial, leitura**: tela de métricas reintroduzida com escopo de empresa e paginação; fonte e disponibilidade dependem do banco atual. |
| `/cobertura`, `/supervisao`, `/empresas`, `/consumo`, `/inbox` | Atalhos para abas de comando. | **Parcial, leitura**: projeções v2 de cards e portfólio; `consumo` informa ausência de medição real e `/inbox` redireciona para supervisão, sem equivalência da inbox v1. |
| `/execucao`, `/entregas` | Fila de tarefas/agent_jobs, evidências e material final. | **Parcial, leitura**: projeção de cards v2 e etapas revisadas. Jobs e galeria v1 não foram conectados como equivalentes. |
| `/cards-v2`, `/configuracoes-v2` | Rotas v2 condicionais por flag na v1. | **Implementado**: aliases para `/cards` e `/configuracoes` na v2, preservando busca. |
| `/crm` | Pipeline, Kanban/tabela e oportunidades. | **Parcial**: tela adaptada com leitura e formulário local; escrita depende da política de autorização e RLS atuais. Não comprova contato externo. |
| `/financeiro` | 8 abas de cockpit, lançamentos, caixa, DRE e orçamento. | **Parcial**: tela adaptada lê fontes financeiras; escrita sujeita a fundador, RPC e RLS. Cálculos não comprovam saldo real. |
| `/calendario` | Visão unificada de calendário e tarefas. | **Parcial**: tela adaptada; não transforma tarefas históricas em cards v2. |
| `/portfolio`, `/identidade` | Empresas e identidade de marca. | **Parcial**: leitura de `portfolio`; edição da identidade só com fundador e escrita protegida; preview/upload usa Supabase Storage no bucket privado histórico `helena-brand-assets`; existência e RLS atuais precisam de validação. |
| `/equipe` | Catálogo de agentes e conexões. | **Parcial, leitura**: projeção de configuração v2. Status configurado não comprova executor operacional. |
| `/conversa`, `/chat` | Conversa/alias e mídia v1. | **Parcial**: entrada v2 documenta limites; voz, memória automática e chat Gateway não foram reativados. |
| `/sistema` | Saúde/conexões. | **Parcial, leitura**: governança/configuração v2; não há prova de saúde das conexões v1. |
| `/integracoes` | WhatsApp, VoIP, voz, roteamento e eventos. | **Parcial, leitura**: visão v2 e Telegram existente; comandos Evolution/Meowcaller/Laya/Kokoro v1 indisponíveis. |
| `/central-execucao`, `/central-integracoes`, `/caixa-entrada`, `/helena` | Aliases históricos. | **Implementado** como redirecionamentos internos; sem serviço extra. |
| `/modulo/integracoes`, `/modulo/financeiro`, `/modulo/crm`, `/modulo/equipe` | Aliases para páginas próprias. | **Implementado** como redirecionamentos internos. |
| `/modulo/:tabela` | Consulta e CRUD genérico por catálogo. | **Parcial**: 56 entradas de catálogo, **55 contratos explícitos de leitura** com seleção de colunas. `configuracao` permanece sem contrato e mostra consulta indisponível. Escrita depende de lista de campos e RPC, sem exclusão por padrão. |
| `*` | Fallback para `/`. | **Alterado**: a v2 mostra página não encontrada protegida, com link para a raiz. |

As **10 abas** de [`ComandoPage.tsx`](../arquivo/app-v1/src/pages/ComandoPage.tsx) eram: Visão geral, Supervisão, Empresas, Tarefas, Agentes, Acompanhamento (Execuções/Decisões), Consumo, Processo, Cobertura e Plano de evolução. A v2 recupera partes como leituras separadas, mas não recria a fila `agent_jobs` nem o plano local de evolução como operação. As **8 abas** de [`FinanceiroPage.tsx`](../arquivo/app-v1/src/pages/FinanceiroPage.tsx) eram Visão Geral, Lançamentos, Fluxo de Caixa, DRE, Orçamento, Recorrências, Plano de Contas e Contas Bancárias. As **6 abas** de [`IntegracoesPage.tsx`](../arquivo/app-v1/src/pages/IntegracoesPage.tsx) eram Visão Geral, WhatsApp Mensagens, Ligações VoIP, Vozes Neurais, Roteamento e Eventos & Testes. A tela atual de integrações é uma visão de estado; conectividade e operação desses serviços continuam **não confirmadas**.

O catálogo de 56 entradas, agrupado exatamente como no arquivo, permite localizar omissões:

| Grupo (quantidade) | Entradas históricas |
|---|---|
| Comando (6) | `portfolio`, `foco_executivo`, `estado_mestre`, `decisoes`, `ideias`, `metas_kpis` |
| Receita (5) | `crm`, `marketing`, `clientes`, `atendimento`, `comunicacoes` |
| Execução (5) | `projetos`, `marcos`, `tarefas`, `calendario`, `produto` |
| Finanças (5) | `financeiro`, `contas_financeiras`, `orcamento`, `recorrencias`, `plano_contas` |
| Operação (5) | `processos`, `obrigacoes`, `fornecedores`, `ativos`, `documentos` |
| Risco & Governança (6) | `riscos`, `governanca`, `incidentes`, `contratos`, `consentimentos`, `societario` |
| Equipe (6) | `equipe`, `agentes`, `handoffs`, `memoria_mestre`, `pessoas`, `fundador` |
| Sistema (11) | `integracoes`, `automacoes`, `agent_jobs`, `task_activity`, `agent_connections`, `notification_outbox`, `auditoria`, `auditoria_sistema`, `acessos`, `backups`, `configuracao` |
| Referência (7) | `helena_guia`, `helena_campos`, `dicionario_dados`, `regras_formula`, `listas_dominio`, `sistema_vivo`, `protocolo_agentes` |

Dos 56 módulos, **55 têm contrato explícito de leitura** no checkout. `configuracao` é a única entrada **sem contrato**: a projeção segura de `public.configuracao` ainda não foi homologada e seu campo `valor` pode conter dados sensíveis. Essa tabela é distinta de `helena_v2.configuracao`; não há divergência de esquema comprovada entre elas. Contrato significa apenas consulta projetada de colunas historicamente encontradas em [`schema.json`](../arquivo/app-v1/src/lib/schema.json); não prova que a tabela, as colunas ou a política RLS existam iguais no Supabase atual. Campos de corpo livre da memória e referências de credenciais foram excluídos das projeções. Nem todo contrato permite edição. O formulário de criação existe em oito módulos de negócio, com escopo empresarial e fundador, mas o valor padrão da chave primária, requisitos do banco e RLS atuais não foram confirmados; portanto a gravação real permanece **não comprovada**.

O OAuth da v1 tinha interface, não evidência de provedor operacional. O componente atual usa `getAuthorizationDetails`, `approveAuthorization` e `denyAuthorization` da SDK oficial, só exibe cliente e scopes devolvidos para o `authorization_id` da sessão, bloqueia resposta de sessão/solicitação anterior e aceita redirect de resposta apenas por HTTPS. A rota requer `app_access` de fundador; não há recurso de revogação nesta interface. Para provar operação, verificar servidor OAuth habilitado, cliente registrado, redirect autorizado e fluxo real com a sessão correta. Nenhuma dessas condições foi verificada por esta restauração local.

## Integração e teste local

`App.tsx` mantém os aliases e bloqueia as áreas de negócio para membros sem papel de fundador. O filtro de empresa vale para módulos de negócio; cards têm empresa própria e não adotam esse filtro global. O catálogo é percorrido por testes de integração de navegação, com banco simulado. Campos de edição conservam a versão lida e não repetem conflitos automaticamente. Criação em oito módulos usa identificador explícito por tipo e UUID, sem depender de PK automática; restrições e RLS reais ainda precisam de homologação. Remoção de empresa está bloqueada até conferir vínculos; nenhum dado foi apagado.

Código recuperado localmente não atualiza o navegador de outro computador: é preciso atualizar o checkout utilizado ou publicar a versão no site. O servidor desta tarefa pertence ao ambiente cloud; seu endereço de loopback não é um link público.

Validação da recuperação: suíte completa do frontend com **365 testes em 41 arquivos**, TypeScript com `tsconfig.app.json`, build de produção e ESLint (zero erros; 22 avisos). Os testes da orientação do motor passaram em **11 casos**. Navegador Chromium com Supabase simulado percorreu 20 rotas e as oito abas do Financeiro em desktop e celular, sem erros de JavaScript nem consultas a colunas ausentes no esquema histórico conferido. São testes locais: não autenticam o fundador no site publicado, não demonstram integridade atual das tabelas nem comprovam a integração do Telegram/VPS.
