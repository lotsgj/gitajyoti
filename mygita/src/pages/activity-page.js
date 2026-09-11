// @ts-check
import { escapeHtml } from "../core/dom.js";
import { button } from "../core/ui/button.js";
import { illustrationPlaceholder } from "../core/ui/illustration-placeholder.js";
import { pill } from "../core/ui/pill.js";
import { experienceRepository } from "../features/experience/index.js";
import { journeyRepository } from "../features/journey/index.js";
/** @param {string} id @param {{signal?:AbortSignal}} [options] */
export async function activityPage(id,{signal}={}){const item=await experienceRepository.getActivityDefinition(id,{signal});return `<article class="activity-page"><a class="back-link" href="#/journey">← My Journey</a>${illustrationPlaceholder("activity",item.title)}<div class="activity-copy"><div class="cluster">${pill(item.type)}${pill(`${item.duration} minutes`)}</div><p class="eyebrow">Next activity</p><h1>${escapeHtml(item.title)}</h1><p class="activity-lead">${escapeHtml(item.description)}</p><div class="activity-facts"><section><h2>Prepare</h2><p>${escapeHtml(item.preparation)}</p></section><section><h2>What it opens</h2><p>${escapeHtml(item.outcome)}</p></section></div>${button({label:"Begin activity",href:`#/activity/${item.id}/session`})}</div></article>`;}
/** @param {string} id @param {{signal?:AbortSignal}} [options] */
export async function sessionPage(id,{signal}={}){const [item,state]=await Promise.all([experienceRepository.getActivityDefinition(id,{signal}),journeyRepository.getState({signal})]),done=state.completed.includes(id);return `<section class="session-page panel"><p class="eyebrow">${done?"Activity complete":"In practice"}</p><h1>${escapeHtml(item.title)}</h1><div class="session-orb" aria-hidden="true">ॐ</div><p>${done?"You have completed this activity. Carry one insight into the rest of your day.":"Pause, attend, and continue when you are ready."}</p>${done?button({label:"Return to My Journey",href:"#/journey"}):`<form data-form="complete-activity" data-activity="${item.id}">${button({label:"Mark activity complete",type:"submit",pendingLabel:"Saving…"})}</form>`}</section>`;}
