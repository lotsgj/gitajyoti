import assert from "node:assert/strict";
import { test } from "node:test";

import { profileEditor } from "../../src/features/identity/components/profile-editor.js";

test("the same Profile editor serves registration and later editing", () => {
  const registration = profileEditor({}, { afterRegistration: true });
  const later = profileEditor({ displayName: "Aruna" });
  for (const field of ["fullName", "displayName", "dateOfBirth", "email"]) {
    assert.match(registration, new RegExp(`name="${field}"`));
    assert.match(later, new RegExp(`name="${field}"`));
  }
  assert.match(registration, /data-form="onboarding"/);
  assert.match(registration, /data-action="skip-profile"/);
  assert.match(later, /data-form="profile"/);
  assert.doesNotMatch(later, /data-action="skip-profile"/);
  assert.match(registration, /My profile/);
  assert.match(later, /My profile/);
});
