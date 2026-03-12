# Architecture

## System Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Claude Code     │     │   SQLite DB  │     │      CLI        │
│  (Hook events)   │────▶│  (raw events)│────▶│  (interpreted   │
│                  │     │              │     │   states)       │
└─────────────────┘     └──────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │ User Hooks  │
                        │ (config.toml│
                        │  commands)  │
                        └─────────────┘
```

The system has four layers:

1. **Hooks** — Capture Claude Code lifecycle events and write raw data to the database
2. **Database** — Store raw event records per session
3. **CLI** — Read sessions, interpret states, and display results
4. **User Hooks** — Execute user-defined shell commands on events or state changes

## Build & Distribution

The project uses **esbuild** to bundle `src/cli.ts` into `dist/cli.js`. The bundle runs on **Node.js** (no Bun dependency). Native modules (`better-sqlite3`, `cli-table3`, `smol-toml`) are marked as external and resolved from `node_modules` at runtime.

```
npm run build  →  esbuild  →  dist/cli.js (Node.js ESM bundle)
```

Distribution is via **npm**. The `bin` field in `package.json` points to `dist/cli.js`, and the Marketplace configuration uses npm as the source.

## Data Flow

```
Claude Code emits event
  → hooks/hooks.json routes to `node dist/cli.js hook <event>`
    → cli.ts `hook` subcommand reads stdin, calls db directly
      → src/db.ts upserts raw event into SQLite
        → src/config.ts loads user config (if exists)
          → src/user-hooks.ts fires matching user-defined hooks

User runs CLI (or slash command)
  → node dist/cli.js <command>
    → cli.ts dispatches to command handler
      → src/db.ts reads sessions from SQLite
        → src/interpret.ts maps raw event to display state
          → output to stdout
```

### Event-to-CLI mapping

| Step | Component | File |
|------|-----------|------|
| Event received | Hook subcommand | `src/commands/hook.ts` |
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
  session_id    TEXT PRIMARY KEY,
  cwd           TEXT NOT NULL,
  event         TEXT NOT NULL,
  tool_name     TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  state_changed_at INTEGER NOT NULL,
  pane_id       TEXT,
  pane_terminal TEXT
);
```

| Column | Description |
|--------|-------------|
| `session_id` | Claude Code session identifier (primary key) |
| `cwd` | Working directory of the session |
| `event` | Last hook event name |
| `tool_name` | Tool name for `PreToolUse` events, NULL otherwise |
| `created_at` | Unix timestamp of session creation (immutable after INSERT) |
| `updated_at` | Unix timestamp of last update |
| `state_changed_at` | Unix timestamp of last state change |
| `pane_id` | Terminal pane identifier (e.g., `%0` for tmux, `3` for WezTerm) |
| `pane_terminal` | Terminal type (e.g., `tmux`, `wez`), NULL if not in a multiplexer |

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

All hooks go through `node dist/cli.js hook <event>`. The `hook` subcommand
reads stdin JSON, extracts `session_id` and `cwd`, and calls `upsertSession`/
`deleteSession` directly (no subprocess spawning).

Errors are silently caught to never block Claude Code.

## User-Defined Hooks

Defined in `src/config.ts` and `src/user-hooks.ts`. Users can configure shell commands
to run when events occur or session states change.

### Config File

Location (XDG Base Directory):
- `$XDG_CONFIG_HOME/claude-code-monitor/config.toml`
- Fallback: `~/.config/claude-code-monitor/config.toml`

Format: TOML with `[[hooks]]` array entries. Each entry has:
- `on_event` — Fire on a specific hook event (e.g., `"Stop"`, `"SessionStart"`)
- `on_state_change` — Fire on state transitions, with optional `from`/`to` filters
- `command` — Shell command to execute

`on_event` and `on_state_change` are mutually exclusive per entry.
State-change hooks only fire when previous state differs from new state.

### Environment Variables

Commands receive context via `MONITOR_`-prefixed environment variables:

| Variable | Description |
|----------|-------------|
| `MONITOR_SESSION_ID` | Session ID |
| `MONITOR_CWD` | Working directory |
| `MONITOR_EVENT` | Hook event name |
| `MONITOR_TOOL_NAME` | Tool name (PreToolUse only, empty otherwise) |
| `MONITOR_STATE` | Current interpreted state (empty for SessionEnd) |
| `MONITOR_PREV_STATE` | Previous state (empty for new sessions) |
| `MONITOR_PANE_ID` | Terminal pane ID (if available) |
| `MONITOR_PANE_TERMINAL` | Terminal type (if available) |

### Execution

Hook commands are spawned via `/bin/sh -c` with `stdio` set to `"ignore"`.
Processes are detached and `.unref()`-ed so they don't block the monitor. All errors
are silently caught to never interfere with Claude Code operation.

## Terminal Detection

Defined in `src/terminal.ts`. A pluggable detector system identifies the terminal
multiplexer environment. Each detector checks an environment variable and returns
a `PaneInfo` (terminal type + pane ID). First match wins.

| Terminal | Env Variable | `terminal` | Example `paneId` |
|----------|-------------|------------|-------------------|
| tmux | `TMUX_PANE` | `tmux` | `%0` |
| WezTerm | `WEZTERM_PANE` | `wez` | `3` |

To add a new terminal, append a detector function to the `detectors` array in
`src/terminal.ts`.

The PANE column in `list` output displays `terminal:paneId` (e.g., `tmux:%0`, `wez:3`)
or `-` when no multiplexer is detected.

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

## Directory Structure

```
claude-code-monitor/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # Marketplace configuration (npm source)
├── commands/
│   └── monitor-list.md      # /monitor-list slash command
├── dist/
│   └── cli.js               # esbuild bundle (gitignored, built via npm run build)
├── hooks/
│   └── hooks.json           # Hook event configuration
├── src/
│   ├── cli.ts               # CLI entry point
│   ├── config.ts            # User config loading (XDG, TOML)
│   ├── db.ts                # Database operations (better-sqlite3)
│   ├── interpret.ts         # State interpretation logic
│   ├── terminal.ts          # Terminal pane detection
│   ├── types.ts             # Type definitions
│   ├── user-hooks.ts        # User-defined hook matching + execution
│   └── commands/
│       ├── delete.ts        # `delete` command
│       ├── hook.ts          # `hook` command (stdin-based, used by hooks)
│       ├── list.ts          # `list` command
│       └── update.ts        # `update` command
├── package.json
└── tsconfig.json
```
