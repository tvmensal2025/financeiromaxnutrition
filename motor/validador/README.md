# Validador de entregas (portão 1)

## O que é

Código puro, sem IA e sem rede, que confere a entrega de um agente **antes** de qualquer revisor.
Recebe a resposta do agente e o contexto da execução e devolve, para cada checagem (`CHK-...`), se passou ou falhou,
com o **item exato** que falhou e o que o autor deve corrigir. Roda em milissegundos.

- **RECUSA**: a entrega volta ao autor. **MARCA**: a entrega segue, mas com um aviso na faixa do card.
- Só usa a biblioteca padrão do Python 3.13. Não tem nada para instalar em produção.
- Plano de origem: `docs/plano/PLANO-HELENA-V3.md` (seções "O agente", "Qualidade em 3 portões", "Os testes que decidem").

## Como rodar os testes

```
cd /home/user/financeiromaxnutrition/motor/validador
/tmp/venv-helena/bin/pip install -r requirements.txt     # pytest e PyYAML (só para testes), versões fixas
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
- **Criar uma checagem nova**: uma função com `@checagem(...)` num arquivo de `validador/checagens/` (nome, furo que fecha, gravidade), uma linha no README, pelo menos um defeito em `tests/casos/` e uma honesta que passe. O teste `test_cada_checagem_tem_caso_ruim_e_caso_bom` e o teste de mutação exigem isso. Se a checagem é uma CHK da especificação v2, siga também o guia abaixo.

## Limites que você precisa conhecer

- O validador prova que a citação **existe** na página lida e combina com a frase (cláusula e palavras em comum). Não prova que a frase está certa: isso é do revisor (portão 2).
- Lei inventada vira **marca** "não conferida" (como pede o plano, K-18); só vira recusa se o ano for futuro ou número e ano não baterem com a tabela. Para recusar sempre: `"CHK-LEI-01": "RECUSA"` na configuração.
- Artigo citado sem o trecho é **recusa** (plano v3, teste 5); se preferir só marcar: `"CHK-LEI-02": "MARCA"` na configuração. Citação de uma lei da tabela ainda sem texto oficial só recebe a marca `CHK-LEI-03` (não dá para conferir o trecho até a tabela ser preenchida).
- Enquanto o texto de uma lei estiver vazio na tabela, **todo** uso dela sai com a marca `CHK-LEI-03`. É o comportamento correto, não um defeito.
- Termo de ganho com sinônimo que não está na lista passa (a Clara ainda julga a promessa disfarçada). Câmbio só é reconhecido pelo nome, pela unidade (R$/US$...) ou por `tipo: CAMBIO`.
- Tema respondido = existe uma frase de 6 palavras ou mais com um dos termos do tema; é uma heurística, não leitura de sentido.
- Entrega com mais de 300 mil caracteres só roda as checagens de formato e de tamanho (já é recusada pelo tamanho).

## Ponte com a especificação v2 (`spec_helena/`)

A especificação (`helena-v2/deliverables/<tipo>.yaml`, `servicos.yaml`, `casos/`) é a fonte; nada dela é copiado para o código. O pacote `spec_helena/`
fica **fora** de `validador/` (usa PyYAML; só os testes e o comando de cobertura o importam) e entrega ao validador, a cada pedido:

- `modelo`: tipo, serviço, limite e seções do YAML do tipo; ações permitidas e ação externa do serviço (das ações do fundador vai só o id); `parametros` de cada CHK em `parametros_das_checagens`;
- `contexto`: `hoje`, `execucao_id`, `usou_internet`, `links_do_pedido`, `decisoes_vigentes` (só o id: o valor o motor lê na hora), `paginas_lidas` (das fitas que o caso diz ter lido, partes juntas), `fontes_importadas` (pedido, pacote da empresa e tabela de leis) e, de extra, `pacote_da_empresa` e `pedido`;
- `resposta`: o campo `resposta` do caso, em texto JSON; a variante do caso (`variante:`) é aplicada ao pedido antes de tudo.

Onde o formato do caso não casa com o do validador, a conversão está em `spec_helena/caso.py` (comentada) e o que sobra de diferença está escrito, com o motivo, em `tests/test_casos_da_spec.py` (`DIVERGENCIAS_EM_CASOS_BONS`, `FUROS_CONHECIDOS`).

## Como implementar uma CHK da especificação (guia curto)

1. Ache a CHK em `helena-v2/deliverables/<tipo>.yaml`, `checagens_codigo`: id, descrição, gravidade, furos e `parametros`. A especificação manda; o código não copia números nem listas dela.
2. Crie `validador/checagens/<tipo>.py` (um arquivo por tipo). Todo `.py` dessa pasta é achado sozinho: não há lista para atualizar.
3. Registre a função com `@checagem("CHK-COPY-01", nome, o_que_fecha, [furos])`: **mesmo id, mesma gravidade e mesmos furos** da especificação (um teste confere).
4. Leia os números e listas com `exe.parametros("CHK-COPY-01")`: é o bloco `parametros` do YAML, entregue pelo adaptador. O pacote da empresa está em `exe.contexto["pacote_da_empresa"]`, o pedido em `exe.contexto["pedido"]`, as fontes em `exe.fontes`.
5. A função devolve `None` (não se aplica), `[]` (passou) ou uma lista de `Falha` com o item exato do problema.
6. Os casos de `helena-v2/casos/` já provam a CHK: apague o id dela da lista `ADIADAS` em `tests/test_casos_da_spec.py` e rode `python -m pytest tests/test_casos_da_spec.py -q`. Se o defeito dela não for pego, o teste falha.
7. Mantenha a regra de sempre (acima): um defeito em `tests/casos/`, uma honesta que passe e a linha na tabela de checagens.
8. Por fim rode `python -m spec_helena --atualizar-readme` (atualiza o quadro de cobertura abaixo).

## Arquivos

```
validador/            o código de produção (só a biblioteca padrão; um módulo pequeno por assunto)
  checagens/          as checagens, um arquivo por assunto ou por tipo (achados sozinhos)
  dados/              leis.json, temas.json, termos_de_ganho.json, configuracao.json
  expressao.py        avaliador seguro de fórmulas
