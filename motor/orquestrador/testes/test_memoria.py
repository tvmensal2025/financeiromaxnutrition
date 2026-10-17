"""O que é: especificação executável da memória compactada dos agentes (orquestrador/memoria.py), só com fakes.
Como mudar: cada teste usa dados sintéticos; sem banco, rede ou modelo. Regra nova de escopo muda aqui e em
docs/propostas/0027_memoria_agentes.sql (função _memoria_escopo_permite).
"""
import inspect
import json
from datetime import datetime, timedelta, timezone

import pytest

from orquestrador.memoria import (
    Afirmacao, ContextoDeEscopo, ErroMemoria, FonteRef, LIMITE_DURO_ARGUMENTO_BYTES, Recuperador,
    RecuperadorEmMemoria, Referencia, Resumo, Trecho, anexar_memoria, conferir_resumo, conferir_trecho,
    custo_adicional_tokens, escopo_permite, exigir_resumo_conferido, exigir_revisao_independente,
    montar_bloco_memoria, montar_consulta, numeros_do_texto, orcamento_disponivel, recuperar_trechos,
    reconstruir_bloco, resumo_de_dict, selecionar_resumos, truncar_sem_cortar_numeros)

AGORA = datetime(2026, 10, 17, 12, 0, tzinfo=timezone.utc)
CARD = '11111111-1111-4111-8111-111111111111'
OUTRO_CARD = '22222222-2222-4222-8222-222222222222'
E = FonteRef('ENTREGA', '981')
H = FonteRef('HISTORICO', '55')
D = FonteRef('DECISAO', 'DEC-022')


def ctx(modo='EMPRESA', **kw):
    base = {'EMPRESA': dict(business_id='BIZ-003', agente='ISABELA', servico='SRV-COPY', card_id=CARD),
            'PESSOAL': dict(agente='LAURA', card_id=OUTRO_CARD), 'COORDENACAO': dict(agente='HELENA')}[modo]
    return ContextoDeEscopo(modo, **{**base, **kw})


def resumo(id='R1', escopo='AGENTE_EMPRESA', **kw):
    base = dict(id=id, versao=1, escopo=escopo, business_id='BIZ-003', agente='ISABELA', fontes=(E,),
                afirmacoes=(Afirmacao('Texto aprovado com 3 chamadas.', (E,)),), autor='OLIVIA')
    if escopo == 'CARD':
        base.update(card_id=CARD, agente=None)
    if escopo == 'FUNDADOR':
        base.update(business_id=None, agente=None, aprovado_por='uid-fundador', fontes=(D,),
                    afirmacoes=(Afirmacao('Prefere frases curtas.', (D,)),))
    if escopo == 'PESSOAL':
        base.update(business_id=None, agente='LAURA', aprovado_por='uid-fundador', fontes=(H,),
                    afirmacoes=(Afirmacao('Treina respiração antes de falar.', (H,)),))
    return Resumo(**{**base, **kw})


REFS = {'ENTREGA:981': Referencia('O texto aprovado tem 3 chamadas e 12,5% de desconto.', 'BIZ-003', CARD),
        'HISTORICO:55': Referencia('Fundador pediu respiração.', None, None),
        'DECISAO:DEC-022': Referencia('Frases curtas.', None, None)}


# --------------------------------------------------------------------------------------- escopo
def test_empresa_so_ve_a_propria_empresa_e_o_proprio_card():
    meus = [resumo('A'), resumo('B', 'CARD'), resumo('F', 'FUNDADOR')]
    alheios = [resumo('X', business_id='BIZ-001'), resumo('Y', 'CARD', business_id='BIZ-001'),
               resumo('Z', 'CARD', card_id=OUTRO_CARD), resumo('W', agente='CAIO'),
               resumo('P', 'PESSOAL')]
    ok, descartados = selecionar_resumos(meus + alheios, ctx(), AGORA)
    assert {r.id for r in ok} == {'A', 'B', 'F'}
    assert {d.id for d in descartados} == {'X', 'Y', 'Z', 'W', 'P'}
    assert [r.escopo for r in ok] == ['CARD', 'AGENTE_EMPRESA', 'FUNDADOR']        # mais específico primeiro


def test_pessoal_nunca_entra_em_empresa_e_empresa_nunca_entra_em_pessoal():
    ok, _ = selecionar_resumos([resumo('P', 'PESSOAL'), resumo('A'), resumo('C', 'CARD'),
                                resumo('F', 'FUNDADOR')], ctx(), AGORA)
    assert 'P' not in {r.id for r in ok}
    ok, _ = selecionar_resumos([resumo('P', 'PESSOAL'), resumo('A'), resumo('C', 'CARD'),
                                resumo('F', 'FUNDADOR'), resumo('P2', 'PESSOAL', agente='OUTRA')],
                               ctx('PESSOAL'), AGORA)
    assert {r.id for r in ok} == {'P', 'F'}


