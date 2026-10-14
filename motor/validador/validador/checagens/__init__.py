"""Todas as checagens do portão 1. Importar este pacote registra cada uma em registro.CHECAGENS.

Como as checagens são achadas: TODO arquivo .py desta pasta é importado sozinho, em ordem alfabética (menos os que
começam com "_"). Para criar checagens novas basta pôr um arquivo novo aqui (um por assunto ou um por tipo de entrega,
ex.: copy.py com as CHK-COPY-*) com funções `@checagem(...)`; não há lista para atualizar.
Um arquivo com erro de sintaxe derruba a importação inteira de propósito: melhor parar alto do que deixar de conferir.
"""
import importlib
import pkgutil


def descobrir(caminho, pacote) -> list:
    """Importa cada módulo da pasta `caminho` (pacote `pacote`) e devolve os nomes importados, em ordem alfabética."""
    nomes = sorted(m.name for m in pkgutil.iter_modules(caminho) if not m.name.startswith("_"))
    for nome in nomes:
        importlib.import_module(f"{pacote}.{nome}")
    return nomes


MODULOS = descobrir(__path__, __name__)
