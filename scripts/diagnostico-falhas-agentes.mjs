import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import json, os, glob, subprocess

print("=== PS AUX PYTHON/HERMES ===")
p = subprocess.run(["ps", "aux"], capture_output=True, text=True)
for line in p.stdout.splitlines():
    if "python" in line or "hermes" in line:
        print(line)

print("=== LOCK FILES ===")
for lock in ["dispatcher.lock", "workflow.lock", "pipeline.lock"]:
    p = f"/data/helena-runtime/{lock}"
    if os.path.exists(p):
        print(f"{lock}: size={os.path.getsize(p)}")

print("=== WORKFLOW STATE SUMMARY ===")
try:
    with open("/data/helena-runtime/workflow-state.json") as f:
        st = json.load(f)
    print("Pending keys count:", len(st.get("pending", {})))
    print("Pending sample:", list(st.get("pending", {}).keys())[:10])
    receipts = st.get("receipts", {})
    print("Receipts count:", len(receipts))
    
    # Agrupar status dos recibos
    status_counts = {}
    for r in receipts.values():
        s = r.get("status", "UNKNOWN")
        status_counts[s] = status_counts.get(s, 0) + 1
    print("Status counts:", status_counts)
    
    # Recibos com falha ou needs_attention
    failed = [r for r in receipts.values() if r.get("status") in ("FAILED", "NEEDS_ATTENTION")]
    print(f"Total FAILED/NEEDS_ATTENTION: {len(failed)}")
    for r in failed[-8:]:
        print(f"  Job: {r.get('job_id')} | Agent: {r.get('agent_id')} | Status: {r.get('status')} | Diag: {r.get('diagnostic')} | Phase: {r.get('phase')}")
except Exception as e:
    print("Error reading state:", e)
`;

  const res = await runHermesPython(py);
  console.log(res);
}

main().catch(console.error);
