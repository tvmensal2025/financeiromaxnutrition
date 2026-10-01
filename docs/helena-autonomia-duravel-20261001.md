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

A sessão `20261001_135955_fe29bd` terminou sem liberar o job e registrou NEEDS_ATTENTION, sem repetir IA. Impedimentos relatados: destino de CTA ausente; preflight visual não incluído; instrução genérica exigia expected_task_version até para ferramentas que não aceitam esse campo.

Correções seguintes: o prompt exige versão nas transições cujo esquema realmente a prevê; a coordenação recebe agora preflight gratuito do executor, validando vínculo, identidade e empresa antes de usar seu token. READY não equivale a aprovação criativa. Maya retornou READY em 14:08:07 UTC; Nina também READY; cinco testes do renderizador instalado passaram no Linux, sem chamadas pagas.

O fundador respondeu explicitamente: **“Somente revisão interna; sem link ou publicação”**. Aplicado `scripts/clarify-private-review-20261001.sql`, uma transação operacional de escopo único, sem mudança de schema: guarda status DRAFT, tentativa 0, timestamp e versão 3655; preserva briefing anterior no evento FOUNDER_SCOPE_CLARIFIED; inclui autorização de revisão privada e evidências técnicas; nova versão da tarefa 3658. Não libera, não aprova, não zera tentativas nem apaga recibos. A nova versão documenta informação material nova, não uma repetição da tentativa anterior.

Suíte final desta atualização: 150 casos Python, 149 passaram no Windows; o caso POSIX excluído no Windows passou no Linux, junto aos outros quatro testes visuais. Comprovante da decisão no banco: `artifacts/continuity-20261001/decisao-revisao-interna.png`.

## Retomada confirmada — 01/10/2026, 11:16 de Brasília

Depois da decisão, Helena gravou WORKFLOW_release_job às 14:14:07 UTC; o despachante assumiu às 14:15:18 UTC e iniciou Maya às 14:15:19 UTC. Estado observado RUNNING, tentativa 1/2, tarefa versão 3660. Às 14:16:03 UTC Maya registrou que conferiu manifesto, runtime READY e abriu os pixels do logo oficial. Nenhuma arte final ainda estava registrada nesse instante. A liberação e o início foram automáticos pelo fluxo; o operador não chamou release_job nem start_job manualmente. Revisão da Nina e aprovação final ainda precisam de comprovação.

## Produção e devolução comprovadas — 01/10/2026

Maya gerou os quatro PNGs v1, abriu seus pixels e submeteu o pacote às 14:22:54 UTC. Nina foi acionada automaticamente, abriu as quatro imagens entre 14:24:26 e 14:24:33 UTC e registrou REQUEST_CHANGES às 14:25:10 UTC. Apontamentos: placa clara no logo, CTA com aparência de botão, repetição narrativa no Story 3 e impossibilidade de comparar o logo oficial usando a referência fornecida. O pacote voltou ao mesmo job DRAFT, tentativa 1/2, versão 3666. Isso comprova produção → revisão → devolução, mas ainda não comprova aprovação final.

Diagnóstico confirmado nos argumentos da sessão Nina `20261001_142348_137e77`: foi passada a URL storage do logo em vez do alias literal `brand-logo`. A coordenação Helena seguinte conseguiu abrir esse alias, porém foi interrompida por timeout de 240 segundos (exit 124), sem escrita confirmada. O recibo ficou NEEDS_ATTENTION e não houve repetição paga automática.

Correção instalada: prazo de coordenação/revisão 480 segundos, abaixo da lease canônica de 600; orientação explícita do alias do logo e correção de uma chamada malformada; uma ferramenta local por tool_call. Backup `pipeline-backup-20261001T143315349807Z`, um arquivo alterado, zero modelos iniciados pelo instalador. Suíte Python: 152 casos, 151 passaram no Windows e um teste POSIX previamente validado no Linux permanece excluído no Windows. Novos testes verificam prazo efetivo e encerramento do processo com resultado incerto ao excedê-lo.

A página local foi restabelecida em 127.0.0.1:8080 e os quatro arquivos R2 foram visualizados no modal de produção. Evidência: `artifacts/continuity-20261001/revisao-quatro-artes.png`. A devolução permanece interna, fora da caixa de materiais finais aprovados.

Às 14:40:36 UTC, o operador aplicou `revise_task_brief` pela autorização da Helena, com guardas de versão 3666, timestamp da revisão e tentativa 1/2. Retorno confirmado: success=true, DRAFT, versão 3669, sem início/liberação manual. A revisão preserva copy literal e v1; exige arquivos v2, logo integrado sem placa, CTA editorial sem botão e conclusão narrativa focada nas ressalvas. Às 14:43:45 UTC, Helena realizou `WORKFLOW_release_job` automaticamente. Estado seguinte confirmado READY, ainda tentativa 1/2. Essa retomada comprova devolução → briefing corrigido → liberação pela coordenação; produção v2 e aprovação independente ainda estavam pendentes nesse instante.
