export function greeting(user = null) {
  const name = user?.personalDetails?.displayName;
  return { title: name ? `Welcome ${name}` : "Welcome Atithi", subtitle: name ? "Truth alone liberates" : "Atithi devobhava 🙏🏼" };
}
