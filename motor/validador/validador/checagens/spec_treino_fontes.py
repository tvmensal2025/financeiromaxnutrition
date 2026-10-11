"""Roteiro de treinamento: tudo o que o texto diz tem de VIR DA FONTE do pacote (CHK-TREINO-04, 05, 07 e 08).

O que é: a Isabela não tem ferramenta e não conhece a plataforma. Nome de tela, regra, número e contato só entram se estiverem
no pedido original, no pacote da empresa ou numa fonte importada aprovada (as regras de gravação, por exemplo).
  CHK-TREINO-04  todo texto entre aspas (nome de tela, botão, regra) aparece igual numa fonte.
  CHK-TREINO-05  todo erro tem id em ordem e um apoio que é trecho LITERAL (frase inteira ou 12 palavras seguidas) de fonte;
                 o apoio de um passo, quando existe, também. Nunca vale `leitura_id`: a Isabela não lê página.
  CHK-TREINO-07  nenhum número solto: todo número em algarismos aparece, com o mesmo valor, numa fonte.
  CHK-TREINO-08  nenhum contato inventado: site, e-mail, @usuário, telefone, CPF ou CEP só se aparecer igual no pedido ou no pacote.
De onde vem: as listas, os números e quais fontes valem estão em helena-v2/deliverables/roteiro_treinamento.yaml (parametros de
cada checagem). As fontes que o código guardou (pedido, pacote, regras importadas) chegam em exe.fontes. Nada é copiado para cá.
Como mudar: mude o YAML (mínimo de palavras, tipos de aspas, famílias de contato, endereços aceitos...). Para uma família nova de
contato, o YAML a nomeia e o código precisa de um detector novo em _detector_de_contato (sem ele a checagem recusa, em vez de calar).
O que o código NÃO confere: se o texto do erro diz o mesmo que o trecho de apoio (RUB-TREINO-03).
"""
import re

from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from . import spec_treino_base as B

ID04, ID05, ID07, ID08 = "CHK-TREINO-04", "CHK-TREINO-05", "CHK-TREINO-07", "CHK-TREINO-08"
_PONTAS = " .,;:!?…"


def _padroes_de_ids(exe) -> tuple:
    """Os padrões dos ids de passo e de erro, lidos de CHK-TREINO-03 e CHK-TREINO-05 (que são o único lugar onde estão escritos)."""
    padrao_p, _, _ = B.regra_de_ids(exe.parametros("CHK-TREINO-03"), "ids")
    padrao_e, _, _ = B.regra_de_ids(exe.parametros("CHK-TREINO-05"), "ids_dos_erros")
    return padrao_p, padrao_e


# ---------------------------------------------------------------------------------------
# CHK-TREINO-04: texto entre aspas existe na fonte
# ---------------------------------------------------------------------------------------
def _regexes_de_aspas(p) -> list:
    """De ["\\"...\\"", "'...'", "“...”"] tira, para cada modelo, o que abre e o que fecha. Aspa dentro de palavra (d'água) não conta."""
    saida = []
    for modelo in B.lista_de_textos(p, "aspas"):
        if modelo.count("...") != 1 or modelo.startswith("...") or modelo.endswith("..."):
            raise B.ErroDeParametro(f"Não entendi o modelo de aspas '{modelo}' da especificação (esperado algo como \"...\").")
        abre, fecha = modelo.split("...")
        saida.append(re.compile(r"(?<![^\W_])" + re.escape(abre) + r"([^\n]+?)" + re.escape(fecha) + r"(?![^\W_])"))
    return saida


def _onde_procurar(p) -> list:
    """De ["passo_a_passo.sinal", "checklist_final"] tira (seção, coluna ou None)."""
    saida = []
    for entrada in B.lista_de_textos(p, "onde"):
        secao, _, coluna = entrada.strip().partition(".")
        saida.append((secao, coluna or None))
    return saida


@checagem(ID04, "Nome entre aspas existe na fonte do pacote",
          "O roteiro podia citar entre aspas um botão, uma tela ou uma regra que nenhuma fonte traz, e a pessoa seria ensinada a procurar algo que não existe.",
          ["C-8", "B-17"])
