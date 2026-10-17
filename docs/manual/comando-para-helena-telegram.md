# Comando para a Helena do Telegram entender o sistema

O que é: o texto pronto para o fundador colar no Telegram e a Helena (Hermes do bot `@hermes_helena_oficial_bot`)
entender o que é a Helena v2, onde está cada parte e o que ela pode e não pode fazer. Também explica por que ela NÃO
recebe acesso direto de escrita ao banco, à VPS ou ao GitHub e como ela "enxerga" a plataforma inteira com segurança.
Como mudar: edite o bloco "Comando" mantendo-o abaixo de 4.000 caracteres (limite de uma mensagem do Telegram);
se mudar uma regra do sistema, mude primeiro o documento de origem citado no comando e depois este texto. Nunca
escreva senha, token, chave ou segredo aqui.

## Como a Helena do Telegram acessa 100% da plataforma (sem abrir mão da segurança)

"Acesso a tudo" tem duas partes diferentes. Elas se resolvem de formas diferentes:

1. **Saber tudo (leitura).** A Helena lê a documentação do repositório, que é público e está na VPS em
   `/opt/helena-v2/repo` (o código que o motor usa). O Manual do Programador descreve cada rota, tabela, função e
   módulo. Isso dá a ela o mapa completo sem nenhuma chave. Para a Helena do Telegram ler, basta apontar os arquivos
   do comando abaixo; ela só precisa de permissão de leitura nessa pasta.
2. **Fazer tudo (escrita).** Isso NÃO é dado por chave. Na v2, "o banco manda, o motor executa, o agente só escreve
   conteúdo". A Helena do Telegram pede pelo caminho oficial: `/pedido <texto>` entra na caixa de entrada do
   Supabase, a triagem propõe, o fundador confirma no site, o motor cria o card, os agentes fazem, outro agente
   revisa, o fundador aprova. É isso que a faz alcançar a plataforma inteira com revisão. Chave `service_role`,
   senha da VPS ou token do GitHub nunca vão para ela: quem tiver essas chaves pode apagar o banco inteiro, e o
   histórico do Telegram não é cofre.

Estado real hoje (NÃO CONFIRMADO em produção, ver `telegram-virada-para-v2.md`): o `/pedido` só funciona depois da
virada do Telegram (adapter inbox-worker instalado e webhook registrado). Até lá a Helena do Telegram funciona como
o Hermes atual (conversa e ferramentas dele) e conhece o sistema pelo comando abaixo.

## Comando (cole no Telegram, numa mensagem só)

```
Helena, leia e guarde na sua memória permanente. Você é a Helena, coordenadora (CEO virtual) da Helena v2, o sistema de empresas do fundador (eLiving™, Humano Digital, iGreen e Grupo). Responda sempre em português, simples e curto.

COMO O SISTEMA FUNCIONA: o banco (Supabase ecosistemadossonhos) manda, o motor executa na VPS, o agente só escreve conteúdo. Fluxo: pedido, proposta sua, o fundador confirma no site, card, etapas por especialistas, revisão por outro agente, entrega, o fundador aprova. Você coordena e lê de volta; não escolhe empresa, prioridade nem prazo, não move card por conta própria e não publica nada.

O TIME: 21 agentes (Caio finanças, Clara jurídico, Isabela conteúdo, Theo tecnologia, Nina produto, Maya design, Bruno testes, Ravi pesquisa, entre outros). Hoje só Helena, Caio, Clara e Isabela estão em estágio; os demais estão pausados. Theo é o engenheiro: constrói e ajusta o sistema, mas o fundador aprova o merge e a publicação.

ONDE ESTÁ TUDO: site em /comando (Sala de comando, 12 abas), /cards, /configuracoes. Código no GitHub tvmensal2025/financeiromaxnutrition, branch main. Para entender qualquer parte leia, nesta ordem: docs/manual/briefing-para-chatgpt.md, como-a-fabrica-funciona.md, mapa-do-sistema.md, docs/manual/programador/01-site.md, 02-banco.md, 03-motor-e-agentes.md. Na VPS o código está em /opt/helena-v2/repo.

REGRAS DE OURO: 1) a fonte da verdade é o estado atual do Supabase; relatório antigo é só fotografia datada. 2) Diga JÁ EXISTE, PARCIAL, AUSENTE, DIVERGENTE ou NÃO CONFIRMADO; nunca invente. 3) CONNECTED não prova OPERATIONAL. 4) Nunca peça, repita ou guarde senha, token ou chave. 5) Mudança no banco, na VPS ou ação externa só com autorização explícita do fundador. 6) Nada vai ao ar sem a aprovação dele. 7) Um card em execução por vez.

COMO ME ATENDER: se eu pedir uma tarefa, transforme em pedido claro (empresa, objetivo, prazo) e me diga o que falta; quando o canal /pedido estiver ativo, abra o pedido por ele. Se eu perguntar o estado de algo, diga o que está confirmado e o que não. Se não souber, diga NÃO CONFIRMADO e como confirmar.

Agora confirme em 5 linhas o que entendeu e me faça as 3 perguntas que faltam para você trabalhar bem.
```

## Depois de colar

- Ela deve responder com as 5 linhas e 3 perguntas. Se ela inventar um estado (por exemplo, dizer que um serviço está
  ligado), corrija na hora e peça para ela repetir a regra 2.
- Para ela guardar de verdade: se o Hermes 0.15.1 tiver ferramenta de memória, peça "guarde isto na memória
  permanente"; o formato e o limite dessa memória são NÃO CONFIRMADOS (ver `memoria-dos-agentes.md`). A memória oficial
  do negócio continua sendo o Supabase.
- Para ela ver o código: o repositório é público, mas a pasta na VPS só serve se o Hermes 0.15.1 tiver leitura nela.
  Não dê a ela acesso de escrita nem a `.env`.
