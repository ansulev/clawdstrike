import { getWasmModule } from "./crypto/backend.js";

export interface SynthResult {
  policyYaml: string;
  risks: string[];
}

export interface SimulationSummary {
  total: number;
  allowed: number;
  warn: number;
  blocked: number;
}

export interface SimulationResultEntry {
  eventId: string;
  outcome: string;
  allowed: boolean;
  denied: boolean;
  warn: boolean;
  reasonCode: string;
  guard?: string;
  severity?: string;
  message?: string;
}

export interface SimulateResult {
  summary: SimulationSummary;
  results: SimulationResultEntry[];
}

/**
 * PolicyLab: unified observe -> hunt -> OCSF -> synth pipeline.
 * Backed by Rust compiled to WASM.
 * Requires `initWasm()` before construction.
 */
export class PolicyLab {
  // biome-ignore lint/suspicious/noExplicitAny: WasmPolicyLab is untyped
  private readonly inner: any;

  constructor(policyYaml: string) {
    const wasm = getWasmModule();
    if (!wasm?.WasmPolicyLab) {
      throw new Error(
        "WASM not initialized. Call initWasm() before using PolicyLab.",
      );
    }
    this.inner = new wasm.WasmPolicyLab(policyYaml);
  }

  /** Simulate events against the loaded policy. */
  simulate(eventsJsonl: string): SimulateResult {
    const json: string = this.inner.simulate(eventsJsonl);
    return JSON.parse(json) as SimulateResult;
  }

  /** Synthesize a candidate policy from observed events. */
  static synth(eventsJsonl: string): SynthResult {
    const wasm = getWasmModule();
    if (!wasm?.policy_lab_synth) {
      throw new Error(
        "WASM not initialized. Call initWasm() before using PolicyLab.",
      );
    }
    const json: string = wasm.policy_lab_synth(eventsJsonl);
    return JSON.parse(json) as SynthResult;
  }

  /** Convert PolicyEvent JSONL to OCSF JSONL. */
  static toOcsf(eventsJsonl: string): string {
    const wasm = getWasmModule();
    if (!wasm?.policy_lab_to_ocsf) {
      throw new Error(
        "WASM not initialized. Call initWasm() before using PolicyLab.",
      );
    }
    return wasm.policy_lab_to_ocsf(eventsJsonl);
  }

  /** Convert PolicyEvent JSONL to TimelineEvent JSONL. */
  static toTimeline(eventsJsonl: string): string {
    const wasm = getWasmModule();
    if (!wasm?.policy_lab_to_timeline) {
      throw new Error(
        "WASM not initialized. Call initWasm() before using PolicyLab.",
      );
    }
    return wasm.policy_lab_to_timeline(eventsJsonl);
  }
}
