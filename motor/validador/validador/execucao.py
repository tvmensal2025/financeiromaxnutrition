"""Prepara tudo o que as checagens precisam: a resposta do agente (lida uma vez) e o contexto da execução.

A Execucao reúne:
  - a ação do agente (ENTREGAR, PERGUNTAR...) e o que há de errado no FORMATO dela;
  - todos os textos (Item), agrupados por afirmação (Grupo), com as citações de cada grupo;
  - os números com origem, os modelos de cálculo e os dados do contexto (páginas lidas, modelo do serviço...).

Contexto esperado (JSON) — ver README, seção "O que o validador recebe".
"""
import json
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from . import texto as T
from .contexto import conferir_contexto

ACOES_LIBERADAS = ("ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA")
ACOES_CONHECIDAS = ACOES_LIBERADAS + ("PEDIR_SUBCARD",)
MAX_RESPOSTA = 1_000_000  # caracteres; acima disso nem lemos

# Campos permitidos e obrigatórios de cada ação (espelha helena-v2/schemas/acao.schema.json).
CAMPOS = {
    "ENTREGAR": ({"acao", "parecer", "acao_externa", "entrega", "autoavaliacao"}, {"acao", "parecer", "acao_externa", "entrega"}),
    "PERGUNTAR": ({"acao", "pergunta", "opcoes", "recomendacao"}, {"acao", "pergunta", "opcoes"}),
    "DEVOLVER_A_QUEM_PEDIU": ({"acao", "motivo", "explicacao"}, {"acao", "motivo", "explicacao"}),
    "REGISTRAR_FALHA": ({"acao", "motivo_falha", "explicacao"}, {"acao", "motivo_falha", "explicacao"}),
}
ENUMS = {
    ("ENTREGAR", "parecer"): {"OK", "AJUSTE", "NAO_PODE"},
    ("DEVOLVER_A_QUEM_PEDIU", "motivo"): {"PEDIDO_AMBIGUO", "PEDIDO_IMPOSSIVEL", "FORA_DO_SERVICO", "CONFLITA_COM_O_QUE_NAO_PODE"},
    ("REGISTRAR_FALHA", "motivo_falha"): {"NAO_CONSIGO", "FALTAM_DADOS", "FONTE_INSUFICIENTE"},
    ("PERGUNTAR", "recomendacao"): {"A", "B", "C"},
}
TAMANHOS = {  # (ação, campo): (mínimo, máximo) de caracteres
    ("PERGUNTAR", "pergunta"): (10, 300),
    ("DEVOLVER_A_QUEM_PEDIU", "explicacao"): (10, 500),
    ("REGISTRAR_FALHA", "explicacao"): (10, 500),
}
CAMPOS_QUE_NAO_SAO_TEXTO = {"acao", "parecer", "acao_externa", "entrega", "motivo", "motivo_falha", "recomendacao"}


# ---------------------------------------------------------------------------------------
# Peças
# ---------------------------------------------------------------------------------------
@dataclass
class Pagina:
    leitura_id: str
    url: str
    tipo: str
    execucao: str | None
    partes_total: int
    partes: dict  # número da parte -> texto
    _cache: dict = field(default_factory=dict)

    def parte_b(self, n: int) -> str | None:
        """Texto da parte `n` na forma B (normalizado, com quebras de linha)."""
        if n not in self.partes:
            return None
        if ("b", n) not in self._cache:
            self._cache[("b", n)] = T.normalizar_com_quebras(self.partes[n])
        return self._cache[("b", n)]

    def parte_chave(self, n: int) -> str | None:
        """Texto da parte `n` na forma A em minúsculas (mesmas posições da forma B)."""
        if n not in self.partes:
            return None
        if ("k", n) not in self._cache:
            self._cache[("k", n)] = self.parte_b(n).replace("\n", " ").lower()
        return self._cache[("k", n)]

    def parte_dobrada(self, n: int) -> str | None:
        """Texto da parte `n` sem acento nem maiúscula (para procurar termos). Guardado para não repetir a conta."""
        if n not in self.partes:
            return None
        if ("d", n) not in self._cache:
            self._cache[("d", n)] = T.dobrar(self.parte_b(n))
        return self._cache[("d", n)]

    def partes_faltando(self) -> list:
        return [n for n in range(1, self.partes_total + 1) if n not in self.partes]


