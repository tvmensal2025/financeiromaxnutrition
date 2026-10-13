"""Provas locais do contrato da fonte; nenhum teste abre rede."""

import json

import pytest

from orquestrador.fonte_supabase import FonteSupabase, FonteSupabaseErro, PROJECT_REF


class Resposta:
    status = 200

    def __init__(self, value):
        self.value = json.dumps(value).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, limit):
        return self.value[:limit]


class Transporte:
    def __init__(self, *, tarefa_business='BIZ-003', job_status='COMPLETED',
                 job_business='BIZ-003', decisao_status='VIGENTE', projeto=PROJECT_REF,
                 tarefa_status='NÃO INICIADA', portfolio_ativo='SIM', approval_status='APPROVED',
                 reviewed_by='Helena', reviewer_agent_id='AGT-03', quality=True,
                 inspected_refs=None, maior_versao=36):
        self.calls = []
        self.tarefa_business = tarefa_business
        self.job_status = job_status
        self.job_business = job_business
        self.decisao_status = decisao_status
        self.projeto = projeto
        self.tarefa_status = tarefa_status
        self.portfolio_ativo = portfolio_ativo
        self.approval_status = approval_status
        self.reviewed_by = reviewed_by
        self.reviewer_agent_id = reviewer_agent_id
        self.quality = quality
        self.inspected_refs = inspected_refs if inspected_refs is not None else ['storage://evidence/1']
        self.maior_versao = maior_versao

    def __call__(self, request, timeout):
        self.calls.append((request.full_url, request.get_method(), request.data, timeout))
        if request.get_method() == 'GET':
            return Resposta({'id': self.projeto, 'ref': self.projeto})
        body = json.loads(request.data)
        assert body['read_only'] is True
        assert body['query'].startswith(
            'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;\nWITH checkpoint AS MATERIALIZED ')
        assert body['query'].endswith(';\nCOMMIT;')
        query = body['query']
        assert 'public.checkpoint_mestre_atual' in query
        assert 'public.tarefas AS origem' in query
        assert 'SELECT *' not in query.upper()
        job = {'job_id': 'JOB-1', 'task_id': 'TASK-OTHER',
                              'business_id': self.job_business, 'agent_id': 'AGT-11',
                              'status': 'COMPLETED', 'approval_status': self.approval_status,
                              'result_payload': {'draft': True, 'review_pending': False,
                                                 'reviewed_by': self.reviewed_by,
                                                 'reviewer_agent_id': self.reviewer_agent_id,
                                                 'quality_review': {'requirements_met': self.quality,
                                                                    'inspected_evidence_refs': self.inspected_refs}},
                              'result_summary': 'Pesquisa', 'evidence_refs': ['storage://evidence/1'],
                              'updated_at': '2026-10-13'}
        tarefa = {'task_id': 'TASK-1', 'business_id': self.tarefa_business,
                              'tarefa': 'Fazer trabalho', 'status': self.tarefa_status,
                              'row_version': 9, 'prazo': None, 'criado_em': '2026-10-01',
                              'negocio': 'Mimix', 'estagio': 'OPERAÇÃO', 'ativo': self.portfolio_ativo,
                              'publico': 'Adultos', 'portfolio_row_version': 8,
                              'brand_identity': {'logo_url': 'https://example.test/logo.png'}}
        decisao = {'decision_id': 'DEC-024', 'decisao': 'Vigente',
                   'row_version': 4, 'status': self.decisao_status, 'business_id': None}
        return Resposta([{'snapshot': {
            'checkpoint': [{'checkpoint_id': 'CP-36', 'versao': 36, 'status': 'ATIVO'}],
            'checkpoint_integridade': {'ativos': 1, 'maior_versao': self.maior_versao},
            'tarefas': [tarefa],
            'decisoes': [decisao] if self.decisao_status in ('ATIVO', 'ATIVA', 'VIGENTE')
                        and "IN (NULL)" not in query else [],
            'jobs': [job] if self.job_status == 'COMPLETED' and self.job_business == self.tarefa_business
                    and self.approval_status == 'APPROVED'
                    and "IN (NULL)" not in query else [],
        }}])


@pytest.fixture(autouse=True)
def token_falso(monkeypatch):
    monkeypatch.setenv('SUPABASE_ACCESS_TOKEN', 'token-apenas-do-teste')


def _plano():
    return {'decisoes': ['DEC-024'], 'entradas_externas': {'pesquisa': 'JOB-1'}}


