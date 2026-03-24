/**
 * ULID generation for swarm engine entities.
 *
 * Copied verbatim from apps/workbench/src/lib/workbench/sentinel-types.ts
 * (encodeTime, encodeRandom, CROCKFORD_BASE32). Extended with swarm-engine
 * prefixes.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// ID prefixes for swarm engine entities
// ---------------------------------------------------------------------------

/**
 * ID prefixes for swarm engine entities.
 * Extends sentinel-types.ts IdPrefix ("sen" | "sig" | "fnd" | "int" | "swm" | "spk" | "enr" | "msn").
 */
export type SwarmEngineIdPrefix =
  | "agt" // AgentSession
  | "tsk" // Task
  | "swe" // SwarmEngine instance
  | "top" // Topology snapshot
  | "csn" // Consensus proposal
  | "msg"; // Internal message

// ---------------------------------------------------------------------------
// Crockford Base32 ULID encoding (from sentinel-types.ts lines 148-196)
// ---------------------------------------------------------------------------

/** Crockford Base32 encoding alphabet. */
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Encode a timestamp in milliseconds as a 10-character Crockford Base32 string.
 * Uses the ULID timestamp encoding: 48-bit big-endian millisecond value.
 */
function encodeTime(ms: number): string {
  let value = ms;
  const chars: string[] = new Array(10);
  for (let i = 9; i >= 0; i--) {
    chars[i] = CROCKFORD_BASE32[value & 0x1f]!;
    value = Math.floor(value / 32);
  }
  return chars.join("");
}

/**
 * Generate 16 random Crockford Base32 characters (80 bits of randomness).
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 */
function encodeRandom(): string {
  const chars: string[] = new Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 16; i++) {
      chars[i] = CROCKFORD_BASE32[bytes[i]! & 0x1f]!;
    }
  } else {
    for (let i = 0; i < 16; i++) {
      chars[i] = CROCKFORD_BASE32[Math.floor(Math.random() * 32)]!;
    }
  }
  return chars.join("");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a prefixed ULID for swarm engine entities.
 *
 * Format: `{prefix}_{ulid}` where the ULID component is 26 characters of
 * Crockford Base32 (10 timestamp + 16 random).
 *
 * @param prefix - Entity type prefix (3 chars)
 * @returns Prefixed ID, e.g. "agt_01HXK8M3N2..."
 */
export function generateSwarmId(prefix: SwarmEngineIdPrefix): string {
  return `${prefix}_${encodeTime(Date.now())}${encodeRandom()}`;
}
