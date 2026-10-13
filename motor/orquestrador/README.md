# Orquestrador do primeiro card

O motor tem dois caminhos explícitos: testes locais com dados de teste e execução real com fontes importadas, pedido autenticado e adaptador aprovado. Supabase guarda o estado e as revisões; DBOS 3.2.0 coordena os passos duráveis; o executor chama os agentes. Autor e revisor guardam resposta, conversa e evidências antes da validação e limpeza. A existência desse código não comprova implantação ou execução real do Hermes.

## Dados reais e comandos

`python -m orquestrador preparar-tarefa-real --tarefa ID --roteiro recrutar-10-pessoas --saida CAMINHO_PRIVADO` consulta a API oficial em transação somente leitura. A captura deve ficar fora de qualquer repositório Git. O resultado permanece AGUARDANDO_CONFIRMACAO: não cria aprovação, prazo ou fatos ausentes.

Depois de o fundador registrar a solicitação autenticada no SQL, `consumir-pedido-real --solicitacao UUID` cria o card de forma idempotente. `avancar-card-real --card UUID` confere o card e a vigência das fontes antes de iniciar DBOS e pedir um avanço. Iniciar DBOS também pode retomar workflows reais pendentes da mesma aplicação; não há filtro global de retomada por esse UUID. Nunca confirma pelo fundador. Se houver erro após gravar uma operação, consulte o pedido/card antes de repetir.

O runtime exige `HELENA_V2_DATABASE_URL`, `HELENA_V2_DBOS_SYSTEM_DATABASE_URL`, `HELENA_V2_HERMES_BIN`, `HELENA_V2_HERMES_HOME` e `HELENA_V2_EXECUCOES_DIR`. Token Management não substitui essas conexões e o login Hermes. Bancos separados, TLS com CA confiável, papéis próprios e revisão ativa são obrigatórios. O worker não instala migrations; prepare e revise o schema DBOS antes, pois `run_migrations=False`. O preflight recusa credenciais administrativas e configurações incompatíveis.

## Trocar o executor

Hoje o registro aprovado contém apenas `ExecutorHermes`. EVE ou OpenClaw exigem adaptador próprio que cumpra `Executor.rodar`, `cancelar`, limpeza e o contrato `Resultado`, incluindo evidências e isolamento. Depois de testes e revisão, o adaptador entra no registro em código. Não há instalação automática nem carregamento de classes por YAML. Não foi verificado um repositório EVE específico nem comprovada compatibilidade com esses produtos.

## Limites de homologação

A leitura real da tarefa canônica confirmou três entradas documentais e duas decisões, sem chamar agentes ou escrever no Supabase. A captura não confirma tarifa ou pagador. Ainda faltam implantação isolada, vínculos reais de banco/Hermes e os testes operacionais e de navegador registrados em `docs/manual/proximos-passos-do-primeiro-card.md`. Conversa/evidências duráveis do coordenador devem ser verificadas separadamente das do autor/revisor.

O roteiro canônico `recrutar-10-pessoas` tem cinco etapas e quatro identidades: Helena, Caio, Isabela e Clara. Um teste separado despacha Ravi no serviço `SRV-DOSSIE` e confere a revisão de Isabela. Esse serviço continua em RASCUNHO e a prova não ativa o serviço nem atesta aptidão dos revisores. A identidade do fundador é injetada apenas pela classe de teste; o `Motor` exige contexto explícito e os testes não exercitam autenticação de produção. A retomada coberta é a queda depois de gravar a resposta no SQL e antes do checkpoint do DBOS, com reinício do motor e sem repetir o agente falso.

Use um ambiente Python exclusivo do DBOS; o `requirements-hermes-real.txt` do executor pertence a outro ambiente. Os testes criam bancos descartáveis em PostgreSQL 16 local ou no serviço de CI. Para executar:

```sh
cd motor/orquestrador
python -m pip install -r requirements.txt
python -m pytest -q
```

`HELENA_V2_TESTE_DATABASE_URL` pode apontar para um PostgreSQL local de teste (`localhost` ou `127.0.0.1`). Sem ela, a fixture sobe um cluster local. O motor nunca aceita o mesmo banco para o card e para os passos DBOS. O banco do card é preparado com as migrations v2 de teste.

Para conferir uma configuração solicitada pelo fundador, use o comando local explícito `python -m orquestrador validar-configuracoes`. Defina `HELENA_V2_CONFIG_DATABASE_URL` e `HELENA_V2_DBOS_SYSTEM_DATABASE_URL` para dois bancos PostgreSQL locais separados; o comando registra aprovação ou erros da validação de código e não ativa a revisão. O cadastro inicial da base técnica de teste é um comando separado, `python -m orquestrador registrar-base-tecnica`, com as mesmas variáveis. Esses comandos não iniciam DBOS nem retomam workflows. O painel mostra o pedido como pendente até esse trabalhador rodar. Sem revisão ativa, o motor comum recusa novos cards; os testes optam explicitamente pela base técnica e pelo executor falso. Todo despacho lê a revisão fixada no card, inclusive após reinício.

`service_role` é uma identidade privilegiada de backend; sua credencial pertence apenas ao worker, nunca ao cliente. Ela não representa a autorização do fundador: a solicitação exige sua sessão autenticada. O modelo não protege de um worker comprometido que consiga alterar as próprias fontes; verificar grants efetivos na instalação.
