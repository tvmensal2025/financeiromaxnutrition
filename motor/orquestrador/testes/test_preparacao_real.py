"""Capturas sintéticas restritas aos testes: nunca alimentam o produto."""
import copy
import hashlib
import json
import subprocess

import pytest

from orquestrador.preparacao import preparar_tarefa_real
from orquestrador.__main__ import _salvar_preparacao, main


def _captura():
    plano = {'id': 'teste', 'empresas': ['BIZ-003'], 'decisoes': ['DEC-024'],
             'entradas_externas': {'pesquisa': 'JOB-TESTE-1'}}
    captura = {'fonte': 'management_read_only',
               'projeto': {'ref': 'wxkgrykduqtsgmjkzlou'},
               'observado_em': '2026-10-13T12:00:00+00:00',
               'checkpoint': {'checkpoint_id': 'CP-TESTE'}, 'business_id': 'BIZ-003',
               'tarefa': {'task_id': 'TSK-TESTE', 'business_id': 'BIZ-003',
                          'tarefa': 'Pedido literal restrito ao teste.', 'prazo': None,
                          'status': 'NÃO INICIADA', 'row_version': 7,
                          'definicao_de_pronto': 'Critério literal da origem.'},
               'empresa': {'business_id': 'BIZ-003', 'ativo': 'SIM', 'negocio': 'Empresa de teste'},
               'decisoes': [{'decision_id': 'DEC-024', 'row_version': 8, 'decisao': 'Decisão de teste'}],
               'entradas_externas': {'pesquisa': {'job_id': 'JOB-TESTE-1', 'business_id': 'BIZ-003',
                                                   'evidence_refs': ['MEM-TESTE'],
                                                   'result_payload': {'delivery': {'content': 'Documento do teste.',
                                                                                  'stage': 'INTERMEDIATE',
                                                                                  'limitations': 'Taxa não comprovada.'}}}}}
    return _assinar(captura), plano


