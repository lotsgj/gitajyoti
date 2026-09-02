import { escapeHtml } from "../core/dom.js";

export function button({ label, href = "#", variant = "primary", attributes = "" }) {
  return `<a class="button button--${variant}" href="${escapeHtml(href)}" ${attributes}>${escapeHtml(label)}</a>`;
}
