const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const form = fs.readFileSync(path.join(__dirname, '..', 'Form.html'), 'utf8');
const input = () => ({
  name: 'Asha', mobile: '+919876543210', email: '', dateOfBirth: '1990-01-02',
  offeringIds: ['GJ-O-1', 'GJ-O-3'], comment: 'Please contact me.',
  guardianConfirmation: false, consent: true, website: '', recaptchaToken: 'valid-token',
});

function harness({ verification = { success: true, hostname: 'script.googleusercontent.com' }, properties = {} } = {}) {
  const data = {
    Experiences: [
      ['ID', 'Name', 'Description', 'Outcome', 'Status'],
      ['GJ-E-001', 'Gita for Children', 'Purposeful life', 'Chanting', 'Active'],
      ['GJ-E-002', 'Gita Sāra', 'Study of shlokas', 'Contemplation', 'Active'],
      ['GJ-E-003', 'Gita Yoga', 'Chanting', 'Practice', 'Active'],
      ['GJ-E-004', 'Purna Yoga Darshana', 'Deep dive', 'Reflection', 'Active'],
    ],
    Acharyas: [
      ['ID', 'Name', 'Email', 'Description'],
      ['GJ-A-004', 'AJ Padma Karthik', '', 'Teacher of Vedanta'],
      ['GJ-A-005', 'AJ Vijay', '', 'Gita teacher'],
      ['GJ-A-006', 'AJ Padma Bhyrappa', '', ''],
    ],
    Offerings: [
      ['Offering Id', 'Experience Id', 'Experience Name', 'Acharya Id', 'Acharya Name', 'Language', 'Status', 'Start Date'],
      ['GJ-O-1', 'GJ-E-001', 'Gita for Children', 'GJ-A-004', 'AJ Padma', 'English', 'Active', '1-Jan-2025'],
      ['GJ-O-2', 'GJ-E-001', 'Gita for Children', 'GJ-A-005', 'AJ Vijay', 'English', 'Active', '1-Oct-2026'],
      ['GJ-O-3', 'GJ-E-002', 'Gita Sāra', 'GJ-A-006', 'AJ Padma Bhyrappa', 'Kannada', 'Active', '1-Dec-2025'],
      ['GJ-O-4', 'GJ-E-003', 'Gita Yoga', 'GJ-A-004, GJ-A-005', 'AJ Padma, AJ Vijay', 'English, Kannada', 'Active', '1-Sep-2024'],
    ],
    Registrations: [['Date', 'Name', 'DOB', 'Email', 'Mobile', 'Offering Id', 'Comment']],
  };
  const sheet = name => ({
    getLastRow: () => data[name].length,
    getLastColumn: () => data[name][0].length,
    getRange: (row, column, height, width) => ({
      getDisplayValues: () => data[name].slice(row - 1, row - 1 + height)
        .map(cells => Array.from({ length: width }, (_, i) => String(cells[column - 1 + i] ?? ''))),
    }),
    appendRow: row => data[name].push(row),
  });
  let verificationCalls = 0;
  const values = {
    RECAPTCHA_SITE_KEY: 'public-key',
    RECAPTCHA_SECRET_KEY: 'server-only-secret',
    RECAPTCHA_ALLOWED_HOST_SUFFIX: 'script.googleusercontent.com',
    ...properties,
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => data[name] ? sheet(name) : null }), flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => values[key] || '' }) },
    UrlFetchApp: { fetch: (url, options) => {
      verificationCalls++;
      assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify');
      assert.equal(options.payload.secret, 'server-only-secret');
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(verification) };
    } },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    HtmlService: {
      createTemplateFromFile: () => ({ evaluate() { return {
        setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; },
      }; } }),
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    },
  };
  const api = vm.runInNewContext(source + '\n({ activeCatalogue_, submitRegistration, normalizeRegistration_, doGet })', context);
  return { ...api, data, getVerificationCalls: () => verificationCalls };
}

