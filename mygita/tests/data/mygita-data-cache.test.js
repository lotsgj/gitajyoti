import assert from "node:assert/strict";
import { test } from "node:test";

import { createMemoryDocumentStore } from "../../src/core/cache/memory-document-store.js";
import { createMyGitaDataCache } from "../../src/data/mygita-data-cache.js";

test("separates public records from Account-scoped private projections", async () => {
  const cache = createMyGitaDataCache(createMemoryDocumentStore());
  await cache.public.catalogue.write("current", { recordVersion: "catalogue-1", data: { items: [] } });
  await cache.forAccount("user-a").profile.write("current", { recordVersion: "profile-1", data: { displayName: "A" } });
  await cache.forAccount("user-b").profile.write("current", { recordVersion: "profile-1", data: { displayName: "B" } });
  assert.deepEqual((await cache.forAccount("user-a").profile.read("current"))?.data, { displayName: "A" });
  assert.deepEqual((await cache.forAccount("user-b").profile.read("current"))?.data, { displayName: "B" });
  assert.ok(await cache.public.catalogue.read("current"));
});

test("releaseAccount clears private memory but preserves isolated durable data", async () => {
  const store = createMemoryDocumentStore();
  const cache = createMyGitaDataCache(store);
  await cache.forAccount("user-a").journey.write("current", { recordVersion: "journey-1", data: { items: ["one"] } });
  cache.releaseAccount("user-a");
  assert.deepEqual((await cache.forAccount("user-a").journey.read("current"))?.data, { items: ["one"] });
});

test("deleteAccount removes only the selected Account's durable projections", async () => {
  const cache = createMyGitaDataCache(createMemoryDocumentStore());
  await cache.forAccount("user-a").interests.write("current", { recordVersion: "1", data: ["exp-1"] });
  await cache.forAccount("user-b").interests.write("current", { recordVersion: "1", data: ["exp-2"] });
  await cache.deleteAccount("user-a");
  assert.equal(await cache.forAccount("user-a").interests.read("current"), null);
  assert.deepEqual((await cache.forAccount("user-b").interests.read("current"))?.data, ["exp-2"]);
});

test("rejects credentials and authentication material at the cache boundary", async () => {
  const cache = createMyGitaDataCache(createMemoryDocumentStore());
  await assert.rejects(
    cache.forAccount("user-a").profile.write("current", { recordVersion: "1", data: { accessToken: "secret" } }),
    /Sensitive field cannot be cached: accessToken/,
  );
  await assert.rejects(
    cache.public.experienceDetails.write("exp-1", { recordVersion: "1", data: { nested: { passwordHash: "secret" } } }),
    /Sensitive field cannot be cached: passwordHash/,
  );
});
