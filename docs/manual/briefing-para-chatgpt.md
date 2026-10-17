# BRIEFING PARA O CHATGPT — Sistema Helena v2 (17/10/2026)

> **Retomada:** comece por [`docs/manual/onde-estamos.md`](onde-estamos.md), que tem a próxima ação e separa estado local de relatos históricos de produção. Este briefing é contexto datado; instruções atuais do fundador prevalecem.

> **Orientação posterior do fundador, 17/10:** preservar a construção e conectar suas partes. A visão geral v2 em `/` agora se liga a `/cards`, a cards por `?card=` e a pedidos por `?pedido=`, mantendo os links antigos. A construção da v1 continua arquivada como referência de reaproveitamento. Para saber onde cada parte deve atuar, leia o [mapa do sistema](mapa-do-sistema.md) e o [inventário de reaproveitamento](mapa-de-reaproveitamento.md). O mapa curto é incluído na triagem pelo motor; isso ainda não conecta automaticamente a conversa comum do Hermes nem comprova implantação.

> **Atualização de 17/10, verificada no Supabase:** no readback de 17:12 UTC, `CP-20261017-V038` estava ativo, com V037 como predecessor, 38 versões no total, uma ativa e 37 históricas superadas. As migrations 0020–0026 foram aplicadas com guardas e verificações de DDL/RLS/ACL; às 17:09 UTC havia 45 tabelas v2, 21 com RLS, e zero pedidos, propostas, planos, cards, vínculos, inbox e saídas duráveis. Smokes 0024 (pergunta → proposta → confirmação → `RASCUNHO`), 0025 (redação, repetição, ACL) e 0026 (avisos) passaram com `ROLLBACK`; o chat da 0026 era sintético. Código da nova esteira enviado à branch `codex/helena-v2-kanban-triagem-20261017` nos commits `db48808` e `2ea5286`, ainda sem integração confirmada em `main`. Passaram 253 testes frontend e tipos/build, 43 SQL, 8 unitários e um PostgreSQL sintético de triagem até `PRONTO`, 6 Edge e 5 do pin Hermes. A UI local passou em Chromium desktop/celular com backend simulado. O novo código **não foi implantado** no site/Lovable, na Edge ou na VPS; webhook e transporte Telegram novos não foram ativados. Nenhum modelo pago, mensagem real ou primeiro card durável foi executado. Sempre consulte a view do checkpoint atual ao retomar.

## 0. Como você (ChatGPT) deve trabalhar comigo
- Responda sempre em português do Brasil, em linguagem simples. Eu sou o fundador e não sou técnico.
- Execute autonomamente os comandos locais que forem necessários e autorizados nesta sessão. Peça ao fundador apenas ações que dependam dele ou autorização para efeitos remotos; não solicite que cole comandos locais que o Codex possa executar.
- Nunca peça nem aceite que eu cole senha, token, chave ou código de login no chat. Se houver compartilhamento acidental, não repita o valor e registre a pendência para o encerramento dos ajustes, conforme a instrução do fundador.
- Explique o que muda no banco, servidor ou publicação. Reutilize a autorização já concedida para o mesmo escopo; só peça nova confirmação quando faltar autorização para a ação concreta.
- Diga a verdade: separe sempre FEITO / PARCIAL / NÃO FEITO / NÃO CONFIRMADO. Conectado não é funcionando.
- Não presuma acesso atual à VPS ou ao Supabase. O fundador autorizou os ajustes do sistema nesta sessão; não peça novamente a mesma autorização. Confira conexão, contexto vigente e alvo antes de agir. Nunca peça valores de credenciais nem sua cópia no chat. Abas autenticadas não ficam automaticamente disponíveis ao executor de nuvem.

## 1. O que é o projeto
Uma empresa operada por agentes de IA. Eu faço um pedido, o pedido vira um CARD, agentes especialistas fazem o trabalho em etapas, outro agente revisa, e o resultado volta ao card. Atende 4 empresas: iGreen, Ecossistema de Saúde, Humano Digital e eLiving™ (escrita sempre assim; slogan "Onde sua evolução ganha direção."; inteligência pessoal de evolução, nunca app fitness comum nem contador de calorias; pilares Sirlene/Nutrição, Doutor Vital/Saúde, Alex/Movimento, Rafael/Hábitos).
Princípio: o BANCO manda, o MOTOR executa, o AGENTE só escreve conteúdo. Agente nunca age fora do sistema; qualquer ação externa (enviar, publicar, contatar, pagar) só com o meu OK.

