## O agente: uma função com ações tipadas

(mudou na v3.1: o título era "uma função com 5 ações". As 5 ações continuam as mesmas; o que muda é como elas chegam ao motor. Antes, o agente as escrevia no texto final. Agora, ele chama uma ferramenta do nosso servidor, com formato fechado.)

O agente recebe o pacote do card e devolve exatamente uma das 5 ações do autor, num formato conferido. O revisor, a Helena e você têm as respostas de cada papel na mesma tabela de passagens. Qualquer outra resposta conta como formato errado e volta com o motivo.

Isso vale igual para os 21 agentes (novo na v3.1). Cada agente tem um serviço próprio no catálogo de serviços. A ficha de cada serviço diz quais das 5 ações ele pode usar e qual o efeito de cada ferramenta (ler, gravar dentro ou agir fora). Hoje esse campo ainda não existe no esquema da ficha (conferência, item 10: AUSENTE), e ele entra na fase 1.

| Ação | Para que serve | O que o código confere | Na v2.0 |
| --- | --- | --- | --- |
| Entregar | Devolver o trabalho pronto | Modelo do serviço, tamanho, fontes e critério de pronto, campo por campo (a citação aponta para a cópia guardada da página, e a conta vem em forma fechada, que o código refaz) | Ligada |
| Pedir sub-card | Passar uma parte para outro agente | O serviço está no catálogo, o agente existe, não é ele mesmo, cabe no orçamento e não forma ciclo | **Desligada até a fase 4** (mudou na v3.1, MEL-24) |
| Perguntar | Tirar uma dúvida que só você responde | Vai pela Helena, com 2 ou 3 opções, dentro do limite de perguntas do card; o card espera com dono e prazo | Ligada |
| Devolver a quem pediu | Pedido impossível ou ambíguo | Motivo obrigatório. Sem sub-card, quem pediu é o próprio card, e a devolução vira um cartão de resolução para você (mudou na v3.1) | Ligada |
| Registrar falha | Não dá para fazer | Um de 3 motivos: não consigo, faltam dados ou fonte insuficiente; sempre conta como tentativa | Ligada |

### O que muda na v2.0: sub-card desligado e plano só por roteiro (novo na v3.1, MEL-24)

Na v3, a Helena propunha o plano do card, podia replanejar, uma etapa podia ser dividida no meio da execução, e o agente podia pedir sub-card. Isso deixava a IA decidindo o caminho do card. Um caminho escrito por IA não dá para provar por inteiro antes de ir ao ar, porque ele só existe depois que a IA o escreve. A primeira meta não precisa de nada disso: o roteiro das 10 pessoas já é fixo, de E1 a E5.

Por isso, na v2.0:

- **Todo card nasce de um roteiro do catálogo.** O roteiro é escolhido numa lista fechada. O desenho das etapas (quem faz o quê, em que ordem e com que revisor) é montado pelo código a partir do roteiro, e não pela IA. A Helena só preenche os campos do card e mostra a escolha na leitura de volta. O card só anda depois do seu "Confirmo". Assim, a escolha do roteiro também passa pelo seu toque.
- **Pedido sem roteiro segue para a v1** nas fases 2 e 3, como já acontece com tudo o que a v2 ainda não faz. Um roteiro novo entra como mudança revisada, passa pelo validador e só vale com o seu toque.
- **Divisão de etapa só se o roteiro a declarar**, e ela acontece ao montar o plano, nunca no meio da execução.
- **"Pedir sub-card" fica desligado em todos os serviços até a fase 4.** Não existe ferramenta para ele. Se um pedido de sub-card chegar por outro caminho, conta como formato errado. Na fase 4, sub-card e planejamento livre voltam, mas só com prova própria.
- **"Em resolução" vira um cartão com opções fixas.** A Helena só recomenda uma de três opções, e quem decide é você:
  - refazer, no máximo uma vez por etapa;
  - seguir sem a etapa, só se o roteiro marcar a etapa como dispensável, e nunca na E4 (checagem jurídica) nem na E5 (relatório final);
  - encerrar.

  "Mandar para a v1" no meio de um card não é opção, porque quebraria a regra "um sistema por pedido".
- **O roteiro entra na impressão digital da tabela.** Assim, uma edição feita à mão no banco é pega na hora, do mesmo jeito que uma mudança na tabela de passagens.