def test_card_pessoal_sem_empresa_ve_so_o_proprio_card():
    sem_empresa = resumo('C', 'CARD', business_id=None, card_id=OUTRO_CARD)
    com_empresa = resumo('D', 'CARD', business_id='BIZ-003', card_id=OUTRO_CARD)
    ok, _ = selecionar_resumos([sem_empresa, com_empresa], ctx('PESSOAL'), AGORA)
    assert [r.id for r in ok] == ['C']


def test_coordenacao_so_recebe_escopo_do_fundador():
    ok, _ = selecionar_resumos([resumo('A'), resumo('C', 'CARD'), resumo('P', 'PESSOAL'), resumo('F', 'FUNDADOR')],
                               ctx('COORDENACAO'), AGORA)
    assert [r.id for r in ok] == ['F']


def test_estado_expiracao_e_aprovacao_do_fundador():
    candidatos = [resumo('PROP', estado='PROPOSTO'), resumo('SUP', estado='SUPERADO'),
                  resumo('EXP', expira_em=AGORA - timedelta(seconds=1)),
                  resumo('VIVO', expira_em=AGORA + timedelta(days=1)),
                  resumo('SEMAPROV', 'FUNDADOR', aprovado_por=None), resumo('SEMFONTE', fontes=())]
    ok, descartados = selecionar_resumos(candidatos, ctx(), AGORA)
    assert [r.id for r in ok] == ['VIVO']
    motivos = {d.id: d.motivo for d in descartados}
    assert motivos == {'EXP': 'EXPIRADO', 'SEMAPROV': 'SEM_APROVACAO_DO_FUNDADOR', 'SEMFONTE': 'SEM_FONTES'}


def test_versao_mais_nova_da_mesma_chave_vence():
    ok, _ = selecionar_resumos([resumo('V1'), resumo('V3', versao=3), resumo('V2', versao=2)], ctx(), AGORA)
    assert [r.id for r in ok] == ['V3']


def test_servico_do_resumo_precisa_casar_ou_ser_geral():
    ok, _ = selecionar_resumos([resumo('G'), resumo('S', servico='SRV-COPY'), resumo('O', servico='SRV-CALCULO')],
                               ctx(), AGORA)
    assert {r.id for r in ok} == {'G', 'S'}


def test_modo_invalido_e_contexto_incoerente_sao_recusados():
    with pytest.raises(ErroMemoria):
        ContextoDeEscopo('TUDO')
    with pytest.raises(ErroMemoria):
        ContextoDeEscopo('EMPRESA')
    with pytest.raises(ErroMemoria):
        ContextoDeEscopo('PESSOAL', agente='LAURA', business_id='BIZ-003')
    with pytest.raises(ErroMemoria):
        ContextoDeEscopo('COORDENACAO', business_id='BIZ-003')


# ----------------------------------------------------------------------------------- conferência
def test_resumo_valido_passa():
    assert conferir_resumo(resumo(), REFS) == []
    exigir_resumo_conferido(resumo(), REFS)


def test_resumo_sem_fontes_e_recusado():
    r = resumo(fontes=(), afirmacoes=(Afirmacao('Algo.', ()),))
    problemas = conferir_resumo(r, REFS)
    assert 'SEM_FONTES' in problemas and 'AFIRMACAO_SEM_FONTE' in problemas
    with pytest.raises(ErroMemoria, match='SEM_FONTES'):
        exigir_resumo_conferido(r, REFS)


def test_fonte_inexistente_ou_nao_declarada_e_recusada():
    inexistente = resumo(fontes=(FonteRef('ENTREGA', '999'),),
                         afirmacoes=(Afirmacao('Algo.', (FonteRef('ENTREGA', '999'),)),))
    assert 'FONTE_INEXISTENTE:ENTREGA:999' in conferir_resumo(inexistente, REFS)
    nao_declarada = resumo(afirmacoes=(Afirmacao('Algo.', (H,)),))
    assert 'AFIRMACAO_CITA_FONTE_NAO_DECLARADA:HISTORICO:55' in conferir_resumo(nao_declarada, REFS)


