import assert from "node:assert/strict";
import test from "node:test";

import { fnv32, parseKeyChord } from "../lib/cdp-browser.mjs";

test("named keys map to a real key event", () => {
  const enter = parseKeyChord("Return");
  assert.equal(enter.down.type, "keyDown");
  assert.equal(enter.down.key, "Enter");
  assert.equal(enter.down.code, "Enter");
  assert.equal(enter.down.windowsVirtualKeyCode, 13);
  assert.equal(enter.down.text, "\r");
  assert.equal(enter.up.type, "keyUp");
});

test("a chord carries the modifier mask and no text", () => {
  const chord = parseKeyChord("super+c");
  assert.equal(chord.down.modifiers, 4);
  assert.equal(chord.down.key, "c");
  assert.equal(chord.down.code, "KeyC");
  assert.equal(chord.down.text, undefined);
  assert.equal(chord.down.type, "rawKeyDown");
});

test("printable keys keep their text", () => {
  const letter = parseKeyChord("a");
  assert.equal(letter.down.key, "a");
  assert.equal(letter.down.text, "a");
  assert.equal(letter.down.windowsVirtualKeyCode, 65);
  const digit = parseKeyChord("7");
  assert.equal(digit.down.code, "Digit7");
  const shifted = parseKeyChord("shift+a");
  assert.equal(shifted.down.modifiers, 8);
  assert.equal(shifted.down.key, "A");
  assert.equal(shifted.down.text, "A");
});

test("unknown keys and modifiers are rejected", () => {
  assert.throws(() => parseKeyChord(""), /press_key needs/u);
  assert.throws(() => parseKeyChord("NotAKey"), /unknown key/u);
  assert.throws(() => parseKeyChord("hyper+a"), /unknown modifier/u);
});

test("node keys hash to stable distinct ids", () => {
  assert.equal(fnv32("12#0"), fnv32("12#0"));
  assert.notEqual(fnv32("12#0"), fnv32("12#1"));
  assert.notEqual(fnv32("12#0"), fnv32("13#0"));
  assert.ok(fnv32("12#0") >= 0 && fnv32("12#0") <= 0xffffffff);
});
