"""Peças comuns das dez checagens do relatório final (CHK-REL-*). Aqui NÃO há regra de checagem.

O que é: funções pequenas que as checagens do relatório usam: achar as linhas das tabelas, ler as refs de uma linha, ler o
pacote que o código montou para a tarefa e achar os números de um texto.
De onde vem: a especificação é helena-v2/deliverables/relatorio_final.yaml. Os números, as listas e os padrões de cada checagem
vêm do bloco `parametros` dela (exe.parametros("CHK-REL-...")) e nada disso é copiado para cá. O que fica escrito aqui é só
vocabulário fixo do relatório (nomes de seção e de coluna, "nada", PEDIDO, prefixos AF- e PF-), com o motivo ao lado.
ATENÇÃO: o motor ainda não tem schema para a parte do relatório montada pelo código. O formato lido aqui é o do caso
helena-v2/casos/SRV-RELATORIO-FINAL/pedido.yaml (chaves card.plano.etapas, etapa_do_relatorio,
pacote_do_relatorio.entregas_aprovadas e pacote_do_relatorio.parte_montada_pelo_codigo). Quando o motor definir o formato
real, só a função `_ler_pacote` (e as constantes de nome) daqui muda; as checagens não.
Como mudar: nome de seção ou de coluna do relatório = constantes logo abaixo. Limite, lista ou padrão de uma checagem = o
`parametros` dela no YAML do tipo (nunca aqui).

Regra de segurança (falha fechada): pacote que falta é falha da entrega (PACOTE_INCOMPLETO: o certo era registrar a falha);
parâmetro que falta ou pacote com forma errada é erro de quem montou o contexto (ErroDeContexto, o validador para).
"""
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .. import texto as T
from ..contexto import ErroDeContexto
from ..numeros import para_decimal
from ..resultado import Falha

# ---- vocabulário fixo do relatório (helena-v2/deliverables/relatorio_final.yaml, cabeçalho e seções) --------------------
TIPO = "relatorio_final"             # modelo.tipo: as checagens daqui só rodam neste tipo
SECAO_DO_RESUMO = "resumo"
SECAO_DOS_PASSOS = "proximos_passos"
COLUNA_DAS_REFS = "refs"
COLUNA_DA_ORDEM = "ordem"
COLUNA_DO_DEPOIS_DE = "depois_de"
SEM_DEPENDENCIA = "nada"             # valor de 'depois_de' quando o passo não depende de nenhum outro
REF_DO_PEDIDO = "PEDIDO"             # ref que aponta para a ordem de serviço do card
PREFIXO_DA_ACAO_DO_FUNDADOR = "AF-"
PREFIXO_DO_PASSO_FIXO = "PF-"
# Campos da ordem de serviço que valem como fonte da ref PEDIDO (card.schema.json, $defs/ordem_de_servico).
# Os campos de texto do pedido original; o prazo é data, não fonte de quantidades para o resumo.
CAMPOS_DA_ORDEM_DE_SERVICO = ("pedido_original", "o_que_quer", "como_e_o_pronto", "nao_pode")


# ---------------------------------------------------------------------------------------
# Quando a checagem se aplica
# ---------------------------------------------------------------------------------------
def aplicavel(exe) -> bool:
    """Só roda em ENTREGAR bem formada de um serviço do tipo relatório final (nos outros tipos devolve 'não se aplica')."""
    return exe.modelo.get("tipo") == TIPO and exe.formato_ok and exe.acao == "ENTREGAR"


# ---------------------------------------------------------------------------------------
# Parâmetros da especificação (exe.parametros) com falha alta se faltarem
# ---------------------------------------------------------------------------------------
def _parametro(exe, id_, nome):
    par = exe.parametros(id_)
    if nome not in par:
        raise ErroDeContexto(f"{id_}: o `parametros` da especificação não traz '{nome}'. "
                             "O adaptador deve entregar o bloco `parametros` desta checagem (helena-v2/deliverables/relatorio_final.yaml).")
    return par[nome]


def parametro_textos(exe, id_, nome) -> list:
    v = _parametro(exe, id_, nome)
    if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
        raise ErroDeContexto(f"{id_}: o parâmetro '{nome}' deve ser uma lista não vazia de textos.")
    return v


