# Continuidade entre agentes — instalada, validação real pendente

## Evidência atual

Projeto oficial confirmado por conector Supabase: ecosistemadossonhos / wxkgrykduqtsgmjkzlou. Pedido do fundador: HD-REVISAO-CRIATIVA-20260930-02. Job da Marina: JOB-HR-794692b1e94a8ee7aa1b0f1268b1ed2b.

O banco confirma criação e liberação pela Helena, claim em 2026-10-01T02:51:42.659247Z, início em 02:51:43.773763Z e falha em 02:51:50.353884Z. Status FAILED, tentativa 1/2, erro HERMES_PROCESS_FAILED, diagnóstico local UNKNOWN. Não há eventos de entrega dessa execução. A fila e a primeira passagem funcionaram; o processo falhou logo após iniciar. A causa de inicialização ainda exige inspeção do runtime. Não atribuir a falha à inteligência do modelo nem afirmar que outro comando corrigirá o processo.

MEM-CREATIVE-QUALITY-20260930-V2 continua ATIVA, GROUP/GRUPO, com 5627 caracteres. O índice compacto get_work_context não é um leitor de todas as memórias. O pacote de execução já inclui creative_quality-v2; ausência da memória no índice não comprova ausência no banco.

## Correções locais

1. Launcher preflight usa o mesmo adaptador multimodal, perfil e parser de CLI da execução, com chat --help e sem query de modelo. Falha bloqueia claim/start: não consome tentativa para descobrir um processo que nem inicializa. Aplicado ao executor e à revisão/coordenação.
2. Diagnóstico retorna categorias controladas para importação, sintaxe, caminhos, adaptador, CLI, autenticação e cota. Não imprime saída bruta nem segredos.
3. hermes_pipeline.py avança por estados confirmados: execução, revisão, handoff, liberação e próxima execução. Limite de seis ações por rodada. Usa as permissões, WIP, idempotência, limite de tentativas e recibos existentes. Falha, estado incerto, cota ou ausência de mudança encerram a rodada; não há repetição paga automática.
4. O poll horário existente passa a chamar esse driver após instalação. Não cria cron de cinco minutos. Trava própria impede sobreposição de drivers; a trava do executor permanece.
5. O prompt explica a diferença entre o índice compacto de contexto e as regras completas do pacote, sem presumir acesso a memórias não fornecidas.
6. install_pipeline_runtime.py prepara backup, valida caminhos, instala arquivos com verificação de hash, preserva credenciais/estado e reverte arquivos em caso de falha. A instalação não inicia modelos nem modifica jobs.
7. Seleção ignora coordenação/resolução com tentativas esgotadas ao procurar outra revisão elegível; mantém os registros e os limites. O recibo real anterior repetia ATTEMPT_LIMIT da Maya (JOB-HR-c392de57a9b00edb8879f291b077714d), bloqueando a seleção posterior. Teste cobre essa condição.

## Validação e limites

Suite Python: 95 testes executados, 94 passaram e um teste de lock Linux foi ignorado no Windows. Casos incluem passagem completa simulada, revisão devolvida, fila vazia, orçamento de ações, erro de launcher antes de claim, ausência de repetição após falha, preservação de estado e instalação idempotente.

Estado de implantação: INSTALADO em 2026-10-01T07:15:40Z, confirmado no terminal. Backup /data/helena-runtime/pipeline-backup-20261001T071540068234Z; recibo /data/helena-runtime/pipeline-install-receipt.json, cinco arquivos alterados, model_calls=0, jobs_changed=false, schedule_changed=false, permissions_changed=false. Pacote SHA256 9b92c7d4a3d839bfc20e4c6a5254e6a335fcfb6202548a021b1b8ec8c34b2bd5.

Marina no ambiente real: launcher_preflight READY, usage READY, mcp READY; pacote de contexto válido com 32362 caracteres. CLI instalado aceita query-file, oneshot e max-turns. O teste usage pelo adaptador também retornou exit=0. Isso não reproduz a falha de inferência anterior nem homologa os 21 agentes. Não foi usada a segunda tentativa nem gerada nova imagem. A hipótese de seleção automática de TUI não foi confirmada: a função instalada protege entrada/saída sem TTY.

Limitação ao final: o shell recusou uma leitura em /opt/hermes por forbidden path; não contornar essa restrição. Depois o controle do navegador ficou indisponível. Leitura do log de encerramento da Marina foi solicitada, mas não houve resposta observada; não inferir seu conteúdo.

## Próximo passo obrigatório

Retomar o terminal autorizado, obter diagnóstico do encerramento usando os logs permitidos e validar o driver instalado em dry-run. Conferir preflight dos demais perfis sem inferência. Recuperar a mesma tarefa somente após diagnóstico, por ação auditada autorizada e sem resetar tentativas, e acompanhar execução real, revisão e handoff. FAILED não pode ser reaprovado via resolve_job_block, que exige WAITING_HELENA; não contornar essa regra silenciosamente nem criar sucessores para esconder o erro. Não repetir instalação ou testes locais já aprovados sem nova alteração.


## Atualizacao de diagnostico

A rotina horaria foi observada e parou em WORKFLOW_ERROR/GatewayRefusal. Probe sem IA localizou get_job HTTP 400 para JOB-WPP-MUHP2BE0. Filtros de IDs legados instalados com backup em 2026-10-01T08:17:33Z. Dry-run remoto passou a ATTEMPT_LIMIT, sem iniciar modelo. Marina 794692b1 continua FAILED 1/2; nao reiniciada. Ver docs/helena-fluxo-padrao-agentes-20261001.md para protocolo, evidencias e pendencias. A nova fila de atencao e migracao estao apenas no codigo local; nao declarar implantacao no Supabase/Gateway.
