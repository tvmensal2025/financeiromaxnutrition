# BRIEFING PARA O CHATGPT — Sistema Helena v2 (17/10/2026)

## 0. Como você (ChatGPT) deve trabalhar comigo
- Responda sempre em português do Brasil, em linguagem simples. Eu sou o fundador e não sou técnico.
- Dê UM comando por vez para eu colar no terminal e peça só as últimas linhas da resposta.
- NUNCA peça nem aceite que eu cole senha, token, chave ou código de login no chat. Se eu colar por engano, mande eu revogar na hora.
- Antes de qualquer mudança no banco, no servidor ou na publicação, mostre o que muda e espere o meu "sim".
- Diga a verdade: separe sempre FEITO / PARCIAL / NÃO FEITO / NÃO CONFIRMADO. Conectado não é funcionando.
- Você não acessa a minha VPS nem o Supabase por conta própria. Quem roda os comandos sou eu.

## 1. O que é o projeto
Uma empresa operada por agentes de IA. Eu faço um pedido, o pedido vira um CARD, agentes especialistas fazem o trabalho em etapas, outro agente revisa, e o resultado volta ao card. Atende 4 empresas: iGreen, Ecossistema de Saúde, Humano Digital e eLiving™ (escrita sempre assim; slogan "Onde sua evolução ganha direção."; inteligência pessoal de evolução, nunca app fitness comum nem contador de calorias; pilares Sirlene/Nutrição, Doutor Vital/Saúde, Alex/Movimento, Rafael/Hábitos).
Princípio: o BANCO manda, o MOTOR executa, o AGENTE só escreve conteúdo. Agente nunca age fora do sistema; qualquer ação externa (enviar, publicar, contatar, pagar) só com o meu OK.

## 2. Onde está cada coisa (sem segredos)
- Código: GitHub `tvmensal2025/financeiromaxnutrition`. Branch de trabalho `claude/fervent-pasteur-g821nu`. O `main` tem quase tudo; o pedido de merge #18 leva as últimas 4 mudanças.
- Banco: Supabase projeto `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou` (o único válido; o `imvfmjgmacrulhztrqlh` é histórico). Esquema da v2: `helena_v2` (33 tabelas, 115 funções) e `dbos_helena_v2` (13 tabelas do DBOS).
- Site (app v2): React/Vite na pasta `src/`, só login, cards e `/configuracoes`. Vai ser publicado no Lovable a partir do `main`. Precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave pública) nas variáveis do Lovable.
- VPS (Hostinger, Ubuntu): IP 72.60.159.48. Tem também o EasyPanel (v1, desligada em grande parte).
  - Motor da v2: código em `/opt/helena-v2/repo`, ambientes `/opt/helena-v2/venv-motor` e `venv-hermes`, Python em `/opt/helena-v2/python`, conexões em `/etc/helena-v2/motor.env`, certificados em `/etc/helena-v2/ca-bundle.crt`, login do ChatGPT em `/var/lib/helena-v2/hermes-home`, alarmes em `/var/log/helena-v2/alarmes.log`. Serviços systemd: helena-vigia, helena-relogio, helena-despachante. Rodam com o usuário `helena`, sem privilégio.
  - Instalador/operador: `/root/instalar-motor.sh` com etapas `estado`, `ligar-motor`, `testar-banco`, `conferir`, `servicos`, `validar-config`.
  - Hermes do Telegram (outro, separado): versão 0.15.1 em `/root/.hermes`, bot `@hermes_helena_oficial_bot`. NÃO está ligado à v2.
- Documentação principal no repositório: `HANDOFF-CLAUDE-CODE.md` (estado e pendências, bloco E-8 no topo), `AGENTS.md` (regras do projeto), `docs/manual/como-a-fabrica-funciona.md` (explicação completa), `motor/hermes-vps/LEIA-ME.md`.

