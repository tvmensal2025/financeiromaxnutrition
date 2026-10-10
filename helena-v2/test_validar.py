"""Prova que o validador recusa cada defeito (um teste de mutação por regra).

Como funciona um teste de mutação: pega o dado REAL (fichas, catálogo, entregas, casos, jornadas),
muda UMA coisa na cópia em memória e confere que a regra certa acusa um problema NOVO, que o dado
real não tinha. Nenhum arquivo é alterado.

Rodar:  python -m pytest -q test_validar.py

Os roteiros v3.1 ainda não existem em playbooks/ (só há um da v1). Por isso os testes de roteiro
usam ROTEIRO, um roteiro v3.1 completo montado aqui (a meta das 10 pessoas), e provam primeiro que
ele passa limpo antes de estragá-lo.
"""
import copy
import re

import pytest
from collections import Counter
from pathlib import Path

import validar as v

CODIGO_DESTE_ARQUIVO = Path(__file__).read_text(encoding='utf-8')
BASE = v.carregar()
_erros_da_base = {}

# O que o dado real ainda tem de pendente vem de UM lugar só: PENDENCIAS.yaml (lido pelo validar.py).
PENDENCIAS = v.ler_pendencias()


# ---------------------------------------------------------------------------------------
# Ferramentas dos testes
# ---------------------------------------------------------------------------------------
def com(*chaves):
    """Dado real com cópia própria das chaves pedidas (as outras são compartilhadas, só de leitura)."""
    D = dict(BASE)
    for chave in chaves:
        D[chave] = copy.deepcopy(BASE[chave])
    return D


def servico(D, sid):
    return next(s for s in D['servicos']['servicos'] if s['id'] == sid)


def agente_do_organograma(D, ident):
    return next(a for a in D['organograma']['agentes'] if a['identidade'] == ident)


def erros_da_base(tag):
    if tag not in _erros_da_base:
        _erros_da_base[tag] = v.rodar(BASE, so={tag})
    return _erros_da_base[tag]


def novos(D, tag):
    """Problemas da regra no dado mudado que o dado real não tinha."""
    depois = Counter(v.rodar(D, so={tag}))
    antes = Counter(erros_da_base(tag))
    return list((depois - antes).elements())


def recusa(D, tag, trecho):
    """A regra acusa um problema novo, que fala de 'trecho'; e não foi o validador que quebrou."""
    achados = novos(D, tag)
    assert achados, f'a regra {tag} NÃO recusou a mudança'
    assert not any('não conseguiu ler o dado' in a for a in achados), f'a regra {tag} quebrou em vez de recusar: {achados}'
    assert any(trecho in a for a in achados), f'a regra {tag} recusou, mas não falou de {trecho!r}: {achados}'


# ---------------------------------------------------------------------------------------
# O dado real
# ---------------------------------------------------------------------------------------
def test_dado_real_so_tem_as_pendencias_conhecidas():
    novos, _, resolvidas = v.separar(v.rodar(BASE), PENDENCIAS)
    assert novos == [], f'problema novo no dado real: {novos}'
    assert resolvidas == [], f'pendência já resolvida continua em PENDENCIAS.yaml: {resolvidas}'


def test_fichas_ausentes_aparecem_com_contagem():
    # A contagem vem do dado, não de um número fixo: o teste não quebra quando uma ficha nova fica pronta.
    erros = erros_da_base('FICHA-AUSENTE')
    if len(BASE['fichas']) == 21:
        assert erros == []                                                  # todas prontas: nada a acusar
        return
    [mensagem] = erros
    faltam = 21 - len(BASE['fichas'])
    assert f'agents: [FICHA-AUSENTE] {faltam} de 21 fichas ausentes: ' in mensagem
    for antiga in BASE['fichas_antigas']:
        assert antiga in mensagem                                           # ficha antiga da v1 não conta


def test_ficha_da_v1_nao_conta_como_ficha():
    # Qualquer arquivo no formato da v1 não pode virar ficha v3.1 (vale para quantos existirem).
    for antiga in BASE['fichas_antigas']:
        assert antiga.rsplit('.', 1)[0].upper() not in BASE['fichas']


def test_toda_regra_tem_descricao_e_teste_de_mutacao():
    for tag, (descricao, _) in v.REGRAS.items():
        assert len(descricao) > 15, f'{tag} sem descrição'
        assert re.search(r"recusa\([^\n]*?'" + re.escape(tag) + "'", CODIGO_DESTE_ARQUIVO), f'{tag} sem teste de mutação'


def test_main_aceita_so_as_pendencias_conhecidas_e_mostra_cada_uma(capsys):
    assert v.main([]) == 0
    saida = capsys.readouterr().out
    assert 'Conferido:' in saida and 'ERRO' not in saida
    if PENDENCIAS:
        assert 'PENDENTE agents: [FICHA-AUSENTE]' in saida and 'pendência(s) conhecida(s)' in saida


def test_main_estrito_trata_pendencia_como_erro(capsys):
    if not PENDENCIAS:
        pytest.skip('sem pendências: o modo estrito equivale ao normal')
    assert v.main(['--estrito']) == 1
    saida = capsys.readouterr().out
    assert 'ERRO agents: [FICHA-AUSENTE]' in saida and 'problema(s)' in saida


def test_problema_fora_da_lista_e_erro_mesmo_com_pendencias(monkeypatch, capsys):
    reais = v.rodar(BASE)
    monkeypatch.setattr(v, 'rodar', lambda D, so=None: reais + ['agents/caio.yaml: [MAT-03] problema plantado pelo teste'])
    assert v.main([]) == 1
    assert 'ERRO agents/caio.yaml: [MAT-03] problema plantado pelo teste' in capsys.readouterr().out


def test_pendencia_ja_resolvida_e_erro(monkeypatch, capsys):
    monkeypatch.setattr(v, 'ler_pendencias', lambda caminho=None: PENDENCIAS + [
        {'regra': 'MAT-03', 'alvo': 'agents/caio.yaml', 'motivo': 'pendência que não acontece mais'}])
    assert v.main([]) == 1
    assert '[PENDENCIA-RESOLVIDA] MAT-03 em agents/caio.yaml' in capsys.readouterr().out


def test_pendencia_com_teto_vira_erro_quando_passa_do_teto():
    pend = [{'regra': 'FICHA-AUSENTE', 'alvo': 'agents', 'maximo': 14, 'motivo': 'teste'}]
    novos, pendentes, _ = v.separar(['agents: [FICHA-AUSENTE] 15 de 21 fichas ausentes: X'], pend)
    assert novos and not pendentes                                        # 15 > 14: não pode se esconder
    novos, pendentes, _ = v.separar(['agents: [FICHA-AUSENTE] 13 de 21 fichas ausentes: X'], pend)
    assert pendentes and not novos


def test_pendencia_so_cobre_o_alvo_exato():
    pend = [{'regra': 'CASOS-BOAS', 'alvo': 'casos/SRV-COPY', 'motivo': 'teste'}]
    novos, pendentes, _ = v.separar(['casos/SRV-CALCULO: [CASOS-BOAS] 0 caso(s) bom(ns); o mínimo é 3'], pend)
    assert novos and not pendentes                                        # outro serviço sem casos é erro novo


def test_pendencias_yaml_exige_regra_alvo_e_motivo(tmp_path):
    arquivo = tmp_path / 'PENDENCIAS.yaml'
    arquivo.write_text('pendencias:\n  - regra: FICHA-AUSENTE\n    alvo: agents\n', encoding='utf-8')
    with pytest.raises(ValueError):
        v.ler_pendencias(arquivo)