def aspas_com_origem(exe):
    def corpo(exe, p):
        regexes = _regexes_de_aspas(p)
        onde = _onde_procurar(p)
        fontes = [B.normal(B.texto_da_fonte(f)) for f in B.fontes_aceitas(exe, B.lista_de_textos(p, "fontes_aceitas"))]
        falhas, vistos = [], set()
        for secao, coluna in onde:
            for caminho, texto in B.celulas(exe, secao, coluna):
                for rx in regexes:
                    for m in rx.finditer(texto):
                        citado = B.normal(m.group(1))
                        if not citado or (caminho, citado) in vistos:
                            continue
                        vistos.add((caminho, citado))
                        if not any(B.tem_com_limite(f, citado) for f in fontes):
                            falhas.append(Falha(ID04, "NOME_ENTRE_ASPAS_SEM_ORIGEM", caminho,
                                                f"O texto entre aspas '{m.group(1).strip()}' não aparece igual no pedido, no pacote nem em fonte importada. "
                                                "Nome de tela, botão ou regra só entra se a fonte o traz.", T.cortar(texto)))
        return falhas
    return B.rodar(exe, ID04, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-05: apoio literal
# ---------------------------------------------------------------------------------------
def _confere_apoio(apoio, cam, fontes_ok, todas, minimo, frase_inteira) -> list:
    """As falhas de UM apoio (a citação de um erro ou de um passo)."""
    def f(motivo, msg, trecho=""):
        return [Falha(ID05, motivo, cam, msg, T.cortar(trecho))]

    if not isinstance(apoio, dict) or not isinstance(apoio.get("trecho_original"), str) or not apoio["trecho_original"].strip():
        return f("APOIO_SEM_TRECHO", "O apoio deve ter o 'trecho_original' copiado da fonte do pacote.")
    trecho = apoio["trecho_original"]
    if "leitura_id" in apoio:
        return f("APOIO_DE_PAGINA_LIDA", "O apoio não pode apontar página lida (leitura_id): a Isabela não lê página. Use o trecho de uma fonte importada (fonte_importada_id).", trecho)
    fid = apoio.get("fonte_importada_id")
    if not isinstance(fid, str) or not fid.strip():
        return f("APOIO_SEM_FONTE", "O apoio deve dizer de que fonte importada o trecho veio (fonte_importada_id).", trecho)
    if fid not in fontes_ok:
        quando = "não é uma fonte aceita aqui" if fid in todas else "não veio no pacote desta tarefa"
        return f("FONTE_DO_APOIO_NAO_ACEITA", f"A fonte '{fid}' {quando}. Use o pedido original, o pacote da empresa ou uma fonte importada aprovada.", trecho)
    b = B.texto_da_fonte(fontes_ok[fid])
    a = b.replace("\n", " ")
    core = T.normalizar(trecho).strip(_PONTAS)
    if not core:
        return f("APOIO_SEM_TRECHO", "O trecho do apoio só tem pontuação.", trecho)
    n = T.contar_palavras(core)
    achou_inteiro = False
    ini = 0
    while True:
        k = a.find(core, ini)
        if k < 0:
            break
        fim = k + len(core)
        antes_ok = k == 0 or not (core[0].isalnum() and a[k - 1].isalnum())
        depois_ok = fim >= len(a) or not (core[-1].isalnum() and a[fim].isalnum())
        if antes_ok and depois_ok:
            achou_inteiro = True
            if n >= minimo or (frase_inteira and T.inicio_de_frase(b, k) and T.fim_de_frase(b, fim)):
                return []
        ini = k + 1
    if achou_inteiro:
        return f("APOIO_CURTO_OU_CORTADO",
                 f"O apoio tem só {n} palavra(s) e não é uma frase inteira da fonte. Copie a frase do começo ao fim, ou {minimo} palavras seguidas ou mais.", trecho)
    em_outra = [i for i, p in fontes_ok.items() if i != fid and core in B.texto_da_fonte(p).replace("\n", " ")]
    dica = f" Ele existe na fonte '{em_outra[0]}'." if em_outra else ""
    return f("APOIO_NAO_ESTA_NA_FONTE",
             f"O trecho do apoio não está, igual, na fonte '{fid}'. Copie o trecho exatamente como está na fonte.{dica}", trecho)


@checagem(ID05, "Regras com apoio literal da fonte do pacote",
          "O roteiro podia ensinar uma regra da plataforma que a fonte não traz, com um 'apoio' inventado, emendado ou tirado de uma página que a Isabela nem lê.",
          ["C-8", "M-15"])
def apoio_literal(exe):
    def corpo(exe, p):
        padrao, rotulo, inicio = B.regra_de_ids(p, "ids_dos_erros")
        minimo = B.inteiro(p.get("minimo_palavras"), "minimo_palavras")
        frase_inteira = p.get("aceita_frase_inteira")
        if not isinstance(frase_inteira, bool):
            raise B.ErroDeParametro(f"O parâmetro 'aceita_frase_inteira' da especificação deveria ser verdadeiro ou falso (veio {frase_inteira!r}).")
        aceitas = B.fontes_aceitas(exe, B.lista_de_textos(p, "fontes_aceitas"))
        fontes_ok = {f.leitura_id: f for f in aceitas}
        falhas = []
        base = f"entrega.{B.SECAO_ERROS}"
        for i, linha in enumerate(B.linhas_da_secao(exe, B.SECAO_ERROS)):
            cam = f"{base}[{i}]"
            if not isinstance(linha, dict):
                falhas.append(Falha(ID05, "ERRO_MAL_FORMADO", cam, "Cada erro deve ser uma linha da tabela, com id, erro, o que acontece, como evitar e apoio."))
                continue
            if B.numero_do_id(padrao, linha.get(B.COL_ID)) != inicio + i:
                falhas.append(Falha(ID05, "ID_DO_ERRO_FORA_DE_ORDEM", f"{cam}.{B.COL_ID}",
                                    f"Os erros têm ids em ordem, sem pular nem repetir. Este deveria ser {rotulo}{inicio + i}.", T.cortar(str(linha.get(B.COL_ID)))))
            if linha.get(B.COL_APOIO) is None:
                falhas.append(Falha(ID05, "ERRO_SEM_APOIO", f"{cam}.{B.COL_APOIO}",
                                    "Todo erro precisa de um apoio: o trecho da fonte do pacote que diz a regra.", T.cortar(str(linha.get("erro", "")))))
            else:
                falhas += _confere_apoio(linha[B.COL_APOIO], f"{cam}.{B.COL_APOIO}", fontes_ok, exe.fontes, minimo, frase_inteira)
        for i, linha in enumerate(B.linhas_da_secao(exe, B.SECAO_PASSOS)):
            if isinstance(linha, dict) and linha.get(B.COL_APOIO) is not None:  # o apoio do passo é opcional; se existe, tem de valer
                falhas += _confere_apoio(linha[B.COL_APOIO], f"entrega.{B.SECAO_PASSOS}[{i}].{B.COL_APOIO}", fontes_ok, exe.fontes, minimo, frase_inteira)
        return falhas
    return B.rodar(exe, ID05, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-07: nenhum número solto
# ---------------------------------------------------------------------------------------
_MARCADOR_DE_LISTA = re.compile(r"^\s*\d{1,2}\s*[.)-]\s+")
_DATA = re.compile(r"(?<!\d)\d{2}/\d{2}/\d{4}(?!\d)")
_HORA = re.compile(r"(?<!\d)\d{1,2}:\d{2}(?!\d)")


@checagem(ID07, "Nenhum número solto no roteiro",
          "O roteiro podia trazer um prazo, um tempo ou uma quantidade inventados, que a pessoa leiga cumpriria achando que vêm da plataforma.",
          ["C-9", "C-8"])
def sem_numero_solto(exe):
    def corpo(exe, p):
        aceitas = B.fontes_aceitas(exe, B.lista_de_textos(p, "fontes_aceitas"))
        padroes = _padroes_de_ids(exe)
        valores = B.valores_das_fontes(aceitas)
        do_pedido = B.normal(" ".join(B.texto_da_fonte(f) for f in aceitas if f.leitura_id.startswith(B.PREFIXO_DO_PEDIDO)))
        falhas = []
        for item in B.itens_de_texto(exe):
            texto = _MARCADOR_DE_LISTA.sub("", item.texto, count=1)   # "1. Faça..." : o número da lista não conta
            texto = B.sem_ids(texto, padroes)                          # P1, E3...: ids não contam
            for rx in (_DATA, _HORA):                                  # data e hora só valem se estão no pedido original
                for m in rx.finditer(texto):
                    if B.normal(m.group(0)) not in do_pedido:
                        falhas.append(Falha(ID07, "DATA_OU_HORA_SOLTA", item.caminho,
                                            f"A data ou hora '{m.group(0)}' não está no pedido original. Tire ou peça a fonte.", T.cortar(item.texto)))
                texto = rx.sub(" ", texto)
            for possiveis, escrito in B.valores_no_texto(texto):
                if not (possiveis & valores):
                    falhas.append(Falha(ID07, "NUMERO_SOLTO", item.caminho,
                                        f"O número '{escrito}' não aparece no pedido, no pacote nem em fonte importada. Use só números que a fonte traz.", T.cortar(item.texto)))
        return falhas
    return B.rodar(exe, ID07, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-08: nenhum contato nem dado pessoal inventado
# ---------------------------------------------------------------------------------------
_CORTAR_DE_ENDERECO = r"\s<>\"'“”‘’«»)\]"


def _so_digitos(achado: str) -> str:
    return re.sub(r"\D", "", achado)


def _como_endereco(achado: str) -> str:
    a = achado.lower().rstrip(".,;:!?)/")
    return re.sub(r"^(?:https?://)?(?:www\.)?", "", a)


def _como_texto(achado: str) -> str:
    return achado.lower().rstrip(".,;:!?)")


def _detector_de_contato(entrada: str):
    """(rótulo, padrão, como comparar) de uma família de contato que a especificação nomeia em `padroes`.

    A especificação escreve cada família em frase; os detalhes que ela traz (os finais de site, os dígitos do telefone, o desenho do
    CPF e do CEP) são lidos da própria frase. Família que o código não sabe procurar recusa (nunca é ignorada em silêncio).
    """
    chave = B.normal(entrada)
    rotulo = entrada.split("(")[0].strip()
    if chave.startswith("endereco de site"):
        finais = re.findall(r"\.([A-Za-z]{2,})\b", entrada)
        if not finais:
            raise B.ErroDeParametro(f"A família '{rotulo}' da especificação deveria listar os finais de site (.com, .br...).")
        resto = rf"[^{_CORTAR_DE_ENDERECO}]*"
        padrao = re.compile(rf"(?:https?://|www\.){resto}|(?<![@\w.-])(?:[\w-]+\.)+(?:{'|'.join(map(re.escape, finais))})\b(?:/{resto})?", re.I)
        return rotulo, padrao, _como_endereco
    if chave.startswith("e-mail") or chave.startswith("email"):
        return rotulo, re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), _como_texto
    if chave.startswith("@usuario"):
        return rotulo, re.compile(r"(?<![\w@.])@\w[\w.]*"), _como_texto
    if chave.startswith("telefone"):
        digitos = [int(n) for n in re.findall(r"\d+", entrada)]
        if not digitos or min(digitos) <= 4:
            raise B.ErroDeParametro(f"A família '{rotulo}' da especificação deveria dizer quantos dígitos tem o telefone (por exemplo, 8 ou 9).")
        locais = "|".join(rf"\d{{{n - 4}}}" for n in sorted(set(digitos)))
        ddd = r"(?:\(?\d{2}\)?[\s-]?)"
        if "com ou sem ddd" in chave:
            prefixo = ddd + "?"
        elif "sem ddd" in chave:
            prefixo = ""
        else:
            prefixo = ddd if "ddd" in chave else ""
        return rotulo, re.compile(rf"(?<!\d){prefixo}(?:{locais})[\s-]?\d{{4}}(?!\d)"), _so_digitos
    if chave.startswith("cpf") or chave.startswith("cep"):
        exemplo = re.search(r"\(([^)]*)\)", entrada)
        if not exemplo or not re.fullmatch(r"[0.\-/ ]+", exemplo.group(1)) or "0" not in exemplo.group(1):
            raise B.ErroDeParametro(f"A família '{rotulo}' da especificação deveria trazer o desenho entre parênteses (por exemplo, 00000-000).")
        desenho = re.sub(r"0+", lambda m: rf"\d{{{len(m.group(0))}}}", re.escape(exemplo.group(1)))
        return rotulo, re.compile(rf"(?<!\d){desenho}(?!\d)"), _so_digitos
    raise B.ErroDeParametro(f"A especificação pede procurar '{rotulo}', mas o código ainda não sabe procurar essa família de contato.", "PADRAO_SEM_DETECTOR")


@checagem(ID08, "Nenhum contato nem dado pessoal inventado",
          "O roteiro podia trazer um site, e-mail, telefone ou documento inventado, e a pessoa leiga entregaria dados a um canal que ninguém confirmou.",
          ["C-7", "M-13"])
def sem_contato_inventado(exe):
    def corpo(exe, p):
        detectores = [_detector_de_contato(e) for e in B.lista_de_textos(p, "padroes")]
        fontes = [B.texto_da_fonte(f) for f in B.fontes_aceitas(exe, B.lista_de_textos(p, "fontes_aceitas"))]
        existentes = [{comparar(m.group(0)) for t in fontes for m in padrao.finditer(t)} for _, padrao, comparar in detectores]
        falhas = []
        for item in B.itens_de_texto(exe):
            for (rotulo, padrao, comparar), nas_fontes in zip(detectores, existentes):
                for m in padrao.finditer(item.texto):
                    achado = m.group(0).strip()
                    if comparar(achado) not in nas_fontes:
                        falhas.append(Falha(ID08, "CONTATO_NAO_VEM_DA_FONTE", item.caminho,
                                            f"O texto tem {rotulo} ('{achado}') que não aparece igual no pedido nem no pacote. "
                                            "Contato só entra se a fonte o traz; senão, diga em 'o que precisa do seu ok' que falta o canal.", T.cortar(item.texto)))
        return falhas
    return B.rodar(exe, ID08, corpo)
