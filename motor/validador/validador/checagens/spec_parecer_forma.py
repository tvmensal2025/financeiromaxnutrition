"""Checagens do PARECER (Clara) que olham a FORMA da entrega: seções, tamanhos, peças, semáforo, ajuste, trecho, passos fixos,
temas, condições e advogado. As 10 primeiras do portão 1 do tipo parecer.

O que é: código puro, sem IA. Cada função é uma CHK de helena-v2/deliverables/parecer.yaml (checagens_codigo), com o mesmo id,
a mesma gravidade e os mesmos furos. Todas só valem para o tipo parecer e para a ação ENTREGAR (nos outros casos devolvem None).
De onde vêm os números e as listas: do bloco `parametros` de cada CHK no YAML (exe.parametros); aqui nada disso é copiado.
Como mudar uma regra: mude o YAML do tipo (parâmetros) ou, se for a lógica, a função com o id da CHK. Os ajudantes comuns estão
em spec_parecer_base.py. Falha fechada: se uma checagem quebrar por entrega estranha, o núcleo recusa a entrega.
"""
from .. import texto as T
from ..registro import checagem
from .spec_parecer_base import (AJUSTE, NAO, NAO_PODE, NAO_SE_APLICA, NENHUM, PONTO_INCERTO, QUALQUER_PASSO_DE_FORA, SIM, SEM_AJUSTE_OK, TEMA_PASSOS_FIXOS,
                                aplica, e_nenhum, falha, ids_da_celula, linhas, parametros, pedido, pior_primeiro, sem_plano,
                                texto_da, trecho_esta_em, versao_como_texto)


def _tem_conteudo(v) -> bool:
    """Texto de verdade: não vazio e diferente de 'nenhum'."""
    return isinstance(v, str) and bool(v.strip()) and not e_nenhum(v)


# ---------------------------------------------------------------------------------------
# CHK-PARECER-SO-SECOES
# ---------------------------------------------------------------------------------------
ID_SECOES = "CHK-PARECER-SO-SECOES"


@checagem(ID_SECOES, "Só as seções e colunas do tipo parecer",
          "Seção a mais (ex.: a peça reescrita pela Clara) ou coluna inventada passava como se fosse parte do parecer.",
          ["K-13", "A-17"])
def so_secoes(exe):
    if not aplica(exe, ID_SECOES):
        return None
    secoes = {s["id"]: s for s in exe.modelo.get("secoes") or []}
    if not secoes:
        raise ValueError("O modelo do serviço não traz as seções do parecer: sem elas não há como conferir.")
    falhas = []
    for sid, valor in exe.acao_obj["entrega"].items():
        s = secoes.get(sid)
        if s is None:
            falhas.append(falha(ID_SECOES, "SECAO_A_MAIS", f"entrega.{sid}",
                                f"A seção '{sid}' não existe no parecer. Quem refaz a peça é o autor dela: o parecer só tem estas seções: {', '.join(secoes)}.", sid))
            continue
        tipo = s.get("tipo_de_campo")
        if tipo == "tabela" and isinstance(valor, list):
            colunas = [c["id"] for c in s.get("colunas") or []]
            for i, linha in enumerate(valor):
                cam = f"entrega.{sid}[{i}]"
                if not isinstance(linha, dict):
                    falhas.append(falha(ID_SECOES, "LINHA_QUE_NAO_E_OBJETO", cam, f"Cada linha de '{sid}' deve ter as colunas: {', '.join(colunas)}."))
                    continue
                for c in linha:
                    if c not in colunas:
                        falhas.append(falha(ID_SECOES, "COLUNA_A_MAIS", f"{cam}.{c}",
                                            f"A coluna '{c}' não existe na seção '{sid}'. As colunas são: {', '.join(colunas)}.", c))
        elif tipo == "lista" and isinstance(valor, list):
            for i, item in enumerate(valor):
                if not isinstance(item, str):
                    falhas.append(falha(ID_SECOES, "ITEM_FORA_DA_FORMA", f"entrega.{sid}[{i}]", f"Cada item de '{sid}' deve ser só um texto."))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-TAMANHO
# ---------------------------------------------------------------------------------------
ID_TAMANHO = "CHK-PARECER-TAMANHO"


@checagem(ID_TAMANHO, "Cada célula do parecer dentro do limite",
          "Célula gigante (ajuste com a peça inteira reescrita, resposta de parágrafos) escondia o defeito e cansava quem revisa.",
          ["CONF-21"])