def test_regra_que_quebra_vira_problema_e_nao_silencio(monkeypatch):
    monkeypatch.setitem(v.REGRAS, 'TESTE-QUEBRA', ('regra de teste que sempre quebra', lambda D, erro: 1 / 0))
    achados = v.rodar({}, so={'TESTE-QUEBRA'})
    assert len(achados) == 1 and '[TESTE-QUEBRA]' in achados[0] and 'não conseguiu ler o dado' in achados[0]


def test_dado_ilegivel_nunca_passa_em_silencio():
    D = com('servicos')
    D['servicos']['servicos'] = 'isto não é uma lista de serviços'
    assert v.rodar(D, so={'MAT-01'})                                         # nenhum agente é dono de nada: acusa


# ---------------------------------------------------------------------------------------
# CARGA e ESQUEMAS
# ---------------------------------------------------------------------------------------
def test_CARGA_arquivo_que_nao_existe(tmp_path):
    recusa(v.carregar(tmp_path), 'CARGA', 'servicos.yaml: [CARGA] arquivo não encontrado')


def test_CARGA_yaml_ilegivel(tmp_path):
    (tmp_path / 'models.yaml').write_text('apelidos: [isto não fecha', encoding='utf-8')
    recusa(v.carregar(tmp_path), 'CARGA', 'models.yaml: [CARGA] não consegui ler o YAML')


def test_ESQUEMA_ORGANOGRAMA():
    D = com('organograma')
    agente_do_organograma(D, 'CAIO')['estado'] = 'QUASE_ATIVO'
    recusa(D, 'ESQUEMA-ORGANOGRAMA', 'fora da lista permitida')


def test_ESQUEMA_SERVICOS():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['dono'] = 'SIRLENE'                           # personagem do produto, não agente
    recusa(D, 'ESQUEMA-SERVICOS', "'SIRLENE'")


def test_ESQUEMA_FICHA():
    D = com('fichas')
    del D['fichas']['CAIO']['missao']
    recusa(D, 'ESQUEMA-FICHA', "falta o campo 'missao'")


def test_ESQUEMA_FICHA_ferramenta_que_nao_e_nossa():
    D = com('fichas')
    D['fichas']['CLARA']['servicos'][0]['ferramentas'] = [{'nome': 'web_search', 'efeito': 'LER', 'desde': 'fase 3'}]
    recusa(D, 'ESQUEMA-FICHA', "'web_search'")


def test_ESQUEMA_ENTREGA():
    D = com('entregas')
    del D['entregas']['calculo']['rubrica']
    recusa(D, 'ESQUEMA-ENTREGA', "falta o campo 'rubrica'")


def test_ESQUEMA_JORNADA():
    D = com('jornadas')
    del D['jornadas']['casos/SRV-CALCULO/jornada.yaml']['eventos']
    recusa(D, 'ESQUEMA-JORNADA', "falta o campo 'eventos'")


def test_ESQUEMA_CASO_sem_resposta():
    D = com('casos')
    del D['casos']['SRV-CALCULO']['boas']['boa-01.yaml']['resposta']
    recusa(D, 'ESQUEMA-CASO', "não tem o campo 'resposta'")


def test_ESQUEMA_CASO_resposta_fora_do_formato():
    D = com('casos')
    D['casos']['SRV-CALCULO']['boas']['boa-01.yaml']['resposta']['acao'] = 'PEDIR_SUBCARD'     # desligado até a fase 4
    recusa(D, 'ESQUEMA-CASO', 'resposta/')


# ---------------------------------------------------------------------------------------
# MODELOS
# ---------------------------------------------------------------------------------------
def test_MODELOS_FORMATO_campo_a_mais():
    D = com('modelos')
    D['modelos']['apelidos']['analise-padrao']['observacao'] = 'extra'
    recusa(D, 'MODELOS-FORMATO', 'exatamente modelo, provedor e para_que')


def test_MODELOS_FORMATO_segundo_provedor():
    D = com('modelos')
    D['modelos']['apelidos']['conteudo-padrao']['provedor'] = 'outro-provedor'
    recusa(D, 'MODELOS-FORMATO', 'único provedor')


def test_MODELOS_FORMATO_lista_de_modelos():
    D = com('modelos')
    D['modelos']['apelidos']['analise-padrao']['modelo'] = ['gpt-6-sol', 'gpt-6-luna']
    recusa(D, 'MODELOS-FORMATO', 'UM nome de modelo')


def test_MODELOS_FORMATO_apelido_sem_papel():
    D = com('modelos')
    del D['modelos']['papel_do_apelido']['pesquisa-padrao']
    recusa(D, 'MODELOS-FORMATO', 'sem papel válido')


def test_MODELOS_RESERVA_no_apelido():
    D = com('modelos')
    D['modelos']['apelidos']['revisao-padrao']['reserva'] = 'gpt-6-luna'
    recusa(D, 'MODELOS-RESERVA', "campo de reserva 'reserva'")


def test_MODELOS_RESERVA_fallback_em_qualquer_nivel():
    D = com('modelos')
    D['modelos']['cota']['fallback_model'] = 'gpt-6-luna'
    recusa(D, 'MODELOS-RESERVA', "'fallback_model'")


# ---------------------------------------------------------------------------------------
# CATÁLOGO
# ---------------------------------------------------------------------------------------
def test_ORGANOGRAMA_ordem_trocada():
    D = com('organograma')
    a = D['organograma']['agentes']
    a[1]['identidade'], a[2]['identidade'] = a[2]['identidade'], a[1]['identidade']
    recusa(D, 'ORGANOGRAMA', 'mesma ordem')


def test_ORGANOGRAMA_grupo_que_nao_lista_o_agente():
    D = com('organograma')
    agente_do_organograma(D, 'CAIO')['grupo'] = 'GRP-PESSOAS'
    recusa(D, 'ORGANOGRAMA', 'CAIO: grupo GRP-PESSOAS')


def test_CATALOGO_INDICE():
    D = com('servicos')
    D['servicos']['agentes']['CAIO']['ficha'] = 'agents/caio-novo.yaml'
    recusa(D, 'CATALOGO-INDICE', 'agents/caio.yaml')


def test_CATALOGO_INDICE_possui_diferente_dos_servicos():
    D = com('servicos')
    D['servicos']['agentes']['CAIO']['possui'] = {}
    recusa(D, 'CATALOGO-INDICE', "'possui'")


def test_MAT_01_agente_sem_servico():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['dono'] = 'HELENA'                            # o Caio só tinha esse
    recusa(D, 'MAT-01', 'CAIO não é dono de nenhum serviço')


def test_MAT_02_tipo_repetido():
    D = com('servicos')
    servico(D, 'SRV-PLANO-DE-PROJETO')['tipo_de_entrega'] = 'calculo'
    recusa(D, 'MAT-02', "tipo_de_entrega 'calculo' repetido")


def test_MAT_02_arquivo_do_tipo_errado():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['entrega'] = 'deliverables/outro.yaml'
    recusa(D, 'MAT-02', 'deveria ser deliverables/calculo.yaml')


def test_MAT_03_revisor_e_o_proprio_dono():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['revisor'] = 'CAIO'
    recusa(D, 'MAT-03', 'o revisor (CAIO) é o próprio dono')


def test_MAT_03_reserva_e_o_dono():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['reserva'] = 'CAIO'
    recusa(D, 'MAT-03', 'a reserva (CAIO) é o próprio dono')


def test_MAT_03_reserva_igual_ao_revisor():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['reserva'] = 'HELENA'
    recusa(D, 'MAT-03', 'a reserva é igual ao revisor')


def test_MAT_04_revisor_sem_o_tipo_em_revisa():
    D = com('servicos')
    del D['servicos']['agentes']['HELENA']['revisa']['calculo']
    recusa(D, 'MAT-04', "HELENA não tem 'calculo' em 'revisa'")


