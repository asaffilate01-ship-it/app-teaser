import assert from "node:assert/strict";
import test from "node:test";
import { isCameraSignal } from "../src/lib/camera-signals.ts";

test("only bounded and addressed live camera messages are accepted", () => {
  assert.equal(isCameraSignal({ kind: "ready", from: "camera-device-1" }), true);
  assert.equal(isCameraSignal({ kind: "watch", from: "director-1", to: "camera-device-1" }), true);
  assert.equal(isCameraSignal({ kind: "leave", from: "camera-device-1", to: "director-1" }), true);
  for (const value of [
    null,
    [],
    {},
    { kind: "unknown", from: "operator" },
    { kind: "ready", from: "" },
    { kind: "ready", from: "x".repeat(121) },
    { kind: "watch", from: "director", to: "" },
    { kind: "watch", from: "director", to: "x".repeat(121) },
  ]) {
    assert.equal(isCameraSignal(value), false);
  }
});

test("live-video SDP and ICE candidates must be bounded, typed and non-empty", () => {
  assert.equal(isCameraSignal({
    kind: "offer",
    from: "camera",
    to: "director",
    description: { type: "offer", sdp: "v=0" },
  }), true);
  assert.equal(isCameraSignal({
    kind: "answer",
    from: "director",
    to: "camera",
    description: { type: "answer", sdp: "v=0" },
  }), true);
  assert.equal(isCameraSignal({
    kind: "ice",
    from: "camera",
    to: "director",
    candidate: { candidate: "candidate:sample", sdpMLineIndex: 0 },
  }), true);
  for (const value of [
    { kind: "offer", from: "camera" },
    { kind: "offer", from: "camera", description: { type: "answer", sdp: "v=0" } },
    { kind: "offer", from: "camera", description: { type: "offer", sdp: "x".repeat(65_537) } },
    { kind: "answer", from: "camera", description: { type: "answer", sdp: "" } },
    { kind: "ice", from: "camera" },
    { kind: "ice", from: "camera", candidate: { candidate: "x".repeat(4097) } },
  ]) {
    assert.equal(isCameraSignal(value), false);
  }
});
