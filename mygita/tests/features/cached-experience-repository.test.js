import assert from "node:assert/strict";
import { test } from "node:test";

import { createMemoryDocumentStore } from "../../src/core/cache/memory-document-store.js";
import { createMyGitaDataCache } from "../../src/data/mygita-data-cache.js";
import { createCachedExperienceRepository } from "../../src/features/experience/cached-repository.js";
import { createExperienceApiProvider } from "../../src/features/experience/api-provider.js";
import { experienceFixtureProvider } from "../../src/features/experience/fixture-provider.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness() {
  let clock = 1;
  let manifestVersion = "manifest-1";
  let catalogueVersion = "catalogue-1";
  let failManifest = false;
  const calls = [];
  const summary = { id:"exp-one",slug:"one",title:"One",subtitle:"One path",shortDescription:"One summary",designedFor:["All"],guidanceMode:"self-guided",illustration:"one" };
  const detail = { ...summary,description:"Full detail",languages:["English"],commitment:{summary:"One hour"},delivery:{requiresBatch:false},intendedOutcomes:["Learn"],activityIds:[] };
  const manifest = () => ({ catalogueVersion,generatedAt:"2026-09-12T00:00:00Z",experiences:[{id:"exp-one",slug:"one",detailVersion:"detail-1"}] });
  const provider = {
    async revalidateCatalogueManifest({etag}={}) { calls.push(["manifest",etag]); if(failManifest)throw new Error("offline"); return etag===manifestVersion?{status:304,data:null,etag}:{status:200,data:manifest(),etag:manifestVersion}; },
    async listExperienceSummaries() { calls.push(["summaries"]); return {catalogueVersion,items:[summary]}; },
    async getExperience(slug) { calls.push(["detail",slug]); return detail; },
    async getCatalogueManifest(){return manifest();}, async listExperiences(){return [detail];}, async getBatches(){return [];}, async getActivityDefinition(){throw new Error("unused");},
  };
  const cache = createMyGitaDataCache(createMemoryDocumentStore(), { now:()=>clock });
  return { repository:createCachedExperienceRepository(provider,cache,{now:()=>clock}),calls,advance(){clock+=2000;},changeCatalogue(){catalogueVersion="catalogue-2";manifestVersion="manifest-2";},fail(){failManifest=true;} };
}

test("first Discover fetches manifest and summaries; returning Discover only revalidates manifest", async () => {
  const testHarness=harness();
  assert.equal((await testHarness.repository.listExperienceSummaries()).items.length,1);
  assert.deepEqual(testHarness.calls.map(item=>item[0]),["manifest","summaries"]);
  testHarness.advance();
  assert.equal((await testHarness.repository.listExperienceSummaries()).items.length,1);
  await tick();
  assert.deepEqual(testHarness.calls.map(item=>item[0]),["manifest","summaries","manifest"]);
});

test("an unchanged previously browsed Experience needs no second detail response", async () => {
  const testHarness=harness();
  assert.equal((await testHarness.repository.getExperience("one"))?.id,"exp-one");
  assert.equal((await testHarness.repository.getExperience("one"))?.id,"exp-one");
  assert.deepEqual(testHarness.calls.map(item=>item[0]),["manifest","detail","manifest"]);
});

test("a changed catalogue refreshes summaries without blocking cached rendering", async () => {
  const testHarness=harness();
  await testHarness.repository.listExperienceSummaries();
  testHarness.advance();
  testHarness.changeCatalogue();
  assert.equal((await testHarness.repository.listExperienceSummaries()).catalogueVersion,"catalogue-1");
  await tick();
  assert.equal((await testHarness.repository.listExperienceSummaries()).catalogueVersion,"catalogue-2");
  assert.equal(testHarness.calls.filter(item=>item[0]==="summaries").length,2);
});

test("a background failure preserves cached summaries and exposes non-blocking state", async () => {
  const testHarness=harness();
  await testHarness.repository.listExperienceSummaries();
  testHarness.advance();
  testHarness.fail();
  assert.equal((await testHarness.repository.listExperienceSummaries()).items.length,1);
  await tick();
  assert.equal(testHarness.repository.getPublicRefreshState().state,"error");
  assert.equal((await testHarness.repository.listExperienceSummaries()).items.length,1);
});

test("fixture and API providers obey the same cache-aware Experience behavior", async () => {
  const apiSummary={id:"exp-one",slug:"one",title:"One",subtitle:"One path",shortDescription:"One summary",designedFor:["All"],guidanceMode:"self-guided",image:{src:"/one.webp"}};
  const apiDetail={...apiSummary,description:"Full detail",languages:["English"],commitment:{summary:"One hour"},delivery:{requiresBatch:false},intendedOutcomes:["Learn"],constituentActivityIds:[]};
  const calls=[];
  const api=createExperienceApiProvider(async(path,options={})=>{
    calls.push(path);
    if(path.endsWith("/manifest"))return options.metadata?{status:200,data:{catalogueVersion:"catalogue-1",generatedAt:"2026-09-12T00:00:00Z",experiences:[{id:"exp-one",slug:"one",detailVersion:"detail-1"}]},etag:"manifest-1"}:{catalogueVersion:"catalogue-1",generatedAt:"2026-09-12T00:00:00Z",experiences:[{id:"exp-one",slug:"one",detailVersion:"detail-1"}]};
    if(path.endsWith("/summaries"))return{catalogueVersion:"catalogue-1",items:[apiSummary]};
    if(path.endsWith("/experiences/one"))return apiDetail;
    throw new Error(`Unexpected API path: ${path}`);
  });
  for(const provider of [experienceFixtureProvider,api]){
    const repository=createCachedExperienceRepository(provider,createMyGitaDataCache(createMemoryDocumentStore()));
    assert.ok((await repository.listExperienceSummaries()).items.length>0);
    const slug=(await repository.listExperienceSummaries()).items[0].slug;
    assert.ok(await repository.getExperience(slug));
    assert.ok(await repository.getExperience(slug));
  }
  assert.equal(calls.filter(path=>path.endsWith("/summaries")).length,1);
  assert.equal(calls.filter(path=>path.endsWith("/experiences/one")).length,1);
});
