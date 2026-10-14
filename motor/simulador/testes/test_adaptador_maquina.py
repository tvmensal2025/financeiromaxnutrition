"""(4) O adaptador da máquina real (helena-v2/maquina) via replay.

Quatro coisas:
  A. os nomes e limites do simulador batem com os da máquina real (se um mudar lá, aqui acusa);
  B. os mesmos cenários escritos à mão dão o mesmo resultado na referência e na máquina real;
  C. algumas sementes aleatórias rodam contra a máquina real sem violação (lento: o replay refaz tudo a cada evento);
  D. mutações na TABELA da máquina real (passagens.yaml, só em cópia na memória) são pegas pelas invariantes.
Nada é escrito na pasta da máquina.
"""
import copy
import os

import pytest
import yaml

from ajudantes import (ACAO_AUTORIZADA_E_FALHA, ACAO_ESQUECIDA, AJUSTE_EM_E2_COM_EJ_APROVADA, COMECO_UNICA,
                       DECISAO_MUDA_COM_E1_APROVADA, FELIZ_UNICA, FUNDADOR_REVISA_E_NAO_RESPONDE, ajustes_seguidos, entrega,
                       falha_de_formato, nomes_violados, portao_ok, rodar_lista)
from cenarios_comuns import CENARIOS, divergencias
from simulador import INVARIANTES, Cenario, Referencia, campanha, rodar
from simulador import vocabulario as v
from simulador.adaptador_maquina import (CAMINHO_PADRAO, AlvoMaquina, MaquinaNaoEncontrada, carregar_provar)
from simulador.eventos import autor, fundador, helena, relogio, revisor
from simulador.roteiro import ROTEIRO_PROVA, ROTEIRO_UNICA, ROTEIROS_PRONTOS

try:
    PROVAR = carregar_provar()
except MaquinaNaoEncontrada as erro:                # a máquina vive em outra pasta: aponte com HELENA_MAQUINA
    pytest.skip(str(erro), allow_module_level=True)

VOCAB, TABELA = PROVAR.carregar()

# quantas sementes rodar contra a máquina real (cada uma leva ~0,4 s); aumente para uma varredura mais funda
SEMENTES_NA_MAQUINA = int(os.environ.get("SIM_SEMENTES_MAQUINA", "30"))


# ============================================================================ A. os nomes batem
def _maquinas(nome):
    return VOCAB["maquinas"][nome]


@pytest.mark.parametrize("maquina", ["card", "etapa", "acao_externa"])
def test_estados_batem_com_a_maquina_real(maquina):
    assert set(v.ESTADOS[maquina]["abertos"]) == set(_maquinas(maquina)["abertos"])
    assert set(v.ESTADOS[maquina]["finais"]) == set(_maquinas(maquina)["finais"])
    assert set(v.ESTADOS[maquina]["abertos"]) | set(v.ESTADOS[maquina]["finais"]) == set(TABELA["estados"][maquina])


def test_papeis_e_agentes_batem_com_a_maquina_real():
    assert set(v.PAPEIS) == set(VOCAB["papeis"])
    assert set(v.PAPEIS_DE_IA) == {p for p, d in VOCAB["papeis"].items() if d["e_ia"]}
    assert tuple(v.AGENTES) == tuple(VOCAB["identidades"]["agentes"])
    assert v.FUNDADOR == VOCAB["identidades"]["fundador"]


@pytest.mark.parametrize("papel", v.PAPEIS)
def test_eventos_de_cada_papel_batem_com_a_maquina_real(papel):
    assert set(v.EVENTOS_DO_PAPEL[papel]) == set(VOCAB["acoes"][papel]), papel
    assert len(v.EVENTOS_DO_PAPEL[papel]) == len(set(v.EVENTOS_DO_PAPEL[papel]))


