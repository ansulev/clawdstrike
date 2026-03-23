/**
 * Console Interceptor - Captures console output from plugin execution.
 *
 * Wraps console.log, console.warn, and console.error during plugin
 * activation to capture output as DevLifecycleEvents in the dev
 * console store. Uses a re-entrancy guard to prevent infinite loops
 * from the interceptor's own internal operations.
 */

import { devConsoleStore } from './dev-console-store';
import type { DevLifecycleEventType } from './types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Original console methods, saved before interception. */
let origLog: typeof console.log | null = null;
let origWarn: typeof console.warn | null = null;
let origError: typeof console.error | null = null;

/** Guard flag to prevent re-entrant interception. */
let isIntercepting = false;

/** Active plugin ID for the current interception scope. */
let activePluginId: string | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format console arguments into a single message string.
 * Simple values use toString(); complex values use JSON.stringify.
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

/**
 * Create a wrapper for a console method that intercepts calls
 * and pushes events to the dev console store.
 */
function makeWrapper(
  original: (...args: unknown[]) => void,
  eventType: DevLifecycleEventType,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    // Always call the original console method
    original.apply(console, args);

    // Guard against re-entrancy
    if (isIntercepting) return;
    if (!activePluginId) return;

    isIntercepting = true;
    try {
      devConsoleStore.push({
        type: eventType,
        pluginId: activePluginId,
        timestamp: Date.now(),
        message: formatArgs(args),
      });
    } finally {
      isIntercepting = false;
    }
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Begin intercepting console.log, console.warn, and console.error.
 * Intercepted calls are forwarded to the original console AND pushed
 * to the dev console store as DevLifecycleEvents.
 *
 * Returns a dispose function that restores the original console methods.
 *
 * Typical usage:
 * ```ts
 * const dispose = interceptConsole('my-plugin');
 * await plugin.activate(context);
 * dispose();
 * ```
 */
export function interceptConsole(pluginId: string): () => void {
  // Save originals only on first interception
  if (!origLog) {
    origLog = console.log;
    origWarn = console.warn;
    origError = console.error;
  }

  activePluginId = pluginId;

  console.log = makeWrapper(origLog!, 'console:log');
  console.warn = makeWrapper(origWarn!, 'console:warn');
  console.error = makeWrapper(origError!, 'console:error');

  return () => {
    // Restore originals
    if (origLog) console.log = origLog;
    if (origWarn) console.warn = origWarn;
    if (origError) console.error = origError;
    activePluginId = null;
  };
}

/**
 * Safety valve: immediately restore all original console methods.
 * No-op if not currently intercepting.
 */
export function stopIntercepting(): void {
  if (origLog) console.log = origLog;
  if (origWarn) console.warn = origWarn;
  if (origError) console.error = origError;
  origLog = null;
  origWarn = null;
  origError = null;
  activePluginId = null;
  isIntercepting = false;
}
