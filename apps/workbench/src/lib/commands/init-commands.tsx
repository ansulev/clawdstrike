/**
 * InitCommands — React component that registers all workbench commands.
 *
 * Must be rendered inside the workbench shell and a router context so that it
 * can access workbench, pane, and navigation state.
 *
 * Renders nothing (returns null). Re-registers commands when deps change so
 * closures are always fresh.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBottomPaneStore } from "@/features/bottom-pane/bottom-pane-store";
import { usePaneStore } from "@/features/panes/pane-store";
import { useWorkbench, useMultiPolicy } from "@/features/policy/stores/multi-policy-store";
import { commandRegistry } from "@/lib/command-registry";
import {
  registerNavigateCommands,
  registerFileCommands,
  registerEditCommands,
  registerPolicyCommands,
  registerViewCommands,
} from "./index";
import { ShortcutHelpDialog } from "@/components/desktop/shortcut-help-dialog";

/**
 * Component that initializes all commands and manages the shortcut help dialog.
 * Placed inside DesktopLayout so it has access to router + workbench contexts.
 */
export function InitCommands() {
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    saveFile,
    saveFileAs,
    newPolicy,
    openFile,
    exportYaml,
    copyYaml,
    undo,
    redo,
  } = useWorkbench();
  const { multiDispatch, activeTab } = useMultiPolicy();
  const [helpOpen, setHelpOpen] = useState(false);

  // Use refs so closures in registered commands always read the latest values
  // without needing to re-register on every render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const toggleHelp = useCallback(() => setHelpOpen((prev) => !prev), []);

  useEffect(
    () =>
      commandRegistry.subscribeExecutions((event) => {
        useBottomPaneStore.getState().appendOutput({
          level: event.status === "error" ? "error" : "info",
          title:
            event.status === "error"
              ? `${event.title} failed`
              : `${event.title} completed`,
          detail:
            event.status === "error"
              ? event.error
              : `${event.category} command in ${event.durationMs}ms`,
          commandId: event.commandId,
        });
      }),
    [],
  );

  useEffect(() => {
    registerNavigateCommands(navigate);

    registerFileCommands({
      navigate,
      saveFile,
      saveFileAs,
      newPolicy,
      openFile,
      exportYaml,
      copyYaml,
    });

    registerEditCommands({
      navigate,
      dispatch,
      multiDispatch,
      undo,
      redo,
      getSidebarCollapsed: () => stateRef.current.ui.sidebarCollapsed,
      getActiveTab: () => activeTabRef.current,
    });

    registerPolicyCommands({
      navigate,
      dispatch,
      getActiveTab: () => activeTabRef.current,
      getActivePolicy: () => stateRef.current.activePolicy,
      getYaml: () => stateRef.current.yaml,
      getDirty: () => stateRef.current.dirty,
    });

    registerViewCommands({
      toggleShortcutHelp: toggleHelp,
      splitVertical: () =>
        usePaneStore.getState().splitPane(usePaneStore.getState().activePaneId, "vertical"),
      splitHorizontal: () =>
        usePaneStore.getState().splitPane(usePaneStore.getState().activePaneId, "horizontal"),
      closePane: () =>
        usePaneStore.getState().closePane(usePaneStore.getState().activePaneId),
      focusPane: (direction) => usePaneStore.getState().focusPane(direction),
      hasMultiplePanes: () => usePaneStore.getState().paneCount() > 1,
      toggleTerminal: () => useBottomPaneStore.getState().toggleTab("terminal"),
      toggleProblems: () => useBottomPaneStore.getState().toggleTab("problems"),
      toggleOutput: () => useBottomPaneStore.getState().toggleTab("output"),
      newTerminal: () => useBottomPaneStore.getState().newTerminal(),
      closeTerminal: () => {
        const { activeTerminalId } = useBottomPaneStore.getState();
        if (!activeTerminalId) return Promise.resolve();
        return useBottomPaneStore.getState().closeTerminal(activeTerminalId);
      },
      hasActiveTerminal: () => !!useBottomPaneStore.getState().activeTerminalId,
    });

    // No cleanup needed — commands are re-registered (overwritten) when deps change.
    // The registry uses a Map keyed by id, so re-registration is idempotent.
  }, [
    navigate,
    dispatch,
    multiDispatch,
    saveFile,
    saveFileAs,
    newPolicy,
    openFile,
    exportYaml,
    copyYaml,
    undo,
    redo,
    toggleHelp,
  ]);

  return <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}
