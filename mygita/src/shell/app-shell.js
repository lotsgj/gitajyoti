// @ts-check
import { header } from "./header.js";

/** @param {HTMLElement} root @param {import('../features/identity/contract.js').User|null} user */
export function renderShell(root,user=null) {
  root.innerHTML = `<div class="app-shell">${header(user)}<main id="main-content" class="page-container" tabindex="-1"></main><footer class="site-footer"><div class="site-footer__inner"><span>© 2026 Gita Jyoti · Light of the Self Foundation</span><span class="cluster"><a href="#/review">Prototype screen map</a><a href="../">Gita Jyoti home</a></span></div></footer></div>`;
  const outlet=root.querySelector("#main-content");
  if(!(outlet instanceof HTMLElement))throw new Error("My Gita page outlet was not found.");
  return outlet;
}
