## Os testes que decidem

Nenhuma fase avança por data, só por teste. Os testes de base rodam na fase 2, com a v1 funcionando ao lado como vai estar de verdade; se um falhar, a base é corrigida antes de construir em cima dela. Um teste verde vale para a versão que ele testou. Por isso, o card, o sinal de vida e o pedido de publicar dizem "passou no teste da versão X", e nunca "sem erro" (mudou na v3.1: frase medida no lugar de promessa).

**Onde cada teste roda (novo na v3.1).** O que pode estragar dados roda num Supabase descartável, montado dentro do GitHub na mesma versão da produção. Ele não tem nenhuma senha e tem uma trava que recusa qualquer destino que não seja esse banco de teste. Na produção roda só o que precisa da cota, do login, da VPS ou do estado real, sempre marcado como teste e limpo no fim. Assim, os testes que derrubam e repetem coisas não tocam o banco de verdade, que no plano grátis não tem backup automático.

| Onde roda | Quais testes |
| --- | --- |
| Supabase descartável no GitHub, sem senha | A parte lógica do 4, o 5 com respostas gravadas, o 7 com o banco só aceitando leitura, a conta do 10, as funções do 11 chamadas com a chave pública, a camada A do 12 e as provas automáticas |
| Supabase descartável no repositório helena-backup | O 8, com a cópia da noite |
| Produção: VPS, login e cota reais | O 1, o 2, o 3 (com o servidor falso, sem gastar cota), a parte de publicar, voltar e da trava no 4, as execuções reais do 5, o 6, o aviso real do 7, a medição do 10, a parte de fora do 11 e a camada B do 12 |

