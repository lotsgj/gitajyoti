// @ts-check
import {
  mygitaApiRequest,
  validateActivityStateList,
  validateInterest,
  validateInterestList,
  validateJourney,
  validateJourneyRecordList,
} from "../../contracts/mygita-api.js";
import { getSession, hasSession } from "../../core/session.js";

const emptyState = () => ({ journeys: [], interests: [], completed: [] });

/** @param {any} payload @returns {import('./contract.js').JourneyState} */
function normalizeJourneys(payload) {
  return payload.items.map((item) => ({
    id:item.id,
    experienceId: item.experienceId,
    ...(item.batchId ? { batchId: item.batchId } : {}),
    activityIds:item.activityIds,
    completed:[],
  }));
}

function composeState(journeys,interests,activityState) {
  const completion=new Map(activityState.map(item=>[item.journeyId,item.completedActivityIds]));
  const composed=journeys.map(item=>({...item,completed:completion.get(item.id)||[]}));
  return {
    journeys:composed,
    interests,
    completed: [...new Set(composed.flatMap((item) => item.completed || []))],
  };
}

function normalizeJourney(item){return {id:item.id,experienceId:item.experienceId,...(item.batchId?{batchId:item.batchId}:{}),activityIds:item.activityIds,completed:item.completedActivityIds};}

/** @param {typeof mygitaApiRequest} request */
export function createJourneyApiProvider(request = mygitaApiRequest) {
  let currentState=null;
  let stateAccountId="";
  const provider = Object.freeze({
    hydrateState(state){currentState=state;stateAccountId=String(getSession()?.accountId||"");},
    async revalidateJourneys(options={}){
      const response=await request("/me/journeys",{authenticated:true,signal:options.signal,ifNoneMatch:options.etag,metadata:true,validate:validateJourneyRecordList});
      return {...response,data:response.data?normalizeJourneys(response.data):null};
    },
    async revalidateInterests(options={}){
      const response=await request("/me/interests",{authenticated:true,signal:options.signal,ifNoneMatch:options.etag,metadata:true,validate:validateInterestList});
      return {...response,data:response.data?response.data.items.map(item=>item.experienceId):null};
    },
    async revalidateActivityState(options={}){
      return request("/me/activity-state",{authenticated:true,signal:options.signal,ifNoneMatch:options.etag,metadata:true,validate:validateActivityStateList});
    },
    async getState(options={}) {
      if (!hasSession()){currentState=null;stateAccountId="";return emptyState();}
      const accountId=String(getSession()?.accountId||"");
      if(currentState&&stateAccountId===accountId)return currentState;
      const [journeys,interests,activity]=await Promise.all([provider.revalidateJourneys(options),provider.revalidateInterests(options),provider.revalidateActivityState(options)]);
      stateAccountId=accountId;currentState=composeState(journeys.data||[],interests.data||[],activity.data?.items||[]);return currentState;
    },
    async enrol(experienceId, batchId) {
      const current = await provider.getState();
      if (current.journeys.some((item) => item.experienceId === experienceId)) return current;
      const created=await request("/me/journey", {
        method: "POST",
        authenticated: true,
        body: { experienceId, ...(batchId ? { batchId } : {}) },
        validate: validateJourney,
      });
      const journey=normalizeJourney(created);
      currentState={...current,journeys:[...current.journeys.filter(item=>item.experienceId!==experienceId),journey],completed:[...new Set([...current.completed,...journey.completed||[]])]};return currentState;
    },
    async registerInterest(experienceId) {
      const current = await provider.getState();
      if (current.interests.includes(experienceId)) return current;
      await request("/me/interests", {
        method: "POST",
        authenticated: true,
        body: { experienceId },
        validate: validateInterest,
      });
      currentState={...current,interests:[...current.interests,experienceId]};return currentState;
    },
    async completeActivity(activityId) {
      const current=await provider.getState();
      const updated=await request(`/me/activities/${encodeURIComponent(activityId)}/complete`, {
        method: "POST",
        authenticated: true,
        body: {},
        validate: validateJourney,
      });
      const journey=normalizeJourney(updated);
      currentState={...current,journeys:current.journeys.map(item=>item.experienceId===journey.experienceId?journey:item),completed:[...new Set([...current.completed,...journey.completed||[]])]};return currentState;
    },
    async reset() {currentState=null;stateAccountId="";},
  });
  return provider;
}

export const journeyApiProvider = createJourneyApiProvider();
