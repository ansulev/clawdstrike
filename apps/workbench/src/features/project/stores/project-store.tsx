import { create } from "zustand";
import { createSelectors } from "@/lib/create-selectors";
import type { FileType } from "@/lib/workbench/file-type-registry";
import { getFileTypeByExtension } from "@/lib/workbench/file-type-registry";

// ---- Types ----

export interface ProjectFile {
  /** Relative path within the project root. */
  path: string;
  /** File name (last segment of path). */
  name: string;
  /** Detected file type (only meaningful for files, not directories). */
  fileType: FileType;
  /** Whether this entry represents a directory. */
  isDirectory: boolean;
  /** Child entries (only present for directories). */
  children?: ProjectFile[];
  /** Nesting depth (0 = root). */
  depth: number;
}

export interface DetectionProject {
  /** Absolute path to the project root directory. */
  rootPath: string;
  /** Human-readable project name (usually the directory basename). */
  name: string;
  /** Hierarchical file tree. */
  files: ProjectFile[];
  /** Set of directory paths currently expanded in the UI. */
  expandedDirs: Set<string>;
}

interface ProjectState {
  project: DetectionProject | null;
  loading: boolean;
  error: string | null;
  /** Free-text filename filter. */
  filter: string;
  /** Filter files by a specific format. */
  formatFilter: FileType | null;
}

// ---- Helpers ----

/** Collect every directory path from a file tree. */
function collectDirPaths(files: ProjectFile[]): string[] {
  const paths: string[] = [];
  for (const f of files) {
    if (f.isDirectory) {
      paths.push(f.path);
      if (f.children) {
        paths.push(...collectDirPaths(f.children));
      }
    }
  }
  return paths;
}

// ---- Build file tree from flat paths ----

/**
 * Build a hierarchical `ProjectFile[]` tree from a flat list of relative paths.
 *
 * Paths like `["sigma/windows/proc.yml", "yara/malware.yar", "policies/strict.yaml"]`
 * produce a nested tree with proper `isDirectory`, `children`, `depth`, and
 * `fileType` detection.
 *
 * File type detection for YAML files is ambiguous without content, so the
 * heuristic uses path segments: paths containing `sigma` resolve to
 * `sigma_rule`, paths containing `policies` or `rulesets` resolve to
 * `clawdstrike_policy`, and other YAML files default to `clawdstrike_policy`.
 */
export function buildFileTree(rootPath: string, paths: string[]): ProjectFile[] {
  // Intermediate tree node used during construction.
  interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children: Map<string, TreeNode>;
    depth: number;
  }

  const root: TreeNode = {
    name: "",
    path: "",
    isDirectory: true,
    children: new Map(),
    depth: -1,
  };

  // Insert each path segment-by-segment.
  for (const relPath of paths) {
    const segments = relPath.split("/").filter(Boolean);
    let current = root;
    let accumulated = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      const isLast = i === segments.length - 1;

      if (!current.children.has(segment)) {
        current.children.set(segment, {
          name: segment,
          path: accumulated,
          isDirectory: !isLast,
          children: new Map(),
          depth: i,
        });
      } else if (!isLast) {
        // Ensure intermediate nodes are marked as directories.
        const existing = current.children.get(segment)!;
        existing.isDirectory = true;
      }

      current = current.children.get(segment)!;
    }
  }

  // Convert the intermediate tree to ProjectFile[].
  function convert(node: TreeNode): ProjectFile[] {
    const entries = Array.from(node.children.values());

    // Sort: directories first, then alphabetical.
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return entries.map((entry): ProjectFile => {
      const fileType = entry.isDirectory
        ? inferFileTypeFromPath(entry.path, entry.name)
        : inferFileTypeFromPath(entry.path, entry.name);

      const children = entry.isDirectory ? convert(entry) : undefined;

      return {
        path: entry.path,
        name: entry.name,
        fileType,
        isDirectory: entry.isDirectory,
        children,
        depth: entry.depth,
      };
    });
  }

  return convert(root);
}

