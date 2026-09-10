# Current state

Last reviewed: 2026-09-10

## Site

- The Landing region is implemented as a responsive static page.
- Landing links to the relative `mygita/` region.
- Images and CSS are externalized and optimized for progressive loading.

## MyGita region

- A dependency-free ES-module client is implemented.
- Discover, experience detail, enrolment, interest, authentication, onboarding, journey, activity, profile, review, and system-state screens exist.
- Client behavior is fixture-driven and stored in `sessionStorage`.
- The client imports the fixture service directly; UI-to-repository migration has not started.
- Authentication uses the prototype OTP `123456` in the browser.
- Learning illustrations and activity sessions remain placeholders.

## MyGita server

- A local Python mock API implements catalogue, OTP, profile, onboarding, journey, interest, and activity operations.
- Runtime data is persisted to ignored JSON state.
- Seven API tests pass.
- The browser client is not connected to the mock API.
- The mock server is not a production identity or persistence service.

## Products and contracts

- Four products are identified, but no product applications are implemented in this repository.
- No OpenAPI contracts exist yet.
- Product launch, enrolment provisioning, identity exchange, and progress synchronization are design work.
