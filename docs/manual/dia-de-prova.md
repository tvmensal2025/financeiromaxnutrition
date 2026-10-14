# Dia de prova da v2 — roteiro ainda não executado

**Portão:** este roteiro só pode começar depois da frase exata de autorização do fundador para a fase 2. Antes dela, não executar Hermes real, login do ChatGPT, migração no Supabase real ou operação no EasyPanel, Hostinger ou Evolution API. A prova ocorre com a v1 funcionando ao lado, após os portões anteriores do plano.

## Preparação e teste 3: Hermes travado

O arquivo `motor/executor/verificacao_real/test_hermes_real.py` usa `ExecutorHermes` e os mesmos cenários de `testes/cenarios.py`, com servidor falso local no lugar da OpenAI. O portão `--autorizar-hermes-real` impede execução acidental; **é só uma confirmação operacional, não substitui a frase do fundador**. O pacote Hermes 0.19.0 fica em venv separado do DBOS.

Após autorização, na raiz deste checkout:

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

Não existe neste repositório um comando que automatize as 20 tarefas ou as 48 horas. Preparar uma planilha de evidências sem tokens, texto sensível ou dados pessoais; para cada tarefa registrar horário, origem (WhatsApp ou tela), card, agente, modelo, versão, resultado, tentativas, cota da v1 e da v2 separadas e eventual erro. O fundador faz **um login da v2** pelo fluxo oficial do Hermes na hora da prova; não copiar token nem usar o login do Codex. Medir:

1. **Cota, 20 tarefas reais no mesmo dia, com a v1 ligada.** Enviar também o mesmo pedido pelos dois canais. Demonstrar que a meta inteira consumiu até metade do limite, sem erro de cota, e que cada mensagem foi trabalhada por apenas um sistema. Sem medição separada das cotas, resultado **NÃO COMPROVADO**.
2. **Login, 48 horas com pelo menos três tarefas paralelas.** Forçar e observar ao menos duas renovações simultâneas entre processos; conferir os registros do login sem publicar seus valores, ausência de token nas pastas de tarefa e nenhum login derrubado. Sem duas renovações observadas ou 48 horas completas, resultado **NÃO COMPROVADO**.

Registrar para cada critério **PASSOU / FALHOU / NÃO COMPROVADO**, apontando a evidência concreta e quem a revisou. Qualquer falha impede avançar a fase. Estes testes ainda não foram realizados.

## Antes do dia de prova: o que já está pronto (e o que NÃO está)

- **Planilha de evidências:** `docs/manual/dia-de-prova-evidencias.csv` (cabeçalho pronto; uma linha por tarefa e por observação de login; sem token nem dado pessoal).
- **Roteiro de instalação do banco v2, para revisão:** `python -m orquestrador gerar-instalacao --saida <pasta nova fora do repositório>` gera `01_instalar_v2.sql`, `02_base_tecnica.sql`, `03_conferir_depois.sql`, `LEIA-ANTES.md` e `manifesto.json`. Nada é executado; só entra no Supabase real com a frase exata do `LEIA-ANTES.md`.
- **Vigia de 5 em 5 minutos e alarmes:** `python -m orquestrador vigiar --saida <arquivo>` (só lê o banco). O canal em arquivo é o mínimo; um canal realmente independente do servidor (teste 7) **não existe ainda** e só se prova com a frase do dia de prova.
- **Durabilidade com executor falso** (queda de processo com `kill -9`, reinícios, trocas de versão, dois motores): testes em `motor/orquestrador/testes/test_durabilidade.py`; o resultado atual está no `HANDOFF-CLAUDE-CODE.md`. Com o Hermes real, tudo isso continua **NÃO COMPROVADO**.

**Frase exata proposta ao fundador: “AUTORIZO O DIA DE PROVA DA V2 COM HERMES REAL E CHATGPT”. Até recebê-la, este roteiro permanece parado.**
