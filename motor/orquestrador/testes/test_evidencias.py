"""Coleta local de partes entregues; sem rede nem Hermes real."""

import json
import pytest

from executor_helena.tipos import Conferencia, RegistroDeUso, Resultado
from ferramentas_helena.copias import Copias
from ferramentas_helena.leitor import montar_saida
from ferramentas_helena.registro import Registro, salvar_estado
from orquestrador.evidencias import EvidenciaInvalida, coletar_evidencias


EXECUCAO = 'E1-123'


def _resultado(pasta=None, internet=True, conversa=({'papel': 'assistente', 'conteudo': 'Vi parte 1'},)):
    return Resultado(texto='{}', terminou_inteira=True,
                     uso=RegistroDeUso(usou_internet=internet,
                                       origem={'usou_internet': 'ferramentas:estado.json:usou_internet'}),
                     codigo_de_saida=0, ferramentas_recebidas=('ler_pagina',),
                     modelo_usado=None, provedor_usado=None, tempo_s=1.0,
                     falha=None, conferencia=Conferencia(), pasta=pasta, conversa=conversa)


def _provas(tmp_path, *, duas_partes=False):
    pasta = tmp_path / 'execucao'
    ferramentas = pasta / 'ferramentas'
    ferramentas.mkdir(parents=True)
    texto = 'Primeira parte. Segunda parte.'
    corte = len('Primeira parte. ')
    copia = Copias(ferramentas, relogio=lambda: 100).guardar(
        'https://exemplo.test/a', 'https://exemplo.test/a', texto,
        [corte, len(texto)], [], '0' * 64, 'text/html')
    registro = Registro(ferramentas / 'registro.jsonl', EXECUCAO, relogio=lambda: 100)
    for parte in (1, 2) if duas_partes else (1,):
        registro.registrar('ler_pagina', {'url': copia.url_final, 'parte': parte}, 'ok',
                           montar_saida(copia, parte), leitura_id=copia.leitura_id,
                           parte=parte, de=copia.total_partes, hash_copia=copia.hash_texto,
                           url_final=copia.url_final)
    salvar_estado(ferramentas, {'execucao': EXECUCAO, 'usou_internet': True})
    return pasta, ferramentas


def test_so_partes_realmente_entregues_e_uso_com_origem(tmp_path):
    pasta, _ = _provas(tmp_path)
    resposta = coletar_evidencias(_resultado(pasta), EXECUCAO)
    pagina = resposta['paginas_lidas'][0]
    assert pagina['execucao'] == EXECUCAO
    assert pagina['partes_total'] == 2
    assert pagina['partes'] == {'1': 'Primeira parte. '}
    assert resposta['usou_internet'] is True
    assert resposta['uso']['origem']['usou_internet'] == 'ferramentas:estado.json:usou_internet'
    assert resposta['conversa'] == [{'papel': 'assistente', 'conteudo': 'Vi parte 1'}]


def test_junta_partes_entregues_sem_inventar_resto(tmp_path):
    pasta, _ = _provas(tmp_path, duas_partes=True)
    assert coletar_evidencias(_resultado(pasta), EXECUCAO)['paginas_lidas'][0]['partes'] == {
        '1': 'Primeira parte. ', '2': 'Segunda parte.'}


def test_sem_pasta_preserva_ausencia_de_informacao():
    resposta = coletar_evidencias(_resultado(None, internet=None), EXECUCAO)
    assert resposta['paginas_lidas'] == [] and resposta['usou_internet'] is None
    assert resposta['uso']['usou_internet'] is None
    assert coletar_evidencias(_resultado(None, internet=False), EXECUCAO)['usou_internet'] is False
    with pytest.raises(EvidenciaInvalida):
        coletar_evidencias(_resultado(None, internet=True), EXECUCAO)


def test_estado_ou_registro_de_outra_execucao_recusado(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    estado = json.loads((ferramentas / 'estado.json').read_text())
    estado['execucao'] = 'E2-123'
    (ferramentas / 'estado.json').write_text(json.dumps(estado))
    with pytest.raises(EvidenciaInvalida, match='outra execução'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)
    estado['execucao'] = EXECUCAO
    (ferramentas / 'estado.json').write_text(json.dumps(estado))
    linhas = [json.loads(x) for x in (ferramentas / 'registro.jsonl').read_text().splitlines()]
    linhas[0]['execucao'] = 'E2-123'
    (ferramentas / 'registro.jsonl').write_text(json.dumps(linhas[0]) + '\n')
    with pytest.raises(EvidenciaInvalida, match='outra execução'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)


def test_copia_alterada_ou_hash_de_entrega_divergente_recusados(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    texto = ferramentas / 'leituras' / 'LEI-001.txt'
    texto.write_text(texto.read_text() + ' adulteração')
    with pytest.raises(EvidenciaInvalida):
        coletar_evidencias(_resultado(pasta), EXECUCAO)
    texto.write_text('Primeira parte. Segunda parte.')
    linhas = [json.loads(x) for x in (ferramentas / 'registro.jsonl').read_text().splitlines()]
    linhas[0]['hash'] = '0' * 64
    (ferramentas / 'registro.jsonl').write_text(json.dumps(linhas[0]) + '\n')
    with pytest.raises(EvidenciaInvalida, match='difere'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)


def test_links_simbolicos_em_pasta_estado_e_copia_recusados(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    outro = tmp_path / 'outro'
    outro.mkdir()
    (pasta / 'ferramentas').rename(outro / 'ferramentas')
    (pasta / 'ferramentas').symlink_to(outro / 'ferramentas', target_is_directory=True)
    with pytest.raises(EvidenciaInvalida, match='link simbólico'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)


def test_link_de_arquivo_e_estado_divergente_recusados(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    original = ferramentas / 'leituras' / 'LEI-001.txt'
    fora = tmp_path / 'texto.txt'
    original.rename(fora)
    original.symlink_to(fora)
    with pytest.raises(EvidenciaInvalida, match='link simbólico'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)
    original.unlink()
    original.write_text(fora.read_text())
    with pytest.raises(EvidenciaInvalida, match='diverge'):
        coletar_evidencias(_resultado(pasta, internet=False), EXECUCAO)


def test_registro_excessivo_recusado_antes_de_parsear(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    with (ferramentas / 'registro.jsonl').open('ab') as arquivo:
        arquivo.write(b' ' * 512_001)
    with pytest.raises(EvidenciaInvalida, match='tamanho'):
        coletar_evidencias(_resultado(pasta), EXECUCAO)


def test_aviso_entregue_agora_nao_vira_pagina(tmp_path):
    pasta, ferramentas = _provas(tmp_path)
    registro = Registro(ferramentas / 'registro.jsonl', EXECUCAO)
    registro.registrar('ler_pagina', {'url': 'https://exemplo.test/a'}, 'entregue_agora',
                       'Limite atingido')
    paginas = coletar_evidencias(_resultado(pasta), EXECUCAO)['paginas_lidas']
    assert len(paginas) == 1 and paginas[0]['partes'] == {'1': 'Primeira parte. '}
