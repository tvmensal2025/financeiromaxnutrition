import json
from datetime import datetime, timezone

import pytest

from orquestrador.__main__ import main


def test_worker_exige_urls_explicitas(monkeypatch):
    monkeypatch.delenv('HELENA_V2_CONFIG_DATABASE_URL', raising=False)
    monkeypatch.delenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', raising=False)
    with pytest.raises(SystemExit) as erro:
        main(['validar-configuracoes'])
    assert erro.value.code == 2


def test_worker_recusa_banco_remoto_antes_de_conectar(monkeypatch):
    monkeypatch.setenv('HELENA_V2_CONFIG_DATABASE_URL', 'postgresql://postgres@banco.exemplo.org/card')
    monkeypatch.setenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'postgresql://postgres@localhost/dbos')
    with pytest.raises(ValueError, match='local'):
        main(['validar-configuracoes'])


@pytest.mark.parametrize('comando', ['validar-configuracoes', 'registrar-base-tecnica'])
def test_comandos_de_manutencao_nao_iniciam_dbos(monkeypatch, comando, capsys):
    import orquestrador.__main__ as cli

    class MotorEspiao:
        def __init__(self, *_urls, **opcoes):
            assert opcoes['iniciar_dbos'] is False
            self.fechado = False

        def _configuracao_tecnica(self):
            return {'id': 'revisao-teste', 'estado': 'VALIDADA'}

        def processar_configuracoes_pendentes(self):
            return []

        def fechar(self):
            self.fechado = True

    monkeypatch.setenv('HELENA_V2_CONFIG_DATABASE_URL', 'postgresql://postgres@localhost/card')
    monkeypatch.setenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'postgresql://postgres@localhost/dbos')
    monkeypatch.setattr(cli, 'Motor', MotorEspiao)
    assert main([comando]) == 0
    assert capsys.readouterr().out


PEDIDO_ID = '11111111-1111-4111-8111-111111111111'
CARD_ID = '22222222-2222-4222-8222-222222222222'
REVISAO_ID = '33333333-3333-4333-8333-333333333333'


@pytest.mark.parametrize('comando,opcao', [
    ('consumir-pedido-real', '--solicitacao'),
    ('avancar-card-real', '--card'),
])
def test_cli_real_uuid_invalido_nao_abre_runtime(monkeypatch, capsys, comando, opcao):
    import orquestrador.__main__ as cli

    def proibido(**_):
        pytest.fail('runtime aberto antes de validar UUID')

    monkeypatch.setattr(cli, '_abrir_runtime_real', proibido)
    assert cli.main([comando, opcao, 'nao-e-uuid']) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'


def test_cli_real_sem_ambiente_nao_conecta(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    for nome in ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL',
                 'HELENA_V2_HERMES_BIN', 'HELENA_V2_HERMES_HOME', 'HELENA_V2_EXECUCOES_DIR'):
        monkeypatch.delenv(nome, raising=False)

    def proibido(*_, **__):
        pytest.fail('Motor aberto sem ambiente real completo')

    monkeypatch.setattr(cli, 'Motor', proibido)
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'