def test_dominios_dos_parametros_batem_com_a_maquina_real():
    a = VOCAB["acoes"]
    assert set(v.CLASSES_DE_FALHA) == set(a["MOTOR"]["FALHA"]["parametros"]["classe"])
    assert set(v.CLASSES_DE_INFRA) == set(a["MOTOR"]["FALHA_INFRA"]["parametros"]["classe"])
    assert set(v.PROPOSTAS_DE_ACAO) == set(a["AUTOR"]["ENTREGAR"]["parametros"]["acao_externa"])
    assert set(v.MOTIVOS_DE_FALHA_DO_AGENTE) == set(a["AUTOR"]["REGISTRAR_FALHA"]["parametros"]["motivo_falha"])
    assert set(v.MOTIVOS_DE_AJUSTE) == set(a["FUNDADOR"]["PEDIR_AJUSTE"]["parametros"]["motivo_ajuste"])
    assert set(v.OPCOES_DE_RESPOSTA) == set(a["FUNDADOR"]["RESPONDER"]["parametros"]["opcao"])


def test_regras_gerais_batem_com_a_maquina_real():
    rg = TABELA["regras_gerais"]
    assert set(v.BOTOES_COM_VERSAO) == set(rg["toques_do_fundador_exigem_versao_vista"])
    assert set(v.CARD_ATIVO) == set(rg["etapa_so_anda_com_card_ativo"]["card_ativo"])


@pytest.mark.parametrize("nome_aqui,nome_la", [
    ("TETO_EXECUCOES", "TETO_EXECUCOES"), ("TETO_INFRA", "TETO_INFRA"), ("TETO_ORDENS", "TETO_ORDENS"),
    ("TETO_PERGUNTAS", "TETO_PERGUNTAS"), ("TETO_LEMBRETES", "TETO_LEMBRETES"), ("TETO_NIVEL_PRAZO", "TETO_NIVEL_PRAZO"),
    ("TETO_MUDANCAS_PRAZO", "TETO_MUDANCAS_PRAZO"), ("TETO_REPROVACOES", "TETO_REPROVACOES"),
])
def test_tetos_batem_com_a_maquina_real(nome_aqui, nome_la):
    assert getattr(v, nome_aqui) == TABELA["tetos"][nome_la]["valor"]


def test_limite_de_inicios_sem_ordem_cobre_o_pior_caso_da_maquina():
    """6 execuções que contam + 3 de infraestrutura + 1 viva (a conta independente do checador)."""
    t = TABELA["tetos"]
    assert v.LIMITE_INICIOS_SEM_ORDEM == t["TETO_EXECUCOES"]["valor"] + t["TETO_INFRA"]["valor"] + 1


def test_donos_e_prazos_da_referencia_batem_com_os_da_maquina_real():
    esperados = AlvoMaquina()._donos
    for maquina, estados in Referencia.DONOS_E_PRAZOS.items():
        assert estados == esperados[maquina], maquina


def test_donos_e_prazos_da_maquina_real_chegam_ao_checador():
    alvo = AlvoMaquina()
    alvo.iniciar(ROTEIRO_UNICA)
    f = alvo.foto()
    assert f.donos["card"]["RASCUNHO"] == ("HELENA", "leitura_de_volta")
    assert "PRONTO" not in f.donos["card"]            # estado final não tem dono


@pytest.mark.parametrize("roteiro", ROTEIROS_PRONTOS, ids=lambda r: r.nome)
def test_os_roteiros_prontos_servem_para_a_maquina_real(roteiro):
    """O roteiro vira o campo 'roteiro' da jornada: tem que passar no esquema e nas conferências de estrutura."""
    import jsonschema
    jornada = {"id": f"simulador-{roteiro.nome}", "roteiro": roteiro.para_jornada(), "eventos": []}
    jsonschema.validate(jornada, PROVAR._schema_jornada())
    resultado = PROVAR.replay(jornada, VOCAB, TABELA)
    assert resultado["violacoes"] == [] and set(resultado["final"]["etapas"]) == set(roteiro.ids())


