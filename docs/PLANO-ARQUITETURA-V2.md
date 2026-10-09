# Sistema Helena v2 — plano de arquitetura

Data: 09/10/2026. Status: PROPOSTA v2.1 (revisada após análise de furos, seção 9) para aprovação do Fundador. Nada foi construído.

## 1. Diagnóstico (o que aprendemos com a v1)

- As entregas dos agentes são boas: em 08/10, 7 aprovadas e 6 delas na primeira tentativa.
- Todas as paradas foram de "encanamento":
  - regras contraditórias espalhadas em SOUL, prompts e checklists;
  - o modelo decidindo mecânica de processo: código de agente, encerramento, liberação, divisão por tamanho;
  - diagnósticos errados (falha de tamanho registrada como "senha");
  - limites escondidos (buscas, tempo, passos);
  - travas do banco que só apareciam quando um caminho rodava pela primeira vez.
- 21 agentes num contêiner único, com scripts compartilhados: um defeito parava todos, e não havia painel de status.
- A literatura confirma o padrão: a maioria das falhas multiagente é de especificação, coordenação e verificação, não de inteligência do modelo (ICLR 2025, "Why Do Multiagent Systems Fail?").

## 2. Princípios da v2 (além do que os guias ensinam)

1. **Código decide o processo; a IA decide o conteúdo.**
   - Estados, transições, quem recebe, liberação, limites e divisão ficam numa máquina de estados em código.
   - A IA só produz conteúdo e escolhe entre opções que o código oferece e valida.
   - Isso elimina por construção os erros de 08/10: código de agente errado, autoencaminhamento, encerramento não reconhecido.
2. **Uma única fonte de verdade por agente.**
   - Cada agente é um arquivo de especificação (`agents/<nome>.yaml`) com: função; entradas; tipos de entrega; ferramentas; orçamento (tempo, passos, buscas); revisor; critérios.
   - Prompts, permissões e testes são gerados a partir dele. Não existem duas cópias de uma regra, então não há contradição possível.
3. **Entregas tipadas com tamanho embutido.**
   - Cada tipo de entrega (dossiê, plano, texto, cálculo, parecer) tem um modelo com seções e limites.
   - O código divide antes de despachar (ex.: 1 dossiê por plataforma), nunca depois de falhar.
4. **Ensaio antes de produção.**
   - Um simulador roda a esteira inteira com uma "IA falsa" para cada tipo de agente e de caminho: entrega, devolução, falha, divisão, encaminhamento, pergunta ao Fundador.
   - Toda mudança passa no ensaio antes de ir ao servidor. Os 8 defeitos que achamos ao vivo em 08/10 teriam sido pegos aqui.
5. **Isolamento com a mesma base.**
   - Uma imagem única e um serviço por agente (no EasyPanel que já temos), com configuração própria.
   - Uma atualização vai primeiro para um agente (canário) e só depois para todos.
   - Um defeito para um agente, não a empresa inteira.
6. **Tudo visível.**
   - Painel por agente: online, tarefa atual, última falha com causa real.
   - Linha do tempo por missão, com cada passagem.
   - Alerta para o Fundador só quando há decisão dele.
7. **Meta primeiro, pesquisa com orçamento.**
   - Cada meta do Fundador vira marcos a partir de um roteiro-modelo (playbook) — por exemplo, "recrutar 10 pessoas".
   - Pesquisa tem cota por meta; passou da cota, a Helena precisa justificar ao Fundador.
   - Isso acaba com a diligência sem fim.
8. **Aprender com as devoluções.**
   - Cada devolução vira um item classificado.
   - Padrões repetidos geram propostas de ajuste da especificação, aprovadas pelo Fundador e aplicadas a todos os agentes daquela função.

## 3. Organização proposta

