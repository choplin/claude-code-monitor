export interface PaneInfo {
  terminal: string; // "tmux", "wez"
  paneId: string; // raw pane ID
}

type Detector = () => PaneInfo | null;

// Add new terminals here. First match wins.
const detectors: Detector[] = [
  () => {
    const v = process.env.TMUX_PANE;
    return v ? { terminal: "tmux", paneId: v } : null;
  },
  () => {
    const v = process.env.WEZTERM_PANE;
    return v ? { terminal: "wez", paneId: v } : null;
  },
];

export function detectPane(): PaneInfo | null {
  for (const detect of detectors) {
    const result = detect();
    if (result) return result;
  }
  return null;
}

export function formatPane(session: {
  pane_id: string | null;
  pane_terminal: string | null;
}): string {
  return session.pane_id ?? "-";
}

// Determine a unified pane column header from sessions.
// Returns the terminal name uppercased if all pane-bearing sessions share the
// same terminal, "PANE" if mixed, or null if no sessions have pane info.
export function paneColumnHeader(
  sessions: { pane_id: string | null; pane_terminal: string | null }[]
): string | null {
  const terminals = new Set<string>();
  for (const s of sessions) {
    if (s.pane_id && s.pane_terminal) {
      terminals.add(s.pane_terminal);
    }
  }
  if (terminals.size === 0) return null;
  if (terminals.size === 1) {
    const [terminal] = terminals;
    return terminal.toUpperCase();
  }
  return "PANE";
}
