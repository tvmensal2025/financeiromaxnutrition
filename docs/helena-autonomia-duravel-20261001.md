# Continuidade e aprendizado verificável — 01/10/2026

Implementação autorizada pelo fundador. O estado atual do Supabase continua sendo a fonte operacional.

## Comportamento instalado

O consumidor encontra DRAFT, revisão pendente, bloqueio resolvível e próxima etapa depois de aprovação. Descoberta paginada não depende de IDs inseridos manualmente no arquivo local. Jobs pessoais não entram na fila empresarial. Etapa FINAL aprovada encerra o fluxo.

Antes da chamada ao modelo, `workflow_checkpoint` reserva a fase no Supabase com job, versão da tarefa, status, atualização e impressão digital. O recibo tem chave única. O cache local pode ser reconstruído. STARTED ou NEEDS_ATTENTION sem efeito comprovado não permite repetir a mesma chamada paga. Uma lease expirada libera capacidade, mas não apaga a deduplicação. A conclusão exige mudança comprovada no banco.

O banco impede execução simultânea com a revisão/coordenação reservada. A trava usa tentativa imediata para evitar espera circular entre transições concorrentes. WIP global 1 e até duas tentativas do executor permanecem vigentes. Se não existir reserva confirmada, não há chamada ao modelo.

## Liberdade dos agentes e aprendizado

Cada agente pode corrigir formato, parâmetros, referências e composição dentro da tarefa autorizada. Deve medir/conferir a correção e preservar a chave do comando quando a operação for a mesma. Não pode aumentar permissões, limite, gasto, escopo ou aprovar o próprio material.

Durante seu job ativo, registra causa, correção, teste/evidência, empresa, job, versão e limite de aplicação por `record_memory`. Hipótese permanece hipótese. Para reaproveitamento automático, o registro começa com `VALIDADA NO ESCOPO`, seu ID é vinculado às evidências da entrega e essa entrega passa por revisão independente. O contexto devolve no máximo cinco registros aprovados do mesmo agente/empresa; a coordenação mantém sua supervisão existente. O pacote entregue ao modelo filtra novamente a empresa. Registros são dados a conferir, nunca autorização para substituir regras.

A política canônica está em `public.agent_workflow_policies`, chave `bounded-autonomy`, versão `20261001-v1`. A orientação completa dos perfis é `APRENDIZADO_VALIDADO_V2`. Nenhuma alteração automática no código, SOUL, credenciais ou permissões é habilitada aos agentes.

## Validação

293 testes Node passaram depois da integração com main; testes HTTP/integração adicionais passaram. Python: 142 casos, um teste de bloqueio POSIX não executado no Windows. Teste transacional no Supabase: escopo, descoberta DRAFT, versão antiga, reserva duplicada, sucesso sem efeito e produtor concorrente. A transação de teste foi revertida. O leitor de recibos recebeu correção adicional após a chamada real revelar conflito de alias SQL; o teste inclui essa leitura agora.

Gateway publicado pelo EasyPanel a partir de `7ac91ef`, com sucesso confirmado no log em 01/10/2026 13:29:28 UTC. Instalação inicial: 21 perfis, 25 arquivos alterados, zero chamadas de modelo; backup `/data/helena-runtime/pipeline-backup-20261001T132956993501Z`. Tarefa existente `JOB-HR-fd62fc9a1659086444127a218432d958` encontrada em COORDINATE; launcher, MCP e uso retornaram READY sem IA.

## Limites

Regras instaladas nos 21 perfis não equivalem a 21 campanhas homologadas. Este mecanismo evita repetição da fase registrada, mas não garante disponibilidade contínua do provedor, do servidor ou do banco. Resultados incertos aguardam reconciliação. Pendências comerciais e ampliação de escopo continuam reservadas ao fundador. O destino do CTA da campanha Humano Digital ainda não está confirmado; produção privada não autoriza publicar.

O agendamento precisa estar ativo no Hermes e seu serviço deve subir depois de reiniciar o servidor. Conferir recibo remoto e `hermes cron list` para a frequência efetivamente instalada; não inferir ativação apenas deste documento. Recibos locais antigos não são convertidos em chamadas pagas novas para reconstruir histórico.

## Verificação operacional adicional — 01/10/2026, 14:00 UTC

Confirmado `helena-gateway-poll` ativo, `every 2m`, modo `no-agent`, script existente. Os 21 SOULs contêm APRENDIZADO_VALIDADO_V2. A verificação da fila não usa modelo; apenas uma etapa elegível e reservada pode iniciar inferência.

Três problemas reais foram reproduzidos e corrigidos no runtime:

- O launcher retornava RUNTIME_SYNTAX no ambiente agendado, enquanto o launcher explícito da instalação virtual retornava READY. O poll agora fixa o executável Hermes e o Python já verificados, em vez de depender do PATH do processo cron. Backup da troca: `/data/helena-runtime/pipeline-backup-20261001T135401509805Z`.
- Uma pendência local HANDOFF apontava para `JOB-HR-4c1ad7a12227adf8c2ab535120692df5`, embora o evento canônico já ligasse esse job ao sucessor `JOB-HR-fd62fc9a1659086444127a218432d958`. A seleção reconcilia esse evento e continua pelo filho sem repetir inferência. Entrega FINAL também não pode ser reencaminhada por pendência local antiga. Backup: `/data/helena-runtime/pipeline-backup-20261001T135541053488Z`.
- A mesma memória aparecia em evidence_records, input_evidence_records e source_evidence_records. Os campos comuns eram idênticos; somente input_evidence_records acrescentava approved_output. O pacote agora une campos complementares sem truncamento e continua recusando qualquer divergência de valor nos campos comuns, inclusive versão, conteúdo e empresa. O pacote real passou com 38.074 caracteres.

Suíte após as correções: 148 casos Python, 147 passaram no Windows e um teste POSIX ficou reservado ao Linux. Esse teste foi executado separadamente no Hermes Linux e passou (geração única e reaproveitamento do PNG na repetição do envio, com provedor simulado e zero geração paga no teste).

Às 13:59:52 UTC o agendador iniciou COORDINATE do sucessor existente e registrou STARTED no diário canônico antes da inferência. Uma invocação concorrente foi recusada com ALREADY_RUNNING. Esse recibo comprova início e exclusão mútua, não comprova entrega final.
