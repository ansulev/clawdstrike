import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPanelConnected } from "../components/search-panel";
import { useSearchStore } from "../stores/search-store";
import { useProjectStore } from "@/features/project/stores/project-store";
import { usePaneStore } from "@/features/panes/pane-store";
import { consumePendingEditorReveal } from "@/lib/workbench/editor-reveal";

const openFileByPath = vi.fn<(...args: [string]) => Promise<void>>();
const { searchInProjectNative, mockedWorkbenchState } = vi.hoisted(() => ({
  searchInProjectNative: vi.fn(),
  mockedWorkbenchState: {
    tabs: [] as Array<{ filePath?: string | null }>,
  },
}));

vi.mock("@/lib/tauri-commands", () => ({
  searchInProjectNative,
}));

vi.mock("@/features/policy/stores/policy-store", () => ({
  useWorkbench: () => ({
    openFileByPath,
  }),
  useMultiPolicy: () => ({
    tabs: mockedWorkbenchState.tabs,
  }),
}));

describe("SearchPanelConnected", () => {
  beforeEach(() => {
    openFileByPath.mockReset();
    openFileByPath.mockResolvedValue();
    searchInProjectNative.mockReset();
    searchInProjectNative.mockResolvedValue({
      matches: [],
      file_count: 0,
      total_matches: 0,
      truncated: false,
    });
    mockedWorkbenchState.tabs = [
      { filePath: "/workspace/project/policies/example.yml" },
      { filePath: "/workspace/project/rules/other.yml" },
    ];
    usePaneStore.getState()._reset();
    useProjectStore.setState({
      projectRoots: ["/workspace/project"],
      projects: new Map([
        [
          "/workspace/project",
          {
            rootPath: "/workspace/project",
            name: "project",
            files: [],
            expandedDirs: new Set<string>(),
          },
        ],
      ]),
      project: {
        rootPath: "/workspace/project",
        name: "project",
        files: [],
        expandedDirs: new Set<string>(),
      },
    });
    useSearchStore.setState({
      query: "needle",
      options: {
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
      },
      resultGroups: [
        {
          rootPath: "/workspace/project",
          filePath: "policies/example.yml",
          matches: [
            {
              rootPath: "/workspace/project",
              filePath: "policies/example.yml",
              lineNumber: 12,
              lineContent: "  name: needle",
              matchStart: 8,
              matchEnd: 14,
            },
          ],
        },
      ],
      fileCount: 1,
      totalMatches: 1,
      truncated: false,
      loading: false,
      error: null,
    });
  });

  it("opens the matched file and queues an editor reveal", async () => {
    useProjectStore.setState({
      project: {
        rootPath: "workspace",
        name: "Workspace",
        files: [],
        expandedDirs: new Set<string>(),
      },
    });

    render(
      <MemoryRouter>
        <SearchPanelConnected />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /12/i }));

    await waitFor(() => {
      expect(openFileByPath).toHaveBeenCalledWith("/workspace/project/policies/example.yml");
    });

    expect(usePaneStore.getState().paneCount()).toBe(1);
    expect(consumePendingEditorReveal("/workspace/project/policies/example.yml")).toEqual({
      filePath: "/workspace/project/policies/example.yml",
      lineNumber: 12,
      startColumn: 9,
      endColumn: 15,
    });
  });

  it("preserves the real match columns when the preview line is truncated", async () => {
    useSearchStore.setState({
      resultGroups: [
        {
          rootPath: "/workspace/project",
          filePath: "policies/example.yml",
          matches: [
            {
              rootPath: "/workspace/project",
              filePath: "policies/example.yml",
              lineNumber: 27,
              lineContent: "x".repeat(500),
              matchStart: 612,
              matchEnd: 618,
            },
          ],
        },
      ],
      fileCount: 1,
      totalMatches: 1,
      truncated: false,
    });

    render(
      <MemoryRouter>
        <SearchPanelConnected />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /27/i }));

    expect(consumePendingEditorReveal("/workspace/project/policies/example.yml")).toEqual({
      filePath: "/workspace/project/policies/example.yml",
      lineNumber: 27,
      startColumn: 613,
      endColumn: 619,
    });
  });

  it("derives a real search root when the workspace uses a synthetic project path", async () => {
    useProjectStore.setState({
      project: {
        rootPath: "workspace",
        name: "Workspace",
        files: [],
        expandedDirs: new Set<string>(),
      },
    });

    render(
      <MemoryRouter>
        <SearchPanelConnected />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Search files...");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(searchInProjectNative).toHaveBeenCalledWith(
        "/workspace/project",
        "needle",
        false,
        false,
        false,
      );
    });
  });

  it("reruns the active search when options change", async () => {
    render(
      <MemoryRouter>
        <SearchPanelConnected />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Aa" }));

    await waitFor(() => {
      expect(searchInProjectNative).toHaveBeenCalledWith(
        "/workspace/project",
        "needle",
        true,
        false,
        false,
      );
    });
  });
});
