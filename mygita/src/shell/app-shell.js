// @ts-check
import { header } from "./header.js";
import { config } from "../config.js";

/** @param {HTMLElement} root @param {import('../features/identity/contract.js').User|null} user */
export function renderShell(root,user=null) {
  const developerLink=config.features.developerTools?`<a href="#/review">Development screen map</a>`:"";
  root.innerHTML = `<div class="app-shell">${header(user)}<main id="main-content" class="page-container" tabindex="-1"></main><footer class="site-footer"><div class="site-footer__inner"><span>© 2026 Gita Jyoti · Light of the Self Foundation</span><span class="cluster">${developerLink}<a href="../">Gita Jyoti home</a></span></div></footer></div>`;
  const outlet=root.querySelector("#main-content");
  if(!(outlet instanceof HTMLElement))throw new Error("MyGita page outlet was not found.");
  return outlet;
}
