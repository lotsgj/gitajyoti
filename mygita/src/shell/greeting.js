// @ts-check
import { ATMAJYOTI_ADDRESS, ATMAJYOTI_INSIGHT, GUIDING_PRINCIPLE } from "../content/mygita-copy.js";

/** @param {import('../features/identity/contract.js').User|null} user */
export function greeting(user = null) {
  const name = user?.personalDetails?.displayName?.trim();
  return {
    title: `Welcome ${ATMAJYOTI_ADDRESS}${name ? ` ${name}` : ""}`,
    subtitle: name ? GUIDING_PRINCIPLE : ATMAJYOTI_INSIGHT,
  };
}
