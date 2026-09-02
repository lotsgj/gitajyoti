const listeners = new Set();
let state = Object.freeze({ route: null, user: null, navigationOpen: false, pendingMobile: "", pendingChallenge: "" });

export function getState() { return state; }
export function setState(patch) { state = Object.freeze({ ...state, ...patch }); listeners.forEach(listener => listener(state)); }
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
