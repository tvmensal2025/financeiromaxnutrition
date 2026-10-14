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
    """Somente adaptador aprovado no código (executor_helena/registro.py); configurações não carregam plugins.

    O runtime vem do nome em HELENA_V2_EXECUTOR (padrão: hermes). Trocar de runtime não muda nada aqui.
    """
    from .contexto_real import montar_contexto_real
    from executor_helena.registro import ErroDeRegistro, adaptador_configurado, variaveis_faltando
    nomes = ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL')
    try:
        adaptador = adaptador_configurado(os.environ)
    except ErroDeRegistro as erro:
        raise ValueError(str(erro)) from erro
    if any(not os.environ.get(n) for n in nomes) or variaveis_faltando(adaptador, os.environ):
        raise ValueError('runtime real requer conexões e caminhos próprios; o token Management não os substitui')
    executor = adaptador.montar(os.environ)
    return Motor(os.environ['HELENA_V2_DATABASE_URL'], os.environ['HELENA_V2_DBOS_SYSTEM_DATABASE_URL'],
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


class _BancoSomenteLeitura:
    """O que o vigia e o relógio precisam do banco: conexões service_role e fechar. Sem Hermes e sem DBOS."""

    def __init__(self, dsn, parametros):
        self._dsn, self._parametros = dsn, parametros

    def _con(self, papel='service_role'):
        if papel != 'service_role':
            raise RuntimeError('só o papel service_role é usado aqui')
        import psycopg
        from psycopg import sql
        from psycopg.rows import dict_row
        con = psycopg.connect(self._dsn, autocommit=True, row_factory=dict_row, **self._parametros)
        try:
            con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(papel)))
        except BaseException:
            con.close()
            raise
        return con

    def fechar(self):
        return None                     # cada conexão é aberta e fechada por volta; nada fica aberto aqui


def _abrir_banco_somente_leitura():
    """Abre o banco da v2 SÓ para ler (o vigia). Veja `_abrir_banco_service_role`."""
    return _abrir_banco_service_role(somente_leitura=True)


def _abrir_banco_service_role(*, somente_leitura):
    """Abre o banco da v2 pelo papel service_role, exigindo apenas HELENA_V2_DATABASE_URL (nem Hermes nem DBOS).
    `somente_leitura=False` é só do relógio, que precisa gravar o evento de prazo; o vigia lê.

    Mesmas checagens de produção do Motor, reutilizadas de bancos.py: URL canônica com TLS verificado e sem override
    PG* (validar_destinos_reais), CA do sistema (parametros_conexao_real), papel sem privilégio administrativo
    (preflight_papel_runtime, uma vez, antes do SET ROLE) e SET ROLE service_role em cada conexão. Além disso a sessão
    sai marcada como somente leitura no próprio PostgreSQL. Falha fechado; nenhuma mensagem traz a URL.
    """
    import psycopg
    from psycopg.rows import dict_row
    from .bancos import parametros_conexao_real, preflight_papel_runtime, validar_destinos_reais
    url = os.environ.get('HELENA_V2_DATABASE_URL')
    if not url:
        raise ValueError('exige HELENA_V2_DATABASE_URL (vigiar e relogio só falam com o banco; não precisam do Hermes)')
    validar_destinos_reais(url, url)    # só o banco do card existe aqui: a mesma URL nos dois lugares é aceita pela função
    dsn = url.replace('postgresql+psycopg://', 'postgresql://', 1)
    parametros = dict(parametros_conexao_real())
    if somente_leitura:
        parametros['options'] += ' -c default_transaction_read_only=on'
    with psycopg.connect(dsn, autocommit=True, row_factory=dict_row, **parametros) as con:
        preflight_papel_runtime(con)
    return _BancoSomenteLeitura(dsn, parametros)


def _vigiar(args, parser):
    """O vigia de 5 em 5 minutos: SÓ LÊ o banco (papel service_role) e avisa por um canal em arquivo.

    `--canal-webhook` acrescenta o canal por webhook HTTPS: os DOIS recebem todo alarme. Só precisa de
    HELENA_V2_DATABASE_URL (e, com o webhook, da variável da URL do webhook); nada do Hermes.
    """
    import signal
    import threading
    from .vigilancia import NotificadorDeArquivo, NotificadorHttp, Vigia, limpar_texto
    if not args.saida:
        parser.error('vigiar exige --saida com o arquivo onde os alarmes são gravados (o canal em arquivo sempre é usado; '
                     '--canal-webhook acrescenta o webhook)')
    canais = [NotificadorDeArquivo(Path(args.saida))]
    if args.canal_webhook:
        try:
            canais.append(NotificadorHttp())        # lê a URL da variável de ambiente; sem rede aqui
        except ValueError as erro:
            print(json.dumps({'estado': 'FALHA_DE_CANAL', 'motivo': limpar_texto(erro)}, ensure_ascii=False))
            return 1
    try:
        banco = _abrir_banco_somente_leitura()
    except Exception as erro:
        print(json.dumps({'estado': 'FALHA_DE_RUNTIME', 'motivo': limpar_texto(f'{type(erro).__name__}')}, ensure_ascii=False))
        return 1
    vigia = Vigia(lambda: banco._con('service_role'), canais, registrar=lambda linha: print(linha, flush=True))
    try:
        if args.uma_volta:
            volta = vigia.uma_volta()
            print(json.dumps({'alarmes': volta.alarmes, 'enviados': volta.enviados, 'suprimidos': volta.suprimidos,
                              'canais_falhos': volta.canais_falhos, 'metricas': vigia.metricas}, ensure_ascii=False))
            return 0
        parar = threading.Event()
        for sinal in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sinal, lambda *_: parar.set())
        vigia.rodar(parar, args.intervalo)
        return 0
    finally:
        banco.fechar()


