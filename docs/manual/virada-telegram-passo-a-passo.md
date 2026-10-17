# Virada do Telegram para a Helena v2: passo a passo

O que é: roteiro para o **fundador** colar, **um comando por vez**, na virada do bot `@hermes_helena_oficial_bot` do Hermes 0.15.1 (poller antigo) para a Edge `helena-v2-telegram` (webhook) com o adapter `inbox-worker`. Usa o pacote [virada.sh](../../motor/hermes-vps/telegram-v2/virada.sh) na VPS e blocos de `curl` no **seu computador** para o que exige o token do bot. Escrito em 17/10/2026, com o fundador tendo autorizado a virada nessa data.
Como mudar: se o `virada.sh` ou o patch mudarem, atualize o passo 4 (hashes e `49476c93420c6d0592ed0ada43aad480c3b47895`, gerados com `sha256sum motor/hermes-vps/telegram-v2/{virada.sh,patch-hermes-telegram.py,helena_v2_inbox.py,test_telegram_v2.py}`) e as saídas esperadas; nunca escreva aqui valor de token, segredo, `.env` ou `auth.json`. A fotografia do que falta continua em [telegram-virada-para-v2.md](telegram-virada-para-v2.md).

**Estado desta preparação (honesto):** as saídas abaixo vêm da execução do `virada.sh` contra uma instalação **simulada** (repositório temporário, `systemctl`/`ps`/`curl` falsos) e, para o patch, contra o checkout **real** do commit fixado `e71a2bd1…` (v2026.5.29) numa pasta temporária. Nada foi executado na VPS, no Telegram, na Edge nem no banco. O estado da VPS é **NÃO CONFIRMADO**: é por isso que o passo 5 é só leitura e o passo 7 ensaia numa cópia antes de tocar em qualquer coisa. Se uma saída real não bater com o "Esperado", **pare e mande a saída à Claude** (as saídas do `virada.sh` não trazem token, segredo nem conteúdo de `.env`).

## Antes de começar

**O que muda para o Hermes 0.15.1 (aceito por você em 17/10):**

- O token do bot sai do `.env` do Hermes antigo (a linha vira um comentário sem o valor; o original fica só no backup). O token passa a existir **somente** nos segredos da Edge. Sem token, o Hermes 0.15.1 **não conversa mais sozinho com o Telegram**: acabam o polling, o envio proativo e qualquer cron que mande para o Telegram. Quem fala com o Telegram passa a ser sempre a Edge.
- A conversa comum continua sendo respondida pelo Hermes (mesma sessão); o adapter novo busca as mensagens na caixa de entrada da Edge. `/pedido <texto>` vira pedido; mensagem comum **não** vira pedido.
- **Anexos (foto, áudio, documento) não são lidos:** o bot avisa que ainda não consegue ler. Se você usa anexos hoje, isto é uma regressão até o relay de mídia existir.
- Riscos residuais já conhecidos: uma resposta pode chegar duplicada se o Telegram aceitar e a confirmação se perder; o segredo do worker pode ser lido por ferramentas do Hermes que rodam com o mesmo usuário (ele só reivindica/conclui trabalho existente e não cria identidade nem destinatário); há uma janela de corrida entre revogar o vínculo e um envio já reivindicado.
- Entre o passo 10 (parar o poller) e o passo 14 (registrar o webhook) o bot fica **mudo**. Faça os passos 10 a 14 em seguida, sem pausa. As mensagens enviadas nesse intervalo **não se perdem**: o Telegram as guarda e entrega ao webhook (`drop_pending_updates=false`).

**Pré-requisitos (marque antes de seguir):**

1. O site publicado, com `/integracoes` (pareamento) e a confirmação da proposta, e você consegue entrar como fundador. (Sem isso a virada funciona, mas a prova de ponta a ponta do passo 16 não.)
2. O motor novo (0.19.0) ligado, se quiser ver o pedido virar card. Hoje só um pedido de **Cálculo** com insumos rastreáveis tem chance de virar card (Parecer/Copy/Roteiro dependem de fonte de leis). A virada em si não depende do motor.
3. A Edge `helena-v2-telegram` publicada (versão 2, `verify_jwt=false`, vista ativa em 17/10).
4. O token do bot à mão (ele **nunca** é colado em chat, arquivo da VPS nem argumento de comando) e acesso `root` à VPS.
5. Um terminal com `bash` e `curl` no seu computador. Se o seu terminal for zsh (Mac), os blocos abaixo já chamam `bash -c`, então funcionam do mesmo jeito.

