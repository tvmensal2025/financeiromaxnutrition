"""Vigilância: o vigia de 5 em 5 minutos, os alarmes por mais de um canal e as métricas. SÓ LÊ o banco.

O que é: uma volta do vigia (1) chama `helena_v2.vigia()` (as 13 regras), (2) acha o que o relógio deixou para trás
(prazo vencido sem ninguém agir), (3) acha execução viva parada e card parado, e (4) avisa por TODOS os canais
configurados. Se um canal falhar, os outros avisam; se todos falharem, a falha fica registrada (e é métrica).
Quem corrige o problema é o fundador ou o motor: o vigia nunca muda um card.

Alarmes não repetem à toa: o mesmo alarme só volta depois de `repetir_a_cada_s`, e um alarme que sumiu e voltou
é tratado como novo. Todo texto que sai passa por `limpar_texto` (nada de chave, senha ou endereço com senha).

NÃO COMPROVADO: um canal REALMENTE independente do servidor da v2 (celular, serviço externo). Aqui há o contrato
`Notificador`, um canal em arquivo e um falso; o canal real entra depois, como adaptador revisado, e o teste 7 do
plano (aviso em até 15 minutos, mesmo com o servidor fora do ar) só se prova no dia de prova.
"""
import json
import re
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from executor_helena.segredos import PADROES_DE_VALOR

INTERVALO_PADRAO_S = 300
REPETIR_ALARME_A_CADA_S = 3600
RELOGIO_ATRASADO_APOS_S = 600           # prazo vencido há mais de 10 min sem o relógio ter agido
EXECUCAO_PARADA_APOS_S = 3600           # execução viva há mais de 1 h (o teto de uma ficha é de minutos)
CARD_PARADO_APOS_S = 6 * 3600           # card em andamento sem nenhum evento há 6 h e sem esperar o fundador

ALTA, MEDIA = 'ALTA', 'MEDIA'


def limpar_texto(texto: object, limite: int = 300) -> str:
    """Tira de um texto qualquer coisa que pareça segredo e corta o tamanho. Nunca devolve o valor achado."""
    resultado = str(texto if texto is not None else '')
    for codigo, padrao in PADROES_DE_VALOR:
        resultado = padrao.sub(f'[REMOVIDO:{codigo}]', resultado)
    resultado = re.sub(r'(?i)\b(password|passwd|senha|secret|token|apikey|api_key)\s*[=:]\s*\S+', r'\1=[REMOVIDO]', resultado)
    return resultado[:limite]


@dataclass(frozen=True)
class Alarme:
    codigo: str                                 # ex.: REGRA_13, RELOGIO_ATRASADO, EXECUCAO_PARADA, CARD_PARADO, VIGIA_SEM_BANCO
    gravidade: str                              # ALTA | MEDIA
    resumo: str                                 # uma frase, sem segredo
    referencia: Optional[str] = None            # id do card, da etapa ou da execução
    detalhe: str = ''

    def __post_init__(self):
        object.__setattr__(self, 'resumo', limpar_texto(self.resumo))
        object.__setattr__(self, 'detalhe', limpar_texto(self.detalhe))
        object.__setattr__(self, 'referencia', limpar_texto(self.referencia, 80) if self.referencia else None)

    @property
    def chave(self) -> Tuple[str, Optional[str]]:
        return (self.codigo, self.referencia)


class Notificador(ABC):
    """Um canal de aviso. `enviar` levanta exceção se NÃO entregou; devolver sem erro = entregue."""
    nome: str = 'canal'

    @abstractmethod
    def enviar(self, alarme: Alarme) -> None: ...


class NotificadorFalso(Notificador):
    def __init__(self, nome: str = 'falso', *, falha: bool = False):
        self.nome, self.falha, self.enviados = nome, falha, []

    def enviar(self, alarme: Alarme) -> None:
        if self.falha:
            raise ConnectionError(f'canal {self.nome} fora do ar (simulado)')
        self.enviados.append(alarme)


class NotificadorDeArquivo(Notificador):
    """Acrescenta uma linha JSON por alarme num arquivo local. Serve de canal mínimo e de trilha para auditoria."""
    nome = 'arquivo'

    def __init__(self, caminho: Path):
        self.caminho = Path(caminho)

    def enviar(self, alarme: Alarme) -> None:
        linha = {'quando': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'codigo': alarme.codigo, 'gravidade': alarme.gravidade,
                 'resumo': alarme.resumo, 'referencia': alarme.referencia, 'detalhe': alarme.detalhe}
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        with open(self.caminho, 'a', encoding='utf-8') as arquivo:
            arquivo.write(json.dumps(linha, ensure_ascii=False) + '\n')


