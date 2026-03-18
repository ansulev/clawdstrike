import { useActivityBarStore } from "../stores/activity-bar-store";
import { ExplorerPanel } from "@/components/workbench/explorer/explorer-panel";
import { useProjectStore } from "@/features/project/stores/project-store";
import type { ActivityBarItemId } from "../types";

// ---------------------------------------------------------------------------
// SidebarPanel -- Container that renders active panel content.
// Reads activeItem from the activity-bar store and switches panel view.
// ---------------------------------------------------------------------------

/** Panel title labels keyed by activity bar item ID. */
const PANEL_TITLES: Record<ActivityBarItemId, string> = {
  heartbeat: "System Status",
  sentinels: "Sentinels",
  findings: "Findings & Intel",
  explorer: "Explorer",
  library: "Library",
  fleet: "Fleet & Topology",
  compliance: "Compliance",
};

// ---------------------------------------------------------------------------
// Placeholder panel for panels not yet implemented
// ---------------------------------------------------------------------------

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="h-8 shrink-0 flex items-center px-4 border-b border-[#2d3240]/40">
        <span className="font-display font-semibold text-sm text-[#ece7dc]">
          {title}
        </span>
      </div>
      {/* Placeholder body */}
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="font-mono text-[10px] text-[#6f7f9a]">
          Panel content available in a future update.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explorer panel wiring -- connects ExplorerPanel to project store
// ---------------------------------------------------------------------------

function ExplorerPanelConnected() {
  const project = useProjectStore.use.project();
  const filter = useProjectStore.use.filter();
  const formatFilter = useProjectStore.use.formatFilter();
  const actions = useProjectStore.use.actions();

  return (
    <ExplorerPanel
      project={project}
      onToggleDir={actions.toggleDir}
      onOpenFile={() => {
        // File opening is handled by the editor/pane system.
        // In Phase 1, the sidebar ExplorerPanel is browse-only.
      }}
      onExpandAll={actions.expandAll}
      onCollapseAll={actions.collapseAll}
      filter={filter}
      onFilterChange={actions.setFilter}
      formatFilter={formatFilter}
      onFormatFilterChange={actions.setFormatFilter}
    />
  );
}

// ---------------------------------------------------------------------------
// Main SidebarPanel component
// ---------------------------------------------------------------------------

export function SidebarPanel() {
  const activeItem = useActivityBarStore.use.activeItem();
  const sidebarVisible = useActivityBarStore.use.sidebarVisible();
  const sidebarWidth = useActivityBarStore.use.sidebarWidth();

  const title = PANEL_TITLES[activeItem];

  return (
    <div
      role="tabpanel"
      id="sidebar-panel"
      aria-labelledby={`activity-bar-tab-${activeItem}`}
      className="shrink-0 bg-[#0b0d13] overflow-hidden transition-[width] duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      style={{ width: sidebarVisible ? sidebarWidth : 0 }}
    >
      {sidebarVisible && (
        <div className="h-full flex flex-col" style={{ width: sidebarWidth }}>
          {activeItem === "explorer" ? (
            <ExplorerPanelConnected />
          ) : (
            <PlaceholderPanel title={title} />
          )}
        </div>
      )}
    </div>
  );
}
