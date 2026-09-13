// @ts-check
import { accountAreas, currentAccountId, getAccountManifest, invalidateAccountManifest, rejectAccountSession } from "../../data/account-data-coordinator.js";
import { hasSession } from "../../core/session.js";

const emptyState=()=>({journeys:[],interests:[],completed:[]});const dirtyByAccount=new Map();const refreshing=new Map();
const announce=()=>{if(typeof globalThis.dispatchEvent==="function"&&typeof CustomEvent!=="undefined")globalThis.dispatchEvent(new CustomEvent("mygita:private-data-updated"));};
/** @param {import('./contract.js').Journey[]} journeys @param {string[]} interests @param {import('./contract.js').ActivityState[]} activityState */
function compose(journeys,interests,activityState){const completion=new Map(activityState.map(item=>[item.journeyId,item.completedActivityIds]));const result=journeys.map(item=>({...item,completed:completion.get(item.id||"")||[]}));return{journeys:result,interests,completed:[...new Set(result.flatMap(item=>item.completed||[]))]};}
/** @param {import('./contract.js').JourneyState} state */
function activityFromState(state){return state.journeys.filter(item=>item.id).map(item=>({journeyId:item.id||"",completedActivityIds:item.completed||[]}));}

/** @param {import('./contract.js').JourneyRepository} provider */
export function createCachedJourneyRepository(provider){
  /** @type {Map<string,import('./contract.js').JourneyState>} */
  const memory=new Map();const hydrate=(state)=>{const method=Reflect.get(provider,"hydrateState");if(typeof method==="function")method(state);return state;};
  async function projection(area,version,loader,derived){const cached=await area.read("current",{version});if(cached)return{data:cached.data,changed:false};const previous=await area.read("current"),value=derived??await loader();await area.write("current",{recordVersion:version,data:value});return{data:value,changed:Boolean(previous&&previous.recordVersion!==version)};}
  async function fresh(accountId,options={}){
    let versioned;try{versioned=await getAccountManifest({signal:options.signal});}catch(error){if(Reflect.get(/** @type {object} */(error),"status")===401){memory.delete(accountId);rejectAccountSession(accountId);}throw error;}
    if(!versioned)return{state:memory.get(accountId)||await provider.getState(options),changed:false};
    const areas=accountAreas(accountId),manifest=versioned.manifest,current=memory.get(accountId),dirty=dirtyByAccount.get(accountId)||new Set();
    if(!areas||!provider.revalidateJourneys||!provider.revalidateInterests||!provider.revalidateActivityState)return{state:current||await provider.getState(options),changed:false};
    const [journeys,interests,activityState]=await Promise.all([
      projection(areas.journey,manifest.journeyVersion,async()=>{const result=await provider.revalidateJourneys?.({signal:options.signal});return result?.data||[];},dirty.has("journey")&&current?current.journeys:undefined),
      projection(areas.interests,manifest.interestVersion,async()=>{const result=await provider.revalidateInterests?.({signal:options.signal});return result?.data||[];},dirty.has("interests")&&current?current.interests:undefined),
      projection(areas.activityState,manifest.activityStateVersion,async()=>{const result=await provider.revalidateActivityState?.({signal:options.signal});return result?.data?.items||[];},dirty.has("activityState")&&current?activityFromState(current):undefined),
    ]);dirtyByAccount.delete(accountId);
    const state=hydrate(compose(/** @type {import('./contract.js').Journey[]} */(journeys.data),/** @type {string[]} */(interests.data),/** @type {import('./contract.js').ActivityState[]} */(activityState.data)));memory.set(accountId,state);return{state,changed:journeys.changed||interests.changed||activityState.changed};
  }
  function background(accountId,options){if(refreshing.has(accountId))return;const pending=fresh(accountId,options).then(result=>{if(result.changed)announce();}).catch(error=>{if(Reflect.get(/** @type {object} */(error),"status")===401)announce();}).finally(()=>refreshing.delete(accountId));refreshing.set(accountId,pending);}
  function scheduleBackground(accountId,options){if(typeof globalThis.requestAnimationFrame==="function")globalThis.requestAnimationFrame(()=>background(accountId,options));else background(accountId,options);}
  async function storeMutation(accountId,state,affected){memory.set(accountId,hydrate(state));const areas=accountAreas(accountId);if(areas)await Promise.all(affected.map(name=>areas[name].remove("current")));dirtyByAccount.set(accountId,new Set([...(dirtyByAccount.get(accountId)||[]),...affected]));await invalidateAccountManifest(accountId);return state;}
  return Object.freeze({...provider,
    async getState(options={}){if(!hasSession())return emptyState();const accountId=currentAccountId();if(!accountId)return provider.getState(options);const areas=accountAreas(accountId),dirty=dirtyByAccount.get(accountId);if(areas&&!dirty){const [journeys,interests,activity]=await Promise.all([areas.journey.read("current"),areas.interests.read("current"),areas.activityState.read("current")]);if(journeys&&interests&&activity){const state=hydrate(compose(/** @type {import('./contract.js').Journey[]} */(journeys.data),/** @type {string[]} */(interests.data),/** @type {import('./contract.js').ActivityState[]} */(activity.data)));memory.set(accountId,state);scheduleBackground(accountId,options);return state;}}return(await fresh(accountId,options)).state;},
    async enrol(experienceId,batchId){const accountId=currentAccountId();return storeMutation(accountId,await provider.enrol(experienceId,batchId),["journey","activityState"]);},
    async registerInterest(experienceId){const accountId=currentAccountId();return storeMutation(accountId,await provider.registerInterest(experienceId),["interests"]);},
    async completeActivity(activityId){const accountId=currentAccountId();return storeMutation(accountId,await provider.completeActivity(activityId),["activityState"]);},
    async reset(){memory.clear();dirtyByAccount.clear();await provider.reset();},
  });
}
