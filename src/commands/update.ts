import { parseArgs } from "util";
import { upsertSession } from "../db";
import type { HookEvent } from "../types";

const VALID_EVENTS: HookEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
];

export function runUpdate(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      "session-id": { type: "string" },
      cwd: { type: "string" },
      event: { type: "string" },
      "tool-name": { type: "string" },
      "tmux-pane": { type: "string" },
    },
  });

  const sessionId = values["session-id"];
  const cwd = values.cwd;
  const event = values.event as HookEvent;
  const toolName = values["tool-name"] ?? null;
  const tmuxPane = values["tmux-pane"] ?? null;

  if (!sessionId || !cwd || !event) {
    console.error(
      "Error: --session-id, --cwd, and --event are required for update"
    );
    process.exit(1);
  }

  if (!VALID_EVENTS.includes(event)) {
    console.error(
      `Error: Invalid event. Must be one of: ${VALID_EVENTS.join(", ")}`
    );
    process.exit(1);
  }

  upsertSession(sessionId, cwd, event, toolName, tmuxPane);
}
