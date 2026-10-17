# Como a fábrica da Helena v2 funciona (17/10/2026)

Documento para o fundador. Escrito a partir da leitura da especificação (`helena-v2/`), do banco (`supabase/migrations-v2/`), do motor (`motor/`) e do app (`src/`), com o estado real da VPS e do Supabase de 17/10/2026. Onde não deu para confirmar, está escrito **NÃO CONFIRMADO**. Precedência do projeto: o estado real do Supabase e da produção vence qualquer texto daqui.

## 1. A ideia em uma frase

Você faz um pedido, o pedido vira um **card**, especialistas (agentes de IA) fazem o trabalho em **etapas**, um **revisor** confere, e o resultado volta ao card. **O banco manda, o motor executa, o agente só escreve conteúdo.** O agente nunca age fora do sistema: ele sugere, e quem decide ações externas é você.

## 2. As cinco peças e onde cada uma mora

| Peça | Onde fica | O que faz | O que NÃO faz |
|---|---|---|---|
| **Site** (app v2) | Lovable | Mostra cards, configuração e botões de decisão para o fundador | Não decide nada sozinho: o banco decide de novo |
| **Banco** (Supabase, esquema `helena_v2`) | Nuvem | Guarda tudo: cards, etapas, respostas, histórico, configuração ativa, e **as regras** (máquina de estados) | Não pensa; só aceita ou recusa |
| **Motor** | Sua VPS | Três serviços: vigia, relógio, despachante | Não decide estado: só dispara eventos que o banco aceita ou recusa |
| **Hermes** | Sua VPS (versão 0.19.0) | Operador que chama o ChatGPT em nome de cada agente | Não guarda memória entre execuções |
| **ChatGPT** (provedor `openai-codex`) | OpenAI | Pensa e escreve; usa a assinatura, sem API paga | — |

Existe ainda, **fora desta fábrica**, o Hermes 0.15.1 do Telegram (em `/root/.hermes`). Ele conversa, mas **não está ligado à v2**.

## 3. Os agentes

São **identidades** guardadas na configuração, não programas separados. Quando uma etapa precisa do Caio, o motor chama o Hermes com a ficha do Caio, e o ChatGPT responde como ele. Todos usam o mesmo Hermes e o mesmo login, **um agente por vez**. Não existe hierarquia "reporta a": você manda em todos, a Helena é dona de todo card mas **não move card** (quem move é o motor).

Estados de serviço: **ESTÁGIO** recebe card real, com você como revisor extra. **RASCUNHO** não recebe card. Hoje **nenhum serviço está publicado** e a v2 ainda não rodou um card real.

| Agente | Função | Serviço (estado) | Quem revisa / reserva |
|---|---|---|---|
| Helena | Coordenação, leitura de volta, relatório final | Relatório final (ESTÁGIO) | Caio / Clara |
| Laura | Prática de comunicação do fundador (pessoal) | Plano de prática (RASCUNHO) | Helena / Fundador |
| Augusto | Estratégia | Análise estratégica (RASCUNHO) | Ravi / Caio |
| Marina | Planos de projeto e cronogramas | Plano de projeto (RASCUNHO) | Augusto / Felipe |
| Caio | Finanças: conta e 3 cenários | Cálculo (ESTÁGIO) | Helena / Clara |
| Clara | Jurídico, risco e conformidade | Parecer (ESTÁGIO) | Helena / Fundador |
| Bianca | Pessoas e cultura | Perfil de função (RASCUNHO) | Olívia / Augusto |
| Daniel | Dados e indicadores | Análise de dados (RASCUNHO) | Ravi / Caio |
| Theo | Tecnologia | Proposta técnica (RASCUNHO) | Nina / Bruno |
| Nina | Produto | Requisitos de produto (RASCUNHO) | Ravi / Maya |
| Ravi | Pesquisa (lê páginas da internet) | Dossiê (RASCUNHO, fase 3) | Isabela / Augusto |
| Maya | Design de experiência | Especificação de interface (RASCUNHO) | Nina / Bruno |
| Bruno | Testes de produto | Plano de testes (RASCUNHO) | Theo / Nina |
| Olívia | Operações internas | Procedimento operacional (RASCUNHO) | Marina / Felipe |
| Victor | Vendas | Roteiro comercial (RASCUNHO) | Isabela / Camila |
| Camila | Marketing e crescimento | Plano de campanha (RASCUNHO) | Daniel / Augusto |
| Isabela | Texto e conteúdo | Texto pronto/copy e roteiro de treinamento (ESTÁGIO) | Caio / Camila ou Olívia |
| Pedro | Parcerias | Tese de parceria (RASCUNHO) | Augusto / Victor |
| Renata | Sucesso do cliente | Plano de sucesso (RASCUNHO) | Daniel / Victor |
| Joana | Atendimento (rascunhos de resposta) | Rascunho de resposta (RASCUNHO) | Renata / Isabela |
| Felipe | Administração e vencimentos | Controle administrativo (RASCUNHO) | Olívia / Marina |

