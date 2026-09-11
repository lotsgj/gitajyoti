// @ts-check
import { escapeHtml } from "../dom.js";

/** @param {{label:string, href?:string, variant?:string, attributes?:string, type?:"button"|"submit"|"reset"}} options */
export function button({ label, href = "#", variant = "primary", attributes = "", type }) {
  const className=`button button--${escapeHtml(variant)}`;
  if(type)return `<button class="${className}" type="${type}" ${attributes}>${escapeHtml(label)}</button>`;
  return `<a class="${className}" href="${escapeHtml(href)}" ${attributes}>${escapeHtml(label)}</a>`;
}
