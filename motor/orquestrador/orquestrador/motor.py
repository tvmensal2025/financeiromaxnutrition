"""Um despacho DBOS por execução; somente funções do banco decidem estado."""
import json
import errno
import os
import shutil
import tempfile
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dbos import DBOS, DBOSConfig, SetWorkflowID

from executor_helena.executor_falso import ExecutorFalso, Roteiro
from executor_helena.ficha import ler_ficha
from executor_helena.tipos import Execucao
from spec_helena import Spec, listar_casos, montar_contexto, montar_resposta
from validador import validar
from .configuracao import capturar_bundle, carregar_revisao, hash_bundle, validar_bundle, verificar_revisao
from .plano import RAIZ, validar_plano

_MOTOR = None
VERSAO_CODIGO = 'primeiro-card-2-config'
_BUNDLES_VALIDADOS: set[str] = set()


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
    executar_e_salvar(etapa_id, numero)
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


def conferir_rubrica(spec, servico, criterios) -> bool:
    esperados = set(spec.tipo(spec.tipo_do_servico(servico))['criterio_de_pronto']['rubrica'])
    if not isinstance(criterios, list) or len(criterios) != len(esperados):
        return False
    return ({c.get('id') for c in criterios if isinstance(c, dict)} == esperados
            and all(c.get('resultado') == 'PASSOU' and isinstance(c.get('prova'), str)
                    and c['prova'].strip() for c in criterios if isinstance(c, dict)))


