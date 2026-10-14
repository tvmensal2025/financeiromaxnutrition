"""Fábrica de casos de teste: monta respostas e contextos HONESTOS que passam em tudo.

Os defeitos plantados e as variações honestas (tests/casos/*.json) partem destes casos-base e mudam um
detalhe de cada vez. Todo texto de página aqui é FICTÍCIO (Plataforma Exemplo): serve só para testar.
"""
import copy

HOJE = "2026-10-10"
EXECUCAO = "EXE-0001"

# ---------------------------------------------------------------------------------------
# Páginas lidas (fictícias)
# ---------------------------------------------------------------------------------------
TERMOS_1 = """Termos de Uso da Plataforma Exemplo
1. Cadastro
O participante deve ter pelo menos 18 anos de idade e aceitar estes termos antes de enviar qualquer vídeo para a plataforma.
Cada pessoa pode manter somente uma conta ativa, e a conta não pode ser vendida nem transferida para outra pessoa.
2. Pagamentos
A plataforma pode alterar os valores pagos por tarefa a qualquer momento, mediante aviso prévio publicado nesta página.
Os pagamentos são feitos em dólares americanos por transferência internacional, e o participante arca com as tarifas do banco.
"""
TERMOS_2 = """3. Conteúdo
O participante autoriza a plataforma a usar a imagem e a voz presentes nos vídeos enviados, para fins de treinamento de modelos de inteligência artificial.
É proibido enviar vídeos de terceiros ou de menores de idade sem a autorização por escrito dos responsáveis legais.
4. Encerramento
A plataforma pode encerrar contas que violem estas regras, sem aviso prévio e sem direito a pagamento de tarefas pendentes.
Veja também o Art. 5 destes termos. O prazo de resposta do suporte é de cinco dias úteis.
A conta é pessoal – não pode ser compartilhada com ninguém, nem mesmo com familiares próximos.
A plataforma chama de "conta ativa" a conta que enviou vídeos nos últimos trinta dias, conforme o painel do participante.
Conforme o art. 7º, o participante pode pedir a exclusão dos dados.
A plataforma não permite a venda da conta nem a cessão do acesso a terceiros, exceto com autorização expressa da própria plataforma.
"""
TERMOS_EN = """Terms of Service
1. Accounts
Users must be at least 18 years old and must accept these terms before they upload any video to the platform.
Each person may keep only one active account, and an account may not be sold or transferred to another person.
"""
PAGAMENTOS = """Tabela de pagamentos da Plataforma Exemplo
O valor pago por hora de tarefa concluída é de US$ 0.50 (cinquenta centavos de dólar), conforme a tabela vigente nesta página.
O pagamento é feito somente depois da aprovação da tarefa pela equipe da plataforma.
"""
COTACAO = """Boletim do Banco Exemplo
Cotação do dólar comercial em 09/10/2026: R$ 5,40 para cada US$ 1,00, segundo o boletim diário publicado pelo banco.
"""
OUTRO_SITE = """Política de privacidade do Outro Site
Coletamos o endereço de e-mail do visitante para enviar novidades sobre os nossos produtos e serviços de treinamento.
"""

URL_TERMOS = "https://www.plataformaexemplo.com.br/termos"


def paginas_base():
    return [
        {"leitura_id": "LEI-001", "url": URL_TERMOS, "tipo": "termos_de_uso", "execucao": EXECUCAO,
         "partes_total": 2, "partes": {"1": TERMOS_1, "2": TERMOS_2}},
        {"leitura_id": "LEI-002", "url": "https://www.plataformaexemplo.com.br/en/terms", "tipo": "termos_de_uso",
         "execucao": EXECUCAO, "partes_total": 1, "partes": {"1": TERMOS_EN}},
        {"leitura_id": "LEI-003", "url": "https://www.outrosite.com.br/politica", "tipo": "pagina",
         "execucao": EXECUCAO, "partes_total": 1, "partes": {"1": OUTRO_SITE}},
        {"leitura_id": "LEI-004", "url": "https://www.plataformaexemplo.com.br/pagamentos", "tipo": "pagina",
         "execucao": EXECUCAO, "partes_total": 1, "partes": {"1": PAGAMENTOS}},
        {"leitura_id": "LEI-005", "url": "https://www.bancoexemplo.com.br/cotacao", "tipo": "pagina",
         "execucao": EXECUCAO, "partes_total": 1, "partes": {"1": COTACAO}},
    ]


