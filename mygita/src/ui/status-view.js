import { escapeHtml } from "../core/dom.js";
import { button } from "./button.js";

export function statusView({ eyebrow = "My Gita", title, message, action }) {
  return `<section class="status-view panel" aria-labelledby="status-title"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 id="status-title">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${action ? `<div class="status-view__actions">${button(action)}</div>` : ""}</section>`;
}
