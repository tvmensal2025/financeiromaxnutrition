## Treinar como funcionário

Você treina os agentes pelos botões e comentários do card, como treinaria um funcionário novo. Nada muda escondido: todo aprendizado vira texto com versão, que você pode ver e desfazer.

**Vale para os 21, cada um no seu serviço** (novo na v3.1). O treino vale para os 21 agentes do centro de serviços, e cada lição ou regra fica presa a um serviço. A empresa do card (iGreen, Saúde, Humano Digital ou eLiving™) é contexto. Uma regra pode valer só para uma empresa, e o agente recebe só as regras da empresa daquele card. iGreen e Saúde ainda não têm voz e proibições registradas (NÃO CONFIRMADO), e o registro é feito com você antes da fase 4. O escopo pessoal da Laura fica à parte: o card pessoal não recebe regra nem pacote de empresa, e as regras dele não vão para as empresas. Sirlene, Doutor Vital, Alex e Rafael são personagens do produto eLiving™, não funcionários, e não são treinados por aqui. Um serviço só começa a aprender quando roda na v2, em estágio ou ativo. Até lá, ele tem a ficha e os casos da especificação, provados na fase 1.

**Três gestos seus e um automático** (mudou na v3.1: a tabela tinha 5 linhas, com 4 gestos seus e 1 automático. "Vale sempre" e "nunca faça isso" viraram um gesto só, MEL-45.)

| Você faz no card | Vira | Vale para |
| --- | --- | --- |
| 1. Pede ajuste com um comentário e o motivo marcado: erro de fato, faltou tema, tom ou formato | Correção daquele resultado e proposta de lição | Este card, na hora. A lição só vale depois da prova de efeito e do seu toque no lote da semana |
| 2. Marca "Guardar como regra" num comentário e escolhe "preferir" ou "nunca" | Regra numerada (RF-001, RF-002…) com as suas palavras, o alcance e a regra antiga que ela substitui, sempre pela mesma checagem de contradição | O alcance que você escolher (já vem marcado o serviço do card). Vale a partir da próxima tarefa, sem publicar |
| 3. Marca "Usar como exemplo" numa entrega toda conferida | Exemplo de ouro com data, que vale 90 dias, até 3 por serviço | As próximas entregas do serviço |
| (automático) A mesma correção se repete 3 vezes | Proposta de mudança na ficha, para você aprovar | Aquele agente, depois da bateria de testes e da publicação com o seu toque |

"Guardar como regra" é uma marcação no comentário, não um botão novo. Os botões do card continuam os mesmos, e um comentário nunca muda o estado do card (novo na v3.1).

A IA não aprende sozinha de uma tarefa para outra. O aprendizado são as regras RF, as lições ativas e os exemplos que o motor entrega em cada tarefa (mudou na v3.1: "o manual" virou "as regras RF"). Toda lição nasce como proposta e fica inativa até provar efeito. Assim, uma devolução injusta não ensina errado sem ninguém ver. Aprovar uma entrega não vira lição: um "sim" apressado não ensina o revisor a aceitar erro.

### Guardar como regra: uma regra, uma checagem (mudou na v3.1)

Na v3, a preferência ("vale sempre") ia para o Manual do fundador sem checagem de contradição. Já a proibição ("nunca faça isso") dependia de a IA reconhecer a frase no meio do texto. Agora as duas são o mesmo tipo de regra, com força diferente, e quem marca a força é você.

