## Falhas e esperas

Cada falha tem um tipo, e cada tipo tem uma resposta automática no código e um teto. O motor lê o tipo no registro de uso do Hermes e no veredito do validador, nunca no texto do agente; uma execução que não terminou inteira nem tem o texto lido como resposta. Se um agente escrever "cota esgotada" num texto, nada pausa: ele só escolhe um de 3 motivos (não consigo, faltam dados ou fonte insuficiente), e o tipo da falha quem define é o motor.

- **Um tradutor só para o registro do Hermes.** (mudou na v3.1: antes o motor lia o registro do Hermes direto.) Um adaptador único, com teste próprio, transforma o registro de uso do Hermes num contrato fixo: a ação, o registro de uso (dizendo de onde veio cada campo) e o tipo da falha. O motor só conhece esse contrato. Trocar de executor um dia vira escrever outro adaptador e passar nos mesmos testes.
- **A ação chega por ferramenta.** (mudou na v3.1, e depende do dia de prova: na v3, a ação vinha no texto final.) O agente entrega chamando uma ferramenta nossa, de formato fechado, e a execução termina logo depois da primeira ação aceita. O motor conta isso como execução inteira, e não como queda, porque lê primeiro o registro de uso e depois a ação gravada. Como o Hermes se comporta quando o nosso servidor encerra a execução é NÃO CONFIRMADO. Até o dia de prova da fase 2 confirmar, vale o canal da v3: a resposta no texto final, conferida pelo código. Se a prova falhar, o canal da v3 fica, e a decisão é registrada.
- **Os nomes são os da máquina de passagens.** (novo na v3.1) Cada tipo das tabelas abaixo é um evento da tabela de passagens (`helena-v2/maquina/vocabulario.yaml` e `passagens.yaml`), e a prova percorre todos. Essa máquina ainda está em construção: os tetos daqui são os que estão lá hoje e podem mudar até o portão da fase 1, sempre com a prova rodando de novo.

(mudou na v3.1: a tabela única da v3 virou duas, para separar o que não gasta tentativa do que gasta.)

### Falhas do sistema: não gastam tentativa nem punem o agente (regra 12)

