/**
 * multi-policy-store.tsx — Backward-compatible bridge layer.
 *
 * Phase B1: The monolithic reducer + Context Provider have been decomposed into
 * three focused Zustand stores:
 *   - policy-tabs-store.ts   (tab lifecycle, saved policies, persistence)
 *   - policy-edit-store.ts   (per-tab editing state in Maps keyed by tabId)
 *   - workbench-ui-store.ts  (sidebar, editor tab, sync direction)
 *
 * This file re-exports all the public types/interfaces that consumers depend on
 * and provides deprecated bridge hooks (useWorkbench, useMultiPolicy) that
 * compose the three stores into the exact same shapes as before.
 *
 * The MultiPolicyProvider is now a thin wrapper that runs hydration side-effects.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type {
  WorkbenchPolicy,
  ValidationResult,
  SavedPolicy,
  GuardId,
  GuardConfigMap,
  OriginsConfig,
} from "@/lib/workbench/types";
import {
  DEFAULT_POLICY,
  type WorkbenchState,
  type WorkbenchAction,
  type PolicySnapshot,
  type NativeValidationState,
} from "@/features/policy/stores/policy-store";
import {
  policyToYaml,
  validatePolicy,
} from "@/features/policy/yaml-utils";
import {
  getPrimaryExtension,
  isPolicyFileType,
  sanitizeFilenameStem,
  type FileType,
} from "@/lib/workbench/file-type-registry";
import { sanitizeYamlForStorageWithMetadata } from "@/lib/workbench/storage-sanitizer";
import {
  isDesktop,
  openDetectionFile,
  saveDetectionFile,
  readDetectionFileByPath,
} from "@/lib/tauri-bridge";
import { getDocumentIdentityStore } from "@/lib/workbench/detection-workflow/document-identity-store";

// ---- Zustand stores ----
import {
  usePolicyTabsStore,
  pushRecentFile,
  type TabMeta,
  type SplitMode as _SplitMode,
} from "@/features/policy/stores/policy-tabs-store";
import {
  usePolicyEditStore,
  emptyNativeValidation,
  evaluateTabSource,
  type TabEditState,
} from "@/features/policy/stores/policy-edit-store";
import { useWorkbenchUIStore } from "@/features/policy/stores/workbench-ui-store";

// ---- Re-export types for backward compatibility ----

/**
 * Full PolicyTab shape — reconstructed from TabMeta + TabEditState.
 * All existing consumers see the same interface.
 */
export interface PolicyTab {
  id: string;
  /** Stable document identity — survives tab close/reopen, save, rename. */
  documentId: string;
  name: string;
  filePath: string | null;
  dirty: boolean;
  fileType: FileType;
  policy: WorkbenchPolicy;
  yaml: string;
  validation: ValidationResult;
  nativeValidation: NativeValidationState;
  testSuiteYaml?: string;
  _undoPast: PolicySnapshot[];
  _undoFuture: PolicySnapshot[];
  _cleanSnapshot: PolicySnapshot | null;
}

export type SplitMode = _SplitMode;

export interface MultiPolicyState {
  tabs: PolicyTab[];
  activeTabId: string;
  splitMode: SplitMode;
  splitTabId: string | null;
  savedPolicies: SavedPolicy[];
  ui: {
    sidebarCollapsed: boolean;
    activeEditorTab: "visual" | "yaml";
    editorSyncDirection: "visual" | "yaml" | null;
  };
}

