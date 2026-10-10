# Validador de entregas (portão 1)

## O que é

Código puro, sem IA e sem rede, que confere a entrega de um agente **antes** de qualquer revisor.
Recebe a resposta do agente e o contexto da execução e devolve, para cada checagem (`CHK-...`), se passou ou falhou,
com o **item exato** que falhou e o que o autor deve corrigir. Roda em milissegundos.

- **RECUSA**: a entrega volta ao autor. **MARCA**: a entrega segue, mas com um aviso na faixa do card.
- Só usa a biblioteca padrão do Python 3.13. Não tem nada para instalar em produção.
- Plano de origem: `docs/planos/sistema-helena-pacote/01-plano-v3.md` (seções "O agente", "Qualidade em 3 portões", "Os testes que decidem").

## Como rodar os testes

```
cd /home/user/financeiromaxnutrition/motor/validador
/tmp/venv-helena/bin/pip install -r requirements.txt     # só o pytest, versões fixas
/tmp/venv-helena/bin/python -m pytest -q
```

Os testes que decidem (teste 5 do plano) estão em `tests/test_banco_de_casos.py`: mais de 60 respostas com defeito plantado
(cada uma diz qual `CHK-...` deve pegá-la) e mais de 20 respostas honestas que precisam passar. Se algum defeito passar
ou alguma honesta falhar, o teste falha. `tests/test_mutacoes.py` estraga cada regra de propósito e confere que o banco reage.

## Como usar

```
python -m validador validar --resposta r.json --contexto c.json [--texto] [--saida v.json]
python -m validador checagens     # lista as checagens e o furo que cada uma fecha
python -m validador leis          # situação da tabela de leis
```

Saída: `0` aprovada (pode ter marcas), `1` recusada, `2` erro de arquivo ou de contexto. Exemplos prontos em `exemplos/`.

Em Python: `from validador import validar; rel = validar(resposta, contexto)` com `rel.veredito`
(`APROVADA`, `APROVADA_COM_MARCAS` ou `RECUSADA`), `rel.recusas`, `rel.marcas` e `rel.para_dict()`.
A `resposta` é o **texto** que o agente devolveu (assim "duas ações" ou "texto fora do JSON" são vistos) ou o objeto já lido.

## O que o validador recebe

A **resposta** é uma ação (`helena-v2/schemas/acao.schema.json`): `ENTREGAR`, `PERGUNTAR`, `DEVOLVER_A_QUEM_PEDIU` ou `REGISTRAR_FALHA`.
O **contexto** é um JSON montado pelo motor (nunca pelo agente):

```json
{
  "hoje": "2026-10-10",
  "execucao_id": "EXE-0001",
  "usou_internet": "SIM",
  "links_do_pedido": ["https://www.site.com.br/termos"],
  "decisoes_vigentes": [{"id": "DEC-101", "valor": "10", "unidade": "pessoas"}],
  "paginas_lidas": [{"leitura_id": "LEI-001", "url": "https://www.site.com.br/termos", "tipo": "termos_de_uso",
                     "execucao": "EXE-0001", "partes_total": 2, "partes": {"1": "texto...", "2": "texto..."}}],
  "fontes_importadas": [{"fonte_importada_id": "FON-001", "url": "...", "texto": "..."}],
  "modelo": {
    "tipo": "dossie", "servico": "SRV-DOSSIE", "limite": 7000,
    "secoes": [{"id": "fatos_com_fonte", "tipo_de_campo": "lista", "obrigatoria": true, "exige_citacao": true}],
    "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
    "acao_externa_permitida": ["NENHUMA"], "acoes_do_fundador": [],
    "validador": {"exige_fontes": true}
  }
}
```

`paginas_lidas` guarda as cópias das páginas lidas **nesta** execução, por parte (a ferramenta de leitura grava). O `modelo` usa os nomes de
`helena-v2/schemas/entrega.schema.json` (`secoes`, `limite`, `temas_obrigatorios`...). As opções que são só deste validador ficam em
`modelo.validador`: `proibir_termos_de_ganho`, `exige_fontes`, `confere_leis`, `exigir_termos_lidos_por_inteiro`,
`exige_modelo_de_calculo`, `numeros_do_texto_vem_do_modelo` e `secoes_dos_temas`. Opção com nome errado faz o validador parar com `ErroDeContexto`
(um erro de digitação não desliga uma checagem em silêncio).

