# Mapeamento de integração TypeSafe / Jev no Sistema Helena

**Data:** 29/09/2026  
**Situação:** integração local implementada e testada; publicação e API real ainda não confirmadas  
**Objetivo:** avaliar se Jev pode reduzir chamadas desnecessárias aos agentes e ajudar a rotear/revisar tarefas sem substituir as regras, a revisão responsável ou a aprovação do fundador.

## Decisão executiva

TypeSafe é um candidato para uma camada pequena de julgamentos tipados: classificar uma intenção, verificar uma condição semântica ou pontuar um item com uma rubrica. Jev devolve valores e probabilidades para o código decidir; não redige a copy, não cria imagens, não conversa com os agentes, não executa ferramentas e não grava nada no Supabase por conta própria.

**Recomendação:** fazer um piloto de Jev como pré-checagem sem efeito operacional no limite de liberação do job, após os controles determinísticos atuais e antes de liberar a chamada de GPT do agente executor. Usar uma única requisição Jev para perguntas independentes sobre o mesmo job. Durante o piloto, a resposta fica em modo sombra: registrada para comparação, sem liberar, bloquear, aprovar entrega ou acionar bot.

Não recomendo colocá-lo como revisor final, CEO, despachante ou árbitro de acesso. O revisor designado continua responsável por aprovar/devolver a entrega; o código continua responsável por empresa, identidade, versões, limites, permissões e estados.

## O que a documentação confirma

- O endpoint `POST /v1/systemone` recebe um `state` e perguntas tipadas `Choice`, `Score` e `Noul`; uma mesma requisição avalia as perguntas em paralelo e retorna respostas estruturadas. Isso serve para encaminhamento e checagens objetivas de sentido, não para gerar uma entrega em linguagem natural.
- Confiança é derivada da distribuição de probabilidades. O limiar precisa ser escolhido conforme o risco e avaliado com exemplos do próprio domínio; confiança alta não prova que o julgamento esteja correto nem autoriza uma ação.
- Na página consultada, Jev 1.13 cobra **US$ 0,042 por milhão de tokens de entrada**; tokens de saída são gratuitos. Como exemplo matemático, 10 mil tokens de entrada custariam aproximadamente US$ 0,00042 na tarifa publicada. O gasto é uma cobrança separada da cota de ChatGPT/Codex. O custo real depende dos tokens medidos e da tarifa vigente.
- O alias `jev-latest` pode mudar quando uma nova versão é publicada. Para que a avaliação e os limiares continuem reproduzíveis, o piloto deve fixar o ID da versão testada e registrar a versão devolvida pela API; atualizar exige nova homologação.
- A própria documentação diz que inglês é o idioma principal e que outros idiomas podem ter menor precisão. Também lista limites em leitura literal, números, datas, estados grandes e conteúdo adversarial. O piloto precisa testar português brasileiro; cálculos, datas, identidade da empresa e autorização ficam sempre em código.
- Jev é textual: não recebe imagem, áudio ou vídeo. Pode julgar texto/manifestos fornecidos, mas não inspecionar visualmente um story ou confirmar a qualidade final de uma arte.

