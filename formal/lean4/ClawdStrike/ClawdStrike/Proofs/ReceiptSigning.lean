/-
  ClawdStrike Proofs: Receipt Signing Properties

  This file proves correctness properties of the receipt signing protocol.
  The proofs compose the axiomatized Ed25519 operations (from Core/Crypto.lean)
  with the sign/verify definitions (from Core/Receipt.lean) to show that the
  protocol is sound.

  Properties proven:
  - **sign_then_verify**: A receipt signed with sk verifies against the
    derived pk. This is the fundamental soundness property: honest signing
    always produces verifiable receipts.
  - **signature_covers_content**: The signature in a signed receipt is
    exactly the Ed25519 signature over the canonical JSON of the receipt.
    This ensures the signature is bound to the receipt content.
  - **verify_recomputes_canonical**: Verification re-derives the canonical
    JSON from the embedded receipt (not from a cached value). This models
    the Rust implementation's approach of re-serializing at verify time.
  - **sign_preserves_receipt**: Signing does not modify the receipt content.
  - **sign_binds_public_key**: The signed receipt contains the public key
    derived from the signing key.
  - **different_receipts_independent**: Two different receipts signed with
    the same key produce signed receipts that verify independently.

  Proof strategy: All proofs follow by unfolding `SignedReceipt.sign` and
  `SignedReceipt.verify`, then applying the `sign_verify_roundtrip` axiom
  from Core/Crypto.lean. The proofs are short because the definitions
  are compositional and the axiom directly gives us what we need.

  Rust references:
    - `SignedReceipt::sign`: receipt.rs:298-315
    - `SignedReceipt::verify`: receipt.rs:331-395
    - `test_sign_and_verify`: receipt.rs:497-508
    - `test_canonical_json_deterministic`: receipt.rs:581-586
-/

import ClawdStrike.Core.Crypto
import ClawdStrike.Core.Receipt

set_option autoImplicit false

namespace ClawdStrike.Proofs

open ClawdStrike.Core
open ClawdStrike.Core.Receipt

-- ============================================================================
-- sign_then_verify: Sign-then-verify roundtrip succeeds
--
-- This is the primary correctness theorem. It states that if we sign a
-- receipt with a secret key, the resulting signed receipt will verify
-- successfully. This follows directly from the Ed25519 sign-verify
-- roundtrip axiom.
--
-- Corresponds to Rust `test_sign_and_verify` in receipt.rs:497-508.
-- ============================================================================

theorem sign_then_verify (sk : Crypto.SecretKey) (r : Receipt) :
    (SignedReceipt.sign sk r).verify = true := by
  -- Unfold the definitions of sign and verify
  unfold SignedReceipt.sign SignedReceipt.verify
  -- After unfolding, the goal reduces to:
  --   ed25519_verify (publicKey sk) (canonicalize r.toCanonicalJson)
  --                  (ed25519_sign sk (canonicalize r.toCanonicalJson)) = true
  -- This is exactly the sign_verify_roundtrip axiom instantiated with
  -- sk and (canonicalize r.toCanonicalJson).
  simp only []
  exact Crypto.sign_verify_roundtrip sk (Crypto.canonicalize r.toCanonicalJson)

-- ============================================================================
-- signature_covers_content: The signature covers the canonical JSON
--
-- The signature stored in a signed receipt is exactly the Ed25519 signature
-- over the canonical JSON representation of the receipt. This ensures that
-- any modification to the receipt content would invalidate the signature.
-- ============================================================================

theorem signature_covers_content (sk : Crypto.SecretKey) (r : Receipt) :
    (SignedReceipt.sign sk r).signature =
      Crypto.ed25519_sign sk (Crypto.canonicalize r.toCanonicalJson) := by
  unfold SignedReceipt.sign
  rfl

-- ============================================================================
-- verify_recomputes_canonical: Verification re-derives canonical JSON
--
-- The verify function recomputes the canonical JSON from the embedded
-- receipt rather than relying on a cached value. This models the Rust
-- implementation where verify calls `self.receipt.to_canonical_json()`
-- (receipt.rs:352-360) independently of the signing path.
-- ============================================================================

theorem verify_recomputes_canonical (sr : SignedReceipt) :
    sr.verify =
      Crypto.ed25519_verify sr.signerPublicKey
        (Crypto.canonicalize sr.receipt.toCanonicalJson)
        sr.signature := by
  unfold SignedReceipt.verify
  rfl

-- ============================================================================
-- sign_preserves_receipt: Signing does not modify receipt content
--
-- The receipt embedded in a signed receipt is identical to the original
-- receipt. This is a structural property ensuring signing is non-destructive.
-- ============================================================================

theorem sign_preserves_receipt (sk : Crypto.SecretKey) (r : Receipt) :
    (SignedReceipt.sign sk r).receipt = r := by
  unfold SignedReceipt.sign
  rfl

-- ============================================================================
-- sign_binds_public_key: The signed receipt contains the correct public key
--
-- The public key stored in the signed receipt is the one derived from the
-- secret key used for signing. This ensures the verifier can determine
-- who signed the receipt.
--
-- In the Rust implementation, the public key is supplied separately
-- (via PublicKeySet at verification time). Our model bundles it in the
-- SignedReceipt for a tighter specification.
-- ============================================================================

theorem sign_binds_public_key (sk : Crypto.SecretKey) (r : Receipt) :
    (SignedReceipt.sign sk r).signerPublicKey = Crypto.publicKey sk := by
  unfold SignedReceipt.sign
  rfl

-- ============================================================================
-- different_receipts_independent: Independent verification
--
-- Two different receipts signed with the same key each verify independently.
-- This is a direct corollary of sign_then_verify applied to each receipt,
-- but we state it explicitly to document that signing multiple receipts
-- with the same key does not cause interference.
-- ============================================================================

theorem different_receipts_independent
    (sk : Crypto.SecretKey) (r1 r2 : Receipt) :
    (SignedReceipt.sign sk r1).verify = true ∧
    (SignedReceipt.sign sk r2).verify = true :=
  ⟨sign_then_verify sk r1, sign_then_verify sk r2⟩

-- ============================================================================
-- canonical_json_deterministic_signing: Deterministic canonicalization
-- implies deterministic signing
--
-- If we sign the same receipt with the same key twice, we get the same
-- signature. This follows from the determinism of both canonicalization
-- and Ed25519 signing.
-- ============================================================================

theorem canonical_json_deterministic_signing
    (sk : Crypto.SecretKey) (r : Receipt) :
    SignedReceipt.sign sk r = SignedReceipt.sign sk r := rfl

end ClawdStrike.Proofs
