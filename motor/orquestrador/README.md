# Orquestrador local do primeiro card

O card e as etapas ficam no PostgreSQL de teste. O DBOS 3.2.0 guarda dois passos por execução no banco de sistema separado: executar o agente e salvar a resposta e as cópias das leituras; ler esses dados persistidos, conferir e chamar `helena_v2.aplicar_evento`. Isso vale para autor e revisor. A prova usa `ExecutorFalso` com respostas dos casos bons de `helena-v2/casos/`. O motor aceita um executor injetado, mas ainda depende do contexto sintético, que exige opt-in explícito e bancos locais. Revisões seguem a rubrica roteirizada. Nenhuma chamada é enviada ao Hermes real ou a um serviço externo.

O roteiro canônico `recrutar-10-pessoas` tem cinco etapas e quatro identidades: Helena, Caio, Isabela e Clara. Um teste separado despacha Ravi no serviço `SRV-DOSSIE` e confere a revisão de Isabela. Esse serviço continua em RASCUNHO e a prova não ativa o serviço nem atesta aptidão dos revisores. A identidade do fundador é injetada apenas pela classe de teste; o `Motor` exige contexto explícito e os testes não exercitam autenticação de produção. A retomada coberta é a queda depois de gravar a resposta no SQL e antes do checkpoint do DBOS, com reinício do motor e sem repetir o agente falso.

Use um ambiente Python exclusivo do DBOS; o `requirements-hermes-real.txt` do executor pertence a outro ambiente. Os testes criam bancos descartáveis em PostgreSQL 16 local ou no serviço de CI. Para executar:

```sh
cd motor/orquestrador
python -m pip install -r requirements.txt
python -m pytest -q
```

`HELENA_V2_TESTE_DATABASE_URL` pode apontar para um PostgreSQL local de teste (`localhost` ou `127.0.0.1`). Sem ela, a fixture sobe um cluster local. O motor nunca aceita o mesmo banco para o card e para os passos DBOS. O banco do card é preparado com as migrations v2 de teste.

Para conferir uma configuração solicitada pelo fundador, use o comando local explícito `python -m orquestrador validar-configuracoes`. Defina `HELENA_V2_CONFIG_DATABASE_URL` e `HELENA_V2_DBOS_SYSTEM_DATABASE_URL` para dois bancos PostgreSQL locais separados; o comando registra aprovação ou erros da validação de código e não ativa a revisão. O cadastro inicial da base técnica de teste é um comando separado, `python -m orquestrador registrar-base-tecnica`, com as mesmas variáveis. O painel mostra o pedido como pendente até esse trabalhador rodar. Sem revisão ativa, o motor comum recusa novos cards; os testes optam explicitamente pela base técnica e pelo executor falso. Todo despacho lê a revisão fixada no card, inclusive após reinício.
