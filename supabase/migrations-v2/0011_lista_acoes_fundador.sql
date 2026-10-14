-- O QUE É: projeção mínima das ações externas de um card para o fundador.
-- A tabela mantém SELECT direto fechado ao authenticated; a função não modifica ações.

create function helena_v2.listar_acoes_card(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_acoes jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_card_id is null then
    raise exception 'CARD_OBRIGATORIO' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'codigo', a.codigo, 'etapa_codigo', a.etapa_codigo,
      'tipo', a.tipo, 'estado', a.estado, 'dono', a.dono,
      'prazo_ate', a.prazo_ate, 'versao', a.versao,
      'tem_ferramenta', a.tem_ferramenta)
    order by a.criado_em, a.codigo), '[]'::jsonb)
    into v_acoes
    from helena_v2.acao_externa a where a.card_id = p_card_id;
  return v_acoes;
end;
$f$;

revoke execute on function helena_v2.listar_acoes_card(uuid)
from public, anon, authenticated, service_role;
grant execute on function helena_v2.listar_acoes_card(uuid) to authenticated;