| # | O que testa | Como | Passa quando |
| --- | --- | --- | --- |
| 1 | Cota do ChatGPT | 20 tarefas reais num dia, com a v1 ligada, e o mesmo pedido mandado pelo WhatsApp e pela tela nova. A v2 roda uma tarefa por vez na vaga de trabalho, mais a vaga da Helena (mudou na v3.1: uma vaga de trabalho, e não 3 agentes em paralelo). Um medidor único lê, no próprio ChatGPT, a janela de 5 horas e a semanal (novo na v3.1) | A meta inteira cabe em até metade do limite, sem erro de cota. O uso da v2, contado pelo motor, e o da v1, contado nas execuções dela, aparecem separados. Cada mensagem é trabalhada por um sistema só. Card novo espera quando a janela de 5 horas passa de 50% ou a semanal passa de 60%, e o saldo de créditos continua zero (novo na v3.1). A espera medida na fila calibra os prazos das etapas (novo na v3.1) |
| 2 | Login | 48 horas com os 2 processos do Hermes da v2 ao mesmo tempo, o da vaga de trabalho e o da vaga da Helena. O teste força pelo menos 2 renovações do login, feitas por processos ao mesmo tempo (mudou na v3.1: 2 processos, o máximo da v2.0) | Nenhum login derrubado, as renovações aparecem no registro do login, e nenhuma pasta de tarefa guarda token |
| 3 | Executor travado, em duas partes (mudou na v3.1: uma parte de conformidade, que vale para qualquer executor, e uma parte só do Hermes) | Um servidor falso no lugar da OpenAI grava cada pedido, em todos os serviços e a cada perfil gerado, e o agente tenta chamar ferramentas 200 vezes seguidas. Tudo roda com a rede fechada (novo na v3.1). A parte do Hermes se repete a cada versão nova dele | Cada serviço recebe exatamente as ferramentas da ficha, inclusive os que não têm nenhuma. As instruções são só as da ficha. Nenhuma senha nem chave de API aparece no ambiente. O laço é cortado no limite, e a execução termina como limite de chamadas. O modelo é o da ficha. As instruções e a configuração do perfil terminam iguais às geradas. Nenhuma conexão sai para fora do servidor falso e das nossas ferramentas (novo na v3.1). A ação chega pelo canal aprovado no dia de prova; depois da primeira ação aceita, toda outra chamada é recusada e a execução termina inteira, com o registro de uso gravado, para não virar falha de infraestrutura (novo na v3.1) |
| 4 | Quedas, publicações e a trava do motor (mudou na v3.1: o teste olha o card nas nossas tabelas, e a parte que depende do DBOS fica separada) | Parte do card, que vale para qualquer motor: derrubar o motor 20 vezes no meio de um passo; publicar 5 vezes seguidas no meio de um passo, cancelando e respondendo no meio; ligar dois motores ao mesmo tempo; com a vaga de trabalho ocupada, pôr na fila uma etapa de prioridade baixa de um agente, depois uma de prioridade alta de outro, e tentar pôr uma sem prioridade por fora do caminho único; voltar à versão anterior depois de uma mudança no banco; publicar uma versão quebrada de propósito. No banco descartável, as publicações são simuladas parando o motor antigo e ligando o novo; na produção, uma publicação de verdade, com o seu toque, e uma volta (mudou na v3.1). Trava única (novo na v3.1): derrubar o motor que segura a trava de 3 jeitos (processo morto à força, contêiner parado e conexão cortada no meio), sempre pelo pooler de sessão da produção. Parte do DBOS: uma das publicações troca a versão do fluxo | Nenhum card perdido ou duplicado, nenhum processo sobrando e as mesmas vagas no fim. O segundo motor espera, e nenhuma etapa roda duas vezes. A etapa de prioridade alta roda primeiro, e a sem prioridade é recusada. A versão anterior roda sobre o banco já mudado. Cancelamento em até 15 segundos. A versão quebrada não pega nenhum trabalho, e o aviso "volte para a versão X", com a impressão digital da anterior, chega ao seu celular em até 10 minutos (mudou na v3.1: a volta passa a ser o seu toque no EasyPanel, porque nada fora dele tem acesso para voltar sozinho). Trava: depois de cada queda, ela fica livre sem ninguém mexer, e o motor novo assume antes do aviso de 15 minutos fora do ar; enquanto o antigo vive, o novo nunca a pega. DBOS: nada da versão antiga preso na fila, e nenhum fluxo retomado mais de 3 vezes (novo na v3.1) |
| 5 | Validador (mudou na v3.1: as execuções reais ficam divididas entre a fase 2, sem internet, e a fase 3, com "ler página") | 60 respostas defeituosas: citações falsas, cortadas ou de outra cláusula, contas erradas ou com entrada sem origem, leis inventadas, artigos sem o trecho da tabela, sites parecidos e código plantado. Entram também convite com termo de ganho, convite que recebeu os números do Caio, marca fora da grafia eLiving™ e texto que diz "enviei" ou "cadastrei" (novo na v3.1). Depois, 20 execuções reais sem internet na fase 2 e 20 com "ler página" na fase 3 | Recusa todos os defeitos plantados e aceita as citações honestas, com aspas e espaços diferentes. Nas reais, no máximo 1 nova tentativa de formato, e nenhum defeito que o código sabe conferir passa (mudou na v3.1: no lugar de "nada passa errado") |
| 6 | Servidor | 2 processos do Hermes ao mesmo tempo, com Gateway, WhatsApp e app no ar, uma publicação no meio, uma tarefa encerrada à força e outra estourando o tempo (mudou na v3.1: 2 processos, e não 3). O resultado é comparado com a medida de partida de 24 horas da v1, feita na fase 0a (novo na v3.1) | Processador abaixo de 70%, pelo menos 2 GB de memória livres, nenhum processo ou pasta sobrando, e WhatsApp e app no ar o tempo todo |
| 7 | Avisos (mudou na v3.1: um remetente só, o motor, e o vigia de fora avisando pelo robô do próprio healthchecks) | Desligar a VPS, parar o motor, parar o relógio do Supabase, simular o Supabase fora e, no banco descartável, deixar o banco só aceitando leitura; derrubar o canal de aviso uma vez; deixar um aviso preso na tabela de avisos (novo na v3.1) | O aviso chega ao seu celular em até 15 minutos nos cinco casos, por um caminho que não depende da peça que caiu, e o aviso que falhou é reenviado. Um aviso preso há mais de 15 minutos dispara o alarme pelo robô do healthchecks e por e-mail (novo na v3.1). A entrega é "pelo menos uma vez": raramente, um aviso pode chegar repetido (novo na v3.1) |
| 8 | Backup (mudou na v3.1: as cópias moram no repositório helena-backup, que só você cria e nenhuma IA alcança) | Toda semana, restaurar a última cópia num Supabase descartável, pelo único job que tem a chave de abrir e que não roda código do repositório principal. Antes do portão da fase 2, um ensaio cronometrado. E a limpeza das cópias velhas rodada com o backup parado (novo na v3.1) | A contagem de linhas bate com a lista guardada com a cópia. As checagens das 13 regras, que vêm dentro da própria cópia, passam. O vigia e o relógio voltam a rodar. O motor começa vazio: nenhum fluxo retomado e nenhum agente rodando duas vezes; as etapas que estavam executando ou na fila voltam com número novo, sem gastar tentativa; uma ação externa aprovada depois da cópia volta para "esperando você" (novo na v3.1). A limpeza nunca apaga a última cópia que restaurou bem (novo na v3.1) |
| 9 | Revisor (fase 3) (mudou na v3.1: medido também por par revisor e tipo de entrega) | 30 entregas com erros plantados de 7 tipos e 10 entregas limpas, de novo a cada troca de modelo ou de rubrica. Dois revisores de mentira: um que aprova tudo e outro que recusa tudo. No ar, um caso com erro plantado por noite, fora dos cards de verdade (novo na v3.1) | Pega pelo menos 27 dos 30 erros e recusa no máximo 2 das 10 limpas, com o resultado por tipo de erro. Em cada par revisor e tipo de entrega, pega pelo menos 3 de 5 erros e recusa no máximo 2 de 5 limpas; nos tipos de risco alto, cada erro é pego em pelo menos 2 de 3 rodadas (novo na v3.1). Os dois de mentira reprovam. O revisor nunca recebe a conversa do autor. Um erro que escapa no caso da noite passa pela tabela única de estados de qualidade, com uma prova de confirmação antes de qualquer consequência (novo na v3.1). O que escapar vira regra de código ou critério novo |
| 10 | Tamanho do banco (mudou na v3.1: vira uma conta com o tamanho real) | 72 horas com carga real e entregas do tamanho de verdade, com a limpeza da noite ligada. O GitHub mede quanto cada card ocupa e projeta 60 dias, somando o tamanho atual da produção, com a v1, e o espaço que linhas apagadas continuam ocupando | O banco para de crescer e, na conta, fica abaixo de 350 MB por pelo menos 60 dias; o motor confere o crescimento a cada hora. Como o limite de uso justo do Supabase soma todos os projetos da organização, um segundo projeto grátis entra na mesma conta (novo na v3.1) |
| 11 | Segurança (fases 0a e 2, e toda semana) | Varredura de fora de todas as portas e domínios. Cada função do banco chamada com a chave pública e com um usuário de fora, no banco descartável, e conferida na produção pelo catálogo do banco (a lista de acessos que o próprio banco guarda), só lendo (mudou na v3.1: chamar de verdade na produção executaria o efeito de uma função esquecida aberta). Páginas plantadas com endereços internos, imagens e instruções invisíveis. A mesma mensagem do WhatsApp 10 vezes, inclusive forjada. Novos na v3.1: a lista de segredos do GitHub comparada com a lista fechada; com o login das sessões, disparar todos os workflows, criar etiqueta e versão e empurrar em todos os ramos; um processo de agente tentando ler a credencial de migração; e a rota de ligação de saída da v1 chamada sem o seu toque, inclusive com o token fixo do gateway | Só as portas previstas abertas. Toda chamada de fora recusada, e nada aberto no esquema da v2. Nada interno lido e nada escondido na tela. Um card só, e nada forjado aceito. **Nenhuma credencial de produção no GitHub**: nenhuma senha de migração, endereço de publicação, acesso ao EasyPanel ou chave que grave no banco; os únicos segredos são de leitura, numa lista fechada (o do backup, só no helena-backup, e o do cartão de diagnóstico, que só lê uma tabela de números). A versão no ar, lida no sinal de vida, não muda em 30 minutos, porque só o Deploy no EasyPanel muda a versão. O processo do agente não enxerga a credencial de migração. Nenhuma ligação sai sem o seu toque: a rota recusa ou já está desligada (mudou na v3.1: sai a prova de que as sessões não editam workflows nem publicam, que o GitHub grátis não consegue garantir) |
| 12 | Regressão dos casos (novo na v3.1) | Cada serviço tem casos em duas listas: regressão (o que já passava) e capacidade (o que ainda é novo). Cada caso guarda uma fita (as respostas das ferramentas, gravadas). Camada A, no GitHub: repete a fita inteira e testa o código, sem gastar cota. Camada B, na VPS: o modelo real roda cada caso 3 vezes, com as ferramentas respondendo pela fita; um pedido sem resposta na fita é recusado, e o motor se recusa a ligar em produção nesse modo. Roda sempre que mudam a ficha, a rubrica, o modelo, uma lição, um exemplo, uma regra ou a versão do Hermes | Todo caso de regressão acerta 3 de 3 vezes (pass^3), conferido só por código. Um serviço só é publicado com o resultado da camada B daquela versão exata. Se a versão atual também falha num caso, ele é marcado como instável e desce para capacidade, com aviso, nunca em silêncio. Um caso de capacidade sobe para a regressão depois de 5 rodadas seguidas em 3 de 3. Casos tirados da v1 só entram anônimos e com a sua autorização |

**A trava do motor bloqueia sozinha (novo na v3.1).** Não está confirmado se a trava única, pega pelo pooler de sessão (a porta do Supabase que funciona em IPv4 e dá a cada motor uma conexão própria enquanto ele estiver ligado), fica livre quando o motor cai sem se despedir. Por isso, essa linha do teste 4 trava a fase 2 sozinha, mesmo com todo o resto verde. Sem ela, o DBOS gratuito retomaria no motor novo o que o antigo ainda está fazendo, e a regra 3 quebraria. Se ela falhar, você recebe um cartão com as saídas, cada uma testada antes de valer: a conexão direta do Supabase, que pede IPv6 ou um adicional pago, ou uma trava com prazo renovado no próprio banco, a mesma "reserva com prazo" descrita no cartão do motor próprio.

**Por que 3 de 3, e não a média (novo na v3.1).** Com 75% de acerto por tentativa, acertar as 3 vezes cai para cerca de 42%, e a média esconderia um caso que passou a errar sempre. Por isso, na troca de modelo, a regra deixa de ser "as notas conferidas pelo código caem no máximo 5 pontos" e passa a ser a regressão em 3 de 3 do teste 12, com as 48 horas de observação depois (mudou na v3.1). A camada A não mede o modelo: ela repete a fita e sai igual todas as vezes, então rodá-la 3 vezes não diria nada. O 3 de 3 só vale na camada B, com o modelo de verdade.

