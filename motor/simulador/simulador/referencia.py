"""Implementação de REFERÊNCIA do estado do card: pequena, própria e fácil de ler.

Serve para o simulador ser testável sozinho, sem a máquina real. É MAIS SIMPLES que a máquina
de passagens (helena-v2/maquina): só tem o teto geral de 6 execuções e o de infraestrutura,
não tem motivo CAPACIDADE, plano inválido, divisão de etapa nem "pular". O que importa é que as
regras que as invariantes vigiam estejam aqui, certas.

Diferenças CONHECIDAS em relação à máquina real (os testes de cenário só usam o que as duas fazem igual):
  - formato errado, tempo esgotado e limite de chamadas: a máquina dá UMA nova tentativa de cada e depois manda
    para "em resolução"; aqui a etapa tenta de novo até o teto geral de 6 execuções;
  - jurídico (etapa que julga outra): na máquina o fundador é o segundo revisor, e só o Aprovar dele vale; aqui
    o revisor da etapa julgadora já aprova;
  - falha de cota ou login: a máquina põe a etapa na fila com motivo CAPACIDADE; aqui conta como infraestrutura comum.

Cada ponto de decisão que uma invariante vigia é um método pequeno (começa com "_" e tem
nome de regra). Os testes de mutação criam subclasses que estragam UM desses métodos e provam
que o verificador pega o defeito. Por isso: não junte esses métodos.
"""
from dataclasses import dataclass

from .alvo import Alvo
from .eventos import Foto, FotoAcao, FotoEtapa, Resposta
from .vocabulario import (
    BOTOES_COM_VERSAO, CARD_ATIVO, CARD_FINAIS, ESTADOS, ETAPA_FINAIS, EVENTOS_DO_PAPEL, FUNDADOR, TETO_EXECUCOES,
    TETO_INFRA, TETO_LEMBRETES, TETO_MUDANCAS_PRAZO, TETO_ORDENS, TETO_PERGUNTAS, TETO_REPROVACOES,
    CLASSES_DE_FALHA,
)

# Quem é o dono e qual é o prazo de cada estado aberto (passagens.yaml, bloco "estados").
DONOS_E_PRAZOS = {
    "card": {
        "RASCUNHO": ("HELENA", "leitura_de_volta"),
        "ESPERANDO_CONFIRMACAO": ("FUNDADOR", "espera_do_fundador"),
        "VALIDANDO_PLANO": ("MOTOR", "na_hora"),
        "EM_ANDAMENTO": ("HELENA", "prazo_do_card"),
        "ESPERANDO_FUNDADOR": ("FUNDADOR", "espera_do_fundador"),
    },
    "etapa": {
        "AGUARDANDO_ANTERIORES": ("HELENA", "prazo_do_card"),
        "NA_FILA": ("AUTOR", "prazo_do_card"),
        "EXECUTANDO": ("AUTOR", "tempo_maximo_da_ficha"),
        "VALIDACAO": ("MOTOR", "na_hora"),
        "REVISAO": ("REVISOR", "prazo_da_revisao"),
        "ESPERANDO_FUNDADOR": ("FUNDADOR", "espera_do_fundador"),
        "EM_RESOLUCAO": ("HELENA", "recomendacao_da_helena"),
        "APROVADA": ("HELENA", "prazo_do_card"),
    },
    "acao_externa": {
        "PROPOSTA": ("FUNDADOR", "espera_do_fundador"),
        "AUTORIZADA": ("MOTOR", "na_hora"),
        "EXECUTANDO_ACAO": ("MOTOR", "execucao_da_acao"),
        "INCERTA": ("FUNDADOR", "espera_do_fundador"),
    },
}


@dataclass
class _Etapa:
    cfg: object                       # a Etapa do roteiro
    estado: str = "AGUARDANDO_ANTERIORES"
    motivo: str = "NENHUM"
    execucoes: int = 0                # regra 5: autor + revisor, no máximo TETO_EXECUCOES por rodada
    exec_viva: int = 0                # 1 enquanto um agente trabalha (só ele grava: regra 3)
    infra: int = 0                    # regra 12: falhas de infraestrutura (não gastam execução)
    reprovacoes: int = 0
    revisor: str = "NENHUM"
    semaforo: str = "NENHUM"
    fim: str = "NENHUM"
    lembretes: int = 0
    proposta: str = "NENHUMA"         # ação externa que a entrega propõe (só vira ação no card pronto)


