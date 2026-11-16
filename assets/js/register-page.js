const config = {
  provider: document.body.dataset.registrationProvider || 'gitajyoti-api',
  mode: document.body.dataset.registrationMode || 'mock',
  clientUrl: document.body.dataset.registrationClientUrl || '',
  apiBaseUrl: document.body.dataset.registrationApiBaseUrl || '',
};
const repository = window.createRegistrationRepository(config);
const form = document.querySelector('#registration-form');
const language = form.elements.preferredLanguage;
const otherLanguageField = document.querySelector('#other-language-field');
const otherLanguage = form.elements.preferredLanguageOther;
const formError = document.querySelector('#form-error');
const dialog = document.querySelector('#profile-dialog');
const review = document.querySelector('#profile-review');
const success = document.querySelector('#profile-success');
const confirmButton = document.querySelector('#confirm-profile');
const turnstileContainer = document.querySelector('#registration-turnstile');
const invitationCode = document.querySelector('#invitation-code');
const invitationEntry = document.querySelector('#invitation-entry');
const invitationSummary = document.querySelector('#invitation-summary');
const invitationError = document.querySelector('#invitation-error');
let pendingProfile = null;
let appliedInvitation = null;
let captchaPromise = null;

const fieldNames = { date_of_birth: 'dateOfBirth', preferred_language: 'preferredLanguage' };
const value = name => form.elements[name].value.trim();
const languageValue = () => language.value === 'Other' ? value('preferredLanguageOther') : language.value;
const fieldFor = apiField => {
  if (apiField === 'preferred_language' && language.value === 'Other') return form.elements.preferredLanguageOther;
  return form.elements[fieldNames[apiField] || apiField];
};
const clearFieldErrors = () => form.querySelectorAll('[aria-invalid="true"]').forEach(input => input.removeAttribute('aria-invalid'));
const showFieldError = problem => {
  clearFieldErrors();
  formError.textContent = problem.message;
  formError.hidden = false;
  const input = fieldFor(problem.field);
  input?.setAttribute('aria-invalid', 'true');
  input?.focus();
};
const updateOtherLanguage = () => {
  const visible = language.value === 'Other';
  otherLanguageField.hidden = !visible;
  otherLanguage.required = visible;
  if (!visible) otherLanguage.value = '';
};
const addSummaryRow = (term, description) => {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = term;
  dd.textContent = description;
  row.append(dt, dd);
  document.querySelector('#profile-summary').append(row);
};
const buildProfile = () => ({
  name: value('name'), mobile: value('mobile'), email: value('email'), gender: form.elements.gender.value,
  dateOfBirth: form.elements.dateOfBirth.value, preferredLanguage: language.value,
  preferredLanguageOther: language.value === 'Other' ? value('preferredLanguageOther') : null,
});
const ensureTurnstile = () => {
  if (repository.mode !== 'live') return null;
  turnstileContainer.hidden = false;
  captchaPromise ||= repository.renderTurnstile(turnstileContainer);
  return captchaPromise;
};
const setInvitationUrl = code => {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('i', code); else url.searchParams.delete('i');
  history.replaceState({ ...history.state, invitationCode: code || null }, '', url);
};
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
const formatLanguages = languages => languages?.length
  ? languages.map(code => {
    try { return languageNames.of(code) || code; } catch { return code; }
  }).join(' · ')
  : 'Language to be announced';
