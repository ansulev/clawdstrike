/-
  ClawdStrike Formal Specification: Merkle Tree Properties

  Properties for the Merkle tree implementation extracted from hush-core
  via Charon+Aeneas. These theorem statements define correctness properties
  for the Merkle tree construction, proof generation, and verification.

  The `leaf_hash` and `node_hash` functions are opaque (axiomatized) since
  they depend on SHA-256 internals. We axiomatize their domain-separation
  prefix behavior and prove structural properties over the translated code.

  Properties:
    M1: leaf_hash domain separation (0x00 prefix) -- axiomatized
    M2: node_hash domain separation (0x01 prefix) -- axiomatized
    M3: inclusion_proof succeeds for all valid indices
    M4: verify roundtrip (build tree, generate proof, verify against root)
    M5: from_leaves rejects empty input
    M6: leaf_count correctness
    M7: verify rejects wrong root
    M8: compute_root determinism
-/

import Aeneas
import ClawdStrike.Impl.Merkle.Types
import ClawdStrike.Impl.Merkle.Funs
import ClawdStrike.Impl.Merkle.FunsExternal_Template

open Aeneas Aeneas.Std Result Error
open hush_core

set_option autoImplicit false
set_option maxHeartbeats 1000000

noncomputable section

namespace ClawdStrike.Spec.Merkle

-- ============================================================================
-- M1: leaf_hash domain separation (0x00 prefix)
--
-- In the Rust implementation, leaf_hash prepends a 0x00 byte before hashing.
-- This is opaque to Aeneas, so we axiomatize the key property:
-- leaf_hash always succeeds and produces distinct outputs from node_hash
-- for the same input bytes.
-- ============================================================================

/-- M1: leaf_hash is total (always succeeds).
    The Rust implementation prepends 0x00 and calls SHA-256, which cannot fail. -/
axiom leaf_hash_total (data : Slice Std.U8) :
    ∃ h, merkle.leaf_hash data = ok h

/-- M1a: leaf_hash domain separation.
    Two equal inputs produce equal hashes (determinism). -/
axiom leaf_hash_deterministic (data : Slice Std.U8) :
    ∀ h₁ h₂, merkle.leaf_hash data = ok h₁ → merkle.leaf_hash data = ok h₂ → h₁ = h₂

/-- M1b: leaf_hash domain separation from node_hash.
    For any data that can be interpreted as two hashes, the leaf_hash of that
    data is distinct from any node_hash output. This is the key property
    ensured by the 0x00 vs 0x01 prefix scheme (second-preimage resistance). -/
axiom leaf_node_domain_separation (data : Slice Std.U8) (left right : hashing.Hash)
    (h_leaf : merkle.leaf_hash data = ok h_leaf_val)
    (h_node : merkle.node_hash left right = ok h_node_val) :
    h_leaf_val ≠ h_node_val

-- ============================================================================
-- M2: node_hash domain separation (0x01 prefix)
--
-- node_hash prepends 0x01 before hashing the concatenation of two child
-- hashes. Axiomatized since it depends on SHA-256 internals.
-- ============================================================================

/-- M2: node_hash is total (always succeeds).
    The Rust implementation prepends 0x01, concatenates, and calls SHA-256. -/
axiom node_hash_total (left right : hashing.Hash) :
    ∃ h, merkle.node_hash left right = ok h

/-- M2a: node_hash is deterministic. -/
axiom node_hash_deterministic (left right : hashing.Hash) :
    ∀ h₁ h₂, merkle.node_hash left right = ok h₁ →
              merkle.node_hash left right = ok h₂ → h₁ = h₂

-- ============================================================================
-- M3: inclusion_proof succeeds for all valid leaf indices
--
-- "If the tree was built from N leaves, then for any index i < N,
-- inclusion_proof(i) returns Ok."
-- ============================================================================

/-- M3: inclusion_proof succeeds for valid indices.
    If a tree is successfully built from a non-empty list of leaves,
    then inclusion_proof succeeds for every index less than the leaf count. -/
theorem inclusion_proof_valid_index
    {T : Type}
    (asRefInst : core.convert.AsRef T (Slice Std.U8))
    (leaves : Slice T)
    (tree : merkle.MerkleTree)
    (leaf_count_val : Std.Usize)
    (i : Std.Usize)
    (h_built : merkle.MerkleTree.from_leaves asRefInst leaves = ok (core.result.Result.Ok tree))
    (h_count : merkle.MerkleTree.leaf_count tree = ok leaf_count_val)
    (h_valid : i < leaf_count_val) :
    ∃ proof, merkle.MerkleTree.inclusion_proof tree i =
      ok (core.result.Result.Ok proof) := by
  sorry

/-- M3a: inclusion_proof fails for out-of-bounds indices.
    If the index is >= the leaf count, inclusion_proof returns an error. -/