def parametro_booleano(exe, id_, nome, padrao: bool) -> bool:
    v = exe.parametros(id_).get(nome, padrao)
    if not isinstance(v, bool):
        raise ErroDeContexto(f"{id_}: o parâmetro '{nome}' deve ser verdadeiro ou falso.")
    return v


def compilar(exe, id_, nome, ignorar_caixa: bool) -> list:
    """Os padrões (expressões regulares) do parâmetro `nome`, compilados. Padrão inválido na especificação para o validador."""
    saida = []
    for p in parametro_textos(exe, id_, nome):
        try:
            saida.append(re.compile(p, re.IGNORECASE if ignorar_caixa else 0))
        except re.error as erro:
            raise ErroDeContexto(f"{id_}: o padrão {p!r} do parâmetro '{nome}' não é uma expressão regular válida ({erro}).") from erro
    return saida


# ---------------------------------------------------------------------------------------
# As linhas das tabelas do relatório
# ---------------------------------------------------------------------------------------
@dataclass
class Linha:
    secao: str
    indice: int
    dados: dict

    @property
    def caminho(self) -> str:
        return f"entrega.{self.secao}[{self.indice}]"

    def celula(self, coluna: str):
        """O texto da célula, ou None se a coluna falta ou não é texto."""
        v = self.dados.get(coluna)
        return v if isinstance(v, str) else None

    def refs(self) -> list:
        """As refs da linha, separadas por vírgula, só com espaço aparado (nada mais é 'consertado': ref estranha fica estranha)."""
        v = self.celula(COLUNA_DAS_REFS)
        return [p.strip() for p in v.split(",")] if v is not None and v.strip() else []


def secoes_do_modelo(exe) -> list:
    secoes = exe.modelo.get("secoes")
    if not secoes:
        raise ErroDeContexto("O modelo do serviço não traz 'secoes': sem ele não há o que conferir.")
    return secoes


def linhas(exe, so_da_secao: str | None = None) -> list:
    """Cada linha (objeto) de cada tabela das seções DECLARADAS no modelo. Linha que não é objeto fica de fora: CHK-REL-SO-SECOES a recusa."""
    entrega = exe.acao_obj["entrega"]
    saida = []
    for s in secoes_do_modelo(exe):
        if so_da_secao is not None and s["id"] != so_da_secao:
            continue
        tabela = entrega.get(s["id"])
        if isinstance(tabela, list):
            saida += [Linha(s["id"], i, d) for i, d in enumerate(tabela) if isinstance(d, dict)]
    return saida


def celulas(exe, colunas: list) -> list:
    """[(linha, coluna, texto)] das colunas pedidas, em todas as linhas (célula que não é texto fica de fora: CHK-REL-TAMANHO-DAS-LINHAS a recusa)."""
    return [(l, c, l.celula(c)) for l in linhas(exe) for c in colunas if l.celula(c) is not None]


# ---------------------------------------------------------------------------------------
# Comparar texto com lista de termos (sem acento, sem maiúscula, por palavra inteira)
# ---------------------------------------------------------------------------------------
_NAO_LETRA = re.compile(r"[\W_]+")


def forma_de_comparacao(texto: str, ignorar_caixa_e_acento: bool) -> str:
    """O texto como lista de palavras separadas por UM espaço, para achar termos por palavra inteira (' ' + termo + ' ')."""
    base = T.dobrar(texto) if ignorar_caixa_e_acento else T.normalizar(texto)
    return " ".join(p for p in _NAO_LETRA.split(base) if p)


def termo_achado(texto: str, termos: list, ignorar_caixa_e_acento: bool):
    """O primeiro termo da lista que aparece no texto (como está na lista), ou None."""
    palavras = " " + forma_de_comparacao(texto, ignorar_caixa_e_acento) + " "
    for termo in termos:
        t = forma_de_comparacao(termo, ignorar_caixa_e_acento)
        if t and f" {t} " in palavras:
            return termo
        if t in {"renda garantida", "rendas garantidas", "ganho garantido", "ganhos garantidos"}:
            substantivo = t.split()[0].rstrip("s")
            formas = ("garantid", "assegurad")
            for forma in formas:
                if re.search(rf"(?<!\w){substantivo}s? {forma}[oa]s?(?!\w)", palavras):
                    return termo
    return None


