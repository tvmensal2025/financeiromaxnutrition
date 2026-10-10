# Sistema Helena: análise dos especialistas e plano de melhoria

Data: 10/10/2026. Este documento só analisa. Nenhum arquivo, banco, servidor ou deploy foi alterado.

Como ler: cada melhoria tem um código (MEL-01 a MEL-48). "l. N" indica a linha do plano v3 (`01-plano-v3.md`). Quando um termo técnico for inevitável, a explicação vem entre parênteses.

---

## 1. Resposta direta

1. **O que queremos:** uma empresa de funcionários de IA, coordenada pela Helena. Cada pedido seu vira um card. Cada etapa do card é feita por um especialista, conferida pelo código e por um revisor. Nada sai para fora sem o seu toque.
2. **O plano v3 está no caminho certo no essencial.** O código manda no fluxo. Só o motor grava. O agente devolve uma de poucas ações. As esperas ficam guardadas no banco. Uma fase só avança quando passa nos testes.
3. **Mas ainda tem peças demais e travas que não travam.** O caso mais grave é o GitHub: a sessão de IA entra com o seu próprio login, como administradora.
4. **Mudança 1. Estancar a v1 já (fase 0a):** fazer uma cópia do banco antes de mexer, fechar as portas, trocar e depois revogar as chaves, e fechar o acesso público.
5. **Mudança 2. Tirar do GitHub tudo o que muda a produção:** publicar passa a ser o seu toque no EasyPanel, colando a impressão digital (código único que não muda) de uma imagem já testada.
6. **Mudança 3. Um motor menor e mais exato:** sem DBOS (a decisão é sua), com uma vaga de trabalho e plano só por roteiro. A ação do agente chega por uma ferramenta. Sem busca aberta na internet e sem sub-card na v2.0.
7. **Urgente, fora do plano:** confirme no painel da Hostinger o que vence em 27/10/2026. As fontes que temos se contradizem.

---

## 2. O que queremos fazer

Pense no Sistema Helena como uma pequena empresa que atende as suas quatro empresas: iGreen, Saúde, Humano Digital e eLiving.

- **Você é o dono.** Fala com a Helena pelo app e, mais tarde, pelo WhatsApp. Você decide, aprova o plano de cada meta e toca para publicar. Nenhum agente cadastra, contata gente de fora, gasta, assina, publica ou faz commit em seu nome.
- **A Helena é a gerente (AGT-01).** Ela entende o pedido e lê de volta para você: "Entendi assim. Confirma?". Depois escolhe o roteiro certo, abre o card, acompanha e escreve o relatório final.
- **O card é a ordem de serviço.** Ele traz o objetivo, o prazo, "como é o pronto" e o que não pode. Também traz as etapas, cada uma com dono e prazo. Todo card termina, e o histórico dele nunca é apagado.
- **Os especialistas são funcionários com ficha.** A ficha diz o que cada um faz, o que nunca faz, quem o revisa e quem o substitui. Eles não conversam entre si. Quem passa o trabalho de um para outro é o motor.
- **O motor é o chefe de turno, feito de código.** Ele entrega cada etapa a um especialista, controla o tempo, a cota do ChatGPT e as tentativas, e é o único que grava no banco.
- **A qualidade passa por três portões:**
  1. O código confere contas, citações, termos proibidos e formato.
  2. Um colega revisor confere pela rubrica (a lista de critérios de cada tipo de entrega).
  3. Você decide no plano da meta e em todo ato que sai para fora.
- **O treino é como com um funcionário.** Você corrige no card. A correção vira uma lição que só passa a valer depois de provar que conserta.
- **A v1 continua no ar** até a v2 provar que funciona. A v2 começa com 5 fichas: Helena, Caio, Isabela, Clara e Ravi (este, pausado). Os outros 16 agentes seguem na v1 e voltam um por vez.
- **Primeira meta real:** o plano para recrutar as 10 primeiras pessoas da Humano Digital, nas plataformas Mimix e Hub.
  - E1: Caio faz a conta.
  - E2: Isabela faz o treinamento.
  - E3: Isabela faz o convite, sem promessa de renda.
  - E4: Clara faz o parecer jurídico.
  - E5: Helena faz o relatório.

**Por que a v1 travou:** sete guardas escritas à mão se atrapalhavam. As entregas eram boas, mas o "encanamento" falhou. A v2 responde ao seu pedido ("a lógica tem que ser exata") com três princípios: uma tabela só de estados, cada regra escrita uma vez e nada que o teste não tenha provado.

---

## 3. O que os especialistas viram lá fora

Limite da pesquisa: vercel.com, docs.github.com, arXiv e outros sites foram bloqueados pelo proxy. A documentação foi lida no código-fonte oficial no GitHub ou em resultados de busca, e o ponto em que isso aconteceu está marcado em cada achado.

### Vercel

**Copiamos (grátis):**
- **Credencial sempre explícita, nunca "auto".** No modo "auto", basta existir uma chave de API no ambiente para o sistema passar a gastar API paga sem ninguém ver, o que fere a DEC-014.
- **Casos de teste com respostas de ferramenta já gravadas (ideia do eve).** O mesmo caso roda com qualquer modelo, sem internet, e dá sempre o mesmo resultado.
- **Política que nega por padrão.** Na Vercel, quando nenhuma regra responde, o padrão é permitir. Fazemos o contrário: o que não estiver liberado fica proibido.

**Adaptamos:**
- **As 5 ações como ferramentas tipadas do nosso servidor (ideia do AI SDK).** O formato errado é recusado na hora.
- **Voltar de versão sem remontar (ideia do Instant Rollback),** feito com uma imagem guardada no GitHub e fixada no EasyPanel.
- **Rede fechada por padrão (ideia do Sandbox),** só testada agora e aplicada na fase 4, se o teste mostrar que é preciso.
- **Ver a tela nova no celular antes de publicar,** com fotos montadas no GitHub, sem Vercel.

**Evitamos:**
- **Functions:** duram no máximo 300 s ou 800 s, não têm disco comum e o login do ChatGPT não roda nelas.
- **Sandbox para o Hermes:** copiar o login do ChatGPT para várias máquinas derruba o acesso de todos.
- **Workflow SDK:** é "implementação de referência", sem autenticação, e só existe em TypeScript.
- **Cron do plano grátis:** roda no máximo 1 vez por dia, com até 59 minutos de atraso.
- **AI Gateway:** é API paga, contra a DEC-014.
- **Vercel Agent:** exige o plano Pro e cobra por uso.
- **Hospedar o app agora:** o uso comercial exige o Pro (US$ 20 por mês), e por padrão a Vercel publica a cada mudança, sem o seu toque.
- **Telemetria externa:** levaria dados pessoais das pessoas recrutadas para mais um lugar.

### GitHub

**Copiamos (grátis):**
- **Ações dos workflows fixadas pela impressão digital, token só de leitura e auditoria dos workflows (zizmor e actionlint).**
- **Tempo máximo, fila e orçamento dos 2.000 minutos mensais.** Sem cartão cadastrado, quando a cota acaba, tudo para, inclusive o backup.
- **gitleaks no lugar da varredura de segredos.** O GitHub não oferece varredura de segredos em repositório privado de conta pessoal.

**Adaptamos:**
- **Releases imutáveis (versões que não podem ser alteradas) como registro da versão aprovada,** com as impressões digitais anexadas.
- **Dependabot (atualizações automáticas de versão) só para as ações dos workflows,** mensal e sem juntar nada sozinho.
- **Issue fixa "Precisa de você" e cartão de diagnóstico,** só com números.

**Evitamos:**
- **gh-aw:** ainda em teste público, e todos os motores dele exigem API paga ou Copilot pago.
- **Copilot agent e claude-code-action agora:** seria uma segunda IA escrevendo no repositório.
- **GitHub Models:** aposentado em 30/07/2026.
- **Runner próprio na VPS:** rodaria código das sessões na mesma máquina que guarda as chaves.
- **Projects como quadro dos agentes:** não trava passagens. O Supabase continua sendo a fonte.
- **CODEOWNERS e aprovação obrigatória:** você seria autor e revisor ao mesmo tempo.

### Outros sistemas de agentes (Anthropic, OpenAI, Microsoft, Pydantic AI, LangGraph, 12-Factor, MAST, DBOS)

**Já estamos alinhados:**
- **Workflow comandado por código.** A Helena é um fluxo de trabalho, não uma equipe que conversa.
- **Um escritor só, o motor.**
- **Esperas guardadas como estado no banco.** O LangGraph mostra os erros de quem "retoma no meio".
- **Revisão independente a cada fase.**

**Copiamos:**
- **pass^3 (acertar nas 3 vezes) no lugar da média.** Com 75% de acerto por tentativa, o pass^3 cai para cerca de 42%.
- **Separar "regressão" de "capacidade".** Regressão são os casos que já passavam e têm de continuar passando. Capacidade são os casos novos, que só mostram evolução.
- **Começar com 20 a 50 casos tirados de falhas reais** (Anthropic).
- **Dar ao revisor a resposta "não consigo conferir"** e um contexto limpo, sem a conversa do autor.

**Adaptamos:**
- **Ações como "ferramenta de saída" validada na hora (Pydantic AI).** Essa forma é chamada de "a que funciona melhor", e pedir JSON no texto é "a menos confiável".
- **Agente só volta, ou nasce, se tiver especialização real** (Microsoft e Anthropic). Sem isso, vira um serviço de um agente que já existe.

**Evitamos:**
- **Frameworks de agentes (LangGraph, CrewAI, Microsoft Agent Framework):** criam camadas que escondem o prompt.
- **Handoff livre e "chat de grupo" entre agentes:** risco de laço sem fim.
- **Langfuse na VPS:** seriam 6 contêineres a mais.
- **Juiz de IA isolado por critério:** multiplica o gasto de cota.
- **Tirar o "laço" do agente de dentro do Hermes agora:** isso só se decide com os números do dia de prova da fase 2, porque pode multiplicar o gasto de cota.

### Organização (Backstage, A2A, MCP, Sierra, Intercom Fin, Devin, Project Vend, Microsoft Entra)

