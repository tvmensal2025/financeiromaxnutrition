# Onde estamos — Sistema Helena v2

Atualizado em 17/10/2026. Esta é a página de retomada do fundador. Código e testes locais foram conferidos; o estado atual de VPS, Supabase e Lovable ainda precisa de verificação.

A API do Supabase oficial respondeu HTTP 200, mas a leitura do checkpoint foi negada por permissão (HTTP 401 / 42501). Foi salvo requisito seguro de acesso nas configurações do ambiente; o valor ainda não foi disponibilizado. As imagens das abas autenticadas foram recebidas, mas esta sessão não dispõe de ferramenta para controlá-las. Conectividade e autorização do fundador não fornecem, por si, uma conexão autenticada ao banco ou à VPS.

## O sistema que o fundador quer

Um pedido feito nesta conversa ou no Telegram entra na mesma fila, aparece no Kanban e fica registrado no Supabase. Helena consulta o contexto vigente, identifica empresa e serviço, organiza as etapas e encaminha aos especialistas. O resultado volta ao mesmo pedido, com revisão e histórico.

Se faltar informação, Helena pergunta. A interpretação da IA passa pela validação do código. Confirmar o pedido não autoriza automaticamente publicar, enviar mensagens ou pagar.

**O fluxo completo ainda não está ligado.** O código local agora tem Kanban e recebimento de texto livre com recibo, histórico e proteção contra duplicação. A migration 0021 prepara a triagem persistida. Ela não cria nem executa um card: faltam interpretação, conversão confirmada e ligação autenticada dos canais. O pedido executável real continua exigindo uma tarefa capturada e plano preparado. Nenhuma destas mudanças foi implantada nesta sessão.

## O que foi feito nesta sessão

- GitHub sincronizado: 38 branches buscadas; base local `d0d8e1e`, com as mudanças do PR #18. O PR estava aberto e o repositório público na verificação de 17/10.
- Auditoria do código ativo: app, especificação, banco v2, executor, ferramentas, validador, simulador, orquestrador e instaladores. A v1 arquivada permanece parada.
- Correções locais preparadas para validação do plano, parecer obrigatório, resposta do revisor, métricas, fontes, perguntas e recuperação de erros na interface.
- A nova [migration 0020](../../supabase/migrations-v2/0020_plano_exige_validador.sql) impede que a confirmação do fundador pule a validação do plano. **Não foi aplicada no Supabase.**
- A [migration 0021](../../supabase/migrations-v2/0021_pedido_entrada.sql) recebe pedidos apenas do fundador autenticado. Testes PostgreSQL locais cobrem concorrência, conflito, continuação e isolamento. A página oferece texto livre, recuperação de envio e consulta do histórico por acompanhamento. **Não foi aplicada no Supabase.**
- O Kanban local mostra os estados reais do card, abre links de cards disponíveis para a conta e conserva detalhes, perguntas e decisões. Recebido, pronto e publicado permanecem estados distintos.
- Resultados e limites dos testes: [auditoria técnica](../auditoria/AUDITORIA-2026-10-17.md). As alterações desta sessão estão no checkout local; não foram publicadas nem juntadas ao GitHub.

## O que impede a primeira tarefa completa

1. **Entrada e encaminhamento:** recebimento do site preparado localmente; faltam pareamento Codex/Telegram, triagem automática, esclarecimentos e conversão confirmada para um plano da revisão vigente.
2. **Parecer real:** o motor monta peças aprovadas com autoria e versão. O serviço ainda precisa de tabela de leis publicada e rastreável; a captura atual não a fornece. O teste sintético até PRONTO não comprova entrega real.
3. **Renovação do login:** o defeito do Hermes 0.19.0 foi reproduzido com dados sintéticos. A correção local com verificação de fonte passou por revisão independente e 17 testes offline; não foi instalada na VPS. Detalhes na [auditoria de autenticação](../auditoria/HERMES-AUTH-2026-10-17.md).
4. **Prova operacional:** a resposta mínima `ok` relatada na VPS em 17/10 não comprova um card completo nem 48 horas de funcionamento.

## Critérios de conclusão

| Critério | Situação atual | O que falta |
|---|---|---|
| A — Segurança | Pendente | Revogar e trocar as credenciais no encerramento dos ajustes, conforme a instrução mais recente do fundador. |
| B — Site e acesso do fundador | Código local testado; publicação não confirmada | Verificar Lovable, login e configuração ativa no ambiente real. |
| C — Primeiro card completo | Não comprovado | Resolver os bloqueios acima e registrar execução, revisão e entrega reais. |
| D — Pedido em texto livre | Recebimento e histórico implementados e testados localmente | Implantar após conferir o banco; concluir interpretação, esclarecimentos e conversão para card. |
| E — Telegram ligado à v2 | Não implementado | Parear a identidade do fundador e ligar o Hermes do Telegram à mesma entrada. |
| F — Cota e login por 48 horas | Não comprovado | Corrigir a renovação e executar a prova com evidências; testes locais não substituem a prova. |
| G — Documentação e GitHub | Parcial | Revisar as correções e o PR #18, integrar e publicar após conferir o estado real. |

## Qual Hermes pode sair

Os registros descrevem três instalações com funções diferentes:

| Instalação | Função | Encaminhamento |
|---|---|---|
| Hermes do Telegram, instalado diretamente | Receber a conversa do fundador | Preservar enquanto a ligação com a v2 é preparada. |
| Hermes do motor da v2 | Executar as etapas dos cards | Preservar e corrigir o caminho de renovação do login. |
| Hermes antigo do EasyPanel | Instalação da v1 | Candidato à remoção, após identificar o alvo e comprovar backup recuperável. |

Nenhuma instalação foi removida. Este ambiente não tem acesso SSH/VPN nem credenciais da VPS configurados. Senhas, chaves e tokens não devem ser enviados no chat.

## Próximo passo

**Disponibilizar `SUPABASE_ACCESS_TOKEN` pelo campo seguro das configurações do ambiente, confirmar o projeto e ler o checkpoint vigente.** O requisito já está salvo; salvar o rascunho sem fornecer o valor não conecta o banco. Nunca enviar o valor no chat. A VPS também requer conexão técnica própria: as abas não estão acessíveis ao executor deste ambiente.

Depois, conferir o inventário da VPS e o backup antes de remover qualquer instalação. O [inventário somente leitura](../../motor/hermes-vps/inventario.sh) foi preparado, mas não executado no servidor. O fundador já autorizou os ajustes do sistema nesta sessão; não pedir novamente a mesma autorização. O [contrato de entrada comum](entrada-unificada.md) distingue o código preparado dos componentes que ainda precisam ser implementados e verificados.

SUPABASE NÃO CONECTADO — não é possível carregar o Sistema Helena com segurança.