# ---------------------------------------------------------------------------------------
# Números (formato brasileiro: ponto separa milhar e vírgula separa decimal; 2.500 = 2500 e 0,50 = 0,5)
# ---------------------------------------------------------------------------------------
_NUMERO = re.compile(r"\d+(?:[.,]\d+)*")
_MILHAR = re.compile(r"\d{1,3}(?:\.\d{3})+")
_MILHAR_INGLES = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?")
_DECIMAL_COM_PONTO = re.compile(r"\d+\.\d+")
MAX_DIGITOS = 30


def _canonico(d: Decimal) -> str:
    """O número na forma única de comparação (0,50 e 0,5 viram '0.5'; 10 e 10,0 viram '10')."""
    return format(d.normalize(), "f")


def _decimal(texto: str):
    try:
        d = Decimal(texto)
    except InvalidOperation:
        return None
    return d if d.is_finite() else None


def ler_brasileiro(bruto: str):
    """O número escrito no formato brasileiro na forma de comparação, ou None se o formato não é esse (ex.: 0.50 ou 1,2,3)."""
    inteira, virgula, decimal = bruto.partition(",")
    if "." in decimal or "," in decimal:
        return None
    if "." in inteira:
        if not _MILHAR.fullmatch(inteira):
            return None
        inteira = inteira.replace(".", "")
    if len(inteira) + len(decimal) > MAX_DIGITOS:
        return None
    d = _decimal(inteira + ("." + decimal if virgula else ""))
    return None if d is None else _canonico(d)


def numeros_do_texto_da_helena(texto: str) -> list:
    """[(como foi escrito, forma de comparação | None)] de cada número do texto, sem repetir. None = fora do formato brasileiro."""
    vistos, saida = set(), []
    for bruto in _NUMERO.findall(texto):
        if bruto not in vistos:
            vistos.add(bruto)
            saida.append((bruto, ler_brasileiro(bruto)))
    return saida


def _leituras_da_fonte(bruto: str) -> set:
    """Fonte é dado nosso: aceita também a leitura em inglês (1,234 / 0.50) para não recusar por causa do jeito de quem escreveu a fonte."""
    achadas = set()
    br = ler_brasileiro(bruto)
    if br is not None:
        achadas.add(br)
    ingles = bruto.replace(",", "") if _MILHAR_INGLES.fullmatch(bruto) else (bruto if _DECIMAL_COM_PONTO.fullmatch(bruto) else None)
    if ingles is not None and len(ingles) <= MAX_DIGITOS + 1:
        d = _decimal(ingles)
        if d is not None:
            achadas.add(_canonico(d))
    if not achadas:  # 17.10.2026, 1,2,3...: cada pedaço de algarismos vale como um número
        achadas = {_canonico(Decimal(p)) for p in re.findall(r"\d+", bruto) if len(p) <= MAX_DIGITOS}
    return achadas


def numeros_da_fonte(valor) -> set:
    """Os números de um texto ou de uma estrutura (listas e objetos). Objeto com 'valor' conta também esse valor (campo numero)."""
    saida, pilha = set(), [valor]
    while pilha:
        v = pilha.pop()
        if isinstance(v, str):
            for bruto in _NUMERO.findall(v):
                saida |= _leituras_da_fonte(bruto)
        elif isinstance(v, list):
            pilha.extend(v)
        elif isinstance(v, dict):
            n = para_decimal(v["valor"]) if "valor" in v else None
            if n is not None:
                saida.add(_canonico(n))
            pilha.extend(v.values())
    return saida


def textos_da_fonte(valor):
    """Textos da parte citada, para conferir moeda e grandeza junto do número."""
    if isinstance(valor, str):
        yield valor
    elif isinstance(valor, list):
        for item in valor:
            yield from textos_da_fonte(item)
    elif isinstance(valor, dict):
        for item in valor.values():
            yield from textos_da_fonte(item)


# ---------------------------------------------------------------------------------------
# O pacote que o código montou para a tarefa
# ---------------------------------------------------------------------------------------
class PacoteIncompleto(Exception):
    """O pacote da tarefa veio sem alguma parte (a Helena devia ter registrado a falha em vez de entregar)."""

    def __init__(self, faltas: list):
        super().__init__(", ".join(faltas))
        self.faltas = faltas


