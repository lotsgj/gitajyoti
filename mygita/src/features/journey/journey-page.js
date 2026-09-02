import { escapeHtml } from "../../core/dom.js";
import { fixtureService } from "../fixtures/fixture-service.js";
import { illustrationPlaceholder } from "../../ui/illustration-placeholder.js";

export function journeyPage() {
  const state=fixtureService.state();
  if(!state.user) return `<section class="status-view panel"><p class="eyebrow">Gita Sadhak</p><h1>Sign in to see your Journey</h1><p>Your enrolled experiences and progress will be gathered here.</p><div class="status-view__actions"><a class="button button--primary" href="#/auth">Sign up / Sign in</a></div></section>`;
  if(!state.journeys.length) return `<section class="status-view panel"><p class="eyebrow">My Journey</p><h1>Your path is ready to begin.</h1><p>Choose an experience and it will appear here with your next activity.</p><div class="status-view__actions"><a class="button button--primary" href="#/discover">Discover experiences</a></div></section>`;
  return `<section><header class="journey-header"><p class="eyebrow">Truth alone liberates</p><h1>My Journey</h1><p>Continue from where your inquiry last rested.</p></header><div class="journey-list">${state.journeys.map(journey=>journeyCard(journey,state.completed)).join("")}</div></section>`;
}

function journeyCard(journey,completed) {
  const exp=fixtureService.listExperiences().find(item=>item.id===journey.experienceId);
  const ids=exp.activityIds;
  const done=ids.filter(id=>completed.includes(id)).length;
  const next=ids.find(id=>!completed.includes(id))||ids[ids.length-1];
  return `<article class="journey-card">${illustrationPlaceholder(exp.illustration,exp.title)}<div><div class="cluster"><span class="pill">${done} of ${ids.length} complete</span></div><h2>${escapeHtml(exp.title)}</h2><p>${escapeHtml(exp.subtitle)}</p><div class="progress" role="progressbar" aria-label="Journey progress" aria-valuemin="0" aria-valuemax="${ids.length}" aria-valuenow="${done}"><span style="width:${ids.length?done/ids.length*100:0}%"></span></div><a class="button button--primary" href="#/activity/${next}">${done===ids.length?"Review journey":"Continue next activity"}</a></div></article>`;
}
