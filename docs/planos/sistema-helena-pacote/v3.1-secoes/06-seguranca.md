## Segurança: fase 0a, estancar

(mudou na v3.1: a fase 0 virou duas partes. A 0a, "estancar", fecha o que está exposto hoje. A 0b, "vigiar", monta o backup de toda noite, o vigia do vigia, os avisos no Telegram e o cartão de diagnóstico. O botão de publicar saiu da fase 0 e foi para o começo da fase 2, porque a publicação só pode ser provada com motor e card de ensaio.)

A fase 0a vem antes de qualquer peça nova e vale para a v1 também, porque as duas dividem o servidor, o banco e a conta do ChatGPT. Ela começa conferindo se alguém já entrou e faz uma cópia completa do banco antes de qualquer mudança nele. Nenhuma peça nova vai ao ar antes do portão 0a. Depois dele, a 0b corre junto com a fase 1, que é só de arquivos, e precisa fechar antes da fase 2. A 0a termina quando o portão passa, nunca numa data marcada (mudou na v3.1: saiu a promessa de "fecha em dias").

### Como cada passo anda (novo na v3.1)

- **Quem executa o SQL.** As minhas sessões não alcançam o banco: na nuvem, a rede delas é recusada (erro 403) ao chamar o Supabase, e no seu PC o Windows bloqueia o programa do Supabase. Além disso, nenhuma credencial que mude o banco pode ficar no repositório principal; as únicas do banco que ficam lá são as de leitura, numa lista fechada, descritas em "Manutenção" (mudou na v3.1: antes dizia "nenhuma senha do banco", o que os testes semanais de leitura não conseguiriam cumprir). Por isso, cada comando da 0a no banco é executado por você, no editor SQL do Supabase (a tela do painel onde se cola e roda um comando). Eu mando cada passo pronto em quatro blocos separados e numerados. Você roda um de cada vez e olha o resultado antes de passar ao seguinte, porque o botão de rodar executa tudo o que estiver colado:
  1. a conferência de antes, que começa com `begin transaction read only` (assim o banco recusa qualquer escrita);
  2. a mudança, numa transação que primeiro confere o estado esperado e para com erro se ele não bater;
  3. a conferência de depois;
  4. o script de volta, que desfaz a mudança. Ele nunca vai no mesmo bloco da mudança: fica pronto e testado de antemão, e você só o cola se o checklist piorar.

  O resultado que você cola de volta deve trazer só nomes, contagens e "sim" ou "não", e eu confiro isso antes de seguir. Ele não deve trazer dados de pessoas nem chaves. (mudou na v3.1: eram quatro partes num bloco só.)
- **Checklist da v1 antes e depois de cada passo.** Antes de cada passo que mexe na v1, e logo depois, rodamos o mesmo checklist:
  - o seu login no app;
  - o WhatsApp respondendo ao seu número;
  - a saúde do gateway;
  - uma tarefa do Hermes;
  - o formulário de leads;
  - as tarefas agendadas;
  - o caminho que cria empresa pela DEC-022, conferido pelo catálogo do banco (a lista interna em que o banco guarda quem pode o quê), sem criar empresa de mentira;
  - a central de clientes (URA). Enquanto ela existe, o checklist confere que continua funcionando. Depois de desligada, confere que continua desligada;
  - a ligação de entrada no número da central, se o inventário achar ligações de entrada. Enquanto ela existir, o checklist confere que atende.

  (mudou na v3.1: o checklist ganhou a DEC-022, a URA e a ligação de entrada.)

  **Como o checklist confere sem sujar a produção (novo na v3.1).** Cada rodada não pode criar lead falso nem gastar a cota à toa. Por isso, sempre que dá, o item é conferido só lendo: o formulário de leads pela data do último lead recebido e pela saúde do endereço, sem enviar lead; as tarefas agendadas pela data da última execução de cada uma; o WhatsApp e a tarefa do Hermes por um registro de teste marcado como "teste" e apagado depois, ou pela leitura da última resposta e da última tarefa reais. O checklist anota quantas execuções gastou, e o passo só anda se a cota deixar.
- **Igual ou melhor que antes do passo.** A v1 travou, então o ponto de partida pode já estar vermelho em algum item. Por isso, o critério de cada passo não é "tudo verde", e sim "igual ou melhor que antes do passo". Se algum item piorar, você roda o script de volta, e eu trago a causa antes de tentar de novo. (novo na v3.1)
- **Uma frase por passo, e ela não vence.** A sua frase tem dois níveis. A que aprova o texto do plano não autoriza mudança no banco ou no servidor. Cada passo da 0a que muda alguma coisa tem a frase dele, e eu peço todas numa mensagem só. A frase vale até ser usada e não vence por data. Como os passos andam em sequência e cada um muda o que o próximo vai conferir, o pedido traz, para cada passo, o "estado esperado antes", já contando os passos anteriores. A frase vale se a conferência de antes bater com esse estado escrito. Se não bater, ou se mudarem o script ou o alcance do passo, eu peço de novo, como manda o AGENTS.md. (mudou na v3.1: separamos os dois níveis da frase, a autorização deixou de vencer em 7 dias, e a regra de quando pedir de novo ganhou um critério que se confere.)
- **Publicar o gateway da v1 na 0a precisa de caminho de volta (novo na v3.1).** Vários passos mudam o gateway: a senha do aviso do WhatsApp, o número único, a retirada da senha de reserva do `voice-agent.mjs` e o login nas rotas abertas (ver "O gateway da v1"). Só que o caminho de publicar por impressão digital nasce na fase 2, o servidor não bate com o repositório (scripts copiados à mão e o zip `helena-gateway-decisoes.zip` pronto, mas não publicado) e o script de volta em SQL não serve para o gateway. Por isso, antes da primeira publicação do gateway na 0a:
  1. você baixa e guarda uma cópia da versão que está no ar (o zip ou os arquivos do contêiner). Essa cópia é o caminho de volta;
  2. eu comparo, só lendo, a versão no ar com o repositório;
  3. o zip da 0a parte da versão no ar e leva só a mudança mínima, nunca o que estava só no repositório;
  4. a volta é subir de novo o zip guardado.

  Sem a cópia guardada, nenhum passo que publica o gateway começa.

### Primeiro, ver se alguém entrou

As portas 9119 e 8642 da v1 ficaram abertas para a internet. A documentação do próprio Hermes diz que painéis abertos foram a porta de entrada de uma campanha de invasão em junho de 2026, que deixava uma chave de acesso escondida no servidor. Por isso, a 0a começa fechando as duas portas (primeiro bullet abaixo) e segue com uma checagem só de leitura, dentro do contêiner da v1 e no servidor. Ela olha as chaves de acesso, os servidores de ferramentas e as tarefas agendadas de cada perfil, os arquivos mudados depois da última publicação, as portas abertas e os acessos recentes.

