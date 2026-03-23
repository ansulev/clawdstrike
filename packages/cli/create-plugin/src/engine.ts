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

export async function scaffoldProject(options: ScaffoldOptions): Promise<void> {
  const { outputDir } = options;

  await mkdir(outputDir, { recursive: true });
  await mkdir(path.join(outputDir, "src"), { recursive: true });
  await mkdir(path.join(outputDir, "tests"), { recursive: true });

  await writeProjectFile(outputDir, "package.json", generatePackageJson(options));
  await writeProjectFile(outputDir, "tsconfig.json", generateTsconfig());
  await writeProjectFile(outputDir, "tsup.config.ts", generateTsupConfig());
  await writeProjectFile(outputDir, "vitest.config.ts", generateVitestConfig());
  await writeProjectFile(outputDir, ".gitignore", generateGitignore());

  await writeProjectFile(outputDir, "src/index.ts", getSourceTemplate(options));

  await writeProjectFile(outputDir, "tests/plugin.test.ts", getTestTemplate(options));
}
