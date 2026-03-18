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

/** Per-file status flags for Explorer visual indicators. */
export interface FileStatus {
  /** File has unsaved modifications. */
  modified?: boolean;
  /** File has validation errors. */
  hasError?: boolean;
}

interface ProjectState {
  project: DetectionProject | null;
  loading: boolean;
  error: string | null;
  /** Free-text filename filter. */
  filter: string;
  /** Filter files by a specific format. */
  formatFilter: FileType | null;
  /** Per-file status map (keyed by relative file path). */
  fileStatuses: Map<string, FileStatus>;
  /** Absolute paths of mounted workspace roots (multi-root support). */
  projectRoots: string[];
  /** DetectionProject instances keyed by rootPath (one per mounted root). */
  projects: Map<string, DetectionProject>;
}

// ---------------------------------------------------------------------------
// Multi-root persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "clawdstrike_workspace_roots";

/** Read persisted workspace roots from localStorage. */
function loadPersistedRoots(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist workspace roots to localStorage. */
function persistRoots(roots: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roots));
  } catch {
    // localStorage may be unavailable in some environments.
  }
}

/**
 * Recursively scan a directory via Tauri fs readDir and collect relative paths.
 * Directories get a trailing "/" to distinguish them from files.
 */
async function scanDir(dirPath: string, basePath: string): Promise<string[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dirPath);
  const paths: string[] = [];
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`;
    const relPath = fullPath.slice(basePath.length + 1);
    if (entry.isDirectory) {
      paths.push(relPath + "/");
      const subPaths = await scanDir(fullPath, basePath);
      paths.push(...subPaths);
    } else {
      paths.push(relPath);
    }
  }
  return paths;
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

// ---- Tree mutation helpers ----

/**
 * Recursively walk a ProjectFile[] tree and apply a mutator when the target
 * node is found. Returns a new tree (shallow copies along the path).
 *
 * The mutator receives the parent's children array and the index of the
 * matching node, and must return the replacement children array.
 */
function mutateTree(
  files: ProjectFile[],
  targetPath: string,
  mutator: (siblings: ProjectFile[], index: number) => ProjectFile[],
): ProjectFile[] {
  for (let i = 0; i < files.length; i++) {
    if (files[i].path === targetPath) {
      return mutator([...files], i);
    }
    if (files[i].isDirectory && files[i].children) {
      const mutated = mutateTree(files[i].children!, targetPath, mutator);
      if (mutated !== files[i].children) {
        const copy = [...files];
        copy[i] = { ...copy[i], children: mutated };
        return copy;
      }
    }
  }
  return files;
}

/** Sort children: directories first, then alphabetical by name. */
function sortChildren(children: ProjectFile[]): ProjectFile[] {
  return [...children].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Insert a new ProjectFile into a directory node's children. Returns new tree.
 */
function insertIntoDir(
  files: ProjectFile[],
  parentPath: string,
  newNode: ProjectFile,
): ProjectFile[] {
  for (let i = 0; i < files.length; i++) {
    if (files[i].path === parentPath && files[i].isDirectory) {
      const copy = [...files];
      const updatedChildren = sortChildren([...(copy[i].children ?? []), newNode]);
      copy[i] = { ...copy[i], children: updatedChildren };
      return copy;
    }
    if (files[i].isDirectory && files[i].children) {
      const mutated = insertIntoDir(files[i].children!, parentPath, newNode);
      if (mutated !== files[i].children) {
        const copy = [...files];
        copy[i] = { ...copy[i], children: mutated };
        return copy;
      }
    }
  }
  return files;
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
    /** Create a new file in the given directory. Returns the new file path or null. */
    createFile: (parentDirPath: string, fileName: string, fileType: FileType) => Promise<string | null>;
    /** Rename a file. Returns true on success. */
    renameFile: (oldPath: string, newName: string) => Promise<boolean>;
    /** Delete a file. Returns true on success. */
    deleteFile: (filePath: string) => Promise<boolean>;
    /** Set or merge file status flags for a given file path. */
    setFileStatus: (filePath: string, status: FileStatus) => void;
    /** Clear file status for a given file path. */
    clearFileStatus: (filePath: string) => void;
    /** Add a root folder to the multi-root workspace. */
    addRoot: (rootPath: string) => void;
    /** Remove a root folder from the multi-root workspace. */
    removeRoot: (rootPath: string) => void;
    /** Scan a root directory and populate its DetectionProject. */
    loadRoot: (rootPath: string) => Promise<void>;
    /** Initialize the store from persisted workspace roots. */
    initFromPersistedRoots: () => Promise<void>;
    /** Toggle expand/collapse for a directory within a specific root. */
    toggleDirForRoot: (rootPath: string, dirPath: string) => void;
  };
}

const useProjectStoreBase = create<ProjectStoreState>()((set, get) => ({
  project: null,
  loading: false,
  error: null,
  filter: "",
  formatFilter: null,
  fileStatuses: new Map<string, FileStatus>(),
  projectRoots: loadPersistedRoots(),
  projects: new Map<string, DetectionProject>(),

  actions: {
    setProject: (project: DetectionProject) => {
      set({ project, loading: false, error: null });
    },

    clearProject: () => {
      set({ project: null, error: null, filter: "", formatFilter: null, fileStatuses: new Map() });
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

    createFile: async (parentDirPath: string, fileName: string, fileType: FileType): Promise<string | null> => {
      const { project } = get();
      if (!project) return null;

      const { createDetectionFile } = await import("@/lib/tauri-bridge");
      const savedPath = await createDetectionFile(parentDirPath, fileName, fileType);
      if (!savedPath) return null;

      // Compute the relative path within the project.
      const relPath = savedPath.startsWith(project.rootPath)
        ? savedPath.slice(project.rootPath.length).replace(/^\//, "")
        : fileName;

      // Compute parent relative path.
      const parentRelPath = parentDirPath.startsWith(project.rootPath)
        ? parentDirPath.slice(project.rootPath.length).replace(/^\//, "")
        : parentDirPath;

      // Compute depth from relative path segments.
      const depth = relPath.split("/").filter(Boolean).length - 1;

      const newNode: ProjectFile = {
        path: relPath,
        name: fileName,
        fileType: inferFileTypeFromPath(relPath, fileName),
        isDirectory: false,
        depth,
      };

      // Insert into tree and auto-expand the parent directory.
      let newFiles: ProjectFile[];
      if (parentRelPath === "" || parentDirPath === project.rootPath) {
        // Inserting at root level.
        newFiles = sortChildren([...project.files, newNode]);
      } else {
        newFiles = insertIntoDir(project.files, parentRelPath, newNode);
      }

      const expandedDirs = new Set(project.expandedDirs);
      if (parentRelPath) {
        expandedDirs.add(parentRelPath);
      }

      set({ project: { ...project, files: newFiles, expandedDirs } });
      return savedPath;
    },

    renameFile: async (oldPath: string, newName: string): Promise<boolean> => {
      const { project } = get();
      if (!project) return false;

      // oldPath may be relative; resolve to absolute for Tauri APIs.
      const oldAbsPath = oldPath.startsWith("/")
        ? oldPath
        : `${project.rootPath}/${oldPath}`;

      // Compute new absolute path by replacing the last segment.
      const lastSlash = oldAbsPath.lastIndexOf("/");
      const newAbsPath = lastSlash >= 0
        ? oldAbsPath.substring(0, lastSlash + 1) + newName
        : `${project.rootPath}/${newName}`;

      const { renameDetectionFile } = await import("@/lib/tauri-bridge");
      const ok = await renameDetectionFile(oldAbsPath, newAbsPath);
      if (!ok) return false;

      // Compute relative paths.
      const oldRelPath = oldAbsPath.startsWith(project.rootPath)
        ? oldAbsPath.slice(project.rootPath.length).replace(/^\//, "")
        : oldPath;
      const newRelPath = newAbsPath.startsWith(project.rootPath)
        ? newAbsPath.slice(project.rootPath.length).replace(/^\//, "")
        : newName;

      const newFiles = mutateTree(project.files, oldRelPath, (siblings, idx) => {
        siblings[idx] = {
          ...siblings[idx],
          name: newName,
          path: newRelPath,
          fileType: inferFileTypeFromPath(newRelPath, newName),
        };
        return sortChildren(siblings);
      });

      // Migrate file status entry from old to new path.
      const fileStatuses = new Map(get().fileStatuses);
      const oldStatus = fileStatuses.get(oldRelPath);
      if (oldStatus) {
        fileStatuses.delete(oldRelPath);
        fileStatuses.set(newRelPath, oldStatus);
      }

      set({ project: { ...project, files: newFiles }, fileStatuses });
      return true;
    },

    deleteFile: async (filePath: string): Promise<boolean> => {
      const { project } = get();
      if (!project) return false;

      // filePath may be relative; resolve to absolute for Tauri APIs.
      const absPath = filePath.startsWith("/")
        ? filePath
        : `${project.rootPath}/${filePath}`;

      const { deleteDetectionFile } = await import("@/lib/tauri-bridge");
      const ok = await deleteDetectionFile(absPath);
      if (!ok) return false;

      // Compute relative path.
      const relPath = absPath.startsWith(project.rootPath)
        ? absPath.slice(project.rootPath.length).replace(/^\//, "")
        : filePath;

      const newFiles = mutateTree(project.files, relPath, (siblings, idx) => {
        siblings.splice(idx, 1);
        return siblings;
      });

      // Remove stale file status entry.
      const fileStatuses = new Map(get().fileStatuses);
      fileStatuses.delete(relPath);

      set({ project: { ...project, files: newFiles }, fileStatuses });
      return true;
    },

    setFileStatus: (filePath: string, status: FileStatus) => {
      const next = new Map(get().fileStatuses);
      next.set(filePath, { ...next.get(filePath), ...status });
      set({ fileStatuses: next });
    },

    clearFileStatus: (filePath: string) => {
      const next = new Map(get().fileStatuses);
      next.delete(filePath);
      set({ fileStatuses: next });
    },

    addRoot: (rootPath: string) => {
      const { projectRoots } = get();
      if (projectRoots.includes(rootPath)) return;
      const newRoots = [...projectRoots, rootPath];
      persistRoots(newRoots);
      set({ projectRoots: newRoots });
      // Trigger async scan (fire-and-forget from the synchronous action).
      get().actions.loadRoot(rootPath);
    },

    removeRoot: (rootPath: string) => {
      const { projectRoots, projects } = get();
      const newRoots = projectRoots.filter((r) => r !== rootPath);
      persistRoots(newRoots);
      const newProjects = new Map(projects);
      newProjects.delete(rootPath);
      // Update backward-compat `project` field.
      const firstProject = newRoots.length > 0 ? newProjects.get(newRoots[0]) ?? null : null;
      set({
        projectRoots: newRoots,
        projects: newProjects,
        project: firstProject,
      });
    },

    loadRoot: async (rootPath: string) => {
      try {
        const paths = await scanDir(rootPath, rootPath);
        const files = buildFileTree(rootPath, paths);
        const name = rootPath.split("/").filter(Boolean).pop() ?? "workspace";
        const allDirs = collectDirPaths(files);

        const dp: DetectionProject = {
          rootPath,
          name,
          files,
          expandedDirs: new Set(allDirs),
        };

        const newProjects = new Map(get().projects);
        newProjects.set(rootPath, dp);

        // Backward compat: set `project` to the first root's DetectionProject.
        const { projectRoots } = get();
        const firstRoot = projectRoots.length > 0 ? projectRoots[0] : rootPath;
        const firstProject = newProjects.get(firstRoot) ?? dp;

        set({ projects: newProjects, project: firstProject });
      } catch (err) {
        console.error("[project-store] Failed to load root:", rootPath, err);
      }
    },

    initFromPersistedRoots: async () => {
      const roots = loadPersistedRoots();
      if (roots.length === 0) return;
      set({ projectRoots: roots });
      for (const root of roots) {
        await get().actions.loadRoot(root);
      }
    },

    toggleDirForRoot: (rootPath: string, dirPath: string) => {
      const { projects } = get();
      const dp = projects.get(rootPath);
      if (!dp) return;
      const next = new Set(dp.expandedDirs);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      const updated = { ...dp, expandedDirs: next };
      const newProjects = new Map(projects);
      newProjects.set(rootPath, updated);
      // If this is the first root, also update backward-compat `project`.
      const { projectRoots } = get();
      const isFirstRoot = projectRoots.length > 0 && projectRoots[0] === rootPath;
      set({
        projects: newProjects,
        ...(isFirstRoot ? { project: updated } : {}),
      });
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
    state: { project, loading, error, filter, formatFilter, fileStatuses: new Map() },
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
