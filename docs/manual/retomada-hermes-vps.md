# Retomada do Hermes e da Helena v2 na VPS

Atualizado em 17/10/2026. Este roteiro prepara uma próxima sessão com acesso legítimo ao terminal da VPS. Nesta sessão não houve SSH, VPN, console da VPS, deploy de Edge Function, configuração de webhook ou chamada à Bot API. Os caminhos `/usr/local/lib/hermes-agent`, `/root/.hermes` e `/opt/helena-v2` vêm dos instaladores e relatos anteriores; sua existência e seu estado **não foram conferidos na VPS atual**.

O código da nova esteira está na branch `codex/helena-v2-kanban-triagem-20261017`, commit `2ea5286`, e as migrations 0020–0026 foram aplicadas no Supabase oficial. Os smokes de 0024–0026 passaram com `ROLLBACK`. A última consulta ao projeto mostrou nenhuma Edge Function implantada e nenhum dos novos segredos do transporte configurado. O acesso ao Supabase desta sessão não fornece acesso à VPS nem uma sessão de fundador para ingressar pedidos como `CODEX`.

## Revisão da preparação após recuperar as páginas

Na retomada de 17/10, o Git confirmou a recuperação das páginas no commit `1597066` da mesma branch; `main` ainda estava em `79174de`. O PR #18 é ancestral dessa recuperação e mesclá-lo sozinho não inclui o trabalho posterior. A branch atual precisa de revisão/integração própria. Não foi identificado no checkout um projeto Lovable ou um workflow de publicação web; merge e publicação do site são operações distintas.

A revisão seguinte corrigiu dois problemas antes da implantação: o preparador da VPS passou a comparar **todas** as migrations anteriores e exigir a sequência 0001–0026, e a Edge passou a contar caracteres Unicode como o SQL/Python, evitando rejeitar respostas válidas com emojis. Passaram dez testes de preparação com bundles sintéticos e oito testes do transporte Telegram, incluindo o limite de 4.096 caracteres e a rejeição de 4.097. Esses testes não acessam a VPS nem o Telegram real.

O ambiente cloud atual não tem binding do `SUPABASE_ACCESS_TOKEN`, identidade de VPS ou acesso de controle às abas do navegador do fundador. Os domínios administrativos estão salvos no rascunho de configuração, mas ainda não aplicados ao runtime. A última leitura do banco continua sendo a evidência datada anterior; esta revisão não aplicou SQL nem publicou Edge, site ou serviços. Antes de retomar, conferir novamente a configuração aplicada, confirmar o projeto oficial e começar pelo checkpoint vigente em transação somente leitura.

A CLI instalada pode ser executada neste ambiente com `SUPABASE_HOME=/workspace/.cache/helena-supabase-cli`, sem alterar `HOME`. O comando de ajuda de `functions deploy` foi validado com essa opção e telemetria/notificação de atualização desativadas. Isso resolve apenas o diretório local de estado; não fornece credencial, rede ou permissão de implantação. Nunca usar `--prune` para implantar uma única função.

## Mensagem para o Hermes no terminal da VPS

> Faça **somente inventário, sem alterar nada**. Não reinicie serviços, não instale pacotes, não faça `git pull`, não consulte `.env`, `auth.json`, logs, `/proc` ou valores de variáveis, e não chame `getUpdates`, `setWebhook` nem envie mensagens. Execute o inventário local abaixo se o arquivo já estiver no checkout da VPS; se não estiver, informe “arquivo ausente” e pare. Compartilhe apenas a saída do inventário e o SHA do checkout que ele imprimir. Não inclua tokens, URLs de banco, códigos de pareamento, identificadores de chat ou dados de usuários.

```sh
if test -f /opt/helena-v2/repo/motor/hermes-vps/inventario.sh; then
  bash /opt/helena-v2/repo/motor/hermes-vps/inventario.sh
else
  printf '%s\n' 'NÃO CONFIRMADO: inventario.sh ausente no checkout da VPS'
fi
```

O [inventario.sh](../../motor/hermes-vps/inventario.sh) consulta apenas metadados limitados de systemd, Docker, diretórios, Git e versões. Não abre arquivos de credenciais, logs nem processos e não acessa a rede. Ausência do script ou resultado “NÃO CONFIRMADO” não autoriza improvisar comandos que revelem segredos. Confirme por canal confiável a identidade da VPS antes de interpretar a saída.

## O que o resultado precisa decidir

