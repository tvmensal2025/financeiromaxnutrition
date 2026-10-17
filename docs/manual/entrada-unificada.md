# Pedido único pelo Codex, site e Telegram

A visão geral da v2 em `/` se liga aos cards em `/cards` e aos acompanhamentos `/cards?pedido=<requestID>`. A consulta do pedido confere a conta antes de abrir sua proposta. O [mapa do sistema](mapa-do-sistema.md) e o [inventário de reaproveitamento](mapa-de-reaproveitamento.md) explicam como conectar a construção preservada a esta mesma esteira. O mapa curto já é incluído na triagem do motor; a conversa comum do Hermes ainda precisa de integração de contexto, conforme a [retomada na VPS](retomada-hermes-vps.md).

Contrato e estado de implementação de 17/10/2026. No readback de 17:12 UTC, `CP-20261017-V038` estava ativo, com V037 como predecessor e 37 versões históricas superadas; consulte `public.checkpoint_mestre_atual` ao retomar. As migrations 0020–0026 foram aplicadas e verificadas no projeto oficial. O código foi enviado à branch de trabalho; o novo site/Lovable, a Edge, o webhook e o trabalhador na VPS não foram implantados nesta rodada. Receber ou parear não comprova que o bot, esta conversa ou o motor estejam conectados.

## Estado das peças

- Migration `0021_pedido_entrada.sql`: recepção, leitura e listagem restritas ao fundador autenticado, sem criar card ou job; aplicada e verificada em produção.
- Migration `0022_pareamento_telegram.sql`: código temporário de uso único, consulta/revogação do vínculo e ingresso do bot sob RPC restrita; aplicada e verificada em produção. Nenhum vínculo foi criado no smoke com `ROLLBACK`.
- Migration `0023_pedido_card_v2.sql`: plano confirmado vinculado ao pedido e conversão idempotente em card, sem fabricar tarefa v1. Aplicada no Supabase; verificações de RLS/ACL passaram antes e depois. O smoke `consumo_integral` criou um card a partir de plano sintético e conferiu fontes e repetição sem duplicação, tudo em transação revertida, sem executar agentes.
- Migration `0024_proposta_pedido.sql`: perguntas e propostas versionadas; a UI exibe esclarecimento, resposta e confirmação de proposta válida. Aplicada em produção; smoke sintético entrada → pergunta → proposta → confirmação → card `RASCUNHO` passou com `ROLLBACK`.
- Migrations `0025_telegram_inbox.sql` e `0026_pedido_telegram_avisos.sql`: inbox durável, repetição segura e avisos de proposta/card/revínculo. Aplicadas com verificações de DDL, ACL e RLS; smokes de redação/repetição/ACL e avisos passaram com `ROLLBACK`. O chat da 0026 era sintético, não uma entrega do Telegram.
- Site no checkout: texto livre, recibo, recuperação idempotente, histórico, pergunta, resposta, proposta, confirmação, Kanban e UI de pareamento. A UI só mostra Telegram vinculado se a consulta ao banco o confirmar; código de pareamento não é guardado no navegador nem incluído no link do bot. Estados `RECEBIDO`, `PLANO_CONFIRMADO` e `CARD_CRIADO` têm textos distintos; só um `card_id` válido abre o Kanban.
- Reenvios do mesmo evento são idempotentes; texto ou acompanhamento divergente com a mesma chave gera conflito. Um novo evento com o mesmo acompanhamento é continuação explícita.
- A origem SITE/CODEX/TELEGRAM é metadado declarado pelo ingresso autorizado, **não prova de entrega operacional**. O banco oferece pareamento, mas não há vínculo ativo nem transporte Telegram/Codex homologado. O bot e esta conversa ainda não enviam pedidos à v2.
- O transporte Edge/inbox e o trabalhador Hermes restrito estão preparados no código, com 6 testes Edge e 5 testes do pin do Hermes. Uma capacidade restrita pode ser lida pelo trabalhador; token do bot, `service_role` e segredo de ingresso ficam somente na Edge. Mídias são persistidas sem interpretação e callbacks só registrados. **Edge, webhook, VPS e bot não foram implantados; nenhum Telegram real foi processado.** O poller antigo não deve ser ativado.
- Triagem, esclarecimentos, proposta estruturada e confirmação na interface estão implementados e testados com dados sintéticos. Nenhuma chamada paga de modelo ocorreu nesta rodada. Recebimento e plano confirmado não são execução concluída; `CARD_CRIADO` também não significa `PRONTO` nem publicação.

Às 17:09 UTC havia 45 tabelas `helena_v2`, 21 com RLS, e zero pedidos, propostas, planos, cards, vínculos, inbox ou saídas duráveis após smokes com `ROLLBACK`. Passaram 43 testes SQL, 8 testes unitários de triagem e um PostgreSQL sintético até `PRONTO`, 253 testes frontend, TypeScript/build, 6 Edge e 5 do pin Hermes. O Chromium local percorreu o fluxo da UI em desktop e celular com backend simulado. Esses testes não comprovam site publicado nem bot operante.

## Experiência desejada do fundador

