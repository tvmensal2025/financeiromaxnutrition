## Qualidade em 3 portões

Cada entrega passa por três portões, do mais barato ao mais caro. O revisor só gasta tempo com o que já está bem formado, e você só vê o que tem risco.

**Vale para os 21 agentes, não só para os 5 primeiros (novo na v3.1).** Cada serviço de cada agente tem as suas checagens, a sua rubrica e os seus casos, escritos e provados na especificação da fase 1. O serviço é sempre o mesmo para as 4 empresas (iGreen, Saúde, Humano Digital e eLiving™). A empresa chega como contexto do card e não cria uma régua diferente. Na produção, os serviços ligam um por vez, pelos portões, porque a cota do ChatGPT, a VPS e o seu tempo de leitura são limitados (veja "Estados de qualidade", mais abaixo).

1. **Validador automático** (código, instantâneo, sem custo). Recusa na hora, apontando o item exato e o número da checagem, se:
   - faltar seção do modelo, passar do tamanho, não estiver em português ou tiver código de página (HTML);
   - a entrega não chegar pela ferramenta de ação tipada (um formulário fechado, com campos definidos, que o nosso servidor confere na hora). Uma resposta em texto solto, sem os campos, conta como "formato errado" (novo na v3.1, MEL-27). O formato do canal e as três regras do agente que ele muda estão em "O agente" e na lista de "Resposta direta". Se o dia de prova da fase 2 mostrar que o Hermes não respeita a ferramenta, o canal volta a ser o texto final conferido, e essa decisão fica registrada;
   - uma afirmação vier sem citação e fonte, ou se a citação não for um trecho contínuo, de pelo menos 12 palavras ou uma frase inteira, de uma página que o agente leu nesta execução pela nossa ferramenta (a tradução vai num campo à parte, e a citação original é a conferida);
   - a fonte chamada de oficial não for do mesmo site do link do pedido, ou uma frase como "a página não fala de X" vier sem os termos buscados e sem a leitura de todas as partes; no jurídico, os termos de uso precisam ter sido lidos por inteiro;
   - um número do Caio não bater: ele preenche um modelo de cálculo com entradas e fórmulas, e o código refaz cada conta; toda entrada diz a origem (dado seu, fonte citada com data ou premissa dele), e câmbio só vale com fonte datada ou dado seu (mudou na v3.1: a conta deixa de ser texto em seções, como está hoje na especificação, e passa a ser uma fórmula fechada que o código refaz);
   - uma lei citada não estiver na tabela de leis (logo abaixo), com o texto oficial, a data e as notas de jurisprudência, ou se o artigo vier sem o trecho da tabela citado junto; lei fora da tabela chega marcada "não conferida", e um artigo usado sem a nota de jurisprudência dele, como o 19 do Marco Civil, chega marcado;
   - um tema obrigatório do serviço ficar sem resposta (lista na tabela abaixo);
   - o convite tiver qualquer termo de ganho (reais, dólares, renda, ganho, "por hora" e parecidos) ou qualquer número de dinheiro, de percentual, de renda ou de prazo de retorno (mudou na v3.1: além das palavras, o convite também não leva números desse tipo). A etapa do convite nem recebe os números do Caio: o convite (E3) deixa de depender do cálculo (E1), o que hoje ainda está errado na especificação. A orientação da ficha da Isabela de usar "valores como estimativa variável" sai, porque contradiz esta regra;
   - o texto disser que o agente fez algo de fora, como "enviei" ou "cadastrei".
2. **Revisor com rubrica** (IA). Para cada critério, o revisor responde uma de três coisas: APROVADO, REPROVADO ou NÃO CONSIGO CONFERIR, sempre apontando a prova. O código confere que o trecho apontado existe, letra por letra (mudou na v3.1: antes eram só duas respostas, e um revisor sem saída tende a aprovar o que não conseguiu conferir; MEL-29). Ele vê o parágrafo inteiro em volta de cada citação, tirado pelo código da página lida, e nunca recebe a conversa do autor (novo na v3.1: o teste 3 confere isso). O revisor nunca é o autor, e cada restrição do seu pedido vira um critério. No jurídico, você é o segundo revisor: o card marca "leia antes de agir".
3. **Você**, só no plano da meta e em ação externa, e também quando o serviço estiver em estágio (veja "Estados de qualidade"). Chega como cartão pronto para decidir.

