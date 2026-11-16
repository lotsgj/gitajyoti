# Current state

Last reviewed: 2026-11-16

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to the public root `mygita.html` overview while the full `mygita/` application remains a separate experience.
- Images and CSS are externalized and optimized for progressive loading.
- Landing publishes Open Graph and large-image social metadata backed by a dedicated 1200×630 JPEG preview card.
- The public Landing and My Gita overview footers link to a shared Privacy & Analytics notice in a separate tab.
- The public Landing, My Gita overview, and privacy pages share a consent-gated Microsoft Clarity integration. It loads only on the production custom domains, uses project `yod8n0lesm`, and records an allowlisted set of navigation, interaction, and section-visibility events without personal form data.
- Root `mygita.html` presents two complementary learning approaches and four illustrated Experiences. Its Register action opens the dedicated public `register.html` page.
- `register.html` uses the same MyGita header language and an optional invitation panel. It accepts direct links such as `register.html?i=g4c-nov26-radhakrishna`, supports manual entry and no-invitation registration, and reuses the Profile review and success flow.
- Registration accesses the published public Profile API only through `registration-repository.js`. The shared contract-1.1 client supplies the browser mock during the current deployment and the live client/provider later; it validates invitations and records Profile–Invitation association in the same call.
- The former Sheet-bound Apps Script interest form has been removed. `register.html` itself selects live registration because production now serves contract 1.1; this remains correct whether GitHub Pages deploys from the branch or the vetted artifact. A local artifact build remains mock unless explicitly invoked with `REGISTRATION_DEPLOY_MODE=live`; every mock artifact switches both client URL and API base URL to the development contract client.

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
- `pnpm run check` from `dev-tools/` also runs a rendered-browser public Profile-registration regression and verifies the GitHub Pages artifact, in addition to the checked client, OpenAPI, server flow, build, and request-budget suites.
- GitHub Actions installs the pinned Flask dependency, then runs the complete development-tool check and Python API unit tests on pushes and pull requests.
- A separate Pages workflow builds a whitelisted public artifact with live Profile registration explicitly selected. An emergency rollback requires a reviewed workflow change rather than a stale repository variable.
