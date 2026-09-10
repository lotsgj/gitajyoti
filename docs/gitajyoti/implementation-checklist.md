# Implementation checklist

## Documentation baseline

- [x] Define site, region, product, and experience terminology.
- [x] Record system boundaries and current state.
- [x] Record repository, OpenAPI, validation, and product API decisions.
- [x] Establish product and contract naming conventions.

## UI to repository

- [ ] Declare UI-to-repository interfaces for experiences, authentication, journeys, and activities.
- [ ] Implement fixture providers behind repositories.
- [ ] Make repository methods consistently asynchronous.
- [ ] Remove direct fixture-service imports from UI modules.
- [ ] Add loading, empty, offline, and error handling around repository calls.
- [ ] Run the same contract tests against every provider implementation.

## MyGita API contract

- [ ] Create `contracts/mygita-api/openapi.yaml` using OpenAPI 3.1.
- [ ] Define operations, schemas, authentication, and the standard error envelope.
- [ ] Add request and response examples.
- [ ] Lint the OpenAPI document and validate examples in CI.
- [ ] Validate mock-server responses against the contract.

## Design-time safety

- [ ] Add `// @ts-check` to client modules.
- [ ] Add a strict `jsconfig.json`.
- [ ] Define JSDoc domain types and repository interfaces.
- [ ] Run `tsc --noEmit` in CI.
- [ ] Validate fixture relationships and identifiers.

## Runtime safety

- [ ] Validate data at the API adapter boundary.
- [ ] Normalize transport responses before repositories return domain data.
- [ ] Standardize contract and API errors.
- [ ] Validate user input in the client and enforce it again on the server.
- [ ] Handle expired sessions, request cancellation, timeouts, and duplicate submissions.

## Product integration

- [ ] Define common learner, enrolment, launch, progress, completion, error, and correlation concepts.
- [ ] Create product-specific OpenAPI contracts when each integration is designed.
- [ ] Keep browser-to-product trust and credentials out of the client.
- [ ] Route secure product integration through `mygita.api`.

## Deferred production decisions

- [ ] Select identity and SMS providers.
- [ ] Select production API hosting and database.
- [ ] Define guardian and child-account policies.
- [ ] Define privacy, consent, safeguarding, and data retention.
- [ ] Approve curricula, media, and product artwork.
