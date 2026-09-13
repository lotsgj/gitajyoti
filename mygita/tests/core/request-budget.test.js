import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyRequestBudget } from "../helpers/request-budget.js";

test("request budgets accept exact counts and ignore CORS preflights",()=>{
  verifyRequestBudget("verifier exact match",[
    {method:"OPTIONS",path:"/api/v1/items"},
    {method:"GET",path:"/api/v1/items"},
  ],{"GET /api/v1/items":1});
});

test("request budgets reject an unexpected duplicate",()=>{
  assert.throws(()=>verifyRequestBudget("verifier duplicate",[
    {method:"GET",path:"/api/v1/items"},
    {method:"GET",path:"/api/v1/items"},
  ],{"GET /api/v1/items":1}),/exceeded its request budget/);
});
