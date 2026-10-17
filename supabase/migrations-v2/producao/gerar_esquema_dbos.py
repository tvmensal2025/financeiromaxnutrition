#!/usr/bin/env python3
"""Gera 02_esquema_dbos.sql: o esquema que o DBOS cria em dbos_helena_v2, extraído de um Postgres local descartável.

Por que existe: o motor de produção roda o DBOS com run_migrations=False (bancos.py), então o esquema precisa estar
pronto e revisado ANTES. Em vez de escrever à mão, o próprio DBOS (a versão fixada em motor/orquestrador/requirements.txt)
cria as tabelas num cluster local, com as mesmas contas de 01_contas_do_motor.sql, e o resultado é extraído e limpo.
Se a versão do DBOS mudar, rode de novo e revise a diferença: o hash do arquivo muda.

Uso (a partir da raiz do repositório):
    PYTHONPATH=motor/orquestrador:motor/executor:motor/validador:motor/ferramentas \
        python3 supabase/migrations-v2/producao/gerar_esquema_dbos.py
"""
import hashlib
import importlib.util
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[2]
# Sem argumento grava em 02_esquema_dbos.sql; com um caminho, grava lá (o teste usa isso para conferir se o arquivo está em dia).
SAIDA = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "02_esquema_dbos.sql"
ESQUEMA = "dbos_helena_v2"


def _suporte():
    spec = importlib.util.spec_from_file_location("suporte_banco_v2", RAIZ / "supabase/migrations-v2/testes/conftest.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _limpar(dump: str) -> str:
    """Tira do pg_dump o que é do cliente psql ou da máquina que gerou; fica só o SQL do esquema."""
    saida = []
    for linha in dump.splitlines():
        if linha.startswith("\\"):                                   # \restrict e \unrestrict (comandos do psql)
            continue
        if linha.startswith("-- Dumped") or linha.startswith("-- PostgreSQL database dump"):
            continue
        if re.match(r"^(SET |SELECT pg_catalog\.set_config)", linha):  # ajustes de sessão do pg_dump
            continue
        if linha.strip() == f"CREATE SCHEMA {ESQUEMA};":             # o esquema nasce em 01_contas_do_motor.sql
            continue
        saida.append(linha)
    texto = "\n".join(saida)
    return re.sub(r"\n{3,}", "\n\n", texto).strip() + "\n"


def main() -> int:
    import psycopg
    from psycopg import sql
    from dbos import DBOS, DBOSConfig
    import importlib.metadata as md

    suporte = _suporte()
    versao_dbos = md.version("dbos")
    cluster = suporte.ClusterLocal()
    cluster.subir()
    try:
        senha = secrets.token_urlsafe(12)
        with psycopg.connect(cluster.url, autocommit=True) as adm:
            for papel in suporte.PAPEIS_DO_SUPABASE:
                adm.execute(sql.SQL("create role {} nologin").format(sql.Identifier(papel)))
            adm.execute("create database dbos_gen")
        base = cluster.url.rsplit("/", 1)[0]
        with psycopg.connect(base + "/dbos_gen", autocommit=True) as con:
            con.execute((AQUI / "01_contas_do_motor.sql").read_text(encoding="utf-8"))
            con.execute(sql.SQL("alter role dbos_motor password {}").format(sql.Literal(senha)))
        host_porta = cluster.url.split("@")[1].rsplit("/", 1)[0]
        url_dbos = f"postgresql+psycopg://dbos_motor:{senha}@{host_porta}/dbos_gen"

        app = DBOS(config=DBOSConfig(name="gerar-esquema-dbos", system_database_url=url_dbos,
                                     dbos_system_schema=ESQUEMA, enable_otlp=False))
        app.launch()
        app.destroy()

        env = dict(os.environ, PGPASSWORD=cluster.senha)
        comum = ["pg_dump", "-h", "127.0.0.1", "-p", str(cluster.porta), "-U", "postgres", "-d", "dbos_gen", "--no-owner", "--no-privileges"]
        estrutura = subprocess.run(comum + ["-n", ESQUEMA, "--schema-only"], env=env, capture_output=True, text=True, check=True).stdout
        dados = subprocess.run(comum + ["--data-only", "--inserts", "-t", f"{ESQUEMA}.dbos_migrations"], env=env, capture_output=True, text=True, check=True).stdout
        insercoes = [l for l in dados.splitlines() if l.startswith("INSERT INTO")]
        if len(insercoes) != 1:
            raise SystemExit(f"esperava 1 linha em dbos_migrations, achei {len(insercoes)}")
        with psycopg.connect(base + "/dbos_gen") as con:
            tabelas = [r[0] for r in con.execute("select table_name from information_schema.tables where table_schema=%s order by 1", (ESQUEMA,))]
            fora = [r[0] for r in con.execute(
                "select nspname from pg_namespace where nspname not like 'pg\\_%%' and nspname not in ('information_schema','public',%s)", (ESQUEMA,))]
        if fora:
            raise SystemExit(f"o DBOS criou esquemas fora de {ESQUEMA}: {fora}")

        cabecalho = f"""-- Esquema do DBOS {versao_dbos} em {ESQUEMA}, extraído de um Postgres local. GERADO por gerar_esquema_dbos.py: não edite à mão.
-- Tabelas ({len(tabelas)}): {', '.join(tabelas)}.
-- Rodar como o dono do banco, DEPOIS de 01_contas_do_motor.sql. Tudo é criado como dbos_motor (set local role).
-- Se o esquema já tiver tabelas, o arquivo PARA com erro: nunca sobrescreve nem mistura versões.

do $guarda$
begin
  if exists (select 1 from pg_tables where schemaname = '{ESQUEMA}') then
    raise exception 'ESQUEMA DBOS JA EXISTE em {ESQUEMA}: nada foi alterado';
  end if;
  if not exists (select 1 from pg_namespace n join pg_roles r on r.oid = n.nspowner
                 where n.nspname = '{ESQUEMA}' and r.rolname = 'dbos_motor') then
    raise exception 'rode antes 01_contas_do_motor.sql: {ESQUEMA} precisa existir e ser de dbos_motor';
  end if;
end
$guarda$;

set local role dbos_motor;

"""
        texto = cabecalho + _limpar(estrutura) + "\n" + insercoes[0] + "\n"
        SAIDA.write_text(texto, encoding="utf-8")
        print(f"{SAIDA}: {len(texto.encode('utf-8'))} bytes, DBOS {versao_dbos}, {len(tabelas)} tabelas")
        print("sha256:", hashlib.sha256(texto.encode("utf-8")).hexdigest())
        return 0
    finally:
        cluster.derrubar()


if __name__ == "__main__":
    sys.exit(main())
