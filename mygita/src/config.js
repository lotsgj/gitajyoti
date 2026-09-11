// @ts-check
const localHosts = new Set(["127.0.0.1", "localhost"]);
const embeddedConfig = typeof __MYGITA_BUILD__ === "undefined" ? {} : __MYGITA_BUILD__;
const runtimeConfig = /** @type {{mode?:"development"|"test"|"production",apiBaseUrl?:string,dataProvider?:"fixture"|"api",requestTimeoutMs?:number,features?:{developerTools?:boolean,prototypeOtp?:boolean}}} */ (
  Reflect.get(globalThis, "MYGITA_CONFIG") || {}
);

/**
 * @param {{embedded?:typeof embeddedConfig,runtime?:typeof runtimeConfig,location?:Pick<Location,"hostname"|"search">}} options
 */
export function resolveClientConfig({embedded={},runtime={},location}={}) {
  const host=location?.hostname||"localhost";
  const mode=embedded.mode||runtime.mode||"development";
  const production=mode==="production";
  const requestedProvider=production?null:new URLSearchParams(location?.search||"").get("provider");
  const dataProvider=production?"api":runtime.dataProvider||(requestedProvider==="api"?"api":"fixture");
  return Object.freeze({
    mode,
    production,
    apiBaseUrl:embedded.apiBaseUrl||runtime.apiBaseUrl||(localHosts.has(host)?"http://127.0.0.1:8081/api/v1":"https://api.gitajyoti.org/api/v1"),
    dataProvider,
    requestTimeoutMs:runtime.requestTimeoutMs||10000,
    sessionStorageKey:"mygita.session.v1",
    features:Object.freeze({
      developerTools:!production&&runtime.features?.developerTools!==false,
      prototypeOtp:!production&&runtime.features?.prototypeOtp!==false,
    }),
  });
}

export const config=resolveClientConfig({embedded:embeddedConfig,runtime:runtimeConfig,location:globalThis.location});
