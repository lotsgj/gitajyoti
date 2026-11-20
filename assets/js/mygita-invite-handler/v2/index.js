// Side-effect module. Also valid as a classic script for file:// registration.
(() => {
  const tag = 'mygita-invitation';
  if (customElements.get(tag)) return;

  const css = `
    :host { display:block; color:var(--ink,#163c54); font:inherit }
    :host([hidden]) { display:none }
    h3 { font:600 1.35rem/1.2 Georgia,serif; margin:12px 0 4px }
    p { margin:4px 0; color:var(--muted,#536969); font-size:.92rem }
    .mygita-acharyas { display:grid; gap:8px; margin:13px 0; font-size:.92rem }
    .mygita-acharya-label { color:var(--muted,#536969) }
    .mygita-acharya-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 18px; list-style:none; margin:0; padding:0 }
    .mygita-acharya { display:grid; grid-template-columns:34px minmax(0,1fr); gap:7px; align-items:center; overflow-wrap:anywhere; font-weight:700 }
    .mygita-acharya-avatar { box-sizing:border-box; width:34px; height:34px; border-radius:50%; border:1px solid #c2c9bd; object-fit:cover }
    .mygita-acharya-initials { display:grid; place-items:center; color:white; background:var(--teal,#36726d); font-size:.7rem }
    .mygita-success-action { display:grid; justify-items:center; gap:10px; margin:20px auto; text-align:center }
    .mygita-success-action p { white-space:pre-line }
    .mygita-success-action-link { padding:12px 24px; border-radius:2em; background:var(--gold,#e9aa3c); color:#163c54; font-weight:750; text-decoration:none }
    @media(max-width:900px) { .mygita-acharya-list { grid-template-columns:repeat(2,minmax(0,1fr)) } }
    @media(max-width:700px) { .mygita-acharya-list { grid-template-columns:minmax(0,1fr) } }
  `;

  function node(tagName, className, text) {
    const el = document.createElement(tagName);
    el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }
  function url(value, image = false) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'https:' || (!image && parsed.protocol === 'http:')) return parsed.href;
    } catch { /* Missing or invalid absolute URL. */ }
    return null;
  }
  function acharya({ name, profilePic }) {
    const item = node('li', 'mygita-acharya');
    const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    const fallback = node('span', 'mygita-acharya-avatar mygita-acharya-initials', initials);
    fallback.setAttribute('aria-hidden', 'true');
    const src = url(profilePic, true);
    if (src) {
      const img = node('img', 'mygita-acharya-avatar');
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => img.replaceWith(fallback);
      img.src = src;
      item.append(img);
    } else item.append(fallback);
    item.append(node('span', 'mygita-acharya-name', name));
    return item;
  }
  const languageNames = new Intl.DisplayNames(['en'], { type:'language' });
  const dates = new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
  function details(invitation) {
    const { experience, offering } = invitation;
    const block = node('section', 'mygita-invitation-details');
    block.append(node('h3', 'mygita-experience', experience.name), node('p', 'mygita-offering', offering.name));
    const people = (offering.acharyas || []).filter(person => person?.name);
    if (people.length) {
      const group = node('div', 'mygita-acharyas');
      const list = node('ul', 'mygita-acharya-list');
      list.append(...people.map(acharya));
      group.append(node('span', 'mygita-acharya-label', 'Guided by'), list);
      block.append(group);
    }
    const languages = (offering.languages || []).map(code => {
      try { return languageNames.of(code); } catch { return code; }
    });
    const date = new Date(offering.startDate + 'T00:00:00Z');
    block.append(node('p', 'mygita-invitation-meta', [
      languages.join(' · ') || 'Language to be announced',
      Number.isNaN(date.getTime()) ? 'Start date to be announced' : 'Begins ' + dates.format(date),
    ].join(' · ')));
    return block;
  }
  function appendActions(fragment, actions) {
    for (const action of Array.isArray(actions) ? actions : []) {
      const href = url(action?.link);
      if (!href || typeof action.label !== 'string' || !action.label.trim()) continue;
      const step = node('div', 'mygita-success-action');
      if (action.prompt) step.append(node('p', 'mygita-action-prompt', action.prompt));
      const link = node('a', 'mygita-success-action-link', action.label);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      step.append(link);
      fragment.append(step);
    }
  }

  class MyGitaInvitation extends HTMLElement {
    static observedAttributes = ['code', 'styling'];
    #api;
    #invitation = null;
    #actions = [];
    #message = '';
    #request = 0;
    #mode;
    #ready = false;
    constructor() {
      super();
      this.attachShadow({ mode:'open' });
    }
    connectedCallback() {
      // Replay properties assigned before the module upgraded this element.
      for (const key of ['api', 'invitation', 'actions']) {
        if (!Object.hasOwn(this, key)) continue;
        const value = this[key];
        delete this[key];
        this[key] = value;
      }
      this.#ready = true;
      this.render();
      if (this.#mode === undefined && this.hasAttribute('code')) this.#fromCode();
    }
    attributeChangedCallback(name, previous, next) {
      if (previous === next) return;
      if (name === 'code' && (!this.isConnected || !this.#ready)) {
        ++this.#request;
        this.#mode = undefined;
        this.#invitation = null;
        this.#actions = [];
        this.#message = '';
      } else if (name === 'code') this.#fromCode();
      else this.render();
    }
    set api(value) {
      if (this.#api === value) return;
      this.#api = value;
      if (this.#mode !== 'data' && this.hasAttribute('code')) {
        if (this.isConnected && this.#ready) this.#fromCode();
        else this.#mode = undefined;
      }
    }
    get invitation() { return this.#invitation; }
    set invitation(value) {
      ++this.#request;
      this.#mode = 'data';
      this.#message = '';
      this.#invitation = value;
      this.#actions = value?.onSuccess;
      this.render();
    }
    set actions(value) {
      this.#actions = value;
      this.render();
    }
    #fromCode() {
      const code = this.getAttribute('code')?.trim();
      if (code && this.#api) {
        this.load(code).catch(() => {}); // Declarative use displays errors inline.
      } else {
        this.invitation = null;
        this.#mode = 'code';
      }
    }
    async load(code) {
      const request = ++this.#request;
      this.#mode = 'code';
      this.#invitation = null;
      this.#actions = [];
      this.#message = 'Checking invitation…';
      this.render();
      try {
        const result = await this.#api.getInvitation(code);
        if (request !== this.#request) return null;
        if (result?.ok === false) throw new Error(result.message);
        const value = result?.invitation ?? result;
        if (!value?.experience || !value?.offering) throw new Error('Invalid invitation response.');
        this.#invitation = value;
        this.#message = '';
        this.render();
        return value;
      } catch (error) {
        if (request !== this.#request) return null;
        this.#message = error.message || 'Unable to load the invitation.';
        this.render();
        throw error;
      }
    }
    render() {
      if (!this.isConnected) return;
      const content = document.createDocumentFragment();
      if (this.#message) {
        const status = node('p', 'mygita-invitation-status', this.#message);
        status.setAttribute('role', 'status');
        content.append(status);
      }
      if (this.#invitation) content.append(details(this.#invitation));
      appendActions(content, this.#actions);
      if (this.getAttribute('styling') === 'host') {
        this.shadowRoot.replaceChildren(document.createElement('slot'));
        this.replaceChildren(content);
      } else {
        this.replaceChildren();
        const style = node('style', '', css);
        this.shadowRoot.replaceChildren(style, content);
      }
    }
  }
  customElements.define(tag, MyGitaInvitation);
})();