**Convenções:** `[COMPUTADOR]` roda no seu computador; `[VPS]` roda no terminal da VPS como `root`. Cada comando começa com `clear &&` para a tela mostrar só aquela saída. Só passe ao próximo quando a saída bater com o "Esperado".

---

## Passo 1 [COMPUTADOR] — gerar os dois segredos (distintos)

```
clear && bash -c 'umask 077; mkdir -p "$HOME/helena-segredos" && cd "$HOME/helena-segredos" && openssl rand -hex 32 | tr -d "\n" > webhook.txt && openssl rand -hex 32 | tr -d "\n" > worker.txt && wc -c webhook.txt worker.txt && ! cmp -s webhook.txt worker.txt && echo "distintos: OK"'
```
Esperado: `64 webhook.txt`, `64 worker.txt`, `128 total` e `distintos: OK`. Os valores ficam só nesses dois arquivos (pasta `~/helena-segredos`, permissão 700/600) e **não são exibidos**. Se aparecer `65`, o arquivo ganhou uma quebra de linha: apague a pasta e repita.

## Passo 2 [COMPUTADOR] — gravar os três segredos na Edge

Precisa do Supabase CLI já logado na sua conta (o mesmo usado no deploy da Edge). O token é digitado sem eco; o arquivo temporário é apagado em seguida.

```
clear && bash -c 'umask 077; cd "$HOME/helena-segredos" && read -rs -p "Token do bot (nao aparece): " TG; echo; printf "HELENA_V2_TELEGRAM_BOT_TOKEN=%s\nHELENA_V2_TELEGRAM_WEBHOOK_SECRET=%s\nHELENA_V2_TELEGRAM_WORKER_SECRET=%s\n" "$TG" "$(cat webhook.txt)" "$(cat worker.txt)" > edge.env; unset TG; supabase secrets set --env-file edge.env --project-ref wxkgrykduqtsgmjkzlou; rc=$?; shred -u edge.env 2>/dev/null || rm -f edge.env; ls edge.env 2>&1 | head -1; exit $rc'
```
Esperado: a mensagem de sucesso do CLI (`Finished supabase secrets set.`) e, na última linha, uma mensagem `No such file or directory` sobre `edge.env` (o arquivo temporário foi apagado). `HELENA_V2_TELEGRAM_MODE` deve ficar **ausente** na Edge (o modo é `webhook` por padrão).

```
clear && supabase secrets list --project-ref wxkgrykduqtsgmjkzlou | grep -E 'HELENA_V2_TELEGRAM|NAME'
```
Esperado: três nomes `HELENA_V2_TELEGRAM_BOT_TOKEN`, `HELENA_V2_TELEGRAM_WEBHOOK_SECRET`, `HELENA_V2_TELEGRAM_WORKER_SECRET` (com um resumo/digest, nunca o valor). Se faltar algum, repita o comando anterior.

## Passo 3 [COMPUTADOR] — testar a Edge sem tocar no Telegram

```
clear && curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram -H 'Content-Type: application/json' -d '{}'
```
Esperado: `401` (sem o cabeçalho secreto a Edge recusa). `503` = a Edge ainda não enxerga os segredos: espere um minuto e repita; se persistir, republique a função (`supabase functions deploy helena-v2-telegram --no-verify-jwt --project-ref wxkgrykduqtsgmjkzlou`, **sem** `--prune`) e repita.

```
clear && curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram/worker/claim -H 'X-Helena-Telegram-Worker-Secret: errado' -H 'Content-Type: application/json' -d '{}'
```
Esperado: `401`.

## Passo 4 [VPS] — baixar o pacote de virada e conferir

