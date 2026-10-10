## Manutenção sem depender do seu PC

Hoje só o seu PC alcança o banco, e isso trava a manutenção quando ele está desligado. (mudou na v3.1: no PC, o Windows passou a bloquear o programa do Supabase, e as sessões de IA na nuvem recebem recusa ao tentar chegar ao banco.) Na v2, o código, as fichas e os testes passam pelo GitHub, que qualquer sessão minha alcança. A produção só muda pelas suas mãos: no EasyPanel, quando você publica, e no editor SQL do Supabase, nos passos da fase 0. (mudou na v3.1: antes, publicar era um botão no GitHub.)

### O GitHub protege contra erro, não contra uma sessão desviada

(mudou na v3.1) A v3 contava com uma trava no GitHub: um botão de publicar que as minhas sessões não conseguiriam apertar. Essa trava não existe. A sessão de IA entra no GitHub com o seu login, como administradora, e no plano grátis um repositório privado não tem ramo protegido, ambientes nem aprovação obrigatória. Para o GitHub, você e a sessão são a mesma pessoa.

- **Os testes do GitHub protegem contra erro, não contra uma sessão desviada.** A varredura de senhas, a auditoria dos workflows (as rotinas automáticas do GitHub), a conferência do plano, as receitas e a montagem da imagem são avisos que a própria sessão consegue mudar. Eles pegam engano; não seguram quem quer contornar.
- **Nenhuma credencial que mude a produção fica no GitHub.** Nem a senha de mudar o banco, nem o endereço de publicar do EasyPanel, nem o login, o token de API ou o MCP do EasyPanel; e nenhum deles é ligado a uma sessão de IA. No repositório principal ficam só duas credenciais, as duas de leitura, numa lista fechada: o papel do banco que lê apenas a tabela de números do diagnóstico e a chave só de leitura do healthchecks.io. A cópia completa do banco fica no `helena-backup`, fora do alcance das IAs. (mudou na v3.1: o teste 11 deixa de conferir que "as sessões não mudam workflows", o que nunca seria verdade, e passa a conferir essa lista, pelos nomes, nunca pelos valores.)
- **O que segura a produção** é o seu toque no EasyPanel e no editor SQL, o banco recusando qualquer passagem fora da tabela e o motor se recusando a ligar com acesso de administrador.
- **Cartão de decisão: uma conta só para as sessões** (novo na v3.1).
  - A) Seguir como hoje, com as sessões no seu login. O risco fica escrito.
  - B) Criar uma conta do GitHub só para as sessões, colaboradora no repositório principal, sem administração e sem acesso ao `helena-backup`. Ganho: as sessões deixam de poder mudar as configurações do repositório (permissões do Actions, chaves de acesso, colaboradores) e de apagar o repositório. O que não muda: no plano grátis, elas continuam podendo enviar código e workflows para a main. Custo: o seu tempo para criar a conta, ligar a verificação em duas etapas e reconectar os apps das IAs (NÃO CONFIRMADO quanto tempo leva).
  - Recomendação: B, depois do portão 0a, se um ensaio mostrar que as sessões trabalham normalmente com a conta nova. Sem resposta, fica A, e nada trava enquanto isso.

### Publicar e voltar

- **Publicar é o seu toque no EasyPanel** (mudou na v3.1: antes, era um botão no GitHub que movia um ramo de produção). O GitHub só testa e monta a imagem (o pacote pronto do programa), sem nenhuma senha. O caminho tem quatro passos:
  1. Eu junto as mudanças e mando um pedido só, no máximo uma vez por dia, com: o que muda, o número da autorização (AUT), os testes que passaram, as prévias das telas, a impressão digital da imagem nova e a da imagem que está no ar, para voltar. A impressão digital (digest) é um código único que identifica uma imagem e não muda.
  2. No app, você toca "Preparar publicação". A fila pausa e, quando esvazia, o app mostra "pode publicar". É a mesma pausa do botão "Pausar tudo", que se desliga sozinha em 20 minutos. Enquanto a tela nova do app não existe (começo da fase 2, com o motor de ensaio), não há fila para esvaziar, e este passo é pulado.
  3. No EasyPanel, pelo celular, você cola a impressão digital no campo da imagem e toca Deploy.
  4. A versão nova se confere e leva um card de ensaio até o fim, sem gastar cota. O app e o cartão de diagnóstico mostram a versão no ar (o código do commit gravado dentro da imagem); ela precisa ser a do pedido, e o cartão avisa se não for a última aprovada.
- **Imagem montada uma vez, fora da VPS** (mudou na v3.1: antes, cada versão era montada na própria VPS). O GitHub monta a imagem só do serviço que mudou e só quando eu peço a publicação, e roda os testes dentro da própria imagem montada. A imagem fica no registro privado de imagens do GitHub (GHCR), e a impressão digital aprovada fica anexada a uma versão do GitHub que não pode ser alterada (release imutável). No EasyPanel, o campo da imagem recebe sempre a impressão digital, nunca uma etiqueta que pode ser regravada, e a publicação automática fica desligada. Vale para o motor, o servidor de ferramentas e o app da v2; o gateway da v1 continua por zip até a troca.
- **O que o seu toque garante, e o que não garante** (novo na v3.1). Ele garante quando e qual imagem vai ao ar. Sozinho, não garante que o conteúdo da imagem é bom, porque quem escreve o código e os testes são as sessões. O conteúdo é protegido pelos testes da versão candidata (contra erro), pela revisão independente no portão de cada fase e pelas travas do banco. Por isso o plano diz "está no ar a imagem que passou no teste da versão X", e não "está no ar exatamente o que foi testado".
- **Voltar é colar a impressão digital anterior** (mudou na v3.1: antes, a versão anterior voltava sozinha). Sem nenhuma credencial de produção fora do EasyPanel, nada consegue publicar sozinho, nem para voltar. Se a versão nova falhar na própria conferência (banco certo, caminho certo, acesso limitado, sinal de vida e card de ensaio), ela não abre a fila, nenhum card se perde, a pausa continua, e você recebe em até 10 minutos: "publicação falhou: no EasyPanel, cole a impressão anterior e toque Deploy", com a impressão pronta para copiar. Voltar não monta nada. O tempo da volta é medido no ensaio, sem promessa, e o teste 4 passa a medir esse tempo no lugar da volta sozinha.
- **Mudança no banco dentro da publicação** (mudou na v3.1: antes, o botão do GitHub aplicava a mudança com um acesso guardado lá). A partir da fase 2, a mudança no banco vem dentro da imagem e roda ao ligar, antes do motor:
  - sem mudança pendente, vai direto ao motor, e um reinício comum nunca exige fila vazia;
  - com mudança pendente, exige a pausa ligada e a fila vazia, pega a trava única do motor, guarda a cópia das tabelas tocadas e aplica, e a mudança só acrescenta;
  - se falhar, grava "mudança X falhou", não tenta de novo em laço e avisa você.

  A credencial dessa mudança existe só no EasyPanel. Depois de aplicar, o programa a descarta e passa ao motor sem ela, e os agentes rodam com outro usuário do sistema, sem enxergar o ambiente do motor; o teste 11 confere. Na fase 0, antes de existir motor, quem roda cada SQL é você, no editor SQL, com o script e o caminho de volta prontos (ver "Antes de mexer no banco").
- **Se a pausa vencer antes do Deploy** (novo na v3.1). Uma versão que muda o banco ou o desenho de um fluxo do motor só liga com a pausa ligada e a fila vazia. Se não estiver assim, ela não pega trabalho, as etapas esperam sem se perder (o teste 4 confere), e o app pede que você toque de novo em "Preparar publicação".
- **Ensaios antes do portão da fase 2** (novo na v3.1). Antes de construir em cima, cada ponto abaixo é conferido, com o resultado escrito:
  - se o EasyPanel aceita a impressão digital no campo da imagem (NÃO CONFIRMADO);
  - se um reinício (Restart) puxa de novo uma etiqueta regravada;
  - se o EasyPanel tem verificação em duas etapas (NÃO CONFIRMADO; se não tiver, o risco fica escrito e a senha é única e longa);
  - se o Deploy funciona pelo celular;
  - a volta, cronometrada no seu celular.

  Se o EasyPanel não aceitar a impressão digital, cada versão ganha uma etiqueta única que o workflow se recusa a reusar (isso é conveniência, não trava, porque a sessão pode mudar o workflow), e o cartão de diagnóstico compara a versão no ar com a última aprovada; diferença vira aviso.
