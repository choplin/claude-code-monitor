# claude-code-monitor

Claude Code plugin that monitors multiple session states via hooks and SQLite.

## Key Resources

- Architecture: [docs/architecture.md](docs/architecture.md)
- Hook config: [hooks/hooks.json](hooks/hooks.json)
- CLI entry point: [src/cli.ts](src/cli.ts)
- State interpretation: [src/interpret.ts](src/interpret.ts)

## Commands

```bash
# Type check
bun run --bun tsc --noEmit

# Run CLI
bun run src/cli.ts <command>
```