/**
 * Infer a FileType from a path string. For unambiguous extensions (.yar, .json)
 * the result is deterministic. For YAML files we use path-segment heuristics.
 */
function inferFileTypeFromPath(relPath: string, name: string): FileType {
  // Unambiguous by extension
  const byExt = getFileTypeByExtension(name);
  if (byExt !== null) return byExt;

  // YAML heuristic: check path segments
  const lowerPath = relPath.toLowerCase();
  if (lowerPath.includes("sigma")) return "sigma_rule";
  if (lowerPath.includes("policies") || lowerPath.includes("rulesets")) {
    return "clawdstrike_policy";
  }

  // Default for YAML
  return "clawdstrike_policy";
}

// ---- Zustand store ----

interface ProjectStoreState extends ProjectState {
  actions: {
    /** Set the current project. */
    setProject: (project: DetectionProject) => void;
    /** Clear the current project. */
    clearProject: () => void;
    /** Set the loading state. */
    setLoading: (loading: boolean) => void;
    /** Set the error state. */
    setError: (error: string | null) => void;
    /** Toggle a directory's expand/collapse state. */
    toggleDir: (path: string) => void;
    /** Set the free-text filename filter. */
    setFilter: (filter: string) => void;
    /** Set the format filter (or null to clear). */
    setFormatFilter: (format: FileType | null) => void;
    /** Expand all directories. */
    expandAll: () => void;
    /** Collapse all directories. */
    collapseAll: () => void;
  };
}

const useProjectStoreBase = create<ProjectStoreState>()((set, get) => ({
  project: null,
  loading: false,
  error: null,
  filter: "",
  formatFilter: null,

  actions: {
    setProject: (project: DetectionProject) => {
      set({ project, loading: false, error: null });
    },

    clearProject: () => {
      set({ project: null, error: null, filter: "", formatFilter: null });
    },

    setLoading: (loading: boolean) => {
      set({ loading });
    },

    setError: (error: string | null) => {
      set({ error, loading: false });
    },

    toggleDir: (path: string) => {
      const { project } = get();
      if (!project) return;
      const next = new Set(project.expandedDirs);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      set({ project: { ...project, expandedDirs: next } });
    },

    setFilter: (filter: string) => {
      set({ filter });
    },

    setFormatFilter: (format: FileType | null) => {
      set({ formatFilter: format });
    },

    expandAll: () => {
      const { project } = get();
      if (!project) return;
      const allDirs = collectDirPaths(project.files);
      set({ project: { ...project, expandedDirs: new Set(allDirs) } });
    },

    collapseAll: () => {
      const { project } = get();
      if (!project) return;
      set({ project: { ...project, expandedDirs: new Set<string>() } });
    },
  },
}));

export const useProjectStore = createSelectors(useProjectStoreBase);

// ---------------------------------------------------------------------------
// Backward-compatible hook
// ---------------------------------------------------------------------------

interface ProjectContextValue {
  state: ProjectState;
  dispatch: never;
  /** Toggle a directory's expand/collapse state. */
  toggleDir: (path: string) => void;
  /** Set the free-text filename filter. */
  setFilter: (filter: string) => void;
  /** Set the format filter (or null to clear). */
  setFormatFilter: (format: FileType | null) => void;
  /** Expand all directories. */
  expandAll: () => void;
  /** Collapse all directories. */
  collapseAll: () => void;
  /** Set the current project. */
  setProject: (project: DetectionProject) => void;
  /** Clear the current project. */
  clearProject: () => void;
}

/** @deprecated Use useProjectStore directly */
export function useProject(): ProjectContextValue {
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const filter = useProjectStore((s) => s.filter);
  const formatFilter = useProjectStore((s) => s.formatFilter);
  const actions = useProjectStore((s) => s.actions);

  return {
    state: { project, loading, error, filter, formatFilter },
    dispatch: undefined as never,
    toggleDir: actions.toggleDir,
    setFilter: actions.setFilter,
    setFormatFilter: actions.setFormatFilter,
    expandAll: actions.expandAll,
    collapseAll: actions.collapseAll,
    setProject: actions.setProject,
    clearProject: actions.clearProject,
  };
}
