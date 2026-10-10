"""Validador das especificações do Sistema Helena v3.1 (o portão de tudo).

Uso:
    python validar.py                      confere tudo; sai com código 1 se houver algum problema
    python -m pytest -q test_validar.py    prova que o validador recusa cada defeito

Só LÊ arquivos desta pasta. Não toca em banco, servidor nem rede.

Como ler a saída: cada problema aparece como
    ERRO <arquivo>: [REGRA] o que está errado
A REGRA diz qual conferência pegou o problema (a lista completa está em REGRAS, logo abaixo, e
cada regra tem um teste de mutação em test_validar.py).

Cada regra é uma função pequena, marcada com @regra('NOME', 'o que ela garante'). Para somar uma
regra nova: escreva a função, marque com @regra e escreva o teste de mutação dela.

Fichas ausentes aparecem como ERRO com a contagem ("N de 21 fichas ausentes: ..."). Um arquivo
em agents/ sem o campo 'versao' é ficha antiga (v1): não conta como ficha.
"""
import importlib.util
import json
import re
import sys
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

RAIZ = Path(__file__).resolve().parent
FUNDADOR = 'FUNDADOR'
LIMITE_POR_ARQUIVO = 6          # problemas de esquema mostrados por arquivo (o resto vira "e mais N")
CASOS_BOAS_MIN = 3
CASOS_DEFEITOS_MIN = 4
FASES = ['v2.0', 'fase 3', 'fase 4']
EMPRESAS = ['BIZ-001', 'BIZ-002', 'BIZ-003', 'BIZ-004']
CATEGORIAS_EXTERNAS = ['CADASTRO', 'CONTATO', 'GASTO', 'CONTRATO', 'PUBLICACAO']
TIPO_DO_CONVITE = 'copy'                       # SRV-COPY: o texto que vai a estranhos (C-11)
TEMAS_DO_PARECER = ['TEMA-IMAGEM', 'TEMA-VOZ', 'TEMA-DADO-SENSIVEL', 'TEMA-TRANSFERENCIA-INTERNACIONAL',
                    'TEMA-MENORES', 'TEMA-VINCULO-DE-TRABALHO', 'TEMA-PUBLICIDADE', 'TEMA-PASSOS-FIXOS']

# Termos de ganho no tipo do convite (C-11): vale para os NOMES das seções, não para as explicações.
TERMOS_DE_GANHO = re.compile(r'ganh\w*|renda|rendimento\w*|lucr\w*|remunera\w*|\breais\b|d[oó]lar\w*|us\$|r\$|por hora|comiss\w*|sal[aá]rio\w*', re.I)
# Critério de rubrica que depende de lei: só o parecer pode (MAT-22).
DEPENDE_DE_LEI = re.compile(r'\blei\b|\bleis\b|\blgpd\b|jur[ií]dic\w*|\bartigo\b|marco civil', re.I)
# Chaves de acesso (nunca podem estar nas especificações). Só o nome do padrão é mostrado.
# O começo da chave do Supabase é montado em duas partes de propósito: assim este arquivo não
# aparece na busca de arquivos com chave (a do handoff, com git grep), que deve listar só os que têm chave de verdade.
PADROES_DE_CHAVE = {
    'chave de acesso do Supabase (eyJhbGci...)': re.compile('eyJ' + 'hbGciOi' + r'[A-Za-z0-9_\-]{10,}'),
    'chave de API (sk-...)': re.compile(r'\bsk-[A-Za-z0-9_\-]{20,}'),
    'chave privada': re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    'valor de senha, token ou segredo': re.compile(r'(?i)\b(api[_-]?key|secret|senha|password|token)\s*[:=]\s*["\']?[A-Za-z0-9_\-+/=]{24,}'),
}

_CARREGADOR = getattr(yaml, 'CSafeLoader', yaml.SafeLoader)


# =========================================================================================
# Registro das regras
# =========================================================================================
REGRAS = {}


def regra(tag, descricao):
    """Marca uma função como regra do validador. A função recebe (D, erro)."""
    def marca(funcao):
        assert tag not in REGRAS, f'regra repetida: {tag}'
        REGRAS[tag] = (descricao, funcao)
        return funcao
    return marca


def rodar(D, so=None):
    """Roda as regras (todas, ou só as de 'so') e devolve a lista de problemas em texto."""
    erros = []
    for tag, (_, funcao) in REGRAS.items():
        if so is not None and tag not in so:
            continue

        def erro(onde, texto, tag=tag):
            erros.append(f'{onde}: [{tag}] {texto}')
        try:
            funcao(D, erro)
        except Exception as e:                                  # regra que não consegue ler o dado é problema, nunca silêncio
            erro('(validador)', f'a regra não conseguiu ler o dado ({type(e).__name__}: {str(e)[:150]}); confira o formato do arquivo')
    return erros


# =========================================================================================
# Utilidades pequenas
# =========================================================================================
def lista(x):
    return x if isinstance(x, list) else []


def dicio(x):
    return x if isinstance(x, dict) else {}


def so_dicts(x):
    return [i for i in lista(x) if isinstance(i, dict)]


def identidades(D):
    return list(lista(dicio(dicio(D['vocab']).get('identidades')).get('agentes')))


def acoes_do_autor(D):
    """Ações do AUTOR que um serviço pode liberar: as do vocabulário menos PEDIR_SUBCARD (MEL-24)."""
    return [a for a in dicio(dicio(dicio(D['vocab']).get('acoes')).get('AUTOR')) if a != 'PEDIR_SUBCARD']


def catalogo(D):
    return so_dicts(dicio(D['servicos']).get('servicos'))


def servico_por_id(D):
    return {s.get('id'): s for s in catalogo(D)}


def servico_por_tipo(D):
    return {s.get('tipo_de_entrega'): s for s in catalogo(D)}


def servicos_do(D, ident):
    return [s for s in catalogo(D) if s.get('dono') == ident]


def julgadora(D):
    return next((s for s in catalogo(D) if s.get('julgadora') is True), None)


def linhas_do_organograma(D):
    return {a.get('identidade'): a for a in so_dicts(dicio(D['organograma']).get('agentes'))}


def indice_dos_agentes(D):
    return dicio(dicio(D['servicos']).get('agentes'))


def pacote_confirmado(D, empresa):
    pacote = dicio(dicio(dicio(D['organograma']).get('empresas')).get(empresa)).get('pacote')
    return dicio(pacote).get('estado') == 'CONFIRMADO'


def revisores_efetivos(D, servico):
    """[revisor, reserva] do serviço, só os de aptidão APTA no tipo, e FUNDADOR no fim (MAT-21)."""
    efetivos = []
    for quem in (servico.get('revisor'), servico.get('reserva')):
        if quem == FUNDADOR:
            continue
        if dicio(dicio(indice_dos_agentes(D).get(quem)).get('revisa')).get(servico.get('tipo_de_entrega')) == 'APTA':
            efetivos.append(quem)
    return efetivos + [FUNDADOR]


def normaliza(valor):
    """Para comparar listas sem depender da ordem."""
    if isinstance(valor, list):
        return sorted(json.dumps(i, sort_keys=True, ensure_ascii=False, default=str) for i in valor)
    return valor


def etapas_de(roteiro):
    return so_dicts(dicio(roteiro).get('etapas'))


def roteiros_v31(D):
    return {nome: r for nome, r in D['roteiros'].items() if isinstance(r, dict) and 'versao' in r}


# =========================================================================================
# Esquemas
# =========================================================================================
@lru_cache(maxsize=None)
def esquema(caminho):
    texto = (RAIZ / caminho).read_text(encoding='utf-8')
    return Draft202012Validator(json.loads(texto))


@lru_cache(maxsize=None)
def esquema_da_resposta_do_autor():
    """acao.schema.json, $defs/saida_do_autor: o formato da resposta de um caso bom ou ruim."""
    acao = json.loads((RAIZ / 'schemas/acao.schema.json').read_text(encoding='utf-8'))
    return Draft202012Validator({'$schema': acao['$schema'], '$ref': '#/$defs/saida_do_autor', '$defs': acao['$defs']})


def esquema_do_organograma(ident):
    texto = {'type': 'string', 'minLength': 2}
    return {
        'type': 'object',
        'required': ['versao', 'fundador', 'coordenacao', 'empresas', 'escopo_pessoal', 'grupos', 'agentes'],
        'properties': {
            'versao': {'type': 'string', 'pattern': r'^3\.1\.[0-9]+$'},
            'empresas': {
                'type': 'object', 'required': EMPRESAS, 'additionalProperties': False,
                'properties': {e: {'type': 'object', 'required': ['nome', 'area', 'pacote'],
                                   'properties': {'nome': texto, 'area': texto,
                                                  'pacote': {'type': 'object', 'required': ['estado'],
                                                             'properties': {'estado': {'enum': ['CONFIRMADO', 'NAO_CONFIRMADO']}}}}}
                               for e in EMPRESAS}},
            'escopo_pessoal': {'type': 'object', 'required': ['codigo', 'quem_atende'],
                               'properties': {'quem_atende': {'type': 'array', 'minItems': 1, 'items': {'enum': ident}}}},
            'grupos': {'type': 'object', 'minProperties': 1,
                       'additionalProperties': {'type': 'object', 'required': ['nome', 'agentes'],
                                                'properties': {'agentes': {'type': 'array', 'minItems': 1, 'items': {'enum': ident}}}}},
            'agentes': {
                'type': 'array', 'minItems': 21, 'maxItems': 21,
                'items': {
                    'type': 'object', 'additionalProperties': False,
                    'required': ['id', 'identidade', 'nome', 'cargo', 'grupo', 'escopo', 'fase_de_ativacao', 'estado'],
                    'properties': {
                        'id': {'type': 'string', 'pattern': r'^AGT-(0[1-9]|1[0-9]|2[01])$'},
                        'identidade': {'enum': ident},
                        'nome': texto, 'cargo': texto,
                        'grupo': {'type': 'string', 'pattern': r'^GRP-[A-Z-]+$'},
                        'escopo': {'enum': ['EMPRESAS', 'PESSOAL']},
                        'fase_de_ativacao': {'enum': FASES},
                        'estado': {'enum': ['ATIVO', 'ESTAGIO', 'PAUSADO']},
                    }}},
        }}


