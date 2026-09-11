// @ts-check
import { escapeHtml } from "../../../core/dom.js";
import { button } from "../../../core/ui/button.js";
import { initialsAvatar } from "../../../core/ui/initials-avatar.js";

/**
 * Shared Profile editor for post-registration setup and later Profile updates.
 * The only contextual difference is the optional skip action shown immediately
 * after Account creation.
 *
 * @param {Partial<import('../contract.js').PersonalDetails>} profile
 * @param {{afterRegistration?:boolean}} options
 */
export function profileEditor(profile={}, {afterRegistration=false}={}) {
  const name=profile.displayName||profile.fullName||"";
  const introduction=afterRegistration
    ? "Add these details to personalize your MyGita experience. You can skip this now and return here anytime."
    : "Add or update your details whenever you are ready.";
  const actions=afterRegistration
    ? `<div class="form-actions">${button({label:"Save profile",type:"submit",pendingLabel:"Saving…"})}${button({label:"Skip for now",variant:"secondary",type:"button",attributes:'data-action="skip-profile"'})}</div>`
    : button({label:"Save profile",type:"submit",pendingLabel:"Saving…"});
  return `<section class="profile-page"><header>${initialsAvatar(name,"lg")}<div><p class="eyebrow">My profile</p><h1>${escapeHtml(name||"Tell us about you")}</h1><p>${introduction}</p></div></header><form class="form-grid panel" data-form="${afterRegistration?"onboarding":"profile"}"><label class="field"><span>Full name</span><input name="fullName" value="${escapeHtml(profile.fullName||"")}" autocomplete="name" required></label><label class="field"><span>Display name</span><input name="displayName" value="${escapeHtml(profile.displayName||"")}" required></label><label class="field"><span>Date of birth</span><input name="dateOfBirth" type="date" value="${escapeHtml(profile.dateOfBirth||"")}" required></label><label class="field"><span>Email <small>(optional)</small></span><input name="email" type="email" value="${escapeHtml(profile.email||"")}"></label><p class="form-error" data-form-error role="alert" hidden></p>${actions}<p class="inline-notice" data-profile-notice hidden>Profile updated.</p></form></section>`;
}
