"""Monta o 'modelo' que o validador pede (contexto["modelo"]) a partir da especificação.

O que é: a conversão do YAML do tipo (deliverables/<tipo>.yaml) e do serviço (servicos.yaml) para o formato do validador.
De onde vem: nada é escrito à mão aqui; cada campo é lido da especificação. O que esta tabela decide é só QUAIS campos o
validador conhece (CAMPOS_DA_SECAO). Um campo novo na especificação passa a valer acrescentando o nome nessa lista.
Como mudar: para o validador receber uma opção nova (bloco "validador"), escreva `validador:` no YAML do tipo; ela passa direto.
"""

# Campos de uma seção que o validador usa (nomes do schemas/entrega.schema.json). O título vai junto porque aparece nas mensagens
# ("Falta a seção ... (Versão final)"); a descrição fica de fora de propósito: é texto para o agente, o validador não a lê.
CAMPOS_DA_SECAO = ("id", "titulo", "tipo_de_campo", "obrigatoria", "exige_citacao", "limite_caracteres",
                   "itens_min", "itens_max", "unidade", "valores_permitidos")
CAMPOS_DA_COLUNA = ("id", "tipo_de_campo")


def _secao(s: dict) -> dict:
    saida = {k: s[k] for k in CAMPOS_DA_SECAO if k in s}
    if "colunas" in s:
        saida["colunas"] = [{k: c[k] for k in CAMPOS_DA_COLUNA if k in c} for c in s["colunas"]]
    return saida


def montar_modelo(spec, tipo_nome: str, acao_do_fundador_do_plano=None) -> dict:
    """O modelo do tipo `tipo_nome`.

    Leva: tipo, serviço, limite, seções, as ações que o serviço permite, a ação externa permitida, as ações do fundador,
    o bloco `validador` (se o YAML do tipo tiver) e, em `parametros_das_checagens`, os `parametros` de cada CHK do tipo
    exatamente como a especificação os escreve (a função da checagem lê dali; ver README, "Como implementar uma CHK").
    `acao_do_fundador_do_plano`: a ação que o plano deu àquela etapa (vem do pedido; o caso não a muda).
    """
    tipo = spec.tipo(tipo_nome)
    if tipo is None:
        raise FileNotFoundError(f"Não existe deliverables/{tipo_nome}.yaml na especificação.")
    servico = spec.servicos[tipo["servico"]]
    modelo = {
        "tipo": tipo["tipo"],
        "servico": tipo["servico"],
        "limite": tipo["limite"],
        "secoes": [_secao(s) for s in tipo["secoes"]],
        "acoes_permitidas": list(servico["acoes_permitidas"]),
        "acao_externa_permitida": list(servico["acao_externa_permitida"]),
        "acoes_do_fundador": [a["id"] if isinstance(a, dict) else a for a in servico.get("acoes_do_fundador") or []],
    }
    if acao_do_fundador_do_plano:
        modelo["acao_do_fundador_do_plano"] = acao_do_fundador_do_plano
    if tipo.get("validador"):
        modelo["validador"] = dict(tipo["validador"])
    # As checagens deste serviço: as comuns do portão 1 e as do critério de pronto do tipo (a especificação decide).
    comuns = [c["id"] for c in spec.checagens_comuns]
    do_tipo = (tipo.get("criterio_de_pronto") or {}).get("codigo") or []
    modelo["checagens_a_rodar"] = comuns + [i for i in do_tipo if i not in comuns]
    parametros = {c["id"]: c["parametros"] for c in tipo["checagens_codigo"] if c.get("parametros")}
    if parametros:
        modelo["parametros_das_checagens"] = parametros
    return modelo
