// @ts-check
/** @typedef {{id:string,slug:string,title:string,subtitle:string,shortDescription:string,description:string,designedFor:string[],guidanceMode:string,languages:string[],commitment:{summary:string},delivery:{requiresBatch:boolean},intendedOutcomes:string[],illustration:string,activityIds:string[]}} Experience */
/** @typedef {{id:string,slug:string,title:string,subtitle:string,shortDescription:string,designedFor:string[],guidanceMode:string,illustration:string}} ExperienceCardSummary */
/** @typedef {{id:string,slug:string,detailVersion:string}} ExperienceVersionReference */
/** @typedef {{catalogueVersion:string,generatedAt:string,experiences:ExperienceVersionReference[]}} ExperienceCatalogueManifest */
/** @typedef {{catalogueVersion:string,items:ExperienceCardSummary[]}} ExperienceCatalogueSummary */
/** @template T @typedef {{status:number,data:T|null,etag:string|null}} ConditionalResult */
/** @typedef {{id:string,experienceId:string,name:string,period:string,time:string,state:string}} Batch */
/** @typedef {{id:string,experienceId:string,title:string,type:string,duration:number,description:string,preparation:string,outcome:string}} ActivityDefinition */
export {};
