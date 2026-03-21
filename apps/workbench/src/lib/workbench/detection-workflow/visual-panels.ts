/**
 * Visual Panel Registry
 *
 * Stores React component types keyed by file type. Detection format adapters
 * (built-in or plugin-contributed) register their visual panel components here
 * so the editor can look them up and render them uniformly.
 *
 * The registry follows the same dispose-on-register pattern as the adapter
 * registry and publish target registry.
 */

import type { ComponentType } from "react";
import type { FileType } from "../file-type-registry";
import type { DetectionVisualPanelProps } from "./shared-types";

// ---- Registry ----

const visualPanels = new Map<FileType, ComponentType<DetectionVisualPanelProps>>();

/**
 * Register a visual panel component for a file type.
 * Throws if a panel is already registered for the given file type.
 * Returns a dispose function that removes the registration.
 */
export function registerVisualPanel(
  fileType: FileType,
  component: ComponentType<DetectionVisualPanelProps>,
): () => void {
  if (visualPanels.has(fileType)) {
    throw new Error(
      `Visual panel already registered for file type "${fileType}". ` +
        "Unregister the existing panel before registering a new one.",
    );
  }
  visualPanels.set(fileType, component);
  return () => {
    visualPanels.delete(fileType);
  };
}

/**
 * Get the visual panel component for a file type, or null if none is registered.
 */
export function getVisualPanel(
  fileType: FileType,
): ComponentType<DetectionVisualPanelProps> | null {
  return visualPanels.get(fileType) ?? null;
}

/**
 * Get all file types that have a registered visual panel.
 */
export function getRegisteredVisualPanelTypes(): FileType[] {
  return [...visualPanels.keys()];
}
