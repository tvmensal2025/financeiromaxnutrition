# Sistema Helena: plano v3, o melhor até agora

Oct 9, 2026 · @anonimus

Este é o plano único, refeito do começo ao fim. Ele junta as duas análises anteriores, a revisão das fichas feita no seu PC e uma nova rodada de ataque ao plano, por três ângulos diferentes. Cada furo achado tem conserto, um teste que prova e a fase em que fecha, e não sobrou nenhum furo conhecido em aberto.

Os 3 furos da segunda análise eram do plano anterior e já estavam fechados no plano corrigido; esta versão fecha também os que apareceram depois. Ninguém consegue prometer zero furo desconhecido, então o plano traz o processo que acha o próximo furo antes de você: revisão independente no fim de cada fase, vigia no ar e todo erro virando teste.

## Como funciona

O banco manda, o motor executa e o agente só escreve conteúdo. Cada peça tem um papel só, e só o motor grava no banco, sempre pelas regras dele.

&#91;embedded content: onde cada peça roda · 3 lugares e um vigia de fora\]

- **Supabase, o banco.** Guarda a caixa de entrada, os cards, as 13 regras, o histórico e as cópias das páginas lidas. O relógio dos prazos e o vigia rodam dentro dele, fora da VPS.
- **Motor (DBOS), na VPS.** Pega a próxima etapa da fila, abre o agente, confere a resposta e grava uma vez só, pelas funções do banco.
- **Agente (Hermes travado), na VPS.** Roda numa pasta limpa por tarefa, só com as ferramentas "buscar" e "ler página", que são nossas. Devolve uma das 5 ações e não grava nada.
- **GitHub.** Guarda o código, as fichas e as regras. Roda os testes a cada mudança, publica na VPS, aplica mudanças no banco depois da sua frase e faz o backup da noite.
- **Vigia do vigia.** Um serviço gratuito de fora (healthchecks.io) espera um sinal do Supabase, do motor e do backup. Se um sinal parar, ele avisa você, mesmo com o Supabase e a VPS fora do ar.
- **ChatGPT.** A sua assinatura, com um login só da v2, separado do login da v1.

## A jornada do card

Cada pedido seu vira um card, e o card só anda por regras de código até voltar pronto para você. A Helena entende e pergunta, os agentes fazem o conteúdo e o motor garante a lógica.

&#91;embedded content: a jornada do card · 11 passos em 4 papéis\]

- **Nenhuma mensagem se perde.** Toda mensagem sua é gravada pelo código antes de qualquer IA, com número de protocolo. Uma mensagem repetida pelo WhatsApp não vira dois cards.
- **Leitura de volta.** Num pedido grande, a Helena responde "Entendi assim: objetivo, prazo e como é o pronto. Confirma?" antes de criar o card.
- **Classificação com desfazer.** A Helena classifica cada mensagem em card novo, ajuste, resposta, cancelamento ou conversa, e mostra como entendeu, com um botão para desfazer. Se ela falhar duas vezes, o código cria o card com o seu texto e pede que você escolha o serviço.
- **Ordem de serviço.** O card nasce com campos fixos: empresa, o que você quer, como é o pronto, prazo, prioridade e o que não pode. O pedido original viaja inteiro por todas as etapas e revisões.
- **A prioridade é sua.** Ela fica num campo do card que só você muda; nenhum agente consegue alterar.
- **Cancelar não depende de IA.** O botão Cancelar no app para o card na hora, inclusive com um agente trabalhando nele.

## As 13 regras de ferro

A lógica do card é uma tabela de estados e passagens guardada no banco, e uma única função muda o estado. Por isso as regras abaixo valem mesmo que um programa erre: o banco recusa o movimento.

