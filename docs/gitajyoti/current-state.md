# Current state

Last reviewed: 2026-09-10

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to the relative `mygita/` region.
- Images and CSS are externalized and optimized for progressive loading.

## MyGita region

- A dependency-free ES-module client is implemented.
- Discover, experience detail, enrolment, interest, authentication, onboarding, journey, activity, profile, review, and system-state screens exist.
- Client behavior remains fixture-driven and stored in `sessionStorage`.
- Route-level pages compose Identity, Experience, and Journey through public feature entry points.
- Asynchronous feature repositories isolate pages from domain-specific fixture providers.
- Checked JavaScript, repository contract tests, fixture-integrity tests, and import-boundary tests are in place.
- Repository-boundary Phase 1 is complete.
- API client, session, and configuration scaffolding is intentionally retained for the future API-provider phase; it is not used by the current fixture-backed pages.
- Authentication uses the prototype OTP `123456` in the browser.
- Learning illustrations and activity sessions remain placeholders.

## MyGita server

- A local Python mock API implements catalogue, OTP, profile, onboarding, journey, interest, and activity operations.
- Runtime data is persisted to ignored JSON state.
- Seven API tests pass.
- The browser client is not connected to the mock API.
- Browser fixtures and mock-server seed data are currently independent. Shared identifiers align where needed, but the server's larger activity dataset is not an implicit client contract.
- The mock server is not a production identity or persistence service.

## Products and contracts

- Four products are identified, but no product applications are implemented in this repository.
- No OpenAPI contracts exist yet.
- Product launch, enrolment provisioning, identity exchange, and progress synchronization are design work.

## Development verification

- Development-tool declarations and their lock file live in `dev-tools/` and are version-controlled.
- Generated `dev-tools/node_modules/` content is ignored and recreated with `pnpm install --frozen-lockfile`.
- `pnpm run check:mygita` from `dev-tools/` runs checked-JavaScript analysis, repository contract tests, fixture-integrity tests, and import-boundary tests.