def tamanho_das_celulas(exe):
    if not aplica(exe, ID_TAMANHO):
        return None
    maximo = parametros(exe, ID_TAMANHO)["maximo"]
    secoes = {s["id"]: s for s in exe.modelo.get("secoes") or []}
    falhas = []

    def conferir(cam, nome, v, limite):
        if isinstance(v, str) and len(v.strip()) > limite:
            falhas.append(falha(ID_TAMANHO, "CELULA_GRANDE_DEMAIS", cam,
                                f"'{nome}' tem {len(v.strip())} caracteres e o máximo é {limite}. Resuma; o ajuste nunca traz a peça inteira reescrita.", v))

    for sid, valor in exe.acao_obj["entrega"].items():
        if not isinstance(valor, list):
            continue
        tipo = (secoes.get(sid) or {}).get("tipo_de_campo")
        for i, linha in enumerate(valor):
            if isinstance(linha, dict):
                for coluna, v in linha.items():
                    if coluna in maximo:
                        conferir(f"entrega.{sid}[{i}].{coluna}", coluna, v, maximo[coluna])
            elif tipo == "lista" and f"item_{sid}" in maximo:
                conferir(f"entrega.{sid}[{i}]", f"item de {sid}", linha, maximo[f"item_{sid}"])
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-PECAS
# ---------------------------------------------------------------------------------------
ID_PECAS = "CHK-PARECER-PECAS"


@checagem(ID_PECAS, "Uma linha por peça julgada, na versão do pacote",
          "O parecer podia deixar uma peça sem julgar, julgar uma que não é desta etapa ou julgar uma versão que não veio no pacote.",
          ["M-4", "K-13"])
def uma_linha_por_peca(exe):
    if not aplica(exe, ID_PECAS):
        return None
    if (f := sem_plano(exe, ID_PECAS)):
        return f
    ped = pedido(exe)
    falhas = []
    if not ped.julgadas:
        return [falha(ID_PECAS, "PLANO_SEM_ETAPA_JULGADA", "contexto.pedido", f"O plano não diz quais etapas a {ped.etapa} julga: não há o que conferir.")]
    por_etapa = {}
    for cam, l in linhas(exe, "pecas"):
        por_etapa.setdefault(texto_da(l, "etapa"), []).append((cam, l))
    for e in ped.julgadas:
        if e not in por_etapa:
            falhas.append(falha(ID_PECAS, "PECA_SEM_LINHA", "entrega.pecas", f"Falta a linha da etapa {e}: o plano manda este parecer julgar {', '.join(ped.julgadas)}.", e))
        elif len(por_etapa[e]) > 1:
            falhas.append(falha(ID_PECAS, "PECA_REPETIDA", por_etapa[e][1][0], f"A etapa {e} tem {len(por_etapa[e])} linhas. Deve ter exatamente uma.", e))
    for e, ls in por_etapa.items():
        if e not in ped.julgadas:
            falhas.append(falha(ID_PECAS, "ETAPA_QUE_NAO_E_DESTE_PARECER", ls[0][0], f"A etapa '{e}' não é uma das que este parecer julga ({', '.join(ped.julgadas)}).", e))
    for e in ped.julgadas:
        for cam, l in por_etapa.get(e, []):
            v = versao_como_texto(l.get("versao"))
            existentes = ped.versoes.get(e) or {}
            if v is None:
                falhas.append(falha(ID_PECAS, "VERSAO_INVALIDA", f"{cam}.versao", "A versão deve ser um número inteiro: a versão aprovada da peça que veio no pacote."))
            elif v not in existentes:
                falhas.append(falha(ID_PECAS, "VERSAO_FORA_DO_PACOTE", f"{cam}.versao",
                                    f"A linha diz versão {v}, mas a peça {e} que veio no pacote tem só: {', '.join(sorted(existentes)) or 'nenhuma versão'}.", v))
            elif len(existentes) > 1:
                # O pacote traz mais de uma versão: o número sozinho não diz qual é a julgada. Se o trecho que a linha cita só existe em
                # OUTRA versão, a linha está com o número da versão trocado.
                trecho = l.get("trecho_da_peca")
                if _tem_conteudo(trecho) and not trecho_esta_em(trecho, existentes[v]):
                    outras = [o for o, textos in existentes.items() if o != v and trecho_esta_em(trecho, textos)]
                    if outras:
                        falhas.append(falha(ID_PECAS, "VERSAO_TROCADA", f"{cam}.versao",
                                            f"A linha diz versão {v}, mas o trecho citado está na versão {', '.join(sorted(outras))} da peça {e}. Use o número da versão que foi julgada.", trecho))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-SEMAFORO
