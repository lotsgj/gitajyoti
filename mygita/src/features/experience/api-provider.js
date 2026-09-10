// @ts-check
import {
  mygitaApiRequest,
  validateBatchList,
  validateExperience,
  validateExperienceList,
  validateLearnerActivity,
} from "../../contracts/mygita-api.js";

/** @param {any} item @returns {import('./models.js').Experience} */
function normalizeExperience(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    shortDescription: item.shortDescription,
    description: item.description,
    designedFor: item.designedFor,
    guidanceMode: item.guidanceMode,
    languages: item.languages,
    commitment: item.commitment,
    delivery: { requiresBatch: item.delivery.requiresBatch },
    intendedOutcomes: item.intendedOutcomes,
    illustration: item.image.src.split("/").at(-1) || "experience",
    activityIds: item.constituentActivityIds,
  };
}

/** @param {any} item @returns {import('./models.js').Batch} */
function normalizeBatch(item) {
  return {
    id: item.id,
    experienceId: item.experienceId,
    name: item.name,
    period: `${item.batchPeriod.startsOn} – ${item.batchPeriod.endsOn}`,
    time: item.timezone,
    state: item.enrolment.state,
  };
}

/** @param {any} item @returns {import('./models.js').ActivityDefinition} */
function normalizeActivity(item) {
  return {
    id: item.id,
    experienceId: item.experienceId,
    title: item.title,
    type: item.activityType,
    duration: item.recommendedDurationMinutes,
    description: item.description,
    preparation: item.preparation,
    outcome: item.intendedOutcome,
  };
}

/** @param {typeof mygitaApiRequest} request */
export function createExperienceApiProvider(request = mygitaApiRequest) {
  return Object.freeze({
    async listExperiences() {
      const payload = await request("/experiences", { validate: validateExperienceList });
      return payload.items.map(normalizeExperience);
    },
    async getExperience(slug) {
      try {
        const payload = await request(`/experiences/${encodeURIComponent(slug)}`, { validate: validateExperience });
        return normalizeExperience(payload);
      } catch (error) {
        if (error && typeof error === "object" && Reflect.get(error, "status") === 404) return undefined;
        throw error;
      }
    },
    async getBatches(experienceId) {
      const payload = await request(`/experiences/${encodeURIComponent(experienceId)}/batches`, { validate: validateBatchList });
      return payload.items.map(normalizeBatch);
    },
    async getActivityDefinition(id) {
      const payload = await request(`/me/activities/${encodeURIComponent(id)}`, { authenticated: true, validate: validateLearnerActivity });
      return normalizeActivity(payload);
    },
  });
}

export const experienceApiProvider = createExperienceApiProvider();
