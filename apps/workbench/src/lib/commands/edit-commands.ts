import type { NavigateFunction } from "react-router-dom";
import type React from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { Command } from "@/lib/command-registry";
import type { WorkbenchAction } from "@/features/policy/stores/policy-store";
import type { MultiPolicyAction } from "@/features/policy/stores/multi-policy-store";
import type { PolicyTab } from "@/features/policy/stores/multi-policy-store";

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
  ];

  commandRegistry.registerAll(commands);
}