| Tipo de falha | O que o motor faz | Teto, e quem é chamado |
| --- | --- | --- |
| Cota do ChatGPT esgotada | Pausa a fila sem gastar tentativa. O card mostra "esperando capacidade", com a hora de volta quando o ChatGPT informa, ou a hora da próxima leitura do medidor quando não informa (mudou na v3.1: quem acompanha é o medidor único de cota, mais abaixo). Se o número da conta não explicar o erro, como num limite próprio do modelo, o motor testa de novo em intervalos crescentes, como na v3. O modelo menor só entra com a sua escolha, nunca sozinho | 1 hora: aviso para você. 6 horas: você escolhe entre esperar, usar o modelo menor ou encerrar o card (mudou na v3.1: "cancelar" virou "encerrar o card", que guarda o que já foi aprovado). Se a cota voltar antes da sua resposta, a etapa volta sozinha à fila (novo na v3.1) |
| Cota desconhecida: o medidor não consegue ler (novo na v3.1) | Nenhum card novo começa, e nenhuma etapa nova de autor; seguem só a Helena recebendo os seus pedidos e os revisores | Na hora: um aviso só, e não um por leitura que falhar |
| Saldo de crédito caiu (novo na v3.1) | A v2 pausa inteira | Na hora: aviso para você. Usar crédito só com decisão sua registrada |
| Login do ChatGPT caiu | Pausa tudo; as etapas ficam guardadas no banco | Na hora: aviso com o passo a passo para entrar de novo. Se entrar de novo não resolver, vale "Se a conta do ChatGPT for suspensa", no fim desta seção |
| Provedor instável | Refaz a etapa sem gastar tentativa, com intervalo crescente | Na 3ª falha de sistema da mesma etapa, ela para e chama você (mudou na v3.1: antes era só um aviso) |
| Queda do servidor ou do motor no meio | Retoma do último passo concluído, sem gastar tentativa. Se o agente já tinha respondido, usa a resposta gravada, sem gastar cota de novo. A vaga da etapa se libera sozinha quando o processo morre (novo na v3.1: na v1, uma vaga presa travava a fila inteira). O DBOS fica configurado para no máximo 3 retomadas da mesma etapa; o padrão dele é 100, conferido no código do DBOS (novo na v3.1) | 15 minutos fora: aviso do vigia de fora. Na 3ª queda da mesma etapa, inclusive quando é a própria resposta que derruba o motor, ela para e chama você |
| Motor ou VPS fora do ar (novo na v3.1) | Os avisos de card esperam o motor voltar, e nenhum padrão vence sem o lembrete entregue (veja "Prazos", abaixo) | Em até 15 minutos: aviso do vigia de fora (healthchecks.io), pelo robô dele no Telegram e por e-mail |
| Banco fora do ar ou só para leitura | Pausa a fila sem gastar tentativa, e o que estava no meio é retomado quando o banco voltar. O motor manda o aviso direto pelo Telegram, sem passar pela tabela de avisos, que mora no banco, e guarda consigo o que já mandou, para não repetir em laço (mudou na v3.1) | Na hora: aviso para você. O vigia de fora também acusa, porque o sinal do banco para |
| Ferramenta fora do ar | Se o agente não recebeu exatamente as ferramentas da ficha, a execução não conta e é refeita | Na 3ª falha de sistema da mesma etapa, ela para e chama você (mudou na v3.1: antes era só um aviso) |
| Conferência do código sem resposta (novo na v3.1) | Se o validador da entrega ou o do plano não responder em 60 segundos, ele roda de novo, sem gastar tentativa do agente | Entrega: na 3ª, chama você. Plano: na 2ª, o card espera você, com o motivo |
| Avisos parados: o motor está vivo, mas não consegue mandar ao Telegram (novo na v3.1) | Nada muda nos cards; o aviso continua na fila de envio | Aviso parado há mais de 15 minutos: alarme do vigia de fora, pelo robô dele e por e-mail |

- **Um contador só para as falhas de sistema.** (mudou na v3.1: na v3, cada tipo tinha a sua contagem.) Provedor, queda, ferramenta, cota, login, banco e conferência sem resposta somam no mesmo contador da etapa. Na 3ª, seja qual for o tipo, a etapa para e chama você com a causa. Assim, falhas de tipos diferentes não se revezam para escapar do teto.
- **Falha de sistema não conta contra o agente.** Nenhuma delas gasta tentativa, abre o disjuntor (3 falhas seguidas de um agente pausam só ele) ou pesa no boletim de qualidade do serviço. O disjuntor e os estados de qualidade do serviço ficam numa tabela só, com ordem de precedência, descrita em "Qualidade" (mudou na v3.1: eram regras soltas que se sobrepunham).
- **A trava única do motor é testada antes de valer.** (novo na v3.1) Só um motor roda por vez, porque ele segura uma trava única no banco. Se o motor cair, essa trava precisa ser liberada para o novo motor ligar; isso ainda não foi conferido no caminho de conexão do Supabase (NÃO CONFIRMADO). Por isso virou teste que bloqueia: o teste 4 mata o motor à força e exige que o novo ligue. Se a trava não for liberada, a fase 2 não avança.

### Falhas do trabalho: gastam tentativa

