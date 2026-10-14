"""As classes de falha e a regra de tentativa do executor batem com o vocabulário do motor (helena-v2/maquina/vocabulario.yaml)."""

from pathlib import Path

import yaml

from executor_helena.tipos import CLASSES_DE_FALHA, GASTA_TENTATIVA

VOCABULARIO = Path(__file__).resolve().parents[3] / "helena-v2" / "maquina" / "vocabulario.yaml"


def test_classes_e_gasto_de_tentativa_batem_com_o_vocabulario():
    """ALERTA: se a outra equipe renomear uma classe de falha, este teste avisa."""
    vocabulario = yaml.safe_load(VOCABULARIO.read_text(encoding="utf-8"))["classes_de_falha"]
    for classe in CLASSES_DE_FALHA:
        assert classe in vocabulario, f"{classe} não existe mais no vocabulário do motor"
        assert vocabulario[classe]["gasta_tentativa"] is GASTA_TENTATIVA[classe], classe


def test_tabela_de_nomes_do_pedido_para_o_vocabulario():
    """O pedido fala em: cota, login, provedor, queda, ferramenta ausente, tempo, limite_de_chamadas, entrega_grande, formato, desconhecida."""
    pedido = {"cota": "COTA", "login": "LOGIN", "provedor": "PROVEDOR", "queda": "QUEDA", "ferramenta ausente": "FERRAMENTA",
              "tempo": "TEMPO", "limite_de_chamadas": "LIMITE_CHAMADAS", "entrega_grande": "GRANDE_DEMAIS",
              "formato": "FORMATO_ERRADO", "desconhecida": "DESCONHECIDA"}
    assert set(pedido.values()) == set(CLASSES_DE_FALHA)