spec_helena/          ponte com helena-v2/ (PyYAML): modelo, contexto, casos, prova e quadro de cobertura
tests/                banco de casos (casos/), casos da especificação, mutações, unidade, CLI, desempenho, robustez
exemplos/             respostas e contextos prontos para o comando validar
```

## Cobertura das checagens da especificação

Gerado por `python -m spec_helena` (não edite a mão: `python -m spec_helena --atualizar-readme`; um teste confere que está em dia).

<!-- COBERTURA -->
O portão 1 cobre 8 de 78 checagens citadas pelas entregas dos agentes do primeiro card; as demais estão marcadas FUTURA; a rubrica (RUB-...) é do revisor, não do código.

| Tipo | Cobertas | Estado |
|---|---|---|
| comuns (valem para todo tipo) | 8 de 10 | IMPLEMENTADA: CHK-COMUM-01, CHK-COMUM-03 a 07, CHK-COMUM-09, CHK-COMUM-10; FUTURA (no código, mas sem defeito da especificação que a prove): CHK-COMUM-02, CHK-COMUM-08 |
| copy | 0 de 10 | FUTURA (checagem ainda não implementada): CHK-COPY-01 a 10 |
| roteiro_treinamento | 0 de 10 | FUTURA (checagem ainda não implementada): CHK-TREINO-01 a 10 |
| calculo | 0 de 12 | FUTURA (checagem ainda não implementada): CHK-CALCULO-01 a 12 |
| parecer | 0 de 18 | FUTURA (checagem ainda não implementada): CHK-PARECER-SO-SECOES, CHK-PARECER-TAMANHO, CHK-PARECER-PECAS, CHK-PARECER-SEMAFORO, CHK-PARECER-AJUSTE, CHK-PARECER-TRECHO-DA-PECA, CHK-PARECER-PASSOS-FIXOS, CHK-PARECER-TEMAS, CHK-PARECER-FUNDAMENTOS, CHK-PARECER-CONDICOES, CHK-PARECER-ADVOGADO, CHK-PARECER-SEM-GARANTIA, CHK-PARECER-TERMO-DO-PACOTE, CHK-PARECER-LEI-NA-TABELA, CHK-PARECER-LEI-NAO-CONFERIDA, CHK-PARECER-NOTA-DE-JURISPRUDENCIA, CHK-PARECER-TERMOS-INTEIROS, CHK-PARECER-AUSENCIA |
| relatorio_final | 0 de 10 | FUTURA (checagem ainda não implementada): CHK-REL-SO-SECOES, CHK-REL-TAMANHO-DAS-LINHAS, CHK-REL-ORDEM, CHK-REL-SEM-CODIGO, CHK-REL-SEM-OTIMISMO, CHK-REL-PACOTE, CHK-REL-REFS, CHK-REL-NUMEROS, CHK-REL-RISCO-ALTO-NO-RESUMO, CHK-REL-SEM-ACAO-NOVA |
| dossie | 0 de 8 | FUTURA (checagem ainda não implementada): CHK-DOSSIE-FORMA, CHK-DOSSIE-ENTIDADE, CHK-DOSSIE-FATOS, CHK-DOSSIE-SEPARACAO, CHK-DOSSIE-LACUNAS, CHK-DOSSIE-AUSENCIA, CHK-DOSSIE-SEM-PROMESSA-DE-RENDA, CHK-DOSSIE-SEM-ACAO-EXTERNA |
<!-- /COBERTURA -->
