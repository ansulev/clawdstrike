//! Merge strategies for policy `extends` composition (no serde, no I/O).

use std::collections::HashMap;

/// Merge strategy tag (mirrors `policy::MergeStrategy` without serde).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CoreMergeStrategy {
    /// Replace base entirely with child.
    Replace,
    /// Shallow merge: child fields override base at top level.
    Merge,
    /// Deep merge: recursively merge nested structures.
    DeepMerge,
}

/// Child overrides base for `Option<T>` (by reference).
#[inline]
#[must_use]
pub fn child_overrides<T: Clone>(base: &Option<T>, child: &Option<T>) -> Option<T> {
    child.clone().or_else(|| base.clone())
}

/// Child overrides base for non-empty strings.
#[inline]
#[must_use]
pub fn child_overrides_str(base: &str, child: &str) -> String {
    if child.is_empty() {
        base.to_string()
    } else {
        child.to_string()
    }
}

/// Child overrides base for `Option<T>` (by value).
#[inline]
#[must_use]
pub fn child_overrides_option<T: Clone>(base: Option<T>, child: Option<T>) -> Option<T> {
    child.or(base)
}

/// Merge two `Vec<T>` keyed by `key_fn`. Child replaces matching base entries;
/// new entries are appended.
pub fn merge_keyed_vec<T: Clone, K: Eq + std::hash::Hash>(
    base: &[T],
    child: &[T],
    key_fn: impl Fn(&T) -> K,
) -> Vec<T> {
    if child.is_empty() {
        return base.to_vec();
    }
    if base.is_empty() {
        return child.to_vec();
    }

    let mut out: Vec<T> = base.to_vec();
    let mut index: HashMap<K, usize> = HashMap::new();
    for (i, item) in out.iter().enumerate() {
        index.insert(key_fn(item), i);
    }

    for item in child {
        let k = key_fn(item);
        if let Some(i) = index.get(&k).copied() {
            out[i] = item.clone();
        } else {
            index.insert(k, out.len());
            out.push(item.clone());
        }
    }

    out
}

// Aeneas-compatible merge (no HashMap, no closures)

