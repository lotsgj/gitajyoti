// @ts-check
import { activities, batches, experiences } from "./fixture-data.js";

export const experienceFixtureProvider = Object.freeze({
  async listExperiences() { return experiences; },
  async getExperience(slug) { return experiences.find(item=>item.slug===slug); },
  async getBatches(experienceId) { return batches.filter(item=>item.experienceId===experienceId); },
  async getActivityDefinition(id) { return activities.find(item=>item.id===id)||{...activities[0],id,title:"Guided learning activity"}; },
});
