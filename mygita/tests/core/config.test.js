import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveClientConfig } from "../../src/config.js";

test("root-served and built files use the same API-first provider selection", () => {
  const result=resolveClientConfig({
    embedded:{apiBaseUrl:"https://api.example.test/v1"},
    location:{hostname:"localhost",search:"?provider=fixture"},
  });
  assert.equal(result.dataProvider,"fixture");
  assert.equal(result.apiBaseUrl,"https://api.example.test/v1");
});

test("API is default and fixture is the sole explicit query override", () => {
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:""}}).dataProvider,"api");
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:"?provider=api"}}).dataProvider,"api");
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:"?provider=fixture"}}).dataProvider,"fixture");
});

test("fixture provider is accepted after the hash route", () => {
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:"",hash:"#/discover?provider=fixture"}}).dataProvider,"fixture");
});

test("the page query takes precedence over a hash-local query", () => {
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:"?provider=api",hash:"#/discover?provider=fixture"}}).dataProvider,"api");
});
