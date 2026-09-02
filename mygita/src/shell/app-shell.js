import { header } from "./header.js";

export function renderShell(root,user=null) {
  root.innerHTML = `<div class="app-shell">${header(user)}<main id="main-content" class="page-container" tabindex="-1"></main><footer class="site-footer"><div class="site-footer__inner"><span>© 2026 Gita Jyoti · Light of the Self Foundation</span><span class="cluster"><a href="#/review">Prototype screen map</a><a href="../">Gita Jyoti home</a></span></div></footer></div>`;
  return root.querySelector("#main-content");
}
