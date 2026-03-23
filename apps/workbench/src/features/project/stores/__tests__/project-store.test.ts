import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProjectFileStatusKey,
  useProjectStore,
  type DetectionProject,
  type ProjectFile,
} from "../project-store";
import { getActivePaneRoute, usePaneStore } from "@/features/panes/pane-store";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { getDocumentIdentityStore } from "@/lib/workbench/detection-workflow/document-identity-store";

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
    localStorage.clear();
    renameDetectionFileMock.mockReset();
    renameDetectionFileMock.mockResolvedValue(true);
    usePaneStore.getState()._reset();
    usePolicyTabsStore.getState()._reset();
    getDocumentIdentityStore().clear();

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
    const originalPath = "/workspace/bravo/policies/default.yaml";
    const renamedPath = "/workspace/bravo/policies/renamed.yaml";
    actions.setFileStatus("/workspace/bravo/policies/default.yaml", { modified: true });
    getDocumentIdentityStore().register(originalPath, "doc-bravo");

    usePolicyTabsStore
      .getState()
      .openTabOrSwitch(
        originalPath,
        "clawdstrike_policy",
        'name: "Bravo"\nversion: "1.0.0"\n',
        "default.yaml",
      );
    usePaneStore.getState().openFile(originalPath, "default.yaml");

    await actions.renameFile(originalPath, "renamed.yaml");

    expect(renameDetectionFileMock).toHaveBeenCalledWith(
      originalPath,
      renamedPath,
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
    expect(
      usePolicyTabsStore.getState().tabs.find((tab) => tab.filePath === renamedPath),
    ).toBeTruthy();
    expect(getDocumentIdentityStore().resolve(originalPath)).toBeNull();
    expect(getDocumentIdentityStore().resolve(renamedPath)).toBe("doc-bravo");
    expect(
      getActivePaneRoute(usePaneStore.getState().root, usePaneStore.getState().activePaneId),
    ).toBe(`/file/${renamedPath}`);
  });
});
