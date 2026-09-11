// @ts-check
/** @typedef {{experienceId:string,batchId?:string,completed?:string[]}} Journey */
/** @typedef {{journeys:Journey[],interests:string[],completed:string[]}} JourneyState */
/**
 * @typedef {Object} JourneyRepository
 * @property {(options?:{signal?:AbortSignal}) => Promise<JourneyState>} getState
 * @property {(experienceId:string,batchId?:string) => Promise<JourneyState>} enrol
 * @property {(experienceId:string) => Promise<JourneyState>} registerInterest
 * @property {(activityId:string) => Promise<JourneyState>} completeActivity
 * @property {() => Promise<void>} reset
 */
export {};
