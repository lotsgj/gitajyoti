// @ts-check
import { config } from "../../config.js";
import { getBrowserMyGitaDataCache } from "../../data/mygita-data-cache.js";
import { createCachedExperienceRepository } from "./cached-repository.js";

/** @type {import('./contract.js').ExperienceRepository} */
const provider = config.dataProvider === "api"
  ? (await import("./api-provider.js")).experienceApiProvider
  : (await import("./fixture-provider.js")).experienceFixtureProvider;

export const experienceRepository = createCachedExperienceRepository(provider, getBrowserMyGitaDataCache());
