# Controle de concorrência entre conversas da Helena

Implantação no Supabase canônico em 26/09/2026, horário de São Paulo. A migração foi aplicada. As alterações do painel estão no código local; publicação remota não realizada neste trabalho.

## Comportamento

Duas conversas podem ler a mesma tarefa. A primeira salva com a versão que leu. A outra, tentando usar essa versão antiga, recebe conflito: o banco conserva a primeira gravação. O formulário mantém o rascunho em tela. É preciso comparar o registro atual com a intenção antes de preparar uma nova alteração; não há tentativa automática com uma versão mais recente.

A verificação não usa IA nem monitoramento recorrente. O banco faz uma comparação de versão e bloqueia somente a linha durante a gravação. Leituras e trabalho em outros registros continuam possíveis.

## Contrato técnico

- As 54 tabelas retornadas por `public.helena_concurrency_tables()` possuem `row_version`.
- Atualizar/excluir usa `public.helena_write_record(p_table, p_id, p_expected_version, p_changes, p_delete)`, enviando a versão da leitura original e somente as mudanças pretendidas. As permissões e RLS continuam valendo.
- O banco recusa UPDATE/DELETE direto ou upsert que tente substituir um registro existente. INSERT continua disponível com as permissões existentes. Chaves duplicadas falham; não tratar a falha como autorização para sobrescrever.
- Conflito retorna `40001`; conservar o rascunho, reler, comparar e resolver. Nunca renovar a versão e repetir silenciosamente.
- A sequência global de revisões evita reutilizar a versão de uma linha excluída, mesmo se alguém recriar o mesmo identificador.
- Tarefas e CRM projetam calendário na mesma transação. Uma falha desfaz a gravação da origem e do evento.
- Auditoria, histórico das tarefas e eventos de jobs aceitam novos registros; atualização/exclusão do histórico são recusadas.
- `helena_publish_checkpoint` exige o identificador do checkpoint ativo que serviu de base ao novo snapshot. Dois publicadores com o mesmo predecessor não geram duas versões concorrentes válidas.
- Apenas um checkpoint pode estar ATIVO e apenas um foco pode estar EM EXECUÇÃO.

A publicação de um checkpoint exige leitura consistente das fontes. A comparação do predecessor não detecta, sozinha, toda mudança posterior em tabelas operacionais. Ler o checkpoint nunca publica nova versão.

## Escopo e limites

A proteção de versão cobre os cadastros de domínio, incluindo tarefas, CRM, empresas, decisões, memória, agentes, regras, integrações e planejamento. As filas de execução, autenticação/acessos técnicos, conexões, perfis de voz, chamadas e outbox conservam seus protocolos específicos. Não afirmar que todos os caminhos técnicos receberam controle de versão.

O banco impede a gravação desatualizada pelos caminhos normais. Um operador com privilégio para alterar a estrutura pode desativar triggers; não há proteção contra administração deliberada do próprio banco. A regra também não garante que um chat consulte o Supabase antes de responder ou execute somente intenções autorizadas.

Bots e integrações externos precisam adotar a RPC ao editar tabelas protegidas. Escritores antigos serão recusados, não migrados silenciosamente. O funcionamento de cada bot externo e de duas conversas reais no ChatGPT ainda precisa ser homologado com acesso autorizado.

A agenda local do Codex permanece pausada. A agenda do ChatGPT permanece não configurada. Nenhuma chamada de IA paga, envio de mensagem ou rotina periódica foi criada para esta proteção.

## Evidências

- Frontend: 123 testes passaram, incluindo rascunho preservado no conflito e edição após concluir.
- Banco: 20 controles transacionais passaram, com rollback dos exemplos. Incluem versão antiga, exclusão, escrita direta, calendário, reaproveitamento de identificador, checkpoint e três históricos imutáveis.
- Acesso: três verificações em transações revertidas confirmaram edição na própria empresa e bloqueio de outra empresa e configuração global.
- Duas sessões diferentes do banco usaram a mesma versão: a primeira gravou e a segunda foi recusada. As chamadas não se sobrepuseram; isso não equivale a um ensaio de carga simultânea nem a duas conversas reais.
- Inventário físico: 70 fontes e 1.543 colunas mapeadas após acrescentar 54 versões. Inventário completo não significa homologação de toda a operação externa.
- Build e checagem TypeScript passaram. A sala de comando local foi recarregada e exibiu a empresa autorizada, sem o aviso transitório de cadastro indisponível.
- Continuidade validada no checkpoint CP-20260926-V012: 20 projeções, 68 contagens de tabelas, regras, memória, cadeia histórica e foco; nenhuma divergência nesse escopo. A validação passou tanto pelo operador SQL quanto pelo acesso autenticado de fundador.

## Continuidade e manutenção

A regra é PAG-V9-020 e a evidência canônica é MEM-CONCORRENCIA-20260926. O checkpoint ativo deve ser carregado pela view, sem fixar uma versão no comando de retomada.

A migração está em `supabase/migrations/20260927003507_helena_optimistic_concurrency.sql`. O ensaio reversível está em `scripts/testar-concorrencia.sql`; a reconciliação desta implantação está em `scripts/sincronizar-concorrencia-continuidade.sql` e a validação somente leitura em `scripts/validar-checkpoint-continuidade.sql`.

Scripts antigos de sincronização registram migrações históricas. Não reexecutar seus UPDATEs ou chamadas diretas a `registrar_checkpoint_mestre`: o banco agora os recusa. Novas alterações usam a versão realmente lida e o novo publicador.
