import { beforeEach, describe, expect, it } from "vitest";
import { getActivePaneRoute, usePaneStore } from "../pane-store";

describe("pane-store", () => {
  beforeEach(() => {
    usePaneStore.getState()._reset();
  });

  it("syncs the current route into the active pane", () => {
    usePaneStore.getState().syncRoute("/lab?tab=simulate");

    const state = usePaneStore.getState();
    expect(getActivePaneRoute(state.root, state.activePaneId)).toBe("/lab?tab=simulate");
  });

  it("splits and closes panes", () => {
    const originalPaneId = usePaneStore.getState().activePaneId;

    usePaneStore.getState().splitPane(originalPaneId, "vertical");
    expect(usePaneStore.getState().paneCount()).toBe(2);

    const activePaneId = usePaneStore.getState().activePaneId;
    usePaneStore.getState().closePane(activePaneId);

    expect(usePaneStore.getState().paneCount()).toBe(1);
  });

  it("focuses the adjacent pane in flattened order", () => {
    const originalPaneId = usePaneStore.getState().activePaneId;
    usePaneStore.getState().splitPane(originalPaneId, "vertical");

    const rightPaneId = usePaneStore.getState().activePaneId;
    usePaneStore.getState().focusPane("left");
    expect(usePaneStore.getState().activePaneId).toBe(originalPaneId);

    usePaneStore.getState().focusPane("right");
    expect(usePaneStore.getState().activePaneId).toBe(rightPaneId);
  });
});
