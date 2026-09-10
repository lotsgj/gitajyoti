// @ts-check
import { config } from "../config.js";

export function getSession() {
  try { const saved=sessionStorage.getItem(config.sessionStorageKey); return saved?JSON.parse(saved):null; }
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

export function hasSession() {
  return Boolean(getAccessToken());
}