```
helena-v2/
  agents/            # 1 arquivo por agente (fonte única)
    helena.yaml      # orquestradora: escolhe o próximo passo dentre opções válidas
    ravi.yaml        # pesquisa
    isabela.yaml     # conteúdo e marketing
    clara.yaml       # jurídico e risco
    caio.yaml        # finanças
  deliverables/      # modelos tipados: dossie, plano, copy, calculo, parecer
  playbooks/         # metas -> marcos -> tarefas (ex.: recrutar-10-pessoas.yaml)
  engine/            # maquina de estados, fila, orcamentos, divisao, revisao
  tools/             # ferramentas com permissao declarada (web, banco, arquivos)
  simulator/         # ensaio de ponta a ponta com IA falsa + casos reais gravados
  board/             # painel: agentes, missoes, decisoes do Fundador
  models.yaml        # catalogo de modelos por apelido (troca sem mexer nos agentes)
  bench/             # banco de testes com casos reais (placar antes de adotar mudancas)
```

- Memória e registro: o Supabase atual (tarefas, entregas, decisões, histórico); nada se perde.
- Hospedagem: o VPS e o EasyPanel atuais, com um serviço por agente e um para o motor; sem custo novo de plataforma.

## 4. Como uma missão anda na v2

1. O Fundador define a meta (ex.: 10 pessoas em 7 dias).
2. O motor aplica o playbook e cria os marcos.
3. A Helena escolhe a tarefa seguinte num cardápio validado pelo código.
4. O motor checa entradas, tamanho e orçamento; divide se precisar; despacha para o agente certo (código, não nome).
5. O agente entrega no modelo tipado. A autoconferência mecânica corre antes do envio.
6. O revisor da função avalia com o roteiro do tipo de entrega.
7. Se aprovada, o motor executa o próximo passo do playbook. Se devolvida, corrige uma vez. Se falhar, replaneja com a causa real.
8. Decisão do Fundador vira cartão com opções A/B/C no painel e no app; a resposta entra no contexto de todos.

## 5. Fases

| Fase | Entrega | Critério para seguir |
|---|---|---|
| 0 | Congelar a v1 (continua rodando o que está em andamento) | — |
| 1 | Especificações dos 5 agentes, modelos de entrega, playbook "recrutar 10 pessoas" | Fundador aprova os textos |
| 2 | Motor (máquina de estados, orçamento, divisão) + simulador | 100% dos caminhos passam no ensaio |
| 3 | 5 serviços no EasyPanel + painel | 1 meta real rodada de ponta a ponta sem intervenção |
| 4 | Migrar os demais agentes, um por vez, só os que a meta pedir | Taxa de aprovação na 1ª tentativa ≥ 80% por agente |

- Reaproveitamento: tabelas do Supabase; ferramentas do Gateway (entrega, revisão, memória); conteúdo dos SOULs e checklists (convertidos em especificação); perfis do Hermes, enquanto forem úteis.
- Riscos:
  - reescrever o motor tem custo de alguns dias;
  - durante a transição, convivem v1 e v2;
  - a mitigação é migrar por meta e por agente, nunca tudo de uma vez.

## 6. Mudanças futuras sem quebrar (pedido do Fundador, 09/10)

Trocar modelo, testar outro, adicionar função ou agente não pode atrapalhar quem está trabalhando.

1. **Catálogo de modelos.**
   - Os modelos ficam num arquivo único (`models.yaml`) com nome, provedor, custo e limites.
   - O agente aponta para um apelido (ex.: `pesquisa-padrao`), não para o modelo.
   - Trocar o modelo é mudar uma linha; um adaptador por provedor isola as diferenças de API.
2. **Banco de testes com casos reais.**
   - Antes de adotar um modelo ou regra novos, eles rodam contra entregas reais já gravadas, com o revisor de cada função.
   - O resultado é um placar: aprovação, custo e tempo comparados com o atual.
   - Só passa se igualar ou melhorar.
3. **Ambientes separados.**
   - `teste` (simulador e banco de testes) e `produção`.
   - Nada vai direto para produção.
