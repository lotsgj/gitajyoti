# MyGita current state

The current client supports fixture and API-backed implementations organized around Identity, Experience, and Journey. Route-level pages compose these features through public entry points, and asynchronous repositories isolate the UI from provider choice. Fixtures remain the default; `?provider=api` explicitly selects the local mock API.

Working prototype capabilities include discovery, experience detail, batch choice, interest registration, simulated OTP, onboarding, journey display, activity completion, profile editing, and system states. State is stored in `sessionStorage`; learning content and artwork remain placeholders.

The client includes checked-JavaScript configuration, OpenAPI-generated runtime validators, normalized transport errors, timeouts and cancellation, bearer-session handling, and automated repository-contract, fixture-integrity, transport, architecture-boundary, and API-flow tests.

Identity, Experience, and Journey each have fixture and API providers implementing the same checked repository contract. API responses are runtime-validated against generated OpenAPI validators and normalized before they cross into the UI-facing domain model.

The browser fixture and mock-server seed data remain independently authored. They share four experience IDs and three batch IDs. The browser defines three concrete Gita Sāra activities and supplies generic placeholders for nine other IDs that have concrete mock-server records. The OpenAPI model, generated validators, adapter normalization, and compatibility tests now make this difference explicit. The complete Gita Sāra API flow is verified through OTP, onboarding, enrolment, journey, activity completion, and profile update.
