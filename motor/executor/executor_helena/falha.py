"""LEITOR DE FALHA: diz de que tipo foi a falha de uma execução, lendo só REGISTROS.

Regra de ouro (plano v3, "A falha é lida, não declarada"): o tipo da falha vem do registro de uso e do
código de saída, NUNCA do texto do agente. Por isso este módulo nem recebe o texto: só fatos
(números, marcas e códigos). Um agente que escreva "estou sem cota" numa execução saudável não vira COTA.

Ordem de leitura (a primeira que se aplica decide):

  1. o executor encerrou o processo (TEMPO, LIMITE_CHAMADAS) -> essa classe;
  2. o nosso servidor de ferramentas encerrou por limite -> LIMITE_CHAMADAS;
  3. morto por sinal que não foi nosso -> QUEDA;
  4. o Hermes disse que falhou (failed=true) -> a classe sai do erro que ele gravou do provedor
     (COTA, LOGIN, GRANDE_DEMAIS, PROVEDOR); sem erro gravado ou erro desconhecido -> DESCONHECIDA;
  5. o Hermes não terminou inteiro (completed=false, sem erro): resposta cortada pelo limite do modelo ->
     GRANDE_DEMAIS; estourou as voltas ou pediu ferramenta que não existe -> LIMITE_CHAMADAS; saída vazia com
     código 2 e sem erro -> QUEDA; o resto -> DESCONHECIDA;
  6. terminou inteiro mas a saída não é a resposta do agente (resposta vazia) -> FORMATO_ERRADO;
     saída cortada pelo limite do modelo -> GRANDE_DEMAIS.

"Nunca chutar": tudo que não bate com uma regra conhecida é DESCONHECIDA, com um código que diz o porquê.
"""

from dataclasses import dataclass
from typing import Optional

from .tipos import (COTA, DESCONHECIDA, ENCERRADO_POR_CANCELAMENTO, ENCERRADO_POR_LIMITE, ENCERRADO_POR_TEMPO,
                    FORMATO_ERRADO, GRANDE_DEMAIS, LIMITE_CHAMADAS, LOGIN, PROVEDOR, QUEDA, TEMPO, Falha)
from .uso import ErroDoProvedor, Sessao, resposta_do_agente_e_vazia

MOTIVO_DO_SERVIDOR_PARA_LIMITE = "limite_de_chamadas"       # ferramentas_helena/contador.py

CODIGOS_DE_LOGIN = frozenset({"token_expired", "invalid_api_key", "invalid_token", "authentication_error",
                              "account_deactivated", "invalid_authentication", "unauthorized"})
CODIGOS_DE_COTA = frozenset({"rate_limit_exceeded", "insufficient_quota", "usage_limit_reached", "quota_exceeded",
                             "billing_hard_limit_reached", "billing_not_active"})
TIPOS_DE_COTA = frozenset({"usage_limit_reached", "insufficient_quota", "rate_limit_error"})
CODIGOS_DE_CONTEXTO = frozenset({"context_length_exceeded", "string_above_max_length"})
TIPOS_DO_PROVEDOR = frozenset({"server_error", "overloaded_error", "EmptyStreamError", "APIConnectionError",
                               "APITimeoutError", "ReadTimeout", "ConnectError", "RemoteProtocolError", "timeout"})
STATUS_DO_PROVEDOR = frozenset({408, 500, 502, 503, 504, 529})


@dataclass(frozen=True)
class Evidencias:
    """Os fatos de uma execução. Nenhum campo é texto do agente."""
    codigo_de_saida: Optional[int]
    encerrado_por: Optional[str]                  # quem encerrou o processo: o executor, ou ninguém
    uso: Optional[dict]                           # uso.json do Hermes
    erro_do_provedor: Optional[ErroDoProvedor]    # request_dump do Hermes
    sessao: Optional[Sessao]                      # state.db do Hermes
    servidor: Optional[dict]                      # estado.json do nosso servidor de ferramentas
    saida_vazia: bool                             # o Hermes não imprimiu nada (só o tamanho, nunca o conteúdo)
    saida_e_resposta: bool                        # o impresso É a última mensagem do agente na sessão
    max_de_chamadas_vistas: int                   # teto do vigia (do perfil)
    frase_do_hermes: Optional[str] = None         # código de uma frase DO HERMES (provada fora do agente), ou None


def classe_do_erro_do_provedor(erro: ErroDoProvedor) -> Falha:
    status, tipo, codigo = erro.status, erro.tipo or "", erro.codigo or ""
    nome = f"HTTP_{status}" if status else (tipo or codigo or "ERRO_SEM_NOME")
    if status == 401 or codigo in CODIGOS_DE_LOGIN:
        return Falha(LOGIN, nome, "o provedor recusou o login")
    if status in (402, 429) or codigo in CODIGOS_DE_COTA or tipo in TIPOS_DE_COTA:
        return Falha(COTA, nome, "o provedor informou cota esgotada", voltar_em_s=erro.voltar_em_s)
    if status == 413 or codigo in CODIGOS_DE_CONTEXTO:
        return Falha(GRANDE_DEMAIS, nome, "a conversa passou do tamanho que o modelo aceita")
    if status in STATUS_DO_PROVEDOR or tipo in TIPOS_DO_PROVEDOR:
        return Falha(PROVEDOR, nome, "o provedor falhou ou respondeu torto")
    return Falha(DESCONHECIDA, nome, "erro do provedor que não está na lista conhecida")


