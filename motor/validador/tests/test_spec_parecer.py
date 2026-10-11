"""Testes extras das checagens CHK-PARECER-* (spec_parecer_*.py): o que os casos da especificação não mostram.

O que é: pega a boa-01 da Clara (helena-v2/casos/SRV-PARECER/boas/), muda UMA coisa na resposta ou no contexto e confere o que
cada checagem diz. Os casos da especificação (tests/test_casos_da_spec.py) já provam que cada CHK pega o defeito dela; aqui ficam
os ramos de borda: quando a checagem não se aplica, falha fechada, formato da tabela de leis, exclusões (trecho_da_peca) e versões.
De onde vem: o adaptador spec_helena monta resposta e contexto do caso; nada é copiado do YAML para cá.
Como mudar: para provar uma regra nova, escreva uma função test_... que chame _rodar(...) com a mudança e olhe _status/_motivos.
"""
import copy
import functools
import json

from spec_helena import prova
from spec_helena.caso import montar_entrada
from validador import validar

SPEC = prova.spec_padrao()
P = "CHK-PARECER-"


@functools.lru_cache(maxsize=None)
def _entrada(nome):
    """(resposta em texto, contexto) do caso; montado uma vez (ler os YAML é o que demora)."""
    return montar_entrada(SPEC, next(a.caso for a in prova.avaliacoes_da_spec() if a.caso.id == nome))


def _rodar(mexer_na_resposta=None, mexer_no_contexto=None, caso="PARECER-BOA-01"):
    resposta, contexto = _entrada(caso)
    resposta, contexto = json.loads(resposta), copy.deepcopy(contexto)
    if mexer_na_resposta:
        mexer_na_resposta(resposta)
    if mexer_no_contexto:
        mexer_no_contexto(contexto)
    return validar(json.dumps(resposta, ensure_ascii=False), contexto)


def _status(rel, id_):
    return next(c.status for c in rel.checagens if c.id == id_)


def _motivos(rel, id_):
    return {f.motivo for f in rel.falhas_de(id_)}


def test_a_boa_passa_em_todas_as_checagens_do_parecer():
    rel = _rodar()
    assert [i for i in rel.ids_que_falharam() if i.startswith(P)] == []
    assert all(_status(rel, i) == "PASSOU" for i in (c.id for c in rel.checagens) if i.startswith(P))


def test_nao_se_aplica_fora_do_tipo_parecer_ou_sem_o_servico_ter_pedido_a_checagem():
    rel = _rodar(mexer_no_contexto=lambda c: c["modelo"].update(tipo="dossie"))
    assert {_status(rel, c.id) for c in rel.checagens if c.id.startswith(P)} == {"NAO_SE_APLICA"}
    rel = _rodar(mexer_no_contexto=lambda c: c["modelo"]["checagens_a_rodar"].remove(P + "TEMAS"))
    assert _status(rel, P + "TEMAS") == "NAO_SE_APLICA"


def test_sem_os_parametros_da_especificacao_a_checagem_recusa_em_vez_de_passar():
    rel = _rodar(mexer_no_contexto=lambda c: c["modelo"]["parametros_das_checagens"].pop(P + "TEMAS"))
    assert _motivos(rel, P + "TEMAS") == {"ERRO_INTERNO_DA_CHECAGEM"} and not rel.aprovada


def test_sem_o_pedido_do_card_as_checagens_de_plano_recusam():
    rel = _rodar(mexer_no_contexto=lambda c: c.pop("pedido"))
    for id_ in ("PECAS", "TRECHO-DA-PECA", "PASSOS-FIXOS", "CONDICOES"):
        assert _motivos(rel, P + id_) == {"PLANO_NAO_LIDO"}, id_
    assert _motivos(rel, P + "LEI-NA-TABELA") == {"SEM_TABELA_NO_PACOTE"}


def test_pacote_com_uma_so_versao_exige_essa_versao_mesmo_em_linha_ok():
    def so_a_versao_1(c):
        del c["pedido"]["pacote_do_parecer"]["pecas_julgadas"]["E1"]["versoes"]["2"]

    def linha_ok_na_versao_2(r):
        r["entrega"]["pecas"][0].update(versao=2)
    rel = _rodar(linha_ok_na_versao_2, so_a_versao_1)
    assert "VERSAO_FORA_DO_PACOTE" in _motivos(rel, P + "PECAS")


