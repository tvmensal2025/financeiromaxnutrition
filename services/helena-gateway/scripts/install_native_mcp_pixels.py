"""Bridge verified Gateway MCP images to Hermes' native multimodal envelope.

Hermes' generic MCP renderer caches ImageContent as MEDIA text. This narrow
adapter keeps pixels in the model context only for the existing private Gateway.
It changes no tool ACL, provider, credential, model or approval rule.
"""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

MARKER = '# Helena verified MCP pixels v2'
ANCHOR = '    text_result, usable_parts = _render_content_blocks(result, server_name)'
PATCH = '''    # Helena verified MCP pixels v2
    if server_name == "helena_operacao":
        blocks = getattr(result, "content", None) or []
        images = [b for b in blocks if getattr(b, "type", "") == "image"]
        texts = [b.text for b in blocks if getattr(b, "type", "") == "text"]
        try:
            metadata = json.loads(texts[0]) if len(texts) == 1 else {}
            reference = metadata.get("reference", "")
            eligible = (len(images) == 1 and reference.startswith(("storage://helena-deliveries/", "storage://helena-brand-assets/"))
                        and len(metadata.get("sha256", "")) == 64
                        and mcp_field(images[0], "mime_type", "mimeType", "") == "image/png"
                        and len(images[0].data) <= 7 * 1024 * 1024)
        except (ValueError, TypeError, AttributeError):
            eligible = False
        if eligible:
            return {"_multimodal": True, "content": [
                {"type": "text", "text": texts[0]},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + images[0].data}}
            ], "text_summary": "Pixels indisponiveis neste provedor. Nao aprovar qualidade visual sem inspecao real.",
                "meta": {"native_vision": True, "reference": reference, "sha256": metadata["sha256"]}}
'''

def patched(source):
    if MARKER in source:
        if PATCH not in source: raise ValueError('Existing visual bridge diverged')
        return source
    if source.count(ANCHOR) != 1: raise ValueError('Hermes MCP renderer changed; no write')
    updated = source.replace(ANCHOR, PATCH + ANCHOR)
    ast.parse(updated)
    return updated

def activate():
    """Patch only this authorized child process; vendor installation stays read-only."""
    sys.path.insert(0, '/opt/hermes')
    import tools.mcp_tool_handlers as handlers
    if getattr(handlers, 'HELENA_NATIVE_PIXELS_ACTIVE', False): return True
    import inspect
    source = patched(inspect.getsource(handlers._render_call_tool_result))
    exec(compile(source, '<helena-native-pixels>', 'exec'), handlers.__dict__)
    handlers.HELENA_NATIVE_PIXELS_ACTIVE = True
    return True

def install(target=Path('/opt/hermes/tools/mcp_tool_handlers.py'), directory=Path('/data/helena-runtime')):
    if target.is_symlink() or not target.is_file(): raise ValueError('Unexpected MCP renderer')
    old = target.read_bytes(); new = patched(old.decode()).encode()
    activate()
    backup = directory / ('native-pixels-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.py')
    with backup.open('xb') as stream:
        os.chmod(backup, 0o600); stream.write(old)
    receipt = {'status': 'INSTALLED', 'mode': 'PROCESS_LOCAL', 'vendor_file_changed': False,
               'sha256': hashlib.sha256(new).hexdigest(), 'backup': str(backup), 'model_calls': 0, 'access_changed': False}
    (directory / 'native-pixels-install-receipt.json').write_text(json.dumps(receipt))
    print(json.dumps(receipt)); return receipt

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--run-hermes':
        import runpy
        binary = sys.argv[2]
        activate()
        sys.argv = [binary, *sys.argv[3:]]
        runpy.run_path(binary, run_name='__main__')
    else: install()