**Provas automáticas a cada mudança.** Além desses testes, estas provas rodam sozinhas a cada mudança, antes de publicar:

1. **O validador das fichas e do catálogo dos 21** (mudou na v3.1). Ele passa a conferir contra o plano v3.1, e não contra o plano antigo, como faz hoje. Passa também a cobrir os 21 agentes, o organograma e o catálogo de serviços: cada agente com um serviço só dele, revisor que nunca é o dono, ninguém revisando o que vai julgar depois, a Laura só no escopo pessoal e nenhum personagem do eLiving™ como funcionário. Cada regra nova tem um teste de mutação (um defeito plantado de propósito, que precisa ser recusado). Os "9 de 9" do v3 eram 8 defeitos plantados e 1 teste de que as fichas reais passam (mudou na v3.1: contagem corrigida).
2. **A prova da máquina de passagens, em três camadas** (mudou na v3.1: no lugar de "todas as combinações do card", que não cabem num teste). As camadas são todos os estados de uma etapa, o card sobre o roteiro e a ligação entre os dois. A prova imprime o tamanho do que percorreu, em estados e passagens, e diz "nenhuma violação conhecida nesta configuração de prova", nunca "zero furo". A tabela única de estados de qualidade está dentro dela. Os testes de mutação da tabela exigem que cada defeito plantado seja pego pela regra certa. A frase do v3 "todo contador tem teto" não valia para as suas ordens, que não gastam o limite de 6 execuções; agora elas têm um teto próprio, proposto em 3 e dependente do seu sim, e a prova diz por extenso até onde vai.
3. **As jornadas de ponta a ponta dos 21** (novo na v3.1). Cada agente tem pelo menos uma jornada: um card com uma etapa dele, da entrada ao pronto, reproduzido sobre a tabela real. O histórico precisa reconstruir o mesmo card (regra 13).
4. **O simulador da esteira,** com uma IA de mentira que trava, cai, estoura a cota, perde o login e muda de resposta.
5. **Sequências aleatórias de eventos,** inclusive os seus botões, que nunca podem passar do teto de execuções. Elas são um extra: amostra, não prova (mudou na v3.1: a prova é a da máquina).
6. **O motor ligado de propósito do jeito errado:** sem o endereço do banco, pelo caminho errado (inclusive o pooler de transação, onde a trava única não vale) ou com acesso de administrador. Ele precisa se recusar a ligar. Agora também com uma chave de API paga no ambiente, que precisa fazê-lo recusar (novo na v3.1).
7. **A camada A dos casos,** do teste 12 (novo na v3.1).
8. **O plano conferido pela máquina** (novo na v3.1). A conferência falha se um furo cita um teste que não existe, se um teste roda depois da fase do furo, se um código de furo some ou se aparece outra versão da frase de aprovação.
9. **A varredura de segredos com o gitleaks** (programa que procura chaves escritas nos arquivos) (novo na v3.1). A varredura de segredos do próprio GitHub não existe para repositório privado de conta pessoal. As regras são nossas, testadas contra as linhas com chave já conhecidas e contra o formato novo de chave do Supabase, e as exceções ficam guardadas só pela impressão digital da linha, nunca pelo valor.
10. **Os testes do app** (novo na v3.1). A montagem falha se faltar uma variável, e o pacote montado é varrido atrás de endereço de produção escrito no código.

As provas leves (o validador, a conferência do plano, a varredura de segredos e, se couber no tempo, a prova da máquina) rodam juntas num job só por envio, porque cada job é cobrado como pelo menos 1 minuto (novo na v3.1). Cada ação de terceiros usada nos workflows (os roteiros automáticos do GitHub) fica fixada pela impressão digital completa da versão (o SHA), e não por um número de versão que pode mudar (novo na v3.1).

**O que essas provas protegem, e o que não protegem (novo na v3.1).** No GitHub, a sessão de IA entra com o seu login, como administradora, e nenhuma regra do GitHub separa você dela. Uma sessão desviada, por engano ou por uma instrução plantada, conseguiria mudar um workflow ou desligar uma prova. Por isso, os testes do GitHub protegem contra erro, não contra uma sessão desviada. O que protege a produção de uma sessão desviada é outra coisa: nenhuma credencial de produção fica no GitHub, e só o seu toque no EasyPanel muda a versão no ar (teste 11). O toque decide quando e qual imagem vai ao ar, e a impressão digital garante que no ar está a imagem que você colou. Que essa imagem é a que passou nos testes, o GitHub registra; mas uma sessão desviada conseguiria montar e registrar outra. Isso protege contra acidente, não contra adulteração.

**Quanto as provas gastam do GitHub (novo na v3.1).** O plano grátis dá 2.000 minutos por mês para os repositórios privados da conta, somando todos, inclusive o helena-backup. Sem cartão cadastrado, quando eles acabam, tudo para, inclusive o backup. Por isso existe uma tabela única de minutos, escrita na fase 0a antes de ligar qualquer workflow novo, com meta abaixo de 1.200 minutos e aviso em 70% e em 90% no cartão de diagnóstico.

| O que gasta | Quando roda | Minutos por mês | De onde vem o número |
| --- | --- | --- | --- |
| Testes da v1 (gateway e app), como estão hoje | A cada envio, às vezes em 2 ou 3 ramos | Cerca de 730 | Medido em cerca de 15 dias |
| Cartão de diagnóstico | A cada 3 horas | Cerca de 240 | Conta: 8 por dia, e cada job é cobrado como pelo menos 1 minuto |
| Job leve por envio (varredura de segredos, validador e conferência do plano) | A cada envio, cerca de 300 por mês | Cerca de 300, se couber em 1 minuto | Estimado; medido na fase 0b |
| Backup da noite | Toda noite | Cerca de 100 | Estimado; medido na fase 0a |
| Restauração semanal | Uma vez por semana | A medir | Ensaio da fase 0b |
| Parte lógica do teste 4 | Antes de publicar e uma vez por semana | De 15 a 30 por rodada | Estimado |
| Prova da máquina, jornadas dos 21, montagem da imagem, testes do app, prévia das telas e auditoria dos workflows | Quando a parte deles muda | A medir | Medido ao ligar cada um |

Só o que já tem número soma cerca de 1.370 minutos, acima da meta, antes de contar o resto. Por isso, antes de ligar qualquer workflow novo, os testes da v1 passam a rodar só na main e nos pedidos de mudança, e só quando os arquivos deles mudam; a economia é medida e escrita na tabela. A prioridade é esta: backup, depois diagnóstico, depois a varredura de segredos, depois o resto. Se faltar minuto, corta-se de baixo para cima, e o backup nunca é cortado.

**Se o teste 1 falhar:** a primeira saída é passar as tarefas simples para o GPT-6 Luna, que no Plus tem cota estimada de 350 a 3.000 mensagens a cada 5 horas, contra 15 a 160 do GPT-6.1 Sol. Esses números são estimativas da OpenAI, não reconferidas nesta rodada, e ainda não se sabe quanto uma execução do Hermes gasta; o dia de prova mede isso (mudou na v3.1: números marcados como estimativa). A segunda saída é uma decisão sua, entre o plano Pro e créditos avulsos; a DEC-014 (sem API paga) continua valendo nos dois casos. Nenhum crédito é gasto sem essa decisão, e o motor avisa se o saldo cair (novo na v3.1).

