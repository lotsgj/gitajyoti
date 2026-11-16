# ADR-0014: Published public Profile API client is the registration contract authority

- Status: Accepted
- Implementation: Partial
- Supersedes: None
- Superseded by: None
- Date: 2026-11-16

## Context

The public registration page originally used a website-owned invitation fixture alongside a Profile adapter. The API server now publishes contract 1.1 with invitation lookup, Profile creation, Profile–Invitation association, and an equivalent mock client. Maintaining a separate browser fixture would make the website's invitation shape drift from the server contract.

## Decision

Use the published public Profile client only through `registration-repository.js`. The repository calls `createMockApi()` in mock mode and `connect()` in live mode. It exposes page-oriented `validateProfile`, `getInvitation`, and `createProfile` methods while preserving the published request and response semantics.

The deployed site remains in mock mode until the production client and endpoint implement contract 1.1. The mock artifact may therefore use the development client intentionally. Live mode must switch the client URL and API base URL as a single deployment setting.

## Consequences

- Website invitation display, validation, and Profile association follow one contract source.
- The UI does not own a parallel invitation-data fixture.
- Production activation remains explicit and cannot silently pair a contract-1.1 page with a contract-1.0 client.
- The public Profile API remains separate from the internal MyGita application OpenAPI contract.

## Implementation evidence

`registration-repository.js` is the only browser importer of the public client. `verify-profile-registration.mjs` intercepts that client with a contract-shaped test implementation and verifies normal registration, invitation association, validation, error states, and MyGita handoff. The public build verifier checks mock and live host selection.

## Relationship to earlier decisions

This refines [ADR-0013](ADR-0013-public-registration-page-and-invitations.md). It does not change the Account/Profile boundary in [ADR-0010](ADR-0010-account-profile-authenticator-separation.md).