def test_cli_consumo_usa_solicitacao_canonica_sem_agentes(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    pedido = {'plano': {'etapas': [{'id': 'E1'}]}, 'origem': 'supabase',
              'chave_origem': 'TASK-TESTE', 'titulo': 'Pedido real de teste',
              'pedido_original': 'Texto de teste', 'business_id': 'BIZ-TESTE',
              'prazo': '2026-10-21T12:00:00Z', 'dados_reais': {'captura': {'fonte': 'teste'}},
              'config_revision_id': REVISAO_ID}
    chamadas = []

    class MotorEspiao:
        def _linha(self, sql, params):
            chamadas.append(('ler', sql, params))
            return {'pedido': pedido}

        def criar_card_real(self, plano, **opcoes):
            chamadas.append(('criar', plano, opcoes))
            return CARD_ID

        def _card(self, card_id):
            chamadas.append(('card', card_id))
            return {'estado': 'RASCUNHO'}

        def fechar(self):
            chamadas.append(('fechar',))

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: (
        chamadas.append(('abrir', iniciar_dbos)) or MotorEspiao()))
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 0
    saida = json.loads(capsys.readouterr().out)
    assert saida == {'card_id': CARD_ID, 'estado': 'RASCUNHO',
                     'solicitacao_id': PEDIDO_ID, 'agentes_chamados': 0}
    assert chamadas[0] == ('abrir', False)
    assert chamadas[1][0] == 'ler' and 'ler_solicitacao_card_real' in chamadas[1][1]
    assert chamadas[1][2] == (PEDIDO_ID,)
    assert chamadas[2] == ('criar', pedido['plano'], {
        'origem': 'supabase', 'chave_origem': 'TASK-TESTE', 'titulo': 'Pedido real de teste',
        'pedido_original': 'Texto de teste', 'business_id': 'BIZ-TESTE',
        'prazo': datetime(2026, 10, 21, 12, tzinfo=timezone.utc),
        'dados_reais': pedido['dados_reais'], 'solicitacao_id': PEDIDO_ID,
        'revisao_id': REVISAO_ID})
    assert chamadas[-1] == ('fechar',)


@pytest.mark.parametrize('card,stale', [(None, False),
                                        ({'ordem_de_servico': {'modo_contexto': 'sintetico'}}, False),
                                        ({'ordem_de_servico': {'modo_contexto': 'real'}}, True)])
def test_cli_avanco_recusa_card_inexistente_sintetico_ou_fonte_velha_sem_dbos(
        monkeypatch, capsys, card, stale):
    import orquestrador.__main__ as cli

    chamadas = []

    class MotorEspiao:
        def _card(self, card_id):
            chamadas.append(('card', card_id))
            return card

        def _modo_card(self, card_id):
            chamadas.append(('conferir', card_id))
            if stale:
                raise ValueError('fonte mudou; postgresql://usuario:segredo@banco.exemplo')

        def fechar(self):
            chamadas.append(('fechar',))

    def abrir(*, iniciar_dbos):
        chamadas.append(('abrir', iniciar_dbos))
        assert iniciar_dbos is False, 'DBOS não deve abrir para card inválido ou fonte velha'
        return MotorEspiao()

    monkeypatch.setattr(cli, '_abrir_runtime_real', abrir)
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'
    assert chamadas[0] == ('abrir', False) and chamadas[-1] == ('fechar',)
    assert (('conferir', CARD_ID) in chamadas) is stale


def test_cli_avanco_unico_nao_aprova_e_fecha_ambos_runtimes(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    chamadas = []

    class MotorEspiao:
        def __init__(self, dbos):
            self.dbos = dbos

        def _card(self, card_id):
            chamadas.append(('card', self.dbos, card_id))
            return {'ordem_de_servico': {'modo_contexto': 'real'}, 'estado': 'EM_ANDAMENTO'}

        def _modo_card(self, card_id):
            chamadas.append(('conferir', self.dbos, card_id))

        def avancar(self, card_id):
            chamadas.append(('avancar', self.dbos, card_id))
            return True

        def fechar(self):
            chamadas.append(('fechar', self.dbos))

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: (
        chamadas.append(('abrir', iniciar_dbos)) or MotorEspiao(iniciar_dbos)))
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 0
    assert json.loads(capsys.readouterr().out) == {
        'card_id': CARD_ID, 'estado': 'EM_ANDAMENTO', 'houve_avanco': True}
    assert chamadas == [('abrir', False), ('card', False, CARD_ID),
                        ('conferir', False, CARD_ID), ('fechar', False),
                        ('abrir', True), ('avancar', True, CARD_ID),
                        ('card', True, CARD_ID), ('fechar', True)]


def test_cli_real_oculta_dsn_e_token_em_erro_e_fecha_runtime(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    segredo = 'postgresql://usuario:senha@banco.exemplo/token-muito-privado'
    fechado = []

    class MotorEspiao:
        def _linha(self, *_):
            raise RuntimeError(segredo)

        def fechar(self):
            fechado.append(True)

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: MotorEspiao())
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_RUNTIME'
    assert segredo not in saida.out + saida.err
    assert fechado == [True]


