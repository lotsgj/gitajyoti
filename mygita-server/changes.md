# Changes

Every edit to `mygita-server/` gets a dated summary entry here, most recent first.

## 2026-09-11 02:40 UTC — Restructured suggestions.md; added roadmap.md

Per user instruction: `contracts/suggestions.md` is now scoped to only design changes already made
in `mygita-server` that are ADR-worthy, each carrying a status (`NEW`/`DEFERRED`/`DONE`/`REJECTED`)
that I reconcile against `docs/gitajyoti/decisions/` every time I edit the file. Everything else
under consideration — contract-edit ideas, open follow-ups, not-yet-decided design work — moved to
a new `contracts/roadmap.md`, same status vocabulary.

- Rewrote `suggestions.md`: the persistence-abstraction-boundary entry is now `DONE` — confirmed
  [ADR-0009](../docs/gitajyoti/decisions/ADR-0009-server-persistence-boundary.md) was filed by
  codex (Accepted, 2026-09-11) and its decision/consequences match what was built.
- Created `roadmap.md` with three `NEW` items: (1) the `Experience.slug` pattern-constraint contract
  suggestion, moved here from the old `suggestions.md` since it's a contract edit under
  consideration, not a made design change; (2) closing the live-reference / non-atomic
  `update_user`/`update_journey` gap that ADR-0009's own consequences section flagged; (3) the
  `SqliteStore` hybrid ER+JSON design discussed with the user (no code written).
- No application code changed in this entry.

## 2026-09-11 01:52 UTC — Persistence abstraction boundary + published-catalogue fix

Introduced an explicit `Store` interface (`api/store.py`) and made `MyGitaApplication` depend only
on it rather than on `JsonStore`'s internal shape.

- Added `api/store.py`: an abstract `Store` base class with intent-revealing methods for reference
  data (`list_experiences`, `find_experience`, `list_batches`, `find_batch`, `list_activities`,
  `find_activity`, `find_session`), identity (`find_user`, `find_user_by_mobile`, `create_user`,
  `update_user`, `list_users`), journeys (`list_journeys`, `find_active_journey`,
  `find_journey_for_activity`, `create_journey`, `update_journey`), interests (`list_interests`,
  `find_interest`, `create_interest`), and lifecycle (`reset`).
- Rewrote `api/storage.py`'s `JsonStore` to implement `Store` fully. Internal collections are now
  private (`_experiences`, `_activities`, `_batches`, `_sessions`, `_state`); nothing outside the
  class touches them directly anymore. `create_user`/`create_journey`/`create_interest` now lock
  around the append-and-write together (previously the append and the locked save were separate
  steps — a small thread-safety improvement, not just a rename).
- Rewrote `api/app.py` handlers (`_verify_otp`, `_update_profile`, `_create_journey`,
  `_register_interest`, `_enrich_journey`, `_get_journey`, `_get_activity`, `_complete_activity`) to
  call `Store` methods instead of reading/mutating `store.state[...]` and calling a global
  `store.save()`. Removed the now-redundant `_journey_for_activity` helper in favor of calling
  `store.find_journey_for_activity` directly.
- `MyGitaApplication.__init__` now takes an injected `store` instead of `(seed_dir, runtime_dir)`
  and building a `JsonStore` itself. `create_server(...)` gained an optional `store=` parameter
  (defaults to `JsonStore(seed_dir, runtime_dir)` — the same effective behavior as before) so a
  different `Store` implementation can be substituted with no change to `api/app.py`.
- **Fixed a contract-vs-implementation bug**: `GET /experiences` now filters to
  `status == "published"` via `list_experiences()`. `openapi.yaml` already documents this endpoint
  as "List published experiences" ([openapi.yaml:71](../contracts/mygita-api/openapi.yaml#L71));
  the mock server was returning every experience regardless of status. No contract change needed —
  this brings the implementation in line with what was already specified.
- Updated `tests/test_api.py`'s `test_runtime_state_survives_store_reload` to call
  `JsonStore.list_users()` instead of reaching into `.state["users"]`, and
  `tests/verify_openapi.py` to construct `MyGitaApplication(JsonStore(...), secret, ...)` under the
  new constructor signature.

**Verification:** `python3 -m unittest discover -s mygita-server/tests -v` — 7/7 pass. Manually
smoke-tested (via direct `dispatch()` calls, since `node`/`pnpm` are unavailable in this
environment) the published-only filter, batches, activity/session enrichment, journey progress,
activity completion, interests, duplicate-enrolment 409, and `/dev/reset` lifecycle — all behave
identically to before the refactor. **Not run:** `pnpm run check:openapi` (needs `dev-tools/`
tooling not installed here) — response shapes were not changed by this refactor, so it is expected
to still pass, but hasn't been confirmed in this environment.

**No contract or docs changes.** Proposed the architectural rationale for this as ADR-0009 in
`contracts/suggestions.md` beforehand; filing the ADR itself is left to codex per the
docs-ownership split agreed with the user.
