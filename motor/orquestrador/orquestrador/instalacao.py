"""Gera, para REVISÃO, o roteiro de instalação da v2 num banco Supabase. NÃO executa nada em banco nenhum.

O que é: três arquivos SQL e um LEIA-ANTES, escritos numa pasta fora do repositório:
  01_instalar_v2.sql     as migrations em ordem, numa transação só (se uma falhar, nada fica pela metade);
  02_base_tecnica.sql    registra a configuração técnica (helena-v2/ validada offline) pelo papel service_role;
  03_conferir_depois.sql só leituras: a tabela de regras confere, o vigia está vazio, as portas de manutenção estão fechadas;
  LEIA-ANTES.md          o que conferir antes, a frase exata do fundador, como voltar atrás;
  manifesto.json         o hash de cada arquivo, para provar que o revisado é o aplicado.
Quem aplica: SOMENTE depois da frase exata do fundador (veja LEIA-ANTES.md). Este módulo só lê arquivos locais.
O ensaio (testes/test_instalacao.py) aplica estes mesmos arquivos num PostgreSQL local com a forma do projeto canônico.
"""
import hashlib
import json
import re
from pathlib import Path

from .configuracao import capturar_bundle, hash_bundle, validar_bundle
from .plano import RAIZ

MIGRACOES = RAIZ / 'supabase' / 'migrations-v2'
FRASE_DE_AUTORIZACAO = 'AUTORIZO INSTALAR A V2 (MIGRATIONS 0001 A {ultima}) NO SUPABASE wxkgrykduqtsgmjkzlou'
PROJETO_CANONICO = 'wxkgrykduqtsgmjkzlou'
PROJETO_HISTORICO = 'imvfmjgmacrulhztrqlh'


class ErroDeInstalacao(ValueError):
    """O roteiro não pode ser gerado com segurança."""


def _migrations():
    arquivos = sorted(p for p in MIGRACOES.glob('[0-9][0-9][0-9][0-9]_*.sql'))
    numeros = [int(p.name[:4]) for p in arquivos]
    if not arquivos or numeros != list(range(1, len(arquivos) + 1)):
        raise ErroDeInstalacao(f'migrations fora de sequência: {numeros}')
    for arquivo in arquivos:
        texto = arquivo.read_text(encoding='utf-8')
        if re.search(r'(?im)^\s*(begin|commit|rollback)\s*;', texto):
            raise ErroDeInstalacao(f'{arquivo.name} controla transação por conta própria')
        if re.search(r'(?im)^\s*\\|create\s+database|drop\s+database|create\s+role|alter\s+role', texto):
            raise ErroDeInstalacao(f'{arquivo.name} contém comando que o roteiro não aceita')
    return arquivos


def _escrever(pasta: Path, nome: str, texto: str) -> str:
    destino = pasta / nome
    destino.write_text(texto, encoding='utf-8')
    return hashlib.sha256(texto.encode('utf-8')).hexdigest()


def _literal(texto: str) -> str:
    return "'" + texto.replace("'", "''") + "'"


def _instalar(arquivos, ultima: int) -> str:
    partes = [f"""-- Instalação da v2 (migrations 0001 a {ultima:04d}), numa transação só.
-- ATENÇÃO: NÃO aplique sem a frase exata do fundador (LEIA-ANTES.md). Gerado por `python -m orquestrador gerar-instalacao`.
begin;
"""]
    for arquivo in arquivos:
        partes.append(f"\n-- ===== {arquivo.name} =====\n{arquivo.read_text(encoding='utf-8').rstrip()}\n")
    partes.append('\ncommit;\n')
    return ''.join(partes)


def _base_tecnica(bundle: dict) -> str:
    conteudo = json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return f"""-- Registra a configuração técnica da v2 (a que veio de helena-v2/, validada offline antes de gerar este arquivo).
-- Hash do conteúdo (SHA-256 do bundle canônico): {hash_bundle(bundle)}
-- Precisa do papel service_role: a função recusa qualquer outro (SOMENTE_MOTOR). NÃO CONFIRMADO: se o editor SQL do
-- Supabase permite `set local role service_role`; se não permitir, o registro tem de sair pelo motor com a conexão dele.
begin;
set local role service_role;
select helena_v2.registrar_configuracao_tecnica(
  'Configuração técnica da v2',
  {_literal(conteudo)}::jsonb,
  (select m.impressao_digital from helena_v2.meta_tabela m limit 1));
commit;
"""


CONFERIR = """-- Só leituras. Cada linha deve dizer ok = true. Se alguma disser false, PARE e não siga com a v2.
select 'tabela de regras confere' as conferencia, helena_v2.tabela_confere() as ok;
select 'base técnica registrada' as conferencia,
       exists (select 1 from helena_v2.configuracao_ponteiro where tecnica_id is not null) as ok;
select 'nenhuma revisão ativa ainda (o fundador ativa depois, pela tela)' as conferencia,
       not exists (select 1 from helena_v2.configuracao_ponteiro where ativa_id is not null) as ok;
select 'anon não executa nada de manutenção' as conferencia, not (
  has_function_privilege('anon', 'helena_v2.vigia()', 'execute')
  or has_function_privilege('anon', 'helena_v2.conferir_card(uuid)', 'execute')) as ok;
select 'authenticated não executa as portas de manutenção' as conferencia, not (
  has_function_privilege('authenticated', 'helena_v2.vigia()', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.conferir_card(uuid)', 'execute')
  or has_function_privilege('authenticated', 'helena_v2.calcular_hash_das_linhas()', 'execute')) as ok;
select 'service_role executa o vigia' as conferencia,
       has_function_privilege('service_role', 'helena_v2.vigia()', 'execute') as ok;
select 'nenhum card existe ainda' as conferencia, not exists (select 1 from helena_v2.card) as ok;
"""


