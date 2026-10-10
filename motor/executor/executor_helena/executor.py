"""A interface Executor e o executor real (Hermes atrás de um adaptador).

    resultado = executor.rodar(execucao)     # bloqueia até terminar; devolve SEMPRE um Resultado
    executor.cancelar("E-123-n4")            # de outra thread: encerra o processo inteiro em até 15 s

Quem chama (o motor) só enxerga isto. Trocar de executor = escrever outra classe com os mesmos dois
métodos e passar nos mesmos testes de conformidade (testes/test_conformidade.py).

`ExecutorHermes.rodar` faz, nesta ordem:
  1. gera o perfil da ficha (perfil.py) e o confere contra o gabarito: perfil fora do gabarito NÃO roda;
  2. monta o comando `hermes -z ...` e o ambiente do zero (ambiente.py);
  3. lança em grupo próprio e vigia tempo, cancelamento e limite de chamadas (processo.py);
  4. junta os registros (uso.py), classifica a falha (falha.py) e faz a conferência (conferencia.py);
  5. só devolve `texto` se a execução terminou inteira e passou na conferência.

Erros de montagem (pacote com segredo, pasta dentro de repositório...) saem como ErroDePerfil: são defeito
de quem chama, não falha de execução. O resto sempre volta como Resultado.
"""

import shutil
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Optional

from . import conferencia, processo, uso
from .decisao import decidir
from .falha import MOTIVO_DO_SERVIDOR_PARA_LIMITE, Evidencias
from .perfil import (ConfigDoExecutor, Perfil, gerar_perfil, montar_comando, nomes_visiveis_das_ferramentas,
                     resumo_do_comando)
from .processo import ErroDeLancamento
from .tipos import (DESCONHECIDA, ENCERRADO_POR_LIMITE, Conferencia, ErroDePerfil, Execucao, Falha, Problema,
                    Resultado)

INTERVALO_DA_CONTAGEM_S = 1.0


class Executor(ABC):
    """Contrato de qualquer executor de agente."""

    @abstractmethod
    def rodar(self, execucao: Execucao) -> Resultado:
        """Roda a execução até o fim, o tempo máximo ou o cancelamento. Devolve sempre um Resultado."""

    @abstractmethod
    def cancelar(self, id_da_execucao: str) -> bool:
        """Pede para encerrar uma execução em andamento. True se havia uma com esse id."""


class VigiaDeLimite:
    """Corta o laço: roda a cada volta do vigia do processo e devolve o motivo se o limite estourou.

    Duas fontes: o nosso servidor de ferramentas (estado.json: encerrou por limite) e a contagem de
    resultados de ferramenta na sessão do Hermes (pega o que o servidor não vê, como ferramenta
    que não existe, e funciona mesmo quando o Hermes barra as chamadas antes de chegarem ao servidor).
    """

    def __init__(self, perfil: Perfil):
        self.perfil = perfil
        self._proxima_contagem = 0.0

    def __call__(self) -> Optional[str]:
        estado = uso.ler_estado_das_ferramentas(self.perfil.ferramentas) or {}
        if estado.get("encerrada") is True and estado.get("motivo_encerramento") == MOTIVO_DO_SERVIDOR_PARA_LIMITE:
            return ENCERRADO_POR_LIMITE
        agora = time.monotonic()
        if agora >= self._proxima_contagem:
            self._proxima_contagem = agora + INTERVALO_DA_CONTAGEM_S
            if uso.contar_resultados_de_ferramenta(self.perfil.hermes_home) > self.perfil.max_de_chamadas_vistas:
                return ENCERRADO_POR_LIMITE
        return None


def _ler_saida(caminho: Path) -> Optional[str]:
    try:
        with open(caminho, "rb") as arquivo:
            return arquivo.read(uso.TAMANHO_MAXIMO_DE_REGISTRO).decode("utf-8", errors="replace")
    except OSError:
        return None


