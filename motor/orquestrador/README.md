# Orquestrador local do primeiro card

O card e as etapas ficam no PostgreSQL de teste. O DBOS 3.2.0 guarda dois passos por execução no banco de sistema separado: executar o agente e salvar a resposta e as cópias das leituras; ler esses dados persistidos, conferir e chamar `helena_v2.aplicar_evento`. Isso vale para autor e revisor. O executor deste passo é apenas `ExecutorFalso` com respostas dos casos bons de `helena-v2/casos/`. Revisões seguem a rubrica roteirizada. Nenhuma chamada é enviada ao Hermes real ou a um serviço externo.

Use um ambiente Python exclusivo do DBOS; o `requirements-hermes-real.txt` do executor pertence a outro ambiente. Os testes criam bancos descartáveis em PostgreSQL 16 local ou no serviço de CI. Para executar:

```sh
cd motor/orquestrador
python -m pip install -r requirements.txt
python -m pytest -q
```

`HELENA_V2_TESTE_DATABASE_URL` pode apontar para um PostgreSQL local de teste (`localhost` ou `127.0.0.1`). Sem ela, a fixture sobe um cluster local. O motor nunca aceita o mesmo banco para o card e para os passos DBOS. O banco do card é preparado com as migrations v2 de teste.