- **Tipo.** "Preferir" já vem marcado e orienta o agente e o revisor, mas não barra entrega. "Nunca" barra. Ao escolher "nunca", o app mostra o efeito ("vai barrar entregas que…") e pede confirmação, para um toque errado não travar o serviço.
- **Alcance.** Já vem marcado o serviço do card. Você pode ampliar para a empresa ou restringir a um agente ou só a este card.
- **A mesma checagem para todas.** Antes de valer, a regra nova é comparada com as outras regras, com as decisões vigentes, com as listas "regras" e "nunca" da ficha e com as 13 regras de ferro. Quem aponta a contradição entre textos livres é a IA. Por isso, a checagem aparece marcada como julgamento da IA e pode deixar alguma escapar. Quando ela acusa um conflito, a Helena pergunta qual vale, num cartão de decisão. Ela só pergunta quando há sentido oposto no mesmo alcance. Duas preferências que cabem juntas não geram pergunta.
- **Nada afrouxa uma trava.** Uma regra que tente liberar publicar, contatar ou gastar é recusada, com aviso. A ordem de força está em "Decisões sem contradição", logo abaixo.
- **Quando o código consegue conferir.** Algumas regras "nunca" cabem num formato que o código já aplica, como um termo proibido ou um limite de valor. Essas entram como dado, e o código passa a barrar sem publicar nada: o tipo da checagem é especificação, e o valor é decisão sua (MEL-11). Se a regra não cabe, vira proposta de checagem nova para uma sessão de manutenção, com um teste que prova que ela barra. A checagem só entra no ar pela publicação com o seu toque no EasyPanel. Os testes do GitHub protegem contra erro, não contra uma sessão desviada, e por isso a trava é o seu toque. Até a checagem entrar, a faixa do card mostra a regra como julgamento da IA, e não como conferida pelo código.
- **Exemplo que contraria.** Quando uma regra nasce, os exemplos de ouro do mesmo alcance que vão contra ela ficam suspensos até você decidir. Marcar como exemplo uma entrega que contraria uma regra vigente gera a mesma pergunta.
- **Onde fica.** No Supabase, com versão e histórico, num registro só. Quem grava é o motor, depois do seu toque. Nenhum agente grava regra. O antigo Manual do fundador vira a tela "Preferências do fundador", com a lista das regras "preferir" separada por alcance (MEL-12). No app, você vê, troca ou desfaz cada regra.
- **Não confundir** com a "nova regra ou função" da tabela de manutenção. Aquela é código: nasce desligada e entra pela publicação. A regra RF é palavra sua e vale na próxima tarefa.

### Lição só fica ativa com efeito medido (mudou na v3.1)

Na v3, bastava a lição passar na bateria, ou seja, não quebrar nada. Isso não provava que ela consertava o erro que a criou. Também não havia teto nem validade (MEL-43).

- **Como nasce.** Cada "Pedir ajuste" com motivo vira uma proposta de lição (LIC-0001, LIC-0002…). O texto sai só das suas palavras e do motivo marcado, nunca de uma página lida. Ele passa pelo validador: português, sem link, sem código de página e com até 240 caracteres. Se o seu comentário for maior, a Helena propõe uma versão curta, e o cartão mostra as suas palavras originais ao lado.
- **Entradas congeladas.** Na hora do pedido, o motor guarda três coisas. A primeira é o card. A segunda é a versão do pacote que o agente recebeu: ficha, regras, lições, exemplos e decisões, cada um com a impressão digital (código único da versão). A terceira são as cópias das páginas lidas naquela execução. A prova roda sobre essas cópias, sem ler a internet de novo, para os resultados serem comparáveis.
- **Caso de teste só com conferência por código.** Alguns motivos podem ser conferidos pelo código: erro de fato numa citação ou numa conta, formato, ou tema obrigatório que faltou. Nesses casos nasce também um caso de teste, com a checagem escrita como código. O caso só entra na bateria se o código confirmar que a entrega original falha nele, ou se você confirmar no cartão da semana. Assim, um ajuste injusto não vira um teste que trava as outras lições.
- **Tom não tem prova por código.** O motivo "tom" não gera caso nem prova. Vira sugestão de regra "preferir" ou de exemplo, marcada como "julgamento, sem prova por código".

| Passo da prova | O que roda, de madrugada | Passa quando |
| --- | --- | --- |
| Sem a lição | 3 execuções sobre as entradas congeladas | O erro aparece em 2 ou 3 delas (falha reproduzida) |
| Com a lição | 5 execuções | Passa nas 5 |
| Nada quebrou | Os casos fixos do serviço (até 20), 1 vez cada, comparados com a linha de base (o resultado sem a lição, na mesma noite), só pelas notas que o código confere | Nenhum caso que passava passa a falhar. Se um falhar, roda mais 2 vezes, e outra falha recusa a lição |
| Sem contradição | Comparação com a ficha, as regras RF, as decisões e as outras lições (julgamento da IA, marcado assim) | Nenhum conflito; se a IA acusar um, você escolhe qual vale |

