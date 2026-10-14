"""Um motor em PROCESSO PRÓPRIO, para o teste de queda de verdade (kill -9). Só para teste local.

Uso: python motor_em_processo.py <url_banco> <url_dbos> <card_id> <atraso_do_agente_s>
Conduz o card passo a passo até PRONTO com o executor falso (cada chamada ao agente demora `atraso` segundos,
para o kill cair no meio dela). Espera, sem fazer nada, os toques do fundador: quem os faz é o teste.
Imprime PRONTO_PARA_TRABALHAR quando o motor está de pé e CARD_PRONTO ao terminar.
"""
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RAIZ / 'motor' / 'orquestrador'))
from orquestrador.motor import Motor as MotorBase            # noqa: E402
from executor_helena.executor_falso import ExecutorFalso, Roteiro   # noqa: E402


class MotorDeTeste(MotorBase):
    def __init__(self, *args, **kwargs):
        for opcao in ('permitir_configuracao_tecnica', 'permitir_servico_rascunho', 'permitir_executor_falso',
                      'permitir_casos_sinteticos'):
            kwargs.setdefault(opcao, True)
        super().__init__(*args, **kwargs)


def principal(url_banco, url_dbos, card, atraso):
    referencia = {}
    executor = ExecutorFalso(lambda execucao: Roteiro(texto=referencia['motor']._texto_roteirizado(execucao),
                                                      atraso_s=float(atraso)))
    motor = MotorDeTeste(url_banco, url_dbos, executor=executor)
    referencia['motor'] = motor
    print('PRONTO_PARA_TRABALHAR', flush=True)
    try:
        while True:
            estado = motor._card(card)['estado']
            if estado == 'PRONTO':
                print('CARD_PRONTO', flush=True)
                return 0
            juridico = next((e for e in motor._etapas(card) if e['codigo'] == 'E4'), None)
            esperando_fundador = estado == 'ESPERANDO_CONFIRMACAO' or bool(juridico and juridico['estado'] == 'ESPERANDO_FUNDADOR')
            if esperando_fundador or not motor.avancar(card):
                time.sleep(0.3)
    finally:
        motor.fechar()


if __name__ == '__main__':
    sys.exit(principal(*sys.argv[1:5]))
