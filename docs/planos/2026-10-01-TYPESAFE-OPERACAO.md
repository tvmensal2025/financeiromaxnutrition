# TypeSafe / Jev — operação do piloto

Revisão: 2026-09-29. Implementação local validada; produção e API real pendentes.

## Ponto de entrada

`release_job`: validação determinística do briefing → pré-checagem Jev → liberação original pelo Gateway. O modo `shadow` apenas registra recomendação. Não aprova entregas, não substitui revisores, não inicia agentes e não bloqueia a liberação por baixa confiança ou indisponibilidade do provedor. Identidade ou versão desatualizada continuam impedindo a operação.

## Configuração no serviço helena-gateway

Somente no ambiente do servidor, preservar as demais variáveis:

```dotenv
TYPESAFE_MODE=shadow
TYPESAFE_BUSINESS_IDS=BIZ-003
TYPESAFE_DAILY_LIMIT=10
# Inserir TYPESAFE_API_KEY pelo gerenciador de segredos, nunca neste arquivo.
```

Sem configuração completa não há chamadas. Para desligar, definir `TYPESAFE_MODE=off` e reiniciar o serviço. Não existe modo de aprovação automática nesta versão.

## Custos e registros

- Modelo fixo `jev-1.13.0`; três perguntas em uma requisição: função, coerência e necessidade de esclarecimento.
- Entrada limitada a 16.000 bytes; sem histórico geral ou checkpoint. Detecta padrões de credenciais, mas não é anonimizador de dados pessoais.
- Limite diário compartilhado de reservas, contado por dia UTC. Falhas e reinícios não devolvem reservas. Nenhuma repetição automática.
- Reserva única por conteúdo/versão antes da chamada. Mudança de conteúdo ou versão pode gerar uma nova avaliação, ainda sujeita ao limite diário.
- Eventos `TYPESAFE_REQUEST`, `TYPESAFE_BUDGET_RESERVED` e `TYPESAFE_RESULT` na tabela existente `agent_job_events`. Nenhuma tabela nova.
- Registra modelo, política, status, distribuição, uso e estimativa de custo; não registra chave ou texto integral do briefing.
- Tempo limite do provedor: 10 segundos. Resposta limitada a 32.000 bytes e validada antes do uso.

## Validação

Suite local: 182 testes aprovados e 29 verificações adicionais aprovadas, sem chamadas pagas. Inclui concorrência, reinício, limite diário, empresa, versão, indisponibilidade e resposta inválida.

Após configurar a chave, executar uma única vez no console do serviço:

```sh
node src/typesafe-smoke.mjs
```

Esse teste usa briefing sintético, faz uma chamada paga e mostra somente resultado e uso. Não despacha agentes nem escreve no Supabase. Por ser diagnóstico manual, não passa pelo contador diário do workflow; não agendar nem repetir em laço.

Depois, validar uma liberação autorizada real de BIZ-003: conferir os eventos persistidos, versão da tarefa e ausência de repetição da chamada. Só então avaliar uma amostra em português com rótulos do revisor. Limiares iniciais são consultivos, não homologados para aprovação.

`/health` expõe configuração e último status, sem chave. Saúde do serviço não comprova o ciclo inteiro dos 21 agentes. Economia de GPT ainda não foi medida; modo sombra acrescenta custo de avaliação e não evita chamadas por classificação.

## Referências consultadas

- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/confidence
- https://docs.typesafe.ai/model-jaggedness/jev-1.13
- `.agents/skills/typesafe-ai/SKILL.md`
