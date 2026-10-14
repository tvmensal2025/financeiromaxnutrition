"""Relógio dos prazos (o emissor, orquestrador/relogio.py) contra um banco local de verdade.

O que é: uma volta aplica o que venceu (papel RELOGIO, conta service_role), a segunda volta não repete, o aplicador padrão
não deixa o relógio validar plano sozinho (PLANO_VALIDO é do motor) e banco fora do ar levanta exceção.
Banco PRÓPRIO deste módulo (0001–0006 do suporte + 0017), como em test_durabilidade.py; sem DBOS, sem Hermes.
Como mudar: regra de instante nova é testada em supabase/migrations-v2/testes/test_23_relogio.py; aqui só o emissor.
"""
import socket
import time
from datetime import datetime, timedelta, timezone

import psycopg
import pytest
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from conftest import RAIZ, servidor, suporte  # noqa: F401  (servidor é a fixture do cluster de teste)
from orquestrador.relogio import PAPEL, Relogio, aplicador_do_banco

ROTEIRO = {"etapas": [{"id": "E1", "nome": "só uma", "autor": "CAIO", "revisores": ["CLARA", "HELENA"], "depende_de": [],
                       "julga": [], "internet": False, "pulavel": True, "usa_decisao": True,
                       "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"], "tempo_maximo_s": 900}]}


@pytest.fixture(scope='module')
def banco(servidor):
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute((RAIZ / 'supabase/migrations-v2/0017_relogio.sql').read_text(encoding='utf-8'))
        yield b
    finally:
        suporte.derrubar_banco(b)


def _servico(banco):
    """Conexão nova do papel service_role, como motor._con('service_role')."""
    def conectar():
        con = psycopg.connect(banco.url, autocommit=True, row_factory=dict_row)
        con.execute('SET ROLE service_role')
        return con
    return conectar


def _card(banco, numero, pedido_grande=False, prazo_em_s=10 * 86400):
    with banco.conectar() as dono:
        return dono.execute(
            "select helena_v2.criar_card('teste', %s, 'pedido', 'card do relógio', now() + make_interval(secs => %s), %s,"
            " 'eLiving™', '{}'::jsonb, 0, %s)", (numero, prazo_em_s, Jsonb(ROTEIRO), pedido_grande)).fetchone()[0]['card_id']


def _linha(banco, sql, args=()):
    with banco.conectar() as dono:
        dono.row_factory = dict_row
        return dono.execute(sql, args).fetchone()


def _ler_de_volta(banco, card):
    """A Helena lê de volta um pedido pequeno: o card vai para VALIDANDO_PLANO (o motor validaria o plano depois)."""
    with banco.conectar() as dono:
        chave = dono.execute("select helena_v2.abrir_chamada_helena('card', %s)", (card,)).fetchone()[0]
        r = dono.execute("select helena_v2.aplicar_evento('card', %s, 'HELENA', 'LER_DE_VOLTA', '{}'::jsonb, null, %s,"
                         " p_nao_disparar => array['PLANO_VALIDO'])", (card, chave)).fetchone()[0]
    assert r['resultado'] == 'APLICADO' and r['estado'] == 'VALIDANDO_PLANO', r


def test_uma_volta_aplica_e_a_segunda_nao_repete(banco):
    card = _card(banco, 'relogio-volta')
    ate = _linha(banco, 'select prazo_ate from helena_v2.card where id = %s', (card,))['prazo_ate']
    conexao = _servico(banco)
    relogio = Relogio(conexao, aplicador_do_banco(conexao))
    assert [e for e in relogio.uma_volta(ate - timedelta(microseconds=1)).eventos if e.card_id == card] == []

    resumo = relogio.uma_volta(ate)
    deste = [(e.maquina, e.alvo_id, e.evento, e.vencimento) for e in resumo.eventos if e.card_id == card]
    assert deste == [('card', card, 'TEMPO_ESGOTADO', ate)]
    assert resumo.aplicados == resumo.devidos >= 1 and resumo.recusados == 0 and resumo.recusas == []
    assert _linha(banco, 'select estado, motivo from helena_v2.card where id = %s', (card,)) == {
        'estado': 'ESPERANDO_CONFIRMACAO', 'motivo': 'HELENA_FALHOU'}
    assert _linha(banco, "select linha_id, conta, resultado from helena_v2.historico where alvo_id = %s and papel = %s",
                  (card, PAPEL)) == {'linha_id': 'C05', 'conta': 'service_role', 'resultado': 'APLICADO'}

    segunda = relogio.uma_volta(ate)
    assert [e for e in segunda.eventos if e.card_id == card] == []
    with banco.conectar() as dono:
        assert dono.execute("select count(*) from helena_v2.historico where alvo_id = %s and papel = %s",
                            (card, PAPEL)).fetchone()[0] == 1


