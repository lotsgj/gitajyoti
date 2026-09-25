# Implementation checklist

## Documentation baseline

- [x] Define site, region, product, and experience terminology.
- [x] Record system boundaries and current state.
- [x] Record repository, OpenAPI, validation, and product API decisions.
- [x] Establish product and contract naming conventions.
- [x] Define Identity, Experience, and Journey feature boundaries and page composition.
- [x] Add a single human-readable design entry point.
- [x] Document intentional API scaffolding and the independence of browser and server fixtures.

## UI to repository

- [x] Establish `core`, `features`, `pages`, and `shell` source boundaries.
- [x] Declare UI-to-repository interfaces for Identity, Experience, and Journey.
- [x] Expose each feature through a public entry point.
- [x] Implement fixture providers behind repositories.
- [x] Make repository methods consistently asynchronous.
- [x] Remove direct fixture-service imports from UI modules.
- [x] Move route-level screens to `pages` and compose features only through public entry points.
- [x] Add loading, empty, offline, and error handling around repository calls.
- [x] Run the same contract tests against every current provider implementation.

## MyGita API contract

- [x] Create `contracts/mygita-api/openapi.yaml` using OpenAPI 3.1.
- [x] Define operations, schemas, authentication, and the standard error envelope.
- [x] Add request and response examples.
- [x] Lint the OpenAPI document and validate examples in CI.
- [x] Validate mock-server responses against the contract.

## Design-time safety

- [x] Add `// @ts-check` to client modules.
- [x] Add checked-JavaScript `jsconfig.json` with strict null checking.
- [x] Define JSDoc domain types and repository interfaces.
- [x] Run `tsc --noEmit` in CI.
- [x] Validate fixture relationships and identifiers.

## Runtime safety

- [x] Validate data at the API adapter boundary.
- [x] Normalize transport responses before repositories return domain data.
- [x] Standardize contract and API errors.
- [x] Validate user input in the client and enforce it again on the server.
- [x] Handle expired sessions, request cancellation, timeouts, and duplicate submissions.

## Server persistence

- [x] Introduce an injected, intent-revealing `Store` boundary between application logic and persistence.
- [x] Keep the OpenAPI client/server contract independent of the server persistence implementation.
- [x] Add a durable SQLite store for runtime Identity and Journey data while retaining JSON-authored reference data.
- [x] Enforce username, active-Journey, and interest uniqueness with SQLite constraints and map conflicts to stable API errors.
- [ ] Prevent store implementations from returning live mutable references to internal state.
- [ ] Make update operations mutate and commit atomically inside the store boundary.
- [x] Run the shared API behavior suite against every current store implementation.

## Server application framework

- [x] Migrate HTTP routing and error mapping to a Flask application factory without changing the OpenAPI boundary.
- [x] Exercise server and OpenAPI compatibility tests through Flask's WSGI test client.
- [x] Provide a WSGI entry point that requires an explicit stable signing secret.
- [x] Install pinned server dependencies in CI before client, OpenAPI, and server verification.
- [ ] Select and configure the production WSGI host, process model, observability, and secret management.

## Password account identity

- [x] Separate Account, Profile, Login Identifier, Authenticator, Contact Point, Identity Evidence, and Recovery Method in the architecture.
- [x] Define password Account creation and login in the authoritative OpenAPI contract.
- [x] Implement Account, Login Identifier, password Authenticator, and pending Profile persistence on the server.
- [x] Implement password Account creation and login on the server.
- [x] Add password registration and login to the client Identity repository contract.
- [x] Implement matching fixture and API Identity providers.
- [x] Replace the OTP-first client screens with create-account and password-login compositions.
- [x] Make post-registration Profile setup optional and keep Profile accessible from the Account menu.
- [x] Verify the server-backed happy path for Account creation, optional Profile skip, enrolment, sign-out, password login, and restored Journey state.
- [ ] Verify password registration, login, onboarding, reload, and failure flows across fixture and API modes.

## Product integration

- [ ] Define common learner, enrolment, launch, progress, completion, error, and correlation concepts.
- [ ] Create product-specific OpenAPI contracts when each integration is designed.
- [ ] Keep browser-to-product trust and credentials out of the client.
- [ ] Route secure product integration through `mygita.api`.

## Public V1 interest registration

- [x] Build the isolated Apps Script form and Sheet handler, with server-side validation, honeypot, reCAPTCHA v2 verification, consent, and guardian confirmation.
- [x] Read active Experiences and their active Offerings from the existing Sheet; treat each Offering row, including joint-Acharya rows, as one choice and enforce at most one Offering per Experience.
- [x] Write one Registration row per submission using the existing seven columns and all selected Offering IDs.
- [x] Document the existing Sheet schema, script properties, deployment, and live-verification steps in `register/setup.md`.
- [x] Add registration-handler tests to the development check.
- [ ] Owner deploys the Sheet-bound script, configures keys and the verified frame-host suffix, and verifies signed-out browser submissions and Sheet rows.
- [ ] Decide whether to add durable submission-ID and consent/guardian-evidence storage before public launch; the current seven columns cannot support those guarantees.
- [x] Add a production-safe root `mygita.html` Coming Soon overview and point every Landing My Gita link to it without exposing the unfinished application.
- [ ] After owner confirms the Apps Script deployment, add the registration popup/iframe to root `mygita.html`.
- [ ] Approve privacy notice, retention, WhatsApp invitation policy, and child-data handling before accepting public registrations.

## Data-use optimization

- [x] Complete the six phases in the [MyGita data-use optimization checklist](regions/mygita/data-use-optimization.md).

## Production UI foundation

- [x] Keep root-served source and built output API-first with the same explicit `?provider=fixture` override.
- [x] Remove development screen maps, developer state routes, fixture reset, runtime feature flags, and simulated OTP UI from the shared runtime.
- [x] Add a reproducible minified build with content-hashed JavaScript and CSS assets.
- [x] Verify generated production assets and development-feature policy in automated checks.
- [x] Standardize visible client terminology on `MyGita` and remove prototype wording from production screens.
- [x] Add structured interaction errors and reusable accessible form pending/error presentation.
- [x] Propagate route cancellation through repository/API reads and suppress stale navigation results.
- [x] Preserve safe intended destinations across session expiry and refresh failed routes after reconnect.
- [ ] Add section-level loading, cached-content preservation, and background refresh where product-backed Journey details require them.
- [ ] Replace simulated learning completion with product-owned activity or secure product launch.
- [x] Add rendered-browser and accessibility quality gates.
- [ ] Add a visual-regression quality gate.

## Deferred production decisions

- [ ] Select identity and SMS providers.
- [ ] Replace the prototype bearer token and browser storage with an opaque server session and a `Secure`, `HttpOnly`, `SameSite` cookie.
- [ ] Add logout, session expiry and revocation, credentialed CORS, exact origin checks, and CSRF protection.
- [ ] Select production API hosting and database.
- [ ] Define guardian and child-account policies.
- [ ] Define privacy, consent, safeguarding, and data retention.
- [ ] Approve curricula, media, and product artwork.
