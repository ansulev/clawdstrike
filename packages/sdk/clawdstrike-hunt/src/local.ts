import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, extname } from 'node:path';

import type { HuntQuery, TimelineEvent } from './types.js';
import { matchesQuery } from './query.js';
import { mergeTimeline, parseEnvelope } from './timeline.js';

/**
 * Default directories to search for local envelopes.
 * Returns only directories that actually exist.
 */
export async function defaultLocalDirs(): Promise<string[]> {
  const home = homedir();
  const candidates = [
    join(home, '.clawdstrike', 'receipts'),
    join(home, '.clawdstrike', 'scans'),
    join(home, '.hush', 'receipts'),
  ];

  const result: string[] = [];
  for (const dir of candidates) {
    try {
      const s = await stat(dir);
      if (s.isDirectory()) {
        result.push(dir);
      }
    } catch {
      // Directory does not exist, skip
    }
  }
  return result;
}

function truncateToNewest(
  events: TimelineEvent[],
  limit: number,
): TimelineEvent[] {
  if (limit === 0) {
    return [];
  }
  if (events.length <= limit) {
    return events;
  }
  return events.slice(events.length - limit);
}

/**
 * Query envelopes from local JSON/JSONL files.
 *
 * Reads files from the given search directories. `.json` files may contain
 * a single envelope or an array. `.jsonl` files contain one envelope per line.
 * Corrupt files/lines are skipped.
 *
 * Results are filtered by the query, merged by timestamp, and truncated
 * to the newest `query.limit` events.
 */
export async function queryLocalFiles(
  query: HuntQuery,
  searchDirs: string[],
  _verify?: boolean,
): Promise<TimelineEvent[]> {
  const allEvents: TimelineEvent[] = [];

  for (const dir of searchDirs) {
    let isDir: boolean;
    try {
      const s = await stat(dir);
      isDir = s.isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) {
      continue;
    }

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const filePath = join(dir, entry);
      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch {
        continue;
      }

      if (!fileStat.isFile()) {
        continue;
      }

      const ext = extname(entry).toLowerCase();
      let events: TimelineEvent[];

      if (ext === '.json') {
        try {
          events = await readJsonFile(filePath);
        } catch {
          continue;
        }
      } else if (ext === '.jsonl') {
        try {
          events = await readJsonlFile(filePath);
        } catch {
          continue;
        }
      } else {
        continue;
      }

      for (const event of events) {
        if (matchesQuery(query, event)) {
          allEvents.push(event);
        }
      }
    }
  }

  const merged = mergeTimeline(allEvents);
  return truncateToNewest(merged, query.limit);
}

async function readJsonFile(path: string): Promise<TimelineEvent[]> {
  const content = await readFile(path, 'utf-8');
  const value: unknown = JSON.parse(content);

  if (Array.isArray(value)) {
    return value
      .map((v) => parseEnvelope(v))
      .filter((e): e is TimelineEvent => e !== undefined);
  }

  const event = parseEnvelope(value);
  return event !== undefined ? [event] : [];
}

async function readJsonlFile(path: string): Promise<TimelineEvent[]> {
  const content = await readFile(path, 'utf-8');
  const events: TimelineEvent[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const value: unknown = JSON.parse(trimmed);
      const event = parseEnvelope(value);
      if (event !== undefined) {
        events.push(event);
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return events;
}
