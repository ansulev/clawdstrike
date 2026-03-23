/**
 * Playground Source Map
 *
 * Provides lightweight source-map-like utilities for the Plugin Playground.
 * Since sucrase's TypeScript-only transform is nearly line-preserving (it
 * strips type annotations but keeps line structure), the transpiled JS line
 * numbers closely correspond to the original TS source lines.
 *
 * This module rewrites V8/Chrome stack traces that reference the eval server
 * URL (`/__plugin-eval/`) to show `playground.ts` with the original line
 * numbers for readability.
 */

// ---------------------------------------------------------------------------
// Stack trace line pattern
// ---------------------------------------------------------------------------

/**
 * Matches Chrome/V8 stack trace frames referencing the eval server.
 *
 * Examples:
 *   at activate (http://localhost:5173/__plugin-eval/1.js:12:5)
 *   at http://localhost:5173/__plugin-eval/2.js:3:10
 */
const EVAL_FRAME_RE =
  /(\s*at\s+(?:.*?\s+)?\(?)[^\s]*\/__plugin-eval\/\d+\.js:(\d+):(\d+)\)?/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rewrite a V8/Chrome stack trace, replacing `/__plugin-eval/NNN.js:LINE:COL`
 * references with `playground.ts:LINE:COL` for readability.
 *
 * @param stack   - The raw stack trace string from an Error
 * @param _sourceLines - The original TypeScript source lines (reserved for
 *                       future offset correction; currently unused because
 *                       sucrase is line-preserving for type-only transforms)
 * @returns The rewritten stack trace string
 */
export function mapStackTrace(stack: string, _sourceLines: string[]): string {
  return stack.replace(
    EVAL_FRAME_RE,
    (_match, prefix: string, line: string, col: string) => {
      return `${prefix}playground.ts:${line}:${col})`;
    },
  );
}

/**
 * Extract the line and column of the first `/__plugin-eval/` frame from a
 * stack trace string. Useful for highlighting the error location in the
 * CodeMirror editor gutter.
 *
 * @param stack - The raw stack trace string from an Error
 * @returns `{ line, column }` of the first matching frame, or `null`
 */
export function extractErrorLocation(
  stack: string,
): { line: number; column: number } | null {
  // Use a fresh regex (no global state from the module-level one)
  const re =
    /\/__plugin-eval\/\d+\.js:(\d+):(\d+)/;
  const match = re.exec(stack);
  if (!match) return null;

  return {
    line: parseInt(match[1], 10),
    column: parseInt(match[2], 10),
  };
}
