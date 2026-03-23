import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveRegistryPluginCode,
  transformCommunityPluginSource,
} from "../community-plugin-runtime";
import { createTestManifest } from "../manifest-validation";

function createTarArchive(entries: Array<{ name: string; content: string }>): ArrayBuffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const entry of entries) {
    const contentBytes = encoder.encode(entry.content);
    const header = new Uint8Array(512);

    header.set(encoder.encode(entry.name), 0);
    header.set(encoder.encode("0000644\0"), 100);
    header.set(encoder.encode("0000000\0"), 108);
    header.set(encoder.encode("0000000\0"), 116);
    const sizeField = contentBytes.length.toString(8).padStart(11, "0");
    header.set(encoder.encode(`${sizeField}\0`), 124);
    header.set(encoder.encode("00000000000\0"), 136);
    header[156] = "0".charCodeAt(0);

    chunks.push(header);
    chunks.push(contentBytes);

    const padding = (512 - (contentBytes.length % 512)) % 512;
    if (padding > 0) {
      chunks.push(new Uint8Array(padding));
    }
  }

  chunks.push(new Uint8Array(1024));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output.buffer;
}

describe("community-plugin runtime helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rewrites plugin-sdk imports and default exports for the sandbox runtime", () => {
    const transformed = transformCommunityPluginSource(`import { createPlugin } from "@clawdstrike/plugin-sdk";
var plugin = createPlugin({ manifest: { id: "sample" }, activate() {} });
export { plugin as default };`);

    expect(transformed).toContain(
      "const { createPlugin } = window.__CLAWDSTRIKE_PLUGIN_SDK__;",
    );
    expect(transformed).toContain("window.__CLAWDSTRIKE_PLUGIN__ = plugin;");
    expect(transformed).not.toContain('from "@clawdstrike/plugin-sdk"');
    expect(transformed).not.toContain("export { plugin as default }");
  });

  it("downloads the package archive and resolves transformed entrypoint code", async () => {
    const manifest = createTestManifest({
      id: "runtime-helper-test",
      trust: "community",
      activationEvents: ["onStartup"],
      main: "./dist/index.js",
      installation: {
        downloadUrl: "https://registry.example/plugins/runtime-helper-test.tgz",
        size: 123,
        checksum: "a".repeat(64),
      },
    });

    const archiveBuffer = createTarArchive([
      {
        name: "package/dist/index.js",
        content: `import { createPlugin } from "@clawdstrike/plugin-sdk";
var plugin = createPlugin({ manifest: { id: "runtime-helper-test" }, activate() {} });
export { plugin as default };`,
      },
    ]);

    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => archiveBuffer,
    });

    const code = await resolveRegistryPluginCode(
      manifest,
      fetcher as unknown as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://registry.example/plugins/runtime-helper-test.tgz",
    );
    expect(code).toContain("window.__CLAWDSTRIKE_PLUGIN__ = plugin;");
    expect(code).toContain("window.__CLAWDSTRIKE_PLUGIN_SDK__");
  });
});
