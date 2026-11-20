/*
 * MyGita invitation handler v1
 *
 * A host supplies its Profile API repository and DOM targets. This library owns
 * invitation-code lookup and safe, reusable invitation/success rendering; it
 * deliberately does not own authentication or profile creation.
 */
(() => {
  const text = value => typeof value === 'string' ? value : '';
  const safeUrl = (value, protocols = ['http:', 'https:']) => {
    try {
      const url = new URL(value);
      return protocols.includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const initials = name => text(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'A';
  const languages = new Intl.DisplayNames(['en'], { type: 'language' });
  const formatLanguages = values => Array.isArray(values) && values.length
    ? values.map(code => { try { return languages.of(code) || code; } catch { return code; } }).join(' · ')
    : 'Language to be announced';
  const formatStartDate = value => {
    const date = new Date(`${text(value)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? 'Start date to be announced' : new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  };
  const offeringMeta = invitation => `${formatLanguages(invitation?.offering?.languages)} · Begins ${formatStartDate(invitation?.offering?.startDate)}`;

  const avatar = acharya => {
    const fallback = document.createElement('span');
    fallback.className = 'mygita-acharya-avatar mygita-acharya-initials';
    fallback.setAttribute('aria-label', text(acharya?.name) || 'Acharya');
    fallback.textContent = initials(acharya?.name);
    const source = safeUrl(acharya?.profilePic, ['https:']);
    if (!source) return fallback;
    const image = document.createElement('img');
    image.className = 'mygita-acharya-avatar';
    image.src = source;
    image.alt = text(acharya?.name) || 'Acharya';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
    return image;
  };

  const renderAcharyas = (container, acharyas) => {
    if (!container) return;
    container.replaceChildren();
    const people = Array.isArray(acharyas) ? acharyas.filter(person => text(person?.name)) : [];
    if (!people.length) return;
    const label = document.createElement('span');
    label.className = 'mygita-acharya-label';
    label.textContent = 'Guided by';
    const peopleList = document.createElement('span');
    peopleList.className = 'mygita-acharya-list';
    people.forEach(person => {
      const personElement = document.createElement('span');
      personElement.className = 'mygita-acharya';
      personElement.append(avatar(person));
      const name = document.createElement('span');
      name.textContent = person.name;
      personElement.append(name);
      peopleList.append(personElement);
    });
    container.classList.add('mygita-acharyas');
    container.append(label, peopleList);
  };

  const renderInvitation = (invitation, targets) => {
    if (!targets || !invitation) return;
    if (targets.experience) targets.experience.textContent = text(invitation.experience?.name);
    if (targets.offering) targets.offering.textContent = text(invitation.offering?.name);
    renderAcharyas(targets.acharyas, invitation.offering?.acharyas);
    if (targets.meta) targets.meta.textContent = offeringMeta(invitation);
  };

  const renderSuccessActions = (container, actions) => {
    if (!container) return;
    container.replaceChildren();
    const validActions = Array.isArray(actions) ? actions.filter(action => safeUrl(action?.link) && text(action?.label)) : [];
    validActions.forEach(action => {
      const step = document.createElement('div');
      step.className = 'mygita-success-action';
      if (text(action.prompt)) {
        const prompt = document.createElement('p');
        prompt.textContent = action.prompt;
        step.append(prompt);
      }
      const link = document.createElement('a');
      link.className = 'btn mygita-success-action-link';
      link.href = safeUrl(action.link);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = action.label;
      step.append(link);
      container.append(step);
    });
    container.hidden = !validActions.length;
  };

  const createMyGitaInviteHandler = ({ repository, input, entry, summary, error, applyButton, changeButton, targets, urlParameter = 'i', onApplied, onCleared } = {}) => {
    if (!repository?.getInvitation) throw new Error('A Profile API repository is required for invitations.');
    let invitation = null;
    const setUrl = code => {
      const url = new URL(window.location.href);
      if (code) url.searchParams.set(urlParameter, code); else url.searchParams.delete(urlParameter);
      history.replaceState({ ...history.state, invitationCode: code || null }, '', url);
    };
    const showError = message => {
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    };
    const apply = async code => {
      const candidate = text(code ?? input?.value).trim();
      if (error) error.hidden = true;
      if (!candidate) {
        showError('Enter an invitation code, or continue without one.');
        input?.focus();
        return null;
      }
      if (applyButton) { applyButton.disabled = true; applyButton.textContent = 'Checking…'; }
      try {
        invitation = await repository.getInvitation(candidate);
        if (input) input.value = invitation.code || candidate;
        renderInvitation(invitation, targets);
        if (entry) entry.hidden = true;
        if (summary) summary.hidden = false;
        setUrl(invitation.code || candidate);
        onApplied?.(invitation);
        return invitation;
      } catch (cause) {
        invitation = null;
        input?.setAttribute('aria-invalid', 'true');
        showError(cause?.message || 'We couldn’t find an active invitation with that code.');
        input?.focus();
        return null;
      } finally {
        if (applyButton) { applyButton.disabled = false; applyButton.textContent = 'Apply'; }
      }
    };
    const clear = ({ focus = false } = {}) => {
      invitation = null;
      if (input) input.value = '';
      if (entry) entry.hidden = false;
      if (summary) summary.hidden = true;
      if (error) error.hidden = true;
      setUrl();
      onCleared?.();
      if (focus) input?.focus();
    };
    input?.addEventListener('input', () => { input.removeAttribute('aria-invalid'); if (error) error.hidden = true; });
    applyButton?.addEventListener('click', () => apply());
    changeButton?.addEventListener('click', () => clear({ focus: true }));
    return {
      apply,
      clear,
      get invitation() { return invitation; },
      loadFromUrl() {
        const code = new URLSearchParams(window.location.search).get(urlParameter);
        if (code) { if (input) input.value = code; return apply(code); }
        return Promise.resolve(null);
      },
      renderInvitation: nextInvitation => renderInvitation(nextInvitation, targets),
    };
  };

  window.createMyGitaInviteHandler = createMyGitaInviteHandler;
  window.MyGitaInviteRenderer = { renderAcharyas, renderInvitation, renderSuccessActions };
})();
