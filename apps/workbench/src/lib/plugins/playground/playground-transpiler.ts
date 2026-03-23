/**
 * Playground Transpiler
 *
 * Converts TypeScript plugin source code to executable JavaScript using
 * sucrase. Rewrites SDK imports to use the global window bridge and
 * converts `export default` to a window assignment for the playground
 * runner to pick up.
 */
import { transform } from "sucrase";
import type { PlaygroundError } from "./playground-store";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transpile a TypeScript plugin source string to loadable JavaScript.
 *
 * 1. Strip TypeScript types via sucrase (transforms: ["typescript"])
 * 2. Replace `import { ... } from "@clawdstrike/plugin-sdk"` with
 *    destructuring from `window.__CLAWDSTRIKE_PLUGIN_SDK__`
 * 3. Replace `export default` with `window.__PLAYGROUND_PLUGIN__ =`
 * 4. Inject console proxy assignment at the top
 *
 * On error, returns `{ code: "", error }` with line/column if available.
 */
export function transpilePlugin(source: string): {
  code: string;
  error: PlaygroundError | null;
} {
  try {
    // Step 1: Strip TypeScript types
    const result = transform(source, {
      transforms: ["typescript"],
      filePath: "playground.tsx",
    });

    let code = result.code;

    // Step 2: Replace SDK imports with window global destructuring
    // Match: import { createPlugin, ...others } from "@clawdstrike/plugin-sdk";
    // Also handle: import { createPlugin } from '@clawdstrike/plugin-sdk';
    code = code.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]@clawdstrike\/plugin-sdk['"];?/g,
      (_match, imports: string) => {
        const names = imports
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        return `const { ${names.join(", ")} } = window.__CLAWDSTRIKE_PLUGIN_SDK__;`;
      },
    );

    // Step 3: Replace `export default` with window assignment
    code = code.replace(
      /export\s+default\s+/g,
      "window.__PLAYGROUND_PLUGIN__ = ",
    );

    // Also strip any remaining `export` keywords (named exports)
    code = code.replace(/export\s+(?=const |let |var |function |class )/g, "");

    // Step 4: Inject console proxy at the top of the transpiled code
    const consoleProxy = `const console = window.__PLAYGROUND_CONSOLE__ || window.console;\n`;
    code = consoleProxy + code;

    return { code, error: null };
  } catch (err: unknown) {
    const error: PlaygroundError = {
      message: err instanceof Error ? err.message : String(err),
    };

    // Extract line/column from sucrase error if available
    if (err && typeof err === "object") {
      const sucraseErr = err as { loc?: { line?: number; column?: number } };
      if (sucraseErr.loc) {
        error.line = sucraseErr.loc.line;
        error.column = sucraseErr.loc.column;
      }
    }

    return { code: "", error };
  }
}
