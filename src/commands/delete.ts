import { parseArgs } from "util";
import { deleteSession } from "../db";

export function runDelete(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      "session-id": { type: "string" },
    },
  });

  const sessionId = values["session-id"];
  if (!sessionId) {
    console.error("Error: --session-id is required for delete");
    process.exit(1);
  }

  const deleted = deleteSession(sessionId);
  if (!deleted) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }
}
