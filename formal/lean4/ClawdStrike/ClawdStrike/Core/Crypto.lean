/-
  ClawdStrike Core: Ed25519 Cryptographic Primitives (Axiomatized)

  This module axiomatizes the Ed25519 signature scheme and canonical JSON
  serialization used by hush-core's receipt signing infrastructure.

  We do NOT verify the Ed25519 implementation (which lives in `ed25519-dalek`,
  an external Rust crate using unsafe code). Instead, we model Ed25519 as
  abstract operations and state the properties we rely on as axioms. The proofs
  in `Proofs/ReceiptSigning.lean` then show that the receipt signing protocol
  correctly composes these operations.

  Rust source references:
    - `Keypair` struct: crates/libs/hush-core/src/signing.rs:22-24
    - `Keypair::public_key`: crates/libs/hush-core/src/signing.rs:64-68
    - `Keypair::sign`: crates/libs/hush-core/src/signing.rs:81-84
    - `PublicKey::verify`: crates/libs/hush-core/src/signing.rs:177-179
    - `Signer` trait: crates/libs/hush-core/src/signing.rs:15-18
    - `Receipt::to_canonical_json`: crates/libs/hush-core/src/receipt.rs:228-232
    - `crate::canonical::canonicalize`: RFC 8785 canonical JSON (JCS)

  Design notes:
    - `SecretKey` and `PublicKey` are opaque types (axioms). We never inspect
      their internal structure; we only reason about the relationships between
      key derivation, signing, and verification.
    - `ByteArray` is axiomatized separately from Lean's built-in `ByteArray`
      to keep the model self-contained and avoid depending on Lean runtime
      representations.
    - The `sign_verify_roundtrip` axiom is the fundamental correctness property
      of Ed25519: signing with sk then verifying with the derived pk succeeds.
    - The `sign_deterministic` axiom reflects that Ed25519 signing (RFC 8032)
      is deterministic: the same key and message always produce the same
      signature. (ed25519-dalek uses the deterministic variant by default.)
    - The `canonicalize_deterministic` axiom reflects that RFC 8785 canonical
      JSON serialization is a pure function.
-/

set_option autoImplicit false

namespace ClawdStrike.Core.Crypto

-- ============================================================================
-- Opaque Types (axiomatized)
-- ============================================================================

/-- Ed25519 secret (signing) key. Opaque; 32-byte seed internally.
    Mirrors Rust `SigningKey` wrapped by `Keypair` in signing.rs:22-24. -/
axiom SecretKey : Type

/-- Ed25519 public (verifying) key. Opaque; 32 bytes on the curve.
    Mirrors Rust `PublicKey` (wrapping `VerifyingKey`) in signing.rs:108-111. -/
axiom PublicKey : Type

/-- Ed25519 signature. Opaque; 64 bytes (R || S).
    Mirrors Rust `Signature` (wrapping `DalekSignature`) in signing.rs:200-203. -/
axiom Signature : Type

/-- Opaque byte array for messages and serialized data.
    Used as the domain for signing and verification operations. -/
axiom ByteArray : Type

-- ============================================================================
-- Key Derivation
-- ============================================================================

/-- Derive the public key from a secret key.
    Mirrors `Keypair::public_key` in signing.rs:64-68, which calls
    `self.signing_key.verifying_key()`. -/
axiom publicKey : SecretKey → PublicKey

-- ============================================================================
-- Ed25519 Operations
-- ============================================================================

/-- Sign a message with a secret key, producing a deterministic signature.
    Mirrors `Keypair::sign` in signing.rs:81-84, which calls
    `self.signing_key.sign(message)`. -/
axiom ed25519_sign : SecretKey → ByteArray → Signature

/-- Verify a signature against a public key and message.
    Returns `true` if the signature is valid, `false` otherwise.
    Mirrors `PublicKey::verify` in signing.rs:177-179, which calls
    `self.verifying_key.verify(message, &signature.inner).is_ok()`. -/
axiom ed25519_verify : PublicKey → ByteArray → Signature → Bool

-- ============================================================================
-- Core Axioms
-- ============================================================================

/-- **Sign-verify roundtrip**: signing with sk then verifying with the
    derived pk always succeeds. This is the fundamental correctness
    property of Ed25519 (RFC 8032 Section 5.1.7).

    Rust evidence: `test_sign_verify` in signing.rs:278-283 tests this
    with random keys. The `ed25519-dalek` crate is a well-audited
    implementation of RFC 8032. -/
axiom sign_verify_roundtrip (sk : SecretKey) (msg : ByteArray) :
    ed25519_verify (publicKey sk) msg (ed25519_sign sk msg) = true

/-- **Signing is deterministic**: the same key and message always produce
    the same signature. ed25519-dalek uses deterministic nonce generation
    (RFC 6979-style), not randomized signing.

    Note: This is trivially true in Lean (pure functions are deterministic),
    but we state it explicitly to document the correspondence with the Rust
    implementation's behavior. -/
theorem sign_deterministic (sk : SecretKey) (msg : ByteArray) :
    ed25519_sign sk msg = ed25519_sign sk msg := rfl

-- ============================================================================
-- Canonical JSON (RFC 8785 / JCS)
-- ============================================================================

/-- Serialize a JSON string to its canonical (RFC 8785) byte representation.
    Mirrors `crate::canonical::canonicalize` called by
    `Receipt::to_canonical_json` in receipt.rs:228-232.

    Properties: sorted keys, no extra whitespace, deterministic output.
    We model the input as `String` (the JSON text) and output as `ByteArray`
    (the canonical bytes to be signed). -/
axiom canonicalize : String → ByteArray

/-- **Canonicalization is deterministic**: the same input always produces
    the same canonical byte representation.

    This follows from RFC 8785 being a deterministic specification,
    and is tested in Rust by `test_canonical_json_deterministic`
    in receipt.rs:581-586.

    Note: As with `sign_deterministic`, this is trivially true for pure
    functions in Lean, but we state it to document the correspondence. -/
theorem canonicalize_deterministic (s : String) :
    canonicalize s = canonicalize s := rfl

end ClawdStrike.Core.Crypto