def test_aplicador_padrao_nao_valida_plano_sozinho(banco):
    card = _card(banco, 'relogio-plano')
    _ler_de_volta(banco, card)
    ate = _linha(banco, 'select prazo_ate from helena_v2.card where id = %s', (card,))['prazo_ate']
    conexao = _servico(banco)
    resumo = Relogio(conexao, aplicador_do_banco(conexao)).uma_volta(ate)
    assert [(e.evento, e.card_id) for e in resumo.eventos if e.card_id == card] == [('TEMPO_ESGOTADO', card)]
    # C30: o validador (código nosso) não respondeu em 60 s, roda de novo; o plano NÃO vale sem o motor
    assert _linha(banco, 'select estado, validacoes from helena_v2.card where id = %s', (card,)) == {
        'estado': 'VALIDANDO_PLANO', 'validacoes': 1}
    assert _linha(banco, "select count(*) as n from helena_v2.historico where alvo_id = %s and evento = 'PLANO_VALIDO'",
                  (card,))['n'] == 0

    # contraprova: aplicar sem a lista de não disparar deixaria o automático PLANO_VALIDO passar o card adiante
    outro = _card(banco, 'relogio-plano-contraprova')
    _ler_de_volta(banco, outro)
    with conexao() as con:
        con.execute("select helena_v2.aplicar_evento('card', %s, 'RELOGIO', 'TEMPO_ESGOTADO')", (outro,))
    assert _linha(banco, 'select estado from helena_v2.card where id = %s', (outro,))['estado'] == 'EM_ANDAMENTO'


def test_evento_que_deixou_de_estar_devido_no_meio_da_volta_e_pulado(banco):
    a = _card(banco, 'relogio-meio-a')
    b = _card(banco, 'relogio-meio-b')
    agora = _linha(banco, 'select prazo_ate from helena_v2.card where id = %s', (b,))['prazo_ate']
    conexao = _servico(banco)
    padrao = aplicador_do_banco(conexao)

    def aplicar(maquina, alvo_id, papel, evento):
        resposta = padrao(maquina, alvo_id, papel, evento)
        if alvo_id == a:            # enquanto o relógio aplicava A, o fundador cancelou B
            with banco.conectar() as dono:
                assert dono.execute("select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR')",
                                    (b,)).fetchone()[0]['resultado'] == 'APLICADO'
        return resposta

    resumo = Relogio(conexao, aplicar).uma_volta(agora)
    assert [e.card_id for e in resumo.eventos if e.card_id in (a, b)] == [a, b]
    assert resumo.obsoletos >= 1 and resumo.recusados == 0
    assert _linha(banco, 'select estado from helena_v2.card where id = %s', (a,))['estado'] == 'ESPERANDO_CONFIRMACAO'
    assert _linha(banco, 'select estado from helena_v2.card where id = %s', (b,))['estado'] == 'CANCELADO'
    assert _linha(banco, "select count(*) as n from helena_v2.historico where alvo_id = %s and papel = %s",
                  (b, PAPEL))['n'] == 0      # nada caiu no estado novo de B, nem como recusa