def contexto_base(modelo):
    return {
        "hoje": HOJE,
        "execucao_id": EXECUCAO,
        "modelo": copy.deepcopy(modelo),
        "paginas_lidas": paginas_base(),
        "fontes_importadas": [],
        "links_do_pedido": [URL_TERMOS],
        "decisoes_vigentes": [
            {"id": "DEC-101", "texto": "Meta da primeira rodada: 10 pessoas.", "valor": "10", "unidade": "pessoas"},
            {"id": "DEC-102", "texto": "O texto do convite não promete nenhum tipo de retorno."},
        ],
        "usou_internet": "SIM",
    }


def cit(trecho, leitura="LEI-001", parte=1, **extra):
    d = {"trecho_original": trecho, "leitura_id": leitura, "parte": parte}
    d.update(extra)
    return d


F_IDADE = "O participante deve ter pelo menos 18 anos de idade e aceitar estes termos antes de enviar qualquer vídeo para a plataforma."
F_CONTA = "Cada pessoa pode manter somente uma conta ativa, e a conta não pode ser vendida nem transferida para outra pessoa."
F_IMAGEM = "O participante autoriza a plataforma a usar a imagem e a voz presentes nos vídeos enviados, para fins de treinamento de modelos de inteligência artificial."
F_MENORES = "É proibido enviar vídeos de terceiros ou de menores de idade sem a autorização por escrito dos responsáveis legais."
F_PAGAMENTO = "Os pagamentos são feitos em dólares americanos por transferência internacional, e o participante arca com as tarifas do banco."
F_PESSOAL = "A conta é pessoal – não pode ser compartilhada com ninguém, nem mesmo com familiares próximos."
F_ATIVA = 'A plataforma chama de "conta ativa" a conta que enviou vídeos nos últimos trinta dias, conforme o painel do participante.'
F_ENCERRAR = "A plataforma pode encerrar contas que violem estas regras, sem aviso prévio e sem direito a pagamento de tarefas pendentes."


# ---------------------------------------------------------------------------------------
# 1) Dossiê (fatos com fonte, ausência comprovada)
# ---------------------------------------------------------------------------------------
MODELO_DOSSIE = {
    "tipo": "dossie", "servico": "SRV-DOSSIE", "limite": 7000,
    "secoes": [
        {"id": "resumo_executivo", "titulo": "Resumo executivo", "tipo_de_campo": "texto", "obrigatoria": True, "limite_caracteres": 1200},
        {"id": "fatos_com_fonte", "titulo": "Fatos com fonte", "tipo_de_campo": "lista", "obrigatoria": True, "exige_citacao": True, "itens_min": 1, "itens_max": 20},
        {"id": "lacunas", "titulo": "Lacunas", "tipo_de_campo": "lista", "obrigatoria": True},
        {"id": "riscos", "titulo": "Riscos", "tipo_de_campo": "lista", "obrigatoria": True},
    ],
    "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
    "acao_externa_permitida": ["NENHUMA"],
    "validador": {"exige_fontes": True},
}


def dossie():
    resposta = {
        "acao": "ENTREGAR", "parecer": "OK", "acao_externa": {"tipo": "NENHUMA"},
        "entrega": {
            "resumo_executivo": "A Plataforma Exemplo exige idade mínima de 18 anos e conta única por pessoa. Os pagamentos são em dólares e a plataforma pode encerrar contas sem aviso.",
            "fatos_com_fonte": [
                {"texto": "O participante precisa ter pelo menos 18 anos de idade para enviar vídeos.",
                 "citacoes": [cit(F_IDADE)]},
                {"texto": "Cada pessoa só pode ter uma conta ativa, e a conta não pode ser vendida.",
                 "citacoes": [cit(F_CONTA)]},
                {"texto": "Os pagamentos saem em dólares por transferência internacional e o participante paga as tarifas do banco.",
                 "citacoes": [cit(F_PAGAMENTO)]},
                {"texto": "A plataforma pode encerrar contas sem aviso prévio e sem pagar tarefas pendentes.",
                 "citacoes": [cit(F_ENCERRAR, parte=2)]},
            ],
            "lacunas": ["Não encontramos o endereço de suporte para dúvidas de pagamento."],
            "riscos": ["Os termos podem mudar a qualquer momento, então a leitura precisa ser refeita antes de agir."],
        },
    }
    return resposta, contexto_base(MODELO_DOSSIE)