**O que o "não consigo conferir" faz (novo na v3.1).** Ele nunca aprova. O código decide o caminho, não o revisor:

| Situação do critério | O que acontece |
| --- | --- |
| A prova falta na própria entrega | É defeito do autor: conta como reprovação e volta para ele, com o item exato |
| A prova está fora do alcance do revisor, e o risco do critério é alto | Vira um cartão de revisão para você, com o texto montado pelo código (nunca com as palavras do revisor, porque quem leu a internet não pode fazer chegar texto plantado até você) |
| A prova está fora do alcance do revisor, e o risco do critério é baixo | Segue, mas fica marcado "sem conferir" na faixa do card, à vista |

A taxa de "não consigo conferir" de cada revisor é medida. Se passar de 20% num critério, o critério é reescrito, para não virar uma fábrica de perguntas para você.

### O "pronto" em 3 camadas, todas com número (novo na v3.1, MEL-29)

| Camada | O que é | Quem confere | Onde fica |
| --- | --- | --- | --- |
| Tipo de entrega | As checagens de código daquele tipo (citação, conta, lei, convite e assim por diante) | O validador | Uma função por checagem, com número fixo |
| Serviço | A rubrica do serviço: até 8 critérios, cada um com o risco (alto ou baixo) e a prova exigida | O revisor | Dentro do próprio modelo do serviço, sem uma pasta nova a mais |
| Card | O "como é o pronto" que você deu ao pedir: itens numerados, marcados como conferidos pelo código, pela IA ou por você | Código, revisor ou você, conforme a marca | No card; confirmado no "Entendi assim" só nos pedidos grandes, como já era |

- **A rubrica não repete o código.** Um critério que o código já confere sai da rubrica. Saber, em geral, se uma frase "dá para conferir por código" não tem solução automática; por isso o validador usa uma lista fechada dos casos conhecidos e um teste com um critério plantado que precisa ser recusado.
- **Você não vira gargalo.** Itens do card marcados para você têm um limite por card, definido na ficha do serviço na fase 1 e calibrado na fase 3.
- **A tabela de passagens recebe o resultado já calculado.** O código transforma os vereditos de todos os critérios num resumo só (aprovar, reprovar ou cartão para você), com a precedência acima, e só esse resumo entra na tabela. Isso já aparece no vocabulário da máquina de passagens em construção, e mantém a prova da tabela do tamanho que ela consegue percorrer.

### Tabela de leis e temas obrigatórios

A tabela de leis guarda, para cada lei, o texto oficial, a data em que foi copiado e as notas de jurisprudência dos artigos que o serviço usa (mudou na v3.1: a tabela e os temas passam a existir na especificação, onde hoje estão ausentes, e ganham uma linha para a primeira meta).

| Lei | Para que o serviço usa | Situação |
| --- | --- | --- |
| LGPD | Dados pessoais, dado sensível, base legal, guarda e exclusão | Na tabela desde a v3 |
| Código Civil | Imagem, voz e contratos | Na tabela desde a v3 |
| Lei 9.610/98 | Direito autoral | Na tabela desde a v3 |
| Marco Civil da Internet | Responsabilidade de plataformas; o art. 19 exige a nota de jurisprudência | Na tabela desde a v3 |
| CDC | Publicidade e oferta ao consumidor | Na tabela desde a v3 |
| CLT | Vínculo de trabalho | Na tabela desde a v3 |
| ECA Digital | Menores | Na tabela desde a v3 |
| Lei 15.123/2025 | Aumento de pena para quem altera com IA a imagem ou a voz de uma mulher | Na tabela desde a v3 |
| Lei 1.521/51, art. 2º, IX (crimes contra a economia popular, onde se enquadra a pirâmide) | Risco de pirâmide ou de marketing multinível no recrutamento da primeira meta | (novo na v3.1) Entra só depois da pesquisa jurídica, com o texto oficial e a data; até lá, NÃO CONFIRMADO |

