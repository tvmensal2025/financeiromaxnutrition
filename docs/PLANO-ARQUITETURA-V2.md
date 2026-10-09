# Sistema Helena v2 — plano de arquitetura

Data: 09/10/2026. Status: PROPOSTA para aprovação do Fundador. Nada foi construído.

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

## 6. Decisões pedidas ao Fundador

1. Aprovar a direção da v2.
2. Confirmar os 5 primeiros agentes: Helena, Ravi, Isabela, Clara, Caio.
3. Confirmar a primeira meta para o teste: recrutar 10 pessoas na Mimix e no Hub.
