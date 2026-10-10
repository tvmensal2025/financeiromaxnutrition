"""Nomes e limites que o simulador usa.

Espelham helena-v2/maquina/vocabulario.yaml e passagens.yaml (a fonte da verdade).
O teste testes/test_adaptador_maquina.py compara estes nomes com os da máquina real
e acusa se um deles mudou lá. Se mudar, atualize SÓ este arquivo.
"""

# ---------------------------------------------------------------- limites (passagens.yaml, "tetos")
TETO_EXECUCOES = 6      # regra 5: cada etapa roda no máximo 6 vezes (autor + revisor)
TETO_INFRA = 3          # regra 12: na 3ª falha de infraestrutura da rodada, chama o fundador
TETO_ORDENS = 3         # ordens do fundador por card; a 4ª substitui o card por um novo ligado
TETO_PERGUNTAS = 2      # perguntas do card ao fundador
TETO_LEMBRETES = 2      # espera do fundador: lembretes em 24h e 48h, depois o padrão
TETO_NIVEL_PRAZO = 3    # prazo do card: 80%, vencido, mais 1 hora
TETO_MUDANCAS_PRAZO = 3
TETO_REPROVACOES = 2    # voltas ao autor por reprovação do revisor

# Quantas execuções de agente podem COMEÇAR sem nenhuma ordem do fundador no meio:
# 6 que contam + 3 de infraestrutura (que não contam) + 1 ainda viva. Serve de conta
# independente do contador do alvo (invariante "teto_de_execucoes").
LIMITE_INICIOS_SEM_ORDEM = TETO_EXECUCOES + TETO_INFRA + 1

# ---------------------------------------------------------------- pessoas e papéis
FUNDADOR = "FUNDADOR"
AGENTES = (
    "HELENA", "LAURA", "AUGUSTO", "MARINA", "CAIO", "CLARA", "BIANCA", "DANIEL", "THEO", "NINA", "RAVI",
    "MAYA", "BRUNO", "OLIVIA", "VICTOR", "CAMILA", "ISABELA", "PEDRO", "RENATA", "JOANA", "FELIPE",
)
PAPEIS = ("AUTOR", "REVISOR", "HELENA", "FUNDADOR", "MOTOR", "RELOGIO", "VIGIA")
PAPEIS_DE_IA = ("AUTOR", "REVISOR", "HELENA")   # nunca agem fora, nunca aprovam a si mesmos

# ---------------------------------------------------------------- estados
ESTADOS = {
    "card": {
        "abertos": ("RASCUNHO", "ESPERANDO_CONFIRMACAO", "VALIDANDO_PLANO", "EM_ANDAMENTO", "ESPERANDO_FUNDADOR"),
        "finais": ("PRONTO", "CANCELADO", "ENCERRADO_COM_FALHA"),
    },
    "etapa": {
        "abertos": ("AGUARDANDO_ANTERIORES", "NA_FILA", "EXECUTANDO", "VALIDACAO", "REVISAO",
                    "ESPERANDO_FUNDADOR", "EM_RESOLUCAO", "APROVADA"),
        "finais": ("PRONTA", "CANCELADA", "ENCERRADA_COM_FALHA"),
    },
    "acao_externa": {
        "abertos": ("PROPOSTA", "AUTORIZADA", "EXECUTANDO_ACAO", "INCERTA"),
        "finais": ("EXECUTADA", "FEITA_PELO_FUNDADOR", "RECUSADA", "EXPIRADA", "FALHOU", "NAO_CONFIRMADA", "CANCELADA"),
    },
}
CARD_FINAIS = ESTADOS["card"]["finais"]
ETAPA_FINAIS = ESTADOS["etapa"]["finais"]
ACAO_FINAIS = ESTADOS["acao_externa"]["finais"]
CARD_ATIVO = ("EM_ANDAMENTO", "ESPERANDO_FUNDADOR")          # regra 6: só aqui as etapas andam
CARD_ANTES_DO_PLANO = ("RASCUNHO", "ESPERANDO_CONFIRMACAO", "VALIDANDO_PLANO")


def e_final(maquina, estado):
    return estado in ESTADOS[maquina]["finais"]


def e_conhecido(maquina, estado):
    return estado in ESTADOS[maquina]["abertos"] or estado in ESTADOS[maquina]["finais"]


# ---------------------------------------------------------------- botões e opções do fundador
BOTOES_COM_VERSAO = ("APROVAR", "PEDIR_AJUSTE", "RESPONDER")   # com versão antiga nunca mudam estado
MOTIVOS_DE_AJUSTE = ("ERRO_DE_FATO", "FALTOU_TEMA", "TOM", "FORMATO")
OPCOES_DE_RESPOSTA = (
    "RESPOSTA_A", "RESPOSTA_B", "RESPOSTA_C", "CONFIRMO", "REFAZER", "SEGUIR_SEM", "ENCERRAR", "PULAR",
    "ESPERAR", "MODELO_MENOR", "ACONTECEU", "NAO_ACONTECEU", "FEITO_POR_MIM",
)

# ---------------------------------------------------------------- falhas
CLASSES_DE_FALHA = ("FORMATO_ERRADO", "LIMITE_CHAMADAS", "GRANDE_DEMAIS", "SITE", "DESCONHECIDA")
CLASSES_DE_INFRA = ("COTA", "LOGIN", "PROVEDOR", "QUEDA", "BANCO", "FERRAMENTA")
MOTIVOS_DE_FALHA_DO_AGENTE = ("NAO_CONSIGO", "FALTAM_DADOS", "FONTE_INSUFICIENTE")
PROPOSTAS_DE_ACAO = ("NENHUMA", "SO_FUNDADOR", "PELO_MOTOR")
