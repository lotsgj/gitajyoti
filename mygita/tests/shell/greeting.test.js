import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { escapeHtml } from "../../src/core/dom.js";
import { greeting } from "../../src/shell/greeting.js";

const src = join(dirname(fileURLToPath(import.meta.url)), "../../src");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : entry.name.endsWith(".js") ? [join(directory, entry.name)] : []))).flat();
}

test("addresses a person before login as Atmajyoti", () => {
  assert.deepEqual(greeting(), {
    title: "Welcome Atmajyoti (Divine Self)",
    subtitle: "🙏🏼 तत्त्वमसि / YOU ARE THAT 🙏🏼",
  });
});

test("addresses a signed-in person as Atmajyoti with their display name", () => {
  const user = { id: "account-1", personalDetails: { fullName: "Vijay", displayName: "Vijay", dateOfBirth: "" } };
  assert.deepEqual(greeting(user), {
    title: "Welcome Atmajyoti (Divine Self) Vijay",
    subtitle: "TRUTH-REALISE-USE",
  });
});

test("falls back to Atmajyoti when the display name is blank", () => {
  const user = { id: "account-1", personalDetails: { fullName: "", displayName: "  ", dateOfBirth: "" } };
  assert.equal(greeting(user).title, "Welcome Atmajyoti (Divine Self)");
});

test("personalized greeting remains safe when rendered as HTML", () => {
  const user = { id: "account-1", personalDetails: { fullName: "", displayName: "<img src=x onerror=alert(1)>", dateOfBirth: "" } };
  const rendered = escapeHtml(greeting(user).title);
  assert.doesNotMatch(rendered, /<img/);
  assert.match(rendered, /&lt;img/);
});

test("superseded greeting language is absent from MyGita source", async () => {
  const source = (await Promise.all((await sourceFiles(src)).map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /Atithi|Atithi devobhava|Truth alone liberates/i);
});