def test_MAT_04_revisa_de_tipo_em_que_nao_e_revisor():
    D = com('servicos')
    D['servicos']['agentes']['MARINA']['revisa']['calculo'] = 'SEM_PROVA'
    recusa(D, 'MAT-04', 'MARINA não é revisor nem reserva')


def test_MAT_05_quem_revisa_nao_julga_depois():
    D = com('servicos')
    servico(D, 'SRV-COPY')['revisor'] = 'CLARA'                             # a Clara julga o parecer do convite
    recusa(D, 'MAT-05', 'julgaria depois a peça que revisou')


def test_MAT_05_reserva_tambem_nao_pode():
    D = com('servicos')
    servico(D, 'SRV-COPY')['reserva'] = 'HELENA'                            # revisora do parecer
    recusa(D, 'MAT-05', 'o reserva HELENA')


def test_MAT_06_dono_do_tipo_julgado_revisa_o_parecer():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['revisor'] = 'ISABELA'                        # a Isabela é dona do convite
    recusa(D, 'MAT-06', 'ISABELA é dono de')


def test_MAT_07_julgadora_que_vira_card_sozinho():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['escolhivel'] = True
    recusa(D, 'MAT-07', 'nunca é card sozinho')


def test_MAT_07_duas_julgadoras():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['julgadora'] = True
    recusa(D, 'MAT-07', 'exatamente 1 julgadora')


def test_MAT_08_revisor_titular_de_mais_de_3_tipos():
    D = com('servicos')
    servico(D, 'SRV-PLANO-DE-PROJETO')['revisor'] = 'CAIO'                  # ele já era titular de 3
    recusa(D, 'MAT-08', 'CAIO é revisor titular de 4 tipos')


def test_FERRAMENTAS_efeito_que_nao_e_ler():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['ferramentas'][0]['efeito'] = 'ESCREVER'
    recusa(D, 'FERRAMENTAS', "só LER é permitido")


def test_FERRAMENTAS_ferramenta_que_nao_e_nossa():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['ferramentas'].append({'nome': 'web_search', 'efeito': 'LER', 'desde': 'fase 3'})
    recusa(D, 'FERRAMENTAS', "'web_search' não é uma das nossas")


def test_FERRAMENTAS_catalogo_com_ferramenta_que_escreve():
    D = com('servicos')
    D['servicos']['ferramentas_nossas']['registrar_lancamento'] = {'efeito': 'ESCREVER', 'desde': 'fase 3'}
    recusa(D, 'FERRAMENTAS', 'exatamente ler_pagina e buscar')


def test_FERRAMENTAS_internet_sem_ferramenta():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['usa_internet'] = True
    recusa(D, 'FERRAMENTAS', 'usa_internet=True')


def test_MAT_09_internet_com_pergunta():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['acoes_permitidas'].append('PERGUNTAR')
    recusa(D, 'MAT-09', 'só ENTREGAR e REGISTRAR_FALHA')


def test_MAT_09_internet_com_acao_externa():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['acao_externa_permitida'] = ['NENHUMA', 'SO_FUNDADOR']
    recusa(D, 'MAT-09', 'não pode ter ação externa')


def test_MAT_11_duas_acoes_do_fundador():
    D = com('servicos')
    s = servico(D, 'SRV-COPY')
    s['acoes_do_fundador'].append({'id': 'AF-COPY-OUTRA', 'categorias': ['CONTATO'], 'descricao': 'Outra ação qualquer.'})
    recusa(D, 'MAT-11', '2 ações do fundador')


def test_MAT_11_so_fundador_sem_acao():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['acao_externa_permitida'] = ['NENHUMA', 'SO_FUNDADOR']
    recusa(D, 'MAT-11', 'SO_FUNDADOR')


def test_MAT_11_relatorio_final_com_acao():
    D = com('servicos')
    s = servico(D, 'SRV-RELATORIO-FINAL')
    s['acoes_do_fundador'] = [{'id': 'AF-REL-X', 'categorias': ['CONTATO'], 'descricao': 'Uma ação qualquer.'}]
    s['acao_externa_permitida'] = ['NENHUMA', 'SO_FUNDADOR']
    recusa(D, 'MAT-11', 'o relatório final não tem ação do fundador')


def test_MAT_13_estado_do_agente_nao_bate_com_os_servicos():
    D = com('organograma')
    agente_do_organograma(D, 'CAIO')['estado'] = 'PAUSADO'
    recusa(D, 'MAT-13', 'CAIO: estado PAUSADO')


def test_MAT_13_fase_do_agente_nao_bate_com_os_servicos():
    D = com('organograma')
    agente_do_organograma(D, 'CAIO')['fase_de_ativacao'] = 'fase 4'
    recusa(D, 'MAT-13', 'CAIO: fase fase 4')


def test_MAT_14_pessoal_fora_da_laura():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['empresas'] = ['BIZ-003', 'PESSOAL']
    recusa(D, 'MAT-14', 'só dos serviços de')


def test_MAT_14_servico_da_laura_com_empresa():
    D = com('servicos')
    servico(D, 'SRV-PLANO-DE-PRATICA')['empresas'] = ['PESSOAL', 'BIZ-003']
    recusa(D, 'MAT-14', 'não pode ter outra empresa')


def test_MAT_17_acoes_sem_registrar_falha():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['acoes_permitidas'].remove('REGISTRAR_FALHA')
    recusa(D, 'MAT-17', 'falta REGISTRAR_FALHA')


def test_MAT_17_pedir_subcard_liberado():
    D = com('servicos')
    D['servicos']['acoes_do_autor_liberaveis'].append('PEDIR_SUBCARD')
    recusa(D, 'MAT-17', 'acoes_do_autor_liberaveis deve ser')


def test_MAT_22_servico_com_acao_do_fundador_nao_julgado():
    D = com('servicos')
    servico(D, 'SRV-COPY')['julgado_pelo_parecer'] = 'NUNCA'
    recusa(D, 'MAT-22', 'julgado_pelo_parecer deve ser SEMPRE')


def test_MAT_22_tipo_fora_do_julga_tipos():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['julga_tipos'].remove('copy')
    recusa(D, 'MAT-22', 'SRV-COPY')


def test_MAT_23_servico_em_estagio_com_pacote_nao_confirmado():
    D = com('organograma')
    D['organograma']['empresas']['BIZ-004']['pacote']['estado'] = 'NAO_CONFIRMADO'
    recusa(D, 'MAT-23', 'BIZ-004, cujo pacote não está CONFIRMADO')


def test_MAT_12_revisor_titular_que_liga_depois_do_dono():
    D = com('servicos')
    servico(D, 'SRV-PLANO-DE-PROJETO')['revisor'] = 'BRUNO'                 # Bruno é o passo 17; a Marina, o 5
    recusa(D, 'MAT-12', 'liga depois do dono MARINA')


def test_MAT_12_servico_em_estagio_sem_titular_apto():
    D = com('servicos')
    D['servicos']['agentes']['CAIO']['revisa']['copy'] = 'SEM_PROVA'
    recusa(D, 'MAT-12', "não está APTO em 'copy'")


def test_MAT_12_agente_fora_da_ordem_de_ativacao():
    D = com('servicos')
    passos = D['servicos']['ordem_de_ativacao']['passos']
    passos[:] = [p for p in passos if p['agente'] != 'RAVI']
    recusa(D, 'MAT-12', 'RAVI aparece 0 vez(es)')


def test_MAT_15_relatorio_final_escolhivel():
    D = com('servicos')
    servico(D, 'SRV-RELATORIO-FINAL')['escolhivel'] = True
    recusa(D, 'MAT-15', 'só existe como última etapa de um roteiro')


def test_MAT_15_helena_revisa_o_proprio_relatorio():
    D = com('servicos')
    servico(D, 'SRV-RELATORIO-FINAL')['reserva'] = 'HELENA'
    recusa(D, 'MAT-15', 'a Helena nunca revisa o próprio relatório')