| Tipo de falha | O que o motor faz | Teto, e quem é chamado |
| --- | --- | --- |
| Tempo esgotado (do autor ou do revisor) | Conta como tentativa: mais uma, com 50% mais tempo | Na segunda: em resolução (mudou na v3.1: a etapa não é mais dividida no meio da execução) |
| Site fora do ar | A ferramenta tenta 3 vezes e troca para outra fonte permitida para a etapa | Sem fonte alternativa: em resolução |
| Entrega grande demais | Vai para em resolução na hora. A saída é um roteiro que divide a entrega em partes ao montar o plano, declarado antes e aprovado como qualquer mudança (mudou na v3.1: o motor não divide mais no meio) | Na hora: em resolução, sem a opção de refazer com mais tempo, que não resolve esse caso |
| Limite de chamadas | Dá mais chamadas, uma vez (mudou na v3.1: não divide mais a etapa) | Na segunda: em resolução |
| Formato errado | O servidor recusa na hora a ação fora do formato e diz o campo exato, até 2 correções dentro da mesma execução, contadas no limite de chamadas. Na 3ª recusa, ou se a execução terminar sem ação aceita, é "formato errado": uma única nova tentativa, só de formato, com a lista do que foi recusado (mudou na v3.1: as 2 correções dentro da execução são novas e só valem se o dia de prova confirmar o canal por ferramenta) | Na segunda: em resolução |
| Reprovado pelo revisor | Volta ao autor com os critérios reprovados | Duas voltas: em resolução |
| Ajuste pedido pelo jurídico (novo na v3.1) | A peça julgada, como o convite, volta ao autor, passa de novo pela revisão, e o jurídico refaz sobre o texto novo. O parecer de ajuste só vale com o seu Aprovar | Duas voltas: em resolução (mudou na v3.1: um teto só; o roteiro dizia 1 e o plano dizia 2) |
| Falha desconhecida | Para só aquela etapa e guarda tudo | Na hora: aviso para você, e a etapa vai para em resolução. O caso vira teste novo |

- **Teto geral.** Cada etapa roda no máximo 6 vezes, somando autor e revisor, por qualquer motivo. No teto, ela para e chega a você com a causa, mesmo que cada falha tenha sido de um tipo diferente (mudou na v3.1: chega pelo mesmo cartão de resolução, abaixo).
- **Os seus pedidos têm teto próprio.** (novo na v3.1, proposta que depende do seu sim) Os seus pedidos (ajuste, refazer, esperar, usar o modelo menor, decisão nova) abrem uma rodada nova e não gastam o teto de 6. Para a prova ter fim, a máquina propõe um teto de 3 pedidos seus por card. No 4º, o seu pedido vale do mesmo jeito: o card é substituído por um card novo, ligado ao anterior, com as entregas dele e o seu pedido. Assim cada card termina, e a sequência de cards ligados continua enquanto você pedir ajustes.
- **Em resolução.** (mudou na v3.1: a Helena não replaneja mais a etapa; ela só recomenda uma opção fixa.) O código monta um cartão só, para a etapa e para quem depende dela, sem abrir outro cartão em cascata. A Helena tem 30 minutos para recomendar uma das opções, com as provas na mão; sem recomendação no prazo, o cartão chega a você assim mesmo. As opções são fixas, e o código escolhe quais aparecem conforme o tipo de falha:
  - **Refazer** a etapa com 1,5 vez o orçamento original da ficha (tempo e chamadas), sem acumular. Vale uma vez por etapa; um segundo "refazer" abre um card novo ligado, com as entregas e o seu pedido. Não aparece para "entrega grande demais".
  - **Seguir sem a etapa,** só se o roteiro marcar que ela pode ser pulada, e nunca no jurídico (E4) nem no relatório final (E5). O relatório mostra "etapa pulada por decisão sua".
  - **Encerrar o card,** como encerrado com falha que você reconheceu, com o que já foi aprovado guardado.

  "Mandar para a v1" não é opção, porque um card não troca de sistema no meio: se quiser, você encerra e pede de novo na v1. Sem resposta, vale o padrão das esperas por você, mais abaixo.