def test_cli_avanco_fecha_segundo_runtime_em_erro(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    fechados = []

    class MotorEspiao:
        def __init__(self, dbos):
            self.dbos = dbos

        def _card(self, _):
            return {'ordem_de_servico': {'modo_contexto': 'real'}}

        def _modo_card(self, _):
            return None

        def avancar(self, _):
            raise RuntimeError('token-privado-do-provedor')

        def fechar(self):
            fechados.append(self.dbos)

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: MotorEspiao(iniciar_dbos))
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_RUNTIME'
    assert 'token-privado-do-provedor' not in saida.out + saida.err
    assert fechados == [False, True]


def test_runtime_real_com_executor_fora_do_registro_falha_fechado_sem_abrir_motor(monkeypatch):
    """HELENA_V2_EXECUTOR com nome desconhecido (EVE, OpenClaw ou erro de digitação) é recusado antes de abrir o Motor."""
    import orquestrador.__main__ as cli

    for nome in ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'HELENA_V2_HERMES_BIN',
                 'HELENA_V2_HERMES_HOME', 'HELENA_V2_EXECUCOES_DIR'):
        monkeypatch.setenv(nome, '/algum/caminho')

    def proibido(*_, **__):
        pytest.fail('Motor aberto com executor fora do registro')

    monkeypatch.setattr(cli, 'Motor', proibido)
    for nome in ('eve', 'openclaw', 'hermez'):
        monkeypatch.setenv('HELENA_V2_EXECUTOR', nome)
        with pytest.raises(ValueError, match='não está no registro aprovado'):
            cli._abrir_runtime_real(iniciar_dbos=False)


# --- vigiar: só HELENA_V2_DATABASE_URL (nada do Hermes), mesmas checagens de produção, canal em arquivo + webhook ----------
REF = 'wxkgrykduqtsgmjkzlou'
SENHA_DO_BANCO = 'senha-falsa-do-vigia-77'
URL_DO_BANCO = f'postgresql+psycopg://helena_runtime:{SENHA_DO_BANCO}@db.{REF}.supabase.co:5432/postgres?sslmode=verify-full'
VARIAVEIS_DO_HERMES = ('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'HELENA_V2_HERMES_BIN', 'HELENA_V2_HERMES_HOME',
                       'HELENA_V2_EXECUCOES_DIR', 'HELENA_V2_EXECUTOR')
VARIAVEL_DO_WEBHOOK = 'HELENA_V2_ALARME_WEBHOOK_URL'
SEGREDO_DA_URL = 'TOKEN_SECRETO_DA_URL_5b1e'
UM_ALARME = [('13', None, 'veja postgresql://u:SENHA_FALSA_9@h:5432/db')]


def _papel_ordinario(**altera):
    dados = {'papel_atual': 'helena_runtime', 'papel_sessao': 'helena_runtime', 'membro_service_role': True,
             'sessao_membro_service_role': True, 'pode_set_service_role': True, 'herda_service_role': False,
             'vinculo_set': True, 'vinculo_inherit': False, 'vinculo_admin': False, 'dono_app': False,
             'dono_app_sessao': False, 'dono_dbos': False, 'dono_app_indireto': False,
             'dono_funcoes_indireto': False, 'alcanca_admin_indireto': False, 'dono_dbos_indireto': False}
    for prefixo in ('super', 'bypass', 'create_role', 'create_db', 'replication'):
        dados[prefixo + '_atual'] = dados[prefixo + '_sessao'] = False
    return dados | altera


class _ConexaoPostgresFalsa:
    def __init__(self, banco, dsn, opcoes):
        self.banco, self.dsn, self.opcoes = banco, dsn, opcoes
        self.comandos, self.fechada = [], False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
        return False

    def close(self):
        self.fechada = True

    def execute(self, consulta, args=()):
        texto = consulta if isinstance(consulta, str) else repr(consulta)
        self.comandos.append(texto)
        banco = self.banco

        class Cursor:
            def fetchone(_):
                return {'dados': banco.papel} if 'json_build_object' in texto else None

            def fetchall(_):
                return banco.alarmes if 'helena_v2.vigia()' in texto else []
        return Cursor()