## 3. Como a fábrica funciona
Peças: Site (minha janela) → Supabase (memória e regras) ← Motor na VPS (mãos) → Hermes 0.19.0 (operador) → ChatGPT (cérebro, pela minha assinatura, sem API paga).
Motor = 3 serviços: VIGIA (a cada 5 min, só lê, procura problemas), RELÓGIO (a cada 60 s, aplica o que o banco diz que venceu; nunca aprova por tempo), DESPACHANTE (a cada 5 s, único que chama agente e gasta cota; 1 agente por vez).
Ciclo do card: pedido autenticado → card RASCUNHO (revisão de configuração fixada) → Helena faz a "leitura de volta" → eu confirmo → código valida o plano → despachante pega o card por prioridade → etapa do autor (Hermes isolado, só as ferramentas da ficha) → resposta gravada no banco ANTES de seguir → portão 1 (código, sem IA: formato, português, texto puro, citações, cálculos, sem "enviei/paguei") → revisor (outro agente, com rubrica e prova) → etapas seguintes → card PRONTO → relatório final da Helena. Ações externas só depois, só com o meu OK, uma vez.
Configuração: revisões RASCUNHO → VALIDADA (o código do motor valida, nunca a IA) → ATIVA (eu ativo no site). Só uma ativa. Cards em andamento mantêm a revisão em que nasceram.
Banco fechado: o site não escreve em tabelas; tudo passa por funções que conferem quem chama. Histórico só acrescenta. Estados finais não voltam. Só 9 das 33 tabelas têm RLS (as outras 24 não dão acesso a usuários comuns).

## 4. Os 21 agentes (identidades na configuração, não programas)
Helena (coordenação, leitura de volta, relatório final), Laura (prática de comunicação, pessoal), Augusto (estratégia), Marina (planos de projeto), Caio (finanças/cálculo), Clara (jurídico/parecer), Bianca (pessoas), Daniel (dados), Theo (tecnologia), Nina (produto), Ravi (pesquisa), Maya (design), Bruno (testes), Olívia (operações), Victor (vendas), Camila (marketing), Isabela (texto/conteúdo), Pedro (parcerias), Renata (sucesso do cliente), Joana (atendimento), Felipe (administração). O fundador (eu) é a 22ª identidade.
Só 5 serviços em ESTÁGIO: coordenação/relatório final (Helena), cálculo (Caio), parecer (Clara), texto pronto e roteiro de treinamento (Isabela). Os outros 17 são RASCUNHO (não recebem card). Só 8 agentes têm ficha completa. Nenhum serviço está publicado. Único roteiro pronto: `recrutar-10-pessoas` (5 etapas: Caio, Isabela, Isabela, Clara, Helena). Modelo: `gpt-6-sol` (coordenação `gpt-6.1-sol`), provedor `openai-codex`.
O "post rápido" já está previsto: serviço Texto pronto (Isabela escreve, Clara julga, eu sou o segundo revisor), só para Humano Digital e eLiving™.

## 5. Estado real hoje (FEITO / NÃO FEITO)
FEITO e verificado:
- Esquema `helena_v2` instalado no Supabase real; API exposta; auditoria somente leitura confere com o repositório (33 tabelas, 115 funções, contas do motor, DBOS com 13 tabelas).
- Contas `helena_motor` e `dbos_motor` criadas, com senhas definidas por mim; conexões da VPS OK com TLS verificado (usa a CA raiz do Supabase com impressão digital fixa).
- Configuração: a revisão técnica `2a37fb92…` está VALIDADA e ATIVA. Existe um rascunho clonado `c953847f…` sem pedido de validação. Nenhum card existe ainda.
- Motor instalado na VPS; vigia, relógio e despachante ATIVOS (despachante ocioso, sem cards).
- Hermes 0.19.0 do motor respondeu `ok` pelo ChatGPT real, chamado direto no terminal (custo incluído no plano; ~10,7 mil tokens de entrada por pergunta mínima).
- Site v2 no `main`, com testes (171 do app, 480 do gateway) e CI verde.
NÃO FEITO / NÃO COMPROVADO:
- Nenhum card real rodou de ponta a ponta. NÃO CONFIRMADO se o perfil isolado de cada execução enxerga o login do ChatGPT (o código não copia o `auth.json`): o primeiro card real pode falhar por login.
- Site ainda não publicado no Lovable.
- Entrada em texto livre ("faça um post") NÃO existe. Hoje o site só cria card a partir de um arquivo de preparação de uma tarefa já cadastrada, e gerar esse arquivo exige um token de leitura do Supabase na minha máquina.
- Telegram → v2 NÃO existe (o bot atual é o Hermes 0.15.1, que só conversa).
- Em modo real, Cálculo e Parecer registram "faltam dados" sem chamar agente; o roteiro de recrutamento depende dos dois.
- O revisor só aprova ou trava: não devolve ao autor (o motor não emite REPROVAR). Não há contador de cota. Alarmes só em arquivo local. Não existe destino real de publicação nem execução de ações externas. Busca na internet desligada.
- Cota de 20 tarefas/dia e login estável por 48 h: NÃO COMPROVADOS (dia de prova ainda não executado). Eu já dei a frase de autorização do dia de prova: "AUTORIZO O DIA DE PROVA DA V2 COM HERMES REAL E CHATGPT".

