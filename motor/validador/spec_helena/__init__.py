"""Adaptador entre a especificação da Helena v2 (helena-v2/) e o validador (validador/).

O que é: lê os arquivos YAML da especificação e entrega ao validador o `modelo`, o `contexto` e a `resposta` de cada caso.
Também monta o quadro de cobertura (quais checagens da especificação o código já tem).
Por que fica FORA de validador/: o validador de produção usa só a biblioteca padrão do Python; este pacote usa PyYAML e só
é importado pelos testes (tests/test_casos_da_spec.py, tests/test_cobertura.py) e pelo comando `python -m spec_helena`.
Como mudar: veja o comentário no começo de cada arquivo (leitura.py, modelo.py, caso.py, cobertura.py).
"""
from .caso import Caso, ErroDoAdaptador, listar_casos, montar_contexto, montar_entrada, montar_resposta
from .leitura import Spec
from .modelo import montar_modelo

__all__ = ["Spec", "Caso", "ErroDoAdaptador", "listar_casos", "montar_contexto", "montar_entrada", "montar_resposta", "montar_modelo"]
