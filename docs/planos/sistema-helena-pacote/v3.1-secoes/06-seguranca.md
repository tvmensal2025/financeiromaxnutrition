## Segurança: fase 0a, estancar

(mudou na v3.1: a fase 0 virou duas partes. A 0a, "estancar", fecha o que está exposto hoje. A 0b, "vigiar", monta o backup de toda noite, o vigia do vigia, os avisos no Telegram e o cartão de diagnóstico. O botão de publicar saiu da fase 0 e foi para o começo da fase 2, porque a publicação só pode ser provada com motor e card de ensaio.)

A fase 0a vem antes de qualquer peça nova e vale para a v1 também, porque as duas dividem o servidor, o banco e a conta do ChatGPT. Ela começa conferindo se alguém já entrou e faz uma cópia completa do banco antes de qualquer mudança nele. Nenhuma peça nova vai ao ar antes do portão 0a. Depois dele, a 0b corre junto com a fase 1, que é só de arquivos, e precisa fechar antes da fase 2. A 0a termina quando o portão passa, nunca numa data marcada (mudou na v3.1: saiu a promessa de "fecha em dias").

### Como cada passo anda (novo na v3.1)

- **Quem executa o SQL.** As minhas sessões não alcançam o banco: na nuvem, a rede delas é recusada (erro 403) ao chamar o Supabase, e no seu PC o Windows bloqueia o programa do Supabase. Além disso, nenhuma senha do banco pode ficar no repositório principal. Por isso, cada comando da 0a no banco é executado por você, no editor SQL do Supabase (a tela do painel onde se cola e roda um comando). Eu mando cada passo pronto, num bloco só, com quatro partes: a conferência de antes (só leitura), a mudança, a conferência de depois e o script de volta, que desfaz a mudança. O resultado que você cola de volta traz só nomes, contagens e "sim" ou "não". Ele nunca traz dados de pessoas nem chaves.
- **Checklist da v1 antes e depois de cada passo.** Antes de cada passo que mexe na v1, e logo depois, rodamos o mesmo checklist:
  - o seu login no app;
  - o WhatsApp respondendo ao seu número;
  - a saúde do gateway;
  - uma tarefa do Hermes;
  - o formulário de leads;
  - as tarefas agendadas;
  - o caminho que cria empresa pela DEC-022, conferido pelo catálogo do banco, sem criar empresa de mentira;
  - a central de clientes (URA). Enquanto ela existe, o checklist confere que continua funcionando. Depois de desligada, confere que continua desligada.

  (mudou na v3.1: o checklist ganhou a DEC-022 e a URA.)
- **Igual ou melhor que antes do passo.** A v1 travou, então o ponto de partida pode já estar vermelho em algum item. Por isso, o critério de cada passo não é "tudo verde", e sim "igual ou melhor que antes do passo". Se algum item piorar, você roda o script de volta, e eu trago a causa antes de tentar de novo. (novo na v3.1)
- **Uma frase por passo, e ela não vence.** A sua frase tem dois níveis. A que aprova o texto do plano não autoriza mudança no banco ou no servidor. Cada passo da 0a que muda alguma coisa tem a frase dele, e eu peço todas numa mensagem só. A frase vale até ser usada e não vence por data. Só peço de novo se mudarem o script, o estado conferido antes ou o alcance do passo, como manda o AGENTS.md. (mudou na v3.1: separamos os dois níveis da frase, e a autorização deixou de vencer em 7 dias.)

### Primeiro, ver se alguém entrou

As portas 9119 e 8642 da v1 ficaram abertas para a internet. A documentação do próprio Hermes diz que painéis abertos foram a porta de entrada de uma campanha de invasão em junho de 2026, que deixava uma chave de acesso escondida no servidor. Por isso, a 0a começa com uma checagem só de leitura, dentro da v1 e no servidor. Ela olha as chaves de acesso, os servidores de ferramentas e as tarefas agendadas de cada perfil, os arquivos mudados depois da última publicação, as portas abertas e os acessos recentes.

