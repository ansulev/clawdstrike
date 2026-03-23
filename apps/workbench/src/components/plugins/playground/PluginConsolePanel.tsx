/**
 * PluginConsolePanel - Bottom panel tab showing playground plugin console output.
 *
 * Displays console.log/warn/error/info entries captured from the playground
 * plugin via the console proxy. Entries are color-coded by level.
 */
import { usePlaygroundConsole, usePlaygroundErrors } from "@/lib/plugins/playground/playground-store";

const LEVEL_STYLES: Record<string, string> = {
  log: "text-[#c8d1e0]",
  info: "text-[#5b9bd5]",
  warn: "text-[#d4a84b]",
  error: "text-[#c45c5c]",
};

export function PluginConsolePanel() {
  const entries = usePlaygroundConsole();
  const errors = usePlaygroundErrors();

  if (entries.length === 0 && errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#6f7f9a] text-xs p-4">
        Console output will appear here after running a plugin
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-2 font-mono text-xs bg-[#0d1117]">
      {/* Transpilation / runtime errors */}
      {errors.map((err, i) => (
        <div key={`err-${i}`} className="px-2 py-1 border-b border-[#2a3142] text-[#c45c5c]">
          <span className="font-semibold">[Error]</span>{" "}
          {err.line !== undefined && <span className="text-[#6f7f9a]">L{err.line}: </span>}
          {err.message}
          {err.stack && (
            <pre className="mt-1 text-[10px] text-[#6f7f9a] whitespace-pre-wrap">{err.stack}</pre>
          )}
        </div>
      ))}

      {/* Console entries */}
      {entries.map((entry, i) => (
        <div
          key={`log-${i}`}
          className={`px-2 py-0.5 border-b border-[#2a3142]/50 ${LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.log}`}
        >
          <span className="text-[#6f7f9a] mr-2">[{entry.level}]</span>
          {entry.args.map((arg, j) => (
            <span key={j}>
              {j > 0 && " "}
              {typeof arg === "string" ? arg : JSON.stringify(arg)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default PluginConsolePanel;