O custo dessa troca é honesto: toda resolução vira um cartão para você, e você pode virar gargalo. Por isso o número de cartões de resolução é medido no portão da fase 3.

### A ação chega por uma ferramenta tipada do nosso servidor (novo na v3.1, MEL-27)

Na v3, o agente devolvia a ação escrita no texto final, e o motor conferia o formato depois. Pela pesquisa, esse é o caminho menos confiável: o modelo não é obrigado a seguir o formato. O caminho mais confiável é o agente responder chamando uma ferramenta. A v1 já fazia isso com o `submit_work`.

- **Uma ferramenta por ação.** O nosso servidor de ferramentas tem uma ferramenta para cada ação ligada: entregar, perguntar, devolver e registrar falha. Cada uma tem campos fechados e nada além deles. Elas são ferramentas separadas, e não uma só com "uma de várias formas", porque o modo estrito da OpenAI recusa esse tipo de esquema. Se o servidor do ChatGPT recusar o nosso esquema, todas as execuções cairiam como falha de infraestrutura. O teste 3 não pega isso, porque o servidor falso dele aceita qualquer esquema. Por isso o esquema é provado com o modelo real no dia de prova da fase 2, antes de qualquer card real.
- **Cada serviço recebe só as ferramentas de ação que a ficha permite.** Depois de a execução ler a internet, o servidor bloqueia "perguntar" e "devolver" (veja "Quem leu a internet só entrega", abaixo).
- **A resposta vale só se a execução terminar inteira.** A ação aceita fica gravada pelo nosso servidor, mas o motor só a usa depois de conferir, no registro de uso, que a execução terminou inteira. Depois da primeira ação aceita, o servidor responde "recebido, termine agora" e recusa qualquer outra ação. Ele não derruba o processo do agente. Se a execução não terminar inteira (queda, processo morto ou registro de uso incompleto), a falha é de infraestrutura, e a ação gravada não é usada. Assim continua valendo a regra da v3: execução incompleta é falha de infraestrutura, e o texto dela nem é lido como resposta. (mudou na v3.1: a análise dos especialistas dizia "a primeira ação aceita encerra a execução". Isso contradizia essa regra, como apontou a crítica, ponto 12, e saiu.)
- **Se o Hermes não respeitar a ferramenta.** Ainda NÃO CONFIRMADO: não sabemos se o modo de tarefa única do Hermes obedece a uma ferramenta obrigatória de resposta. Se o dia de prova da fase 2 mostrar que não obedece, a ação volta a ser o texto final conferido pelo motor, como na v3, e essa decisão fica registrada.
- **Isso muda três frases da v3, e elas estão escritas aqui por extenso:**
  1. "No máximo duas ferramentas" vira "no máximo uma ferramenta de leitura, além das ferramentas de ação".
  2. "O serviço que não usa a internet recebe o nosso servidor vazio" vira "recebe o nosso servidor só com as ferramentas de ação dele".
  3. "Formato errado ganha uma única nova tentativa" continua igual (veja abaixo).

### As travas da execução

- **Pasta limpa por tarefa.** Cada tarefa roda num perfil gerado a partir da ficha, dentro da pasta de perfis do Hermes da v2. O agente trabalha numa pasta vazia, fora de qualquer repositório, para nenhum arquivo de instruções entrar escondido. Ficam desligados:
  - memória e perfil do usuário;
  - revisão em segundo plano e curadoria;
  - título automático e resumo automático da conversa;
  - novas tentativas internas.

  Quem tenta de novo é só o motor. Uma conversa que passe do tamanho que o modelo aceita termina como "entrega grande demais", em vez de seguir com partes esquecidas. A conversa da execução e o que o nosso servidor gravou (ações, chamadas e cópias de páginas, numa pasta só daquela execução) vão para o banco antes de a pasta ser apagada.
