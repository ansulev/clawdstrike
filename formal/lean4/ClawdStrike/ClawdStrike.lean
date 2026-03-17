-- ClawdStrike Formal Verification
-- Root import file
--
-- Phase 0: Project scaffold with hand-written type definitions.
-- Phase 2: Complete algebraic type definitions, evaluation functions,
--          and sorry-admitted theorem statements for properties P1-P13.
-- Phase 3: Aeneas-generated Rust implementation, external function stubs,
--          and proofs bridging the spec to the actual Rust code.
--
-- Subsequent phases:
--   Phase 4: Fill remaining sorry-admitted proofs (P2, P4-P10).
--   Phase 5: Connect to Rust via differential testing.

-- Core type definitions (Verdict, Action, GuardConfigs, Policy)
import ClawdStrike.Core.Verdict

-- Verdict aggregation (worseResult, aggregateOverall)
import ClawdStrike.Core.Aggregate

-- Policy merge semantics (per-guard merge, GuardConfigs.mergeWith, Policy.mergeWith)
import ClawdStrike.Core.Merge

-- Cycle detection for extends chains (checkExtendsCycle, resolveChain)
import ClawdStrike.Core.Cycle

-- Per-guard evaluation and full policy evaluation (evalPolicy)
import ClawdStrike.Core.Eval

-- Ed25519 cryptographic primitives (axiomatized)
import ClawdStrike.Core.Crypto

-- Receipt structure and signing operations
import ClawdStrike.Core.Receipt

-- Formal property statements (sorry-admitted theorems P1-P13)
import ClawdStrike.Spec.Properties

-- Phase 3: Aeneas-generated Rust implementation
-- These modules compile the actual Rust core module translated by Aeneas.
-- import ClawdStrike.Impl.TypesExternal   -- External type axioms (HashMap, HashSet, etc.)
-- import ClawdStrike.Impl.Types           -- Aeneas-generated types (CoreSeverity, CoreVerdict, etc.)
-- import ClawdStrike.Impl.FunsExternal    -- External function axioms (stdlib functions)
-- import ClawdStrike.Impl.Funs            -- Aeneas-generated functions (aggregate_overall, etc.)

-- Phase 3b: Aeneas-generated Merkle tree implementation (hush-core::merkle)
-- Translated via Charon+Aeneas with leaf_hash/node_hash/hashing opaque.
-- import ClawdStrike.Impl.Merkle.Types
-- import ClawdStrike.Impl.Merkle.Funs
-- import ClawdStrike.Impl.Merkle.FunsExternal_Template
-- import ClawdStrike.Impl.Merkle.TypesExternal_Template

-- Proof modules are not imported into root to avoid pulling in sorry
-- during library builds. Import them individually for proof checking:
--
-- Phase 2 proofs (spec-level):
-- import ClawdStrike.Proofs.DenyMonotonicity
-- import ClawdStrike.Proofs.CycleTermination
-- import ClawdStrike.Proofs.MergeMonotonicity
-- import ClawdStrike.Proofs.SeverityOrder
-- import ClawdStrike.Proofs.AggregateProperties
--
-- Phase 3 proofs:
-- Ed25519 receipt signing correctness (axiom-based, no sorry):
-- import ClawdStrike.Proofs.ReceiptSigning
--
-- Merkle tree properties (M1-M8, sorry-admitted):
-- import ClawdStrike.Spec.MerkleProperties
--
-- Bridging spec to Aeneas-generated impl:
-- import ClawdStrike.Proofs.Impl.DenyMonotonicity_Impl
-- import ClawdStrike.Proofs.Impl.SpecImplEquiv
-- import ClawdStrike.Proofs.Impl.CycleTermination_Impl
