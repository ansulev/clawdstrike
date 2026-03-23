export const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;

function normalizeProjectPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/, "");
}

export function isAbsoluteProjectPath(path: string | null | undefined): boolean {
  return typeof path === "string"
    && (path.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(path));
}

export function resolveProjectPath(
  rootPath: string | null | undefined,
  filePath: string,
): string {
  if (!rootPath || isAbsoluteProjectPath(filePath)) {
    return filePath;
  }

  const separator = rootPath.includes("\\") ? "\\" : "/";
  const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
  const normalizedFile = filePath.replace(/^[/\\]+/, "").replace(/[\\/]+/g, separator);
  return `${normalizedRoot}${separator}${normalizedFile}`;
}

export function stripProjectRoot(
  rootPath: string | null | undefined,
  filePath: string,
): string {
  const normalizedFile = normalizeProjectPath(filePath);
  if (!rootPath) {
    return normalizedFile.replace(/^\/+/, "");
  }

  const normalizedRoot = normalizeProjectPath(rootPath);
  if (normalizedFile === normalizedRoot) {
    return "";
  }

  if (normalizedFile.startsWith(`${normalizedRoot}/`)) {
    return normalizedFile.slice(normalizedRoot.length + 1);
  }

  return normalizedFile.replace(/^\/+/, "");
}

export function getProjectPathDirname(filePath: string): string | null {
  const normalized = filePath.replace(/[\\/]+$/, "");
  const lastSeparator = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return lastSeparator >= 0 ? normalized.slice(0, lastSeparator) : null;
}

export function replaceProjectPathBasename(filePath: string, newName: string): string {
  const parentPath = getProjectPathDirname(filePath);
  if (!parentPath) {
    return newName;
  }

  const separator = parentPath.includes("\\") && !parentPath.includes("/") ? "\\" : "/";
  return `${parentPath}${separator}${newName}`;
}

interface ParsedAbsoluteDirectory {
  kind: "posix" | "windows";
  prefix: string;
  separator: "/" | "\\";
  directories: string[];
}

function parseAbsoluteDirectory(filePath: string): ParsedAbsoluteDirectory | null {
  if (!isAbsoluteProjectPath(filePath)) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (WINDOWS_ABSOLUTE_PATH.test(filePath)) {
    const [drive, ...segments] = normalized.split("/");
    return {
      kind: "windows",
      prefix: drive,
      separator: "\\",
      directories: segments.filter(Boolean).slice(0, -1),
    };
  }

  return {
    kind: "posix",
    prefix: "/",
    separator: "/",
    directories: normalized.split("/").filter(Boolean).slice(0, -1),
  };
}

function stringifyAbsoluteDirectory(
  parsed: ParsedAbsoluteDirectory,
  directories = parsed.directories,
): string {
  if (parsed.kind === "windows") {
    return directories.length > 0
      ? `${parsed.prefix}${parsed.separator}${directories.join(parsed.separator)}`
      : `${parsed.prefix}${parsed.separator}`;
  }

  return directories.length > 0 ? `/${directories.join("/")}` : "/";
}

export function deriveSearchRootPath(
  rootPath: string | null | undefined,
  absoluteFilePaths: string[],
): string | null {
  if (isAbsoluteProjectPath(rootPath)) {
    return rootPath ?? null;
  }

  const parsedPaths = absoluteFilePaths
    .map((filePath) => parseAbsoluteDirectory(filePath))
    .filter((parsed): parsed is ParsedAbsoluteDirectory => parsed !== null);

  if (parsedPaths.length === 0) {
    return null;
  }

  const [first, ...rest] = parsedPaths;
  let commonDirectories = [...first.directories];

  for (const parsed of rest) {
    if (parsed.kind !== first.kind || parsed.prefix !== first.prefix) {
      return stringifyAbsoluteDirectory(first);
    }

    let sharedIndex = 0;
    while (
      sharedIndex < commonDirectories.length
      && sharedIndex < parsed.directories.length
      && commonDirectories[sharedIndex] === parsed.directories[sharedIndex]
    ) {
      sharedIndex += 1;
    }
    commonDirectories = commonDirectories.slice(0, sharedIndex);
    if (commonDirectories.length === 0) {
      return stringifyAbsoluteDirectory(first);
    }
  }

  return stringifyAbsoluteDirectory(first, commonDirectories);
}
