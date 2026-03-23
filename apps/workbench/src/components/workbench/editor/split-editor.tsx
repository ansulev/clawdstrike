import { useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorVisualPanel } from "@/components/workbench/editor/editor-visual-panel";
import { SigmaVisualPanel } from "@/components/workbench/editor/sigma-visual-panel";
import { OcsfVisualPanel } from "@/components/workbench/editor/ocsf-visual-panel";
import { YaraVisualPanel } from "@/components/workbench/editor/yara-visual-panel";
import { YamlPreviewPanel } from "@/components/workbench/editor/yaml-preview-panel";
import { usePolicyTabsStore, type SplitMode } from "@/features/policy/stores/policy-tabs-store";
import { usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";
import { useWorkbenchUIStore } from "@/features/policy/stores/workbench-ui-store";
import { useNativeValidation } from "@/features/policy/use-native-validation";
import { cn } from "@/lib/utils";
import {
  IconLayoutColumns,
  IconLayoutRows,
  IconLayoutSidebar,
} from "@tabler/icons-react";


export function SplitModeToggle() {
  const tabs = usePolicyTabsStore(s => s.tabs);
  const splitMode = usePolicyTabsStore(s => s.splitMode);

  const cycleMode = useCallback(() => {
    const modes: SplitMode[] = ["none", "vertical", "horizontal"];
    const currentIdx = modes.indexOf(splitMode);
    const next = modes[(currentIdx + 1) % modes.length];
    usePolicyTabsStore.getState().setSplitMode(next);
  }, [splitMode]);

  // Only show if there are 2+ tabs
  if (tabs.length < 2) return null;

  const Icon =
    splitMode === "vertical"
      ? IconLayoutColumns
      : splitMode === "horizontal"
      ? IconLayoutRows
      : IconLayoutSidebar;

  const label =
    splitMode === "none"
      ? "Split view"
      : splitMode === "vertical"
      ? "Split: vertical"
      : "Split: horizontal";

  return (
    <button
      type="button"
      onClick={cycleMode}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono rounded transition-colors",
        splitMode !== "none"
          ? "bg-[#d4a84b]/15 text-[#d4a84b] border border-[#d4a84b]/30"
          : "text-[#6f7f9a] hover:text-[#ece7dc] border border-transparent hover:border-[#2d3240]",
      )}
      title={label}
    >
      <Icon size={12} stroke={1.5} />
      {splitMode !== "none" && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}


function PaneTabSelector({
  selectedTabId,
  excludeTabId,
  onSelect,
}: {
  selectedTabId: string | null;
  excludeTabId?: string;
  onSelect: (tabId: string) => void;
}) {
  const tabs = usePolicyTabsStore(s => s.tabs);
  const available = excludeTabId
    ? tabs.filter((t) => t.id !== excludeTabId)
    : tabs;

  if (available.length === 0) return null;

  return (
    <div className="flex items-center px-2 py-1 bg-[#0b0d13] border-b border-[#2d3240]">
      <Select
        value={selectedTabId ?? undefined}
        onValueChange={(val) => { if (val) onSelect(val); }}
      >
        <SelectTrigger className="h-7 text-[10px] font-mono bg-[#131721] border-[#2d3240] text-[#ece7dc]">
          <SelectValue placeholder="Select policy..." />
        </SelectTrigger>
        <SelectContent className="bg-[#131721] border-[#2d3240]">
          {available.map((tab) => (
            <SelectItem
              key={tab.id}
              value={tab.id}
              className="text-[10px] font-mono text-[#ece7dc] focus:bg-[#2d3240] focus:text-[#ece7dc]"
            >
              {tab.name}
              {tab.dirty ? " *" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


function EditorPane() {
  const activeTabId = usePolicyTabsStore(s => s.activeTabId);
  const activeTab = usePolicyTabsStore(s => s.tabs.find(t => t.id === s.activeTabId));
  const editState = usePolicyEditStore(s => s.editStates.get(activeTabId));
  const fileType = activeTab?.fileType;
  const yaml = editState?.yaml ?? "";

  // Native validation uses a dispatch-shaped callback for SET_NATIVE_VALIDATION
  useNativeValidation(
    yaml,
    activeTab?.fileType ?? "clawdstrike_policy",
    (action) => {
      usePolicyEditStore.getState().setNativeValidation(activeTabId, action.payload);
    },
  );

  const handleYamlChange = useCallback((newYaml: string) => {
    if (!activeTab) return;
    usePolicyEditStore.getState().setYaml(
      activeTabId,
      newYaml,
      activeTab.fileType,
      activeTab.filePath,
      activeTab.name,
    );
    usePolicyTabsStore.getState().setDirty(activeTabId, true);
    useWorkbenchUIStore.getState().setEditorSyncDirection("yaml");
  }, [activeTabId, activeTab]);

  const renderVisualPanel = () => {
    switch (fileType) {
      case "sigma_rule":
        return (
          <SigmaVisualPanel
            yaml={yaml}
            onYamlChange={handleYamlChange}
          />
        );
      case "ocsf_event":
        return (
          <OcsfVisualPanel
            json={yaml}
            onJsonChange={handleYamlChange}
          />
        );
      case "yara_rule":
        return (
          <YaraVisualPanel
            source={yaml}
            onSourceChange={handleYamlChange}
          />
        );
      default:
        return <EditorVisualPanel />;
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={55} minSize={30}>
        {renderVisualPanel()}
      </ResizablePanel>
      <ResizableHandle
        className="bg-[#2d3240] hover:bg-[#d4a84b]/40 transition-colors data-[resize-handle-active]:bg-[#d4a84b]"
        withHandle
      />
      <ResizablePanel defaultSize={45} minSize={25}>
        <YamlPreviewPanel fileType={activeTab?.fileType} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}


function SecondaryPanePreview({ tabId }: { tabId: string }) {
  const tab = usePolicyTabsStore(s => s.tabs.find(t => t.id === tabId));
  const editState = usePolicyEditStore(s => s.editStates.get(tabId));

  if (!tab) {
    return (
      <div className="flex items-center justify-center h-full text-[#6f7f9a]/50 text-[11px] font-mono">
        Select a policy to compare
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-[#131721] border-b border-[#2d3240] flex items-center gap-2">
        <span className="text-[10px] font-mono text-[#6f7f9a]">Preview:</span>
        <span className="text-[11px] font-mono text-[#ece7dc] truncate">{tab.name}</span>
        {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#d4a84b] shrink-0" />}
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-[11px] font-mono text-[#ece7dc]/80 whitespace-pre-wrap leading-relaxed">
          {editState?.yaml ?? ""}
        </pre>
      </div>
    </div>
  );
}


export function SplitEditor() {
  const splitMode = usePolicyTabsStore(s => s.splitMode);
  const splitTabId = usePolicyTabsStore(s => s.splitTabId);
  const activeTabId = usePolicyTabsStore(s => s.activeTabId);

  const handleSetSplitTab = useCallback(
    (tabId: string) => {
      usePolicyTabsStore.getState().setSplitTab(tabId);
    },
    [],
  );

  // No split -- just render the normal editor
  if (splitMode === "none") {
    return (
      <div className="h-full w-full">
        <EditorPane />
      </div>
    );
  }

  const direction = splitMode === "vertical" ? "horizontal" : "vertical";

  return (
    <div className="h-full w-full">
      <ResizablePanelGroup direction={direction} className="h-full">
        {/* Primary pane -- active tab's full editor */}
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-1 bg-[#0b0d13] border-b border-[#2d3240] text-[10px] font-mono text-[#d4a84b]/70">
              Primary
            </div>
            <div className="flex-1 min-h-0">
              <EditorPane />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle
          className="bg-[#2d3240] hover:bg-[#d4a84b]/40 transition-colors data-[resize-handle-active]:bg-[#d4a84b]"
          withHandle
        />

        {/* Secondary pane -- shows selected split tab as read-only YAML */}
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <PaneTabSelector
              selectedTabId={splitTabId}
              excludeTabId={activeTabId}
              onSelect={handleSetSplitTab}
            />
            <div className="flex-1 min-h-0">
              {splitTabId ? (
                <SecondaryPanePreview tabId={splitTabId} />
              ) : (
                <div className="flex items-center justify-center h-full text-[#6f7f9a]/50 text-[11px] font-mono">
                  Select a policy above to compare
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
