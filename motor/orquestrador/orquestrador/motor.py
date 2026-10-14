"""Um despacho DBOS por execução; somente funções do banco decidem estado."""
import json
import errno
import os
import re
import shutil
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dbos import DBOS, DBOSConfig, SetWorkflowID

from executor_helena.executor_falso import ExecutorFalso, Roteiro
from executor_helena.executor import Executor
from executor_helena.registro import classes_aprovadas, conferir_registro
from executor_helena.ficha import ler_ficha
from executor_helena.tipos import Execucao
from spec_helena import Spec, listar_casos, montar_contexto, montar_resposta
from validador import validar
from .configuracao import (capturar_bundle, carregar_revisao, hash_bundle, impressao_maquina,
                          validar_bundle, verificar_revisao)
from .contexto_real import montar_contexto_real
from .evidencias import EvidenciaInvalida, coletar_evidencias
from .plano import RAIZ, validar_plano

_MOTOR = None
VERSAO_CODIGO = 'primeiro-card-2-config'
VERSAO_CODIGO_REAL = 'primeiro-card-3-real'
_BUNDLES_VALIDADOS: set[str] = set()
# Registro de adaptadores aprovados em código (executor_helena/registro.py). Configuração editável não escolhe classes.
ADAPTADORES_REAIS_APROVADOS: tuple[type[Executor], ...] = classes_aprovadas()


def _ativo():
    if _MOTOR is None:
        raise RuntimeError('motor não registrado para retomada DBOS')
    return _MOTOR


@DBOS.step(name='executar_e_salvar')
def executar_e_salvar(etapa_id: str, numero: int) -> int:
    return _ativo().executar_e_salvar(etapa_id, numero)


@DBOS.step(name='conferir_e_aplicar')
def conferir_e_aplicar(etapa_id: str, numero: int) -> str:
    return _ativo().conferir_e_aplicar(etapa_id, numero)


@DBOS.workflow(name='executar_etapa_v1')
def fluxo_etapa(etapa_id: str, numero: int) -> str:
    if executar_e_salvar(etapa_id, numero) is None:
        return 'EM_RESOLUCAO'
    return conferir_e_aplicar(etapa_id, numero)


@DBOS.step(name='executar_e_salvar_revisao')
def executar_e_salvar_revisao(etapa_id: str, numero: int) -> int:
    return _ativo().executar_e_salvar_revisao(etapa_id, numero)


@DBOS.step(name='conferir_e_aplicar_revisao')
def conferir_e_aplicar_revisao(etapa_id: str, numero: int) -> str:
    return _ativo().conferir_e_aplicar_revisao(etapa_id, numero)


@DBOS.workflow(name='revisar_etapa_v1')
def fluxo_revisao(etapa_id: str, numero: int) -> str:
    executar_e_salvar_revisao(etapa_id, numero)
    return conferir_e_aplicar_revisao(etapa_id, numero)


@DBOS.step(name='executar_e_salvar_coordenacao')
def executar_e_salvar_coordenacao(card_id: str, chave: int) -> int:
    return _ativo().executar_e_salvar_coordenacao(card_id, chave)


@DBOS.step(name='conferir_e_aplicar_coordenacao')
def conferir_e_aplicar_coordenacao(card_id: str, chave: int) -> str:
    return _ativo().conferir_e_aplicar_coordenacao(card_id, chave)


@DBOS.workflow(name='ler_de_volta_v1')
def fluxo_coordenacao(card_id: str, chave: int) -> str:
    executar_e_salvar_coordenacao(card_id, chave)
    return conferir_e_aplicar_coordenacao(card_id, chave)


def conferir_rubrica(spec, servico, criterios) -> bool:
    """Portão 2 de hoje: confere só a FORMA da rubrica (todos os critérios, uma vez cada, PASSOU e com prova escrita).
    Nunca levanta exceção por conteúdo estranho do revisor: id que não é texto, critério que não é dicionário etc. = recusa."""
    esperados = set(spec.tipo(spec.tipo_do_servico(servico))['criterio_de_pronto']['rubrica'])
    if not isinstance(criterios, list) or len(criterios) != len(esperados):
        return False
    if not all(isinstance(c, dict) and isinstance(c.get('id'), str) for c in criterios):
        return False
    return ({c['id'] for c in criterios} == esperados
            and all(c.get('resultado') == 'PASSOU' and isinstance(c.get('prova'), str) and c['prova'].strip()
                    for c in criterios))


def _preflight_bancos_reais(url_banco: str, url_dbos: str):
    """Confere logins e contrato da máquina antes de registrar workflows globais."""
    from .bancos import (parametros_conexao_real, preflight_papel_runtime,
                         validar_destinos_reais)

    dbos_config = validar_destinos_reais(url_banco, url_dbos)
    app_dsn = url_banco.replace('postgresql+psycopg://', 'postgresql://', 1)
    sys_dsn = url_dbos.replace('postgresql+psycopg://', 'postgresql://', 1)
    parametros = parametros_conexao_real()
    with psycopg.connect(app_dsn, autocommit=True, row_factory=dict_row, **parametros) as con:
        preflight_papel_runtime(con)
        con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier('service_role')))
        estado = con.execute("""SELECT helena_v2.tabela_confere() AS confere,
               (SELECT impressao_digital FROM helena_v2.meta_tabela LIMIT 1) AS impressao,
               helena_v2.configuracao_ativa() AS ativa""").fetchone()
        esperado = impressao_maquina(capturar_bundle(RAIZ / 'helena-v2'))
        if (not estado or estado['confere'] is not True or
                estado['impressao'] != esperado or
                not isinstance(estado['ativa'], dict) or
                estado['ativa'].get('estado') != 'VALIDADA'):
            raise RuntimeError('banco do card sem máquina compatível e configuração ativa validada')
    parametros_sistema = {k: v for k, v in parametros.items() if k != 'options'}
    with psycopg.connect(sys_dsn, autocommit=True, row_factory=dict_row,
                         **parametros_sistema) as con:
        preflight_papel_runtime(con, sistema=True)
    return dbos_config


class EventoRecusado(RuntimeError):
    """A função única do banco recusou o evento. `resposta` é a resposta dela (motivo, resultado...)."""

    def __init__(self, maquina, evento, resposta):
        super().__init__(f'{maquina} {evento}: {resposta}')
        self.resposta = resposta


