# MyGita current state

The current client supports fixture and API-backed implementations organized around Identity, Experience, and Journey. Route-level pages compose these features through public entry points, and asynchronous repositories isolate the UI from provider choice. Source-mode development defaults to fixtures and permits explicit API selection. The production build is API-only.

Working prototype capabilities include discovery, experience detail, batch choice, interest registration, simulated OTP, onboarding, journey display, activity completion, profile editing, and system states. State is stored in `sessionStorage`; learning content and artwork remain placeholders.

The client includes checked-JavaScript configuration, OpenAPI-generated runtime validators, normalized transport errors, timeouts and route cancellation, stale-navigation suppression, bearer-session handling, safe post-login destination restoration, accessible form pending/error states, reconnect retry, and automated repository-contract, fixture-integrity, transport, architecture-boundary, API-flow, and production-build tests. Production output is minified, uses hashed JavaScript and CSS assets, and disables development-only routes, reset controls, fixture selection, and simulated OTP UI.

Identity, Experience, and Journey each have fixture and API providers implementing the same checked repository contract. API responses are runtime-validated against generated OpenAPI validators and normalized before they cross into the UI-facing domain model.

The browser fixture and mock-server seed data remain independently authored. They share four experience IDs and three batch IDs. The browser defines three concrete Gita Sāra activities and supplies generic placeholders for nine other IDs that have concrete mock-server records. The OpenAPI model, generated validators, adapter normalization, and compatibility tests now make this difference explicit. Automated server-backed flows verify both the complete OTP-based Gita Sāra journey and password Account creation, optional Profile skip, enrolment, sign-out, password login, and restored Journey state.

OpenAPI contract version 0.2 defines additive username/password Account creation and login operations. The client repository, fixture/API providers, primary registration/login pages, and server implement that boundary. The server-backed password lifecycle is covered by an automated API-provider flow. Profile setup is an optional post-registration step and remains accessible from the My profile menu. Existing OTP behavior remains available as a non-primary prototype option during this migration.

The local API server has interchangeable JSON and SQLite persistence implementations. JSON remains the default; the opt-in SQLite store durably persists runtime Identity and Journey data and is covered by the same 17 API behavior tests. The server is still based on Python's `ThreadingHTTPServer`; Flask is not present in this checkout.