# ---------------------------------------------------------------------------------------
ID_SEMAFORO = "CHK-PARECER-SEMAFORO"


@checagem(ID_SEMAFORO, "Semáforo de cada linha e semáforo da entrega",
          "O campo 'parecer' da entrega é o único que o motor lê: se não fosse o pior das linhas, um AJUSTE ou NÃO PODE passava como OK.",
          ["CONF-05", "M-4"])
def semaforo(exe):
    if not aplica(exe, ID_SEMAFORO):
        return None
    p = parametros(exe, ID_SEMAFORO)
    falhas, vistos = [], []
    for secao_id, permitidos in (("pecas", p["pecas"]), ("passos_fixos", p["passos_fixos"])):
        for cam, l in linhas(exe, secao_id):
            v = texto_da(l, "semaforo")
            if v in permitidos:
                vistos.append(v)
            else:
                falhas.append(falha(ID_SEMAFORO, "SEMAFORO_FORA_DA_LISTA", f"{cam}.semaforo",
                                    f"O semáforo de '{secao_id}' deve ser um destes: {', '.join(permitidos)}.", v))
    pior = pior_primeiro(p["ordem_do_pior"], vistos)
    dito = exe.acao_obj.get("parecer")
    if pior is not None and dito != pior:
        falhas.append(falha(ID_SEMAFORO, "PARECER_NAO_E_O_PIOR", "resposta.parecer",
                            f"O campo 'parecer' da entrega diz {dito}, mas o pior semáforo das linhas é {pior} (do pior ao melhor: {', '.join(p['ordem_do_pior'])}).", str(dito)))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-AJUSTE
# ---------------------------------------------------------------------------------------
ID_AJUSTE = "CHK-PARECER-AJUSTE"


@checagem(ID_AJUSTE, "Trecho e ajuste de acordo com o semáforo",
          "Um AJUSTE sem dizer o que mudar, ou um NÃO PODE disfarçado de ajuste de texto, deixava o autor sem saber o que fazer.",
          ["M-4", "CONF-05"])
def ajuste_combina_com_semaforo(exe):
    if not aplica(exe, ID_AJUSTE):
        return None
    falhas = []
    for cam, l in linhas(exe, "pecas"):
        sem, trecho, aj = texto_da(l, "semaforo"), l.get("trecho_da_peca"), l.get("ajuste")
        if sem == AJUSTE:
            if not _tem_conteudo(trecho):
                falhas.append(falha(ID_AJUSTE, "AJUSTE_SEM_TRECHO", f"{cam}.trecho_da_peca", "Linha AJUSTE precisa do trecho da peça que deve mudar (não pode ser 'nenhum')."))
            if not _tem_conteudo(aj):
                falhas.append(falha(ID_AJUSTE, "AJUSTE_VAZIO", f"{cam}.ajuste", "Linha AJUSTE precisa dizer o que trocar, tirar ou acrescentar (não pode ser 'nenhum').", str(aj or "")))
        elif sem == NAO_PODE:
            if not _tem_conteudo(trecho):
                falhas.append(falha(ID_AJUSTE, "NAO_PODE_SEM_TRECHO", f"{cam}.trecho_da_peca", "Linha NAO_PODE precisa do trecho da peça que causa o problema (não pode ser 'nenhum')."))
            if not e_nenhum(aj):
                falhas.append(falha(ID_AJUSTE, "NAO_PODE_COM_AJUSTE", f"{cam}.ajuste",
                                    "Linha NAO_PODE não traz ajuste de texto (o card pergunta a você). Ponha 'nenhum' no ajuste.", str(aj or "")))
        elif sem == SEM_AJUSTE_OK:
            if not e_nenhum(aj):
                falhas.append(falha(ID_AJUSTE, "OK_COM_AJUSTE", f"{cam}.ajuste", "Linha OK não pede ajuste. Ponha 'nenhum' no ajuste.", str(aj or "")))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-TRECHO-DA-PECA