| Serviço | Temas obrigatórios (sem resposta, o validador recusa) |
| --- | --- |
| Parecer jurídico (todos os cards) | Imagem, voz, dado sensível, transferência para fora do país, menores, vínculo de trabalho e publicidade |
| Parecer jurídico da primeira meta (novo na v3.1) | Os sete acima, mais: risco de pirâmide ou de marketing multinível (Lei 1.521/51 e CDC) e a linha de LGPD de quem é recrutado: o que se guarda, com que base legal, por quanto tempo e como se apaga |
| Convite | Nenhum termo nem número de ganho (regra do validador acima) |

**Pesquisa jurídica antes do plano da meta (novo na v3.1).** A primeira meta recruta pessoas. Antes de o plano da meta chegar a você, um item de pesquisa levanta, só em fontes oficiais que você aprova antes (o texto das leis no site do Planalto e a orientação da ANPD, por exemplo), o risco de pirâmide e a base de LGPD dos recrutados. O resultado entra na tabela de leis com data. O parecer da Clara (E4) usa essa tabela; ele não substitui a pesquisa.

### Checagens com número e o furo ligado ao teste que o prova (novo na v3.1, MEL-28)

- **Cada checagem é uma função com número fixo.** Cada uma tem pelo menos um caso bom e um caso ruim guardados. O validador das especificações falha se um número citado numa ficha não tiver função, ou se uma função não tiver os seus casos.
- **O registro de furos vira dado.** O registro passa a ser um arquivo de dados, e o texto em `.md` é gerado a partir dele. Cada furo tem uma situação: com conserto escrito, provado, substituído ou não confirmado. "Provado" quer dizer que existe um caso que reproduz o furo e um teste que o recusa.
- **A prova acompanha a fase.** Só se exige a função quando o furo é da fase em curso ou de uma fase já vencida; um furo da fase 2 não reprova a fase 1. Furos que valem em duas fases (como C-10, C-11 e K-22) têm uma prova por fase. Muitos furos se provam por ensaio (quedas, login, VPS, testes 1, 2, 4, 6, 7, 8, 10 e 11), e não por um teste de código; a prova aceita os dois tipos.
- **Contagem em vez de promessa.** O plano mostra quantos furos estão em cada situação. A frase "nenhum furo conhecido em aberto" só volta quando a contagem de abertos for zero (mudou na v3.1: antes "fechado" queria dizer só "tem conserto escrito").
- **Os furos da rodada 3 entram com cuidado.** Os 37 furos do plano antigo são importados, e os que tinham sido dados como fechados por peças que a v3 abandonou (confirmação em todo card, modelo reserva, mensagem repetida por resumo do texto, "passos maior que buscas") voltam a ficar abertos até ganharem prova nova.

**O próprio validador é testado.** Antes de valer, ele precisa recusar citações falsas, cortadas ou de outra cláusula, contas erradas, leis inventadas, sites parecidos e código plantados de propósito, e aceitar citações honestas com aspas e espaços diferentes. Um validador que deixa passar um defeito plantado não vai ao ar. Cada regra nova do validador ganha o seu próprio defeito plantado (novo na v3.1): por exemplo, um convite com "renda" e um convite que depende do cálculo do Caio precisam ser recusados. A conta de hoje também fica certa: o "9 de 9" do validador das fichas são 8 defeitos plantados e 1 teste de que as especificações reais passam (mudou na v3.1).

### Casos com respostas gravadas e regressão em 3 de 3 (novo na v3.1, MEL-31)

"Todo erro vira teste" ganha pasta e formato:

