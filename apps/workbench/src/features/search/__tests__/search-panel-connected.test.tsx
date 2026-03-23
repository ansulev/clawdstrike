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

vi.mock("@/features/policy/stores/policy-store", () => ({
  useWorkbench: () => ({
    openFileByPath,
  }),
}));

describe("SearchPanelConnected", () => {
  beforeEach(() => {
    openFileByPath.mockReset();
    openFileByPath.mockResolvedValue();
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
});