def esquema_dos_servicos(ident, acoes):
    booleano = {'type': 'boolean'}
    texto = {'type': 'string', 'minLength': 5}
    servico = {
        'type': 'object',
        'required': ['id', 'nome', 'dono', 'tipo_de_entrega', 'entrega', 'revisor', 'reserva', 'acoes_permitidas',
                     'ferramentas', 'usa_internet', 'efeito', 'acao_externa_permitida', 'acoes_do_fundador',
                     'julgado_pelo_parecer', 'modelo_menor', 'fase_de_ativacao', 'estado', 'empresas', 'escolhivel',
                     'avulso', 'pode_entrar_em_roteiro', 'pode_ser_pulada', 'pronto_padrao', 'exemplos_de_pedido', 'nao_atende'],
        'properties': {
            'id': {'type': 'string', 'pattern': r'^SRV-[A-Z0-9]+(-[A-Z0-9]+)*$'},
            'nome': texto,
            'dono': {'enum': ident},
            'tipo_de_entrega': {'type': 'string', 'pattern': r'^[a-z][a-z0-9_]*$'},
            'entrega': {'type': 'string', 'pattern': r'^deliverables/[a-z][a-z0-9_]*\.yaml$'},
            'revisor': {'enum': ident},
            'reserva': {'enum': ident + [FUNDADOR]},
            'segundo_revisor': {'const': FUNDADOR},
            'acoes_permitidas': {'type': 'array', 'minItems': 2, 'uniqueItems': True, 'items': {'enum': acoes}},
            'ferramentas': {'type': 'array'},
            'usa_internet': booleano,
            'efeito': {'const': 'interno'},
            'acao_externa_permitida': {'type': 'array', 'minItems': 1, 'uniqueItems': True, 'items': {'enum': ['NENHUMA', 'SO_FUNDADOR']}},
            'acoes_do_fundador': {
                'type': 'array', 'maxItems': 1,
                'items': {'type': 'object', 'required': ['id', 'categorias', 'descricao'],
                          'properties': {'id': {'type': 'string', 'pattern': r'^AF-[A-Z-]+$'},
                                         'categorias': {'type': 'array', 'minItems': 1, 'maxItems': 2, 'uniqueItems': True,
                                                        'items': {'enum': CATEGORIAS_EXTERNAS}},
                                         'descricao': texto}}},
            'julgado_pelo_parecer': {'enum': ['SEMPRE', 'SE_O_ROTEIRO_PEDIR', 'NUNCA']},
            'modelo_menor': {'enum': ['NUNCA', 'SEM_PROVA', 'APTO']},
            'fase_de_ativacao': {'enum': FASES},
            'estado': {'enum': ['RASCUNHO', 'EM_TESTE', 'ESTAGIO', 'ATIVO', 'PAUSADO', 'APOSENTADO']},
            'empresas': {'type': 'array', 'minItems': 1, 'uniqueItems': True, 'items': {'enum': EMPRESAS + ['PESSOAL']}},
            'escolhivel': booleano, 'avulso': booleano, 'pode_entrar_em_roteiro': booleano, 'pode_ser_pulada': booleano,
            'pronto_padrao': {'type': 'string', 'minLength': 10},
            'exemplos_de_pedido': {'type': 'array', 'items': {'type': 'string'}},
            'nao_atende': {'type': 'array', 'items': {'type': 'string'}},
        }}
    return {
        'type': 'object',
        'required': ['versao', 'fases', 'recebem_card', 'aptidao_de_revisao', 'ferramentas_nossas', 'acoes_do_autor_liberaveis',
                     'portao1_comum', 'agentes', 'servicos'],
        'properties': {
            'versao': {'type': 'string', 'pattern': r'^3\.1\.[0-9]+$'},
            'fases': {'const': FASES},
            'recebem_card': {'type': 'array', 'minItems': 1, 'items': {'enum': ['ESTAGIO', 'ATIVO']}},
            'aptidao_de_revisao': {'type': 'object', 'required': ['estados'],
                                   'properties': {'estados': {'type': 'object', 'required': ['SEM_PROVA', 'APTA', 'PAUSADA']}}},
            'agentes': {'type': 'object', 'additionalProperties': False,
                        'properties': {i: {'type': 'object', 'required': ['id', 'ficha', 'possui', 'revisa'],
                                           'properties': {'possui': {'type': 'object'},
                                                          'revisa': {'type': 'object', 'additionalProperties': {'enum': ['SEM_PROVA', 'APTA', 'PAUSADA']}}}}
                                       for i in ident}},
            'servicos': {'type': 'array', 'minItems': 21, 'items': servico},
        }}


_TRADUCOES = {
    'minItems': 'tem menos itens do que o mínimo ({})', 'maxItems': 'tem mais itens do que o máximo ({})',
    'minLength': 'texto curto demais (mínimo {} caracteres)', 'maxLength': 'texto longo demais (máximo {} caracteres)',
    'minimum': 'valor abaixo do mínimo ({})', 'maximum': 'valor acima do máximo ({})',
    'minProperties': 'tem menos campos do que o mínimo ({})',
}


def traduzir(e):
    """Mensagem do jsonschema em português simples."""
    v, valor = e.validator, e.instance
    if v == 'required':
        faltam = [c for c in e.validator_value if isinstance(valor, dict) and c not in valor]
        return 'falta o campo ' + ', '.join(repr(c) for c in faltam)
    if v == 'additionalProperties':
        conhecidos = dicio(e.schema.get('properties'))
        extras = sorted(k for k in valor if k not in conhecidos) if isinstance(valor, dict) else []
        return 'campo não permitido: ' + ', '.join(repr(k) for k in extras)
    if v == 'enum':
        permitidos = list(e.validator_value)
        if len(permitidos) > 6:
            permitidos = permitidos[:6] + [f'... ({len(e.validator_value)} valores)']
        return f'valor {valor!r} fora da lista permitida {permitidos}'
    if v == 'const':
        return f'valor {valor!r}, mas o esperado é {e.validator_value!r}'
    if v == 'type':
        return f'tipo errado (o esperado é {e.validator_value})'
    if v == 'pattern':
        return f'{str(valor)[:60]!r} não segue o formato {e.validator_value}'
    if v == 'uniqueItems':
        return 'tem itens repetidos'
    if v == 'contains':
        return 'falta um item obrigatório da lista'
    if v == 'not':
        return 'tem algo que o esquema proíbe aqui'
    if v in _TRADUCOES:
        return _TRADUCOES[v].format(e.validator_value)
    return f"não cumpre a regra '{v}' do esquema"


def problemas_de_esquema(validador, dado):
    """Lista de textos 'caminho: o que está errado' (no máximo LIMITE_POR_ARQUIVO)."""
    achados = sorted(validador.iter_errors(dado), key=lambda e: [str(p) for p in e.absolute_path])
    saida = []
    for e in achados[:LIMITE_POR_ARQUIVO]:
        caminho = '/'.join(str(p) for p in e.absolute_path) or '(raiz)'
        saida.append(f'{caminho}: {traduzir(e)}')
    if len(achados) > LIMITE_POR_ARQUIVO:
        saida.append(f'... e mais {len(achados) - LIMITE_POR_ARQUIVO} problema(s) no mesmo arquivo')
    return saida


# =========================================================================================
# Carga dos arquivos
# =========================================================================================
def _ler_yaml(caminho, raiz, falhas):
    onde = caminho.relative_to(raiz).as_posix()
    try:
        return yaml.load(caminho.read_text(encoding='utf-8'), Loader=_CARREGADOR)
    except FileNotFoundError:
        falhas.append((onde, 'arquivo não encontrado'))
    except (yaml.YAMLError, UnicodeDecodeError) as e:
        falhas.append((onde, f'não consegui ler o YAML: {str(e)[:120]}'))
    return None


def carregar(raiz=RAIZ):
    """Lê todos os arquivos de especificação. Falha de leitura vira problema da regra CARGA."""
    raiz = Path(raiz)
    falhas = []
    D = {'raiz': raiz, 'falhas_de_carga': falhas}
    for chave, arquivo in (('vocab', 'maquina/vocabulario.yaml'), ('organograma', 'organograma.yaml'),
                           ('servicos', 'servicos.yaml'), ('modelos', 'models.yaml')):
        dado = _ler_yaml(raiz / arquivo, raiz, falhas)
        if dado is not None and not isinstance(dado, dict):
            falhas.append((arquivo, 'o arquivo deveria ser um conjunto de campos'))
        D[chave] = dado if isinstance(dado, dict) else {}

    D['fichas'], D['arquivo_da_ficha'], D['fichas_antigas'] = {}, {}, []
    for f in sorted((raiz / 'agents').glob('*.yaml')):
        ficha = _ler_yaml(f, raiz, falhas)
        if ficha is None:
            continue
        if not isinstance(ficha, dict) or 'versao' not in ficha:
            D['fichas_antigas'].append(f.name)             # ficha da v1: não conta
            continue
        ident = ficha.get('identidade') or f.stem.upper()
        if ident in D['fichas']:
            falhas.append((f'agents/{f.name}', f'identidade {ident} repetida (já está em agents/{D["arquivo_da_ficha"][ident]})'))
            continue
        D['fichas'][ident] = ficha
        D['arquivo_da_ficha'][ident] = f.name

    D['entregas'] = {}
    for f in sorted((raiz / 'deliverables').glob('*.yaml')):
        if f.name == 'entregas.yaml':                      # índice antigo da v1, substituído por um arquivo por tipo
            continue
        entrega = _ler_yaml(f, raiz, falhas)
        if entrega is not None:
            D['entregas'][f.stem] = entrega

    D['roteiros'] = {}
    for f in sorted((raiz / 'playbooks').glob('*.yaml')):
        roteiro = _ler_yaml(f, raiz, falhas)
        if roteiro is not None:
            D['roteiros'][f.name] = roteiro

    D['casos'], D['jornadas'] = {}, {}
    for pasta in sorted(p for p in (raiz / 'casos').glob('*') if p.is_dir()):
        casos = {'boas': {}, 'defeitos': {}}
        for tipo in casos:
            for f in sorted((pasta / tipo).glob('*.yaml')):
                caso = _ler_yaml(f, raiz, falhas)
                if caso is not None:
                    casos[tipo][f.name] = caso
        D['casos'][pasta.name] = casos
        for f in sorted(pasta.glob('jornada*.yaml')):
            jornada = _ler_yaml(f, raiz, falhas)
            if jornada is not None:
                D['jornadas'][f.relative_to(raiz).as_posix()] = jornada
    return D


# =========================================================================================
# CARGA e ESQUEMAS: o formato de cada arquivo
# =========================================================================================
@regra('CARGA', 'Todo arquivo de especificação existe e é um YAML legível.')
def carga(D, erro):
    for onde, texto in D['falhas_de_carga']:
        erro(onde, texto)


@regra('ESQUEMA-ORGANOGRAMA', 'organograma.yaml segue o formato: 21 agentes, 4 empresas com pacote, grupos.')
def esquema_organograma(D, erro):
    for p in problemas_de_esquema(Draft202012Validator(esquema_do_organograma(identidades(D))), D['organograma']):
        erro('organograma.yaml', p)


