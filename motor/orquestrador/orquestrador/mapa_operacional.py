"""Mapa curto do fluxo v2, derivado da revisão capturada e do contexto canônico.

O mapa orienta a triagem; não concede permissão nem substitui os validadores do motor.
"""
from __future__ import annotations

import re
from typing import TypedDict


class MapaInvalido(ValueError):
    """Uma fonte necessária ao mapa está ausente ou inconsistente."""


class EmpresaMapa(TypedDict):
    id: str
    nome: str


class ServicoMapa(TypedDict):
    id: str
    estado: str
    dono: str
    revisor_titular: str
    empresas_operacionais: list[str]


class MapaOperacional(TypedDict):
    origem: dict[str, str]
    rotas: dict[str, str]
    fontes_de_dados: dict[str, str]
    empresas_operacionais: list[EmpresaMapa]
    servicos: list[ServicoMapa]
    fluxo: list[str]
    regras: list[str]


# Manifesto público de código: conferir com src/App.tsx ao alterar a navegação.
ROTAS: dict[str, str] = {
    '/': 'painel; ?card= ou ?pedido= redireciona para /cards',
    '/cards': 'pedidos, propostas, Kanban de cards e pedido de publicação',
    '/configuracoes': 'revisão e ativação da configuração v2',
    '/comando': 'sala de comando do fundador em 12 abas (visão geral, cards, processo, execução, entregas, consumo etc.); lê só cards, etapas e entregas da v2',
    '/sistema': 'governança: metadados do checkpoint atual, decisões e configuração ativa; sem snapshot integral',
    '/conversa': 'entrada autenticada de pedido v2; acompanhamento, não chat instantâneo',
    '/equipe': 'agentes e serviços da revisão ativa VALIDADA; estado configurado não prova runtime',
    '/integracoes': 'pareamento Telegram da conta; vínculo não prova webhook, Edge ou transporte',
    '/execucao': 'redireciona para a aba Execução de /comando: cards e etapas v2 consultáveis pela sessão; não usa agent_jobs legado',
    '/entregas': 'redireciona para a aba Entregas de /comando: entregas aprovadas das etapas v2, abertas pelo card; PRONTO não implica publicação',
    '/consumo': 'redireciona para a aba Consumo de /comando: cards consultados; custo, tokens e chamadas sem medição confirmada nesta tela',
    '/cobertura': 'redireciona para a aba Cobertura de /comando: amostra de estados dos cards v2; não comprova disponibilidade do motor',
    '/supervisao': 'redireciona para a aba Supervisão de /comando: cards v2 e esperas do fundador; ações e etapas têm estados próprios',
    '/financeiro': 'leitura financeira autorizada do negócio selecionado; fonte pública com RLS',
    '/crm': 'oportunidades autorizadas do negócio selecionado; contato externo requer permissão',
    '/calendario': 'agenda e tarefas autorizadas do negócio; tarefa legada não vira card v2',
    '/portfolio': 'cadastro canônico de empresas visível à sessão',
    '/empresas': 'mesma visão de portfólio de /portfolio',
    '/identidade': 'identidade de marca por negócio autorizado',
    '/indicadores': 'indicadores do negócio autorizado, com origem e escopo',
    '/modulo/:tabela': 'módulo genérico permitido por rota e sessão; acesso final depende de ACL/RLS',
    '/painel': 'redireciona para /',
    '/cards-v2': 'redireciona para /cards',
    '/configuracoes-v2': 'redireciona para /configuracoes',
}

ESTADOS_SERVICO = frozenset({'RASCUNHO', 'EM_TESTE', 'ESTAGIO', 'ATIVO', 'PAUSADO', 'APOSENTADO'})


def _texto(valor: object, nome: str) -> str:
    if not isinstance(valor, str) or not valor.strip() or valor != valor.strip():
        raise MapaInvalido(f'{nome} ausente ou inválido')
    return valor


