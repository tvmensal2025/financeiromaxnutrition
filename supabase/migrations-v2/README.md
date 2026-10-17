# Banco da v2

**O banco manda, o motor executa, o agente só escreve conteúdo.** Aqui mora o banco do Sistema Helena v2: uma única função muda o estado do card, e as 13 regras de ferro valem mesmo que um programa erre.

> O briefing de 17/10/2026 relata 0001–0019 aplicadas em produção, mas esta sessão não consultou o Supabase real. A 0020 foi preparada e testada somente em PostgreSQL local: **não foi aplicada em produção** (nota de 17/10/2026, fim do dia: `onde-estamos.md` relata 0020–0026 aplicadas pelo fundador/conector; consulta de leitura em 17/10 confirmou a função da 0025 e o esquema ativo, mas confirme o estado atual antes de afirmar). O Supabase CLI da v1 só olha `supabase/migrations/`; esta pasta é separada de propósito.

## O que tem

| Arquivo | O que é | Quem escreve |
|---|---|---|
| `0001_esquema.sql` | Tabelas: card, etapa, ação externa, histórico, entregas, execuções, mensagens | à mão |
| `0002_passagens_geradas.sql` | A tabela de passagens, os tetos, as guardas em SQL, a impressão digital | **gerado** do YAML, nunca à mão |
| `0003_funcao_unica.sql` | `helena_v2.aplicar_evento` e as poucas funções que a cercam | à mão (mecânica, sem regra) |
| `0004_travas_e_permissoes.sql` | As travas das 13 regras e as permissões | à mão |
| `0005_publicacao.sql` | Pedido diário de publicação, leitura do fundador e resposta durável do executor | à mão |
| `0006_configuracoes.sql` | Revisões editáveis de configuração, validação pelo serviço e revisão fixada no card | à mão |
| `0007_pedidos_reais.sql` | Solicitações autenticadas, captura canônica, consumo idempotente e bloqueio de fontes alteradas | à mão |
| `0008_resposta_coordenacao.sql` | Resposta durável da Helena, aplicação e recuperação por histórico | à mão |
| `0009_confirmacao_real.sql` | Prazo, critérios, restrições e URLs confirmados; fontes originais preservadas | à mão |
| `0010_aprovacoes_fontes_reais.sql` | Reconfere fontes nas aprovações efetivas, inclusive reação do card pronto | à mão |
| `0011_lista_acoes_fundador.sql` | RPC de leitura mínima de ações para o fundador, sem SELECT direto no cliente | à mão |
| `0012_reacoes_fundador.sql` | Versão e parâmetros das reações, com replay antes de nova aplicação | à mão |
| `0013_interacoes_fundador.sql` | Consulta do toque do próprio fundador e pergunta atual da etapa | à mão |
| `0014_leitura_card_fundador.sql` | Leitura de volta realmente persistida pela Helena | à mão |
| `0015_card_real_ligado.sql` | Confere a origem autenticada e as fontes de cards ligados | à mão |
| `0016_manutencao_so_servico.sql` | Fecha as portas de manutenção para a sessão do fundador | à mão |
| `0017_relogio.sql` | Lista eventos de prazo devidos para o relógio do motor | à mão |
| `0018_publicacao_execucao.sql` | Estados, reivindicação e registro durável da publicação; destino real ainda ausente | à mão |
| `0019_auditoria_de_ativacoes.sql` | Histórico de ativações e reversão da configuração ativa | à mão |
| `0020_plano_exige_validador.sql` | Impede PLANO_VALIDO automático; o motor deve emiti-lo após validar o plano | à mão |
| `gerar_passagens.py` | Lê `helena-v2/maquina/*.yaml` e escreve o 0002 | à mão |
| `testes/` | Os testes (pytest + psycopg) | à mão |

A fonte das passagens é `helena-v2/maquina/passagens.yaml` (com `vocabulario.yaml`); o 0003 lê guardas, tetos e passagens das tabelas geradas no 0002. A 0020 acrescenta uma trava de execução: embora o YAML histórico liste `PLANO_VALIDO` entre os automáticos, o banco só aceita esse evento como chamada explícita do motor. O banco não executa nem comprova o validador externo por si só.

## Como rodar os testes

```sh
pip install -r requirements.txt     # nesta pasta
python -m pytest                    # sobe o próprio PostgreSQL em /tmp/pg-helena-v2-*, porta 54329, só 127.0.0.1
```

