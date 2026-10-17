# Auditoria local da Helena v2 — 17/10/2026

## Adendo de 17/10/2026, 17:10 UTC — proposta e inbox

As migrations 0024–0026 foram aplicadas no Supabase oficial com conferência de fonte, DDL, proprietário, RLS e permissões. A leitura posterior encontrou 45 tabelas v2, 21 com RLS e zero pedidos, propostas, planos, cards, vínculos, inbox e saídas duráveis. A revisão técnica ativa foi preservada. Os ensaios transacionais reais de proposta, esclarecimento, confirmação, card, redação de código, replay e avisos terminaram em `ROLLBACK`. O ensaio Telegram usou identidade de chat sintética: não comprova pareamento ou envio real.

Às 17:12 UTC, o checkpoint `CP-20261017-V038` foi publicado com predecessor V037 e verificado por leitura posterior: 38 versões, uma ativa e 37 superadas preservadas. Somente os registros 1 e 22 do Estado Mestre foram atualizados nesta etapa, por versões esperadas; passaram para `row_version` 5070 e 5071. O snapshot registra os hashes das fontes 0024–0026 e distingue banco aplicado de transporte não implantado. A sessão operacional em memória foi encerrada depois da conferência; nenhuma credencial foi persistida.

O código em `db48808` e `2ea5286`, na branch `codex/helena-v2-kanban-triagem-20261017`, inclui proposta versionada e confirmação na interface, triagem no despachante, inbox Edge, adapter Hermes e avisos de andamento. Verificações locais finais: 253 testes frontend, TypeScript e build; 43 testes PostgreSQL de 26–32; 8 testes unitários da triagem e uma integração até `PRONTO` com provedor falso; 6 testes Edge e 5 do Hermes Telegram pinado. O navegador percorreu pedido, esclarecimento, confirmação e Kanban em desktop e celular com respostas de backend simuladas. Não somar suítes sobrepostas nem tratar esses ensaios como execução com modelo real.

O Vite respondeu HTTP 200 dentro da nuvem. O `localhost` do computador do fundador é outra máquina, sem encaminhamento de porta disponível nesta sessão. Não houve deploy Edge, alteração VPS, webhook, mensagem ao bot, publicação Lovable ou merge em `main`. A capacidade do worker permite apenas consumir trabalho existente e responder ao destinatário fixado pela inbox; ferramentas sob o mesmo UID podem lê-la. Mídia ainda não é interpretada e callbacks só são registrados. O estado mais recente de checkpoint e implantação deve ser relido no banco e em [onde estamos](../manual/onde-estamos.md); os adendos e seções seguintes preservam momentos anteriores da auditoria.

## Adendo de 17/10/2026 — verificação posterior no Supabase

Depois da auditoria local abaixo, o fundador disponibilizou explicitamente um PAT e autorizou seu uso apenas em memória; o binding seguro do ambiente não foi configurado. O projeto oficial foi confirmado `ACTIVE_HEALTHY`. O checkpoint `CP-20261017-V037` está ativo, sucedendo `CP-20261007-V036`: 37 versões, uma ativa e 36 históricas superadas preservadas. Os registros 1, 14 e 21 do Estado Mestre foram corrigidos com controle de concorrência; o registro 22 documenta a entrada Helena v2. A grafia do portfólio BIZ-004 foi alinhada à marca oficial `eLiving™` e o snapshot de `controle_concorrencia` está presente. As migrations 0020 a 0023 foram aplicadas e verificadas no Supabase real. O banco tinha 39 tabelas `helena_v2` e zero pedidos, planos, cards e vínculos duráveis após os smokes encerrados com `ROLLBACK`. Foram conferidas 15 tabelas com RLS; as demais seguem privadas por outros mecanismos, sem declarar RLS para todas as 39. Nenhum código de pareamento ou identificador pessoal é reproduzido aqui. As afirmações abaixo de “Supabase não conectado” e “migrations não aplicadas” descrevem o momento anterior a essa conexão, não o estado ao fim de 17/10.

