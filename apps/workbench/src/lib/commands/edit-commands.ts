import type { NavigateFunction } from "react-router-dom";
import type React from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";
import type { WorkbenchAction } from "@/features/policy/stores/policy-store";
import type { MultiPolicyAction } from "@/features/policy/stores/multi-policy-store";
import type { PolicyTab } from "@/features/policy/stores/multi-policy-store";
import { openSearchPanel, searchKeymap } from "@codemirror/search";
import { getActiveEditorView } from "@/components/ui/yaml-editor";

export interface EditCommandDeps {
  navigate: NavigateFunction;
  dispatch: React.Dispatch<WorkbenchAction>;
  multiDispatch: React.Dispatch<MultiPolicyAction>;
  undo: () => void;
  redo: () => void;
  getActiveTab: () => PolicyTab | undefined;
}

export function registerEditCommands(deps: EditCommandDeps): void {
  const { navigate, dispatch, multiDispatch, undo, redo, getActiveTab } = deps;

  const commands: Command[] = [
    {
      id: "edit.undo",
      title: "Undo",
      category: "Edit",
      keybinding: "Meta+Z",
      context: "editor",
      execute: () => undo(),
    },
    {
      id: "edit.redo",
      title: "Redo",
      category: "Edit",
      keybinding: "Meta+Shift+Z",
      context: "editor",
      execute: () => redo(),
    },
    {
      id: "edit.newTab",
      title: "New Tab",
      category: "Edit",
      keybinding: "Meta+T",
      context: "editor",
      execute: () => {
        multiDispatch({ type: "NEW_TAB" });
        navigate("/editor");
      },
    },
    {
      id: "edit.closeTab",
      title: "Close Tab",
      category: "Edit",
      keybinding: "Meta+W",
      context: "editor",
      execute: () => {
        const tab = getActiveTab();
        if (!tab) return;
        if (tab.dirty) {
          const confirmed = window.confirm(
            `"${tab.name}" has unsaved changes. Close anyway?`,
          );
          if (!confirmed) return;
        }
        multiDispatch({ type: "CLOSE_TAB", tabId: tab.id });
      },
    },
    {
      id: "edit.find",
      title: "Find",
      category: "Edit",
      keybinding: "Meta+F",
      context: "editor",
      execute: () => {
        const view = getActiveEditorView();
        if (view) openSearchPanel(view);
      },
    },
    {
      id: "edit.replace",
      title: "Find and Replace",
      category: "Edit",
      keybinding: "Meta+H",
      context: "editor",
      execute: () => {
        const view = getActiveEditorView();
        if (!view) return;
        // Find the Mod-h command from searchKeymap which opens search with replace enabled
        const replaceCmd = searchKeymap.find(
          (k) => k.key === "Mod-h" || k.key === "Mod-H"
        );
        if (replaceCmd?.run) {
          replaceCmd.run(view);
        } else {
          // Fallback: open find-only panel
          openSearchPanel(view);
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
