/**
 * Online update for this plugin bundle.
 *
 * The plugin is installed into a profile from its GitHub repository, so an
 * update means asking the Host's own `pluginManager` to replace the bundle with
 * a pinned commit of that repository. This module never writes profile files,
 * never runs a package manager itself, and never accepts a caller-supplied
 * source: the repository, the release endpoint and the install spec are all
 * fixed here.
 *
 * The flow is deliberately three separate steps — `check` reads public release
 * metadata, `install` requires an explicit confirmation, and the install pins
 * the target to an immutable commit that is verified against the package
 * manifest before anything is replaced. A failure after the bundle has been
 * mutated triggers a restore of the previously running version.
 *
 * @module dsh-codex-tools/update-service
 */

import { compareVersions, isStableVersion, versionFromTag } from "./version.mjs";

/** The repository this plugin is published from. */
export const REPOSITORY = "Syngnat/dsh-codex-tools";

/** The bundle package name, as the profile records it. */
export const BUNDLE_NAME = "@local/dsh-codex-tools";

/** The install spec the manager is asked to resolve. */
export const INSTALL_SPEC = `github:${REPOSITORY}`;

/** Stable-release endpoint for the fixed repository. */
export const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
/**
 * The web endpoint that redirects to the newest stable release. It is not the
 * REST API, so it is not part of the sixty-per-hour anonymous quota that a
 * shared address can exhaust.
 */
export const RELEASE_REDIRECT = `https://github.com/${REPOSITORY}/releases/latest`;
/**
 * The git smart HTTP endpoint. It carries the tag to commit mapping that the
 * REST API would otherwise answer, without spending any of that quota.
 */
export const GIT_REFS = `https://github.com/${REPOSITORY}.git/info/refs?service=git-upload-pack`;

/** Upper bound on any metadata response this module will read. */
export const MAX_RESPONSE_BYTES = 262_144;

/** Default deadline for one metadata request. */
export const CHECK_TIMEOUT_MS = 12_000;

/**
 * How long one release lookup may take before the next attempt starts. The
 * first connection to the host can hang, so a short slice leaves room for a
 * retry inside the overall budget.
 */
export const CHECK_ATTEMPT_MS = 3_000;

/** Default cooldown between two release checks. */
export const CHECK_COOLDOWN_MS = 30_000;

/** Manifest hooks that would run code during install, and are therefore refused. */
const INSTALL_HOOKS = ["preinstall", "install", "postinstall", "prepare"];

/** A typed failure whose `code` is safe to show. */
function updateError(code) {
  return Object.assign(new Error(code), { code });
}

/** Whether a manager receipt reports success. */
function applied(result) {
  return Boolean(result) && !result.error && (result.application === "applied" || result.application === "restart-required");
}

/** The fields that identify one installation, for change detection. */
function fingerprint(row) {
  return JSON.stringify([row?.name, row?.version, row?.source, row?.installed, row?.enabled, row?.availability, row?.error?.code]);
}

/** Accept only a short, lowercase, control-character-free diagnostic code. */
function safeCode(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(value) ? value : null;
}

/** Cancel a response body without surfacing a secondary failure. */
function cancelBody(response) {
  try {
    void Promise.resolve(response?.body?.cancel()).catch(() => {});
  } catch {
    /* the body is already gone */
  }
}

/**
 * Read a JSON body with a hard byte ceiling.
 * @param response - Fetch response.
 * @param signal - Caller lifetime.
 * @returns The parsed value.
 * @throws {Error} `invalid-response` when the body is oversized or not JSON.
 */
export async function boundedText(response, signal) {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    throw updateError("invalid-response");
  }
  const reader = response.body?.getReader();
  if (!reader) throw updateError("invalid-response");
  const chunks = [];
  let bytes = 0;
  let complete = false;
  const abort = () => {
    try {
      void reader.cancel().catch(() => {});
    } catch {
      /* already cancelled */
    }
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const value = await reader.read();
      signal.throwIfAborted();
      if (value.done) {
        complete = true;
        break;
      }
      if (!(value.value instanceof Uint8Array)) throw updateError("invalid-response");
      bytes += value.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw updateError("invalid-response");
      chunks.push(value.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(body);
    } catch {
      throw updateError("invalid-response");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    if (!complete) abort();
    try {
      reader.releaseLock();
    } catch {
      /* the lock is already released */
    }
  }
}

