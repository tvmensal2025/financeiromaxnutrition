"""Verificação MANUAL (fora da suíte): o cliente oficial do MCP conversa com o nosso servidor?

Não entra nos testes nem no requirements.txt porque o SDK oficial é pesado. Como rodar:

    python3 -m venv /tmp/venv-mcp && /tmp/venv-mcp/bin/pip install mcp
    /tmp/venv-mcp/bin/python verificacao_manual/compat_mcp.py

Feita em 10/10/2026 com o SDK `mcp` 2.3.0: initialize, tools/list, tools/call, erro de
ferramenta e modo "entregue agora" funcionaram. O Hermes de verdade NÃO foi testado aqui.
"""

import asyncio
import pathlib
import sys
import tempfile

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

RAIZ = str(pathlib.Path(__file__).resolve().parent.parent)


async def principal():
    pasta = pathlib.Path(tempfile.mkdtemp()) / "exec"
    parametros = StdioServerParameters(
        command=sys.executable,   # o servidor só usa a biblioteca padrão
        args=["-m", "ferramentas_helena", "--execucao", "E-9-n1", "--diretorio", str(pasta),
              "--ferramentas", "ler_pagina,buscar", "--max-buscas", "2", "--max-partes", "3",
              "--max-total", "5", "--qualquer-endereco-publico"],
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": RAIZ},
        cwd=RAIZ,
    )
    async with stdio_client(parametros) as (leitura, escrita):
        async with ClientSession(leitura, escrita) as sessao:
            inicio = await sessao.initialize()
            print("initialize ->", inicio.server_info.name, inicio.server_info.version, inicio.protocol_version)
            ferramentas = await sessao.list_tools()
            print("tools/list ->", [t.name for t in ferramentas.tools])
            resposta = await sessao.call_tool("ler_pagina", {"url": "http://169.254.169.254/latest/meta-data/"})
            print("ler_pagina (metadata) -> erro:", resposta.is_error, "|", resposta.content[0].text)
            for i in range(3):
                resposta = await sessao.call_tool("buscar", {"consulta": f"x{i}"})
                print(f"buscar {i} -> erro: {resposta.is_error} | {resposta.content[0].text[:70]}")


asyncio.run(principal())
