# Sistema Helena: plano v3, o melhor até agora

Oct 9, 2026 · @anonimus

Este é o plano único, refeito do começo ao fim. Ele junta as duas análises anteriores, a revisão das fichas feita no seu PC e uma nova rodada de ataque ao plano, por três ângulos diferentes. Cada furo achado tem conserto, um teste que prova e a fase em que fecha, e não sobrou nenhum furo conhecido em aberto.

Os 3 furos da segunda análise eram do plano anterior e já estavam fechados no plano corrigido; esta versão fecha também os que apareceram depois. Ninguém consegue prometer zero furo desconhecido, então o plano traz o processo que acha o próximo furo antes de você: revisão independente no fim de cada fase, vigia no ar e todo erro virando teste.

## Resposta direta

**Tem furo?** Nenhum conhecido em aberto. Nas quatro rodadas de ataque foram 171 achados, e cada um está na aba Registro de furos com o conserto, o teste que prova e a fase em que fecha.

**E se aparecer um furo novo?** Ele aparece no card, com dono e prazo, nunca em silêncio. Cada fase só avança depois de uma nova revisão independente, e todo furo achado vira regra no código e teste, para não voltar.

**Eles vão seguir?** Vão, porque não têm como fazer diferente. O agente só devolve uma de 5 ações, não tem nenhuma ferramenta que grava, e o banco recusa qualquer passagem fora da tabela.

**Dá para não ter erro nenhum?** No processo, sim: o banco recusa passagens inválidas, o vigia acusa o que parar, e os testes percorrem todos os eventos da tabela antes de ir ao ar. No conteúdo, nenhuma IA ou pessoa chega a 100%: o código confere o que dá para conferir (citação, conta e lei), um revisor confere o resto, e o card mostra o que foi conferido e o que não foi.

**O que mudou nesta rodada?** O motor e a ordem de construir continuam os mesmos. Mudou o que faria o sistema falhar na prática: o caminho do card em cada caso, a conferência da qualidade e a operação. Três pontos mudam o que combinamos: a fase 0 começa conferindo se alguém já entrou na v1, as chaves expostas são trocadas já na fase 0, e nada é publicado sem o seu toque.

## Como funciona

O banco manda, o motor executa e o agente só escreve conteúdo. Cada peça tem um papel só, e só o motor grava no banco, sempre pelas regras dele.

&#91;embedded content: onde cada peça roda · 3 lugares e um vigia de fora\]

- **Supabase, o banco.** Guarda a caixa de entrada, os cards, as 13 regras, o histórico e as cópias das páginas lidas. O relógio dos prazos e o vigia rodam dentro dele, fora da VPS.
- **Motor (DBOS), na VPS.** Pega a próxima etapa da fila, abre o agente, confere a resposta e grava uma vez só, pelas funções do banco. Só um motor roda por vez.
- **Agente (Hermes travado), na VPS.** Roda numa pasta limpa por tarefa, sem nenhuma senha, só com as ferramentas da ficha, que são nossas: no máximo "buscar" e "ler página". Devolve uma das 5 ações e não grava nada.
- **GitHub.** Guarda o código, as fichas e as regras, roda os testes a cada mudança e faz o backup da noite. Publicar na VPS e mudar o banco só acontecem quando você aperta o botão de publicar.
- **Vigia do vigia.** Um serviço gratuito de fora (healthchecks.io) espera um sinal do Supabase, do motor e do backup. Se um sinal parar, ele avisa você pelo Telegram e por e-mail, mesmo com o Supabase e a VPS fora do ar.
- **ChatGPT.** A sua assinatura, com um login só da v2, separado do login da v1.

## A jornada do card

Cada pedido seu vira um card, e o card só anda por regras de código até voltar pronto para você. A Helena entende e pergunta, os agentes fazem o conteúdo e o motor garante a lógica.

&#91;embedded content: a jornada do card · 11 passos em 4 papéis\]

- **Nenhuma mensagem se perde nem vira duas.** Toda mensagem sua é gravada pelo código antes de qualquer IA, com o número único que o WhatsApp ou o app dá a ela. Se a mesma mensagem chegar duas vezes, o banco já tem aquele número e não cria outro card.
- **Leitura de volta.** Num pedido grande, o card já nasce como rascunho esperando você, e a Helena responde "Entendi assim: objetivo, prazo e como é o pronto. Confirma?". A pergunta tem dono e prazo, como qualquer espera.
- **Classificação conferida.** A Helena classifica cada mensagem em card novo, ajuste, resposta, cancelamento ou conversa, e mostra como entendeu. Card novo e ajuste valem na hora, com botão de desfazer. A letra de uma opção (A, B ou C) também vale na hora, porque quem lê a letra é o código. Cancelar ou responder com texto livre só vale depois do seu toque no app, ou de "OK" com o código curto que ela mostra.
- **Nada fica sem lugar.** Se a Helena falhar duas vezes, a mensagem vai para "sem classificar", no topo do app, e você recebe um aviso se ela passar 30 minutos ali. Mensagem marcada como conversa fica 24 horas na lista "sem card", para você ver se era um pedido.
- **Pedido parecido.** Se já existe um card aberto da mesma empresa e do mesmo serviço, o app pergunta se o pedido novo entra nele.
- **Ordem de serviço.** O card nasce com campos fixos: empresa, o que você quer, como é o pronto, prazo, prioridade e o que não pode. O pedido original viaja inteiro por todas as etapas e revisões.
- **Prioridade e prazo são seus.** Ficam em campos que só você muda; nenhum agente consegue alterar. A Helena pode sugerir um prazo novo, como pergunta, e o original continua no card.
- **Cancelar não depende de IA.** O botão Cancelar no app para o card na hora: em até 15 segundos, o motor encerra o agente que estiver trabalhando nele.
- **Ajuste depois do pronto.** Um card pronto não volta a andar. O seu pedido de ajuste abre um card novo, ligado ao anterior e com as entregas dele, para o mesmo responsável.
- **Um sistema por pedido.** Até a troca, o WhatsApp continua com a v1, e a v2 recebe pedidos pela tela nova do app. Na troca, um registro muda o canal, e o que a v2 ainda não faz segue para a v1, com o card mostrando "rodando na v1". O que já estava em andamento na v1 termina na v1, e a troca é ensaiada antes de valer.

## As 13 regras de ferro

A lógica do card é uma tabela de estados e passagens guardada no banco, e uma única função muda o estado. Por isso as regras abaixo valem mesmo que um programa erre: o banco recusa o movimento.

| Regra que nunca quebra | Prova antes de publicar | Trava no banco | Vigia no ar |
| --- | --- | --- | --- |
| 1. Todo card e toda etapa abertos têm um dono e um prazo; nada espera sem prazo e alerta | Sim | Sim | Sim |
| 2. Todo card termina pronto, cancelado ou encerrado por você, e nenhum final volta a andar | Sim | Não | Sim |
| 3. Uma etapa nunca é trabalhada por dois ao mesmo tempo, e só a execução atual grava | Sim | Sim | Sim |
| 4. O revisor nunca é o autor, nem quem vai julgar a mesma peça depois | Sim | Sim | Sim |
| 5. Pedido de ajuste sempre volta ao autor; cada etapa roda no máximo 6 vezes, e os seus pedidos não gastam esse limite | Sim | Sim | Sim |
| 6. Nenhum ciclo; sub-cards em até 2 níveis; etapa cancelada ou com falha para quem depende dela e pergunta a você | Sim | Sim | Sim |
| 7. Prioridade e prazo são seus; continuar um card nunca fura a fila de outro | Sim | Sim | Sim |
| 8. Nada externo (cadastro, contato, gasto, contrato, publicação) sem o seu ok registrado, e no máximo uma vez | Sim | Sim | Sim |
| 9. Toda entrega aprovada passou pelos portões do seu serviço, inclusive o relatório final; nenhum padrão automático aprova | Sim | Sim | Sim |
| 10. Nenhum card fica pronto com informação velha: se o pedido, uma decisão sua ou uma entrega aprovada mudar, o que dependia dela é refeito | Sim | Sim | Sim |
| 11. Toda mensagem sua é gravada uma vez e acaba num card, numa resposta ou numa lista que você vê | Sim | Sim | Sim |
| 12. Falha do provedor ou do servidor não gasta tentativa nem pune o agente, mas tem teto, e no teto chama você | Sim | Não | Sim |
| 13. Toda mudança fica no histórico, e o histórico reconstrói o card | Sim | Sim | Sim |

- **Prova antes de publicar.** Um teste percorre todas as combinações da tabela: cada resposta do agente, do revisor e da Helena em cada estado, cada botão seu, cada nível de prazo, queda no meio e resposta repetida ou atrasada. Como todo contador tem teto, as combinações acabam, e o teste é prova sobre esses eventos, não amostra. Se uma combinação quebrar uma regra, a mudança não sai.
- **A tabela testada é a que roda.** Cada versão da tabela tem uma impressão digital. Se a tabela do banco for diferente da que passou no teste, o motor não liga e o vigia avisa. A mudança que troca a tabela confere, dentro dela mesma e com a tabela travada, que todo card aberto continua num estado que existe; se algum não continuar, nada muda. Um estado ou uma passagem só é removido numa versão seguinte, quando nenhum card aberto o usa mais.
- **Trava no banco.** As regras 2 e 12 não cabem numa trava: a 2 depende do tempo e é garantida pelo relógio dos prazos, e a 12 depende da origem da falha, que o motor lê no registro de uso do Hermes, nunca no texto do agente.
- **Vigia no ar.** A cada 5 minutos, dentro do Supabase, uma checagem confere as 13 regras em todos os cards abertos. Se uma falhar, a luz do card fica vermelha e você recebe um aviso por regra, com os cards afetados, repetido a cada 6 horas enquanto durar. Uma regra nova passa as primeiras 24 horas só acendendo a luz no painel, para uma regra errada não encher o seu celular.

## O agente: uma função com 5 ações

O agente recebe o pacote do card e devolve exatamente uma de 5 ações do autor, num formato conferido. O revisor, a Helena e você têm as respostas de cada papel na mesma tabela; qualquer outra coisa conta como formato errado e volta com o motivo.

| Ação | Para que serve | O que o código confere |
| --- | --- | --- |
| Entregar | Devolver o trabalho pronto | Modelo do serviço, tamanho, fontes e critério de pronto |
| Pedir sub-card | Passar uma parte para outro agente | O serviço está no cardápio, o agente existe, não é ele mesmo, cabe no orçamento e não forma ciclo |
| Perguntar | Tirar uma dúvida que só você responde | Vai pela Helena, com opções, dentro do limite de perguntas do card; o card espera com dono e prazo |
| Devolver a quem pediu | Pedido impossível ou ambíguo | Motivo obrigatório; volta para quem pediu |
| Registrar falha | Não dá para fazer | Um de 3 motivos: não consigo, faltam dados ou fonte insuficiente; sempre conta como tentativa |

- **Pasta limpa por tarefa.** Cada tarefa roda num perfil gerado da ficha, dentro da pasta de perfis do Hermes da v2, e o agente trabalha numa pasta vazia, fora de qualquer repositório, para nenhum arquivo de instruções entrar escondido. Memória, perfil do usuário, revisão em segundo plano, curadoria, título automático, resumo automático da conversa e novas tentativas internas ficam desligados: quem tenta de novo é só o motor, e uma conversa que passe do tamanho que o modelo aceita termina como "entrega grande demais", em vez de seguir com partes esquecidas. A conversa da execução vai para o banco antes de a pasta ser apagada.
- **Login protegido.** O perfil da tarefa não guarda senha nem token: todos usam o login único da v2, que o Hermes renova um processo por vez. A adoção automática do login do Codex fica desligada, para os dois nunca dividirem o mesmo acesso.
- **Sem reserva escondida.** Nenhum perfil de produção tem provedor ou modelo reserva, porque no Hermes um reserva configurado já está ligado. O motor confere no registro de uso se o modelo e o provedor foram os da ficha.
- **No máximo duas ferramentas, e são nossas.** "Buscar" e "ler página" guardam uma cópia de cada página lida e entregam a página em partes de até 20 mil caracteres, para o Hermes nunca cortar uma página longa; o perfil ainda sobe o limite de corte do Hermes, como reserva. Não existe terminal, arquivo, memória nem ferramenta que grava. A lista de ferramentas vai sempre por extenso, porque no Hermes uma lista vazia libera todas: o serviço que não usa a internet recebe o nosso servidor vazio. O nosso servidor de ferramentas liga por um caminho fixo, sem baixar nada na hora, e o Hermes espera por ele até 45 segundos, e não os 15 do padrão. Antes de contar a execução, o motor confere que o agente recebeu exatamente as ferramentas da ficha.
- **Limites que fecham a conta.** Nesse modo o Hermes não limita passos, então quem limita é o nosso servidor de ferramentas: ele conta cada chamada e, no limite, responde "entregue agora". Se o agente insistir mais 3 vezes, o servidor encerra a execução, que conta como "limite de chamadas". O tempo é do motor. Exemplo da Clara: 10 buscas, 30 partes de página, 45 chamadas no total e 15 minutos, calibrados nas execuções reais do teste 5.
- **Quem leu a internet só entrega.** Se a execução usou "buscar" ou "ler página", o motor só aceita Entregar ou Registrar falha. Assim, um texto plantado num site não vira pergunta para você nem pedido para outro agente. Um link que não veio de uma página lida chega marcado como "link não conferido".
- **Formato errado tem um nome só.** Resposta sem ação, com duas ações, fora do formato ou com uma pergunta além do limite é "formato errado". Ela ganha uma única nova tentativa, só para corrigir o formato; na segunda, a etapa vai para em resolução.
- **Tempo e cancelamento.** No tempo máximo, ou quando você cancela, o motor encerra o processo inteiro do agente, com as ferramentas dele, em até 15 segundos.
- **A falha é lida, não declarada.** O motor lê primeiro o registro de uso que o Hermes grava em cada execução. Se a execução não terminou inteira, a falha é de infraestrutura e o texto do agente nem é lido como resposta. O que o agente escreve é só o motivo, nunca o tipo da falha.
- **Pacote curto.** O agente recebe o card, o modelo do serviço, as 5 ações, as decisões válidas lidas na hora e as lições e exemplos daquele serviço. Contexto curto e focado melhora a obediência.

## O motor: o DBOS executa, o banco manda

O motor é o DBOS, uma biblioteca aberta e gratuita (licença MIT) que grava cada passo concluído no próprio Supabase. Do DBOS vêm a fila, as vagas, a prioridade e a retomada depois de uma queda; prazos, contadores, disjuntor, vigia, a trava por execução, a limpeza do histórico e a conferência da fila depois de publicar são nossos, no banco. Como o estado do card fica em tabelas nossas, dá para trocar o motor um dia sem mexer em nenhum card.

&#91;embedded content: caminho de uma etapa · do plano à aprovação, com as 2 voltas de correção\]

| Estado da etapa | Dono | Prazo |
| --- | --- | --- |
| Aguardando as anteriores | A Helena, dona do card | O do card |
| Na fila | O agente do serviço | O da etapa |
| Executando | O agente do serviço | O tempo máximo dele, como os 15 minutos da Clara |
| Validação | O motor | Na hora |
| Revisão | O revisor do serviço | O da revisão |
| Esperando você | Você | O da pergunta, com um padrão que nunca aprova entrega |
| Em resolução | A Helena, depois você | Um replanejamento; depois vira cartão para você |

