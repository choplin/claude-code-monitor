import { parseArgs } from "util";
import { basename } from "path";
import { listSessions } from "../db";
import { interpretState, formatState } from "../interpret";
import type { OutputFormat } from "../types";

export function runList(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      format: { type: "string", default: "text" },
    },
  });

  const format = values.format as OutputFormat;
  const sessions = listSessions();

  if (format === "json") {
    // Include interpreted state in JSON output
    const sessionsWithState = sessions.map((session) => ({
      ...session,
      interpreted_state: interpretState(session),
    }));
    console.log(JSON.stringify(sessionsWithState, null, 2));
  } else {
    if (sessions.length === 0) {
      console.log("No active sessions");
    } else {
      for (const session of sessions) {
        const projectName = basename(session.cwd);
        const state = formatState(interpretState(session));
        console.log(`${projectName}: ${state}`);
      }
    }
  }
}
