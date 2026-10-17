# Auditoria local da Helena v2 — 17/10/2026

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