- **Medida no portão da fase 3.** (novo na v3.1) O sistema conta quantos cartões de resolução cada card gerou. Se passar de 1 por card na meta das 10 pessoas, os roteiros e os orçamentos são revistos antes de avançar, para você não virar gargalo.

### Prazos no relógio do banco

- **Prazos fora da VPS.** O relógio dos prazos roda dentro do Supabase e usa a hora do próprio banco, no horário de Brasília. Nenhum prazo depende do relógio da VPS nem de um texto de agente (mudou na v3.1: fica escrito qual relógio vale). Até o tempo máximo de cada execução é marcado por esse relógio; quem encerra o agente é o motor, que confere a cada 5 segundos e encerra o processo em até 15 segundos. O prazo do card cobre também o tempo de espera na fila.
- **Três níveis, cada um uma vez.** Com 80% do prazo, o card fica amarelo; no prazo, a Helena é chamada para destravar; uma hora depois, você recebe o aviso. Cada nível dispara uma vez só. Ao destravar, a Helena não muda o plano: ela escreve o que está travando, e quem manda o cartão com as opções é o código (mudou na v3.1).
- **Quando a Helena não é chamada.** Se o card já espera por você, a Helena não é chamada e o aviso vai direto para você. O mesmo vale quando o card está parado esperando cota, porque chamar a Helena gastaria justamente a cota que falta (novo na v3.1).
- **Prazo novo rearma os avisos.** (novo na v3.1) Cada mudança de prazo sua rearma os três avisos para o prazo novo, e o nível que o prazo novo já passou dispara na hora.
- **O relógio grava, o motor envia.** (mudou na v3.1: na v3, o aviso saía de dentro do Supabase.) O relógio e o vigia só gravam o aviso numa tabela; quem manda pelo Telegram é o motor, com reenvio até o Telegram aceitar. O reenvio é um passo do DBOS, que retoma sozinho depois de uma queda. A entrega é "pelo menos uma vez": raramente, depois de uma queda no meio do envio, um aviso pode chegar repetido. Do Supabase sai só um sinal de vida por tarefa agendada (um do vigia e outro do relógio) para o vigia de fora, com período e tolerância ajustados para a meta de 15 minutos. O padrão do healthchecks.io é 1 dia, com 1 hora de tolerância, e não serviria.
- **Nenhum padrão vence sem o lembrete entregue.** (novo na v3.1) Uma espera por você só aplica o padrão depois que o lembrete foi aceito pelo Telegram. Se o motor ficar fora por um dia, o relógio não cancela nada às suas costas: espera o lembrete sair.

### Esperas por você: todas têm padrão, e nenhum padrão aprova

Toda espera por você tem dono, prazo e um padrão para o caso de você não responder. O padrão fica registrado como padrão, nunca como decisão sua. A tabela de passagens não tem nenhuma passagem em que um padrão aprove entrega ou execute ação de fora, e a prova confere isso a cada mudança.

Quem decide se a espera é interna ou externa é o código, pelo roteiro: externa só quando o roteiro declara, naquela etapa, um prazo de alguém de fora. O agente nunca escolhe (novo na v3.1).

| Espera por você | Lembretes | Padrão, se você não responder |
| --- | --- | --- |
| Confirmar a leitura de volta de um pedido grande | 24 e 48 horas | O card é cancelado |
| Pergunta de um agente sobre algo interno | 24 e 48 horas | A etapa é cancelada |
| Pergunta sobre algo de fora, com prazo de terceiro declarado no roteiro | Um lembrete antes do prazo da pergunta (mudou na v3.1: na v3, cancelava no prazo sem lembrete) | A etapa é cancelada no prazo da pergunta |
| Entrega esperando a sua revisão: no jurídico, em que você é o segundo revisor; quando você é a última reserva; ou num critério de risco alto que o revisor respondeu "não consigo conferir" (este último é novo na v3.1) | 24 e 48 horas | A etapa é cancelada; a entrega nunca é aprovada pelo padrão |
| Cartão de resolução | 24 e 48 horas | A etapa é cancelada |
| Cartão de espera por capacidade (cota, login ou banco, depois de 6 horas) | 24 e 48 horas | A etapa é cancelada. Se a capacidade voltar antes, a etapa volta sozinha à fila, sem gastar tentativa (novo na v3.1) |
| Ação de fora proposta (só da fase 4 em diante) | Um lembrete antes do prazo da ação | A proposta expira; o padrão nunca executa (novo na v3.1) |
| Ação de fora que o motor executou e não confirmou em 15 minutos (só da fase 4 em diante) | 24 e 48 horas | Fica "não confirmada": nunca é repetida por este card nem marcada como falha, porque pode ter acontecido (novo na v3.1) |

