# Identity architecture

## Model

```text
Account (loggable environment and authorization principal)
├── LoginIdentifier (username initially)
├── Authenticator (password initially; passkey/federated later)
├── Session
├── RecoveryMethod (future)
├── SecurityEvent
└── Profile (zero or one initially)
    ├── personal facts
    ├── ContactPoint (mobile/email + verification state)
    └── IdentityEvidence (future proof of a claim)
```

Mobile numbers, email addresses, dates of birth, and names are Profile facts. They do not prove Account control unless a defined verification process produces evidence. A password, passkey, or verified external assertion is an Authenticator.

## Initial password milestone

The first zero-message-cost identity milestone adds:

- unique, normalized usernames;
- password-backed Account creation;
- password login;
- an initial pending Profile created atomically with the Account;
- optional Profile setup that can be skipped and resumed from the Profile menu;
- the existing local bearer session until the separately deferred secure-cookie migration;
- shared completion of authentication after a password has been verified.

The initial API remains additive. `POST /auth/accounts` and `POST /auth/password/login` return the existing `AuthSession` compatibility DTO so current Profile and Journey consumers do not need to change in the server handoff. Account, Profile, LoginIdentifier, and Authenticator remain separate server concepts even where that DTO aggregates them under the historical `user` property.

## Server handoff

Server implementation must:

1. Add persistence records and Store operations for Account, LoginIdentifier, and Authenticator without storing password material on the Profile.
2. Normalize usernames consistently and enforce their uniqueness inside the atomic Account-creation operation.
3. Hash passwords with Argon2id or an equivalently reviewed password-specific algorithm and keep parameters with the hash.
4. Implement `POST /auth/accounts` and `POST /auth/password/login` exactly as specified by `contracts/mygita-api/openapi.yaml`.
5. Create Account, password Authenticator, and pending Profile atomically.
6. Make all authentication methods converge after proof verification on one session-issuance path.
7. Rate-limit account creation and login and return one generic `invalid_credentials` response for an unknown username or incorrect password.
8. Ensure passwords and hashes never appear in responses or logs.
9. Preserve the prototype OTP endpoints during this additive milestone.
10. Remove mandatory-Profile authorization gating; a pending Profile must still be able to use learner capabilities.
11. Add server tests for success, duplicate username, normalization, weak/invalid input, incorrect password, rate limiting, persistence reload, optional Profile behavior, and absence of password material in responses.

## Client follow-up

The client Identity repository now exposes asynchronous password registration and login operations. Fixture and API providers implement the same interface; pages continue to use only the Identity feature's public entry point. The API-backed flow becomes end-to-end operational when the server handoff is complete.

Account recovery, authenticator management, identifier verification, Account linking, and secure-cookie sessions are later milestones.
