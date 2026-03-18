/**
 * FileEditorShell -- Bridges a /file/* pane route to the policy-tabs-store.
 *
 * Reads the file path from the splat route param, finds the matching tab in
 * policy-tabs-store, syncs the active tab, and renders the content. This is the
 * minimal skeleton -- Phase 8 Plan 03 adds the real toolbar and EditorPane.
 */
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";

export function FileEditorShell() {
  const params = useParams();
  const filePath = params["*"] ?? "";

  const tabMeta = usePolicyTabsStore((s) =>
    s.tabs.find((t) => t.filePath === filePath),
  );

  const activeTabId = usePolicyTabsStore((s) => s.activeTabId);

  const editState = usePolicyEditStore((s) =>
    tabMeta ? s.editStates.get(tabMeta.id) : undefined,
  );

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
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="p-4 font-mono text-xs text-[#ece7dc] whitespace-pre-wrap">
          {editState.yaml}
        </pre>
      </div>
    </div>
  );
}
