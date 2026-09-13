// @ts-check

/**
 * Returns the route portion of a hash, excluding any hash-local query string.
 * @param {string} hash
 */
export function routeFromHash(hash="") {
  return String(hash).replace(/^#/,"").split("?",1)[0];
}

/**
 * Returns query parameters placed after the hash route.
 * @param {string} hash
 */
export function searchFromHash(hash="") {
  const value=String(hash).replace(/^#/,"");
  const separator=value.indexOf("?");
  return separator<0?"":value.slice(separator+1);
}

/**
 * Moves hash-local parameters into the page query. Existing page parameters
 * take precedence, so canonicalisation cannot silently override them.
 * @param {string} search
 * @param {string} hash
 */
export function canonicaliseHashQuery(search="",hash="") {
  const hashSearch=searchFromHash(hash);
  if(!hashSearch)return null;
  const pageParameters=new URLSearchParams(search);
  for(const [key,value] of new URLSearchParams(hashSearch))if(!pageParameters.has(key))pageParameters.set(key,value);
  const query=pageParameters.toString();
  return {search:query?`?${query}`:"",hash:`#${routeFromHash(hash)}`};
}
