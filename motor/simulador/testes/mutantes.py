"""Versões ESTRAGADAS da implementação de referência, uma por defeito.

Cada classe quebra UMA regra, sobrescrevendo um dos métodos pequenos de referencia.py. O checador de
invariantes precisa pegar todas (test_mutacoes.py). Se uma mutação passar sem violação, o checador ou o
gerador de eventos tem um buraco.

Para criar uma mutação nova: escreva a classe aqui, acrescente uma linha em MUTACOES (no fim) com o
cenário curto que a revela e a invariante que deve acusá-la.
"""
import dataclasses
from dataclasses import dataclass

from ajudantes import (ACAO_AUTORIZADA_E_FALHA, AJUSTE_EM_E2_COM_EJ_APROVADA, COMECO_UNICA, DECISAO_MUDA_COM_E1_APROVADA,
                       FELIZ_UNICA, FUNDADOR_REVISA_E_NAO_RESPONDE, PROPOE_ACAO_DO_MOTOR, PROVA_E1_APROVADA, ajustes_seguidos,
                       entrega, formato_errado_seguido, portao_ok)
from simulador.eventos import Foto, Resposta, autor, fundador, helena, relogio, revisor, vigia
from simulador.referencia import Referencia, _Acao
from simulador.roteiro import ROTEIRO_PROVA, ROTEIRO_UNICA
from simulador.vocabulario import FUNDADOR, PAPEIS_DE_IA, TETO_EXECUCOES


# ---------------------------------------------------------------------------- regra 5: teto de execuções
class SemTetoDeExecucoes(Referencia):
    """Nunca mais para de tentar: a etapa roda para sempre."""
    def _cabe_mais_uma_execucao(self, e):
        return True


class SemTetoComContadorMentiroso(SemTetoDeExecucoes):
    """Sem teto E o contador que o alvo mostra nunca passa de 6: só a conta própria do checador pega."""
    def foto(self):
        f = super().foto()
        etapas = {i: dataclasses.replace(e, execucoes=min(e.execucoes, TETO_EXECUCOES)) for i, e in f.etapas.items()}
        return Foto(f.card, etapas, f.acoes, f.donos)


class SemTetoDeOrdens(Referencia):
    """O fundador pode pedir ajuste para sempre; o card nunca é substituído por um card novo."""
    def _abrir_rodada_por_ordem(self, e):
        self.card["ordens"] += 1
        self._reabrir(e)
        return True


# ---------------------------------------------------------------------------- regra 4: ninguém aprova a própria peça
class PortaoAceitaQualquerRevisor(Referencia):
    """O portão 1 designa o autor (ou quem vai julgar a peça depois) como revisor."""
    def _revisor_valido(self, e, escolhido):
        return True


class QualquerUmAprovaComoRevisor(Referencia):
    """A aprovação do revisor não confere quem aprovou: o autor aprova a própria peça."""
    def _revisor_aprova(self, e, ev):
        if not self._vivo(e, ev, "REVISAO", True):
            return False
        e.execucoes += 1
        e.exec_viva, e.estado = 0, "APROVADA"
        return True


class AutorAprovaAPropriaPeca(Referencia):
    """O autor ganha o botão Aprovar na própria etapa."""
    def __init__(self):
        super().__init__()
        self._etapa_por_evento[("AUTOR", "APROVAR")] = self._autor_aprova

    def _evento_conhecido(self, ev):
        return (ev.papel, ev.evento) == ("AUTOR", "APROVAR") or super()._evento_conhecido(ev)

    def _autor_aprova(self, e, ev):
        if not self._vivo(e, ev, "EXECUTANDO", True):
            return False
        e.exec_viva, e.estado = 0, "APROVADA"
        return True


# ---------------------------------------------------------------------------- regra 9: o padrão nunca aprova
class PadraoDoRelogioAprovaAEntrega(Referencia):
    """O fundador some, o prazo da espera vence e a entrega é dada como aprovada."""
    def _destino_do_padrao_da_etapa(self):
        return "APROVADA"


class PadraoDoRelogioAutorizaAAcao(Referencia):
    """O fundador esquece a ação, o prazo vence e ela é autorizada com o ok dele (que ele nunca deu)."""
    def _padrao_da_acao(self, a):
        a.estado, a.ok_registrado = "AUTORIZADA", 1


# ---------------------------------------------------------------------------- regra 8: nada externo pelo agente
class AgenteExecutaAcaoExterna(Referencia):
    """O agente ganha o evento EXECUTAR_ACAO e age no mundo de fora."""
    def _evento_conhecido(self, ev):
        return ev.evento == "EXECUTAR_ACAO" or super()._evento_conhecido(ev)

    def _evento_da_acao(self, a, ev):
        if ev.papel in PAPEIS_DE_IA and ev.evento == "EXECUTAR_ACAO":
            a.estado, a.tentativas = "EXECUTANDO_ACAO", a.tentativas + 1
            return True
        return super()._evento_da_acao(a, ev)