- **Primeiro passo: as duas portas fecham, logo depois de uma foto rápida.** Fechar uma porta não toca no banco e, pelo que sabemos, não apaga as provas que a checagem lê. Mesmo assim, mexer num serviço do EasyPanel pode reiniciá-lo e apagar o que está só na memória ou fora dos volumes (NÃO CONFIRMADO). Por isso o roteiro vem em duas partes. A parte 1 é curta, de minutos, e só guarda uma foto: processos, conexões abertas e acessos recentes. Logo depois dela, você remove as duas portas no EasyPanel, com a frase desse passo e com volta (pôr de novo). A parte 2, a checagem completa, vem em seguida, sem esperar a cópia do banco. (mudou na v3.1: antes as portas só fechavam depois da checagem inteira, e elas podiam ficar abertas por dias enquanto o roteiro era preparado e rodado.)
- **Quem roda.** Você, com o roteiro que eu mando. O console do EasyPanel abre dentro de um serviço (contêiner), não no servidor, e a campanha de junho deixava também chave SSH escondida no servidor (pesquisa B-1). Por isso a checagem tem duas metades: uma no console do EasyPanel e outra no servidor, por SSH ou pelo console do provedor da VPS (qual dos dois existe para você: NÃO CONFIRMADO). A metade do servidor confere chaves autorizadas (root, o usuário do Hermes e as pastas montadas), usuários, tarefas agendadas do servidor, serviços, montagens do `docker.sock` e usuários e tokens do próprio EasyPanel. O roteiro imprime nomes, caminhos, datas, impressões digitais de arquivos e de cada chave de acesso autorizada, os comandos das tarefas agendadas e dos servidores de ferramentas (com o que parece segredo mascarado por regra, que eu testo antes com segredos de mentira) e um resumo das origens dos acessos. Nunca imprime o conteúdo de arquivos de chave. Assim, o resultado pode voltar ao chat sem levar nenhuma chave. (novo na v3.1; mudou na v3.1: só com nomes e datas a checagem não via uma tarefa agendada de nome inocente que baixa e roda um script, e a metade do servidor tinha sumido do texto.)
- **A varredura de fora.** Eu preparo a varredura de todas as portas e domínios do servidor e de qualquer outro servidor ou domínio que o inventário achar (como a Hostinger, se estiver ligada). Para uma possível cópia do app no Lovable, só uma visita comum à página (se existe e para qual banco aponta), nunca varredura de portas, porque a infraestrutura é de terceiros. A varredura roda numa máquina do GitHub, porque a rede das minhas sessões passa por um intermediário que pode bloquear varreduras (NÃO CONFIRMADO). Depois, o GitHub repete a varredura toda semana, dentro da tabela única de minutos. (mudou na v3.1: antes eu varria direto da sessão.)
- **Os domínios do EasyPanel entram na varredura (novo na v3.1).** Cada serviço pode ter um domínio na porta 443 (como `helena-automation-<serviço>…easypanel.host`), e a porta 443 é uma das previstas. Se o Hermes tiver um domínio apontando para o painel (9119) ou para a API (8642), tirar as portas não fecha nada (existência NÃO CONFIRMADA). Os nomes sob o certificado coringa não podem ser descobertos de fora: só a lista do EasyPanel mostra. Por isso você cola a lista de domínios de todos os serviços (só os nomes). A varredura pede cada domínio e falha se algum responder o painel do Hermes, a API dele, a tela da Evolution ou o próprio EasyPanel sem login. Ela diz também se o painel do EasyPanel responde para a internet.
- **Se aparecer sinal de invasão.** Eu paro a 0a e mando um cartão urgente. A recomendação é conter primeiro, mesmo que isso derrube a v1: refazer a v1 de uma imagem limpa e também o volume `/data` (onde ficam os perfis, as tarefas agendadas e os servidores de ferramentas), copiando para o novo só o que foi aberto e conferido; fazer o login novo do ChatGPT depois de sair de todos os dispositivos; e trocar todas as chaves na hora, antes de qualquer peça nova. Se o sinal estiver no servidor, e não só no contêiner, o cartão traz também a opção "refazer a VPS do zero", porque a v2 vai ser publicada nesse mesmo servidor. A sua decisão de 10/10, de trocar as chaves só no fim dos testes, foi tomada sem sinal de invasão. Com sinal, a recomendação muda, e a escolha continua sua. (mudou na v3.1)
- **O que a checagem não prova (novo na v3.1).** A checagem acha o que foi plantado; não prova que nada foi lido. Segundo a pesquisa B-1, o painel do Hermes aberto na 9119 permitia ler variáveis de ambiente e arquivos, gravar configuração e abrir um terminal. Ler não deixa rastro nesses lugares, e "login novo do ChatGPT" sozinho não derruba o login antigo: o acesso roubado vale até ser revogado na conta. Por isso, com ou sem sinal de invasão, o que morava no contêiner do Hermes enquanto as portas estavam abertas é tratado como possivelmente exposto. Nada disso é chave do banco, então nada disso entra na decisão de 10/10. Eu recomendo, na 0a e com a frase de cada passo (a escolha é sua):
  1. no ChatGPT, sair de todos os dispositivos e revogar os apps conectados, e só então fazer o login novo da v1 (a v2 nasce depois, com login próprio). O custo: isso desloga também as suas outras ferramentas que usam a mesma conta, como o Codex;
  2. revogar e recriar os tokens dos perfis do Hermes (`hhs_`);
  3. listar só os nomes do que estava no ambiente do Hermes e pôr cada item no cartão de troca.

  Como isso mexe na v1, entra no checklist "igual ou melhor". No portão, a checagem de invasão é descrita como "nenhum sinal encontrado nos itens que o roteiro lista", nunca como "limpa".

### A cópia do banco antes de tudo (novo na v3.1)

Não achamos nenhuma cópia completa do banco, e o seu plano do Supabase é provavelmente o grátis (NÃO CONFIRMADO), que não inclui backup. A v3 só copiava as tabelas que cada mudança tocava, sem acessos, papéis e tarefas agendadas. Na v3.1, uma cópia completa e criptografada vem antes de qualquer mudança no banco ou nas chaves.

1. **Você cria à mão o repositório `helena-backup`**, privado, e tira dele os apps de IA, revogando antes os apps OAuth e os tokens clássicos com acesso "repo", que alcançam todos os repositórios privados. Assim, as minhas sessões na nuvem não o alcançam, desde que os apps continuem restritos, o que a lista de apps confere. Ele nasce já na 0a por causa desta primeira cópia; o backup de toda noite fica para a 0b.
   - **Limite escrito (novo na v3.1).** "Only select repositories" vale só para apps do GitHub. Ferramentas no seu PC (Codex, Cursor, Antigravity) que usam o seu login do git ou o token do `gh` alcançam todos os seus repositórios, inclusive este, e no GitHub grátis qualquer rotina enviada a um repositório lê os segredos dele (MEL-16). Por isso os logins do git do PC e os tokens do `gh` entram na lista de quem escreve. Eu recomendo, num cartão, trocar esses logins por tokens finos, por repositório, com acesso só ao repositório principal, ou aceitar o risco por escrito.
   - **A rotina de cópia** é preparada por mim como texto e colada por você, pelo site do GitHub, antes de pôr os segredos. O teste 11 ganha o caso "cada acesso de IA tenta ler o `helena-backup` e recebe recusa" (ver "Manutenção"), e um teste semanal do próprio `helena-backup` acusa qualquer envio que não seja seu. Até esses testes passarem, é NÃO CONFIRMADO que a restrição dos apps basta.
2. **Você roda no editor SQL o script** que cria um papel (um tipo de acesso ao banco) só de leitura para o backup. Esse passo tem frase, e a volta é apagar o papel.
3. **Você cola 2 segredos no `helena-backup`:** o acesso desse papel e a chave que abre a cópia, que só o teste de restauração usa. Uma cópia dessa chave fica com você, fora do computador. A senha do papel nasce no editor SQL, gerada pelo próprio banco, e aparece só para você copiar direto para o `helena-backup`; nenhum bloco SQL meu leva senha escrita. O par de chaves da criptografia nasce na rotina do `helena-backup` ou no seu PC, nunca numa sessão. O resultado que volta ao chat traz só "papel criado: sim". (O terceiro segredo do `helena-backup`, a chave de leitura do espelho do código, vem na 0b; ver "Manutenção".)
4. **Você aperta o botão que faz a cópia.** Ela leva a estrutura, os dados, os papéis e as tarefas agendadas, e nunca as senhas, o cofre de segredos ou as sessões. Uma tarefa agendada da v1 pode ter chave escrita no texto do comando, e então a cópia leva essa chave (NÃO CONFIRMADO); o inventário marca essas tarefas e põe as chaves na lista de chaves. A cópia sai criptografada e fica guardada numa versão do `helena-backup`.
5. **O mesmo botão restaura a cópia** num banco descartável, montado na máquina do GitHub, e confere a contagem de linhas de cada tabela contra a contagem de referência (abaixo). A restauração acontece com as tarefas agendadas desativadas e sem saída de rede para o pg_net (a parte do banco que faz chamadas pela internet), para que o banco descartável não dispare nada contra a produção.

**A contagem de referência vem de fora do papel da cópia (novo na v3.1).** Se a proteção por linha (regra do banco que decide quais linhas cada pessoa vê) esconde linhas do papel de leitura, a cópia e a contagem saem incompletas do mesmo jeito, e a restauração "bateria" sem estar completa. O mesmo vale para as tarefas agendadas: pelo que sei, a tabela `cron.job` só mostra a cada papel as tarefas dele, e as da v1 são do papel `postgres` (NÃO CONFIRMADO neste projeto). Por isso, você roda no editor SQL, como dono, um script só de leitura que devolve só "tabela: número" para todas as tabelas, inclusive `cron.job`, `auth.users` e `storage.objects`. O que a cópia deixa de fora de propósito (cofre, sessões) entra na lista como "fora, de propósito". A cópia só vale se cada número restaurado bater com esse. Se não bater, nenhuma mudança no banco acontece, e eu trago as opções num cartão: um papel que ignora a proteção por linha (se o Supabase permitir: NÃO CONFIRMADO) ou a cópia feita por você mesmo. Os minutos dessa cópia saem da cota da sua conta do GitHub, mesmo num repositório separado, e entram na tabela única de minutos.

### Hoje e na fase 0a

