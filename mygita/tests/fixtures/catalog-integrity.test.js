import assert from "node:assert/strict";
import { test } from "node:test";
import { activities,batches,experiences,experienceVersions } from "../../src/features/experience/fixture-data.js";

test("fixture identifiers and relationships are valid",()=>{const experienceIds=new Set(experiences.map(item=>item.id));const slugs=new Set(experiences.map(item=>item.slug));assert.equal(experienceIds.size,experiences.length,"experience ids must be unique");assert.equal(slugs.size,experiences.length,"experience slugs must be unique");for(const batch of batches)assert.ok(experienceIds.has(batch.experienceId),`unknown batch experience ${batch.experienceId}`);for(const activity of activities)assert.ok(experienceIds.has(activity.experienceId),`unknown activity experience ${activity.experienceId}`);const activityIds=new Set(activities.map(item=>item.id));for(const experience of experiences){for(const activityId of experience.activityIds){if(experience.id==="exp-gita-sara")assert.ok(activityIds.has(activityId),`missing implemented activity ${activityId}`);}}});

test("every fixture Experience has one opaque detail version",()=>{
  assert.ok(experienceVersions.catalogueVersion);
  assert.ok(experienceVersions.generatedAt);
  assert.deepEqual(Object.keys(experienceVersions.details).sort(),experiences.map(item=>item.id).sort());
  assert.ok(Object.values(experienceVersions.details).every(version=>typeof version==="string"&&version.length>0));
});