- **Quando o padrão cancela uma etapa,** o card pergunta o que fazer (pular, refazer ou encerrar), com os mesmos lembretes; sem resposta, o card é cancelado. É esse caminho que leva todo card a um final, e a prova confere isso.
- **Vale o que chegar primeiro.** (mudou na v3.1: a v3 só tratava o card fechado.) Se o padrão já encerrou a etapa e o card ainda está aberto, a sua resposta atrasada fica guardada como decisão sua, ligada à pergunta, e é usada se você mandar refazer a etapa. Se o card já fechou, a sua resposta ou o seu pedido de ajuste abre um card novo já preenchido e ligado ao anterior, e o app mostra isso. Um toque feito numa versão antiga do card vira comentário, com o aviso "a peça mudou, veja a versão nova"; Cancelar sempre vale.

### Cota do ChatGPT: um medidor só, para a v1 e a v2

(mudou na v3.1: sai a "parte fixa do limite do plano".) Na v3, a v2 tinha um orçamento por dia, uma parte fixa do limite do plano, e o resto ficava para a v1. Só que ninguém sabe qual é o limite: a OpenAI estima de 15 a 160 mensagens a cada 5 horas no GPT-6.1 Sol, um número que não reconferimos (NÃO CONFIRMADO). A v3 também não tratava a janela semanal nem o crédito avulso. Na v3.1, vale a porcentagem que o próprio ChatGPT informa para a conta inteira, que já inclui o que a v1 gasta.

- **De onde vem o número.** O motor roda o comando de uso do Hermes da v2 (`hermes usage --json`, que existe na versão fixada do Hermes). Ele só lê o uso da conta, sem chamar o modelo, e usa o mesmo login da v2: o login nunca sai do Hermes, e o motor não guarda token. A leitura acontece no máximo a cada 5 minutos, fica gravada com a hora e é refeita antes de cada etapa se estiver velha. Em princípio, ler não gasta cota, mas isso é NÃO CONFIRMADO e é conferido no dia de prova da fase 2. O teste 2 roda essas leituras junto com as renovações forçadas do login, para provar que elas não derrubam o login. O Codex não é usado para isso, porque fica para a fase 4 e traria outro login.
- **As duas janelas.** Cada janela é reconhecida pela duração: 5 horas é a curta, e 7 dias é a semanal. Nunca pela posição, porque, quando só existe a semanal, ela vem no lugar da curta. Vale a pior das duas. Um modelo pode ter um limite próprio que o número da conta não mostra (NÃO CONFIRMADO se dá para ler); por isso a linha "Cota do ChatGPT esgotada" da primeira tabela continua valendo como rede de segurança.
- **As faixas.** Os números abaixo são o ponto de partida e são calibrados no teste 1.