- **Erro que não se repete.** Às vezes o erro aparece só 1 vez em 3 (é intermitente) ou não aparece. A lição não é recusada em silêncio. Ela vai para o cartão da semana com os números e duas saídas: "virar regra de código", em que o validador passa a recusar e pedir nova tentativa, ou "arquivar". O caso, se tiver checagem por código, continua na bateria.
- **O que a prova não garante.** Três e cinco execuções são uma medida, não uma garantia. A prova pega uma piora forte. Uma piora pequena pode aparecer só na próxima rodada completa em 3 de 3, a pass^3 (acertar nas 3 vezes), que roda na troca de modelo e antes de publicar. O cartão sempre mostra os números, como "sem a lição: falhou 2 de 3; com ela: passou 5 de 5", e nunca a palavra "comprovado" sozinha.
- **Teto de 10 lições ativas por serviço.** Cada lição tem um objetivo só. Com o teto cheio, a lição nova só entra substituindo ou juntando uma antiga, e a escolha é sua. A correção que se repete 3 vezes vira proposta de mudança na ficha. Quando ela entra na ficha, a vaga de lição fica livre.
- **Validade de 4 semanas.** A proposta que não for ativada em 4 semanas expira, sempre com o motivo: sem resposta, sem cota para testar ou erro não reproduzido. O caso dela continua protegendo a bateria.
- **Ativar é com você, uma vez por semana.** Um cartão semanal traz as lições prontas em lote, com as suas palavras originais, os números da prova, o histórico e um botão para voltar à versão anterior. Você ativa o lote inteiro ou item a item. Se não tocar, nada quebra: a proposta espera e expira com o motivo "sem resposta". Ativar registra a impressão digital do texto exato que foi testado, e cada execução registra quais lições usou.
- **Lição que envelhece.** A cada troca de modelo ou de ficha do serviço, os casos das lições ativas rodam de novo. A lição que deixar de funcionar fica suspensa e aparece no cartão. Se o caso passar 3 de 3 sem ela, a lição aparece como "talvez desnecessária" e só sai com o seu toque.
- **Estados da lição.** Proposta, em prova, pronta, ativa, suspensa, recusada, expirada e revogada (desligada por você). Esses estados ficam escritos uma vez, como dado, na especificação da fase 1. Hoje, a especificação em construção ainda guarda a lição dentro da ficha, com os gestos antigos e outra régua de prova. Ela se alinha a este texto na fase 1.
- **Cota.** A prova não gasta dinheiro e respeita a DEC-014, mas gasta a cota do ChatGPT. A estimativa é de cerca de 28 execuções por lição (3 sem a lição, 5 com ela e até 20 de regressão), mais a linha de base da noite. As rodadas acontecem de madrugada, na menor prioridade, com o modelo da ficha do serviço. Elas saem de um orçamento noturno fixo, tirado da cota da v2 e medido no teste 1. No primeiro sinal de cota esgotada, a bateria para e tenta de novo na noite seguinte, sem atrasar nenhum card real. Um lote pode levar mais de uma noite. Nada disso roda no GitHub, porque lá exigiria API paga ou um segundo login do ChatGPT.
- **Onde fica.** Lições e casos que nascem de cards reais ficam em tabelas próprias no Supabase, com versão e histórico que só cresce, e entram no backup da noite. As cópias congeladas das páginas ficam no máximo 4 semanas e entram na conta do teste 10. Dado pessoal de terceiros dentro de um caso segue a regra de LGPD da meta: o que se guarda, por quanto tempo e como se apaga. Os casos inventados da especificação ficam no repositório. Um caso real só vai para lá anônimo e com a sua autorização (MEL-31). O motor e os agentes nunca gravam no GitHub.

### Decisões sem contradição

Cada decisão sua diz a que vale (empresa, agente, serviço ou card) e qual decisão antiga substitui. Se uma decisão nova contradiz outra, a Helena pergunta qual vale. Regras duras, como "orçamento até tanto", viram checagem de código, e cada execução registra quais decisões usou.

- **Ordem de força, quando duas se chocam** (novo na v3.1):
  1. as travas do código e as 13 regras de ferro, que nada afrouxa;
  2. as suas decisões e as regras "nunca";
  3. as regras "preferir";
  4. as lições ativas;
  5. os exemplos de ouro.

  Entre duas do mesmo nível, vale a que você marcou como substituta. Sem essa marca, a Helena pergunta antes de valer. Lição e exemplo nunca vencem uma regra ou decisão sua.
