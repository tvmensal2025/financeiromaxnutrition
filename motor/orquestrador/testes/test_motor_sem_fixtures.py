"""O caminho real do motor nunca alcança os dados de teste (fixtures, casos sintéticos, respostas roteirizadas).

Sem PostgreSQL: estes testes leem o código do motor e exercitam só as guardas.
Se um dia alguém ligar o corpus sintético a outro lugar do motor, o primeiro teste quebra e mostra onde.
"""
import ast
from pathlib import Path

import pytest

import orquestrador.motor as motor_mod
from orquestrador.motor import Motor

PACOTE = Path(motor_mod.__file__).parent

# Quem pode chamar o corpus sintético, e por quê (cada um tem guarda própria, testada abaixo).
CHAMADORES_PERMITIDOS = {
    'listar_casos': {'_caso'},                    # escolhe o caso sintético; recusa sem opt-in
    'montar_resposta': {'_texto_roteirizado'},    # texto do executor falso; só o executor falso o usa
    'montar_contexto': {'executar_e_salvar'},     # só no ramo não-real, depois de _caso
    'Spec': {'__init__'},                         # só dentro de `if permitir_casos_sinteticos` (copia as fixtures)
}


def _chamadas_por_funcao(caminho: Path, nomes):
    arvore = ast.parse(caminho.read_text(encoding='utf-8'))
    achados = {}
    for funcao in ast.walk(arvore):
        if isinstance(funcao, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for no in ast.walk(funcao):
                if isinstance(no, ast.Call) and isinstance(no.func, ast.Name) and no.func.id in nomes:
                    achados.setdefault(no.func.id, set()).add(funcao.name)
    return achados


def test_so_os_chamadores_conhecidos_alcancam_o_corpus_sintetico():
    assert _chamadas_por_funcao(PACOTE / 'motor.py', set(CHAMADORES_PERMITIDOS)) == CHAMADORES_PERMITIDOS


def _funcoes_com_a_palavra_casos(caminho: Path):
    arvore = ast.parse(caminho.read_text(encoding='utf-8'))
    achadas = set()
    for funcao in ast.walk(arvore):
        if isinstance(funcao, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if any(isinstance(no, ast.Constant) and no.value == 'casos' for no in ast.walk(funcao)):
                achadas.add(funcao.name)
    return achadas


# A pasta helena-v2/casos (os exemplos da especificação) só é lida em dois lugares:
#  - Motor.__init__, dentro de `if permitir_casos_sinteticos` (harness de teste);
#  - validar_bundle, que copia a especificação para uma pasta temporária e roda o conferente (validação de
#    configuração, não execução de card). Nenhum outro ponto do pacote pode tocar nela.
PODEM_LER_A_PASTA_CASOS = {'motor.py': {'__init__'}, 'configuracao.py': {'validar_bundle'}}


@pytest.mark.parametrize('modulo', sorted(p.name for p in PACOTE.glob('*.py') if p.name not in {'placar_revisor.py'}))
def test_a_pasta_de_casos_so_e_lida_onde_se_espera(modulo):
    assert _funcoes_com_a_palavra_casos(PACOTE / modulo) == PODEM_LER_A_PASTA_CASOS.get(modulo, set())


# Módulos que SÃO harness de teste (leem os exemplos da especificação de propósito) e que nenhum módulo do motor importa.
HARNESS_DE_TESTE = {'placar_revisor.py'}


def test_nenhum_modulo_do_motor_importa_o_harness_de_teste():
    for modulo in PACOTE.glob('*.py'):
        if modulo.name in HARNESS_DE_TESTE:
            continue
        fonte = modulo.read_text(encoding='utf-8')
        for harness in HARNESS_DE_TESTE:
            assert harness.removesuffix('.py') not in fonte, f'{modulo.name} importa o harness {harness}'


@pytest.mark.parametrize('modulo', sorted(p.name for p in PACOTE.glob('*.py')
                                          if p.name != 'motor.py' and p.name not in HARNESS_DE_TESTE))
def test_nenhum_outro_modulo_do_orquestrador_importa_o_corpus_sintetico(modulo):
    fonte = (PACOTE / modulo).read_text(encoding='utf-8')
    for proibido in ('listar_casos', 'montar_resposta', 'montar_contexto(', 'spec_helena.casos'):
        assert proibido not in fonte, f'{modulo} menciona {proibido!r}'


def test_o_corpus_sintetico_so_e_copiado_com_opt_in():
    codigo = (PACOTE / 'motor.py').read_text(encoding='utf-8')
    trecho = codigo[codigo.index("if permitir_casos_sinteticos:"):]
    assert "shutil.copytree(RAIZ / 'helena-v2' / 'casos'" in trecho.split('self._fixture_spec')[0]


def _motor_de_producao(monkeypatch):
    motor = object.__new__(Motor)
    motor.modo_producao = True
    motor.permitir_casos_sinteticos = False
    motor.casos = {}
    for nome in ('listar_casos', 'montar_resposta', 'montar_contexto'):
        monkeypatch.setattr(motor_mod, nome, lambda *_a, _n=nome, **_k: pytest.fail(f'{_n} chamado no motor de produção'))
    return motor


def test_caso_sintetico_e_recusado_sem_ler_fixture(monkeypatch):
    motor = _motor_de_producao(monkeypatch)
    with pytest.raises(RuntimeError, match='corpus sintético exige opt-in'):
        motor._caso('SRV-COPY', spec=None)


def test_criar_card_de_teste_e_recusado_antes_de_qualquer_sql(monkeypatch):
    motor = _motor_de_producao(monkeypatch)
    monkeypatch.setattr(motor, '_con', lambda *_a, **_k: pytest.fail('abriu conexão'))
    with pytest.raises(RuntimeError, match='adaptador de contexto real'):
        motor.criar_card({'etapas': []}, 'numero')


def test_card_com_contexto_sintetico_nao_despacha_no_motor_de_producao(monkeypatch):
    motor = _motor_de_producao(monkeypatch)
    motor.fonte_contexto = None
    monkeypatch.setattr(motor, '_card', lambda _id: {'ordem_de_servico': {'modo_contexto': 'sintetico'}})
    with pytest.raises(RuntimeError, match='despacho exige adaptador de contexto real'):
        motor._modo_card('00000000-0000-4000-8000-000000000000')
    monkeypatch.setattr(motor, '_card', lambda _id: {'ordem_de_servico': {}})          # card sem modo declarado
    with pytest.raises(RuntimeError, match='despacho exige adaptador de contexto real'):
        motor._modo_card('00000000-0000-4000-8000-000000000000')


def test_card_real_sem_fonte_de_contexto_nao_despacha(monkeypatch):
    motor = _motor_de_producao(monkeypatch)
    motor.fonte_contexto = None
    monkeypatch.setattr(motor, '_card', lambda _id: {'ordem_de_servico': {'modo_contexto': 'real'}})
    with pytest.raises(RuntimeError, match='fonte de contexto e executor injetados'):
        motor._modo_card('00000000-0000-4000-8000-000000000000')
