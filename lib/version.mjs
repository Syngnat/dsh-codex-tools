/**
 * Strict semantic-version helpers.
 *
 * The plugin ships without runtime dependencies, so this replaces the small
 * part of `semver` the update path needs: parse a strict `X.Y.Z`, compare two of
 * them, and reject anything that is not a stable release. Prereleases, build
 * metadata, ranges and loose forms are all refused rather than guessed at.
 *
 * @module dsh-codex-tools/version
 */

/** A strict `major.minor.patch` triple with no leading zeros. */
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Parse a strict stable version.
 * @param value - Candidate version string.
 * @returns `{ major, minor, patch }`, or `null` when it is not a stable version.
 */
export function parseVersion(value) {
  if (typeof value !== "string" || value.length > 80) return null;
  const match = STABLE.exec(value);
  if (match === null) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return null;
  return { major, minor, patch };
}

/**
 * Whether a value is a strict stable version.
 * @param value - Candidate version string.
 * @returns True when it parses.
 */
export function isStableVersion(value) {
  return parseVersion(value) !== null;
}

/**
 * Compare two strict stable versions.
 * @param left - Left version.
 * @param right - Right version.
 * @returns `-1`, `0` or `1`; `null` when either side is not a stable version.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a === null || b === null) return null;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}

/**
 * Normalize a release tag to a version, accepting an optional leading `v`.
 * @param tag - Release tag such as `v1.2.3`.
 * @returns The version string, or `null` when the tag is not a stable release.
 */
export function versionFromTag(tag) {
  if (typeof tag !== "string" || tag.length > 200 || tag !== tag.trim()) return null;
  const raw = tag.startsWith("v") ? tag.slice(1) : tag;
  return isStableVersion(raw) ? raw : null;
}
