"""`python -m spec_helena` mostra o quadro de cobertura (ver cobertura.py)."""
import sys

from .cobertura import principal

sys.exit(principal())