- **Cada caso guarda uma "fita".** A fita são as respostas das ferramentas gravadas (as páginas, as buscas). O mesmo caso pode rodar de novo sem depender da internet daquele dia.
- **Camada A, no GitHub, sem gastar cota.** Testa o nosso código (validador, motor, relatório) com as fitas. Ali repetir dá sempre o mesmo resultado, então basta rodar uma vez.
- **Camada B, na VPS, com o modelo de verdade e as ferramentas simuladas pelas fitas.** Esse modo só existe em teste, e o motor recusa ligar em produção com ele. A cota dessas rodadas sai só da parte reservada a testes, nunca da reserva das tarefas, e cabe ou não cabe conforme o teste 1 medir.
- **Regressão em 3 de 3.** Um caso de regressão (um que já passava) precisa passar nas 3 rodadas. Se a versão atual também falhar nele, o caso é marcado como instável e desce para "capacidade" (casos que só mostram evolução), para não reprovar um modelo idêntico por acaso. Um caso de capacidade sobe para a regressão depois de 5 rodadas seguidas em 3 de 3.
- **Casos da v1 só anônimos e com a sua autorização** no nível de banco (veja "O que pede a sua frase").

**O que escapa aparece.** Uma faixa no topo do card, calculada só pelo código, mostra o que o código conferiu, o que é julgamento da IA e o que ficou sem conferir. A faixa sai dos vereditos de cada critério (mudou na v3.1): nenhum item "sem conferir" aparece como aprovado. A cor também é calculada pelo código: verde quando tudo foi conferido ou aprovado; amarela quando há item de risco baixo sem conferir; vermelha quando há item de risco alto sem conferir ou uma fonte mudou depois da leitura. Se a faixa está vermelha, a frase-resumo da IA nem aparece. A confiança que a IA diz ter não entra na faixa; se aparece no texto, vem marcada como "autoavaliação da IA". Cada pedido de ajuste seu, com o motivo marcado, vira proposta de lição; aprovar não ensina nada sozinho. Todo erro que escapou vira um caso novo na bateria de testes, com a fita dele.

**Jurídico com data.** O card jurídico diz contra qual versão da tabela de leis foi conferido e que não substitui um advogado. Atualizar a tabela é um item com data no manual do mantenedor. Cada lei da tabela mostra a data do texto copiado (novo na v3.1), e uma lei com texto mais antigo que o prazo do manual chega marcada "conferir atualização".

**Troca de modelo escondida.** O ChatGPT não informa qual modelo respondeu de fato. Por isso, toda noite 5 casos fixos rodam com conferência só por código, e duas noites seguidas de falha geram um aviso; uma troca silenciosa só aparece assim. Uma troca de modelo de propósito deixa de decidir pela média (mudou na v3.1: antes passava se a nota caísse no máximo 5 pontos). Agora ela só passa se nenhum caso de regressão que passava em 3 de 3 começar a falhar, com a regra do caso instável acima. A média escondia um caso que passou a errar sempre.

### Estados de qualidade: uma tabela só (novo na v3.1, crítica ponto 5)

As propostas anteriores tinham quatro regras de qualidade que se sobrepunham: o rebaixamento do serviço a cada escape, a observação com 2 escapes em 10, a suspensão do revisor depois do canário e o disjuntor de 3 falhas. Ficava sem resposta, por exemplo, se um único escape rebaixa o serviço. Agora existe uma tabela só, que vai para o `passagens.yaml` na fase 1 e entra na prova em camadas como o resto da tabela. Hoje ela ainda não está no `passagens.yaml` em construção.

Um "escape" é uma entrega aprovada que volta com o motivo "erro de fato", marcado por você com um toque no "Pedir ajuste". O estado vale por serviço (agente mais tipo de entrega), igual para as 4 empresas.

