// @ts-check
import { escapeHtml } from "../dom.js";

/** @param {{label:string, href?:string, variant?:string, attributes?:string}} options */
export function button({ label, href = "#", variant = "primary", attributes = "" }) {
  return `<a class="button button--${variant}" href="${escapeHtml(href)}" ${attributes}>${escapeHtml(label)}</a>`;
}
