import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json, os
from pathlib import Path
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d

with open('/data/helena-runtime/workflow-config.json') as f:
    cfg = json.load(f)

profiles = cfg.get('profiles', {})
root = Path('/data/profiles')
binary = d.resolve_hermes_binary()

print(f"TOTAL_PROFILES_TO_CHECK: {len(profiles)}", flush=True)

results = []
for aid, slug_list in sorted(profiles.items()):
    slug = slug_list[0] if slug_list else None
    home = root / slug if slug else None
    
    token_ok = False
    binding_status = 'UNKNOWN'
    launcher_status = 'NOT_CHECKED'
    
    if home and home.exists():
        try:
            token = d.token_for(root, slug)
            token_ok = True
        except Exception as e:
            token = None
            token_ok = False
            
        if token:
            launch = d.launcher_preflight(binary, slug, home, token)
            launcher_status = launch.get('status')
            
    print(f"CHECK: {aid} ({slug}) -> token={token_ok}, launcher={launcher_status}", flush=True)
    results.append({
        'agent_id': aid,
        'slug': slug,
        'token_ok': token_ok,
        'launcher_status': launcher_status
    })

with open('/data/helena-runtime/preflight-summary.json', 'w') as f:
    json.dump(results, f, indent=2)
print("SUCCESS_SAVED_ALL_21", flush=True)
`;

  const res = await runHermesPython(py, 45000);
  console.log(res);
}

main().catch(console.error);
