import { getWasmModule } from "./crypto/backend";
import { sha256, keccak256 } from "./crypto/hash";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Serialize object to canonical JSON per RFC 8785 (JCS).
 *
 * Delegates to the WASM module's `canonicalize_json` for deterministic output.
 *
 * @param obj - Object to serialize
 * @returns Canonical JSON string
 * @throws If WASM is not initialized
 */
export function canonicalize(obj: JsonValue): string {
  // Pre-validate: RFC 8785 rejects non-finite numbers.
  // JSON.stringify silently converts NaN/Infinity to null, so check first.
  JSON.stringify(obj, (_, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`RFC 8785 does not support non-finite numbers: ${value}`);
    }
    return value;
  });
  const wasm = getWasmModule();
  if (!wasm?.canonicalize_json) {
    throw new Error("WASM not initialized. Call initWasm() before using canonicalize.");
  }
  return wasm.canonicalize_json(JSON.stringify(obj));
}

/**
 * Hash object using canonical JSON serialization.
 *
 * @param obj - Object to serialize and hash
 * @param algorithm - Hash algorithm ("sha256" or "keccak256")
 * @returns 32-byte hash
 */
export function canonicalHash(
  obj: JsonValue,
  algorithm: "sha256" | "keccak256" = "sha256",
): Uint8Array {
  if (algorithm !== "sha256" && algorithm !== "keccak256") {
    throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  const canonical = canonicalize(obj);
  const bytes = new TextEncoder().encode(canonical);
  return algorithm === "sha256" ? sha256(bytes) : keccak256(bytes);
}
