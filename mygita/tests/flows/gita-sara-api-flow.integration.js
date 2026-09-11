import assert from "node:assert/strict";
import { test } from "node:test";

import { MemorySessionStorage } from "../helpers/session-storage.js";

const apiBaseUrl = process.env.MYGITA_TEST_API_BASE_URL;
if (!apiBaseUrl) throw new Error("MYGITA_TEST_API_BASE_URL is required");
globalThis.sessionStorage = new MemorySessionStorage();
Reflect.set(globalThis, "MYGITA_CONFIG", { apiBaseUrl, dataProvider: "api", requestTimeoutMs: 2000 });

const { createExperienceApiProvider } = await import("../../src/features/experience/api-provider.js");
const { createIdentityApiProvider } = await import("../../src/features/identity/api-provider.js");
const { createJourneyApiProvider } = await import("../../src/features/journey/api-provider.js");

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
