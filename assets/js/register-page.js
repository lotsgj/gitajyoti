const isLocalRegistrationHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  || window.location.protocol === 'file:';
const config = {
  provider: document.body.dataset.registrationProvider || 'gitajyoti-api',
  mode: document.body.dataset.registrationMode || 'mock',
  clientUrl: isLocalRegistrationHost
    ? document.body.dataset.registrationDevClientUrl || document.body.dataset.registrationClientUrl || ''
    : document.body.dataset.registrationClientUrl || '',
  apiBaseUrl: isLocalRegistrationHost
    ? document.body.dataset.registrationDevApiBaseUrl || document.body.dataset.registrationApiBaseUrl || ''
    : document.body.dataset.registrationApiBaseUrl || '',
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
const continueToMyGita = document.querySelector('#continue-to-mygita');
const turnstileContainer = document.querySelector('#registration-turnstile');
const invitationCode = document.querySelector('#invitation-code');
const invitationEntry = document.querySelector('#invitation-entry');
const invitationSummary = document.querySelector('#invitation-summary');
const invitationError = document.querySelector('#invitation-error');
let pendingProfile = null;
const invitationView = document.querySelector('#applied-invitation');
const applyButton = document.querySelector('#apply-invitation');
invitationView.api = repository;
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
function setInvitationUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('i', code);
  else url.searchParams.delete('i');
  history.replaceState(history.state, '', url);
}
async function applyInvitation() {
  const code = invitationCode.value.trim();
  invitationError.hidden = true;
  if (applyButton.disabled) return;
  applyButton.disabled = true;
  applyButton.textContent = 'Checking…';
  invitationCode.readOnly = true;
  try {
    if (!code) throw new Error('Enter an invitation code, or continue without one.');
    const invitation = await invitationView.load(code);
    invitationCode.value = invitation.code;
    invitationEntry.hidden = true;
    invitationSummary.hidden = false;
    setInvitationUrl(invitation.code);
  } catch (error) {
    invitationError.textContent = error.message;
    invitationError.hidden = false;
    invitationCode.setAttribute('aria-invalid', 'true');
    invitationCode.focus();
  } finally {
    invitationCode.readOnly = false;
    applyButton.disabled = false;
    applyButton.textContent = 'Apply';
  }
}
applyButton.addEventListener('click', applyInvitation);
invitationCode.addEventListener('input', () => { invitationError.hidden = true; });
document.querySelector('#change-invitation').addEventListener('click', () => {
  invitationView.invitation = null;
  invitationCode.value = '';
  invitationEntry.hidden = false;
  invitationSummary.hidden = true;
  setInvitationUrl(null);
  invitationCode.focus();
});
function renderReviewInvitation() {
  document.querySelector('#review-invitation').hidden = !invitationView.invitation;
  document.querySelector('#review-invitation-details').invitation = invitationView.invitation;
}
const openReview = async event => {
  event.preventDefault();
  clearFieldErrors();
  formError.hidden = true;
  if (invitationCode.value.trim() && !invitationView.invitation) {
    await applyInvitation();
    if (!invitationView.invitation) return;
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
      turnstileToken: captcha ? await captcha.token() : 'mock-token', honeypot: value('website'), invitationCode: invitationView.invitation?.code,
    });
    document.querySelector('#profile-id').textContent = result.profileId;
    const destination = new URL(continueToMyGita.href);
    destination.searchParams.set('pid', result.profileId);
    continueToMyGita.href = destination.href;
    document.querySelector('#success-eyebrow').textContent = result.created ? 'Profile created' : 'Invitation added';
    document.querySelector('#success-actions').actions = result.onSuccess;
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
const initialCode = new URL(location.href).searchParams.get('i');
if (initialCode) {
  invitationCode.value = initialCode;
  applyInvitation();
}
updateOtherLanguage();

const flute = document.querySelector('.mygita-header-mark');
flute.addEventListener('click', () => {
  flute.classList.remove('is-playing');
  void flute.offsetWidth;
  flute.classList.add('is-playing');
  window.setTimeout(() => flute.classList.remove('is-playing'), 850);
});