export interface BulkGuardUpdate {
  tabId: string;
  guardId: GuardId;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export type MultiPolicyAction =
  | {
      type: "NEW_TAB";
      policy?: WorkbenchPolicy;
      filePath?: string | null;
      fileType?: FileType;
      yaml?: string;
      documentId?: string;
    }
  | { type: "CLOSE_TAB"; tabId: string }
  | { type: "SWITCH_TAB"; tabId: string }
  | { type: "SET_SPLIT_MODE"; mode: SplitMode }
  | { type: "SET_SPLIT_TAB"; tabId: string | null }
  | { type: "RENAME_TAB"; tabId: string; name: string }
  | { type: "REORDER_TABS"; fromIndex: number; toIndex: number }
  | { type: "DUPLICATE_TAB"; tabId: string }
  | { type: "BULK_UPDATE_GUARDS"; updates: BulkGuardUpdate[] }
  | {
      type: "OPEN_TAB_OR_SWITCH";
      filePath: string;
      fileType: FileType;
      yaml: string;
      name?: string;
    }
  | { type: "SET_TAB_TEST_SUITE"; tabId: string; yaml: string }
  | {
      type: "RESTORE_AUTOSAVE_ENTRIES";
      entries: Array<{
        tabId?: string;
        yaml: string;
        filePath: string | null;
        timestamp: number;
        policyName: string;
        fileType?: FileType;
      }>;
    }
  // Delegated to active tab — same as WorkbenchAction
  | { type: "SET_POLICY"; policy: WorkbenchPolicy }
  | { type: "SET_YAML"; yaml: string }
  | {
      type: "UPDATE_GUARD";
      guardId: GuardId;
      config: Partial<GuardConfigMap[GuardId]>;
    }
  | { type: "TOGGLE_GUARD"; guardId: GuardId; enabled: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<WorkbenchPolicy["settings"]> }
  | {
      type: "UPDATE_META";
      name?: string;
      description?: string;
      version?: string;
      extends?: string;
    }
  | { type: "UPDATE_ORIGINS"; origins: OriginsConfig | undefined }
  | { type: "SAVE_POLICY"; savedPolicy: SavedPolicy }
  | { type: "DELETE_SAVED_POLICY"; id: string }
  | { type: "LOAD_SAVED_POLICIES"; policies: SavedPolicy[] }
  | { type: "SET_COMPARISON"; policy: WorkbenchPolicy | null; yaml?: string }
  | { type: "SET_SIDEBAR_COLLAPSED"; collapsed: boolean }
  | { type: "SET_EDITOR_TAB"; tab: "visual" | "yaml" }
  | { type: "SET_FILE_PATH"; path: string | null }
  | { type: "MARK_CLEAN" }
  | { type: "SET_NATIVE_VALIDATION"; payload: NativeValidationState }
  | { type: "UNDO" }
  | { type: "REDO" };

// ---- Reconstruct PolicyTab from TabMeta + TabEditState ----

function reconstructPolicyTab(
  meta: TabMeta,
  editState: TabEditState | undefined,
): PolicyTab {
  const edit = editState ?? {
    policy: DEFAULT_POLICY,
    yaml: policyToYaml(DEFAULT_POLICY),
    validation: validatePolicy(DEFAULT_POLICY),
    nativeValidation: emptyNativeValidation(),
    undoStack: { past: [], future: [] },
    cleanSnapshot: null,
  };

  return {
    id: meta.id,
    documentId: meta.documentId,
    name: meta.name,
    filePath: meta.filePath,
    dirty: meta.dirty,
    fileType: meta.fileType,
    policy: edit.policy,
    yaml: edit.yaml,
    validation: edit.validation,
    nativeValidation: edit.nativeValidation,
    testSuiteYaml: edit.testSuiteYaml,
    _undoPast: edit.undoStack.past,
    _undoFuture: edit.undoStack.future,
    _cleanSnapshot: edit.cleanSnapshot,
  };
}

// ---- Bridge dispatch ----

/**
 * Create a dispatch function that routes MultiPolicyAction to the appropriate
 * Zustand store methods.
 */
function createBridgeDispatch(): React.Dispatch<MultiPolicyAction> {
  return (action: MultiPolicyAction) => {
    const tabsStore = usePolicyTabsStore.getState();
    const editStore = usePolicyEditStore.getState();
    const uiStore = useWorkbenchUIStore.getState();
    const activeTabId = tabsStore.activeTabId;
    const activeTab = tabsStore.tabs.find((t) => t.id === activeTabId);

    switch (action.type) {
      // ---- Tab lifecycle ----
      case "NEW_TAB":
        tabsStore.newTab({
          policy: action.policy,
          filePath: action.filePath,
          fileType: action.fileType,
          yaml: action.yaml,
          documentId: action.documentId,
        });
        break;

      case "CLOSE_TAB":
        tabsStore.closeTab(action.tabId);
        break;

      case "SWITCH_TAB":
        tabsStore.switchTab(action.tabId);
        break;

      case "SET_SPLIT_MODE":
        tabsStore.setSplitMode(action.mode);
        break;

      case "SET_SPLIT_TAB":
        tabsStore.setSplitTab(action.tabId);
        break;

      case "RENAME_TAB":
        tabsStore.renameTab(action.tabId, action.name);
        break;

      case "REORDER_TABS":
        tabsStore.reorderTabs(action.fromIndex, action.toIndex);
        break;

      case "DUPLICATE_TAB":
        tabsStore.duplicateTab(action.tabId);
        break;

      case "BULK_UPDATE_GUARDS":
        tabsStore.bulkUpdateGuards(action.updates);
        break;

      case "OPEN_TAB_OR_SWITCH":
        tabsStore.openTabOrSwitch(
          action.filePath,
          action.fileType,
          action.yaml,
          action.name,
        );
        break;

      case "SET_TAB_TEST_SUITE":
        tabsStore.setTabTestSuite(action.tabId, action.yaml);
        break;

      case "RESTORE_AUTOSAVE_ENTRIES":
        tabsStore.restoreAutosaveEntries(action.entries);
        break;

      // ---- Saved policies (global) ----
      case "SAVE_POLICY":
        tabsStore.savePolicyToLibrary(action.savedPolicy);
        break;

      case "DELETE_SAVED_POLICY":
        tabsStore.deleteSavedPolicy(action.id);
        break;

      case "LOAD_SAVED_POLICIES":
        tabsStore.loadSavedPolicies(action.policies);
        break;

      // ---- UI state ----
      case "SET_SIDEBAR_COLLAPSED":
        uiStore.setSidebarCollapsed(action.collapsed);
        break;

      case "SET_EDITOR_TAB":
        uiStore.setActiveEditorTab(action.tab);
        break;

      // ---- Delegated to active tab editing ----
      case "SET_POLICY":
        if (activeTab) {
          editStore.updatePolicy(activeTabId, action.policy, activeTab.fileType);
          // Update tab name from policy
          const newName = action.policy.name || activeTab.name;
          tabsStore.renameTab(activeTabId, newName);
          tabsStore.setDirty(activeTabId, true);
          uiStore.setEditorSyncDirection("visual");
        }
        break;

      case "SET_YAML":
        if (activeTab) {
          editStore.setYaml(
            activeTabId,
            action.yaml,
            activeTab.fileType,
            activeTab.filePath,
            activeTab.name,
          );
          // Sync tab name from the content after setYaml evaluates
          const editAfterYaml = editStore.editStates.get(activeTabId);
          if (editAfterYaml) {
            const { name: derivedName } = evaluateTabSource(
              activeTab.fileType,
              action.yaml,
              editAfterYaml.policy,
              activeTab.filePath,
              activeTab.name,
            );
            tabsStore.renameTab(activeTabId, derivedName);
          }
          tabsStore.setDirty(activeTabId, true);
          uiStore.setEditorSyncDirection("yaml");
        }
        break;

      case "UPDATE_GUARD":
        if (activeTab) {
          editStore.updateGuard(
            activeTabId,
            action.guardId,
            action.config,
            activeTab.fileType,
          );
          tabsStore.setDirty(activeTabId, true);
        }
        break;

      case "TOGGLE_GUARD":
        if (activeTab) {
          editStore.toggleGuard(
            activeTabId,
            action.guardId,
            action.enabled,
            activeTab.fileType,
          );
          tabsStore.setDirty(activeTabId, true);
        }
        break;

      case "UPDATE_SETTINGS":
        if (activeTab) {
          editStore.updateSettings(
            activeTabId,
            action.settings,
            activeTab.fileType,
          );
          tabsStore.setDirty(activeTabId, true);
        }
        break;

      case "UPDATE_META":
        if (activeTab) {
          editStore.updateMeta(
            activeTabId,
            {
              name: action.name,
              description: action.description,
              version: action.version,
              extends: action.extends,
            },
            activeTab.fileType,
          );
          // Sync tab name if name was updated
          if (action.name !== undefined) {
            tabsStore.renameTab(activeTabId, action.name || activeTab.name);
          }
          tabsStore.setDirty(activeTabId, true);
        }
        break;

      case "UPDATE_ORIGINS":
        if (activeTab) {
          editStore.updateOrigins(
            activeTabId,
            action.origins,
            activeTab.fileType,
          );
          tabsStore.setDirty(activeTabId, true);
        }
        break;

      case "SET_FILE_PATH":
        if (activeTabId) {
          tabsStore.setFilePath(activeTabId, action.path);
        }
        break;

      case "MARK_CLEAN":
        if (activeTabId) {
          editStore.markClean(activeTabId);
          tabsStore.setDirty(activeTabId, false);
        }
        break;

      case "SET_NATIVE_VALIDATION":
        if (activeTabId) {
          editStore.setNativeValidation(activeTabId, action.payload);
        }
        break;

      case "UNDO":
        if (activeTabId) {
          editStore.undo(activeTabId);
          // Sync dirty flag from edit store
          const afterUndo = editStore.editStates.get(activeTabId);
          if (afterUndo) {
            tabsStore.setDirty(activeTabId, editStore.isDirty(activeTabId));
          }
        }
        break;

      case "REDO":
        if (activeTabId) {
          editStore.redo(activeTabId);
          const afterRedo = editStore.editStates.get(activeTabId);
          if (afterRedo) {
            tabsStore.setDirty(activeTabId, editStore.isDirty(activeTabId));
          }
        }
        break;

      // SET_COMPARISON is a no-op in multi-policy mode
      case "SET_COMPARISON":
        break;

      default:
        break;
    }
  };
}

// ---- Bridge hooks ----

interface MultiPolicyContextValue {
  /** The full multi-policy state for components that need tab awareness. */
  multiState: MultiPolicyState;
  /** Dispatch for multi-policy actions. */
  multiDispatch: React.Dispatch<MultiPolicyAction>;
  /** Active tab, or undefined if no tabs exist (should never happen). */
  activeTab: PolicyTab | undefined;
  /** All open tabs. */
  tabs: PolicyTab[];
  /** Whether new tabs can be added. */
  canAddTab: boolean;
}

interface WorkbenchContextValue {
  state: WorkbenchState;
  dispatch: React.Dispatch<WorkbenchAction>;
  saveCurrentPolicy: () => void;
  exportYaml: () => void;
  copyYaml: () => void;
  loadPolicy: (policy: WorkbenchPolicy) => void;
  openFile: () => Promise<void>;
  openFileByPath: (filePath: string) => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  newPolicy: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// ---- Singleton dispatch (stable reference) ----
let _bridgeDispatch: React.Dispatch<MultiPolicyAction> | null = null;

function getBridgeDispatch(): React.Dispatch<MultiPolicyAction> {
  if (!_bridgeDispatch) {
    _bridgeDispatch = createBridgeDispatch();
  }
  return _bridgeDispatch;
}

/**
 * @deprecated Use individual Zustand stores directly:
 *   - usePolicyTabsStore() for tab lifecycle
 *   - usePolicyEditStore() for per-tab editing
 *   - useWorkbenchUIStore() for UI chrome
 */
export function useMultiPolicy(): MultiPolicyContextValue {
  // Read from all three stores (reactive via Zustand subscriptions)
  const tabsMeta = usePolicyTabsStore((s) => s.tabs);
  const activeTabId = usePolicyTabsStore((s) => s.activeTabId);
  const splitMode = usePolicyTabsStore((s) => s.splitMode);
  const splitTabId = usePolicyTabsStore((s) => s.splitTabId);
  const savedPolicies = usePolicyTabsStore((s) => s.savedPolicies);
  const editStates = usePolicyEditStore((s) => s.editStates);
  const sidebarCollapsed = useWorkbenchUIStore((s) => s.sidebarCollapsed);
  const activeEditorTab = useWorkbenchUIStore((s) => s.activeEditorTab);
  const editorSyncDirection = useWorkbenchUIStore(
    (s) => s.editorSyncDirection,
  );

  const dispatch = getBridgeDispatch();

  // Reconstruct full PolicyTab objects
  const tabs = useMemo(
    () =>
      tabsMeta.map((meta) =>
        reconstructPolicyTab(meta, editStates.get(meta.id)),
      ),
    [tabsMeta, editStates],
  );

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId],
  );

