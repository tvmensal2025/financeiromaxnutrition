"""Despacho: fila com prioridade e VAGAS (WIP) para o motor. NÃO decide estado de card; só escolhe quem avança agora.

O que é: `Despachante.uma_rodada()` (1) pega uma VAGA, (2) escolhe o card de maior prioridade que precisa do motor
(RASCUNHO, VALIDANDO_PLANO, EM_ANDAMENTO; prioridade DESC, prazo ASC, criado_em ASC) e (3) chama `motor.avancar(card)`.
Sem vaga: devolve 'ESPERANDO_VAGA' e não executa nada.

A vaga é um advisory lock de SESSÃO do PostgreSQL (`pg_try_advisory_lock(chave_base + n)`, n em 0..vagas-1) numa
conexão dedicada. Se o dono morrer (processo, rede, conexão), o PostgreSQL solta a vaga sozinho; ninguém precisa limpar.
Cada card em avanço também é reservado (advisory lock por card): dois donos de vaga nunca pegam o mesmo card.
Segunda defesa, no banco: um card SEM execução viva só começa se há menos de `vagas` cards em voo (cards do motor com
execução VIVA). Card já em voo continua sempre elegível, e é isso que evita o travamento: se dois cards chegarem a ter
execução viva (a máquina abre execuções sozinha, também quando o FUNDADOR toca), um não pode esperar o outro.
Conta CARDS, não linhas: a máquina abre de uma vez até 3 execuções VIVAS no mesmo card (E1, E2 e E3 em paralelo)
enquanto o motor roda um agente por vez. Efeito: um card em voo não é ultrapassado por um card novo, mesmo de prioridade
maior; a prioridade decide quem COMEÇA e, entre os que já estão em voo, quem recebe a próxima vaga. A execução viva
que sobra de uma queda é do card em voo: ele a retoma. Execução viva órfã em card do motor segura card novo até o
relógio ou o fundador resolvê-la (o vigia avisa depois de 1 h): é o preço de WIP, não um defeito escondido.

NÃO COMPROVADO: vaga mantida durante chamadas de minutos através de proxy/pooler real (sem batimento: uma conexão
ociosa derrubada no meio do avanço só é notada no fim, e fica contada em `vagas_perdidas`).
"""
import ctypes
import os
import re
import secrets
import threading
import time
import zlib
from typing import Callable, Dict, List, Optional

import psycopg

from .vigilancia import limpar_texto

# Chave base dos advisory locks ("HELENA" em ASCII + 1 byte); a vaga n usa chave_base + n. O espaço de chaves é por banco.
CHAVE_BASE_PADRAO = 0x48454C454E4100
CHAVE_DE_CARD = 0x48454C43                      # 1º inteiro do par (int4, int4) que reserva um card; o 2º é o hash do id
ESTADOS_DO_MOTOR = ('RASCUNHO', 'VALIDANDO_PLANO', 'EM_ANDAMENTO')
INTERVALO_PADRAO_S = 5.0
ESPERA_APOS_ERRO_S = 30.0
PAUSA_MINIMA_S = 0.05                           # depois de avançar, volta logo, mas nunca em laço apertado

AVANCOU, OCIOSO, ESPERANDO_VAGA, TETO_DE_VIVAS, COM_ERRO = 'AVANCOU', 'OCIOSO', 'ESPERANDO_VAGA', 'TETO_DE_VIVAS', 'COM_ERRO'

_CONSULTA_FILA = """
    WITH cards_em_voo AS MATERIALIZED (
        SELECT DISTINCT x.card_id FROM helena_v2.execucao x JOIN helena_v2.card k ON k.id = x.card_id
        WHERE x.estado = 'VIVA' AND k.estado = ANY(%(estados)s))
    SELECT c.id, c.estado, c.prioridade, c.prazo, c.criado_em,
           EXISTS (SELECT 1 FROM cards_em_voo v WHERE v.card_id = c.id) AS em_voo,
           (SELECT count(*) FROM cards_em_voo v WHERE v.card_id <> c.id) AS outros_cards_em_voo
    FROM helena_v2.card c
    WHERE c.estado = ANY(%(estados)s)
    ORDER BY c.prioridade DESC, c.prazo ASC, c.criado_em ASC, c.id ASC"""


