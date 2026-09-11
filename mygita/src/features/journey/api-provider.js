// @ts-check
import {
  mygitaApiRequest,
  validateInterest,
  validateJourney,
  validateJourneyCollection,
} from "../../contracts/mygita-api.js";
import { hasSession } from "../../core/session.js";

const emptyState = () => ({ journeys: [], interests: [], completed: [] });

/** @param {any} payload @returns {import('./contract.js').JourneyState} */
function normalizeState(payload) {
  const journeys = payload.items.map((item) => ({
    experienceId: item.experienceId,
    ...(item.batchId ? { batchId: item.batchId } : {}),
    completed: item.completedActivityIds,
  }));
  return {
    journeys,
    interests: payload.interests.map((item) => item.experienceId),
    completed: [...new Set(journeys.flatMap((item) => item.completed || []))],
  };
}

/** @param {typeof mygitaApiRequest} request */
export function createJourneyApiProvider(request = mygitaApiRequest) {
  const provider = Object.freeze({
    async getState(options={}) {
      if (!hasSession()) return emptyState();
      const payload = await request("/me/journey", { signal:options.signal,authenticated: true, validate: validateJourneyCollection });
      return normalizeState(payload);
    },
    async enrol(experienceId, batchId) {
      const current = await provider.getState();
      if (current.journeys.some((item) => item.experienceId === experienceId)) return current;
      await request("/me/journey", {
        method: "POST",
        authenticated: true,
        body: { experienceId, ...(batchId ? { batchId } : {}) },
        validate: validateJourney,
      });
      return provider.getState();
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
      return provider.getState();
    },
    async completeActivity(activityId) {
      await request(`/me/activities/${encodeURIComponent(activityId)}/complete`, {
        method: "POST",
        authenticated: true,
        body: {},
        validate: validateJourney,
      });
      return provider.getState();
    },
    async reset() {},
  });
  return provider;
}

export const journeyApiProvider = createJourneyApiProvider();
