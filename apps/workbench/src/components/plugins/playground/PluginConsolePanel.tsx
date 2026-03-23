/**
 * PluginConsolePanel - Bottom panel tab showing playground plugin console output.
 *
 * Displays console.log/warn/error/info entries captured from the playground
 * plugin via the console proxy. Entries are color-coded by severity with
 * filter toggles, auto-scroll, timestamps, and a clear button.
 *
 * Console output does NOT leak to the global browser console -- the
 * playground-runner.ts console proxy handles interception and this panel
 * only reads from the store.
 */
import { useState, useRef, useEffect } from "react";
import {
  Info,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  usePlaygroundConsole,
  clearConsole,
} from "@/lib/plugins/playground/playground-store";
import type { ConsoleEntry } from "@/lib/plugins/playground/playground-store";

// ---------------------------------------------------------------------------
// Severity configuration
// ---------------------------------------------------------------------------

type LogLevel = ConsoleEntry["level"];

interface LevelConfig {
  level: LogLevel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  textClass: string;
}

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: "log",
    label: "Log",
    icon: MessageSquare,
    color: "#c8d1e0",
    textClass: "text-[#c8d1e0]",
  },
  {
    level: "info",
    label: "Info",
    icon: Info,
    color: "#60a5fa",
    textClass: "text-[#60a5fa]",
  },
  {
    level: "warn",
    label: "Warn",
    icon: AlertTriangle,
    color: "#fbbf24",
    textClass: "text-[#fbbf24]",
  },
  {
    level: "error",
    label: "Error",
    icon: XCircle,
    color: "#f87171",
    textClass: "text-[#f87171]",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a timestamp as HH:MM:SS.mmm */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

/** Stringify a single console arg for display. */
function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

/** Stringify all args in a console entry, joining with spaces. */
function stringifyArgs(args: unknown[]): string {
  return args.map(stringifyArg).join(" ");
}

/** Get the LevelConfig for a given level, falling back to log. */
function getLevelConfig(level: LogLevel): LevelConfig {
  return LEVEL_CONFIGS.find((c) => c.level === level) ?? LEVEL_CONFIGS[0];
}

// ---------------------------------------------------------------------------
// Filter toggles
// ---------------------------------------------------------------------------

function FilterToggle({
  config,
  count,
  isActive,
  onToggle,
}: {
  config: LevelConfig;
  count: number;
  isActive: boolean;
  onToggle: () => void;
}) {
  const Icon = config.icon;

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
        isActive
          ? "border-current bg-current/10"
          : "border-[#2a3142] text-[#6f7f9a] opacity-50 hover:opacity-75"
      }`}
      style={isActive ? { color: config.color } : undefined}
      title={`${isActive ? "Hide" : "Show"} ${config.label} entries`}
    >
      <Icon className="w-3 h-3" />
      <span>
        {config.label} ({count})
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Console entry row
// ---------------------------------------------------------------------------

function ConsoleEntryRow({ entry }: { entry: ConsoleEntry }) {
  const config = getLevelConfig(entry.level);
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-2 px-2 py-1 border-b border-[#2a3142]/50 font-mono text-xs ${config.textClass}`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${config.textClass}`} />
      <span className="text-[#6f7f9a] shrink-0 tabular-nums">
        {formatTimestamp(entry.timestamp)}
      </span>
      <span className="whitespace-pre-wrap break-all">
        {stringifyArgs(entry.args)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PluginConsolePanel() {
  const entries = usePlaygroundConsole();
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(["log", "info", "warn", "error"]),
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [entries]);

  // Toggle a filter level
  const toggleFilter = (level: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // Count entries per level
  const counts: Record<string, number> = { log: 0, info: 0, warn: 0, error: 0 };
  for (const entry of entries) {
    counts[entry.level] = (counts[entry.level] ?? 0) + 1;
  }

  // Filter entries by active levels
  const filteredEntries = entries.filter((e) => activeFilters.has(e.level));

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6f7f9a] text-xs p-4 gap-3 bg-[#0d1117]">
        <Terminal className="w-8 h-8 opacity-50" />
        <span>No console output yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#2a3142] shrink-0">
        {LEVEL_CONFIGS.map((config) => (
          <FilterToggle
            key={config.level}
            config={config}
            count={counts[config.level] ?? 0}
            isActive={activeFilters.has(config.level)}
            onToggle={() => toggleFilter(config.level)}
          />
        ))}

        <div className="flex-1" />

        {/* Clear button */}
        <button
          onClick={() => clearConsole()}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
            text-[#6f7f9a] hover:text-[#c8d1e0] hover:bg-[#2a3142] transition-colors"
          title="Clear console"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      {/* Scrollable entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6f7f9a] text-xs p-4">
            No entries match current filters
          </div>
        ) : (
          filteredEntries.map((entry, i) => (
            <ConsoleEntryRow key={i} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

export default PluginConsolePanel;