def test_MAT_15_dois_servicos_de_relatorio():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['tipo_de_entrega'] = 'relatorio_final'
    recusa(D, 'MAT-15', 'exatamente 1 serviço de relatório final')


def test_MAT_19_escolhivel_sem_avulso():
    D = com('servicos')
    servico(D, 'SRV-COPY')['avulso'] = False
    recusa(D, 'MAT-19', 'escolhivel exige avulso')


def test_MAT_19_poucos_exemplos():
    D = com('servicos')
    servico(D, 'SRV-COPY')['exemplos_de_pedido'] = servico(D, 'SRV-COPY')['exemplos_de_pedido'][:1]
    recusa(D, 'MAT-19', 'de 3 a 5 exemplos')


def test_MAT_19_exemplo_repetido_de_outro_servico():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['exemplos_de_pedido'][0] = servico(D, 'SRV-COPY')['exemplos_de_pedido'][0]
    recusa(D, 'MAT-19', 'já é de')


def test_MAT_19_servico_nao_escolhivel_com_exemplos():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['exemplos_de_pedido'] = ['Faz um parecer para mim.']
    recusa(D, 'MAT-19', 'não é escolhível não tem exemplos')


def test_MAT_19_nao_atende_manda_para_si_mesmo():
    D = com('servicos')
    servico(D, 'SRV-CALCULO')['nao_atende'].append('Conta de outro tipo: SRV-CALCULO (Caio).')
    recusa(D, 'MAT-19', 'manda o pedido para o próprio serviço')


def test_MAT_19_pedido_de_fronteira_com_destino_que_nao_existe():
    D = com('servicos')
    D['servicos']['pedidos_de_fronteira'][0]['certo'] = 'SRV-NAO-EXISTE'
    recusa(D, 'MAT-19', "'SRV-NAO-EXISTE' não existe")


def test_MAT_24_area_sem_destino():
    D = com('servicos')
    D['servicos']['mapa_de_areas'][0]['atende'] = 'SRV-NAO-EXISTE'
    recusa(D, 'MAT-24', "aponta para 'SRV-NAO-EXISTE'")


def test_MAT_24_item_de_fora_do_catalogo_sem_dono():
    D = com('servicos')
    del D['servicos']['fora_do_catalogo'][0]['dono']
    recusa(D, 'MAT-24', 'falta dono')


def test_MAT_25_modelo_menor_no_parecer():
    D = com('servicos')
    servico(D, 'SRV-PARECER')['modelo_menor'] = 'APTO'
    recusa(D, 'MAT-25', 'modelo_menor deve ser NUNCA')


# ---------------------------------------------------------------------------------------
# FICHAS
# ---------------------------------------------------------------------------------------
def test_FICHA_AUSENTE_uma_a_mais_aumenta_a_contagem():
    D = com('fichas')
    del D['fichas']['MARINA']
    recusa(D, 'FICHA-AUSENTE', f"{21 - len(D['fichas'])} de 21 fichas ausentes")


def test_FICHA_AUSENTE_nao_se_afrouxa_com_ficha_da_v1():
    D = com('fichas', 'fichas_antigas')
    D['fichas_antigas'].append('marina.yaml')                              # ficha antiga no lugar da nova: continua ausente
    del D['fichas']['MARINA']
    recusa(D, 'FICHA-AUSENTE', 'marina.yaml')


def test_FICHA_ARQUIVO_nome_errado():
    D = com('arquivo_da_ficha')
    D['arquivo_da_ficha']['CAIO'] = 'caio-novo.yaml'
    recusa(D, 'FICHA-ARQUIVO', 'deveria se chamar caio.yaml')


def test_FICHA_ARQUIVO_identidade_diferente():
    D = com('fichas')
    D['fichas']['CAIO']['identidade'] = 'DANIEL'
    recusa(D, 'FICHA-ARQUIVO', 'não bate com o arquivo')


def test_FICHA_ESPELHO_ORG_nome():
    D = com('fichas')
    D['fichas']['CAIO']['nome'] = 'Caio Souza'
    recusa(D, 'FICHA-ESPELHO-ORG', 'nome da ficha')


def test_FICHA_ESPELHO_ORG_estado():
    D = com('fichas')
    D['fichas']['CAIO']['estado'] = 'PAUSADO'
    recusa(D, 'FICHA-ESPELHO-ORG', 'estado da ficha')


def test_FICHA_ESPELHO_SERVICOS_revisor_diferente_do_catalogo():
    D = com('fichas')
    D['fichas']['CAIO']['servicos'][0]['revisor'] = 'MARINA'
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'revisor da ficha')


def test_FICHA_ESPELHO_SERVICOS_reserva_diferente_do_catalogo():
    D = com('fichas')
    D['fichas']['CAIO']['servicos'][0]['reserva'] = 'MARINA'
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'reserva da ficha')


def test_FICHA_ESPELHO_SERVICOS_ferramenta_diferente_do_catalogo():
    D = com('fichas')
    D['fichas']['CLARA']['servicos'][0]['ferramentas'] = []
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'ferramentas da ficha')


def test_FICHA_ESPELHO_SERVICOS_acoes_diferentes_do_catalogo():
    D = com('fichas')
    D['fichas']['CAIO']['servicos'][0]['acoes_permitidas'] = ['ENTREGAR', 'REGISTRAR_FALHA']
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'acoes_permitidas da ficha')


def test_FICHA_ESPELHO_SERVICOS_servico_de_outro_dono():
    D = com('fichas')
    D['fichas']['MARINA']['servicos'].append(copy.deepcopy(BASE['fichas']['CAIO']['servicos'][0]))
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'SRV-CALCULO não é de MARINA')


def test_FICHA_ESPELHO_SERVICOS_servico_que_falta():
    D = com('fichas')
    D['fichas']['CAIO']['servicos'] = []
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'falta o serviço SRV-CALCULO')


def test_FICHA_ESPELHO_SERVICOS_empresas():
    D = com('fichas')
    D['fichas']['CAIO']['empresas'] = ['BIZ-001']
    recusa(D, 'FICHA-ESPELHO-SERVICOS', 'união')


def test_FICHA_APTIDAO_estado_diferente():
    D = com('fichas')
    for a in D['fichas']['HELENA']['revisao']['aptidao']:
        if a['tipo'] == 'calculo':
            a['estado'] = 'SEM_PROVA'
    recusa(D, 'FICHA-APTIDAO', 'revisao.aptidao')


def test_FICHA_APTIDAO_tipo_a_mais():
    D = com('fichas')
    D['fichas']['CAIO']['revisao']['aptidao'].append({'tipo': 'parecer', 'estado': 'APTA'})
    recusa(D, 'FICHA-APTIDAO', 'revisao.aptidao')


def test_FICHA_MODELO_apelido_que_nao_existe():
    D = com('fichas')
    D['fichas']['CAIO']['modelo']['autor'] = 'gpt-qualquer'
    recusa(D, 'FICHA-MODELO', "'gpt-qualquer' não existe")


def test_FICHA_MODELO_revisao_com_apelido_de_autor():
    D = com('fichas')
    D['fichas']['CAIO']['modelo']['revisao'] = 'analise-padrao'
    recusa(D, 'FICHA-MODELO', 'deveria ser REVISAO')


def test_FICHA_MODELO_pesquisa_para_quem_nao_le_internet():
    D = com('fichas')
    D['fichas']['CAIO']['modelo']['autor'] = 'pesquisa-padrao'
    recusa(D, 'FICHA-MODELO', 'só para serviço que lê página')


