"""Checagens do PARECER (Clara) sobre as FONTES dos fundamentos: ids, tabela de leis, nota de jurisprudência, páginas lidas
por inteiro e ausência com prova.

O que é: cinco CHK de helena-v2/deliverables/parecer.yaml (checagens_codigo): CHK-PARECER-FUNDAMENTOS, -LEI-NA-TABELA,
-TERMOS-INTEIROS e -AUSENCIA (RECUSA) e -NOTA-DE-JURISPRUDENCIA (MARCA).
De onde vêm os dados: a tabela de leis (linhas com referência, texto oficial e nota) vem do pedido do card
(contexto["pedido"]["pacote_do_parecer"]["tabela_de_leis"]); a cópia guardada das páginas lidas vem de contexto["paginas_lidas"]
(exe.paginas, uma por leitura_id, com todas as partes que a ferramenta ler_pagina devolveu NESTA execução). Os números
(termos mínimos e máximos, a frase que indica ausência) vêm do `parametros` do YAML; o limite de ids F1..F20 vem do itens_max do modelo.
Como mudar: o texto das leis nunca é escrito aqui (é a tabela publicada pelo fundador); para mudar uma regra, mude o YAML ou a função.
Falha fechada: se uma checagem quebrar por entrega estranha, o núcleo recusa a entrega.
"""
import re

from .. import texto as T
from ..registro import checagem
from .spec_parecer_base import (COLUNAS_COM_AFIRMACOES, ORIGEM_TABELA, ORIGEM_TERMOS, SEM_NOTA, SIM, aplica, falha, fundamentos,
                                ids_da_celula, linhas, linhas_da_tabela, parametros, pedido, texto_da, textos_livres_de)

_ID_DE_FUNDAMENTO = re.compile(r"F([1-9]\d*)")


def _citacao(linha: dict):
    c = linha.get("citacao")
    return c if isinstance(c, dict) else None


def _pagina_lida_inteira(exe, leitura_id):
    """(Pagina | None, motivo, mensagem). Só vale página que a ler_pagina leu NESTA execução, com todas as partes."""
    pagina = exe.pagina(leitura_id)
    if pagina is None:
        return None, "PAGINA_NAO_LIDA", f"A página '{leitura_id}' não foi lida nesta execução pela nossa ferramenta (o registro de uso não a tem)."
    if pagina.execucao and exe.execucao_id and pagina.execucao != exe.execucao_id:
        return None, "PAGINA_DE_OUTRA_EXECUCAO", f"A página '{leitura_id}' foi lida em outra execução; só vale página lida nesta."
    faltando = pagina.partes_faltando()
    if faltando:
        return None, "PAGINA_LIDA_EM_PARTE", (f"A página '{leitura_id}' foi lida só em parte ({len(pagina.partes)} de {pagina.partes_total}; faltam as partes "
                                              f"{', '.join(map(str, faltando))}). Leia a página inteira antes de concluir qualquer coisa sobre ela.")
    return pagina, None, None


# ---------------------------------------------------------------------------------------
# CHK-PARECER-FUNDAMENTOS
# ---------------------------------------------------------------------------------------
ID_FUNDAMENTOS = "CHK-PARECER-FUNDAMENTOS"


@checagem(ID_FUNDAMENTOS, "Fundamentos citados, com id certo e origem certa",
          "Conclusão sem fundamento, fundamento que ninguém usa, id repetido ou citação sem a origem (tabela ou página lida) não eram conferíveis.",
          ["M-15", "C-8"])