# --- coleta (só SELECT) --------------------------------------------------------------------------------------------
def coletar_alarmes(con, *, agora_s: Optional[float] = None) -> List[Alarme]:
    """`con` é uma conexão do papel service_role (a mesma do motor). Não escreve nada."""
    alarmes: List[Alarme] = []
    for linha in con.execute('SELECT regra, card_id, mensagem FROM helena_v2.vigia()').fetchall():
        regra, card_id, mensagem = (linha['regra'], linha['card_id'], linha['mensagem']) if isinstance(linha, dict) else linha
        alarmes.append(Alarme(f'REGRA_{regra}', ALTA, f'o vigia achou um problema na regra {regra}',
                              str(card_id) if card_id else None, mensagem))
    for maquina, tabela in (('card', 'card'), ('etapa', 'etapa'), ('acao_externa', 'acao_externa')):
        consulta = f"""SELECT t.id, t.estado, t.prazo_ate FROM helena_v2.{tabela} t
                       WHERE t.prazo_ate < now() - make_interval(secs => %s)
                         AND t.estado NOT IN (SELECT d.estado FROM helena_v2.estado_def d WHERE d.maquina = %s AND d.final)"""
        for linha in con.execute(consulta, (RELOGIO_ATRASADO_APOS_S, maquina)).fetchall():
            id_, estado, prazo = (linha['id'], linha['estado'], linha['prazo_ate']) if isinstance(linha, dict) else linha
            alarmes.append(Alarme('RELOGIO_ATRASADO', ALTA, f'o prazo de {maquina} em {estado} venceu e o relógio não agiu',
                                  str(id_), f'prazo_ate={prazo}'))
    consulta_execucao = """SELECT numero, tipo, card_id FROM helena_v2.execucao
                           WHERE estado = 'VIVA' AND iniciada_em < now() - make_interval(secs => %s)"""
    for linha in con.execute(consulta_execucao, (EXECUCAO_PARADA_APOS_S,)).fetchall():
        numero, tipo, card_id = (linha['numero'], linha['tipo'], linha['card_id']) if isinstance(linha, dict) else linha
        alarmes.append(Alarme('EXECUCAO_PARADA', ALTA, f'execução {tipo} viva há mais de {EXECUCAO_PARADA_APOS_S // 60} minutos',
                              str(numero), f'card={card_id}'))
    consulta_card = """SELECT c.id FROM helena_v2.card c
                       WHERE c.estado = 'EM_ANDAMENTO'
                         AND coalesce((SELECT max(h.momento) FROM helena_v2.historico h WHERE h.card_id = c.id), c.criado_em)
                             < now() - make_interval(secs => %s)
                         AND NOT EXISTS (SELECT 1 FROM helena_v2.etapa e WHERE e.card_id = c.id AND e.atual
                                         AND e.estado IN ('ESPERANDO_FUNDADOR', 'EM_RESOLUCAO'))"""
    for linha in con.execute(consulta_card, (CARD_PARADO_APOS_S,)).fetchall():
        card_id = linha['id'] if isinstance(linha, dict) else linha[0]
        alarmes.append(Alarme('CARD_PARADO', MEDIA, f'card em andamento sem nenhum evento há mais de {CARD_PARADO_APOS_S // 3600} horas',
                              str(card_id)))
    return alarmes


def coletar_metricas(con) -> Dict[str, object]:
    """Fotografia de custo, tempo e erros. Só SELECT; sem texto de agente, sem dado pessoal."""
    def linhas(consulta, args=()):
        return [tuple(l.values()) if isinstance(l, dict) else tuple(l) for l in con.execute(consulta, args).fetchall()]

    execucoes = {f'{tipo}/{estado}': int(n) for tipo, estado, n in
                 linhas('SELECT tipo, estado, count(*) FROM helena_v2.execucao GROUP BY 1, 2 ORDER BY 1, 2')}
    (tempo_medio,) = linhas("""SELECT avg(extract(epoch FROM (encerrada_em - iniciada_em)))
                               FROM helena_v2.execucao WHERE encerrada_em IS NOT NULL""")[0]
    recusas = {motivo or 'SEM_MOTIVO': int(n) for motivo, n in
               linhas("""SELECT motivo, count(*) FROM helena_v2.historico
                         WHERE resultado = 'RECUSADO' AND momento > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 20""")}
    cards = {estado: int(n) for estado, n in linhas('SELECT estado, count(*) FROM helena_v2.card GROUP BY 1 ORDER BY 1')}
    tokens = 0
    contadas = 0
    for (numero,) in linhas("""SELECT numero FROM helena_v2.execucao WHERE iniciada_em > now() - interval '24 hours'
                               ORDER BY numero DESC LIMIT 500"""):
        resposta = con.execute('SELECT helena_v2.ler_resposta_execucao(%s) AS r', (numero,)).fetchone()
        resposta = resposta['r'] if isinstance(resposta, dict) else resposta[0]
        uso = (resposta or {}).get('uso') if isinstance(resposta, dict) else None
        total = getattr(uso, 'get', lambda *_: None)('tokens_total') if uso else None
        if isinstance(total, int):
            tokens += total
            contadas += 1
    return {'execucoes_por_tipo_e_estado': execucoes,
            'tempo_medio_de_execucao_s': round(float(tempo_medio), 3) if tempo_medio is not None else None,
            'recusas_nas_ultimas_24h': recusas, 'cards_por_estado': cards,
            'tokens_nas_ultimas_24h': tokens, 'execucoes_com_uso_registrado': contadas}