| Faixa | Quando | O que roda na v2 |
| --- | --- | --- |
| Verde | Janela curta abaixo de 50% e semanal abaixo de 60% | Tudo |
| Amarela | Janela curta entre 50% e 80%, ou semanal entre 60% e 80% | Nenhum card novo começa. Seguem a Helena recebendo os seus pedidos, os revisores e as etapas dos cards em andamento |
| Vermelha | 80% ou mais em qualquer janela, limite atingido ou erro de cota | A v2 pausa inteira. Os cards mostram "esperando capacidade", com a hora de volta, e você recebe o aviso |
| Desconhecida | Duas leituras seguidas falham, ou a última leitura boa tem mais de 15 minutos | Nenhum card novo e nenhuma etapa nova de autor. Seguem só a Helena recebendo os seus pedidos e os revisores. Você recebe um aviso só |

- **A ordem quando a cota aperta.** A ordem da v3 continua, agora escrita como corte, do primeiro a parar ao último: os trabalhos de manutenção, depois os cards novos, depois as etapas de autor dos cards em andamento e, por último, os revisores e a Helena recebendo os seus pedidos, que só param na faixa vermelha. A faixa só decide quem pode entrar. Dentro do que pode rodar, vale a sua prioridade e a ordem de chegada (regra 7), e continuar um card nunca fura a fila de outro (mudou na v3.1: a ordem da cota podia ser lida como uma segunda fila, contra a regra 7).
- **A manutenção também passa pelo medidor.** (novo na v3.1) Tudo o que a v2 roda no ChatGPT passa pelo mesmo medidor e pelas mesmas vagas: os 5 casos fixos da noite, as provas de lição e as baterias de troca de modelo. Eles só rodam na faixa verde. Uma noite sem os casos fica marcada como "sem conferência por cota" e não conta como falha nem como acerto.
- **A v1 no mesmo número.** A v1 roda fora do motor e continua usando a conta, por isso a v2 para em 80% e os últimos 20% ficam para a v1. Na fase 0, uma consulta somente leitura, que você roda no editor SQL do Supabase com o script pronto, conta quantas execuções a v1 fez por dia em 7 dias de uso normal (se as tabelas de execução da v1 estão completas na produção é NÃO CONFIRMADO; a própria consulta mostra). Nada roda dentro da v1, porque lá o comando de uso poderia renovar o login da v1, e não sabemos se a versão do Hermes da v1 tem a trava contra duas renovações ao mesmo tempo (NÃO CONFIRMADO). Na fase 2, o gasto da v1 em porcentagem é medido num período com a v2 parada e a v1 ligada. (novo na v3.1)
- **Crédito avulso: a trava é sua, e o motor vigia.** (novo na v3.1) Segundo a central de ajuda da OpenAI, lida só pelo resumo de uma busca (NÃO CONFIRMADO), depois do limite do plano o uso passa a sair do saldo de créditos, sem erro. Por isso a pausa é pela porcentagem, e não pelo erro: a partir de 80%, a v2 não pega mais nenhum trabalho.
  - Na fase 0, você confere na página de uso do ChatGPT que o saldo de créditos é zero e que a recarga automática está desligada. O caminho exato dessa tela é NÃO CONFIRMADO; eu mando o passo a passo depois de conferir.
  - A cada leitura, o motor compara o saldo. Se ele cair, a v2 pausa e você recebe o aviso na hora. Se não der para saber se há crédito, o motor trata como "pode haver crédito".
  - Usar crédito só com decisão sua registrada. O motor só lê: nunca aciona a opção da conta que gasta um reinício guardado da cota.
  - Essa trava cobre a v2. A v1 pode gastar crédito ao bater 100%, e mudar isso na v1 exige a sua frase, porque é mudança no servidor. A proteção para a v1 é o saldo zero com a recarga desligada.