# ---------------------------------------------------------------------------------------
ID_TRECHO = "CHK-PARECER-TRECHO-DA-PECA"


@checagem(ID_TRECHO, "Trecho da peça é cópia literal da peça julgada",
          "Um trecho inventado (ou de outra versão) parecia prova de que o parecer leu a peça.",
          ["C-8", "C-11"])
def trecho_da_peca_existe(exe):
    if not aplica(exe, ID_TRECHO):
        return None
    if (f := sem_plano(exe, ID_TRECHO)):
        return f
    ped = pedido(exe)
    minimo = parametros(exe, ID_TRECHO)["palavras_min"]
    falhas, julgados = [], []

    def conferir(cam, trecho, textos, onde):
        if T.contar_palavras(trecho) < minimo:
            falhas.append(falha(ID_TRECHO, "TRECHO_CURTO", cam, f"O trecho tem menos de {minimo} palavras. Copie da peça um trecho de {minimo} palavras ou mais.", trecho))
        elif not trecho_esta_em(trecho, textos):
            falhas.append(falha(ID_TRECHO, "TRECHO_NAO_ESTA_NA_PECA", cam, f"O trecho não está {onde}. Copie o trecho exatamente como está na peça.", trecho))

    for cam, l in linhas(exe, "pecas"):
        e, v, trecho = texto_da(l, "etapa"), versao_como_texto(l.get("versao")), l.get("trecho_da_peca")
        textos = (ped.versoes.get(e) or {}).get(v) if v else None
        if textos is not None:
            julgados += textos
        if not _tem_conteudo(trecho):
            continue
        if textos is None:
            falhas.append(falha(ID_TRECHO, "PECA_SEM_TEXTO_PARA_CONFERIR", f"{cam}.trecho_da_peca",
                                f"A versão {v} da peça {e} não veio no pacote: não dá para conferir o trecho.", trecho))
        else:
            conferir(f"{cam}.trecho_da_peca", trecho, textos, f"na versão {v} da peça {e}")
    for cam, l in linhas(exe, "temas"):
        trecho = l.get("trecho_da_peca")
        if texto_da(l, "tema") == TEMA_PASSOS_FIXOS or not _tem_conteudo(trecho):
            continue  # no tema dos passos fixos o trecho lista os PF-nn: quem confere é CHK-PARECER-PASSOS-FIXOS
        if not julgados:
            falhas.append(falha(ID_TRECHO, "PECA_SEM_TEXTO_PARA_CONFERIR", f"{cam}.trecho_da_peca", "Não há texto de peça julgada no pacote para conferir este trecho.", trecho))
        else:
            conferir(f"{cam}.trecho_da_peca", trecho, julgados, "na peça julgada")
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-PASSOS-FIXOS
# ---------------------------------------------------------------------------------------
ID_PASSOS = "CHK-PARECER-PASSOS-FIXOS"


@checagem(ID_PASSOS, "Uma linha por passo fixo coberto, e o tema dos passos fixos",
          "O parecer podia esquecer um passo fixo do roteiro (o que só o fundador faz fora do sistema) ou julgar um que não é desta etapa.",
          ["B-17", "CONF-20"])