Os finais são três: pronta, cancelada e encerrada com falha que você reconheceu, e nenhum volta a andar. "Esperando capacidade" e "agente pausado" não são estados escondidos: são a etapa na fila com um motivo e uma hora para voltar.

- **Dois passos curtos por execução.** O primeiro abre o agente, guarda as cópias das páginas lidas e grava a resposta. O segundo lê a resposta gravada, confere e muda o estado. Tudo o que espera (você, uma dependência, a cota) é um estado no banco, não um fluxo parado.
- **Uma chave por execução.** A chave é a etapa mais o número da execução. Repetir um passo nunca duplica entrega, e uma execução antiga não grava, porque o número dela já passou.
- **Queda no meio.** O motor retoma do último passo concluído. Se o agente já tinha respondido, a resposta gravada é usada, sem gastar cota de novo. Se uma queda apagar as cópias das páginas, a falha é do motor, não do agente.
- **Uma fila, com vagas por agente.** Cada agente tem 1 ou 2 vagas, e o motor roda no máximo 3 agentes ao mesmo tempo, na ordem da sua prioridade e da chegada. A Helena tem uma vaga separada só para entender as suas mensagens, que nunca esperam atrás de uma revisão. A documentação do DBOS não garante a ordem de prioridade entre agentes diferentes, por isso o teste 4 mede; se não valer, o motor só passa uma etapa ao DBOS quando há vaga livre, sempre a de maior prioridade. Se um agente falha 3 vezes seguidas, um disjuntor pausa só ele.
- **Um caminho só para entrar na fila.** Toda etapa entra pela mesma função do banco, sempre com agente, prioridade e versão. No DBOS, uma etapa sem prioridade passaria na frente das outras, e uma sem agente ficaria parada; por isso não existe outro caminho.
- **Cancelou no meio?** A cada 5 segundos, o motor confere o card; se ele foi cancelado ou o tempo acabou, encerra o processo inteiro do agente. Uma resposta que chegue depois é recusada pelo banco.
- **Cancelar ou falhar avisa quem depende.** Quando uma etapa é cancelada ou termina com falha, os sub-cards dela são cancelados junto. As etapas que dependiam dela e o card pai param e perguntam a você: pular, refazer ou cancelar o card.
- **Publicar sem perder nada.** A versão do motor é um número fixo, que só muda quando o desenho de um fluxo muda. Nesse caso, a publicação espera a fila esvaziar e se recusa a seguir se sobrar trabalho da versão antiga. Ao voltar, antes de abrir a fila, o motor encerra processos que tenham sobrado e cancela o que estiver na fila com outra versão, que no DBOS prenderia vagas para sempre; o vigia devolve essas etapas, e qualquer outra sem execução viva, com número novo e sem gastar tentativa.
- **Plano conferido ao ativar e a cada mudança.** Todo plano da Helena é checado ao ser ativado e de novo se mudar no meio: sem ciclos, todo serviço existe, cada etapa recebe o que precisa e o orçamento cabe. Se não passar, o card espera você, com o motivo.
- **Entrega grande é dividida no plano.** A divisão por seções acontece ao montar o plano, e o relatório final junta as seções aprovadas.
- **Horário de Brasília em tudo.** O motor diz ao agente a data e a hora de Brasília e converte o prazo ele mesmo. Todos os relógios do sistema usam o mesmo fuso.

## Qualidade em 3 portões

Cada entrega passa por três portões, do mais barato ao mais caro. O revisor só gasta tempo com o que já está bem formado, e você só vê o que tem risco.

1. **Validador automático** (código, instantâneo, sem custo). Recusa na hora, com o item exato, se:
   - faltar seção do modelo, passar do tamanho, não estiver em português ou tiver código de página (HTML);
   - uma afirmação vier sem citação e fonte, ou se a citação não for um trecho contínuo, de pelo menos 12 palavras ou uma frase inteira, de uma página que o agente leu nesta execução pela nossa ferramenta (a tradução vai num campo à parte, e a citação original é a conferida);
   - a fonte chamada de oficial não for do mesmo site do link do pedido, ou uma frase como "a página não fala de X" vier sem os termos buscados e sem a leitura de todas as partes; no jurídico, os termos de uso precisam ter sido lidos por inteiro;
   - um número do Caio não bater: ele preenche um modelo de cálculo com entradas e fórmulas, e o código refaz cada conta; toda entrada diz a origem (dado seu, fonte citada com data ou premissa dele), e câmbio só vale com fonte datada ou dado seu;
   - uma lei citada não estiver na tabela de leis, com o texto oficial, a data e as notas de jurisprudência (por enquanto: LGPD, Código Civil, Lei 9.610/98, Marco Civil, CDC, CLT, ECA Digital e Lei 15.123/2025, que aumenta a pena de quem altera com IA a imagem ou a voz de uma mulher, nos pontos que o serviço usa), ou se o artigo vier sem o trecho da tabela citado junto; lei fora da tabela chega marcada "não conferida", e um artigo usado sem a nota de jurisprudência dele, como o 19 do Marco Civil, chega marcado;
   - um tema obrigatório do serviço ficar sem resposta (no jurídico: imagem, voz, dado sensível, transferência para fora do país, menores, vínculo de trabalho e publicidade);
   - o convite tiver qualquer termo de ganho (reais, dólares, renda, ganho, "por hora" e parecidos); a etapa do convite nem recebe os números do Caio;
   - o texto disser que o agente fez algo de fora, como "enviei" ou "cadastrei".
2. **Revisor com rubrica** (IA). Marca aprovado ou reprovado em cada critério, apontando a prova, que o código também confere. Ele vê o parágrafo inteiro em volta de cada citação, tirado pelo código da página lida. O revisor nunca é o autor, e cada restrição do seu pedido vira um critério. No jurídico, você é o segundo revisor: o card marca "leia antes de agir".
3. **Você**, só no plano da meta e em ação externa. Chega como cartão pronto para decidir.

**O próprio validador é testado.** Antes de valer, ele precisa recusar citações falsas, cortadas ou de outra cláusula, contas erradas, leis inventadas, sites parecidos e código plantados de propósito, e aceitar citações honestas com aspas e espaços diferentes. Um validador que deixa passar um defeito plantado não vai ao ar.

**O que escapa aparece.** Uma faixa no topo do card, calculada só pelo código, mostra o que o código conferiu, o que é julgamento da IA e o que ficou sem conferir. Se a faixa está vermelha, a frase-resumo da IA nem aparece. A confiança que a IA diz ter não entra na faixa; se aparece no texto, vem marcada como "autoavaliação da IA". Cada pedido de ajuste seu, com o motivo marcado, vira proposta de lição; aprovar não ensina nada sozinho. Todo erro que escapou vira um caso novo na bateria de testes.

**Jurídico com data.** O card jurídico diz contra qual versão da tabela de leis foi conferido e que não substitui um advogado. Atualizar a tabela é um item com data no manual do mantenedor.

**Troca de modelo escondida.** O ChatGPT não informa qual modelo respondeu de fato. Por isso, toda noite 5 casos fixos rodam com conferência só por código, e duas noites seguidas de falha geram um aviso; uma troca silenciosa só aparece assim.

## O relatório do card

Quando o card volta, você vê sempre o mesmo formato, montado pelo app a partir dos campos da entrega. Como o agente preenche campos e não desenha a página, o resultado sai organizado todas as vezes, mesmo trocando o modelo.

&#91;embedded content: o card de volta para você · exemplo da meta das 10 pessoas\]

- **Topo:** título, empresa, situação, dono e prazo. Logo abaixo, a faixa do código: o que o código conferiu, o que é julgamento da IA, o que ficou sem conferir, o maior risco, a idade das páginas lidas e quanto de cada página foi lido, como "3 de 8 partes". A resposta em uma frase só aparece se a faixa não estiver vermelha.
- **Precisa de você:** a decisão com opções, a recomendação e a consequência de cada uma, a lista do que só você faz e as premissas que você precisa confirmar, com o efeito de cada uma no resultado.
- **Entregas:** um bloco por entrega, com quem fez, quem revisou e o resumo; o texto completo abre ao clicar.
- **Números, riscos e fontes,** cada um no seu lugar. Embaixo dos números, o app escreve "contas conferidas pelo código; premissas não". Riscos e perguntas de qualquer etapa chegam ao card pelo código, mesmo que o resumo final esqueça deles.
- **Citações:** o original primeiro e a tradução depois, marcada como tradução; numa cláusula de risco alto, os dois lado a lado.
- **Texto seguro:** o que veio da internet aparece como texto simples. Um link mostra o site de destino, e nada de uma página lida roda dentro do app.
- **Botões:** Aprovar, Pedir ajuste (com o motivo marcado: erro de fato, faltou tema, tom ou formato), Usar como exemplo (só em entrega com tudo conferido) e Cancelar. Cada toque leva a versão do card que você viu; se ele mudou depois que você abriu, o app mostra a versão nova antes de aceitar. Ao aprovar, o código lê de novo cada fonte e avisa se a página mudou desde a leitura.
- **Aba Técnico:** o raio-X de cada passo, para manutenção.

## Falhas e esperas

Cada falha tem um tipo, e cada tipo tem uma resposta automática no código e um teto. O motor lê o tipo no registro de uso do Hermes e no veredito do validador, nunca no texto do agente; uma execução que não terminou inteira nem tem o texto lido como resposta.

| Tipo de falha | O que o motor faz | Teto, e quem é chamado |
| --- | --- | --- |
| Cota do ChatGPT esgotada | Pausa a fila sem gastar tentativa e testa a cota em intervalos crescentes; o card mostra "esperando capacidade", com a hora de volta quando a OpenAI informa, ou a hora da próxima conferência quando não informa | 1 hora: aviso para você. 6 horas: você escolhe entre esperar, usar o modelo menor ou cancelar |
| Login do ChatGPT caiu | Pausa tudo sem perder nenhuma etapa | Na hora: aviso com o passo a passo para entrar de novo |
| Provedor instável | Refaz a etapa sem gastar tentativa, com intervalo crescente | Na 3ª vez seguida: aviso para você |
| Queda do servidor no meio | Retoma do último passo concluído, sem gastar tentativa | 15 minutos fora: aviso. Na 3ª queda da mesma etapa, ela para e chama você |
| Banco fora do ar ou só para leitura | Pausa a fila sem gastar tentativa, e o que estava no meio é retomado quando o banco voltar; o motor avisa você direto, sem passar pelo Supabase | Na hora: aviso para você |
| Ferramenta fora do ar | Se o agente não recebeu as ferramentas da ficha, a execução não conta e é refeita | Na 3ª vez: aviso para você |
| Tempo esgotado | Conta como tentativa: mais uma, com 50% mais tempo | Na segunda, a etapa é dividida; se não resolver, em resolução |
| Site fora do ar | Tenta 3 vezes e troca de fonte | Sem fonte alternativa: em resolução |
| Entrega grande demais | Divide a etapa em partes, seguindo o modelo do serviço | Duas divisões sem resolver: em resolução |
| Limite de chamadas | Divide a etapa ou dá mais chamadas, uma vez | Na segunda: em resolução |
| Formato errado | Uma nova tentativa, só de formato | Na segunda: em resolução |
| Reprovado pelo revisor | Volta ao autor com os critérios reprovados | Duas rodadas: em resolução |
| Ação externa proposta | Vai para a lista do que só você faz; nunca é executada | Sempre você |
| Falha desconhecida | Para só aquela etapa e guarda tudo | Na hora: aviso para você |

- **Teto geral.** Cada etapa roda no máximo 6 vezes, somando autor e revisor, por qualquer motivo. No teto, ela para e chama você com a causa, mesmo que cada falha tenha sido de um tipo diferente.
- **Em resolução.** A Helena replaneja a etapa uma vez, com as provas na mão. Se não resolver, vira cartão para você.
- **Prazos fora da VPS.** O relógio dos prazos roda dentro do Supabase, e cada nível dispara uma vez só. Com 80% do prazo, o card fica amarelo; no prazo, a Helena é chamada para destravar; uma hora depois, você recebe o aviso. Se o card já espera por você, a Helena não é chamada e o aviso vai direto para você.
- **Toda espera por você tem um padrão, e nenhum aprova entrega.** Pergunta interna: lembrete em 24 e 48 horas, e depois a etapa é cancelada. Pergunta sobre algo externo: cancela no prazo. O padrão fica registrado como padrão, nunca como decisão sua.
- **Vale o que chegar primeiro.** Se a sua resposta chegar depois do padrão, ela abre um card novo já preenchido, e o app mostra isso.
- **Cota sob controle.** A v2 tem um orçamento por dia, uma parte fixa do limite do plano, e o resto fica para a v1 enquanto ela rodar. Quando a cota aperta, a ordem é: Helena recebendo pedidos, revisores, cards em andamento e cards novos.

## Segurança: as dívidas de hoje fecham na fase 0

A fase 0 vem antes de qualquer peça nova e vale para a v1 também, porque as duas dividem o servidor, o banco e a conta do ChatGPT. Ela começa conferindo se alguém já entrou.

**Primeiro, ver se alguém entrou.** As portas 9119 e 8642 da v1 ficaram abertas para a internet, e a documentação do próprio Hermes diz que painéis abertos foram a porta de entrada de uma campanha de invasão em junho de 2026, que deixava uma chave de acesso escondida no servidor. Por isso a fase 0 começa com uma checagem só de leitura, dentro da v1 e no servidor: chaves de acesso, servidores de ferramentas e tarefas agendadas de cada perfil, arquivos mudados depois da última publicação, portas abertas e acessos recentes. Eu também varro de fora todas as portas e todos os domínios do servidor. Se aparecer qualquer sinal de invasão, a v1 é refeita de uma imagem limpa, com login novo do ChatGPT e todas as chaves trocadas, antes da fase 2.

| Hoje | Na fase 0 |
| --- | --- |
| Portas 9119 e 8642 abertas, e as outras nunca conferidas | Você remove as duas no EasyPanel; eu varro todas as portas e domínios de fora, e o GitHub repete a varredura toda semana |
| O modo de teste do app abre sem login para qualquer um na sua rede | Desligado: o app sempre pede login |
| O usuário helenasistema.publico ainda tem papel de fundador | Papel removido; só você é fundador |
| Quem tem a chave pública do app consegue chamar as funções do banco e criar uma conta | O banco tira o acesso público de todas as funções, inclusive das 38 de hoje; cada uma aceita só o motor ou você, e o cadastro de contas novas fica desligado |
| O app pode gravar direto nas tabelas | O app só grava pelas funções do trilho, e o banco recusa o resto |
| O WhatsApp aceita qualquer número, e o endereço que recebe as mensagens não pede senha | Só o seu número; o endereço só aceita quem manda a senha combinada com o WhatsApp; a mesma mensagem repetida vira um card só, e o eco das respostas da Helena é ignorado |
| Chaves com acesso total circulando, inclusive no chat | Uma lista de todas as chaves, sem os valores, e a troca de todas na fase 0 |
| Contas importantes protegidas só por senha | Você liga a verificação em duas etapas no GitHub, no EasyPanel, no Supabase e na Hostinger |

