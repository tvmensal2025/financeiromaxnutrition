import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_workflow_tick as w
from pathlib import Path

directory = Path('/data/helena-runtime')
root = Path('/data/profiles')

wf = w.Workflow(directory, root)
result = wf.tick(execute=False)
print("WORKFLOW_TICK_RESULT:", json.dumps(result, indent=2, ensure_ascii=False))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
