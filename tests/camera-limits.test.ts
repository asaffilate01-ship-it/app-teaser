import test from "node:test";
import assert from "node:assert/strict";
import { cameraLimitChoices, DEFAULT_CAMERA_PHONES, directorGridClass, MAX_CAMERA_PHONES } from "../src/lib/camera-limits.ts";

test("a match camera room allows up to 16 phones", () => {
  assert.equal(MAX_CAMERA_PHONES, 16);
  const choices = cameraLimitChoices();
  assert.equal(choices.length, 16);
  assert.equal(choices[0], 1);
  assert.equal(choices[15], 16);
});

test("new camera rooms start at 4 phones", () => {
  assert.equal(DEFAULT_CAMERA_PHONES, 4);
});

test("director grid uses four columns on wide screens for more than 9 phones", () => {
  assert.match(directorGridClass(16), /xl:grid-cols-4/);
  assert.doesNotMatch(directorGridClass(4), /grid-cols-3/);
});