Com a variável `HELENA_V2_TESTE_DATABASE_URL` (é o que o CI usa, com um service container `postgres:16`) o teste usa esse servidor e cria nele um banco descartável. Papéis globais de teste permanecem no servidor compartilhado para evitar corrida entre suítes; o cluster temporário cai inteiro ao fim. `HELENA_V2_PG_BIN` aponta a pasta `bin` do PostgreSQL, se ele estiver fora do lugar comum. Mais sequências aleatórias: `HELENA_V2_DIF_SEMENTES=30 python -m pytest testes/test_04_diferencial.py`. Com `HELENA_V2_COBERTURA=1 python -m pytest -s` o fim da saída diz quantas linhas da tabela os testes exercitaram e quais faltaram. As provas da máquina em `testes/conftest.py` usam a base histórica 0001–0006; os testes de integração em `testes/integral.py` aplicam todas as migrations em ordem, incluindo a 0020.

## Como regenerar quando o YAML mudar

```sh
python helena-v2/maquina/provar.py            # a prova primeiro
python supabase/migrations-v2/gerar_passagens.py
python -m pytest                              # em supabase/migrations-v2
```

O teste `test_02_gerador.py` falha se o SQL guardado no git for diferente do que o gerador produz hoje. Se o YAML pedir algo que o banco ainda não sabe fazer, o gerador **para** e diz o quê.

Depois da 0006, reaplicar a 0004 isoladamente revoga as permissões dos RPCs novos. Nesse caso, publique uma nova migração de `GRANT` que restaure essas permissões; a 0006 usa `CREATE TABLE` e não deve ser reaplicada no banco existente.

## Aplicar à mão num banco local de teste

`psql -v ON_ERROR_STOP=1 -1 -f 0001_esquema.sql` (e depois 0002, 0003, 0004, 0005 e 0006, nessa ordem; o `-1` é obrigatório). Antes, os papéis `anon`, `authenticated` e `service_role` e a tabela `public.app_access` precisam existir (no app já existem).

## Como as regras ficam presas

- **Só a função muda o estado.** `UPDATE`, `INSERT`, `DELETE` e `TRUNCATE` diretos são recusados por gatilho e por permissão. `anon` não vê nada; `authenticated` e `service_role` só leem e chamam a função.
- **Cada conta só diz o papel que tem** (`helena_v2.conta_papel`): `authenticated` só age como FUNDADOR quando `auth.uid()` está ativo como `founder` em `public.app_access`; `service_role` = MOTOR, HELENA, AUTOR, REVISOR, RELOGIO, VIGIA.
- **A trava confere o resultado, não a tabela.** CHECK: regras 1, 3, 4, 5, 8, 9, 10, 11. Índice único: 3, 8, 11. Gatilho: 2 (só a metade), 3, 5, 6, 7, 8, 9, 13. Os testes estragam a tabela de propósito e mostram o banco recusando o movimento.
- **Regras 2 e 12 não cabem numa trava** (dependem do tempo e da origem da falha): têm prova e teste. De 2, só "final não volta a andar" tem gatilho.
- **Para o motor:** `aplicar_evento` dispara os automáticos da tabela na mesma transação. O motor que valida o plano por código chama com `p_nao_disparar => '{PLANO_VALIDO}'` e decide ele mesmo. `abrir_chamada_helena` dá a chave de cada chamada da Helena; `select * from helena_v2.vigia()` lista o que está errado (vazio = certo).
- **Publicação:** `sou_fundador()` e `situacao_publicacao()` respondem à pessoa autenticada; `pedir_publicacao()` grava no máximo um pedido por dia de Brasília, sem publicar. O motor usa `registrar_resposta_execucao(numero,jsonb)` e `ler_resposta_execucao(numero)` para guardar a resposta antes da validação. A exposição da API `helena_v2` no app depende da configuração de implantação.
- **Configurações:** o fundador salva rascunhos com versão otimista, pede validação e ativa uma revisão validada por comparação atômica. O serviço interno atesta o bundle real e a máquina instalada; a LLM não valida. Revisões validadas e o vínculo `ordem_de_servico.config_revision_id` são imutáveis, inclusive após aposentadoria. O bootstrap técnico é explícito, feito por `service_role`, e não ativa uma revisão. A configuração não troca a máquina global: isso exige migração e prova.
- **Limite do legado:** antes de registrar a configuração técnica, o banco aceita cards sem `config_revision_id` para preservar a operação antiga. Após esse registro, card raiz novo exige revisão ativa, ou ID técnico explícito pelo motor enquanto não há ativa; card filho herda a revisão do pai. O motor normal recusa criar card sem revisão ativa.
- **A tabela do banco é a que passou na prova:** `select helena_v2.tabela_confere()` recalcula o hash das linhas e compara com o selado; editar uma linha à mão faz dar falso.