**Se a conta do ChatGPT for suspensa:** é um dos riscos aceitos, porque a empresa roda numa conta só enquanto valer a DEC-014. A v1 também para, porque usa a mesma conta (novo na v3.1). Tudo pausa sem perder nada, e você recebe o aviso. A decisão entre as saídas é sua; o cartão com elas (por exemplo, esperar a revisão da conta ou abrir uma exceção escrita à DEC-014) fica escrito já na fase 2, com o custo e a consequência de cada uma (novo na v3.1).

## Fases com portão

Cada fase termina com uma nova revisão independente, que tenta quebrar o que foi feito. A fase só avança com todos os testes dela passando e nenhum furo conhecido em aberto daquela fase, contado pelo registro de furos, que passa a ser um arquivo de dados conferido pela máquina (mudou na v3.1: a contagem vem do registro, e não de uma frase escrita à mão). Nenhuma fase avança por data; uma meta de duração é só uma meta.

Eram 5 fases; agora são 7 etapas, porque a fase 0 foi dividida em estancar e vigiar e entrou o "Agora" (mudou na v3.1). O desenho das fases é refeito a partir da mesma lista que a máquina confere.

| Fase | Em uma frase | Portão, em resumo |
| --- | --- | --- |
| Agora | Só texto e decisões | Conferência cruzada fechada e a sua frase de aprovação do texto |
| 0a · Estancar | Cópia do banco antes de tudo; fechar o que está exposto | Cada passo deixa a v1 igual ou melhor que antes |
| 0b · Vigiar | Backup da noite, avisos e diagnóstico; corre junto com a fase 1 | Restauração e aviso de teste provados |
| 1 · Especificação | Os 21 agentes provados no papel | Nada divergente; máquina e as 21 jornadas verdes |
| 2 · Esqueleto | Publicar e voltar primeiro; depois o motor e os testes de base | Testes 1 a 8, 10 e 11, e a trava do motor, verdes |
| 3 · Primeira meta | As 10 pessoas, de E1 a E5 | Meta aprovada sem ninguém destravar à mão |
| 4 · Crescer | Os demais agentes, um por vez | Por serviço: estágio, depois ativo |

- **A ordem.** A fase 0a vem antes de qualquer peça nova. A fase 1, só de arquivos, começa depois do portão 0a e corre junto com a 0b. A fase 2 só começa com os portões 0b e 1 fechados (mudou na v3.1).
- **A v1 segue com o dia a dia.** Até a fase 3 provar que a v2 entrega melhor, cada pedido vai para um sistema só, e o que a v2 ainda não faz continua na v1.
- **Uma sessão de construção por vez** (novo na v3.1), como manda o WIP = 1 do AGENTS.md. Toda sessão começa e termina no mesmo arquivo de estado da construção.
- **O Codex fica para a fase 4.** Ele só entra como segundo executor depois de passar na parte de conformidade do teste 3 e no teste 5, com o próprio login, as mesmas ferramentas e a rede isolada (mudou na v3.1: entra a rede isolada).
- **A Vercel fica fora do motor, do Hermes e do app nas fases 0 a 3** (novo na v3.1). Os motivos que decidem são estes: o DBOS gratuito só retoma direito com um processo vivo segurando a trava única; o login do Hermes precisa de uma pasta fixa com trava entre processos, e copiá-lo para várias máquinas derrubaria o acesso de todos; o relógio e o vigia já rodam no Supabase; por padrão, a Vercel publica a cada mudança, sem o seu toque, e o uso comercial pede o plano pago, cobrado por membro mais o uso (valor NÃO CONFIRMADO); o AI Gateway dela é API paga, contra a DEC-014; e uma telemetria de fora levaria dados das pessoas recrutadas para mais um lugar (LGPD). O limite de tempo das funções da Vercel não é o motivo, e os números citados antes (300, 800 ou 1.800 segundos, conforme o plano) são NÃO CONFIRMADO.

### Agora: só texto e decisões (novo na v3.1)

- **Conferência cruzada final.** Cada linha do registro de furos é conferida contra o plano v3.1, o que não chegou a terminar na rodada anterior. Ela vem antes de pedir a sua frase.
- **As decisões e confirmações** da lista "Agora", em "O que preciso de você".
- **Nada muda** no banco, no servidor ou no ar.

**Portão:** nenhuma linha do registro sem lugar no plano v3.1, e a sua frase de aprovação do texto.

### Fase 0a · Estancar (mudou na v3.1: a fase 0 foi dividida, e esta parte vem antes de qualquer peça nova)

A fase vale para a v1 também, porque as duas dividem o servidor, o banco e a conta do ChatGPT. Cada passo tem a conferência e o caminho de volta prontos antes de começar, e só acontece depois da sua frase para aquele passo.