@regra('ESQUEMA-SERVICOS', 'servicos.yaml segue o formato: cada serviço com dono, tipo, revisor, reserva, ações e estado válidos.')
def esquema_servicos(D, erro):
    validador = Draft202012Validator(esquema_dos_servicos(identidades(D), acoes_do_autor(D)))
    for p in problemas_de_esquema(validador, D['servicos']):
        erro('servicos.yaml', p)


@regra('ESQUEMA-FICHA', 'Cada ficha de agente segue agent.schema.json.')
def esquema_ficha(D, erro):
    for ident, ficha in D['fichas'].items():
        for p in problemas_de_esquema(esquema('schemas/agent.schema.json'), ficha):
            erro(f"agents/{D['arquivo_da_ficha'][ident]}", p)


@regra('ESQUEMA-ENTREGA', 'Cada tipo de entrega segue entrega.schema.json.')
def esquema_entrega(D, erro):
    for tipo, entrega in D['entregas'].items():
        for p in problemas_de_esquema(esquema('schemas/entrega.schema.json'), entrega):
            erro(f'deliverables/{tipo}.yaml', p)


@regra('ESQUEMA-ROTEIRO', 'Cada roteiro v3.1 segue playbook.schema.json.')
def esquema_roteiro(D, erro):
    for nome, roteiro in roteiros_v31(D).items():
        for p in problemas_de_esquema(esquema('schemas/playbook.schema.json'), roteiro):
            erro(f'playbooks/{nome}', p)


@regra('ROTEIRO-ANTIGO', 'Roteiro sem o campo versao é do formato antigo (v1) e precisa ser reescrito para a v3.1.')
def roteiro_antigo(D, erro):
    for nome, roteiro in D['roteiros'].items():
        if nome not in roteiros_v31(D):
            erro(f'playbooks/{nome}', "roteiro no formato antigo (v1, sem 'versao'): reescrever para a v3.1 (etapas por serviço do catálogo)")


@regra('ESQUEMA-JORNADA', 'Cada jornada segue maquina/jornada.schema.json.')
def esquema_jornada(D, erro):
    for onde, jornada in D['jornadas'].items():
        for p in problemas_de_esquema(esquema('maquina/jornada.schema.json'), jornada):
            erro(onde, p)


@regra('ESQUEMA-CASO', 'A resposta de cada caso bom ou ruim segue o formato da resposta do autor (acao.schema.json).')
def esquema_caso(D, erro):
    for servico, casos in D['casos'].items():
        for tipo in ('boas', 'defeitos'):
            for nome, caso in casos[tipo].items():
                onde = f'casos/{servico}/{tipo}/{nome}'
                if not isinstance(dicio(caso).get('resposta'), dict):
                    erro(onde, "o caso não tem o campo 'resposta'")
                    continue
                for p in problemas_de_esquema(esquema_da_resposta_do_autor(), caso['resposta']):
                    erro(onde, f'resposta/{p}')


# =========================================================================================
# MODELOS: models.yaml
# =========================================================================================
@regra('MODELOS-FORMATO', 'Cada apelido de modelo tem só modelo, provedor e para_que; um provedor só; todo apelido tem papel.')
def modelos_formato(D, erro):
    m = D['modelos']
    apelidos, papeis = dicio(m.get('apelidos')), dicio(m.get('papel_do_apelido'))
    if not apelidos:
        erro('models.yaml', 'não tem apelidos de modelo')
    for nome, a in apelidos.items():
        a = dicio(a)
        if set(a) != {'modelo', 'provedor', 'para_que'}:
            erro('models.yaml', f"apelido '{nome}' deve ter exatamente modelo, provedor e para_que (tem: {sorted(a)})")
        if not isinstance(a.get('modelo'), str):
            erro('models.yaml', f"apelido '{nome}': 'modelo' deve ser UM nome de modelo (texto), nunca uma lista")
        if a.get('provedor') != m.get('provedor'):
            erro('models.yaml', f"apelido '{nome}': provedor {a.get('provedor')!r} é diferente do único provedor do arquivo ({m.get('provedor')!r})")
        if papeis.get(nome) not in ('COORDENACAO', 'REVISAO', 'AUTOR'):
            erro('models.yaml', f"apelido '{nome}' sem papel válido em papel_do_apelido (COORDENACAO, REVISAO ou AUTOR)")
    for nome in papeis:
        if nome not in apelidos:
            erro('models.yaml', f"papel_do_apelido cita '{nome}', que não é um apelido")
    menor = dicio(m.get('modelo_menor_por_ordem_sua'))
    if menor and menor.get('provedor') != m.get('provedor'):
        erro('models.yaml', 'modelo_menor_por_ordem_sua usa outro provedor')


@regra('MODELOS-RESERVA', 'Nenhum apelido tem modelo reserva, fallback ou segundo provedor (nenhuma troca escondida).')
def modelos_reserva(D, erro):
    def procura(no, caminho):
        if isinstance(no, dict):
            for chave, valor in no.items():
                nome = str(chave).lower()
                if 'reserva' in nome or 'fallback' in nome:
                    erro('models.yaml', f"campo de reserva '{chave}' em {caminho or '(raiz)'}: não pode haver modelo reserva")
                procura(valor, f'{caminho}/{chave}' if caminho else str(chave))
        elif isinstance(no, list):
            for i, valor in enumerate(no):
                procura(valor, f'{caminho}[{i}]')
    procura(D['modelos'], '')


# =========================================================================================
# CATÁLOGO: organograma.yaml e servicos.yaml (regras da matriz, MAT-nn)
# =========================================================================================
@regra('ORGANOGRAMA', 'Os 21 agentes estão na ordem do vocabulário, com id AGT-01 a AGT-21 e em exatamente um grupo.')
def organograma(D, erro):
    ident = identidades(D)
    org = D['organograma']
    linhas = so_dicts(org.get('agentes'))
    if [a.get('identidade') for a in linhas] != ident:
        erro('organograma.yaml', 'as identidades dos agentes não são as 21 do vocabulário, na mesma ordem')
    for n, a in enumerate(linhas, start=1):
        if a.get('id') != f'AGT-{n:02d}':
            erro('organograma.yaml', f"{a.get('identidade')}: id {a.get('id')} deveria ser AGT-{n:02d}")
    grupos = dicio(org.get('grupos'))
    for a in linhas:
        em = [g for g, dados in grupos.items() if a.get('identidade') in lista(dicio(dados).get('agentes'))]
        if em != [a.get('grupo')]:
            erro('organograma.yaml', f"{a.get('identidade')}: grupo {a.get('grupo')} não bate com os grupos que o listam {em}")
    if dicio(org.get('coordenacao')).get('identidade') != 'HELENA':
        erro('organograma.yaml', 'a coordenação deve ser a HELENA')


@regra('CATALOGO-INDICE', 'O índice agentes de servicos.yaml (ficha, id, tipos que possui) bate com o organograma e com os serviços.')
def catalogo_indice(D, erro):
    indice, org = indice_dos_agentes(D), linhas_do_organograma(D)
    for ident in identidades(D):
        linha = dicio(indice.get(ident))
        if not linha:
            erro('servicos.yaml', f'agentes: falta a linha de {ident}')
            continue
        if linha.get('id') != dicio(org.get(ident)).get('id'):
            erro('servicos.yaml', f"agentes.{ident}: id {linha.get('id')} é diferente do organograma")
        if linha.get('ficha') != f'agents/{ident.lower()}.yaml':
            erro('servicos.yaml', f"agentes.{ident}: ficha {linha.get('ficha')} deveria ser agents/{ident.lower()}.yaml")
        esperado = {s.get('tipo_de_entrega'): s.get('entrega') for s in servicos_do(D, ident)}
        if dicio(linha.get('possui')) != esperado:
            erro('servicos.yaml', f"agentes.{ident}: 'possui' {dicio(linha.get('possui'))} é diferente dos serviços de que é dono {esperado}")


@regra('MAT-01', 'Cada um dos 21 agentes é dono de pelo menos 1 serviço.')
def mat01(D, erro):
    for ident in identidades(D):
        if not servicos_do(D, ident):
            erro('servicos.yaml', f'{ident} não é dono de nenhum serviço')


@regra('MAT-02', 'Todo serviço tem 1 dono e 1 tipo de entrega; id e tipo não se repetem; o arquivo do tipo é deliverables/<tipo>.yaml.')
def mat02(D, erro):
    ids, tipos = {}, {}
    for s in catalogo(D):
        for campo, vistos in (('id', ids), ('tipo_de_entrega', tipos)):
            valor = s.get(campo)
            if valor in vistos:
                erro('servicos.yaml', f"{campo} '{valor}' repetido (serviços {vistos[valor]} e {s.get('id')})")
            else:
                vistos[valor] = s.get('id')
        if s.get('entrega') != f"deliverables/{s.get('tipo_de_entrega')}.yaml":
            erro('servicos.yaml', f"{s.get('id')}: entrega {s.get('entrega')} deveria ser deliverables/{s.get('tipo_de_entrega')}.yaml")


@regra('MAT-03', 'Revisor diferente do dono; reserva diferente do dono e do revisor.')
def mat03(D, erro):
    for s in catalogo(D):
        sid, dono, revisor, reserva = s.get('id'), s.get('dono'), s.get('revisor'), s.get('reserva')
        if revisor == dono:
            erro('servicos.yaml', f'{sid}: o revisor ({revisor}) é o próprio dono')
        if reserva == dono:
            erro('servicos.yaml', f'{sid}: a reserva ({reserva}) é o próprio dono')
        if reserva == revisor:
            erro('servicos.yaml', f'{sid}: a reserva é igual ao revisor ({revisor})')


@regra('MAT-04', "Revisor e reserva têm o tipo em 'revisa'; e 'revisa' lista só tipos em que o agente é revisor ou reserva.")
def mat04(D, erro):
    indice, por_tipo = indice_dos_agentes(D), servico_por_tipo(D)
    for s in catalogo(D):
        for papel in ('revisor', 'reserva'):
            quem = s.get(papel)
            if quem in (None, FUNDADOR):
                continue
            if s.get('tipo_de_entrega') not in dicio(dicio(indice.get(quem)).get('revisa')):
                erro('servicos.yaml', f"{s.get('id')}: {papel} {quem} não tem '{s.get('tipo_de_entrega')}' em 'revisa'")
    for quem, linha in indice.items():
        for tipo in dicio(dicio(linha).get('revisa')):
            s = por_tipo.get(tipo)
            if not s:
                erro('servicos.yaml', f"agentes.{quem}.revisa: o tipo '{tipo}' não existe no catálogo")
            elif quem not in (s.get('revisor'), s.get('reserva')):
                erro('servicos.yaml', f"agentes.{quem}.revisa lista '{tipo}', mas {quem} não é revisor nem reserva de {s.get('id')}")


