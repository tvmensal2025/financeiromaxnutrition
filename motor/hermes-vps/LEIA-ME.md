# Helena v2 na VPS: dois instaladores

| Arquivo | O que instala | Quem o roda |
|---|---|---|
| `instalar.sh` | O Hermes 0.15.1 do profissional (Plano B), com bot do Telegram e login do ChatGPT em `/root/.hermes`. Feito em 17/10/2026. | O fundador, colando no terminal da VPS |
| `instalar-motor.sh` | O **motor da v2**: Hermes **0.19.0** próprio (`/opt/helena-v2/venv-hermes`), login próprio da v2 (`/var/lib/helena-v2/hermes-home`), usuário `helena` sem privilégio, `motor.env` com as duas conexões (`helena_motor`, `dbos_motor`), serviços `helena-vigia`, `helena-relogio` e `helena-despachante`. | O fundador, colando os comandos no terminal da VPS (**foi o caminho que funcionou em 17/10/2026**). O fluxo do GitHub por SSH é opcional e não foi homologado |

São três Hermes, de propósito: o do **EasyPanel** é a v1 (fica como está até a DEC-028); o do **profissional** é o assistente do Telegram (0.15.1, raiz); o do **motor** é o que a v2 chama por tarefa (0.19.0, usuário `helena`), porque o executor usa opções que só existem na 0.19.0. O motor nunca lê `/root/.hermes`.

## Motor: ordem das etapas (`instalar-motor.sh`)
`preparar → codigo → motor-venv → hermes-venv → login → banco (inclui testar-banco) → conferir → servicos`, depois: tela `/configuracoes` (Clonar a técnica, Pedir validação) → `validar-config` → tela (Ativar) → `ligar-motor`. Cada etapa pula o que já está pronto. `estado` mostra os serviços e os últimos alarmes. O despachante só liga com uma revisão ATIVA no banco, e chama o Hermes de verdade (gasta cota).

Testado localmente (17/10/2026): formato das conexões aceito pela validação real do motor (pooler e direto, senha com caracteres especiais), `motor.env` 0640, host fora do projeto recusado, unidades do systemd, checkout a partir de repositório local e de `git bundle`, `conferir-runtime` real, falha fechada sem vazar a URL quando o banco não responde, ordem das etapas. **Na VPS: EXECUTADO em 17/10/2026** (`preparar` até `servicos`): conexões das duas contas OK com TLS verificado no host `aws-0-us-east-1.pooler.supabase.com`, `conferir` OK, vigia e relógio ligados. **Ainda NÃO feito:** `ligar-motor` (exige revisão ATIVA) e o dia de prova. Dois detalhes que a VPS exigiu: o Python do uv fica em `/opt/helena-v2/python` (o usuário `helena` não lê `/root`) e o pooler do Supabase usa a CA própria do Supabase, que o instalador baixa, confere por impressão digital fixa e junta ao pacote do sistema em `/etc/helena-v2/ca-bundle.crt` (`SSL_CERT_FILE` no `motor.env`). O repositório está público, então a etapa `codigo` clona sem token; se voltar a ser privado, ela pede um token de leitura.

## Fluxo do GitHub (`.github/workflows/helena-vps-motor.yml`) — opcional, NÃO homologado
Em 17/10/2026 ele falhou no acesso SSH (o segredo `VPS_SSH_KEY` tinha só a impressão digital da chave). Não é o caminho principal.
Segredos do repositório: `VPS_HOST`, `VPS_SSH_KEY` (ou `VPS_PASSWORD`), `HELENA_SENHA_MOTOR`, `HELENA_SENHA_DBOS`. O código vai por `git bundle` (sem token do GitHub na VPS); os segredos vão por arquivo 0600 pela entrada do SSH e são apagados antes de rodar; o registro mascara as senhas das URLs. A etapa `login` mostra o link e o código do ChatGPT no registro da execução.

