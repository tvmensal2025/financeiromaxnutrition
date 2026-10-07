"""Bounded runtime policy; no inference, permissions or attempt changes."""

# Professional toolsets per role (founder-approved 2026-10-07). Read-only research
# (web) and image inspection (vision) only: no terminal, file, browser or code
# execution, because this container also holds every profile's gateway token.
_ROLE_TOOLSETS = {
    'helena': ('vision',), 'marina': (), 'augusto': ('web', 'vision'), 'caio': (),
    'clara': ('web',), 'bianca': (), 'daniel': (), 'theo': ('web',), 'nina': ('web', 'vision'),
    'ravi': ('web',), 'maya': ('vision',), 'bruno': ('web', 'vision'), 'olivia': (),
    'victor': ('web',), 'camila': ('web',), 'isabela': ('web',), 'pedro': ('web',),
    'renata': ('web',), 'joana': ('web',), 'felipe': (), 'laura': (),
}


def toolsets_for(profile):
    """Gateway tools first, then role tools; every agent can read its installed skills."""
    agent = str(profile).split('--', 1)[0]
    names = ['helena_operacao']
    if profile == 'maya--biz003':
        names.append('helena_visual')
    names.append('helena_contracts')
    names += ['skills', 'todo', *_ROLE_TOOLSETS.get(agent, ())]
    return ','.join(names)


def execution_timeout(profile, model, correction_model):
    if profile == 'maya--biz003':
        return 900  # Existing bounded image-generation allowance.
    if model and model == correction_model:
        return 600  # Advanced correction must not inherit the five-minute fast tier.
    return 600  # Text tier raised from 300 s after host-load timeouts (2026-10-07).


def coordination_blocker(detail):
    """Do not pay again to rewrite a corrected brief with unchanged missing inputs."""
    job = detail.get('job') or {}
    result = job.get('result_payload') or {}
    history = result.get('brief_revision_history') or []
    latest = history[-1] if history else {}
    if (job.get('status') == 'DRAFT' and detail.get('input_evidence_missing')
            and result.get('reviewed_by') and result.get('review_reason')
            and latest.get('reviewed_by') == result['reviewed_by']
            and latest.get('review_reason') == result['review_reason']):
        return 'CORRECTED_BRIEF_INPUTS_UNAVAILABLE'
    return None