**Copiamos:**
- **Uma verdade por tipo de coisa.** O AGENTS.md orienta, mas quem garante é a checagem automática.
- **Um registro único dos agentes (catálogo do Backstage).** Hoje há 9 cópias, e elas divergem. Por exemplo, o procedimento do Bruno (QA) é de growth.
- **Versão gravada em cada execução** (registro MCP e Sierra).
- **Ciclo de vida da lição: proposta, ativa e aposentada, com validade** (Intercom Fin).
- **Gerente de IA com o mesmo modelo tem os mesmos pontos cegos** (Project Vend). Por isso cada revisor é medido.
- **Todo agente tem um humano responsável** (Microsoft Entra). Aqui, esse humano é você.

**Adaptamos:**
- **Os campos do "Agent Card" do A2A, com o serviço como unidade,** sem adotar o protocolo.

**Evitamos:**
- **O protocolo A2A:** agentes conversando por HTTP aumentariam a superfície de ataque.
- **Trazer de volta os 16 agentes só porque existiam na v1.**
- **Criar uma pasta nova `sistema/`,** que duplicaria a `helena-v2/`.

---

## 4. Melhorias aprovadas

Todas as 48 propostas abaixo foram verificadas por dois revisores e corrigidas. O que vai aqui é a versão corrigida. Nenhuma fere a DEC-014 nem pede plano pago sem decisão sua.

- **P0:** antes da fase 2.
- **P1:** durante as fases 2 e 3.
- **P2:** depois.

### P0. Estancar a v1 e fechar as portas

**MEL-01 · Fase 0 em duas partes: estancar e vigiar**
- **Problema:** não há cópia completa do banco antes das mudanças da fase 0. A regra atual copia só as tabelas tocadas, sem acessos, papéis e tarefas agendadas. O botão de publicar está na fase 0, mas só pode ser provado com motor e card de ensaio, ou seja, na fase 2. O diagrama ainda põe a troca das chaves na fase 3.
- **Mudança:** fase 0a, "Estancar", com portão só por teste:
  1. Inventário só de leitura e checklist da v1 (login, WhatsApp, saúde do gateway, uma tarefa do Hermes, formulário de leads, tarefas agendadas), rodado antes e depois de cada passo.
  2. Checagem de invasão, varredura de fora, verificação em duas etapas e um vigia mínimo por e-mail. As portas 9119 e 8642 fecham logo depois da checagem, sem esperar a cópia, porque não tocam no banco.
  3. Cópia completa e criptografada antes de qualquer mudança no banco ou nas chaves, conferida num Supabase local, sem cofre, senhas e sessões.
  4. Fechar o que é barato e tem volta: modo de teste, cadastro, papel de fundador no acesso público, WhatsApp só no seu número, funções abertas ao anônimo.
  5. Chaves: uma por peça, desligar o par antigo e depois revogar. Se houver invasão, conter primeiro, mesmo derrubando a v1.

  A fase 0b, "Vigiar", corre junto com a fase 1 e precisa fechar antes da fase 2. A publicação vai para o começo da fase 2, com um motor "olá".
- **Ganho para você:** o que está exposto fecha em dias, com uma cópia para voltar se algo quebrar.
- **Quem faz:** sessões de IA preparam o roteiro, os scripts de volta e as conferências. Você digita as frases e faz os cliques.
- **Sua frase:** sim, uma por passo, todas pedidas numa mensagem só.

**MEL-02 · Segredos fora do código e varredura a cada envio**
- **Problema:** a main tem 23 arquivos com segredos escritos, de 5 tipos: chaves do Supabase, token do gateway, token do Meowcaller e chave da Evolution. Um deles vai para produção: o `voice-agent.mjs` usa o token do Meowcaller como reserva. As regras padrão do gitleaks deixam passar 6 de 28 e não reconhecem as chaves novas do Supabase.
- **Mudança:**
  - Inventário com o gitleaks em modo que esconde os valores.
  - Os scripts passam a ler variáveis de ambiente e param se faltar alguma. Os scripts de uso único saem do repositório.
  - A reserva do `voice-agent` só sai depois de confirmar que a variável existe no EasyPanel.
  - Regras próprias do gitleaks (testadas: pegam 28 de 28). Exceções guardadas só por impressão digital, nunca por valor.
  - Varredura de todos os ramos a cada envio. Leva cerca de 4 segundos.
  - Não reescrever o histórico, mas revogar o segredo antigo depois que a v1 estiver nas chaves novas.
- **Ganho para você:** uma chave nova vazada é detectada cerca de 1 minuto depois de ser enviada. As antigas param de valer de vez quando forem revogadas.
- **Quem faz:** sessões. Você confere o nome da variável no EasyPanel, troca e revoga as chaves e toca na publicação do gateway.
- **Sua frase:** sim.

**MEL-03 · Fechar a superfície do Supabase**
- **Problema:** o Supabase dá ao anônimo leitura e gravação em toda tabela nova e execução em toda função nova. O plano só fecha funções e gravação. A v1 deu e tirou acessos várias vezes. O `receive-leads` está aberto e o código dele não está no repositório.
- **Mudança:**
  - As tabelas da v2 ficam num esquema `helena_v2`, sem nenhum acesso de fora.
  - As funções do app ganham o prefixo `v2_`, com acessos dados e tirados por extenso, e chamam uma única função de conferência compartilhada.
  - Um teste de catálogo só de leitura exige "nada aberto" na v2 e acusa só o que for novo na v1.
  - As Edge Functions são conferidas sem guardar token do Supabase no GitHub.
  - Inventário das 61 tabelas, com uma única pergunta agrupada a você, já com a resposta recomendada: "fica fechada; nada é apagado".
- **Ganho para você:** reduz e detecta a reabertura de acessos e protege os dados das pessoas recrutadas (LGPD).
- **Quem faz:** sessões. Você responde o cartão e diz onde está o código do `receive-leads`.
- **Sua frase:** sim, para criar os esquemas e para qualquer mudança de acesso na v1.

**MEL-04 · Saber e limitar quem escreve no repositório**
- **Problema:** há 255 commits do Lovable. A main foi recriada em 30/09, e o Lovable pode ainda estar ligado a ela. Não se sabe quais apps e tokens escrevem no repositório. O nome do autor de um commit pode ser inventado.
- **Mudança:**
  - Pergunta: "Você ainda usa o Lovable?". Se não usa, desligar a ligação dele com o GitHub e revogá-lo no Supabase, sem apagar os dados dele.
  - Revisar apps e tokens, marcar "Only select repositories" e não dar permissão de mexer em workflows.
  - Mandar só os nomes, nunca os valores.
  - Supabase Auth só com o domínio do app.
  - Seção "plataformas conectadas" na lista de chaves.
  - Um job registra a conta que de fato enviou cada mudança. Fica escrito que isso é rastreio, não trava.
- **Ganho para você:** fica sabido quem escreve, e ferramenta esquecida aparece.
- **Quem faz:** você, nas telas do GitHub, do Lovable e do Supabase. Sessões montam a lista.
- **Sua frase:** sim.

**MEL-18 · Inventário das APIs pagas da v1**
- **Problema:** o gateway da v1 chama a API paga da OpenAI na voz, em 4 arquivos, e também xAI, ElevenLabs, Google Cloud e TypeSafe. Não achamos exceção escrita à DEC-014. Trocar a chave da OpenAI sem saber disso pode derrubar as ligações. O teste 6 (processador abaixo de 70%) não tem uma medida de partida.
- **Mudança:**
  - Lista dos serviços pagos tirada do código. Você cola só os nomes das variáveis e informa o gasto do mês.
  - 24 horas de medição de processador e memória.
  - Contagem, só de leitura, das execuções da v1.
  - Um cartão por serviço: desligar, manter como exceção escrita com teto, ou manter só para teste.
  - Limites de contêiner aplicados um serviço por vez, sem limite rígido no WhatsApp e na voz.
- **Ganho para você:** você sabe o que a v1 gasta, e nada para em silêncio.
- **Quem faz:** sessões. Você cola os nomes, informa os gastos e decide.
- **Sua frase:** sim, para limites e para desligar.

**MEL-33 · App que falha fechado**
- **Problema:** o app traz endereços de produção escritos no código. Se o gateway falhar, ele manda o seu token de login para o endereço local (localhost:3999) do computador de quem está usando. O servidor de teste fica aberto para a rede.
- **Mudança:**
  - Nenhum valor de produção no código.
  - A montagem de produção falha se faltar variável, e assim a versão anterior continua no ar.
  - A reserva para o endereço local só existe em modo de desenvolvimento.
  - Servidor de teste só no próprio computador.
  - Testes automáticos do app no GitHub, com varredura do pacote montado.
  - O modo de teste sem senha é apagado.
- **Ganho para você:** nenhuma cópia fala com a produção por acidente.
- **Quem faz:** sessões. Você confere as variáveis da hospedagem junto com a sessão.
- **Sua frase:** só se faltar variável na hospedagem. Publicar segue o toque normal.

### P0. Publicar e GitHub

**MEL-05 · No GitHub, a sessão é você: o toque de publicar vai para o EasyPanel**
- **Problema:** a sessão entra como tvmensal2025, com papel de administrador. No plano grátis, repositório privado não tem ambientes nem revisão obrigatória. Nenhuma regra do GitHub separa você da sessão, então a trava das l. 229 e 388 não se sustenta.
- **Mudança:**
  - Nenhuma credencial que mude produção fica no GitHub: nem senha de migração, nem endereço de deploy, nem acesso ao EasyPanel.
  - O GitHub só testa e monta a imagem.
  - Publicar são dois toques. (1) No app, "Preparar publicação" pausa e esvazia a fila e mostra a impressão digital. (2) No EasyPanel, você cola e aperta Deploy.
  - A migração roda ao ligar, só se houver mudança pendente, e não tenta de novo em laço se falhar.
  - **A volta automática deixa de existir.** A versão nova se confere e leva um card de ensaio até o fim. Se falhar, não pega trabalho e você recebe "volte para X".
- **Ganho para você:** a trava deixa de depender do GitHub. O toque decide quando e qual versão vai ao ar. O conteúdo continua protegido pelos testes.
- **Quem faz:** sessões. Você guarda a credencial de migração no EasyPanel e confirma se ele tem verificação em duas etapas.
- **Sua frase:** sim.