@dataclass
class Grupo:
    """Uma afirmação: um item de lista, uma linha de tabela, um texto. Guarda as citações que a sustentam."""
    caminho: str
    secao: str
    citacoes: list = field(default_factory=list)
    ausencia: dict | None = None
    itens: list = field(default_factory=list)

    @property
    def texto(self) -> str:
        return " ".join(i.texto for i in self.itens if i.tipo == "livre")


@dataclass
class Item:
    """Uma linha de texto. tipo: livre (escrito pelo agente), original (trecho citado) ou traducao."""
    caminho: str
    texto: str
    tipo: str
    secao: str
    grupo: Grupo | None = None


@dataclass
class Citacao:
    caminho: str
    dados: dict
    grupo: Grupo


@dataclass
class NumeroComOrigem:
    caminho: str
    dados: dict


# ---------------------------------------------------------------------------------------
# Ler a resposta
# ---------------------------------------------------------------------------------------
def _sem_constantes(nome):
    raise ValueError(f"constante não permitida: {nome}")


class ChaveRepetida(ValueError):
    """Uma chave repetida torna ambígua a ação recebida em JSON."""


def _sem_chaves_repetidas(pares):
    obj = {}
    for chave, valor in pares:
        if chave in obj:
            raise ChaveRepetida(chave)
        obj[chave] = valor
    return obj


def _decodificador():
    return json.JSONDecoder(parse_float=Decimal, parse_constant=_sem_constantes,
                            object_pairs_hook=_sem_chaves_repetidas)


MAX_PROFUNDIDADE = 40


def _profundidade(obj) -> int:
    """Quantos níveis de lista/objeto uma dentro da outra (sem recursão, para não estourar com entrada maliciosa)."""
    maior, pilha = 0, [(obj, 1)]
    while pilha:
        o, n = pilha.pop()
        if isinstance(o, dict):
            maior = max(maior, n)
            pilha.extend((v, n + 1) for v in o.values() if isinstance(v, (dict, list)))
        elif isinstance(o, list):
            maior = max(maior, n)
            pilha.extend((v, n + 1) for v in o if isinstance(v, (dict, list)))
        if maior > MAX_PROFUNDIDADE:
            break
    return maior


