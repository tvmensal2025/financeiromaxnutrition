# -*- coding: utf-8 -*-
"""(b) O SQL gerado guardado no git é igual ao que o gerador produz hoje. E a tradução das guardas está certa.

O QUE É: a "impressão digital" do plano. Se alguém mudar o YAML e esquecer de regerar (ou editar o 0002 à mão),
estes testes falham. Também compara, guarda por guarda, o que o provar.py responde e o que o banco responde
para centenas de situações sorteadas: assim as guardas traduzidas para SQL não podem divergir da especificação.
COMO MUDAR: nada. Se falhar, rode `python supabase/migrations-v2/gerar_passagens.py` (ou conserte o YAML).
"""
import copy
import random
import subprocess
import sys

import pytest
from psycopg.types.json import Jsonb

import ajudas as A
import conftest as C
import gerar_passagens as G

P = A.P


def test_o_sql_guardado_e_igual_ao_que_o_gerador_produz_hoje():
    gerado = G.gerar()
    assert set(gerado) == {"0002_passagens_geradas.sql"}
    for nome, texto in gerado.items():
        guardado = (C.MIGRACOES / nome).read_text(encoding="utf-8")
        assert guardado == texto, f"{nome} está velho: rode python supabase/migrations-v2/gerar_passagens.py"


def test_o_gerador_e_deterministico():
    assert G.gerar() == G.gerar()