O SHA completo (40 caracteres) já está preenchido nos comandos abaixo: é o commit da `main` logo após o merge do PR #20 (`49476c93420c6d0592ed0ada43aad480c3b47895`). Se a `main` avançar, troque pelos 40 caracteres do commit que você quer instalar. O pacote vai para uma pasta própria; **não mexe** no checkout do motor em `/opt/helena-v2/repo`.

```
clear && umask 077 && mkdir -p /root/virada-telegram && cd /root/virada-telegram && for f in virada.sh patch-hermes-telegram.py helena_v2_inbox.py test_telegram_v2.py; do curl -fsSL -o "$f" "https://raw.githubusercontent.com/tvmensal2025/financeiromaxnutrition/49476c93420c6d0592ed0ada43aad480c3b47895/motor/hermes-vps/telegram-v2/$f" || echo "FALHOU: $f"; done; ls -l
```
Esperado: quatro arquivos e nenhuma linha `FALHOU`. (`404` = SHA errado.)

```
clear && cd /root/virada-telegram && sha256sum -c <<'EOF'
5d03a0f02583b1653f8ed4b551ebb726b39d9096254056e270acacde1944522c  virada.sh
49f3d782ab6c80cb56a358c1862f142b09b869b1cb54d64e12796eaf39baf1c9  patch-hermes-telegram.py
b4ef2021b4ef63365627b28f06b11a7de5135555165897eac9a5ddd5c7430640  helena_v2_inbox.py
0b6a3fb424a7617aa61a832d558626e7eb84442125d2ab2a1a201b89fa33ad13  test_telegram_v2.py
EOF
```
Esperado: quatro linhas `…: OK`. Qualquer `FAILED` = arquivo diferente do revisado: **pare**. (O patcher ainda confere sozinho o hash do adapter e dos arquivos do Hermes.)

```
clear && bash -n /root/virada-telegram/virada.sh && bash /root/virada-telegram/virada.sh ajuda
```
Esperado: a lista de etapas (`inventario`, `backup`, `ensaiar`, `instalar`, `parar-poller`, `iniciar`, `estado`, `reverter`).

## Passo 5 [VPS] — inventário (somente leitura)

```
clear && bash /root/virada-telegram/virada.sh inventario
```
Esperado (nomes e estados, nenhum valor):

- `versão do pacote: 0.15.1` e `OK: commit igual ao fixado (v2026.5.29)`;
- `patch Helena v2: NÃO aplicado`; `gateway/run.py` e `gateway/config.py: igual ao commit`;
- no `.env`: `variáveis (só nomes): TELEGRAM_ALLOWED_USERS TELEGRAM_BOT_TOKEN TELEGRAM_REACTIONS` (ou parecido) e `TELEGRAM_BOT_TOKEN no .env: PRESENTE`;
- `config sem chave token preenchida`;
- `unidade: hermes-gateway.service (escopo user)`, `estado: active/running` e **um** processo do gateway;
- fim: `OK: nenhuma pendência encontrada; pode seguir para o backup`.

**Pare e mande à Claude** se: versão diferente de 0.15.x, commit diferente, `.git ausente`, arquivos rastreados alterados, `unidade … não encontrada` (o nome pode ser outro: `HERMES_UNIT=<nome>.service HERMES_SCOPE=user bash …`), chave `token` preenchida na configuração, ou processos extras. O inventário não prova qual bot o poller usa: isso é você que sabe.

## Passo 6 [VPS] — backup (nada é parado)

```
clear && bash /root/virada-telegram/virada.sh backup
```
Esperado: `[Conferência]` com `codigo-hermes-agent.tar.gz: … bytes, … itens` e `hermes-home.tar.gz: … bytes, … itens` e, no fim, `RESULTADO: BACKUP OK em /root/backup-hermes-015-AAAAMMDD-HHMMSS (…)`. A pasta é `700` e os arquivos `600`; o `.env` e o `auth.json` estão dentro: **não copie esse backup para fora da VPS nem cole nada dele no chat**. O código é guardado sem o `venv` (a virada só altera 2 arquivos e cria 1; use `--com-venv` se quiser tudo). Sem espaço, o script recusa antes de começar. Se o Hermes estiver gravando enquanto o `tar` lê, uma diferença de até 5% de itens é tolerada.

