"""Confere o CONTEXTO da execução antes de qualquer checagem.

O contexto vem do motor (não do agente). Se ele estiver mal montado, o validador para com ErroDeContexto e uma
mensagem dizendo onde está o erro: é defeito de quem chamou, não da entrega. Assim as checagens podem confiar
na forma dos dados, e um erro de digitação numa opção (ex.: "proibir_termo_de_ganho") não desliga uma checagem em silêncio.
"""
from datetime import date

TIPOS_DE_CAMPO = {"texto", "lista", "tabela", "numero", "citacao", "modelo_de_calculo"}
OPCOES_BOOLEANAS = {"proibir_termos_de_ganho", "exige_fontes", "confere_leis", "exigir_termos_lidos_por_inteiro",
                    "exige_modelo_de_calculo", "numeros_do_texto_vem_do_modelo"}
OPCOES_DE_LISTA = {"secoes_dos_temas"}


class ErroDeContexto(ValueError):
    """O contexto recebido está malformado (erro de quem chama o validador, não defeito da entrega)."""


def _e(msg):
    raise ErroDeContexto(msg)


def _texto(v, onde, vazio_ok=False):
    if not isinstance(v, str) or (not vazio_ok and not v.strip()):
        _e(f"{onde} deve ser um texto{'' if vazio_ok else ' não vazio'}.")


def _lista_de_textos(v, onde):
    if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
        _e(f"{onde} deve ser uma lista de textos.")


def _inteiro(v, onde, minimo=None):
    if isinstance(v, bool) or not isinstance(v, int) or (minimo is not None and v < minimo):
        _e(f"{onde} deve ser um número inteiro{'' if minimo is None else f' maior ou igual a {minimo}'}.")


def _objeto(v, onde):
    if not isinstance(v, dict):
        _e(f"{onde} deve ser um objeto.")


def _lista_de_objetos(v, onde):
    if not isinstance(v, list) or not all(isinstance(x, dict) for x in v):
        _e(f"{onde} deve ser uma lista de objetos.")


