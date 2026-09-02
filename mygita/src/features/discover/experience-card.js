import { escapeHtml } from "../../core/dom.js";
import { illustrationPlaceholder } from "../../ui/illustration-placeholder.js";
import { pill } from "../../ui/pill.js";
export function experienceCard(item) { const tags=[...item.designedFor.slice(0,1), item.guidanceMode.replace("-"," ")]; return `<article class="experience-card">${illustrationPlaceholder(item.illustration,item.title)}<div class="experience-card__body"><div class="cluster">${tags.map(pill).join("")}</div><h2><a href="#/experience/${item.slug}">${escapeHtml(item.title)}</a></h2><p class="experience-card__subtitle">${escapeHtml(item.subtitle)}</p><p>${escapeHtml(item.shortDescription)}</p><a class="text-link" href="#/experience/${item.slug}">Explore experience <span aria-hidden="true">→</span></a></div></article>`; }