4. **Canário e volta automática.**
   - A mudança entra primeiro em um agente.
   - Se a aprovação ou o tempo pioram, o sistema volta sozinho para a versão anterior e avisa.
5. **Fichas validadas.**
   - Cada ficha de agente e cada modelo de entrega têm um formato verificado pelo código.
   - Uma edição errada (ferramenta inexistente, limite impossível, regra contraditória) é recusada ao salvar, não descoberta em produção.
6. **Histórico e chaves liga/desliga.**
   - Toda mudança tem versão, autor e motivo, e volta com um comando.
   - Funções novas nascem desligadas e são ligadas por agente.
7. **Peças plugáveis.**
   - Ferramenta, função ou agente novo entram como arquivo em sua pasta.
   - O motor descobre e valida sozinho; não é preciso mexer no núcleo.

## 7. O card como centro da empresa (visão do Fundador, 09/10)

O Fundador fala com a Helena. Isso vira um card. O card anda sozinho entre os responsáveis e volta pronto, bonito e legível. Os agentes funcionam como funcionários treinados no jeito do Fundador.

1. **Entrada sem mal-entendido.**
   - A Helena transforma a fala em card estruturado: objetivo, resultado esperado, prazo, prioridade e o que não fazer.
   - Antes de criar, ela devolve uma linha de confirmação (ex.: "Entendi: plano para 10 pessoas na Mimix/Hub, em 7 dias. Confirma?").
   - Instrução mal entendida é a causa nº 1 de falha multiagente; essa confirmação mata a causa na origem.
2. **Card é a fonte única.**
   - Tudo vive no card: etapas (sub-cards), responsável atual, linha do tempo, entregas, revisões, decisões e custo.
   - Nenhum agente trabalha fora de um card.
3. **Roteamento por tabela, não por opinião.**
   - Tipo de card → roteiro (playbook) → primeiro responsável → próximos, definido em código.
   - A Helena escolhe só dentro das opções válidas. Destino inexistente, para si mesmo ou fora da função é impossível.
4. **Cada passagem é um contrato.**
   - O responsável recebe entradas conferidas pelo código e devolve no modelo do tipo de entrega.
   - O motor só passa adiante se o contrato fecha: tamanho, seções, fontes, revisão aprovada.
5. **Resultado final legível.**
   - O card fecha com um relatório padrão: resumo em 5 linhas; o que foi feito; resultado; próximos passos; decisões que dependem do Fundador.
   - É exibido formatado no app; os detalhes técnicos ficam numa aba separada.
6. **Treinar do jeito do Fundador.**
   - Em todo card concluído, o Fundador marca 👍/👎 e comenta.
   - O comentário vira proposta de regra na ficha do agente. Aprovada, vale para as próximas tarefas daquela função e entra no banco de testes, para nunca regredir.
7. **"Sem erro" com honestidade técnica.**
   - Erro de processo (travar, perder card, mandar para o lugar errado, parar em silêncio) fica impossível por construção: máquina de estados + validação + simulador + canário.
   - Erro de conteúdo (um dado errado numa pesquisa) não tem garantia de zero com IA nenhuma; ele é barrado em camadas: autoconferência mecânica, revisor independente e aprovação do Fundador no que é irreversível (dinheiro, publicação, contrato).
   - Nenhum erro passa sem ficar visível no card.
8. **Manutenção em minutos.**
   - Cada card tem um rastro completo.
   - O botão "por que travou?" mostra a etapa exata, a causa classificada e a correção recomendada.
   - Para cada tipo de falha existe um roteiro de conserto. Quem for manter (eu ou outra pessoa) entende o problema só abrindo o card.

## 8. Decisões pedidas ao Fundador

1. Aprovar a direção da v2.
2. Confirmar os 5 primeiros agentes: Helena, Ravi, Isabela, Clara, Caio.
3. Confirmar a primeira meta para o teste: recrutar 10 pessoas na Mimix e no Hub.

## 9. Análise de furos (revisão crítica antes de aprovar) — v2.1