Interfaces que **este componente definiu** porque a especificação v2 ainda não as tem (a outra equipe deve incorporá-las):

1. seção com `tipo_de_campo: "modelo_de_calculo"`: `{"entradas": [{id, valor, unidade, origem, ref, data_da_fonte, citacao}], "formulas": [{id, expressao, resultado, unidade}]}`;
2. item de lista com `ausencia`: `{"texto": "...", "ausencia": {"leitura_id", "termos_buscados": [...], "partes_lidas": [1, 2]}}`;
3. seção com `valores_permitidos` (ex.: semáforo PODE, AJUSTE, NAO_PODE);
4. o bloco `modelo.validador` acima e os IDs `CHK-ACAO`, `CHK-FONTE`, `CHK-CALC`, `CHK-LEI`, `CHK-TEMA` e `CHK-GANHO` (além dos `CHK-COMUM-01` a `10` que já estão no `servicos.yaml`).

## As checagens

| ID | O que confere | Gravidade | Furo |
|---|---|---|---|
| `CHK-ACAO-01` | exatamente UMA ação, JSON válido e campos certos (nenhuma, duas ou texto em volta = formato errado) | RECUSA | K-13, A-17 |
| `CHK-ACAO-02` | a ação é permitida ao serviço (`PEDIR_SUBCARD` está desligado) | RECUSA | K-13, A-17, MAQ-08 |
| `CHK-ACAO-03` | quem leu a internet só entrega ou registra falha | RECUSA | C-7 |
| `CHK-COMUM-01` | seções do modelo presentes, preenchidas e no formato | RECUSA | K-13, A-17 |
| `CHK-COMUM-02` | tamanho dentro do limite (total e por seção) | RECUSA | CONF-21 |
| `CHK-COMUM-03` | texto em português (heurística de palavras de ligação; a citação original pode estar em outra língua) | RECUSA | CONF-21 |
| `CHK-COMUM-04` | texto puro: sem HTML, script, imagem nem caractere invisível (olha valores e nomes de campo) | RECUSA | M-13, B-9 |
| `CHK-COMUM-05` | o texto não diz que o agente agiu fora ("enviei", "cadastrei", "paguei"...); "não enviei" é aceito | RECUSA | CONF-20, B-17 |
| `CHK-COMUM-06` | citação = trecho contínuo de 12 palavras ou mais (ou frase inteira) de página lida NESTA execução; sem emenda, sem corte (nem deixando de fora o "não" antes ou o "exceto" depois), da cláusula e do site certos; tradução em campo à parte | RECUSA | C-8, K-1, M-15 |
| `CHK-COMUM-07` | link que não veio de página lida chega "link não conferido" | MARCA | C-7, B-9 |
| `CHK-COMUM-08` | confiança dita pela IA chega como "autoavaliação da IA" | MARCA | C-13 |
| `CHK-COMUM-09` | grafia da marca: eLiving™ | RECUSA | DEC-023 |
| `CHK-COMUM-10` | `acao_externa` só `NENHUMA` ou `SO_FUNDADOR` com ação da lista do serviço, sem texto livre | RECUSA | CONF-20, B-17, MAQ-08 |
| `CHK-FONTE-01` | "fonte oficial" só se o site é o do link do pedido (sufixo, subdomínio, letras trocadas, `@` e porta não valem) | RECUSA | C-8 |
| `CHK-FONTE-02` | "a página não fala de X" só com termos buscados, todas as partes lidas, e o código re-procura os termos | RECUSA | C-8, M-15 |
| `CHK-FONTE-03` | no jurídico, os termos de uso foram lidos por inteiro | RECUSA | C-8 |
| `CHK-CALC-01` | toda entrada tem origem que se sustenta; nenhum número escondido dentro de fórmula | RECUSA | C-9, M-16, K-8 |
| `CHK-CALC-02` | o código REFAZ cada conta em decimal exato e o resultado bate | RECUSA | K-8, M-16 |
| `CHK-CALC-03` | câmbio só com fonte datada ou dado do fundador | RECUSA | C-9, M-16 |
| `CHK-CALC-04` | modelo bem formado; fórmula só usa o que o avaliador seguro permite (sem `eval`) | RECUSA | K-8 |
| `CHK-LEI-01` | lei fora da tabela chega "não conferida"; lei com ano no futuro ou número e ano que não batem é recusada | MARCA / RECUSA | K-18, C-10 |
| `CHK-LEI-02` | artigo citado sem o trecho (ou com trecho que não está no texto oficial já conferido) | RECUSA | K-18, C-10 |
| `CHK-LEI-03` | lei da tabela cujo texto oficial ainda não foi conferido | MARCA | K-18, C-10 |
| `CHK-LEI-04` | artigo que exige nota de jurisprudência (art. 19 do Marco Civil) sem a nota | MARCA | C-10 |
| `CHK-TEMA-01` | tema obrigatório do serviço sem resposta (jurídico: imagem, voz, dado sensível, transferência para fora do país, menores, vínculo de trabalho, publicidade) | RECUSA | C-10 |
| `CHK-GANHO-01` | convite sem nenhum termo de ganho (reais, dólares, R$, US$, renda, ganho, "por hora", complemente, extra... com acento, caixa e disfarces) | RECUSA | C-11 |

