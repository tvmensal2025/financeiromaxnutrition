# Telegram v2: inbox Edge e adapter Hermes 0.15.1

Este pacote é preparação local, **desativada**. Nenhum arquivo registra webhook,
inicia poller, reinicia Hermes ou envia mensagem real. O helper antigo
`helena_v2_broker.py` é histórico e não é instalado pelo patcher atual. Seu
segredo compartilhado com o webhook permitia forjar `chat_id`/`from.id` quando
ferramentas do modelo liam o ambiente do gateway; não o configure.

O único ingresso confiável é `supabase/functions/helena-v2-telegram`. A Edge
verifica `X-Telegram-Bot-Api-Secret-Token`, grava o Update na
`telegram_inbox` e cria pedido/recibo na mesma transação quando há `/pedido` de
chat privado pareado. O identificador `update_id` deduplica retransmissões;
um replay divergente falha. Tokens válidos de 48 caracteres hexadecimais após
`/vincular` são redigidos recursivamente no JSON persistido e antes de
encaminhar texto de `/pedido` a 0022; o hash SHA-256 do Update original mantém
a verificação de replay sem guardar o código em claro. Mídia e callback são
preservados com essa redação pontual, sem
atribuir leitura do anexo ou autorização ao callback. O token Telegram e a
service role ficam só na Edge.

O adapter `helena_v2_inbox.py` é escolhido no Hermes apenas com
`HELENA_V2_TELEGRAM_MODE=inbox-worker`. Ele usa
`HELENA_V2_TELEGRAM_WORKER_SECRET` distinto do segredo do webhook, no endpoint
fixo `HELENA_V2_TELEGRAM_BROKER_URL`. Essa capability autoriza só claim, renovação
e conclusão de trabalho previamente registrado e drenagem de outbox; a Edge
descarta qualquer `chat_id`, `from.id` ou destinatário fornecido pelo worker.
O adapter exige `config.token` vazio. O patch em `gateway/config.py` habilita
Telegram nesse modo mesmo sem `TELEGRAM_BOT_TOKEN`; um token no ambiente ou na
configuração antiga faz a conexão falhar fechada. O adapter não inicializa PTB
Bot e não chama `getUpdates` ou `setWebhook`. Conversa de texto usa o builder de evento e o
dispatcher originais do Hermes, preservando a chave de sessão Telegram.
`/pedido` segue para a triagem controlada do banco, sem executar ferramentas
do modelo. Mídia recebe resposta explícita de que o conteúdo ainda não foi
lido. O loop chama `/drain` continuamente, inclusive sem mensagens novas.

O worker guarda sua capability no processo Hermes. Ferramentas que executam
com o mesmo UID podem lê-la e abusar de jobs reais, embora não possam forjar
um Update nem escolher outro destinatário. Esse escopo residual foi aceito
para o transporte inicial; isolamento por UID seria necessário para proteger
também a integridade do texto de resposta. O relay server-side de `getFile`
pela Edge permanece pendente para não regredir conversas atuais com anexos;
o corte de produção depende dessa cobertura se anexos forem usados. Ainda é
necessário testar a versão e a configuração reais da VPS.

O envio pela Edge é durável e tem lease/retry. Quando Telegram aceita
`sendMessage` mas a resposta HTTP ou a confirmação no banco se perde, o retry
pode duplicar a mensagem; o comprovante permanece no banco. Não há garantia
de entrega exatamente uma vez. Uma revogação entre o claim e o envio externo
é uma janela residual de corrida. O vínculo exato da inbox impede que um
repareamento do mesmo chat reative saídas antigas.

Para verificar em cópia local do commit oficial
`e71a2bd11b733f3be7cf99deafde0066c343d462` (`v2026.5.29`):

```sh
HERMES_015_TREE=/tmp/copia-isolada-hermes-015 ./instalar-local.sh --apply
HERMES_015_TREE=/tmp/copia-isolada-hermes-015 ./instalar-local.sh --check
HERMES_015_SOURCE=/tmp/helena-hermes-015-source PYTHONPATH=/tmp/helena-hermes-015-source \
  /tmp/helena-telegram-test-venv/bin/python -m unittest discover -s motor/hermes-vps/telegram-v2 -p test_telegram_v2.py
```

O patcher valida commit e hashes da fonte, falha fechado diante de alterações
inesperadas e só permite `--apply` sob `/tmp` ou `/workspace`. **Não aplique na
VPS enquanto a cobertura de mídia necessária e o corte não estiverem validados.** No corte
controlado, parar o poller anterior e guardar estado/offset, configurar um
único webhook apontado à Edge com `drop_pending_updates=false`, observar o
backlog, testar retorno e manter rollback. Não executar essa sequência agora.