class ExecutorHermes(Executor):
    def __init__(self, config: ConfigDoExecutor):
        self.config = config
        self._cancelamentos: Dict[str, threading.Event] = {}
        self._trava = threading.Lock()

    # --- contrato ---------------------------------------------------------------------------------
    def cancelar(self, id_da_execucao: str) -> bool:
        with self._trava:
            evento = self._cancelamentos.get(id_da_execucao)
        if evento is None:
            return False
        evento.set()
        return True

    def rodar(self, execucao: Execucao) -> Resultado:
        perfil = self.preparar(execucao)
        return self.rodar_perfil(execucao, perfil)

    # --- passos -----------------------------------------------------------------------------------
    def preparar(self, execucao: Execucao) -> Perfil:
        """Gera o perfil e o confere contra o gabarito. Perfil fora do gabarito levanta ErroDePerfil."""
        perfil = gerar_perfil(self.config, execucao)
        violacoes = conferencia.antes_de_lancar(perfil)
        if violacoes:
            raise ErroDePerfil("perfil fora do gabarito, não vai rodar: "
                               + "; ".join(f"{p.codigo} ({p.detalhe})" for p in violacoes))
        return perfil

    def rodar_perfil(self, execucao: Execucao, perfil: Perfil) -> Resultado:
        comando = montar_comando(self.config, perfil, execucao.pacote)
        cancelamento = threading.Event()
        with self._trava:
            self._cancelamentos[execucao.id] = cancelamento
        try:
            try:
                saida = processo.executar(
                    comando, cwd=perfil.trabalho, env=perfil.ambiente, arquivo_de_saida=perfil.arquivo_de_saida,
                    arquivo_de_erros=perfil.arquivo_de_erros, arquivo_do_processo=perfil.arquivo_do_processo,
                    id_execucao=execucao.id, tempo_max_s=execucao.tempo_efetivo_s, cancelamento=cancelamento,
                    vigias=(VigiaDeLimite(perfil),), graca_s=self.config.graca_ao_encerrar_s,
                    limite_para_encerrar_s=self.config.limite_para_encerrar_s,
                    intervalo_s=self.config.intervalo_do_vigia_s)
            except ErroDeLancamento as erro:
                return self._resultado_sem_processo(perfil, comando, str(erro))
        finally:
            with self._trava:
                self._cancelamentos.pop(execucao.id, None)
        return self._avaliar(execucao, perfil, comando, saida)

    def _resultado_sem_processo(self, perfil: Perfil, comando, detalhe: str) -> Resultado:
        problema = Problema(DESCONHECIDA, "HERMES_NAO_LANCOU", detalhe)
        return Resultado(texto=None, terminou_inteira=False, uso=uso.montar_registro_de_uso(None, None),
                         codigo_de_saida=None, ferramentas_recebidas=(), modelo_usado=None, provedor_usado=None,
                         tempo_s=0.0, falha=Falha(DESCONHECIDA, problema.codigo, problema.detalhe),
                         conferencia=Conferencia((problema,)), pasta=perfil.pasta,
                         comando=resumo_do_comando(comando))

    def _avaliar(self, execucao: Execucao, perfil: Perfil, comando, saida) -> Resultado:
        texto_impresso = _ler_saida(perfil.arquivo_de_saida)
        sessao = uso.ler_sessao(perfil.hermes_home, nomes_visiveis_das_ferramentas(perfil.ficha))
        arquivo_de_uso = uso.ler_arquivo_de_uso(perfil.arquivo_de_uso)
        servidor = uso.ler_estado_das_ferramentas(perfil.ferramentas)
        evidencias = Evidencias(
            codigo_de_saida=saida.codigo, encerrado_por=saida.encerrado_por, uso=arquivo_de_uso,
            erro_do_provedor=uso.ler_erro_do_provedor(perfil.hermes_home), sessao=sessao, servidor=servidor,
            saida_vazia=not (texto_impresso or "").strip(),
            saida_e_resposta=uso.saida_e_a_resposta_do_agente(texto_impresso, sessao),
            max_de_chamadas_vistas=perfil.max_de_chamadas_vistas,
            frase_do_hermes=uso.codigo_da_frase_do_hermes(texto_impresso, arquivo_de_uso, sessao))
        conferido = conferencia.conferir_depois(perfil, evidencias, saida.sobras)
        decisao = decidir(execucao, evidencias, conferido, texto_impresso)
        return Resultado(
            texto=decisao.texto, terminou_inteira=decisao.terminou_inteira,
            uso=uso.montar_registro_de_uso(arquivo_de_uso, servidor),
            codigo_de_saida=saida.codigo,
            ferramentas_recebidas=uso.ferramentas_listadas(servidor),
            modelo_usado=(arquivo_de_uso or {}).get("model"), provedor_usado=(arquivo_de_uso or {}).get("provider"),
            tempo_s=saida.duracao_s, falha=decisao.falha, conferencia=conferido,
            cancelada=decisao.cancelada, encerrado_por=saida.encerrado_por,
            tempo_para_encerrar_s=saida.tempo_para_encerrar_s, sobras=saida.sobras, pasta=perfil.pasta,
            conversa=uso.exportar_conversa(perfil.hermes_home, self.config.guardar_conversa_ate_bytes),
            comando=resumo_do_comando(comando))

    # --- limpeza ----------------------------------------------------------------------------------
    def limpar(self, resultado: Resultado):
        """Apaga as pastas da execução e do perfil. Chamar DEPOIS de guardar a conversa e as cópias das páginas."""
        if resultado.pasta is None:
            return
        pasta = Path(resultado.pasta)
        alvos = [pasta, Path(self.config.raiz_hermes) / "profiles" / f"exec-{pasta.name}"]
        for alvo in alvos:
            dentro = (Path(self.config.pasta_das_execucoes) in alvo.parents
                      or Path(self.config.raiz_hermes) / "profiles" in alvo.parents)
            if dentro and alvo.exists():
                shutil.rmtree(alvo, ignore_errors=True)
