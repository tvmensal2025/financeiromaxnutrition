-- O que é: trava de runtime para que o plano só receba PLANO_VALIDO quando o motor o emite explicitamente depois de validar_plano.
-- _cabe é usada apenas pelo despachante de eventos automáticos de 0003. Esta trava de runtime
-- não executa nem substitui o validador externo, nem altera as passagens geradas do YAML.
-- Cards que já avançaram sem essa validação exigem conferência separada antes de continuar.

create or replace function helena_v2._cabe(
  p_maquina text, p_alvo uuid, p_papel text, p_evento text
) returns boolean
language plpgsql stable set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare c uuid; v jsonb; vc jsonb; q jsonb;
begin
  if p_maquina = 'card' and p_papel = 'MOTOR' and p_evento = 'PLANO_VALIDO' then
    return false;
  end if;
  select o_card, o_v, o_vc into c, v, vc from helena_v2._carregar(p_maquina, p_alvo);
  q := helena_v2._montar_q(p_maquina, v, c, '{}'::jsonb);
  return helena_v2._achar_linha(p_maquina, p_papel, p_evento, v, q, '{}'::jsonb,
                                null, null, null, vc ->> 'estado') is not null;
end;
$f$;

revoke execute on function helena_v2._cabe(text,uuid,text,text)
  from public, anon, authenticated, service_role;
