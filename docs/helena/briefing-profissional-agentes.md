# Contrato de briefing para tarefas dos agentes

Cada job empresarial deve ter uma tarefa visível, empresa, responsável, objetivo, definição de pronto e um briefing específico da função. A coordenação prepara o briefing antes de liberar o job. O executor pode propor melhorias de método e explicar o benefício, mas não altera a meta, assume despesas ou faz contato externo sem a decisão correspondente.

O campo `agent_jobs.instruction` usa as oito seções abaixo, nesta ordem. Cada seção precisa conter conteúdo específico da tarefa; repetir o título ou usar texto genérico não basta. No fluxo Hermes pelo Gateway, a liberação e o aceite bloqueiam seção ou conteúdo ausente, objetivo ou definição de pronto vazios e incoerência entre empresa, tarefa e perfil. O despachante do repositório faz uma checagem adicional antes da chamada ao modelo; a instalação dessa versão no host Hermes ainda precisa ser confirmada. Conversas manuais fora desse fluxo não estão cobertas por esse bloqueio. A verificação estrutural não substitui a revisão humana/Helena da qualidade factual.

## Contexto e fontes

Qual empresa, situação atual, tarefa de origem, decisões vigentes, registros e evidências o agente deve consultar? Distinga fatos confirmados, relato e hipótese. Cite objetos do Supabase de forma rastreável; se faltar uma fonte, diga o que deve ser buscado, sem inventar.

## Objetivo e impacto

Qual resultado concreto se espera da função deste agente? Por que importa agora, qual decisão ou etapa dependerá dessa entrega e o que está explicitamente fora do objetivo?

## Escopo e limites

Qual empresa e quais dados o agente pode ler e alterar? Quais gastos, compromissos, contatos externos, promessas comerciais e mudanças de escopo dependem de decisão superior? Qual é o sinal de bloqueio que obriga parar?

## Plano de trabalho

Etapas verificáveis, em ordem, com fonte de cada análise, checagens de coerência e tratamento de dados ausentes. O agente pode sugerir melhoria com problema, mudança e benefício, sem executá-la fora do escopo.

## Entregáveis

Formato esperado, itens mínimos, destinatário e como a entrega será usada. Especificar tabelas ou campos apenas quando necessários; não pedir texto longo sem finalidade operacional.

## Critérios de pronto

Condições objetivas para considerar o trabalho revisável: conteúdo, evidência, consistência com a tarefa e ausência de afirmações não verificadas. A tarefa só termina após revisão/decisão registrada e leitura de confirmação.

## Evidências e registro

Quais marcos reais devem ser registrados no Supabase, incluindo ação, motivo, fonte, próximo passo, horário com segundos e referências da entrega? Não registrar passos imaginários nem repetir logs sem mudança material.

## Revisão e encaminhamento

Quem revisa, quais perguntas precisa responder, quem recebe o próximo handoff e quando escalar para Helena ou fundador? Handoff aprovado cria nova tarefa em rascunho; não inicia outro agente automaticamente.

## Validação antes do disparo

Marina confere pertinência e capacidade; Helena ou revisor designado confere congruência, riscos e fontes. O sistema verifica identidade, empresa, versão, estrutura e cota antes de chamar o modelo. Uma instrução formalmente completa ainda pode estar ruim; nesse caso, deve voltar para revisão, não ser enviada só porque passou no validador.
