// @ts-check
import { escapeHtml } from "../dom.js";
export function pill(text) { return `<span class="pill">${escapeHtml(text)}</span>`; }
