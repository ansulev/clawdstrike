/**
 * Error message sanitization utility.
 *
 * Strips API keys, authorization tokens, and other sensitive material
 * from error messages before they are surfaced to the user or logged.
 */

const SENSITIVE_PATTERNS = [
  /x-apikey[:\s]+\S+/gi,
  /key[:\s]+\S+/gi,
  /authorization[:\s]+\S+/gi,
  /Bearer\s+\S+/gi,
  /apikey[=:]\S+/gi,
];

/**
 * Sanitize an error value, stripping any embedded API keys or tokens.
 *
 * @param err - The caught error (Error instance or unknown)
 * @returns A sanitized string safe for display or logging
 */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let sanitized = raw;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  // Strip URLs that might contain keys in query params
  sanitized = sanitized.replace(
    /https?:\/\/[^\s]+key=[^\s&]+/gi,
    "[URL_REDACTED]",
  );
  return sanitized;
}
