"""Local offline envelope loading from filesystem directories.

Port of ``hunt-query/src/local.rs``.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from clawdstrike.hunt.errors import IoError
from clawdstrike.hunt.query import matches_query
from clawdstrike.hunt.timeline import merge_timeline, parse_envelope
from clawdstrike.hunt.types import HuntQuery, TimelineEvent

logger = logging.getLogger(__name__)


def default_local_dirs() -> list[str]:
    """Return default directories to search for local envelopes.

    Only directories that actually exist are included.
    """
    home = Path.home()
    candidates = [
        home / ".clawdstrike" / "receipts",
        home / ".clawdstrike" / "scans",
        home / ".hush" / "receipts",
    ]
    return [str(d) for d in candidates if d.is_dir()]


def query_local_files(
    query: HuntQuery,
    search_dirs: list[str],
    verify: bool = False,
) -> list[TimelineEvent]:
    """Query envelopes from local JSON/JSONL files.

    Reads all ``.json`` and ``.jsonl`` files from the given directories,
    parses envelopes, filters with the query predicates, merges by timestamp,
    and truncates to the newest ``query.limit`` events.
    """
    all_events: list[TimelineEvent] = []

    for dir_str in search_dirs:
        dir_path = Path(dir_str)
        if not dir_path.is_dir():
            logger.debug("skipping non-directory: %s", dir_path)
            continue

        try:
            entries = list(dir_path.iterdir())
        except OSError as exc:
            raise IoError(f"failed to read directory {dir_path}: {exc}") from exc

        for entry in entries:
            if not entry.is_file():
                continue

            suffix = entry.suffix.lower()
            if suffix == ".jsonl":
                try:
                    events = _read_jsonl_file(entry)
                except Exception:
                    logger.warning("skipping unreadable/invalid JSONL file %s", entry)
                    continue
            elif suffix == ".json":
                try:
                    events = _read_json_file(entry)
                except Exception:
                    logger.warning("skipping unreadable/invalid JSON file %s", entry)
                    continue
            else:
                continue

            for event in events:
                if matches_query(query, event):
                    all_events.append(event)

    merged = merge_timeline(all_events)
    _truncate_to_newest(merged, query.limit)
    return merged


def _truncate_to_newest(events: list[TimelineEvent], limit: int) -> None:
    """Truncate *in-place* keeping only the newest ``limit`` events."""
    if limit == 0:
        events.clear()
        return
    if len(events) > limit:
        del events[: len(events) - limit]


def _read_json_file(path: Path) -> list[TimelineEvent]:
    """Read a single JSON file as envelope(s)."""
    content = path.read_text(encoding="utf-8")
    value = json.loads(content)

    if isinstance(value, list):
        results: list[TimelineEvent] = []
        for item in value:
            if isinstance(item, dict):
                event = parse_envelope(item)
                if event is not None:
                    results.append(event)
        return results
    elif isinstance(value, dict):
        event = parse_envelope(value)
        return [event] if event is not None else []
    else:
        return []


def _read_jsonl_file(path: Path) -> list[TimelineEvent]:
    """Read a JSONL file (one JSON object per line)."""
    content = path.read_text(encoding="utf-8")
    events: list[TimelineEvent] = []

    for line in content.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        try:
            value = json.loads(trimmed)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(value, dict):
            event = parse_envelope(value)
            if event is not None:
                events.append(event)

    return events