export async function boundedJson(response, signal) {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    throw updateError("invalid-response");
  }
  const reader = response.body?.getReader();
  if (!reader) throw updateError("invalid-response");
  const chunks = [];
  let bytes = 0;
  let complete = false;
  const abort = () => {
    try {
      void reader.cancel().catch(() => {});
    } catch {
      /* already cancelled */
    }
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const value = await reader.read();
      signal.throwIfAborted();
      if (value.done) {
        complete = true;
        break;
      }
      if (!(value.value instanceof Uint8Array)) throw updateError("invalid-response");
      bytes += value.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw updateError("invalid-response");
      chunks.push(value.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    } catch {
      throw updateError("invalid-response");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    if (!complete) abort();
    try {
      reader.releaseLock();
    } catch {
      /* the lock is already released */
    }
  }
}

/**
 * Read the version out of a `releases/latest` redirect.
 * @param location - The `location` header of the redirect.
 * @returns `{ latestVersion, releaseUrl }`.
 */
export function readReleaseRedirect(location) {
  if (typeof location !== "string" || location.length === 0 || location.length > 1024) {
    throw updateError("invalid-response");
  }
  let parsed;
  try {
    parsed = new URL(location);
  } catch {
    throw updateError("invalid-response");
  }
  const prefix = `/${REPOSITORY.toLowerCase()}/releases/tag/`;
  if (
    parsed.protocol !== "https:" ||
    parsed.host !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.toLowerCase().startsWith(prefix)
  ) {
    throw updateError("invalid-response");
  }
  const suffix = parsed.pathname.slice(prefix.length);
  if (suffix.includes("/")) throw updateError("invalid-response");
  const tag = decodeURIComponent(suffix);
  const latestVersion = versionFromTag(tag);
  if (latestVersion === null) throw updateError("invalid-response");
  return {
    latestVersion,
    releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(tag)}`,
  };
}

/**
 * Read one tag's commit out of a git ref advertisement.
 * @param text - The advertisement body.
 * @param tag - Tag name, such as `v2.0.1`.
 * @returns The commit the tag points at.
 */
export function readTagCommit(text, tag) {
  if (typeof text !== "string" || text.length === 0 || text.length > 4_000_000) {
    throw updateError("invalid-response");
  }
  const wanted = `refs/tags/${tag}`;
  let direct = null;
  let peeled = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    // A git ref advertisement prefixes every line with its packet length.
    const candidates = /^([0-9a-f]{40})\s+(refs\/tags\/\S+)$/u.exec(line) ? [line] : [line.slice(4)];
    for (const candidate of candidates) {
      const match = /^([0-9a-f]{40})\s+(refs\/tags\/\S+)$/u.exec(candidate);
      if (match === null) continue;
      if (match[2] === wanted) direct = match[1];
      if (match[2] === `${wanted}^{}`) peeled = match[1];
    }
  }
  const commit = peeled ?? direct;
  if (commit === null) throw updateError("not-found");
  return commit;
}

/**
 * Validate one `releases/latest` payload.
 * @param value - Parsed payload.
 * @returns `{ latestVersion, releaseUrl }`.
 * @throws {Error} `invalid-response` when any field is not exactly as expected.
 */
export function readStableRelease(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw updateError("invalid-response");
  if (value.draft !== false || value.prerelease !== false) throw updateError("invalid-response");
  const latestVersion = versionFromTag(value.tag_name);
  if (latestVersion === null) throw updateError("invalid-response");
  const url = value.html_url;
  if (typeof url !== "string" || url.length > 1024 || url !== url.trim()) throw updateError("invalid-response");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw updateError("invalid-response");
  }
  const prefix = `/${REPOSITORY.toLowerCase()}/releases/tag/`;
  if (
    parsed.protocol !== "https:" ||
    parsed.host !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.toLowerCase().startsWith(prefix)
  ) {
    throw updateError("invalid-response");
  }
  const suffix = parsed.pathname.slice(prefix.length);
  if (suffix.includes("/") || decodeURIComponent(suffix) !== value.tag_name) throw updateError("invalid-response");
  return {
    latestVersion,
    releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(value.tag_name)}`,
  };
}