def test_FICHA_MODELO_quem_le_internet_sem_pesquisa():
    D = com('fichas')
    D['fichas']['CLARA']['modelo']['autor'] = 'analise-padrao'
    recusa(D, 'FICHA-MODELO', 'usa modelo.autor = pesquisa-padrao')


def test_FICHA_MODELO_coordenacao_fora_da_helena():
    D = com('fichas')
    D['fichas']['CAIO']['modelo']['coordenacao'] = 'coordenacao-padrao'
    recusa(D, 'FICHA-MODELO', 'só a Helena')


def test_FICHA_ORCAMENTO_impossivel():
    D = com('fichas')
    D['fichas']['CLARA']['servicos'][0]['orcamento']['chamadas_total'] = 10      # 10 < 30 partes + 1
    recusa(D, 'FICHA-ORCAMENTO', 'orçamento impossível')


# ---------------------------------------------------------------------------------------
# ENTREGAS
# ---------------------------------------------------------------------------------------
def test_ENTREGA_CATALOGO_dono_diferente():
    D = com('entregas')
    D['entregas']['calculo']['dono'] = 'MARINA'
    recusa(D, 'ENTREGA-CATALOGO', 'dono MARINA é diferente do catálogo')


def test_ENTREGA_CATALOGO_tipo_que_nao_existe():
    D = com('entregas')
    D['entregas']['inventado'] = copy.deepcopy(BASE['entregas']['calculo'])
    recusa(D, 'ENTREGA-CATALOGO', "o tipo 'inventado' não existe")


def test_ENTREGA_CATALOGO_servico_diferente():
    D = com('entregas')
    D['entregas']['calculo']['servico'] = 'SRV-COPY'
    recusa(D, 'ENTREGA-CATALOGO', 'servico SRV-COPY')


def test_ENTREGA_DONO_UNICO_dois_donos_para_o_mesmo_tipo():
    D = com('fichas')
    D['fichas']['MARINA']['servicos'].append({'servico': 'SRV-CALCULO', 'tipo_de_entrega': 'calculo'})
    recusa(D, 'ENTREGA-DONO-UNICO', 'tipo calculo')


def test_ENTREGA_DONO_UNICO_arquivo_com_outro_dono():
    D = com('entregas')
    D['entregas']['parecer']['dono'] = 'CAIO'
    recusa(D, 'ENTREGA-DONO-UNICO', 'deliverables/parecer.yaml diz CAIO')


def test_ENTREGA_DONO_UNICO_servico_repetido_no_catalogo():
    D = com('servicos')
    servico(D, 'SRV-PLANO-DE-PROJETO')['tipo_de_entrega'] = 'calculo'
    recusa(D, 'ENTREGA-DONO-UNICO', 'tipo calculo')


def test_ENTREGA_ARQUIVO_tipo_sem_arquivo():
    D = com('entregas')
    del D['entregas']['calculo']
    recusa(D, 'ENTREGA-ARQUIVO', 'deliverables/calculo.yaml não existe')


def test_ENTREGA_ID_UNICO_rubrica_repetida():
    D = com('entregas')
    D['entregas']['calculo']['rubrica'][0]['id'] = BASE['entregas']['parecer']['rubrica'][0]['id']
    recusa(D, 'ENTREGA-ID-UNICO', 'RUB-PARECER-01 repetido')


def test_ENTREGA_ID_UNICO_checagem_igual_a_comum():
    D = com('entregas')
    D['entregas']['calculo']['checagens_codigo'][0]['id'] = 'CHK-COMUM-01'
    recusa(D, 'ENTREGA-ID-UNICO', 'CHK-COMUM-01 repetido')


def test_ENTREGA_ID_UNICO_secao_repetida():
    D = com('entregas')
    D['entregas']['calculo']['secoes'][1]['id'] = D['entregas']['calculo']['secoes'][0]['id']
    recusa(D, 'ENTREGA-ID-UNICO', "seção 'pergunta' repetida")


def test_ENTREGA_PRONTO_cita_id_de_fora():
    D = com('entregas')
    D['entregas']['calculo']['criterio_de_pronto']['codigo'].append('CHK-PARECER-SO-SECOES')
    recusa(D, 'ENTREGA-PRONTO', 'CHK-PARECER-SO-SECOES')


def test_ENTREGA_PRONTO_rubrica_fora_do_pronto():
    D = com('entregas')
    D['entregas']['calculo']['criterio_de_pronto']['rubrica'].remove('RUB-CALCULO-08')
    recusa(D, 'ENTREGA-PRONTO', 'RUB-CALCULO-08 da rubrica não está no critério de pronto')


def test_ENTREGA_FUNDADOR_acao_externa_sem_o_fundador():
    D = com('entregas')
    D['entregas']['perfil_de_funcao']['criterio_de_pronto']['fundador'] = {'quando': 'NUNCA'}
    recusa(D, 'ENTREGA-FUNDADOR', 'QUANDO_HA_ACAO_EXTERNA')


def test_ENTREGA_FUNDADOR_parecer_sem_o_segundo_revisor():
    D = com('entregas')
    D['entregas']['parecer']['criterio_de_pronto']['fundador'] = {'quando': 'NUNCA'}
    recusa(D, 'ENTREGA-FUNDADOR', 'SEMPRE_NO_JURIDICO')


def test_ENTREGA_ESPECIAL_relatorio_sem_revisor_nao_reavalia():
    D = com('entregas')
    D['entregas']['relatorio_final']['revisor_nao_reavalia'] = []
    recusa(D, 'ENTREGA-ESPECIAL', 'revisor_nao_reavalia')


def test_ENTREGA_ESPECIAL_parecer_sem_tema_obrigatorio():
    D = com('entregas')
    D['entregas']['parecer']['temas_obrigatorios'] = [t for t in D['entregas']['parecer']['temas_obrigatorios'] if t['id'] != 'TEMA-MENORES']
    recusa(D, 'ENTREGA-ESPECIAL', 'TEMA-MENORES')


def test_ENTREGA_ESPECIAL_parecer_sem_entrada_de_passos_fixos():
    D = com('entregas')
    D['entregas']['parecer']['entrada_minima'] = [e for e in D['entregas']['parecer']['entrada_minima'] if e['de_onde'] != 'PASSOS_FIXOS_DO_ROTEIRO']
    recusa(D, 'ENTREGA-ESPECIAL', 'PASSOS_FIXOS_DO_ROTEIRO')


def test_ENTREGA_INTERNET_pergunta_em_servico_que_le_a_internet():
    D = com('entregas')
    D['entregas']['parecer']['entrada_minima'][0]['se_faltar'] = 'PERGUNTAR'
    recusa(D, 'ENTREGA-INTERNET', 'só pode REGISTRAR_FALHA')


def test_ENTREGA_LEI_rubrica_que_depende_de_lei():
    D = com('entregas')
    D['entregas']['calculo']['rubrica'][0]['pergunta'] = 'O cálculo respeita o que a LGPD manda sobre dados pessoais?'
    recusa(D, 'ENTREGA-LEI', 'RUB-CALCULO-01')


def convite_de_teste():
    """Um tipo 'copy' de teste (o real ainda não existe): copia de outro tipo, limpo de ganho e de cálculo."""
    copia = copy.deepcopy(BASE['entregas']['plano_de_projeto'])
    copia['tipo'], copia['dono'], copia['servico'] = 'copy', 'ISABELA', 'SRV-COPY'
    copia['entrada_minima'] = [e for e in copia['entrada_minima'] if e['de_onde'] != 'ENTREGA_APROVADA']
    return copia


def test_convite_de_teste_comeca_limpo():
    D = com('entregas')
    D['entregas']['copy'] = convite_de_teste()
    assert v.rodar(D, so={'C-11-GANHO', 'C-11-CALCULO'}) == []