- **Chaves trocadas já na fase 0.** As chaves que apareceram no chat dão acesso total ao banco e valeriam durante toda a construção, porque os testes rodam no banco de verdade. Por isso a troca vem para a fase 0, e não para o fim dos testes, como tínhamos combinado. Cada peça ganha uma chave própria e as antigas são desligadas; se algo da v1 parar, a antiga pode ser religada na hora enquanto eu corrijo. A lista de chaves diz onde cada uma vive, quem usa e como trocar, e um teste semanal confere a lista contra o que está de fato configurado.
- **Chave colada não se espalha.** Se uma chave for colada no app ou no WhatsApp, o código a troca por "\[chave removida\]" antes de gravar e responde pedindo para não colar chaves ali. Assim ela não chega à Helena, aos agentes nem ao histórico.
- **As ferramentas não olham para dentro.** "Buscar" e "ler página" só acessam endereços públicos da internet: nunca o próprio servidor, a rede interna, os outros serviços da VPS ou os dados da máquina. Cada redirecionamento é conferido de novo, e cada página tem limite de tamanho e de tempo.
- **Texto de IA é só texto.** Tudo o que um agente escreve aparece no app como texto puro: sem imagem, sem código de página e com link só para uma página lida na tarefa, mostrando o site. Caracteres invisíveis e comentários escondidos são tirados das páginas antes de o agente ler. O app tem uma trava do navegador que bloqueia imagens e scripts de fora. Numa decisão sua, o registro guarda as suas palavras e a opção escolhida; o que a IA escreveu entra só como citação curta e marcada.
- **O agente nasce sem segredo.** O processo do agente recebe só o necessário para rodar, sem nenhuma senha no ambiente, e o Hermes não instala nada sozinho durante a tarefa. O teste 3 confere isso a cada versão nova.
- **Ação de fora só pelo motor.** Cada serviço diz na ficha quais das 5 ações pode usar, e cada ferramenta diz o seu efeito: ler, gravar dentro ou agir fora. Uma ferramenta que age fora nunca roda dentro do agente: o motor executa depois do seu ok registrado, uma vez. Os 5 primeiros agentes não têm nenhuma.
- **Acessos escritos por extenso.** Em 30 de outubro de 2026, o Supabase muda o acesso padrão das tabelas novas, e o das funções ainda está em discussão. Por isso cada mudança no banco tira e dá cada acesso por extenso, e o teste 11 confere o resultado, valha a regra que valer.
- **Aprovação de risco só no app.** Gasto, cadastro, contato ou publicação nunca é aprovado pelo WhatsApp. Antes da primeira ação de fora, na fase 4, aprovar no app passa a pedir também o código do autenticador.

Cada linha acima tem prova no teste 11; a varredura de portas e a chamada às funções com a chave pública rodam de novo a cada mudança e toda semana.

## Manutenção sem depender do seu PC

Hoje só o seu PC alcança o banco, e isso trava a manutenção quando ele está desligado. Na v2, tudo passa pelo GitHub, que qualquer sessão minha alcança, e nada chega ao servidor sem o seu toque.

- **Repositório privado no GitHub.** Código, fichas, roteiros, regras, o manual do mantenedor e o roteiro de restauração ficam lá, com versão. O que não cabe no GitHub (variáveis do EasyPanel, tarefas agendadas do Supabase, ajustes do WhatsApp) tem uma lista com o retrato de cada item, conferida toda semana.
- **Publicar só com o seu toque.** Uma mudança enviada ao GitHub só roda os testes, sem nenhuma senha, e o EasyPanel não publica sozinho. Publicar é um botão no GitHub que só você aperta, inclusive pelo celular: ele confere que aquela versão passou nos testes, esvazia a fila, aplica a mudança do banco com um acesso só para isso e publica. O acesso das minhas sessões ao GitHub não consegue mudar esse caminho nem apertar o botão, e o teste 11 prova isso; se não provar, o botão passa para o próprio EasyPanel, e o GitHub fica sem nenhuma senha de publicação. A sua frase no tópico continua sendo a autorização; o botão é a trava. Eu junto as mudanças para pedir o toque no máximo uma vez por dia.
- **Publicação conferida e volta ensaiada.** Depois de publicar, o motor precisa mandar sinal de vida com a versão nova e levar um card de ensaio até o fim, sem gastar cota. Se não conseguir, a versão anterior volta sozinha e você recebe o aviso "publicação desfeita". Como o EasyPanel não tem botão de voltar versão, a publicação usa um ramo só de produção no GitHub: o botão move esse ramo para a versão aprovada, e voltar é mover o ramo de volta e publicar de novo. A pausa da fila que a publicação liga se desliga sozinha em 20 minutos; é a mesma do botão "Pausar tudo", que você usa se algo sair do controle. A volta é ensaiada antes do portão da fase 2, com o tempo medido.
- **O motor confere a própria ligação.** Ao ligar, o motor confere que está no Supabase certo, pelo caminho certo e com o acesso limitado dele, nunca com o de administrador, e testa os avisos internos do banco que o DBOS usa, que só chegam pelo caminho certo. Sem o endereço do banco, o DBOS usaria um banco local sem avisar, e tudo se perderia na publicação seguinte; por isso, se algo não bater, o motor não liga e avisa. Ele usa poucas conexões, para caber no limite do plano. E só um motor roda por vez: a publicação para o antigo antes de ligar o novo, e o motor só liga o DBOS depois de pegar uma trava única no banco, que o antigo segura enquanto vive. Sem isso, o DBOS gratuito retomaria no motor novo o que o antigo ainda está fazendo.
- **Quem conserta enxerga sem o seu PC.** A cada 3 horas, e sempre que uma publicação falhar, o GitHub atualiza um cartão fixo de diagnóstico: último sinal de vida, versão no ar, filas, etapa parada mais antiga, últimas falhas por tipo, tamanho do banco, último backup e avisos abertos. Só números, códigos e horários, nunca texto escrito por IA ou vindo da internet, para nenhuma instrução plantada chegar a quem pode mudar o sistema. O motor também registra cada vez que liga e cai, e a aba Técnico tem o mesmo resumo num botão Copiar.
- **Servidor dividido, com limite.** A VPS divide 4 núcleos com a v1, o WhatsApp, o app e o EasyPanel. O motor roda no máximo 3 agentes ao mesmo tempo, com limite de memória no serviço e em cada agente, e uma limpeza apaga as pastas de tarefa que sobrarem. O sinal de vida leva disco, memória e processador, com aviso em 80% de disco ou abaixo de 1,5 GB de memória livre. A montagem de cada versão nova roda com limite, para não disputar com as tarefas, e os registros do servidor têm tamanho máximo.
- **Atualizar sem surpresa.** Hermes, DBOS e o resto ficam fixados numa versão exata. Cada troca de versão repete o teste 3, compara pedido por pedido com a versão anterior, roda uma tarefa real por serviço e ensaia a mudança do DBOS e a volta num banco de teste. O sinal de vida registra o modelo, o provedor e a versão do Hermes usados de verdade, e um apelido apontando para um modelo que não existe vira aviso, nunca uma troca escondida.
- **Todo erro vira teste.** O caso que falhou entra na bateria, então aquele erro não volta sem ser pego.

| O que você quer mexer | Onde mexe | O que protege |
| --- | --- | --- |
| Trocar ou testar um modelo | Uma linha no catálogo de modelos; os agentes usam apelidos | 60 casos simulados, 60 reais e o placar de 20 casos rodado 3 vezes lado a lado; só troca se as notas conferidas pelo código caírem no máximo 5 pontos, e depois fica 48 horas em observação |
| Criar um agente | Uma pasta nova, com ficha, serviços e casos de teste | O validador recusa ficha incompleta, e ele nasce desligado |
| Nova ferramenta | Um arquivo no servidor de ferramentas, com o efeito dela, e o nome na ficha | Só recebe quem tem na ficha; ferramenta que age fora só roda pelo motor, depois do seu ok |
| Nova regra ou função | Nasce desligada e é ligada agente por agente | O validador recusa regra que contradiz outra |
| Ajustar as instruções de um agente | A ficha daquele agente | A bateria daquele agente roda antes de publicar |

## Backup e recuperação

O backup não pode depender só do Supabase: no plano grátis ele não faz backup nenhum. A fase 0 mede o tamanho do banco e confere o seu plano; a partir daí, o GitHub guarda cópias criptografadas e prova toda semana que elas voltam.

- **O que entra e quando.** Toda noite, as tabelas que mudam: cards, caixa de entrada, decisões e histórico. Uma vez por semana, o banco inteiro. Assim o backup cabe no limite de tráfego do plano grátis. Ficam as 2 últimas semanas.
- **Criptografado.** A chave que abre o backup fica num segredo do GitHub, usado só pelo teste de restauração, e uma cópia fica com você, fora do computador.
- **Prova toda semana.** Um teste restaura o último backup numa cópia completa do Supabase montada no próprio GitHub, confere a contagem de linhas de cada tabela contra a lista guardada com o backup e roda em cima dele as provas das 13 regras. Se o backup da noite falhar ou não chegar, o vigia do vigia avisa você.
- **Roteiro de restauração.** Um arquivo no repositório diz a ordem: extensões, acessos, estrutura, dados, as tarefas agendadas do vigia e do relógio, os segredos do cofre e, por fim, o endereço e as chaves novas em cada peça. Uma restauração que esquece o vigia parece saudável e fica sem vigilância, por isso a última etapa confere o vigia rodando. O roteiro é ensaiado uma vez, cronometrado, antes do portão da fase 2.
- **Antes de mexer no banco.** Toda mudança no banco guarda antes uma cópia das tabelas que ela toca, por 7 dias. As mudanças só acrescentam, então a versão anterior do motor continua funcionando; uma parte antiga só sai numa publicação seguinte, quando nenhuma versão no ar a usa mais.
- **O banco não estoura.** O plano grátis tem 500 MB, e acima disso o banco só aceita leitura: o motor, o vigia e o aviso de dentro do Supabase param juntos. Por isso cada passo do motor guarda só números e referências, o texto fica uma vez numa tabela nossa, e uma limpeza da noite apaga do DBOS as execuções terminadas há mais de 14 dias. O motor mede o banco a cada hora e avisa você direto, sem passar pelo Supabase, ao chegar a 70% ou se o banco recusar gravação. Se o teste 10 mostrar que não cabe por 60 dias, a escolha de plano vem para você.
- **O que fica fora, de propósito.** Senhas não entram no backup: a lista de chaves diz como trocar cada uma, e trocar é mais seguro que restaurar. A sessão do WhatsApp se refaz pelo QR code. O histórico da v1 que mora no Hermes fica onde está; se a v1 precisar ser refeita, ele é copiado antes, e a cópia é aberta e conferida antes de a v1 antiga ser apagada; a cópia nunca vai para o GitHub, porque contém tokens. As cópias das páginas lidas ficam inteiras até 7 dias depois de o card fechar; depois, só os trechos citados, que ficam no banco e entram no backup.

## Os 5 primeiros agentes e a primeira meta

A v2 começa com 5 agentes e uma meta real: o plano para recrutar as 10 primeiras pessoas na Mimix e no Hub. Os outros 16 ficam pausados, não apagados, e voltam um por vez na fase 4; até lá, o que só eles fazem continua na v1.

| Etapa | Quem faz | Quem revisa (reserva) | Depende de |
| --- | --- | --- | --- |
| E1 · Conta da receita: 10 pessoas × horas × US$ 0,50, em 3 cenários | Caio | Helena (Clara), e o código refaz cada conta | Nada |
| E2 · Roteiro de treinamento | Isabela | Helena (Caio) | Nada |
| E3 · Texto do convite, sem promessa de renda | Isabela | Helena (Caio), e o código barra termos de ganho | Nada |
| E4 · Checagem jurídica de imagem, voz e LGPD sobre E2 e E3 | Clara | Helena (você), e você lê antes de agir | E2 e E3 |
| E5 · Relatório final, com a lista do que só você faz | Helena | Clara (Caio) | E1 a E4 |

- **Ninguém revisa o que vai julgar.** A Clara não revisa o convite, porque é ela quem julga o convite na E4, inclusive promessa de ganho escondida. E o relatório final, que é o que você lê, tem revisora: a Clara, porque a autora é a Helena.
- **Revisor fora, reserva entra.** Se o revisor estiver pausado ou sem vaga, entra o reserva da ficha. Se a regra 4 impedir todos os reservas, a revisão vem para você, como cartão.
- **Ajuste tem caminho de volta.** Se a Clara achar um problema no convite, a E3 volta para a Isabela, passa de novo pela revisão, e a E4 é refeita sobre o texto novo. Depois de 2 voltas, a etapa vai para em resolução com as provas.
- **O Ravi entra quando precisar.** Pesquisa nova só entra quando o roteiro pede; a primeira meta não pede.
- **A Marina fica para a fase 4.** O acompanhamento do plano que hoje é dela fica com o motor e os roteiros.

**A primeira meta está pronta quando** E1 a E5 estiverem aprovadas, de ponta a ponta, sem ninguém destravar nada à mão, e visíveis no card. Nenhum agente cadastra, contata, gasta, assina ou publica: o que é de fora vem na lista do que só você faz.

## Treinar como funcionário

Você treina os agentes pelos botões e comentários do card, como treinaria um funcionário novo. Nada muda escondido: todo aprendizado vira texto com versão, que você pode ver e desfazer.

| Você faz no card | Vira | Vale para |
| --- | --- | --- |
| Pede ajuste com um comentário e o motivo marcado | Correção daquele resultado e proposta de lição | Este card; a lição, só depois de passar nos testes |
| Comenta e marca "vale sempre" | Preferência no Manual do fundador | A empresa ou o serviço |
| Marca "Usar como exemplo" numa entrega toda conferida | Exemplo de ouro com data, que vale 90 dias, até 3 por serviço | As próximas entregas do serviço |
| Escreve "nunca faça isso" | Regra numerada, checada contra contradição | Todos os agentes do serviço |
| Repete a mesma correção 3 vezes | Proposta de mudança na ficha, para você aprovar | Aquele agente |

A IA não aprende sozinha de uma tarefa para outra: o aprendizado é o manual, os exemplos e as regras que o motor entrega em cada tarefa. Toda lição nasce como proposta e fica inativa até passar pela bateria de testes, então uma devolução injusta não ensina errado sem ninguém ver. Aprovar uma entrega não vira lição: um "sim" apressado não ensina o revisor a aceitar erro.

**Decisões sem contradição.** Cada decisão sua diz a que vale (empresa, agente, serviço ou card) e qual decisão antiga substitui. Se uma decisão nova contradiz outra, a Helena pergunta qual vale. Regras duras, como "orçamento até tanto", viram checagem de código, e cada execução registra quais decisões usou.

## Você no comando

Você abre uma tela no app e vê cada agente com luz verde, amarela ou vermelha, o que está fazendo e há quanto tempo. Você só é chamado para decidir.

- **Por agente:** tarefa atual, fila, última entrega, aprovação de primeira da semana e estado do disjuntor.
- **Por meta:** etapas feitas, em andamento e paradas, desenhadas como o plano.
- **Resumo diário da Helena, às 18h de Brasília:** o que foi feito, o que travou, o que precisa de você e as mudanças feitas no sistema, num cartão só.
- **Avisos no celular, pelo Telegram,** enviados pelo Supabase sem passar pela VPS e repetidos até chegar: card atrasado, decisão sua pendente, mensagem sem classificar, cota ou login do ChatGPT, regra quebrada, banco perto do limite, e motor, banco ou backup fora do ar. Se o próprio Supabase cair, o vigia do vigia avisa por e-mail e pelo Telegram, e o motor avisa direto. Uma vez por mês, um aviso de teste confirma que o caminho funciona.
- **Cartões de decisão:** opções A, B ou C, com a recomendação e a consequência de cada uma. Sua resposta vira uma decisão registrada, com as suas palavras, e chega às etapas seguintes; o que já estava pronto e dependia dela é refeito (regra 10).
- **Você não vira gargalo.** Um agente só pergunta nos pontos que o serviço prevê, cada card tem um limite de perguntas, e o painel mostra há quanto tempo a mais antiga espera.

