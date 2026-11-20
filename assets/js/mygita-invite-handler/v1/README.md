# MyGita invite handler v1

This browser library provides a shared invitation interaction for Gita Jyoti
hosts. It is presentation and invitation-lookup logic only: the host owns API
configuration, profile submission, authentication, and page layout.

`register.html` is the reference integration.

## Host contract

Load the library after the host's Profile API repository and before the host
page script. The repository needs `getInvitation(code)`, which resolves to the
validated public invitation returned by the Profile API.

```js
const invitations = window.createMyGitaInviteHandler({
  repository,
  input: document.querySelector('#invitation-code'),
  entry: document.querySelector('#invitation-entry'),
  summary: document.querySelector('#invitation-summary'),
  error: document.querySelector('#invitation-error'),
  applyButton: document.querySelector('#apply-invitation'),
  changeButton: document.querySelector('#change-invitation'),
  targets: { experience, offering, acharyas, meta },
  onApplied(invitation) {},
  onCleared() {},
});

invitations.loadFromUrl(); // reads ?i=<invite-code>
```

The handler exposes `apply(code)`, `clear()`, and `invitation`. It updates the
`i` query parameter only after a successful lookup.

## Reusable renderers

`window.MyGitaInviteRenderer` also exposes:

- `renderInvitation(invitation, targets)`
- `renderAcharyas(container, acharyas)`
- `renderSuccessActions(container, onSuccess)`

The renderers use DOM nodes and `textContent`; they do not interpolate API
values as HTML. Action links are limited to HTTP(S), Acharya pictures to HTTPS,
and a broken or absent picture becomes an initials avatar. Profile-specific
actions must only be obtained from an authorised profile response; a public
invitation lookup never supplies them.