# ---------------------------------------------------------------------------------------
# 2) Convite (sem termo de ganho; sem páginas)
# ---------------------------------------------------------------------------------------
MODELO_CONVITE = {
    "tipo": "copy", "servico": "SRV-COPY", "limite": 4000,
    "secoes": [
        {"id": "texto_do_convite", "titulo": "Texto do convite", "tipo_de_campo": "texto", "obrigatoria": True, "limite_caracteres": 1500},
        {"id": "chamada_para_acao", "titulo": "Chamada para ação", "tipo_de_campo": "texto", "obrigatoria": True, "limite_caracteres": 300},
    ],
    "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
    "acao_externa_permitida": ["NENHUMA", "SO_FUNDADOR"],
    "acoes_do_fundador": ["AF-COPY-ENVIAR-OU-PUBLICAR"],
    "validador": {"proibir_termos_de_ganho": True},
}


def convite():
    resposta = {
        "acao": "ENTREGAR", "parecer": "OK", "acao_externa": {"tipo": "SO_FUNDADOR", "acao_do_fundador": "AF-COPY-ENVIAR-OU-PUBLICAR"},
        "entrega": {
            "texto_do_convite": (
                "Olá! Estamos formando um grupo pequeno de pessoas curiosas para testar uma plataforma nova de gravação de vídeos.\n"
                "A participação é voluntária, sem compromisso, e você pode sair quando quiser. Não prometemos resultado nenhum."
            ),
            "chamada_para_acao": "Se quiser conhecer, responda esta mensagem com a palavra QUERO e conversamos.",
        },
    }
    ctx = contexto_base(MODELO_CONVITE)
    ctx["paginas_lidas"], ctx["usou_internet"] = [], "NAO"
    return resposta, ctx


# ---------------------------------------------------------------------------------------
# 3) Cálculo do Caio
# ---------------------------------------------------------------------------------------
MODELO_CALCULO = {
    "tipo": "calculo", "servico": "SRV-CALCULO", "limite": 5000,
    "secoes": [
        {"id": "premissas_com_origem", "titulo": "Premissas", "tipo_de_campo": "lista", "obrigatoria": True},
        {"id": "modelo_de_calculo", "titulo": "Modelo de cálculo", "tipo_de_campo": "modelo_de_calculo", "obrigatoria": True},
        {"id": "conta_por_extenso", "titulo": "Conta por extenso", "tipo_de_campo": "texto", "obrigatoria": True},
        {"id": "riscos_dos_numeros", "titulo": "Riscos dos números", "tipo_de_campo": "lista", "obrigatoria": True},
    ],
    "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
    "acao_externa_permitida": ["NENHUMA"],
    "validador": {"exige_modelo_de_calculo": True, "numeros_do_texto_vem_do_modelo": True},
}


def calculo():
    resposta = {
        "acao": "ENTREGAR", "parecer": "OK", "acao_externa": {"tipo": "NENHUMA"},
        "entrega": {
            "premissas_com_origem": [
                "A meta de 10 pessoas é decisão do fundador.",
                "Vinte horas por pessoa é uma hipótese do Caio, ainda não confirmada.",
            ],
            "modelo_de_calculo": {
                "entradas": [
                    {"id": "pessoas", "valor": "10", "unidade": "pessoas", "origem": "DADO_DO_FUNDADOR", "ref": "DEC-101"},
                    {"id": "horas_por_pessoa", "valor": "20", "unidade": "horas", "origem": "PREMISSA", "ref": "hipótese do Caio"},
                    {"id": "usd_por_hora", "valor": "0.50", "unidade": "US$/hora", "origem": "FONTE_CITADA", "data_da_fonte": "2026-10-01",
                     "citacao": cit("O valor pago por hora de tarefa concluída é de US$ 0.50 (cinquenta centavos de dólar), conforme a tabela vigente nesta página.", "LEI-004")},
                    {"id": "cambio", "valor": "5.40", "unidade": "R$/US$", "origem": "FONTE_CITADA", "data_da_fonte": "2026-10-09",
                     "citacao": cit("Cotação do dólar comercial em 09/10/2026: R$ 5,40 para cada US$ 1,00, segundo o boletim diário publicado pelo banco.", "LEI-005")},
                ],
                "formulas": [
                    {"id": "receita_usd", "expressao": "pessoas * horas_por_pessoa * usd_por_hora", "resultado": "100.00", "unidade": "US$"},
                    {"id": "receita_brl", "expressao": "receita_usd * cambio", "resultado": "540.00", "unidade": "R$"},
                ],
            },
            "conta_por_extenso": "Dez pessoas, vinte horas cada e US$ 0.50 por hora dão US$ 100.00. Ao câmbio de 5.40, são R$ 540.00.",
            "riscos_dos_numeros": ["As horas por pessoa são hipótese e podem mudar muito o resultado."],
        },
    }
    return resposta, contexto_base(MODELO_CALCULO)


