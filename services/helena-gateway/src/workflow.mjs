import { z } from 'zod';
import { workSubmissionShape, submitWork } from './work-submission.mjs';
import { validateBriefStructure, validateDraftBrief, validateProfessionalBrief } from './brief-contract.mjs';
import { publicationSchema, visualReviewSchema, validatePublication, validateVisualReview } from './publication-contract.mjs';
import { validateCreativeBrief, validateRequestedArtifacts, validateBrandForDesign } from './creative-brief.mjs';
import { agentQualityContract, QUALITY_VERSION, professionalDeliverySchema, qualityReviewSchema, validateProfessionalDelivery, validateQualityReview } from './professional-output.mjs';

const text = (max = 4000) => z.string().trim().min(1).max(max);
const key = text(120);
const job = { job_id: text(120), idempotency_key: key };
const version = { expected_task_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) };
const task = { target_agent_id: text(80), objective: text(400), definition_of_done: text(), instruction: text(8000) };
const contracts = {
  submit_work: ['submit_work', workSubmissionShape, 'Entrega completa em uma chamada: envie delivery com title, content, next_steps, limitations e acceptance_checks com criterion e finding. O Gateway cria a memoria e suas referencias automaticamente. Para imagens inclua artifact_refs verificados e publication. Reenvie exatamente os mesmos argumentos e chave se a conexao falhar. Aguarda revisao independente; nao aprova nem publica.'],
  resolve_job_block: ['resolve_job_block', { ...job, ...version, reason: text() }, 'Helena ou Marina registra a solucao de um bloqueio por decisao e devolve o mesmo job a DRAFT. Nao aprova entrega, nao inicia modelo e preserva limite de tentativas.'],
  revise_task_brief: ['revise_task_brief', {
    job_id: text(120), idempotency_key: key, ...version,
    expected_job_updated_at: z.string().datetime({ offset: true }),
    instruction: z.string().trim().min(700).max(8000),
    definition_of_done: z.string().trim().min(80).max(4000),
    revision_summary: text(1200).min(20)
  }, 'Helena ou Marina corrige o briefing da mesma tarefa apos REQUEST_CHANGES, com versoes conferidas e historico preservado. Mantem DRAFT; nao cria tarefa, nao libera e nao inicia modelo.'],
  get_work_context: ['context', {}, 'Carrega o checkpoint atual, papel, tarefas e encaminhamentos do perfil autenticado.'],
  create_task_job: ['create_task', { ...task, business_id: text(80), idempotency_key: key }, 'Helena ou Marina cria tarefa visivel e job DRAFT na empresa; nao inicia modelo.'],
  adopt_existing_task: ['adopt_existing_task', { task_id: text(120), target_agent_id: text(80), ...version, instruction: text(8000).optional() }, 'Helena ou Marina vincula uma tarefa existente e ainda nao iniciada a um unico job DRAFT, sem duplicar o cartao ou iniciar modelo.'],
  submit_delivery: ['submit_delivery', { ...job, ...version, summary: text(8000), evidence_refs: z.array(text(500)).min(1).max(10), delivery: professionalDeliverySchema, publication: publicationSchema.optional() }, 'Registra entrega e aguarda revisao. Todas as funcoes exigem delivery: schema_version=1, title, content utilizavel, next_steps, limitations e acceptance_checks (criterion, evidence_ref, finding). Material social tambem exige publication: title, caption, strategy, instructions, alt_text. summary e interno.'],
  review_delivery: ['review_delivery', { ...job, ...version, decision: z.enum(['APPROVE', 'REQUEST_CHANGES']), reason: text(), quality_review: qualityReviewSchema.optional(), visual_review: visualReviewSchema.optional() }, 'Revisor designado ou Helena revisa. APPROVE exige quality_review: inspected_evidence_refs, verified_criteria, findings, requirements_met=true; compare o pedido completo. Arte tambem exige visual_review de cada imagem final. Sem ferramenta ou fonte, pedir ajustes. Proibida autoaprovacao.'],
  handoff_task: ['handoff', { ...job, ...version, ...task }, 'Depois da revisao aprovada, cria a proxima tarefa, com fonte, evidencia e responsavel; permanece DRAFT.'],
  release_job: ['release_job', { ...job, ...version }, 'Helena ou Marina libera um DRAFT. Exige executor ativo, limite de tentativas e WIP global 1. Nao inicia o modelo.'],
  record_memory: ['record_memory', { ...job, summary: text(8000), source: text(1000), next_step: text(1000) }, 'Persiste memoria operacional da propria tarefa e empresa, com fonte e proximo passo. Nao altera fatos de outras tabelas.']
};