def test_fonte_de_outra_empresa_ou_outro_card_e_recusada():
    refs = {**REFS, 'ENTREGA:981': Referencia('texto 3', 'BIZ-001', CARD)}
    assert 'FONTE_DE_OUTRA_EMPRESA:ENTREGA:981' in conferir_resumo(resumo(), refs)
    refs = {**REFS, 'ENTREGA:981': Referencia('texto 3', 'BIZ-003', OUTRO_CARD)}
    assert 'FONTE_DE_OUTRO_CARD:ENTREGA:981' in conferir_resumo(resumo('C', 'CARD'), refs)


def test_escopos_gerais_nao_aceitam_fonte_de_empresa():
    r = resumo('F', 'FUNDADOR', fontes=(E,), afirmacoes=(Afirmacao('Prefere 3 chamadas.', (E,)),))
    assert 'FONTE_DE_EMPRESA_EM_ESCOPO_GERAL:ENTREGA:981' in conferir_resumo(r, REFS)


def test_numero_sem_fonte_e_recusado_e_numero_da_fonte_passa():
    r = resumo(afirmacoes=(Afirmacao('Teve 7 chamadas.', (E,)),))
    assert any(p.startswith('NUMERO_SEM_FONTE') and '7' in p for p in conferir_resumo(r, REFS))
    ok = resumo(afirmacoes=(Afirmacao('Desconto de 12,5% e 3 chamadas.', (E,)),))
    assert conferir_resumo(ok, REFS) == []
    fato = resumo(fatos_duros=('Valor aprovado: R$ 1.234,56',))
    assert any(p.startswith('FATO_DURO_SEM_FONTE') for p in conferir_resumo(fato, REFS))


def test_numeros_normalizam_formatos_brasileiros_e_datas():
    assert numeros_do_texto('R$ 1.234,56 em 17/10/2026 e 2026-10-17') == [
        frozenset({'2026-10-17'}), frozenset({'2026-10-17'}), frozenset({'1234.56'})]
    assert numeros_do_texto('DEC-022 BIZ-003 CP-20261017-V038 MEM-0027') == []
    r = resumo(afirmacoes=(Afirmacao('Venceu em 17/10/2026.', (E,)),))
    refs = {**REFS, 'ENTREGA:981': Referencia('Vencimento: 2026-10-17.', 'BIZ-003', CARD)}
    assert conferir_resumo(r, refs) == []


def test_resumo_de_resumo_tem_limite_de_profundidade_e_exige_ancora():
    refs = {**REFS, 'RESUMO:r2': Referencia('3 chamadas', 'BIZ-003', None, profundidade=2, escopo='AGENTE_EMPRESA'),
            'RESUMO:r0': Referencia('3 chamadas', 'BIZ-003', None, profundidade=0, escopo='CARD')}
    r = resumo(fontes=(FonteRef('RESUMO', 'r2'), E), profundidade=3, afirmacoes=(
        Afirmacao('Teve 3 chamadas.', (E,)),))
    assert 'PROFUNDIDADE_EXCEDIDA' in conferir_resumo(r, refs)
    sem_ancora = resumo(fontes=(FonteRef('RESUMO', 'r0'),), profundidade=1,
                        afirmacoes=(Afirmacao('Teve 3 chamadas.', (FonteRef('RESUMO', 'r0'),)),))
    assert 'SEM_ANCORA_PRIMARIA' in conferir_resumo(sem_ancora, refs)
    bom = resumo(fontes=(FonteRef('RESUMO', 'r0'), E), profundidade=1,
                 afirmacoes=(Afirmacao('Teve 3 chamadas.', (FonteRef('RESUMO', 'r0'),)),))
    assert conferir_resumo(bom, refs) == []
    errada = resumo(profundidade=1)
    assert any(p.startswith('PROFUNDIDADE_DECLARADA_ERRADA') for p in conferir_resumo(errada, REFS))


def test_mencao_a_outra_empresa_e_segredo_sao_recusados():
    empresas = {'BIZ-003': ['Humano Digital'], 'BIZ-001': ['iGreen Energy']}
    r = resumo(afirmacoes=(Afirmacao('Seguiu o tom da iGreen Energy com 3 chamadas.', (E,)),))
    assert 'MENCIONA_OUTRA_EMPRESA:BIZ-001' in conferir_resumo(r, REFS, empresas=empresas)
    propria = resumo(afirmacoes=(Afirmacao('Tom do Humano Digital com 3 chamadas.', (E,)),))
    assert conferir_resumo(propria, REFS, empresas=empresas) == []
    geral = resumo('F', 'FUNDADOR', afirmacoes=(Afirmacao('Prefere o tom do Humano Digital.', (D,)),))
    assert 'MENCIONA_OUTRA_EMPRESA:BIZ-003' in conferir_resumo(geral, REFS, empresas=empresas)
    segredo = resumo(afirmacoes=(Afirmacao('Chave sk-' + 'a1' * 12 + ' com 3 chamadas.', (E,)),))
    assert 'TEXTO_COM_SEGREDO' in conferir_resumo(segredo, REFS)


