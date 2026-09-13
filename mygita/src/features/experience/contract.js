// @ts-check
/**
 * @typedef {Object} ExperienceRepository
 * @property {(options?:{signal?:AbortSignal,etag?:string}) => Promise<import('./models.js').ConditionalResult<import('./models.js').ExperienceCatalogueManifest>>} revalidateCatalogueManifest
 * @property {(options?:{signal?:AbortSignal}) => Promise<import('./models.js').ExperienceCatalogueManifest>} getCatalogueManifest
 * @property {(options?:{signal?:AbortSignal}) => Promise<import('./models.js').ExperienceCatalogueSummary>} listExperienceSummaries
 * @property {(options?:{signal?:AbortSignal}) => Promise<import('./models.js').Experience[]>} listExperiences
 * @property {(slug:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').Experience|undefined>} getExperience
 * @property {(experienceId:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').Batch[]>} getBatches
 * @property {(id:string,options?:{signal?:AbortSignal}) => Promise<import('./models.js').ActivityDefinition>} getActivityDefinition
 */
export {};
