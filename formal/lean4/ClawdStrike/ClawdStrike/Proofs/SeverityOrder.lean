/-
  ClawdStrike Proofs: Severity Total Order (P3, P3a, P3b, P3c)

  This file contains proofs that the Severity type forms a total order
  via the toNat mapping. These properties are required for the aggregate
  comparison logic to be well-defined.

  Properties proven:
  - P3:  Severity ≤ is total (∀ a b, a ≤ b ∨ b ≤ a)
  - P3a: Severity ≤ is transitive
  - P3b: Severity ≤ is antisymmetric
  - P3c: Severity.toNat is injective
  - Reflexivity: a ≤ a
  - Minimum/maximum elements: info is minimum, critical is maximum
  - Strict ordering between consecutive severities

  Proof strategy: All follow from Severity.toNat being injective and
  Nat.le being a total order. Most proofs use `omega` or delegate to
  Nat properties. Exhaustive case analysis via `cases a <;> cases b`
  is used where needed.

  Rust reference: severity_ord in core/verdict.rs:25-32
  Maps Info→0, Warning→1, Error→2, Critical→3.

  Note: P3c (toNat_injective) is already proved in Core/Verdict.lean.
  We re-export it here for completeness and prove it again independently
  to demonstrate the technique.
-/

import ClawdStrike.Core.Verdict
import ClawdStrike.Spec.Properties

set_option autoImplicit false

namespace ClawdStrike.Proofs

open ClawdStrike.Core

-- ============================================================================
-- Reflexivity: a ≤ a
-- ============================================================================

theorem severity_le_refl (a : Severity) : a ≤ a := by
  show a.toNat ≤ a.toNat
  exact Nat.le_refl a.toNat

-- ============================================================================
-- P3a: Transitivity
-- ============================================================================

theorem severity_le_trans (a b c : Severity)
    (h1 : a ≤ b) (h2 : b ≤ c) : a ≤ c := by
  show a.toNat ≤ c.toNat
  exact Nat.le_trans h1 h2

-- ============================================================================
-- P3b: Antisymmetry
-- ============================================================================

theorem severity_le_antisymm (a b : Severity)
    (h1 : a ≤ b) (h2 : b ≤ a) : a = b := by
  have h_eq : a.toNat = b.toNat := Nat.le_antisymm h1 h2
  exact Severity.toNat_injective a b h_eq

-- ============================================================================
-- P3: Totality
-- ============================================================================

theorem severity_total_order (a b : Severity) :
    a ≤ b ∨ b ≤ a := by
  show a.toNat ≤ b.toNat ∨ b.toNat ≤ a.toNat
  exact Nat.le_total a.toNat b.toNat

-- ============================================================================
-- P3c: toNat is injective
-- (Alternative proof via exhaustive case analysis)
-- ============================================================================

theorem severity_toNat_injective (a b : Severity)
    (h : a.toNat = b.toNat) : a = b := by
  cases a <;> cases b <;> simp [Severity.toNat] at h <;> rfl

-- ============================================================================
-- Strict ordering is correct
-- ============================================================================

theorem severity_lt_iff_toNat_lt (a b : Severity) :
    a < b ↔ a.toNat < b.toNat :=
  Iff.rfl

-- ============================================================================
-- Concrete ordering facts
-- ============================================================================

theorem info_le_warning : Severity.info ≤ Severity.warning := by
  show (0 : Nat) ≤ 1; omega

theorem warning_le_error : Severity.warning ≤ Severity.error := by
  show (1 : Nat) ≤ 2; omega

theorem error_le_critical : Severity.error ≤ Severity.critical := by
  show (2 : Nat) ≤ 3; omega

theorem info_le_critical : Severity.info ≤ Severity.critical := by
  show (0 : Nat) ≤ 3; omega

-- ============================================================================
-- Strict ordering between consecutive severities
-- ============================================================================

theorem info_lt_warning : Severity.info < Severity.warning := by
  show (0 : Nat) < 1; omega

theorem warning_lt_error : Severity.warning < Severity.error := by
  show (1 : Nat) < 2; omega

theorem error_lt_critical : Severity.error < Severity.critical := by
  show (2 : Nat) < 3; omega

-- ============================================================================
-- Distinct severities are not equal
-- ============================================================================

theorem severity_ne_of_lt (a b : Severity) (h : a < b) : a ≠ b := by
  intro h_eq
  subst h_eq
  exact Nat.lt_irrefl a.toNat h

-- ============================================================================
-- Minimum and maximum elements
-- ============================================================================

theorem info_is_minimum (s : Severity) : Severity.info ≤ s := by
  show (0 : Nat) ≤ s.toNat
  exact Nat.zero_le s.toNat

theorem critical_is_maximum (s : Severity) : s ≤ Severity.critical := by
  show s.toNat ≤ 3
  cases s <;> simp [Severity.toNat] <;> omega

-- ============================================================================
-- toNat faithfully embeds into Nat ordering (bidirectional)
-- ============================================================================

theorem severity_le_iff_toNat_le (a b : Severity) :
    a ≤ b ↔ a.toNat ≤ b.toNat :=
  Iff.rfl

-- ============================================================================
-- Decidability (already established by instances in Verdict.lean)
-- ============================================================================

def severity_le_decidable (a b : Severity) : Decidable (a ≤ b) :=
  inferInstanceAs (Decidable (a.toNat ≤ b.toNat))

def severity_lt_decidable (a b : Severity) : Decidable (a < b) :=
  inferInstanceAs (Decidable (a.toNat < b.toNat))

end ClawdStrike.Proofs