**MEL-06 · Imagem montada uma vez e volta pela impressão digital**
- **Problema:** hoje, voltar é remontar a imagem na VPS dividida. É lento, disputa o processador e pode sair diferente. As etiquetas de uma imagem podem ser regravadas.
- **Mudança:**
  - A imagem da v2 é montada no GitHub só quando aquele serviço mudou, e é testada dentro da própria imagem.
  - Fica guardada no registro privado do GitHub (GHCR). A impressão digital aprovada fica anexada a uma versão que não pode ser alterada.
  - No EasyPanel, o campo é sempre a impressão digital, nunca uma etiqueta móvel, e a publicação automática fica desligada.
  - Voltar é colar a impressão digital anterior.
  - O gateway da v1 continua por zip até a troca.
- **Ganho para você:** o que está no ar é exatamente o que foi testado, e voltar não monta nada. O tempo da volta é medido no ensaio, sem promessa.
- **Quem faz:** sessões. Você cria um token só de leitura de pacotes e liga as versões imutáveis.
- **Sua frase:** sim.

**MEL-07 · Padrão de workflow e orçamento de minutos**
- **Problema:** os 3 workflows usam versões móveis e não têm permissões mínimas, tempo máximo nem fila. A v1 sozinha já gasta cerca de 730 dos 2.000 minutos grátis por mês.
- **Mudança:**
  - Um modelo único: permissões mínimas por job, ações fixadas pela impressão digital, tempo máximo e fila.
  - Auditoria automática dos workflows.
  - Dependabot só para as ações, uma vez por mês.
  - Meta abaixo de 1.200 minutos por mês, com avisos em 70% e 90%. Se for preciso cortar, primeiro sai o CI (testes automáticos) fora da main; o backup nunca é cortado.
- **Ganho para você:** um workflow ruim acende vermelho e não é publicado, e a cota não acaba sem aviso.
- **Quem faz:** sessões. Você faz 3 cliques em Settings > Actions.
- **Sua frase:** sim.

### P0. Uma fonte da verdade

**MEL-08 · Uma main só, mexendo o mínimo**
- **Problema:** o plano v3 e as fichas não estão na main. Há 33 ramos, e 17 deles não têm nenhuma base comum com a main. Circulam duas frases de aprovação diferentes.
- **Mudança:**
  - Antes de qualquer junção, você confere no EasyPanel se algum serviço publica sozinho a partir da main. O README do gateway diz que sim. Se for o caso, juntar na main é publicar.
  - Um PR (pedido de mudança) a partir do ramo `claude/gallant-cray-xrdt0t`, que já tem o plano e as fichas (validador OK, 9 testes passando), sem mover arquivos.
  - O plano antigo vai para o histórico com a linha "SUBSTITUÍDO POR".
  - Checagem "fonte única" nos testes automáticos.
  - Os ramos ganham uma etiqueta de arquivo (`arquivo/2026-10-10/<ramo>`) e são apagados em duas rodadas.
  - Uma checagem semanal confere que as etiquetas continuam no lugar.
  - A l. 345 passa a dizer "conferir o repositório", que já existe.
- **Ganho para você:** um lugar só, um plano e uma frase.
- **Quem faz:** sessões. Você confere o EasyPanel, aprova o PR, dá o OK para os ramos e decide o PR #5.
- **Sua frase:** sim.

**MEL-09 · Duas portas de entrada para as sessões**
- **Problema:** as instruções estão espalhadas e se contradizem. O HANDOFF aponta para o plano antigo. Nada registra onde a última sessão parou.
- **Mudança:**
  - O AGENTS.md ganha no topo a seção "Duas portas", e o texto atual fica intacto.
  - **Porta v1:** como hoje, só leitura a partir do checkpoint.
  - **Porta v2:** construir em arquivos. Qualquer afirmação sobre o que está no ar fica "NÃO CONFIRMADO" até o cartão de diagnóstico existir.
  - A porta é escolhida pelas pastas mexidas, não pela sessão.
  - Um CLAUDE.md que só aponta para o AGENTS.md.
  - Um `docs/estado/construcao.md` com campos fixos, atualizado em todo PR.
  - Checagem de "arrumação" só nos arquivos novos.
  - Uma sessão de construção por vez.
- **Ganho para você:** toda sessão começa e termina no mesmo lugar, e a bagunça nova aparece no PR. Ela fica visível, não impossível.
- **Quem faz:** sessões.
- **Sua frase:** precisa do seu OK explícito no PR, porque muda uma regra sua.

**MEL-10 · Livro de autorizações**
- **Problema:** hoje a sua autorização fica só na conversa, e nada diz qual versão foi aprovada.
- **Mudança:**
  - Um arquivo por pedido, `docs/autorizacoes/AUT-NNNN.md`, com: o que muda, como desfazer, o estado conferido antes, a versão congelada (commit e impressões digitais) e a frase pronta, com número.
  - **Aprovação de versão:** vale enquanto a versão existir.
  - **Autorização de execução:** vale para uma execução e vence em 7 dias se não for usada.
  - Comando direto seu (DEC-022) já vale como autorização.
  - A sessão só pula a pergunta se tudo bater. Na dúvida, pergunta.
  - Fica escrito no topo que o livro registra, não trava.
- **Ganho para você:** o que você autorizou sobrevive à troca de sessão e de modelo, com menos pedidos repetidos.
- **Quem faz:** sessões.
- **Sua frase:** o formato passa a valer com o próprio AUT-0001, a aprovação do plano.

**MEL-11 · Onde mora cada coisa**
- **Problema:** o plano não diz onde ficam lições, exemplos, regras "nunca" e preferências. O AGENTS.md põe as fichas da v2 abaixo do checkpoint da v1.
- **Mudança:** uma tabela única (seção 5).
  - Trabalho e decisões ficam no Supabase. As decisões usam a `public.decisoes` que já existe, sem criar uma segunda tabela.
  - Treino fica no Supabase, com versão.
  - Especificação fica na `helena-v2/`, e vale a versão publicada.
  - Arquivos gerados nunca são editados à mão.
  - Regra de passagem: o *tipo* da checagem é especificação; o *valor* é decisão sua. Exemplo: o teto de orçamento muda pelo app, sem publicar.
  - Cada execução grava as versões que usou.
- **Ganho para você:** cada informação tem um dono, e mudar um valor não espera publicação.
- **Quem faz:** sessões.
- **Sua frase:** não, para o plano. Sim (o seu OK), para mudar a ordem de precedência no AGENTS.md depois da primeira publicação da v2.

**MEL-12 · Fila "Precisa de você" e guia de uma tela**
- **Problema:** a renovação da Hostinger não está no plano. A lista do que depende de você está desatualizada e ainda pede para "criar o repositório". Não há guia nem glossário.
- **Mudança:**
  - Agora: um cartão da Hostinger com opções A, B e C. Quem paga é sempre você.
  - Uma fonte única, `docs/fundador/precisa-de-voce.yaml`, com prazo e "o que acontece se você não fizer".
  - Um guia "onde faço o quê" e um glossário de até 25 termos.
  - Uma issue fixada, reescrita todo dia sem senha, que menciona você quando faltarem 3 dias.
  - "Manual do fundador" passa a se chamar "Preferências do fundador".
- **Ganho para você:** uma lista só, com prazos, no celular.
- **Quem faz:** sessões. Você fixa a issue uma vez.
- **Sua frase:** não.

**MEL-13 · Plano conferido por máquina**
- **Problema:** o diagrama contradiz o plano: chaves na fase 3, portão da fase 2 com "testes 1 a 8", fase 1 "pronta", e o "9 de 9" que na verdade são 8 defeitos e 1 teste. Faltam os furos M-12 e M-17 a M-22, sem explicação.
- **Mudança:**
  - Corrigir o texto e o diagrama já.
  - Criar `fases.yaml` e `testes.yaml`.
  - Um script nos testes automáticos falha quando: um furo cita teste inexistente, um teste roda depois da fase do furo, um ID some, aparece uma variante da frase de aprovação, ou a situação de uma fase foi escrita à mão.
  - A situação de cada fase é calculada.
- **Ganho para você:** o que você lê no plano é o que o código confere.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-14 · Testes automáticos das especificações e do app**
- **Problema:** nenhum workflow roda a `helena-v2/` nem o app. As versões das dependências não estão travadas. Hoje, uma ficha com `modelo: cota` passa no validador.
- **Mudança:**
  - Dependências com versão exata e impressão digital.
  - Dois workflows sem senha: um para as especificações e outro para o app.
  - O validador confere também os próprios esquemas e fecha o furo do "cota".
  - A versão de cada ficha passa a ser calculada (impressão digital), não digitada.
  - Não apagar o `bun.lockb` antes de saber como o app é publicado.
- **Ganho para você:** uma ficha errada é pega no envio.
- **Quem faz:** sessões.
- **Sua frase:** não.

### P0. Banco, backup e custo

**MEL-15 · Três ambientes de teste**
- **Problema:** o plano diz que os testes rodam "no banco de verdade" e cita um "ambiente de teste" sem definir. Os testes 4 e 10 cairiam no banco da v1, que não tem backup. As 73 migrations da v1 não montam o banco do zero e têm versões repetidas.
- **Mudança:**
  - **Testes destrutivos no GitHub,** num Supabase local descartável, na mesma versão da produção, sem nenhuma senha, com uma trava que recusa qualquer destino que não seja local.
  - As migrations da v1 vão para `supabase/historico-v1/`, e uma linha de base, só com a estrutura, é tirada da produção.
  - **Na produção, só o que precisa** da cota, do login, da VPS ou do estado real, sempre marcado e limpo no fim.
  - Um segundo projeto Supabase só por decisão sua.
  - O teste 10 vira uma conta com o tamanho real.
  - O teste pesado roda só antes de publicar e uma vez por semana.
- **Ganho para você:** os testes destrutivos deixam de tocar a produção. Os que ficam lá gravam pouco, marcado e limpo.
- **Quem faz:** sessões.
- **Sua frase:** sim, para a leitura e para qualquer conserto do histórico de migrations.

**MEL-16 · Backup num repositório fora do alcance das IAs**
- **Problema:** o plano não diz onde fica o backup. No GitHub grátis, qualquer workflow do repositório que as IAs mexem lê todos os segredos. Os dois formatos (parcial e semanal) misturam momentos diferentes.
- **Mudança:**
  - Um repositório `helena-backup`, criado por você, sem nenhum app de IA.
  - Cópia completa toda noite às 03:17, com um papel só de leitura, comprimida e criptografada com a chave pública, anexada a uma release (que não conta nos 500 MB).
  - Formato único: completa toda noite, se couber; se não, a cada 2 ou 3 noites.
  - A restauração semanal é o único job com a chave privada, e não roda código do repositório principal.
  - Depois de restaurar, o motor começa vazio. Uma ação externa aprovada depois da cópia volta para "esperando você".
  - Se o DBOS ficar, a parte dele no backup vira obrigatória.