| Estado do serviço | Onde roda | Quem revisa | Como entra | Como sai |
| --- | --- | --- | --- | --- |
| Rascunho ou em teste | Só nos testes; pedidos reais desse serviço seguem para a v1, e o card mostra "rodando na v1" | Ninguém em produção | Nasce assim | O código calcula "apto" (10 casos de regressão em 3 de 3 e o teste 3) e você toca para subir a estágio |
| Estágio | v2, em cards reais | O revisor do serviço e, depois dele, você como revisor final, com o aviso "leia antes de agir" | Seu toque ao subir, ou descida automática por qualidade | 5 cards reais seguidos sem escape: o código calcula "apto" e você toca para subir a ativo |
| Ativo | v2 | O revisor do serviço; você só no plano da meta, em ação externa e no jurídico | Seu toque | Descida automática para estágio (linha 3 abaixo) |
| Pausado | Pedidos novos vão para a v1; o que já estava aberto termina como estava, sem ficar sem dono nem prazo | Como estava | Seu toque | Seu toque |
| Aposentado | Nenhum lugar | Ninguém | Seu toque | Não volta; um serviço novo começa em rascunho |

**O que cada sinal faz, em ordem de precedência.** Quando dois sinais chegam juntos, vale o de cima. Descer é automático, subir sempre pede o seu toque, e nenhum estado deixa etapa sem dono e prazo (regra 1).

| # | Sinal | Efeito | Muda o estado do serviço? |
| --- | --- | --- | --- |
| 1 | Seu toque: pausar, aposentar ou "Pausar tudo" | Vale na hora, sobre tudo o que está abaixo | Sim |
| 2 | Disjuntor de execução: o agente falha 3 vezes seguidas | Pausa só o agente: as etapas dele ficam na fila com um motivo e uma hora para voltar, como já era | Não: é falha de execução, não de qualidade |
| 3 | Disjuntor de qualidade: 2 escapes nas últimas 10 entregas do serviço | Ativo desce para estágio, e você recebe o aviso | Sim |
| 4 | Um escape só | Vira caso novo de regressão, com a fita, e conta no boletim | Não |
| 5 | Par revisor reprovado num tipo (canário que escapou e foi confirmado, ou teste 9 do par) | Aquele revisor deixa de revisar aquele tipo; a reserva assume; se a regra 4 impedir todas as reservas, a revisão vem para você | Não: troca o revisor, não o serviço |
| 6 | Caso de regressão quebrado antes de publicar | A mudança não sai | Não: nada chega à produção |

**Por que um por vez.** Em estágio você lê cada entrega do serviço. Com 21 agentes, ligar vários ao mesmo tempo encheria o seu dia e a cota do ChatGPT, e a VPS roda no máximo 3 agentes juntos. Por isso os 21 ficam prontos na especificação, com ficha, casos e jornada provados na fase 1, mas sobem para a produção um por vez, pelos portões.

### Revisor medido por tipo e vigiado no ar (novo na v3.1, MEL-41)

O teste 9 somava os erros de todos os tipos, e um revisor cego para um tipo podia passar pela soma.

- **Teste 9 por par revisor e tipo de entrega.** Continua valendo o total (pegar pelo menos 27 dos 30 erros e recusar no máximo 2 das 10 limpas) e passa a valer também um piso por par: pegar pelo menos 3 de 5 erros plantados daquele tipo e recusar no máximo 2 de 5 entregas limpas.
- **Tipos de risco alto.** Cada erro plantado precisa ser pego em pelo menos 2 de 3 rodadas. Exigir 3 de 3 de um revisor foi descartado: um revisor bom reprovaria por puro acaso e travaria a fase 3.
- **Canário, fora dos cards de verdade.** Toda noite, um caso com erro plantado roda contra um revisor, fora da fila real, montado pela mesma função que monta o pacote dos cards, para o revisor não ter como distinguir. Se ele deixar o erro passar, roda antes uma prova de confirmação; só se a falha se confirmar o par sai daquele tipo (linha 5 da tabela acima). Canário dentro de card real foi descartado, porque exigiria caminhos novos na tabela e um convite errado poderia chegar a um card de verdade.
- **O que dá para prometer.** Um revisor cego é pego antes de ir ao ar. Uma piora forte depois tende a aparecer em 1 a 2 semanas; uma piora pequena só aparece no próximo teste 9. A cota dos canários sai da parte de testes e é medida no teste 1.
- **Revisor em outro modelo** fica só como experimento da fase 4, porque esbarra na DEC-014 e na regra "sem reserva escondida".