1. **Ponto de partida** (novo na v3.1). Um inventário só de leitura e o checklist da v1: login no app, WhatsApp, saúde do gateway, uma tarefa do Hermes, formulário de leads, tarefas agendadas, o caminho da DEC-022 (o seu comando de criar empresa, conta ou entidade) e a URA de clientes. O resultado de hoje é anotado como está, mesmo que algo já esteja vermelho, porque a v1 travou. O checklist roda de novo logo depois de cada passo e no dia seguinte; até a 0b ligar os avisos, é ele quem vigia.
2. **Ver se alguém entrou.** A checagem de invasão, só de leitura, no console do EasyPanel (você roda, com o meu passo a passo), e a minha varredura de fora em todas as portas e domínios. As portas 9119 e 8642 fecham logo depois, sem esperar a cópia, porque não tocam no banco. Se aparecer sinal de invasão, conter vem antes de reconstruir: eu trago na hora o cartão para trocar as chaves já, mesmo com a sua escolha de trocá-las no fim dos testes, e a v1 é refeita de uma imagem limpa antes da fase 2 (mudou na v3.1: conter primeiro, e não depois de refazer a v1).
3. **Contas com dois caminhos de volta** (novo na v3.1). Verificação em duas etapas no e-mail principal, no GitHub, no Supabase (com o segundo fator em outro aparelho, porque ele não tem códigos de recuperação), no EasyPanel, na Hostinger, no ChatGPT e no Telegram. Os códigos ficam impressos e guardados em dois lugares, e nunca só por SMS. Se o EasyPanel tem verificação em duas etapas é NÃO CONFIRMADO.
4. **Tabela única de minutos do GitHub** (novo na v3.1), escrita antes de ligar qualquer workflow, e o padrão de todo workflow: permissões mínimas, ações fixadas pelo SHA, tempo máximo e fila.
5. **Cópia completa do banco, antes de qualquer mudança nele** (mudou na v3.1: o backup de fora começa aqui). Você cria à mão o repositório privado helena-backup, sem nenhum app de IA instalado. Você roda, no editor SQL do Supabase, o script que cria o papel só de leitura do backup. Você mesmo dispara o workflow da cópia completa e criptografada, que é restaurada num Supabase descartável para conferir as contagens, sem cofre, senhas nem sessões. É você quem executa porque as sessões na nuvem recebem recusa (erro 403) ao tentar chegar ao Supabase, o Windows do seu PC bloqueia o supabase.exe e a senha do banco não pode ficar no GitHub principal (novo na v3.1). Este é o primeiro workflow novo ligado.
6. **Fechar o que é barato e tem volta,** um passo por vez (mudou na v3.1: quem executa cada SQL é você, no editor SQL do Supabase, com o script e o caminho de volta que eu preparo e confiro). Desligar o modo de teste do app e o cadastro de contas novas. Tirar o papel de fundador do helenasistema.publico. Tirar do anônimo as funções abertas, contadas no banco antes de mexer (o plano diz 38 e as migrations da v1 têm 43: NÃO CONFIRMADO). Pôr as tabelas da v1 numa lista, com uma pergunta só a você, já com a resposta recomendada: "fica fechada; nada é apagado".
7. **Chaves, pela sua escolha de 10/10/2026: troca no fim dos testes** (mudou na v3.1: a fase 0a não troca as chaves do banco). O risco fica aceito e escrito: até a troca, a chave de acesso total ao banco continua valendo. Por isso, já aqui, o repositório continua privado e os arquivos rastreados que têm chave passam a ler variável de ambiente, sem trocar o valor. O token escrito no código de voz só sai depois de você confirmar que a variável existe no EasyPanel, para as ligações não caírem antes da hora. Uma varredura com o gitleaks, com os valores escondidos, monta a lista de chaves só com os nomes. A troca vira item do portão 2, com uma data de revisão na sua fila.
8. **Central da v1 e serviços pagos** (novo na v3.1). Um inventário só de leitura do que a v1 faz com gente de fora: a URA que responde clientes no WhatsApp (menu de Vendas e Suporte, com resposta automática), as ligações de saída por IA para qualquer telefone e o possível uso de API paga na voz. Entram também todos os serviços pagos chamados no código: OpenAI, xAI, ElevenLabs, Google Cloud e TypeSafe. No código da v1, a rota que dispara uma ligação aceita o token fixo do gateway, e um token do gateway aparece escrito em arquivos do repositório; se for o mesmo valor que está no ar (NÃO CONFIRMADO), quem tem uma cópia do repositório consegue disparar uma ligação. Esse token não é chave do banco, então não entra na sua escolha de trocar no fim dos testes: se o inventário confirmar, eu trago um cartão para trocá-lo já. Você decidiu desligar a central. Desligar mexe no ar, então só acontece com a sua frase e depois de os clientes serem avisados. A senha no endereço que recebe as mensagens pode entrar antes; a trava do WhatsApp no seu número só vem depois de a URA sair, porque travar antes calaria a URA sem aviso. No mesmo inventário: 24 horas de medição de processador e memória, que são a partida do teste 6, e a contagem só de leitura das execuções da v1.
9. **Quem escreve no repositório.** O Lovable, conforme a sua resposta; os apps e tokens do GitHub restritos aos repositórios escolhidos; e a regra escrita "no GitHub, a sessão é você".
10. **O plano do Supabase.** O tamanho do banco e o tráfego são medidos, e você recebe o cartão "grátis ou Pro".
11. **Receitas e app.** As receitas do mantenedor "mudar o banco" e "publicar e voltar", e o app que falha fechado: sem endereço de produção escrito no código e com o servidor de teste só no próprio computador. A mudança no app sai com o seu toque de publicar, como hoje.

**Portão 0a** (mudou na v3.1: o critério virou "igual ou melhor que antes do passo", e o item das chaves depende da sua escolha):
- a varredura de fora mostra só as portas previstas;
- as funções e tabelas da lista recusam o anônimo e um usuário de fora: no banco descartável, chamando de verdade; na produção, pelo catálogo, só lendo;
- o login continua funcionando;
- a cópia completa, restaurada, bate nas contagens;
- o checklist da v1, com a DEC-022 e a URA, ficou igual ou melhor que antes de cada passo; um item que já estava vermelho no ponto de partida não trava o portão, mas fica anotado, com dono;
- as chaves seguem a sua escolha: com a troca no fim dos testes, nenhuma chave escrita em arquivo novo, os arquivos rastreados lendo variável e a troca marcada no portão 2; se você mudar para trocar já, cada chave antiga é recusada;
- a verificação em duas etapas tem dois caminhos em cada conta da lista;
- a URA está desligada, com os clientes avisados, ou, até a sua frase, funcionando como antes e anotada como pendência sua;
- a tabela de minutos está escrita, e o backup é o único workflow novo ligado;
- nada mudou sem a frase do passo, e cada SQL tem o script de volta guardado.

### Fase 0b · Vigiar (novo na v3.1: corre junto com a fase 1 e fecha antes da fase 2)

- **Backup da noite** no helena-backup, com a restauração semanal (teste 8).
- **Vigia do vigia e Telegram.** O healthchecks.io e o robô de avisos no Telegram, com um remetente só, o motor, e um aviso de teste por mês.
- **Cartão de diagnóstico.** Um job do GitHub lê, com um papel limitado, só uma tabela de números e escreve numa issue fixa. Quando não consegue ler, escreve "banco só leitura" ou "inacessível às HH:MM", e mostra sempre "atualizado às HH:MM".
- **Workflows na ordem de prioridade:** o backup (já ligado na 0a), depois o diagnóstico, depois o job leve com a varredura de segredos.
- **Testes automáticos** das especificações e do app, sem nenhuma senha.
- **Fila "Precisa de você"** numa issue fixa, com prazos, e os ramos antigos arquivados por etiqueta antes de serem apagados.

**Portão 0b** (obrigatório antes da fase 2):
- uma restauração semanal passou;
- o aviso de teste chegou ao seu celular pelos dois caminhos, o do motor e o do healthchecks;
- o cartão de diagnóstico está atualizando no intervalo;
- a varredura de segredos está verde a cada envio;
- os minutos do mês batem com a tabela e estão abaixo da meta.

### Fase 1 · Os 21 agentes provados na especificação (mudou na v3.1: eram 5 fichas; agora são os 21, só em arquivos)

Nada vai ao ar nesta fase: ela só escreve e prova arquivos.

