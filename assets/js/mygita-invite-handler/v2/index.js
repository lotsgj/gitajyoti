// Side-effect module. Also valid as a classic script for file:// registration.
(() => {
  const tag = 'mygita-invitation';
  if (customElements.get(tag)) return;

  const css = `
    :host { display:block; color:var(--ink,#163c54); font:inherit }
    :host([hidden]) { display:none }
    [hidden] { display:none!important }
    h3 { font:600 clamp(1.4rem,3vw,2rem)/1.15 Georgia,serif; margin:4px 0 }
    p { margin:4px 0; color:var(--muted,#536969); font-size:.92rem }
    .mygita-invitation-details { position:relative; overflow:hidden; isolation:isolate; text-align:left; background:#fffaf0; border:1px solid #ddceaf; border-radius:18px; overflow-wrap:anywhere }
    .mygita-story { display:grid; align-items:stretch }
    .mygita-story:has(img) { grid-template-columns:clamp(76px,21%,145px) minmax(0,1fr) }
    .mygita-cover { width:100%; height:100%; min-height:0; object-fit:cover; position:absolute; inset:0 }
    .mygita-art { position:relative }
    .mygita-copy { padding:16px 19px }
    .mygita-invitation-details:has(.mygita-toggle) .mygita-copy { padding-right:56px }
    .mygita-applied { color:#37695f; font-size:.72rem; font-weight:750; letter-spacing:.12em; text-transform:uppercase }
    .mygita-applied::before { content:'✓'; margin-right:.5em }
    .mygita-invitation-meta { margin-top:9px; font-size:.82rem }
    .mygita-description,.mygita-outcome,.mygita-bio p { white-space:pre-line }
    .mygita-description { margin-top:15px }
    .mygita-outcome-label,.mygita-acharya-label { font:600 1.12rem/1.3 Georgia,serif; margin:12px 0 4px }
    .mygita-invitation-details[data-expanded] .mygita-story:has(img) { grid-template-columns:minmax(0,38%) minmax(0,1fr); min-height:185px }
    .mygita-acharyas { display:grid; gap:8px; padding:14px 54px 16px 19px; border-top:1px solid #e5dcc9; background:#fcf6e9; font-size:.92rem }
    .mygita-acharya-label { margin:0 }
    .mygita-toggle { position:absolute; right:4px; bottom:4px; width:44px; height:44px; display:grid; place-items:center; background:none; border:0; padding:0; color:#285f59; cursor:pointer }
    .mygita-chevron { display:grid; place-items:center; width:29px; height:29px; border-radius:50%; border:1px solid #b8c8ba; background:#fffaf0 }
    .mygita-toggle:focus-visible,.mygita-person:focus-visible { outline:2px solid #296b64; outline-offset:-2px }
    .mygita-toggle::after { position:absolute; right:100%; bottom:7px; width:max-content; padding:4px 9px; border-radius:5px; background:#173c50; color:white; font:500 .8rem/1.4 system-ui; pointer-events:none }
    .mygita-toggle:focus-visible::after { content:attr(aria-label) }
    @media (hover:hover) and (pointer:fine) { .mygita-toggle:hover::after { content:attr(aria-label) } }
    .mygita-acharya-label { color:var(--ink,#163c54) }
    .mygita-acharya-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 18px; list-style:none; margin:0; padding:0 }
    .mygita-person { display:grid; grid-template-columns:34px minmax(0,1fr); gap:7px; align-items:center; min-height:44px; color:inherit; font:inherit; font-weight:700; text-align:left; overflow-wrap:anywhere }
    button.mygita-person { padding:0; background:transparent; border:none; cursor:pointer }
    button.mygita-person .mygita-acharya-name { text-decoration:underline; text-decoration-color:#9baea5; text-underline-offset:3px }
    .mygita-bio { position:fixed; inset:0; margin:auto; width:min(18rem,calc(100vw - 32px)); max-height:55vh; box-sizing:border-box; padding:15px 18px; border:1px solid #cabc9c; border-radius:12px; background:#fffdf6; color:#173c50; box-shadow:0 5px 20px #1234 }
    @supports (position-area:bottom) { .mygita-bio { inset:auto; position-area:bottom; justify-self:anchor-center; margin:4px; position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline } }
    .mygita-bio h4 { margin:0 40px 6px 0; font:600 1.12rem Georgia,serif }
    .mygita-bio-close { position:absolute; right:0; top:0; width:44px; height:44px; border:0; background:none; color:inherit; cursor:pointer; font-size:1.3rem }
    .mygita-acharya-avatar { box-sizing:border-box; width:34px; height:34px; border-radius:50%; border:1px solid #c2c9bd; object-fit:cover }
    .mygita-acharya-initials { display:grid; place-items:center; color:white; background:var(--teal,#36726d); font-size:.7rem }
    .mygita-success-action { display:grid; justify-items:center; gap:10px; margin:20px auto; text-align:center }
    .mygita-success-action p { white-space:pre-line }
    .mygita-success-action-link { padding:12px 24px; border-radius:2em; background:var(--gold,#e9aa3c); color:#163c54; font-weight:750; text-decoration:none }
    @media(max-width:900px) { .mygita-acharya-list { grid-template-columns:repeat(2,minmax(0,1fr)) } }
    @media(max-width:700px) { .mygita-acharya-list { grid-template-columns:minmax(0,1fr) } }
    @media(max-width:600px) { .mygita-invitation-details[data-expanded] .mygita-story:has(img) { grid-template-columns:1fr } .mygita-invitation-details[data-expanded] .mygita-art { height:165px } }
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
  function acharya({ name, profilePic, about }) {
    const item = node('li', 'mygita-acharya');
    const bio = about?.trim();
    const person = node(bio ? 'button' : 'span', 'mygita-person');
    item.append(person);
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
      person.append(img);
    } else person.append(fallback);
    person.append(node('span', 'mygita-acharya-name', name));
    if (bio) {
      person.type = 'button';
      person.setAttribute('aria-haspopup', 'dialog');
      person.setAttribute('aria-label', 'About ' + name);
      const panel = node('div', 'mygita-bio');
      panel.popover = 'auto';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'About ' + name);
      const close = node('button', 'mygita-bio-close', '×');
      close.type = 'button';
      close.autofocus = true;
      close.setAttribute('aria-label', 'Close biography');
      close.popoverTargetElement = panel;
      close.popoverTargetAction = 'hide';
      person.popoverTargetElement = panel;
      panel.append(node('h4', '', name), node('p', '', bio), close);
      item.append(panel);
    }
    return item;
  }
  const languageNames = new Intl.DisplayNames(['en'], { type:'language' });
  const dates = new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
  function details(invitation, applied, hostStyled) {
    const { experience, offering } = invitation;
    const block = node('section', 'mygita-invitation-details');
    const story = node('div', 'mygita-story');
    const copy = node('div', 'mygita-copy');
    const pic = url(experience.pic, true);
    if (pic) {
      const art = node('div', 'mygita-art');
      const img = node('img', 'mygita-cover');
      img.alt = experience.name;
      img.loading = 'lazy';
      img.onerror = () => art.remove();
      img.src = pic;
      art.append(img);
      story.append(art);
    }
    if (applied) copy.append(node('div', 'mygita-applied', 'Invitation applied'));
    copy.append(node('h3', 'mygita-experience', experience.name), node('p', 'mygita-offering', offering.name));
    story.append(copy);
    block.append(story);
    const extra = node('div', 'mygita-expanded-copy');
    if (experience.description?.trim()) extra.append(node('p', 'mygita-description', experience.description));
    if (experience.outcome?.trim()) extra.append(node('h4', 'mygita-outcome-label', 'What you’ll take away'), node('p', 'mygita-outcome', experience.outcome));
    const people = (offering.acharyas || []).filter(person => person?.name);
    const group = node('section', 'mygita-acharyas');
    if (people.length) {
      const list = node('ul', 'mygita-acharya-list');
      list.append(...people.map(acharya));
      group.append(node('h4', 'mygita-acharya-label', 'Guided by'), list);
      block.append(group);
    }
    const languages = (offering.languages || []).map(code => {
      try { return languageNames.of(code); } catch { return code; }
    });
    const date = new Date(offering.startDate + 'T00:00:00Z');
    copy.append(node('p', 'mygita-invitation-meta', [
      languages.join(' · ') || 'Language to be announced',
      Number.isNaN(date.getTime()) ? 'Start date to be announced' : 'Begins ' + dates.format(date),
    ].join(' · ')));
    if (extra.childElementCount) copy.append(extra);
    if (people.length || extra.childElementCount) {
      const toggle = node('button', 'mygita-toggle');
      const icon = node('span', 'mygita-chevron');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const arrow = icon.querySelector('path');
      toggle.type = 'button';
      toggle.append(icon);
      function expand(open) {
        block.toggleAttribute('data-expanded', open);
        extra.hidden = group.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Hide invitation details' : 'View invitation details');
        if (hostStyled && matchMedia('(hover:hover) and (pointer:fine)').matches) toggle.title = toggle.getAttribute('aria-label');
        else toggle.removeAttribute('title');
        arrow.setAttribute('d', open ? 'M2 11 L8 5 L14 11' : 'M2 5 L8 11 L14 5');
      }
      toggle.onclick = () => expand(!block.hasAttribute('data-expanded'));
      expand(false);
      block.append(toggle);
    }
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
    static observedAttributes = ['code', 'styling', 'applied'];
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
      const hostStyled = this.getAttribute('styling') === 'host';
      if (this.#invitation) content.append(details(this.#invitation, this.hasAttribute('applied'), hostStyled));
      appendActions(content, this.#actions);
      if (hostStyled) {
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