class Motor:
    def __init__(self, url_banco: str, url_dbos: str, casos: dict[str, str] | None = None, executor=None,
                 *, permitir_configuracao_tecnica=False, permitir_servico_rascunho=False,
                 permitir_executor_falso=False, permitir_casos_sinteticos=False):
        if not url_banco or not url_dbos:
            raise ValueError('motor exige banco do card e banco DBOS separados')
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
        global _MOTOR
        _MOTOR = self
        self.dbos = DBOS(config=DBOSConfig(name='helena-v2-primeiro-card', system_database_url=url_dbos,
                                           application_version=VERSAO_CODIGO))
        self.dbos.launch()

    def fechar(self):
        self.dbos.destroy()
        self._pasta_snapshots.cleanup()
        global _MOTOR
        _MOTOR = None

    def _con(self, papel='service_role'):
        if papel == 'authenticated':
            raise RuntimeError('contexto de identidade do fundador deve ser injetado')
        con = psycopg.connect(self.url_banco, autocommit=True, row_factory=dict_row)
        if papel:
            con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(papel)))
        return con

    def _linha(self, sql, args=(), papel='service_role'):
        with self._con(papel) as con:
            return con.execute(sql, args).fetchone()

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
                *, automaticos=True, nao_disparar=None, toque=None):
        if maquina not in ('card', 'etapa', 'acao_externa'):
            raise ValueError('máquina desconhecida')
        versao = None
        if papel == 'FUNDADOR':
            versao = self._linha(f'SELECT versao FROM helena_v2.{maquina} WHERE id=%s', (alvo,))['versao']
        with self._con('authenticated' if papel == 'FUNDADOR' else 'service_role') as con:
            resposta = con.execute('SELECT helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                                   (maquina, alvo, papel, evento, Jsonb(params or {}), ator, chave, versao,
                                    Jsonb(conteudo) if conteudo is not None else None, toque,
                                    automaticos, nao_disparar or [])).fetchone()['aplicar_evento']
        if resposta['resultado'] not in ('APLICADO', 'CONVERTIDO'):
            raise RuntimeError(f'{maquina} {evento}: {resposta}')
        return resposta

    def _etapas(self, card_id):
        with self._con() as con:
            return con.execute('SELECT * FROM helena_v2.etapa WHERE card_id=%s AND atual ORDER BY ordem', (card_id,)).fetchall()

    def _card(self, card_id):
        return self._linha('SELECT * FROM helena_v2.card WHERE id=%s', (card_id,))

    def criar_card(self, plano, numero='primeiro-card-teste', revisao_id=None):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('criação de card exige adaptador de contexto real; casos sintéticos só com opt-in local')
        from datetime import datetime, timedelta, timezone
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

    def executar_e_salvar(self, etapa_id, numero):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('autor exige adaptador de contexto real')
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('execução antiga ou etapa não executando')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        revisao, spec, raiz = self._ambiente_card(etapa['card_id'])
        servico = self._servico(etapa)
        ficha = self._ficha(etapa['autor'], 'AUTOR', servico, raiz)
        caso = self._caso(servico, spec)
        contexto = montar_contexto(spec, caso)
        contexto['execucao_id'] = str(numero)
        for pagina in contexto['paginas_lidas']:
            pagina['execucao'] = str(numero)
        pacote = json.dumps({'servico': servico, 'config_revision_id': str(revisao['id']), 'pedido': contexto['pedido'],
                             'modelo': contexto['modelo']}, ensure_ascii=False)
        resultado = self.executor.rodar(Execucao(id=f'{etapa["codigo"]}-{numero}', ficha=ficha, pacote=pacote))
        if not resultado.ok or not resultado.texto:
            self._evento('etapa', etapa_id, 'MOTOR', 'FALHA', {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('executor falhou')
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico, 'contexto': contexto,
                                    'config_revision_id': str(revisao['id'])})))
        return numero

    def conferir_e_aplicar(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
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
        self._evento('etapa', etapa_id, 'AUTOR', 'ENTREGAR',
                     {'parecer': parecer if parecer in ('OK', 'AJUSTE', 'NAO_PODE') else 'OK',
                      'acao_externa': tipo_acao if tipo_acao in ('NENHUMA', 'SO_FUNDADOR', 'PELO_MOTOR') else 'NENHUMA',
                      'usou_internet': contexto['usou_internet']}, ator=etapa['autor'], chave=numero,
                     conteudo={'resposta': conteudo_resposta})
        if relatorio.aprovada:
            atual = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
            self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_OK', {'escolhido': atual['revisores_validos'][0]},
                         conteudo=relatorio.para_dict())
        else:
            self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_RECUSOU', conteudo=relatorio.para_dict())
        return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']

    def executar_etapa(self, etapa_id):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('despacho exige adaptador de contexto real')
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] == 'REVISAO':
            return 'REVISAO'
        if etapa['estado'] != 'EXECUTANDO':
            raise RuntimeError('execução antiga ou cancelada')
        numero = etapa['execucao_atual']
        if numero is None:
            raise RuntimeError('etapa sem execução atual')
        revisao_id = self._ambiente_card(etapa['card_id'])[0]['id']
        with SetWorkflowID(f'{VERSAO_CODIGO}-{revisao_id}-{etapa_id}-{numero}'):
            return self.dbos.start_workflow(fluxo_etapa, str(etapa_id), numero).get_result()

    def avancar(self, card_id):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('avanço exige adaptador de contexto real')
        card = self._card(card_id)
        if card['estado'] == 'RASCUNHO':
            revisao, _spec, raiz = self._ambiente_card(card_id)
            chave = self._linha('SELECT helena_v2.abrir_chamada_helena(%s,%s) AS chave', ('card', card_id))['chave']
            ficha = self._ficha('HELENA', 'COORDENACAO', 'LER_DE_VOLTA', raiz)
            resultado = self.executor.rodar(Execucao(id=f'C-{chave}', ficha=ficha,
                                                   pacote=json.dumps({'card_id': str(card_id),
                                                                      'config_revision_id': str(revisao['id']),
                                                                      'pedido': card['ordem_de_servico']}, ensure_ascii=False)))
            if not resultado.ok:
                self._evento('card', card_id, 'MOTOR', 'FALHA')
                return True
            self._evento('card', card_id, 'HELENA', 'LER_DE_VOLTA', chave=chave,
                         conteudo={'resposta': json.loads(resultado.texto)}, nao_disparar=['PLANO_VALIDO'])
            return True
        if card['estado'] == 'VALIDANDO_PLANO':
            _revisao, spec, raiz = self._ambiente_card(card_id)
            erro = validar_plano(card['ordem_de_servico'], spec, raiz,
                                 permitir_rascunho=self.permitir_servico_rascunho)
            self._evento('card', card_id, 'MOTOR', 'PLANO_INVALIDO' if erro else 'PLANO_VALIDO',
                         conteudo={'motivo': erro} if erro else None)
            return True
        if card['estado'] != 'EM_ANDAMENTO':
            return False
        for etapa in self._etapas(card_id):
            estado = etapa['estado']
            if estado == 'AGUARDANDO_ANTERIORES':
                with self._con() as con:
                    deps = con.execute('SELECT bool_and(estado IN (%s,%s)) AS pronto FROM helena_v2.etapa WHERE card_id=%s AND atual AND codigo=ANY(%s)',
                                       ('APROVADA', 'PRONTA', card_id, etapa['depende_de'])).fetchone()['pronto']
                if not etapa['depende_de'] or deps:
                    self._evento('etapa', etapa['id'], 'MOTOR', 'DEPENDENCIAS_PRONTAS')
                    return True
            elif estado == 'NA_FILA':
                self._evento('etapa', etapa['id'], 'MOTOR', 'INICIAR_EXECUCAO')
                return True
            elif estado == 'EXECUTANDO':
                self.executar_etapa(etapa['id'])
                return True
            elif estado == 'REVISAO':
                self._revisar(etapa)
                return True
        return False

    def _revisar(self, etapa):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('revisão exige adaptador de contexto real')
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        if etapa['estado'] != 'REVISAO':
            return etapa['estado']
        if etapa['execucao_atual'] is None:
            self._evento('etapa', etapa['id'], 'MOTOR', 'INICIAR_REVISAO')
            etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        revisao_id = self._ambiente_card(etapa['card_id'])[0]['id']
        with SetWorkflowID(f'{VERSAO_CODIGO}-{revisao_id}-{etapa["id"]}-{etapa["execucao_atual"]}'):
            return self.dbos.start_workflow(fluxo_revisao, str(etapa['id']), etapa['execucao_atual']).get_result()

    def executar_e_salvar_revisao(self, etapa_id, numero):
        if not self.permitir_casos_sinteticos:
            raise RuntimeError('revisor exige adaptador de contexto real')
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('revisão antiga ou cancelada')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        revisao, _spec, raiz = self._ambiente_card(etapa['card_id'])
        servico = self._servico(etapa)
        revisor = etapa['revisor']
        ficha = self._ficha(revisor, 'REVISOR', servico, raiz)
        resultado = self.executor.rodar(Execucao(id=f'{etapa["codigo"]}-{numero}', ficha=ficha,
                                               pacote=json.dumps({'servico': servico, 'entrega_id': str(etapa['id']),
                                                                  'config_revision_id': str(revisao['id'])})))
        if not resultado.ok:
            self._evento('etapa', etapa['id'], 'MOTOR', 'FALHA', {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('revisor falhou')
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico,
                                    'config_revision_id': str(revisao['id'])})))
        return numero

    def conferir_e_aplicar_revisao(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
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
        self._evento('etapa', etapa['id'], 'REVISOR', 'APROVAR', ator=etapa['revisor'], chave=numero,
                     conteudo={'criterios': rubrica})
        return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']