Revisei o próprio plano procurando onde ele quebraria. Achei 8 furos; abaixo, cada um e a correção já incorporada.

| # | Furo no plano v2 | Por que quebraria | Correção (v2.1) |
|---|---|---|---|
| 1 | Reescrever o motor do zero | Joga fora proteções já testadas (contratos do Gateway, travas do banco, revisão) e reintroduz defeitos novos | **Evoluir, não reescrever**: manter Gateway e Supabase e trocar só o ciclo/despachante pelo motor novo, peça por peça (padrão "estrangulamento") |
| 2 | Um contêiner por agente | Cada contêiner precisaria do próprio login do modelo (OAuth do ChatGPT), com renovações e limites separados: mais pontos de falha, não menos | **Isolamento por processo**: workers separados na mesma máquina, com status e log próprios. Separa contêiner só se um agente precisar. O defeito em script compartilhado se resolve com versão, ensaio e canário |
| 3 | Roteiros (playbooks) rígidos | Trabalho real tem caminhos novos; um roteiro fixo travaria tarefas legítimas | **Plano como dado**: para tarefa nova, a Helena propõe um plano (etapas, responsáveis, dependências) num formato que o código valida — agente existe, função confere, tamanho, orçamento. Só então o motor executa. Plano grande pede um "ok" do Fundador |
| 4 | "Erro de processo impossível" | Exagero: provedor fora do ar, login expirado ou limite de uso do plano acontecem (vimos erros de OAuth) | **Garantia honesta**: nenhuma falha silenciosa; toda falha detectada, classificada e recuperada sozinha (nova tentativa sem gasto, modelo reserva) ou levada ao Fundador com opção. Monitor de saúde do provedor e da cota |
| 5 | Helena como orquestradora | Se a Helena (uma IA) falhar, a empresa para | **O motor (código) é o orquestrador**; a Helena é a interface e a planejadora. Se ela falhar, os cards em andamento continuam |
| 6 | Revisor IA da mesma família | Erros parecidos passam juntos; revisor exigente demais trava (vimos excesso de cautela) | **Roteiro de aprovação por tipo de entrega**, com critérios objetivos de "passou"; o 👍/👎 do Fundador também calibra o revisor; o painel mostra a taxa de devolução por revisor |
| 7 | Ensaio só com "IA falsa" | Pega defeito de encanamento, não de comportamento (Pedro em loop de buscas, Helena usando nome em vez de código) | **Dois níveis de teste**: simulador (encanamento, em toda mudança) + banco de casos reais com o modelo de verdade (comportamento, toda noite e antes de trocar modelo) |
| 8 | Segurança fora do plano | Chaves expostas em logs, porta 9119 aberta: crescer assim amplia o risco | **Fase 0 de segurança**: trocar as chaves, fechar a 9119, segredos só no cofre do servidor, antes de escalar |

### Existe plano melhor?

- **Framework pronto (LangGraph, CrewAI, Vercel eve).**
  - Ganharia execução durável e aprovações prontas.
  - Mas exige migrar app, banco e servidor para outra base, reconstruindo o que já funciona.
  - O eve é o mais próximo do desenho, mas é atrelado ao ecossistema Vercel/Nuxt.
- **Postgres como máquina de estados (escolhido).**
  - As transições ficam numa tabela e o banco recusa qualquer passo inválido, como já fazem as travas atuais.
  - É o mesmo princípio de execução durável dos frameworks, sem trocar de base.
  - É o caminho com menos furos para o seu caso.

### O que muda nas fases

0. Segurança (chaves, porta 9119) + congelar a v1 no que já está andando.
1. Fichas dos 5 agentes, modelos de entrega, primeiro roteiro e formato de "plano como dado".
2. Motor de estados no Postgres + workers por processo + simulador + banco de casos reais.
3. Card no app (relatório bonito, 👍/👎, "por que travou?") + 1 meta real de ponta a ponta sem intervenção.
4. Demais agentes, um por vez, com placar.
