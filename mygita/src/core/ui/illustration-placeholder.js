// @ts-check
import { escapeHtml } from "../dom.js";
const symbols={children:"✦",scripture:"ॐ",mountain:"△",chanting:"♫",activity:"☼",journey:"↟"};
export function illustrationPlaceholder(kind="journey",label="Learning experience") { return `<div class="illustration illustration--${escapeHtml(kind)}" role="img" aria-label="${escapeHtml(label)}"><span aria-hidden="true">${symbols[kind]||"✦"}</span></div>`; }
