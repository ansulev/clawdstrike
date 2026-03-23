const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;

export function resolveProjectPath(
  rootPath: string | null | undefined,
  filePath: string,
): string {
  if (!rootPath || filePath.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(filePath)) {
    return filePath;
  }

  const separator = rootPath.includes("\\") ? "\\" : "/";
  const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
  const normalizedFile = filePath.replace(/^[/\\]+/, "").replace(/[\\/]+/g, separator);
  return `${normalizedRoot}${separator}${normalizedFile}`;
}