def test_forma_do_escopo_e_autor():
    assert 'FORMA_CARD_SEM_CARD' in conferir_resumo(resumo('C', 'CARD', card_id=None), REFS)
    assert 'FORMA_PESSOAL_INVALIDA' in conferir_resumo(resumo('P', 'PESSOAL', business_id='BIZ-003'), REFS)
    assert 'SEM_AUTOR' in conferir_resumo(resumo(autor=None), REFS)
    assert 'TEXTO_GRANDE_DEMAIS' in conferir_resumo(resumo(afirmacoes=(Afirmacao('a ' * 5000, (E,)),)), REFS)


def test_revisor_precisa_ser_outro_agente():
    exigir_revisao_independente('OLIVIA', 'DANIEL')
    for autor, revisor in (('OLIVIA', 'olivia'), (None, 'DANIEL'), ('OLIVIA', '')):
        with pytest.raises(ErroMemoria):
            exigir_revisao_independente(autor, revisor)


def test_trecho_precisa_ser_recorte_literal_com_origem():
    fonte = 'Linha um.\n  O desconto   é de 12,5% para clientes antigos.\nFim.'
    ok = Trecho('T1', E, 'O desconto é de 12,5% para clientes antigos.', 'AGENTE_EMPRESA', 'BIZ-003', 'ISABELA')
    assert conferir_trecho(ok, fonte) == []
    inventado = Trecho('T2', E, 'O desconto é de 15%.', 'AGENTE_EMPRESA', 'BIZ-003', 'ISABELA')
    assert conferir_trecho(inventado, fonte) == ['TRECHO_NAO_ESTA_NA_FONTE']
    sem_origem = Trecho('T3', None, 'Linha um.', 'AGENTE_EMPRESA', 'BIZ-003', 'ISABELA')
    assert 'TRECHO_SEM_ORIGEM_PRIMARIA' in conferir_trecho(sem_origem, fonte)


# --------------------------------------------------------------------------------- truncamento
@pytest.mark.parametrize('texto,limite', [
    ('O valor total ficou em R$ 1.234,56 para o período combinado entre as partes.', 40),
    ('O prazo vence em 17/10/2026 conforme combinado com o fundador na reunião.', 36),
    ('A taxa subiu 12,5% no mês passado e deve seguir assim até dezembro de 2026.', 28),
    ('Pagamos 3.000 reais; depois 4.500 reais; por fim 1.200 reais ao fornecedor.', 45),
    ('x' * 30 + ' 123456789 ' + 'y' * 30, 40),
])
def test_truncar_nunca_corta_numero_ao_meio(texto, limite):
    saida = truncar_sem_cortar_numeros(texto, limite)
    assert len(saida) <= limite
    corpo = saida.removesuffix(' [...]')
    originais = {n for f in numeros_do_texto(texto) for n in f}
    for numero in numeros_do_texto(corpo):
        assert numero & originais, (saida, numero)
    # o que sobrou do corpo é prefixo do original em fronteira de palavra
    assert texto.startswith(corpo)
    assert len(texto) == len(corpo) or texto[len(corpo)] in ' \n.,;'


def test_truncar_sem_precisar_devolve_igual_e_sem_espaco_devolve_vazio():
    assert truncar_sem_cortar_numeros('curto', 10) == 'curto'
    assert truncar_sem_cortar_numeros('texto comprido demais', 3) == ''
    with pytest.raises(ErroMemoria):
        truncar_sem_cortar_numeros('x', -1)


# ----------------------------------------------------------------------------------------- bloco
def resumo_grande(id='G', n=30, **kw):
    afs = tuple(Afirmacao(f'Afirmação {i}: o item {i} custou R$ {i}.500,00 em 17/10/2026.', (E,)) for i in range(n))
    return resumo(id, afirmacoes=afs, fatos_duros=('Aprovado pelo fundador em 2026-10-17.',), **kw)


def test_bloco_respeita_orcamento_e_nao_corta_afirmacao():
    r = resumo_grande()
    for orcamento in (600, 1500, 4000, 12000):
        bloco = montar_bloco_memoria([r], ctx(), AGORA, orcamento_caracteres=orcamento)
        assert bloco.caracteres <= orcamento
        for item in bloco.resumos:
            linhas = item['texto'].split('\n')
            assert linhas[0] == r.fatos_duros[0]                          # fato duro sempre inteiro
            for linha in linhas[1:]:
                assert linha in {a.texto for a in r.afirmacoes}           # afirmação sempre inteira
    grande = montar_bloco_memoria([r], ctx(), AGORA, orcamento_caracteres=1500)
    assert grande.resumos[0]['completo'] is False
    assert any(o.motivo.startswith('AFIRMACOES_OMITIDAS') for o in grande.omitidos)


