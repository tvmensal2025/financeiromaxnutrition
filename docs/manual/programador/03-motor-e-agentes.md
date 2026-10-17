# 03 — Motor e agentes: guia do programador

**O que é:** o manual de quem vai cuidar, editar e ajustar a parte da Helena v2 que roda trabalho de verdade: `motor/orquestrador`, `motor/executor`, `motor/validador`, `motor/ferramentas`, `motor/simulador`, `motor/hermes-vps` e a especificação `helena-v2/` (organograma, catálogo de serviços, modelos, fichas dos agentes, validador da especificação). Serve a qualquer IA programadora (Claude, Codex, o agente Theo) e a pessoas. Para cada módulo diz a responsabilidade, as funções que importam, as tabelas e RPCs que usa e quem o chama; depois dá o ciclo de vida de um pedido até o card `PRONTO`, o mapa de testes, receitas de mudança segura, como acrescentar serviço ou agente, como depurar um card parado (só leitura) e as armadilhas já conhecidas.

**Como mudar:** este arquivo é documentação, não fonte. Quando o código mudar, corrija aqui o trecho afetado e a data da conferência (seção 0). Regra de ouro do projeto: **a regra mora num lugar só** (YAML da especificação, tabela de passagens, ou código), então nunca copie uma regra para cá: aponte para o arquivo. Se descobrir que algo aqui diverge do código, o código vale; corrija o texto no mesmo commit da mudança.

---

## 0. Antes de tudo: base desta leitura, legenda e regras de conduta

**Base lida.** Este guia foi escrito em 17/10/2026 lendo o código do commit `09d0047` (branch de trabalho com a fusão de `claude/fervent-pasteur-g821nu`). É **retrato do código**, nunca do banco nem da VPS: não houve consulta ao Supabase, acesso à VPS, chamada ao Hermes ou ao ChatGPT. Código no Git, linha no banco, teste sintético e serviço em execução são evidências diferentes (`AGENTS.md`).

**Legenda.** O que está escrito sem marca foi **confirmado lendo o código ou o arquivo citado**. **NÃO CONFIRMADO** marca o que não deu para provar daqui (produção, VPS, comportamento do Hermes real, comportamento interno de bibliotecas). **Dedução** marca conclusão tirada do código sem teste que a exercite.

**Conduta obrigatória (resumo do `AGENTS.md`; o arquivo manda):**

- Responda em português. Siga a instrução mais recente do fundador.
- Nunca escreva valor de senha, token, chave, secret ou código de recuperação; use só **nomes**, locais e metadados. Este guia só cita nomes de variáveis.
- Banco: confirmar o projeto (`ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou`) antes de consultar; consultas em transação `READ ONLY`; nenhuma alteração sem autorização explícita do fundador. Não aplicar migration, não ativar revisão, não ligar serviço, não rodar o Hermes real sem a frase exata dele.
- `services/`, `scripts/` e `supabase/migrations/` (a v1) têm a proteção da DEC-028; os arquivos de `scripts/` têm chave escrita (DEC-027): não os leia, não os rode, não os copie. A v1 está parada (DEC-032).
- Antes de propor algo novo, procure o que existe e diga `JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE / NÃO CONFIRMADO`. CONNECTED não comprova OPERATIONAL; CONFIGURADA não comprova homologação.
- Marca: **eLiving™** (e minúsculo, L maiúsculo, com ™). Sirlene, Doutor Vital, Alex e Rafael são os pilares do produto, **não** agentes.
- WIP executivo = 1 na esteira autônoma de agentes (seção 15).

**Regra de ouro da arquitetura** (`docs/manual/como-a-fabrica-funciona.md`): **o banco manda, o motor executa, o agente só escreve conteúdo.** O estado do card muda por uma função única do banco (`helena_v2.aplicar_evento`); o motor só dispara eventos e o banco aceita ou recusa; o agente devolve texto e nunca age fora do sistema.

---

## 1. Mapa em uma página

```text
 SITE (src/, Lovable)  ──RPC (JWT do fundador)──►  SUPABASE  esquema helena_v2   (o banco manda)
 Telegram ► Edge helena-v2-telegram ► telegram_inbox ► pedido_entrada            (migrations 0021–0026)
                                                         ▲   ▲
                          lê/escreve só por RPC (SET ROLE service_role) 
                                                         │   │
 VPS, usuário "helena" (instalar-motor.sh), 3 serviços systemd:
   helena-vigia       python -m orquestrador vigiar    --saida /var/log/helena-v2/alarmes.log   (só lê)
   helena-relogio     python -m orquestrador relogio                                              (aplica eventos do papel RELOGIO)
   helena-despachante python -m orquestrador despachar --vagas 1                                  (ÚNICO que chama agente)
        │
        Despachante (despacho.py) ─► Motor (motor.py) ─► DBOS 3.2.0 (workflows duráveis)
                                                   │
                                  ExecutorHermes (executor_helena) ─► `hermes -z …` (Hermes 0.19.0, perfil isolado por execução)
                                                   │                         └─► servidor MCP stdio `ferramentas_helena` (ler_pagina)
                                  validador (portão 1, código puro) ◄── texto do agente
```

**Os pacotes Python e como se enxergam.** Não há instalação em `site-packages`: o motor roda com `PYTHONPATH` apontando para as quatro pastas (na VPS, a linha vem de `motor.env`; no CI, do job):

| Pasta | Pacote(s) importável(is) | Quem importa |
|---|---|---|
| `motor/orquestrador/` | `orquestrador` | é o ponto de entrada (`python -m orquestrador`) |
| `motor/executor/` | `executor_helena` | `orquestrador` (motor, triagem, plano, evidências, vigilância) |
| `motor/validador/` | `validador` (produção) e `spec_helena` (ponte com `helena-v2/`, usa PyYAML) | `orquestrador` (motor, contexto_real, placar) e os testes |
| `motor/ferramentas/` | `ferramentas_helena` | `executor_helena` (monta o comando do servidor) e `orquestrador.evidencias`/`preparacao` (lê as cópias das páginas e valida URLs) |
| `motor/simulador/` | `simulador` | só testes (ensaio da esteira, sem banco) |

Dois ambientes Python **separados** na VPS (nunca no mesmo venv, porque o `hermes-agent` fixa versões que brigam com o DBOS): `venv-motor` (`motor/orquestrador/requirements.txt`: `dbos==3.2.0`, `psycopg[binary]==3.3.6`, `PyYAML`, `jsonschema`, `pytest`) e `venv-hermes` (`motor/executor/requirements-hermes-real.txt`: `hermes-agent[mcp]==0.19.0`).

**Duas entradas de trabalho para o motor** (as duas terminam em `Motor.avancar`):

1. **Pedido v2** (principal, migrations 0021–0026): site ou Telegram ► `pedido_entrada` ► triagem ► proposta ► plano confirmado pelo fundador ► `criar_card_pedido`.
2. **Tarefa real legada** (migrations 0007–0010, comandos `preparar-tarefa-real`/`consumir-pedido-real`): captura somente leitura de `public.tarefas`/`agent_jobs` pela Management API ► solicitação autenticada ► `criar_card_real`. Alimenta o roteiro `recrutar-10-pessoas`.

---

## 2. motor/orquestrador

Código em `motor/orquestrador/orquestrador/` (5.093 linhas em 17 módulos). Execute os comandos a partir de `motor/orquestrador` com `PYTHONPATH=.:../executor:../validador:../ferramentas`. A visão geral oficial está em `motor/orquestrador/README.md`.

### 2.1 Módulo a módulo

Convenções: **Faz** = responsabilidade; **API** = funções/classes que importam; **Banco** = tabelas e RPCs do esquema `helena_v2` (salvo indicação); **Chamado por**.

#### `__main__.py` — o CLI (431 linhas)
- **Faz:** abre o runtime certo para cada comando e delega. Nenhuma regra de negócio mora aqui.
- **API:** `main(argv)`; `_abrir_runtime_real(iniciar_dbos)` (escolhe o adaptador pelo registro do executor, exige as duas URLs e monta `Motor(modo_producao=True)`); `_abrir_banco_service_role(somente_leitura)` (conexão sem Hermes e sem DBOS, usada por vigia, relógio e `validar-configuracoes` real); `_vigiar`, `_relogio`, `_despachar`, `_validar_configuracoes_real`, `_executar_comando_real`, `_conferir_runtime`, `_salvar_preparacao`.
- **Banco:** só indiretamente. Um SQL direto: `helena_v2.ler_solicitacao_card_real` (em `consumir-pedido-real`).
- **Chamado por:** systemd (vigia, relógio, despachante), o operador na VPS (`instalar-motor.sh` chama `conferir-runtime` e `validar-configuracoes`) e `test_cli.py`.
- Comandos e variáveis na seção 2.2.

#### `motor.py` — o Motor e os workflows DBOS (1.303 linhas)
- **Faz:** conduz um card, um passo por chamada de `avancar`: coordenação da Helena, validação do plano, execução do autor, portão 1, revisão, portão 2. Guarda a resposta do agente no banco **antes** de qualquer validação e antes de apagar a pasta da execução. Cada passo durável é um `@DBOS.step`; cada trio vira um `@DBOS.workflow`.
- **API pública:** `Motor(url_banco, url_dbos, …, executor, fonte_contexto, modo_producao, iniciar_dbos)`; `avancar(card_id)`; `criar_card_pedido(pedido_id)` (pedido v2); `criar_card_real(...)` (tarefa legada); `criar_card(...)` (somente teste, exige `permitir_casos_sinteticos`); `processar_configuracoes_pendentes()`; `fechar()`. Internos que você vai ler com frequência: `_evento` / `_evento_de_vista_atrasada` (única porta para `aplicar_evento`), `_entradas_da_etapa`, `_faltas_do_autor_real`, `_roteiro_do_banco`, `_rodar_vigiado`, `_ficha`, `_carregar_revisao`, `_escolher_revisao`, `_conferir_fontes_real`. Funções de módulo: `processar_configuracoes_pendentes(linha)`, `conferir_rubrica`, `_rubrica_bem_formada`, `_preflight_bancos_reais`; classe `EventoRecusado`.
- **Banco (RPCs):** `aplicar_evento`, `criar_card`, `configuracao_ativa`, `ler_configuracao`, `registrar_configuracao_tecnica` (só opt-in local), `listar_validacoes_pendentes`, `registrar_validacao_config`, `registrar_resultado_validacao`, `tabela_confere`, `ler_solicitacao_card_real`, `consumir_solicitacao_card_real`, `conferir_fontes_card_real`, `ler_plano_pedido`, `consumir_plano_pedido`, `obter_chamada_coordenacao`, `registrar_resposta_coordenacao`, `ler_resposta_coordenacao`, `aplicar_resposta_coordenacao`, `registrar_resposta_execucao`, `ler_resposta_execucao`. **Tabelas lidas:** `card`, `etapa`, `execucao`, `entrega`, `historico`, `meta_tabela`.
- **Chamado por:** `__main__` (todos os comandos reais), `despacho.Despachante` (usa `motor._con()` e `motor.avancar`), `triagem_pedido` (usa `motor._linha`, `_carregar_revisao`, `_ficha`, `motor.executor`), e as funções de módulo marcadas `@DBOS.step`, que chamam o `Motor` ativo por `_ativo()`.
- Detalhes da classe e dos workflows na seção 2.3.

#### `despacho.py` — fila com vagas (WIP) (304 linhas)
- **Faz:** escolhe **qual card avança agora** e garante que só há `vagas` cards em voo. Não decide estado de card.
- **API:** `Despachante(motor, vagas, identidade, …)`; `uma_rodada()` (devolve `AVANCOU | OCIOSO | ESPERANDO_VAGA | TETO_DE_VIVAS | COM_ERRO`); `rodar(parar, intervalo_s)`; `fila()`; `adquirir_vaga()`/`liberar_vaga()`; `fechar()`; constantes `ESTADOS_DO_MOTOR = (RASCUNHO, VALIDANDO_PLANO, EM_ANDAMENTO)`, `CHAVE_BASE_PADRAO`.
- **Como funciona:** a vaga é um *advisory lock de sessão* do PostgreSQL (`pg_try_advisory_lock(chave_base + n)`) numa conexão dedicada; se o processo morre, o banco solta a vaga. Cada card em avanço também é reservado por um par de locks. Ordem da fila: `prioridade DESC, prazo ASC, criado_em ASC, id ASC`. Segunda defesa: card **sem** execução viva só começa se há menos de `vagas` outros cards em voo (conta cards, não linhas). Card que dá erro fica de lado 30 s (`ESPERA_APOS_ERRO_S`) para não travar os de prioridade menor. Antes da fila de cards, e só quando nenhum card está em voo, roda `_rodar_entrada_v2`: primeiro converte planos já confirmados (`listar_planos_pedido_pendentes` ► `motor.criar_card_pedido`), depois a triagem (`listar_trabalho_proposta_pedido` ► `triagem_pedido.processar_proposta_pedido`), alternando a vez com os cards.
- **Banco:** `helena_v2.card`, `execucao` (consulta da fila), `listar_planos_pedido_pendentes`, `listar_trabalho_proposta_pedido`; `to_regprocedure` para detectar se a migration 0024 existe (em produção, ausência é erro).
- **Chamado por:** `__main__._despachar`.
- **NÃO COMPROVADO** (diz o próprio módulo): a vaga ser mantida por chamadas de minutos através de proxy/pooler real. Uma conexão ociosa derrubada só é notada no fim do avanço e conta em `vagas_perdidas`.

#### `triagem_pedido.py` — da mensagem à proposta (394 linhas)
- **Faz:** "a IA sugere; catálogo, fontes e prazo decidem". Uma chamada da Helena (coordenação, sem ferramentas) devolve JSON `PERGUNTAR` ou `PROPOR`; o **código** valida e monta o plano fixo.
- **API:** `processar_proposta_pedido(motor, request_id)`; `planejar_plano(resposta, captura, spec, raiz, agora=None)`; `_autor_plano` (monta o pacote com eventos do pedido, `mapa_operacional`, serviços elegíveis, checkpoint, decisões e portfólio; roda `motor.executor.rodar`); exceção `TriagemInvalida`.
- **Regras que o código impõe:** empresa só se citada **literalmente** no pedido e com pacote `CONFIRMADO` no portfólio ativo; serviço só se `escolhivel` e `avulso` em `ESTAGIO/ATIVO`; prazo só com data **e hora** literais (fuso ausente = Brasília), futuro e dentro de 10 anos; `evidencia` (empresa, serviço, prazo, insumos) tem de ser trecho literal do pedido; ambiguidade de empresa/prazo/serviço vira `PERGUNTAR`; `SRV-CALCULO` sem insumos vira perguntas (`Motor._faltas_do_autor_real`); serviço `julgado_pelo_parecer: SEMPRE` ganha E2 `SRV-PARECER` e `meta['bloqueio']='PEDIDO_FONTE_LEIS_AUSENTE'` (a proposta não pode ser confirmada). O orçamento do plano é calculado das fichas e passa por `validar_plano`. Resposta fora do contrato vira pergunta genérica, nunca plano.
- **Banco:** `reservar_proposta_pedido` (lease de 600 s), `registrar_resposta_bruta_pedido` (a resposta bruta é gravada **antes** de validar, para retomar sem segunda chamada de modelo), `registrar_proposta_pedido`.
- **Chamado por:** `despacho.Despachante._rodar_entrada_v2`.

#### `plano.py` — conferência do plano (71 linhas)
- **Faz:** `validar_plano(plano, spec, raiz, permitir_rascunho, exigir_parecer)` devolve `None` ou o motivo em português. Confere: etapas e códigos únicos; serviço existe e está em `ESTAGIO/ATIVO` (ou `RASCUNHO` só com opt-in de teste); dependências existem; entradas têm origem e dependência; **sem ciclo**; orçamento (`orcamento_meta.execucoes >= etapas*2` e `chamadas_total >=` soma das fichas); e, com `exigir_parecer`, toda etapa de serviço `julgado_pelo_parecer: SEMPRE` precisa de uma etapa `SRV-PARECER` que dependa dela.
- **Banco:** nenhum. Constante `RAIZ` = raiz do repositório (usada por vários módulos).
- **Chamado por:** `motor` (`criar_card*`, `avancar` em `VALIDANDO_PLANO`), `triagem_pedido`.

#### `contexto_real.py` — o contexto do portão 1 (121 linhas)
- **Faz:** `montar_contexto_real(spec, servico, *, pedido, fontes_importadas, decisoes, execucao_id, paginas_lidas, usou_internet, hoje)` monta o dicionário que o `validador` exige, **só com dados recebidos** (nunca lê casos, relógio, páginas ou decisões por conta própria) e chama `validador.contexto.conferir_contexto`. O `modelo` vem de `spec_helena.modelo.montar_modelo` (tipo de entrega, seções, ações permitidas, etc.).
- **Banco:** nenhum.
- **Chamado por:** o `Motor` (injetado como `fonte_contexto`; em produção o construtor **exige** `fonte_contexto is montar_contexto_real`).

#### `evidencias.py` — provas locais (158 linhas)
- **Faz:** `coletar_evidencias(resultado, execucao_id)` lê o que o servidor de ferramentas **realmente entregou** ao agente (pasta `ferramentas/`: `estado.json`, `registro.jsonl`, `leituras/LEI-nnn.*`), confere hash/URL/parte de cada página contra a cópia guardada, recusa links simbólicos, tamanhos absurdos e provas de outra execução (`EvidenciaInvalida`), e devolve `paginas_lidas`, `usou_internet`, `conversa` e `uso`. Sem chamada HTTP.
- **Chamado por:** `motor.executar_e_salvar`, `executar_e_salvar_revisao`, `executar_e_salvar_coordenacao`.

