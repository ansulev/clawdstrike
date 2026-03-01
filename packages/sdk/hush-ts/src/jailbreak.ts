import { getWasmModule } from "./crypto/backend.js";

// ---------------------------------------------------------------------------
// Type exports (kept for index.ts re-exports; shapes match WASM camelCase JSON)
// ---------------------------------------------------------------------------

export type JailbreakSeverity = "safe" | "suspicious" | "likely" | "confirmed";

export type JailbreakCategory =
  | "role_play"
  | "authority_confusion"
  | "encoding_attack"
  | "hypothetical_framing"
  | "adversarial_suffix"
  | "system_impersonation"
  | "instruction_extraction"
  | "multi_turn_grooming"
  | "payload_splitting";

export interface JailbreakSignal {
  id: string;
  category: JailbreakCategory;
  weight: number;
  matchSpan?: [number, number];
}

export interface LayerResult {
  layer: string;
  score: number;
  signals: string[];
  latencyMs?: number;
}

export interface JailbreakDetectionResult {
  severity: JailbreakSeverity;
  confidence: number;
  riskScore: number;
  blocked: boolean;
  fingerprint: string;
  signals: JailbreakSignal[];
  layerResults: {
    heuristic: LayerResult;
    statistical: LayerResult;
    ml?: LayerResult;
    llmJudge?: LayerResult;
  };
  canonicalization: {
    scannedBytes: number;
    truncated: boolean;
    nfkcChanged: boolean;
    casefoldChanged: boolean;
    zeroWidthStripped: number;
    whitespaceCollapsed: boolean;
    canonicalBytes: number;
  };
  session?: {
    sessionId: string;
    messagesSeen: number;
    suspiciousCount: number;
    cumulativeRisk: number;
    rollingRisk?: number;
    lastSeenMs?: number;
  };
  latencyMs?: number;
}

export interface JailbreakDetectorConfig {
  layers?: {
    heuristic?: boolean;
    statistical?: boolean;
    ml?: boolean;
    llmJudge?: boolean;
  };
  linearModel?: JailbreakLinearModelConfig;
  blockThreshold?: number;
  warnThreshold?: number;
  maxInputBytes?: number;
  sessionAggregation?: boolean;
  sessionMaxEntries?: number;
  sessionTtlMs?: number;
  sessionHalfLifeMs?: number;
  /** @deprecated JS session stores are not supported with WASM backend. Sessions are managed internally. */
  sessionStore?: unknown;
}

export interface JailbreakLinearModelConfig {
  bias?: number;
  wIgnorePolicy?: number;
  wDan?: number;
  wRoleChange?: number;
  wPromptExtraction?: number;
  wEncoded?: number;
  wPunct?: number;
  wSymbolRun?: number;
}

// ---------------------------------------------------------------------------
// Key-casing helpers (camelCase TS config → snake_case Rust config)
// ---------------------------------------------------------------------------

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function toSnakeCaseKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCaseKeys);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[camelToSnake(k)] = toSnakeCaseKeys(v);
    }
    return out;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Thin WASM wrapper
// ---------------------------------------------------------------------------

/**
 * Jailbreak detector backed by the Rust implementation compiled to WASM.
 *
 * Requires `initWasm()` to have been called before construction.
 * All detection logic (heuristic, statistical, ML linear-model, session
 * aggregation, canonicalization) is performed inside the WASM module.
 */
export class JailbreakDetector {
  // biome-ignore lint/suspicious/noExplicitAny: WasmJailbreakDetector is untyped
  private readonly inner: any;

  constructor(config?: JailbreakDetectorConfig) {
    const wasm = getWasmModule();
    if (!wasm?.WasmJailbreakDetector) {
      throw new Error(
        "WASM not initialized. Call initWasm() before using JailbreakDetector.",
      );
    }
    // Only pass Rust-known config fields; strip JS-only and guard-level options.
    const RUST_FIELDS = new Set([
      "layers", "linearModel", "blockThreshold", "warnThreshold",
      "maxInputBytes", "sessionAggregation", "sessionMaxEntries",
      "sessionTtlMs", "sessionHalfLifeMs",
    ]);
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config ?? {})) {
      if (RUST_FIELDS.has(k) && v !== undefined) filtered[k] = v;
    }
    const hasConfig = Object.keys(filtered).length > 0;
    this.inner = new wasm.WasmJailbreakDetector(
      hasConfig ? JSON.stringify(toSnakeCaseKeys(filtered)) : undefined,
    );
  }

  /**
   * Run jailbreak detection on the given input text.
   *
   * @param input  - The text to analyse.
   * @param sessionId - Optional session identifier for cross-message aggregation.
   * @returns Structured detection result (camelCase keys from WASM).
   */
  detect(input: string, sessionId?: string): JailbreakDetectionResult {
    const json: string = this.inner.detect(input, sessionId ?? undefined);
    return JSON.parse(json) as JailbreakDetectionResult;
  }
}