def _limite_de_chamadas(ev: Evidencias) -> bool:
    """Execução incompleta por laço: voltas do Hermes esgotadas, ferramenta inexistente pedida de novo
    (o Hermes encerra sozinho com código 0 e uma frase dele) ou mais resultados de ferramenta que o teto do vigia."""
    sessao = ev.sessao
    if sessao is None:
        return False
    estourou_voltas = sessao.max_iteracoes is not None and sessao.chamadas_ao_modelo >= sessao.max_iteracoes
    pediu_ferramenta_inexistente = sessao.chamadas_invalidas >= 1 and ev.codigo_de_saida == 0
    return estourou_voltas or pediu_ferramenta_inexistente or sessao.resultados_de_ferramenta > ev.max_de_chamadas_vistas


def classificar_falha(ev: Evidencias) -> Optional[Falha]:
    """Devolve a falha, ou None se a execução terminou inteira e sem falha (o formato é conferido depois)."""
    if ev.encerrado_por == ENCERRADO_POR_CANCELAMENTO:
        return None                                # cancelar não é falha; o resultado diz cancelada
    if ev.encerrado_por == ENCERRADO_POR_TEMPO:
        return Falha(TEMPO, "TEMPO_ESGOTADO", "passou do tempo máximo e o processo inteiro foi encerrado")
    if ev.encerrado_por == ENCERRADO_POR_LIMITE:
        return Falha(LIMITE_CHAMADAS, "LIMITE_DE_CHAMADAS", "o agente insistiu depois do limite de chamadas")
    servidor = ev.servidor or {}
    if servidor.get("encerrada") is True and servidor.get("motivo_encerramento") == MOTIVO_DO_SERVIDOR_PARA_LIMITE:
        return Falha(LIMITE_CHAMADAS, "SERVIDOR_ENCERROU_POR_LIMITE", "o servidor de ferramentas encerrou por limite")
    codigo = ev.codigo_de_saida
    if codigo is not None and codigo < 0:
        return Falha(QUEDA, f"MORTO_PELO_SINAL_{-codigo}", "o processo do agente morreu sem terminar")
    if codigo is None:
        return Falha(QUEDA, "SEM_CODIGO_DE_SAIDA", "o processo do agente sumiu sem terminar")

    uso = ev.uso
    if uso is None:
        return Falha(DESCONHECIDA, "SEM_REGISTRO_DE_USO", "o Hermes não deixou o registro de uso")
    completo, falhou = uso.get("completed"), uso.get("failed")
    if not isinstance(completo, bool) or not isinstance(falhou, bool):
        return Falha(DESCONHECIDA, "REGISTRO_DE_USO_ILEGIVEL", "o registro de uso não diz se terminou")

    if falhou:
        if ev.erro_do_provedor is None:
            if ev.frase_do_hermes == "CONTEXTO_GRANDE":
                return Falha(GRANDE_DEMAIS, "CONTEXTO_MAIOR_QUE_O_MODELO", "a conversa passou do tamanho que o modelo aceita")
            return Falha(DESCONHECIDA, "FALHA_SEM_ERRO_REGISTRADO", "o Hermes falhou e não gravou a causa")
        return classe_do_erro_do_provedor(ev.erro_do_provedor)

    if not completo:
        if ev.sessao is not None and ev.sessao.ultimo_finish_reason == "length":
            return Falha(GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE", "a resposta bateu no limite de tamanho do modelo")
        if _limite_de_chamadas(ev):
            return Falha(LIMITE_CHAMADAS, "LACO_DE_CHAMADAS", "o agente repetiu chamadas até o limite")
        if codigo == 2 and ev.saida_vazia and ev.erro_do_provedor is None \
                and (ev.sessao is None or ev.sessao.chamadas_invalidas == 0):
            return Falha(QUEDA, "CORTE_NO_MEIO_DA_RESPOSTA", "a conexão caiu no meio da resposta")
        return Falha(DESCONHECIDA, "EXECUCAO_INCOMPLETA", "o Hermes parou sem terminar e sem dizer por quê")

    if codigo != 0:
        return Falha(DESCONHECIDA, f"SAIDA_{codigo}_COM_USO_COMPLETO", "código de saída diferente de zero")
    sessao = ev.sessao
    if sessao is None:
        return Falha(DESCONHECIDA, "SESSAO_ILEGIVEL", "não consegui ler a sessão gravada pelo Hermes")
    if sessao.ultimo_finish_reason == "length":
        return Falha(GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE", "a resposta bateu no limite de tamanho do modelo")
    if not ev.saida_e_resposta:
        if resposta_do_agente_e_vazia(sessao):
            return Falha(FORMATO_ERRADO, "RESPOSTA_VAZIA", "o modelo respondeu vazio")
        return Falha(DESCONHECIDA, "SAIDA_DIFERENTE_DA_SESSAO", "o que saiu não é a última mensagem do agente")
    return None
