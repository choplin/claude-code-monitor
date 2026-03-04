# Architecture

## System Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Claude Code     │     │   SQLite DB  │     │      CLI        │
│  (Hook events)   │────▶│  (raw events)│────▶│  (interpreted   │
│                  │     │              │     │   states)       │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

The system has three layers:

1. **Hooks** — Capture Claude Code lifecycle events and write raw data to the database
2. **Database** — Store raw event records per session
3. **CLI** — Read sessions, interpret states, and display results

## Data Flow

```
Claude Code emits event
  → hooks/hooks.json routes event to handler
    → hooks/scripts/handler.ts parses stdin JSON, extracts session_id/cwd
      → spawns `claude-code-monitor update` (or `delete` for SessionEnd)
        → src/db.ts upserts raw event into SQLite

User runs CLI
  → src/cli.ts dispatches to command handler
    → src/db.ts reads sessions from SQLite
      → src/interpret.ts maps raw event to display state
        → output to stdout
```

### Event-to-CLI mapping

| Step | Component | File |
|------|-----------|------|
| Event received | Hook handler | `hooks/scripts/handler.ts` |
| Data persisted | Database layer | `src/db.ts` |
| State interpreted | Interpretation | `src/interpret.ts` |
| Output displayed | CLI commands | `src/commands/*.ts` |

## Late Interpretation

Raw events are stored in the database as-is. State interpretation happens at
display time, not at write time.

**Why this design:**

- Adding new interpretations or changing state logic requires no data migration
- The database serves as an accurate event log
- Different consumers (CLI text, JSON, summary) can interpret the same data differently

## Database Schema

Location: `~/.claude/claude-code-monitor.db` (SQLite, WAL mode)

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  cwd        TEXT NOT NULL,
  event      TEXT NOT NULL,
  tool_name  TEXT,
  updated_at INTEGER NOT NULL,
  tmux_pane  TEXT
);
```

| Column | Description |
|--------|-------------|
| `session_id` | Claude Code session identifier (primary key) |
| `cwd` | Working directory of the session |
| `event` | Last hook event name |
| `tool_name` | Tool name for `PreToolUse` events, NULL otherwise |
| `updated_at` | Unix timestamp of last update |
| `tmux_pane` | `$TMUX_PANE` if running in tmux, NULL otherwise |

Each session has exactly one row. New events overwrite the previous row via UPSERT.

## Hook Events

Configured in `hooks/hooks.json`:

| Event | Matcher | Handler action |
|-------|---------|----------------|
| `SessionStart` | — | Upsert session |
| `SessionEnd` | — | Delete session |
| `UserPromptSubmit` | — | Upsert session |
| `PreToolUse` | `AskUserQuestion` | Upsert session with tool_name |
| `PreToolUse` | `ExitPlanMode` | Upsert session with tool_name |
| `Stop` | — | Upsert session |

The handler (`hooks/scripts/handler.ts`) receives event data via stdin as JSON,
extracts `session_id` and `cwd`, and delegates to the CLI's `update` or `delete`
command via `spawnSync`.

Errors are silently caught to never block Claude Code.

## Session State Machine

Defined in `src/interpret.ts`. The interpretation maps raw events to display states:

```
SessionStart ──────────▶ waiting (input)
Stop ──────────────────▶ waiting (input)
UserPromptSubmit ──────▶ running
PreToolUse
  ├─ AskUserQuestion ──▶ waiting (question)
  └─ ExitPlanMode ─────▶ waiting (approval)
```

Summary output groups states into two categories:
- **waiting** = `waiting (input)` + `waiting (question)` + `waiting (approval)`
- **running** = `running`

## Directory Structure

```
claude-code-monitor/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── hooks/
│   ├── hooks.json           # Hook event configuration
│   └── scripts/
│       └── handler.ts       # Hook event handler
├── src/
│   ├── cli.ts               # CLI entry point
│   ├── db.ts                # Database operations
│   ├── interpret.ts         # State interpretation logic
│   ├── types.ts             # Type definitions
│   └── commands/
│       ├── delete.ts        # `delete` command
│       ├── list.ts          # `list` command
│       ├── summary.ts       # `summary` command
│       └── update.ts        # `update` command
├── package.json
└── tsconfig.json
```