def _relogio(args, parser):
    """O relógio dos prazos: a cada volta pede ao BANCO o que venceu (eventos_devidos) e aplica cada evento como papel RELOGIO.

    Só precisa de HELENA_V2_DATABASE_URL (nada do Hermes). A saída traz só contagens e nomes de evento, nunca texto de agente.
    Quem avisa que o relógio parou é o vigia (alarme RELOGIO_ATRASADO). Erro numa volta não derruba o laço.
    """
    import signal
    import threading
    from .relogio import Relogio, aplicador_do_banco
    from .vigilancia import limpar_texto
    try:
        banco = _abrir_banco_service_role(somente_leitura=False)
    except Exception as erro:
        print(json.dumps({'estado': 'FALHA_DE_RUNTIME', 'motivo': limpar_texto(f'{type(erro).__name__}')}, ensure_ascii=False))
        return 1
    relogio = Relogio(lambda: banco._con('service_role'), aplicador_do_banco(lambda: banco._con('service_role')))

    def uma_volta():
        try:
            resumo = relogio.uma_volta()
        except Exception as erro:
            print(json.dumps({'estado': 'VOLTA_COM_ERRO', 'tipo': limpar_texto(type(erro).__name__)}, ensure_ascii=False), flush=True)
            return False
        print(json.dumps({'estado': 'VOLTA_FEITA', 'devidos': resumo.devidos, 'aplicados': resumo.aplicados,
                          'recusados': resumo.recusados, 'obsoletos': resumo.obsoletos,
                          'eventos': sorted({e.evento for e in resumo.eventos})}, ensure_ascii=False), flush=True)
        return True

    try:
        if args.uma_volta:
            return 0 if uma_volta() else 1
        parar = threading.Event()
        for sinal in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sinal, lambda *_: parar.set())
        while not parar.is_set():
            uma_volta()
            parar.wait(args.intervalo)
        return 0
    finally:
        banco.fechar()


def main(argv=None):
    parser = argparse.ArgumentParser(prog='python -m orquestrador')
    parser.add_argument('comando', choices=['validar-configuracoes', 'registrar-base-tecnica',
                                          'preparar-tarefa-real', 'consumir-pedido-real',
                                          'avancar-card-real', 'gerar-instalacao', 'vigiar', 'relogio'])
    parser.add_argument('--tarefa', help='ID canônico da tarefa, sem dados exemplificativos')
    parser.add_argument('--roteiro', help='Nome do roteiro operacional da revisão local')
    parser.add_argument('--saida', help='Arquivo (ou, em gerar-instalacao, pasta) privado novo fora do checkout')
    parser.add_argument('--solicitacao', help='UUID do pedido já autenticado no banco')
    parser.add_argument('--card', help='UUID de um card real existente')
    parser.add_argument('--uma-volta', action='store_true', help='vigiar e relogio: faz uma volta e sai (padrão: roda até ser interrompido)')
    parser.add_argument('--intervalo', type=float, default=None, help='vigiar e relogio: segundos entre voltas (padrão: 300 no vigiar, 60 no relogio)')
    parser.add_argument('--canal-webhook', action='store_true', help='vigiar: avisa também por webhook HTTPS (URL na variável HELENA_V2_ALARME_WEBHOOK_URL)')
    args = parser.parse_args(argv)
    if args.comando in ('vigiar', 'relogio'):
        if args.intervalo is None:
            args.intervalo = 300.0 if args.comando == 'vigiar' else 60.0
        if args.intervalo <= 0:
            parser.error('--intervalo precisa ser maior que zero')
        return _vigiar(args, parser) if args.comando == 'vigiar' else _relogio(args, parser)
    if args.comando == 'gerar-instalacao':
        # Só escreve arquivos SQL para REVISÃO numa pasta nova; não conecta em banco nenhum.
        from .instalacao import ErroDeInstalacao, gerar_instalacao
        if not args.saida:
            parser.error('gerar-instalacao exige --saida com uma pasta nova fora do repositório')
        try:
            manifesto = gerar_instalacao(Path(args.saida))
        except ErroDeInstalacao as erro:
            print(json.dumps({'estado': 'RECUSADO', 'motivo': str(erro)}, ensure_ascii=False))
            return 1
        print(json.dumps({'estado': 'GERADO_PARA_REVISAO', 'executado': False, 'pasta': str(args.saida),
                          'arquivos': sorted(manifesto['arquivos']), 'frase_exata': manifesto['frase_exata']},
                         ensure_ascii=False))
        return 0
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
