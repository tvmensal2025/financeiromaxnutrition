import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

token = d.token_for(Path('/data/profiles'), 'helena--grupo')

ctx = d.call_tool(d.GATEWAY, token, 'get_work_context', {})
print('HELENA CONTEXT VERSION:', ctx.get('context_version'))
fleet = ctx.get('fleet', [])
print('FLEET TYPE:', type(fleet), 'LEN:', len(fleet))
print('FLEET RAW:', json.dumps(fleet, indent=2, ensure_ascii=False))
`;

  const res = await runHermesPython(py);
  console.log(res);
}

main().catch(console.error);
