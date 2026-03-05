---
description: Show a summary count of waiting vs total sessions
allowed-tools: Bash
---

Run the following command to get a summary of Claude Code sessions:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/claude-code-monitor" summary
```

The output format is `waiting/total` (e.g., `2/3` means 2 sessions waiting out of 3 total).

Present this to the user clearly.