---

# Hermes na VPS, direto, sem EasyPanel (Plano B do profissional)

Este é o instalador do profissional (`original/instalar-na-vps.sh`), adaptado só para rodar **dentro da VPS** em uma execução. As etapas são as mesmas: preparar o servidor, instalar o Hermes v2026.5.29, configurar o Telegram, entrar com a conta do ChatGPT, ligar o agente e verificar.

## O que mudou em relação ao original

| Mudança | Motivo |
|---|---|
| O código do Hermes vem do GitHub oficial (tag `v2026.5.29`), e o script só aceita se o commit for `e71a2bd11b733f3be7cf99deafde0066c343d462`. | Dispensa enviar o pacote de 67 MB por SFTP. O código baixado é idêntico ao pacote: 4158 arquivos comparados, 0 diferenças. |
| Etapa `tudo`: pergunta o token e o ID do Telegram sem mostrar na tela e roda as etapas na ordem. | Uma execução só. O token não vai para arquivo nem para a linha de comando. |
| Etapa `bot`: confere o token no Telegram. | Pega token errado antes de instalar. |
| Etapas `modelo` e `testar-modelo`: definem `model.default` (padrão `gpt-6.1-sol`, troque com `HERMES_MODELO=...`) e fazem uma pergunta mínima ao modelo. | O login do original grava o provedor mas não o modelo. Sem isso o agente responde "The model provider failed after retries" (visto em 17/10/2026). Com a correção, o teste direto respondeu `ok`. |
| `WORK`, `HERMES_DIR` e `HERMES_HOME` podem ser trocados por variável. O `case` final só roda quando o arquivo é executado. | Permite testar sem tocar no sistema. |

Todo o resto é idêntico ao original, e o original está guardado ao lado para comparar:

```sh
diff original/instalar-na-vps.sh instalar.sh
```

## Antes de rodar

1. **Esta VPS divide 4 núcleos com o EasyPanel, a v1, o WhatsApp e o app.** O instalador não mexe em Docker nem em EasyPanel, mas a etapa `hermes` usa bastante processador por alguns minutos. Rode quando o servidor estiver calmo.
2. **Use um bot do Telegram que a v1 não usa.** Dois programas lendo o mesmo bot derrubam um ao outro. Crie um bot novo no @BotFather.
3. Tenha à mão o token desse bot e o seu ID numérico do Telegram (do @userinfo).
4. **Espaço em disco:** confira com `df -h /`. A instalação precisa de alguns GB livres.

## Como rodar (no terminal da VPS, como root)

No painel da Hostinger, abra a VPS e use o terminal do navegador. Depois cole os comandos que a Claude mandou na conversa. Eles baixam o script, conferem o SHA-256 e o executam.

Quando aparecer o link e o código da OpenAI, abra o link, entre com a sua conta do ChatGPT e digite o código. Ao final, o script mostra o link do seu agente no Telegram. Depois, **troque a senha root** com `passwd`.

Cada etapa pula o que já estiver pronto. Se algo falhar, leia a linha que começa com `ERRO:`, corrija a causa e rode `bash instalar.sh tudo` de novo. Não recomece do zero.

## O que isto NÃO é

- Não liga o Hermes do profissional (0.15.1, `/root/.hermes`) ao motor do Helena v2; a ponte Telegram→v2 NÃO foi feita. O motor chama `hermes -z` por tarefa e exige a versão 0.19.0, que tem a opção `--usage-file`. Esta instalação é a 0.15.1, igual à do profissional. A atualização e a ligação com o motor são um passo seguinte, no dia de prova.
- Não prova cota nem renovação de login. Hermes real e login do ChatGPT continuam **NÃO COMPROVADOS** até o dia de prova ser executado e registrado.
- Não guarda senha nem token. As credenciais são usadas só durante a instalação. O token do Telegram fica apenas em `/root/.hermes/.env`, com permissão 600.
