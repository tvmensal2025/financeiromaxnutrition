"""Roteiro de treinamento: as quatro checagens de LISTA FECHADA DE TERMOS (CHK-TREINO-01, 02, 09 e 10).

O que é: cada uma procura, em todo texto da entrega (menos o trecho_original das citações), palavras ou expressões inteiras de uma
lista, sem diferenciar maiúscula nem acento, "mesmo negado" (dizer "não é dieta" também conta).
  CHK-TREINO-01  promessa de aprovação, ganho ou resultado. Única exceção: o slogan oficial do pacote, igual ao pacote.
  CHK-TREINO-02  termo que o pacote da empresa do card proíbe (a lista é lida do pacote na hora).
  CHK-TREINO-09  orientação de saúde (diagnóstico, remédio, cura, emagrecer...).
  CHK-TREINO-10  só no card da eLiving™ (BIZ-004): caloria, dieta ou app fitness.
De onde vem: as listas, os símbolos e a empresa de CHK-TREINO-10 estão em helena-v2/deliverables/roteiro_treinamento.yaml
(checagens_codigo -> parametros); o código lê com exe.parametros(...) e não guarda cópia. A lista de CHK-TREINO-02 vem do pacote da
empresa (contexto["pacote_da_empresa"]), no campo que o próprio YAML nomeia em `fonte`.
Como mudar: para proibir mais uma palavra, acrescente-a na lista do YAML (ou do pacote). O que o código NÃO pega (promessa dita em
palavras novas, conselho de saúde em palavras comuns) é da rubrica (RUB-TREINO-05, 06 e 08), como o YAML diz em `nao_confere`.
"""
import re

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from . import spec_treino_base as B
from . import spec_copy as C


