# Jev para escolher subagentes no Codex

**Estado em 29/09/2026:** o Jev avalia briefings do piloto BIZ-003 no Gateway e recomenda Luna, Sol ou Astra por job quando a resposta é coerente e confiante. A recomendação fica em `TYPESAFE_ROUTE` vinculada à versão da tarefa após a liberação; o despachante do Hermes usa `--model` somente quando esse registro corresponde ao job, empresa, agente, versão e hash do briefing. Em caso de incerteza ou ausência de registro, mantém o modelo padrão do perfil. Helena continua no Sol. O Gateway `42c30ce` e o despachante Hostinger foram instalados; testes sintéticos das três escolhas e leitura da fila passaram, sem iniciar agentes. Ainda falta uma liberação e execução real para homologar o roteamento de produção, e o escopo Jev não foi ampliado às demais empresas.

A chave também foi configurada pelo fundador como variável de usuário no Windows, fora do repositório. O roteador local foi validado com uma chamada real: o provedor respondeu `jev-1.13.0`, confiança `0,73` e `REVIEW_REQUIRED` para uma tarefa pequena de exemplo. Nenhum modelo foi escolhido automaticamente nessa avaliação; o limite de delegação automática é `0,80`. Isso não altera o modelo principal da conversa.

O fluxo local é: Codex identifica uma parte independente do pedido → envia somente `task` e `context` resumidos ao script → Jev sugere `LUNA`, `SOL`, `ASTRA` ou `UNCLEAR` com confiança → Codex decide se vale delegar e confere o resultado. A classificação não autoriza gastos, mudanças no Supabase, publicações nem troca de modelo do chat principal. Tarefas pequenas, urgentes ou dependentes ficam com o agente atual para evitar o custo de mais uma chamada.

Para ativar no computador, configure `TYPESAFE_API_KEY` como variável de ambiente privada **fora do repositório** e reinicie o terminal do Codex. Use a chave da sua conta TypeSafe; não a cole no chat, em `AGENTS.md`, no Git ou no comando de exemplo. A chave existente no EasyPanel continua no servidor; não há sincronização automática de segredos entre EasyPanel e Codex.

Exemplo de consulta pontual, somente quando uma delegação independente realmente trouxer ganho:

```powershell
'{"task":"Ajustar o componente de busca da pagina de entregas sem alterar outros modulos","context":"Um componente, teste local e criterio de aceite definidos"}' | node scripts/jev-model-router.mjs
```

`ADVICE` apresenta um modelo sugerido para **subagente**. `REVIEW_REQUIRED`, `MISSING_LOCAL_TYPESAFE_KEY` ou `PROVIDER_UNAVAILABLE` não escolhem modelo: Codex decide pelo escopo, sem repetir automaticamente a consulta. Cada consulta real ao Jev pode ter custo; portanto, use apenas para decisões em que a escolha pode compensar a própria chamada. Não passe dados pessoais, financeiros, médicos, clientes ou credenciais no resumo.

Verificação: `node --test scripts/jev-model-router.test.mjs` passou; a execução sem chave retornou `MISSING_LOCAL_TYPESAFE_KEY`. Foi feita **uma** consulta real após a configuração da chave e recebida uma resposta válida `REVIEW_REQUIRED`. Economia de cota permanece **não confirmada** até medir uma amostra de tarefas, comparando chamadas, qualidade e retrabalho. Não repetir consultas pagas para forçar uma escolha.