def test_trecho_da_peca_nao_conta_para_o_termo_do_pacote_mas_o_ajuste_conta():
    def peca_com_o_termo(c):
        v = c["pedido"]["pacote_do_parecer"]["pecas_julgadas"]["E1"]["versoes"]["1"]
        v["versao_final"] += " Venha usar o nosso contador de calorias."

    def cita_a_peca(r):
        r["entrega"]["pecas"][0]["trecho_da_peca"] = "Venha usar o nosso contador de calorias."
    rel = _rodar(cita_a_peca, peca_com_o_termo)
    assert _status(rel, P + "TRECHO-DA-PECA") == "PASSOU"
    assert not rel.falhas_de(P + "TERMO-DO-PACOTE")

    def ajuste_com_o_termo(r):
        r["entrega"]["pecas"][0]["ajuste"] += " Chame de Contador de Calorias."
    assert _motivos(_rodar(ajuste_com_o_termo), P + "TERMO-DO-PACOTE") == {"TERMO_PROIBIDO_DO_PACOTE"}


def test_pacote_sem_lista_de_termos_passa():
    rel = _rodar(mexer_no_contexto=lambda c: c["pacote_da_empresa"].pop("termos_proibidos_em_todo_texto"))
    assert _status(rel, P + "TERMO-DO-PACOTE") == "PASSOU"


def test_tabela_no_formato_da_especificacao_vale_como_a_dos_casos():
    """A especificação escreve texto_oficial e nota_de_jurisprudencia; os casos escrevem texto e nota."""
    def renomear(c):
        for l in c["pedido"]["pacote_do_parecer"]["tabela_de_leis"]["linhas"]:
            l["texto_oficial"], l["nota_de_jurisprudencia"] = l.pop("texto"), l.pop("nota")
    rel = _rodar(mexer_no_contexto=renomear)
    assert not rel.falhas_de(P + "LEI-NA-TABELA") and not rel.falhas_de(P + "NOTA-DE-JURISPRUDENCIA")


def test_nota_com_id_trocado_chega_marcada_e_nao_recusa():
    def nota_errada(r):
        next(f for f in r["entrega"]["fundamentos"] if f["id"] == "F2")["nota"] = "NOTA-TESTE-02"
    rel = _rodar(nota_errada)
    assert _motivos(rel, P + "NOTA-DE-JURISPRUDENCIA") == {"FUNDAMENTO_SEM_A_NOTA"}
    assert all(f.gravidade == "MARCA" for f in rel.falhas_de(P + "NOTA-DE-JURISPRUDENCIA"))


def test_citacao_da_tabela_com_a_fonte_errada_e_pagina_de_outra_execucao():
    def fonte_trocada(r):
        next(f for f in r["entrega"]["fundamentos"] if f["id"] == "F1")["citacao"]["fonte_importada_id"] = "FON-PACOTE-BIZ-004"
    assert _motivos(_rodar(fonte_trocada), P + "LEI-NA-TABELA") == {"FONTE_NAO_E_A_TABELA"}

    def outra_execucao(c):
        c["paginas_lidas"][0]["execucao"] = "EXE-OUTRA"
    assert _motivos(_rodar(mexer_no_contexto=outra_execucao), P + "TERMOS-INTEIROS") == {"PAGINA_DE_OUTRA_EXECUCAO"}
    assert "PAGINA_DE_OUTRA_EXECUCAO" in _motivos(_rodar(mexer_no_contexto=outra_execucao), P + "AUSENCIA")


def test_ausencia_acha_o_termo_sem_diferenca_de_acento_nem_de_maiuscula():
    def termo_com_acento(r):
        r["entrega"]["ausencias"][0]["termos_procurados"] = "Estados Unidos, SERVIDORES LOCALIZADOS FORA DO BRASIL"
    assert _motivos(_rodar(termo_com_acento), P + "AUSENCIA") == {"TERMO_ESTA_NA_PAGINA"}


def test_a_regra_de_aplicar_so_com_a_acao_entregar():
    """REGISTRAR_FALHA (boa-03 e boa-06) não tem entrega: nenhuma checagem do parecer se aplica."""
    rel = _rodar(caso="PARECER-BOA-03")
    assert {_status(rel, c.id) for c in rel.checagens if c.id.startswith(P)} == {"NAO_SE_APLICA"}


def test_roteiro_com_passo_fixo_passa_e_o_tema_dos_passos_confere_com_o_plano():
    rel = _rodar(caso="PARECER-BOA-05")
    assert not [f for f in rel.falhas if f.id.startswith(P)]

    def passo_a_menos(r):
        r["entrega"]["passos_fixos"] = []
    assert "PASSO_SEM_LINHA" in _motivos(_rodar(passo_a_menos, caso="PARECER-BOA-05"), P + "PASSOS-FIXOS")
