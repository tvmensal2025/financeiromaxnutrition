"""Respostas HONESTAS: têm de passar. Variam aspas, espaços, acentos, caixa, endereços e outros detalhes
que uma citação ou um texto honesto pode ter. `marcas` lista as marcas que SÃO esperadas (e só elas)."""
import unicodedata

from .. import fabrica as F
from ..banco import Honesta

C0 = "r.entrega.fatos_com_fonte[0].citacoes[0].trecho_original"
LAC = "r.entrega.lacunas+"
OFICIAL = ("r.entrega.fatos_com_fonte[0].texto", "Segundo a fonte oficial, o participante precisa ter pelo menos 18 anos de idade.")
AJ = "r.entrega.ajustes_necessarios+"
FUN = "r.entrega.fundamento_citado"
M_ = "r.entrega.modelo_de_calculo."
E = M_ + "entradas"
FM = M_ + "formulas"
CONVITE = "r.entrega.texto_do_convite"
OUTRA = {"acao": "PERGUNTAR", "pergunta": "Qual das opções você prefere usar neste caso?",
         "opcoes": [{"letra": "A", "texto": "Opção A", "consequencia": "Segue pela A"}, {"letra": "B", "texto": "Opção B", "consequencia": "Segue pela B"}]}
LEI3 = ("CHK-LEI-03",)


def aus(**m):
    d = {"leitura_id": "LEI-001", "termos_buscados": ["comissão", "indicação"], "partes_lidas": [1, 2]}
    d.update(m)
    return {"texto": "A página não fala de comissão por indicação de novos participantes.", "ausencia": d}


CONFERIDA = F.tabela_com_lgpd_conferida()
SEGUNDA_FRASE = F.TEXTO_DE_TESTE_DA_LGPD.split(". ", 1)[1]

