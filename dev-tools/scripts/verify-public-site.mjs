import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputRoot = resolve(siteRoot, 'dist', 'site');
const mode = process.env.REGISTRATION_DEPLOY_MODE || 'mock';
for (const relative of ['index.html', 'mygita.html', 'register.html', 'privacy.html', 'CNAME', 'assets/js/register-page.js', 'assets/js/registration-repository.js', 'mygita/index.html']) {
  assert.ok(existsSync(join(outputRoot, relative)), `Missing built file: ${relative}`);
}
const html = readFileSync(join(outputRoot, 'register.html'), 'utf8');
const socialPreview = 'https://gitajyoti.org/assets/images/gitajyoti-social-preview.jpg';
for (const page of ['index.html', 'mygita.html', 'register.html']) {
  const pageHtml = readFileSync(join(outputRoot, page), 'utf8');
  assert.ok(pageHtml.includes(`property="og:image" content="${socialPreview}"`), `${page} is missing the shared Open Graph preview.`);
  assert.ok(pageHtml.includes(`name="twitter:image" content="${socialPreview}"`), `${page} is missing the shared Twitter preview.`);
}
assert.ok(html.includes(`data-registration-mode="${mode}"`), `Expected registration mode ${mode}.`);
if (mode === 'live') {
  assert.ok(html.includes('https://api.gitajyoti.org/v1/client.js'), 'Production client URL is absent.');
  assert.ok(html.includes('data-registration-api-base-url="https://api.gitajyoti.org"'), 'Production API base URL is absent.');
  assert.ok(!html.includes('dev.api.gitajyoti.org'), 'Development API URL leaked into the live public artifact.');
} else {
  assert.ok(html.includes('https://dev.api.gitajyoti.org/v1/client.js'), 'The contract-1.1 mock client URL is absent.');
  assert.ok(html.includes('data-registration-api-base-url="https://dev.api.gitajyoti.org"'), 'The mock client API base URL is absent.');
}
assert.ok(!existsSync(join(outputRoot, 'register')), 'Obsolete Apps Script registration was published.');
assert.ok(!existsSync(join(outputRoot, 'assets', 'js', 'invitation-repository.js')), 'Obsolete invitation fixture repository was published.');
assert.ok(!existsSync(join(outputRoot, 'dev-tools')), 'Development tools were published.');
console.log(`Verified public site artifact in ${mode} registration mode.`);