#### `configuracao.py` — o pacote de configuração (296 linhas)
- **Faz:** transforma `helena-v2/` em um **bundle** de dados (nunca código), confere forma e limites, calcula hash e valida contra o código. Detalhes da esteira na seção 8.3.
- **API:** `capturar_bundle(raiz)`, `hash_bundle`, `impressao_maquina`, `materializar_bundle`, `carregar_revisao(bundle, hash, destino)` ► `(Spec, raiz)`, `verificar_revisao`, `validar_bundle(bundle, raiz_maquina)`; constantes `OBRIGATORIOS`, `MAQUINA`, `SCHEMAS`, limites (`MAX_DOCUMENTOS=400`, `MAX_DOCUMENTO_BYTES=512_000`, `MAX_BUNDLE_BYTES=8_000_000`, `MAX_PROFUNDIDADE=64`).
- **Banco:** nenhum (quem fala com o banco é o `Motor`).
- **Chamado por:** `motor` (`_carregar_revisao`, `_configuracao_tecnica`, `_preflight_bancos_reais`, `processar_configuracoes_pendentes`), `instalacao.gerar_instalacao`.

#### `bancos.py` — portões das conexões reais (216 linhas)
- **Faz:** sem abrir conexão nenhuma, recusa destino e papel errados. `validar_destinos_reais(url_banco, url_dbos)` aceita **só** `postgresql[+psycopg]://usuario:senha@host:5432/postgres?sslmode=verify-full` (um único parâmetro de consulta, host em minúsculas), host `db.<ref>.supabase.co` ou `*.pooler.supabase.com` (neste caso o usuário é `papel.<ref>`), papel não administrativo, e **nenhuma** variável `PG*` de override no ambiente. `parametros_conexao_real()` exige o arquivo de CA do sistema legível (`ssl.get_default_verify_paths().cafile`). `preflight_papel_runtime(con, sistema=False)` consulta `pg_roles` e recusa superusuário, `bypassrls`, dono do esquema, qualquer caminho indireto a papel administrativo, e confere o vínculo `service_role` (`SET` sim, `INHERIT` não, `ADMIN` não) para a conta do aplicativo e a **ausência** dele para a conta do DBOS.
- **Chamado por:** `motor` (`_preflight_bancos_reais`, `_con`, `_execucao_ainda_atual`), `__main__._abrir_banco_service_role`, e `instalar-motor.sh` (`testar-banco`, `ligar-motor`).

#### `vigilancia.py` — o vigia (339 linhas)
- **Faz:** uma volta = coletar alarmes (só `SELECT`) e avisar por todos os canais. Alarmes: `REGRA_<n>` (da função `vigia()` do banco, as 13 regras de ferro), `RELOGIO_ATRASADO` (prazo vencido há mais de 600 s sem o relógio agir), `EXECUCAO_PARADA` (execução `VIVA` há mais de 3.600 s), `CARD_PARADO` (`EM_ANDAMENTO` sem evento há 6 h e sem esperar o fundador), `PUBLICACAO_PARADA`, `VIGIA_SEM_BANCO`. O mesmo alarme só repete depois de 3.600 s; alarme que some e volta é novo. Todo texto passa por `limpar_texto` (tira padrões de segredo de `executor_helena.segredos.PADROES_DE_VALOR`).
- **API:** `Vigia(conexao, canais).uma_volta()/rodar()`, `coletar_alarmes(con)`, `coletar_metricas(con)` (execuções por tipo/estado, tempo médio, recusas em 24 h, cards por estado, **tokens em 24 h** lidos de `uso.tokens_total` nas respostas gravadas), `Notificador` (contrato), `NotificadorDeArquivo`, `NotificadorHttp` (webhook HTTPS, URL só na variável `HELENA_V2_ALARME_WEBHOOK_URL`; sem redirecionamento; `http://` só para teste local), `NotificadorFalso`, `limpar_texto`, `Alarme`.
- **Banco:** `helena_v2.vigia()`, `card`, `etapa`, `acao_externa`, `estado_def`, `execucao`, `historico`, `publicacoes` (se existir), `ler_resposta_execucao`, `ler_resposta_coordenacao`.
- **Chamado por:** `__main__._vigiar`; `publicacao.py` importa `Alarme`/`ALTA`/`limpar_texto` daqui.
- **NÃO COMPROVADO:** canal realmente independente do servidor da v2 (celular/serviço externo). Em produção o canal ativo é um **arquivo local** (`/var/log/helena-v2/alarmes.log`); o webhook só liga com `--canal-webhook`, que a unidade systemd não passa.

#### `relogio.py` — o relógio dos prazos (102 linhas)
- **Faz:** uma volta lê `helena_v2.eventos_devidos(agora)` (o **banco** decide o que venceu, migration 0017) e aplica cada evento como papel `RELOGIO` por `aplicar_evento(..., p_nao_disparar => '{PLANO_VALIDO}')`, pulando o que deixou de estar devido no meio da volta. Nunca aprova nada por tempo. Contagens: `devidos/aplicados/recusados/obsoletos`.
- **API:** `Relogio(conexao, aplicar).uma_volta(agora=None)`, `aplicador_do_banco(conexao)`, `EventoDevido`, `ResumoDaVolta`.
- **Chamado por:** `__main__._relogio`.

#### `publicacao.py` — a porta de publicação e um destino falso (151 linhas)
- **Faz:** `Publicador(conexao, destino).uma_volta()` reivindica o pedido `PEDIDA` mais antigo, chama o destino **uma vez** e registra `PUBLICADA` ou `FALHOU`. `alarmes_de_publicacao(con)` gera `PUBLICACAO_PARADA` para pedido `EM_EXECUCAO` há mais de 900 s.
- **Banco:** `reivindicar_publicacao`, `concluir_publicacao`, `falhar_publicacao`, `publicacoes`.
- **Chamado por:** só `vigilancia.coletar_alarmes` (importação tardia, para os alarmes) e os testes. **Nenhum comando nem serviço roda o `Publicador`**, e **não existe destino real** (o fundador ainda precisa definir o que é "publicar"). `DestinoFalso` marca `PUBLICADA` sem publicar nada: nunca o ligue num banco real.

#### `fonte_supabase.py` — captura somente leitura (294 linhas)
- **Faz:** `FonteSupabase().carregar_tarefa(task_id, plano)` lê, pela Management API (`POST /v1/projects/<ref>/database/query`, transação `REPEATABLE READ, READ ONLY`, consulta em lista fechada), o checkpoint mestre ativo, a tarefa, as decisões vigentes e os `agent_jobs` aprovados citados pelo roteiro; confere a identidade do projeto e a revisão documental de cada insumo; devolve uma observação com `proveniencia` e hashes. Sem `SUPABASE_ACCESS_TOKEN` responde `SUPABASE NÃO CONECTADO — não é possível carregar o Sistema Helena com segurança.`
- **Chamado por:** `__main__ preparar-tarefa-real`. Não autoriza card nem executa job.

#### `preparacao.py` — a tarefa observada (213 linhas)
- **Faz:** `preparar_tarefa_real(captura, plano)` transforma a captura em dados reais com `estado: AGUARDANDO_CONFIRMACAO`, listando as pendências (pacote da empresa, prazo, critérios, restrições, solicitação autenticada); nunca inventa prazo, canal ou lei. `confirmar_preparacao(...)` aplica as escolhas do fundador sem alterar um fato observado.
- **Chamado por:** `__main__` (a primeira); `confirmar_preparacao` só é chamada por testes (a confirmação real é a RPC autenticada `solicitar_card_real`).

#### `mapa_operacional.py` — a orientação da triagem (180 linhas)
- **Faz:** `montar_mapa_operacional(captura)` produz o mapa curto (rotas do site, fontes de dados, empresas operacionais, serviços, fluxo, regras) que entra no pacote da triagem. A tabela `ROTAS` é um manifesto de código: **atualize-a junto com `src/App.tsx`**. Orienta; não concede permissão.
- **Chamado por:** `triagem_pedido._autor_plano`.

#### `instalacao.py` — o roteiro de instalação para revisão (182 linhas)
- **Faz:** `gerar_instalacao(pasta)` escreve, fora de qualquer repositório Git e sem tocar em banco algum, `01_instalar_v2.sql` (todas as migrations numa transação), `02_base_tecnica.sql`, `03_conferir_depois.sql`, `LEIA-ANTES.md` e `manifesto.json` com hashes e a **frase exata** de autorização do fundador. Recusa migrations fora de sequência ou com `BEGIN/COMMIT`/`CREATE ROLE`.
- **Chamado por:** `__main__ gerar-instalacao`; `test_instalacao.py` aplica os mesmos arquivos num PostgreSQL local.

#### `placar_revisor.py` — o teste 9 do plano (337 linhas)
- **Faz:** mede o **julgamento** de um revisor: `pontuar(revisor, casos)` contra 30 entregas com defeito plantado (7 tipos de defeito) e 10 limpas, todas tiradas de `helena-v2/casos/`. Regra: achar pelo menos 90% dos defeitos (27/30) e recusar no máximo 20% das limpas (2/10). `carregar_casos()` falha alto se um caso sumiu ou deixou de ser "só o revisor pega". Ao ligar um revisor real, passe só `caso.para_o_revisor()` (sem id, tipo ou gabarito).
- **Chamado por:** **nenhum código de produção**; só `test_placar_revisor.py` (com revisores de mentira).

### 2.2 Os comandos do CLI (`python -m orquestrador <comando>`)

| Comando | Variáveis exigidas (nomes) | O que faz | Efeito |
|---|---|---|---|
| `conferir-runtime` | nenhuma | ficha de conexão de cada runtime conhecido (nomes, garantias que faltam) | só leitura, sem rede |
| `gerar-instalacao --saida PASTA` | nenhuma | gera o roteiro SQL para revisão | escreve arquivos; não conecta |
| `preparar-tarefa-real --tarefa ID --roteiro R [--saida CAMINHO]` | `SUPABASE_ACCESS_TOKEN` | captura somente leitura e prepara | arquivo privado fora do Git (0600, `O_EXCL`) |
| `validar-configuracoes` | real: `HELENA_V2_DATABASE_URL`; local: `HELENA_V2_CONFIG_DATABASE_URL` + `HELENA_V2_DBOS_SYSTEM_DATABASE_URL` | dá o veredito do motor aos rascunhos que o fundador mandou validar | grava `VALIDADA` ou o motivo; **nunca ativa** |
| `registrar-base-tecnica` | as duas locais acima | cadastra a base técnica de teste | só banco local |
| `consumir-pedido-real --solicitacao UUID` | `HELENA_V2_DATABASE_URL`, `HELENA_V2_DBOS_SYSTEM_DATABASE_URL`, `HELENA_V2_HERMES_BIN`, `HELENA_V2_HERMES_HOME`, `HELENA_V2_EXECUCOES_DIR` | cria o card da tarefa legada (idempotente) | cria card; 0 agentes |
| `consumir-entrada-v2 --pedido UUID` | as cinco acima | cria o card de um pedido v2 com plano já confirmado | cria card; 0 agentes |
| `avancar-card-real --card UUID` | as cinco acima | confere fontes e vigência, **inicia o DBOS** e pede **um** avanço | pode chamar o agente (gasta cota); nunca confirma pelo fundador |
| `vigiar --saida ARQ [--uma-volta] [--intervalo 300] [--canal-webhook]` | `HELENA_V2_DATABASE_URL` (+ `HELENA_V2_ALARME_WEBHOOK_URL` com o webhook) | o vigia | só lê |
| `relogio [--uma-volta] [--intervalo 60]` | `HELENA_V2_DATABASE_URL` | o relógio | aplica eventos do papel RELOGIO |
| `despachar [--vagas 1..64] [--uma-rodada] [--intervalo 5]` | as cinco | o despachante | **chama o Hermes de verdade** |

Atenção: iniciar o DBOS (`avancar-card-real`, `despachar`) também pode **retomar workflows pendentes da mesma aplicação**; não existe filtro por card. O escolhido de runtime é `HELENA_V2_EXECUTOR` (vazio = `hermes`).

### 2.3 A classe Motor e os workflows DBOS

**Construção.** `Motor(..., modo_producao=True)` só aceita: executor real que seja de uma classe em `executor_helena.registro.APROVADOS`, com todas as `Capacidades`; `fonte_contexto is montar_contexto_real`; e **nenhuma** das opções de teste (`permitir_configuracao_tecnica`, `permitir_servico_rascunho`, `permitir_executor_falso`, `permitir_casos_sinteticos`, `casos`). Depois roda `_preflight_bancos_reais` (papéis, `tabela_confere()`, impressão da máquina igual à do checkout, **configuração ativa e `VALIDADA`**). A configuração do DBOS usa `run_migrations=False` e `dbos_system_schema='dbos_helena_v2'`: o esquema do DBOS precisa existir antes (`supabase/migrations-v2/producao/02_esquema_dbos.sql`). Fora de produção o motor recusa banco que não seja local e exige bancos distintos para o card e para o DBOS.

**Versão do código.** `VERSAO_CODIGO = 'primeiro-card-2-config'` (teste) e `VERSAO_CODIGO_REAL = 'primeiro-card-3-real'` viram o `application_version` do DBOS e entram nos identificadores dos workflows. Mudar essas constantes muda a identidade dos workflows; há testes de "cinco trocas de versão no meio do card" em `test_durabilidade.py`. O que o DBOS faz com workflows pendentes de outra versão em produção é **NÃO CONFIRMADO** aqui.

**Workflows (todos em `motor.py`):**

| Workflow DBOS | Passos (`@DBOS.step`) | Quando | Identificador |
|---|---|---|---|
| `ler_de_volta_v1` | `executar_e_salvar_coordenacao` ► `conferir_e_aplicar_coordenacao` | card em `RASCUNHO` | `<versão>-<revisão>-coordenacao-<card>-<chave>` |
| `executar_etapa_v1` | `executar_e_salvar` ► `conferir_e_aplicar` | etapa `EXECUTANDO` | `<versão>-<revisão>-<etapa>-<número da execução>` |
| `revisar_etapa_v1` | `executar_e_salvar_revisao` ► `conferir_e_aplicar_revisao` | etapa `REVISAO` | idem, com o número da execução do revisor |

O identificador fixo faz uma segunda chamada devolver o resultado já registrado em vez de repetir o agente. A janela que o DBOS **não** cobre: a queda entre o retorno do provedor e a gravação em `registrar_resposta_*`, que pode repetir a chamada externa (README do orquestrador).

**`Motor.avancar(card_id)`**, um passo por chamada, devolve `True` se avançou:

1. `RASCUNHO` ► `obter_chamada_coordenacao` ► workflow `ler_de_volta_v1`.
2. `VALIDANDO_PLANO` ► `plano.validar_plano` ► evento `PLANO_VALIDO` ou `PLANO_INVALIDO` (só o motor o emite; a migration 0020 impede o disparo automático).
3. `EM_ANDAMENTO` ► percorre as etapas atuais e age na primeira que pede o motor: `AGUARDANDO_ANTERIORES` ► `DEPENDENCIAS_PRONTAS`; `NA_FILA` ► `INICIAR_EXECUCAO`; `EXECUTANDO` ► `executar_etapa`; `REVISAO` ► `_revisar` (`INICIAR_REVISAO` + workflow).
4. Qualquer outro estado (`ESPERANDO_CONFIRMACAO`, `ESPERANDO_FUNDADOR`, finais) ► `False`: quem age é o fundador ou o relógio.

**Proteções em volta do agente.** `_rodar_vigiado` roda o executor e, numa thread, repete a cada 1 s (0,2 s depois de invalidar) a pergunta "esta execução ainda é a atual?" (`_execucao_ainda_atual`: card em `RASCUNHO` com `chamada_helena = chave` e execução `VIVA` tipo `HELENA`, ou etapa com `execucao_atual = chave`); se o banco retirou a posse (ou ficou indisponível) chama `executor.cancelar` e a resposta tardia é descartada. Eventos decididos sobre uma "foto" atrasada usam `_evento_de_vista_atrasada`: `SEM_PASSAGEM_NESTE_ESTADO` vira `False` (próxima rodada olha de novo), qualquer outra recusa é erro. Em modo real, os eventos de avanço e a aplicação dos portões 1 e 2 rodam **na mesma transação** de `conferir_fontes_card_real` (parâmetro `card_id_real`); alguns eventos de falha do motor (por exemplo `FALHA` depois do executor) não passam por essa guarda.

### 2.4 Os portões, na ordem em que o motor os aplica

1. **Insumos do autor** (`_faltas_do_autor_real`, só `SRV-CALCULO` e `SRV-PARECER`): faltou pacote da empresa rastreável, pedido original como fonte, valores monetários/período/cotação (cálculo) ou peças julgadas íntegras e **tabela de leis publicada com `FON-LEIS-v<n>`** (parecer) ► o motor registra `REGISTRAR_FALHA` com `FALTAM_DADOS` e conteúdo `INSUMOS_INSUFICIENTES` **sem chamar o agente** (a etapa vai a `EM_RESOLUCAO`).
2. **Executor** (seção 3): falha de execução vira `FALHA` do papel `MOTOR` com a classe lida do registro.
3. **Evidências** (`coletar_evidencias`): prova inválida ► `FALHA` `EVIDENCIA_INVALIDA`; internet não informada ► `INTERNET_NAO_COMPROVADA`.
4. **Portão 1** (`conferir_e_aplicar` ► `validador.validar`): ação `PERGUNTAR`/`REGISTRAR_FALHA`/`DEVOLVER_A_QUEM_PEDIU` fora do formato ► `FALHA` `FORMATO_ERRADO`; `ENTREGAR` é gravado e então `PORTAO1_OK` (escolhe o primeiro dos `revisores_validos`) ou `PORTAO1_RECUSOU` com o relatório.
5. **Portão 2** (`conferir_e_aplicar_revisao`): a rubrica do tipo de entrega tem de vir **completa**, cada critério uma vez, com `resultado` e `prova` não vazia; resposta malformada ► `FALHA` `FORMATO_ERRADO` (`RUBRICA_INVALIDA`); se algum critério não for `PASSOU` o motor **levanta erro** (não emite `REPROVAR`; limite conhecido, seção 15); se todos passam ► `APROVAR` do revisor.
6. **Segundo revisor humano:** peça julgada pelo Parecer só vale com o `APROVAR` do fundador (passagem E74/E81 da tabela).