- **A chave de puxar imagens** (novo na v3.1). Para o EasyPanel baixar uma imagem privada do GHCR, você cria uma vez um token clássico do GitHub só com permissão de ler pacotes e cola no EasyPanel. Ele entra na lista de chaves, com validade e aviso 30 dias antes de vencer. Se vencer, a publicação falha fechada e o que está no ar continua. Risco aceito e escrito: esse token lê todos os pacotes privados da sua conta. O GHCR é grátis hoje, com aviso de pelo menos 1 mês antes de mudar; se passar a cobrar, a escolha volta para você.
- **O EasyPanel fora das IAs** (novo na v3.1). O EasyPanel tem API e MCP próprios. Nenhum dos dois é ligado a uma sessão de IA, e o token deles nunca vai para o GitHub.
- **O motor confere a própria ligação.** Ao ligar, o motor confere que está no Supabase certo, pelo caminho certo e com o acesso limitado dele, nunca com o de administrador, e testa os avisos internos do banco que o DBOS usa, que só chegam pelo caminho certo. Sem o endereço do banco, o DBOS usaria um banco local sem avisar, e tudo se perderia na publicação seguinte; por isso, se algo não bater, o motor não liga e avisa. Ele usa poucas conexões, para caber no limite do plano. E só um motor roda por vez: o motor só liga o DBOS depois de pegar uma trava única no banco, que o antigo segura enquanto vive, então, se o novo nascer antes de o antigo parar, ele espera. Sem isso, o DBOS gratuito retomaria no motor novo o que o antigo ainda está fazendo. (mudou na v3.1: antes, a publicação parava o antigo antes de ligar o novo; agora quem para é o EasyPanel, e a ordem em que ele faz isso não foi conferida, por isso a trava cobre os dois casos.)
  - (novo na v3.1) **Teste que bloqueia o portão da fase 2:** derrubar o motor à força, sem desligar direito, e conferir que a trava única se solta e que o motor seguinte liga sozinho, num tempo medido, pelo mesmo caminho do pooler de sessão (a porta de entrada do Supabase que o motor usa). Hoje é NÃO CONFIRMADO que uma trava pega por esse caminho se solta quando o motor cai. Se o teste falhar, a fase 2 não avança até a trava mudar (por exemplo, para uma reserva com prazo, renovada pelo motor vivo) e o teste passar.
  - (novo na v3.1) O motor também não liga se encontrar no ambiente dele ou do Hermes uma chave de API paga (OPENAI_API_KEY, AI_GATEWAY_API_KEY ou VERCEL_*). Assim nenhuma cota paga é gasta sem ninguém ver (DEC-014).

### Uma fonte da verdade

- **Repositório privado no GitHub.** Código, fichas, roteiros, regras, receitas do mantenedor e o roteiro de restauração ficam lá, com versão. (mudou na v3.1: o repositório já existe; o seu passo é conferir, não criar.) O que não cabe no GitHub (variáveis do EasyPanel, tarefas agendadas do Supabase, ajustes do WhatsApp) tem uma lista com o retrato de cada item. (mudou na v3.1: a conferência semanal agora é feita pelo cartão de diagnóstico no que o código alcança, como impressão digital: os nomes das variáveis que o motor recebeu, nunca os valores, e os nomes e horários das tarefas agendadas. O que o código não alcança, como os ajustes da Evolution API, é conferido no portão de cada fase, com um print seu dentro da mensagem única.)
- **Uma main só, o resto arquivado** (novo na v3.1). Hoje há 33 ramos (versões paralelas do código), 17 deles sem nenhuma base comum com a main, e circulam duas frases de aprovação diferentes.
  - **Antes de qualquer junção**, você confere no EasyPanel, serviço por serviço (helena-gateway, app, laya-service e meowcaller-service), de onde cada um publica e se a publicação automática está ligada, e manda um print. O README do gateway diz que ele publica a partir da main. Se algum serviço publicar sozinho a partir da main, juntar na main é publicar: a junção só acontece depois de você desligar a publicação automática, o que o plano quer de qualquer jeito, ou com a sua frase de nível 2.
  - Um PR (pedido de mudança) traz o pacote do plano e a pasta `helena-v2/` para a main, sem mover arquivos. O plano antigo vai para o histórico com a linha "SUBSTITUÍDO POR". Uma checagem de "fonte única" acusa uma segunda frase de aprovação, um segundo LEIA-PRIMEIRO ou HANDOFF fora do histórico, ou um arquivo que cite o plano antigo.
  - Cada ramo ganha uma etiqueta de arquivo (`arquivo/2026-10-10/<ramo>`) antes de ser apagado, em duas rodadas e só depois do seu OK. Primeiro, os que já estão inteiros na main e os sem base comum. Depois, `antigravity-planos`, `missao-cumprida-v4` e `fix/helena-entrada-tarefas-20261005`, só depois da conferência do gateway e das migrations. O PR #5 é decisão sua.
  - A lista das etiquetas, com o código de cada uma, fica em `docs/estado/ramos-arquivados.md`. Como no plano grátis as etiquetas não são protegidas, uma checagem semanal confere que elas continuam no mesmo lugar, e o espelho semanal do código no `helena-backup` guarda as etiquetas também.
  - Arquivar não tira as chaves antigas do histórico do código. Isso só se resolve com a troca das chaves, que você decidiu fazer no fim dos testes; até lá vale o risco aceito, escrito na seção de segurança.
- **Onde mora cada coisa** (novo na v3.1). Cada informação tem um lugar só e um dono:

| O quê | Onde mora | Quem muda, e como | Precisa publicar? |
| --- | --- | --- | --- |
| Trabalho: caixa de entrada, cards, etapas, execuções e histórico | Supabase, tabelas da v2, num esquema próprio | Só o motor, pelas funções do trilho; o app grava só por elas | Não |
| Decisões suas | Supabase, na `public.decisoes`, que já existe; antes de usar, conferir se ela serve (JÁ EXISTE ou PARCIAL), para nunca haver duas tabelas de decisões | Você, por toque no app, pela letra da opção ou por "OK" com o código curto | Não; vale na hora |
| Preferências "vale sempre" e regras "nunca" | Supabase, com versão | Você, pelo botão no card, depois da checagem de contradição | Não; vale para execuções novas |
| Lições e exemplos de ouro | Supabase, com versão e as situações proposta, testada, ativa e aposentada | O motor grava só a proposta; ela fica ativa depois da bateria e do seu toque, em lote | Não |
| Valores das checagens, como o teto de orçamento ou a lista de termos proibidos | Supabase, como decisão ou treino | Você, no app | Não |
| Especificação: organograma, catálogo de serviços, fichas, roteiros, modelos de entrega, tabela de passagens e catálogo de modelos | `helena-v2/`, no GitHub; os personagens do produto eLiving™ (Sirlene, Doutor Vital, Alex e Rafael) ficam numa pasta própria, fora do organograma | PR, testes e publicação; vale a versão que está no ar (o commit dentro da imagem), e o banco guarda uma cópia com impressão digital; se divergir, o motor não liga | Sim |
| Construção: plano, registro de furos, receitas, roteiro de restauração, autorizações e lista de chaves sem valores | `docs/`, no GitHub | PR | Não |
| Estado da construção | `docs/estado/construcao.md` | Toda sessão, no fim | Não |
| Arquivos gerados: perfis do Hermes, cópia da especificação no banco, registro de furos em texto e cartão de diagnóstico | Onde o gerador põe | Só o gerador, nunca à mão | Não se aplica |
| Backup do banco e espelho do código | `helena-backup` | Só os workflows que você colou lá | Não se aplica |
| Histórico | `docs/historico/` para o que for novo; os arquivos da v1 citados pelo AGENTS.md ficam onde estão | Não muda mais | Não se aplica |

  - **Tipo é especificação, valor é decisão.** A checagem "orçamento até o valor da decisão vigente" muda por PR; o valor muda pelo app, sem publicar. O conferidor de termos é especificação; a lista de termos é treino.
  - **Cada execução grava o que usou:** o commit, a impressão digital da ficha e os números das decisões, preferências, regras, lições e exemplos ativos. Mudar o treino vale para execuções novas e não refaz entrega aprovada.
  - **Quando uma lição vira ficha,** a mesma publicação aposenta a lição; as duas nunca ficam ativas ao mesmo tempo.
  - **Precedência no AGENTS.md:** a ordem para a v2 (estado real, decisões vigentes, especificação publicada e treino ativo, documentos de construção, histórico) só entra no AGENTS.md depois da primeira publicação da v2 e com o seu OK de nível 1. Se o banco divergir da especificação publicada, a sessão informa "ESPECIFICAÇÃO REQUER SINCRONIZAÇÃO" e não corrige em silêncio.
