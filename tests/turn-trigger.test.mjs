/**
 * Unit tests for the plugin's turn-trigger title override. These do not render
 * React; they pin the title mapping that the keyed slot component uses.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { apply, turnTriggerText, turnTriggerTitle } from "../client-entry.js";

test("turn trigger title names the sender for agent messages", () => {
  assert.equal(
    turnTriggerTitle({ kind: "agent-message", senderSessionId: "session-a83183c4" }),
    "收到会话 session-a83183c4 的消息",
  );
  assert.equal(
    turnTriggerTitle({ kind: "agent-message", senderSessionId: "迁移任务" }),
    "收到会话 迁移任务 的消息",
  );
  assert.equal(turnTriggerTitle({ kind: "agent-message" }), "收到会话 另一个会话 的消息");
});

test("turn trigger title keeps the other trigger kinds distinct", () => {
  assert.equal(turnTriggerTitle({ kind: "goal" }), "收到目标消息");
  assert.equal(turnTriggerTitle({ kind: "subagent-settled" }), "子代理已完成");
  assert.equal(turnTriggerTitle({ kind: "webhook" }), "收到 Webhook 消息");
  assert.equal(turnTriggerTitle({ kind: "schedule" }), "收到定时任务消息");
  assert.equal(turnTriggerTitle({ kind: "tool-jobs" }), "收到任务消息");
});

test("turn trigger text joins text blocks only", () => {
  assert.equal(turnTriggerText([{ type: "text", text: "a" }, { type: "text", text: "b" }]), "a\nb");
  assert.equal(turnTriggerText([{ type: "image" }, { type: "text", text: "x" }]), "x");
  assert.equal(turnTriggerText(undefined), "");
});

test("client apply tolerates a DOM-free runtime", () => {
  const registrations = [];
  const ctx = {
    slots: {
      inject: (_name, register) => register(),
      register: (options, component) => registrations.push({ ...options, component }),
    },
    layout: { selectPanel() {} },
  };
  assert.doesNotThrow(() => apply(ctx));
  assert.ok(registrations.some((entry) => entry.name === "settings.section"));
});