```
clear && ls -l /root/backup-hermes-015-*/
```
Esperado: `MANIFESTO.env`, `MANIFESTO.sha256`, `codigo-hermes-agent.tar.gz`, `hermes-home.tar.gz`, `arquivos-originais/` e `unidade/`.

## Passo 7 [VPS] — ensaio numa cópia (nada real é alterado)

```
clear && bash /root/virada-telegram/virada.sh ensaiar
```
Esperado: `OK: patch aplicado na cópia, conferido e idempotente`, `arquivos reais: gateway/run.py=original gateway/config.py=original`, os testes offline do adapter (`Ran 5 tests … OK`, sem rede nem Telegram real) e `RESULTADO: ENSAIO OK`. Demora de 1 a 3 minutos e usa CPU. **Pare** se aparecer `ENSAIO REPROVADO`, `DIVERGENTE`, `testes foram pulados` ou `ENSAIO PARCIAL` (sem Python do venv: os testes não rodaram). A cópia é descartada (`--manter` a preserva para análise).

## Passo 8 [COMPUTADOR] — conferir o webhook antes (esperado: vazio)

O token é lido sem eco, vai ao `curl` por **stdin** (não aparece em `ps` nem no histórico) e o processo termina em seguida. Rode no seu computador, não na VPS.

```
clear && bash -c 'read -rs -p "Token do bot (nao aparece): " TG; echo; printf "url = \"https://api.telegram.org/bot%s/getWebhookInfo\"\n" "$TG" | curl -sS -K -; echo; unset TG'
```
Esperado: `{"ok":true,"result":{"url":"","has_custom_certificate":false,"pending_update_count":0}}`. `"url":""` confirma que hoje o bot usa `getUpdates` (poller). Se `url` **não** estiver vazia, outra coisa já usa webhook neste bot: **pare** e fale com a Claude. A saída não contém o token e pode ser colada no chat.

## Passo 9 [VPS] — instalar o adapter na instalação real

Antes de colar: no seu computador, copie o segredo do worker **sem exibi-lo** (Mac: `pbcopy < ~/helena-segredos/worker.txt`; Linux: `xclip -selection clipboard < ~/helena-segredos/worker.txt`; Windows: `clip < %USERPROFILE%\helena-segredos\worker.txt`).

```
clear && bash /root/virada-telegram/virada.sh instalar --producao
```
O script pede duas vezes `Cole o segredo do worker (não aparece na tela)`: cole, tecle Enter, cole de novo, Enter. Nada aparece na tela. (Sem `--producao` ele recusa. O segredo **nunca** vai como argumento: `instalar --producao <segredo>` é recusado.) Esperado, em ordem:

- `Backup usado: /root/backup-hermes-015-…`;
- `OK: patch aplicado e conferido (commit fixado + hashes)`;
- `OK: TELEGRAM_BOT_TOKEN desativado em /root/.hermes/.env (linha trocada por comentário; demais variáveis intactas)`;
- `OK: /etc/helena-v2/telegram-worker.env gravado (modo 600; variáveis: HELENA_V2_TELEGRAM_BROKER_URL HELENA_V2_TELEGRAM_MODE HELENA_V2_TELEGRAM_WORKER_SECRET )`;
- `OK: drop-in … carregado: a unidade lerá /etc/helena-v2/telegram-worker.env na próxima partida`;
- `OK: token fora do .env, da unidade e da configuração; patch conferido; segredo do worker em arquivo 600`;
- o bloco `[O que acontece com o token no .env do Hermes 0.15.1]` e `RESULTADO: INSTALAÇÃO CONCLUÍDA. O serviço ainda NÃO foi reiniciado`.

Se qualquer verificação falhar, o script **desfaz o que fez nesta execução** (restaura os 2 arquivos, o `.env`, apaga o drop-in e o arquivo do worker) e termina com `ERRO:`; nada precisa ser limpo à mão. Recusas esperadas e seguras: backup ausente/adulterado, commit diferente do fixado, `run.py`/`config.py` alterados depois do backup, token em `config.yaml`, `Environment=` da unidade ou arquivo de ambiente da unidade, segredo com formato inválido. Depois de um `ERRO:`, mande a mensagem à Claude. Repetir o comando depois de sucesso é seguro (`--manter-segredo` reaproveita o segredo já gravado).