### 2.5 Como mudar o orquestrador com segurança

- Qualquer mudança em `motor.py`, `despacho.py`, `bancos.py` ou `__main__.py`: rode **todo** `motor/orquestrador` (PostgreSQL local; seção 11), não só o teste do arquivo. Os três grupos do CI existem porque `test_durabilidade.py` e `test_despacho.py` levam minutos.
- Mudança de comportamento do **estado do card** não se faz aqui: muda `helena-v2/maquina/passagens.yaml`, gera o SQL e prova (seção 12). O motor só dispara eventos.
- Novo evento do motor: ele precisa existir na tabela de passagens para o papel `MOTOR`; senão o banco responde `SEM_PASSAGEM_NESTE_ESTADO` ou recusa.
- Nunca relaxe `validar_destinos_reais`/`preflight_papel_runtime` "para a conexão funcionar". Se a conexão falha, o problema é URL, CA ou papel (seção 15, item 1).
- Troca de runtime do agente: não mexa no motor; escreva um adaptador (seção 3.5).

---

## 3. motor/executor (o adaptador do Hermes, falhas e uso)

Pacote `executor_helena` em `motor/executor/executor_helena/`; guia oficial em `motor/executor/README.md`. **O executor roda UM agente por vez, numa pasta limpa, e devolve sempre um `Resultado`. Não grava em banco nenhum e não decide estado, destino nem liberação.** O motor só enxerga a interface `Executor` (`rodar`, `cancelar`, `limpar`, `capacidades`).

### 3.1 O que `ExecutorHermes.rodar(execucao)` faz, em ordem

1. **Ficha ► perfil.** `ficha.ler_ficha` + `perfil.gerar_perfil` criam duas pastas novas: `<raiz_hermes>/profiles/exec-<id>/` (o `HERMES_HOME` da execução, com `config.yaml` e `SOUL.md` gerados da ficha) e `<pasta_das_execucoes>/<id>/` (`trabalho/` vazia, `home/` vazio, `codex_vazio/`, `tmp/`, `ferramentas/`, `uso.json`, `saida.txt`, `erros.txt`, `processo.json`). Recusa: pacote com cara de segredo (`segredos_no_texto`), pasta dentro de um repositório Git, `id` repetido, ficha com ferramenta sem `fontes_permitidas`.
2. **Gabarito.** `conferencia.antes_de_lancar` lê o `config.yaml` **do disco** e o confere (`gabarito.violacoes_do_perfil`): memória, perfil do usuário, revisão em segundo plano, curadoria, título automático, resumo automático e instalação sozinha **desligados**; `agent.api_max_retries = 1`; `fallback_providers = []` e nenhuma chave com "fallback" no nome; `toolsets` = só `ferramentas_helena`; lista de ferramentas por extenso (lista vazia = servidor vazio); `sampling` desligado; espera de partida >= 45 s. Perfil fora do gabarito levanta `ErroDePerfil` e **não roda**.
3. **Ambiente do zero.** `ambiente.construir_ambiente` monta o ambiente do processo sem copiar o do motor: `HOME`, `HERMES_HOME`, `TMPDIR`, `PATH` seguro, `CODEX_HOME` apontando para uma pasta **vazia**, `HERMES_DISABLE_LAZY_INSTALLS`, `HERMES_STREAM_RETRIES=0`, `HERMES_NONINTERACTIVE`, fuso `America/Sao_Paulo` e a marca `HELENA_EXECUCAO=<id>` (usada para achar processos que sobrarem). Qualquer `extras` passa pelo detector de segredos.
4. **Lançamento.** `perfil.montar_comando`: `hermes -z <pacote> --model <M> --provider <P> --toolsets ferramentas_helena --usage-file <uso.json>` (o `--toolsets` vai sempre, porque lista vazia no Hermes liberaria tudo). `processo.executar` lança em grupo de processos próprio, `stdin` fechado, saída em **arquivos**, vigia tempo, cancelamento e limite de chamadas, e ao fim `arvore.encerrar_tudo` mata a árvore por três caminhos (grupo/sessão, descendentes, marca no ambiente) com SIGTERM e depois SIGKILL em até 15 s. `processo.json` permite a `matar_sobras` limpar o que uma vida anterior deixou.
5. **Leitura dos registros** (nunca do texto do agente): `uso.json`, `sessions/request_dump_*.json`, `state.db` (SQLite, somente leitura) e `estado.json` do servidor de ferramentas (seção 3.4).
6. **Conferência pós-execução** (`conferencia.conferir_depois`): ferramentas recebidas = ferramentas da ficha; modelo e provedor do registro = os da ficha; nenhum segredo no ambiente nem nas pastas; `config.yaml`/`SOUL.md` iguais aos gerados; prompt de sistema traz o `SOUL.md` e nenhum "# Project Context"; pasta de trabalho vazia, memória sem escrita, nenhum processo sobrando.
7. **Decisão** (`decisao.decidir`, a mesma do executor falso): `terminou_inteira` só se `completed=true`, `failed=false`, código 0, ninguém encerrou e o texto impresso **é** a última mensagem do agente na sessão. O `texto` só é entregue nessas condições (ou com falha apenas de formato). Problema de conferência de classe `DESCONHECIDA` vence a falha lida.

`limpar(resultado)` apaga as duas pastas — e o motor só a chama **depois** de gravar a resposta, a conversa e as evidências no banco.

### 3.2 Arquivos do pacote

| Arquivo | Responsabilidade |
|---|---|
| `executor.py` | interface `Executor`, `ExecutorHermes`, `VigiaDeLimite` |
| `tipos.py` | dataclasses: `FichaDoServico`, `Orcamento`, `Execucao`, `Resultado`, `Falha`, `RegistroDeUso`, `Capacidades`; as 10 classes de falha; erros `ErroDeFicha`, `ErroDePerfil` |
| `ficha.py` | `ler_ficha(caminho, caminho_dos_modelos, fase_em_curso, papel, servico, evento)`; `ler_modelos` |
| `perfil.py` | `ConfigDoExecutor`, `gerar_perfil`, `montar_config`, `montar_comando`, `montar_instrucoes` (o `SOUL.md`), `limite_de_chamadas_vistas` |
| `gabarito.py` | `violacoes_do_perfil` (a lista do que o `config.yaml` tem de dizer) |
| `ambiente.py` | `construir_ambiente`, `MARCADOR = "HELENA_EXECUCAO"` |
| `processo.py`, `arvore.py` | lançar/vigiar/encerrar; `/proc` para achar e matar a árvore; `matar_sobras` |
| `uso.py` | leitura dos registros do Hermes e montagem do `RegistroDeUso` |
| `falha.py` | `Evidencias` e `classificar_falha` |
| `decisao.py` | `decidir`, `terminou_inteira` |
| `conferencia.py` | `antes_de_lancar`, `conferir_depois`, `conferir_ferramentas`, `conferir_modelo_e_provedor` |
| `segredos.py` | detector: `nome_parece_segredo`, `segredos_no_texto`, `segredos_no_ambiente`, `segredos_na_pasta`, `PADROES_DE_VALOR` (usado também pelo vigia) |
| `registro.py` | `APROVADOS`, `EM_HOMOLOGACAO`, `adaptador_configurado`, `montar_executor`, `fichas_de_conexao`, `conferir_registro` |
| `adaptador_openclaw.py`, `adaptador_eve.py` | adaptadores **em homologação** (nunca produção) |
| `adaptador_modelo.py` | molde que **falha fechado** (`AdaptadorNaoConfirmado`); nunca entra no registro |
| `executor_falso.py`, `provedor_falso.py`, `hermes_falso.py`, `runtime_alternativo.py`, `eve_falso.py`, `openclaw_falso.py` | falsos de teste (seção 3.6) |

### 3.3 Falhas: as 10 classes e como são lidas

O nome das classes é o de `helena-v2/maquina/vocabulario.yaml` (`classes_de_falha`); `tipos.GASTA_TENTATIVA` repete o campo `gasta_tentativa` de lá e um teste confere. **Regra de ouro (`falha.py`): a falha é lida de registros e códigos de saída, nunca do texto do agente.** O módulo nem recebe o texto.

| Classe | Gasta tentativa | Como é decidida (primeira regra que se aplica) |
|---|---|---|
| `TEMPO` | sim | o executor encerrou por tempo (`TEMPO_ESGOTADO`) |
| `LIMITE_CHAMADAS` | sim | o executor/servidor encerrou por limite, ou laço de voltas/ferramenta inexistente pedida de novo/mais resultados de ferramenta que o teto do vigia |
| `QUEDA` | não | morto por sinal que não foi nosso; sem código de saída; saída vazia com código 2 e sem erro gravado (corte no meio da resposta) |
| `LOGIN` | não | `request_dump` com HTTP 401 ou código `token_expired`, `invalid_api_key`, `invalid_token`, `authentication_error`, `account_deactivated`, `invalid_authentication`, `unauthorized` |
| `COTA` | não | HTTP 402/429 ou código/tipo `rate_limit_exceeded`, `insufficient_quota`, `usage_limit_reached`, `quota_exceeded`, `billing_*`; `voltar_em_s` vem de `resets_in_seconds` quando o provedor informa |
| `PROVEDOR` | não | HTTP 408/500/502/503/504/529 ou tipos `server_error`, `overloaded_error`, `APIConnectionError`, `ReadTimeout`… ; também modelo/provedor do registro diferentes da ficha |
| `FERRAMENTA` | não | ferramentas recebidas diferentes das da ficha; servidor de ferramentas sem registro |
| `GRANDE_DEMAIS` | sim | HTTP 413/`context_length_exceeded`; `finish_reason` = `length`; frase do próprio Hermes "Context overflow and auto-compaction is disabled" (só aceita com `failed=true` e sem mensagem do agente na sessão) |
| `FORMATO_ERRADO` | sim | resposta do modelo vazia (`(empty)`); ou o `verificador_de_formato` da execução recusou |
| `DESCONHECIDA` | sim | tudo que não bate numa regra conhecida: **nunca chuta** (`SEM_REGISTRO_DE_USO`, `FALHA_SEM_ERRO_REGISTRADO`, `EXECUCAO_INCOMPLETA`, `SAIDA_DIFERENTE_DA_SESSAO`…); qualquer violação do gabarito/conferência |

`BANCO` e `SITE` existem no vocabulário, mas não saem do executor. Quem trata as classes de forma diferente (cota não gasta tentativa; aviso em 1 h e escolha em 6 h) é a **máquina de passagens** (`TETO_INFRA`, `TETO_AVISO_ESPERA`), não o executor.

### 3.4 Uso (`usage`): de onde vêm os números

`uso.montar_registro_de_uso(uso.json, estado.json)` junta o que o Hermes disse com o que o **nosso** servidor contou, e cada campo anota a origem em `RegistroDeUso.origem`:

| Campo | Origem |
|---|---|
| `modelo`, `provedor`, `completo`, `falhou`, `id_da_sessao` | `uso.json` do Hermes (`model`, `provider`, `completed`, `failed`, `session_id`) |
| `chamadas_ao_modelo`, `tokens_entrada`, `tokens_saida`, `tokens_total` | `uso.json` (`api_calls`, `input_tokens`, `output_tokens`, `total_tokens`) |
| `chamadas_de_ferramenta`, `usou_internet` | `estado.json` do servidor de ferramentas (`contadores.total`, `usou_internet`) |

Esse registro vai para o banco dentro da resposta da execução (`registrar_resposta_execucao`, chaves `uso` e `conversa`) e o **vigia** soma `tokens_total` das últimas 24 h. Não existe contador nem limite diário de cota no código: `models.yaml` deixa `cota.orcamento_diario_v2.valor: null` e escreve "o motor não liga em produção com valor nulo", mas a busca por `orcamento_diario` no código do orquestrador e do executor não acha nenhuma ocorrência, então essa regra hoje é só texto da especificação. Medição reconciliada por tarefa continua NÃO COMPROVADA.

`uso.exportar_conversa` copia a conversa da sessão do SQLite (até `guardar_conversa_ate_bytes`, 2 MB) para o motor guardar antes da limpeza. Sessão ilegível ► `()`/`None` e a falha cai em `DESCONHECIDA`.

> As leituras foram escritas contra o **hermes-agent 0.19.0** (esquema do `state.db` e do `request_dump` conferidos em execuções reais, segundo o README). Se uma versão nova mudar o formato, a leitura devolve `None` e a execução vira `DESCONHECIDA`. Por isso o pin `hermes-agent==0.19.0` não se troca "só para ver".

### 3.5 Registro de executores e como adicionar um novo

`HELENA_V2_EXECUTOR` (vazio = `hermes`) escolhe o adaptador em `registro.APROVADOS` (hoje só `hermes`, exigindo `HELENA_V2_HERMES_BIN`, `HELENA_V2_HERMES_HOME`, `HELENA_V2_EXECUCOES_DIR`). `EM_HOMOLOGACAO` guarda `openclaw` e `eve`: o motor de produção **recusa** a partida com eles e `conferir-runtime` mostra o que falta. Não há plugin por YAML: a lista mora no código. Receita completa em `motor/executor/README.md` ("Como adicionar um executor novo") e `docs/manual/conectar-runtimes.md`: ler a documentação oficial atual do runtime; classe com `rodar`/`cancelar`/`limpar`/`capacidades` que traduz o registro **nativo** em `Evidencias` e reusa `decisao.decidir`; declarar todas as `Capacidades` (lista exata de ferramentas, modelo/provedor conferidos, sem reserva escondida, limite de chamadas, falha do registro, conversa devolvida, cancelar em até 15 s); passar em `testes/test_conformidade.py`; só então mover para `APROVADOS` por revisão e depois do "dia de prova" com a frase do fundador.

### 3.6 Falsos de teste (como os testes rodam sem gastar cota)

`hermes_falso.py` imita só o que importa do `hermes -z` 0.19.0 (cada comportamento foi copiado de execuções reais); `provedor_falso.py` é um servidor HTTP local com cenários (`Simulacao`: boa, erro 429, 401, queda, laço…); `executor_falso.py` cumpre o contrato sem processo e passa pela **mesma** `falha.classificar_falha` e `decisao.decidir`; `runtime_alternativo.py` é um segundo runtime só de teste (prova que o motor não depende do Hermes). `motor/executor/verificacao_real/` reexecuta 19 cenários com o `hermes` real e provedor falso local e é bloqueada sem `--autorizar-hermes-real` (a frase do fundador).

### 3.7 Como mudar o executor com segurança

| Quero… | Mude | Cuidado |
|---|---|---|
| trocar o modelo de um agente | uma linha de apelido em `helena-v2/models.yaml` | `test_troca_de_modelo.py`; apelido tem **um** papel (`papel_do_apelido`); sem reserva |
| mudar missão/limite/ferramenta | a ficha `helena-v2/agents/<nome>.yaml` | só ferramentas `ler_pagina` e `buscar`, só efeito `LER`; `chamadas_total >= buscas + partes_de_pagina + 1` |
| mudar uma trava do perfil | `gabarito.py` **e** `perfil.montar_config` juntos | o gabarito confere o arquivo do disco antes e depois; rode `test_gabarito.py`, `test_perfil.py`, `test_mutacoes.py` |
| classificar uma falha nova | `falha.py` (e a classe em `vocabulario.yaml` se for nova) | sempre por registro; nunca por texto; `test_falha.py`, `test_vocabulario.py` |
| aceitar um Hermes novo | `requirements-hermes-real.txt`, `patch-hermes-auth.py` (hashes) e `uso.py` | revisar a fonte nova; refazer o patch ou retirá-lo (seção 7.4) |

---

## 4. motor/validador (o portão 1: código puro, sem IA e sem rede)

Pacotes `validador` (produção, **só a biblioteca padrão**) e `spec_helena` (ponte com `helena-v2/`, usa PyYAML; fora do caminho de produção das checagens). README completo em `motor/validador/README.md`.

**Contrato.** `validador.validar(resposta, contexto)` recebe o **texto** que o agente devolveu (assim "duas ações" ou "texto fora do JSON" são vistos) e o contexto montado pelo motor, e devolve um `Relatorio` com `veredito` (`APROVADA`, `APROVADA_COM_MARCAS`, `RECUSADA`), `recusas` (voltam ao autor com o item exato), `marcas` (seguem com aviso) e `premissas`. **Falha fechada:** uma checagem que quebra por causa de uma entrega estranha **recusa** (`ERRO_INTERNO_DA_CHECAGEM`); só contexto malformado (`ErroDeContexto`) levanta exceção. Entrega com mais de 300 mil caracteres só roda formato e tamanho.

**Módulos de núcleo.** `nucleo.py` (`validar`), `registro.py` (`@checagem(id, nome, o_que_fecha, furos, gravidade)`, `CHECAGENS`, `CONFIG`, `gravidade_de`), `contexto.py` (`conferir_contexto`; opção de `modelo.validador` com nome errado para tudo), `execucao.py` (interpreta a resposta: ação única, JSON, itens), `resultado.py` (`Falha`, `Relatorio`), `expressao.py` (avaliador seguro de fórmulas, sem `eval`), `texto.py`, `numeros.py`, `enderecos.py`, `cli.py`.

