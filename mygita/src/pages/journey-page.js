// @ts-check
import { GUIDING_PRINCIPLE } from "../content/mygita-copy.js";
import { experienceRepository } from "../features/experience/index.js";
import { statusView } from "../core/components/status-view.js";
import { journeyCard, journeyRepository } from "../features/journey/index.js";

/** @param {{signal?:AbortSignal,user?:any}} [options] */
export async function journeyPage({signal,user=null}={}){if(!user)return statusView({eyebrow:"Gita Sadhak",title:"Sign in to see your Journey",message:"Your enrolled experiences and progress will be gathered here.",action:{label:"Sign up / Sign in",href:"#/auth"}});const [state,experiences]=await Promise.all([journeyRepository.getState({signal}),experienceRepository.listExperiences({signal})]);if(!state.journeys.length)return statusView({eyebrow:"My Journey",title:"Your path is ready to begin.",message:"Choose an experience and it will appear here with your next activity.",action:{label:"Discover experiences",href:"#/discover"}});return `<section><header class="journey-header"><p class="eyebrow">${GUIDING_PRINCIPLE}</p><h1>My Journey</h1><p>Continue from where your inquiry last rested.</p></header><div class="journey-list">${state.journeys.map(journey=>journeyCard(journey,state.completed,experiences.find(item=>item.id===journey.experienceId))).join("")}</div></section>`;}
