/**
 * Template engine for scaffolding plugin projects.
 *
 * Creates a complete project directory with config files, source template,
 * and test template based on the user's scaffold options.
 */

import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import path from "node:path";
import type { ScaffoldOptions } from "./types";
import {
  generatePackageJson,
  generateTsconfig,
  generateTsupConfig,
  generateVitestConfig,
  generateGitignore,
} from "./templates/config";
import { getSourceTemplate, getTestTemplate } from "./templates/source";

/**
 * Write a file to the given directory.
 *
 * @param dir - Base directory
 * @param filename - File name (or relative path within dir)
 * @param content - File content to write
 */
export async function writeProjectFile(
  dir: string,
  filename: string,
  content: string,
): Promise<void> {
  const resolved = path.resolve(dir, filename);
  const dirResolved = path.resolve(dir);
  if (!resolved.startsWith(dirResolved + path.sep) && resolved !== dirResolved) {
    throw new Error(`Path traversal detected: ${filename}`);
  }
  const filePath = path.join(dir, filename);
  await fsWriteFile(filePath, content, "utf-8");
}

/**
 * Scaffold a new plugin project directory from the given options.
 *
 * Creates the output directory with subdirectories, writes config files
 * (package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, .gitignore),
 * a source entry point (src/index.ts), and a test file (tests/plugin.test.ts).
 *
 * @param options - Scaffold configuration from prompts or flags
 */
export async function scaffoldProject(options: ScaffoldOptions): Promise<void> {
  const { outputDir } = options;

  // Create output directory and subdirectories
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.join(outputDir, "src"), { recursive: true });
  await mkdir(path.join(outputDir, "tests"), { recursive: true });

  // Write config files
  await writeProjectFile(outputDir, "package.json", generatePackageJson(options));
  await writeProjectFile(outputDir, "tsconfig.json", generateTsconfig());
  await writeProjectFile(outputDir, "tsup.config.ts", generateTsupConfig());
  await writeProjectFile(outputDir, "vitest.config.ts", generateVitestConfig());
  await writeProjectFile(outputDir, ".gitignore", generateGitignore());

  // Write source template
  await writeProjectFile(outputDir, "src/index.ts", getSourceTemplate(options));

  // Write test template
  await writeProjectFile(outputDir, "tests/plugin.test.ts", getTestTemplate(options));
}
