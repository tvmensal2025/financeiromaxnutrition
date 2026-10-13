"""Comando local explícito para conferir revisões solicitadas pelo fundador."""
import argparse
import json
import os

from .motor import Motor


def main(argv=None):
    parser = argparse.ArgumentParser(prog='python -m orquestrador')
    parser.add_argument('comando', choices=['validar-configuracoes', 'registrar-base-tecnica'])
    args = parser.parse_args(argv)
    if args.comando in ('validar-configuracoes', 'registrar-base-tecnica'):
        url_banco = os.environ.get('HELENA_V2_CONFIG_DATABASE_URL')
        url_dbos = os.environ.get('HELENA_V2_DBOS_SYSTEM_DATABASE_URL')
        if not url_banco or not url_dbos:
            parser.error('defina HELENA_V2_CONFIG_DATABASE_URL e HELENA_V2_DBOS_SYSTEM_DATABASE_URL para bancos locais separados')
        motor = Motor(url_banco, url_dbos, permitir_executor_falso=True, iniciar_dbos=False,
                      permitir_configuracao_tecnica=args.comando == 'registrar-base-tecnica')
        try:
            if args.comando == 'registrar-base-tecnica':
                revisao = motor._configuracao_tecnica()
                print(json.dumps({'id': revisao['id'], 'estado': revisao['estado']}, ensure_ascii=False))
                return 0
            resultados = motor.processar_configuracoes_pendentes()
        finally:
            motor.fechar()
        print(json.dumps({'processadas': len(resultados), 'resultados': [
            {'id': r.get('id'), 'estado': r.get('estado'), 'ignorada': r.get('ignorada')}
            for r in resultados]}, ensure_ascii=False))
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
