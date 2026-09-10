// @ts-check
/** @param {import('../features/identity/contract.js').User|null} user */
export function greeting(user = null) {
  const name = user?.personalDetails?.displayName;
  return { title: name ? `Welcome ${name}` : "Welcome Atithi", subtitle: name ? "Truth alone liberates" : "Atithi devobhava 🙏🏼" };
}