@dataclass
class _Acao:
    id: str
    origem: str
    tem_ferramenta: bool
    estado: str = "PROPOSTA"
    ok_registrado: int = 0
    tentativas: int = 0
    lembretes: int = 0


def _proximo_lembrete(lembretes, evento):
    """Lembrete em 24h e depois em 48h. Devolve o novo contador, ou None se o evento veio fora de hora."""
    if evento == "LEMBRETE_24H" and lembretes == 0:
        return 1
    if evento == "LEMBRETE_48H" and lembretes == 1:
        return 2
    return None


class Referencia(Alvo):
    nome = "referencia"
    DONOS_E_PRAZOS = DONOS_E_PRAZOS

    def __init__(self):
        self._etapa_por_evento = {
            ("AUTOR", "ENTREGAR"): self._autor_entrega,
            ("AUTOR", "PERGUNTAR"): self._autor_pergunta,
            ("AUTOR", "DEVOLVER_A_QUEM_PEDIU"): self._autor_devolve,
            ("AUTOR", "REGISTRAR_FALHA"): self._autor_registra_falha,
            ("REVISOR", "APROVAR"): self._revisor_aprova,
            ("REVISOR", "REPROVAR"): self._revisor_reprova,
            ("REVISOR", "NAO_CONSIGO_CONFERIR"): self._revisor_nao_consigo,
            ("MOTOR", "PORTAO1_OK"): self._motor_portao1_ok,
            ("MOTOR", "PORTAO1_RECUSOU"): self._motor_portao1_recusou,
            ("MOTOR", "FALHA"): self._motor_falha,
            ("MOTOR", "FALHA_INFRA"): self._motor_falha_de_infra,
            ("VIGIA", "SEM_EXECUCAO_VIVA"): self._vigia_sem_execucao_viva,
            ("RELOGIO", "TEMPO_ESGOTADO"): self._relogio_tempo_esgotado,
            ("RELOGIO", "LEMBRETE_24H"): self._relogio_espera_da_etapa,
            ("RELOGIO", "LEMBRETE_48H"): self._relogio_espera_da_etapa,
            ("RELOGIO", "PRAZO_ESPERA_VENCIDO"): self._relogio_espera_da_etapa,
            ("HELENA", "RECOMENDAR"): self._helena_recomenda,
            ("FUNDADOR", "APROVAR"): self._fundador_aprova,
            ("FUNDADOR", "PEDIR_AJUSTE"): self._fundador_pede_ajuste,
            ("FUNDADOR", "RESPONDER"): self._fundador_responde,
        }
        self.roteiro = None

    # ------------------------------------------------------------------ interface do Alvo
    def iniciar(self, roteiro, pedido_grande=True):
        self.roteiro = roteiro
        self.pedido_grande = pedido_grande
        self.card = {"estado": "RASCUNHO", "motivo": "NENHUM", "ordens": 0, "perguntas": 0, "lembretes": 0,
                     "nivel_prazo": 0, "mudancas_prazo": 0, "fim": "NENHUM"}
        self.etapas = {e.id: _Etapa(e) for e in roteiro.etapas}
        self.acoes = {}
        self.cards_ligados = 0

    def aplicar(self, ev):
        resposta = self._tratar(ev)
        resposta.automaticos = tuple(self._automaticos())
        return resposta

    def foto(self):
        etapas = {i: FotoEtapa(i, e.estado, e.revisor, e.execucoes, e.exec_viva, 0, e.motivo, e.semaforo, e.fim,
                               e.lembretes) for i, e in self.etapas.items()}
        acoes = {i: FotoAcao(i, a.estado, a.origem, a.ok_registrado, a.tentativas, a.lembretes)
                 for i, a in self.acoes.items()}
        return Foto(dict(self.card), etapas, acoes, {m: dict(t) for m, t in self.DONOS_E_PRAZOS.items()})

    # ------------------------------------------------------------------ despacho
    def _tratar(self, ev):
        if not self._evento_conhecido(ev):
            return Resposta(False, "RECUSADO")
        if ev.alvo.startswith("acao:"):
            a = self.acoes.get(ev.alvo[5:])
            if a is None:
                return Resposta(False, "RECUSADO")
        elif ev.alvo != "card" and ev.alvo not in self.etapas:
            return Resposta(False, "RECUSADO")
        if not self._chave_vale(ev):
            return Resposta(False, "COMENTARIO_NO_CARD" if ev.papel == FUNDADOR else "RECUSADO")
        if ev.alvo.startswith("acao:"):
            return Resposta(True) if self._evento_da_acao(a, ev) else self._sem_passagem(ev)
        if self.card["estado"] in CARD_FINAIS:
            return self._toque_em_card_fechado(ev)
        if ev.alvo == "card":
            return Resposta(True) if self._evento_do_card(ev) else self._sem_passagem(ev)
        e = self.etapas[ev.alvo]
        if self.card["estado"] in CARD_ATIVO:       # regra 6: a etapa só anda com o card ativo
            funcao = self._etapa_por_evento.get((ev.papel, ev.evento))
            if funcao and funcao(e, ev):
                return Resposta(True)
            if self._e_resposta_da_execucao_viva(e, ev):     # plano l. 78 e 94: qualquer outra resposta
                self._falha(e, "FORMATO_ERRADO")             # é formato errado
                return Resposta(True, "FORMATO_ERRADO")
        return self._sem_passagem(ev)

    def _sem_passagem(self, ev):
        if self._e_reacao(ev):
            return Resposta(False, "REACAO")
        return Resposta(False, "COMENTARIO_NO_CARD" if ev.papel == FUNDADOR else "RECUSADO")

    def _e_reacao(self, ev):
        """Respostas que não mudam estado (e nunca aprovam nada)."""
        if ev.papel == "FUNDADOR":
            if ev.evento == "PAUSAR_TUDO":
                self._ao_pausar_tudo()
                return True
            if ev.alvo == "card" and ev.evento in ("MUDAR_PRIORIDADE", "MUDAR_PRAZO"):
                return True        # MUDAR_PRAZO só chega aqui acima do teto de mudanças
            if ev.evento == "USAR_COMO_EXEMPLO" and ev.alvo in self.etapas:
                return self.etapas[ev.alvo].estado == "APROVADA"
        if ev.papel == "HELENA" and ev.evento == "SUGERIR_PRAZO":
            return True
        return ev.papel == "VIGIA" and ev.evento == "REGRA_QUEBRADA"

    def _e_resposta_da_execucao_viva(self, e, ev):
        if ev.papel == "AUTOR":
            return self._vivo(e, ev, "EXECUTANDO", ev.ator in (None, e.cfg.autor))
        if ev.papel == "REVISOR":
            return self._vivo(e, ev, "REVISAO", ev.ator == e.revisor)
        return False

    @staticmethod
    def _vivo(e, ev, estado, ator_certo):
        return e.estado == estado and e.exec_viva == 1 and ev.chave == "atual" and ator_certo

    # ------------------------------------------------------------------ pontos de decisão (as mutações estragam estes)
    def _evento_conhecido(self, ev):
        """Evento que o papel não tem no vocabulário nunca entra: nem como passagem, nem como "formato errado"."""
        return ev.evento in EVENTOS_DO_PAPEL.get(ev.papel, ())

    def _todas_aprovadas(self):
        """Regra 9 e 10: o card só fica pronto com TODAS as etapas aprovadas."""
        return all(e.estado == "APROVADA" for e in self.etapas.values())

    def _anteriores_aprovadas(self, e):
        """Regra 6: ninguém trabalha sem a anterior aprovada."""
        return all(self.etapas[d].estado == "APROVADA" for d in e.cfg.depende_de)

    def _pode_executar_a_acao(self, a):
        """Regra 8: só executa depois do ok registrado do fundador, no máximo uma vez."""
        return a.estado == "AUTORIZADA" and a.ok_registrado == 1 and a.tentativas < 1

    def _cabe_mais_uma_execucao(self, e):
        """Regra 5: cada etapa roda no máximo TETO_EXECUCOES vezes por rodada."""
        return e.execucoes < TETO_EXECUCOES

    def _revisor_valido(self, e, escolhido):
        """Regra 4: o revisor nunca é o autor nem quem vai julgar a mesma peça depois."""
        return escolhido in self.roteiro.revisores_validos(e.cfg.id)

    def _destino_do_padrao_da_etapa(self):
        """Regras 8 e 9: o padrão de uma espera vencida NUNCA aprova."""
        return "CANCELADA"

    def _padrao_da_acao(self, a):
        """Regra 8: o padrão de uma ação esquecida expira; nunca executa."""
        a.estado = "EXPIRADA"

    def _chave_vale(self, ev):
        """Resposta de execução que já passou, ou toque do fundador sobre versão que ele não viu, nunca grava.
        Cancelar sempre vale."""
        if ev.chave == "atual":
            return True
        return ev.papel == FUNDADOR and ev.evento not in BOTOES_COM_VERSAO

    def _toque_em_card_fechado(self, ev):
        """Regra 2: card final não volta a andar. O toque do fundador vira card novo ligado ou comentário."""
        if ev.papel != FUNDADOR:
            return Resposta(False, "RECUSADO")
        if ev.evento == "PAUSAR_TUDO" or (ev.evento == "APROVAR" and ev.alvo == "card" and self.card["estado"] == "PRONTO"):
            return Resposta(False, "REACAO")
        if ev.evento in ("RESPONDER", "PEDIR_AJUSTE"):
            self.cards_ligados += 1
            return Resposta(False, "CARD_NOVO_LIGADO")
        return Resposta(False, "COMENTARIO_NO_CARD")

    def _decisao_reabre(self, e):
        """Regra 10: decisão nova faz refazer o que dependia dela."""
        return True

    def _dependentes_reabrem(self):
        """Regra 10: reabrir uma etapa faz refazer quem dependia dela."""
        return True

    def _ao_entregar_proposta(self, e):
        """Regra 8: a ação externa que a entrega propõe só vira proposta no card pronto. O agente nunca age."""

    def _pode_perguntar(self, e, ev):
        """A etapa permite perguntar, ainda cabe pergunta no card e quem leu a internet só entrega."""
        return ("PERGUNTAR" in e.cfg.acoes_permitidas and ev.params.get("usou_internet", "NAO") == "NAO"
                and self.card["perguntas"] < TETO_PERGUNTAS)

    def _cancelar_etapas(self):
        """Cancelamento em cascata: quando o card fecha, as etapas abertas e as ações não executadas fecham junto."""
        for e in self.etapas.values():
            if e.estado not in ETAPA_FINAIS:
                e.estado, e.fim, e.exec_viva = "CANCELADA", "PAI", 0
        for a in self.acoes.values():
            if a.estado in ("PROPOSTA", "AUTORIZADA"):
                a.estado = "CANCELADA"

    def _ao_pausar_tudo(self):
        """Pausar tudo não muda nenhuma passagem."""

    # ------------------------------------------------------------------ card
    def _evento_do_card(self, ev):
        c, est = self.card, self.card["estado"]
        if ev.papel == "FUNDADOR":
            return self._fundador_no_card(ev)
        if ev.papel == "HELENA" and ev.evento == "LER_DE_VOLTA" and est == "RASCUNHO":
            c["estado"] = "ESPERANDO_CONFIRMACAO" if self.pedido_grande else "VALIDANDO_PLANO"
            c["lembretes"] = 0
            return True
        if ev.papel == "MOTOR" and ev.evento == "DECISAO_MUDOU" and est in CARD_ATIVO:
            self._decisao_mudou_no_card()
            return True
        if ev.papel == "RELOGIO":
            return self._relogio_no_card(ev.evento)
        return False

    def _fundador_no_card(self, ev):
        c, est, opcao = self.card, self.card["estado"], ev.params.get("opcao")
        if ev.evento == "CANCELAR" and est in ESTADOS["card"]["abertos"]:
            c["estado"], c["fim"] = "CANCELADO", "FUNDADOR"
            self._cancelar_etapas()
            return True
        if ev.evento == "RESPONDER" and est == "ESPERANDO_CONFIRMACAO" and opcao == "CONFIRMO":
            c["estado"], c["motivo"] = "VALIDANDO_PLANO", "NENHUM"
            return True
        if ev.evento == "RESPONDER" and est == "ESPERANDO_FUNDADOR" and opcao == "ENCERRAR":
            self._encerrar_card()
            return True
        if ev.evento == "MUDAR_PRAZO" and est in ESTADOS["card"]["abertos"] and c["mudancas_prazo"] < TETO_MUDANCAS_PRAZO:
            c["nivel_prazo"], c["mudancas_prazo"] = 0, c["mudancas_prazo"] + 1    # rearma os 3 avisos
            return True
        return False

    def _relogio_no_card(self, evento):
        c, est = self.card, self.card["estado"]
        if est == "RASCUNHO" and evento == "TEMPO_ESGOTADO":
            c["estado"], c["motivo"], c["lembretes"] = "ESPERANDO_CONFIRMACAO", "HELENA_FALHOU", 0
            return True
        niveis = {"PRAZO_80": 1, "PRAZO_VENCIDO": 2, "PRAZO_MAIS_1H": 3}
        if evento in niveis and est in ESTADOS["card"]["abertos"] and c["nivel_prazo"] < niveis[evento]:
            c["nivel_prazo"] = niveis[evento]
            return True
        if est in ("ESPERANDO_CONFIRMACAO", "ESPERANDO_FUNDADOR"):
            novo = _proximo_lembrete(c["lembretes"], evento)
            if novo is not None:
                c["lembretes"] = novo
                return True
            if evento == "PRAZO_ESPERA_VENCIDO" and c["lembretes"] >= TETO_LEMBRETES:
                c["estado"], c["fim"] = "CANCELADO", "PADRAO"        # padrão: cancela, nunca aprova
                self._cancelar_etapas()
                return True
        return False

    def _decisao_mudou_no_card(self):
        if self.card["ordens"] >= TETO_ORDENS:
            self._substituir_card()            # acima do teto de ordens, o card nunca fecha com informação velha
            return
        self.card["ordens"] += 1
        for e in self.etapas.values():
            if e.cfg.usa_decisao and self._usa_a_decisao_agora(e) and self._decisao_reabre(e):
                self._reabrir(e)

    @staticmethod
    def _usa_a_decisao_agora(e):
        return (e.estado in ("APROVADA", "NA_FILA", "EXECUTANDO", "VALIDACAO", "REVISAO")
                or (e.estado == "ESPERANDO_FUNDADOR" and e.motivo == "REVISAO"))

    def _substituir_card(self):
        self.card["estado"], self.card["fim"] = "CANCELADO", "SUBSTITUIDO"
        self.cards_ligados += 1
        self._cancelar_etapas()

    def _encerrar_card(self):
        self.card["estado"], self.card["fim"] = "ENCERRADO_COM_FALHA", "FUNDADOR"
        self._cancelar_etapas()

    def _card_pronto(self):
        """Sinal CARD_PRONTO: etapas aprovadas ficam prontas; só agora nascem as ações externas propostas."""
        for e in self.etapas.values():
            if e.estado == "APROVADA":
                e.estado, e.fim = "PRONTA", "CARD_PRONTO"
                if e.proposta != "NENHUMA":
                    id_ = f"A{len(self.acoes) + 1}"
                    self.acoes[id_] = _Acao(id_, e.cfg.id, tem_ferramenta=(e.proposta == "PELO_MOTOR"))

    # ------------------------------------------------------------------ etapa: ajudantes
    @staticmethod
    def _limpar_entrega(e):
        e.revisor, e.semaforo, e.proposta = "NENHUM", "NENHUM", "NENHUMA"

    def _nova_rodada(self, e):
        """Ordem do fundador: zera as tentativas da etapa (não zera as ordens do card)."""
        e.execucoes = e.infra = e.reprovacoes = e.lembretes = e.exec_viva = 0
        e.motivo = "NORMAL"
        self._limpar_entrega(e)

    def _reabrir(self, e):
        era_aprovada = e.estado == "APROVADA"
        self._nova_rodada(e)
        e.estado = "NA_FILA"
        if era_aprovada:
            self._dependentes_mudaram(e.cfg.id)

    def _dependentes_mudaram(self, id_):
        if not self._dependentes_reabrem():
            return
        for d in self.etapas.values():
            if id_ in d.cfg.depende_de and d.estado not in ETAPA_FINAIS and d.estado != "AGUARDANDO_ANTERIORES":
                era_aprovada = d.estado == "APROVADA"
                d.exec_viva, d.motivo, d.estado = 0, "NENHUM", "AGUARDANDO_ANTERIORES"
                self._limpar_entrega(d)
                if era_aprovada:
                    self._dependentes_mudaram(d.cfg.id)

    def _esperar_o_fundador(self, e, motivo):
        e.estado, e.motivo, e.lembretes = "ESPERANDO_FUNDADOR", motivo, 0

    def _abrir_rodada_por_ordem(self, e):
        """Ordem sua que reabre o trabalho. Acima do teto de ordens o card é substituído por um card novo ligado."""
        if self.card["ordens"] < TETO_ORDENS:
            self.card["ordens"] += 1
            self._reabrir(e)
        else:
            e.estado, e.fim, e.exec_viva = "CANCELADA", "SUBSTITUIDO", 0
            self._substituir_card()
        return True

    def _falha(self, e, classe):
        """Falha da execução viva, por classe. Gasta uma execução (regra 5)."""
        e.execucoes += 1
        e.exec_viva = 0
        repetivel = classe in ("FORMATO_ERRADO", "LIMITE_CHAMADAS")
        if e.estado == "EXECUTANDO":
            e.motivo, e.estado = ("NORMAL", "NA_FILA") if repetivel else ("NENHUM", "EM_RESOLUCAO")
        elif not repetivel:                       # na revisão, repetível = o revisor tenta de novo
            self._limpar_entrega(e)
            e.motivo, e.estado = "NENHUM", "EM_RESOLUCAO"

    def _falha_de_infra(self, e):
        """Regra 12: falha de infraestrutura não gasta execução; na 3ª da rodada chama o fundador."""
        e.exec_viva = 0
        if e.infra < TETO_INFRA - 1:
            e.infra += 1
            if e.estado == "EXECUTANDO":
                e.motivo, e.estado = "NORMAL", "NA_FILA"
        else:
            e.infra = TETO_INFRA
            self._limpar_entrega(e)
            self._esperar_o_fundador(e, "INFRA")

    # ------------------------------------------------------------------ etapa: o que cada papel pode fazer
    def _autor_entrega(self, e, ev):
        if not self._vivo(e, ev, "EXECUTANDO", ev.ator in (None, e.cfg.autor)) or ev.params.get("parecer", "OK") != "OK":
            return False
        e.execucoes += 1
        e.exec_viva, e.semaforo, e.estado = 0, "OK", "VALIDACAO"
        e.proposta = ev.params.get("acao_externa", "NENHUMA")
        self._ao_entregar_proposta(e)
        return True

    def _autor_pergunta(self, e, ev):
        if not self._vivo(e, ev, "EXECUTANDO", ev.ator in (None, e.cfg.autor)) or not self._pode_perguntar(e, ev):
            return False
        e.execucoes += 1
        e.exec_viva = 0
        self.card["perguntas"] += 1
        self._esperar_o_fundador(e, "PERGUNTA")
        return True

    def _autor_devolve(self, e, ev):
        permitido = "DEVOLVER_A_QUEM_PEDIU" in e.cfg.acoes_permitidas and ev.params.get("usou_internet", "NAO") == "NAO"
        if not self._vivo(e, ev, "EXECUTANDO", ev.ator in (None, e.cfg.autor)) or not permitido:
            return False
        e.execucoes += 1
        e.exec_viva, e.motivo, e.estado = 0, "NENHUM", "EM_RESOLUCAO"
        return True

    def _autor_registra_falha(self, e, ev):
        if not self._vivo(e, ev, "EXECUTANDO", ev.ator in (None, e.cfg.autor)):
            return False
        e.execucoes += 1
        e.exec_viva, e.motivo, e.estado = 0, "NENHUM", "EM_RESOLUCAO"
        return True

    def _revisor_aprova(self, e, ev):
        if not self._vivo(e, ev, "REVISAO", ev.ator == e.revisor):
            return False
        e.execucoes += 1
        e.exec_viva, e.estado = 0, "APROVADA"
        return True

    def _revisor_reprova(self, e, ev):
        if not self._vivo(e, ev, "REVISAO", ev.ator == e.revisor):
            return False
        e.execucoes += 1
        e.exec_viva = 0
        self._limpar_entrega(e)
        if e.reprovacoes < TETO_REPROVACOES:         # volta ao autor com os critérios reprovados
            e.reprovacoes += 1
            e.motivo, e.estado = "NORMAL", "NA_FILA"
        else:
            e.motivo, e.estado = "NENHUM", "EM_RESOLUCAO"
        return True

    def _revisor_nao_consigo(self, e, ev):
        if not self._vivo(e, ev, "REVISAO", ev.ator == e.revisor):
            return False
        e.execucoes += 1
        e.exec_viva, e.revisor = 0, FUNDADOR
        self._esperar_o_fundador(e, "REVISAO")
        return True

    def _motor_portao1_ok(self, e, ev):
        escolhido = ev.params.get("escolhido")
        if e.estado != "VALIDACAO" or not self._revisor_valido(e, escolhido):
            return False
        e.revisor = escolhido
        if escolhido == FUNDADOR:
            self._esperar_o_fundador(e, "REVISAO")
        else:
            e.estado, e.exec_viva = "REVISAO", 0
        return True

    def _motor_portao1_recusou(self, e, ev):
        if e.estado != "VALIDACAO":
            return False
        self._limpar_entrega(e)
        e.motivo, e.estado = "NORMAL", "NA_FILA"
        return True

    def _motor_falha(self, e, ev):
        classe = ev.params.get("classe")
        if classe not in CLASSES_DE_FALHA or e.estado not in ("EXECUTANDO", "REVISAO") or e.exec_viva != 1:
            return False
        self._falha(e, classe)
        return True

    def _motor_falha_de_infra(self, e, ev):
        if e.estado == "VALIDACAO" or (e.estado in ("EXECUTANDO", "REVISAO") and e.exec_viva == 1):
            self._falha_de_infra(e)
            return True
        return False

    def _vigia_sem_execucao_viva(self, e, ev):
        if e.estado in ("EXECUTANDO", "REVISAO") and e.exec_viva == 1:
            self._falha_de_infra(e)
            return True
        return False

    def _relogio_tempo_esgotado(self, e, ev):
        if e.estado == "EXECUTANDO" and e.exec_viva == 1:
            e.execucoes += 1
            e.exec_viva, e.motivo, e.estado = 0, "NORMAL", "NA_FILA"
        elif e.estado == "REVISAO" and e.exec_viva == 1:
            e.execucoes += 1
            e.exec_viva = 0
        elif e.estado == "VALIDACAO":
            self._falha_de_infra(e)
        elif e.estado == "EM_RESOLUCAO":
            self._esperar_o_fundador(e, "RESOLUCAO")
        else:
            return False
        return True

    def _relogio_espera_da_etapa(self, e, ev):
        if e.estado != "ESPERANDO_FUNDADOR":
            return False
        novo = _proximo_lembrete(e.lembretes, ev.evento)
        if novo is not None:
            e.lembretes = novo
            return True
        if ev.evento == "PRAZO_ESPERA_VENCIDO" and e.lembretes >= TETO_LEMBRETES:
            e.estado, e.fim, e.motivo = self._destino_do_padrao_da_etapa(), "PADRAO", "NENHUM"
            return True
        return False

    def _helena_recomenda(self, e, ev):
        opcao = ev.params.get("opcao")
        if e.estado != "EM_RESOLUCAO" or ev.chave != "atual":
            return False
        if opcao == "ENCERRAR" or (opcao == "REFAZER" and self.card["ordens"] < TETO_ORDENS):
            self._esperar_o_fundador(e, "RESOLUCAO")
            return True
        return False

    def _fundador_aprova(self, e, ev):
        if e.estado == "ESPERANDO_FUNDADOR" and e.motivo == "REVISAO":
            e.estado, e.motivo = "APROVADA", "NENHUM"
            return True
        return False

    def _fundador_pede_ajuste(self, e, ev):
        if (e.estado == "ESPERANDO_FUNDADOR" and e.motivo == "REVISAO") or e.estado == "APROVADA":
            return self._abrir_rodada_por_ordem(e)
        return False

    def _fundador_responde(self, e, ev):
        opcao = ev.params.get("opcao")
        if e.estado != "ESPERANDO_FUNDADOR":
            return False
        if e.motivo == "PERGUNTA" and opcao in ("RESPOSTA_A", "RESPOSTA_B", "RESPOSTA_C"):
            e.motivo, e.estado = "NORMAL", "NA_FILA"
            return True
        if e.motivo in ("RESOLUCAO", "INFRA") and opcao == "ENCERRAR":
            e.estado, e.fim, e.motivo = "ENCERRADA_COM_FALHA", "ENCERRAR_CARD", "NENHUM"
            self._encerrar_card()
            return True
        if (e.motivo == "RESOLUCAO" and opcao == "REFAZER") or (e.motivo == "INFRA" and opcao in ("ESPERAR", "MODELO_MENOR")):
            return self._abrir_rodada_por_ordem(e)
        return False

    # ------------------------------------------------------------------ ação externa
    def _evento_da_acao(self, a, ev):
        papel, nome, opcao = ev.papel, ev.evento, ev.params.get("opcao")
        fundador = papel == FUNDADOR
        if a.estado == "PROPOSTA":
            if fundador and nome == "APROVAR" and a.tem_ferramenta:
                a.estado, a.ok_registrado = "AUTORIZADA", 1
            elif fundador and nome == "RESPONDER" and opcao == "FEITO_POR_MIM":
                a.estado = "FEITA_PELO_FUNDADOR"
            elif fundador and nome == "CANCELAR":
                a.estado = "RECUSADA"
            elif papel == "RELOGIO" and nome == "LEMBRETE_24H" and a.lembretes == 0:
                a.lembretes = 1
            elif papel == "RELOGIO" and nome == "PRAZO_ESPERA_VENCIDO" and a.lembretes >= 1:
                self._padrao_da_acao(a)
            else:
                return False
        elif a.estado == "AUTORIZADA":
            if fundador and nome == "CANCELAR":
                a.estado = "RECUSADA"
            elif papel == "RELOGIO" and nome == "TEMPO_ESGOTADO":
                a.estado = "EXPIRADA"                # o ok vence e nada foi feito
            else:
                return False
        elif a.estado == "EXECUTANDO_ACAO":
            if papel == "MOTOR" and nome == "ACAO_CONCLUIDA":
                a.estado = "EXECUTADA"
            elif papel == "MOTOR" and nome == "ACAO_FALHOU":
                a.estado = "FALHOU"
            elif papel == "RELOGIO" and nome == "TEMPO_ESGOTADO":
                a.estado, a.lembretes = "INCERTA", 0   # sem confirmação nunca se repete: você confere
            else:
                return False
        elif a.estado == "INCERTA":
            novo = _proximo_lembrete(a.lembretes, nome) if papel == "RELOGIO" else None
            if fundador and nome == "RESPONDER" and opcao == "ACONTECEU":
                a.estado = "EXECUTADA"
            elif fundador and nome == "RESPONDER" and opcao == "NAO_ACONTECEU":
                a.estado = "FALHOU"
            elif novo is not None:
                a.lembretes = novo
            elif papel == "RELOGIO" and nome == "PRAZO_ESPERA_VENCIDO" and a.lembretes >= TETO_LEMBRETES:
                a.estado = "NAO_CONFIRMADA"          # pode ter acontecido: nunca é refeita
            else:
                return False
        else:
            return False
        return True

    # ------------------------------------------------------------------ eventos do motor que andam sozinhos
    def _automaticos(self):
        feitos = []
        for _ in range(1000):
            passo = self._um_automatico()
            if passo is None:
                return feitos
            feitos.append(passo)
        raise RuntimeError("eventos automáticos não pararam (laço)")

    def _um_automatico(self):
        c = self.card
        if c["estado"] == "VALIDANDO_PLANO":
            c["estado"] = "EM_ANDAMENTO"
            return ("MOTOR", "PLANO_VALIDO", "card")
        if c["estado"] == "EM_ANDAMENTO":
            if self._todas_aprovadas():
                c["estado"], c["fim"] = "PRONTO", "CARD_PRONTO"
                self._card_pronto()
                return ("MOTOR", "TODAS_PRONTAS", "card")
            if any(e.estado == "CANCELADA" and e.fim == "PADRAO" for e in self.etapas.values()):
                c["estado"], c["motivo"], c["lembretes"] = "ESPERANDO_FUNDADOR", "DEPENDENCIA", 0
                return ("MOTOR", "PERGUNTAR_AO_FUNDADOR", "card")
        if c["estado"] in CARD_ATIVO:
            for e in self.etapas.values():
                passo = self._automatico_da_etapa(e)
                if passo:
                    return passo
        for a in self.acoes.values():
            if self._pode_executar_a_acao(a):
                a.estado, a.tentativas = "EXECUTANDO_ACAO", a.tentativas + 1
                return ("MOTOR", "EXECUTAR_ACAO", f"acao:{a.id}")
        return None

    def _automatico_da_etapa(self, e):
        i = e.cfg.id
        if e.estado == "AGUARDANDO_ANTERIORES" and self._anteriores_aprovadas(e):
            e.estado, e.motivo = "NA_FILA", "NORMAL"
            return ("MOTOR", "DEPENDENCIAS_PRONTAS", i)
        if e.estado == "NA_FILA" and e.motivo == "NORMAL":
            if self._cabe_mais_uma_execucao(e):
                e.estado, e.exec_viva = "EXECUTANDO", 1
                return ("MOTOR", "INICIAR_EXECUCAO", i)
            e.estado, e.motivo = "EM_RESOLUCAO", "NENHUM"
            return ("MOTOR", "TETO_EXECUCOES", i)
        if e.estado == "REVISAO" and e.exec_viva == 0:
            if self._cabe_mais_uma_execucao(e):
                e.exec_viva = 1
                return ("MOTOR", "INICIAR_REVISAO", i)
            self._limpar_entrega(e)
            e.estado, e.motivo = "EM_RESOLUCAO", "NENHUM"
            return ("MOTOR", "TETO_EXECUCOES", i)
        return None
