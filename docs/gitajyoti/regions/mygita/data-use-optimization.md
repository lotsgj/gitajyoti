# Data-use optimization checklist

Status: Complete — Phases 1–6 verified

This workstream reduces network use and improves progressive rendering without changing the Identity, Experience, or Journey domain boundaries. API remains the default runtime provider; `?provider=fixture` remains the explicit fixture override. Public Experience data and Account-specific MyGita data have separate cache ownership and freshness rules.

## Terminology prerequisite — Atmajyoti

- [x] Define **Atmajyoti (Divine Self)** as the user-facing name for a person using MyGita before login.
- [x] Use **🙏🏼 तत्त्वमसि / YOU ARE THAT 🙏🏼** as the Atmajyoti insight before login.
- [x] Define the signed-in address as **Atmajyoti (Divine Self) `<display name>`**, for example, **Atmajyoti (Divine Self) Vijay**.
- [x] Use **TRUTH-REALISE-USE** as the signed-in greeting line and Journey guiding line.
- [x] Remove `Atithi`, `Atithi devobhava`, and `Truth alone liberates` from MyGita UI source.
- [x] Use the Profile display name only after authentication; fall back to **Atmajyoti (Divine Self)** when it is absent.
- [x] Keep `Account`, `Profile`, authenticated, and unauthenticated as the technical domain terms. Atmajyoti is presentation language, not a new authorization state or persisted entity.
- [x] Verify HTML escaping of the personalized greeting.
- [x] Verify accessible announcement of the personalized greeting in a rendered-browser test.

## Phase 1 — Version and representation contracts

- [x] Add a public Experience catalogue-manifest operation to `mygita.api`.
- [x] Return an opaque catalogue version and an opaque detail version for each published Experience.
- [x] Define `ETag` and `If-None-Match` behavior, including `304 Not Modified` responses.
- [x] Define a lightweight Experience-summary representation used by Discover cards.
- [x] Keep the full Experience representation separate and load it only when an Experience is opened.
- [x] Add a private MyGita manifest containing independent opaque versions for Profile, Journey, interests, and activity state.
- [x] Specify that clients compare opaque versions but never parse, order, or increment them.
- [x] Add examples and standard error responses, then lint and validate the updated OpenAPI contract.
- [x] Implement matching public catalogue-version behavior in fixture and API Experience repositories so their contracts remain provider-independent.

Completion criterion: the authoritative contract can determine which public and private projections are stale without downloading every record.

Phase 1 evidence: OpenAPI 0.3 defines manifest and summary operations, conditional request/response headers, opaque version schemas, and full-detail revalidation. The generated runtime-validator bundle is current, and both Experience provider implementations expose the same version-aware boundary.

## Phase 2 — Server version and conditional-request support

- [x] Generate catalogue versions from the published summary projection.
- [x] Generate an independently changing detail version for each Experience.
- [x] Serve summary-only catalogue responses.
- [x] Support conditional manifest and Experience requests using ETags.
- [x] Track Profile, Journey, interest, and activity-state versions independently for each Account.
- [x] Change the relevant private version atomically with every mutation.
- [x] Ensure one Account cannot observe another Account's versions or records.
- [x] Test unchanged, changed, missing, unauthorized, and concurrent-mutation behavior against every current store.

Completion criterion: JSON and SQLite stores expose identical version semantics and Flask returns contract-valid `200`/`304` responses.

Phase 2 evidence: 55 Flask tests pass across JSON and SQLite. Catalogue-manifest and private-manifest responses use weak semantic ETags because `generatedAt` changes per response; summaries and Experience details use strong ETags. Detail-only changes invalidate the catalogue manifest without invalidating summary data. OpenAPI lint, 86 examples, and 23 captured Flask responses pass.

## Phase 3 — Client cache foundation

- [x] Add a repository-ready in-memory cache for fast navigation within the active page session.
- [x] Add an IndexedDB-backed durable document store for versioned records; do not use synchronous `localStorage` for record bodies.
- [x] Define separate public catalogue and per-Experience detail cache areas.
- [x] Define independent Profile, Journey, interest, and activity-state areas namespaced by Account ID.
- [x] Persist cache schema version, opaque record version, and fetch timestamp with every cached projection.
- [x] Coalesce simultaneous requests for the same cache key and version into one in-flight Promise.
- [x] Prevent an aborted load from populating stale cache data.
- [x] Recover from missing, obsolete, or corrupt cache entries by discarding only the affected entry.
- [x] Reject passwords, hashes, OTPs, challenges, recovery material, and authentication tokens at the cache boundary.
- [x] Provide targeted entry, namespace, Account-memory release, and Account-data deletion operations.
- [x] Keep the cache layer provider-independent so fixture and API repositories can use identical behavior.
- [x] Connect Account-memory release to sign-out and `401` when private projections are activated in Phase 5.
- [x] Verify the IndexedDB adapter in a rendered-browser quality gate.

Completion criterion: cache behavior is repository-owned, asynchronous, provider-independent, and cannot leak data between Accounts.