def montar_mapa_operacional(captura: dict) -> MapaOperacional:
    """Monta orientação determinística sem ler documentos históricos ou chamar modelo."""
    if not isinstance(captura, dict):
        raise MapaInvalido('captura ausente')
    cfg = captura.get('config_conteudo')
    contexto = captura.get('contexto')
    if not isinstance(cfg, dict) or not isinstance(contexto, dict):
        raise MapaInvalido('configuração ou contexto canônico ausente')
    org = cfg.get('helena-v2/organograma.yaml')
    catalogo = cfg.get('helena-v2/servicos.yaml')
    if not isinstance(org, dict) or not isinstance(catalogo, dict):
        raise MapaInvalido('organograma ou catálogo ausente da revisão')
    checkpoint = contexto.get('checkpoint')
    if (not isinstance(checkpoint, dict) or checkpoint.get('status') != 'ATIVO'
            or not checkpoint.get('checkpoint_id')
            or not isinstance(contexto.get('decisoes'), list)
            or not isinstance(contexto.get('portfolio'), list)
            or not re.fullmatch(r'[0-9a-f]{64}', str(captura.get('contexto_hash', '')))):
        raise MapaInvalido('checkpoint vigente ou fingerprint indisponível')
    agentes = org.get('agentes')
    empresas_cfg = org.get('empresas')
    servicos_cfg = catalogo.get('servicos')
    if not isinstance(agentes, list) or not isinstance(empresas_cfg, dict) or not isinstance(servicos_cfg, list):
        raise MapaInvalido('agentes, empresas ou serviços inválidos')
    identidades = {_texto(a.get('identidade'), 'identidade do agente') for a in agentes
                   if isinstance(a, dict)}
    if len(identidades) != len(agentes) or 'HELENA' not in identidades:
        raise MapaInvalido('identidades de agentes inconsistentes')
    fundador = org.get('fundador')
    if not isinstance(fundador, dict) or fundador.get('identidade') != 'FUNDADOR':
        raise MapaInvalido('identidade do fundador não confirmada na revisão')
    portfolio = contexto['portfolio']
    if any(not isinstance(p, dict) or not isinstance(p.get('business_id'), str)
           or p.get('ativo') not in ('SIM', 'NAO', 'NÃO') for p in portfolio):
        raise MapaInvalido('cadastros do portfolio inválidos')
    ids_portfolio = [p['business_id'] for p in portfolio]
    if len(ids_portfolio) != len(set(ids_portfolio)):
        raise MapaInvalido('cadastros de empresa duplicados')
    ativos = {p['business_id'] for p in portfolio if p['ativo'] == 'SIM'}
    empresas: list[EmpresaMapa] = []
    if any(not isinstance(codigo, str) for codigo in empresas_cfg):
        raise MapaInvalido('códigos de empresa inválidos')
    for codigo, empresa in sorted(empresas_cfg.items()):
        if not isinstance(empresa, dict) or not isinstance(empresa.get('pacote'), dict):
            raise MapaInvalido('empresa ou pacote inválido')
        nome = _texto(empresa.get('nome'), 'nome de empresa')
        if empresa['pacote'].get('estado') not in ('CONFIRMADO', 'NAO_CONFIRMADO'):
            raise MapaInvalido('estado do pacote empresarial inválido')
        if empresa['pacote'].get('estado') == 'CONFIRMADO' and codigo in ativos:
            empresas.append({'id': codigo, 'nome': nome})
    empresas_ativas = {e['id'] for e in empresas}
    servicos: list[ServicoMapa] = []
    ids_servicos: set[str] = set()
    for servico in servicos_cfg:
        if not isinstance(servico, dict):
            raise MapaInvalido('serviço inválido')
        codigo = _texto(servico.get('id'), 'id do serviço')
        estado = _texto(servico.get('estado'), 'estado do serviço')
        dono = _texto(servico.get('dono'), 'dono do serviço')
        revisor = _texto(servico.get('revisor'), 'revisor do serviço')
        empresas_do_servico = servico.get('empresas')
        if (codigo in ids_servicos or estado not in ESTADOS_SERVICO
                or dono not in identidades or revisor not in identidades
                or dono == revisor or not isinstance(empresas_do_servico, list)
                or any(not isinstance(e, str) or (e not in empresas_cfg and e != 'PESSOAL')
                       for e in empresas_do_servico)):
            raise MapaInvalido(f'contrato inválido do serviço {codigo}')
        ids_servicos.add(codigo)
        operacionais = sorted(empresas_ativas.intersection(empresas_do_servico)) if estado in ('ESTAGIO', 'ATIVO') else []
        servicos.append({'id': codigo, 'estado': estado, 'dono': dono,
                         'revisor_titular': revisor, 'empresas_operacionais': operacionais})
    revisao = _texto(captura.get('config_revision_id'), 'revisão')
    return {
        'origem': {'revisao': revisao, 'checkpoint': str(checkpoint['checkpoint_id']),
                   'contexto_hash': captura['contexto_hash']},
        'rotas': ROTAS.copy(),
        'fontes_de_dados': {
            'catalogo': 'revisão capturada: helena-v2/organograma.yaml + helena-v2/servicos.yaml',
            'fatos': 'checkpoint ATIVO e decisões vigentes do claim; contexto_hash revalidado pelo banco',
            'cadastros': 'portfolio do claim; pacote empresarial CONFIRMADO na revisão',
            'pedido': 'helena_v2.pedido_entrada + pedido_entrada_evento',
            'proposta': 'pedido_entrada_resposta_bruta + pedido_entrada_proposta',
            'plano': 'pedido_entrada_plano; confirmação RPC autenticada do fundador',
            'execucao': 'helena_v2.card + etapa + entrega + historico; motor aplica passagens',
            'publicacao': 'helena_v2.publicacoes; estado de publicação separado do card',
            'modulos_negocio': 'leituras públicas por negócio autorizado e RLS; nunca substituir fontes helena_v2',
        },
        'empresas_operacionais': empresas,
        'servicos': sorted(servicos, key=lambda s: s['id']),
        'fluxo': ['pedido:RECEBIDO', 'proposta:PERGUNTAR|PROPOR',
                  'plano:PLANO_CONFIRMADO (fundador autenticado)',
                  'pedido:CARD_CRIADO', 'card:PRONTO (motor)',
                  'publicacao:PEDIDA|EM_EXECUCAO|PUBLICADA|FALHOU|REVERTIDA (fluxo separado)'],
        'regras': [
            'Helena propõe; o fundador autenticado confirma plano, prioridade e ações externas.',
            'Dono e revisor titular vêm do catálogo; aptidão e plano efetivo são validados pelo motor.',
            'Serviços RASCUNHO/EM_TESTE/PAUSADO/APOSENTADO não recebem card real.',
            'Empresa requer pacote CONFIRMADO na revisão e cadastro ativo no portfolio.',
            'Checkpoint e decisões vigentes contextualizam fatos; portfolio é cadastro, não prova dos fatos.',
            'Sem fonte verificável para Parecer/FON-LEIS, proposta dependente não é executável.',
            'PRONTO é estado do card; PUBLICADA exige transição separada em publicacoes.',
            'Rotas do site orientam navegação, não concedem acesso; sessão, papel, ACL e RLS filtram dados.',
            'Telas de negócio e módulos genéricos não ativam agent_jobs, integrações ou serviços legados.',
            'Estado configurado, vínculo Telegram e card cadastrado não comprovam runtime operacional.',
        ],
    }
