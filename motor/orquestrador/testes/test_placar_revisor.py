"""O placar do revisor (teste 9 do plano) e os revisores de mentira que ele tem de reprovar.

Sem banco, sem rede, sem modelo de IA: os casos vêm dos YAML de helena-v2/casos/ e cada revisor aqui é uma função pura.
O que se prova:
  - o banco tem 30 defeitos em 7 tipos e 10 limpas, todos de casos reais da especificação;
  - o revisor que SEMPRE APROVA (prova genérica) passa em conferir_rubrica, o portão 2 de hoje, e REPROVA no placar;
  - o que SEMPRE RECUSA reprova no placar (falsos positivos);
  - um revisor que usa o gabarito (só aqui, em teste) é APROVADO: o placar é alcançável;
  - o limiar é exato: 27 de 30 passa, 26 de 30 reprova; 2 falsos positivos passa, 3 reprova;
  - o que escapa vira registro, pronto para virar regra ou critério novo.
"""
import json

import pytest
from orquestrador.motor import conferir_rubrica
from orquestrador.placar_revisor import (
    DEFEITOS, LIMPAS, TIPOS_DE_DEFEITO, Caso, ErroDoPlacar, carregar_casos, ler_resposta, limiares, pontuar)
from spec_helena import Spec, listar_casos

PROVA_GENERICA = "entrega conferida"   # a mesma prova do revisor roteirizado do motor (motor.py, _texto_roteirizado)


# ---------------------------------------------------------------------------------------
# Revisores de mentira (funções puras)
# ---------------------------------------------------------------------------------------
def resposta(caso, reprovados=(), veredito="FALHOU"):
    """Resposta no formato do portão 2: um critério da rubrica por linha, `reprovados` com o veredito dado, o resto PASSOU."""
    return {"criterios": [{"id": i, "resultado": veredito if i in reprovados else "PASSOU", "prova": f"conferi {i}"}
                          for i in caso.rubrica]}


def sempre_aprova(caso):
    return {"criterios": [{"id": i, "resultado": "PASSOU", "prova": PROVA_GENERICA} for i in caso.rubrica]}


def sempre_recusa(caso):
    return {"criterios": [{"id": i, "resultado": "FALHOU", "prova": "reprovado"} for i in caso.rubrica]}


def oraculo(caso):
    """Usa o rótulo do caso: só existe em teste. Reprova exatamente o critério plantado; a limpa passa inteira."""
    return resposta(caso, {caso.criterio_esperado} if caso.tipo_do_defeito else ())


def oraculo_que_deixa_passar(ids):
    """O oráculo, menos nos casos de `ids`, que ele aprova (erra de propósito)."""
    def revisor(caso):
        return sempre_aprova(caso) if caso.id in ids else oraculo(caso)
    return revisor


def oraculo_que_recusa_limpas(ids):
    """O oráculo, mais uma recusa (no primeiro critério) nas limpas de `ids`."""
    def revisor(caso):
        return resposta(caso, {caso.rubrica[0]}) if caso.id in ids else oraculo(caso)
    return revisor


# ---------------------------------------------------------------------------------------
@pytest.fixture(scope="module")
def spec():
    return Spec()


@pytest.fixture(scope="module")
def da_spec(spec):
    """Os casos de helena-v2/casos/, lidos uma vez só (a leitura leva alguns segundos)."""
    return listar_casos(spec)


@pytest.fixture(scope="module")
def casos(spec, da_spec):
    return carregar_casos(spec, da_spec=da_spec)


def defeitos_de(casos):
    return [c for c in casos if not c.limpa]


def limpas_de(casos):
    return [c for c in casos if c.limpa]


def um_de_cada_tipo(casos, n):
    """n defeitos de n tipos diferentes (o primeiro de cada tipo): erros espalhados pelo placar por tipo."""
    primeiros = {}
    for c in defeitos_de(casos):
        primeiros.setdefault(c.tipo_do_defeito, c.id)
    return list(primeiros.values())[:n]


# ---------------------------------------------------------------------------------------
# (a) o banco de casos
# ---------------------------------------------------------------------------------------
def test_banco_tem_30_defeitos_em_7_tipos_e_10_limpas(casos):
    defeitos, limpas = defeitos_de(casos), limpas_de(casos)
    assert len(defeitos) >= 30
    assert len({c.tipo_do_defeito for c in defeitos}) >= 7
    assert len(limpas) >= 10
    assert (len(defeitos), len(limpas)) == (30, 10)
    assert {c.tipo_do_defeito for c in defeitos} == set(TIPOS_DE_DEFEITO)
    assert len({c.id for c in casos}) == len(casos), "id repetido no banco"