## 6. Segurança — pendente (fazer antes de qualquer outra coisa)
1. O repositório está PÚBLICO temporariamente e o HISTÓRICO tem 4 segredos reais (chave `service_role` do Supabase, chave da Evolution API, tokens `helena_*` do MCP/Meowcaller/gateway, chave do Kokoro TTS). Ordem: (a) tornar o repositório PRIVADO agora; (b) trocar as 4 chaves e atualizar quem as usa na v1; (c) depois reescrever o histórico (git filter-repo) e apagar branches antigas. O Lovable lê repositório privado.
2. Chave SSH `github-actions-helena` e senha root da VPS passaram pelo chat: remover a chave de `/root/.ssh/authorized_keys` e trocar a senha (`passwd`).
3. Um token do GitHub foi colado no chat: revogar.
4. Tabela temporária `public.helena_v2_instalacao_pedacos` ainda no banco (vazia, efetivamente fechada): apagar pelo SQL Editor.
5. Marcar `helena_v2` em Exposed schemas no painel do Supabase e depois `alter role authenticator reset pgrst.db_schemas`; ligar a proteção contra senha vazada no Auth.
6. Chaves `service_role` e token `sbp_` colados em 14/10: rotação NÃO CONFIRMADA.
7. Hermes antigo do EasyPanel: serviço parado (0/1). Há backup de 1,2 GB em `/root/backup-hermes-easypanel` (contém login antigo; nunca vai para chat nem GitHub). Falta conferir o backup e apagar o serviço no EasyPanel.

## 7. PONTO FINAL — como saberemos que terminou (critérios de pronto)
O sistema está "pronto" quando TODOS estes itens estiverem verdadeiros e registrados no HANDOFF:
A. Segurança fechada: repositório privado, as 4 chaves do histórico trocadas, credenciais da VPS trocadas, token revogado, tabela temporária apagada, schemas expostos alinhados.
B. Site publicado no Lovable, eu entro como fundador em `/login` e vejo `/configuracoes` com a revisão ativa.
C. Primeiro card real de ponta a ponta com o Hermes real DENTRO do motor: card criado, etapas executadas, revisor aprovou, card PRONTO, resultado visível no site. Medir o consumo real de tokens.
D. Entrada em texto livre no site: eu escrevo "faça um post…" e o card nasce pela função oficial (exige migration nova `0020` no banco, só com o meu sim).
E. Telegram → v2: eu falo no Telegram com um bot só e o pedido vira card (o Hermes 0.15.1 deixa só de ouvir o Telegram).
F. Dia de prova registrado com PASSOU / FALHOU / NÃO COMPROVADO: cota (20 tarefas no mesmo dia) e login (48 h com tarefas paralelas), com evidências em `docs/manual/dia-de-prova-evidencias.csv`.
G. Documentação sincronizada: `main` = branch, HANDOFF atualizado, pedido de merge #18 juntado.
FORA do "final" (decisões futuras minhas): destino real de "publicar", outros roteiros além do recrutamento, as 13 fichas de agentes faltantes, busca na internet, desligar a central da v1 (DEC-028, só com a minha frase exata).

## 8. Próximos passos, nesta ordem
1. Segurança (item 6.1 a 6.3) — comigo, no GitHub, na VPS e no Supabase.
2. Juntar o pedido #18 e publicar no Lovable (com as 2 variáveis).
3. Resolver o risco do login do Hermes dentro do motor e rodar o primeiro card real simples (que não dependa de Cálculo nem Parecer).
4. Construir a entrada em texto livre (código e testes locais primeiro; o banco real só com o meu sim).
5. Construir a ponte do Telegram.
6. Reabrir o revisor (devolver ao autor) e criar o contador de cota.
7. Dia de prova completo e fechamento no HANDOFF.

## 9. Regras do projeto que você deve respeitar
- A v1 está parada (DEC-032): `src/` é só a v2; o código da v1 fica em `docs/arquivo/app-v1/` só para consulta. `services/`, `scripts/` e `supabase/migrations/` são da v1 e só mudam com a minha frase exata (DEC-028).
- Alteração no banco exige a minha autorização explícita. Relatórios antigos nunca substituem a consulta atual ao Supabase.
- Nunca copiar valores de senhas, tokens, chaves ou códigos de recuperação; usar só nomes, locais e metadados.
- Antes de propor criar algo, verificar o que já existe: JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE / NÃO CONFIRMADO.
