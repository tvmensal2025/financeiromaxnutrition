"""Um despacho DBOS por execução; somente funções do banco decidem estado."""
import json
import os

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
from .plano import RAIZ, validar_plano

_MOTOR = None


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
    def __init__(self, url_banco: str, url_dbos: str, casos: dict[str, str] | None = None):
        if not url_banco or not url_dbos or url_banco == url_dbos:
            raise ValueError('motor exige banco do card e banco DBOS separados')
        for url in (url_banco, url_dbos):
            dsn = url.replace('postgresql+psycopg://', 'postgresql://', 1)
            parametros = conninfo_to_dict(dsn)
            host = parametros.get('host', '')
            hostaddr = parametros.get('hostaddr') or os.environ.get('PGHOSTADDR')
            if host not in ('localhost', '127.0.0.1', '::1') or (hostaddr and hostaddr not in ('127.0.0.1', '::1')):
                raise ValueError('este motor de teste exige PostgreSQL local')
        self.url_banco = url_banco
        self.url_dbos = url_dbos
        self.spec = Spec()
        self.casos = casos or {}
        self.executor = ExecutorFalso(lambda execucao: Roteiro(texto=self._texto_roteirizado(execucao)))
        global _MOTOR
        _MOTOR = self
        self.dbos = DBOS(config=DBOSConfig(name='helena-v2-primeiro-card', system_database_url=url_dbos,
                                           application_version='primeiro-card-1'))
        self.dbos.launch()

    def fechar(self):
        self.dbos.destroy(destroy_registry=True)
        global _MOTOR
        _MOTOR = None

    def _con(self, papel='service_role'):
        con = psycopg.connect(self.url_banco, autocommit=True, row_factory=dict_row)
        if papel:
            con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(papel)))
        return con

    def _linha(self, sql, args=(), papel='service_role'):
        with self._con(papel) as con:
            return con.execute(sql, args).fetchone()

    def _evento(self, maquina, alvo, papel, evento, params=None, ator=None, chave=None, conteudo=None,
                *, automaticos=True, nao_disparar=None, toque=None):
        if maquina not in ('card', 'etapa', 'acao_externa'):
            raise ValueError('máquina desconhecida')
        with self._con('authenticated' if papel == 'FUNDADOR' else 'service_role') as con:
            versao = None
            if papel == 'FUNDADOR':
                versao = con.execute(f'SELECT versao FROM helena_v2.{maquina} WHERE id=%s', (alvo,)).fetchone()['versao']
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

    def criar_card(self, plano, numero='primeiro-card-teste'):
        from datetime import datetime, timedelta, timezone
        roteiro = self._roteiro_do_banco(plano)
        resposta = self._linha('SELECT helena_v2.criar_card(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) AS resposta',
                               ('teste', numero, 'Recrutar as primeiras 10 pessoas', plano['nome'],
                                datetime.now(timezone.utc) + timedelta(days=7), Jsonb(roteiro), 'BIZ-003',
                                Jsonb(plano), 0, True))['resposta']
        return resposta['card_id']

    def _roteiro_do_banco(self, plano):
        etapas = []
        for e in plano['etapas']:
            s = self.spec.servicos[e['servico']]
            ficha = self._ficha(s['dono'], 'AUTOR', e['servico'])
            tipos_julgados = set(s.get('julga_tipos') or [])
            julgadas = [outra['id'] for outra in plano['etapas'] if outra['id'] in e.get('depende_de', [])
                        and self.spec.tipo_do_servico(outra['servico']) in tipos_julgados]
            etapas.append({**e, 'nome': e.get('objetivo', e['id'])[:100], 'autor': s['dono'],
                           'revisores': [s['revisor'], s['reserva'], 'FUNDADOR'],
                           'julga': julgadas,
                           'internet': bool(s['usa_internet']), 'pulavel': bool(s['pode_ser_pulada']),
                           'acoes_permitidas': s['acoes_permitidas'],
                           'tempo_maximo_s': ficha.orcamento.tempo_s,
                           'prazo_revisao_s': self._ficha(s['revisor'], 'REVISOR', e['servico']).orcamento.tempo_s})
        return {'etapas': etapas}

    def _texto_roteirizado(self, execucao):
        if execucao.ficha.papel == 'COORDENACAO':
            return json.dumps({'leitura_de_volta': 'Entendi o pedido e o prazo.'})
        if execucao.ficha.papel == 'REVISOR':
            servico = json.loads(execucao.pacote)['servico']
            return json.dumps({'criterios': [{'id': c, 'resultado': 'PASSOU', 'prova': 'entrega conferida'}
                                            for c in self.spec.tipo(self.spec.tipo_do_servico(servico))['criterio_de_pronto']['rubrica']]})
        caso = self._caso(execucao.ficha.servico)
        return montar_resposta(caso)

    def _caso(self, servico):
        casos = [c for c in listar_casos(self.spec) if c.servico == servico]
        bons = [c for c in casos if c.bom]
        if not bons:
            raise ValueError(f'sem caso bom para {servico}')
        escolhido = self.casos.get(servico)
        if escolhido:
            return next(c for c in casos if c.id == escolhido)
        if servico == 'SRV-PARECER':
            return next(c for c in bons if c.dados['resposta'].get('parecer') == 'OK')
        return bons[0]

    def _ficha(self, identidade, papel, servico):
        return ler_ficha(RAIZ / 'helena-v2' / 'agents' / f'{identidade.lower()}.yaml',
                         caminho_dos_modelos=RAIZ / 'helena-v2' / 'models.yaml', fase_em_curso='fase 3',
                         papel=papel, servico=servico if papel == 'AUTOR' else None,
                         evento=servico if papel == 'COORDENACAO' else None)

    def _servico(self, etapa):
        plano = self._card(etapa['card_id'])['ordem_de_servico']
        return next(e['servico'] for e in plano['etapas'] if e['id'] == etapa['codigo'])

    def executar_e_salvar(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('execução antiga ou etapa não executando')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        servico = self._servico(etapa)
        ficha = self._ficha(etapa['autor'], 'AUTOR', servico)
        caso = self._caso(servico)
        contexto = montar_contexto(self.spec, caso)
        contexto['execucao_id'] = str(numero)
        for pagina in contexto['paginas_lidas']:
            pagina['execucao'] = str(numero)
        pacote = json.dumps({'servico': servico, 'pedido': contexto['pedido'],
                             'modelo': contexto['modelo']}, ensure_ascii=False)
        resultado = self.executor.rodar(Execucao(id=f'{etapa["codigo"]}-{numero}', ficha=ficha, pacote=pacote))
        if not resultado.ok or not resultado.texto:
            self._evento('etapa', etapa_id, 'MOTOR', 'FALHA', {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('executor falhou')
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico, 'contexto': contexto})))
        return numero

    def conferir_e_aplicar(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'EXECUTANDO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('execução antiga ou cancelada')
        salva = self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta']
        if not salva:
            raise RuntimeError('resposta não persistida')
        contexto = salva['contexto']
        relatorio = validar(salva['texto'], contexto)
        try:
            resposta = json.loads(salva['texto'])
        except (ValueError, TypeError):
            resposta = None
        if not isinstance(resposta, dict):
            resposta = {}
        self._evento('etapa', etapa_id, 'AUTOR', 'ENTREGAR',
                     {'parecer': resposta.get('parecer', 'OK'),
                      'acao_externa': (resposta.get('acao_externa') or {}).get('tipo', 'NENHUMA'),
                      'usou_internet': contexto['usou_internet']}, ator=etapa['autor'], chave=numero,
                     conteudo={'resposta': salva['texto']})
        if relatorio.aprovada:
            atual = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
            self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_OK', {'escolhido': atual['revisores_validos'][0]},
                         conteudo=relatorio.para_dict())
        else:
            self._evento('etapa', etapa_id, 'MOTOR', 'PORTAO1_RECUSOU', conteudo=relatorio.para_dict())
        return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']

    def executar_etapa(self, etapa_id):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        numero = etapa['execucao_atual']
        if numero is None:
            raise RuntimeError('etapa sem execução atual')
        with SetWorkflowID(f'{etapa_id}-{numero}'):
            return self.dbos.start_workflow(fluxo_etapa, str(etapa_id), numero).get_result()

    def avancar(self, card_id):
        card = self._card(card_id)
        if card['estado'] == 'RASCUNHO':
            chave = self._linha('SELECT helena_v2.abrir_chamada_helena(%s,%s) AS chave', ('card', card_id))['chave']
            ficha = self._ficha('HELENA', 'COORDENACAO', 'LER_DE_VOLTA')
            resultado = self.executor.rodar(Execucao(id=f'C-{chave}', ficha=ficha,
                                                   pacote=json.dumps({'card_id': str(card_id),
                                                                      'pedido': card['ordem_de_servico']}, ensure_ascii=False)))
            if not resultado.ok:
                self._evento('card', card_id, 'MOTOR', 'FALHA')
                return True
            self._evento('card', card_id, 'HELENA', 'LER_DE_VOLTA', chave=chave,
                         conteudo={'resposta': json.loads(resultado.texto)}, nao_disparar=['PLANO_VALIDO'])
            return True
        if card['estado'] == 'VALIDANDO_PLANO':
            erro = validar_plano(card['ordem_de_servico'], self.spec)
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
        if etapa['execucao_atual'] is None:
            self._evento('etapa', etapa['id'], 'MOTOR', 'INICIAR_REVISAO')
            etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        with SetWorkflowID(f'{etapa["id"]}-{etapa["execucao_atual"]}'):
            return self.dbos.start_workflow(fluxo_revisao, str(etapa['id']), etapa['execucao_atual']).get_result()

    def executar_e_salvar_revisao(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('revisão antiga ou cancelada')
        if self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta'] is not None:
            return numero
        servico = self._servico(etapa)
        revisor = etapa['revisor']
        ficha = self._ficha(revisor, 'REVISOR', servico)
        resultado = self.executor.rodar(Execucao(id=f'{etapa["codigo"]}-{numero}', ficha=ficha,
                                               pacote=json.dumps({'servico': servico, 'entrega_id': etapa['id']})))
        if not resultado.ok:
            self._evento('etapa', etapa['id'], 'MOTOR', 'FALHA', {'classe': resultado.falha.classe if resultado.falha else 'DESCONHECIDA'})
            raise RuntimeError('revisor falhou')
        self._linha('SELECT helena_v2.registrar_resposta_execucao(%s,%s) AS resposta',
                    (numero, Jsonb({'texto': resultado.texto, 'servico': servico})))
        return numero

    def conferir_e_aplicar_revisao(self, etapa_id, numero):
        etapa = self._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_id,))
        if etapa['estado'] != 'REVISAO' or etapa['execucao_atual'] != numero:
            raise RuntimeError('revisão antiga ou cancelada')
        salva = self._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta']
        if not salva:
            raise RuntimeError('revisão não persistida')
        rubrica = json.loads(salva['texto'])['criterios']
        if not conferir_rubrica(self.spec, salva['servico'], rubrica):
            raise RuntimeError('revisor não aprovou todos os critérios com prova')
        self._evento('etapa', etapa['id'], 'REVISOR', 'APROVAR', ator=etapa['revisor'], chave=numero,
                     conteudo={'criterios': rubrica})
        return self._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_id,))['estado']
