import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPanelConnected } from "../components/search-panel";
import { useSearchStore } from "../stores/search-store";
import { useProjectStore } from "@/features/project/stores/project-store";
import { usePaneStore } from "@/features/panes/pane-store";
import { emptyNativeValidation, usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { DEFAULT_POLICY } from "@/features/policy/stores/policy-store";
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

function makeDocumentWithLine(lineNumber: number, lineContent: string): string {
  return Array.from({ length: lineNumber }, (_, index) =>
    index === lineNumber - 1 ? lineContent : `line ${index + 1}`,
  ).join("\n");
}

function seedOpenDocument(filePath: string, lineNumber: number, lineContent: string): void {
  usePolicyTabsStore.setState({
    tabs: [
      {
        id: "tab-search-result",
        documentId: "doc-search-result",
        name: "example.yml",
        filePath,
        dirty: false,
        fileType: "clawdstrike_policy",
      },
    ],
    activeTabId: "tab-search-result",
  });
  usePolicyEditStore.setState({
    editStates: new Map([
      [
        "tab-search-result",
        {
          policy: DEFAULT_POLICY,
          yaml: makeDocumentWithLine(lineNumber, lineContent),
          validation: { valid: true, errors: [], warnings: [] },
          nativeValidation: emptyNativeValidation(),
          undoStack: { past: [], future: [] },
          cleanSnapshot: null,
        },
      ],
    ]),
  });
}

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
    seedOpenDocument("/workspace/project/policies/example.yml", 12, "  name: needle");
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
              sourceMatchStart: 8,
              sourceMatchEnd: 14,
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
              matchStart: 500,
              matchEnd: 500,
              sourceMatchStart: 612,
              sourceMatchEnd: 618,
            },
          ],
        },
      ],
      fileCount: 1,
      totalMatches: 1,
      truncated: false,
    });
    seedOpenDocument("/workspace/project/policies/example.yml", 27, "x".repeat(700));

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

  it("highlights preview matches after astral unicode characters", () => {
    useSearchStore.setState({
      resultGroups: [
        {
          rootPath: "/workspace/project",
          filePath: "policies/example.yml",
          matches: [
            {
              rootPath: "/workspace/project",
              filePath: "policies/example.yml",
              lineNumber: 7,
              lineContent: "😀😀needle tail",
              matchStart: 2,
              matchEnd: 8,
              sourceMatchStart: 2,
              sourceMatchEnd: 8,
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

    expect(screen.getByText("needle", { selector: "mark" })).toBeTruthy();
  });

  it("converts source match columns to editor utf-16 columns", async () => {
    useSearchStore.setState({
      resultGroups: [
        {
          rootPath: "/workspace/project",
          filePath: "policies/example.yml",
          matches: [
            {
              rootPath: "/workspace/project",
              filePath: "policies/example.yml",
              lineNumber: 12,
              lineContent: "😀😀needle tail",
              matchStart: 2,
              matchEnd: 8,
              sourceMatchStart: 2,
              sourceMatchEnd: 8,
            },
          ],
        },
      ],
      fileCount: 1,
      totalMatches: 1,
      truncated: false,
    });
    seedOpenDocument("/workspace/project/policies/example.yml", 12, "😀😀needle tail");

    render(
      <MemoryRouter>
        <SearchPanelConnected />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /12/i }));

    expect(consumePendingEditorReveal("/workspace/project/policies/example.yml")).toEqual({
      filePath: "/workspace/project/policies/example.yml",
      lineNumber: 12,
      startColumn: 5,
      endColumn: 11,
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
