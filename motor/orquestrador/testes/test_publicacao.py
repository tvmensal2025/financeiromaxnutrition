"""Trabalhador de publicação (orquestrador/publicacao.py) contra o banco local da migration 0018, com destino FALSO.

O que prova: o destino é chamado UMA vez por pedido; erro do destino vira FALHOU com texto limpo e nunca PUBLICADA; falha ao
registrar deixa EM_EXECUCAO sem repetir o destino; pedido EM_EXECUCAO parado não é retentado e vira alarme; dois
trabalhadores no mesmo pedido acionam o destino uma só vez. Não existe destino real (NÃO CONFIRMADO). Nada toca em banco remoto.
"""
import threading

import psycopg
import pytest
from psycopg.rows import dict_row

from conftest import RAIZ, servidor, suporte  # noqa: F401  (servidor é a fixture do cluster de teste)
from orquestrador.publicacao import (EM_EXECUCAO_PARADA_APOS_S, FALHOU, NAO_REGISTRADO, PUBLICADA, SEM_PEDIDO, Destino,
                                     DestinoFalso, Pedido, Publicador, alarmes_de_publicacao)
from orquestrador.vigilancia import ALTA


# BANCO PRÓPRIO deste arquivo (mesmo padrão de test_durabilidade.py): a tabela de pedidos é esvaziada a cada teste.
@pytest.fixture(scope='module')
def banco(servidor):
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute((RAIZ / 'supabase/migrations-v2/0018_publicacao_execucao.sql').read_text(encoding='utf-8'))
        yield b
    finally:
        suporte.derrubar_banco(b)


@pytest.fixture(autouse=True)
def vazio(banco):
    with banco.conectar() as dono:
        dono.execute('TRUNCATE helena_v2.publicacoes RESTART IDENTITY')


def _conexao_do_motor(banco, **opcoes):
    con = psycopg.connect(banco.url, autocommit=opcoes.pop('autocommit', True), **opcoes)
    con.execute('SET ROLE service_role')
    if not con.autocommit:
        con.commit()
    return con


@pytest.fixture()
def motor(banco):
    con = _conexao_do_motor(banco, row_factory=dict_row)          # como o Motor conecta
    yield con
    con.close()


def semear(banco, quantos=1, dias_antes=0):
    """Pedidos PEDIDA de dias diferentes; o primeiro é o mais antigo. Devolve os ids na ordem de idade."""
    ids = []
    with banco.conectar() as dono:
        for i in range(quantos):
            ids.append(dono.execute(
                "INSERT INTO helena_v2.publicacoes (solicitado_por, pedido_em, dia_brasilia) VALUES "
                "(%s, now() - make_interval(hours => %s), (now() AT TIME ZONE 'America/Sao_Paulo')::date - %s) RETURNING id",
                (suporte.FUNDADOR_TESTE, quantos - i, quantos - i + dias_antes)).fetchone()[0])
    return ids


def estado(banco, pid):
    with banco.conectar() as dono:
        return dono.execute('SELECT estado, destino, versao_publicada, concluida_em, falhou_em, erro FROM helena_v2.publicacoes WHERE id=%s',
                            (pid,)).fetchone()


class ConexaoQueQuebra:
    """Repassa tudo à conexão real, mas a consulta que contém `trecho` perde a conexão (simula o banco caindo no registro)."""

    def __init__(self, real, trecho):
        self.real, self.trecho = real, trecho

    def transaction(self):
        return self.real.transaction()

    def execute(self, consulta, parametros=()):
        if self.trecho in consulta:
            raise psycopg.OperationalError('conexão perdida postgresql://usuario:SENHA_FALSA_9@host.exemplo/db')
        return self.real.execute(consulta, parametros)


# --------------------------------------------------------------------------------------------------- caminho feliz
def test_sem_pedido_nao_chama_o_destino(motor):
    destino = DestinoFalso()
    assert Publicador(motor, destino).uma_volta().estado == SEM_PEDIDO
    assert destino.publicados == []


def test_pedido_vira_publicada_com_a_versao_do_destino_e_chama_o_destino_uma_vez(banco, motor):
    pid = semear(banco)[0]
    destino = DestinoFalso()
    resultado = Publicador(motor, destino).uma_volta()
    assert (resultado.estado, resultado.pedido_id, resultado.versao) == (PUBLICADA, pid, f'falso-{pid}')
    assert [p.id for p in destino.publicados] == [pid]
    assert not hasattr(destino.publicados[0], 'solicitado_por')           # o destino não sabe quem pediu
    assert estado(banco, pid)[:3] == ('PUBLICADA', 'FALSO_DE_TESTE', f'falso-{pid}')
    assert Publicador(motor, destino).uma_volta().estado == SEM_PEDIDO     # nada mais a fazer; o destino não é chamado de novo
    assert len(destino.publicados) == 1


