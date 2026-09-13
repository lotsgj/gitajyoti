// @ts-check
/** @typedef {{id?:string,experienceId:string,batchId?:string,activityIds?:string[],completed?:string[]}} Journey */
/** @typedef {{journeyId:string,completedActivityIds:string[]}} ActivityState */
/** @template T @typedef {{status:number,data:T|null,etag:string|null}} ConditionalResult */
/** @typedef {{journeys:Journey[],interests:string[],completed:string[]}} JourneyState */
/**
 * @typedef {Object} JourneyRepository
 * @property {(options?:{signal?:AbortSignal}) => Promise<JourneyState>} getState
 * @property {(options?:{signal?:AbortSignal,etag?:string}) => Promise<ConditionalResult<Journey[]>>} [revalidateJourneys]
 * @property {(options?:{signal?:AbortSignal,etag?:string}) => Promise<ConditionalResult<string[]>>} [revalidateInterests]
 * @property {(options?:{signal?:AbortSignal,etag?:string}) => Promise<ConditionalResult<{items:ActivityState[]}>>} [revalidateActivityState]
 * @property {(experienceId:string,batchId?:string) => Promise<JourneyState>} enrol
 * @property {(experienceId:string) => Promise<JourneyState>} registerInterest
 * @property {(activityId:string) => Promise<JourneyState>} completeActivity
 * @property {() => Promise<void>} reset
 */
export {};
