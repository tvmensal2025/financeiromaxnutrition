"""Relógio dos prazos: o emissor dos eventos de tempo do papel RELOGIO.

O que é: uma volta (1) lê `helena_v2.eventos_devidos(agora)` — o BANCO decide o que venceu (0017_relogio.sql) — e
(2) aplica cada evento, na ordem devolvida, por `aplicar(maquina, alvo_id, 'RELOGIO', evento)`, pulando o que deixou de
estar devido no meio da volta. Quem decide se o evento muda o estado é a tabela de passagens; aqui só se conta o que foi
aplicado, recusado ou pulado.
Banco fora do ar (na leitura ou ao aplicar) levanta a exceção: nada fica em silêncio.
Como mudar: instantes e escadas ficam no SQL; a forma de aplicar entra por injeção. `aplicador_do_banco` monta a padrão
(helena_v2.aplicar_evento com os automáticos, sem disparar PLANO_VALIDO, que é só do validador do motor).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, List, Optional

PAPEL = 'RELOGIO'
RESULTADOS_APLICADOS = ('APLICADO', 'CONVERTIDO')
NAO_DISPARAR = ('PLANO_VALIDO',)       # o plano só vale pelo validador do motor (mesma regra de 0008 e do motor)

_CONSULTA = ('SELECT t.maquina, t.alvo_id, t.card_id, t.evento, t.vencimento '
             'FROM helena_v2.eventos_devidos({}) WITH ORDINALITY '
             'AS t(maquina, alvo_id, card_id, evento, vencimento, n) ORDER BY t.n')


@dataclass(frozen=True)
class EventoDevido:
    maquina: str
    alvo_id: str
    card_id: str
    evento: str
    vencimento: datetime


@dataclass
class ResumoDaVolta:
    devidos: int = 0
    aplicados: int = 0
    recusados: int = 0
    obsoletos: int = 0                                      # deixaram de estar devidos no meio da volta
    eventos: List[EventoDevido] = field(default_factory=list)
    recusas: List[dict] = field(default_factory=list)      # {maquina, alvo_id, evento, resultado, motivo}


def _valores(linha):
    if isinstance(linha, dict):
        return linha['maquina'], linha['alvo_id'], linha['card_id'], linha['evento'], linha['vencimento']
    return tuple(linha)


class Relogio:
    """`conexao` devolve uma conexão NOVA do papel service_role a cada volta (usada com `with`), como no Vigia.
    `aplicar(maquina, alvo_id, papel, evento)` devolve a resposta de helena_v2.aplicar_evento (um dicionário)."""

    def __init__(self, conexao: Callable[[], object], aplicar: Callable[[str, str, str, str], dict]):
        if not callable(conexao) or not callable(aplicar):
            raise TypeError('o relógio precisa de uma função de conexão e de uma função de aplicar')
        self.conexao, self.aplicar = conexao, aplicar

    def devidos(self, agora: Optional[datetime] = None) -> List[EventoDevido]:
        if agora is not None and (not isinstance(agora, datetime) or agora.tzinfo is None):
            raise ValueError('agora precisa de fuso (datetime com tzinfo): o prazo é um instante, não uma hora de parede')
        with self.conexao() as con:
            if agora is None:
                linhas = con.execute(_CONSULTA.format('')).fetchall()
            else:
                linhas = con.execute(_CONSULTA.format('%s'), (agora,)).fetchall()
        devidos = []
        for linha in linhas:
            maquina, alvo_id, card_id, evento, vencimento = _valores(linha)
            devidos.append(EventoDevido(maquina, str(alvo_id), str(card_id), evento, vencimento))
        return devidos

    def uma_volta(self, agora: Optional[datetime] = None) -> ResumoDaVolta:
        """Lê o que venceu e aplica tudo, na ordem. Uma recusa é contada (a guarda decidiu); um erro levanta.
        Antes de cada evento depois do primeiro, o banco é consultado de novo: se o alvo andou no meio da volta (o autor
        entregou, o card foi cancelado), o evento deixou de estar devido e é pulado (`obsoletos`), em vez de cair no
        estado novo. NÃO fecha a corrida por completo: entre a consulta e a aplicação ainda há uma janela curta."""
        devidos = self.devidos(agora)
        resumo = ResumoDaVolta(devidos=len(devidos), eventos=list(devidos))
        for i, ev in enumerate(devidos):
            if i > 0 and ev not in self.devidos(agora):
                resumo.obsoletos += 1
                continue
            resposta = self.aplicar(ev.maquina, ev.alvo_id, PAPEL, ev.evento)
            if not isinstance(resposta, dict) or 'resultado' not in resposta:
                raise TypeError(f'aplicar devolveu algo que não é a resposta de aplicar_evento: {type(resposta).__name__}')
            if resposta['resultado'] in RESULTADOS_APLICADOS:
                resumo.aplicados += 1
            else:
                resumo.recusados += 1
                resumo.recusas.append({'maquina': ev.maquina, 'alvo_id': ev.alvo_id, 'evento': ev.evento,
                                       'resultado': resposta['resultado'], 'motivo': resposta.get('motivo')})
        return resumo


def aplicador_do_banco(conexao: Callable[[], object]) -> Callable[[str, str, str, str], dict]:
    """A função `aplicar` padrão: uma chamada de helena_v2.aplicar_evento por evento, numa conexão nova do service_role."""
    def aplicar(maquina: str, alvo_id: str, papel: str, evento: str) -> dict:
        with conexao() as con:
            linha = con.execute('SELECT helena_v2.aplicar_evento(%s, %s::uuid, %s, %s, p_nao_disparar => %s::text[]) AS r',
                                (maquina, str(alvo_id), papel, evento, list(NAO_DISPARAR))).fetchone()
        return linha['r'] if isinstance(linha, dict) else linha[0]
    return aplicar
