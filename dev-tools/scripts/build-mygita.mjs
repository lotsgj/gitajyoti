import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const toolsRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const repositoryRoot=resolve(toolsRoot,"..");
const clientRoot=resolve(repositoryRoot,"mygita");
const outputRoot=resolve(repositoryRoot,"dist","mygita");
const apiBaseUrl=process.env.MYGITA_API_BASE_URL||"https://api.gitajyoti.org/api/v1";

await rm(outputRoot,{recursive:true,force:true});
await mkdir(outputRoot,{recursive:true});

const result=await build({
  absWorkingDir:clientRoot,
  bundle:true,
  define:{__MYGITA_BUILD__:JSON.stringify({mode:"production",apiBaseUrl})},
  entryNames:"assets/[name]-[hash]",
  entryPoints:{app:"src/app.js",site:"styles/site.css"},
  format:"esm",
  legalComments:"none",
  metafile:true,
  minify:true,
  outdir:outputRoot,
  platform:"browser",
  sourcemap:false,
  target:["es2022"],
});

const entries=Object.entries(result.metafile.outputs);
const assetFor=(entryPoint)=>{
  const match=entries.find(([,metadata])=>metadata.entryPoint===entryPoint);
  if(!match)throw new Error(`Production asset was not generated for ${entryPoint}.`);
  return relative(outputRoot,resolve(clientRoot,match[0])).replaceAll("\\","/");
};
const script=assetFor("src/app.js");
const stylesheet=assetFor("styles/site.css");
const index=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="MyGita — guided learning journeys into the wisdom of the Bhagavad Gita.">
  <meta name="theme-color" content="#0b3440">
  <title>MyGita</title>
  <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./${stylesheet}">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div id="app" class="app-root"></div>
  <noscript><p class="noscript">MyGita requires JavaScript to navigate the learning experience.</p></noscript>
  <script type="module" src="./${script}"></script>
</body>
</html>
`;
await mkdir(resolve(outputRoot,"assets"),{recursive:true});
await cp(resolve(clientRoot,"public","favicon.svg"),resolve(outputRoot,"assets","favicon.svg"));
await writeFile(resolve(outputRoot,"index.html"),index);
console.log(`Built production MyGita in ${relative(repositoryRoot,outputRoot)}/ using ${apiBaseUrl}.`);
