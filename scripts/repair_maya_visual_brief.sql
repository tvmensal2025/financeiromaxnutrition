-- One-time, version-checked correction of the existing Maya visual pilot.
-- This keeps the job DRAFT and does not run a model or publish anything.
do $repair$
declare
  work public.agent_jobs;
  task public.tarefas;
  revised_instruction text := $brief$
## Contexto e fontes
Empresa Humano Digital (BIZ-003). Este trabalho complementa a tarefa textual de Camila JOB-HR-6da562bfda4490f7ff5f4c655d472d21, que recebeu pedido de ajustes de Augusto porque ainda não existem arquivos visuais. Use o texto abaixo como rascunho editorial interno, não como fonte comercial aprovada. O formulário móvel TSK-HD-20260927-12 é outra tarefa e não substitui esta entrega. Leia get_job e o contexto da empresa antes de começar.

## Objetivo e impacto
Maya (AGT-12) deve criar quatro imagens PNG reais para avaliação interna: um post sobre possibilidades de trabalhar em casa e três stories que expliquem a diferença entre realizar tarefas e indicar pessoas. A meta é permitir que a equipe veja e revise a peça visual na caixa de entregas, sem prometer disponibilidade, renda, emprego ou pagamento. O trabalho não autoriza campanha, publicação ou contato externo.

## Escopo e limites
Trabalhe somente na BIZ-003 e neste job. Não usar nomes ou marcas de parceiros, valores, prazos, depoimentos, comprovantes ou fotos de pessoas reais sem fonte e autorização. Não abrir inscrições, criar link ou enviar mensagens. Não iniciar outro agente ou job. Qualquer fato comercial ainda não confirmado deve aparecer como condição a verificar, jamais como certeza. Não transportar dados de clientes para ferramentas de imagem.

## Plano de trabalho
1. Conferir estado RUNNING, empresa, versão da tarefa e instruções em get_job; se faltar acesso ou ferramenta, registrar bloqueio e parar sem simular entrega. 2. Produzir as quatro artes em PNG com hierarquia legível, contraste e margens próprias para Instagram; conferir texto e dimensões locais. 3. Para cada arquivo, solicitar create_artifact_upload com slot e versão, enviar o PNG para a URL temporária sem divulgar o token, e chamar verify_artifact_upload. 4. Registrar memória própria com fonte e decisões de design. 5. Submeter uma única entrega com as quatro referências storage:// verificadas, referência da memória, resumo e versão atual da tarefa. Aguardar Nina (AGT-10) revisar; nunca se autoaprovar.

## Entregáveis
post-v1.png em 1080x1350: título "Trabalho em casa: conheça as possibilidades"; corpo "Atividades remotas podem ter formatos diferentes. Entenda como funciona antes de decidir."; visual de ambiente doméstico organizado e cartões distintos "realizar tarefas" / "indicar pessoas", sem cifrões ou selo de vaga. story-1-v1.png em 1080x1920: "Buscando uma atividade que possa ser feita de casa? Existem formatos diferentes — vale entender cada um com calma." story-2-v1.png em 1080x1920: "Uma possibilidade é realizar tarefas. Outra é indicar pessoas. São atividades distintas: pagamento por tarefa e eventual comissão de indicação não são a mesma coisa. Condições: a confirmar." story-3-v1.png em 1080x1920: "Antes de decidir, pergunte sobre requisitos, disponibilidade, regras e condições. Esses detalhes precisam ser confirmados." Use checklist e botão apenas ilustrativo "Conhecer o processo", sem link ativo.

## Critérios de pronto
Existem exatamente um post e três stories abríveis, todos PNG, até 5 MB por arquivo e nas dimensões exatas. Texto sem corte, ortografia conferida, contraste legível e tratamento visual consistente. Legenda interna: "Está pesquisando formas de trabalhar em casa? Há possibilidades diferentes que precisam ser entendidas separadamente: realizar tarefas, com condições e remuneração a confirmar, ou indicar pessoas, com eventual comissão e regras também a confirmar. Disponibilidade, requisitos, valores e prazos não estão confirmados neste material." CTA interno: "Quer entender o processo e verificar as condições? Peça informações antes de seguir." Nenhuma peça pode sugerir vaga ou ganho garantido.

## Evidências e registro
Cada imagem deve existir no bucket privado helena-deliveries sob BIZ-003 e o ID deste job, com slot, versão e confirmação de verificação. Inclua as quatro referências storage:// e um registro de memória deste próprio job em evidence_refs; não cite apenas nomes de arquivos locais, descrições textuais ou links públicos. No resumo, registre fonte do texto, ajustes de design, conteúdo ainda não confirmado e o que precisa de revisão. Falha no upload, validação ou leitura exige bloqueio explícito, não entrega fictícia.

## Revisão e encaminhamento
Nina (AGT-10) é a revisora funcional prevista pelo fluxo. Ela deve abrir os quatro arquivos, verificar dimensões, conteúdo, coerência e evidências; devolver ajustes com motivo concreto ou aprovar somente se todos os critérios estiverem atendidos. Helena acompanha a decisão e a peça permanece interna até autorização separada do fundador para uso externo. Após a revisão, não criar nova tarefa automaticamente nem declarar publicação.
$brief$;
begin
  select * into work from public.agent_jobs
    where job_id = 'JOB-HR-49eff2ead7674d06b4b59bc796f08873' for update;
  if not found or work.business_id <> 'BIZ-003' or work.agent_id <> 'AGT-12'
    or work.status <> 'DRAFT' or work.task_id <> 'TSK-HR-49eff2ead7674d06b4b59bc796f08873'
    or work.instruction not like 'CONTEXTO E FONTES:%' then
    raise exception 'Job mudou; releia antes de alterar';
  end if;
  select * into task from public.tarefas where task_id = work.task_id for update;
  if not found or task.business_id <> work.business_id or task.row_version <> 2699 then
    raise exception 'CONFLITO_DE_VERSAO: tarefa mudou; releia antes de alterar';
  end if;
  update public.agent_jobs set instruction = revised_instruction, updated_at = clock_timestamp()
    where job_id = work.job_id;
  perform public.helena_write_record('tarefas', task.task_id, task.row_version,
    jsonb_build_object('definicao_de_pronto',
      'Quatro PNG privados reais: post 1080x1350 e três stories 1080x1920, até 5 MB cada, conteúdo legível, referências storage:// verificadas no Supabase e memória do próprio job. Nina revisa as quatro imagens e o conteúdo; sem publicação ou contato externo.'));
  insert into public.agent_job_events(job_id, agent_id, business_id, event_type, status, message, payload, correlation_id)
    values(work.job_id, 'AGT-04', 'BIZ-003', 'BRIEF_REVISED', 'DRAFT',
      'Briefing visual completo revisado pela coordenação; job permanece DRAFT',
      jsonb_build_object('previous_task_version', task.row_version,
        'instruction_md5', pg_catalog.md5(revised_instruction),
        'source_status', 'DRAFT_REVIEW_PENDING', 'releases_job', false),
      work.correlation_id);
end;
$repair$;