@regra('MAT-05', 'Quem revisa não julga depois: revisor e reserva de um tipo julgado não são a Clara nem revisor/reserva dela.')
def mat05(D, erro):
    j = julgadora(D)
    if not j:
        erro('servicos.yaml', 'nenhum serviço é a julgadora (julgadora: true)')
        return
    proibidos = {j.get('dono'), j.get('revisor'), j.get('reserva')} - {FUNDADOR, None}
    por_tipo = servico_por_tipo(D)
    for tipo in lista(j.get('julga_tipos')):
        s = por_tipo.get(tipo)
        if not s:
            erro('servicos.yaml', f"julga_tipos: o tipo '{tipo}' não existe no catálogo")
            continue
        for papel in ('revisor', 'reserva'):
            if s.get(papel) in proibidos:
                erro('servicos.yaml', f"{s.get('id')}: o {papel} {s.get(papel)} julgaria depois a peça que revisou (julgadora {j.get('id')})")


@regra('MAT-06', 'O dono de um tipo julgado não é revisor nem reserva da julgadora: ninguém aprova o parecer da própria peça.')
def mat06(D, erro):
    j = julgadora(D)
    if not j:
        return
    por_tipo = servico_por_tipo(D)
    for tipo in lista(j.get('julga_tipos')):
        dono = dicio(por_tipo.get(tipo)).get('dono')
        if dono is not None and dono in (j.get('revisor'), j.get('reserva')):
            erro('servicos.yaml', f"{dono} é dono de '{tipo}' e também revisor ou reserva do parecer que o julga")


@regra('MAT-07', 'A julgadora é uma só, nunca é card sozinho e tem o fundador como segundo revisor.')
def mat07(D, erro):
    todas = [s for s in catalogo(D) if s.get('julgadora') is True]
    if len(todas) != 1:
        erro('servicos.yaml', f'deve haver exatamente 1 julgadora (há {len(todas)})')
    for j in todas:
        if j.get('escolhivel') is not False or j.get('avulso') is not False:
            erro('servicos.yaml', f"{j.get('id')}: a julgadora nunca é card sozinho (escolhivel e avulso devem ser false)")
        if j.get('segundo_revisor') != FUNDADOR:
            erro('servicos.yaml', f"{j.get('id')}: o segundo revisor da julgadora deve ser o FUNDADOR")
        if j.get('tipo_de_entrega') in lista(j.get('julga_tipos')):
            erro('servicos.yaml', f"{j.get('id')}: a julgadora não pode julgar o próprio tipo")


@regra('MAT-08', 'Ninguém é revisor titular de mais de 3 tipos.')
def mat08(D, erro):
    contagem = defaultdict(list)
    for s in catalogo(D):
        contagem[s.get('revisor')].append(s.get('tipo_de_entrega'))
    for quem, tipos in contagem.items():
        if len(tipos) > 3:
            erro('servicos.yaml', f'{quem} é revisor titular de {len(tipos)} tipos ({", ".join(map(str, tipos))}); o máximo é 3')


@regra('FERRAMENTAS', 'Só existem as nossas ferramentas (ler_pagina, buscar), de efeito LER, na fase certa; usa_internet bate com a lista.')
def ferramentas(D, erro):
    nossas = dicio(D['servicos'].get('ferramentas_nossas'))
    if set(nossas) != {'ler_pagina', 'buscar'}:
        erro('servicos.yaml', f'ferramentas_nossas deve ter exatamente ler_pagina e buscar (tem: {sorted(nossas)})')
    for nome, f in nossas.items():
        if dicio(f).get('efeito') != 'LER':
            erro('servicos.yaml', f"ferramentas_nossas.{nome}: efeito {dicio(f).get('efeito')!r}; só LER é permitido")
    for s in catalogo(D):
        sid = s.get('id')
        for f in lista(s.get('ferramentas')):
            f = dicio(f)
            nome = f.get('nome')
            if nome not in nossas:
                erro('servicos.yaml', f"{sid}: ferramenta {nome!r} não é uma das nossas")
                continue
            if f.get('efeito') != 'LER':
                erro('servicos.yaml', f"{sid}: ferramenta {nome} com efeito {f.get('efeito')!r}; só LER é permitido")
            if f.get('desde') != dicio(nossas[nome]).get('desde'):
                erro('servicos.yaml', f"{sid}: ferramenta {nome} 'desde' {f.get('desde')!r} é diferente do catálogo ({dicio(nossas[nome]).get('desde')!r})")
        if bool(s.get('usa_internet')) != bool(lista(s.get('ferramentas'))):
            erro('servicos.yaml', f"{sid}: usa_internet={s.get('usa_internet')} não bate com a lista de ferramentas")


@regra('MAT-09', 'Serviço com internet só libera ENTREGAR e REGISTRAR_FALHA e nenhuma ação externa.')
def mat09(D, erro):
    for s in catalogo(D):
        if not (s.get('usa_internet') or lista(s.get('ferramentas'))):
            continue
        extras = sorted(set(lista(s.get('acoes_permitidas'))) - {'ENTREGAR', 'REGISTRAR_FALHA'})
        if extras:
            erro('servicos.yaml', f"{s.get('id')}: lê a internet, mas libera também {extras}; só ENTREGAR e REGISTRAR_FALHA")
        if lista(s.get('acao_externa_permitida')) != ['NENHUMA'] or lista(s.get('acoes_do_fundador')):
            erro('servicos.yaml', f"{s.get('id')}: lê a internet, então não pode ter ação externa nem ação do fundador")


@regra('MAT-11', 'Ação do fundador: no máximo 1 por serviço, id único, e SO_FUNDADOR só quando há ação; o relatório final não tem.')
def mat11(D, erro):
    ids = {}
    for s in catalogo(D):
        acoes = so_dicts(s.get('acoes_do_fundador'))
        if len(acoes) > 1:
            erro('servicos.yaml', f"{s.get('id')}: {len(acoes)} ações do fundador; o máximo é 1")
        if ('SO_FUNDADOR' in lista(s.get('acao_externa_permitida'))) != bool(acoes):
            erro('servicos.yaml', f"{s.get('id')}: SO_FUNDADOR em acao_externa_permitida só combina com ter ação do fundador")
        if acoes and s.get('tipo_de_entrega') == 'relatorio_final':
            erro('servicos.yaml', f"{s.get('id')}: o relatório final não tem ação do fundador")
        for a in acoes:
            if a.get('id') in ids:
                erro('servicos.yaml', f"ação do fundador {a.get('id')} repetida ({ids[a.get('id')]} e {s.get('id')})")
            ids[a.get('id')] = s.get('id')


@regra('MAT-13', 'Fase e estado de cada agente no organograma são os derivados dos serviços dele.')
def mat13(D, erro):
    for ident, linha in linhas_do_organograma(D).items():
        meus = servicos_do(D, ident)
        if not meus:
            continue
        estados = [s.get('estado') for s in meus]
        esperado = 'ATIVO' if 'ATIVO' in estados else 'ESTAGIO' if 'ESTAGIO' in estados else 'PAUSADO'
        if linha.get('estado') != esperado:
            erro('organograma.yaml', f"{ident}: estado {linha.get('estado')}, mas os serviços dele dão {esperado}")
        fases = [s.get('fase_de_ativacao') for s in meus if s.get('fase_de_ativacao') in FASES]
        if fases and linha.get('fase_de_ativacao') != min(fases, key=FASES.index):
            erro('organograma.yaml', f"{ident}: fase {linha.get('fase_de_ativacao')}, mas a primeira fase dos serviços dele é {min(fases, key=FASES.index)}")


@regra('MAT-14', 'A empresa PESSOAL é só dos serviços da Laura, e eles não têm nenhuma outra empresa.')
def mat14(D, erro):
    quem_atende = lista(dicio(D['organograma'].get('escopo_pessoal')).get('quem_atende'))
    for s in catalogo(D):
        empresas = lista(s.get('empresas'))
        pessoal = 'PESSOAL' in empresas
        if pessoal != (s.get('dono') in quem_atende):
            erro('servicos.yaml', f"{s.get('id')}: a empresa PESSOAL é só dos serviços de {quem_atende}")
        if pessoal and empresas != ['PESSOAL']:
            erro('servicos.yaml', f"{s.get('id')}: serviço PESSOAL não pode ter outra empresa ({empresas})")


@regra('MAT-17', 'Toda lista de ações tem ENTREGAR e REGISTRAR_FALHA, só usa ações liberáveis e nunca PEDIR_SUBCARD.')
def mat17(D, erro):
    liberaveis = acoes_do_autor(D)
    if lista(D['servicos'].get('acoes_do_autor_liberaveis')) != liberaveis:
        erro('servicos.yaml', f"acoes_do_autor_liberaveis deve ser {liberaveis} (as do vocabulário, sem PEDIR_SUBCARD)")
    for s in catalogo(D):
        acoes = lista(s.get('acoes_permitidas'))
        for obrigatoria in ('ENTREGAR', 'REGISTRAR_FALHA'):
            if obrigatoria not in acoes:
                erro('servicos.yaml', f"{s.get('id')}: falta {obrigatoria} em acoes_permitidas")
        fora = [a for a in acoes if a not in liberaveis]
        if fora:
            erro('servicos.yaml', f"{s.get('id')}: ação não liberável em acoes_permitidas: {fora}")


@regra('MAT-22', 'Sempre julgado: serviço com ação do fundador tem o tipo em julga_tipos e julgado_pelo_parecer SEMPRE.')
def mat22(D, erro):
    j = julgadora(D)
    julga = lista(dicio(j).get('julga_tipos'))
    for s in catalogo(D):
        if s is j:
            continue
        tem_acao = bool(lista(s.get('acoes_do_fundador')))
        julgado = s.get('julgado_pelo_parecer')
        if tem_acao and julgado != 'SEMPRE':
            erro('servicos.yaml', f"{s.get('id')}: tem ação do fundador, então julgado_pelo_parecer deve ser SEMPRE (está {julgado})")
        if julgado == 'SEMPRE' and not tem_acao:
            erro('servicos.yaml', f"{s.get('id')}: julgado_pelo_parecer SEMPRE só combina com ter ação do fundador")
        if (julgado in ('SEMPRE', 'SE_O_ROTEIRO_PEDIR')) != (s.get('tipo_de_entrega') in julga):
            erro('servicos.yaml', f"{s.get('id')}: julgado_pelo_parecer={julgado} não bate com julga_tipos da julgadora")


@regra('MAT-23', 'Serviço em ESTAGIO ou ATIVO só lista empresa com pacote CONFIRMADO.')
def mat23(D, erro):
    recebem = lista(D['servicos'].get('recebem_card'))
    for s in catalogo(D):
        if s.get('estado') in recebem:
            for empresa in lista(s.get('empresas')):
                if empresa != 'PESSOAL' and not pacote_confirmado(D, empresa):
                    erro('servicos.yaml', f"{s.get('id')} ({s.get('estado')}) lista {empresa}, cujo pacote não está CONFIRMADO")