def test_todo_evento_do_gerador_passa_no_esquema_da_jornada():
    """Se o gerador inventasse um formato que a máquina real não aceita, o replay quebraria em vez de recusar."""
    import jsonschema
    esquema = PROVAR._schema_jornada()
    por_evento = jsonschema.Draft202012Validator(esquema["properties"]["eventos"]["items"])
    total = 0
    for semente in range(300):
        x = rodar(Referencia(), semente)
        for e in x.eventos:
            por_evento.validate(e.para_jornada())
        if semente < 10:                                  # e algumas jornadas inteiras, com o roteiro, contra o esquema todo
            jornada = {"id": f"simulador-{semente}", "roteiro": ROTEIROS_PRONTOS[semente % 3].para_jornada(),
                       "eventos": [e.para_jornada() for e in x.eventos]}
            jsonschema.validate(jornada, esquema)
        total += len(x.eventos)
    assert total > 5_000


def test_a_pasta_padrao_da_maquina_existe_e_a_variavel_de_ambiente_funciona(monkeypatch, tmp_path):
    assert (CAMINHO_PADRAO / "provar.py").is_file()
    monkeypatch.setenv("HELENA_MAQUINA", str(tmp_path))
    with pytest.raises(MaquinaNaoEncontrada):
        carregar_provar()


