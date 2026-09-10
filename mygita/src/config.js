// @ts-check
const localHosts = new Set(["127.0.0.1", "localhost"]);
const location = globalThis.location;
const host = location?.hostname || "localhost";
const requestedProvider = new URLSearchParams(location?.search || "").get("provider");
const runtimeConfig = /** @type {{apiBaseUrl?:string,dataProvider?:string,requestTimeoutMs?:number}} */ (
  Reflect.get(globalThis, "MYGITA_CONFIG") || {}
);
const dataProvider = runtimeConfig.dataProvider || (requestedProvider === "api" ? "api" : "fixture");

export const config = Object.freeze({
  apiBaseUrl: runtimeConfig.apiBaseUrl || (localHosts.has(host)
    ? "http://127.0.0.1:8081/api/v1"
    : "https://api.gitajyoti.org/api/v1"),
  dataProvider,
  requestTimeoutMs: runtimeConfig.requestTimeoutMs || 10000,
  sessionStorageKey: "mygita.session.v1",
});
