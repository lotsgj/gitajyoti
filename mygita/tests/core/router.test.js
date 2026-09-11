import assert from "node:assert/strict";
import { test } from "node:test";

import { beginNavigation } from "../../src/core/router.js";

test("a new navigation cancels and makes the previous navigation stale", () => {
  const first=beginNavigation();
  assert.equal(first.signal.aborted,false);
  assert.equal(first.isCurrent(),true);
  const second=beginNavigation();
  assert.equal(first.signal.aborted,true);
  assert.equal(first.isCurrent(),false);
  assert.equal(second.signal.aborted,false);
  assert.equal(second.isCurrent(),true);
});
