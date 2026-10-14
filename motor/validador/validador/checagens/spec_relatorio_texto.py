"""O TEXTO que a Helena escreve no relatório: CHK-REL-SEM-CODIGO, CHK-REL-SEM-OTIMISMO e CHK-REL-PACOTE.

O que é: três conferências de código puro (sem IA) sobre as frases e os passos.
  CHK-REL-SEM-CODIGO     nenhum código interno (ids, etapa como 'E4', nome de máquina, identidade em maiúsculas) no texto;
  CHK-REL-SEM-OTIMISMO   nenhuma frase de garantia ou de 'tudo resolvido' (lista fechada);
  CHK-REL-PACOTE         nenhum termo que o pacote da empresa do card proíbe em todo texto.
De onde vem: helena-v2/deliverables/relatorio_final.yaml. As colunas olhadas, os padrões de código e a lista de frases vêm do
`parametros` de cada checagem. A lista de termos do pacote vem do pacote da empresa da tarefa (contexto["pacote_da_empresa"]),
lida na hora: esta especificação, de propósito, não a copia.
Como mudar: acrescente ou tire um padrão/frase no `parametros` da checagem no YAML do tipo; a lista do pacote muda no pacote da empresa.
Como a comparação é feita: SEM-CODIGO olha o texto como está (maiúscula conta, porque o padrão é de maiúsculas), só com o texto
limpo de caracteres invisíveis. SEM-OTIMISMO segue `sem_diferenca_de_maiusculas` do YAML (ligado: também ignora acento) e acha a
frase por palavras inteiras. PACOTE ignora maiúscula e acento sempre (mais rígido) e também acha por palavras inteiras.
"""
from .. import texto as T
from ..contexto import ErroDeContexto
from ..registro import checagem
from ..resultado import Falha
from .spec_relatorio_base import aplicavel, celulas, compilar, parametro_booleano, parametro_textos, termo_achado

ID_CODIGO = "CHK-REL-SEM-CODIGO"
ID_OTIMISMO = "CHK-REL-SEM-OTIMISMO"
ID_PACOTE = "CHK-REL-PACOTE"
CAMPO_DOS_TERMOS_DO_PACOTE = "termos_proibidos_em_todo_texto"  # nome do campo no pacote da empresa (o `parametros.fonte` do YAML o cita)


@checagem(ID_CODIGO, "Sem código interno no texto da Helena",
          "Id, etapa ('E4') ou nome de agente em maiúsculas no texto assustava quem lê e mostrava a engrenagem em vez do resultado.",
          ["CONF-21"])
def sem_codigo_interno(exe):
    if not aplicavel(exe):
        return None
    padroes = compilar(exe, ID_CODIGO, "padroes", ignorar_caixa=False)
    falhas = []
    for linha, coluna, texto in celulas(exe, parametro_textos(exe, ID_CODIGO, "colunas")):
        limpo = T.normalizar(texto)
        for rx in padroes:
            m = rx.search(limpo)
            if m:
                falhas.append(Falha(ID_CODIGO, "CODIGO_INTERNO", f"{linha.caminho}.{coluna}",
                                    f"O texto traz um código interno ('{m.group(0)}'). Escreva em português simples; os códigos ficam só na coluna refs.", T.cortar(texto)))
                break
    return falhas


@checagem(ID_OTIMISMO, "Sem garantia nem 'tudo resolvido' no texto da Helena",
          "Frase como 'está tudo certo' ou 'risco zero' escondia o que ficou sem conferir e levava o fundador a agir sem ler o card.",
          ["C-13"])
def sem_otimismo(exe):
    if not aplicavel(exe):
        return None
    termos = parametro_textos(exe, ID_OTIMISMO, "termos")
    ignorar = parametro_booleano(exe, ID_OTIMISMO, "sem_diferenca_de_maiusculas", False)
    falhas = []
    for linha, coluna, texto in celulas(exe, parametro_textos(exe, ID_OTIMISMO, "colunas")):
        achado = termo_achado(texto, termos, ignorar)
        if achado:
            falhas.append(Falha(ID_OTIMISMO, "FRASE_DE_GARANTIA", f"{linha.caminho}.{coluna}",
                                f"A frase '{achado}' promete mais do que o card mostra. Diga o que está pronto e o que ficou sem conferir, sem garantia.", T.cortar(texto)))
    return falhas


def _termos_proibidos_do_pacote(exe):
    """A lista do pacote da empresa, ou None se o pacote não a trouxe. Se ela existe mas não é uma lista de textos, o validador para."""
    pacote = exe.contexto.get("pacote_da_empresa")
    pedido = exe.contexto.get("pedido")
    if pacote is None and isinstance(pedido, dict):  # o adaptador entrega o pacote nos dois lugares; vale o primeiro que existir
        pacote = pedido.get("pacote_da_empresa")
    if not isinstance(pacote, dict) or CAMPO_DOS_TERMOS_DO_PACOTE not in pacote:
        return None
    lista = pacote[CAMPO_DOS_TERMOS_DO_PACOTE]
    if not isinstance(lista, list) or not all(isinstance(t, str) for t in lista):
        raise ErroDeContexto(f"{ID_PACOTE}: '{CAMPO_DOS_TERMOS_DO_PACOTE}' do pacote da empresa deve ser uma lista de textos.")
    return lista


@checagem(ID_PACOTE, "Sem termo proibido pelo pacote da empresa",
          "O texto podia usar um termo que o pacote da empresa proíbe em todo texto (grafia e voz da marca, promessa de ganho).",
          ["DEC-023"])
def sem_termo_do_pacote(exe):
    if not aplicavel(exe):
        return None
    colunas = parametro_textos(exe, ID_PACOTE, "colunas")
    termos = _termos_proibidos_do_pacote(exe)
    if termos is None:
        return [Falha(ID_PACOTE, "PACOTE_SEM_LISTA", "contexto.pacote_da_empresa",
                      f"O pacote da empresa veio sem a lista '{CAMPO_DOS_TERMOS_DO_PACOTE}'; sem ela não dá para conferir o texto. "
                      "Registre a falha (FALTAM_DADOS) em vez de entregar.")]
    falhas = []
    for linha, coluna, texto in celulas(exe, colunas):
        achado = termo_achado(texto, termos, True)
        if achado:
            falhas.append(Falha(ID_PACOTE, "TERMO_PROIBIDO_PELO_PACOTE", f"{linha.caminho}.{coluna}",
                                f"O pacote da empresa proíbe o termo '{achado}' em qualquer texto. Reescreva sem ele.", T.cortar(texto)))
    return falhas
