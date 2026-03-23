import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProjectFileStatusKey,
  useProjectStore,
  type DetectionProject,
  type ProjectFile,
} from "../project-store";

const renameDetectionFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri-bridge", () => ({
  renameDetectionFile: renameDetectionFileMock,
  createDetectionFile: vi.fn(),
  deleteDetectionFile: vi.fn(),
}));

function makeProject(rootPath: string): DetectionProject {
  const file: ProjectFile = {
    path: "policies/default.yaml",
    name: "default.yaml",
    fileType: "clawdstrike_policy",
    isDirectory: false,
    depth: 1,
  };

  return {
    rootPath,
    name: rootPath.split("/").pop() ?? rootPath,
    expandedDirs: new Set(["policies"]),
    files: [
      {
        path: "policies",
        name: "policies",
        fileType: "clawdstrike_policy",
        isDirectory: true,
        depth: 0,
        children: [file],
      },
    ],
  };
}

function hasPath(files: ProjectFile[], targetPath: string): boolean {
  return files.some((file) => {
    if (file.path === targetPath) return true;
    return file.children ? hasPath(file.children, targetPath) : false;
  });
}

describe("useProjectStore", () => {
  beforeEach(() => {
    renameDetectionFileMock.mockReset();
    renameDetectionFileMock.mockResolvedValue(true);

    const baseActions = useProjectStore.getState().actions;
    useProjectStore.setState({
      project: makeProject("/workspace/alpha"),
      loading: false,
      error: null,
      filter: "",
      formatFilter: null,
      fileStatuses: new Map(),
      projectRoots: ["/workspace/alpha", "/workspace/bravo"],
      projects: new Map([
        ["/workspace/alpha", makeProject("/workspace/alpha")],
        ["/workspace/bravo", makeProject("/workspace/bravo")],
      ]),
      actions: {
        ...baseActions,
        loadRoot: vi.fn(async () => {}),
      },
    });
  });

  it("routes rename and file status migration through the owning workspace", async () => {
    const actions = useProjectStore.getState().actions;
    actions.setFileStatus("/workspace/bravo/policies/default.yaml", { modified: true });

    await actions.renameFile("/workspace/bravo/policies/default.yaml", "renamed.yaml");

    expect(renameDetectionFileMock).toHaveBeenCalledWith(
      "/workspace/bravo/policies/default.yaml",
      "/workspace/bravo/policies/renamed.yaml",
    );

    const state = useProjectStore.getState();
    expect(
      hasPath(
        state.projects.get("/workspace/alpha")?.files ?? [],
        "policies/default.yaml",
      ),
    ).toBe(true);
    expect(
      hasPath(
        state.projects.get("/workspace/bravo")?.files ?? [],
        "policies/renamed.yaml",
      ),
    ).toBe(true);
    expect(
      hasPath(
        state.projects.get("/workspace/bravo")?.files ?? [],
        "policies/default.yaml",
      ),
    ).toBe(false);

    expect(
      state.fileStatuses.get(
        getProjectFileStatusKey("/workspace/bravo", "policies/renamed.yaml"),
      ),
    ).toEqual({ modified: true });
    expect(
      state.fileStatuses.has(
        getProjectFileStatusKey("/workspace/bravo", "policies/default.yaml"),
      ),
    ).toBe(false);
  });
});
