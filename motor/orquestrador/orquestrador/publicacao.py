"""Trabalhador de publicação: a PORTA e um destino falso. NÃO existe destino real (NÃO CONFIRMADO: o fundador ainda precisa
dizer o que "publicar" significa).

O que é: `Publicador(conexao, destino).uma_volta()` faz UMA volta: reivindica o pedido PEDIDA mais antigo (o banco o marca
EM_EXECUCAO), chama o destino UMA vez e registra o resultado: PUBLICADA (concluir) ou FALHOU (falhar). A conexão é do papel
service_role (a mesma do motor); as quatro portas do banco são da migration 0018.

Regras (o efeito de fora não se repete):
  - o destino é chamado no máximo UMA vez por pedido: o banco nunca entrega o mesmo pedido duas vezes e um pedido
    EM_EXECUCAO nunca volta a PEDIDA;
  - erro do destino vira FALHOU com texto limpo (`limpar_texto`, sem segredo) e nunca PUBLICADA;
  - se o destino respondeu mas o registro no banco falhou, o pedido fica EM_EXECUCAO e o resultado é NAO_REGISTRADO: ninguém o
    retenta sozinho; depois de `EM_EXECUCAO_PARADA_APOS_S` ele vira alarme (`alarmes_de_publicacao`, no formato da vigilância);
  - uma interrupção do processo (KeyboardInterrupt, SystemExit) NÃO vira FALHOU: não se sabe se o destino agiu, então o pedido
    fica EM_EXECUCAO e o alarme avisa.

CUIDADO: `DestinoFalso` marca o pedido como PUBLICADA sem publicar nada. Serve só para teste; não o ligue num banco real,
senão a tela diria "No ar" para algo que não está no ar. NÃO FEITO: a reversão pelo trabalhador (chamar `Destino.reverter` e
depois `reverter_publicacao`); a ordem e quem a dispara dependem do destino real.
"""
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, List, Optional

from .vigilancia import ALTA, Alarme, limpar_texto

EM_EXECUCAO_PARADA_APOS_S = 900            # pedido EM_EXECUCAO há mais de 15 min (o destino responde em segundos)
SEM_PEDIDO, PUBLICADA, FALHOU, NAO_REGISTRADO = 'SEM_PEDIDO', 'PUBLICADA', 'FALHOU', 'NAO_REGISTRADO'
LIMITE_DO_ERRO = 300
LIMITE_DO_TEXTO_CURTO = 120


@dataclass(frozen=True)
class Pedido:
    """O que o destino precisa saber do pedido: o número e quando foi feito (nunca quem pediu)."""
    id: int
    pedido_em: str
    dia_brasilia: str


class Destino(ABC):
    """Para onde a publicação vai. `publicar` devolve a versão publicada ou levanta exceção se NÃO publicou."""
    nome: str = 'destino'

    @abstractmethod
    def publicar(self, pedido: Pedido) -> str: ...

    @abstractmethod
    def reverter(self, versao: str) -> None: ...


_PADRAO = object()


class DestinoFalso(Destino):
    """Destino de TESTE: não publica nada. Guarda as chamadas para o teste conferir quantas vezes foi acionado."""
    nome = 'FALSO_DE_TESTE'

    def __init__(self, *, falha: Optional[BaseException] = None, versao: Any = _PADRAO, demora_s: float = 0.0):
        self.falha, self.versao, self.demora_s = falha, versao, demora_s
        self.publicados: List[Pedido] = []
        self.revertidos: List[str] = []
        self._trava = threading.Lock()

    def publicar(self, pedido: Pedido) -> str:
        with self._trava:
            self.publicados.append(pedido)
        if self.demora_s:
            time.sleep(self.demora_s)
        if self.falha is not None:
            raise self.falha
        return f'falso-{pedido.id}' if self.versao is _PADRAO else self.versao

    def reverter(self, versao: str) -> None:
        with self._trava:
            self.revertidos.append(versao)


@dataclass(frozen=True)
class ResultadoVolta:
    estado: str                                 # SEM_PEDIDO | PUBLICADA | FALHOU | NAO_REGISTRADO
    pedido_id: Optional[int] = None
    versao: Optional[str] = None
    erro: Optional[str] = None


