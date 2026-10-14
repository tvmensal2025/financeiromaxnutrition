"""O registro dos executores aprovados: escolha por nome, falha fechada e contrato de cada adaptador."""

import dataclasses
import stat

import pytest

from executor_helena.runtime_alternativo import RuntimeAlternativoDeTeste
from executor_helena import registro
from executor_helena.executor import Executor, ExecutorHermes
from executor_helena.executor_falso import ExecutorFalso
from executor_helena.registro import Adaptador, ErroDeRegistro
from executor_helena.tipos import Capacidades


def test_o_registro_atual_cumpre_o_contrato():
    registro.conferir_registro()
    assert registro.nomes_aprovados() == ("hermes",)
    assert registro.classes_aprovadas() == (ExecutorHermes,)


def test_sem_variavel_o_padrao_e_o_hermes():
    assert registro.adaptador_configurado({}).nome == "hermes"
    assert registro.adaptador_configurado({registro.VARIAVEL_DO_EXECUTOR: "  HERMES "}).nome == "hermes"


@pytest.mark.parametrize("nome", ["eve", "openclaw", "falso", "processo-simples", "../hermes", "hermes;rm"])
def test_nome_fora_do_registro_e_recusado(nome):
    with pytest.raises(ErroDeRegistro, match="não está no registro aprovado"):
        registro.adaptador_configurado({registro.VARIAVEL_DO_EXECUTOR: nome})


def test_executor_falso_e_alternativo_nunca_estao_no_registro():
    assert ExecutorFalso not in registro.classes_aprovadas()
    assert RuntimeAlternativoDeTeste not in registro.classes_aprovadas()


def test_montar_exige_as_variaveis_do_adaptador():
    with pytest.raises(ErroDeRegistro, match="faltam variáveis de ambiente: HELENA_V2_HERMES_BIN, HELENA_V2_HERMES_HOME"):
        registro.montar_executor({"HELENA_V2_EXECUCOES_DIR": "/x"})


def test_montar_hermes_confere_o_executavel(tmp_path):
    ambiente = {"HELENA_V2_HERMES_BIN": "hermes", "HELENA_V2_HERMES_HOME": str(tmp_path / "h"),
                "HELENA_V2_EXECUCOES_DIR": str(tmp_path / "e")}
    with pytest.raises(ValueError, match="executável Hermes não está preparado"):          # caminho relativo
        registro.montar_executor(ambiente)
    binario = tmp_path / "hermes"
    binario.write_text("#!/bin/sh\nexit 0\n")
    ambiente["HELENA_V2_HERMES_BIN"] = str(binario)
    with pytest.raises(ValueError, match="não está preparado"):                          # sem permissão de execução
        registro.montar_executor(ambiente)
    binario.chmod(binario.stat().st_mode | stat.S_IXUSR)
    assert type(registro.montar_executor(ambiente)) is ExecutorHermes


def _adaptador(classe, nome="novo", variaveis=("NOVO_BIN",)):
    return Adaptador(nome=nome, classe=classe, variaveis=variaveis, montar=lambda ambiente: classe())


def _capacidades(**mudancas):
    return dataclasses.replace(ExecutorHermes.capacidades, **{"nome": "novo", **mudancas})


def _executor(capacidades, **metodos):
    corpo = {"capacidades": capacidades, "rodar": lambda s, e: None, "cancelar": lambda s, i: False,
             "limpar": lambda s, r: None}
    corpo.update(metodos)
    return type("Novo", (Executor,), corpo)


def test_adaptador_correto_passa():
    registro.conferir_registro((_adaptador(_executor(_capacidades())),))


@pytest.mark.parametrize("mudanca,faltando", [
    ({"cancela_em_ate_s": 60.0}, "cancela_em_ate_s"),
    ({"cancela_em_ate_s": 0}, "cancela_em_ate_s"),
    ({"ferramentas_por_extenso": False}, "ferramentas_por_extenso"),
    ({"confere_modelo_e_provedor": False}, "confere_modelo_e_provedor"),
    ({"sem_reserva_escondida": False}, "sem_reserva_escondida"),
    ({"limita_chamadas": False}, "limita_chamadas"),
    ({"falha_vem_do_registro": False}, "falha_vem_do_registro"),
    ({"guarda_conversa": False}, "guarda_conversa"),
    ({"nome": "Nome Ruim"}, "nome"),
])
def test_garantia_faltando_barra_o_adaptador(mudanca, faltando):
    classe = _executor(_capacidades(**mudanca))
    with pytest.raises(ErroDeRegistro, match=faltando):
        registro.conferir_registro((_adaptador(classe, nome=classe.capacidades.nome),))


def test_nome_declarado_diferente_do_registrado_barra():
    with pytest.raises(ErroDeRegistro, match="nome declarado"):
        registro.conferir_registro((_adaptador(_executor(_capacidades()), nome="outro"),))


def test_nome_repetido_barra():
    adaptador = _adaptador(_executor(_capacidades()))
    with pytest.raises(ErroDeRegistro, match="repetido"):
        registro.conferir_registro((adaptador, adaptador))


def test_variavel_com_valor_em_vez_de_nome_barra():
    with pytest.raises(ErroDeRegistro, match="NOMES em maiúsculas"):
        registro.conferir_registro((_adaptador(_executor(_capacidades()), variaveis=("CHAVE=abc123",)),))


def test_classe_que_nao_e_executor_barra():
    class Solta:
        capacidades = _capacidades()
    with pytest.raises(ErroDeRegistro, match="não é um Executor"):
        registro.conferir_registro((_adaptador(Solta),))


def test_capacidades_como_propriedade_barra():
    classe = type("Prop", (Executor,), {"capacidades": property(lambda s: _capacidades()), "rodar": lambda s, e: None,
                                         "cancelar": lambda s, i: False, "limpar": lambda s, r: None})
    with pytest.raises(ErroDeRegistro, match="atributo de classe"):
        registro.conferir_registro((_adaptador(classe),))


@pytest.mark.parametrize("faltando", ["rodar", "cancelar", "limpar", "capacidades"])
def test_executor_sem_metodo_do_contrato_nem_nasce(faltando):
    corpo = {"capacidades": _capacidades(), "rodar": lambda s, e: None, "cancelar": lambda s, i: False,
             "limpar": lambda s, r: None}
    corpo.pop(faltando)
    classe = type("Incompleto", (Executor,), corpo)
    with pytest.raises(TypeError):
        classe()


def test_o_runtime_alternativo_mora_no_pacote_mas_nunca_no_registro():
    import executor_helena.runtime_alternativo as modulo
    assert modulo.RuntimeAlternativoDeTeste.capacidades.nome not in registro.nomes_aprovados()
