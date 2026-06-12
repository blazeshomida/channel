import { expect, test } from "vite-plus/test";

import { isPeerMessage } from "../../src/peer/_runtime/message-guards";

test("narrows every complete peer message variant", () => {
  const messages: unknown[] = [
    { type: "request", id: 1, name: "task.run", payload: null },
    { type: "response", id: 1, ok: true, payload: "done" },
    {
      type: "response",
      id: 1,
      ok: false,
      error: { code: "REQUEST_FAILED", message: "Failed." },
    },
    { type: "notification", name: "progress", payload: 1 },
    { type: "cancel", id: 1 },
    { type: "cancel", id: 1, reason: "not needed" },
    { type: "stream-request", id: 1, name: "numbers", payload: null },
    { type: "stream-pull", id: 1 },
    { type: "stream-item", id: 1, payload: 1 },
    { type: "stream-end", id: 1 },
    {
      type: "stream-error",
      id: 1,
      error: { code: "STREAM_FAILED", message: "Failed." },
    },
  ];

  expect(messages.every(isPeerMessage)).toBe(true);
});

test("rejects malformed peer message variants", () => {
  const throwingMessage = Object.defineProperty({}, "type", {
    get() {
      throw new Error("Cannot read type.");
    },
  });
  const messages: unknown[] = [
    null,
    "request",
    [],
    {},
    { type: "unknown" },
    { type: "request", id: 1, name: "task.run" },
    { type: "request", id: 0, name: "task.run", payload: null },
    { type: "response", id: 1, ok: true },
    { type: "response", id: 1, ok: false },
    {
      type: "response",
      id: 1,
      ok: false,
      error: { code: "UNKNOWN", message: "Failed." },
    },
    { type: "notification", name: "progress" },
    { type: "cancel", id: "1" },
    { type: "stream-request", id: 1, name: "numbers" },
    { type: "stream-pull" },
    { type: "stream-item", id: 1 },
    { type: "stream-end", id: Number.NaN },
    { type: "stream-error", id: 1, error: { code: "STREAM_FAILED" } },
    throwingMessage,
  ];

  expect(messages.some(isPeerMessage)).toBe(false);
});
