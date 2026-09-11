// @ts-check
import { escapeHtml } from "../core/dom.js";
import { experienceCard, experienceRepository } from "../features/experience/index.js";
import { identityRepository } from "../features/identity/index.js";
import { greeting } from "../shell/greeting.js";

/** @param {{signal?:AbortSignal}} [options] */
export async function discoverPage({signal}={}){const [user,items]=await Promise.all([identityRepository.getCurrentUser({signal}),experienceRepository.listExperiences({signal})]);const welcome=greeting(user);return `<section class="discover-hero"><p class="eyebrow">${escapeHtml(welcome.subtitle)}</p><h1>${escapeHtml(welcome.title)}</h1><p>Discover a learning experience that meets the question alive in you today.</p></section><section aria-labelledby="experiences-title"><div class="section-heading"><div><p class="eyebrow">Learning experiences</p><h2 id="experiences-title">Walk from wisdom to lived understanding</h2></div><span>${items.length} experiences</span></div><div class="experience-grid">${items.map(experienceCard).join("")}</div></section>`;}