/// Linear scan for key position. Aeneas-friendly alternative to `HashMap::get`.
#[must_use]
fn find_key_position<T>(haystack: &[(String, T)], needle: &str) -> Option<usize> {
    let mut i: usize = 0;
    while i < haystack.len() {
        if haystack[i].0 == needle {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// [`merge_keyed_vec`] equivalent without `HashMap` or closures, so
/// Charon/Aeneas can translate it to Lean 4.
#[must_use]
pub fn merge_keyed_vec_pure<T: Clone>(
    base: &[(String, T)],
    child: &[(String, T)],
) -> Vec<(String, T)> {
    if child.is_empty() {
        return base.to_vec();
    }
    if base.is_empty() {
        return child.to_vec();
    }

    let mut out: Vec<(String, T)> = base.to_vec();

    let mut ci: usize = 0;
    while ci < child.len() {
        let key: &str = &child[ci].0;
        match find_key_position(&out, key) {
            Some(pos) => {
                out[pos] = child[ci].clone();
            }
            None => {
                out.push(child[ci].clone());
            }
        }
        ci += 1;
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn child_overrides_some_beats_none() {
        assert_eq!(child_overrides::<i32>(&None, &Some(42)), Some(42));
    }

    #[test]
    fn child_overrides_none_falls_back() {
        assert_eq!(child_overrides(&Some(10), &None), Some(10));
    }

    #[test]
    fn child_overrides_both_none() {
        assert_eq!(child_overrides::<i32>(&None, &None), None);
    }

    #[test]
    fn child_overrides_both_some_uses_child() {
        assert_eq!(child_overrides(&Some(10), &Some(42)), Some(42));
    }

    #[test]
    fn child_overrides_str_non_empty_child() {
        assert_eq!(child_overrides_str("base", "child"), "child");
    }

    #[test]
    fn child_overrides_str_empty_child() {
        assert_eq!(child_overrides_str("base", ""), "base");
    }

    #[test]
    fn merge_keyed_vec_empty_child() {
        let base = vec![(1, "a"), (2, "b")];
        let child: Vec<(i32, &str)> = vec![];
        let merged = merge_keyed_vec(&base, &child, |item| item.0);
        assert_eq!(merged, base);
    }

    #[test]
    fn merge_keyed_vec_empty_base() {
        let base: Vec<(i32, &str)> = vec![];
        let child = vec![(1, "x")];
        let merged = merge_keyed_vec(&base, &child, |item| item.0);
        assert_eq!(merged, child);
    }

    #[test]
    fn merge_keyed_vec_child_replaces_matching() {
        let base = vec![(1, "a"), (2, "b"), (3, "c")];
        let child = vec![(2, "B"), (4, "d")];
        let merged = merge_keyed_vec(&base, &child, |item| item.0);
        assert_eq!(merged, vec![(1, "a"), (2, "B"), (3, "c"), (4, "d")]);
    }

    #[test]
    fn merge_keyed_vec_preserves_order() {
        let base = vec![(1, "a"), (2, "b")];
        let child = vec![(3, "c"), (1, "A")];
        let merged = merge_keyed_vec(&base, &child, |item| item.0);
        // (1, "A") replaces in-place; (3, "c") appended
        assert_eq!(merged, vec![(1, "A"), (2, "b"), (3, "c")]);
    }

    #[test]
    fn child_overrides_option_some_beats_none() {
        assert_eq!(child_overrides_option(None::<bool>, Some(true)), Some(true));
    }

    #[test]
    fn child_overrides_option_none_falls_back() {
        assert_eq!(child_overrides_option(Some(false), None), Some(false));
    }

    #[test]
    fn merge_keyed_vec_pure_empty_child() {
        let base = vec![("a".to_string(), 1), ("b".to_string(), 2)];
        let child: Vec<(String, i32)> = vec![];
        let merged = merge_keyed_vec_pure(&base, &child);
        assert_eq!(merged, base);
    }

    #[test]
    fn merge_keyed_vec_pure_empty_base() {
        let base: Vec<(String, i32)> = vec![];
        let child = vec![("x".to_string(), 99)];
        let merged = merge_keyed_vec_pure(&base, &child);
        assert_eq!(merged, child);
    }

    #[test]
    fn merge_keyed_vec_pure_child_replaces_matching() {
        let base = vec![
            ("a".to_string(), 1),
            ("b".to_string(), 2),
            ("c".to_string(), 3),
        ];
        let child = vec![("b".to_string(), 20), ("d".to_string(), 4)];
        let merged = merge_keyed_vec_pure(&base, &child);
        assert_eq!(
            merged,
            vec![
                ("a".to_string(), 1),
                ("b".to_string(), 20),
                ("c".to_string(), 3),
                ("d".to_string(), 4),
            ]
        );
    }

    #[test]
    fn merge_keyed_vec_pure_preserves_order() {
        let base = vec![("x".to_string(), 10), ("y".to_string(), 20)];
        let child = vec![("z".to_string(), 30), ("x".to_string(), 99)];
        let merged = merge_keyed_vec_pure(&base, &child);
        // "x" replaced in-place; "z" appended
        assert_eq!(
            merged,
            vec![
                ("x".to_string(), 99),
                ("y".to_string(), 20),
                ("z".to_string(), 30),
            ]
        );
    }

    #[test]
    fn merge_keyed_vec_pure_both_empty() {
        let base: Vec<(String, i32)> = vec![];
        let child: Vec<(String, i32)> = vec![];
        let merged = merge_keyed_vec_pure(&base, &child);
        assert!(merged.is_empty());
    }

    #[test]
    fn merge_keyed_vec_pure_matches_hashmap_version() {
        // Ensure semantic equivalence with the HashMap-based version.
        let base = vec![
            ("alpha".to_string(), 1),
            ("beta".to_string(), 2),
            ("gamma".to_string(), 3),
        ];
        let child = vec![
            ("beta".to_string(), 22),
            ("delta".to_string(), 4),
            ("alpha".to_string(), 11),
        ];

        let pure_result = merge_keyed_vec_pure(&base, &child);
        let hash_result = merge_keyed_vec(&base, &child, |item| item.0.clone());

        assert_eq!(pure_result, hash_result);
    }
}
