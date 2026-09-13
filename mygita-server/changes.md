# Changes

Every edit to `mygita-server/` gets a dated summary entry here, most recent first.

## 2026-09-12 11:15 UTC — Data-use optimization Phase 5 prerequisite: independent Journey/interest/activity-state projections

`GET /api/v1/me/manifest` (Phase 2) already returns independent `journeyVersion`, `interestVersion`,
and `activityStateVersion`, but all three underlying representations were still combined into one
`GET /me/journey` response -- a client that saw only one version change still had to refetch
everything. Added three new authenticated read operations so each projection can be fetched (and
conditionally revalidated) on its own. `GET /me/journey` is unchanged and stays as a compatibility
route.

1. **`GET /me/journeys`** -- raw (unenriched) Journey records: `id`, `userId`, `experienceId`,
   `batchId`, `status`, `startedOn`, `lastAccessed`, `currentContext`, `activityIds`,
   `completedActivityIds`. No `experience`/`nextActivity`/`progress` the way the enriched `Journey`
   shape (`GET /me/journey`, `createJourney`, `completeMyActivity`) has. ETag is `journeyVersion`,
   **weak**: `journeyVersion` hashes only identity fields (`JOURNEY_IDENTITY_FIELDS`), so
   `lastAccessed`/`completedActivityIds` in this body can still change (e.g. on activity completion)
   without `journeyVersion` changing -- that's `activityStateVersion`'s job instead, via the new
   `/me/activity-state`. A strong ETag here would have incorrectly asserted byte-for-byte body
   identity that isn't guaranteed; this is the same category of bug fixed in the Phase 2 correction
   entry below, caught proactively this time by checking byte-stability before choosing weak vs
   strong rather than defaulting to strong.
2. **`GET /me/interests`** (new method on the existing `/me/interests` path, alongside the existing
   `POST`) -- interest registrations: `id`, `userId`, `experienceId`, `registeredAt`. ETag is
   `interestVersion`, **strong**: `interestVersion` hashes the full interest records this body
   renders (sorted the same way), so the body is byte-for-byte reproducible whenever it's unchanged.
3. **`GET /me/activity-state`** -- per-Journey completion state: `{journeyId, completedActivityIds}`.
   ETag is `activityStateVersion`, **strong**: same byte-stability reasoning as interests.

All three: bearer auth required (401 `authentication_required` if missing, with the existing
deny-by-default `Cache-Control: no-store` -- no new logic needed, `apply_common_headers` already
only applies cache headers to a successful `200 GET`), `Cache-Control: private, no-cache`, support
`If-None-Match` -> bodyless `304` via Werkzeug's existing `make_conditional`, and return
`200 {"items": []}` for a brand-new Account with no data yet.

**Implementation:** `MyGitaApplication` gained `_journey_version`/`_interest_version`/
`_activity_state_version` (factored out of `get_my_manifest`, which now calls them too) so a
projection's version here and its corresponding field in `/me/manifest` are computed by the literal
same function on the literal same data -- a client that read a version from the manifest can trust
it verbatim as one of these endpoints' ETags. No `Store` interface change was needed: `list_journeys`
and `list_interests` already existed. Three new routes in `api/app.py`, grouped with the Phase 2
manifest routes.

**Contract:** Per explicit instruction, edited `contracts/mygita-api/openapi.yaml` directly (the
authoritative contract, since these operations govern server implementation and automated response
coverage) -- added `GET /me/journeys`, `GET /me/interests`, `GET /me/activity-state`, and schemas
`JourneyRecord` (the raw/unenriched shape, distinct from the existing enriched `Journey`),
`JourneyRecordList`, `InterestList`, `ActivityState`, `ActivityStateList`. Bumped `info.version`
0.3.0 -> 0.4.0 and extended the description. Updated `tests/verify_openapi.py` to capture a `200` for
each new endpoint (its `304` path is already covered by dedicated behavioral tests in
`tests/test_api.py`, same convention as the Phase 2 manifests).

**Tests added** (`tests/test_api.py`, run against both `JsonStore` and `SqliteStore`):
authenticated 200; unauthenticated 401 with `Cache-Control: no-store`; empty projection
(`{"items": []}`); each endpoint's ETag matches its corresponding `/me/manifest` version field
exactly, with the correct weak/strong marker, and supports conditional `304`; isolation between two
Accounts for each endpoint; a combined test proving only the *appropriate* ETag moves after
enrolment (journeys **and** activity-state -- a new Journey row now exists in both projections),
interest registration (interests only), and activity completion on a still-active Journey (activity
state only -- identity fields are unchanged so journeys does not move); profile updates change none
of the three; and a concurrent-reads-and-mutations test hammering all three new endpoints alongside
interest-registration writes from multiple threads.

**Verification:**
- `python3 -m unittest discover -s mygita-server/tests -v` (isolated Flask venv, Flask/pyyaml/
  jsonschema installed there since they aren't in system Python) -- **75/75 tests pass**, both
  `JsonStore` and `SqliteStore` (up from 55; 20 new tests, no existing test touched or weakened).
- OpenAPI lint/example validation and captured-response validation: `node`/`pnpm` remain unavailable
  in this environment (same limitation noted in every prior entry), so `pnpm run check:openapi` /
  `tests/verify_openapi.py` were **not run directly** -- confirmed `tests/verify_openapi.py` fails
  only at its explicit `node is required` guard, meaning the updated Python capture flow itself
  (now exercising the three new endpoints too) runs cleanly up to that point. Instead ran the
  from-scratch Python reimplementation of `dev-tools/scripts/validate-openapi.mjs`'s logic (built in
  an earlier session, using `jsonschema`'s `Draft202012Validator` + `referencing`), extended with
  capture calls and assertions for the three new endpoints on both store backends: **98 documented
  examples valid against their own schemas; 24/24 declared operations covered (21 previous + 3 new)
  on both backends; every captured response valid against its declared per-status schema**,
  including confirming `GET /me/journeys`' ETag equals `W/"<journeyVersion>"`, `GET /me/interests`'
  and `/me/activity-state`'s equal `"<interestVersion>"`/`"<activityStateVersion>"` (unquoted,
  strong) from the same request's `/me/manifest` snapshot, and that the `/me/journeys` response body
  itself changes after activity completion (`lastAccessed`/`completedActivityIds`) even though its
  ETag correctly does not -- direct proof the weak-ETag choice there is the right one.
