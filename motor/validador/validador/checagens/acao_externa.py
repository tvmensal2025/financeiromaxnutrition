"""Ação externa: o agente NUNCA age fora. Duas checagens:

CHK-COMUM-05  o TEXTO não pode dizer que o agente agiu fora ("enviei", "cadastrei", "paguei"...).
CHK-COMUM-10  o CAMPO acao_externa só pode propor uma ação do fundador, da lista fechada do serviço.
"""
import re

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha

ID5, ID10 = "CHK-COMUM-05", "CHK-COMUM-10"

# Verbos na 1ª pessoa do passado (eu/nós), SEM acento e em minúsculas. A frase negada ("não enviei") é aceita.
VERBOS = """enviei enviamos mandei mandamos cadastrei cadastramos contatei contatamos publiquei publicamos paguei
liguei ligamos assinei assinamos comprei compramos contratei contratamos agendei agendamos postei postamos
inscrevi inscrevemos transferi transferimos depositei depositamos divulguei divulgamos disparei disparamos telefonei
telefonamos notifiquei notificamos""".split()
EXPRESSOES = [
    r"entrei em contato", r"falei com", r"conversei com", r"abri (?:uma |a )?conta", r"criei (?:uma |a )?conta",
    r"me cadastrei", r"me inscrevi", r"fiz (?:o|a|um|uma) (?:cadastro|inscricao|pagamento|compra|contrato|ligacao|publicacao|envio|disparo|transferencia|agendamento|contratacao|assinatura|divulgacao|postagem)",
    r"(?:realizei|efetuei|finalizei|conclui) (?:o|a|um|uma) (?:cadastro|inscricao|pagamento|compra|contrato|ligacao|publicacao|envio|disparo|transferencia|agendamento|contratacao|assinatura|divulgacao|postagem)",
    r"(?:enviad[oa]s?|feit[oa]s?|cadastrad[oa]s?|publicad[oa]s?|pag[oa]s?|contratad[oa]s?|assinad[oa]s?) por mim",
    r"(?:enviado|publicado|cadastrado|registrado|assinado|contratado|agendado|pago) com sucesso",
    r"(?:cadastro|pagamento|inscricao|contrato|publicacao|compra) (?:realizad[oa]|efetuad[oa]|concluid[oa]) com sucesso",
]
NEGACOES = {"nao", "nunca", "jamais", "nem"}

_RX_VERBO = re.compile(r"\b(?:" + "|".join(VERBOS) + r")\b")
_RX_EXPR = re.compile(r"\b(?:" + "|".join(EXPRESSOES) + r")\b")
_RX_TOKEN = re.compile(r"[a-z0-9]+")


def _negado(folded: str, inicio: int) -> bool:
    antes = _RX_TOKEN.findall(folded[max(0, inicio - 40):inicio])[-3:]
    return any(t in NEGACOES for t in antes)


def afirma_acao_externa(texto: str):
    """Devolve o trecho que diz que o agente agiu fora, ou None."""
    f = T.dobrar(texto)
    for rx in (_RX_VERBO, _RX_EXPR):
        for m in rx.finditer(f):
            if not _negado(f, m.start()):
                return m.group(0)
    return None


@checagem(ID5, "Texto não diz que o agente agiu fora",
          "O agente podia escrever 'enviei o e-mail' sem ter enviado nada, e o fundador acreditar que a ação foi feita.",
          ["CONF-20", "B-17"])
def sem_acao_externa_afirmada(exe):
    if not exe.formato_ok:
        return None
    falhas = []
    for i in exe.itens:
        if i.tipo != "livre":
            continue
        achado = afirma_acao_externa(i.texto)
        if achado:
            falhas.append(Falha(ID5, "AFIRMA_ACAO_EXTERNA", i.caminho,
                                f"O texto diz que o agente fez algo fora ('{achado}'). Agente nunca age fora: escreva o que o FUNDADOR precisa fazer.", T.cortar(i.texto)))
    return falhas


@checagem(ID10, "Ação externa só como proposta da lista do serviço",
          "O campo acao_externa podia carregar texto livre ou uma ação que o serviço não libera (PELO_MOTOR, ação inventada).",
          ["CONF-20", "B-17", "MAQ-08"])
def acao_externa_proposta(exe):
    if exe.acao != "ENTREGAR":
        return None
    ae = exe.acao_obj.get("acao_externa")
    cam = "resposta.acao_externa"
    if not isinstance(ae, dict):
        return [Falha(ID10, "FORA_DO_FORMATO", cam, "acao_externa deve ser um objeto: {'tipo': 'NENHUMA'} ou {'tipo': 'SO_FUNDADOR', 'acao_do_fundador': '...'}.", T.cortar(str(ae)))]
    tipo = ae.get("tipo")
    if tipo == "PELO_MOTOR":
        return [Falha(ID10, "PELO_MOTOR_NAO_LIBERADO", cam, "PELO_MOTOR não está liberado para nenhum serviço. Use NENHUMA ou SO_FUNDADOR.", tipo)]
    if tipo not in ("NENHUMA", "SO_FUNDADOR"):
        return [Falha(ID10, "TIPO_INVALIDO", cam, "O tipo da ação externa deve ser NENHUMA ou SO_FUNDADOR.", T.cortar(str(tipo)))]
    permitido = {"tipo"} | ({"acao_do_fundador"} if tipo == "SO_FUNDADOR" else set())
    extras = sorted(set(ae) - permitido)
    if extras:
        return [Falha(ID10, "TEXTO_LIVRE_SOBRE_A_ACAO", cam,
                      f"O campo acao_externa não aceita {', '.join(extras)}: o texto da ação vem da lista fixa do serviço, nunca do agente.", ", ".join(extras))]
    if tipo not in exe.modelo.get("acao_externa_permitida", ["NENHUMA"]):
        return [Falha(ID10, "TIPO_FORA_DO_SERVICO", cam, f"Este serviço não libera {tipo}.", tipo)]
    if tipo == "SO_FUNDADOR":
        acao = ae.get("acao_do_fundador")
        if acao not in (exe.modelo.get("acoes_do_fundador") or []):
            return [Falha(ID10, "ACAO_DO_FUNDADOR_INVALIDA", cam + ".acao_do_fundador",
                          "A ação do fundador não está na lista fechada deste serviço.", T.cortar(str(acao)))]
        do_plano = exe.modelo.get("acao_do_fundador_do_plano")
        if do_plano and acao != do_plano:
            return [Falha(ID10, "ACAO_DIFERENTE_DA_DO_PLANO", cam + ".acao_do_fundador",
                          f"O plano deu a esta etapa a ação {do_plano}; veio {acao}.", T.cortar(str(acao)))]
    return []
