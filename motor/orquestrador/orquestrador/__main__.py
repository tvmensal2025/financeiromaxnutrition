"""Comando local explícito para conferir revisões solicitadas pelo fundador."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

from .motor import Motor
from .fonte_supabase import FonteSupabase, ErroFonteSupabase
from .preparacao import preparar_tarefa_real
from .plano import RAIZ
from spec_helena.leitura import ler_yaml


def _salvar_preparacao(caminho, preparacao):
    """Arquivo privado fora do checkout; nunca sobrescreve uma captura anterior."""
    fornecido = Path(caminho).absolute()
    if any(p.is_symlink() for p in (fornecido, *fornecido.parents)):
        raise ValueError('a saída não pode conter links simbólicos')
    destino = fornecido.resolve(strict=False)
    if destino == RAIZ or RAIZ in destino.parents:
        raise ValueError('salve a captura privada fora do repositório')
    try:
        git = subprocess.run(['git', '-C', str(destino.parent), 'rev-parse', '--git-dir'],
                             capture_output=True, timeout=3, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError('não foi possível conferir se a saída está fora do Git') from None
    if git.returncode == 0:
        raise ValueError('salve a captura privada fora de qualquer repositório Git')
    from executor_helena.segredos import segredos_no_texto
    conteudo = json.dumps(preparacao, ensure_ascii=False, indent=2, allow_nan=False)
    if segredos_no_texto(conteudo):
        raise ValueError('a captura contém possível credencial; arquivo não foi criado')
    descritor = os.open(destino, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descritor, 'w', encoding='utf-8') as arquivo:
        arquivo.write(conteudo)
        arquivo.flush()
        os.fsync(arquivo.fileno())


def main(argv=None):
    parser = argparse.ArgumentParser(prog='python -m orquestrador')
    parser.add_argument('comando', choices=['validar-configuracoes', 'registrar-base-tecnica',
                                          'preparar-tarefa-real'])
    parser.add_argument('--tarefa', help='ID canônico da tarefa, sem dados exemplificativos')
    parser.add_argument('--roteiro', help='Nome do roteiro operacional da revisão local')
    parser.add_argument('--saida', help='Arquivo privado novo fora do checkout')
    args = parser.parse_args(argv)
    if args.comando == 'preparar-tarefa-real':
        if not args.tarefa or not args.roteiro:
            parser.error('preparar-tarefa-real exige --tarefa e --roteiro')
        if not re.fullmatch(r'[a-z0-9_-]{1,250}', args.roteiro):
            parser.error('nome de roteiro inválido')
        try:
            plano = ler_yaml(RAIZ / 'helena-v2' / 'playbooks' / (args.roteiro + '.yaml'))
            captura = FonteSupabase().carregar_tarefa(args.tarefa, plano)
            preparacao = preparar_tarefa_real(captura, plano)
            if args.saida:
                _salvar_preparacao(args.saida, preparacao)
        except (ErroFonteSupabase, ValueError, OSError):
            # Não despejar SQL, respostas, caminhos de credenciais ou texto privado.
            print(json.dumps({'estado': 'FALHA_DE_PREPARACAO',
                              'motivo': 'Não foi possível preparar a tarefa. Confira acesso, fontes, roteiro e arquivo de saída.'},
                             ensure_ascii=False))
            return 1
        print(json.dumps({'estado': preparacao['estado'], 'tarefa_id': preparacao['tarefa_id'],
                          'business_id': preparacao['business_id'],
                          'checkpoint_id': captura['checkpoint']['checkpoint_id'],
                          'fontes_documentais': len(captura['entradas_externas']),
                          'decisoes_vigentes': len(captura['decisoes']),
                          'pendencias': preparacao['pendencias'],
                          'agentes_chamados': 0, 'escritas_remotas': 0,
                          'captura_salva': bool(args.saida)}, ensure_ascii=False))
        return 0
    if args.comando in ('validar-configuracoes', 'registrar-base-tecnica'):
        url_banco = os.environ.get('HELENA_V2_CONFIG_DATABASE_URL')
        url_dbos = os.environ.get('HELENA_V2_DBOS_SYSTEM_DATABASE_URL')
        if not url_banco or not url_dbos:
            parser.error('defina HELENA_V2_CONFIG_DATABASE_URL e HELENA_V2_DBOS_SYSTEM_DATABASE_URL para bancos locais separados')
        motor = Motor(url_banco, url_dbos, permitir_executor_falso=True, iniciar_dbos=False,
                      permitir_configuracao_tecnica=args.comando == 'registrar-base-tecnica')
        try:
            if args.comando == 'registrar-base-tecnica':
                revisao = motor._configuracao_tecnica()
                print(json.dumps({'id': revisao['id'], 'estado': revisao['estado']}, ensure_ascii=False))
                return 0
            resultados = motor.processar_configuracoes_pendentes()
        finally:
            motor.fechar()
        print(json.dumps({'processadas': len(resultados), 'resultados': [
            {'id': r.get('id'), 'estado': r.get('estado'), 'ignorada': r.get('ignorada')}
            for r in resultados]}, ensure_ascii=False))
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
