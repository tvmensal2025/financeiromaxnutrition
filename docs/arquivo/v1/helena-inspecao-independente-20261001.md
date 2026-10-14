# Inspecao independente da campanha Humano Digital

Pedido do fundador: aplicar a correcao, enviar tarefa e acompanhar. Consulta atual em 01/10/2026 confirmou Marina e Maya WAITING_HELENA, ambas em 2/2. Nenhuma foi reiniciada.

## Etapa enviada

Job: JOB-HR-b3b28521fc85cc44bc711c21541a377e.
Executor: Nina AGT-10, BIZ-003. Revisor do relatorio: Helena.
Escopo: inspecionar o post e tres stories existentes do job JOB-HR-c392de57a9b00edb8879f291b077714d e escrever correcoes por peca. Sem geracao ou publicacao. Esta etapa e diagnostico independente, nao tentativa adicional de producao da Maya.

Atribuicao de leitura no job fonte registrada em OPERATOR_INSPECTION_ASSIGNMENT com Nina, empresa e ID da etapa de inspecao. O campo reviewer_agent_id habilita o acesso previsto no Gateway; review_pending continua ausente, sem submissao ou aprovacao artificial. As tentativas permanecem 2/2.

Preflight autenticado no perfil Nina confirmou acesso ao manifesto e quatro PNGs verificados: post 1080x1350, tres stories 1080x1920, bytes e SHA256 recebidos. Isso comprova leitura, nao qualidade.

Despacho controlado utiliza GPT-6.1 Sol max, lock global do despachante e uma unica execucao. Eventos reais CLAIMED em 10:00:29 UTC e STARTED em 10:00:30 UTC. Sessao Hermes: 20261001_100035_4b2756.

Primeira execucao bloqueou em 10:03:50 UTC. A indicacao inicial de imagem nativa era falso positivo: o texto continha `_multimodal`, mas `messages.api_content` era NULL e a imagem inteira caiu em spillover de texto. A causa era `json.dumps` no retorno do adaptador. Hermes reconhece apenas dict com `_multimodal=True` e lista content. Corrigido para dict na bridge v2, com teste de regressao que exige o tipo nativo e separa dois milhoes de caracteres de pixels do resumo textual. A consulta ao logo exige `reference=brand-logo`; instrucoes globais corrigidas. Nao interpretar metadados como prova de inspecao.

Bloqueio resolvido pela RPC `gateway_resolve_job_block`, versao 3631, chave hd-inspection-resolve-native-dict-20261001-v2. Liberacao pela RPC release_job, versao 3632, chave hd-inspection-release-native-dict-20261001-v2. Tentativa anterior preservada, sem aumento do limite. Segunda execucao e revisor usam recibos distintos com sufixo v2 para nao consumir recibos antigos. Resultados ainda precisam de verificacao real.

## Acompanhamento

Um seguidor delimitado espera ate 660 segundos pelo recibo desta unica execucao. Somente se houver WAITING_HELENA com review_pending=true chama o consumidor de revisao da Helena, com timeout de 600 segundos. Se houver erro ou resultado incerto, registra a situacao; nao executa novamente e nao amplia tentativas. Nao cria nova campanha ou etapa visual automaticamente.

## Regra para proximos pedidos

Antes da submissao, uma tarefa pode precisar de inspecao independente de material parcial. A coordenacao deve registrar quem pode inspecionar o job, a empresa e a finalidade. Mencionar o revisor no texto nao concede acesso. Inspecao produz um parecer; somente entrega formalmente submetida pode ser aprovada ou devolvida por review_delivery. A atribuicao aplicada aqui foi operacional e especifica; ainda nao existe ferramenta de atribuicao automatica genericamente homologada para os 21 agentes.

Depois do parecer, planejar a correcao visual autorizada com achados especificos e uma unica marca oficial, variedade de cena/personagem e uso completo do formato. Nao anunciar campanha pronta a partir deste diagnostico.

