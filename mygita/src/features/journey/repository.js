// @ts-check
import { config } from "../../config.js";

/** @type {import('./contract.js').JourneyRepository} */
export const journeyRepository=config.dataProvider === "api"
  ? (await import("./api-provider.js")).journeyApiProvider
  : (await import("./fixture-provider.js")).journeyFixtureProvider;
