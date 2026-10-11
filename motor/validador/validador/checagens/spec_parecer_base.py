"""Ajudantes das checagens do PARECER (Clara, SRV-PARECER). Este arquivo não registra checagem nenhuma.

O que é: as peças pequenas que as checagens CHK-PARECER-* usam em comum: ler as tabelas da entrega, achar no pedido do card
o plano (quais etapas o parecer julga, quais passos fixos ele cobre, qual ação do fundador cada etapa tem), as versões das
peças julgadas e a tabela de leis do pacote.
De onde vem: a regra de cada checagem está em helena-v2/deliverables/parecer.yaml (checagens_codigo). Os NÚMEROS e as LISTAS
(limites de tamanho, temas, termos de garantia...) vêm dali pelo `exe.parametros("CHK-...")`; nada disso é copiado para cá.
Como mudar: o que ficou escrito aqui são só os NOMES fixos do formato (as palavras 'nenhum', 'SIM', 'TABELA_DE_LEIS'...),
que o YAML escreve nas descrições das colunas. Se o YAML trocar uma dessas palavras, troque aqui, no bloco NOMES FIXOS.
Onde está cada dado no contexto (montado pelo motor; o adaptador spec_helena faz o mesmo para os casos):
  contexto["pedido"]                       o pedido do card inteiro (plano, etapa_do_parecer, pacote_do_parecer);
  contexto["pedido"]["pacote_do_parecer"]  pecas_julgadas (por etapa, por versão), passos_fixos e tabela_de_leis;
  contexto["pacote_da_empresa"]            o pacote da empresa (termos proibidos...);
  contexto["paginas_lidas"]                a cópia guardada das páginas lidas (exe.paginas).
"""
import re
from dataclasses import dataclass, field

from .. import texto as T
from ..numeros import para_decimal
from ..resultado import Falha

# ---------------------------------------------------------------------------------------
# NOMES FIXOS do formato da entrega (palavras escritas nas colunas do deliverables/parecer.yaml)
# ---------------------------------------------------------------------------------------
TIPO = "parecer"
NENHUM = "nenhum"                       # "nenhum" = célula vazia de propósito
SEM_AJUSTE_OK, AJUSTE, NAO_PODE = "OK", "AJUSTE", "NAO_PODE"   # semáforo de uma peça
SIM, NAO = "SIM", "NAO"                 # coluna aplica dos temas
NAO_SE_APLICA = "NAO_SE_APLICA"         # natureza de um tema que não se aplica
PONTO_INCERTO = "PONTO_INCERTO"         # natureza que obriga um gatilho de advogado
TEMA_PASSOS_FIXOS = "TEMA-PASSOS-FIXOS"  # o tema que lista os passos fixos (temas_obrigatorios do YAML)
ORIGEM_TABELA = "TABELA_DE_LEIS"        # origem de fundamento: tabela de leis do pacote
ORIGEM_TERMOS = "TERMOS_LIDOS"          # origem de fundamento: página lida por inteiro
QUALQUER_PASSO_DE_FORA = "qualquer passo de fora"
SEM_NOTA = "nenhuma"                    # coluna nota sem nota de jurisprudência
COLUNAS_DE_TEXTO_LIVRE = ("por_que", "ajuste", "resposta", "condicao", "gatilho", "o_que_nao_consta")  # + itens de nao_coberto
COLUNAS_COM_AFIRMACOES = tuple(c for c in COLUNAS_DE_TEXTO_LIVRE if c != "o_que_nao_consta")  # a linha de ausência é a própria prova
SECAO_NAO_COBERTO = "nao_coberto"
COLUNA_DA_PECA = "trecho_da_peca"        # cópia literal da peça julgada (fica fora de várias buscas de termos)


# ---------------------------------------------------------------------------------------
# A entrega
# ---------------------------------------------------------------------------------------
def aplica(exe, id_da_checagem: str) -> bool:
    """A checagem só vale para entrega do tipo parecer, na ação ENTREGAR, e quando o serviço PEDIU esta checagem.

    "Pediu" = o id está em modelo.checagens_a_rodar (o adaptador/motor monta a lista a partir do criterio_de_pronto do tipo).
    Sem a lista (contextos antigos, de antes da especificação v2) estas checagens não se aplicam: elas precisam do pedido do card
    e dos parâmetros do YAML, que só o fluxo da especificação entrega. Nos outros casos a função devolve None (não se aplica)."""
    return (exe.acao == "ENTREGAR" and exe.modelo.get("tipo") == TIPO
            and id_da_checagem in (exe.modelo.get("checagens_a_rodar") or []))


