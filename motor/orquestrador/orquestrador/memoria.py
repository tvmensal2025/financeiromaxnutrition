"""Memória compactada dos agentes: monta o bloco 'memória' do pacote, sem banco e sem rede.

O que é: funções puras (só dados recebidos) que (1) escolhem resumos e trechos pelo ESCOPO, (2) recusam resumo
que não cita fonte existente, (3) montam um bloco com orçamento de tamanho que nunca corta um número ao meio e
(4) recuperam só os top-K trechos relevantes, cada um com a origem. Desenho completo e decisões do fundador:
docs/manual/memoria-dos-agentes.md. Tabelas e funções do banco: docs/propostas/0027_memoria_agentes.sql
(RASCUNHO, NÃO APLICADO).

Regras que este módulo faz valer (o agente só escreve conteúdo; o código confere e grava):
  - memória NÃO é fonte: ela orienta; número, data e aprovação só valem vindos de fontes_importadas,
    decisoes_vigentes ou entradas aprovadas do pedido (o validador confere citações só contra elas);
  - o escopo filtra no código E no banco: empresa A nunca entra num pacote da empresa B; PESSOAL nunca entra
    em empresa; a coordenação (triagem, que enxerga todas as empresas) só recebe o escopo FUNDADOR;
  - um resumo sem fonte, com fonte inexistente/de outro escopo, com número sem fonte ou profundo demais é recusado;
  - o bloco cabe no orçamento; se não couber, entram afirmações/trechos INTEIROS (nunca cortados) e o resto é
    registrado como omitido; o pacote final nunca passa do teto (o Linux recusa 1 argumento de 131072 bytes).

NÃO está ligado ao despacho por padrão: `Motor(fonte_memoria=None)` ignora tudo isto, e o modo de produção
recusa a opção até autorização explícita do fundador. Nada aqui lê ou grava no Supabase.

Como mudar: limites e prioridades são as constantes logo abaixo; regra nova de escopo muda em
`escopo_permite`, e deve mudar junto com `helena_v2._memoria_escopo_permite` no rascunho SQL. Os testes
(testes/test_memoria.py) são a especificação executável.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Mapping, Optional, Protocol, Sequence

from executor_helena.segredos import segredos_no_texto

ESCOPOS = ('CARD', 'AGENTE_EMPRESA', 'FUNDADOR', 'PESSOAL')
MODOS = ('EMPRESA', 'PESSOAL', 'COORDENACAO')
TIPOS_PRIMARIOS = ('ENTREGA', 'HISTORICO', 'DECISAO', 'FONTE_IMPORTADA', 'CHECKPOINT', 'TELEGRAM_PEDIDO')
TIPOS_DE_FONTE = TIPOS_PRIMARIOS + ('RESUMO',)
# Fontes que carregam texto de empresa: proibidas nos escopos que valem para todas as empresas.
TIPOS_DE_EMPRESA = ('ENTREGA', 'FONTE_IMPORTADA')
PROFUNDIDADE_MAXIMA = 2                 # resumo de resumo de resumo é recusado; refaz-se a partir das fontes
LIMITE_TEXTO_RESUMO = 8000              # caracteres do texto renderizado de um resumo
LIMITE_TEXTO_TRECHO = 1200              # um trecho recuperado é um recorte curto e literal da fonte
ORCAMENTO_CARACTERES_PADRAO = 12000     # ~4 mil tokens; medir (uso.json) antes de subir
FRACAO_PARA_RESUMOS = 0.7               # o resto do orçamento é dos trechos recuperados
MAXIMO_DE_RESUMOS = 6
TOP_K_PADRAO = 5
LIMITE_PACOTE_BYTES = 60000             # mesmo teto da triagem (triagem_pedido.py)
LIMITE_DURO_ARGUMENTO_BYTES = 131072    # MAX_ARG_STRLEN do Linux: `hermes -z <pacote>` falha acima disto
CARACTERES_POR_TOKEN = 3                # estimativa conservadora para português; o real vem de uso.json
MARCADOR_CORTE = ' [...]'
AVISO = ('Memória compactada de apoio, não é fonte. Números, datas e aprovações só valem se estiverem em '
         'fontes_importadas, decisoes_vigentes ou nas entradas deste pedido. Cada item traz o id de origem.')


class ErroMemoria(ValueError):
    """Resumo, trecho ou escopo inválido. Quem chama decide se segue sem memória; nunca segue com dado duvidoso."""


# --------------------------------------------------------------------------------------------------- dados
@dataclass(frozen=True)
class FonteRef:
    tipo: str
    ref: str

    @property
    def chave(self) -> str:
        return f'{self.tipo}:{self.ref}'


@dataclass(frozen=True)
class Afirmacao:
    texto: str
    fontes: tuple[FonteRef, ...] = ()


@dataclass(frozen=True)
class Resumo:
    id: str
    versao: int
    escopo: str
    business_id: Optional[str] = None
    agente: Optional[str] = None
    servico: Optional[str] = None
    card_id: Optional[str] = None
    estado: str = 'ATIVO'
    origem: str = 'AGENTE'                       # AGENTE (narrativa revisada) ou CODIGO (ficha extrativa)
    afirmacoes: tuple[Afirmacao, ...] = ()
    fatos_duros: tuple[str, ...] = ()            # números, datas, aprovações COPIADOS pelo código; nunca resumidos
    fontes: tuple[FonteRef, ...] = ()
    profundidade: int = 0
    texto: str = ''                              # usado só quando não há afirmações (resumo legado/livre)
    expira_em: Optional[datetime] = None
    aprovado_por: Optional[str] = None
    autor: Optional[str] = None
    revisor: Optional[str] = None

    @property
    def chave_escopo(self) -> str:
        return '|'.join((self.escopo, self.business_id or '', self.agente or '', self.servico or '',
                         self.card_id or ''))

    def linhas(self) -> list[str]:
        if self.afirmacoes:
            return [*self.fatos_duros, *(a.texto for a in self.afirmacoes)]
        return [*self.fatos_duros, *([self.texto] if self.texto else [])]

    def renderizar(self) -> str:
        """O texto canônico: é ele que o banco guarda e cujo SHA-256 vira texto_hash."""
        return '\n'.join(self.linhas())

    @property
    def hash_texto(self) -> str:
        return hashlib.sha256(self.renderizar().encode('utf-8')).hexdigest()


@dataclass(frozen=True)
class Trecho:
    """Recorte literal e curto de uma fonte existente, indexado para busca. Sempre com origem."""
    id: str
    origem: Optional[FonteRef]
    texto: str
    escopo: str
    business_id: Optional[str] = None
    agente: Optional[str] = None
    servico: Optional[str] = None
    card_id: Optional[str] = None
    estado: str = 'ATIVO'
    pontuacao: float = 0.0
    expira_em: Optional[datetime] = None
    aprovado_por: Optional[str] = None

    @property
    def hash_texto(self) -> str:
        return hashlib.sha256(self.texto.encode('utf-8')).hexdigest()


@dataclass(frozen=True)
class Referencia:
    """O que o banco diz sobre uma fonte citada (entrada de `conferir_resumo`)."""
    texto: str
    business_id: Optional[str] = None
    card_id: Optional[str] = None
    profundidade: int = 0                        # só para RESUMO
    escopo: Optional[str] = None                 # só para RESUMO


@dataclass(frozen=True)
class ContextoDeEscopo:
    """Para quem a memória está sendo montada. `modo` decide o que pode entrar (ver `escopo_permite`)."""
    modo: str
    agente: Optional[str] = None
    business_id: Optional[str] = None
    servico: Optional[str] = None
    card_id: Optional[str] = None

    def __post_init__(self):
        if self.modo not in MODOS:
            raise ErroMemoria(f'modo desconhecido: {self.modo!r}')
        if self.modo == 'EMPRESA' and not self.business_id:
            raise ErroMemoria('modo EMPRESA exige business_id')
        if self.modo == 'PESSOAL' and (self.business_id or not self.agente):
            raise ErroMemoria('modo PESSOAL exige agente e proíbe business_id')
        if self.modo == 'COORDENACAO' and (self.business_id or self.card_id):
            raise ErroMemoria('modo COORDENACAO não tem empresa nem card')


def _ref(d: Mapping) -> FonteRef:
    return FonteRef(str(d['tipo']), str(d['ref']))


def resumo_de_dict(d: Mapping) -> Resumo:
    """Converte a linha que o banco devolve (`ler_memoria_execucao`) em Resumo."""
    expira = d.get('expira_em')
    if isinstance(expira, str):
        expira = datetime.fromisoformat(expira)
    return Resumo(
        id=str(d['id']), versao=int(d['versao']), escopo=d['escopo'], business_id=d.get('business_id'),
        agente=d.get('agente'), servico=d.get('servico'),
        card_id=str(d['card_id']) if d.get('card_id') else None, estado=d.get('estado', 'ATIVO'),
        origem=d.get('origem', 'AGENTE'),
        afirmacoes=tuple(Afirmacao(a['texto'], tuple(_ref(f) for f in a.get('fontes') or ()))
                         for a in d.get('afirmacoes') or ()),
        fatos_duros=tuple(d.get('fatos_duros') or ()), fontes=tuple(_ref(f) for f in d.get('fontes') or ()),
        profundidade=int(d.get('profundidade') or 0), texto=d.get('texto') or '', expira_em=expira,
        aprovado_por=str(d['aprovado_por']) if d.get('aprovado_por') else None,
        autor=d.get('autor'), revisor=d.get('revisor'))


def trecho_de_dict(d: Mapping) -> Trecho:
    """Converte um item de helena_v2.buscar_memoria em Trecho (origem = tipo:ref da fonte primária)."""
    expira = d.get('expira_em')
    if isinstance(expira, str):
        expira = datetime.fromisoformat(expira)
    origem = FonteRef(str(d['origem_tipo']), str(d['origem_ref'])) if d.get('origem_tipo') else None
    return Trecho(id=str(d['id']), origem=origem, texto=d.get('texto') or '', escopo=d['escopo'],
                  business_id=d.get('business_id'), agente=d.get('agente'), servico=d.get('servico'),
                  card_id=str(d['card_id']) if d.get('card_id') else None, estado=d.get('estado', 'ATIVO'),
                  pontuacao=float(d.get('pontuacao') or 0), expira_em=expira,
                  aprovado_por=str(d['aprovado_por']) if d.get('aprovado_por') else None)


# ------------------------------------------------------------------------------------------ números
_DATA = re.compile(r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b')
_NUMERO = re.compile(r'(?<![A-Za-z_\d])(?<![A-Za-z]-)\d+(?:[.,]\d+)*(?![A-Za-z_])')
_NUMERO_PT_MILHAR = re.compile(r'^\d{1,3}(\.\d{3})+(,\d+)?$')


def _candidatos_do_numero(token: str) -> frozenset[str]:
    """Formas normalizadas plausíveis de um número (convenção do português: vírgula decimal, ponto de milhar)."""
    formas = set()
    if _NUMERO_PT_MILHAR.match(token):
        formas.add(token.replace('.', '').replace(',', '.'))
        if ',' not in token and token.count('.') == 1:
            formas.add(token)                          # '1.234' também pode ser decimal
    elif ',' in token and '.' not in token:
        formas.add(token.replace(',', '.'))
        if re.match(r'^\d{1,3}(,\d{3})+$', token):
            formas.add(token.replace(',', ''))         # '1,234' também pode ser milhar em inglês
    else:
        formas.add(token.replace(',', ''))
    return frozenset(f.rstrip('0').rstrip('.') if '.' in f else f for f in formas)


def numeros_do_texto(texto: str) -> list[frozenset[str]]:
    """Cada número e data do texto, na forma normalizada. Identificadores como DEC-022 ou BIZ-003 não contam."""
    achados: list[frozenset[str]] = []
    for m in _DATA.finditer(texto):
        if m.group(1):
            achados.append(frozenset({f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'}))
        else:
            achados.append(frozenset({f'{m.group(4)}-{m.group(5)}-{m.group(6)}'}))
    sem_datas = _DATA.sub(' ', texto)
    for m in _NUMERO.finditer(sem_datas):
        achados.append(_candidatos_do_numero(m.group(0)))
    return achados


def _sustentados(texto: str, fontes: Iterable[str]) -> list[str]:
    """Números de `texto` que NÃO aparecem em nenhuma das `fontes`."""
    base = [n for f in fontes for n in numeros_do_texto(f)]
    return sorted({sorted(n)[0] for n in numeros_do_texto(texto) if not any(n & b for b in base)})


# ------------------------------------------------------------------------------------ truncar sem cortar
def truncar_sem_cortar_numeros(texto: str, limite: int, marcador: str = MARCADOR_CORTE) -> str:
    """Corta em fronteira de frase ou palavra e nunca no meio de número, data, moeda ou porcentagem.

    O resultado tem no máximo `limite` caracteres, marcador incluído. Se nem o marcador couber, devolve ''.
    """
    if limite < 0:
        raise ErroMemoria('limite negativo')
    if len(texto) <= limite:
        return texto
    if limite <= len(marcador):
        return ''
    corte = limite - len(marcador)
    # um número, data ou valor (R$ 1.234,56 / 12,5% / 17/10/2026) que atravessa o corte sai inteiro
    for m in re.finditer(r'(?:R\$|US\$)?\s?\d[\d.,/:-]*\d%?|\d%?', texto):
        if m.start() < corte < m.end():
            corte = m.start()
            break
    janela = texto[:corte]
    frase = max(janela.rfind('. '), janela.rfind('.\n'), janela.rfind('\n'))
    if frase >= corte * 0.5:
        janela = janela[:frase + 1]
    else:
        palavra = janela.rfind(' ')
        janela = janela[:palavra] if palavra > 0 else janela
    janela = janela.rstrip(' ,;:-(')
    return (janela + marcador) if janela else ''


# --------------------------------------------------------------------------------------------- escopo
def escopo_permite(ctx: ContextoDeEscopo, item) -> bool:
    """Regra única de escopo para resumos e trechos (espelha helena_v2._memoria_escopo_permite no SQL)."""
    if item.estado != 'ATIVO':
        return False
    if item.escopo == 'FUNDADOR':
        return item.business_id is None and item.agente is None and item.card_id is None
    if ctx.modo == 'COORDENACAO':
        return False                                    # triagem vê todas as empresas: só o que é do fundador
    if item.escopo == 'PESSOAL':
        return (ctx.modo == 'PESSOAL' and item.business_id is None and item.agente == ctx.agente)
    if ctx.modo == 'PESSOAL':
        # cartão pessoal: só o resumo do próprio card, que não tem empresa
        return item.escopo == 'CARD' and item.business_id is None and item.card_id == ctx.card_id \
            and ctx.card_id is not None
    if item.business_id != ctx.business_id:
        return False
    if item.escopo == 'CARD':
        return item.card_id is not None and item.card_id == ctx.card_id
    if item.escopo == 'AGENTE_EMPRESA':
        return (item.agente == ctx.agente and item.card_id is None
                and item.servico in (None, ctx.servico))
    return False


def _vigente(item, agora: datetime) -> bool:
    return item.expira_em is None or item.expira_em > agora


def _precisa_aprovacao(item) -> bool:
    return item.escopo in ('FUNDADOR', 'PESSOAL')


@dataclass(frozen=True)
class Descartado:
    id: str
    motivo: str


def selecionar_resumos(candidatos: Iterable[Resumo], ctx: ContextoDeEscopo, agora: datetime,
                       maximo: int = MAXIMO_DE_RESUMOS) -> tuple[list[Resumo], list[Descartado]]:
    """Resumos ATIVOS, vigentes e do escopo certo. Devolve também o que foi descartado de propósito."""
    escolhidos: dict[str, Resumo] = {}
    descartados: list[Descartado] = []
    for r in candidatos:
        if r.escopo not in ESCOPOS:
            descartados.append(Descartado(r.id, 'ESCOPO_DESCONHECIDO'))
        elif not escopo_permite(ctx, r):
            if r.estado == 'ATIVO':
                descartados.append(Descartado(r.id, 'FORA_DO_ESCOPO'))
        elif not _vigente(r, agora):
            descartados.append(Descartado(r.id, 'EXPIRADO'))
        elif _precisa_aprovacao(r) and not r.aprovado_por:
            descartados.append(Descartado(r.id, 'SEM_APROVACAO_DO_FUNDADOR'))
        elif not r.fontes:
            descartados.append(Descartado(r.id, 'SEM_FONTES'))
        else:
            atual = escolhidos.get(r.chave_escopo)
            if atual is None or r.versao > atual.versao or (r.versao == atual.versao and r.id < atual.id):
                escolhidos[r.chave_escopo] = r
    prioridade = {'CARD': 0, 'AGENTE_EMPRESA': 1, 'PESSOAL': 1, 'FUNDADOR': 2}
    ordenados = sorted(escolhidos.values(), key=lambda r: (prioridade[r.escopo], -r.versao, r.id))
    return ordenados[:maximo], descartados


# ------------------------------------------------------------------------------------ conferir resumo
def conferir_resumo(resumo: Resumo, referencias: Mapping[str, Referencia], *,
                    empresas: Optional[Mapping[str, Sequence[str]]] = None) -> list[str]:
    """Problemas do resumo (lista vazia = pode seguir para a revisão). `referencias` vem do banco.

    `referencias` mapeia 'TIPO:ref' -> Referencia para cada fonte que EXISTE. `empresas` mapeia business_id ->
    nomes e apelidos, para achar menção a outra empresa.
    """
    p: list[str] = []
    e = resumo.escopo
    if e not in ESCOPOS:
        return ['ESCOPO_DESCONHECIDO']
    if e == 'CARD' and not resumo.card_id:
        p.append('FORMA_CARD_SEM_CARD')
    if e == 'AGENTE_EMPRESA' and (not resumo.business_id or not resumo.agente or resumo.card_id):
        p.append('FORMA_AGENTE_EMPRESA_INVALIDA')
    if e == 'FUNDADOR' and (resumo.business_id or resumo.agente or resumo.card_id):
        p.append('FORMA_FUNDADOR_INVALIDA')
    if e == 'PESSOAL' and (resumo.business_id or not resumo.agente or resumo.card_id):
        p.append('FORMA_PESSOAL_INVALIDA')
    if not resumo.fontes:
        p.append('SEM_FONTES')
    if not resumo.renderizar().strip():
        p.append('RESUMO_VAZIO')
    if len(resumo.renderizar()) > LIMITE_TEXTO_RESUMO:
        p.append('TEXTO_GRANDE_DEMAIS')
    if resumo.origem == 'AGENTE' and not resumo.autor:
        p.append('SEM_AUTOR')
    declaradas = {f.chave for f in resumo.fontes}
    for f in resumo.fontes:
        if f.tipo not in TIPOS_DE_FONTE:
            p.append(f'TIPO_DE_FONTE_DESCONHECIDO:{f.tipo}')
    for a in resumo.afirmacoes:
        if not a.fontes:
            p.append('AFIRMACAO_SEM_FONTE')
        for f in a.fontes:
            if f.chave not in declaradas:
                p.append(f'AFIRMACAO_CITA_FONTE_NAO_DECLARADA:{f.chave}')
    existentes = []
    for f in resumo.fontes:
        ref = referencias.get(f.chave)
        if ref is None:
            p.append(f'FONTE_INEXISTENTE:{f.chave}')
            continue
        existentes.append((f, ref))
        if e in ('FUNDADOR', 'PESSOAL'):
            if f.tipo in TIPOS_DE_EMPRESA or ref.business_id is not None:
                p.append(f'FONTE_DE_EMPRESA_EM_ESCOPO_GERAL:{f.chave}')
            if f.tipo == 'CHECKPOINT' and e == 'PESSOAL':
                p.append(f'CHECKPOINT_EM_ESCOPO_PESSOAL:{f.chave}')
            if f.tipo == 'RESUMO' and ref.escopo != e:
                p.append(f'RESUMO_CITADO_DE_OUTRO_ESCOPO:{f.chave}')
        else:
            if f.tipo == 'TELEGRAM_PEDIDO':
                p.append(f'TELEGRAM_FORA_DO_ESCOPO_GERAL:{f.chave}')
            if f.tipo == 'CHECKPOINT':
                p.append(f'CHECKPOINT_EM_ESCOPO_DE_EMPRESA:{f.chave}')
            if ref.business_id not in (None, resumo.business_id):
                p.append(f'FONTE_DE_OUTRA_EMPRESA:{f.chave}')
            if e == 'CARD' and ref.card_id not in (None, resumo.card_id):
                p.append(f'FONTE_DE_OUTRO_CARD:{f.chave}')
            if f.tipo == 'RESUMO' and ref.escopo not in (('CARD',) if e == 'CARD' else ('CARD', 'AGENTE_EMPRESA')):
                p.append(f'RESUMO_CITADO_DE_OUTRO_ESCOPO:{f.chave}')
    # profundidade e re-ancoragem em fonte primária
    citados = [r for f, r in existentes if f.tipo == 'RESUMO']
    esperada = 0 if not citados else 1 + max(r.profundidade for r in citados)
    if resumo.profundidade != esperada:
        p.append(f'PROFUNDIDADE_DECLARADA_ERRADA:{resumo.profundidade}!={esperada}')
    if max(resumo.profundidade, esperada) > PROFUNDIDADE_MAXIMA:
        p.append('PROFUNDIDADE_EXCEDIDA')
    if esperada >= 1 and not any(f.tipo in TIPOS_PRIMARIOS for f, _ in existentes):
        p.append('SEM_ANCORA_PRIMARIA')
    # cada número do resumo precisa estar numa fonte que ele cita
    ids_citados = lambda a: {f.ref for f in a.fontes}                       # noqa: E731
    for a in resumo.afirmacoes:
        textos = [r.texto for f, r in existentes if f in a.fontes]
        faltam = [n for n in _sustentados(a.texto, textos)
                  if not any(n in c for i in ids_citados(a) for c in _candidatos_do_numero(i))]
        if faltam:
            p.append('NUMERO_SEM_FONTE:' + ','.join(faltam))
    todos = [r.texto for _, r in existentes]
    for fato in resumo.fatos_duros:
        faltam = _sustentados(fato, todos)
        if faltam:
            p.append('FATO_DURO_SEM_FONTE:' + ','.join(faltam))
    if resumo.afirmacoes == () and resumo.texto and _sustentados(resumo.texto, todos):
        p.append('NUMERO_SEM_FONTE:' + ','.join(_sustentados(resumo.texto, todos)))
    if segredos_no_texto(resumo.renderizar()):
        p.append('TEXTO_COM_SEGREDO')
    if empresas is not None:
        p.extend(_mencoes_a_empresas(resumo.renderizar(), resumo.business_id, empresas))
    return list(dict.fromkeys(p))


def _sem_acento(t: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn').lower()


def _mencoes_a_empresas(texto: str, propria: Optional[str], empresas: Mapping[str, Sequence[str]]) -> list[str]:
    base = _sem_acento(texto)
    achadas = []
    for business_id, nomes in empresas.items():
        if business_id == propria:
            continue
        for nome in (business_id, *nomes):
            if nome and re.search(r'(?<!\w)' + re.escape(_sem_acento(nome)) + r'(?!\w)', base):
                achadas.append(f'MENCIONA_OUTRA_EMPRESA:{business_id}')
                break
    return achadas


def exigir_resumo_conferido(resumo: Resumo, referencias: Mapping[str, Referencia], **kw) -> None:
    problemas = conferir_resumo(resumo, referencias, **kw)
    if problemas:
        raise ErroMemoria('; '.join(problemas))


def exigir_revisao_independente(autor: Optional[str], revisor: Optional[str]) -> None:
    """Regra 4 aplicada à memória: quem compacta não aprova o próprio resumo."""
    if not autor or not revisor or autor.strip().upper() == revisor.strip().upper():
        raise ErroMemoria('REVISOR_PRECISA_SER_OUTRO_AGENTE')


def conferir_trecho(trecho: Trecho, texto_da_fonte: str) -> list[str]:
    """Um trecho é recorte literal: precisa ter origem, caber no limite e existir (sem diferença de espaços) na fonte."""
    p = []
    if trecho.origem is None or trecho.origem.tipo not in TIPOS_PRIMARIOS:
        p.append('TRECHO_SEM_ORIGEM_PRIMARIA')
    if not trecho.texto.strip():
        p.append('TRECHO_VAZIO')
    if len(trecho.texto) > LIMITE_TEXTO_TRECHO:
        p.append('TRECHO_GRANDE_DEMAIS')
    if ' '.join(trecho.texto.split()) not in ' '.join(texto_da_fonte.split()):
        p.append('TRECHO_NAO_ESTA_NA_FONTE')
    if segredos_no_texto(trecho.texto):
        p.append('TEXTO_COM_SEGREDO')
    return p


# ----------------------------------------------------------------------------------------- recuperação
_PARADAS = frozenset(
    'para como mais mesmo esta este isso essa esse pelo pela com sem sobre entre ate uma uns umas dos das '
    'nos nas por que quero preciso fazer favor pedido card etapa'.split())


def montar_consulta(*textos: str, max_termos: int = 12) -> str:
    """Consulta de busca montada PELO CÓDIGO a partir do objetivo da etapa e do pedido (nunca pelo agente)."""
    termos: dict[str, None] = {}
    for t in textos:
        for w in re.findall(r'[^\W\d_]{4,}', _sem_acento(t or '')):
            if w not in _PARADAS:
                termos.setdefault(w)
    return ' '.join(list(termos)[:max_termos])


class Recuperador(Protocol):
    """Contrato da busca. Em produção será a RPC helena_v2.buscar_memoria (tsvector em português)."""
    def __call__(self, ctx: ContextoDeEscopo, consulta: str, limite: int) -> Sequence[Trecho]: ...


class RecuperadorEmMemoria:
    """Fake para testes e simulações: pontua por termos em comum (sem acento). NÃO é o ranking do Postgres."""

    def __init__(self, trechos: Iterable[Trecho]):
        self.trechos = list(trechos)
        self.chamadas: list[tuple[ContextoDeEscopo, str, int]] = []

    def __call__(self, ctx, consulta, limite):
        self.chamadas.append((ctx, consulta, limite))
        termos = set(consulta.split())
        saida = []
        for t in self.trechos:
            if not escopo_permite(ctx, t):          # o banco real também filtra antes de ranquear
                continue
            palavras = set(re.findall(r'[^\W\d_]{4,}', _sem_acento(t.texto)))
            comuns = len(termos & palavras)
            if comuns:
                saida.append(Trecho(**{**t.__dict__, 'pontuacao': comuns / max(len(termos), 1)}))
        saida.sort(key=lambda t: (-t.pontuacao, t.id))
        return saida[:limite]


def selecionar_trechos(candidatos: Iterable[Trecho], ctx: ContextoDeEscopo, agora: datetime, *,
                       k: int = TOP_K_PADRAO) -> tuple[list[Trecho], list[Descartado]]:
    """Segunda linha de defesa: refiltra por escopo o que a busca devolveu e fica com o top-K, com origem."""
    escolhidos: dict[str, Trecho] = {}
    descartados: list[Descartado] = []
    for t in candidatos:
        if not escopo_permite(ctx, t):
            descartados.append(Descartado(t.id, 'FORA_DO_ESCOPO'))
        elif t.origem is None or t.origem.tipo not in TIPOS_PRIMARIOS:
            descartados.append(Descartado(t.id, 'SEM_ORIGEM'))
        elif not _vigente(t, agora):
            descartados.append(Descartado(t.id, 'EXPIRADO'))
        elif _precisa_aprovacao(t) and not t.aprovado_por:
            descartados.append(Descartado(t.id, 'SEM_APROVACAO_DO_FUNDADOR'))
        elif not t.texto.strip() or len(t.texto) > LIMITE_TEXTO_TRECHO:
            descartados.append(Descartado(t.id, 'TAMANHO_INVALIDO'))
        else:
            escolhidos.setdefault(t.id, t)
    ordenados = sorted(escolhidos.values(), key=lambda t: (-t.pontuacao, t.id))
    return ordenados[:max(k, 0)], descartados


def recuperar_trechos(recuperador: Recuperador, ctx: ContextoDeEscopo, consulta: str, agora: datetime, *,
                      k: int = TOP_K_PADRAO) -> tuple[list[Trecho], list[Descartado]]:
    """Busca com limite (pede k+extra), refiltra por escopo e devolve só o top-K. Consulta vazia = nada."""
    if k <= 0 or not consulta.strip():
        return [], []
    return selecionar_trechos(recuperador(ctx, consulta, min(k * 3, 30)), ctx, agora, k=k)


# ------------------------------------------------------------------------------------------- o bloco
@dataclass(frozen=True)
class BlocoMemoria:
    resumos: tuple[dict, ...] = ()
    trechos: tuple[dict, ...] = ()
    omitidos: tuple[Descartado, ...] = ()
    descartados: tuple[Descartado, ...] = ()
    orcamento_caracteres: int = 0

    @property
    def vazio(self) -> bool:
        return not self.resumos and not self.trechos

    def como_carga(self) -> dict:
        """O que entra no pacote. Bloco vazio não entra: cabeçalho sem conteúdo só gasta token."""
        if self.vazio:
            return {}
        return {'memoria': {'aviso': AVISO, 'resumos': list(self.resumos), 'trechos': list(self.trechos)}}

    @property
    def caracteres(self) -> int:
        return len(json.dumps(self.como_carga(), ensure_ascii=False)) if not self.vazio else 0

    @property
    def bytes_utf8(self) -> int:
        return len(json.dumps(self.como_carga(), ensure_ascii=False).encode('utf-8')) if not self.vazio else 0

    @property
    def tokens_estimados(self) -> int:
        return estimar_tokens(self.caracteres)

    def manifesto(self) -> dict:
        """O que registrar no banco (memoria_uso): ids, versões e hashes, não o texto."""
        return {
            'resumos': [{**{k: r[k] for k in ('id', 'versao', 'hash', 'completo', 'afirmacoes_incluidas')},
                         'caracteres': len(r['texto'])} for r in self.resumos],
            'trechos': [{'id': t['id'], 'origem': t['origem'], 'hash': t['hash'], 'caracteres': len(t['texto'])}
                        for t in self.trechos],
            'caracteres': self.caracteres, 'tokens_estimados': self.tokens_estimados,
            'omitidos': [d.__dict__ for d in self.omitidos]}


    def itens_de_uso(self) -> list[dict]:
        """A lista que helena_v2.registrar_uso_memoria(numero, itens) recebe (ids, hashes, tamanhos; sem texto)."""
        return [*({'tipo': 'RESUMO', 'id': r['id'], 'versao': r['versao'], 'hash': r['hash'],
                   'caracteres': len(r['texto'])} for r in self.resumos),
                *({'tipo': 'TRECHO', 'id': t['id'], 'versao': None, 'hash': t['hash'],
                   'caracteres': len(t['texto'])} for t in self.trechos)]


def estimar_tokens(caracteres: int) -> int:
    return math.ceil(caracteres / CARACTERES_POR_TOKEN)


def _tamanho(estrutura: dict) -> int:
    return len(json.dumps(estrutura, ensure_ascii=False))


def _item_resumo(r: Resumo, incluir: int) -> dict:
    """Fatos duros sempre inteiros; afirmações: as `incluir` primeiras, inteiras."""
    linhas = ([*r.fatos_duros, *(a.texto for a in r.afirmacoes[:incluir])] if r.afirmacoes else r.linhas())
    return {'id': r.id, 'versao': r.versao, 'escopo': r.escopo, 'hash': r.hash_texto,
            'completo': incluir >= len(r.afirmacoes), 'afirmacoes_incluidas': incluir,
            'profundidade': r.profundidade, 'texto': '\n'.join(linhas)}


def montar_bloco_memoria(resumos: Iterable[Resumo], ctx: ContextoDeEscopo, agora: datetime, *,
                         trechos: Iterable[Trecho] = (), orcamento_caracteres: int = ORCAMENTO_CARACTERES_PADRAO,
                         k: int = TOP_K_PADRAO, maximo_de_resumos: int = MAXIMO_DE_RESUMOS) -> BlocoMemoria:
    """Resumos escolhidos por escopo + top-K trechos, dentro do orçamento (em caracteres do JSON final).

    Prioridade: fatos duros do resumo (tudo ou nada) > afirmações inteiras na ordem dada > trechos por pontuação.
    Nada é cortado ao meio. Texto livre sem afirmações usa `truncar_sem_cortar_numeros`.
    """
    if orcamento_caracteres < 0:
        raise ErroMemoria('orçamento negativo')
    escolhidos, descartados = selecionar_resumos(resumos, ctx, agora, maximo_de_resumos)
    top, desc_trechos = selecionar_trechos(trechos, ctx, agora, k=k)
    omitidos: list[Descartado] = []
    base = {'memoria': {'aviso': AVISO, 'resumos': [], 'trechos': []}}
    usado = _tamanho(base)
    teto_resumos = int(orcamento_caracteres * FRACAO_PARA_RESUMOS)
    itens_r: list[dict] = []
    for r in escolhidos:
        if r.afirmacoes:
            incluir = len(r.afirmacoes)
            while incluir >= 0:
                item = _item_resumo(r, incluir)
                if usado + _tamanho(item) + 2 <= max(teto_resumos, 0) and (incluir > 0 or r.fatos_duros):
                    break
                incluir -= 1
            if incluir < 0:
                omitidos.append(Descartado(r.id, 'ORCAMENTO'))
                continue
            if incluir < len(r.afirmacoes):
                omitidos.append(Descartado(r.id, f'AFIRMACOES_OMITIDAS:{len(r.afirmacoes) - incluir}'))
        else:
            item = _item_resumo(r, 0)
            limite = teto_resumos - usado - 2 - _tamanho({**item, 'texto': ''})
            aparado = truncar_sem_cortar_numeros(item['texto'], max(limite, 0))
            while aparado and usado + _tamanho({**item, 'texto': aparado}) + 2 > teto_resumos:
                limite = len(aparado) - 40
                aparado = truncar_sem_cortar_numeros(item['texto'], max(limite, 0))
            if not aparado:
                omitidos.append(Descartado(r.id, 'ORCAMENTO'))
                continue
            if aparado != item['texto']:
                item = {**item, 'texto': aparado, 'completo': False}
                omitidos.append(Descartado(r.id, 'TEXTO_APARADO'))
        usado += _tamanho(item) + 2
        itens_r.append(item)
    itens_t: list[dict] = []
    for t in top:
        item = {'id': t.id, 'origem': t.origem.chave, 'escopo': t.escopo, 'hash': t.hash_texto, 'texto': t.texto}
        if usado + _tamanho(item) + 2 > orcamento_caracteres:
            omitidos.append(Descartado(t.id, 'ORCAMENTO'))
            continue
        usado += _tamanho(item) + 2
        itens_t.append(item)
    return BlocoMemoria(tuple(itens_r), tuple(itens_t), tuple(omitidos), tuple([*descartados, *desc_trechos]),
                        orcamento_caracteres)


def reconstruir_bloco(manifesto: Mapping, resumos_por_id: Mapping[str, Resumo],
                      trechos_por_id: Mapping[str, Trecho]) -> BlocoMemoria:
    """Refaz EXATAMENTE o bloco já usado numa execução (auditoria/reprodução). Hash diferente = erro."""
    itens_r, itens_t = [], []
    for m in manifesto.get('resumos', ()):
        r = resumos_por_id.get(m['id'])
        if r is None or r.versao != m['versao'] or r.hash_texto != m['hash']:
            raise ErroMemoria(f'MEMORIA_FIXADA_ALTERADA:{m["id"]}')
        itens_r.append(_item_resumo(r, m['afirmacoes_incluidas']) if r.afirmacoes else _item_resumo(r, 0))
    for m in manifesto.get('trechos', ()):
        t = trechos_por_id.get(m['id'])
        if t is None or t.hash_texto != m['hash']:
            raise ErroMemoria(f'MEMORIA_FIXADA_ALTERADA:{m["id"]}')
        itens_t.append({'id': t.id, 'origem': t.origem.chave, 'escopo': t.escopo, 'hash': t.hash_texto,
                        'texto': t.texto})
    return BlocoMemoria(tuple(itens_r), tuple(itens_t))


# --------------------------------------------------------------------------------- ligação ao pacote
def orcamento_disponivel(carga: Mapping, *, orcamento_caracteres: int = ORCAMENTO_CARACTERES_PADRAO,
                         limite_bytes: int = LIMITE_PACOTE_BYTES) -> int:
    """Quantos caracteres a memória pode ocupar sem estourar o teto do pacote."""
    if limite_bytes > LIMITE_DURO_ARGUMENTO_BYTES:
        raise ErroMemoria('limite acima do máximo de um argumento do Linux')
    atual = len(json.dumps(carga, ensure_ascii=False).encode('utf-8'))
    # caracteres podem ocupar até 3 bytes em UTF-8 (acentos 2): reserva proporcional
    folga = max(limite_bytes - atual - 64, 0) // 2
    return min(orcamento_caracteres, folga)


def anexar_memoria(carga: Mapping, bloco: BlocoMemoria, *, ligado: bool = False,
                   limite_bytes: int = LIMITE_PACOTE_BYTES) -> tuple[dict, dict]:
    """Devolve (nova_carga, relatorio). Desligado (padrão) ou vazio: a carga volta idêntica.

    Nunca falha por causa da memória: se o pacote passaria do teto, a carga segue SEM memória e o relatório
    diz por quê. A carga original não é alterada.
    """
    original = json.loads(json.dumps(carga, ensure_ascii=False))
    if not ligado:
        return original, {'anexada': False, 'motivo': 'DESLIGADA'}
    if 'memoria' in carga:
        raise ErroMemoria('a carga já tem o campo memoria')
    if limite_bytes > LIMITE_DURO_ARGUMENTO_BYTES:
        raise ErroMemoria('limite acima do máximo de um argumento do Linux')
    if bloco.vazio:
        return original, {'anexada': False, 'motivo': 'SEM_MEMORIA_APLICAVEL'}
    nova = {**original, **bloco.como_carga()}
    tamanho = len(json.dumps(nova, ensure_ascii=False).encode('utf-8'))
    if tamanho > limite_bytes:
        return original, {'anexada': False, 'motivo': 'PACOTE_EXCEDE_LIMITE', 'bytes': tamanho}
    return nova, {'anexada': True, 'motivo': 'OK', 'bytes': tamanho, 'manifesto': bloco.manifesto()}


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def custo_adicional_tokens(bloco: BlocoMemoria, execucoes_com_memoria: int) -> int:
    """Tokens de ENTRADA a mais por card, estimados: bloco x execuções que o recebem. Medir de verdade com uso.json."""
    return bloco.tokens_estimados * max(execucoes_com_memoria, 0)