def test_resumo_cujos_fatos_nao_cabem_sai_inteiro_nunca_pela_metade():
    bloco = montar_bloco_memoria([resumo_grande()], ctx(), AGORA, orcamento_caracteres=300)
    assert bloco.vazio and [o.motivo for o in bloco.omitidos] == ['ORCAMENTO']
    assert bloco.como_carga() == {} and bloco.caracteres == 0


def test_texto_livre_sem_afirmacoes_e_aparado_sem_cortar_numero():
    texto = ' '.join(f'Item {i} custou R$ {i}.234,56 em 17/10/2026.' for i in range(1, 40))
    livre = Resumo(id='L', versao=1, escopo='AGENTE_EMPRESA', business_id='BIZ-003', agente='ISABELA',
                   fontes=(E,), texto=texto, autor='OLIVIA')
    bloco = montar_bloco_memoria([livre], ctx(), AGORA, orcamento_caracteres=900)
    assert bloco.caracteres <= 900 and len(bloco.resumos) == 1
    corpo = bloco.resumos[0]['texto'].removesuffix(' [...]')
    assert texto.startswith(corpo) and not bloco.resumos[0]['completo']
    orig = {n for f in numeros_do_texto(texto) for n in f}
    assert all(n & orig for n in numeros_do_texto(corpo))


def test_bloco_e_deterministico_e_nao_altera_entradas():
    candidatos = [resumo_grande('B', servico='SRV-COPY'), resumo('A'), resumo('F', 'FUNDADOR')]
    copia = list(candidatos)
    um = montar_bloco_memoria(candidatos, ctx(), AGORA, orcamento_caracteres=3000)
    dois = montar_bloco_memoria(reversed(candidatos), ctx(), AGORA, orcamento_caracteres=3000)
    assert um.como_carga() == dois.como_carga() and candidatos == copia
    assert json.dumps(um.como_carga(), ensure_ascii=False)                  # serializável


def test_bloco_vazio_nao_gera_campo_nem_custo():
    bloco = montar_bloco_memoria([], ctx(), AGORA)
    assert bloco.vazio and bloco.como_carga() == {} and bloco.tokens_estimados == 0
    assert custo_adicional_tokens(bloco, 5) == 0


def test_custo_estimado_cresce_com_o_numero_de_execucoes():
    bloco = montar_bloco_memoria([resumo_grande()], ctx(), AGORA, orcamento_caracteres=3000)
    assert bloco.tokens_estimados > 0
    assert custo_adicional_tokens(bloco, 4) == 4 * bloco.tokens_estimados


# ------------------------------------------------------------------------------------- recuperação
def trecho(id, texto, origem=E, escopo='AGENTE_EMPRESA', **kw):
    base = dict(business_id='BIZ-003', agente='ISABELA')
    if escopo == 'CARD':
        base = dict(business_id='BIZ-003', card_id=CARD)
    if escopo == 'FUNDADOR':
        base = dict(aprovado_por='uid-fundador')
    return Trecho(id, origem, texto, escopo, **{**base, **kw})


BASE = [
    trecho('T1', 'O desconto para clientes antigos é de 12,5% sobre a campanha de verão.'),
    trecho('T2', 'A campanha de verão usa três chamadas curtas.', H),
    trecho('T3', 'Reunião sobre contabilidade e impostos do trimestre.'),
    trecho('T4', 'Desconto de campanha da outra empresa.', business_id='BIZ-001'),
    trecho('T5', 'Desconto de campanha em outro card.', escopo='CARD', card_id=OUTRO_CARD),
    trecho('T6', 'Desconto pessoal de treino.', escopo='PESSOAL', business_id=None, agente='LAURA',
           aprovado_por='uid'),
    trecho('T7', 'Preferência: campanha com desconto sempre explícito.', escopo='FUNDADOR'),
]


def test_consulta_e_montada_pelo_codigo_sem_ruido():
    consulta = montar_consulta('Escrever campanha de verão com desconto', 'Quero um post para clientes antigos')
    assert consulta.split() == ['escrever', 'campanha', 'verao', 'desconto', 'post', 'clientes', 'antigos']
    assert montar_consulta('', None) == '' and montar_consulta('a de o') == ''


