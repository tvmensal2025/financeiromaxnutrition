# Continuidade do fluxo — 30/09/2026

## Atualização de autorização e economia — 20:53 UTC

Estado desta atualização prevalece sobre os relatos históricos abaixo. A campanha permanece HD-CAMPANHA-20260930-01. Ciclo comercial completo e geração/revisão fotográfica continuam pendentes; não declarar 100%.

- Código `6a94cd2`, `a19b391`, `e3fdbb5` e `e3f0c3a` enviado ao GitHub main. Gateway atual `e3f0c3a` implantado no EasyPanel, Success em 2026-09-30T20:53:13Z; anterior e3fdbb5 às 20:41:27Z. Prova: `evidencias/gateway-submission-deploy-20260930.png`.
- Runtime instalado no Hermes com backup `authorization-backup-20260930T203137153823Z`. 21 configurações conferidas; 18 filtros de especialistas perderam ferramentas de coordenação que o servidor já recusava. Credenciais, modelos e agenda preservados. Preflight nativo de Marina e Nina READY.
- 21 identidades autenticadas conferidas. Teste SQL transacional passou nas 20 rotas empresariais/grupo de execução e revisão, isolamento de empresa, proibição de autoaprovação e de criação/liberação por especialista. Laura permanece pessoal; Helena depende do fundador para aprovar a própria entrega. Fixtures revertidas; isso não comprova execução de uma tarefa real por cada agente.
- Contexto autorizado é preparado antes da inferência: briefing, marca, contrato, parecer e fontes integrais; sem eventos/histórico duplicados. Agente confere versão por manifest e só relê o que mudou. Pacote acima do limite é recusado, nunca truncado silenciosamente. Limites de tentativa, WIP e preflight de cota preservados.
- Corrigida perda da entrega entre agentes: `get_job.input_evidence_records[].approved_output` inclui summary integral, delivery e publication somente de fonte explicitamente citada, mesma empresa, concluída e revisada. Estratégia de Augusto: MEM-HR-1aece577f4fcabb065c9a75429cc1bb9 / JOB-HR-a3ac89587826124257ccace27fe5cef8. Copy legada correta: MEM-HR-2b125554d7cbe28e611f6278eb8d97b5 / JOB-HR-7aa2ab1e4f80b68bccaac535dda850e7. Referências legadas precisam ser comparadas aos fatos/marca atuais; aprovação antiga não aprova a campanha atual.
- Causa adicional reproduzida: primeira revisão mudava tarefa para NÃO INICIADA e a segunda edição exigia BLOQUEADA. Migration `20260930210000_helena_continue_reviewed_brief.sql` aplicada: permite continuar apenas com recibo persistido da mesma versão/briefing, parecer REQUEST_CHANGES, perfil de coordenação e tentativas disponíveis. Preserva revisão independente, histórico, idempotência e limites. Teste transacional com rollback passou: edição legítima, replay idempotente; perfil indevido, versão antiga e alteração sem recibo recusados.
- Briefing da mesma Marina corrigido via Gateway autenticado, versão 3296: removida autorreferência rejeitada tratada como fonte; duas entradas aprovadas agora entregam textos integrais de 6.607 e 8.956 caracteres. Sem nova tarefa ou reset de tentativas. Matriz técnica em resumo/memória; conteúdo visível ao fundador em linguagem clara.
- Suites finais: 251 testes Node, 29 verificações adicionais e 67 Python passaram. Nenhum teste técnico chamou modelos ou enviou mensagens reais. Execução de campanha deve ser registrada separadamente abaixo.
- Evidências: `authorization-runtime-20260930.zip`; `evidencias/authorization-node-20260930.log`; `evidencias/gateway-authorization-deploy-20260930.png`; Hermes `/data/helena-runtime/authorization-install-receipt.json`, `authorization-audit-20260930.json`, `campaign-context-repair-20260930.json`.

### Resultado real da retomada — 20:46 UTC

- Um despacho executou Marina no GPT-6 Luna. Claim/start confirmados às 20:44:09/10 UTC; progresso às 20:44:57 e memória MEM-HR-b98e1f7073091de29abf9472f1c657db às 20:45:04. Encerramento às 20:46:29: FAILED / HERMES_NO_DELIVERY, tentativa 2/2. NÃO disparar novamente nem zerar limite.
- Sessão Hermes `20260930_204417_55e6e0`, `cli_close`, 10 chamadas de ferramentas; métricas registradas: 31.910 tokens de entrada e 4.665 de saída. Não há conversão confirmada em dinheiro/créditos; isso não inclui o uso deste chat. Houve também uma consulta Jev de roteamento, baixa confiança, mantendo modelo padrão.
- Causa comprovada nos argumentos/retornos persistidos: dois submit_delivery recusados. acceptance_checks[].evidence_ref usava IDs de tarefas/combinações de IDs e depois âncoras inventadas delivery:plano..., sem correspondência literal a evidence_refs. A própria resposta final reconheceu a falha; não houve revisão de Helena nem passagem a outro agente.
- O plano foi produzido e registrado como memória, mas NÃO constitui submissão aceita. A entrega antiga no result_payload não é o resultado da nova tentativa. Nenhuma imagem, publicação ou mensagem a cliente foi produzida nesta retomada.
- Correção compartilhada: descrição explícita do campo evidence_ref chega ao esquema MCP; copiar literalmente um item de evidence_refs, normalmente memory_id retornado por record_memory; localização/explicação no finding. Erros separam critério duplicado de referência inválida e mostram referências permitidas/recebidas. A validação continua recusando a entrega inválida. Teste de regressão reproduz as âncoras inventadas e comprova correção sem afrouxar o aceite.
- Código desta última correção: `e3f0c3a`, enviado ao GitHub main. Suíte posterior: 252 testes Node e 29 adicionais passaram; 67 Python permanecem válidos para o runtime inalterado. A correção ainda não foi comprovada em outra execução de IA; não repetir automaticamente a tarefa com tentativa 2/2.
- Próximo trabalho: concluir mecanismo auditado de recuperação da submissão já produzida, sem nova inferência nem alteração artificial de tentativas, ou replanejar explicitamente com o fundador. Em seguida, conectar geração/inspeção visual real e comprovar uma única peça comercial. Não abrir outra campanha para contornar esta falha.

## Histórico anterior desta data

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
