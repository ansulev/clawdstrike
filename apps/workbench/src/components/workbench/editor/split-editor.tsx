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
import { YamlPreviewPanel } from "@/components/workbench/editor/yaml-preview-panel";
// Side-effect imports: these panels self-register in the visual panel registry at module load.
import "@/components/workbench/editor/sigma-visual-panel";
import "@/components/workbench/editor/ocsf-visual-panel";
import "@/components/workbench/editor/yara-visual-panel";
// KQL visual panel self-registration
import "@/components/workbench/editor/kql-visual-panel";
import "@/components/workbench/editor/eql-visual-panel";
import { getVisualPanel } from "@/lib/workbench/detection-workflow/visual-panels";
import { getDescriptor } from "@/lib/workbench/file-type-registry";
import { ViewContainer } from "@/components/plugins/view-container";
import { useMultiPolicy, useWorkbench, type SplitMode } from "@/lib/workbench/multi-policy-store";
import { useNativeValidation } from "@/lib/workbench/use-native-validation";
import { usePluginViewTabs } from "@/lib/plugins/plugin-view-tab-store";
import { getView } from "@/lib/plugins/view-registry";
import { cn } from "@/lib/utils";
import {
  IconLayoutColumns,
  IconLayoutRows,
  IconLayoutSidebar,
} from "@tabler/icons-react";


export function SplitModeToggle() {
  const { multiState, multiDispatch, tabs } = useMultiPolicy();
  const { splitMode } = multiState;

  const cycleMode = useCallback(() => {
    const modes: SplitMode[] = ["none", "vertical", "horizontal"];
    const currentIdx = modes.indexOf(splitMode);
    const next = modes[(currentIdx + 1) % modes.length];
    multiDispatch({ type: "SET_SPLIT_MODE", mode: next });
  }, [splitMode, multiDispatch]);

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
  const { tabs } = useMultiPolicy();
  const pluginViewTabs = usePluginViewTabs();
  const available = excludeTabId
    ? tabs.filter((t) => t.id !== excludeTabId)
    : tabs;

  if (available.length === 0 && pluginViewTabs.length === 0) return null;

  return (
    <div className="flex items-center px-2 py-1 bg-[#0b0d13] border-b border-[#2d3240]">
      <Select
        value={selectedTabId ?? undefined}
        onValueChange={(val) => { if (val) onSelect(val); }}
      >
        <SelectTrigger className="h-7 text-[10px] font-mono bg-[#131721] border-[#2d3240] text-[#ece7dc]">
          <SelectValue placeholder="Select tab..." />
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
          {pluginViewTabs.length > 0 && available.length > 0 && (
            <div className="h-px bg-[#2d3240] my-1" />
          )}
          {pluginViewTabs.map((pvTab) => (
            <SelectItem
              key={`plugin:${pvTab.viewId}`}
              value={`plugin:${pvTab.viewId}`}
              className="text-[10px] font-mono text-[#ece7dc] focus:bg-[#2d3240] focus:text-[#ece7dc]"
            >
              {pvTab.label} [Plugin]
              {pvTab.dirty ? " *" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


function EditorPane() {
  const { activeTab, multiDispatch } = useMultiPolicy();
  const { dispatch } = useWorkbench();
  const fileType = activeTab?.fileType;

  useNativeValidation(
    activeTab?.yaml ?? "",
    activeTab?.fileType ?? "clawdstrike_policy",
    dispatch,
  );

  const renderVisualPanel = () => {
    if (!fileType) return <EditorVisualPanel />;

    const Panel = getVisualPanel(fileType);
    if (Panel) {
      const descriptor = getDescriptor(fileType);
      return (
        <Panel
          source={activeTab!.yaml}
          onSourceChange={(source) => multiDispatch({ type: "SET_YAML", yaml: source })}
          readOnly={false}
          accentColor={descriptor.iconColor}
        />
      );
    }

    // Fallback for file types without a visual panel (e.g. policy uses its own panel)
    return <EditorVisualPanel />;
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
  const { tabs } = useMultiPolicy();
  const tab = tabs.find((t) => t.id === tabId);

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
          {tab.yaml}
        </pre>
      </div>
    </div>
  );
}


export function SplitEditor() {
  const { multiState, multiDispatch } = useMultiPolicy();
  const { splitMode, splitTabId, activeTabId } = multiState;

  const handleSetSplitTab = useCallback(
    (tabId: string) => {
      multiDispatch({ type: "SET_SPLIT_TAB", tabId });
    },
    [multiDispatch],
  );

  // No split — just render the normal editor
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
        {/* Primary pane — active tab's full editor */}
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

        {/* Secondary pane — shows selected split tab as read-only YAML */}
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <PaneTabSelector
              selectedTabId={splitTabId}
              excludeTabId={activeTabId}
              onSelect={handleSetSplitTab}
            />
            <div className="flex-1 min-h-0">
              {splitTabId && splitTabId.startsWith("plugin:") ? (
                (() => {
                  const viewId = splitTabId.slice(7);
                  const reg = getView(viewId);
                  if (!reg) {
                    return (
                      <div className="flex items-center justify-center h-full text-[#6f7f9a]/50 text-[11px] font-mono">
                        Plugin view not found
                      </div>
                    );
                  }
                  return (
                    <ViewContainer
                      registration={reg}
                      isActive={true}
                      slotType="editorTab"
                    />
                  );
                })()
              ) : splitTabId ? (
                <SecondaryPanePreview tabId={splitTabId} />
              ) : (
                <div className="flex items-center justify-center h-full text-[#6f7f9a]/50 text-[11px] font-mono">
                  Select a tab above to compare
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