def test_cada_tipo_tem_casos_suficientes_para_o_placar_por_tipo_dizer_algo(casos):
    por_tipo = {t: [c.id for c in defeitos_de(casos) if c.tipo_do_defeito == t] for t in TIPOS_DE_DEFEITO}
    assert all(len(ids) >= 4 for ids in por_tipo.values()), por_tipo


def test_o_banco_vem_dos_casos_reais_e_o_gabarito_aponta_um_criterio_da_rubrica(casos, spec):
    for c in casos:
        assert c.entrega and isinstance(c.entrega, dict), c.id
        assert c.origem.startswith(f"{c.servico}/"), c.id           # arquivo de helena-v2/casos/<servico>/
        assert c.pedido, f"{c.id}: sem pedido para o revisor julgar a entrega"
        esperada = set(spec.tipo(spec.tipo_do_servico(c.servico))["criterio_de_pronto"]["rubrica"])
        assert set(c.rubrica) == esperada, c.id                     # a mesma rubrica que conferir_rubrica exige
        if c.limpa:
            assert c.criterio_esperado is None and c.defeito_plantado is None
        else:
            assert c.criterio_esperado in c.rubrica and c.defeito_plantado, c.id


def test_o_defeito_plantado_esta_na_entrega_que_o_revisor_recebe(casos):
    """Quando o caso diz o trecho do defeito (veredito_esperado_do_revisor.trecho), ele aparece na entrega do caso."""
    def folhas(x):
        if isinstance(x, str):
            return [x]
        if isinstance(x, dict):
            return [t for v in x.values() for t in folhas(v)]
        if isinstance(x, list):
            return [t for v in x for t in folhas(v)]
        return [str(x)]
    com_trecho = [c for c in defeitos_de(casos) if c.trecho]
    assert len(com_trecho) >= 20
    for c in com_trecho:
        texto = " ".join(" ".join(folhas(c.entrega)).split())
        assert " ".join(c.trecho.split()) in texto, f"{c.id}: o trecho do defeito não está na entrega"


def test_o_revisor_real_so_pode_ver_a_entrega_o_pedido_e_a_rubrica(casos):
    for c in casos:
        visao = c.para_o_revisor()
        assert set(visao) == {"servico", "rubrica", "entrega", "pedido"}
        texto = json.dumps(visao, ensure_ascii=False)
        assert c.id not in texto                                   # o id diz RUIM ou BOA
        assert not any(t in texto for t in TIPOS_DE_DEFEITO)
        assert not c.defeito_plantado or c.defeito_plantado not in texto
        visao["entrega"].clear()                                    # é cópia: mexer nela não muda o caso
        assert c.entrega


def test_o_banco_falha_alto_se_a_especificacao_deixa_de_bater(spec, da_spec):
    def carregar(**kw):
        return carregar_casos(spec, da_spec=da_spec, **kw)
    with pytest.raises(ErroDoPlacar, match="não existe"):
        carregar(defeitos={"NAO-EXISTE-1": "ALEM_DA_FONTE"}, limpas=())
    with pytest.raises(ErroDoPlacar, match="só do revisor"):
        carregar(defeitos={"CALC-BOA-01": "ALEM_DA_FONTE"}, limpas=())
    with pytest.raises(ErroDoPlacar, match="só do revisor"):
        carregar(defeitos={"CALC-RUIM-01": "ALEM_DA_FONTE"}, limpas=())   # defeito do código (CHK), não do revisor
    with pytest.raises(ErroDoPlacar, match="BOM que entrega"):
        carregar(defeitos={}, limpas=("CALC-RUIM-19",))
    with pytest.raises(ErroDoPlacar, match="BOM que entrega"):
        carregar(defeitos={}, limpas=("CALC-BOA-03",))                     # boa, mas pergunta em vez de entregar


def test_as_listas_do_banco_batem_com_o_que_carregar_casos_devolve(casos):
    assert [c.id for c in casos] == list(DEFEITOS) + list(LIMPAS)
    assert all(c.tipo_do_defeito == DEFEITOS[c.id] for c in defeitos_de(casos))


# ---------------------------------------------------------------------------------------
# (b) o revisor que SEMPRE APROVA: passa no portão 2 de hoje e reprova no placar
# ---------------------------------------------------------------------------------------
def test_revisor_que_sempre_aprova_passa_em_conferir_rubrica_em_todos_os_casos(casos, spec):
    """A verificação estrutural sozinha não o pega: aprova o defeito de qualquer tipo com a mesma prova genérica."""
    for c in casos:
        assert conferir_rubrica(spec, c.servico, sempre_aprova(c)["criterios"]), c.id