@dataclass
class Pacote:
    etapa_do_relatorio: str
    etapas_aprovadas: dict    # id da etapa -> entrega aprovada (só as do plano, aprovadas, e que não são o relatório)
    acoes_do_fundador: dict   # id AF- -> conjunto das etapas aprovadas do plano que têm essa ação
    passos_fixos: set         # ids PF- da lista do que só você faz (parte montada pelo código)
    textos_fixos: dict        # id AF-/PF- -> textos fixos da lista do que só você faz
    etapas_do_plano: set
    riscos: list
    perguntas_abertas: list
    sem_conferir: list
    textos_do_pedido: list


def _objeto(v, onde):
    if not isinstance(v, dict):
        raise ErroDeContexto(f"{onde} deve ser um objeto.")
    return v


def _lista_de_objetos(v, onde) -> list:
    if v is None:
        return []
    if not isinstance(v, list) or not all(isinstance(x, dict) for x in v):
        raise ErroDeContexto(f"{onde} deve ser uma lista de objetos.")
    return v


def _etapa_de(item, onde) -> str:
    if not isinstance(item.get("etapa"), str) or not item["etapa"].strip():
        raise ErroDeContexto(f"{onde} precisa do campo 'etapa' (texto).")
    return item["etapa"]


def _textos(v) -> list:
    """Os textos de um campo da ordem de serviço: texto, lista de textos, ou lista de objetos com 'texto'."""
    if isinstance(v, str):
        return [v]
    if isinstance(v, list):
        return [t for x in v for t in ([x] if isinstance(x, str) else [x["texto"]] if isinstance(x, dict) and isinstance(x.get("texto"), str) else [])]
    return []


def _onde_fica(p: dict, chave: str) -> dict:
    """O pedido pode trazer `ordem_de_servico`/`plano` no topo ou dentro de `card` (como o adaptador entende)."""
    card = p.get("card")
    return p if chave in p or not isinstance(card, dict) else card


def _ler_pacote(pedido) -> Pacote:
    faltas = []
    if pedido is None:
        raise PacoteIncompleto(["o pedido do card (contexto.pedido)"])
    p = _objeto(pedido, "contexto.pedido")
    ordem = (_onde_fica(p, "ordem_de_servico").get("ordem_de_servico"))
    plano = (_onde_fica(p, "plano").get("plano"))
    etapa = p.get("etapa_do_relatorio")
    pacote = p.get("pacote_do_relatorio")
    montada = pacote.get("parte_montada_pelo_codigo") if isinstance(pacote, dict) else None
    aprovadas = pacote.get("entregas_aprovadas") if isinstance(pacote, dict) else None
    etapas = plano.get("etapas") if isinstance(plano, dict) else None
    for valor, nome in ((ordem, "a ordem de serviço do card"), (etapas, "o plano do card (etapas)"),
                        (etapa, "o id da etapa do relatório (etapa_do_relatorio)"), (pacote, "o pacote do relatório"),
                        (aprovadas, "as entregas aprovadas do pacote"), (montada, "a parte montada pelo código")):
        if valor is None:
            faltas.append(nome)
    if faltas:
        raise PacoteIncompleto(faltas)
    if not isinstance(etapa, str) or not etapa.strip():
        raise ErroDeContexto("contexto.pedido.etapa_do_relatorio deve ser um texto (id da etapa).")
    _objeto(ordem, "contexto.pedido: ordem de serviço")
    _objeto(montada, "contexto.pedido.pacote_do_relatorio.parte_montada_pelo_codigo")
    _objeto(aprovadas, "contexto.pedido.pacote_do_relatorio.entregas_aprovadas")
    etapas = _lista_de_objetos(etapas, "contexto.pedido: plano.etapas")
    ids_do_plano = {e["id"] for e in etapas if isinstance(e.get("id"), str)}

    aprovadas_do_plano = {}
    for id_, entrega in aprovadas.items():
        _objeto(entrega, f"contexto.pedido.pacote_do_relatorio.entregas_aprovadas.{id_}")
        if id_ in ids_do_plano and id_ != etapa and entrega.get("versao_aprovada") is not None:
            aprovadas_do_plano[id_] = entrega

    acoes = {}
    for e in etapas:
        dadas = e.get("acao_do_fundador")
        for af in ([dadas] if isinstance(dadas, str) else dadas if isinstance(dadas, list) else []):
            if isinstance(af, str) and isinstance(e.get("id"), str) and e["id"] in aprovadas_do_plano:
                acoes.setdefault(af, set()).add(e["id"])

    so_voce_faz = _lista_de_objetos(montada.get("so_voce_faz"), "parte_montada_pelo_codigo.so_voce_faz")
    passos, textos = set(), {}
    for item in so_voce_faz:
        id_ = item.get("id")
        if isinstance(id_, str):
            if id_.startswith(PREFIXO_DO_PASSO_FIXO):
                passos.add(id_)
            textos.setdefault(id_, []).extend(_textos(item.get("texto")))

    def lista(nome):
        itens = _lista_de_objetos(montada.get(nome), f"parte_montada_pelo_codigo.{nome}")
        for i, item in enumerate(itens):
            _etapa_de(item, f"parte_montada_pelo_codigo.{nome}[{i}]")
        return itens

    return Pacote(
        etapa_do_relatorio=etapa, etapas_aprovadas=aprovadas_do_plano, acoes_do_fundador=acoes, passos_fixos=passos,
        textos_fixos=textos, etapas_do_plano=ids_do_plano, riscos=lista("riscos"), perguntas_abertas=lista("perguntas_abertas"),
        sem_conferir=lista("sem_conferir"),
        textos_do_pedido=[t for campo in CAMPOS_DA_ORDEM_DE_SERVICO for t in _textos(ordem.get(campo))])