- **Ganho para você:** um backup que as IAs não alcançam e que restaura sem repetir trabalho.
- **Quem faz:** você cria o repositório, restringe os apps e cola 2 segredos (cerca de 30 minutos). Sessões preparam os arquivos.
- **Sua frase:** sim, para criar o papel de leitura.

**MEL-17 · Cartão "Supabase grátis ou Pro"**
- **Problema:** o plano deixa o grátis valer por padrão e só pergunta se o teste 10 falhar, na fase 2. Mas o backup e os avisos são construídos na fase 0.
- **Mudança:** na fase 0, depois de medir, você recebe um cartão.
  - **A) Grátis:** R$ 0, mais trabalho. Pausa depois de 7 dias sem uso, limite de 500 MB e regra de "uso justo" contada por organização.
  - **B) Pro:** a partir de US$ 25 por mês, mais cerca de US$ 10 por projeto a mais, mais IOF. Com o limite de gasto ligado, o teto vira 8 GB. O backup de fora continua.
  - Sem resposta, fica A.
- **Ganho para você:** decidir com números, antes de construir duas vezes.
- **Quem faz:** sessões medem. Você decide.
- **Sua frase:** sim, para mudar de plano.

**MEL-19 · Medidor único de cota**
- **Problema:** o plano reserva "uma parte fixa do limite", que ninguém conhece (15 a 160 mensagens a cada 5 horas no Sol, número não reconferido). Ele não trata a janela semanal nem créditos avulsos.
- **Mudança:**
  - O motor lê a porcentagem real da conta (que já inclui a v1) pelo comando `hermes usage --json`, no máximo a cada 5 minutos.
  - Card novo só abaixo de 50% na janela curta e de 60% na semanal.
  - Até 80% continuam a Helena, os revisores e os cards em andamento. A partir de 80%, tudo pausa e aparece a hora de volta.
  - Você confirma saldo de crédito zero e recarga automática desligada. O motor avisa se o saldo cair.
- **Ganho para você:** a v2 para antes do limite e não atrapalha a v1.
- **Quem faz:** sessões. Você confere o saldo e a recarga.
- **Sua frase:** não.

### P0. Motor e regras exatas

**MEL-20 · Tirar o DBOS: motor próprio no Postgres (decisão nº 1, sua)**
- **Problema:** com 2 passos por execução e as esperas no banco, o DBOS só daria a fila e a retomada. Em troca, ele traz:
  - uma segunda máquina de estados, fora da prova;
  - retomadas até 100 vezes por padrão;
  - ordem aleatória entre agentes quando há teto geral;
  - fluxos ressuscitados numa restauração de backup.
- **Mudança:**
  - A própria tabela de etapas é a fila. A próxima etapa é escolhida por prioridade e por ordem de chegada, com vaga livre, cota e pausa conferidas.
  - Cada etapa tem uma reserva com prazo, renovada a cada 5 segundos.
  - Ao ligar, o motor pega uma trava única. Etapa com resposta gravada vai para a validação. Etapa sem resposta conta como "queda", sem gastar tentativa. Na 3ª queda, vem para você.
  - O vigia só acusa.
  - Sai do plano tudo o que era do DBOS.
- **Ganho para você:** uma máquina de estados só, inteira dentro da prova.
- **Quem faz:** sessões.
- **Sua frase:** sim. Se você preferir manter o DBOS: no máximo 3 retomadas, vigia só acusando, e a parte do DBOS no backup vira obrigatória.

**MEL-21 · Uma vaga de trabalho e uma da Helena**
- **Problema:** hoje são 1 ou 2 vagas por agente, até 3 ao mesmo tempo. Isso exige uma fila dividida, sem proteção contra repetição, e pesa na VPS e no login.
- **Mudança:**
  - 1 vaga de trabalho para todos, por prioridade e chegada.
  - 1 vaga curta, só para a Helena entender as suas mensagens.
  - No máximo 2 processos do Hermes ao mesmo tempo.
  - A vaga conta só processo vivo e se libera sozinha. É o contrário do WIP da v1, que travava.
  - A 2ª vaga de trabalho só é proposta a você se os testes mostrarem sobra de cota e espera alta.
- **Ganho para você:** menos disputa de máquina e de login. A meta das 10 pessoas (cerca de 12 tarefas e 3 horas de modelo, em 7 dias) cabe com folga rodando uma de cada vez.
- **Quem faz:** sessões.
- **Sua frase:** não, agora. Sim, para a 2ª vaga, quando vier.

**MEL-22 · Cada regra escrita uma vez só**
- **Problema:** a prova, a trava e o vigia poderiam somar até 37 versões da mesma lógica, como na v1, que tinha uma função redefinida 7 vezes.
- **Mudança:**
  - A tabela de passagens vira um arquivo de dados.
  - Uma função única muda o estado, escrita uma vez.
  - A impressão digital é calculada a partir do próprio banco, então uma edição à mão é pega.
  - Uma função de leitura por regra.
  - A trava recusa só violação nova e nunca bloqueia Cancelar.
  - Uma regra nova passa 24 horas só acendendo uma luz antes de travar.
- **Ganho para você:** uma definição por regra, usada pela prova, pela trava e pelo vigia.
- **Quem faz:** sessões.
- **Sua frase:** não, para o texto. Aplicar no banco segue a frase da fase 2.

**MEL-23 · Prova em camadas, com o tamanho impresso**
- **Problema:** "todas as combinações do card" não cabe num teste, porque o número de estados explode. E a frase "todo contador tem teto" é falsa, porque os seus pedidos não gastam limite.
- **Mudança:**
  - **Camada 1:** todos os estados de uma etapa.
  - **Camada 2:** o card sobre o roteiro, com cada etapa resumida em 5 situações.
  - **Camada 3:** a ligação entre as duas.
  - O teste imprime "N estados, M passagens, 0 violações" e falha de forma visível se passar do teto.
  - A regra 5 fica por extenso: "todo card termina quando você para de pedir ajustes".
  - Escolher um único teto de voltas da E4. Hoje são 1 no roteiro e 2 no plano.
- **Ganho para você:** uma prova que dá para rodar e conferir.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-24 · Plano só por roteiro na v2.0**
- **Problema:** a Helena replaneja, divide etapas no meio e pede sub-card. Isso põe a IA no caminho de controle, fora da conferência.
- **Mudança:**
  - Todo card nasce de um roteiro do catálogo ou de um serviço avulso de uma etapa, escolhido numa lista fechada. O grafo é montado pelo código.
  - Divisão de etapa só quando o roteiro a declara.
  - Sem sub-card até a fase 4.
  - "Em resolução" vira um cartão único com opções fixas: (1) refazer com 1,5 vez o orçamento, até 2 vezes; (2) seguir sem a etapa, só se o roteiro permitir e nunca na E4 nem na E5; (3) encerrar.
  - O roteiro das 10 pessoas é alinhado antes (E3 deixa de depender da E1).
- **Ganho para você:** o caminho é fixo e provado, e a IA só escolhe entre opções válidas.
- **Quem faz:** sessões.
- **Sua frase:** não. Entra no texto antes da sua aprovação.

**MEL-25 · No app, o tipo da mensagem vem do botão**
- **Problema:** o plano manda a Helena classificar toda mensagem. Mas, até a troca de canal, a v2 só recebe pelo app, onde o botão já diz o tipo.
- **Mudança:**
  - Uma caixa "Novo pedido" cria o rascunho do card pelo código, antes de qualquer IA. Depois vêm a leitura de volta e o seu "Confirmo".
  - Em cada card: Aprovar, Pedir ajuste (com motivo), Usar como exemplo, Responder (ligado à pergunta) e Cancelar (com confirmação).
  - Texto escrito fora de um botão vira comentário e nunca muda nada.
  - A conversa livre continua no WhatsApp da v1.
  - O classificador por IA passa para o portão da fase 4.
- **Ganho para você:** nas fases 2 e 3, nenhuma mensagem tem o tipo decidido pela IA.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-26 · Organograma e catálogo de serviços como dados**
- **Problema:** o "cardápio" de serviços nunca foi definido. As cópias dos agentes divergem: a Isabela é revisada pela Camila num lugar e pela Helena em outro, e o Bruno (QA) aparece na área "cliente".
- **Mudança:**
  - Dentro da `helena-v2/`: um `organograma.yaml` com 21 linhas e um `servicos.yaml`. Cada serviço tem exemplos de pedido, o que não atende, entrega, dono, revisor, reserva, empresas e ações permitidas.
  - Estados de cada serviço: rascunho, em teste, estágio, ativo, pausado e aposentado.
  - O código só calcula se o serviço está "apto". Subir de estado exige o seu toque. Descer é automático.
  - Estágio e ativo rodam na v2. O resto fica na v1.
  - Começa com 0 serviços ativos e os 5 serviços da meta em estágio.
- **Ganho para você:** o caminho de cada pedido vira regra de código, e o serviço escolhido aparece para você.
- **Quem faz:** sessões. Você toca em cada promoção.
- **Sua frase:** sim.

### P0. Qualidade das entregas

**MEL-27 · A ação do agente chega por ferramenta, com formato fechado**
- **Problema:** não há esquema das 5 ações nem campos tipados por entrega: a citação é "[Fn]" e o cálculo é texto livre. Sem isso, o portão 1 não tem o que conferir.
- **Mudança:**
  - O agente entrega chamando uma ferramenta do nosso servidor: entregar, perguntar, devolver ou registrar falha. "Pedir sub-card" não fica liberado para nenhum serviço até a fase 4.
  - A primeira ação aceita encerra a execução. O servidor recusa na hora o formato errado.
  - Depois de ler a internet, perguntar e devolver ficam bloqueados.
  - Até 2 correções dentro da mesma execução. Depois disso, conta como "formato errado", com 1 nova tentativa.
  - A conta do Caio usa uma fórmula fechada, que o código refaz.
  - Isso é provado no dia de prova da fase 2. Se o Hermes não respeitar a ferramenta, o canal passa a ser o texto final conferido, e essa decisão fica registrada.
