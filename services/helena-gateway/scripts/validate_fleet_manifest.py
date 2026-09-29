#!/usr/bin/env python3
"""Fast, no-model validation for the Humano Digital 21-agent pilot manifest."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
AGENTS_PATH = ROOT / "src" / "lib" / "agentes.json"
MANIFEST_PATH = ROOT / "docs" / "helena" / "humano-digital-validacao-21-agentes.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate() -> dict:
    agents = load_json(AGENTS_PATH)
    manifest = load_json(MANIFEST_PATH)
    expected = {item["agent_id"]: item for item in agents}
    flow = manifest["flow"]
    flow_ids = [item["agent_id"] for item in flow]

    errors: list[str] = []
    if len(expected) != 21:
        errors.append(f"canonical roster has {len(expected)} agents, expected 21")
    if len(flow) != 21:
        errors.append(f"manifest has {len(flow)} steps, expected 21")
    if len(set(flow_ids)) != len(flow_ids):
        errors.append("manifest contains duplicated agent_id")
    if set(flow_ids) != set(expected):
        errors.append(f"manifest ids differ from roster: {sorted(set(flow_ids) ^ set(expected))}")

    required = ("agent_id", "agent", "function", "activation", "microtask", "expected_evidence", "reviewer_id")
    for index, item in enumerate(flow, start=1):
        for key in required:
            if not isinstance(item.get(key), str) or not item[key].strip():
                errors.append(f"step {index} has blank {key}")
        canonical = expected.get(item.get("agent_id"))
        if canonical and (item["agent"] != canonical["agente"] or item["function"] != canonical["cargo_funcao"]):
            errors.append(f"step {index} role mismatch for {item['agent_id']}")
        if item.get("reviewer_id") not in expected:
            errors.append(f"step {index} reviewer is not in roster")
        if item.get("next_agent_id") is not None and item["next_agent_id"] not in expected:
            errors.append(f"step {index} next agent is not in roster")

    contract = manifest.get("global_output_contract", {})
    for key in ("required_fields", "minimum_result_summary_chars", "minimum_evidence_refs", "blank_artifact_is_failure"):
        if key not in contract:
            errors.append(f"output contract missing {key}")
    if manifest.get("external_actions_allowed") is not False:
        errors.append("validation batch must disallow external actions")
    if manifest.get("dispatch_agent_id") != "AGT-04":
        errors.append("dispatch must belong to Marina AGT-04")
    if manifest.get("final_gate_agent_id") != "AGT-01":
        errors.append("final gate must belong to Helena AGT-01")

    result = {
        "status": "PASS" if not errors else "FAIL",
        "batch_id": manifest.get("batch_id"),
        "business_id": manifest.get("business_id"),
        "agents_in_canonical_roster": len(expected),
        "steps_in_validation_flow": len(flow),
        "unique_agent_ids": len(set(flow_ids)),
        "blank_required_fields": sum(
            1
            for item in flow
            for key in required
            if not isinstance(item.get(key), str) or not item[key].strip()
        ),
        "external_actions_allowed": manifest.get("external_actions_allowed"),
        "model_calls_made": 0,
        "errors": errors,
    }
    if errors:
        raise SystemExit(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    print(json.dumps(validate(), ensure_ascii=False, indent=2))