- **O valor muda sem publicar** (novo na v3.1). O tipo da checagem ("orçamento até um valor") é especificação. O valor é decisão sua e muda pelo app, já na próxima tarefa (MEL-11).
- **Cada execução registra tudo o que usou** (mudou na v3.1: antes, só as decisões). O registro guarda decisões, regras RF, lições e exemplos, com a versão de cada um. Assim, uma entrega ruim mostra exatamente o que o agente tinha na mão.
- **Uma tabela só de decisões** (novo na v3.1). As decisões ficam na tabela de decisões que já existe no Supabase, sem criar outra (MEL-11). Na especificação de hoje, elas ainda não têm o alcance nem o "substitui" (PARCIAL na conferência). Não está confirmado se a tabela do banco já tem esses campos (NÃO CONFIRMADO). Acrescentá-los é mudança no banco e pede a sua frase.
- **Suas palavras, não as da IA.** O registro de uma decisão guarda as suas palavras e a opção escolhida. O que a IA escreveu entra só como citação curta e marcada.
- **Decisão nova refaz o que dependia dela** (regra 10). O padrão aplicado no fim de uma espera fica registrado como padrão, nunca como decisão sua.

### O que se prova na fase 3 (novo na v3.1)

| Teste | Passa quando |
| --- | --- |
| Lição plantada que não muda nada | É recusada |
| Lição que quebra um caso que passava | É recusada |
| 11ª lição de um serviço | Não é testada; o cartão pede para substituir ou juntar |
| Proposta com 29 dias | Aparece como expirada, com o motivo |
| Botão "voltar" | Restaura a versão anterior da lição |
| Cota esgotada de propósito no meio da bateria | A bateria para, e nenhum card real atrasa |
| Regra "preferir" que contradiz uma "nunca" | Vira pergunta da Helena |
| Regra que tenta liberar publicar, contatar ou gastar | É recusada, com aviso |
| Regra "nunca" de termo proibido | Barra um texto plantado com o termo |
| Regra "preferir" | Não barra nenhuma entrega |
| Regra nova | Vale na tarefa seguinte, sem publicação |
| Exemplo de ouro que contraria uma regra nova | Fica suspenso |
| Exemplo com citação falsa plantada | É recusado; exemplo com mais de 90 dias não é usado |

**Sua frase, em dois níveis** (novo na v3.1). Este texto do plano entra na sua aprovação do plano. Já criar no banco as tabelas de regras, lições e casos é mudança no banco e pede uma frase própria, na fase 3: **autorizo AUT-NNNN: criar no Supabase as tabelas de regras, lições e casos do treino, versão `<código>`**. Depois disso, cada regra, exemplo ou lote de lições é só o seu toque no app.

## Você no comando

Você abre uma tela no app e vê cada agente com luz verde, amarela ou vermelha, o que está fazendo e há quanto tempo. Você só é chamado para decidir.

### O painel

- **Por agente, os 21** (mudou na v3.1: antes eram só os 5 da v2). Para cada um: tarefa atual, fila, última entrega e o estado de cada serviço (rascunho, em teste, estágio, ativo, pausado ou aposentado, MEL-26). Quem ainda não roda em produção aparece em cinza. Os 21 têm ficha, casos e jornada provados na especificação (fase 1). Mesmo assim, ligam em produção um por vez, pelos portões, primeiro em estágio e depois em ativo, porque a cota do ChatGPT e a VPS são limitadas. O painel mostra em que portão cada um está e o que falta, como "7 de 10 casos em 3 de 3" ou "em estágio: 3 de 5". Subir de estado pede o seu toque. Descer de estado não mexe em card que já está em andamento.
- **Qualidade em números** (mudou na v3.1: a "aprovação de primeira" foi para a aba Técnico, porque ela sobe quando o revisor é frouxo, MEL-42). Cada serviço mostra o boletim calculado pelo código, sempre em números, como "9 de 10 sem escape". Escape é uma entrega aprovada que voltou com "erro de fato". O serviço mostra também um estado só, tirado da tabela única de estados de qualidade. Essa tabela junta o disjuntor de falhas, o boletim, a observação e o revisor suspenso, com uma ordem de precedência entre eles.
- **Por meta:** etapas feitas, em andamento e paradas, desenhadas como o plano.
- **Por empresa** (novo na v3.1): um filtro para iGreen, Saúde, Humano Digital e eLiving™, e outro para o escopo pessoal. A empresa é contexto do card, não um time separado.
- **Cota** (novo na v3.1): quanto já foi usado da janela de 5 horas e da semanal, pelo medidor único (MEL-19), que inclui o uso da v1. Essa leitura só vale depois que o dia de prova da fase 2 confirmar que o Hermes informa as duas janelas. Até lá, ela fica NÃO CONFIRMADO.
- **Precisa de você:** uma fila só, com a pergunta mais antiga no topo e há quanto tempo ela espera. O que fica fora do sistema (Hostinger, contas, segredos para colar) vai para a lista "Precisa de você", com prazo e "o que acontece se você não fizer" (MEL-12).
- **Pausar tudo** fica no topo e não trava, mesmo com o app desatualizado (MEL-39).

