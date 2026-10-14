"""Dossiê do Ravi, parte 1: as cinco checagens das TABELAS (forma, entidade, fatos, separação e lacunas).

O que é: o código de CHK-DOSSIE-FORMA, -ENTIDADE, -FATOS, -SEPARACAO e -LACUNAS. Valem só para a entrega do tipo dossiê
(modelo com a seção 'entidade'); para qualquer outro tipo dizem "não se aplica".
De onde vem: helena-v2/deliverables/dossie.yaml (checagens_codigo). O id, a gravidade e os furos do @checagem são os do YAML;
tamanhos, prefixo da interpretação e listas de palavras vêm de exe.parametros(...) (o bloco `parametros` do YAML): nada disso é copiado.
O que o YAML escreve no cabeçalho e não vira parâmetro: a letra dos ids (F, S, I, L: apoio.LETRA_DO_ID).
Como mudar: número ou lista => no YAML do tipo, não aqui. Regra nova => função nova neste arquivo, com @checagem, um defeito em
helena-v2/casos/SRV-DOSSIE/defeitos/ e a linha no quadro do README.
Cada falha diz o item exato (entrega.fatos[3].fontes) e o que o autor deve corrigir. Linha ou célula fora do formato é recusada
pela CHK-DOSSIE-FORMA; as outras checagens ignoram o que não conseguem ler (a entrega já volta ao autor).
"""
import re

from ..contexto import ErroDeContexto
from ..registro import checagem
from ..resultado import Falha
from . import spec_dossie_apoio as A

ID_FORMA = "CHK-DOSSIE-FORMA"
ID_ENTIDADE = "CHK-DOSSIE-ENTIDADE"
ID_FATOS = "CHK-DOSSIE-FATOS"
ID_SEPARACAO = "CHK-DOSSIE-SEPARACAO"
ID_LACUNAS = "CHK-DOSSIE-LACUNAS"


# ---------------------------------------------------------------------------------------
# CHK-DOSSIE-FORMA
# ---------------------------------------------------------------------------------------
@checagem(ID_FORMA, "Dossiê: só as seções e colunas do tipo, com células dentro do limite",
          "O dossiê podia chegar com seção inventada ('conclusao', 'recomendacao'), coluna a mais ou célula gigante, "
          "escondendo opinião e decisão onde só cabe fato.",
          ["K-13", "CONF-21"])
def forma(exe):
    if not A.e_dossie(exe):
        return None
    maximo = A.parametros(exe, ID_FORMA, {"maximo": "limites"})["maximo"]
    secoes = {s["id"]: s for s in exe.modelo.get("secoes") or []}
    falhas = []
    for sid, valor in A.entrega_do(exe).items():
        cam, secao = f"entrega.{sid}", secoes.get(sid)
        if secao is None:
            falhas.append(Falha(ID_FORMA, "SECAO_A_MAIS", cam,
                                f"A seção '{sid}' não existe neste tipo de entrega. As seções são: {', '.join(secoes)}.", A.cortar(sid)))
            continue
        if secao.get("tipo_de_campo") != "tabela":
            continue
        if not isinstance(valor, list):
            falhas.append(Falha(ID_FORMA, "SECAO_FORA_DO_FORMATO", cam, f"A seção '{sid}' deve ser uma lista de linhas, uma por item.", A.cortar(valor)))
            continue
        colunas = {c["id"]: c.get("tipo_de_campo", "texto") for c in secao.get("colunas", [])}
        for i, linha in enumerate(valor):
            if not isinstance(linha, dict):
                falhas.append(Falha(ID_FORMA, "LINHA_FORA_DO_FORMATO", f"{cam}[{i}]",
                                    "Cada linha da tabela deve ter as colunas do modelo (nome da coluna e valor).", A.cortar(linha)))
                continue
            for coluna, celula in linha.items():
                falhas += _conferir_celula(f"{cam}[{i}].{coluna}", coluna, celula, colunas, maximo)
    return falhas


