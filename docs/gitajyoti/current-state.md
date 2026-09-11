# Current state

Last reviewed: 2026-09-11

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to the relative `mygita/` region.
- Images and CSS are externalized and optimized for progressive loading.

## MyGita region

- A dependency-free ES-module client and reproducible, minified production build are implemented.
- Discover, experience detail, enrolment, interest, authentication, onboarding, journey, activity, profile, review, and system-state screens exist.
- Source-mode development defaults to fixture providers and permits explicit API selection. Production builds are API-only and ignore URL/runtime attempts to select fixtures.
- Route-level pages compose Identity, Experience, and Journey through public feature entry points.
- Asynchronous feature repositories isolate pages from fixture and API providers.
- Checked JavaScript, dual-provider repository contract tests, fixture-integrity tests, transport tests, import-boundary tests, and an API vertical-slice test are in place.
- Repository-boundary Phase 1 is complete.
- API transport handles bearer sessions, timeouts, cancellation, malformed responses, normalized errors, and expired-session cleanup.
- OpenAPI-generated runtime validators check HTTP responses before API providers normalize them into domain models.
- The prototype OTP `123456` remains available as a non-primary compatibility option.
- Username/password Account creation and login are now the primary client screens in fixture mode; API adapters are implemented against contract version 0.2.
- Profile setup after Account creation is optional and can be resumed from the Profile menu.
- Development-only screen maps, state routes, reset controls, and simulated OTP entry are hidden and unroutable in production builds.
- Production artifacts use hashed JavaScript and CSS assets and a standalone favicon; build verification is part of the client check.
- Route reads propagate cancellation through repository and API boundaries; newer navigation aborts and suppresses stale results.
- Forms share accessible pending and error presentation, including stable messages for known API errors.
- Expired authenticated sessions preserve a safe internal destination and resume it after sign-in. Network failures provide an in-place retry and reconnect refresh.
- Learning illustrations and activity sessions remain placeholders.

## MyGita server

- A local Python mock API implements catalogue, password Account, OTP compatibility, profile, onboarding, journey, interest, and activity operations.
- Server application logic depends on an injected `Store` interface. `JsonStore` remains the default local implementation; `SqliteStore` is available with `dev_server.py --store sqlite`.
- `SqliteStore` persists Identity and Journey runtime data in an ignored SQLite database, enforces username, active-Journey, and interest uniqueness in the database, and reseeds reference data from the existing JSON fixtures on startup.
- The persistence boundary remains partial because `JsonStore` still exposes live mutable records and does not provide the same operation-level atomicity as `SqliteStore`.
- The same 17 API behavior tests pass against JSON and SQLite (34 concrete-store tests total), including Account and legacy-user reload persistence.
- The browser can use the mock API through explicit provider selection; fixture behavior remains available independently.
- Server-backed API-provider flows verify the complete OTP-based Gita Sāra journey and the password lifecycle: Account creation, optional Profile skip, enrolment, sign-out, password login, and restored Journey state.
- Browser fixtures and mock-server seed data remain independently authored; API adapters normalize the server model into the stable repository contracts.
- The current server uses Python's `ThreadingHTTPServer`; a Flask migration is not present in this checkout.
- Neither the mock server nor the local SQLite configuration is yet an approved production identity, application-server, or database deployment.

## Products and contracts

- Four products are identified, but no product applications are implemented in this repository.
- The OpenAPI 3.1 `mygita.api` contract describes every current mock API operation, shared schemas, bearer authentication, and the standard error envelope.
- Contract version 0.2 additionally defines username/password Account creation and login; both client and server implementations are present.
- Contract linting, 78 request/response example validations, and 20 server-response compatibility validations pass.
- Identity, Experience, and Journey API providers implement the same contracts as fixture providers.
- Product launch, enrolment provisioning, identity exchange, and progress synchronization are design work.

## Development verification

- Development-tool declarations and their lock file live in `dev-tools/` and are version-controlled.
- Generated `dev-tools/node_modules/` content is ignored and recreated with `pnpm install --frozen-lockfile`.
- `pnpm run check` from `dev-tools/` runs checked-JavaScript analysis, client and provider tests, production-build verification, generated-validator freshness, OpenAPI linting, example and mock-response validation, and the Gita Sāra API flow.
- GitHub Actions runs the complete development-tool check and the Python mock API unit tests on pushes and pull requests.