### Resumo das 18h

Todo dia, às 18h de Brasília, a Helena manda um cartão só: o que foi feito, o que travou, o que precisa de você e as mudanças feitas no sistema.

- **Montado pelo código** (novo na v3.1). Números, cards travados, perguntas abertas, avisos do dia e mudanças no sistema vêm do banco, montados pelo código, como no relatório do card. A Helena escreve só as linhas de destaque, cada uma ligada ao card de onde veio. Se a Helena falhar, o cartão sai do mesmo jeito, só com a parte do código. Assim, o que travou não some só porque o resumo esqueceu.
- **Mudanças no sistema, com lista fixa** (mudou na v3.1). O cartão traz:
  - a versão publicada;
  - as regras RF novas ou trocadas;
  - as lições ativadas, recusadas ou expiradas;
  - os serviços que subiram ou desceram de estado;
  - cada padrão aplicado no lugar de uma resposta sua, marcado como padrão.
- **No Telegram, só uma linha** (novo na v3.1): "resumo pronto, N itens precisam de você". O texto inteiro fica no app.

### Avisos pelo Telegram, com um remetente só (mudou na v3.1)

Na v3, o aviso saía de três lugares: de dentro do Supabase, do motor e do vigia do vigia. Isso obrigava a escrever o reenvio à mão duas vezes e deixava o token (a senha do robô) gravado no banco. E, com o banco só para leitura, o aviso de dentro do Supabase parava junto. Agora cada tipo de problema tem um caminho só (MEL-37).

| Situação | Quem avisa | Por onde chega |
| --- | --- | --- |
| Card atrasado, decisão sua pendente, cota ou login do ChatGPT, regra quebrada, banco perto do limite, mensagem sem classificar (depois da troca do WhatsApp), publicação que não passou na conferência | O motor, lendo a tabela de avisos | Robô Helena, no Telegram |
| Banco fora do ar ou só para leitura | O motor, por um caminho que não passa pelo banco nem pelo DBOS | Robô Helena, no Telegram |
| Motor, VPS, vigia, relógio, backup ou restauração parados | O healthchecks.io (serviço gratuito de fora), pela falta do sinal de vida | HealthchecksBot no Telegram, e e-mail |
| Avisos presos há mais de 15 minutos | O vigia manda um sinal de falha ao healthchecks.io | HealthchecksBot no Telegram, e e-mail |