def passos_fixos(exe):
    if not aplica(exe, ID_PASSOS):
        return None
    if (f := sem_plano(exe, ID_PASSOS)):
        return f
    cobertos = set(pedido(exe).passos)
    falhas, vistos = [], {}
    for cam, l in linhas(exe, "passos_fixos"):
        pid = texto_da(l, "passo")
        if pid in vistos:
            falhas.append(falha(ID_PASSOS, "PASSO_REPETIDO", cam, f"O passo {pid} tem mais de uma linha. Deve ter exatamente uma.", pid))
        elif pid not in cobertos:
            falhas.append(falha(ID_PASSOS, "PASSO_QUE_O_PLANO_NAO_DEU", cam,
                                f"O passo '{pid}' não é um passo fixo coberto por esta etapa" + (f" (cobertos: {', '.join(sorted(cobertos))})." if cobertos else ": o plano não deu nenhum a ela."), pid))
        vistos[pid] = cam
    for pid in sorted(cobertos - set(vistos)):
        falhas.append(falha(ID_PASSOS, "PASSO_SEM_LINHA", "entrega.passos_fixos", f"Falta a linha do passo fixo {pid}: o plano diz que esta etapa o cobre.", pid))
    tema = next(((c, l) for c, l in linhas(exe, "temas") if texto_da(l, "tema") == TEMA_PASSOS_FIXOS), None)
    if tema is not None:
        cam, l = tema
        esperado = SIM if cobertos else NAO
        if texto_da(l, "aplica") != esperado:
            falhas.append(falha(ID_PASSOS, "TEMA_DOS_PASSOS_ERRADO", f"{cam}.aplica",
                                f"O tema {TEMA_PASSOS_FIXOS} deve ser {esperado}: " + ("o plano deu passos fixos a esta etapa." if cobertos else "o plano não deu passo fixo a esta etapa."),
                                texto_da(l, "aplica")))
        elif cobertos:
            citados = {p.strip() for p in str(l.get("trecho_da_peca") or "").replace(";", ",").split(",") if p.strip()}
            if citados != cobertos:
                falhas.append(falha(ID_PASSOS, "TEMA_DOS_PASSOS_COM_LISTA_DIFERENTE", f"{cam}.trecho_da_peca",
                                    f"No tema {TEMA_PASSOS_FIXOS} o trecho deve listar os passos fixos cobertos ({', '.join(sorted(cobertos))}); veio '{texto_da(l, 'trecho_da_peca')}'.",
                                    texto_da(l, "trecho_da_peca")))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-TEMAS
# ---------------------------------------------------------------------------------------
ID_TEMAS = "CHK-PARECER-TEMAS"


@checagem(ID_TEMAS, "Uma linha por tema obrigatório, bem preenchida",
          "Tema esquecido, repetido ou marcado 'sim' sem trecho nem fundamento deixava um risco jurídico (imagem, voz, menores...) sem resposta.",
          ["C-10", "CONF-04"])
def temas(exe):
    if not aplica(exe, ID_TEMAS):
        return None
    p = parametros(exe, ID_TEMAS)
    esperados, com_sim = p["temas"], p["naturezas_com_sim"]
    falhas, vistos = [], {}
    for cam, l in linhas(exe, "temas"):
        t = texto_da(l, "tema")
        if t in vistos:
            falhas.append(falha(ID_TEMAS, "TEMA_REPETIDO", cam, f"O tema {t} aparece mais de uma vez. Deve ter exatamente uma linha.", t))
        elif t not in esperados:
            falhas.append(falha(ID_TEMAS, "TEMA_DESCONHECIDO", cam, f"'{t}' não é um dos temas obrigatórios ({', '.join(esperados)}).", t))
        vistos.setdefault(t, cam)
        aplica_ = texto_da(l, "aplica")
        natureza = texto_da(l, "natureza")
        if aplica_ == SIM:
            if natureza not in com_sim:
                falhas.append(falha(ID_TEMAS, "NATUREZA_ERRADA", f"{cam}.natureza", f"Com SIM, a natureza deve ser uma destas: {', '.join(com_sim)}.", natureza))
            for coluna in ("trecho_da_peca", "fundamentos"):
                if not _tem_conteudo(l.get(coluna)):
                    falhas.append(falha(ID_TEMAS, "TEMA_SIM_SEM_" + coluna.upper(), f"{cam}.{coluna}",
                                        f"Tema {t} marcado SIM precisa de {'um trecho literal da peça' if coluna == 'trecho_da_peca' else 'pelo menos um fundamento'} (não pode ser 'nenhum')."))
        elif aplica_ == NAO:
            if natureza != NAO_SE_APLICA:
                falhas.append(falha(ID_TEMAS, "NATUREZA_ERRADA", f"{cam}.natureza", f"Com NAO, a natureza deve ser {NAO_SE_APLICA}.", natureza))
            for coluna in ("trecho_da_peca", "fundamentos"):
                if not e_nenhum(l.get(coluna)):
                    falhas.append(falha(ID_TEMAS, "TEMA_NAO_COM_" + coluna.upper(), f"{cam}.{coluna}", f"Tema {t} marcado NAO deve ter '{NENHUM}' em {coluna}."))
            if not texto_da(l, "resposta"):
                falhas.append(falha(ID_TEMAS, "TEMA_NAO_SEM_RESPOSTA", f"{cam}.resposta", f"Tema {t} marcado NAO precisa dizer por que não se aplica."))
        else:
            falhas.append(falha(ID_TEMAS, "APLICA_FORA_DA_LISTA", f"{cam}.aplica", f"A coluna aplica deve ser {SIM} ou {NAO}.", aplica_))
    for t in esperados:
        if t not in vistos:
            falhas.append(falha(ID_TEMAS, "TEMA_FALTANDO", "entrega.temas", f"Falta a linha do tema {t}.", t))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-CONDICOES
