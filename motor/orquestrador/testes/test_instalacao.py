"""Ensaio do roteiro de instalação da v2: os MESMOS arquivos gerados para revisão, aplicados num PostgreSQL local
com a forma do projeto canônico (esquemas auth e extensions, public.app_access). Nada toca em banco remoto."""
import json
import secrets
from pathlib import Path

import psycopg
import pytest
from psycopg import sql

from orquestrador import instalacao
from orquestrador.__main__ import main
from orquestrador.instalacao import ErroDeInstalacao, gerar_instalacao
from conftest import suporte


@pytest.fixture()
def banco_vazio_forma_canonica(servidor):
    """Um banco SEM o esquema helena_v2, só com o que o projeto canônico já tem."""
    url = suporte.exigir_banco_local(servidor)
    nome = 'helena_v2_instalar_' + secrets.token_hex(5)
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute('select pg_advisory_lock(84219075)')
        try:
            suporte.criar_papeis(admin, suporte.PAPEIS_DO_SUPABASE)
            admin.execute(sql.SQL('create database {}').format(sql.Identifier(nome)))
        finally:
            admin.execute('select pg_advisory_unlock(84219075)')
    banco = suporte.Banco(url, nome, [])
    try:
        with banco.conectar() as con:
            con.execute('create schema auth')
            con.execute("""create function auth.uid() returns uuid language sql stable as $$
                select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$""")
            con.execute('create schema extensions')
            con.execute('create extension pgcrypto schema extensions')
            con.execute("""create table public.app_access (user_id uuid primary key, role text not null,
                active boolean not null, created_at timestamptz default now(), updated_at timestamptz default now())""")
            con.execute("insert into public.app_access(user_id, role, active) values (%s, 'founder', true)",
                        (suporte.FUNDADOR_TESTE,))
        yield banco
    finally:
        suporte.derrubar_banco(banco)


def _aplicar(banco, arquivo: Path):
    with banco.conectar() as con:
        con.execute(arquivo.read_text(encoding='utf-8'))


def test_roteiro_gerado_instala_e_confere_num_banco_com_a_forma_canonica(banco_vazio_forma_canonica, tmp_path):
    pasta = tmp_path / 'roteiro'
    manifesto = gerar_instalacao(pasta)
    assert manifesto['executado'] is False and manifesto['ultima_migration'] >= 23
    assert sorted(manifesto['arquivos']) == ['01_instalar_v2.sql', '02_base_tecnica.sql', '03_conferir_depois.sql', 'LEIA-ANTES.md']
    instalar = (pasta / '01_instalar_v2.sql').read_text(encoding='utf-8')
    assert instalar.index('-- ===== 0022_pareamento_telegram.sql =====') < instalar.index(
        '-- ===== 0023_pedido_card_v2.sql =====')
    for nome, hash_esperado in manifesto['arquivos'].items():
        import hashlib
        assert hashlib.sha256((pasta / nome).read_bytes()).hexdigest() == hash_esperado
    banco = banco_vazio_forma_canonica
    _aplicar(banco, pasta / '01_instalar_v2.sql')
    _aplicar(banco, pasta / '02_base_tecnica.sql')
    with banco.conectar() as con:
        linhas = []
        for comando in (pasta / '03_conferir_depois.sql').read_text(encoding='utf-8').split(';'):
            if comando.strip() and not all(l.strip().startswith('--') or not l.strip() for l in comando.splitlines()):
                linhas.extend(con.execute(comando).fetchall())
    assert len(linhas) == 12 and all(ok for _nome, ok in linhas), linhas
    # a segunda aplicação da base técnica é idempotente (mesmo conteúdo)
    _aplicar(banco, pasta / '02_base_tecnica.sql')


def test_falha_no_meio_da_instalacao_nao_deixa_nada_pela_metade(banco_vazio_forma_canonica, tmp_path):
    pasta = tmp_path / 'roteiro'
    gerar_instalacao(pasta)
    texto = (pasta / '01_instalar_v2.sql').read_text(encoding='utf-8')
    quebrado = texto.replace('-- ===== 0005_publicacao.sql =====', '-- ===== 0005_publicacao.sql =====\nselect 1/0;', 1)
    assert quebrado != texto
    (pasta / '01_quebrado.sql').write_text(quebrado, encoding='utf-8')
    with pytest.raises(psycopg.errors.DivisionByZero):
        _aplicar(banco_vazio_forma_canonica, pasta / '01_quebrado.sql')
    with banco_vazio_forma_canonica.conectar() as con:
        assert con.execute("select count(*) from pg_namespace where nspname = 'helena_v2'").fetchone()[0] == 0


def test_recusa_pasta_dentro_de_repositorio_e_pasta_ocupada(tmp_path):
    raiz = Path(instalacao.__file__).resolve().parents[3]
    with pytest.raises(ErroDeInstalacao, match='fora de qualquer repositório'):
        gerar_instalacao(raiz / 'nao-pode-aqui')
    ocupada = tmp_path / 'ocupada'
    ocupada.mkdir()
    (ocupada / 'algo.txt').write_text('x')
    with pytest.raises(ErroDeInstalacao, match='não está vazia'):
        gerar_instalacao(ocupada)


def test_roteiro_traz_a_frase_exata_o_projeto_certo_e_nao_executa(tmp_path):
    manifesto = gerar_instalacao(tmp_path / 'r')
    leia = (tmp_path / 'r' / 'LEIA-ANTES.md').read_text(encoding='utf-8')
    assert manifesto['frase_exata'] in leia and 'wxkgrykduqtsgmjkzlou' in leia
    assert 'imvfmjgmacrulhztrqlh' in leia and 'Nada aqui foi executado' in leia
    instalar = (tmp_path / 'r' / '01_instalar_v2.sql').read_text(encoding='utf-8')
    assert instalar.lstrip().startswith('-- Instalação') and 'begin;' in instalar and instalar.rstrip().endswith('commit;')
    import re
    comandos_perigosos = re.compile(r'(?im)^\s*(drop\s+(schema|database|table)|create\s+role|alter\s+role|truncate\b|delete\s+from\s+(?!helena_v2\.))')
    assert not comandos_perigosos.search(instalar), comandos_perigosos.search(instalar)


def test_cli_gera_para_revisao_sem_conectar(tmp_path, capsys, monkeypatch):
    import orquestrador.__main__ as cli
    monkeypatch.setattr(cli, 'Motor', lambda *_a, **_k: pytest.fail('abriu o Motor'))
    assert main(['gerar-instalacao', '--saida', str(tmp_path / 'cli')]) == 0
    saida = json.loads(capsys.readouterr().out)
    assert saida['estado'] == 'GERADO_PARA_REVISAO' and saida['executado'] is False
    assert main(['gerar-instalacao', '--saida', str(tmp_path / 'cli')]) == 1                 # pasta já ocupada
