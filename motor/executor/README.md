# Executor — o adaptador do Hermes

Roda UM agente por vez, numa pasta limpa, e devolve sempre um `Resultado`. O motor só enxerga o contrato `Executor` (`rodar` e `cancelar`); o Hermes fica atrás dele. Trocar de executor é escrever outra classe com os mesmos dois métodos e passar em `testes/test_conformidade.py`.

## O que ele faz em cada execução

1. Lê a ficha (`helena-v2/agents/*.yaml`) e o `models.yaml` e gera um perfil do Hermes (`config.yaml` e `SOUL.md`) numa pasta nova, com uma pasta de trabalho vazia, `HOME` vazio e sem login do Codex.
2. Confere o perfil contra o gabarito (memória, curadoria, resumo automático e nova tentativa: desligados; sem modelo reserva; lista de ferramentas por extenso). Perfil fora do gabarito não roda.
3. Monta o ambiente do zero (nenhum nome nem valor que pareça segredo entra) e lança `hermes -z` em grupo de processos próprio.
4. Vigia tempo, cancelamento (até 15 s) e limite de chamadas das ferramentas.
5. Lê o registro de uso do Hermes e classifica a falha. A falha é lida do registro, nunca do texto do agente.
6. Confere modelo, provedor e ferramentas recebidas. Só devolve `texto` se a execução terminou inteira e passou na conferência.

Quem decide estado, destino e liberação é o motor. O executor não grava em banco nenhum.

## Como usar

```python
resultado = executor.rodar(execucao)    # bloqueia; devolve SEMPRE um Resultado
executor.cancelar("E-123-n4")           # de outra thread
resultado.ok, resultado.texto, resultado.falha.classe
```

- `ExecutorHermes`: o real (precisa do Hermes instalado). `ExecutorFalso` + `Roteiro`: o falso, sem processo nenhum, usado pelo simulador e pelos testes do motor.
- `hermes_falso.py` imita só o que importa do `hermes -z` do hermes-agent 0.19.0 e é o que os testes rodam por padrão.
- As 10 classes de falha são as de `helena-v2/maquina/vocabulario.yaml` (COTA, LOGIN, PROVEDOR, QUEDA, FERRAMENTA, TEMPO, LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO, DESCONHECIDA). Só TEMPO, LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO e DESCONHECIDA gastam tentativa.

## Fichas aceitas

| Formato | Quem usa | Observação |
|---|---|---|
| `3.1` | as fichas novas (`servicos[]`, `revisao`, `modelo{}`) | o orçamento vem pronto |
| `antigo` | fichas da fase 1 | é convertido e a conversão vira aviso: `chamadas_total = max(passos, buscas + partes + 1)` e `partes_de_pagina = passos - buscas - 1` |

Ficha com mais de um serviço exige `servico=...` ao ler.

## A porta: qualquer runtime, o mesmo motor

O motor só enxerga a classe `Executor` (`executor_helena/executor.py`): `rodar`, `cancelar`, `limpar` e `capacidades`, todos obrigatórios. O Hermes é o primeiro adaptador, não o único. Nada no banco, nas fichas, nas telas nem no motor sabe o nome do runtime: o nome vem de `HELENA_V2_EXECUTOR` (vazio = `hermes`) e a lista de nomes aceitos mora no código, em `executor_helena/registro.py`.

| Você quer | Mude aqui | O que NÃO muda |
|---|---|---|
| Trocar o modelo de um agente (ou de todos) | uma linha do apelido em `helena-v2/models.yaml` | código, fichas, banco, telas |
| Mudar missão, limite ou ferramenta de um agente | a ficha em `helena-v2/agents/` (ou uma revisão pela tela de configuração) | código do executor |
| Trocar de runtime (Hermes, EVE, OpenClaw...) | `HELENA_V2_EXECUTOR=<nome>` e as variáveis que o adaptador pede | motor, fichas, banco, telas |

`testes/test_troca_de_modelo.py` prova a primeira linha com as fichas reais; `testes/test_registro.py` e `testes/test_conformidade.py` provam a porta.

### Como adicionar um executor novo (EVE, OpenClaw ou outro)

1. Antes de tudo, leia a documentação oficial ATUAL do runtime. Não escreva adaptador por suposição: se algo não estiver confirmado, marque **NÃO CONFIRMADO** no código e nos testes.
2. Escreva uma classe `Executor` com `capacidades` (atributo de classe do tipo `Capacidades`), `rodar`, `cancelar` e `limpar`. Ela traduz o registro NATIVO do runtime para `Evidencias` e deixa `decisao.decidir` e `conferencia.conferir_*` classificarem a execução, como faz o Hermes (`runtime_alternativo.py` é o exemplo mínimo: outro runtime, mesmo núcleo).
3. As garantias de `Capacidades` não são enfeite: o runtime precisa receber a lista EXATA de ferramentas (vazia = nenhuma), informar qual modelo e provedor rodaram, nunca trocar de modelo sozinho, cortar o laço de chamadas, cancelar em até 15 s, classificar a falha pelo registro e nunca pelo texto do agente, e devolver a conversa.
4. Escreva a "forma" dele em `testes/test_conformidade.py` (e inclua em `FORMAS_DOS_APROVADOS`). Sem isso o teste `test_todo_executor_aprovado_tem_forma_de_conformidade` falha.
5. Acrescente um `Adaptador` em `APROVADOS` (`registro.py`) com os NOMES das variáveis de ambiente que ele exige (nunca valores) e liste esses nomes em `.env.example`.
6. Revisão de código e de segurança antes do pull request. O motor de produção recusa qualquer classe fora do registro e qualquer runtime que não declare todas as garantias.
7. Antes de usar de verdade: um "dia de prova" para o runtime novo, com a frase exata do fundador. Conformidade de teste não prova o runtime real.

## Como testar

```sh
pip install -r requirements.txt
python -m pytest -q        # 493 testes, cerca de 2 minutos; sem Hermes real, sem rede, sem gastar cota
```

## O que NÃO está provado

- O Hermes de mentira foi copiado de execuções reais do hermes-agent 0.19.0. A pasta `verificacao_real/` agora reúne 19 casos para rodar depois da autorização do fundador; eles ainda **não foram executados com o Hermes real**. Portanto, a equivalência com o Hermes de verdade continua **NÃO CONFIRMADA**.
- As suposições sobre o Hermes real (opções da linha de comando, nomes das chaves de configuração, formato do registro de uso) só se confirmam no "dia de prova" (fase 2, na VPS), com a frase exata do fundador. `requirements-hermes-real.txt` serve só para esse dia e deve ir para um ambiente à parte, nunca o dos testes.
- Nada aqui toca em Supabase, EasyPanel nem Evolution API.
