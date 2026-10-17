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

- Não liga o Hermes ao motor do Helena v2. O motor chama `hermes -z` por tarefa e exige a versão 0.19.0, que tem a opção `--usage-file`. Esta instalação é a 0.15.1, igual à do profissional. A atualização e a ligação com o motor são um passo seguinte, no dia de prova.
- Não prova cota nem renovação de login. Hermes real e login do ChatGPT continuam **NÃO COMPROVADOS** até o dia de prova ser executado e registrado.
- Não guarda senha nem token. As credenciais são usadas só durante a instalação. O token do Telegram fica apenas em `/root/.hermes/.env`, com permissão 600.
