// @ts-check
import { escapeHtml } from "../dom.js";
import { button } from "../ui/button.js";

/** @param {{eyebrow?:string, title:string, message:string, action?:{label:string,href?:string,variant?:string}}} options */
export function statusView({ eyebrow = "My Gita", title, message, action }) {
  return `<section class="status-view panel" aria-labelledby="status-title"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 id="status-title">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${action ? `<div class="status-view__actions">${button(action)}</div>` : ""}</section>`;
}