- **Login protegido.** O perfil da tarefa não guarda senha nem token. Todos usam o login único da v2, que o Hermes renova um processo por vez. A adoção automática do login do Codex fica desligada, para os dois nunca dividirem o mesmo acesso. O nosso servidor de ferramentas também não recebe nenhuma senha.
- **Sem reserva escondida.** Nenhum perfil de produção tem provedor ou modelo reserva, porque no Hermes um reserva configurado já está ligado. O motor confere no registro de uso se o modelo e o provedor foram os da ficha. No Hermes, o modelo registrado é o apelido pedido, e não necessariamente o modelo que respondeu, e o registro diz isso (C-17).
- **Ferramentas, e só as nossas.** (mudou na v3.1, MEL-34: na v3, "buscar" e "ler página" entravam juntas na fase 2.)
  - **Fase 2: sem internet em produção.** A ferramenta "ler página" é provada contra páginas falsas, com texto plantado.
  - **Fase 3: só "ler página", e só numa lista de endereços montada pelo código.** A lista tem os links que você escreveu no pedido (links escritos por agentes no card não entram, para um agente não pôr endereço na lista de outro), as fontes importadas que você aprovou, os termos da Mimix e do Hub e a tabela de leis. Um endereço fora da lista é recusado como "fonte insuficiente". O site aparece no card em texto simples, nunca como link de um toque. Incluir um endereço na lista é um gesto seu na lista de fontes, e não uma pergunta montada a partir do que a página dizia. Assim, a regra "quem leu a internet só entrega" continua valendo. Cada redirecionamento é conferido de novo contra a lista. Ainda NÃO CONFIRMADO: se as pesquisas importadas da v1 trazem os endereços dos termos da Mimix e do Hub. Sem eles, a lista nasce vazia e a Clara para em "fonte insuficiente". Isso é conferido antes da fase 3.
  - **"Buscar" só na fase 4,** com o Ravi. Nessa hora, a escolha do serviço de busca e o custo dele voltam para você.
  - **Isabela e Clara.** A Isabela fica sem ferramenta de leitura e cita só trechos das fontes importadas que vêm no pacote. O validador passa a aceitar esses trechos como citação válida, porque sem isso toda afirmação da E2 e da E3 seria recusada. A Clara fica só com "ler página".
  - **Como a ferramenta lê.** "Ler página" guarda uma cópia de cada página lida e entrega a página em partes de até 20 mil caracteres, para o Hermes nunca cortar uma página longa. O perfil ainda sobe o limite de corte do Hermes, como reserva.
  - **O que não existe.** Não existe terminal, arquivo, memória nem ferramenta que grava fora do nosso servidor.
  - **Lista por extenso.** A lista de ferramentas vai sempre por extenso, porque no Hermes uma lista vazia libera todas. O nosso servidor liga por um caminho fixo, sem baixar nada na hora, e o Hermes espera por ele até 45 segundos, e não os 15 do padrão. Antes de contar a execução, o motor confere que o agente recebeu exatamente as ferramentas da ficha.
- **Limites que fecham a conta.** Nesse modo, o Hermes não limita passos. Quem limita é o nosso servidor de ferramentas: ele conta cada chamada, inclusive as de ação e as recusadas, e no limite responde "entregue agora". Se o agente insistir mais 3 vezes, o servidor encerra a execução. Esse encerramento é registrado pelo nosso próprio servidor, com o motivo, e conta como "limite de chamadas", não como queda. O tempo é do motor. No exemplo da Clara, os limites iniciais são 30 partes de página, 45 chamadas no total e 15 minutos. (mudou na v3.1: as 10 buscas saem junto com o "buscar".) Esses números são calibrados nas execuções reais do teste 5, que leem só páginas da lista, fora da produção.
- **Quem leu a internet só entrega.** Se a execução usou "ler página", o servidor bloqueia "perguntar" e "devolver", e o motor só aceita Entregar ou Registrar falha. Quem informa se a execução usou a internet é o motor, a partir do registro de uso daquela execução, e não o agente. Assim, um texto plantado num site não vira pergunta para você. Isso vale também na nova tentativa de formato. (novo na v3.1: sem essa linha, o texto plantado viraria pergunta na segunda tentativa.) Um link que não veio de uma página lida chega marcado como "link não conferido".
- **Formato errado tem um nome só.** O servidor recusa na hora uma chamada de ação com formato errado e diz qual campo falhou. Essa recusa conta no limite de chamadas. Na 2ª recusa da mesma execução, a execução termina como "formato errado". Também é "formato errado": terminar sem nenhuma ação aceita, tentar uma ação desligada ou fazer uma pergunta além do limite. O formato errado ganha uma única nova tentativa, só para corrigir o formato. Na segunda, a etapa vai para em resolução. (mudou na v3.1: a análise dos especialistas propunha "até 2 correções dentro da execução" antes de contar formato errado. Isso criava uma segunda camada de tentativas, sem nome, e reabria os furos K-13 e A-17. Ficou a regra da v3, e a recusa na hora entra no limite de chamadas que já existe. O teste 5 confere no máximo 1 nova tentativa de formato.)
- **Tempo e cancelamento.** No tempo máximo, ou quando você cancela, o motor encerra o processo inteiro do agente, com as ferramentas dele, em até 15 segundos.
- **A falha é lida, não declarada.** O motor lê primeiro o registro de uso de cada execução: o do executor e o do nosso servidor. Se a execução não terminou inteira, a falha é de infraestrutura, e nem o texto nem a ação gravada são usados como resposta. O que o agente escreve é só o motivo, nunca o tipo da falha.
- **Pacote curto.** O agente recebe o card, o modelo do serviço, as ações que aquele serviço pode usar, as decisões válidas lidas na hora e as lições e exemplos daquele serviço. Contexto curto e focado melhora a obediência.

