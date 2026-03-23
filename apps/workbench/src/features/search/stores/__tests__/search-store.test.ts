import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "../search-store";

const searchInProjectNativeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri-commands", () => ({
  searchInProjectNative: searchInProjectNativeMock,
}));

describe("useSearchStore", () => {
  beforeEach(() => {
    searchInProjectNativeMock.mockReset();

    useSearchStore.setState({
      query: "needle",
      options: {
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
      },
      results: [],
      resultGroups: [],
      fileCount: 0,
      totalMatches: 0,
      truncated: false,
      loading: false,
      error: null,
      actions: useSearchStore.getState().actions,
    });
  });

  it("aggregates matches across workspace roots and preserves root context", async () => {
    searchInProjectNativeMock
      .mockResolvedValueOnce({
        matches: [
          {
            file_path: "shared/default.yaml",
            line_number: 3,
            line_content: "alpha needle",
            match_start: 6,
            match_end: 12,
          },
        ],
        file_count: 1,
        total_matches: 1,
        truncated: false,
      })
      .mockResolvedValueOnce({
        matches: [
          {
            file_path: "shared/default.yaml",
            line_number: 7,
            line_content: "bravo needle",
            match_start: 6,
            match_end: 12,
          },
        ],
        file_count: 1,
        total_matches: 1,
        truncated: true,
      });

    await useSearchStore
      .getState()
      .actions.performSearch(["/workspace/alpha", "/workspace/bravo"]);

    expect(searchInProjectNativeMock).toHaveBeenNthCalledWith(
      1,
      "/workspace/alpha",
      "needle",
      false,
      false,
      false,
    );
    expect(searchInProjectNativeMock).toHaveBeenNthCalledWith(
      2,
      "/workspace/bravo",
      "needle",
      false,
      false,
      false,
    );

    const state = useSearchStore.getState();
    expect(state.results.map((match) => `${match.rootPath}:${match.filePath}`)).toEqual([
      "/workspace/alpha:shared/default.yaml",
      "/workspace/bravo:shared/default.yaml",
    ]);
    expect(
      state.resultGroups.map((group) => `${group.rootPath}:${group.filePath}`),
    ).toEqual([
      "/workspace/alpha:shared/default.yaml",
      "/workspace/bravo:shared/default.yaml",
    ]);
    expect(state.fileCount).toBe(2);
    expect(state.totalMatches).toBe(2);
    expect(state.truncated).toBe(true);
    expect(state.error).toBeNull();
  });
});
