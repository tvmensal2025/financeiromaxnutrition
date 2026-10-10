"""Defeitos plantados: fonte oficial, ausência, termos de uso, modelo de cálculo e câmbio."""
from .. import fabrica as F
from ..banco import DEL, Defeito, Sub

R, M = "RECUSA", "MARCA"
URL0 = "c.paginas_lidas[0].url"
OFICIAL = [("r.entrega.fatos_com_fonte[0].texto", "Segundo a fonte oficial, o participante precisa ter pelo menos 18 anos de idade.")]
AUS = "r.entrega.lacunas+"
FRASE_AUS = "A página não fala de comissão por indicação de novos participantes."
M_ = "r.entrega.modelo_de_calculo."
E = M_ + "entradas"
FM = M_ + "formulas"


def aus(**mudancas):
    d = {"leitura_id": "LEI-001", "termos_buscados": ["comissão", "indicação"], "partes_lidas": [1, 2]}
    d.update(mudancas)
    return {"texto": FRASE_AUS, "ausencia": d}


def oficial_de(url, motivo="FONTE_OFICIAL_DE_OUTRO_SITE", i="N"):
    return OFICIAL + [(URL0, url)]


DEFEITOS = [
    # ---- CHK-FONTE-01: fonte oficial
    Defeito("N01", "dossie", "chama de oficial uma página de outro site", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R),
            [("r.entrega.fatos_com_fonte[0]", {"texto": "Segundo a fonte oficial, o site coleta o e-mail do visitante para enviar novidades.",
                                              "citacoes": [F.cit("Coletamos o endereço de e-mail do visitante para enviar novidades sobre os nossos produtos e serviços de treinamento.", "LEI-003")]})]),
    Defeito("N02", "dossie", "site parecido por sufixo (.com.br.golpe.net)", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemplo.com.br.golpe.net/termos")),
    Defeito("N03", "dossie", "site parecido por subdomínio", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://golpe.plataformaexemplo.com.br/termos")),
    Defeito("N04", "dossie", "site parecido com letra cirílica (homógrafo)", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataforma\u0435xemplo.com.br/termos")),
    Defeito("N05", "dossie", "site parecido com número no lugar de letra", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemp1o.com.br/termos")),
    Defeito("N06", "dossie", "endereço com usuário na frente (truque do @)", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemplo.com.br@golpe.net/termos")),
    Defeito("N07", "dossie", "mesma máquina em outra porta", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemplo.com.br:8443/termos")),
    Defeito("N08", "dossie", "mesmo nome com outra terminação (.com)", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemplo.com/termos")),
    Defeito("N09", "dossie", "'rn' no lugar de 'm'", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexernplo.com.br/termos")),
    Defeito("N10", "dossie", "nome com hífen a mais", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataforma-exemplo.com.br/termos")),
    Defeito("N11", "dossie", "pedido sem link: não há como saber o que é oficial", ("CHK-FONTE-01", "OFICIAL_SEM_LINK_DO_PEDIDO", R), OFICIAL + [("c.links_do_pedido", [])]),
    Defeito("N12", "dossie", "'fonte oficial' sem apontar nenhuma página", ("CHK-FONTE-01", "OFICIAL_SEM_FONTE_APONTADA", R),
            [(AUS, "A fonte oficial recomenda ler as regras antes de gravar o primeiro vídeo.")]),
    Defeito("N13", "dossie", "barra invertida antes do @", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://www.plataformaexemplo.com.br\\@golpe.net/termos")),
    Defeito("N14", "dossie", "nome do servidor com código %", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("https://%77ww.plataformaexemplo.com.br/termos")),
    Defeito("N15", "dossie", "endereço numérico (IP)", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R), oficial_de("http://203.0.113.5/termos")),
    Defeito("N16", "dossie", "'página web oficial' (palavra no meio) de site parecido", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R),
            [("r.entrega.fatos_com_fonte[0].texto", "Segundo a página web oficial, o participante precisa ter pelo menos 18 anos de idade."),
             (URL0, "https://www.plataformaexemplo.com.br.golpe.net/termos")]),
    Defeito("N17", "dossie", "'regras oficiais' de site parecido", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R),
            [("r.entrega.fatos_com_fonte[0].texto", "As regras oficiais dizem que o participante precisa ter pelo menos 18 anos de idade."),
             (URL0, "https://www.plataformaexemplo.com.br.golpe.net/termos")]),
    Defeito("N18", "dossie", "o texto chama de oficial um link de site parecido (sufixo), mesmo citando a página certa", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R),
            [("r.entrega.fatos_com_fonte[0].texto", "Segundo a fonte oficial (https://www.plataformaexemplo.com.br.golpe.net/termos), o participante precisa ter pelo menos 18 anos de idade.")]),
    Defeito("N19", "dossie", "o texto chama de oficial um link com letra cirílica, mesmo citando a página certa", ("CHK-FONTE-01", "FONTE_OFICIAL_DE_OUTRO_SITE", R),
            [("r.entrega.fatos_com_fonte[0].texto", "Segundo a fonte oficial (https://www.plataforma\u0435xemplo.com.br/termos), o participante precisa ter pelo menos 18 anos de idade.")]),
    # ---- CHK-FONTE-02: "a página não fala de X"
    Defeito("O01", "dossie", "ausência afirmada sem nenhuma prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, FRASE_AUS)]),
    Defeito("O02", "dossie", "ausência afirmada lendo só a parte 1 de 2", ("CHK-FONTE-02", "LEITURA_INCOMPLETA", R), [(AUS, aus(partes_lidas=[1]))]),
    Defeito("O03", "dossie", "a página tem 3 partes e só 2 foram guardadas", ("CHK-FONTE-02", "LEITURA_INCOMPLETA", R),
            [("c.paginas_lidas[0].partes_total", 3), (AUS, aus(partes_lidas=[1, 2, 3]))]),
    Defeito("O04", "dossie", "o termo buscado aparece na página", ("CHK-FONTE-02", "TERMO_ENCONTRADO_NA_PAGINA", R),
            [(AUS, {"texto": "A página não fala de imagem dos participantes.", "ausencia": {"leitura_id": "LEI-001", "termos_buscados": ["imagem"], "partes_lidas": [1, 2]}})]),
    Defeito("O05", "dossie", "os termos buscados não são os da frase", ("CHK-FONTE-02", "TERMOS_NAO_APARECEM_NA_FRASE", R), [(AUS, aus(termos_buscados=["reembolso"]))]),
    Defeito("O06", "dossie", "nenhum termo buscado", ("CHK-FONTE-02", "SEM_TERMOS_BUSCADOS", R), [(AUS, aus(termos_buscados=[]))]),
    Defeito("O07", "dossie", "ausência sobre página que não foi lida", ("CHK-FONTE-02", "PAGINA_NAO_LIDA", R), [(AUS, aus(leitura_id="LEI-777"))]),
    Defeito("O08", "dossie", "o termo aparece na página no plural", ("CHK-FONTE-02", "TERMO_ENCONTRADO_NA_PAGINA", R),
            [(AUS, {"texto": "A página não fala de pagamento por tarefa concluída.", "ausencia": {"leitura_id": "LEI-001", "termos_buscados": ["pagamento"], "partes_lidas": [1, 2]}})]),
    Defeito("O09", "dossie", "'os termos não mencionam' sem prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, "Os termos não mencionam reembolso em nenhum momento do uso.")]),
    Defeito("O10", "dossie", "'não encontrei nenhuma menção' sem prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, "Não encontrei nenhuma menção a bônus na página.")]),
    Defeito("O11", "dossie", "'nenhuma menção consta' sem prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, "Nenhuma menção a reembolso consta nos termos de uso.")]),
    Defeito("O13", "dossie", "o termo está na página no plural (comissões) e a frase diz que não há comissão", ("CHK-FONTE-02", "TERMO_ENCONTRADO_NA_PAGINA", R),
            [("c.paginas_lidas[0].partes.2", Sub("cinco dias úteis.", "cinco dias úteis. As comissões são pagas depois.")), (AUS, aus())]),
    Defeito("O14", "dossie", "'os termos silenciam sobre' sem prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, "Os termos silenciam sobre reembolso de qualquer tipo.")]),
    Defeito("O15", "dossie", "'não fazem menção' sem prova", ("CHK-FONTE-02", "AUSENCIA_SEM_PROVA", R), [(AUS, "Os termos não fazem menção a reembolso em lugar nenhum.")]),
    Defeito("O12", "dossie", "termos buscados curtos demais", ("CHK-FONTE-02", "SEM_TERMOS_BUSCADOS", R), [(AUS, aus(termos_buscados=["a", "b"]))]),
    # ---- CHK-FONTE-03: termos de uso lidos por inteiro (jurídico)
    Defeito("P01", "parecer", "termos de uso lidos só em parte", ("CHK-FONTE-03", "TERMOS_LIDOS_EM_PARTE", R), [("c.paginas_lidas[0].partes_total", 3)]),
    Defeito("P02", "parecer", "nenhum termo de uso foi lido", ("CHK-FONTE-03", "NENHUM_TERMO_LIDO", R), [("c.paginas_lidas[0].tipo", "pagina"), ("c.paginas_lidas[1].tipo", "pagina")]),
    # ---- CHK-CALC-01: origem das entradas
    Defeito("Q01", "calculo", "entrada sem origem", ("CHK-CALC-01", "ORIGEM_AUSENTE_OU_INVALIDA", R), [(E + "[1].origem", DEL)]),
    Defeito("Q02", "calculo", "origem inventada ('CHUTE')", ("CHK-CALC-01", "ORIGEM_AUSENTE_OU_INVALIDA", R), [(E + "[1].origem", "CHUTE")]),
    Defeito("Q03", "calculo", "dado do fundador sem registro", ("CHK-CALC-01", "DADO_DO_FUNDADOR_SEM_REGISTRO", R), [(E + "[0].ref", "DEC-999")]),
    Defeito("Q04", "calculo", "dado do fundador com valor diferente do registrado", ("CHK-CALC-01", "DADO_DO_FUNDADOR_DIFERENTE", R), [(E + "[0].valor", "12")]),
    Defeito("Q05", "calculo", "fonte citada sem data", ("CHK-CALC-01", "FONTE_SEM_DATA", R), [(E + "[2].data_da_fonte", DEL)]),
    Defeito("Q06", "calculo", "data da fonte no futuro", ("CHK-CALC-01", "DATA_NO_FUTURO", R), [(E + "[2].data_da_fonte", "2026-12-31")]),
    Defeito("Q07", "calculo", "fonte citada sem citação", ("CHK-CALC-01", "FONTE_SEM_CITACAO", R), [(E + "[2].citacao", DEL)]),
    Defeito("Q08", "calculo", "o valor não está no trecho citado", ("CHK-CALC-01", "VALOR_NAO_ESTA_NA_CITACAO", R), [(E + "[2].valor", "0.75")]),
    Defeito("Q09", "calculo", "câmbio escondido dentro da fórmula", ("CHK-CALC-01", "NUMERO_SOLTO_NA_FORMULA", R), [(FM + "[1].expressao", "receita_usd * 5.4")]),
    Defeito("Q10", "calculo", "valor escrito por extenso", ("CHK-CALC-01", "VALOR_INVALIDO", R), [(E + "[0].valor", "dez")]),
    Defeito("Q11", "calculo", "entrada sem unidade", ("CHK-CALC-01", "SEM_UNIDADE", R), [(E + "[1].unidade", "")]),
    Defeito("Q12", "calculo", "data da fonte em formato errado", ("CHK-CALC-01", "DATA_INVALIDA", R), [(E + "[2].data_da_fonte", "01/10/2026")]),
    Defeito("Q13", "calculo", "entrega aprovada que não existe", ("CHK-CALC-01", "ENTREGA_APROVADA_DESCONHECIDA", R),
            [(E + "[1].origem", "ENTREGA_APROVADA"), (E + "[1].ref", "ENT-9"), ("c.entregas_aprovadas", ["ENT-1"])]),
    # ---- CHK-CALC-02: o código refaz as contas
    Defeito("R01", "calculo", "resultado errado (550 em vez de 540)", ("CHK-CALC-02", "RESULTADO_NAO_BATE", R), [(FM + "[1].resultado", "550.00")]),
    Defeito("R02", "calculo", "fórmula sem resultado", ("CHK-CALC-02", "SEM_RESULTADO", R), [(FM + "[1].resultado", DEL)]),
    Defeito("R03", "calculo", "arredondamento errado (100/3 = 33.33, não 33.34)", ("CHK-CALC-02", "RESULTADO_NAO_BATE", R),
            [(E + "+", {"id": "parcelas", "valor": "3", "unidade": "parcelas", "origem": "PREMISSA", "ref": "hipótese do Caio"}),
             (FM + "+", {"id": "por_parcela", "expressao": "receita_usd / parcelas", "resultado": "33.34", "unidade": "US$"})]),
    Defeito("R04", "calculo", "número 'calculado' que não bate com a fórmula", ("CHK-CALC-02", "NUMERO_NAO_BATE_COM_A_FORMULA", R),
            [("c.modelo.secoes+", {"id": "numeros_chave", "titulo": "Números-chave", "tipo_de_campo": "numero", "obrigatoria": True}),
             ("r.entrega.numeros_chave", {"valor": "550.00", "unidade": "R$", "origem": "CALCULADO", "ref": "receita_brl"})]),
    Defeito("R05", "calculo", "valor em dinheiro no texto que não vem do modelo", ("CHK-CALC-02", "NUMERO_FORA_DO_MODELO", R),
            [("r.entrega.conta_por_extenso", Sub("R$ 540.00", "R$ 5400.00"))]),
    Defeito("R06", "calculo", "o erro de uma conta pesa nas seguintes: a primeira está errada", ("CHK-CALC-02", "RESULTADO_NAO_BATE", R), [(FM + "[0].resultado", "90.00")]),
    Defeito("R07", "calculo", "número calculado com fórmula que não existe", ("CHK-CALC-01", "CALCULADO_SEM_FORMULA", R),
            [("c.modelo.secoes+", {"id": "numeros_chave", "titulo": "Números-chave", "tipo_de_campo": "numero", "obrigatoria": True}),
             ("r.entrega.numeros_chave", {"valor": "540.00", "unidade": "R$", "origem": "CALCULADO", "ref": "lucro_total"})]),
    # ---- CHK-CALC-03: câmbio
    Defeito("S01", "calculo", "câmbio como premissa", ("CHK-CALC-03", "CAMBIO_SEM_FONTE_DATADA", R),
            [(E + "[3].origem", "PREMISSA"), (E + "[3].citacao", DEL), (E + "[3].data_da_fonte", DEL)]),
    Defeito("S02", "calculo", "câmbio de fonte sem data", ("CHK-CALC-03", "CAMBIO_SEM_FONTE_DATADA", R), [(E + "[3].data_da_fonte", DEL)]),
    Defeito("S03", "calculo", "câmbio disfarçado de 'fator' (a unidade entrega)", ("CHK-CALC-03", "CAMBIO_SEM_FONTE_DATADA", R),
            [(E + "[3].id", "fator"), (E + "[3].origem", "PREMISSA"), (E + "[3].citacao", DEL), (E + "[3].data_da_fonte", DEL), (E + "[3].unidade", "R$ por US$"),
             (FM + "[1].expressao", "receita_usd * fator")]),
    Defeito("S04", "calculo", "câmbio vindo de 'entrega aprovada' sem fonte datada", ("CHK-CALC-03", "CAMBIO_SEM_FONTE_DATADA", R),
            [(E + "[3].origem", "ENTREGA_APROVADA"), (E + "[3].ref", "ENT-9"), (E + "[3].citacao", DEL), (E + "[3].data_da_fonte", DEL)]),
    Defeito("S05", "calculo", "câmbio marcado com tipo CAMBIO e origem premissa", ("CHK-CALC-03", "CAMBIO_SEM_FONTE_DATADA", R),
            [(E + "[3].tipo", "CAMBIO"), (E + "[3].origem", "PREMISSA"), (E + "[3].unidade", "fator"), (E + "[3].citacao", DEL), (E + "[3].data_da_fonte", DEL)]),
    # ---- CHK-CALC-04: fórmula segura
    Defeito("T01", "calculo", "fórmula que tenta executar código", ("CHK-CALC-04", "CARACTERE_NAO_PERMITIDO", R), [(FM + "[1].expressao", "__import__('os').system('ls')")]),
    Defeito("T02", "calculo", "fórmula com **", ("CHK-CALC-04", "SINTAXE", R), [(FM + "[1].expressao", "receita_usd ** 2")]),
    Defeito("T03", "calculo", "fórmula chamando eval", ("CHK-CALC-04", "FUNCAO_NAO_PERMITIDA", R), [(FM + "[1].expressao", "eval(receita_usd)")]),
    Defeito("T04", "calculo", "fórmula com nome que não existe", ("CHK-CALC-04", "NOME_DESCONHECIDO", R), [(FM + "[1].expressao", "receita_usd * fator_secreto")]),
    Defeito("T05", "calculo", "id repetido no modelo", ("CHK-CALC-04", "ID_REPETIDO", R), [(FM + "[1].id", "receita_usd")]),
    Defeito("T06", "calculo", "fórmula comprida demais", ("CHK-CALC-04", "EXPRESSAO_LONGA", R), [(FM + "[1].expressao", "pessoas" + " + pessoas" * 40)]),
    Defeito("T07", "calculo", "acesso a atributo", ("CHK-CALC-04", "CARACTERE_NAO_PERMITIDO", R), [(FM + "[1].expressao", "pessoas.real")]),
    Defeito("T08", "calculo", "divisão por zero", ("CHK-CALC-04", "DIVISAO_POR_ZERO", R), [(FM + "[1].expressao", "pessoas / 0")]),
    Defeito("T09", "calculo", "fórmula usa resultado de fórmula que vem depois", ("CHK-CALC-04", "NOME_DESCONHECIDO", R), [(FM + "[0].expressao", "receita_brl / cambio")]),
    Defeito("T10", "calculo", "dois comandos separados por ponto e vírgula", ("CHK-CALC-04", "CARACTERE_NAO_PERMITIDO", R), [(FM + "[1].expressao", "pessoas; 1")]),
    Defeito("T11", "calculo", "lambda", ("CHK-CALC-04", None, R), [(FM + "[1].expressao", "(lambda: 1)()")]),
    Defeito("T12", "calculo", "número gigante", ("CHK-CALC-04", "GRANDE_DEMAIS", R),
            [(FM + "[1].expressao", "10000000000000000000000000000 * 10000000000000000000000000000")]),
    Defeito("T13", "calculo", "expoente grande", ("CHK-CALC-04", "EXPOENTE_INVALIDO", R), [(FM + "[1].expressao", "pessoas ^ 99")]),
    Defeito("T14", "calculo", "id de entrada com maiúscula e traço", ("CHK-CALC-04", "ID_INVALIDO", R), [(E + "[1].id", "Horas-Pessoa")]),
    Defeito("T15", "calculo", "entrada que não é objeto", ("CHK-CALC-04", "MODELO_MALFORMADO", R), [(E + "[1]", "horas: 20")]),
    Defeito("T16", "calculo", "fórmula com colchetes", ("CHK-CALC-04", "CARACTERE_NAO_PERMITIDO", R), [(FM + "[1].expressao", "[pessoas][0]")]),
    Defeito("T17", "calculo", "fórmula vazia", ("CHK-CALC-04", "EXPRESSAO_VAZIA", R), [(FM + "[1].expressao", "  ")]),
    # ---- o modelo de cálculo no formato errado é pego pela checagem de seções
    Defeito("T18", "calculo", "modelo de cálculo que não tem lista de fórmulas", ("CHK-COMUM-01", "FORMATO_DA_SECAO", R), [(M_ + "formulas", "pessoas * 2")]),
    Defeito("T19", "calculo", "seção do modelo de cálculo ausente", ("CHK-COMUM-01", "SECAO_AUSENTE", R), [("r.entrega.modelo_de_calculo", DEL)]),
]