- **Os 22 pontos da conferência que não batiam:** 12 divergentes, 6 parciais e 4 ausentes. Entre eles, o convite que não recebe os números do Caio, a checagem de termos de ganho, a Clara revisando o relatório final e as reservas por etapa.
- **Um centro de serviços compartilhado pelas 4 empresas** (novo na v3.1). Os 21 atendem iGreen, Saúde, Humano Digital (BIZ-003) e eLiving™, e não são 21 por empresa: a empresa é uma informação do card, e o agente recebe só o pacote daquela empresa (grafia, voz e proibições). O catálogo de serviços é um arquivo de dados: cada serviço tem um dono, um tipo de entrega, um revisor, uma reserva, as ações liberadas e as ferramentas. Cada agente tem um serviço só dele.
- **Sobreposições resolvidas** (novo na v3.1). A Marina faz o plano de projeto e não acompanha nem move card, porque isso é do motor. O Bruno faz o plano de testes e não substitui o revisor nem o código. A Olívia faz o procedimento operacional, e o Felipe, o controle administrativo. O Augusto faz a análise estratégica, a Camila, o plano de campanha, e a Nina, os requisitos de produto. A Laura fica no escopo pessoal, sem pacote de empresa. Sirlene, Doutor Vital, Alex e Rafael são personagens do produto eLiving™, não funcionários, e ficam fora do organograma.
- **Cada um dos 21 com ficha, casos e jornada** (novo na v3.1): a ficha, o tipo de entrega com checagens e rubrica, os casos de regressão e de capacidade com as fitas, e pelo menos uma jornada de ponta a ponta reproduzida sobre a tabela real.
- **A máquina de passagens:** um vocabulário único de nomes, a tabela de passagens neutra quanto ao motor e a prova em três camadas. Dentro dela fica a tabela única de estados de qualidade, com a precedência entre o disjuntor de falhas, a observação por escapes e a suspensão do par revisor, para que um mesmo escape tenha uma consequência só, escrita (novo na v3.1).
- **Qualidade por contrato** (novo na v3.1). A ação do agente chega por uma ferramenta tipada (de formato fechado), se o dia de prova confirmar. As checagens ganham código, com um caso bom e um ruim. A rubrica ganha a resposta "não consigo conferir". O relatório E5 é montado pelo código, com a regra 4 escrita por extenso para ele: quem revisa o relatório confere só a fidelidade às entregas aprovadas e a linguagem, sem reavaliar o mérito de nenhuma entrega, nem da própria, sem internet e nunca sendo a autora, a Helena.
- **O texto do motor, das vagas e do executor:** o DBOS, com o estado do card nas nossas tabelas; uma vaga de trabalho e uma da Helena; o Hermes atrás de um adaptador; e fichas sem "buscar" até a fase 4.
- **Pesquisa jurídica da primeira meta, antes do plano dela** (novo na v3.1). Ela cobre o risco de pirâmide ou marketing multinível (Lei 1.521/51, art. 2º, IX, e o CDC) e a base da LGPD para quem é recrutado, com uma linha que diz o que se guarda, por quanto tempo e como se apaga. Só entram fontes oficiais, que você aprova. O que ela achar entra na tabela de leis e nos temas obrigatórios da E4. Se ela mostrar risco alto, a meta não começa e vira cartão para você.
- **O plano conferido pela máquina,** o registro de furos como dado e o livro de autorizações em dois níveis (novo na v3.1).

"Provado na especificação" quer dizer que a lógica do card de cada agente passa na prova e nas jornadas. Não quer dizer que o agente já entrega bem: isso só se mede com cota real, na fase 3 para os 5 serviços da meta e na fase 4 para os demais.

**Portão 1:**
- a conferência roda de novo, e nenhum dos 22 pontos fica divergente, parcial ou ausente;
- o validador confere contra o plano v3.1 e passa, com um teste de mutação para cada regra nova;
- o validador dos 21 está verde: todos com um serviço só deles, nenhum revisor que seja o dono e ninguém revisando o que vai julgar depois;
- a prova da máquina imprime o tamanho e nenhuma violação conhecida nesta configuração, e as jornadas dos 21 reproduzem sem violação;
- os furos da fase 1 estão provados, cada um com um caso que o reproduz e um teste que o recusa;
- a pesquisa jurídica está pronta para você aprovar as fontes;
- a revisão independente não deixou furo conhecido em aberto;
- a sua frase continua valendo se o escopo não mudou; se mudou, eu mostro só a diferença e peço de novo.

### Fase 2 · Esqueleto andando

- **Primeiro, o caminho de publicar, com um motor "olá"** (mudou na v3.1: saem o botão de publicar no GitHub e o ramo só de produção). A imagem é montada uma vez no GitHub, só quando aquele serviço muda, e guardada no registro privado de imagens do GitHub. No app, "Preparar publicação" pausa e esvazia a fila e mostra a impressão digital da imagem (o digest, um código que identifica exatamente aquela imagem). Você cola a impressão digital no EasyPanel e aperta Deploy. Voltar é colar a impressão digital anterior; isso é ensaiado pelo celular e cronometrado, sem prometer tempo antes do ensaio. É NÃO CONFIRMADO que o EasyPanel aceita a impressão digital no campo da imagem. Se não aceitar, a saída é uma etiqueta única por versão, nunca reaproveitada, com a versão conferida pelo motor no sinal de vida.
- **Depois, um dia de prova** (mudou na v3.1: vem logo depois do caminho de publicar). O comando exato que vai rodar os agentes é provado contra um servidor falso que grava cada pedido: os limites, a pasta vazia, o login e a ordem de leitura das falhas. Entram três perguntas novas (novo na v3.1): o Hermes chama a ferramenta de ação e termina? O comando de uso do Hermes mostra as duas janelas da cota sem gastar cota? Quanto o Hermes leva para partir, e quanto cada turno gasta da cota? Se o Hermes não respeitar a ferramenta de ação, o canal continua o texto final conferido do v3, e isso fica registrado.
- **Depois, a base.** O motor DBOS, ligado ao Supabase pelo pooler de sessão, com as tabelas da v2 num esquema próprio (uma área separada do banco) fechado para fora; a função única que muda o estado; a tabela de passagens aplicada no banco, com a impressão digital conferida; as vagas; o adaptador do executor; o medidor de cota; os botões do card no app e a proteção contra aba antiga aberta; os avisos; os casos na camada A; "ler página" provada contra páginas falsas; o teste 3 com a rede fechada; e a prévia das telas por imagens, para você ver no celular antes de publicar.
- **Os testes de base** 1 a 8, 10 e 11, com a v1 ao lado.
- **Só a E1 do Caio de ponta a ponta,** sem internet.
- **A troca das chaves, pela sua escolha** (mudou na v3.1): uma chave por peça, colada por você direto no Supabase ou no EasyPanel; o par antigo desligado com volta; e revogado só depois de um período medido sem nenhum uso da chave antiga.
- **Os ensaios:** a restauração cronometrada (teste 8) e a entrada em cada conta com o celular principal desligado.

**Portão 2:**
- testes 1 a 8, 10 e 11 e o dia de prova verdes;
- a trava do motor liberada quando ele cai, item que bloqueia sozinho;
- a prova em camadas sem violação conhecida, e a tabela do banco com a mesma impressão digital da que passou na prova;
- a volta pelo EasyPanel e a restauração ensaiadas e cronometradas;
- o portão 0b fechado;
- a entrada nas contas sem o celular ensaiada;
- as chaves trocadas e as antigas desligadas, como você escolheu;
- a E1 do Caio de ponta a ponta, sem ninguém destravar à mão, com os casos dela verdes na camada A;
- a revisão independente sem furo conhecido em aberto.

### Fase 3 · Primeira meta real

- **Antes de começar** (novo na v3.1): a pesquisa jurídica aprovada por você e o plano da meta aprovado, com as fontes da Mimix e do Hub.
- **A meta:** o plano para recrutar as 10 primeiras pessoas da Humano Digital (BIZ-003), na Mimix e no Hub, de E1 a E5. Os 5 serviços da meta entram em estágio: a conta do Caio, o roteiro de treinamento e o convite da Isabela, o parecer da Clara e o relatório da Helena. O Ravi continua pausado.
- **Internet só por lista** (mudou na v3.1): só "ler página", numa lista montada pelo código (links do seu pedido, fontes que você aprovou, termos da Mimix e do Hub e a tabela de leis), sem busca aberta.
- **Qualidade medida:** rubricas calibradas e teste 9 por par; relatório E5 montado pelo código; boletim por serviço e disjuntor de qualidade, decididos pela tabela única de estados de qualidade; lições que só valem com efeito medido; os 3 gestos de treino no card; casos na camada B; e a trava do navegador.
- **Dados das pessoas** (novo na v3.1): a linha da LGPD aplicada, e nenhum dado de quem é recrutado guardado além do que ela permite.
- **Canal:** o WhatsApp continua na v1, e a v2 recebe pedidos pela tela nova.

