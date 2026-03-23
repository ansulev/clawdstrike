/**
 * PluginDevConsole - Bottom panel tab for plugin lifecycle events.
 *
 * Displays timestamped plugin lifecycle events with severity icons,
 * plugin ID badges, HMR timing, and filtering controls. Auto-scrolls
 * to the newest event.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Check,
  Minus,
  Puzzle,
  Trash2,
} from 'lucide-react';
import {
  useDevConsoleEvents,
  useDevConsoleFilter,
  devConsoleStore,
} from '../../lib/plugins/dev/dev-console-store';
import type { DevLifecycleEvent, DevLifecycleEventType } from '../../lib/plugins/dev/types';

// ---------------------------------------------------------------------------
// Severity categories for filtering
// ---------------------------------------------------------------------------

type SeverityCategory = 'log' | 'warn' | 'error' | 'lifecycle' | 'hmr';

const CATEGORY_TYPES: Record<SeverityCategory, DevLifecycleEventType[]> = {
  log: ['console:log'],
  warn: ['console:warn'],
  error: ['console:error', 'error', 'hmr:error'],
  lifecycle: [
    'registered',
    'activating',
    'activated',
    'deactivated',
    'contribution:registered',
    'contribution:unregistered',
  ],
  hmr: ['hmr:start', 'hmr:complete'],
};

const ALL_CATEGORIES: SeverityCategory[] = ['log', 'warn', 'error', 'lifecycle', 'hmr'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a timestamp as HH:MM:SS.mmm. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** Get the severity icon for an event type. */
function SeverityIcon({ type }: { type: DevLifecycleEventType }) {
  const size = 14;
  switch (type) {
    case 'console:error':
    case 'error':
    case 'hmr:error':
      return <AlertCircle size={size} className="text-red-400 shrink-0" />;
    case 'console:warn':
      return <AlertTriangle size={size} className="text-yellow-400 shrink-0" />;
    case 'console:log':
      return <Info size={size} className="text-blue-400 shrink-0" />;
    case 'hmr:start':
    case 'hmr:complete':
      return <RefreshCw size={size} className="text-green-400 shrink-0" />;
    case 'activated':
    case 'registered':
    case 'activating':
      return <Check size={size} className="text-green-400 shrink-0" />;
    case 'deactivated':
      return <Minus size={size} className="text-zinc-500 shrink-0" />;
    case 'contribution:registered':
    case 'contribution:unregistered':
      return <Puzzle size={size} className="text-purple-400 shrink-0" />;
    default:
      return <Info size={size} className="text-zinc-400 shrink-0" />;
  }
}

/** Get category for a given event type. */
function getCategoryForType(type: DevLifecycleEventType): SeverityCategory {
  for (const [cat, types] of Object.entries(CATEGORY_TYPES) as [SeverityCategory, DevLifecycleEventType[]][]) {
    if (types.includes(type)) return cat;
  }
  return 'lifecycle';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PluginDevConsole() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [selectedPluginId, setSelectedPluginId] = useState<string | undefined>(undefined);
  const [enabledCategories, setEnabledCategories] = useState<Set<SeverityCategory>>(
    () => new Set(ALL_CATEGORIES),
  );

  // Get events from the store (filtered by plugin if selected)
  const pluginEvents = useDevConsoleFilter(selectedPluginId);

  // Also get all events for the plugin filter dropdown
  const allEvents = useDevConsoleEvents();

  // Derive unique plugin IDs for the filter dropdown
  const pluginIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEvents) {
      ids.add(e.pluginId);
    }
    return Array.from(ids).sort();
  }, [allEvents]);

  // Apply severity category filter
  const filteredEvents = useMemo(() => {
    if (enabledCategories.size === ALL_CATEGORIES.length) return pluginEvents;
    return pluginEvents.filter((e) => enabledCategories.has(getCategoryForType(e.type)));
  }, [pluginEvents, enabledCategories]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredEvents]);

  // Toggle a severity category
  const toggleCategory = useCallback((cat: SeverityCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 text-xs">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        {/* Clear button */}
        <button
          onClick={() => devConsoleStore.clear()}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Clear console"
        >
          <Trash2 size={12} />
          <span>Clear</span>
        </button>

        <div className="w-px h-4 bg-zinc-700" />

        {/* Plugin filter dropdown */}
        <select
          value={selectedPluginId ?? ''}
          onChange={(e) => setSelectedPluginId(e.target.value || undefined)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-1.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All plugins</option>
          {pluginIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <div className="w-px h-4 bg-zinc-700" />

        {/* Severity filter checkboxes */}
        {ALL_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className="flex items-center gap-1 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={enabledCategories.has(cat)}
              onChange={() => toggleCategory(cat)}
              className="accent-zinc-500 w-3 h-3"
            />
            <span
              className={`capitalize ${enabledCategories.has(cat) ? 'text-zinc-300' : 'text-zinc-600'}`}
            >
              {cat}
            </span>
          </label>
        ))}

        {/* Event count */}
        <span className="ml-auto text-zinc-600">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden font-mono">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600">
            No events yet. Plugin lifecycle events will appear here.
          </div>
        ) : (
          filteredEvents.map((event, idx) => (
            <EventRow key={`${event.timestamp}-${idx}`} event={event} />
          ))
        )}
        {/* Scroll sentinel */}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event row sub-component
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: DevLifecycleEvent }) {
  return (
    <div className="flex items-start gap-2 py-1 px-2 border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
      {/* Timestamp */}
      <span className="text-zinc-600 shrink-0 tabular-nums">
        {formatTime(event.timestamp)}
      </span>

      {/* Severity icon */}
      <SeverityIcon type={event.type} />

      {/* Plugin ID badge */}
      <span className="shrink-0 px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono text-[10px] leading-tight">
        {event.pluginId}
      </span>

      {/* Message */}
      <span className="text-zinc-300 break-all min-w-0">{event.message}</span>

      {/* Duration for HMR complete events */}
      {event.type === 'hmr:complete' && event.durationMs != null && (
        <span className="shrink-0 text-green-500 ml-auto">
          ({event.durationMs.toFixed(0)}ms)
        </span>
      )}
    </div>
  );
}
