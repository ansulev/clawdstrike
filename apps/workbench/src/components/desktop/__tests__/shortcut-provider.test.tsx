import React from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ShortcutProvider } from "../shortcut-provider";
import { InitCommands } from "@/lib/commands/init-commands";
import { usePaneStore } from "@/features/panes/pane-store";
import { renderWithProviders } from "@/test/test-helpers";
import { useWorkbench } from "@/features/policy/stores/multi-policy-store";
import { isDesktop } from "@/lib/tauri-bridge";

vi.mock("@/lib/tauri-bridge", () => ({
  isDesktop: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

function PolicyValidateShortcutHarness() {
  const { dispatch, state } = useWorkbench();

  useEffect(() => {
    // Use a sub-route of /editor that doesn't get redirected by normalizeWorkbenchRoute
    // (which maps bare "/editor" to "/home"). This keeps the "editor" shortcut context active.
    usePaneStore.getState().syncRoute("/editor/visual");
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: "UPDATE_META", name: "Shortcut Rename" })}
      >
        rename-policy
      </button>
      <pre data-testid="yaml">{state.yaml}</pre>
      <span data-testid="policy-name">{state.activePolicy.name}</span>
      <span data-testid="sync-direction">{state.ui.editorSyncDirection ?? ""}</span>
      <span data-testid="dirty">{String(state.dirty)}</span>
      <div data-testid="terminal-context" data-shortcut-context="terminal" tabIndex={-1} />
      <InitCommands />
      <ShortcutProvider />
    </>
  );
}

beforeEach(() => {
  vi.mocked(isDesktop).mockReturnValue(false);
});

describe("ShortcutProvider", () => {
  it("syncs policy YAML before validating on web", async () => {
    renderWithProviders(<PolicyValidateShortcutHarness />);

    fireEvent.click(screen.getByRole("button", { name: "rename-policy" }));

    expect(screen.getByTestId("policy-name").textContent).toBe("Shortcut Rename");
    expect(screen.getByTestId("dirty").textContent).toBe("true");
    expect(screen.getByTestId("sync-direction").textContent).toBe("");

    fireEvent.keyDown(window, { key: "v", metaKey: true, shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId("yaml").textContent).toContain('name: "Shortcut Rename"');
      expect(screen.getByTestId("sync-direction").textContent).toBe("yaml");
    });
  });

  it("does not fire editor-only shortcuts while terminal context is focused", () => {
    renderWithProviders(<PolicyValidateShortcutHarness />);

    fireEvent.click(screen.getByRole("button", { name: "rename-policy" }));

    const terminalContext = screen.getByTestId("terminal-context");
    terminalContext.focus();
    fireEvent.keyDown(terminalContext, { key: "v", metaKey: true, shiftKey: true });

    expect(screen.getByTestId("sync-direction").textContent).toBe("");
  });
});
