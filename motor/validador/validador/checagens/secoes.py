"""Portão 1, parte B: o MODELO do serviço — seções presentes, no formato certo, e dentro do tamanho."""
from .. import texto as T
from ..contexto import ErroDeContexto
from ..numeros import para_decimal
from ..registro import CONFIG, checagem
from ..resultado import Falha

ID1, ID2 = "CHK-COMUM-01", "CHK-COMUM-02"

PLACEHOLDERS = {"n/a", "na", "n.a.", "todo", "tbd", "a definir", "...", "…", "-", "—", "xxx", "preencher", "lorem ipsum"}
TIPOS_DE_CAMPO = {"texto", "lista", "tabela", "numero", "citacao", "modelo_de_calculo"}


def _vazio(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return v.strip() == "" or v.strip().lower() in PLACEHOLDERS
    if isinstance(v, (list, dict)):
        return len(v) == 0
    return False


def _forma_numero(v) -> bool:
    return isinstance(v, dict) and para_decimal(v.get("valor")) is not None and isinstance(v.get("unidade"), str) \
        and v["unidade"].strip() != "" and isinstance(v.get("origem"), str)


def _forma_citacao(v) -> bool:
    return isinstance(v, dict) and isinstance(v.get("trecho_original"), str) and v["trecho_original"].strip() != ""


def _forma_da_secao(secao: dict, v, caminho: str) -> list:
    """Confere se o valor tem a forma do tipo_de_campo da seção. Devolve falhas."""
    sid, tipo = secao["id"], secao.get("tipo_de_campo", "texto")
    if tipo not in TIPOS_DE_CAMPO:
        raise ErroDeContexto(f"Modelo: a seção '{sid}' tem tipo_de_campo desconhecido: {tipo!r}.")
    f = []

    def erro(motivo, msg, item=caminho, trecho=""):
        f.append(Falha(ID1, motivo, item, msg, trecho))

    if tipo == "texto":
        if not isinstance(v, str):
            erro("FORMATO_DA_SECAO", f"A seção '{sid}' deve ser um texto.")
        elif "valores_permitidos" in secao and v.strip() not in secao["valores_permitidos"]:
            erro("VALOR_FORA_DA_LISTA", f"A seção '{sid}' deve ser um destes: {', '.join(secao['valores_permitidos'])}.", trecho=T.cortar(v))
    elif tipo in ("lista", "tabela"):
        if not isinstance(v, list):
            erro("FORMATO_DA_SECAO", f"A seção '{sid}' deve ser uma lista.")
            return f
        mn, mx = secao.get("itens_min"), secao.get("itens_max")
        if (mn is not None and len(v) < mn) or (mx is not None and len(v) > mx):
            erro("ITENS_FORA_DO_LIMITE", f"A seção '{sid}' deve ter de {mn if mn is not None else 0} a {mx if mx is not None else 'quantos precisar'} itens; tem {len(v)}.")
        for i, item in enumerate(v):
            cam = f"{caminho}[{i}]"
            if tipo == "lista":
                if not (isinstance(item, str) or (isinstance(item, dict) and isinstance(item.get("texto"), str))):
                    erro("FORMATO_DO_ITEM", "Cada item da lista deve ser um texto ou um objeto com 'texto' (e 'citacoes').", cam)
                elif isinstance(item, dict) and "citacoes" in item and not (isinstance(item["citacoes"], list) and all(_forma_citacao(c) for c in item["citacoes"])):
                    erro("FORMATO_DO_ITEM", "'citacoes' deve ser uma lista de citações, cada uma com 'trecho_original'.", cam)
            else:
                colunas = {c["id"]: c.get("tipo_de_campo", "texto") for c in secao.get("colunas", [])}
                # coluna com `obrigatoria: false` no modelo pode faltar na linha; sem o campo, falta é erro
                facultativas = {c["id"] for c in secao.get("colunas", []) if c.get("obrigatoria", True) is False}
                if not isinstance(item, dict):
                    erro("FORMATO_DO_ITEM", "Cada linha da tabela deve ser um objeto com as colunas do modelo.", cam)
                    continue
                for c in colunas:
                    if c not in item and c not in facultativas:
                        erro("COLUNA_FALTANDO", f"A linha da tabela não tem a coluna '{c}'.", cam, c)
                for c in item:
                    if c not in colunas:
                        erro("COLUNA_DESCONHECIDA", f"A coluna '{c}' não existe no modelo da seção '{sid}'.", cam, c)
                for c, tc in colunas.items():
                    if c in item:
                        cel = item[c]
                        bom = isinstance(cel, str) if tc == "texto" else (_forma_numero(cel) or para_decimal(cel) is not None) if tc == "numero" else _forma_citacao(cel)
                        if not bom:
                            erro("FORMATO_DA_CELULA", f"A coluna '{c}' deve ser do tipo {tc}.", f"{cam}.{c}")
    elif tipo == "numero":
        if not _forma_numero(v):
            erro("FORMATO_DA_SECAO", f"A seção '{sid}' deve ser um número com 'valor', 'unidade' e 'origem'.")
    elif tipo == "citacao":
        if not _forma_citacao(v):
            erro("FORMATO_DA_SECAO", f"A seção '{sid}' deve ser uma citação com 'trecho_original'.")
    elif tipo == "modelo_de_calculo":
        if not (isinstance(v, dict) and isinstance(v.get("entradas"), list) and isinstance(v.get("formulas"), list)):
            erro("FORMATO_DA_SECAO", f"A seção '{sid}' deve ser um modelo de cálculo com listas 'entradas' e 'formulas'.")
    return f


@checagem(ID1, "Seções do modelo presentes, preenchidas e no formato",
          "Entrega sem uma seção do modelo (ou com seção inventada, vazia ou no formato errado) chegava ao fundador como se estivesse completa.",
          ["K-13", "A-17"])
def secoes_do_modelo(exe):
    if exe.acao != "ENTREGAR":
        return None
    secoes = exe.modelo.get("secoes")
    if not secoes:
        raise ErroDeContexto("O modelo do serviço não traz 'secoes': sem ele não há o que conferir.")
    entrega, falhas = exe.acao_obj["entrega"], []
    conhecidas = {s["id"] for s in secoes}
    for sid in entrega:
        if sid not in conhecidas:
            falhas.append(Falha(ID1, "SECAO_DESCONHECIDA", f"entrega.{sid}", f"A seção '{sid}' não existe no modelo deste serviço.", sid))
    for s in secoes:
        sid, cam = s["id"], f"entrega.{s['id']}"
        if sid not in entrega:
            if s.get("obrigatoria", True):
                falhas.append(Falha(ID1, "SECAO_AUSENTE", cam, f"Falta a seção obrigatória '{sid}' ({s.get('titulo', sid)}).", sid))
            continue
        v = entrega[sid]
        if _vazio(v):
            if s.get("obrigatoria", True):
                falhas.append(Falha(ID1, "SECAO_VAZIA", cam, f"A seção obrigatória '{sid}' está vazia ou só tem um preenchimento de enfeite.", T.cortar(str(v))))
            continue
        falhas += _forma_da_secao(s, v, cam)
    return falhas


@checagem(ID2, "Tamanho dentro do limite",
          "Entrega gigante escondia o defeito no meio do texto e cansava o revisor; o modelo fixa o limite em caracteres.",
          ["CONF-21"])
def tamanho(exe):
    if exe.acao != "ENTREGAR":
        return None
    falhas = []
    total = sum(len(i.texto) for i in exe.itens)
    limite = exe.modelo.get("limite", CONFIG["tamanho"]["limite_padrao"])
    if total > limite:
        falhas.append(Falha(ID2, "ENTREGA_GRANDE_DEMAIS", "entrega",
                            f"A entrega tem {total} caracteres e o limite do modelo é {limite}. Divida ou resuma.", f"{total} > {limite}"))
    for s in exe.modelo.get("secoes", []):
        lim = s.get("limite_caracteres")
        if lim:
            n = sum(len(i.texto) for i in exe.itens if i.secao == s["id"])
            if n > lim:
                falhas.append(Falha(ID2, "SECAO_GRANDE_DEMAIS", f"entrega.{s['id']}",
                                    f"A seção '{s['id']}' tem {n} caracteres e o limite dela é {lim}.", f"{n} > {lim}"))
    return falhas