- `git diff --check`: clean, no whitespace errors.

**Not done, per explicit instruction:** no UI changes, no Phase 6 work, nothing committed or pushed
-- left for Codex review.

## 2026-09-12 09:40 UTC — Data-use optimization Phase 2: correctness fixes (manifest ETag, weak ETags, contract status)

Corrections to the Phase 2 work from the prior entry, per explicit instruction covering five points.

1. **Fixed the public catalogue manifest ETag.** It was `catalogueVersion` alone, which is a real
   bug: `catalogueVersion` is deliberately narrowed to summary-relevant fields, so a detail-only
   change (e.g. `description`) changes that experience's listed `detailVersion` inside the manifest
   body **without changing catalogueVersion** -- meaning the manifest's own content could differ
   while its ETag stayed the same, and a client would incorrectly treat a stale cached manifest as
   still current. Fixed: `_catalogue_manifest_etag(manifest)` hashes a canonical structure of
   `catalogueVersion` plus the sorted `{id, slug, detailVersion}` entries, so the ETag reacts to
   either kind of change. `/experience-catalogue/summaries` keeps using `catalogueVersion` alone,
   correctly -- its body has no detail content, so `catalogueVersion` already describes everything
   in it.
2. **Corrected manifest ETag semantics: weak, not strong.** `generatedAt` changes on every request
   to `/experience-catalogue/manifest` and `/me/manifest` while the semantic version content may
   not -- a strong ETag incorrectly asserts byte-for-byte identity that isn't true when only
   `generatedAt` differs. Both now use `response.set_etag(value, weak=True)` (`W/"..."`).
   `/experience-catalogue/summaries` and `GET /experiences/{id}` keep strong ETags correctly --
   neither body carries a per-request-changing field, so byte-for-byte identity genuinely holds
   whenever the version is unchanged. Confirmed directly, not assumed: `If-None-Match` correctly
   matches against the weak ETags (Werkzeug's `make_conditional` implements RFC 7232's weak
   comparison rule correctly) -- verified by both the full existing suite passing unmodified against
   the new weak ETags and two new dedicated tests.
3. **Regression tests added** (shared `ApiTestCase`, so both `JsonStore` and `SqliteStore` run every
   one): `test_catalogue_manifest_etag_reacts_to_detail_only_change` -- changes `description`
   (detail-only) on a seeded experience via a new test-only `_mutate_experience_detail_only_field`
   helper (there is no API to edit an experience, so this reaches into each store's internals
   directly, backend-branched, deliberately confined to the test file) and asserts: the experience's
   `detailVersion` changes; `catalogueVersion` does not; the summaries ETag does not; the manifest's
   own ETag *does*; a stale `If-None-Match` now misses (fresh `200`, not an incorrect `304`).
   `test_catalogue_and_my_manifest_etags_are_weak` and `test_weak_manifest_etags_support_conditional_get`
   make the weak-vs-strong split and the `304` round-trip explicit rather than only implicit in the
   other tests. Fixed a stale assertion in the existing
   `test_catalogue_manifest_and_summaries_agree_and_support_conditional_get` that had hardcoded the
   old (buggy) "manifest ETag equals catalogueVersion" assumption.
4. **Contract status and verification coverage.** Removed `x-implementation-status: planned` from
   all three operations in `contracts/mygita-api/openapi.yaml`
   (`getExperienceCatalogueManifest`, `listExperienceSummaries`, `getMyGitaManifest`) -- **per
   explicit instruction this time**, an exception to this server agent's normal practice of never
   editing the contract directly; `docs/**` was left untouched as instructed, that remains
   codex/UI-owned. Updated `tests/verify_openapi.py` to capture and validate a `200` for all three
   now-implemented endpoints (previously exercised none of them); left every existing `304` check
   where it already was, in the unit suite, since a `304` has no JSON body for this script's
   schema-only validation to check.
5. **Verification, run and reported explicitly:**
   - Full Flask test suite: **55 tests, both backends, all passing** (was 49; +6 new tests).
   - OpenAPI response validation (via the Python compliance reimplementation, since `node`/`pnpm`
     remain unavailable in this environment): **86 examples, 28 live captures per backend, 21/21
     operations covered on both** (was 21/21 with the markers excluding 3 from the denominator;
     now genuinely 21/21 with all three counted, since the markers are gone).
   - Directly exercised the *real* `tests/verify_openapi.py` file's `main()` (stubbing only the
     `node`/`subprocess.run` call this sandbox can't make, running every line of actual capture
     logic for real) and confirmed all three new endpoints are captured with `200`.
   - **Not verified**: the actual `node`-based `dev-tools/scripts/validate-openapi.mjs` run itself --
     `node` is still not installed in this environment, stated plainly rather than assumed to pass.

## 2026-09-12 08:30 UTC — Data-use optimization Phase 2: catalogue/MyGita manifests and conditional GET

Implements the server half of the contract v0.3 "data-use optimization" workstream (see
`docs/gitajyoti/regions/mygita/data-use-optimization.md`) -- codex's Phase 1 (contract design) is
complete; this is Phase 2 ("Server version and conditional-request support"), per its own
completion criterion: *"JSON and SQLite stores expose identical version semantics and Flask returns
contract-valid 200/304 responses."*

- **Three new routes** (previously `x-implementation-status: planned` in the contract):
  `GET /experience-catalogue/manifest`, `GET /experience-catalogue/summaries`,
  `GET /me/manifest` (authenticated).
