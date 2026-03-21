/**
 * Translation Provider Registry
 *
 * Stores translation providers that can convert detection documents between
 * file types. Providers are registered into a global array (not a map) because
 * a single provider may handle multiple (from, to) pairs.
 *
 * Lookup uses a first-match strategy: getTranslationPath iterates providers
 * in registration order and returns the first one whose canTranslate() returns
 * true for the requested pair.
 */

import type { FileType } from "../file-type-registry";
import type { TranslationProvider } from "./shared-types";
import { getRegisteredFileTypes } from "./adapters";

// ---- Registry ----

const providers: TranslationProvider[] = [];

/**
 * Register a translation provider.
 * Returns a dispose function that removes the provider from the registry.
 */
export function registerTranslationProvider(provider: TranslationProvider): () => void {
  providers.push(provider);
  return () => {
    const idx = providers.indexOf(provider);
    if (idx !== -1) {
      providers.splice(idx, 1);
    }
  };
}

/**
 * Find a translation provider that can translate from one file type to another.
 * Returns the first matching provider, or null if none can handle the pair.
 */
export function getTranslationPath(
  from: FileType,
  to: FileType,
): TranslationProvider | null {
  for (const provider of providers) {
    if (provider.canTranslate(from, to)) {
      return provider;
    }
  }
  return null;
}

/**
 * Get all registered translation providers (shallow copy for enumeration).
 */
export function getAllTranslationProviders(): readonly TranslationProvider[] {
  return [...providers];
}

/**
 * Get all file types that can be translated from the given source file type.
 *
 * @param from - The source file type to translate from.
 * @param allFileTypes - Optional list of file types to check against.
 *   Defaults to all file types with registered adapters.
 * @returns Array of file types that at least one provider can translate to.
 */
export function getTranslatableTargets(
  from: FileType,
  allFileTypes?: FileType[],
): FileType[] {
  const candidates = allFileTypes ?? getRegisteredFileTypes();
  const targets: FileType[] = [];
  for (const to of candidates) {
    if (to === from) continue;
    if (getTranslationPath(from, to) !== null) {
      targets.push(to);
    }
  }
  return targets;
}
