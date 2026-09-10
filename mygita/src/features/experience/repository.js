// @ts-check
import { config } from "../../config.js";

/** @type {import('./contract.js').ExperienceRepository} */
export const experienceRepository = config.dataProvider === "api"
  ? (await import("./api-provider.js")).experienceApiProvider
  : (await import("./fixture-provider.js")).experienceFixtureProvider;