## 2. Onde está cada coisa (sem segredos)
- Código: GitHub `tvmensal2025/financeiromaxnutrition`. Branches, PR e estado de merge devem ser conferidos no checkout/fonte atual; não assumir que este retrato histórico descreve o estado remoto.
- Banco: Supabase projeto `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou` (o único válido; o `imvfmjgmacrulhztrqlh` é histórico). Esquema da v2: 45 tabelas, 21 com RLS na conferência de 17:09 UTC após 0026; reconsultar antes de usar como estado atual. O registro anterior do `dbos_helena_v2` descreve 13 tabelas do DBOS, sem nova conferência aqui.
- Site (app v2): React/Vite na pasta `src/`, com login, visão geral em `/`, cards e pedidos em `/cards`, e revisões em `/configuracoes`. A orientação posterior do fundador de 17/10 autorizou o reaproveitamento do painel na v2; a interface original da v1 permanece arquivada. Publicação dessa atualização no Lovable ainda não foi comprovada. O frontend tem URL e chave pública padrão do projeto no código, suficientes para abrir o login local; acesso exige sessão real e `app_access` ativo.
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
Banco fechado: o site não escreve diretamente nas tabelas; tudo passa por funções que conferem quem chama. Histórico só acrescenta. Estados finais não voltam. Após 0026, a conferência de 17:09 UTC encontrou 21 das 45 tabelas com RLS; as demais seguem privadas por concessões restritas.

## 4. Os 21 agentes (identidades na configuração, não programas)
Helena (coordenação, leitura de volta, relatório final), Laura (prática de comunicação, pessoal), Augusto (estratégia), Marina (planos de projeto), Caio (finanças/cálculo), Clara (jurídico/parecer), Bianca (pessoas), Daniel (dados), Theo (tecnologia), Nina (produto), Ravi (pesquisa), Maya (design), Bruno (testes), Olívia (operações), Victor (vendas), Camila (marketing), Isabela (texto/conteúdo), Pedro (parcerias), Renata (sucesso do cliente), Joana (atendimento), Felipe (administração). O fundador (eu) é a 22ª identidade.
Só 5 serviços em ESTÁGIO: coordenação/relatório final (Helena), cálculo (Caio), parecer (Clara), texto pronto e roteiro de treinamento (Isabela). Os outros 17 são RASCUNHO (não recebem card). Só 8 agentes têm ficha completa. Nenhum serviço está publicado. Único roteiro pronto: `recrutar-10-pessoas` (5 etapas: Caio, Isabela, Isabela, Clara, Helena). Modelo: `gpt-6-sol` (coordenação `gpt-6.1-sol`), provedor `openai-codex`.
O "post rápido" já está previsto: serviço Texto pronto (Isabela escreve, Clara julga, eu sou o segundo revisor), só para Humano Digital e eLiving™.

## 5. Relato de estado registrado em 17/10/2026 (FEITO / NÃO FEITO)
Relatado como FEITO e conferido no contexto de 17/10:
- Esquema `helena_v2` instalado no Supabase real; API exposta; auditoria somente leitura confere com o repositório (33 tabelas, 115 funções, contas do motor, DBOS com 13 tabelas).
- Contas `helena_motor` e `dbos_motor` criadas, com senhas definidas por mim; conexões da VPS OK com TLS verificado (usa a CA raiz do Supabase com impressão digital fixa).
- O HANDOFF relata a revisão técnica como ativada em 17/10; a auditoria do mesmo dia também diz que não havia revisão ativa. Tratar como divergência documental, não como estado atual.
- Motor instalado na VPS; vigia, relógio e despachante ATIVOS (despachante ocioso, sem cards).
- Hermes 0.19.0 do motor respondeu `ok` pelo ChatGPT real, chamado direto no terminal (custo incluído no plano; ~10,7 mil tokens de entrada por pergunta mínima).
- Testes e CI relatados naquele contexto. Para a revisão local `d0d8e1e`, a evidência registrada é 171 testes do app, 7 testes do motor, TypeScript e build; conferir o resultado consolidado da revisão atual em `docs/manual/onde-estamos.md`.
NÃO FEITO / NÃO COMPROVADO:
- Nenhum card real rodou de ponta a ponta nesta sessão. O defeito de renovação do Hermes 0.19.0 recebeu patch local com hashes e 17 testes offline, sem implantação; ver `docs/auditoria/HERMES-AUTH-2026-10-17.md`. Login no motor real e 48 horas continuam sem homologação.
- Site ainda não publicado no Lovable.
- A entrada, triagem, esclarecimento, proposta e confirmação foram implementados e testados localmente; migrations 0021–0026 aplicadas no Supabase, com smokes sintéticos revertidos. Falta publicar a UI e provar um pedido/card real.
- Telegram → v2 ainda não opera: inbox e transporte estão preparados no código, mas Edge, webhook, trabalhador na VPS e bot não foram implantados. O Hermes profissional 0.15.1 existente continua separado do Hermes 0.19.0 do motor. Mídias não são interpretadas e callbacks só são registrados.
- Em modo real, Cálculo exige insumos rastreáveis; Parecer monta peças aprovadas com autoria e versão, mas permanece bloqueado sem tabela de leis publicada e rastreável. A captura atual não a fornece; o roteiro de recrutamento depende desse serviço.
- O revisor só aprova ou trava: não devolve ao autor (o motor não emite REPROVAR). Não há contador de cota. Alarmes só em arquivo local. Não existe destino real de publicação nem execução de ações externas. Busca na internet desligada.
- Cota de 20 tarefas/dia e login estável por 48 h: NÃO COMPROVADOS (dia de prova ainda não executado). A autorização do fundador não significa que o teste ocorreu.