def passo_de_ativacao(D):
    """Passo de cada agente na ordem de ativação (0 = ligado desde o início)."""
    ordem = dicio(D['servicos'].get('ordem_de_ativacao'))
    passos = {a: 0 for a in lista(ordem.get('ligados_desde_o_inicio'))}
    for p in so_dicts(ordem.get('passos')):
        passos[p.get('agente')] = p.get('passo')
    return passos


@regra('MAT-12', 'Ordem de ativação: cada agente uma vez; o revisor titular liga no mesmo passo do dono ou antes; serviço em ESTAGIO/ATIVO tem titular APTO.')
def mat12(D, erro):
    ordem = dicio(D['servicos'].get('ordem_de_ativacao'))
    nomes = lista(ordem.get('ligados_desde_o_inicio')) + [p.get('agente') for p in so_dicts(ordem.get('passos'))]
    passos = passo_de_ativacao(D)
    for ident in identidades(D):
        if nomes.count(ident) != 1:
            erro('servicos.yaml', f'ordem_de_ativacao: {ident} aparece {nomes.count(ident)} vez(es); deve aparecer exatamente 1')
    indice = indice_dos_agentes(D)
    for s in catalogo(D):
        dono, titular, tipo = s.get('dono'), s.get('revisor'), s.get('tipo_de_entrega')
        if dono in passos and titular in passos and passos[titular] > passos[dono]:
            erro('servicos.yaml', f"{s.get('id')}: o revisor titular {titular} (passo {passos[titular]}) liga depois do dono {dono} (passo {passos[dono]})")
        if s.get('estado') in lista(D['servicos'].get('recebem_card')) and dicio(dicio(indice.get(titular)).get('revisa')).get(tipo) != 'APTA':
            erro('servicos.yaml', f"{s.get('id')} está {s.get('estado')}, mas o revisor titular {titular} não está APTO em '{tipo}'")


@regra('MAT-15', 'Relatório final: um só serviço, da Helena, que não é card sozinho, sem ação do fundador, não pulável, e a revisora não é a Helena.')
def mat15(D, erro):
    finais = [s for s in catalogo(D) if s.get('tipo_de_entrega') == 'relatorio_final']
    if len(finais) != 1:
        erro('servicos.yaml', f'deve haver exatamente 1 serviço de relatório final (há {len(finais)})')
    for s in finais:
        sid = s.get('id')
        if s.get('dono') != 'HELENA':
            erro('servicos.yaml', f'{sid}: o dono do relatório final é a HELENA')
        if s.get('escolhivel') or s.get('avulso'):
            erro('servicos.yaml', f'{sid}: o relatório final só existe como última etapa de um roteiro (escolhivel e avulso false)')
        if not s.get('pode_entrar_em_roteiro') or s.get('pode_ser_pulada'):
            erro('servicos.yaml', f'{sid}: o relatório final entra em roteiro e nunca é pulado')
        if lista(s.get('acoes_do_fundador')):
            erro('servicos.yaml', f'{sid}: o relatório final não tem ação do fundador')
        if 'HELENA' in (s.get('revisor'), s.get('reserva')):
            erro('servicos.yaml', f'{sid}: a Helena nunca revisa o próprio relatório')


@regra('MAT-19', 'Escolhível implica avulso e tem de 3 a 5 exemplos sem repetir; pedidos de fronteira têm 1 destino que existe; ninguém manda para si mesmo.')
def mat19(D, erro):
    destinos = set(servico_por_id(D)) | {f.get('id') for f in so_dicts(D['servicos'].get('fora_do_catalogo'))}
    vistos = {}
    for s in catalogo(D):
        sid, exemplos = s.get('id'), lista(s.get('exemplos_de_pedido'))
        if s.get('escolhivel') and not s.get('avulso'):
            erro('servicos.yaml', f'{sid}: escolhivel exige avulso (o código precisa saber montar o plano sozinho)')
        if s.get('escolhivel') and not 3 <= len(exemplos) <= 5:
            erro('servicos.yaml', f'{sid}: serviço escolhível tem de 3 a 5 exemplos de pedido (tem {len(exemplos)})')
        if not s.get('escolhivel') and exemplos:
            erro('servicos.yaml', f'{sid}: serviço que não é escolhível não tem exemplos de pedido')
        for exemplo in exemplos:
            if vistos.setdefault(exemplo, sid) != sid:
                erro('servicos.yaml', f'{sid}: o exemplo {str(exemplo)[:50]!r} já é de {vistos[exemplo]}')
        for frase in lista(s.get('nao_atende')):
            if re.search(re.escape(str(sid)) + r'(?![A-Z0-9-])', str(frase)):
                erro('servicos.yaml', f'{sid}: nao_atende manda o pedido para o próprio serviço ({str(frase)[:50]!r})')
    for p in so_dicts(D['servicos'].get('pedidos_de_fronteira')):
        if p.get('certo') not in destinos:
            erro('servicos.yaml', f"pedido de fronteira {str(p.get('pedido'))[:40]!r}: o destino {p.get('certo')!r} não existe")


@regra('MAT-24', 'Toda área do mapa aponta para 1 serviço ou item de fora_do_catalogo; todo item de fora_do_catalogo tem destino, dono e prazo.')
def mat24(D, erro):
    destinos = set(servico_por_id(D)) | {f.get('id') for f in so_dicts(D['servicos'].get('fora_do_catalogo'))}
    for area in so_dicts(D['servicos'].get('mapa_de_areas')):
        if area.get('atende') not in destinos:
            erro('servicos.yaml', f"mapa_de_areas: a área {str(area.get('area'))[:40]!r} aponta para {area.get('atende')!r}, que não existe")
    for item in so_dicts(D['servicos'].get('fora_do_catalogo')):
        for campo in ('destino', 'dono', 'prazo'):
            if not item.get(campo):
                erro('servicos.yaml', f"fora_do_catalogo {item.get('id')}: falta {campo}")


@regra('MAT-25', 'Modelo menor é NUNCA no parecer e no relatório final.')
def mat25(D, erro):
    for s in catalogo(D):
        if (s.get('julgadora') or s.get('tipo_de_entrega') == 'relatorio_final') and s.get('modelo_menor') != 'NUNCA':
            erro('servicos.yaml', f"{s.get('id')}: modelo_menor deve ser NUNCA (está {s.get('modelo_menor')!r})")


# =========================================================================================
# FICHAS: agents/*.yaml cruzadas com o organograma, o catálogo e models.yaml
# =========================================================================================
def onde_da_ficha(D, ident):
    return f"agents/{D['arquivo_da_ficha'].get(ident)}"


@regra('FICHA-AUSENTE', 'Os 21 agentes do catálogo têm ficha v3.1 (arquivo no formato antigo da v1 não conta).')
def ficha_ausente(D, erro):
    todos = identidades(D)
    org = linhas_do_organograma(D)
    faltam = [i for i in todos if i not in D['fichas']]
    if faltam:
        nomes = ', '.join(dicio(org.get(i)).get('nome', i) for i in faltam)
        antigos = f"; arquivos no formato antigo (v1), que não contam: {', '.join(D['fichas_antigas'])}" if D['fichas_antigas'] else ''
        erro('agents', f'{len(faltam)} de {len(todos)} fichas ausentes: {nomes}{antigos}')


@regra('FICHA-ARQUIVO', 'O arquivo da ficha é agents/<identidade em minúsculas>.yaml e a identidade dentro dele é a mesma.')
def ficha_arquivo(D, erro):
    for ident, ficha in D['fichas'].items():
        if D['arquivo_da_ficha'].get(ident) != f'{ident.lower()}.yaml':
            erro(onde_da_ficha(D, ident), f'o arquivo deveria se chamar {ident.lower()}.yaml')
        if ficha.get('identidade') != ident:
            erro(onde_da_ficha(D, ident), f"identidade {ficha.get('identidade')!r} não bate com o arquivo ({ident})")


@regra('FICHA-ESPELHO-ORG', 'id, identidade, nome, função, grupo, escopo, fase e estado da ficha são os do organograma.')
def ficha_espelho_org(D, erro):
    org = linhas_do_organograma(D)
    campos = {'id': 'id', 'identidade': 'identidade', 'nome': 'nome', 'funcao': 'cargo', 'grupo': 'grupo',
              'escopo': 'escopo', 'fase_de_ativacao': 'fase_de_ativacao', 'estado': 'estado'}
    for ident, ficha in D['fichas'].items():
        linha = org.get(ident)
        if not linha:
            erro(onde_da_ficha(D, ident), f'{ident} não está no organograma')
            continue
        for da_ficha, do_organograma in campos.items():
            if ficha.get(da_ficha) != linha.get(do_organograma):
                erro(onde_da_ficha(D, ident), f"{da_ficha} da ficha ({ficha.get(da_ficha)!r}) é diferente do organograma ({linha.get(do_organograma)!r})")


@regra('FICHA-ESPELHO-SERVICOS', 'Os serviços da ficha são exatamente os do catálogo (tipo, ações, ferramentas, revisor, reserva); empresas = união.')
def ficha_espelho_servicos(D, erro):
    for ident, ficha in D['fichas'].items():
        onde = onde_da_ficha(D, ident)
        catalogados = {s.get('id'): s for s in servicos_do(D, ident)}
        da_ficha = {sv.get('servico'): sv for sv in so_dicts(ficha.get('servicos'))}
        for sid in catalogados:
            if sid not in da_ficha:
                erro(onde, f'falta o serviço {sid}, que o catálogo dá a {ident}')
        for sid in da_ficha:
            if sid not in catalogados:
                erro(onde, f'o serviço {sid} não é de {ident} no catálogo')
        for sid, sv in da_ficha.items():
            s = catalogados.get(sid)
            for campo in ('tipo_de_entrega', 'acoes_permitidas', 'ferramentas', 'revisor', 'reserva'):
                if s and normaliza(sv.get(campo)) != normaliza(s.get(campo)):
                    erro(onde, f"{sid}: {campo} da ficha ({sv.get(campo)}) é diferente do catálogo ({s.get(campo)})")
        uniao = sorted({e for s in catalogados.values() for e in lista(s.get('empresas'))})
        if sorted(lista(ficha.get('empresas'))) != uniao:
            erro(onde, f"empresas da ficha {lista(ficha.get('empresas'))} deveriam ser a união das dos serviços {uniao}")


@regra('FICHA-APTIDAO', "A aptidão de revisão da ficha é exatamente o 'revisa' do agente em servicos.yaml (mesmos tipos e estados).")
def ficha_aptidao(D, erro):
    for ident, ficha in D['fichas'].items():
        da_ficha = {a.get('tipo'): a.get('estado') for a in so_dicts(dicio(ficha.get('revisao')).get('aptidao'))}
        do_catalogo = dicio(dicio(indice_dos_agentes(D).get(ident)).get('revisa'))
        if da_ficha != do_catalogo:
            erro(onde_da_ficha(D, ident), f"revisao.aptidao {da_ficha} é diferente de 'revisa' em servicos.yaml {do_catalogo}")