HONESTAS = [
    # ---- os casos-base
    Honesta("OK01", "dossie", "dossiê honesto sem nenhuma mudança"),
    Honesta("OK02", "convite", "convite honesto"),
    Honesta("OK03", "calculo", "cálculo honesto"),
    Honesta("OK04", "parecer", "parecer honesto (a LGPD ainda não tem texto conferido: só a marca)", marcas=LEI3),
    # ---- variações de aspas, espaços, acentos e caixa na citação
    Honesta("OK05", "dossie", "aspas curvas em volta da citação", [(C0, "“" + F.F_IDADE + "”")]),
    Honesta("OK06", "dossie", "aspas retas em volta da citação", [(C0, '"' + F.F_IDADE + '"')]),
    Honesta("OK07", "dossie", "aspas francesas em volta da citação", [(C0, "«" + F.F_IDADE + "»")]),
    Honesta("OK08", "dossie", "espaços duplos e tabulação dentro da citação", [(C0, F.F_IDADE.replace("anos de", "anos   de").replace("aceitar estes", "aceitar\testes"))]),
    Honesta("OK09", "dossie", "quebra de linha no meio da citação", [(C0, F.F_IDADE.replace(" e aceitar", "\ne aceitar"))]),
    Honesta("OK10", "dossie", "acentos decompostos (NFD)", [(C0, unicodedata.normalize("NFD", F.F_IDADE))]),
    Honesta("OK11", "dossie", "citação sem o ponto final", [(C0, F.F_IDADE.rstrip("."))]),
    Honesta("OK12", "dossie", "citação toda em minúsculas", [(C0, F.F_IDADE.lower())]),
    Honesta("OK13", "dossie", "citação com espaços não separáveis (NBSP)", [(C0, F.F_IDADE.replace(" ", " "))]),
    Honesta("OK14", "dossie", "citação toda em maiúsculas", [(C0, F.F_IDADE.upper())]),
    Honesta("OK15", "dossie", "travessão trocado por hífen e por travessão longo", [
        ("r.entrega.fatos_com_fonte+", {"texto": "A conta é pessoal e não pode ser compartilhada com ninguém, nem com familiares próximos.",
                                        "citacoes": [F.cit(F.F_PESSOAL.replace("–", "-"), parte=2)]}),
        ("r.entrega.fatos_com_fonte+", {"texto": "A conta é pessoal e não pode ser compartilhada com ninguém, nem com familiares próximos.",
                                        "citacoes": [F.cit(F.F_PESSOAL.replace("–", "—"), parte=2)]})]),
    Honesta("OK16", "dossie", "frase inteira com menos de 12 palavras", [
        ("r.entrega.fatos_com_fonte+", {"texto": "O suporte responde em até cinco dias úteis.",
                                        "citacoes": [F.cit("O prazo de resposta do suporte é de cinco dias úteis.", parte=2)]})]),
    Honesta("OK17", "dossie", "frase inteira curta que contém a abreviação 'Art.'", [
        ("r.entrega.fatos_com_fonte+", {"texto": "Os termos remetem ao artigo 5 para detalhes.",
                                        "citacoes": [F.cit("Veja também o Art. 5 destes termos.", parte=2)]})]),
    Honesta("OK18", "dossie", "trecho com exatamente 12 palavras no meio da frase", [(C0, "menos 18 anos de idade e aceitar estes termos antes de enviar")]),
    Honesta("OK19", "dossie", "pontuação sobrando nas pontas da citação", [(C0, ", " + F.F_IDADE.rstrip(".") + " ;")]),
    Honesta("OK20", "dossie", "citação em inglês com tradução em campo à parte", [
        ("r.entrega.fatos_com_fonte[0].citacoes[0]", {"trecho_original": "Users must be at least 18 years old and must accept these terms before they upload any video to the platform.",
              "leitura_id": "LEI-002", "parte": 1,
              "traducao": "Os usuários devem ter pelo menos 18 anos e aceitar estes termos antes de enviar qualquer vídeo para a plataforma."})]),
    Honesta("OK21", "dossie", "citação de fonte importada que veio no pacote", [
        ("c.fontes_importadas+", {"fonte_importada_id": "FON-001", "url": "https://www.plataformaexemplo.com.br/fontes/regras",
                                  "texto": "Regras de convivência da comunidade\nO participante precisa respeitar os outros participantes e nunca deve publicar conteúdo ofensivo na comunidade."}),
        ("r.entrega.fatos_com_fonte+", {"texto": "O participante deve respeitar os outros e não publicar conteúdo ofensivo.",
                                        "citacoes": [{"fonte_importada_id": "FON-001", "trecho_original": "O participante precisa respeitar os outros participantes e nunca deve publicar conteúdo ofensivo na comunidade."}]})]),
    Honesta("OK22", "dossie", "'fonte oficial' do mesmo site", [OFICIAL]),
    Honesta("OK23", "dossie", "'fonte oficial': host em maiúsculas, porta 443, barra final e www", [OFICIAL, ("c.paginas_lidas[0].url", "https://WWW.PlataformaExemplo.com.br:443/termos/")]),
    Honesta("OK24", "dossie", "'fonte oficial': link do pedido sem www e página com ponto final no host", [
        OFICIAL, ("c.links_do_pedido", ["https://plataformaexemplo.com.br/termos"]), ("c.paginas_lidas[0].url", "http://www.plataformaexemplo.com.br./termos")]),
    Honesta("OK25", "dossie", "ausência comprovada (termos buscados, todas as partes lidas)", [(LAC, aus())]),
    Honesta("OK26", "dossie", "ausência comprovada com termos em maiúsculas e plural", [(LAC, aus(termos_buscados=["COMISSÕES", "Indicações"]))]),
    # ---- frases que lembram defeitos, mas são honestas
    Honesta("OK27", "dossie", "negação: 'não enviei nada'", [(LAC, "Não enviei nada ao suporte, porque enviar mensagens é uma ação que só o fundador faz.")]),
    Honesta("OK28", "dossie", "infinitivo e terceira pessoa", [(LAC, "O fundador precisa enviar a pergunta ao suporte, e a equipe da plataforma costuma responder em poucos dias.")]),
    Honesta("OK29", "convite", "palavras que lembram termos de ganho mas não são", [
        (CONVITE, "Responda com o seu endereço completo, sem complemento. A conversa é extraoficial e o tempo real de resposta é curto. "
                  "A experiência dura cerca de uma semana. Dúvidas: contato@eliving.com.br.")]),
    Honesta("OK30", "dossie", "link igual ao da página lida (www, maiúsculas, barra final)", [
        (LAC, "Os termos completos estão em HTTPS://WWW.PlataformaExemplo.com.br/termos/ para consulta de todos os participantes.")]),
    Honesta("OK31", "dossie", "marca escrita certo, 'e living' do português e e-mail", [
        (LAC, "A marca eLiving™ ainda não tem pacote de voz; a cozinha e living integrados não entram. Fale com contato@eliving.com.br.")]),
    Honesta("OK32", "dossie", "'Diário Oficial' não é 'fonte oficial'", [(LAC, "A publicação no Diário Oficial não é necessária para esta análise.")]),
    Honesta("OK33", "dossie", "markdown simples, símbolos < e >, e 'Data:'", [
        (LAC, "**Atenção:** 3 < 5 e 7 > 2, então a lista - inclusive o item de teste - segue válida. Data: 10/10/2026, ainda sem confirmação do suporte.")]),
    Honesta("OK34", "dossie", "lista de nomes próprios sem palavras de ligação", [(LAC, "Instagram; WhatsApp; TikTok; YouTube; Telegram; Facebook; LinkedIn; Kwai; Discord; Twitter")]),
    Honesta("OK35", "dossie", "reticências no texto do agente (não na citação)", [(LAC, "Os termos podem mudar... e a leitura precisa ser refeita antes de qualquer ação.")]),
    Honesta("OK36", "dossie", "citação com aspas internas no original", [
        ("r.entrega.fatos_com_fonte+", {"texto": "A plataforma chama de conta ativa a que enviou vídeos nos últimos trinta dias.",
                                        "citacoes": [F.cit("A plataforma chama de “conta ativa” a conta que enviou vídeos nos últimos trinta dias, conforme o painel do participante.", parte=2)]})]),
    Honesta("OK37", "dossie", "espaços e quebras em volta do JSON", [("r~prefixo", "\n\n   "), ("r~sufixo", "  \n")]),
    # ---- cálculo honesto em várias formas
    Honesta("OK38", "calculo", "números com vírgula decimal", [(E + "[2].valor", "0,50"), (FM + "[0].resultado", "100,00"), (FM + "[1].resultado", "540,00")]),
    Honesta("OK39", "calculo", "números como números JSON (não texto)", [(E + "[2].valor", 0.5), (E + "[3].valor", 5.4), (FM + "[0].resultado", 100.0), (FM + "[1].resultado", 540.0)]),
    Honesta("OK40", "calculo", "divisão que não fecha, resultado arredondado em 2 casas (100/3 = 33.33)", [
        (E + "+", {"id": "parcelas", "valor": "3", "unidade": "parcelas", "origem": "PREMISSA", "ref": "hipótese do Caio"}),
        (FM + "+", {"id": "por_parcela", "expressao": "receita_usd / parcelas", "resultado": "33.33", "unidade": "US$"})]),
    Honesta("OK56", "calculo", "função arredondar() com a divisão", [
        (E + "+", {"id": "parcelas", "valor": "3", "unidade": "parcelas", "origem": "PREMISSA", "ref": "hipótese do Caio"}),
        (FM + "+", {"id": "por_parcela", "expressao": "arredondar(receita_usd / parcelas, 2)", "resultado": "33.33", "unidade": "US$"})]),
    Honesta("OK41", "calculo", "min, max, abs e potência", [
        (FM + "+", {"id": "funcoes", "expressao": "max(pessoas, 1) + min(horas_por_pessoa, 100) + abs(0 - 1) + 2 ^ 12", "resultado": "4127", "unidade": "pontos"})]),
    Honesta("OK42", "calculo", "número da seção igual ao resultado da fórmula", [
        ("c.modelo.secoes+", {"id": "numeros_chave", "titulo": "Números-chave", "tipo_de_campo": "numero", "obrigatoria": True}),
        ("r.entrega.numeros_chave", {"valor": "540", "unidade": "R$", "origem": "CALCULADO", "ref": "receita_brl"})]),
    Honesta("OK43", "calculo", "entrada vinda de entrega aprovada", [(E + "[1].origem", "ENTREGA_APROVADA"), (E + "[1].ref", "ENT-1"), ("c.entregas_aprovadas", ["ENT-1"])]),
    Honesta("OK44", "calculo", "câmbio dado pelo fundador", [
        ("c.decisoes_vigentes+", {"id": "DEC-103", "texto": "Câmbio combinado para as contas.", "valor": "5.40"}),
        (E + "[3]", {"id": "cambio", "valor": "5.40", "unidade": "R$/US$", "origem": "DADO_DO_FUNDADOR", "ref": "DEC-103"})]),
    Honesta("OK45", "calculo", "premissas aparecem no relatório e não bloqueiam", [(E + "[1].valor", "22"), (FM + "[0].resultado", "110.00"), (FM + "[1].resultado", "594.00"),
                                                                                   ("r.entrega.conta_por_extenso", "Dez pessoas, vinte e duas horas cada e US$ 0.50 por hora dão US$ 110.00. Ao câmbio de 5.40, são R$ 594.00.")]),
    # ---- parecer jurídico
    Honesta("OK46", "parecer", "lei da tabela já conferida e trecho que existe no texto oficial", [
        ("c.tabela_de_leis", CONFERIDA),
        (FUN + "[3].citacoes[0].trecho_original", SEGUNDA_FRASE),
        (AJ, "O art. 7º da LGPD diz “O tratamento de dados no ambiente de teste exige uma base legal inventada”, segundo a tabela.")]),
    Honesta("OK47", "parecer", "art. 19 do Marco Civil com nota de jurisprudência", [
        (AJ, "O art. 19 do Marco Civil trata da responsabilidade por conteúdo, conforme o trecho “trecho do artigo copiado da tabela de leis” e a jurisprudência do STF sobre o tema.")],
        marcas=LEI3),
    Honesta("OK48", "parecer", "temas respondidos com outras palavras (foto, áudio, biometria, exterior, criança, CLT, propaganda)", [
        (FUN + "[0].texto", "Foto e áudio: a plataforma usa as fotos e o áudio dos vídeos para treinar modelos de inteligência artificial."),
        (FUN + "[1].texto", "Crianças e adolescentes não podem participar sem a autorização por escrito dos responsáveis legais."),
        (FUN + "[2].texto", "Os pagamentos e os vídeos podem ir para o exterior, o que exige cuidado com a base legal do envio."),
        (FUN + "[3].texto", "A biometria da voz e do rosto pode identificar a pessoa, então o tratamento pede cuidado redobrado."),
        ("r.entrega.ajustes_necessarios[0]", "O roteiro não pode criar subordinação entre a plataforma e o participante, sob pena de relação de emprego pela CLT."),
        ("r.entrega.ajustes_necessarios[1]", "A propaganda do convite precisa dizer com clareza quem é a plataforma e que a participação é voluntária.")], marcas=LEI3),
    Honesta("OK49", "parecer", "temas configurados pelo modelo (consentimento) e respondidos", [
        ("c.modelo.temas_obrigatorios", [{"id": "TEMA-X-CONSENTIMENTO", "tema": "consentimento por escrito", "termos": ["consentimento por escrito"]}]),
        (AJ, "Cada participante deve dar consentimento por escrito antes de gravar o primeiro vídeo do teste.")], marcas=LEI3),
    # ---- outras ações e marcas
    Honesta("OK50", "dossie", "autoavaliação da IA: só marca, não recusa", [("r.autoavaliacao", "Revisei a estrutura, mas posso ter deixado algum detalhe passar.")], marcas=("CHK-COMUM-08",)),
    Honesta("OK51", "dossie", "PERGUNTAR honesta quando o serviço permite e a internet não foi usada", [("r", OUTRA), ("c.modelo.acoes_permitidas+", "PERGUNTAR"), ("c.usou_internet", "NAO")]),
    Honesta("OK52", "dossie", "REGISTRAR_FALHA honesta depois de ler a internet", [
        ("r", {"acao": "REGISTRAR_FALHA", "motivo_falha": "FONTE_INSUFICIENTE", "explicacao": "A página de termos não traz o valor pago por tarefa, então não dá para montar o dossiê."})]),
    Honesta("OK53", "dossie", "DEVOLVER_A_QUEM_PEDIU honesta sem ter usado a internet", [
        ("r", {"acao": "DEVOLVER_A_QUEM_PEDIU", "motivo": "PEDIDO_AMBIGUO", "explicacao": "O pedido não diz qual plataforma deve ser lida."}),
        ("c.modelo.acoes_permitidas+", "DEVOLVER_A_QUEM_PEDIU"), ("c.usou_internet", "NAO")]),
    Honesta("OK54", "convite", "convite mais longo, variado e sem termo de ganho", [
        (CONVITE, "Você está sendo convidado(a) para uma conversa de vinte minutos. Vamos explicar como funciona, tirar as suas dúvidas e você decide se quer continuar. "
                  "Sem pressão e sem compromisso. Se não fizer sentido para você, está tudo bem.\nA gravação é voluntária e você escolhe o que mostrar.")]),
    Honesta("OK55", "convite", "convite sem ação externa proposta", [("r.acao_externa", {"tipo": "NENHUMA"})]),
    Honesta("OK59", "dossie", "frase inteira com negação e ressalva citada do começo ao fim", [
        ("r.entrega.fatos_com_fonte+", {"texto": "A plataforma não permite vender a conta nem ceder o acesso a terceiros, salvo autorização expressa dela.",
                                        "citacoes": [F.cit("A plataforma não permite a venda da conta nem a cessão do acesso a terceiros, exceto com autorização expressa da própria plataforma.", parte=2)]})]),
    Honesta("OK60", "dossie", "trecho que começa no 'não' e vai até o fim da frase", [
        ("r.entrega.fatos_com_fonte+", {"texto": "A plataforma não permite vender a conta nem ceder o acesso a terceiros, salvo autorização.",
                                        "citacoes": [F.cit("não permite a venda da conta nem a cessão do acesso a terceiros, exceto com autorização expressa da própria plataforma.", parte=2)]})]),
    Honesta("OK57", "parecer", "REGISTRAR_FALHA quando não deu para ler os termos (nenhuma página lida)", [
        ("r", {"acao": "REGISTRAR_FALHA", "motivo_falha": "FONTE_INSUFICIENTE", "explicacao": "Não consegui abrir os termos de uso da plataforma, então não há base para o parecer."}),
        ("c.paginas_lidas", []), ("c.usou_internet", "NAO")]),
    Honesta("OK58", "convite", "pergunta ao fundador pode falar de renda (a regra vale só para o texto do convite)", [
        ("r", {"acao": "PERGUNTAR", "pergunta": "O convite deve evitar qualquer menção a renda ou pode citar o programa de indicação?",
               "opcoes": [{"letra": "A", "texto": "Evitar", "consequencia": "O convite fica neutro"}, {"letra": "B", "texto": "Citar", "consequencia": "Exige parecer jurídico"}]}),
        ("c.modelo.acoes_permitidas+", "PERGUNTAR"), ("c.usou_internet", "NAO")]),
]