def _modelo(m):
    _objeto(m, "contexto.modelo")
    if "secoes" in m:
        _lista_de_objetos(m["secoes"], "contexto.modelo.secoes")
        vistos = set()
        for i, s in enumerate(m["secoes"]):
            onde = f"contexto.modelo.secoes[{i}]"
            _texto(s.get("id"), onde + ".id")
            if s["id"] in vistos:
                _e(f"{onde}.id repetido: {s['id']}")
            vistos.add(s["id"])
            if not (isinstance(s.get("tipo_de_campo", "texto"), str) and s.get("tipo_de_campo", "texto") in TIPOS_DE_CAMPO):
                _e(f"{onde}.tipo_de_campo deve ser um destes: {', '.join(sorted(TIPOS_DE_CAMPO))}.")
            for chave in ("obrigatoria", "exige_citacao"):
                if chave in s and not isinstance(s[chave], bool):
                    _e(f"{onde}.{chave} deve ser verdadeiro ou falso.")
            for chave in ("limite_caracteres", "itens_min", "itens_max"):
                if chave in s:
                    _inteiro(s[chave], f"{onde}.{chave}", 0)
            if "valores_permitidos" in s:
                _lista_de_textos(s["valores_permitidos"], onde + ".valores_permitidos")
            if s.get("tipo_de_campo") == "tabela":
                _lista_de_objetos(s.get("colunas"), onde + ".colunas")
                for j, col in enumerate(s["colunas"]):
                    _texto(col.get("id"), f"{onde}.colunas[{j}].id")
                    if col.get("tipo_de_campo", "texto") not in ("texto", "numero", "citacao"):
                        _e(f"{onde}.colunas[{j}].tipo_de_campo deve ser texto, numero ou citacao.")
    if "limite" in m:
        _inteiro(m["limite"], "contexto.modelo.limite", 1)
        if m["limite"] > 100_000:
            _e("contexto.modelo.limite não pode passar de 100000 caracteres.")
    for chave in ("acoes_permitidas", "acao_externa_permitida", "acoes_do_fundador"):
        if chave in m:
            _lista_de_textos(m[chave], f"contexto.modelo.{chave}")
    if "acao_do_fundador_do_plano" in m and m["acao_do_fundador_do_plano"] is not None:
        _texto(m["acao_do_fundador_do_plano"], "contexto.modelo.acao_do_fundador_do_plano")
    if "servico" in m:
        _texto(m["servico"], "contexto.modelo.servico")
    if "temas_obrigatorios" in m:
        _lista_de_objetos(m["temas_obrigatorios"], "contexto.modelo.temas_obrigatorios")
        for i, t in enumerate(m["temas_obrigatorios"]):
            _texto(t.get("id"), f"contexto.modelo.temas_obrigatorios[{i}].id")
            if "tema" in t:
                _texto(t["tema"], f"contexto.modelo.temas_obrigatorios[{i}].tema")
            if "termos" in t:
                _lista_de_textos(t["termos"], f"contexto.modelo.temas_obrigatorios[{i}].termos")
    if "validador" in m:
        v = m["validador"]
        _objeto(v, "contexto.modelo.validador")
        desconhecidas = sorted(set(v) - OPCOES_BOOLEANAS - OPCOES_DE_LISTA)
        if desconhecidas:
            _e(f"contexto.modelo.validador tem opção desconhecida: {', '.join(desconhecidas)}. "
               f"Opções válidas: {', '.join(sorted(OPCOES_BOOLEANAS | OPCOES_DE_LISTA))}.")
        for k in OPCOES_BOOLEANAS & set(v):
            if not isinstance(v[k], bool):
                _e(f"contexto.modelo.validador.{k} deve ser verdadeiro ou falso.")
        for k in OPCOES_DE_LISTA & set(v):
            _lista_de_textos(v[k], f"contexto.modelo.validador.{k}")


def _paginas(lista):
    _lista_de_objetos(lista, "contexto.paginas_lidas")
    ids = set()
    for i, p in enumerate(lista):
        onde = f"contexto.paginas_lidas[{i}]"
        _texto(p.get("leitura_id"), onde + ".leitura_id")
        if p["leitura_id"] in ids:
            _e(f"{onde}.leitura_id repetido: {p['leitura_id']}")
        ids.add(p["leitura_id"])
        _texto(p.get("url"), onde + ".url")
        for chave in ("tipo", "execucao"):
            if chave in p and p[chave] is not None:
                _texto(p[chave], f"{onde}.{chave}")
        if "partes" in p:
            partes = p["partes"]
            if not isinstance(partes, dict) or not partes:
                _e(f'{onde}.partes deve ser um objeto {{"1": texto, "2": texto...}}.')
            for k, v in partes.items():
                if not str(k).isdigit() or int(k) < 1:
                    _e(f"{onde}.partes: a chave {k!r} deve ser o número da parte (1, 2, 3...).")
                _texto(v, f"{onde}.partes[{k}]", vazio_ok=True)
        elif "texto" in p:
            _texto(p["texto"], onde + ".texto", vazio_ok=True)
        else:
            _e(f"{onde} precisa de 'partes' ou 'texto'.")
        if p.get("partes_total") is not None:
            _inteiro(p["partes_total"], onde + ".partes_total", 1)


def _fontes(lista):
    _lista_de_objetos(lista, "contexto.fontes_importadas")
    ids = set()
    for i, f in enumerate(lista):
        onde = f"contexto.fontes_importadas[{i}]"
        _texto(f.get("fonte_importada_id"), onde + ".fonte_importada_id")
        if f["fonte_importada_id"] in ids:
            _e(f"{onde}.fonte_importada_id repetido.")
        ids.add(f["fonte_importada_id"])
        _texto(f.get("texto", ""), onde + ".texto", vazio_ok=True)
        if "url" in f:
            _texto(f["url"], onde + ".url", vazio_ok=True)