def test_carrega_checkpoint_primeiro_e_contexto_com_proveniencia():
    transporte = Transporte()
    obs = FonteSupabase(transporte=transporte).carregar_tarefa('TASK-1', _plano())
    assert [url.rsplit('/', 1)[-1] for url, _, _, _ in transporte.calls] == [PROJECT_REF, 'query']
    assert obs['fonte'] == 'management_read_only'
    assert obs['tarefa']['business_id'] == 'BIZ-003'
    assert obs['decisoes'][0]['row_version'] == 4
    assert obs['entradas_externas']['pesquisa']['result_payload']['draft'] is True
    assert obs['tarefa']['prazo'] is None
    assert obs['empresa']['ativo'] == 'SIM'
    assert obs['proveniencia']['tarefa']['row_version'] == 9
    assert obs['proveniencia']['entradas_externas'][0]['hash_sha256']
    import hashlib
    observacao_sem_proveniencia = {k: v for k, v in obs.items() if k != 'proveniencia'}
    esperado = hashlib.sha256(json.dumps(observacao_sem_proveniencia, ensure_ascii=False,
                                         sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    assert obs['proveniencia']['hash_sha256'] == esperado
    assert 'aprovado' not in obs and 'fundador_autorizado' not in obs
    assert all('token-apenas-do-teste' not in str(call) for call in transporte.calls)


@pytest.mark.parametrize('opcao', [
    {'projeto': 'outro-projeto'},
    {'job_status': 'DRAFT'},
    {'job_business': 'BIZ-999'},
    {'decisao_status': 'SUPERADO'},
])
def test_recusa_identidade_e_fontes_invalidas(opcao):
    with pytest.raises(FonteSupabaseErro):
        FonteSupabase(transporte=Transporte(**opcao)).carregar_tarefa('TASK-1', _plano())


def test_ids_maliciosos_e_ausencias_falham_antes_de_http():
    transporte = Transporte()
    fonte = FonteSupabase(transporte=transporte)
    for task_id, plano in [
        ("TASK-1'; DROP TABLE public.tarefas;--", _plano()),
        ('TASK-1', {'decisoes': [], 'entradas_externas': {'x': "JOB';--"}}),
        ('TASK-1', {'entradas_externas': {}}),
    ]:
        with pytest.raises(FonteSupabaseErro):
            fonte.carregar_tarefa(task_id, plano)
    assert transporte.calls == []


def test_sem_token_nao_conecta(monkeypatch):
    monkeypatch.delenv('SUPABASE_ACCESS_TOKEN')
    transporte = Transporte()
    with pytest.raises(FonteSupabaseErro, match='SUPABASE NÃO CONECTADO'):
        FonteSupabase(transporte=transporte).carregar_tarefa('TASK-1', _plano())
    assert transporte.calls == []


def test_sem_entradas_externas_nao_inventa_jobs():
    transporte = Transporte()
    obs = FonteSupabase(transporte=transporte).carregar_tarefa(
        'TASK-1', {'decisoes': [], 'entradas_externas': {}})
    assert obs['decisoes'] == []
    assert obs['entradas_externas'] == {}
    assert len(transporte.calls) == 2


def test_empresa_do_card_precisa_pertencer_ao_plano():
    transporte = Transporte()
    plano = _plano() | {'empresas': ['BIZ-999']}
    with pytest.raises(FonteSupabaseErro, match='empresa da tarefa'):
        FonteSupabase(transporte=transporte).carregar_tarefa('TASK-1', plano)
    assert len(transporte.calls) == 2  # identidade e um snapshot consistente


@pytest.mark.parametrize('opcao', [
    {'tarefa_status': 'CONCLUÍDA'},
    {'tarefa_status': 'BLOQUEADA'},
    {'portfolio_ativo': 'NÃO'},
    {'maior_versao': 37},
    {'approval_status': 'PENDING'},
    {'reviewer_agent_id': 'AGT-11'},
    {'reviewer_agent_id': ''},
    {'reviewed_by': ''},
    {'quality': False},
    {'inspected_refs': ['storage://evidence/outra']},
])
def test_estado_e_revisao_documental_bloqueiam_reuso(opcao):
    with pytest.raises(FonteSupabaseErro):
        FonteSupabase(transporte=Transporte(**opcao)).carregar_tarefa('TASK-1', _plano())


def test_consulta_sql_aceita_http_201_observado_na_api_real():
    transporte = Transporte()
    def resposta_201(request, timeout):
        resposta = transporte(request, timeout)
        if request.get_method() == 'POST':
            resposta.status = 201
        return resposta
    captura = FonteSupabase(transporte=resposta_201).carregar_tarefa('TASK-1', _plano())
    assert captura['tarefa']['task_id'] == 'TASK-1'
