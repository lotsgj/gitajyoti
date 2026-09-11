import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveClientConfig } from "../../src/config.js";

test("production is API-only and disables development features", () => {
  const result=resolveClientConfig({
    embedded:{mode:"production",apiBaseUrl:"https://api.example.test/v1"},
    runtime:{dataProvider:"fixture",features:{developerTools:true,prototypeOtp:true}},
    location:{hostname:"localhost",search:"?provider=fixture"},
  });
  assert.equal(result.dataProvider,"api");
  assert.equal(result.apiBaseUrl,"https://api.example.test/v1");
  assert.deepEqual(result.features,{developerTools:false,prototypeOtp:false});
});

test("development retains explicit fixture and API selection", () => {
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:""}}).dataProvider,"fixture");
  assert.equal(resolveClientConfig({location:{hostname:"localhost",search:"?provider=api"}}).dataProvider,"api");
});