Phase 3 evidence: the cache foundation is present but intentionally not activated by pages before Phase 2 completes. Automated tests cover cloned reads, opaque-version matching, stale misses, in-flight deduplication, cancellation, corrupt and obsolete records, targeted invalidation, public/private separation, Account isolation, memory release, Account deletion, and sensitive-field rejection. Checked JavaScript validates the IndexedDB adapter; rendered-browser IndexedDB verification remains an explicit quality-gate item.

## Phase 4 — Progressive public Experience loading

- [x] On Discover, render a cached Experience summary catalogue immediately when available.
- [x] Revalidate the catalogue manifest in the background.
- [x] Fetch summaries only when the catalogue version changes.
- [x] On Experience navigation, use cached details when their version matches the manifest.
- [x] Fetch and cache details only when that Experience has not been browsed or its detail version changed.
- [x] Preserve usable cached content during refresh and show a non-blocking refresh indicator.
- [x] Show an error without discarding valid cached content when background refresh fails.
- [x] Apply identical public caching behavior to Atmajyoti and signed-in users.

Completion criterion: an unchanged returning Discover visit downloads only the conditional manifest response, and an unchanged previously browsed Experience needs no detail response body.

Phase 4 evidence: the public cache-aware repository wraps both providers, stores summary and detail projections in IndexedDB with an in-memory front, and preserves cached content during background refresh. Unit request-budget tests and a real Flask integration flow cover first/returning Discover and repeated Experience navigation.

## Phase 5 — Progressive signed-in MyGita loading

- [x] Cache the authenticated user returned by Account creation or login instead of immediately calling `/me` again.
- [x] Resolve Identity once per route and share it with the shell and page composition.
- [x] Revalidate the private MyGita manifest after cached content renders.
- [x] Refresh only the private projections whose versions changed.
- [x] Cache Journey, interests, activity state, and Profile independently.
- [x] Use mutation responses to update in-memory projections instead of performing immediate follow-up GET requests.
- [x] Invalidate only affected projections after enrolment, interest registration, Profile update, or activity completion.
- [x] Ensure Atmajyoti navigation makes no `/me`, `/me/manifest`, or `/me/journey` calls.
- [x] Preserve route cancellation, stale-result suppression, normalized errors, and retry behavior during background refresh.

Completion criterion: signed-in navigation reuses valid MyGita projections, while mutations and version changes refresh only affected data.

Phase 5 evidence: OpenAPI 0.4 and Flask expose independent `/me/journeys`, `GET /me/interests`, and `/me/activity-state` projections whose ETags match the private manifest. The client caches Profile, Journey, interests, and activity state independently, composes the stable page-facing Journey state, renders saved records before scheduled background revalidation, and refreshes only changed versions. Authentication and mutation responses update memory without follow-up reads. Real Flask request-budget flows verify shared manifests, zero redundant `/me` reads, projection-selective external refresh, and precise local mutation invalidation.

## Phase 6 — Verification and request budgets

- [x] Verify first Atmajyoti Discover uses one manifest call and, when uncached, one summary call.
- [x] Verify unchanged returning Atmajyoti Discover uses only a conditional manifest call.
- [x] Verify opening a new Experience uses one detail call.
- [x] Verify opening an unchanged previously browsed Experience uses no detail response body.
- [x] Verify signed-in reads share the private manifest check.
- [x] Verify a Profile-only version change fetches `/me` but no Journey, interest, or activity-state projection.
- [x] Verify an interest-only version change fetches only `GET /me/interests`.
- [x] Verify enrolment, interest, Profile, and activity mutations do not trigger avoidable preflight or follow-up reads.
- [x] Verify concurrent callers are deduplicated and cancelled routes do not populate stale caches.
- [x] Verify fixture and API providers pass the same cache-aware repository contracts.
- [x] Verify sign-out, Account switching, `401`, offline use, corrupt cache recovery, and schema upgrades cannot expose private cached data incorrectly.
- [x] Add browser-level request-count assertions to CI.

Completion criterion: all correctness, privacy, offline, conditional-request, and request-budget tests pass in fixture and API modes.

Phase 6 evidence: deterministic cache tests cover coalescing, cancellation, corruption, schema replacement, sensitive-field rejection, and Account namespaces. Live Flask flows cover shared manifests, selective projection refresh, mutation budgets, Account switching, and session termination after `401`. A headless Chromium gate runs in the standard CI command and verifies real IndexedDB records, first and returning Discover budgets, repeated Experience detail reuse, offline rendering from saved public data, root/production-parity removal of developer UI, and both anonymous and personalized accessible greeting announcements.

Exact request counts are centralized in `mygita/tests/request-budgets.js` and enforced by a shared verifier in both live-Flask and Chromium flows. Each run regenerates [the request-budget verification report](request-budget-verification.md); unexpected, missing, or duplicate calls fail `check:request-budgets`, the standard `pnpm run check`, and therefore GitHub Actions.

## Deferred from this workstream

- Service-worker installation and full offline product delivery.
- Caching product-owned learning content inside MyGita.
- Replacement of the browser-readable bearer token with an HttpOnly cookie.
- Production CDN and reverse-proxy cache policy.
