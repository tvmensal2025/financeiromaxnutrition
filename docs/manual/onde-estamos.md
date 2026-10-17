# Onde estamos — Sistema Helena v2

Atualizado em 17/10/2026, após a conexão autorizada ao Supabase. Esta é a página de retomada do fundador. O banco foi conferido; site/Lovable e VPS não foram alterados nem verificados operacionalmente nesta rodada.

O fundador disponibilizou explicitamente um PAT e autorizou seu uso apenas em memória; o binding seguro do ambiente não foi configurado. O projeto oficial foi confirmado como `ACTIVE_HEALTHY`. O checkpoint `CP-20261017-V037` está **ativo**, sucedendo `CP-20261007-V036`; as 36 versões anteriores foram preservadas como históricas superadas. Foram atualizados com controle de concorrência os registros 1, 14 e 21 do Estado Mestre, criado o registro 22 para a entrada Helena v2 e alinhada a grafia do portfólio BIZ-004 à marca oficial `eLiving™`. As migrations 0020 a 0023 foram aplicadas e verificadas no Supabase real. A conferência encontrou 39 tabelas `helena_v2` e zero pedidos, planos, cards e vínculos duráveis após os smokes com `ROLLBACK`. Nenhum valor de credencial, código de pareamento ou identificador pessoal pertence a este documento.

## O sistema que o fundador quer

Um pedido feito nesta conversa ou no Telegram entra na mesma fila, aparece no Kanban e fica registrado no Supabase. Helena consulta o contexto vigente, identifica empresa e serviço, organiza as etapas e encaminha aos especialistas. O resultado volta ao mesmo pedido, com revisão e histórico.

Se faltar informação, Helena pergunta. A interpretação da IA passa pela validação do código. Confirmar o pedido não autoriza automaticamente publicar, enviar mensagens ou pagar.

**O fluxo completo ainda não está ligado.** A 0021 recebe triagem persistida, mas não cria nem executa card sozinha. A 0022 permite parear uma identidade Telegram no banco, mas não comprova que o bot esteja ligado à v2. A 0023 converte um plano confirmado em card sem tarefa v1; o ramo `consumo_integral` passou no Supabase com plano sintético e transação revertida, sem executar agentes nem criar o primeiro card real. Faltam proposta estruturada da Helena, confirmação na interface, transporte isolado do Telegram, execução do motor e prova de ponta a ponta. O frontend local distingue `RECEBIDO`, `PLANO_CONFIRMADO` e `CARD_CRIADO` sem tratar card criado como pronto ou publicado.

## O que foi feito nesta sessão