- **Plano conferido por máquina** (novo na v3.1). O texto continua sendo o que você lê. Ao lado dele, no mesmo pacote, ficam três arquivos de dados: `fases.yaml` (o que cada fase constrói, os testes do portão, os seus passos e a aprovação registrada), `testes.yaml` (cada teste com número, fases, onde roda e "passa quando") e `furos.yaml` (cada furo com conserto, testes, fase e situação). O registro de furos em texto e o desenho das fases passam a ser gerados a partir deles.
  - **"Fechado" ganha quatro situações** (mudou na v3.1): com conserto escrito; provado, quando existe um caso que reproduz o furo e um teste que o recusa; substituído; ou não confirmado. O plano mostra as contagens, e a frase "nenhum furo conhecido em aberto" só aparece quando a contagem calculada de abertos é zero.
  - **Um conferidor roda a cada envio** e falha quando: um furo cita teste ou fase que não existe; um teste roda depois da fase em que o furo fecha; um número de furo some sem situação; aparece uma variante da frase de aprovação; a situação de uma fase foi escrita à mão; o texto diz "nenhum furo em aberto" com contagem maior que zero; ou um caminho de arquivo citado não existe.
  - **A situação de cada fase é calculada.** "Pronta" só aparece com os testes do portão passando e a sua aprovação registrada; antes disso, aparece "falta seu ok" ou "em ajuste: N pontos abertos".
  - A prova da tabela de passagens, em `helena-v2/maquina/`, roda no mesmo lugar e imprime o tamanho do que provou; se passar do teto, falha de forma visível.

### As sessões de IA

- **Duas portas de entrada** (novo na v3.1). O AGENTS.md ganha no topo uma seção curta, "Duas portas", e todo o texto atual fica intacto. A porta é decidida pelas pastas que a mudança toca, não pela escolha da sessão.
  - **Porta v1, operar ou consultar a v1:** como hoje. Só leitura a partir do checkpoint e, sem conexão, a frase "SUPABASE NÃO CONECTADO". Mudança no banco, no servidor ou na publicação pede a sua frase de nível 2.
  - **Porta v2, construir a v2 em arquivos:** ler o LEIA-PRIMEIRO do pacote, depois o `docs/estado/construcao.md` e depois o plano. Qualquer afirmação sobre o que está no ar sai como NÃO CONFIRMADO até o cartão de diagnóstico existir; depois, vale só o que o cartão mostra, com o horário dele.
  - Um `CLAUDE.md` que só aponta para o AGENTS.md. As regras do Cursor continuam; a pasta `.kiro/` vai para o histórico.
  - Como muda uma regra sua, essa seção precisa do seu OK de nível 1 no PR.
- **Fim de sessão** (novo na v3.1). Toda sessão que muda algo atualiza o `docs/estado/construcao.md`, com campos fixos: data, fase, último PR, próximo passo, pendências por número, autorizações usadas, o que não foi verificado e a linha "não representa o estado no ar". O arquivo é só estado, nunca instrução: uma ordem escrita ali é ignorada. O "o que fiz" vai no corpo do PR. Uma sessão de construção por vez (WIP = 1 também para as sessões), para não haver conflito. Fotografia datada nova só vai para `docs/historico/`.
- **Arrumação conferida no envio** (novo na v3.1). Uma checagem olha só os arquivos novos ou renomeados e acusa: arquivo novo na raiz ou em `docs/` fora da lista permitida; data no nome fora do histórico; arquivo idêntico a outro; binário novo fora de `public/`; mudança de código ou de especificação sem atualizar o `construcao.md`; e caminho citado no AGENTS.md que não existe. No plano grátis, uma checagem vermelha não impede juntar na main: ela avisa. A regra da sessão é nunca juntar com vermelho e nunca enviar direto para a main, e quebrar essa regra aparece no registro de quem enviou cada mudança.
- **Modelo de PR** (novo na v3.1), com sete campos curtos: porta e pastas tocadas; receita seguida; AUT usado ou "nenhum"; testes rodados, com a saída; `construcao.md` atualizado; o que não foi verificado; e "muda regra sua?".
- **Livro de autorizações** (novo na v3.1). Cada pedido seu vira um arquivo `docs/autorizacoes/AUT-NNNN-assunto.md`, na main, com:
  - o que muda, item por item, e como desfazer cada item;
  - quem executa: você no editor SQL, você no EasyPanel ou a imagem ao ligar;
  - a pré-condição, ou seja, o estado real que precisa ser verdade antes, conferido só por leitura;
  - a versão congelada: o código do commit e a impressão digital de cada arquivo coberto;
  - a frase pronta, com o número, e a situação: pendente, concedida, usada, interrompida, desatualizada ou recusada.

  Nenhum valor de chave entra num AUT: só nomes e locais.
- **A sua frase tem dois níveis** (novo na v3.1):
  - **Nível 1, texto.** Aprova um texto numa versão: o plano, um roteiro, as fichas ou uma regra do AGENTS.md. Vale enquanto aquela versão existir e não autoriza mexer no banco nem no servidor. A sua aprovação do plano v3.1, com a frase que fica escrita uma vez só em "O que preciso de você", é registrada como AUT-0001 e põe o livro para valer.
  - **Nível 2, mudança.** Autoriza uma mudança no banco, no servidor, no EasyPanel, nas chaves, ou uma publicação. Formato: "autorizo AUT-0007: criar o papel de leitura do backup, versão 1a2b3c4". Itens que o texto anterior tratava como "sem frase" passam a pedir o nível 2 quando gravam no banco, como guardar as 50 mensagens do conjunto-ouro e criar a tabela de regras do treino.
- **A autorização não vence por data** (mudou na v3.1: a proposta anterior vencia em 7 dias). Ela vale até ser usada. Repetir a mesma versão sobre o mesmo estado, depois de uma tentativa que falhou, não pede frase nova. Só se pede de novo, mostrando o que mudou, quando mudam a versão, o estado conferido ou o escopo. Se uma autorização ficar parada por muito tempo, a sessão só reconfere o estado antes de usar. É o que o AGENTS.md já manda: o que você autorizou não se pede de novo para a mesma ação.
- **Comando direto seu vale como autorização (DEC-022).** Criar empresa, conta ou entidade: a sessão abre o AUT já como usado, com as suas palavras, sem pergunta a mais, e a gravação na tabela de destino (empresas em `public.portfolio`) acontece na hora pelo caminho que alcança o banco: hoje, você no editor SQL com o script pronto, ou uma sessão que alcance o banco.
- **Execução item a item.** Se um item falhar, a sessão para, confere o que foi e o que não foi aplicado, desfaz o que o "como desfazer" mandar e marca "interrompida". Para continuar: "continuo AUT-NNNN".
- **O livro registra, não trava.** Quem escreve no repositório pode forjar uma linha, e isso fica escrito no topo do livro. As travas continuam sendo o seu toque e a falta de credencial de produção com as sessões. Uma frase antiga, sem número, não é executada nem ignorada: a sessão responde uma vez, com a frase numerada pronta para copiar.
- **Manual do mantenedor como receitas** (novo na v3.1). O manual fica em `docs/mantenedor/receitas/`, e a seção "Duas portas" do AGENTS.md aponta para ele. Cada receita tem cinco partes: os arquivos que mudam; as checagens; a autorização (qual nível da frase); o que é proibido; e "pronto quando", em condições que um teste responde com sim ou não. Se a checagem ainda não existe, a receita escreve "conferência manual — NÃO CONFIRMADO", nunca um texto que pareça conferido. A receita aponta para a fonte e não copia números.
  - **Ordem:** na fase 0, "mudar-banco" e "publicar-e-voltar"; na fase 2, "novo-servico", "novo-agente" e "trocar-modelo"; no primeiro uso de cada tipo, "ajustar-ficha", "atualizar-versao", "nova-ferramenta", "nova-regra-de-codigo", "atualizar-tabela-de-leis" e "apagar-dado-pessoal". A receita é escrita no mesmo commit da primeira mudança daquele tipo, nunca depois.
  - **A receita é declarada no commit,** numa linha "Receita: <nome>". Uma checagem confere que a receita existe, tem as cinco partes e cita caminhos e testes que existem, e que cobre as pastas mudadas: `supabase/migrations/` pede "mudar-banco"; as fichas pedem "novo-agente" ou "ajustar-ficha"; o catálogo de modelos pede "trocar-modelo". Mudar o caminho de publicar ou o roteiro de restauração obriga a atualizar "publicar-e-voltar" no mesmo commit.
  - **Itens com data,** como a revisão da tabela de leis, aparecem no cartão de diagnóstico como código e data. A você só chega o que pede ação sua. Nada de `docs/mantenedor/` chega ao agente, porque a tarefa roda numa pasta vazia; o teste 3 confere.