## Evidencia da correcao visual

Segunda sessao Nina: 20261001_101216_204a7c. Agora os cinco resultados get_visual_asset (quatro pecas e logo) tem resumo pequeno e marcador `[screenshot]`, sem spillover de base64. O Hermes normaliza imagens para `[screenshot]` ao salvar trajetorias, portanto api_content NULL isoladamente nao prova ausencia de pixels. Evento PROGRESS real de Nina confirmou inspecao e achados especificos: assinatura alternativa mais logo oficial, faixa inferior marfim acrescentada, repeticao de mulher/mao no queixo/notebook/cenario, densidade e contraste desigual no Story 2, mesma chamada no Story 3 e Post. Classificacao: corrigir as quatro. Submissao e revisao ainda precisam ser confirmadas.

Registro tecnico do operador salvo via RPC em MEM-HR-6704acab68821aacab88b6c41653e119. Este registro nao substitui parecer ou aprovacao do agente.

## Resultado final verificado em 01/10/2026

Recibos finais conferidos no Hermes: consolidation-result.json indica exit_code=0, entrega WAITING_HELENA e modelo solicitado gpt-6.1-sol/max. consolidation-follow-result.json indica CONFIRMED, phase=REVIEW, observed_status=COMPLETED, exit_code=0. O consumidor registra next_phase=HANDOFF; isso não comprova que uma etapa visual seguinte já foi criada ou executada.

Os trechos acima preservam a sequência histórica, incluindo estados pendentes. A segunda inspeção recebeu pixels, mas tentou submeter relatório com 15.530 caracteres e dez critérios. O contrato aceita no máximo 8.000 caracteres e oito critérios. A submissão foi recusada e a execução atingiu o timeout de 600 segundos. O job JOB-HR-b3b28521fc85cc44bc711c21541a377e terminou FAILED, com 2/2 tentativas. Não foi reiniciado nem teve seu limite ampliado. O rascunho foi preservado no runtime autorizado, em nina-rejected-inspection-draft-20261001.json.

Uma etapa distinta de consolidação documental, JOB-HR-4c1ad7a12227adf8c2ab535120692df5, reutilizou os achados já registrados, sem nova geração de imagens e sem representar uma terceira tentativa da inspeção. Nina entregou 3.082 caracteres e quatro critérios na sessão 20261001_102846_bae2d3. Evidência do relatório: MEM-HR-3c08561162e5da2e510326d9a2945bbc. Registro de proveniência: MEM-HR-2c92009c7166593550e1c2c08790a0a5.

Helena revisou e aprovou somente a consolidação documental às 10:35:09 UTC (07:35:09 em Brasília). Estado final confirmado: COMPLETED, reviewed_by AGT-01, review_pending=false. O painel local mostra APROVADAS, Nina, revisado por Helena e o texto real do parecer. A campanha e os quatro PNGs continuam pendentes de correção visual; não houve publicação nem aprovação artificial dos jobs esgotados.

As instruções compartilhadas do despachante agora explicitam os limites de submissão e a referência brand-logo. A bridge v2 entrega um objeto multimodal nativo, sem despejar pixels em texto. No frontend, o diálogo passou a atualizar o objeto da entrega quando os dados mudam, mesmo mantendo o mesmo job_id. Validação: 107 testes Python, 106 aprovados e um teste de lock POSIX não executado no Windows; build do frontend aprovado. Isso não homologa os 21 agentes individualmente.

Próxima etapa concreta: corrigir as quatro artes seguindo docs/helena-parecer-nina-20261001.md, com logo oficial único, composição integrada, variedade de personagem/cena e inspeção independente do resultado. O adaptador visual local já contém proibição de rodapé adicional e formato incorreto; sua existência no repositório não comprova que a versão equivalente está ativa no servidor. Conferir essa equivalência antes de consumir geração de imagem.
