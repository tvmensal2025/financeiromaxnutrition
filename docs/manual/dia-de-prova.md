# Dia de prova da v2 — roteiro ainda não executado

**Estado:** o HANDOFF registra que o fundador deu historicamente a frase de autorização do dia de prova. Isso não significa que a prova ocorreu nem substitui autorização específica para mudanças no banco, servidor, publicação ou serviços externos. Este roteiro permanece **NÃO EXECUTADO** até evidência registrada. Não exige nem autoriza reativar a v1; qualquer critério que dependa dela, inclusive comparação de cotas, fica **NÃO COMPROVADO** até haver procedimento seguro autorizado que não a reative.

## Preparação e teste 3: Hermes travado

O arquivo `motor/executor/verificacao_real/test_hermes_real.py` usa `ExecutorHermes` e os mesmos cenários de `testes/cenarios.py`, com servidor falso local no lugar da OpenAI. O portão `--autorizar-hermes-real` impede execução acidental; **é só uma confirmação operacional, não substitui a frase do fundador**. O pacote Hermes 0.19.0 fica em venv separado do DBOS.

Para o teste local com servidor falso, siga o comando abaixo após revisar as dependências. Ele não comprova operação real nem autoriza mudanças remotas.

```sh
cd motor/executor
uv venv --python /usr/bin/python3.13 --seed /tmp/venv-hermes-prova
/tmp/venv-hermes-prova/bin/pip install -r requirements-hermes-real.txt
/tmp/venv-hermes-prova/bin/pip install 'pytest==9.1.1'
/tmp/venv-hermes-prova/bin/pip check
TMPDIR=/var/tmp PATH=/tmp/venv-hermes-prova/bin:$PATH /tmp/venv-hermes-prova/bin/python -m pytest -q verificacao_real/test_hermes_real.py --basetemp=/var/tmp/helena-pytest-hermes-real --autorizar-hermes-real -ra
```

Se `uv` não estiver disponível na máquina da prova, prepare um venv Python 3.13 por meio suportado antes de seguir. Guarde a saída completa, código de saída, versão instalada de `hermes-agent`, data, commit e cenário que falhou. Não rotule a prova como **PASSOU** por causa do código zero: confira, por serviço, ferramentas exatas (inclusive lista vazia), instruções, ambiente sem segredo, limite do laço de 200 chamadas, modelo da ficha e perfil intacto. Uma falha ou cenário não executado deixa o item **NÃO COMPROVADO**.

## Testes 1 e 2: operação real assistida

Não existe neste repositório um comando que automatize as 20 tarefas ou as 48 horas. Preparar uma planilha de evidências sem tokens, texto sensível ou dados pessoais; para cada tarefa registrar horário, canal habilitado na prova, card, agente, modelo, versão, resultado, tentativas e eventual erro. Não reativar a v1 para cumprir os critérios. O fundador faz **um login da v2** pelo fluxo oficial do Hermes na hora da prova; não copiar token nem usar o login do Codex. Medir:

1. **Cota, 20 tarefas reais no mesmo dia.** O critério original mencionava a v1 ligada e envio do mesmo pedido pelos dois canais. Como a v1 permanece parada, esse critério não está autorizado nem pode ser usado para reativá-la; fica **NÃO COMPROVADO** até revisão e aprovação de um procedimento compatível. Não executar envios duplicados para tentar cumprir a meta.
2. **Login, 48 horas.** O critério original pede pelo menos três tarefas paralelas e duas renovações simultâneas. Como a documentação também descreve execução de um agente por vez, a capacidade de paralelismo precisa ser confirmada antes de adotar esse critério. Não forçar concorrência nem compartilhar credenciais para o teste. Até haver procedimento compatível e 48 horas observadas, resultado NÃO COMPROVADO.

Registrar para cada critério **PASSOU / FALHOU / NÃO COMPROVADO**, apontando a evidência concreta e quem a revisou. Qualquer falha impede avançar a fase. Estes testes ainda não foram realizados.

## Antes do dia de prova: o que já está pronto (e o que NÃO está)

- **Planilha de evidências:** `docs/manual/dia-de-prova-evidencias.csv` (cabeçalho pronto; uma linha por tarefa e por observação de login; sem token nem dado pessoal).
- **Roteiro de instalação do banco v2, para revisão:** `python -m orquestrador gerar-instalacao --saida <pasta nova fora do repositório>` gera `01_instalar_v2.sql`, `02_base_tecnica.sql`, `03_conferir_depois.sql`, `LEIA-ANTES.md` e `manifesto.json`. Nada é executado; só entra no Supabase real com a frase exata do `LEIA-ANTES.md`.
- **Vigia de 5 em 5 minutos e alarmes:** `python -m orquestrador vigiar --saida <arquivo> [--canal-webhook]` (só lê o banco; precisa só de `HELENA_V2_DATABASE_URL`, não do Hermes). O canal em arquivo sempre é usado; `--canal-webhook` acrescenta um webhook HTTPS (URL na variável `HELENA_V2_ALARME_WEBHOOK_URL`, que o fundador preenche; o fornecedor ainda não foi escolhido). A independência do servidor da v2 e o aviso em até 15 minutos (teste 7) **não estão comprovados**: só se provam no dia de prova.
- **Relógio dos prazos:** `python -m orquestrador relogio [--uma-volta] [--intervalo 60]` (precisa só de `HELENA_V2_DATABASE_URL`; é o único comando, além do motor, que grava: aplica o que o BANCO diz que venceu, como papel RELOGIO). O vigia alarma `RELOGIO_ATRASADO` se ele parar. Testado só em banco local; **NÃO COMPROVADO** no Supabase real. Lacunas conhecidas no `HANDOFF-CLAUDE-CODE.md`.
- **Fila com prioridade e vagas:** o comando python -m orquestrador despachar [--vagas 1] [--uma-rodada] escolhe por prioridade o card que o motor avança e segura uma vaga (padrão 1 agente por vez). ATENÇÃO: usa o runtime real e chama o agente de verdade, gastando cota. A autorização histórica está registrada no HANDOFF, mas o roteiro não foi executado e isso não substitui autorização específica para efeitos remotos. Testado somente com executor falso e banco local.
- **Publicação:** o banco (pedido, estados, tela) e o trabalhador com destino FALSO estão prontos e testados; **não existe destino real** e por isso não há comando para publicar: o fundador precisa dizer o que "publicar" significa. O vigia já alarma pedido de publicação parado (`PUBLICACAO_PARADA`).
- **Durabilidade com executor falso** (queda de processo com `kill -9`, reinícios, trocas de versão, dois motores): testes em `motor/orquestrador/testes/test_durabilidade.py`; o resultado atual está no `HANDOFF-CLAUDE-CODE.md`. Com o Hermes real, tudo isso continua **NÃO COMPROVADO**.

**A frase de autorização do dia de prova está registrada historicamente no HANDOFF. O roteiro permanece não executado.** Essa autorização não aprova mudanças no banco, servidor, publicação ou integrações remotas; cada efeito remoto requer autorização própria.
