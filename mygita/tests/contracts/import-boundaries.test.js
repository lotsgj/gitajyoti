import assert from "node:assert/strict";
import { readdir,readFile } from "node:fs/promises";
import { dirname,join,relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const src=join(dirname(fileURLToPath(import.meta.url)),"../../src");
async function filesIn(directory){const entries=await readdir(directory,{withFileTypes:true});return(await Promise.all(entries.map(entry=>entry.isDirectory()?filesIn(join(directory,entry.name)):[join(directory,entry.name)]))).flat();}

test("pages use feature public entry points and never concrete providers",async()=>{for(const file of await filesIn(join(src,"pages"))){const source=await readFile(file,"utf8");assert.doesNotMatch(source,/features\/[^/]+\/(?!index\.js)/,`${relative(src,file)} deep-imports a feature`);assert.doesNotMatch(source,/(fixture-provider|fixture-data|api-provider)/,`${relative(src,file)} imports a provider`);}});

test("features do not depend on pages or another feature",async()=>{for(const feature of ["identity","experience","journey"]){for(const file of await filesIn(join(src,"features",feature))){const source=await readFile(file,"utf8");assert.doesNotMatch(source,/from ["'][^"']*pages\//,`${relative(src,file)} imports a page`);assert.doesNotMatch(source,new RegExp(`features/(?!${feature}/)`),`${relative(src,file)} imports another feature`);}}});

test("core remains domain agnostic",async()=>{for(const file of await filesIn(join(src,"core"))){const source=await readFile(file,"utf8");assert.doesNotMatch(source,/from ["'][^"']*(features|pages|shell)\//,`${relative(src,file)} depends on an outer layer`);}});
