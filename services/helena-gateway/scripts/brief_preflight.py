"""Pure advisory MCP tool: no files, network, credentials, writes or model calls."""
import json
import math
import re

SECTIONS = ('Contexto e fontes', 'Objetivo e impacto', 'Escopo e limites',
            'Plano de trabalho', 'Entregáveis', 'Critérios de pronto',
            'Evidências e registro', 'Revisão e encaminhamento')

BRIEF_LIMITS = {
    'instruction': {'min': 700, 'target': 6000, 'max': 7000, 'transport_max': 8000},
    'objective': {'min': 1, 'target': 280, 'max': 350, 'transport_max': 400},
    'definition_of_done': {'min': 1, 'target': 2400, 'max': 3000, 'transport_max': 4000},
}


def utf16_length(value):
    # Match JavaScript/Zod length, including two units for emoji.
    return len(value.encode('utf-16-le', errors='surrogatepass')) // 2


# Mirror src/creative-brief.mjs. The parity test exercises both runtimes against
# the same candidates. No input values are echoed in errors.
CREATIVE_DESCRIPTIONS = ('audience', 'objective', 'subject', 'scene', 'composition',
                        'typography', 'palette', 'exact_copy', 'cta', 'constraints', 'review')
CREATIVE_METHODS = ('GENERATED_IMAGE', 'LICENSED_PHOTO', 'ORIGINAL_ILLUSTRATION')
CREATIVE_FORMATS = ('post', 'story-1', 'story-2', 'story-3')


def creative_schema_errors(creative):
    errors = []

    def error(field, code, **details):
        errors.append({'field': 'direcao-arte.' + field, 'code': code, **details})

    def string(field, value, low, high):
        if not isinstance(value, str):
            error(field, 'STRING_REQUIRED', min=low, max=high)
        elif not low <= utf16_length(value.strip()) <= high:
            error(field, 'SIZE', min=low, max=high, actual=utf16_length(value.strip()))

    allowed = set(CREATIVE_DESCRIPTIONS) | {'business_id', 'brand', 'brand_version',
               'logo_asset', 'verified_facts', 'sources', 'imagery_method', 'formats'}
    for field in sorted(set(creative) - allowed):
        error(field, 'UNKNOWN_FIELD')
    business = creative.get('business_id')
    if not isinstance(business, str) or not re.fullmatch(r'BIZ-[0-9]{3}', business):
        error('business_id', 'BUSINESS_ID_REQUIRED')
    string('brand', creative.get('brand'), 2, 100)
    string('logo_asset', creative.get('logo_asset'), 8, 1000)
    version = creative.get('brand_version')
    if (isinstance(version, bool) or not isinstance(version, (int, float)) or
            (isinstance(version, float) and not math.isfinite(version)) or
            version <= 0 or version != int(version)):
        error('brand_version', 'POSITIVE_INTEGER_REQUIRED')
    for field in CREATIVE_DESCRIPTIONS:
        string(field, creative.get(field), 15, 1200)
    for field, low, high in [('verified_facts', 15, 1200), ('sources', 8, 500)]:
        items = creative.get(field)
        if not isinstance(items, list):
            error(field, 'ARRAY_REQUIRED', min=1, max=8)
        else:
            if not 1 <= len(items) <= 8:
                error(field, 'ARRAY_SIZE', min=1, max=8)
            for index, value in enumerate(items):
                string(f'{field}.{index}', value, low, high)
    if creative.get('imagery_method') not in CREATIVE_METHODS:
        error('imagery_method', 'ENUM', allowed=list(CREATIVE_METHODS))
    formats = creative.get('formats')
    if not isinstance(formats, list):
        error('formats', 'ARRAY_REQUIRED', min=1, max=4)
    else:
        if not 1 <= len(formats) <= 4:
            error('formats', 'ARRAY_SIZE', min=1, max=4)
        for index, value in enumerate(formats):
            if value not in CREATIVE_FORMATS:
                error(f'formats.{index}', 'ENUM', allowed=list(CREATIVE_FORMATS))
        if len({json.dumps(v, sort_keys=True) for v in formats}) != len(formats):
            error('formats', 'DUPLICATED_FORMAT')
    return errors


