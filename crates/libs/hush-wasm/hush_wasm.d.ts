/* tslint:disable */
/* eslint-disable */

/**
 * Instruction hierarchy enforcer for maintaining privilege ordering.
 *
 * Wraps low-privilege content, detects conflicts, and enforces the hierarchy:
 * Platform > System > User > ToolOutput > External.
 */
export class WasmInstructionHierarchyEnforcer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Enforce instruction hierarchy on a set of messages.
     *
     * # Arguments
     * * `messages_json` - JSON array of `HierarchyMessage` objects
     *
     * # Returns
     * JSON string of `HierarchyEnforcementResult` with camelCase keys.
     */
    enforce(messages_json: string): string;
    /**
     * Create a new instruction hierarchy enforcer.
     *
     * # Arguments
     * * `config_json` - Optional JSON-serialized `HierarchyEnforcerConfig`. Uses defaults if omitted.
     */
    constructor(config_json?: string | null);
}

/**
 * Jailbreak detector with 4-layer detection: heuristic, statistical, ML, and optional LLM judge.
 *
 * Holds internal session aggregation state and an LRU cache. Create one instance and reuse it.
 */
export class WasmJailbreakDetector {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Run synchronous jailbreak detection on the given text.
     *
     * # Arguments
     * * `text` - The input text to analyze
     * * `session_id` - Optional session ID for session-level risk aggregation
     *
     * # Returns
     * JSON string of `JailbreakDetectionResult` with camelCase keys.
     */
    detect(text: string, session_id?: string | null): string;
    /**
     * Create a new jailbreak detector.
     *
     * # Arguments
     * * `config_json` - Optional JSON-serialized `JailbreakGuardConfig`. Uses defaults if omitted.
     *
     * # Returns
     * A new `WasmJailbreakDetector` instance.
     */
    constructor(config_json?: string | null);
}

/**
 * Output sanitizer for redacting secrets, PII, and internal data from model/tool outputs.
 *
 * Holds compiled regex patterns. Create one instance and reuse it.
 */
export class WasmOutputSanitizer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a new output sanitizer.
     *
     * # Arguments
     * * `config_json` - Optional JSON-serialized `OutputSanitizerConfig`. Uses defaults if omitted.
     *
     * # Returns
     * A new `WasmOutputSanitizer` instance.
     */
    constructor(config_json?: string | null);
    /**
     * Sanitize text by detecting and redacting sensitive data.
     *
     * # Arguments
     * * `text` - The text to sanitize
     *
     * # Returns
     * JSON string of `SanitizationResult` with camelCase keys.
     */
    sanitize(text: string): string;
}

/**
 * Canonicalize a JSON string according to RFC 8785 (JCS).
 *
 * # Arguments
 * * `json_str` - A valid JSON string
 *
 * # Returns
 * Canonical JSON string with sorted keys, no extra whitespace.
 */
export function canonicalize_json(json_str: string): string;

/**
 * Compute Merkle root from leaf hashes.
 *
 * # Arguments
 * * `leaf_hashes_json` - JSON array of hex-encoded leaf hashes
 *
 * # Returns
 * Hex-encoded Merkle root (with 0x prefix)
 */
export function compute_merkle_root(leaf_hashes_json: string): string;

/**
 * Detect prompt-injection signals in untrusted text.
 *
 * # Arguments
 * * `text` - The untrusted text to analyze
 * * `max_scan_bytes` - Optional limit on bytes to scan (default: 200,000)
 *
 * # Returns
 * JSON string of `PromptInjectionReport` with camelCase keys.
 */
export function detect_prompt_injection(text: string, max_scan_bytes?: number | null): string;

/**
 * Generate a new Ed25519 keypair.
 *
 * # Returns
 * JavaScript object `{ privateKey: string, publicKey: string }` with hex-encoded keys (no 0x prefix).
 * Private key is 32 bytes (64 hex chars), public key is 32 bytes (64 hex chars).
 */
export function generate_keypair(): any;

/**
 * Generate a Merkle proof for a specific leaf index.
 *
 * # Arguments
 * * `leaf_hashes_json` - JSON array of hex-encoded leaf hashes
 * * `leaf_index` - Index of the leaf to prove (0-based)
 *
 * # Returns
 * JSON-serialized MerkleProof
 */
export function generate_merkle_proof(leaf_hashes_json: string, leaf_index: number): string;

/**
 * Get the canonical JSON representation of a receipt.
 * This is the exact bytes that are signed.
 *
 * # Arguments
 * * `receipt_json` - JSON-serialized Receipt
 *
 * # Returns
 * Canonical JSON string (sorted keys, no extra whitespace)
 */
