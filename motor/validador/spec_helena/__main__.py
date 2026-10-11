"""O que é: o comando `python -m spec_helena`, que mostra o quadro de cobertura. De onde vem: cobertura.py (as opções estão lá). Como mudar: mude só o cobertura.py."""
import sys

from .cobertura import principal

sys.exit(principal())