- **Quem roda.** Você, no console do EasyPanel, com o roteiro que eu mando. O roteiro imprime só nomes, caminhos, datas e impressões digitais de arquivos, nunca o conteúdo. Assim, o resultado pode voltar ao chat sem levar nenhuma chave. (novo na v3.1)
- **A varredura de fora.** Eu preparo a varredura de todas as portas e domínios do servidor, de qualquer outro servidor ou domínio que o inventário achar (como a Hostinger, se estiver ligada) e de uma possível cópia do app no Lovable. Ela roda numa máquina do GitHub, porque a rede das minhas sessões passa por um intermediário que pode bloquear varreduras (NÃO CONFIRMADO). Depois, o GitHub repete a varredura toda semana, dentro da tabela única de minutos. (mudou na v3.1: antes eu varria direto da sessão.)
- **As duas portas fecham logo depois da checagem.** Isso acontece antes de qualquer outro passo, sem esperar a cópia do banco, porque fechar uma porta não toca no banco e não apaga as provas que a checagem lê. Você remove as duas no EasyPanel, com a frase desse passo. (mudou na v3.1: a ordem ficou explícita.)
- **Se aparecer sinal de invasão.** Eu paro a 0a e mando um cartão urgente. A recomendação é conter primeiro, mesmo que isso derrube a v1: refazer a v1 de uma imagem limpa, com login novo do ChatGPT e todas as chaves trocadas na hora, antes de qualquer peça nova. A sua decisão de 10/10, de trocar as chaves só no fim dos testes, foi tomada sem sinal de invasão. Com sinal, a recomendação muda, e a escolha continua sua. (mudou na v3.1)

### A cópia do banco antes de tudo (novo na v3.1)

Hoje não existe nenhuma cópia completa do banco, e o plano grátis do Supabase não faz backup. A v3 só copiava as tabelas que cada mudança tocava, sem acessos, papéis e tarefas agendadas. Na v3.1, uma cópia completa e criptografada vem antes de qualquer mudança no banco ou nas chaves.

1. **Você cria à mão o repositório `helena-backup`**, privado, e tira dele os apps de IA. Assim, as minhas sessões não o alcançam, desde que os apps continuem restritos, o que a lista de apps confere. Ele nasce já na 0a por causa desta primeira cópia; o backup de toda noite fica para a 0b.
2. **Você roda no editor SQL o script** que cria um papel só de leitura para o backup. Esse passo tem frase, e a volta é apagar o papel.
3. **Você cola 2 segredos no `helena-backup`:** o acesso desse papel e a chave que abre a cópia, que só o teste de restauração usa. Uma cópia dessa chave fica com você, fora do computador.
4. **Você aperta o botão que faz a cópia.** Ela leva a estrutura, os dados, os papéis e as tarefas agendadas, e nunca as senhas, o cofre de segredos ou as sessões. A cópia sai criptografada e fica guardada numa versão do `helena-backup`.
5. **O mesmo botão restaura a cópia** num banco descartável, montado na máquina do GitHub, e confere a contagem de linhas de cada tabela.

Se a contagem não bater, nenhuma mudança no banco acontece, e eu trago as opções num cartão. Um motivo possível: o Supabase pode não deixar um papel só de leitura enxergar todas as linhas das tabelas protegidas (NÃO CONFIRMADO). Os minutos dessa cópia saem da cota da sua conta do GitHub, mesmo num repositório separado, e entram na tabela única de minutos.

### Hoje e na fase 0a