A migration 0023, que fixa plano confirmado e converte pedido em card de forma idempotente sem tarefa v1, passou 22 testes SQL e 2 do motor localmente. O instalador passou 5 testes PostgreSQL para 0001–0023 e 2 cenários de upgrade do card v1. Após aplicação no Supabase, as verificações de RLS/ACL antes e depois passaram. O smoke real `consumo_integral` cobriu entrada, confirmação de plano sintético, criação do card, conferência de fontes e repetição sem duplicação; tudo foi revertido com `ROLLBACK`, sem execução de agentes nem primeiro card real. O frontend local passou na suíte completa com **244 testes em 20 arquivos**, além de TypeScript e build após as últimas mudanças; mostra `RECEBIDO`, `PLANO_CONFIRMADO` e `CARD_CRIADO` separadamente e só abre `/?card=<uuid>` para identificador válido. A UI ainda não prepara nem confirma automaticamente o plano. A UI de Telegram só diz “vinculado” após resposta positiva da RPC; migration aplicada ou código gerado não provam vínculo.

O broker Edge passou 14 testes locais e o helper de transporte passou 9, mas **não foi ativado**: a capacidade de ingresso ainda poderia ser acessada pelo modelo ou por ferramentas sob o mesmo UID. O desenho recomendado, ainda em rascunho, usa webhook direto à Edge, inbox durável para todos os updates e trabalhador Hermes restrito; o protótipo só de texto e o poller não estão prontos para troca do bot. Falta acesso à VPS. Site/Lovable e VPS ficaram intactos nesta rodada; nenhum bot foi pareado nem mensagem real enviada. O smoke Chromium de `/configuracoes` até `/login` passou sem erro JavaScript com rede externa bloqueada, sem provar o site publicado. O código foi enviado à branch em `aeb2394`; a API de criação de PR respondeu 403. O PR #18 e os relatos de implantação anteriores seguem históricos e não comprovam este novo fluxo em produção.

Rastreabilidade da 0023: o pacote aplicado incorporou a fonte SHA-256 `5c268e94adc7a3d34ee27beba4d119b2e7f98bc19c8c71c4d3fb067dc7f83db2`. Antes do commit foi removida somente uma linha vazia final, sem mudança SQL; o arquivo no Git tem SHA-256 `894e53a7f0aa7fc6fe34e9d1a3848eb17efedcf544ee576c0b9d01d50bfcd868`. A verificação posterior confirmou V037 ativo, predecessor V036, exatamente 37 versões, 36 históricas preservadas e o bloco de concorrência presente. Nenhuma credencial foi gravada no repositório ou no rascunho de inicialização.

Base: `d0d8e1e`. Todas as 38 branches do GitHub foram buscadas; não havia tags. O PR #18 estava aberto, com cinco commits além de `main` (`79174de`). As correções abaixo são posteriores a essa base e não foram implantadas. A situação de salvamento/publicação deve ser conferida no Git e em [onde estamos](../manual/onde-estamos.md).

## Escopo e evidência

Foram revisados os módulos ativos de `src/`, especificação `helena-v2/`, banco `supabase/migrations-v2/`, executor, ferramentas, validador, simulador, orquestrador e instaladores da VPS. Casos e testes foram usados para verificar os contratos e reproduzir falhas; não se afirma leitura integral dos artefatos históricos ou de cada fixture. A v1 arquivada foi preservada. Nenhum segredo real foi lido ou reproduzido, nenhuma chamada paga ao modelo foi feita e a VPS não foi acessada.

O endpoint oficial do Supabase respondeu HTTP 200 em `/auth/v1/health` com a configuração pública do app. A leitura de `public.checkpoint_mestre_atual` respondeu HTTP 401, código `42501`, por falta de permissão. Nenhum contexto do banco foi carregado. Foi salvo requisito seguro `SUPABASE_ACCESS_TOKEN` para `api.supabase.com`; o rascunho não fornece o valor nem aplica/publica a configuração.

O fundador forneceu imagens de abas autenticadas e autorizou os ajustes. A sessão não oferece controle dessas abas; o ambiente continua sem credenciais injetadas e sem conexão à VPS. Não houve tentativa de extrair cookies, senhas ou tokens do navegador.

## Correções preparadas

