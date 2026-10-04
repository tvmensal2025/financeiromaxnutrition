import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
slug = 'helena--grupo'
token = d.token_for(root, slug)
binary = d.resolve_hermes_binary()
home = root / slug
print('RESOLVED BINARY:', binary)
print('TOKEN LEN:', len(token))
launch = d.launcher_preflight(binary, slug, home, token)
print('LAUNCHER_PREFLIGHT HELENA:', launch)
`;

  const res = await runHermesPython(py);
  console.log(res);
}

main().catch(console.error);
