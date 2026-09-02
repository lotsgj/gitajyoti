import { activities, batches, experiences } from "./catalog.js";

const key = "mygita.fixture.v1";
const guest = { user:null, journeys:[], interests:[], completed:[] };
function read() { try { return {...guest, ...JSON.parse(sessionStorage.getItem(key))}; } catch { return {...guest}; } }
function write(state) { sessionStorage.setItem(key, JSON.stringify(state)); return state; }
export const fixtureService = {
  listExperiences: () => experiences,
  getExperience: slug => experiences.find(item => item.slug === slug),
  getBatches: experienceId => batches.filter(item => item.experienceId === experienceId),
  getActivity: id => activities.find(item => item.id === id) || {...activities[0], id, title:"Guided learning activity"},
  state: read,
  signIn(profile={fullName:"Deepa Sharma",displayName:"Deepa",dateOfBirth:"1990-05-12"}) { const state=read(); state.user={id:"fixture-user",personalDetails:profile,onboarding:{state:"complete"}}; return write(state); },
  signOut() { return write({...guest}); },
  updateProfile(profile) { const state=read(); state.user={...(state.user||{id:"fixture-user"}),personalDetails:{...(state.user?.personalDetails||{}),...profile},onboarding:{state:"complete"}}; return write(state); },
  enrol(experienceId,batchId) { const state=read(); if(!state.journeys.some(j=>j.experienceId===experienceId)) state.journeys.push({experienceId,batchId,completed:[]}); return write(state); },
  interest(experienceId) { const state=read(); if(!state.interests.includes(experienceId)) state.interests.push(experienceId); return write(state); },
  complete(activityId) { const state=read(); if(!state.completed.includes(activityId)) state.completed.push(activityId); return write(state); },
  reset() { sessionStorage.removeItem(key); return {...guest}; }
};
