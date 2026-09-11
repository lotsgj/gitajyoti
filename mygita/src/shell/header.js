// @ts-check
import { initialsAvatar } from "../core/ui/initials-avatar.js";
import { navigationItems } from "./navigation.js";

/** @param {import('../features/identity/contract.js').User|null} user */
export function header(user=null) {
  const nav=navigationItems.filter(item=>!item.protected||user).map(item=>`<a href="${item.href}">${item.label}</a>`).join("");
  const account=user?`<div class="shell-menu"><button class="icon-button" type="button" data-action="toggle-menu" aria-expanded="false" aria-controls="account-menu" aria-label="Open account menu">${initialsAvatar(user.personalDetails.displayName)}</button><div id="account-menu" class="menu" hidden><a href="#/profile">My profile</a><a href="#/journey">My Journey</a><button type="button" data-action="sign-out">Sign out</button></div></div>`:`<a class="button button--quiet button--small" href="#/auth">Sign in</a>`;
  const mobileNavigation=user?`<div class="shell-menu"><button class="icon-button mobile-menu-button" type="button" data-action="toggle-mobile-menu" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open navigation">☰</button><nav id="mobile-menu" class="menu" aria-label="Mobile navigation" hidden>${nav}</nav></div>`:"";
  return `<header class="site-header"><div class="shell-bar"><a class="brand" href="#/discover" aria-label="My Gita home">Gita <strong>Jyoti</strong></a><nav class="desktop-nav" aria-label="Main navigation">${nav}</nav><div class="shell-actions">${account}${mobileNavigation}</div></div></header>`;
}