### Testes, ambientes e minutos

- **Testes automáticos das especificações e do app** (novo na v3.1). Hoje nenhum workflow roda a `helena-v2/` nem o app.
  - **Especificações:** roda quando mudam a `helena-v2/` ou o pacote do plano, sem nenhuma senha, com dependências em versão exata e impressão digital. Roda o validador das fichas e os testes dele, a prova da tabela de passagens e o conferidor do plano. O validador passa a conferir também os próprios esquemas e fecha o furo de hoje em que uma ficha com `modelo: cota` passa. A versão de cada ficha passa a ser calculada (impressão digital), não digitada, e a partir da fase 2 o motor grava essa impressão e o commit em cada execução.
  - **App:** roda quando o app muda; instala pelo arquivo de trava das dependências, roda os testes e monta o app. O arquivo `bun.lockb` não é apagado antes de saber como o app é publicado hoje; se a publicação usar o bun, unificar vira mudança de publicação, com a sua frase de nível 2. A montagem de produção falha se faltar uma variável, e então a versão anterior continua no ar.
- **Três ambientes** (mudou na v3.1: antes, os testes rodavam "no banco de verdade", e os testes 4 e 10 cairiam no banco da v1, que não tem backup):

| Ambiente | O que roda lá | Senha e limpeza |
| --- | --- | --- |
| Teste descartável no GitHub, com um Supabase local na mesma versão principal do Postgres da produção | Todo teste que apaga, derruba ou enche: as 13 regras, o simulador, a parte lógica dos testes 3, 4, 5, 7 e 8, o teste 11 com a chave pública local, a conta do teste 10 e as prévias das telas | Nenhuma senha. Uma trava recusa qualquer destino que não seja a própria máquina do teste, e tudo some no fim |
| Produção | Só o que precisa da cota, do login, da VPS ou do estado real: testes 1, 2 e 6, as execuções reais do teste 5, publicar e voltar do teste 4, o aviso real do teste 7 e a parte de fora do teste 11 | Sempre com a sua frase. Toda linha criada por teste leva uma marca e é apagada no fim; nunca uma linha da v1 |
| Ensaio num segundo projeto do Supabase | Só se uma falha não se reproduzir no teste descartável | Só por decisão sua, num cartão: o projeto grátis pausa em 7 dias e soma nos limites da organização |

  - A restauração semanal com os dados reais roda no mesmo tipo de ambiente descartável, mas dentro do `helena-backup` (ver "Backup e recuperação").
  - A fase 0a lê, só por leitura, a versão do Postgres e as extensões da produção, para o Supabase local ficar igual (NÃO CONFIRMADO até essa leitura).
  - **Migrations da v1:** as que estão na main (55; outras 18 estão em ramos que não serão juntados, e não está confirmado quais rodaram na produção) vão para `supabase/historico-v1/`, sem apagar nada, porque elas não montam o banco do zero e têm versões repetidas.
  - **A partida dos testes** é a estrutura da v1 sem dados, tirada da cópia completa do `helena-backup` e conferida pela varredura de senhas. Como as sessões não alcançam o `helena-backup`, você passa esse arquivo uma vez para o repositório principal, com o passo a passo na mensagem da fase 0b, e de novo só se a estrutura real mudar.
  - **Migrations da v2:** número único e crescente, só acrescentam, e uma checagem confere isso. Se a produção guardar o histórico das migrations da v1, a escolha entre consertar esse histórico e usar uma tabela própria de versões da v2 vem para você num cartão, porque é escrita no banco.
  - **O teste pesado,** com o Supabase local inteiro, roda no pedido de publicar, uma vez por semana e à mão; a cada envio, roda só a parte leve.
- **Prévia das telas, sem Vercel** (novo na v3.1; a partir da fase 2 e só para as telas da v2). Quando eu preparo um pedido de publicar, o GitHub monta o app sobre um Supabase local com dados de exemplo inventados, entra pelo login de verdade, sem nenhum modo sem login, e tira fotos em tamanho de celular. Cada tela vira uma imagem com "antes | depois" lado a lado: "antes" é a versão no ar, "depois" é a candidata.
  - Qualquer pedido a um endereço de produção reprova a prévia. O relógio fica fixo, no fuso de Brasília, e as animações desligadas, para a foto sair sempre igual.
  - O pedido de publicar lista as prévias com a frase fixa "imagens com dados de exemplo; não provam que funciona; telas não fotografadas: …".
  - O job que roda o código novo só lê. Outro job, que não roda esse código, publica o link num modelo fixo, sem texto de IA. As imagens ficam 14 dias. Num PR, a prévia só roda com o rótulo "previa".
  - A prévia depende da estrutura de partida (ver "Três ambientes"): se o Supabase local não recriar todas as tabelas que a tela lê, a prévia reprova, em vez de mostrar uma tela vazia.
  - Antes de valer, você abre uma prévia no celular uma vez e confirma que a imagem aparece sem precisar baixar.
- **Por que sem Vercel** (novo na v3.1). Nas fases 0 a 3, a Vercel fica fora do motor, do Hermes e do app:
  - o motor precisa de um processo vivo que segura a trava única, e uma função da Vercel nasce e morre a cada chamada e pode rodar em várias cópias;
  - o login do ChatGPT precisa de uma pasta fixa, com trava entre processos, que a função não tem;
  - o relógio e o vigia precisam sobreviver à VPS fora do ar, e por isso ficam no Supabase; o agendador do plano grátis da Vercel roda no máximo uma vez por dia;
  - para o app, o plano grátis da Vercel não permite uso comercial, o pago é cobrado por membro mais o uso (valor NÃO CONFIRMADO), e por padrão ela publica a cada mudança, sem o seu toque;
  - o AI Gateway dela é API paga, contra a DEC-014.

  O limite de tempo das funções não é o motivo que decide. A Vercel só volta a ser avaliada na fase 4, com um motivo escrito e decisão sua.
- **Padrão único de workflow** (novo na v3.1). Todo workflow segue o mesmo modelo:
  - nenhuma permissão no topo e, em cada job (cada tarefa dentro do workflow), só o mínimo: ler o código; só o diagnóstico e a lista "Precisa de você" escrevem na issue;
  - ações de terceiros fixadas pelo código completo da versão (SHA), com a versão num comentário, e o código baixado sem guardar credencial;
  - tempo máximo por job: testes, 15 minutos; auditoria e diagnóstico, 5; backup, 20; restauração, 30;
  - fila para dois disparos não se atropelarem, cancelando só testes fora da main;
  - proibidos os gatilhos perigosos (`workflow_run` e `pull_request_target`) e repassar todos os segredos de uma vez;
  - um job com segredo só roda agendado ou disparado à mão, só na main, e não instala pacotes nem roda testes do repositório.

  Os 3 workflows de hoje são reescritos assim, e o mesmo commit deixa de rodar duas vezes (no envio e no PR).
