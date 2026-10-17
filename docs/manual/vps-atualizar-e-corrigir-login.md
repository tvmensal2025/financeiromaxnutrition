# VPS: atualizar o motor e corrigir a renovação do login do Hermes

Roteiro curto para o **fundador** colar no terminal da VPS (`72.60.159.48`, como `root`), **um comando por vez**. Cada comando começa com `clear` para a tela mostrar só a saída daquele passo. Só passe ao próximo quando a saída bater com o "Esperado". Se não bater, pare e mande a saída para a Claude (a saída não contém senha nem token).

Escrito em 17/10/2026, sem acesso à VPS: as saídas abaixo vêm da leitura de `motor/hermes-vps/instalar-motor.sh` e `patch-hermes-auth.py`, não de uma execução na VPS. O estado atual da VPS é **NÃO CONFIRMADO**.

## O que este roteiro faz (e o que não faz)

- Atualiza o código do motor em `/opt/helena-v2/repo` para um commit fixo da `main` e **recria só** o venv do Hermes 0.19.0 do motor (`/opt/helena-v2/venv-hermes`), já com a correção de autenticação ([patch-hermes-auth.py](../../motor/hermes-vps/patch-hermes-auth.py)) e os 17 testes dela. A correção faz a renovação do login do ChatGPT gravar no lugar certo; diagnóstico e limites em [HERMES-AUTH-2026-10-17.md](../auditoria/HERMES-AUTH-2026-10-17.md).
- **Não apaga o login.** Conferido no script: a etapa `hermes-venv` roda `uv venv --clear` apenas em `$VENV_HERMES` (`/opt/helena-v2/venv-hermes`). O login fica em `/var/lib/helena-v2/hermes-home/auth.json` e nenhuma etapa deste roteiro escreve ali; os testes da correção usam uma pasta temporária sintética.
- **Não toca** no Hermes 0.15.1 do Telegram (`/usr/local/lib/hermes-agent`, `/root/.hermes`), no EasyPanel, na v1, no `venv-motor`, no `motor.env`, no bundle de CA, no banco nem nas migrations. O `requirements.txt` do motor e o pin `hermes-agent[mcp]==0.19.0` não mudaram desde o commit `27fd143`, por isso `motor-venv` não é rodada.
- **Não é** o caminho de [atualizar-v2.sh](../../motor/hermes-vps/atualizar-v2.sh) / [ATUALIZAR-V2.md](../../motor/hermes-vps/ATUALIZAR-V2.md) (staging por bundle, comparação das migrations, cutover ensaiado). Este é o caminho **no mesmo lugar**, em etapas isoladas: não use `instalar-motor.sh tudo` (ele reescreve a configuração). Em troca, ele não faz o dry run de migrations nem tem backup do venv; por isso o despachante fica parado durante todo o roteiro.
- Pré-condição, **NÃO REVALIDADA agora**: as migrations 0020–0026 já estão aplicadas no Supabase oficial (a retomada de 17/10 diz que sim). O código novo depende delas. Este roteiro não aplica migrations.

O SHA completo (40 caracteres) já está preenchido nos comandos abaixo: é o commit da `main` logo após o merge do PR #20 (`49476c93420c6d0592ed0ada43aad480c3b47895`). Se a `main` avançar, troque pelos 40 caracteres do commit que você quer instalar. SHA curto não funciona na etapa `codigo` (testado offline: "couldn't find remote ref"). Use o mesmo SHA nos passos 2 e 3.

## Passo 0 — antes de mexer (só leitura)

Veja no site, em `/cards`, que **nenhum card está em execução** (a parada do despachante interrompe o Hermes que estiver rodando). Depois, um comando por vez:

```
clear && git -c safe.directory=/opt/helena-v2/repo -C /opt/helena-v2/repo rev-parse HEAD
```
Esperado: 40 caracteres hexadecimais. **Anote**: é o commit anterior, para desfazer. O relato de 17/10 diz `27fd143…` (não revalidado).

```
clear && git -c safe.directory=/opt/helena-v2/repo -C /opt/helena-v2/repo status --short
```
Esperado: nada (vazio). Se listar arquivos, pare: há alteração local no checkout.

