/**
 * Pluggable crypto backend interface.
 *
 * Default: noble (pure-JS, always available).
 * Optional: WASM (hush-core via @clawdstrike/wasm), auto-initialized on demand.
 * `initWasm()` remains available for optional startup prewarm.
 */

import { createNobleBackend } from "./noble-backend";
import { createWasmBackend } from "./wasm-backend";

export interface CryptoBackend {
  readonly name: "wasm" | "noble";
  sha256(data: Uint8Array): Uint8Array;
  keccak256(data: Uint8Array): Uint8Array;
  generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
  signMessage(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
  verifySignature(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Promise<boolean>;
  publicKeyFromPrivate(privateKey: Uint8Array): Promise<Uint8Array>;
}

let currentBackend: CryptoBackend = createNobleBackend();

/**
 * Raw WASM module reference, stored when `initWasm()` succeeds.
 * Sync WASM-only APIs may also populate this via `ensureWasmSync()`.
 * Detection code (JailbreakDetector, OutputSanitizer, etc.) accesses
 * this via `getWasmModule()` rather than re-importing `@clawdstrike/wasm`.
 */
// biome-ignore lint/suspicious/noExplicitAny: WASM module shape is dynamic
let wasmModule: any = null;
let wasmInitPromise: Promise<boolean> | null = null;

/**
 * Return the raw WASM module, or `null` if initialization has not happened
 * yet (or failed).
 */
// biome-ignore lint/suspicious/noExplicitAny: WASM module shape is dynamic
export function getWasmModule(): any {
  return wasmModule;
}

function isCompatibleWasmModule(wasm: unknown): boolean {
  // Keep this in sync with `packages/sdk/hush-ts/src/crypto/wasm-backend.ts`.
  const required = [
    "hash_sha256_bytes",
    "hash_keccak256_bytes",
    "generate_keypair",
    "sign_ed25519",
    "verify_ed25519",
    "public_key_from_private",
  ] as const;

  for (const key of required) {
    if (typeof (wasm as any)?.[key] !== "function") return false;
  }
  return true;
}

// Some WASM bundles are published as CJS and are surfaced under `default`
// when imported from ESM; normalize to a plain function-bearing object.
// biome-ignore lint/suspicious/noExplicitAny: WASM module shape is dynamic
function normalizeWasmModule(wasm: any): any {
  if (isCompatibleWasmModule(wasm)) return wasm;
  if (isCompatibleWasmModule(wasm?.default)) return wasm.default;
  return wasm;
}

// biome-ignore lint/suspicious/noExplicitAny: Node require type is not available in browser builds
type NodeRequire = (id: string) => any;

function nodeRequire(): NodeRequire | null {
  // Prefer process.getBuiltinModule so we can create require() in ESM without
  // statically importing node:module (which breaks browser bundlers).
  // biome-ignore lint/suspicious/noExplicitAny: runtime feature detection
  const getBuiltin: any = (globalThis as any)?.process?.getBuiltinModule;
  if (typeof getBuiltin !== "function") {
    return null;
  }
  try {
    // biome-ignore lint/suspicious/noExplicitAny: runtime feature detection
    const mod: any = getBuiltin("node:module") ?? getBuiltin("module");
    if (typeof mod?.createRequire === "function") {
      return mod.createRequire(import.meta.url) as NodeRequire;
    }
  } catch {
    // Node builtin module not accessible in this runtime.
  }
  return null;
}

// biome-ignore lint/suspicious/noExplicitAny: WASM module shape is dynamic
function activateWasmModule(wasm: any): boolean {
  const normalized = normalizeWasmModule(wasm);
  if (!isCompatibleWasmModule(normalized)) {
    return false;
  }
  wasmModule = normalized;
  currentBackend = createWasmBackend(normalized);
  return true;
}

function initializeWasmSync(): boolean {
  if (wasmModule && isWasmBackend()) {
    return true;
  }
  if (wasmModule && !isWasmBackend()) {
    currentBackend = createWasmBackend(wasmModule);
    return true;
  }

  const requireFn = nodeRequire();
  if (!requireFn) {
    return false;
  }

  const candidates = [
    "@clawdstrike/wasm/pkg-node/hush_wasm.js",
    "@clawdstrike/wasm",
  ] as const;

  for (const specifier of candidates) {
    try {
      if (activateWasmModule(requireFn(specifier))) {
        return true;
      }
    } catch {
      // Try next candidate.
    }
  }
  return false;
}

/**
 * Get the current crypto backend.
 */
export function getBackend(): CryptoBackend {
  return currentBackend;
}

/**
 * Override the crypto backend. Mainly for testing; prefer `initWasm()` for production.
 */
export function setBackend(backend: CryptoBackend): void {
  currentBackend = backend;
}

/**
 * Returns true if the active backend is the WASM backend.
 */
export function isWasmBackend(): boolean {
  return currentBackend.name === "wasm";
}

async function initializeWasm(): Promise<boolean> {
  const candidates = [
    // Node fast-path first (sync fs-backed loader, no fetch()).
    "@clawdstrike/wasm/pkg-node/hush_wasm.js",
    // Browser/web target fallback.
    "@clawdstrike/wasm",
  ] as const;

  for (const specifier of candidates) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic ESM/CJS namespace
      const imported: any = await import(specifier as string);
      // Web-target bundles expose an async default init function.
      if (typeof imported.default === "function") {
        await imported.default();
      }
      if (activateWasmModule(imported)) return true;
    } catch {
      // Try next candidate.
    }
  }

  return false;
}

/**
 * Attempt to load the WASM crypto backend from `@clawdstrike/wasm`.
 * If the package is not installed, silently falls back to noble and returns `false`.
 *
 * @returns `true` if WASM was loaded successfully, `false` otherwise.
 */
export async function initWasm(): Promise<boolean> {
  if (initializeWasmSync()) {
    return true;
  }

  if (wasmModule && isWasmBackend()) {
    return true;
  }
  if (wasmModule && !isWasmBackend()) {
    const { createWasmBackend } = await import("./wasm-backend");
    currentBackend = createWasmBackend(wasmModule);
    return true;
  }

  if (wasmInitPromise === null) {
    wasmInitPromise = initializeWasm();
  }
  return wasmInitPromise;
}

/**
 * Ensure WASM is available for APIs that require WASM-only exports.
 *
 * Throws when WASM cannot be initialized.
 */
export async function ensureWasm(): Promise<void> {
  const ok = await initWasm();
  if (!ok) {
    throw new Error(
      "WASM backend unavailable. Install @clawdstrike/wasm.",
    );
  }
}

/**
 * Ensure WASM is available for synchronous WASM-only APIs.
 *
 * This path attempts Node sync loading first and throws if unavailable.
 */
export function ensureWasmSync(): void {
  if (initializeWasmSync()) {
    return;
  }
  throw new Error(
    "WASM backend unavailable. Install @clawdstrike/wasm for this runtime.",
  );
}
