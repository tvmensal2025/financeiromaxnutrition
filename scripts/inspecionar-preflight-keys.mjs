import { runHermesPython } from './hermes-remote-exec.mjs';

const py = `
import json
with open('/data/helena-runtime/preflight-summary.json') as f:
    data = json.load(f)
print('ITEM 0 KEYS:', list(data[0].keys()))
print('ITEM 0:', json.dumps(data[0], indent=2))
`;

async function main() {
  const res = await runHermesPython(py, 10000);
  console.log(res);
}

main().catch(console.error);
