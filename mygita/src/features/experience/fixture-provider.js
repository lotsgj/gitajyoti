// @ts-check
import { activities, batches, experiences, experienceVersions } from "./fixture-data.js";

/** @param {import('./models.js').Experience} item @returns {import('./models.js').ExperienceCardSummary} */
function summarize(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    shortDescription: item.shortDescription,
    designedFor: item.designedFor,
    guidanceMode: item.guidanceMode,
    illustration: item.illustration,
  };
}

export const experienceFixtureProvider = Object.freeze({
  async revalidateCatalogueManifest(options={}) {
    const etag = `fixture-${experienceVersions.catalogueVersion}-details`;
    if (options.etag === etag) return { status: 304, data: null, etag };
    return { status: 200, data: await this.getCatalogueManifest(), etag };
  },
  async getCatalogueManifest() {
    return {
      catalogueVersion: experienceVersions.catalogueVersion,
      generatedAt: experienceVersions.generatedAt,
      experiences: experiences.map(({ id, slug }) => ({ id, slug, detailVersion: experienceVersions.details[id] })),
    };
  },
  async listExperienceSummaries() {
    return { catalogueVersion: experienceVersions.catalogueVersion, items: experiences.map(summarize) };
  },
  async listExperiences() { return experiences; },
  async getExperience(slug) { return experiences.find(item=>item.slug===slug); },
  async getBatches(experienceId) { return batches.filter(item=>item.experienceId===experienceId); },
  async getActivityDefinition(id) { return activities.find(item=>item.id===id)||{...activities[0],id,title:"Guided learning activity"}; },
});