def test_varios_pedidos_o_mais_antigo_primeiro_cada_um_uma_vez(banco, motor):
    ids = semear(banco, 3)
    destino = DestinoFalso()
    publicador = Publicador(motor, destino)
    voltas = [publicador.uma_volta() for _ in range(4)]
    assert [v.estado for v in voltas] == [PUBLICADA, PUBLICADA, PUBLICADA, SEM_PEDIDO]
    assert [v.pedido_id for v in voltas[:3]] == ids
    assert [p.id for p in destino.publicados] == ids


def test_funciona_com_linhas_em_tupla_e_com_conexao_sem_autocommit(banco):
    pid = semear(banco)[0]
    with _conexao_do_motor(banco) as tupla:                               # sem dict_row
        assert Publicador(tupla, DestinoFalso()).uma_volta().estado == PUBLICADA
    assert estado(banco, pid)[0] == 'PUBLICADA'
    outro = semear(banco, dias_antes=10)[0]
    with _conexao_do_motor(banco, autocommit=False, row_factory=dict_row) as manual:
        assert Publicador(manual, DestinoFalso()).uma_volta().estado == PUBLICADA
    assert estado(banco, outro)[0] == 'PUBLICADA'                         # confirmado: outra conexão enxerga


# ------------------------------------------------------------------------------------------------ erro do destino
def test_erro_do_destino_vira_falhou_com_texto_limpo_e_nunca_publicada(banco, motor):
    pid = semear(banco)[0]
    falha = RuntimeError('saiu com postgresql://usuario:SENHA_FALSA_9@host.exemplo/db senha=EXEMPLO_NAO_REAL_1 ' + 'x' * 500)
    destino = DestinoFalso(falha=falha)
    resultado = Publicador(motor, destino).uma_volta()
    assert (resultado.estado, resultado.pedido_id, resultado.versao) == (FALHOU, pid, None)
    estado_final, destino_final, versao, concluida_em, falhou_em, erro = estado(banco, pid)
    assert estado_final == 'FALHOU' and destino_final is None and versao is None and concluida_em is None and falhou_em is not None
    assert erro == resultado.erro and erro.startswith('RuntimeError: saiu com [REMOVIDO:URL_COM_SENHA]')
    assert 'SENHA_FALSA_9' not in erro and 'EXEMPLO_NAO_REAL_1' not in erro and len(erro) <= 300


def test_falhou_nao_repete_o_destino_nem_vira_publicada(banco, motor):
    pid = semear(banco)[0]
    destino = DestinoFalso(falha=ConnectionError('destino fora do ar'))
    publicador = Publicador(motor, destino)
    assert publicador.uma_volta().estado == FALHOU
    for _ in range(3):
        assert publicador.uma_volta().estado == SEM_PEDIDO
    assert len(destino.publicados) == 1
    assert estado(banco, pid)[0] == 'FALHOU'


@pytest.mark.parametrize('devolvido', [None, '', '   ', 42])
def test_destino_que_nao_devolve_versao_valida_falha_e_nao_publica(banco, motor, devolvido):
    pid = semear(banco)[0]
    resultado = Publicador(motor, DestinoFalso(versao=devolvido)).uma_volta()
    assert resultado.estado == FALHOU and 'não devolveu a versão' in resultado.erro
    assert estado(banco, pid)[:3] == ('FALHOU', None, None)


def test_versao_com_cara_de_segredo_e_limpa_antes_de_guardar(banco, motor):
    pid = semear(banco)[0]
    resultado = Publicador(motor, DestinoFalso(versao='v1-sk-' + 'A' * 24)).uma_volta()
    assert resultado.estado == PUBLICADA and 'A' * 24 not in resultado.versao
    assert 'A' * 24 not in estado(banco, pid)[2]


def test_interrupcao_do_processo_nao_vira_falhou_fica_em_execucao(banco, motor):
    pid = semear(banco)[0]
    destino = DestinoFalso(falha=KeyboardInterrupt())
    with pytest.raises(KeyboardInterrupt):
        Publicador(motor, destino).uma_volta()
    assert estado(banco, pid)[0] == 'EM_EXECUCAO'                          # não se sabe se o destino agiu
    assert Publicador(motor, destino).uma_volta().estado == SEM_PEDIDO     # e ninguém o repete
    assert len(destino.publicados) == 1


# -------------------------------------------------------------------- registro que falha: nunca repete o destino
def test_conclusao_que_nao_foi_registrada_deixa_em_execucao_e_nao_repete_o_destino(banco, motor):
    pid = semear(banco)[0]
    destino = DestinoFalso()
    resultado = Publicador(ConexaoQueQuebra(motor, 'concluir_publicacao'), destino).uma_volta()
    assert (resultado.estado, resultado.pedido_id) == (NAO_REGISTRADO, pid)
    assert 'SENHA_FALSA_9' not in resultado.erro and resultado.erro.startswith('OperationalError')
    assert estado(banco, pid)[0] == 'EM_EXECUCAO'                          # nunca PUBLICADA sem o banco saber
    assert Publicador(motor, destino).uma_volta().estado == SEM_PEDIDO     # o próximo trabalhador não o pega
    assert len(destino.publicados) == 1


