import { beforeEach, describe, expect, it } from "vitest";
import { getActivePaneRoute, usePaneStore } from "../pane-store";
import { findPaneGroup, getAllPaneGroups, getPaneActiveView } from "../pane-tree";

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

  describe("openApp", () => {
    it("adds a new tab to the active pane group", () => {
      usePaneStore.getState().openApp("/editor", "Editor");

      const state = usePaneStore.getState();
      const pane = findPaneGroup(state.root, state.activePaneId);
      expect(pane).not.toBeNull();
      expect(pane!.views).toHaveLength(2);
      expect(pane!.views[1].route).toBe("/editor");
      expect(pane!.views[1].label).toBe("Editor");
      // New tab should be the active view
      expect(pane!.activeViewId).toBe(pane!.views[1].id);
    });

    it("focuses existing tab instead of adding duplicate when route already open in any pane", () => {
      // Open editor in the active pane
      usePaneStore.getState().openApp("/editor", "Editor");
      const state1 = usePaneStore.getState();
      const pane1 = findPaneGroup(state1.root, state1.activePaneId)!;
      const editorViewId = pane1.views[1].id;

      // Split to create a second pane (focus moves to new pane)
      usePaneStore.getState().splitPane(state1.activePaneId, "vertical");

      // Now try to open /editor again from the new pane -- should focus the first pane
      usePaneStore.getState().openApp("/editor");

      const state2 = usePaneStore.getState();
      // Should have focused back to the original pane that had the editor
      const originalPane = findPaneGroup(state2.root, pane1.id)!;
      expect(originalPane.activeViewId).toBe(editorViewId);
      expect(state2.activePaneId).toBe(pane1.id);
      // Should NOT have added a duplicate
      const allGroups = getAllPaneGroups(state2.root);
      const totalEditorViews = allGroups.flatMap((g) => g.views).filter((v) => v.route === "/editor");
      expect(totalEditorViews).toHaveLength(1);
    });

    it("normalizes routes before comparing", () => {
      usePaneStore.getState().openApp("/overview");

      const state = usePaneStore.getState();
      const pane = findPaneGroup(state.root, state.activePaneId)!;
      // /overview normalizes to /home, which is already the default tab
      // So it should NOT add a new tab, just focus the existing Home tab
      expect(pane.views).toHaveLength(1);
      expect(pane.views[0].route).toBe("/home");
    });

    it("uses getWorkbenchRouteLabel fallback when label is not provided", () => {
      usePaneStore.getState().openApp("/settings");

      const state = usePaneStore.getState();
      const pane = findPaneGroup(state.root, state.activePaneId)!;
      const settingsView = pane.views.find((v) => v.route === "/settings");
      expect(settingsView).toBeDefined();
      expect(settingsView!.label).toBe("Settings");
    });
  });

  describe("closeView", () => {
    it("removes the specified view from the pane group", () => {
      usePaneStore.getState().openApp("/editor", "Editor");
      usePaneStore.getState().openApp("/settings", "Settings");

      const state1 = usePaneStore.getState();
      const pane1 = findPaneGroup(state1.root, state1.activePaneId)!;
      expect(pane1.views).toHaveLength(3); // Home + Editor + Settings

      const editorViewId = pane1.views[1].id;
      usePaneStore.getState().closeView(pane1.id, editorViewId);

      const state2 = usePaneStore.getState();
      const pane2 = findPaneGroup(state2.root, state2.activePaneId)!;
      expect(pane2.views).toHaveLength(2);
      expect(pane2.views.find((v) => v.id === editorViewId)).toBeUndefined();
    });

    it("selects the right neighbor when closing the active view; falls back to left", () => {
      usePaneStore.getState().openApp("/editor", "Editor");
      usePaneStore.getState().openApp("/settings", "Settings");

      const state1 = usePaneStore.getState();
      const pane1 = findPaneGroup(state1.root, state1.activePaneId)!;
      // Views: [Home, Editor, Settings], active is Settings (last opened)

      // Set Editor as active, then close it -- should select Settings (right neighbor)
      usePaneStore.getState().setActiveView(pane1.id, pane1.views[1].id);
      usePaneStore.getState().closeView(pane1.id, pane1.views[1].id);

      const state2 = usePaneStore.getState();
      const pane2 = findPaneGroup(state2.root, state2.activePaneId)!;
      expect(pane2.views).toHaveLength(2); // Home + Settings
      expect(pane2.activeViewId).toBe(pane2.views[1].id); // Settings (right neighbor)
    });

    it("resets to Home when closing the last view in the only pane", () => {
      const state1 = usePaneStore.getState();
      const pane1 = findPaneGroup(state1.root, state1.activePaneId)!;
      const homeViewId = pane1.views[0].id;

      usePaneStore.getState().closeView(pane1.id, homeViewId);

      const state2 = usePaneStore.getState();
      const pane2 = findPaneGroup(state2.root, state2.activePaneId)!;
      expect(pane2.views).toHaveLength(1);
      expect(pane2.views[0].route).toBe("/home");
      // Should be a NEW Home view (different id)
      expect(pane2.views[0].id).not.toBe(homeViewId);
    });

    it("closes the entire pane when closing the last view in a pane with siblings", () => {
      const originalPaneId = usePaneStore.getState().activePaneId;
      usePaneStore.getState().splitPane(originalPaneId, "vertical");
      expect(usePaneStore.getState().paneCount()).toBe(2);

      // The new sibling pane has one view (cloned from original)
      const state1 = usePaneStore.getState();
      const siblingPane = findPaneGroup(state1.root, state1.activePaneId)!;
      const siblingViewId = siblingPane.views[0].id;

      usePaneStore.getState().closeView(siblingPane.id, siblingViewId);

      const state2 = usePaneStore.getState();
      expect(usePaneStore.getState().paneCount()).toBe(1);
      // Should be left with original pane
      const remaining = getAllPaneGroups(state2.root);
      expect(remaining).toHaveLength(1);
    });
  });

  describe("setActiveView", () => {
    it("updates activeViewId within the specified pane group", () => {
      usePaneStore.getState().openApp("/editor", "Editor");

      const state1 = usePaneStore.getState();
      const pane1 = findPaneGroup(state1.root, state1.activePaneId)!;
      const homeViewId = pane1.views[0].id;
      const editorViewId = pane1.views[1].id;

      // Active should be editor (last opened)
      expect(pane1.activeViewId).toBe(editorViewId);

      // Switch to home
      usePaneStore.getState().setActiveView(pane1.id, homeViewId);

      const state2 = usePaneStore.getState();
      const pane2 = findPaneGroup(state2.root, state2.activePaneId)!;
      expect(pane2.activeViewId).toBe(homeViewId);
    });

    it("also sets the pane as the active pane", () => {
      const originalPaneId = usePaneStore.getState().activePaneId;
      usePaneStore.getState().splitPane(originalPaneId, "vertical");

      // Active pane is now the sibling
      expect(usePaneStore.getState().activePaneId).not.toBe(originalPaneId);

      // setActiveView on original pane should make it the active pane
      const state1 = usePaneStore.getState();
      const originalPane = findPaneGroup(state1.root, originalPaneId)!;
      usePaneStore.getState().setActiveView(originalPaneId, originalPane.views[0].id);

      expect(usePaneStore.getState().activePaneId).toBe(originalPaneId);
    });
  });
});
