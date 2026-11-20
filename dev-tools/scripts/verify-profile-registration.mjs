import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const siteRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const clientUrl = 'https://api.gitajyoti.org/v1/client.js';
const devClientUrl = 'https://dev.api.gitajyoti.org/v1/client.js';
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
const profiles = new Map();
const invitation = {
  code: 'g4c-nov26-radhakrishna',
  experience: { id: '1', name: 'Gita for Children' },
  offering: {
    id: '1', name: 'Gita for Children - Radhakrishna Batch',
    acharyas: [{ id: '2', name: 'AJ Vijay P', profilePic: null }], languages: ['sa', 'en', 'kn'], startDate: '2026-11-30'
  }
};
const invitationActions = [{ link: 'https://example.com/mock-group', label: 'Join the mock group', prompt: 'Join the mock group for class updates.' }];
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
  async createProfile(fields, options = {}) {
    globalThis.__registrationFields = fields;
    const validation = checkProfileFields(fields);
    if (validation) return { ok: false, code: 'invalid', ...validation };
    const existing = profiles.get(fields.email);
    if (existing && options.invitationCode) return { ok: true, profileId: existing, created: false, onSuccess: invitationActions };
    if (existing) return { ok: false, code: 'duplicate', message: 'Already registered with this email.' };
    profiles.set(fields.email, 'GJ-7K3M-9QX2');
    return { ok: true, profileId: 'GJ-7K3M-9QX2', created: true, onSuccess: options.invitationCode ? invitationActions : [] };
  },
  async getInvitation(code) {
    if (code.trim().toLowerCase() === invitation.code) return { ok: true, invitation };
    return { ok: false, code: 'not_found', message: 'We couldn’t find an active invitation with that code.' };
  }
});
export const connect = () => ({
  async createProfile() {
    return { ok: false, code: 'unavailable', message: 'Profile registration is not available yet.' };
  },
  async getInvitation(code) {
    return createMockApi().getInvitation(code);
  }
});
export const renderTurnstile = async () => ({ token: async () => 'test-token', reset() {} });
`;

const consumerServer = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<style>.mygita-acharyas{display:flex}.mygita-acharya-name{color:red}</style>' +
    '<mygita-invitation code="sample"></mygita-invitation>');
});
await new Promise(resolveListen => consumerServer.listen(0, '127.0.0.1', resolveListen));

const appUrl = `http://127.0.0.1:${consumerServer.address().port}/app/?lang=en&view=learn#home`;
const server = spawn('python3', [
  join(siteRoot, 'dev-tools/scripts/serve-website.py'), '--port', '0', '--mygita-url', appUrl,
], { stdio: ['ignore', 'pipe', 'ignore'] });
const stopped = once(server, 'close');
let browser;
const configurePage = async page => {
  const fulfillClient = route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    headers: { 'access-control-allow-origin': '*' },
    body: apiClientFixture,
  });
  await page.route(clientUrl, fulfillClient);
  await page.route(devClientUrl, fulfillClient);
};
const configureMockPage = async page => {
  await configurePage(page);
  await page.route('**/register.html*', async route => {
    const original = await route.fetch();
    const html = (await original.text()).replace('data-registration-mode="live"', 'data-registration-mode="mock"');
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
};
const fillValidProfile = async (page, email = 'browser@example.org') => {
  await page.getByLabel('Name').fill('Browser Test User');
  await page.getByLabel('Mobile number').fill('+91 98450 12345');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Gender').selectOption({ label: 'Female' });
  await page.getByLabel('Date of birth').fill('1980-01-01');
  await page.locator('select[name="preferredLanguage"]').selectOption({ label: 'English' });
};
try {
  const lines = createInterface({ input: server.stdout });
  const [ready] = await Promise.race([
    once(lines, 'line'),
    stopped.then(() => { throw new Error('Local website server exited before startup.'); }),
  ]);
  lines.close();
  const { port } = new URL(ready.replace('Serving Gita Jyoti at ', ''));
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await configureMockPage(page);
  await page.goto(`http://127.0.0.1:${port}/mygita.html`);
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: 'Create your Profile.' }).waitFor();
  await fillValidProfile(page);
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  await page.getByRole('heading', { name: 'Review your Profile.' }).waitFor();
  await page.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await page.getByText('Profile created', { exact: true }).waitFor();
  assert.equal(await page.locator('#profile-id').textContent(), 'GJ-7K3M-9QX2');
  const expectedApp = new URL(appUrl);
  expectedApp.searchParams.set('pid', 'GJ-7K3M-9QX2');
  const [appTab] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#continue-to-mygita').click(),
  ]);
  await appTab.waitForURL(expectedApp.href);
  await appTab.close();
  assert.equal(await page.locator('#continue-to-mygita').getAttribute('target'), '_blank');
  assert.equal(await page.locator('#continue-to-mygita').getAttribute('rel'), 'noopener noreferrer');
  assert.match(await page.locator('.registration-profile-id').innerText(), /Keep this Profile ID/);
  assert.deepEqual(await page.evaluate(() => Object.keys(globalThis.__registrationFields).sort()),
    ['date_of_birth', 'email', 'gender', 'mobile', 'name', 'preferred_language']);

  await page.locator('#dialog-close').click();
  await page.getByRole('button', { name: 'Review my Profile' }).click();
  await page.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await page.getByText('Already registered with this email.').waitFor();
  await page.locator('#edit-profile').click();

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

  const invitationPage = await browser.newPage();
  await configureMockPage(invitationPage);
  await invitationPage.goto(`http://127.0.0.1:${port}/register.html?i=g4c-nov26-radhakrishna`);
  await invitationPage.locator('#invitation-summary').getByText('Invitation applied', { exact: true }).waitFor();
  await invitationPage.getByRole('heading', { name: 'Gita for Children' }).waitFor();
  await fillValidProfile(invitationPage, 'invited@example.org');
  await invitationPage.getByRole('button', { name: 'Review my Profile' }).click();
  const reviewInvitation = invitationPage.locator('#review-invitation');
  await reviewInvitation.getByRole('heading', { name: 'Gita for Children' }).waitFor();
  for (const text of ['Gita for Children - Radhakrishna Batch', 'Guided by', 'AJ Vijay P',
    'Sanskrit · English · Kannada · Begins 30 November 2026']) {
    await reviewInvitation.getByText(text, { exact:true }).waitFor();
  }
  await reviewInvitation.locator('.mygita-acharya-initials').waitFor();
  await invitationPage.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await invitationPage.getByRole('link', { name: 'Join the mock group' }).waitFor();
  assert.equal(await invitationPage.getByRole('link', { name: 'Join the mock group' }).getAttribute('href'), 'https://example.com/mock-group');
  assert.equal(await invitationPage.getByText('Join the mock group for class updates.').count(), 1);
  assert.equal(await invitationPage.getByRole('link', { name: 'Join the mock group' }).getAttribute('target'), '_blank');
  await invitationPage.locator('#dialog-close').click();
  await invitationPage.getByRole('button', { name: 'Review my Profile' }).click();
  await invitationPage.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await invitationPage.getByText('Invitation added', { exact: true }).waitFor();
  await invitationPage.getByRole('link', { name: 'Join the mock group' }).waitFor();
  await invitationPage.locator('#dialog-close').click();
  await invitationPage.getByRole('button', { name: 'Change invitation' }).click();
  await invitationPage.getByLabel('Invitation code').fill('not-a-real-code');
  await invitationPage.getByRole('button', { name: 'Apply' }).click();
  await invitationPage.getByRole('alert').filter({ hasText: 'We couldn’t find an active invitation with that code.' }).waitFor();
  await invitationPage.close();

  const rendererPage = await browser.newPage();
  await rendererPage.goto(`http://127.0.0.1:${consumerServer.address().port}/`);
  const component = rendererPage.locator('mygita-invitation');
  const moduleUrl = `http://127.0.0.1:${port}/assets/js/mygita-invite-handler/v2/index.js`;
  await rendererPage.evaluate(async url => {
    const element = document.querySelector('mygita-invitation');
    window.lookups = [];
    const invitation = {
      code: 'sample', experience: { name: 'Gita for Children' },
      offering: { name: 'Joint offering', acharyas: Array.from({ length: 8 }, (_, i) => ({ name: 'Teacher ' + i })) },
    };
    element.api = { async getInvitation(code) {
      window.lookups.push(code);
      return { ok: true, invitation };
    } };
    await import(url);
  }, moduleUrl);
  await component.getByText('Teacher 7', { exact: true }).waitFor();
  for (const [width, columns] of [[1280, 3], [820, 2], [412, 1]]) {
    await rendererPage.setViewportSize({ width, height: 924 });
    const layout = await component.evaluate(element => {
      const root = element.shadowRoot;
      const label = root.querySelector('.mygita-acharya-label').getBoundingClientRect();
      const entries = [...root.querySelectorAll('.mygita-acharya')].map(el => el.getBoundingClientRect());
      return { above: label.bottom <= entries[0].top, columns: new Set(entries.map(rect => rect.left)).size };
    });
    assert.deepEqual(layout, { above: true, columns });
  }
  await component.evaluate(el => {
    el.invitation = { ...el.invitation, onSuccess: [
      { link: 'javascript:alert(1)', label: 'unsafe' },
      { link: 'https://example.com/safe', label: '<b>safe</b>', prompt: '<b>prompt</b>' },
    ] };
  });
  for (const mode of ['default', 'host']) {
    await component.evaluate((el, value) => el.setAttribute('styling', value), mode);
    assert.equal(await component.locator('a').count(), 1);
    assert.equal(await component.locator('a').textContent(), '<b>safe</b>');
    assert.equal(await component.locator('.mygita-action-prompt').textContent(), '<b>prompt</b>');
    assert.equal(await component.locator('b').count(), 0);
    assert.equal(await component.locator('.mygita-acharya-initials').count(), 8);
    const hostStylesApply = await component.evaluate(el => {
      const name = el.querySelector('.mygita-acharya-name');
      return !!name && getComputedStyle(name).color === 'rgb(255, 0, 0)';
    });
    assert.equal(hostStylesApply, mode === 'host');
  }
  assert.deepEqual(await rendererPage.evaluate(() => window.lookups), ['sample']);
  await rendererPage.close();

  const filePage = await browser.newPage();
  await configurePage(filePage);
  await filePage.goto(pathToFileURL(join(siteRoot, 'register.html')).href);
  assert.equal(await filePage.locator('#continue-to-mygita').getAttribute('href'), 'https://mygita.gitajyoti.org/');
  await fillValidProfile(filePage, 'file@example.org');
  await filePage.getByRole('button', { name: 'Review my Profile' }).click();
  await filePage.getByRole('heading', { name: 'Review your Profile.' }).waitFor();
  await filePage.close();

  const livePage = await browser.newPage();
  const consoleErrors = [];
  livePage.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await configurePage(livePage);
  await livePage.goto(`http://127.0.0.1:${port}/register.html`);
  await fillValidProfile(livePage, 'live@example.org');
  await livePage.getByRole('button', { name: 'Review my Profile' }).click();
  await livePage.getByRole('button', { name: 'Confirm and create Profile' }).click();
  await livePage.getByText('Profile registration is not available yet.').waitFor();
  assert.deepEqual(consoleErrors, []);
  await livePage.close();
  console.log('Verified Profile registration over localhost and file://: Profile validation, duplicate handling, invitation links/manual codes, Acharya fallback, safe ordered success actions, contract fields, success ID, MyGita handoff, and live-mode API failure handling.');
} finally {
  await browser?.close();
  server.kill();
  await stopped;
  await new Promise(resolveClose => consumerServer.close(resolveClose));
}
