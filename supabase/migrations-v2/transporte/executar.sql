-- 1) Conferir os hashes contra manifesto.json ANTES de executar:
select arquivo, octet_length(conteudo) as bytes, encode(sha256(convert_to(conteudo,'UTF8')),'hex') as sha256
from public.helena_v2_instalacao_pedacos where parte = 0 order by arquivo;
-- 2) Instalar (01): uma transação só; o DO desfaz tudo se algo falhar.
-- do $$ declare s text; begin select conteudo into s from public.helena_v2_instalacao_pedacos where arquivo='01' and parte=0; execute s; end $$;
-- 3) Base técnica (02): precisa do papel service_role dentro da transação.
-- begin; set local role service_role; do $$ declare s text; begin select conteudo into s from public.helena_v2_instalacao_pedacos where arquivo='02' and parte=0; execute s; end $$; commit;
-- 4) Rodar 03_conferir_depois.sql: todas as linhas ok = true.