| Hoje | Na fase 0a | Quem faz |
| --- | --- | --- |
| Portas 9119 e 8642 abertas, e as outras nunca conferidas | Fechadas logo depois da checagem de invasão. A varredura de fora cobre todas as portas e domínios e se repete toda semana | Você, no EasyPanel. A varredura, eu |
| Talvez algum serviço do EasyPanel publique sozinho a partir do GitHub (NÃO CONFIRMADO) (novo na v3.1) | Você confere a origem de cada serviço, e a publicação automática fica desligada em todos | Você confere e diz a frase |
| O modo de teste do app abre sem login para qualquer pessoa na sua rede | Apagado do código, e não só desligado. O servidor de teste só abre no próprio computador (mudou na v3.1) | Eu escrevo. Publicar segue o seu toque |
| O usuário helenasistema.publico ainda tem papel de fundador | Papel removido. Só você é fundador | Você, no editor SQL |
| Quem tem a chave pública do app consegue chamar as funções do banco e criar uma conta | O banco tira o acesso público das funções, e cada uma aceita só o motor ou você. A v3 contava 38 funções, as migrations citam 43 nomes, e o número real sai do inventário. O cadastro de contas novas fica desligado | Você, no editor SQL e no painel |
| Toda tabela nova recebe leitura e gravação pela chave pública, e 37 das 61 tabelas nasceram fora das migrations (novo na v3.1) | As tabelas da v2 nascem num esquema próprio, fora da API. As da v1 só fecham depois do inventário, com script de volta | Você, no editor SQL |
| O app pode gravar direto nas tabelas | Na v2, o app só grava pelas funções do trilho, e o banco recusa o resto. Na v1, a gravação pela chave pública fecha tabela por tabela, depois do inventário | Você, no editor SQL |
| O WhatsApp aceita qualquer número, e o endereço que recebe as mensagens não pedia senha | Depois do aviso aos clientes, só o seu número. O endereço aceita só quem manda a senha combinada (o código novo já pede; se a versão no ar pede: NÃO CONFIRMADO). A mesma mensagem vira um card só, e o eco das respostas é ignorado | Eu escrevo. Você publica e diz a frase |
| A central da v1 responde clientes e faz ligações de saída por IA (novo na v3.1) | Inventário só de leitura. A ligação de saída fecha primeiro, e a URA é desligada depois do aviso aos clientes | Inventário, eu. Desligar, você, com a frase |
| Chaves de acesso total circulando, inclusive no chat, e escritas em 9 arquivos do repositório | Uma lista de todas as chaves, sem os valores. Os arquivos passam a ler variável, e a varredura de segredos roda a cada envio. A troca acontece no fim dos testes, por decisão sua (mudou na v3.1) | Eu escrevo. Você confere os nomes no EasyPanel |
| Não se sabe quem escreve no repositório (novo na v3.1) | Inventário de apps e tokens, o Lovable decidido, e cada app só vê os repositórios escolhidos | Você, nas telas. Eu monto a lista |
| O app traz endereços de produção escritos no código (novo na v3.1) | O app falha fechado: sem as variáveis, não monta nem chama nada | Eu |
| A v1 usa APIs pagas sem exceção escrita à DEC-014 (novo na v3.1) | Inventário e um cartão de decisão por serviço | Você informa nomes e gastos e decide |
| Contas importantes protegidas só por senha | Verificação em duas etapas com dois caminhos de volta, inclusive no e-mail, no ChatGPT e no Telegram (mudou na v3.1) | Você |

### Chaves escritas no repositório (mudou na v3.1)

Na main, 11 arquivos rastreados têm uma chave do banco escrita no código: 9 com a chave de acesso total (service_role) e 2 com a chave pública (anon), todas do projeto oficial. São 10 scripts da pasta `scripts`, quase todos de uso único e da eLiving™, mais o servidor de desenvolvimento do gateway. Os mesmos arquivos estão nos ramos `missao-cumprida-v4` e `antigravity-planos`. A chave de acesso total também aparece no servidor de desenvolvimento na ponta de 31 dos 33 ramos.

Há ainda outras senhas escritas no código, fora desse formato, em cerca de 13 arquivos: a senha do gateway, a do serviço de ligações (Meowcaller) e a da Evolution (o WhatsApp), entre outras. Ao todo, cerca de 23 arquivos da main têm alguma senha escrita. Uma delas vai para produção: o `voice-agent.mjs` usa a senha do Meowcaller escrita no código quando a variável falta. Também entram na lista as chaves que apareceram no chat e num registro de montagem (a lista de 07/10).

Apagar o arquivo não tira a chave do histórico do git. Reescrever o histórico também não resolve, porque existem cópias do repositório no Codex, no Cursor, no Antigravity e no seu PC. O conserto de verdade é trocar a chave.

**A sua decisão de 10/10 é trocar as chaves do banco no fim dos testes.** Esse era o combinado antigo, já adiado pela DEC-019. A v3 recomendava trocar já na fase 0. A v3.1 segue a sua decisão e escreve o risco por extenso. Parte do motivo da v3 para trocar cedo perde força: na v3.1, os testes que podem estragar dados rodam num Supabase descartável, e não no banco de verdade.

