"""SOUL v3: bloco de regras vigentes no topo (prevalece) e remocao do Aprendizado V1 duplicado.

Uso: python3 soul_v3.py <pasta_profiles> [--apply] [--backup <pasta>]
Idempotente (marcador REGRAS_VIGENTES_V3). Sem --apply apenas simula.
"""
import os
import re
import shutil
import sys

MARKER = '## REGRAS_VIGENTES_V3'
BLOCK = MARKER + ''' (2026-10-08) - PREVALECEM sobre qualquer bloco abaixo
1. A definicao de pronto da missao prevalece sobre checklists e regras genericas.
2. Execucao: o despachante ja fez claim_job/start_job; confirme RUNNING com get_job (view=manifest). Durante a execucao nao releia checkpoint, get_work_context ou historico: use o pacote recebido.
3. Entrega: submit_work uma vez (delivery.content ate 8000; summary ate 8000; acceptance_checks so com criterion e finding, sem evidence_ref). Antes, rode check_delivery no maximo 2 vezes. Os tetos 7000/3000/350 valem so para quem escreve briefing (create_task/handoff).
4. Responsaveis por nome e funcao; codigo AGT so se a definicao de pronto pedir. IDs tecnicos (JOB/MEM/TSK, versoes) ficam no summary, nunca no material ao Fundador.
5. Ferramentas nativas web_search, web_extract e vision_analyze existem conforme a funcao e sao chamadas pelo nome (nao aparecem no tool_search).
6. Falha ou tentativas esgotadas: a coordenacao usa replan_job (substituir ate 2 vezes ou escalar ao Fundador). Nao exija prova tecnica, reproducao de falha ou Theo/Bruno para liberar substituta. Queda de infraestrutura nao consome tentativa; tempo de texto 900 s.
7. Coordenacao (Helena/Marina): registra decisoes com record_coordination_note (nao record_progress em missao de outro agente), corrige rascunho nunca executado com revise_draft_brief e libera na fase COORDINATE.
8. Revisao avalia conteudo (fatos, fontes, pecas, coerencia com o pedido); nao exige contagem de caracteres, logs, preflight ou medicao de payload.
9. Trechos sobre piloto de 27/09, configuracao em preparacao, ChatGPT/Grok, submit_delivery ou homologacao pendente sao historicos: o fluxo vigente e Hermes + Gateway + submit_work com despacho automatico.
10. Escopo: o perfil atende as empresas listadas em served_business_ids no contexto; mencoes a escopo exclusivo de uma empresa estao superadas. A empresa de cada entrega e sempre a do job, com a identidade dessa empresa.
'''


def transform(text):
    if MARKER in text:
        return text, False
    # Remove o Aprendizado V1 (duplicado pelo V2) ate o proximo cabecalho de mesmo nivel ou superior.
    text = re.sub(r'\n## APRENDIZADO_VALIDADO_V1\n.*?(?=\n## |\n# |\Z)', '\n', text, flags=re.S)
    lines = text.split('\n')
    # Insere logo apos o titulo (primeira linha "# ...").
    idx = 1 if lines and lines[0].startswith('# ') else 0
    return '\n'.join(lines[:idx] + ['', BLOCK] + lines[idx:]), True


def main():
    root = sys.argv[1]
    apply = '--apply' in sys.argv
    backup = sys.argv[sys.argv.index('--backup') + 1] if '--backup' in sys.argv else None
    changed = 0
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name, 'SOUL.md') if os.path.isdir(os.path.join(root, name)) else os.path.join(root, name)
        if not os.path.isfile(path) or not path.endswith('.md'):
            continue
        original = open(path, encoding='utf-8').read()
        updated, did = transform(original)
        if not did:
            continue
        changed += 1
        print(f'{name}: {len(original)} -> {len(updated)} caracteres, V1 removido={"APRENDIZADO_VALIDADO_V1" not in updated}')
        if apply:
            if backup:
                os.makedirs(backup, exist_ok=True)
                shutil.copy2(path, os.path.join(backup, name + '.SOUL.md'))
            stat = os.stat(path)
            open(path, 'w', encoding='utf-8').write(updated)
            os.chmod(path, stat.st_mode)
    print({'mode': 'APLICADO' if apply else 'SIMULACAO', 'changed': changed})


if __name__ == '__main__':
    main()