**Portão 3:**
- E1 a E5 aprovadas de ponta a ponta, sem ninguém destravar à mão, e visíveis no card; o convite é enviado por você, nunca por um agente;
- a parte da fase 3 do teste 5, com "ler página", verde (novo na v3.1);
- teste 9 verde por par revisor e tipo de entrega;
- no máximo 1 cartão de resolução por card;
- regressão (teste 12) em 3 de 3 nos casos dos 5 serviços (novo na v3.1);
- a trava do navegador ligada por teste: todas as telas abrem sem violação, e uma imagem plantada, fora da lista de origens, é bloqueada (novo na v3.1);
- teste 11 semanal verde;
- a linha da LGPD conferida (novo na v3.1);
- a revisão independente sem furo conhecido em aberto.

### Fase 4 · Ligar os demais, um por vez

Os 21 já saem da fase 1 provados na especificação, mas ligam em produção um por vez (WIP = 1), pelos portões, de estágio a ativo. O motivo é honesto: tudo roda numa conta só do ChatGPT e numa VPS de 4 núcleos dividida com a v1, e a v2.0 tem uma vaga de trabalho. Cada agente que sobe gasta cota para rodar os casos dele 3 vezes e precisa de 5 cards reais em estágio. Ligar vários juntos dividiria a cota e esconderia de qual deles veio um erro. Não prometo data: cada um sobe quando passa (novo na v3.1).

- **A ordem é sua.** Eu proponho uma, pelo que você mais pede hoje na v1 (a contagem da fase 0a), e você confirma (novo na v3.1).
- **iGreen e Saúde:** antes do primeiro serviço delas, a voz e as proibições de cada uma são registradas com você; hoje elas estão NÃO CONFIRMADO (novo na v3.1).
- **Sub-card volta, com prova própria:** uma camada nova da prova da máquina, para planos que mudam no meio, com até 2 níveis e sem ciclo.
- **"Buscar" e o Ravi:** com o serviço de busca e o custo escolhidos por você, e com prova própria contra páginas plantadas.
- **Conjunto-ouro das suas mensagens:** 50 mensagens confirmadas por você, antes de a Helena assumir o WhatsApp.
- **Codex** só com o teste de conformidade e a rede isolada; **revisor em outro modelo** só como experimento.
- **Ação de fora feita pelo motor** só com executor próprio, teste e decisão sua; aprovar no app passa a pedir também o código do autenticador.
- **Uma 2ª vaga de trabalho** só se os testes 1, 2, 4 e 6, repetidos com 3 processos, mostrarem folga, e só com a sua frase (novo na v3.1).
- **Vercel** só com um motivo escrito, pelos motivos do começo desta seção.

**Portão 4, por serviço:** o serviço vai para estágio quando 10 casos de regressão passam em 3 de 3 e o teste 3 passa para ele; vai para ativo depois de 5 cards reais em estágio sem nenhum escape. Cada subida é um toque seu; descer é automático e nunca mexe em card em andamento. Sub-card e "buscar" só ligam com a prova própria verde. O WhatsApp só muda de canal com o conjunto-ouro verde, escrito como "acerto medido em 50 mensagens", e com o ensaio da troca feito.

## O que preciso de você

Para seguir, uma aprovação do texto. O que roda hoje só muda na fase 0a, um passo por vez, sempre depois da sua frase para aquele passo, e quem executa cada SQL é você, no editor SQL do Supabase, com o script e o caminho de volta que eu preparo e confiro (mudou na v3.1). A fase 2 cria um serviço novo e tabelas novas, também com a sua frase.

**A sua frase tem dois níveis (novo na v3.1).**

| Nível | Para quê | Quanto tempo vale |
| --- | --- | --- |
| Texto | Aprovar o que o plano, o roteiro ou uma ficha dizem | Enquanto aquela versão existir. Só peço de novo se a versão, o estado ou o escopo mudarem, e aí mostro só a diferença |
| Execução | Cada mudança no banco ou no servidor: portas, papéis, funções, chaves, serviço novo, desligar a URA | Até ser usada, para aquela mudança. Só peço de novo se a versão, o estado conferido antes ou o escopo mudarem |

A autorização não vence por data (mudou na v3.1: a proposta de vencer em 7 dias saiu, porque o AGENTS.md manda não pedir de novo o que já foi concedido para a mesma ação). Um comando direto seu para criar empresa, conta ou entidade (DEC-022) já vale como autorização daquela criação. Cada frase vira um registro numerado, com o que muda, como desfazer e a versão. O registro guarda, mas não trava: na dúvida, eu pergunto.

**Agora**
- [ ] Ler o plano v3.1 e aprovar o roteiro das 10 pessoas (E1 a E5), ou dizer o que mudar. O roteiro pode mudar depois da pesquisa jurídica; se mudar de escopo, eu peço a frase de novo.
- [ ] Digitar no tópico: **aprovo o plano v3.1 e o roteiro das 10 pessoas, com o motor DBOS** (ou com o motor que você escolher no cartão) (mudou na v3.1). É uma frase de texto: não autoriza nenhuma mudança no banco nem no servidor.
- [ ] Hostinger, antes de 27/10/2026: abrir o painel e me dizer o que vence nesse dia e se a renovação automática está ligada. Eu não recomendo renovar nem deixar vencer antes de você conferir, e nada da Hostinger é apagado (mudou na v3.1).
- [ ] EasyPanel: mandar um print da origem de cada serviço (GitHub com publicação automática, ou envio de arquivo) antes de qualquer junção na main, porque juntar pode publicar (novo na v3.1).
- [ ] Aprovar o pedido de mudança que traz o plano e as fichas para a main, depois do print (novo na v3.1).
- [ ] Dar o OK no pedido de mudança do AGENTS.md com as "duas portas" de entrada das sessões, porque ele mexe numa regra sua (novo na v3.1).
- [ ] Dizer se ainda usa o app no Lovable (novo na v3.1).
- [ ] Dizer onde está o código do receive-leads e se o projeto Supabase antigo ainda existe (novo na v3.1).

**Decisões**

| Decisão | Como está | O que falta de você |
| --- | --- | --- |
| Motor | Decidido em 10/10/2026: DBOS. O estado do card fica nas nossas tabelas, e a tabela de passagens é neutra, então dá para trocar um dia sem mexer em card | Nada, se continuar com o DBOS |
| Chaves | Decidido em 10/10/2026: trocar no fim dos testes, no portão 2. Risco aceito e escrito | Nada agora. Se a checagem achar sinal de invasão, eu trago o cartão para trocar já |
| URA e voz da v1 | Decidido em 10/10/2026: desligar a central (URA de clientes e ligações de saída) | Na 0a: ler o inventário, avisar os clientes e digitar a frase de desligar. Se o inventário achar API paga em uso fora da central, um cartão: exceção escrita à DEC-014, com teto, ou desligar |
| Hostinger | Aberta | Conferir o painel; sem recomendação minha até lá |
| Lovable | Aberta | Dizer se ainda usa. Se não usa, desligar a ligação dele com o GitHub e revogá-lo no Supabase, sem apagar dados |
| Supabase grátis ou Pro | Aberta; o cartão vem na 0a, depois de medir (mudou na v3.1: antes só vinha se o teste 10 falhasse) | A) Grátis: R$ 0 e mais trabalho, com 500 MB, pausa depois de 7 dias sem uso e uso justo contado por organização. B) Pro: a partir de US$ 25 por mês, mais impostos, com o preço reconferido no dia. Sem resposta, fica o grátis |
| Conta separada no GitHub para as sessões (novo na v3.1) | Aberta e opcional | Dizer se quer. Ganho: as sessões deixam de administrar o repositório, e o registro separa você delas. Limite: no plano grátis, ela ainda consegue mexer em workflows e na main (alcance exato NÃO CONFIRMADO). A regra "nenhuma credencial de produção no GitHub" vale com ou sem ela |

