import React, { useMemo, useCallback, useState } from "react";
import {
  IconFolderOpen,
  IconRefresh,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconSearch,
  IconFilePlus,
  IconChevronRight,
  IconFolder,
  IconPlus,
} from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FILE_TYPE_REGISTRY, type FileType } from "@/lib/workbench/file-type-registry";
import type { DetectionProject, ProjectFile, FileStatus } from "@/features/project/stores/project-store";
import { ExplorerTreeItem } from "./explorer-tree-item";
import { ExplorerContextMenu } from "./explorer-context-menu";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { InlineNameInput } from "./inline-name-input";
import { cn } from "@/lib/utils";

// ---- Types ----

interface ExplorerPanelProps {
  /** Array of mounted workspace roots (multi-root support). */
  projects: DetectionProject[];
  onToggleDir: (rootPath: string, dirPath: string) => void;
  onOpenFile: (file: ProjectFile) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  formatFilter: FileType | null;
  onFormatFilterChange: (format: FileType | null) => void;
  onRefresh?: () => void;
  onOpenFolder?: () => void;
  /** Callback to open native folder picker and mount a new root. */
  onAddFolder?: () => void;
  /** Callback to remove a mounted root from the workspace. */
  onRemoveRoot?: (rootPath: string) => void;
  activeFilePath?: string | null;
  className?: string;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onRenameFile?: (file: ProjectFile, newName: string) => void;
  onDeleteFile?: (file: ProjectFile) => void;
  fileStatuses?: Map<string, FileStatus>;
}

// ---- Filter logic ----

const ALL_FILE_TYPES: FileType[] = [
  "clawdstrike_policy",
  "sigma_rule",
  "yara_rule",
  "ocsf_event",
];

/**
 * Recursively filter the file tree by text filter and format filter.
 * Directories are kept if any of their descendants match.
 */
function filterTree(
  files: ProjectFile[],
  textFilter: string,
  formatFilter: FileType | null,
): ProjectFile[] {
  const lowerFilter = textFilter.toLowerCase();

  function matches(file: ProjectFile): boolean {
    if (file.isDirectory) return false;
    const nameMatch = !lowerFilter || file.name.toLowerCase().includes(lowerFilter);
    const formatMatch = !formatFilter || file.fileType === formatFilter;
    return nameMatch && formatMatch;
  }

  function filterNodes(nodes: ProjectFile[]): ProjectFile[] {
    const result: ProjectFile[] = [];

    for (const node of nodes) {
      if (node.isDirectory) {
        const filteredChildren = node.children
          ? filterNodes(node.children)
          : [];
        // Keep directory if it has matching descendants
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
        }
      } else if (matches(node)) {
        result.push(node);
      }
    }

    return result;
  }

  return filterNodes(files);
}

/**
 * Flatten the visible tree (respecting expanded directories) into a list
 * for rendering.
 */
function flattenTree(
  files: ProjectFile[],
  expandedDirs: Set<string>,
): ProjectFile[] {
  const result: ProjectFile[] = [];

  function walk(nodes: ProjectFile[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.isDirectory && node.children && expandedDirs.has(node.path)) {
        walk(node.children);
      }
    }
  }

  walk(files);
  return result;
}

// ---- Format filter dot button ----