- **O que o medidor não vê.** (novo na v3.1) O medidor cobre só a cota da assinatura do ChatGPT. A voz da v1 chama a API paga da OpenAI, e a v1 também usa outros serviços pagos (xAI, ElevenLabs, Google Cloud e TypeSafe); esse gasto não aparece aqui. Ele fica no inventário da fase 0, com um cartão por serviço: desligar, manter como exceção escrita com teto, ou manter só para teste.
- **O teste 1 confere.** (mudou na v3.1) Os critérios da v3 continuam e ganham três, todos com a v1 ligada: a subida da janela semanal nas 24 horas do teste, vezes 7, fica abaixo de 60%; a janela curta nunca passa de 80%; e o saldo de créditos não muda. Se não houver como ler o número, o teste dura 7 dias, e o número de execuções por dia que coube vira um cartão para você fixar um teto diário.
- **Se o teste 1 falhar.** A primeira saída continua sendo passar as tarefas simples para o GPT-6 Luna, e o medidor passa a ler a janela que vale para ele (mudou na v3.1). A segunda é uma decisão sua, entre o plano Pro e créditos avulsos; a DEC-014 (sem API paga) continua valendo nos dois casos.
- **Os 21 agentes dividem a mesma cota.** (novo na v3.1) A cota é uma só para os 21 agentes e as 4 empresas (iGreen, Saúde, Humano Digital (BIZ-003) e eLiving™). Por isso, mesmo com os 21 especificados e provados na fase 1, eles ligam em produção um por vez, pelos portões, e cada um que liga entra no mesmo medidor. Rodar mais agentes ao mesmo tempo não diminui o gasto total: só concentra o gasto na janela de 5 horas. Se a cota não couber, o próximo agente espera, e você vê o motivo no painel.

### Se a conta do ChatGPT for suspensa

É um dos riscos aceitos, porque a empresa roda numa conta só enquanto valer a DEC-014. O uso pelo Hermes é permitido: desde 29/09/2026, ele é uma das ferramentas parceiras em que a OpenAI deixa usar a cota do ChatGPT (fonte no anexo).

- **Como aparece.** Para o motor, a conta suspensa aparece como login recusado: tudo pausa, as etapas ficam guardadas no banco, e você recebe o aviso com o passo a passo para entrar de novo. Se você tentar entrar de novo e não conseguir, o aviso vira o cartão de decisão abaixo (mudou na v3.1: fica escrito como um caso se separa do outro).
- **O que não se perde.** Cards, entregas, decisões e histórico ficam no Supabase, e não no ChatGPT. O simulador da esteira prova que, com o login recusado, tudo pausa sem perder nenhuma etapa e o aviso chega a você.
- **O que para junto.** (novo na v3.1) A v1 usa a mesma conta, então a Helena e os agentes da v1 também param. O menu automático da URA de clientes no WhatsApp sai de uma tabela fixa no código (`whatsapp-ura.mjs`) e não chama o ChatGPT; ele deve continuar respondendo o menu, mas o atendimento que vem depois depende dos agentes, que param (NÃO CONFIRMADO no ar). A voz da v1 usa a API paga da OpenAI, que é outro produto, cobrado à parte; se ela para junto é NÃO CONFIRMADO. As duas já estão no inventário da fase 0, com cartão de decisão. O Codex não serve de saída, porque entra com a mesma assinatura.
- **As saídas, num cartão para você.** (mudou na v3.1: na v3, as saídas não estavam escritas.)
  - **A) Esperar e contestar** a suspensão com a OpenAI. Como contestar não foi conferido (NÃO CONFIRMADO). Tudo fica guardado e volta de onde parou.
  - **B) Abrir uma exceção escrita à DEC-014,** para rodar os modelos por outro caminho, com teto de gasto. Exige a sua frase, porque muda o servidor.
  - **C) Encerrar os cards abertos,** guardando o que já foi aprovado.
  - Se a URA de clientes estiver ligada como exceção, o cartão inclui também trocar a resposta automática dela por um aviso de demora, com a sua frase.
- **Nenhuma saída liga sozinha.** Como na v3, nenhum perfil de produção tem modelo ou provedor reserva, e o motor confere no registro de uso que o modelo e o provedor foram os da ficha. Qualquer saída paga só entra pela sua frase, com a exceção escrita.