- **Risco aceito.** Até a troca, a chave de acesso total continua valendo. Quem lê o repositório, ou qualquer cópia dele, consegue ler e mudar o banco inteiro. Por isso, até a troca, saber quem lê o repositório (seção abaixo) pesa tanto quanto fechar as portas. No registro, os furos B-3, K-6 e M-10 passam de "troca na fase 0" para "risco aceito por decisão sua, com troca no portão final dos testes".
- **O que passa a valer já na 0a:**
  - o repositório continua privado;
  - os 11 arquivos passam a ler a chave de uma variável de ambiente e param na hora se ela faltar, sem trocar o valor. Os scripts de uso único saem do repositório;
  - a senha de reserva do `voice-agent.mjs` só sai depois que você confirmar que a variável existe no EasyPanel, porque mexer nesse arquivo é publicar o gateway da v1, com a sua frase. Se a central for desligada antes, esse passo vira só limpeza;
  - nenhum arquivo novo pode ter chave, e a varredura de segredos roda a cada envio;
  - a lista de chaves diz o nome de cada uma, onde vive, quem usa e como trocar, nunca o valor. Ela ganha a seção "plataformas conectadas", e um teste semanal confere a lista contra o que está de fato configurado. A lista inclui também o que tem segredo sem ser chave, como o arquivo de backup do Hermes da v1, que contém tokens e nunca vai ao chat nem ao GitHub.
- **As outras senhas escritas no código** (gateway, Meowcaller e Evolution) não são chaves do banco, e a decisão de 10/10 fala só das chaves do banco. Elas entram no mesmo cartão, com a recomendação de seguir a mesma data. A do Meowcaller perde o uso quando a central for desligada.
- **No portão final dos testes, a troca é feita peça por peça.** Cada peça ganha uma chave própria, porque o Supabase tem chaves secretas novas que podem ser uma por peça. O app é remontado com a chave pública nova. Depois, o par antigo é desligado, e isso tem volta: se algo da v1 parar, a chave antiga pode ser religada na hora enquanto eu corrijo. O segredo antigo só é revogado (o que não tem volta) depois de um período medido sem nenhum uso da chave antiga. Antes de desligar, leio os registros de uso por alguns dias, para achar quem ficou fora do inventário, como um formulário de leads que use a chave pública. A data de revisão desse risco fica escrita no cartão, com o dia que você escolher. (mudou na v3.1: a v3 só desligava a chave antiga. Revogar é o que faz ela parar de valer de vez, e só acontece depois da medição.)

**O gitleaks substitui a varredura do GitHub (novo na v3.1).** O GitHub não oferece varredura de segredos em repositório privado de conta pessoal. Quem faz esse papel é o gitleaks, um programa grátis que procura chaves no código e só exige licença de organizações.
- **Regras próprias.** As regras padrão deixaram passar 6 de 28 linhas com segredo conhecidas e não reconhecem as chaves novas do Supabase nem as senhas próprias da Helena. Com regras próprias, o teste pegou 28 de 28.
- **Exceções só pela impressão digital do achado, nunca pelo valor.** O relatório comum do gitleaks guarda a chave inteira, e gravá-lo no repositório espalharia a chave de novo.
- **Tudo, a cada envio.** No teste, a varredura de todos os ramos e de todo o histórico levou cerca de 4 segundos, então ela roda inteira a cada envio. Ela fica num job só, junto com as outras checagens leves. O programa tem versão fixa e conferência do arquivo baixado, e as ações do GitHub ficam fixadas pela impressão digital da versão (SHA).
- **Ordem de ligar.** Entre as rotinas do GitHub, ela vem em terceiro, depois do backup e do diagnóstico. Os minutos dela entram na tabela única. Até o job do GitHub ser ligado na 0b, cada sessão roda o gitleaks antes de enviar, como passo da receita.
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
- **A v2 nasce fechada.** As tabelas da v2 ficam num esquema próprio, `helena_v2`, fora da API. Nele não há acesso para a chave pública, para usuário logado nem para "todos". Só o papel do motor recebe acesso, dado por extenso. As poucas funções que o app chama ganham o prefixo `v2_`, cada acesso é dado e tirado por extenso, e todas chamam a mesma conferência compartilhada de quem chama (você ou o motor). Assim, ninguém escreve uma guarda à mão em cada função.
- **Teste de catálogo.** Uma consulta só de leitura ao catálogo do banco falha se:
  - alguma parte da v2 estiver aberta para fora;
  - uma tabela exposta estiver sem a proteção por linha;
  - um acesso padrão novo for dado à chave pública;
  - uma função aceitar a chave pública fora da lista;
  - aparecer uma pasta de arquivos pública fora da lista.

  Na v1, o teste compara com a fotografia do inventário e só acusa o que for novo ou diferente, para não ficar vermelho para sempre. Ele roda a cada mudança no banco, num Supabase local montado no GitHub, e toda semana na produção, antes e depois de 30/10/2026.