def test_o_adaptador_nao_escreve_nada_na_pasta_da_maquina():
    antes = sorted(p.name for p in CAMINHO_PADRAO.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    alvo = AlvoMaquina()
    rodar_lista(FELIZ_UNICA, ROTEIRO_UNICA, alvo)
    depois = sorted(p.name for p in CAMINHO_PADRAO.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    assert antes == depois


# ============================================================================ B. os mesmos cenários nos dois alvos
@pytest.mark.parametrize("cenario", CENARIOS, ids=lambda c: c.nome)
def test_cenario_na_maquina_real(cenario):
    x = rodar_lista(cenario.eventos, cenario.roteiro, AlvoMaquina(), cenario.pedido_grande)
    assert divergencias(cenario, x) == []
    assert x.violacoes == [], x.violacoes


def test_a_foto_da_maquina_tem_o_mesmo_formato_que_a_da_referencia():
    maquina, ref = AlvoMaquina(), Referencia()
    for alvo in (maquina, ref):
        alvo.iniciar(ROTEIRO_PROVA, pedido_grande=False)
    fm, fr = maquina.foto(), ref.foto()
    assert set(fm.etapas) == set(fr.etapas) and fm.acoes == fr.acoes == {}
    assert fm.card["estado"] == fr.card["estado"] == "RASCUNHO"
    assert {"estado", "motivo", "ordens", "perguntas", "lembretes", "nivel_prazo", "mudancas_prazo", "fim"} <= set(fm.card)


def test_a_maquina_confere_que_o_historico_reconstroi_o_card_em_cada_cenario_feliz():
    """Regra 13 (conferida em encerrar()): uma linha de histórico por evento e reprodução igual."""
    alvo = AlvoMaquina()
    x = rodar_lista(FELIZ_UNICA, ROTEIRO_UNICA, alvo)
    assert x.violacoes == [] and alvo.encerrar() == ()


# ============================================================================ o atalho de velocidade não muda resultado
ESCOLHIDOS = [c for c in CENARIOS if c.nome in (
    "feliz", "pedido_grande_confirmado", "revisor_reprova_e_volta_ao_autor", "terceira_queda_chama_o_fundador",
    "acao_aprovada_executa_e_conclui", "acao_incerta_que_o_fundador_ignora_nunca_e_refeita",
    "prova_ajuste_na_peca_refaz_quem_a_julgou", "prova_a_quarta_ordem_substitui_o_card", "aprovar_com_a_tela_velha_vira_comentario",
    "sinal_entre_etapas_so_pelo_sinal", "toque_num_card_pronto_vira_card_novo_ligado", "prova_de_ponta_a_ponta_chega_ao_card_pronto")]


def test_os_cenarios_escolhidos_existem():
    assert len(ESCOLHIDOS) == 12


@pytest.mark.parametrize("cenario", ESCOLHIDOS, ids=lambda c: c.nome)
def test_o_caminho_rapido_e_o_lento_dao_exatamente_a_mesma_execucao(cenario):
    rapido = rodar_lista(cenario.eventos, cenario.roteiro, AlvoMaquina(acelerar=True), cenario.pedido_grande)
    lento = rodar_lista(cenario.eventos, cenario.roteiro, AlvoMaquina(acelerar=False), cenario.pedido_grande)
    assert rapido.assinatura == lento.assinatura


@pytest.mark.lento
@pytest.mark.parametrize("semente", [1, 4, 8])
def test_o_caminho_rapido_e_o_lento_dao_a_mesma_execucao_aleatoria(semente):
    rapido = rodar(AlvoMaquina(acelerar=True), semente, max_passos=22)
    lento = rodar(AlvoMaquina(acelerar=False), semente, max_passos=22)
    assert rapido.assinatura == lento.assinatura


def test_o_caminho_rapido_continua_recusando_evento_fora_do_esquema():
    """Validar só o evento novo tem que pegar o mesmo defeito que validar a jornada inteira."""
    import jsonschema
    from simulador.eventos import Evento
    for acelerar in (True, False):
        alvo = AlvoMaquina(acelerar=acelerar)
        alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
        with pytest.raises(jsonschema.ValidationError):
            alvo.aplicar(Evento("DEUS", "APROVAR"))
        with pytest.raises(jsonschema.ValidationError):
            alvo.aplicar(Evento("FUNDADOR", "RESPONDER", params={}))        # RESPONDER exige a opção


def test_o_caminho_rapido_valida_o_roteiro_ao_iniciar():
    import jsonschema
    from simulador.roteiro import Etapa, Roteiro
    ruim = Roteiro("ruim", (Etapa("minuscula", "CAIO", ("CLARA",)),))     # id fora do padrão do esquema
    alvo = AlvoMaquina()
    assert alvo.acelerado
    with pytest.raises(jsonschema.ValidationError):
        alvo.iniciar(ruim)


def test_se_a_maquina_mudar_de_forma_o_adaptador_volta_para_o_caminho_lento():
    alvo = AlvoMaquina(acelerar=False)
    assert alvo.acelerado is False
    delattr(alvo.provar, "_schema_jornada")                 # o módulo é uma cópia só deste alvo
    assert alvo._acelerar() is False
    outro = AlvoMaquina(acelerar=False)
    delattr(outro.provar, "montar")
    assert outro._acelerar() is False


# ============================================================================ C. sementes aleatórias contra a máquina real
@pytest.mark.lento
def test_sementes_aleatorias_contra_a_maquina_real_sem_violacao():
    c = campanha(AlvoMaquina, range(SEMENTES_NA_MAQUINA), max_passos=40)
    assert c.ok, [(x.semente, x.violacoes[:2]) for x in c.com_violacao]
    assert c.total == SEMENTES_NA_MAQUINA and sum(c.eventos.values()) > 100


@pytest.mark.lento
@pytest.mark.parametrize("roteiro", ROTEIROS_PRONTOS, ids=lambda r: r.nome)
def test_cada_roteiro_contra_a_maquina_real_com_so_a_esteira(roteiro):
    from simulador.mundo import PESOS_SO_ESTEIRA
    c = campanha(AlvoMaquina, range(100, 103), Cenario(roteiro=roteiro, pesos=PESOS_SO_ESTEIRA, pedido_grande=False),
                 max_passos=40)
    assert c.ok, [(x.semente, x.violacoes[:2]) for x in c.com_violacao]


@pytest.mark.lento
@pytest.mark.parametrize("categoria", ["botao_livre", "relogio", "decisao", "queda", "repeticao", "atrasada", "ilegal"])
def test_cada_categoria_de_evento_pesada_sozinha_contra_a_maquina_real(categoria):
    """Aumenta uma categoria de cada vez (peso 40) para estressar aquele tipo de evento na máquina real."""
    c = campanha(AlvoMaquina, range(300, 304), Cenario(pesos={categoria: 40}), max_passos=40)
    assert c.ok, [(x.semente, x.violacoes[:2]) for x in c.com_violacao]
    assert c.categorias[categoria] > 0


@pytest.mark.lento
def test_a_mesma_semente_contra_a_maquina_real_e_reprodutiva():
    a, b = rodar(AlvoMaquina(), 5, max_passos=25), rodar(AlvoMaquina(), 5, max_passos=25)
    assert a.assinatura == b.assinatura


# ============================================================================ D. mutações na tabela da máquina real
def _linha(tabela, id_):
    for linhas in tabela["linhas"].values():
        for l in linhas:
            if l["id"] == id_:
                return l
    raise KeyError(id_)


def _sem_o_trecho(tabela, id_, trecho):
    l = _linha(tabela, id_)
    assert trecho in l["guarda"], (id_, trecho)
    l["guarda"] = l["guarda"].replace(trecho, "True")


def sem_teto_de_execucoes(t):
    t["tetos"]["TETO_EXECUCOES"]["valor"] = 600


def sem_teto_de_ordens(t):
    t["tetos"]["TETO_ORDENS"]["valor"] = 600


def padrao_da_espera_aprova(t):
    _linha(t, "E91")["para"] = "APROVADA"


def padrao_da_acao_autoriza(t):
    _linha(t, "X04")["para"] = "AUTORIZADA"


def decisao_nova_nao_refaz_a_aprovada(t):
    _linha(t, "E115")["para"] = "MESMO"


def ajuste_nao_refaz_quem_depende(t):
    t["ligacoes"]["DEPENDENTES_MUDOU"]["para"] = []


def portao_aceita_o_autor_como_revisor(t):
    _sem_o_trecho(t, "E40", "revisor_valido")


def qualquer_um_responde_como_revisor(t):
    t["regras_gerais"]["respostas_de_revisor_exigem_revisor_designado"] = False


def resposta_antiga_do_agente_grava(t):
    t["regras_gerais"]["respostas_de_agente_exigem_chave_atual"] = []


def acao_falha_e_executa_de_novo(t):
    t["tetos"]["TETO_EXECUCOES_ACAO"]["valor"] = 5
    _linha(t, "X21")["para"] = "AUTORIZADA"


def quem_leu_a_internet_pergunta(t):
    _sem_o_trecho(t, "E21", "usou_internet == 'NAO'")


def cancelar_nao_fecha_as_etapas(t):
    t["ligacoes"]["CANCELAR_ETAPAS"]["para"] = []


def duas_linhas_para_o_mesmo_evento(t):
    copia = copy.deepcopy(_linha(t, "E54"))
    copia["id"] = "E54COPIA"
    t["linhas"]["etapa"].append(copia)


def _teto_estourado():
    """E1 (do roteiro 'prova') chega a 6 execuções com as falhas de cada classe e uma sétima é pedida."""
    entrega_e1 = [entrega("E1", "CAIO"), portao_ok("E1", "CLARA")]
    return ([helena("LER_DE_VOLTA")] + entrega_e1 + [revisor("REPROVAR", "E1", "CLARA"), falha_de_formato("E1")]
            + entrega_e1 + [revisor("REPROVAR", "E1", "CLARA"), relogio("TEMPO_ESGOTADO", "E1"), entrega("E1", "CAIO")])


MUTACOES_DA_MAQUINA = [
    ("sem_teto_de_execucoes", sem_teto_de_execucoes, "teto_de_execucoes", ROTEIRO_PROVA, _teto_estourado()),
    ("sem_teto_de_ordens", sem_teto_de_ordens, "contadores_dentro_do_teto", ROTEIRO_PROVA, ajustes_seguidos(4)),
    ("padrao_da_espera_aprova", padrao_da_espera_aprova, "padrao_nunca_aprova", ROTEIRO_UNICA, FUNDADOR_REVISA_E_NAO_RESPONDE),
    ("padrao_da_acao_autoriza", padrao_da_acao_autoriza, "padrao_nunca_aprova", ROTEIRO_UNICA, ACAO_ESQUECIDA),
    ("decisao_nova_nao_refaz_a_aprovada", decisao_nova_nao_refaz_a_aprovada, "pronto_sem_informacao_velha", ROTEIRO_PROVA,
     DECISAO_MUDA_COM_E1_APROVADA),
    ("ajuste_nao_refaz_quem_depende", ajuste_nao_refaz_quem_depende, "pronto_sem_informacao_velha", ROTEIRO_PROVA,
     AJUSTE_EM_E2_COM_EJ_APROVADA),
    ("portao_aceita_o_autor_como_revisor", portao_aceita_o_autor_como_revisor, "ninguem_aprova_a_propria_peca", ROTEIRO_PROVA,
     [helena("LER_DE_VOLTA"), entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "ISABELA")]),
    ("qualquer_um_responde_como_revisor", qualquer_um_responde_como_revisor, "ninguem_aprova_a_propria_peca", ROTEIRO_UNICA,
     COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CAIO")]),
    ("resposta_antiga_do_agente_grava", resposta_antiga_do_agente_grava, "resposta_antiga_nao_grava", ROTEIRO_UNICA,
     COMECO_UNICA + [entrega("U1", "CAIO", chave="antiga")]),
    ("acao_falha_e_executa_de_novo", acao_falha_e_executa_de_novo, "nada_externo_pelo_agente", ROTEIRO_UNICA,
     ACAO_AUTORIZADA_E_FALHA),
    ("quem_leu_a_internet_pergunta", quem_leu_a_internet_pergunta, "quem_leu_internet_so_entrega", ROTEIRO_UNICA,
     COMECO_UNICA + [autor("PERGUNTAR", "U1", "CAIO", usou_internet="SIM")]),
    ("cancelar_nao_fecha_as_etapas", cancelar_nao_fecha_as_etapas, "etapas_seguem_o_card", ROTEIRO_UNICA,
     COMECO_UNICA + [fundador("CANCELAR")]),
    ("duas_linhas_para_o_mesmo_evento", duas_linhas_para_o_mesmo_evento, "o_alvo_nao_acusou", ROTEIRO_UNICA,
     COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CLARA")]),
]


@pytest.mark.parametrize("nome,mutador,invariante,roteiro,eventos", MUTACOES_DA_MAQUINA, ids=[m[0] for m in MUTACOES_DA_MAQUINA])
def test_tabela_estragada_da_maquina_real_e_pega_pelo_checador(nome, mutador, invariante, roteiro, eventos):
    estragada = copy.deepcopy(TABELA)
    mutador(estragada)
    assert estragada != TABELA, "a mutação não mudou nada"
    limpa = rodar_lista(eventos, roteiro, AlvoMaquina(), pedido_grande=False)
    assert nomes_violados(limpa) == [], "controle: a máquina original não pode ser acusada"
    x = rodar_lista(eventos, roteiro, AlvoMaquina(tabela=estragada), pedido_grande=False)
    assert invariante in nomes_violados(x), f"{nome}: acusado só {nomes_violados(x)}"


def test_as_mutacoes_da_maquina_tem_nomes_unicos_e_invariantes_conhecidas():
    nomes = [m[0] for m in MUTACOES_DA_MAQUINA]
    assert len(nomes) == len(set(nomes))
    assert {m[2] for m in MUTACOES_DA_MAQUINA} <= set(INVARIANTES)


def test_o_adaptador_nao_altera_a_tabela_que_recebe():
    tabela = copy.deepcopy(TABELA)
    rodar_lista(FELIZ_UNICA, ROTEIRO_UNICA, AlvoMaquina(tabela=tabela))
    assert tabela == TABELA
    assert yaml.safe_load((CAMINHO_PADRAO / "passagens.yaml").read_text(encoding="utf-8")) == TABELA