## Os testes que decidem

Nenhuma fase avança por data, só por teste. Os testes de base rodam na fase 2, com a v1 funcionando ao lado como vai estar de verdade; se um falhar, a base é corrigida antes de construir em cima dela.

| # | O que testa | Como | Passa quando |
| --- | --- | --- | --- |
| 1 | Cota do ChatGPT | 20 tarefas reais num dia, com a v1 ligada, e o mesmo pedido mandado pelo WhatsApp e pela tela nova | A meta inteira cabe em até metade do limite, sem erro de cota, com o uso da v1 e o da v2 medidos separados, e cada mensagem trabalhada por um sistema só |
| 2 | Login | 48 horas com 3 ou mais tarefas em paralelo, e o teste força pelo menos 2 renovações do login, de processos ao mesmo tempo | Nenhum login derrubado, as renovações aparecem no registro do login, e nenhuma pasta de tarefa guarda token |
| 3 | Hermes travado | Um servidor falso no lugar da OpenAI grava cada pedido que o Hermes faz, em todos os serviços e a cada perfil gerado, e o agente tenta chamar ferramentas 200 vezes seguidas | Cada serviço recebe exatamente as ferramentas da ficha, inclusive os que não têm nenhuma; as instruções são só as da ficha; nenhuma senha aparece no ambiente; o laço é cortado no limite e a execução termina como limite de chamadas; o modelo é o da ficha; e as instruções e a configuração do perfil terminam iguais às que foram geradas |
| 4 | Quedas e publicações | Derrubar o motor 20 vezes e publicar 5 vezes seguidas no meio de um passo, uma delas trocando a versão, cancelando e respondendo no meio; ligar dois motores ao mesmo tempo; com uma vaga só, pôr na fila uma etapa de prioridade baixa de um agente e depois uma de prioridade alta de outro; voltar à versão anterior depois de uma mudança no banco; e publicar uma versão quebrada de propósito | Nenhum card perdido ou duplicado, nenhum processo sobrando, nada da versão antiga preso na fila e as mesmas vagas no fim; o segundo motor espera, e nenhuma etapa roda duas vezes; a etapa de prioridade alta roda primeiro; a versão anterior roda sobre o banco já mudado; cancelamento em até 15 segundos; a versão quebrada desfeita sozinha em até 10 minutos, com o aviso no seu celular |
| 5 | Validador | 60 respostas defeituosas (citações falsas, cortadas ou de outra cláusula, contas erradas ou com entrada sem origem, leis inventadas, artigos sem o trecho da tabela, sites parecidos e código plantado); depois 20 execuções reais | Recusa todos os defeitos e aceita as citações honestas; nas reais, no máximo 1 nova tentativa de formato e nada passa errado |
| 6 | Servidor | 3 tarefas ao mesmo tempo, com Gateway, WhatsApp e app no ar, uma publicação no meio, uma tarefa encerrada à força e outra estourando o tempo | Processador abaixo de 70%, pelo menos 2 GB de memória livres, nenhum processo ou pasta sobrando, e WhatsApp e app no ar o tempo todo |
| 7 | Avisos | Desligar a VPS, parar o motor, parar o relógio do Supabase, simular o Supabase fora e, no ambiente de teste, o banco só para leitura; e derrubar o canal de aviso uma vez | O aviso chega ao seu celular em até 15 minutos nos cinco casos, por um caminho que não depende da peça que caiu, e o aviso que falhou é reenviado |
| 8 | Backup | Toda semana, restaurar o último backup numa cópia completa do Supabase montada no GitHub; antes do portão da fase 2, um ensaio cronometrado | A contagem de linhas bate com a lista do backup, as 13 regras passam em cima dele, e o vigia e o relógio voltam a rodar |
| 9 | Revisor (fase 3) | 30 entregas com erros plantados de 7 tipos e 10 entregas limpas, de novo a cada troca de modelo ou de rubrica, e dois revisores de mentira: um que aprova tudo e outro que recusa tudo | Pega pelo menos 27 dos 30 erros e recusa no máximo 2 das 10 limpas, com o resultado mostrado por tipo de erro; os dois de mentira reprovam; o que escapar vira regra de código ou critério novo |
| 10 | Tamanho do banco | 72 horas com carga real e entregas do tamanho de verdade, com a limpeza da noite ligada | O banco para de crescer e, na conta, fica abaixo de 350 MB por pelo menos 60 dias |
| 11 | Segurança (fases 0 e 2) | Varredura de fora de todas as portas; cada função do banco chamada com a chave pública e com um usuário de fora; páginas plantadas com endereços internos, imagens e instruções invisíveis; a mesma mensagem do WhatsApp 10 vezes, inclusive forjada; e o acesso das minhas sessões tentando publicar | Só as portas previstas abertas; toda chamada de fora recusada; nada interno lido e nada escondido na tela; um card só e nada forjado aceito; nenhuma publicação sem o seu toque |

Além desses, cinco provas rodam sozinhas a cada mudança, antes de publicar: o validador das fichas (hoje, 9 de 9 defeitos plantados recusados), o teste que percorre todas as combinações da tabela de passagens, o simulador da esteira, com uma IA de mentira que trava, cai, estoura a cota, perde o login e muda de resposta, sequências aleatórias de eventos, inclusive os seus botões, que nunca podem passar do teto de execuções, e o motor ligado de propósito sem o endereço do banco, pelo caminho errado ou com acesso de administrador, que precisa se recusar a ligar.

**Se o teste 1 falhar:** a primeira saída é passar as tarefas simples para o GPT-6 Luna, que no Plus tem cota estimada de 350 a 3.000 mensagens a cada 5 horas, contra 15 a 160 do GPT-6.1 Sol. A segunda é uma decisão sua, entre o plano Pro e créditos avulsos; a DEC-014 (sem API paga) continua valendo nos dois casos.

**Se a conta do ChatGPT for suspensa:** é um dos riscos aceitos, porque a empresa roda numa conta só enquanto valer a DEC-014. Tudo pausa sem perder nada, você recebe o aviso, e a decisão entre as saídas já preparadas é sua.

## Fases com portão

&#91;embedded content: fases da v2 · 5 fases, um portão em cada\]

Cada fase termina com uma nova revisão independente, que tenta quebrar o que foi feito. A fase só avança com todos os testes dela passando e nenhum furo em aberto.

- **A fase 0 começa pela segurança.** Primeiro a checagem de invasão e a varredura de portas; depois as chaves trocadas, as funções do banco fechadas e o botão de publicar. Nada novo é construído antes do portão dela.
- **Antes do motor, um dia de prova.** A fase 2 começa provando o comando exato que vai rodar os agentes contra um servidor falso que grava cada pedido. Os limites, a pasta vazia, o login e a ordem de leitura das falhas são conferidos ali, antes de qualquer outra peça.
- **A v1 segue com o dia a dia.** Até a fase 3 provar que a v2 entrega melhor, cada pedido vai para um sistema só, e o que a v2 ainda não faz continua na v1.
- **O Codex fica para a fase 4.** Ele só entra como segundo executor depois de passar nos testes 3 e 5 com o próprio login e as mesmas ferramentas.

## O que preciso de você

Para seguir, uma aprovação. A fase 2 cria um serviço novo e tabelas novas; o que roda hoje só muda na fase 0, para fechar portas, trocar chaves e fechar as funções do banco, sempre depois da sua frase.

- [ ] Aprovar o roteiro das 10 pessoas (E1 a E5), ou dizer o que mudar
- [ ] Digitar no tópico: **aprovo o plano v3 e o roteiro das 10 pessoas, com o motor DBOS**
- [ ] Na fase 0, fazer o que só você pode fazer, com o passo a passo que eu mando numa mensagem só: remover as portas 9119 e 8642, rodar a checagem de invasão no console do EasyPanel, trocar as chaves, ligar a verificação em duas etapas, e criar o repositório privado, a conta do vigia do vigia e o robô de avisos no Telegram
- [ ] Na fase 0, digitar a frase de cada mudança no servidor e no banco: portas, chaves, funções e cadastro
- [ ] Da fase 2 em diante, apertar o botão de publicar quando eu pedir, no máximo uma vez por dia

Nenhuma chave passa pelo chat: você cola cada uma direto no Supabase ou no EasyPanel. Até a troca, cada pedido vai para um sistema só: a v1 continua com o dia a dia, e a v2 recebe só os testes e a meta das 10 pessoas, que sai da v1. Eu escrevo o código, as fichas e os testes; o que depender de clique seu, peço numa mensagem só.

## Anexo: as provas

### O que conferi