- **Funções fora do banco, sem token no GitHub.** No GitHub, um teste lê a configuração e falha se alguma dessas funções aceitar chamada sem login fora da lista. Na produção, o teste usa a mesma chave pública que o app já usa: chama cada função conhecida sem login e espera recusa, e confere que o cadastro de contas novas está desligado. Nenhum token da conta do Supabase vai para o GitHub. Limite assumido: uma função criada fora do repositório só aparece num inventário novo.
- **Inventário da v1, só leitura.** Ele cobre as 61 tabelas (dono, proteção por linha, acessos e qual tela usa cada uma), os acessos padrão, as funções, as Edge Functions e as pastas de arquivos. O que não tiver dono vira uma única pergunta agrupada, já com a resposta recomendada: "fica fechada para a chave pública; nada é apagado". Junto vêm duas perguntas:
  - onde está o código do receive-leads;
  - se ainda existe o projeto Supabase antigo que aparece num arquivo de configuração já apagado do repositório. Ele só tinha a chave pública, então o risco é baixo.
- **Nenhuma mudança de acesso na v1** acontece sem o inventário, sem o script de volta testado e sem a sua frase daquele passo. Quem executa é você, no editor SQL.

Isso reduz a chance de um acesso ser reaberto sem ninguém ver, erro que a v1 repetiu, e protege os dados pessoais das pessoas recrutadas (LGPD).

### Quem escreve no repositório (novo na v3.1)

Escrevem no repositório pelo menos:
- o robô do Lovable, com 255 mudanças (a última em 23/09) e sincronização nos dois sentidos;
- o Codex, com 90;
- o Cursor, com 9;
- o Antigravity;
- as minhas sessões, que aparecem com o autor "Rafael".

A main foi recriada em 30/09, e o Lovable pode continuar ligado a ela. Os avisos automáticos do repositório para fora e as chaves de publicação dele estão NÃO CONFIRMADOS. Pode existir uma cópia do app publicada no Lovable, fora da varredura. Com a chave do banco no histórico até o fim dos testes, quem lê o repositório lê o banco.

- **Uma pergunta: você ainda usa o Lovable?** Se não usa: desligar a sincronização dele com o GitHub, tirar do ar a cópia publicada e revogar o acesso dele no Supabase, sem apagar os dados. Se usa: a edição visual continua num repositório só de rascunho, sem acesso à main.
- **Revisão de apps e tokens.** Nas telas do GitHub, você revisa os apps instalados, os apps autorizados e os tokens, remove o que não usa e marca "Only select repositories" (só os repositórios escolhidos). Nenhum app ganha permissão de mexer nas rotinas automáticas (workflows). Você me manda só os nomes, nunca os valores.
- **Três cliques em Settings > Actions.** Ligar a exigência de ações fixadas pela impressão digital completa, deixar as permissões das rotinas em "só leitura" e deixar desligada a criação de pedidos de mudança pelas rotinas.
- **Login do Supabase.** Ele só aceita voltar para o endereço do app.
- **Lista de plataformas conectadas.** A lista de chaves ganha a seção "plataformas conectadas", com nome, dono, uso e data da última conferência.
- **Cada mudança diz qual ferramenta a fez:** Codex, Cursor, sessão Claude ou "fundador", quando é você. Autor desconhecido acende vermelho e abre um aviso. Isso é rastreio, não trava, porque o nome do autor de uma mudança pode ser inventado.