```
clear && ls -l /var/lib/helena-v2/hermes-home/auth.json
```
Esperado: um arquivo `-rw------- 1 helena helena …`. Só mostra metadados; não abre o conteúdo. Ao final (passo 5) este arquivo deve continuar igual.

## Passo 1 (a) — parar o despachante

```
clear && systemctl stop helena-despachante && systemctl is-active helena-despachante
```
Esperado: `inactive`. Vigia e relógio continuam ligados (não gastam cota). Não reinicie a VPS até o passo 6: o despachante está habilitado e voltaria sozinho com o venv pela metade.

## Passo 2 (b) — baixar o instalador do commit fixo

```
clear && cp -p /root/instalar-motor.sh /root/instalar-motor.sh.anterior; curl -fsSL -o /root/instalar-motor.sh https://raw.githubusercontent.com/tvmensal2025/financeiromaxnutrition/49476c93420c6d0592ed0ada43aad480c3b47895/motor/hermes-vps/instalar-motor.sh && bash -n /root/instalar-motor.sh && grep -n '^HELENA_REF=' /root/instalar-motor.sh
```
Esperado: uma linha parecida com `17:HELENA_REF="${HELENA_REF:-main}" …`. O `cp` guarda o instalador antigo (se não existir, ele só reclama; ignore). Se o `curl` der `404`, o SHA está errado (nada é gravado). Se a linha mostrar `claude/fervent-pasteur-g821nu`, o SHA é anterior à correção do padrão; não é grave porque o passo 3 passa o SHA explícito, mas confira se é o commit certo.

## Passo 3 (c) — baixar o código

```
clear && HELENA_REF=49476c93420c6d0592ed0ada43aad480c3b47895 bash /root/instalar-motor.sh codigo
```
Esperado: `OK: codigo em /opt/helena-v2/repo no commit xxxxxxx (49476c93420c6d0592ed0ada43aad480c3b47895)`, com `xxxxxxx` igual ao início do SHA. Só troca o checkout (destacado) e o dono dos arquivos. Os serviços vigia/relógio seguem rodando o código antigo, já carregado na memória. Se pedir "Token de LEITURA do GitHub", o repositório voltou a ser privado: cancele com Ctrl+C (nada foi alterado) e avise a Claude. `ERRO: falhou atualizar o codigo` = rede ou SHA incompleto.

## Passo 4 (d) — recriar o venv do Hermes com a correção

```
clear && bash /root/instalar-motor.sh hermes-venv
```
Demora alguns minutos e usa bastante CPU (instala `hermes-agent[mcp]==0.19.0`). Esperado, em ordem: a lista dos 17 testes da correção, cada um terminando em `ok`, depois `Ran N tests in …s` e `OK` (N = 17 segundo a auditoria; o que importa é o `OK`); a aplicação da correção e a verificação de versão não imprimem nada; por fim:
`OK: Hermes 0.19.0 do motor em /opt/helena-v2/venv-hermes (separado do Hermes do Telegram)`.
Qualquer `ERRO:` (falhou criar o venv, instalar, "correcao de autenticacao do Hermes nao aplicada", "testes locais … falharam", "nao e a 0.19.0") bloqueia o resto: rode o mesmo comando de novo (é repetível). Enquanto não terminar com `OK:`, `conferir` e `ligar-motor` recusam seguir (conferem os dois arquivos do Hermes por hash).

## Passo 5 (e) — conferir

```
clear && bash /root/instalar-motor.sh conferir
```
Esperado: `hermes: PRONTO_PARA_CONECTAR_NAO_APROVADO faltando: nada` (ou `APROVADO_PARA_PRODUCAO`) e `OK: runtime do motor conferido`. "Pronto para conectar" não prova que o Hermes real funciona (CONNECTED não é OPERATIONAL).

```
clear && ls -l /var/lib/helena-v2/hermes-home/auth.json
```
Esperado: o mesmo arquivo do passo 0, mesmas permissões.

