// @ts-check
import { createSessionDocumentStore } from "../../core/session-document-store.js";
/** @type {import('./contract.js').JourneyState & {user?:unknown}} */
const defaults={journeys:[],interests:[],completed:[]};
const store=createSessionDocumentStore("mygita.fixture.v1",defaults);
const view=state=>({journeys:state.journeys||[],interests:state.interests||[],completed:state.completed||[]});
export const journeyFixtureProvider=Object.freeze({
  async getState(){return view(store.read());},
  async enrol(experienceId,batchId){return view(store.update(state=>{const journeys=[...(state.journeys||[])];if(!journeys.some(item=>item.experienceId===experienceId))journeys.push({experienceId,batchId,completed:[]});return{...state,journeys};}));},
  async registerInterest(experienceId){return view(store.update(state=>{const interests=[...(state.interests||[])];if(!interests.includes(experienceId))interests.push(experienceId);return{...state,interests};}));},
  async completeActivity(activityId){return view(store.update(state=>{const completed=[...(state.completed||[])];if(!completed.includes(activityId))completed.push(activityId);return{...state,completed};}));},
  async reset(){store.update(state=>({...state,...defaults}));},
});