### Boletim só com números do código (novo na v3.1, MEL-42)

O painel mostrava a "aprovação de primeira", que sobe justamente quando o revisor é frouxo.

- **Um boletim por agente e por serviço, calculado pelo código e sempre em números** ("3 de 4", nunca uma nota inventada). A análise chamou de "placar"; aqui o nome é boletim, porque "placar" já é o nome dos 20 casos da troca de modelo.
- **O que entra:** casos de regressão e de capacidade, validador na primeira tentativa, formato errado, reprovação, escapes, chamadas e tempo. Para os revisores: canários pegos e taxa de "não consigo conferir".
- **O tipo do erro é o motivo que você já marca** no "Pedir ajuste" (erro de fato, faltou tema, tom ou formato). Não há classificação em inglês com 14 códigos, nem uma IA classificando cada erro.
- **O resumo semanal é contagem feita pelo código**, nunca um texto escrito pela Helena.
- **Os números de regressão e capacidade ficam no GitHub** e aparecem no cartão de diagnóstico. O app mostra só o que já está no histórico do Supabase, para o GitHub não precisar de uma credencial nova que grave no banco.
- **A "aprovação de primeira" sai do painel e vai para a aba Técnico** (mudou na v3.1).

### O que pede a sua frase nesta seção (novo na v3.1)

A sua frase tem dois níveis: um para o texto do plano e outro para a mudança no banco ou no servidor. A autorização não vence por data: vale até ser usada e só é pedida de novo se a versão, o estado ou o escopo mudarem.

| Item | Frase para o texto do plano | Frase para mudar banco ou servidor |
| --- | --- | --- |
| Checagens com número, rubrica em 3 camadas, casos sintéticos, relatório | Sim, junto com o plano | Não: são só arquivos da especificação |
| Tabela de estados de qualidade e boletim (consulta e campos no banco) | Sim | Sim, na fase 3 |
| Revisor medido por par e canários | Sim | Sim, quando o canário for ligado |
| Rodada real na VPS (camada B) e ler casos da v1 | Sim | Sim: a v1 hoje só é alcançada pelo seu PC, e os casos entram anônimos |
| Fontes oficiais da pesquisa jurídica | Você aprova a lista antes da pesquisa | Não |

## O relatório do card

Quando o card volta, você vê sempre o mesmo formato, montado pelo código a partir dos campos da entrega. Como o agente preenche campos e não desenha a página, o resultado sai organizado todas as vezes, mesmo trocando o modelo.

[embedded content: o card de volta para você · exemplo da meta das 10 pessoas]

- **Topo:** título, empresa (uma das 4: iGreen, Saúde, Humano Digital ou eLiving™), situação, dono e prazo. Logo abaixo, a faixa do código: o que o código conferiu, o que é julgamento da IA, o que ficou sem conferir, o maior risco, a idade das páginas lidas e quanto de cada página foi lido, como "3 de 8 partes". A faixa sai dos vereditos de cada critério, com a cor calculada como em "Qualidade em 3 portões" (mudou na v3.1). A resposta em uma frase só aparece se a faixa não estiver vermelha.
- **Precisa de você:** a decisão com opções, a recomendação e a consequência de cada uma, a lista do que só você faz e as premissas que você precisa confirmar, com o efeito de cada uma no resultado. Um critério de risco alto que o revisor não conseguiu conferir aparece aqui como cartão de revisão, com texto montado pelo código (novo na v3.1).
- **Entregas:** um bloco por entrega, com quem fez, quem revisou e o resumo; o texto completo abre ao clicar.
- **Números, riscos e fontes,** cada um no seu lugar. Embaixo dos números, o app escreve "contas conferidas pelo código; premissas não". Riscos e perguntas de qualquer etapa chegam ao card pelo código, mesmo que o resumo final esqueça deles.
- **Citações:** o original primeiro e a tradução depois, marcada como tradução; numa cláusula de risco alto, os dois lado a lado.
- **Texto seguro:** o que veio da internet aparece como texto simples. Um link mostra o site de destino, e nada de uma página lida roda dentro do app (veja "Texto seguro e trava do navegador", abaixo).
- **Botões:** Aprovar, Pedir ajuste (com o motivo marcado: erro de fato, faltou tema, tom ou formato), Usar como exemplo (só em entrega com tudo conferido) e Cancelar. Eles substituem o 👍/👎, que ainda está na especificação de hoje e sai (mudou na v3.1: a especificação passa a seguir o plano). Cada toque leva a versão do card que você viu; se ele mudou depois que você abriu, o app mostra a versão nova antes de aceitar. Ao aprovar, o código lê de novo cada fonte e avisa se a página mudou desde a leitura.
- **Aba Técnico:** o raio-X de cada passo, para manutenção, e agora também a "aprovação de primeira" do serviço (mudou na v3.1).