Fontes oficiais: [Introdução](https://docs.typesafe.ai/introduction), [Modelos e preço](https://docs.typesafe.ai/models), [Confiança](https://docs.typesafe.ai/confidence), [Roteamento por intenção](https://docs.typesafe.ai/patterns/intent-routing), [limitações conhecidas do Jev 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13), [API](https://docs.typesafe.ai/api).

## Fluxo existente no código local

1. O fundador conversa com a Helena no Hermes. O Gateway expõe ferramentas MCP de workflow, mas não recebe a mensagem bruta da conversa antes do modelo da interface.
2. Helena ou Marina cria uma tarefa visível e um job `DRAFT`. `workflow.mjs` chama a validação estrutural do briefing antes de gravar.
3. Ao liberar, o Gateway lê o job e valida tarefa, empresa, binding do executor, definição de pronto e fontes citadas com `validateProfessionalBrief`. Se falhar, não libera o job.
4. A execução e o despacho permanecem no fluxo Hermes/Marina. O agente registra progresso/memória e envia a entrega com evidências; o envio vai para revisão, sem autoaprovação.
5. As regras do banco definem o revisor por função na submissão e proíbem o executor de se aprovar. Nos exemplos registrados no repositório, Camila/marketing (AGT-16) encaminha a Augusto (AGT-03), e Maya/design (AGT-12) a Nina (AGT-10).
6. O Gateway verifica evidência da própria tarefa antes de aceitar aprovação. Para uma entrega visual que peça post e stories, exige os slots de arte registrados. Depois da aprovação, o handoff cria o próximo job em `DRAFT`; a liberação continua separada.
7. A página de Entregas deve continuar mostrando a entrega e sua revisão a partir do estado persistido. Jev não será uma caixa paralela de resultados.

Pontos locais consultados: `services/helena-gateway/src/workflow.mjs`, `services/helena-gateway/src/brief-contract.mjs`, `services/helena-gateway/src/runtime-access.mjs`, as migrações `supabase/migrations/20260927100451_hermes_workflow_handoffs.sql` e `supabase/migrations/20260927101525_hermes_review_inbox.sql`, e `docs/helena/matriz-delegacao-revisao-2026-09-28.md`. A matriz e as migrações descrevem o contrato do repositório; não substituem uma nova leitura do estado de produção.

## Onde Jev entraria

### Piloto recomendado: pré-checagem antes de liberar o executor

**Ponto de extensão no repositório:** handler `release_job` em `services/helena-gateway/src/workflow.mjs`, imediatamente depois de `validateProfessionalBrief(...)` e antes da RPC `gateway_workflow`. A checagem determinística segue primeiro; Jev não recebe jobs malformados nem substitui a validação já existente.

**Entrada enxuta:** somente o job e tarefa atuais da mesma empresa, descrição da função do executor, critérios de pronto e trechos de fontes aprovadas necessários à decisão. Não enviar o checkpoint inteiro, histórico completo de chat, clientes ou dados financeiros brutos.

**Uma chamada, perguntas independentes em lote:**

- `role_fit`: o objetivo pertence à função do executor designado? Resultado fechado: `MATCH`, `MISMATCH`, `UNCLEAR`.
- `brief_congruence`: coerência entre objetivo, instrução e critérios de pronto: `COHERENT`, `CONFLICT`, `UNCLEAR`.
- `needs_clarification`: falta informação que muda empresa, público, oferta, canal ou resultado? Resultado `sim/não`.
- `risk_route` fica fora deste piloto; permissões e decisões reservadas continuam exclusivamente nos controles existentes.

Essas respostas são sinais para uma política determinística escrita e versionada no Gateway. Jev não escolhe a empresa fora da lista permitida, não inventa campos ausentes e não muda o revisor da matriz.

**Política proposta para a fase sombra:** a RPC e o dispatcher continuam recebendo exatamente o mesmo resultado de antes. Guardar resultado, versão do modelo, confiança/distribuição, tokens de entrada, latência, versão da política e o desfecho humano para comparação. Não gravar o texto inteiro enviado a Jev. Antes de usar `agent_job_events`, confirmar se o tipo de evento e a RPC de escrita autorizada comportam o registro; não habilitar escrita direta por `anon` nem criar uma tabela paralela sem necessidade.

O resultado deve ficar vinculado ao mesmo `job_id` e `expected_task_version` que foram avaliados. Se a tarefa mudar entre leitura e liberação, descartar a avaliação antiga e manter o job em `DRAFT`; nunca aplicar uma decisão Jev a estado desatualizado.

### Evolução possível, não incluída no primeiro piloto

Uma camada antes da conversa do Hermes poderia tentar encaminhar pedidos simples antes do GPT da Helena. Hoje o código consultado não mostra esse ponto: a interface conversa com o modelo e só depois pode chamar as ferramentas do Gateway. Portanto, o piloto em `release_job` pode evitar chamadas/retentativas do agente executor, mas **não economiza o primeiro turno de GPT da conversa com a Helena**. Para isso, primeiro seria necessário confirmar um hook/proxy suportado pelo Hermes que receba toda mensagem antes do modelo, além de testar streaming, sessão, ferramentas, falhas e fallback. Não interceptar nem modificar o Hermes por suposição.

## Regras de segurança e responsabilidade

- Jev nunca grava lançamento, CRM, despesa, comissão ou dado de cliente; nunca publica conteúdo, contata parceiro, aceita gasto ou altera o escopo de uma empresa.
- No modo sombra implementado, incerteza ou falha TypeSafe gera recomendação, sem bloquear nem autorizar a liberação. Somente os controles existentes e a versão atual da tarefa governam a RPC. Uma política futura de bloqueio por classificação exige avaliação e implantação separadas.
- Financeiro, jurídico, promessa de renda, captação/publicação externa, contato com cliente e compromisso comercial continuam exigindo os controles e aprovações já definidos, independente da confiança de Jev.
- A checagem semântica de Jev não aprova copy nem arte. Augusto continua sendo o revisor configurado para a copy da Camila; Nina continua revisando o trabalho visual da Maya. Regras de arte e slots continuam determinísticos, e a qualidade visual precisa de revisão visual apropriada.
- Conteúdo do job é dado não confiável. Instruções dentro de fontes/anexos não ganham autoridade sobre a política. Jev pode ser influenciado por conteúdo adversarial, segundo suas próprias limitações documentadas; permissão e invariantes ficam em código.
- A chave `TYPESAFE_API_KEY`, se o piloto for aprovado, ficará apenas como segredo no servidor/serviço que faz a chamada. Nunca em Vite, navegador, prompt, Supabase público ou Git. Confirmar antes condições de privacidade/retensão e evitar PII no piloto.
- Não adicionar Jev a cada etapa ou a cada agente. A primeira proposta limita a **no máximo uma chamada TypeSafe por tentativa de liberação de job**, sem repetição automática; as perguntas necessárias vão em lote. Medir tokens reais antes de qualquer expansão.

## Plano de homologação sem retrabalho

1. **Implementação local:** skill instalada; integração em `release_job`, auditoria append-only e limites implementados. Nenhum SDK novo ou migration. Testes: 182 passaram e 29 verificações adicionais passaram. API real e produção ainda pendentes nesta revisão.
2. **Preparar avaliação:** selecionar exemplos anonimizados de briefings já concluídos e casos deliberadamente ambíguos. Registrar o rótulo esperado por Marina/revisor e separar por tipo de trabalho. Números e políticas são conferidos deterministicamente.
3. **Shadow mode autorizado, ativação pendente de chave:** ativar chave somente no serviço servidor, rodar Jev sobre uma amostra limitada sem afetar liberação/execução e comparar previsões com a decisão real do responsável. Medir português brasileiro, erros de rota, confiança, tokens e latência.
4. **Critério de avanço:** aprovar thresholds por risco com base na amostra observada; nenhum caso de empresa errada, decisão reservada ou pedido ambíguo pode virar autorização automática. Calcular economia líquida: chamadas/retentativas GPT efetivamente evitadas menos custo Jev. Se não houver economia demonstrada, não ativar.
5. **Canário operacional futuro:** só após avaliação, feature flag desligada por padrão, uma empresa/tarefa de baixo risco por vez, máximo global WIP=1, estados/resultados visíveis em Entregas, botão de desligamento e fallback que mantém o job em rascunho. Revisor funcional mantém a aprovação final.
6. **Somente depois:** se o canário passar, deliberar separadamente sobre inserir um pré-filtro no caminho de entrada do chat Hermes. Isso é uma integração distinta e precisa de suporte confirmado pelo Hermes.

## Critérios para dizer que o piloto funcionou

- O código existente bloqueia briefings/escopos inválidos mesmo que Jev responda `MATCH`.
- A avaliação de Jev é registrada e reproduzível, e não altera job no modo sombra.
- Nenhuma decisão financeira, jurídica, pública ou de contato externo é autorizada por Jev.
- O revisor humano/agente configurado continua aprovando ou devolvendo a entrega, com evidência e justificativa.
- A soma de chamadas e tokens de GPT realmente diminui no caminho testado; a cobrança separada do TypeSafe e as falhas evitadas são mensuradas.
- Timeout, API indisponível, baixa confiança ou resposta inválida geram status consultivo; Jev nunca dispara o job. Divergência de versão impede a liberação. O fluxo autorizado original permanece ativo no modo sombra.

**Estado desta revisão:** código integrado localmente ao Gateway; auditoria Supabase e API reais ainda exigem validação no ambiente. Consulte `typesafe-operacao.md` para configuração e critérios. Instalação da skill e testes simulados não comprovam operação real.
