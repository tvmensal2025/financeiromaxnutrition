"""Pure advisory MCP tool: no files, network, credentials, writes or model calls."""
import json
import re

SECTIONS = ('Contexto e fontes', 'Objetivo e impacto', 'Escopo e limites',
            'Plano de trabalho', 'Entregáveis', 'Critérios de pronto',
            'Evidências e registro', 'Revisão e encaminhamento')


def utf16_length(value):
    # Match JavaScript/Zod length, including two units for emoji.
    return len(value.encode('utf-16-le', errors='surrogatepass')) // 2


def check_task_brief(instruction: str, objective: str, definition_of_done: str,
                     for_design: bool = False, protected_texts: list[str] | None = None) -> dict:
    """Check size/sections/JSON before create_task_job or handoff_task.

    Does not compress, authorize, create, release or validate current business state.
    protected_texts are exact copy segments that must survive editorial compression.
    Gateway schemas and canonical permissions remain authoritative.
    """
    errors = []
    sizes = {key: utf16_length(value.strip()) for key, value in
             [('instruction', instruction), ('objective', objective), ('definition_of_done', definition_of_done)]}
    for key, low, high in [('instruction', 700, 8000), ('objective', 1, 400), ('definition_of_done', 1, 4000)]:
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
            except (json.JSONDecodeError, ValueError):
                errors.append({'field': 'direcao-arte', 'code': 'INVALID_JSON'})
    searchable = instruction + ('\n' + str(creative.get('exact_copy', '')) if creative else '')
    if len(protected_texts or []) > 32:
        errors.append({'field': 'protected_texts', 'code': 'TOO_MANY', 'max': 32})
    elif any(not text or text not in searchable for text in protected_texts or []):
        errors.append({'field': 'protected_texts', 'code': 'EXACT_COPY_MISSING'})
    return {'status': 'CORRECT_BEFORE_SUBMIT' if errors else 'TECHNICAL_CHECK_PASSED',
            'sizes': sizes, 'errors': errors, 'recommended_instruction_max': 7000,
            'gateway_validation_still_required': True, 'model_calls': 0}


if __name__ == '__main__':
    from mcp.server import MCPServer
    server = MCPServer('helena_contracts')
    server.tool()(check_task_brief)
    server.run(transport='stdio')