class Motor:
    def __init__(self, url_banco: str, url_dbos: str, casos: dict[str, str] | None = None, executor=None,
                 *, permitir_configuracao_tecnica=False, permitir_servico_rascunho=False,
                 permitir_executor_falso=False, permitir_casos_sinteticos=False, iniciar_dbos=True,
                 fonte_contexto=None, modo_producao=False):
        if not url_banco or not url_dbos:
            raise ValueError('motor exige banco do card e banco DBOS separados')
        if modo_producao:
            if (permitir_configuracao_tecnica or permitir_servico_rascunho or
                    permitir_executor_falso or permitir_casos_sinteticos or casos):
                raise ValueError('modo de produção proíbe opções e casos sintéticos')
            if (not isinstance(executor, Executor) or isinstance(executor, ExecutorFalso) or
                    type(executor) not in ADAPTADORES_REAIS_APROVADOS or
                    not callable(getattr(executor, 'limpar', None)) or
                    fonte_contexto is not montar_contexto_real):
                raise ValueError('modo de produção exige executor real aprovado e montar_contexto_real')
            conferir_registro()
            faltando = executor.capacidades.faltando_para_producao()
            if faltando:
                raise ValueError('executor sem as garantias exigidas pelo motor: ' + ', '.join(faltando))
            dbos_config = _preflight_bancos_reais(url_banco, url_dbos)
        else:
            bancos = []
            for url in (url_banco, url_dbos):
                dsn = url.replace('postgresql+psycopg://', 'postgresql://', 1)
                parametros = conninfo_to_dict(dsn)
                host = parametros.get('host', '')
                hostaddr = parametros.get('hostaddr') or os.environ.get('PGHOSTADDR')
                if host not in ('localhost', '127.0.0.1', '::1') or (hostaddr and hostaddr not in ('127.0.0.1', '::1')):
                    raise ValueError('este motor de teste exige PostgreSQL local')
                bancos.append(parametros.get('dbname'))
            if bancos[0] == bancos[1]:
                raise ValueError('motor exige banco do card e banco DBOS separados')
        self.url_banco = url_banco
        self.url_dbos = url_dbos
        self.casos = casos or {}
        self.permitir_configuracao_tecnica = permitir_configuracao_tecnica
        self.permitir_servico_rascunho = permitir_servico_rascunho
        self.permitir_casos_sinteticos = permitir_casos_sinteticos
        self.modo_producao = modo_producao
        self.versao_codigo = VERSAO_CODIGO_REAL if modo_producao else VERSAO_CODIGO
        self.fonte_contexto = fonte_contexto
        if executor is None and not permitir_executor_falso:
            raise ValueError('executor deve ser injetado; ExecutorFalso exige opt-in local explícito')
        self.executor = executor if executor is not None else ExecutorFalso(
            lambda execucao: Roteiro(texto=self._texto_roteirizado(execucao)))
        self._pasta_snapshots = tempfile.TemporaryDirectory(prefix='helena-dbos-config-')
        if permitir_casos_sinteticos:
            # Corpus sintético é somente do harness: nunca entra no bundle editável do produto.
            raiz_fixtures = Path(self._pasta_snapshots.name) / 'fixtures' / 'helena-v2'
            shutil.copytree(RAIZ / 'helena-v2' / 'casos', raiz_fixtures / 'casos')
            self._fixture_spec = Spec(raiz_fixtures)
        self._revisoes = {}
        self._revisao_tecnica = None
        self.dbos = None
        if iniciar_dbos:
            global _MOTOR
            config = {'name': 'helena-v2-primeiro-card', 'application_version': self.versao_codigo,
                      **(dict(dbos_config, enable_otlp=False) if modo_producao else
                         {'system_database_url': url_dbos})}
            self.dbos = DBOS(config=DBOSConfig(**config))
            anterior = _MOTOR
            _MOTOR = self
            try:
                self.dbos.launch()
            except BaseException:
                _MOTOR = anterior
                self.dbos.destroy()
                self._pasta_snapshots.cleanup()
                raise

    def fechar(self):
        if self.dbos is not None:
            self.dbos.destroy()
        self._pasta_snapshots.cleanup()
        global _MOTOR
        if self.dbos is not None and _MOTOR is self:
            _MOTOR = None

    def _con(self, papel='service_role'):
        if papel == 'authenticated':
            raise RuntimeError('contexto de identidade do fundador deve ser injetado')
        dsn = self.url_banco.replace('postgresql+psycopg://', 'postgresql://', 1)
        if self.modo_producao:
            from .bancos import parametros_conexao_real
            parametros = parametros_conexao_real()
        else:
            parametros = {}
        con = psycopg.connect(dsn, autocommit=True, row_factory=dict_row, **parametros)
        if papel:
            con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(papel)))
        return con

    def _linha(self, sql, args=(), papel='service_role'):
        with self._con(papel) as con:
            return con.execute(sql, args).fetchone()

    def _execucao_ainda_atual(self, maquina, alvo, chave):
        """Leitura curta e independente da conexão usada pelo despacho DBOS."""
        dsn = self.url_banco.replace('postgresql+psycopg://', 'postgresql://', 1)
        parametros = {'connect_timeout': 2,
                      'options': '-c lock_timeout=2s -c statement_timeout=5s'}
        if self.modo_producao:
            from .bancos import parametros_conexao_real
            parametros['sslrootcert'] = parametros_conexao_real()['sslrootcert']
        with psycopg.connect(dsn, autocommit=True, row_factory=dict_row, **parametros) as con:
            con.execute('SET ROLE service_role')
            if maquina == 'card':
                linha = con.execute(
                    """SELECT c.estado AS estado_card, c.chamada_helena, x.estado AS estado_execucao,
                              x.tipo AS tipo_execucao
                       FROM helena_v2.card c LEFT JOIN helena_v2.execucao x ON x.numero=%s
                       WHERE c.id=%s""", (chave, alvo)).fetchone()
                return bool(linha and linha['estado_card'] == 'RASCUNHO'
                            and linha['chamada_helena'] == chave
                            and linha['estado_execucao'] == 'VIVA'
                            and linha['tipo_execucao'] == 'HELENA')
            if maquina == 'etapa':
                linha = con.execute(
                    """SELECT c.estado AS estado_card, e.estado AS estado_etapa,
                              e.execucao_atual, x.estado AS estado_execucao, x.tipo AS tipo_execucao
                       FROM helena_v2.etapa e JOIN helena_v2.card c ON c.id=e.card_id
                       LEFT JOIN helena_v2.execucao x ON x.numero=%s WHERE e.id=%s""",
                    (chave, alvo)).fetchone()
                return bool(linha and linha['estado_card'] == 'EM_ANDAMENTO'
                            and linha['execucao_atual'] == chave
                            and linha['estado_execucao'] == 'VIVA'
                            and ((linha['estado_etapa'] == 'EXECUTANDO' and linha['tipo_execucao'] == 'AUTOR')
                                 or (linha['estado_etapa'] == 'REVISAO' and linha['tipo_execucao'] == 'REVISOR')))
        raise ValueError('máquina de execução desconhecida')

    def _rodar_vigiado(self, execucao, maquina, alvo, chave):
        """Cancela cooperativamente se o banco retirar a posse da execução."""
        parar = threading.Event()
        invalida = threading.Event()

        def vigiar():
            while not parar.is_set():
                if not invalida.is_set():
                    try:
                        if not self._execucao_ainda_atual(maquina, alvo, chave):
                            invalida.set()
                    except Exception:
                        # Indisponibilidade do banco também retira autorização para continuar.
                        invalida.set()
                if invalida.is_set():
                    try:
                        self.executor.cancelar(execucao.id)
                    except Exception:
                        pass  # Pode ainda não haver PID; tentar outra vez enquanto rodar bloquear.
                parar.wait(0.2 if invalida.is_set() else 1.0)

        thread = threading.Thread(target=vigiar, name='vigia-card-helena', daemon=True)
        thread.start()
        try:
            resultado = self.executor.rodar(execucao)
        finally:
            parar.set()
            thread.join(timeout=7)
        if invalida.is_set() or not self._execucao_ainda_atual(maquina, alvo, chave):
            raise RuntimeError('execução cancelada, antiga ou banco indisponível')
        return resultado

    def _carregar_revisao(self, revisao_id):
        chave = str(revisao_id)
        if chave not in self._revisoes:
            revisao = self._linha('SELECT helena_v2.ler_configuracao(%s::uuid) AS revisao',
                                  (chave,))['revisao']
            if not revisao:
                raise ValueError(f'revisão de configuração ausente: {chave}')
            bundle = revisao['conteudo']
            hash_sql = self._linha("SELECT encode(sha256(convert_to(%s::jsonb::text, 'UTF8')), 'hex') AS hash",
                                   (Jsonb(bundle),))['hash']
            if hash_sql != revisao['hash_sha256']:
                raise ValueError('hash SQL da revisão de configuração não confere')
            hash_local = hash_bundle(bundle)
            destino = Path(self._pasta_snapshots.name) / f'{chave}-{revisao["versao"]}-{hash_local[:12]}'
            spec, raiz = carregar_revisao(bundle, hash_local, destino)
            self._revisoes[chave] = (revisao, spec, raiz)
        revisao, spec, raiz = self._revisoes[chave]
        verificar_revisao(revisao['conteudo'], raiz.parent)
        return self._revisoes[chave]

    def _configuracao_tecnica(self):
        if not self.permitir_configuracao_tecnica:
            raise RuntimeError('sem revisão ativa; configuração técnica exige opt-in local explícito')
        if self._revisao_tecnica is None:
            bundle = capturar_bundle(RAIZ / 'helena-v2')
            hash_local = hash_bundle(bundle)
            if hash_local not in _BUNDLES_VALIDADOS:
                validar_bundle(bundle, raiz_maquina=RAIZ / 'helena-v2')
                _BUNDLES_VALIDADOS.add(hash_local)
            impressao = self._linha('SELECT impressao_digital FROM helena_v2.meta_tabela LIMIT 1')['impressao_digital']
            self._revisao_tecnica = self._linha(
                'SELECT helena_v2.registrar_configuracao_tecnica(%s,%s,%s) AS revisao',
                ('Configuração técnica local', Jsonb(bundle), impressao))['revisao']
        return self._revisao_tecnica

    def _escolher_revisao(self, revisao_id=None):
        ativa = self._linha('SELECT helena_v2.configuracao_ativa() AS revisao')['revisao']
        if revisao_id is None:
            revisao = ativa
            if not revisao:
                revisao = self._configuracao_tecnica()
        else:
            if ativa is None and not self.permitir_configuracao_tecnica:
                raise RuntimeError('sem revisão ativa; novo card exige ativação do fundador')
            if ativa is not None and str(ativa['id']) != str(revisao_id):
                raise ValueError('novo card deve usar a revisão ativa')
            revisao = self._carregar_revisao(revisao_id)[0]
        if revisao['estado'] != 'VALIDADA':
            raise ValueError('novo card exige revisão de configuração validada')
        return revisao

    def _ambiente_card(self, card_id):
        card = self._card(card_id)
        revisao_id = card['ordem_de_servico'].get('config_revision_id')
        if revisao_id is None:
            raise RuntimeError('card sem revisão de configuração fixada')
        return self._carregar_revisao(revisao_id)

    def processar_configuracoes_pendentes(self):
        """Trabalho local explícito: confere dados e registra veredito, sem ativar revisão."""
        pendentes = self._linha('SELECT helena_v2.listar_validacoes_pendentes() AS fila')['fila']
        resultados = []
        for item in pendentes:
            revisao_id, versao, hash_sql = item['id'], item['versao'], item['hash_sha256']
            try:
                bundle = item['conteudo']
                calculado = self._linha("SELECT encode(sha256(convert_to(%s::jsonb::text, 'UTF8')), 'hex') AS hash",
                                        (Jsonb(bundle),))['hash']
                if calculado != hash_sql:
                    raise ValueError('hash SQL do rascunho não confere')
                if not self._linha('SELECT helena_v2.tabela_confere() AS confere')['confere']:
                    raise ValueError('tabela da máquina SQL divergente')
                try:
                    validar_bundle(bundle, raiz_maquina=RAIZ / 'helena-v2')
                except OSError as invalida:
                    if invalida.errno != errno.ENAMETOOLONG:
                        raise  # falha de recursos/ambiente: manter pedido pendente
                    raise ValueError('caminho da configuração excede o limite do sistema') from invalida
                except MemoryError:
                    raise  # falha de recursos/ambiente: manter pedido pendente
                except Exception as invalida:
                    raise ValueError(f'{type(invalida).__name__}: {str(invalida)[:240]}') from invalida
                impressao = self._linha('SELECT impressao_digital FROM helena_v2.meta_tabela LIMIT 1')['impressao_digital']
                resultado = self._linha('SELECT helena_v2.registrar_validacao_config(%s::uuid,%s,%s,%s) AS resultado',
                                        (str(revisao_id), versao, hash_sql, impressao))['resultado']
            except (ValueError, TypeError, KeyError) as erro:
                try:
                    resultado = self._linha('SELECT helena_v2.registrar_resultado_validacao(%s::uuid,%s,%s,%s) AS resultado',
                                            (str(revisao_id), versao, hash_sql,
                                             Jsonb({'ok': False, 'erros': [str(erro)]})))['resultado']
                except psycopg.Error as concorrencia:
                    if concorrencia.sqlstate != '40001':
                        raise
                    resultado = {'id': str(revisao_id), 'ignorada': 'versão alterada durante validação'}
            except psycopg.Error as concorrencia:
                if concorrencia.sqlstate != '40001':
                    raise
                resultado = {'id': str(revisao_id), 'ignorada': 'versão alterada durante validação'}
            resultados.append(resultado)
        return resultados

    def _evento(self, maquina, alvo, papel, evento, params=None, ator=None, chave=None, conteudo=None,
                *, automaticos=True, nao_disparar=None, toque=None, con=None, card_id_real=None):
        if maquina not in ('card', 'etapa', 'acao_externa'):
            raise ValueError('máquina desconhecida')
        versao = None
        if papel == 'FUNDADOR':
            versao = self._linha(f'SELECT versao FROM helena_v2.{maquina} WHERE id=%s', (alvo,))['versao']
        def aplicar(c):
            return c.execute('SELECT helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                             (maquina, alvo, papel, evento, Jsonb(params or {}), ator, chave, versao,
                              Jsonb(conteudo) if conteudo is not None else None, toque,
                              automaticos, nao_disparar or [])).fetchone()['aplicar_evento']
        if con is None:
            with self._con('authenticated' if papel == 'FUNDADOR' else 'service_role') as propria:
                if card_id_real is not None:
                    if papel == 'FUNDADOR':
                        raise RuntimeError('guarda real de evento do fundador exige sessão autenticada própria')
                    with propria.transaction():
                        self._conferir_fontes_real(card_id_real, con=propria)
                        resposta = aplicar(propria)
                else:
                    resposta = aplicar(propria)
        else:
            if papel == 'FUNDADOR':
                raise RuntimeError('evento do fundador exige sessão autenticada própria')
            resposta = aplicar(con)
        if resposta['resultado'] not in ('APLICADO', 'CONVERTIDO'):
            raise EventoRecusado(maquina, evento, resposta)
        return resposta

    def _evento_de_vista_atrasada(self, *args, **kwargs):
        """Aplica um evento que o motor decidiu olhando uma FOTO do banco (a lista de etapas, o estado do card).

        Se, entre a foto e o evento, a máquina andou sozinha ou outro processo agiu, o banco responde
        SEM_PASSAGEM_NESTE_ESTADO: o evento já não cabe. Isso não é erro nem progresso: devolve False e a próxima rodada
        olha o banco de novo. Qualquer outra recusa continua sendo erro. Devolve True quando o evento valeu."""
        try:
            self._evento(*args, **kwargs)
        except EventoRecusado as erro:
            if isinstance(erro.resposta, dict) and erro.resposta.get('motivo') == 'SEM_PASSAGEM_NESTE_ESTADO':
                return False
            raise
        return True

    def _etapas(self, card_id):
        with self._con() as con:
            return con.execute('SELECT * FROM helena_v2.etapa WHERE card_id=%s AND atual ORDER BY ordem', (card_id,)).fetchall()

    def _card(self, card_id):
        return self._linha('SELECT * FROM helena_v2.card WHERE id=%s', (card_id,))

    def criar_card(self, plano, numero='primeiro-card-teste', revisao_id=None):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('criação de card exige adaptador de contexto real; casos sintéticos só com opt-in local')
        revisao = self._escolher_revisao(revisao_id)
        revisao_id = str(revisao['id'])
        _, spec, raiz = self._carregar_revisao(revisao_id)
        plano = {**plano, 'config_revision_id': revisao_id}
        erro = validar_plano(plano, spec, raiz, permitir_rascunho=self.permitir_servico_rascunho)
        if erro:
            raise ValueError(f'plano inválido: {erro}')
        roteiro = self._roteiro_do_banco(plano, spec, raiz)
        resposta = self._linha('SELECT helena_v2.criar_card(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) AS resposta',
                               ('teste', numero, plano['nome'], plano['nome'],
                                datetime.now(timezone.utc) + timedelta(days=7), Jsonb(roteiro), 'BIZ-003',
                                Jsonb(plano), 0, True))['resposta']
        card_id = resposta['card_id']
        fixada = self._card(card_id)['ordem_de_servico'].get('config_revision_id')
        if str(fixada) != revisao_id:
            raise RuntimeError('card criado sem revisão de configuração fixada')
        return card_id

    def criar_card_real(self, plano, *, origem: str, chave_origem: str, titulo: str,
                        pedido_original: str, business_id: str, prazo: datetime,
                        dados_reais: dict, solicitacao_id: str, revisao_id=None):
        """Abre card com entradas fornecidas pelo adaptador confiável, sem corpus de casos."""
        if not callable(self.fonte_contexto):
            raise RuntimeError('card real exige fonte de contexto injetada')
        if isinstance(self.executor, ExecutorFalso):
            raise RuntimeError('card real exige executor injetado, sem ExecutorFalso')
        if not isinstance(plano, dict) or not isinstance(dados_reais, dict):
            raise ValueError('plano e dados reais devem ser objetos')
        try:
            solicitacao_id = str(UUID(str(solicitacao_id)))
        except (ValueError, TypeError, AttributeError) as erro:
            raise ValueError('solicitação autenticada obrigatória') from erro
        for nome, valor in (('origem', origem), ('chave de origem', chave_origem),
                            ('título', titulo), ('pedido original', pedido_original)):
            if not isinstance(valor, str) or not valor.strip():
                raise ValueError(f'{nome} real obrigatório')
        if origem != 'supabase' or not re.fullmatch(r'BIZ-\d+', business_id or ''):
            raise ValueError('origem ou empresa real inválida')
        if not isinstance(prazo, datetime) or prazo.tzinfo is None or prazo.utcoffset() is None:
            raise ValueError('prazo real deve incluir fuso horário')
        if (not isinstance(dados_reais.get('pedido'), dict) or
                not isinstance(dados_reais.get('fontes_importadas'), dict) or
                not isinstance(dados_reais.get('decisoes'), list) or
                not isinstance(dados_reais.get('entradas_externas'), dict) or
                not isinstance(dados_reais.get('captura'), dict)):
            raise ValueError('captura, pedido, fontes, decisões e entradas externas reais obrigatórios')
        ordem_pedido = dados_reais['pedido'].get('ordem_de_servico')
        if not isinstance(ordem_pedido, dict) or ordem_pedido.get('pedido_original') != pedido_original:
            raise ValueError('pedido original diverge da observação real')
        proveniencia = dados_reais.get('proveniencia')
        if not isinstance(proveniencia, dict) or proveniencia.get('business_id') != business_id:
            raise ValueError('proveniência real da empresa obrigatória')
        for campo in ('project_ref', 'checkpoint_id', 'observado_em', 'tarefa_id', 'hash_sha256'):
            if not isinstance(proveniencia.get(campo), str) or not proveniencia[campo].strip():
                raise ValueError(f'proveniência real sem {campo}')
        if not isinstance(proveniencia.get('tarefa_row_version'), int) or proveniencia['tarefa_row_version'] < 1 or not re.fullmatch(r'[0-9a-f]{64}', proveniencia['hash_sha256']):
            raise ValueError('versão ou hash da proveniência real inválido')
        try:
            serializado = json.dumps(dados_reais, ensure_ascii=False, allow_nan=False)
        except (TypeError, ValueError, OverflowError) as erro:
            raise ValueError('dados reais não são JSON puro') from erro
        if len(serializado.encode('utf-8')) > 1_000_000:
            raise ValueError('dados reais excedem limite de 1 MB por card')
        solicitacao = self._linha('SELECT helena_v2.ler_solicitacao_card_real(%s::uuid) AS pedido',
                                  (solicitacao_id,))['pedido']
        if not solicitacao:
            raise RuntimeError('solicitação autenticada ausente')
        if not solicitacao.get('card_id') and prazo <= datetime.now(timezone.utc):
            raise ValueError('prazo real deve estar no futuro')
        prazo_solicitado = solicitacao.get('prazo')
        if isinstance(prazo_solicitado, str):
            prazo_solicitado = datetime.fromisoformat(prazo_solicitado.replace('Z', '+00:00'))
        if (solicitacao.get('origem') != origem or solicitacao.get('chave_origem') != chave_origem or
                solicitacao.get('business_id') != business_id or solicitacao.get('plano') != plano or
                solicitacao.get('dados_reais') != dados_reais or prazo_solicitado != prazo or
                solicitacao.get('titulo') != titulo or solicitacao.get('pedido_original') != pedido_original):
            raise ValueError('argumentos divergem da solicitação autenticada')
        if revisao_id is not None and str(revisao_id) != str(solicitacao.get('config_revision_id')):
            raise ValueError('revisão diverge da solicitação autenticada')
        # Repetir uma solicitação já consumida usa o pin original, mesmo após
        # o fundador ativar outra revisão; a RPC confere o roteiro idempotente.
        revisao = (self._carregar_revisao(solicitacao['config_revision_id'])[0]
                   if solicitacao.get('card_id') else
                   self._escolher_revisao(solicitacao.get('config_revision_id')))
        revisao_id = str(revisao['id'])
        _, spec, raiz = self._carregar_revisao(revisao_id)
        if business_id not in (plano.get('empresas') or []):
            raise ValueError('empresa fora do plano')
        from spec_helena.leitura import ler_yaml
        empresas = ler_yaml(raiz / 'organograma.yaml')['empresas']
        if (business_id not in empresas or
                empresas[business_id].get('pacote', {}).get('estado') != 'CONFIRMADO'):
            raise ValueError('pacote da empresa não confirmado na revisão')
        for etapa in plano.get('etapas') or []:
            servico = spec.servicos.get(etapa.get('servico'))
            if servico is None or business_id not in servico.get('empresas', []):
                raise ValueError(f"serviço não atende a empresa: {etapa.get('servico')}")
            entradas = set(etapa.get('entradas') or [])
            codigos = {e.get('id') for e in plano['etapas']}
            if not entradas <= codigos | dados_reais['entradas_externas'].keys():
                raise ValueError(f"etapa {etapa.get('id')} sem entrada externa observada")
        ordem = {**plano, 'config_revision_id': revisao_id, 'modo_contexto': 'real',
                 'origem': origem, 'chave_origem': chave_origem, 'pedido_original': pedido_original,
                 'business_id': business_id, 'dados_reais': dados_reais}
        erro = validar_plano(ordem, spec, raiz)
        if erro:
            raise ValueError(f'plano inválido: {erro}')
        roteiro = self._roteiro_do_banco(ordem, spec, raiz)
        with self._con() as con:
            with con.transaction():
                resposta = con.execute('SELECT helena_v2.consumir_solicitacao_card_real(%s::uuid,%s) AS resposta',
                                       (solicitacao_id, Jsonb(roteiro))).fetchone()['resposta']
                card_id = resposta['card_id']
                card = con.execute('SELECT * FROM helena_v2.card WHERE id=%s', (card_id,)).fetchone()
                if (card is None or card['titulo'] != titulo or card['empresa'] != business_id or
                        card['prazo'] != prazo or card['ordem_de_servico'] != ordem):
                    raise RuntimeError('solicitação retornou card incompatível com as entradas verificadas')
        return card_id

    def _modo_card(self, card_id):
        ordem = self._card(card_id)['ordem_de_servico']
        if ordem.get('modo_contexto') == 'real':
            if not callable(self.fonte_contexto) or isinstance(self.executor, ExecutorFalso):
                raise RuntimeError('despacho real exige fonte de contexto e executor injetados')
            self._conferir_fontes_real(card_id)
            return 'real'
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('despacho exige adaptador de contexto real')
        return 'sintetico'

    def _conferir_fontes_real(self, card_id, con=None):
        sql_verificar = 'SELECT helena_v2.conferir_fontes_card_real(%s::uuid) AS confere'
        if con is None:
            confere = self._linha(sql_verificar, (card_id,))['confere']
        else:
            confere = con.execute(sql_verificar, (card_id,)).fetchone()['confere']
        if confere is not True:
            raise RuntimeError('fontes reais do card não conferem com a captura')

    def _entradas_da_etapa(self, etapa, servico):
        """Retorna só as fontes e dependências declaradas para esta etapa."""
        card = self._card(etapa['card_id'])
        ordem = card['ordem_de_servico']
        dados = ordem['dados_reais']
        plano_etapa = next(e for e in ordem['etapas'] if e['id'] == etapa['codigo'])
        acoes_etapa = [a['acao_do_fundador'] for a in ordem.get('acoes_do_fundador', [])
                       if a.get('etapa') == etapa['codigo']]
        if len(acoes_etapa) > 1:
            raise ValueError('etapa tem mais de uma ação do fundador')
        plano_etapa = {**plano_etapa, **({'acao_do_fundador': acoes_etapa[0]} if acoes_etapa else {})}
        nomes = set(plano_etapa.get('entradas') or [])
        externas = dados['entradas_externas']
        ids_fontes = {'FON-PEDIDO-' + dados['proveniencia']['tarefa_id'],
                      'FON-PACOTE-' + ordem['business_id']}
        entradas = {}
        for nome in sorted(nomes & externas.keys()):
            insumo = externas[nome]
            if not isinstance(insumo, dict) or not isinstance(insumo.get('fonte_ids'), list):
                raise ValueError(f'entrada real sem fontes rastreáveis: {nome}')
            ids_fontes.update(insumo['fonte_ids'])
            entradas[nome] = insumo
        codigos = {e['id'] for e in ordem['etapas']}
        for codigo in sorted(nomes & codigos):
            if codigo not in plano_etapa.get('depende_de', []):
                raise ValueError(f'entrada {codigo} sem dependência declarada')
            with self._con() as con:
                linha = con.execute(
                    """SELECT e.conteudo FROM helena_v2.entrega e
                       JOIN helena_v2.etapa t ON t.id=e.etapa_id
                      WHERE t.card_id=%s AND t.codigo=%s AND t.atual
                        AND t.estado IN ('APROVADA','PRONTA') AND e.portao1='PASSOU'
                      ORDER BY e.id DESC LIMIT 1""", (etapa['card_id'], codigo)).fetchone()
            if not linha:
                raise RuntimeError(f'entrega aprovada da dependência {codigo} ausente')
            entradas[codigo] = linha['conteudo']['resposta']
        fontes = dados['fontes_importadas']
        if not ids_fontes <= fontes.keys() or any(not isinstance(fontes[i], str) for i in ids_fontes):
            raise ValueError('fontes reais obrigatórias ausentes')
        origem_pedido = dados['pedido']['ordem_de_servico']
        permitidos = ('prazo', 'prioridade', 'prioridade_na_fonte', 'o_que_quer',
                      'como_e_o_pronto', 'definicao_de_pronto_na_fonte', 'nao_pode',
                      'fontes_que_pode_ler')
        ordem_filtrada = {campo: origem_pedido[campo] for campo in permitidos if campo in origem_pedido}
        ordem_filtrada.update({'pedido_original': ordem['pedido_original'],
                              'empresa': ordem['business_id'], 'etapa_codigo': etapa['codigo'],
                              'objetivo': plano_etapa.get('objetivo'), 'titulo': card['titulo'],
                              'prazo': self._instante_brasilia(card['prazo'])})
        plano_origem = dados['pedido'].get('plano') or {}
        plano_filtrado = {campo: plano_origem[campo] for campo in
                          ('id', 'versao', 'orcamento_meta', 'acoes_do_fundador',
                           'passos_fixos_do_fundador') if campo in plano_origem}
        plano_filtrado['etapas'] = [plano_etapa]
        pedido = {'card_id': str(etapa['card_id']), 'empresa': ordem['business_id'],
                  'criado_em': self._instante_brasilia(card['criado_em']),
                  'ordem_de_servico': ordem_filtrada,
                  'plano': plano_filtrado, 'entradas': entradas}
        if 'pacote_da_empresa' in dados['pedido']:
            pedido['pacote_da_empresa'] = dados['pedido']['pacote_da_empresa']
        decisoes_necessarias = set(ordem.get('decisoes') or [])
        decisoes = [d for d in dados['decisoes'] if isinstance(d, dict) and d.get('id') in decisoes_necessarias]
        if {d['id'] for d in decisoes} != decisoes_necessarias:
            raise ValueError('decisão vigente exigida pelo plano ausente')
        return pedido, {i: fontes[i] for i in ids_fontes}, decisoes

    def _roteiro_do_banco(self, plano, spec, raiz):
        etapas = []
        for e in plano['etapas']:
            s = spec.servicos[e['servico']]
            ficha = self._ficha(s['dono'], 'AUTOR', e['servico'], raiz)
            tipos_julgados = set(s.get('julga_tipos') or [])
            julgadas = [outra['id'] for outra in plano['etapas'] if outra['id'] in e.get('depende_de', [])
                        and spec.tipo_do_servico(outra['servico']) in tipos_julgados]
            etapas.append({**e, 'nome': e.get('objetivo', e['id'])[:100], 'autor': s['dono'],
                           'revisores': [s['revisor'], s['reserva'], 'FUNDADOR'],
                           'julga': julgadas,
                           'internet': bool(s['usa_internet']), 'pulavel': bool(s['pode_ser_pulada']),
                           'acoes_permitidas': s['acoes_permitidas'],
                           'tempo_maximo_s': ficha.orcamento.tempo_s,
                           'prazo_revisao_s': self._ficha(s['revisor'], 'REVISOR', e['servico'], raiz).orcamento.tempo_s})
        return {'etapas': etapas}

    def _texto_roteirizado(self, execucao):
        pacote = json.loads(execucao.pacote)
        revisao_id = pacote.get('config_revision_id')
        if not revisao_id:
            raise RuntimeError('despacho sem revisão de configuração fixada')
        spec = self._carregar_revisao(revisao_id)[1]
        if execucao.ficha.papel == 'COORDENACAO':
            return json.dumps({'leitura_de_volta': 'Entendi o pedido e o prazo.'})
        if execucao.ficha.papel == 'REVISOR':
            servico = pacote['servico']
            return json.dumps({'criterios': [{'id': c, 'resultado': 'PASSOU', 'prova': 'entrega conferida'}
                                            for c in spec.tipo(spec.tipo_do_servico(servico))['criterio_de_pronto']['rubrica']]})
        caso = self._caso(execucao.ficha.servico, spec)
        return montar_resposta(caso)

    def _caso(self, servico, spec):
        if not getattr(self, 'permitir_casos_sinteticos', False):
            raise RuntimeError('corpus sintético exige opt-in local explícito')
        fixture_spec = getattr(self, '_fixture_spec', spec)
        casos = [c for c in listar_casos(fixture_spec) if c.servico == servico]
        bons = [c for c in casos if c.bom]
        if not bons:
            raise ValueError(f'sem caso bom para {servico}')
        escolhido = self.casos.get(servico)
        if escolhido:
            return next(c for c in casos if c.id == escolhido)
        if servico == 'SRV-PARECER':
            return next(c for c in bons if c.dados['resposta'].get('parecer') == 'OK')
        return bons[0]

    def _ficha(self, identidade, papel, servico, raiz):
        return ler_ficha(raiz / 'agents' / f'{identidade.lower()}.yaml',
                         caminho_dos_modelos=raiz / 'models.yaml', fase_em_curso='fase 3',
                         papel=papel, servico=servico if papel == 'AUTOR' else None,
                         evento=servico if papel == 'COORDENACAO' else None)

    def _servico(self, etapa):
        plano = self._card(etapa['card_id'])['ordem_de_servico']
        return next(e['servico'] for e in plano['etapas'] if e['id'] == etapa['codigo'])

    @staticmethod
    def _faltas_do_autor_real(servico):
        # O contrato confirmado atual não traz números tipados para cálculo nem
        # tabela de leis publicada para parecer. Texto de job não preenche lacunas.
        if servico == 'SRV-CALCULO':
            return ['taxa efetiva, horas, pagador, beneficiário, período e moeda com fonte aprovada']
        if servico == 'SRV-PARECER':
            return ['tabela de leis publicada com versão e data',
                    'peças julgadas integrais e versionadas, passos fixos e termos autorizados']
        return []

    def executar_e_salvar(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] == 'EM_RESOLUCAO':
            registro = self._linha(
                """SELECT 1 AS registrado FROM helena_v2.historico
                   WHERE alvo_id=%s AND papel='AUTOR' AND evento='REGISTRAR_FALHA'
                     AND chave=%s AND conteudo->>'motivo'='INSUMOS_INSUFICIENTES'
                   ORDER BY id DESC LIMIT 1""", (etapa_id, numero))
            if registro:
                return None
        modo = self._modo_card(etapa['card_id'])
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('execução antiga ou etapa não executando')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        revisao, spec, raiz = self._ambiente_card(etapa['card_id'])
        servico = self._servico(etapa)
        if modo == 'real' and (faltas := self._faltas_do_autor_real(servico)):
            self._evento('etapa', etapa_id, 'AUTOR', 'REGISTRAR_FALHA',
                         {'motivo_falha': 'FALTAM_DADOS', 'usou_internet': 'NAO'},
                         ator=etapa['autor'], chave=numero,
                         conteudo={'motivo': 'INSUMOS_INSUFICIENTES', 'faltam': faltas})
            return None
        ficha = self._ficha(etapa['autor'], 'AUTOR', servico, raiz)
        if modo == 'real':
            pedido, fontes, decisoes = self._entradas_da_etapa(etapa, servico)
            execucao_id = f'{etapa["codigo"]}-{numero}'
            hoje = datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
            contexto = self.fonte_contexto(spec, servico, pedido=pedido, fontes_importadas=fontes,
                                           decisoes=decisoes, execucao_id=execucao_id,
                                           paginas_lidas=[], usou_internet=False, hoje=hoje)
        else:
            caso = self._caso(servico, spec)
            contexto = montar_contexto(spec, caso)
            contexto['execucao_id'] = str(numero)
            for pagina in contexto['paginas_lidas']:
                pagina['execucao'] = str(numero)
        carga = {'servico': servico, 'config_revision_id': str(revisao['id']),
                 'pedido': contexto['pedido'], 'modelo': contexto['modelo']}
        if modo == 'real':
            carga.update({'fontes_importadas': contexto['fontes_importadas'],
                          'decisoes_vigentes': contexto['decisoes_vigentes'],
                          'pacote_da_empresa': contexto.get('pacote_da_empresa')})
        pacote = json.dumps(carga, ensure_ascii=False)
        resultado = self._rodar_vigiado(Execucao(
            id=f'{etapa["codigo"]}-{numero}', ficha=ficha, pacote=pacote,
            fontes_permitidas=tuple(pedido['ordem_de_servico'].get('fontes_que_pode_ler') or ())
            if modo == 'real' else None), 'etapa', etapa_id, numero)
        if not resultado.ok or not resultado.texto:
            self._evento('etapa', etapa_id, 'MOTOR', 'FALHA',
                         {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('executor falhou')
        provas = None
        if modo == 'real':
            try:
                provas = coletar_evidencias(resultado, execucao_id)
            except EvidenciaInvalida as exc:
                self._evento('etapa', etapa_id, 'MOTOR', 'FALHA',
                             {'classe': 'DESCONHECIDA'},
                             conteudo={'motivo': 'EVIDENCIA_INVALIDA'})
                raise RuntimeError('evidência do autor inválida') from exc
            if provas['usou_internet'] is None:
                self._evento('etapa', etapa_id, 'MOTOR', 'FALHA',
                             {'classe': 'DESCONHECIDA'},
                             conteudo={'motivo': 'INTERNET_NAO_COMPROVADA'})
                raise RuntimeError('executor não informou se usou internet')
            contexto = self.fonte_contexto(spec, servico, pedido=pedido, fontes_importadas=fontes,
                                           decisoes=decisoes, execucao_id=execucao_id,
                                           paginas_lidas=provas['paginas_lidas'],
                                           usou_internet=provas['usou_internet'], hoje=hoje)
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico, 'contexto': contexto,
                                    'config_revision_id': str(revisao['id']),
                                    **({'conversa': provas['conversa'], 'uso': provas['uso']} if provas else {})})))
        if modo == 'real' and callable(getattr(self.executor, 'limpar', None)):
            self.executor.limpar(resultado)
        return numero

    def _ja_aplicado(self, etapa_id, numero, papel):
        """True se um evento deste `papel` com a chave `numero` já foi aplicado nesta etapa.

        É a queda que acontece DEPOIS de o banco confirmar o evento e ANTES de o DBOS anotar o passo: ao retomar, o passo
        roda de novo, encontra a etapa já adiante e não pode virar erro nem repetir o efeito."""
        return self._linha(
            "SELECT EXISTS (SELECT 1 FROM helena_v2.historico WHERE alvo_id=%s AND papel=%s AND chave=%s "
            "AND resultado IN ('APLICADO','CONVERTIDO')) AS ja", (etapa_id, papel, numero))['ja']

    def conferir_e_aplicar(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        modo = self._modo_card(etapa['card_id'])
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
            if self._ja_aplicado(etapa_id, numero, 'AUTOR'):
                return etapa['estado']                  # retomada depois da queda: o evento do autor já valeu
            raise RuntimeError('execução antiga ou cancelada')
        salva = self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta']
        if not salva:
            raise RuntimeError('resposta não persistida')
        if salva.get('config_revision_id') != str(self._ambiente_card(etapa['card_id'])[0]['id']):
            raise RuntimeError('resposta pertence a outra revisão de configuração')
        contexto = salva['contexto']
        relatorio = validar(salva['texto'], contexto)
        try:
            resposta = json.loads(salva['texto'])
        except (ValueError, TypeError):
            resposta = None
        conteudo_resposta = resposta if isinstance(resposta, dict) else salva['texto']
        if not isinstance(resposta, dict):
            resposta = {}
        acao_externa = resposta.get('acao_externa')
        tipo_acao = acao_externa.get('tipo') if isinstance(acao_externa, dict) else None
        parecer = resposta.get('parecer')
        def aplicar(con=None):
            acao = resposta.get('acao')
            if acao in ('PERGUNTAR', 'REGISTRAR_FALHA', 'DEVOLVER_A_QUEM_PEDIU'):
                if not relatorio.aprovada:
                    self._evento('etapa', etapa_id, 'MOTOR', 'FALHA',
                                 {'classe': 'FORMATO_ERRADO'},
                                 conteudo={'validacao': relatorio.para_dict()}, con=con)
                else:
                    params = {'usou_internet': contexto['usou_internet']}
                    if acao == 'REGISTRAR_FALHA':
                        params['motivo_falha'] = resposta['motivo_falha']
                    self._evento('etapa', etapa_id, 'AUTOR', acao, params,
                                 ator=etapa['autor'], chave=numero,
                                 conteudo={'resposta': resposta}, con=con)
                if con:
                    return con.execute('SELECT estado FROM helena_v2.etapa WHERE id=%s',
                                       (etapa_id,)).fetchone()['estado']
                return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s',
                                   (etapa_id,))['estado']
            self._evento('etapa', etapa_id, 'AUTOR', 'ENTREGAR',
                         {'parecer': parecer if parecer in ('OK', 'AJUSTE', 'NAO_PODE') else 'OK',
                          'acao_externa': tipo_acao if tipo_acao in ('NENHUMA', 'SO_FUNDADOR', 'PELO_MOTOR') else 'NENHUMA',
                          'usou_internet': contexto['usou_internet']}, ator=etapa['autor'], chave=numero,
                         conteudo={'resposta': conteudo_resposta}, con=con)
            if relatorio.aprovada:
                atual = (con.execute('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,)).fetchone()
                         if con else self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,)))
                self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_OK',
                             {'escolhido': atual['revisores_validos'][0]},
                             conteudo=relatorio.para_dict(), con=con)
            else:
                self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_RECUSOU',
                             conteudo=relatorio.para_dict(), con=con)
            if con:
                return con.execute('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,)).fetchone()['estado']
            return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']

        if modo == 'real':
            with self._con() as con:
                with con.transaction():
                    self._conferir_fontes_real(etapa['card_id'], con=con)
                    return aplicar(con)
        with self._con() as con:                        # sintético também é atômico: a queda entre ENTREGAR e PORTAO1 não deixa a etapa presa
            with con.transaction():
                return aplicar(con)

    def executar_etapa(self, etapa_id):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        self._modo_card(etapa['card_id'])
        if etapa['estado'] == 'REVISAO':
            return 'REVISAO'
        if etapa['estado'] != 'EXECUTANDO':
            raise RuntimeError('execução antiga ou cancelada')
        numero = etapa['execucao_atual']
        if numero is None:
            raise RuntimeError('etapa sem execução atual')
        revisao_id = self._ambiente_card(etapa['card_id'])[0]['id']
        with SetWorkflowID(f'{self.versao_codigo}-{revisao_id}-{etapa_id}-{numero}'):
            return self.dbos.start_workflow(fluxo_etapa, str(etapa_id), numero).get_result()

    @staticmethod
    def _instante_brasilia(valor):
        return valor.astimezone(ZoneInfo('America/Sao_Paulo')).isoformat()

    @staticmethod
    def _pedido_coordenacao_real(card):
        ordem = card['ordem_de_servico']
        origem = ordem['dados_reais']['pedido']['ordem_de_servico']
        campos = ('prioridade_na_fonte', 'o_que_quer', 'como_e_o_pronto', 'nao_pode',
                  'fontes_que_pode_ler')
        return {'pedido_original': ordem['pedido_original'],
                'business_id': ordem['business_id'], 'titulo': card['titulo'],
                'card_id': str(card['id']), 'prazo': Motor._instante_brasilia(card['prazo']),
                'criado_em': Motor._instante_brasilia(card['criado_em']),
                'ordem_de_servico': {**{campo: origem[campo] for campo in campos if campo in origem},
                                    'pedido_original': ordem['pedido_original'],
                                    'prazo': Motor._instante_brasilia(card['prazo'])}}

    def executar_e_salvar_coordenacao(self, card_id, chave):
        salva = self._linha('SELECT helena_v2.ler_resposta_coordenacao(%s) AS resposta',
                            (chave,))['resposta']
        if salva is not None:
            if salva.get('card_id') != str(card_id):
                raise RuntimeError('resposta da coordenação pertence a outro card')
            return chave
        card = self._card(card_id)
        modo = self._modo_card(card_id)
        if card['estado'] != 'RASCUNHO' or card['chamada_helena'] != chave:
            raise RuntimeError('chamada da coordenação antiga ou cancelada')
        revisao, _spec, raiz = self._ambiente_card(card_id)
        ficha = self._ficha('HELENA', 'COORDENACAO', 'LER_DE_VOLTA', raiz)
        pedido = (self._pedido_coordenacao_real(card) if modo == 'real'
                  else card['ordem_de_servico'])
        execucao_id = f'C-{chave}'
        resultado = self._rodar_vigiado(Execucao(
            id=execucao_id, ficha=ficha,
            pacote=json.dumps({'card_id': str(card_id),
                                'config_revision_id': str(revisao['id']),
                                'pedido': pedido}, ensure_ascii=False),
            fontes_permitidas=() if modo == 'real' else None), 'card', card_id, chave)
        if not resultado.ok or not resultado.texto:
            self._evento('card', card_id, 'MOTOR', 'FALHA', {'classe': 'DESCONHECIDA'})
            raise RuntimeError('coordenadora falhou')
        try:
            provas = coletar_evidencias(resultado, execucao_id) if modo == 'real' else None
        except EvidenciaInvalida as exc:
            self._evento('card', card_id, 'MOTOR', 'FALHA', {'classe': 'DESCONHECIDA'},
                         conteudo={'motivo': 'EVIDENCIA_INVALIDA'})
            raise RuntimeError('evidência da coordenação inválida') from exc
        if provas is not None and provas['usou_internet'] is not False:
            self._evento('card', card_id, 'MOTOR', 'FALHA', {'classe': 'DESCONHECIDA'},
                         conteudo={'motivo': 'INTERNET_NAO_COMPROVADA'})
            raise RuntimeError('coordenação sem ferramentas exige ausência comprovada de internet')
        resposta = {'texto': resultado.texto, 'evidencias': provas or {},
                    'config_revision_id': str(revisao['id']), 'card_id': str(card_id)}
        self._linha('SELECT helena_v2.registrar_resposta_coordenacao(%s,%s) AS resposta',
                    (chave, Jsonb(resposta)))
        if modo == 'real' and callable(getattr(self.executor, 'limpar', None)):
            self.executor.limpar(resultado)
        return chave

    def conferir_e_aplicar_coordenacao(self, card_id, chave):
        salva = self._linha('SELECT helena_v2.ler_resposta_coordenacao(%s) AS resposta',
                            (chave,))['resposta']
        if not salva or salva.get('card_id') != str(card_id):
            raise RuntimeError('resposta da coordenação ausente ou de outro card')
        card = self._card(card_id)
        if salva.get('config_revision_id') != str(self._ambiente_card(card_id)[0]['id']):
            raise RuntimeError('resposta da coordenação pertence a outra configuração')
        with self._con() as con:
            with con.transaction():
                if (card['ordem_de_servico'].get('modo_contexto') == 'real'
                        and card['estado'] == 'RASCUNHO'):
                    self._conferir_fontes_real(card_id, con=con)
                resultado = con.execute(
                    'SELECT helena_v2.aplicar_resposta_coordenacao(%s) AS resultado',
                    (chave,)).fetchone()['resultado']
                if resultado['resultado'] not in ('APLICADO', 'CONVERTIDO'):
                    raise RuntimeError(f'leitura de volta recusada: {resultado}')
                return resultado['estado']

    def avancar(self, card_id):
        modo = self._modo_card(card_id)
        card = self._card(card_id)
        if card['estado'] == 'RASCUNHO':
            revisao_id = self._ambiente_card(card_id)[0]['id']
            chave = self._linha('SELECT helena_v2.obter_chamada_coordenacao(%s::uuid) AS chave',
                                 (card_id,))['chave']
            with SetWorkflowID(f'{self.versao_codigo}-{revisao_id}-coordenacao-{card_id}-{chave}'):
                self.dbos.start_workflow(fluxo_coordenacao, str(card_id), chave).get_result()
            return True
        if card['estado'] == 'VALIDANDO_PLANO':
            _revisao, spec, raiz = self._ambiente_card(card_id)
            erro = validar_plano(card['ordem_de_servico'], spec, raiz,
                                 permitir_rascunho=self.permitir_servico_rascunho)
            return self._evento_de_vista_atrasada(
                'card', card_id, 'MOTOR', 'PLANO_INVALIDO' if erro else 'PLANO_VALIDO',
                conteudo={'motivo': erro} if erro else None, card_id_real=card_id if modo == 'real' else None)
        if card['estado'] != 'EM_ANDAMENTO':
            return False
        for etapa in self._etapas(card_id):
            estado = etapa['estado']
            if estado == 'AGUARDANDO_ANTERIORES':
                with self._con() as con:
                    deps = con.execute('SELECT bool_and(estado IN (%s,%s)) AS pronto FROM helena_v2.etapa WHERE card_id=%s AND atual AND codigo=ANY(%s)',
                                       ('APROVADA', 'PRONTA', card_id, etapa['depende_de'])).fetchone()['pronto']
                if not etapa['depende_de'] or deps:
                    return self._evento_de_vista_atrasada(
                        'etapa', etapa['id'], 'MOTOR', 'DEPENDENCIAS_PRONTAS', card_id_real=card_id if modo == 'real' else None)
            elif estado == 'NA_FILA':
                return self._evento_de_vista_atrasada(
                    'etapa', etapa['id'], 'MOTOR', 'INICIAR_EXECUCAO', card_id_real=card_id if modo == 'real' else None)
            elif estado == 'EXECUTANDO':
                self.executar_etapa(etapa['id'])
                return True
            elif estado == 'REVISAO':
                self._revisar(etapa)
                return True
        return False

    def _revisar(self, etapa):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        modo = self._modo_card(etapa['card_id'])
        if etapa['estado'] != 'REVISAO':
            return etapa['estado']
        if etapa['execucao_atual'] is None:
            if not self._evento_de_vista_atrasada('etapa', etapa['id'], 'MOTOR', 'INICIAR_REVISAO',
                                                  card_id_real=etapa['card_id'] if modo == 'real' else None):
                return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))['estado']
            etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        revisao_id = self._ambiente_card(etapa['card_id'])[0]['id']
        with SetWorkflowID(f'{self.versao_codigo}-{revisao_id}-{etapa["id"]}-{etapa["execucao_atual"]}'):
            return self.dbos.start_workflow(fluxo_revisao, str(etapa['id']), etapa['execucao_atual']).get_result()

    def executar_e_salvar_revisao(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        modo = self._modo_card(etapa['card_id'])
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('revisão antiga ou cancelada')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        revisao, spec, raiz = self._ambiente_card(etapa['card_id'])
        servico = self._servico(etapa)
        revisor = etapa['revisor']
        ficha = self._ficha(revisor, 'REVISOR', servico, raiz)
        pacote = {'servico': servico, 'entrega_id': str(etapa['id']),
                  'config_revision_id': str(revisao['id'])}
        if modo == 'real':
            with self._con() as con:
                entrega = con.execute(
                    """SELECT conteudo, numero_execucao FROM helena_v2.entrega
                       WHERE etapa_id=%s AND portao1='PASSOU' ORDER BY id DESC LIMIT 1""",
                    (etapa_id,)).fetchone()
            if not entrega:
                raise RuntimeError('revisor real exige entrega que passou portão 1')
            resposta_autor = self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta',
                                         (entrega['numero_execucao'],))['resposta']
            if not resposta_autor or resposta_autor.get('config_revision_id') != str(revisao['id']):
                raise RuntimeError('contexto do autor ausente ou de outra revisão')
            pacote.update({'pedido': resposta_autor['contexto']['pedido'],
                           'contexto': resposta_autor['contexto'],
                           'entrega': entrega['conteudo']['resposta'],
                           'rubrica': spec.tipo(spec.tipo_do_servico(servico))['criterio_de_pronto']['rubrica']})
        resultado = self._rodar_vigiado(Execucao(
            id=f'{etapa["codigo"]}-{numero}', ficha=ficha,
            pacote=json.dumps(pacote, ensure_ascii=False),
            fontes_permitidas=tuple(pacote['pedido']['ordem_de_servico'].get('fontes_que_pode_ler') or ())
            if modo == 'real' else None), 'etapa', etapa_id, numero)
        if not resultado.ok:
            self._evento('etapa', etapa['id'], 'MOTOR', 'FALHA',
                         {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('revisor falhou')
        provas = None
        if modo == 'real':
            try:
                provas = coletar_evidencias(resultado, f'{etapa["codigo"]}-{numero}')
            except EvidenciaInvalida as exc:
                self._evento('etapa', etapa['id'], 'MOTOR', 'FALHA',
                             {'classe': 'DESCONHECIDA'},
                             conteudo={'motivo': 'EVIDENCIA_INVALIDA'})
                raise RuntimeError('evidência do revisor inválida') from exc
            if provas['usou_internet'] is None:
                self._evento('etapa', etapa['id'], 'MOTOR', 'FALHA',
                             {'classe': 'DESCONHECIDA'},
                             conteudo={'motivo': 'INTERNET_NAO_COMPROVADA'})
                raise RuntimeError('revisor não informou se usou internet')
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico,
                                    'config_revision_id': str(revisao['id']),
                                    **({'evidencias': provas} if provas else {})})))
        if modo == 'real' and callable(getattr(self.executor, 'limpar', None)):
            self.executor.limpar(resultado)
        return numero

    def conferir_e_aplicar_revisao(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        modo = self._modo_card(etapa['card_id'])
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
            if self._ja_aplicado(etapa_id, numero, 'REVISOR'):
                return etapa['estado']                  # retomada depois da queda: a aprovação do revisor já valeu
            raise RuntimeError('revisão antiga ou cancelada')
        salva = self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta']
        if not salva:
            raise RuntimeError('revisão não persistida')
        if salva.get('config_revision_id') != str(self._ambiente_card(etapa['card_id'])[0]['id']):
            raise RuntimeError('revisão de agente pertence a outra configuração')
        rubrica = json.loads(salva['texto'])['criterios']
        spec = self._ambiente_card(etapa['card_id'])[1]
        if not conferir_rubrica(spec, salva['servico'], rubrica):
            raise RuntimeError('revisor não aprovou todos os critérios com prova')
        if modo == 'real':
            with self._con() as con:
                with con.transaction():
                    self._conferir_fontes_real(etapa['card_id'], con=con)
                    self._evento('etapa', etapa['id'], 'REVISOR', 'APROVAR',
                                 ator=etapa['revisor'], chave=numero,
                                 conteudo={'criterios': rubrica}, con=con)
                    return con.execute('SELECT estado FROM helena_v2.etapa WHERE id=%s',
                                       (etapa_id,)).fetchone()['estado']
        self._evento('etapa', etapa['id'], 'REVISOR', 'APROVAR', ator=etapa['revisor'], chave=numero,
                     conteudo={'criterios': rubrica})
        return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']