### O executor fica atrás de um adaptador (novo na v3.1, MEL-35)

Na v3, mais de 12 travas eram específicas do Hermes e estavam espalhadas pelo plano e pelas fichas: pasta de perfis, pasta vazia, memória desligada, login único, adoção do Codex desligada, sem reserva, lista por extenso, espera de 45 segundos, limite de corte, ambiente sem senha, registro de uso e encerramento do processo. Agora elas ficam num só lugar.

- **Um contrato fixo de entrada e saída.**
  - **Entra:** o pacote, o perfil, os limites, a pasta e o número da execução.
  - **Sai:** a ação, um registro de uso em que cada campo diz de onde veio, e a classe da falha.
- **Um adaptador único do Hermes, com teste próprio.** Todas as travas do Hermes vivem nele.
- **O teste 3 vira duas partes:**
  - um teste de conformidade, que serve para qualquer executor e não gasta cota;
  - um teste específico do Hermes.
- **A regra para escolher executor.** O executor usa a assinatura do ChatGPT pelo login e roda na VPS. Hoje é o Hermes. O que fica de fora, com o motivo certo:
  - bibliotecas que chamam a API paga ficam fora pela DEC-014;
  - LangGraph e Vercel Workflow são motores de fluxo, e não executores, e ficam fora porque o motor já foi escolhido;
  - o gh-aw roda no GitHub Actions, fora da VPS, e pede chave de API ou token do Copilot. Se o Copilot gratuito serve para ele é NÃO CONFIRMADO.
- **O Codex é candidato a reserva, não plano B pronto.** Ele só entra na fase 4, depois de passar nos testes 2 (login com processos em paralelo), 3 e 5, e sem nenhuma chave de API no ambiente. Uma variável de chave do Codex no ambiente trocaria a assinatura por API paga sem avisar, o que fere a DEC-014 em silêncio. O teste de conformidade confere isso. Com honestidade: o Codex cobre o caso de o Hermes perder o acesso de parceiro. Se a OpenAI mudar o uso da assinatura em geral, os dois caem juntos.

## O motor: o DBOS executa, o banco manda

O motor é o DBOS, uma biblioteca aberta e gratuita (licença MIT) que grava cada passo concluído no próprio Supabase. Do DBOS vêm a fila, a vaga, a prioridade e a retomada depois de uma queda. São nossos, no banco:

- prazos e contadores;
- o disjuntor e o vigia;
- a trava por execução;
- a limpeza do histórico;
- a conferência da fila depois de publicar.

O estado do card vive em tabelas nossas, e a tabela de passagens é neutra quanto ao motor: nela, "motor" é só o papel de quem executa, seja qual for a biblioteca (novo na v3.1). Por isso, trocar o motor um dia não mexe em nenhum card.

### Por que o plano continua recomendando o DBOS (novo na v3.1)

A análise dos especialistas propôs tirar o DBOS e escrever um motor próprio no Postgres (MEL-20). O DBOS já estava decidido, e trocar agora seria uma reversão. Dos quatro motivos dados para a troca, três caem por outras melhorias que o plano aceita:

