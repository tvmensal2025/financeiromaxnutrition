-- Bounded read of independently reviewed, explicitly linked lessons.
begin;
create table if not exists public.agent_workflow_policies (
 policy_id text primary key, version text not null, rules jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.agent_workflow_policies enable row level security;
revoke all on public.agent_workflow_policies from public,anon,authenticated;
grant select on public.agent_workflow_policies to service_role;
insert into public.agent_workflow_policies(policy_id,version,rules) values(
 'bounded-autonomy','20261001-v1',jsonb_build_object(
 'continuity','Persistir reserva antes da IA; reconstruir etapas a partir de jobs e eventos.',
 'correction','Corrigir formato, parametro, referencia ou composicao dentro da tarefa autorizada, com teste e evidencia.',
 'learning','Salvar causa, correcao, evidencia, empresa, job, versao e limite de aplicacao. Hipotese nao e regra.',
 'promotion','Aprendizado reutilizavel exige memoria explicitamente vinculada a entrega aprovada independentemente.',
 'uncertain_outcome','Reconciliar estado, nunca repetir chamada paga com resultado incerto.',
 'limits','Preservar WIP 1, revisao independente, isolamento empresarial e ate 2 tentativas; nao ampliar acesso, gasto ou escopo.',
 'final_delivery','Ao fundador chegam arquivos e copy finais revisados; parecer interno nao e campanha pronta.'
 )) on conflict(policy_id) do nothing;
do $patch$
declare source text; anchor text:=$a$'rules', jsonb_build_array($a$; addition text:=$a$
    'validated_learnings', coalesce((select jsonb_agg(x) from (
      select m.id,j.job_id,j.business_id,j.agent_id,left(m.registro,2000) as lesson,
        left(m.evidencia_origem,500) as evidence, m.row_version
      from public.memoria_mestre m join public.agent_jobs j on j.job_id=m.related_object_id
      where m.scope_type='BUSINESS' and m.status='ATIVO' and m.business_id_area=j.business_id
      and m.registro like 'VALIDADA NO ESCOPO%'
      and j.status='COMPLETED' and j.result_payload->>'review_pending'='false'
      and j.evidence_refs @> jsonb_build_array(m.id)
      and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or (b.scope_type='BUSINESS' and j.business_id=b.business_id))
      and (b.agent_id in ('AGT-01','AGT-04') or j.agent_id=b.agent_id)
      and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id
        and e.event_type='WORKFLOW_review_delivery' and e.agent_id<>j.agent_id
        and e.payload->'request'->'payload'->>'decision'='APPROVE')
      order by m.criado_em desc limit 5
    ) x),'[]'::jsonb),
    'rules', jsonb_build_array($a$;
begin
 source:=pg_get_functiondef('public.gateway_context(text)'::regprocedure);
 if position($a$'validated_learnings'$a$ in source)>0 then return; end if;
 if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1 then
  raise exception 'Context contract diverged; no update'; end if;
 execute replace(source,anchor,addition);
end $patch$;
select jsonb_typeof(public.gateway_context('helena--grupo')->'validated_learnings') as learning_context_ready;
commit;
