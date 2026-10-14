-- O QUE É: revalidação de fontes nas aprovações positivas de card real.
-- Uma reação no card PRONTO não atualiza o card; a autorização de ação externa
-- também passa por outra máquina. O histórico intercepta ambos na transação.

create function helena_v2._real_proteger_aprovacao_fundador() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare v_ordem jsonb;
begin
  if new.papel is distinct from 'FUNDADOR' or new.evento is distinct from 'APROVAR'
     or new.resultado not in ('APLICADO', 'CONVERTIDO', 'REACAO') then
    return new;
  end if;

  -- Card final: reação sem UPDATE. Etapa: E81/E82/E83; ação: X01.
  if not ((new.maquina = 'card' and new.estado_antes = 'PRONTO'
           and new.resultado = 'REACAO')
          or (new.maquina = 'etapa' and new.resultado in ('APLICADO', 'CONVERTIDO'))
          or (new.maquina = 'acao_externa' and new.estado_antes = 'PROPOSTA'
              and new.estado_depois = 'AUTORIZADA'
              and new.resultado in ('APLICADO', 'CONVERTIDO'))) then
    return new;
  end if;

  select c.ordem_de_servico into v_ordem from helena_v2.card c where c.id=new.card_id;
  if v_ordem ->> 'modo_contexto' = 'real'
     or exists (select 1 from helena_v2.solicitacao_card_real s
                where s.card_id=new.card_id) then
    perform helena_v2._real_conferir_card_vinculado(new.card_id);
  end if;
  return new;
end;
$f$;

create trigger a_real_proteger_aprovacao_fundador
before insert on helena_v2.historico
for each row execute function helena_v2._real_proteger_aprovacao_fundador();

revoke execute on function helena_v2._real_proteger_aprovacao_fundador()
from public, anon, authenticated, service_role;
