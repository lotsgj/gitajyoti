// @ts-check
const localHosts = new Set(["127.0.0.1", "localhost"]);

export const config = Object.freeze({
  apiBaseUrl: localHosts.has(window.location.hostname)
    ? "http://127.0.0.1:8081/api/v1"
    : "https://api.gitajyoti.org/api/v1",
  dataProvider: "fixture",
  sessionStorageKey: "mygita.session.v1",
});