class _PostgresFalso:
    """Troca `psycopg.connect`: nenhuma rede. Registra cada conexão e responde como o banco responderia."""

    def __init__(self, papel=None, alarmes=()):
        self.papel, self.alarmes, self.conexoes = papel or _papel_ordinario(), list(alarmes), []

    def connect(self, dsn, **opcoes):
        self.conexoes.append(_ConexaoPostgresFalsa(self, dsn, opcoes))
        return self.conexoes[-1]


@pytest.fixture()
def ambiente_do_vigia(monkeypatch, tmp_path):
    """Só HELENA_V2_DATABASE_URL (falsa) e nada do Hermes; CA de mentira; nenhum runtime nem Motor pode abrir."""
    import psycopg
    import orquestrador.__main__ as cli
    import orquestrador.bancos as bancos
    from types import SimpleNamespace
    ca = tmp_path / 'ca.pem'
    ca.write_text('apenas marcador de teste')
    monkeypatch.setattr(bancos.ssl, 'get_default_verify_paths', lambda: SimpleNamespace(cafile=str(ca)))
    for nome in VARIAVEIS_DO_HERMES + (VARIAVEL_DO_WEBHOOK, 'PGHOST', 'PGHOSTADDR', 'PGOPTIONS'):
        monkeypatch.delenv(nome, raising=False)
    monkeypatch.setenv('HELENA_V2_DATABASE_URL', URL_DO_BANCO)

    def proibido(*_, **__):
        pytest.fail('o vigiar abriu o runtime/Motor do Hermes: ele só deve precisar de HELENA_V2_DATABASE_URL')
    monkeypatch.setattr(cli, '_abrir_runtime_real', proibido)
    monkeypatch.setattr(cli, 'Motor', proibido)
    postgres = _PostgresFalso(alarmes=UM_ALARME)
    monkeypatch.setattr(psycopg, 'connect', postgres.connect)
    postgres.ca = str(ca)
    return postgres


def _saida_json(capsys):
    return json.loads(capsys.readouterr().out.strip().splitlines()[-1])


def test_cli_vigiar_uma_volta_grava_alarme_em_arquivo_sem_segredo(monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli

    class ConexaoFalsa:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, args=()):
            class Cursor:
                def fetchall(self_):
                    if 'helena_v2.vigia()' in sql:
                        return [('13', None, 'veja postgresql://u:SENHA_FALSA_9@h:5432/db')]
                    return []
            return Cursor()

    class BancoFalso:
        fechado = False

        def _con(self, papel):
            assert papel == 'service_role'
            return ConexaoFalsa()

        def fechar(self):
            BancoFalso.fechado = True

    def proibido(**_):
        pytest.fail('o vigiar não pode abrir o runtime do Hermes')

    monkeypatch.setattr(cli, '_abrir_runtime_real', proibido)
    monkeypatch.setattr(cli, '_abrir_banco_somente_leitura', lambda: BancoFalso())
    arquivo = tmp_path / 'alarmes.jsonl'
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(arquivo)]) == 0
    saida = json.loads(capsys.readouterr().out)
    assert saida['alarmes'] == 1 and saida['enviados'] == 1 and BancoFalso.fechado
    linhas = arquivo.read_text(encoding='utf-8').splitlines()
    assert len(linhas) == 1 and 'SENHA_FALSA' not in linhas[0] and 'REGRA_13' in linhas[0]