def validar_tabela_de_leis(dados):
    """Confere a forma e a coerência da tabela de leis (a do arquivo dados/leis.json ou a do contexto)."""
    if not isinstance(dados, dict) or not isinstance(dados.get("leis"), list):
        _e("A tabela de leis precisa de uma lista 'leis'.")
    ids = set()
    for i, lei in enumerate(dados["leis"]):
        onde = f"tabela_de_leis.leis[{i}]"
        _objeto(lei, onde)
        for campo in ("id", "nome", "status"):
            _texto(lei.get(campo), f"{onde}.{campo}")
        if lei["id"] in ids:
            _e(f"Lei repetida na tabela: {lei['id']}")
        ids.add(lei["id"])
        if lei["status"] not in ("NAO_CONFERIDA", "CONFERIDA"):
            _e(f"{lei['id']}: status deve ser NAO_CONFERIDA ou CONFERIDA.")
        _texto(lei.get("texto_oficial_a_conferir", ""), f"{lei['id']}.texto_oficial_a_conferir", vazio_ok=True)
        if lei["status"] == "CONFERIDA" and not lei["texto_oficial_a_conferir"].strip():
            _e(f"{lei['id']}: status CONFERIDA exige o texto oficial preenchido.")
        if lei["status"] == "CONFERIDA" and not lei.get("data_da_conferencia"):
            _e(f"{lei['id']}: status CONFERIDA exige data_da_conferencia.")
        if "apelidos" in lei:
            _lista_de_textos(lei["apelidos"], f"{lei['id']}.apelidos")
        if "artigos_com_nota_obrigatoria" in lei:
            _lista_de_textos(lei["artigos_com_nota_obrigatoria"], f"{lei['id']}.artigos_com_nota_obrigatoria")
        if "url_oficial" in lei:
            _texto(lei["url_oficial"], f"{lei['id']}.url_oficial", vazio_ok=True)
        if "norma" in lei:
            n = lei["norma"]
            _objeto(n, f"{lei['id']}.norma")
            _texto(n.get("tipo"), f"{lei['id']}.norma.tipo")
            _texto(n.get("numero"), f"{lei['id']}.norma.numero")
            _inteiro(n.get("ano"), f"{lei['id']}.norma.ano", 1)
    return dados


def conferir_contexto(c):
    """Levanta ErroDeContexto se o contexto estiver mal montado."""
    _objeto(c, "O contexto")
    if "hoje" in c and c["hoje"] is not None:
        try:
            date.fromisoformat(c["hoje"])
        except (ValueError, TypeError):
            _e("contexto.hoje deve ser uma data AAAA-MM-DD.")
    if c.get("execucao_id") is not None:
        _texto(c["execucao_id"], "contexto.execucao_id")
    if "modelo" in c and c["modelo"] is not None:
        _modelo(c["modelo"])
    _paginas(c.get("paginas_lidas") or [])
    _fontes(c.get("fontes_importadas") or [])
    _lista_de_textos(c.get("links_do_pedido") or [], "contexto.links_do_pedido")
    decisoes = c.get("decisoes_vigentes") or []
    _lista_de_objetos(decisoes, "contexto.decisoes_vigentes")
    for i, d in enumerate(decisoes):
        _texto(d.get("id"), f"contexto.decisoes_vigentes[{i}].id")
    if c.get("usou_internet") not in (None, "SIM", "NAO", True, False):
        _e("contexto.usou_internet deve ser SIM ou NAO.")
    if c.get("entregas_aprovadas") is not None:
        _lista_de_textos(c["entregas_aprovadas"], "contexto.entregas_aprovadas")
    if c.get("tabela_de_leis"):
        validar_tabela_de_leis(c["tabela_de_leis"])