def _procurar(exe, id_, motivo, instrucao, termos, simbolos=(), slogan=None):
    """Uma Falha por trecho de texto que tem termo (ou símbolo) da lista."""
    falhas = []
    for item in B.itens_de_texto(exe):
        texto = B.sem_o_slogan(item.texto, slogan)
        achados = C.achar(exe, texto, termos) + B.simbolos_no_texto(texto, simbolos)
        if "R$" in simbolos and re.search(r"(?<!\w)R\s+\$", texto, re.I):
            achados.append("R$")
        if achados:
            lista = ", ".join(f"'{a}'" for a in achados[:5])
            falhas.append(Falha(id_, motivo, item.caminho, f"O texto tem {lista}. {instrucao}", T.cortar(item.texto)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-TREINO-01: sem promessa
# ---------------------------------------------------------------------------------------
ID01 = "CHK-TREINO-01"


@checagem(ID01, "Roteiro sem promessa de aprovação, ganho ou resultado",
          "O roteiro podia prometer aprovação, renda ou resultado a quem o segue ('garantido', 'nunca será reprovado', 'renda extra') e a promessa chegava a estranhos em nome do fundador.",
          ["C-11", "C-13"])
def sem_promessa(exe):
    def corpo(exe, p):
        termos = B.lista_de_textos(p, "termos")
        simbolos = B.lista_de_textos(p, "simbolos")
        return _procurar(exe, ID01, "TERMO_DE_PROMESSA",
                         "O roteiro não pode prometer aprovação, ganho nem resultado, nem dizer que não vai haver (tire o termo; só o slogan oficial do pacote pode ficar, igual ao pacote).",
                         termos, simbolos, B.slogan_do_pacote(exe))
    return B.rodar(exe, ID01, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-02: termos proibidos pelo pacote da empresa
# ---------------------------------------------------------------------------------------
ID02 = "CHK-TREINO-02"
AVISO_SEM_LISTA = "pacote sem lista de termos"


@checagem(ID02, "Roteiro sem termo proibido pelo pacote da empresa",
          "O roteiro podia usar uma palavra que o pacote da empresa do card proíbe (marca, saúde, ganho) e ninguém via antes de chegar às pessoas.",
          ["DEC-023", "DEC-024", "DEC-025"])
def sem_termo_do_pacote(exe):
    def corpo(exe, p):
        fonte = p.get("fonte")
        campo = fonte.rsplit(":", 1)[-1].strip() if isinstance(fonte, str) else ""
        if not re.fullmatch(r"[a-z][a-z0-9_]*", campo):
            raise B.ErroDeParametro(f"O parâmetro 'fonte' da especificação deveria dizer 'pacote da empresa do card: <nome do campo>' (veio {fonte!r}).")
        pacote = exe.contexto.get("pacote_da_empresa")
        termos = pacote.get(campo) if isinstance(pacote, dict) else None
        if not termos:
            # A especificação manda PASSAR e mostrar na faixa "pacote sem lista de termos". O validador ainda não tem canal para um
            # aviso que não seja uma Falha, então o aviso só fica guardado em exe.memoria["avisos_da_faixa"] (nada o mostra ainda).
            # Para virar aviso de verdade: devolver aqui uma Falha com um motivo novo (ex.: PACOTE_SEM_LISTA_DE_TERMOS) e pôr
            # "CHK-TREINO-02:PACOTE_SEM_LISTA_DE_TERMOS": "MARCA" em validador/dados/configuracao.json, seção gravidades.
            exe.memoria.setdefault("avisos_da_faixa", [])
            if AVISO_SEM_LISTA not in exe.memoria["avisos_da_faixa"]:
                exe.memoria["avisos_da_faixa"].append(AVISO_SEM_LISTA)
            return []
        if not isinstance(termos, list) or not all(isinstance(t, str) and t.strip() for t in termos):
            raise B.ErroDeParametro(f"A lista '{campo}' do pacote da empresa deveria ser uma lista de textos (veio {termos!r}).", "LISTA_DO_PACOTE_INVALIDA")
        return _procurar(exe, ID02, "TERMO_PROIBIDO_PELO_PACOTE",
                         "O pacote da empresa proíbe este termo em qualquer texto do roteiro (mesmo negado). Escreva de outro jeito.",
                         C.termos_com_variantes_de_vinculo(termos))
    return B.rodar(exe, ID02, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-09: sem orientação de saúde
# ---------------------------------------------------------------------------------------
ID09 = "CHK-TREINO-09"


@checagem(ID09, "Roteiro sem orientação de saúde",
          "O roteiro podia dar diagnóstico, receita, remédio, cura ou conselho de emagrecimento a uma pessoa leiga, o que nenhum agente pode fazer.",
          ["DEC-023", "C-13"])
def sem_orientacao_de_saude(exe):
    def corpo(exe, p):
        return _procurar(exe, ID09, "TERMO_DE_SAUDE",
                         "O roteiro não dá orientação de saúde (diagnóstico, receita, remédio, tratamento, cura, emagrecimento), nem para dizer que não dá. Tire o termo.",
                         B.lista_de_textos(p, "termos"))
    return B.rodar(exe, ID09, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-10: a eLiving não vira app de calorias (só no card da BIZ-004)
# ---------------------------------------------------------------------------------------
ID10 = "CHK-TREINO-10"


def _empresas_do_card(exe) -> set:
    """As empresas que o contexto diz serem a do card: do pacote e do pedido (ordem de serviço e card)."""
    achadas = set()

    def anota(d):
        if isinstance(d, dict) and isinstance(d.get("empresa"), str):
            achadas.add(d["empresa"].strip())

    anota(exe.contexto.get("pacote_da_empresa"))
    pedido = exe.contexto.get("pedido")
    if isinstance(pedido, dict):
        anota(pedido)
        anota(pedido.get("ordem_de_servico"))
        card = pedido.get("card")
        anota(card)
        if isinstance(card, dict):
            anota(card.get("ordem_de_servico"))
    return achadas


@checagem(ID10, "eLiving™ sem caloria, dieta nem app fitness",
          "O roteiro da eLiving™ podia descrevê-la como contador de calorias, dieta ou app fitness comum, o contrário do posicionamento inegociável (DEC-023).",
          ["DEC-023"])
def eliving_nao_e_app_de_calorias(exe):
    def corpo(exe, p):
        empresa = p.get("so_empresa")
        if not isinstance(empresa, str) or not empresa.strip():
            raise B.ErroDeParametro(f"O parâmetro 'so_empresa' da especificação deveria ser o código de uma empresa (veio {empresa!r}).")
        empresas = _empresas_do_card(exe)
        if empresas and empresa not in empresas:
            return None  # card de outra empresa: não se aplica
        # Se o contexto não diz de que empresa é o card, confere mesmo assim (falha fechada).
        return _procurar(exe, ID10, "TERMO_DE_APP_DE_CALORIAS",
                         "A eLiving™ é inteligência pessoal de evolução, nunca contador de calorias, dieta nem app fitness (nem para dizer que não é). Tire o termo.",
                         B.lista_de_textos(p, "termos"))
    return B.rodar(exe, ID10, corpo)