class EntregaJaExecutaAAcao(Referencia):
    """A entrega do agente cria a ação de fora já em execução, antes do card pronto e sem o ok do fundador."""
    def _ao_entregar_proposta(self, e):
        if e.proposta != "NENHUMA":
            id_ = f"A{len(self.acoes) + 1}"
            self.acoes[id_] = _Acao(id_, e.cfg.id, True, estado="EXECUTANDO_ACAO", ok_registrado=0, tentativas=1)


class AcaoNasceAntesDoCardPronto(Referencia):
    """A ação proposta aparece na lista do fundador assim que a entrega chega, sem esperar o card pronto."""
    def _ao_entregar_proposta(self, e):
        if e.proposta != "NENHUMA":
            id_ = f"A{len(self.acoes) + 1}"
            self.acoes[id_] = _Acao(id_, e.cfg.id, tem_ferramenta=True)


class AcaoQueFalhaVoltaEExecutaOutraVez(Referencia):
    """Ação que falhou volta a ser autorizada e o motor executa de novo (a regra é no máximo uma vez)."""
    def _pode_executar_a_acao(self, a):
        return a.estado == "AUTORIZADA" and a.ok_registrado == 1

    def _evento_da_acao(self, a, ev):
        if a.estado == "EXECUTANDO_ACAO" and (ev.papel, ev.evento) == ("MOTOR", "ACAO_FALHOU"):
            a.estado = "AUTORIZADA"
            return True
        return super()._evento_da_acao(a, ev)


# ---------------------------------------------------------------------------- regra 10: nada pronto com informação velha
class DecisaoNovaNaoRefazNada(Referencia):
    """A decisão muda e as etapas aprovadas que a usavam continuam aprovadas."""
    def _decisao_reabre(self, e):
        return False


class AjusteNaoRefazQuemDepende(Referencia):
    """Reabrir uma etapa não manda refazer as que dependem dela (o jurídico segue aprovado sobre o texto velho)."""
    def _dependentes_reabrem(self):
        return False


class CardFechaComEtapaPendente(Referencia):
    """O card fica pronto assim que UMA etapa é aprovada."""
    def _todas_aprovadas(self):
        return any(e.estado == "APROVADA" for e in self.etapas.values())


# ---------------------------------------------------------------------------- outras regras
class ToqueAntigoDoFundadorGrava(Referencia):
    """Aprovar, pedir ajuste e responder gravam mesmo com a tela velha (versão que o fundador não viu)."""
    def _chave_vale(self, ev):
        return True


class RespostaAntigaDoAgenteGrava(Referencia):
    """A resposta de uma execução que já passou grava no estado (a chave da execução não é conferida)."""
    def _chave_vale(self, ev):
        return True

    @staticmethod
    def _vivo(e, ev, estado, ator_certo):
        return e.estado == estado and e.exec_viva == 1 and ator_certo


class CardFinalVoltaAAndar(Referencia):
    """Um pedido de ajuste num card pronto reabre o card (em vez de virar card novo ligado)."""
    def _toque_em_card_fechado(self, ev):
        if ev.papel == FUNDADOR and ev.evento == "PEDIR_AJUSTE":
            self.card["estado"] = "EM_ANDAMENTO"
            return Resposta(True)
        return super()._toque_em_card_fechado(ev)


class PausarTudoMudaOEstado(Referencia):
    """Um toque que devia ser só reação (Pausar tudo) mexe num contador do card."""
    def _ao_pausar_tudo(self):
        self.card["ordens"] += 1


class PerguntaDepoisDeLerAInternet(Referencia):
    """Quem leu a internet pode perguntar (devia só entregar ou registrar falha)."""
    def _pode_perguntar(self, e, ev):
        return "PERGUNTAR" in e.cfg.acoes_permitidas and self.card["perguntas"] < 2


class CancelarNaoFechaAsEtapas(Referencia):
    """Card cancelado ou encerrado deixa as etapas e as ações abertas (sem cascata)."""
    def _cancelar_etapas(self):
        return None


class EmResolucaoSemDono(Referencia):
    """Um estado aberto (EM_RESOLUCAO) sem dono nem prazo na tabela."""
    DONOS_E_PRAZOS = {**Referencia.DONOS_E_PRAZOS,
                      "etapa": {k: v for k, v in Referencia.DONOS_E_PRAZOS["etapa"].items() if k != "EM_RESOLUCAO"}}


class ComecaSemAAnteriorAprovada(Referencia):
    """A etapa que depende de outra começa a trabalhar sem esperar a anterior ser aprovada."""
    def _anteriores_aprovadas(self, e):
        return True


