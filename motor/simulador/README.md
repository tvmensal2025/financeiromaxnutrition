# Simulador da esteira do Sistema Helena

Um "ensaio geral" do card, sem IA de verdade e sem banco. Ele inventa milhares de dias ruins (agente que trava,
fundador que some, resposta que chega atrasada, botão apertado na hora errada) e confere, depois de cada evento, que
18 coisas **nunca** acontecem (as "invariantes": ninguém aprova a própria peça, o padrão do relógio nunca aprova,
nenhuma ação de fora sem o ok do fundador, etapa passa de 6 execuções, card pronto com informação velha...).

## Como rodar

```
cd motor/simulador
/tmp/venv-helena/bin/python -m pytest -q                 # tudo: 723 testes, cerca de 1,5 min
/tmp/venv-helena/bin/python -m pytest -q -m "not lento"  # pula só as sementes aleatórias contra a máquina real (cerca de 1 min)
```

Se o ambiente não existir: `python3 -m venv /tmp/venv-helena && /tmp/venv-helena/bin/pip install -r requirements.txt`.
Para uma varredura mais funda contra a máquina real: `SIM_SEMENTES_MAQUINA=200 ... pytest -q -m lento`.

## O que os testes provam (pasta `testes/`)

| Arquivo | O que prova |
|---|---|
| `test_sementes.py` | 1200+ sequências aleatórias na implementação de referência, zero violação; todos os desfechos e tipos de evento aparecem |
| `test_mutacoes.py` + `mutantes.py` | 28 versões **estragadas** da referência (sem teto de execuções, auto-aprovação, padrão aprova a entrega, agente executa ação de fora, etapa aprovada sobre informação velha...). O checador acusa todas, tanto num cenário curto quanto na busca aleatória |
| `test_invariantes.py` | cada invariante tem caso que ela pega e caso que ela deixa passar; desligar qualquer uma faz algum teste falhar |
| `test_reprodutibilidade.py` | mesma semente = mesmo resultado (inclusive em outro processo, com outra ordem de hash do Python) |
| `test_adaptador_maquina.py` | nomes e limites batem com `helena-v2/maquina`; 61 cenários dão o mesmo resultado na referência e na máquina real; sementes aleatórias na máquina real; 13 defeitos plantados na tabela da máquina são pegos |
| `test_referencia.py`, `test_pecas.py` | a referência e as peças pequenas (agentes de mentira, mundo, motor de mentira, execução) |

## Quando um teste falha

A mensagem traz a **semente**. Para rever a sequência: `rodar(Referencia(), SEMENTE)`; `x.violacoes` mostra o que
quebrou e `[e.rotulo for e in x.eventos]` mostra a ordem dos eventos. A mesma semente repete sempre.

## Para criar uma regra ou uma mutação nova

- Invariante nova: função com `@invariante("nome")` em `simulador/invariantes.py` + um caso negativo em `test_invariantes.py`.
  Um teste confere que nenhuma invariante fica sem caso negativo.
- Mutação nova: classe em `testes/mutantes.py` que estraga UM método de `referencia.py` + uma linha na lista `MUTACOES`.
  Um teste confere que cada ponto de decisão da referência tem alguma mutação que o estraga.

## Limites (o que isto NÃO garante)

- "Nenhuma violação conhecida" nas sementes e nos passos rodados. Não é prova de "zero furo".
- A referência é **mais simples** que a máquina real (docstring de `referencia.py` lista as 3 diferenças). Por isso os
  cenários comuns só usam o que as duas fazem igual.
- Contra a máquina real as rodadas são curtas (30 a 60 passos): o replay refaz a jornada a cada evento.
- Isto ainda **não** liga o motor DBOS real: para isso basta escrever um `Alvo` novo (`simulador/alvo.py`) com
  `iniciar`, `aplicar` e `foto`.
