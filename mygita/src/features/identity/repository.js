// @ts-check
import { config } from "../../config.js";
import { createCachedIdentityRepository } from "./cached-repository.js";

/** @type {import('./contract.js').IdentityRepository} */
const provider=config.dataProvider === "api"?(await import("./api-provider.js")).identityApiProvider:(await import("./fixture-provider.js")).identityFixtureProvider;
export const identityRepository=config.dataProvider==="api"?createCachedIdentityRepository(provider):provider;
