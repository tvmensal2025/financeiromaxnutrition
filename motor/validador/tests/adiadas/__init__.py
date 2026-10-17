"""As CHK da especificação que ainda não existem no código, um arquivo por tipo (assim, quem implementa um tipo mexe só no seu).

Como mudar: ao implementar uma CHK, apague o id dela do arquivo do tipo. Este arquivo só junta as listas.
"""
from . import tipo_copy, tipo_treino, tipo_calculo, tipo_parecer, tipo_relatorio, tipo_dossie, tipo_engenharia, outros_cards

ADIADAS = frozenset().union(tipo_copy.IDS, tipo_treino.IDS, tipo_calculo.IDS, tipo_parecer.IDS, tipo_relatorio.IDS, tipo_dossie.IDS, tipo_engenharia.IDS, outros_cards.IDS)
