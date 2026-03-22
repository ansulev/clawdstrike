/**
 * EnrichmentTypeRegistry - Central registry for plugin-contributed enrichment renderers.
 *
 * Allows plugins to register custom React components that render specific
 * enrichment types in the enrichment sidebar, overriding the built-in
 * GenericContent fallback.
 *
 * Uses the Map + snapshot + listeners pattern matching view-registry.ts.
 * React integration via useSyncExternalStore for tear-free reads.
 */
import { useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import type { Enrichment } from "../workbench/finding-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props passed to custom enrichment renderer components. */
export interface EnrichmentRendererProps {
  /** The full enrichment object. */
  enrichment: Enrichment;
  /** The enrichment's data payload (convenience alias for enrichment.data). */
  data: Record<string, unknown>;
}

/** A registration entry in the EnrichmentTypeRegistry. */
export interface EnrichmentRendererRegistration {
  /** The enrichment type this renderer handles (e.g. "virustotal"). */
  type: string;
  /** The React component to render for this enrichment type. */
  component: ComponentType<EnrichmentRendererProps>;
}

// ---------------------------------------------------------------------------
// Module-level state (not a class, matching view-registry pattern)
// ---------------------------------------------------------------------------

const rendererMap = new Map<string, EnrichmentRendererRegistration>();
const listeners = new Set<() => void>();

/** Snapshot cache keyed by type. Rebuilt on every mutation. */
let snapshot = new Map<string, ComponentType<EnrichmentRendererProps>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rebuildSnapshot(): void {
  const next = new Map<string, ComponentType<EnrichmentRendererProps>>();
  for (const [type, reg] of rendererMap) {
    next.set(type, reg.component);
  }
  snapshot = next;
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
 * Register a custom renderer for an enrichment type.
 * Returns a dispose function that removes the renderer and notifies listeners.
 *
 * @throws {Error} if a renderer for the given type is already registered.
 */
export function registerEnrichmentRenderer(
  type: string,
  component: ComponentType<EnrichmentRendererProps>,
): () => void {
  if (rendererMap.has(type)) {
    throw new Error(
      `Enrichment renderer for type "${type}" already registered`,
    );
  }
  rendererMap.set(type, { type, component });
  notify();

  return () => {
    rendererMap.delete(type);
    notify();
  };
}

/** Look up the renderer component for a given enrichment type. */
export function getEnrichmentRenderer(
  type: string,
): ComponentType<EnrichmentRendererProps> | undefined {
  return snapshot.get(type);
}

/**
 * Subscribe to registry changes. The listener is called whenever a renderer
 * is registered or unregistered. Returns an unsubscribe function.
 */
export function onEnrichmentRendererChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook that returns the custom renderer for an enrichment type,
 * re-rendering the consuming component whenever renderers change.
 *
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useEnrichmentRenderer(
  type: string,
): ComponentType<EnrichmentRendererProps> | undefined {
  return useSyncExternalStore(
    onEnrichmentRendererChange,
    () => getEnrichmentRenderer(type),
  );
}

// ---------------------------------------------------------------------------
// Convenience object
// ---------------------------------------------------------------------------

/** Convenience object for import ergonomics. */
export const enrichmentTypeRegistry = {
  register: registerEnrichmentRenderer,
  get: getEnrichmentRenderer,
  onChange: onEnrichmentRendererChange,
};