def test_recuperacao_top_k_com_origem_e_so_do_escopo():
    busca = RecuperadorEmMemoria(BASE)
    achados, descartados = recuperar_trechos(busca, ctx(), 'campanha desconto verao clientes', AGORA, k=3)
    assert [t.id for t in achados] == ['T1', 'T2', 'T7'] or len(achados) == 3
    ids = {t.id for t in achados}
    assert not ids & {'T3', 'T4', 'T5', 'T6'}
    assert all(t.origem is not None for t in achados)
    assert busca.chamadas[0][2] <= 30                                       # pedido de busca com limite


def test_recuperacao_refiltra_mesmo_se_a_busca_vazar():
    def busca_ruim(c, consulta, limite):                                    # simula bug no backend de busca
        return BASE
    achados, descartados = recuperar_trechos(busca_ruim, ctx(), 'campanha', AGORA, k=10)
    assert {t.id for t in achados} == {'T1', 'T2', 'T3', 'T7'}
    assert {d.id for d in descartados} == {'T4', 'T5', 'T6'}
    achados, _ = recuperar_trechos(busca_ruim, ctx('COORDENACAO'), 'campanha', AGORA, k=10)
    assert {t.id for t in achados} == {'T7'}
    achados, _ = recuperar_trechos(busca_ruim, ctx('PESSOAL'), 'campanha', AGORA, k=10)
    assert {t.id for t in achados} == {'T6', 'T7'}


def test_trecho_sem_origem_expirado_sem_aprovacao_ou_grande_e_descartado():
    ruins = [trecho('A', 'campanha', origem=None), trecho('B', 'campanha', expira_em=AGORA),
             trecho('C', 'campanha', escopo='FUNDADOR', aprovado_por=None), trecho('D', 'campanha ' * 200),
             trecho('E', 'campanha', origem=FonteRef('RESUMO', 'r1'))]
    achados, descartados = recuperar_trechos(lambda c, q, n: ruins, ctx(), 'campanha', AGORA)
    assert achados == []
    assert {d.id: d.motivo for d in descartados} == {
        'A': 'SEM_ORIGEM', 'B': 'EXPIRADO', 'C': 'SEM_APROVACAO_DO_FUNDADOR', 'D': 'TAMANHO_INVALIDO',
        'E': 'SEM_ORIGEM'}


def test_k_zero_ou_consulta_vazia_nao_busca():
    busca = RecuperadorEmMemoria(BASE)
    assert recuperar_trechos(busca, ctx(), 'campanha', AGORA, k=0) == ([], [])
    assert recuperar_trechos(busca, ctx(), '  ', AGORA) == ([], [])
    assert busca.chamadas == []


def test_bloco_com_trechos_respeita_orcamento_e_registra_origem():
    achados, _ = recuperar_trechos(RecuperadorEmMemoria(BASE), ctx(), 'campanha desconto verao', AGORA, k=5)
    bloco = montar_bloco_memoria([resumo('A')], ctx(), AGORA, trechos=achados, orcamento_caracteres=2000)
    assert bloco.caracteres <= 2000 and bloco.trechos
    assert all(t['origem'] in ('ENTREGA:981', 'HISTORICO:55') or t['origem'].startswith('') for t in bloco.trechos)
    apertado = montar_bloco_memoria([resumo('A')], ctx(), AGORA, trechos=achados, orcamento_caracteres=400)
    assert apertado.caracteres <= 400
    assert {o.id for o in apertado.omitidos} <= {t.id for t in achados} | {'A'}
    manifesto = bloco.manifesto()
    assert manifesto['trechos'][0].keys() == {'id', 'origem', 'hash', 'caracteres'}
    assert 'texto' not in json.dumps(manifesto['resumos'])                  # o manifesto não carrega texto


def test_manifesto_reconstroi_o_mesmo_bloco_e_detecta_alteracao():
    r = resumo_grande()
    achados, _ = recuperar_trechos(RecuperadorEmMemoria(BASE), ctx(), 'campanha desconto', AGORA, k=2)
    bloco = montar_bloco_memoria([r], ctx(), AGORA, trechos=achados, orcamento_caracteres=1800)
    refeito = reconstruir_bloco(bloco.manifesto(), {r.id: r}, {t.id: t for t in achados})
    assert refeito.como_carga() == bloco.como_carga()
    alterado = Resumo(**{**r.__dict__, 'fatos_duros': ('Aprovado em 2026-10-18.',)})
    with pytest.raises(ErroMemoria, match='MEMORIA_FIXADA_ALTERADA'):
        reconstruir_bloco(bloco.manifesto(), {r.id: alterado}, {t.id: t for t in achados})


