"""Toda CHK de tipo (CHK-CALCULO-01, CHK-PARECER-..., CHK-COPY-...) tem a prova nos casos de helena-v2/casos.

O que é: a regra do fundador de 11/10/2026, "cada checagem nova precisa de um caso que passa e de um defeito plantado que
reprova", aplicada às checagens que a especificação define. O defeito diz em deve_falhar_em qual CHK deve pegá-lo; a boa
mostra a CHK rodando e passando. Quem implementa uma CHK de tipo e não deixa os dois casos nos casos da especificação faz
este teste falhar, com o nome da CHK. As checagens do banco antigo (CHK-ACAO, CHK-GANHO, CHK-LEI...) continuam provadas por
tests/casos/ (test_banco_de_casos.py e test_mutacoes.py).
Como mudar: para provar uma CHK nova, crie o defeito em helena-v2/casos/<SRV>/defeitos/ (uma boa copiada com UM defeito).
"""
from spec_helena import prova


def test_toda_chk_de_tipo_que_existe_no_codigo_tem_boa_que_passa_e_defeito_que_pega():
    registradas = prova.ids_dos_tipos_registrados()
    sem_prova = sorted(registradas - prova.ids_provados_pela_spec())
    assert not sem_prova, (
        f"Estas CHK existem no código mas não têm (uma boa em que passam E um defeito que as pega) nos casos da especificação: {sem_prova}. "
        "Crie o defeito em helena-v2/casos/<SRV>/defeitos/ com deve_falhar_em apontando para o id."
    )
