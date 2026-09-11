// @ts-check
import { escapeHtml } from "../../../core/dom.js";

/** @param {{label?:string,withHelp?:boolean}} options */
export function usernameField({label="Username",withHelp=false}={}) {
  const help=withHelp?`<small id="username-help">Use 3–32 letters, numbers, dots, hyphens or underscores. Usernames are not case-sensitive.</small>`:"";
  return `<label class="field"><span class="field__label">${escapeHtml(label)}</span><input name="username" autocomplete="username" autocapitalize="none" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._-]*"${withHelp?' aria-describedby="username-help"':""} required>${help}</label>`;
}

/** @param {string} name @param {string} label @param {string} autocomplete @param {string} [help] */
export function passwordField(name,label,autocomplete,help="") {
  const id=`${name}-input`;
  return `<label class="field"><span class="field__label">${escapeHtml(label)}</span><span class="password-field"><input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" minlength="15" maxlength="128"${help?` aria-describedby="${escapeHtml(id)}-help"`:""} required><button type="button" data-action="toggle-password" data-target="${escapeHtml(id)}" aria-label="Show ${escapeHtml(label.toLowerCase())}" aria-pressed="false">Show</button></span>${help?`<small id="${escapeHtml(id)}-help">${escapeHtml(help)}</small>`:""}</label>`;
}
