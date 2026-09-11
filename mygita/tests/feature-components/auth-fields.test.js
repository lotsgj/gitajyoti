import assert from "node:assert/strict";
import { test } from "node:test";

import { passwordField, usernameField } from "../../src/features/identity/components/auth-fields.js";

test("authentication screens share identity-owned credential fields", () => {
  const compact=usernameField();
  const explained=usernameField({label:"Choose a username",withHelp:true});
  for(const markup of [compact,explained]) {
    assert.match(markup,/name="username"/);
    assert.match(markup,/minlength="3"/);
    assert.match(markup,/maxlength="32"/);
  }
  assert.doesNotMatch(compact,/username-help/);
  assert.match(explained,/username-help/);
  assert.match(passwordField("password","Password","current-password"),/data-action="toggle-password"/);
});
