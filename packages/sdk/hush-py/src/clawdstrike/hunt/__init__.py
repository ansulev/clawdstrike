"""Clawdstrike Hunt — threat hunting and timeline analysis."""

from __future__ import annotations

from clawdstrike.hunt.duration import parse_human_duration
from clawdstrike.hunt.errors import (
    CorrelationError,
    HuntError,
    IocError,
    IoError,
    ParseError,
    QueryError,
    ReportError,
    WatchError,
)
from clawdstrike.hunt.correlate import (
    CorrelationEngine,
    load_rules_from_files,
    parse_rule,
    validate_rule,
)
from clawdstrike.hunt.ioc import (
    IocDatabase,
    contains_word_bounded,
    detect_ioc_type,
)
from clawdstrike.hunt.local import default_local_dirs, query_local_files
from clawdstrike.hunt.query import (
    all_event_sources,
    effective_sources,
    matches_query,
    parse_event_source,
    parse_event_source_list,
    parse_query_verdict,
    stream_name,
    subject_filter,
)
from clawdstrike.hunt.report import (
    build_report,
    evidence_from_alert,
    evidence_from_events,
    evidence_from_ioc_matches,
    sign_report,
    verify_report,
)
from clawdstrike.hunt.timeline import merge_timeline, parse_envelope
from clawdstrike.hunt.types import (
    Alert,
    CorrelationRule,
    EventSourceType,
    EvidenceItem,
    HuntQuery,
    HuntReport,
    IocEntry,
    IocMatch,
    IocType,
    NormalizedVerdict,
    QueryVerdict,
    RuleCondition,
    RuleOutput,
    RuleSeverity,
    TimelineEvent,
    TimelineEventKind,
    WatchConfig,
    WatchStats,
)

__all__ = [
    # errors
    "HuntError",
    "QueryError",
    "ParseError",
    "IoError",
    "CorrelationError",
    "IocError",
    "WatchError",
    "ReportError",
    # types / enums
    "EventSourceType",
    "TimelineEventKind",
    "NormalizedVerdict",
    "QueryVerdict",
    "RuleSeverity",
    "IocType",
    "TimelineEvent",
    "HuntQuery",
    "RuleCondition",
    "RuleOutput",
    "CorrelationRule",
    "Alert",
    "IocEntry",
    "IocMatch",
    "EvidenceItem",
    "HuntReport",
    "WatchConfig",
    "WatchStats",
    # duration
    "parse_human_duration",
    # query
    "parse_event_source",
    "parse_event_source_list",
    "stream_name",
    "subject_filter",
    "all_event_sources",
    "parse_query_verdict",
    "effective_sources",
    "matches_query",
    # timeline
    "parse_envelope",
    "merge_timeline",
    # local
    "default_local_dirs",
    "query_local_files",
    # correlate
    "CorrelationEngine",
    "parse_rule",
    "validate_rule",
    "load_rules_from_files",
    # ioc
    "IocDatabase",
    "detect_ioc_type",
    "contains_word_bounded",
    # report
    "build_report",
    "sign_report",
    "verify_report",
    "evidence_from_alert",
    "evidence_from_events",
    "evidence_from_ioc_matches",
    # watch (lazy import — requires nats-py)
    "run_watch",
]


def __getattr__(name: str):  # type: ignore[no-untyped-def]
    """Lazy import for run_watch to avoid import error when nats-py is absent."""
    if name == "run_watch":
        from clawdstrike.hunt.watch import run_watch

        return run_watch
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
