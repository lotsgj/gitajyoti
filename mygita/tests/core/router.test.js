import assert from "node:assert/strict";
import { test } from "node:test";

import { beginNavigation } from "../../src/core/router.js";
import { canonicaliseHashQuery, routeFromHash, searchFromHash } from "../../src/core/url-location.js";

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

test("a query after the hash does not become part of the route", () => {
  assert.equal(routeFromHash("#/discover?provider=fixture"),"/discover");
  assert.equal(searchFromHash("#/discover?provider=fixture"),"provider=fixture");
});

test("a hash-local provider is canonicalised into the page query", () => {
  assert.deepEqual(canonicaliseHashQuery("","#/discover?provider=fixture"),{
    search:"?provider=fixture",
    hash:"#/discover",
  });
  assert.deepEqual(canonicaliseHashQuery("?provider=api","#/discover?provider=fixture"),{
    search:"?provider=api",
    hash:"#/discover",
  });
  assert.equal(canonicaliseHashQuery("?provider=fixture","#/discover"),null);
});
