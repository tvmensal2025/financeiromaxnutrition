"""O relatório: veredito, formato, gravidade configurável, falha fechada e erros de contexto."""
import copy
import json

import pytest

from validador import CHECAGENS, ErroDeContexto, validar
from validador.registro import CONFIG

from . import fabrica as F
from .banco import montar


def rodar(base, remendos=()):
    r, c = montar(base, list(remendos))
    return validar(r, c)


def test_resposta_honesta_e_aprovada_e_tem_todas_as_checagens():
    rel = rodar("dossie")
    assert rel.veredito == "APROVADA" and rel.aprovada
    assert [c.id for c in rel.checagens] == sorted(CHECAGENS)
    assert not rel.falhas and not rel.recusas and not rel.marcas
    assert {c.status for c in rel.checagens} <= {"PASSOU", "NAO_SE_APLICA"}


def test_so_marca_aprova_com_marcas():
    rel = rodar("dossie", [("r.autoavaliacao", "Revisei a estrutura, mas posso ter deixado algum detalhe passar.")])
    assert rel.veredito == "APROVADA_COM_MARCAS" and rel.aprovada
    assert rel.ids_que_falharam() == {"CHK-COMUM-08"} and rel.ids_que_falharam("MARCA") == {"CHK-COMUM-08"}


def test_uma_recusa_basta_para_recusar_mesmo_com_marcas():
    rel = rodar("dossie", [("r.autoavaliacao", "Tenho alta confiança."), ("r.entrega.riscos+", "Enviei o e-mail ao suporte da plataforma ontem.")])
    assert rel.veredito == "RECUSADA" and not rel.aprovada
    assert {"CHK-COMUM-05"} == rel.ids_que_falharam("RECUSA")
    assert {"CHK-COMUM-08"} == rel.ids_que_falharam("MARCA")


def test_relatorio_vira_json_com_os_campos_combinados():
    rel = rodar("convite", [("r.entrega.texto_do_convite", "Uma renda extra para você.")])
    d = json.loads(json.dumps(rel.para_dict(), ensure_ascii=False))
    assert d["veredito"] == "RECUSADA" and d["aprovada"] is False
    assert d["resumo"]["recusas"] == len(d["recusas"]) >= 1
    assert d["resumo"]["checagens_no_total"] == len(CHECAGENS) == len(d["checagens"])
    assert d["tempo_ms"] >= 0 and d["versao_do_validador"]
    f = d["recusas"][0]
    assert set(f) == {"id", "gravidade", "motivo", "item", "trecho", "mensagem"}
    assert f["id"] == "CHK-GANHO-01" and f["item"] == "entrega.texto_do_convite" and f["gravidade"] == "RECUSA"
    por_id = {c["id"]: c for c in d["checagens"]}
    assert por_id["CHK-GANHO-01"]["status"] == "FALHOU" and por_id["CHK-GANHO-01"]["fecha_furos"] == ["C-11"]
    assert por_id["CHK-CALC-01"]["status"] == "NAO_SE_APLICA"  # convite não tem cálculo


def test_mensagens_e_itens_sempre_preenchidos():
    from tests.casos import DEFEITOS

    for d in DEFEITOS[::7]:
        r, c = montar(d.base, d.remendos)
        for f in validar(r, c).falhas:
            assert f.mensagem.strip() and f.item.strip() and f.motivo.strip(), (d.id, f)


def test_gravidade_pode_ser_mudada_na_configuracao(monkeypatch):
    remendos = [("r.entrega.ajustes_necessarios+", "A Lei 12.345/2012 também obriga a avisar os participantes antes do início das gravações.")]
    assert rodar("parecer", remendos).veredito == "APROVADA_COM_MARCAS"
    monkeypatch.setitem(CONFIG["gravidades"], "CHK-LEI-01", "RECUSA")
    rel = rodar("parecer", remendos)
    assert rel.veredito == "RECUSADA" and "CHK-LEI-01" in rel.ids_que_falharam("RECUSA")


