"""Fabrica os registros que o Hermes 0.19.0 deixa (state.db no esquema real, uso.json, request_dump), para testar as leituras."""

import json
import sqlite3
import time
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

ESQUEMA = Path(__file__).resolve().parents[1] / "fixtures" / "esquema_do_state_db_do_hermes_0_19_0.sql"
NOME = "mcp__ferramentas_helena__buscar"


def chamada(nome: str = NOME, numero: int = 1) -> str:
    return json.dumps([{"id": f"call_{numero}", "type": "function", "function": {"name": nome, "arguments": "{}"}}])


def criar_state_db(hermes_home: Path, mensagens: Sequence[Tuple], *, modelo: str = "gpt-6-sol", chamadas_api: int = 1,
                   max_iteracoes: Optional[int] = 90, prompt: str = "sistema", id_sessao: str = "S1", iniciada_em: float = None) -> Path:
    """mensagens: (papel, conteudo, tool_calls_json|None, finish_reason|None)."""
    hermes_home = Path(hermes_home)
    hermes_home.mkdir(parents=True, exist_ok=True)
    caminho = hermes_home / "state.db"
    conexao = sqlite3.connect(caminho)
    conexao.executescript(ESQUEMA.read_text())
    configuracao = json.dumps({"max_iterations": max_iteracoes}) if max_iteracoes is not None else "{}"
    conexao.execute("INSERT INTO sessions (id, source, model, model_config, system_prompt, started_at, api_call_count, end_reason) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    (id_sessao, "cli", modelo, configuracao, prompt, iniciada_em or time.time(), chamadas_api, "agent_close"))
    for papel, conteudo, chamadas, fim in mensagens:
        conexao.execute("INSERT INTO messages (session_id, role, content, tool_calls, finish_reason, timestamp) VALUES (?,?,?,?,?,?)",
                        (id_sessao, papel, conteudo, chamadas, fim, time.time()))
    conexao.commit()
    conexao.close()
    return caminho


def gravar_uso(caminho: Path, **campos) -> Path:
    base = {"estimated_cost_usd": None, "cost_status": None, "cost_source": None, "input_tokens": 10, "output_tokens": 5,
            "cache_read_tokens": 0, "cache_write_tokens": 0, "reasoning_tokens": 0, "total_tokens": 15, "api_calls": 1,
            "model": "gpt-6-sol", "provider": "openai-codex", "session_id": "S1", "completed": True, "failed": False,
            "service_tier": None}
    base.update(campos)
    Path(caminho).write_text(json.dumps(base, indent=2))
    return Path(caminho)


def gravar_request_dump(hermes_home: Path, *, motivo: str = "max_retries_exhausted", status: Optional[int] = 429,
                        tipo: Optional[str] = "usage_limit_reached", codigo: Optional[str] = "rate_limit_exceeded",
                        corpo: Optional[dict] = None, nome: str = "request_dump_S1_20261010_120000_000001.json") -> Path:
    pasta = Path(hermes_home) / "sessions"
    pasta.mkdir(parents=True, exist_ok=True)
    erro = {"type": tipo, "message": "mensagem", "status_code": status, "code": codigo, "body": corpo or {},
            "response_status": status}
    caminho = pasta / nome
    caminho.write_text(json.dumps({"session_id": "S1", "reason": motivo,
                                   "request": {"body": {"messages": [{"role": "user", "content": "PACOTE_SECRETO_DO_PEDIDO"}]}},
                                   "error": erro}))
    return caminho
