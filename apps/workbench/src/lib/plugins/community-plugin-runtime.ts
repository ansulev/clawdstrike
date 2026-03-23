import { extractRegistryPackageFile } from "./registry-package";
import type { PluginManifest } from "./types";

const SDK_IMPORT_RE =
  /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+)\s+from\s*['"]@clawdstrike\/plugin-sdk(?:\/\w+)?['"];?\s*/gs;

export function transformCommunityPluginSource(source: string): string {
  let code = source.replace(SDK_IMPORT_RE, (match) => {
    if (/^import\s+type\s/.test(match)) {
      return "";
    }

    const namespaceMatch = match.match(/import\s+\*\s+as\s+(\w+)/);
    if (namespaceMatch) {
      return `const ${namespaceMatch[1]} = window.__CLAWDSTRIKE_PLUGIN_SDK__;\n`;
    }

    const namedMatch = match.match(/import\s*\{([^}]+)\}/s);
    if (namedMatch) {
      const names = namedMatch[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      return `const { ${names.join(", ")} } = window.__CLAWDSTRIKE_PLUGIN_SDK__;\n`;
    }

    return match;
  });

  code = code.replace(
    /export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*\};?/g,
    "window.__CLAWDSTRIKE_PLUGIN__ = $1;",
  );
  code = code.replace(
    /export\s+default\s+/g,
    "window.__CLAWDSTRIKE_PLUGIN__ = ",
  );
  code = code.replace(/export\s*\{[^}]+\};?\s*$/gm, "");

  return code;
}

export async function resolveRegistryPluginCode(
  manifest: PluginManifest,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const downloadUrl = manifest.installation?.downloadUrl;
  if (!downloadUrl) {
    throw new Error(
      `Cannot load community plugin "${manifest.id}": installation.downloadUrl is missing`,
    );
  }
  if (!manifest.main) {
    throw new Error(
      `Cannot load community plugin "${manifest.id}": main entry point is missing`,
    );
  }

  const response = await fetcher(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download plugin package for "${manifest.id}": HTTP ${response.status}`,
    );
  }

  const archiveBuffer = await response.arrayBuffer();
  const entrypointSource = extractRegistryPackageFile(
    archiveBuffer,
    manifest.main,
  );

  if (entrypointSource === null) {
    throw new Error(
      `Failed to load plugin entrypoint "${manifest.main}" from package "${manifest.id}"`,
    );
  }

  return transformCommunityPluginSource(entrypointSource);
}
