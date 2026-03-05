import { initDb, upsertSession, deleteSession } from "../db";
import type { HookEvent } from "../types";

const UPDATE_EVENTS: HookEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
];

export async function runHook(args: string[]): Promise<void> {
  const event = args[0] as HookEvent;
  const toolName = args[1] ?? null;

  if (!event) {
    process.exit(1);
  }

  const input = await Bun.stdin.text();
  const data = JSON.parse(input);

  const sessionId = data.session_id;
  const cwd = data.cwd;
  const tmuxPane = process.env.TMUX_PANE ?? null;

  if (!sessionId || !cwd) {
    process.exit(0);
  }

  initDb();

  if (event === "SessionEnd") {
    deleteSession(sessionId);
  } else if (UPDATE_EVENTS.includes(event)) {
    upsertSession(sessionId, cwd, event, toolName, tmuxPane);
  }
}