- **"Até 100 retomadas por padrão":** isso se configura. O motor usa no máximo 3 retomadas.
- **"Ordem aleatória entre agentes":** a ordem aleatória só aparece com a fila dividida por agente. Com a fila única de trabalho (abaixo), ela some.
- **"Fluxos ressuscitados numa restauração":** depois de uma restauração, o motor começa com a fila do DBOS vazia, e o que estava aberto é devolvido pelo vigia a partir das nossas tabelas (veja "Backup e recuperação").

Sobra um motivo real: são duas máquinas de estados, a nossa e a do DBOS. O plano reduz esse risco assim:

- o estado que vale é sempre o das nossas tabelas;
- o DBOS só guarda "este passo já terminou";
- o vigia e a conferência ao ligar acusam qualquer diferença entre as duas.

Não é zero risco, e por isso a outra opção fica registrada como cartão de decisão.

### Cartão de decisão: o motor (novo na v3.1)

| | A) Manter o DBOS (recomendado) | B) Motor próprio no Postgres |
| --- | --- | --- |
| O que vem pronto | Fila, vaga, prioridade, retomada do último passo e reenvio de avisos como um passo com retomada | Só o que o Postgres já tem: escolher a próxima da fila sem disputa e trava única |
| O que obriga a escrever à mão | A escolha da próxima etapa pelo motor, se o teste 4 mostrar que a prioridade falha; a conferência ao ligar (banco certo, caminho certo, nunca um banco local); o cancelamento do que for de outra versão depois de publicar; a limpeza noturna das execuções do DBOS; o ajuste de no máximo 3 retomadas; o ensaio de cada troca de versão do DBOS | A escolha da próxima etapa (por prioridade e chegada, com vaga, cota e pausa conferidas); uma reserva com prazo, renovada a cada 5 segundos; a retomada ao ligar, respeitando a reserva, para não pôr dois na mesma etapa; um teto na passagem "resposta gravada", para uma resposta que derruba o motor não reiniciar em laço; o reenvio de avisos; a limpeza da nossa tabela de execuções; 3 passagens novas na tabela e na prova, mais um teste à parte para a disputa entre consultas, que a prova da tabela não cobre |
| O que vale nas duas | A trava por número de execução (regra 3); o caminho único de entrada na fila; a trava única do motor, que exige conexão de sessão (pelo caminho de transação, a trava não garante um motor só); o vigia que devolve etapa sem execução viva | |
| Risco principal | Duas máquinas de estados | Voltar ao "feito à mão" que travou a v1, mesmo com a reserva provada |

- **A trava única do motor vira teste que bloqueia (novo na v3.1).** Ainda NÃO CONFIRMADO: se a trava única é liberada quando o motor cai, conectado pelo caminho de sessão do Supabase. O teste 4 derruba o motor de vários jeitos (processo morto, rede cortada e servidor reiniciado) e confere que o motor novo consegue pegar a trava e que nunca há dois motores trabalhando. Se esse teste falhar, a fase 2 não passa, em qualquer das duas opções.
- **A frase de aprovação diz qual motor.** Ela continua citando o motor escolhido. Sem isso, a mesma frase aprovaria dois documentos diferentes (furo M-2).

### Estados da etapa, cada um com dono e prazo

| Estado da etapa | Dono | Prazo |
| --- | --- | --- |
| Aguardando as anteriores | A Helena, dona do card | O do card |
| Na fila | O agente do serviço | O do card: a espera na fila conta no prazo do card e aparece nos avisos dele (mudou na v3.1: antes, "o da etapa") |
| Executando | O agente do serviço | O tempo máximo da ficha, como os 15 minutos da Clara |
| Validação | O motor | Na hora |
| Revisão | O revisor do serviço | O da revisão |
| Esperando você | Você | O da pergunta, com um padrão que nunca aprova entrega |
| Em resolução | A Helena recomenda uma das 3 opções fixas, e depois você decide | O da recomendação; depois vira cartão para você (mudou na v3.1: a Helena não replaneja mais) |
| Aprovada | A Helena | O do card: a etapa espera o card fechar e pode ser reaberta pela regra 10 enquanto o card estiver aberto (novo na v3.1) |

Os finais são três: pronta, cancelada e encerrada com falha que você reconheceu. Nenhum final volta a andar. "Esperando capacidade" e "agente pausado" não são estados escondidos: são a etapa na fila com um motivo e uma hora para voltar.

