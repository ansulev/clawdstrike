import { useActivityBarStore } from "../stores/activity-bar-store";
import { ExplorerPanel } from "@/components/workbench/explorer/explorer-panel";
import { useProjectStore } from "@/features/project/stores/project-store";
import type { DetectionProject, ProjectFile } from "@/features/project/stores/project-store";
import { usePaneStore } from "@/features/panes/pane-store";
import { HeartbeatPanel } from "../panels/heartbeat-panel";
import { SentinelPanel } from "../panels/sentinel-panel";
import { FindingsPanel } from "../panels/findings-panel";
import { LibraryPanel } from "../panels/library-panel";
import { FleetPanel } from "../panels/fleet-panel";
import { CompliancePanel } from "../panels/compliance-panel";
import { SearchPanelConnected } from "@/features/search/components/search-panel";
import type { ActivityBarItemId } from "../types";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// SidebarPanel -- Container that renders active panel content.
// Reads activeItem from the activity-bar store and switches panel view.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Explorer panel wiring -- connects ExplorerPanel to project store
// ---------------------------------------------------------------------------

function ExplorerPanelConnected() {
  const projectRoots = useProjectStore.use.projectRoots();
  const projectsMap = useProjectStore.use.projects();
  const loading = useProjectStore.use.loading();
  const filter = useProjectStore.use.filter();
  const formatFilter = useProjectStore.use.formatFilter();
  const fileStatuses = useProjectStore.use.fileStatuses();
  const actions = useProjectStore.use.actions();

  // Build ordered projects array from roots.
  // When loading is true, roots may exist but projects Map is not yet populated,
  // so we include an empty array during loading to avoid flashing "No project open".
  const projects = useMemo(() => {
    return projectRoots
      .map((root) => projectsMap.get(root))
      .filter((p): p is DetectionProject => p != null);
  }, [projectRoots, projectsMap]);

  // While the bootstrap is scanning directories, show a loading indicator
  // instead of the empty "No project open" state.
  if (loading && projects.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="h-[36px] shrink-0 flex items-center border-b border-[#202531] px-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6f7f9a]">
            Explorer
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] font-mono text-[#6f7f9a]/50 animate-pulse">
            Loading workspace...
          </span>
        </div>
      </div>
    );
  }

  return (
    <ExplorerPanel
      projects={projects}
      onToggleDir={(rootPath, dirPath) => {
        actions.toggleDirForRoot(rootPath, dirPath);
      }}
      onOpenFile={(file) => {
        // Resolve relative ProjectFile.path to absolute using the project root
        // so that Tauri fs reads (which require absolute paths) work correctly.
        const project = projects.find((p) =>
          p.files.some(function findFile(f: ProjectFile): boolean {
            if (f.path === file.path) return true;
            return f.children?.some(findFile) ?? false;
          }),
        );
        const absPath = project
          ? `${project.rootPath}/${file.path}`
          : file.path;
        usePaneStore.getState().openFile(absPath, file.name);
      }}
      onExpandAll={actions.expandAll}
      onCollapseAll={actions.collapseAll}
      onRefresh={async () => {
        for (const root of projectRoots) {
          await actions.loadRoot(root);
        }
      }}
      filter={filter}
      onFilterChange={actions.setFilter}
      formatFilter={formatFilter}
      onFormatFilterChange={actions.setFormatFilter}
      fileStatuses={fileStatuses}
      onAddFolder={async () => {
        const { isDesktop } = await import("@/lib/tauri-bridge");
        if (!isDesktop()) return;
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false, title: "Add Folder to Workspace" });
        if (selected && typeof selected === "string") {
          // addRoot internally triggers loadRoot (fire-and-forget).
          const storeActions = useProjectStore.getState().actions;
          storeActions.addRoot(selected);
        }
      }}
      onRemoveRoot={(rootPath) => {
        actions.removeRoot(rootPath);
      }}
      onCreateFile={async (parentPath, fileName) => {
        const savedPath = await actions.createFile(parentPath, fileName, "clawdstrike_policy");
        if (savedPath) {
          // Compute relative path for status key.
          const project = useProjectStore.getState().project;
          const relPath = project && savedPath.startsWith(project.rootPath)
            ? savedPath.slice(project.rootPath.length).replace(/^\//, "")
            : fileName;
          actions.setFileStatus(relPath, { modified: true });
          usePaneStore.getState().openFile(savedPath, fileName);
        }
      }}
      onRenameFile={async (file, newName) => {
        await actions.renameFile(file.path, newName);
      }}
      onDeleteFile={async (file) => {
        await actions.deleteFile(file.path);
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
    case "search":
      return <SearchPanelConnected />;
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
