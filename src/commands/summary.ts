import { listSessions } from "../db";
import { calculateSummary } from "../interpret";

export function runSummary(): void {
  const sessions = listSessions();
  const summary = calculateSummary(sessions);
  console.log(`${summary.waiting}/${summary.total}`);
}
