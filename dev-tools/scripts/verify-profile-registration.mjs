import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const siteRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const clientUrl = 'https://dev.api.gitajyoti.org/v1/client.js';
const chromeCandidates = [
  process.env.MYGITA_TEST_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
if (!executablePath) throw new Error('Chrome was not found. Set MYGITA_TEST_CHROME to its executable.');

const apiClientFixture = `
const created = new Set();
const problem = (field, message) => ({ field, message });
export const normalizeProfileFields = fields => ({ ...fields });
export const checkProfileFields = fields => {
  if (fields.name.length < 2 || fields.name.length > 100) return problem('name', 'Enter a name between 2 and 100 characters.');
  if (!/^\\+[0-9 -]{8,18}$/.test(fields.mobile)) return problem('mobile', 'Enter a mobile number with country code.');
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(fields.email)) return problem('email', 'Enter a valid email address.');
  if (!['female','male','other','prefer_not_to_say'].includes(fields.gender)) return problem('gender', 'Choose a gender option.');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(fields.date_of_birth) || fields.date_of_birth < '1900-01-01') return problem('date_of_birth', 'Enter a valid date of birth.');
  if (!fields.preferred_language) return problem('preferred_language', 'Choose a preferred language.');
  return null;
};
export const createMockApi = () => ({
  async createProfile(fields) {
    globalThis.__registrationFields = fields;
    const validation = checkProfileFields(fields);
    if (validation) return { ok: false, code: 'invalid', ...validation };
    if (created.has(fields.email)) return { ok: false, code: 'duplicate', field: 'email', message: 'Already registered with this email.' };
    created.add(fields.email);
    return { ok: true, profileId: 'profile-browser-test-001' };
  }
});
export const connect = () => createMockApi();
export const renderTurnstile = async () => ({ token: async () => 'test-token', reset() {} });
`;

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.webp', 'image/webp'],
]);
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const candidate = normalize(join(siteRoot, pathname === '/' ? 'index.html' : pathname));
  if (!candidate.startsWith(`${siteRoot}/`) || !existsSync(candidate) || !statSync(candidate).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': mime.get(extname(candidate)) || 'application/octet-stream' });
  response.end(readFileSync(candidate));
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const configurePage = async page => {
  await page.route(clientUrl, route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    headers: { 'access-control-allow-origin': '*' },
    body: apiClientFixture,
  }));
};
const fillValidProfile = async (page, email = 'browser@example.org') => {
  await page.getByLabel('Name').fill('Browser Test User');
  await page.getByLabel('Mobile number').fill('+91 98450 12345');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Gender').selectOption({ label: 'Female' });
  await page.getByLabel('Date of birth').fill('1980-01-01');
  await page.locator('select[name="preferredLanguage"]').selectOption({ label: 'English' });
};
const openRegistration = async page => {
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('heading', { name: 'Create your profile' }).waitFor();
};

try {
  const page = await browser.newPage();
  await configurePage(page);
  await page.goto(`http://127.0.0.1:${port}/mygita.html`);
  await openRegistration(page);
  await fillValidProfile(page);
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  await page.getByRole('heading', { name: 'Review your Profile.' }).waitFor();
  await page.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await page.getByText('Profile created', { exact: true }).waitFor();
  assert.equal(await page.locator('#profile-id').textContent(), 'profile-browser-test-001');
  assert.equal(await page.locator('#continue-to-mygita').getAttribute('href'), 'https://mygita.gitajyoti.org/?pid=profile-browser-test-001');
  assert.deepEqual(await page.evaluate(() => Object.keys(globalThis.__registrationFields).sort()),
    ['date_of_birth', 'email', 'gender', 'mobile', 'name', 'preferred_language']);

  await page.locator('#dialog-close').click();
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  await page.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await page.getByText('Already registered with this email.').waitFor();

  await page.getByLabel('Email').fill('1@1');
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  assert.equal(await page.getByLabel('Email').getAttribute('aria-invalid'), 'true');
  await page.getByLabel('Email').fill('new@example.org');
  await page.getByLabel('Mobile number').fill('9845012345');
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  assert.equal(await page.getByLabel('Mobile number').getAttribute('aria-invalid'), 'true');
  await page.getByLabel('Mobile number').fill('+91 98450 12345');
  await page.getByLabel('Date of birth').fill('0010-01-01');
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  assert.equal(await page.getByLabel('Date of birth').getAttribute('aria-invalid'), 'true');
  await page.close();

  const filePage = await browser.newPage();
  await configurePage(filePage);
  await filePage.goto(pathToFileURL(join(siteRoot, 'mygita.html')).href);
  await openRegistration(filePage);
  await fillValidProfile(filePage, 'file@example.org');
  await filePage.getByRole('button', { name: 'Review my Profile' }).click();
  await filePage.getByRole('heading', { name: 'Review your Profile.' }).waitFor();
  await filePage.close();
  console.log('Verified Profile registration over localhost and file://: review, validation, duplicate handling, contract fields, success ID, and MyGita handoff.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
