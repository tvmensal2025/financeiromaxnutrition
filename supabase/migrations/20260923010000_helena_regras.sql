-- Regras do Sistema Helena no banco do fundador.
-- Não marca integração como ativa. Mantém uma frente em execução.
-- Valor financeiro é positivo. Conta de outra empresa é recusada.
-- Colunas calculadas da planilha não são aceitas como fato.

create or replace function public.helena_financeiro_antes()
returns trigger
language plpgsql
as $$
declare
  empresa_conta text;
  empresa_destino text;
begin
  if new.valor_original is not null and btrim(new.valor_original::text) <> '' then
    if btrim(new.valor_original::text) !~ '^[0-9]+([.,][0-9]+)?$' then
      raise exception 'Valor financeiro precisa ser maior ou igual a zero. O sentido fica no fluxo.';
    end if;
  end if;

  if new.fluxo = 'TRANSFERÊNCIA' and (new.conta_id is null or new.conta_destino_id is null) then
    raise exception 'Transferência precisa de conta de origem e conta de destino.';
  end if;

  if new.tipo_ajuste = 'ESTORNO' and new.finance_id_origem is null then
    raise exception 'Estorno precisa do finance_id de origem.';
  end if;

  if new.status in ('PAGO', 'RECEBIDO') and coalesce(new.tipo_ajuste, '') = 'PARCIAL' then
    raise exception 'PAGO e RECEBIDO são quitação integral. Parcial continua PARCIAL.';
  end if;

  if new.conta_id is not null then
    select business_id into empresa_conta
    from public.contas_financeiras
    where conta_id = new.conta_id;
    if empresa_conta is not null and new.business_id is not null and empresa_conta <> new.business_id then
      raise exception 'A conta % pertence a %. Lançamento de outra empresa foi recusado.', new.conta_id, empresa_conta;
    end if;
  end if;

  if new.conta_destino_id is not null then
    select business_id into empresa_destino
    from public.contas_financeiras
    where conta_id = new.conta_destino_id;
    if empresa_destino is not null and new.business_id is not null and empresa_destino <> new.business_id then
      raise exception 'A conta destino % pertence a outra empresa.', new.conta_destino_id;
    end if;
  end if;

  new.classe_dre := null;
  new.conferencia_do_lancamento := null;
  new.conferencia_integracao := null;
  new.movimento_caixa_brl := null;
  new.saldo_aberto_brl := null;
  new.valor_assinado_brl := null;
  new.valor_brl := null;
  new.valor_dre_brl := null;
  return new;
end;
$$;

drop trigger if exists helena_financeiro_antes on public.financeiro;
create trigger helena_financeiro_antes
before insert or update on public.financeiro
for each row execute function public.helena_financeiro_antes();

create or replace function public.helena_um_foco()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'EM EXECUÇÃO' and exists (
    select 1 from public.foco_executivo
    where status = 'EM EXECUÇÃO' and id <> new.id
  ) then
    raise exception 'WIP = 1. Já existe uma frente EM EXECUÇÃO.';
  end if;
  return new;
end;
$$;

drop trigger if exists helena_um_foco on public.foco_executivo;
create trigger helena_um_foco
before insert or update on public.foco_executivo
for each row execute function public.helena_um_foco();

create or replace function public.helena_status_planejado()
returns trigger
language plpgsql
as $$
begin
  if upper(coalesce(new.status, '')) in ('ATIVA', 'ATIVO', 'OPERACIONAL', 'SINCRONIZADA', 'SINCRONIZADO') then
    raise exception 'Integração e automação não podem ser marcadas como ativas sem teste externo.';
  end if;
  return new;
end;
$$;

drop trigger if exists helena_integracao_status on public.integracoes;
create trigger helena_integracao_status
before insert or update on public.integracoes
for each row execute function public.helena_status_planejado();

drop trigger if exists helena_automacao_status on public.automacoes;
create trigger helena_automacao_status
before insert or update on public.automacoes
for each row execute function public.helena_status_planejado();

create or replace function public.helena_ideia_decisao()
returns trigger
language plpgsql
as $$
begin
  if new.decisao is not null and new.decisao not in ('AGORA', 'DEPOIS', 'DESCARTAR', 'PRECISA VALIDAR') then
    raise exception 'Decisão da ideia: AGORA, DEPOIS, DESCARTAR ou PRECISA VALIDAR.';
  end if;
  return new;
end;
$$;

drop trigger if exists helena_ideia_decisao on public.ideias;
create trigger helena_ideia_decisao
before insert or update on public.ideias
for each row execute function public.helena_ideia_decisao();
