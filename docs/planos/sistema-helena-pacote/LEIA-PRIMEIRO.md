# Sistema Helena: pacote para continuar o trabalho

Este pacote é para um Claude Code que vai continuar o projeto em outra conta. Leia este arquivo inteiro antes de abrir os outros. Nenhuma chave ou senha está aqui; não peça que sejam coladas no chat.

## Quem é o dono e o que ele quer

- Um fundador solo no Brasil, que escreve em português e não é programador. Tudo é construído e mantido por sessões de IA.
- Quatro empresas pequenas: iGreen, Saúde, Humano Digital e eLiving.
- Ele quer 21 agentes de IA que trabalhem como funcionários treinados, coordenados pela Helena (AGT-01).
- O modelo dele: ele fala com a Helena, o pedido vira um CARD no Supabase, os agentes trabalham no card, e o resultado volta ao card, organizado.
- Nas palavras dele: "Não pode ter erro de forma alguma. A lógica tem que ser exata." A manutenção precisa ser rápida e continuar organizada quando ele trocar modelos ou criar funções.
- Fale com ele em português simples, frases completas, sem jargão. Ele lê no celular.

## O que já existe (a v1, no ar)

Resumo em `pesquisa/contexto-do-sistema.md` (em inglês). Pontos principais:
- Supabase (projeto "ecosistemadossonhos"), 61 tabelas e cerca de 38 funções SQL.
- App React/Vite ("ids-app"), helena-gateway (servidor MCP em Node) no EasyPanel.
- Hermes Agent (Nous Research) rodando 21 perfis num contêiner, numa VPS de 4 núcleos compartilhados, junto com o app, o gateway e o WhatsApp (Evolution API).
- Modelos pela assinatura do ChatGPT dele (login OAuth no Hermes). DEC-014: sem API paga da OpenAI nesta fase.
- A v1 travou por 7 guardas escritas à mão que se atrapalhavam. As entregas eram boas; o encanamento falhou.

## O que estamos construindo (a v2, plano v3)

O plano completo está em `01-plano-v3.md`. Em uma frase: o banco manda, o motor executa e o agente só escreve conteúdo.
- Motor: DBOS Transact (Python, MIT), gravando no próprio Supabase pelo pooler de sessão.
- Uma tabela de estados e passagens no banco, uma função só muda o estado, 13 regras de ferro provadas antes de publicar, travadas no banco e vigiadas a cada 5 minutos.
- O agente (Hermes travado, modo `hermes -z`) devolve uma de 5 ações, sem ferramenta que grava, com no máximo "buscar" e "ler página", que são nossas.
- Qualidade em 3 portões: validador por código, revisor com rubrica, e o fundador só no plano da meta e em ação externa.
- Fases 0 a 4, cada uma com portão e revisão independente. A fase 0 começa por segurança.
- Primeira meta real: o plano para recrutar as 10 primeiras pessoas (E1 a E5) com 5 agentes: Helena, Caio, Isabela, Clara e Ravi.

## Ordem de leitura

1. Este arquivo.
2. `01-plano-v3.md`: o plano, a fonte da verdade.
3. `02-registro-de-furos.md`: 171 furos achados em quatro rodadas, cada um com conserto, teste e fase.
4. `pesquisa/`: os três ataques independentes (A, B, C), a verificação das fontes, a minha análise e o contexto. Use para entender o porquê de cada decisão; não refaça o que já foi verificado.
5. `diagramas/`: o código dos desenhos do documento (arquitetura, fases e o card de exemplo).
6. `historico/`: versões antigas do plano. Não seguir; servem só para ver o que mudou. O arquivo `documento-completo-rev105.md` ainda tem o texto antigo no fim, que já foi substituído pelo plano v3.

## Onde o trabalho parou

- O plano v3 está escrito e todos os furos conhecidos têm conserto, teste e fase. Nada foi construído ainda.
- No documento original (um Claude Doc na conta antiga), faltava: criar a aba "Registro de furos", apagar o texto antigo do fim e renomear para "Sistema Helena: plano v3". Este pacote já traz o plano limpo e o registro.
- Uma conferência final cruzando cada linha do registro com o plano não chegou a terminar. Vale repetir antes de pedir a aprovação.

## O que depende do fundador

- A aprovação, com a frase exata: **aprovo o plano v3 e o roteiro das 10 pessoas, com o motor DBOS**.
- Uma decisão em aberto: trocar as chaves expostas no chat já na fase 0 (recomendado, porque dão acesso total ao banco durante toda a construção) ou no fim dos testes, como tinha sido combinado antes.
- Na fase 0, os passos que só ele faz: remover as portas 9119 e 8642, rodar a checagem de invasão, trocar as chaves, ligar a verificação em duas etapas, criar o repositório privado, a conta do healthchecks.io e o robô de avisos no Telegram.

## Regras que continuam valendo

- Nunca pôr senha ou chave em arquivo, mensagem ou memória. Chave colada vira "[chave removida]".
- Mudança no banco ou no servidor só depois de uma frase exata digitada por ele.
- Agentes nunca cadastram, contatam pessoas de fora, gastam, assinam, publicam ou fazem commit em nome dele.
- DEC-014: sem API paga da OpenAI nesta fase. Não aumentar o plano do Supabase sem a decisão dele.
- Nunca mandar o arquivo hermes-backup (zip de 500 MB): ele contém tokens.
- Nunca apagar o app da Hostinger; renovar antes de 27/10/2026.
- Publicar só com o toque dele (o botão de publicar), no máximo uma vez por dia.
- Sem prazo prometido: nenhuma fase avança por data, só por teste.

## Como falar dos furos

Nunca prometa "zero furo". O certo é: nenhum furo conhecido em aberto, com o processo que acha o próximo antes dele (revisão independente em cada fase, vigia no ar e todo erro virando teste).