def test_artigo_sem_trecho_pode_virar_so_marca_se_o_fundador_quiser(monkeypatch):
    remendos = [("r.entrega.ajustes_necessarios+", "O art. 7º da LGPD exige base legal para o tratamento de dados dos participantes.")]
    assert rodar("parecer", remendos).veredito == "RECUSADA"
    monkeypatch.setitem(CONFIG["gravidades"], "CHK-LEI-02", "MARCA")
    rel = rodar("parecer", remendos)
    assert rel.veredito == "APROVADA_COM_MARCAS" and "CHK-LEI-02" in rel.ids_que_falharam("MARCA")


def test_motivo_tem_prioridade_sobre_a_checagem_inteira(monkeypatch):
    monkeypatch.setitem(CONFIG["gravidades"], "CHK-LEI-01:LEI_FORA_DA_TABELA", "RECUSA")
    rel = rodar("parecer", [("r.entrega.ajustes_necessarios+", "A Lei 12.345/2012 também obriga a avisar os participantes antes do início das gravações.")])
    assert rel.veredito == "RECUSADA"


def test_checagem_que_quebra_recusa_em_vez_de_aprovar(monkeypatch):
    import dataclasses

    def quebra(exe):
        raise RuntimeError("defeito de programação")

    monkeypatch.setitem(CHECAGENS, "CHK-COMUM-09", dataclasses.replace(CHECAGENS["CHK-COMUM-09"], funcao=quebra))
    rel = rodar("dossie")
    assert rel.veredito == "RECUSADA"
    f = rel.falhas_de("CHK-COMUM-09")[0]
    assert f.motivo == "ERRO_INTERNO_DA_CHECAGEM" and f.gravidade == "RECUSA" and "RuntimeError" in f.mensagem


def test_resposta_com_formato_errado_so_roda_as_checagens_de_acao():
    rel = rodar("dossie", [("r", "")])
    rodaram = {c.id for c in rel.checagens if c.status != "NAO_SE_APLICA"}
    assert rodaram == {"CHK-ACAO-01"}
    assert rel.veredito == "RECUSADA"


def test_premissas_aparecem_no_relatorio():
    rel = rodar("calculo")
    assert rel.premissas == [{"id": "horas_por_pessoa", "valor": "20", "unidade": "horas", "ref": "hipótese do Caio"}]
    assert rel.para_dict()["premissas"] == rel.premissas


# ---- erros de quem chama (contexto)
def _ctx(base="dossie"):
    return F.BASES[base]()[1]


def test_modelo_sem_secoes_e_erro_de_contexto():
    r, c = F.dossie()
    del c["modelo"]["secoes"]
    with pytest.raises(ErroDeContexto, match="secoes"):
        validar(json.dumps(r), c)


@pytest.mark.parametrize("mexer,trecho", [
    (lambda c: c.__setitem__("modelo", []), "modelo"),
    (lambda c: c["modelo"]["secoes"][0].__setitem__("tipo_de_campo", "maluco"), "tipo_de_campo"),
    (lambda c: c["modelo"]["validador"].__setitem__("proibir_termo_de_ganho", True), "opção desconhecida"),  # erro de digitação não desliga checagem em silêncio
    (lambda c: c["modelo"]["validador"].__setitem__("exige_fontes", "sim"), "verdadeiro ou falso"),
    (lambda c: c["paginas_lidas"][0].pop("url"), "url"),
    (lambda c: c["paginas_lidas"][0].__setitem__("partes", {"um": "texto"}), "partes"),
    (lambda c: c["paginas_lidas"].append(copy.deepcopy(c["paginas_lidas"][0])), "repetido"),
    (lambda c: c.__setitem__("hoje", "10/10/2026"), "hoje"),
    (lambda c: c.__setitem__("links_do_pedido", "https://x.com"), "links_do_pedido"),
    (lambda c: c.__setitem__("usou_internet", "TALVEZ"), "usou_internet"),
    (lambda c: c.__setitem__("tabela_de_leis", {"leis": [{"id": "X", "nome": "X", "status": "CONFERIDA", "texto_oficial_a_conferir": ""}]}), "CONFERIDA"),
    (lambda c: c["modelo"]["secoes"].append(copy.deepcopy(c["modelo"]["secoes"][0])), "repetido"),
])
def test_contexto_mal_montado_para_com_mensagem_clara(mexer, trecho):
    r, c = F.dossie()
    mexer(c)
    with pytest.raises(ErroDeContexto, match=trecho):
        validar(json.dumps(r), c)
