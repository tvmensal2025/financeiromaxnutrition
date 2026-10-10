"""O teste que decide (teste 5 do plano): nenhum defeito plantado passa e nenhuma resposta honesta é recusada."""
import re

import pytest

from validador import CHECAGENS, validar

from .banco import montar
from .casos import DEFEITOS, HONESTAS
from .rodar_banco import avaliar_defeito, avaliar_honesta, rodar_banco

PADRAO_DO_FURO = re.compile(r"^((A|B|C|K|M)-[0-9]{1,3}|F[ABC]-[0-9]{1,2}|R[1-3]-[0-9]{2}|CONF-[0-9]{2}|MAQ-[0-9]{2}[a-z]?|DEC-[0-9]{3})$")


def test_tamanho_minimo_do_banco():
    assert len(DEFEITOS) >= 60, "o plano pede pelo menos 60 respostas com defeito plantado"
    assert len(HONESTAS) >= 20, "o plano pede pelo menos 20 respostas honestas"


def test_ids_dos_casos_sao_unicos():
    ids = [c.id for c in [*DEFEITOS, *HONESTAS]]
    assert len(ids) == len(set(ids))


def test_todo_defeito_aponta_uma_checagem_que_existe():
    for d in DEFEITOS:
        assert d.esperado[0] in CHECAGENS, f"{d.id}: checagem {d.esperado[0]} não existe"
        assert d.esperado[2] in ("RECUSA", "MARCA"), f"{d.id}: informe a gravidade esperada"


@pytest.mark.parametrize("defeito", DEFEITOS, ids=lambda d: d.id)
def test_defeito_plantado_e_pego(defeito):
    erro = avaliar_defeito(defeito)
    assert erro is None, f"{erro}\n  ({defeito.descricao})"


@pytest.mark.parametrize("honesta", HONESTAS, ids=lambda h: h.id)
def test_resposta_honesta_passa(honesta):
    erro = avaliar_honesta(honesta)
    assert erro is None, f"{erro}\n  ({honesta.descricao})"


def test_nenhum_defeito_passa_e_nenhuma_honesta_falha():
    """O teste único que o plano descreve: se algum defeito passar OU alguma honesta falhar, este teste falha."""
    escapes, recusadas = rodar_banco()
    assert not escapes, "Defeitos que PASSARAM:\n" + "\n".join(escapes)
    assert not recusadas, "Respostas honestas que FALHARAM:\n" + "\n".join(recusadas)


def test_cada_checagem_tem_caso_ruim_e_caso_bom():
    """MEL-28: cada checagem tem pelo menos um defeito que ela pega e uma resposta honesta em que ela roda e passa."""
    com_defeito = {d.esperado[0] for d in DEFEITOS}
    passou_em_honesta = set()
    for h in HONESTAS:
        r, c = montar(h.base, h.remendos)
        for chk in validar(r, c).checagens:
            if chk.status == "PASSOU":
                passou_em_honesta.add(chk.id)
    assert set(CHECAGENS) - com_defeito == set(), f"sem caso ruim: {sorted(set(CHECAGENS) - com_defeito)}"
    assert set(CHECAGENS) - passou_em_honesta == set(), f"sem caso bom: {sorted(set(CHECAGENS) - passou_em_honesta)}"


def test_o_readme_fala_de_todas_as_checagens():
    """O README tem uma linha para cada checagem: se uma checagem nova não entrar lá, este teste avisa."""
    from pathlib import Path

    texto = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    assert [i for i in CHECAGENS if i not in texto] == []


def test_cada_checagem_declara_o_furo_que_fecha():
    for c in CHECAGENS.values():
        assert re.match(r"^CHK-[A-Z0-9]+(-[A-Z0-9]+)*$", c.id), c.id
        assert c.fecha_furos, f"{c.id}: diga qual furo fecha"
        for furo in c.fecha_furos:
            assert PADRAO_DO_FURO.match(furo), f"{c.id}: furo {furo!r} fora do padrão do registro de furos"
        assert len(c.o_que_fecha) > 20 and len(c.nome) > 5
        assert c.gravidade in ("RECUSA", "MARCA")


def test_o_item_exato_aparece_no_relatorio():
    """O relatório diz ONDE está o problema, com o caminho do item."""
    d = next(x for x in DEFEITOS if x.id == "I01")
    r, c = montar(d.base, d.remendos)
    falha = validar(r, c).falhas_de("CHK-COMUM-06")[0]
    assert falha.item == "entrega.fatos_com_fonte[0].citacoes[0]"
    assert "21 anos" in falha.trecho
    d = next(x for x in DEFEITOS if x.id == "Z36")
    r, c = montar(d.base, d.remendos)
    assert validar(r, c).falhas_de("CHK-GANHO-01")[0].item == "entrega.texto_do_convite#linha2"
