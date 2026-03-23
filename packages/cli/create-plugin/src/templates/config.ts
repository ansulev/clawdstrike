/**
 * Config file template generators for scaffolded plugin projects.
 *
 * Each function returns the string content of a config file to write
 * into the generated project directory.
 */

import type { ScaffoldOptions } from "../types";

/**
 * Generate a package.json for the scaffolded plugin project.
 *
 * @param options - Scaffold options (name, type, etc.)
 * @returns Stringified JSON with trailing newline
 */
export function generatePackageJson(options: ScaffoldOptions): string {
  const pkg = {
    name: options.name,
    version: "0.1.0",
    description: `A ClawdStrike ${options.type} plugin`,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        require: "./dist/index.cjs",
      },
    },
    scripts: {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
      dev: "tsup --watch",
    },
    dependencies: {
      "@clawdstrike/plugin-sdk": "^0.1.0",
    },
    devDependencies: {
      typescript: "^5.9.3",
      tsup: "^8.5.1",
      vitest: "^4.0.18",
    },
    license: "Apache-2.0",
    engines: {
      node: ">=20.19.0",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}

/**
 * Generate a tsconfig.json matching the plugin-sdk pattern.
 *
 * @returns Stringified JSON with trailing newline
 */
export function generateTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: "./dist",
      rootDir: "./src",
      resolveJsonModule: true,
      isolatedModules: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "tests"],
  };

  return JSON.stringify(tsconfig, null, 2) + "\n";
}

/**
 * Generate a tsup.config.ts for ESM + CJS + DTS output.
 *
 * @returns tsup config file content
 */
export function generateTsupConfig(): string {
  return `import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
`;
}

/**
 * Generate a vitest.config.ts for the scaffolded project.
 *
 * @returns vitest config file content
 */
export function generateVitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
`;
}

/**
 * Generate a .gitignore for the scaffolded project.
 *
 * @returns .gitignore content
 */
export function generateGitignore(): string {
  return `node_modules/
dist/
*.tsbuildinfo
.DS_Store
`;
}