## 6. Segurança — pendências registradas (tratar no encerramento dos ajustes)
1. A verificação do GitHub em 17/10 registrou o repositório público e o PR #18 aberto. O estado posterior não foi revalidado. O fundador pediu deixar revogação e rotação para o encerramento dos ajustes; manter a pendência explícita e não executar agora.
2–3. O histórico menciona chave SSH, senha root e token GitHub expostos anteriormente. O estado atual não foi revalidado; revogação e rotação ficam para o encerramento dos ajustes, conforme instrução atual do fundador.
4–5. Tabela temporária, exposição do esquema e proteção contra senha vazada são pendências documentadas em 17/10. Estado atual não confirmado; conferir antes de aplicar os ajustes autorizados.
6. Outras credenciais mencionadas em 14/10: estado atual e rotação não confirmados; tratar no encerramento dos ajustes.
7. O relato de 17/10 menciona serviço Hermes antigo parado e backup pendente de conferência. Estado atual não confirmado; identificar a instalação e comprovar backup recuperável antes de remover.

## 7. PONTO FINAL — como saberemos que terminou (critérios de pronto)
O sistema está "pronto" quando TODOS estes itens estiverem verdadeiros e registrados no HANDOFF:
A–G são critérios de aceite, não afirmações de conclusão. Os estados e a próxima ação estão no ponto único de retomada.
A. Segurança fechada: critério ainda pendente, incluindo revogação e rotação, que devem ficar para o encerramento dos ajustes conforme instrução atual.
B. Site publicado no Lovable, eu entro como fundador em `/login` e vejo `/configuracoes` com a revisão ativa.
C. Primeiro card real de ponta a ponta com o Hermes real DENTRO do motor: card criado, etapas executadas, revisor aprovou, card PRONTO, resultado visível no site. Medir o consumo real de tokens.
D. Entrada em texto livre no site: 0021–0024 aplicadas, UI de pergunta/proposta/confirmação testada localmente e conversão sintética em `ROLLBACK`; faltam publicação e prova com primeiro card real.
E. Telegram → v2: eu falo no Telegram com um bot só e o pedido vira card (o Hermes 0.15.1 deixa só de ouvir o Telegram).
F. Dia de prova registrado com PASSOU / FALHOU / NÃO COMPROVADO: cota (20 tarefas no mesmo dia) e login (48 h com tarefas paralelas), com evidências em `docs/manual/dia-de-prova-evidencias.csv`.
G. Documentação sincronizada: critério pendente; conferir merge no main por evidência datada, sem assumir estado do PR.
FORA do "final" (decisões futuras minhas): destino real de "publicar", outros roteiros além do recrutamento, as 13 fichas de agentes faltantes, busca na internet, desligar a central da v1 (DEC-028, só com a minha frase exata).

## 8. Próximo passo

Conferir checkpoint vigente, integrar e publicar o código revisado, obter acesso técnico autenticado à VPS para inventário e staging, implantar Edge/transporte e provar um primeiro card delimitado. Há um [preparador de release sem ativação](../../motor/hermes-vps/ATUALIZAR-V2.md); o workflow SSH antigo não está homologado. A ordem e os estados A–G estão em [`docs/manual/onde-estamos.md`](onde-estamos.md). Não reativar a v1 como requisito do dia de prova. Revogação e rotação continuam pendentes para o encerramento, conforme a instrução mais recente do fundador.

O Vite iniciado no ambiente de nuvem responde apenas no `localhost` daquela máquina; isso não cria uma URL acessível no computador Linux do fundador. Para um clone novo, depois que a branch revisada estiver no GitHub, o comando local é:

```bash
test ! -e "$HOME/helena-v2" && git clone -b codex/helena-v2-kanban-triagem-20261017 https://github.com/tvmensal2025/financeiromaxnutrition.git "$HOME/helena-v2" && cd "$HOME/helena-v2" && npm ci && npm run dev -- --host 127.0.0.1 --port 8080
```

Abrir `http://localhost:8080/` nesse mesmo Linux. O comando recusa sobrescrever uma pasta `~/helena-v2` existente; `npm ci` usa o lockfile. A página local que o fundador abriu é validação de navegação, não publicação do site.

## 9. Regras do projeto que você deve respeitar
- A v1 está parada (DEC-032): `src/` é só a v2; o código da v1 fica em `docs/arquivo/app-v1/` só para consulta. `services/`, `scripts/` e `supabase/migrations/` são da v1 e só mudam com a minha frase exata (DEC-028).
- Alteração no banco exige a minha autorização explícita. Relatórios antigos nunca substituem a consulta atual ao Supabase.
- Nunca copiar valores de senhas, tokens, chaves ou códigos de recuperação; usar só nomes, locais e metadados.
- Antes de propor criar algo, verificar o que já existe: JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE / NÃO CONFIRMADO.
