# Despacho proposto apos correcao da identidade Maya

Estado: AUTORIZADO PELO FUNDADOR E CRIADO EM DRAFT. Resposta explicita: "Autorizar esse despacho controlado". Tarefa sucessora `JOB-HR-c392de57a9b00edb8879f291b077714d`, criada uma unica vez pela identidade Helena com a chave `HD-VISUAL-SUCCESSOR-20260930-01`. Leitura confirmou DRAFT, attempt_count=0, task_version=3594, identidade versao 3038 e uma fonte aprovada disponivel. A tarefa anterior permanece com 2/2 tentativas e historico preservado. A liberacao e a execucao devem ser verificadas nos recibos; criacao nao comprova entrega.

## Contexto e fontes

Empresa Humano Digital, BIZ-003. Preservar estrategia/copy ja aprovadas em `JOB-HR-7aa2ab1e4f80b68bccaac535dda850e7`. Etapa visual anterior `JOB-HR-d4b5b488e4716e749cb7b1392e308424`: WAITING_HELENA, 2/2 tentativas, sem imagem nova; erro de identidade do conector corrigido. Ler get_work_context e get_job, comparar a identidade atual com a versao 3038 verificada e carregar logo original aprovado. Se a marca mudou, registrar a divergencia antes de produzir.

## Objetivo e impacto

Entregar um post e tres stories utilizaveis para apresentar o Humano Digital a pessoas interessadas em trabalho com IA. A copy aprovada e educativa; nao anuncia vagas, salarios ou condicoes ainda nao confirmadas. Nao inventar uma oferta de emprego para tornar o material mais comercial.

## Escopo e limites

Maya executa; Nina revisa de forma independente; Helena coordena e informa excecoes. Uma execucao inicial controlada do executor, sem repeticao automatica nem aumento de limite. Ate quatro chamadas de imagem, uma por peca/versao; resultado incerto exige conciliacao, nao nova geracao. Sem publicacao, mensagens externas, impulsionamento, despesas extras ou mudancas na marca. R2 privado armazena arquivos; Supabase continua armazenando tarefas, versoes, evidencias e revisoes.

## Plano de trabalho

1. Helena cria e libera somente a etapa sucessora autorizada, vinculando a etapa anterior e a copy fonte; nunca recria estrategia ou copy concluida. O Gateway valida briefing, empresa, executor, WIP e versoes.
2. O despachante roda a verificacao de quota, MCP e check_visual_runtime no processo real, antes de claim/start/inferencia. Qualquer indisponibilidade bloqueia sem consumir tentativa de IA.
3. Maya consulta a fonte aprovada e separa a copy exata de cada peca. Em cada design_note, especifica texto, objetivo da peca, composicao, protagonista, enquadramento, paleta, hierarquia de fonte, contraste, area segura e CTA existente. Nunca enviar uma descricao generica para a geracao.
4. Usar uma cena editorial realista de uma pessoa adulta trabalhando em um ambiente domestico organizado, com notebook e elementos discretos de IA. Variar enquadramento entre pecas mantendo continuidade. Evitar robo sem funcao narrativa, pessoa apresentada como contratada, depoimento ficticio, dinheiro ou promessa de renda.
5. Aplicar paleta aprovada: verde #075E47, verde escuro #163D32, creme #F4F5EB, sálvia #BCD2B5; tipografia Manrope ou equivalente legivel. Usar logo original aprovado, nunca redesenhar ou substituir. Titulo dominante, apoio curto e CTA legivel, com respiro; nenhum codigo, ID ou relato de ferramenta na arte.
6. Gerar post 1080x1350 e stories 1080x1920 usando generate_design; inspecionar os pixels finais com get_visual_asset. Se texto, logo, protagonista, contraste ou composicao estiverem incorretos, nao submeter como pronto e nao repetir geracao paga sem decisao.
7. Submeter submit_work com evidencias reais, artifact_refs verificados e publication com legenda publicavel, estrategia curta, instrucoes de postagem e alt_text. Relatorio tecnico fica no summary interno.
8. Nina abre cada PNG final e compara com todo o pedido, a marca e a copy fonte. Dimensoes e existencia do arquivo nao bastam. Registrar quality_review e visual_review; aprovar somente material realmente utilizavel. Helena recebe o resultado ou a pendencia concreta.

## Entregáveis

Um post, tres stories em sequencia, legenda pronta para copiar, objetivo/ordem de publicacao e texto alternativo. O frontend deve mostrar previews, download e copy limpa na pagina Entregas, com estado real de revisao. Nao apresentar relatorios de infraestrutura como legenda.

## Critérios de pronto

As quatro imagens abrem, tem texto correto, personagem/cena, logo aprovado, paleta consistente e legibilidade em celular. A legenda e publicavel e coerente com a copy aprovada. Nina inspecionou cada imagem e registrou aprovacao independente. Leitura na pagina Entregas confirmada. Se qualquer requisito faltar, registrar incompleto; nao afirmar 100%.

## Evidências e registro

Vincular fonte aprovada, etapa anterior, recibos de geracao unica, referencias privadas de arquivos e parecer independente. Chave estavel para reenvio de operacoes de gravacao; nao criar sucessoras repetidas. Conservar todos os eventos e tentativas anteriores.

## Revisão e encaminhamento

Nina decide APPROVE ou REQUEST_CHANGES com evidencias inspecionadas. Helena comunica a entrega utilizavel ou o bloqueio e sua causa. Publicacao continua sob decisao do fundador. Uma entrega homologada nao comprova todas as funcoes dos 21 agentes.
# Atualizacao operacional apos o despacho

Sucessora `JOB-HR-c392de57a9b00edb8879f291b077714d`: primeira tentativa falhou por contradicao entre o prompt e o pacote de contexto. Contrato corrigido e testado no query-file real sem inferencia. A mesma tarefa foi recuperada com evento OPERATOR_CONTEXT_RECOVERY, mantendo attempt_count=1 e max_attempts=2, e liberada pela Helena. Uma retomada foi iniciada em 2026-10-01T01:05:37.720489Z, PID 17183, sem retry automatico. Conferir `docs/helena-operacao-20260930.md` e o estado canonico; nao criar outra sucessora nem repetir o lancamento.
