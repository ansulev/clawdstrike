/-
  ClawdStrike Core: Receipt Structure and Signing

  This module models the receipt data type and the sign/verify operations
  that produce and validate signed attestation receipts.

  The model is intentionally simplified: we focus on the signing flow
  (canonical JSON → sign → verify) rather than the full JSON serialization
  or the Verdict/Provenance substructures. The goal is to prove that the
  composition of canonicalization and Ed25519 signing is correct.

  Rust source references:
    - `Receipt` struct: crates/libs/hush-core/src/receipt.rs:157-175
    - `SignedReceipt` struct: crates/libs/hush-core/src/receipt.rs:289-294
    - `Signatures` struct: crates/libs/hush-core/src/receipt.rs:278-284
    - `SignedReceipt::sign`: crates/libs/hush-core/src/receipt.rs:298-315
    - `SignedReceipt::verify`: crates/libs/hush-core/src/receipt.rs:331-395
    - `Receipt::to_canonical_json`: crates/libs/hush-core/src/receipt.rs:228-232
    - `RECEIPT_SCHEMA_VERSION`: crates/libs/hush-core/src/receipt.rs:14

  Simplifications:
    - `Receipt.guardResults` is `List String` (not the full `Verdict` type)
    - `Receipt.metadata` is `String` (not `serde_json::Value`)
    - `Receipt.toCanonicalJson` is a pure function (the Rust version can
      fail on unsupported versions; we model the happy path after validation)
    - We omit co-signer support (modeled as a straightforward extension)
    - We use the `Crypto` module's opaque types rather than Lean built-ins
-/

import ClawdStrike.Core.Crypto

set_option autoImplicit false

namespace ClawdStrike.Core.Receipt

open ClawdStrike.Core.Crypto

-- ============================================================================
-- Receipt (unsigned attestation)
-- ============================================================================

/-- An unsigned attestation receipt.
    Simplified model of Rust `Receipt` in receipt.rs:157-175.

    Fields map to the Rust struct:
    - `version` → `Receipt.version` (schema version, e.g., "1.0.0")
    - `timestamp` → `Receipt.timestamp` (ISO-8601)
    - `action` → corresponds to `content_hash` (what was verified)
    - `verdict` → `Receipt.verdict.passed` ("allow" or "deny")
    - `guardResults` → simplified list of guard identifiers that ran
    - `metadata` → `Receipt.metadata` (JSON string) -/
structure Receipt where
  version : String
  timestamp : String
  action : String
  verdict : String
  guardResults : List String
  metadata : String
  deriving Repr, BEq

-- ============================================================================
-- Canonical JSON Serialization (simplified model)
-- ============================================================================

/-- Convert a receipt to its canonical JSON string representation.

    In the Rust implementation (`Receipt::to_canonical_json`, receipt.rs:228-232),
    this calls `serde_json::to_value(self)` then `canonical::canonicalize(&value)`
    which implements RFC 8785 (sorted keys, no extra whitespace).

    We model this as a pure function that produces a deterministic string from
    the receipt fields. The actual JSON format is not important for the signing
    proofs; what matters is that the function is deterministic (same receipt
    always produces the same string).

    The simplified format concatenates fields in a fixed order, mirroring the
    property that canonical JSON has a deterministic key ordering. -/
def Receipt.toCanonicalJson (r : Receipt) : String :=
  "{\"action\":" ++ "\"" ++ r.action ++ "\""
  ++ ",\"guardResults\":" ++ toString r.guardResults
  ++ ",\"metadata\":" ++ "\"" ++ r.metadata ++ "\""
  ++ ",\"timestamp\":" ++ "\"" ++ r.timestamp ++ "\""
  ++ ",\"verdict\":" ++ "\"" ++ r.verdict ++ "\""
  ++ ",\"version\":" ++ "\"" ++ r.version ++ "\""
  ++ "}"

-- ============================================================================
-- Signed Receipt
-- ============================================================================

/-- A receipt with an Ed25519 signature and the signer's public key.

    Simplified model of Rust `SignedReceipt` in receipt.rs:289-294.
    The Rust struct has a `Signatures` substructure with `signer` and
    optional `cosigner`; we model only the primary signer here.

    The `signerPublicKey` field corresponds to the key used for verification
    (in Rust, supplied via `PublicKeySet` at verify time; here we bundle it
    for clarity of the signing contract). -/
structure SignedReceipt where
  receipt : Receipt
  signature : Crypto.Signature
  signerPublicKey : Crypto.PublicKey

-- ============================================================================
-- Sign
-- ============================================================================

/-- Sign a receipt, producing a `SignedReceipt`.

    Models the core of `SignedReceipt::sign` (receipt.rs:298-315):
    1. Serialize receipt to canonical JSON (`receipt.to_canonical_json()`)
    2. Convert to bytes (`canonical.as_bytes()`)
    3. Sign with Ed25519 (`signer.sign(canonical.as_bytes())`)
    4. Bundle receipt + signature + public key

    In Rust, step 1 can fail (version validation), and the signer is
    provided via the `Signer` trait. We model the happy path with a
    concrete `SecretKey`. -/
noncomputable def SignedReceipt.sign (sk : Crypto.SecretKey) (r : Receipt) : SignedReceipt :=
  let canonical := Crypto.canonicalize r.toCanonicalJson
  { receipt := r
  , signature := Crypto.ed25519_sign sk canonical
  , signerPublicKey := Crypto.publicKey sk }

-- ============================================================================
-- Verify
-- ============================================================================

/-- Verify a signed receipt's signature.

    Models the signature check in `SignedReceipt::verify` (receipt.rs:331-395):
    1. Re-serialize receipt to canonical JSON
    2. Convert to bytes
    3. Verify Ed25519 signature against the signer's public key

    In Rust, verification also checks the receipt version and may verify
    a co-signer. We model the core signature verification path. -/
noncomputable def SignedReceipt.verify (sr : SignedReceipt) : Bool :=
  let canonical := Crypto.canonicalize sr.receipt.toCanonicalJson
  Crypto.ed25519_verify sr.signerPublicKey canonical sr.signature

end ClawdStrike.Core.Receipt
