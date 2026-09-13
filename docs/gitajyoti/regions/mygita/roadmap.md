# MyGita roadmap

## Completed

- Organize the client into domain-agnostic core, Identity/Experience/Journey features, route-level pages, and the MyGita shell.
- Put fixture behavior behind checked, asynchronous repositories exposed through feature public entry points.
- Move all page data access through feature repositories.
- Define and verify the OpenAPI 3.1 `mygita.api` contract against examples and current mock API responses.
- Add runtime-validated API providers for Identity, Experience, and Journey with explicit provider selection.
- Verify one complete Gita Sāra API vertical slice.
- Produce a minified client with hashed assets whose API-first runtime behavior matches the root-served source and retains the explicit fixture override.
- Add route cancellation, stale-result protection, structured interaction errors, accessible form feedback, reconnect retry, and post-login destination restoration.
- Add an interchangeable SQLite persistence implementation and run the shared API behavior suite against both current stores.
- Migrate the API transport to a Flask application factory, verify it through the WSGI test client, and expose a deployment-style WSGI entry point.
- Implement data-use optimization Phases 1–5: version contracts, Flask conditional requests, durable client caches, progressive public Experience loading, and selective Account-projection refresh.

## Next

1. Use the completed [data-use optimization checklist](data-use-optimization.md) as the regression baseline while extending MyGita and product integrations.
2. Define common product-integration concepts and the first product-specific API contract.
3. Add secure product launch and enrolment provisioning.
4. Aggregate product progress into My Journey.

## Deferred production decisions

- Replace prototype identity and persistence with approved production services.
- Replace the browser-stored bearer token with a server-managed opaque session in a `Secure`, `HttpOnly`, `SameSite` cookie.
- Add logout, expiry, revocation, credentialed CORS, origin enforcement, and CSRF protection for the cookie-based session.
