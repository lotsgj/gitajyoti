import assert from "node:assert/strict";
import { test } from "node:test";

import { MemorySessionStorage } from "../helpers/session-storage.js";
import { verifyRequestBudget } from "../helpers/request-budget.js";
import { requestBudgets } from "../request-budgets.js";

const apiBaseUrl = process.env.MYGITA_TEST_API_BASE_URL;
if (!apiBaseUrl) throw new Error("MYGITA_TEST_API_BASE_URL is required");
globalThis.sessionStorage = new MemorySessionStorage();
Reflect.set(globalThis, "MYGITA_CONFIG", { apiBaseUrl, dataProvider: "api", requestTimeoutMs: 2000 });

const { createExperienceApiProvider } = await import("../../src/features/experience/api-provider.js");
const { createIdentityApiProvider } = await import("../../src/features/identity/api-provider.js");
const { createJourneyApiProvider } = await import("../../src/features/journey/api-provider.js");
const { createCachedExperienceRepository } = await import("../../src/features/experience/cached-repository.js");
const { createMemoryDocumentStore } = await import("../../src/core/cache/memory-document-store.js");
const { createMyGitaDataCache } = await import("../../src/data/mygita-data-cache.js");
const { identityRepository } = await import("../../src/features/identity/repository.js");
const { journeyRepository } = await import("../../src/features/journey/repository.js");
const { getAccessToken, getSession, hasSession, setSession } = await import("../../src/core/session.js");
const { invalidateAccountManifest } = await import("../../src/data/account-data-coordinator.js");

test("Gita Sāra works through runtime-validated API providers", async () => {
  const identity = createIdentityApiProvider();
  const experience = createExperienceApiProvider();
  const journey = createJourneyApiProvider();

  const catalogue = await experience.listExperiences();
  const gitaSara = catalogue.find((item) => item.id === "exp-gita-sara");
  assert.equal(gitaSara?.slug, "gita-sara");
  assert.equal((await experience.getExperience("gita-sara"))?.id, "exp-gita-sara");

  const challenge = await identity.requestOtp("9876543210");
  const authentication = await identity.verifyOtp(challenge.challengeId, "123456");
  assert.equal(authentication.isNewUser, true);
  assert.equal(authentication.user.onboarding?.state, "pending");

  const user = await identity.completeOnboarding({
    fullName: "Aruna Rao",
    displayName: "Aruna",
    dateOfBirth: "1992-01-02",
  });
  assert.equal(user.onboarding?.state, "complete");

  const batches = await experience.getBatches("exp-gita-sara");
  assert.equal(batches[0].id, "batch-sara-2026-09");
  let state = await journey.enrol("exp-gita-sara", batches[0].id);
  assert.equal(state.journeys.length, 1);

  const activityId = gitaSara.activityIds[0];
  const activity = await experience.getActivityDefinition(activityId);
  assert.equal(activity.id, "activity-sara-teaching");
  state = await journey.completeActivity(activityId);
  assert.deepEqual(state.completed, [activityId]);

  const updated = await identity.updateProfile({ displayName: "Aru" });
  assert.equal(updated.personalDetails.displayName, "Aru");
  await identity.signOut();
  assert.equal(await identity.getCurrentUser(), null);
});

test("password account survives optional Profile skip, sign-out, and sign-in", async () => {
  const identity = createIdentityApiProvider();
  const experience = createExperienceApiProvider();
  const journey = createJourneyApiProvider();
  const credentials = {
    username: "aruna.browser.flow",
    password: "a memorable gita phrase",
  };

  const registration = await identity.createPasswordAccount(credentials);
  assert.equal(registration.isNewUser, true);
  assert.equal(registration.user.onboarding?.state, "pending");
  assert.equal((await identity.getCurrentUser())?.id, registration.user.id);

  // Skipping optional Profile setup deliberately makes no Profile API call.
  // Access to the signed-in experience and Journey must remain available.
  const gitaSara = await experience.getExperience("gita-sara");
  assert.equal(gitaSara?.id, "exp-gita-sara");
  const batches = await experience.getBatches(gitaSara.id);
  let state = await journey.enrol(gitaSara.id, batches[0].id);
  assert.equal(state.journeys[0]?.experienceId, gitaSara.id);

  await identity.signOut();
  assert.equal(await identity.getCurrentUser(), null);

  const login = await identity.loginWithPassword(credentials);
  assert.equal(login.isNewUser, false);
  assert.equal(login.user.id, registration.user.id);
  assert.equal(login.user.onboarding?.state, "pending");
  state = await journey.getState();
  assert.equal(state.journeys[0]?.experienceId, gitaSara.id);
});

test("public Experience cache meets returning-visit request budgets against Flask", async () => {
  const nativeFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ path:new URL(url).pathname, ifNoneMatch:options?.headers?.["If-None-Match"] });
    return nativeFetch(url, options);
  };
  let now=1;
  const cache=createMyGitaDataCache(createMemoryDocumentStore(),{now:()=>now});
  const experience=createCachedExperienceRepository(createExperienceApiProvider(),cache,{now:()=>now});
  try {
    await experience.listExperienceSummaries();
    verifyRequestBudget("Live Flask · cold Discover",requests.map(item=>({method:"GET",path:item.path})),requestBudgets.coldDiscover);

    requests.length=0;
    now+=2000;
    await experience.listExperienceSummaries();
    await new Promise(resolve=>setTimeout(resolve,25));
    verifyRequestBudget("Live Flask · warm unchanged Discover",requests.map(item=>({method:"GET",path:item.path})),requestBudgets.warmDiscover);
    assert.ok(requests.at(-1).ifNoneMatch?.startsWith("W/"));

    requests.length=0;
    await experience.getExperience("gita-sara");
    await experience.getExperience("gita-sara");
    verifyRequestBudget("Live Flask · repeated Experience detail",requests.map(item=>({method:"GET",path:item.path})),requestBudgets.repeatedExperience);
  } finally {
    globalThis.fetch=nativeFetch;
  }
});

