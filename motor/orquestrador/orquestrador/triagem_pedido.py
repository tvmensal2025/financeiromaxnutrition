"""Triagem de entradas v2. A IA sugere; catálogo, fontes e prazo decidem."""
from __future__ import annotations

import json
import re
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb

from executor_helena.tipos import Execucao
from .mapa_operacional import MapaInvalido, montar_mapa_operacional
from .plano import validar_plano

BRASILIA = ZoneInfo('America/Sao_Paulo')
MAX_TEXTO = 12000
MAX_RESPOSTA = 30000
MAX_PERGUNTAS = 4
_DATA_BR = re.compile(r'(?<!\d)(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2})(?!\d)')
_DATA_ISO = re.compile(r'(?<!\d)(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?(?!\d)')


class TriagemInvalida(ValueError):
    """Resposta fora do contrato; não se transforma em proposta executável."""


def _texto(valor, limite, nome):
    if not isinstance(valor, str) or valor != valor.strip() or not 1 <= len(valor) <= limite:
        raise TriagemInvalida(f'{nome} inválido')
    return valor


def _json_objeto(texto):
    if not isinstance(texto, str) or len(texto.encode('utf-8')) > MAX_RESPOSTA:
        raise TriagemInvalida('resposta do agente excede limite')
    try:
        def sem_duplicatas(pares):
            objeto = {}
            for chave, item in pares:
                if chave in objeto:
                    raise TriagemInvalida('resposta do agente tem chave duplicada')
                objeto[chave] = item
            return objeto
        valor = json.loads(texto, object_pairs_hook=sem_duplicatas)
    except TriagemInvalida:
        raise
    except (ValueError, TypeError) as erro:
        raise TriagemInvalida('resposta do agente não é JSON') from erro
    if not isinstance(valor, dict):
        raise TriagemInvalida('resposta do agente deve ser objeto')
    return valor


def _prazo_observado(trecho, agora):
    """Só aceita data e hora literais do pedido; fuso ausente significa Brasília."""
    trecho = _texto(trecho, 80, 'trecho do prazo')
    m = _DATA_BR.fullmatch(trecho)
    try:
        if m:
            dia, mes, ano, hora, minuto = map(int, m.groups())
            prazo = datetime(ano, mes, dia, hora, minuto, tzinfo=BRASILIA)
        else:
            m = _DATA_ISO.fullmatch(trecho)
            if not m:
                raise TriagemInvalida('prazo não contém data e hora explícitas')
            prazo = datetime.fromisoformat(trecho.replace('Z', '+00:00'))
            if prazo.tzinfo is None:
                prazo = prazo.replace(tzinfo=BRASILIA)
    except ValueError as erro:
        raise TriagemInvalida('data ou hora do prazo inválida') from erro
    prazo = prazo.astimezone(timezone.utc)
    if not agora < prazo <= agora + timedelta(days=3652):
        raise TriagemInvalida('prazo vencido ou fora do limite')
    return prazo.astimezone(BRASILIA).isoformat()


def _catalogo(config):
    if not isinstance(config, dict):
        raise TriagemInvalida('configuração ausente')
    org = config.get('helena-v2/organograma.yaml') or {}
    cat = config.get('helena-v2/servicos.yaml') or {}
    empresas = {codigo: e for codigo, e in (org.get('empresas') or {}).items()
                if isinstance(e, dict) and e.get('pacote', {}).get('estado') == 'CONFIRMADO'}
    servicos = {s['id']: s for s in cat.get('servicos', []) if isinstance(s, dict) and isinstance(s.get('id'), str)
                and s.get('estado') in ('ESTAGIO', 'ATIVO')}
    return empresas, servicos


def _empresas_operacionais(captura):
    empresas, servicos = _catalogo(captura.get('config_conteudo'))
    portfolio = (captura.get('contexto') or {}).get('portfolio')
    if not isinstance(portfolio, list):
        raise TriagemInvalida('portfolio canônico indisponível')
    ativos = {p.get('business_id') for p in portfolio if isinstance(p, dict) and p.get('ativo') == 'SIM'}
    return {codigo: e for codigo, e in empresas.items() if codigo in ativos}, servicos


