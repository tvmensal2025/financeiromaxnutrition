"""O mundo do simulador: o fundador, o relógio, os agentes de mentira e as quedas do motor.

Dada a SEMENTE e a foto do alvo, o Mundo decide os próximos eventos. Tudo sai de um único
random.Random(semente): mesma semente + mesmo alvo = mesma sequência, sempre.

Cada passo escolhe uma CATEGORIA (por peso) e pede a ela os eventos:
  esteira      o sistema andando: Helena lê o pedido, agente trabalha, portão 1, revisor, ação externa
  fundador     o fundador responde ao que está esperando por ele (aprovar, ajustar, responder, cancelar...)
  botao_livre  o fundador aperta qualquer botão, em qualquer hora (inclui cancelar e pausar tudo)
  relogio      prazo 80%, vencido, +1h, lembretes, tempo esgotado
  decisao      o fundador muda uma decisão (as etapas que a usavam são refeitas)
  queda        o motor cai: as execuções vivas somem
  repeticao    o mesmo evento chega duas vezes
  atrasada     resposta de uma execução antiga chega depois (chave antiga)
  ilegal       eventos que o alvo TEM que recusar (revisor proibido, sinal direto, agente agindo fora...)
"""
import dataclasses
import random
from collections import Counter
from dataclasses import dataclass

from . import eventos as ev
from .agentes import COMPORTAMENTOS_DE_AUTOR, COMPORTAMENTOS_DE_REVISOR, AgenteDeMentira, Comportamento
from .motor_falso import RegistroDeRespostas, so_de_agente, traduzir
from .roteiro import ROTEIROS_PRONTOS
from .vocabulario import (
    ACAO_FINAIS, BOTOES_COM_VERSAO, CARD_ATIVO, CARD_FINAIS, ESTADOS, FUNDADOR, MOTIVOS_DE_AJUSTE,
)

CATEGORIAS = ("esteira", "fundador", "botao_livre", "relogio", "decisao", "queda", "repeticao", "atrasada", "ilegal")
PESOS_PADRAO = {"esteira": 10, "fundador": 5, "botao_livre": 1.0, "relogio": 3, "decisao": 0.45, "queda": 0.8,
                "repeticao": 1.0, "atrasada": 1.5, "ilegal": 1.2}
# Só o sistema andando e o fundador respondendo: serve para cenários com agentes roteirizados.
PESOS_SO_ESTEIRA = {c: (PESOS_PADRAO[c] if c in ("esteira", "fundador") else 0) for c in CATEGORIAS}

# Com que frequência cada comportamento aparece no roteiro sorteado de cada agente.
PESOS_AUTOR = {
    Comportamento.ENTREGA_BOA: 14, Comportamento.ENTREGA_COM_ACAO_EXTERNA: 2.5, Comportamento.ENTREGA_GRANDE: 1,
    Comportamento.FORMATO_ERRADO: 1.5, Comportamento.DUAS_ACOES: 1, Comportamento.PERGUNTA_INDEVIDA: 1,
    Comportamento.USA_INTERNET_E_PERGUNTA: 1, Comportamento.PERGUNTA_BOA: 1.5, Comportamento.DEVOLVE: 0.5,
    Comportamento.REGISTRA_FALHA: 0.5, Comportamento.TRAVA: 1.5, Comportamento.CAI_NO_MEIO: 1,
    Comportamento.ESTOURA_COTA: 1, Comportamento.PERDE_LOGIN: 1, Comportamento.MUDA_AO_REPETIR: 1,
    Comportamento.RESPOSTA_ATRASADA: 1,
}
PESOS_REVISOR = {
    Comportamento.APROVA_TUDO: 14, Comportamento.RECUSA_TUDO: 2.5, Comportamento.REPROVA_SEM_CRITERIO: 1.5,
    Comportamento.TRAVA: 1, Comportamento.CAI_NO_MEIO: 0.7, Comportamento.ESTOURA_COTA: 0.7,
    Comportamento.PERDE_LOGIN: 0.7, Comportamento.MUDA_AO_REPETIR: 0.7, Comportamento.RESPOSTA_ATRASADA: 0.7,
}


