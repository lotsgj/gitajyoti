// @ts-check
import { searchFromHash } from "./core/url-location.js";

const localHosts = new Set(["127.0.0.1", "localhost"]);
const embeddedConfig = typeof __MYGITA_BUILD__ === "undefined" ? {} : __MYGITA_BUILD__;
const runtimeConfig = /** @type {{apiBaseUrl?:string,dataProvider?:"fixture"|"api",requestTimeoutMs?:number}} */ (
  Reflect.get(globalThis, "MYGITA_CONFIG") || {}
);

/**
 * @param {{embedded?:typeof embeddedConfig,runtime?:typeof runtimeConfig,location?:Pick<Location,"hostname"|"search"|"hash">}} options
 */
export function resolveClientConfig({embedded={},runtime={},location}={}) {
  const host=location?.hostname||"localhost";
  const pageProvider=new URLSearchParams(location?.search||"").get("provider");
  const hashProvider=new URLSearchParams(searchFromHash(location?.hash||"")).get("provider");
  const requestedProvider=pageProvider||hashProvider;
  const dataProvider=requestedProvider==="fixture"?"fixture":runtime.dataProvider||"api";
  return Object.freeze({
    apiBaseUrl:embedded.apiBaseUrl||runtime.apiBaseUrl||(localHosts.has(host)?"http://127.0.0.1:8081/api/v1":"https://api.gitajyoti.org/api/v1"),
    dataProvider,
    requestTimeoutMs:runtime.requestTimeoutMs||10000,
    sessionStorageKey:"mygita.session.v1",
  });
}

export const config=resolveClientConfig({embedded:embeddedConfig,runtime:runtimeConfig,location:globalThis.location});