export const WORKFLOW_TOOLS = new Set(Object.keys(contracts));

function property(field) {
  const schema = propertyShape(field);
  return field.description ? { ...schema, description: field.description } : schema;
}

function propertyShape(field) {
  if (field instanceof z.ZodOptional) return property(field.unwrap());
  if (field instanceof z.ZodBoolean) return { type: 'boolean' };
  if (field instanceof z.ZodLiteral) return { type: typeof field.value, const: field.value };
  if (field instanceof z.ZodObject) return { type: 'object', properties: Object.fromEntries(Object.entries(field.shape).map(([k,v]) => [k, property(v)])), required: Object.entries(field.shape).filter(([,v]) => !v.isOptional()).map(([k]) => k), additionalProperties: false };
  if (field instanceof z.ZodNumber) return { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
  if (field instanceof z.ZodEnum) return { type: 'string', enum: field.options };
  if (field instanceof z.ZodArray) return { type: 'array', items: property(field.element), minItems: 1, maxItems: 10 };
  return { type: 'string', minLength: 1 };
}

export function workflowTools(rpc, readJob, beforeRelease, afterRelease) {
  return Object.fromEntries(Object.entries(contracts).map(([name, [action, shape, description]]) => [name, {
    description,
    schema: z.object(shape).strict(),
    inputSchema: { type: 'object', properties: Object.fromEntries(Object.entries(shape).map(([k,v]) => [k,property(v)])), required: Object.entries(shape).filter(([,v]) => !v.isOptional()).map(([k]) => k), additionalProperties: false },
    handler: async (args, { identity } = {}) => {
      let typesafe;
      let releaseDetail;
      if (identity?.type !== 'hermes_profile' || !identity.bindingVerified || !identity.profileSlug) throw new Error('Workflow exige identidade individual Hermes verificada');
      if (action === 'submit_work') return submitWork(rpc, args, identity);
      if (action === 'create_task' || action === 'handoff') validateBriefStructure(args.instruction);
      if (['create_task', 'handoff'].includes(action) && args.target_agent_id === 'AGT-12' && /post|stor(y|ies)|arte|campanha/i.test(args.objective || ''))
        validateCreativeBrief(args.instruction, args.business_id);
      if (action === 'submit_delivery') {
        validateProfessionalDelivery(args.delivery, args.evidence_refs);
        if (args.publication) validatePublication(args.publication);
        if (args.evidence_refs?.some(ref => ref.startsWith('storage://helena-deliveries/')) && !args.publication)
          throw new Error('Entrega visual exige publication com legenda, estrategia e instrucoes para o fundador');
      }
      if (action === 'revise_task_brief') {
        if (!['AGT-01', 'AGT-04'].includes(identity.agentId)) throw new Error('Somente Helena ou Marina revisa briefing');
        if (!readJob) throw new Error('Leitura da tarefa indisponivel; revisao recusada');
        const detail = await readJob({ job_id: args.job_id });
        const jobRecord = detail?.job;
        const taskRecord = detail?.task;
        const reviewEvent = detail?.events?.find(event => event.event_type === 'WORKFLOW_review_delivery');
        const reviewRequest = reviewEvent?.payload?.request?.payload;
        const reviewPayload = jobRecord?.result_payload;
        const revision = detail?.events?.find(event => event.event_type === 'WORKFLOW_revise_task_brief');
        const priorEdit = revision?.payload;
        const revisedDraft = taskRecord?.status === 'NÃO INICIADA'
          && revision?.job_id === jobRecord?.job_id && revision?.business_id === jobRecord?.business_id
          && priorEdit?.response?.success === true && priorEdit.response.status === 'DRAFT'
          && priorEdit.response.task_id === taskRecord.task_id
          && Number(priorEdit.response.task_version) === Number(taskRecord.row_version)
          && priorEdit.request?.payload?.instruction === jobRecord.instruction
          && priorEdit.request?.payload?.definition_of_done === taskRecord.definicao_de_pronto;
        if (!jobRecord || !taskRecord || jobRecord.task_id !== taskRecord.task_id
          || jobRecord.business_id !== taskRecord.business_id || jobRecord.status !== 'DRAFT'
          || (taskRecord.status !== 'BLOQUEADA' && !revisedDraft) || reviewPayload?.review_pending !== false
          || !reviewPayload?.reviewed_by || !reviewPayload?.review_reason
          || reviewPayload.reviewed_by === jobRecord.agent_id
          || reviewEvent?.agent_id !== reviewPayload.reviewed_by
          || reviewRequest?.decision !== 'REQUEST_CHANGES'
          || reviewRequest?.reason !== reviewPayload.review_reason) {
          throw new Error('Revisao exige o mesmo job em DRAFT, tarefa bloqueada e parecer REQUEST_CHANGES verificavel');
        }
        if (Number(taskRecord.row_version) !== args.expected_task_version
          || Date.parse(jobRecord.updated_at) !== Date.parse(args.expected_job_updated_at)) {
          throw new Error('Versao desatualizada; releia tarefa e job antes de revisar');
        }
        validateDraftBrief({
          ...detail,
          job: { ...jobRecord, instruction: args.instruction },
          task: { ...taskRecord, definicao_de_pronto: args.definition_of_done }
        });
      }
      if (action === 'release_job') {
        if (!readJob) throw new Error('Leitura do briefing indisponível; liberação recusada');
        const detail = await readJob({ job_id: args.job_id });
        validateProfessionalBrief(detail);
        releaseDetail = detail;
        if (beforeRelease) typesafe = await beforeRelease(detail, args, identity);
      }
      if (action === 'review_delivery' && args.decision === 'APPROVE') {
        if (!readJob) throw new Error('Leitura das evidencias indisponivel; aprovacao recusada');
        const context = await readJob({ job_id: args.job_id });
        const refs = context?.job?.evidence_refs;
        const ownRecords = context?.evidence_records?.filter(record => record.related_object_id === args.job_id);
        if (context?.job?.status !== 'WAITING_HELENA' || !Array.isArray(refs) || refs.length === 0
          || !Array.isArray(ownRecords) || ownRecords.length === 0
          || !Array.isArray(context.evidence_missing) || context.evidence_missing.length > 0) {
          throw new Error('Aprovacao exige entrega em revisao e evidencia da propria tarefa localizada no Supabase');
        }
        const delivery = validateProfessionalDelivery(context.job.result_payload?.delivery, refs);
        validateQualityReview(args.quality_review, delivery, refs);
        if (context.job.agent_id === 'AGT-12' && /post|stor(y|ies)|arte/i.test(context.job.objective || '')) {
          validateRequestedArtifacts(context);
          validateBrandForDesign(context, validateCreativeBrief(context.job.instruction, context.job.business_id));
          if (!context.job.result_payload?.publication) throw new Error('Aprovacao visual exige pacote publicavel com legenda e estrategia');
          validatePublication(context.job.result_payload.publication);
          if (!args.visual_review) throw new Error('Aprovacao exige revisao visual dos arquivos finais, nao apenas dimensoes');
          validateVisualReview(args.visual_review, context.artifact_records);
          for (const artifact of context.artifact_records) {
            if (!artifact.sha256 || !context.events?.some(event => event.event_type === 'VISUAL_ASSET_OPENED'
              && event.agent_id === identity.agentId && event.job_id === args.job_id
              && event.payload?.reference === artifact.reference && event.payload?.sha256 === artifact.sha256))
              throw new Error('Abra cada imagem final com get_visual_asset antes de aprovar; falta registro de pixels para este revisor');
          }
        }
      }
      const result = action === 'context'
        ? await rpc('gateway_context', { p_profile_slug: identity.profileSlug })
        : action === 'resolve_job_block'
        ? await rpc('gateway_resolve_job_block', { p_profile_slug: identity.profileSlug, p_payload: args })
        : action === 'revise_task_brief'
        ? await rpc('gateway_revise_task_brief', { p_profile_slug: identity.profileSlug, p_payload: args })
        : action === 'adopt_existing_task'
        ? await rpc('gateway_adopt_existing_task', {
          p_profile_slug: identity.profileSlug,
          p_task_id: args.task_id,
          p_target_agent_id: args.target_agent_id,
          p_expected_task_version: args.expected_task_version,
          p_instruction: args.instruction || null
        })
        : await rpc('gateway_workflow', { p_profile_slug: identity.profileSlug, p_action: action, p_payload: args });
      if (!result || (action !== 'context' && result.success !== true)) throw new Error('Supabase nao confirmou a operacao');
      if (action === 'context') return { ...result, quality_version: QUALITY_VERSION, agent_quality_contract: agentQualityContract(identity.agentId || result.binding?.agent_id || result.profile?.agent_id) };
      if (action === 'release_job' && typesafe && afterRelease)
        return { ...result, typesafe, model_routing: await afterRelease(releaseDetail, typesafe) };
      return typesafe ? { ...result, typesafe } : result;
    }
  }]));
}
