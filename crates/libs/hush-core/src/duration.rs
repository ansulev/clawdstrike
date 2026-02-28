use chrono::Duration;

/// Parse a human-readable duration such as `30s`, `5m`, `1h`, or `2d`.
///
/// Supports both short and long suffixes:
/// - seconds: `s`, `sec`, `secs`, `second`, `seconds`
/// - minutes: `m`, `min`, `mins`, `minute`, `minutes`
/// - hours: `h`, `hr`, `hrs`, `hour`, `hours`
/// - days: `d`, `day`, `days`
pub fn parse_human_duration(s: &str) -> Option<Duration> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    let digit_end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
    if digit_end == 0 || digit_end == s.len() {
        return None;
    }

    // Guard against splitting inside a multi-byte UTF-8 sequence.
    if !s.is_char_boundary(digit_end) {
        return None;
    }

    let digits = &s[..digit_end];
    let suffix = s[digit_end..].trim().to_lowercase();
    let value: i64 = digits.parse().ok()?;

    match suffix.as_str() {
        "s" | "sec" | "secs" | "second" | "seconds" => Some(Duration::seconds(value)),
        "m" | "min" | "mins" | "minute" | "minutes" => Some(Duration::minutes(value)),
        "h" | "hr" | "hrs" | "hour" | "hours" => Some(Duration::hours(value)),
        "d" | "day" | "days" => Some(Duration::days(value)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::parse_human_duration;
    use chrono::Duration;

    #[test]
    fn parse_human_duration_short_units() {
        assert_eq!(parse_human_duration("30s"), Some(Duration::seconds(30)));
        assert_eq!(parse_human_duration("5m"), Some(Duration::minutes(5)));
        assert_eq!(parse_human_duration("1h"), Some(Duration::hours(1)));
        assert_eq!(parse_human_duration("2d"), Some(Duration::days(2)));
    }

    #[test]
    fn parse_human_duration_long_units() {
        assert_eq!(parse_human_duration("30sec"), Some(Duration::seconds(30)));
        assert_eq!(parse_human_duration("5mins"), Some(Duration::minutes(5)));
        assert_eq!(parse_human_duration("1hour"), Some(Duration::hours(1)));
        assert_eq!(parse_human_duration("3days"), Some(Duration::days(3)));
    }

    #[test]
    fn parse_human_duration_rejects_invalid() {
        assert_eq!(parse_human_duration(""), None);
        assert_eq!(parse_human_duration("abc"), None);
        assert_eq!(parse_human_duration("10x"), None);
        assert_eq!(parse_human_duration("1"), None);
        assert_eq!(parse_human_duration("30秒"), None);
    }
}
