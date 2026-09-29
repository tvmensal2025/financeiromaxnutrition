"""Free fail-closed check of Hermes MCP discovery for the selected profile."""

import json
import sys

from tools.mcp_tool_discovery import discover_mcp_tools


def main() -> int:
    # The CLI's --toolsets filter takes configured server names, without mcp-.
    found = discover_mcp_tools(allowed_mcp_names=["helena_operacao"])
    report = {"server": "helena_operacao", "tool_count": len(found)}
    print(json.dumps(report))
    return 0 if len(found) >= 10 else 1


if __name__ == "__main__":
    sys.exit(main())