**Checagens** (`validador/checagens/`, achadas sozinhas por importação — um erro de sintaxe ali derruba o validador inteiro, de propósito):

- Comuns e antigas: `acao`, `acao_externa`, `secoes`, `texto_puro`, `idioma`, `marca` (grafia eLiving™), `links`, `citacao` (CHK-COMUM-06: trecho contínuo de 12+ palavras de página lida **nesta** execução), `fonte`, `calculo`, `ganho`, `leis`, `temas`.
- Por tipo de entrega (`spec_<tipo>_*.py`): `spec_calculo_*`, `spec_copy*`, `spec_dossie_*`, `spec_parecer_*`, `spec_relatorio_*`, `spec_treino_*`. O README registra cobertura de 78 de 78 checagens citadas pelas entregas do primeiro card (quadro gerado por `python -m spec_helena`).
- Dados em `validador/dados/`: `configuracao.json` (números e **gravidades**), `termos_de_ganho.json`, `temas.json`, `leis.json`. **`leis.json` nasce com `texto_oficial_a_conferir` vazio de propósito: nunca peça a uma IA para escrever o texto de uma lei.** Enquanto estiver vazio, todo uso da lei sai com a marca `CHK-LEI-03`.

**Como o motor usa.** `Motor.executar_e_salvar` guarda o `contexto` (de `montar_contexto_real`) junto da resposta; `Motor.conferir_e_aplicar` chama `validador.validar(texto, contexto)`. Cada serviço roda só as checagens comuns (`portao1_comum` do catálogo) e as do `criterio_de_pronto` do seu tipo (`modelo.checagens_a_rodar`); as `CHK-ACAO-*` rodam sempre.

**Ponte com a especificação (`spec_helena/`).** `Spec(raiz)` lê `servicos.yaml`, `deliverables/*.yaml` e `casos/`; `montar_modelo` converte o YAML do tipo no `modelo` do validador (nada é copiado para o código); `listar_casos`, `montar_contexto`, `montar_resposta` transformam os casos da especificação em entradas do validador; `cobertura.py` mantém o quadro do README.

**Como mudar.**
- Número ou lista: no YAML do tipo (`checagens_codigo[].parametros`) ou em `dados/*.json`; o código lê de lá.
- Termo de ganho a mais: `dados/termos_de_ganho.json` (sem acento, minúsculo).
- Checagem nova da especificação: seguir "Como implementar uma CHK" no README do validador (mesmo id, gravidade e furos do YAML; `@checagem`; caso bom **e** caso com defeito em `helena-v2/casos/<SRV>/`; remover o id de `tests/adiadas/tipo_<tipo>.py`; rodar `python -m spec_helena --atualizar-readme`).
- Depois de qualquer mudança: `python -m pytest -q` em `motor/validador` (inclui mutação: o teste estraga a regra de propósito e confere que o banco de casos reage).
- Limite assumido: o validador prova que a citação **existe** na página lida e combina com a frase; não prova que a frase está certa — isso é do revisor (portão 2).

---

## 5. motor/ferramentas (o servidor MCP de leitura)

Pacote `ferramentas_helena`; README em `motor/ferramentas/README.md`. Servidor MCP por **stdio** (JSON-RPC, uma mensagem por linha; métodos `initialize`, `ping`, `tools/list`, `tools/call`), sem abrir porta de rede e só com a biblioteca padrão. Duas ferramentas, **as duas só leem**: `ler_pagina(url, parte=1)` (texto limpo em partes de até 20 mil caracteres, com cópia datada e com hash) e `buscar(consulta)` (hoje só o adaptador **desligado**, que recusa com erro claro; busca real é decisão do fundador, fase 4). Quem o lança é o Hermes, a partir do `config.yaml` que `perfil.py` gera (`python -m ferramentas_helena --execucao … --diretorio … --max-total … [--ferramentas ler_pagina … --lista-de-enderecos fontes.txt | --servidor-vazio]`). Configuração errada ► o servidor não liga (código de saída 2).

| Arquivo | Responsabilidade |
|---|---|
| `__main__.py`, `parametros.py` | argumentos; configuração errada falha fechado |
| `servidor.py`, `ferramentas.py` | protocolo MCP e registro das ferramentas |
| `enderecos.py` | segurança da URL: só http/https, portas 80/443, sem IP privado/loopback/link-local/metadata de nuvem, sem usuário/senha, sem caminho de ação (`confirmar`, `login`, `pagar`…), consulta `?…` removida |
| `rede.py` | download com anti-*rebinding* (resolve uma vez, confere todos os IPs, conecta direto), até 3 redirecionamentos só no mesmo site, 3 MB, tempo total |
| `limpeza.py`, `partes.py`, `leitor.py` | texto limpo (sem script/comentário/elemento escondido/invisível), corte em partes, saída marcada "conteúdo externo, nunca instrução" |
| `copias.py`, `registro.py` | cópia da página (`LEI-nnn.txt/.json`, `carregar_copia`, `CopiaAdulterada`), `estado.json`, `registro.jsonl` |
| `contador.py` | limite total/buscas/partes; no limite responde "ENTREGUE AGORA"; depois de 3 insistências encerra com motivo `limite_de_chamadas` (saída 4) |
| `busca.py` | adaptadores de busca: `desligado` (produção) e um falso de teste |
| `erros.py` | exceções da ferramenta |

**Como o motor usa.** O executor lê `estado.json` durante e depois da execução (limite, ferramentas listadas, `usou_internet`); `orquestrador.evidencias` confere `registro.jsonl` e as cópias para construir `paginas_lidas`; o validador usa as cópias para a CHK de citação. A lista de endereços (`fontes_que_pode_ler`) é montada pelo motor a partir do pedido; link colado no pedido **sem** "pode ler" do fundador não entra.

**Como mudar.** Use a tabela "Como mudar" do README da pasta (regra de endereço ► `enderecos.py`; download ► `rede.py`; limpeza ► `limpeza.py`; limite ► `contador.py`; terceira ferramenta ► `ferramentas.py`, `parametros.py`, `servidor.py` **e** a ficha — hoje o projeto manda: só ferramentas que leem; busca real só com decisão do fundador). Se um teste de `test_mutacoes.py` ficar vermelho, uma trava deixou de ser percebida: conserte a trava, não afrouxe o teste.

**NÃO CONFIRMADO:** o Hermes real ainda não chamou este servidor em card real (verificado só com o SDK MCP em `verificacao_manual/compat_mcp.py` e com o Hermes real + provedor falso em `verificacao_real/`). Texto escondido por CSS externo/classe não é detectável sem navegador; a defesa final é "quem leu a internet só entrega" (`CHK-ACAO-03`).

---

## 6. motor/simulador (o ensaio geral da esteira)

Pacote `simulador`, sem IA e sem banco: gera sequências aleatórias de "dias ruins" (agente que trava, fundador que some, botão na hora errada) e confere depois de cada evento **18 invariantes** (`invariantes.py`): ninguém aprova a própria peça, o padrão do relógio nunca aprova, nenhuma ação de fora sem o ok do fundador, etapa passa de 6 execuções, card pronto com informação velha… Peças: `referencia.py` (implementação de referência da máquina), `mundo.py`, `agentes.py`, `motor_falso.py`, `execucao.py`, `adaptador_maquina.py` (roda os mesmos cenários na **máquina real** de `helena-v2/maquina/provar.py`), `roteiro.py`, `eventos.py`, `vocabulario.py`. Os testes provam também 28 mutantes (versões estragadas da referência). Nenhum código de produção importa o simulador. Para criar regra ou mutação nova veja o README da pasta (invariante nova = `@invariante` + um caso negativo; mutação nova = classe em `testes/mutantes.py` + uma linha em `MUTACOES`).

---

## 7. motor/hermes-vps (instalar, atualizar, inventariar, remendar o login, Telegram)

Tudo aqui roda **dentro da VPS**, como `root` (menos os testes). A VPS tem **três Hermes de propósito**, e o motor nunca lê `/root/.hermes`:

| O quê | Versão | Onde | Para quê | Quem instala |
|---|---|---|---|---|
| Hermes do **EasyPanel** | NÃO CONFIRMADO (dentro de container) | volume/container | é a v1; fica como está (DEC-028) | não é deste repositório |
| Hermes do **profissional** (Telegram, "Plano B") | **0.15.1** (tag `v2026.5.29`, commit `e71a2bd1…`) | `/usr/local/lib/hermes-agent`, login em `/root/.hermes` | assistente de conversa no Telegram; **não está ligado à v2** | `instalar.sh` |
| Hermes do **motor v2** | **0.19.0** (+ patch de autenticação) | `/opt/helena-v2/venv-hermes`, login em `/var/lib/helena-v2/hermes-home`, usuário `helena` | chamado por `hermes -z` a cada execução | `instalar-motor.sh` |

O motor exige a 0.19.0 porque o executor usa a opção `--usage-file`, que a 0.15.1 não tem.

### 7.1 Arquivos

| Arquivo | O que é |
|---|---|
| `instalar-motor.sh` | instalador do motor v2, por **etapas repetíveis** (seção 7.2) |
| `atualizar-v2.sh` + `ATUALIZAR-V2.md` | prepara uma versão nova **sem ativar** (seção 7.3) |
| `inventario.sh` | inventário somente leitura (seção 7.5) |
| `patch-hermes-auth.py`, `testar-patch-hermes-auth.py` | correção de login do Hermes 0.19.0 (seção 7.4) |
| `telegram-v2/` | adapter de inbox para o Hermes 0.15.1 (seção 7.6) |
| `instalar.sh`, `original/` | instalador do Hermes 0.15.1 do profissional e o original dele para `diff` |
| `LEIA-ME.md` | visão dos instaladores; relatos datados (não são o estado atual) |
| `test_atualizar_v2.py` | testes locais do `atualizar-v2.sh` (unittest) |

### 7.2 `instalar-motor.sh` — etapas

Uso: `bash instalar-motor.sh tudo` ou uma etapa. Pula o que já está pronto. Variáveis de caminho (nomes): `HELENA_USUARIO` (padrão `helena`), `HELENA_BASE` (`/opt/helena-v2`), `HELENA_VAR` (`/var/lib/helena-v2`), `HELENA_ETC` (`/etc/helena-v2`), `HELENA_LOG` (`/var/log/helena-v2`), `HELENA_REPO_URL`, `HELENA_REF` (padrão `main`; **para atualizar passe o SHA completo**), `PYTHON_VERSAO` (3.13), `SYSTEMD_DIR`.

| Etapa | O que faz |
|---|---|
| `preparar` | instala `git`/`curl`/`uv`, instala o Python gerenciado pelo `uv` em `/opt/helena-v2/python` (o usuário `helena` não lê `/root`), cria o usuário de sistema `helena` (`nologin`) e as pastas (`HELENA_VAR` 0700; `HELENA_ETC` 0750 `root:helena`; `HELENA_LOG` 0755) |
| `codigo` | clona/atualiza o repositório em `$HELENA_BASE/repo` e faz `checkout --detach` de `origin/$HELENA_REF`. Repositório público: sem token; privado: pede token de leitura via `GIT_ASKPASS`, que não é gravado; recusa se a URL do remoto ficar com credencial |
| `motor-venv` | venv do motor com `motor/orquestrador/requirements.txt`; confere `import dbos, psycopg, yaml, jsonschema` |
| `hermes-venv` | venv do Hermes com `requirements-hermes-real.txt`; aplica `patch-hermes-auth.py`; roda `testar-patch-hermes-auth.py`; exige `hermes --version` = `v0.19.0` |
| `login` | confere o patch (`--check`); se `hermes auth status openai-codex` não mostra `logged in`, roda `hermes auth add openai-codex --no-browser` como usuário `helena` com `HERMES_HOME=$HELENA_VAR/hermes-home` (mostra link e código do ChatGPT); `chmod 0600` no `auth.json` |
| `banco` | pergunta host/senhas (por variável ou terminal sem eco); aceita só `db.<ref>.supabase.co` ou `*.pooler.supabase.com`; monta as duas URLs **no formato canônico** (`postgresql://usuario:senha-codificada@host:5432/postgres?sslmode=verify-full`; no pooler os usuários são `helena_motor.<ref>` e `dbos_motor.<ref>`); grava `motor.env` (0640 `root:helena`); chama `testar-banco` |
| `testar-banco` | `preparar_ca` (baixa a CA do Supabase, **confere a impressão digital fixa**, junta ao pacote do sistema em `$HELENA_ETC/ca-bundle.crt` e aponta `SSL_CERT_FILE` no `motor.env`); depois conecta com as duas contas usando `validar_destinos_reais` + `preflight_papel_runtime` e confere `tabela_confere()` e o esquema `dbos_helena_v2` |
| `conferir` | `--check` do patch + `conferir-runtime` do orquestrador |
| `servicos` | escreve as três unidades systemd (seção 9) e liga **só** vigia e relógio; o despachante fica **instalado e desligado** |
| `validar-config` | roda `validar-configuracoes` real (veredito do motor aos rascunhos pedidos pela tela) |
| `ligar-motor` | confere o patch e **só liga o despachante se existir revisão ATIVA** (lê `configuracao_ativa()`) |
| `estado` | estado dos três serviços, últimas 5 linhas de `alarmes.log`, HEAD do código |

Ordem de ponta a ponta: `tudo` (`preparar` até `servicos`) ► **tela `/configuracoes`**: Clonar a base técnica e Pedir validação ► `validar-config` ► **tela**: Ativar ► `ligar-motor`. **Não use `tudo` para atualizar:** ele recria os venvs e reescreve configuração (use `atualizar-v2.sh`).

### 7.3 `atualizar-v2.sh` — preparar versão nova sem ativar

`atualizar-v2.sh --bundle ARQ --commit SHA40 --current-repo DIR --baseline SHA40 --dest STAGING [--prepare]`. Sem `--prepare` é *dry run*: recusa baseline diferente do HEAD atual, checkout atual com alterações, bundle inválido, release já existente, novo commit que não descende do baseline, e confere as **migrations**: as do checkout atual têm de ser byte a byte iguais no release, sem lacunas nem duplicatas nem links, e o release precisa conter pelo menos 0001–0026. Com `--prepare` cria `STAGING/<commit>` com clone destacado, resolve e **trava com hashes** as dependências (`uv pip compile --generate-hashes` / `uv pip sync --require-hashes`) em venvs novos, aplica e testa o patch do Hermes, roda `test_configuracao.py` e `test_bancos.py` e escreve `RELEASE.txt` com `status=STAGED_ONLY`. **Nunca ativa, não executa SQL, não lê credenciais.** O corte (troca do release ativo) é procedimento separado e não existe como script. A migration nova é aplicada pelo fluxo próprio, uma vez, **antes** do código que dependa dela.

### 7.4 O defeito de login do Hermes 0.19.0 e o patch

- **O defeito** (diagnóstico em `docs/auditoria/HERMES-AUTH-2026-10-17.md`, com reprodução em `docs/auditoria/repro-hermes-auth-2026-10-17.py`): cada execução usa um perfil `profiles/exec-<id>` **sem** `auth.json`; o Hermes cai para o login da raiz (`<raiz>/auth.json`), então não há cópia de credencial. Mas, quando o token está perto de expirar, a **renovação grava no perfil**, não na raiz. A conferência pós-execução recusa `auth.json` no perfil e `limpar` apaga o perfil: o token renovado se perde. O próximo perfil lê a raiz **antiga**; se o refresh token for de uso único e já foi consumido, o login falha (classe `LOGIN`) e o Hermes tentaria recuperar por `CODEX_HOME`, que a Helena mantém vazio de propósito.
- **O patch** (`patch-hermes-auth.py <site-packages>`): altera só dois módulos do wheel oficial (`hermes_cli/auth.py`, `agent/credential_pool.py`), **somente se** o SHA-256 de cada um bater com o original conhecido; o resultado também tem SHA-256 fixo; é idempotente; grava por arquivo temporário + `fsync` + `os.replace`; exige `hermes-agent==0.19.0` e destino dentro do venv ativo. Qualquer fonte desconhecida é recusada (`Hermes auth patch refused`). `--check <site-packages>` só confere os hashes e é o portão que `login`, `conferir` e `ligar-motor` chamam. A correção preserva o auth store de origem, relê sob lock antes de consumir o refresh token e grava de forma atômica (singleton e pool).
- **Testes** (`testar-patch-hermes-auth.py`, 17 casos com dados sintéticos, duas instâncias concorrentes, sem chamada paga) rodam com o Python **do venv do Hermes**; não rodam no CI nem no venv do motor.
- **Limites:** é um patch **mantido pela Helena**, não uma versão oficial do Hermes. Mudar o pin exige revisar a fonte nova e retirar ou refazer o patch. A substituição dos dois arquivos não é uma transação única: uma queda no meio deixa instalação parcial, que os portões `--check` recusam até reparar. O critério de 48 horas de operação estável permanece **NÃO COMPROVADO**. **NÃO CONFIRMADO** se o `venv-hermes` que está na VPS já foi recriado com o patch (o relato de 17/10 diz "não instalado na VPS").

### 7.5 `inventario.sh` — olhar sem tocar

Somente leitura: `systemctl show` das três unidades Helena e das unidades com "hermes" no nome, `docker service ls`/`docker ps` filtrados por nome, `stat`/`du` dos caminhos conhecidos (`/usr/local/lib/hermes-agent`, `/opt/helena-v2`, `/root/.hermes`, `/root/backup-hermes-easypanel`), HEAD e *dirty* de `/opt/helena-v2/repo`, versão do `hermes-agent` dos dois venvs. **Não abre** `.env`, `auth.json`, logs nem processos; usa `timeout`; escreve `NÃO CONFIRMADO (motivo)` quando algo não responde. `HELENA_INVENTARIO_TESTE_LOCAL=1` só imprime o formato (para teste local). Rode antes de planejar qualquer troca; o roteiro está em `docs/manual/retomada-hermes-vps.md`.