def interpretar_resposta(resposta):
    """Devolve (objeto_da_acao | None, erros). Cada erro é (motivo, mensagem, trecho).

    O objeto só vem preenchido quando há EXATAMENTE UMA ação e o formato dela fecha.
    """
    erros = []
    obj = resposta
    if resposta is None or (isinstance(resposta, str) and not resposta.strip()):
        return None, [("NENHUMA_ACAO", "A resposta veio vazia: não há nenhuma ação. Devolva exatamente uma ação.", "")]
    if isinstance(resposta, (bytes, bytearray)):
        resposta = resposta.decode("utf-8", errors="replace")
    if isinstance(resposta, str) and len(resposta) > MAX_RESPOSTA:
        return None, [("FORA_DO_FORMATO", f"A resposta tem mais de {MAX_RESPOSTA} caracteres: grande demais para ser uma ação.", "")]
    if isinstance(resposta, str):
        dec, pos, docs, s = _decodificador(), 0, [], resposta
        while True:
            while pos < len(s) and s[pos].isspace():
                pos += 1
            if pos >= len(s):
                break
            try:
                doc, pos = dec.raw_decode(s, pos)
            except ChaveRepetida as erro:
                return None, [("CHAVE_REPETIDA", "O JSON repete uma chave. Devolva cada campo uma vez só.", T.cortar(str(erro)))]
            except (ValueError, RecursionError):
                if not docs:
                    return None, [("TEXTO_FORA_DO_FORMATO", "A resposta não é um JSON válido. Devolva só o objeto JSON da ação, sem texto em volta.", T.cortar(s[pos:]))]
                erros.append(("TEXTO_FORA_DO_FORMATO", "Há texto depois do JSON da ação. Devolva só o objeto JSON da ação.", T.cortar(s[pos:])))
                break
            docs.append(doc)
        if len(docs) > 1:
            return None, [("VARIAS_ACOES", f"A resposta traz {len(docs)} objetos JSON. Devolva exatamente uma ação.", "")]
        if not docs:
            return None, [("NENHUMA_ACAO", "A resposta não traz nenhuma ação.", "")]
        obj = docs[0]
        if erros:
            return None, erros
    if _profundidade(obj) > MAX_PROFUNDIDADE:
        return None, [("FORA_DO_FORMATO", f"A resposta tem objetos dentro de objetos em mais de {MAX_PROFUNDIDADE} níveis.", "")]
    if isinstance(obj, list):
        if len(obj) == 0:
            return None, [("NENHUMA_ACAO", "A resposta é uma lista vazia: não há nenhuma ação.", "")]
        if len(obj) > 1:
            return None, [("VARIAS_ACOES", f"A resposta traz {len(obj)} ações. Devolva exatamente uma.", "")]
        return None, [("FORA_DO_FORMATO", "A resposta deve ser UM objeto com o campo 'acao', não uma lista.", "")]
    if not isinstance(obj, dict):
        return None, [("FORA_DO_FORMATO", "A resposta deve ser um objeto JSON com o campo 'acao'.", T.cortar(str(obj)))]
    acoes_como_chave = [k for k in obj if k in ACOES_CONHECIDAS]
    if isinstance(obj.get("acoes"), list):
        n = len(obj["acoes"])
        return None, [("VARIAS_ACOES" if n > 1 else "NENHUMA_ACAO" if n == 0 else "FORA_DO_FORMATO",
                       "A resposta usa uma lista 'acoes'. Devolva UM objeto com o campo 'acao'.", "")]
    acao = obj.get("acao")
    outras = [k for k in acoes_como_chave if k != acao]
    if len(acoes_como_chave) > 1 or (isinstance(acao, str) and outras):
        return None, [("VARIAS_ACOES", f"A resposta traz mais de uma ação ({', '.join(sorted(set(acoes_como_chave) | ({acao} if isinstance(acao, str) else set())))}). Devolva exatamente uma.", "")]
    if isinstance(acao, list):
        n = len(acao)
        return None, [("VARIAS_ACOES" if n > 1 else "NENHUMA_ACAO" if n == 0 else "FORA_DO_FORMATO",
                       "O campo 'acao' deve ter UM nome só, não uma lista.", "")]
    if acao is None:
        if acoes_como_chave:
            return None, [("FORA_DO_FORMATO", "O nome da ação deve vir no campo 'acao', não como chave.", acoes_como_chave[0])]
        return None, [("NENHUMA_ACAO", "A resposta não tem o campo 'acao': não há nenhuma ação.", "")]
    if not isinstance(acao, str):
        return None, [("FORA_DO_FORMATO", "O campo 'acao' deve ser um texto.", "")]
    if acao not in ACOES_CONHECIDAS:
        return obj, []  # ação desconhecida: quem recusa é CHK-ACAO-02
    if acao == "PEDIR_SUBCARD":
        return obj, []  # desligado: quem recusa é CHK-ACAO-02
    return obj, _conferir_campos(acao, obj)