def _leia_antes(ultima: int, hashes: dict, hash_do_bundle: str) -> str:
    frase = FRASE_DE_AUTORIZACAO.format(ultima=f'{ultima:04d}')
    lista = '\n'.join(f'- `{nome}`: `{valor}`' for nome, valor in hashes.items())
    return f"""# Instalar a v2 no Supabase — LEIA ANTES (roteiro gerado para revisão)

**Nada aqui foi executado.** Estes arquivos só entram no banco real depois da frase exata do fundador:

> **{frase}**

Até recebê-la, este roteiro fica parado.

## Antes de aplicar (conferir, sem mudar nada)
1. **Projeto certo.** O projeto canônico é `{PROJETO_CANONICO}` (ecosistemadossonhos). O projeto `{PROJETO_HISTORICO}` é histórico: **não** aplicar nele. Confirme o endereço do projeto na tela do Supabase antes de colar qualquer coisa.
2. **Cópia de segurança feita e restaurável.** Faça a cópia completa do banco e guarde. O ensaio local (`supabase/migrations-v2/testes/test_22_backup_e_restauracao.py`) prova o método num banco de teste; o tempo real só se mede no banco real. Sem cópia, não aplique.
3. **Nenhum job crítico rodando** (125 jobs, 148 tarefas e 241 handoffs existem hoje no banco: este roteiro **não** mexe neles; só cria o esquema `helena_v2`).
4. **Esquema não exposto na API.** Confirme que `helena_v2` **não** está na lista de esquemas expostos da API do projeto. As telas falam com as funções (RPC) por permissão; a lista de exposição é decisão do fundador e **NÃO CONFIRMADA** aqui.
5. **Hash dos arquivos.** Os arquivos abaixo têm de bater com `manifesto.json` (`sha256sum`).
{lista}
   Hash do conteúdo da configuração técnica: `{hash_do_bundle}`.

## Ordem
1. `01_instalar_v2.sql` (uma transação: ou entra tudo, ou nada).
2. `02_base_tecnica.sql` (regista a configuração técnica).
3. `03_conferir_depois.sql` (todas as linhas devem dizer `ok = true`).
4. Só então o fundador ativa uma revisão pela tela de configuração.

## Se algo der errado
- Falha em `01`: a transação desfaz tudo; o banco volta como estava. Não tente consertar à mão.
- Falha em `03` depois de `01` e `02`: **não use a v2**. Se nenhum card real existir, o esquema pode ser removido restaurando a cópia de segurança. Não apague tabelas à mão e não mexa na v1.
- Qualquer dúvida: pare e avise o fundador.

## O que este roteiro NÃO faz
Não toca no Hermes, no EasyPanel, em chaves, nem nas tabelas da v1. Não ativa revisão, não cria card e não chama agente.
"""


def gerar_instalacao(destino: Path) -> dict:
    """Escreve o roteiro em `destino` (pasta nova, fora de qualquer repositório Git). Devolve o manifesto."""
    destino = Path(destino)
    if destino.exists() and any(destino.iterdir()):
        raise ErroDeInstalacao('a pasta de destino já existe e não está vazia: nada é sobrescrito')
    for pai in [destino.resolve(), *destino.resolve().parents]:
        if (pai / '.git').exists():
            raise ErroDeInstalacao('salve o roteiro fora de qualquer repositório Git')
    arquivos = _migrations()
    ultima = int(arquivos[-1].name[:4])
    bundle = capturar_bundle(RAIZ / 'helena-v2')
    validar_bundle(bundle, raiz_maquina=RAIZ / 'helena-v2')          # recusa configuração que o conferente não aceita
    destino.mkdir(parents=True, exist_ok=True)
    hashes = {
        '01_instalar_v2.sql': _escrever(destino, '01_instalar_v2.sql', _instalar(arquivos, ultima)),
        '02_base_tecnica.sql': _escrever(destino, '02_base_tecnica.sql', _base_tecnica(bundle)),
        '03_conferir_depois.sql': _escrever(destino, '03_conferir_depois.sql', CONFERIR),
    }
    hash_do_bundle = hash_bundle(bundle)
    hashes['LEIA-ANTES.md'] = _escrever(destino, 'LEIA-ANTES.md', _leia_antes(ultima, hashes, hash_do_bundle))
    manifesto = {'ultima_migration': ultima, 'projeto_canonico': PROJETO_CANONICO,
                 'frase_exata': FRASE_DE_AUTORIZACAO.format(ultima=f'{ultima:04d}'),
                 'hash_do_bundle': hash_do_bundle, 'arquivos': hashes, 'executado': False}
    _escrever(destino, 'manifesto.json', json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n')
    return manifesto