# ---------------------------------------------------------------------------------------
ID_CONDICOES = "CHK-PARECER-CONDICOES"


@checagem(ID_CONDICOES, "Condição aponta uma ação que o plano já tem",
          "O parecer podia inventar uma ação nova (publicar, divulgar, enviar) como se fosse parte do plano.",
          ["B-17", "CONF-20"])
def condicoes(exe):
    if not aplica(exe, ID_CONDICOES):
        return None
    if (f := sem_plano(exe, ID_CONDICOES)):
        return f
    ped = pedido(exe)
    permitidos = set(ped.acoes.values()) | set(ped.passos)
    falhas = []
    for cam, l in linhas(exe, "condicoes"):
        alvo = texto_da(l, "antes_de")
        if alvo in permitidos or T.dobrar(alvo).strip(" .") == T.dobrar(QUALQUER_PASSO_DE_FORA):
            continue
        falhas.append(falha(ID_CONDICOES, "ACAO_QUE_O_PLANO_NAO_TEM", f"{cam}.antes_de",
                            f"'{alvo}' não é ação do plano. Use o id da ação de uma etapa julgada ({', '.join(sorted(ped.acoes.values())) or 'nenhuma'}), "
                            f"um passo fixo coberto ({', '.join(sorted(ped.passos)) or 'nenhum'}) ou '{QUALQUER_PASSO_DE_FORA}'.", alvo))
    return falhas


# ---------------------------------------------------------------------------------------
# CHK-PARECER-ADVOGADO
# ---------------------------------------------------------------------------------------
ID_ADVOGADO = "CHK-PARECER-ADVOGADO"
SECAO_ADVOGADO = "quando_chamar_advogado"


@checagem(ID_ADVOGADO, "Todo ponto incerto e todo NÃO PODE tem gatilho de advogado",
          "O parecer podia admitir que não sabe (ponto incerto) ou proibir uma peça sem dizer quando o fundador deve ouvir um advogado.",
          ["C-10", "C-13"])
def advogado(exe):
    if not aplica(exe, ID_ADVOGADO):
        return None
    falhas = []
    secao_do_modelo = next((s for s in exe.modelo.get("secoes") or [] if s.get("id") == SECAO_ADVOGADO), {})
    minimo, maximo = secao_do_modelo.get("itens_min"), secao_do_modelo.get("itens_max")
    gatilhos = linhas(exe, SECAO_ADVOGADO)
    if (minimo is not None and len(gatilhos) < minimo) or (maximo is not None and len(gatilhos) > maximo):
        falhas.append(falha(ID_ADVOGADO, "QUANTIDADE_DE_GATILHOS", f"entrega.{SECAO_ADVOGADO}",
                            f"'Quando chamar um advogado' deve ter de {minimo} a {maximo} linhas; tem {len(gatilhos)}."))
    cobertos = {c for _, l in gatilhos for c in ids_da_celula(l.get("cobre"))}
    exigidos = []
    for cam, l in linhas(exe, "temas"):
        if texto_da(l, "natureza") == PONTO_INCERTO:
            exigidos.append((cam, texto_da(l, "tema"), "o tema", "ponto incerto"))
    for cam, l in linhas(exe, "pecas"):
        if texto_da(l, "semaforo") == NAO_PODE:
            exigidos.append((cam, texto_da(l, "etapa"), "a etapa", NAO_PODE))
    for cam, l in linhas(exe, "passos_fixos"):
        if texto_da(l, "semaforo") == NAO_PODE:
            exigidos.append((cam, texto_da(l, "passo"), "o passo fixo", NAO_PODE))
    for cam, id_, o_que, por_que in exigidos:
        if id_ not in cobertos:
            falhas.append(falha(ID_ADVOGADO, "SEM_GATILHO_DE_ADVOGADO", cam,
                                f"{o_que.capitalize()} {id_} é {por_que}, mas nenhuma linha de 'quando chamar um advogado' o traz na coluna cobre.", id_))
    return falhas