def _porta_fechada():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def test_banco_indisponivel_levanta_e_nada_fica_em_silencio(banco):
    porta = _porta_fechada()

    def fora_do_ar():
        return psycopg.connect(host='127.0.0.1', port=porta, dbname='postgres', user='postgres', connect_timeout=2)

    def nunca(*_args):
        raise AssertionError('não devia aplicar nada')

    with pytest.raises(psycopg.OperationalError):
        Relogio(fora_do_ar, nunca).uma_volta()
    with pytest.raises(psycopg.OperationalError):
        Relogio(fora_do_ar, nunca).uma_volta(datetime.now(timezone.utc))

    # o banco cai entre a leitura e a aplicação: a exceção sobe, não vira "recusado"
    _card(banco, 'relogio-queda')
    conexao = _servico(banco)

    def cai(*_args):
        raise psycopg.OperationalError('servidor fechou a conexão (simulado)')

    longe = datetime.now(timezone.utc) + timedelta(days=30)
    with pytest.raises(psycopg.OperationalError):
        Relogio(conexao, cai).uma_volta(longe)
    # resposta que não é a de aplicar_evento também não passa calada
    with pytest.raises(TypeError):
        Relogio(conexao, lambda *_a: None).uma_volta(longe)
    with pytest.raises(ValueError):
        Relogio(conexao, nunca).uma_volta(datetime.now())          # sem fuso: ambíguo


def test_comando_relogio_uma_volta_aplica_o_prazo_vencido_e_mostra_so_contagens(banco, monkeypatch, capsys):
    """`python -m orquestrador relogio --uma-volta` ponta a ponta contra o banco local (o abridor de produção é trocado
    por um que aponta para o banco de teste, porque o de produção só aceita a URL canônica com TLS)."""
    import json

    import orquestrador.__main__ as cli
    card = _card(banco, 'relogio-comando', prazo_em_s=1)      # o prazo é de 1 s: já venceu quando o comando rodar
    time.sleep(1.5)
    conectar = _servico(banco)
    aberturas = []

    class BancoDeTeste:
        def _con(self, papel):
            assert papel == 'service_role'
            return conectar()

        def fechar(self):
            aberturas.append('fechado')

    monkeypatch.setattr(cli, '_abrir_banco_service_role', lambda *, somente_leitura: (aberturas.append(somente_leitura), BancoDeTeste())[1])
    monkeypatch.setattr(cli, 'Motor', lambda *a, **k: pytest.fail('o relógio não pode abrir o Motor do Hermes'))
    assert cli.main(['relogio', '--uma-volta']) == 0
    saida = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert aberturas == [False, 'fechado']                  # o relógio grava (não é somente leitura) e fecha o banco
    assert saida['estado'] == 'VOLTA_FEITA' and saida['aplicados'] >= 1 and saida['recusados'] == 0
    assert 'PRAZO_VENCIDO' in saida['eventos'] and card not in json.dumps(saida)      # só contagens e nomes de evento
    assert _linha(banco, 'select estado, nivel_prazo from helena_v2.card where id = %s', (card,)) == {
        'estado': 'RASCUNHO', 'nivel_prazo': 2}                 # C23 (amarelo) e C24 (vencido): sobe o nível, o estado fica
    assert cli.main(['relogio', '--uma-volta']) == 0         # a segunda volta não repete o que já foi aplicado
    segunda = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert 'PRAZO_VENCIDO' not in segunda['eventos'] and _linha(
        banco, "select count(*) as n from helena_v2.historico where alvo_id = %s and papel = %s", (card, PAPEL))['n'] == 2


def test_comando_relogio_banco_fora_do_ar_sai_com_erro_sem_mostrar_a_causa_inteira(banco, monkeypatch, capsys):
    import json

    import orquestrador.__main__ as cli
    porta = _porta_fechada()

    class BancoQueCai:
        def _con(self, papel):
            return psycopg.connect(host='127.0.0.1', port=porta, dbname='postgres', user='postgres', connect_timeout=2)

        def fechar(self):
            pass

    monkeypatch.setattr(cli, '_abrir_banco_service_role', lambda *, somente_leitura: BancoQueCai())
    assert cli.main(['relogio', '--uma-volta']) == 1
    saida = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert saida == {'estado': 'VOLTA_COM_ERRO', 'tipo': 'OperationalError'}


def test_comando_relogio_sem_database_url_falha_fechado(monkeypatch, capsys):
    import json

    import orquestrador.__main__ as cli
    monkeypatch.delenv('HELENA_V2_DATABASE_URL', raising=False)
    assert cli.main(['relogio', '--uma-volta']) == 1
    assert json.loads(capsys.readouterr().out.strip().splitlines()[-1])['estado'] == 'FALHA_DE_RUNTIME'
    with pytest.raises(SystemExit):
        cli.main(['relogio', '--uma-volta', '--intervalo', '0'])
