"""Heurística de idioma: explicável, sem IA."""
import pytest

from validador.checagens import idioma as I

PORTUGUES = [
    "O participante deve ter pelo menos 18 anos e aceitar os termos de uso antes de gravar o primeiro vídeo na plataforma.",
    "Convidamos você para conhecer uma plataforma nova que ajuda pessoas a treinar a fala em público, sem compromisso.",
    "Recomendamos ajuste: a gravação de voz exige consentimento por escrito do participante, conforme a lei.",
    "Risco alto de que a página mude sem aviso; confirmar antes de agir.",
    "Receita total: R$ 540,00 em 3 cenários com 10 pessoas e 20 horas por semana de dedicação média.",
    "Esta página explica o cadastro de novos participantes e o envio dos vídeos gravados por eles.",
    "A página diz: Users must be at least 18 years old. Portanto o participante precisa ter 18 anos.",  # citação em inglês no meio
    "A plataforma paga à empresa US$ 0,50 por hora aprovada de cada pessoa indicada.",  # muitos números e dinheiro, poucas palavras de ligação
    "Instagram; WhatsApp; TikTok; YouTube; Telegram; Facebook; LinkedIn; Kwai; Discord; Twitter",  # só nomes próprios
]
OUTRAS = [
    "Users must be at least 18 years old and must agree to the terms of service before they can upload any content.",
    "The platform may suspend your account if you violate the rules, and you will not be paid for any pending work.",
    "Los usuarios deben tener al menos 18 años y aceptar los términos de uso antes de subir cualquier contenido a la plataforma.",
    "The platform pays the company US$ 0.50 per approved hour for each person who was referred by the company.",  # inglês com dinheiro
    "Pay US$ 10 to the company within 30 days of the invoice date, and the fee is not refundable after that.",
    "El participante debe enviar una grabación de su voz y no puede usar cuentas de otras personas en el sitio.",
]


@pytest.mark.parametrize("t", PORTUGUES)
def test_portugues_passa(t):
    assert I.esta_em_portugues(t) is True


@pytest.mark.parametrize("t", OUTRAS)
def test_ingles_e_espanhol_sao_recusados(t):
    assert I.esta_em_portugues(t) is False


def test_texto_curto_nao_e_julgado():
    assert I.esta_em_portugues("Texto curto aqui.") is None
    assert I.esta_em_portugues("") is None


def test_pontuacao_explica_a_decisao():
    p = I.pontuar(OUTRAS[0])
    assert p["en"] > 0.4 and p["pt"] == 0
    p = I.pontuar(PORTUGUES[0])
    assert p["pt"] > 0.25 and p["en"] == 0


def test_palavras_que_existem_em_duas_linguas_nao_contam():
    assert not ({"de", "que", "para", "por", "se"} & (I.PT | I.EN | I.ES))
