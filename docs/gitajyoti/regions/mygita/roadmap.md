# MyGita roadmap

## Completed

- Organize the client into domain-agnostic core, Identity/Experience/Journey features, route-level pages, and the MyGita shell.
- Put fixture behavior behind checked, asynchronous repositories exposed through feature public entry points.
- Move all page data access through feature repositories.
- Define and verify the OpenAPI 3.1 `mygita.api` contract against examples and current mock API responses.
- Add runtime-validated API providers for Identity, Experience, and Journey with explicit provider selection.
- Verify one complete Gita Sāra API vertical slice.
- Produce an API-only, minified production client with hashed assets and development-only feature gates.
- Add route cancellation, stale-result protection, structured interaction errors, accessible form feedback, reconnect retry, and post-login destination restoration.
- Add an interchangeable SQLite persistence implementation and run the shared API behavior suite against both current stores.

## Next

1. Define common product-integration concepts and the first product-specific API contract.
2. Add secure product launch and enrolment provisioning.
3. Aggregate product progress into My Journey.

## Deferred production decisions

- Replace prototype identity and persistence with approved production services.
- Replace the browser-stored bearer token with a server-managed opaque session in a `Secure`, `HttpOnly`, `SameSite` cookie.
- Add logout, expiry, revocation, credentialed CORS, origin enforcement, and CSRF protection for the cookie-based session.