O card e a ação externa (cadastro, contato, gasto, contrato ou publicação) têm os seus próprios estados, na mesma tabela de passagens, também com dono e prazo em cada um (novo na v3.1).

A parte de "plano, sequência, prazos e dependências" é do roteiro e do motor, e não de um agente. Isso resolve a sobreposição com a Marina (PMO), cujo serviço próprio está na seção dos 21 agentes (novo na v3.1).

### Como uma execução anda

- **Dois passos curtos por execução.** O primeiro abre o agente, guarda as cópias das páginas lidas e grava a resposta. O segundo lê a resposta gravada, confere e muda o estado. Tudo o que espera (você, uma dependência, a cota) é um estado no banco, e não um fluxo parado.
- **Uma chave por execução.** A chave é a etapa mais o número da execução. O número vem de uma sequência do banco e nunca é reaproveitado: nem numa rodada nova, nem numa versão nova. Ele também não é o contador de tentativas, que zera numa rodada nova. (novo na v3.1: essa distinção ficou escrita.) Repetir um passo não duplica entrega. Uma execução antiga não grava, porque o número dela já foi marcado como morto antes de a próxima começar. A mesma chave vale para o revisor e para a Helena.
- **Queda no meio.** O motor retoma do último passo concluído, com no máximo 3 retomadas (novo na v3.1). Se o agente já tinha respondido, a resposta gravada é usada, sem gastar cota de novo. Uma resposta gravada que derruba o motor na validação conta como queda. Na 3ª queda da mesma etapa, ela para e chama você, para nunca reiniciar em laço (novo na v3.1, furo A-4). Se uma queda apagar as cópias das páginas, a falha é do motor, não do agente.

### A fila: uma vaga de trabalho e uma da Helena (mudou na v3.1, MEL-21)

Na v3, cada agente tinha 1 ou 2 vagas, e o motor rodava até 3 agentes ao mesmo tempo. Isso exigia uma fila dividida por agente, em que a ordem entre agentes não era garantida e a trava contra repetição não funcionava. O gargalo real é a cota do ChatGPT, e não o processador. Rodar em paralelo não reduz o consumo total; só o concentra na mesma janela de 5 horas. Agora:

- **1 vaga de trabalho para todos os agentes,** por prioridade (só você muda) e por ordem de chegada. Revisões, o relatório final, a recomendação da Helena numa resolução e o destravar de prazos também entram nessa fila.
- **1 vaga curta, separada, só para a Helena entender as suas mensagens** (a leitura de volta). Assim, uma mensagem sua nunca espera atrás de uma revisão longa. O corte dessa vaga começa em 2 minutos e é calibrado nas execuções reais.
- **No máximo 2 processos do Hermes ao mesmo tempo.** Todo uso do Hermes da v2 passa por uma das duas vagas: os 5 casos de toda noite, as baterias de troca de modelo e o card de ensaio. Sem isso, eles abririam um 3º processo.
- **A vaga conta só processo vivo e se libera sozinha.** É o contrário do WIP da v1, que travava. No DBOS, a vaga usa o limite por processo, e não o limite geral, porque o limite geral conta também fluxos pendentes de versões antigas, e um resto de publicação congelaria a v2 inteira.
- **Cota apertada é regra de entrada.** Quando a cota aperta, card novo espera para entrar. Uma segunda ordem de fila não passa por cima da sua prioridade (regra 7).
- **Disjuntor por agente.** Se um agente falha 3 vezes seguidas, um disjuntor pausa só ele, e o revisor reserva assume quando o revisor titular estiver pausado. O disjuntor entra na tabela única de estados de qualidade, com a precedência descrita em "Qualidade em 3 portões" (novo na v3.1).
- **Os 21 agentes dividem a mesma fila (novo na v3.1).** Todos têm ficha, casos e jornada provados na especificação, na fase 1. Mas ligam em produção um por vez, pelos portões (de estágio para ativo), porque a cota e a VPS são limitadas. Com uma vaga de trabalho, ligar todos de uma vez só faria a fila andar mais devagar, sem entregar mais.
- **Quando sobe a 2ª vaga de trabalho.** Só por teste, nunca por data. As condições são:
  - o teste 1 mostra sobra de cota;
  - os testes 2, 4 e 6 são repetidos com 3 processos e passam com os critérios de hoje;
  - a espera na fila acende a luz amarela (80% do prazo) com frequência.

  Como isso muda o servidor, a 2ª vaga pede a sua frase do nível "mudança no banco ou servidor" e o seu toque. Ela nunca sobe sozinha. Enquanto não sobe, a fila anda mais devagar com muitos cards, e os prazos das etapas são calibrados no teste 1 para não disparar alertas à toa.

