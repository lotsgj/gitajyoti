# MyGita current state

The current client is a fixture-backed prototype organized around Identity, Experience, and Journey. Route-level pages compose these features through their public entry points, and asynchronous repositories isolate the UI from feature-owned fixture providers. The separately implemented local mock API is not yet connected.

Working prototype capabilities include discovery, experience detail, batch choice, interest registration, simulated OTP, onboarding, journey display, activity completion, profile editing, and system states. State is stored in `sessionStorage`; learning content and artwork remain placeholders.

The client includes checked-JavaScript configuration and automated repository-contract, fixture-integrity, and architecture-boundary tests.

`mygita/src/config.js`, `core/api-client.js`, and `core/session.js` are intentionally retained as dormant scaffolding for the future API-provider phase. They are not imported by the current fixture-backed runtime. Keeping them is a conscious preparation choice rather than evidence that the browser is connected to `mygita.api`.

The browser fixture and mock-server seed data are intentionally independent during this phase. They share four experience IDs and three batch IDs. The browser currently defines three concrete Gita Sāra activities and supplies generic placeholders for nine other activity IDs that already have concrete mock-server records. Before an API provider is connected, define the OpenAPI model and either normalize these records through the adapter or add an explicit compatibility test; do not treat the two fixture shapes as one implicit contract.