def _primeiro(linha):
    return linha['ok'] if isinstance(linha, dict) else linha[0]


class Despachante:
    """Uma instância por processo do motor. `motor` é um Motor (usa só `_con()` e `avancar()`)."""

    def __init__(self, motor, vagas: int = 1, identidade: Optional[str] = None, *, chave_base: int = CHAVE_BASE_PADRAO,
                 registrar: Optional[Callable[[str], None]] = None, relogio: Callable[[], float] = time.monotonic,
                 espera_apos_erro_s: float = ESPERA_APOS_ERRO_S):
        if not isinstance(vagas, int) or isinstance(vagas, bool) or not 1 <= vagas <= 64:
            raise ValueError('vagas deve ser um inteiro de 1 a 64')
        self.motor, self.vagas, self.chave_base = motor, vagas, chave_base
        self.identidade = re.sub(r'[^A-Za-z0-9_.:-]', '_', identidade or f'{os.getpid()}-{secrets.token_hex(3)}')[:40]
        self.registrar = registrar or (lambda linha: None)
        self.relogio, self.espera_apos_erro_s = relogio, espera_apos_erro_s
        self.ultimo_card: Optional[str] = None          # o card avançado pela última rodada (None se não avançou nenhum)
        self.metricas = {'rodadas': 0, 'avancos': 0, 'esperando_vaga': 0, 'teto_de_vivas': 0, 'erros': 0,
                         'vagas_perdidas': 0, 'rodadas_ociosas': 0, 'cards_ocupados': 0}
        self._conexao = None                            # conexão DEDICADA: é a sessão que segura o advisory lock
        self._vaga: Optional[int] = None                # a vaga que esta sessão segura agora
        self._em_espera: Dict[str, float] = {}          # card -> instante até o qual fica de lado depois de um erro
        self._entrada_v2_disponivel: Optional[bool] = None
        self._vez_entrada_v2 = True

    # --- a conexão dedicada e a vaga -------------------------------------------------------------------------------
    @property
    def vaga(self) -> Optional[int]:
        return self._vaga

    def _descartar_conexao(self) -> None:
        con, self._conexao = self._conexao, None
        if self._vaga is not None:                      # a sessão sumiu, e com ela o lock: a vaga já não é nossa
            self._vaga = None
            self.metricas['vagas_perdidas'] += 1
            self.registrar('VAGA PERDIDA: a conexão dedicada do despachante caiu')
        if con is not None:
            try:
                con.close()
            except Exception:
                pass

    def _conexao_viva(self):
        """A conexão dedicada, conferida com uma consulta de verdade (`closed` não percebe um servidor que matou a sessão)."""
        if self._conexao is not None:
            try:
                self._conexao.execute('SELECT 1')
            except psycopg.Error:
                self._descartar_conexao()
        if self._conexao is None:
            con = self.motor._con()
            try:
                con.execute("SELECT set_config('application_name', %s, false)", ('helena-despacho:' + self.identidade,))
            except psycopg.Error:
                con.close()
                raise
            self._conexao = con
        return self._conexao

    def adquirir_vaga(self) -> Optional[int]:
        """Tenta pegar uma vaga livre. Devolve o número dela ou None. Não empilha: quem já tem uma vaga a mantém."""
        con = self._conexao_viva()
        if self._vaga is not None:
            return self._vaga
        for n in range(self.vagas):
            if _primeiro(con.execute('SELECT pg_try_advisory_lock(%s) AS ok', (self.chave_base + n,)).fetchone()):
                self._vaga = n
                return n
        return None

    def liberar_vaga(self) -> None:
        if self._vaga is None:
            return
        n, self._vaga = self._vaga, None
        try:
            self._conexao.execute('SELECT pg_advisory_unlock(%s)', (self.chave_base + n,))
        except Exception:                               # conexão já morta: o PostgreSQL já soltou a vaga
            self._descartar_conexao()

    def _par_do_card(self, card_id: str):
        return CHAVE_DE_CARD, ctypes.c_int32(zlib.crc32(card_id.encode('utf-8'))).value

    def _reservar_card(self, card_id: str) -> bool:
        """Reserva o card para esta sessão (outro dono de vaga não o pega). Colisão de hash só faz o card esperar uma volta."""
        par = self._par_do_card(card_id)
        return _primeiro(self._conexao.execute('SELECT pg_try_advisory_lock(%s, %s) AS ok', par).fetchone())

    def _soltar_card(self, card_id: str) -> None:
        try:
            self._conexao.execute('SELECT pg_advisory_unlock(%s, %s)', self._par_do_card(card_id))
        except Exception:                               # conexão já morta: o PostgreSQL já soltou a reserva
            self._descartar_conexao()

    def fechar(self) -> None:
        """Solta a vaga e fecha a conexão dedicada."""
        self.liberar_vaga()
        self._descartar_conexao()

    # --- a fila ------------------------------------------------------------------------------------------------------
    def fila(self) -> List[dict]:
        """Os cards que precisam do motor, na ordem em que seriam escolhidos. Só lê; não pega vaga."""
        linhas = self._conexao_viva().execute(_CONSULTA_FILA, {'estados': list(ESTADOS_DO_MOTOR)}).fetchall()
        return [dict(linha) for linha in linhas]

    # --- uma rodada --------------------------------------------------------------------------------------------------
    def uma_rodada(self) -> str:
        """AVANCOU | OCIOSO | ESPERANDO_VAGA | TETO_DE_VIVAS | COM_ERRO. Só mexe em card depois de ter uma vaga."""
        self.metricas['rodadas'] += 1
        self.ultimo_card = None
        tinha_vaga = self._vaga is not None             # vaga pega de fora (adquirir_vaga) não é solta por esta rodada
        if self.adquirir_vaga() is None:
            self.metricas['esperando_vaga'] += 1
            return ESPERANDO_VAGA
        try:
            return self._avancar_o_proximo()
        finally:
            if not tinha_vaga:
                self.liberar_vaga()

    def _avancar_o_proximo(self) -> str:
        agora = self.relogio()
        self._em_espera = {c: ate for c, ate in self._em_espera.items() if ate > agora}
        candidatos = self.fila()
        # A mesma vaga limita triagem, consumo e execução. A reserva e a resposta
        # bruta do pedido sobrevivem à queda do processo; o card nasce só após o
        # fundador confirmar o plano na RPC autenticada.
        if (not any(c['em_voo'] for c in candidatos)
                and (self._vez_entrada_v2 or not candidatos)
                and self._em_espera.get('entrada-v2', 0) <= agora):
            try:
                if self._rodar_entrada_v2():
                    self.metricas['avancos'] += 1
                    self._vez_entrada_v2 = False
                    return AVANCOU
            except Exception as erro:
                self.metricas['erros'] += 1
                self._em_espera['entrada-v2'] = agora + self.espera_apos_erro_s
                self.registrar(limpar_texto(f'ERRO NA ENTRADA V2: {type(erro).__name__}', 200))
        teto = erro_visto = False
        if self._vaga is None:                          # a conexão caiu entre pegar a vaga e escolher: não é mais nossa
            self.metricas['esperando_vaga'] += 1
            return ESPERANDO_VAGA
        for candidato in candidatos:
            card_id = str(candidato['id'])
            if self._em_espera.get(card_id, 0) > agora:
                continue
            if not candidato['em_voo'] and candidato['outros_cards_em_voo'] >= self.vagas:   # segunda defesa
                teto = True                                         # card novo não começa com `vagas` cards já em voo
                continue
            if not self._reservar_card(card_id):                    # outro dono de vaga está avançando este card agora
                self.metricas['cards_ocupados'] += 1
                continue
            try:
                avancou = self.motor.avancar(card_id)
            except Exception as erro:                   # um card com defeito não pode travar os de prioridade menor
                erro_visto = True
                self.metricas['erros'] += 1
                self._em_espera[card_id] = agora + self.espera_apos_erro_s
                self.registrar(limpar_texto(f'ERRO AO AVANCAR card={card_id}: {type(erro).__name__}: {erro}', 200))
                continue
            finally:
                self._soltar_card(card_id)
            if avancou:
                self._conferir_que_a_vaga_continua_minha()
                self.metricas['avancos'] += 1
                self.ultimo_card = card_id
                self._vez_entrada_v2 = True
                return AVANCOU
        self._vez_entrada_v2 = True
        if erro_visto:
            return COM_ERRO
        if teto:
            self.metricas['teto_de_vivas'] += 1
            return TETO_DE_VIVAS
        self.metricas['rodadas_ociosas'] += 1
        return OCIOSO

    def _rodar_entrada_v2(self) -> bool:
        if self._entrada_v2_disponivel is None:
            linha = self._conexao_viva().execute(
                "SELECT to_regprocedure('helena_v2.listar_trabalho_proposta_pedido(integer)') IS NOT NULL AS ok"
            ).fetchone()
            self._entrada_v2_disponivel = bool(_primeiro(linha))
            if not self._entrada_v2_disponivel and getattr(self.motor, 'modo_producao', False):
                raise RuntimeError('migração de triagem v2 ausente')
        if not self._entrada_v2_disponivel:
            return False
        from .triagem_pedido import processar_proposta_pedido
        # Primeiro materializa planos já autorizados. Cada conversão é idempotente
        # em 0023 e a fila reaparece se uma rodada cair antes de concluir.
        planos = self._conexao_viva().execute(
            'SELECT helena_v2.listar_planos_pedido_pendentes(%s) AS itens', (20,)
        ).fetchone()['itens']
        pendentes = planos.get('itens', []) if isinstance(planos, dict) else planos or []
        for item in pendentes:
            pedido_id = item['pedido_id'] if isinstance(item, dict) else item
            chave = 'plano:' + str(pedido_id)
            if self._em_espera.get(chave, 0) > self.relogio():
                continue
            try:
                card_id = self.motor.criar_card_pedido(pedido_id)
            except Exception as erro:
                self.metricas['erros'] += 1
                self._em_espera[chave] = self.relogio() + self.espera_apos_erro_s
                self.registrar(limpar_texto(f'ERRO AO CONSUMIR plano={pedido_id}: {type(erro).__name__}', 200))
                continue
            self.ultimo_card = str(card_id)
            return True
        trabalho = self._conexao_viva().execute(
            'SELECT helena_v2.listar_trabalho_proposta_pedido(%s) AS itens', (20,)
        ).fetchone()['itens']
        itens = trabalho.get('itens', []) if isinstance(trabalho, dict) else trabalho or []
        for item in itens:
            request_id = str(item['request_id'])
            chave = 'triagem:' + request_id
            if self._em_espera.get(chave, 0) > self.relogio():
                continue
            try:
                if processar_proposta_pedido(self.motor, request_id):
                    return True
            except Exception as erro:
                self.metricas['erros'] += 1
                self._em_espera[chave] = self.relogio() + self.espera_apos_erro_s
                self.registrar(limpar_texto(f'ERRO NA TRIAGEM pedido={request_id}: {type(erro).__name__}', 200))
                continue
        return False

    def _conferir_que_a_vaga_continua_minha(self) -> None:
        """Depois do avanço: se a conexão dedicada caiu no meio, a vaga foi perdida (fica registrado, não escondido)."""
        try:
            self._conexao.execute('SELECT 1')
        except Exception:
            self._descartar_conexao()

    def rodar(self, parar: threading.Event, intervalo_s: float = INTERVALO_PADRAO_S) -> None:
        """Roda rodadas até `parar`. Avançou: volta logo. Nada a fazer ou sem vaga: espera `intervalo_s`.
        Uma rodada com erro nunca derruba o laço. Ao sair, solta a vaga."""
        try:
            while not parar.is_set():
                try:
                    resultado = self.uma_rodada()
                except Exception as erro:               # defesa final: o despachante não pode morrer calado
                    resultado = COM_ERRO
                    self.metricas['erros'] += 1
                    self.registrar(limpar_texto(f'ERRO NA RODADA DO DESPACHANTE: {type(erro).__name__}'))
                parar.wait(PAUSA_MINIMA_S if resultado == AVANCOU else intervalo_s)
        finally:
            self.fechar()