Essa conta fecha para a primeira meta. O roteiro das 10 pessoas tem orçamento de 12 tarefas e 3 horas de modelo, com prazo de 7 dias, e cabe com folga rodando uma etapa de cada vez.

### Regras da fila e do ciclo de vida

- **Um caminho só para entrar na fila.** Toda etapa entra pela mesma função do banco, sempre com agente, prioridade e versão. No DBOS, uma etapa sem prioridade passa na frente das outras, mesmo numa fila única, e uma sem agente ficaria parada. Por isso não existe outro caminho. O teste 4 prova: com uma vaga só, uma etapa de prioridade baixa entra antes, e mesmo assim a de prioridade alta roda primeiro. Se a prioridade do DBOS falhar nesse teste, o motor só passa uma etapa ao DBOS quando há vaga livre, sempre a de maior prioridade.
- **Cancelou no meio?** A cada 5 segundos, o motor confere o card. Se ele foi cancelado ou o tempo acabou, o motor encerra o processo inteiro do agente em até 15 segundos. Uma resposta que chegue depois é recusada pelo banco, porque o número daquela execução já está morto. Cancelar sempre vale, mesmo com uma regra nova ainda em observação.
- **Cancelar ou falhar avisa quem depende.** Quando uma etapa é cancelada ou termina com falha, as etapas do roteiro que dependiam dela e o card param e perguntam a você: pular (só se o roteiro permitir), refazer ou cancelar o card. (mudou na v3.1: sem sub-card na v2.0, a cascata vale para as etapas do roteiro. Quando o sub-card voltar, na fase 4, os sub-cards da etapa são cancelados junto, como na v3.)
- **Publicar sem perder nada.** A versão do motor é um número fixo, que só muda quando o desenho de um fluxo muda. Nesse caso, a publicação espera a fila esvaziar e se recusa a seguir se sobrar trabalho da versão antiga. Ao voltar, antes de abrir a fila, o motor:
  - encerra processos que tenham sobrado;
  - cancela o que estiver na fila do DBOS com outra versão, que no DBOS prenderia vagas para sempre.

  O vigia devolve essas etapas, e qualquer outra sem execução viva, com número novo e sem gastar tentativa. (mudou na v3.1: publicar é o seu toque no EasyPanel, colando a impressão digital de uma imagem que passou nos testes; os detalhes estão em "Manutenção sem depender do seu PC". Ainda NÃO CONFIRMADO: se o EasyPanel aceita a impressão digital nesse campo. Os testes do GitHub protegem contra erro, e não contra uma sessão desviada, porque a sessão de IA usa o seu login como administradora.)
- **Plano conferido ao ativar.** Todo plano é montado pelo código a partir do roteiro e conferido pelo validador antes de a primeira etapa andar: sem ciclos, todo serviço existe e está ligado, cada etapa recebe o que precisa e o orçamento cabe. O validador é código nosso. Se ele não responder em 60 segundos, roda de novo uma vez. Na segunda, o card espera você, com o motivo "validador falhou". Se o plano não passar, o card também espera você, com o motivo. (mudou na v3.1: na v3, o plano era conferido de novo "se mudar no meio". Na v2.0, a IA não muda o plano no meio. Ele só muda por uma ordem sua ou por uma decisão nova, e aí a regra 10 refaz o que dependia dela. "Sem ciclos" é conferido no GitHub, ao aceitar o roteiro, e de novo no banco, ao ativar.)
- **Entrega grande é dividida no plano.** A divisão por seções acontece ao montar o plano, só quando o roteiro a declara. O relatório final junta as seções aprovadas.
- **Horário de Brasília em tudo.** O motor diz ao agente a data e a hora de Brasília e converte o prazo ele mesmo. Todos os relógios do sistema usam o mesmo fuso.
