-- Reconciliação autorizada pelo fundador. Não executa jobs, não envia mensagens e não fecha riscos.
-- Reexecutável: preserva o histórico e não cria outra versão para o mesmo marco.
begin isolation level repeatable read;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
  anterior public.checkpoint_mestre%rowtype;
  novo public.checkpoint_mestre%rowtype;
  snap jsonb;
  contagens jsonb := '{}'::jsonb;
  fontes jsonb := '[]'::jsonb;
  tabela record;
  n bigint;
  antes jsonb;
  plano jsonb := '{"estado":"PROPOSTA; não abre tarefas nem altera WIP","data_revisao":"2026-09-26","plano_evolucao":[{"fase":"01","titulo":"Confiar no que a página mostra","estado":"PARCIAL","dono":"Daniel · Theo · Bruno","existe":"Sala de comando local consulta tarefas, decisões, fila, eventos e checkpoint no Supabase, com paginação e falhas de leitura explícitas.","lacuna":"A publicação dessas mudanças e o comportamento de cada integração externa ainda precisam de homologação.","ajuste":"Publicar a versão revisada e comprovar atualização de cada fonte e isolamento por empresa; conservar a distinção entre ausência, erro e zero confirmado.","aceite":"Mudar um registro autorizado e verificar sua atualização na tela; simular falha de leitura sem gerar zeros ou dados fictícios."},{"fase":"02","titulo":"Enxergar cada execução","estado":"PARCIAL","dono":"Theo · Marina · Clara","existe":"A sala já lê a fila, os eventos, as tentativas, o resultado e as evidências de cada job.","lacuna":"Os jobs atuais não têm task_id, portanto não há histórico de execução ligado diretamente às tarefas.","ajuste":"Exigir vínculo explícito nos novos jobs e reconciliar os antigos apenas com prova de origem; validar a identidade do executor.","aceite":"Uma execução de teste aparece do início ao fim, ligada à tarefa correta, e outro usuário não acessa empresas indevidas."},{"fase":"03","titulo":"Helena no comando, fundador no controle","estado":"PARCIAL","dono":"Helena · Marina · Theo","existe":"Foco executivo, decisões, memória, handoffs e regras de autoridade já existem. A conversa local classifica pedidos por regras.","lacuna":"O fluxo local de conversa não comprova orquestração completa dos especialistas. Aprovação, despacho e aceite não formam ainda uma trilha única na página.","ajuste":"Manter Helena no ChatGPT oficial e os especialistas no Grok, conforme decisões vigentes. Inbox persistente com pedido, contexto, recomendação, impacto e decisão. Permitir aprovar, devolver ou pausar apenas via ações autorizadas e auditadas.","aceite":"Aprovação sobrevive ao recarregamento, não executa duas vezes e gera retorno à Helena. WIP executivo = 1 permanece respeitado."},{"fase":"04","titulo":"Acompanhar resultado, não só atividade","estado":"PARCIAL","dono":"Daniel · Caio · donos de cada área","existe":"Dados de tarefas, negócios e indicadores podem ser reaproveitados; os agentes têm entregas obrigatórias definidas.","lacuna":"Contar tarefas não mede produtividade nem qualidade. Faltam cobertura comprovada e séries históricas para duração, custo e resultado.","ajuste":"Adicionar metas, tendência, tempo de ciclo, bloqueios, custo por execução e impacto no negócio, sempre com fórmula e origem.","aceite":"Cada gráfico permite chegar aos registros que o compõem; sem dados históricos, mostrar lacuna em vez de uma curva inventada."},{"fase":"05","titulo":"Evoluir a experiência sem perder funções","estado":"PARCIAL","dono":"Maya · Nina · Bruno","existe":"Autenticação, navegação por empresa, módulos e avatares foram preservados nesta proposta local.","lacuna":"A navegação atual é extensa, mistura gestão com detalhes técnicos e exige percorrer páginas longas para entender uma entrega.","ajuste":"Organizar a experiência em Visão geral, Agentes, Processos e Decisões. Detalhes abrem ao lado; manter os módulos atuais acessíveis durante a evolução.","aceite":"Fundador identifica prioridade, dono, bloqueio e próxima entrega em poucos passos, no computador e no celular, inclusive usando teclado."}],"processo":[{"nome":"Direção","dono":"Fundador + Helena","texto":"Registrar objetivo, empresa, prioridade e critério de sucesso. Helena verifica foco e decisões vigentes.","fonte":"Foco e decisões já existem.","falta":"Vincular cada direção à execução e à aprovação correspondente."},{"nome":"Plano","dono":"Helena + Marina","texto":"Escolher o especialista, explicitar dependências, prazo e definição de pronto. Uma frente executiva por vez.","fonte":"Tarefas, projetos e handoffs já existem.","falta":"Substituir vínculos por texto por responsáveis e dependências estruturados."},{"nome":"Execução","dono":"Especialista responsável","texto":"Mostrar recebimento, início, etapas, ferramentas usadas, bloqueios e novas tentativas. Cada evento precisa de horário e origem.","fonte":"Fila e eventos existem no banco.","falta":"Comprovar cobertura dos eventos de cada executor; a leitura por empresa já está disponível."},{"nome":"Validação","dono":"Bruno + dono da entrega","texto":"Comparar o resultado com a definição de pronto. Anexar evidência, apontar falhas e devolver para correção quando necessário.","fonte":"Tarefas já contêm evidência e critério de pronto.","falta":"Separar trabalho finalizado de resultado aprovado. Status de tarefa não basta para comprovar qualidade."},{"nome":"Decisão","dono":"Helena + fundador","texto":"Helena consolida o resultado, a recomendação e os impactos. O fundador decide o que exige sua autoridade.","fonte":"Decisões e limites dos agentes estão registrados.","falta":"Inbox persistente, trilha de aprovações e ações autorizadas com prevenção de duplicidade."},{"nome":"Memória","dono":"Helena","texto":"Relacionar entrega, decisão e memória. Atualizar o checkpoint quando houver mudança material conforme o protocolo.","fonte":"Memória e checkpoint já existem.","falta":"Homologar o uso do checkpoint em nova conversa; a aba Cobertura já compara contagens com o banco atual."}],"fontes":["src/lib/comando.ts","src/pages/ComandoPage.tsx","public.tarefas","public.foco_executivo"]}'::jsonb;
  supervisao jsonb := '{"estado":"CONFIGURADA; primeira rodada automática ainda não homologada","integration_id":"INT-0011","automation_id":"AUTO-0006","recurrence_id":"REC-0001","external_automation_id":"helena-checkpoint-di-rio-de-supervis-o","executor":"Codex local; heartbeat vinculado a uma tarefa e host","target_thread_id":"01a0dcea-ad0a-79a0-8516-2adf7931f47a","horario":"18:00 America/Sao_Paulo","janelas_por_dia":1,"gatilhos":["5 ou mais mudanças de tarefas","decisão estratégica","novo bloqueio, falha ou WAITING_HELENA","risco crítico ou ação do fundador"],"regra":"Uma análise compacta por janela; sem mudança relevante, não gravar parecer ou emitir mensagem. Sem IA por tarefa ou consulta da página. Não gerar versão do Checkpoint Mestre por passagem do tempo.","fluxo":["Carregar checkpoint atual e validar fontes","Comparar task_activity, decisoes e agent_job_events com último parecer","Gravar parecer idempotente em auditoria com acao CHECKPOINT_SUPERVISAO_LOTE, resumo e referências","Avisar nesta tarefa somente após confirmar gravação"],"homologacao":"Exige rodada automática, registro no banco, parecer no painel e mensagem correspondentes. AUD-HCP-20260926-BASE foi revisão assistida.","custo":"Usa cota Codex por janela; não usa Grok Bot nem API paga no piloto.","whatsapp":"Fora do piloto; apenas críticos após homologar destinatário, deduplicação e envio.","portabilidade":"Novo chat precisa de acesso autorizado ao mesmo Supabase. A agenda não migra automaticamente nem deve ser duplicada.","task_id":"TSK-0031"}'::jsonb;