def fundamentos_ligados(exe):
    if not aplica(exe, ID_FUNDAMENTOS):
        return None
    secao = next((s for s in exe.modelo.get("secoes") or [] if s.get("id") == "fundamentos"), {})
    maximo = secao.get("itens_max")
    falhas, ids = [], {}
    for cam, l in fundamentos(exe):
        fid = texto_da(l, "id")
        m = _ID_DE_FUNDAMENTO.fullmatch(fid)
        if not m or (maximo is not None and int(m.group(1)) > maximo):
            falhas.append(falha(ID_FUNDAMENTOS, "ID_FORA_DO_PADRAO", f"{cam}.id", f"O id do fundamento deve ser F1 a F{maximo or 'n'}, sem zero na frente.", fid))
        if fid in ids:
            falhas.append(falha(ID_FUNDAMENTOS, "ID_REPETIDO", f"{cam}.id", f"O id {fid} já foi usado em outro fundamento. Cada fundamento tem um id só.", fid))
        ids.setdefault(fid, cam)
        origem, cit = texto_da(l, "origem"), _citacao(l)
        if origem not in (ORIGEM_TABELA, ORIGEM_TERMOS):
            falhas.append(falha(ID_FUNDAMENTOS, "ORIGEM_FORA_DA_LISTA", f"{cam}.origem", f"A origem deve ser {ORIGEM_TABELA} ou {ORIGEM_TERMOS}.", origem))
        elif cit is None:
            falhas.append(falha(ID_FUNDAMENTOS, "SEM_CITACAO", f"{cam}.citacao", "O fundamento precisa de uma citação (trecho contínuo e de onde ele veio)."))
        elif origem == ORIGEM_TABELA:
            if not texto_da(cit, "fonte_importada_id") or "leitura_id" in cit:
                falhas.append(falha(ID_FUNDAMENTOS, "ORIGEM_E_CITACAO_NAO_COMBINAM", f"{cam}.citacao",
                                    f"Fundamento {ORIGEM_TABELA} cita a tabela de leis do pacote: a citação traz só o fonte_importada_id, sem leitura_id."))
        else:
            parte = cit.get("parte")
            if not texto_da(cit, "leitura_id") or isinstance(parte, bool) or not isinstance(parte, int) or "fonte_importada_id" in cit:
                falhas.append(falha(ID_FUNDAMENTOS, "ORIGEM_E_CITACAO_NAO_COMBINAM", f"{cam}.citacao",
                                    f"Fundamento {ORIGEM_TERMOS} cita uma página lida: a citação traz o leitura_id e a parte, sem fonte_importada_id."))
    citados = set()

    def conferir_linha(cam, l, obrigatorio):
        mencionados = ids_da_celula(l.get("fundamentos"))
        citados.update(mencionados)
        for f in mencionados:
            if f not in ids:
                falhas.append(falha(ID_FUNDAMENTOS, "FUNDAMENTO_QUE_NAO_EXISTE", f"{cam}.fundamentos", f"A linha cita o fundamento {f}, que não existe na seção 'fundamentos'.", f))
        if obrigatorio and not any(f in ids for f in mencionados):
            falhas.append(falha(ID_FUNDAMENTOS, "LINHA_SEM_FUNDAMENTO", f"{cam}.fundamentos", "A linha precisa citar pelo menos um fundamento que exista na seção 'fundamentos'."))

    for secao_id in ("pecas", "passos_fixos", "condicoes"):
        for cam, l in linhas(exe, secao_id):
            conferir_linha(cam, l, True)
    for cam, l in linhas(exe, "temas"):
        conferir_linha(cam, l, texto_da(l, "aplica") == SIM)
    for fid, cam in ids.items():
        if fid not in citados:
            falhas.append(falha(ID_FUNDAMENTOS, "FUNDAMENTO_SOLTO", cam, f"O fundamento {fid} não é citado por nenhuma peça, passo fixo, condição nem tema. Tire-o ou ligue-o a uma conclusão.", fid))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-LEI-NA-TABELA
# ---------------------------------------------------------------------------------------
ID_TABELA = "CHK-PARECER-LEI-NA-TABELA"


@checagem(ID_TABELA, "Fundamento da tabela de leis é de uma linha da tabela do pacote",
          "Lei inventada, lei fora da tabela ou trecho de um artigo apresentado como se fosse de outro passava por citação de lei.",
          ["C-10", "K-18", "K-9"])
