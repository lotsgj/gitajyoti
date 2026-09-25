/**
 * Gita Jyoti V1 interest registration. Deploy as a Google Apps Script web app
 * bound to the private registration spreadsheet. Do not expose Sheet access.
 */
const REGISTRATION_SHEET_NAME = 'Registrations';
const REGISTRATION_HEADERS = ['Date', 'Name', 'DOB', 'Email', 'Mobile', 'Offering Id', 'Comment'];
const EXPERIENCE_HEADERS = ['ID', 'Name', 'Description', 'Outcome', 'Status'];
const ACHARYA_HEADERS = ['ID', 'Name', 'Email', 'Description'];
const OFFERING_HEADERS = [
  'Offering Id', 'Experience Id', 'Experience Name', 'Acharya Id',
  'Acharya Name', 'Language', 'Status', 'Start Date',
];

/** Serves only the Google-hosted form; the Sheet remains private. */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Form');
  const catalogue = activeCatalogue_();
  const preferred = String((e && e.parameter && e.parameter.experience) || '').trim();
  template.experiences = catalogue.experiences;
  template.preferredExperience = catalogue.experiences.some(item => item.id === preferred) ? preferred : '';
  template.recaptchaSiteKey = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SITE_KEY') || '';
  return template.evaluate()
    .setTitle('Gita Jyoti — Register interest')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called only from the Apps Script-hosted HTML via google.script.run.
 * All browser input remains untrusted, including Offering IDs and bot tokens.
 */
function submitRegistration(input) {
  const registration = normalizeRegistration_(input);
  if (registration.website) throw new Error('Registration could not be accepted.');
  verifyRecaptcha_(registration.recaptchaToken);
  const catalogue = activeCatalogue_();
  validateSelectedOfferings_(registration.offeringIds, catalogue);
  const sheet = registrationSheet_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.appendRow([
      new Date(), safeCell_(registration.name), safeCell_(registration.dateOfBirth),
      safeCell_(registration.email), safeCell_(registration.mobile),
      safeCell_(registration.offeringIds.join(', ')), safeCell_(registration.comment),
    ]);
    SpreadsheetApp.flush();
    return { saved: true, whatsappInviteUrl: whatsappInviteUrl_() };
  } finally {
    lock.releaseLock();
  }
}

function normalizeRegistration_(input) {
  if (!input || typeof input !== 'object') throw new Error('Please complete the form.');
  const name = boundedText_(input.name, 2, 120, 'Name');
  const mobile = boundedText_(input.mobile, 8, 20, 'Mobile');
  if (!/^\+?[0-9][0-9 -]{6,18}[0-9]$/.test(mobile)) throw new Error('Enter a valid mobile number.');
  const email = String(input.email || '').trim();
  if (email.length > 200 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email address or leave it blank.');
  const dateOfBirth = boundedText_(input.dateOfBirth, 10, 10, 'Date of birth');
  const birthday = new Date(dateOfBirth + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(birthday.valueOf()) || birthday.toISOString().slice(0, 10) !== dateOfBirth) throw new Error('Enter a valid date of birth.');
  const today = new Date();
  if (birthday > today || birthday.getUTCFullYear() < today.getUTCFullYear() - 120) throw new Error('Enter a valid date of birth.');

  const offeringIds = Array.isArray(input.offeringIds) ? input.offeringIds : [];
  if (!offeringIds.length || offeringIds.length > 20 ||
      offeringIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9-]{3,80}$/.test(id)) ||
      new Set(offeringIds).size !== offeringIds.length) {
    throw new Error('Choose at least one valid Offering.');
  }
  const comment = String(input.comment || '').trim();
  if (comment.length > 1000) throw new Error('Comment is too long.');
  const consent = input.consent === true;
  if (!consent) throw new Error('Please confirm permission to contact you about these Experiences.');
  const guardianConfirmation = input.guardianConfirmation === true;
  if (isUnder18_(birthday, today) && !guardianConfirmation) throw new Error('A parent or guardian must submit this registration for a person under 18.');

  return {
    name, mobile, email, dateOfBirth, offeringIds, comment, consent, guardianConfirmation,
    website: String(input.website || '').trim(),
    recaptchaToken: String(input.recaptchaToken || ''),
  };
}

