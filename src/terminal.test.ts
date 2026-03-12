import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { detectPane, formatPane, paneColumnHeader } from "./terminal";

describe("detectPane", () => {
  let savedTmux: string | undefined;
  let savedWez: string | undefined;

  beforeEach(() => {
    savedTmux = process.env.TMUX_PANE;
    savedWez = process.env.WEZTERM_PANE;
    delete process.env.TMUX_PANE;
    delete process.env.WEZTERM_PANE;
  });

  afterEach(() => {
    if (savedTmux !== undefined) process.env.TMUX_PANE = savedTmux;
    else delete process.env.TMUX_PANE;
    if (savedWez !== undefined) process.env.WEZTERM_PANE = savedWez;
    else delete process.env.WEZTERM_PANE;
  });

  test("returns null when no terminal multiplexer", () => {
    expect(detectPane()).toBeNull();
  });

  test("detects tmux", () => {
    process.env.TMUX_PANE = "%0";
    expect(detectPane()).toEqual({ terminal: "tmux", paneId: "%0" });
  });

  test("detects wezterm", () => {
    process.env.WEZTERM_PANE = "3";
    expect(detectPane()).toEqual({ terminal: "wez", paneId: "3" });
  });

  test("tmux takes priority over wezterm", () => {
    process.env.TMUX_PANE = "%1";
    process.env.WEZTERM_PANE = "5";
    expect(detectPane()).toEqual({ terminal: "tmux", paneId: "%1" });
  });
});

describe("formatPane", () => {
  test("returns pane_id when present", () => {
    expect(formatPane({ pane_id: "%0", pane_terminal: "tmux" })).toBe("%0");
  });

  test("returns pane_id regardless of pane_terminal", () => {
    expect(formatPane({ pane_id: "3", pane_terminal: null })).toBe("3");
  });

  test("returns dash when pane_id is null", () => {
    expect(formatPane({ pane_id: null, pane_terminal: "tmux" })).toBe("-");
  });

  test("returns dash when both are null", () => {
    expect(formatPane({ pane_id: null, pane_terminal: null })).toBe("-");
  });
});

describe("paneColumnHeader", () => {
  test("returns null when no sessions have pane info", () => {
    expect(
      paneColumnHeader([
        { pane_id: null, pane_terminal: null },
        { pane_id: null, pane_terminal: null },
      ])
    ).toBeNull();
  });

  test("returns null for empty array", () => {
    expect(paneColumnHeader([])).toBeNull();
  });

  test("returns uppercased terminal name when all same", () => {
    expect(
      paneColumnHeader([
        { pane_id: "%0", pane_terminal: "tmux" },
        { pane_id: "%1", pane_terminal: "tmux" },
      ])
    ).toBe("TMUX");
  });

  test("returns uppercased terminal name for wezterm", () => {
    expect(
      paneColumnHeader([{ pane_id: "3", pane_terminal: "wez" }])
    ).toBe("WEZ");
  });

  test("ignores sessions without pane info", () => {
    expect(
      paneColumnHeader([
        { pane_id: "%0", pane_terminal: "tmux" },
        { pane_id: null, pane_terminal: null },
      ])
    ).toBe("TMUX");
  });

  test("returns PANE when terminals are mixed", () => {
    expect(
      paneColumnHeader([
        { pane_id: "%0", pane_terminal: "tmux" },
        { pane_id: "3", pane_terminal: "wez" },
      ])
    ).toBe("PANE");
  });
});