### No GitHub, a sessão é você (mudou na v3.1)

A sessão de IA entra no GitHub com o seu login, como administradora. No plano grátis (o plano da sua conta: NÃO CONFIRMADO), repositório privado não tem ambientes protegidos nem revisão obrigatória, e a main está sem proteção. Para o GitHub, quem dispara uma rotina é a mesma pessoa, seja você ou a sessão. Por isso, a trava da v3 ("um botão no GitHub que só você aperta, e o acesso das minhas sessões não consegue mudar esse caminho") não se sustenta. A própria v3 previa o plano B: se o teste 11 não provasse a trava, o botão passaria para o EasyPanel. A v3.1 adota o plano B desde já.

- **Regra escrita.** No GitHub, sessão = você. Nenhuma credencial que mude a produção fica no GitHub: nem a senha de mudança do banco, nem o endereço de publicação, nem o acesso ao EasyPanel. O GitHub só testa e monta a imagem de cada serviço.
- **Publicar é o seu toque no EasyPanel.** Você cola a impressão digital (digest: código único da imagem, que muda se um único byte mudar) de uma imagem que passou nos testes. A mudança do banco roda quando a versão nova liga, com uma credencial que só existe no EasyPanel. O caminho completo, com a volta, está em "Manutenção" e é construído e ensaiado no começo da fase 2. Dois pontos estão NÃO CONFIRMADOS: se o EasyPanel aceita a impressão digital no campo da imagem e se ele tem verificação em duas etapas. O ensaio da fase 2 decide. Se ele não aceitar a impressão digital, a saída é uma etiqueta única por versão, nunca uma etiqueta que muda de lugar.
- **Publicação automática desligada.** Antes de qualquer junção na main, você confere no EasyPanel se algum serviço publica sozinho a partir do GitHub (NÃO CONFIRMADO). Se algum publicar, a publicação automática é desligada, com a sua frase, porque com ela ligada uma sessão publica sem o seu toque.
- **Os testes do GitHub protegem contra erro, não contra uma sessão desviada.** Toda checagem automática (gitleaks, auditoria das rotinas, conferência do plano, receitas e montagem da imagem) é um aviso que a própria sessão consegue mudar. A trava real é o seu login no EasyPanel, que nenhuma sessão tem.
- **Exceção conhecida até a troca das chaves.** A chave de acesso total está no histórico do repositório. Uma rotina do GitHub escrita por uma sessão desviada conseguiria usar essa chave para mudar o banco sem o seu toque. Esse risco está aceito na decisão de 10/10, e a troca no fim dos testes fecha essa porta. Até lá, o item "nenhuma credencial de produção no GitHub" aparece no teste 11 como risco aceito, nunca como verde.
- **Cartão de decisão: uma conta separada para as sessões (novo na v3.1).**
  - **A) Como está.** No GitHub, sessão = você, e a trava fica no EasyPanel. Não há nada novo para gerenciar. **Recomendado por enquanto**, porque a trava de publicar já não depende do GitHub.
  - **B) Uma conta separada, sem papel de administrador, só para as sessões.** Ganho: a sessão perde o poder de mudar as configurações do repositório. Limite: no plano grátis, repositório privado não tem proteção de ramo, então quem envia código ainda consegue mudar os testes. As regras de ramo exigem um plano pago do GitHub (preço NÃO CONFIRMADO), e nem elas separariam vocês dois enquanto a sessão for administradora. Custo: mais uma conta, com verificação em duas etapas e dois caminhos de volta.
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

### A central da v1: clientes no WhatsApp e ligações por IA (novo na v3.1)

O que segue foi lido no código da v1, numa cópia do ramo `antigravity-planos` de 09/10/2026. O gateway sobe por zip, então a versão no ar pode ser outra (NÃO CONFIRMADO).

