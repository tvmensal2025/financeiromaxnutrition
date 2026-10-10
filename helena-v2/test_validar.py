"""Garante que o validador realmente barra os furos (mutacoes das especificacoes reais)."""
import copy
import unittest

import validar as v


def base():
    erros = []
    dados = v.carregar(erros)
    assert not erros, erros
    return copy.deepcopy(dados)


def rodar(agentes, entregas, modelos, roteiros):
    erros = []
    v.validar_agentes(agentes, entregas, modelos, erros)
    v.validar_roteiros(agentes, entregas, roteiros, erros)
    return erros


class ValidadorTest(unittest.TestCase):
    def test_especificacoes_reais_passam(self):
        self.assertEqual(rodar(*base()), [])

    def test_revisor_que_julga_depois_e_barrado(self):
        ag, en, mo, ro = base()
        ag['AGT-17']['revisor'] = 'AGT-06'
        ag['AGT-06']['revisa'] = ['dossie', 'copy', 'roteiro_treinamento']
        self.assertTrue(any('julga' in e for e in rodar(ag, en, mo, ro)))

    def test_orcamento_impossivel_e_barrado(self):
        ag, en, mo, ro = base()
        ag['AGT-11']['orcamento']['passos'] = 10
        self.assertTrue(any('impossivel' in e for e in rodar(ag, en, mo, ro)))

    def test_parecer_sem_caminho_de_ajuste_e_barrado(self):
        ag, en, mo, ro = base()
        etapa = next(e for e in ro['recrutar-10-pessoas.yaml']['etapas'] if e['id'] == 'E4')
        del etapa['se_semaforo']['AJUSTE']
        self.assertTrue(any('semaforo AJUSTE' in e for e in rodar(ag, en, mo, ro)))

    def test_destino_inexistente_e_barrado(self):
        ag, en, mo, ro = base()
        ro['recrutar-10-pessoas.yaml']['etapas'][0]['responsavel'] = 'AGT-99'
        self.assertTrue(any('nao existe' in e for e in rodar(ag, en, mo, ro)))

    def test_ciclo_e_barrado(self):
        ag, en, mo, ro = base()
        ro['recrutar-10-pessoas.yaml']['etapas'][0]['depende_de'] = ['E5']
        self.assertTrue(any('ciclo' in e for e in rodar(ag, en, mo, ro)))

    def test_web_com_efeito_colateral_e_barrado(self):
        ag, en, mo, ro = base()
        ag['AGT-11']['ferramentas'] = ['web_search', 'registrar_lancamento']
        self.assertTrue(any('efeito colateral' in e for e in rodar(ag, en, mo, ro)))

    def test_modelo_sem_apelido_e_barrado(self):
        ag, en, mo, ro = base()
        ag['AGT-05']['modelo'] = 'gpt-qualquer'
        self.assertTrue(any('apelido' in e for e in rodar(ag, en, mo, ro)))

    def test_entrada_sem_dependencia_e_barrada(self):
        ag, en, mo, ro = base()
        etapa = next(e for e in ro['recrutar-10-pessoas.yaml']['etapas'] if e['id'] == 'E3')
        etapa['depende_de'] = []
        self.assertTrue(any('sem depender' in e for e in rodar(ag, en, mo, ro)))


if __name__ == '__main__':
    unittest.main()