| Hoje | Na fase 0a | Quem faz |
| --- | --- | --- |
| Portas 9119 e 8642 abertas, e as outras nunca conferidas | Fechadas no primeiro passo, logo depois de uma foto rápida; a checagem completa vem em seguida, no contêiner e no servidor (mudou na v3.1). A varredura de fora cobre todas as portas e todos os domínios da lista do EasyPanel e se repete toda semana | Você, no EasyPanel e no servidor. A varredura, eu |
| Talvez algum serviço do EasyPanel publique sozinho a partir do GitHub (NÃO CONFIRMADO) (novo na v3.1) | Você confere a origem de cada serviço, e a publicação automática fica desligada em todos | Você confere e diz a frase |
| O modo de teste do app abre sem login para qualquer pessoa na sua rede | Apagado do código, e não só desligado. O servidor de teste só abre no próprio computador (mudou na v3.1) | Eu escrevo. Publicar segue o seu toque |
| O usuário helenasistema.publico ainda tem papel de fundador, e o login dele continua valendo (a senha pode estar no arquivo de ambiente do modo de teste, que pode existir no seu PC e nas ferramentas: NÃO CONFIRMADO) | Papel removido, e a conta bloqueada ou apagada no Supabase Auth, porque tirar só o papel não impede de entrar nas rotas do gateway que aceitam qualquer login. As outras contas do Auth são conferidas na lista antes, e só bloqueadas se não forem de alguém que você reconhece (NÃO CONFIRMADO se há contas legítimas além da sua). Só você é fundador (mudou na v3.1) | Você, no editor SQL e no painel |
| Quem tem a chave pública do app consegue chamar as funções do banco e criar uma conta | O banco tira o acesso público das funções, e cada uma aceita só o motor ou você. A v3 contava 38 funções, as migrations citam 43 nomes, e o número real sai do inventário. O cadastro de contas novas fica desligado | Você, no editor SQL e no painel |
| Toda tabela nova recebe leitura e gravação pela chave pública, e 37 das 61 tabelas nasceram fora das migrations (novo na v3.1) | As tabelas da v2 nascem num esquema próprio (uma "pasta" de tabelas), fora da API. As da v1 só fecham depois do inventário, com script de volta | Você, no editor SQL |
| O app pode gravar direto nas tabelas | Na v2, o app só grava pelas funções do trilho, e o banco recusa o resto. Na v1, a gravação pela chave pública fecha tabela por tabela, depois do inventário | Você, no editor SQL |
| O WhatsApp aceita qualquer número, e o endereço que recebe as mensagens não pedia senha | Mensagem de número que não é o seu deixa de criar tarefa já na 0a, sem esperar o aviso (opção recomendada; a escolha é sua); depois do aviso aos clientes, só o seu número. O endereço aceita só quem manda a senha combinada (o código novo já pede; se a versão no ar pede: NÃO CONFIRMADO), e a senha vai só no cabeçalho, nunca no endereço, se a Evolution aceitar cabeçalho (NÃO CONFIRMADO: o código atual manda nos dois, por compatibilidade). A mesma mensagem vira um card só, e o eco das respostas é ignorado | Eu escrevo. Você publica e diz a frase |
| A central da v1 responde clientes e faz ligações de saída por IA (novo na v3.1) | Inventário só de leitura, separando a URA, a ligação de saída da central e a voz do produto Max/eLiving™. A ligação de saída fecha primeiro, e a URA é desligada depois do aviso aos clientes | Inventário, eu. Desligar, você, com a frase |
| Várias rotas do gateway da v1 não pedem login, ou aceitam qualquer login (novo na v3.1) | Inventário de todas as rotas, e uma publicação do gateway que exige você nas rotas que ligam, enviam, mudam configuração, mostram conversas ou gastam API paga (ver "O gateway da v1") | Inventário, eu. Publicar, você, com a frase |
| Chaves de acesso total circulando, inclusive no chat, e escritas em 9 arquivos do repositório | Uma lista de todas as chaves, sem os valores. Os arquivos passam a ler variável, e a varredura de segredos roda antes de cada envio (receita na 0a; a cada envio, pelo GitHub, a partir da 0b). A troca das chaves do banco acontece no fim dos testes, por decisão sua (mudou na v3.1) | Eu escrevo. Você confere os nomes no EasyPanel |
| Senhas do canal (Evolution, aviso do WhatsApp, gateway, Meowcaller, Kokoro) e chaves pagas que apareceram no chat em 07/10 também estão no histórico e nas cópias (novo na v3.1) | Cartão separado do das chaves do banco, com a recomendação de trocar já na 0a (ver "Chaves escritas no repositório") | Você decide e troca. Eu monto o cartão |
| Um token de gestão do Supabase pode estar escrito em outro repositório seu (novo na v3.1) | Revogar todos os tokens de gestão da conta, conferir membros e apps autorizados, e varrer todos os repositórios da conta (ver "Tokens de gestão do Supabase") | Você, nas telas. Eu monto a lista |
| Não se sabe quem escreve no repositório (novo na v3.1) | Inventário de apps e tokens, o Lovable decidido, e cada app só vê os repositórios escolhidos | Você, nas telas. Eu monto a lista |
| O app traz endereços de produção escritos no código (novo na v3.1) | O app falha fechado: sem as variáveis, não monta nem chama nada | Eu |
| A v1 usa APIs pagas sem exceção escrita à DEC-014 (novo na v3.1) | Inventário e um cartão de decisão por serviço | Você informa nomes e gastos e decide |
| Contas importantes protegidas só por senha | Verificação em duas etapas com dois caminhos de volta, inclusive no e-mail, no ChatGPT e no Telegram (mudou na v3.1) | Você |

### Chaves escritas no repositório (mudou na v3.1)

Na main, 11 arquivos rastreados têm uma chave do banco escrita no código: 9 com a chave de acesso total (service_role) e 2 com a chave pública (anon), todas do projeto oficial. São 10 scripts da pasta `scripts`, quase todos de uso único e da eLiving™, mais o servidor de desenvolvimento do gateway. Os mesmos arquivos estão nos ramos `missao-cumprida-v4` e `antigravity-planos`. A chave de acesso total também aparece no servidor de desenvolvimento na ponta de 31 dos 33 ramos.

Há ainda outras senhas escritas no código, fora desse formato, em cerca de 13 arquivos: a senha do gateway, a do serviço de ligações (Meowcaller) e a da Evolution (o WhatsApp), entre outras. Ao todo, cerca de 23 arquivos da main têm alguma senha escrita, contando os 11 acima (um arquivo pode entrar nas duas contagens, e o número exato sai do inventário). Parte deles são testes com valores possivelmente falsos (NÃO CONFIRMADO). Uma delas vai para produção: o `voice-agent.mjs` usa a senha do Meowcaller escrita no código quando a variável falta. Também entram na lista as chaves que apareceram no chat e num registro de montagem (a lista de 07/10).

Apagar o arquivo não tira a chave do histórico do git. Reescrever o histórico também não resolve, porque existem cópias do repositório no Codex, no Cursor, no Antigravity e no seu PC. O conserto de verdade é trocar a chave.

**A sua decisão de 10/10 é trocar as chaves do banco no fim dos testes.** Esse era o combinado antigo, já adiado pela DEC-019. A v3 recomendava trocar já na fase 0. A v3.1 segue a sua decisão e escreve o risco por extenso. Parte do motivo da v3 para trocar cedo perde força: na v3.1, os testes que podem estragar dados rodam num Supabase descartável, e não no banco de verdade.

- **Risco aceito.** Até a troca, a chave de acesso total continua valendo. Quem lê o repositório, ou qualquer cópia dele, consegue ler e mudar o banco inteiro. Por isso, até a troca, saber quem lê o repositório (seção abaixo) pesa tanto quanto fechar as portas. No registro, os furos B-3, K-6 e M-10 passam de "troca na fase 0" para "risco aceito por decisão sua, com troca no portão final dos testes".
- **O que passa a valer já na 0a:**
  - o repositório continua privado;
  - os 11 arquivos passam a ler a chave de uma variável de ambiente e param na hora se ela faltar, sem trocar o valor. Os scripts de uso único saem do repositório;
  - a senha de reserva do `voice-agent.mjs` só sai depois que você confirmar que a variável existe no EasyPanel, porque mexer nesse arquivo é publicar o gateway da v1, com a sua frase. Se a central for desligada antes, esse passo vira só limpeza;
  - nenhum arquivo novo pode ter chave. Na 0a, a varredura de segredos é só a receita de rodar o gitleaks antes de enviar (o job a cada envio liga na 0b), e o portão 0a exige uma varredura completa, rodada uma vez no GitHub (ver "O gitleaks");
  - a lista de chaves diz o nome de cada uma, onde vive, quem usa e como trocar, nunca o valor. Ela ganha a seção "plataformas conectadas". A lista inclui também o que tem segredo sem ser chave, como o arquivo de backup do Hermes da v1, que contém tokens e nunca vai ao chat nem ao GitHub, e o projeto Supabase da Max, com `MAX_VOICE_CONTEXT_TOKEN` e `MAX_SUPABASE_ANON_KEY` (ver "A central da v1"). O que é automático e o que é manual:
    - **v2:** o motor informa os nomes das variáveis do próprio ambiente no sinal de vida e se recusa a ligar com chave de API paga;
    - **v1:** nenhum teste do GitHub enxerga o EasyPanel, porque a regra proíbe esse acesso lá. A conferência dos nomes das variáveis é um item mensal seu (você cola só os nomes), com a data mostrada no cartão de diagnóstico e o aviso "vencido" depois de 35 dias. (mudou na v3.1: antes dizia que um teste semanal conferia a lista contra o que está configurado, o que nenhum teste do GitHub consegue fazer.)