- **Quem grava não manda.** O vigia e o relógio só gravam o aviso numa tabela. Cada aviso tem uma chave única por tipo, alvo e janela de tempo, para a mesma situação não virar dois avisos. Continua valendo um aviso por regra quebrada a cada 6 horas.
- **Só o motor manda pelo nosso robô.** Ele reenvia com intervalo crescente até o Telegram aceitar. A entrega é "pelo menos uma vez": se o motor cair entre o envio e a marcação, aquele aviso pode chegar repetido. Isso é raro e é melhor do que perder o aviso. Quando o motor volta de uma parada, os avisos acumulados chegam num resumo só.
- **Banco fora não deixa o motor mudo.** Se o banco não responde ou recusa gravação, o motor não reenvia a tabela, porque não consegue marcar o que já mandou. Ele manda o aviso dele, guarda na memória o que enviou, repete a cada 6 horas e retoma a tabela quando o banco volta.
- **De dentro do Supabase sai só sinal de vida** (um aviso curto de "estou funcionando"). É um sinal por tarefa agendada, com o vigia e o relógio separados, mandado no fim de cada volta que terminou bem. O motor manda o dele a cada minuto, e o backup, a cada noite. Cada checagem tem período e tolerância fixados para o aviso chegar em até 15 minutos, porque o padrão do serviço (1 dia mais 1 hora) não serve.
- **Envio travado não fica mudo.** A cada volta, o vigia confere o aviso mais antigo ainda não enviado. Se passou de 15 minutos, ele avisa o healthchecks.io. Isso cobre o motor no ar que não consegue falar com o Telegram, por exemplo com o token revogado.
- **Dois robôs, papéis diferentes.** O "robô Helena" manda os avisos de card. O "HealthchecksBot", robô do próprio healthchecks.io, avisa que alguma peça parou. Você manda /start para ele uma vez, na fase 0b. Não está confirmado se o Telegram está incluído no plano grátis do healthchecks.io (NÃO CONFIRMADO). O e-mail vale de qualquer jeito.
- **Menos segredo no banco.** O token do nosso robô fica só no motor, no EasyPanel, e sai do banco e do roteiro de restauração. Os endereços de sinal de vida ficam no cofre do Supabase e entram na lista de chaves, porque quem tiver um deles pode fingir que o sistema está vivo.
- **Aviso sem conteúdo** (novo na v3.1). O aviso diz o card, a empresa e o que fazer. Ele não leva o texto de uma entrega nem de uma página lida, porque o Telegram fica fora do nosso controle.
- **Padrão só depois do lembrete.** Um padrão que encerra uma espera sua só vale depois que o lembrete anterior foi entregue. Um exemplo é cancelar a etapa depois de 48 horas. Se o lembrete estiver preso, o relógio segura o padrão.
- **Fases 0 e 1, antes de existir o motor.** O robô Helena ainda não existe. Os avisos vêm pelo healthchecks.io (HealthchecksBot e e-mail), e o backup da noite também avisa se o banco passar de 70% (novo na v3.1).
- **Teste mensal dos dois caminhos.** O motor manda um aviso de teste pelo robô Helena, e uma checagem de teste do healthchecks.io recebe uma falha de propósito. Você confirma que recebeu os dois.
- **Risco aceito, dito com clareza.** Com o motor fora, os avisos de card esperam, e você recebe "motor fora" em até 15 minutos pelo healthchecks.io, em dois canais. Com a VPS fora, o app e o WhatsApp também caem, e esse passa a ser o aviso que importa.
- **O teste 7 ganha dois casos.** No primeiro, o motor fica no ar com o Telegram bloqueado para ele. No segundo, o motor é religado depois de 1 hora fora. O teste passa quando o aviso de avisos parados chega em até 15 minutos e os acumulados chegam num aviso só, sem perder nenhum.

### Cartões de decisão

Opções A, B ou C, com a recomendação e a consequência de cada uma. Sua resposta vira uma decisão registrada, com as suas palavras, e chega às etapas seguintes. O que já estava pronto e dependia dela é refeito (regra 10).

- **Texto montado pelo código** (novo na v3.1). O código monta o cartão a partir de campos: opções, recomendação, consequência, custo, como desfazer e o que ficou sem conferir. O cartão não usa as palavras soltas de um revisor nem de uma página lida.
- **A letra é lida pelo código.** Responder A, B ou C vale na hora. Cada toque leva a versão do cartão que você viu. Se ele mudou depois que você abriu, o app mostra a versão nova antes de aceitar.
- **Sem resposta, vale o padrão, nunca uma aprovação.** O padrão fica registrado como padrão, nunca como decisão sua, e nenhum padrão aprova entrega nem ação externa.
- **Ação de fora só no app.** Gasto, cadastro, contato, contrato ou publicação só se aprova no app, nunca pelo WhatsApp. Se a v1 continuar fazendo ligações de saída por IA, cada ligação também precisa de um toque seu (novo na v3.1).
- **Cartões que já estão previstos** (novo na v3.1):
  - o motor: o plano recomenda manter o DBOS, e o cartão mostra a alternativa do motor próprio no Postgres e o que cada uma obriga a escrever à mão;
  - a URA de clientes e a voz paga da v1: exceção escrita ou desligar;
  - as fontes oficiais da pesquisa jurídica da primeira meta;
  - Supabase grátis ou Pro;
  - uma conta separada, sem poder de administração, para as minhas sessões no GitHub;
  - a Hostinger, que chega sem recomendação até você conferir no painel o que vence e quando, porque as fontes que temos se contradizem;
  - as lições da semana;
  - cada serviço que pede para subir de estágio para ativo.