- **Ganho para você:** o portão 1 passa a ter o que conferir, e a conta é refeita pelo código.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-28 · Checagens com ID e furo ligado ao teste que o prova**
- **Problema:** o validador não lê as checagens das entregas. A cópia (texto do convite) e o cálculo não têm nenhuma. "Fechado" no registro quer dizer só "tem conserto escrito".
- **Mudança:**
  - Cada checagem vira uma função com ID, com um caso bom e um caso ruim.
  - O registro de furos vira `furos.yaml`, e o `.md` é gerado a partir dele. Cada furo tem uma situação: com conserto, provado, substituído ou não confirmado.
  - Cada furo tem uma prova por fase.
  - Os 37 furos da rodada 3 são importados do plano antigo.
  - O plano passa a mostrar contagens. Só quando sobrar zero aberto ele volta a dizer "nenhum furo conhecido em aberto".
- **Ganho para você:** "provado" passa a querer dizer que existe um caso que reproduz o furo e um teste que o recusa.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-29 · Rubrica com ID e a resposta "não consigo conferir"**
- **Problema:** a aprovação é texto livre e repete o que o código já confere. A rubrica da cópia contradiz o plano ("valores como estimativa"). O revisor que só pode aprovar ou reprovar tende a aprovar o que não conseguiu conferir.
- **Mudança:**
  - O "pronto" vira três camadas com ID: as checagens do tipo de entrega, a rubrica do serviço (até 8 critérios, com risco) e os itens do card.
  - Por critério, o revisor responde APROVADO, REPROVADO ou NÃO CONSIGO CONFERIR.
  - Se a prova falta na entrega, volta ao autor. Se está fora do alcance do revisor e o risco é alto, vira pergunta para você; se o risco é baixo, segue com ressalva visível.
  - O texto do cartão é montado pelo código, nunca com as palavras do revisor.
- **Ganho para você:** o revisor não é forçado a escolher, e nada "sem conferir" aparece como aprovado.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-30 · Relatório final (E5) montado pelo código**
- **Problema:** a ficha da Helena diz que o relatório é revisado "pelo código e por 👍/👎". Isso contradiz a regra 9 e a tabela do plano, que dizem Clara revisa e Caio é a reserva.
- **Mudança:**
  - Duas partes. **Montada pelo código:** referências às entregas aprovadas, números, todos os riscos e perguntas, fontes e o que só você faz. **Escrita pela Helena:** resumo de 5 linhas e próximos passos, cada frase com referência.
  - A Clara confere só a fidelidade: diz o mesmo que a fonte, não esconde risco, respeita as dependências.
  - Revisor e reserva definidos por tipo de entrega.
- **Ganho para você:** o resumo deixa de ser texto livre da IA sobre E1 a E4.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-31 · Banco de casos com respostas gravadas e regressão em 3 de 3**
- **Problema:** "todo erro vira teste" não tem pasta nem formato. A troca de modelo decide pela média ("cai até 5 pontos"), que esconde um caso que passou a errar sempre.
- **Mudança:**
  - Cada caso guarda uma "fita": as respostas das ferramentas, gravadas.
  - **Camada A,** no GitHub, testa o código sem gastar cota.
  - **Camada B,** na VPS, roda o modelo real com as ferramentas simuladas. Esse modo só existe em teste, e o motor recusa ligar em produção com ele.
  - A regressão exige 3 de 3. Se a versão atual também falhar no caso, ele é marcado como instável e desce para a capacidade.
  - Um caso de capacidade sobe para a regressão depois de 5 rodadas seguidas em 3 de 3.
  - Casos da v1 só entram anônimos e com a sua autorização.
- **Ganho para você:** "3 de 3 nestes casos" vira uma medida, e um erro que já apareceu não volta sem ser pego.
- **Quem faz:** sessões.
- **Sua frase:** não, para casos sintéticos. Sim, para a rodada real na VPS e para ler a v1.

### P1. Durante as fases 2 e 3

**MEL-34 · Internet só por lista de endereços, e sem "buscar" até a fase 4**
- **Problema:** o plano dá "buscar" sem dizer qual serviço de busca usar. Todos custam, pesam na VPS ou exigem conta nova, e a primeira meta não precisa de busca aberta.
- **Mudança:**
  - Na fase 2, sem internet em produção. A ferramenta é provada contra páginas falsas.
  - Na fase 3, só "ler página", numa lista montada pelo código: links do seu pedido, fontes importadas que você aprovou, termos da Mimix e do Hub e a tabela de leis.
  - Uma fonte fora da lista vira "fonte insuficiente". O site aparece em texto simples, nunca como link de um toque.
  - Isabela fica sem ferramenta de leitura. Clara fica só com "ler página".
- **Ganho para você:** menos uma decisão, menos um gasto e menos uma porta para texto plantado.
- **Quem faz:** sessões. Você aprova as fontes junto com o plano da meta.
- **Sua frase:** não.

**MEL-35 · Contrato do executor: o Hermes atrás de um adaptador**
- **Problema:** as mais de 12 travas do Hermes estão espalhadas pelo plano, e o teste 3 foi escrito só para ele.
- **Mudança:**
  - Um contrato fixo de entrada e saída: a ação, um registro de uso que diz de onde vem cada campo, e a classe da falha.
  - Um adaptador único do Hermes, com teste próprio.
  - O teste 3 vira duas partes: uma de conformidade, que serve para qualquer executor e não gasta cota, e uma específica do Hermes.
  - O Codex só vira reserva na fase 4, depois de passar nesses testes, e sem chave de API no ambiente.
- **Ganho para você:** trocar de executor vira escrever um adaptador e passar nos testes.
- **Quem faz:** sessões.
- **Sua frase:** não, agora. Sim, para instalar o Codex na fase 4.

**MEL-36 · Cartão de diagnóstico que mostra também as panes**
- **Problema:** se o Supabase escrevesse o cartão com um token seu, o cartão pararia justo quando o banco fica só leitura, e abriria caminho para texto plantado.
- **Mudança:**
  - Um job do GitHub lê só uma tabela de números, com um papel limitado, e escreve na issue fixa.
  - Quando não consegue ler, escreve "banco só leitura" ou "inacessível às HH:MM".
  - Mostra sempre "atualizado às HH:MM".
  - Um teste confere que essa tabela só tem números e códigos.
- **Ganho para você:** quem conserta enxerga o sistema sem o seu PC, inclusive nas panes.
- **Quem faz:** sessões.
- **Sua frase:** sim, para a tabela de números e o papel.

**MEL-37 · Um remetente de avisos só**
- **Problema:** hoje são três remetentes de avisos, e o token do robô ficaria no banco. Com o banco só leitura, o aviso que sai de dentro do Supabase morre.
- **Mudança:**
  - O vigia e o relógio só gravam o aviso numa tabela. Só o motor envia pelo Telegram, com reenvio.
  - A entrega é "pelo menos uma vez": um aviso pode, raramente, chegar repetido.
  - Do Supabase só sai um sinal de vida para o healthchecks.
  - Um aviso parado há mais de 15 minutos dispara alarme pelo robô do próprio healthchecks e por e-mail.
  - Um prazo só aplica o padrão depois que o lembrete foi entregue.
- **Ganho para você:** um segredo a menos no banco, e um envio travado não fica mudo.
- **Quem faz:** sessões. Você manda /start ao HealthchecksBot.
- **Sua frase:** não.

**MEL-38 · Trava do navegador num arquivo testado**
- **Problema:** o plano promete uma trava que bloqueia imagens e scripts de fora, mas não existe lugar para configurá-la. E não está confirmado quem serve o app hoje.
- **Mudança:**
  - Primeiro, só lendo, descobrir quem serve a página que o seu celular abre.
  - Uma política única, feita a partir das origens que o app usa de verdade, injetada no build e, se for EasyPanel, também nos cabeçalhos.
  - A trava passa a valer por teste: todas as telas abrem sem violação e uma imagem plantada é bloqueada. Não por esperar 7 dias.
- **Ganho para você:** imagem ou script de fora não carrega no app.
- **Quem faz:** sessões.
- **Sua frase:** sim, para hospedagem e publicação.

**MEL-39 · App antigo aberto não aperta botão de regra nova**
- **Problema:** uma aba antiga aberta no celular pode apertar um botão depois que a regra mudou.
- **Mudança:**
  - O app confere a versão ao voltar ao foco, a cada 5 minutos e antes de cada toque.
  - Se a versão mudou, aparece uma faixa e os botões de efeito travam até recarregar. Cancelar e Pausar tudo nunca travam.
  - O banco recusa chamadas abaixo da versão mínima.
  - A versão mínima nunca sobe acima da versão que estava no ar antes. Assim, voltar nunca tranca o app.
- **Ganho para você:** botão velho não age sobre regra nova.
- **Quem faz:** sessões.
- **Sua frase:** sim, para as funções do banco, junto com a fase 2.

**MEL-40 · Ver a tela nova no celular antes de publicar**
- **Problema:** você aperta "publicar" sem ver a tela.
- **Mudança:**
  - Só para as telas da v2. O GitHub monta o app com dados de exemplo inventados e entra pelo login de verdade.
  - Tira fotos em tamanho de celular, antes e depois, numa imagem por tela.
  - Qualquer pedido a um endereço de produção é recusado.
  - O pedido de publicar lista as prévias com o aviso "dados de exemplo; não provam que funciona".
- **Ganho para você:** ver antes de tocar, sem Vercel.
- **Quem faz:** sessões. Você confirma uma vez que a imagem abre no celular.
- **Sua frase:** não.

**MEL-41 · Revisor medido por tipo de entrega**
- **Problema:** o teste 9 soma os erros de todos os tipos. Um revisor cego para um tipo pode passar. Nada vigia o revisor depois que ele entra no ar.
- **Mudança:**
  - O teste 9 vale por revisor e tem um piso por par revisor × tipo: pegar pelo menos 3 de 5 erros e recusar no máximo 2 de 5 entregas limpas.
  - Nos tipos de risco alto, cada erro precisa ser pego em pelo menos 2 de 3 rodadas.
  - Um caso com erro plantado por noite, fora dos cards de verdade. Se o revisor deixar passar, antes de tirá-lo roda uma prova de confirmação.
  - O revisor nunca recebe a conversa do autor.
- **Ganho para você:** um revisor cego é pego antes de entrar no ar. Uma piora forte tende a aparecer em 1 a 2 semanas. Uma piora pequena só aparece no próximo teste 9.
- **Quem faz:** sessões.
- **Sua frase:** sim.

