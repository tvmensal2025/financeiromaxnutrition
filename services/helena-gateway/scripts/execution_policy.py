"""Bounded runtime policy; no inference, permissions or attempt changes."""


def execution_timeout(profile, model, correction_model):
    if profile == 'maya--biz003':
        return 900  # Existing bounded image-generation allowance.
    if model and model == correction_model:
        return 600  # Advanced correction must not inherit the five-minute fast tier.
    return 300


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
