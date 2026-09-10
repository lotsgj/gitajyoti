# Identity and session

MyGita is the identity and journey anchor for the site. Product applications should not receive long-lived MyGita credentials or independently interpret MyGita sessions.

The intended launch flow is:

```text
Browser → mygita.api → product API → short-lived signed launch result → browser redirect
```

Production choices for OTP delivery, identity provider, token renewal, revocation, guardian relationships, and child accounts remain deferred. The current fixed OTP and development JWT are local prototype mechanisms only.
