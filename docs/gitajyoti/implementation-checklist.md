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
- [ ] Prevent store implementations from returning live mutable references to internal state.
- [ ] Make update operations mutate and commit atomically inside the store boundary.
- [ ] Run shared persistence-contract tests against every store implementation.

## Product integration

- [ ] Define common learner, enrolment, launch, progress, completion, error, and correlation concepts.
- [ ] Create product-specific OpenAPI contracts when each integration is designed.
- [ ] Keep browser-to-product trust and credentials out of the client.
- [ ] Route secure product integration through `mygita.api`.

## Deferred production decisions

- [ ] Select identity and SMS providers.
- [ ] Replace the prototype bearer token and browser storage with an opaque server session and a `Secure`, `HttpOnly`, `SameSite` cookie.
- [ ] Add logout, session expiry and revocation, credentialed CORS, exact origin checks, and CSRF protection.
- [ ] Select production API hosting and database.
- [ ] Define guardian and child-account policies.
- [ ] Define privacy, consent, safeguarding, and data retention.
- [ ] Approve curricula, media, and product artwork.
