// @ts-check
import { escapeHtml } from "../core/dom.js";
import { experienceCard, experienceRepository } from "../features/experience/index.js";
import { greeting } from "../shell/greeting.js";

/** @param {{signal?:AbortSignal,user?:any}} [options] */
export async function discoverPage({signal,user=null}={}){const catalogue=await experienceRepository.listExperienceSummaries({signal});const items=catalogue.items,welcome=greeting(user),refresh=experienceRepository.getPublicRefreshState?.();const notice=refresh?.state==="refreshing"?`<p class="inline-notice" role="status">Checking for updated experiences…</p>`:refresh?.state==="error"?`<p class="inline-notice" role="status">Showing saved experiences. Updates could not be checked.</p>`:"";return `<section class="discover-hero" aria-live="polite" aria-atomic="true"><p class="eyebrow">${escapeHtml(welcome.subtitle)}</p><h1>${escapeHtml(welcome.title)}</h1><p>Discover a learning experience that meets the question alive in you today.</p></section><section aria-labelledby="experiences-title"><div class="section-heading"><div><p class="eyebrow">Learning experiences</p><h2 id="experiences-title">Walk from wisdom to lived understanding</h2></div><span>${items.length} experiences</span></div>${notice}<div class="experience-grid">${items.map(experienceCard).join("")}</div></section>`;}
