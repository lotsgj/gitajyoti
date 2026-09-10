# Current state

Last reviewed: 2026-09-10

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to the relative `mygita/` region.
- Images and CSS are externalized and optimized for progressive loading.

## MyGita region

- A dependency-free ES-module client is implemented.
- Discover, experience detail, enrolment, interest, authentication, onboarding, journey, activity, profile, review, and system-state screens exist.
- Fixture providers remain the default and store prototype state in `sessionStorage`; `?provider=api` explicitly selects API-backed repositories.
- Route-level pages compose Identity, Experience, and Journey through public feature entry points.
- Asynchronous feature repositories isolate pages from fixture and API providers.
- Checked JavaScript, dual-provider repository contract tests, fixture-integrity tests, transport tests, import-boundary tests, and an API vertical-slice test are in place.
- Repository-boundary Phase 1 is complete.
- API transport handles bearer sessions, timeouts, cancellation, malformed responses, normalized errors, and expired-session cleanup.
- OpenAPI-generated runtime validators check HTTP responses before API providers normalize them into domain models.
- Authentication uses the prototype OTP `123456` in the browser.
- Learning illustrations and activity sessions remain placeholders.

## MyGita server

- A local Python mock API implements catalogue, OTP, profile, onboarding, journey, interest, and activity operations.
- Runtime data is persisted to ignored JSON state.
- Seven API tests pass.
- The browser can use the mock API through explicit provider selection; fixture behavior remains available independently.
- The complete Gita Sāra prototype flow is verified through the API: catalogue, OTP, onboarding, batch enrolment, journey, activity completion, and profile update.
- Browser fixtures and mock-server seed data remain independently authored; API adapters normalize the server model into the stable repository contracts.
- The mock server is not a production identity or persistence service.

## Products and contracts

- Four products are identified, but no product applications are implemented in this repository.
- The OpenAPI 3.1 `mygita.api` contract describes every current mock API operation, shared schemas, bearer authentication, and the standard error envelope.
- Contract linting, 66 request/response example validations, and compatibility checks over 17 captured mock API responses run locally and in CI.
- Identity, Experience, and Journey API providers implement the same contracts as fixture providers.
- Product launch, enrolment provisioning, identity exchange, and progress synchronization are design work.

## Development verification

- Development-tool declarations and their lock file live in `dev-tools/` and are version-controlled.
- Generated `dev-tools/node_modules/` content is ignored and recreated with `pnpm install --frozen-lockfile`.
- `pnpm run check` from `dev-tools/` runs checked-JavaScript analysis, client and provider tests, generated-validator freshness, OpenAPI linting, example and mock-response validation, and the Gita Sāra API flow.
- GitHub Actions runs the complete development-tool check and the Python mock API unit tests on pushes and pull requests.