Limpe a área de transferência (Mac: `printf '' | pbcopy`).

## Passo 10 [VPS] — parar o poller antigo

```
clear && bash /root/virada-telegram/virada.sh parar-poller
```
Esperado: `estado antes: active`, `OK: unidade hermes-gateway.service parada (estado: inactive) e nenhum processo do gateway 0.15.1 sobrou`. Só a unidade do Hermes do Telegram é parada; o motor v2 (`helena-*`), o EasyPanel e a v1 não são tocados (o script recusa unidades `helena-*`). Se aparecer `sobraram processos`, rode `clear && bash /root/virada-telegram/virada.sh parar-poller --forcar`; **não siga** enquanto restar processo (um poller vivo derrubaria o webhook com erro 409).

## Passo 11 [VPS] — subir o Hermes no modo novo

```
clear && bash /root/virada-telegram/virada.sh iniciar
```
Esperado: `OK: unidade hermes-gateway.service ativa (MainPID …)`; `pid …: TELEGRAM_BOT_TOKEN no ambiente=0 (esperado 0); modo inbox-worker=1 (esperado 1)`; `OK: o gateway registrou 'telegram connected'`. `telegram failed to connect` = o adapter falha fechado (token no ambiente, URL ou segredo inválidos): rode `clear && bash /root/virada-telegram/virada.sh estado --log` e mande à Claude (o log pode conter trechos de conversa; mascare antes de colar). `NÃO CONFIRMADO` = nenhuma linha nova no log em 30 s; leia `tail -n 50 /root/.hermes/logs/gateway.log`.

## Passo 12 [VPS] — confirmar que a Edge aceita o segredo do worker

O adapter repete a chamada à Edge **sem registrar erro**, então um segredo errado não aparece no log. Este teste chama só a Edge da v2 (não o Telegram); o segredo vai ao `curl` por stdin.

```
clear && bash /root/virada-telegram/virada.sh estado --testar-edge
```
Esperado: `patch Helena v2: APLICADO e conferido`, `TELEGRAM_BOT_TOKEN: ausente de /root/.hermes/.env`, `modo inbox-worker=1` e `OK: Edge aceitou o segredo do worker (HTTP 200, sem trabalho na fila)`. `HTTP 401` = o segredo da VPS difere do gravado na Edge: refaça o passo 9 colando o `worker.txt` correto. Se houver trabalho real na fila ele é reivindicado agora e volta quando a lease expirar (o conteúdo não é exibido).

## Passo 13 [COMPUTADOR] — registrar o webhook (único, sem apagar pendências)

Só faça este passo com o passo 11 e o passo 12 OK. O `secret_token` é lido do arquivo `webhook.txt`; o token do bot, sem eco.

```
clear && bash -c 'read -rs -p "Token do bot (nao aparece): " TG; echo; printf "url = \"https://api.telegram.org/bot%s/setWebhook\"\n" "$TG" | curl -sS -K - --data-urlencode "url=https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram" --data-urlencode "secret_token@$HOME/helena-segredos/webhook.txt" --data "drop_pending_updates=false"; echo; unset TG'
```
Esperado: `{"ok":true,"result":true,"description":"Webhook was set"}`. Qualquer outra resposta: execute já o `deleteWebhook` do bloco de reversão R2 e fale com a Claude.

## Passo 14 [COMPUTADOR] — conferir o webhook depois

```
clear && bash -c 'read -rs -p "Token do bot (nao aparece): " TG; echo; printf "url = \"https://api.telegram.org/bot%s/getWebhookInfo\"\n" "$TG" | curl -sS -K -; echo; unset TG'
```
Esperado: `"url":"https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram"`, `pending_update_count` pequeno ou decrescendo (mensagens que esperaram durante a virada) e **sem** `last_error_message`. Com `last_error_message` (ex.: `Wrong response from the webhook: 401/503`), vá à reversão R2/R3.