def test_o_modo_conferir_do_script_sai_com_zero():
    r = subprocess.run([sys.executable, str(C.MIGRACOES / "gerar_passagens.py"), "--conferir"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert P.impressao_digital(*P.carregar()) in r.stdout


def test_a_impressao_digital_vai_no_arquivo_e_e_a_do_provar():
    texto = (C.MIGRACOES / "0002_passagens_geradas.sql").read_text(encoding="utf-8")
    assert f"-- Impressão digital da tabela (provar.impressao_digital): {P.impressao_digital(*P.carregar())}" in texto


def test_mudar_o_yaml_muda_o_sql_gerado():
    vocab, tab = P.carregar()
    tab2 = copy.deepcopy(tab)
    tab2["tetos"]["TETO_EXECUCOES"]["valor"] = 7
    assert G.gerar(vocab, tab2) != G.gerar(vocab, tab)


def test_o_gerador_para_quando_o_yaml_pede_o_que_o_banco_nao_sabe():
    vocab, tab = P.carregar()
    ruim = copy.deepcopy(tab)
    ruim["ligacoes"]["SINAL_NOVO"] = {"no_card": "fazer_cafe"}
    with pytest.raises(G.ErroDoGerador, match="fazer_cafe"):
        G.gerar(vocab, ruim)
    ruim = copy.deepcopy(tab)
    ruim["prazos"]["prazo_novo"] = {"quanto": "quando der", "no_prazo": {"papel": "RELOGIO", "evento": "TEMPO_ESGOTADO"}}
    ruim["estados"]["etapa"]["NA_FILA"]["prazo"] = "prazo_novo"
    with pytest.raises(G.ErroDoGerador, match="de onde vem a hora"):
        G.gerar(vocab, ruim, estrita=False)
    ruim = copy.deepcopy(tab)
    ruim["linhas"]["etapa"][0]["guarda"] = "execucoes ** 2"
    with pytest.raises(Exception):
        G.gerar(vocab, ruim)


def test_o_gerador_recusa_tabela_que_falha_na_estrutura():
    vocab, tab = P.carregar()
    ruim = copy.deepcopy(tab)
    ruim["linhas"]["etapa"].append({"id": "E999", "de": "PRONTA", "evento": "INICIAR_EXECUCAO", "papel": "MOTOR", "efeito": {}, "para": "NA_FILA"})
    with pytest.raises(G.ErroDoGerador, match="R02"):
        G.gerar(vocab, ruim)


# ----------------------------------------------------------------------------- as guardas: provar contra banco
def _sorteio_de_estado(rng, m, ln, params):
    """Um estado e um contexto sorteados para a guarda desta linha."""
    s = [ln.de]
    v = {}
    for var in m.vars:
        if var in m.teto_var:
            val = rng.choice([0, 1, 2, 3, m.teto_var[var], max(m.teto_var[var] - 1, 0)])
            val = min(val, m.teto_var[var])
        else:
            val = rng.choice(m.dominio[var])
        s.append(val)
        v[var] = val
    q = {}
    for nome in P.CONFIG_NOMES[m.nome] + P.PREDICADOS_NOMES[m.nome]:
        q[nome] = rng.random() < 0.5
    for nome, dom in params.items():
        q[nome] = rng.choice(dom)
    return tuple(s), v, q


def test_cada_guarda_traduzida_responde_como_o_provar(con):
    """Para toda linha com guarda: 60 situações sorteadas (semente fixa); o provar e o banco têm de dizer o mesmo."""
    vocab, tab = P.carregar()
    maqs = P.montar(vocab, tab)
    rng = random.Random(20261011)
    total = 0
    verdadeiras = 0
    for nome, m in maqs.items():
        vistos = set()
        for ln in m.linhas:
            base = ln.bruta["id"]
            if not ln.guarda or base in vistos:
                continue
            vistos.add(base)
            params = m.parametros.get((ln.papel, ln.evento), {})
            for _ in range(60):
                s, v, q = _sorteio_de_estado(rng, m, ln, params)
                esperado = bool(ln.guarda(s, q))
                obtido = con.execute("select helena_v2.guarda(%s, %s, %s)", (base, Jsonb(v), Jsonb(q))).fetchone()[0]
                assert obtido == esperado, f"{ln.id} [{ln.guarda_txt}] v={v} q={q}: provar={esperado} banco={obtido}"
                total += 1
                verdadeiras += esperado
    assert total > 3000
    assert 0.1 < verdadeiras / total < 0.9, "o sorteio precisa exercitar guardas verdadeiras e falsas"


def test_a_guarda_das_reacoes_tambem(con):
    vocab, tab = P.carregar()
    maqs = P.montar(vocab, tab)
    rng = random.Random(7)
    for i, r in enumerate(tab["reacoes"]):
        if not r.get("guarda"):
            continue
        m = maqs[r["maquina"]]
        g = P.compilar_expr(r["guarda"], m.idx, m.tetos, set(), "reação")
        for _ in range(40):
            s, v, _q = _sorteio_de_estado(rng, m, type("L", (), {"de": m.estado_inicial})(), {})
            assert con.execute("select helena_v2.guarda(%s, %s, '{}'::jsonb)", (f"reacao_{i + 1}", Jsonb(v))).fetchone()[0] == bool(g(s, {}))


def test_a_situacao_da_etapa_responde_como_o_provar(con):
    vocab, tab = P.carregar()
    me = P.montar(vocab, tab)["etapa"]
    alfa = P.situacao_fn(tab, me)
    rng = random.Random(3)
    for estado in me.estados:
        for _ in range(40):
            s = [estado] + [rng.choice(me.dominio[v]) if v in me.dominio else rng.randint(0, me.teto_var[v]) for v in me.vars]
            v = dict(zip(me.vars, s[1:]))
            assert con.execute("select helena_v2.situacao_da_etapa(%s, %s)", (estado, Jsonb(v))).fetchone()[0] == alfa(tuple(s))


def test_as_passagens_do_banco_sao_as_linhas_do_provar(con):
    """Mesma quantidade de linhas, mesmos ids, mesmo estado de origem e de destino que o provar expandiu."""
    vocab, tab = P.carregar()
    maqs = P.montar(vocab, tab)
    for nome, m in maqs.items():
        do_banco = con.execute("select linha_id, de, para, evento, papel from helena_v2.passagem where maquina = %s order by ordem", (nome,)).fetchall()
        do_provar = [(ln.id, ln.de, ln.para, ln.evento, ln.papel) for ln in m.linhas]
        assert do_banco == do_provar, nome