| Área | Falha reproduzida | Correção local |
|---|---|---|
| Banco | CONFIRMO disparava PLANO_VALIDO automaticamente, sem validador Python | Nova migration 0020 impede esse evento automático; o motor deve emiti-lo explicitamente. Migrations 0001–0019 e SQL gerado preservados. |
| Plano real | Texto podia ser planejado sem o Parecer exigido por SEMPRE | Validação exige etapa de Parecer dependente. A exceção sintética fica explícita somente no harness local. |
| Revisor | JSON malformado persistido reapresentava erro indefinidamente | Falha de formato registrada com chave de execução e retomada idempotente. Veredito negativo válido continua sem retorno automático ao autor. |
| Métricas | Uso de Helena e revisores era omitido | Leitura das respostas das três fases. Continua não sendo um contador completo de cota. |
| Fontes | Redirect podia sair da lista exata autorizada | Cada destino é conferido antes do DNS. |
| Evidências | Recusa local de fonte marcava uso de internet | Registro movido para tentativa de leitura/busca de rede. |
| Portão 1 | JSON com chave repetida e opções de pergunta fora do esquema eram aceitos | Rejeição de chaves repetidas, campos/tipos/limites e recomendação sem opção correspondente. |
| App | Datas inexistentes eram normalizadas pelo navegador | Comparação dos componentes de calendário antes de confirmar prazo. |
| App | Falha de carregamento de configuração não permitia tentar novamente | Retry explícito e reconexão ao mudar identidade. |
| App | Metadados locais inválidos de decisão não tinham recuperação | Reconciliar identificador íntegro com o banco e reler o card antes de descartar pendência; casos sem prova continuam bloqueados. |
| App | Cards apareciam apenas em lista | Kanban agrupado por estado, seleção por URL validada contra os cards da conta e detalhes preservados. |
| Entrada | Não havia recepção persistida de texto livre | Migration 0021 e UI com recibo, recuperação idempotente e histórico por acompanhamento. Não cria card nem executa trabalho. |
| Recuperação da entrada | Um acompanhamento existente não comprova um novo evento recebido | Confere origem, evento e texto exatos antes de apagar a pendência; falhas de rede não exibem detalhes internos. |
| Insumos reais | Cálculo/Parecer eram bloqueados incondicionalmente | Cálculo verifica insumos rastreáveis; Parecer monta apenas peças atuais, aprovadas e frescas. Fonte de leis publicada continua obrigatória e ausente na captura atual. |
| Hermes | Refresh herdado gravava no perfil temporário | Patch local sobre hashes oficiais para singleton/pool, lock e gravação na origem, merge de metadados, erro e concorrência; gates do instalador verificam integridade. Não instalado na VPS. |
| Operação VPS | O workflow imprimia SAIDA mas perdia o código de falha remoto | Preserva saída não zero e limpa arquivo temporário privado. Testado com SSH e instalador falsos, sem VPS. |

## Limites que continuam abertos

- Há Kanban e recebimento local de texto livre, mas a entrada comum Codex/Telegram, triagem automática e conversão confirmada para card continuam pendentes. O contrato está em [entrada unificada](../manual/entrada-unificada.md).
- Serviços de texto exigem Parecer. A captura atual não fornece tabela de leis publicada e rastreável; o serviço continua bloqueado. O plano pronto não é gerado automaticamente a partir de uma frase. Não recomendar um post sem Parecer como atalho para o primeiro card.
- A correção local da renovação do Hermes 0.19.0 foi testada e revisada independentemente; ver [diagnóstico e patch](HERMES-AUTH-2026-10-17.md). Nenhum login ou pin real foi alterado. Implantação e estabilidade real continuam sem prova.
- Revisor negativo ainda trava; o motor não implementa o retorno REPROVAR ao autor.
- A máquina aceita SEM_CAPACIDADE/AGENTE_PAUSADO numa revisão já designada, apesar da guarda pendente descrita em `servicos.yaml`. Não foi alterada nesta rodada; não é prova de que o motor real emita esse evento.
- O vigia soma uso persistido de até 500 execuções nas últimas 24 horas; falhas antes de persistir resposta não entram. Não prova consumo total do dia nem capacidade de 20 tarefas.
- Auto-login de desenvolvimento usa variáveis VITE de teste no cliente. É risco condicional se forem configuradas e o servidor exposto; não foi constatada exposição nesta sessão nem feita mudança nessa funcionalidade.
- Instalação do Hermes no Telegram não autentica automaticamente a identidade Supabase do fundador nem conecta o bot à v2. Pareamento, permissões e canal comum precisam de implementação.

## Implantação e autorização

A migration 0020 apenas redefine a porta interna usada pelo laço automático. Não altera dados nem corrige retroativamente cards que já avançaram. A 0021 acrescenta recepção separada da máquina de cards, acessível somente pelas RPCs do fundador autenticado. Antes de aplicar, conferir o estado real, migrações existentes, backup e cards em andamento. A aplicação em Supabase, atualizações na VPS, remoção de uma instalação Hermes, merge e publicação não foram executados.