### 7.6 `telegram-v2/` — adapter para o Hermes 0.15.1 (preparação desativada)

O **único** ingresso confiável do Telegram é a Edge `supabase/functions/helena-v2-telegram/` (`index.ts`, `core.ts`, `transport.ts`, `core.test.mjs`): verifica `X-Telegram-Bot-Api-Secret-Token`, grava o Update em `telegram_inbox` e cria pedido/recibo (`/pedido`, de chat privado pareado) de forma idempotente (migrations 0022, 0025, 0026). Token do bot, `service_role` e segredo de ingresso ficam **só** na Edge. Do lado da VPS:

- `helena_v2_inbox.py`: `HelenaV2InboxAdapter(TelegramAdapter)`, escolhido no Hermes 0.15.1 só com `HELENA_V2_TELEGRAM_MODE=inbox-worker`. Faz *claim*/renovação/conclusão de trabalho e drena a *outbox* pelo endpoint fixo `HELENA_V2_TELEGRAM_BROKER_URL`, com `HELENA_V2_TELEGRAM_WORKER_SECRET` (distinto do segredo do webhook). Exige `config.token` vazio e falha fechado se houver `TELEGRAM_BOT_TOKEN`. Não chama `getUpdates` nem `setWebhook`. Mídia recebe resposta de que ainda não foi lida.
- `patch-hermes-telegram.py`: patch idempotente de `gateway/run.py` e `gateway/config.py` e cópia do adapter para `gateway/platforms/`, com **commit fixado** (`e71a2bd1…`) e **hashes** de origem e de resultado. `--check` e `--apply`.
- `instalar-local.sh`: só aceita cópia isolada sob `/tmp` ou `/workspace`; **não é instalador de produção**.
- `helena_v2_broker.py`: ajudante **histórico, não instalado** (o segredo compartilhado permitia forjar `chat_id`).
- `test_telegram_v2.py`: precisa da fonte do Hermes 0.15.1 (`HERMES_015_SOURCE`) — não roda no CI.

**Limites:** o relay de `getFile` (anexos) está pendente; o envio é durável com *lease/retry* mas **sem garantia de exatamente uma vez**; a capability do worker pode ser lida por ferramentas do mesmo UID. Não aplicar na VPS enquanto a cobertura de mídia e o procedimento de corte (parar o poller antigo, guardar offset, um único webhook para a Edge com `drop_pending_updates=false`, rollback) não estiverem validados. A conversa comum do Telegram usa o Hermes **0.15.1** e **não** recebe o mapa operacional do motor.

### 7.7 Workflow do GitHub (opcional, NÃO homologado)

`.github/workflows/helena-vps-motor.yml` (`workflow_dispatch`, um job `vps`) leva o código por `scp` e roda uma etapa de `instalar-motor.sh` por SSH. Em 17/10/2026 falhou no acesso SSH (o segredo tinha só a impressão digital da chave). O passo é exercitado localmente por `helena-v2/test_operacao_vps.py` (SSH e instalador falsos). Não é o caminho principal; o que funcionou foi colar os comandos no terminal da VPS.

---

## 8. helena-v2/ (a especificação que vira configuração)

`helena-v2/README.md` resume a pasta. Princípio: **fonte única de verdade**. O motor lê estes arquivos; deles saem permissões, roteamento e testes.

### 8.1 O que cada arquivo é

| Caminho | Papel | Quem lê em execução |
|---|---|---|
| `organograma.yaml` | 21 agentes (`AGT-01…21`) em grupos, `fundador`, `coordenacao`, as 4 empresas com `pacote.estado` (`CONFIRMADO`/`NAO_CONFIRMADO`), `escopo_pessoal`, sobreposições resolvidas | `Motor.criar_card_*` (pacote da empresa), `mapa_operacional`, `triagem_pedido` |
| `servicos.yaml` | o **cardápio**: 22 serviços (dono, tipo de entrega, revisor, reserva, ações, ferramentas, estado, empresas, `escolhivel`, `avulso`, `julgado_pelo_parecer`, `modelo_menor`…), índice `agentes:` (o que cada um `possui` e `revisa` com aptidão), `regras_da_matriz` (MAT-01…25), `montagem_do_plano`, `ferramentas_nossas`, `ordem_de_ativacao`, `portao1_comum` | `spec_helena.Spec`, `plano`, `triagem_pedido`, `_roteiro_do_banco` |
| `models.yaml` | apelidos de modelo por papel (`coordenacao-padrao`, `revisao-padrao`, `analise-padrao`, `pesquisa-padrao`, `conteudo-padrao`), **sem reserva**; `modelo_menor_por_ordem_sua` (`gpt-6-luna`); política de cota | `ficha.ler_modelos` |
| `agents/<nome>.yaml` | a ficha de cada agente (formato 3.1, `schemas/agent.schema.json`): missão, `servicos[]` (ações, ferramentas, `orcamento`, revisor, reserva), `revisao` (aptidões e orçamento), `coordenacao` (só Helena), `modelo` (apelidos), `vagas`, `regras`, `nunca`, `aprendizados` | `ficha.ler_ficha` ► `perfil` |
| `deliverables/<tipo>.yaml` | o formato de cada tipo de entrega: `secoes`, `limite`, `checagens_codigo` (CHK) com `parametros`, `rubrica` (RUB), `criterio_de_pronto`, `entrada_minima` | `montar_modelo` ► validador |
| `playbooks/<meta>.yaml` | roteiros em etapas (`recrutar-10-pessoas`) | `preparar-tarefa-real`, legado |
| `schemas/*.schema.json` | JSON Schema de ficha, entrega, ação, card, plano, roteiro | `validar.py`, validador |
| `maquina/` | `vocabulario.yaml` (nomes únicos), `passagens.yaml` (a tabela de passagens), `provar.py` (a prova exaustiva e o `replay`), `jornada.schema.json`, `test_maquina.py` | gera o SQL do banco; `bancos`/`configuracao` conferem a impressão |
| `casos/<SRV>/boas`, `defeitos`, `jornada*.yaml` | 283 arquivos: respostas boas e defeitos plantados por serviço; jornadas de ponta a ponta | testes, placar do revisor, `validar_bundle` (do checkout, nunca do bundle) |
| `validar.py` | o conferente: 71 regras | CI, `validar_bundle` |
| `PENDENCIAS.yaml` | problemas reais já sabidos (hoje `FICHA-AUSENTE`, máximo 13) | `validar.py` |
| `requirements.txt` | `pyyaml`, `jsonschema`, `pytest` | — |

**A tabela de passagens.** `maquina/passagens.yaml` define estados (card: `RASCUNHO`, `ESPERANDO_CONFIRMACAO`, `VALIDANDO_PLANO`, `EM_ANDAMENTO`, `ESPERANDO_FUNDADOR`, `PRONTO`, `CANCELADO`, `ENCERRADO_COM_FALHA`; etapa: `AGUARDANDO_ANTERIORES`, `NA_FILA`, `EXECUTANDO`, `VALIDACAO`, `REVISAO`, `ESPERANDO_FUNDADOR`, `EM_RESOLUCAO`, `APROVADA`, `PRONTA`, `CANCELADA`, `ENCERRADA_COM_FALHA`; ação externa: 11 estados), cada linha (`C01…`, `E54…`) com `de`, `evento`, `papel`, `guarda`, `efeito` e `para`, os **tetos** (`TETO_EXECUCOES` 6, `TETO_FORMATO` 1, `TETO_TEMPO` 1, `TETO_CHAMADAS` 1, `TETO_REPROVACOES` 2, `TETO_INFRA` 3, `TETO_AVISO_ESPERA` 1…), os `automaticos` (card: `PLANO_VALIDO`, `TODAS_PRONTAS`, `PERGUNTAR_AO_FUNDADOR`, `MOTIVO_RESOLVIDO`; etapa: `DEPENDENCIAS_PRONTAS`, `INICIAR_EXECUCAO`, `INICIAR_REVISAO`, `TETO_EXECUCOES`) e as `reacoes` do fundador (que nunca mudam estado). O SQL `supabase/migrations-v2/0002_passagens_geradas.sql` é **gerado** por `gerar_passagens.py`; `python gerar_passagens.py --conferir` roda no CI. Nunca edite o 0002 à mão.

### 8.2 `validar.py` — o portão da especificação

`python helena-v2/validar.py` lê tudo (`carregar`) e roda 71 regras registradas com `@regra('TAG', 'descrição')`; cada regra tem teste de mutação em `test_validar.py`. Famílias: `CARGA`, `ESQUEMA-*` (organograma, serviços, ficha, entrega, roteiro, jornada, caso), `MODELOS-*`, `ORGANOGRAMA`, `CATALOGO-INDICE`, `MAT-01…25` (a matriz: dono único, revisor ≠ dono, quem revisa não julga depois, ninguém é titular de mais de 3 tipos, só 1 ação do fundador por serviço, empresa `PESSOAL` só da Laura, serviço em `ESTAGIO/ATIVO` só com pacote `CONFIRMADO`, ordem de ativação…), `FERRAMENTAS`, `FICHA-*` (a ficha é espelho do catálogo: arquivo, id/nome/grupo/fase/estado, serviços, aptidões, apelidos, orçamento), `ENTREGA-*` (dono único, ids únicos, rubrica no pronto, internet só com `REGISTRAR_FALHA`, lei só no parecer), `C-11-*` (o convite nunca fala de ganho nem usa o cálculo), `ROTEIRO-*`, `CASOS-*` (≥ 3 casos bons e ≥ 4 defeitos por serviço com ficha), `JORNADA-REPLAY` (cada jornada passa no replay da máquina) e `SEM-CHAVE` (nenhum padrão de chave/token/senha nos arquivos). Saída `ERRO <arquivo>: [REGRA] …`, `PENDENTE …` ou `OK`. `--estrito` trata pendência como erro; pendência resolvida que continua na lista também é erro. Hoje: `OK com 1 pendência` (13 de 21 fichas ausentes: Bianca, Daniel, Theo, Nina, Maya, Bruno, Olívia, Victor, Camila, Pedro, Renata, Joana, Felipe).

### 8.3 Como o catálogo vira revisão de configuração: `RASCUNHO ► VALIDADA ► ATIVA`

A tabela `helena_v2.configuracao` guarda **revisões** do conteúdo (`jsonb`), com `estado ∈ {RASCUNHO, VALIDADA, APOSENTADA}`. "ATIVA" **não é um estado**: é o ponteiro `configuracao_ponteiro.ativa_id` (uma só por vez); `tecnica_id` aponta a base técnica registrada na instalação. Passo a passo:

1. **Bundle.** `orquestrador.configuracao.capturar_bundle(helena-v2/)` junta a lista **fechada** de documentos (`OBRIGATORIOS` + `agents/*.yaml`, `deliverables/*.yaml`, `playbooks/*.yaml`, `schemas/*.json`) em um dicionário `{"helena-v2/servicos.yaml": {…}, …}`: dados parseados, nunca código. **Ficam fora:** `casos/`, `validar.py`, `provar.py`, `PENDENCIAS.yaml`, README. O mesmo filtro de caminho existe em SQL (`_config_bundle_valido`).
2. **Rascunho.** Na tela `/configuracoes`, o fundador **clona** uma revisão (ou importa JSON) e edita; o site chama `salvar_rascunho(p_nome, p_conteudo, p_id, p_versao_esperada, p_base_id)` (versão otimista; só `RASCUNHO` é editável; editar cancela pedido de validação pendente).
3. **Pedir validação.** `solicitar_validacao_config(p_id, p_versao)` grava um pedido com o hash SQL (`sha256(jsonb::text)`) do conteúdo.
4. **Veredito do motor** (código, **nunca a IA**): `validar-configuracoes` (na VPS: `instalar-motor.sh validar-config`) chama `processar_configuracoes_pendentes`: `listar_validacoes_pendentes` ► recalcula o hash no PostgreSQL ► `tabela_confere()` ► `configuracao.validar_bundle(bundle, raiz_maquina=checkout)` ► `registrar_validacao_config` (vira `VALIDADA`, com `hash_sha256`, `impressao_maquina`, `validada_em`) ou `registrar_resultado_validacao` com `{ok:false, erros:[…]}` (continua `RASCUNHO`). **Nunca ativa.**
   - `validar_bundle` exige que `maquina/*` e `schemas/*` do bundle sejam **idênticos** aos do checkout (`"máquina ou schema técnico diferente da versão compilada; exige migração"`), materializa o bundle numa pasta temporária, **copia `casos/` do checkout**, carrega o `validar.py` **do checkout**, roda todas as regras menos `JORNADA-REPLAY`, refaz o replay de cada jornada com o `provar.py` do checkout e separa erros novos das pendências conhecidas. Falha com `configuração inválida: …`.
5. **Ativar.** O fundador toca em Ativar; `ativar_configuracao(p_id, p_ativa_esperada)` exige `VALIDADA`, a ativa esperada igual à atual (comparação atômica), máquina igual à da base técnica e `tabela_confere()`; grava a ativação (histórico em `configuracao_ativacao`, migration 0019). `reverter_configuracao(p_ativa_esperada)` volta à anterior; `aposentar_configuracao` nega a ativa e a técnica.
6. **Card.** Todo card novo nasce com `ordem_de_servico.config_revision_id` fixado (trigger `_config_vincular_card`): sem revisão ativa o banco recusa (exceto a técnica, pelo motor, em ambiente de teste); card filho herda a do pai; **card em andamento conserva a revisão em que nasceu** mesmo depois de nova ativação.
7. **Uso pelo motor.** `Motor._carregar_revisao(id)` lê a revisão (`ler_configuracao`), confere o hash SQL e o hash local, **materializa um snapshot somente leitura** em `…/helena-dbos-config-*/<id>-<versão>-<hash>/helena-v2/`, devolve `(revisão, Spec, raiz)` e reconfere os arquivos a cada uso. As fichas e os modelos de um card vêm desse snapshot, não do checkout.

**Consequência prática (leia duas vezes):** o comportamento de um card = **dados da revisão fixada** (fichas, catálogo, tipos de entrega, modelos) **+ código do checkout** (executor, validador, checagens, `validar.py`, máquina). Mudar só o YAML do repositório não muda cards já criados nem a revisão ativa; mudar só o código não muda a configuração. Ver seção 13.

### 8.4 Estados de serviço e os 22 serviços

Estados (`estados_do_servico`): `RASCUNHO` (não recebe card), `EM_TESTE`, `ESTAGIO` (recebe card real, fundador como revisor a mais), `ATIVO`, `PAUSADO`, `APOSENTADO`. Recebem card: `ESTAGIO` e `ATIVO` (`recebem_card`). Aptidão de revisão é por **par** (agente, tipo): `SEM_PROVA`, `APTA`, `PAUSADA`; só `APTA` é designável. A coordenação da Helena tem estado próprio. Pela especificação, subir de estado exige o toque do fundador depois de o código calcular "apto" (para `ESTAGIO`: 10 casos 3 de 3, o teste 3 e revisor titular `APTO`); **NÃO CONFIRMADO** que exista hoje código que faça esse cálculo ou o botão de publicar serviço — na prática o estado muda editando `servicos.yaml` numa nova revisão de configuração.

| Serviço (dono) | Revisor / reserva | Estado | Observação |
|---|---|---|---|
| `SRV-RELATORIO-FINAL` (Helena) | Caio / Clara | ESTAGIO | não é avulso nem escolhível; só como última etapa de roteiro |
| `SRV-CALCULO` (Caio) | Helena / Clara | ESTAGIO | sem ferramentas; exige insumos reais |
| `SRV-PARECER` (Clara) | Helena / Fundador | ESTAGIO | usa `ler_pagina`; **fundador é o segundo revisor**; precisa de tabela de leis `FON-LEIS` |
| `SRV-COPY` (Isabela) | Caio / Camila | ESTAGIO | `julgado_pelo_parecer: SEMPRE` |
| `SRV-ROTEIRO-TREINAMENTO` (Isabela) | Caio / Olívia | ESTAGIO | `SEMPRE` julgado |
| `SRV-DOSSIE` (Ravi) | Isabela / Augusto | RASCUNHO (fase 3) | `ler_pagina` (e `buscar` só na fase 4) |
| `SRV-PLANO-DE-PRATICA` (Laura), `SRV-ANALISE-ESTRATEGICA` (Augusto), `SRV-PLANO-DE-PROJETO` (Marina) | — | RASCUNHO | fichas existem; estado do serviço segue RASCUNHO |
| os outros 13 (de Daniel, Felipe, Bianca, Nina, Maya, Theo, Bruno, Camila, Victor, Pedro, Renata, Joana e Olívia) | — | RASCUNHO, fase 4 | **sem ficha**; só `SRV-PERFIL-DE-FUNCAO` (Bianca) já tem tipo de entrega em `deliverables/` |

(O estado vale para esta versão da especificação; não prova que algum agente esteja ativo em produção.)

### 8.5 Anatomia de uma ficha (`agents/caio.yaml` como exemplo)