@regra('FICHA-MODELO', 'A ficha usa apelidos de models.yaml só no papel certo; pesquisa-padrao só para quem lê a internet.')
def ficha_modelo(D, erro):
    apelidos, papeis = dicio(D['modelos'].get('apelidos')), dicio(D['modelos'].get('papel_do_apelido'))
    for ident, ficha in D['fichas'].items():
        onde, modelo = onde_da_ficha(D, ident), dicio(ficha.get('modelo'))
        pedidos = [('autor', 'AUTOR'), ('revisao', 'REVISAO')] + ([('coordenacao', 'COORDENACAO')] if ident == 'HELENA' else [])
        for campo, papel in pedidos:
            apelido = modelo.get(campo)
            if apelido not in apelidos:
                erro(onde, f"modelo.{campo} {apelido!r} não existe em models.yaml")
            elif papeis.get(apelido) != papel:
                erro(onde, f"modelo.{campo} '{apelido}' é do papel {papeis.get(apelido)}, mas aqui deveria ser {papel}")
        if ident != 'HELENA' and 'coordenacao' in modelo:
            erro(onde, 'só a Helena tem modelo.coordenacao')
        le_internet = any(s.get('usa_internet') for s in servicos_do(D, ident))
        if le_internet and modelo.get('autor') != 'pesquisa-padrao':
            erro(onde, 'serviço que lê página usa modelo.autor = pesquisa-padrao')
        if not le_internet and modelo.get('autor') == 'pesquisa-padrao':
            erro(onde, 'pesquisa-padrao é só para serviço que lê página')


@regra('FICHA-ORCAMENTO', 'Orçamento possível: chamadas_total >= buscas + partes_de_pagina + 1.')
def ficha_orcamento(D, erro):
    for ident, ficha in D['fichas'].items():
        for sv in so_dicts(ficha.get('servicos')):
            o = dicio(sv.get('orcamento'))
            minimo = o.get('buscas', 0) + o.get('partes_de_pagina', 0) + 1
            if o.get('chamadas_total', 0) < minimo:
                erro(onde_da_ficha(D, ident), f"{sv.get('servico')}: orçamento impossível: chamadas_total {o.get('chamadas_total')} < buscas {o.get('buscas')} + partes_de_pagina {o.get('partes_de_pagina')} + 1")


# =========================================================================================
# ENTREGAS: deliverables/<tipo>.yaml
# =========================================================================================
@regra('ENTREGA-CATALOGO', 'Cada tipo de entrega tem o nome do arquivo, o dono e o serviço do catálogo.')
def entrega_catalogo(D, erro):
    por_tipo = servico_por_tipo(D)
    for stem, e in D['entregas'].items():
        onde = f'deliverables/{stem}.yaml'
        if e.get('tipo') != stem:
            erro(onde, f"tipo {e.get('tipo')!r} é diferente do nome do arquivo")
        s = por_tipo.get(stem)
        if not s:
            erro(onde, f"o tipo '{stem}' não existe no catálogo (servicos.yaml)")
            continue
        if e.get('dono') != s.get('dono'):
            erro(onde, f"dono {e.get('dono')} é diferente do catálogo ({s.get('dono')})")
        if e.get('servico') != s.get('id'):
            erro(onde, f"servico {e.get('servico')} é diferente do catálogo ({s.get('id')})")


@regra('ENTREGA-DONO-UNICO', 'Cada tipo de entrega tem exatamente 1 dono, o mesmo no catálogo, nas fichas e no arquivo do tipo.')
def entrega_dono_unico(D, erro):
    donos = defaultdict(list)                                  # tipo -> [(fonte, dono)]
    for s in catalogo(D):
        donos[s.get('tipo_de_entrega')].append(('servicos.yaml', s.get('dono')))
    for ident, ficha in D['fichas'].items():
        for sv in so_dicts(ficha.get('servicos')):
            donos[sv.get('tipo_de_entrega')].append((onde_da_ficha(D, ident), ident))
    for stem, e in D['entregas'].items():
        donos[stem].append((f'deliverables/{stem}.yaml', e.get('dono')))
    for tipo, fontes in donos.items():
        if len({dono for _, dono in fontes}) != 1:
            erro(f'tipo {tipo}', 'mais de um dono: ' + '; '.join(f'{fonte} diz {dono}' for fonte, dono in fontes))


@regra('ENTREGA-ARQUIVO', 'Todo tipo de entrega usado por uma ficha existe em deliverables/.')
def entrega_arquivo(D, erro):
    for ident, ficha in D['fichas'].items():
        for sv in so_dicts(ficha.get('servicos')):
            if sv.get('tipo_de_entrega') not in D['entregas']:
                erro(onde_da_ficha(D, ident), f"{sv.get('servico')}: deliverables/{sv.get('tipo_de_entrega')}.yaml não existe")


@regra('ENTREGA-ID-UNICO', 'Ids de checagem e de rubrica são únicos em todo o repositório; ids de seção são únicos no tipo.')
def entrega_id_unico(D, erro):
    vistos = {}

    def ver(id_, onde):
        if id_ in vistos:
            erro(onde, f'id {id_} repetido (já usado em {vistos[id_]})')
        else:
            vistos[id_] = onde
    for c in so_dicts(D['servicos'].get('portao1_comum')):
        ver(c.get('id'), 'servicos.yaml')
    for stem, e in D['entregas'].items():
        onde = f'deliverables/{stem}.yaml'
        for c in so_dicts(e.get('checagens_codigo')) + so_dicts(e.get('rubrica')):
            ver(c.get('id'), onde)
        secoes = [s.get('id') for s in so_dicts(e.get('secoes'))]
        for repetida in sorted({s for s in secoes if secoes.count(s) > 1}):
            erro(onde, f"seção '{repetida}' repetida")


@regra('ENTREGA-PRONTO', 'O critério de pronto só cita ids do próprio tipo e inclui toda a rubrica.')
def entrega_pronto(D, erro):
    for stem, e in D['entregas'].items():
        onde, pronto = f'deliverables/{stem}.yaml', dicio(e.get('criterio_de_pronto'))
        checagens = {c.get('id') for c in so_dicts(e.get('checagens_codigo'))}
        rubrica = {c.get('id') for c in so_dicts(e.get('rubrica'))}
        for id_ in lista(pronto.get('codigo')):
            if id_ not in checagens:
                erro(onde, f'criterio_de_pronto.codigo cita {id_}, que não é checagem deste tipo')
        for id_ in lista(pronto.get('rubrica')):
            if id_ not in rubrica:
                erro(onde, f'criterio_de_pronto.rubrica cita {id_}, que não é critério da rubrica deste tipo')
        for id_ in sorted(rubrica - set(lista(pronto.get('rubrica')))):
            erro(onde, f'o critério {id_} da rubrica não está no critério de pronto')


@regra('ENTREGA-FUNDADOR', 'Fundador no pronto: QUANDO_HA_ACAO_EXTERNA se o serviço tem ação do fundador, SEMPRE_NO_JURIDICO no parecer, senão NUNCA.')
def entrega_fundador(D, erro):
    por_tipo = servico_por_tipo(D)
    for stem, e in D['entregas'].items():
        s = por_tipo.get(stem)
        if not s:
            continue
        esperado = 'QUANDO_HA_ACAO_EXTERNA' if lista(s.get('acoes_do_fundador')) else 'SEMPRE_NO_JURIDICO' if s.get('julgadora') else 'NUNCA'
        quando = dicio(dicio(e.get('criterio_de_pronto')).get('fundador')).get('quando')
        if quando != esperado:
            erro(f'deliverables/{stem}.yaml', f'criterio_de_pronto.fundador.quando é {quando!r}, mas para o serviço {s.get("id")} deve ser {esperado}')


@regra('ENTREGA-ESPECIAL', 'Relatório final tem revisor_nao_reavalia; parecer tem os 8 temas obrigatórios e as entradas de pacote e passos fixos.')
def entrega_especial(D, erro):
    final = D['entregas'].get('relatorio_final')
    if final is not None and not lista(final.get('revisor_nao_reavalia')):
        erro('deliverables/relatorio_final.yaml', 'revisor_nao_reavalia é obrigatório (o revisor não reavalia o mérito das entregas aprovadas)')
    parecer = D['entregas'].get('parecer')
    if parecer is not None:
        temas = {t.get('id') for t in so_dicts(parecer.get('temas_obrigatorios'))}
        for tema in TEMAS_DO_PARECER:
            if tema not in temas:
                erro('deliverables/parecer.yaml', f'falta o tema obrigatório {tema}')
        origens = {x.get('de_onde') for x in so_dicts(parecer.get('entrada_minima'))}
        for origem in ('PACOTE_DA_EMPRESA', 'PASSOS_FIXOS_DO_ROTEIRO'):
            if origem not in origens:
                erro('deliverables/parecer.yaml', f'entrada_minima precisa de uma entrada {origem}')


@regra('ENTREGA-INTERNET', 'Serviço que lê a internet só usa se_faltar = REGISTRAR_FALHA nas entradas mínimas do tipo.')
def entrega_internet(D, erro):
    por_tipo = servico_por_tipo(D)
    for stem, e in D['entregas'].items():
        if dicio(por_tipo.get(stem)).get('usa_internet'):
            for entrada in so_dicts(e.get('entrada_minima')):
                if entrada.get('se_faltar') != 'REGISTRAR_FALHA':
                    erro(f'deliverables/{stem}.yaml', f"entrada {entrada.get('id')}: se_faltar {entrada.get('se_faltar')!r}; serviço com internet só pode REGISTRAR_FALHA")


@regra('ENTREGA-LEI', 'Nenhum critério de rubrica depende de lei, a não ser no parecer.')
def entrega_lei(D, erro):
    for stem, e in D['entregas'].items():
        if stem == 'parecer':
            continue
        for c in so_dicts(e.get('rubrica')):
            if DEPENDE_DE_LEI.search(str(c.get('pergunta'))):
                erro(f'deliverables/{stem}.yaml', f"{c.get('id')}: a pergunta depende de lei; só o parecer julga lei")


@regra('C-11-GANHO', 'O tipo do convite (copy) não tem seção nem campo sobre ganho, renda ou dinheiro.')
def c11_ganho(D, erro):
    convite = D['entregas'].get(TIPO_DO_CONVITE)
    if convite is None:
        return
    for secao in so_dicts(convite.get('secoes')):
        nomes = [secao.get('id'), secao.get('titulo')] + [c.get('id') for c in so_dicts(secao.get('colunas'))]
        for nome in nomes:
            if nome and TERMOS_DE_GANHO.search(str(nome)):
                erro(f'deliverables/{TIPO_DO_CONVITE}.yaml', f"seção {secao.get('id')}: o nome {nome!r} é um termo de ganho; o convite nunca fala de ganho (C-11)")


