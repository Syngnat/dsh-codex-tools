import assert from "node:assert/strict";
import test from "node:test";

import { formatTimestamp } from "../lib/format-time.mjs";

test("timestamps print as yyyy-MM-dd HH:mm:ss UTC+8", () => {
  // 2026-10-21T06:43:38Z is 14:43:38 in UTC+8.
  assert.equal(formatTimestamp(Date.UTC(2026, 9, 21, 6, 43, 38)), "2026-10-21 14:43:38 UTC+8");
});

test("the clock is 24-hour and the day rolls over at midnight UTC+8", () => {
  // 2026-10-21T16:00:00Z is 00:00:00 on the 22nd in UTC+8.
  assert.equal(formatTimestamp(Date.UTC(2026, 9, 21, 16, 0, 0)), "2026-10-22 00:00:00 UTC+8");
  // 2026-10-21T13:05:09Z is 21:05:09 in UTC+8.
  assert.equal(formatTimestamp(Date.UTC(2026, 9, 21, 13, 5, 9)), "2026-10-21 21:05:09 UTC+8");
});

test("the smallest parts are zero padded", () => {
  assert.equal(formatTimestamp(Date.UTC(2026, 0, 2, 1, 2, 3)), "2026-01-02 09:02:03 UTC+8");
});

test("a missing or unparsable value formats as empty", () => {
  assert.equal(formatTimestamp(null), "");
  assert.equal(formatTimestamp(undefined), "");
  assert.equal(formatTimestamp("not a date"), "");
});