def _conferir_celula(item, coluna, celula, colunas, maximo) -> list:
    if coluna not in colunas:
        return [Falha(ID_FORMA, "COLUNA_A_MAIS", item, f"A coluna '{coluna}' não existe neste modelo. As colunas da seção são: {', '.join(colunas)}.", A.cortar(coluna))]
    if colunas[coluna] == "citacao":
        texto, campo = (celula.get("trecho_original") if isinstance(celula, dict) else None), "trecho_original"
    else:
        texto, campo = celula, coluna
    if not isinstance(texto, str):
        esperado = "uma citação (com o trecho_original)" if campo == "trecho_original" else "um texto"
        return [Falha(ID_FORMA, "CELULA_FORA_DO_FORMATO", item, f"A coluna '{coluna}' deve ser {esperado}.", A.cortar(celula))]
    limite, tamanho = maximo.get(campo), len(A.normal(texto))
    if limite is not None and tamanho > limite:
        return [Falha(ID_FORMA, "CELULA_GRANDE_DEMAIS", item,
                      f"O texto de '{campo}' tem {tamanho} caracteres e o máximo é {limite}. Escreva mais curto, em palavras simples.", A.cortar(texto))]
    return []


# ---------------------------------------------------------------------------------------
# CHK-DOSSIE-ENTIDADE
# ---------------------------------------------------------------------------------------
@checagem(ID_ENTIDADE, "Dossiê: uma só entidade, de tipo conhecido, com o nome que está no pedido",
          "O dossiê podia falar de outra plataforma, empresa ou norma que não a do pedido (ou de várias ao mesmo tempo), "
          "e o fundador ler como se fosse a entidade pedida.",
          ["C-8"])