@regra('C-11-CALCULO', 'O tipo do convite (copy) não tem entrada vinda do cálculo.')
def c11_calculo(D, erro):
    convite = D['entregas'].get(TIPO_DO_CONVITE)
    if convite is None:
        return
    for entrada in so_dicts(convite.get('entrada_minima')):
        texto = f"{entrada.get('id')} {entrada.get('o_que')}"
        if entrada.get('de_onde') == 'ENTREGA_APROVADA' and re.search(r'c[aá]lculo|SRV-CALCULO', texto, re.I):
            erro(f'deliverables/{TIPO_DO_CONVITE}.yaml', f"entrada {entrada.get('id')} vem do cálculo; o convite nem recebe os números (C-11)")


# =========================================================================================
# ROTEIROS: playbooks/*.yaml (formato v3.1)
# =========================================================================================
def sem_ciclo(etapas):
    grafo = {e.get('id'): lista(e.get('depende_de')) for e in etapas}
    visitando, feitas, ciclos = set(), set(), []

    def visita(n, caminho):
        if n in visitando:
            ciclos.append(' -> '.join(caminho[caminho.index(n):] + [n]))
            return
        if n in feitas or n not in grafo:
            return
        visitando.add(n)
        for d in grafo[n]:
            visita(d, caminho + [n])
        visitando.discard(n)
        feitas.add(n)
    for n in grafo:
        visita(n, [])
    return ciclos


def etapa_com(roteiro, servico_id):
    return [e for e in etapas_de(roteiro) if e.get('servico') == servico_id]


def cada_roteiro(D):
    for nome, r in roteiros_v31(D).items():
        yield f'playbooks/{nome}', r, {e.get('id'): e for e in etapas_de(r)}


@regra('ROTEIRO-SERVICO', 'Todo serviço do roteiro existe, está em ESTAGIO ou ATIVO, cabe em roteiro e atende as empresas dele (pacote CONFIRMADO).')
def roteiro_servico(D, erro):
    por_id = servico_por_id(D)
    for onde, r, _ in cada_roteiro(D):
        for e in etapas_de(r):
            s = por_id.get(e.get('servico'))
            if not s:
                erro(onde, f"{e.get('id')}: o serviço {e.get('servico')} não existe no catálogo")
                continue
            if s.get('estado') not in lista(D['servicos'].get('recebem_card')):
                erro(onde, f"{e.get('id')}: o serviço {s.get('id')} está {s.get('estado')} e ainda não recebe card na v2")
            if not s.get('pode_entrar_em_roteiro'):
                erro(onde, f"{e.get('id')}: o serviço {s.get('id')} não pode entrar em roteiro")
            for empresa in lista(r.get('empresas')):
                if empresa not in lista(s.get('empresas')):
                    erro(onde, f"{e.get('id')}: o serviço {s.get('id')} não atende {empresa}")
        for empresa in lista(r.get('empresas')):
            if not pacote_confirmado(D, empresa):
                erro(onde, f'a empresa {empresa} não tem pacote CONFIRMADO')


@regra('ROTEIRO-GRAFO', 'Dependências e entradas apontam para etapas que existem; entrada de etapa exige dependência; sem ciclo; ids únicos.')
def roteiro_grafo(D, erro):
    for onde, r, por_id in cada_roteiro(D):
        ids = [e.get('id') for e in etapas_de(r)]
        for repetido in sorted({i for i in ids if ids.count(i) > 1}):
            erro(onde, f'etapa {repetido} repetida')
        externas = set(dicio(r.get('entradas_externas')))
        for e in etapas_de(r):
            for d in lista(e.get('depende_de')):
                if d not in por_id:
                    erro(onde, f"{e.get('id')} depende de {d}, que não existe")
            for entrada in lista(e.get('entradas')):
                if entrada not in por_id and entrada not in externas:
                    erro(onde, f"{e.get('id')}: a entrada '{entrada}' não é etapa nem entrada externa")
                if entrada in por_id and entrada not in lista(e.get('depende_de')):
                    erro(onde, f"{e.get('id')} usa {entrada} como entrada sem depender dela")
        for ciclo in sem_ciclo(etapas_de(r)):
            erro(onde, f'ciclo de dependência {ciclo}')


@regra('ROTEIRO-RELATORIO', 'Exatamente 1 etapa de relatório final, a última, dependendo de todas as outras (MAT-15).')
def roteiro_relatorio(D, erro):
    for onde, r, _ in cada_roteiro(D):
        etapas = etapas_de(r)
        finais = etapa_com(r, 'SRV-RELATORIO-FINAL')
        if len(finais) != 1:
            erro(onde, f'precisa de exatamente 1 etapa SRV-RELATORIO-FINAL (tem {len(finais)})')
            continue
        final = finais[0]
        if etapas[-1] is not final:
            erro(onde, 'o relatório final deve ser a última etapa')
        outras = {e.get('id') for e in etapas if e is not final}
        if set(lista(final.get('depende_de'))) != outras:
            erro(onde, 'o relatório final deve depender de todas as outras etapas')


@regra('ROTEIRO-JULGA', 'Etapa do parecer julga só tipos julgáveis, depende do que julga, e o ajuste refaz o que ela julga.')
def roteiro_julga(D, erro):
    j = julgadora(D)
    julga_tipos = lista(dicio(j).get('julga_tipos'))
    por_id_servico = servico_por_id(D)
    for onde, r, por_id in cada_roteiro(D):
        for e in etapa_com(r, dicio(j).get('id')):
            julgadas = lista(e.get('julga'))
            if not julgadas:
                erro(onde, f"{e.get('id')}: o parecer precisa julgar pelo menos uma etapa")
            for alvo in julgadas:
                if alvo not in por_id:
                    erro(onde, f"{e.get('id')} julga {alvo}, que não existe")
                    continue
                tipo = dicio(por_id_servico.get(por_id[alvo].get('servico'))).get('tipo_de_entrega')
                if tipo not in julga_tipos:
                    erro(onde, f"{e.get('id')} julga {alvo}, do tipo '{tipo}', que o parecer não julga")
                if alvo not in lista(e.get('depende_de')):
                    erro(onde, f"{e.get('id')} julga {alvo} sem depender dela")
            refaz = lista(dicio(dicio(e.get('se_semaforo')).get('AJUSTE')).get('refazer'))
            if set(refaz) != set(julgadas):
                erro(onde, f"{e.get('id')}: o AJUSTE deve refazer exatamente o que o parecer julga {julgadas} (refaz {refaz})")


@regra('MAT-05-ROTEIRO', 'O parecer só recebe como entrada o que ele julga, etapas de dossiê e entradas externas.')
def mat05_roteiro(D, erro):
    j = julgadora(D)
    for onde, r, por_id in cada_roteiro(D):
        externas = set(dicio(r.get('entradas_externas')))
        for e in etapa_com(r, dicio(j).get('id')):
            for entrada in lista(e.get('entradas')):
                if entrada in externas:
                    continue
                if entrada in lista(e.get('julga')) or dicio(por_id.get(entrada)).get('servico') == 'SRV-DOSSIE':
                    continue
                erro(onde, f"{e.get('id')}: o parecer não pode receber '{entrada}' como entrada (só o que julga, dossiê ou entrada externa)")


@regra('ROTEIRO-SEMPRE-JULGADO', 'Toda etapa de serviço sempre julgado está no julga de uma etapa do parecer.')
def roteiro_sempre_julgado(D, erro):
    j = julgadora(D)
    por_id_servico = servico_por_id(D)
    for onde, r, _ in cada_roteiro(D):
        julgadas = {alvo for p in etapa_com(r, dicio(j).get('id')) for alvo in lista(p.get('julga'))}
        for e in etapas_de(r):
            if dicio(por_id_servico.get(e.get('servico'))).get('julgado_pelo_parecer') == 'SEMPRE' and e.get('id') not in julgadas:
                erro(onde, f"{e.get('id')} ({e.get('servico')}) é sempre julgado, mas nenhuma etapa do parecer a julga")


@regra('MAT-16', 'Nenhum convite (SRV-COPY) recebe a saída do cálculo como entrada.')
def mat16(D, erro):
    for onde, r, por_id in cada_roteiro(D):
        for e in etapa_com(r, 'SRV-COPY'):
            for entrada in lista(e.get('entradas')):
                if dicio(por_id.get(entrada)).get('servico') == 'SRV-CALCULO':
                    erro(onde, f"{e.get('id')}: o convite recebe o cálculo ({entrada}); ele nem pode ver os números (C-11)")


@regra('ROTEIRO-PULAVEL', "'pulavel' só onde o serviço permite e nunca numa etapa julgada.")
def roteiro_pulavel(D, erro):
    por_id_servico, j = servico_por_id(D), julgadora(D)
    for onde, r, _ in cada_roteiro(D):
        julgadas = {alvo for p in etapa_com(r, dicio(j).get('id')) for alvo in lista(p.get('julga'))}
        for e in etapas_de(r):
            if not e.get('pulavel'):
                continue
            if not dicio(por_id_servico.get(e.get('servico'))).get('pode_ser_pulada'):
                erro(onde, f"{e.get('id')}: o serviço {e.get('servico')} não pode ser pulado")
            if e.get('id') in julgadas:
                erro(onde, f"{e.get('id')}: etapa julgada nunca é pulável")


@regra('ROTEIRO-ACOES-FUNDADOR', 'Ação do fundador: etapa existe, no máximo uma por etapa, id na lista do serviço, nunca no relatório final.')
def roteiro_acoes_do_fundador(D, erro):
    por_id_servico = servico_por_id(D)
    for onde, r, por_id in cada_roteiro(D):
        usadas = defaultdict(int)
        for a in so_dicts(r.get('acoes_do_fundador')):
            etapa = por_id.get(a.get('etapa'))
            if not etapa:
                erro(onde, f"ação do fundador na etapa {a.get('etapa')}, que não existe")
                continue
            usadas[a.get('etapa')] += 1
            s = dicio(por_id_servico.get(etapa.get('servico')))
            if a.get('acao_do_fundador') not in [x.get('id') for x in so_dicts(s.get('acoes_do_fundador'))]:
                erro(onde, f"{a.get('etapa')}: a ação {a.get('acao_do_fundador')} não está na lista do serviço {s.get('id')}")
            if etapa.get('servico') == 'SRV-RELATORIO-FINAL':
                erro(onde, f"{a.get('etapa')}: o relatório final não tem ação do fundador")
        for etapa, n in usadas.items():
            if n > 1:
                erro(onde, f'{etapa}: {n} ações do fundador; o máximo é 1 por etapa')