def _menciona(texto, nome):
    """Nome oficial com ™/® opcional na entrada, preservado na saída."""
    nome = re.sub(r'[™®]', '', nome).casefold().strip()
    texto = re.sub(r'[™®]', '', texto).casefold()
    return bool(nome and re.search(r'(?<!\w)' + re.escape(nome) + r'(?!\w)', texto))


def _perguntar(perguntas, resumo, meta):
    if not isinstance(perguntas, list) or not 1 <= len(perguntas) <= MAX_PERGUNTAS:
        raise TriagemInvalida('perguntas ausentes ou excessivas')
    perguntas = [_texto(p, 240, 'pergunta') for p in perguntas]
    if len(set(perguntas)) != len(perguntas):
        raise TriagemInvalida('perguntas repetidas')
    return {'tipo': 'PERGUNTAR', 'perguntas': perguntas, 'resumo': _texto(resumo, 500, 'resumo'),
            'empresa_id': None, 'titulo': None, 'prazo': None, 'plano': None,
            'validacao_metadados': meta}


def planejar_plano(resposta, captura, spec, raiz, *, agora=None):
    """Converte escolha tipada da Helena em plano fixo; dados não observados viram pergunta."""
    agora = agora or datetime.now(timezone.utc)
    empresas, servicos = _empresas_operacionais(captura)
    eventos = captura.get('eventos')
    if not isinstance(eventos, list) or not eventos or len(eventos) > 100 or any(
            not isinstance(e, dict) or not isinstance(e.get('texto'), str) or not e['texto'].strip()
            or len(e['texto']) > 8000 for e in eventos):
        raise TriagemInvalida('eventos do pedido inválidos')
    fonte = '\n'.join(e['texto'] for e in eventos)
    if len(fonte) > MAX_TEXTO:
        raise TriagemInvalida('pedido excede limite de triagem')
    if not isinstance(captura.get('contexto_hash'), str) or not re.fullmatch('[0-9a-f]{64}', captura['contexto_hash']):
        raise TriagemInvalida('contexto canônico sem fingerprint')
    meta = {'config_revision_id': str(UUID(str(captura['config_revision_id']))),
            'config_hash': captura['config_hash'], 'eventos_hash': captura['eventos_hash'],
            'contexto_hash': captura['contexto_hash'],
            'checkpoint_id': (captura.get('contexto') or {}).get('checkpoint', {}).get('checkpoint_id')}
    if not isinstance(resposta, dict) or resposta.get('tipo') not in ('PERGUNTAR', 'PROPOR'):
        raise TriagemInvalida('tipo da triagem inválido')
    resumo = _texto(resposta.get('resumo'), 500, 'resumo')
    if resposta['tipo'] == 'PERGUNTAR':
        return _perguntar(resposta.get('perguntas'), resumo, meta)
    if resposta.get('perguntas') != []:
        raise TriagemInvalida('proposta não pode conter pergunta pendente')
    evidencia = resposta.get('evidencia')
    if not isinstance(evidencia, dict):
        raise TriagemInvalida('proposta sem trechos de evidência')
    empresa_id = resposta.get('empresa_id')
    servico_id = resposta.get('servico_id')
    if empresa_id not in empresas or servico_id not in servicos:
        raise TriagemInvalida('empresa ou serviço indisponível')
    # Uma escolha do agente não desempata dois escopos ou dois prazos presentes.
    empresas_citadas = {codigo for codigo, empresa in empresas.items() if any(
        _menciona(fonte, nome) for nome in
        (codigo, empresa.get('nome') if isinstance(empresa.get('nome'), str) else ''))}
    prazos_citados = {m.group(0) for m in _DATA_BR.finditer(fonte)} | {
        m.group(0) for m in _DATA_ISO.finditer(fonte)}
    ultimo = eventos[-1]['texto']
    if len(empresas_citadas) != 1 or len(prazos_citados) != 1:
        # O histórico é imutável. Uma correção só desempata se a mensagem mais
        # recente trouxer, junta, empresa e data/hora, sem nova ambiguidade.
        empresas_ultimas = {codigo for codigo, empresa in empresas.items() if any(
            _menciona(ultimo, nome) for nome in
            (codigo, empresa.get('nome') if isinstance(empresa.get('nome'), str) else ''))}
        prazos_ultimos = {m.group(0) for m in _DATA_BR.finditer(ultimo)} | {
            m.group(0) for m in _DATA_ISO.finditer(ultimo)}
        if (len(eventos) < 2 or empresas_ultimas != {empresa_id}
                or len(prazos_ultimos) != 1
                or not isinstance(evidencia.get('empresa'), str)
                or evidencia['empresa'] not in ultimo
                or evidencia.get('prazo') not in prazos_ultimos):
            return _perguntar(['Pode confirmar empresa e data e hora do prazo na mesma mensagem?'], resumo, meta)
        empresas_citadas, prazos_citados = empresas_ultimas, prazos_ultimos
    if empresa_id not in empresas_citadas:
        raise TriagemInvalida('empresa escolhida não corresponde ao pedido')
    servicos_citados = {codigo for codigo, s in servicos.items() if any(
        _menciona(fonte, nome) for nome in
        (codigo, s.get('nome') if isinstance(s.get('nome'), str) else ''))}
    if len(servicos_citados) > 1:
        servicos_ultimos = {codigo for codigo, s in servicos.items() if any(
            _menciona(ultimo, nome) for nome in
            (codigo, s.get('nome') if isinstance(s.get('nome'), str) else ''))}
        if (servicos_ultimos != {servico_id} or not isinstance(evidencia.get('servico'), str)
                or evidencia['servico'] not in ultimo):
            return _perguntar(['Qual serviço da v2 você quer para este pedido?'], resumo, meta)
    servico = servicos[servico_id]
    if empresa_id not in servico.get('empresas', ()) or not servico.get('escolhivel') or not servico.get('avulso'):
        raise TriagemInvalida('serviço não atende a empresa como avulso')
    for campo in ('empresa', 'servico', 'prazo', 'insumos'):
        trecho = _texto(evidencia.get(campo), 300, f'evidência de {campo}')
        if trecho not in fonte:
            raise TriagemInvalida(f'evidência de {campo} não consta do pedido')
    nomes = {empresa_id.casefold(), str(empresas[empresa_id].get('nome', '')).casefold()}
    if not any(_menciona(evidencia['empresa'], nome) for nome in nomes):
        raise TriagemInvalida('empresa sem identificação literal')
    prazo = _prazo_observado(evidencia['prazo'], agora)
    if servico_id == 'SRV-CALCULO':
        from .motor import Motor
        fonte_id = 'FON-PACOTE-' + empresa_id
        fontes = {'FON-PEDIDO-' + str(captura['pedido_id']): eventos[0]['texto'],
                  fonte_id: json.dumps(empresas[empresa_id]['pacote'], ensure_ascii=False)}
        fontes.update({'FON-PEDIDO-EVENTO-' + str(n): e['texto']
                       for n, e in enumerate(eventos[1:], 1)})
        faltas = Motor._faltas_do_autor_real('SRV-CALCULO',
            {'ordem_de_servico': {'pedido_original': eventos[0]['texto']},
             'pacote_da_empresa': {'estado': 'CONFIRMADO', 'fonte_importada_id': fonte_id}}, fontes)
        if faltas:
            return _perguntar([f'Pode informar {falta}?' for falta in faltas[:MAX_PERGUNTAS]],
                              'A conta precisa de insumos confirmados antes da proposta.', meta)
    # Título, objetivo e resumo exibidos vêm de catálogo + citação literal;
    # paráfrases livres do modelo ficam só no registro bruto para auditoria.
    titulo = _texto(servico['nome'], 160, 'nome do serviço')
    objetivo = _texto('Atender ao pedido original, usando este trecho: ' + evidencia['insumos'],
                      350, 'objetivo')
    resumo = _texto(f"{servico['nome']} para {empresas[empresa_id]['nome']}: proposta aguardando confirmação.",
                    500, 'resumo')
    ficha = spec.servicos.get(servico_id)
    if not ficha or ficha.get('estado') not in ('ESTAGIO', 'ATIVO'):
        raise TriagemInvalida('serviço da revisão indisponível')
    if ficha.get('julgado_pelo_parecer') == 'SEMPRE':
        parecer = servicos.get('SRV-PARECER')
        if not parecer or empresa_id not in parecer.get('empresas', ()):
            raise TriagemInvalida('parecer obrigatório indisponível')
        etapas = [{'id': 'E1', 'servico': servico_id, 'objetivo': objetivo,
                   'entradas': [], 'depende_de': []},
                  {'id': 'E2', 'servico': 'SRV-PARECER',
                   'objetivo': 'Julgar a peça E1 antes de qualquer ação externa.',
                   'entradas': ['E1'], 'depende_de': ['E1'], 'julga': ['E1']}]
        meta['bloqueio'] = 'PEDIDO_FONTE_LEIS_AUSENTE'
    else:
        etapas = [{'id': 'E1', 'servico': servico_id, 'objetivo': objetivo,
                   'entradas': [], 'depende_de': []}]
    # O orçamento é calculado das fichas da revisão. A reserva de revisão e a
    # coordenação também consomem chamadas, mas não autorizam serviço RASCUNHO.
    from executor_helena.ficha import ler_ficha
    chamadas = 3  # leitura de volta da Helena após criar o card
    for e in etapas:
        s = spec.servicos[e['servico']]
        chamadas_etapa = 0
        for identidade, papel in ((s['dono'], 'AUTOR'), (s['revisor'], 'REVISOR')):
            f = ler_ficha(raiz / 'agents' / f'{identidade.lower()}.yaml',
                          caminho_dos_modelos=raiz / 'models.yaml', fase_em_curso='fase 3',
                          papel=papel, servico=e['servico'] if papel == 'AUTOR' else None)
            chamadas_etapa += f.orcamento.chamadas_total
        chamadas += chamadas_etapa * 2  # uma retomada de autor e revisor
        if s.get('reserva') not in (None, 'FUNDADOR'):
            caminho_reserva = raiz / 'agents' / f"{s['reserva'].lower()}.yaml"
            if caminho_reserva.is_file():
                reserva = ler_ficha(caminho_reserva, caminho_dos_modelos=raiz / 'models.yaml',
                                    fase_em_curso='fase 3', papel='REVISOR')
                chamadas += reserva.orcamento.chamadas_total
    plano = {'id': 'pedido-v2-' + str(UUID(str(captura['pedido_id']))),
             'empresas': [empresa_id], 'decisoes': [], 'entradas_externas': {},
             'orcamento_meta': {'execucoes': len(etapas) * 5 + 1,
                                'chamadas_total': chamadas, 'buscas': 0, 'partes_de_pagina': 0},
             'etapas': etapas}
    erro = validar_plano(plano, spec, raiz)
    if erro:
        raise TriagemInvalida('plano inválido: ' + erro)
    return {'tipo': 'PROPOR', 'perguntas': [], 'resumo': resumo, 'empresa_id': empresa_id,
            'titulo': titulo, 'prazo': prazo, 'plano': plano, 'validacao_metadados': meta}


