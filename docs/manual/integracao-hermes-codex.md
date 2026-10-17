# Integração Hermes, Codex e Helena v2

Esta nota separa duas integrações diferentes: receber pedidos do fundador no Telegram e trabalhar em código com Codex. O desenho é uma proposta revisável; conexão ou código preparado não comprovam operação.

## Papéis e limites

- **Codex nesta sessão:** ambiente cloud com checkout em `/workspace/financeiromaxnutrition`, usado quando uma tarefa é iniciada. O acesso ao Supabase desta sessão foi autenticado e autorizado pelo fundador para as operações realizadas; isso não é acesso implícito do Hermes ou do modelo. Codex não é daemon, não fica ouvindo Telegram e não mantém um worker após o fim da sessão.
- **GitHub:** repositório `tvmensal2025/financeiromaxnutrition`, fonte do código e das mudanças. Push para a branch de trabalho funciona; a criação de PR pela API foi recusada. Merge e publicação continuam sujeitos à revisão.
- **Supabase:** memória e autoridade de identidade, permissão, pedidos, cards e estado do trabalho. O projeto real foi verificado como `ACTIVE_HEALTHY` por acesso PAT autorizado do fundador. Essa autorização não se estende implicitamente ao Hermes ou ao modelo. Não substituir o estado do banco por histórico de chat ou por um relatório local.

Em 17/10, Codex autenticado e autorizado aplicou e verificou as migrations 0020–0023 no Supabase real. O projeto tem 39 tabelas e nenhum registro durável após o smoke integral de entrada → plano confirmado → card → fontes → replay sem duplicação, concluído em `ROLLBACK`. O smoke não executou agentes e não equivale ao primeiro card real. Isso não significa que Telegram ou worker estejam conectados.

## 1. Telegram entrega atualizações à v2

**Arquitetura recomendada, ainda a implementar:** o Telegram enviará updates por webhook diretamente à Helena v2. A Edge Function deverá validar a origem/identidade do update e gravar uma inbox durável com `update_id` único, permitindo deduplicação e retomada segura. O Hermes deverá atuar como trabalhador: ler eventos já registrados e enviar respostas ou propostas ligadas ao item da inbox. Ele não receberá capacidade para inserir eventos com identidade de usuário escolhida por ele, nem `service_role` ou token do bot.

A inbox e o handler precisam preservar texto, mídia e callbacks; confirmar o update ao Telegram somente depois de persistência durável, com idempotência e política de retry. O handler atual cobre apenas texto, portanto **não está pronto para cutover**. A mudança de polling para webhook exige uma migração controlada, coordenando a parada do poller e a ativação do webhook para não perder updates, além de um caminho de rollback.

O modo `hermes-poller` e o helper de broker existentes são uma alternativa experimental, não a arquitetura recomendada para produção. O Hermes do Telegram continua sendo o único dono do polling enquanto essa alternativa estiver em uso; não iniciar um segundo `getUpdates` para o mesmo token. A ponte encaminharia apenas comandos destinados à v2 e manteria as demais mensagens na conversa normal do Hermes, mas está bloqueada até haver transporte isolado que valide a identidade do update real.

O Hermes usado pelo instalador é a fonte oficial `NousResearch/hermes-agent`, tag `v2026.5.29`, commit `e71a2bd11b733f3be7cf99deafde0066c343d462`; o `pyproject.toml` desse commit declara versão `0.15.1`. É um pin de código do instalador, não uma verificação atual da VPS.

O checkout contém a Edge Function `supabase/functions/helena-v2-telegram`, com modo `hermes-poller`. Ela aceita um update encaminhado, confere o segredo do cabeçalho, restringe o vínculo a chat privado e pode devolver uma resposta ao poller. O caminho proposto usa `/vincular <código>` para parear pelo site e `/pedido <texto>` para criar um pedido recebido. Pedidos ficam em triagem; recebimento não cria nem executa um card. Os 14 testes do broker e 9 testes do helper passaram localmente; isso não confirma ativação em produção.

Para preservar cada `update_id`, `message_id` e texto original, o ponto indicado é a camada de transporte assíncrona do poller Hermes, antes do batching de mensagens, aguardando a resposta HTTPS da Edge Function. O hook oficial `pre_gateway_dispatch` existe, mas é síncrono e roda depois do batching; serve para interceptações simples, não é o ponto indicado para garantir um ingresso por update. Encaminhar somente mensagens `/pedido` e `/vincular`; mensagens comuns seguem no Hermes.

Na arquitetura recomendada, a Edge Function guarda as credenciais necessárias no lado servidor; o Hermes recebe somente acesso de leitura a eventos autorizados e capacidade restrita de anexar uma resposta/proposta à inbox correspondente. **O helper de polling não foi ativado:** ele pode ser acessado pelo modelo/ferramentas no mesmo UID e não separa o transporte da identidade do update. Rodar em UID não-root ou bloquear comandos filhos não resolve isso. As migrations aplicadas e os testes locais do broker não comprovam o fluxo Telegram→resposta em produção.

## 2. Codex trabalha em tarefas de desenvolvimento

Codex não é o executor contínuo da Helena. Uma tarefa de código deve começar por uma instrução explícita no Codex ou por um mecanismo futuro de despacho revisado. O trabalho usa o checkout, uma branch por tarefa, alterações e verificações locais e, quando disponível, PR para revisão. Não há hoje um canal pelo qual Hermes possa manter uma sessão Codex sempre ativa nem garantia de que um pedido no Telegram iniciará essa sessão.

Para automação futura, o Supabase pode guardar pedido, autorização, estado e recibo; GitHub pode guardar branch e revisão de código. Um worker que transforme tarefas aprovadas em trabalho Codex exigiria integração própria, autenticação de escopo mínimo e limites de execução. Hermes e o modelo não recebem a chave `service_role` nem acesso root à VPS. O escopo já autorizado para esta sessão pode ser executado sem pedir confirmação repetida; ações fora dele continuam exigindo autorização apropriada.

## Resposta para Rafael encaminhar ao Hermes

> 1. **Ambiente e repositório:** Codex trabalha em sessões cloud temporárias, no repositório GitHub `tvmensal2025/financeiromaxnutrition` (checkout `/workspace/financeiromaxnutrition`). Hermes continua no serviço Telegram atual; não há conexão operacional entre eles.
> 2. **Validações:** sim, Codex pode acessar este repositório e executar os comandos autorizados para a tarefa. Deve usar as verificações locais documentadas, registrar o que passou, falhou ou não foi executado e trabalhar em branch para revisão. O acesso ao Supabase já autorizado nesta sessão não deve ser copiado para Hermes ou para o modelo.
> 3. **Início e registro:** uma tarefa explícita inicia a sessão Codex; ela trabalha em branch e deixa alterações/resultados para revisão. Codex não é daemon e não há mecanismo permanente para Hermes iniciar sessões ou receber execução imediata.
> 4. **Permissões e isolamento:** para Telegram, preferir webhook à v2 com validação e inbox durável; Hermes só lê eventos existentes e anexa resposta/proposta vinculada, sem inserir identidade de usuário. Segredos ficam no servidor; Hermes/modelo não recebem `service_role` nem token do bot. Para desenvolvimento, conceder apenas o acesso necessário ao repositório e à tarefa, mantendo revisão antes de merge/publicação.
