"""Regressões de promessas e convites explícitos fora das citações do dossiê."""
import copy
import json

from spec_helena import prova
from spec_helena.caso import montar_entrada
from validador import validar


def _rodar(frase=None):
    caso = next(a.caso for a in prova.avaliacoes_da_spec() if a.caso.id == "DOSSIE-BOA-01")
    resposta, contexto = montar_entrada(prova.spec_padrao(), caso)
    resposta = copy.deepcopy(json.loads(resposta))
    if frase is not None:
        resposta["entrega"]["interpretacoes"][0]["leitura"] = frase
    return validar(json.dumps(resposta, ensure_ascii=False), contexto)


def _motivos(rel, chk):
    return {f.motivo for f in rel.falhas_de(chk)}


def test_boas_interpretacoes_sem_convite_ou_promessa_passam():
    rel = _rodar()
    assert not rel.falhas_de("CHK-DOSSIE-SEM-PROMESSA-DE-RENDA")
    assert not rel.falhas_de("CHK-DOSSIE-SEM-ACAO-EXTERNA")


def test_ganhos_certos_em_interpretacao_sao_recusados():
    rel = _rodar("Leitura minha: a plataforma oferece ganhos certos a cada pessoa cadastrada.")
    assert "PROMESSA_DE_RENDA" in _motivos(rel, "CHK-DOSSIE-SEM-PROMESSA-DE-RENDA")


def test_visite_site_em_interpretacao_e_recusado():
    rel = _rodar("Leitura minha: visite o site da plataforma para começar agora.")
    assert "CONVITE_A_AGIR" in _motivos(rel, "CHK-DOSSIE-SEM-ACAO-EXTERNA")
