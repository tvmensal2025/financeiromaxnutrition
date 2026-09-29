# Mapeamento para vendas multiempresa — Sistema Helena

Fotografia verificada em 26/09/2026 no Supabase `ecosistemadossonhos` e no Gateway local. Este documento é um plano de construção; não declara canais, bots ou vendas homologados.

## Fronteiras corretas

- `portfolio.business_id` identifica empresas operacionais. Há três empresas ativas no cadastro principal.
- `GRUPO` e `Sistema` são escopos internos de trabalho. As três tarefas com esses valores não representam empresas ausentes; não criar linhas artificiais no portfólio para elas.
- A Memória Mestre associa Max Nutrition / Instituto da Saúde ao Ecossistema de Saúde e distingue os agentes próprios do produto de Saúde dos 20 especialistas corporativos. O diretório `agentes` tem Helena mais esses 20 especialistas; os agentes próprios de Saúde não devem ser tratados como cópias dos corporativos.
- A menção de Max Nutrition na memória não prova que ela seja uma quarta empresa autônoma no `portfolio`. Se for uma marca ou operação do Ecossistema de Saúde, modelar marca/linha abaixo da empresa; se precisar de dados, permissões e resultado próprios de uma empresa independente, confirmar essa fronteira antes de criar outro `business_id`. Não fazer essa escolha por inferência do nome.
- O mesmo especialista corporativo pode trabalhar para várias empresas, desde que cada job carregue contexto, permissão e dados de uma única empresa. Escopos globais permanecem separados do atendimento comercial.

## Estado verificado

- `channel_connections` já contém `business_id`, provedor, instância e identificador conectado, mas possui **zero registros**. Isso não prova que o canal externo esteja desligado; prova que a relação canal → empresa não está persistida ali.
- O webhook de WhatsApp lê uma única empresa e marca das variáveis da instalação. A classificação recebe esse valor antes de qualquer resolução por instância ou número. Sem o par configurado, usa identidade neutra; esse estado não deve virar venda de uma marca.
- O serviço local de configuração de voz aponta para um perfil de uma empresa específica. Existem cinco perfis de voz em duas empresas no banco, mas a seleção dinâmica por canal/empresa ainda não está homologada.
- Há 27 jobs sem `task_id`: 20 do lote global de testes do Gateway e sete de WhatsApp com empresa definida. Os testes globais não são vendas nem tarefas de clientes; os sete jobs de WhatsApp precisam de vínculo operacional quando o fluxo real for construído.
- `crm` tem duas oportunidades de uma empresa; `comunicacoes` tem 14 registros de uma empresa; `clientes` e `atendimento` estão vazios. A tabela `produto` está vazia e seus campos descrevem gestão/roadmap de produto, não um catálogo transacional de SKU, preço e estoque. Não foi identificada tabela de pedidos no esquema público.
- Clientes, CRM, comunicações, tarefas, jobs e eventos têm `business_id` e políticas RLS por empresa. Na reconciliação de 26/09, `portfolio` passou a permitir administração somente ao fundador e leitura aos membros das empresas concedidas. As principais tabelas operacionais não têm chave estrangeira para `portfolio`; `user_business_access` tem.
- O Gateway usa chave de serviço. Várias ferramentas aceitam `business_id` ou `agent_id` declarados pelo cliente sem vincular a identidade OAuth ao agente e à empresa. A nova ferramenta `record_progress` já verifica acesso da pessoa à empresa, mas isso não resolve as demais ferramentas nem comprova autoria individual do bot.
- A instrução de um job de WhatsApp contém número, nome e texto da mensagem. Antes de ampliar para dez empresas, o Gateway precisa limitar a leitura por empresa e reduzir o conteúdo sensível replicado na fila.

## Contrato de uma venda

1. **Entrada:** verificar assinatura do webhook e resolver `(provedor, instância/identificador conectado)` para exatamente um `business_id` ativo em `channel_connections`. Se não houver correspondência única, registrar apenas um incidente de roteamento seguro e não carregar marca, catálogo ou agente de outra empresa.
2. **Contexto:** carregar marca do `portfolio`, perfil de voz quando aplicável e regras comerciais da empresa. O catálogo/preço/estoque deve vir da fonte comercial autorizada, com versão e horário de atualização; `produto` não deve ser reaproveitada como catálogo de SKU sem migração conceitual.
3. **Autorização:** escolher agente apto para a empresa e função. Vincular identidade autenticada do bot a `agent_id` e empresas permitidas; não confiar só no `agent_id` enviado no corpo da chamada. Não persistir credenciais nessa relação.
4. **Registro:** criar ou recuperar contato e oportunidade por empresa; criar a tarefa canônica quando houver execução; enfileirar o job com `business_id`, `task_id`, `agent_id`, `correlation_id` e chave de idempotência do evento de origem. Cada etapa usa o mesmo `business_id`, validado no banco e no Gateway.
5. **Execução:** agente registra apenas marcos relevantes com ação, motivo, próximo passo e evidência. Handoff preserva empresa, tarefa e correlação. Falha de gravação fica visível como bloqueio, sem declarar venda concluída.
6. **Resultado:** uma venda exige referência verificável do pedido/pagamento na plataforma comercial ou aceite humano correspondente. Mensagem enviada, job `COMPLETED` ou oportunidade “ganha” isoladamente não comprovam venda. Helena acompanha exceções, conflitos e decisões; não precisa consultar todos os jobs com IA a cada intervalo.