| Regra que nunca quebra | Prova antes de publicar | Trava no banco | Vigia no ar |
| --- | --- | --- | --- |
| 1. Todo card e toda etapa abertos têm um dono e um prazo; nada espera sem prazo e alerta | Sim | Sim | Sim |
| 2. Todo card termina pronto, cancelado ou encerrado por você | Sim | Não | Sim |
| 3. Uma etapa nunca é trabalhada por dois ao mesmo tempo, e só a execução atual grava | Sim | Sim | Sim |
| 4. O revisor nunca é o autor, nem quem vai julgar a mesma peça depois | Sim | Sim | Sim |
| 5. Pedido de ajuste sempre volta ao autor, e toda volta passa por um contador com limite | Sim | Sim | Sim |
| 6. Nenhum ciclo; sub-cards em até 2 níveis; o card pai só fecha depois de todos | Sim | Sim | Sim |
| 7. A prioridade é sua; continuar um card nunca fura a fila de outro | Sim | Sim | Sim |
| 8. Nada externo (cadastro, contato, gasto, contrato, publicação) sem o seu ok registrado, e no máximo uma vez | Sim | Sim | Sim |
| 9. Toda entrega aprovada passou pelos portões do seu serviço, inclusive o relatório final | Sim | Sim | Sim |
| 10. Se uma decisão sua ou uma entrega aprovada mudar, o que dependia dela é refeito antes de o card ficar pronto | Sim | Sim | Sim |
| 11. Toda mensagem sua vira exatamente um card ou entra num card existente | Sim | Sim | Sim |
| 12. Falha do provedor ou do servidor não gasta tentativa nem pune o agente | Sim | Não | Sim |
| 13. Toda mudança fica no histórico, e o histórico reconstrói o card | Sim | Sim | Sim |

- **Prova antes de publicar.** Um teste percorre todas as combinações da tabela: cada resposta de agente em cada passo, queda no meio, resposta repetida ou atrasada e prazo esgotado. Como a tabela é pequena, isso vale como prova, não como amostra. Se uma combinação quebrar uma regra, a mudança não sai.
- **Trava no banco.** As regras 2 e 12 não cabem numa trava: a 2 depende do tempo e é garantida pelo relógio dos prazos, e a 12 depende de saber a origem da falha, que o motor classifica pelos próprios sinais.
- **Vigia no ar.** A cada 5 minutos, dentro do Supabase, uma checagem confere as 13 regras em todos os cards abertos. Se uma falhar, o card congela, a luz fica vermelha e você recebe o aviso.

## O agente: uma função com 5 ações

O agente recebe o pacote do card e devolve exatamente uma de 5 ações, num formato conferido. Qualquer outra coisa conta como formato errado e volta com o motivo.

| Ação | Para que serve | O que o código confere |
| --- | --- | --- |
| Entregar | Devolver o trabalho pronto | Modelo do serviço, tamanho, fontes e critério de pronto |
| Pedir sub-card | Passar uma parte para outro agente | O serviço está no cardápio, o agente existe, não é ele mesmo, cabe no orçamento e não forma ciclo |
| Perguntar | Tirar uma dúvida que só você responde | Vai pela Helena, com opções; o card espera com dono e prazo |
| Devolver a quem pediu | Pedido impossível ou ambíguo | Motivo obrigatório; volta para quem pediu |
| Registrar falha | Algo deu errado | O tipo da falha, que dispara o manual de falhas |

- **Pasta limpa por tarefa.** Cada tarefa roda numa pasta de perfil gerada da ficha, dentro do Hermes da v2, e apagada no fim. Memória, perfil do usuário, revisão em segundo plano e curadoria ficam desligados, e o Hermes fica fixado numa versão exata.
- **Login protegido.** A pasta da tarefa não guarda senha nem token: todas usam o login único da v2, que o Hermes renova um processo por vez. A adoção automática do login do Codex fica desligada, para os dois nunca dividirem o mesmo acesso.
- **Só duas ferramentas, e são nossas.** "Buscar" e "ler página" guardam uma cópia de cada página lida e contam os próprios limites. Não existe terminal, arquivo, memória nem ferramenta que grava.
- **Limites que fecham a conta.** Os passos sempre cobrem as buscas, as páginas e a resposta, com folga, e o validador das fichas recusa um orçamento impossível. Exemplo da Clara: 30 passos, 10 buscas, 15 páginas e 15 minutos.
- **Sem ação final, não conta.** Uma execução que termina sem exatamente uma das 5 ações é a falha "sem ação". Formato errado ganha uma única nova tentativa, só para corrigir o formato. No tempo máximo, o motor encerra o processo inteiro.
- **Pacote curto.** O agente recebe o card, o modelo do serviço, as 5 ações, as decisões válidas lidas na hora e as lições e exemplos daquele serviço. Contexto curto e focado é o que mais melhora a obediência.

## O motor: o DBOS executa, o banco manda

O motor é o DBOS, uma biblioteca aberta e gratuita (licença MIT) que grava cada passo concluído no próprio Supabase. O estado do card fica em tabelas nossas, então dá para trocar o motor um dia sem mexer em nenhum card.

