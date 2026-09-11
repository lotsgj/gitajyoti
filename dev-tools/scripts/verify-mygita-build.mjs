import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot=new URL("../../dist/mygita/",import.meta.url);
const index=await readFile(new URL("index.html",outputRoot),"utf8");
if(index.includes("?provider=")||index.includes("Prototype screen map"))throw new Error("Production index exposes development controls.");
const references=[...index.matchAll(/(?:href|src)="\.\/([^"]+)"/g)].map(match=>match[1]);
if(!references.length)throw new Error("Production index contains no generated assets.");
await Promise.all(references.map(path=>access(new URL(path,outputRoot))));
const assetNames=await readdir(new URL("assets/",outputRoot));
if(!assetNames.some(name=>/^app-[A-Z0-9]+\.js$/i.test(name)))throw new Error("Hashed application bundle is missing.");
if(!assetNames.some(name=>/^site-[A-Z0-9]+\.css$/i.test(name)))throw new Error("Hashed stylesheet is missing.");
const scripts=await Promise.all(assetNames.filter(name=>name.endsWith(".js")).map(name=>readFile(new URL(`assets/${name}`,outputRoot),"utf8")));
const source=scripts.join("\n");
for(const forbidden of ["Prototype screen map","Reset local prototype state","This prototype represents"]){
  if(source.includes(forbidden))throw new Error(`Production bundle contains prototype copy: ${forbidden}`);
}
console.log(`Verified production MyGita build with ${assetNames.length} assets.`);
