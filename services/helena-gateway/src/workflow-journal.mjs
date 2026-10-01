import { z } from 'zod';

// Runtime bookkeeping only. It cannot approve, release, produce or publish.
export function workflowJournalTools(rpc) {
  const job = z.string().regex(/^JOB-HR-[a-f0-9]{32}$/);
  return {
    workflow_candidates: {
      description: 'Coordenacao: descobre etapas persistidas elegiveis, inclusive DRAFT, sem iniciar IA ou liberar jobs.',
      schema: z.object({
        created_after: z.string().datetime({ offset: true }),
        adopt_job_ids: z.array(job).max(100).default([]),
        after_job_id: job.optional(), limit: z.number().int().min(1).max(25).default(25)
      }).strict(),
      handler: async (args, { identity } = {}) => {
        if (!identity?.profileSlug) throw new Error('Perfil de coordenacao obrigatorio');
        const result = await rpc('gateway_workflow_candidates', {
          p_profile_slug: identity.profileSlug, p_created_after: args.created_after,
          p_adopt_job_ids: args.adopt_job_ids, p_after_job_id: args.after_job_id || null, p_limit: args.limit
        });
        if (result?.success !== true || !Array.isArray(result.candidates)) throw new Error('Fila persistente nao confirmada');
        return result;
      }
    },
    workflow_checkpoint: {
      description: 'Coordenacao/runtime: reserva e confirma uma etapa com snapshot e deduplicacao. Nao altera status, aprovacao ou tentativas do job.',
      schema: z.object({
        action: z.enum(['list', 'reserve', 'finish']),
        job_id: job.optional(), phase: z.enum(['REVIEW', 'HANDOFF', 'COORDINATE', 'RESOLVE']).optional(),
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        expected_task_version: z.number().int().nonnegative().optional(),
        expected_status: z.string().min(1).max(40).optional(),
        expected_updated_at: z.string().datetime({ offset: true }).optional(),
        run_id: z.string().uuid().optional(), run_token: z.string().uuid().optional(),
        status: z.enum(['CONFIRMED', 'RECONCILED', 'NEEDS_ATTENTION']).optional(),
        diagnostic: z.string().max(100).optional()
        ,after_run_id: z.string().uuid().optional()
      }).strict().superRefine((a, ctx) => {
        const required = a.action === 'reserve' ? ['job_id', 'phase', 'fingerprint', 'expected_task_version', 'expected_status', 'expected_updated_at']
          : a.action === 'finish' ? ['run_id', 'run_token', 'status'] : [];
        for (const key of required) if (a[key] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Campo obrigatorio para esta acao' });
      }),
      handler: async (args, { identity } = {}) => {
        if (!identity?.profileSlug) throw new Error('Perfil de coordenacao obrigatorio');
        const result = await rpc('gateway_workflow_checkpoint', { p_profile_slug: identity.profileSlug, p_payload: args });
        if (result?.success !== true) throw new Error('Registro persistente nao confirmado');
        return result;
      }
    }
  };
}