def test_revisor_que_sempre_aprova_reprova_no_placar(casos):
    p = pontuar(sempre_aprova, casos)
    assert (len(p.achados), len(p.escapes), len(p.falsos_positivos)) == (0, 30, 0)
    assert not p.aprovado
    assert p.motivos == ("achou 0 de 30 defeitos; o mínimo é 27",)
    assert all(t["achados"] == 0 and t["escapes"] == t["total"] for t in p.placar_por_tipo.values())
    assert p.tipos_sem_achado == tuple(TIPOS_DE_DEFEITO)            # cego para os 7 tipos
    assert "REPROVADO" in p.resumo()


# ---------------------------------------------------------------------------------------
# (c) o revisor que SEMPRE RECUSA: acha todos os defeitos e reprova pelos falsos positivos
# ---------------------------------------------------------------------------------------
def test_revisor_que_sempre_recusa_reprova_por_falsos_positivos(casos, spec):
    p = pontuar(sempre_recusa, casos)
    assert len(p.achados) == 30 and len(p.escapes) == 0           # os defeitos ele acha, todos
    assert len(p.falsos_positivos) == 10
    assert not p.aprovado
    assert p.motivos == ("10 falsos positivos em 10 limpas; o máximo é 2",)
    assert not any(conferir_rubrica(spec, c.servico, sempre_recusa(c)["criterios"]) for c in casos)   # o portão 2 o barra


# ---------------------------------------------------------------------------------------
# (d) o placar é alcançável: o oráculo (usa o rótulo) é aprovado
# ---------------------------------------------------------------------------------------
def test_oraculo_aprova_o_placar_e_acerta_o_criterio_de_cada_defeito(casos, spec):
    p = pontuar(oraculo, casos)
    assert p.aprovado, p.resumo()
    assert (len(p.achados), len(p.escapes), len(p.falsos_positivos)) == (30, 0, 0)
    assert p.achados_pelo_criterio_errado == () and p.tipos_sem_achado == () and p.invalidas == {}
    assert p.motivos == ()
    assert all(t["achados"] == t["total"] for t in p.placar_por_tipo.values())
    assert sum(t["total"] for t in p.placar_por_tipo.values()) == 30
    assert all(conferir_rubrica(spec, c.servico, oraculo(c)["criterios"]) for c in limpas_de(casos))   # a limpa passa no portão 2


def test_recusa_por_nao_consigo_conferir_tambem_conta_como_recusa(casos):
    def revisor(caso):
        return resposta(caso, {caso.criterio_esperado} if caso.tipo_do_defeito else (), veredito="NAO_CONSIGO_CONFERIR")
    assert pontuar(revisor, casos).aprovado


def test_recusa_pelo_criterio_errado_conta_como_achado_mas_fica_marcada(casos):
    """A regra do plano conta a recusa; o critério errado é aviso para quem lê o placar."""
    def revisor(caso):
        if caso.limpa:
            return oraculo(caso)
        outro = next(i for i in caso.rubrica if i != caso.criterio_esperado)
        return resposta(caso, {outro})
    p = pontuar(revisor, casos)
    assert len(p.achados) == 30 and len(p.achados_pelo_criterio_errado) == 30
    assert p.aprovado


# ---------------------------------------------------------------------------------------
# (e) o limiar é exato
# ---------------------------------------------------------------------------------------
def test_quem_erra_4_defeitos_reprova_com_26_de_30(casos):
    erros = um_de_cada_tipo(casos, 4)
    p = pontuar(oraculo_que_deixa_passar(erros), casos)
    assert (len(p.achados), len(p.escapes), len(p.falsos_positivos)) == (26, 4, 0)
    assert p.minimo_de_achados == 27 and p.maximo_de_falsos_positivos == 2
    assert not p.aprovado
    assert p.motivos == ("achou 26 de 30 defeitos; o mínimo é 27",)


def test_quem_erra_3_defeitos_passa_com_27_de_30(casos):
    erros = um_de_cada_tipo(casos, 3)
    p = pontuar(oraculo_que_deixa_passar(erros), casos)
    assert (len(p.achados), len(p.escapes), len(p.falsos_positivos)) == (27, 3, 0)
    assert p.aprovado and p.motivos == ()