## Sequência de implementação

### 1. Isolamento e identidade

- Restrição de `portfolio` aplicada: fundador administra; membro lê apenas empresas concedidas. Agentes, conexões de agentes e integrações globais também têm escrita restrita ao fundador. Perfis de voz e canais já restringem escrita ao fundador e leitura por empresa; validar toda a cadeia do Gateway.
- Fazer a autorização de **todas** as ferramentas do Gateway antes de usar `service_role`: leitura, despacho, claim, início, conclusão, falha, handoff, resumo e progresso. Criar vínculo verificável entre credencial do bot, agente e empresas permitidas.
- Preservar os jobs globais de homologação como testes; não atribuir `business_id` ou `task_id` retroativamente sem prova.
- Confirmar, para cada nova operação, se é empresa independente ou marca/linha de uma empresa já existente; só empresas independentes recebem novo `business_id`.
- Critério de saída: usuário ou bot de uma empresa não consegue ler, criar, assumir nem concluir trabalho de outra em testes de RLS e Gateway.

### 2. Canal → empresa

- Registrar cada instância/número em `channel_connections` com empresa, provedor, finalidade, status e identificador externo verificado. Impedir dois vínculos ativos concorrentes para o mesmo canal. Resolver o canal no banco antes da classificação por Laya.
- Remover o par único de empresa/marca como roteador de produção do WhatsApp; mantê-lo apenas como compatibilidade temporária até os canais serem migrados e testados.
- Critério de saída: dois números de empresas diferentes recebem marca e contexto corretos; canal desconhecido/duplicado não gera job comercial.

### 3. Oferta e atendimento por empresa

- Definir a fonte autorizada de catálogo, preço, disponibilidade, descontos, frete e políticas de atendimento para cada empresa. Guardar apenas identificadores e versões necessários no Supabase; sincronizar da fonte comercial, sem inventar estoque ou preço.
- Tornar a seleção de voz e conhecimento dependente do `business_id` resolvido. Manter separados os agentes próprios de Saúde e os especialistas corporativos.
- Critério de saída: trocar de empresa troca marca, oferta e regras; nenhum item de uma empresa aparece no atendimento da outra.

### 4. Cadeia comercial íntegra

- Vincular comunicação, cliente, CRM, tarefa, job, eventos e resultado à mesma empresa. Para novas entradas, usar transação/RPC ou outra operação atômica para não deixar mensagem registrada com job ausente sem alerta. Criar a tarefa somente quando o fluxo exigir trabalho rastreável.
- Adicionar validação de consistência de empresa nos vínculos e idempotência por empresa, provedor e evento externo. Tratar duplicatas, indisponibilidade do Supabase e reprocessamento sem perder a ocorrência original.
- Criar ou integrar o registro verificável de pedido/resultado comercial; não chamar uma oportunidade de venda confirmada sem essa evidência.
- Critério de saída: cada atendimento real permite navegar do canal ao resultado, e não há vínculos cruzados entre empresas.

### 5. Escala e supervisão

- Fila compartilhada com limite de trabalho simultâneo por agente, prioridade e distribuição justa entre empresas; uma empresa não deve bloquear as outras. Separar capacidades dos bots corporativos e dos agentes próprios de cada produto.
- Painel da Helena por exceção: canal sem dono, acesso negado, job sem tarefa quando aplicável, progresso sem motivo, falha de sincronização, venda sem evidência e atraso. Gerar resumos a partir do banco; chamar IA apenas quando uma decisão ou análise exigir.
- Homologar primeiro duas empresas em paralelo com clientes de teste e cenários de colisão (mesmo contato em duas marcas, webhook duplicado, bot errado, catálogo errado e falha de banco); ampliar gradualmente até dez.

## Regra de custo

Não clonar os 20 especialistas corporativos dez vezes. A seleção de empresa é uma consulta curta ao banco; cada bot recebe só o contexto aprovado para aquele job. Cache de configuração deve ser separado por `business_id` e invalidado quando a versão mudar. Não criar vigilância periódica por Grok: usar eventos, consultas SQL e revisão humana/Helena por exceção. Medir chamadas de IA e custo por atendimento e por venda, por empresa, antes de aumentar concorrência.

## Limites deste mapeamento

Este é o plano para ampliação futura; não pressupõe dez empresas atuais. As políticas de acesso ao cadastro foram corrigidas na reconciliação de 26/09/2026. Canais e jobs históricos permanecem preservados. Os números são uma fotografia datada; o estado do serviço externo pode mudar e precisa de homologação própria.