- **As senhas do canal e as chaves pagas não são chaves do banco** (novo na v3.1; mudou na v3.1: antes dizia que seguiriam a mesma data da troca das chaves do banco). A decisão de 10/10 fala só das chaves do banco, e este plano não a estende a elas. São a chave geral da Evolution, a senha do aviso do WhatsApp, a senha fixa do gateway (`MCP_BEARER_TOKEN`), a senha do Meowcaller e a do Kokoro, mais as chaves pagas que apareceram no chat em 07/10 (OpenAI, Google, R2, ElevenLabs e TypeSafe, segundo o CHECKPOINT-MESTRE-20261007). As do código estão no histórico do repositório e nas cópias dele, e as de 07/10 apareceram no chat. Todas mexem com contato com gente de fora ou com gasto:
  - a chave geral da Evolution dá controle total do WhatsApp: mandar mensagem como a empresa, ler a configuração do aviso (que traz a senha dele, no endereço e no cabeçalho), mudar o aviso e parear o número de novo. Com a senha do aviso, quem forja uma mensagem escolhe o número de origem no conteúdo, e então "só o seu número, com a senha" não protege;
  - a senha fixa do gateway vira "service-admin" em todas as ferramentas do gateway;
  - o token do Meowcaller permite ligar direto pelo serviço público dele, sem passar pelo gateway;
  - as chaves pagas são risco direto de gasto.

  **Recomendação: trocar já na 0a**, na ordem do inventário de uso (Evolution, senha do gateway, Meowcaller ou parar esse serviço, e depois as chaves pagas, com limite de gasto). Cada uma é uma variável em um ou dois serviços, e tem volta: se algo da v1 parar, o valor antigo é posto de novo. A escolha continua sua. Se você preferir esperar, cada uma entra na "Exceção conhecida" (seção "No GitHub, a sessão é você") e no teste 11 como "risco aceito por decisão sua", nunca como verde, e o item do WhatsApp aparece assim no portão 0a enquanto a senha da Evolution não for trocada. A do Meowcaller perde o uso quando a central for desligada.
- **No portão final dos testes, a troca é feita peça por peça.** Cada peça ganha uma chave própria, porque o Supabase tem chaves secretas novas que podem ser uma por peça. O app é remontado com a chave pública nova. Depois, o par antigo é desligado, e isso tem volta: se algo da v1 parar, a chave antiga pode ser religada na hora enquanto eu corrijo. O segredo antigo só é revogado (o que não tem volta) depois de um período medido sem nenhum uso da chave antiga. Antes de desligar, leio os registros de uso por alguns dias, para achar quem ficou fora do inventário, como um formulário de leads que use a chave pública. A data de revisão desse risco fica escrita no cartão, com o dia que você escolher. (mudou na v3.1: a v3 só desligava a chave antiga. Revogar é o que faz ela parar de valer de vez, e só acontece depois da medição.)

### Tokens de gestão do Supabase (novo na v3.1)

Um token de gestão não é uma chave do banco, e trocá-lo não derruba a v1, então ele fica fora da decisão de 10/10. O token pessoal da conta (`SUPABASE_ACCESS_TOKEN`) vale para a gestão de todos os projetos que a conta alcança: rodar SQL como dono do banco, ler as chaves, religar o cadastro e publicar Edge Functions. O checkpoint mestre de 01/10 (riscos, item 7) registra que o repositório `tvmensal2025/ids-max` tem escritos, em arquivos de configuração de ferramentas (`.cursor/mcp.json` e `.agent/mcp_config.json`), um desses tokens e uma chave de acesso total de um projeto de produção da Max (identificador `imvfmjgmacrulhztrqlh`, diferente do oficial). O pedido que tirava esses arquivos ficou em rascunho, e a troca (TSK-0012) ficou pendente. Se a mesma conta é dona do `ecosistemadossonhos`: NÃO CONFIRMADO. Se for, um token assim passa por cima de "SQL só por você no editor", do esquema fechado `helena_v2` e da trava de publicar no EasyPanel. Ferramentas no seu PC com o Supabase ligado (o AGENTS.md manda o Codex consultar o Supabase, e o programa do Supabase guarda um token de login) têm o mesmo poder. Na 0a:
- em Supabase > Account > Access Tokens, revogar todos e não criar nenhum para IA. Isso pode desligar ferramentas que hoje consultam o Supabase (como o Codex); a volta é criar um token novo, se você decidir;
- conferir os membros da organização e os apps OAuth autorizados (o Lovable, por exemplo);
- rodar o gitleaks em todos os repositórios da conta, inclusive o `ids-max`, e listar os achados só por nome;
- a lista de plataformas conectadas ganha "quem tem acesso de gestão ao Supabase".

### O gitleaks substitui a varredura do GitHub (novo na v3.1)

O GitHub não oferece varredura de segredos em repositório privado de conta pessoal. Quem faz esse papel é o gitleaks, um programa grátis e aberto que procura chaves no código. Usamos o programa direto, sem a ação do GitHub que pede licença a organizações.
- **Regras próprias.** As regras padrão deixaram passar 6 de 28 linhas com segredo conhecidas e não reconhecem as chaves novas do Supabase nem as senhas próprias da Helena. Com regras próprias, o teste pegou 28 de 28.
- **Exceções só pela impressão digital do achado, nunca pelo valor.** O relatório comum do gitleaks guarda a chave inteira, e gravá-lo no repositório espalharia a chave de novo.
- **Tudo, a cada envio.** No teste, a varredura de todos os ramos e de todo o histórico levou cerca de 4 segundos, então ela roda inteira a cada envio. Ela fica num job só, junto com as outras checagens leves. O programa tem versão fixa e conferência do arquivo baixado, e as ações do GitHub ficam fixadas pela impressão digital da versão (SHA).
- **Ordem de ligar.** Entre as rotinas do GitHub, ela vem em terceiro, depois do backup e do diagnóstico. Os minutos dela entram na tabela única. Até o job do GitHub ser ligado na 0b, cada sessão roda o gitleaks antes de enviar, como passo da receita. Na 0a isso é só receita, e ela tem limite: a sessão da nuvem pode não conseguir cumprir se a rede dela recusar o download do programa (NÃO CONFIRMADO), e o Codex, o Cursor e o Antigravity não a seguem. Por isso o portão 0a exige uma varredura completa, rodada uma vez no GitHub (ou, se o job ainda não existir, no seu PC), e não aceita "a receita foi seguida".
- **O que ele não faz.** O gitleaks roda depois do envio. Ele detecta uma chave nova cerca de 1 minuto depois de ela chegar ao GitHub, mas não impede que ela chegue. O gancho que rodaria antes do envio não se instala sozinho nas sessões da nuvem. E, como a sessão entra no GitHub como você, ela consegue mudar a própria rotina do gitleaks. Ele protege contra erro, não contra uma sessão desviada.

### A superfície inteira do Supabase (novo na v3.1)

A v3 fechava só as funções e a gravação direta nas tabelas. Ficavam de fora:
- o padrão do Supabase, que dá à chave pública leitura e gravação em toda tabela nova e execução em toda função nova, até alguém tirar;
- uma migration da v1 que repete esse padrão aberto, se foi aplicada (NÃO CONFIRMADO);
- a v1 deu e tirou acessos da chave pública várias vezes em 2 dias;
- 37 das 61 tabelas foram criadas fora das migrations, sem registro de acesso;
- a função receive-leads, uma Edge Function (função que roda no próprio Supabase, fora do banco), está marcada para aceitar chamada sem login, e o código dela não está no repositório (se ela existe no ar: NÃO CONFIRMADO);
- as pastas de arquivos do Supabase (buckets) criadas fora das migrations, que ninguém conferiu.

O que muda:
- **A v2 nasce fechada.** As tabelas da v2 ficam num esquema próprio, `helena_v2`, fora da API. Nele não há acesso para a chave pública, para usuário logado nem para "todos". Só o papel do motor (o tipo de acesso que só o motor usa) recebe acesso, dado por extenso. As poucas funções que o app chama ganham o prefixo `v2_`, cada acesso é dado e tirado por extenso, e todas chamam a mesma conferência compartilhada de quem chama (você ou o motor). Assim, ninguém escreve uma guarda à mão em cada função.
- **Teste de catálogo.** Uma consulta só de leitura ao catálogo do banco falha se:
  - alguma parte da v2 estiver aberta para fora;
  - uma tabela exposta estiver sem a proteção por linha;
  - um acesso padrão novo for dado à chave pública;
  - uma função aceitar a chave pública fora da lista;
  - aparecer uma pasta de arquivos pública fora da lista.

  Na v1, o teste compara com a fotografia do inventário e só acusa o que for novo ou diferente, para não ficar vermelho para sempre. Ele roda a cada mudança no banco, num Supabase local montado no GitHub, e toda semana na produção, antes e depois de 30/10/2026. **Na produção, o acesso do teste semanal é este (novo na v3.1):** um papel criado por você, uma vez, que só lê o catálogo e uma visão de números, sem SELECT em nenhuma tabela de dados. É o mesmo papel do cartão de diagnóstico (ver "Manutenção") ou um segundo igual. A senha dele é um segredo do GitHub, e isso é uma exceção escrita à regra "nenhuma credencial que mude o banco", porque esse papel não muda nada; ela tem a sua frase. Nunca o papel do backup, que lê todos os dados e vive só no `helena-backup`.