def _valor(linha: Any) -> Any:
    """O valor da primeira coluna, com a conexão devolvendo dict ou tupla."""
    if linha is None:
        return None
    return next(iter(linha.values())) if isinstance(linha, dict) else linha[0]


class Publicador:
    def __init__(self, conexao: Any, destino: Destino):
        self.conexao, self.destino = conexao, destino

    def _chamar(self, consulta: str, parametros: tuple = ()) -> Any:
        with self.conexao.transaction():           # cada porta do banco é uma transação própria, confirmada ao sair
            return _valor(self.conexao.execute(consulta, parametros).fetchone())

    def uma_volta(self) -> ResultadoVolta:
        # Se reivindicar falhar, nada foi reivindicado e o erro sobe: é seguro tentar de novo.
        bruto = self._chamar('SELECT helena_v2.reivindicar_publicacao()')
        if bruto is None:
            return ResultadoVolta(SEM_PEDIDO)
        pedido = Pedido(id=int(bruto['id']), pedido_em=str(bruto['pedido_em']), dia_brasilia=str(bruto['dia_brasilia']))
        try:
            versao = self.destino.publicar(pedido)              # a única chamada ao destino deste pedido
            if not isinstance(versao, str) or not versao.strip():
                raise ValueError('o destino não devolveu a versão publicada')
            versao = limpar_texto(versao.strip(), LIMITE_DO_TEXTO_CURTO)
        except Exception as erro:                               # BaseException (interrupção) sobe e deixa EM_EXECUCAO
            return self._falhar(pedido, erro)
        return self._concluir(pedido, versao)

    def _concluir(self, pedido: Pedido, versao: str) -> ResultadoVolta:
        nome = limpar_texto(getattr(self.destino, 'nome', 'destino'), LIMITE_DO_TEXTO_CURTO) or 'destino'
        try:
            self._chamar('SELECT helena_v2.concluir_publicacao(%s, %s, %s)', (pedido.id, nome, versao))
        except Exception as erro:                               # o destino agiu; o banco não soube. Nunca repete o destino.
            return ResultadoVolta(NAO_REGISTRADO, pedido.id, versao, _texto_do_erro(erro))
        return ResultadoVolta(PUBLICADA, pedido.id, versao)

    def _falhar(self, pedido: Pedido, erro: Exception) -> ResultadoVolta:
        texto = _texto_do_erro(erro)
        try:
            self._chamar('SELECT helena_v2.falhar_publicacao(%s, %s)', (pedido.id, texto))
        except Exception as erro_do_registro:
            return ResultadoVolta(NAO_REGISTRADO, pedido.id, None, _texto_do_erro(erro_do_registro))
        return ResultadoVolta(FALHOU, pedido.id, None, texto)


def _texto_do_erro(erro: BaseException) -> str:
    mensagem = str(erro).strip()
    return limpar_texto(f'{type(erro).__name__}: {mensagem}' if mensagem else type(erro).__name__, LIMITE_DO_ERRO)


def alarmes_de_publicacao(con: Any, *, apos_s: int = EM_EXECUCAO_PARADA_APOS_S) -> List[Alarme]:
    """Pedidos EM_EXECUCAO há mais de `apos_s` segundos: não se retenta sozinho, o fundador confere. Só lê (service_role)."""
    consulta = """SELECT id, iniciada_em FROM helena_v2.publicacoes
                  WHERE estado = 'EM_EXECUCAO' AND iniciada_em < now() - make_interval(secs => %s) ORDER BY id"""
    alarmes = []
    for linha in con.execute(consulta, (apos_s,)).fetchall():
        id_, iniciada = (linha['id'], linha['iniciada_em']) if isinstance(linha, dict) else linha
        alarmes.append(Alarme('PUBLICACAO_PARADA', ALTA,
                              f'pedido de publicação em execução há mais de {apos_s // 60} minutos; não será repetido sozinho',
                              str(id_), f'iniciada_em={iniciada}; confira o destino antes de qualquer nova tentativa'))
    return alarmes
