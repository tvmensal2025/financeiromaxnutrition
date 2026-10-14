"""Contador de chamadas: limites da ficha, "entregue agora" e encerramento."""

from ferramentas_helena.contador import CLASSE_DO_MOTOR, MOTIVO_LIMITE, Contador, Decisao

P, E, X, J = Decisao.PERMITIDA, Decisao.ENTREGUE_AGORA, Decisao.ENCERRAR, Decisao.JA_ENCERRADA


def novo(total=5, buscas=3, partes=3, insistencias=3):
    return Contador(total, buscas, partes, insistencias)


def test_ate_o_limite_tudo_passa_e_a_chamada_seguinte_e_recusada():
    c = novo(total=5, buscas=5, partes=5)
    assert [c.autorizar("buscar") for _ in range(5)] == [P] * 5
    assert c.total == 5
    assert c.autorizar("buscar") == E
    assert c.modo_entrega and c.total == 5          # a recusada não entra no total


def test_tres_insistencias_encerram_na_terceira():
    c = novo(total=2, buscas=2, partes=2)
    c.autorizar("buscar"); c.autorizar("buscar")
    sequencia = [c.autorizar("buscar") for _ in range(6)]
    # 1ª recusa = resposta do limite; 3 insistências; a 3ª insistência encerra
    assert sequencia == [E, E, E, X, J, J]
    assert c.encerrada and c.motivo == MOTIVO_LIMITE == "limite_de_chamadas"
    assert CLASSE_DO_MOTOR == "LIMITE_CHAMADAS"


def test_insistencias_configuraveis():
    c = novo(total=1, insistencias=1)
    c.autorizar("buscar")
    assert [c.autorizar("buscar") for _ in range(3)] == [E, X, J]


def test_limite_de_buscas_vale_so_para_buscas():
    c = novo(total=10, buscas=2, partes=5)
    assert [c.autorizar("buscar") for _ in range(2)] == [P, P]
    assert c.autorizar("buscar") == E                    # 3ª busca estoura o limite de buscas
    assert c.total == 2


def test_limite_de_partes_conta_so_partes_entregues():
    c = novo(total=10, buscas=0, partes=2)
    for _ in range(2):
        assert c.autorizar("ler_pagina") == P
        c.registrar_parte_entregue()
    assert c.partes == 2
    assert c.autorizar("ler_pagina") == E


def test_leitura_que_falhou_nao_gasta_parte():
    c = novo(total=10, buscas=0, partes=2)
    for _ in range(5):                 # 5 leituras que falharam (nenhuma parte entregue)
        assert c.autorizar("ler_pagina") == P
    assert c.partes == 0 and c.total == 5


def test_chamada_de_ferramenta_inexistente_conta_no_total():
    c = novo(total=3, buscas=1, partes=1)
    assert [c.autorizar("terminal") for _ in range(3)] == [P, P, P]
    assert c.autorizar("terminal") == E


def test_limites_de_buscas_e_partes_nao_valem_para_ferramenta_fora_da_lista():
    c = novo(total=5, buscas=0, partes=0)
    assert [c.autorizar("ler_pagina", liberada=False) for _ in range(5)] == [P] * 5
    assert c.buscas == 0 and c.total == 5
    assert c.autorizar("ler_pagina", liberada=False) == E        # o total continua valendo


def test_depois_do_limite_nada_volta_a_ser_permitido():
    c = novo(total=1)
    c.autorizar("buscar")
    c.autorizar("buscar")
    assert c.modo_entrega
    assert c.autorizar("ler_pagina") == E


def test_estado_vai_e_volta():
    c = novo(total=2)
    c.autorizar("buscar"); c.autorizar("buscar"); c.autorizar("buscar"); c.autorizar("buscar")
    copia = novo(total=2)
    copia.carregar(c.para_dict())
    assert copia.para_dict() == c.para_dict()
    # já houve 2 recusas antes de salvar; esta é a 3ª (a 2ª insistência), ainda "entregue agora"
    assert copia.autorizar("buscar") == E and copia.recusadas == 3 and copia.insistencias == 2
    assert copia.autorizar("buscar") == X                  # a 4ª recusa encerra, mesmo depois de recarregar
