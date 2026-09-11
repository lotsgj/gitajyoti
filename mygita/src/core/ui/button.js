// @ts-check
import { escapeHtml } from "../dom.js";

/** @param {{label:string, href?:string, variant?:string, attributes?:string, type?:"button"|"submit"|"reset",pendingLabel?:string}} options */
export function button({ label, href = "#", variant = "primary", attributes = "", type, pendingLabel="Please wait…" }) {
  const className=`button button--${escapeHtml(variant)}`;
  if(type)return `<button class="${className}" type="${type}" data-pending-label="${escapeHtml(pendingLabel)}" ${attributes}>${escapeHtml(label)}</button>`;
  return `<a class="${className}" href="${escapeHtml(href)}" ${attributes}>${escapeHtml(label)}</a>`;
}