- **Version computation: content hashes, not counters** -- `_hash_json(value)` (canonical
  `json.dumps(sort_keys=True)` + sha256). No new `Store` interface method was needed: every version
  is a pure function of data already reachable through existing methods
  (`list_experiences`/`find_experience`/`find_user`/`list_journeys`/`list_interests`), which is what
  makes "change atomically with every mutation" automatic -- a hash of current data is correct the
  instant the underlying write commits, nothing to separately bump or let drift out of sync.
  - `catalogueVersion` -- hash of (id, slug, title, subtitle, shortDescription, image, designedFor,
    guidanceMode) across every published experience, **explicitly narrowed to summary-relevant
    fields only** (a change to `description` or `recommendedProcess` must not bump it) per the
    checklist's "generate catalogue versions from the published summary projection."
  - `detailVersion` (per experience) -- hash of that experience's full record.
  - `accountVersion` / `profileVersion` -- two different field-subsets hashed from the same
    `find_user()` DTO (`{id, roles, status, createdAt}` vs `{personalDetails, onboarding}`) --
    works identically for legacy mobile-OTP users and password Accounts for free, since `find_user`
    already normalizes both into one shape (the origin-transparent design from the persistence-
    boundary work paying off again).
  - `journeyVersion` -- hash of stable per-journey fields (id, experienceId, batchId, status,
    activityIds), **deliberately excluding `lastAccessed`** so a bare "viewed" touch doesn't
    spuriously bump it.
  - `interestVersion` -- hash of the full interest list.
  - `activityStateVersion` -- hash of (journey id, completedActivityIds) pairs, split out from
    `journeyVersion` specifically so "progress changed" is distinguishable from "enrolment/status
    changed." **This split is my own interpretation filling a real gap**: the contract requires the
    field and says versions are opaque/equality-only, but doesn't mandate what triggers a change --
    flagged to the user before building it, per the plan.
  - Every list is explicitly sorted before hashing (by `id`), so the hash is stable regardless of a
    store's own internal row order -- SQLite gives no ordering guarantee without `ORDER BY`, so
    relying on incidental order would have been a latent cross-backend inconsistency.
- **A precise ETag nuance, and a real change to already-shipped behavior**: the manifest examples
  show the response `ETag` equal to the version string itself, not a hash of the full response body
  -- correct, since the full body includes `generatedAt`, which changes every request and would
  defeat conditional GET entirely if hashed in. `GET /experiences/{id}`'s ETag was switched from
  "hash of the full response body" (shipped two turns ago) to `detailVersion` specifically, so a
  client that read `detailVersion` from the catalogue manifest can correctly predict a 200 vs 304
  against the real endpoint. Verified directly: the manifest's `detailVersion` for an experience and
  that experience's own `GET /experiences/{id}` ETag are now asserted equal in a permanent test.
- **`api/app.py`**: `cacheable(cache_control)` generalized from `cacheable(max_age)` to take the
  exact `Cache-Control` value, since the new endpoints need `public, no-cache` / `private, no-cache`
  (revalidate-always, since manifests exist to be polled cheaply, not served stale for a window) --
  distinct from the existing three routes' `public, max-age=300, must-revalidate`. A view can now
  override the default full-body-hash ETag by setting `g.cache_etag` before returning, used by all
  four version-based routes (the three new ones, plus the updated `get_experience`).
- **Tests** (both store backends): catalogue manifest/summaries agree on `catalogueVersion` and
  support conditional GET; `GET /experiences/{id}`'s ETag matches the manifest's `detailVersion`
  exactly; each private version changes only for its own kind of mutation and no other (profile
  update, enrolment, activity completion, interest registration each independently verified against
  every other version staying stable); `/me/manifest` requires authentication and stays `no-store`
  on the `401`; two Accounts' manifests never reflect each other's data; a concurrency test hammers
  `/me/manifest` reads against real interest-registration writes and asserts zero errors, on top of
  the existing dedicated store-level corruption regression test.