### Suas frases, em dois níveis (novo na v3.1)

- **Nível 1, o texto do plano.** A sua frase de aprovação vale para tudo o que está escrito no plano.
- **Nível 2, mudança no banco ou no servidor.** Cada mudança tem frase própria, numerada no livro de autorizações (AUT), com o que muda, como desfazer e a versão. O livro só registra. Quem trava de fato é o banco e o seu toque.
- **Autorização não vence por data** (mudou na v3.1: saiu a proposta da MEL-10 de vencer em 7 dias). A autorização vale até ser usada. Ela só é pedida de novo se a versão, o estado ou o escopo mudarem, como manda o AGENTS.md. Na dúvida sobre se tudo bate, a sessão pergunta.

### Você não vira gargalo

Um agente só pergunta nos pontos que o serviço prevê, cada card tem um limite de perguntas, e o painel mostra há quanto tempo a mais antiga espera.

- **Limite de perguntas.** Na tabela de passagens em construção, são 2 por card. É um número proposto, que se calibra na fase 3 (novo na v3.1).
- **Até a troca, a IA não decide o tipo das suas mensagens** (novo na v3.1). No app, o tipo vem do botão que você tocou (MEL-25). Texto fora de botão vira comentário e não muda nada.
- **Pedidos juntos.** O que depende de clique seu chega numa mensagem só, e as lições vêm em lote, uma vez por semana. A publicação é pedida no máximo uma vez por dia, com a impressão digital pronta para colar no EasyPanel (mudou na v3.1: o toque saiu do botão do GitHub). Não está confirmado se o EasyPanel aceita a impressão digital (NÃO CONFIRMADO), e isso é conferido no ensaio da fase 2.
- **Pergunta só quando precisa.** Duas regras "preferir" que cabem juntas não geram pergunta. Só gera pergunta o sentido oposto no mesmo alcance.
- **Nada quebra se você não tocar.** Lição sem toque expira com o motivo, e toda espera tem um padrão, que nunca aprova entrega.
- **Um serviço por vez em estágio.** Enquanto um serviço está em estágio, você é revisor a mais dele, até 5 cards reais sem escape. Esse é um dos motivos de os serviços subirem um por vez (novo na v3.1).
- **O que continua com você, de propósito.** Você aprova o plano da meta, toda ação externa e o jurídico, como segundo leitor. Se um serviço entrar num estado de qualidade que pede a sua leitura, o painel mostra quantos estão assim, porque isso aumenta o seu trabalho.

### Antes de a Helena assumir o WhatsApp: o conjunto-ouro (novo na v3.1)

A v3 protegia o efeito de uma classificação errada: desfazer, toque para cancelar e a lista "sem card". Mas nenhum teste media quantas vezes a Helena acerta, e a troca do WhatsApp tinha só "ensaiada antes de valer", sem número. Agora a troca também depende de um acerto medido nas suas mensagens (MEL-44).

