# helena-v2 — especificação da v2 (v3.1)

Fonte única de verdade dos agentes da v2. O motor lê estes arquivos; deles saem as permissões, o roteamento e os testes.
Nunca copie uma regra para outro lugar: se mudou, muda aqui. O plano que esta pasta segue é `docs/plano/PLANO-HELENA-V3.md`.

| Arquivo ou pasta | O que é |
|---|---|
| `maquina/vocabulario.yaml` | Os nomes únicos: papéis, estados do card e da etapa, ações de cada papel, classes de falha |
| `maquina/passagens.yaml` | A tabela de passagens do card e da etapa: quem pode fazer o quê em cada estado, dono e prazo de cada estado, tetos |
| `maquina/provar.py` | A prova: percorre todos os estados de um card de prova e confere as 13 regras de ferro; `replay()` roda uma jornada |
| `servicos.yaml` | O catálogo: cada serviço com um dono, revisor, reserva, ações permitidas e ferramentas |
| `organograma.yaml` | Os 21 agentes em grupos, atendendo as 4 empresas |
| `models.yaml` | Apelidos dos modelos de IA, sem modelo reserva |
| `agents/` | Uma ficha por agente (8 prontas na v3.1: as dos 5 agentes do primeiro card mais Augusto, Laura e Marina; as outras 13 são pendência) |
| `deliverables/` | Um formato por tipo de entrega: seções, checagens por código (CHK-...), rubrica (RUB-...), critério de pronto |
| `casos/` | Por serviço: o pedido, casos bons, defeitos plantados e as jornadas de ponta a ponta |
| `playbooks/` | Roteiros de metas (o das 10 pessoas já está na v3.1) |
| `schemas/` | Os formatos (JSON Schema) que fichas, entregas, ações, cards e roteiros precisam seguir |
| `validar.py` | O conferente: 71 regras; cada uma tem teste de mutação em `test_validar.py` |
| `PENDENCIAS.yaml` | Problemas reais já sabidos, com o motivo; aparecem como PENDENTE e não falham |

## Como rodar

```sh
pip install -r requirements.txt
python validar.py              # OK, ou OK com pendências conhecidas; erro novo sai com código 1
python validar.py --estrito    # trata as pendências como erro
python -m pytest -q            # validador e máquina de regras (cerca de 7 minutos)
```

## Como mudar sem quebrar

- **Agente novo:** a ficha em `agents/`, os formatos de entrega em `deliverables/` e os casos em `casos/<serviço>/` (pelo menos 3 bons, 4 defeitos e as jornadas). O validador recusa ficha incompleta ou que diverge do catálogo.
- **Regra nova do card:** muda em `maquina/passagens.yaml` e roda a prova. Uma regra nunca é escrita em dois lugares.
- **Resolveu uma pendência:** tire a linha dela de `PENDENCIAS.yaml`. O validador acusa pendência que continua na lista depois de resolvida.
- **Trocar o modelo de um agente:** uma linha em `models.yaml`.

## Regras de ouro

1. **Processo.** O código decide o processo: estado, destino, liberação e orçamento. A IA decide o conteúdo e escolhe só entre opções válidas.
2. **Card.** Todo trabalho vive num card. Não existe tarefa fora de card.
3. **Passagem.** Cada passagem é um contrato: só avança se a entrega fecha o formato e foi aprovada.
4. **Falha.** Nenhuma falha é silenciosa. Toda falha tem causa classificada e um próximo passo.
5. **Fora.** Agentes nunca agem fora (cadastro, contato, gasto, contrato, publicação). Isso vira ação do fundador.