const formatStartDate = value => {
  if (!value) return 'Start date to be announced';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Start date to be announced' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
};
const invitationAcharyas = invitation => invitation.offering.acharyas.map(acharya => acharya.name).join(' and ');
const invitationMeta = invitation => `${formatLanguages(invitation.offering.languages)} · Begins ${formatStartDate(invitation.offering.startDate)}`;
const displayInvitation = invitation => {
  appliedInvitation = invitation;
  invitationCode.value = invitation.code;
  document.querySelector('#invitation-experience').textContent = invitation.experience.name;
  document.querySelector('#invitation-offering').textContent = invitation.offering.name;
  document.querySelector('#invitation-acharyas').textContent = `Guided by ${invitationAcharyas(invitation)}`;
  document.querySelector('#invitation-meta').textContent = invitationMeta(invitation);
  invitationEntry.hidden = true;
  invitationSummary.hidden = false;
  invitationError.hidden = true;
  setInvitationUrl(invitation.code);
};
const clearInvitation = ({ focus = false } = {}) => {
  appliedInvitation = null;
  invitationCode.value = '';
  invitationEntry.hidden = false;
  invitationSummary.hidden = true;
  invitationError.hidden = true;
  setInvitationUrl();
  if (focus) invitationCode.focus();
};
const applyInvitation = async () => {
  const code = invitationCode.value.trim();
  invitationError.hidden = true;
  if (!code) {
    invitationError.textContent = 'Enter an invitation code, or continue without one.';
    invitationError.hidden = false;
    invitationCode.focus();
    return false;
  }
  const applyButton = document.querySelector('#apply-invitation');
  applyButton.disabled = true;
  applyButton.textContent = 'Checking…';
  try {
    displayInvitation(await repository.getInvitation(code));
    return true;
  } catch (error) {
    appliedInvitation = null;
    invitationError.textContent = error.message || 'We couldn’t find an active invitation with that code.';
    invitationError.hidden = false;
    invitationCode.setAttribute('aria-invalid', 'true');
    invitationCode.focus();
    return false;
  } finally {
    applyButton.disabled = false;
    applyButton.textContent = 'Apply';
  }
};
const renderReviewInvitation = () => {
  const element = document.querySelector('#review-invitation');
  if (!appliedInvitation) { element.hidden = true; return; }
  element.hidden = false;
  document.querySelector('#review-invitation-experience').textContent = appliedInvitation.experience.name;
  document.querySelector('#review-invitation-offering').textContent = appliedInvitation.offering.name;
  document.querySelector('#review-invitation-acharyas').textContent = `Guided by ${invitationAcharyas(appliedInvitation)}`;
  document.querySelector('#review-invitation-meta').textContent = invitationMeta(appliedInvitation);
};
const openReview = async event => {
  event.preventDefault();
  clearFieldErrors();
  formError.hidden = true;
  if (invitationCode.value.trim() && !appliedInvitation) {
    await applyInvitation();
    if (!appliedInvitation) return;
  }
  if (!form.checkValidity()) {
    formError.textContent = 'Please complete all required fields before reviewing your Profile.';
    formError.hidden = false;
    const invalidField = form.querySelector(':invalid');
    invalidField?.setAttribute('aria-invalid', 'true');
    invalidField?.focus();
    form.reportValidity();
    return;
  }
  if (value('website')) return;
  pendingProfile = buildProfile();
  try {
    const problem = await repository.validateProfile(pendingProfile);
    if (problem) return showFieldError(problem);
  } catch {
    formError.textContent = 'Registration could not start. Check your connection and try again.';
    formError.hidden = false;
    return;
  }
  document.querySelector('#profile-summary').replaceChildren();
  addSummaryRow('Name', pendingProfile.name);
  addSummaryRow('Mobile', pendingProfile.mobile);
  addSummaryRow('Email', pendingProfile.email);
  addSummaryRow('Gender', pendingProfile.gender);
  addSummaryRow('Date of birth', pendingProfile.dateOfBirth);
  addSummaryRow('Preferred language', languageValue());
  renderReviewInvitation();
  review.hidden = false;
  success.hidden = true;
  dialog.showModal();
  ensureTurnstile()?.catch(() => {});
};
const createProfile = async () => {
  const dialogError = document.querySelector('#dialog-error');
  dialogError.hidden = true;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Creating your Profile…';
  let captcha;
  try {
    captcha = await ensureTurnstile();
    const result = await repository.createProfile(pendingProfile, {
      turnstileToken: captcha ? await captcha.token() : 'mock-token', honeypot: value('website'), invitationCode: appliedInvitation?.code,
    });
    document.querySelector('#profile-id').textContent = result.profileId;
    const destination = new URL('https://mygita.gitajyoti.org/');
    destination.searchParams.set('pid', result.profileId);
    document.querySelector('#continue-to-mygita').href = destination;
    const successInvitation = document.querySelector('#success-invitation');
    document.querySelector('#success-eyebrow').textContent = result.created ? 'Profile created' : 'Invitation added';
    document.querySelector('#success-title').textContent = result.created
      ? 'Your doorway to MyGita is ready.'
      : 'Your invitation is connected.';
    document.querySelector('#success-copy').textContent = result.created
      ? 'Keep this Profile ID. It connects your learning journeys without asking you to register again.'
      : 'Your existing Profile is ready to continue on its learning journeys.';
    successInvitation.hidden = !appliedInvitation;
    successInvitation.textContent = appliedInvitation
      ? result.created
        ? `Your invitation to ${appliedInvitation.experience.name} has been linked to this Profile.`
        : `Your Profile already exists. This invitation to ${appliedInvitation.experience.name} has been added to it.`
      : '';
    review.hidden = true;
    success.hidden = false;
  } catch (error) {
    if (error.field) { dialog.close(); showFieldError(error); }
    else {
      dialogError.textContent = error.code === 'rate_limited' && error.retryAfter
        ? `${error.message} Try again in ${error.retryAfter} seconds.`
        : error.message || 'Your Profile could not be created. Please try again.';
      dialogError.hidden = false;
    }
  } finally {
    captcha?.reset();
    confirmButton.disabled = false;
    confirmButton.textContent = 'Confirm and create Profile';
  }
};

const today = new Date();
form.elements.dateOfBirth.max = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
language.addEventListener('change', updateOtherLanguage);
form.addEventListener('input', event => event.target.removeAttribute?.('aria-invalid'));
invitationCode.addEventListener('input', () => { invitationCode.removeAttribute('aria-invalid'); invitationError.hidden = true; });
document.querySelector('#apply-invitation').addEventListener('click', applyInvitation);
document.querySelector('#change-invitation').addEventListener('click', () => clearInvitation({ focus: true }));
document.querySelector('#review-profile').addEventListener('click', openReview);
form.addEventListener('submit', openReview);
document.querySelector('#edit-profile').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
confirmButton.addEventListener('click', createProfile);
document.querySelector('#copy-profile-id').addEventListener('click', async event => {
  await navigator.clipboard.writeText(document.querySelector('#profile-id').textContent);
  event.currentTarget.textContent = 'Copied';
});
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const invitationFromUrl = new URLSearchParams(window.location.search).get('i');
if (invitationFromUrl) { invitationCode.value = invitationFromUrl; applyInvitation(); }
updateOtherLanguage();

const flute = document.querySelector('.mygita-header-mark');
flute.addEventListener('click', () => {
  flute.classList.remove('is-playing');
  void flute.offsetWidth;
  flute.classList.add('is-playing');
  window.setTimeout(() => flute.classList.remove('is-playing'), 850);
});