- GitHub sincronizado: 38 branches buscadas; base local `d0d8e1e`, com as mudanças do PR #18. O PR estava aberto e o repositório público na verificação de 17/10.
- Correções desta sessão salvas no GitHub na branch [`codex/helena-v2-kanban-triagem-20261017`](https://github.com/tvmensal2025/financeiromaxnutrition/tree/codex/helena-v2-kanban-triagem-20261017), commits `d3ac6f9` e `aeb2394`. O envio da branch funcionou; a API recusou a criação de um novo PR com `Forbidden`. Nenhum merge em `main` foi feito.
- Auditoria do código ativo: app, especificação, banco v2, executor, ferramentas, validador, simulador, orquestrador e instaladores. A v1 arquivada permanece parada.
- Correções locais preparadas para validação do plano, parecer obrigatório, resposta do revisor, métricas, fontes, perguntas e recuperação de erros na interface.
- A [migration 0020](../../supabase/migrations-v2/0020_plano_exige_validador.sql) impede que a confirmação do fundador pule a validação do plano. **Aplicada e verificada no Supabase.**
- A [migration 0021](../../supabase/migrations-v2/0021_pedido_entrada.sql) recebe pedidos apenas do fundador autenticado. Testes PostgreSQL locais cobrem concorrência, conflito, continuação e isolamento. A página oferece texto livre, recuperação de envio e consulta do histórico por acompanhamento. **Aplicada e verificada no Supabase; nenhum pedido real foi criado no smoke.**
- A [migration 0022](../../supabase/migrations-v2/0022_pareamento_telegram.sql) fornece código temporário de uso único, consulta/revogação do vínculo e RPCs restritas para ingresso do bot. **Aplicada e verificada no Supabase; nenhum chat foi pareado.** A UI só mostra “vinculado” após resposta positiva da RPC.
- A [migration 0023](../../supabase/migrations-v2/0023_pedido_card_v2.sql) fixa o plano confirmado e cria o card de forma idempotente. **Aplicada no Supabase; verificações de RLS/ACL antes e depois passaram.** O smoke `consumo_integral` cobriu entrada, confirmação sintética, criação de card, fontes e repetição sem duplicação, tudo com `ROLLBACK` e sem agentes. Localmente, passaram 22 testes SQL e 2 do motor; o instalador passou 5 testes PostgreSQL para 0001–0023 e 2 cenários de upgrade do card v1. A interface exibe os estados e só liga `card_id` válido ao Kanban; ainda não prepara ou confirma automaticamente o plano.
- O broker Edge passou em 14 testes locais e o helper em 9. **Não foi ativado:** a capacidade de ingresso ainda poderia ficar acessível ao modelo ou a ferramentas sob o mesmo UID. O desenho recomendado, ainda em rascunho, usa webhook direto à Edge, inbox durável para todos os updates e trabalhador Hermes restrito. O protótipo atual só de texto e o poller não estão prontos para troca do bot. Falta acesso técnico à VPS neste ambiente.
- As instruções reutilizáveis de inicialização foram atualizadas e salvas no rascunho do ambiente; sua publicação e o binding seguro da credencial continuam pendentes. O PAT desta sessão foi usado apenas em memória.
- O Kanban local mostra os estados reais do card, abre links de cards disponíveis para a conta e conserva detalhes, perguntas e decisões. Recebido, pronto e publicado permanecem estados distintos.
- Resultados e limites dos testes: [auditoria técnica](../auditoria/AUDITORIA-2026-10-17.md). A suíte frontend completa mais recente passou com **244 testes em 20 arquivos**, além de TypeScript e build após as últimas mudanças. O commit de código `aeb2394` foi enviado à branch; estas notas acompanham o código na mesma branch. Um smoke Chromium de `/configuracoes` até `/login` passou sem erro JavaScript com rede externa bloqueada; não verifica o site publicado. A API de criação de PR respondeu 403. Site/Lovable e VPS permanecem intactos.

## O que impede a primeira tarefa completa

1. **Entrada e encaminhamento:** banco recebe site, oferece pareamento Telegram e converte plano confirmado em card, mas o bot e esta conversa não estão conectados à v2. Faltam transporte de identidade separada, triagem automática, esclarecimentos, proposta estruturada e confirmação do plano pela interface.
2. **Parecer real:** o motor monta peças aprovadas com autoria e versão. O serviço ainda precisa de tabela de leis publicada e rastreável; a captura atual não a fornece. O teste sintético até PRONTO não comprova entrega real.
3. **Renovação do login:** o defeito do Hermes 0.19.0 foi reproduzido com dados sintéticos. A correção local com verificação de fonte passou por revisão independente e 17 testes offline; não foi instalada na VPS. Detalhes na [auditoria de autenticação](../auditoria/HERMES-AUTH-2026-10-17.md).
4. **Prova operacional:** a resposta mínima `ok` relatada na VPS em 17/10 não comprova um card completo nem 48 horas de funcionamento.

## Critérios de conclusão

| Critério | Situação atual | O que falta |
|---|---|---|
| A — Segurança | Pendente | Revogar e trocar as credenciais no encerramento dos ajustes, conforme a instrução mais recente do fundador. |
| B — Site e acesso do fundador | Código local testado; site/Lovable intactos nesta rodada | Verificar login e configuração ativa no ambiente real antes de afirmar publicação. |
| C — Primeiro card completo | Não comprovado | Resolver os bloqueios acima e registrar execução, revisão e entrega reais. |
| D — Pedido em texto livre | RPCs 0021 e 0023 aplicadas; frontend local com recibo e histórico; conversão sintética em `ROLLBACK` | Publicar a UI, propor/confirmar plano estruturado e provar conversão com primeiro card real. |
| E — Telegram ligado à v2 | 0022 aplicada; UI e broker preparados localmente, nenhum vínculo | Isolar a capacidade do modelo/ferramentas, instalar transporte na VPS, parear e provar entrega real. |
| F — Cota e login por 48 horas | Não comprovado | Corrigir a renovação e executar a prova com evidências; testes locais não substituem a prova. |
| G — Documentação e GitHub | Código enviado à branch em `aeb2394`; documentação aguarda commit; `main` sem integração | API de criação de PR recusada. Revisar as correções e o PR #18, integrar e publicar após conferir o estado real. |

## Qual Hermes pode sair

Os registros descrevem três instalações com funções diferentes:

| Instalação | Função | Encaminhamento |
|---|---|---|
| Hermes do Telegram, instalado diretamente | Receber a conversa do fundador | Preservar enquanto a ligação com a v2 é preparada. |
| Hermes do motor da v2 | Executar as etapas dos cards | Preservar e corrigir o caminho de renovação do login. |
| Hermes antigo do EasyPanel | Instalação da v1 | Candidato à remoção, após identificar o alvo e comprovar backup recuperável. |

Nenhuma instalação foi removida. Este ambiente não tem acesso SSH/VPN à VPS configurado. Senhas, chaves, códigos de pareamento e tokens não devem ser enviados no chat.

## Próximo passo

**Preparar proposta estruturada e confirmação do plano**, depois resolver o isolamento do transporte Telegram antes de ativar o broker. O checkpoint v2 já está ativo como `CP-20261017-V037`; não é preciso sincronizá-lo novamente. O acesso autorizado ao Supabase já foi usado nesta sessão; ele não concede acesso à VPS. Nunca enviar credenciais no chat.

Depois, conferir o inventário da VPS e o backup antes de remover qualquer instalação. O [inventário somente leitura](../../motor/hermes-vps/inventario.sh) foi preparado, mas não executado no servidor. O fundador já autorizou os ajustes do sistema nesta sessão; não pedir novamente a mesma autorização. O [contrato de entrada comum](entrada-unificada.md) distingue o código preparado dos componentes que ainda precisam ser implementados e verificados.

O Supabase foi conectado nesta sessão e o checkpoint `CP-20261017-V037` está ativo. Operação completa da Helena v2 continua não comprovada.