**Verification:**
- Full suite: 49 tests (was 37), both backends, all passing.
- OpenAPI-compliance reimplementation re-run with the real validator's own new behavior mirrored
  (excluding `x-implementation-status: planned` operations from the coverage requirement, matching
  `dev-tools/scripts/validate-openapi.mjs`'s own updated logic) -- 86 examples, 28 live captures per
  backend, all schemas (including the five new ones: `OpaqueVersion`, `ExperienceCardSummary`,
  `ExperienceVersionReference`, `ExperienceCatalogueManifest`, `ExperienceCatalogueSummary`,
  `MyGitaDataManifest`) validate. Also fixed a real gap in the compliance script itself: it
  previously treated "no `content` declared for this status" as an error, which is wrong for `304`
  (no body is correct and expected) -- now only flags it if the server actually returned a non-empty
  body the contract doesn't describe.
- Live end-to-end curl round-trip against a real running server: `catalogueVersion` confirmed
  byte-identical between the manifest and summaries endpoints; `ETag` confirmed equal to
  `catalogueVersion` (not a body hash); `/me/manifest` confirmed `401`+`no-store` without a token.

**Not mine to touch**: removing `x-implementation-status: planned` from `openapi.yaml` now that
these operations are implemented -- that's codex's contract file; flagging completion rather than
editing it myself.

## 2026-09-12 07:20 UTC — HTTP caching for the catalogue routes

Implemented per the design settled earlier this session: explicit per-route opt-in (not derived
from any other property, e.g. "doesn't require auth"), ETag + conditional GET via Flask/Werkzeug's
built-in `response.make_conditional(request)`, deny-by-default (`no-store` unless a route
explicitly opts in).

- **`api/app.py`**: a `cacheable(max_age)` decorator tags a view function (`view.cache_max_age = N`);
  applied to exactly three routes -- `GET /experiences`, `GET /experiences/<id>`,
  `GET /experiences/<id>/batches` (`max_age=300`). `apply_common_headers` (the existing
  `after_request` hook) looks up whether the matched view is tagged; if so, and the response is a
  successful (`200`) `GET`, sets `Cache-Control: public, max-age=300, must-revalidate`, computes an
  ETag (`sha256` of the response body), and calls `response.make_conditional(request)` -- Werkzeug's
  built-in for downgrading to `304` with an empty body when the request's `If-None-Match` matches.
  Everything else -- every authenticated route, `/`, `/health` (health-check endpoints shouldn't be
  cached even when harmless today, since a cached stale "ok" could mask a real outage later), and
  any error response even on an otherwise-cacheable route (an unknown slug's `404` is never cached)
  -- keeps the original unconditional `no-store`.
- **Tests**: `test_catalogue_http_caching` (both store backends) -- a cacheable route returns
  `Cache-Control`/`ETag`; a repeat request quoting that ETag returns `304` with no body; `/health`,
  `/`, and an unknown-slug `404` all still return `no-store`, proving the scoping didn't leak.
  `request()`'s test helper gained an `if_none_match` parameter.

**Verification**: full suite (37 tests, both backends) passes; a real end-to-end curl round-trip
against a live `dev_server.py` confirmed the exact `200`→capture-ETag→`304` sequence, and that
`/health` and an unknown-slug `404` both still return `no-store`; OpenAPI-compliance re-check (both
backends) confirms response *bodies* are unaffected -- only headers changed.

**Left out on purpose, as scoped**: `stale-while-revalidate`, any CDN-specific consideration, and no
new dependency (`Flask-Caching` or otherwise) -- stays hand-rolled.

## 2026-09-11 22:58 UTC — Critical fix: SqliteStore corrupted its own database file under concurrent access

**Found in production use, not by any test.** The user hit `sqlite3.DatabaseError: database disk
image is malformed` running their own `dev_server.py --store sqlite` under Python 3.9. Diagnosed to
the actual root cause, not patched around the symptom.

**Root cause:** `SqliteStore` locked only its write methods (`create_*`, `update_*`, `reset`);
every read method (`find_*`, `list_*`) executed against the shared `sqlite3.Connection` with **no
synchronization at all**. A single `sqlite3.Connection` is not safe for unsynchronized concurrent
use from multiple threads even with `check_same_thread=False` -- that flag only disables Python's
own same-thread assertion, it does not make concurrent statement execution on one connection safe.
Flask's threaded dev server (`app.run(..., threaded=True)`, added this session) spawns a real OS
thread per concurrent request, so any two requests overlapping in time -- one reading, one writing
-- could interleave on the same connection/cursor and corrupt it. This was reachable under entirely
normal use (e.g. a browser firing `/me` and `/me/journey` at once), not an edge case.

**Reproduced directly** (not just inferred): concurrent reads and writes against a bare
`SqliteStore` instance reliably produced a cascade of corrupted-state errors (`DatabaseError`,
`JSONDecodeError`, `IndexError`, `TypeError` from garbled cursor reads) within one run.

**Fix:** every `SqliteStore` method that touches `self._connection` -- reads included -- now holds
`self._lock`. Re-ran the identical concurrent-access reproduction at 5x the original load (750
writes + 9,000 reads across repeated rounds): zero errors, `PRAGMA integrity_check` clean.

**New permanent regression test**: `SqliteStoreApiTestCase.test_concurrent_requests_do_not_corrupt_the_database`
drives 6 threads hammering reads against 20 threads hammering writes directly against the store
(bypassing the HTTP layer's unrelated rate limiter, which 20 concurrent HTTP account-creation calls
from one test-client address would otherwise trip) and asserts zero errors and exactly 20 accounts
created. This class of bug was invisible to the existing 34-test suite because `app.test_client()`
calls are entirely sequential/in-process -- they never exercised real OS-thread concurrency at all.
Worth being explicit about that gap: prior "34/34 passing" verification was thorough for logic
correctness under sequential access, but structurally blind to this exact bug class. The suite is
now 35 tests and this one specifically exercises concurrency.

**A related fix caught along the way, unrelated to this bug**: `mygita-server/tests/run_browser_api_flow.py`
and `.github/workflows/verify.yml` were found already updated for Flask in the working tree (not by
me -- I had missed `run_browser_api_flow.py` entirely during the Flask migration, since I didn't
know it existed; it still imported the deleted `create_server`). Reviewed both and verified the
`run_browser_api_flow.py` fix works correctly (constructs the app via `create_app` and serves it
with `werkzeug.serving.make_server`, since that script needs a real running server for the
JavaScript API providers to reach over `fetch`, unlike the other suites which use `test_client()`).

**Advice for anyone with a `dev_server.py --store sqlite` process already running**: the fix is in
the file on disk, not in an already-started process's memory -- restart it. The existing
`runtime-data/state.db` was checked (`PRAGMA integrity_check` reports `ok`) and appears intact, but
given it was live during the corruption, treat it as disposable local dev data and consider deleting
`runtime-data/state.db*` for a clean start rather than trusting a file that was present during a
real corruption event.

## 2026-09-11 20:35 UTC — Flask migration (Stage 1: behavior-preserving)

Migrated the transport from stdlib `http.server`/`ThreadingHTTPServer` to Flask, per the plan
proposed and acked this session. Scope held exactly to "current capabilities" -- no new features,
no new behavior, same `json` default store.

- **New: `requirements.txt`** (`flask==3.1.3`, the version `pip` resolved as current-stable) and
  **`wsgi.py`** -- the production-style WSGI entry point (for e.g. PythonAnywhere's manual Flask
  config), configured entirely from environment variables (`MYGITA_JWT_SECRET`,
  `MYGITA_ALLOWED_ORIGINS`, `MYGITA_STORE_BACKEND`). Deliberately does **not** fall back to a random
  per-process secret the way `dev_server.py` does: a real WSGI server commonly runs multiple worker
  processes, and each generating its own secret would make sessions randomly fail depending on which
  worker handled a request. `wsgi.py` fails fast with a clear error if the secret is unset instead --
  verified directly (`RuntimeError` raised at import time with no secret; boots and serves real
  requests once one is set).
- **`api/app.py` rewritten onto Flask** (`create_app(...)` factory replacing
  `dispatch()`/`Handler`/`make_handler`/`create_server`). The payoff of keeping business logic
  decoupled from HTTP mechanics all along: every method on `MyGitaApplication` (`request_otp`,
  `verify_otp`, `create_password_account`, `login_with_password`, `update_profile`,
  `create_journey`, `register_interest`, `authenticated_user`, `_issue_session`, `_rate_limit_tick`,
  `_normalise_username`, `_validate_password`, ...) kept its logic unchanged -- only its calling
  convention (public methods instead of a `dispatch()` if/elif chain) and internals moved.
  `@app.errorhandler(ApiProblem)` replaces the try/except in the old `Handler._handle`;
  `@app.errorhandler(Exception)` replaces the old catch-all and **preserves the Stage-0 fix
  exactly** -- log the traceback, return the same generic `500 internal_error` envelope, never leak
  detail to the client (re-verified directly against the new code, not assumed). CORS stays
  hand-rolled (an `after_request` hook), not `flask-cors` -- no new dependency beyond Flask itself,
  as agreed.
- **A real behavior difference found and fixed, not left as a silent regression**: Flask
  auto-registers an OPTIONS responder per route by default (200, an `Allow` header, no body), and it
  won over the app's own explicit wildcard preflight handler. Fixed with a small `route()` wrapper
  defaulting every route registration to `provide_automatic_options=False`, routing all OPTIONS
  requests through the one explicit handler -- restoring the exact original `204` response with the
  exact original headers, confirmed by direct comparison of the raw HTTP response before and after.
- **`dev_server.py`**: `app.run(host=..., port=..., threaded=True)` instead of building a
  `ThreadingHTTPServer`. The `--store json|sqlite` flag and the random-secret-per-process fallback
  (Stage-0) are unchanged -- both were already framework-agnostic.
- **`api/store.py`, `api/storage.py`, `api/sqlite_store.py`, `api/passwords.py`, `api/auth.py`,
  `mock-data/*.json`: untouched.** The actual point of the `Store` boundary and business-logic
  decoupling built across this engagement -- a full framework migration needed zero changes to
  persistence or domain logic.
- **Tests**: `tests/test_api.py`'s `request()` helper moved from raw `urllib` against a real socket
  to `app.test_client()`; `setUpClass`/`tearDownClass` simplified (no more thread/socket lifecycle).
  Both `JsonStoreApiTestCase` and `SqliteStoreApiTestCase` kept, all 34 test bodies (17 x 2 backends)
  unchanged. Deliberately did **not** set `app.testing = True`, since that flips Flask's
  `PROPAGATE_EXCEPTIONS` default and would bypass the custom `Exception` error handler under test --
  tests exercise the same generic-500-plus-logged-traceback path a real client sees.
  `tests/verify_openapi.py`'s direct `dispatch()` calls became `test_client()` calls; stayed
  `JsonStore`-only, same scope as before (contract compliance, not store equivalence -- that's the
  parameterized unittest suite's job).
- **`README.md`**: rewrote the Run section (`pip install -r requirements.txt` step, `--store` flag,
  `wsgi.py`), and fixed a route-summary list that had gone stale before this session (missing `GET
  /api/v1`, `/auth/accounts`, `/auth/password/login` -- a pre-existing gap, not introduced by this
  change, fixed while already touching this file). Updated the "dependency-free" framing (accurate
  for the client, no longer accurate for the server) and clarified the "not a production service"
  line to name what's specifically still unapproved.
- **`.gitignore`**: added `.venv/`/`venv/`, since the new setup instructions have a local dev create
  one.

**Verification**, all against a real isolated venv with Flask actually installed (not assumed):
- Full 34-test suite passes unchanged on the first run against the new Flask app.
- The Python-based OpenAPI-compliance reimplementation, rewritten to go through the **actual Flask
  app via its WSGI test client** (stronger than the previous direct-`dispatch()`-call version) --
  run against both `JsonStore` and `SqliteStore`: 78 examples + 20 live captures each, 18/18
  operations covered, fully compliant on both.
- Real end-to-end smoke test: `dev_server.py` running for real (both `--store json` and `--store
  sqlite`), curl against it -- catalogue fetch, CORS preflight (headers and now-correct `204`
  status), an unmatched route and a wrong-method-on-a-valid-route both still returning the original
  `404 not_found` envelope (not Flask's default `405`), the duplicate-enrolment and
  duplicate-interest database-constraint backstops still firing correctly through the new routing
  layer, and a genuine injected fault confirmed logged server-side while the client still gets the
  unchanged generic `500`.
- `wsgi.py` confirmed to fail fast with a clear error when `MYGITA_JWT_SECRET` is unset, and to boot
  and serve real requests correctly when it is.

**Known, unavoidable consequence flagged again**: `.github/workflows/*.yml` will now fail
(`ModuleNotFoundError: No module named 'flask'`) until a `pip install -r mygita-server/requirements.txt`
step is added before the test step. That file is outside `mygita-server/`, not mine to change.

## 2026-09-11 18:00 UTC — roadmap.md cleanup

Reconciled `roadmap.md` against completed work, per explicit request. Item 4 (`SqliteStore`) marked
DONE. Item 2 (live-reference/non-atomic gap) marked DONE for the create-race it was really about
(closed via `SqliteStore`'s constraints, verified directly) but explicitly caveated as not universal
— `JsonStore` remains the default and keeps the original gap; split the narrower remaining piece
(`update_user`/`update_journey`'s live-reference mutation, unrelated to the create-race) into a new
item 2b so it isn't lost. Item 3 (multi-method sign-in) updated to record the password/email piece
as done via ADR-0010, with Google/Microsoft and identity-linking still open and still blocked on a
contract addition codex hasn't picked up. Item 1 (slug pattern) re-checked against current
`openapi.yaml` — still unaddressed, left as-is. No code changed.

## 2026-09-11 17:52 UTC — suggestions.md: reconciled, no new ADR proposed for SqliteStore

Considered whether the `SqliteStore` work warrants its own `suggestions.md`/ADR entry and decided
against it: ADR-0009 already explicitly anticipated a database-backed `Store` implementation
("introduced at the composition root without rewriting handlers"), so this is implementation of an
existing decision, not a new one — unlike the PBKDF2 entry, which recorded a genuine deviation from
written guidance. Updated item 1's reconciliation note instead: the live-reference/non-atomic-update
gap it points at is now closed for whichever store is selected (via `SqliteStore`'s real
constraints), not universally, since `JsonStore` remains the default. No code changed.

## 2026-09-11 17:45 UTC — `SqliteStore`: hybrid ER+JSON persistence backend

Implemented the SQLite `Store` behind the interface established by ADR-0009, per the hybrid
ER+JSON schema designed earlier this session (real columns/indexes only for what's joined,
filtered, or must be unique; everything else stays a single JSON column per row). Purely additive:
`JsonStore` stays the default, nothing existing changes unless `sqlite` is explicitly selected.

- **New: `api/sqlite_store.py`.** Full `Store` implementation — reference tables (experiences,
  activities, batches, sessions) re-seeded (upserted) from `mock-data/*.json` on every construction,
  so the existing JSON-authoring workflow is unchanged; runtime tables (users, accounts, profiles,
  login_identifiers, authenticators, journeys, interests) live only in the database. One connection
  per store instance (`check_same_thread=False`), `PRAGMA journal_mode=WAL` (readers never blocked
  by a writer) and `PRAGMA foreign_keys=ON`.
- **Real constraints as defense-in-depth, not just app-level checks.** A partial unique index —
  `journeys(user_id, experience_id) WHERE status='active'` — makes the duplicate-active-journey race
  impossible at the database level, not just via the app's pre-check (`find_active_journey`, still
  the primary check for a friendly error). Same pattern for interests
  (`UNIQUE(user_id, experience_id)`). This is the concrete fix for the gap ADR-0009's own
  consequences section flagged and roadmap item 2 tracked, for whichever store is selected.
- **`api/store.py`:** added `DuplicateActiveJourney`, `DuplicateInterest` exceptions (mirroring the
  existing `DuplicateLoginIdentifier`), and a `close()` lifecycle method on the `Store` interface
  (connection cleanup; `JsonStore.close()` is a no-op).
- **`api/app.py`:** `_create_journey`/`_register_interest` now also catch the two new exceptions and
  translate them to the same `409` responses their existing pre-checks already produce — real
  defense-in-depth, not a behavior change for the common case.
- **`dev_server.py`:** new `--store json|sqlite` flag, default `json` (unchanged behavior unless
  opted in); closes the store on shutdown.
- **A real bug found and fixed during verification, not left for later:** `SqliteStore.reset()`
  initially deleted `accounts` before the tables that reference it (`profiles`,
  `login_identifiers`, `authenticators`), which `PRAGMA foreign_keys=ON` correctly rejected. Because
  the exception happened before `commit()`, it left the connection in a way that made a second
  connection to the same file report `database is locked`, **and** because it happened inside
  `dispatch()`'s `/dev/reset` branch, the two lines after `store.reset()`
  (`otp_challenges.clear()`, `rate_limit_state.clear()`) never ran -- so rate-limit counters
  silently stopped resetting between tests from that point on, which is what actually surfaced the
  bug (cascading, seemingly unrelated `429`s partway through the SQLite test run). Fixed by deleting
  child tables before the parent they reference, plus a rollback-on-any-exception safety net. Also
  fixed a related but separate clarity bug while verifying this: the `IntegrityError` handlers in
  `create_journey`/`create_interest`/`create_password_account` were mapping *any* integrity error
  (including a foreign-key violation from a bad reference -- a bug, not a legitimate duplicate) to
  the friendly duplicate exceptions; now disambiguated by the actual constraint that failed
  (`_is_unique_violation`), so a genuine data-integrity problem surfaces honestly instead of being
  mislabeled.
- **Tests:** per ADR-0009's own stated expectation ("every store implementation needs shared
  behavioral tests"), `tests/test_api.py`'s `ApiTestCase` was parameterized rather than duplicated —
  a `make_store` classmethod, two concrete subclasses (`JsonStoreApiTestCase`,
  `SqliteStoreApiTestCase`), all 17 existing test bodies run unchanged against both backends. Also
  fixed a stale assertion in `test_password_material_absent_from_responses` that checked for the
  string `"scrypt"`, a leftover from before this session's earlier PBKDF2 swap -- it was checking for
  something that could never appear regardless of any real leak; now checks `"pbkdf2"`.

**Verification:**
- `python3 -m unittest discover -s mygita-server/tests -v` — 34/34 pass (17 tests × 2 backends), 1
  base class correctly skipped.
- Re-ran the Python-based OpenAPI-compliance reimplementation against *both* backends explicitly
  (not just the default) — 78 examples + 20 live captures, 18/18 operations covered, fully compliant
  under both `JsonStore` and `SqliteStore`.
- Directly exercised the new DB-level constraints, bypassing the app-level pre-checks entirely, to
  prove the constraints themselves work, not just the code that normally guards them: confirmed the
  partial unique index blocks a second concurrent active journey for the same (user, experience)
  while still allowing a *completed* journey for a different experience (proving the index is
  correctly scoped to `active` only, matching `find_active_journey`'s own semantics); confirmed the
  interest-uniqueness constraint; confirmed a foreign-key violation (a journey referencing a
  nonexistent experience) is now correctly rejected and surfaces honestly rather than being
  mislabeled as a duplicate.
- Ran the real entry point end-to-end: `python3 dev_server.py --store sqlite`, real HTTP calls
  (account creation, journey enrolment, duplicate-enrolment 409), confirmed `state.db`/`-wal`/`-shm`
  files appear on disk (WAL mode genuinely active).

**Not yet decided:** whether `dev_server.py`'s default flips from `json` to `sqlite`. Left as `json`
for now since this was explicitly framed as additive; that's a separate decision for whenever the
Flask/deployment stages are greenlit.

**Scope:** `api/sqlite_store.py` (new), `api/store.py`, `api/app.py`, `dev_server.py`,
`tests/test_api.py`. No contract, docs, or framework changes.

## 2026-09-11 11:56 UTC — Stage-0 production-readiness fixes: secret fallback + error logging

Two fixes agreed as prerequisites to the planned production work, done on the current server (no
framework migration yet, per explicit instruction).

- **`dev_server.py`: removed the hardcoded JWT-secret fallback default.** Previously,
  `MYGITA_DEV_JWT_SECRET` unset meant silently signing sessions with a fixed, git-committed string
  (`"mygita-local-development-secret-change-me"`) — anyone who read the repo could forge a valid
  token for any user if this server were ever reached by anything other than its own author. Now,
  an unset env var generates a fresh random secret (`secrets.token_urlsafe(32)`) per process
  instead, with a printed warning. Preserves zero-setup local dev (still just runs, no required env
  var) while eliminating the predictable-secret risk; sessions no longer survive a restart when no
  explicit secret is set, which is the correct trade-off for a value that must never be guessable.
- **`api/app.py`: unexpected exceptions in `Handler._handle` are now logged.** The generic
  `except Exception:` fallback sent a `500 internal_error` to the client with zero trace anywhere —
  correct client-facing behavior (never leak internals), but previously left zero diagnostic trail
  for an operator. Added `traceback.print_exc()` before the response is sent.

**Verification:**
- `python3 -m unittest discover -s mygita-server/tests -v` — 17/17 pass, unchanged.
- Re-ran the Python-based OpenAPI-compliance reimplementation from the 2026-09-11 session (fresh
  venv, `jsonschema`+`pyyaml`) — 78 examples + 20 live captures, 18/18 operations covered, all still
  compliant. Expected: neither fix touches a response shape.
- **Secret fix**: started two real server processes on different ports with no
  `MYGITA_DEV_JWT_SECRET` set, minted a session token on one, and confirmed it returns `401
  invalid_token` against the other — proving the two processes' secrets are genuinely different, not
  shared. Confirmed the warning message actually prints (unbuffered run).
- **Logging fix**: injected a genuine unexpected exception into a live handler method on a real
  running server, hit it over real HTTP, and confirmed: the client still receives the unchanged
  generic `500 internal_error` (no detail leaked), while the server's own log now shows a complete
  traceback pinpointing the exact failure -- previously nothing would have appeared there at all.

**Scope:** `dev_server.py` and `api/app.py` only. No contract, docs, or framework changes. Flask
migration remains a separate, not-yet-started step per explicit instruction.

## 2026-09-11 10:05 UTC — suggestions.md: PBKDF2 algorithm-choice entry

Reconciled `suggestions.md` against `docs/gitajyoti/decisions/` (still only ADR-0009 and ADR-0010;
no new ADR since last check, item 1 stays DONE) and added item 2: the scrypt→PBKDF2-HMAC-SHA256
password-hashing decision from the prior entry, framed as an ADR candidate rather than left as an
implementation footnote, since it deviates from `identity.md`'s stated Argon2id/scrypt guidance for
a non-obvious portability reason a future reader has no way to discover otherwise. No code changed.

Also surfaced, not added anywhere (per standing instruction not to touch `roadmap.md` unless
asked): the stale `openapi.yaml` `AuthorizationError`/`onboarding_required` example text (noted
2026-09-11 but never formally tracked), and a swallowed-exception/no-logging gap found in
`api/app.py`'s `_handle` while reproducing the scrypt bug — the generic `except Exception:` sends a
500 to the client but never logs the actual exception anywhere, so an unexpected server error
currently leaves zero diagnostic trail.

## 2026-09-11 09:10 UTC — PBKDF2 swap + remove onboarding authorization gate

Two fixes, both verified against a real bug and a real (updated) requirement rather than assumed;
proposed, then acted on only after explicit ack.

- **`api/passwords.py`: scrypt → `hashlib.pbkdf2_hmac('sha256', ...)`, 600,000 iterations.**
  `hashlib.scrypt` was found to be unavailable on Apple's bundled macOS Python (3.9.6, linked
  against LibreSSL 2.8.3 — no `scrypt` attribute at all) — confirmed by actually running
  `mygita-server/dev_server.py` under `/usr/bin/python3` and hitting the live endpoint (`500
  internal_error`), not just an isolated snippet. Matching PythonAnywhere forum reports of
  `ValueError: unsupported hash type scrypt` on their hosted Python images corroborate this as a
  general portability gap, not a macOS-only quirk. PBKDF2-HMAC-SHA256 has been in `hashlib` since
  Python 3.4 with no OpenSSL-scrypt dependency; confirmed identical behavior on both the
  LibreSSL-linked system Python and Homebrew's OpenSSL-linked Python. Re-verified end-to-end
  post-fix: account creation, login, and Journey enrolment all now succeed under
  `/usr/bin/python3`, where account creation previously 500'd.
  Encoded hash format changed accordingly (`pbkdf2-sha256$iterations=600000$salt$hash`); no stored
  hashes exist yet in any real deployment, so no migration was needed.
- **`api/app.py`: removed the mandatory-onboarding authorization gate** (`_require_onboarding`,
  and its call before Journey/Interest/Activity routes), for both the password and OTP paths.
  ADR-0010 and `docs/gitajyoti/architecture/identity.md` were updated by codex since the prior
  milestone (status "Planned" → "Partial") to explicitly require this: *"Profile completion is
  encouraged but is not an authorization gate"* / handoff item 10, *"Remove mandatory-Profile
  authorization gating; a pending Profile must still be able to use learner capabilities."* A
  pending Profile can now read/create Journeys, register interest, and complete activities.
  **Noted, not acted on:** `contracts/mygita-api/openapi.yaml` still documents `403
  AuthorizationError` as a possible response on all five of these operations, with a shared
  example (`onboarding_required`) that describes exactly the gate just removed — likely stale
  relative to the ADR update, but it's codex's file; flagged to the user rather than guessed at.
- **Tests:** `test_registration_existing_user_and_onboarding` updated — `/me/journey` before
  onboarding now asserts `200 {"items": [], "interests": []}` instead of the old `403
  onboarding_required`. Added `test_password_account_optional_profile_behavior`, the "optional
  Profile behavior" test `identity.md` item 11 now explicitly requires: a password Account with a
  still-`pending` Profile successfully enrols in a Journey, completes an activity, and registers
  interest, and remains `pending` throughout (nothing implicitly completed onboarding).

**Verification:** `python3 -m unittest discover -s mygita-server/tests -v` — 17/17 pass (16 prior +
1 new). Also re-ran the exact real-service reproduction from the bug report — `/usr/bin/python3
mygita-server/dev_server.py`, live HTTP calls — confirming account creation, login, and
pending-Profile Journey enrolment all now succeed where they previously failed (500, then would
have hit 403).

## 2026-09-11 07:00 UTC — ADR-0010 server implementation: password Accounts

Implemented `POST /auth/accounts` and `POST /auth/password/login` per `contracts/mygita-api/openapi.yaml`
and the "Server handoff" checklist in `docs/gitajyoti/architecture/identity.md`, following ADR-0010's
Account/Profile/LoginIdentifier/Authenticator separation. Design was proposed and acked before any
code was written; three decisions were made explicitly by the user: scrypt over Argon2id, no
compromised-password screening for now, and rate limiting keyed by both username and client IP.

- **New:** `api/passwords.py` — `hash_password`/`verify_password` using `hashlib.scrypt` (stdlib, no
  new dependency) instead of Argon2id, which has no stdlib implementation. Encoded hash string
  carries its own algorithm parameters and salt (`scrypt$n=...$r=...$p=...$salt$hash`).
- **`api/store.py`:** added `DuplicateLoginIdentifier` exception and four new abstract `Store`
  methods — `find_login_identifier`, `find_authenticator`, `create_password_account` (atomic:
  Account + pending Profile + LoginIdentifier + Authenticator in one locked operation, raising
  `DuplicateLoginIdentifier` under the same lock as the uniqueness check — no check-then-act race),
  `list_accounts` (diagnostic). Updated `find_user`/`update_user` docstrings to note they now resolve
  either the legacy `users` collection or an Account+Profile pair transparently.
- **`api/storage.py`:** four new runtime collections (`accounts`, `profiles`, `loginIdentifiers`,
  `authenticators`) in `INITIAL_RUNTIME_STATE` — automatically picked up on load for any existing
  `state.json` via the existing `setdefault` migration, and automatically cleared by `/dev/reset`.
  Implemented the four new `Store` methods. **`find_user`/`update_user` made origin-transparent**:
  they check the legacy `users` list first, then fall back to composing/writing back an
  Account+Profile pair. This is the load-bearing design decision of this milestone — every existing
  handler in `api/app.py` that already called `find_user`/`update_user` (Journey enrolment, Interests,
  Profile/onboarding updates, activity completion) needed **zero code changes** to work for a
  password-created Account, because the `Store` abstraction from the earlier persistence-boundary
  refactor already isolated them from storage representation. Verified end-to-end: a password Account
  can complete onboarding and enrol in a Journey through the unmodified existing handlers.
- **`api/app.py`:**
  - `_issue_session(user, is_new_user)` — the one shared session-issuance path ADR-0010 asks for.
    `_verify_otp`'s tail was refactored to call it; nothing else about OTP changed.
  - `_normalise_username`/`_validate_password` — schema-exact validation (username: 3–32 chars,
    pattern `^[A-Za-z0-9][A-Za-z0-9._-]*$`, lowercased; password: 15–128 chars). No compromised-password
    screening, per this session's explicit decision.
  - Rate limiting: `_rate_limit_tick`/`_reset_rate_limit`, fixed 15-minute window, 5 attempts, checked
    **twice per request — by client IP first (before body validation, so malformed-body spam is caught
    too), then by normalized username** (once the identifier is known to be well-formed) — for both
    account creation and login, independently. `dispatch()` gained a `client_ip` parameter; the HTTP
    handler passes `self.client_address[0]`; `verify_openapi.py`'s direct-dispatch harness passes
    `"127.0.0.1"`. Login resets only the username-keyed bucket on success; the IP-keyed bucket is left
    as a standing volume counter regardless of outcome.
  - `_create_password_account`/`_login_with_password` — new handlers, new public routes in
    `dispatch()`. Login returns identical `401 invalid_credentials` for both an unknown username and a
    wrong password, per spec, so the response never discloses Account existence.
  - `/dev/reset` now also clears `rate_limit_state`, for test isolation between test methods.
- **Preserved unchanged:** `/auth/otp/request`, `/auth/otp/verify`, and the `AuthSession`/`User`
  response shapes for the OTP path — no behavior or response-shape change, confirmed by the full
  existing test suite still passing unmodified.
- **Tests added** (`tests/test_api.py`, same harness, no new file) covering every category in the
  handoff checklist: success round-trip (create → login → onboarding → Journey enrolment, proving the
  origin-transparent Store design), duplicate username (409), case-insensitive normalization, weak/invalid
  input (422 on short/malformed username, short password), incorrect credentials (401, same code for
  unknown-username and wrong-password), rate limiting on both endpoints (429), persistence reload
  (new `JsonStore` instance resolves the Account/identifier/authenticator), and password material
  absent from every response body (creation, `/me`, login — checked for `"password"`/`"scrypt"`
  substrings). `tests/verify_openapi.py` also updated to exercise both new endpoints and pass a
  `client_ip` through the direct-dispatch harness.

**Verification:** `python3 -m unittest discover -s mygita-server/tests -v` — 16/16 pass (7 pre-existing
+ 9 new). Manually verified via direct `dispatch()` calls (since `node`/`pnpm` remain unavailable in
this environment, so `pnpm run check:openapi` could not be run) that the `POST /auth/accounts` and
`POST /auth/password/login` response bodies match the `AuthSession`/`User` schemas and documented
examples in `openapi.yaml` exactly (key sets, `id` pattern, pending-Profile shape), and that both the
in-place `personalDetails` mutation and the wholesale `onboarding` reassignment paths in
`_update_profile` correctly persist to disk for a password Account, confirmed by resolving `/me`
through a **freshly constructed** `JsonStore`/`MyGitaApplication` pair after a store reload.

**Scope:** only `mygita-server/` files changed (`api/store.py`, `api/storage.py`, `api/app.py`,
`tests/test_api.py`, `tests/verify_openapi.py`, new `api/passwords.py`). No edits to `docs/`,
`contracts/`, or `mygita/`.

## 2026-09-11 03:40 UTC — Roadmap: identity-linking pattern

Filled in roadmap item 3's open identity-linking question with a resolved design (still status
NEW — nothing built): a `users` + `identities` (provider, subject → user_id) table pattern, with
explicit-linking-only as the recommended policy (sign-in never auto-merges across providers on
email match; linking is a separate authenticated profile action) and "soft auto-link + notify"
named as the lighter alternative not chosen by default. No code, contract, or docs changed.

## 2026-09-11 03:15 UTC — Roadmap: multi-method sign-in design

Added roadmap item 3 (renumbering the SQLite item to 4): design discussion on adding Google,
Microsoft, and email/password sign-in alongside the existing mobile OTP flow. Recommendation
recorded: client-side provider SDKs obtain a provider-signed ID token, backend verifies it against
the provider's JWKS and discards it (never stores provider tokens), then reuses the same
find-or-create-user → issue-local-JWT path `/auth/otp/verify` already has. No code changed; no
contract or docs edited.

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
