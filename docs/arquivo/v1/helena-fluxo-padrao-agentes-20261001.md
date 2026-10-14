# Fluxo padrao dos agentes Helena

Data: 01/10/2026. Este documento distingue comportamento pretendido, codigo testado e instalacao comprovada. Nenhuma declaracao de 100% operacional pode se basear somente em perfil ACTIVE ou suite local.

## Fluxo comum a todos os agentes

1. **Pedido**: Helena identifica empresa, objetivo, publico, canal, prazo e resultado. Consulta identidade e fatos atuais; pergunta somente dados que impedem executar. O pedido recebe identificador estavel e autorizacao de escopo.
2. **Plano executavel**: Marina organiza apenas especialistas necessarios. Cada etapa registra executor, revisor independente, insumos aprovados, dependencias, entregaveis, criterio de pronto, proximo responsavel e limite de custo/tentativas. Coordenacao entrega plano com IDs, e especialista entrega material; os criterios de uma etapa nao se confundem com a campanha inteira.
3. **Liberacao**: tarefa nasce DRAFT; coordenacao verifica identidade, ferramentas, fontes, versoes e capacidade antes de READY. Uma etapa dependente aguarda aprovacao do insumo. Liberacao persistida autoriza o dispatcher; texto de chat nao prova despacho.
4. **Execucao**: runtime verifica acesso, quota, ferramentas e inicializacao antes de claim. Claim/start sao atomicos; uma execucao autorizada ocupa WIP. O especialista recebe briefing completo e registra marcos, artefatos e entrega utilizavel, confirmando as gravacoes.
5. **Revisao**: submit_work coloca a entrega em revisao. Revisor compara todos os criterios com evidencia real; artes exigem abertura de cada PNG, legibilidade, logo correto, variacao, copy e pacote publicavel. Existencia de arquivo, dimensao ou hash nao substitui qualidade. Autor nao aprova seu proprio trabalho.
6. **Devolucao**: REQUEST_CHANGES registra defeito, arquivo/trecho afetado, criterio violado, correcao pedida e criterio de aceite. O mesmo job e historico sao preservados. Coordenacao corrige briefing quando necessario e libera a retomada dentro do limite vigente. Versoes novas preservam as anteriores. O executor responde a cada apontamento antes de nova revisao; limite atingido exige decisao registrada, nao loop infinito.
7. **Passagem**: somente entrega aprovada fornece insumo para a proxima etapa. Handoff tem chave estavel e ID de filho confirmado. Tarefa existente deve ser reutilizada quando foi criada pelo plano. Runtime precisa reconciliar filho criado/liberado antes de repetir escrita. Plano aprovado com filhos DRAFT ainda nao prova liberacao desses filhos.
8. **Entrega final**: painel apresenta arquivos finais, legenda pronta, estrategia curta, instrucoes e estado de aprovacao. Auditoria tecnica fica em area separada. Aprovacao de qualidade nao autoriza publicar ou enviar mensagem a terceiros.
9. **Supervisao**: varredura deterministica procura revisoes, continuacoes, falhas e execucoes antigas. Resultado incerto exige consultar banco, processo e efeitos externos; jamais inferir que a tarefa morreu somente por tempo. A rotina horaria deve registrar alerta unico com Helena responsavel pela decisao e Theo pelo diagnostico tecnico.

## Exemplo de material social

Pedido -> Helena esclarece objetivo/empresa -> Marina organiza pesquisa e estrategia -> especialista de conteudo prepara copy -> revisor confere fatos e copy -> Maya recebe direcao visual e copy aprovadas -> gera e inspeciona arquivos -> Nina ou revisor designado avalia todos os criterios -> se rejeitado, Maya corrige os apontamentos -> nova revisao -> pacote final aprovado aparece em Entregas. Os nomes das etapas de pesquisa/copy devem vir do cadastro canonico de papeis, sem inventar novos cargos.