function FormatDot({
  fileType,
  active,
  onClick,
}: {
  fileType: FileType;
  active: boolean;
  onClick: () => void;
}) {
  const descriptor = FILE_TYPE_REGISTRY[fileType];

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Filter: ${descriptor.shortLabel}`}
      className={cn(
        "w-[14px] h-[14px] rounded-full border transition-all shrink-0",
        active
          ? "scale-110 shadow-sm"
          : "opacity-40 hover:opacity-70",
      )}
      style={{
        backgroundColor: active ? descriptor.iconColor : "transparent",
        borderColor: descriptor.iconColor,
      }}
    />
  );
}

// ---- Single-root tree section (extracted for reuse) ----

function RootTreeSection({
  project,
  filter,
  formatFilter,
  onToggleDir,
  onOpenFile,
  activeFilePath,
  fileStatuses,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  creatingInDir,
  setCreatingInDir,
  renamingFilePath,
  setRenamingFilePath,
  contextMenu,
  setContextMenu,
  setDeletingFile,
}: {
  project: DetectionProject;
  filter: string;
  formatFilter: FileType | null;
  onToggleDir: (rootPath: string, dirPath: string) => void;
  onOpenFile: (file: ProjectFile) => void;
  activeFilePath?: string | null;
  fileStatuses?: Map<string, FileStatus>;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onRenameFile?: (file: ProjectFile, newName: string) => void;
  onDeleteFile?: (file: ProjectFile) => void;
  creatingInDir: string | null;
  setCreatingInDir: (dir: string | null) => void;
  renamingFilePath: string | null;
  setRenamingFilePath: (path: string | null) => void;
  contextMenu: { file: ProjectFile; x: number; y: number } | null;
  setContextMenu: (menu: { file: ProjectFile; x: number; y: number } | null) => void;
  setDeletingFile: (file: ProjectFile | null) => void;
}) {
  const filteredFiles = useMemo(() => {
    if (!filter && !formatFilter) return project.files;
    return filterTree(project.files, filter, formatFilter);
  }, [project.files, filter, formatFilter]);

  const visibleItems = useMemo(() => {
    return flattenTree(filteredFiles, project.expandedDirs);
  }, [filteredFiles, project.expandedDirs]);

  if (visibleItems.length === 0 && creatingInDir === null) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-[10px] font-mono text-[#6f7f9a]/50">
          {filter || formatFilter
            ? "No files match the current filter"
            : "No detection files found"}
        </p>
      </div>
    );
  }

  // Resolve creatingInDir to a relative path for matching against the tree.
  const creatingInRelDir =
    creatingInDir === null
      ? null
      : creatingInDir === project.rootPath
        ? ""
        : creatingInDir.startsWith(project.rootPath + "/")
          ? creatingInDir.slice(project.rootPath.length + 1)
          : creatingInDir;

  // Determine the depth for the inline input.
  const inputDepth = creatingInRelDir === null
    ? 0
    : creatingInRelDir === ""
      ? 0
      : creatingInRelDir.split("/").filter(Boolean).length;

  const renderInlineInput = () => (
    <div className="py-1" style={{ paddingLeft: inputDepth * 16 + 4 }}>
      <InlineNameInput
        placeholder="filename.yaml"
        onSubmit={(name) => {
          onCreateFile?.(creatingInDir!, name);
          setCreatingInDir(null);
        }}
        onCancel={() => setCreatingInDir(null)}
      />
    </div>
  );

  // For root-level creation, render input at the top.
  const isRootCreation = creatingInRelDir === "";

  const items: React.ReactNode[] = [];

  if (creatingInDir !== null && isRootCreation) {
    items.push(
      <React.Fragment key="__new-file-input">{renderInlineInput()}</React.Fragment>,
    );
  }

  for (let i = 0; i < visibleItems.length; i++) {
    const file = visibleItems[i];
    const status = fileStatuses?.get(file.path);
    items.push(
      <ExplorerTreeItem
        key={file.path}
        file={file}
        isExpanded={project.expandedDirs.has(file.path)}
        onToggle={() => onToggleDir(project.rootPath, file.path)}
        onOpen={() => onOpenFile(file)}
        isActive={
          !file.isDirectory && activeFilePath === file.path
        }
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ file, x: e.clientX, y: e.clientY });
        }}
        isRenaming={renamingFilePath === file.path}
        onRenameSubmit={(newName) => {
          onRenameFile?.(file, newName);
          setRenamingFilePath(null);
        }}
        onRenameCancel={() => setRenamingFilePath(null)}
        onStartRename={() => setRenamingFilePath(file.path)}
        isModified={status?.modified}
        hasError={status?.hasError}
      />,
    );

    // Render inline input after the target directory's children.
    if (
      creatingInDir !== null &&
      !isRootCreation &&
      creatingInRelDir !== null
    ) {
      const isTargetOrChild =
        file.path === creatingInRelDir ||
        file.path.startsWith(creatingInRelDir + "/");
      const nextFile = visibleItems[i + 1];
      const nextIsChild =
        nextFile?.path.startsWith(creatingInRelDir + "/");

      if (isTargetOrChild && !nextIsChild) {
        items.push(
          <React.Fragment key="__new-file-input">{renderInlineInput()}</React.Fragment>,
        );
      }
    }
  }

  return <>{items}</>;
}

// ---- Component ----

export function ExplorerPanel({
  projects,
  onToggleDir,
  onOpenFile,
  onExpandAll,
  onCollapseAll,
  filter,
  onFilterChange,
  formatFilter,
  onFormatFilterChange,
  onRefresh,
  onOpenFolder,
  onAddFolder,
  onRemoveRoot,
  activeFilePath,
  className,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  fileStatuses,
}: ExplorerPanelProps) {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ file: ProjectFile; x: number; y: number } | null>(null);
  // Inline new-file creation state: the directory path where a file is being created.
  const [creatingInDir, setCreatingInDir] = useState<string | null>(null);
  // Inline rename state: which file path is being renamed.
  const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
  // Delete confirmation dialog state.
  const [deletingFile, setDeletingFile] = useState<ProjectFile | null>(null);
  // Track which root sections are expanded (all expanded by default).
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(
    () => new Set(projects.map((p) => p.rootPath)),
  );

  // Ensure newly mounted roots are automatically expanded.
  const expandedRootsResolved = useMemo(() => {
    const next = new Set(expandedRoots);
    for (const p of projects) {
      if (!expandedRoots.has(p.rootPath) && !expandedRoots.has("__initialized")) {
        next.add(p.rootPath);
      }
    }
    return next;
  }, [projects, expandedRoots]);

  const toggleRootExpanded = useCallback((rootPath: string) => {
    setExpandedRoots((prev) => {
      const next = new Set(prev);
      if (next.has(rootPath)) {
        next.delete(rootPath);
      } else {
        next.add(rootPath);
      }
      return next;
    });
  }, []);

  const handleFormatClick = useCallback(
    (ft: FileType) => {
      onFormatFilterChange(formatFilter === ft ? null : ft);
    },
    [formatFilter, onFormatFilterChange],
  );

  // Total file count across all roots.
  const totalFileCount = useMemo(() => {
    return projects.reduce((sum, p) => sum + countFiles(p.files), 0);
  }, [projects]);

  // Find which project a context menu file belongs to.
  const contextProject = useMemo(() => {
    if (!contextMenu) return projects[0] ?? null;
    return projects.find((p) =>
      contextMenu.file.path.startsWith(p.rootPath) ||
      p.files.some(function findFile(f: ProjectFile): boolean {
        if (f.path === contextMenu.file.path) return true;
        return f.children?.some(findFile) ?? false;
      }),
    ) ?? projects[0] ?? null;
  }, [contextMenu, projects]);

  // ---- Empty state ----
  if (projects.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col h-full bg-[#05060a]",
          className,
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 border-b border-[#2d3240]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6f7f9a]">
              Explorer
            </span>
          </div>
        </div>

        {/* Hero empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <IconFolderOpen
            size={48}
            stroke={0.8}
            className="text-[#6f7f9a]/20"
          />
          <div className="space-y-1.5">
            <p className="text-[13px] font-mono text-[#ece7dc]/70 font-medium">
              No folder open
            </p>
            <p className="text-[10px] font-mono text-[#6f7f9a]/50 leading-relaxed max-w-[180px]">
              Open a folder containing detection rules to get started.
            </p>
          </div>
          {onOpenFolder && (
            <button
              type="button"
              onClick={onOpenFolder}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] font-mono font-medium rounded-md border border-[#d4a84b]/30 text-[#d4a84b] bg-[#d4a84b]/5 hover:bg-[#d4a84b]/15 hover:border-[#d4a84b]/50 transition-colors"
            >
              <IconFolderOpen size={16} stroke={1.5} />
              Open Folder
            </button>
          )}
          {onAddFolder && (
            <button
              type="button"
              onClick={onAddFolder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-[#6f7f9a]/60 hover:text-[#ece7dc] transition-colors"
            >
              <IconPlus size={12} stroke={1.5} />
              Add Folder to Workspace
            </button>
          )}
        </div>
      </div>
    );
  }

  // Convenience: for single root, use the first project as backward-compat reference.
  const firstProject = projects[0];
  const isMultiRoot = projects.length > 1;

  // ---- Active project(s) ----
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#05060a]",
        className,
      )}
    >
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[#2d3240]">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#6f7f9a]">
            Explorer
          </span>

          {/* Toolbar */}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => firstProject && setCreatingInDir(firstProject.rootPath)}
              title="New File"
              className="p-1 rounded text-[#6f7f9a]/60 hover:text-[#ece7dc] hover:bg-[#131721]/40 transition-colors"
            >
              <IconFilePlus size={12} stroke={1.5} />
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh"
                className="p-1 rounded text-[#6f7f9a]/60 hover:text-[#ece7dc] hover:bg-[#131721]/40 transition-colors"
              >
                <IconRefresh size={12} stroke={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onExpandAll}
              title="Expand All"
              className="p-1 rounded text-[#6f7f9a]/60 hover:text-[#ece7dc] hover:bg-[#131721]/40 transition-colors"
            >
              <IconArrowsMaximize size={12} stroke={1.5} />
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              title="Collapse All"
              className="p-1 rounded text-[#6f7f9a]/60 hover:text-[#ece7dc] hover:bg-[#131721]/40 transition-colors"
            >
              <IconArrowsMinimize size={12} stroke={1.5} />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-2">
          <IconSearch
            size={11}
            stroke={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6f7f9a]/40 pointer-events-none"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-[#0b0d13] border border-[#2d3240] rounded text-[11px] font-mono text-[#ece7dc] pl-7 pr-2 py-1 outline-none transition-colors placeholder:text-[#6f7f9a]/40 focus:border-[#d4a84b]/40"
          />
        </div>

        {/* Format filter dots */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-[#6f7f9a]/40 uppercase tracking-wide">
            File type
          </span>
          <div className="flex items-center gap-1.5">
            {ALL_FILE_TYPES.map((ft) => (
              <FormatDot
                key={ft}
                fileType={ft}
                active={formatFilter === ft}
                onClick={() => handleFormatClick(ft)}
              />
            ))}
          </div>
          {formatFilter && (
            <button
              type="button"
              onClick={() => onFormatFilterChange(null)}
              className="text-[8px] font-mono text-[#6f7f9a]/50 hover:text-[#ece7dc] transition-colors ml-auto"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Single-root: collapsible project name header with item count */}
      {!isMultiRoot && (
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-[#2d3240]/50 cursor-pointer hover:bg-[#131721]/20"
          onClick={() => toggleRootExpanded(firstProject.rootPath)}
        >
          <IconChevronRight
            size={10}
            stroke={1.5}
            className={cn(
              "text-[#6f7f9a]/60 transition-transform",
              expandedRootsResolved.has(firstProject.rootPath) && "rotate-90",
            )}
          />
          <span className="text-[10px] font-mono font-semibold text-[#ece7dc]/80 truncate">
            {firstProject.name}
          </span>
          <span className="text-[9px] font-mono text-[#6f7f9a]/40 ml-0.5">
            ({countFiles(firstProject.files)})
          </span>
        </div>
      )}

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isMultiRoot ? (
            // Multi-root: render each root as a collapsible section
            projects.map((project) => {
              const isExpanded = expandedRootsResolved.has(project.rootPath);
              return (
                <div key={project.rootPath}>
                  {/* Root section header */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#2d3240]/50 cursor-pointer hover:bg-[#131721]/20"
                    onClick={() => toggleRootExpanded(project.rootPath)}
                  >
                    <IconChevronRight
                      size={10}
                      stroke={1.5}
                      className={cn(
                        "text-[#6f7f9a]/60 transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <IconFolder size={12} stroke={1.5} className="text-[#6f7f9a]" />
                    <span className="text-[10px] font-mono font-semibold text-[#ece7dc]/80 truncate flex-1">
                      {project.name}
                    </span>
                    <span className="text-[9px] font-mono text-[#6f7f9a]/40">
                      ({countFiles(project.files)})
                    </span>
                  </div>
                  {/* Root section tree content */}
                  {isExpanded && (
                    <RootTreeSection
                      project={project}
                      filter={filter}
                      formatFilter={formatFilter}
                      onToggleDir={onToggleDir}
                      onOpenFile={onOpenFile}
                      activeFilePath={activeFilePath}
                      fileStatuses={fileStatuses}
                      onCreateFile={onCreateFile}
                      onRenameFile={onRenameFile}
                      onDeleteFile={onDeleteFile}
                      creatingInDir={creatingInDir}
                      setCreatingInDir={setCreatingInDir}
                      renamingFilePath={renamingFilePath}
                      setRenamingFilePath={setRenamingFilePath}
                      contextMenu={contextMenu}
                      setContextMenu={setContextMenu}
                      setDeletingFile={setDeletingFile}
                    />
                  )}
                </div>
              );
            })
          ) : (
            // Single-root: render tree only when root is expanded
            expandedRootsResolved.has(firstProject.rootPath) && (
              <RootTreeSection
                project={firstProject}
                filter={filter}
                formatFilter={formatFilter}
                onToggleDir={onToggleDir}
                onOpenFile={onOpenFile}
                activeFilePath={activeFilePath}
                fileStatuses={fileStatuses}
                onCreateFile={onCreateFile}
                onRenameFile={onRenameFile}
                onDeleteFile={onDeleteFile}
                creatingInDir={creatingInDir}
                setCreatingInDir={setCreatingInDir}
                renamingFilePath={renamingFilePath}
                setRenamingFilePath={setRenamingFilePath}
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
                setDeletingFile={setDeletingFile}
              />
            )
          )}
        </div>

        {/* Add Folder button at bottom of tree area */}
        {onAddFolder && (
          <button
            type="button"
            onClick={onAddFolder}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-[10px] font-mono text-[#6f7f9a]/60 hover:text-[#ece7dc] hover:bg-[#131721]/40 transition-colors border-t border-[#2d3240]/30"
          >
            <IconPlus size={12} stroke={1.5} />
            Add Folder
          </button>
        )}
      </ScrollArea>

      {/* Context menu overlay */}
      {contextMenu && contextProject && (
        <ExplorerContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            // If the context target is a directory, create in it. Otherwise use parent dir.
            const targetPath = contextMenu.file.isDirectory
              ? contextMenu.file.path
              : contextMenu.file.path.substring(0, contextMenu.file.path.lastIndexOf("/")) || contextProject.rootPath;
            // For relative paths, resolve to absolute for the store action.
            const absPath = targetPath.startsWith("/") ? targetPath : `${contextProject.rootPath}/${targetPath}`;
            setCreatingInDir(absPath);
            setContextMenu(null);
          }}
          onRename={() => {
            setRenamingFilePath(contextMenu.file.path);
            setContextMenu(null);
          }}
          onDelete={() => {
            setDeletingFile(contextMenu.file);
            setContextMenu(null);
          }}
        />
      )}

      {/* Footer status bar */}
      <div className="shrink-0 px-3 py-1.5 border-t border-[#2d3240] flex items-center gap-2">
        <span className="text-[9px] font-mono text-[#6f7f9a]/40">
          {totalFileCount} {totalFileCount === 1 ? "file" : "files"}
        </span>
        {isMultiRoot && (
          <span className="text-[9px] font-mono text-[#6f7f9a]/30">
            {projects.length} {projects.length === 1 ? "root" : "roots"}
          </span>
        )}
        {formatFilter && (
          <span
            className="text-[9px] font-mono"
            style={{ color: FILE_TYPE_REGISTRY[formatFilter].iconColor }}
          >
            {FILE_TYPE_REGISTRY[formatFilter].shortLabel}
          </span>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        file={deletingFile}
        open={deletingFile !== null}
        onConfirm={() => {
          if (deletingFile) {
            onDeleteFile?.(deletingFile);
          }
          setDeletingFile(null);
        }}
        onCancel={() => setDeletingFile(null)}
      />
    </div>
  );
}

/** Count total non-directory files in the tree. */
function countFiles(files: ProjectFile[]): number {
  let count = 0;
  for (const f of files) {
    if (f.isDirectory) {
      count += f.children ? countFiles(f.children) : 0;
    } else {
      count += 1;
    }
  }
  return count;
}
