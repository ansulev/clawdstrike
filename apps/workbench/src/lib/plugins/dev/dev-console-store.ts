/**
 * DevConsoleStore - Event store for the plugin dev console.
 *
 * Captures DevLifecycleEvents from the HMR handler and plugin registry
 * state changes. Exposes reactive hooks via useSyncExternalStore for
 * the PluginDevConsole bottom panel component.
 *
 * Uses the same useSyncExternalStore pattern as status-bar-registry.ts
 * and view-registry.ts.
 */

import { useSyncExternalStore } from 'react';
import type { DevLifecycleEvent } from './types';
import { onDevLifecycleEvent } from './hmr-handler';
import { pluginRegistry } from '../plugin-registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of events retained in the store (FIFO). */
const MAX_EVENTS = 500;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let events: DevLifecycleEvent[] = [];
let snapshot: DevLifecycleEvent[] = Object.freeze([]) as DevLifecycleEvent[];
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rebuildSnapshot(): void {
  snapshot = Object.freeze([...events]) as DevLifecycleEvent[];
}

function notify(): void {
  rebuildSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Push a new event into the dev console store. Trims the oldest
 * events when the store exceeds MAX_EVENTS.
 */
function push(event: DevLifecycleEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }
  notify();
}

/** Return the current events array. */
function getEvents(): DevLifecycleEvent[] {
  return events;
}

/** Clear all events from the store. */
function clear(): void {
  events = [];
  notify();
}

/**
 * Subscribe to store changes. Returns an unsubscribe function.
 * Compatible with useSyncExternalStore.
 */
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Return a frozen snapshot of events for useSyncExternalStore.
 * The snapshot reference only changes when events change.
 */
function getSnapshot(): DevLifecycleEvent[] {
  return snapshot;
}

/** Convenience object for import ergonomics. */
export const devConsoleStore = {
  push,
  getEvents,
  clear,
  subscribe,
  getSnapshot,
};

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * React hook that returns all dev console events, re-rendering
 * the consuming component whenever new events arrive.
 */
export function useDevConsoleEvents(): DevLifecycleEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * React hook that returns events filtered to a specific plugin ID.
 * If pluginId is undefined, returns all events.
 */
export function useDevConsoleFilter(pluginId?: string): DevLifecycleEvent[] {
  const allEvents = useDevConsoleEvents();
  if (!pluginId) return allEvents;
  return allEvents.filter((e) => e.pluginId === pluginId);
}

// ---------------------------------------------------------------------------
// Auto-wire: subscribe to HMR lifecycle events
// ---------------------------------------------------------------------------

onDevLifecycleEvent((event) => {
  devConsoleStore.push(event);
});

// ---------------------------------------------------------------------------
// Auto-wire: subscribe to plugin registry state changes
// ---------------------------------------------------------------------------

pluginRegistry.subscribe('stateChanged', (event) => {
  const { pluginId, oldState, newState } = event;

  // Map registry state transitions to dev lifecycle events
  if (newState === 'activated') {
    devConsoleStore.push({
      type: 'activated',
      pluginId,
      timestamp: Date.now(),
      message: `Plugin ${pluginId} activated (was ${oldState ?? 'unknown'})`,
    });
  } else if (newState === 'error') {
    devConsoleStore.push({
      type: 'error',
      pluginId,
      timestamp: Date.now(),
      message: `Plugin ${pluginId} entered error state (was ${oldState ?? 'unknown'})`,
    });
  } else if (newState === 'deactivated') {
    devConsoleStore.push({
      type: 'deactivated',
      pluginId,
      timestamp: Date.now(),
      message: `Plugin ${pluginId} deactivated (was ${oldState ?? 'unknown'})`,
    });
  }
});