def test_C_11_GANHO_secao_sobre_ganho():
    D = com('entregas')
    D['entregas']['copy'] = convite_de_teste()
    D['entregas']['copy']['secoes'][0]['titulo'] = 'Quanto você ganha por hora'
    recusa(D, 'C-11-GANHO', 'termo de ganho')


def test_C_11_GANHO_coluna_de_renda():
    D = com('entregas')
    D['entregas']['copy'] = convite_de_teste()
    D['entregas']['copy']['secoes'].append({'id': 'quadro', 'titulo': 'Quadro', 'tipo_de_campo': 'tabela', 'obrigatoria': False,
                                            'colunas': [{'id': 'renda_mensal', 'tipo_de_campo': 'numero'}]})
    recusa(D, 'C-11-GANHO', "'renda_mensal'")


def test_C_11_CALCULO_convite_com_entrada_de_calculo():
    D = com('entregas')
    D['entregas']['copy'] = convite_de_teste()
    D['entregas']['copy']['entrada_minima'].append(
        {'id': 'ENT-COPY-CALCULO', 'o_que': 'Resultado do cálculo do Caio', 'de_onde': 'ENTREGA_APROVADA', 'se_faltar': 'PERGUNTAR'})
    recusa(D, 'C-11-CALCULO', 'ENT-COPY-CALCULO')


# ---------------------------------------------------------------------------------------
# ROTEIROS (v3.1): a meta das 10 pessoas, montada aqui
# ---------------------------------------------------------------------------------------
ROTEIRO = {
    'id': 'recrutar-10-pessoas', 'versao': '3.1.0', 'nome': 'Recrutar as primeiras 10 pessoas na Mimix e no Hub',
    'empresas': ['BIZ-003'], 'prazo_sugerido_dias': 7, 'decisoes': ['DEC-024', 'DEC-025'],
    'entradas_externas': {'condicoes_participante': 'JOB-HR-f6d55eff0523a50f07397cffbfbe313d'},
    'orcamento_meta': {'chamadas_total': 100, 'buscas': 0, 'partes_de_pagina': 30, 'execucoes': 30},
    'etapas': [
        {'id': 'E1', 'servico': 'SRV-CALCULO', 'objetivo': 'Conta da receita com 10 pessoas, em três cenários.',
         'entradas': ['condicoes_participante'], 'depende_de': []},
        {'id': 'E2', 'servico': 'SRV-ROTEIRO-TREINAMENTO', 'objetivo': 'Como gravar atividades com qualidade e privacidade.',
         'entradas': ['condicoes_participante'], 'depende_de': []},
        {'id': 'E3', 'servico': 'SRV-COPY', 'objetivo': 'Convite para as primeiras 10 pessoas, sem promessa de renda.',
         'entradas': ['condicoes_participante'], 'depende_de': []},
        {'id': 'E4', 'servico': 'SRV-PARECER', 'objetivo': 'O convite e o roteiro podem ser usados? Riscos e ajustes por peça.',
         'entradas': ['E2', 'E3', 'condicoes_participante'], 'depende_de': ['E2', 'E3'], 'julga': ['E2', 'E3'],
         'se_semaforo': {'AJUSTE': {'refazer': ['E2', 'E3'], 'max_ciclos': 2}, 'NAO_PODE': {'aguardar_fundador': True}}},
        {'id': 'E5', 'servico': 'SRV-RELATORIO-FINAL', 'objetivo': 'Plano dos 7 dias com o que só você faz.',
         'entradas': ['E1', 'E2', 'E3', 'E4'], 'depende_de': ['E1', 'E2', 'E3', 'E4']},
    ],
    'acoes_do_fundador': [
        {'etapa': 'E2', 'acao_do_fundador': 'AF-TREINAMENTO-ENVIAR', 'descricao': 'Enviar o roteiro de treinamento aprovado.'},
        {'etapa': 'E3', 'acao_do_fundador': 'AF-COPY-ENVIAR-OU-PUBLICAR', 'descricao': 'Enviar o convite aprovado.'},
    ],
    'passos_fixos_do_fundador': [
        {'id': 'PF-01', 'texto': 'Cadastrar a Humano Digital na Mimix e no Hub.', 'categorias': ['CADASTRO'], 'coberto_pelo_parecer': 'E4'},
    ],
}
TAGS_DE_ROTEIRO = {'ESQUEMA-ROTEIRO', 'ROTEIRO-ANTIGO', 'ROTEIRO-SERVICO', 'ROTEIRO-GRAFO', 'ROTEIRO-RELATORIO', 'ROTEIRO-JULGA', 'MAT-05-ROTEIRO',
                   'ROTEIRO-SEMPRE-JULGADO', 'MAT-16', 'ROTEIRO-PULAVEL', 'ROTEIRO-ACOES-FUNDADOR', 'ROTEIRO-PASSO-FIXO', 'MAT-21',
                   'ROTEIRO-ORCAMENTO'}


def ficha_de_teste_da_isabela():
    """A ficha v3.1 da Isabela ainda não existe; o orçamento do roteiro só precisa destes números."""
    orcamento = {'buscas': 0, 'partes_de_pagina': 0, 'chamadas_total': 3, 'tempo_s': 300}
    return {'servicos': [{'servico': 'SRV-COPY', 'orcamento': orcamento}, {'servico': 'SRV-ROTEIRO-TREINAMENTO', 'orcamento': orcamento}],
            'revisao': {'orcamento': {'chamadas_total': 3, 'tempo_s': 300}}}


def com_roteiro(*chaves):
    D = com('roteiros', 'fichas', *chaves)
    D['roteiros'] = {'recrutar-10-pessoas.yaml': copy.deepcopy(ROTEIRO)}
    D['fichas']['ISABELA'] = ficha_de_teste_da_isabela()
    return D


def etapa(D, eid):
    return next(e for e in D['roteiros']['recrutar-10-pessoas.yaml']['etapas'] if e['id'] == eid)


def roteiro(D):
    return D['roteiros']['recrutar-10-pessoas.yaml']


def test_roteiro_de_teste_comeca_limpo():
    assert v.rodar(com_roteiro(), so=TAGS_DE_ROTEIRO) == []


def test_ESQUEMA_ROTEIRO():
    D = com_roteiro()
    del roteiro(D)['orcamento_meta']
    recusa(D, 'ESQUEMA-ROTEIRO', "falta o campo 'orcamento_meta'")


def test_ESQUEMA_ROTEIRO_parecer_sem_caminho_de_ajuste():
    D = com_roteiro()
    del etapa(D, 'E4')['se_semaforo']['AJUSTE']
    recusa(D, 'ESQUEMA-ROTEIRO', "falta o campo 'AJUSTE'")


def test_ROTEIRO_ANTIGO_sem_versao():
    D = com_roteiro()
    D['roteiros'] = {'meta-nova.yaml': copy.deepcopy(ROTEIRO)}              # nome novo: o roteiro real da v1 já acusa o dele
    del D['roteiros']['meta-nova.yaml']['versao']
    recusa(D, 'ROTEIRO-ANTIGO', 'playbooks/meta-nova.yaml: [ROTEIRO-ANTIGO] roteiro no formato antigo')


def test_ROTEIRO_ANTIGO_o_roteiro_real_ainda_e_da_v1():
    assert any('recrutar-10-pessoas.yaml' in e for e in erros_da_base('ROTEIRO-ANTIGO'))


def test_ROTEIRO_SERVICO_inexistente():
    D = com_roteiro()
    etapa(D, 'E1')['servico'] = 'SRV-NAO-EXISTE'
    recusa(D, 'ROTEIRO-SERVICO', 'não existe no catálogo')


def test_ROTEIRO_SERVICO_ainda_nao_recebe_card():
    D = com_roteiro()
    etapa(D, 'E1')['servico'] = 'SRV-PLANO-DE-PROJETO'                      # RASCUNHO
    recusa(D, 'ROTEIRO-SERVICO', 'ainda não recebe card')


