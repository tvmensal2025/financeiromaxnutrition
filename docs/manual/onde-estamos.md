# Onde estamos — Sistema Helena v2

## Reaproveitamento do painel e orientação da IA — 17/10/2026

O fundador pediu preservar a construção existente e ligar suas partes. A visão geral da v2 foi implementada em `/`, ligada aos cards em `/cards` e aos acompanhamentos `/cards?pedido=<requestID>`. Links antigos `/?card=...` e `/?pedido=...` continuam encaminhando ao módulo correto. O painel lê os repositórios v2 com a sessão do usuário: mostra cards consultados, esperas pelo fundador, pedidos recentes e empresas/agentes da revisão ativa. As contagens são amostras de até 200 cards e 50 pedidos; falha de leitura não vira zero e membro não consulta fontes reservadas ao fundador. A v1 original continua preservada; financeiro, CRM, calendário e voz ainda têm contratos a validar antes de integração, conforme o inventário.

O [mapa do sistema para a IA](mapa-do-sistema.md) indica fontes, responsáveis e destinos; o [mapa de reaproveitamento](mapa-de-reaproveitamento.md) registra o estado de cada módulo. A orientação curta também entra de fato no pacote de triagem, por `mapa_operacional.py`, derivada da configuração e do contexto capturados. Essa orientação não dá permissões ao modelo nem consulta o banco por conta própria. A conversa comum do Hermes ainda não recebe esse contexto automaticamente; ver [guia da triagem](guia-da-triagem.md) e [retomada na VPS](retomada-hermes-vps.md).

Validação desta etapa: suíte completa do frontend com 278 testes; após dois novos casos de navegação, 111 testes focados passaram. TypeScript, lint focal e build passaram. A suíte de mapa/triagem e integração PostgreSQL passou com 19 testes, incluindo pedido → proposta → confirmação → card → revisão → `PRONTO` com provedor falso. O Chromium exercitou fundador e membro em desktop/celular, com backend sintético, sem erro JavaScript ou rolagem horizontal. Nenhuma consulta administrativa nova, escrita no Supabase, chamada real do Hermes ou implantação remota foi feita nesta etapa; o retrato do banco abaixo conserva sua data.

## Última conferência administrativa do banco

Atualizado em 17/10/2026 após as verificações de 17:12 UTC. Esta é a página de retomada do fundador. O banco foi conferido; o novo código não foi implantado no site/Lovable, na Edge ou na VPS nesta rodada, nem esses destinos foram verificados operacionalmente.

O projeto oficial `ecosistemadossonhos` foi confirmado como `ACTIVE_HEALTHY` na consulta desta sessão. Às 17:12 UTC, `CP-20261017-V038` foi aplicado e lido de volta: 38 versões, uma ativa, 37 históricas superadas, predecessor `CP-20261017-V037`; os registros 1 e 22 do Estado Mestre ficaram nas versões 5070 e 5071. Este é um retrato datado: consulte `public.checkpoint_mestre_atual` ao retomar. As migrations 0020–0026 foram aplicadas no Supabase real com guardas e verificações posteriores de DDL, RLS e ACL. Às 17:09 UTC havia 45 tabelas `helena_v2`, 21 com RLS, e zero pedidos, propostas, planos, cards, vínculos, itens de inbox ou saídas duráveis. Os smokes usaram `ROLLBACK`; nenhum valor de credencial, código de pareamento ou identificador pessoal pertence a este documento.

## O sistema que o fundador quer

Um pedido feito nesta conversa ou no Telegram entra na mesma fila, aparece no Kanban e fica registrado no Supabase. Helena consulta o contexto vigente, identifica empresa e serviço, organiza as etapas e encaminha aos especialistas. O resultado volta ao mesmo pedido, com revisão e histórico.

Se faltar informação, Helena pergunta. A interpretação da IA passa pela validação do código. Confirmar o pedido não autoriza automaticamente publicar, enviar mensagens ou pagar.

**O fluxo completo ainda não está ligado.** A 0021 recebe pedidos, a 0024 guarda perguntas e propostas versionadas para confirmação do fundador, e a 0023 permite converter o plano confirmado em card sem tarefa v1. A interface local mostra pergunta, resposta, proposta, confirmação e link do card; o smoke de produção da 0024 percorreu entrada → pergunta → proposta → confirmação → `RASCUNHO` com dados sintéticos e `ROLLBACK`, sem agentes ou card durável. A 0025 cria inbox durável do Telegram e a 0026 prepara avisos de proposta/card; seus smokes também passaram com `ROLLBACK`. Bot, Edge, webhook, site publicado e motor da VPS ainda não foram ligados a esse fluxo. `CARD_CRIADO` não significa `PRONTO` nem publicação.