def test_placar_por_tipo_mostra_onde_o_revisor_errou(casos):
    erros = um_de_cada_tipo(casos, 4)
    tipos_com_erro = {DEFEITOS[i] for i in erros}
    p = pontuar(oraculo_que_deixa_passar(erros), casos)
    assert list(p.placar_por_tipo) == list(TIPOS_DE_DEFEITO)         # na ordem dos tipos, todos presentes
    for tipo, placar in p.placar_por_tipo.items():
        esperado_erro = 1 if tipo in tipos_com_erro else 0
        assert placar["escapes"] == esperado_erro and placar["achados"] == placar["total"] - esperado_erro, tipo
    assert p.tipos_sem_achado == ()


def test_falsos_positivos_2_passa_e_3_reprova(casos):
    ids = [c.id for c in limpas_de(casos)]
    dois = pontuar(oraculo_que_recusa_limpas(ids[:2]), casos)
    assert len(dois.falsos_positivos) == 2 and dois.aprovado
    tres = pontuar(oraculo_que_recusa_limpas(ids[:3]), casos)
    assert len(tres.falsos_positivos) == 3 and not tres.aprovado
    assert tres.motivos == ("3 falsos positivos em 10 limpas; o máximo é 2",)
    assert [c.id for c in tres.falsos_positivos] == ids[:3]


def test_os_dois_limites_reprovam_juntos(casos):
    p = pontuar(lambda c: sempre_recusa(c) if c.limpa else sempre_aprova(c), casos)       # o pior dos dois mundos
    assert not p.aprovado and len(p.motivos) == 2


def test_limiares_valem_em_proporcao_para_outro_tamanho_de_banco():
    assert limiares(30, 10) == (27, 2)
    assert limiares(20, 5) == (18, 1)
    assert limiares(31, 10) == (28, 2)       # teto: 27,9 -> 28
    assert limiares(46, 10) == (42, 2)
    assert limiares(10, 4) == (9, 0)         # piso: 0,8 -> 0
    assert limiares(1, 1) == (1, 0)


def test_pontuar_vale_para_banco_de_outro_tamanho():
    def caso(i, tipo):
        return Caso(id=i, tipo_do_defeito=tipo, entrega={"x": 1}, rubrica=("RUB-A", "RUB-B"), criterio_esperado="RUB-A")
    banco = [caso(f"d{n}", "T1" if n % 2 else "T2") for n in range(20)] + [caso(f"l{n}", None) for n in range(5)]
    p = pontuar(oraculo, banco)
    assert (p.minimo_de_achados, p.maximo_de_falsos_positivos, p.aprovado) == (18, 1, True)
    assert p.placar_por_tipo == {"T1": {"total": 10, "achados": 10, "escapes": 0}, "T2": {"total": 10, "achados": 10, "escapes": 0}}
    dois_erros = pontuar(oraculo_que_deixa_passar({"d1", "d2", "d3"}), banco)
    assert len(dois_erros.achados) == 17 and not dois_erros.aprovado


def test_placar_sem_defeito_ou_sem_limpa_nao_prova_nada(casos):
    with pytest.raises(ValueError):
        pontuar(sempre_recusa, defeitos_de(casos))        # sem limpas, o "recusa tudo" tiraria 30 de 30
    with pytest.raises(ValueError):
        pontuar(sempre_aprova, limpas_de(casos))          # sem defeitos, o "aprova tudo" passaria
    with pytest.raises(ValueError):
        pontuar(oraculo, casos + casos[:1])               # caso repetido


# ---------------------------------------------------------------------------------------
# (f) o que escapa vira registro
# ---------------------------------------------------------------------------------------
def test_escape_vira_registro_com_tudo_para_virar_regra_nova(casos):
    erros = um_de_cada_tipo(casos, 4)
    p = pontuar(oraculo_que_deixa_passar(erros), casos)
    assert [c.id for c in p.escapes] == erros
    registro = p.registro_de_escapes()
    assert [r["caso"] for r in registro] == erros
    por_id = {c.id: c for c in casos}
    for r in registro:
        c = por_id[r["caso"]]
        assert r["tipo_do_defeito"] == c.tipo_do_defeito and r["servico"] == c.servico
        assert r["criterio_que_devia_falhar"] == c.criterio_esperado and r["defeito_plantado"]
        assert r["o_revisor"] == "aprova" and r["criterios_que_o_revisor_reprovou"] == []
        assert r["como_o_revisor_respondeu"] == sempre_aprova(c)
        assert "regra" in r["o_que_fazer"] or "CHK" in r["o_que_fazer"]
    json.dumps(registro, ensure_ascii=False)               # é JSON puro: dá para gravar onde a decisão for tomada


