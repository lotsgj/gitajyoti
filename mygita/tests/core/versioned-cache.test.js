import assert from "node:assert/strict";
import { test } from "node:test";

import { createMemoryDocumentStore } from "../../src/core/cache/memory-document-store.js";
import { createVersionedCache } from "../../src/core/cache/versioned-cache.js";

test("reads cloned data only when the opaque version matches", async () => {
  const cache = createVersionedCache({ store: createMemoryDocumentStore(), namespace: "catalogue", now: () => 42 });
  const source = { items: [{ id: "exp-1" }] };
  await cache.write("current", { recordVersion: "catalogue-a", data: source });
  source.items[0].id = "changed-outside";
  const hit = await cache.read("current", { version: "catalogue-a" });
  assert.deepEqual(hit, { recordVersion: "catalogue-a", fetchedAt: 42, data: { items: [{ id: "exp-1" }] } });
  assert.equal(await cache.read("current", { version: "catalogue-b" }), null);
});

test("coalesces simultaneous loads for the same key and version", async () => {
  const cache = createVersionedCache({ store: createMemoryDocumentStore(), namespace: "details" });
  let calls = 0;
  let resolveLoad;
  const loader = () => new Promise((resolve) => { calls += 1; resolveLoad = resolve; });
  const first = cache.load("exp-1", { version: "detail-1", loader });
  const second = cache.load("exp-1", { version: "detail-1", loader });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  resolveLoad({ id: "exp-1" });
  assert.deepEqual((await first).data, { id: "exp-1" });
  assert.deepEqual((await second).data, { id: "exp-1" });
});

test("does not populate a cache from an aborted load", async () => {
  const cache = createVersionedCache({ store: createMemoryDocumentStore(), namespace: "details" });
  const controller = new AbortController();
  let resolveLoad;
  const pending = cache.load("exp-1", {
    version: "detail-1",
    signal: controller.signal,
    loader: () => new Promise((resolve) => { resolveLoad = resolve; }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  resolveLoad({ id: "exp-1" });
  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.equal(await cache.read("exp-1"), null);
});

test("discards corrupt and obsolete-schema records without affecting other keys", async () => {
  const store = createMemoryDocumentStore();
  await store.set("catalogue:broken", { recordVersion: "missing-schema" });
  const versionOne = createVersionedCache({ store, namespace: "catalogue", schemaVersion: 1 });
  await versionOne.write("old", { recordVersion: "catalogue-1", data: { id: "old" } });
  await versionOne.write("good", { recordVersion: "catalogue-2", data: { id: "good" } });
  const versionTwo = createVersionedCache({ store, namespace: "catalogue", schemaVersion: 2 });
  assert.equal(await versionOne.read("broken"), null);
  assert.equal(await versionTwo.read("old"), null);
  assert.deepEqual((await versionOne.read("good"))?.data, { id: "good" });
});

test("supports targeted removal and namespace clearing", async () => {
  const store = createMemoryDocumentStore();
  const catalogue = createVersionedCache({ store, namespace: "catalogue" });
  const details = createVersionedCache({ store, namespace: "details" });
  await catalogue.write("current", { recordVersion: "1", data: {} });
  await details.write("exp-1", { recordVersion: "1", data: {} });
  await details.write("exp-2", { recordVersion: "1", data: {} });
  await details.remove("exp-1");
  assert.equal(await details.read("exp-1"), null);
  assert.ok(await details.read("exp-2"));
  await details.clear();
  assert.equal(await details.read("exp-2"), null);
  assert.ok(await catalogue.read("current"));
});
