-- 0016 — funções de manutenção não são portas da sessão do fundador.
-- O que é: ajuste de privilégios depois de 0001–0015, sem modificar dados.
-- A 0004 concedia EXECUTE a authenticated para toda a lista abaixo.
-- Algumas funções SECURITY DEFINER percorrem cards de todas as empresas e
-- podem devolver identificadores ou detalhes de inconsistências.
-- A tela continua usando as RPCs específicas do fundador (0005–0015).
revoke execute on function helena_v2.disparar_automaticos(uuid,text[]),
  helena_v2.abrir_chamada_helena(text,uuid),
  helena_v2.calcular_hash_das_linhas(),
  helena_v2.tabela_confere(),
  helena_v2.conferir_historico(uuid),
  helena_v2.vigia(),
  helena_v2.conferir_card(uuid),
  helena_v2.situacao_efetiva(helena_v2.etapa)
  from public, anon, authenticated;

grant execute on function helena_v2.disparar_automaticos(uuid,text[]),
  helena_v2.abrir_chamada_helena(text,uuid),
  helena_v2.calcular_hash_das_linhas(),
  helena_v2.tabela_confere(),
  helena_v2.conferir_historico(uuid),
  helena_v2.vigia(),
  helena_v2.conferir_card(uuid),
  helena_v2.situacao_efetiva(helena_v2.etapa)
  to service_role;