def test_revisor_que_sempre_aprova_deixa_30_escapes_registrados(casos):
    p = pontuar(sempre_aprova, casos)
    assert len(p.escapes) == 30 and len(p.registro_de_escapes()) == 30
    assert {r["tipo_do_defeito"] for r in p.registro_de_escapes()} == set(TIPOS_DE_DEFEITO)


def test_revisor_perfeito_nao_deixa_registro(casos):
    assert pontuar(oraculo, casos).registro_de_escapes() == []


# ---------------------------------------------------------------------------------------
# respostas fora do formato
# ---------------------------------------------------------------------------------------
def test_resposta_fora_do_formato_nao_e_aprovacao_nem_recusa_valida(casos):
    p = pontuar(lambda c: None, casos)
    assert len(p.invalidas) == 40
    assert len(p.escapes) == 30 and len(p.falsos_positivos) == 10 and not p.aprovado


def test_uma_resposta_invalida_conta_contra_o_revisor_dos_dois_lados(casos):
    limpa = limpas_de(casos)[0].id
    defeito = defeitos_de(casos)[0].id

    def revisor(caso):
        return {} if caso.id in (limpa, defeito) else oraculo(caso)
    p = pontuar(revisor, casos)
    assert set(p.invalidas) == {limpa, defeito}
    assert [c.id for c in p.escapes] == [defeito] and [c.id for c in p.falsos_positivos] == [limpa]
    assert p.aprovado                                      # 29 de 30 e 1 falso positivo ainda passam


def test_excecao_do_revisor_sobe_e_nao_vira_erro_de_julgamento(casos):
    def revisor(caso):
        raise RuntimeError("sem cota")
    with pytest.raises(RuntimeError, match="sem cota"):
        pontuar(revisor, casos)


def test_ler_resposta_concorda_com_conferir_rubrica_sobre_o_que_e_aprovacao(casos, spec):
    """Para a leitura do placar, 'aprova' é exatamente o que o portão 2 do motor aceita."""
    caso = limpas_de(casos)[0]
    bom = sempre_aprova(caso)["criterios"]
    ids = list(caso.rubrica)
    variantes = {
        "tudo passou": bom,
        "um a menos": bom[:-1],
        "um a mais (repetido)": bom + [bom[0]],
        "id repetido no lugar de outro": [bom[0]] + bom[:1] + bom[2:],
        "prova vazia": [{**bom[0], "prova": "   "}] + bom[1:],
        "sem prova": [{k: v for k, v in bom[0].items() if k != "prova"}] + bom[1:],
        "prova que não é texto": [{**bom[0], "prova": 5}] + bom[1:],
        "id fora da rubrica": [{**bom[0], "id": "RUB-OUTRA-01"}] + bom[1:],
        "um FALHOU": [{**bom[0], "resultado": "FALHOU"}] + bom[1:],
        "um NAO_CONSIGO_CONFERIR": [{**bom[0], "resultado": "NAO_CONSIGO_CONFERIR"}] + bom[1:],
        "veredito em minúscula": [{**bom[0], "resultado": "passou"}] + bom[1:],
        "campo a mais é ignorado": [{**bom[0], "comentario": "ok"}] + bom[1:],
        "item que não é critério": bom[:-1] + ["lixo"],
        "lista vazia": [],
        "criterios não é lista": "tudo certo",
        "criterios ausente": None,
    }
    assert len(ids) >= 2
    for nome, criterios in variantes.items():
        aprovado_no_placar = ler_resposta({"criterios": criterios}, caso.rubrica).decisao == "aprova"
        assert aprovado_no_placar == conferir_rubrica(spec, caso.servico, criterios), nome
    assert ler_resposta({"criterios": variantes["um FALHOU"]}, caso.rubrica).decisao == "recusa"
    assert ler_resposta({"criterios": variantes["um FALHOU"]}, caso.rubrica).reprovados == (ids[0],)
    for nome in ("um a menos", "prova vazia", "veredito em minúscula", "criterios ausente"):
        assert ler_resposta({"criterios": variantes[nome]}, caso.rubrica).decisao == "invalida", nome


def test_ler_resposta_nao_quebra_com_lixo(casos):
    rubrica = casos[0].rubrica
    for lixo in (None, [], "x", 3, {"criterios": [{"id": ["lista"], "resultado": "PASSOU", "prova": "x"}] * len(rubrica)}):
        leitura = ler_resposta(lixo, rubrica)
        assert leitura.decisao == "invalida" and leitura.problema