### O relatório final da meta (E5), montado pelo código (novo na v3.1, MEL-30)

Hoje a ficha da Helena diz que o relatório final é revisado "pelo código e por 👍/👎". Isso contradiz a regra 9 ("nenhum padrão automático aprova"). Na v3.1 o relatório tem duas partes:

| Parte | Quem faz | O que tem |
| --- | --- | --- |
| Montada pelo código | O código, a partir das entregas aprovadas | As entregas aprovadas, os números com a origem de cada um, todos os riscos e perguntas de todas as etapas, as fontes e a lista do que só você faz |
| Escrita pela Helena | A Helena | Um resumo de até 5 linhas e os próximos passos; cada frase aponta de onde veio, e você vê isso como um link "ver de onde veio", nunca como um código interno |

- **O código confere o relatório.** Toda frase do resumo aponta para uma entrega aprovada; nenhum número do resumo fica sem origem; e todo risco marcado como alto nas entregas aparece no relatório. Para isso, cada entrega passa a ter um campo com o nível do risco (novo na v3.1). As datas dos próximos passos são propostas da Helena e aparecem marcadas assim, para não serem confundidas com números conferidos.
- **O revisor confere só a fidelidade.** A rubrica do relatório tem três critérios: diz o mesmo que as entregas aprovadas, não esconde nenhum risco e respeita as dependências entre as etapas. O revisor não reavalia o mérito de nenhuma entrega e roda sem internet, para não reabrir o mérito nem abrir porta a texto plantado.
- **Regra 4, por extenso, para este caso (mudou na v3.1, e por isso também está na lista de "Resposta direta").** A revisora do relatório é a Clara, com o Caio de reserva. Os dois são autores de uma entrada do próprio relatório: a Clara fez o parecer (E4) e o Caio fez o cálculo (E1). Com 5 agentes isso é inevitável. A regra fica escrita assim: o revisor do relatório pode ter feito uma das entregas que o relatório junta, mas nunca é o autor do relatório (quem escreve é a Helena), e no relatório ele só confere a fidelidade, nunca o mérito, nem o da própria entrega. Se a regra 4 impedir todas as reservas, a revisão vem para você, como já era. Para a reserva funcionar, a ficha do Caio passa a incluir a revisão do relatório (hoje ela não revisa nada).
- **O que dá para prometer.** Você lê quase só uma cópia fiel do que já foi aprovado. O resumo pode sair mais seco do que um texto livre; essa é a troca por um resumo que não inventa.

### Versão vista e app velho aberto no celular (novo na v3.1, MEL-39)

A versão do card que vai em cada toque já existia na v3. Faltava a versão do próprio app: uma aba antiga aberta no celular podia apertar um botão depois que a regra mudou.