- **Funções fora do banco, sem token no GitHub.** Nas Edge Functions, a opção "exige JWT" não exige login: a chave pública antiga (anon) é um JWT válido e passa por essa conferência, e qualquer pessoa que copie a chave pública do pacote do app chama a função. Por isso "exige JWT" não conta como fechado (novo na v3.1). O teste chama cada função de dois jeitos: sem cabeçalho de login e com a chave pública no cabeçalho de autorização, como faz o app. Só a lista de funções públicas (como o `receive-leads`, se for o formulário) pode aceitar a segunda chamada. Nas outras, a guarda fica dentro da função (confere que é você ou o motor). No GitHub, um teste lê a configuração e falha se alguma função depender só de "exige JWT" ou aceitar chamada sem login fora da lista. As chamadas de verdade acontecem só no Supabase descartável. Na produção, chamar uma função aberta executa a função (o `receive-leads` gravaria um lead), então o teste confere pelo catálogo (quem pode executar) e pela configuração e não chama as abertas por escolha. Para o cadastro de contas novas, ele lê a configuração pública do login do Supabase, sem criar conta (o campo exato: NÃO CONFIRMADO). Se um "usuário de fora" for necessário na produção, ele vira uma conta dedicada, criada por você com frase e sem permissões, e entra na lista de contas. Nenhum token da conta do Supabase vai para o GitHub. Limite assumido: uma função criada fora do repositório só aparece num inventário novo.
- **Inventário da v1, só leitura.** Ele cobre as 61 tabelas (dono, proteção por linha, acessos e qual tela usa cada uma), os acessos padrão, as funções, as Edge Functions e as pastas de arquivos. O que não tiver dono vira uma única pergunta agrupada, já com a resposta recomendada: "fica fechada para a chave pública; nada é apagado". Junto vêm duas perguntas:
  - onde está o código do receive-leads;
  - se ainda existe o projeto Supabase antigo que aparece num arquivo de configuração já apagado do repositório. O risco não foi medido: depende de o projeto existir e do que a chave pública abre nele. Ele pode guardar dados pessoais do app antigo (provavelmente é o "Lovable Cloud": NÃO CONFIRMADO), e a chave pública dele está no histórico do git. Você confere no painel. Se existir, ele entra no inventário e é pausado ou fechado, com frase e sem apagar dados.

  O projeto Supabase da Max (o do `MAX_SUPABASE_URL` do gateway) e o do `ids-max` entram no inventário como projetos a identificar, só com leitura. Qualquer mudança neles pede frase própria.
- **Nenhuma mudança de acesso na v1** acontece sem o inventário, sem o script de volta testado e sem a sua frase daquele passo. Quem executa é você, no editor SQL.

Isso reduz a chance de um acesso ser reaberto sem ninguém ver, erro que a v1 repetiu, e protege os dados pessoais das pessoas recrutadas (LGPD).

### Quem escreve no repositório (novo na v3.1)

Escrevem no repositório pelo menos:
- o robô do Lovable, com 255 mudanças (a última em 23/09) e sincronização nos dois sentidos;
- o Codex, com 90;
- o Cursor, com 9;
- o Antigravity;
- as minhas sessões, que aparecem com o autor "Rafael";
- os logins do git e os tokens do `gh` no seu PC, que o Codex, o Cursor e o Antigravity usam e que alcançam todos os seus repositórios (novo na v3.1).

A main foi recriada em 30/09, e o Lovable pode continuar ligado a ela. Os avisos automáticos do repositório para fora e as chaves de publicação dele estão NÃO CONFIRMADOS. Pode existir uma cópia do app publicada no Lovable, fora da varredura de portas: ela é conferida só por uma visita comum à página. Com a chave do banco no histórico até o fim dos testes, quem lê o repositório lê o banco.

- **Uma pergunta: você ainda usa o Lovable?** Se não usa: desligar a sincronização dele com o GitHub, tirar do ar a cópia publicada e revogar o acesso dele no Supabase, sem apagar os dados. Antes de desligar qualquer coisa, eu confirmo, só lendo, qual endereço serve o app hoje (NÃO CONFIRMADO), para não derrubar a produção. Desconectar o GitHub do Lovable pode não ter volta (NÃO CONFIRMADO), e o banco do Lovable Cloud, que pode guardar dados do app antigo, entra no inventário. Se usa: a edição visual continua num repositório só de rascunho, sem acesso à main.
- **Revisão de apps e tokens.** Nas telas do GitHub, você revisa os apps instalados, os apps autorizados (OAuth) e os tokens, inclusive os tokens clássicos com acesso "repo", remove o que não usa e marca "Only select repositories" (só os repositórios escolhidos). No PC, usa só tokens finos, por repositório. Nenhum app de terceiros (Lovable e outros) ganha permissão de mexer nas rotinas automáticas (workflows). A sessão do Claude mantém essa permissão, porque no GitHub sessão = você e ela precisa criar e mudar as rotinas que este plano pede; por isso as rotinas protegem contra erro, não contra desvio. Você me manda só os nomes, nunca os valores.
- **Três cliques em Settings > Actions.** Ligar a exigência de ações fixadas pela impressão digital completa, deixar as permissões das rotinas em "só leitura" e deixar desligada a criação de pedidos de mudança pelas rotinas.
- **Login do Supabase.** Depois de entrar, o Supabase só devolve a pessoa para o endereço do app, e nunca para outro site. Antes de tirar qualquer endereço dessa lista, confirmo qual endereço serve o app hoje, para o login não parar.
- **Lista de plataformas conectadas.** A lista de chaves ganha a seção "plataformas conectadas", com nome, dono, uso e data da última conferência.
- **Cada mudança diz qual ferramenta a fez:** Codex, Cursor, sessão Claude ou "fundador", quando é você. Autor desconhecido acende vermelho e abre um aviso. Isso é rastreio, não trava, porque o nome do autor de uma mudança pode ser inventado.

### No GitHub, a sessão é você (mudou na v3.1)

A sessão de IA entra no GitHub com o seu login, como administradora. No plano grátis (o plano da sua conta: NÃO CONFIRMADO), repositório privado não tem ambientes protegidos nem revisão obrigatória, e a main está sem proteção. Para o GitHub, quem dispara uma rotina é a mesma pessoa, seja você ou a sessão. Por isso, a trava da v3 ("um botão no GitHub que só você aperta, e o acesso das minhas sessões não consegue mudar esse caminho") não se sustenta. A própria v3 previa o plano B: se o teste 11 não provasse a trava, o botão passaria para o EasyPanel. A v3.1 adota o plano B desde já.

- **Regra escrita.** No GitHub, sessão = você. Nenhuma credencial que mude a produção fica no GitHub: nem a senha de mudança do banco, nem o endereço de publicação, nem o acesso ao EasyPanel. O GitHub só testa e monta a imagem de cada serviço.
- **Publicar é o seu toque no EasyPanel.** Você cola a impressão digital (digest: código único da imagem, que muda se um único byte mudar) de uma imagem que passou nos testes. A mudança do banco roda quando a versão nova liga, com uma credencial que só existe no EasyPanel. O caminho completo, com a volta, está em "Manutenção" e é construído e ensaiado no começo da fase 2. Dois pontos estão NÃO CONFIRMADOS: se o EasyPanel aceita a impressão digital no campo da imagem e se ele tem verificação em duas etapas. O ensaio da fase 2 decide a impressão digital. Se ele não aceitar a impressão digital, a saída é uma etiqueta única por versão, nunca uma etiqueta que muda de lugar.
  - **A credencial de mudança é limitada (novo na v3.1).** O seu toque decide quando e qual imagem vai ao ar, mas não o que o SQL da mudança faz, e esse SQL é escrito pela sessão. Por isso você cria a credencial no editor SQL, uma vez só, com o mínimo: ela é dona só do esquema `helena_v2` e das funções `v2_`; não dá acesso a `anon` nem a `PUBLIC`; a `authenticated` só dá EXECUTE nas funções `v2_`, nunca leitura ou gravação em tabela; não cria papéis; e não usa `pg_net`, `http`, `cron`, `vault`, `auth` nem as tabelas da v1. A sessão não consegue mudar esse limite. Se o Postgres sozinho não segurar algum desses itens, o ensaio da fase 2 mostra qual (NÃO CONFIRMADO), e o teste de catálogo roda logo depois de cada mudança. As mudanças nas tabelas da v1 continuam sendo suas, no editor SQL. Em uma frase: o toque trava quando; o limite da credencial trava o quê.
  - **A verificação em duas etapas do EasyPanel é conferida já na 0a (mudou na v3.1),** e não só no ensaio da fase 2, porque o login dele é a trava de publicar desde a 0a e o painel lê todas as variáveis, ou seja, todas as chaves de produção. Se ela não existir, um cartão traz as opções: uma senha única e longa num gerenciador de senhas, com o painel acessível só por uma lista de endereços no firewall do provedor (se isso funciona: NÃO CONFIRMADO), ou aceitar o risco por escrito. A varredura de fora diz se o painel do EasyPanel responde para a internet, e o portão 0a exige um dos dois resultados.
