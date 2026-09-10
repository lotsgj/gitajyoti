// @ts-check
import { escapeHtml } from "../dom.js";
const symbols={children:"✦",scripture:"ॐ",mountain:"△",chanting:"♫",activity:"☼",journey:"↟"};
export function illustrationPlaceholder(kind="journey",label="Illustration coming soon") { return `<div class="illustration illustration--${escapeHtml(kind)}" role="img" aria-label="${escapeHtml(label)}"><span aria-hidden="true">${symbols[kind]||"✦"}</span><small>Illustration space</small></div>`; }
