# Continuidade do fluxo — 30/09/2026

## Estado comprovado

O ciclo comercial completo ainda NÃO foi homologado. Não declarar os 21 agentes operacionais nem a campanha pronta. Preservar a campanha HD-CAMPANHA-20260930-01; não criar substitutas para contornar limites.

- Gateway `aff434a`, publicado do GitHub main no EasyPanel às 19:33:09 UTC, com Success. A versão anterior `cbe82d2` foi publicada às 18:56:40 UTC. `get_job` ganhou leitura manifest/page, 4.000 caracteres por página e revisão SHA-256: não perde conteúdo, recusa mistura de versões e conserva a autorização por agente/empresa. O formato integral legado continua disponível aos consumidores existentes.
- Hermes: `/data/helena-runtime/hermes_workflow_tick.py`, `/data/helena-runtime/hermes_dispatch_once.py` e `/data/scripts/helena_dispatch_poll.sh` instalados com backups. Configuração e recibos em workflow-config.json / workflow-state.json. Lock compartilhado dispatcher.lock, recibo anterior à inferência, sem repetição paga de estado inalterado e reconciliação de resposta externa confirmada.
- Cron existente 90313a626ffe: **every 1h**, no_agent=true; não foi criada automação duplicada. A agenda consulta scripts; só fases elegíveis iniciam modelo. Uma fase por ciclo pode exigir mais de uma hora para uma cadeia inteira.
- Dispatcher aceita liberação vigente e auditada de Helena/Marina, além do despacho explícito. Perfis são conferidos ao vivo contra agente e empresa. Limites de tentativa, WIP=1 e preflight de cota permanecem ativos. Execução limitada a 24 interações / 300s, revisão/continuação 24 / 240s; são tetos, não garantia de conclusão.

## Teste real e causas encontradas

1. Marina, JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f, executou uma vez e submeteu plano às 18:14:38 UTC. Nenhuma arte foi entregue e nenhum filho foi criado.
2. A primeira revisão encerrou sem escrita: get_job integral foi truncado no Hermes. A leitura paginada corrigiu o acesso ao briefing, marca e evidências.
3. A revisão seguinte leu o conteúdo, mas gastou 24 interações investigando dependências e encerrou sem decisão. A regra foi ajustada: falha impeditiva comprovada deve gerar devolução imediata, reservando chamadas para registrar/confirmar. Não elevar modelo nem repetir sem diagnóstico.
4. Retomada supervisionada da mesma sessão, limitada a seis ferramentas: Helena registrou REQUEST_CHANGES em três chamadas, sem novos jobs ou execução. Supabase e página Entregas confirmaram DRAFT / ajustes solicitados. A retomada supervisionada NÃO comprova uma revisão totalmente autônoma desde o início.
5. O consumidor reconciliou a revisão e selecionou COORDINATE para Helena em dry-run sem inferência. O teste real dessa fase retornou NEEDS_ATTENTION, exit_code=1, mantendo DRAFT: a leitura de evidências/eventos atingiu 24 interações. Nenhuma revisão de briefing ou liberação foi feita. Recibo impede repetir o mesmo estado automaticamente.

6. Diagnostico adicional comprovado: revise_task_brief existia no Gateway, mas estava ausente do filtro MCP de Helena/Marina. Corrigidos os dois perfis com backup, preservando credenciais. Preflight real de Helena retornou READY. Provisionador e preflight agora exigem a ferramenta, impedindo nova inferencia com contrato incompleto. Recuperacao supervisionada unica tem recibo brief-recovery-once.json e nao libera producao.

7. A recuperacao de seis ferramentas produziu proposta, mas o Gateway recusou edicao por fontes pendentes: a validacao de liberacao era usada na edicao de DRAFT. Corrigido no commit aff434a: edicao exige vinculos, oito secoes e parecer/versoes; liberacao continua exigindo fontes aprovadas e capacidade de execucao. Teste confirma que editar nao permite liberar fonte pendente. A proposta ja produzida foi reaplicada pelo MCP autenticado, sem nova inferencia. Confirmado success=true, DRAFT, task_version=3054, attempt_count=1, brief_matches=true, revision_events=1, released=false. A recuperacao foi supervisionada; nao equivale a ciclo autonomo homologado.

## Registros e qualidade

- Arte vazia JOB-HR-d4b5b488e4716e749cb7b1392e308424: aprovação antiga invalidada com guarda de versão, evento QUALITY_APPROVAL_REVOKED e snapshots anteriores. Agora WAITING_HELENA/PENDING, revisora Nina AGT-10. Arquivos e histórico preservados; painel mostra Em revisão, não Aprovada.
- Copy bloqueada atual: **JOB-HR-7a09bb163135240c4b8c1ec90c5efbeb**, WAITING_HELENA, duas tentativas utilizadas. Não zerar limite. O ID antigo de copy citado no relatório de retomada anterior foi transcrito incorretamente; obter a referência completa da fonte canônica antes de reutilizar.
- Marca Humano Digital BIZ-003 aprovada, versão observada 3038; usar logo e identidade atuais do banco, sem recriar marca.
- Gateway oferece ORIGINAL_ILLUSTRATION_ONLY; fotografia/geração realista e inspeção visual remota ainda não homologadas. Não substituir foto requerida por moldura SVG. Não aprovar por hash/dimensões/relato do executor.
- CP-20260928-V033 permanece apontador ativo. **CHECKPOINT REQUER SINCRONIZAÇÃO** para refletir alterações recentes; este registro suplementar não publica novo Checkpoint Mestre.

## Próximas ações exatas

1. Briefing do mesmo job Marina corrigido (versao 3054). Conferir cada dependencia explicitamente pendente e vincular as fontes aprovadas corretas antes de liberar. Nao repetir a correcao ja gravada. A reducao de leitura excessiva e a ferramenta de revisao ja estao instaladas.
2. Reconciliar as cópias existentes e a evidência aprovada, sem repetir o job bloqueado com duas tentativas. Registrar a resolução real do bloqueio; não criar tarefa para burlar o limite.
3. Integrar/homologar geração e inspeção de imagens reais para Maya e revisão independente. Depois executar e inspecionar cada PNG, legenda, CTA e marca.
4. Provar aprovação → handoff do executor → liberação pela coordenação → próximo executor → entrega final no painel com uma tarefa real. Hoje essa cadeia passou somente em teste automatizado com serviços simulados.

## Evidências locais

229 testes Node da suíte principal passaram; 29 verificações adicionais de integração/segurança passaram. 59 testes Python passaram, incluindo retomada, não repetição, escopo e encadeamento completo simulado entre revisora, executor e coordenação. Logs locais em evidencias/gateway-tests-final-20260930.log. Nenhuma mensagem externa ou publicação.

Imagens: gateway-paginacao-deploy-20260930.jpg; arte-sem-aprovacao-front-20260930.jpg; campanha-ajustes-front-20260930.jpg; helena-request-changes-confirmado-20260930.jpg. Pacote reproduzível: workflow-review-final.zip. Antes de qualquer novo disparo, ler Supabase e os recibos; arquivos locais são fotografia datada.

Registro suplementar Supabase: MEM-FLUXO-20260930-REVISAO-V1. O checkpoint conserva resultados historicos, distingue testes simulados de prova real e lista os bloqueios restantes.
