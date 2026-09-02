import { config } from "../config.js";

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(config.sessionStorageKey)) || null; }
  catch { clearSession(); return null; }
}

export function setSession(session) {
  sessionStorage.setItem(config.sessionStorageKey, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(config.sessionStorageKey);
}

export function getAccessToken() {
  return getSession()?.accessToken || "";
}
