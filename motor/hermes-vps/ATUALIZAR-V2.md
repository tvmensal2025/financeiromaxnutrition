# Atualização preparada da Helena v2

`atualizar-v2.sh` prepara código e ambientes **sem ativar** serviços, executar SQL ou ler credenciais. A entrada deve ser um Git bundle de um commit já revisado. O comando exige o SHA completo do novo commit, o SHA do checkout atual como baseline e um diretório privado de staging. Ele recusa checkout atual alterado, release divergente e sobrescrita de release existente. As migrations 0001 até a última existente no checkout anterior precisam formar uma sequência sem lacunas e permanecer byte a byte iguais; o novo release precisa conter pelo menos 0001–0026. Toda a sequência do release é validada, incluindo migrations posteriores a 0026, recusando duplicatas, lacunas e links simbólicos. Se o checkout antigo termina em 0019 e o banco já recebeu 0020–0026, o dry run aceita essa diferença. A aplicação real no banco exige conferência independente.

```bash
# Em um clone limpo que contém o commit revisado:
git bundle create /caminho/privado/helena-v2.bundle --all

# Na máquina de destino, com o bundle já transferido por canal autenticado:
mkdir -m 700 -p /opt/helena-v2/staging
bash atualizar-v2.sh \
  --bundle /caminho/privado/helena-v2.bundle \
  --commit SHA_COMPLETO_NOVO \
  --current-repo /opt/helena-v2/repo \
  --baseline SHA_COMPLETO_ATUAL \
  --dest /opt/helena-v2/staging

# Só depois de revisar a saída do dry run, repetir com --prepare.
```

`--prepare` cria `/opt/helena-v2/staging/<commit>` com clone destacado, venvs novos e locks com hashes dos pacotes resolvidos. Instala com `uv pip sync --require-hashes`, aplica a correção de autenticação somente ao Hermes 0.19.0 do motor e roda testes locais de configuração e acesso ao banco com dados sintéticos. Isso não testa o adaptador Telegram/Hermes 0.15.1, que é uma instalação separada. O manifesto `RELEASE.txt` registra hashes e `STAGED_ONLY`. O staging continua privado; o processo ativo ainda usa `/opt/helena-v2/repo`, as venvs atuais, `/etc/helena-v2/motor.env` e `/var/lib/helena-v2/hermes-home`.

Antes de planejar qualquer troca, executar `inventario.sh` na VPS por console ou SSH com chave de host conferida por fonte independente. Confirmar HEAD e layout reais, alterações locais, jobs em andamento, esquema da base e migrations necessárias, backup restaurável, serviços afetados e janela de manutenção. A migration nova deve ser revisada e aplicada pelo fluxo próprio, uma vez, antes de código que dependa dela; este script não aplica nem reaplica migrations. Não rodar `instalar-motor.sh tudo` para atualizar: ele recria venvs e reescreve configuração. Não disparar o workflow SSH existente sem corrigir a confiança na chave de host.

O cutover requer procedimento separado, com baseline ainda idêntico, jobs ociosos, backup verificado e rollback ensaiado. O layout atual de `/opt/helena-v2/repo` na VPS não foi conferido; não presumir que seja symlink nem renomear o diretório em uso. Preservar Hermes profissional/Telegram, EasyPanel, `motor.env` e os logins. Após a troca futura, validar HEAD ativo, três estados de serviço, migração e recibo de um fluxo controlado; se falhar, voltar ao release anterior e conferir o estado no banco antes de repetir qualquer evento.

Regressões locais do dry run, sem rede, dependências externas, credenciais ou serviços: `python3 -m unittest discover -s motor/hermes-vps -p test_atualizar_v2.py`. Os testes constroem bundles sintéticos e verificam que alterações nas migrations 0024 em diante são recusadas e que o checkout atual e o staging permanecem intactos.
