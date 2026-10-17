"""Sobe o DBOS como o motor de produção (run_migrations=False, esquema dbos_helena_v2 já pronto) e roda um fluxo mínimo.

Roda num processo à parte porque o DBOS é um singleton. A URL vem do ambiente (URL_DBOS); nada é impresso além do resultado.
"""
import os
import sys

from dbos import DBOS, DBOSConfig

app = DBOS(config=DBOSConfig(name='teste-producao', system_database_url=os.environ['URL_DBOS'],
                             dbos_system_schema='dbos_helena_v2', run_migrations=False, enable_otlp=False))


@DBOS.workflow()
def somar(a: int, b: int) -> int:
    return a + b


app.launch()
try:
    print('RESULTADO', somar(2, 3))
finally:
    app.destroy()
sys.exit(0)