class ExecucaoVivaEmDobro(Referencia):
    """O motor inicia uma execução e deixa duas vivas na mesma etapa."""
    def _automatico_da_etapa(self, e):
        passo = super()._automatico_da_etapa(e)
        if passo and passo[1] == "INICIAR_EXECUCAO":
            e.exec_viva = 2
        return passo


class SugestaoDaHelenaMudaOPrazo(Referencia):
    """A Helena sugere um prazo e o prazo do card muda (só o fundador pode mudar)."""
    def _evento_do_card(self, ev):
        if (ev.papel, ev.evento) == ("HELENA", "SUGERIR_PRAZO"):
            self.card["mudancas_prazo"] += 1
            return True
        return super()._evento_do_card(ev)


class ToqueDoFundadorSomeEmSilencio(Referencia):
    """Botão do fundador sem passagem é jogado fora, em vez de virar comentário no card."""
    def _sem_passagem(self, ev):
        resposta = super()._sem_passagem(ev)
        return Resposta(False, "RECUSADO") if resposta.destino == "COMENTARIO_NO_CARD" else resposta


class FalhaDeInfraGastaExecucao(Referencia):
    """Uma queda do processo conta como execução do agente (gasta a cota de 6)."""
    def _falha_de_infra(self, e):
        e.execucoes += 1
        super()._falha_de_infra(e)


class FalhaDeInfraSemTeto(Referencia):
    """A queda se repete para sempre: na 3ª o fundador nunca é chamado e a etapa tenta de novo sem parar."""
    def _falha_de_infra(self, e):
        e.exec_viva = 0
        if e.estado == "EXECUTANDO":
            e.motivo, e.estado = "NORMAL", "NA_FILA"


# ---------------------------------------------------------------------------- a tabela
@dataclass(frozen=True)
class Mutacao:
    classe: type
    invariante: str                   # quem precisa acusar
    roteiro: object                   # roteiro do cenário curto
    cenario: list                     # eventos que revelam o defeito
    descricao: str


def _devolve():
    return autor("DEVOLVER_A_QUEM_PEDIU", "U1", "CAIO", usou_internet="NAO")


