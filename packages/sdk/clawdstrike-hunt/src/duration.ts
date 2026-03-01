/**
 * Parse a human-readable duration string into milliseconds.
 *
 * Supports both short and long suffixes:
 * - seconds: s, sec, secs, second, seconds
 * - minutes: m, min, mins, minute, minutes
 * - hours: h, hr, hrs, hour, hours
 * - days: d, day, days
 *
 * Returns undefined for invalid input.
 */
export function parseHumanDuration(input: string): number | undefined {
  const s = input.trim();
  if (s.length === 0) {
    return undefined;
  }

  // Find the boundary between digits and suffix
  let digitEnd = 0;
  while (digitEnd < s.length && s[digitEnd] >= '0' && s[digitEnd] <= '9') {
    digitEnd++;
  }

  // Must have both digits and suffix
  if (digitEnd === 0 || digitEnd === s.length) {
    return undefined;
  }

  const digits = s.slice(0, digitEnd);
  const suffix = s.slice(digitEnd).trim().toLowerCase();

  const value = Number(digits);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  switch (suffix) {
    case 's':
    case 'sec':
    case 'secs':
    case 'second':
    case 'seconds':
      return value * 1000;

    case 'm':
    case 'min':
    case 'mins':
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;

    case 'h':
    case 'hr':
    case 'hrs':
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;

    case 'd':
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;

    default:
      return undefined;
  }
}
