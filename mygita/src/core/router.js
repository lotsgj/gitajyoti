// @ts-check
const routes = [];

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
  const path = normalise(window.location.hash.slice(1));
  for (const route of routes) {
    const match = path.match(route.expression);
    if (!match) continue;
    const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    return route.load({ path, params });
  }
  return routes.find(route => route.expression.test("/not-found"))?.load({ path, params: {} });
}

export function startRouter() {
  window.addEventListener("hashchange", resolveRoute);
  if (!window.location.hash) window.location.replace(`${window.location.pathname}${window.location.search}#/discover`);
  else resolveRoute();
}

function normalise(path) { return `/${String(path || "").replace(/^\/+|\/+$/g, "")}`; }
