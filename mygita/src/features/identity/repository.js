// @ts-check
import { config } from "../../config.js";

/** @type {import('./contract.js').IdentityRepository} */
export const identityRepository = config.dataProvider === "api"
  ? (await import("./api-provider.js")).identityApiProvider
  : (await import("./fixture-provider.js")).identityFixtureProvider;