**MEL-42 · Boletim por serviço e disjuntor de qualidade**
- **Problema:** o painel mostra a "aprovação de primeira", que sobe quando o revisor é frouxo. O único disjuntor reage a falhas de execução, não a entrega errada que foi aprovada.
- **Mudança:**
  - Um "boletim" calculado pelo código, sempre em números ("3 de 4").
  - "Escape" é uma entrega aprovada que volta com o motivo "erro de fato".
  - Com 2 escapes nas últimas 10 entregas, o serviço entra em observação: você passa a ser o revisor final, com o aviso "leia antes de agir".
  - A "aprovação de primeira" vai para a aba Técnico.
- **Ganho para você:** entrega errada aprovada passa a contar e a ter consequência.
- **Quem faz:** sessões. Você marca o tipo do erro com um toque.
- **Sua frase:** sim, na fase 3.

**MEL-43 · Lição só fica ativa com efeito medido**
- **Problema:** hoje a lição só precisa não quebrar nada. Não precisa provar que conserta, e não tem teto nem validade.
- **Mudança:**
  - Prova: 3 rodadas sem a lição (tem de falhar pelo menos 2) e 5 rodadas com ela (tem de passar as 5), sem quebrar nenhum caso que já passava.
  - Erro intermitente vira cartão: "virar regra de código" ou "arquivar".
  - Teto de 10 lições por serviço. Uma proposta expira em 4 semanas.
  - Nada é ativado sem o seu toque, que vem em lote uma vez por semana, com botão "voltar".
  - As lições ficam no Supabase, com versão, e rodam de madrugada, dentro de um orçamento de cota.
- **Ganho para você:** a lição só entra quando o efeito aparece nos números. Isso não garante que ela conserte sempre.
- **Quem faz:** sessões. Você aprova em lote.
- **Sua frase:** não, para o texto. Sim, para implementar no banco.

**MEL-44 · Conjunto-ouro das suas mensagens antes da troca do WhatsApp**
- **Problema:** nada mede quantas vezes a Helena acerta a classificação das mensagens.
- **Mudança:**
  - 50 mensagens suas, pré-classificadas pela Helena e confirmadas por você no celular (10 a 20 minutos), guardadas no Supabase.
  - Exigência de 3 de 3 no tipo, na empresa e no card certo do ajuste. Mensagem ambígua tem como resposta certa "perguntar".
  - Roda primeiro no Luna: se ele passar, a classificação fica no Luna.
  - É condição para a troca do WhatsApp. O resultado é escrito como "acerto medido em 50 mensagens", nunca como "não erra".
- **Ganho para você:** a troca de canal acontece com o acerto medido.
- **Quem faz:** sessões. Você confirma as 50 mensagens.
- **Sua frase:** não, para o teste. Sim, para a troca de canal.

**MEL-45 · Treino com 3 gestos no card**
- **Problema:** o "vale sempre" vai para um lugar à parte e não passa pela checagem de contradição.
- **Mudança:**
  - (1) Pedir ajuste, com motivo.
  - (2) Marcar "Guardar como regra" num comentário, escolhendo "preferir" ou "nunca" e o alcance (o padrão é o serviço do card). Vira uma regra numerada no Supabase, sempre pela mesma checagem: "nunca" vence "preferir", e nenhuma regra afrouxa uma trava do código.
  - (3) Usar como exemplo.
  - Ao escolher "nunca", o app mostra o efeito e pede confirmação.
- **Ganho para você:** menos coisa para aprender, e um registro só.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-46 · Manual do mantenedor como receitas**
- **Problema:** o plano cita um "manual do mantenedor" que não existe, e a v1 tem cerca de 25 scripts avulsos de remendo.
- **Mudança:**
  - Receitas com 5 partes: arquivos, checagens, autorização, o que é proibido e "pronto quando".
  - As primeiras: mudar o banco e publicar e voltar.
  - A receita é declarada no próprio commit, e um teste confere se ela cobre o que mudou.
- **Ganho para você:** qualquer sessão faz a mudança na mesma ordem.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-47 · Lista de contas com dois caminhos de volta**
- **Problema:** com a verificação em duas etapas, perder o celular tranca você fora. O GitHub e o Supabase dizem que não devolvem o acesso. O plano esquece o e-mail principal, o ChatGPT, o Telegram e o healthchecks.
- **Mudança:**
  - Um `contas.yaml` só com rótulos, nunca com e-mail, telefone ou código.
  - Dois caminhos de volta por conta. No Supabase, um segundo fator em outro aparelho, porque ele não tem códigos de recuperação.
  - Códigos impressos guardados em dois lugares. SMS nunca como único caminho.
  - Ensaio com o celular desligado antes do portão da fase 2.
- **Ganho para você:** diminui o risco de ficar trancado fora.
- **Quem faz:** você (1 a 2 horas). Sessões montam a lista e o teste.
- **Sua frase:** não.

### P2. Depois

**MEL-32 · Escrever onde cada peça roda e por quê** (rebaixada de P0 para P2 pelos revisores)
- **Problema:** o plano não diz por que a Vercel fica de fora, e o gateway da v1 usa a API paga da OpenAI na voz.
- **Mudança:**
  - Uma tabela com o motivo de cada peça e uma linha do Workflow SDK ("não agora").
  - Uma guarda de pacotes só nas pastas da v2.
  - O motor não liga se encontrar chaves de API paga no ambiente.
  - Avisar você sobre a voz da v1, sem corrigir em silêncio.
- **Ganho para você:** a decisão fica escrita e não volta a cada sessão.
- **Quem faz:** sessões.
- **Sua frase:** não.

**MEL-48 · Rede fechada para o processo do agente**
- **Problema:** nada limita a rede do próprio processo do agente. O risco real é o Codex, que tem terminal.
- **Mudança:**
  - Agora, só no teste: o teste 3 roda sem internet, e qualquer conexão fora do servidor falso e das nossas ferramentas reprova a versão.
  - Na fase 4, o Codex só entra se o isolamento dele recusar endereços externos e internos. Se não recusar, vira um cartão de decisão para você.
  - O motor nunca recebe controle direto do Docker.
- **Ganho para você:** a prova, versão a versão, de que o agente só fala com o modelo e com as nossas ferramentas.
- **Quem faz:** sessões.
- **Sua frase:** sim, para qualquer mudança no servidor na fase 4.

---

## 5. Estrutura proposta

### 5.1 Organização dos agentes

Os 21 formam **um centro de serviços compartilhado pelas 4 empresas**. Não são 21 funcionários por empresa. A empresa é uma informação do card, e o agente recebe só o pacote daquela empresa: grafia, voz e proibições.

```
Você — responsável por todos
└─ Helena (AGT-01): coordena, dona do card
   └─ Centro de serviços (4 empresas)
      ├─ Números ........ Caio (AGT-05)
      ├─ Treino e copy .. Isabela
      ├─ Jurídico ....... Clara (AGT-06)
      ├─ Pesquisa ....... Ravi (pausado)
      └─ 16 na v1 ....... voltam 1 por vez
```

**Por empresa:**
- **iGreen, Saúde e Humano Digital:** contexto do card. A primeira meta é da Humano Digital (Mimix e Hub).
- **eLiving™:** grafia oficial (nunca "E-living"). Sirlene, Doutor Vital, Alex e Rafael são personagens do produto, não funcionários. Ficam fora do organograma, numa pasta própria. O prefixo de ID deles é decisão sua.
- **Laura:** escopo pessoal, sem acesso aos pacotes das empresas.

**Quem faz o quê em cada serviço (dados no `servicos.yaml`):**

| Papel | Quem |
|---|---|
| Faz | o agente dono do serviço |
| Aprova | o código (portões) e você (plano da meta e todo ato externo) |
| Consultado | Clara (jurídico), Caio (números), Ravi (pesquisa) |
| Informado | Helena, dona do card |

**Antes de reativar os 16:** resolver as sobreposições. Marina (PMO) e o motor; Bruno (QA) e o par revisor mais código; Olívia e Felipe; Augusto, Camila e Nina. Quem não tiver um serviço só seu continua pausado. Cada agente sobe pelos portões do MEL-26, um por vez (WIP = 1).

### 5.2 Organização do repositório

A main é a verdade. Nada da v1 se move: o checkpoint cita esses caminhos.

```
financeiromaxnutrition/   (main)
├─ AGENTS.md   regras + "duas portas"
├─ CLAUDE.md   só aponta p/ AGENTS.md
├─ helena-v2/  ESPECIFICAÇÃO (única)
│  ├─ organograma.yaml
│  ├─ servicos.yaml
│  ├─ agents/        fichas
│  ├─ deliverables/  entregas+rubricas
│  ├─ playbooks/     roteiros
│  ├─ maquina/passagens.yaml
│  ├─ checagens/  fixtures/
│  ├─ casos/<serviço>/
│  │   regressao/ capacidade/ fitas/
│  ├─ schemas/  (acao, revisao...)
│  ├─ models.yaml  requirements.txt
│  └─ validar.py  test_validar.py
├─ motor/      (nasce na fase 2)
├─ docs/
│  ├─ planos/sistema-helena-pacote/
│  │  ├─ 01-plano-v3.md  PLANO ÚNICO
│  │  ├─ furos.yaml → 02-registro (gerado)
│  │  ├─ fases.yaml  testes.yaml
│  │  ├─ conferir_plano.py
│  │  └─ diagramas/ pesquisa/ historico/
│  ├─ estado/construcao.md
│  ├─ autorizacoes/AUT-NNNN.md
│  ├─ decisoes-pendentes.md
│  ├─ fundador/  (fila, guia, glossário)
│  ├─ mantenedor/receitas/
│  ├─ seguranca/ segredos.md contas.yaml
│  ├─ agentes/   (GERADO)
│  └─ historico/ (fotografias novas)
├─ supabase/
│  ├─ migrations/   v2 + base da v1
│  ├─ historico-v1/ as 73 da v1
│  └─ tests/
├─ ops/helena-backup/  (modelos)
├─ src/ public/  app (não se move)
├─ services/     v1 (não se move)
├─ scripts/      sem chaves escritas
├─ .github/workflows/
└─ .gitleaks.toml .githooks/
```

O backup fica num repositório separado (`helena-backup`), que só você cria e nenhuma IA alcança.

**Uma fonte da verdade:**

