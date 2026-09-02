import { escapeHtml } from "../../core/dom.js";
import { button } from "../../ui/button.js";
import { illustrationPlaceholder } from "../../ui/illustration-placeholder.js";
import { pill } from "../../ui/pill.js";
import { fixtureService } from "../fixtures/fixture-service.js";
export function experiencePage(slug) { const item=fixtureService.getExperience(slug); if(!item) return null; const state=fixtureService.state(), enrolled=state.journeys.some(j=>j.experienceId===item.id), interested=state.interests.includes(item.id); const tags=[...item.designedFor,item.guidanceMode.replace("-"," "),...item.languages,item.commitment.summary]; let action;
  if(enrolled) action=button({label:"View in My Journey",href:"#/journey"});
  else if(interested) action=button({label:"Interest registered",href:"#/discover",variant:"secondary"});
  else action=button({label:item.delivery.requiresBatch?"Choose a batch":"Register interest",href:`#/experience/${item.slug}/enrol`});
  return `<article class="experience-detail"><a class="back-link" href="#/discover">← Discover</a><header><p class="eyebrow">Learning experience</p><h1>${escapeHtml(item.title)}</h1><p class="experience-lead">${escapeHtml(item.subtitle)}</p></header>${illustrationPlaceholder(item.illustration,item.title)}<div class="experience-copy"><div class="cluster">${tags.map(pill).join("")}</div><p>${escapeHtml(item.description)}</p><section><h2>What this journey opens</h2><ul class="outcome-list">${item.intendedOutcomes.map(outcome=>`<li>${escapeHtml(outcome)}</li>`).join("")}</ul></section><div class="experience-actions">${action}</div></div></article>`; }
