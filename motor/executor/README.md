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

## Como testar

```sh
pip install -r requirements.txt
python -m pytest -q        # 493 testes, cerca de 2 minutos; sem Hermes real, sem rede, sem gastar cota
```

## O que NÃO está provado

- O Hermes de mentira foi copiado de execuções reais do hermes-agent 0.19.0. A pasta `verificacao_real/` agora reúne 19 casos para rodar depois da autorização do fundador; eles ainda **não foram executados com o Hermes real**. Portanto, a equivalência com o Hermes de verdade continua **NÃO CONFIRMADA**.
- As suposições sobre o Hermes real (opções da linha de comando, nomes das chaves de configuração, formato do registro de uso) só se confirmam no "dia de prova" (fase 2, na VPS), com a frase exata do fundador. `requirements-hermes-real.txt` serve só para esse dia e deve ir para um ambiente à parte, nunca o dos testes.
- Nada aqui toca em Supabase, EasyPanel nem Evolution API.