def check_task_brief(instruction: str, objective: str, definition_of_done: str,
                     for_design: bool = False, protected_texts: list[str] | None = None) -> dict:
    """Check size/sections/JSON before create_task_job or handoff_task.

    For design, instruction must contain ONE fenced direcao-arte JSON object.
    Exact allowed fields (no extra keys): business_id (BIZ-NNN), brand (2..100
    chars), brand_version (positive integer), logo_asset (8..1000 chars),
    audience, objective, subject, scene, composition, typography, palette,
    exact_copy, cta, constraints, review (each a STRING of 15..1200 chars),
    verified_facts (1..8 strings of 15..1200 chars), sources (1..8 strings of
    8..500 chars), imagery_method (GENERATED_IMAGE, LICENSED_PHOTO or
    ORIGINAL_ILLUSTRATION), formats (1..4 unique slots: post, story-1, story-2,
    story-3). Include literal copy for each requested slot in exact_copy.
    Do not invent a pieces/logo/colors object or use story as a slot.
    Brand identity, permissions and evidence approvals are checked by Gateway.

    Does not compress, authorize, create, release or validate current business state.
    protected_texts are exact copy segments that must survive editorial compression.
    Gateway schemas and canonical permissions remain authoritative.
    """
    errors = []
    sizes = {key: utf16_length(value.strip()) for key, value in
             [('instruction', instruction), ('objective', objective), ('definition_of_done', definition_of_done)]}
    for key, limits in BRIEF_LIMITS.items():
        low, high = limits['min'], limits['max']
        if not low <= sizes[key] <= high:
            errors.append({'field': key, 'code': 'SIZE', 'actual': sizes[key], 'min': low, 'max': high})
    # Bound further processing and never echo the input in the response.
    if sizes['instruction'] > 65536:
        return {'status': 'CORRECT_BEFORE_SUBMIT', 'sizes': sizes, 'errors': errors, 'model_calls': 0}
    positions = []
    for title in SECTIONS:
        matches = list(re.finditer(r'^## ' + re.escape(title) + r'\r?$', instruction, re.I | re.M))
        if len(matches) != 1:
            errors.append({'field': title, 'code': 'SECTION_MISSING_OR_DUPLICATED'})
        else:
            positions.append((title, matches[0].start(), matches[0].end()))
    if len(positions) == len(SECTIONS):
        for index, (title, start, end) in enumerate(positions):
            stop = positions[index + 1][1] if index + 1 < len(positions) else len(instruction)
            if stop <= start or len(instruction[end:stop].strip()) < 40:
                errors.append({'field': title, 'code': 'SECTION_ORDER_OR_CONTENT'})
    blocks = re.findall(r'```direcao-arte\s*\n([\s\S]*?)```', instruction)
    creative = None
    if for_design or blocks:
        if len(blocks) != 1:
            errors.append({'field': 'direcao-arte', 'code': 'ONE_JSON_BLOCK_REQUIRED'})
        else:
            try:
                creative = json.loads(blocks[0])
                if not isinstance(creative, dict):
                    raise ValueError('Object required')
                errors.extend(creative_schema_errors(creative))
            except (json.JSONDecodeError, ValueError):
                creative = None
                errors.append({'field': 'direcao-arte', 'code': 'INVALID_JSON'})
    searchable = instruction + ('\n' + str(creative.get('exact_copy', '')) if creative else '')
    if len(protected_texts or []) > 32:
        errors.append({'field': 'protected_texts', 'code': 'TOO_MANY', 'max': 32})
    elif any(not text or text not in searchable for text in protected_texts or []):
        errors.append({'field': 'protected_texts', 'code': 'EXACT_COPY_MISSING'})
    return {'status': 'CORRECT_BEFORE_SUBMIT' if errors else 'TECHNICAL_CHECK_PASSED',
            'sizes': sizes, 'errors': errors, 'recommended_instruction_max': 6000,
            'limits': BRIEF_LIMITS,
            'remaining': {key: limits['max'] - sizes[key] for key, limits in BRIEF_LIMITS.items()},
            'recovery': 'Reescreva repeticoes e use fontes acessiveis; preserve copy e requisitos. Nunca trunque. Revalide antes de enviar.',
            'gateway_validation_still_required': True, 'model_calls': 0}


if __name__ == '__main__':
    from mcp.server import MCPServer
    server = MCPServer('helena_contracts')
    server.tool()(check_task_brief)
    server.run(transport='stdio')
