import assert from "node:assert/strict";
import { test } from "node:test";

import { button } from "../../src/core/ui/button.js";

test("button renders navigation links and form buttons from one primitive", () => {
  assert.match(button({label:"Continue",href:"#/journey"}), /^<a /);
  assert.match(button({label:"Save",type:"submit"}), /^<button /);
  assert.match(button({label:"Skip",type:"button",variant:"secondary",attributes:'data-action="skip"'}), /data-action="skip"/);
});
