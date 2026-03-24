import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "../search-store";

const { cancelSearchInProjectNativeMock, searchInProjectNativeMock } = vi.hoisted(() => ({
  cancelSearchInProjectNativeMock: vi.fn(),
  searchInProjectNativeMock: vi.fn(),
}));

vi.mock("@/lib/tauri-commands", () => ({
  cancelSearchInProjectNative: cancelSearchInProjectNativeMock,
  searchInProjectNative: searchInProjectNativeMock,
}));

describe("useSearchStore", () => {
  beforeEach(() => {
    useSearchStore.getState().actions.clearResults();
    cancelSearchInProjectNativeMock.mockReset();
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
      expect.any(String),
    );
    expect(searchInProjectNativeMock).toHaveBeenNthCalledWith(
      2,
      "/workspace/bravo",
      "needle",
      false,
      false,
      false,
      expect.any(String),
    );

    const firstSearchId = searchInProjectNativeMock.mock.calls[0]?.[5];
    expect(firstSearchId).toBe(searchInProjectNativeMock.mock.calls[1]?.[5]);

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

  it("cancels the prior native search when a new query dispatches", async () => {
    let resolveFirst!: (value: {
      matches: Array<{
        file_path: string;
        line_number: number;
        line_content: string;
        match_start: number;
        match_end: number;
      }>;
      file_count: number;
      total_matches: number;
      truncated: boolean;
    }) => void;
    let resolveSecond!: (value: {
      matches: Array<{
        file_path: string;
        line_number: number;
        line_content: string;
        match_start: number;
        match_end: number;
      }>;
      file_count: number;
      total_matches: number;
      truncated: boolean;
    }) => void;

    searchInProjectNativeMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const actions = useSearchStore.getState().actions;

    const firstRun = actions.performSearch(["/workspace/alpha"]);
    const firstSearchId = searchInProjectNativeMock.mock.calls[0]?.[5];

    actions.setQuery("newer");
    expect(cancelSearchInProjectNativeMock).toHaveBeenCalledWith(firstSearchId);

    const secondRun = actions.performSearch(["/workspace/alpha"]);
    const secondSearchId = searchInProjectNativeMock.mock.calls[1]?.[5];
    expect(secondSearchId).not.toBe(firstSearchId);

    resolveSecond({
      matches: [
        {
          file_path: "shared/new.yaml",
          line_number: 5,
          line_content: "newer needle",
          match_start: 0,
          match_end: 5,
        },
      ],
      file_count: 1,
      total_matches: 1,
      truncated: false,
    });
    await secondRun;

    resolveFirst({
      matches: [
        {
          file_path: "shared/old.yaml",
          line_number: 1,
          line_content: "needle",
          match_start: 0,
          match_end: 6,
        },
      ],
      file_count: 1,
      total_matches: 1,
      truncated: false,
    });
    await firstRun;

    const state = useSearchStore.getState();
    expect(state.query).toBe("newer");
    expect(state.results.map((match) => match.filePath)).toEqual(["shared/new.yaml"]);
  });
});
