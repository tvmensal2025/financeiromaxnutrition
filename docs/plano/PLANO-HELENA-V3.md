# Sistema Helena: plano v3, o melhor até agora

Oct 9, 2026 · @anonimus

Este é o plano único, refeito do começo ao fim. Ele junta as duas análises anteriores, a revisão das fichas feita no seu PC e uma nova rodada de ataque ao plano, por três ângulos diferentes. Cada furo achado tem conserto, um teste que prova e a fase em que fecha, e não sobrou nenhum furo conhecido em aberto.

Os 3 furos da segunda análise eram do plano anterior e já estavam fechados no plano corrigido; esta versão fecha também os que apareceram depois. Ninguém consegue prometer zero furo desconhecido, então o plano traz o processo que acha o próximo furo antes de você: revisão independente no fim de cada fase, vigia no ar e todo erro virando teste.

## Resposta direta

**Tem furo?** Nenhum conhecido em aberto. Nas quatro rodadas de ataque foram 171 achados, e cada um está no arquivo REGISTRO-DE-FUROS.md com o conserto, o teste que prova e a fase em que fecha.

**E se aparecer um furo novo?** Ele aparece no card, com dono e prazo, nunca em silêncio. Cada fase só avança depois de uma nova revisão independente, e todo furo achado vira regra no código e teste, para não voltar.

**Eles vão seguir?** Vão, porque não têm como fazer diferente. O agente só devolve uma de 5 ações, não tem nenhuma ferramenta que grava, e o banco recusa qualquer passagem fora da tabela.

**Dá para não ter erro nenhum?** No processo, sim: o banco recusa passagens inválidas, o vigia acusa o que parar, e os testes percorrem todos os eventos da tabela antes de ir ao ar. No conteúdo, nenhuma IA ou pessoa chega a 100%: o código confere o que dá para conferir (citação, conta e lei), um revisor confere o resto, e o card mostra o que foi conferido e o que não foi.

**O que mudou nesta rodada?** O motor e a ordem de construir continuam os mesmos. Mudou o que faria o sistema falhar na prática: o caminho do card em cada caso, a conferência da qualidade e a operação. Três pontos mudam o que combinamos: a fase 0 começa conferindo se alguém já entrou na v1, as chaves expostas são trocadas já na fase 0, e nada é publicado sem o seu toque.

## Como funciona

O banco manda, o motor executa e o agente só escreve conteúdo. Cada peça tem um papel só, e só o motor grava no banco, sempre pelas regras dele.

[embedded content: onde cada peça roda · 3 lugares e um vigia de fora]

- **Supabase, o banco.** Guarda a caixa de entrada, os cards, as 13 regras, o histórico e as cópias das páginas lidas. O relógio dos prazos e o vigia rodam dentro dele, fora da VPS.
- **Motor (DBOS), na VPS.** Pega a próxima etapa da fila, abre o agente, confere a resposta e grava uma vez só, pelas funções do banco. Só um motor roda por vez.
- **Agente (Hermes travado), na VPS.** Roda numa pasta limpa por tarefa, sem nenhuma senha, só com as ferramentas da ficha, que são nossas: no máximo "buscar" e "ler página". Devolve uma das 5 ações e não grava nada.
- **GitHub.** Guarda o código, as fichas e as regras, roda os testes a cada mudança e faz o backup da noite. Publicar na VPS e mudar o banco só acontecem quando você aperta o botão de publicar.
- **Vigia do vigia.** Um serviço gratuito de fora (healthchecks.io) espera um sinal do Supabase, do motor e do backup. Se um sinal parar, ele avisa você pelo Telegram e por e-mail, mesmo com o Supabase e a VPS fora do ar.
- **ChatGPT.** A sua assinatura, com um login só da v2, separado do login da v1.

## A jornada do card

Cada pedido seu vira um card, e o card só anda por regras de código até voltar pronto para você. A Helena entende e pergunta, os agentes fazem o conteúdo e o motor garante a lógica.

[embedded content: a jornada do card · 11 passos em 4 papéis]

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

[embedded content: caminho de uma etapa · do plano à aprovação, com as 2 voltas de correção]

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

[embedded content: o card de volta para você · exemplo da meta das 10 pessoas]

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
- **Chave colada não se espalha.** Se uma chave for colada no app ou no WhatsApp, o código a troca por "\[chave removida]" antes de gravar e responde pedindo para não colar chaves ali. Assim ela não chega à Helena, aos agentes nem ao histórico.
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

[embedded content: fases da v2 · 5 fases, um portão em cada]

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

## Furos: quatro rodadas de ataque

Cada rodada atacou o plano sem ver o raciocínio de quem escreveu. Todo furo achado ganhou conserto, um teste que prova e a fase em que fecha, e a lista completa está no arquivo REGISTRO-DE-FUROS.md.

| Rodada | Quem atacou | Achados | Situação |
| --- | --- | --- | --- |
| 1 | Revisão crítica do primeiro plano | 20 | Fechados |
| 2 | Segunda análise | 10: 3 de base e 7 novos | Fechados |
| 3 | Revisão das fichas e do roteiro, no seu PC | 37: 29 novos e 8 da versão 2.1 | Fechados |
| 4 | Minha análise e três ataques independentes: ciclo do card, qualidade, e operação e segurança | 104: 44 meus e 20 de cada ataque, alguns repetidos entre ângulos | Fechados |

Além dos furos, as rodadas 1 e 4 acharam frases erradas no texto antigo; todas foram corrigidas e estão no fim do registro.

**Riscos aceitos, com aviso e saída pronta.** Não são furos: são escolhas suas, e cada uma tem gatilho e plano B.

- **Uma conta só do ChatGPT,** enquanto valer a DEC-014. Se a conta for suspensa ou a cota não bastar, tudo pausa sem perder nada, e a escolha entre as saídas já preparadas é sua.
- **Conteúdo de IA nunca chega a 100%.** O código confere citação, conta e lei, o revisor confere o resto, e no jurídico você é o segundo revisor; o card sempre mostra o que não foi conferido.

**Como o próximo furo aparece antes de você.** Revisão independente no portão de cada fase, o vigia conferindo as 13 regras a cada 5 minutos, o vigia do vigia de fora e todo erro virando teste.

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
