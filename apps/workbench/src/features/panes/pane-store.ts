import { create } from "zustand";
import {
  getWorkbenchRouteLabel,
  normalizeWorkbenchRoute,
} from "@/components/desktop/workbench-routes";
import {
  closePane as closePaneNode,
  createPaneGroup,
  getAdjacentPane,
  getAllPaneGroups,
  getFirstPaneGroup,
  getPaneActiveView,
  setPaneActiveRoute,
  splitPane as splitPaneNode,
  updatePaneSizes,
} from "./pane-tree";
import type { PaneFocusDirection, PaneGroup, PaneNode, PaneSplitDirection, PaneView } from "./pane-types";

function createPaneView(route: string): PaneView {
  const normalized = normalizeWorkbenchRoute(route);
  return {
    id: crypto.randomUUID(),
    route: normalized,
    label: getWorkbenchRouteLabel(normalized),
  };
}

function createInitialRoot(): PaneGroup {
  return createPaneGroup(createPaneView("/home"));
}

export function getActivePane(root: PaneNode, activePaneId: string): PaneGroup | null {
  return getAllPaneGroups(root).find((group) => group.id === activePaneId) ?? null;
}

export function getActivePaneRoute(root: PaneNode, activePaneId: string): string {
  const activePane = getActivePane(root, activePaneId);
  return getPaneActiveView(activePane ?? getFirstPaneGroup(root))?.route ?? "/home";
}

export interface PaneStore {
  root: PaneNode;
  activePaneId: string;
  syncRoute: (route: string) => void;
  splitPane: (paneId: string, direction: PaneSplitDirection) => void;
  closePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  resizeSplit: (splitId: string, sizes: [number, number]) => void;
  focusPane: (direction: PaneFocusDirection) => void;
  paneCount: () => number;
  _reset: () => void;
}

const initialRoot = createInitialRoot();

export const usePaneStore = create<PaneStore>((set, get) => ({
  root: initialRoot,
  activePaneId: initialRoot.id,

  syncRoute: (route) => {
    const normalized = normalizeWorkbenchRoute(route);
    set((state) => ({
      root: setPaneActiveRoute(
        state.root,
        state.activePaneId,
        normalized,
        getWorkbenchRouteLabel(normalized),
      ),
    }));
  },

  splitPane: (paneId, direction) => {
    const current = getActivePane(get().root, paneId) ?? getFirstPaneGroup(get().root);
    const sourceView = getPaneActiveView(current) ?? createPaneView("/home");
    const sibling = createPaneGroup({
      ...sourceView,
      id: crypto.randomUUID(),
    });

    set((state) => ({
      root: splitPaneNode(state.root, paneId, direction, sibling),
      activePaneId: sibling.id,
    }));
  },

  closePane: (paneId) => {
    const nextRoot = closePaneNode(get().root, paneId);

    if (!nextRoot) {
      const fallbackRoot = createInitialRoot();
      set({
        root: fallbackRoot,
        activePaneId: fallbackRoot.id,
      });
      return;
    }

    const nextActivePane = getFirstPaneGroup(nextRoot);
    set({
      root: nextRoot,
      activePaneId: nextActivePane.id,
    });
  },

  setActivePane: (paneId) => {
    if (!getActivePane(get().root, paneId)) return;
    set({ activePaneId: paneId });
  },

  resizeSplit: (splitId, sizes) => {
    set((state) => ({
      root: updatePaneSizes(state.root, splitId, sizes),
    }));
  },

  focusPane: (direction) => {
    const adjacent = getAdjacentPane(get().root, get().activePaneId, direction);
    if (!adjacent) return;
    set({ activePaneId: adjacent.id });
  },

  paneCount: () => getAllPaneGroups(get().root).length,

  _reset: () => {
    const nextRoot = createInitialRoot();
    set({
      root: nextRoot,
      activePaneId: nextRoot.id,
    });
  },
}));