test('loads active Experiences and joint Offerings from the three master tabs', () => {
  const app = harness();
  const catalogue = app.activeCatalogue_();
  assert.equal(catalogue.experiences.length, 3);
  assert.equal(catalogue.offeringById.size, 4);
  const joint = catalogue.offeringById.get('GJ-O-4');
  assert.equal(joint.acharyas.length, 2);
  assert.deepEqual(Array.from(joint.acharyas, acharya => acharya.name), ['AJ Padma Karthik', 'AJ Vijay']);
  assert.equal(joint.language, 'English, Kannada');
  assert.equal(joint.startDate, '1-Sep-2024');
  assert.equal(catalogue.experiences.some(item => item.id === 'GJ-E-004'), false);
});

test('only active parent Experiences and active Offerings are selectable', () => {
  const app = harness();
  app.data.Experiences[2][4] = 'Inactive';
  app.data.Offerings[2][6] = 'Inactive';
  const catalogue = app.activeCatalogue_();
  assert.equal(catalogue.offeringById.has('GJ-O-2'), false);
  assert.equal(catalogue.offeringById.has('GJ-O-3'), false);
  assert.equal(catalogue.experiences.length, 2);
});

test('one submission writes exactly seven existing Registration columns with all selected Offering IDs', () => {
  const app = harness();
  const result = app.submitRegistration(input());
  assert.equal(result.saved, true);
  assert.equal(app.data.Registrations.length, 2);
  const row = app.data.Registrations[1];
  assert.equal(row.length, 7);
  assert.equal(Object.prototype.toString.call(row[0]), '[object Date]');
  assert.deepEqual(Array.from(row.slice(1)), ['Asha', '1990-01-02', '', "'+919876543210", 'GJ-O-1, GJ-O-3', 'Please contact me.']);
  assert.equal(app.getVerificationCalls(), 1);
});

test('rejects two Offerings of the same Experience and stale or inactive IDs', () => {
  const app = harness();
  assert.throws(() => app.submitRegistration({ ...input(), offeringIds: ['GJ-O-1', 'GJ-O-2'] }), /only one Offering/);
  assert.throws(() => app.submitRegistration({ ...input(), offeringIds: ['GJ-O-999'] }), /no longer available/);
  app.data.Offerings[1][6] = 'Inactive';
  assert.throws(() => app.submitRegistration({ ...input(), offeringIds: ['GJ-O-1'] }), /no longer available/);
  assert.equal(app.data.Registrations.length, 1);
});

test('rejects broken master data and mismatched Registration headers', () => {
  const app = harness();
  app.data.Offerings[4][3] = 'GJ-A-999';
  assert.throws(() => app.activeCatalogue_(), /temporarily unavailable/);
  app.data.Offerings[4][3] = 'GJ-A-004, GJ-A-005';
  app.data.Registrations[0][5] = 'Experience';
  assert.throws(() => app.submitRegistration(input()), /Registration is not available/);
});

test('honeypot, consent, age, date, and required selection reject before write', () => {
  const app = harness();
  for (const change of [
    { website: 'spam' }, { consent: false }, { dateOfBirth: '2015-01-01' },
    { dateOfBirth: '2999-01-01' }, { offeringIds: [] },
  ]) assert.throws(() => app.submitRegistration({ ...input(), ...change }));
  assert.equal(app.data.Registrations.length, 1);
  assert.equal(app.getVerificationCalls(), 0);
});

test('rejects failed, wrong-host, or unconfigured reCAPTCHA', () => {
  for (const verification of [
    { success: false, hostname: 'script.googleusercontent.com' },
    { success: true, hostname: 'attacker.example' },
  ]) {
    const app = harness({ verification });
    assert.throws(() => app.submitRegistration(input()), /Robot verification failed/);
    assert.equal(app.data.Registrations.length, 1);
  }
  const missing = harness({ properties: { RECAPTCHA_SECRET_KEY: '' } });
  assert.throws(() => missing.submitRegistration(input()), /not available/);
});

test('escapes spreadsheet formulas and uses escaped template insertions', () => {
  const app = harness();
  app.submitRegistration({ ...input(), name: '=HYPERLINK("https://example.com")', comment: '+SUM(1,1)' });
  assert.equal(app.data.Registrations[1][1].startsWith("'="), true);
  assert.equal(app.data.Registrations[1][6].startsWith("'+"), true);
  assert.equal(form.includes('<?!='), false);
});
