# Theo, o engenheiro da Helena (rascunho de 17/10/2026)

O que é: o desenho, ainda em RASCUNHO e nada ativo, do agente THEO (AGT-09, Tecnologia) como engenheiro do sistema, no modelo
**"Constrói, você aprova"**, decidido pelo fundador em 17/10/2026. Esta página diz o que ele pode e não pode, o caminho de um pedido,
o que falta para ligá-lo e o passo a passo para o fundador ativar depois. É fotografia do repositório, não consulta do banco nem da
VPS: o que depende de produção está **NÃO CONFIRMADO**. Os guias dos módulos ficam ao lado: `01-site.md`, `02-banco.md` e
`03-motor-e-agentes.md`, nesta mesma pasta (estão sendo escritos por outros agentes; os caminhos valem desde já).

Como mudar: o que o Theo faz está em `helena-v2/servicos.yaml` (serviço `SRV-ENGENHARIA`), `helena-v2/agents/theo.yaml` (a ficha) e
`helena-v2/deliverables/mudanca_de_codigo.yaml` (o formato da entrega, as 10 checagens de código e a rubrica do revisor). Mude lá, rode
`python helena-v2/validar.py` e `python -m pytest -q` em `helena-v2/` e em `motor/validador/`, e atualize esta página. Nunca escreva
valor de senha, token, chave ou código de recuperação aqui: só nomes e locais.

## 1. A decisão em uma frase

O Theo deve entender cada módulo do sistema e poder **construir e ajustar qualquer coisa**: ele escreve a mudança pronta (código,
testes e texto do PR) e **você aprova** o merge e a publicação. Nada vai ao ar sem a sua aprovação. O agente nunca grava tabela e nunca
faz commit: é o princípio da v2 ("o agente só escreve conteúdo; quem executa é o código/motor").

## 2. O que o Theo pode e o que não pode

| Pode | Não pode (nunca) |
|---|---|
| Ler o **Manual do Programador** (`docs/manual/programador/01-site.md`, `02-banco.md`, `03-motor-e-agentes.md`) e os trechos de arquivo que o card traz | Ler o repositório por conta própria: ele não tem ferramenta (`ferramentas: []`). O repositório chega ao card como fonte importada |
| Escrever, **como texto**, a mudança: arquivos tocados, diff completo, testes novos ou alterados e como rodá-los, riscos, como reverter e o texto do PR | Fazer commit, push, abrir PR, mesclar, fazer deploy, publicar, instalar algo ou **dizer que fez**. Escrita no GitHub por agente **não existe** e só pode nascer com decisão sua |
| Propor, antes de construir, alternativas com custo, risco e manutenção (`SRV-PROPOSTA-TECNICA`) | Gravar em tabela, chamar o banco, a VPS ou um serviço, ligar job ou recorrência, rotacionar credencial |
| Perguntar uma vez, em escolha A/B/C, quando falta só o comando de teste | Mexer em `services/`, `scripts/` ou `supabase/migrations/` sem a **frase exata do fundador** (DEC-028) |
| Devolver o pedido dizendo o destino certo (outro serviço, ou "divida em mudanças menores") | **Aplicar ou rodar migration**. Se você autorizar por escrito, ele escreve o arquivo, e quem aplica é você |
| Registrar falha dizendo o que falta (o manual, o conteúdo de um arquivo) | Inventar o conteúdo de um arquivo, uma API ou o resultado de um teste; dizer que rodou ou testou algo |
| Revisar o plano de testes do Bruno, quando a aptidão dele estiver APTA (hoje nenhuma) | Escrever, copiar ou mostrar **valor** de segredo (só o nome da variável e o local); criar arquivo de segredo |
| | Refatorar, reformatar ou acrescentar dependência "de carona"; passar de 10 arquivos ou 400 linhas |
| | Restaurar a v1 em bloco, ligar serviço por inferência, tratar CONECTADO ou CONFIGURADA como em operação |

As regras de ouro da ficha: (1) zona protegida só com a sua frase; (2) migration nunca aplicada por agente; (3) segredo só por nome;
(4) testes primeiro (um teste que falha antes e passa depois); (5) mudança mínima; (6) o Theo diz o que **não** verificou.

## 3. O fluxo de um pedido

