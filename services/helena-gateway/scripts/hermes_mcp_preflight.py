"""Free fail-closed check of Hermes MCP discovery for the selected profile."""

import json
import asyncio
import os
import sys
from pathlib import Path


def visual_child_preflight(home):
    """Probe the actual configured stdio child; never call generate_design."""
    import yaml
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client
    config = yaml.safe_load((home / 'config.yaml').read_text(encoding='utf-8'))
    server = config['mcp_servers']['helena_visual']
    if (server.get('enabled') is not True
        or 'check_visual_runtime' not in server.get('tools', {}).get('include', [])
        or server.get('command') != '/opt/hermes/.venv/bin/python'
        or server.get('args') != ['/data/helena-runtime/hermes_visual.py']):
        return {'ready': False, 'reason': 'VISUAL_PROBE_NOT_CONFIGURED'}
    async def probe():
        params = StdioServerParameters(command=server['command'], args=server['args'], env=server.get('env'))
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool('check_visual_runtime', {})
                # Hermes' installed SDK uses snake_case; upstream also exposes
                # camelCase. Require an explicit non-error response in either.
                if getattr(result, 'isError', getattr(result, 'is_error', None)) is not False:
                    return {'ready': False, 'reason': 'VISUAL_PROBE_FAILED'}
                blocks = [block.text for block in result.content if getattr(block, 'type', '') == 'text']
                if len(blocks) != 1:
                    return {'ready': False, 'reason': 'VISUAL_PROBE_INVALID'}
                report = json.loads(blocks[0])
                return {'ready': report.get('ready') is True and report.get('model_calls') == 0,
                        'reason': report.get('reason', 'VISUAL_PROBE_INVALID')}
    try:
        return asyncio.run(asyncio.wait_for(probe(), timeout=15))
    except Exception:
        return {'ready': False, 'reason': 'VISUAL_PROBE_UNAVAILABLE'}

def required_tools(profile):
    if profile == 'laura--pessoal':
        return {'get_work_context'}
    required = {'get_work_context', 'get_job', 'claim_job', 'start_job',
                'record_progress', 'record_memory', 'submit_delivery', 'submit_work', 'get_visual_asset',
                'review_delivery', 'fail_job', 'waiting_helena'}
    if profile in ('marina--biz003', 'helena--grupo'):
        required.update({'handoff_task', 'create_task_job', 'release_job', 'resolve_job_block', 'revise_task_brief'})
    if profile == 'marina--biz003':
        required.add('record_dispatch')
    if profile == 'maya--biz003':
        required.update({'create_artifact_upload', 'verify_artifact_upload'})
    return required


def inspect_tools(profile, found):
    prefix = 'mcp__helena_operacao__'
    names = {name[len(prefix):] for name in found if isinstance(name, str) and name.startswith(prefix)}
    missing = sorted(required_tools(profile) - names)
    forbidden = set()
    if profile not in ('marina--biz003', 'helena--grupo'):
        forbidden.update({'create_task_job', 'release_job', 'resolve_job_block', 'revise_task_brief',
                          'handoff_task', 'adopt_existing_task', 'record_dispatch'} & names)
    if profile == 'laura--pessoal':
        forbidden.update(names - {'get_work_context'})
    return {'server': 'helena_operacao', 'tool_count': len(names),
            'profile': profile, 'missing_tools': missing, 'forbidden_tools': sorted(forbidden),
            'ready': not missing and not forbidden}


def main() -> int:
    from install_native_mcp_pixels import activate
    activate()
    from tools.mcp_tool_discovery import discover_mcp_tools
    # The CLI's --toolsets filter takes configured server names, without mcp-.
    profile = Path(os.environ.get('HERMES_HOME', '')).name
    found = discover_mcp_tools(allowed_mcp_names=["helena_operacao", "helena_contracts"] + (["helena_visual"] if profile == 'maya--biz003' else []))
    report = inspect_tools(profile, found)
    report['contracts_preflight_ready'] = 'mcp__helena_contracts__check_task_brief' in found
    report['ready'] = report['ready'] and report['contracts_preflight_ready']
    if profile != 'laura--pessoal':
        from tools import mcp_tool_handlers
        report['native_pixels_ready'] = getattr(mcp_tool_handlers, 'HELENA_NATIVE_PIXELS_ACTIVE', False)
        report['ready'] = report['ready'] and report['native_pixels_ready']
    if profile == 'maya--biz003':
        visual = visual_child_preflight(Path(os.environ['HERMES_HOME']))
        ready = 'mcp__helena_visual__generate_design' in found and visual['ready']
        report['image_provider_ready'] = bool(ready)
        report['visual_runtime_reason'] = visual['reason']
        report['ready'] = report['ready'] and bool(ready)
    print(json.dumps(report))
    return 0 if report['ready'] else 1


if __name__ == "__main__":
    sys.exit(main())