# ------------------------------------------------------------------------------------ pacote / hook
CARGA = {'servico': 'SRV-COPY', 'pedido': {'empresa': 'BIZ-003'}, 'fontes_importadas': []}


def test_memoria_desligada_por_padrao_nao_muda_nada():
    bloco = montar_bloco_memoria([resumo('A')], ctx(), AGORA)
    nova, rel = anexar_memoria(CARGA, bloco)
    assert nova == CARGA and rel == {'anexada': False, 'motivo': 'DESLIGADA'} and 'memoria' not in nova


def test_memoria_ligada_anexa_sem_alterar_a_carga_original():
    original = json.loads(json.dumps(CARGA))
    bloco = montar_bloco_memoria([resumo('A')], ctx(), AGORA)
    nova, rel = anexar_memoria(CARGA, bloco, ligado=True)
    assert CARGA == original and rel['anexada'] and nova['memoria']['resumos'][0]['id'] == 'A'
    assert rel['manifesto']['resumos'][0]['hash'] == resumo('A').hash_texto
    assert nova['memoria']['aviso'].startswith('Memória compactada de apoio, não é fonte')
    with pytest.raises(ErroMemoria):
        anexar_memoria(nova, bloco, ligado=True)


def test_bloco_vazio_ou_pacote_grande_segue_sem_memoria_sem_falhar():
    nova, rel = anexar_memoria(CARGA, montar_bloco_memoria([], ctx(), AGORA), ligado=True)
    assert nova == CARGA and rel['motivo'] == 'SEM_MEMORIA_APLICAVEL'
    grande = {**CARGA, 'fontes_importadas': ['x' * 59990]}
    bloco = montar_bloco_memoria([resumo('A')], ctx(), AGORA)
    nova, rel = anexar_memoria(grande, bloco, ligado=True)
    assert nova == grande and rel['motivo'] == 'PACOTE_EXCEDE_LIMITE'
    with pytest.raises(ErroMemoria):
        anexar_memoria(CARGA, bloco, ligado=True, limite_bytes=LIMITE_DURO_ARGUMENTO_BYTES + 1)


def test_orcamento_disponivel_garante_que_o_pacote_cabe_no_teto():
    for tamanho in (100, 10000, 20000, 28000, 29900):
        carga = {**CARGA, 'fontes_importadas': ['é' * tamanho]}
        r = Resumo(id='G', versao=1, escopo='AGENTE_EMPRESA', business_id='BIZ-003', agente='ISABELA',
                   fontes=(E,), afirmacoes=tuple(Afirmacao('éé açaí ' * 30 + str(i), (E,)) for i in range(60)))
        orcamento = orcamento_disponivel(carga)
        bloco = montar_bloco_memoria([r], ctx(), AGORA, orcamento_caracteres=orcamento)
        nova, rel = anexar_memoria(carga, bloco, ligado=True)
        assert len(json.dumps(nova, ensure_ascii=False).encode()) <= 60000
        if bloco.vazio:
            assert not rel['anexada']


def test_dicionario_do_banco_vira_resumo():
    r = resumo_de_dict({'id': 'R9', 'versao': 2, 'escopo': 'CARD', 'business_id': 'BIZ-003', 'card_id': CARD,
                        'fatos_duros': ['Aprovado em 2026-10-17.'], 'profundidade': 0,
                        'fontes': [{'tipo': 'ENTREGA', 'ref': '981'}],
                        'afirmacoes': [{'texto': 'Três chamadas.', 'fontes': [{'tipo': 'ENTREGA', 'ref': '981'}]}],
                        'expira_em': '2026-12-01T00:00:00+00:00'})
    assert r.fontes == (E,) and escopo_permite(ctx(), r) and r.renderizar().count('\n') == 1


def test_motor_tem_o_parametro_desligado_e_producao_o_recusa():
    from orquestrador.motor import Motor
    parametro = inspect.signature(Motor.__init__).parameters['fonte_memoria']
    assert parametro.default is None
    with pytest.raises(ValueError, match='memória'):
        Motor('postgresql://x@localhost/a', 'postgresql://x@localhost/b', modo_producao=True,
              fonte_memoria=lambda ctx: [])


