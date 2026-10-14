"""Banco de teste com a forma do projeto canônico e TODAS as migrations em ordem (0001 até a última).

Para quem escreve teste de migration nova: `with banco_integral(servidor) as banco:` entrega um banco descartável com
auth, extensions/pgcrypto, public.app_access e as tabelas públicas que a v2 lê, e com todas as migrations aplicadas.
Migration nova entra sozinha (a lista vem da pasta). Nunca toca em banco remoto.
"""
import secrets
from contextlib import contextmanager

import psycopg
from psycopg import sql

import conftest as C


@contextmanager
def banco_integral(servidor, ate=None):
    url = C.exigir_banco_local(servidor)
    nome = "helena_v2_integral_" + secrets.token_hex(5)
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute("select pg_advisory_lock(84219075)")
        try:
            papeis = C.criar_papeis(admin, C.PAPEIS_DO_SUPABASE + list(C.PAPEIS_DE_TESTE))
            admin.execute(sql.SQL("create database {}").format(sql.Identifier(nome)))
        finally:
            admin.execute("select pg_advisory_unlock(84219075)")
    banco = C.Banco(url, nome, papeis)
    try:
        with banco.conectar() as con:
            con.execute("create schema auth")
            con.execute("""create function auth.uid() returns uuid language sql stable as $$
                select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$""")
            con.execute("""create table public.app_access (
                user_id uuid primary key, role text not null, active boolean not null,
                created_at timestamptz default now(), updated_at timestamptz default now())""")
            con.execute("insert into public.app_access(user_id,role,active) values (%s,'founder',true),(%s,'member',true)",
                        (C.FUNDADOR_TESTE, C.OUTRA_PESSOA_TESTE))
            con.execute("create schema extensions")
            con.execute("create extension pgcrypto with schema extensions")
            con.execute("""create table public.checkpoint_mestre (
                checkpoint_id text primary key, versao integer, status text, resumo_executivo text,
                validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
            con.execute("""create view public.checkpoint_mestre_atual as
                select checkpoint_id,versao,status,resumo_executivo,validado_em,
                       atualizado_em,checkpoint_anterior_id from public.checkpoint_mestre
                where status='ATIVO' order by versao desc limit 1""")
            con.execute("""create table public.portfolio (
                business_id text primary key, negocio text, estagio text, ativo text, publico text,
                row_version bigint, brand_identity jsonb)""")
            con.execute("""create table public.tarefas (
                task_id text primary key, business_id text, tarefa text, status text, prioridade text,
                prazo text, definicao_de_pronto text, row_version bigint, criado_em timestamptz,
                atualizado_em timestamptz)""")
            con.execute("""create table public.decisoes (
                decision_id text primary key, decisao text, row_version bigint, status text,
                business_id text)""")
            con.execute("""create table public.agent_jobs (
                job_id text primary key, task_id text, business_id text, agent_id text, status text,
                approval_status text, result_payload jsonb, result_summary text,
                evidence_refs jsonb, updated_at timestamptz)""")
            arquivos = sorted(C.MIGRACOES.glob("[0-9][0-9][0-9][0-9]_*.sql"))
            for arquivo in arquivos:
                if ate is not None and int(arquivo.name[:4]) > ate:
                    break
                con.execute(arquivo.read_text(encoding="utf-8"))
        yield banco
    finally:
        C.derrubar_banco(banco)