test("authenticated mutations use their responses without follow-up Journey reads", async () => {
  const nativeFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({path:new URL(url).pathname,method:options?.method||"GET"});return nativeFetch(url,options);};
  try{
    const identity=createIdentityApiProvider();
    const journey=createJourneyApiProvider();
    await identity.createPasswordAccount({username:"request.budget.user",password:"a memorable request budget phrase"});
    requests.length=0;
    await journey.enrol("exp-gita-sara","batch-sara-2026-09");
    await journey.registerInterest("exp-purna-yoga");
    await journey.completeActivity("activity-sara-teaching");
    verifyRequestBudget("Live Flask · mutation responses avoid redundant reads",requests,requestBudgets.mutationResponseReuse);
  }finally{globalThis.fetch=nativeFetch;}
});

test("composed repositories share one private manifest and reuse Account projections", async()=>{
  const nativeFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({path:new URL(url).pathname,method:options?.method||"GET"});return nativeFetch(url,options);};
  try{
    await identityRepository.createPasswordAccount({username:"private.cache.user",password:"a memorable private cache phrase"});
    requests.length=0;
    const firstUser=await identityRepository.getCurrentUser();
    const secondUser=await identityRepository.getCurrentUser();
    assert.equal(firstUser?.id,secondUser?.id);
    await journeyRepository.getState();
    await journeyRepository.getState();
    verifyRequestBudget("Live Flask · first private-data composition",requests,requestBudgets.firstPrivateComposition);
    requests.length=0;
    await journeyRepository.enrol("exp-gita-sara","batch-sara-2026-09");
    await journeyRepository.getState();
    await journeyRepository.registerInterest("exp-purna-yoga");
    await journeyRepository.getState();
    await journeyRepository.completeActivity("activity-sara-teaching");
    await journeyRepository.getState();
    assert.equal(requests.filter(item=>item.method==="GET"&&(item.path.endsWith("/me/journeys")||item.path.endsWith("/me/interests")||item.path.endsWith("/me/activity-state"))).length,0);
  }finally{await identityRepository.signOut();globalThis.fetch=nativeFetch;}
});

test("external version changes refresh only their matching private projection",async()=>{
  const nativeFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({path:new URL(url).pathname,method:options?.method||"GET"});return nativeFetch(url,options);};
  try{
    await identityRepository.createPasswordAccount({username:"selective.cache.user",password:"a memorable selective cache phrase"});
    await identityRepository.getCurrentUser();
    await journeyRepository.getState();
    requests.length=0;
    const authorization=`Bearer ${getAccessToken()}`;
    await nativeFetch(`${apiBaseUrl}/me/interests`,{method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify({experienceId:"exp-purna-yoga"})});
    await invalidateAccountManifest();
    await journeyRepository.getState();
    await new Promise(resolve=>setTimeout(resolve,25));
    verifyRequestBudget("Live Flask · selective interest refresh",requests,requestBudgets.selectiveInterestRefresh);

    requests.length=0;
    await nativeFetch(`${apiBaseUrl}/me`,{method:"PATCH",headers:{Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify({city:"Mysuru"})});
    await invalidateAccountManifest();
    await identityRepository.getCurrentUser();
    await new Promise(resolve=>setTimeout(resolve,25));
    await journeyRepository.getState();
    verifyRequestBudget("Live Flask · selective Profile refresh",requests,requestBudgets.selectiveProfileRefresh);
  }finally{await identityRepository.signOut();globalThis.fetch=nativeFetch;}
});

test("Account switching never composes another Account's private projections",async()=>{
  const first={username:"private.cache.user",password:"a memorable private cache phrase"};
  const second={username:"selective.cache.user",password:"a memorable selective cache phrase"};
  await identityRepository.loginWithPassword(first);
  const firstState=await journeyRepository.getState();
  assert.equal(firstState.journeys.length,1);
  await identityRepository.signOut();

  await identityRepository.loginWithPassword(second);
  assert.equal((await journeyRepository.getState()).journeys.length,0);
  await identityRepository.signOut();

  await identityRepository.loginWithPassword(first);
  assert.equal((await journeyRepository.getState()).journeys.length,1);
  await identityRepository.signOut();
});

test("a rejected token ends the session and prevents cached private projection reuse",async()=>{
  await identityRepository.loginWithPassword({username:"request.budget.user",password:"a memorable request budget phrase"});
  await identityRepository.getCurrentUser();
  await journeyRepository.getState();
  setSession({...getSession(),accessToken:"invalid-token"});
  await invalidateAccountManifest();
  // Saved data may render first; the background authorization check must then
  // end the invalid session and make subsequent private reads empty.
  await journeyRepository.getState();
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(hasSession(),false);
  assert.deepEqual(await journeyRepository.getState(),{journeys:[],interests:[],completed:[]});
});