```
clear && runuser -u helena -- env HOME=/var/lib/helena-v2 HERMES_HOME=/var/lib/helena-v2/hermes-home /opt/helena-v2/venv-hermes/bin/hermes auth status openai-codex 2>/dev/null | grep -q "logged in" && echo "login da v2: OK" || echo "login da v2: NAO confirmado"
```
Esperado: `login da v2: OK`. Se vier `NAO confirmado`, **não** ligue o motor: rode `bash /root/instalar-motor.sh login` (só pede o link e o código se o login realmente não estiver ativo) ou fale com a Claude. Isto confere o login; não prova 48 horas de renovação (NÃO COMPROVADO).

## Passo 6 (f) — ligar o motor

```
clear && bash /root/instalar-motor.sh ligar-motor
```
Esperado: `OK: despachante ligado com a revisao ativa <id>. Acompanhe: journalctl -u helena-despachante -f`. Se disser `nenhuma revisao de configuracao ATIVA`, ative uma revisão validada em `/configuracoes` e repita. O despachante chama o Hermes de verdade e gasta cota quando houver card.

## Passo 7 (g) — estado

```
clear && bash /root/instalar-motor.sh estado
```
Esperado:
```
helena-vigia         active
helena-relogio       active
helena-despachante   active
sem alarmes gravados        (ou "ultimos alarmes:" e até 5 linhas)
codigo: xxxxxxx             (início do 49476c93420c6d0592ed0ada43aad480c3b47895)
```
Opcional, para o código novo valer também no vigia e no relógio (que ainda rodam o antigo): `clear && systemctl restart helena-vigia helena-relogio`. Não é parte do roteiro pedido; faça só se a Claude indicar.

## Como desfazer

- **Parar a qualquer momento:** `clear && systemctl stop helena-despachante`. Se for deixar parado por horas, `systemctl disable helena-despachante` evita que volte após reinício (`ligar-motor` reabilita).
- **Voltar o código** (use o commit anotado no passo 0): `clear && HELENA_REF=<COMMIT_ANTERIOR_COMPLETO> bash /root/instalar-motor.sh.anterior codigo` e depois `clear && bash /root/instalar-motor.sh.anterior ligar-motor`. Use o instalador **antigo** guardado no passo 2: o novo exige a correção do Hermes, que não existe no código antigo. O Hermes corrigido pode ficar: a correção só muda a renovação do login dentro do Hermes e não importa código do motor (não foi testada com o código antigo: NÃO CONFIRMADO).
- **Venv do Hermes:** o antigo não é guardado (`--clear`). Se o passo 4 falhar, repita-o; não há como "voltar" além de recriá-lo, e recriar com o instalador antigo traria o Hermes 0.19.0 sem a correção.
- **Login:** nunca foi apagado; não há o que desfazer. Se o ChatGPT invalidar a sessão por outro motivo, é a etapa `login`.

## Inconsistências encontradas ao escrever

1. `HELENA_REF` padrão do instalador apontava para o ramo de trabalho `claude/fervent-pasteur-g821nu`; passou a `main` (mudança de uma linha, junto com este roteiro, que passa sempre o SHA). Para atualizar, o padrão `main` não é pinagem: use o SHA.
2. O HANDOFF diz que o código do motor na VPS (`27fd143`) "não mudou depois dele". Já mudou: `despacho.py`, `motor.py`, `plano.py`, `vigilancia.py`, `triagem_pedido.py` e `mapa_operacional.py` diferem desde então. O relato era verdadeiro naquele dia, não agora.
3. `retomada-hermes-vps.md` dizia que o `HELENA_REF` padrão "não é este commit"; ajustado para refletir o padrão `main` e apontar este roteiro.
4. ATUALIZAR-V2.md proíbe `instalar-motor.sh tudo` para atualizar e descreve staging; este roteiro usa só `codigo` e `hermes-venv` no lugar, sem staging. É o atalho consciente que o fundador pediu, não a rota "completa" de ATUALIZAR-V2.
5. A correção do Hermes e este roteiro **não foram executados na VPS**; a prova do dia de prova (Hermes/ChatGPT reais, 48 horas) continua NÃO COMPROVADA.