/**
 * Whether an observed installation source is one this module may replace.
 *
 * Only the fixed repository is accepted, with no ref, the matching `v<version>`
 * tag, or a commit. A `link:` checkout, a fork, or any other repository is
 * refused rather than guessed at.
 * @param source - The bundle row's recorded source.
 * @param version - The version currently installed.
 * @returns True when online update may proceed.
 */
export function supportedSource(source, version) {
  if (typeof source !== "string" || source.length === 0 || source.length > 200) return false;
  if (/[\u0000-\u001f\u007f]/u.test(source)) return false;
  const [base, ref, ...rest] = source.trim().split("#");
  if (rest.length > 0) return false;
  const normalized = base
    .trim()
    .toLowerCase()
    .replace(/\.git$/u, "")
    .replace(/\/+$/u, "")
    .replace(/^git\+/u, "")
    .replace(/^(?:github:|github\.com\/|https?:\/\/github\.com\/)/u, "");
  if (normalized !== REPOSITORY.toLowerCase()) return false;
  if (ref === undefined) return true;
  const clean = ref.trim();
  return clean === `v${version}` || /^[a-f0-9]{7,40}$/iu.test(clean);
}

/** One bounded copy of an observed source, for diagnosis. */
export function observedSource(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

/**
 * Release-metadata reads and bundle replacement for this plugin.
 *
 * `check` is read-only. `install` requires `confirm: true` and is the only
 * operation that mutates the profile.
 */
export class UpdateService {
  #fetcher;
  #clock;
  #timeoutMs;
  #attemptMs;
  #cooldownMs;
  #manager;
  #currentVersion;
  #prepare;
  #active = null;
  #lastStarted = -Infinity;
  #disposed = false;

  /**
   * @param options - Wiring.
   * @param options.currentVersion - The version this module was loaded from.
   * @param options.manager - The Host `pluginManager` service.
   * @param options.fetch - Fetch implementation; defaults to the global.
   * @param options.clock - Monotonic-enough clock; defaults to `Date.now`.
   * @param options.timeoutMs - Metadata deadline.
   * @param options.cooldownMs - Minimum interval between checks.
   * @param options.prepare - Release this plugin's own helper processes before
   *   the bundle is replaced. Windows keeps an image lock on a running helper,
   *   and that lock makes both the removal and the reinstall fail with EPERM.
   */
  constructor(options = {}) {
    if (!isStableVersion(options.currentVersion)) throw new Error("update-service: currentVersion must be a stable version");
    this.#currentVersion = options.currentVersion;
    this.#manager = options.manager;
    this.#prepare = typeof options.prepare === "function" ? options.prepare : null;
    this.#fetcher = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.#clock = options.clock ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS;
    this.#attemptMs = options.attemptMs ?? CHECK_ATTEMPT_MS;
    this.#cooldownMs = options.cooldownMs ?? CHECK_COOLDOWN_MS;
    this.value = Object.freeze({
      currentVersion: this.#currentVersion,
      status: "idle",
      latestVersion: null,
      releaseUrl: null,
      checkedAt: null,
      error: null,
      installSpec: INSTALL_SPEC,
    });
  }

  /** The last check result plus the running version. */
  status() {
    return Object.freeze({ ...this.value });
  }

  /** The current version this module was loaded from. */
  get currentVersion() {
    return this.#currentVersion;
  }

  #fail(code) {
    this.value = Object.freeze({
      ...this.value,
      status: "error",
      latestVersion: null,
      releaseUrl: null,
      checkedAt: this.#clock(),
      error: code,
    });
    return this.status();
  }

  /**
   * Release this plugin's own helper before the bundle is replaced.
   *
   * The call happens before any mutation, so a helper that cannot be released
   * stops the update while the working installation is still intact instead of
   * leaving the plugin removed and the reinstall blocked by a locked file.
   *
   * @throws {Error} `helper-in-use` or `prepare-failed` when release fails.
   */
  async #releaseForReplace() {
    if (this.#prepare === null) return;
    try {
      await this.#prepare();
    } catch (error) {
      throw updateError(safeCode(error?.code) ?? "prepare-failed");
    }
  }

  /**
   * Query the fixed release endpoint once.
   * @param signal - Caller lifetime.
   * @param options - `preferApi` starts from the REST API for an explicit check.
   * @returns `{ latestVersion, releaseUrl }`.
   */
  async #release(signal, options = {}) {
    signal.throwIfAborted();
    // An explicit check starts at the REST API: the web redirect can be
    // edge-cached for a short window immediately after a release and then
    // reports the previous version as latest.
    if (options.preferApi === true) {
      try {
        return await this.#releaseByApi(signal);
      } catch {
        /* fall through to the redirect; an explicit check still needs a result */
      }
    }
    // The web endpoint answers with a redirect to the newest stable release.
    // It is not the REST API, so it does not spend the anonymous quota.
    let lastError = null;
    try {
      const release = await this.#releaseByRedirect(signal);
      // A redirect that is not newer than the running version is suspicious:
      // it may still point at the previous release. Ask the REST API once and
      // prefer a genuinely newer answer; if the API is unavailable, keep the
      // redirect result (which is also how a legitimately-ahead build reads).
      if (compareVersions(release.latestVersion, this.#currentVersion) <= 0) {
        try {
          const fresh = await this.#releaseByApi(signal);
          if (compareVersions(fresh.latestVersion, release.latestVersion) > 0) return fresh;
        } catch {
          /* freshness is best-effort; the redirect remains authoritative */
        }
      }
      return release;
    } catch (error) {
      lastError = error;
    }
    // The REST API still works when the anonymous quota is not spent.
    if (safeCode(lastError?.code) === "rate-limited") {
      try {
        return await this.#releaseByApi(signal);
      } catch (error) {
        if (safeCode(error?.code) === "rate-limited") throw lastError;
        throw error;
      }
    }
    throw lastError ?? updateError("network");
  }

  /**
   * Fetch one URL, retrying a transport hiccup.
   *
   * The first connection to a host can hang for the whole timeout when a
   * proxy is involved, so each attempt gets a short slice and a fresh one.
   * @param url - Target URL.
   * @param options - Fetch options.
   * @param attempts - How many attempts to make.
   * @returns The response.
   */
  async #fetchWithRetry(url, options = {}, attempts = 3) {
    const caller = options.signal ?? null;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const slice = AbortSignal.timeout(this.#attemptMs);
      const signal = caller ? AbortSignal.any([caller, slice]) : slice;
      try {
        return await this.#fetcher(url, { ...options, signal });
      } catch (error) {
        lastError = error;
        if (caller?.aborted) throw error;
        const transport =
          error?.name === "AbortError" ||
          error?.code === 23 ||
          error?.code === "ABORT_ERR" ||
          error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
          error?.cause?.code === "ECONNRESET" ||
          error?.cause?.code === "ETIMEDOUT";
        if (!transport) throw error;
      }
    }
    throw lastError ?? updateError("network");
  }

  /** @param signal - Caller lifetime. @returns The newest stable release. */
  async #releaseByRedirect(signal) {
    const response = await this.#fetchWithRetry(RELEASE_REDIRECT, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: { "User-Agent": "dsh-codex-tools-update-check" },
      signal,
    });
    try {
      signal.throwIfAborted();
      if (!response || typeof response.status !== "number" || typeof response.headers?.get !== "function") {
        throw updateError("invalid-response");
      }
      if (response.status === 403 || response.status === 429) throw updateError("rate-limited");
      if (response.status === 404) throw updateError("not-found");
      if (response.status >= 500) throw updateError("network");
      if (response.status < 300 || response.status >= 400) throw updateError("invalid-response");
      const location = response.headers.get("location");
      cancelBody(response);
      return readReleaseRedirect(location);
    } catch (error) {
      cancelBody(response);
      throw error;
    }
  }

  /** @param signal - Caller lifetime. @returns The newest stable release. */
  async #releaseByApi(signal) {
    const response = await this.#fetchWithRetry(RELEASE_API, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: { "User-Agent": "dsh-codex-tools-update-check", Accept: "application/vnd.github+json" },
      signal,
    });
    try {
      signal.throwIfAborted();
      if (!response || typeof response.status !== "number" || typeof response.headers?.get !== "function") {
        throw updateError("invalid-response");
      }
      if (response.redirected || (response.url && response.url !== RELEASE_API)) throw updateError("invalid-response");
      if (response.status === 403 || response.status === 429) throw updateError("rate-limited");
      if (response.status === 404) throw updateError("not-found");
      if (response.status >= 500) throw updateError("network");
      if (response.status !== 200) throw updateError("invalid-response");
      const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (type !== "application/json" && type !== "application/vnd.github+json") throw updateError("invalid-response");
      return readStableRelease(await boundedJson(response, signal));
    } catch (error) {
      cancelBody(response);
      throw error;
    }
  }

  /**
   * Check the fixed repository for a newer stable release.
   *
   * Read-only: it never downloads or installs anything, and a repeated call
   * inside the cooldown returns the previous result. An explicit user/tool
   * check passes `force: true`: it bypasses the cooldown and asks the REST API
   * first, so a just-published release is visible immediately.
   * @param options - `force` bypasses the cooldown for an explicit check.
   * @returns The check result.
   */
  async check(options = {}) {
    if (this.#disposed) return this.#fail("network");
    if (this.#active !== null) return this.#active;
    const force = options?.force === true;
    const elapsed = this.#clock() - this.#lastStarted;
    if (!force && this.value.checkedAt !== null && elapsed >= 0 && elapsed < this.#cooldownMs) return this.status();
    this.#lastStarted = this.#clock();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(updateError("timeout")), this.#timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    this.#active = Promise.resolve()
      .then(() => this.#release(controller.signal, { preferApi: force }))
      .then((release) => {
        controller.signal.throwIfAborted();
        const order = compareVersions(release.latestVersion, this.#currentVersion);
        this.value = Object.freeze({
          ...this.value,
          ...release,
          status: order > 0 ? "update-available" : order < 0 ? "ahead" : "current",
          checkedAt: this.#clock(),
          error: null,
        });
        return this.status();
      })
      .catch((error) => this.#fail(safeCode(error?.code) ?? "network"))
      .finally(() => {
        clearTimeout(timer);
        this.#active = null;
      });
    return this.#active;
  }

  /** The bundle row for this plugin, or undefined. */
  async #bundle() {
    if (!this.#manager) return undefined;
    const rows = await this.#manager.listBundles();
    return rows.find((row) => row.name === BUNDLE_NAME);
  }

  /**
   * Decide whether this installation may be replaced online.
   * @returns `{ reason, row }`; `reason` is null when an install may proceed.
   */
  async eligibility() {
    if (!this.#manager) return { reason: "manager-unavailable", row: undefined };
    const row = await this.#bundle();
    if (!row?.installed) return { reason: "not-installed", row };
    if (row.availability !== "profile") return { reason: "unsupported-installation", row };
    if (row.readOnlyReason) return { reason: "unsupported-installation", row };
    if (row.error) return { reason: "installation-error", row };
    if (!isStableVersion(row.version) || !isStableVersion(this.#currentVersion)) return { reason: "unsupported-version", row };
    if (row.version !== this.#currentVersion) return { reason: "restart-required", row };
    if (!supportedSource(row.source, row.version)) return { reason: "unsupported-source", row };
    if (!row.enabled) return { reason: "disabled", row };
    return { reason: null, row };
  }

  /**
   * Report the running version, the last check, and whether an install is possible.
   * @returns A status object safe to show.
   */
  async statusWithEligibility() {
    const { reason, row } = await this.eligibility();
    return {
      ...this.status(),
      available: reason === null,
      reason,
      source: observedSource(row?.source),
      installedVersion: isStableVersion(row?.version) ? row.version : null,
    };
  }

  /**
   * Resolve one version to an immutable commit and verify the package there.
   *
   * The manifest at that commit must declare this package name, this version and
   * a bundle patch, and must not declare an install hook.
   * @param version - Target version.
   * @param signal - Caller lifetime.
   * @returns The pinned install spec.
   */
  async #resolve(version, signal) {
    if (!isStableVersion(version)) throw updateError("unsupported-version");
    const deadline = AbortSignal.timeout(this.#timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const json = async (url) => {
      try {
        const response = await this.#fetchWithRetry(url, {
          signal: combined,
          redirect: "error",
          headers: { Accept: "application/vnd.github+json", "User-Agent": "dsh-codex-tools-update-check" },
        });
        if (!response.ok) {
          cancelBody(response);
          throw updateError([403, 429].includes(response.status) ? "rate-limited" : "metadata-unavailable");
        }
        return await boundedJson(response, combined);
      } catch (error) {
        if (error?.code === "rate-limited" || error?.code === "metadata-unavailable") throw error;
        throw updateError(combined.aborted ? "timeout" : "metadata-unavailable");
      }
    };
    // The git smart HTTP endpoint carries the tag to commit mapping, and it
    // is not part of the REST API's anonymous quota.
    const refs = await this.#fetchWithRetry(GIT_REFS, {
      method: "GET",
      redirect: "error",
      headers: { "User-Agent": "dsh-codex-tools-update-check" },
      signal: combined,
    });
    if (!refs.ok) {
      cancelBody(refs);
      if (refs.status === 403 || refs.status === 429) throw updateError("rate-limited");
      throw updateError("metadata-unavailable");
    }
    const commit = readTagCommit(await boundedText(refs, combined), `v${version}`);
    return this.#resolveAt(version, commit, signal, json);
  }

  /**
   * Verify the package at a known commit and return its install spec.
   * @param version - Version that commit must declare.
   * @param commit - Immutable commit.
   * @param signal - Caller lifetime.
   * @param json - Metadata reader, when one is supplied.
   * @returns The pinned install spec.
   */
  async #resolveAt(version, commit, signal, json = undefined) {
    if (!isStableVersion(version)) throw updateError("unsupported-version");
    const deadline = AbortSignal.timeout(this.#timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const read = json ?? (async (url) => {
      try {
        const response = await this.#fetcher(url, {
          signal: combined,
          redirect: "error",
          headers: { Accept: "application/vnd.github+json", "User-Agent": "dsh-codex-tools-update-check" },
        });
        if (!response.ok) {
          cancelBody(response);
          throw updateError([403, 429].includes(response.status) ? "rate-limited" : "metadata-unavailable");
        }
        return await boundedJson(response, combined);
      } catch (error) {
        if (error?.code === "rate-limited" || error?.code === "metadata-unavailable") throw error;
        throw updateError(combined.aborted ? "timeout" : "metadata-unavailable");
      }
    });
    const manifest = await read(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/package.json`);
    if (manifest?.name !== BUNDLE_NAME || manifest?.version !== version) throw updateError("package-mismatch");
    if (manifest?.dsh?.bundle === undefined || typeof manifest.dsh.bundle !== "object" || Array.isArray(manifest.dsh.bundle)) {
      throw updateError("package-mismatch");
    }
    if (INSTALL_HOOKS.some((key) => manifest.scripts?.[key] !== undefined)) throw updateError("script-review-required");
    return `${INSTALL_SPEC}#${commit}`;
  }

  /**
   * Resolve one version to an immutable, verified install spec.
   *
   * A source that already names a commit is reused as is, so the restore point
   * is the exact commit that is running now.
   * @param version - Target version.
   * @param signal - Caller lifetime.
   * @param source - Observed install source, when one is known.
   * @returns The pinned install spec.
   */
  async resolveSpec(version, signal, source) {
    const commit = typeof source === "string" ? source.split("#")[1] : null;
    if (typeof commit === "string" && /^[a-f0-9]{40}$/iu.test(commit)) {
      return this.#resolveAt(version, commit.toLowerCase(), signal);
    }
    return this.#resolve(version, signal);
  }

  /** Re-read the bundle row and assert it matches an expected installation. */
  async #expect(version, spec) {
    const row = await this.#bundle();
    if (!row?.installed || row.availability !== "profile" || row.error || row.version !== version || row.source !== spec) {
      throw updateError("version-mismatch");
    }
    return row;
  }

  /**
   * Replace this bundle with the pinned target, restoring the previous version
   * if anything fails after the profile has been mutated.
   * @param options - Install request.
   * @param options.confirm - Must be exactly `true`.
   * @param options.version - Target version; defaults to the last checked latest.
   * @param options.signal - Caller lifetime.
   * @returns A result describing the outcome.
   */
  async install(options = {}) {
    if (this.#disposed) throw updateError("unavailable");
    if (options.confirm !== true) throw updateError("confirmation-required");
    const { reason, row } = await this.eligibility();
    if (reason !== null) throw updateError(reason);
    const target = options.version ?? this.value.latestVersion;
    if (!isStableVersion(target)) throw updateError("check-required");
    if (compareVersions(target, row.version) <= 0) throw updateError("not-newer");

    const signal = options.signal ?? new AbortController().signal;
    const targetSpec = await this.#resolve(target, signal);
    const restoreSpec = await this.#resolve(row.version, signal);
    const before = fingerprint(await this.#bundle());
    await this.#releaseForReplace();

    let mutated = false;
    let primaryError = null;
    try {
      const removed = await this.#manager.removeBundle(BUNDLE_NAME);
      if (!applied(removed)) throw updateError("remove-failed");
      mutated = true;
      if ((await this.#bundle())?.installed) throw updateError("remove-failed");

      const installed = await this.#manager.installBundle(targetSpec, { enabled: false });
      if (!applied(installed) || installed.bundle !== BUNDLE_NAME || installed.version !== target) {
        throw updateError("install-failed");
      }
      let restart = installed.application === "restart-required";
      await this.#expect(target, targetSpec);

      const enabled = await this.#manager.setBundleEnabled(BUNDLE_NAME, row.enabled);
      if (!applied(enabled)) throw updateError("enable-failed");
      restart = restart || enabled.application === "restart-required";
      const after = await this.#expect(target, targetSpec);
      if (after.enabled !== row.enabled) throw updateError("enable-failed");

      return {
        outcome: restart ? "restart-required" : "updated",
        installedVersion: target,
        previousVersion: row.version,
        restartRequired: restart,
        spec: targetSpec,
      };
    } catch (error) {
      primaryError = safeCode(error?.code) ?? "host-error";
      if (!mutated) throw updateError(primaryError);
      return await this.#recover({ row, restoreSpec, targetSpec, primaryError, before });
    }
  }

  /**
   * Restore the previously running version after a failed replacement.
   * @param context - The plan and the failure that triggered recovery.
   * @returns A result describing the restored or unrecoverable state.
   */
  async #recover({ row, restoreSpec, targetSpec, primaryError, before }) {
    const fail = (code, detailCode) => {
      const error = updateError(code);
      error.outcome = "repair-required";
      error.detailCode = detailCode ?? null;
      return error;
    };
    try {
      let current = await this.#bundle();
      // Never overwrite an installation another manager caller made in the meantime.
      const foreign =
        current?.installed &&
        !([row.version].includes(current.version) && [row.source, restoreSpec, targetSpec].includes(current.source));
      if (foreign) throw fail("inventory-changed", "foreign-installation");

      if (current?.installed && current.version === row.version && !current.error && current.availability === "profile" && current.source === row.source) {
        const enabled = await this.#manager.setBundleEnabled(BUNDLE_NAME, row.enabled);
        if (!applied(enabled)) throw fail("recovery-failed", safeCode(enabled?.error?.code));
      } else {
        if (current?.installed) {
          const removed = await this.#manager.removeBundle(BUNDLE_NAME);
          if (!applied(removed)) throw fail("recovery-failed", safeCode(removed?.error?.code));
        }
        try {
          await this.#releaseForReplace();
        } catch (error) {
          throw fail("recovery-failed", safeCode(error?.code) ?? "prepare-failed");
        }
        const installed = await this.#manager.installBundle(restoreSpec, { enabled: false });
        if (!applied(installed) || installed.version !== row.version) throw fail("recovery-failed", safeCode(installed?.error?.code));
        const enabled = await this.#manager.setBundleEnabled(BUNDLE_NAME, row.enabled);
        if (!applied(enabled)) throw fail("recovery-failed", safeCode(enabled?.error?.code));
      }
      current = await this.#bundle();
      if (!current?.installed || current.version !== row.version || current.enabled !== row.enabled || current.error) {
        throw fail("recovery-failed", "post-check");
      }
      return {
        outcome: "restored",
        restoredVersion: row.version,
        failedVersion: targetSpec,
        error: primaryError,
        before,
      };
    } catch (recovery) {
      const error = updateError(primaryError);
      error.outcome = "repair-required";
      error.detailCode = safeCode(recovery?.detailCode) ?? safeCode(recovery?.code) ?? "recovery-failed";
      throw error;
    }
  }

  /** Stop accepting work and abort any in-flight check. */
  dispose() {
    this.#disposed = true;
    this.#active = null;
  }
}