## Passo 15 [VPS] — estado depois da virada

```
clear && bash /root/virada-telegram/virada.sh estado
```
Esperado: unidade `active/running`, um processo com `TELEGRAM_BOT_TOKEN no ambiente=0` e `modo inbox-worker=1`, patch `APLICADO`, `/etc/helena-v2/telegram-worker.env` com modo `600`.

## Passo 16 — parear e provar (site + Telegram)

1. **[Site]** Entre como fundador em `/integracoes` e gere o código de pareamento (vale 10 minutos; só o hash fica guardado).
2. **[Telegram]** Na conversa **privada** com `@hermes_helena_oficial_bot`, envie `/vincular <código>` e **apague a mensagem** em seguida. Esperado: o bot responde "Vínculo confirmado. Confira o status no site." e `/integracoes` mostra o chat vinculado.
3. **[Telegram]** Envie um pedido curto e inofensivo, por exemplo `/pedido TESTE DE VIRADA: só confirme o recebimento, sem executar nada`. Esperado: recibo/protocolo no próprio Telegram em poucos segundos.
4. **[Telegram]** Envie uma mensagem comum ("oi"). Esperado: resposta de conversa do Hermes, **sem** virar pedido.
5. **[Site]** Veja a proposta de triagem e confirme. O aviso de card só aparece com o motor ligado e um serviço que consiga rodar (ver pré-requisito 2); a falta dele **não** invalida a virada.
6. **[Claude, só leitura]** Peça à Claude para conferir, em transação `READ ONLY`, um item em `telegram_inbox` por update, `telegram_trabalho` `CONCLUIDO`, `telegram_saida` `ENTREGUE` e um vínculo ativo. Resultado esperado: sem trabalho nem saída presos.
7. **[Telegram/Site]** Opcional: revogue o vínculo no site e confirme que o bot deixa de responder a você (corta pedidos e avisos na hora).

Só declare a virada concluída depois disso: **CONFIGURADA não é OPERACIONAL**.

## Limpeza (depois que tudo funcionar)

```
clear && bash -c 'cd "$HOME/helena-segredos" && shred -u webhook.txt worker.txt && cd .. && rmdir helena-segredos && echo apagado'
```
Esperado: `apagado`. (Faça só quando não for mais precisar reinstalar com o mesmo segredo; o da VPS fica em `/etc/helena-v2/telegram-worker.env`, modo 600.) Mantenha o backup `/root/backup-hermes-015-*` até ter certeza de que não vai reverter. Feche o terminal do computador usado com o token.

---

## Reversão

Escolha o ponto de parada. Regra de ouro: **primeiro apague o webhook, depois religue o poller antigo**, senão o Hermes antigo recebe erro 409.

**R1 — cortar pedidos e avisos na hora (não desfaz nada na VPS):** revogue o vínculo em `/integracoes`.

**R2 [COMPUTADOR] — apagar o webhook sem descartar pendências:**

```
clear && bash -c 'read -rs -p "Token do bot (nao aparece): " TG; echo; printf "url = \"https://api.telegram.org/bot%s/deleteWebhook\"\n" "$TG" | curl -sS -K - --data "drop_pending_updates=false"; echo; unset TG'
```
Esperado: `{"ok":true,"result":true,"description":"Webhook was deleted"}`. Depois repita o `getWebhookInfo` (passo 8): `"url":""`.

**R3 [VPS] — restaurar o Hermes antigo e religar o poller:**

```
clear && bash /root/virada-telegram/virada.sh reverter --confirmo-webhook-removido
```
Esperado: `OK: gateway/run.py e config.py voltaram aos originais…`, `OK: … .env restaurado (inclui a linha TELEGRAM_BOT_TOKEN original)`, `OK: unidade não lê mais /etc/helena-v2/telegram-worker.env`, `OK: poller antigo religado` e `RESULTADO: REVERSÃO CONCLUÍDA`. Sem `--confirmo-webhook-removido` o script restaura tudo mas **não religa** o poller (e imprime a checagem a fazer). O `.env` volta com o token original, então o Hermes antigo volta a falar com o Telegram. Mande uma mensagem comum ao bot: o Hermes antigo deve responder. Para restaurar também `~/.hermes` inteiro (perde as conversas feitas depois do backup; a versão atual é guardada ao lado em `~/.hermes.pos-virada-…`), acrescente `--home-completo` — só em último caso.

