import { escapeHtml } from "../core/dom.js";
export function pill(text) { return `<span class="pill">${escapeHtml(text)}</span>`; }