def entidade(exe):
    if not A.e_dossie(exe):
        return None
    tipos = A.parametros(exe, ID_ENTIDADE, {"tipos": "termos"})["tipos"]
    pedidos = [A.dobra(t) for t in A.textos_do_pedido(exe)]
    if not pedidos:
        raise ErroDeContexto("CHK-DOSSIE-ENTIDADE: o pedido do card não veio no contexto (fonte FON-PEDIDO-... ou pedido.card.ordem_de_servico.pedido_original); "
                             "sem ele não há como conferir o nome da entidade.")
    valor = A.entrega_do(exe).get("entidade")
    cam = "entrega.entidade"
    n = len(valor) if isinstance(valor, list) else 0
    if n != 1:
        return [Falha(ID_ENTIDADE, "ENTIDADE_NAO_E_UMA", cam, f"A seção 'entidade' deve ter exatamente uma linha (uma só plataforma, empresa ou norma); tem {n}.", str(n))]
    linha = valor[0]
    if not isinstance(linha, dict):
        return [Falha(ID_ENTIDADE, "ENTIDADE_NAO_E_UMA", cam + "[0]", "A linha da entidade deve ter as colunas nome, tipo e pergunta.", A.cortar(linha))]
    falhas, tipo, nome_escrito = [], A.celula(linha, "tipo"), A.celula(linha, "nome")
    if tipo not in tipos:
        falhas.append(Falha(ID_ENTIDADE, "TIPO_DE_ENTIDADE_INVALIDO", cam + "[0].tipo", f"O tipo da entidade deve ser um destes: {', '.join(tipos)}.", A.cortar(tipo)))
    nome = A.dobra(nome_escrito)  # o nome inteiro, como palavra(s) inteira(s): 'Mimi' não vale para 'Mimix'
    if not (nome and any(re.search(r"(?<!\w)" + re.escape(nome) + r"(?!\w)", p) for p in pedidos)):
        quando = f"O nome da entidade ('{nome_escrito}') não aparece no pedido." if nome else "O nome da entidade está vazio."
        falhas.append(Falha(ID_ENTIDADE, "ENTIDADE_FORA_DO_PEDIDO", cam + "[0].nome",
                            quando + " O dossiê é sobre a entidade que o pedido cita: escreva o nome como está no pedido.", A.cortar(nome_escrito)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-DOSSIE-FATOS
# ---------------------------------------------------------------------------------------
@checagem(ID_FATOS, "Dossiê: todo fato preso a uma fonte que existe, toda fonte usada",
          "Fato sem fonte (ou fonte que ninguém usa, ou ids trocados) parecia fato comprovado e o fundador não via que faltava a página.",
          ["M-15", "C-8"])
def fatos(exe):
    if not A.e_dossie(exe):
        return None
    entrega = A.entrega_do(exe)
    falhas = A.ids_em_ordem(ID_FATOS, entrega, "fatos") + A.ids_em_ordem(ID_FATOS, entrega, "fontes")
    ids_das_fontes = {A.celula(l, "id") for _, l in A.linhas(entrega, "fontes")}
    usadas = set()
    for i, linha in A.linhas(entrega, "fatos"):
        refs, cam = A.separar_ids(linha.get("fontes")), f"entrega.fatos[{i}].fontes"
        if not refs:
            falhas.append(Falha(ID_FATOS, "FATO_SEM_FONTE", cam, "Todo fato aponta pelo menos uma fonte (S1, S2...). Este fato não aponta nenhuma.", A.cortar(A.celula(linha, "afirmacao"))))
        for ref in refs:
            if ref in ids_das_fontes:
                usadas.add(ref)
            else:
                falhas.append(Falha(ID_FATOS, "FONTE_INEXISTENTE", cam,
                                    f"O fato aponta a fonte '{ref}', que não existe na seção 'fontes'. Aponte um id de fonte que exista (S1, S2...).", A.cortar(ref)))
    for i, linha in A.linhas(entrega, "fontes"):
        if A.celula(linha, "id") not in usadas:
            falhas.append(Falha(ID_FATOS, "FONTE_SEM_FATO", f"entrega.fontes[{i}]",
                                "Esta fonte não é usada por nenhum fato. Tire a fonte ou ligue um fato a ela.", A.cortar(A.celula(linha, "id"))))
    if not A.linhas(entrega, "fatos") and not A.linhas(entrega, "lacunas"):
        falhas.append(Falha(ID_FATOS, "SEM_FATO_NEM_LACUNA", "entrega",
                            "O dossiê precisa de pelo menos um fato ou uma lacuna. Se as páginas não respondem, entregue a lacuna.", ""))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-DOSSIE-SEPARACAO
# ---------------------------------------------------------------------------------------
@checagem(ID_SEPARACAO, "Dossiê: fato, leitura e lacuna separados",
          "O autor podia misturar sua opinião ('ou seja', 'na prática') dentro do fato e o fundador ler como se a página dissesse aquilo.",
          ["C-13"])
def separacao(exe):
    if not A.e_dossie(exe):
        return None
    p = A.parametros(exe, ID_SEPARACAO, {"sem_diferenca_de_maiusculas_e_acentos": "bool", "palavra_inteira": "bool",
                                         "prefixo_da_interpretacao": "str", "termos": "termos"})
    ignora = p["sem_diferenca_de_maiusculas_e_acentos"]
    achar = A.busca_de_termos(p["termos"], p["palavra_inteira"], ignora)
    entrega, falhas = A.entrega_do(exe), []
    for secao, coluna in (("fatos", "afirmacao"), ("lacunas", "o_que_falta")):  # o YAML diz: "coluna afirmacao de fatos e coluna o_que_falta de lacunas"
        for i, linha in A.linhas(entrega, secao):
            texto = linha.get(coluna)
            achados = achar(texto) if isinstance(texto, str) else []
            if achados:
                onde = "No fato" if secao == "fatos" else "Na lacuna"
                falhas.append(Falha(ID_SEPARACAO, "EXPRESSAO_DE_LEITURA", f"entrega.{secao}[{i}].{coluna}",
                                    f"{onde} aparece '{', '.join(achados)}', que é leitura sua. Fato diz só o que a página diz; "
                                    f"a sua leitura vai na seção 'interpretacoes', começando com '{p['prefixo_da_interpretacao']}'.", A.cortar(texto)))
    falhas += A.ids_em_ordem(ID_SEPARACAO, entrega, "interpretacoes")
    prefixo = A.dobra(p["prefixo_da_interpretacao"], ignora)
    ids_dos_fatos = {A.celula(l, "id") for _, l in A.linhas(entrega, "fatos")}
    for i, linha in A.linhas(entrega, "interpretacoes"):
        cam = f"entrega.interpretacoes[{i}]"
        if not A.dobra(linha.get("leitura"), ignora).startswith(prefixo):
            falhas.append(Falha(ID_SEPARACAO, "INTERPRETACAO_SEM_PREFIXO", cam + ".leitura",
                                f"Toda interpretação começa com '{p['prefixo_da_interpretacao']}', para ninguém confundir com o que a página diz.", A.cortar(linha.get("leitura"))))
        refs = A.separar_ids(linha.get("baseada_em"))
        if not refs:
            falhas.append(Falha(ID_SEPARACAO, "INTERPRETACAO_SEM_FATO", cam + ".baseada_em",
                                "Toda interpretação aponta os fatos em que se apoia (F1, F2...). Esta não aponta nenhum.", A.cortar(A.celula(linha, "leitura"))))
        for ref in refs:
            if ref not in ids_dos_fatos:
                falhas.append(Falha(ID_SEPARACAO, "FATO_INEXISTENTE", cam + ".baseada_em",
                                    f"A interpretação se apoia no fato '{ref}', que não existe na seção 'fatos'.", A.cortar(ref)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-DOSSIE-LACUNAS
# ---------------------------------------------------------------------------------------
@checagem(ID_LACUNAS, "Dossiê: lacuna completa, com o documento que falta e onde procurar",
          "Lacuna vaga ('a definir') ou que afirma 'o documento não existe' parecia resposta, e ninguém ficava sabendo o que procurar nem onde.",
          ["C-13", "M-15"])
def lacunas(exe):
    if not A.e_dossie(exe):
        return None
    p = A.parametros(exe, ID_LACUNAS, {"caracteres_min": "int", "sem_diferenca_de_maiusculas_e_acentos": "bool",
                                       "textos_vazios": "termos", "afirma_inexistencia": "termos"})
    ignora = p["sem_diferenca_de_maiusculas_e_acentos"]
    vazios = {A.aparar(A.dobra(t, ignora)) for t in p["textos_vazios"]}
    afirma = A.busca_de_termos(p["afirma_inexistencia"], False, ignora)  # sem "palavra inteira": 'inexistência' também é dizer que não existe
    entrega = A.entrega_do(exe)
    falhas = A.ids_em_ordem(ID_LACUNAS, entrega, "lacunas")
    for i, linha in A.linhas(entrega, "lacunas"):
        cam, formas = f"entrega.lacunas[{i}]", {}
        for coluna in ("documento_que_falta", "onde_procurar"):
            formas[coluna] = A.aparar(A.dobra(linha.get(coluna), ignora))
            if len(formas[coluna]) < p["caracteres_min"] or formas[coluna] in vazios:
                falhas.append(Falha(ID_LACUNAS, "CAMPO_VAZIO", f"{cam}.{coluna}",
                                    f"A coluna '{coluna}' está vazia, curta demais (mínimo {p['caracteres_min']} caracteres) ou é um texto de enfeite ('a definir', 'n/a'...). "
                                    "Diga o documento que falta e o lugar concreto onde procurar.", A.cortar(A.celula(linha, coluna))))
        if formas["documento_que_falta"] and formas["documento_que_falta"] == formas["onde_procurar"]:
            falhas.append(Falha(ID_LACUNAS, "ONDE_IGUAL_AO_DOCUMENTO", f"{cam}.onde_procurar",
                                "'onde_procurar' repete o documento. Diga o lugar (página, seção ou tela) onde você procura o documento.", A.cortar(A.celula(linha, "onde_procurar"))))
        for coluna in ("o_que_falta", "documento_que_falta", "onde_procurar"):
            achados = afirma(linha.get(coluna)) if isinstance(linha.get(coluna), str) else []
            if achados:
                falhas.append(Falha(ID_LACUNAS, "AFIRMA_INEXISTENCIA", f"{cam}.{coluna}",
                                    f"A lacuna diz '{', '.join(achados)}'. Lacuna não prova que o documento não existe: diga só que as páginas lidas não o trazem.", A.cortar(A.celula(linha, coluna))))
    return falhas