Fatos sobre os agentes: só 8 dos 21 têm ficha completa (Helena, Laura, Augusto, Marina, Caio, Clara, Ravi, Isabela); os outros 13 aparecem como pendência conhecida. Sirlene, Doutor Vital, Alex e Rafael **não são agentes**: são personagens da marca eLiving™. Empresas: iGreen e Ecossistema de Saúde têm pacote de voz NÃO CONFIRMADO; Humano Digital e eLiving™ têm pacote CONFIRMADO. Card de empresa sem pacote confirmado é recusado.

Modelo: todos usam `gpt-6-sol`, menos a coordenação da Helena (`gpt-6.1-sol`). Não há modelo reserva. Existe um "modelo menor por ordem sua", mas nenhum serviço está apto a usá-lo hoje.

## 4. Como um pedido anda, passo a passo

1. **Pedido.** Você registra um pedido autenticado. O banco só aceita se vier de você e se os fatos conferirem (tarefa existe, empresa ativa, revisão de configuração ativa e validada). Isso impede "card de mentira".
2. **Card nasce** em RASCUNHO, com a revisão de configuração **fixada**. Se você trocar a configuração depois, os cards em andamento continuam na revisão em que nasceram.
3. **Leitura de volta.** A Helena resume o que entendeu ("Entendi assim"). Sem essa leitura comprovada, o botão "Confirmo" fica bloqueado. Você confirma.
4. **Validação do plano** pelo código (60 segundos). Plano inválido volta a você com o motivo.
5. **Fila.** O despachante escolhe **um** card: maior prioridade, depois menor prazo, depois o mais antigo. Só você muda prioridade. Vaga única (WIP = 1).
6. **Etapa do autor.** O banco abre a execução. O motor monta só as entradas daquela etapa, sobe um perfil novo e isolado do Hermes, roda o comando `hermes -z …` com o modelo da ficha e **só as ferramentas permitidas**, e mede o consumo.
7. **A resposta é gravada no banco antes de qualquer outra coisa.** Só depois a pasta da execução é apagada. Por isso uma queda não perde nem repete o trabalho já gravado.
8. **Portão 1 (código, sem IA).** Confere formato, português, texto puro, tamanho, citações, cálculos refeitos, ausência de "enviei/paguei" e a grafia eLiving™. Recusado volta ao autor com o item exato.
9. **Revisor.** Outro agente, nunca o autor, confere cada critério da rubrica do tipo de entrega, com prova. Peças jurídicas só valem com **seu** "Aprovar" como segundo revisor.
10. **Etapa pronta**, e as seguintes andam respeitando as dependências.
11. **Card PRONTO.** O relatório final da Helena resume em linguagem simples.
12. **Ações externas** (enviar, publicar, contatar, pagar): só nascem depois do card pronto e **só com o seu OK registrado**, uma vez. O motor executaria, mas esse trecho **ainda não existe** (ver seção 9).

O motor **nunca confirma pelo fundador**. Quando falta uma decisão sua, o card pára e pergunta, com botões (Confirmo, Aprovar, Pedir ajuste, Cancelar, Refazer, Pular, Encerrar, Autorizar ação externa).

## 5. O banco: por que quase tudo é fechado

- São 33 tabelas no esquema `helena_v2`, mais 13 do DBOS (`dbos_helena_v2`).
- O app **não** escreve em tabelas. Tudo passa por funções que conferem **quem** está chamando. Só 9 das 33 tabelas têm RLS (as que o app lê direto); as outras 24 não dão acesso nenhum a usuários comuns.
- Histórico e mensagens só **acrescentam**: nada se apaga nem se reescreve.
- Estados finais não voltam. Prioridade e prazo só mudam por toque seu.
- A **configuração** tem revisões: RASCUNHO (editável), VALIDADA (imutável, com hash) e APOSENTADA. Só **uma** está ATIVA. Clonar, pedir validação e ativar são seus; quem **valida** é o código do motor, nunca a IA. Há reversão e uma trilha de quem ativou e quando.
- Contas do motor: `helena_motor` (login sem poder, que assume `service_role` por troca de papel) e `dbos_motor` (dono do esquema do DBOS). Nenhuma é administrativa.

## 6. O motor por dentro (VPS)

| Serviço | Frequência | O que faz | Estado na VPS |
|---|---|---|---|
| **Vigia** | a cada 5 min | Só lê. Confere as 13 regras de ferro, relógio atrasado, execução parada há mais de 1 h, card parado há 6 h | Ligado |
| **Relógio** | a cada 60 s | Aplica o que o **banco** diz que venceu (prazos, lembretes). Nunca aprova nada por tempo | Ligado |
| **Despachante** | rodada a cada 5 s | O **único** que chama agente e gasta cota | Ligado em 17/10, ocioso (nenhum card) |