def test_ROTEIRO_SERVICO_empresa_que_o_servico_nao_atende():
    D = com_roteiro()
    roteiro(D)['empresas'] = ['BIZ-001']                                    # o cálculo e o convite atendem só BIZ-003 e BIZ-004
    recusa(D, 'ROTEIRO-SERVICO', 'não atende BIZ-001')


def test_ROTEIRO_SERVICO_empresa_sem_pacote_confirmado():
    D = com_roteiro('organograma')
    roteiro(D)['empresas'] = ['BIZ-003', 'BIZ-004']
    D['organograma']['empresas']['BIZ-004']['pacote']['estado'] = 'NAO_CONFIRMADO'
    recusa(D, 'ROTEIRO-SERVICO', 'BIZ-004 não tem pacote CONFIRMADO')


def test_ROTEIRO_GRAFO_dependencia_que_nao_existe():
    D = com_roteiro()
    etapa(D, 'E1')['depende_de'] = ['E9']
    recusa(D, 'ROTEIRO-GRAFO', 'E9, que não existe')


def test_ROTEIRO_GRAFO_ciclo():
    D = com_roteiro()
    etapa(D, 'E1')['depende_de'] = ['E5']
    recusa(D, 'ROTEIRO-GRAFO', 'ciclo de dependência')


def test_ROTEIRO_GRAFO_entrada_sem_dependencia():
    D = com_roteiro()
    etapa(D, 'E4')['depende_de'] = ['E2']                                   # usa E3 como entrada sem depender
    recusa(D, 'ROTEIRO-GRAFO', 'usa E3 como entrada sem depender dela')


def test_ROTEIRO_GRAFO_entrada_que_nao_e_etapa_nem_externa():
    D = com_roteiro()
    etapa(D, 'E1')['entradas'] = ['pesquisa_que_nao_existe']
    recusa(D, 'ROTEIRO-GRAFO', 'não é etapa nem entrada externa')


def test_ROTEIRO_RELATORIO_sem_relatorio_final():
    D = com_roteiro()
    roteiro(D)['etapas'].pop()
    recusa(D, 'ROTEIRO-RELATORIO', 'exatamente 1 etapa SRV-RELATORIO-FINAL')


def test_ROTEIRO_RELATORIO_relatorio_que_nao_e_o_ultimo():
    D = com_roteiro()
    e = roteiro(D)['etapas']
    e[3], e[4] = e[4], e[3]
    recusa(D, 'ROTEIRO-RELATORIO', 'deve ser a última etapa')


def test_ROTEIRO_RELATORIO_relatorio_que_nao_depende_de_todas():
    D = com_roteiro()
    etapa(D, 'E5')['depende_de'] = ['E1', 'E2', 'E3']
    recusa(D, 'ROTEIRO-RELATORIO', 'depender de todas as outras')


def test_ROTEIRO_JULGA_tipo_que_o_parecer_nao_julga():
    D = com_roteiro()
    etapa(D, 'E4')['julga'] = ['E2', 'E3', 'E1']                            # E1 é cálculo
    etapa(D, 'E4')['depende_de'] = ['E1', 'E2', 'E3']
    recusa(D, 'ROTEIRO-JULGA', "do tipo 'calculo', que o parecer não julga")


def test_ROTEIRO_JULGA_sem_depender_do_que_julga():
    D = com_roteiro()
    etapa(D, 'E4')['depende_de'] = ['E2']
    recusa(D, 'ROTEIRO-JULGA', 'julga E3 sem depender dela')


def test_ROTEIRO_JULGA_ajuste_que_nao_refaz_o_julgado():
    D = com_roteiro()
    etapa(D, 'E4')['se_semaforo']['AJUSTE']['refazer'] = ['E2']
    recusa(D, 'ROTEIRO-JULGA', 'o AJUSTE deve refazer exatamente')


def test_MAT_05_ROTEIRO_parecer_recebe_calculo():
    D = com_roteiro()
    etapa(D, 'E4')['entradas'].append('E1')
    etapa(D, 'E4')['depende_de'].append('E1')
    recusa(D, 'MAT-05-ROTEIRO', "não pode receber 'E1'")


def test_ROTEIRO_SEMPRE_JULGADO_etapa_sem_parecer():
    D = com_roteiro()
    etapa(D, 'E4')['julga'] = ['E2']
    etapa(D, 'E4')['se_semaforo']['AJUSTE']['refazer'] = ['E2']
    recusa(D, 'ROTEIRO-SEMPRE-JULGADO', 'E3 (SRV-COPY) é sempre julgado')


def test_MAT_16_convite_recebe_o_calculo():
    D = com_roteiro()
    etapa(D, 'E3')['entradas'].append('E1')
    etapa(D, 'E3')['depende_de'].append('E1')
    recusa(D, 'MAT-16', 'o convite recebe o cálculo')


def test_ROTEIRO_PULAVEL_servico_que_nao_pode_ser_pulado():
    D = com_roteiro()
    etapa(D, 'E5')['pulavel'] = True
    recusa(D, 'ROTEIRO-PULAVEL', 'não pode ser pulado')


def test_ROTEIRO_PULAVEL_etapa_julgada():
    D = com_roteiro('servicos')
    servico(D, 'SRV-ROTEIRO-TREINAMENTO')['pode_ser_pulada'] = True         # o serviço até permitiria...
    etapa(D, 'E2')['pulavel'] = True                                        # ...mas o parecer E4 julga a E2
    recusa(D, 'ROTEIRO-PULAVEL', 'etapa julgada nunca é pulável')


def test_ROTEIRO_ACOES_FUNDADOR_acao_fora_da_lista_do_servico():
    D = com_roteiro()
    roteiro(D)['acoes_do_fundador'][1]['acao_do_fundador'] = 'AF-VENDAS-CONTATAR'     # E3 é copy
    recusa(D, 'ROTEIRO-ACOES-FUNDADOR', 'não está na lista do serviço')


def test_ROTEIRO_ACOES_FUNDADOR_no_relatorio_final():
    D = com_roteiro()
    roteiro(D)['acoes_do_fundador'].append({'etapa': 'E5', 'acao_do_fundador': 'AF-COPY-ENVIAR-OU-PUBLICAR', 'descricao': 'Publicar o relatório.'})
    recusa(D, 'ROTEIRO-ACOES-FUNDADOR', 'o relatório final não tem ação do fundador')


def test_ROTEIRO_ACOES_FUNDADOR_duas_na_mesma_etapa():
    D = com_roteiro()
    roteiro(D)['acoes_do_fundador'].append({'etapa': 'E3', 'acao_do_fundador': 'AF-COPY-ENVIAR-OU-PUBLICAR', 'descricao': 'Enviar de novo o convite.'})
    recusa(D, 'ROTEIRO-ACOES-FUNDADOR', 'E3: 2 ações do fundador')


def test_ROTEIRO_ACOES_FUNDADOR_etapa_que_nao_existe():
    D = com_roteiro()
    roteiro(D)['acoes_do_fundador'][0]['etapa'] = 'E9'
    recusa(D, 'ROTEIRO-ACOES-FUNDADOR', 'etapa E9, que não existe')


def test_ROTEIRO_PASSO_FIXO_sem_parecer_que_o_cubra():
    D = com_roteiro()
    roteiro(D)['passos_fixos_do_fundador'][0]['coberto_pelo_parecer'] = 'E1'
    recusa(D, 'ROTEIRO-PASSO-FIXO', 'não é uma etapa do parecer')