# ---------------------------------------------------------------------------------------
# 4) Parecer jurídico (temas obrigatórios, leis)
# ---------------------------------------------------------------------------------------
MODELO_PARECER = {
    "tipo": "parecer", "servico": "SRV-PARECER", "limite": 6000,
    "secoes": [
        {"id": "pergunta", "titulo": "Pergunta", "tipo_de_campo": "texto", "obrigatoria": True},
        {"id": "semaforo", "titulo": "Semáforo", "tipo_de_campo": "texto", "obrigatoria": True, "valores_permitidos": ["PODE", "AJUSTE", "NAO_PODE"]},
        {"id": "fundamento_citado", "titulo": "Fundamento citado", "tipo_de_campo": "lista", "obrigatoria": True, "exige_citacao": True},
        {"id": "ajustes_necessarios", "titulo": "Ajustes necessários", "tipo_de_campo": "lista", "obrigatoria": True},
        {"id": "quando_chamar_advogado", "titulo": "Quando chamar advogado", "tipo_de_campo": "texto", "obrigatoria": True},
    ],
    "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
    "acao_externa_permitida": ["NENHUMA"],
    "validador": {"confere_leis": True, "exige_fontes": True, "exigir_termos_lidos_por_inteiro": True,
                  "secoes_dos_temas": ["fundamento_citado", "ajustes_necessarios"]},
}

FON_LGPD = {"fonte_importada_id": "FON-LEI-LGPD", "trecho_original": "trecho do artigo copiado da tabela de leis para conferência"}


def parecer():
    resposta = {
        "acao": "ENTREGAR", "parecer": "AJUSTE", "acao_externa": {"tipo": "NENHUMA"},
        "entrega": {
            "pergunta": "O convite e o roteiro podem ser usados com a Plataforma Exemplo?",
            "semaforo": "AJUSTE",
            "fundamento_citado": [
                {"texto": "Imagem e voz: a plataforma usa a imagem e a voz dos vídeos para treinar modelos, e isso exige autorização clara do participante.",
                 "citacoes": [cit(F_IMAGEM, parte=2)]},
                {"texto": "Menores: vídeos de menores de idade só podem ser enviados com autorização por escrito dos responsáveis legais.",
                 "citacoes": [cit(F_MENORES, parte=2)]},
                {"texto": "Transferência para fora do país: os pagamentos saem por transferência internacional, o que exige cuidado com a base legal do envio de dados.",
                 "citacoes": [cit(F_PAGAMENTO)]},
                {"texto": "Dado sensível: voz e imagem podem identificar a pessoa e entrar na categoria de dados pessoais sensíveis, conforme a LGPD.",
                 "citacoes": [dict(FON_LGPD)]},
            ],
            "ajustes_necessarios": [
                "Vínculo de trabalho: o roteiro não pode impor horário, metas ou chefia, para não parecer subordinação nem criar vínculo de trabalho.",
                "Publicidade: o convite é publicidade e deve dizer com clareza quem é a plataforma e que a participação é voluntária.",
            ],
            "quando_chamar_advogado": "Chame um advogado antes de enviar qualquer convite ou de assinar qualquer termo.",
        },
    }
    return resposta, contexto_base(MODELO_PARECER)


BASES = {"dossie": dossie, "convite": convite, "calculo": calculo, "parecer": parecer}


# ---------------------------------------------------------------------------------------
# Tabela de leis FICTÍCIA com uma lei "conferida" (só para testar o caminho CONFERIDA)
# ---------------------------------------------------------------------------------------
TEXTO_DE_TESTE_DA_LGPD = ("Texto fictício usado somente nos testes do validador, que não é lei. "
                          "O tratamento de dados no ambiente de teste exige uma base legal inventada para provar a conferência do trecho.")


def tabela_com_lgpd_conferida():
    import json
    from pathlib import Path

    dados = json.loads((Path(__file__).resolve().parents[1] / "validador" / "dados" / "leis.json").read_text(encoding="utf-8"))
    for lei in dados["leis"]:
        if lei["id"] == "FON-LEI-LGPD":
            lei["status"], lei["data_da_conferencia"] = "CONFERIDA", "2026-10-01"
            lei["texto_oficial_a_conferir"] = TEXTO_DE_TESTE_DA_LGPD
    return dados