- **O modo de uma pergunta do Hermes não trava nada sozinho.** No modo `hermes -z`, que roda cada tarefa, o Hermes aprova sozinho qualquer ação, uma lista de ferramentas vazia libera todas, não existe limite de passos e o processo herda o ambiente de quem o abriu. Por isso o motor manda a lista de ferramentas por extenso, abre o processo sem senhas e corta o tempo por fora, e o nosso servidor de ferramentas conta as chamadas. O limite de passos que o plano antigo citava (`--max-turns`) é de outro modo do Hermes. ([código do modo -z](https://github.com/NousResearch/hermes-agent/blob/1e0c7730d791f5ce855c5c78935cfea6fb1e43a9/hermes_cli/oneshot.py))
- **Páginas longas e arquivos da pasta.** O Hermes corta todo resultado de ferramenta acima de 50 mil caracteres para uma prévia de 1.500, por isso "ler página" entrega a página em partes de até 20 mil. Arquivos de instruções da pasta onde ele roda viram regras, por isso cada tarefa roda numa pasta vazia. No fim, ele grava um registro de uso com o resultado, que é onde o motor lê o tipo da falha. ([limite de resultado](https://github.com/NousResearch/hermes-agent/blob/1e0c7730d791f5ce855c5c78935cfea6fb1e43a9/tools/budget_config.py))
- **Painel aberto já foi porta de invasão.** A documentação do Hermes diz que painéis e servidores de API abertos para a internet foram a entrada de uma campanha em junho de 2026, que deixava uma chave de acesso escondida no servidor. Por isso a fase 0 começa pela checagem de invasão. ([Hermes no Docker](https://github.com/NousResearch/hermes-agent/blob/1e0c7730d791f5ce855c5c78935cfea6fb1e43a9/website/docs/user-guide/docker.md))
- **O login por tarefa precisa morar dentro do Hermes da v2.** No código do Hermes, uma pasta de perfil dentro de "profiles" usa o login da pasta principal e, ao renovar, grava a renovação na principal, com trava entre processos. Uma cópia do login dentro da pasta da tarefa faria um processo reusar uma renovação já gasta, e a OpenAI derrubaria o acesso de todos. O mesmo vale para a adoção automática do login do Codex, que vem ligada e desligamos. ([renovação com trava](https://github.com/NousResearch/hermes-agent/commit/66ddd5f83cd1beac797f35a574ee2e59138bf13a))
- **O Hermes é parceiro oficial da OpenAI.** Desde 29/09/2026, a OpenAI deixa usar a cota do ChatGPT Plus e Pro em 16 ferramentas parceiras, e o Hermes Agent é uma delas. O uso conta no limite do seu plano e para quando o limite acaba. ([The New Stack](https://thenewstack.io/sign-in-with-chatgpt/))
- **Cota por plano.** No Plus, a OpenAI estima de 15 a 160 mensagens a cada 5 horas no GPT-6.1 Sol e de 350 a 3.000 no GPT-6 Luna. O Pro não tem limite de 5 horas, mas pode ter limite semanal. ([cotas do Codex](https://learn.chatgpt.com/codex/pricing))
- **O Codex fica para a fase 4.** O `codex exec` roda sem tela e aceita um formato obrigatório de resposta, mas tem login próprio, separado do Hermes. Ele só entra depois de passar nos testes 3 e 5. ([modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode))
- **DBOS no Supabase.** O DBOS guarda seus passos num esquema próprio do Supabase, e passo concluído nunca é refeito. Quatro detalhes da documentação mudaram o desenho: a proteção contra duplicação não funciona em filas divididas por agente, por isso cada execução ganha um número novo; uma etapa sem prioridade passa na frente das que têm, por isso existe um caminho só para entrar na fila; trabalho parado de uma versão antiga continua ocupando vaga, por isso o motor limpa a fila ao voltar; e ele só retoma fluxos da mesma versão do código. ([filas](https://docs.dbos.dev/python/tutorials/queue-tutorial) · [versões](https://docs.dbos.dev/python/tutorials/upgrading-workflows) · [DBOS e Supabase](https://docs.dbos.dev/integrations/supabase))
- **Sem endereço, o DBOS não avisa, e só retoma direito com um processo.** Se o endereço do banco faltar, o DBOS usa um banco local, que some na publicação seguinte. E, sem o serviço pago dele, a retomada só é garantida com um processo: ao ligar, ele retoma tudo o que estava pendente. Por isso o motor confere a própria ligação e só liga com a trava única do banco. ([configuração do DBOS](https://docs.dbos.dev/python/reference/configuration) · [perguntas frequentes do DBOS](https://docs.dbos.dev/faq) · [retomada](https://docs.dbos.dev/production/self-hosting/workflow-recovery))
- **Conexão com o Supabase.** A conexão direta só funciona em IPv6, a menos que se pague um adicional, e o pooler de sessão (porta 5432) funciona em IPv4 e aceita tudo o que o motor usa. Por isso o motor e o GitHub conectam pelo pooler de sessão. ([conexões do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres))
- **Limites do plano grátis do Supabase.** 500 MB de banco, 1 GB de arquivos, limite de tráfego, sem backup automático, e o projeto pausa depois de 1 semana sem uso. Acima de 500 MB, o banco passa a só aceitar leitura. ([preços do Supabase](https://supabase.com/pricing) · [tamanho do banco](https://supabase.com/docs/guides/platform/database-size))
- **Funções do banco abertas por padrão.** No Supabase, qualquer papel, inclusive o anônimo da chave pública, pode executar uma função do banco até que esse acesso seja tirado. ([funções do Supabase](https://supabase.com/docs/guides/database/functions))
- **Chaves por peça.** O Supabase tem chaves secretas novas, que podem ser uma por peça, e desligar as chaves antigas pode ser desfeito. ([chaves do Supabase](https://supabase.com/docs/guides/api/api-keys))
- **Aprovação no GitHub.** Em repositório privado, o GitHub não oferece aprovação obrigatória antes de publicar nos planos Free, Pro e Team. Por isso a trava é o botão de publicar, que funciona no aplicativo do GitHub no celular, e o acesso das minhas sessões não tem as permissões de mudar os fluxos nem de apertar o botão. ([ambientes do GitHub](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment) · [permissões](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) · [botão no celular](https://github.blog/changelog/2024-07-30-run-workflows-set-as-workflow_dispatch-manually))
- **O WhatsApp repete mensagens.** A Evolution API tenta entregar cada aviso de mensagem até 10 vezes, e só o aviso configurado por instância aceita uma senha no cabeçalho. Por isso a mesma mensagem vira um card só, e o aviso é configurado na instância, com a senha. ([configuração da Evolution API](https://github.com/EvolutionAPI/evolution-api/blob/main/.env.example))
- **Portas do Docker passam por cima do firewall.** Uma porta publicada pelo Docker fica aberta mesmo com o firewall do servidor fechado, por isso a varredura é feita de fora. ([Docker e firewall](https://docs.docker.com/engine/network/packet-filtering-firewalls/))
- **Vigia do vigia.** O healthchecks.io avisa quando um sinal esperado para de chegar, por e-mail ou Telegram; o plano gratuito cobre 20 checagens. ([como funciona](https://healthchecks.io/docs/configuring_checks/) · [preços](https://healthchecks.io/pricing/))
- **Aviso por canal próprio.** O envio de dentro do Supabase não tenta de novo sozinho e guarda a resposta só por 6 horas, por isso cada aviso fica numa tabela e é reenviado até chegar. O ntfy, a outra opção, trata o nome do canal como senha e bloqueia rápido quem manda muito, por isso o canal é o Telegram. ([envio do Supabase](https://supabase.com/docs/guides/database/extensions/pg_net) · [ntfy](https://docs.ntfy.sh/faq/))

### Motores comparados

| Motor | O que exige | Licença | Veredito |
| --- | --- | --- | --- |
| DBOS | Só uma biblioteca dentro do nosso serviço, gravando no Supabase que já temos | MIT, aberta | Recomendado |
| Absurd | Um arquivo SQL e uma biblioteca, gravando no Postgres | Apache 2.0, aberta | Boa ideia, mas nova demais: existe desde o fim de 2025 |
| pgflow | Feito para o Supabase, mas o trabalho roda em Edge Functions | Apache 2.0, aberta | Não serve: uma tarefa nossa leva até 15 minutos, e uma Edge Function roda por poucos minutos no máximo |
| Hatchet | Um servidor próprio para o motor, além do nosso | MIT, aberta | Funciona, mas é mais um servidor numa VPS que já está apertada |
| Temporal | Vários serviços próprios e um banco | MIT, aberta | Pesado demais para 4 núcleos divididos |
| Trigger.dev | Vários contêineres para hospedar por conta própria | Apache 2.0, aberta | Pesado demais para a VPS |
| Inngest | Servidor próprio, com Redis e Postgres | SSPL, restritiva | Mais peças e licença restritiva |
| Restate | Servidor próprio, com armazenamento próprio | BSL, restritiva | Um segundo lugar guardando o estado do card |
| Feito à mão (plano anterior) | Escrever reservas, tentativas, filas e recuperação | Nossa | É o tipo de código que travou a v1 |

Também olhei Windmill e n8n (na tabela de caminhos, abaixo) e o Procrastinate, que é só uma fila e não retoma passos.

### Caminhos comparados

| Caminho | Ponto forte | Furo | Veredito |
| --- | --- | --- | --- |
| O plano anterior, como estava | Princípios certos e completos | Motor feito à mão, base não provada e grande antes do primeiro card | Corrigir |
| Trilho no banco sem biblioteca (a primeira versão da v2.1) | Nada novo para aprender | Reservas, tentativas e recuperação escritas à mão de novo | Não |
| O plano v3 | Mesmos princípios, menos código e base provada antes de crescer | Depende do DBOS, mas o estado do card fica em tabelas nossas, então dá para trocar o motor sem mexer nos cards | Recomendado |
| n8n ou Windmill | Telas prontas para desenhar fluxos | Mais um sistema na VPS, e a lógica do card ficaria espalhada em telas, longe dos testes | Não |
| Um agente só, sem equipe | Simples de montar | Perde a especialização e os revisores, que são o que segura a qualidade | Não |
| Plataformas pagas hospedadas | Nada para manter | Exigem API paga ou mensalidade, contra a DEC-014 | Não agora |

**Base deste plano:** [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) · [Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · [Microsoft, padrões de orquestração](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns) · [12-Factor Agents](https://humanlayer.dev/blog/12-factor-agents) · [Berkeley, por que sistemas multiagente falham](https://arxiv.org/abs/2503.13657) · [Railway, sistema multiagente](https://docs.railway.com/guides/multi-agent-system)

## Segunda análise: o plano funciona? Existe um melhor?

**Veredito.** A direção do plano está certa e continua: o código decide o processo, a IA decide o conteúdo, e todo trabalho anda num card. Mas, do jeito que estava escrito, o plano tinha 3 furos de base, do mesmo tipo dos que travaram a v1. Existe um plano melhor, com os mesmos princípios e menos risco: motor pronto e testado em vez de escrito à mão, a base provada com testes antes de crescer, e um card real andando de ponta a ponta antes de todo o resto. É esse que recomendo aprovar.

### Os 3 furos de base

1. **O motor seria escrito à mão.** Reservas de etapa, novas tentativas, o conferente de cada minuto, números por execução e esvaziar antes de publicar: é o mesmo tipo de código feito à mão que gerou as 7 travas da v1. Cada peça funciona sozinha e quebra na combinação com as outras.
2. **A base não estava provada.** O plano supunha, sem testar, que a cota do ChatGPT aguenta, que o login compartilhado não cai, que o Hermes aceita rodar travado, que a VPS dá conta e que o Supabase comporta o histórico. Se uma dessas falhar, todo o resto para junto.
3. **Grande demais antes do primeiro card real.** Seriam semanas construindo verificador, laboratório, placar e canário antes de um único card andar sozinho. E furo de base só aparece com card real andando.

### O plano corrigido

Ficam iguais os princípios, as fichas, o cardápio de serviços, as 5 ações, os 3 portões, o relatório do card e o treino pelos botões. As fases 0 e 1 da v2.1 que comecei pelo seu PC também continuam valendo: as 5 fichas, os 7 modelos de entrega e o roteiro das 10 pessoas já estão prontos e validados. Mudam o jeito de fazer o motor e a ordem de construir:

- **Motor pronto, trilho nosso.** O motor passa a ser o DBOS, uma biblioteca aberta e gratuita (licença MIT) que roda dentro do nosso serviço e grava cada passo concluído no próprio Supabase. Se o servidor cair, ele retoma do último passo concluído. Filas por agente, limite de vagas, prioridade, novas tentativas e prazos já vêm prontos. O que é nosso fica no banco: a tabela de estados do card e a única função que muda o estado, que recusa qualquer passagem fora da tabela.
- **O agente vira uma função.** Ele recebe o pacote do card e devolve uma das 5 ações, num formato conferido. Não tem nenhuma ferramenta que grava no banco: quem confere e grava é o motor, uma vez só, com chave única. Assim, refazer um passo que caiu nunca duplica nada, e um texto plantado num site não consegue mexer no banco.
- **Executor trocável.** Cada tarefa roda num processo do Hermes travado: só as ferramentas da ficha, memória própria desligada, limite de passos, e o motor encerra o processo inteiro no tempo máximo. O Codex, da própria OpenAI, fica pronto como segundo executor, testado e desligado, para o caso de o Hermes falhar.
- **A v1 não é tocada.** A v2 nasce num serviço novo e em tabelas próprias. A v1 segue rodando o que está em andamento até a v2 provar que entrega melhor.
- **Esqueleto primeiro.** Antes de qualquer outra peça, um card real anda sozinho de ponta a ponta: a conta da receita do Caio (E1 do roteiro), do seu pedido até o relatório no app.
- **Testes que decidem.** A fase 2 só termina quando os 6 primeiros testes abaixo passam. Se um falhar, a base é corrigida antes de construir em cima dela.

### Os testes que decidem

| # | O que testa | Como | Passa quando |
| --- | --- | --- | --- |
| 1 | Cota do ChatGPT | 20 tarefas reais num dia, medindo o uso | A meta inteira cabe em até metade do limite, sem nenhum erro de cota |
| 2 | Login compartilhado | 48 horas com tarefas em paralelo, Hermes na versão corrigida | Nenhum login derrubado |
| 3 | Hermes travado | Pedir de propósito terminal, memória e gravação no banco | Tudo recusado e nada gravado no perfil |
| 4 | Quedas e publicações | Derrubar o motor 20 vezes e publicar 5 vezes, sempre no meio de um passo | Nenhum card perdido ou duplicado, e o aviso de queda chega no seu celular |
| 5 | Formato | 60 respostas defeituosas do simulador e 20 execuções reais | O validador recusa as 60; nas reais, no máximo 1 precisa de nova tentativa e nenhuma passa errada |
| 6 | Servidor | 3 tarefas ao mesmo tempo, com Gateway, WhatsApp e app no ar | Processador abaixo de 70% e pelo menos 2 GB de memória livres |
| 7 | Revisor (fase 3) | 10 entregas com erros plantados | O revisor pega pelo menos 9 |

**Se o teste 1 falhar:** a primeira saída é passar as tarefas simples para o GPT-6 Luna, que no plano Plus tem uma cota estimada de 350 a 3.000 mensagens a cada 5 horas, contra 15 a 160 do GPT-6.1 Sol. A segunda é uma decisão sua, entre o plano Pro e créditos avulsos. A DEC-014 (sem API paga) continua valendo nos dois casos.

### O que sai ou fica para depois

| No plano anterior | Agora | Por quê |
| --- | --- | --- |
| Verificador formal gerado de uma especificação | A tabela de passagens no banco e um teste que percorre todas as combinações | A tabela é pequena, então testar todas as combinações já é prova, com muito menos código |
| Conferente de cada minuto, reservas, números por execução, esvaziar antes de publicar | Vêm prontos no DBOS | Código pronto e testado no lugar de código novo |
| Guardião próprio do login do ChatGPT | Adiado | O Hermes corrigiu a disputa do login em 14/09/2026, e o teste 2 prova; só construímos se falhar |
| Passe de uma tarefa só | Desnecessário | O agente não tem ferramenta que grava |
| Laboratório, placar e canário | Fase 4 | Servem para trocar modelo; antes disso, só atrasam o primeiro card |
| 60 rodadas reais por serviço | Simulador para o formato e 20 rodadas reais | O validador já garante o formato, e gastar cota em teste tira cota dos cards |
| Segundo revisor em jurídico e finanças | Só no jurídico | A conta do Caio é refeita pelo código, que é mais seguro do que um segundo revisor |

### Furos novos e consertos

Atacando o plano de novo, achei mais 7 furos. Todos têm conserto e uma fase.

| Furo | Conserto | Fase |
| --- | --- | --- |
| Duas portas do Hermes abertas para a internet: 9119 (painel) e 8642 (acesso direto aos agentes) | Você remove as duas no EasyPanel e eu confiro de fora | 0 |
| Regras em mais de um lugar (documento, pasta das fichas, banco) voltariam a se contradizer | Um lugar só, com versão, para fichas, modelos e roteiros; o documento só resume | 0 |
| Citação traduzida nunca bate com a página lida, e o validador reprovaria tudo | A citação fica no idioma original, e a tradução vai num campo à parte | 2 |
| Cópias das páginas lidas e o histórico do motor encheriam o banco (o plano grátis do Supabase tem 500 MB) | Cópias no armazenamento de arquivos do Supabase, que não ocupa o banco, e histórico do motor com prazo de guarda | 2 |
| Publicar código novo deixaria o motor sem retomar os cards da versão anterior | Versão do motor fixada, mudanças entrando por chaves de compatibilidade do próprio DBOS, e o teste 4 publicando no meio de um passo | 2 |
| Se a VPS inteira cair, o aviso cai junto, porque o WhatsApp roda nela | O Supabase confere os sinais de vida e manda o aviso direto para o seu celular, sem passar pela VPS | 2 |
| Revisor no mesmo modelo do autor erra nos mesmos pontos | Erros plantados (teste 7), calibração pelos seus 👍 e 👎, e outro modelo quando houver | 3 |

As provas desta análise (o que conferi, os motores e os caminhos comparados, com as fontes) estão no [anexo](#mj96h245ddc.48749). O que você precisa fazer agora está em [O que preciso de você](#mj96h245ddc.15627).

## Resposta direta

Este plano foi refeito em cima do seu fluxo: você fala com a Helena, vira um card, o card anda sozinho pelos responsáveis e volta pronto e organizado para você.

**É o melhor plano?** A primeira versão era boa, mas faltavam cinco peças que o seu fluxo deixou claras: a jornada do card, a garantia de que os agentes não saem do processo, a prova de que nenhum card some ou fica sem dono, o relatório do card com treino pelos botões, e a manutenção em minutos. Agora estão neste documento.

**Eles vão seguir?** Vão, mas não por obediência. O card só anda por 5 ações que o código confere, e qualquer outra coisa é recusada na hora com o motivo. Um agente não consegue pular etapa, mandar para o lugar errado nem encerrar sem entregar.

**Dá para não ter erro nenhum?** Na lógica, sim: nenhum card some, se duplica, anda para o lugar errado ou fica sem dono e sem prazo. O banco garante isso, e o teste de quedas prova antes de ir ao ar. O que a lógica não controla é o mundo de fora: a cota do ChatGPT pode acabar e um site pode cair. Aí o card espera, mas a espera aparece no card, com o motivo e a previsão. No conteúdo, nenhum funcionário, humano ou IA, chega a zero. O que a v2 garante é que o erro é pego antes de chegar em você, aparece no card e vira teste para nunca se repetir.

**O contrato com você:** o processo nunca falha em silêncio e nunca perde nem duplica trabalho. Erro de conteúdo é raro, barrado num portão quando dá para checar, sempre visível, e cada um vira teste.

**Você fez o seu melhor?** Depois de escrever, ataquei o próprio plano com uma revisão crítica independente. Ela achou 20 furos e duas frases erradas; todos estão corrigidos aqui, e a seção "Revisão crítica" mostra cada um e a fase em que é fechado. Antes de você aprovar, fiz uma segunda análise contra 11 motores prontos e 5 caminhos diferentes. Ela mudou o motor e a ordem de construir, e está no começo deste documento.

| Os cursos ensinam | A v2 faz a mais |
| --- | --- |
| Um gerente e especialistas | O card como unidade de trabalho, sempre com um dono só |
| Instruções escritas para cada agente | Ficha com versão, gerada e checada automaticamente |
| O agente decide o próximo passo | Decide, mas só entre opções válidas que o código e o banco conferem |
| Testar na mão | Simulador com IA de mentira, bateria de casos reais e testes de quebra antes de ir ao ar |
| Ler os logs quando quebra | Raio-X do card e repetição exata do passo que falhou |
| Humano aprovando tudo ou nada | Você só onde há risco, com cartão pronto para decidir |
| Memória do agente | Manual do fundador, exemplos de ouro e lições, tudo com versão |
| Trocar de modelo e torcer | Apelidos, placar lado a lado e teste em um agente com volta automática |

## A jornada do card

Cada pedido seu vira um card, e o card só anda por regras de código até voltar pronto para você. A Helena entende e pergunta, os agentes fazem o conteúdo e o motor garante a lógica.

- **Leitura de volta.** Num pedido grande, a Helena responde "Entendi assim: objetivo, prazo e como é o pronto. Confirma?" antes de criar o card. É a técnica que a aviação usa no rádio para não haver mal-entendido.
- **Ordem de serviço.** O card nasce com campos fixos: empresa, o que você quer, como é o pronto, prazo, prioridade e o que não pode (gastar, publicar). A Helena pergunta só o que faltar.
- **Um dono sempre.** Do primeiro ao último minuto, o card tem exatamente um responsável e um prazo para o próximo passo.
- **Tudo dentro do card.** Nenhum agente trabalha fora de um card. Entregas, revisões, perguntas e custo ficam nele.
- **Qualquer canal.** Você fala com a Helena no app, no WhatsApp ou no painel. Tudo vira card, e ela responde com o link dele.

**Nenhuma mensagem se perde.** Toda mensagem sua é gravada pelo código antes de qualquer IA, com número de protocolo. A Helena só classifica cada uma em: card novo, ajuste de um card, resposta a uma pergunta, cancelamento ou conversa. Se ela falhar duas vezes, o código cria o card com o seu texto e pede para você escolher o serviço.

**O pedido original viaja inteiro.** Seu texto, os campos da ordem e o critério de pronto acompanham todas as etapas e todas as revisões. Resumos se somam a ele, nunca o substituem; assim prazo, orçamento e restrições não se perdem no caminho.

## A ideia central: o código decide o processo, a IA decide o conteúdo

As 7 travas de ontem nasceram de decisões mecânicas deixadas para a IA. Na v2, essas decisões viram regra de programa. A IA só escreve o conteúdo e escolhe entre opções que o código já validou.

| Decisão | Hoje (a IA decide) | Na v2 (o código decide) | Trava que deixa de existir |
| --- | --- | --- | --- |
| Quem recebe a tarefa | Helena escreve o código do agente | O motor escolhe pelo cardápio de serviços | Pedro sem o código AGT-18 |
| O que vem depois da aprovação | Helena precisa lembrar | O plano da meta já diz, e o motor libera a próxima etapa | Próximo passo não criado |
| Quando a tarefa acabou | Texto livre, como "encaminhamento encerrado" | Lista fechada de finais válidos | Encerramento não reconhecido |
| Se a tarefa cabe | Descobre ao falhar | Cada serviço tem tamanho máximo, e o motor divide antes | Entrega grande demais |
| O que fazer na falha | Regra solta no texto do agente | Manual de falhas no código | Erro de tamanho rotulado como senha |
| Qual regra vale | Regras espalhadas em 4 lugares | Um arquivo de regras com número e versão | Regra velha brigando com nova |
| Pode pesquisar sem pedir | Helena interpretava | Classe de risco fixa em cada serviço | Helena pedindo autorização à toa |

O responsável continua decidindo para quem vai a próxima parte, do jeito que você descreveu. A diferença é que ele escolhe numa lista de opções válidas, e o motor confere antes de mover o card.

## Por que os agentes vão seguir

Hoje o agente lê as regras e pode escorregar. Na v2 ele tem só 5 ações que mudam um card, e o código confere cada uma antes de aceitar.

| Ação | Para que serve | O que o código confere |
| --- | --- | --- |
| Entregar | Devolver o trabalho pronto | Modelo do serviço, tamanho, fontes e critério de pronto |
| Pedir sub-card | Passar uma parte para outro agente | O serviço está no cardápio, o agente existe, não é ele mesmo, cabe no orçamento e não forma ciclo |
| Perguntar | Tirar uma dúvida que só você responde | Vai pela Helena, com opções; o card espera sem perder o dono |
| Devolver a quem pediu | Pedido impossível ou ambíguo | Motivo obrigatório; volta para quem pediu |
| Registrar falha | Algo deu errado | O tipo da falha, que dispara o manual de falhas |

Qualquer outra resposta, como texto solto ou ação fora da lista, conta como formato errado e volta com o motivo. Além disso, cada agente recebe só um pacote curto por tarefa: o card, o modelo do serviço, as 5 ações, e as lições e exemplos daquele serviço. Contexto curto e focado é o que mais melhora a obediência, segundo os guias de produção.

**Uma cópia limpa do agente por tarefa.** O Hermes tem recursos próprios que mudam o comportamento fora da ficha: memória que ele mesmo escreve, habilidades que ele mesmo cria, busca em conversas antigas e resumo automático de contexto. Na v2, cada tarefa roda numa cópia do perfil gerada da ficha, conferida no início e apagada no fim. Esses recursos ficam desligados em produção, e o Hermes fica fixado numa versão exata.

**Sem ação final, não conta.** Uma execução que termina sem exatamente uma das 5 ações é a falha "sem ação", mesmo que o texto pareça uma resposta. E se o agente não responder dentro do tempo máximo da ficha, o motor encerra o processo inteiro e a etapa volta para a fila.

**As falhas mais comuns no estudo de Berkeley e como a v2 fecha cada uma** ([fonte](https://arxiv.org/abs/2503.13657)):

| Falha no estudo | Parte das falhas | Como a v2 fecha |
| --- | --- | --- |
| Repetir passos | 17% | Chave única por execução; o motor não deixa repetir |
| Dizer uma coisa e fazer outra | 14% | Só valem as 5 ações conferidas, não o texto |
| Não pedir esclarecimento | 12% | Leitura de volta no pedido e a ação Perguntar |
| Desobedecer a tarefa | 11% | Modelo de entrega e validador automático |
| Não saber quando parar | 10% | Critério de pronto e finais fixos no motor |
| Encerrar antes da hora | 8% | O card só fecha com entrega aprovada nos portões |
| Verificação ausente ou errada | 7% + 7% | Validador de código e revisor com rubrica |

No estudo, 42% das falhas nasceram na especificação, 37% no desalinhamento entre agentes e 21% na verificação. A v2 ataca as três pela raiz, em vez de pedir cuidado aos agentes.

## A ficha de cada agente e o cardápio de serviços

Cada agente vira um funcionário com uma ficha única e um cardápio de 2 a 4 serviços. A Helena não escreve tarefas em texto livre: ela pede um serviço do cardápio e preenche os campos dele.

As fichas não começam do zero. As 21 habilidades de função que já existem (missão, entradas, entregas, critérios e limites) viram as fichas. É migração, não reescrita.

**O que vai na ficha** (exemplo da Clara):

| Campo | O que guarda | Exemplo |
| --- | --- | --- |
| Identidade | Código, nome e departamento | AGT-06, Clara, Jurídico |
| Missão | Uma frase | Proteger as empresas de risco legal antes de qualquer compromisso |
| Empresas | Quais atende | iGreen, Saúde, Humano Digital, eLiving |
| Serviços | O cardápio dela | Parecer de termos de uso; checagem LGPD e direito de imagem; riscos de um parceiro |
| Ferramentas | Só o que os serviços usam | Busca e leitura de páginas; nada de cadastro ou envio |
| Revisor | Quem revisa as entregas | Helena |
| Limites | Passos, tempo, buscas e tamanho | 24 passos, 25 buscas, 8.000 caracteres |
| Nível de modelo | Simples, padrão ou profundo | Profundo |
| Métricas | Como é avaliada | Aprovação de primeira, retrabalho, tempo médio |

As instruções que o agente lê, a lista do time que a Helena recebe e o que o despachante libera são todos gerados da ficha. Não existe mais um lugar dizendo uma coisa e outro dizendo outra.

**O que cada serviço define:**

- Entrada obrigatória: os campos que quem pede precisa preencher.
- Modelo da entrega: seções fixas, na ordem.
- Tamanho máximo: desenhado para caber em 8.000 caracteres e 24 passos.
- Critério de pronto: a lista que o validador confere sozinho.
- Rubrica do revisor: os critérios que recebem nota.
- Classe de risco: livre, interno ou externo.
- Orçamento: buscas e tempo.

**Exemplo: Clara, Parecer de termos de uso.** Entrada: link oficial dos termos, empresa e pergunta. Entrega: resumo de até 500 caracteres, cláusulas citadas com trecho e link, riscos classificados em alto, médio ou baixo, recomendação e perguntas abertas. Pronto quando toda afirmação cita uma cláusula da página oficial aberta inteira. Classe: livre.

## O motor: como o trabalho anda

Uma meta vira um plano com etapas e dependências, montado uma vez a partir de um roteiro pronto. O motor libera cada etapa quando as anteriores terminam, e em paralelo quando dá.

- **Roteiros prontos.** "Recrutar pessoas", "Avaliar plataforma parceira" e "Lançar campanha" já trazem as etapas típicas e o serviço de cada uma. A Helena adapta o roteiro, não inventa do zero.
- **Estados fixos.** Cada etapa passa por: aguardando dependência, na fila, executando, validação, revisão e um final. Finais de verdade são só três: pronta, cancelada, ou encerrada com falha que você reconheceu. "Em resolução" e "esperando você" são estacionamentos, com dono, prazo, lembretes e um padrão que você aprova antes (interno: segue a recomendação e avisa; externo: cancela).
- **A Helena decide só três coisas.** Montar ou ajustar o plano, aprovar ou devolver quando é revisora, e perguntar a você. A resposta tem formato fixo; fora dele, o motor devolve na hora.
- **Cota de pesquisa.** Cada roteiro diz quantas etapas de pesquisa a meta pode ter. Passar disso exige justificativa registrada. Isso ataca o risco de muita pesquisa e nenhuma receita.
- **Fila por agente e disjuntor.** Se um agente falha 3 vezes seguidas, o disjuntor pausa só ele e acende a luz vermelha no painel. Os outros seguem.
- **Versão de regra no lugar de data fixa.** Cada tarefa carrega a versão das regras com que nasceu. Regra nova dá uma nova chance só às tarefas da versão antiga. Isso substitui o corte por data que pusemos no banco ontem.
- **Nada duplicado.** Cada execução tem uma chave única, então tentar de novo nunca cria entrega repetida.

* **Sub-cards.** O responsável pode dividir o card em sub-cards para outros agentes, escolhendo do cardápio. O card pai espera todos voltarem, com no máximo 2 níveis, um limite de sub-cards por etapa e um orçamento para a meta inteira. Pedir sub-card encerra a execução e libera a vaga do agente, e repetir o pedido nunca duplica sub-cards.
* **Limite de trabalho por agente.** Cada agente pega no máximo 1 ou 2 cards por vez, por prioridade e ordem de chegada. Isso evita sobrecarga e estouro da cota do modelo.
* **Prazo em cada card.** Com 80% do prazo gasto, o card fica amarelo; no prazo, a Helena é chamada; uma hora depois, você é avisado.
* **A Helena não é gargalo.** Quem distribui é o motor. Se a Helena falhar, os cards em andamento seguem, e pedidos novos entram por um formulário simples no app.

**O motor não perde o passo.** O avanço não depende de um aviso que pode se perder. O motor usa o DBOS, que grava no Supabase cada passo concluído; se o servidor cair, ele retoma do último passo concluído e refaz só o que estava pela metade. As filas por agente, o limite de vagas, a prioridade da cota, as novas tentativas e os prazos vêm prontos nele. O raio-X lê essas gravações e escreve no card o que ele está esperando, de quem e até quando. Foi a falta disso que causou duas das travas de ontem.

**Plano conferido antes de começar.** Todo plano da Helena é checado ao ser ativado: sem ciclos, todo serviço existe, cada etapa recebe o que precisa das anteriores e o orçamento cabe. Se não passar, vale o roteiro original. Cada serviço tem um dono reserva e um revisor reserva definidos na ficha, então quem escolhe o substituto é o código.

**Entrega grande é dividida no plano.** O plano de recrutar 10 pessoas não cabe em 8.000 caracteres. Por isso a divisão por seções acontece ao montar o plano, e o relatório final junta as seções aprovadas. Se uma seção aprovada mudar depois, as partes que a usaram são refeitas antes de o card ficar pronto.

**Um contador de retrabalho por card.** Toda volta para trás soma no mesmo contador: devolução do revisor, devolução a quem pediu, pedido de ajuste e substituição. No limite, o card vai para "em resolução" com as provas.

Toda etapa termina aprovada ou fica estacionada com dono, prazo e um padrão já aprovado por você; nenhuma fica parada sem dono.

## Lógica exata: as regras que nunca quebram

A lógica do card é uma tabela de estados e passagens guardada no banco. Como a tabela é pequena, um teste automático percorre todas as combinações antes de cada publicação, e isso vale como prova, não só como amostra. É a mesma ideia que a Amazon usa nos sistemas da AWS, em escala menor ([fonte](https://www.amazon.science/publications/how-amazon-web-services-uses-formal-methods)).

Cada regra abaixo é protegida em até três camadas:

| Regra que nunca pode quebrar | Prova antes de publicar | Trava no banco | Vigia no ar |
| --- | --- | --- | --- |
| Todo card aberto tem exatamente um dono e um prazo | Sim | Sim | Sim |
| Todo card termina pronto, cancelado ou encerrado por você; esperar você tem prazo e um padrão aprovado | Sim | Não | Sim |
| Uma etapa nunca é trabalhada por dois ao mesmo tempo | Sim | Sim | Sim |
| Só a execução atual mexe na etapa; execução antiga ou cancelada é ignorada | Sim | Sim | Sim |
| Nenhum ciclo: um serviço nunca aparece duas vezes na mesma cadeia | Sim | Sim | Sim |
| O card pai só fecha depois de todos os sub-cards, com no máximo 2 níveis | Sim | Sim | Sim |
| Toda volta para trás passa por um contador com limite | Sim | Sim | Sim |
| Nada externo (publicar, contatar, gastar) sem sua autorização, e no máximo uma vez | Sim | Sim | Sim |
| Toda entrega aprovada passou pelos portões do seu serviço | Sim | Sim | Sim |
| Card pronto nunca usa informação velha | Sim | Sim | Sim |
| Toda mensagem sua vira exatamente um card ou entra num card existente | Sim | Sim | Sim |
| Falha do provedor ou do servidor não gasta tentativa nem pune o agente | Sim | Não | Sim |
| Toda mudança fica no histórico, e o histórico reconstrói o card | Sim | Sim | Sim |

- **Prova antes de publicar.** Um teste automático percorre todas as combinações possíveis: cada tipo de resposta de agente em cada passo, queda do servidor no meio, entrega repetida e prazo esgotado. Se uma combinação quebrar uma regra, a mudança não sai.
- **Trava no banco.** O card só muda de estado por uma única função do banco, que confere a tabela de passagens permitidas e a versão do card. Mesmo que um programa erre, o banco recusa o movimento inválido.
- **Vigia no ar.** A cada 5 minutos, uma checagem que roda dentro do Supabase, fora do servidor dos agentes, confere as regras em todos os cards abertos e os sinais de vida do motor. Se alguma falhar, aquele card congela, a luz fica vermelha e você é avisado. Nunca em silêncio.
- **Queda no meio do caminho.** Se o servidor cair durante um passo, o motor retoma do último passo concluído e refaz o que estava pela metade; a gravação final usa chave única, então nada se duplica.

**Só o motor escreve.** Os agentes não têm nenhuma ferramenta que grava no banco: devolvem a resposta, e o motor confere e grava uma vez só, com chave única. Uma execução antiga ou cancelada não tem como escrever, e o tempo esgotado encerra o processo inteiro do agente, não só a conversa.

**Uma tabela só.** A tabela de passagens mora no banco, e é ela mesma que o teste percorre; não existe uma cópia em outro lugar que possa ficar diferente. Por cima, um teste de bagunça manda ações repetidas, respostas atrasadas de execuções antigas, duas cópias do motor pegando a mesma etapa e quedas entre cada gravação.

A prova cobre a lógica. A qualidade do conteúdo continua coberta pelos 3 portões da seção seguinte.

## Qualidade em 3 portões

Cada entrega passa por três portões, do mais barato ao mais caro. O revisor só gasta tempo com o que já está bem formado, e você só vê o que tem risco.

1. **Validador automático** (código, instantâneo, sem custo): confere seções, tamanho, idioma, fontes com link e ações proibidas. Toda citação precisa existir, palavra por palavra, na cópia da página que o agente leu; toda conta do Caio é refeita pelo código; todo artigo de lei citado é conferido numa tabela de artigos reais. Se falhar, a entrega volta ao autor na hora com o item exato.
2. **Revisor com rubrica** (IA): marca aprovado ou reprovado em cada critério, apontando a prova, sem ver a confiança do autor. Cada restrição do seu pedido vira um critério automático. Em jurídico e finanças, entra um segundo revisor com outro modelo, ou você.
3. **Você** (só classe externa): cadastro, contato com terceiros, gasto, assinatura e publicação. Chega como cartão pronto para decidir.

**Lições.** Toda devolução vira uma lição curta na memória do agente, entregue na próxima tarefa do mesmo serviço. A mesma lição 3 vezes vira proposta de ajuste na ficha, que você aprova.

**Avaliação de desempenho, calculada todo dia por agente e por modelo**, como numa empresa:

| Indicador | Meta por agente |
| --- | --- |
| Aprovação de primeira | 80% ou mais |
| Devoluções por entrega | 0,3 ou menos |
| Falhas silenciosas | Zero |
| Etapas paradas sem dono por mais de 15 min | Zero |

Um serviço abaixo da meta por duas semanas ganha revisão da ficha e casos novos na bateria de testes.

## Erros que se resolvem sozinhos

Cada falha tem um tipo, e cada tipo tem uma resposta automática no código. O que o motor não resolve vai para o painel com o motivo real, nunca fica parado sem dono.

| Tipo de falha | O que o motor faz | Quando chama alguém |
| --- | --- | --- |
| Entrega grande demais | Divide a etapa em partes seguindo o modelo do serviço | Duas divisões sem resolver: Helena |
| Limite de passos | Divide a etapa ou dá mais passos uma vez | Na segunda vez: Helena |
| Cota do modelo (erro 429) | Espera e tenta de novo, com intervalo crescente | Mais de 1 hora: painel |
| Site ou ferramenta fora do ar | Tenta 3 vezes e depois troca de fonte | Sem fonte alternativa: Helena |
| Formato errado | Devolve ao autor com o item que faltou | Duas vezes: em resolução |
| Reprovado pelo revisor | Volta com os critérios reprovados | Duas rodadas: em resolução |
| Precisa de permissão | Vira cartão de decisão | Sempre você |
| Falha desconhecida | Para só aquela etapa e guarda tudo | Na hora, no painel |

O fluxo "em resolução" de hoje continua: a Helena substitui a missão até 2 vezes antes de chamar você. A diferença é que agora isso mora no motor, não na memória dela.

**Falha de fora não é culpa do agente.** O motor classifica cada falha pelos próprios sinais (código de saída, estado do provedor, erro do Gateway, veredito do validador), não pelo que o agente diz. Foi assim que ontem um erro de tamanho apareceu como erro de senha. Na v2:

- **Cota esgotada ou provedor fora:** tudo pausa de uma vez. As etapas ficam na fila sem gastar tentativa, e o card mostra "esperando capacidade" com a previsão.
- **Queda do servidor:** a etapa é refeita sem gastar tentativa.
- **Falha do próprio agente:** só essa conta para o disjuntor, que reabre sozinho depois de uma pausa, com uma tarefa de teste.
- **Card que falha duas vezes:** fica em quarentena; o agente continua trabalhando nos outros.

**Fila de prioridade da cota.** Quando a cota aperta, a ordem é: Helena recebendo pedidos, revisores, cards em andamento, cards novos, canário e laboratório. Um limite de processos simultâneos e de memória por tarefa impede que uma tarefa derrube o servidor.

## Memória em 3 camadas e o pacote de passagem

Cada agente recebe só o que precisa para a tarefa, em vez de tudo. Isso deixa as respostas mais certas e evita estourar os limites.

| Camada | O que guarda | Quem grava |
| --- | --- | --- |
| Empresa | Decisões numeradas (DEC), políticas e o perfil das 4 empresas | Só a Helena, com sua aprovação |
| Agente | Lições das devoluções e jeito de trabalhar | O motor, a cada revisão |
| Meta | O plano, as entregas e as perguntas abertas | O motor, a cada etapa |

Tudo continua no Supabase atual. Nada do histórico se perde.

**Pacote de passagem.** Toda entrega sai no mesmo formato: resumo de até 500 caracteres, campos do modelo do serviço, texto completo de até 8.000, fontes com trecho citado, perguntas abertas, confiança (alta, média ou baixa) e sugestão de próxima etapa. O agente seguinte recebe o resumo e os campos; o texto completo só quando o serviço dele pede.

**Sua decisão vale na hora.** Quando você responde um cartão, a resposta vira uma decisão DEC e entra no contexto de todas as tarefas seguintes. Isso resolve a trava da decisão mais recente ignorada.

As decisões são lidas na hora em que cada etapa começa, não quando o card nasceu. Uma decisão marcada como urgente replaneja as etapas que já estão em andamento.

## O relatório do card

Quando o card volta, você vê sempre o mesmo formato, montado pelo app a partir dos campos da entrega. Como o agente preenche campos e não desenha a página, o resultado sai organizado todas as vezes.

- **Topo:** título, empresa, situação, dono e prazo.
- **Resposta em uma frase,** em destaque.
- **Precisa de você:** a decisão com opções, a recomendação e a consequência de cada uma.
- **Entregas:** um bloco por entrega, com quem fez e o resumo; o texto completo abre ao clicar.
- **Números, riscos e fontes oficiais,** cada um no seu lugar.
- **Quem trabalhou:** a linha do tempo dos agentes.
- **Aba Técnico:** o raio-X completo, separado, para manutenção.
- **Botões:** Aprovar, Pedir ajuste e Usar como exemplo.

**Sempre organizado, mesmo trocando o modelo.** Os agentes devolvem só campos, e quem desenha é o app. O validador exige português, poucas formatações permitidas e limite de tamanho por campo, e um teste compara cada relatório com o modelo de página antes de qualquer mudança ir ao ar.

**Nenhum alerta some no resumo.** Riscos e perguntas abertas de qualquer sub-card chegam ao card pelo código, numa seção fixa, mesmo que o resumo final esqueça deles. E enquanto o card anda, o primeiro bloco dele é "Entendi assim", com correção em um toque.

## Treinar como funcionário

Você treina os agentes pelos botões e comentários do card, como treinaria um funcionário novo. Nada muda escondido: todo aprendizado vira texto com versão, que você pode ver e desfazer.

| Você faz no card | Vira | Vale para |
| --- | --- | --- |
| Pede ajuste com um comentário | Correção daquele resultado | Só este card |
| Comenta e marca "vale sempre" | Preferência no Manual do fundador | A empresa ou o serviço |
| Marca "Usar como exemplo" | Exemplo de ouro na galeria do serviço | As próximas entregas do serviço |
| Escreve "nunca faça isso" | Regra numerada, checada contra contradição | Todos os agentes do serviço |
| Repete a mesma correção 3 vezes | Proposta de mudança na ficha, para você aprovar | Aquele agente |

A IA não aprende sozinha de uma tarefa para outra. O "aprendizado" é o manual, os exemplos e as regras que o motor entrega em cada tarefa. Isso é melhor do que treinar o modelo: você vê o que foi ensinado, mede no placar e desfaz qualquer coisa.

Toda regra ou exemplo novo passa pela bateria de testes antes de valer. Assim, ensinar uma coisa nova nunca quebra o que já funcionava.

**Decisões com escopo e sem contradição.** Cada decisão sua diz a que vale (empresa, agente, serviço ou card) e qual decisão antiga ela substitui. Se uma decisão nova contradiz outra, a Helena pergunta qual vale. Regras duras, como "nunca contatar tal pessoa" ou "orçamento até tanto", viram checagem de código, não só texto. Cada execução registra quais decisões usou.

**Lição só vale depois de testada.** Uma lição fica inativa até ser promovida, e a promoção passa pela bateria. Uma devolução injusta do revisor, portanto, não ensina errado sem ninguém ver. Exemplos de ouro servem primeiro para a rubrica e os testes; quando usados como modelo, o validador avisa se a entrega copiou demais.

## Ensaio antes de produção

Nenhuma mudança vai para o ar sem passar por três ensaios automáticos. É o que teria pego as travas de ontem antes de você sentir qualquer uma.

1. **Checagem de contratos** (segundos): toda ficha é válida; todo serviço tem modelo, critério e rubrica; todo agente citado existe; toda ferramenta existe; nenhuma regra repetida ou contraditória.
2. **Simulador da esteira** (sem custo de IA): uma "IA de mentira" responde de propósito com entrega boa, entrega grande, formato errado, reprovação, ferramenta fora do ar e pergunta ao fundador. O motor precisa levar todos os caminhos a um final válido. Publicar exige 100% dos caminhos passando.
3. **Bateria de 20 casos reais** (IA de verdade, em ambiente de teste): feita com as entregas e travas de ontem e hoje. Uma IA juiz dá nota pela rubrica, e publicar exige que a nota não caia.

O ambiente de teste tem perfis e tabelas separados. Ele nunca toca nos dados reais nem nas tarefas em andamento.

**Teste de formato.** O formato certo é garantido pelo validador, não pela sorte: o simulador manda 60 respostas defeituosas de propósito, e o validador precisa recusar todas. Com a IA de verdade, 20 execuções medem quantas vezes ela erra o formato, e no máximo uma pode precisar de nova tentativa. As 60 rodadas reais por serviço ficam para quando trocarmos de modelo, para não gastar a cota dos cards em teste. O modelo real de cada execução fica registrado, e uma rodada curta toda noite pega quando o provedor troca o modelo sem avisar.

## Manutenção em minutos

Quando algo falhar, quem for consertar abre o card e vê exatamente onde, por quê e com qual versão. Ninguém precisa cavar logs no servidor, como tivemos que fazer ontem.

- **Raio-X do card.** Cada passo mostra quem fez, quando, o que recebeu, o que entregou, a versão da regra, o modelo, as ferramentas usadas, o tempo e o custo. A primeira linha diz o que o card está esperando, de quem e até quando.
- **Botão "por que travou?".** Mostra a etapa, a causa classificada e o conserto que o manual de falhas indica.
- **Um número só.** O código do card aparece no Gateway, no despachante, no Hermes e no banco. Buscar esse número mostra tudo de uma vez.
- **Repetir o passo.** Erro de processo é reproduzido exatamente no laboratório, usando as respostas gravadas da IA. Erro de conteúdo é refeito algumas vezes para medir se volta, porque a IA não responde igual duas vezes.
- **Todo erro vira teste.** O caso que falhou entra na bateria, então aquele erro não volta sem ser pego.
- **"O que mudou desde ontem?"** O histórico de versões responde em um comando, e voltar é outro.
- **Manual do mantenedor.** Um arquivo no repositório com o mapa do sistema e o roteiro de cada falha, para eu ou qualquer pessoa entender em minutos.

**Nada se perde num reinício.** Cada mudança de estado grava o histórico na mesma operação, e a conversa completa de cada execução fica guardada fora do servidor dos agentes, por um prazo definido. Hoje os registros do Hermes ficam dentro do contêiner e somem quando ele é republicado.

## Organização do código

Tudo vive num repositório privado no GitHub, e ninguém edita nada direto no servidor. Os perfis do Hermes passam a ser gerados das fichas, do mesmo jeito que um site é gerado do código.

```
sistema-helena/
  agentes/
    agt-01-helena/      ficha.yaml, alma.md, servicos/, casos-de-teste/
    agt-05-caio/        ...
    agt-06-clara/       ...
  modelos/              catalogo.yaml (apelidos de modelo)
  empresas/             perfil das 4 empresas, glossário
  regras/               regras.yaml (número, versão, prioridade)
  roteiros/             recrutar-pessoas.yaml, avaliar-plataforma.yaml
  motor/                estados, manual de falhas, despachante
  gateway/              servidor MCP helena_operacao
  banco/migracoes/      SQL versionado do Supabase
  painel/               tela de status
  ensaio/               simulador e bateria de casos
  laboratorio/          testes seus, fora da produção
  scripts/montar-perfis gera os perfis do Hermes a partir das fichas
  .github/workflows/    checa, ensaia e publica
```

- **Caminho de toda mudança:** GitHub, checagem e ensaio automáticos, publicação no EasyPanel, versão marcada.
- **Perfis com dono certo:** o gerador grava como o usuário do Hermes (uid 10000). Acaba o problema de arquivo gravado como root travando agente.
- **Publicar sem estragar tarefas:** antes de publicar, o motor para de pegar etapas novas e espera as em andamento terminarem, por até 15 minutos. As que forem interrompidas são refeitas sem gastar tentativa, sempre na versão em que nasceram. Antes de mexer no banco, um retrato dele é guardado, e uma checagem confere que todo estado, serviço e agente usado pelos cards abertos existe na versão nova.
- **Voltar versão:** publicar a etiqueta anterior. Sem zip e sem cópia manual.
- **Senhas fora do código:** ficam só nas variáveis do EasyPanel, e uma checagem automática bloqueia qualquer chave que escape para o repositório.

## Mexer sem quebrar: trocar modelo, testar e adicionar funções

Você vai poder trocar modelo, testar outro e criar funções sem tocar nos agentes que estão trabalhando. O que mais desanda agentes é mudança feita direto no servidor e instrução mexida sem teste. Por isso toda mudança, sua ou minha, entra pelo mesmo caminho:

1. **Laboratório.** Uma cópia isolada do sistema, com a IA de mentira e a bateria de casos. Ali você testa o que quiser, e nada sai sozinho.
2. **Placar lado a lado.** A mudança roda os 20 casos reais e mostra nota, tempo e custo contra a versão atual. Só segue se empatar ou melhorar.
3. **Canário.** Entra em um agente só. Se a aprovação de primeira cair ou as falhas subirem, o sistema volta sozinho para a versão anterior e avisa você.
4. **Todos.** É ligada agente por agente, com histórico.

| O que você quer mexer | Onde mexe | O que protege |
| --- | --- | --- |
| Trocar ou testar um modelo | Uma linha no catálogo de modelos. Os agentes usam apelidos, como "pesquisa-padrão", e nem percebem a troca | Placar com os 20 casos antes de trocar, incluindo custo |
| Criar um agente | Uma pasta nova em agentes/, com ficha, serviços e casos de teste | A checagem recusa ficha incompleta, e ele nasce desligado |
| Nova ferramenta ou integração | Um arquivo no gateway e o nome dela na ficha de quem vai usar | Só recebe a ferramenta quem a tem na ficha |
| Nova função ou regra | Nasce desligada e é ligada agente por agente | A checagem recusa regra que contradiz outra |
| Ajustar as instruções de um agente | A ficha ou a alma daquele agente | A bateria daquele agente roda antes de publicar |
| Testar algo que viu num curso | A pasta laboratório | Nunca chega à produção sem os passos 2 a 4 |

Toda mudança fica registrada com versão, autor e motivo, e desfazer é um comando. O catálogo de modelos também mostra o custo de cada um, então trocar para um modelo pago aparece no placar antes de virar gasto (hoje vale a DEC-014: sem API paga nesta fase).

## Isolamento e segurança

Um serviço por agente, como na sua foto, parece mais seguro, mas cada serviço precisaria de uma cópia do mesmo login do ChatGPT, e cópias renovando o acesso ao mesmo tempo derrubam umas às outras. Por isso a v2 isola por processo: cada tarefa roda num processo próprio, só com as ferramentas da ficha. Quem impede um agente de travar os outros é o motor, com fila própria e disjuntor; separar contêiner sozinho não resolve isso.

- **Serviço separado pelo risco.** Theo e Daniel, que rodam código ou usam navegador, ganham serviço próprio quando voltarem, na fase 4. Os 5 da meta não precisam, porque não têm terminal nem ferramenta que grava.
- **Login compartilhado do jeito seguro.** Um serviço separado que precise do ChatGPT usa o login pelo mesmo caminho que o teste 2 aprovou, nunca uma cópia solta.
- **Medir antes.** A VPS divide 4 núcleos com o Gateway, o WhatsApp e o ids-app. O teste 6 mede se cabem 3 tarefas ao mesmo tempo antes de crescer.
- **Sem porta aberta.** Agentes sem endereço público; só o Gateway fala com fora. As portas 9119 e 8642 fecham na fase 0.
- **Chaves trocadas.** A troca das chaves que apareceram no chat fica para o fim dos testes, como combinamos.

**O que se separa logo no começo, sem esperar a fase 4:**

- **Chaves só no motor.** Os agentes não recebem senha do banco nem ferramenta que grava. Só o motor fala com o banco, num serviço à parte, e só pelas funções de passagem; ele não consegue gravar direto nas tabelas.
- **Um processo por tarefa.** O motor abre um processo do Hermes para cada tarefa, só com as ferramentas da ficha, e encerra o processo inteiro no tempo máximo. Como o agente não grava nada, não precisa de passe.
- **Login do ChatGPT protegido.** Se duas cópias do mesmo login renovam o acesso ao mesmo tempo, a OpenAI derruba todas. O Hermes corrigiu isso na versão de 14/09/2026, com uma renovação por vez; a fase 0 confere a versão e o teste 2 prova em 48 horas. Um guardião próprio só será construído se o teste falhar. Se o login cair, tudo pausa e você recebe na hora o passo a passo para entrar de novo.
- **Sem terminal, arquivos ou código** para os 5 primeiros agentes. Quem lê páginas da internet só pode entregar ou registrar falha, para que um texto plantado num site não consiga mandar o agente fazer outra coisa.
- **Vigia fora da caixa.** O motor e o Gateway gravam sinais de vida. Uma checagem dentro do Supabase confere esses sinais e manda o aviso direto para o seu celular, sem passar pela VPS. Se o servidor inteiro cair, você fica sabendo.

A empresa inteira roda numa única conta do ChatGPT. Enquanto valer a DEC-014 (sem API paga), esse risco fica aceito, com um segundo provedor configurado, testado e desligado. Para o caso de o Hermes falhar, e não a conta, o Codex fica pronto como segundo executor no mesmo login.

## Painel, resumo diário e cartões de decisão

Você abre uma tela no app e vê cada agente com luz verde, amarela ou vermelha, o que está fazendo e há quanto tempo. Você só é chamado para decidir.

- **Por agente:** tarefa atual, fila, última entrega, aprovação de primeira da semana e estado do disjuntor.
- **Por meta:** etapas feitas, em andamento e bloqueadas, desenhadas como o plano.
- **Falhas:** o motivo real e o que o motor já tentou.
- **Resumo diário da Helena:** o que foi feito, o que travou e o que precisa de você, num cartão só.
- **Aviso fora do app** só em dois casos: etapa parada há mais de 1 hora, ou decisão sua pendente.
- **Cartões de decisão:** opções A, B ou C, com a recomendação e a consequência de cada uma. Sua resposta vira uma decisão DEC e chega a todos os agentes na hora.

**Você não vira gargalo.** Um agente só pergunta a você nos pontos de decisão que o serviço prevê, ou quando nenhuma decisão sua já responde. Cada card tem um limite de perguntas, as perguntas se juntam no resumo diário, e o painel mostra há quanto tempo a mais antiga espera.

## Revisão crítica: 20 furos fechados antes de construir

Antes de construir, pedi a uma revisão independente que tentasse quebrar o plano. Ela achou 20 furos, e cada um tem conserto definido e uma fase para ser fechado.

| # | Furo encontrado | Como fecha | Fase |
| --- | --- | --- | --- |
| 1 | O avanço dependia de um aviso único; uma queda no meio deixava o card sem dono | Motor pronto (DBOS) que grava cada passo no banco e retoma do último concluído | 2 |
| 2 | Uma queda do provedor virava dezenas de falhas e alarmes | Falha classificada pela origem; provedor fora pausa tudo sem gastar tentativas | 2 |
| 3 | Uma execução antiga ou cancelada ainda conseguia escrever | Agente sem ferramenta de gravação; só o motor grava, uma vez, com chave única | 2 |
| 4 | Memória e habilidades próprias do Hermes mudavam o comportamento fora da ficha | Cópia limpa do perfil por tarefa, recursos desligados, versão fixa | 2 |
| 5 | Uma mensagem sua podia se perder ou virar dois cards | Caixa de entrada gravada pelo código, com protocolo e classificação fechada | 2 |
| 6 | "Esperando você" contava como final e podia travar para sempre | Só 3 finais de verdade; estacionamento com prazo, lembrete e padrão aprovado | 2 |
| 7 | Se o servidor caísse, o vigia caía junto e ninguém avisava | Sinais de vida conferidos de dentro do Supabase e aviso direto no seu celular, sem passar pela VPS | 2 |
| 8 | Cópias do mesmo login do ChatGPT podiam derrubar todos os agentes | Correção do próprio Hermes (14/09/2026) conferida na fase 0 e teste de 48 horas; guardião só se falhar | 0 e 2 |
| 9 | Publicar matava as tarefas em andamento | Versão do motor fixada, esvaziar antes de publicar e teste publicando no meio de um passo | 2 |
| 10 | O pedido se perdia de resumo em resumo | Pedido original inteiro em toda etapa e toda revisão | 2 |
| 11 | O revisor de IA aprovava erro bem escrito | Citação conferida na página lida, conta refeita pelo código, lei conferida em tabela | 3 |
| 12 | Decisões suas se acumulavam e se contradiziam | Escopo, substituição, pergunta quando contradiz, regras duras em código | 3 |
| 13 | O plano da Helena podia citar serviço inexistente ou travar esperando um dado | Plano conferido ao ativar; dono e revisor reservas na ficha | 2 |
| 14 | Sub-cards podiam se repetir, formar ciclos ou travar o agente | Chave por pedido, 2 níveis, limite por etapa e orçamento da meta | 2 |
| 15 | Voltas para trás sem limite e entregas grandes demais | Um contador de retrabalho; divisão por seções já no plano | 2 |
| 16 | 20 casos não pegam um modelo que erra 5% das vezes | O validador garante o formato; 20 rodadas reais medem; 60 rodadas reais ao trocar de modelo | 2 e 4 |
| 17 | As chaves ficavam no mesmo contêiner dos agentes | Chaves só no motor; agentes sem senha, sem ferramenta de gravação e sem terminal | 2 |
| 18 | O que foi provado podia não ser o que roda | Uma tabela só, no banco, que o teste percorre inteira; teste de bagunça | 2 |
| 19 | Os registros sumiam quando o contêiner era republicado | Histórico na mesma operação e conversas guardadas fora do servidor | 2 |
| 20 | O card mudava de cara quando o modelo mudava | O agente devolve campos, o app desenha, teste de página | 3 |

As duas frases erradas da primeira versão também foram corrigidas: publicar não preservava as tarefas em andamento, e "esperando você" não pode contar como final.

Depois da segunda análise, oito consertos (1, 3, 7, 8, 9, 16, 17 e 18) ficaram mais simples: motor pronto, agentes sem ferramenta de gravação e a correção do login no próprio Hermes. A coluna Fase já segue as fases novas.

## Os 5 primeiros agentes e a primeira meta

A v2 começa com 5 agentes e uma meta real: o plano para recrutar as 10 primeiras pessoas na Mimix e no Hub. Os outros 16 ficam pausados, não apagados, e voltam um por vez.

| Agente | Papel na v2 | Serviços iniciais | Quem revisa |
| --- | --- | --- | --- |
| Helena (AGT-01) | Gerente: monta o plano, revisa e fala com você | Montar o plano da meta; revisar entrega; resumo diário | Você, só no plano da meta |
| Ravi | Pesquisa | Dossiê de plataforma; pesquisa com fonte oficial | Helena |
| Isabela | Conteúdo e treinamento | Anúncio de recrutamento; roteiro de treinamento | Clara, pelo risco legal |
| Clara (AGT-06) | Jurídico | Parecer de termos de uso; checagem LGPD e direito de imagem | Helena |
| Caio (AGT-05) | Finanças | Ganho por pessoa e margem; projeção simples de caixa | Helena |

A Marina (planejamento) fica para a fase 4: na v2, o motor e os roteiros fazem o acompanhamento do plano que hoje é dela.

**A primeira meta está pronta quando** o anúncio, o roteiro de treinamento, o cálculo do Caio e a checagem da Clara estiverem aprovados, de ponta a ponta, sem ninguém destravar nada à mão, e visíveis no painel.

## Fases com critério para avançar

&#91;embedded content: fases da v2 · 5 fases, um portão em cada\]

Nenhuma fase avança por data, só pelo portão. A v1 segue trabalhando até a fase 3 provar que a v2 entrega melhor.

## O que preciso de você

Para seguir, são duas ações suas e uma frase. A fase 2 cria um serviço novo e tabelas novas; nada do que roda hoje muda até a troca.

- [ ] Fase 0: remover as portas 9119 e 8642 do serviço hermes no EasyPanel e me avisar
- [ ] Fase 1: aprovar o roteiro das 10 pessoas (E1 a E5) ou dizer o que mudar
- [ ] Digitar no tópico: **roteiro aprovado, pode seguir para a fase 2 da segunda análise, com o motor DBOS e o esqueleto da conta do Caio**
- [ ] Da fase 3 em diante: autorizar cada ida para produção, uma por vez

Eu escrevo o código, as fichas e os testes. O que depender de clique seu no EasyPanel ou no GitHub, peço numa mensagem só, com o passo a passo.

**Base deste plano:** [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) · [Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · [Microsoft, padrões de orquestração](https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns) · [12-Factor Agents](https://humanlayer.dev/blog/12-factor-agents) · [Berkeley, por que sistemas multiagente falham](https://arxiv.org/abs/2503.13657) · [Railway, sistema multiagente](https://docs.railway.com/guides/multi-agent-system)

## Anexo: as provas da segunda análise

### O que conferi

- **O Hermes aceita rodar travado.** No código do Hermes: existe o modo de uma pergunta só (`hermes -z`); o executor simples aceita limite de passos e lista de ferramentas (`--max-turns` e `--enabled-toolsets`); memória, perfil do usuário e revisão em segundo plano vêm ligados, mas são chaves de configuração que desligamos. O tempo máximo do próprio Hermes só pede ao agente que encerre, não mata o processo; por isso o motor encerra o processo por fora. ([comandos do Hermes](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md) · [configuração](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/))
- **A disputa do login foi corrigida.** Quando dois processos renovam o mesmo login do ChatGPT ao mesmo tempo, a OpenAI derruba o login de todos. A correção entrou no Hermes em 14/09/2026, na versão v2026.9.14: uma renovação por vez, com trava entre processos. A fase 0 confere se a VPS roda essa versão ou uma mais nova. ([correção no código](https://github.com/NousResearch/hermes-agent/commit/66ddd5f83cd1beac797f35a574ee2e59138bf13a))
- **O Hermes é parceiro oficial da OpenAI.** Desde 29/09/2026, a OpenAI deixa usar a cota do ChatGPT Plus e Pro em 16 ferramentas parceiras, e o Hermes Agent é uma delas. O uso conta no limite do seu plano e para quando o limite acaba. O anúncio não fala de uso automático o dia inteiro, então o teste 1 mede antes de crescermos. ([The New Stack](https://thenewstack.io/sign-in-with-chatgpt/))
- **Cota por plano.** No Plus, a OpenAI estima de 15 a 160 mensagens a cada 5 horas no GPT-6.1 Sol e de 350 a 3.000 no GPT-6 Luna, e avisa que são estimativas. O Pro não tem limite de 5 horas, mas pode ter limite semanal, e dá para comprar créditos. ([cotas do Codex](https://learn.chatgpt.com/codex/pricing))
- **Codex como segundo executor.** O `codex exec` roda sem tela, por padrão sem poder alterar arquivos, aceita um formato obrigatório de resposta e pode rodar sem guardar sessão. ([modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode))
- **DBOS no Supabase.** O DBOS guarda seus passos num esquema próprio do Supabase ("dbos"), pela conexão direta ou pelo pooler de sessão. Passo concluído nunca é refeito; passo interrompido é refeito; o número de cada fluxo serve de chave contra duplicação; as filas têm limite de vagas, prioridade e limite por agente. Os cuidados também estão na documentação, e cada um tem conserto neste plano: o motor só retoma fluxos da mesma versão do código, e um passo em Python não pode ser interrompido por dentro, por isso cada agente roda num processo separado que o motor encerra. ([DBOS e Supabase](https://docs.dbos.dev/integrations/supabase) · [fluxos](https://docs.dbos.dev/python/tutorials/workflow-tutorial) · [passos](https://docs.dbos.dev/python/tutorials/step-tutorial) · [filas](https://docs.dbos.dev/python/tutorials/queue-tutorial) · [versões](https://docs.dbos.dev/python/tutorials/upgrading-workflows))
- **O painel do DBOS é pago e não faz falta.** O painel oficial custa a partir de US$ 99 por mês. O raio-X do card lê as mesmas gravações direto do banco. ([preços do DBOS](https://www.dbos.dev/dbos-pricing))

### Motores comparados

| Motor | O que exige | Licença | Veredito |
| --- | --- | --- | --- |
| DBOS | Só uma biblioteca dentro do nosso serviço, gravando no Supabase que já temos | MIT, aberta | Recomendado |
| Absurd | Um arquivo SQL e uma biblioteca, gravando no Postgres | Apache 2.0, aberta | Boa ideia, mas nova demais: existe desde o fim de 2025 |
| pgflow | Feito para o Supabase, mas o trabalho roda em Edge Functions | Apache 2.0, aberta | Não serve: uma tarefa nossa leva até 15 minutos, e uma Edge Function roda por poucos minutos no máximo |
| Hatchet | Um servidor próprio para o motor, além do nosso | MIT, aberta | Funciona, mas é mais um servidor numa VPS que já está apertada |
| Temporal | Vários serviços próprios e um banco | MIT, aberta | Pesado demais para 4 núcleos divididos |
| Trigger.dev | Vários contêineres para hospedar por conta própria | Apache 2.0, aberta | Pesado demais para a VPS |
| Inngest | Servidor próprio, com Redis e Postgres | SSPL, restritiva | Mais peças e licença restritiva |
| Restate | Servidor próprio, com armazenamento próprio | BSL, restritiva | Um segundo lugar guardando o estado do card |
| Feito à mão (plano anterior) | Escrever reservas, tentativas, filas e recuperação | Nossa | É o tipo de código que travou a v1 |

Também olhei Windmill e n8n (na tabela de caminhos, abaixo) e o Procrastinate, que é só uma fila e não retoma passos.

### Caminhos comparados

| Caminho | Ponto forte | Furo | Veredito |
| --- | --- | --- | --- |
| O plano anterior, como estava | Princípios certos e completos | Motor feito à mão, base não provada e grande antes do primeiro card | Corrigir |
| Trilho no banco sem biblioteca (a primeira versão da v2.1) | Nada novo para aprender | Reservas, tentativas e recuperação escritas à mão de novo | Não |
| O plano corrigido | Mesmos princípios, menos código e base provada antes de crescer | Depende do DBOS, mas o estado do card fica em tabelas nossas, então dá para trocar o motor sem mexer nos cards | Recomendado |
| n8n ou Windmill | Telas prontas para desenhar fluxos | Mais um sistema na VPS, e a lógica do card ficaria espalhada em telas, longe dos testes | Não |
| Um agente só, sem equipe | Simples de montar | Perde a especialização e os revisores, que são o que segura a qualidade | Não |
| Plataformas pagas hospedadas | Nada para manter | Exigem API paga ou mensalidade, contra a DEC-014 | Não agora |