## O que foi feito nesta sessão

- GitHub sincronizado: 38 branches buscadas; base local `d0d8e1e`, com as mudanças do PR #18. O PR estava aberto e o repositório público na verificação de 17/10.
- Código da nova esteira enviado à branch [`codex/helena-v2-kanban-triagem-20261017`](https://github.com/tvmensal2025/financeiromaxnutrition/tree/codex/helena-v2-kanban-triagem-20261017), incluindo `db48808` (proposta/UI/0024) e `2ea5286` (triagem/inbox/avisos). `main` não foi integrado nesta verificação. A API do GitHub ficou inacessível pela política de proxy para `api.github.com`; o domínio foi incluído em rascunho do ambiente, ainda sujeito à publicação dessa configuração.
- Auditoria do código ativo: app, especificação, banco v2, executor, ferramentas, validador, simulador, orquestrador e instaladores. A v1 arquivada permanece parada.
- Correções locais preparadas para validação do plano, parecer obrigatório, resposta do revisor, métricas, fontes, perguntas e recuperação de erros na interface.
- A [migration 0020](../../supabase/migrations-v2/0020_plano_exige_validador.sql) impede que a confirmação do fundador pule a validação do plano. **Aplicada e verificada no Supabase.**
- A [migration 0021](../../supabase/migrations-v2/0021_pedido_entrada.sql) recebe pedidos apenas do fundador autenticado. Testes PostgreSQL locais cobrem concorrência, conflito, continuação e isolamento. A página oferece texto livre, recuperação de envio e consulta do histórico por acompanhamento. **Aplicada e verificada no Supabase; nenhum pedido real foi criado no smoke.**
- A [migration 0022](../../supabase/migrations-v2/0022_pareamento_telegram.sql) fornece código temporário de uso único, consulta/revogação do vínculo e RPCs restritas para ingresso do bot. **Aplicada e verificada no Supabase; nenhum chat foi pareado.** A UI só mostra “vinculado” após resposta positiva da RPC.
- A [migration 0023](../../supabase/migrations-v2/0023_pedido_card_v2.sql) fixa o plano confirmado e cria o card de forma idempotente. **Aplicada no Supabase; verificações de RLS/ACL passaram.** O smoke `consumo_integral` cobriu entrada e repetição sem duplicação com `ROLLBACK`. A UI exibe a proposta estruturada preparada pelo motor e permite ao fundador confirmar sua versão atual pela [0024](../../supabase/migrations-v2/0024_proposta_pedido.sql), também aplicada e verificada.
- As [migrations 0025](../../supabase/migrations-v2/0025_telegram_inbox.sql) e [0026](../../supabase/migrations-v2/0026_pedido_telegram_avisos.sql) foram aplicadas. Os smokes de redação, repetição, ACL e avisos de proposta/card/revínculo passaram com `ROLLBACK`; o chat da 0026 era sintético. O transporte preparado aceita uma capacidade restrita legível pelo trabalhador, enquanto token do Telegram, `service_role` e segredo de ingresso ficam somente na Edge. Mídias são registradas sem interpretação e callbacks somente registrados. **Não houve deploy da Edge, VPS, webhook ou bot.**
- O rascunho do ambiente inclui `api.github.com` para permitir testar a API do GitHub pelo proxy após publicação da configuração. Git por HTTPS funcionou; o resultado `Forbidden` da API nesta instância não prova falta de autorização no GitHub. Nenhuma credencial deve ser copiada para estes manuais.
- O Kanban local mostra os estados reais do card, abre links de cards disponíveis para a conta e conserva detalhes, perguntas e decisões. Recebido, pronto e publicado permanecem estados distintos.
- Resultados e limites dos testes: [auditoria técnica](../auditoria/AUDITORIA-2026-10-17.md). Passaram 253 testes frontend, TypeScript/build, 43 testes SQL, 8 testes de triagem e um teste PostgreSQL sintético até `PRONTO`, 6 testes Edge e 5 testes do pin do Hermes. O Chromium local percorreu pedido → pergunta → resposta → proposta → confirmação → link do card em desktop e celular com backend sintético; não comprova o site publicado. Nenhuma chamada paga de modelo ou mensagem Telegram real foi feita.

## O que impede a primeira tarefa completa

1. **Entrada e encaminhamento:** banco, triagem, esclarecimentos, proposta e confirmação na interface estão preparados e testados; falta implantar o código do site, Edge e transporte na VPS, configurar webhook e provar o ciclo com identidade real. Esta conversa ainda não ingressa na v2.
2. **Parecer real:** o motor monta peças aprovadas com autoria e versão. O serviço ainda precisa de tabela de leis publicada e rastreável; a captura atual não a fornece. O teste sintético até PRONTO não comprova entrega real.
3. **Renovação do login:** o defeito do Hermes 0.19.0 foi reproduzido com dados sintéticos. A correção local com verificação de fonte passou por revisão independente e 17 testes offline; não foi instalada na VPS. Detalhes na [auditoria de autenticação](../auditoria/HERMES-AUTH-2026-10-17.md).
4. **Prova operacional:** a resposta mínima `ok` relatada na VPS em 17/10 não comprova um card completo nem 48 horas de funcionamento.

## Critérios de conclusão

| Critério | Situação atual | O que falta |
|---|---|---|
| A — Segurança | Pendente | Revogar e trocar as credenciais no encerramento dos ajustes, conforme a instrução mais recente do fundador. |
| B — Site e acesso do fundador | Código local testado; a página local abriu no Linux do fundador; site/Lovable não publicado nesta rodada | Verificar login e configuração ativa no ambiente publicado antes de afirmar publicação. |
| C — Primeiro card completo | Não comprovado | Resolver os bloqueios acima e registrar execução, revisão e entrega reais. |
| D — Pedido em texto livre | 0021/0023/0024 aplicadas; proposta e confirmação na UI; ciclo sintético até `RASCUNHO` com `ROLLBACK` | Publicar UI e provar conversão com primeiro card real, sem pular validação e revisão. |
| E — Telegram ligado à v2 | 0022/0025/0026 aplicadas; inbox e avisos testados com dados sintéticos; nenhum vínculo | Implantar Edge/transporte na VPS, configurar webhook, parear e provar entrega real. |
| F — Cota e login por 48 horas | Não comprovado | Corrigir a renovação e executar a prova com evidências; testes locais não substituem a prova. |
| G — Documentação e GitHub | Código da nova esteira enviado à branch até `2ea5286`; `main` sem integração nesta verificação | Revisar os commits e a documentação, integrar e publicar após conferir o estado real; acesso à API depende da configuração de rede do ambiente. |

## Qual Hermes pode sair

Os registros descrevem três instalações com funções diferentes:

| Instalação | Função | Encaminhamento |
|---|---|---|
| Hermes do Telegram, instalado diretamente | Receber a conversa do fundador | Preservar enquanto a ligação com a v2 é preparada. |
| Hermes do motor da v2 | Executar as etapas dos cards | Preservar e corrigir o caminho de renovação do login. |
| Hermes antigo do EasyPanel | Instalação da v1 | Candidato à remoção, após identificar o alvo e comprovar backup recuperável. |

Nenhuma instalação foi removida. Este ambiente não tem acesso SSH/VPN à VPS configurado. Senhas, chaves, códigos de pareamento e tokens não devem ser enviados no chat.

## Próximo passo

**Implantar e verificar a nova esteira com segurança:** conferir o estado atual do Supabase e o checkpoint vigente, publicar a UI, implantar Edge e transporte Telegram com acesso técnico autenticado à VPS, e executar um pedido real delimitado. `CP-20261017-V038` estava ativo no readback de 17:12 UTC; uma consulta futura deve confirmar o estado então vigente. O acesso autorizado ao Supabase não concede acesso à VPS. Nunca enviar credenciais no chat.

Depois, conferir o inventário da VPS e o backup antes de remover qualquer instalação. O [inventário somente leitura](../../motor/hermes-vps/inventario.sh) e o [preparador de release sem ativação](../../motor/hermes-vps/ATUALIZAR-V2.md) estão prontos localmente, mas não foram executados no servidor. O fundador já autorizou os ajustes do sistema nesta sessão; não pedir novamente a mesma autorização. O [contrato de entrada comum](entrada-unificada.md) distingue o código preparado dos componentes que ainda precisam ser implementados e verificados.

O Supabase foi conectado nesta sessão e o checkpoint `CP-20261017-V038` estava ativo no readback de 17:12 UTC. Operação completa da Helena v2 continua não comprovada.
