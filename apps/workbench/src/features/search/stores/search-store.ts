import { create } from "zustand";
import { createSelectors } from "@/lib/create-selectors";
import {
  searchInProjectNative,
  type TauriSearchMatch,
} from "@/lib/tauri-commands";

// ---- Types ----

export interface SearchMatch {
  /** Relative path within the project root. */
  filePath: string;
  /** 1-indexed line number. */
  lineNumber: number;
  /** Full line text. */
  lineContent: string;
  /** Char offset of match start within lineContent. */
  matchStart: number;
  /** Char offset of match end within lineContent. */
  matchEnd: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface SearchResultGroup {
  filePath: string;
  matches: SearchMatch[];
}

interface SearchState {
  query: string;
  options: SearchOptions;
  results: SearchMatch[];
  resultGroups: SearchResultGroup[];
  fileCount: number;
  totalMatches: number;
  truncated: boolean;
  loading: boolean;
  error: string | null;
  actions: {
    setQuery: (query: string) => void;
    setOption: <K extends keyof SearchOptions>(
      key: K,
      value: SearchOptions[K],
    ) => void;
    performSearch: (rootPath: string) => Promise<void>;
    clearResults: () => void;
  };
}

// ---- Helpers ----

/** Convert snake_case TauriSearchMatch to camelCase SearchMatch. */
function mapTauriMatch(m: TauriSearchMatch): SearchMatch {
  return {
    filePath: m.file_path,
    lineNumber: m.line_number,
    lineContent: m.line_content,
    matchStart: m.match_start,
    matchEnd: m.match_end,
  };
}

/** Group flat matches by file path. */
function groupByFile(matches: SearchMatch[]): SearchResultGroup[] {
  const map = new Map<string, SearchMatch[]>();
  for (const m of matches) {
    const existing = map.get(m.filePath);
    if (existing) {
      existing.push(m);
    } else {
      map.set(m.filePath, [m]);
    }
  }
  return Array.from(map.entries()).map(([filePath, fileMatches]) => ({
    filePath,
    matches: fileMatches,
  }));
}

// ---- Store ----

const DEFAULT_OPTIONS: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
};

const useSearchStoreBase = create<SearchState>((set, get) => ({
  query: "",
  options: { ...DEFAULT_OPTIONS },
  results: [],
  resultGroups: [],
  fileCount: 0,
  totalMatches: 0,
  truncated: false,
  loading: false,
  error: null,
  actions: {
    setQuery: (query: string) => set({ query }),

    setOption: <K extends keyof SearchOptions>(
      key: K,
      value: SearchOptions[K],
    ) => {
      set((state) => ({
        options: { ...state.options, [key]: value },
      }));
    },

    performSearch: async (rootPath: string) => {
      const { query, options } = get();

      set({ loading: true, error: null });

      if (!query.trim()) {
        set({
          results: [],
          resultGroups: [],
          fileCount: 0,
          totalMatches: 0,
          truncated: false,
          loading: false,
        });
        return;
      }

      try {
        const result = await searchInProjectNative(
          rootPath,
          query,
          options.caseSensitive,
          options.wholeWord,
          options.useRegex,
        );

        if (result) {
          const matches = result.matches.map(mapTauriMatch);
          const resultGroups = groupByFile(matches);
          set({
            results: matches,
            resultGroups,
            fileCount: result.file_count,
            totalMatches: result.total_matches,
            truncated: result.truncated,
            loading: false,
          });
        } else {
          set({
            results: [],
            resultGroups: [],
            fileCount: 0,
            totalMatches: 0,
            truncated: false,
            error: "Search is not available outside Tauri desktop",
            loading: false,
          });
        }
      } catch (err) {
        set({
          results: [],
          resultGroups: [],
          fileCount: 0,
          totalMatches: 0,
          truncated: false,
          error: err instanceof Error ? err.message : "Search failed",
          loading: false,
        });
      }
    },

    clearResults: () =>
      set({
        results: [],
        resultGroups: [],
        fileCount: 0,
        totalMatches: 0,
        truncated: false,
        error: null,
      }),
  },
}));

export const useSearchStore = createSelectors(useSearchStoreBase);
