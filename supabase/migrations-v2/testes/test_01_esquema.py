# -*- coding: utf-8 -*-
"""(a) O esquema aplica do zero. Confere também que o banco tem as peças que o plano promete.

O QUE É: aplica 0001 a 0004 num banco novo (a fixture `banco` já fez isso) e olha o catálogo:
tabelas, funções, gatilhos, que a tabela de regras está selada e que aplicar de novo não quebra.
COMO MUDAR: tabela ou função nova no esquema entra nas listas abaixo.
"""
import psycopg
import pytest

import ajudas as A
import conftest as C

P = A.P

TABELAS = ["card", "etapa", "acao_externa", "historico", "entrega", "execucao", "mensagem", "conta_papel",
           "passagem", "teto", "variavel", "estado_def", "prazo_def", "macro", "ligacao", "automatico", "reacao",
           "regra_geral", "vocab_evento", "predicado_lista", "entrada", "identidade", "config_nome", "meta_tabela"]
FUNCOES_QUE_MUDAM_DADOS = ["aplicar_evento", "criar_card", "abrir_chamada_helena", "disparar_automaticos"]
FUNCOES_DE_LEITURA = ["tabela_confere", "conferir_historico", "conferir_card", "situacao_efetiva"]


def test_o_esquema_aplica_do_zero_e_tem_as_tabelas(con):
    achadas = {r[0] for r in con.execute("select tablename from pg_tables where schemaname = 'helena_v2'")}
    assert set(TABELAS) <= achadas, set(TABELAS) - achadas


def test_as_funcoes_publicas_existem_e_a_unica_porta_e_a_aplicar_evento(con):
    funcoes = {r[0] for r in con.execute("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
                                         "where n.nspname = 'helena_v2' and prosecdef")}
    # só estas funções mudam dados e rodam com o poder do dono; as internas começam com _ e ninguém comum as chama
    assert funcoes == set(FUNCOES_QUE_MUDAM_DADOS), funcoes
    todas = {r[0] for r in con.execute("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'helena_v2'")}
    assert set(FUNCOES_DE_LEITURA) <= todas


def test_as_colunas_dos_contadores_e_os_tetos_vem_do_yaml(con):
    vocab, tab = P.carregar()
    maqs = P.montar(vocab, tab)
    colunas = {(r[0], r[1]) for r in con.execute(
        "select table_name, column_name from information_schema.columns where table_schema = 'helena_v2'")}
    for nome, m in maqs.items():
        for var in m.vars:
            if nome == "etapa" and var in m.compartilhadas:
                continue
            assert (nome, var) in colunas, f"{nome}.{var} não virou coluna"
        for c in P.CONFIG_NOMES[nome]:
            assert (nome, c) in colunas
    # cada teto vira um CHECK com o valor do YAML
    for nome, m in maqs.items():
        for var, teto in m.teto_var.items():
            if nome == "etapa" and var in m.compartilhadas:
                continue
            definicao = con.execute("select pg_get_constraintdef(oid) from pg_constraint where conname = %s", (f"ck_{nome}_{var}",)).fetchone()
            assert definicao and f"<= {teto}" in definicao[0], (nome, var, teto, definicao)


def test_a_tabela_esta_selada_com_a_impressao_digital_do_provar(con):
    vocab, tab = P.carregar()
    digital = con.execute("select impressao_digital from helena_v2.meta_tabela").fetchone()[0]
    assert digital == P.impressao_digital(vocab, tab)
    assert con.execute("select helena_v2.tabela_confere()").fetchone()[0] is True


def test_editar_uma_linha_da_tabela_a_mao_e_pego(banco):
    """Mesmo desligando o gatilho (só o dono consegue), a edição muda o hash e tabela_confere() acusa."""
    b = banco
    with b.conectar() as con:
        con.execute("begin")
        con.execute("alter table helena_v2.passagem disable trigger a_so_por_migracao")
        con.execute("update helena_v2.passagem set guarda = 'true' where base_id = 'E10'")
        assert con.execute("select helena_v2.tabela_confere()").fetchone()[0] is False
        con.execute("rollback")
        assert con.execute("select helena_v2.tabela_confere()").fetchone()[0] is True