def _autor_plano(motor, captura, spec, raiz):
    """Uma chamada da coordenação no ExecutorHermes já configurado pelo Motor."""
    empresas, servicos = _empresas_operacionais(captura)
    escolhas = [{'id': s['id'], 'nome': s['nome'], 'exemplos': s.get('exemplos_de_pedido', []),
                 'empresas': [e for e in s.get('empresas', []) if e in empresas]}
                for s in servicos.values() if s.get('escolhivel') and s.get('avulso')]
    contexto = captura.get('contexto') or {}
    checkpoint = contexto.get('checkpoint')
    if (not isinstance(checkpoint, dict) or checkpoint.get('status') != 'ATIVO'
            or not checkpoint.get('checkpoint_id') or not isinstance(contexto.get('decisoes'), list)
            or not isinstance(contexto.get('portfolio'), list)
            or contexto.get('decisoes_truncadas') is True
            or len(contexto.get('decisoes', [])) > 30
            or not isinstance(captura.get('contexto_hash'), str)
            or not re.fullmatch('[0-9a-f]{64}', captura['contexto_hash'])):
        raise TriagemInvalida('checkpoint ou decisões vigentes indisponíveis')
    eventos = [{'texto': _texto(e['texto'], 8000, 'evento')} for e in captura['eventos']]
    if len(eventos) > 100 or sum(len(e['texto']) for e in eventos) > MAX_TEXTO:
        raise TriagemInvalida('pedido excede limite de triagem')
    decisoes = contexto['decisoes']
    if any(not isinstance(d, dict) or not isinstance(d.get('decisao'), str) for d in decisoes):
        raise TriagemInvalida('decisões canônicas inválidas')
    portfolio = contexto['portfolio']
    if any(not isinstance(p, dict) for p in portfolio):
        raise TriagemInvalida('portfolio canônico inválido')
    try:
        mapa_operacional = montar_mapa_operacional(captura)
    except MapaInvalido as erro:
        raise TriagemInvalida(str(erro)) from erro
    pacote = {'instrucao': ('Responda apenas JSON com tipo PERGUNTAR ou PROPOR, resumo até 500 caracteres, '
             'perguntas até 4; em PROPOR inclua empresa_id, servico_id e evidencia '
             'com trechos literais empresa, servico, prazo e insumos. Peça esclarecimento se empresa, '
             'serviço, data/hora do prazo ou insumos estiverem ambíguos. Não invente dados. '
             'Prazo exige data e hora explícitas. Nenhuma proposta autoriza execução.'),
              'eventos': eventos, 'mapa_operacional': mapa_operacional,
              'empresas': {k: v.get('nome') for k, v in empresas.items()},
              'servicos_elegiveis': escolhas,
              'checkpoint': {k: (str(checkpoint.get(k)) if checkpoint.get(k) is not None else None)
                             for k in ('checkpoint_id', 'versao', 'resumo_executivo', 'validado_em')},
              'decisoes_vigentes': [{k: (str(d.get(k)) if d.get(k) is not None else None)
                                     for k in ('decision_id', 'decisao', 'business_id')}
                                    for d in decisoes],
              'portfolio': [{k: (str(p.get(k)) if p.get(k) is not None else None)
                             for k in ('business_id', 'negocio', 'ativo', 'estagio')}
                            for p in portfolio]}
    pacote_json = json.dumps(pacote, ensure_ascii=False, allow_nan=False)
    if len(pacote_json.encode('utf-8')) > 60000:
        raise TriagemInvalida('contexto canônico excede limite do modelo')
    ficha = motor._ficha('HELENA', 'COORDENACAO', 'LER_DE_VOLTA', raiz)
    execucao = Execucao(id='T-' + str(UUID(str(captura['pedido_id'])))[:32], ficha=ficha,
                        pacote=pacote_json, fontes_permitidas=())
    resultado = motor.executor.rodar(execucao)
    if not resultado.ok or not resultado.texto:
        raise RuntimeError('triagem Hermes não concluiu')
    bruto = {'texto': resultado.texto, 'config_revision_id': str(captura['config_revision_id']),
             'eventos_hash': captura['eventos_hash'], 'contexto_hash': captura['contexto_hash'],
             'modelo': resultado.modelo_usado,
             'provedor': resultado.provedor_usado, 'conversa': list(resultado.conversa),
             'uso': asdict(resultado.uso)}
    if len(json.dumps(bruto, ensure_ascii=False, default=str).encode('utf-8')) > 200000:
        raise TriagemInvalida('resposta bruta excede limite')
    return bruto, resultado


