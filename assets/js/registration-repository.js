const genderCodes = {
  Female: 'female',
  Male: 'male',
  'Another identity': 'other',
  'Prefer not to say': 'prefer_not_to_say',
};

const mapProfileFields = profile => ({
  name: profile.name,
  mobile: profile.mobile,
  email: profile.email,
  gender: genderCodes[profile.gender] || profile.gender,
  date_of_birth: profile.dateOfBirth,
  preferred_language: profile.preferredLanguage === 'Other'
    ? profile.preferredLanguageOther
    : profile.preferredLanguage,
});

const registrationError = result => {
  const error = new Error(result.message || 'Your Profile could not be created. Please try again.');
  error.code = result.code;
  error.field = result.field;
  error.retryAfter = result.retryAfter;
  return error;
};

const createGitajyotiApiRepository = ({ clientUrl, apiBaseUrl, mode = 'mock' }) => {
  if (!clientUrl) throw new Error('The registration client URL is not configured.');
  const clientPromise = import(clientUrl);
  const apiPromise = clientPromise.then(client => mode === 'live'
    ? client.connect({ baseUrl: apiBaseUrl })
    : client.createMockApi());

  return {
    mode,
    async validateProfile(profile) {
      const client = await clientPromise;
      const fields = client.normalizeProfileFields(mapProfileFields(profile));
      return client.checkProfileFields(fields);
    },
    async renderTurnstile(container) {
      const client = await clientPromise;
      return client.renderTurnstile(container);
    },
    async getInvitation(code) {
      const api = await apiPromise;
      const result = await api.getInvitation(code);
      if (!result.ok) throw registrationError(result);
      return result.invitation;
    },
    async createProfile(profile, { turnstileToken = 'mock-token', honeypot = '', invitationCode } = {}) {
      const api = await apiPromise;
      const result = await api.createProfile(mapProfileFields(profile), { turnstileToken, honeypot, invitationCode });
      if (!result.ok) throw registrationError(result);
      return { profileId: result.profileId, created: result.created !== false };
    },
  };
};

const createRegistrationRepository = config => {
  if (config.provider !== 'gitajyoti-api') throw new Error(`Unknown registration provider: ${config.provider}`);
  return createGitajyotiApiRepository(config);
};

window.createRegistrationRepository = createRegistrationRepository;
