"""Prepara uma tarefa observada; não autoriza, cria card ou chama agente."""
import copy
import hashlib
import json
import re
from datetime import datetime, timezone

from .fonte_supabase import PROJECT_REF


def _json(valor):
    return json.dumps(valor, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False)


def preparar_tarefa_real(captura: dict, plano: dict) -> dict:
    """Preserva os textos reais e identifica os campos ainda não confirmados.

    O hash protege integridade de transporte, não prova aprovação. A aprovação
    posterior é feita pela RPC autenticada, que também revalida as fontes.
    """
    if not isinstance(captura, dict) or not isinstance(plano, dict):
        raise ValueError('captura e plano devem ser objetos')
    captura = json.loads(_json(captura))
    plano = json.loads(_json(plano))
    proveniencia = captura.get('proveniencia')
    if not isinstance(proveniencia, dict):
        raise ValueError('captura sem proveniência')
    observacao = {k: v for k, v in captura.items() if k != 'proveniencia'}
    calculado = hashlib.sha256(_json(observacao).encode('utf-8')).hexdigest()
    if calculado != proveniencia.get('hash_sha256'):
        raise ValueError('captura alterada depois da leitura')
    if (captura.get('fonte') != 'management_read_only'
            or captura.get('projeto', {}).get('ref') != PROJECT_REF):
        raise ValueError('fonte ou projeto não canônico')
    tarefa, empresa = captura.get('tarefa'), captura.get('empresa')
    if not isinstance(tarefa, dict) or not isinstance(empresa, dict):
        raise ValueError('captura sem tarefa ou empresa')
    business = captura.get('business_id')
    if (not business or business != tarefa.get('business_id')
            or business != empresa.get('business_id')
            or business not in (plano.get('empresas') or [])):
        raise ValueError('tarefa, empresa e roteiro pertencem a escopos diferentes')
    if tarefa.get('status') not in ('NÃO INICIADA', 'EM EXECUÇÃO', 'ABERTO') or empresa.get('ativo') != 'SIM':
        raise ValueError('tarefa ou empresa não permite um novo pedido')
    original, task_id = tarefa.get('tarefa'), tarefa.get('task_id')
    if not isinstance(original, str) or not original.strip() or not isinstance(task_id, str):
        raise ValueError('pedido original ou identificador da tarefa ausente')
    decisoes = captura.get('decisoes')
    if (not isinstance(decisoes, list)
            or {d.get('decision_id') for d in decisoes} != set(plano.get('decisoes') or [])):
        raise ValueError('decisões do roteiro não conferem com a captura')
    entradas = captura.get('entradas_externas')
    if not isinstance(entradas, dict) or set(entradas) != set(plano.get('entradas_externas') or {}):
        raise ValueError('entradas do roteiro não conferem com a captura')
    id_pedido, id_empresa = f'FON-PEDIDO-{task_id}', f'FON-PACOTE-{business}'
    fontes = {id_pedido: original, id_empresa: _json(empresa)}
    insumos = {}
    for nome, job in entradas.items():
        if (not isinstance(job, dict) or job.get('business_id') != business
                or job.get('job_id') != plano['entradas_externas'][nome]):
            raise ValueError('entrada externa de outra origem ou empresa')
        payload = job.get('result_payload')
        entrega = payload.get('delivery') if isinstance(payload, dict) else None
        if not isinstance(entrega, dict) or not isinstance(entrega.get('content'), str):
            raise ValueError('entrada sem conteúdo documental')
        fonte_id = 'FON-JOB-' + job['job_id']
        # Inclui limitações e revisão: não transforma pesquisa em oferta aprovada.
        fontes[fonte_id] = _json({'delivery': entrega,
                                'quality_review': payload.get('quality_review'),
                                'review_reason': payload.get('review_reason'),
                                'evidence_refs': job.get('evidence_refs')})
        insumos[nome] = {'job_id': job['job_id'], 'fonte_ids': [fonte_id],
                        'conteudo': copy.deepcopy(entrega),
                        'evidence_refs': copy.deepcopy(job.get('evidence_refs')),
                        'updated_at': job.get('updated_at')}
    marca = empresa.get('brand_identity')
    marca_aprovada = (isinstance(marca, dict) and marca.get('status') == 'APPROVED'
                      and marca.get('business_id') == business
                      and type(marca.get('schema_version')) is int
                      and marca['schema_version'] > 0
                      and isinstance(marca.get('name'), str) and bool(marca['name'].strip()))
    pacote = {'empresa': business, 'nome': empresa.get('negocio'),
              'estado': 'CONFIRMADO' if marca_aprovada else 'A_CONFIRMAR', 'fonte_importada_id': id_empresa,
              'dados_do_portfolio': copy.deepcopy(empresa),
              'decisoes': list(plano.get('decisoes') or [])}
    # Não deriva prazo, canal, público, remuneração ou lei dos exemplos do repo.
    ordem = {'empresa': business, 'pedido_original': original,
             'o_que_quer': original, 'prazo': tarefa.get('prazo'),
             'prioridade_na_fonte': tarefa.get('prioridade'),
             'definicao_de_pronto_na_fonte': tarefa.get('definicao_de_pronto'),
             'fontes_que_pode_ler': [], 'como_e_o_pronto': [], 'nao_pode': []}
    pedido = {'empresa': business, 'criado_em': tarefa.get('criado_em'),
              'ordem_de_servico': ordem, 'plano': copy.deepcopy(plano),
              'pacote_da_empresa': pacote}
    refs = {'project_ref': PROJECT_REF,
            'checkpoint_id': captura.get('checkpoint', {}).get('checkpoint_id'),
            'observado_em': captura.get('observado_em'),
            'tarefa_id': task_id, 'tarefa_row_version': tarefa.get('row_version'),
            'business_id': business, 'hash_sha256': calculado}
    dados = {'pedido': pedido, 'fontes_importadas': fontes,
             'decisoes': [{'id': d['decision_id'], 'versao': d['row_version'],
                          'row_version': d['row_version'], 'texto': d['decisao']}
                         for d in decisoes],
             'entradas_externas': insumos, 'proveniencia': refs,
             'captura': captura}
    pendencias = []
    if not marca_aprovada:
        pendencias.append({'campo': 'pacote_da_empresa',
                          'motivo': 'A identidade da empresa precisa de aprovação e versão confirmadas.'})
    prazo = tarefa.get('prazo')
    if prazo is None:
        pendencias.append({'campo': 'prazo', 'motivo': 'A tarefa não tem prazo confirmado.'})
    else:
        try:
            dt = datetime.fromisoformat(prazo.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                raise ValueError
        except (AttributeError, TypeError, ValueError):
            pendencias.append({'campo': 'prazo', 'motivo': 'Confirme data, hora e fuso do prazo.'})
    pendencias.extend([
        {'campo': 'como_e_o_pronto',
         'motivo': 'Revisar os critérios estruturados a partir da definição de pronto original.'},
        {'campo': 'nao_pode', 'motivo': 'Confirmar as restrições do pedido; nenhuma foi inferida.'},
        {'campo': 'solicitacao_autenticada',
         'motivo': 'A leitura administrativa não substitui um pedido autenticado do fundador.'},
    ])
    return {'estado': 'AGUARDANDO_CONFIRMACAO', 'tarefa_id': task_id,
            'business_id': business, 'dados_reais': dados, 'pendencias': pendencias,
            'agentes_chamados': 0, 'escritas_remotas': 0}


def confirmar_preparacao(preparacao: dict, prazo: str, criterios: list,
                         restricoes: list, fontes: list) -> dict:
    """Confirma escolhas do fundador sem alterar um só fato da captura observada.

    A saída ainda não autoriza ninguém: somente a RPC com JWT do fundador grava
    a solicitação, após conferir novamente cada linha da fonte no banco.
    """
    from ferramentas_helena.enderecos import analisar_url
    from ferramentas_helena.erros import ErroFerramenta

    if not isinstance(preparacao, dict) or preparacao.get('estado') != 'AGUARDANDO_CONFIRMACAO':
        raise ValueError('preparação real pendente obrigatória')
    dados = preparacao.get('dados_reais')
    if not isinstance(dados, dict) or not isinstance(dados.get('pedido'), dict):
        raise ValueError('preparação sem dados reais')
    plano = dados['pedido'].get('plano')
    original = preparar_tarefa_real(dados.get('captura'), plano)
    if (dados != original['dados_reais'] or preparacao.get('tarefa_id') != original['tarefa_id']
            or preparacao.get('business_id') != original['business_id']):
        raise ValueError('preparação alterada fora dos campos confirmáveis')
    if dados['pedido']['pacote_da_empresa']['estado'] != 'CONFIRMADO':
        raise ValueError('identidade da empresa sem confirmação na fonte')
    if not isinstance(prazo, str):
        raise ValueError('prazo deve incluir data, hora e fuso')
    try:
        instante = datetime.fromisoformat(prazo.replace('Z', '+00:00'))
    except ValueError as erro:
        raise ValueError('prazo deve incluir data, hora e fuso') from erro
    agora = datetime.now(timezone.utc)
    try:
        maximo = agora.replace(year=agora.year + 10)
    except ValueError:  # 29 de fevereiro + dez anos não bissextos
        maximo = agora.replace(year=agora.year + 10, day=28)
    if (instante.tzinfo is None or instante.utcoffset() is None
            or not agora < instante.astimezone(timezone.utc) <= maximo):
        raise ValueError('prazo deve ser futuro e estar dentro de dez anos')
    if (not isinstance(criterios, list) or not 1 <= len(criterios) <= 5
            or any(not isinstance(c, dict) or set(c) != {'id', 'texto', 'quem_confere', 'risco'}
                   or c['id'] != f'CARD-{i}' or c['quem_confere'] != 'IA'
                   or c['risco'] not in ('ALTO', 'BAIXO')
                   or not isinstance(c['texto'], str) or not 3 <= len(c['texto'].strip()) <= 200
                   or c['texto'] != c['texto'].strip()
                   for i, c in enumerate(criterios, 1))):
        raise ValueError('critérios confirmados inválidos')
    if len({c['texto'] for c in criterios}) != len(criterios):
        raise ValueError('critérios repetidos')
    if (not isinstance(restricoes, list) or len(restricoes) > 5
            or any(not isinstance(t, str) or not 3 <= len(t.strip()) <= 200 or t != t.strip()
                   for t in restricoes)):
        raise ValueError('restrições confirmadas inválidas')
    if len(set(restricoes)) != len(restricoes):
        raise ValueError('restrições repetidas')
    if any(not any(c['texto'] == t and c['risco'] == 'ALTO' for c in criterios)
           for t in restricoes):
        raise ValueError('restrições exigem item correspondente de risco ALTO')
    if not isinstance(fontes, list) or len(fontes) > 20:
        raise ValueError('lista de fontes inválida')
    for url in fontes:
        if (not isinstance(url, str) or len(url) > 500 or not url.startswith('https://')
                or '%' in url):
            raise ValueError('fonte deve ser endereço HTTPS público')
        try:
            endereco = analisar_url(url)
        except ErroFerramenta as erro:
            raise ValueError('fonte deve ser endereço HTTPS público') from erro
        if (endereco.url != url or endereco.ip_literal is not None or endereco.porta != 443
                or ':' in url.split('/', 3)[2]
                or '?' in url or '#' in url
                or re.fullmatch(r'[a-z]{2,63}', endereco.host.rsplit('.', 1)[-1]) is None):
            raise ValueError('fonte deve ser URL pública canônica sem IP ou consulta')
    if len(set(fontes)) != len(fontes):
        raise ValueError('fontes repetidas')
    confirmado = json.loads(_json(dados))
    ordem = confirmado['pedido']['ordem_de_servico']
    ordem.update({'prazo': prazo, 'como_e_o_pronto': json.loads(_json(criterios)),
                  'nao_pode': list(restricoes), 'fontes_que_pode_ler': list(fontes)})
    if len(_json(confirmado).encode('utf-8')) > 1_000_000:
        raise ValueError('dados reais excedem um megabyte')
    return {'estado': 'PRONTO_PARA_SOLICITAR', 'tarefa_id': original['tarefa_id'],
            'prazo': prazo, 'plano': json.loads(_json(plano)), 'dados_reais': confirmado,
            'agentes_chamados': 0, 'escritas_remotas': 0}
