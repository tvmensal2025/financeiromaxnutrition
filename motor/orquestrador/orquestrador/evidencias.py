"""Provas locais realmente entregues ao agente pelo servidor de ferramentas."""

from __future__ import annotations

import json
import re
import stat
from dataclasses import asdict
from pathlib import Path

from executor_helena.tipos import Resultado
from ferramentas_helena.copias import carregar_copia
from ferramentas_helena.erros import CopiaAdulterada
from ferramentas_helena.leitor import montar_saida
from ferramentas_helena.registro import hash_do_texto, ler_estado, ler_registro


_EXECUCAO = re.compile(r'[A-Za-z][A-Za-z0-9_.-]{0,79}\Z')
_LEITURA = re.compile(r'LEI-[0-9]{3,}\Z')
_MAX_REGISTRO = 512_000
_MAX_ESTADO = 64_000
_MAX_COPIA = 1_000_000
_MAX_LEITURAS = 30
_MAX_CONVERSA = 512_000


class EvidenciaInvalida(ValueError):
    """Prova ausente, trocada ou de outra execução."""


def _sem_link(caminho: Path, *, arquivo=False, limite=None) -> bool:
    """Confere cada componente até a raiz; nunca abre links simbólicos."""
    caminho = Path(caminho).absolute()
    partes = list(reversed((caminho, *caminho.parents)))
    for parte in partes:
        try:
            modo = parte.lstat().st_mode
        except FileNotFoundError:
            return False
        if stat.S_ISLNK(modo):
            raise EvidenciaInvalida('caminho de evidência contém link simbólico')
        if parte != caminho and not stat.S_ISDIR(modo):
            raise EvidenciaInvalida('ancestral de evidência não é pasta')
    modo = caminho.lstat().st_mode
    if arquivo and not stat.S_ISREG(modo):
        raise EvidenciaInvalida('evidência não é arquivo regular')
    if not arquivo and not stat.S_ISDIR(modo):
        raise EvidenciaInvalida('pasta de evidências inválida')
    if limite is not None and caminho.stat().st_size > limite:
        raise EvidenciaInvalida('evidência excede limite de tamanho')
    return True


def _conversa(conversa) -> list:
    try:
        bruto = json.dumps(conversa, ensure_ascii=False, allow_nan=False).encode('utf-8')
        if len(bruto) > _MAX_CONVERSA:
            raise EvidenciaInvalida('conversa excede limite de tamanho')
        copiada = json.loads(bruto)
    except (TypeError, ValueError) as exc:
        if isinstance(exc, EvidenciaInvalida):
            raise
        raise EvidenciaInvalida('conversa não é JSON válido') from None
    if not isinstance(copiada, list) or any(not isinstance(item, dict) for item in copiada):
        raise EvidenciaInvalida('conversa deve ser lista de objetos')
    return copiada


