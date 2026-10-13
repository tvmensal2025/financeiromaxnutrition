# Banco da v2 (só local)

**O banco manda, o motor executa, o agente só escreve conteúdo.** Aqui mora o banco do Sistema Helena v2: uma única função muda o estado do card, e as 13 regras de ferro valem mesmo que um programa erre.

> **NADA disto é aplicado no Supabase real sem a frase exata do fundador.** Os testes usam só um PostgreSQL local (ou o de teste do CI). O Supabase CLI da v1 só olha `supabase/migrations/`; esta pasta é separada de propósito.

## O que tem

| Arquivo | O que é | Quem escreve |
|---|---|---|
| `0001_esquema.sql` | Tabelas: card, etapa, ação externa, histórico, entregas, execuções, mensagens | à mão |
| `0002_passagens_geradas.sql` | A tabela de passagens, os tetos, as guardas em SQL, a impressão digital | **gerado** do YAML, nunca à mão |
| `0003_funcao_unica.sql` | `helena_v2.aplicar_evento` e as poucas funções que a cercam | à mão (mecânica, sem regra) |
| `0004_travas_e_permissoes.sql` | As travas das 13 regras e as permissões | à mão |
| `0005_publicacao.sql` | Pedido diário de publicação, leitura do fundador e resposta durável do executor | à mão |
| `gerar_passagens.py` | Lê `helena-v2/maquina/*.yaml` e escreve o 0002 | à mão |
| `testes/` | Os testes (pytest + psycopg) | à mão |

A fonte das regras é só `helena-v2/maquina/passagens.yaml` (com `vocabulario.yaml`). Nenhuma regra fica escrita em dois lugares: o 0003 não conhece guarda, teto nem passagem; lê tudo das tabelas do 0002.

## Como rodar os testes

```sh
pip install -r requirements.txt     # nesta pasta
python -m pytest                    # sobe o próprio PostgreSQL em /tmp/pg-helena-v2-*, porta 54329, só 127.0.0.1
```

Com a variável `HELENA_V2_TESTE_DATABASE_URL` (é o que o CI usa, com um service container `postgres:16`) o teste usa esse servidor e cria nele um banco descartável. `HELENA_V2_PG_BIN` aponta a pasta `bin` do PostgreSQL, se ele estiver fora do lugar comum. Mais sequências aleatórias: `HELENA_V2_DIF_SEMENTES=30 python -m pytest testes/test_04_diferencial.py`. Com `HELENA_V2_COBERTURA=1 python -m pytest -s` o fim da saída diz quantas linhas da tabela os testes exercitaram e quais faltaram.

## Como regenerar quando o YAML mudar

```sh
python helena-v2/maquina/provar.py            # a prova primeiro
python supabase/migrations-v2/gerar_passagens.py
python -m pytest                              # em supabase/migrations-v2
```

O teste `test_02_gerador.py` falha se o SQL guardado no git for diferente do que o gerador produz hoje. Se o YAML pedir algo que o banco ainda não sabe fazer, o gerador **para** e diz o quê.

## Aplicar à mão num banco local de teste

`psql -v ON_ERROR_STOP=1 -1 -f 0001_esquema.sql` (e depois 0002, 0003, 0004 e 0005, nessa ordem; o `-1` é obrigatório). Antes, os papéis `anon`, `authenticated` e `service_role` e a tabela `public.app_access` precisam existir (no app já existem).

## Como as regras ficam presas

- **Só a função muda o estado.** `UPDATE`, `INSERT`, `DELETE` e `TRUNCATE` diretos são recusados por gatilho e por permissão. `anon` não vê nada; `authenticated` e `service_role` só leem e chamam a função.
- **Cada conta só diz o papel que tem** (`helena_v2.conta_papel`): `authenticated` só age como FUNDADOR quando `auth.uid()` está ativo como `founder` em `public.app_access`; `service_role` = MOTOR, HELENA, AUTOR, REVISOR, RELOGIO, VIGIA.
- **A trava confere o resultado, não a tabela.** CHECK: regras 1, 3, 4, 5, 8, 9, 10, 11. Índice único: 3, 8, 11. Gatilho: 2 (só a metade), 3, 5, 6, 7, 8, 9, 13. Os testes estragam a tabela de propósito e mostram o banco recusando o movimento.
- **Regras 2 e 12 não cabem numa trava** (dependem do tempo e da origem da falha): têm prova e teste. De 2, só "final não volta a andar" tem gatilho.
- **Para o motor:** `aplicar_evento` dispara os automáticos da tabela na mesma transação. O motor que valida o plano por código chama com `p_nao_disparar => '{PLANO_VALIDO}'` e decide ele mesmo. `abrir_chamada_helena` dá a chave de cada chamada da Helena; `select * from helena_v2.vigia()` lista o que está errado (vazio = certo).
- **Publicação:** `sou_fundador()` e `situacao_publicacao()` respondem à pessoa autenticada; `pedir_publicacao()` grava no máximo um pedido por dia de Brasília, sem publicar. O motor usa `registrar_resposta_execucao(numero,jsonb)` e `ler_resposta_execucao(numero)` para guardar a resposta antes da validação. A exposição da API `helena_v2` no app depende da configuração de implantação.
- **A tabela do banco é a que passou na prova:** `select helena_v2.tabela_confere()` recalcula o hash das linhas e compara com o selado; editar uma linha à mão faz dar falso.

## O que ainda não está aqui

Relógio dos prazos e vigia de 5 minutos (o banco só aplica o evento que chegar), fila e vagas (motor), troca de tabela com cards abertos, plano que muda no meio, efeitos de fora das reações (pausar tudo, exemplo de ouro).
