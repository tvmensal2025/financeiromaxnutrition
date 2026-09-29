import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "validate_fleet_manifest.py"
SPEC = importlib.util.spec_from_file_location("validate_fleet_manifest", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_humano_digital_manifest_matches_all_21_agents():
    result = MODULE.validate()
    assert result["status"] == "PASS"
    assert result["agents_in_canonical_roster"] == 21
    assert result["steps_in_validation_flow"] == 21
    assert result["unique_agent_ids"] == 21
    assert result["blank_required_fields"] == 0
    assert result["external_actions_allowed"] is False
    assert result["model_calls_made"] == 0