def test_falha_ao_registrar_a_falha_deixa_em_execucao(banco, motor):
    pid = semear(banco)[0]
    destino = DestinoFalso(falha=RuntimeError('destino recusou'))
    resultado = Publicador(ConexaoQueQuebra(motor, 'falhar_publicacao'), destino).uma_volta()
    assert (resultado.estado, resultado.pedido_id) == (NAO_REGISTRADO, pid)
    assert estado(banco, pid)[0] == 'EM_EXECUCAO' and len(destino.publicados) == 1


def test_falha_ao_reivindicar_sobe_e_o_destino_nao_e_chamado(banco, motor):
    semear(banco)
    destino = DestinoFalso()
    with pytest.raises(psycopg.OperationalError):
        Publicador(ConexaoQueQuebra(motor, 'reivindicar_publicacao'), destino).uma_volta()
    assert destino.publicados == [] and Publicador(motor, destino).uma_volta().estado == PUBLICADA


# ------------------------------------------------------------------------------------ pedido parado vira alarme
def test_pedido_em_execucao_parado_nao_e_retentado_e_vira_alarme(banco, motor):
    pid = semear(banco)[0]
    with banco.conectar() as dono:                                         # um pedido que ficou EM_EXECUCAO há 2 h (o dono pula o gatilho)
        dono.execute('SET session_replication_role = replica')
        dono.execute("UPDATE helena_v2.publicacoes SET estado='EM_EXECUCAO', iniciada_em=now() - interval '2 hours' WHERE id=%s", (pid,))
    destino = DestinoFalso()
    assert Publicador(motor, destino).uma_volta().estado == SEM_PEDIDO and destino.publicados == []
    alarmes = alarmes_de_publicacao(motor)
    assert len(alarmes) == 1
    alarme = alarmes[0]
    assert (alarme.codigo, alarme.gravidade, alarme.referencia) == ('PUBLICACAO_PARADA', ALTA, str(pid))
    assert 'não será repetido sozinho' in alarme.resumo
    assert estado(banco, pid)[0] == 'EM_EXECUCAO'                          # o alarme só lê


def test_alarme_so_depois_do_prazo_e_so_para_em_execucao(banco, motor):
    ids = semear(banco, 4)
    destino = DestinoFalso()
    Publicador(motor, destino).uma_volta()                                  # PUBLICADA
    Publicador(motor, DestinoFalso(falha=RuntimeError('x'))).uma_volta()    # FALHOU
    Publicador(ConexaoQueQuebra(motor, 'concluir_publicacao'), destino).uma_volta()   # EM_EXECUCAO (acabou de começar)
    assert estado(banco, ids[3])[0] == 'PEDIDA'
    assert alarmes_de_publicacao(motor) == []                               # recente: ainda não é "muito tempo"
    assert EM_EXECUCAO_PARADA_APOS_S >= 600
    assert [a.referencia for a in alarmes_de_publicacao(motor, apos_s=0)] == [str(ids[2])]   # só o EM_EXECUCAO; PEDIDA não
    with _conexao_do_motor(banco) as tupla:
        assert len(alarmes_de_publicacao(tupla, apos_s=0)) == 1


# ----------------------------------------------------------------------------------------- concorrência e papéis
def test_dois_trabalhadores_no_mesmo_pedido_acionam_o_destino_uma_so_vez(banco):
    pid = semear(banco)[0]
    destino = DestinoFalso(demora_s=0.4)                                   # abre a janela para o outro tentar
    barreira = threading.Barrier(2)
    resultados = []

    def trabalhar():
        with _conexao_do_motor(banco, row_factory=dict_row) as con:
            barreira.wait(timeout=30)
            resultados.append(Publicador(con, destino).uma_volta())

    fios = [threading.Thread(target=trabalhar) for _ in range(2)]
    for fio in fios:
        fio.start()
    for fio in fios:
        fio.join(timeout=60)
    assert sorted(r.estado for r in resultados) == sorted([PUBLICADA, SEM_PEDIDO])
    assert [p.id for p in destino.publicados] == [pid]
    assert estado(banco, pid)[0] == 'PUBLICADA'


def test_quem_nao_e_service_role_nao_reivindica_e_o_destino_nao_e_chamado(banco):
    pid = semear(banco)[0]
    destino = DestinoFalso()
    for papel in ('authenticated', 'anon', 'h2t_curioso'):
        with banco.conectar(papel) as pessoa:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                Publicador(pessoa, destino).uma_volta()
    assert destino.publicados == [] and estado(banco, pid)[0] == 'PEDIDA'


# ---------------------------------------------------------------------------------------------- contrato do destino
def test_destino_e_abstrato_e_o_falso_guarda_reversoes():
    with pytest.raises(TypeError):
        Destino()
    falso = DestinoFalso()
    falso.reverter('v-1')
    assert falso.revertidos == ['v-1'] and falso.publicar(Pedido(7, '2026-10-14T00:00:00+00:00', '2026-10-14')) == 'falso-7'
