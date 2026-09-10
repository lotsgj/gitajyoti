import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { experienceRepository } from "../../src/features/experience/index.js";
import { identityRepository } from "../../src/features/identity/index.js";
import { journeyRepository } from "../../src/features/journey/index.js";
import { MemorySessionStorage } from "../helpers/session-storage.js";

beforeEach(()=>{globalThis.sessionStorage=new MemorySessionStorage();});

describe("Identity repository contract",()=>{
  test("supports the fixture-backed identity lifecycle",async()=>{assert.equal(await identityRepository.getCurrentUser(),null);const user=await identityRepository.signIn({fullName:"Aruna Rao",displayName:"Aruna",dateOfBirth:"1992-01-02"});assert.equal(user.personalDetails.displayName,"Aruna");assert.equal((await identityRepository.getCurrentUser())?.id,"fixture-user");const updated=await identityRepository.updateProfile({displayName:"Aru"});assert.equal(updated.personalDetails.displayName,"Aru");await identityRepository.signOut();assert.equal(await identityRepository.getCurrentUser(),null);});
});

describe("Experience repository contract",()=>{
  test("lists and resolves catalogue entities asynchronously",async()=>{const experiences=await experienceRepository.listExperiences();assert.ok(experiences.length>0);const item=await experienceRepository.getExperience(experiences[0].slug);assert.equal(item?.id,experiences[0].id);assert.ok(Array.isArray(await experienceRepository.getBatches(experiences[0].id)));const activity=await experienceRepository.getActivityDefinition(experiences[0].activityIds[0]);assert.equal(activity.id,experiences[0].activityIds[0]);});
});

describe("Journey repository contract",()=>{
  test("records interest, enrolment, and activity completion without duplicates",async()=>{await journeyRepository.registerInterest("exp-gita-sara");await journeyRepository.registerInterest("exp-gita-sara");await journeyRepository.enrol("exp-gita-sara","batch-sara-2026-09");await journeyRepository.enrol("exp-gita-sara","batch-sara-2026-09");await journeyRepository.completeActivity("activity-sara-teaching");await journeyRepository.completeActivity("activity-sara-teaching");const state=await journeyRepository.getState();assert.deepEqual(state.interests,["exp-gita-sara"]);assert.equal(state.journeys.length,1);assert.deepEqual(state.completed,["activity-sara-teaching"]);});
});

test("feature fixture providers preserve fields owned by other features",async()=>{await journeyRepository.enrol("exp-gita-sara","batch-sara-2026-09");await identityRepository.signIn({fullName:"Aruna Rao",displayName:"Aruna",dateOfBirth:"1992-01-02"});assert.equal((await journeyRepository.getState()).journeys.length,1);await identityRepository.signOut();assert.equal((await journeyRepository.getState()).journeys.length,1);});
