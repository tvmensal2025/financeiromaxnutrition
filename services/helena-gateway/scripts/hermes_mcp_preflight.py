"""Free fail-closed check of Hermes MCP discovery for the selected profile."""

import json
import os
import sys
from pathlib import Path

def required_tools(profile):
    if profile == 'laura--pessoal':
        return {'get_work_context'}
    required = {'get_work_context', 'get_job', 'claim_job', 'start_job',
                'record_progress', 'record_memory', 'submit_delivery',
                'review_delivery', 'handoff_task', 'fail_job', 'waiting_helena'}
    if profile in ('marina--biz003', 'helena--grupo'):
        required.update({'create_task_job', 'release_job', 'resolve_job_block'})
    if profile == 'marina--biz003':
        required.add('record_dispatch')
    if profile == 'maya--biz003':
        required.update({'create_artifact_upload', 'verify_artifact_upload'})
    return required


def inspect_tools(profile, found):
    prefix = 'mcp__helena_operacao__'
    names = {name[len(prefix):] for name in found if isinstance(name, str) and name.startswith(prefix)}
    missing = sorted(required_tools(profile) - names)
    return {'server': 'helena_operacao', 'tool_count': len(names),
            'profile': profile, 'missing_tools': missing, 'ready': not missing}


def main() -> int:
    from tools.mcp_tool_discovery import discover_mcp_tools
    # The CLI's --toolsets filter takes configured server names, without mcp-.
    found = discover_mcp_tools(allowed_mcp_names=["helena_operacao"])
    report = inspect_tools(Path(os.environ.get('HERMES_HOME', '')).name, found)
    print(json.dumps(report))
    return 0 if report['ready'] else 1


if __name__ == "__main__":
    sys.exit(main())
