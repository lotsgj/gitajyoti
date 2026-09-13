// @ts-check
import { canonicaliseHashQuery, routeFromHash } from "./url-location.js";

const routes = [];
let activeNavigation=null;
let currentPath="/discover";

export function beginNavigation() {
  activeNavigation?.abort();
  activeNavigation=new AbortController();
  const controller=activeNavigation;
  return {signal:controller.signal,isCurrent:()=>activeNavigation===controller&&!controller.signal.aborted};
}

export function getCurrentPath(){return currentPath;}

export function defineRoute(pattern, load) {
  const keys = [];
  const expression = new RegExp(`^${pattern.replace(/:[^/]+/g, key => { keys.push(key.slice(1)); return "([^/]+)"; })}$`);
  routes.push({ expression, keys, load });
}

export function navigate(path) {
  const hash = `#${normalise(path)}`;
  if (window.location.hash === hash) resolveRoute(); else window.location.hash = hash;
}

export async function resolveRoute() {
  const canonical=canonicaliseHashQuery(window.location.search,window.location.hash);
  if(canonical){
    window.location.replace(`${window.location.pathname}${canonical.search}${canonical.hash}`);
    return;
  }
  const path = normalise(routeFromHash(window.location.hash));
  currentPath=path;
  const navigation=beginNavigation();
  for (const route of routes) {
    const match = path.match(route.expression);
    if (!match) continue;
    const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    return route.load({ path, params, ...navigation });
  }
  return routes.find(route => route.expression.test("/not-found"))?.load({ path, params: {}, ...navigation });
}

export function startRouter() {
  window.addEventListener("hashchange", resolveRoute);
  if (!window.location.hash) window.location.replace(`${window.location.pathname}${window.location.search}#/discover`);
  else resolveRoute();
}

function normalise(path) { return `/${String(path || "").replace(/^\/+|\/+$/g, "")}`; }
