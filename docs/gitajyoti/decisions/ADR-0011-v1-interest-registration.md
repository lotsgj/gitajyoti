# ADR-0011: V1 interest registration beside MyGita

- Status: Accepted
- Implementation: Partial
- Supersedes: None
- Superseded by: None
- Date: 2026-09-18

## Context

The full MyGita Account, Journey, and product integrations are still in development. The first public Gita Jyoti site needs a simpler way for people to express interest in the four planned Experiences without implying digital enrolment is available.

## Decision

Create a temporary V1 interest-registration path alongside, not inside, the MyGita Account flow. A Google Apps Script-hosted form reads active Experiences and active Offerings from master tabs in a private Google Sheet. Each Offering row is one distinct choice, including joint Offerings with multiple Acharyas. A visitor chooses at most one Offering per Experience and may choose across Experiences. One submission writes one row to the existing seven-column `Registrations` tab: Date, Name, DOB, Email, Mobile, comma-separated Offering IDs, and Comment. Name, DOB, Mobile, and an Offering are required; Email and Comment are optional. A filled honeypot, Google reCAPTCHA v2 server verification, field validation, consent, and guardian confirmation for minors precede any write. The optional WhatsApp invitation appears only after a confirmed write.

Phase 1 is the isolated `register/` package and setup instructions. A production-safe root `mygita.html` Experience overview can launch independently as a Coming Soon page; the Landing entry points to it without exposing the unfinished application. After owner confirmation of the Apps Script deployment, that page can link to the hosted form. The existing `mygita/` application and its contracts remain intact for future digital Experiences. A Sheet row is an interest record, **not** an Account, authentication identity, enrolment, or Journey.

## Consequences

- Public V1 can launch without production MyGita API hosting.
- The Apps Script deployment, Sheet permissions, reCAPTCHA keys, actual frame-host suffix, WhatsApp invite, privacy notice, retention, and live verification require owner setup before collecting real data.
- The form endpoint is public and may be framed; it cannot establish that a submission originated from the Gita Jyoti site. Neither a Sheet row nor a form submission grants product access.
- Later migration from interest records to digital Accounts requires an explicit consent and identity-linking design, not automatic matching on mobile or email.
- The current seven-column schema has no durable submission ID or consent/guardian-evidence columns. Client-side pending state reduces accidental double clicks but cannot guarantee retry deduplication. Policy and schema expansion are required before claiming auditable consent or exactly-once submission.

## Implementation evidence

Phase 1 source, setup guidance, and server-handler tests are in `register/`. The root Coming Soon page and Landing links are implemented and locally verified. No Apps Script deployment or Sheet write has been verified yet; registration wiring remains pending owner confirmation.

## Relationship to earlier decisions

This is a transitional public-site path. It complements [ADR-0002](ADR-0002-mygita-as-orchestration-region.md) and [ADR-0010](ADR-0010-account-profile-authenticator-separation.md); it does not redefine the MyGita Account model or supersede those decisions.