def test_a_tabela_de_regras_recusa_edicao_fora_de_migracao(con):
    for comando in ("update helena_v2.passagem set papel = 'FUNDADOR' where base_id = 'E10'",
                    "delete from helena_v2.teto",
                    "insert into helena_v2.teto values ('TETO_NOVO', 9, 'x')",
                    "truncate helena_v2.passagem"):
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="migra"):
            con.execute(comando)


def test_aplicar_de_novo_nao_quebra_e_nao_muda_nada(fabrica):
    """O 0002 e o 0004 podem ser aplicados outra vez (é o que acontece depois de regerar o YAML)."""
    b = fabrica({})
    with b.conectar() as con:
        antes = con.execute("select hash_das_linhas from helena_v2.meta_tabela").fetchone()[0]
        for arq in ("0002_passagens_geradas.sql", "0003_funcao_unica.sql", "0004_travas_e_permissoes.sql"):
            con.execute(C.ler_sql(arq))
        assert con.execute("select hash_das_linhas from helena_v2.meta_tabela").fetchone()[0] == antes
        assert con.execute("select helena_v2.tabela_confere()").fetchone()[0] is True


def test_o_banco_nao_executa_texto_da_tabela():
    """Sem eval no banco: a função 0003 não monta SQL a partir de guardas; só de nomes de tabela e coluna do catálogo."""
    texto = C.ler_sql("0003_funcao_unica.sql")
    execucoes = [l.strip() for l in texto.splitlines() if l.strip().lower().startswith("execute ")]
    assert len(execucoes) == 2, execucoes     # _gravar (colunas do catálogo) e o hash (nomes fixos de tabela)
    assert all("guarda" not in l for l in execucoes)


def test_todo_arquivo_da_pasta_abre_com_um_comentario_que_diz_o_que_e():
    """Quem mantém isto não programa: cada arquivo começa dizendo o que é, de onde vem e como mudar."""
    pastas = [C.MIGRACOES, C.MIGRACOES / "testes"]
    achados = 0
    for pasta in pastas:
        for caminho in sorted(pasta.iterdir()):
            if caminho.suffix not in (".sql", ".py", ".ini", ".txt") or caminho.name.startswith("."):
                continue
            achados += 1
            linhas = [l for l in caminho.read_text(encoding="utf-8").splitlines() if l.strip()]
            primeiras = " ".join(linhas[:8]).lower()
            if caminho.suffix == ".py":
                abre = linhas[0].startswith("#!") or linhas[0].startswith("# -*-") or linhas[0].startswith('"""')
                texto = caminho.read_text(encoding="utf-8")
                assert abre and "\"\"\"" in texto[:400], f"{caminho.name} precisa abrir com uma explicação entre aspas triplas"
                assert "o que" in texto[:1500].lower() and "como mudar" in texto[:2500].lower(), f"{caminho.name}: diga o que é e como mudar"
            else:
                assert linhas[0].startswith(("--", "#")), f"{caminho.name} precisa abrir com um comentário"
                assert "o que" in primeiras or "arquivo gerado" in primeiras, f"{caminho.name}: diga o que é"
    assert achados >= 14


def test_os_testes_se_recusam_a_rodar_em_banco_que_nao_e_local():
    for url in ("postgresql://postgres@db.exemplo.supabase.co:5432/postgres", "postgresql://u@10.0.0.5/postgres", "postgresql://u@meu-servidor.com/x"):
        with pytest.raises(RuntimeError, match="não é local"):
            C.exigir_banco_local(url)
    for url in ("postgresql://postgres@127.0.0.1:54329/postgres", "postgresql://postgres@localhost:5432/postgres"):
        assert C.exigir_banco_local(url) == url