- **Publicação automática desligada.** Antes de qualquer junção na main, você confere no EasyPanel se algum serviço publica sozinho a partir do GitHub (NÃO CONFIRMADO). Se algum publicar, a publicação automática é desligada, com a sua frase, porque com ela ligada uma sessão publica sem o seu toque.
- **Os testes do GitHub protegem contra erro, não contra uma sessão desviada.** Toda checagem automática (gitleaks, auditoria das rotinas, conferência do plano, receitas e montagem da imagem) é um aviso que a própria sessão consegue mudar. O seu toque no EasyPanel decide quando e qual versão vai ao ar; ele não prova o que está dentro dela, porque você cola a impressão digital de uma imagem que a sessão escreveu, testou e montou. A trava de publicar é o EasyPanel, e a do banco depende do limite da credencial de mudança (acima) e de nenhum token de gestão ativo fora da lista (ver "Tokens de gestão do Supabase"). Os testes pegam erro, não uma sessão desviada. (mudou na v3.1: antes dizia só "a trava real é o seu login no EasyPanel, que nenhuma sessão tem", o que prometia mais do que entrega.)
- **Exceção conhecida até a troca das chaves.** A chave de acesso total está no histórico do repositório. Uma rotina do GitHub escrita por uma sessão desviada conseguiria usar essa chave para mudar o banco sem o seu toque. Esse risco está aceito na decisão de 10/10, e a troca no fim dos testes fecha essa porta. Até lá, o item "nenhuma credencial de produção no GitHub" aparece no teste 11 como risco aceito, nunca como verde. Se você preferir esperar a troca das senhas do canal e das chaves pagas (ver "Chaves escritas no repositório"), cada uma entra aqui também, com o mesmo tratamento.
- **Cartão de decisão: uma conta separada para as sessões (novo na v3.1).**
  - **A) Como está.** No GitHub, sessão = você, e a trava fica no EasyPanel. Não há nada novo para gerenciar. **Recomendado por enquanto**, porque a trava de publicar já não depende do GitHub.
  - **B) Uma conta separada, sem papel de administrador, só para as sessões.** Ganho: a sessão perde o poder de mudar as configurações do repositório. Limite: no plano grátis, repositório privado não tem proteção de ramo, então quem envia código ainda consegue mudar os testes. As regras de ramo exigem um plano pago do GitHub (preço NÃO CONFIRMADO). Com elas, e com a sessão sem papel de administrador, a sessão não conseguiria mudar a proteção da main; sem elas, ainda consegue mudar os testes. Custo: mais uma conta, com verificação em duas etapas e dois caminhos de volta.
  - Sem resposta, fica A.

### App que falha fechado (novo na v3.1)

O app traz como padrão os endereços de produção, escritos no código de conexão com o Supabase, com o gateway e com as mídias. Por isso, qualquer montagem sem as variáveis (uma prévia, o teste do GitHub ou uma cópia no PC) fala com a produção sem avisar. Se o gateway falhar, o app manda o seu login para um endereço local do computador de quem está usando. E o servidor de teste fica aberto para a rede local, com o modo de teste.

- Nenhum valor de produção fica no código.
- Sem as variáveis, o app mostra uma tela vermelha e não chama nada. A montagem de produção falha, e a versão anterior continua no ar.
- A reserva para o endereço local só existe em modo de desenvolvimento.
- O servidor de teste só abre no próprio computador.
- Depois de cada montagem, um teste do GitHub confere o endereço certo em cada pacote e procura restos do modo de teste ou do e-mail de teste.
- O modo de teste sem senha é apagado.
- Os arquivos de exemplo trazem só os nomes das variáveis.

As sessões fazem as mudanças, e você confere com a sessão as variáveis da hospedagem. Quem serve o app hoje está NÃO CONFIRMADO e será descoberto só lendo. A frase só é preciso se faltar variável na hospedagem; publicar segue o seu toque normal.

### O gateway da v1: quem pode chamar cada rota (novo na v3.1)

O gateway da v1 tem rotas que ligam, mandam WhatsApp, mudam configuração, mostram conversas ou gastam API paga. Li o código do ramo de trabalho atual (`services/helena-gateway/src/routes/integrations.mjs`, `server.mjs` e os arquivos de login da voz) e comparei com a leitura independente de outra cópia do mesmo arquivo (as linhas que ela citou não batem com as do ramo de trabalho, então a cópia é outra, provavelmente mais antiga). As duas cópias não são iguais, e a versão no ar é NÃO CONFIRMADA (o gateway sobe por zip). O que foi achado:

- **Sem login (um pedido sem cabeçalho de login passa).** O histórico das ligações e o detalhe de cada uma, com as conversas; as ligações ativas; a leitura da configuração e dos perfis da voz; os eventos; os status das integrações. O código chama essa proteção de "login opcional". Isso está confirmado no ramo de trabalho.
- **Qualquer login serve, não só o seu.** Mandar WhatsApp de teste pelo número da empresa para qualquer pessoa; mudar para onde vão todas as mensagens recebidas (e o código ainda põe a senha do aviso no endereço novo); ler essa configuração; gravar a configuração e os perfis da voz. "Login válido" aqui é qualquer conta do projeto oficial, a senha fixa do gateway ou o token de um perfil do Hermes. As telas de voz só conferem "administrador" quando o login é do projeto da Max; um login do projeto oficial cai no mesmo "qualquer login". Isso também está confirmado no ramo de trabalho.
- **Ligação de saída e teste de voz paga.** No ramo de trabalho, essas rotas exigem sessão: uma conta do app só liga para o telefone do próprio perfil, e a senha fixa do gateway escolhe qualquer destino. Na outra cópia, uma leitura independente achou a rota de ligação e o teste de diálogo (que chama a OpenAI ou a xAI) protegidos só pelo "login opcional". Se a versão no ar for essa, qualquer pessoa na internet liga para qualquer número, em nome da empresa, ou gasta a API paga. Não confirmei isso nessa cópia, e só a versão no ar decide.

Por isso, logo depois do passo das portas e da checagem de invasão, e antes dos passos da central, a 0a faz:
1. **Inventário de todas as rotas do gateway** e do que cada uma confere, tirado do código que está no ar (a cópia guardada, ver "Como cada passo anda"). Só leitura.
2. **Uma publicação do gateway**, com a sua frase e com a volta (o zip guardado), que exige você (fundador) nas rotas que ligam, enviam, mudam configuração, mostram conversas ou gastam API paga, e tira o acesso sem login delas. As rotas só de status ficam sem dados sensíveis. Se o app depende de uma rota hoje aberta, o checklist acusa, e eu trago a causa antes de tentar de novo.
3. **A conta de teste bloqueada ou apagada** (linha do `helenasistema.publico` na tabela acima), porque a exigência de login não protege enquanto o login de teste ainda vale.
4. **Limite de gasto nas contas pagas** (ver "APIs pagas da v1").
5. **Prova no teste 11:** cada rota da lista, chamada sem login e com um usuário de fora, responde recusa.

Esse passo vale mesmo com a central desligada, porque o gateway serve outras coisas além dela.

### A central da v1: clientes no WhatsApp e ligações por IA (novo na v3.1)

O que segue foi lido no código da v1, numa cópia do ramo `antigravity-planos` de 09/10/2026. O gateway sobe por zip, então a versão no ar pode ser outra (NÃO CONFIRMADO).

- **URA de clientes no WhatsApp** (`whatsapp-ura.mjs`; URA é o atendimento automático por menu). Quem manda "oi" recebe um menu em nome da Helena, "assistente virtual", com quatro opções:
  1. Vendas (Victor);
  2. Suporte (Joana);
  3. Financeiro (Caio), que pede CPF, CNPJ ou o número da fatura;
  4. Atendimento executivo (Marina).

  Cada mensagem de cliente é gravada no banco com o número e o texto e passa pela classificação do serviço Laya. Ela vira uma tarefa pronta para o agente da opção, com o nome, o número e a mensagem do cliente dentro da instrução, e o cliente recebe uma resposta automática.
- **Ligações de saída por IA** (`meowcaller.mjs` e a rota de ligação do gateway). O sistema liga para qualquer telefone informado, com voz sintética do Google, e registra a ligação no banco. Pelo código do ramo de trabalho, essa rota confere se quem chama tem sessão (uma conta do app, que só liga para o telefone do próprio perfil, ou a senha fixa do gateway, que escolhe qualquer destino). Ela não confere se é você. As telas de configuração da voz só conferem "administrador" para login do projeto da Max (ver "O gateway da v1"). Somado ao cadastro de contas aberto, uma pessoa de fora pode criar uma conta e usar as rotas que aceitam qualquer login (no ramo de trabalho, ligar para o próprio telefone, até 6 vezes por hora por conta). E uma leitura independente de outra cópia achou essa rota aberta sem login (versão no ar: NÃO CONFIRMADO).
- **Voz com API paga.** A voz usa a API paga da OpenAI (transcrição e conversa) e pode usar também ElevenLabs, xAI e Google (ver "APIs pagas da v1"). Se a voz do produto Max/eLiving™ (próximo bullet) mandar dados de saúde por essa API (NÃO CONFIRMADO), são dados sensíveis na LGPD (art. 11) indo para uma API paga de terceiro, e isso entra no cartão de LGPD.
- **A voz do produto Max/eLiving™ (novo na v3.1).** O mesmo serviço de voz e de ligações não serve só à central. O código busca o contexto de quem liga "de servidor para servidor" na Max (`MAX_VOICE_CONTEXT_URL` e `MAX_VOICE_CONTEXT_TOKEN`), aceita administradores de outro projeto Supabase (`MAX_SUPABASE_URL` e `MAX_SUPABASE_ANON_KEY`), liga "para o celular do usuário" com personagens (a rota usa o `rafael` como padrão) e também atende ligações recebidas, com o perfil `sirlene_normal` como reserva. O documento `docs/helena/conversation-naturalness.md` fala da "Max". Parar esse serviço pode derrubar uma função de um produto com usuários de fora (NÃO CONFIRMADO se há usuários reais). A decisão de 10/10 cobre a URA e a ligação de saída da central, e não cobre essa voz do produto.

