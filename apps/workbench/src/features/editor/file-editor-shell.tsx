/**
 * FileEditorShell -- Complete per-file editor wrapper with contextual toolbar.
 *
 * Bridges a /file/* pane route to the policy-tabs-store. Handles:
 * - Regular file paths: looks up tab by filePath match
 * - __new__ routes: looks up tab by tabId in the route (/file/__new__/{tabId})
 * - File loading: if no tab exists for the filePath, loads via Tauri bridge
 * - Toolbar: renders FileEditorToolbar with per-file state (testRunner, problems)
 * - Active tab sync: keeps policy-tabs-store.activeTabId in sync
 *
 * NOTE: The <pre> content area is a temporary read-only YAML viewer. The full
 * CodeMirror EditorPane integration requires decoupling from useMultiPolicy(),
 * which is a larger refactor. The existing /editor route with PolicyEditor
 * still works for full editing.
 */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";
import { FileEditorToolbar } from "./file-editor-toolbar";

export function FileEditorShell() {
  const params = useParams();
  const filePath = params["*"] ?? "";

  // Per-file local state for panel toggles
  const [testRunnerOpen, setTestRunnerOpen] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  // Determine whether this is a __new__ untitled file route
  const isNewFile = filePath.startsWith("__new__/");
  const newTabId = isNewFile ? filePath.split("/")[1] : null;

  // Look up tab: either by __new__ tabId or by filePath match
  const tabMeta = usePolicyTabsStore((s) => {
    if (isNewFile && newTabId) {
      return s.tabs.find((t) => t.id === newTabId) ?? null;
    }
    return s.tabs.find((t) => t.filePath === filePath) ?? null;
  });

  const activeTabId = usePolicyTabsStore((s) => s.activeTabId);

  const editState = usePolicyEditStore((s) =>
    tabMeta ? s.editStates.get(tabMeta.id) : undefined,
  );

  // Load file content via Tauri bridge when no matching tab exists
  useEffect(() => {
    if (!filePath || tabMeta) return; // Already loaded or no path
    if (isNewFile) return; // Untitled file, skip loading

    async function loadFile() {
      try {
        const { readDetectionFileByPath } = await import(
          "@/lib/tauri-bridge"
        );
        const result = await readDetectionFileByPath(filePath);
        if (result) {
          usePolicyTabsStore.getState().openTabOrSwitch(
            result.path,
            result.fileType,
            result.content,
            filePath.split("/").pop() ?? "File",
          );
        }
      } catch (err) {
        console.warn("[FileEditorShell] Failed to load file:", filePath, err);
      }
    }
    loadFile();
  }, [filePath, tabMeta, isNewFile]);

  // Sync activeTabId when this shell mounts or filePath changes
  useEffect(() => {
    if (tabMeta && activeTabId !== tabMeta.id) {
      usePolicyTabsStore.getState().switchTab(tabMeta.id);
    }
  }, [tabMeta, activeTabId, filePath]);

  if (!tabMeta || !editState) {
    return (
      <div className="flex h-full items-center justify-center text-[#6f7f9a] font-mono text-sm">
        File not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar
        tabMeta={tabMeta}
        editState={editState}
        onToggleTestRunner={() => setTestRunnerOpen((v) => !v)}
        onToggleProblems={() => setShowProblems((v) => !v)}
        testRunnerOpen={testRunnerOpen}
        problemsOpen={showProblems}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Editor content area -- renders the YAML/visual editor for the tab */}
        <pre className="p-4 font-mono text-xs text-[#ece7dc] whitespace-pre-wrap leading-relaxed">
          {editState.yaml}
        </pre>
      </div>
    </div>
  );
}