1. **Instalações e serviços reais:** identificar qual Hermes atende o Telegram, qual é o motor v2 e se há outro Hermes no EasyPanel; conferir versões, estado dos serviços, checkout e alterações locais. Não inferir da documentação que o poller atual está ativo ou que o motor executa o commit novo.
2. **Corte do Telegram:** a Edge [helena-v2-telegram](../../supabase/functions/helena-v2-telegram/index.ts) já implementa webhook, inbox e outbox; [config.toml](../../supabase/config.toml) define `verify_jwt=false` para a função, pois Telegram não envia JWT Supabase. Antes de publicar, confirmar projeto, esquema `helena_v2` exposto à API, função ausente/presente, credenciais necessárias e rota HTTP. O webhook só pode apontar para a Edge depois de parar o poller anterior, preservar estado/offset e planejar rollback. Na configuração do Telegram usar um único webhook e `drop_pending_updates=false`.
3. **Adapter do Hermes:** o patch de Hermes 0.15.1 verifica o commit oficial `e71a2bd11b733f3be7cf99deafde0066c343d462` e hashes de fonte. [instalar-local.sh](../../motor/hermes-vps/telegram-v2/instalar-local.sh) limita `--apply` a cópias sob `/tmp` ou `/workspace`; **não é instalador de produção**. Se a fonte ou serviço da VPS divergir, parar e revisar. O próximo artefato técnico é um pacote de cutover para a instalação real, com preflight de pin/hashes, cópia de segurança, troca atômica, conferência de startup e retorno à versão anterior. Preservar `HERMES_HOME`, autenticação e sessões de conversa. O processo inbox não pode receber `TELEGRAM_BOT_TOKEN`; o token fica somente na Edge.
4. **Motor separado:** [atualizar-v2.sh](../../motor/hermes-vps/atualizar-v2.sh) valida e prepara um release em staging, mas não o ativa. O antigo `instalar-motor.sh tudo` pode recriar venvs e seu `HELENA_REF` padrão agora é `main` (antes era um ramo de trabalho), que não fixa commit; não usá-lo como atualização automática. O atalho no mesmo lugar, em etapas isoladas e com SHA fixo, está em [vps-atualizar-e-corrigir-login.md](vps-atualizar-e-corrigir-login.md). Conferir revisão de configuração ativa, migrações DBOS, execução em andamento, estado do `helena-despachante` e login do Hermes 0.19.0 antes de planejar a troca do motor. O inventário é somente leitura; não retomar ou despachar jobs nessa etapa.

## Configuração exigida para uma futura prova

| Componente | Nomes e limite |
|---|---|
| Edge | `HELENA_V2_TELEGRAM_WEBHOOK_SECRET`, `HELENA_V2_TELEGRAM_WORKER_SECRET` distintos, `HELENA_V2_TELEGRAM_BOT_TOKEN`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. `HELENA_V2_TELEGRAM_MODE` ausente ou `webhook`. Bot token, service role e segredo de ingresso ficam só aqui. |
| Hermes Telegram 0.15.1 | `HELENA_V2_TELEGRAM_MODE=inbox-worker`, `HELENA_V2_TELEGRAM_BROKER_URL` no endpoint fixo da Edge e a mesma `HELENA_V2_TELEGRAM_WORKER_SECRET`. `TELEGRAM_BOT_TOKEN` ausente do ambiente e da configuração do processo. A capability do worker pode ser lida por ferramentas do mesmo UID; ela só permite reivindicar/concluir jobs existentes e drenar saída, sem criar identidade ou destinatário. |
| Motor v2 0.19.0 | `HELENA_V2_DATABASE_URL`, `HELENA_V2_DBOS_SYSTEM_DATABASE_URL`, `HELENA_V2_HERMES_BIN`, `HELENA_V2_HERMES_HOME`, `HELENA_V2_EXECUCOES_DIR`, CA/TLS e revisão validada ativa. Sua instalação, conta e login são distintos do Hermes Telegram. |

Não colocar valores dessas variáveis em Git, chat ou saída de inventário. A publicação da Edge, o fornecimento seguro dos segredos e a implantação na VPS ainda precisam de acesso operacional próprio; a ausência desse acesso é um pré-requisito técnico, não uma autorização para contornar a rede.

## Prova de ida e volta depois da instalação

Conferir primeiro a Edge com cabeçalho inválido recusado, inbox sem dados novos e worker sem job; em seguida confirmar que o serviço Hermes usa o adapter novo sem poller paralelo e que `/drain` roda também quando o chat está quieto. Com o site autenticado do fundador, gerar um código temporário e parear um chat privado por `/vincular`. Enviar um `/pedido` delimitado e verificar um único item de inbox, recibo e protocolo, proposta de triagem, aviso da 0026, confirmação pelo fundador, consumo pelo motor e aviso de card. Testar também uma mensagem comum: ela deve seguir a conversa e a sessão originais do Hermes, sem virar pedido. Acompanhar replay, falha/retry de saída e revogação antes de declarar operação.

Mídia e callback são persistidos, mas o adapter não interpreta anexos nem executa aprovação por callback. Se o uso atual depende de anexos, completar e testar o relay server-side antes do corte. Um envio aceito pelo Telegram cujo comprovante se perde pode ser repetido; a outbox garante retomada, não entrega exatamente uma vez. Um teste local até card `PRONTO` e os avisos sintéticos não comprovam entrega real nem removem o bloqueio de Parecer/FON-LEIS para serviços que exigem essa fonte.

O mapa operacional da IA entra no pacote de **triagem do motor 0.19.0** quando um `/pedido` vira entrada. A conversa Telegram comum usa o dispatcher e a sessão do **Hermes 0.15.1**; ela não recebe automaticamente esse mapa nem uma consulta nova ao Supabase. Para orientar respostas comuns sobre tarefas, a próxima etapa é inventariar na VPS quais ferramentas de contexto já existem e só então ligar uma consulta autenticada ao contexto vigente antes de responder. Não presumir que o Hermes conhece toda a operação por ter conversas salvas, nem reconstruir as 27 partes do sistema por inferência.

## Entrada por Codex

A migration 0021 aceita `origem='CODEX'` como rótulo de canal, mas `receber_pedido_entrada` exige `auth.uid()` de um fundador autenticado e ativo. Um PAT de gestão do Supabase ou uma `service_role` não representa esse usuário e não deve ser usado para se passar por ele. Nesta sessão Codex não possui um worker permanente nem uma sessão Auth de fundador para ingressar automaticamente um pedido. O caminho viável hoje é registrar o texto pela interface autenticada do site; uma entrada direta por Codex exigiria uma delegação de usuário verificável, com escopo, expiração e recibo, implementada e testada separadamente.