Direcao visual obrigatoria: versao da identidade, logo aprovado unico, paleta, fonte, publico, mensagem, copy exata, personagem ou produto, cena, enquadramento, formato, margens, CTA e variacao entre pecas. Humano Digital pode alternar pessoas, robos ou cenas de trabalho conforme conceito; Saude 360 exige contexto da propria empresa. Nao redesenhar logo, anexar faixa vazia de rodape ou repetir a mesma personagem em todas as pecas sem motivo.

## Tratamento de falhas

- Antes do modelo: corrigir configuracao/acesso/ferramenta; provar preflight antes de retomar.
- Depois de chamada com resposta incerta: reconciliar evento, arquivo e efeito externo; nao repetir geracao/publicacao automaticamente.
- Processo antigo RUNNING/CLAIMED: registrar alerta e confirmar processo/efeitos; nao liberar WIP com base apenas no relogio.
- Reprovacao de qualidade: retornar ao executor com apontamentos verificaveis e nova versao, dentro do orcamento.
- Tentativas esgotadas: Helena decide com causa e historico; nao aumentar limite nem criar substituto escondido.
- Perda do navegador: runtime e banco devem continuar independentes do painel web. A instalacao da rotina precisa de recibo e execucao real observada.

## Evidencia e estado desta manutencao

- Rotina horaria realmente observada: pipeline-last-result retornou PIPELINE_STOPPED, fila READY=0, WORKFLOW_ERROR/GatewayRefusal.
- Diagnostico sem IA encontrou get_job recusado HTTP 400 para JOB-WPP-MUHP2BE0. O indice compacto contem jobs antigos de WhatsApp; a selecao tentava consulta antes de validar o formato Hermes.
- Corrigidos filtros de ID na selecao, nas continuacoes pendentes e nos recibos interrompidos. Instalacao remota confirmou LEGACY_FILTER_INSTALLED, backup /data/helena-runtime/hermes_workflow_tick.py.legacy-backup-20261001T081733Z, model_calls=0, jobs_changed=false.
- Falha separada da Marina JOB-HR-794692b1e94a8ee7aa1b0f1268b1ed2b: FAILED/HERMES_PROCESS_FAILED, primeira tentativa 1/2, diagnostico UNKNOWN. Nao atribuir a Luna nem consumir outra tentativa antes de diagnostico.
- Nova fila queue_attention e registro idempotente record_queue_attention preparados LOCALMENTE. SQL 20261001090000_durable_agent_recovery.sql nao altera status/tentativas e nao chama IA. Watchdog pagina com cursor duravel, respeita corte/adocao do fluxo e registra apenas alertas tecnicos internos.
- Esta nova migracao NAO foi aplicada ao Supabase. Novos endpoints NAO foram implantados no Gateway; watchdog NAO foi ligado a rotina horaria. Nao declarar recuperacao automatica integral instalada.
- Pendente: validar SQL em rollback no banco, implantar RPCs/endpoints, ativar watchdog no poll existente, verificar evento real idempotente, diagnosticar startup da Marina e comprovar ciclo real com devolucao, correcao, aprovacao e proximo executor.
- Regras comuns servem a todos os agentes; ferramentas e qualidade da funcao exigem teste individual antes de afirmar frota operacional.

## Confirmacao apos a correcao

Dry-run remoto apos instalar o filtro deixou de retornar GatewayRefusal e retornou ATTEMPT_LIMIT com Maya c392de57, Maya d4b5b488 e AGT-15 7a09bb16. model_started=false; a parada agora tem motivo conhecido (tentativas esgotadas), sem reativacao. Consulta atual do job Marina 794692b1 confirmou FAILED, attempt_count=1, max_attempts=2, atualizado em 2026-10-01T02:51:50.353884Z e HERMES_PROCESS_FAILED. Nenhuma nova execucao foi feita nesta manutencao.

Validacao local final: 104 testes Python executados, 103 passaram e 1 foi pulado por lock Linux em Windows; 71 testes Node de autorizacao, workflow e HTTP passaram. Inclui filtro de IDs legados antes de get_job, alertas sem retry, chave estavel apos reinicio, paginação limitada, preservacao do cursor em resposta perdida, isolamento dos 21 papeis e preservacao de revisao independente. A nova migracao SQL ainda exige execucao/rollback no banco; esses testes locais nao validam sua implantacao.