Isso importa por quatro motivos:
- é contato com pessoas de fora feito por IA, que o sistema nunca deveria fazer sem o seu toque;
- o texto do cliente vira instrução de agente;
- o banco guarda dados pessoais de clientes (telefone, nome, CPF ou CNPJ), o que envolve a LGPD;
- a v3 travava o WhatsApp no seu número, o que desligaria a URA sem aviso para os clientes.

**A sua decisão de 10/10 é desligar a central** (a URA de clientes e as ligações de saída por IA). Desligar mexe no ar, então segue esta ordem:
1. **Inventário só de leitura** do que a central faz hoje: quantas mensagens de clientes chegam por semana, quais conversas estão em aberto, quantas ligações foram feitas (de saída e de entrada), que número e que marca o canal usa, quais dados de clientes estão guardados e se existe outro caminho de ligação. Ele separa três coisas: a URA de texto do WhatsApp, a ligação de saída da central e a voz do produto Max/eLiving™. Para cada uma: quem usa, quantas chamadas por semana, que dados passam (inclusive de saúde) e para qual API.
2. **A ligação de saída fecha primeiro,** com a sua frase, porque fechar a saída não depende de avisar clientes. Só que o serviço de ligações também atende as ligações que chegam, e parar o serviço derruba esse atendimento. Por isso:
   - se o inventário achar ligações de entrada, ou usuários reais da voz do produto Max/eLiving™ (NÃO CONFIRMADO), a saída fecha sem parar o serviço, pela publicação do gateway (com a sua frase e a volta) que fecha as rotas de ligação de saída. A entrada espera o aviso aos clientes, junto com a URA, e o desligamento da voz do produto segue o mesmo caminho: aviso antes e frase sua;
   - se não houver entrada nem usuários, o jeito com volta é parar o serviço de ligações no EasyPanel, que religa com um clique.

   Em qualquer caso, tirar só a variável não basta, porque o código tem uma senha de reserva escrita.
3. **Já na 0a, sem esperar o aviso, e com a sua frase: a URA deixa de criar tarefa.** Até o aviso, cada mensagem de cliente continua virando uma tarefa pronta para a Joana ou o Victor, com o texto do cliente dentro da instrução, e esses agentes têm ferramentas de busca e as do gateway. Esse motivo não depende do aviso. Então a mensagem de um número que não é o seu deixa de criar tarefa e só recebe o menu, com a frase "a equipe responde por este canal". Você aprova o texto do menu, e a promessa só vale se alguém responde por esse canal (quem responde hoje: NÃO CONFIRMADO, o inventário responde). Isto não desliga a URA, mas muda o que o cliente recebe antes do aviso, e a sua decisão de 10/10 pede aviso antes de desligar. Por isso é uma opção recomendada, e a escolha é sua. Se você preferir não mudar nada antes do aviso, o aviso passa a ser o primeiro passo depois do inventário, e o prazo dele é o que mantém o risco aberto.
4. **Aviso aos clientes.** Eu escrevo o texto, e você aprova e envia, ou escolhe quem envia. Nenhum agente envia.
5. **Com os clientes avisados, a sua frase desliga a URA:** a resposta automática também para. Na prática, é a mesma mudança que trava o WhatsApp no seu número: mensagem de outro número deixa de receber resposta automática. Ela continua visível no próprio WhatsApp daquele número. Como você usa esse número hoje está NÃO CONFIRMADO, e o inventário responde.
6. **O checklist da v1** passa a conferir que a URA e as ligações continuam desligadas (e que a ligação de entrada atende, enquanto ela existir por decisão sua).
7. **Os dados de clientes já gravados ficam onde estão,** fechados ao acesso público. Nada é apagado sem decisão sua. O que se guarda, por quanto tempo e como se apaga entra no mesmo cartão de LGPD da primeira meta, junto com os dados de saúde que a voz do produto Max/eLiving™ possa ter mandado para a API paga (NÃO CONFIRMADO).

Se um dia as ligações de saída voltarem, cada uma só acontece com o seu toque, pela máquina de ação externa (abaixo). Nunca por um agente e nunca por qualquer login.

### APIs pagas da v1 (novo na v3.1)

Quando existe a variável da chave da OpenAI, o gateway da v1 chama a API paga dela na voz, em 4 arquivos. Ele também chama xAI, ElevenLabs, Google Cloud e TypeSafe, e o app ainda lista RunPod, Gemini e Whapi. Não achamos nenhuma exceção escrita à DEC-014 (sem API paga da OpenAI nesta fase). Trocar a chave da OpenAI sem saber disso pode derrubar ligações. E o teste 6 (processador abaixo de 70%) não tem uma medida de partida.

Na 0a, só leitura:
- você cola os nomes das variáveis de cada serviço do EasyPanel, nunca os valores, e informa o gasto do mês de cada serviço pago;
- medimos o processador e a memória de cada contêiner por 24 horas, com a v1 sozinha, e isso vira a linha de base do teste 6;
- contamos quantas execuções a v1 faz por dia;
- você confirma em dois lugares. No ChatGPT: créditos zerados e recarga automática desligada, por causa da cota. Na plataforma da API da OpenAI, que cobra à parte da assinatura do ChatGPT: o saldo, a recarga automática e o limite de gasto da chave que a voz usa. O ChatGPT sozinho não mostra o gasto da API, e conferir só ali deixaria a DEC-014 parecer conferida sem estar. (mudou na v3.1)

Depois, você recebe um cartão por serviço, com três opções: desligar, manter como exceção escrita com teto ou manter só para teste. A voz da v1 entra no cartão da central: até o desligamento, mantê-la como exceção escrita com teto ou desligá-la já. Os limites de contêiner entram um serviço por vez, cada um com a sua frase, sem limite rígido no WhatsApp e na voz enquanto eles existirem. Cada cartão traz também o limite de gasto da conta, que você liga no próprio serviço. Quanto à conferência: o motor da v2 não liga se achar chave de API paga no ambiente, e a confere de novo no sinal de vida. Na v1, nenhum teste do GitHub enxerga o EasyPanel. A conferência é o item mensal seu (colar só os nomes das variáveis), que falha se a chave da API da OpenAI ou do AI Gateway (serviço pago da Vercel para chamar modelos de IA) aparecer sem decisão escrita, e o cartão de diagnóstico avisa "vencido" depois de 35 dias. (mudou na v3.1: antes era um teste semanal do GitHub, que não tem de onde ler essas variáveis.)

### Contas com dois caminhos de volta (mudou na v3.1)

Com a verificação em duas etapas, perder o celular tranca você fora, e o GitHub e o Supabase podem não conseguir devolver o acesso (o GitHub tem um pedido de recuperação que leva dias e avisa que pode não restaurar). A v3 esquecia o e-mail principal, o ChatGPT, o Telegram e o healthchecks.

- **Contas cobertas.** A verificação em duas etapas com dois caminhos de volta vale para:
  - o e-mail principal;
  - o GitHub;
  - o Supabase, com o segundo fator em outro aparelho, porque ele não tem códigos de recuperação;
  - o EasyPanel, conferido já na 0a (se ele oferecer a verificação: NÃO CONFIRMADO; se não oferecer, vale o cartão de "No GitHub, a sessão é você");
  - a Hostinger;
  - o ChatGPT;
  - o Telegram.

  O healthchecks entra quando for criado, na 0b.
- **Contas de serviço pago ou de terceiro (novo na v3.1).** Esta seção cita outras contas que também podem mexer no app, no gasto ou no domínio: o Lovable, a plataforma da API da OpenAI (cobrança separada do ChatGPT), o Google Cloud, a ElevenLabs, a xAI, a TypeSafe, a Cloudflare (R2, citado no registro de 07/10), a Vercel (do AI Gateway, se houver conta), o projeto Supabase da Max e o registro do domínio (DNS). Elas entram numa linha "conta de serviço pago ou de terceiro", com duas etapas quando o serviço oferecer, dois caminhos de volta e o limite de gasto do cartão de cada serviço. Sem isso, o teste "nenhuma conta nova sem linha na lista" nasceria vermelho.
- **Códigos de recuperação.** Ficam impressos e guardados em dois lugares. O SMS nunca é o único caminho.
- **`contas.yaml` só com rótulos.** Para cada conta: dono, tipo de verificação, lugar dos códigos descrito de forma genérica (como "cofre físico"), o que para se a conta se perder e quem avisa. Nunca e-mail, telefone ou código.
- **Nenhuma conta nova sem linha na lista.** Um teste falha se o plano citar uma conta que não está nela.
- **Avisos por e-mail.** Um filtro no e-mail separa os avisos, e o cartão de diagnóstico mostra a data do último aviso de cada remetente.
- **Revisão e ensaio.** A lista é revista a cada 3 meses. Antes do portão da fase 2, há um ensaio de entrar nas contas com o celular principal desligado.
- **Quem faz:** você, em 1 a 2 horas. Eu monto a lista e o teste.

### Portão 0a (mudou na v3.1)

A 0a só fecha com tudo isto, nunca por data. Os itens estão em dois grupos, porque nem todos são teste: uns um teste confere, outros dependem da sua palavra, e esses levam a data da sua confirmação. (mudou na v3.1: o portão misturava os dois e deixava de fora o app que falha fechado, as rotas do gateway, os cartões das APIs pagas e o Lovable.)