# --- o vigia -------------------------------------------------------------------------------------------------------
@dataclass
class ResultadoDaVolta:
    alarmes: int = 0
    enviados: int = 0
    suprimidos: int = 0
    canais_falhos: int = 0
    sem_nenhum_canal: bool = False
    erro_de_coleta: bool = False
    detalhes: List[str] = field(default_factory=list)


class Vigia:
    """`conexao` é uma função que devolve uma conexão service_role NOVA a cada volta (com `with`)."""

    def __init__(self, conexao: Callable[[], object], canais: Sequence[Notificador], *,
                 repetir_a_cada_s: float = REPETIR_ALARME_A_CADA_S, relogio: Callable[[], float] = time.monotonic,
                 registrar: Optional[Callable[[str], None]] = None):
        if not canais:
            raise ValueError('o vigia precisa de pelo menos um canal de aviso')
        self.conexao, self.canais, self.repetir_a_cada_s = conexao, list(canais), repetir_a_cada_s
        self.relogio = relogio
        self.registrar = registrar or (lambda linha: None)
        self._ultimo_aviso: Dict[Tuple[str, Optional[str]], float] = {}
        self.metricas = {'voltas': 0, 'alarmes_coletados': 0, 'avisos_enviados': 0, 'avisos_suprimidos': 0,
                         'canais_falhos': 0, 'voltas_sem_nenhum_canal': 0, 'voltas_com_erro_de_coleta': 0}

    def uma_volta(self) -> ResultadoDaVolta:
        resultado = ResultadoDaVolta()
        self.metricas['voltas'] += 1
        try:
            with self.conexao() as con:
                alarmes = coletar_alarmes(con)
        except Exception as erro:                       # banco fora do ar também é um alarme, e dos importantes
            resultado.erro_de_coleta = True
            self.metricas['voltas_com_erro_de_coleta'] += 1
            alarmes = [Alarme('VIGIA_SEM_BANCO', ALTA, 'o vigia não conseguiu consultar o banco da v2', None,
                              f'{type(erro).__name__}: {erro}')]
        self.metricas['alarmes_coletados'] += len(alarmes)
        resultado.alarmes = len(alarmes)
        agora = self.relogio()
        vivos = {a.chave for a in alarmes}
        for chave in [c for c in self._ultimo_aviso if c not in vivos]:      # sumiu: se voltar, é novo
            del self._ultimo_aviso[chave]
        for alarme in alarmes:
            ultimo = self._ultimo_aviso.get(alarme.chave)
            if ultimo is not None and agora - ultimo < self.repetir_a_cada_s:
                resultado.suprimidos += 1
                self.metricas['avisos_suprimidos'] += 1
                continue
            entregue = False
            for canal in self.canais:
                try:
                    canal.enviar(alarme)
                    entregue = True
                except Exception as erro:               # um canal fora do ar não cala os outros
                    resultado.canais_falhos += 1
                    self.metricas['canais_falhos'] += 1
                    resultado.detalhes.append(limpar_texto(f'canal {canal.nome} falhou: {type(erro).__name__}'))
            if entregue:
                self._ultimo_aviso[alarme.chave] = agora
                resultado.enviados += 1
                self.metricas['avisos_enviados'] += 1
            else:
                resultado.sem_nenhum_canal = True
                self.metricas['voltas_sem_nenhum_canal'] += 1
                self.registrar(limpar_texto(f'ALARME SEM CANAL: {alarme.codigo} {alarme.resumo} ref={alarme.referencia}'))
        return resultado

    def rodar(self, parar: threading.Event, intervalo_s: float = INTERVALO_PADRAO_S) -> None:
        """Roda voltas de `intervalo_s` em `intervalo_s` até `parar`. Uma volta com erro nunca derruba o laço."""
        while not parar.is_set():
            try:
                self.uma_volta()
            except Exception as erro:                   # defesa final: o vigia não pode morrer calado
                self.registrar(limpar_texto(f'ERRO NA VOLTA DO VIGIA: {type(erro).__name__}'))
            parar.wait(intervalo_s)
