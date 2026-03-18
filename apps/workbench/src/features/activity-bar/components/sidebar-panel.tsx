import { useActivityBarStore } from "../stores/activity-bar-store";
import { ExplorerPanel } from "@/components/workbench/explorer/explorer-panel";
import { useProjectStore } from "@/features/project/stores/project-store";
import { usePaneStore } from "@/features/panes/pane-store";
import { HeartbeatPanel } from "../panels/heartbeat-panel";
import { SentinelPanel } from "../panels/sentinel-panel";
import { FindingsPanel } from "../panels/findings-panel";
import { LibraryPanel } from "../panels/library-panel";
import { FleetPanel } from "../panels/fleet-panel";
import { CompliancePanel } from "../panels/compliance-panel";
import type { ActivityBarItemId } from "../types";

// ---------------------------------------------------------------------------
// SidebarPanel -- Container that renders active panel content.
// Reads activeItem from the activity-bar store and switches panel view.
// ---------------------------------------------------------------------------

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
      onOpenFile={(file) => {
        usePaneStore.getState().openApp("/editor", file.name);
      }}
      onExpandAll={actions.expandAll}
      onCollapseAll={actions.collapseAll}
      filter={filter}
      onFilterChange={actions.setFilter}
      formatFilter={formatFilter}
      onFormatFilterChange={actions.setFormatFilter}
      onCreateFile={async (parentPath, fileName) => {
        const savedPath = await actions.createFile(parentPath, fileName, "clawdstrike_policy");
        if (savedPath) {
          usePaneStore.getState().openApp("/editor", fileName);
        }
      }}
      onRenameFile={() => {
        // Plan 02 implements inline rename
      }}
      onDeleteFile={() => {
        // Plan 02 implements confirmation dialog
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Panel renderer -- switches on active activity bar item
// ---------------------------------------------------------------------------

function renderPanel(activeItem: ActivityBarItemId) {
  switch (activeItem) {
    case "heartbeat":
      return <HeartbeatPanel />;
    case "sentinels":
      return <SentinelPanel />;
    case "findings":
      return <FindingsPanel />;
    case "explorer":
      return <ExplorerPanelConnected />;
    case "library":
      return <LibraryPanel />;
    case "fleet":
      return <FleetPanel />;
    case "compliance":
      return <CompliancePanel />;
  }
}

// ---------------------------------------------------------------------------
// Main SidebarPanel component
// ---------------------------------------------------------------------------

export function SidebarPanel() {
  const activeItem = useActivityBarStore.use.activeItem();
  const sidebarVisible = useActivityBarStore.use.sidebarVisible();
  const sidebarWidth = useActivityBarStore.use.sidebarWidth();

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
          {renderPanel(activeItem)}
        </div>
      )}
    </div>
  );
}
