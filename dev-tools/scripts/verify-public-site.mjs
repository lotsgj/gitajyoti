import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputRoot = resolve(siteRoot, 'dist', 'site');
const mode = process.env.REGISTRATION_DEPLOY_MODE || 'mock';
for (const relative of ['index.html', 'mygita.html', 'privacy.html', 'CNAME', 'assets/js/register-page.js', 'mygita/index.html']) {
  assert.ok(existsSync(join(outputRoot, relative)), `Missing built file: ${relative}`);
}
const html = readFileSync(join(outputRoot, 'mygita.html'), 'utf8');
assert.ok(html.includes(`data-registration-mode="${mode}"`), `Expected registration mode ${mode}.`);
assert.ok(html.includes('https://api.gitajyoti.org/v1/client.js'), 'Production client URL is absent.');
assert.ok(html.includes('data-registration-api-base-url="https://api.gitajyoti.org"'), 'Production API base URL is absent.');
assert.ok(!html.includes('dev.api.gitajyoti.org'), 'Development API URL leaked into the public artifact.');
assert.ok(!existsSync(join(outputRoot, 'register')), 'Obsolete Apps Script registration was published.');
assert.ok(!existsSync(join(outputRoot, 'dev-tools')), 'Development tools were published.');
console.log(`Verified public site artifact in ${mode} registration mode.`);