```text
você ─ pedido ─> card SRV-ENGENHARIA ─> Theo escreve a entrega "mudanca_de_codigo" (só texto)
                                        │  portão 1 (código): formato, diff aplicável, zona protegida, segredo, teste, tamanho
                                        ▼
                         revisor Bruno (reserva Nina) confere a rubrica
                                        │  você é a última reserva; nenhum padrão aprova
                                        ▼
                  você revisa o card (enquanto o serviço estiver em ESTAGIO)
                                        │
                                        ▼   FORA DA ESTEIRA
   quem aplica o patch em branch/PR  ─>  você faz o merge e manda publicar (aprovar o merge é seu)
   (HOJE um humano ou uma IA de código)
```

1. **Pedido.** Você pede pela entrada do site (ou, no futuro, pelo Telegram). O código que abre o card copia para ele os arquivos que
   a mudança vai tocar (`FON-ARQ-<card>-<n>`) e o Manual do Programador (`FON-MANUAL-PROGRAMADOR`), antes de qualquer IA.
2. **Card.** A Helena lê de volta ("entendi assim"), você confirma. A etapa é `SRV-ENGENHARIA`, dona THEO.
3. **Entrega.** O Theo devolve um texto com estas seções (`deliverables/mudanca_de_codigo.yaml`): objetivo, base (como os arquivos estão
   hoje, com trecho literal), arquivos, frase do fundador (só se houver zona protegida), diff completo, testes (com comando e "falha
   antes"), riscos, reversão, o que não foi verificado, título e corpo do PR. Sem nenhum segredo.
4. **Revisão.** O código confere o que sabe conferir; o Bruno confere o que só se lê (a rubrica de oito perguntas). O revisor nunca
   é o autor.
5. **Você aprova.** Enquanto o serviço estiver em **ESTAGIO**, você é revisor a mais em todo card (aprova ou pede ajuste): é assim que
   o seu "aprovo" fica registrado no card, já que o catálogo não tem ação formal de aprovar o merge (seção 4). **Recomendação: não
   promova o `SRV-ENGENHARIA` a ATIVO.** Em ATIVO o card fica PRONTO sem o seu toque; o merge continuaria seu, mas o sistema não
   registraria a sua aprovação.
6. **Quem aplica o patch.** Hoje, **um humano ou uma IA de código** (por exemplo uma sessão do Claude Code ou do Codex), fora da
   esteira: aplica o diff numa branch, roda o comando da seção testes, abre o PR e traz o resultado. Você faz o merge e manda publicar.
   **GitHub com escrita por agente não existe** e não deve ser criado sem uma decisão sua.

Importante: aprovar a entrega (o texto) **não** é fazer o merge nem publicar. O merge e a publicação continuam sendo sua decisão, depois que quem
aplicou o patch trouxer o resultado dos testes.

## 4. O que a regra do catálogo mudou no pedido (leia antes de decidir)

O validador do catálogo (`helena-v2/validar.py`) impôs três desvios do que foi pedido. Todos estão escritos no código e podem ser
revistos por você.

| Pedido | O que ficou | Por quê |
|---|---|---|
| Ação do fundador `AF-ENGENHARIA-APROVAR-MERGE` junto com `julgado_pelo_parecer: NUNCA` | **Sem ação do fundador no catálogo**; `julgado_pelo_parecer: NUNCA` mantido | **MAT-22**: toda ação do fundador exige "sempre julgado pelo parecer da Clara" (e o tipo em `julga_tipos`); **MAT-11**: `SO_FUNDADOR` só existe com ação. As duas coisas não convivem. Aprovar o merge continua sendo seu, só que fora do catálogo: o seu toque como revisor a mais em ESTAGIO e, depois, o merge (seção 3). Se quiser a ação formal: ponha `mudanca_de_codigo` em `julga_tipos` do `SRV-PARECER`, `julgado_pelo_parecer: SEMPRE`, a ação `[PUBLICACAO]` com `SO_FUNDADOR` e o id nas listas de `schemas/`. Custo: **todo card de engenharia passaria a ter parecer da Clara** e o seu Aprovar como segundo revisor |
| Revisor titular BRUNO | Mantido, mas o **Bruno liga no mesmo passo do Theo** (passo 16 da ordem de ativação; antes era o 17) | **MAT-12**: o revisor titular liga no passo do dono ou antes. O Theo já é titular do plano de testes do Bruno, então os dois só podem estar no mesmo passo: ligam juntos |
| Só `deliverables/mudanca_de_codigo.yaml` | Mais três **pendências conhecidas** em `helena-v2/PENDENCIAS.yaml` para o `SRV-PROPOSTA-TECNICA` | Dar ficha ao Theo obriga a ficha a listar também o serviço que ele já tinha (`SRV-PROPOSTA-TECNICA`), e o validador exige para todo serviço de agente com ficha o tipo de entrega e os casos de prova. Eles ainda não existem (nem faziam parte do pedido). Saem da lista quando alguém escrever `deliverables/proposta_tecnica.yaml` e 3 casos bons e 4 defeitos |

Escolhas minhas, fáceis de trocar: `modelo_menor: NUNCA` no `SRV-ENGENHARIA` (código não roda no modelo menor da cota); uma vaga de
trabalho para o Theo; `pode_ser_pulada: true` (um roteiro pode marcar a engenharia como opcional); empresas: as quatro (o serviço é
RASCUNHO, então o pacote de voz ainda não é exigido).

## 5. Estado hoje (17/10/2026, leitura do repositório)

| Peça | Estado | Onde |
|---|---|---|
| Serviço `SRV-ENGENHARIA` | RASCUNHO, fase 4 (não recebe card) | `helena-v2/servicos.yaml` |
| Agente Theo | PAUSADO, passo 16 (junto com o Bruno) | `helena-v2/organograma.yaml`, `agents/theo.yaml` |
| Ficha do Theo | **Existe** (rascunho), valida | `helena-v2/agents/theo.yaml` |
| Formato da entrega | **Existe**: 11 seções, 10 checagens de código, rubrica de 8 critérios | `helena-v2/deliverables/mudanca_de_codigo.yaml` |
| Casos de prova | 14 escritos (3 bons, 11 com defeito plantado), nunca rodados com modelo real | `helena-v2/casos/SRV-ENGENHARIA/` |
| Checagens de código | **0 de 10 implementadas**; ficam na fila `ADIADAS` | `motor/validador/tests/adiadas/tipo_engenharia.py` |
| Aptidão de revisão do Bruno e da Nina em `mudanca_de_codigo` | SEM_PROVA (nunca passou no teste 9) | `helena-v2/servicos.yaml`, `agentes` |
| Ferramenta para ler o repositório | **Não existe** | só `ler_pagina` e `buscar` existem, e não leem o repositório |
| Manual do Programador | Em escrita por outros agentes | `docs/manual/programador/01..03` |
| Escrita no GitHub por agente | **Não existe** e não deve ser criada sem decisão sua | |
| Catálogo no banco (revisão ativa) | **NÃO CONFIRMADO**: nada foi consultado nem publicado nesta etapa | |

## 6. O que falta para ativar

Na ordem em que costumam travar:

1. **Manual do Programador pronto** (`01-site.md`, `02-banco.md`, `03-motor-e-agentes.md`) e uma forma de o código do motor montá-lo
   como fonte importada do card (`FON-MANUAL-PROGRAMADOR`), na versão do repositório.
2. **Ferramenta de leitura do repositório, somente leitura.** Hoje o arquivo precisa ser copiado para o card por quem o abre. Uma
   ferramenta nossa nova (`ler_repositorio`, nome sugerido) exige: só LER, lista de caminhos permitida, nenhum arquivo de segredo
   (`.env*`, chaves, `auth.json`), cópia guardada de cada leitura (como a `ler_pagina`), `services/`, `scripts/` e
   `supabase/migrations/` fora da lista sem a sua frase, e mudança no catálogo de ferramentas (`servicos.yaml`,
   `ferramentas_nossas`), no esquema da ficha e na regra FERRAMENTAS do validador. É decisão sua; sem ela o card depende de quem o abre.
3. **Portão 1 para código.** Implementar as 10 `CHK-ENGENHARIA-*` (hoje só especificadas). E resolver um problema que os casos já
   mostraram: o diff passa como texto livre pelas checagens comuns, e **três delas confundem código com texto**: a CHK-COMUM-04 recusa
   marcação de página (`<div>`, `<button>` de uma tela em TSX), a CHK-COMUM-03 pode ler linhas de código com muitas palavras
   em inglês como "texto fora do português", e a CHK-COMUM-05 leria uma mensagem de tela como "enviado com sucesso" dentro do diff como
   "agi fora". É preciso um tipo de campo `codigo` com tratamento próprio, ou aceitar só mudanças sem marcação. Os casos de hoje foram
   escritos para passar (sem marcação, linhas curtas).
4. **Aptidão com casos de teste.** Rodar a bateria do serviço com modelo real (10 casos, 3 de 3, e o teste 3), depois o **teste 9** do
   Bruno em `mudanca_de_codigo` (pega 3 de 5 erros plantados e recusa no máximo 2 de 5 entregas limpas; nos tipos de risco alto, cada
   erro em 2 de 3 rodadas) e o seu toque em "ligar". Os defeitos de revisor (`RUB-ENGENHARIA-*`) ainda não estão no placar do revisor
   (`motor/orquestrador/orquestrador/placar_revisor.py`).
5. **Fechar o `SRV-PROPOSTA-TECNICA`** (tipo de entrega e casos), para tirar as 3 pendências do `PENDENCIAS.yaml`.
6. **Decidir** (seção 4) se quer a ação formal "aprovar merge" com parecer, e **quem aplica o patch** (pessoa ou IA de código, e como o
   resultado dos testes volta ao card). Sem decisão sua, a escrita no GitHub por agente continua inexistente.
7. **Catálogo RASCUNHO → VALIDADA → ATIVA pelas telas**, que exige o banco e a sua autorização (seção 7).
8. **Medir o orçamento.** As estimativas da ficha (900 s para a engenharia; 3 chamadas) são **NÃO CONFIRMADAS** até o dia de prova.
   Também o consumo de cota: o motor ainda não tem contador de cota.

## 7. Passo a passo para o fundador ativar depois

Cada passo mexe em coisa diferente. Faça um por vez e só passe ao seguinte depois de ver o anterior concluído.

1. **Confirme os pré-requisitos da seção 6** (peça a uma IA de código um relato datado; não confie em esta página para o estado de hoje).
2. **Revisão de configuração (tela `/configuracoes`).** O conteúdo novo (ficha do Theo, formato da entrega, catálogo, organograma) só
   chega ao banco como uma **nova revisão**: clone a revisão ativa e cole nela as mudanças, ou importe um JSON com o conteúdo atual de
   `helena-v2/` (a tela aceita arquivo de até 5 MB; **NÃO CONFIRMADO** qual comando gera esse JSON a partir do repositório, peça à IA de
   código). Salve como RASCUNHO.
3. **Peça a validação.** O motor (na VPS) valida com o mesmo `validar.py` e marca `VALIDADA` ou devolve o motivo
   (`python -m orquestrador validar-configuracoes`, ou `bash /root/instalar-motor.sh validar-config` na VPS; veja
   `motor/orquestrador/README.md`). Isso **nunca ativa**.
4. **Ative a revisão validada na tela.** Só você ativa. Cards já abertos continuam na revisão em que nasceram.
5. **Ligue o Theo e o Bruno juntos (passo 16).** O estado do agente é resumo; o que vale é o estado do serviço e a aptidão de revisão.
   Em `SRV-ENGENHARIA`: RASCUNHO → EM_TESTE (bateria) → ESTAGIO (10 casos 3 de 3, o teste 3 e o Bruno APTO). Em estágio, todo card real
   tem você como revisor a mais. **Pare em ESTAGIO**: ATIVO (5 cards reais sem escape) tira o seu toque do card. Cada degrau é um toque seu.
6. **Ligue a aptidão do Bruno** em `mudanca_de_codigo` (teste 9 + seu toque). Sem ela, a lista de revisores do card fica só com você e o
   plano é recusado (MAT-21).
7. **Primeiro card real, pequeno.** Peça uma mudança de texto ou um teste novo (como os casos 02 e 03). Confira o diff, rode você ou a IA de
   código o comando de teste, e só então faça o merge.
8. **Desligar a qualquer momento.** Pause o serviço (disjuntor ou botão); nada em andamento é desfeito. Para reverter o catálogo, ative a
   revisão anterior (há trilha de quem ativou e quando).

## 8. Onde olhar

| Pergunta | Arquivo |
|---|---|
| O que o Theo faz e o que nunca faz | `helena-v2/agents/theo.yaml` |
| O serviço, o revisor, a reserva, o que ele não atende | `helena-v2/servicos.yaml` (`SRV-ENGENHARIA`) |
| Formato da entrega, checagens e rubrica | `helena-v2/deliverables/mudanca_de_codigo.yaml` |
| Exemplos de entrega boa e com defeito | `helena-v2/casos/SRV-ENGENHARIA/` |
| Pendências conhecidas | `helena-v2/PENDENCIAS.yaml` |
| Como a fábrica funciona | `docs/manual/como-a-fabrica-funciona.md` |
| Mapa do sistema e reaproveitamento | `docs/manual/mapa-do-sistema.md`, `docs/manual/mapa-de-reaproveitamento.md` |
| Como mudar sem quebrar | `docs/manual/como-mudar.md` |
| Estado datado e próximo passo | `docs/manual/onde-estamos.md` |