- **De onde vêm as 50 mensagens.** A primeira fonte é a caixa de entrada da v2 nas fases 2 e 3, onde cada mensagem já chega com o tipo do botão que você usou. Da v1 entram só mensagens do seu número, e só as que estão inteiras. Quem lê é você, no editor SQL do Supabase (a tela onde se digitam comandos do banco), numa transação só de leitura e com o script pronto. Isso porque as minhas sessões não alcançam o banco e o Windows do seu PC bloqueia o programa do Supabase. Na v1, o código grava as mensagens de entrada cortadas em 500 caracteres e misturadas com as de clientes da URA. Não está confirmado se existem lá 50 mensagens suas inteiras (NÃO CONFIRMADO). Mensagens de clientes ficam fora. Áudio também fica fora, e o resultado diz que o acerto medido vale só para texto.
- **Proporção.** Pelo menos 8 de card novo, 8 de ajuste, 5 de resposta, 5 de cancelamento e 5 de conversa, além de pelo menos 5 de cada empresa. Se faltar mensagem, o conjunto cresce com o uso, e o portão não abre com menos de 50. Se ainda faltar algum tipo, você escolhe num cartão entre esperar ou completar com mensagens escritas para o teste, que ficam marcadas assim.
- **Privacidade.** Antes de tudo, o código tira qualquer mensagem com chave, senha ou token e troca nome, telefone e e-mail de terceiros por marcadores. Para cada mensagem, você responde também "pode entrar no conjunto?". Nenhuma mensagem real vai para o GitHub. Lá ficam só o executor, o formato e casos inventados, como as 30 frases ambíguas do teste do A-10. Nenhuma mensagem do conjunto vira exemplo ou lição da Helena.
- **Você só confirma.** A Helena pré-classifica, e você confirma ou corrige cada mensagem numa lista no app, pelo celular. Isso leva cerca de 10 a 20 minutos, uma vez só. Os rótulos são três:
  - o tipo: card novo, ajuste, resposta, cancelamento ou conversa;
  - o destino: iGreen, Saúde, Humano Digital, eLiving™, pessoal (escopo da Laura) ou "ambígua, perguntar";
  - no ajuste, o card certo, dentro de uma lista fixa de cards abertos montada para aquele caso.

  Na mensagem ambígua, o certo é a Helena perguntar, e chutar conta como erro.
- **Critério, conferido só pelo código.** Cada mensagem roda 3 vezes. O portão fica verde só com 3 de 3 em todas as mensagens, nestes pontos:
  - tipo certo em card novo e ajuste;
  - card certo no ajuste;
  - destino certo, ou pergunta quando a mensagem é ambígua;
  - nenhuma mistura entre pessoal e empresa, porque ela levaria dado seu para o contexto das empresas;
  - nenhum pedido, ajuste, cancelamento ou resposta classificado como conversa, que é o erro que some em silêncio.

  Resposta e cancelamento entram na medida e aparecem no painel, mas não travam o portão, porque já dependem do seu toque. O "como é o pronto" fica fora, por ser texto livre. Ele é medido pelas leituras de volta que você corrige.
- **Medida, não promessa.** O resultado sai escrito como "acerto medido em N mensagens". Zero erro em 50 mensagens quer dizer, com 95% de confiança, que a taxa real de erro fica abaixo de cerca de 6%. Não quer dizer que ela é zero. Por isso, desfazer, o toque para cancelar e a lista "sem card" continuam valendo mesmo com o portão verde.
- **Luna primeiro.** O conjunto roda primeiro no GPT-6 Luna, que rende bem mais mensagens por janela que o Sol. Os números exatos de cota não estão confirmados nesta rodada (NÃO CONFIRMADO). Se o Luna passar, a classificação fica com ele, e o Sol nem roda. Se falhar, roda o Sol. A escolha segue o protocolo de troca de modelo, com 48 horas em observação, e usa um apelido próprio de classificação, sem modelo reserva. As rodadas são de madrugada, na menor prioridade, fora da vaga em que a Helena recebe as suas mensagens, com o uso medido separado do da v1.
- **Quando roda.** Assim que houver 50 mensagens, o conjunto roda uma vez como diagnóstico, sem travar nada. Na fase 4, o verde é condição para a troca de canal, junto com o ensaio da troca. Depois, roda de novo a cada troca de modelo, de ficha da Helena ou de regra de classificação, e 2 ou 3 casos dele entram nos 5 casos fixos da noite.
- **Cresce com os erros reais.** Cada classificação que você desfaz pede um toque seu: "era o quê?". Só com o rótulo certo ela entra no conjunto, até o limite de 100 mensagens; passar disso é decisão sua. Um caso novo não desfaz uma troca já feita. Depois de corrigido, porém, ele passa a travar qualquer nova troca de modelo ou de instrução da Helena. O painel mostra quantas classificações você desfez por semana.
- **Duas frases.** Gravar o conjunto no banco é mudança no banco: **autorizo AUT-NNNN: gravar no Supabase o conjunto-ouro das minhas mensagens, versão `<código>`**. A troca do WhatsApp continua com a frase própria dela, depois do portão. O que acontece com a URA de clientes da v1 na troca é decidido no cartão da URA.
