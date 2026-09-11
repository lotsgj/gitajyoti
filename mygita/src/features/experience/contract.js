// @ts-check
/**
 * @typedef {Object} ExperienceRepository
 * @property {(options?:{signal?:AbortSignal}) => Promise<import('./models.js').Experience[]>} listExperiences
 * @property {(slug:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').Experience|undefined>} getExperience
 * @property {(experienceId:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').Batch[]>} getBatches
 * @property {(id:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').ActivityDefinition>} getActivityDefinition
 */
export {};
