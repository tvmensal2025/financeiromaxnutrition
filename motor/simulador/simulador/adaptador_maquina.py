"""Adaptador: liga o simulador à máquina de passagens real (helena-v2/maquina/provar.py) via replay.

TODA dependência da API da máquina fica neste arquivo. Se o provar.py mudar (nome de função,
formato do resultado), só este arquivo muda.

O replay da máquina é "em lote": recebe a jornada inteira e devolve o resultado. Para o simulador
decidir o próximo evento olhando o estado, o adaptador repete o replay do começo a cada evento
(por isso as rodadas contra a máquina real usam poucos passos).
O que o adaptador lê do resultado do replay: final, violacoes, recusados e historico.

Velocidade: dois custos do replay são sempre iguais e dominam o tempo (montar as máquinas, que compila a tabela, e
validar a jornada inteira contra o esquema). O adaptador monta uma vez só e valida só o evento novo, o que corta o
tempo mais ou menos à metade sem mudar nenhum resultado (testes/test_adaptador_maquina.py compara os dois caminhos).
Para desligar: AlvoMaquina(acelerar=False).
"""
import copy
import importlib.util
import os
import sys
from pathlib import Path

from .alvo import Alvo
from .eventos import Foto, FotoAcao, FotoEtapa, Resposta

CAMINHO_PADRAO = Path(__file__).resolve().parents[3] / "helena-v2" / "maquina"
VARIAVEL_DO_CAMINHO = "HELENA_MAQUINA"      # permite apontar para outra cópia da máquina


class MaquinaNaoEncontrada(Exception):
    pass


def carregar_provar(caminho=None):
    """Importa provar.py sem criar nenhum arquivo na pasta da máquina (só leitura)."""
    pasta = Path(caminho or os.environ.get(VARIAVEL_DO_CAMINHO) or CAMINHO_PADRAO)
    arquivo = pasta / "provar.py"
    if not arquivo.is_file():
        raise MaquinaNaoEncontrada(f"não achei {arquivo} (use a variável {VARIAVEL_DO_CAMINHO} para apontar a pasta)")
    especificacao = importlib.util.spec_from_file_location("provar_da_maquina_real", arquivo)
    modulo = importlib.util.module_from_spec(especificacao)
    sys.modules[especificacao.name] = modulo
    antigo, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        especificacao.loader.exec_module(modulo)
    finally:
        sys.dont_write_bytecode = antigo
    return modulo


class AlvoMaquina(Alvo):
    nome = "maquina-de-passagens"

    def __init__(self, caminho=None, tabela=None, acelerar=True):
        """tabela: uma passagens.yaml já carregada, possivelmente ESTRAGADA de propósito (teste de mutação)."""
        self.provar = carregar_provar(caminho)
        self.vocab, self.tabela = self.provar.carregar(None, copy.deepcopy(tabela) if tabela else None)
        self._donos = self._montar_donos()
        self._valida_evento = self._valida_jornada = None
        self.acelerado = self._acelerar() if acelerar else False

    # ------------------------------------------------------------------ interface do Alvo
    def iniciar(self, roteiro, pedido_grande=True):
        self.roteiro = roteiro
        self._jornada = {"id": f"simulador-{roteiro.nome}", "roteiro": roteiro.para_jornada(),
                         "card": {"pedido_grande": bool(pedido_grande), "plano_valido": True}, "eventos": []}
        self._tamanho_do_historico = 0
        if self.acelerado:
            self._valida_jornada(self._jornada)
        self._resultado = self._reproduzir(conferir_historico=False)

    def aplicar(self, evento):
        como_jornada = evento.para_jornada()
        if self.acelerado:
            self._valida_evento(como_jornada)
        self._jornada["eventos"].append(como_jornada)
        indice = len(self._jornada["eventos"]) - 1
        resultado = self._reproduzir(conferir_historico=False)
        novos = resultado["historico"][self._tamanho_do_historico:]
        self._tamanho_do_historico = len(resultado["historico"])
        self._resultado = resultado
        propria = next((h for h in novos if h.get("via") == "jornada"), None)
        automaticos = tuple((h["papel"], h["evento"], h["alvo"]) for h in novos if h.get("via") == "automatico")
        acusadas = tuple((v["regra"], v["mensagem"]) for v in resultado["violacoes"] if v["indice"] == indice)
        if propria is None:                                    # recusado sem nem entrar no histórico
            return Resposta(False, "RECUSADO", automaticos, acusadas)
        if "efeitos" in propria:                               # alguma passagem foi aplicada
            return Resposta(True, "FORMATO_ERRADO" if "convertido_em" in propria else "PASSAGEM", automaticos, acusadas)
        destino = propria.get("destino", "RECUSADO")
        return Resposta(False, destino, automaticos, acusadas)

    def foto(self):
        final = self._resultado["final"]
        etapas = {i: FotoEtapa(i, e["estado"], e["revisor"], e["execucoes"], e["exec_viva"], e["versao"], e["motivo"],
                               e["semaforo"], e["fim"], e["lembretes"]) for i, e in final["etapas"].items()}
        acoes = {i: FotoAcao(i, a["estado"], a.get("origem", ""), a["ok_registrado"], a["tentativas"], a["lembretes"])
                 for i, a in final["acoes"].items()}
        return Foto(dict(final["card"]), etapas, acoes, self._donos)

    def encerrar(self):
        """Roda o replay completo, com a conferência extra de que o histórico reconstrói o card (regra 13)."""
        resultado = self._reproduzir(conferir_historico=True)
        return tuple((v["regra"], v["mensagem"]) for v in resultado["violacoes"] if v["regra"] == "R13")

    # ------------------------------------------------------------------ por dentro
    def _acelerar(self):
        """Monta as máquinas uma vez só e valida só o evento novo (o esquema é por evento). Se a máquina mudar de
        forma e isto não se aplicar mais, volta para o caminho lento, que é o mesmo cálculo."""
        import jsonschema
        modulo = self.provar
        try:
            montar_original = modulo.montar
            esquema = modulo._schema_jornada()
            validador_da_jornada = jsonschema.Draft202012Validator(esquema)
            validador_do_evento = jsonschema.Draft202012Validator(esquema["properties"]["eventos"]["items"])
        except (AttributeError, KeyError):
            return False
        montadas = {}

        def montar_uma_vez(vocab, tab):
            chave = (id(vocab), id(tab))
            if chave not in montadas:
                montadas[chave] = montar_original(vocab, tab)
            return montadas[chave]

        modulo.montar = montar_uma_vez
        modulo._schema_jornada = lambda: {}                 # a validação completa já foi feita aqui, evento a evento
        self._valida_jornada = validador_da_jornada.validate
        self._valida_evento = validador_do_evento.validate
        return True

    def _reproduzir(self, conferir_historico):
        return self.provar.replay(self._jornada, self.vocab, self.tabela, conferir_historico=conferir_historico)

    def _montar_donos(self):
        """maquina -> {estado: (dono, prazo)} lido do bloco 'estados' da tabela (estados finais não têm)."""
        donos = {}
        for maquina, estados in self.tabela["estados"].items():
            donos[maquina] = {nome: (d.get("dono"), d.get("prazo")) for nome, d in estados.items() if not d.get("final")}
        return donos
