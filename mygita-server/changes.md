# Changes

Every edit to `mygita-server/` gets a dated summary entry here, most recent first.

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
