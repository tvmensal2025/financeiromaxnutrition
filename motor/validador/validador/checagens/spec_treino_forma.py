"""Roteiro de treinamento: a FORMA do passo a passo (CHK-TREINO-03) e do checklist final (CHK-TREINO-06).

O que é:
  CHK-TREINO-03  passos com uma ação só: ids P1, P2... em ordem, de 3 a 12 passos, cada `o_que_fazer` com até 200 caracteres,
                 uma só frase e nenhum "e depois", "em seguida", "logo após".
  CHK-TREINO-06  checklist de sim ou não: de 3 a 10 itens, até 160 caracteres, terminando em "?", citando um passo (P) ou erro (E)
                 que existe, e todo erro da tabela aparecendo em pelo menos um item.
De onde vem: números, padrão dos ids e lista de expressões estão em helena-v2/deliverables/roteiro_treinamento.yaml (parametros das
duas checagens). Os padrões dos ids de passo e de erro, que a CHK-TREINO-06 também usa, são lidos de CHK-TREINO-03 (`ids`) e
CHK-TREINO-05 (`ids_dos_erros`): continuam escritos num lugar só.
Como mudar: mude o YAML (limite, expressão, padrão de id). O que o código não confere (se o passo é mesmo algo que um leigo faz
sozinho, se a pergunta é clara) é da rubrica (RUB-TREINO-01 e 07).
"""
import re
from .. import texto as T
from ..registro import checagem
from ..resultado import Falha
from . import spec_treino_base as B

ID03, ID06 = "CHK-TREINO-03", "CHK-TREINO-06"


def _ids_da_tabela(exe, secao) -> list:
    """Os ids (texto) que existem nas linhas de uma tabela, na ordem em que vêm."""
    return [l[B.COL_ID] for l in B.linhas_da_secao(exe, secao) if isinstance(l, dict) and isinstance(l.get(B.COL_ID), str)]


# ---------------------------------------------------------------------------------------
# CHK-TREINO-03: passos com uma ação só
# ---------------------------------------------------------------------------------------
@checagem(ID03, "Passos com uma ação só, em ordem e curtos",
          "O passo a passo podia vir com ids fora de ordem, passos demais ou passo que junta duas ações ('faça isto e, em seguida, aquilo'), que uma pessoa leiga não consegue seguir.",
          ["A-17", "K-13"])
def passos_com_uma_acao(exe):
    def corpo(exe, p):
        padrao, rotulo, inicio = B.regra_de_ids(p, "ids")
        minimo, maximo = B.faixa(p, "passos")
        limite = B.inteiro(p.get("maximo_caracteres"), "maximo_caracteres")
        expressoes = B.lista_de_textos(p, "expressoes_de_duas_acoes")
        linhas = B.linhas_da_secao(exe, B.SECAO_PASSOS)
        base = f"entrega.{B.SECAO_PASSOS}"
        falhas = []
        if not (minimo <= len(linhas) <= maximo):
            falhas.append(Falha(ID03, "QUANTIDADE_DE_PASSOS", base,
                                f"O roteiro tem {len(linhas)} passo(s); o certo é de {minimo} a {maximo}, cada um com uma ação só."))
        for i, linha in enumerate(linhas):
            cam = f"{base}[{i}]"
            if not isinstance(linha, dict):
                falhas.append(Falha(ID03, "PASSO_MAL_FORMADO", cam, "Cada passo deve ser uma linha da tabela, com id e o que fazer."))
                continue
            esperado = f"{rotulo}{inicio + i}"
            if B.numero_do_id(padrao, linha.get(B.COL_ID)) != inicio + i:
                falhas.append(Falha(ID03, "ID_DO_PASSO_FORA_DE_ORDEM", f"{cam}.{B.COL_ID}",
                                    f"Os passos têm ids em ordem, sem pular nem repetir. Este deveria ser {esperado}.", T.cortar(str(linha.get(B.COL_ID)))))
            texto = linha.get(B.COL_PASSO)
            if not isinstance(texto, str) or not texto.strip():
                falhas.append(Falha(ID03, "PASSO_SEM_TEXTO", f"{cam}.{B.COL_PASSO}", "O passo precisa de uma frase em 'o_que_fazer'."))
                continue
            onde = f"{cam}.{B.COL_PASSO}"
            if len(texto) > limite:
                falhas.append(Falha(ID03, "PASSO_GRANDE_DEMAIS", onde,
                                    f"O passo tem {len(texto)} caracteres; o limite é {limite}. Divida em passos de uma ação só.", T.cortar(texto)))
            if not B.uma_so_frase(texto):
                falhas.append(Falha(ID03, "PASSO_COM_MAIS_DE_UMA_FRASE", onde,
                                    "O passo deve ser uma frase só, com um único ponto final, de exclamação ou de interrogação, no fim.", T.cortar(texto)))
            achadas = B.termos_no_texto(texto, expressoes)
            duas_ordens = re.search(
                r"(?:,|;|\be\b|\bdepois\b)\s*(?:na sequencia\s+)?"
                r"(?:ajuste|toque|apoie|grave|assista|envie|avise|abra|feche|segure|coloque|verifique|confira|mova)\b",
                T.dobrar(texto),
            )
            if duas_ordens and not achadas:
                achadas = [duas_ordens.group(0)]
            if achadas and B.uma_so_frase(texto):
                falhas.append(Falha(ID03, "DUAS_ACOES_NO_PASSO", onde,
                                    f"O passo junta duas ações ('{achadas[0]}'). Faça um passo para cada ação.", T.cortar(texto)))
        return falhas
    return B.rodar(exe, ID03, corpo)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-06: checklist que cobre os erros
