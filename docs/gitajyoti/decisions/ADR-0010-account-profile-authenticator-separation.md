# ADR-0010: Separate Account, Profile, and Authenticator

- Status: Accepted
- Implementation: Partial
- Supersedes: None
- Superseded by: None
- Date: 2026-09-11

## Context

The prototype creates a `User` while verifying a mobile OTP. That object currently combines the loggable application environment, authentication method, authorization roles, and the learner's personal facts. This makes mobile ownership an implicit requirement and makes future password, passkey, federated, or stronger identity-proofing methods difficult to add independently.

Gita Jyoti needs an account that can be created and used without paid SMS or email delivery. It must also remain possible to attach contact details and stronger identity evidence later without changing the meaning of an account.

## Decision

Identity uses the following distinct concepts:

- **Account** is the unique loggable MyGita environment and stable authorization principal. It owns status, roles, login identifiers, authenticators, sessions, and security events.
- **Profile** represents the person using the account and owns personal facts such as name, date of birth, language, city, mobile number, and email address. An Account has zero or one Profile initially.
- **Login identifier** locates an Account for authentication. The first implementation uses a unique normalized username.
- **Authenticator** proves control of an Account. Password is the first zero-message-cost authenticator; passkeys and federated methods can be added later.
- **Contact point** is a Profile fact such as a mobile number or email address. A contact point carries its own verification state and is not an authenticator merely because it was entered.
- **Identity evidence** records why a personal claim is trusted. It is optional and independent of basic account creation.
- **Recovery method** regains control of an existing Account. Recovery is not identity proofing and must not silently create or merge another Account.

Account creation with username and password creates the Account, its password Authenticator, and its initial pending Profile atomically. The username is normalized and uniquely constrained. Password material is processed only by the server and never enters Profile data, API responses, logs, or browser fixtures as stored state.

Profile setup is offered after Account creation but is optional. A learner can skip it, use MyGita, and return to Profile from the Account menu at any time. Missing optional Profile facts do not by themselves prevent discovery, interest registration, enrolment, Journey access, or activity participation.

The initial HTTP change is additive: password registration and login return the existing authenticated-session representation. That representation may aggregate Account and Profile information for client compatibility; it does not define the server persistence model. Existing prototype OTP operations remain temporarily available until a later decision removes or supersedes them.

No authentication method automatically merges Accounts based on matching mobile numbers, email addresses, names, or other Profile facts. Future linking requires an authenticated, explicit operation with conflict handling and an audit event.

## Consequences

- A learner can create and enter a MyGita Account using only a username and password.
- Profile completion is encouraged but is not an authorization gate.
- Mobile number and email become optional, initially unverified Profile facts.
- Multiple authenticators can later control one Account without duplicating the Profile or Journey.
- Authorization and Journey ownership use the durable Account principal internally, even when a compatibility DTO continues to use the historical `User` name at the HTTP boundary.
- The server must store password hashes using a password-specific algorithm, enforce username uniqueness, rate-limit registration and login, and use generic authentication failures.
- The client Identity repository can add password registration and login without depending on password storage or a concrete server identity implementation.
- Picture recovery, passkeys, assisted recovery, and stronger proofing require separate contracts and threat review; they are not part of this decision's initial implementation.

## Relationship to earlier decisions

This decision refines the Identity boundary in [ADR-0008](ADR-0008-mygita-feature-and-page-composition.md) and uses the client/server contract boundary established by [ADR-0005](ADR-0005-openapi-client-server-contract.md). It does not supersede either decision.
