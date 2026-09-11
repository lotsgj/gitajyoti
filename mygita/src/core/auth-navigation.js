// @ts-check
const destinationKey="mygita.pending.destination";

/** @param {string} path */
export function safeInternalPath(path) {
  const value=String(path||"");
  return value.startsWith("/")&&!value.startsWith("//")&&!value.startsWith("/auth")?value:"/discover";
}

/** @param {string} path */
export function rememberDestination(path) {
  sessionStorage.setItem(destinationKey,safeInternalPath(path));
}

export function takeDestination() {
  const destination=safeInternalPath(sessionStorage.getItem(destinationKey)||"");
  sessionStorage.removeItem(destinationKey);
  return destination;
}