begin
  select * into strict anterior from public.checkpoint_mestre_atual;
  if anterior.snapshot->>'marcador_continuidade'='helena_reconciliacao_20260926' then return; end if;
  if (select count(*) from public.foco_executivo where status='EM EXECUÇÃO')<>1 then
    raise exception 'WIP executivo deve permanecer igual a um';
  end if;
  if not exists(select 1 from public.automacoes where automation_id='AUTO-0006' and integration_id='INT-0011') then
    raise exception 'Agenda existente precisa estar registrada antes da reconciliação';
  end if;
  select jsonb_build_object(
    'estado_mestre',(select jsonb_agg(to_jsonb(e)) from public.estado_mestre e where registro_id in(1,2,10,11,12,13,15,16)),
    'recorrencia',(select to_jsonb(r) from public.recorrencias r where recurrence_id='REC-0001')
  ) into antes;

  update public.estado_mestre
  set related_id='FOC-004',ultima_mudanca=now()::text
  where registro_id in(2,13) and related_id is distinct from 'FOC-004';
  update public.estado_mestre
  set estado_atual='Sistema Helena em homologação técnica (FOC-004). Cadastros e mapeamento no Supabase; testes locais não comprovam implantação remota, execução dos bots ou primeira janela automática.',
      proxima_acao='Concluir homologação com evidências de execução externa; manter riscos e bloqueios até comprovação.',
      ultima_mudanca=now()::text
  where registro_id=1;
  update public.estado_mestre
  set estado_atual='Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) é a fonte canônica. Estado atual do banco/produção > decisões e Estado Mestre > checkpoint ATIVO > memória/handoffs > arquivos e conversas.',
      proxima_acao='Consultar checkpoint_mestre_atual e verificar as fontes voláteis a cada retomada.',
      ultima_mudanca=now()::text
  where registro_id=11;
  update public.estado_mestre
  set estado_atual=(select string_agg(integration_id||' '||sistema||': '||status,'; ' order by integration_id) from public.integracoes)
        || '. Cadastro de integração não comprova teste ponta a ponta; ultima_sync sem valor indica sincronização não comprovada.',
      fonte='public.integracoes; reconciliação autorizada pelo fundador',
      proxima_acao='Homologar a execução do Gateway e a primeira janela de supervisão; usar os estados atuais do cadastro.',
      ultima_mudanca=now()::text
  where registro_id=10;
  update public.estado_mestre
  set proxima_acao='Orquestrar as empresas ativas do portfolio por business_id; fundador mantém autoridade superior.',
      related_id='AGT-01',ultima_mudanca=now()::text
  where registro_id=12;
  update public.estado_mestre
  set proxima_acao='Consultar sempre a versão ATIVA pela view checkpoint_mestre_atual; preservar todas as versões anteriores.',
      ultima_mudanca=now()::text
  where registro_id=15;
  update public.estado_mestre
  set proxima_acao='Criar a próxima versão somente após mudança material registrada na fonte, via registrar_checkpoint_mestre; validar encadeamento e conteúdo.',
      ultima_mudanca=now()::text
  where registro_id=16;

  update public.recorrencias
  set automation_id='AUTO-0006',integration_id='INT-0011',external_id='helena-checkpoint-di-rio-de-supervis-o',
      source_system='CODEX_LOCAL',regra_rrule='FREQ=DAILY;BYHOUR=18;BYMINUTE=0',
      timezone='America/Sao_Paulo',horario_confirmado='SIM',status='CONFIGURADA',
      gerar_automaticamente='NÃO',sync_status='CONFIGURADA',
      observacoes='Executor externo Codex local, ativo às 18h. Não materializar outra agenda via AUTO-0004. Primeira rodada automática não homologada; a revisão assistida não é execução agendada. Sem WhatsApp no piloto.',
      regra_canonica='Uma janela diária de supervisão em lote; fonte de agenda: Codex local; sem duplicação pelo materializador de recorrências.'
  where recurrence_id='REC-0001';
  update public.governanca
  set dia_hora='18:00 America/Sao_Paulo — piloto de revisão em lote via Codex',
      observacoes='REC-0001 / AUTO-0006 / INT-0011. Ritual de revisão; agenda externa configurada, primeira execução automática não homologada.'
  where governance_id='GOV-0001';

  insert into public.estado_mestre(area,item,estado_atual,fonte,confirmacao,proxima_acao,responsavel,related_id,scope_type,ultima_mudanca)
  select 'Supervisão','Checkpoint diário em lote',
    'Uma janela às 18h America/Sao_Paulo em Codex local. Regras e mudanças acumuladas antes de análise compacta; sem IA por tarefa. Agenda externa registrada, primeira execução ainda não homologada.',
    'AUTO-0006; INT-0011; REC-0001; Codex automation verificada',
    'CONFIGURADA; EXECUÇÃO NÃO HOMOLOGADA','Homologar TSK-0031 na primeira janela, sem criar agenda duplicada.',
    'AGT-01 Helena','AUTO-0006','GLOBAL',now()::text
  where not exists(select 1 from public.estado_mestre where area='Supervisão' and item='Checkpoint diário em lote');

  insert into public.memoria_mestre(id,data_hora,session_id,tipo,business_id_area,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade,scope_type)
  values('MEM-PLANO-20260926',now()::text,'HELENA-CONTINUIDADE-20260926','PLANEJAMENTO','GRUPO','AGT-01 Helena / Codex',
    'Plano, supervisão e retomada em nova conversa',
    jsonb_build_object('planejamento',plano,'supervisao',supervisao,'fontes_de_retomada','{"identidade":"public.agentes:AGT-01; public.protocolo_agentes vigente","inicio_e_historico":"public.checkpoint_mestre em ordem de versao; public.memoria_mestre; public.decisoes; public.handoffs; public.auditoria","estado_atual":"public.estado_mestre; public.foco_executivo; public.portfolio; public.tarefas; public.riscos","agentes_e_execucoes":"public.agentes; public.agent_connections; public.agent_jobs; public.agent_job_events; public.task_activity","integracoes_e_agenda":"public.integracoes; public.automacoes; public.recorrencias; public.governanca","planejamento":"public.memoria_mestre:MEM-PLANO-20260926; checkpoint.snapshot.planejamento","permissoes":"public.app_access; public.user_business_access; pg_policies; grants; somente metadados sem credenciais","limite":"O checkpoint é uma fotografia datada com fontes consultáveis. Conversas completas, histórico detalhado de áudio e implantação remota não estão integralmente comprovados no banco."}'::jsonb,
      'mapeamento_multiempresa_markdown','# Mapeamento para vendas multiempresa — Sistema Helena

Fotografia verificada em 26/09/2026 no Supabase `ecosistemadossonhos` e no Gateway local. Este documento é um plano de construção; não declara canais, bots ou vendas homologados.

## Fronteiras corretas

- `portfolio.business_id` identifica empresas operacionais. Há três empresas ativas no cadastro principal.
- `GRUPO` e `Sistema` são escopos internos de trabalho. As três tarefas com esses valores não representam empresas ausentes; não criar linhas artificiais no portfólio para elas.
- A Memória Mestre associa Max Nutrition / Instituto da Saúde ao Ecossistema de Saúde e distingue os agentes próprios do produto de Saúde dos 20 especialistas corporativos. O diretório `agentes` tem Helena mais esses 20 especialistas; os agentes próprios de Saúde não devem ser tratados como cópias dos corporativos.
- A menção de Max Nutrition na memória não prova que ela seja uma quarta empresa autônoma no `portfolio`. Se for uma marca ou operação do Ecossistema de Saúde, modelar marca/linha abaixo da empresa; se precisar de dados, permissões e resultado próprios de uma empresa independente, confirmar essa fronteira antes de criar outro `business_id`. Não fazer essa escolha por inferência do nome.
- O mesmo especialista corporativo pode trabalhar para várias empresas, desde que cada job carregue contexto, permissão e dados de uma única empresa. Escopos globais permanecem separados do atendimento comercial.

## Estado verificado

- `channel_connections` já contém `business_id`, provedor, instância e identificador conectado, mas possui **zero registros**. Isso não prova que o canal externo esteja desligado; prova que a relação canal → empresa não está persistida ali.
- O webhook de WhatsApp lê uma única empresa e marca das variáveis da instalação. A classificação recebe esse valor antes de qualquer resolução por instância ou número. Sem o par configurado, usa identidade neutra; esse estado não deve virar venda de uma marca.
- O serviço local de configuração de voz aponta para um perfil de uma empresa específica. Existem cinco perfis de voz em duas empresas no banco, mas a seleção dinâmica por canal/empresa ainda não está homologada.
- Há 27 jobs sem `task_id`: 20 do lote global de testes do Gateway e sete de WhatsApp com empresa definida. Os testes globais não são vendas nem tarefas de clientes; os sete jobs de WhatsApp precisam de vínculo operacional quando o fluxo real for construído.
- `crm` tem duas oportunidades de uma empresa; `comunicacoes` tem 14 registros de uma empresa; `clientes` e `atendimento` estão vazios. A tabela `produto` está vazia e seus campos descrevem gestão/roadmap de produto, não um catálogo transacional de SKU, preço e estoque. Não foi identificada tabela de pedidos no esquema público.
- Clientes, CRM, comunicações, tarefas, jobs e eventos têm `business_id` e políticas RLS por empresa. Na reconciliação de 26/09, `portfolio` passou a permitir administração somente ao fundador e leitura aos membros das empresas concedidas. As principais tabelas operacionais não têm chave estrangeira para `portfolio`; `user_business_access` tem.
- O Gateway usa chave de serviço. Várias ferramentas aceitam `business_id` ou `agent_id` declarados pelo cliente sem vincular a identidade OAuth ao agente e à empresa. A nova ferramenta `record_progress` já verifica acesso da pessoa à empresa, mas isso não resolve as demais ferramentas nem comprova autoria individual do bot.
- A instrução de um job de WhatsApp contém número, nome e texto da mensagem. Antes de ampliar para dez empresas, o Gateway precisa limitar a leitura por empresa e reduzir o conteúdo sensível replicado na fila.

## Contrato de uma venda

1. **Entrada:** verificar assinatura do webhook e resolver `(provedor, instância/identificador conectado)` para exatamente um `business_id` ativo em `channel_connections`. Se não houver correspondência única, registrar apenas um incidente de roteamento seguro e não carregar marca, catálogo ou agente de outra empresa.
2. **Contexto:** carregar marca do `portfolio`, perfil de voz quando aplicável e regras comerciais da empresa. O catálogo/preço/estoque deve vir da fonte comercial autorizada, com versão e horário de atualização; `produto` não deve ser reaproveitada como catálogo de SKU sem migração conceitual.
3. **Autorização:** escolher agente apto para a empresa e função. Vincular identidade autenticada do bot a `agent_id` e empresas permitidas; não confiar só no `agent_id` enviado no corpo da chamada. Não persistir credenciais nessa relação.
4. **Registro:** criar ou recuperar contato e oportunidade por empresa; criar a tarefa canônica quando houver execução; enfileirar o job com `business_id`, `task_id`, `agent_id`, `correlation_id` e chave de idempotência do evento de origem. Cada etapa usa o mesmo `business_id`, validado no banco e no Gateway.
5. **Execução:** agente registra apenas marcos relevantes com ação, motivo, próximo passo e evidência. Handoff preserva empresa, tarefa e correlação. Falha de gravação fica visível como bloqueio, sem declarar venda concluída.
6. **Resultado:** uma venda exige referência verificável do pedido/pagamento na plataforma comercial ou aceite humano correspondente. Mensagem enviada, job `COMPLETED` ou oportunidade “ganha” isoladamente não comprovam venda. Helena acompanha exceções, conflitos e decisões; não precisa consultar todos os jobs com IA a cada intervalo.

## Sequência de implementação

### 1. Isolamento e identidade

- Restrição de `portfolio` aplicada: fundador administra; membro lê apenas empresas concedidas. Agentes, conexões de agentes e integrações globais também têm escrita restrita ao fundador. Perfis de voz e canais já restringem escrita ao fundador e leitura por empresa; validar toda a cadeia do Gateway.
- Fazer a autorização de **todas** as ferramentas do Gateway antes de usar `service_role`: leitura, despacho, claim, início, conclusão, falha, handoff, resumo e progresso. Criar vínculo verificável entre credencial do bot, agente e empresas permitidas.
- Preservar os jobs globais de homologação como testes; não atribuir `business_id` ou `task_id` retroativamente sem prova.
- Confirmar, para cada nova operação, se é empresa independente ou marca/linha de uma empresa já existente; só empresas independentes recebem novo `business_id`.
- Critério de saída: usuário ou bot de uma empresa não consegue ler, criar, assumir nem concluir trabalho de outra em testes de RLS e Gateway.

### 2. Canal → empresa

- Registrar cada instância/número em `channel_connections` com empresa, provedor, finalidade, status e identificador externo verificado. Impedir dois vínculos ativos concorrentes para o mesmo canal. Resolver o canal no banco antes da classificação por Laya.
- Remover o par único de empresa/marca como roteador de produção do WhatsApp; mantê-lo apenas como compatibilidade temporária até os canais serem migrados e testados.
- Critério de saída: dois números de empresas diferentes recebem marca e contexto corretos; canal desconhecido/duplicado não gera job comercial.

### 3. Oferta e atendimento por empresa

- Definir a fonte autorizada de catálogo, preço, disponibilidade, descontos, frete e políticas de atendimento para cada empresa. Guardar apenas identificadores e versões necessários no Supabase; sincronizar da fonte comercial, sem inventar estoque ou preço.
- Tornar a seleção de voz e conhecimento dependente do `business_id` resolvido. Manter separados os agentes próprios de Saúde e os especialistas corporativos.
- Critério de saída: trocar de empresa troca marca, oferta e regras; nenhum item de uma empresa aparece no atendimento da outra.

### 4. Cadeia comercial íntegra

- Vincular comunicação, cliente, CRM, tarefa, job, eventos e resultado à mesma empresa. Para novas entradas, usar transação/RPC ou outra operação atômica para não deixar mensagem registrada com job ausente sem alerta. Criar a tarefa somente quando o fluxo exigir trabalho rastreável.
- Adicionar validação de consistência de empresa nos vínculos e idempotência por empresa, provedor e evento externo. Tratar duplicatas, indisponibilidade do Supabase e reprocessamento sem perder a ocorrência original.
- Criar ou integrar o registro verificável de pedido/resultado comercial; não chamar uma oportunidade de venda confirmada sem essa evidência.
- Critério de saída: cada atendimento real permite navegar do canal ao resultado, e não há vínculos cruzados entre empresas.

### 5. Escala e supervisão

- Fila compartilhada com limite de trabalho simultâneo por agente, prioridade e distribuição justa entre empresas; uma empresa não deve bloquear as outras. Separar capacidades dos bots corporativos e dos agentes próprios de cada produto.
- Painel da Helena por exceção: canal sem dono, acesso negado, job sem tarefa quando aplicável, progresso sem motivo, falha de sincronização, venda sem evidência e atraso. Gerar resumos a partir do banco; chamar IA apenas quando uma decisão ou análise exigir.
- Homologar primeiro duas empresas em paralelo com clientes de teste e cenários de colisão (mesmo contato em duas marcas, webhook duplicado, bot errado, catálogo errado e falha de banco); ampliar gradualmente até dez.

## Regra de custo

Não clonar os 20 especialistas corporativos dez vezes. A seleção de empresa é uma consulta curta ao banco; cada bot recebe só o contexto aprovado para aquele job. Cache de configuração deve ser separado por `business_id` e invalidado quando a versão mudar. Não criar vigilância periódica por Grok: usar eventos, consultas SQL e revisão humana/Helena por exceção. Medir chamadas de IA e custo por atendimento e por venda, por empresa, antes de aumentar concorrência.

## Limites deste mapeamento

Este é o plano para ampliação futura; não pressupõe dez empresas atuais. As políticas de acesso ao cadastro foram corrigidas na reconciliação de 26/09/2026. Canais e jobs históricos permanecem preservados. Os números são uma fotografia datada; o estado do serviço externo pode mudar e precisa de homologação própria.')::text,
    'docs/helena/plano-evolucao.json; docs/helena/checkpoint-supervisao-lote.md; docs/helena/mapeamento-vendas-multiempresa.md; auditoria no Supabase',
    'ATIVA','VERIFICADO NO ESCOPO DESCRITO','CONTINUIDADE','checkpoint_mestre_atual',
    'Carregar checkpoint ativo e confrontar fontes atuais; plano não abre nova frente executiva.','AGT-01 Helena','INTERNO','GLOBAL')
  on conflict(id) do nothing;

  insert into public.auditoria(audit_id,data_hora,session_id,agente_usuario,acao,sheet,object_id,campo,valor_anterior,valor_novo,motivo,fonte_evidencia,sensibilidade)
  values('AUD-HELENA-RECONCILIACAO-FINAL-20260926',now()::text,'HELENA-CONTINUIDADE-20260926',
    'Codex — correção autorizada pelo fundador','RECONCILIACAO','estado_mestre; recorrencias; governanca; memoria_mestre; checkpoint_mestre','checkpoint_mestre_atual',
    'continuidade',antes::text,jsonb_build_object('planejamento','MEM-PLANO-20260926','agenda','AUTO-0006','correcao','foco, estado, agenda, fontes e snapshot')::text,
    'Corrigir divergências confirmadas sem encerrar pendências operacionais nem reconstruir eventos sem evidência.',
    'scripts/sincronizar-checkpoint-continuidade.sql; testes locais; testes RLS com rollback; leitura direta das fontes','INTERNO')
  on conflict(audit_id) do nothing;

  for tabela in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
      where ns.nspname='public' and c.relkind in('r','p','v','m') order by c.relname loop
    fontes:=fontes||jsonb_build_array('public.'||tabela.relname);
    if tabela.relname not in('checkpoint_mestre','checkpoint_mestre_atual') then
      execute format('select count(*) from public.%I',tabela.relname) into n;
      contagens:=contagens||jsonb_build_object(tabela.relname,n);
    end if;
  end loop;

  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into snap
    from jsonb_each(anterior.snapshot)
    where key in('regra_precedencia','rotina_checkpoint_mestre','checklist_validacao_checkpoint','comando_carregamento_checkpoint');
  snap:=snap||jsonb_build_object('marcador_continuidade','helena_reconciliacao_20260926',
    'gerado_em',now(),'contagens',contagens,'fontes',fontes,
    'escopo_snapshot','Fotografia de campos explícitos e fontes canônicas. Sem chaves, payloads livres, telefones ou histórico de áudio. Informações voláteis exigem releitura.',
    'planejamento',plano,'supervisao_em_lote',supervisao,
    'fontes_de_retomada','{"identidade":"public.agentes:AGT-01; public.protocolo_agentes vigente","inicio_e_historico":"public.checkpoint_mestre em ordem de versao; public.memoria_mestre; public.decisoes; public.handoffs; public.auditoria","estado_atual":"public.estado_mestre; public.foco_executivo; public.portfolio; public.tarefas; public.riscos","agentes_e_execucoes":"public.agentes; public.agent_connections; public.agent_jobs; public.agent_job_events; public.task_activity","integracoes_e_agenda":"public.integracoes; public.automacoes; public.recorrencias; public.governanca","planejamento":"public.memoria_mestre:MEM-PLANO-20260926; checkpoint.snapshot.planejamento","permissoes":"public.app_access; public.user_business_access; pg_policies; grants; somente metadados sem credenciais","limite":"O checkpoint é uma fotografia datada com fontes consultáveis. Conversas completas, histórico detalhado de áudio e implantação remota não estão integralmente comprovados no banco."}'::jsonb);
  snap:=snap||jsonb_build_object('agentes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) from (select agent_id,agente,cargo_funcao,missao,quando_ativar,ler_antes_de_responder,pode_atualizar,saida_obrigatoria,escalar_para,prompt_base,status,versao_prompt,estado_execucao,atualizado_em from public.agentes)x));
  snap:=snap||jsonb_build_object('tarefas',(select coalesce(jsonb_agg(to_jsonb(x) order by x.task_id),'[]'::jsonb) from (select task_id,tarefa,business_id,project_id,responsavel,status,prioridade,prazo,definicao_de_pronto,bloqueio,atualizado_em from public.tarefas)x));
  snap:=snap||jsonb_build_object('projetos',(select coalesce(jsonb_agg(to_jsonb(x) order by x.project_id),'[]'::jsonb) from (select project_id,projeto,business_id,objetivo,status,responsavel,criterio_de_conclusao from public.projetos)x));
  snap:=snap||jsonb_build_object('portfolio',(select coalesce(jsonb_agg(to_jsonb(x) order by x.business_id),'[]'::jsonb) from (select business_id,negocio,ativo,estagio,objetivo_atual,principal_gargalo,kpi_principal,responsavel_executivo,proxima_entrega,riscos,atualizado_em from public.portfolio)x));
  snap:=snap||jsonb_build_object('decisoes_vigentes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.decision_id),'[]'::jsonb) from (select decision_id,business_id,tipo,decisao,motivo,decisor,status,substitui_decision_id,atualizado_em from public.decisoes)x));
  snap:=snap||jsonb_build_object('estado_mestre',(select coalesce(jsonb_agg(to_jsonb(x) order by x.registro_id),'[]'::jsonb) from (select registro_id,area,item,estado_atual,proxima_acao,fonte,confirmacao,responsavel,related_id,atualizado_em from public.estado_mestre)x));
  snap:=snap||jsonb_build_object('memorias_recentes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from (select id,tipo,business_id_area,agente_origem,assunto,status,related_object_id,proxima_acao,atualizado_em from public.memoria_mestre)x));
  snap:=snap||jsonb_build_object('handoffs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from (select id,de,para,business_id_area,assunto,status,prioridade,prazo,atualizado_em from public.handoffs)x));
  snap:=snap||jsonb_build_object('foco_executivo',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from (select id,frente,status,responsavel,criterio_de_saida,atualizado_em from public.foco_executivo)x));
  snap:=snap||jsonb_build_object('conexoes_agentes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) from (select agent_id,provider,connection_status,last_seen_at,last_tested_at,updated_at from public.agent_connections)x));
  snap:=snap||jsonb_build_object('agent_jobs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.job_id),'[]'::jsonb) from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs)x));
  snap:=snap||jsonb_build_object('agent_job_events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events)x));
  snap:=snap||jsonb_build_object('integracoes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.integration_id),'[]'::jsonb) from (select integration_id,sistema,objeto,direcao,business_id,dono,status,ultima_sync,source_system,frequencia,observacoes,atualizado_em from public.integracoes)x));
  snap:=snap||jsonb_build_object('automacoes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.automation_id),'[]'::jsonb) from (select automation_id,nome,business_id,status,responsavel,gatilho,condicao,acao,frequencia,external_automation_id,integration_id,ultima_execucao,proxima_execucao,observacoes,atualizado_em from public.automacoes)x));
  snap:=snap||jsonb_build_object('recorrencias',(select coalesce(jsonb_agg(to_jsonb(x) order by x.recurrence_id),'[]'::jsonb) from (select recurrence_id,nome,business_id,status,responsavel,frequencia,regra_rrule,timezone,automation_id,integration_id,external_id,gerar_automaticamente,horario_confirmado,proxima_ocorrencia,observacoes,atualizado_em from public.recorrencias)x));
  snap:=snap||jsonb_build_object('riscos',(select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_id),'[]'::jsonb) from (select risk_id,business_id,project_id,categoria,risco,probabilidade,impacto,status,responsavel,prevencao_mitigacao,atualizado_em from public.riscos)x));
  snap:=snap||jsonb_build_object('marcos',(select coalesce(jsonb_agg(to_jsonb(x) order by x.milestone_id),'[]'::jsonb) from (select milestone_id,project_id,business_id,status,responsavel from public.marcos)x));
  snap:=snap||jsonb_build_object('task_activity',(select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) from (select event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,actor_role,occurred_at from public.task_activity)x));
  snap:=snap||jsonb_build_object('protocolo_agentes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo_id),'[]'::jsonb) from (select protocolo_id,versao,secao,regra,aplicacao,responsavel,status,atualizado_em from public.protocolo_agentes)x));
  snap:=snap||jsonb_build_object('governanca',(select coalesce(jsonb_agg(to_jsonb(x) order by x.governance_id),'[]'::jsonb) from (select governance_id,ritual,escopo,cadencia,dono,pauta_fixa,entrega_esperada,dia_hora,recurrence_id,status,observacoes,atualizado_em from public.governanca)x));

  snap:=snap||jsonb_build_object(
    'identidade_helena',(select to_jsonb(x) from(select agent_id,agente,cargo_funcao,missao,prompt_base,saida_obrigatoria,escalar_para from public.agentes where agent_id='AGT-01')x),
    'mapeamento_supabase',jsonb_build_object(
      'fontes',jsonb_array_length(fontes),
      'campos',(select count(*) from information_schema.columns where table_schema='public'),
      'campos_mapeados',(select count(*) from public.helena_campos h join information_schema.columns c on c.table_schema='public' and c.table_name=h.tabela and c.column_name=h.coluna),
      'rpc','helena_auditar_cobertura','consumo_grok','FORA_DO_ESCOPO'),
    'seguranca',jsonb_build_object(
      'tabelas_com_rls',(select count(*) from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind in('r','p') and c.relrowsecurity),
      'grants_estruturais_anon_authenticated',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in('anon','authenticated') and privilege_type in('TRUNCATE','TRIGGER','REFERENCES')),
      'portfolio','Fundador administra; membro lê empresa concedida',
      'agentes_conexoes_integracoes','Membro ativo lê; somente fundador escreve metadados globais',
      'verificacao','Testes de member e founder em transações revertidas',
      'pendencias',jsonb_build_array('RSK-0007 continua aberto conforme DEC-019; não houve rotação.','Proteção de senhas vazadas no Auth desativada; dois helpers SECURITY DEFINER são intencionais para RLS.')),
    'integridade',jsonb_build_object(
      'jobs_tarefa_inexistente',(select count(*) from public.agent_jobs j where j.task_id is not null and not exists(select 1 from public.tarefas t where t.task_id=j.task_id)),
      'jobs_sem_agente',(select count(*) from public.agent_jobs j where not exists(select 1 from public.agentes a where a.agent_id=j.agent_id)),
      'eventos_sem_job',(select count(*) from public.agent_job_events e where e.job_id is not null and not exists(select 1 from public.agent_jobs j where j.job_id=e.job_id)),
      'tarefas_sem_empresa',(select count(*) from public.tarefas t where t.business_id like 'BIZ-%' and not exists(select 1 from public.portfolio p where p.business_id=t.business_id)),
      'tarefas_sem_projeto',(select count(*) from public.tarefas t where t.project_id like 'PRJ-%' and not exists(select 1 from public.projetos p where p.project_id=t.project_id)),
      'jobs_empresa_divergente',(select count(*) from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id where j.business_id is distinct from t.business_id),
      'eventos_empresa_divergente',(select count(*) from public.agent_job_events e join public.agent_jobs j on j.job_id=e.job_id where e.business_id is distinct from j.business_id)),
    'registro_operacional',jsonb_build_object('protocolo','PAG-V9-019','aplicacao','TODOS','rpc','gateway_record_agent_progress',
      'marcos_com_motivo',(select count(*) from public.agent_job_events where event_type='PROGRESS' and nullif(payload->>'reason','') is not null)),
    'lacunas_operacionais',jsonb_build_object(
      'jobs_sem_task_id',(select count(*) from public.agent_jobs where task_id is null),
      'canal_empresa_registros',(select count(*) from public.channel_connections),
      'gateway_remoto','VERSAO_LOCAL_NAO_HOMOLOGADA_EM_PRODUCAO','identidade_bot_por_agente','NAO_VINCULADA',
      'revisao_automatica_helena','AGENDA_CONFIGURADA_PRIMEIRA_RODADA_NAO_HOMOLOGADA',
      'historico_detalhado_voz','NAO_PERSISTIDO','marcos_historicos','NAO_RECONSTRUIDOS'),
    'codigo_e_implantacao',jsonb_build_object('repositorio','tvmensal2025/financeiromaxnutrition','base_github','83f2ab4',
      'alteracoes_locais','PRESENTES; não publicadas nesta reconciliação','deploy','NÃO CONFIRMADO',
      'voz','Perfil persistente por BIZ-002 no código local; Kokoro oficial, ElevenLabs opcional. Provedor/modelo de IA herdados da configuração canônica. Credenciais não retornam à página.'),
    'pendencias',jsonb_build_array(
      'Publicar e homologar o Gateway e a interface locais; teste local não comprova produção.',
      'Confirmar identidade de cada bot e autorização de todas as ferramentas antes da operação comercial multiempresa.',
      'Vincular novas execuções à tarefa correta; reconciliar jobs legados somente com evidência.',
      'Resolver canal → empresa antes de ampliar para operações simultâneas; não criar empresas fictícias para GRUPO/Sistema.',
      'Homologar TSK-0031 na primeira revisão automática diária; não duplicar agenda nem ativar WhatsApp no piloto.',
      'Manter risco RSK-0007 e bloqueios reais até ação comprovada; DEC-019 adiou a rotação.',
      'Histórico detalhado de voz, cadeia de aceite das decisões e recuperação de eventos antigos continuam incompletos.',
      'Sincronizadores externos de calendário precisam de validação de falhas e remoção de datas.'
    )
  );
  select * into novo from public.registrar_checkpoint_mestre(
    p_titulo=>'Checkpoint Mestre — continuidade reconciliada',
    p_resumo_executivo=>'Fontes, contagens, identidade, plano, agenda e permissões reconciliados. FOC-004 permanece em execução, WIP=1. Pendências externas explicitamente preservadas; não se declara operação integral homologada.',
    p_conteudo_markdown=>$doc$# Continuidade do Sistema Helena

Helena é AGT-01, CEO Virtual / Central de Comando. O fundador é a autoridade superior.
A missão e as regras integrais estão em snapshot.identidade_helena, agentes e protocolo_agentes.

## Retomada
Conectar ao Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) com acesso autorizado.
Ler checkpoint_mestre_atual, validar versão e cadeia e conferir fontes voláteis.
Usar fontes_de_retomada para recuperar história, decisões, pendências e planos completos.
O comando de carregamento é somente leitura. O comando de sincronização cria versão apenas por mudança material.
Não presumir que uma nova conversa herda autenticação ou a agenda local do Codex.

## Reconciliação
Corrigidos vínculo do foco antigo, instruções antigas de V1/V2, resumo de integrações e conexão da revisão diária ao executor existente.
Plano de evolução e mapeamento multiempresa registrados em MEM-PLANO-20260926.
Restrições de escrita global, portfólio por empresa e grants estruturais aplicadas no banco.
Contagens e projeções foram reconstruídas na mesma transação; versões antigas preservadas.

## Supervisão e custo
Uma janela diária às 18h de São Paulo, AUTO-0006 / INT-0011 / REC-0001.
Revisão compacta do lote relevante, sem IA por tarefa ou polling. Sem mudança, não gerar parecer nem mensagem.
Primeira rodada automática não homologada; TSK-0031 continua aberta. Sem WhatsApp no piloto.

## Limites
27 jobs legados sem tarefa não são falhas de referência inexistente nem prova de venda.
Não atribuir autoria, tarefa ou empresa sem evidência. GRUPO/Sistema são escopos internos.
Produção externa, identidade dos bots, histórico de voz e aceite de decisões ainda precisam de homologação.
RSK-0007 não foi encerrado; a rotação segue adiada conforme DEC-019.
Mudanças do código são locais e não foram publicadas nesta reconciliação.
$doc$,
    p_snapshot=>snap,
    p_mudancas_desde_anterior=>jsonb_build_array('Estado Mestre e agenda corrigidos.','Plano, identidade, fontes e dependências externas persistidos.','Contagens e todas as projeções operacionais reconstruídas.','Acessos globais e por empresa corrigidos e testados; pendências reais preservadas.'),
    p_fontes=>fontes||jsonb_build_array('MEM-PLANO-20260926','scripts/sincronizar-checkpoint-continuidade.sql','supabase/migrations/20260926220344_restrict_helena_global_metadata_and_structural_grants.sql','supabase/migrations/20260926222637_restrict_portfolio_to_business_access.sql'),
    p_criado_por=>'Codex — reconciliação expressamente autorizada pelo fundador',
    p_motivo=>'Pedido: validar as divergências e corrigir para garantir continuidade fiel em outra conversa.'
  );
  if novo.versao<>anterior.versao+1 or novo.checkpoint_anterior_id<>anterior.checkpoint_id
      or (select count(*) from public.checkpoint_mestre where status='ATIVO')<>1 then
    raise exception 'Encadeamento inválido; reconciliação revertida';
  end if;
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id,snapshot->'contagens'->'tarefas' as tarefas,
  snapshot->'contagens'->'integracoes' as integracoes,snapshot->'contagens'->'automacoes' as automacoes
from public.checkpoint_mestre_atual;
commit;
