// @ts-check
/**
 * @typedef {Object} ExperienceRepository
 * @property {() => Promise<import('./models.js').Experience[]>} listExperiences
 * @property {(slug:string) => Promise<import('./models.js').Experience|undefined>} getExperience
 * @property {(experienceId:string) => Promise<import('./models.js').Batch[]>} getBatches
 * @property {(id:string) => Promise<import('./models.js').ActivityDefinition>} getActivityDefinition
 */
export {};