| O quê | Onde | Muda por |
|---|---|---|
| Cards e etapas | Supabase | só o motor |
| Decisões | Supabase (`decisoes`) | seu toque |
| Regras, lições, exemplos | Supabase, com versão | seu toque |
| Fichas e roteiros | `helena-v2/` publicada | PR, testes e seu Deploy |
| Plano | pacote do plano | PR |
| Autorizações | `docs/autorizacoes/` | sua frase |
| Gerado | — | só o gerador |
| Histórico | `docs/historico/` | não muda mais |

---

## 6. Ordem de execução revisada

Regra que vale em todas as fases: **nenhuma fase avança por data, só por teste.** Uma meta de duração ("em dias") é só uma meta, nunca um portão.

### Agora (só texto e decisões)
- Cartão da Hostinger (MEL-12).
- Você confere no EasyPanel a origem de cada serviço (MEL-08).
- PR com o plano e as fichas na main, correções do diagrama, "duas portas" e livro de autorizações (MEL-08, 09, 10 e 13).
- As suas decisões: motor (nº 1), momento da troca das chaves e Lovable.

### Fase 0a: Estancar
- Os passos do MEL-01.
- Inventário e limpeza dos segredos (MEL-02); superfície do Supabase (MEL-03); escritores e apps (MEL-04).
- APIs pagas da v1 (MEL-18); contas com dois caminhos (MEL-47); cartão Supabase (MEL-17).
- Contagem das execuções da v1 (MEL-19); padrão dos workflows (MEL-07).
- Receitas "mudar o banco" e "publicar e voltar" (MEL-46); app que falha fechado (MEL-33); a regra "sessão = você" (MEL-05).
- **Portão 0a:**
  - só as portas previstas aparecem abertas;
  - cada credencial vazada é recusada;
  - funções e tabelas da lista recusam o anônimo e um usuário de fora;
  - o login continua funcionando;
  - os segredos de 07/10 foram trocados ou revogados;
  - a verificação em duas etapas tem dois caminhos;
  - a cópia restaurada bate nas contagens;
  - o checklist da v1 ficou verde depois de cada passo;
  - nada foi mudado sem frase.

### Fase 0b: Vigiar (corre junto com a fase 1)
- `helena-backup`, backup e restauração (MEL-16); healthchecks e Telegram (MEL-37).
- Cartão de diagnóstico (MEL-36); varredura de segredos a cada envio (MEL-02).
- Ramos arquivados (MEL-08); fila "Precisa de você" (MEL-12); testes automáticos das especificações e do app (MEL-14).
- **Portão 0b (obrigatório antes da fase 2):**
  - a restauração semanal passou;
  - o aviso de teste chegou ao seu celular pelos dois caminhos;
  - o cartão de diagnóstico está atualizando;
  - a varredura de segredos está verde.

### Fase 1: Especificações (só arquivos)
- Alinhar as 12 divergências da conferência.
- Tabela de passagens (MEL-22); desenho da prova (MEL-23); roteiro (MEL-24).
- Organograma e serviços (MEL-26); contrato de saída (MEL-27); checagens e furos (MEL-28).
- Rubrica (MEL-29); relatório (MEL-30); formato dos casos (MEL-31).
- Texto do motor, das vagas e do executor (MEL-20, 21 e 35); fichas sem "buscar" (MEL-34).
- **Portão 1:**
  - o validador confere contra o plano v3;
  - não sobra divergência da fase 1;
  - os furos da fase 1 estão provados;
  - o plano está conferido pela máquina;
  - você digita a frase numerada do AUT-0001.

### Fase 2: Esqueleto andando
- **Primeiro:** o caminho de publicar, com um motor "olá" (imagem, impressão digital e Deploy no EasyPanel), e a volta ensaiada e cronometrada no celular (MEL-05 e 06).
- Depois:
  - motor no Postgres e vagas (MEL-20 e 21); regras e prova em camadas (MEL-22 e 23);
  - três ambientes (MEL-15); adaptador e ação por ferramenta (MEL-35 e 27);
  - medidor de cota (MEL-19); botões no app (MEL-25); versão do app (MEL-39);
  - avisos (MEL-37); casos na camada A (MEL-31); "ler página" provada contra páginas falsas (MEL-34);
  - teste 3 com a rede fechada (MEL-48); prévia das telas (MEL-40).
- **Dia de prova:** o Hermes chama a ferramenta de ação e termina; o `hermes usage` mostra as duas janelas sem gastar cota; medir o tempo de partida do Hermes e o gasto de cota por turno.
- Só a E1 do Caio de ponta a ponta, sem internet.
- **Portão 2:**
  - testes 1 a 8, 10 e 11 e o dia de prova verdes;
  - prova em camadas sem violações;
  - volta pelo EasyPanel cronometrada;
  - portão 0b fechado;
  - ensaio de entrar nas contas sem o celular.

### Fase 3: Primeira meta real
- E1 a E5 das 10 pessoas; "ler página" por lista (MEL-34).
- Rubricas calibradas e teste 9 por par (MEL-29 e 41); relatório (MEL-30); boletim e disjuntor (MEL-42).
- Lições (MEL-43); 3 gestos (MEL-45); casos na camada B (MEL-31); trava do navegador (MEL-38).
- Os 5 serviços em estágio.
- **Portão 3:**
  - a meta das 10 pessoas está com E1 a E5 aprovadas, sem ninguém destravar à mão. O convite é enviado por você, nunca pelos agentes;
  - o teste 9 por par está verde;
  - no máximo 1 cartão de resolução por card;
  - regressão em 3 de 3;
  - trava do navegador ligada para valer;
  - teste 11 semanal verde.

### Fase 4: Crescer com cuidado
- Conjunto-ouro e classificador (MEL-44), que levam ao portão da troca do WhatsApp.
- Serviços sobem um por vez (MEL-26).
- Sub-card volta, com prova própria.
- "Buscar" e o Ravi, com o serviço de busca escolhido por você.
- Codex só com o teste de conformidade e a rede isolada (MEL-35 e 48).
- Revisor em outro modelo só como experimento (MEL-41).
- Vercel só se houver um motivo escrito (MEL-32).
- **Portão 4, por serviço:** 10 casos de regressão em 3 de 3 levam a estágio; 5 cards reais sem escape levam a ativo. O WhatsApp só muda de canal com o conjunto-ouro verde e o ensaio feito.

---

## 7. O que avaliamos e não vale a pena

- **Juntar inteiros os ramos `antigravity-planos` e `missao-cumprida-v4`:** trariam 18 migrations e de 31 a 42 arquivos do gateway que não batem com o servidor.
- **Botão de publicar no GitHub, com trava pelo nome de quem disparou:** no GitHub, a sessão é você, e o nome não separa os dois.
- **OIDC com Edge Function para publicar:** deixa de ser preciso, porque nenhuma credencial de produção fica no GitHub.
- **Token do GitHub guardado no Supabase para o cartão de diagnóstico:** para quando o banco fica só leitura e abre caminho para texto plantado.
- **Lições guardadas no GitHub:** cada lição viraria uma publicação (no máximo 1 por dia) e levaria dados pessoais para o repositório.
- **Segundo projeto Supabase fixo para testes:** pausa em 7 dias e soma no limite da organização.
- **Provar a publicação já na fase 0:** ainda não há motor nem card de ensaio.
- **Busca aberta, sub-card e replanejamento pela IA na v2.0:** custo, peças a mais e a IA no caminho de controle.
- **Classificar por IA toda mensagem nas fases 2 e 3:** no app, o botão já diz o tipo.
- **Canário com erro plantado dentro de cards reais:** novos caminhos na tabela e o risco de um convite errado num card de verdade.
- **Exigir 100% em 3 de 3 do revisor:** um revisor bom reprova por acaso e trava a fase 3.
- **Juiz de IA isolado por critério:** multiplica a cota.
- **Código MAST em cada erro:** foi feito para agentes que conversam entre si. Aqui usamos códigos do nosso próprio domínio.
- **Versão digitada à mão mais `fichas.lock`:** a mesma sessão sobe os dois. A impressão digital calculada é mais exata.
- **mutmut toda semana e check-jsonschema:** dão sempre o mesmo resultado, ou repetem o que já temos.
- **Pasta `sistema/` nova e AGENTS.md encolhido para 1 página:** duplicariam a `helena-v2` e apagariam regras suas (DEC-022, DEC-023, Jev).
- **"7 dias só registrando" na trava do navegador e na rede:** decide por data, não por teste.
- **Vercel (Functions, Sandbox, Cron, AI Gateway, Vercel Agent, hospedar o app agora):** limites de tempo, login do ChatGPT preso à VPS, uso comercial exige o Pro e o AI Gateway é API paga.
- **gh-aw, Copilot agent e claude-code-action:** motores pagos ou uma segunda IA escrevendo no repositório.
- **GitHub Models:** aposentado em 30/07/2026.
- **Runner próprio na VPS:** rodaria código das sessões na máquina das chaves.
- **CODEOWNERS e aprovação obrigatória:** você seria autor e revisor.
- **Projects como quadro dos agentes:** não trava passagens.
- **LangGraph, CrewAI, Microsoft Agent Framework, protocolo A2A, Langfuse na VPS e promptfoo:** camadas a mais, peças a mais ou API paga.
- **Tirar agora o laço do agente de dentro do Hermes:** só com os números do dia de prova.
- **Trocar a senha do banco sem prova de vazamento:** ela não está na lista do dia 07/10.
- **Proibir no relatório palavras comuns que também são nomes de tabela:** recusaria relatórios bons ("pessoas", "tarefas").
- **Prévia em PDF:** costuma só baixar no celular. A imagem PNG abre direto.
- **GitHub Pro (cerca de US$ 4 por mês):** não é preciso agora. A decisão é sua.

---

## 8. O que depende de você

**Agora**
- [ ] **Hostinger:** ver no painel o que vence em 27/10/2026 e escolher A (renovar), B (confirmar a renovação automática) ou C (não renovar). Recomendado: A.
- [ ] **Decisão nº 1, o motor:** A (DBOS) ou B (motor próprio no Postgres). Recomendado: B.
- [ ] **Troca das chaves:** já na fase 0 (recomendado) ou no fim dos testes.
- [ ] Dizer se ainda usa o app no Lovable.
- [ ] No EasyPanel, mandar um print da origem de cada serviço (GitHub com publicação automática, ou upload).
- [ ] Aprovar o PR que traz o plano e as fichas para a main.
- [ ] Dar o OK no PR do AGENTS.md com as "duas portas".
- [ ] Dizer onde está o código do `receive-leads` e se o projeto Supabase antigo ainda existe.
- [ ] Decidir se a voz da v1 continua usando a API paga da OpenAI, como exceção escrita à DEC-014, ou se é desligada.