def parametros(exe, id_da_checagem: str) -> dict:
    """Os parâmetros da especificação para a checagem. Sem eles a checagem não sabe o que conferir: falha fechada (recusa)."""
    p = exe.parametros(id_da_checagem)
    if not p:
        raise ValueError(f"O contexto não trouxe os 'parametros' de {id_da_checagem} (modelo.parametros_das_checagens). Sem eles não há como conferir.")
    return p


def secao(exe, sid: str):
    """O valor da seção `sid` da entrega, ou None se ela não veio."""
    return exe.acao_obj["entrega"].get(sid)


def linhas(exe, sid: str) -> list:
    """[(caminho, linha)] da tabela `sid`. Seção que não veio, ou que não é lista, dá lista vazia; linha que não é objeto fica de fora
    (quem recusa o formato errado é CHK-COMUM-01 e CHK-PARECER-SO-SECOES)."""
    v = secao(exe, sid)
    if not isinstance(v, list):
        return []
    return [(f"entrega.{sid}[{i}]", l) for i, l in enumerate(v) if isinstance(l, dict)]


def texto_da(linha: dict, coluna: str) -> str:
    """O texto da célula (vazio se não for texto)."""
    v = linha.get(coluna)
    return v.strip() if isinstance(v, str) else ""


def e_nenhum(valor) -> bool:
    return isinstance(valor, str) and T.dobrar(valor).strip(" .") == NENHUM


def ids_da_celula(valor) -> list:
    """Ids separados por vírgula numa célula ('F1, F6'); 'nenhum' ou vazio dá lista vazia."""
    if not isinstance(valor, str) or e_nenhum(valor):
        return []
    return [p.strip() for p in valor.split(",") if p.strip()]


def coluna_do_item(item) -> str | None:
    """Nome da coluna de um Item (entrega.pecas[0].por_que#linha2 -> por_que); None para item de lista."""
    m = re.search(r"\.([A-Za-z_]+)(?:#linha\d+)?$", item.caminho)
    return m.group(1) if m else None


def textos_livres_de(exe, colunas) -> list:
    """Os textos (Item) escritos pela Clara nas `colunas` dadas e nos itens de nao_coberto, sem citações nem trechos de peça."""
    saida = []
    for i in exe.itens_livres():
        c = coluna_do_item(i)
        if (c in colunas) or (c is None and i.secao == SECAO_NAO_COBERTO):
            saida.append(i)
    return saida


def pior_primeiro(lista_do_pior_ao_melhor: list, achados) -> str | None:
    """O primeiro valor da lista de ordem (do pior ao melhor) que aparece em `achados`."""
    achados = set(achados)
    return next((v for v in lista_do_pior_ao_melhor if v in achados), None)


def trecho_esta_em(trecho: str, textos: list) -> bool:
    """O trecho (normalizado: espaços e aspas iguais, maiúsculas importam) está dentro de algum dos textos?"""
    t = T.normalizar(trecho).strip()
    return bool(t) and any(t in T.normalizar(x) for x in textos)


def falha(id_, motivo, item, mensagem, trecho="") -> Falha:
    return Falha(id_, motivo, item, mensagem, T.cortar(trecho) if trecho else "")


# ---------------------------------------------------------------------------------------
# O pedido do card: plano, peças julgadas, passos fixos e tabela de leis
# ---------------------------------------------------------------------------------------
@dataclass
class PedidoDoParecer:
    problema: str | None = None                          # por que não deu para ler o plano (None = tudo certo)
    etapa: str | None = None                             # a etapa deste parecer (E2, E4...)
    julgadas: list = field(default_factory=list)         # ids das etapas que ele julga
    acoes: dict = field(default_factory=dict)            # etapa julgada -> id da ação do fundador (AF-...)
    versoes: dict = field(default_factory=dict)          # etapa julgada -> {"1": [textos da peça], "2": [...]}
    passos: dict = field(default_factory=dict)           # id do passo fixo coberto -> texto
    tabela: dict | None = None                           # tabela de leis do pacote (None = não veio)


def _folhas_de_texto(x) -> list:
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [t for v in x.values() for t in _folhas_de_texto(v)]
    if isinstance(x, list):
        return [t for v in x for t in _folhas_de_texto(v)]
    return []