- **Auditoria dos workflows** (novo na v3.1). Dois conferidores (actionlint e zizmor), em versão fixa e sem internet, rodam quando a pasta `.github/` muda e uma vez por semana. Eles acendem vermelho; no plano grátis, não impedem o workflow de rodar.
- **O seu passo, uma vez, em Settings > Actions** (novo na v3.1): ligar "exigir ações fixadas por SHA completo" (NÃO CONFIRMADO se a opção aparece no plano grátis para repositório privado), conferir que as permissões padrão estão em "só leitura" e que a criação de PR pelo Actions está desligada. Como as sessões têm administração, elas conseguem desfazer isso; o teste 11 confere os valores toda semana.
- **Ações atualizadas sem surpresa** (novo na v3.1). O Dependabot (robô do GitHub que propõe versões novas) cuida só das ações dos workflows, uma vez por mês, num PR só, sem juntar sozinho. Os pacotes do Python e do Node recebem só os alertas de segurança. Hermes e DBOS ficam fora: a troca deles segue "Atualizar sem surpresa".
- **O que o plano grátis não dá** (novo na v3.1): proteção de ramo, regras de ramo, ambientes, checagem obrigatória e revisor obrigatório em repositório privado. Também não há a varredura de senhas do próprio GitHub para repositório privado de conta pessoal; por isso a varredura é feita pelo gitleaks, com regras próprias, a cada envio e em todos os ramos. O GitHub Pro daria proteção de ramo e regras para a main, mas nem ele dá revisor obrigatório em repositório privado; preço NÃO CONFIRMADO. Não é recomendado agora, e a decisão é sua.
- **Orçamento de minutos numa tabela só** (novo na v3.1). O plano grátis do GitHub dá 2.000 minutos de Actions por mês (NÃO CONFIRMADO o plano da sua conta), e o `helena-backup` gasta da mesma cota. Cada job conta no mínimo 1 minuto. Sem forma de pagamento cadastrada, quando a cota acaba, todos os workflows param, inclusive o backup. Por isso esta tabela é medida na fase 0, antes de ligar qualquer workflow novo, e eles são ligados na ordem da primeira coluna: backup, diagnóstico, varredura de senhas e só depois o resto.

| Ordem | Workflow | Quando roda | Minutos por mês | De onde vem o número | Se a conta apertar |
| --- | --- | --- | --- | --- | --- |
| 1 | Backup da noite (`helena-backup`) | Todo dia, às 03:17 | 100 a 150, somado com a restauração | Estimativa da verificação | Nunca é cortado |
| 1 | Restauração semanal, deriva e espelho do código (`helena-backup`) | Uma vez por semana | Dentro da linha de cima | Estimativa | Nunca é cortado |
| 2 | Cartão de diagnóstico | A cada 3 horas e quando uma publicação falha | Cerca de 240 | Conta: 8 por dia × 30 dias × 1 minuto | Passa para a cada 6 horas (cerca de 120) |
| 3 | Checagem leve por envio, num job só: varredura de senhas (gitleaks), registro de quem enviou (rastreio, não trava), arrumação, fonte única e receita | Cada envio, em qualquer ramo | Cerca de 300 | Conta: cerca de 300 envios por mês × 1 minuto | A varredura de senhas nunca é cortada; o resto passa a rodar só na main |
| 4 | Lista "Precisa de você" | Uma vez por dia e quando a lista muda | 30 a 40 | Conta: 1 minuto por vez | Passa a rodar só quando a lista muda |
| 4 | Auditoria dos workflows | Quando `.github/` muda e uma vez por semana | Poucos minutos | Estimativa | Só quando `.github/` muda |
| 5 | Especificações | Envio que mexe nelas | Cerca de 1 minuto por envio; total a medir | Estimativa da verificação | Só na main e no pedido de publicar |
| 5 | App | Envio que mexe no app | 1,5 a 2 minutos por envio; total a medir | Estimativa da verificação | Só na main e no pedido de publicar |
| 5 | Banco, no Supabase local | Pedido de publicar, uma vez por semana e à mão | A medir | NÃO CONFIRMADO | Só no pedido de publicar |
| 6 | Imagem, montada e testada | Só no pedido de publicar, só o serviço que mudou | A medir | NÃO CONFIRMADO (a estimativa de 25 minutos por publicação não foi medida) | Não se corta: publicar depende dela |
| 7 | Prévia das telas | Pedido de publicar; num PR, só com o rótulo "previa" | 5 a 8 minutos por vez | Estimativa da verificação | A primeira a desligar: a prévia por PR para |
| — | Testes da v1 de hoje (3 workflows) | Cada envio, em dobro (envio e PR) | Cerca de 730 hoje | Medido: 295 execuções em cerca de 15 dias | Reescritos no padrão; o primeiro corte é fora da main |

  - **A conta não fecha em 1.200** (novo na v3.1: a v3 não tinha orçamento de minutos, e a meta de 1.200 proposta na análise dos especialistas foi feita sem somar). Só o que já existe e o que já tem conta soma cerca de 1.400 a 1.460 minutos por mês, antes de especificações, app, banco, imagem e prévia.
  - **O que fecha a conta:** reescrever os testes da v1, o maior gasto, sem execuções em dobro e só nas pastas que mudaram; juntar as checagens leves num job só por envio; e rodar o pesado só no pedido de publicar e uma vez por semana.
  - **Aviso em 60% (1.200 minutos) e em 80% (1.600).** A partir de 80%, os cortes da última coluna entram nesta ordem: prévia por PR, testes fora da main, checagens leves só na main e diagnóstico a cada 6 horas. Backup, restauração e varredura de senhas nunca são cortados.
  - O cartão de diagnóstico mostra uma estimativa dos minutos do mês, calculada pela duração dos jobs, sem token novo. O número oficial fica na tela de cobrança do GitHub.
  - Se a medição da fase 0 mostrar que não cabe abaixo de 80% mesmo com os cortes, a escolha vem para você num cartão: cortar mais ou cadastrar uma forma de pagamento com limite de gasto (valor NÃO CONFIRMADO).

### Você enxerga e é avisado

- **Uma lista só: "Precisa de você"** (novo na v3.1). Tudo o que depende de você mora num arquivo só, `docs/fundador/precisa-de-voce.yaml`, escrito só pelas sessões de manutenção, nunca por agentes nem pela internet. Cada item traz:
  - o quê e por quê;
  - opções A, B e C só quando há escolha real, com a consequência de cada uma e a recomendação;
  - o prazo, em data;
  - no máximo 7 toques; mais que isso, o item é dividido;
  - onde responder, e o que acontece se você não fizer.

  Um teste recusa item sem prazo ou sem "onde responder" e qualquer texto parecido com uma chave.
- **No celular, uma issue fixada** (uma página de tarefa do GitHub). Ela é reescrita todo dia de manhã e quando a lista muda, sem nenhuma senha. No topo vem o que vence em até 3 dias. Ela menciona você quando entra item novo ou quando um prazo chega a 3 dias, o que dispara a notificação do GitHub no celular. Você fixa a issue uma vez (o GitHub deixa fixar até 3, e o diagnóstico ocupa outra). Comentário na issue não é decisão nem autorização: decisão é no app ou com a frase. Na fase 3, o painel do app mostra a contagem e o link, sem copiar a lista.
- **Guia de uma tela e glossário** (novo na v3.1). O `docs/fundador/onde-faco-o-que.md` é uma lista vertical, legível no celular: pedir, aprovar, autorizar com a frase, publicar e voltar no EasyPanel, avisos, "Pausar tudo" e cada lugar da fase 0 (EasyPanel, editor SQL do Supabase, GitHub, Hostinger, healthchecks.io e Telegram), com a fase a partir da qual cada um vale. O glossário tem até 25 termos em linguagem simples, como card, etapa, portão, impressão digital, AUT e E1 a E5.
  - Nomes: "Manual do fundador" passa a se chamar "Preferências do fundador", que é a tela do app; o "Guia do fundador" é o documento; e o "manual do mantenedor" são as receitas.