def _assinar(captura):
    copia = {k: v for k, v in captura.items() if k != 'proveniencia'}
    digest = hashlib.sha256(json.dumps(copia, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    captura['proveniencia'] = {'hash_sha256': digest}
    return captura


def test_prazo_ausente_nao_vira_sugestao_de_sete_dias_nem_disparo():
    captura, plano = _captura()
    plano['prazo_sugerido_dias'] = 7
    resultado = preparar_tarefa_real(captura, plano)
    assert resultado['estado'] == 'AGUARDANDO_CONFIRMACAO'
    assert resultado['dados_reais']['pedido']['ordem_de_servico']['prazo'] is None
    assert 'prazo' in {p['campo'] for p in resultado['pendencias']}
    assert resultado['agentes_chamados'] == resultado['escritas_remotas'] == 0
    assert resultado['dados_reais']['fontes_importadas']['FON-PEDIDO-TSK-TESTE'] == captura['tarefa']['tarefa']
    assert 'Taxa não comprovada.' in resultado['dados_reais']['fontes_importadas']['FON-JOB-JOB-TESTE-1']


def test_captura_alterada_depois_da_leitura_e_recusada():
    captura, plano = _captura()
    captura['tarefa']['tarefa'] = 'Pedido substituído'
    with pytest.raises(ValueError, match='alterada'):
        preparar_tarefa_real(captura, plano)


@pytest.mark.parametrize('marca', [None, {'status': 'DRAFT'},
    {'status': 'APPROVED', 'business_id': 'BIZ-004', 'schema_version': 1, 'name': 'Outra empresa'}])
def test_empresa_ativa_nao_transforma_marca_ausente_ou_de_outro_escopo_em_confirmada(marca):
    captura, plano = _captura()
    captura['empresa']['brand_identity'] = marca
    _assinar(captura)
    resultado = preparar_tarefa_real(captura, plano)
    assert resultado['dados_reais']['pedido']['pacote_da_empresa']['estado'] == 'A_CONFIRMAR'
    assert 'pacote_da_empresa' in {p['campo'] for p in resultado['pendencias']}


@pytest.mark.parametrize('mudanca', ['tarefa', 'entrada', 'roteiro'])
def test_nao_mistura_empresas_nem_entradas_de_outra_origem(mudanca):
    captura, plano = _captura()
    if mudanca == 'tarefa':
        captura['tarefa']['business_id'] = 'BIZ-004'
    elif mudanca == 'entrada':
        captura['entradas_externas']['pesquisa']['business_id'] = 'BIZ-004'
    else:
        plano['empresas'] = ['BIZ-004']
    _assinar(captura)
    with pytest.raises(ValueError, match='escopos|outra origem'):
        preparar_tarefa_real(captura, plano)


def test_nao_completa_fonte_ou_decisao_faltante_com_exemplo():
    captura, plano = _captura()
    captura['decisoes'] = []
    _assinar(captura)
    with pytest.raises(ValueError, match='decisões'):
        preparar_tarefa_real(captura, plano)


def test_captura_privada_nao_sobrescreve_historico(tmp_path):
    arquivo = tmp_path / 'captura.json'
    _salvar_preparacao(arquivo, {'estado': 'AGUARDANDO_CONFIRMACAO'})
    assert arquivo.stat().st_mode & 0o777 == 0o600
    with pytest.raises(FileExistsError):
        _salvar_preparacao(arquivo, {'estado': 'outra'})
    assert json.loads(arquivo.read_text())['estado'] == 'AGUARDANDO_CONFIRMACAO'


def test_nao_exporta_captura_para_destino_simbolico(tmp_path):
    alvo = tmp_path / 'real'
    alvo.mkdir()
    link = tmp_path / 'link'
    link.symlink_to(alvo, target_is_directory=True)
    with pytest.raises(ValueError, match='links'):
        _salvar_preparacao(link / 'captura.json', {'estado': 'teste'})
    assert not (alvo / 'captura.json').exists()


def test_caminho_com_ponto_ponto_nao_escapa_da_protecao_do_checkout():
    from orquestrador.plano import RAIZ
    caminho = RAIZ.parent / 'helena-env' / '..' / RAIZ.name / 'captura-privada-teste.json'
    with pytest.raises(ValueError, match='repositório'):
        _salvar_preparacao(caminho, {'estado': 'teste'})
    assert not (RAIZ / 'captura-privada-teste.json').exists()


def test_nao_exporta_captura_para_outro_repositorio(tmp_path):
    repo = tmp_path / 'outro-checkout'
    repo.mkdir()
    subprocess.run(['git', 'init', str(repo)], capture_output=True, check=True)
    with pytest.raises(ValueError, match='repositório Git'):
        _salvar_preparacao(repo / 'captura.json', {'estado': 'teste'})
    assert not (repo / 'captura.json').exists()


def test_cli_preview_nao_inicia_motor_ou_escreve_no_banco(monkeypatch, capsys):
    import orquestrador.__main__ as cli
    captura, plano = _captura()
    class Fonte:
        def carregar_tarefa(self, tarefa, recebido):
            assert tarefa == 'TSK-TESTE' and recebido == plano
            return copy.deepcopy(captura)
    monkeypatch.setattr(cli, 'FonteSupabase', Fonte)
    monkeypatch.setattr(cli, 'ler_yaml', lambda _path: copy.deepcopy(plano))
    monkeypatch.setattr(cli, 'Motor', lambda *a, **k: pytest.fail('preview iniciou Motor'))
    assert main(['preparar-tarefa-real', '--tarefa', 'TSK-TESTE', '--roteiro', 'teste']) == 0
    saida = json.loads(capsys.readouterr().out)
    assert saida['fontes_documentais'] == 1
    assert 'Pedido literal' not in json.dumps(saida)
    assert saida['escritas_remotas'] == saida['agentes_chamados'] == 0


def test_cli_nao_le_arquivo_arbitrario_com_nome_do_roteiro(monkeypatch):
    import orquestrador.__main__ as cli
    monkeypatch.setattr(cli, 'ler_yaml', lambda _p: pytest.fail('leu caminho externo'))
    with pytest.raises(SystemExit) as erro:
        main(['preparar-tarefa-real', '--tarefa', 'TSK-TESTE', '--roteiro', '../secreto'])
    assert erro.value.code == 2