MUTACOES = [
    # --- as cinco do pedido
    Mutacao(SemTetoDeExecucoes, "teto_de_execucoes", ROTEIRO_UNICA, formato_errado_seguido(8), "remover o teto de execuções"),
    Mutacao(PortaoAceitaQualquerRevisor, "ninguem_aprova_a_propria_peca", ROTEIRO_PROVA,
            [helena("LER_DE_VOLTA"), entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "ISABELA")],
            "permitir auto-aprovação: o autor vira revisor"),
    Mutacao(QualquerUmAprovaComoRevisor, "ninguem_aprova_a_propria_peca", ROTEIRO_UNICA,
            COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CAIO")],
            "permitir auto-aprovação: o autor aprova como revisor"),
    Mutacao(AutorAprovaAPropriaPeca, "ninguem_aprova_a_propria_peca", ROTEIRO_UNICA,
            COMECO_UNICA + [autor("APROVAR", "U1", "CAIO")], "permitir auto-aprovação: o autor aprova direto"),
    Mutacao(PadraoDoRelogioAprovaAEntrega, "padrao_nunca_aprova", ROTEIRO_UNICA, FUNDADOR_REVISA_E_NAO_RESPONDE,
            "permitir o padrão do relógio aprovar a entrega"),
    Mutacao(PadraoDoRelogioAutorizaAAcao, "padrao_nunca_aprova", ROTEIRO_UNICA,
            PROPOE_ACAO_DO_MOTOR + [relogio("LEMBRETE_24H", "acao:A1"), relogio("PRAZO_ESPERA_VENCIDO", "acao:A1")],
            "permitir o padrão do relógio autorizar a ação externa"),
    Mutacao(AgenteExecutaAcaoExterna, "nada_externo_pelo_agente", ROTEIRO_UNICA,
            PROPOE_ACAO_DO_MOTOR + [autor("EXECUTAR_ACAO", "acao:A1", "CAIO")], "permitir o agente executar a ação externa"),
    Mutacao(EntregaJaExecutaAAcao, "nada_externo_pelo_agente", ROTEIRO_UNICA,
            COMECO_UNICA + [entrega("U1", "CAIO", acao_externa="PELO_MOTOR")],
            "a entrega do agente cria a ação já em execução"),
    Mutacao(DecisaoNovaNaoRefazNada, "pronto_sem_informacao_velha", ROTEIRO_PROVA, DECISAO_MUDA_COM_E1_APROVADA,
            "deixar etapa aprovada sobre decisão velha"),
    Mutacao(AjusteNaoRefazQuemDepende, "pronto_sem_informacao_velha", ROTEIRO_PROVA, AJUSTE_EM_E2_COM_EJ_APROVADA,
            "deixar etapa aprovada sobre a anterior que voltou a ser refeita"),
    Mutacao(CardFechaComEtapaPendente, "pronto_sem_informacao_velha", ROTEIRO_PROVA, PROVA_E1_APROVADA,
            "card pronto com etapas ainda em andamento"),
    # --- as demais regras
    Mutacao(SemTetoComContadorMentiroso, "teto_de_execucoes", ROTEIRO_UNICA, formato_errado_seguido(12),
            "sem teto e com o contador do alvo mentindo"),
    Mutacao(SemTetoDeOrdens, "contadores_dentro_do_teto", ROTEIRO_PROVA, ajustes_seguidos(4),
            "remover o teto de ordens do fundador"),
    Mutacao(AcaoNasceAntesDoCardPronto, "nada_externo_pelo_agente", ROTEIRO_UNICA,
            COMECO_UNICA + [entrega("U1", "CAIO", acao_externa="PELO_MOTOR")], "a ação nasce antes do card pronto"),
    Mutacao(AcaoQueFalhaVoltaEExecutaOutraVez, "nada_externo_pelo_agente", ROTEIRO_UNICA, ACAO_AUTORIZADA_E_FALHA,
            "a ação de fora é executada uma segunda vez"),
    Mutacao(ToqueAntigoDoFundadorGrava, "resposta_antiga_nao_grava", ROTEIRO_UNICA,
            COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "FUNDADOR"), fundador("APROVAR", "U1", chave="antiga")],
            "toque do fundador com versão velha grava"),
    Mutacao(RespostaAntigaDoAgenteGrava, "resposta_antiga_nao_grava", ROTEIRO_UNICA,
            COMECO_UNICA + [entrega("U1", "CAIO", chave="antiga")], "resposta atrasada do agente grava"),
    Mutacao(CardFinalVoltaAAndar, "card_final_nao_volta", ROTEIRO_UNICA,
            FELIZ_UNICA + [fundador("PEDIR_AJUSTE", "U1", motivo_ajuste="TOM")], "card pronto volta a andar"),
    Mutacao(PausarTudoMudaOEstado, "recusa_nao_muda_nada", ROTEIRO_UNICA, COMECO_UNICA + [fundador("PAUSAR_TUDO")],
            "uma reação muda o estado do card"),
    Mutacao(PerguntaDepoisDeLerAInternet, "quem_leu_internet_so_entrega", ROTEIRO_UNICA,
            COMECO_UNICA + [autor("PERGUNTAR", "U1", "CAIO", usou_internet="SIM")], "quem leu a internet consegue perguntar"),
    Mutacao(CancelarNaoFechaAsEtapas, "etapas_seguem_o_card", ROTEIRO_UNICA, COMECO_UNICA + [fundador("CANCELAR")],
            "cancelar o card não cancela as etapas"),
    Mutacao(ComecaSemAAnteriorAprovada, "ninguem_trabalha_sem_a_anterior", ROTEIRO_PROVA, [helena("LER_DE_VOLTA")],
            "a etapa começa sem a anterior aprovada"),
    Mutacao(ExecucaoVivaEmDobro, "uma_execucao_viva_por_etapa", ROTEIRO_UNICA, COMECO_UNICA, "duas execuções vivas na mesma etapa"),
    Mutacao(SugestaoDaHelenaMudaOPrazo, "so_o_fundador_muda_o_prazo", ROTEIRO_UNICA,
            COMECO_UNICA + [helena("SUGERIR_PRAZO")], "a sugestão da Helena muda o prazo"),
    Mutacao(ToqueDoFundadorSomeEmSilencio, "todo_toque_do_fundador_tem_destino", ROTEIRO_UNICA,
            COMECO_UNICA + [fundador("APROVAR", "U1")], "botão do fundador jogado fora sem destino"),
    Mutacao(FalhaDeInfraGastaExecucao, "infra_nao_gasta_execucao", ROTEIRO_UNICA,
            COMECO_UNICA + [vigia("SEM_EXECUCAO_VIVA", "U1")], "queda do processo gasta execução"),
    Mutacao(FalhaDeInfraSemTeto, "teto_de_execucoes", ROTEIRO_UNICA,
            COMECO_UNICA + [vigia("SEM_EXECUCAO_VIVA", "U1")] * 12, "queda sem teto: o fundador nunca é chamado"),
    Mutacao(EmResolucaoSemDono, "dono_e_prazo", ROTEIRO_UNICA, COMECO_UNICA + [_devolve()],
            "estado aberto sem dono nem prazo"),
]
