-- Eventos futuros de tarefas: registra apenas metadados, sem copiar evidências ou conteúdo sensível.
CREATE TABLE public.task_activity (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL,
  business_id text,
  event_type text NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[] NOT NULL DEFAULT '{}',
  status_before text,
  status_after text,
  actor_uid uuid,
  actor_role text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_activity_business_task_time_idx
  ON public.task_activity (business_id, task_id, occurred_at DESC);
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_activity_business_select ON public.task_activity
  FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
REVOKE ALL ON public.task_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.task_activity TO authenticated;

CREATE OR REPLACE FUNCTION public.record_task_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_fields text[];
  v_task_id text;
  v_business_id text;
  v_before text;
  v_after text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_fields := ARRAY['status', 'responsavel', 'prioridade', 'prazo'];
    v_task_id := NEW.task_id;
    v_business_id := NEW.business_id;
    v_after := NEW.status;
  ELSIF TG_OP = 'DELETE' THEN
    v_fields := ARRAY['registro'];
    v_task_id := OLD.task_id;
    v_business_id := OLD.business_id;
    v_before := OLD.status;
  ELSE
    v_fields := array_remove(ARRAY[
      CASE WHEN OLD.business_id IS DISTINCT FROM NEW.business_id THEN 'business_id' END,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status' END,
      CASE WHEN OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN 'responsavel' END,
      CASE WHEN OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN 'prioridade' END,
      CASE WHEN OLD.prazo IS DISTINCT FROM NEW.prazo THEN 'prazo' END,
      CASE WHEN OLD.bloqueio IS DISTINCT FROM NEW.bloqueio THEN 'bloqueio' END,
      CASE WHEN OLD.evidencia IS DISTINCT FROM NEW.evidencia THEN 'evidencia' END,
      CASE WHEN OLD.definicao_de_pronto IS DISTINCT FROM NEW.definicao_de_pronto THEN 'definicao_de_pronto' END
    ]::text[], NULL);
    IF cardinality(v_fields) = 0 THEN RETURN NEW; END IF;
    v_task_id := NEW.task_id;
    v_business_id := NEW.business_id;
    v_before := OLD.status;
    v_after := NEW.status;
  END IF;

  INSERT INTO public.task_activity
    (task_id,business_id,event_type,changed_fields,status_before,status_after,actor_uid,actor_role)
  VALUES
    (v_task_id,v_business_id,TG_OP,v_fields,v_before,v_after,auth.uid(),
     nullif(current_setting('request.jwt.claim.role', true), ''));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_task_activity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_task_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.record_task_activity();

-- Mantém o inventário físico do Supabase completo após a nova fonte.
LOCK TABLE public.helena_campos IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.helena_campos(tabela,aba_planilha,coluna,nome_na_planilha,chave,calculado,como_usar)
SELECT c.table_name, 'Task_Activity', c.column_name,
  initcap(replace(c.column_name,'_',' ')),
  CASE WHEN c.column_name='event_id' THEN 'SIM' ELSE 'NAO' END,
  'SIM', 'Histórico técnico automático de tarefas; somente leitura no aplicativo. Tipo PostgreSQL: ' || c.data_type
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='task_activity'
  AND NOT EXISTS (SELECT 1 FROM public.helena_campos h WHERE h.tabela=c.table_name AND h.coluna=c.column_name)
ORDER BY c.ordinal_position;
