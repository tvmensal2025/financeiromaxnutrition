-- ======================================================================
-- MIGRATION: 20260924_fix_helena_functions_security.sql
-- RESOLUÇÃO DO ALERTA DE SEGURANÇA SUPABASE: function_search_path_mutable
-- Corrige search_path para public, pg_temp nas 4 funções executivas da Helena
-- ======================================================================

-- 1. helena_financeiro_antes
CREATE OR REPLACE FUNCTION public.helena_financeiro_antes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa_conta text;
  empresa_destino text;
BEGIN
  IF NEW.valor_original IS NOT NULL AND btrim(NEW.valor_original::text) <> '' THEN
    IF btrim(NEW.valor_original::text) !~ '^[0-9]+([.,][0-9]+)?$' THEN
      RAISE EXCEPTION 'Valor financeiro precisa ser maior ou igual a zero. O sentido fica no fluxo.';
    END IF;
  END IF;

  IF NEW.fluxo = 'TRANSFERÊNCIA' AND (NEW.conta_id IS NULL OR NEW.conta_destino_id IS NULL) THEN
    RAISE EXCEPTION 'Transferência precisa de conta de origem e conta de destino.';
  END IF;

  IF NEW.tipo_ajuste = 'ESTORNO' AND NEW.finance_id_origem IS NULL THEN
    RAISE EXCEPTION 'Estorno precisa do finance_id de origem.';
  END IF;

  IF NEW.status IN ('PAGO', 'RECEBIDO') AND coalesce(NEW.tipo_ajuste, '') = 'PARCIAL' THEN
    RAISE EXCEPTION 'PAGO e RECEBIDO são quitação integral. Parcial continua PARCIAL.';
  END IF;

  IF NEW.conta_id IS NOT NULL THEN
    SELECT business_id INTO empresa_conta
    FROM public.contas_financeiras
    WHERE conta_id = NEW.conta_id;
    IF empresa_conta IS NOT NULL AND NEW.business_id IS NOT NULL AND empresa_conta <> NEW.business_id THEN
      RAISE EXCEPTION 'A conta % pertence a %. Lançamento de outra empresa foi recusado.', NEW.conta_id, empresa_conta;
    END IF;
  END IF;

  IF NEW.conta_destino_id IS NOT NULL THEN
    SELECT business_id INTO empresa_destino
    FROM public.contas_financeiras
    WHERE conta_id = NEW.conta_destino_id;
    IF empresa_destino IS NOT NULL AND NEW.business_id IS NOT NULL AND empresa_destino <> NEW.business_id THEN
      RAISE EXCEPTION 'A conta destino % pertence a outra empresa.', NEW.conta_destino_id;
    END IF;
  END IF;

  NEW.classe_dre := null;
  NEW.conferencia_do_lancamento := null;
  NEW.conferencia_integracao := null;
  NEW.movimento_caixa_brl := null;
  NEW.saldo_aberto_brl := null;
  NEW.valor_assinado_brl := null;
  NEW.valor_brl := null;
  NEW.valor_dre_brl := null;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS helena_financeiro_antes ON public.financeiro;
CREATE TRIGGER helena_financeiro_antes
BEFORE INSERT OR UPDATE ON public.financeiro
FOR EACH ROW EXECUTE FUNCTION public.helena_financeiro_antes();

-- 2. helena_um_foco (WIP = 1)
CREATE OR REPLACE FUNCTION public.helena_um_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'EM EXECUÇÃO' AND EXISTS (
    SELECT 1 FROM public.foco_executivo
    WHERE status = 'EM EXECUÇÃO' AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'WIP = 1. Já existe uma frente EM EXECUÇÃO.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS helena_um_foco ON public.foco_executivo;
CREATE TRIGGER helena_um_foco
BEFORE INSERT OR UPDATE ON public.foco_executivo
FOR EACH ROW EXECUTE FUNCTION public.helena_um_foco();

-- 3. helena_status_planejado (automações e integrações)
CREATE OR REPLACE FUNCTION public.helena_status_planejado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF upper(coalesce(NEW.status, '')) IN ('ATIVA', 'ATIVO', 'OPERACIONAL', 'SINCRONIZADA', 'SINCRONIZADO') THEN
    RAISE EXCEPTION 'Integração e automação não podem ser marcadas como ativas sem teste externo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS helena_integracao_status ON public.integracoes;
CREATE TRIGGER helena_integracao_status
BEFORE INSERT OR UPDATE ON public.integracoes
FOR EACH ROW EXECUTE FUNCTION public.helena_status_planejado();

DROP TRIGGER IF EXISTS helena_automacao_status ON public.automacoes;
CREATE TRIGGER helena_automacao_status
BEFORE INSERT OR UPDATE ON public.automacoes
FOR EACH ROW EXECUTE FUNCTION public.helena_status_planejado();

-- 4. helena_ideia_decisao
CREATE OR REPLACE FUNCTION public.helena_ideia_decisao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.decisao IS NOT NULL AND NEW.decisao NOT IN ('AGORA', 'DEPOIS', 'DESCARTAR', 'PRECISA VALIDAR') THEN
    RAISE EXCEPTION 'Decisão da ideia: AGORA, DEPOIS, DESCARTAR ou PRECISA VALIDAR.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS helena_ideia_decisao ON public.ideias;
CREATE TRIGGER helena_ideia_decisao
BEFORE INSERT OR UPDATE ON public.ideias
FOR EACH ROW EXECUTE FUNCTION public.helena_ideia_decisao();