def _ler_pedido(exe) -> PedidoDoParecer:
    p = exe.contexto.get("pedido")
    if not isinstance(p, dict):
        return PedidoDoParecer(problema="O contexto não traz o pedido do card (contexto.pedido): sem ele não dá para saber o que o parecer devia julgar.")
    pacote = p.get("pacote_do_parecer") or {}
    tabela = pacote.get("tabela_de_leis") if isinstance(pacote.get("tabela_de_leis"), dict) else None
    plano = p.get("plano") or (p.get("card") or {}).get("plano") or {}
    etapas = [e for e in plano.get("etapas") or [] if isinstance(e, dict)]
    etapa_id = p.get("etapa_do_parecer")
    dela = next((e for e in etapas if e.get("id") == etapa_id), None) if etapa_id else None
    if dela is None:  # sem etapa_do_parecer: a etapa deste serviço que julga alguma outra
        dela = next((e for e in etapas if e.get("servico") == exe.modelo.get("servico") and e.get("julga")), None)
    if dela is None:
        return PedidoDoParecer(problema="O plano do card não tem a etapa deste parecer: sem ela não dá para saber o que julgar.", tabela=tabela)
    r = PedidoDoParecer(etapa=dela.get("id"), tabela=tabela)
    r.julgadas = [str(x) for x in dela.get("julga") or []]
    pecas = pacote.get("pecas_julgadas") or {}
    for e in etapas:
        if e.get("id") in r.julgadas and isinstance(e.get("acao_do_fundador"), str):
            r.acoes[e["id"]] = e["acao_do_fundador"]
    for eid in r.julgadas:
        dados = pecas.get(eid) if isinstance(pecas.get(eid), dict) else {}
        if isinstance(dados.get("acao_do_fundador"), str):
            r.acoes.setdefault(eid, dados["acao_do_fundador"])
        r.versoes[eid] = {str(v): _folhas_de_texto(corpo) for v, corpo in (dados.get("versoes") or {}).items()}
    for ps in (plano.get("passos_fixos_do_fundador") or []):
        if isinstance(ps, dict) and ps.get("coberto_pelo_parecer") == r.etapa and ps.get("id"):
            r.passos[str(ps["id"])] = str(ps.get("texto", ""))
    for ps in (pacote.get("passos_fixos") or []):
        if isinstance(ps, dict) and ps.get("id"):
            r.passos.setdefault(str(ps["id"]), str(ps.get("texto", "")))
    return r


def pedido(exe) -> PedidoDoParecer:
    return exe.memo("parecer:pedido", lambda: _ler_pedido(exe))


def sem_plano(exe, id_da_checagem: str):
    """Falha única quando o plano não pôde ser lido (falha fechada), ou None se está tudo certo."""
    ped = pedido(exe)
    if ped.problema:
        return [falha(id_da_checagem, "PLANO_NAO_LIDO", "contexto.pedido", ped.problema)]
    return None


def versao_como_texto(valor) -> str | None:
    """A versão da linha como texto ('1'), vinda de número, de texto ou de {valor: ...}; None se não for número inteiro."""
    if isinstance(valor, dict):
        valor = valor.get("valor")
    d = para_decimal(valor)
    if d is None or d != d.to_integral_value():
        return None
    return str(int(d))


def linha_da_tabela(l: dict) -> dict:
    """Uma linha da tabela de leis nos nomes que o validador usa. A especificação escreve texto_oficial e nota_de_jurisprudencia;
    os casos de teste escrevem texto e nota: os dois valem."""
    texto = l.get("texto_oficial") if isinstance(l.get("texto_oficial"), str) else l.get("texto")
    nota = l.get("nota_de_jurisprudencia") if "nota_de_jurisprudencia" in l else l.get("nota")
    return {"referencia": l.get("referencia"), "lei": l.get("lei"), "texto": texto if isinstance(texto, str) else "",
            "nota": nota if isinstance(nota, str) and nota.strip() else SEM_NOTA}


def linhas_da_tabela(exe) -> list:
    t = pedido(exe).tabela
    if not t:
        return []
    return [linha_da_tabela(l) for l in t.get("linhas") or [] if isinstance(l, dict) and isinstance(l.get("referencia"), str)]


def fundamentos(exe) -> list:
    """[(caminho, linha)] da seção fundamentos."""
    return linhas(exe, "fundamentos")