**Conferido por teste:**
- a varredura de fora mostra só as portas previstas, e cada domínio da lista do EasyPanel responde só o serviço esperado, e só com login;
- a checagem de invasão não achou sinal nos itens que o roteiro lista, ou a contenção que você escolheu foi feita. Isso não prova que nada foi lido (ver "Primeiro, ver se alguém entrou");
- a cópia completa existe, criptografada, e a restauração bateu com a contagem tirada pelo dono, e não só com a do papel da cópia;
- as funções e as tabelas da lista recusam a chave pública e um usuário de fora (no Supabase descartável e, na produção, pelo catálogo), cada rota do gateway da lista recusa quem não tem login e quem tem login mas não é fundador, o cadastro de contas está desligado, o modo de teste foi apagado, o papel antigo de fundador saiu e a conta de teste foi bloqueada ou apagada;
- a montagem do app sem variáveis falha, e a versão anterior continua no ar;
- a ligação de saída está fechada, e o WhatsApp só aceita o seu número, com a senha;
- chaves, conforme a sua decisão de 10/10: os 11 arquivos leem variável, a lista de chaves existe sem valores, e uma varredura completa de segredos, rodada uma vez, não acha chave nova;
- o seu login continua funcionando, e o checklist da v1 ficou igual ou melhor depois de cada passo.

**Confirmado por você, com a data da confirmação:**
- nenhum serviço publica sozinho a partir do GitHub;
- a URA foi desligada depois do aviso aos clientes, e a ligação de entrada foi tratada conforme o inventário;
- cada serviço pago tem o cartão decidido, e o Lovable está decidido;
- o risco aceito das chaves do banco está escrito com a data de revisão. Se você decidir trocar agora, o item vira "a chave antiga é recusada de fora";
- as senhas do canal e as chaves pagas foram trocadas, ou aparecem como risco aceito por decisão sua, nunca como verde (o item do WhatsApp aparece assim enquanto a senha da Evolution não for trocada);
- os tokens de gestão do Supabase foram revogados, e os membros e os apps autorizados foram conferidos;
- o login do EasyPanel tem duas etapas, ou o cartão com as opções foi decidido;
- quem escreve no repositório está listado, e os apps só veem os repositórios escolhidos;
- a verificação em duas etapas tem dois caminhos em cada conta da lista, inclusive a linha de serviços pagos e de terceiros;
- nada mudou sem a frase daquele passo.

### Regras que valem em todas as fases

- **Chave colada não se espalha.** Se uma chave for colada no app ou no WhatsApp, o código a troca por "\[chave removida]" antes de gravar e responde pedindo para não colar chaves ali. Assim, ela não chega à Helena, aos agentes nem ao histórico. (novo na v3.1: o filtro usa as mesmas regras do gitleaks, que reconhecem as chaves novas do Supabase e as senhas próprias da Helena.) Nenhuma chave passa pelo chat comigo: você cola cada uma direto no Supabase, no EasyPanel ou no `helena-backup`.
- **As ferramentas não olham para dentro.** "Buscar" e "ler página" só acessam endereços públicos da internet. Nunca o próprio servidor, a rede interna, os outros serviços da VPS, o endereço de dados da máquina ou os dados dela. Cada redirecionamento é conferido de novo, e cada página tem limite de tamanho e de tempo. (novo na v3.1: na fase 2, a ferramenta é provada contra páginas falsas antes de ir ao ar. Na v2.0, "ler página" só abre endereços de uma lista montada pelo código, e "buscar" só entra na fase 4.)
- **Texto de IA é só texto.** Tudo o que um agente escreve aparece no app como texto puro, sem imagem e sem código de página. Um link só aparece se for de uma página lida na tarefa, e mostra o site. Caracteres invisíveis e comentários escondidos são tirados das páginas antes de o agente ler. Numa decisão sua, o registro guarda as suas palavras e a opção escolhida; o que a IA escreveu entra só como citação curta e marcada. Texto que vem de fora, como a mensagem de um cliente, é sempre dado, nunca instrução. (mudou na v3.1: a trava do navegador vira um arquivo do repositório, testado. Ela bloqueia imagens e scripts de fora da lista de origens do app; a lista inclui, por exemplo, o Supabase, o armazenamento de arquivos e as fontes. A trava passa a valer por teste: todas as telas abrem sem violação e uma imagem plantada é bloqueada. Quem serve o app hoje: NÃO CONFIRMADO.)
- **O agente nasce sem segredo.** O processo do agente recebe só o necessário para rodar, sem nenhuma senha no ambiente, e o Hermes não instala nada sozinho durante a tarefa. O teste 3 confere isso a cada versão nova. (novo na v3.1: com a chave antiga valendo até o fim dos testes, isso pesa mais. A pasta vazia, fora de qualquer repositório, também impede o agente de ler os arquivos antigos com chave. Um teste confere que o processo do agente não enxerga a credencial de mudança do banco, e o motor não liga se achar chave de API paga no ambiente.)
- **Ação de fora só pelo motor.** Cada serviço diz na ficha quais ações pode usar, e cada ferramenta diz o seu efeito: ler, gravar dentro ou agir fora. Uma ferramenta que age fora nunca roda dentro do agente: o motor executa depois do seu ok registrado, uma vez. (mudou na v3.1: a v3 dizia "os 5 primeiros agentes não têm nenhuma". Agora nenhum dos 21 tem, porque na tabela de passagens o autor e o revisor não podem agir fora.) (novo na v3.1: a ação externa tem máquina própria, com os estados proposta, autorizada, executando e incerta. Ela é executada no máximo uma vez. Quando o motor não sabe se a ação aconteceu, ela fica "incerta" e você confere; ela nunca é repetida sozinha. A mesma regra vale para o que a v1 fazia com clientes.)
- **Acessos escritos por extenso.** Em 30 de outubro de 2026, o Supabase deixa de expor automaticamente as tabelas novas do esquema principal, e a mudança das funções ainda está em discussão. Por isso, cada mudança no banco tira e dá cada acesso por extenso, e o teste 11 confere o resultado, valha a regra que valer. (novo na v3.1: as tabelas que já existem mantêm os acessos que têm, então essa data não conserta a v1. O teste de catálogo roda antes e depois dela.)
- **Aprovação de risco só no app.** Gasto, cadastro, contato, ligação ou publicação nunca é aprovado pelo WhatsApp. Antes da primeira ação de fora, na fase 4, aprovar no app passa a pedir também o código do autenticador. (mudou na v3.1: entrou a ligação para cliente.)

### Depois (P2): rede fechada para o processo do agente (novo na v3.1)

As ferramentas já não olham para dentro, mas o processo do próprio agente ainda alcança a internet e a rede interna da VPS. Hoje o risco é pequeno, porque o Hermes travado não tem terminal. O risco real chega na fase 4, com o Codex, que tem terminal.
- **Agora, só no teste.** O teste 3 roda sem internet, e qualquer conexão fora do servidor falso e das nossas ferramentas reprova a versão.
- **Na fase 4, se o teste mostrar que é preciso:** uma rede interna do Docker cuja única saída é um intermediário com lista de domínios (o login e o modelo do ChatGPT e o nosso servidor de ferramentas), com a lista guardada no repositório. A lista é medida por teste, rodando de novo o teste 2 (login) com a rede fechada, e não por dias só registrando.
- **O Codex só entra** se o isolamento dele recusar endereços de fora e internos. Se não recusar, vira cartão de decisão para você.
- **O motor nunca recebe controle direto do Docker.**
- **Qualquer mudança no servidor** por causa disso pede a sua frase.

### Prova no teste 11 (mudou na v3.1)

Cada regra acima tem prova no teste 11, que roda de novo a cada mudança e toda semana, dentro da tabela de minutos:
- varredura de fora de todas as portas e de todos os domínios da lista do EasyPanel;
- cada função chamada com a chave pública e com um usuário de fora, no Supabase descartável (na produção, só o catálogo e a configuração, sem chamar função aberta);
- teste de catálogo;
- as Edge Functions chamadas sem cabeçalho de login e com a chave pública no cabeçalho, no Supabase descartável; só as da lista pública podem aceitar a segunda chamada, e na produção a conferência é pela configuração;
- o cadastro de contas conferido como desligado, pela configuração pública do login, sem criar conta;
- páginas plantadas com endereços internos, imagens e instruções invisíveis;
- a mesma mensagem do WhatsApp 10 vezes, inclusive forjada, e uma mensagem de outro número, que não cria nada;
- cada rota de ligação, de voz paga, de envio e de configuração do gateway da lista, chamada sem login e com um usuário de fora, recusando (mudou na v3.1: antes era só "a rota de ligação recusando");
- cada acesso de IA tentando ler o `helena-backup` e recebendo recusa;
- a montagem do app sem variáveis falhando;
- a varredura de segredos verde.

O GitHub não enxerga o EasyPanel. O que depende dele (os nomes das variáveis da v1) é o item mensal seu, e na v2 é a conferência do próprio motor, como descrito em "Chaves escritas no repositório".

Saiu do teste 11 a linha "o acesso das minhas sessões tentando publicar". No lugar entram duas: nenhuma credencial que mude a produção no GitHub, e só o Deploy do EasyPanel mudando a versão no ar. Até a troca das chaves, a primeira aparece como "risco aceito por decisão sua de 10/10", nunca como verde, porque a chave antiga está no histórico do repositório.
