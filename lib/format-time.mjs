/**
 * Timestamp formatting for the plugin's own pages.
 *
 * @module dsh-codex-tools/format-time
 */

const OFFSET_MS = 8 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

/**
 * Format an epoch-millisecond timestamp as `yyyy-MM-dd HH:mm:ss UTC+8`.
 *
 * The offset is fixed at UTC+8 and the clock is 24-hour, so the text does not
 * change with the machine's locale or time zone settings.
 * @param value - Epoch milliseconds, or a parseable date string.
 * @returns The formatted time, or an empty string when the value is not a date.
 */
export function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Number.NaN);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";
  const shifted = new Date(time + OFFSET_MS);
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const clock = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  return `${day} ${clock} UTC+8`;
}