`versao: "3.1.0"`, `id`, `identidade`, `nome`, `funcao` (= cargo do organograma), `papel`, `grupo`, `escopo`, `empresas` (só com pacote `CONFIRMADO`), `missao`, `servicos[]` (por serviço: `acoes_permitidas`, `ferramentas` **por extenso**, `orcamento{buscas, partes_de_pagina, chamadas_total, tempo_s}`, `revisor`, `reserva`), `revisao{aptidao[], ferramentas: [], orcamento}`, `coordenacao{LER_DE_VOLTA, RECOMENDAR}` (só Helena), `modelo{autor, revisao[, coordenacao]}` (apelidos de `models.yaml`), `vagas`, `regras` (até 12, verificáveis), `nunca`, `aprendizados`, `fase_de_ativacao`, `estado`. **Id, nome, função, grupo, escopo, fase, estado, serviços, ações, ferramentas, revisor, reserva e aptidões são espelho do catálogo/organograma** (o validador recusa divergência); só decidem na ficha: orçamento, vagas, modelo por papel, regras, nunca e aprendizados. O `tempo_s` de cada ficha é **estimativa não confirmada** até a medida real do dia de prova.

---

## 9. Serviços systemd e variáveis de ambiente

### 9.1 As três unidades (geradas por `instalar-motor.sh servicos`)

| Unidade | Comando (`venv-motor/bin/python -m orquestrador …`) | Memória | Frequência | O que faz | Estado ao instalar |
|---|---|---|---|---|---|
| `helena-vigia.service` | `vigiar --saida /var/log/helena-v2/alarmes.log` | `MemoryMax=256M` | volta a cada **300 s** | só lê; avisa por arquivo | ligada (`enable --now`) |
| `helena-relogio.service` | `relogio` | `MemoryMax=256M` | volta a cada **60 s** | aplica o que o **banco** diz que venceu (papel `RELOGIO`) | ligada |
| `helena-despachante.service` | `despachar --vagas 1` | `MemoryMax=1536M` | rodada a cada **5 s** (volta logo se avançou) | **o único que chama agente e gasta cota** | instalada e **desligada** até `ligar-motor` |