def processar_proposta_pedido(motor, request_id):
    """Claim, gravação bruta e validação com retry sem segunda chamada de modelo."""
    request_id = str(UUID(str(request_id)))
    captura = motor._linha('SELECT helena_v2.reservar_proposta_pedido(%s::uuid,%s) AS item',
                           (request_id, 600))['item']
    if not captura:
        return None
    revisao, spec, raiz = motor._carregar_revisao(captura['config_revision_id'])
    if captura['config_hash'] != revisao['hash_sha256'] or captura['config_conteudo'] != revisao['conteudo']:
        raise TriagemInvalida('configuração da triagem diverge da revisão')
    contexto = captura.get('contexto') or {}
    if (not isinstance(captura.get('contexto_hash'), str)
            or not re.fullmatch('[0-9a-f]{64}', captura['contexto_hash'])
            or not isinstance(contexto.get('checkpoint'), dict)
            or contexto['checkpoint'].get('status') != 'ATIVO'
            or not isinstance(contexto.get('decisoes'), list)
            or not isinstance(contexto.get('portfolio'), list)
            or contexto.get('decisoes_truncadas') is True
            or len(contexto.get('decisoes', [])) > 30):
        raise TriagemInvalida('contexto canônico inválido')
    bruto = captura.get('resposta_bruta')
    resultado = None
    if bruto is not None and bruto.get('contexto_hash') != captura['contexto_hash']:
        raise TriagemInvalida('resposta bruta pertence a outro contexto')
    if bruto is None:
        eventos = captura.get('eventos')
        excede = (not isinstance(eventos, list) or len(eventos) > 100
                  or any(not isinstance(e, dict) or not isinstance(e.get('texto'), str)
                         or len(e['texto']) > 8000 for e in eventos)
                  or sum(len(e['texto']) for e in eventos) > MAX_TEXTO)
        if excede:
            bruto = {'texto': json.dumps({'tipo': 'PERGUNTAR', 'resumo': 'Pedido excede o limite de triagem.',
                                           'perguntas': ['Pode dividir o pedido em mensagens menores?']},
                                          ensure_ascii=False),
                     'origem': 'VALIDADOR_CODIGO', 'contexto_hash': captura['contexto_hash'],
                     'config_revision_id': str(captura['config_revision_id']),
                     'eventos_hash': captura['eventos_hash']}
        else:
            try:
                bruto, resultado = _autor_plano(motor, captura, spec, raiz)
            except TriagemInvalida:
                bruto = {'texto': json.dumps({'tipo': 'PERGUNTAR',
                                               'resumo': 'O contexto deste pedido precisa ser delimitado.',
                                               'perguntas': ['Pode delimitar o escopo do pedido para a triagem?']},
                                              ensure_ascii=False),
                         'origem': 'VALIDADOR_CODIGO', 'contexto_hash': captura['contexto_hash'],
                         'config_revision_id': str(captura['config_revision_id']),
                         'eventos_hash': captura['eventos_hash']}
        motor._linha('SELECT helena_v2.registrar_resposta_bruta_pedido(%s::uuid,%s::uuid,%s) AS item',
                     (request_id, captura['lease_token'], Jsonb(bruto)))
    meta = {'config_revision_id': str(captura['config_revision_id']),
            'config_hash': captura['config_hash'], 'eventos_hash': captura['eventos_hash'],
            'contexto_hash': captura['contexto_hash']}
    if bruto.get('origem') == 'VALIDADOR_CODIGO':
        gerada = _json_objeto(bruto['texto'])
        proposta = _perguntar(gerada['perguntas'], gerada['resumo'], meta)
    else:
        try:
            proposta = planejar_plano(_json_objeto(bruto['texto']), captura, spec, raiz)
        except TriagemInvalida as erro:
            proposta = _perguntar(['Pode confirmar empresa, serviço, insumos e data e hora do prazo?'],
                                  'Preciso confirmar os dados do pedido antes de propor um plano.',
                                  {**meta, 'motivo': str(erro)[:200]})
    try:
        return motor._linha('SELECT helena_v2.registrar_proposta_pedido(%s::uuid,%s::uuid,%s) AS item',
                           (request_id, captura['lease_token'], Jsonb(proposta)))['item']
    finally:
        if resultado is not None and callable(getattr(motor.executor, 'limpar', None)):
            motor.executor.limpar(resultado)
