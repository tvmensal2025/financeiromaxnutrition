"""Keep the Hermes visual board incapable of dispatching duplicate jobs."""

import argparse
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil

import yaml

SYSTEM = Path('/data/config.yaml')
PROFILES = Path('/data/profiles')


def prepare(path):
    original = path.read_text(encoding='utf-8')
    current = (yaml.safe_load(original) or {}).get('kanban', {})
    if current.get('dispatch_in_gateway') is not False:
        raise RuntimeError(f'Despachante ativo: {path}')
    if 'dispatch_profiles' in current:
        if current['dispatch_profiles'] != []:
            raise RuntimeError(f'Lista de despacho já configurada: {path}')
        return original
    pattern = re.compile(r'(?m)^([ \t]*)dispatch_in_gateway:[ \t]*false[ \t]*$')
    if len(pattern.findall(original)) != 1:
        raise RuntimeError(f'Não há uma âncora segura para edição: {path}')
    changed = pattern.sub(lambda m: m.group(0) + '\n' + m.group(1) + 'dispatch_profiles: []', original)
    setting = (yaml.safe_load(changed) or {}).get('kanban', {})
    if setting.get('dispatch_in_gateway') is not False or setting.get('dispatch_profiles') != []:
        raise RuntimeError(f'Validação da trava falhou: {path}')
    return changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    configs = [SYSTEM] + sorted(p / 'config.yaml' for p in PROFILES.iterdir() if p.is_dir())
    if len(configs) != 22 or any(not p.is_file() for p in configs):
        raise RuntimeError('Inventário não contém exatamente sistema + 21 perfis')
    changes = [(p, prepare(p)) for p in configs]
    pending = [(p, text) for p, text in changes if p.read_text(encoding='utf-8') != text]
    print(f'Configurações verificadas: {len(configs)}; alterações: {len(pending)}')
    if not args.apply or not pending:
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backups = []
    try:
        for path, _ in pending:
            backup = path.with_name(path.name + '.before-helena-kanban-' + stamp)
            shutil.copy2(path, backup)
            backups.append((path, backup))
        for path, updated in pending:
            temp = path.with_name(path.name + '.helena-kanban.tmp')
            temp.write_text(updated, encoding='utf-8')
            temp.replace(path)
        print(f'Trava aplicada; backups criados: {len(backups)}')
    except Exception:
        for path, backup in backups:
            shutil.copy2(backup, path)
        raise


if __name__ == '__main__':
    main()