def test_MAT_21_etapa_sem_revisor_de_ia_apto():
    D = com_roteiro('servicos')
    D['servicos']['agentes']['CAIO']['revisa']['copy'] = 'SEM_PROVA'         # a reserva (Camila) já era SEM_PROVA
    recusa(D, 'MAT-21', 'nenhum revisor de IA está APTO')


def test_ROTEIRO_ORCAMENTO_meta_pequena_demais():
    D = com_roteiro()
    roteiro(D)['orcamento_meta']['chamadas_total'] = 5
    recusa(D, 'ROTEIRO-ORCAMENTO', 'chamadas_total: as fichas somam')


def test_ROTEIRO_ORCAMENTO_buscas_acima_da_meta():
    D = com_roteiro()
    D['fichas']['CAIO']['servicos'][0]['orcamento']['buscas'] = 4
    recusa(D, 'ROTEIRO-ORCAMENTO', 'buscas: as fichas somam')


def test_ROTEIRO_ORCAMENTO_execucoes_insuficientes():
    D = com_roteiro()
    roteiro(D)['orcamento_meta']['execucoes'] = 4
    recusa(D, 'ROTEIRO-ORCAMENTO', 'precisam de pelo menos 11')


def test_ROTEIRO_ORCAMENTO_ficha_ausente_nao_e_confirmada():
    D = com_roteiro()
    del D['fichas']['ISABELA']
    recusa(D, 'ROTEIRO-ORCAMENTO', 'orçamento NÃO CONFIRMADO')


# ---------------------------------------------------------------------------------------
# CASOS
# ---------------------------------------------------------------------------------------
def test_CASOS_BOAS_menos_de_3():
    D = com('casos')
    boas = D['casos']['SRV-CALCULO']['boas']
    for nome in list(boas)[2:]:
        del boas[nome]
    recusa(D, 'CASOS-BOAS', 'casos/SRV-CALCULO: [CASOS-BOAS] 2 caso(s) bom(ns)')


def test_CASOS_DEFEITOS_menos_de_4():
    D = com('casos')
    defeitos = D['casos']['SRV-CALCULO']['defeitos']
    for nome in list(defeitos)[3:]:
        del defeitos[nome]
    recusa(D, 'CASOS-DEFEITOS', 'casos/SRV-CALCULO: [CASOS-DEFEITOS] 3 defeito(s)')


def test_CASOS_servico_com_ficha_sem_casos_e_recusado():
    # Mutação: tira os casos de um serviço cujo dono tem ficha (Clara) e prova que o validador acusa.
    D = com('casos')
    D['casos']['SRV-PARECER'] = {'boas': {}, 'defeitos': {}}
    recusa(D, 'CASOS-BOAS', 'SRV-PARECER')
    recusa(D, 'CASOS-DEFEITOS', 'SRV-PARECER')


def test_CASOS_PASTA_servico_que_nao_existe():
    D = com('casos')
    D['casos']['SRV-NAO-EXISTE'] = {'boas': {}, 'defeitos': {}}
    recusa(D, 'CASOS-PASTA', 'casos/SRV-NAO-EXISTE')


def test_CASOS_DEFEITO_ALVO_checagem_que_nao_existe():
    D = com('casos')
    D['casos']['SRV-CALCULO']['defeitos']['defeito-01-conta-errada.yaml'] = {'deve_falhar_em': 'CHK-NAO-EXISTE', 'resposta': {}}
    recusa(D, 'CASOS-DEFEITO-ALVO', 'CHK-NAO-EXISTE')


def test_CASOS_DEFEITO_ALVO_defeito_sem_alvo():
    D = com('casos')
    nome = next(iter(D['casos']['SRV-CALCULO']['defeitos']))
    del D['casos']['SRV-CALCULO']['defeitos'][nome]['deve_falhar_em']
    recusa(D, 'CASOS-DEFEITO-ALVO', 'não diz em deve_falhar_em')


def test_CASOS_DEFEITO_ALVO_checagem_de_outro_tipo():
    D = com('casos')
    nome = next(iter(D['casos']['SRV-CALCULO']['defeitos']))
    D['casos']['SRV-CALCULO']['defeitos'][nome]['deve_falhar_em'] = 'CHK-PARECER-SO-SECOES'
    recusa(D, 'CASOS-DEFEITO-ALVO', 'CHK-PARECER-SO-SECOES')


def test_CASOS_DEFEITO_ALVO_aceita_a_checagem_comum_e_a_rubrica():
    D = com('casos')
    defeitos = D['casos']['SRV-CALCULO']['defeitos']
    nomes = list(defeitos)
    defeitos[nomes[0]]['deve_falhar_em'] = 'CHK-COMUM-05'
    defeitos[nomes[1]]['deve_falhar_em'] = 'RUB-CALCULO-03'
    assert novos(D, 'CASOS-DEFEITO-ALVO') == []


def test_CASOS_BOA_ALVO_checagem_que_nao_existe():
    D = com('casos')
    D['casos']['SRV-PLANO-DE-PROJETO']['boas']['boa-01.yaml']['deve_passar_em'].append('CHK-NAO-EXISTE')
    recusa(D, 'CASOS-BOA-ALVO', 'CHK-NAO-EXISTE')


# ---------------------------------------------------------------------------------------
# JORNADAS e SEGURANÇA
# ---------------------------------------------------------------------------------------
def test_JORNADA_REPLAY_resultado_diferente_do_esperado():
    D = com('jornadas')
    D['jornadas']['casos/SRV-CALCULO/jornada.yaml']['esperado'] = {'estado_card': 'CANCELADO'}     # na verdade chega a PRONTO
    recusa(D, 'JORNADA-REPLAY', 'esperado CANCELADO')


def test_JORNADA_REPLAY_evento_que_a_tabela_nao_aceita():
    D = com('jornadas')
    j = D['jornadas']['casos/SRV-CALCULO/jornada.yaml']
    j['eventos'].insert(0, {'papel': 'FUNDADOR', 'evento': 'APROVAR', 'alvo': 'card'})            # nada para aprovar no começo
    j['esperado'] = {'recusados': 0}
    recusa(D, 'JORNADA-REPLAY', 'recusados')


def test_JORNADA_REPLAY_jornada_que_o_replay_nao_entende():
    D = com('jornadas')
    D['jornadas']['casos/SRV-CALCULO/jornada.yaml']['roteiro']['etapas'][0]['autor'] = 'SIRLENE'    # personagem, não agente
    recusa(D, 'JORNADA-REPLAY', 'SIRLENE')


def test_JORNADA_REPLAY_todas_as_jornadas_reais_passam():
    assert erros_da_base('JORNADA-REPLAY') == []
    assert len(BASE['jornadas']) >= 10


CHAVE_DE_TESTE = 'eyJ' + 'hbGciOi' + 'JIUzI1NiIsInR5cCI6IkpXVCJ9' + 'a' * 20       # montada aqui para este arquivo não ter chave


def test_SEM_CHAVE_arquivo_com_chave(tmp_path):
    (tmp_path / 'agents').mkdir()
    (tmp_path / 'agents' / 'caio.yaml').write_text(f'conexao: {CHAVE_DE_TESTE}\n', encoding='utf-8')
    achados = v.rodar({'raiz': tmp_path}, so={'SEM-CHAVE'})
    assert achados and 'agents/caio.yaml' in achados[0]
    assert CHAVE_DE_TESTE not in achados[0]                                 # a mensagem nunca repete o valor


def test_SEM_CHAVE_senha_escrita_por_extenso(tmp_path):
    (tmp_path / 'models.yaml').write_text('senha: ' + 'x9' * 15 + '\n', encoding='utf-8')
    recusa({'raiz': tmp_path}, 'SEM-CHAVE', 'senha, token ou segredo')


def test_SEM_CHAVE_o_dado_real_esta_limpo():
    assert erros_da_base('SEM-CHAVE') == []