@dataclass
class Cenario:
    """O que se pode fixar numa rodada. O que ficar None é sorteado pela semente."""
    roteiro: object = None            # Roteiro; None sorteia entre os roteiros prontos
    autores: dict = None              # nome do agente -> lista de Comportamento (roteiro de comportamento)
    revisores: dict = None            # idem, para quando o agente revisa
    pedido_grande: bool = None
    pesos: dict = None                # categoria -> peso (completa PESOS_PADRAO)
    passos_depois_do_fim: int = 3     # toques e relógio sobre o card final, que o alvo tem que recusar
    registro: type = RegistroDeRespostas


@dataclass
class Chamada:
    etapa: str
    papel: str                        # AUTOR ou REVISOR
    ator: str
    chave: str


def _sortear_comportamentos(rng, pesos):
    """Roteiro de comportamento de um agente: 1 a 5 comportamentos; o último tem mais chance de ser o bom."""
    bom = max(pesos, key=pesos.get)
    nomes = list(pesos)
    lista = [rng.choices(nomes, [pesos[n] for n in nomes])[0] for _ in range(rng.randint(1, 5))]
    if rng.random() < 0.7:
        lista[-1] = bom
    return lista


class Mundo:
    def __init__(self, semente, cenario=None):
        cenario = cenario or Cenario()
        self.semente = semente
        self.rng = random.Random(semente)
        self.roteiro = cenario.roteiro or self.rng.choice(ROTEIROS_PRONTOS)
        self.pedido_grande = self.rng.random() < 0.7 if cenario.pedido_grande is None else cenario.pedido_grande
        self.pesos = dict(PESOS_PADRAO, **(cenario.pesos or {}))
        autores = sorted({e.autor for e in self.roteiro.etapas})
        revisores = sorted({r for e in self.roteiro.etapas for r in e.revisores if r != FUNDADOR})
        self.autores = {n: AgenteDeMentira(n, (cenario.autores or {}).get(n) or _sortear_comportamentos(self.rng, PESOS_AUTOR))
                        for n in autores}
        self.revisores = {n: AgenteDeMentira(n, (cenario.revisores or {}).get(n) or _sortear_comportamentos(self.rng, PESOS_REVISOR))
                          for n in revisores}
        self.registro = cenario.registro()
        self.sobra_depois_do_fim = cenario.passos_depois_do_fim
        self.em_voo = {}                  # (etapa, papel) -> Chamada ainda sem resposta entregue
        self.orfas = []                   # chamadas que ficaram para trás (resposta pode chegar atrasada)
        self.entregues = []               # (eventos, chamada) das últimas respostas de agente, para repetir
        self.numero = Counter()           # quantas chamadas já houve por (etapa, papel)
        self.parou_por = None
        self.categorias = Counter()       # estatística: quantas vezes cada categoria foi usada
        self.comportamentos = Counter()   # estatística: quantas vezes cada comportamento foi respondido

    # ------------------------------------------------------------------ interface
    def proximos_eventos(self, foto):
        """Os próximos eventos (uma lista), ou [] quando acabou."""
        card_final = foto.card["estado"] in CARD_FINAIS
        if card_final and not any(a.estado not in ACAO_FINAIS for a in foto.acoes.values()):
            if self.sobra_depois_do_fim <= 0:
                self.parou_por = "final"
                return []
            self.sobra_depois_do_fim -= 1
            return self._depois_do_fim(foto)
        sorteio = {c: self.rng.random() ** (1.0 / self.pesos[c]) if self.pesos.get(c, 0) > 0 else -1 for c in CATEGORIAS}
        for categoria in sorted(CATEGORIAS, key=lambda c: -sorteio[c]):
            if sorteio[categoria] < 0:
                continue
            eventos = getattr(self, "_cat_" + categoria)(foto)
            if eventos:
                self.categorias[categoria] += 1
                return eventos
        self.parou_por = "sem_movimento"
        return []

    def observar(self, evento, resposta, foto):
        """Chamado depois de cada evento aplicado: abre as chamadas dos agentes que o alvo acabou de iniciar
        e dá como perdidas as que não estão mais vivas."""
        for _papel, nome, alvo in resposta.automaticos:
            if nome in ("INICIAR_EXECUCAO", "INICIAR_REVISAO"):
                papel = "AUTOR" if nome == "INICIAR_EXECUCAO" else "REVISOR"
                self._perder(self.em_voo.pop((alvo, papel), None))
                self._abrir_chamada(foto, alvo, papel)
        for (etapa, papel), chamada in list(self.em_voo.items()):
            e = foto.etapas[etapa]
            vivo = e.exec_viva == 1 and e.estado == ("EXECUTANDO" if papel == "AUTOR" else "REVISAO")
            if not vivo:
                self._perder(self.em_voo.pop((etapa, papel)))

    # ------------------------------------------------------------------ chamadas de agente
    def _abrir_chamada(self, foto, etapa, papel):
        self.numero[(etapa, papel)] += 1
        ator = self.roteiro.etapa(etapa).autor if papel == "AUTOR" else foto.etapas[etapa].revisor
        chamada = Chamada(etapa, papel, ator, f"{etapa}/{papel}/{self.numero[(etapa, papel)]}")
        self.em_voo[(etapa, papel)] = chamada
        return chamada

    def _perder(self, chamada):
        if chamada is not None:
            self.orfas = (self.orfas + [chamada])[-4:]

    def _agente(self, chamada):
        if chamada.papel == "AUTOR":
            return self.autores[chamada.ator]
        if chamada.ator not in self.revisores:       # revisor que o roteiro não previa: aprova tudo
            self.revisores[chamada.ator] = AgenteDeMentira(chamada.ator, [Comportamento.APROVA_TUDO])
        return self.revisores[chamada.ator]

    def _resposta_da(self, chamada):
        resposta = self.registro.obter(chamada.chave, self._agente(chamada))
        return resposta

    # ------------------------------------------------------------------ categorias
    def _cat_esteira(self, foto):
        itens = []
        if foto.card["estado"] == "RASCUNHO":
            itens.append(("helena_le", "card"))
        for i in self.roteiro.ids():
            e = foto.etapas[i]
            if e.estado == "EXECUTANDO" and e.exec_viva == 1:
                itens.append(("agente", (i, "AUTOR")))
            elif e.estado == "REVISAO" and e.exec_viva == 1:
                itens.append(("agente", (i, "REVISOR")))
            elif e.estado == "VALIDACAO":
                itens.append(("portao", i))
            elif e.estado == "EM_RESOLUCAO":
                itens.append(("helena_recomenda", i))
            elif e.estado == "NA_FILA" and e.motivo == "CAPACIDADE":
                itens.append(("capacidade", i))
        itens += [("acao", i) for i in sorted(foto.acoes) if foto.acoes[i].estado == "EXECUTANDO_ACAO"]
        if not itens:
            return None
        tipo, alvo = self.rng.choice(itens)
        return getattr(self, "_esteira_" + tipo)(foto, alvo)

    def _esteira_helena_le(self, foto, _alvo):
        return [ev.relogio("TEMPO_ESGOTADO")] if self.rng.random() < 0.1 else [ev.helena("LER_DE_VOLTA")]

    def _esteira_agente(self, foto, alvo):
        etapa, papel = alvo
        chamada = self.em_voo.get((etapa, papel)) or self._abrir_chamada(foto, etapa, papel)
        resposta = self._resposta_da(chamada)
        self.comportamentos[resposta.tipo] += 1
        del self.em_voo[(etapa, papel)]
        if resposta.atrasada:                 # deram a execução como perdida; a resposta só chega depois
            self._perder(chamada)
            return [ev.relogio("TEMPO_ESGOTADO", etapa)]
        eventos = traduzir(papel, etapa, chamada.ator, resposta)
        self.entregues = (self.entregues + [(eventos, chamada)])[-6:]
        return eventos

    def _esteira_portao(self, foto, etapa):
        if self.rng.random() < 0.06:
            return [ev.motor("PORTAO1_RECUSOU", etapa)]
        validos = self.roteiro.revisores_validos(etapa)
        escolhido = validos[0] if len(validos) == 1 or self.rng.random() < 0.7 else self.rng.choice(validos)
        return [ev.motor("PORTAO1_OK", etapa, escolhido=escolhido)]

    def _esteira_helena_recomenda(self, foto, etapa):
        if self.rng.random() < 0.2:
            return [ev.relogio("TEMPO_ESGOTADO", etapa)]       # a Helena não respondeu em 30 minutos
        return [ev.helena("RECOMENDAR", etapa, opcao=self.rng.choice(["REFAZER", "REFAZER", "ENCERRAR", "SEGUIR_SEM"]))]

    def _esteira_capacidade(self, foto, etapa):
        return [self.rng.choice([ev.motor("CAPACIDADE_VOLTOU", etapa), ev.relogio("AVISO_1H", etapa),
                                 ev.relogio("ESPERA_6H", etapa)])]

    def _esteira_acao(self, foto, id_):
        sorte = self.rng.random()
        alvo = f"acao:{id_}"
        if sorte < 0.6:
            return [ev.motor("ACAO_CONCLUIDA", alvo)]
        return [ev.motor("ACAO_FALHOU", alvo)] if sorte < 0.8 else [ev.relogio("TEMPO_ESGOTADO", alvo)]

    # --- o fundador responde ao que espera por ele
    def _cat_fundador(self, foto):
        itens = []
        if foto.card["estado"] == "ESPERANDO_CONFIRMACAO":
            itens.append(("card_confirma", "card"))
        if foto.card["estado"] == "ESPERANDO_FUNDADOR":
            itens.append(("card_pergunta", "card"))
        itens += [("etapa", i) for i in self.roteiro.ids() if foto.etapas[i].estado == "ESPERANDO_FUNDADOR"]
        itens += [("acao", i) for i in sorted(foto.acoes) if foto.acoes[i].estado in ("PROPOSTA", "INCERTA")]
        if not itens:
            return None
        tipo, alvo = self.rng.choice(itens)
        evento = getattr(self, "_fundador_" + tipo)(foto, alvo)
        return [self._talvez_versao_antiga(evento)]

    def _talvez_versao_antiga(self, evento):
        """Às vezes o fundador toca sobre uma peça que já mudou (a versão que ele viu é antiga)."""
        if evento.evento in BOTOES_COM_VERSAO and self.rng.random() < 0.1:
            return dataclasses.replace(evento, chave="antiga")
        return evento

    def _fundador_card_confirma(self, foto, _alvo):
        if foto.card["motivo"] == "PLANO_INVALIDO" or self.rng.random() < 0.04:
            return ev.fundador("CANCELAR")
        return ev.fundador("RESPONDER", opcao="CONFIRMO")

    def _fundador_card_pergunta(self, foto, _alvo):
        opcoes = {"DEPENDENCIA": ["PULAR", "REFAZER", "ENCERRAR"], "NAO_PODE": ["REFAZER", "ENCERRAR"]}
        return ev.fundador("RESPONDER", opcao=self.rng.choice(opcoes.get(foto.card["motivo"], ["ENCERRAR"])))

    def _fundador_etapa(self, foto, etapa):
        motivo = foto.etapas[etapa].motivo
        if motivo == "REVISAO":
            if self.rng.random() < 0.75:
                return ev.fundador("APROVAR", etapa)
            return ev.fundador("PEDIR_AJUSTE", etapa, motivo_ajuste=self.rng.choice(MOTIVOS_DE_AJUSTE))
        opcoes = {"PERGUNTA": ["RESPOSTA_A", "RESPOSTA_B", "RESPOSTA_C"], "RESOLUCAO": ["REFAZER", "REFAZER", "ENCERRAR", "SEGUIR_SEM"],
                  "INFRA": ["ESPERAR", "MODELO_MENOR", "ENCERRAR"]}
        return ev.fundador("RESPONDER", etapa, opcao=self.rng.choice(opcoes.get(motivo, ["ENCERRAR"])))

    def _fundador_acao(self, foto, id_):
        alvo = f"acao:{id_}"
        if foto.acoes[id_].estado == "INCERTA":
            return ev.fundador("RESPONDER", alvo, opcao=self.rng.choice(["ACONTECEU", "NAO_ACONTECEU"]))
        sorte = self.rng.random()
        if sorte < 0.5:
            return ev.fundador("APROVAR", alvo)
        return ev.fundador("RESPONDER", alvo, opcao="FEITO_POR_MIM") if sorte < 0.75 else ev.fundador("CANCELAR", alvo)

    # --- o fundador aperta qualquer botão, em qualquer hora
    def _cat_botao_livre(self, foto):
        etapa = self.rng.choice(self.roteiro.ids())
        opcao = self.rng.choice(("CONFIRMO", "REFAZER", "ENCERRAR", "PULAR", "RESPOSTA_A", "ESPERAR"))
        botoes = [
            (0.3, ev.fundador("CANCELAR")),
            (1.5, ev.fundador("PAUSAR_TUDO")),
            (1.0, ev.fundador("USAR_COMO_EXEMPLO", etapa)),
            (0.5, ev.fundador("MUDAR_PRIORIDADE")),
            (1.0, ev.fundador("MUDAR_PRAZO")),
            (0.5, ev.fundador("APROVAR")),
            (1.0, ev.fundador("PEDIR_AJUSTE", etapa, motivo_ajuste=self.rng.choice(MOTIVOS_DE_AJUSTE))),
            (0.3, ev.fundador("PEDIR_AJUSTE", motivo_ajuste=self.rng.choice(MOTIVOS_DE_AJUSTE))),
            (1.5, ev.fundador("RESPONDER", self.rng.choice(["card", etapa]), opcao=opcao)),
        ]
        evento = self.rng.choices([b for _, b in botoes], [w for w, _ in botoes])[0]
        return [self._talvez_versao_antiga(evento)]

    # --- o relógio
    def _cat_relogio(self, foto):
        itens = []
        c = foto.card
        if c["estado"] in ESTADOS["card"]["abertos"]:
            itens.append(("prazo", "card", c["nivel_prazo"], ("PRAZO_80", "PRAZO_VENCIDO", "PRAZO_MAIS_1H")))
        if c["estado"] == "RASCUNHO":
            itens.append(("tempo", "card", 0, ("TEMPO_ESGOTADO",)))
        if c["estado"] in ("ESPERANDO_CONFIRMACAO", "ESPERANDO_FUNDADOR"):
            itens.append(("prazo", "card", c["lembretes"], ("LEMBRETE_24H", "LEMBRETE_48H", "PRAZO_ESPERA_VENCIDO")))
        for i in self.roteiro.ids():
            e = foto.etapas[i]
            if e.estado == "ESPERANDO_FUNDADOR":
                itens.append(("prazo", i, e.lembretes, ("LEMBRETE_24H", "LEMBRETE_48H", "PRAZO_ESPERA_VENCIDO")))
            elif e.estado in ("EXECUTANDO", "REVISAO", "VALIDACAO", "EM_RESOLUCAO"):
                itens.append(("tempo", i, 0, ("TEMPO_ESGOTADO",)))
        for i in sorted(foto.acoes):
            a = foto.acoes[i]
            if a.estado in ("PROPOSTA", "INCERTA"):
                itens.append(("prazo", f"acao:{i}", a.lembretes, ("LEMBRETE_24H", "LEMBRETE_48H", "PRAZO_ESPERA_VENCIDO")))
            elif a.estado in ("AUTORIZADA", "EXECUTANDO_ACAO"):
                itens.append(("tempo", f"acao:{i}", 0, ("TEMPO_ESGOTADO",)))
        if not itens:
            return None
        _tipo, alvo, nivel, nomes = self.rng.choice(itens)
        # normalmente o próximo da fila (80%, depois vencido, depois +1h); às vezes qualquer um, fora de ordem
        nome = nomes[min(nivel, len(nomes) - 1)] if self.rng.random() < 0.75 else self.rng.choice(nomes)
        return [ev.relogio(nome, alvo)]

    def _cat_decisao(self, foto):
        return [ev.motor("DECISAO_MUDOU")] if foto.card["estado"] in CARD_ATIVO else None

    def _cat_queda(self, foto):
        """O motor cai: toda execução viva some, e o vigia dá cada uma como perdida."""
        if not self.em_voo:
            return None
        return [ev.vigia("SEM_EXECUCAO_VIVA", etapa) for (etapa, _papel) in sorted(self.em_voo)]

    def _cat_repeticao(self, foto):
        """A mesma entrega chega duas vezes (o motor retomou depois de uma queda). Ele relê a resposta
        gravada; o agente não é chamado outra vez."""
        if not self.entregues:
            return None
        eventos, chamada = self.rng.choice(self.entregues)
        self._resposta_da(chamada)
        return list(eventos)

    def _cat_atrasada(self, foto):
        if not self.orfas:
            return None
        chamada = self.orfas.pop(self.rng.randrange(len(self.orfas)))
        resposta = self._resposta_da(chamada)
        self.comportamentos[resposta.tipo] += 1
        eventos = so_de_agente(traduzir(chamada.papel, chamada.etapa, chamada.ator, resposta))
        return [dataclasses.replace(e, chave="antiga") for e in eventos] or None

    # --- eventos que o alvo tem que recusar
    def _cat_ilegal(self, foto):
        formas = [self._ilegal_portao_proibido, self._ilegal_auto_aprovacao, self._ilegal_sinal_direto,
                  self._ilegal_entrega_fora_de_hora, self._ilegal_agente_age_fora, self._ilegal_helena_atrasada,
                  self._ilegal_aprovar_sem_pedir, self._ilegal_qualquer]
        self.rng.shuffle(formas)
        for forma in formas:
            evento = forma(foto)
            if evento is not None:
                return [evento]
        return None

    def _ilegal_portao_proibido(self, foto):
        parados = [i for i in self.roteiro.ids() if foto.etapas[i].estado == "VALIDACAO"]
        if not parados:
            return None
        i = self.rng.choice(parados)
        return ev.motor("PORTAO1_OK", i, escolhido=self.rng.choice(self.roteiro.proibidos_de_revisar(i)))

    def _ilegal_auto_aprovacao(self, foto):
        em_revisao = [i for i in self.roteiro.ids() if foto.etapas[i].estado == "REVISAO"]
        if not em_revisao:
            return None
        i = self.rng.choice(em_revisao)
        return ev.revisor("APROVAR", i, self.roteiro.etapa(i).autor)

    def _ilegal_sinal_direto(self, foto):
        """Sinais entre máquinas só existem dentro da passagem que os emite: mandar direto é recusado."""
        etapa = self.rng.choice(self.roteiro.ids())
        return self.rng.choice([
            ev.motor("CANCELADO_PAI", etapa), ev.motor("DEPENDENCIA_MUDOU", etapa), ev.motor("DECISAO_MUDOU", etapa),
            ev.motor("CARD_PRONTO", etapa), ev.motor("ENCERRAR_CARD"), ev.motor("SUBSTITUIR_CARD"),
        ])

    def _ilegal_entrega_fora_de_hora(self, foto):
        parados = [i for i in self.roteiro.ids() if foto.etapas[i].estado != "EXECUTANDO"]
        if not parados:
            return None
        i = self.rng.choice(parados)
        return ev.autor("ENTREGAR", i, self.roteiro.etapa(i).autor, parecer="OK", acao_externa="NENHUMA", usou_internet="NAO")

    def _ilegal_agente_age_fora(self, foto):
        """O agente tenta executar uma ação de fora (nem existe esse evento para ele), ou o motor tenta sem ok."""
        alvo = f"acao:{sorted(foto.acoes)[0]}" if foto.acoes else self.rng.choice(self.roteiro.ids())
        return self.rng.choice([ev.autor("EXECUTAR_ACAO", alvo, "CAIO"), ev.motor("EXECUTAR_ACAO", alvo)])

    def _ilegal_helena_atrasada(self, foto):
        etapa = self.rng.choice(self.roteiro.ids())
        return ev.helena("RECOMENDAR", etapa, chave="antiga", opcao="REFAZER")

    def _ilegal_aprovar_sem_pedir(self, foto):
        """O fundador aprova uma etapa que não está esperando por ele."""
        fora = [i for i in self.roteiro.ids() if not (foto.etapas[i].estado == "ESPERANDO_FUNDADOR" and foto.etapas[i].motivo == "REVISAO")]
        return ev.fundador("APROVAR", self.rng.choice(fora)) if fora else None

    def _ilegal_qualquer(self, foto):
        alvo = self.rng.choice(["card"] + self.roteiro.ids() + [f"acao:{i}" for i in sorted(foto.acoes)])
        etapa = self.rng.choice(self.roteiro.ids())
        return self.rng.choice([
            ev.relogio("LEMBRETE_48H", alvo), ev.relogio("PRAZO_ESPERA_VENCIDO", alvo), ev.relogio("TEMPO_ESGOTADO", alvo),
            ev.vigia("SEM_EXECUCAO_VIVA", etapa), ev.motor("FALHA_INFRA", etapa, classe="QUEDA"),
            ev.motor("FALHA", etapa, classe="FORMATO_ERRADO"), ev.motor("PORTAO1_RECUSOU", etapa),
            ev.revisor("REPROVAR", etapa, self.roteiro.etapa(etapa).autor), ev.motor("ACAO_CONCLUIDA", alvo),
            ev.vigia("REGRA_QUEBRADA"), ev.helena("SUGERIR_PRAZO"),
        ])

    def _depois_do_fim(self, foto):
        """Card final: tudo que chegar agora tem que ser recusado (virar comentário, reação ou card novo ligado)."""
        formas = [self._cat_botao_livre, self._cat_ilegal, self._cat_decisao, self._cat_relogio, self._cat_atrasada]
        self.rng.shuffle(formas)
        for forma in formas:
            eventos = forma(foto)
            if eventos:
                self.categorias["depois_do_fim"] += 1
                return eventos
        return [ev.fundador("PAUSAR_TUDO")]