def _conferir_campos(acao: str, obj: dict) -> list:
    erros = []
    permitidos, obrigatorios = CAMPOS[acao]
    for c in sorted(obrigatorios - set(obj)):
        erros.append(("CAMPO_FALTANDO", f"A ação {acao} precisa do campo '{c}'.", c))
    for c in sorted(set(obj) - permitidos):
        erros.append(("CAMPO_DESCONHECIDO", f"O campo '{c}' não existe na ação {acao}.", c))
    for (a, c), validos in ENUMS.items():
        if a == acao and c in obj and not (isinstance(obj[c], str) and obj[c] in validos):
            erros.append(("VALOR_FORA_DA_LISTA", f"O campo '{c}' deve ser um destes: {', '.join(sorted(validos))}.", T.cortar(str(obj[c]))))
    for (a, c), (mn, mx) in TAMANHOS.items():
        if a == acao and c in obj:
            v = obj[c]
            if not isinstance(v, str) or not (mn <= len(v.strip()) <= mx):
                erros.append(("TAMANHO_DO_CAMPO", f"O campo '{c}' deve ser um texto de {mn} a {mx} caracteres.", T.cortar(str(v))))
    if acao == "ENTREGAR":
        if "entrega" in obj and not (isinstance(obj["entrega"], dict) and obj["entrega"]):
            erros.append(("CAMPO_FALTANDO", "O campo 'entrega' deve ser um objeto com uma chave por seção do modelo.", ""))
        if "autoavaliacao" in obj and not isinstance(obj["autoavaliacao"], str):
            erros.append(("VALOR_FORA_DA_LISTA", "O campo 'autoavaliacao' deve ser um texto.", ""))
    if acao == "PERGUNTAR" and "opcoes" in obj:
        op = obj["opcoes"]
        ok = isinstance(op, list) and 2 <= len(op) <= 3 and all(
            isinstance(o, dict) and set(o) == {"letra", "texto", "consequencia"} and o["letra"] == "ABC"[i]
            and isinstance(o["texto"], str) and 2 <= len(o["texto"]) <= 160
            and isinstance(o["consequencia"], str) and 2 <= len(o["consequencia"]) <= 200
            for i, o in enumerate(op)
        )
        if not ok:
            erros.append(("OPCOES_INVALIDAS", "As opções devem ser 2 ou 3 itens (A, B e C, nessa ordem), cada um só com letra, texto de 2 a 160 caracteres e consequencia de 2 a 200 caracteres.", ""))
        letras = {o.get("letra") for o in op if isinstance(o, dict)} if isinstance(op, list) else set()
        if obj.get("recomendacao") in ("A", "B", "C") and obj["recomendacao"] not in letras:
            erros.append(("RECOMENDACAO_SEM_OPCAO", "A recomendação deve apontar para uma das opções apresentadas.", obj["recomendacao"]))
    return erros


# ---------------------------------------------------------------------------------------
# A execução
# ---------------------------------------------------------------------------------------
def lista_ou_vazia(v) -> list:
    """O valor se for lista; senão lista vazia (a checagem de seções já recusa o formato errado)."""
    return v if isinstance(v, (list, tuple)) else []


def _e_citacao(v) -> bool:
    return isinstance(v, dict) and "trecho_original" in v


def _e_numero(v) -> bool:
    return isinstance(v, dict) and "valor" in v and "origem" in v and "entradas" not in v


def _e_modelo_de_calculo(v) -> bool:
    return isinstance(v, dict) and "entradas" in v and "formulas" in v