**O cartão do motor, para registro (novo na v3.1).** Com o DBOS, escrevemos à mão os prazos, os contadores, o disjuntor, o vigia, a trava por execução, o caminho único de entrada na fila, a limpeza do que sobrar de versão antiga e a limpeza do histórico dele, e configuramos no máximo 3 retomadas por fluxo. Com um motor próprio no Postgres, escreveríamos também a fila, as reservas com prazo, a retomada depois de queda e o reenvio dos avisos, que no DBOS é um passo dele; é o tipo de código que travou a v1. Nas duas opções, a trava única passa pelo mesmo teste que bloqueia.

**Fase 0a (uma mensagem só, com uma frase por passo)**
- [ ] Rodar a checagem de invasão no console do EasyPanel, com o meu passo a passo.
- [ ] Frase para remover as portas 9119 e 8642 no EasyPanel.
- [ ] Ligar a verificação em duas etapas com dois caminhos: e-mail principal, GitHub, Supabase (segundo fator em outro aparelho), EasyPanel, Hostinger, ChatGPT e Telegram; imprimir os códigos e guardar em dois lugares (mudou na v3.1: dois caminhos e mais contas).
- [ ] Criar à mão o repositório privado helena-backup, sem nenhum app de IA, e revogar os tokens clássicos do GitHub que alcançam todos os repositórios (novo na v3.1).
- [ ] Frase e SQL no editor para criar o papel só de leitura do backup; gerar as chaves do backup pelo passo a passo, colar os 2 segredos no helena-backup e guardar a chave de abrir fora do computador (novo na v3.1).
- [ ] Disparar você mesmo a cópia completa e ver "contagens batem" (novo na v3.1).
- [ ] Frase e SQL no editor para cada passo: desligar o modo de teste e o cadastro, tirar o papel de fundador do acesso público e tirar do anônimo as funções abertas.
- [ ] Colar só os nomes das variáveis de cada serviço e confirmar que a variável do token de ligações (MEOWCALLER_TOKEN) existe (novo na v3.1).
- [ ] Informar o gasto do mês dos serviços pagos configurados (novo na v3.1).
- [ ] ChatGPT: confirmar saldo de créditos zero e recarga automática desligada (novo na v3.1).
- [ ] Central da v1: ler o inventário, avisar os clientes e digitar a frase de desligar a URA e as ligações; depois, a frase de travar o WhatsApp no seu número (mudou na v3.1: a trava do WhatsApp vem depois da URA).
- [ ] Revisar os apps e tokens do GitHub, deixando "Only select repositories" (novo na v3.1).
- [ ] Em Settings > Actions: ligar "exigir SHA completo", conferir "só leitura" e deixar desligada a criação de pedido de mudança pelos workflows (novo na v3.1).
- [ ] Responder o cartão Supabase grátis ou Pro.

**Fase 0b**
- [ ] Criar a conta do healthchecks.io e o robô do Telegram, e mandar /start ao HealthchecksBot.
- [ ] Frase e SQL no editor para a tabela de números e o papel do cartão de diagnóstico (novo na v3.1).
- [ ] Fixar a issue "Precisa de você" (novo na v3.1).
- [ ] Dar o OK para arquivar os ramos antigos, decidir o PR #5 e ligar "Automatically delete head branches" (novo na v3.1).
- [ ] Confirmar que o aviso de teste chegou ao seu celular pelos dois caminhos.

**Fim da fase 1** (novo na v3.1)
- [ ] Aprovar as fontes oficiais da pesquisa jurídica e a linha da LGPD (o que se guarda, por quanto tempo e como se apaga).
- [ ] Dizer sim ou não a dois tetos propostos na máquina: até 3 ordens suas que reabrem trabalho no mesmo card (na 4ª, o card é trocado por um novo, ligado, com as entregas e o seu pedido) e até 3 mudanças de prazo que rearmam os avisos.
- [ ] Decidir o prefixo de código dos personagens eLiving™ (Sirlene, Doutor Vital, Alex e Rafael).
- [ ] Só se a fase 1 mudou o escopo do plano ou do roteiro: ver a diferença e digitar a frase de novo, com a versão nova.
- [ ] Frase de execução da fase 2: criar o esquema da v2 e as tabelas novas no Supabase e o serviço novo do motor na VPS.

**Fase 2**
- [ ] Criar o token só de leitura de pacotes, colar no EasyPanel e ligar no GitHub as versões que não podem ser alteradas (releases imutáveis) (novo na v3.1).
- [ ] Guardar a credencial de migração só no EasyPanel, nunca no GitHub (novo na v3.1).
- [ ] Ensaiar no celular: colar a impressão digital, apertar Deploy e depois voltar, inclusive com uma versão quebrada de propósito (novo na v3.1).
- [ ] Ensaiar entrar nas contas com o celular principal desligado (novo na v3.1).
- [ ] Trocar as chaves peça por peça, com a frase de cada troca, colando cada uma direto no Supabase ou no EasyPanel; depois do período medido sem uso, a frase de revogar a antiga (mudou na v3.1: a troca vem aqui, pela sua escolha).
- [ ] Publicar quando eu pedir, no máximo uma vez por dia: "Preparar publicação" no app e, no EasyPanel, colar a impressão digital e apertar Deploy (mudou na v3.1: no lugar do botão no GitHub).

**Fase 3**
- [ ] Aprovar o plano da meta, com as fontes da Mimix e do Hub.
- [ ] Ser o segundo leitor no jurídico ("leia antes de agir").
- [ ] Enviar você mesmo o convite; nenhum agente envia.
- [ ] Marcar com um toque o tipo do erro quando pedir ajuste.
- [ ] Aprovar as lições em lote, uma vez por semana, e tocar para promover cada serviço.

**Fase 4**
- [ ] Confirmar a ordem em que os demais agentes sobem, um por vez, e tocar em cada promoção (novo na v3.1).
- [ ] Registrar comigo a voz e as proibições da iGreen e da Saúde antes do primeiro serviço delas (novo na v3.1).
- [ ] Confirmar as 50 mensagens do conjunto-ouro (de 10 a 20 minutos).
- [ ] Escolher o serviço de busca, com o custo, se quiser o Ravi.
- [ ] Digitar a frase da troca do WhatsApp.
- [ ] Usar o código do autenticador ao aprovar uma ação de fora.

**Opcional, só se você quiser gastar**
- GitHub Pro: não é preciso agora; o preço é NÃO CONFIRMADO.
- Supabase Pro: pelo cartão da 0a.
- Vercel: fora até a fase 3; o preço é NÃO CONFIRMADO.

Nenhuma chave passa pelo chat: você cola cada uma direto no Supabase ou no EasyPanel. Até a troca de canal, cada pedido vai para um sistema só: a v1 continua com o dia a dia, e a v2 recebe só os testes e a meta das 10 pessoas, que sai da v1. Eu escrevo o código, as fichas e os testes; o que depender de clique seu, peço numa mensagem só por fase, e tudo fica também na issue "Precisa de você", com prazo e o que acontece se você não fizer (novo na v3.1).