- **Primeiros itens da lista** (novo na v3.1):
  - Hostinger: conferir no painel o que vence em 27/10/2026. As fontes divergem, por isso o item não traz recomendação até você conferir.
  - Aprovar as fontes oficiais da pesquisa jurídica da primeira meta.
  - Central da v1 (atendimento de clientes no WhatsApp e ligações de saída): você decidiu desligar. Antes, vem o inventário só de leitura, que também responde se a voz usa API paga; depois, a sua frase de nível 2, com os clientes avisados antes.
  - A aprovação final do plano.
- **Quem conserta enxerga sem o seu PC** (mudou na v3.1: o cartão passa a mostrar também as panes e a própria idade). A cada 3 horas, num minuto fora da hora cheia, e sempre que uma publicação falhar, um job do GitHub atualiza um cartão fixo de diagnóstico.
  - **O que ele mostra:** último sinal de vida; versão no ar, e se ela bate com a última aprovada; filas; etapa parada mais antiga; últimas falhas por tipo; tamanho do banco; idade do último backup e da última restauração; avisos abertos; e (novo na v3.1) a estimativa de minutos do GitHub no mês, as impressões digitais da lista do que fica fora do GitHub, os itens com data do manual que venceram e quantos ramos estão fora da main.
  - **Só números, códigos e horários,** nunca texto escrito por IA ou vindo da internet, para nenhuma instrução plantada chegar a quem pode mudar o sistema. O motor também registra cada vez que liga e cai, e a aba Técnico tem o mesmo resumo num botão Copiar.
  - **Como ele lê** (novo na v3.1). Ele lê só uma view (uma tabela de leitura montada a partir das outras) de números, com um papel do banco que não lê mais nada, tem no máximo 2 conexões e tempo máximo por consulta, e não consegue pegar a trava do motor. A idade do backup vem do healthchecks, pela chave só de leitura; nada no repositório principal alcança o `helena-backup`. Ele escreve com a permissão do próprio job, só para issues, sem token pessoal.
  - **Cada valor lido é conferido:** número, data e sim ou não são convertidos, e um código só vale se estiver numa lista fixa. O que não bate aparece como "valor recusado". Um teste, num Postgres local, falha se a view ganhar uma coluna que não seja número, data, sim ou não, ou código da lista.
  - **A pane vira diagnóstico.** Quando não consegue ler, o cartão mostra "Supabase inacessível às HH:MM, erro X" ou "banco só leitura". Ele sempre mostra "atualizado às HH:MM", e o healthchecks avisa você se ele passar de 7 horas sem atualizar.
  - **Avaliado e descartado:** o próprio Supabase escrever o cartão, para tirar do GitHub a credencial de leitura. O cartão pararia justo quando o banco fica só leitura ou fora do ar, um token do GitHub passaria a morar dentro do banco, e quem tivesse acesso de administrador ao banco poderia escrever texto livre no cartão que as sessões leem.
- **Avisos com um remetente só** (mudou na v3.1: antes, o Supabase mandava os avisos direto ao Telegram).
  - **Quem grava:** o vigia e o relógio só gravam cada aviso numa tabela, com chave única, para a mesma situação não virar dois avisos. Continuam valendo "cada nível dispara uma vez" e "um aviso por regra a cada 6 horas".
  - **Quem manda:** só o motor, pelo robô da Helena no Telegram. Com o DBOS, cada envio é um passo dele, reenviado com intervalo crescente até o Telegram confirmar. A entrega é "pelo menos uma vez": raramente, um aviso pode chegar repetido, o que é melhor que perder. Depois de uma parada, o acumulado chega num resumo só. Na alternativa do motor próprio, esse reenvio teria de ser escrito à mão; isso está no cartão do motor.
  - **Banco fora ou só leitura:** o motor manda só o aviso dele ("banco só leitura" ou "banco fora"), guarda na memória o que já mandou e repete a cada 6 horas enquanto durar.
  - **De dentro do Supabase sai só o sinal de vida** para o healthchecks.io, um por tarefa agendada, no fim de cada rodada que terminou bem. Com o banco só leitura ou fora, o sinal não sai, e a falta dele é o alarme. O motor manda sinal a cada minuto, e o backup, toda noite.
  - **A fila de avisos é vigiada fora do motor.** Se o aviso mais antigo não enviado passar de 15 minutos, o vigia marca falha na checagem "fila de avisos", e o healthchecks avisa você. Isso pega o motor vivo que não consegue falar com o Telegram.
  - **Dois caminhos:** o robô da Helena traz avisos de card; o HealthchecksBot (o robô do próprio healthchecks) e o e-mail avisam quando alguma peça para. Você manda /start ao HealthchecksBot na fase 0b. É NÃO CONFIRMADO se o Telegram do healthchecks está no plano grátis; o e-mail vale de qualquer jeito.
  - **Segredos:** o token do robô da Helena fica só no motor, no EasyPanel, e sai do banco. Os endereços de sinal de vida ficam no cofre do Supabase e entram na lista de chaves, porque quem tiver um deles pode fingir que o sistema está vivo.
  - **Padrão só depois do lembrete:** um padrão que encerra uma espera por você só vale depois que o lembrete anterior foi entregue.
  - **Antes do motor:** nas fases 0 e 1, os avisos vêm só do healthchecks (backup, restauração, cartão de diagnóstico e sinal do Supabase), e o backup da noite mede o tamanho do banco e marca falha acima de 70%.
  - **Teste mensal:** um aviso de teste por cada caminho, e você confirma que recebeu os dois.
  - **Risco aceito e escrito:** com o motor fora, os avisos de card esperam, e o aviso "motor fora" chega pelo healthchecks em até 15 minutos.

### Servidor e versões

- **Servidor dividido, com limite.** A VPS divide 4 núcleos com a v1, o WhatsApp, o app e o EasyPanel. (mudou na v3.1: com a fila única descrita na seção do motor, rodam no máximo 2 processos do Hermes ao mesmo tempo, o de trabalho e o curto da Helena; antes eram até 3 agentes.) O serviço e cada agente têm limite de memória, e uma limpeza apaga as pastas de tarefa que sobrarem. O sinal de vida leva disco, memória e processador, com aviso em 80% de disco ou abaixo de 1,5 GB de memória livre. Os registros do servidor têm tamanho máximo.
  - (mudou na v3.1: as imagens são montadas no GitHub e a VPS só baixa; antes, a montagem rodava na VPS, com limite.) A VPS guarda as 3 últimas imagens e nunca apaga as das 2 últimas versões, para a volta não depender de baixar de novo.
  - (novo na v3.1) **Ponto de partida medido:** na fase 0a, 24 horas de medição do processador e da memória como estão hoje, para o teste 6 ter com o que comparar. Limites de contêiner entram um serviço por vez, sem limite rígido no WhatsApp nem na voz, e só com a sua frase de nível 2.
  - (novo na v3.1) Os agentes rodam com outro usuário do sistema, sem enxergar o ambiente do motor.
- **Atualizar sem surpresa.** Hermes, DBOS e o resto ficam fixados numa versão exata. Cada troca de versão repete o teste 3, compara pedido por pedido com a versão anterior, roda uma tarefa real por serviço e ensaia a mudança do DBOS e a volta num banco de teste. (mudou na v3.1: o banco de teste é o descartável do GitHub, com volume de dados parecido com o real, feito de dados inventados do tamanho medido.) O sinal de vida registra o modelo, o provedor e a versão do Hermes usados de verdade, e um apelido apontando para um modelo que não existe vira aviso, nunca uma troca escondida. (novo na v3.1) Nenhum robô propõe troca do Hermes ou do DBOS: ela sempre segue este caminho.
- **Todo erro vira teste.** O caso que falhou entra na bateria, então aquele erro não volta sem ser pego. (mudou na v3.1) O caso guarda as respostas das ferramentas gravadas (a "fita"), para rodar igual com qualquer modelo e sem internet, e na regressão precisa acertar nas 3 rodadas, não na média. No registro de furos, um furo só conta como "provado" quando existe um caso que o reproduz e um teste que o recusa.

