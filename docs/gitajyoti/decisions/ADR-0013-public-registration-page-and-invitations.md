# ADR-0013: Public registration page with optional invitations

- Status: Accepted
- Implementation: Partial
- Supersedes: ADR-0012
- Superseded by: None
- Date: 2026-11-16

## Context

The embedded Profile overlay made first-time registration feel part of MyGita, but it could not provide a durable, shareable location for an Acharya's learning-group invitation. An invitation must be optional: a visitor can create a Profile directly, manually apply an invitation code, or arrive through a link containing a code.

## Decision

Use `register.html` as the public Profile-registration page. MyGita's Register call-to-action navigates there. The page shares MyGita's header language and reuses the Profile form, review dialog, success state, and handoff.

An optional invitation panel sits above Profile details. `register.html?i=<invite-code>` pre-fills and validates the code; a visitor may also enter a code manually or continue without one. Invitation context is separate from the six Profile fields. The browser uses the public Profile contract's shared client through `registration-repository.js`; the current deployment uses that client's mock provider and live mode will use the same provider interface.

The public API contract is `GET /v1/invitations/{code}` and an optional top-level `invitation_code` on `POST /v1/profiles`. The server validates an invitation again while creating the Profile and atomically records its association; it does not create an Account, enrolment, Journey, or product access. If the same Profile details are submitted with a new valid invitation, the operation is successful and returns `created: false` rather than treating it as a duplicate.

## Consequences

- Acharyas can share a precise registration link without duplicating the Profile form.
- The registration page remains usable with no invitation.
- API activation becomes a repository change, not a page redesign.
- Invitation codes must be opaque, rate-limited, and revalidated server-side; a URL is not proof of eligibility.

## Implementation evidence

`register.html`, `assets/js/register-page.js`, and `assets/js/registration-repository.js` implement the page and contract-client invitation states. Browser regression covers normal registration, invitation link loading, invalid code handling, profile/invitation association, review, and direct-file support.

## Relationship to earlier decisions

This supersedes [ADR-0012](ADR-0012-embedded-public-profile-registration.md) only in public page composition and adds an invitation association. It preserves the Account/Profile distinction in [ADR-0010](ADR-0010-account-profile-authenticator-separation.md).
