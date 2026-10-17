# Helena v2 — autenticação do Hermes 0.19.0 em perfis isolados

Diagnóstico offline em 17/10/2026. Nenhuma credencial real foi lida ou criada; a
renovação OAuth foi substituída por função local que devolve valores sintéticos.
Nenhuma chamada a ChatGPT, VPS ou Supabase ocorreu.

## Fonte e reprodução

- Fonte: sdist oficial `hermes_agent-0.19.0.tar.gz` obtido do arquivo anunciado
  por `https://pypi.org/pypi/hermes-agent/0.19.0/json`, via HTTPS com TLS normal.
- SHA-256 anunciado pelo PyPI e conferido localmente:
  `ac986bede64a2785436676c0ea084ec586574f8cb00a9d047e095b435d3e21c0`.
- Arquivo: `/tmp/hermes_agent-0.19.0.tar.gz`. Fonte extraída:
  `/tmp/hermes-agent-source/hermes_agent-0.19.0/`.
- Prova executável: `docs/auditoria/repro-hermes-auth-2026-10-17.py`. Rodar:

  ```sh
  PYTHONPATH=/tmp/hermes-agent-source/hermes_agent-0.19.0:/workspace/financeiromaxnutrition/motor/executor python docs/auditoria/repro-hermes-auth-2026-10-17.py
  ```

Resultado observado: os seis indicadores da prova retornam `True`: o primeiro
perfil lê o login da raiz; a renovação grava no perfil; a raiz conserva o estado
antigo; a conferência da Helena detecta `auth.json` no perfil; o perfil seguinte
lê o estado antigo; quando o token de renovação antigo é simulado como já
consumido, o perfil seguinte falha sem `CODEX_HOME` preenchido.

## O que o código realmente faz

- `hermes_constants.py:154-190` deriva a raiz de
  `HERMES_HOME=<raiz>/profiles/<nome>`; `hermes_cli/auth.py:916-980` lê
  `<raiz>/auth.json` como fallback. `auth.py:1205-1232,3319-3330` usa esse
  estado para `openai-codex`. Portanto, o perfil vazio pode usar o login da raiz
  sem copiar a credencial para a tarefa. Isso resolve o risco inicial de ausência
  absoluta de login, sujeito a prova com Hermes real.
- Quando o token está perto de expirar, `auth.py:3804-3824` chama
  `_refresh_codex_auth_tokens`; `auth.py:3647-3688` chama `_save_codex_tokens`;
  `auth.py:3469-3494` grava no auth store ativo, determinado por
  `auth.py:894-913` como `<perfil>/auth.json`. A raiz não recebe o token renovado.
  A reprodução chamou essas funções oficiais, substituindo apenas a chamada
  externa de refresh e o relógio de expiração.
- Não há opção de ambiente para um auth store Codex separado do `HERMES_HOME`
  em `auth.py` ou `hermes_constants.py` desta versão. O
  `HERMES_SHARED_AUTH_DIR` visto no arquivo é específico do armazenamento
  compartilhado Nous, e não redireciona Codex.
- O executor da Helena rejeita `auth.json` no perfil em
  `executor_helena/conferencia.py:83-91` e remove o perfil em
  `executor_helena/executor.py:188-199`. Assim, a própria execução em que
  ocorrer a renovação pode ser recusada na conferência e sua credencial renovada
  será apagada. O próximo perfil volta à raiz obsoleta. Se o refresh token tiver
  sido consumido, o Hermes tentará recuperar via `CODEX_HOME` em
  `auth.py:3647-3681`; a Helena o mantém vazio em
  `executor_helena/ambiente.py:43-50`.

## Correção local preparada após o diagnóstico

O pin continua `hermes-agent==0.19.0`. O instalador agora aplica [patch-hermes-auth.py](../../motor/hermes-vps/patch-hermes-auth.py) somente aos dois módulos que correspondem aos hashes oficiais. A transformação também tem hashes fixos, é idempotente e recusa código desconhecido. O wheel oficial usado nos testes tem SHA-256 `bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f`.

A correção preserva o auth store de origem, relê sob lock antes de consumir o refresh token e usa gravação atômica. Trata tanto singleton quanto pool, inclusive contas combinadas, status de cota, remoção e metadados concorrentes. Um perfil herdado inválido não importa o login do operador para a pasta da tarefa. `CODEX_HOME` permanece vazio no executor.

[Testes offline](../../motor/hermes-vps/testar-patch-hermes-auth.py) usam módulos oficiais e dados sintéticos. Passaram 17 casos, com duas instâncias concorrentes, recuperação, erro OAuth, timeout de transporte e falha de persistência. Uma revisão independente reproduziu as falhas encontradas e confirmou as correções. `hermes --version` e a verificação das dependências também passaram no ambiente isolado Python 3.13.

O harness existente `motor/executor/verificacao_real/test_hermes_real.py --autorizar-hermes-real` passou seus 19 casos com o Hermes corrigido e provedor falso local. O contêiner usou rede externa desabilitada, código e site-packages somente leitura e wrapper para o entrypoint oficial. Isso testa o executável e o adaptador sem usar a conta do fundador; não é teste real do provedor OpenAI.

O instalador executa os testes antes de permitir seguir. `--check` confere ambos os hashes antes de login, conferência e início do motor. A substituição dos dois arquivos não é uma transação única: uma interrupção pode deixar a instalação parcial, que esses portões recusam até ser reparada. Não atualizar uma instalação ativa enquanto houver execução em andamento; conferir o estado real e preparar manutenção antes de recriar o venv.

**Não instalado na VPS.** Isso é um patch local mantido pela Helena, não uma nova versão oficial do Hermes. Ao mudar o pin, revisar novamente a fonte e retirar ou substituir o patch. Testes offline não comprovam autenticação real, consumo de cota ou estabilidade por 48 horas.

## Orientação preservada do diagnóstico

Manter o perfil isolado e o fallback de leitura oficial para o primeiro card.
Não copiar `auth.json` para a pasta da tarefa, não apontar `CODEX_HOME` ao login
do operador e não trocar o pin só para eliminar a falha sem prova.

O diagnóstico apontou a necessidade de corrigir no Hermes a renovação de credenciais herdadas da raiz:
identificar a origem com `_load_provider_state_with_source`, adquirir o lock da
origem antes de reler/renovar, gravar o novo token e a entrada correspondente do
pool no mesmo auth store da raiz com a gravação atômica já existente. Esses caminhos foram implementados e testados pelo patch acima. Uma versão oficial futura com a correção deve ser conferida e testada antes de substituir o pin. A alternativa arquitetural seria um broker de credenciais fora dos perfis; a versão 0.19.0 não oferece essa opção configurável para Codex.

**Limite da prova:** o primeiro card pode autenticar pelo fallback, mas não foi
executado com Hermes/ChatGPT reais. A prova confirma a falha de persistência
quando há renovação; não mede quando um token real expirará nem valida 48 horas
de operação. O critério de 48 horas permanece NÃO COMPROVADO e não é seguro
afirmá-lo apenas com a reprodução ou com o patch local ainda não implantado.