| O que você quer mexer | Onde mexe | O que protege |
| --- | --- | --- |
| Trocar ou testar um modelo | Uma linha no catálogo de modelos; os agentes usam apelidos. Receita "trocar-modelo" | 60 casos simulados e 60 reais. (mudou na v3.1: no lugar do placar de 20 casos pela média, que escondia um caso que passou a errar sempre, cada caso de regressão precisa acertar nas 3 rodadas com o modelo novo.) As notas conferidas pelo código não podem cair mais de 5 pontos; depois, 48 horas em observação |
| Criar ou ligar um agente | Uma linha no organograma, o serviço no catálogo, a ficha e os casos. Receitas "novo-agente" e "novo-servico" | O validador recusa ficha incompleta, e o agente nasce desligado. (mudou na v3.1: a ficha, os casos e a jornada de ponta a ponta são provados na especificação; em produção, ele sobe um por vez pelos portões, de estágio para ativo, com o seu toque em cada subida, porque a cota e a VPS são limitadas; descer é automático) |
| Nova ferramenta | Um arquivo no servidor de ferramentas, com o efeito dela, e o nome na ficha. Receita "nova-ferramenta" | Só recebe quem tem na ficha; ferramenta que age fora só roda pelo motor, depois do seu ok |
| Nova regra ou função | Nasce desligada e é ligada agente por agente. Receita "nova-regra-de-codigo" | O validador recusa regra que contradiz outra, e uma regra nova passa 24 horas só acendendo a luz |
| Ajustar as instruções de um agente | A ficha daquele agente. Receita "ajustar-ficha" | A bateria daquele agente roda antes de publicar |
| Mudar um valor, como o teto de orçamento ou a lista de termos (novo na v3.1) | No app, sem publicar | A checagem de contradição; o valor novo vale para execuções novas |
| Mudar o banco (novo na v3.1) | Receita "mudar-banco", com a frase de nível 2. Na fase 0, você no editor SQL, com o script e o caminho de volta; a partir da fase 2, a imagem aplica ao ligar | Cópia antes; a mudança só acrescenta; acessos dados e tirados por extenso; teste 11 |
| Publicar ou voltar (novo na v3.1) | Receita "publicar-e-voltar": você cola a impressão digital no EasyPanel | Testes da versão candidata, card de ensaio e volta pela impressão anterior |
| Atualizar Hermes ou DBOS (novo na v3.1) | A versão exata no repositório. Receita "atualizar-versao" | Teste 3, comparação pedido por pedido, tarefa real por serviço e ensaio da mudança e da volta |
| Atualizar a tabela de leis (novo na v3.1) | Receita "atualizar-tabela-de-leis", com data de revisão | O card jurídico diz contra qual versão foi conferido, e o vencimento aparece no cartão de diagnóstico |
| Criar empresa, conta ou entidade (novo na v3.1) | Comando direto seu (DEC-022): vale como autorização na hora | O AUT abre já como usado; a gravação vai para a tabela de destino (empresas em `public.portfolio`) e é conferida depois |

## Backup e recuperação

O backup não pode depender só do Supabase: no plano grátis ele não faz backup nenhum. (mudou na v3.1) A primeira cópia completa vem antes de qualquer mudança da fase 0, e daí em diante a cópia mora num segundo repositório, o `helena-backup`, que só você cria e que nenhuma IA alcança. Toda semana, um teste prova que a cópia volta.

- **Um repositório fora do alcance das IAs** (novo na v3.1).
  - Você cria o `helena-backup` à mão, nunca uma sessão de IA, porque o app que cria um repositório ganha acesso a ele.
  - Antes de criar, em cada app de IA ligado ao GitHub (Claude, Codex e outros), você marca "Only select repositories", sem o `helena-backup`, e revoga os apps e os tokens clássicos que alcançam todos os repositórios privados.
  - Os workflows dele são preparados como texto pelas sessões, guardados como modelo revisado em `ops/helena-backup/` no repositório principal, e colados por você. Eles não usam ações de terceiros: só programas instalados, em versão fixa.
  - Ele guarda três segredos: o endereço do papel de leitura do banco; a chave que abre os backups, usada só pela restauração; e uma chave só de leitura do repositório principal, para o espelho do código.
  - O teste 11 ganha um caso: cada acesso das IAs tenta listar e ler o `helena-backup` e precisa falhar. Até esse teste passar, é NÃO CONFIRMADO que a restrição dos apps basta.
- **A primeira cópia, antes de tudo (fase 0a)** (novo na v3.1). As sessões não alcançam o banco, e no seu PC o Windows bloqueia o programa do Supabase, então quem executa é você, pelo celular, disparando à mão o workflow de cópia no `helena-backup` (o aplicativo do GitHub deixa rodar um workflow assim). A ordem:
  1. No editor SQL, você cria o papel de leitura do backup, com o script e o caminho de volta (apagar o papel) prontos. É a única mudança antes da cópia, e ela não toca em nenhum dado. A senha desse papel você gera e cola direto no editor e no segredo do `helena-backup`, sem passar pelo chat.
  2. Você dispara a cópia completa.
  3. A restauração de teste roda e precisa bater nas contagens.
  4. Só então começam as outras mudanças da fase 0a.

  NÃO CONFIRMADO: que o Supabase deixa criar um papel que lê todas as tabelas, inclusive as protegidas por regra de linha, e as tarefas agendadas. A primeira cópia prova isso; se as tarefas agendadas não forem lidas, o roteiro as lista à mão (nomes e horários, sem segredos).
- **O que entra e quando** (mudou na v3.1: antes, toda noite só as tabelas que mudam e o banco inteiro uma vez por semana, o que misturava momentos diferentes).
  - Um formato só: a cópia completa do banco, toda noite, às 03:17 de Brasília, pelo pooler de sessão, com o programa de cópia na mesma versão principal do servidor.
  - Junto vai uma lista: a contagem de linhas de cada tabela e os nomes das extensões, dos papéis e das tarefas agendadas, sem nenhum valor secreto.
  - Ficam de fora o esquema do DBOS e o cofre de segredos do Supabase (ver "O que fica fora").
  - A cópia vai anexada a uma versão (release) do `helena-backup`, que não conta no espaço de pacotes do plano grátis.
  - A fase 0 mede o tamanho da cópia e o tráfego do mês sem o backup. Se o tráfego medido mais 30 cópias completas ficar em até metade do limite grátis de 5 GB (contado para a organização inteira), a cópia é toda noite; se não couber, a cada 2 ou 3 noites, sempre completa, e a escolha de plano vai para você.
- **Criptografado.** (mudou na v3.1: antes, a chave que abre o backup ficava num segredo do mesmo repositório em que as IAs mexem.) A cópia sai comprimida e criptografada com uma chave pública, que fica num arquivo e não é segredo. Assim o job do backup não consegue abrir nenhum backup. A chave que abre fica num segredo usado só pela restauração, e uma cópia dela fica com você, fora do computador, em dois lugares.
- **Prova toda semana** (mudou na v3.1: agora no `helena-backup`, sem rodar código do repositório principal ao lado do backup aberto). A restauração semanal é o único job com a chave que abre. Num Supabase montado na própria máquina do GitHub, ela:
  - restaura a cópia e confere a contagem de linhas de cada tabela contra a lista;
  - a partir da fase 2, quando o vigia e o relógio existirem: roda a checagem das 13 regras do vigia, que vem dentro da própria cópia; confere que nenhuma execução do DBOS veio na cópia; chama a função do vigia que devolve etapas e confere que cada etapa "na fila" ou "executando" ganhou exatamente uma execução nova, sem gastar tentativa; e confere que o vigia e o relógio voltaram a rodar;
  - (novo na v3.1) compara a estrutura do banco com a da semana anterior e manda só o número de objetos que mudaram; mudança sem publicação no meio vira aviso;
  - (novo na v3.1) guarda um espelho do código do repositório principal, com todos os ramos e etiquetas, para que um envio forçado ou um repositório apagado por engano não levem o código além da última cópia semanal;
  - apaga a chave e a cópia aberta no fim.

  Se o backup ou a restauração falharem, ou o sinal deles não chegar, o vigia do vigia avisa você. O teste 8 ganha dois casos (novo na v3.1): depois de restaurar, nenhuma etapa roda duas vezes; e uma ação externa aprovada depois da hora da cópia não roda de novo sem um toque novo seu.