def coletar_evidencias(resultado: Resultado, execucao_id: str) -> dict:
    """Coleta somente partes com registro `ok` desta execução, sem chamadas HTTP."""
    if not isinstance(resultado, Resultado) or not isinstance(execucao_id, str) or not _EXECUCAO.fullmatch(execucao_id):
        raise EvidenciaInvalida('resultado ou identidade da execução inválidos')
    uso = asdict(resultado.uso)
    conversa = _conversa(resultado.conversa)
    internet = uso.get('usou_internet')
    if internet is not None and not isinstance(internet, bool):
        raise EvidenciaInvalida('uso de internet inválido')
    vazio = {'paginas_lidas': [], 'usou_internet': internet, 'conversa': conversa, 'uso': uso}
    if resultado.pasta is None:
        if internet is True:
            raise EvidenciaInvalida('execução com internet não tem pasta de evidências')
        return vazio
    pasta = Path(resultado.pasta)
    if not _sem_link(pasta):
        if internet is True:
            raise EvidenciaInvalida('pasta de evidências ausente')
        return vazio
    ferramentas = pasta / 'ferramentas'
    if not _sem_link(ferramentas):
        if internet is True:
            raise EvidenciaInvalida('estado das ferramentas ausente')
        return vazio
    estado_arq = ferramentas / 'estado.json'
    registro_arq = ferramentas / 'registro.jsonl'
    if not _sem_link(estado_arq, arquivo=True, limite=_MAX_ESTADO):
        raise EvidenciaInvalida('estado das ferramentas ausente')
    if not _sem_link(registro_arq, arquivo=True, limite=_MAX_REGISTRO):
        raise EvidenciaInvalida('registro das ferramentas ausente')
    try:
        estado = ler_estado(ferramentas)
        registros = ler_registro(ferramentas)
    except (OSError, ValueError, TypeError):
        raise EvidenciaInvalida('registro ou estado das ferramentas inválido') from None
    if not isinstance(estado, dict) or estado.get('execucao') != execucao_id:
        raise EvidenciaInvalida('estado pertence a outra execução')
    usou_estado = estado.get('usou_internet')
    if not isinstance(usou_estado, bool) or (internet is not None and internet != usou_estado):
        raise EvidenciaInvalida('uso de internet diverge do estado das ferramentas')
    if len(registros) > _MAX_LEITURAS * 4:
        raise EvidenciaInvalida('registro excede limite de chamadas')
    if any(not isinstance(r, dict) or r.get('execucao') != execucao_id for r in registros):
        raise EvidenciaInvalida('registro contém chamada de outra execução')
    paginas = {}
    for r in registros:
        if r.get('ferramenta') != 'ler_pagina' or r.get('resultado') not in ('ok', 'entregue_agora'):
            continue
        # "entregue_agora" é aviso de limite, sem página nem leitura_id.
        if r['resultado'] == 'entregue_agora':
            if r.get('leitura_id') is not None:
                raise EvidenciaInvalida('aviso de limite marcado como página')
            continue
        leitura_id, parte = r.get('leitura_id'), r.get('parte')
        if not isinstance(leitura_id, str) or not _LEITURA.fullmatch(leitura_id) or type(parte) is not int:
            raise EvidenciaInvalida('leitura ou parte inválida no registro')
        if leitura_id not in paginas and len(paginas) >= _MAX_LEITURAS:
            raise EvidenciaInvalida('leituras excedem limite')
        leituras = ferramentas / 'leituras'
        if not _sem_link(leituras):
            raise EvidenciaInvalida('pasta de cópias ausente')
        for extensao in ('json', 'txt'):
            if not _sem_link(leituras / f'{leitura_id}.{extensao}', arquivo=True, limite=_MAX_COPIA):
                raise EvidenciaInvalida('cópia da página ausente')
        try:
            copia = carregar_copia(ferramentas, leitura_id)
            texto = copia.parte(parte)
            entregue = montar_saida(copia, parte)
        except (OSError, ValueError, KeyError, IndexError, TypeError, CopiaAdulterada):
            raise EvidenciaInvalida('cópia ou parte da página inválida') from None
        if (copia.leitura_id != leitura_id or r.get('de') != copia.total_partes
                or r.get('hash_copia') != copia.hash_texto
                or r.get('url_final') != copia.url_final
                or r.get('hash') != hash_do_texto(entregue)):
            raise EvidenciaInvalida('cópia difere do texto entregue ao agente')
        pagina = paginas.setdefault(leitura_id, {
            'leitura_id': leitura_id, 'url': copia.url_final, 'tipo': copia.tipo,
            'execucao': execucao_id, 'partes_total': copia.total_partes, 'partes': {},
        })
        if pagina['url'] != copia.url_final or pagina['partes_total'] != copia.total_partes:
            raise EvidenciaInvalida('leitura mudou durante a coleta')
        chave = str(parte)
        if chave in pagina['partes'] and pagina['partes'][chave] != texto:
            raise EvidenciaInvalida('parte entregue com textos divergentes')
        pagina['partes'][chave] = texto
    if paginas and not usou_estado:
        raise EvidenciaInvalida('páginas entregues mas internet ausente no estado')
    vazio['paginas_lidas'] = list(paginas.values())
    vazio['usou_internet'] = usou_estado
    return vazio
