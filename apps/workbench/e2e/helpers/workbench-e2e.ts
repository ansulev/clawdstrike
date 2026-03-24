import { expect, type Page } from "@playwright/test";

type E2EFileType =
  | "clawdstrike_policy"
  | "sigma_rule"
  | "yara_rule"
  | "ocsf_event";

interface SeededFile {
  path: string;
  content: string;
  fileType: E2EFileType;
}

interface PersistedTabSeed {
  id: string;
  documentId: string;
  name: string;
  filePath: string | null;
  yaml: string;
  fileType: E2EFileType;
}

interface SeedWorkbenchOptions {
  files: SeededFile[];
  tabs: PersistedTabSeed[];
  activeTabId?: string;
}

const DEFAULT_CONTENT_BY_TYPE: Record<E2EFileType, string> = {
  clawdstrike_policy: [
    'version: "1.2.0"',
    "name: __NAME__",
    'description: ""',
    "guards: {}",
    "settings: {}",
    "",
  ].join("\n"),
  sigma_rule: [
    "title: __NAME__",
    "id: 11111111-1111-1111-1111-111111111111",
    "status: experimental",
    "logsource: {}",
    "detection:",
    "  selection: {}",
    "  condition: selection",
    "",
  ].join("\n"),
  yara_rule: [
    "rule __NAME__ {",
    "  strings:",
    '    $a = "demo"',
    "  condition:",
    "    $a",
    "}",
    "",
  ].join("\n"),
  ocsf_event: JSON.stringify({ name: "__NAME__", severity_id: 1 }, null, 2),
};

const DEFAULT_OPERATOR = {
  publicKey: "e2e-public-key",
  fingerprint: "e2e-fingerprint",
  sigil: "star",
  nickname: "e2e",
  displayName: "E2E Operator",
  idpClaims: null,
  createdAt: 0,
  originDeviceId: "e2e-device",
  devices: [{ deviceId: "e2e-device", deviceName: "E2E Device", addedAt: 0, lastSeenAt: 0 }],
};

export function makePolicyYaml(name: string, description = ""): string {
  return [
    'version: "1.2.0"',
    `name: ${name}`,
    `description: ${description === "" ? '""' : description}`,
    "guards: {}",
    "settings: {}",
    "",
  ].join("\n");
}