Revogação e rotação de credenciais ficam para o encerramento dos ajustes, conforme a instrução mais recente do fundador. A autorização para os ajustes foi concedida; falta conexão técnica. O Hermes antigo do EasyPanel é candidato à remoção somente após inventário atual, identificação inequívoca e verificação de backup recuperável.

## Validação

Não somar suítes sobrepostas nem tratar testes ignorados ou comandos não executados como aprovados.

| Verificação executada | Resultado |
|---|---|
| Frontend completo (`npm test -- --maxWorkers=2`) | 211 testes / 18 arquivos passaram, após atualizar os testes de rotas ao novo título e à validação do link do card. |
| TypeScript do app e build de produção | Passaram. |
| Smoke do app em Chromium | Rota `/configuracoes` redireciona ao login; formulário renderiza sem erros JavaScript, com chamadas externas bloqueadas para a prova local. |
| Especificação, continuidade e workflow (`test_validar.py`, `test_continuidade.py`, `test_operacao_vps.py`) | 182 passaram. |
| Continuidade e workflow após o Kanban/entrada | 8 passaram novamente. |
| Máquina de estados (`maquina/test_maquina.py`) | 122 passaram. |
| Ferramentas | 592 passaram; após ajuste final do indicador de busca, 81 afetados passaram novamente. |
| Validador | 2.362 passaram, 31 ignorados e um benchmark falhou sob carga (89 ms para limite de 50 ms). Reexecução final do arquivo de desempenho: 23 passaram; limiar preservado. |
| Simulador | 727 passaram com jsonschema 4.26.0. O pin 4.23.0 da pasta não foi revalidado nesta sessão. |
| Executor em Docker / Python 3.13 | 630 passaram, 7 ignorados e um falhou porque a imagem não tinha `pgrep`. Após instalar `procps` na imagem de teste, o caso afetado passou. Sem alteração no teste para encobrir o pré-requisito. |
| Geração e aplicação do instalador em PG16 descartável / Python 3.13 | 5 passaram novamente com migrations 0020 e 0021, rollback em erro e repetição da base técnica. |
| Regressões do banco selecionadas | 77 passaram; gerador `--conferir` também passou. |
| Orquestrador: regressões unitárias e integrações selecionadas | 19 unitárias e 4 integrações passaram. Não foi executada toda a suíte longa de durabilidade e despacho. |
| Workflow da VPS com SSH/instalador falsos | Três códigos de saída (0, 7, 42) verificados dentro dos 182 testes da especificação. |
| Reprodução offline da renovação Hermes | Seis indicadores confirmaram o defeito; fonte PyPI com SHA-256 conferido. Não usa o serviço OpenAI nem autenticação real. |
| Correção OAuth sobre Hermes oficial 0.19.0 | 17 testes sintéticos passaram, com revisão independente, integridade/idempotência/recusa de instalação parcial; CLI v0.19.0 e dependências conferidas. |
| Executável Hermes real após o patch, provedor falso local | 19 casos passaram em contêiner sem rede externa, com código e dependências montados somente leitura e entrypoint oficial. Valida o adaptador; não usa a conta OpenAI nem comprova cota. |
| Recepção de pedidos em PG16 local | 7 testes novos passaram, incluindo corrida, conflito sem pedido órfão, ACL/RLS e isolamento. Regressão ampliada anterior: 78 passaram antes do último endurecimento dos limites; 7 novos repetidos depois. |
| Motor/contexto real e Parecer | 51 testes passaram antes da restrição final de frescor; jornada sintética COPY→PARECER repetida após essa restrição chegou a PRONTO e recusou versões antigas/peças não frescas. A ação externa permaneceu PROPOSTA. Duas unidades afetadas passaram novamente. Não é prova de modelo ou dados reais. |
| Sintaxe dos instaladores e `git diff --check` | Passaram. |

Os testes que exigiam temporário fora de qualquer repositório recusaram `/tmp` e `/workspace` por marcadores `.git` da plataforma. O executor e o ensaio de instalação foram executados em contêineres com checkout somente leitura em `/repo` e temporário separado. O benchmark foi repetido após diminuir a carga. Nenhuma asserção ou verificação TLS foi desativada. Os contêineres e o banco local criados para essas provas foram encerrados.