**Fase 0a (uma mensagem só, com uma frase por passo)**
- [ ] Verificação em duas etapas com dois caminhos: e-mail principal, GitHub, Supabase (segundo fator em outro aparelho), EasyPanel, Hostinger, ChatGPT e Telegram. Imprimir os códigos e guardar em dois lugares.
- [ ] Frase para fechar as portas 9119 e 8642.
- [ ] Frase para a cópia do banco, e guardar a chave dela fora do computador.
- [ ] Frases para desligar o modo de teste e o cadastro, tirar o papel de fundador do acesso público e travar o WhatsApp no seu número.
- [ ] Frase para tirar do anônimo as funções abertas.
- [ ] Colar só os nomes das variáveis de cada serviço e confirmar que `MEOWCALLER_TOKEN` existe.
- [ ] Trocar as chaves peça por peça e, no fim, revogar o segredo antigo.
- [ ] Revisar os apps e tokens do GitHub ("Only select repositories").
- [ ] Em Settings > Actions: ligar "exigir SHA completo", conferir "só leitura" e deixar desligada a criação de PR.
- [ ] Informar o gasto do mês dos serviços pagos configurados.
- [ ] ChatGPT: confirmar saldo de créditos zero e recarga automática desligada.
- [ ] Responder o cartão Supabase grátis ou Pro. Sem resposta, fica o grátis.

**Fase 0b**
- [ ] Criar à mão o repositório `helena-backup`, tirar dele os apps de IA e revogar os tokens clássicos com escopo "repo".
- [ ] Frase para criar o papel só de leitura do backup. Gerar as chaves pelo passo a passo e colar os 2 segredos.
- [ ] Criar a conta do healthchecks.io e o robô do Telegram, e mandar /start ao HealthchecksBot.
- [ ] Fixar a issue "Precisa de você".
- [ ] OK para arquivar os ramos, decidir o PR #5 e ligar "Automatically delete head branches".
- [ ] Frase para a tabela de números e o papel do cartão de diagnóstico.

**Fim da fase 1**
- [ ] Digitar: "aprovo AUT-0001: plano v3.1 e roteiro das 10 pessoas, com o motor próprio no Postgres, versão `<código>`" (ou com o DBOS, se essa for a sua escolha).

**Fase 2**
- [ ] Criar o token só de leitura de pacotes, colar no EasyPanel e ligar as versões imutáveis.
- [ ] Guardar a credencial de migração no EasyPanel.
- [ ] Ensaiar no celular: colar a impressão digital, apertar Deploy e depois voltar.
- [ ] Ensaiar entrar nas contas com o celular principal desligado.

**Fase 3**
- [ ] Aprovar o plano da meta, com as fontes da Mimix e do Hub.
- [ ] Ser o segundo leitor no jurídico.
- [ ] Aprovar as lições em lote toda semana e tocar para promover cada serviço.

**Fase 4**
- [ ] Confirmar as 50 mensagens do conjunto-ouro (10 a 20 minutos).
- [ ] Escolher o serviço de busca, se quiser o Ravi.
- [ ] Frase da troca do WhatsApp.

**Opcional (só se você quiser gastar)**
- [ ] GitHub Pro: não recomendado agora.
- [ ] Supabase Pro: pelo cartão da fase 0.

---

## Fontes

Observação: vercel.com, docs.github.com, arXiv, supabase.com e outros sites foram bloqueados pelo proxy. Esses conteúdos foram lidos no código-fonte oficial no GitHub ou em resultados de busca, como indicado em cada achado.

**Vercel**
- https://github.com/vercel/workflow/blob/026741b8cf218d8bc89c33746139ce8958e48b20/docs/content/worlds/v5/postgres.mdx
- https://github.com/vercel/workflow/blob/026741b8cf218d8bc89c33746139ce8958e48b20/docs/content/docs/v5/foundations/versioning.mdx
- https://github.com/vercel/workflow/blob/026741b8cf218d8bc89c33746139ce8958e48b20/docs/content/docs/v5/ai/human-in-the-loop.mdx
- https://www.npmjs.com/package/workflow
- https://github.com/vercel/ai/blob/5a3c13cbb00de3b641af7b34bded5cfeaef286d5/content/docs/03-agents/04-loop-control.mdx
- https://github.com/vercel/ai/blob/5a3c13cbb00de3b641af7b34bded5cfeaef286d5/content/docs/03-agents/06-tool-approvals.mdx
- https://github.com/vercel/ai/blob/5a3c13cbb00de3b641af7b34bded5cfeaef286d5/content/docs/03-agents/06-policy-tool-approvals.mdx
- https://github.com/vercel/ai/blob/5a3c13cbb00de3b641af7b34bded5cfeaef286d5/content/providers/02-ai-sdk-harnesses/02-codex.mdx
- https://github.com/vercel/ai/blob/5a3c13cbb00de3b641af7b34bded5cfeaef286d5/content/docs/03-ai-sdk-core/60-telemetry.mdx
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/README.md
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/docs/evals/overview.mdx
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/docs/evals/tool-stubs.mdx
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/docs/guides/decide.md
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/docs/reference/typescript-api.md
- https://github.com/vercel/eve/blob/b84aeef0058a1433af0d934f0624f0f168f4bb18/docs/concepts/execution-model-and-durability.mdx
- https://thenewstack.io/vercel-launches-eve-an-open-source-framework-that-treats-agents-as-directories/
- https://github.com/vercel/sandbox/blob/31244aa3280dc3fdca0680933f85971570d73d2d/skills/sandbox/SKILL.md
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/fluid-compute
- https://vercel.com/docs/vercel-sandbox/pricing
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://vercel.com/docs/deployments/instant-rollback
- https://vercel.com/docs/deployment-protection/usage-and-pricing
- https://vercel.com/docs/rolling-releases
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/ai-gateway/pricing
- https://vercel.com/docs/ai-gateway/faq
- https://vercel.com/changelog/vercel-agent-has-updated-pricing
- https://vercel.com/docs/agent/pricing
- https://easypanel.io/docs/services/app

**GitHub**
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/billing/reference/actions-runner-pricing
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- https://resources.github.com/actions/2026-pricing-changes-for-github-actions/
- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- https://github.blog/changelog/2026-05-05-secret-scanning-with-github-mcp-server-is-now-generally-available/
- https://github.com/gitleaks/gitleaks-action
- https://docs.zizmor.sh
- https://pypi.org/project/zizmor/
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
- https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
- https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes
- https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- https://docs.github.com/en/actions/concepts/security/openid-connect
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://github.github.com/gh-aw/
- https://github.github.com/gh-aw/reference/safe-outputs/
- https://github.blog/2026/03/09/under-the-hood-security-architecture-of-github-agentic-workflows/
- https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents
- https://github.com/anthropics/claude-code-action/blob/main/docs/security.md
- https://github.blog/changelog/2026-07-30-github-models-is-now-retired/
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects
- https://github.com/actions/upload-artifact
- https://pypi.org/project/mutmut/
- https://github.com/boxed/mutmut
- https://github.com/python-jsonschema/check-jsonschema
- https://creditforstartups.com/resources/github-pro-pricing

**Sistemas de agentes**
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/research/project-vend-2
- https://code.claude.com/docs/en/agent-sdk/subagents
- https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-04-tools-are-structured-outputs.md
- https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md
- https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md
- https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-09-compact-errors.md
- https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-10-small-focused-agents.md
- https://github.com/MicrosoftDocs/architecture-center/blob/main/docs/ai-ml/guide/ai-agent-design-patterns.md
- https://github.com/microsoft/agent-framework
- https://github.com/pydantic/pydantic-ai/blob/main/docs/output.md
- https://github.com/pydantic/pydantic-ai/blob/main/docs/durable_execution/dbos.md
- https://github.com/openai/openai-agents-python/blob/main/docs/guardrails.md
- https://github.com/openai/openai-agents-python/blob/main/docs/human_in_the_loop.md
- https://github.com/openai/openai-agents-python/blob/main/docs/tracing.md
- https://github.com/dbos-inc/dbos-docs/blob/main/docs/python/reference/decorators.md
- https://github.com/dbos-inc/dbos-docs/blob/main/docs/production/workflow-recovery.md
- https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/interrupts.mdx
- https://mastra.ai/docs/workflows/suspend-and-resume.md
- https://github.com/langfuse/langfuse/blob/main/docker-compose.yml
- https://arxiv.org/abs/2502.04313
- https://icml.cc/virtual/2025/poster/46528
- https://arxiv.org/abs/2503.13657
- https://github.com/multi-agent-systems-failure-taxonomy/MAST
- https://sierra.ai/blog/benchmarking-ai-agents
- https://github.com/sierra-research/tau-bench
- https://developers.openai.com/codex/noninteractive
- https://www.antoinebuteau.com/lessons-from-walden-yan/ (fonte secundária)

**Organização**
- https://aaif.io/blog/measuring-agents-md-what-five-runs-show-that-one-doesn-t
- https://openai.com/index/agentic-ai-foundation/
- https://stackharbor.com/en/knowledge-base/backstage-software-catalog/
- https://raw.githubusercontent.com/a2aproject/A2A/main/docs/specification.md
- https://modelcontextprotocol.io/registry/versioning
- https://sierra.ai/blog/agent-development-life-cycle
- https://sierra.ai/blog/meet-agent-studio
- https://promptfoo.dev/docs/integrations/ci-cd/
- https://www.techcrunch.com/2026/03/09/openai-acquires-promptfoo-to-secure-its-ai-agents/
- https://www.intercom.com/help/en/articles/14324571-manage-procedure-versions-and-publishing
- https://fin.ai/updates/procedures-versioning-failure-reporting
- https://docs.devin.ai/product-guides/creating-playbooks
- https://microsoft.github.io/zerotrustassessment/pt/docs/workshop-guidance/AI/AI_012
- https://www.nngroup.com/articles/slips/

**Supabase e avisos**
- https://github.com/supabase/pg_net
- https://healthchecks.io/integrations/telegram