A gravidade de cada checagem (ou de um motivo) muda em `validador/dados/configuracao.json`, seção `gravidades`.
Uma checagem que quebrar por causa de uma entrega estranha **recusa** (`ERRO_INTERNO_DA_CHECAGEM`): nunca aprova sem conferir.

## Como mudar (receitas)

- **Proibir mais um termo de ganho**: acrescente a palavra em `validador/dados/termos_de_ganho.json` (sem acento, minúscula) e rode os testes.
- **Conferir uma lei**: em `validador/dados/leis.json`, cole o texto do site oficial em `texto_oficial_a_conferir`, troque `status` para `CONFERIDA` e preencha `data_da_conferencia`. **Nunca peça a uma IA para escrever o texto da lei**: o campo nasce vazio de propósito, e um teste garante isso. As URLs foram escritas sem internet (`url_conferida: false`): confira.
- **Mudar os temas obrigatórios de um serviço**: `validador/dados/temas.json` (`por_servico`), ou `temas_obrigatorios` no `modelo`.
- **Mudar um número** (palavras mínimas da citação, frase mínima do tema...): `validador/dados/configuracao.json`.
- **Criar uma checagem nova**: uma função com `@checagem(...)` num arquivo de `validador/checagens/` (nome, furo que fecha, gravidade), uma linha no README, pelo menos um defeito em `tests/casos/` e uma honesta que passe. O teste `test_cada_checagem_tem_caso_ruim_e_caso_bom` e o teste de mutação exigem isso.

## Limites que você precisa conhecer

- O validador prova que a citação **existe** na página lida e combina com a frase (cláusula e palavras em comum). Não prova que a frase está certa: isso é do revisor (portão 2).
- Lei inventada vira **marca** "não conferida" (como pede o plano, K-18); só vira recusa se o ano for futuro ou número e ano não baterem com a tabela. Para recusar sempre: `"CHK-LEI-01": "RECUSA"` na configuração.
- Artigo citado sem o trecho é **recusa** (plano v3, teste 5); se preferir só marcar: `"CHK-LEI-02": "MARCA"` na configuração. Citação de uma lei da tabela ainda sem texto oficial só recebe a marca `CHK-LEI-03` (não dá para conferir o trecho até a tabela ser preenchida).
- Enquanto o texto de uma lei estiver vazio na tabela, **todo** uso dela sai com a marca `CHK-LEI-03`. É o comportamento correto, não um defeito.
- Termo de ganho com sinônimo que não está na lista passa (a Clara ainda julga a promessa disfarçada). Câmbio só é reconhecido pelo nome, pela unidade (R$/US$...) ou por `tipo: CAMBIO`.
- Tema respondido = existe uma frase de 6 palavras ou mais com um dos termos do tema; é uma heurística, não leitura de sentido.
- Entrega com mais de 300 mil caracteres só roda as checagens de formato e de tamanho (já é recusada pelo tamanho).

## Arquivos

```
validador/            o código (um módulo pequeno por assunto)
  checagens/          as 26 checagens, agrupadas por assunto
  dados/              leis.json, temas.json, termos_de_ganho.json, configuracao.json
  expressao.py        avaliador seguro de fórmulas
tests/                banco de casos (casos/), mutações, unidade, CLI, desempenho, robustez
exemplos/             respostas e contextos prontos para o comando validar
```
