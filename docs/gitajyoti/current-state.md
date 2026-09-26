# Current state

Last reviewed: 2026-09-26

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to a production-safe root `mygita.html` holding page while the full `mygita/` region remains under development.
- Images and CSS are externalized and optimized for progressive loading.
- Landing publishes Open Graph and large-image social metadata backed by a dedicated 1200×630 JPEG preview card.
- The public Landing and My Gita overview footers link to a shared Privacy & Analytics notice in a separate tab.
- The public Landing, My Gita overview, and privacy pages share a consent-gated Microsoft Clarity integration. It loads only on the production custom domains, uses project `yod8n0lesm`, and records an allowlisted set of navigation, interaction, and section-visibility events without personal form data.
- Root `mygita.html` presents a responsive Coming Soon overview of the four planned Experiences without calling an API or exposing incomplete registration interactions.
- A separate V1 `register/` Apps Script interest form now reads active Experience and Offering choices from the existing private Sheet's master tabs and writes selected Offering IDs into one seven-column Registration row. It is not deployed or linked from the site.

## MyGita region

- A dependency-free ES-module client and reproducible, minified production build are implemented.
- Discover, experience detail, enrolment, interest, authentication, onboarding, journey, activity, profile, and user-facing system-state screens exist.
- Root-served source and built output have the same provider behavior: API is the default and `?provider=fixture` is the explicit fixture override.
- Route-level pages compose Identity, Experience, and Journey through public feature entry points.
- Asynchronous feature repositories isolate pages from fixture and API providers.
- Checked JavaScript, dual-provider repository contract tests, fixture-integrity tests, transport tests, import-boundary tests, and an API vertical-slice test are in place.
- Repository-boundary Phase 1 is complete.
- API transport handles bearer sessions, timeouts, cancellation, malformed responses, normalized errors, and expired-session cleanup.
- OpenAPI-generated runtime validators check HTTP responses before API providers normalize them into domain models.
- OTP remains available at the server-contract boundary for compatibility testing but is not exposed in the UI.
- Username/password Account creation and login are the client Identity screens in fixture and API modes.
- Data-use optimization Phases 1–6 are complete: Flask implements versioned public/private projections and conditional requests; the client progressively caches public Experience and Account-specific data in memory and IndexedDB, selectively refreshes changed projections, and enforces tested request budgets and Account isolation.
- Profile setup after Account creation is optional and can be resumed from the Profile menu.
- Developer screen maps, developer state routes, reset controls, runtime feature flags, and simulated OTP entry have been removed from the shared source rather than conditionally hidden.
- Production artifacts use hashed JavaScript and CSS assets and a standalone favicon; build verification is part of the client check.
- Route reads propagate cancellation through repository and API boundaries; newer navigation aborts and suppresses stale results.
- Forms share accessible pending and error presentation, including stable messages for known API errors.
- Expired authenticated sessions preserve a safe internal destination and resume it after sign-in. Network failures provide an in-place retry and reconnect refresh.
- Learning illustrations and activity sessions remain placeholders.

## MyGita server

- A local Flask API implements catalogue, password Account, OTP compatibility, profile, onboarding, journey, interest, and activity operations.
- Server application logic depends on an injected `Store` interface. `JsonStore` remains the default local implementation; `SqliteStore` is available with `dev_server.py --store sqlite`.
- `SqliteStore` persists Identity and Journey runtime data in an ignored SQLite database, enforces username, active-Journey, and interest uniqueness in the database, and reseeds reference data from the existing JSON fixtures on startup.
- The persistence boundary remains partial because `JsonStore` still exposes live mutable records and does not provide the same operation-level atomicity as `SqliteStore`.
- The same API behavior suite passes against JSON and SQLite, including version semantics, conditional requests, Account isolation, concurrency, and persistence.
- The browser can use the mock API through explicit provider selection; fixture behavior remains available independently.
- Server-backed API-provider flows verify the complete OTP-based Gita Sāra journey and the password lifecycle: Account creation, optional Profile skip, enrolment, sign-out, password login, and restored Journey state.
- Browser fixtures and mock-server seed data remain independently authored; API adapters normalize the server model into the stable repository contracts.
- The Flask application factory is exercised through its WSGI test client. Local development uses Flask's threaded development server; `wsgi.py` exposes a separately configured WSGI entry point and requires an explicit stable signing secret.
- Neither the Flask development server nor the local SQLite configuration is yet an approved production identity, WSGI hosting, or database deployment.

## Products and contracts

- Four products are identified, but no product applications are implemented in this repository.
- The OpenAPI 3.1 `mygita.api` contract describes every current mock API operation, shared schemas, bearer authentication, and the standard error envelope.
- Contract version 0.2 added username/password Account creation and login; version 0.3 added public/private manifests; version 0.4 adds independently cacheable Journey, interest, and activity-state projections. Client and server implementations are present.
- Contract linting, 98 request/response example validations, and 26 implemented server-response compatibility validations pass.
- Identity, Experience, and Journey API providers implement the same contracts as fixture providers.
- Product launch, enrolment provisioning, identity exchange, and progress synchronization are design work.

## Development verification

- Development-tool declarations and their lock file live in `dev-tools/` and are version-controlled.
- Generated `dev-tools/node_modules/` content is ignored and recreated with `pnpm install --frozen-lockfile`.
- `pnpm run check` from `dev-tools/` runs checked-JavaScript analysis, 53 client/provider/cache tests, production-build verification, generated-validator freshness, OpenAPI linting, example and mock-response validation, eight live Flask flows, and a Chromium IndexedDB/accessibility/offline/request-budget gate.
- GitHub Actions installs the pinned Flask dependency, then runs the complete development-tool check and Python API unit tests on pushes and pull requests.