@regra('ROTEIRO-PASSO-FIXO', 'Passo fixo do fundador: id único e coberto por uma etapa do parecer do mesmo roteiro.')
def roteiro_passo_fixo(D, erro):
    j = julgadora(D)
    for onde, r, por_id in cada_roteiro(D):
        passos = so_dicts(r.get('passos_fixos_do_fundador'))
        ids = [p.get('id') for p in passos]
        for repetido in sorted({i for i in ids if ids.count(i) > 1}):
            erro(onde, f'passo fixo {repetido} repetido')
        for p in passos:
            coberto = por_id.get(p.get('coberto_pelo_parecer'))
            if not coberto or coberto.get('servico') != dicio(j).get('id'):
                erro(onde, f"{p.get('id')}: coberto_pelo_parecer {p.get('coberto_pelo_parecer')!r} não é uma etapa do parecer deste roteiro")


@regra('MAT-21', 'Toda etapa tem pelo menos um revisor de IA com aptidão APTA no tipo.')
def mat21(D, erro):
    por_id_servico = servico_por_id(D)
    for onde, r, _ in cada_roteiro(D):
        for e in etapas_de(r):
            s = por_id_servico.get(e.get('servico'))
            if s and revisores_efetivos(D, s) == [FUNDADOR]:
                erro(onde, f"{e.get('id')} ({s.get('id')}): nenhum revisor de IA está APTO no tipo '{s.get('tipo_de_entrega')}'; só sobraria o fundador")


@regra('ROTEIRO-ORCAMENTO', 'A soma dos orçamentos das fichas (autor e revisor de cada etapa) cabe em orcamento_meta.')
def roteiro_orcamento(D, erro):
    por_id_servico = servico_por_id(D)
    for onde, r, _ in cada_roteiro(D):
        meta = dicio(r.get('orcamento_meta'))
        soma = {'chamadas_total': 0, 'buscas': 0, 'partes_de_pagina': 0}
        etapas = etapas_de(r)
        for e in etapas:
            s = por_id_servico.get(e.get('servico'))
            if not s:
                continue
            ficha = D['fichas'].get(s.get('dono'))
            if not ficha:
                erro(onde, f"{e.get('id')}: a ficha de {s.get('dono')} não existe; orçamento NÃO CONFIRMADO")
                continue
            sv = next((x for x in so_dicts(ficha.get('servicos')) if x.get('servico') == s.get('id')), None)
            if sv is None:
                erro(onde, f"{e.get('id')}: a ficha de {s.get('dono')} não tem o serviço {s.get('id')}")
                continue
            for campo in soma:
                soma[campo] += dicio(sv.get('orcamento')).get(campo, 0)
            revisao = []
            for quem in revisores_efetivos(D, s):
                if quem == FUNDADOR:
                    continue
                if quem not in D['fichas']:
                    erro(onde, f'{e.get("id")}: a ficha do revisor {quem} não existe; orçamento NÃO CONFIRMADO')
                else:
                    revisao.append(dicio(dicio(D['fichas'][quem].get('revisao')).get('orcamento')).get('chamadas_total', 0))
            soma['chamadas_total'] += max(revisao, default=0)
        for campo, total in soma.items():
            if total > meta.get(campo, 0):
                erro(onde, f'{campo}: as fichas somam {total}, mas orcamento_meta permite {meta.get(campo, 0)}')
        minimo = 2 * len(etapas) + 1                           # 1 autor + 1 revisor por etapa, mais a leitura de volta da Helena
        if meta.get('execucoes', 0) < minimo:
            erro(onde, f"execucoes: orcamento_meta permite {meta.get('execucoes', 0)}, mas {len(etapas)} etapas precisam de pelo menos {minimo}")


# =========================================================================================
# CASOS: casos/<serviço>/boas e defeitos
# =========================================================================================
def servicos_com_ficha(D):
    return [s for s in catalogo(D) if s.get('dono') in D['fichas']]


def ids_do_tipo(D, servico):
    """Ids de checagem e de rubrica que valem para o serviço (os do tipo e os comuns). None se o tipo não existe."""
    entrega = D['entregas'].get(dicio(servico).get('tipo_de_entrega'))
    if entrega is None:
        return None
    comuns = {c.get('id') for c in so_dicts(D['servicos'].get('portao1_comum'))}
    return comuns | {c.get('id') for c in so_dicts(entrega.get('checagens_codigo')) + so_dicts(entrega.get('rubrica'))}


@regra('CASOS-BOAS', f'Todo serviço com ficha tem pelo menos {CASOS_BOAS_MIN} casos bons.')
def casos_boas(D, erro):
    for s in servicos_com_ficha(D):
        n = len(dicio(D['casos'].get(s.get('id'))).get('boas', {}))
        if n < CASOS_BOAS_MIN:
            erro(f"casos/{s.get('id')}", f'{n} caso(s) bom(ns); o mínimo é {CASOS_BOAS_MIN}')


@regra('CASOS-DEFEITOS', f'Todo serviço com ficha tem pelo menos {CASOS_DEFEITOS_MIN} defeitos plantados.')
def casos_defeitos(D, erro):
    for s in servicos_com_ficha(D):
        n = len(dicio(D['casos'].get(s.get('id'))).get('defeitos', {}))
        if n < CASOS_DEFEITOS_MIN:
            erro(f"casos/{s.get('id')}", f'{n} defeito(s) plantado(s); o mínimo é {CASOS_DEFEITOS_MIN}')


@regra('CASOS-PASTA', 'Toda pasta de casos é de um serviço que existe no catálogo.')
def casos_pasta(D, erro):
    ids = servico_por_id(D)
    for servico in D['casos']:
        if servico not in ids:
            erro(f'casos/{servico}', 'pasta de casos de um serviço que não existe no catálogo')


@regra('CASOS-DEFEITO-ALVO', 'Todo defeito plantado diz em deve_falhar_em uma checagem ou critério de rubrica que existe.')
def casos_defeito_alvo(D, erro):
    por_id = servico_por_id(D)
    for servico, casos in D['casos'].items():
        validos = ids_do_tipo(D, por_id.get(servico))
        for nome, caso in casos['defeitos'].items():
            onde = f'casos/{servico}/defeitos/{nome}'
            alvos = dicio(caso).get('deve_falhar_em')
            alvos = [alvos] if isinstance(alvos, str) else lista(alvos)
            if not alvos:
                erro(onde, 'o defeito não diz em deve_falhar_em qual checagem ou critério deve pegá-lo')
            elif validos is None:
                erro(onde, f'não dá para conferir deve_falhar_em: o tipo do serviço {servico} não tem arquivo em deliverables/')
            else:
                for alvo in alvos:
                    if alvo not in validos:
                        erro(onde, f'deve_falhar_em aponta para {alvo}, que não existe no tipo nem entre as checagens comuns')


@regra('CASOS-BOA-ALVO', 'Todo caso bom que lista deve_passar_em só cita checagens, critérios ou itens do card (CARD-n) que existem.')
def casos_boa_alvo(D, erro):
    por_id = servico_por_id(D)
    for servico, casos in D['casos'].items():
        validos = ids_do_tipo(D, por_id.get(servico))
        for nome, caso in casos['boas'].items():
            alvos = lista(dicio(caso).get('deve_passar_em'))
            if alvos and validos is None:
                erro(f'casos/{servico}/boas/{nome}', f'não dá para conferir deve_passar_em: o tipo do serviço {servico} não tem arquivo em deliverables/')
                continue
            for alvo in alvos:
                if alvo not in (validos or set()) and not re.fullmatch(r'CARD-[0-9]+', str(alvo)):
                    erro(f'casos/{servico}/boas/{nome}', f'deve_passar_em cita {alvo}, que não existe')


# =========================================================================================
# JORNADAS: replay na máquina de passagens (sem rodar a prova inteira, que é lenta)
# =========================================================================================
_PROVAR = {}


def carregar_provar(raiz):
    caminho = Path(raiz) / 'maquina' / 'provar.py'
    if caminho not in _PROVAR:
        spec = importlib.util.spec_from_file_location('helena_provar', caminho)
        modulo = importlib.util.module_from_spec(spec)
        sys.modules['helena_provar'] = modulo
        spec.loader.exec_module(modulo)
        _PROVAR[caminho] = modulo
    return _PROVAR[caminho]


@regra('JORNADA-REPLAY', 'Toda jornada passa no replay da máquina: sem violação e com o resultado esperado.')
def jornada_replay(D, erro):
    if not D['jornadas']:
        return
    provar = carregar_provar(D['raiz'])
    for onde, jornada in D['jornadas'].items():
        if problemas_de_esquema(esquema('maquina/jornada.schema.json'), jornada):
            continue                                            # já recusada pela regra ESQUEMA-JORNADA
        try:
            r = provar.replay(jornada)
        except Exception as e:
            erro(onde, f'o replay não aceitou a jornada ({type(e).__name__}: {str(e)[:150]})')
            continue
        if not r['confere']:
            motivos = list(r['divergencias']) + [f"{v['regra']}: {v['mensagem']}" for v in r['violacoes'][:3]]
            erro(onde, 'o replay não confere: ' + ' | '.join(motivos))


# =========================================================================================
# SEGURANÇA: nenhuma chave nas especificações
# =========================================================================================
@regra('SEM-CHAVE', 'Nenhum arquivo de especificação contém chave, token ou senha (só nomes e locais, nunca valores).')
def sem_chave(D, erro):
    for caminho in sorted(Path(D['raiz']).rglob('*.yaml')):
        if '__pycache__' in caminho.parts:
            continue
        try:
            texto = caminho.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        for nome, padrao in PADROES_DE_CHAVE.items():
            if padrao.search(texto):
                erro(caminho.relative_to(D['raiz']).as_posix(), f'parece conter {nome}; tire o valor do arquivo (guarde só o nome e o local)')


# =========================================================================================
# Execução
# =========================================================================================
def resumo(D):
    n_casos = sum(len(c['boas']) + len(c['defeitos']) for c in D['casos'].values())
    return (f"Conferido: {len(D['fichas'])} de {len(identidades(D))} fichas v3.1, {len(D['entregas'])} tipos de entrega, "
            f"{len(catalogo(D))} serviços, {len(roteiros_v31(D))} roteiro(s) v3.1, {n_casos} casos, "
            f"{len(D['jornadas'])} jornadas no replay da máquina, {len(REGRAS)} regras.")


def main():
    D = carregar()
    erros = rodar(D)
    for e in erros:
        print('ERRO', e)
    print(resumo(D))
    print('OK: especificações coerentes' if not erros else f'{len(erros)} problema(s)')
    return 1 if erros else 0


if __name__ == '__main__':
    sys.exit(main())