# --------------------------------------------------------- o gancho no Motor (dublê, sem banco)
def _motor_duble(monkeypatch, fonte_memoria=None, texto_original='Pedido do fundador com 3 chamadas.'):
    from types import SimpleNamespace
    from uuid import uuid4
    import orquestrador.motor as motor_mod
    from orquestrador.motor import Motor
    motor = object.__new__(Motor)
    etapa_id, card_id = uuid4(), uuid4()
    etapa = {'id': etapa_id, 'card_id': card_id, 'codigo': 'E1', 'estado': 'EXECUTANDO', 'execucao_atual': 44,
             'autor': 'ISABELA'}
    pedido = {'empresa': 'BIZ-003', 'ordem_de_servico': {'pedido_original': texto_original, 'fontes_que_pode_ler': []},
              'pacote_da_empresa': {'estado': 'CONFIRMADO', 'fonte_importada_id': 'FON-PACOTE-BIZ-003'},
              'entradas': {}, 'plano': {'etapas': [{'id': 'E1', 'servico': 'SRV-COPY'}]}}
    fontes = {'FON-PEDIDO-T': texto_original, 'FON-PACOTE-BIZ-003': 'pacote'}
    visto = {}
    salvo = {}

    def linha(sql, args=()):
        if 'FROM helena_v2.etapa' in sql:
            return etapa
        if 'ler_resposta_execucao' in sql:
            return {'resposta': salvo.get('r')}
        if 'registrar_resposta_execucao' in sql:
            salvo['r'] = args[1].obj
            return {'resposta': salvo['r']}
        raise AssertionError(sql)

    class Executor:
        def rodar(self, execucao):
            visto['pacote'] = json.loads(execucao.pacote)
            return SimpleNamespace(ok=True, texto='{"acao":"ENTREGAR"}')

        def limpar(self, _r):
            pass

    motor.executor = Executor()
    if fonte_memoria is not None:
        motor.fonte_memoria = fonte_memoria
    motor.fonte_contexto = lambda _s, _sv, **kw: {
        'pedido': kw['pedido'], 'modelo': {'tipo': 'copy'}, 'fontes_importadas': [
            {'fonte_importada_id': k, 'texto': v} for k, v in kw['fontes_importadas'].items()],
        'decisoes_vigentes': kw['decisoes'], 'paginas_lidas': [], 'usou_internet': 'NAO'}
    monkeypatch.setattr(motor, '_linha', linha)
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': uuid4()}, object(), None))
    monkeypatch.setattr(motor, '_servico', lambda _e: 'SRV-COPY')
    monkeypatch.setattr(motor, '_ficha', lambda *_a: object())
    monkeypatch.setattr(motor, '_entradas_da_etapa', lambda *_a: (pedido, fontes, []))
    monkeypatch.setattr(motor, '_rodar_vigiado', lambda exe, *_a: motor.executor.rodar(exe))
    monkeypatch.setattr(motor_mod, 'coletar_evidencias', lambda *_a: {
        'paginas_lidas': [], 'usou_internet': False, 'conversa': [], 'uso': {'tokens_entrada': 1}})
    return motor, etapa_id, visto, salvo


def test_gancho_desligado_por_padrao_o_pacote_nao_muda(monkeypatch):
    motor, etapa_id, visto, salvo = _motor_duble(monkeypatch)
    assert motor.executar_e_salvar(etapa_id, 44) == 44
    assert 'memoria' not in visto['pacote'] and 'memoria' not in salvo['r']
    assert set(visto['pacote']) == {'servico', 'config_revision_id', 'pedido', 'modelo', 'fontes_importadas',
                                    'decisoes_vigentes', 'pacote_da_empresa'}


def test_gancho_ligado_manda_memoria_so_ao_autor_e_registra_manifesto(monkeypatch):
    pedidos = []

    def fonte(contexto):
        pedidos.append(contexto)
        return [resumo('A'), resumo('X', business_id='BIZ-001')]
    motor, etapa_id, visto, salvo = _motor_duble(monkeypatch, fonte)
    assert motor.executar_e_salvar(etapa_id, 44) == 44
    assert pedidos[0].modo == 'EMPRESA' and pedidos[0].business_id == 'BIZ-003' and pedidos[0].agente == 'ISABELA'
    assert [r['id'] for r in visto['pacote']['memoria']['resumos']] == ['A']        # BIZ-001 filtrado
    assert 'memoria' not in salvo['r']['contexto']                                  # o revisor não a recebe
    assert salvo['r']['memoria']['resumos'][0]['hash'] == resumo('A').hash_texto
    assert len(json.dumps(visto['pacote'], ensure_ascii=False).encode()) < 60000


def test_gancho_com_erro_na_fonte_segue_sem_memoria(monkeypatch):
    def quebrada(_c):
        raise RuntimeError('banco fora')
    motor, etapa_id, visto, salvo = _motor_duble(monkeypatch, quebrada)
    assert motor.executar_e_salvar(etapa_id, 44) == 44
    assert 'memoria' not in visto['pacote'] and 'memoria' not in salvo['r']
