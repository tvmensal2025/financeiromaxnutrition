"""Comando local explícito para conferir revisões solicitadas pelo fundador."""
import argparse
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from uuid import UUID

from .motor import Motor
from .fonte_supabase import FonteSupabase, ErroFonteSupabase
from .preparacao import preparar_tarefa_real
from .plano import RAIZ
from spec_helena.leitura import ler_yaml


def _abrir_runtime_real(*, iniciar_dbos):
    """Somente adaptador aprovado no código; configurações não carregam plugins."""
    from .contexto_real import montar_contexto_real
    from executor_helena.executor import ExecutorHermes
    from executor_helena.perfil import ConfigDoExecutor
    nomes = ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL',
             'HELENA_V2_HERMES_BIN', 'HELENA_V2_HERMES_HOME', 'HELENA_V2_EXECUCOES_DIR')
    valores = {n: os.environ.get(n) for n in nomes}
    if any(not v for v in valores.values()):
        raise ValueError('runtime real requer conexões e caminhos próprios; o token Management não os substitui')
    binario = Path(valores['HELENA_V2_HERMES_BIN'])
    if not binario.is_absolute() or not binario.is_file() or not os.access(binario, os.X_OK):
        raise ValueError('executável Hermes não está preparado')
    executor = ExecutorHermes(ConfigDoExecutor(
        comando_hermes=(str(binario),), raiz_hermes=Path(valores['HELENA_V2_HERMES_HOME']),
        pasta_das_execucoes=Path(valores['HELENA_V2_EXECUCOES_DIR'])))
    return Motor(valores['HELENA_V2_DATABASE_URL'], valores['HELENA_V2_DBOS_SYSTEM_DATABASE_URL'],
                 executor=executor, fonte_contexto=montar_contexto_real,
                 modo_producao=True, iniciar_dbos=iniciar_dbos)


def _executar_comando_real(args):
    """Consome uma solicitação existente ou avança um card; nunca confirma pelo fundador."""
    avancar = args.comando == 'avancar-card-real'
    valor = args.card if avancar else args.solicitacao
    identificador = str(UUID(valor))
    motor = _abrir_runtime_real(iniciar_dbos=False)
    try:
        if avancar:
            card = motor._card(identificador)
            if not card or card['ordem_de_servico'].get('modo_contexto') != 'real':
                raise ValueError('card real não encontrado')
            # Conferir fontes e autorização antes de iniciar retomadas DBOS.
            motor._modo_card(identificador)
            motor.fechar()
            motor = _abrir_runtime_real(iniciar_dbos=True)
            houve_avanco = motor.avancar(identificador)
            return {'card_id': identificador, 'estado': motor._card(identificador)['estado'],
                    'houve_avanco': houve_avanco}
        pedido = motor._linha('SELECT helena_v2.ler_solicitacao_card_real(%s::uuid) AS pedido',
                               (identificador,))['pedido']
        if not pedido:
            raise ValueError('solicitação autenticada não encontrada')
        card_id = motor.criar_card_real(
            pedido['plano'], origem=pedido['origem'], chave_origem=pedido['chave_origem'],
            titulo=pedido['titulo'], pedido_original=pedido['pedido_original'],
            business_id=pedido['business_id'],
            prazo=datetime.fromisoformat(pedido['prazo'].replace('Z', '+00:00')),
            dados_reais=pedido['dados_reais'], solicitacao_id=identificador,
            revisao_id=pedido['config_revision_id'])
        return {'card_id': str(card_id), 'estado': motor._card(card_id)['estado'],
                'solicitacao_id': identificador, 'agentes_chamados': 0}
    finally:
        motor.fechar()


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
                                          'preparar-tarefa-real', 'consumir-pedido-real',
                                          'avancar-card-real'])
    parser.add_argument('--tarefa', help='ID canônico da tarefa, sem dados exemplificativos')
    parser.add_argument('--roteiro', help='Nome do roteiro operacional da revisão local')
    parser.add_argument('--saida', help='Arquivo privado novo fora do checkout')
    parser.add_argument('--solicitacao', help='UUID do pedido já autenticado no banco')
    parser.add_argument('--card', help='UUID de um card real existente')
    args = parser.parse_args(argv)
    if args.comando in ('consumir-pedido-real', 'avancar-card-real'):
        valor = args.card if args.comando == 'avancar-card-real' else args.solicitacao
        if not valor:
            parser.error('informe --card ou --solicitacao conforme o comando')
        try:
            resultado = _executar_comando_real(args)
        except Exception:
            # DSNs e detalhes de erros do provedor não pertencem à saída pública.
            print(json.dumps({'estado': 'FALHA_DE_RUNTIME',
                              'motivo': 'Confira o runtime e a vigência das fontes. Consulte o pedido ou card antes de repetir: uma operação pode ter sido gravada antes da falha. Nenhuma aprovação foi presumida.'},
                             ensure_ascii=False))
            return 1
        print(json.dumps(resultado, ensure_ascii=False))
        return 0
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