theorem inclusion_proof_invalid_index
    (tree : merkle.MerkleTree)
    (leaf_count_val : Std.Usize)
    (i : Std.Usize)
    (h_count : merkle.MerkleTree.leaf_count tree = ok leaf_count_val)
    (h_invalid : i >= leaf_count_val) :
    ∃ e, merkle.MerkleTree.inclusion_proof tree i =
      ok (core.result.Result.Err e) := by
  sorry

-- ============================================================================
-- M4: verify roundtrip
--
-- "If we build a tree, extract its root, and generate an inclusion proof
-- for leaf i, then verify(root, leaf_data[i], proof) = true."
-- ============================================================================

/-- M4: Verify roundtrip.
    For a tree built from leaves, the inclusion proof for any valid index
    verifies against the tree's root and the original leaf data. -/
theorem verify_roundtrip
    {T : Type}
    (asRefInst : core.convert.AsRef T (Slice Std.U8))
    (leaves : Slice T)
    (tree : merkle.MerkleTree)
    (root : hashing.Hash)
    (proof : merkle.MerkleProof)
    (i : Std.Usize)
    (leaf_data : Slice Std.U8)
    (h_built : merkle.MerkleTree.from_leaves asRefInst leaves = ok (core.result.Result.Ok tree))
    (h_root : merkle.MerkleTree.root tree = ok root)
    (h_proof : merkle.MerkleTree.inclusion_proof tree i = ok (core.result.Result.Ok proof))
    (h_leaf : asRefInst.as_ref (Slice.index leaves i) = ok leaf_data) :
    merkle.MerkleProof.verify proof leaf_data root = ok true := by
  sorry

-- ============================================================================
-- M5: from_leaves rejects empty input
--
-- "Building a Merkle tree from an empty list of leaves returns Err(EmptyTree)."
-- ============================================================================

/-- M5: from_leaves rejects empty input.
    An empty slice of leaves produces an EmptyTree error. -/
theorem from_leaves_empty
    {T : Type}
    (asRefInst : core.convert.AsRef T (Slice Std.U8))
    (leaves : Slice T)
    (h_empty : Slice.len leaves = 0#usize) :
    merkle.MerkleTree.from_leaves asRefInst leaves =
      ok (core.result.Result.Err error.Error.EmptyTree) := by
  sorry

-- ============================================================================
-- M6: leaf_count correctness
--
-- "The leaf_count of a tree built from N leaves equals N."
-- ============================================================================

/-- M6: leaf_count matches the number of input leaves.
    If a tree is built from a non-empty slice of N leaves,
    leaf_count returns N. -/
theorem leaf_count_correct
    {T : Type}
    (asRefInst : core.convert.AsRef T (Slice Std.U8))
    (leaves : Slice T)
    (tree : merkle.MerkleTree)
    (h_built : merkle.MerkleTree.from_leaves asRefInst leaves = ok (core.result.Result.Ok tree)) :
    merkle.MerkleTree.leaf_count tree = ok (Slice.len leaves) := by
  sorry

-- ============================================================================
-- M7: verify rejects wrong root
--
-- "If the expected root differs from the actual root, verify returns false."
-- This property depends on collision resistance of the hash function, so
-- we state it conditionally.
-- ============================================================================

/-- M7: verify rejects a wrong root (assuming no hash collision).
    If we build a tree, get its root, and verify a valid proof against a
    different hash, the result is false. -/
theorem verify_wrong_root
    (proof : merkle.MerkleProof)
    (leaf_data : Slice Std.U8)
    (actual_root wrong_root : hashing.Hash)
    (h_correct : merkle.MerkleProof.verify proof leaf_data actual_root = ok true)
    (h_different : actual_root ≠ wrong_root)
    -- Collision resistance: if eq returns true, the hashes are equal
    (h_eq_sound : ∀ a b : hashing.Hash,
        hashing.Hash.Insts.CoreCmpPartialEqHash.eq a b = ok true → a = b) :
    merkle.MerkleProof.verify proof leaf_data wrong_root = ok false := by
  sorry

-- ============================================================================
-- M8: compute_root determinism
--
-- "compute_root is a pure function: same proof + same leaf = same root."
-- ============================================================================

/-- M8: compute_root is deterministic.
    The same proof and leaf data always produce the same computed root. -/
theorem compute_root_deterministic
    (proof : merkle.MerkleProof)
    (leaf_data : Slice Std.U8)
    (r₁ r₂ : core.result.Result hashing.Hash error.Error)
    (h₁ : merkle.MerkleProof.compute_root proof leaf_data = ok r₁)
    (h₂ : merkle.MerkleProof.compute_root proof leaf_data = ok r₂) :
    r₁ = r₂ := by
  sorry

end ClawdStrike.Spec.Merkle
