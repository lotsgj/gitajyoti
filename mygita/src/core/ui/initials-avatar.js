// @ts-check
import { escapeHtml } from "../dom.js";
export function initialsFor(name = "") { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "GS"; }
export function initialsAvatar(name, size = "md") { return `<span class="avatar avatar--${escapeHtml(size)}" aria-hidden="true">${escapeHtml(initialsFor(name))}</span>`; }
