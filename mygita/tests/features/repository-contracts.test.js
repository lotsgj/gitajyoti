import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { createExperienceApiProvider } from "../../src/features/experience/api-provider.js";
import { experienceFixtureProvider } from "../../src/features/experience/fixture-provider.js";
import { createIdentityApiProvider } from "../../src/features/identity/api-provider.js";
import { identityFixtureProvider } from "../../src/features/identity/fixture-provider.js";
import { createJourneyApiProvider } from "../../src/features/journey/api-provider.js";
import { journeyFixtureProvider } from "../../src/features/journey/fixture-provider.js";
import { MemorySessionStorage } from "../helpers/session-storage.js";

beforeEach(() => { globalThis.sessionStorage = new MemorySessionStorage(); });

async function assertIdentityContract(repository) {
  assert.equal(await repository.getCurrentUser(), null);
  const authenticated = await repository.createPasswordAccount({ username: "Aruna.Rao", password: "a long fixture passphrase" });
  assert.equal(authenticated.user.onboarding?.state, "pending");
  await repository.signOut();
  assert.equal(await repository.getCurrentUser(), null);
  const signedIn = await repository.loginWithPassword({ username: "ARUNA.RAO", password: "a long fixture passphrase" });
  assert.equal(signedIn.isNewUser, false);
  const user = await repository.completeOnboarding({ fullName: "Aruna Rao", displayName: "Aruna", dateOfBirth: "1992-01-02" });
  assert.equal(user.personalDetails.displayName, "Aruna");
  assert.ok((await repository.getCurrentUser())?.id);
  const updated = await repository.updateProfile({ displayName: "Aru" });
  assert.equal(updated.personalDetails.displayName, "Aru");
  await assert.rejects(repository.createPasswordAccount({ username: "aruna.rao", password: "another long passphrase" }));
}

async function assertExperienceContract(repository) {
  const manifest = await repository.getCatalogueManifest();
  const summaries = await repository.listExperienceSummaries();
  assert.equal(manifest.catalogueVersion, summaries.catalogueVersion);
  assert.ok(manifest.generatedAt);
  assert.equal(manifest.experiences.length, summaries.items.length);
  assert.ok(manifest.experiences.every((item) => item.detailVersion));
  assert.deepEqual(
    manifest.experiences.map((item) => item.id),
    summaries.items.map((item) => item.id),
  );
  const experiences = await repository.listExperiences();
  assert.ok(experiences.length > 0);
  const item = await repository.getExperience(experiences[0].slug);
  assert.equal(item?.id, experiences[0].id);
  assert.ok(Array.isArray(await repository.getBatches(experiences[0].id)));
  const activity = await repository.getActivityDefinition(experiences[0].activityIds[0]);
  assert.equal(activity.id, experiences[0].activityIds[0]);
}

async function assertJourneyContract(repository) {
  await repository.registerInterest("exp-gita-sara");
  await repository.registerInterest("exp-gita-sara");
  await repository.enrol("exp-gita-sara", "batch-sara-2026-09");
  await repository.enrol("exp-gita-sara", "batch-sara-2026-09");
  await repository.completeActivity("activity-sara-teaching");
  await repository.completeActivity("activity-sara-teaching");
  const state = await repository.getState();
  assert.deepEqual(state.interests, ["exp-gita-sara"]);
  assert.equal(state.journeys.length, 1);
  assert.deepEqual(state.completed, ["activity-sara-teaching"]);
}

