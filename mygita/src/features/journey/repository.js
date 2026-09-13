// @ts-check
import { config } from "../../config.js";
import { createCachedJourneyRepository } from "./cached-repository.js";

/** @type {import('./contract.js').JourneyRepository} */
const provider=config.dataProvider === "api"?(await import("./api-provider.js")).journeyApiProvider:(await import("./fixture-provider.js")).journeyFixtureProvider;
export const journeyRepository=config.dataProvider==="api"?createCachedJourneyRepository(provider):provider;
