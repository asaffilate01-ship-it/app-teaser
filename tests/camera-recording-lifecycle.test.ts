import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingLifecycle } from "../src/lib/camera-recording-lifecycle.ts";

test("a stopped recorder retains its lease until the final segment callback", () => {
  const lifecycle = createRecordingLifecycle<object>();
  const recorder = {};
  const session = lifecycle.begin();
  assert.notEqual(session, null);
  assert.ok(lifecycle.attach(session!, recorder));
  assert.equal(lifecycle.begin(), null);
  assert.equal(lifecycle.stop(), recorder);
  assert.equal(lifecycle.running(), false);
  assert.equal(lifecycle.finalizing(), true);
  assert.equal(lifecycle.begin(), null);
  assert.deepEqual(lifecycle.finish(session!, recorder), {
    accepted: true,
    continueRecording: false,
  });
  assert.equal(lifecycle.finalizing(), false);
  assert.notEqual(lifecycle.begin(), null);
});

test("a completed timed segment may rotate only within its original running session", () => {
  const lifecycle = createRecordingLifecycle<object>();
  const session = lifecycle.begin()!;
  const first = {};
  const second = {};
  assert.ok(lifecycle.attach(session, first));
  assert.deepEqual(lifecycle.finish(session, first), {
    accepted: true,
    continueRecording: true,
  });
  assert.ok(lifecycle.attach(session, second));
  assert.deepEqual(lifecycle.finish(session, first), {
    accepted: false,
    continueRecording: false,
  });
  assert.ok(lifecycle.owns(session, second));
  assert.equal(lifecycle.stop(), second);
  assert.equal(lifecycle.finish(session, second).continueRecording, false);
});

test("stale segment callbacks cannot clear or restart a newer recording", () => {
  const lifecycle = createRecordingLifecycle<object>();
  const old = {};
  const first = lifecycle.begin()!;
  assert.ok(lifecycle.attach(first, old));
  lifecycle.stop();
  lifecycle.finish(first, old);
  const second = lifecycle.begin()!;
  const current = {};
  assert.notEqual(first, second);
  assert.equal(lifecycle.attach(first, old), false);
  assert.ok(lifecycle.attach(second, current));
  assert.equal(lifecycle.finish(first, old).accepted, false);
  assert.equal(lifecycle.running(), true);
  assert.ok(lifecycle.owns(second, current));
});

test("failed startup can release an attached recorder without allowing rotation", () => {
  const lifecycle = createRecordingLifecycle<object>();
  const session = lifecycle.begin()!;
  const recorder = {};
  assert.ok(lifecycle.attach(session, recorder));
  lifecycle.stop();
  assert.equal(lifecycle.finish(session, recorder).continueRecording, false);
  assert.notEqual(lifecycle.begin(), null);
});
