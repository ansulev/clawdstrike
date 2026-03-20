import path from 'node:path';

export interface ManifestEntry {
  /** Source file path relative to the repo root */
  file: string;
  /** Tags expected to be found in this file */
  expectedTags: string[];
}

/**
 * Repo root, computed from this file's location:
 * apps/academy/src/lib/source-extraction/ -> up 6 levels to repo root
 */
export const REPO_ROOT = path.resolve(
  import.meta.dirname,
  '../../../../../..',
);

/** Output directory for extracted JSON source files */
export const OUT_DIR = path.resolve(
  import.meta.dirname,
  '../../data/extracted-sources',
);

/**
 * Manifest of source files to scan for @academy tagged regions.
 * Content authors add entries here; the prebuild script validates
 * that all expected tags exist in the referenced files.
 *
 * Start with placeholder entries -- tags will be added to source
 * files as lessons are authored in Phase 3.
 */
export const EXTRACTION_MANIFEST: ManifestEntry[] = [
  // Placeholder: will have @academy tags added when guard lessons are written
  // {
  //   file: 'crates/libs/clawdstrike/src/guards/forbidden_path.rs',
  //   expectedTags: ['forbidden-path-check'],
  // },
  // {
  //   file: 'crates/libs/clawdstrike/src/policy.rs',
  //   expectedTags: ['policy-load'],
  // },
];
