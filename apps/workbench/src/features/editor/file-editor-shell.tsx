/**
 * FileEditorShell -- Complete per-file editor wrapper with contextual toolbar.
 *
 * Bridges a /file/* pane route to the policy-tabs-store. Handles:
 * - Regular file paths: looks up tab by filePath match
 * - __new__ routes: looks up tab by tabId in the route (/file/__new__/{tabId})
 * - File loading: if no tab exists for the filePath, loads via Tauri bridge
 * - Toolbar: renders FileEditorToolbar with per-file state (testRunner, problems)
 * - Active tab sync: keeps policy-tabs-store.activeTabId in sync
 * - Live editing: YamlEditor (CodeMirror) wired to policy-edit-store for
 *   per-tab editing, undo/redo, validation, and dirty tracking
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { YamlEditor } from "@/components/ui/yaml-editor";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { EditorVisualPanel } from "@/components/workbench/editor/editor-visual-panel";
import { TestRunnerPanel } from "@/components/workbench/editor/test-runner-panel";
import { TestRunnerProvider } from "@/lib/workbench/test-store";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";
import { useWorkbench } from "@/features/policy/stores/multi-policy-store";
import { useNativeValidation } from "@/features/policy/use-native-validation";
import { useAutoVersion } from "@/features/policy/use-auto-version";
import { isPolicyFileType } from "@/lib/workbench/file-type-registry";
import { FileEditorToolbar } from "./file-editor-toolbar";

export function FileEditorShell() {
  const params = useParams();
  const rawParam = params["*"] ?? "";

  // Decode URI-encoded characters (spaces, special chars) and restore the
  // leading "/" that React Router strips from the wildcard match.  Routes
  // are constructed as `/file/${absolutePath}` (see pane-store.ts openFile)
  // which produces `/file//Users/...`.  React Router returns the `*` param
  // without the leading slash, so an absolute path like
  // "/Users/connor/.clawdstrike/workspace/sigma1.yaml" arrives as
  // "Users/connor/...".  We detect this (not a __new__ route, doesn't
  // start with "/") and prepend "/" to reconstruct the real path.
  const decoded = decodeURIComponent(rawParam);
  const isNewFile = decoded.startsWith("__new__/");
  const filePath =
    !isNewFile && decoded.length > 0 && !decoded.startsWith("/")
      ? `/${decoded}`
      : decoded;

  // Per-file local state for panel toggles
  const [testRunnerOpen, setTestRunnerOpen] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [splitActive, setSplitActive] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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

  // --- Live editing: onChange handler wired to policy-edit-store ---
  const handleEditorChange = useCallback(
    (newYaml: string) => {
      if (!tabMeta) return;
      usePolicyEditStore.getState().setYaml(
        tabMeta.id,
        newYaml,
        tabMeta.fileType,
        tabMeta.filePath,
        tabMeta.name,
      );
      // Sync dirty state to policy-tabs-store (drives pane tab dirty dot)
      const isDirty = usePolicyEditStore.getState().isDirty(tabMeta.id);
      if (tabMeta.dirty !== isDirty) {
        usePolicyTabsStore.getState().setDirty(tabMeta.id, isDirty);
      }
    },
    [tabMeta],
  );

  // --- Cmd+S save handler ---
  const handleSave = useCallback(async () => {
    if (!tabMeta || !editState) return;
    try {
      const { saveDetectionFile } = await import("@/lib/tauri-bridge");
      const savedPath = await saveDetectionFile(
        editState.yaml,
        tabMeta.fileType,
        tabMeta.filePath,    // null triggers Save As dialog
        tabMeta.name,        // suggested filename for Save As
      );
      if (!savedPath) return; // user cancelled Save As

      // If file was untitled (no filePath), set the new path
      if (!tabMeta.filePath) {
        usePolicyTabsStore.getState().setFilePath(tabMeta.id, savedPath);
      }

      // Mark clean in edit store (resets cleanSnapshot)
      usePolicyEditStore.getState().markClean(tabMeta.id);

      // Clear dirty in tabs store (drives pane tab dirty dot)
      usePolicyTabsStore.getState().setDirty(tabMeta.id, false);
    } catch (err) {
      console.error("[FileEditorShell] Save failed:", err);
    }
  }, [tabMeta, editState]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleSave]);

  // Map validation errors to YamlEditor error format
  const editorErrors = editState
    ? editState.validation.errors.map((e) => ({
        line: undefined as number | undefined,
        message: e.message,
      }))
    : [];

  // Load file content via Tauri bridge when no matching tab exists
  useEffect(() => {
    if (!filePath || tabMeta) return; // Already loaded or no path
    if (isNewFile) return; // Untitled file, skip loading

    setLoadFailed(false);

    async function loadFile() {
      try {
        console.debug("[FileEditorShell] Loading file from disk:", filePath);
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
        } else {
          console.warn("[FileEditorShell] readDetectionFileByPath returned null for:", filePath);
          setLoadFailed(true);
        }
      } catch (err) {
        console.warn("[FileEditorShell] Failed to load file:", filePath, err);
        setLoadFailed(true);
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

  // Native validation -- runs Rust policy engine via Tauri IPC on each change
  // Auto-versioning -- creates snapshot on explicit save (dirty -> clean transition)
  // Both hooks must be called unconditionally before early returns (React rules of hooks).
  // They are safe with empty/undefined values: useNativeValidation is a no-op outside
  // Tauri, and useAutoVersion only acts when policyId is defined and dirty transitions.
  const { state: workbenchState, dispatch: workbenchDispatch } = useWorkbench();

  useNativeValidation(
    editState?.yaml ?? "",
    tabMeta?.fileType ?? "clawdstrike_policy",
    workbenchDispatch,
  );

  useAutoVersion(
    tabMeta?.documentId,
    editState?.yaml ?? "",
    workbenchState.activePolicy,
    tabMeta?.dirty ?? false,
  );

  if (!tabMeta || !editState) {
    // Show a loading message while the file is being fetched from disk;
    // only show "File not found" once loading has actually failed.
    if (!loadFailed && filePath && !isNewFile) {
      return (
        <div className="flex h-full items-center justify-center text-[#6f7f9a] font-mono text-sm">
          Loading…
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-[#6f7f9a] font-mono text-sm">
        File not found
      </div>
    );
  }

  // Editor content: split (Visual + YAML) or plain YAML editor.
  // Computed as a variable so TypeScript narrowing from the null guard above applies.
  const editorContent =
    splitActive && isPolicyFileType(tabMeta.fileType) ? (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={45} minSize={25}>
          <EditorVisualPanel />
        </ResizablePanel>
        <ResizableHandle
          className="bg-[#2d3240] hover:bg-[#d4a84b]/40 transition-colors data-[resize-handle-active]:bg-[#d4a84b]"
          withHandle
        />
        <ResizablePanel defaultSize={55} minSize={25}>
          <YamlEditor
            value={editState.yaml}
            onChange={handleEditorChange}
            fileType={tabMeta.fileType}
            errors={editorErrors}
            showDetectionGutters={tabMeta.fileType === "clawdstrike_policy"}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    ) : (
      <YamlEditor
        value={editState.yaml}
        onChange={handleEditorChange}
        fileType={tabMeta.fileType}
        errors={editorErrors}
        showDetectionGutters={tabMeta.fileType === "clawdstrike_policy"}
      />
    );

  return (
    <TestRunnerProvider>
      <div className="h-full flex flex-col">
        <FileEditorToolbar
          tabMeta={tabMeta}
          editState={editState}
          onToggleTestRunner={() => setTestRunnerOpen((v) => !v)}
          onToggleProblems={() => setShowProblems((v) => !v)}
          onToggleSplit={() => setSplitActive((v) => !v)}
          testRunnerOpen={testRunnerOpen}
          problemsOpen={showProblems}
          splitActive={splitActive}
        />
        {testRunnerOpen && isPolicyFileType(tabMeta.fileType) ? (
          <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
            <ResizablePanel defaultSize={60} minSize={20}>
              {editorContent}
            </ResizablePanel>
            <ResizableHandle
              className="bg-[#2d3240] hover:bg-[#d4a84b]/40 transition-colors data-[resize-handle-active]:bg-[#d4a84b]"
            />
            <ResizablePanel defaultSize={40} minSize={15}>
              <TestRunnerPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex-1 min-h-0">
            {editorContent}
          </div>
        )}
      </div>
    </TestRunnerProvider>
  );
}