def lei_na_tabela(exe):
    if not aplica(exe, ID_TABELA):
        return None
    tabela = pedido(exe).tabela
    linhas_t = linhas_da_tabela(exe)
    falhas = []
    for cam, l in fundamentos(exe):
        cit = _citacao(l)
        if texto_da(l, "origem") != ORIGEM_TABELA or cit is None:
            continue
        if not tabela or not linhas_t:
            falhas.append(falha(ID_TABELA, "SEM_TABELA_NO_PACOTE", cam, "O pacote desta execução não trouxe a tabela de leis: nenhuma lei pode ser citada. Registre a falta em vez de citar lei de memória."))
            continue
        if cit.get("fonte_importada_id") != tabela.get("fonte_importada_id"):
            falhas.append(falha(ID_TABELA, "FONTE_NAO_E_A_TABELA", f"{cam}.citacao",
                                f"A citação aponta '{cit.get('fonte_importada_id')}', mas a tabela de leis deste pacote é '{tabela.get('fonte_importada_id')}'.", str(cit.get("fonte_importada_id"))))
            continue
        ref = T.normalizar(texto_da(l, "referencia"))
        linha = next((x for x in linhas_t if T.normalizar(x["referencia"]) == ref), None)
        if linha is None:
            falhas.append(falha(ID_TABELA, "LEI_FORA_DA_TABELA", f"{cam}.referencia",
                                f"'{texto_da(l, 'referencia')}' não é uma linha da tabela de leis. Use a referência exatamente como está na tabela.", texto_da(l, "referencia")))
            continue
        trecho = cit.get("trecho_original")
        corpo = T.normalizar(trecho).strip() if isinstance(trecho, str) else ""
        if not corpo or corpo not in T.normalizar(linha["texto"]):
            outra = next((x["referencia"] for x in linhas_t if corpo and corpo in T.normalizar(x["texto"])), None)
            falhas.append(falha(ID_TABELA, "TRECHO_DE_OUTRA_LINHA" if outra else "TRECHO_NAO_ESTA_NA_LINHA", f"{cam}.citacao.trecho_original",
                                (f"O trecho citado é de '{outra}', não de '{linha['referencia']}'. " if outra else f"O trecho citado não está no texto oficial de '{linha['referencia']}'. ")
                                + "Copie o trecho da linha que a referência aponta.", trecho if isinstance(trecho, str) else ""))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-NOTA-DE-JURISPRUDENCIA (MARCA)
# ---------------------------------------------------------------------------------------
ID_NOTA = "CHK-PARECER-NOTA-DE-JURISPRUDENCIA"


@checagem(ID_NOTA, "Fundamento de linha com nota de jurisprudência traz a nota",
          "Artigo que os tribunais interpretam de um jeito (ex.: art. 19 do Marco Civil) era citado como se valesse sozinho, sem a nota.",
          ["C-10"], gravidade="MARCA")
def nota_de_jurisprudencia(exe):
    if not aplica(exe, ID_NOTA):
        return None
    linhas_t = linhas_da_tabela(exe)
    falhas = []
    for cam, l in fundamentos(exe):
        if texto_da(l, "origem") != ORIGEM_TABELA:
            continue
        ref = T.normalizar(texto_da(l, "referencia"))
        linha = next((x for x in linhas_t if T.normalizar(x["referencia"]) == ref), None)
        if linha is None or T.dobrar(linha["nota"]).strip() == SEM_NOTA:
            continue  # linha fora da tabela é assunto de CHK-PARECER-LEI-NA-TABELA; sem nota na tabela, nada a exigir
        if texto_da(l, "nota") != linha["nota"]:
            falhas.append(falha(ID_NOTA, "FUNDAMENTO_SEM_A_NOTA", f"{cam}.nota",
                                f"A linha '{linha['referencia']}' da tabela tem a nota {linha['nota']}, e o fundamento não a traz. Chega marcado: sem a nota de jurisprudência.", texto_da(l, "nota")))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-TERMOS-INTEIROS
# ---------------------------------------------------------------------------------------
ID_INTEIROS = "CHK-PARECER-TERMOS-INTEIROS"