  const multiState: MultiPolicyState = useMemo(
    () => ({
      tabs,
      activeTabId,
      splitMode,
      splitTabId,
      savedPolicies,
      ui: {
        sidebarCollapsed,
        activeEditorTab,
        editorSyncDirection,
      },
    }),
    [
      tabs,
      activeTabId,
      splitMode,
      splitTabId,
      savedPolicies,
      sidebarCollapsed,
      activeEditorTab,
      editorSyncDirection,
    ],
  );

  return useMemo(
    () => ({
      multiState,
      multiDispatch: dispatch,
      activeTab,
      tabs,
      canAddTab: tabsMeta.length < 25,
    }),
    [multiState, dispatch, activeTab, tabs, tabsMeta.length],
  );
}

/**
 * @deprecated Use individual Zustand stores directly.
 *
 * Backward-compatible hook — returns the active tab's state shaped as WorkbenchState.
 * Existing components that call useWorkbench() continue to work unchanged.
 */
export function useWorkbench(): WorkbenchContextValue {
  const tabsMeta = usePolicyTabsStore((s) => s.tabs);
  const activeTabId = usePolicyTabsStore((s) => s.activeTabId);
  const savedPolicies = usePolicyTabsStore((s) => s.savedPolicies);
  const editStates = usePolicyEditStore((s) => s.editStates);
  const sidebarCollapsed = useWorkbenchUIStore((s) => s.sidebarCollapsed);
  const activeEditorTab = useWorkbenchUIStore((s) => s.activeEditorTab);
  const editorSyncDirection = useWorkbenchUIStore(
    (s) => s.editorSyncDirection,
  );

  const dispatch = getBridgeDispatch();

  const activeTabMeta = useMemo(
    () => tabsMeta.find((t) => t.id === activeTabId),
    [tabsMeta, activeTabId],
  );

  const currentTabEdit = useMemo(
    () => editStates.get(activeTabId),
    [editStates, activeTabId],
  );

  // Reconstruct the full PolicyTab for internal use
  const currentTab = useMemo(
    () =>
      activeTabMeta
        ? reconstructPolicyTab(activeTabMeta, currentTabEdit)
        : undefined,
    [activeTabMeta, currentTabEdit],
  );

  // Build WorkbenchState from active tab
  const workbenchState: WorkbenchState = useMemo(() => {
    if (!currentTab) {
      const yaml = policyToYaml(DEFAULT_POLICY);
      return {
        activePolicy: DEFAULT_POLICY,
        yaml,
        validation: validatePolicy(DEFAULT_POLICY),
        savedPolicies,
        comparisonPolicy: null,
        comparisonYaml: "",
        filePath: null,
        dirty: false,
        nativeValidation: emptyNativeValidation(),
        _undoPast: [],
        _undoFuture: [],
        _cleanSnapshot: null,
        ui: {
          sidebarCollapsed,
          activeEditorTab,
          editorSyncDirection,
        },
      };
    }

    return {
      activePolicy: currentTab.policy,
      yaml: currentTab.yaml,
      validation: currentTab.validation,
      savedPolicies,
      comparisonPolicy: null,
      comparisonYaml: "",
      filePath: currentTab.filePath,
      dirty: currentTab.dirty,
      nativeValidation: currentTab.nativeValidation,
      _undoPast: currentTab._undoPast,
      _undoFuture: currentTab._undoFuture,
      _cleanSnapshot: currentTab._cleanSnapshot,
      ui: {
        sidebarCollapsed,
        activeEditorTab,
        editorSyncDirection,
      },
    };
  }, [
    currentTab,
    savedPolicies,
    sidebarCollapsed,
    activeEditorTab,
    editorSyncDirection,
  ]);

  // Bridge dispatch: WorkbenchAction -> MultiPolicyAction
  const workbenchDispatch = useCallback(
    (action: WorkbenchAction) => {
      dispatch(action as MultiPolicyAction);
    },
    [dispatch],
  );

  // ---- Callback implementations (mirroring original store) ----

  const saveCurrentPolicy = useCallback(() => {
    if (!currentTab || !isPolicyFileType(currentTab.fileType)) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const savedPolicy: SavedPolicy = {
      id,
      policy: currentTab.policy,
      yaml: currentTab.yaml,
      createdAt: now,
      updatedAt: now,
    };
    usePolicyTabsStore.getState().savePolicyToLibrary(savedPolicy);
  }, [currentTab]);

  const exportYaml = useCallback(() => {
    if (!currentTab) return;
    const blob = new Blob([currentTab.yaml], {
      type:
        currentTab.fileType === "ocsf_event"
          ? "application/json"
          : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stem = sanitizeFilenameStem(
      currentTab.name || "untitled",
      "untitled",
    );
    a.download = `${stem}${getPrimaryExtension(currentTab.fileType)}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentTab]);

  const copyYaml = useCallback(() => {
    if (!currentTab) return;
    navigator.clipboard.writeText(currentTab.yaml).catch(() => {});
  }, [currentTab]);

  const loadPolicy = useCallback(
    (policy: WorkbenchPolicy) => {
      if (currentTab && !isPolicyFileType(currentTab.fileType)) {
        dispatch({ type: "NEW_TAB", policy });
        return;
      }
      dispatch({ type: "SET_POLICY", policy });
    },
    [currentTab, dispatch],
  );

  const openFile = useCallback(async () => {
    try {
      const result = await openDetectionFile();
      if (!result) return;

      dispatch({
        type: "OPEN_TAB_OR_SWITCH",
        filePath: result.path,
        fileType: result.fileType,
        yaml: result.content,
      });
      pushRecentFile(result.path);
    } catch (err) {
      console.error("[multi-policy] Failed to open file:", err);
    }
  }, [dispatch]);

  const openFileByPath = useCallback(
    async (filePath: string) => {
      try {
        const result = await readDetectionFileByPath(filePath);
        if (!result) return;

        dispatch({
          type: "OPEN_TAB_OR_SWITCH",
          filePath: result.path,
          fileType: result.fileType,
          yaml: result.content,
        });
        pushRecentFile(result.path);
      } catch (err) {
        console.error("[multi-policy] Failed to open file by path:", err);
      }
    },
    [dispatch],
  );

  const saveFileAs = useCallback(async () => {
    if (!currentTab) return;
    try {
      if (!isDesktop()) {
        exportYaml();
        return;
      }
      const savedPath = await saveDetectionFile(
        currentTab.yaml,
        currentTab.fileType,
        null,
        currentTab.name,
      );
      if (!savedPath) return;
      getDocumentIdentityStore().register(savedPath, currentTab.documentId);
      dispatch({ type: "SET_FILE_PATH", path: savedPath });
      dispatch({ type: "MARK_CLEAN" });
      pushRecentFile(savedPath);
    } catch (err) {
      console.error("[multi-policy] Failed to save file:", err);
    }
  }, [currentTab, exportYaml, dispatch]);

  const saveFile = useCallback(async () => {
    if (!currentTab) return;
    try {
      if (!isDesktop()) {
        exportYaml();
        return;
      }
      if (currentTab.filePath) {
        await saveDetectionFile(
          currentTab.yaml,
          currentTab.fileType,
          currentTab.filePath,
          currentTab.name,
        );
        dispatch({ type: "MARK_CLEAN" });
      } else {
        await saveFileAs();
      }
    } catch (err) {
      console.error("[multi-policy] Failed to save file:", err);
    }
  }, [currentTab, saveFileAs, exportYaml, dispatch]);

  const newPolicy = useCallback(() => {
    dispatch({ type: "NEW_TAB" });
  }, [dispatch]);

  const undo = useCallback(
    () => dispatch({ type: "UNDO" }),
    [dispatch],
  );
  const redo = useCallback(
    () => dispatch({ type: "REDO" }),
    [dispatch],
  );

  const canUndo = currentTab ? currentTab._undoPast.length > 0 : false;
  const canRedo = currentTab ? currentTab._undoFuture.length > 0 : false;

  return useMemo(
    () => ({
      state: workbenchState,
      dispatch: workbenchDispatch,
      saveCurrentPolicy,
      exportYaml,
      copyYaml,
      loadPolicy,
      openFile,
      openFileByPath,
      saveFile,
      saveFileAs,
      newPolicy,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      workbenchState,
      workbenchDispatch,
      saveCurrentPolicy,
      exportYaml,
      copyYaml,
      loadPolicy,
      openFile,
      openFileByPath,
      saveFile,
      saveFileAs,
      newPolicy,
      undo,
      redo,
      canUndo,
      canRedo,
    ],
  );
}

// ---- Provider (thin wrapper for hydration + persistence side-effects) ----

/**
 * MultiPolicyProvider — now a thin wrapper around Zustand stores.
 *
 * It only runs hydration of saved policies and debounced tab persistence.
 * The actual state lives in the three Zustand stores.
 *
 * Kept for backward compatibility with:
 *   - App.tsx
 *   - test-helpers.tsx
 *   - Various test files
 */
export function useMultiPolicyBootstrap(): void {
  // Reset stores on mount — ensures clean state in tests where localStorage
  // is cleared between renders.  In production this runs once.
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    // Reset all three Zustand stores from current localStorage
    useWorkbenchUIStore.getState()._reset();
    usePolicyTabsStore.getState()._reset();
    usePolicyTabsStore.getState().hydrateSavedPolicies();
  }

  // Persist saved policies when they change
  const savedPolicies = usePolicyTabsStore((s) => s.savedPolicies);
  const savedPoliciesInitialized = useRef(false);
  useEffect(() => {
    // Skip the initial render — hydrateSavedPolicies handles that
    if (!savedPoliciesInitialized.current) {
      savedPoliciesInitialized.current = true;
      return;
    }
    try {
      localStorage.setItem(
        "clawdstrike_workbench_policies",
        JSON.stringify(savedPolicies),
      );
    } catch (e) {
      console.error(
        "[multi-policy-store] persist saved policies failed:",
        e,
      );
    }
  }, [savedPolicies]);

  // Debounced tab persistence — directly writes to localStorage after 500ms.
  const tabs = usePolicyTabsStore((s) => s.tabs);
  const activeTabId = usePolicyTabsStore((s) => s.activeTabId);
  const editStates = usePolicyEditStore((s) => s.editStates);
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => {
      // Persist directly (matching original behavior), not via schedulePersist
      // which adds an additional debounce layer.
      try {
        const currentTabs = usePolicyTabsStore.getState().tabs;
        const currentActiveTabId = usePolicyTabsStore.getState().activeTabId;
        const currentEditStates = usePolicyEditStore.getState().editStates;
        const persisted = {
          tabs: currentTabs.map((t) => {
            const editState = currentEditStates.get(t.id);
            const yaml = editState?.yaml ?? "";
            const sanitized = sanitizeYamlForStorageWithMetadata(yaml);
            const sensitiveFieldsStripped = sanitized.sensitiveFieldsStripped;
            return {
              id: t.id,
              documentId: t.documentId,
              name: t.name,
              filePath: sensitiveFieldsStripped ? null : t.filePath,
              yaml: sanitized.yaml,
              sensitiveFieldsStripped: sensitiveFieldsStripped || undefined,
              fileType: t.fileType,
            };
          }),
          activeTabId: currentActiveTabId,
        };
        localStorage.setItem(
          "clawdstrike_workbench_tabs",
          JSON.stringify(persisted),
        );
      } catch (e) {
        console.error(
          "[multi-policy-store] persistTabs failed:",
          e,
        );
      }
    }, 500);
    return () => {
      if (persistRef.current) clearTimeout(persistRef.current);
    };
  }, [tabs, activeTabId, editStates]);
}

export function MultiPolicyProvider({
  children,
}: {
  children: ReactNode;
}) {
  useMultiPolicyBootstrap();

  return <>{children}</>;
}