# ---------------------------------------------------------------------------------------
@checagem(ID06, "Checklist de sim ou não que cobre todos os erros",
          "O checklist podia vir sem pergunta, longo demais, sem '?', apontando passo que não existe ou deixando um erro da tabela sem pergunta.",
          ["A-17", "CONF-21"])
def checklist_cobre_os_erros(exe):
    def corpo(exe, p):
        minimo, maximo = B.faixa(p, "itens")
        limite = B.inteiro(p.get("maximo_caracteres"), "maximo_caracteres")
        fim = p.get("termina_em")
        if not isinstance(fim, str) or not fim.strip():
            raise B.ErroDeParametro(f"O parâmetro 'termina_em' da especificação deveria ser um sinal (veio {fim!r}).")
        fim = fim.strip()
        padrao_p, _, _ = B.regra_de_ids(exe.parametros("CHK-TREINO-03"), "ids")
        padrao_e, _, _ = B.regra_de_ids(exe.parametros("CHK-TREINO-05"), "ids_dos_erros")
        existentes_p = set(_ids_da_tabela(exe, B.SECAO_PASSOS))
        existentes_e = set(_ids_da_tabela(exe, B.SECAO_ERROS))
        itens = B.linhas_da_secao(exe, B.SECAO_CHECKLIST)
        base = f"entrega.{B.SECAO_CHECKLIST}"
        falhas, citados = [], set()
        if not (minimo <= len(itens) <= maximo):
            falhas.append(Falha(ID06, "QUANTIDADE_DE_ITENS", base,
                                f"O checklist tem {len(itens)} item(ns); o certo é de {minimo} a {maximo}, cada um uma pergunta de sim ou não."))
        for i, item in enumerate(itens):
            cam = f"{base}[{i}]"
            texto = B.texto_do_item(item)
            if texto is None:
                falhas.append(Falha(ID06, "ITEM_MAL_FORMADO", cam, "Cada item do checklist deve ser um texto."))
                continue
            if len(texto) > limite:
                falhas.append(Falha(ID06, "ITEM_GRANDE_DEMAIS", cam, f"O item tem {len(texto)} caracteres; o limite é {limite}.", T.cortar(texto)))
            if not texto.rstrip().endswith(fim):
                falhas.append(Falha(ID06, "ITEM_SEM_PERGUNTA", cam, f"O item deve ser uma pergunta de sim ou não, terminando em '{fim}'.", T.cortar(texto)))
            ids = B.ids_no_texto(texto, (padrao_p, padrao_e))
            existem = [x for x in ids if x in existentes_p or x in existentes_e]
            citados |= set(existem)
            for x in ids:
                if x not in existentes_p and x not in existentes_e:
                    falhas.append(Falha(ID06, "ID_QUE_NAO_EXISTE", cam, f"O item cita {x}, que não existe nas tabelas desta entrega.", T.cortar(texto)))
            if not existem:
                falhas.append(Falha(ID06, "ITEM_SEM_PASSO_NEM_ERRO", cam,
                                    "O item deve citar o passo (P) ou o erro (E) que ele confere, por exemplo 'P2 e E1: ...?'.", T.cortar(texto)))
        for e in sorted(existentes_e - citados):
            falhas.append(Falha(ID06, "ERRO_SEM_PERGUNTA", base, f"O erro {e} não aparece em nenhum item do checklist. Faça uma pergunta que o confira.", e))
        return falhas
    return B.rodar(exe, ID06, corpo)