def carregar_pacote(exe) -> Pacote:
    """O pacote da tarefa, lido uma vez por execução. Levanta PacoteIncompleto (use `falha_de_pacote`) ou ErroDeContexto."""
    return exe.memo("relatorio:pacote", lambda: _ler_pacote(exe.contexto.get("pedido")))


def falha_de_pacote(id_: str, erro: PacoteIncompleto) -> Falha:
    return Falha(id_, "PACOTE_INCOMPLETO", "contexto.pedido",
                 f"O pacote desta tarefa veio sem: {'; '.join(erro.faltas)}. Sem isso não dá para conferir o relatório. "
                 "Registre a falha (FALTAM_DADOS) em vez de entregar.")


# ---------------------------------------------------------------------------------------
# Refs
# ---------------------------------------------------------------------------------------
def problema_da_ref(pacote: Pacote, ref: str):
    """None se a ref vale; senão (motivo, mensagem)."""
    if ref == REF_DO_PEDIDO or ref in pacote.etapas_aprovadas or ref in pacote.acoes_do_fundador or ref in pacote.passos_fixos:
        return None
    if not ref:
        return "REF_VAZIA", "Há uma ref vazia (vírgula sobrando). Escreva só as refs, separadas por vírgula."
    if ref == pacote.etapa_do_relatorio:
        return "REF_AO_PROPRIO_RELATORIO", f"A ref {ref} é a etapa do próprio relatório; cite as etapas aprovadas que ele resume."
    if ref in pacote.etapas_do_plano:
        return "ETAPA_NAO_APROVADA", f"A etapa {ref} não tem entrega aprovada no pacote; só vale ref de etapa aprovada."
    if ref.startswith(PREFIXO_DA_ACAO_DO_FUNDADOR):
        return "ACAO_DO_FUNDADOR_INEXISTENTE", f"A ação {ref} não foi dada pelo plano a nenhuma etapa aprovada; só vale AF- da lista do que só você faz."
    if ref.startswith(PREFIXO_DO_PASSO_FIXO):
        return "PASSO_FIXO_INEXISTENTE", f"O passo fixo {ref} não está na lista do que só você faz que o código montou."
    return "REF_DESCONHECIDA", f"A ref '{ref}' não é uma etapa aprovada, um AF-, um PF- nem {REF_DO_PEDIDO}."


def refs_validas_de_acao(pacote: Pacote, refs: list) -> list:
    """As refs da linha que são AF- de etapa aprovada ou PF- da parte montada (o que libera uma ação de fora)."""
    return [r for r in refs if r in pacote.acoes_do_fundador or r in pacote.passos_fixos]