@checagem(ID_INTEIROS, "Página citada em fundamento foi lida por inteiro nesta execução",
          "O parecer podia concluir sobre os termos ou a política de um site lendo só metade da página (ou nem lendo).",
          ["C-1", "FC-5"])
def termos_inteiros(exe):
    if not aplica(exe, ID_INTEIROS):
        return None
    falhas = []
    for cam, l in fundamentos(exe):
        cit = _citacao(l)
        if texto_da(l, "origem") != ORIGEM_TERMOS or cit is None or not texto_da(cit, "leitura_id"):
            continue
        _, motivo, mensagem = _pagina_lida_inteira(exe, cit["leitura_id"])
        if motivo:
            falhas.append(falha(ID_INTEIROS, motivo, f"{cam}.citacao.leitura_id", mensagem, cit["leitura_id"]))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-AUSENCIA
# ---------------------------------------------------------------------------------------
ID_AUSENCIA = "CHK-PARECER-AUSENCIA"


def _acha_termo(texto_dobrado: str, termo: str) -> bool:
    """O termo (sem acento nem maiúscula) aparece no texto, começando numa palavra? (o plural e o final da palavra valem)"""
    partes = T.dobrar(termo).split()
    return bool(partes) and bool(re.search(r"(?<![a-z0-9])" + r"\s+".join(re.escape(p) for p in partes), texto_dobrado))


@checagem(ID_AUSENCIA, "Dizer que o documento não diz algo só com prova de busca",
          "'A política não fala de X' era escrito sem ter procurado X, sem ter lido a página inteira, ou com X escrito na própria página.",
          ["C-8", "C-1"])
def ausencia_com_prova(exe):
    if not aplica(exe, ID_AUSENCIA):
        return None
    p = parametros(exe, ID_AUSENCIA)
    flags = re.IGNORECASE if p.get("sem_diferenca_de_maiusculas", True) else 0
    frase = re.compile(p["frase_de_ausencia"], flags)
    termos_min, termos_max = p["termos_min"], p["termos_max"]
    falhas = []
    linhas_aus = linhas(exe, "ausencias")
    if not linhas_aus:
        for item in textos_livres_de(exe, COLUNAS_COM_AFIRMACOES):
            m = frase.search(T.normalizar_com_quebras(item.texto))
            if m:
                falhas.append(falha(ID_AUSENCIA, "FRASE_DE_AUSENCIA_SEM_LINHA", item.caminho,
                                    "O texto diz que um documento lido não diz algo, mas a seção 'ausencias' não tem a linha com os termos procurados. "
                                    "Ponha a linha (com os termos que o código vai buscar de novo) ou tire a frase.", m.group(0)))
    for cam, l in linhas_aus:
        termos = [t.strip() for t in str(l.get("termos_procurados") or "").split(",") if t.strip()]
        if not termos_min <= len(termos) <= termos_max:
            falhas.append(falha(ID_AUSENCIA, "TERMOS_FORA_DO_LIMITE", f"{cam}.termos_procurados",
                                f"Informe de {termos_min} a {termos_max} termos procurados, separados por vírgula; vieram {len(termos)}.", texto_da(l, "termos_procurados")))
        pagina, motivo, mensagem = _pagina_lida_inteira(exe, texto_da(l, "documento"))
        if pagina is None:
            falhas.append(falha(ID_AUSENCIA, motivo, f"{cam}.documento", mensagem, texto_da(l, "documento")))
            continue
        for termo in termos:
            onde = next((n for n in sorted(pagina.partes) if _acha_termo(pagina.parte_dobrada(n), termo)), None)
            if onde is not None:
                falhas.append(falha(ID_AUSENCIA, "TERMO_ESTA_NA_PAGINA", f"{cam}.termos_procurados",
                                    f"O código procurou '{termo}' na cópia guardada da página {pagina.leitura_id} e achou (parte {onde}). A frase de que a página não diz isso está errada.", termo))
    return falhas