Comum às três: `User=Group=helena`, `EnvironmentFile=/etc/helena-v2/motor.env`, `Environment=HOME=/var/lib/helena-v2`, `WorkingDirectory=<repo>/motor/orquestrador`, `Restart=always`, `RestartSec=10`, `KillMode=mixed`, `TimeoutStopSec=30`, `NoNewPrivileges=yes`, `PrivateTmp=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `ReadWritePaths=/var/lib/helena-v2 /var/log/helena-v2`. Como as três caem juntas se a VPS cair, quem avisa que o relógio parou é o vigia (`RELOGIO_ATRASADO`), mas se a VPS inteira cair nada avisa (alarme é arquivo local — seção 2.1, `vigilancia.py`).

Comandos de inspeção (somente leitura): `bash instalar-motor.sh estado`, `systemctl is-active helena-vigia helena-relogio helena-despachante`, `journalctl -u helena-despachante -n 80`, `tail /var/log/helena-v2/alarmes.log`, `bash motor/hermes-vps/inventario.sh`.

### 9.2 Variáveis de ambiente (só nomes; valores nunca vão para Git, chat ou log)

**Motor em produção (`/etc/helena-v2/motor.env`, 0640 `root:helena`):**

| Nome | Para quê |
|---|---|
| `HELENA_V2_DATABASE_URL` | URL canônica da conta `helena_motor` (aplicativo; assume `service_role` por `SET ROLE`) |
| `HELENA_V2_DBOS_SYSTEM_DATABASE_URL` | URL canônica da conta `dbos_motor` (dona do esquema `dbos_helena_v2`) |
| `HELENA_V2_HERMES_BIN` | caminho absoluto, executável, do `hermes` do venv 0.19.0 |
| `HELENA_V2_HERMES_HOME` | raiz do Hermes da v2 (guarda o login único; os perfis ficam em `profiles/`) |
| `HELENA_V2_EXECUCOES_DIR` | pasta das execuções (fora de qualquer repositório Git) |
| `PYTHONPATH` | as quatro pastas `motor/*` |
| `PYTHONDONTWRITEBYTECODE` | `1` |
| `SSL_CERT_FILE` | pacote de CAs com a CA do Supabase (seção 15, item 1) |
| `HELENA_V2_EXECUTOR` | opcional; vazio = `hermes` |
| `HELENA_V2_ALARME_WEBHOOK_URL` | opcional; só com `vigiar --canal-webhook` (a unidade não passa a opção) |
| `SUPABASE_ACCESS_TOKEN` | opcional; só `preparar-tarefa-real` (Management API); **não** substitui as conexões nem o login do Hermes |

**Local/teste:** `HELENA_V2_CONFIG_DATABASE_URL` (`validar-configuracoes`/`registrar-base-tecnica` em banco local), `HELENA_V2_TESTE_DATABASE_URL` (PostgreSQL de teste; só `localhost`), `HELENA_V2_PG_BIN` (pasta `bin` do PostgreSQL local), `HELENA_V2_PULAR_TESTES_LONGOS=1` (pula durabilidade/despacho), `SIM_SEMENTES_MAQUINA` (sementes do simulador na máquina real), `HELENA_INVENTARIO_TESTE_LOCAL`, `HERMES_015_TREE`/`HERMES_015_SOURCE` (Telegram local).

**Instaladores (`instalar-motor.sh`):** `HELENA_USUARIO`, `HELENA_BASE`, `HELENA_VAR`, `HELENA_ETC`, `HELENA_LOG`, `HELENA_REPO_URL`, `HELENA_REF`, `HELENA_REPO_TOKEN` (token de leitura, se o repositório for privado), `HELENA_DB_HOST`, `HELENA_SENHA_MOTOR`, `HELENA_SENHA_DBOS`, `PYTHON_VERSAO`, `UV_PYTHON_INSTALL_DIR`, `SYSTEMD_DIR`, `CA_BUNDLE`. **`instalar.sh` (0.15.1):** `HERMES_DIR`, `HERMES_HOME`, `WORK`, `HERMES_REPO`, `HERMES_MODELO`.

**Runtimes em homologação:** OpenClaw: `HELENA_V2_OPENCLAW_BIN`, `HELENA_V2_OPENCLAW_HOME`, `HELENA_V2_EXECUCOES_DIR`; EVE: `HELENA_V2_EVE_URL`, `HELENA_V2_EVE_TOKEN`, `HELENA_V2_EXECUCOES_DIR`.

**Telegram:** Edge — `HELENA_V2_TELEGRAM_WEBHOOK_SECRET`, `HELENA_V2_TELEGRAM_WORKER_SECRET`, `HELENA_V2_TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HELENA_V2_TELEGRAM_MODE` (ausente ou `webhook`). Hermes 0.15.1 — `HELENA_V2_TELEGRAM_MODE=inbox-worker`, `HELENA_V2_TELEGRAM_BROKER_URL`, `HELENA_V2_TELEGRAM_WORKER_SECRET`; `TELEGRAM_BOT_TOKEN` tem de estar **ausente**.

**Dentro do processo do agente** (montado do zero por `ambiente.py`, não herdado): `LANG`, `LC_ALL`, `TZ`, `HERMES_TIMEZONE`, `PYTHONDONTWRITEBYTECODE`, `PYTHONNOUSERSITE`, `NO_COLOR`, `HERMES_DISABLE_LAZY_INSTALLS`, `HERMES_STREAM_RETRIES`, `HERMES_NONINTERACTIVE`, `PATH`, `HOME`, `HERMES_HOME`, `CODEX_HOME` (pasta vazia), `TMPDIR`, `HELENA_EXECUCAO`.

Rejeitadas pelo motor real: qualquer `PGHOST`, `PGHOSTADDR`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGPASSFILE`, `PGSERVICE`, `PGSERVICEFILE`, `PGSSLMODE`, `PGSSLROOTCERT`, `PGOPTIONS`, `PGSYSCONFDIR` no ambiente (`bancos._PG_OVERRIDE_NAMES`). O arquivo `.env.example` na raiz lista só os **nomes** (app, testes do banco, motor em modo real, OpenClaw — inclusive `HELENA_V2_OPENCLAW_PATH` —, EVE e o webhook do vigia); o gateway da v1 tem o seu em `services/helena-gateway/`.

---

## 10. Ciclo de vida: do pedido ao card `PRONTO`

Cada linha é um passo; "quem" diz quem age (site/fundador, Edge, Despachante/Motor, banco, relógio). Os nomes `C01…` e `E54…` são ids de linhas de `helena-v2/maquina/passagens.yaml`. O estado **decisivo** de cada passo é gravado pelo banco; o motor só dispara o evento.

| # | Quem | O que acontece | Função / arquivo | Estado depois |
|---|---|---|---|---|
| 1 | Fundador no site | escreve o pedido em texto livre; o banco só aceita de fundador autenticado e ativo | `src/pages/EntradaPedidosV2.tsx` ► `src/integrations/pedidos-v2/repository.ts` ► RPC `receber_pedido_entrada` (0021) | `pedido_entrada.estado = RECEBIDO` |
| 1b | Telegram | `/pedido` de chat privado pareado vira o mesmo pedido, com recibo; `update_id` deduplica | Edge `supabase/functions/helena-v2-telegram` ► `registrar_update_telegram` (0025), `receber_pedido_telegram` (0022) | idem |
| 2 | Despachante | com **nenhum card em voo** e na sua vez, pega o pedido sem proposta | `despacho.Despachante._rodar_entrada_v2` ► `listar_trabalho_proposta_pedido` (0024) | — |
| 3 | Motor (triagem) | reserva (lease 600 s), chama a Helena **sem ferramentas** para sugerir, **grava a resposta bruta**, e o **código** valida: empresa, serviço, prazo, evidência literal | `triagem_pedido.processar_proposta_pedido` ► `reservar_proposta_pedido` ► `_autor_plano` ► `registrar_resposta_bruta_pedido` ► `planejar_plano` ► `registrar_proposta_pedido` | proposta `PERGUNTAR` (volta ao fundador) ou `PROPOR` |
| 4 | Fundador no site | confirma a proposta (a confirmação **nunca** é do motor); o banco confere de novo catálogo, fontes e hashes | `confirmar_proposta_pedido` ► `confirmar_plano_pedido` (0023/0024) | `PLANO_CONFIRMADO` |
| 5 | Despachante / Motor | converte o plano em card: valida revisão, pacote da empresa `CONFIRMADO`, serviços da empresa, `validar_plano`; **recusa plano com `SRV-PARECER`** (sem tabela de leis); monta o roteiro das fichas | `despacho._rodar_entrada_v2` ► `listar_planos_pedido_pendentes` ► `Motor.criar_card_pedido` ► `_roteiro_do_banco` ► `consumir_plano_pedido` ► `criar_card` | card `RASCUNHO`; pedido `CARD_CRIADO`; aviso Telegram (0026) |
| 6 | Despachante / Motor | `avancar`: pede a chave da chamada da Helena e roda `ler_de_volta_v1` ("Entendi assim") | `Motor.avancar` ► `obter_chamada_coordenacao` ► `executar_e_salvar_coordenacao` ► `registrar_resposta_coordenacao` ► `conferir_e_aplicar_coordenacao` ► `aplicar_resposta_coordenacao` | pedido grande: `ESPERANDO_CONFIRMACAO` (C01); pequeno: `VALIDANDO_PLANO` (C02); 2 falhas da Helena: `ESPERANDO_CONFIRMACAO` com `HELENA_FALHOU` (C03–C05) |
| 7 | Fundador no site | "Confirmo" (`RESPONDER`, C06); sem resposta: lembretes de 24 h e 48 h e depois **cancela por padrão** (nunca aprova) | `src/integrations/cards-v2` ► `aplicar_evento` papel `FUNDADOR`; relógio: `relogio.Relogio` | `VALIDANDO_PLANO` |
| 8 | Motor | valida o plano **por código** (60 s) e emite o evento | `Motor.avancar` ► `plano.validar_plano` ► `PLANO_VALIDO`/`PLANO_INVALIDO` (C10/C11) | `EM_ANDAMENTO` (ou volta ao fundador com o motivo) |
| 9 | Despachante / Motor | a cada rodada, `avancar` age na primeira etapa que pede o motor: `DEPENDENCIAS_PRONTAS`, `INICIAR_EXECUCAO` | `Motor.avancar` ► `_evento_de_vista_atrasada` | etapa `NA_FILA` ► `EXECUTANDO` (uma execução `VIVA`) |
| 10 | Motor (autor) | monta **só** as entradas da etapa; confere insumos (`_faltas_do_autor_real`); monta contexto; roda o agente vigiado; confere evidências; **grava a resposta no banco**; só então apaga a pasta | `executar_etapa` ► workflow `executar_etapa_v1` ► `executar_e_salvar`: `_entradas_da_etapa`, `_ficha`, `montar_contexto_real`, `_rodar_vigiado` ► `ExecutorHermes.rodar`, `coletar_evidencias`, `registrar_resposta_execucao`, `executor.limpar` | execução `RESPONDIDA` |
| 11 | Motor + validador | **portão 1**: `validar` no texto guardado; grava a ação do autor e `PORTAO1_OK`/`PORTAO1_RECUSOU` na mesma transação | `conferir_e_aplicar` ► `validador.validar` | `REVISAO` (ou volta ao autor com o item exato; ou `EM_RESOLUCAO`, `ESPERANDO_FUNDADOR` conforme a ação) |
| 12 | Motor (revisor) | outro agente (**nunca o autor** nem quem julga a peça depois) recebe entrega + rubrica e responde um veredito por critério com prova | `_revisar` ► `INICIAR_REVISAO` ► workflow `revisar_etapa_v1` ► `executar_e_salvar_revisao` | execução do revisor `VIVA` ► `RESPONDIDA` |
| 13 | Motor | **portão 2**: rubrica completa e toda `PASSOU` com prova ► `APROVAR` do revisor | `conferir_e_aplicar_revisao` ► `conferir_rubrica` | `APROVADA` (E54); se a peça é julgada pelo Parecer: `ESPERANDO_FUNDADOR` (E74), que só sai com o `APROVAR` do fundador (E81) |
| 14 | Banco (automático) | quando todas as etapas estão `APROVADA`/`PULADA`, dispara `TODAS_PRONTAS` ► card fecha e manda `CARD_PRONTO` às etapas | `aplicar_evento` (C12, E110) | card `PRONTO`; etapas `PRONTA`; a ação externa **proposta** (se houver) nasce aqui, como ação do fundador |
| 15 | Vigia / avisos | alarmes se algo parar; aviso de card pronto ao Telegram | `vigilancia.Vigia`, trigger `_telegram_avisar_estado_card` (0026) | — |

Pontos que costumam surpreender:

- O plano de um **pedido v2 avulso** tem só `E1` (o serviço) e, se o serviço é julgado pelo Parecer, `E2 = SRV-PARECER`; **não** inclui `SRV-RELATORIO-FINAL`. O relatório final só existe como última etapa de um roteiro (`playbooks/`).
- `PRONTO` não é entrega, nem publicação. Ação externa (enviar, publicar, contatar, pagar) só nasce **depois** do card pronto e só com o OK registrado do fundador; o código do motor **não emite** ações externas (`NÃO EXISTE` destino real). Publicação é um fluxo separado (`pedir_publicacao`, tabela `publicacoes`) e o `Publicador` não está ligado a serviço nenhum.
- Cada passo é idempotente por desenho: a resposta do agente é gravada antes de qualquer outra coisa e o mesmo identificador de workflow devolve o resultado já registrado. Se a VPS cair depois de gravar, retoma sem repetir o agente; se cair entre o retorno do ChatGPT e a gravação, **pode repetir a chamada** (e gastar cota).
- O fundador pode tocar (`APROVAR`, `PEDIR_AJUSTE`, `CANCELAR`, `RESPONDER`, `PAUSAR_TUDO`, `MUDAR_PRIORIDADE`, `MUDAR_PRAZO`…) a qualquer momento; todo toque leva a **versão que ele viu**. Versão antiga vira comentário no card, nunca muda estado. Prioridade e prazo só mudam por toque do fundador.

**Tarefa real legada (a outra entrada).** `preparar-tarefa-real` (`fonte_supabase` + `preparacao`, saída privada fora do Git, estado `AGUARDANDO_CONFIRMACAO`) ► o fundador registra a solicitação autenticada pelo site (`solicitar_card_real`) ► `consumir-pedido-real` (`Motor.criar_card_real`: confere o pedido, a proveniência e o hash, o pacote da empresa, as entradas externas; roteiro do banco; `consumir_solicitacao_card_real`) ► `avancar-card-real` ou o despachante. Daí em diante o ciclo é o mesmo a partir do passo 6.

---

## 11. Mapa de testes e CI

### 11.1 Qual suíte testa o quê (contagens de testes **coletados** em 17/10/2026 neste checkout, com `pytest --collect-only`)

| Suíte (pasta) | Testa | Como rodar localmente | Precisa de | Testes |
|---|---|---|---|---|
| **Especificação** (`helena-v2/`) | `test_validar.py`: cada regra do `validar.py` com teste de **mutação**; `maquina/test_maquina.py`: a prova e o `replay` da máquina; `test_continuidade.py`: a receita visual da v1 arquivada contra reversões de segurança; `test_operacao_vps.py`: o passo do workflow da VPS com SSH e instalador falsos | `cd helena-v2 && pip install -r requirements.txt && python validar.py && python -m pytest -q` (cerca de 7 min segundo o README) | Python 3.13, PyYAML, jsonschema | 304 |
| **Banco** (`supabase/migrations-v2/testes/`) | esquema, gerador de passagens (o SQL do git = o que o YAML gera hoje), jornadas, diferencial contra a referência, as 13 regras de ferro, escrita direta recusada, todos os RPCs das migrations 0005–0026 (publicação, configuração, pedidos reais, coordenação, relógio, auditoria de ativações, pedido v2, Telegram…), ataques (`test_ataque_*`), backup e restauração | `cd supabase/migrations-v2 && pip install -r requirements.txt && python gerar_passagens.py --conferir && python -m pytest` | PostgreSQL 16 local: sobe um cluster próprio em `/tmp/pg-helena-v2-*` (127.0.0.1, porta 54329; `HELENA_V2_PG_BIN` aponta o `bin`) ou usa `HELENA_V2_TESTE_DATABASE_URL` | 536 |
| **Orquestrador** (`motor/orquestrador/testes/`) | veja a tabela 11.2 | `cd motor/orquestrador && pip install -r requirements.txt && PYTHONPATH=.:../executor:../validador:../ferramentas python -m pytest -q` (`HELENA_V2_PULAR_TESTES_LONGOS=1` pula durabilidade e despacho) | PostgreSQL 16 como acima; `dbos==3.2.0` | 505 |
| **Executor** (`motor/executor/testes/`) | ficha, perfil e gabarito, ambiente, processo e árvore, classificação de falha, conferência, segredos, uso, registro, conformidade de **todo** executor aprovado, troca de modelo, adaptadores EVE/OpenClaw contra falsos, mutações | `cd motor/executor && pip install -r requirements.txt && python -m pytest -q` (cerca de 3 min) | Python; o diretório temporário do pytest tem de estar **fora** de qualquer repositório Git | 638 (631 + 7 pulados de propósito, segundo o README) |
| **Executor, real** (`motor/executor/verificacao_real/`) | 19 cenários com o binário `hermes` real e provedor falso local | `pytest verificacao_real --autorizar-hermes-real` num venv com `requirements-hermes-real.txt` | **frase exata do fundador**; **não roda no CI** e não foi executado com o Hermes real (README) | 19 |
| **Validador** (`motor/validador/tests/`) | banco de casos (60+ defeitos plantados e 20+ honestas), casos da especificação, cada CHK por tipo, cobertura, mutação, desempenho, robustez, CLI, segurança do código | `cd motor/validador && pip install -r requirements.txt && python -m pytest -q` | Python, PyYAML | 2.394 |
| **Ferramentas** (`motor/ferramentas/testes/`) | endereços, rede (falsos locais com as conferências de produção), limpeza, partes, contador, cópias, protocolo stdio, servidor, mutação (desliga uma trava de cada vez) | `cd motor/ferramentas && pip install -r requirements.txt && python -m pytest -q` | sem internet | 592 |
| **Simulador** (`motor/simulador/testes/`) | 18 invariantes, 28 mutantes, sementes aleatórias, reprodutibilidade, referência × máquina real | `cd motor/simulador && pip install -r requirements.txt && python -m pytest -q` (`-m "not lento"` pula as sementes na máquina real; `SIM_SEMENTES_MAQUINA=200` aprofunda) | PyYAML, jsonschema | 727 (README diz 723) |
| **App** (`src/**/*.test.ts(x)`) | telas e repositórios do site (Vitest, jsdom) | `npm ci && npm test && npx tsc --noEmit -p tsconfig.app.json && npm run build` | Node 20 | NÃO CONTADO |
| **hermes-vps** (`motor/hermes-vps/`) | `test_atualizar_v2.py` (bundles sintéticos; recusa migrations alteradas) | `python3 -m unittest discover -s motor/hermes-vps -p test_atualizar_v2.py` (rodei: 10 testes OK) | git, bash | 10 |
| **Login do Hermes** (`motor/hermes-vps/testar-patch-hermes-auth.py`) | 17 casos do patch, dados sintéticos | com o Python do **venv do Hermes**, depois de aplicar o patch | `hermes-agent` 0.19.0 instalado | 17 (não rodei aqui) |
| **Telegram** | `motor/hermes-vps/telegram-v2/test_telegram_v2.py` (adapter) e `supabase/functions/helena-v2-telegram/core.test.mjs` (Edge, `node:test`) | adapter: precisa da fonte do Hermes 0.15.1 (`HERMES_015_SOURCE`); Edge: comando exato NÃO CONFIRMADO | fora do CI | — |

### 11.2 Orquestrador: arquivo de teste ► módulo coberto

| Teste(s) | Cobre |
|---|---|
| `test_motor_real`, `test_motor_sem_fixtures`, `test_jornada`, `test_pedido_v2`, `test_casos`, `test_seguranca`, `test_rubrica` | `motor.py` (caminho real nunca alcança fixtures; card até `PRONTO`; coordenação retomada; portão 1 e 2; cancelamento em até 15 s; pedido v2 até card; recusas) |
| `test_durabilidade` | queda e retomada: 20 reinícios, 20 `kill -9` de processo de verdade, 5 trocas de versão de código, dois motores no mesmo card |
| `test_despacho` | `despacho.py` (fila, vagas, `TETO_DE_VIVAS`, card com erro, perda de conexão) |
| `test_triagem_pedido`, `test_triagem_pedido_pg`, `test_mapa_operacional` | `triagem_pedido.py` (sem modelo externo) e a entrada v2 até proposta e card em PostgreSQL descartável; `mapa_operacional.py` |
| `test_vigilancia`, `test_relogio`, `test_publicacao` | `vigilancia.py` (inclusive sessão somente leitura), `relogio.py`, `publicacao.py` |
| `test_configuracao`, `test_validacao_real` | `configuracao.py` e o comando `validar-configuracoes` contra a conta real `helena_motor` em PostgreSQL local |
| `test_bancos`, `test_producao_contas` | `bancos.py` (sem DNS nem socket) e as duas contas reais + esquema do DBOS (`supabase/migrations-v2/producao/`) |
| `test_fonte_supabase`, `test_preparacao_real` | `fonte_supabase.py` (nenhum teste abre rede), `preparacao.py` (capturas sintéticas) |
| `test_evidencias`, `test_contexto_real`, `test_plano` | `evidencias.py`, `contexto_real.py`, `plano.py` |
| `test_cli` | `__main__.py` (runtime real recusa o que falta; DSN e token nunca saem na mensagem; vigia/relógio só com `HELENA_V2_DATABASE_URL`) |
| `test_instalacao` | `instalacao.py`: aplica os mesmos arquivos gerados num PostgreSQL local |
| `test_placar_revisor` | `placar_revisor.py` com revisores de mentira |

### 11.3 O que o CI roda e em quantos jobs

Workflow `.github/workflows/helena-v2.yml` (`name: Helena v2`), disparado em **todo pull request**, em push para `main` e `missao-cumprida-v4`, e manualmente; `concurrency` cancela a execução anterior da mesma ref. **Dez jobs**:

| # | Job | O que roda |
|---|---|---|
| 1 | Especificação (`helena-v2`) | `python validar.py` + `python -m pytest -q` (Python 3.13) |
| 2–5 | Motor (matriz `ferramentas`, `validador`, `executor`, `simulador`) — 4 jobs | `pip install -r requirements.txt` + `python -m pytest -q` em cada pasta |
| 6 | App (testes e build) | `npm ci`, `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build` (Node 20) |
| 7 | Banco v2 | PostgreSQL 16 de serviço; `gerar_passagens.py --conferir` + `pytest` |
| 8–10 | Orquestrador v2 (matriz: **rápidos**, **durabilidade**, **despacho**) — 3 jobs, cada um com seu PostgreSQL 16 | `pytest -q -rf --tb=short` com `--ignore=testes/test_durabilidade.py --ignore=testes/test_despacho.py` / só durabilidade / só despacho; `PYTHONPATH=.:../executor:../validador:../ferramentas`; antes, silencia o eco de erros do log do PostgreSQL |

Fora desse workflow: `helena-vps-motor.yml` (manual, 1 job `vps`, opera a VPS; não homologado) e três verificações **da v1** que só disparam se `services/helena-gateway`, `services/laya-service` ou `services/meowcaller-service` mudarem (proteção da DEC-028). **Nunca rodam no CI:** `verificacao_real/`, o teste do login do Hermes, os testes de `hermes-vps` (inclusive `test_atualizar_v2.py`), os do Telegram e o teste da Edge. Verde nos dez jobs = pode seguir; vermelho = não junte (`docs/manual/como-mudar.md`).

---

## 12. Como mudar com segurança, por componente

Regra geral: ramo novo (nunca direto na `main`); rodar o menor conferente primeiro; não escrever a mesma regra em dois lugares; decisão importante vira nota curta em `docs/decisoes/` e uma linha no `HANDOFF-CLAUDE-CODE.md`.

| Componente | Fonte da mudança | Rode antes de comitar | Cuidado |
|---|---|---|---|
| Modelo de um agente | uma linha em `helena-v2/models.yaml` | `python validar.py`; `motor/executor` `test_troca_de_modelo.py` | sem reserva; apelido de um papel só; troca do `revisao-padrao` exige o teste 9 de novo (política em `models.yaml`) |
| Ficha de agente | `helena-v2/agents/<nome>.yaml` | `python validar.py` | id, nome, função, grupo, serviços, ações, ferramentas, revisor, reserva e aptidões são **espelho** do catálogo (mude o catálogo primeiro) |
| Catálogo (dono, revisor, reserva, estado, empresas) | `helena-v2/servicos.yaml` (+ `organograma.yaml` se for resumo do agente) | `python validar.py` e `pytest` de `helena-v2` | MAT-01…25: teto de 3 titularidades, revisor ≠ dono, pacote `CONFIRMADO`, ordem de ativação; mexer em `estado` de serviço também mexe em `plano.validar_plano` e na triagem |
| Formato de uma entrega | `helena-v2/deliverables/<tipo>.yaml` | `python validar.py`; testes do validador; `python -m spec_helena --atualizar-readme` | os números das CHK moram aqui e o código lê de lá |
| Checagem do portão 1 | `motor/validador/validador/checagens/spec_<tipo>*.py` | `pytest` do validador (inclui mutação) | mesmo id/gravidade/furos da especificação; caso bom **e** caso defeituoso; falha fechada |
| Regra do card (estado, prazo, teto) | `helena-v2/maquina/passagens.yaml` (+ `vocabulario.yaml`) | `python helena-v2/maquina/provar.py` ► `python supabase/migrations-v2/gerar_passagens.py` ► `pytest` do banco ► `pytest` do simulador | o SQL 0002 é **gerado**; isto muda a máquina: exige **migração nova**, prova e o fundador (a configuração não pode carregar máquina diferente da compilada) |
| Função/permissão do banco | migration **nova** `supabase/migrations-v2/00NN_*.sql` (nunca editar uma já aplicada) | `pytest` do banco (e o do orquestrador se o motor usa) | sem `BEGIN/COMMIT` dentro do arquivo (o roteiro de instalação põe tudo em uma transação); reaplicar a 0004 revoga permissões novas; **aplicar em produção só com a frase do fundador** |
| Motor, despacho, bancos | `motor/orquestrador/orquestrador/*.py` | os três grupos do orquestrador (PostgreSQL local) | não relaxar portões de conexão; novo evento do motor precisa existir na tabela de passagens |
| Executor/perfil/gabarito | `motor/executor/executor_helena/*.py` | `pytest` do executor (inclui conformidade e mutação) | gabarito e `montar_config` mudam juntos; falha só por registro; novo runtime = adaptador + conformidade + dia de prova |
| Ferramentas de leitura | `motor/ferramentas/ferramentas_helena/*.py` | `pytest` de ferramentas | mutação vermelha = trava perdida; nada que escreva fora da pasta da execução |
| Instaladores da VPS | `motor/hermes-vps/*.sh`, `*.py` | `test_atualizar_v2.py`; `test_operacao_vps.py`; revisão humana | não rodar na VPS sem o fundador; `tudo` não é atualização; manter o Hermes 0.15.1 separado |
| Mapa de rotas da triagem | `ROTAS` em `mapa_operacional.py` | `test_mapa_operacional.py` | conferir com `src/App.tsx` |
| Site (`src/`) | React/Vite | `npm test`, `tsc`, `build` | o site **nunca** decide estado; o banco decide de novo; sem chave no cliente |

---

## 13. Como adicionar um serviço ou um agente ao catálogo

Primeiro, **verifique o que já existe** (`JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE`): `python helena-v2/validar.py` mostra as 13 fichas ausentes; `servicos.yaml` já tem 22 serviços (um por tipo de entrega).

### 13.A Dar ficha a um agente que já existe no catálogo (um dos 13 pendentes)

1. Copie a estrutura de uma ficha pronta (`agents/caio.yaml` é a mais comentada) para `helena-v2/agents/<nome-sem-acento-minusculo>.yaml`. O nome do arquivo é `identidade.lower()`.
2. Preencha como **espelho** do catálogo: `id`, `identidade`, `nome`, `funcao`, `grupo`, `escopo`, `empresas`, `servicos[]` (ações, ferramentas, revisor, reserva), `revisao.aptidao` (= `agentes.<NOME>.revisa` de `servicos.yaml`), `fase_de_ativacao`, `estado`. Decida na ficha: `orcamento` (conta explícita: `chamadas_total >= buscas + partes_de_pagina + 1`; `tempo_s` é estimativa), `modelo` (apelidos), `vagas`, `regras` (≤ 12, verificáveis), `nunca`.
3. Se o serviço dele ainda não tem tipo de entrega em `deliverables/<tipo>.yaml`, crie-o (13.C). Crie os **casos** do serviço em `helena-v2/casos/<SRV>/` (≥ 3 bons e ≥ 4 defeitos plantados, com `deve_falhar_em` apontando uma CHK/RUB que existe).
4. `python helena-v2/validar.py`: a contagem da pendência cai de 13 para 12 (a pendência continua válida enquanto faltar **no máximo** 13; remova a linha de `PENDENCIAS.yaml` só quando zerar). Rode os testes da pasta.
5. O serviço continua `RASCUNHO`: não recebe card real. Subir para `ESTAGIO` é decisão do fundador (seção 8.4).

### 13.B Serviço novo para um agente existente

1. `servicos.yaml`, em `servicos:`: todos os campos (`id`, `nome`, `dono`, `tipo_de_entrega`, `entrega`, `revisor`, `reserva`, `acoes_permitidas`, `ferramentas`, `usa_internet`, `efeito: interno`, `acao_externa_permitida`, `acoes_do_fundador` (≤ 1), `julgado_pelo_parecer`, `modelo_menor`, `fase_de_ativacao`, `estado: RASCUNHO`, `empresas` (só pacote `CONFIRMADO`), `escolhivel`/`avulso` (se `escolhivel`: 3 a 5 exemplos de pedido), `pronto_padrao`, `nao_atende`…). Atualize o índice `agentes:` (`possui`, e `revisa` de quem for revisor/reserva, com o estado de aptidão), `mapa_de_areas`, `pedidos_de_fronteira` e `ordem_de_ativacao` se for o caso.
2. Atualize a ficha do dono (13.A) e, se houver mudança de resumo, `organograma.yaml` (fase/estado derivados — regra MAT-13).
3. Tipo de entrega e casos (13.C e passo 3 de 13.A).
4. `python validar.py` até ficar sem `ERRO`. Cada mensagem traz `[REGRA]`; a descrição da regra está no `@regra` correspondente.
5. Roteiro (opcional): `playbooks/<meta>.yaml` segue `playbook.schema.json` e as regras `ROTEIRO-*` (grafo sem ciclo, relatório final por último, parecer que julga o que é `SEMPRE` julgado, orçamento que cabe nas fichas).

### 13.C Tipo de entrega novo (e suas checagens)

`deliverables/<tipo>.yaml` com `tipo`, `servico`, `dono`, `secoes[]` (ids únicos no tipo), `limite`, `checagens_codigo[]` (id `CHK-…` único em todo o repositório, gravidade, furos, `parametros`), `rubrica[]` (ids `RUB-…` únicos), `criterio_de_pronto` (cita só ids do próprio tipo e inclui toda a rubrica), `entrada_minima`, `revisor_confere`. Valide contra `schemas/entrega.schema.json`. A lógica de cada `CHK` vai em `motor/validador/validador/checagens/spec_<tipo>*.py` (seção 4). **Atenção:** o validador de produção é código do checkout; uma CHK nova só funciona na VPS depois de o código ser implantado.

### 13.D Agente novo além dos 21 (uma 22ª identidade)

Isto **não é mudança de configuração**: as identidades fazem parte da máquina (`maquina/vocabulario.yaml`, `identidades.agentes`; e o `CHECK` gerado no 0002 para `etapa.autor`). Exige alterar o vocabulário, regenerar o SQL (`provar.py` ► `gerar_passagens.py`), uma **migration nova**, prova e o fundador — e `validar_bundle` recusa qualquer revisão cuja `maquina/` difira da compilada. Combine com o fundador antes; o organograma tem número fixo de 21 por desenho. Os personagens da eLiving™ (Sirlene, Doutor Vital, Alex, Rafael) **não** são agentes.

### 13.E Levar a mudança até a produção (ordem importa)

1. Merge do código e dos `casos/` no repositório; **implantar o código na VPS** (preparar com `atualizar-v2.sh`, cutover por procedimento separado). Sem isso `validar_bundle` falha por falta de `casos/` ou de CHK no checkout da VPS.
2. Na tela `/configuracoes`: **Clonar** a revisão ativa, trocar o conteúdo (os arquivos de `helena-v2/`), **Salvar** e **Pedir validação**.
3. `bash instalar-motor.sh validar-config` na VPS (ou aguardar o ciclo que o fundador acionar). Se vier `RASCUNHO` com erro, leia o motivo, corrija e repita.
4. O fundador **Ativa** a revisão `VALIDADA`. Cards antigos continuam na revisão deles.
5. Só então o serviço (em `ESTAGIO`/`ATIVO`, com pacote `CONFIRMADO` e agente ligado na `ordem_de_ativacao`) pode aparecer na triagem e receber card.

---

## 14. Como depurar um card parado (somente leitura)

**Regras da depuração:** consulte antes de agir; use transações `READ ONLY`; **não** chame `aplicar_evento` à mão, **não** reaplique evento, **não** edite linhas, **não** reinicie serviço, **não** rode o Hermes. Se um comando já gravou algo antes de falhar, o estado manda: leia o card antes de repetir. Antes de qualquer consulta ao banco: confirmar o projeto `wxkgrykduqtsgmjkzlou`; para carregar contexto, ler `public.checkpoint_mestre_atual` primeiro (`docs/manual/comando-mestre.txt`). Sem conexão autorizada, declare: `SUPABASE NÃO CONECTADO — não é possível carregar o Sistema Helena com segurança.` A resposta guardada de uma execução contém texto de agente e do pedido: não a cole em lugar público.

### 14.1 Consultas (modelo; substitua `<CARD>`; colunas conferidas em `0001_esquema.sql`)

```sql
begin read only;

-- 1. o card: quem tem a bola e até quando (não selecione ordem_de_servico inteira: é grande)
select id, estado, dono, prazo_ate, prioridade, prazo, empresa, left(titulo, 80) as titulo,
       chamada_helena, atualizado_em,
       ordem_de_servico->>'config_revision_id' as revisao, ordem_de_servico->>'modo_contexto' as modo
from helena_v2.card where id = '<CARD>';

-- 2. as etapas atuais
select codigo, estado, dono, prazo_ate, versao, execucao_atual, portao1_ok, entrega_fresca,
       autor, revisores_validos, depende_de
from helena_v2.etapa where card_id = '<CARD>' and atual order by ordem;

-- 3. execuções: alguma VIVA há muito tempo?
select numero, tipo, estado, etapa_id, iniciada_em, encerrada_em, now() - iniciada_em as ha
from helena_v2.execucao where card_id = '<CARD>' order by numero desc limit 20;

-- 4. os últimos eventos, inclusive os recusados (a causa quase sempre está aqui)
select id, momento, maquina, alvo_codigo, papel, evento, resultado, motivo,
       estado_antes, estado_depois, chave, conta
from helena_v2.historico where card_id = '<CARD>' order by id desc limit 40;

-- 5. entregas e resultado do portão 1
select etapa_codigo, versao, numero_execucao, portao1, criada_em, left(relatorio_validacao::text, 1500) as relatorio
from helena_v2.entrega where card_id = '<CARD>' order by id desc limit 10;

-- 6. o workflow durável (esquema do DBOS; id contém o id da etapa ou do card)
select workflow_uuid, status, name, recovery_attempts, left(error, 300) as erro,
       to_timestamp(updated_at / 1000.0) as atualizado
from dbos_helena_v2.workflow_status
where workflow_uuid like '%<ETAPA-OU-CARD>%' order by created_at desc limit 10;

rollback;
```

`helena_v2.vigia()` (as 13 regras de ferro), `ler_resposta_execucao(numero)` e `ler_resposta_coordenacao(numero)` são do papel `service_role`; **NÃO CONFIRMADO** que o conector de consulta de uma sessão possa `SET ROLE service_role` (o próprio `instalacao.py` marca essa dúvida). Nesse caso, peça a leitura ao fundador/operador ou use o vigia na VPS (`vigiar --uma-volta` só lê). Pela tela do site, o fundador vê o card, a pergunta atual e a leitura de volta da Helena (RPCs `ler_pergunta_etapa_fundador`, `ler_leitura_card_fundador`).

### 14.2 Na VPS (somente leitura, por quem tiver acesso legítimo)

`bash /opt/helena-v2/repo/motor/hermes-vps/instalar-motor.sh estado`; `systemctl is-active helena-vigia helena-relogio helena-despachante`; `journalctl -u helena-despachante -n 80` (procure `ERRO AO AVANCAR card=…`, `VAGA PERDIDA`, `ERRO NA ENTRADA V2`, `ERRO NA TRIAGEM`, `ERRO AO CONSUMIR plano=…`); `tail -n 50 /var/log/helena-v2/alarmes.log`; `bash motor/hermes-vps/inventario.sh`. Não abra `motor.env`, `auth.json` nem logs fora do que o serviço já imprime.

### 14.3 Sintoma ► causa provável ► onde olhar

| O que você vê | Causa provável | Onde olhar / o que significa |
|---|---|---|
| Card em `RASCUNHO` sem execução `HELENA` | despachante desligado, sem vaga, ou o card está em espera de 30 s depois de erro | `systemctl`; journal (`ERRO AO AVANCAR`, `ESPERANDO_VAGA`); consulta 3 e 4 |
| `ESPERANDO_CONFIRMACAO` | **é a vez do fundador** (`dono = FUNDADOR`); pedido grande, `HELENA_FALHOU`, `PLANO_INVALIDO` ou `VALIDADOR_FALHOU` | `historico.vars_depois` / `motivo`; lembretes em 24 h e 48 h e depois cancela por padrão (nunca aprova) |
| `VALIDANDO_PLANO` por mais de ~1 min | o motor não rodou `avancar` (despachante parado) ou o validador falhou | o relógio dispara `TEMPO_ESGOTADO` aos 60 s: na 1ª vez o validador roda de novo (C30); na 2ª o card vai ao fundador com `VALIDADOR_FALHOU` (C31) |
| Etapa `EXECUTANDO` com execução `VIVA` antiga | agente travado, processo órfão, queda do motor | vigia: `EXECUCAO_PARADA` (> 1 h); consulta 6 (workflow `PENDING`/`ERROR`); o relógio vence o prazo da ficha (`tempo_maximo_s`) |
| Etapa `EM_RESOLUCAO` com `REGISTRAR_FALHA` / `FALTAM_DADOS` e `conteudo.motivo = INSUMOS_INSUFICIENTES` | `_faltas_do_autor_real` achou o que falta (`conteudo.faltam[]` lista) — **o agente nem foi chamado** | histórico (consulta 4); falta dado do fundador, pacote ou tabela de leis |
| Etapa `EM_RESOLUCAO` depois de falhas | teto atingido (formato 1, tempo 1, chamadas 1, reprovações 2, infra 3, execuções 6) | `vars_depois` no histórico; a Helena recomenda e o fundador decide |
| Etapa parada com falha de classe `COTA` | espera de capacidade: não gasta tentativa; aviso em 1 h; em 6 h o fundador escolhe | `historico.parametros`/`conteudo` (`classe`), `voltar_em_s` |
| Falhas repetidas de classe `LOGIN` | login do Hermes vencido, ou o patch de autenticação ausente (seção 7.4) | `instalar-motor.sh conferir` (`--check` do patch); refazer o `login` é decisão do operador |
| Etapa em `REVISAO` e o journal repete `revisor não aprovou todos os critérios com prova` | o revisor reprovou um critério e o motor **não** emite `REPROVAR` (limite conhecido, seção 15) | `ler_resposta_execucao` do revisor (service_role); consulta 6 mostra o workflow em erro (**dedução**: o mesmo identificador de workflow devolve o mesmo erro) |
| Card novo não começa | `TETO_DE_VIVAS`: outro card em voo (WIP), ou execução `VIVA` órfã de outro card segura a vaga | `despacho.fila()` (campos `em_voo`, `outros_cards_em_voo`); vigia depois de 1 h; relógio/fundador resolvem |
| Erro `fontes reais do card não conferem com a captura` | a linha de origem (tarefa, checkpoint, decisão, portfólio) mudou depois da captura (card legado) | não altere a fonte para "fazer passar"; peça nova captura e solicitação autenticada |
| Erro `revisão de configuração ausente` / `CONFIG_*` | revisão fixada inexistente, hash não confere, ou nova ativação sem card compatível | `helena_v2.configuracao` e `configuracao_ponteiro` só por função; `listar_ativacoes` (fundador) |
| `CARD_PARADO` (6 h sem evento) | qualquer dos acima sem alarme anterior | o texto do alarme traz o id do card; comece pela consulta 1 |

---

## 15. Armadilhas conhecidas

1. **TLS do pooler com CA.** O motor só aceita conexão `sslmode=verify-full` **verificada contra a CA do sistema** (`ssl.get_default_verify_paths().cafile`) e não deixa desligar. O *session pooler* do Supabase usa uma CA própria que não está no pacote do Debian/Ubuntu; por isso `instalar-motor.sh` baixa a CA, **confere a impressão digital fixa**, junta ao pacote do sistema em `/etc/helena-v2/ca-bundle.crt` e aponta `SSL_CERT_FILE` no `motor.env` (as três unidades herdam). Sintomas de erro: `arquivo de CA do sistema indisponível`, falha de verificação do certificado, ou `DSN fora do formato … com TLS verificado`. Não "conserte" com `sslmode=require`, `PGSSLMODE` ou `PGSSLROOTCERT` (o motor recusa qualquer `PG*`). A URL só passa se: porta 5432, caminho `/postgres`, **um único** parâmetro `sslmode=verify-full`, host em minúsculas e, no pooler, usuário `papel.<ref do projeto>`. O DBOS recebe `sslrootcert` por `db_engine_kwargs`. Senha com caracteres especiais vai codificada na URL (use `montar_url`). O motor só aceita a porta 5432 (*session pooler* ou conexão direta), e o despachante depende de *advisory locks* de sessão.
2. **Defeito de login do Hermes 0.19.0** (seção 7.4): a renovação do token de um perfil isolado se perde porque o perfil é apagado; sem o patch, o primeiro token renovado quebra os cards seguintes. O patch só aceita os dois arquivos com hash conhecido; **não troque o pin** do Hermes sem refazer a revisão. Não copie `auth.json` para a pasta da tarefa e não aponte `CODEX_HOME` para o login do operador (a conferência pós-execução recusa).
3. **WIP = 1.** O despachante roda `--vagas 1`: um card em voo por vez, e dentro do card o motor roda **um agente por vez** (o despachante chama `avancar` e espera o workflow terminar). A vaga é um *advisory lock* de sessão; uma segunda instância com `--vagas 1` fica em `ESPERANDO_VAGA`. O campo `vagas` das fichas (`trabalho: 2`) é **planejamento**: o motor não o lê. Execução `VIVA` órfã em card do motor segura card novo até o relógio ou o fundador resolverem (o vigia avisa depois de 1 h). Sobre a esteira autônoma, o `AGENTS.md` manda respeitar WIP executivo = 1; já **comandos diretos do fundador** para criar empresa, conta ou entidade têm precedência soberana (DEC-022) e não passam por esta fila.
4. **Hermes 0.15.1 é outra coisa.** O assistente do Telegram (`/usr/local/lib/hermes-agent`, login em `/root/.hermes`) **não** é o executor do motor (`/opt/helena-v2/venv-hermes`, 0.19.0, usuário `helena`). Não "unifique" os dois, não aponte `HELENA_V2_HERMES_HOME` para `/root/.hermes`, não instale o motor no venv do 0.15.1 e não aplique o patch de Telegram na VPS enquanto o corte não estiver validado. Duas dependências incompatíveis: DBOS e `hermes-agent` ficam em venvs separados.
5. **`fase_em_curso='fase 3'` está fixo no código** (`plano.py`, `Motor._ficha`, `triagem_pedido.py`). Por isso `ler_pagina` (desde "fase 3") entra no perfil e `buscar` (desde "fase 4") **fica de fora**, com aviso, mesmo que a ficha a liste. Para ligar a fase 4 é mudança de código + decisão do fundador sobre custo da busca.
6. **A revisão é dado; o resto é código do checkout.** Casos, `validar.py`, `provar.py`, validador, executor e máquina vêm do checkout da VPS, não da revisão. Revisão válida no site pode falhar na VPS por falta de código/casos (seção 13.E). Máquina ou schemas diferentes da versão compilada nunca validam sem migração.
7. **SQL gerado.** `0002_passagens_geradas.sql` nunca se edita à mão (o teste `test_02_gerador` e o CI comparam com o gerador). Migration aplicada não se edita: crie a próxima.
8. **Gravar antes de validar.** Não reordene `executar_e_salvar` para validar antes de gravar nem limpar a pasta antes do `registrar_resposta_execucao`: é o que torna a retomada sem repetir o agente. A janela entre o retorno do provedor e a gravação continua existindo.
9. **Revisor que reprova não devolve ao autor.** A tabela de passagens prevê o caminho, mas o motor não emite `REPROVAR`: critério não aprovado levanta erro e a etapa fica à espera do relógio/vigia. Corrigir exige código no motor, teste e atenção ao teto de 2 voltas.
10. **Parecer bloqueado.** `SRV-PARECER` precisa de tabela de leis publicada pelo fundador com versão `FON-LEIS-v<n>`; a captura atual não a traz. Consequências: `criar_card_pedido` recusa plano com Parecer, a triagem marca `PEDIDO_FONTE_LEIS_AUSENTE` e `_faltas_do_autor_real` impede a chamada. Serviços `SEMPRE` julgados (copy, treinamento) herdam o bloqueio. Nunca peça a uma IA para escrever o texto de uma lei.
11. **Pacote com cara de segredo recusa a execução.** `gerar_perfil` levanta `ErroDePerfil` se o pacote contiver algo que pareça chave/token/URL com senha; um pedido do fundador com um trecho assim bloqueia o card. Pastas de execução e perfil **fora de qualquer repositório Git** (`.git` acima = recusa) e, nos testes, o diretório temporário do pytest também.
12. **Alarme é arquivo local.** O vigia grava em `/var/log/helena-v2/alarmes.log`; webhook só com `--canal-webhook`, que a unidade não passa. Se a VPS cair, nada avisa. Alarme por celular continua NÃO COMPROVADO.
13. **`DestinoFalso` mente.** Marca o pedido como `PUBLICADA` sem publicar. Não o ligue num banco real. O `Publicador` real e o destino de publicação não existem.
14. **`instalar-motor.sh tudo` não é atualização**, e seu `HELENA_REF` padrão é `main` (não fixa commit). Atualize por `atualizar-v2.sh` (staging, sem ativar) e cutover com baseline idêntico, jobs ociosos, backup verificado e rollback ensaiado. O workflow SSH do GitHub não está homologado.
15. **Estado documentado ≠ estado real.** Relatos de 17/10 (serviços ligados, revisão ativa, login feito) divergem entre si em alguns documentos (por exemplo, "revisão técnica ativada" × "não havia revisão ativa"). Não os use como fato: consulte o banco e o inventário.
16. **Fusos.** Prazos e "hoje" usam `America/Sao_Paulo`; `prazo` de card exige fuso explícito; o relógio trabalha com `timestamptz`.
17. **Dois hashes diferentes.** `configuracao.hash_bundle` (JSON canônico, Python) é só guarda de integridade do snapshot; a autoridade para o registro é o SHA-256 de `jsonb::text` calculado pelo PostgreSQL.

---

## 16. O que NÃO foi confirmado nesta leitura

- Qualquer fato sobre produção: serviços ligados, versão do código na VPS, revisão ativa, `venv-hermes` com ou sem patch, login do ChatGPT, saldo de cota, mensagens reais de Telegram, deploy da Edge, estado do site.
- Que o Hermes real execute um card de ponta a ponta (a prova de 17/10 foi uma chamada mínima direta); que a renovação de token funcione por 48 h; o consumo de tokens por tarefa.
- Que uma vaga (advisory lock) sobreviva a chamadas de minutos através do pooler real.
- O comportamento do DBOS 3.2.0 com workflows pendentes de outra `application_version` em produção, e com um mesmo identificador de workflow que terminou em erro (inferido do código).
- Que exista código executando o cálculo de "apto" do serviço ou o botão de publicar serviço; que `orcamento_diario_v2` seja imposto (não há ocorrência no código).
- Comandos exatos para rodar o teste da Edge (`core.test.mjs`) e para os testes do adapter do Telegram sem a fonte do Hermes 0.15.1.
- Os pontos que os próprios módulos marcam como **NÃO COMPROVADO**: canal de alarme independente; Hermes real chamando o servidor de ferramentas dentro de um card.
- O formato exato de `entrega.relatorio_validacao` (vem de `Relatorio.para_dict()`); por isso a consulta 5 corta o texto.

---

## 17. Onde ler mais

- Retomada e estado datado: `docs/manual/onde-estamos.md`, `docs/manual/mapa-do-sistema.md`, `docs/manual/mapa-de-reaproveitamento.md`, `docs/manual/restauracao-funcionalidades.md`, `docs/manual/como-a-fabrica-funciona.md`, `docs/manual/como-mudar.md`.
- Triagem e entrada: `docs/manual/guia-da-triagem.md`, `docs/manual/entrada-unificada.md`, `docs/manual/telegram-virada-para-v2.md`.
- VPS e Hermes: `docs/manual/retomada-hermes-vps.md`, `docs/manual/vps-atualizar-e-corrigir-login.md`, `docs/manual/integracao-hermes-codex.md`, `docs/manual/conectar-runtimes.md`, `docs/auditoria/HERMES-AUTH-2026-10-17.md`, `motor/hermes-vps/LEIA-ME.md`, `motor/hermes-vps/ATUALIZAR-V2.md`, `motor/hermes-vps/telegram-v2/LEIA-ME.md`.
- Primeiro card e dia de prova: `docs/manual/proximos-passos-do-primeiro-card.md`, `docs/manual/dia-de-prova.md`.
- READMEs de cada peça: `motor/orquestrador/README.md`, `motor/executor/README.md`, `motor/validador/README.md`, `motor/ferramentas/README.md`, `motor/simulador/README.md`, `helena-v2/README.md`, `supabase/migrations-v2/README.md`, `supabase/migrations-v2/producao/LEIA-ANTES.md`.
- Marca eLiving™: `docs/manual/eliving/comando-master-eliving.md` (DEC-023).
- Auditoria técnica: `docs/auditoria/AUDITORIA-2026-10-17.md`.