function createApiHarness() {
  const experience = {
    id: "exp-gita-sara", slug: "gita-sara", title: "Gita Sāra", subtitle: "The essence of the Gita",
    shortDescription: "A structured exploration.", description: "Guided teaching and reflection.",
    designedFor: ["Adults"], guidanceMode: "acharya-guided", languages: ["English"],
    commitment: { summary: "Structured journey" }, delivery: { requiresBatch: true },
    intendedOutcomes: ["Understand the teaching."], image: { src: "placeholders/gita-sara" },
    constituentActivityIds: ["activity-sara-teaching"],
  };
  const activity = {
    id: "activity-sara-teaching", experienceId: experience.id, title: "Foundational Teaching",
    activityType: "teaching", recommendedDurationMinutes: 75, description: "Study selected shlokas.",
    preparation: "Read and note questions.", intendedOutcome: "Understand the teaching.",
  };
  const batch = {
    id: "batch-sara-2026-09", experienceId: experience.id, name: "Gita Sāra — September 2026",
    timezone: "Asia/Kolkata", batchPeriod: { startsOn: "2026-09-19", endsOn: "2027-03-27" },
    enrolment: { state: "open" },
  };
  let user = null;
  const accounts = new Map();
  const journeys = [];
  const interests = [];
  const completed = [];
  const apiJourney = () => ({ experienceId: experience.id, batchId: batch.id, completedActivityIds: [...completed] });
  const request = async (path, options = {}) => {
    const method = options.method || "GET";
    if (path === "/experience-catalogue/manifest") return {
      catalogueVersion: "api-catalogue-1",
      generatedAt: "2026-09-12T00:00:00Z",
      experiences: [{ id: experience.id, slug: experience.slug, detailVersion: "api-gita-sara-1" }],
    };
    if (path === "/experience-catalogue/summaries") return {
      catalogueVersion: "api-catalogue-1",
      items: [{
        id: experience.id,
        slug: experience.slug,
        title: experience.title,
        subtitle: experience.subtitle,
        shortDescription: experience.shortDescription,
        image: experience.image,
        designedFor: experience.designedFor,
        guidanceMode: experience.guidanceMode,
      }],
    };
    if (path === "/experiences") return { items: [experience] };
    if (path === "/experiences/gita-sara") return experience;
    if (path === `/experiences/${experience.id}/batches`) return { items: [batch] };
    if (path === `/me/activities/${activity.id}` && method === "GET") return { ...activity, completed: completed.includes(activity.id), session: null };
    if (path === "/auth/otp/request") return { challengeId: "api-challenge", expiresInSeconds: 300, prototypeOtp: "123456" };
    if (path === "/auth/otp/verify") {
      user = { id: "user-api", roles: ["learner"], personalDetails: { fullName: "", displayName: "", dateOfBirth: "" }, onboarding: { state: "pending" } };
      return { accessToken: "api-token", expiresIn: 28800, isNewUser: true, user };
    }
    if (path === "/auth/accounts") {
      const username = options.body.username.trim().toLowerCase();
      if (accounts.has(username)) throw new Error("Choose a different username.");
      user = { id: `user-${username}`, roles: ["learner"], personalDetails: { fullName: "", displayName: "", dateOfBirth: "" }, onboarding: { state: "pending" } };
      accounts.set(username, { password: options.body.password, user });
      return { accessToken: "api-token", expiresIn: 28800, isNewUser: true, user };
    }
    if (path === "/auth/password/login") {
      const account = accounts.get(options.body.username.trim().toLowerCase());
      if (!account || account.password !== options.body.password) throw new Error("Username or password is incorrect.");
      user = account.user;
      return { accessToken: "api-token", expiresIn: 28800, isNewUser: false, user };
    }
    if (path === "/me/onboarding") { user = { ...user, personalDetails: { ...user.personalDetails, ...options.body }, onboarding: { state: "complete" } }; return user; }
    if (path === "/me" && method === "PATCH") { user = { ...user, personalDetails: { ...user.personalDetails, ...options.body } }; return user; }
    if (path === "/me") return user;
    if (path === "/me/journeys") return {status:200,etag:'W/"journeys-1"',data:{items:journeys.map((_item,index)=>({id:`journey-${index+1}`,userId:user.id,experienceId:experience.id,batchId:batch.id,status:"active",startedOn:"2026-09-10",lastAccessed:"2026-09-10T00:00:00Z",currentContext:"Foundations",activityIds:[activity.id],completedActivityIds:[...completed]}))}};
    if (path === "/me/interests" && method === "GET") return {status:200,etag:'"interests-1"',data:{items:interests.map((experienceId,index)=>({id:`interest-${index+1}`,userId:user.id,experienceId,registeredAt:"2026-09-10T00:00:00Z"}))}};
    if (path === "/me/activity-state") return {status:200,etag:'"activity-1"',data:{items:journeys.map((_item,index)=>({journeyId:`journey-${index+1}`,completedActivityIds:[...completed]}))}};
    if (path === "/me/journey" && method === "GET") return { items: journeys.map(apiJourney), interests: interests.map((experienceId) => ({ experienceId })) };
    if (path === "/me/journey" && method === "POST") { journeys.push({}); return apiJourney(); }
    if (path === "/me/interests") { interests.push(options.body.experienceId); return { experienceId: options.body.experienceId }; }
    if (path.endsWith("/complete")) { if (!completed.includes(activity.id)) completed.push(activity.id); return apiJourney(); }
    throw new Error(`Unexpected fake API request: ${method} ${path}`);
  };
  return {
    experience: createExperienceApiProvider(request),
    identity: createIdentityApiProvider(request),
    journey: createJourneyApiProvider(request),
  };
}

describe("fixture providers", () => {
  test("Identity repository contract", () => assertIdentityContract(identityFixtureProvider));
  test("Experience repository contract", () => assertExperienceContract(experienceFixtureProvider));
  test("Journey repository contract", () => assertJourneyContract(journeyFixtureProvider));
});

describe("API providers", () => {
  test("Identity repository contract", async () => assertIdentityContract(createApiHarness().identity));
  test("Experience repository contract", async () => {
    const harness = createApiHarness();
    const challenge = await harness.identity.requestOtp("9876543210");
    await harness.identity.verifyOtp(challenge.challengeId, "123456");
    await assertExperienceContract(harness.experience);
  });
  test("Journey repository contract", async () => {
    const harness = createApiHarness();
    const challenge = await harness.identity.requestOtp("9876543210");
    await harness.identity.verifyOtp(challenge.challengeId, "123456");
    await assertJourneyContract(harness.journey);
  });
});

test("OTP remains available as a compatibility authentication method", async () => {
  const challenge = await identityFixtureProvider.requestOtp("9876543210");
  assert.ok(challenge.challengeId);
  const authenticated = await identityFixtureProvider.verifyOtp(challenge.challengeId, "123456");
  assert.equal(authenticated.user.onboarding?.state, "pending");
});

test("feature fixture providers preserve fields owned by other features", async () => {
  await journeyFixtureProvider.enrol("exp-gita-sara", "batch-sara-2026-09");
  const challenge = await identityFixtureProvider.requestOtp("9876543210");
  await identityFixtureProvider.verifyOtp(challenge.challengeId, "123456");
  await identityFixtureProvider.completeOnboarding({ fullName: "Aruna Rao", displayName: "Aruna", dateOfBirth: "1992-01-02" });
  assert.equal((await journeyFixtureProvider.getState()).journeys.length, 1);
  await identityFixtureProvider.signOut();
  assert.equal((await journeyFixtureProvider.getState()).journeys.length, 1);
});