function activeCatalogue_() {
  const experienceRows = masterRows_('Experiences', EXPERIENCE_HEADERS);
  const acharyaRows = masterRows_('Acharyas', ACHARYA_HEADERS);
  const offeringRows = masterRows_('Offerings', OFFERING_HEADERS);
  const experiences = [];
  const experienceById = new Map();
  const experienceIds = new Set();
  const acharyaById = new Map();
  const offeringIds = new Set();

  experienceRows.forEach(row => {
    const id = row[0].trim();
    if (!id || experienceIds.has(id)) throw new Error('Experience choices are temporarily unavailable.');
    experienceIds.add(id);
    if (row[4].trim().toLowerCase() !== 'active') return;
    if (!row[1].trim()) throw new Error('Experience choices are temporarily unavailable.');
    const experience = {
      id, name: row[1].trim(), description: row[2].trim(),
      outcome: row[3].trim(), offerings: [],
    };
    experiences.push(experience);
    experienceById.set(id, experience);
  });

  acharyaRows.forEach(row => {
    const id = row[0].trim();
    if (!id || acharyaById.has(id) || !row[1].trim()) throw new Error('Experience choices are temporarily unavailable.');
    acharyaById.set(id, { id, name: row[1].trim(), description: row[3].trim() });
  });

  offeringRows.forEach(row => {
    const id = row[0].trim();
    if (!id || offeringIds.has(id)) throw new Error('Experience choices are temporarily unavailable.');
    offeringIds.add(id);
    if (row[6].trim().toLowerCase() !== 'active') return;
    const experience = experienceById.get(row[1].trim());
    if (!experience) return; // Inactive parent Experiences are never offered.
    const acharyaIds = row[3].split(',').map(value => value.trim());
    if (!acharyaIds.length || acharyaIds.some(value => !value) || new Set(acharyaIds).size !== acharyaIds.length) {
      throw new Error('Experience choices are temporarily unavailable.');
    }
    const acharyas = acharyaIds.map(acharyaId => acharyaById.get(acharyaId));
    if (acharyas.some(acharya => !acharya)) throw new Error('Experience choices are temporarily unavailable.');
    experience.offerings.push({
      id, experienceId: experience.id, acharyas,
      language: row[5].trim(), startDate: row[7].trim(),
    });
  });

  const available = experiences.filter(experience => experience.offerings.length > 0);
  return {
    experiences: available,
    offeringById: new Map(available.flatMap(experience => experience.offerings.map(offering => [offering.id, offering]))),
  };
}

function masterRows_(name, expectedHeaders) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet && spreadsheet.getSheetByName(name);
  if (!sheet || sheet.getLastColumn() < expectedHeaders.length) throw new Error('Experience choices are temporarily unavailable.');
  const headers = sheet.getRange(1, 1, 1, expectedHeaders.length).getDisplayValues()[0];
  if (headers.some((header, index) => header.trim() !== expectedHeaders[index])) throw new Error('Experience choices are temporarily unavailable.');
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, expectedHeaders.length)
    .getDisplayValues().filter(row => row.some(cell => cell.trim()));
}

function validateSelectedOfferings_(ids, catalogue) {
  const experienceIds = new Set();
  ids.forEach(id => {
    const offering = catalogue.offeringById.get(id);
    if (!offering) throw new Error('An Offering is no longer available. Refresh and choose again.');
    if (experienceIds.has(offering.experienceId)) throw new Error('Choose only one Offering per Experience.');
    experienceIds.add(offering.experienceId);
  });
}

function boundedText_(value, minimum, maximum, label) {
  const text = String(value || '').trim();
  if (text.length < minimum || text.length > maximum) throw new Error(label + ' has an invalid length.');
  return text;
}

function isUnder18_(birthday, today) {
  const adultDate = new Date(birthday.valueOf());
  adultDate.setUTCFullYear(adultDate.getUTCFullYear() + 18);
  return adultDate > today;
}

function verifyRecaptcha_(token) {
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty('RECAPTCHA_SECRET_KEY');
  const allowedHostSuffix = properties.getProperty('RECAPTCHA_ALLOWED_HOST_SUFFIX');
  if (!secret || !allowedHostSuffix) throw new Error('Registration is not available yet.');
  if (!token || token.length > 2048) throw new Error('Please complete the robot check.');
  const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('Robot verification is temporarily unavailable. Please try again.');
  let result;
  try { result = JSON.parse(response.getContentText()); } catch (_) { throw new Error('Robot verification is temporarily unavailable. Please try again.'); }
  const host = String(result.hostname || '').toLowerCase();
  const suffix = allowedHostSuffix.toLowerCase();
  if (result.success !== true || (host !== suffix && !host.endsWith('.' + suffix))) throw new Error('Robot verification failed. Please try again.');
}

function registrationSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet && spreadsheet.getSheetByName(REGISTRATION_SHEET_NAME);
  if (!sheet) throw new Error('Registration is not available yet.');
  const headers = sheet.getRange(1, 1, 1, REGISTRATION_HEADERS.length).getDisplayValues()[0];
  if (headers.some((header, index) => header !== REGISTRATION_HEADERS[index])) throw new Error('Registration is not available yet.');
  return sheet;
}

function safeCell_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function whatsappInviteUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('WHATSAPP_INVITE_URL') || '';
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(url) ? url : '';
}