- **URA de clientes no WhatsApp** (`whatsapp-ura.mjs`; URA é o atendimento automático por menu). Quem manda "oi" recebe um menu em nome da Helena, "assistente virtual", com quatro opções:
  1. Vendas (Victor);
  2. Suporte (Joana);
  3. Financeiro (Caio), que pede CPF, CNPJ ou o número da fatura;
  4. Atendimento executivo (Marina).

  Cada mensagem de cliente é gravada no banco com o número e o texto e passa pela classificação do serviço Laya. Ela vira uma tarefa pronta para o agente da opção, com o nome, o número e a mensagem do cliente dentro da instrução, e o cliente recebe uma resposta automática.
- **Ligações de saída por IA** (`meowcaller.mjs` e a rota de ligação do gateway). O sistema liga para qualquer telefone informado, com voz sintética do Google, e registra a ligação no banco. Pelo código lido, essa rota só confere se quem chama tem um login válido, a senha fixa do gateway ou a de um perfil do Hermes. Ela não confere se é você, ao contrário das telas de configuração da voz, que conferem. Somado ao cadastro de contas aberto, isso pode deixar uma pessoa de fora criar uma conta e disparar ligações.
- **Voz com API paga.** A voz usa a API paga da OpenAI (transcrição e conversa) e pode usar também ElevenLabs, xAI e Google (ver "APIs pagas da v1").

Isso importa por quatro motivos:
- é contato com pessoas de fora feito por IA, que o sistema nunca deveria fazer sem o seu toque;
- o texto do cliente vira instrução de agente;
- o banco guarda dados pessoais de clientes (telefone, nome, CPF ou CNPJ), o que envolve a LGPD;
- a v3 travava o WhatsApp no seu número, o que desligaria a URA sem aviso para os clientes.

**A sua decisão de 10/10 é desligar a central.** Desligar mexe no ar, então segue esta ordem:
1. **Inventário só de leitura** do que a central faz hoje: quantas mensagens de clientes chegam por semana, quais conversas estão em aberto, quantas ligações foram feitas, que número e que marca o canal usa, quais dados de clientes estão guardados e se existe outro caminho de ligação.
2. **A ligação de saída fecha primeiro,** com a sua frase, porque não depende de avisar clientes. O jeito com volta é parar o serviço de ligações no EasyPanel, que religa com um clique. Tirar só a variável não basta, porque o código tem uma senha de reserva escrita.
3. **Aviso aos clientes.** Eu escrevo o texto, e você aprova e envia, ou escolhe quem envia. Nenhum agente envia.
4. **Com os clientes avisados, a sua frase desliga a URA.** Na prática, é a mesma mudança que trava o WhatsApp no seu número: mensagem de outro número deixa de virar tarefa e de receber resposta automática. Ela continua visível no próprio WhatsApp daquele número. Como você usa esse número hoje está NÃO CONFIRMADO, e o inventário responde.
5. **O checklist da v1** passa a conferir que a URA e as ligações continuam desligadas.
6. **Os dados de clientes já gravados ficam onde estão,** fechados ao acesso público. Nada é apagado sem decisão sua. O que se guarda, por quanto tempo e como se apaga entra no mesmo cartão de LGPD da primeira meta.

Se um dia as ligações de saída voltarem, cada uma só acontece com o seu toque, pela máquina de ação externa (abaixo). Nunca por um agente e nunca por qualquer login.

### APIs pagas da v1 (novo na v3.1)

Quando existe a variável da chave da OpenAI, o gateway da v1 chama a API paga dela na voz, em 4 arquivos. Ele também chama xAI, ElevenLabs, Google Cloud e TypeSafe, e o app ainda lista RunPod, Gemini e Whapi. Não achamos nenhuma exceção escrita à DEC-014 (sem API paga da OpenAI nesta fase). Trocar a chave da OpenAI sem saber disso pode derrubar ligações. E o teste 6 (processador abaixo de 70%) não tem uma medida de partida.

Na 0a, só leitura:
- você cola os nomes das variáveis de cada serviço do EasyPanel, nunca os valores, e informa o gasto do mês de cada serviço pago;
- medimos o processador e a memória de cada contêiner por 24 horas, com a v1 sozinha, e isso vira a linha de base do teste 6;
- contamos quantas execuções a v1 faz por dia;
- você confirma no ChatGPT que o saldo de créditos é zero e que a recarga automática está desligada.