export async function seedWorkbench(page: Page, options: SeedWorkbenchOptions): Promise<void> {
  const activeTabId = options.activeTabId ?? options.tabs[0]?.id ?? "";
  const persistedTabs = {
    tabs: options.tabs.map((tab) => ({
      id: tab.id,
      documentId: tab.documentId,
      name: tab.name,
      filePath: tab.filePath,
      yaml: tab.yaml,
      fileType: tab.fileType,
    })),
    activeTabId,
  };

  await page.addInitScript(
    ({ files, persistedTabs, defaultContentsByType, operator }) => {
      const fileMap = new Map<string, { path: string; content: string; fileType: string }>(
        files.map((file) => [file.path, { ...file }]),
      );

      const normalizePath = (value: string) =>
        value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");

      const relativePathFor = (rootPath: string, filePath: string) => {
        const normalizedRoot = normalizePath(rootPath);
        const normalizedFile = normalizePath(filePath);
        const prefix = `${normalizedRoot}/`;
        return normalizedFile.startsWith(prefix)
          ? normalizedFile.slice(prefix.length)
          : normalizedFile;
      };

      const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const buildMatcher = (
        query: string,
        caseSensitive: boolean,
        wholeWord: boolean,
        useRegex: boolean,
      ) => {
        const source = useRegex ? query : escapeRegex(query);
        const bounded = wholeWord ? `\\b(?:${source})\\b` : source;
        return new RegExp(bounded, caseSensitive ? "g" : "gi");
      };

      const searchProject = (
        rootPath: string,
        query: string,
        caseSensitive: boolean,
        wholeWord: boolean,
        useRegex: boolean,
      ) => {
        const matches: Array<{
          file_path: string;
          line_number: number;
          line_content: string;
          match_start: number;
          match_end: number;
          source_match_start: number;
          source_match_end: number;
        }> = [];
        const rootPrefix = `${normalizePath(rootPath)}/`;

        for (const file of fileMap.values()) {
          if (!normalizePath(file.path).startsWith(rootPrefix)) {
            continue;
          }

          const lines = file.content.split(/\r?\n/);
          for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index] ?? "";
            const matcher = buildMatcher(query, caseSensitive, wholeWord, useRegex);
            let match = matcher.exec(line);
            while (match) {
              const value = match[0] ?? "";
              matches.push({
                file_path: relativePathFor(rootPath, file.path),
                line_number: index + 1,
                line_content: line,
                match_start: match.index,
                match_end: match.index + value.length,
                source_match_start: match.index,
                source_match_end: match.index + value.length,
              });

              if (value.length === 0) {
                matcher.lastIndex += 1;
              }
              match = matcher.exec(line);
            }
          }
        }

        return {
          matches,
          file_count: new Set(matches.map((match) => match.file_path)).size,
          total_matches: matches.length,
          truncated: false,
        };
      };

      const resolveSeededContent = (fileName: string, fileType: string) => {
        const stem = fileName.replace(/\.[^.]+$/, "");
        const template = defaultContentsByType[fileType] ?? "";
        return template.replace(/__NAME__/g, stem);
      };

      window.__WORKBENCH_E2E__ = {
        readDetectionFileByPath: async (filePath: string) => {
          const file = fileMap.get(normalizePath(filePath));
          return file ? { content: file.content, path: file.path, fileType: file.fileType as E2EFileType } : null;
        },
        createDetectionFile: async (dirPath: string, fileName: string, fileType: string) => {
          const fullPath = normalizePath(`${dirPath}/${fileName}`);
          fileMap.set(fullPath, {
            path: fullPath,
            content: resolveSeededContent(fileName, fileType),
            fileType,
          });
          return fullPath;
        },
        renameDetectionFile: async (oldPath: string, newPath: string) => {
          const existing = fileMap.get(normalizePath(oldPath));
          if (!existing) {
            return false;
          }

          const nextPath = normalizePath(newPath);
          fileMap.delete(normalizePath(oldPath));
          fileMap.set(nextPath, { ...existing, path: nextPath });
          return true;
        },
        deleteDetectionFile: async (filePath: string) => fileMap.delete(normalizePath(filePath)),
        invoke: async (cmd: string, args?: Record<string, unknown>) => {
          if (cmd === "search_in_project") {
            return searchProject(
              String(args?.rootPath ?? ""),
              String(args?.query ?? ""),
              Boolean(args?.caseSensitive),
              Boolean(args?.wholeWord),
              Boolean(args?.useRegex),
            );
          }

          return null;
        },
      };

      window.addEventListener("clawdstrike:editor-reveal", (event) => {
        const customEvent = event as CustomEvent;
        (window as Window & { __WORKBENCH_E2E_LAST_REVEAL__?: unknown }).__WORKBENCH_E2E_LAST_REVEAL__ =
          customEvent.detail ?? null;
      });

      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("clawdstrike_workbench_operator", JSON.stringify(operator));
      localStorage.setItem("clawdstrike_workbench_tabs", JSON.stringify(persistedTabs));
      localStorage.setItem("clawdstrike_workbench_policies", "[]");
      localStorage.setItem(
        "clawdstrike_hint_settings",
        JSON.stringify({ showHints: true, overrides: {} }),
      );
    },
    {
      files: options.files,
      persistedTabs,
      defaultContentsByType: DEFAULT_CONTENT_BY_TYPE,
      operator: DEFAULT_OPERATOR,
    },
  );
}

export async function expectEditorToContain(page: Page, text: string): Promise<void> {
  await expect(page.locator(".cm-content").first()).toContainText(text);
}