&#91;embedded content: caminho de uma etapa no motor · 7 estados, 2 saídas de correção\]

- **Fluxos curtos.** Cada execução de uma etapa é um fluxo curto: abrir o agente, conferir a resposta e gravar. Tudo o que espera (você, uma dependência, a cota) é um estado no banco, não um fluxo parado. Assim, publicar código novo nunca deixa trabalho preso numa versão antiga.
- **Uma chave por execução.** A chave é a etapa mais o número da tentativa. Repetir um passo nunca duplica entrega.
- **Queda no meio.** O motor retoma do último passo concluído. Se o agente já tinha respondido, a resposta gravada é usada, sem gastar cota de novo.
- **Cancelou no meio?** Enquanto o agente trabalha, o motor confere o card e encerra o processo se ele foi cancelado. Uma resposta que chegue depois é recusada pelo banco.
- **Uma fila por agente.** Cada agente tem 1 ou 2 vagas, na ordem da sua prioridade e da chegada. Toda etapa entra na fila por um caminho só, no banco, e sempre com a prioridade do card: no DBOS, uma etapa sem prioridade passaria na frente das outras. Se um agente falha 3 vezes seguidas, um disjuntor pausa só ele.
- **Prazos fora da VPS.** O relógio dos prazos roda dentro do Supabase. Com 80% do prazo, o card fica amarelo; no prazo, a Helena é chamada; uma hora depois, você recebe o aviso. Cada espera por você já tem um padrão que você aprovou (interno: segue a recomendação e avisa; externo: cancela).
- **Publicar sem perder nada.** A versão do motor fica fixa entre publicações, para ele sempre retomar o que estava em andamento. Quando o desenho de um fluxo muda, a publicação espera a fila esvaziar, por até 15 minutos. Ao voltar, o motor encerra processos e pastas que tenham sobrado, e o vigia devolve à fila, com chave nova, qualquer etapa que tenha ficado sem execução viva.
- **Plano conferido antes de começar.** Todo plano da Helena é checado ao ser ativado: sem ciclos, todo serviço existe, cada etapa recebe o que precisa e o orçamento cabe. Se não passar, vale o roteiro original.
- **Entrega grande é dividida no plano.** A divisão por seções acontece ao montar o plano, e o relatório final junta as seções aprovadas.

## Qualidade em 3 portões

Cada entrega passa por três portões, do mais barato ao mais caro. O revisor só gasta tempo com o que já está bem formado, e você só vê o que tem risco.

1. **Validador automático** (código, instantâneo, sem custo). Recusa na hora, com o item exato, se:
   - faltar seção do modelo, passar do tamanho, não estiver em português ou tiver código de página (HTML);
   - uma afirmação vier sem citação e fonte, ou se a citação não existir, palavra por palavra, numa página que o agente leu nesta mesma execução pela nossa ferramenta (a tradução vai num campo à parte, e a citação original é a conferida);
   - um número do Caio não bater: ele preenche um modelo de cálculo com entradas e fórmulas, e o código refaz cada conta; cada entrada diz a origem (dado seu, fonte citada ou suposição marcada);
   - uma lei citada não estiver na tabela de leis, com o texto oficial do planalto.gov.br (por enquanto: LGPD, Código Civil art. 20, Lei 9.610/98 e Marco Civil da Internet);
   - o convite tiver promessa de renda, conferida por uma lista de frases proibidas.
2. **Revisor com rubrica** (IA). Marca aprovado ou reprovado em cada critério, apontando a prova, sem ver a confiança do autor. O revisor nunca é o autor, e cada restrição do seu pedido vira um critério. No jurídico, você é o segundo revisor: o card marca "leia antes de agir".
3. **Você**, só no plano da meta e em ação externa. Chega como cartão pronto para decidir.

**O próprio validador é testado.** Antes de valer, ele precisa recusar citações falsas, contas erradas, leis inventadas e código plantados de propósito. Um validador que deixa passar um defeito plantado não vai ao ar.

**O que escapa aparece.** Todo número mostra a origem, toda afirmação mostra a fonte, e cada entrega diz a própria confiança (alta, média ou baixa). Cada aprovação ou ajuste seu vira lição, todo erro que escapou vira um caso novo na bateria de testes, e uma rodada curta toda noite pega quando o provedor troca o modelo sem avisar.

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

&#91;embedded content: o card pronto · exemplo da meta das 10 pessoas\]

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