Depois, você recebe um cartão por serviço, com três opções: desligar, manter como exceção escrita com teto ou manter só para teste. A voz da v1 entra no cartão da central: até o desligamento, mantê-la como exceção escrita com teto ou desligá-la já. Os limites de contêiner entram um serviço por vez, cada um com a sua frase, sem limite rígido no WhatsApp e na voz enquanto eles existirem. Um teste semanal falha se a chave da API da OpenAI ou do AI Gateway aparecer sem decisão escrita. O motor da v2 não liga se achar chave de API paga no ambiente.

### Contas com dois caminhos de volta (mudou na v3.1)

Com a verificação em duas etapas, perder o celular tranca você fora, e o GitHub e o Supabase dizem que não devolvem o acesso. A v3 esquecia o e-mail principal, o ChatGPT, o Telegram e o healthchecks.

- **Contas cobertas.** A verificação em duas etapas com dois caminhos de volta vale para:
  - o e-mail principal;
  - o GitHub;
  - o Supabase, com o segundo fator em outro aparelho, porque ele não tem códigos de recuperação;
  - o EasyPanel, se ele oferecer a verificação (NÃO CONFIRMADO);
  - a Hostinger;
  - o ChatGPT;
  - o Telegram.

  O healthchecks entra quando for criado, na 0b.
- **Códigos de recuperação.** Ficam impressos e guardados em dois lugares. O SMS nunca é o único caminho.
- **`contas.yaml` só com rótulos.** Para cada conta: dono, tipo de verificação, lugar dos códigos descrito de forma genérica (como "cofre físico"), o que para se a conta se perder e quem avisa. Nunca e-mail, telefone ou código.
- **Nenhuma conta nova sem linha na lista.** Um teste falha se o plano citar uma conta que não está nela.
- **Avisos por e-mail.** Um filtro no e-mail separa os avisos, e o cartão de diagnóstico mostra a data do último aviso de cada remetente.
- **Revisão e ensaio.** A lista é revista a cada 3 meses. Antes do portão da fase 2, há um ensaio de entrar nas contas com o celular principal desligado.
- **Quem faz:** você, em 1 a 2 horas. Eu monto a lista e o teste.

### Portão 0a (mudou na v3.1)

A 0a só fecha com tudo isto conferido por teste, nunca por data:
- a varredura de fora mostra só as portas previstas, e a checagem de invasão saiu limpa, ou a contenção que você escolheu foi feita;
- a cópia completa existe, criptografada, e a restauração bateu nas contagens;
- as funções e as tabelas da lista recusam a chave pública e um usuário de fora, o cadastro de contas está desligado, o modo de teste foi apagado e o papel antigo de fundador saiu;
- nenhum serviço publica sozinho a partir do GitHub;
- a ligação de saída está fechada, a URA foi desligada depois do aviso aos clientes, e o WhatsApp só aceita o seu número, com a senha;
- chaves, conforme a sua decisão de 10/10: os 11 arquivos leem variável, a lista de chaves existe sem valores, o risco aceito está escrito com a data de revisão, e a varredura não acha chave nova. Se você decidir trocar agora, o item vira "a chave antiga é recusada de fora";
- quem escreve no repositório está listado, e os apps só veem os repositórios escolhidos;
- a verificação em duas etapas tem dois caminhos em cada conta da lista;
- o seu login continua funcionando, e o checklist da v1 ficou igual ou melhor depois de cada passo;
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
- varredura de fora de todas as portas e domínios;
- cada função chamada com a chave pública e com um usuário de fora;
- teste de catálogo;
- as Edge Functions chamadas sem login;
- o cadastro de contas conferido como desligado;
- páginas plantadas com endereços internos, imagens e instruções invisíveis;
- a mesma mensagem do WhatsApp 10 vezes, inclusive forjada, e uma mensagem de outro número, que não cria nada;
- a rota de ligação recusando;
- a montagem do app sem variáveis falhando;
- a varredura de segredos verde.

Saiu do teste 11 a linha "o acesso das minhas sessões tentando publicar". No lugar entram duas: nenhuma credencial que mude a produção no GitHub, e só o Deploy do EasyPanel mudando a versão no ar. Até a troca das chaves, a primeira aparece como "risco aceito por decisão sua de 10/10", nunca como verde, porque a chave antiga está no histórico do repositório.
