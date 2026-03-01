import { initWasm, isWasmBackend } from "../src/crypto/backend";

// Detection modules (jailbreak, output sanitizer, canonical JSON, etc.) require
// the WASM backend — always initialize it before tests run.
const ok = await initWasm();
if (!ok || !isWasmBackend()) {
  throw new Error(
    "Failed to initialize the WASM crypto backend. Ensure @clawdstrike/wasm is installed and compatible with this SDK.",
  );
}