Durabilidade: o DBOS grava um ponto de controle por passo. Se a VPS cair depois de gravar a resposta, ele retoma sem repetir o agente. Se cair entre o retorno do ChatGPT e a gravação, **pode repetir a chamada** e gastar cota de novo. Se a VPS inteira cair, os três serviços caem juntos.

Isolamento do Hermes: cada execução tem pasta própria, ambiente montado do zero (sem herdar variáveis), memória desligada, `fallback` desligado, só as ferramentas da ficha. No fim o motor confere que nada vazou e apaga tudo.

Ferramentas dos agentes (só leem): `ler_pagina`, restrita à lista de endereços do pedido, com defesas de rede. `buscar` está **desligada**.

## 7. O que você decide e o motor nunca faz

Só você: empresa, prioridade e prazo de cada card; o OK de qualquer ação externa; ser o segundo revisor do parecer jurídico; publicar e subir serviços de estado; o pacote de voz de cada empresa. O padrão por falta de resposta **nunca aprova**: só cancela ou expira.

## 8. Segurança e limites de custo

- O consumo vem do arquivo de uso do Hermes. Teste real de 17/10: uma pergunta mínima custou cerca de 10,7 mil tokens de entrada, com custo "incluído" no plano.
- Falha de cota (HTTP 402/429) não gasta tentativa: avisa em 1 hora e, em 6 horas, você escolhe esperar ou cancelar.
- Tetos por etapa: 6 execuções no total, 1 refação de formato, 1 de tempo, 2 voltas por reprovação, 3 falhas de infraestrutura seguidas chamam você.

## 9. O que existe e o que NÃO existe

| Peça | Estado em 17/10/2026 |
|---|---|
| Banco v2, contas do motor, configuração ativa | **Funcionando** (revisão técnica `2a37fb92…` ativa) |
| Motor na VPS (3 serviços) | **Funcionando** |
| Hermes 0.19.0 + ChatGPT real | **Funcionando** (teste direto: respondeu `ok`) |
| Site no `main` | Pronto; falta publicar no Lovable |
| Telegram falando com a v2 | **Não existe** (nenhum código do motor fala com Telegram ou WhatsApp) |
| Pedido em texto livre ("faça um post") | **Não existe**: exige migration nova no banco, função nova e ajuste no motor |
| Primeiro card real de ponta a ponta | **Não rodou** |
| Publicar/enviar de verdade (ação externa) | **Não existe** destino real; o código do motor também não emite as ações externas |
| Busca na internet | Desligada |
| Revisor devolvendo ao autor (`REPROVAR`) | A tabela do banco prevê, mas o motor **não emite**: critério não aprovado só gera erro |
| Contador/limite diário de cota | **Não existe** no código (o valor está em branco na especificação) |
| Alarmes por celular ou webhook | Só **arquivo local** na VPS (`/var/log/helena-v2/alarmes.log`) |

## 10. Riscos conhecidos antes do primeiro card real

1. **NÃO CONFIRMADO:** como o perfil isolado de cada execução enxerga o login do ChatGPT guardado na pasta da v2. O código não copia o `auth.json`. O primeiro card real pode falhar com erro de login, e isso só o dia de prova responde.
2. No modo real, os serviços **Cálculo** e **Parecer** registram "faltam dados" sem chamar agente (faltam dados tipados e a tabela de leis). O roteiro `recrutar-10-pessoas` depende dos dois, então hoje ele não roda de ponta a ponta.
3. Uma queda no meio do Hermes pode deixar a retomada travada até o vigia alarmar (cerca de 1 hora). A limpeza de processos sobrando existe, mas não está ligada.
4. O revisor hoje só aprova ou trava: não devolve ao autor.
5. Não há contagem de cota: o consumo só é visível depois.

## 11. O que existe para um "post rápido"

A especificação já prevê o serviço de **Texto pronto** (Isabela escreve, Clara julga, você é o segundo revisor), só para Humano Digital e eLiving™. O código monta sozinho um plano fixo de 2 etapas. Falta a **porta de entrada** (texto livre) e confirmar que o app oferece esse serviço.

## 12. Ordem proposta para construir o que falta

1. Rodar o **primeiro card real** com um serviço que não dependa de Cálculo nem de Parecer, para resolver o risco do login (item 1 da seção 10).
2. **Entrada em texto livre** no site (migration `0020` com tabela e função novas, só com o seu sim; ajuste no motor para o novo modo de card).
3. **Telegram → v2**, usando a mesma função de pedido.
4. Reabrir o revisor (`REPROVAR`) e o contador de cota.
5. Destino real de publicação, definido por você.

## 13. Pendências de segurança e limpeza (registradas no HANDOFF)

Repositório público com 4 segredos reais no histórico (trocar as chaves e tornar privado); chave SSH e senha root da VPS que passaram pelo chat; token do GitHub colado no chat; tabela temporária de instalação ainda no banco; backup do Hermes antigo do EasyPanel feito na VPS, falta conferir e apagar o serviço antigo.
