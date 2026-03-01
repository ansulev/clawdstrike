/// Parse a strict `major.minor.patch` semantic version where all components are
/// unsigned decimal integers.
pub(crate) fn parse_strict_semver(value: &str) -> Option<[u32; 3]> {
    fn parse_component(component: &str) -> Option<u32> {
        if component.is_empty() {
            return None;
        }
        // SemVer numeric identifiers must not include leading zeroes.
        if component.len() > 1 && component.starts_with('0') {
            return None;
        }
        component.parse::<u32>().ok()
    }

    let mut parts = value.split('.');
    let major = parse_component(parts.next()?)?;
    let minor = parse_component(parts.next()?)?;
    let patch = parse_component(parts.next()?)?;
    if parts.next().is_some() {
        return None;
    }
    Some([major, minor, patch])
}

pub(crate) fn is_strict_semver(value: &str) -> bool {
    parse_strict_semver(value).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_strict_semver_accepts_plain_numeric_triplets() {
        assert_eq!(parse_strict_semver("0.0.0"), Some([0, 0, 0]));
        assert_eq!(parse_strict_semver("1.2.3"), Some([1, 2, 3]));
        assert_eq!(
            parse_strict_semver("4294967295.1.2"),
            Some([u32::MAX, 1, 2])
        );
    }

    #[test]
    fn parse_strict_semver_rejects_leading_zero_components() {
        assert_eq!(parse_strict_semver("01.2.3"), None);
        assert_eq!(parse_strict_semver("1.02.3"), None);
        assert_eq!(parse_strict_semver("1.2.03"), None);
    }
}
