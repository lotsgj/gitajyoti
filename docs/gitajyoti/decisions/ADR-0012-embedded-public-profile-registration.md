# ADR-0012: Embedded public Profile registration

- Status: Superseded
- Implementation: Superseded
- Supersedes: ADR-0011
- Superseded by: ADR-0013
- Date: 2026-11-15

## Context

The temporary Apps Script interest form no longer matches the public experience. MyGita now presents the available learning approaches and Experiences itself, and a visitor needs one reusable Profile before entering the separate MyGita application. The Profile API contract and browser client exist, while the live `POST /v1/profiles` implementation is not yet available.

## Decision

Embed Profile registration as an overlay in root `mygita.html`. Keep page composition and API access separate through `register-page.js` and `registration-repository.js`. The UI sends only the six contract fields and hands a successfully created Profile to `https://mygita.gitajyoti.org/?pid=<profile-id>`. Invitation-code support is deferred.

The root-served source uses the development client and live development API so the public flow can be accepted before production switchover. A dedicated public-site build replaces development hosts with `api.gitajyoti.org`. Its registration mode is controlled only by `REGISTRATION_DEPLOY_MODE`, defaults to `mock`, and must be deliberately changed to `live` after the production endpoint is accepted. The obsolete Sheet-bound Apps Script package is removed.

## Consequences

- MyGita overview and Profile creation feel like one public experience.
- The mock provides a complete UX review without implying that durable registration is live.
- Production deployment cannot accidentally use the development API hostname.
- Activating live mode requires the production Profile endpoint, Turnstile, origin policy, and browser acceptance checks to pass.
- The Profile ID is currently carried in the MyGita application URL; a later identity handoff design should replace this with an appropriately protected exchange if the identifier becomes sensitive or authoritative.

## Implementation evidence

Root `mygita.html`, `assets/js/register-page.js`, and `assets/js/registration-repository.js` implement the overlay and contract adapter. `dev-tools/scripts/verify-profile-registration.mjs` covers browser validation, duplicate handling, the exact submitted fields, Profile creation, MyGita handoff, localhost, and direct-file review. The GitHub Pages artifact build and verifier keep deployment mode explicit.

## Relationship to earlier decisions

This decision supersedes [ADR-0011](ADR-0011-v1-interest-registration.md). It complements the Account/Profile separation in [ADR-0010](ADR-0010-account-profile-authenticator-separation.md); creating this public Profile still does not create an Account, authentication session, enrolment, or Journey.

## Supersession

[ADR-0013](ADR-0013-public-registration-page-and-invitations.md) replaces the embedded overlay with a shareable public registration page and adds optional invitation-code association.