## O que ainda não está aqui

Fila e vagas (motor), troca de tabela com cards abertos, plano que muda no meio e efeitos de fora das reações (pausar tudo, exemplo de ouro). O relógio da 0017 lista os eventos devidos, mas o motor ainda os aplica um por um.

## Pedidos reais — migration 0007

Aplicar `0007_pedidos_reais.sql` depois de 0001–0006. O fundador autenticado registra a solicitação; o worker lê e consome de forma idempotente. A criação antiga de card deixa de ser RPC pública do worker. Fontes canônicas são comparadas na solicitação, consumo e promoção; alterações recusam aprovação ou PRONTO, preservando cancelamento. Não reaplicar migrations anteriores isoladamente para restaurar grants.

Antes de qualquer aplicação futura, conferir privilégios do dono das funções SECURITY DEFINER sobre as fontes públicas (leitura e locks), RLS, papéis dedicados, exposição da API e backup/retorno. Testes locais não comprovam esses privilégios em produção. A 0020 ainda exige autorização do fundador antes de aplicação remota.

`service_role` é uma identidade privilegiada de backend; sua credencial pertence apenas ao worker, nunca ao cliente. Ela não representa a autorização do fundador: a solicitação exige sua sessão autenticada. O modelo não protege de um worker comprometido que consiga alterar as próprias fontes; verificar grants efetivos na instalação.

## Sequência atual e confirmação

Numa instalação nova, aplicar 0001–0020 em ordem. Para um banco que já tenha 0001–0019, revisar e aplicar apenas a 0020 depois de aprovação explícita; não reaplicar migrations históricas. A 0009 resolve a revisão ativa quando o fundador não fornece ID, confere prazo futuro na criação e preserva o replay de solicitações já gravadas. Cards reais antigos sem confirmação completa não avançam; histórico permanece e um novo pedido autenticado deve substituir a entrada incompleta. O instante do prazo é preservado com fuso explícito; a interface o apresenta em Brasília.

A interface importa a captura privada gerada pelo CLI, mostra metadados e envia as escolhas pela sessão do fundador. Ela consulta solicitações próprias por RLS para reconciliar falhas. A mesma carga usa chave determinística entre abas; confirmações diferentes não têm unicidade global por tarefa. URLs confirmadas continuam sendo dados não confiáveis, e a ferramenta revalida resolução, IP e redirecionamento a cada leitura.

A autorização de ação externa na 0010 não habilita o efeito externo. Antes de implementar X10/EXECUTAR_ACAO, conferir fontes novamente no despacho e imediatamente antes do efeito, com idempotência e prova de cancelamento.

Cards ligados são conferidos até a solicitação autenticada de origem, com limite de 16 ancestrais e recusa de ciclos. Ao atingir esse limite, é necessário tratar explicitamente a continuidade ou criar novo pedido autenticado; não remover a guarda.

## Validação explícita do plano — migration 0020

Antes da 0020, `RESPONDER/CONFIRMO` do fundador podia levar o card a `VALIDANDO_PLANO` e o automático `PLANO_VALIDO` levá-lo imediatamente a `EM_ANDAMENTO`, sem passar pelo `validar_plano` do motor. A 0020 bloqueia só essa escolha automática. O card permanece em `VALIDANDO_PLANO` até o motor emitir `PLANO_VALIDO` ou `PLANO_INVALIDO` explicitamente após validar o plano. Os demais automáticos continuam funcionando. A migration não verifica retrospectivamente cards que já avançaram e não prova que o motor executou o validador; esses pontos exigem conferência separada antes de operar cards afetados.

## Recebimento de pedidos — migration 0021

Cria `pedido_entrada` e eventos imutáveis, separados dos cards executáveis. As RPCs `receber_pedido_entrada`, `ler_pedido_entrada` e `listar_pedidos_entrada` exigem a sessão autenticada do fundador; tabelas e helper não recebem acesso direto dos papéis da API. RLS também isola os pedidos. A mesma chave de origem/evento com o mesmo texto e `request_id` retorna o pedido existente; qualquer divergência falha. Um evento novo com o mesmo `request_id` é continuação explícita, preservando as mensagens anteriores.

Texto limitado a 10.000 caracteres, chave do evento a 160 e lista a 100 pedidos (padrão 50). O site consulta pedidos mais antigos por `request_id`. Origem informada pelo cliente não comprova pareamento de Telegram/Codex. Esta migration não atribui empresa, não cria proposta de IA, não confirma plano, não agenda trabalho e não toca na v1. Foi testada apenas em PostgreSQL 16 descartável; não aplicada em produção nesta sessão.
