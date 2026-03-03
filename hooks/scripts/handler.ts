#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { join } from "path";
import type { HookEvent } from "../../src/types";

// Events that should update session (excludes SessionEnd which deletes)
const UPDATE_EVENTS: HookEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
];

async function main(): Promise<void> {
  try {
    const [event, toolName] = process.argv.slice(2) as [HookEvent, string?];

    const input = await Bun.stdin.text();
    const data = JSON.parse(input);

    const sessionId = data.session_id;
    const cwd = data.cwd;
    const tmuxPane = process.env.TMUX_PANE ?? null;

    if (!sessionId || !cwd) {
      process.exit(0); // Silent exit, don't block Claude Code
    }

    const pluginRoot =
      process.env.CLAUDE_PLUGIN_ROOT ?? join(import.meta.dir, "../..");
    const cliPath = join(pluginRoot, "src/cli.ts");

    if (event === "SessionEnd") {
      // Delete session
      spawnSync("bun", ["run", cliPath, "delete", "--session-id", sessionId], {
        stdio: "ignore",
      });
    } else if (UPDATE_EVENTS.includes(event)) {
      // Update session with raw event data (Late Interpretation)
      const args = [
        "run",
        cliPath,
        "update",
        "--session-id",
        sessionId,
        "--cwd",
        cwd,
        "--event",
        event,
      ];
      if (toolName) {
        args.push("--tool-name", toolName);
      }
      if (tmuxPane) {
        args.push("--tmux-pane", tmuxPane);
      }
      spawnSync("bun", args, { stdio: "ignore" });
    }
  } catch {
    // Silent exit on any error - never block Claude Code
  }
  process.exit(0);
}

main();