1. Você faz um pedido de trabalho em qualquer canal.
2. Recebe um número de acompanhamento; hoje ele aparece no histórico de pedidos. O Kanban só mostra o card após a conversão confirmada.
3. Helena consulta o contexto vigente do Supabase e propõe empresa, serviço, resultado e etapas. Fatos têm fonte e versão; informação ausente vira uma pergunta.
4. O código confere serviço, permissões, insumos, orçamento e revisores obrigatórios. Você confere a leitura de volta antes da execução.
5. O pedido fica ligado a um único card executável. Agentes trabalham, outro agente revisa, e a entrega volta ao mesmo acompanhamento.
6. Enviar, publicar ou pagar continuam sujeitos às autorizações próprias dessas ações.

```mermaid
flowchart LR
    C[Pedido aqui] --> E[Entrada comum]
    T[Pedido no Telegram] --> E
    W[Pedido no site] --> E
    E --> S[Supabase: registro e contexto]
    S --> H[Helena: entender e organizar]
    H --> P[Perguntar ou confirmar o pedido]
    P --> K[Card e etapas validados]
    K --> A[Especialistas]
    A --> R[Revisão]
    R --> F[Entrega e histórico no mesmo pedido]
```

## O que o código atual permite

- Supabase Auth e `app_access` identificam o fundador. O login OpenAI do Hermes não substitui essa identidade.
- A v2 já possui estados do card, etapas, revisores, confirmação do fundador, histórico, controle de versão e ações externas separadas.
- O motor aceita uma tarefa capturada de `public.tarefas` com plano pronto; a 0023 aplicada também aceita a conversão nativa de pedido com plano confirmado. A 0024 e a UI preparam perguntas, propostas e confirmação; o caminho completo só passou em smoke sintético com `ROLLBACK`.
- O card `RASCUNHO` já precisa de roteiro e etapas. Criar um card vazio para uma frase ainda não entendida mudaria a máquina e poderia acionar relógio e despacho indevidamente.
- A tela local agora tem Kanban e preserva detalhes, entregas, perguntas e decisões. Publicação real ainda não conferida.

## Menor implementação completa a preparar

**Entrada persistida antes da execução.** A migration 0021 cria o pedido de triagem e RPCs autenticadas. O pedido recebe `pedido_id` e `request_id`; a interface mostra o recebimento, separado do trabalho planejado. A 0024 guarda a proposta e a confirmação na UI; a 0023 atribui `card_id` único somente após plano confirmado e consumo pelo motor. Isso está preparado e testado, mas não publicado no site. Não fabricar tarefa da v1 nem chamar a função antiga de criação a partir do bot.

**Proposta tipada da Helena.** A IA propõe tipo de mensagem, empresa, serviço, objetivo, prazo, fontes e ambiguidades. O código confere os identificadores da revisão vigente e monta as etapas previstas na configuração. Serviços de texto que exigem Parecer conservam esse requisito. Uma proposta incompleta permanece aguardando esclarecimento; não se transforma silenciosamente em ordem de execução.

**Contexto compartilhado.** Ler o checkpoint vigente, decisões, configuração e pedidos relacionados com permissões e limites de empresa. Guardar referências, versão e o que foi confirmado. Não prometer entendimento de toda informação sem consultá-la nem usar um documento antigo como estado atual.

**Identidade nos dois canais.** A 0022 aplicada permite gerar no site autenticado um código temporário e consultar ou revogar o vínculo usuário/chat do fundador. Nenhum chat foi pareado. A integração desta conversa ainda precisa de capacidade restrita de entrada ou sessão autorizada. O transporte preparado separa token, `service_role` e segredo de ingresso na Edge, com capacidade restrita legível pelo trabalhador; sua instalação e a prova de identidade na VPS ainda faltam. Bot e modelo não recebem a chave administrativa do Supabase.

**Repetição e continuação.** Uma chave do evento impede duplicar reenvios do mesmo canal. Um `request_id` compartilhado no recibo permite continuar o mesmo pedido no outro canal. Reutilizar a chave com conteúdo diferente deve produzir conflito. Duas frases independentes ou paráfrases sem identificador não podem ser consideradas a mesma ordem com certeza: Helena sinaliza possível duplicação e pergunta.

**Kanban fiel ao estado.** Mostrar triagem, preparação, aguardando fundador, em trabalho, pronto e encerrado. Manter estado e motivo exatos no detalhe. Uma espera de etapa ou ação externa aparece como aviso; `PRONTO` não significa publicado.

## Aceite local antes de implantar

- Pedido autenticado gera recibo e registro; anônimo ou canal não pareado é recusado.
- Reenvio com mesma chave retorna o mesmo pedido; conteúdo divergente falha; os dois canais continuam o mesmo identificador.
- Pedido ambíguo gera pergunta e nenhum efeito externo.
- Proposta sem serviço autorizado, fonte necessária ou Parecer obrigatório não avança.
- Conversão confirmada cria um único card com revisão fixada e histórico de origem.
- A tela acompanha o mesmo pedido e a entrega; as permissões continuam valendo.

O checkpoint `CP-20261017-V038` foi aplicado e lido de volta às 17:12 UTC: 38 versões, uma ativa, 37 históricas superadas; os registros 1 e 22 ficaram nas versões 5070 e 5071. Antes de ativar componentes, conferir novamente checkpoint, revisão e serviços reais. A autorização para os ajustes já foi concedida; ela não supre o acesso à VPS. O primeiro card real e a prova de 48 horas dependem também dos bloqueios registrados em [onde estamos](onde-estamos.md).
