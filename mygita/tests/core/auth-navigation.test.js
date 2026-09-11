import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { rememberDestination, safeInternalPath, takeDestination } from "../../src/core/auth-navigation.js";
import { MemorySessionStorage } from "../helpers/session-storage.js";

globalThis.sessionStorage=new MemorySessionStorage();
beforeEach(()=>sessionStorage.clear());

test("preserves only safe non-authentication destinations", () => {
  assert.equal(safeInternalPath("/journey"),"/journey");
  assert.equal(safeInternalPath("https://malicious.example"),"/discover");
  assert.equal(safeInternalPath("//malicious.example"),"/discover");
  assert.equal(safeInternalPath("/auth"),"/discover");
});

test("takes a remembered destination only once", () => {
  rememberDestination("/experience/gita-sara/enrol");
  assert.equal(takeDestination(),"/experience/gita-sara/enrol");
  assert.equal(takeDestination(),"/discover");
});