def test_cli_vigiar_sem_database_url_falha_fechado_sem_conectar(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli
    monkeypatch.delenv('HELENA_V2_DATABASE_URL')
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_RUNTIME'
    assert not (tmp_path / 'a.jsonl').exists() and ambiente_do_vigia.conexoes == []


def test_cli_vigiar_funciona_so_com_database_url_sem_nenhuma_variavel_do_hermes(ambiente_do_vigia, capsys, tmp_path):
    import orquestrador.__main__ as cli
    arquivo = tmp_path / 'alarmes.jsonl'
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(arquivo)]) == 0
    saida = capsys.readouterr()
    resumo = json.loads(saida.out)
    assert resumo['alarmes'] == 1 and resumo['enviados'] == 1 and resumo['canais_falhos'] == 0
    linhas = arquivo.read_text(encoding='utf-8').splitlines()
    assert len(linhas) == 1 and 'REGRA_13' in linhas[0] and 'SENHA_FALSA' not in linhas[0]
    assert SENHA_DO_BANCO not in saida.out + saida.err + linhas[0]
    preflight, leitura = ambiente_do_vigia.conexoes                      # 1 conexão de conferência + 1 da volta
    assert 'json_build_object' in preflight.comandos[0] and len(preflight.comandos) == 1      # papel conferido antes de SET ROLE
    assert preflight.fechada and leitura.fechada
    assert "Identifier('service_role')" in leitura.comandos[0] and 'SET ROLE' in leitura.comandos[0]
    assert leitura.comandos[1:] and all('helena_v2.' in c or 'SELECT' in c for c in leitura.comandos[1:])
    for conexao in (preflight, leitura):                                  # TLS verificado, CA do sistema, tempos e somente leitura
        assert conexao.dsn.startswith('postgresql://') and 'sslmode=verify-full' in conexao.dsn
        assert conexao.opcoes['sslrootcert'] == ambiente_do_vigia.ca and conexao.opcoes['connect_timeout'] == 10
        assert 'statement_timeout=30s' in conexao.opcoes['options']
        assert 'default_transaction_read_only=on' in conexao.opcoes['options']


def test_cli_relogio_so_precisa_de_database_url_grava_e_nao_abre_o_hermes(ambiente_do_vigia, capsys):
    import orquestrador.__main__ as cli
    assert cli.main(['relogio', '--uma-volta']) == 0
    assert _saida_json(capsys) == {'estado': 'VOLTA_FEITA', 'devidos': 0, 'aplicados': 0, 'recusados': 0, 'obsoletos': 0, 'eventos': []}
    preflight, leitura = ambiente_do_vigia.conexoes
    assert 'json_build_object' in preflight.comandos[0] and "Identifier('service_role')" in leitura.comandos[0]
    for conexao in (preflight, leitura):              # mesmas checagens do vigiar: TLS verificado, CA, tempos, papel conferido
        assert 'sslmode=verify-full' in conexao.dsn and conexao.opcoes['sslrootcert'] == ambiente_do_vigia.ca
        assert 'statement_timeout=30s' in conexao.opcoes['options']
        assert 'default_transaction_read_only' not in conexao.opcoes['options']      # o relógio grava; só o vigiar é somente leitura
    assert any('eventos_devidos' in c for c in leitura.comandos) and preflight.fechada and leitura.fechada


@pytest.mark.parametrize('url', [
    URL_DO_BANCO.replace('verify-full', 'require'),
    URL_DO_BANCO.replace('helena_runtime', 'service_role'),
    'postgresql://postgres@localhost:5432/postgres',
])
def test_cli_relogio_aplica_as_mesmas_checagens_de_url_e_nao_conecta(ambiente_do_vigia, monkeypatch, capsys, url):
    import orquestrador.__main__ as cli
    monkeypatch.setenv('HELENA_V2_DATABASE_URL', url)
    assert cli.main(['relogio', '--uma-volta']) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_RUNTIME' and ambiente_do_vigia.conexoes == []


def test_cli_intervalo_padrao_de_cada_comando(monkeypatch):
    import orquestrador.__main__ as cli
    vistos = {}
    for nome in ('relogio', 'vigiar', 'despachar'):
        monkeypatch.setattr(cli, '_' + nome, lambda args, parser, nome=nome: vistos.setdefault(nome, args.intervalo) and 0)
    cli.main(['relogio'])
    cli.main(['vigiar', '--saida', '/tmp/x'])
    cli.main(['despachar'])
    assert vistos == {'relogio': 60.0, 'vigiar': 300.0, 'despachar': 5.0}