- **O app confere a versão** ao voltar ao foco, a cada 5 minutos e antes de cada toque. A versão é um número que só sobe, e não a impressão digital do código, que não tem ordem.
- **Se a versão mudou,** aparece uma faixa "há uma versão nova; recarregue", e os botões de efeito (Aprovar, Pedir ajuste, Usar como exemplo, responder) travam até recarregar. Cancelar e "Pausar tudo" nunca travam, porque são freios.
- **O banco recusa chamadas abaixo da versão mínima,** com a resposta "app desatualizado". Essa conferência fica num lugar só, e não repetida em cada função, para não repetir as guardas espalhadas que se atrapalharam na v1.
- **Voltar nunca tranca o app.** A versão mínima só muda numa publicação, que é o seu toque no EasyPanel, e nunca sobe acima da versão que estava no ar antes dela. Assim, se uma publicação for desfeita, o app anterior continua com todos os botões.
- **A limpeza tem critério medido.** O painel mostra as versões do app usadas nos últimos 7 dias. Uma parte antiga das funções do banco só sai quando nenhuma versão antiga chamou nesse período. Essa limpeza é outra coisa, e não a limpeza da noite das execuções do motor.

### Texto seguro e trava do navegador num arquivo do repositório (novo na v3.1, MEL-38)

A v3 prometia "uma trava do navegador que bloqueia imagens e scripts de fora", mas não havia nenhum lugar para configurá-la: o repositório não tem arquivo de cabeçalhos do app.

- **Primeiro, só lendo, confirmar quem serve o app** que o seu celular abre. A verificação indica o EasyPanel, na VPS, mas isso está NÃO CONFIRMADO até essa leitura.
- **A trava vira um arquivo do repositório,** testado como o resto: a imagem do app passa a ser servida com uma configuração própria, que define a lista de origens liberadas (a trava do navegador, chamada CSP) e os outros cabeçalhos de proteção, como proibir que o app seja aberto dentro de outro site. O arquivo `.dockerignore` (a lista do que não entra na montagem) impede que um arquivo local de testes, como o que liga o modo sem senha, entre no app.
- **Sempre a versão nova.** O app inteiro vai com a ordem de não guardar cópia, e só os arquivos de `/assets/` (que mudam de nome a cada versão) ficam guardados no celular. Assim o celular nunca fica preso numa versão velha.
- **A lista de origens sai do que o app usa de verdade.** Hoje, segundo a verificação da rodada 5, isso inclui: o próprio app, o Supabase (pelos dois caminhos, o normal e o de tempo real), o Gateway principal e o reserva, o armazenamento R2 das imagens da galeria e da Identidade, as fontes do Google, os estilos em linha do gráfico e os áudios e arquivos gerados no próprio aparelho. Uma lista apertada demais quebraria telas da v1, que divide o mesmo app.
- **Liga por teste, não por data** (mudou em relação à análise: os "7 dias só registrando" foram descartados, porque decidem por data e, sem um coletor de relatórios, só apareceriam no console do celular, que ninguém olha). Primeiro a trava roda em modo registro; o teste desse modo confere que todas as telas abrem sem nenhuma violação. Ela passa a bloquear quando, nesse modo, o teste confere que todas as telas abrem e que uma imagem externa plantada é bloqueada. O teste 11 repete isso toda semana.
- **A frase medida.** Uma imagem ou um script de uma origem fora da lista não carrega no app. O que vem das origens liberadas carrega, e por isso a trava não protege contra algo plantado nelas. A primeira defesa continua sendo o texto seguro: tudo o que vem da internet ou de uma IA aparece como texto simples, sem imagem, sem código de página e com link só para uma página lida na tarefa, mostrando o site.
- **Sua frase.** A troca de como o app é servido no EasyPanel é mudança de servidor, então pede a sua frase no nível de servidor. Ela vai na mesma mensagem do caminho de publicar, e não como um pedido separado.

| Item do relatório | Frase para o texto do plano | Frase para mudar banco ou servidor |
| --- | --- | --- |
| Relatório E5 montado pelo código e a regra 4 por extenso | Sim, junto com o plano | Não: são arquivos da especificação |
| Versão do app e versão mínima no banco | Sim | Sim, junto com as funções do trilho, na fase 2 |
| Trava do navegador e troca de como o app é servido | Sim | Sim, na mesma mensagem do caminho de publicar |

