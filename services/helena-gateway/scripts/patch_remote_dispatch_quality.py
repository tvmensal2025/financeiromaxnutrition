"""Upgrade only prompt instructions in the existing dispatcher; never runs jobs."""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil

PATCHES = [
    (
        '        "Como primeira acao, chame helena_operacao.get_work_context e, em seguida, get_job. "',
        '\n'.join([
            '        "Leia company_identity em get_job e respeite a empresa, publico, oferta, voz, canais e restricoes. "',
            '        "Leia agent_quality_contract e cumpra os insumos, entregaveis, verificacoes e limites da sua funcao; "',
            '        "o contrato nao concede permissao nem substitui o briefing. Fatos, hipoteses e pendencias devem ser separados. "',
            '        "Para design, exija identidade APPROVED, logo autorizado e cores registradas. "',
            '        "No direcao-arte, brand_version deve ser a row_version da empresa e logo_asset o logo cadastrado. "',
        ]),
    ),
    (
        '        "Registre marcos reais em record_progress, memoria e fonte em record_memory e entregue com submit_delivery "',
        '\n'.join([
            '        "incluindo delivery: schema_version=1, title, content utilizavel sem dados internos, next_steps, limitations "',
            '        "e acceptance_checks (criterion, evidence_ref da entrega, finding concreto). A aprovacao independente "',
            '        "exige quality_review comparando todas as evidencias e criterios ao pedido completo. "',
            '        "separando resumo interno de material publico. Para artes, envie publication com title, caption pronta, "',
            '        "strategy, instructions e alt_text. Leia direcao-arte: empresa, publico, fontes, personagem/produto, "',
            '        "cena, enquadramento, tipografia, cores, copy exata e CTA. Nunca entregue apenas molduras. "',
            '        "Se o briefing exige foto ou imagem gerada e a ferramenta nao estiver disponivel, registre "',
            '        "bloqueio especifico; nao substitua por layout vazio nem declare qualidade visual sem ver o PNG. "',
        ]),
    ),
]


def patched(text):
    ast.parse(text)
    additions = [(''.join(ast.literal_eval(line.strip()) for line in addition.splitlines()))
                 for _, addition in PATCHES]
    present = [all(ast.literal_eval(line.strip()) in text for line in addition.splitlines())
               for _, addition in PATCHES]
    if all(present):
        return text
    if any(present) or 'agent_quality_contract' in text or 'incluindo delivery:' in text:
        raise ValueError('PARTIAL_OR_DIFFERENT_PROTOCOL: inspect before changing')
    anchors = [ast.literal_eval(anchor.strip()) for anchor, _ in PATCHES]
    for anchor in anchors:
        if text.count(anchor) != 1:
            raise ValueError('DISPATCHER_DIVERGENCE: expected one prompt anchor')
    result = text
    for anchor, addition in zip(anchors, additions):
        # Insert within the existing literal, regardless of adjacent-line wrapping.
        result = result.replace(anchor, anchor + json.dumps(addition)[1:-1], 1)
    ast.parse(result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', type=Path, default=Path('/data/helena-runtime/hermes_dispatch_once.py'))
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    target = args.target.resolve(strict=True)
    old = target.read_bytes()
    text = old.decode('utf-8').replace('\r\n', '\n')
    result = patched(text)
    new = result.replace('\n', '\r\n').encode() if b'\r\n' in old else result.encode()
    backup = None
    if new != old and args.apply:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = target.with_name(target.name + '.quality-backup-' + stamp)
        shutil.copy2(target, backup)
        temporary = target.with_name(target.name + '.quality-new')
        temporary.write_bytes(new)
        shutil.copymode(target, temporary)
        temporary.replace(target)
    receipt = {'status': 'UNCHANGED' if old == new else ('APPLIED' if args.apply else 'PREFLIGHT'),
               'target': str(target), 'backup': str(backup) if backup else None,
               'before_sha256': hashlib.sha256(old).hexdigest(),
               'after_sha256': hashlib.sha256(new).hexdigest(),
               'changes': 'PROMPT_ONLY', 'ai_calls': 0, 'secrets_printed': False}
    if args.apply:
        target.with_name('dispatch-quality-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