@pytest.mark.parametrize('url', [
    URL_DO_BANCO.replace('verify-full', 'require'),
    URL_DO_BANCO.replace(f'db.{REF}.supabase.co', 'banco.exemplo.org'),
    URL_DO_BANCO.replace('helena_runtime', 'postgres'),
    URL_DO_BANCO.replace('helena_runtime', 'service_role'),
    URL_DO_BANCO.replace(':5432', ':6543'),
    URL_DO_BANCO.replace('/postgres?', '/outro?'),
    URL_DO_BANCO.replace('postgresql+psycopg', 'http'),
    'postgresql://postgres@localhost:5432/postgres',
])
def test_cli_vigiar_aplica_as_mesmas_checagens_de_url_do_motor_e_nao_conecta(ambiente_do_vigia, monkeypatch, capsys, tmp_path, url):
    import orquestrador.__main__ as cli
    monkeypatch.setenv('HELENA_V2_DATABASE_URL', url)
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_RUNTIME' and SENHA_DO_BANCO not in saida.out + saida.err
    assert ambiente_do_vigia.conexoes == [] and not (tmp_path / 'a.jsonl').exists()


def test_cli_vigiar_recusa_variavel_pg_que_redireciona_a_conexao(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli
    monkeypatch.setenv('PGHOSTADDR', '127.0.0.1')
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_RUNTIME' and ambiente_do_vigia.conexoes == []


def test_cli_vigiar_recusa_ca_do_sistema_ausente(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import os
    import orquestrador.__main__ as cli
    os.unlink(ambiente_do_vigia.ca)
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_RUNTIME' and ambiente_do_vigia.conexoes == []


@pytest.mark.parametrize('altera', [{'super_atual': True}, {'papel_atual': 'postgres', 'papel_sessao': 'postgres'},
                                    {'dono_app': True}, {'membro_service_role': False}, {'alcanca_admin_indireto': True}])
def test_cli_vigiar_recusa_papel_com_privilegio_demais_e_nunca_chega_ao_set_role(ambiente_do_vigia, capsys, tmp_path, altera):
    import orquestrador.__main__ as cli
    ambiente_do_vigia.papel = _papel_ordinario(**altera)
    assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_RUNTIME'
    (preflight,) = ambiente_do_vigia.conexoes
    assert preflight.fechada and not any('SET ROLE' in c for c in preflight.comandos)
    assert not (tmp_path / 'a.jsonl').exists()


def test_banco_somente_leitura_so_entrega_service_role(ambiente_do_vigia):
    import orquestrador.__main__ as cli
    banco = cli._abrir_banco_somente_leitura()
    for papel in ('authenticated', 'postgres', None, ''):
        with pytest.raises(RuntimeError, match='service_role'):
            banco._con(papel)
    assert banco._con('service_role') and banco.fechar() is None
    assert SENHA_DO_BANCO not in repr(banco) + str(banco)


def test_banco_somente_leitura_fecha_a_conexao_se_o_set_role_falhar(ambiente_do_vigia):
    import orquestrador.__main__ as cli
    banco = cli._abrir_banco_somente_leitura()

    def quebra(self, consulta, args=()):
        raise ConnectionError('SET ROLE recusado')
    _ConexaoPostgresFalsa.execute, original = quebra, _ConexaoPostgresFalsa.execute
    try:
        with pytest.raises(ConnectionError):
            banco._con('service_role')
    finally:
        _ConexaoPostgresFalsa.execute = original
    assert ambiente_do_vigia.conexoes[-1].fechada


# --- vigiar --canal-webhook ---------------------------------------------------------------------------------------------
def _webhook_local(monkeypatch):
    """Só o TESTE liga o http local; o comando vigiar nunca liga (há um teste para isso abaixo)."""
    import functools
    from orquestrador import vigilancia
    monkeypatch.setattr(vigilancia, 'NotificadorHttp', functools.partial(vigilancia.NotificadorHttp, permitir_local=True))


def test_cli_vigiar_canal_webhook_sem_a_variavel_e_erro_claro_antes_de_abrir_o_banco(ambiente_do_vigia, capsys, tmp_path):
    import orquestrador.__main__ as cli
    arquivo = tmp_path / 'a.jsonl'
    assert cli.main(['vigiar', '--uma-volta', '--canal-webhook', '--saida', str(arquivo)]) == 1
    saida = _saida_json(capsys)
    assert saida['estado'] == 'FALHA_DE_CANAL' and VARIAVEL_DO_WEBHOOK in saida['motivo'] and 'não está definida' in saida['motivo']
    assert ambiente_do_vigia.conexoes == [] and not arquivo.exists()


@pytest.mark.parametrize('url', [f'http://exemplo.invalid/hook/{SEGREDO_DA_URL}',
                                 f'https://usuario:senha@exemplo.invalid/{SEGREDO_DA_URL}'])
def test_cli_vigiar_canal_webhook_com_url_insegura_e_recusado_sem_mostrar_a_url(ambiente_do_vigia, monkeypatch, capsys, tmp_path, url):
    import orquestrador.__main__ as cli
    monkeypatch.setenv(VARIAVEL_DO_WEBHOOK, url)
    assert cli.main(['vigiar', '--uma-volta', '--canal-webhook', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_CANAL'
    assert SEGREDO_DA_URL not in saida.out + saida.err and 'exemplo.invalid' not in saida.out + saida.err
    assert ambiente_do_vigia.conexoes == []


def test_cli_vigiar_nunca_liga_o_http_local_do_teste(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    """Sem o monkeypatch do teste, http://127.0.0.1 é recusado pelo comando de verdade."""
    import orquestrador.__main__ as cli
    monkeypatch.setenv(VARIAVEL_DO_WEBHOOK, f'http://127.0.0.1:9/hook/{SEGREDO_DA_URL}')
    assert cli.main(['vigiar', '--uma-volta', '--canal-webhook', '--saida', str(tmp_path / 'a.jsonl')]) == 1
    assert _saida_json(capsys)['estado'] == 'FALHA_DE_CANAL'


def test_cli_vigiar_canal_webhook_os_dois_canais_recebem_todo_alarme(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli
    from apoio.servidor_webhook import ServidorWebhook
    _webhook_local(monkeypatch)
    arquivo = tmp_path / 'alarmes.jsonl'
    with ServidorWebhook() as servidor:
        monkeypatch.setenv(VARIAVEL_DO_WEBHOOK, servidor.url('/hook/' + SEGREDO_DA_URL))
        assert cli.main(['vigiar', '--uma-volta', '--canal-webhook', '--saida', str(arquivo)]) == 0
    saida = capsys.readouterr()
    resumo = json.loads(saida.out)
    assert resumo['alarmes'] == 1 and resumo['enviados'] == 1 and resumo['canais_falhos'] == 0
    assert len(arquivo.read_text(encoding='utf-8').splitlines()) == 1
    (metodo, caminho, _cabecalhos, corpo), = servidor.recebidos
    assert metodo == 'POST' and json.loads(corpo)['codigo'] == 'REGRA_13' and 'SENHA_FALSA' not in corpo
    assert SEGREDO_DA_URL not in saida.out + saida.err


def test_cli_vigiar_webhook_fora_do_ar_nao_cala_o_arquivo_e_nao_vaza_a_url(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli
    from apoio.servidor_webhook import ServidorWebhook
    _webhook_local(monkeypatch)
    arquivo = tmp_path / 'alarmes.jsonl'
    with ServidorWebhook(500) as servidor:
        monkeypatch.setenv(VARIAVEL_DO_WEBHOOK, servidor.url('/hook/' + SEGREDO_DA_URL))
        assert cli.main(['vigiar', '--uma-volta', '--canal-webhook', '--saida', str(arquivo)]) == 0
    saida = capsys.readouterr()
    resumo = json.loads(saida.out)
    assert resumo['enviados'] == 1 and resumo['canais_falhos'] == 1
    assert 'REGRA_13' in arquivo.read_text(encoding='utf-8') and SEGREDO_DA_URL not in saida.out + saida.err


def test_cli_vigiar_sem_a_opcao_nao_usa_o_webhook_mesmo_com_a_variavel_definida(ambiente_do_vigia, monkeypatch, capsys, tmp_path):
    import orquestrador.__main__ as cli
    from apoio.servidor_webhook import ServidorWebhook
    _webhook_local(monkeypatch)
    with ServidorWebhook() as servidor:
        monkeypatch.setenv(VARIAVEL_DO_WEBHOOK, servidor.url('/hook'))
        assert cli.main(['vigiar', '--uma-volta', '--saida', str(tmp_path / 'a.jsonl')]) == 0
    assert servidor.recebidos == []


def test_cli_despachar_uma_rodada_usa_o_runtime_real_com_dbos_e_fecha_tudo(monkeypatch, capsys):
    import orquestrador.__main__ as cli
    import orquestrador.despacho as despacho
    eventos = []

    class MotorFalso:
        def fechar(self):
            eventos.append('motor fechado')

    class DespachanteFalso:
        def __init__(self, motor, vagas, identidade, registrar):
            eventos.append(('criado', vagas, identidade.startswith('despachante-')))
            self.ultimo_card, self.metricas = 'card-1', {'rodadas': 1}

        def uma_rodada(self):
            return 'AVANCOU'

        def fechar(self):
            eventos.append('despachante fechado')

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: (eventos.append(('runtime', iniciar_dbos)), MotorFalso())[1])
    monkeypatch.setattr(despacho, 'Despachante', DespachanteFalso)
    assert cli.main(['despachar', '--uma-rodada', '--vagas', '2']) == 0
    assert json.loads(capsys.readouterr().out) == {'resultado': 'AVANCOU', 'card': 'card-1', 'metricas': {'rodadas': 1}}
    assert eventos == [('runtime', True), ('criado', 2, True), 'despachante fechado', 'motor fechado']


def test_cli_despachar_sem_runtime_falha_fechado_e_vagas_invalidas_sao_recusadas(monkeypatch, capsys):
    import orquestrador.__main__ as cli
    for nome in ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'HELENA_V2_EXECUTOR'):
        monkeypatch.delenv(nome, raising=False)
    assert cli.main(['despachar', '--uma-rodada']) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'
    for vagas in ('0', '65', '-1'):
        with pytest.raises(SystemExit):
            cli.main(['despachar', '--uma-rodada', '--vagas', vagas])


def test_cli_conferir_runtime_mostra_a_ficha_de_conexao_so_com_nomes_sem_rede_e_sem_banco(monkeypatch, capsys):
    import orquestrador.__main__ as cli
    import psycopg
    monkeypatch.setattr(psycopg, 'connect', lambda *a, **k: pytest.fail('conferir-runtime não pode abrir conexão'))
    monkeypatch.setenv('HELENA_V2_HERMES_HOME', '/valor/que/nao/pode/aparecer')
    monkeypatch.delenv('HELENA_V2_EXECUTOR', raising=False)
    assert cli.main(['conferir-runtime']) == 0
    saida = capsys.readouterr().out
    ficha = json.loads(saida)
    hermes = next(r for r in ficha['runtimes'] if r['nome'] == 'hermes')
    assert hermes['estado'] == 'APROVADO_PARA_PRODUCAO' and hermes['escolhido'] is True
    assert 'HELENA_V2_HERMES_HOME' not in hermes['variaveis_faltando'] and 'HELENA_V2_HERMES_BIN' in hermes['variaveis_exigidas']
    assert '/valor/que/nao/pode/aparecer' not in saida
    assert all(r['estado'] in ('APROVADO_PARA_PRODUCAO', 'PRONTO_PARA_CONECTAR_NAO_APROVADO') for r in ficha['runtimes'])