- **Roteiro de restauração.** Um arquivo no repositório diz a ordem: extensões, acessos, estrutura, dados, as tarefas agendadas do vigia e do relógio, os segredos do cofre, que você cola de novo seguindo a lista de chaves, e, por fim, o endereço e as chaves novas em cada peça. Uma restauração que esquece o vigia parece saudável e fica sem vigilância, por isso a última etapa confere o vigia rodando. O roteiro é ensaiado uma vez, cronometrado, antes do portão da fase 2. (novo na v3.1) Ele ganha quatro passos:
  - o esquema do DBOS é recriado pela ferramenta do próprio DBOS, na versão fixada, com os acessos do papel do motor, antes de ligar o motor;
  - o motor liga vazio, com a fila pausada, e o vigia devolve uma vez cada etapa "na fila" ou "executando" sem execução viva, com número novo e sem gastar tentativa;
  - toda ação externa aprovada que não esteja registrada como concluída volta para "esperando você", com o aviso "restaurado do backup de <data e hora>; confirme se já foi feita" (regra 8);
  - a lista de apagamentos (LGPD) é aplicada de novo, para nenhum dado apagado voltar.

  Se o Supabase grátis pausar por pouco uso, o roteiro traz o passo curto: abrir o painel do Supabase e tocar em "Resume project".
- **Antes de mexer no banco** (mudou na v3.1).
  - **Na fase 0, antes do motor:** antes de cada passo de SQL, uma cópia completa nova. Quem executa cada SQL é você, no editor SQL, com o script e o caminho de volta prontos e o número do AUT. O checklist da v1 roda antes e depois de cada passo, e o critério é "igual ou melhor que antes do passo".
  - **A partir da fase 2:** a mudança vem dentro da publicação e guarda antes uma cópia das tabelas que ela toca, por 7 dias, numa pasta da VPS, fora do banco, para não gastar os 500 MB. As mudanças só acrescentam, então a versão anterior do motor continua funcionando; uma parte antiga só sai numa publicação seguinte, quando nenhuma versão no ar a usa mais.
  - (novo na v3.1) A receita "mudar-banco" só pede o seu toque quando o cartão de diagnóstico mostra o backup da última noite e a última restauração semanal verdes.
- **O banco não estoura.** O plano grátis tem 500 MB, e acima disso o banco só aceita leitura: o motor, o vigia e o aviso de dentro do Supabase param juntos. Por isso cada passo do motor guarda só números e referências, o texto fica uma vez numa tabela nossa, e uma limpeza da noite apaga do DBOS as execuções terminadas há mais de 14 dias (a biblioteca gratuita do DBOS só apaga por comando; a limpeza é nossa). O motor mede o banco a cada hora e avisa você direto, sem passar pelo Supabase, ao chegar a 70% ou se o banco recusar gravação.
  - (novo na v3.1) Nas fases 0 e 1, antes do motor, o backup da noite mede o tamanho do banco e marca falha acima de 70%.
  - (mudou na v3.1: o teste 10 vira uma conta com confirmação real) O teste descartável mede quantos bytes ocupa cada card, com as execuções do DBOS, depois de pelo menos 15 rodadas da limpeza da noite. A projeção para 60 dias soma o tamanho atual da produção, o crescimento da v1 medido em 7 dias e a projeção da v2, e precisa ficar abaixo de 350 MB. Se os bytes reais por card na primeira meta passarem 20% da estimativa, a conta é refeita.
  - (novo na v3.1) O limite de uso justo do Supabase é contado para a organização inteira, pela média do mês, e pode bloquear tudo mesmo abaixo de 500 MB naquele dia; por isso a lista de projetos da organização entra na medição.
- **Cartão: Supabase grátis ou Pro** (novo na v3.1: antes, a escolha só vinha se o teste 10 falhasse, depois de o backup e os avisos já estarem construídos). Na fase 0, logo depois da primeira cópia, que já traz os números, e antes de ligar o backup da noite, você recebe um cartão com o tamanho do banco, as maiores tabelas, o uso de arquivos, o tráfego do mês, o plano atual e os projetos da organização.
  - **A) Continuar no grátis:** R$ 0 e mais trabalho. Fica tudo o que está nesta seção. Riscos: pausa depois de 7 dias de pouco uso (o vigia do vigia avisa, com o passo "Resume project"); uso justo por organização; no máximo 2 projetos ativos.
  - **B) Pro:** a partir de US$ 25 por mês, preço a conferir no dia, mais cerca de US$ 10 por mês por projeto a mais na organização (NÃO CONFIRMADO), mais o IOF do cartão. Com o limite de gasto ligado, o teto fica em cerca de 8 GB, sem pausa, com cópias diárias guardadas por 7 dias dentro do Supabase. O backup de fora continua, porque essas cópias ficam na mesma conta e não incluem os arquivos do Storage; a restauração provada passa a ser no mínimo mensal; o aviso de tamanho, a limpeza do DBOS e o teste 10 continuam, com a meta nova.
  - Sem resposta, fica A. Os números decidem; o cartão não traz recomendação fixa. Mudar de plano pede a sua frase de nível 2, e quem paga é você, no painel. Nenhum agente paga nem muda o plano. O teste 10 confere a opção escolhida.
- **O que fica fora, de propósito** (mudou na v3.1: a lista ganhou o DBOS, o cofre e os arquivos do Storage).
  - **Senhas e segredos do cofre** não entram no backup: a lista de chaves diz como trocar cada uma, e trocar é mais seguro que restaurar.
  - **O esquema do DBOS** fica fora, sem estrutura e sem dados, e é recriado ao restaurar. Assim nenhuma execução antiga é retomada sozinha (o teste 8 confere), e o estado do card, que vive em tabelas nossas, volta com a cópia.
  - **A sessão do WhatsApp** se refaz pelo QR code.
  - **O histórico da v1 que mora no Hermes** fica onde está. Se a v1 precisar ser refeita, ele é copiado antes, e a cópia é aberta e conferida antes de a v1 antiga ser apagada. A cópia nunca vai para o GitHub nem para o chat, porque contém tokens; o mesmo vale para o arquivo hermes-backup, de cerca de 500 MB.
  - **Arquivos guardados no Storage do Supabase,** se houver: a cópia do banco não os inclui. É NÃO CONFIRMADO se a v1 usa o Storage; a fase 0a confere e, se usar, a escolha de como copiar vira item na sua lista.
- **O que é apagado, e quando** (novo na v3.1). Cada item abaixo tem prazo:

| O quê | Por quanto tempo fica | Depois |
| --- | --- | --- |
| Cópias das páginas lidas | Inteiras até 7 dias depois de o card fechar | Ficam só os trechos citados, no banco e no backup |
| Execuções terminadas do DBOS | 14 dias | A limpeza da noite apaga |
| Cópia das tabelas antes de uma mudança no banco | 7 dias | Apagada da pasta da VPS |
| Backups | 14 dias, e uma cópia completa por semana durante 8 semanas | A limpeza só roda depois de um backup novo bem-sucedido e nunca apaga a cópia mais recente que passou na restauração |
| Linhas criadas por teste na produção | Até o fim do teste | Apagadas pela marca de teste |
| Imagens de prévia das telas | 14 dias | Apagadas pelo GitHub |
| Imagens do programa na VPS | As 3 últimas | As mais antigas saem; as das 2 últimas versões nunca |

- **Dados de pessoas e LGPD** (novo na v3.1).
  - Os dados das pessoas recrutadas só são guardados depois da linha de LGPD aprovada na pesquisa jurídica da primeira meta, que diz o que se guarda, por quanto tempo e como se apaga.
  - Quando um dado pessoal é apagado, por prazo ou a pedido da pessoa, a receita "apagar-dado-pessoal", com a sua frase de nível 2, o apaga do banco e registra só o número do pedido, a data e o identificador interno do registro, nunca nome, telefone ou e-mail.
  - Essa lista de apagamentos fica no repositório principal, fora do banco, para sobreviver a uma restauração, e o roteiro a aplica de novo depois de restaurar.
  - O dado apagado some dos backups em até 8 semanas, quando vence a última cópia que o tinha.
  - O histórico do card continua reconstruindo o caminho (estados, quem fez e quando), mas não devolve um dado pessoal apagado.

