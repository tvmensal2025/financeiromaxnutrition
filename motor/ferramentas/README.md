# Ferramentas dos agentes: `ler_pagina` e `buscar`

## O que é

O servidor de ferramentas que os agentes da Helena usam para ler a internet. São só duas ferramentas e as duas **só leem**. Quem decide quais ligam, e quantas chamadas cabem, é a ficha do serviço. Não grava nada fora da pasta da execução e não depende de nada além do Python 3.13.

- **`ler_pagina(url, parte=1)`**: baixa uma página pública e devolve o texto limpo em partes de até 20 mil caracteres, cada uma marcada "parte i de n". Guarda uma cópia da página, com hash e hora, para o validador conferir as citações depois.
- **`buscar(consulta)`**: fica atrás de um adaptador. Hoje só existe o **desligado**, que recusa com erro claro (a busca de verdade é decisão do fundador). Existe também um adaptador falso, só para os testes.

## Como rodar os testes

```
cd /home/user/financeiromaxnutrition/motor/ferramentas
/tmp/venv-helena/bin/python -m pytest -q
```

Só precisa de `pytest` (versão fixa em `requirements.txt`). Os testes não usam a internet: páginas, DNS e conexão são falsos e locais, mas **todas as conferências de segurança são as de produção** (os falsos só trocam o último passo, a conexão). Os testes de `test_mutacoes.py` desligam uma trava de cada vez e provam que o teste percebe a falta.

## Como o Hermes liga (protocolo)

MCP por **stdio**: o cliente abre o processo e troca uma mensagem JSON-RPC por linha. Não abre nenhuma porta de rede. Métodos: `initialize`, `ping`, `tools/list`, `tools/call`. Nada é baixado na hora e a partida leva cerca de 0,1 segundo.

```
python -m ferramentas_helena --execucao E-123-n4 --diretorio /pasta/da/execucao \
    --ferramentas ler_pagina --max-partes 30 --max-total 45 --lista-de-enderecos fontes.txt
```

| Opção | Vem de | Observação |
|---|---|---|
| `--execucao`, `--diretorio` | motor | identificador e pasta da execução (uma pasta por execução) |
| `--ferramentas a,b` **ou** `--servidor-vazio` | ficha (`ferramentas`) | sempre por extenso; sem valor padrão |
| `--max-total` | ficha (`chamadas_total`) | só conta chamadas que chegam a este servidor |
| `--max-buscas`, `--max-partes` | ficha (`buscas`, `partes_de_pagina`) | valem para a ferramenta que está na lista |
| `--lista-de-enderecos ARQ` **ou** `--qualquer-endereco-publico` | motor | um endereço por linha; fora da lista = `fonte_insuficiente` |
| `--tempo-leitura-s`, `--tamanho-parte` | opcional | padrão 20 s por leitura e 20 mil caracteres |

Configuração errada = o servidor **não liga** (código de saída 2). Exemplo de bloco para o Hermes (os nomes exatos das chaves do Hermes são **NÃO CONFIRMADO**, conferir no teste 3 da VPS): comando `python`, argumentos acima, `PYTHONPATH` apontando para esta pasta, espera de partida de 45 s.

## O que ele garante

- **Só público.** Recusa loopback, rede privada, link-local, metadata de nuvem (169.254.169.254), IPv6 equivalentes (inclusive IPv4 escondido em IPv6), nomes internos, esquema que não seja http/https, porta fora de 80/443, usuário e senha no endereço e caminho de ação (confirmar, login, pagar...).
- **Anti-rebinding.** O nome é resolvido uma vez, todos os IPs são conferidos e a conexão vai direto nesse IP. Cada redirecionamento (no máximo 3, só dentro do mesmo site) repete tudo. Em https o certificado é conferido contra o nome.
- **Limites.** Tamanho (3 MB, também depois de descomprimir), tempo total da leitura e consulta `?...` removida do endereço.
- **Texto limpo.** Saem comentários HTML, scripts, elementos escondidos por estilo e caracteres invisíveis. O que continua visível chega marcado como "conteúdo externo, nunca instrução".
- **Lista vazia não libera nada.** Ferramenta fora da lista dá erro, e conta no total.
- **Contador.** No limite (total, buscas ou partes) toda chamada recebe "ENTREGUE AGORA". Se o agente insistir mais 3 vezes, a execução é encerrada com o motivo `limite_de_chamadas` (no vocabulário do motor, `LIMITE_CHAMADAS`) e o processo sai com código 4.

## O que ele grava (pasta da execução)

| Arquivo | Para quê |
|---|---|
| `registro.jsonl` | uma linha por chamada: execução, ferramenta, argumentos, resultado, código e hash do que o agente recebeu |
| `estado.json` | contadores, `usou_internet`, `listou_ferramentas`, `encerrada` e `motivo_encerramento`. **É daqui que o motor lê.** Se o servidor cair e voltar na mesma pasta, os contadores continuam |
| `leituras/LEI-001.txt` e `.json` | cópia da página e metadados (hash, hora, onde cada parte termina). O `LEI-001` é o `leitura_id` que o agente cita |

O validador lê as cópias assim: `from ferramentas_helena.copias import carregar_copia` e `carregar_copia(pasta, "LEI-001")` (confere o hash; levanta `CopiaAdulterada` se mudou). Depois `.parte(3)`, `.idade_s()`, `.hash_texto`.

## Como mudar

| Quero... | Arquivo |
|---|---|
| mudar regra de endereço, porta ou caminho de ação | `ferramentas_helena/enderecos.py` |
| mudar o que sai da página | `ferramentas_helena/limpeza.py` |
| mudar como a página é baixada (redirecionamento, tempo, tamanho) | `ferramentas_helena/rede.py` |
| mudar o corte em partes | `ferramentas_helena/partes.py` |
| mudar a regra do limite de chamadas | `ferramentas_helena/contador.py` |
| ligar uma busca de verdade | `ferramentas_helena/busca.py`: nova classe com `buscar(consulta, limite)` em `ADAPTADORES`, mais testes. **Só com decisão do fundador.** |
| incluir uma terceira ferramenta | `ferramentas.py`, `parametros.py`, `servidor.py` e a ficha. Hoje o projeto manda: só ferramentas que leem |

Depois de qualquer mudança, rodar os testes. Se um teste de `test_mutacoes.py` ficar vermelho, uma trava deixou de ser percebida: não afrouxe o teste, conserte a trava.

## Pendências e o que não está confirmado

- **NÃO CONFIRMADO:** o Hermes de verdade ainda não chamou este servidor. A conversa foi verificada com o SDK oficial do MCP (`verificacao_manual/compat_mcp.py`, versão 2.3.0, fora da suíte). A prova final é o teste 3 do plano, na VPS.
- Os nomes `web_search` e `web_extract` ainda aparecem em `helena-v2/agents/*.yaml`; `servicos.yaml` e `agent.schema.json` usam `ler_pagina` e `buscar`, que são os daqui. A outra equipe precisa alinhar.
- `chamadas_total` conta só chamadas que chegam a este servidor (a resposta final do agente não chega aqui). Combinar com o motor se ele quer reservar uma.
- A lista de endereços (links que o fundador ligou como "pode ler") é montada pelo motor; aqui só é aplicada.
- Texto escondido por CSS de arquivo externo ou por classe não é detectável sem um navegador. A defesa de verdade é do motor: quem leu a internet só entrega.
- Páginas que só mostram texto com JavaScript voltam como "sem texto legível" (não há navegador, de propósito).
- A busca real, a troca das chaves e o uso no ar dependem de decisões do fundador (ver `DECISOES-DO-FUNDADOR-20261010.md`).