class Execucao:
    def __init__(self, resposta, contexto: dict):
        conferir_contexto(contexto)  # contexto mal montado: ErroDeContexto com a mensagem do que está errado
        self.contexto = contexto
        self.modelo = contexto.get("modelo") or {}
        self.opcoes = self.modelo.get("validador") or {}
        self.hoje = self._data(contexto.get("hoje")) or date.today()
        self.execucao_id = contexto.get("execucao_id")
        self.paginas = self._paginas(contexto.get("paginas_lidas") or [])
        self.fontes = self._fontes(contexto.get("fontes_importadas") or [])
        self.links_do_pedido = list(contexto.get("links_do_pedido") or [])
        self.decisoes = {d["id"]: d for d in contexto.get("decisoes_vigentes") or [] if isinstance(d, dict) and "id" in d}
        usou = contexto.get("usou_internet")
        self.usou_internet = (usou in ("SIM", True)) if usou is not None else bool(self.paginas)
        self.memoria: dict = {}

        # resposta
        self.resposta_bruta = resposta
        self.acao_obj, self.erros_de_formato = interpretar_resposta(resposta)
        self.acao = self.acao_obj.get("acao") if isinstance(self.acao_obj, dict) else None
        self.formato_ok = self.acao_obj is not None and not self.erros_de_formato

        # conteúdo
        self.itens: list = []
        self.grupos: list = []
        self.citacoes: list = []
        self.numeros: list = []
        self.modelos_de_calculo: list = []
        if self.formato_ok and self.acao in ACOES_LIBERADAS:
            try:
                self._coletar_resposta()
            except Exception as erro:  # noqa: BLE001 - conteúdo estranho nunca derruba o validador: vira formato errado
                self.erros_de_formato.append(("CONTEUDO_MALFORMADO", f"O conteúdo da ação não tem a forma esperada ({type(erro).__name__}). Siga o modelo do serviço.", ""))
                self.formato_ok = False

    # ---- contexto
    @staticmethod
    def _data(v):
        if isinstance(v, date):
            return v
        try:
            return date.fromisoformat(v) if isinstance(v, str) else None
        except ValueError:
            return None

    @staticmethod
    def _paginas(lista) -> dict:
        """Páginas lidas (o contexto já foi conferido em conferir_contexto)."""
        paginas = {}
        for p in lista:
            partes = {int(k): v for k, v in p["partes"].items()} if "partes" in p else {1: p["texto"]}
            total = p.get("partes_total") or len(partes)
            paginas[p["leitura_id"]] = Pagina(p["leitura_id"], p["url"], p.get("tipo") or "pagina", p.get("execucao"), total, partes)
        return paginas

    @staticmethod
    def _fontes(lista) -> dict:
        return {f["fonte_importada_id"]: Pagina(f["fonte_importada_id"], f.get("url", ""), "fonte_importada", None, 1, {1: f.get("texto", "")}) for f in lista}

    def memo(self, chave, calcular):
        """Guarda um cálculo caro para as outras checagens não repetirem."""
        if chave not in self.memoria:
            self.memoria[chave] = calcular()
        return self.memoria[chave]

    # ---- conteúdo
    def _coletar_resposta(self):
        obj = self.acao_obj
        if self.acao == "ENTREGAR":
            for sid, valor in obj["entrega"].items():
                self._coletar(valor, f"entrega.{sid}", str(sid), None)
            if isinstance(obj.get("autoavaliacao"), str):
                self._coletar(obj["autoavaliacao"], "autoavaliacao", "autoavaliacao", None)
        else:
            for k, v in obj.items():
                if k not in CAMPOS_QUE_NAO_SAO_TEXTO:
                    self._coletar(v, k, k, None)

    def _novo_grupo(self, caminho, secao, citacoes=None, ausencia=None) -> Grupo:
        g = Grupo(caminho, secao, citacoes or [], ausencia)
        self.grupos.append(g)
        return g

    def _adicionar_texto(self, texto: str, caminho: str, secao: str, grupo: Grupo):
        ls = T.linhas(texto)
        for k, linha in enumerate(ls):
            suf = f"#linha{k + 1}" if len(ls) > 1 else ""
            item = Item(caminho + suf, linha, "livre", secao, grupo)
            grupo.itens.append(item)
            self.itens.append(item)

    def _registrar_citacao(self, dados: dict, caminho: str, secao: str, grupo: Grupo):
        c = Citacao(caminho, dados, grupo)
        grupo.citacoes.append(c)
        self.citacoes.append(c)
        if isinstance(dados.get("trecho_original"), str):
            self.itens.append(Item(caminho + ".trecho_original", dados["trecho_original"], "original", secao, grupo))
        if isinstance(dados.get("traducao"), str):
            self.itens.append(Item(caminho + ".traducao", dados["traducao"], "traducao", secao, grupo))

    def _coletar(self, valor, caminho, secao, grupo):
        if isinstance(valor, str):
            g = grupo or self._novo_grupo(caminho, secao)
            self._adicionar_texto(valor, caminho, secao, g)
        elif isinstance(valor, (list, tuple)):
            for i, v in enumerate(valor):
                self._coletar(v, f"{caminho}[{i}]", secao, grupo)
        elif _e_citacao(valor):
            g = grupo or self._novo_grupo(caminho, secao)
            self._registrar_citacao(valor, caminho, secao, g)
        elif _e_modelo_de_calculo(valor):
            self.modelos_de_calculo.append((caminho, valor))
            for i, e in enumerate(lista_ou_vazia(valor.get("entradas"))):
                if isinstance(e, dict) and _e_citacao(e.get("citacao")):
                    self._registrar_citacao(e["citacao"], f"{caminho}.entradas[{i}].citacao", secao, self._novo_grupo(f"{caminho}.entradas[{i}]", secao))
        elif _e_numero(valor):
            self.numeros.append(NumeroComOrigem(caminho, valor))
            if _e_citacao(valor.get("citacao")):
                self._registrar_citacao(valor["citacao"], f"{caminho}.citacao", secao, self._novo_grupo(caminho, secao))
        elif isinstance(valor, dict):
            g = self._novo_grupo(caminho, secao, ausencia=valor.get("ausencia") if isinstance(valor.get("ausencia"), dict) else None)
            for i, c in enumerate(lista_ou_vazia(valor.get("citacoes"))):
                if _e_citacao(c):
                    self._registrar_citacao(c, f"{caminho}.citacoes[{i}]", secao, g)
            for chave, v in valor.items():
                if chave in ("citacoes", "ausencia"):
                    continue
                if _e_citacao(v):
                    self._registrar_citacao(v, f"{caminho}.{chave}", secao, g)
                elif _e_numero(v):
                    self.numeros.append(NumeroComOrigem(f"{caminho}.{chave}", v))
                    if _e_citacao(v.get("citacao")):
                        self._registrar_citacao(v["citacao"], f"{caminho}.{chave}.citacao", secao, g)
                elif isinstance(v, str):
                    self._adicionar_texto(v, f"{caminho}.{chave}", secao, g)
                else:
                    self._coletar(v, f"{caminho}.{chave}", secao, g)
        # outros tipos (números soltos, booleanos, None) não têm texto

    # ---- consultas usadas por várias checagens
    def pagina(self, leitura_id):
        """Página lida com esse id (ou None, inclusive quando o id vem em formato estranho)."""
        return self.paginas.get(leitura_id) if isinstance(leitura_id, str) else None

    def decisao(self, id_):
        return self.decisoes.get(id_) if isinstance(id_, str) else None

    def itens_livres(self):
        return [i for i in self.itens if i.tipo == "livre"]

    def opcao(self, nome: str, padrao=None):
        return self.opcoes.get(nome, padrao)

    def parametros(self, id_da_checagem: str) -> dict:
        """Os `parametros` que a especificação (helena-v2/deliverables/<tipo>.yaml) escreve para esta checagem.

        Vêm em `contexto["modelo"]["parametros_das_checagens"][id]`, entregues pelo adaptador (spec_helena). A função da checagem
        lê os números e as listas DAQUI, em vez de copiá-los para o código. Sem o bloco, devolve {} (o chamador decide o que fazer).
        """
        return (self.modelo.get("parametros_das_checagens") or {}).get(id_da_checagem) or {}