**R3b [VPS] — apagar o segredo do worker (opcional, depois de reverter):** `clear && rm -f /etc/helena-v2/telegram-worker.env`

**R4 [COMPUTADOR] — a Edge para de aceitar o webhook (passa a responder 503):**

```
clear && supabase secrets unset HELENA_V2_TELEGRAM_WEBHOOK_SECRET --project-ref wxkgrykduqtsgmjkzlou
```

**R5 [VPS] — se o problema for o gasto do motor:** `clear && systemctl stop helena-despachante`.

**R6 — rotacionar:** se qualquer valor (token do bot, segredo do webhook ou do worker) tiver aparecido em chat, tela compartilhada ou arquivo errado, gere outro (token: `/revoke` no @BotFather; segredos: passo 1 e 2, depois `instalar --producao` sem `--manter-segredo`). Se reverter depois de revogar o token, o `.env` do Hermes antigo precisa do token novo: fale com a Claude, não cole o token em chat.

## O que cada etapa do `virada.sh` faz e não faz

| Etapa | Faz | Não faz |
|---|---|---|
| `inventario` | lê versão, commit, unidade, processos, nomes de variáveis, modos e donos | abrir valores de `.env`/`auth.json`, alterar algo, rede |
| `backup` | `tar` do código (sem `venv`) e de `~/.hermes` em `/root/backup-hermes-015-<data>` (700/600), confere itens, tamanhos e SHA-256 | parar serviço; recusa sem espaço ou com conferência falha |
| `ensaiar` | aplica o patch numa cópia limpa do commit fixado (em `/tmp`), confere, reaplica (idempotência) e roda os testes offline com o Python do Hermes | alterar `/usr/local/lib/hermes-agent`, `~/.hermes` ou o serviço |
| `instalar --producao` | confere backup, commit e hashes; aplica o patch (troca atômica por arquivo); tira o token do `.env`; grava `/etc/helena-v2/telegram-worker.env` (segredo por stdin) e o drop-in; desfaz tudo se falhar | reiniciar o serviço, chamar o Telegram, aceitar segredo por argumento |
| `parar-poller` | para só a unidade do Hermes do Telegram e confere que não há processo | tocar em `helena-*`, EasyPanel ou v1 |
| `iniciar` | recusa se houver poller vivo, token no `.env` ou drop-in ausente; sobe; confere ambiente do processo e o log | registrar webhook |
| `estado` | resume serviço, patch, token, arquivos; `--testar-edge` chama `worker/claim` da Edge (segredo por stdin do `curl`); `--log` mostra o final do log mascarado | usar o token do bot |
| `reverter` | restaura código e `.env` do backup, remove o drop-in, religa o poller antigo (com `--confirmo-webhook-removido`) | usar o token do bot; apagar o arquivo do worker |

Testes do pacote: `python3 -m unittest discover -s motor/hermes-vps/telegram-v2 -p 'test_virada.py'` (a parte contra o checkout real do Hermes exige `HERMES_015_SOURCE` apontando para um clone Git no commit fixado). Eles simulam a VPS; **não substituem** o ensaio do passo 7 nem a primeira execução real.

## Decisões do fundador que este roteiro pressupõe

Autorização de cada efeito remoto (Edge, segredos, VPS, webhook, pareamento) e as aceitações listadas em [telegram-virada-para-v2.md](telegram-virada-para-v2.md): `/pedido` obrigatório; sem anexos; o Hermes 0.15.1 perde o token; riscos residuais de duplicidade e da capability do worker; confirmação da proposta só no site. Ficam em aberto, e fora deste roteiro: teto de gasto por dia/pedido, alarme de queda do worker ou do motor, ordem em relação à rotação geral de credenciais e o tratamento de Parecer/FON-LEIS.
