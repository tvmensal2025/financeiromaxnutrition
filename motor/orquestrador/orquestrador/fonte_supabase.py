"""Observação somente leitura do Supabase canônico via Management API.

O PAT é uma credencial do servidor, não uma identidade de usuário do aplicativo.
Este módulo não autoriza cards nem executa jobs; a rota Auth deve decidir isso.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


PROJECT_REF = 'wxkgrykduqtsgmjkzlou'
BASE_URL = 'https://api.supabase.com/v1/projects/' + PROJECT_REF
_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}\Z')
_MAX_BODY = 2_000_000
_MAX_JOBS = 20
_MAX_DECISIONS = 20


class ErroFonteSupabase(RuntimeError):
    """Falha segura de leitura; nunca contém URL, SQL, resposta ou token."""


FonteSupabaseErro = ErroFonteSupabase


class _SemRedirecionamento(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise FonteSupabaseErro('redirecionamento da Management API recusado')


def _transporte_padrao(request: Request, timeout: float):
    # urllib preserva proxy e certificados do ambiente; não desabilitar TLS.
    return build_opener(_SemRedirecionamento()).open(request, timeout=timeout)


def _identificador(value: object, campo: str) -> str:
    if not isinstance(value, str) or not _ID.fullmatch(value):
        raise FonteSupabaseErro(f'{campo} inválido')
    return value


def _literal(value: str) -> str:
    # Identificadores são validados antes; o literal ainda é escapado por defesa.
    return "'" + value.replace("'", "''") + "'"


def _linhas(payload: object) -> list[dict]:
    # A API devolve uma lista de linhas; aceita envelope de resultado para
    # transportes compatíveis. Nunca interpreta COMMIT como dado de negócio.
    if isinstance(payload, dict):
        payload = payload.get('result', payload.get('rows'))
    if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
        raise FonteSupabaseErro('resposta SQL da Management API inválida')
    return payload


def _digest(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'),
                     allow_nan=False).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


class FonteSupabase:
    """Cliente server-side com transporte injetável para testes sem rede."""

    def __init__(self, *, transporte=None, prazo_segundos: float = 20):
        if not 1 <= prazo_segundos <= 60:
            raise ValueError('prazo_segundos fora do intervalo permitido')
        self._transporte = transporte or _transporte_padrao
        self._prazo = prazo_segundos

    def _requisitar(self, path: str, token: str, deadline: float, body: dict | None = None):
        restante = deadline - time.monotonic()
        if restante <= 0:
            raise FonteSupabaseErro('prazo da observação esgotado')
        data = json.dumps(body, separators=(',', ':')).encode() if body is not None else None
        request = Request(BASE_URL + path, data=data,
                          headers={'Authorization': 'Bearer ' + token,
                                   'Accept': 'application/json', 'Content-Type': 'application/json'},
                          method='POST' if data is not None else 'GET')
        try:
            with self._transporte(request, min(restante, 8)) as response:
                if response.status != 200:
                    raise FonteSupabaseErro(f'Management API respondeu HTTP {response.status}')
                raw = response.read(_MAX_BODY + 1)
        except FonteSupabaseErro:
            raise
        except HTTPError as exc:
            raise FonteSupabaseErro(f'Management API respondeu HTTP {exc.code}') from None
        except (URLError, TimeoutError, OSError):
            raise FonteSupabaseErro('Management API indisponível') from None
        if len(raw) > _MAX_BODY:
            raise FonteSupabaseErro('resposta da Management API excede limite')
        try:
            return json.loads(raw)
        except (UnicodeError, ValueError):
            raise FonteSupabaseErro('JSON da Management API inválido') from None

    def _consultar(self, select: str, token: str, deadline: float) -> list[dict]:
        # Um único SELECT agrega tudo no mesmo snapshot MVCC.
        if not select.startswith('WITH checkpoint AS MATERIALIZED ') or ';' in select:
            raise FonteSupabaseErro('consulta fora da allowlist')
        query = 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;\n' + select + ';\nCOMMIT;'
        return _linhas(self._requisitar('/database/query', token, deadline,
                                        {'query': query, 'read_only': True}))

    def carregar_tarefa(self, task_id: str, plano: dict) -> dict:
        """Lê checkpoint, tarefa, decisões e entradas externas sem criar estado.

        `plano['decisoes']` é lista de IDs; `entradas_externas` mapeia rótulos
        do plano para IDs de jobs já concluídos. Ausência de decisão/job não é
        substituída por dados exemplificativos.
        """
        task_id = _identificador(task_id, 'task_id')
        if not isinstance(plano, dict):
            raise FonteSupabaseErro('plano inválido')
        decisoes = plano.get('decisoes')
        entradas = plano.get('entradas_externas')
        if not isinstance(decisoes, list) or not isinstance(entradas, dict):
            raise FonteSupabaseErro('plano exige decisoes e entradas_externas explícitas')
        if len(decisoes) > _MAX_DECISIONS or len(entradas) > _MAX_JOBS:
            raise FonteSupabaseErro('plano excede limite de fontes')
        decisoes = [_identificador(x, 'decision_id') for x in decisoes]
        entradas = {_identificador(k, 'rótulo de entrada'): _identificador(v, 'job_id')
                    for k, v in entradas.items()}
        if len(set(decisoes)) != len(decisoes) or len(set(entradas.values())) != len(entradas):
            raise FonteSupabaseErro('IDs de fontes repetidos')
        token = os.environ.get('SUPABASE_ACCESS_TOKEN')
        if not token or any(c in token for c in '\r\n'):
            raise FonteSupabaseErro('SUPABASE NÃO CONECTADO — não é possível carregar o Sistema Helena com segurança.')
        deadline = time.monotonic() + self._prazo
        project = self._requisitar('', token, deadline)
        if not isinstance(project, dict) or project.get('id', project.get('ref')) != PROJECT_REF:
            raise FonteSupabaseErro('identidade do projeto Supabase divergente')
        if project.get('ref', PROJECT_REF) != PROJECT_REF:
            raise FonteSupabaseErro('identidade do projeto Supabase divergente')

        decision_filter = ','.join(_literal(x) for x in decisoes) if decisoes else 'NULL'
        job_filter = ','.join(_literal(x) for x in entradas.values()) if entradas else 'NULL'
        select = (
            'WITH checkpoint AS MATERIALIZED ('
            'SELECT checkpoint_id,versao,status,resumo_executivo,validado_em,atualizado_em,'
            'checkpoint_anterior_id FROM public.checkpoint_mestre_atual LIMIT 2), '
            'checkpoint_integridade AS MATERIALIZED ('
            "SELECT count(*) FILTER (WHERE status='ATIVO') AS ativos, max(versao) AS maior_versao "
            'FROM public.checkpoint_mestre), '
            'tarefa AS MATERIALIZED ('
            'SELECT t.task_id,t.business_id,t.tarefa,t.status,t.prioridade,t.prazo,'
            't.definicao_de_pronto,t.row_version,t.criado_em,t.atualizado_em,'
            'p.negocio,p.estagio,p.ativo,p.publico,p.row_version AS portfolio_row_version,'
            'p.brand_identity FROM public.tarefas AS t '
            'JOIN public.portfolio AS p ON p.business_id=t.business_id '
            f'WHERE t.task_id={_literal(task_id)} LIMIT 2), '
            'decisoes AS MATERIALIZED ('
            'SELECT d.decision_id,d.decisao,d.row_version,d.status,d.business_id '
            'FROM public.decisoes AS d '
            f"WHERE d.decision_id IN ({decision_filter}) AND d.status IN ('ATIVO','ATIVA','VIGENTE') "
            'AND (d.business_id IS NULL OR d.business_id=(SELECT business_id FROM tarefa)) '
            f'LIMIT {_MAX_DECISIONS + 1}), '
            'jobs AS MATERIALIZED ('
            'SELECT j.job_id,j.task_id,j.business_id,j.agent_id,j.status,j.approval_status,'
            'j.result_payload,j.result_summary,j.evidence_refs,j.updated_at '
            'FROM public.agent_jobs AS j JOIN public.tarefas AS origem '
            'ON origem.task_id=j.task_id AND origem.business_id=j.business_id '
            f'WHERE j.job_id IN ({job_filter}) '
            'AND j.business_id=(SELECT business_id FROM tarefa) '
            f"AND j.status='COMPLETED' AND j.approval_status='APPROVED' LIMIT {_MAX_JOBS + 1}) "
            'SELECT jsonb_build_object('
            "'checkpoint',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM checkpoint c),'[]'::jsonb),"
            "'checkpoint_integridade',(SELECT to_jsonb(ci) FROM checkpoint_integridade ci),"
            "'tarefas',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM tarefa t),'[]'::jsonb),"
            "'decisoes',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM decisoes d),'[]'::jsonb),"
            "'jobs',COALESCE((SELECT jsonb_agg(to_jsonb(j)) FROM jobs j),'[]'::jsonb)"
            ') AS snapshot'
        )
        rows = self._consultar(select, token, deadline)
        if len(rows) != 1 or not isinstance(rows[0].get('snapshot'), dict):
            raise FonteSupabaseErro('snapshot Supabase inválido')
        snapshot = rows[0]['snapshot']
        if any(not isinstance(snapshot.get(key), list) for key in ('checkpoint', 'tarefas', 'decisoes', 'jobs')):
            raise FonteSupabaseErro('blocos do snapshot Supabase inválidos')
        checkpoint = snapshot['checkpoint']
        if len(checkpoint) != 1 or not isinstance(checkpoint[0], dict) or checkpoint[0].get('status') != 'ATIVO':
            raise FonteSupabaseErro('checkpoint mestre ativo ausente ou ambíguo')
        if not checkpoint[0].get('checkpoint_id') or checkpoint[0].get('versao') is None:
            raise FonteSupabaseErro('checkpoint mestre incompleto')
        integridade = snapshot.get('checkpoint_integridade')
        if (not isinstance(integridade, dict) or integridade.get('ativos') != 1
                or integridade.get('maior_versao') != checkpoint[0]['versao']):
            raise FonteSupabaseErro('checkpoint ativo não é a única maior versão')
        tarefas = snapshot['tarefas']
        if len(tarefas) != 1 or not isinstance(tarefas[0], dict) or tarefas[0].get('task_id') != task_id:
            raise FonteSupabaseErro('tarefa ausente, duplicada ou sem empresa no portfolio')
        linha_tarefa = tarefas[0]
        campos_empresa = ('business_id', 'negocio', 'estagio', 'ativo', 'publico',
                          'portfolio_row_version', 'brand_identity')
        if any(k not in linha_tarefa for k in campos_empresa):
            raise FonteSupabaseErro('pacote da empresa incompleto')
        portfolio = {k: linha_tarefa[k] for k in campos_empresa}
        tarefa = {k: v for k, v in linha_tarefa.items() if k not in
                  ('negocio', 'estagio', 'ativo', 'publico', 'portfolio_row_version', 'brand_identity')}
        business_id = _identificador(tarefa.get('business_id'), 'business_id')
        if portfolio['ativo'] != 'SIM' or not isinstance(portfolio['estagio'], str):
            raise FonteSupabaseErro('empresa do portfolio inativa ou estágio ausente')
        if not isinstance(portfolio['portfolio_row_version'], int):
            raise FonteSupabaseErro('versão da empresa ausente')
        if tarefa.get('status') not in ('NÃO INICIADA', 'EM EXECUÇÃO', 'ABERTO'):
            raise FonteSupabaseErro('estado da tarefa não permite novo card')
        if not isinstance(tarefa.get('row_version'), int) or 'prazo' not in tarefa or 'criado_em' not in tarefa:
            raise FonteSupabaseErro('versão, prazo ou origem da tarefa ausente')
        empresas = plano.get('empresas')
        if empresas is not None and (not isinstance(empresas, list) or business_id not in empresas):
            raise FonteSupabaseErro('empresa da tarefa não pertence ao plano')

        vigentes = snapshot['decisoes']
        if decisoes:
            obtidos = {row.get('decision_id') for row in vigentes}
            if obtidos != set(decisoes) or len(vigentes) != len(decisoes):
                raise FonteSupabaseErro('decisão vigente ausente ou fora da empresa')
            if any(row.get('status') not in ('ATIVO', 'ATIVA', 'VIGENTE')
                   or row.get('business_id') not in (None, business_id)
                   or not isinstance(row.get('decisao'), str) or not isinstance(row.get('row_version'), int)
                   for row in vigentes):
                raise FonteSupabaseErro('dados de decisão divergentes')
            vigentes = sorted(vigentes, key=lambda row: decisoes.index(row['decision_id']))
        elif vigentes:
            raise FonteSupabaseErro('decisões não solicitadas no snapshot')

        jobs = snapshot['jobs']
        if entradas:
            obtidos = {row.get('job_id') for row in jobs}
            if obtidos != set(entradas.values()) or len(jobs) != len(entradas):
                raise FonteSupabaseErro('entrada externa ausente, inconclusa ou de outra empresa')
            if any(row.get('status') != 'COMPLETED' or row.get('business_id') != business_id
                   or not isinstance(row.get('task_id'), str)
                   or not isinstance(row.get('evidence_refs'), list) for row in jobs):
                raise FonteSupabaseErro('dados de entrada externa divergentes')
            for row in jobs:
                payload = row.get('result_payload')
                quality = payload.get('quality_review') if isinstance(payload, dict) else None
                reviewer_id = payload.get('reviewer_agent_id') if isinstance(payload, dict) else None
                refs = row['evidence_refs']
                inspected = quality.get('inspected_evidence_refs') if isinstance(quality, dict) else None
                if (row.get('approval_status') != 'APPROVED' or not isinstance(payload, dict)
                        or payload.get('review_pending') is not False
                        or not isinstance(quality, dict) or quality.get('requirements_met') is not True
                        or not isinstance(row.get('agent_id'), str)
                        or not isinstance(reviewer_id, str)
                        or not re.fullmatch(r'AGT-[0-9]{2}', reviewer_id)
                        or reviewer_id == row['agent_id']
                        or not isinstance(payload.get('reviewed_by'), str)
                        or not payload['reviewed_by'].strip()
                        or not refs or any(not isinstance(ref, str) or not ref for ref in refs)
                        or not isinstance(inspected, list) or len(inspected) != len(refs)
                        or any(not isinstance(ref, str) for ref in inspected)
                        or set(inspected) != set(refs) or len(set(refs)) != len(refs)):
                    raise FonteSupabaseErro('entrada externa sem revisão documental verificável')
            jobs = sorted(jobs, key=lambda row: list(entradas.values()).index(row['job_id']))
        elif jobs:
            raise FonteSupabaseErro('jobs não solicitados no snapshot')
        por_id = {row['job_id']: row for row in jobs}
        observacao = {
            'fonte': 'management_read_only',
            'projeto': {'ref': PROJECT_REF, 'nome': project.get('name')},
            'observado_em': datetime.now(timezone.utc).isoformat(),
            'checkpoint': checkpoint[0], 'business_id': business_id, 'empresa': portfolio,
            'tarefa': tarefa,
            'decisoes': vigentes,
            'entradas_externas': {rotulo: por_id[job_id] for rotulo, job_id in entradas.items()},
        }
        observacao['proveniencia'] = {
                'hash_sha256': _digest(observacao),
                'checkpoint': {'tabela': 'public.checkpoint_mestre_atual', 'pk': checkpoint[0].get('checkpoint_id'),
                               'hash_sha256': _digest(checkpoint[0]), 'integridade': integridade},
                'tarefa': {'tabela': 'public.tarefas', 'pk': task_id,
                           'row_version': tarefa.get('row_version'), 'hash_sha256': _digest(tarefa)},
                'empresa': {'tabela': 'public.portfolio', 'pk': business_id,
                              'row_version': portfolio['portfolio_row_version'],
                              'hash_sha256': _digest(portfolio)},
                'decisoes': [{'tabela': 'public.decisoes', 'pk': x['decision_id'],
                              'row_version': x.get('row_version'), 'hash_sha256': _digest(x)} for x in vigentes],
                'entradas_externas': [{'tabela': 'public.agent_jobs', 'pk': x['job_id'],
                                       'updated_at': x.get('updated_at'), 'hash_sha256': _digest(x)} for x in jobs],
            }
        return observacao
