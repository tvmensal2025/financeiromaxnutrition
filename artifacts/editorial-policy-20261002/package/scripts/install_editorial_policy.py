"""Install the scoped editorial procedure in existing profiles; no model calls."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil

VERSION = 'helena-editorial-quality-v1'
START = '<!-- helena-editorial-quality:start -->'
END = '<!-- helena-editorial-quality:end -->'
PROFILES = ('helena--grupo', 'marina--biz003', 'camila--biz003',
            'isabela--biz003', 'maya--biz003', 'nina--biz003')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe(path, home):
    if not path.resolve().is_relative_to(home) or any(
        p.is_symlink() for p in (path, *path.parents) if p.is_relative_to(home)
    ):
        raise ValueError('UNSAFE_PATH')

def install(home, skill, apply=False, baseline=None):
    home = home.resolve(strict=True)
    content = skill.read_bytes()
    text = content.decode('utf-8')
    if not text.startswith('---\nname: helena-editorial-quality\n'):
        raise ValueError('INVALID_SKILL')
    body = text.split('---', 2)[2].strip()
    manifest_path = home / 'helena-runtime/quality-manifest.json'
    receipt_path = home / 'helena-runtime/editorial-policy-receipt.json'
    for p in (manifest_path, receipt_path):
        safe(p, home)
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    previous = json.loads(receipt_path.read_bytes()) if receipt_path.exists() else {}
    if baseline is not None and set(baseline) != set(PROFILES):
        raise ValueError('INVALID_AUDITED_BASELINE')
    accepted_hashes = baseline if baseline is not None else manifest.get('soul_hashes', {})
    drift = []
    plans, inputs, hashes = [], {manifest_path: manifest_bytes}, {}
    for slug in PROFILES:
        root = home / 'profiles' / slug
        soul = root / 'SOUL.md'
        target = root / 'skills/helena-editorial-quality/SKILL.md'
        for p in (soul, target):
            safe(p, home)
        original = soul.read_bytes()
        if digest(original) != accepted_hashes.get(slug):
            raise ValueError('SOUL_CHANGED_SINCE_VALIDATION:' + slug)
        if digest(original) != manifest.get('soul_hashes', {}).get(slug):
            drift.append(slug)
        inputs[soul] = original
        inputs[target] = target.read_bytes() if target.exists() else None
        known_hash = previous.get('skill_sha256')
        if inputs[target] not in (None, content) and digest(inputs[target]) != known_hash:
            raise ValueError('UNOWNED_SKILL_DIVERGENCE:' + slug)
        old = original.decode('utf-8')
        if old.count(START) != old.count(END) or old.count(START) > 1:
            raise ValueError('INVALID_EDITORIAL_BLOCK:' + slug)
        block = START + '\n' + body + '\n' + END
        if START in old:
            if old.index(END) < old.index(START):
                raise ValueError('INVALID_EDITORIAL_BLOCK:' + slug)
            updated = old[:old.index(START)] + block + old[old.index(END)+len(END):]
        else:
            updated = old.rstrip() + '\n\n' + block + '\n'
        data = updated.encode('utf-8')
        hashes[slug] = digest(data)
        plans.extend(((soul, data), (target, content)))
    changed = [(p, data) for p, data in plans if inputs[p] != data]
    result = dict(version=VERSION, profiles=list(PROFILES), changed_files=len(changed),
                  skill_sha256=digest(content), ai_calls=0, real_campaign_tested=False)
    result['preserved_manifest_drift'] = drift
    if not apply:
        return dict(result, status='PREFLIGHT')
    if not changed:
        return dict(result, status='UNCHANGED')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = home / 'helena-runtime' / ('editorial-backup-' + stamp)
    for p, original in inputs.items():
        if (p.read_bytes() if p.exists() else None) != original:
            raise ValueError('CONCURRENT_CHANGE:' + str(p))
    original_receipt = receipt_path.read_bytes() if receipt_path.exists() else None
    written = []
    try:
        for p, data in changed:
            if inputs[p] is not None:
                saved = backup / p.relative_to(home)
                saved.parent.mkdir(parents=True, exist_ok=True)
                saved.write_bytes(inputs[p])
            written.append(p)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            if p.read_bytes() != data:
                raise ValueError('WRITE_VERIFICATION_FAILED')
        saved_manifest = backup / manifest_path.relative_to(home)
        saved_manifest.parent.mkdir(parents=True, exist_ok=True)
        saved_manifest.write_bytes(manifest_bytes)
        if original_receipt is not None:
            (backup / 'previous-receipt.json').write_bytes(original_receipt)
        manifest['soul_hashes'].update(hashes)
        manifest['editorial_policy_version'] = VERSION
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        if json.loads(manifest_path.read_bytes()) != manifest:
            raise ValueError('MANIFEST_VERIFICATION_FAILED')
        result.update(status='INSTALLED', observed_at=datetime.now(timezone.utc).isoformat(),
                      backup=str(backup), soul_hashes=hashes,
                      activation='PROFILE_SOUL_AND_NATIVE_SKILL')
        receipt_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        if json.loads(receipt_path.read_bytes()) != result:
            raise ValueError('RECEIPT_VERIFICATION_FAILED')
    except Exception:
        for p in reversed(written):
            if inputs[p] is None:
                p.unlink(missing_ok=True)
            else:
                p.write_bytes(inputs[p])
        manifest_path.write_bytes(manifest_bytes)
        if original_receipt is None:
            receipt_path.unlink(missing_ok=True)
        else:
            receipt_path.write_bytes(original_receipt)
        raise
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path('/data'))
    parser.add_argument('--skill', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--audited-baseline', type=Path)
    args = parser.parse_args()
    baseline = json.loads(args.audited_baseline.read_bytes()) if args.audited_baseline else None
    print(json.dumps(install(args.home, args.skill, args.apply, baseline), ensure_ascii=False))