export function get_canonical_json(receipt_json: string): string;

/**
 * Compute Keccak-256 hash of data (Ethereum-compatible).
 *
 * # Arguments
 * * `data` - The bytes to hash
 *
 * # Returns
 * Hex-encoded hash with 0x prefix (66 characters)
 */
export function hash_keccak256(data: Uint8Array): string;

/**
 * Compute Keccak-256 hash of data, returning raw bytes.
 *
 * # Arguments
 * * `data` - The bytes to hash
 *
 * # Returns
 * 32-byte hash as `Uint8Array`
 */
export function hash_keccak256_bytes(data: Uint8Array): Uint8Array;

/**
 * Hash a Receipt to get its canonical hash.
 *
 * # Arguments
 * * `receipt_json` - JSON-serialized Receipt (unsigned)
 * * `algorithm` - "sha256" or "keccak256"
 *
 * # Returns
 * Hex-encoded hash with 0x prefix
 */
export function hash_receipt(receipt_json: string, algorithm: string): string;

/**
 * Compute SHA-256 hash of data.
 *
 * # Arguments
 * * `data` - The bytes to hash
 *
 * # Returns
 * Hex-encoded hash (64 characters, no 0x prefix)
 */
export function hash_sha256(data: Uint8Array): string;

/**
 * Compute SHA-256 hash of data, returning raw bytes.
 *
 * # Arguments
 * * `data` - The bytes to hash
 *
 * # Returns
 * 32-byte hash as `Uint8Array`
 */
export function hash_sha256_bytes(data: Uint8Array): Uint8Array;

/**
 * Compute SHA-256 hash with 0x prefix.
 *
 * # Arguments
 * * `data` - The bytes to hash
 *
 * # Returns
 * Hex-encoded hash with 0x prefix (66 characters)
 */
export function hash_sha256_prefixed(data: Uint8Array): string;

/**
 * Initialize the WASM module (call once at startup)
 */
export function init(): void;

/**
 * Derive an Ed25519 public key from a private key.
 *
 * # Arguments
 * * `private_key_hex` - Hex-encoded private key (32 bytes, with or without 0x prefix)
 *
 * # Returns
 * Hex-encoded public key (32 bytes = 64 hex chars, no 0x prefix)
 */
export function public_key_from_private(private_key_hex: string): string;

/**
 * Sign a message with an Ed25519 private key.
 *
 * # Arguments
 * * `private_key_hex` - Hex-encoded private key (32 bytes, with or without 0x prefix)
 * * `message` - The message bytes to sign
 *
 * # Returns
 * Hex-encoded signature (64 bytes = 128 hex chars, no 0x prefix)
 */
export function sign_ed25519(private_key_hex: string, message: Uint8Array): string;

/**
 * Verify an Ed25519 signature over a message.
 *
 * # Arguments
 * * `public_key_hex` - Hex-encoded public key (32 bytes, with or without 0x prefix)
 * * `message` - The message bytes that were signed
 * * `signature_hex` - Hex-encoded signature (64 bytes, with or without 0x prefix)
 *
 * # Returns
 * `true` if the signature is valid, `false` otherwise
 */
export function verify_ed25519(public_key_hex: string, message: Uint8Array, signature_hex: string): boolean;

/**
 * Verify a Merkle inclusion proof.
 *
 * # Arguments
 * * `leaf_hash_hex` - Hex-encoded leaf hash (with or without 0x prefix)
 * * `proof_json` - JSON-serialized MerkleProof
 * * `root_hex` - Hex-encoded expected root hash (with or without 0x prefix)
 *
 * # Returns
 * `true` if the proof is valid, `false` otherwise
 */
export function verify_merkle_proof(leaf_hash_hex: string, proof_json: string, root_hex: string): boolean;

/**
 * Verify a signed Receipt.
 *
 * # Arguments
 * * `receipt_json` - JSON-serialized SignedReceipt
 * * `signer_pubkey_hex` - Hex-encoded signer public key
 * * `cosigner_pubkey_hex` - Optional hex-encoded co-signer public key
 *
 * # Returns
 * JavaScript object with verification result:
 * ```json
 * {
 *   "valid": true,
 *   "signer_valid": true,
 *   "cosigner_valid": null,
 *   "errors": []
 * }
 * ```
 */
export function verify_receipt(receipt_json: string, signer_pubkey_hex: string, cosigner_pubkey_hex?: string | null): any;

/**
 * Get version information about this WASM module
 */
export function version(): string;
