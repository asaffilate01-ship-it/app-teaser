import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisRequestGuard } from "../src/lib/analysis-request-guard.ts";

test("analysis requests require a successful current refresh and serialize actions", () => {
  const guard = createAnalysisRequestGuard();
  assert.equal(guard.beginAction(), null);
  const old = guard.beginRefresh();
  const current = guard.beginRefresh();
  assert.equal(guard.completeRefresh(old, true), false);
  assert.equal(guard.canAct(), false);
  assert.equal(guard.completeRefresh(current, true), true);
  const action = guard.beginAction();
  assert.ok(action !== null);
  assert.equal(guard.beginAction(), null);
  assert.equal(guard.finishAction(action), true);
  assert.equal(guard.canAct(), true);
});

test("closing a preview or refreshing invalidates earlier signed URL requests", () => {
  const guard = createAnalysisRequestGuard();
  guard.completeRefresh(guard.beginRefresh(), true);
  const first = guard.beginPreview();
  assert.equal(guard.isPreviewCurrent(first), true);
  guard.closePreview();
  assert.equal(guard.isPreviewCurrent(first), false);
  const second = guard.beginPreview();
  const refresh = guard.beginRefresh();
  assert.equal(guard.isPreviewCurrent(second), false);
  assert.equal(guard.completeRefresh(refresh, true), true);
  assert.equal(guard.isPreviewCurrent(second), false);
});

test("failed refresh and scope disposal prevent stale actions or previews", () => {
  const guard = createAnalysisRequestGuard();
  guard.completeRefresh(guard.beginRefresh(), true);
  const action = guard.beginAction();
  assert.ok(action !== null);
  const preview = guard.beginPreview();
  guard.dispose();
  assert.equal(guard.isActionCurrent(action), false);
  assert.equal(guard.finishAction(action), false);
  assert.equal(guard.isPreviewCurrent(preview), false);
  const refresh = guard.beginRefresh();
  guard.completeRefresh(refresh, false);
  assert.equal(guard.canAct(), false);
  assert.equal(guard.beginAction(), null);
});
