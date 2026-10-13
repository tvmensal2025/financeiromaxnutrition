"""Segredo de script vem só do ambiente (terminal), nunca com valor no código.

Equivalente em Python de scripts/require-env.mjs: lê os.environ; se a variável não existir, estiver vazia
ou tiver só espaços, o script para com uma mensagem que mostra apenas o NOME da variável (nunca o valor)
e sai com código diferente de zero. Defina a variável no terminal antes de rodar o script.
"""
import os


def require_env(name):
    value = str(os.environ.get(name) or '').strip()
    if not value:
        raise SystemExit(
            f'Defina a variável de ambiente {name} antes de rodar este script (nenhum segredo fica no código).'
        )
    return value
