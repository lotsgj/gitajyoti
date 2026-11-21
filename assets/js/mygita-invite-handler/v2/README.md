# Shared MyGita invitation

The v2 entry point registers `<mygita-invitation>` as a side effect. Use one browser import. The file contains the responsive styles and uses the host's configured Profile client. The same file can load as a classic script when serving registration from the filesystem.

```html
<mygita-invitation id="batch" code="g4c-nov26-radhakrishna"></mygita-invitation>
<script type="module">
  import 'https://gitajyoti.org/assets/js/mygita-invite-handler/v2/index.js';
  // profileApi is the already configured public Profile client from your app.
  document.querySelector('#batch').api = profileApi;
</script>
```

- **Lookup.** Set `code` and `.api` to fetch the public invitation. The client must provide `getInvitation(code)` returning the public client result or a resolved invitation. For manual input, `await element.load(code)` returns the invitation, throws on failure, or returns null when superseded. The component displays lookup progress and errors.
- **Verified Profile.** Set `element.invitation = profile.invitations[i]` to render existing data directly, including its ordered `onSuccess` actions. This needs no API client or additional request. Set the property to null to clear the view. The host owns verification and routing.
- **Registration success.** Assign `element.actions = result.onSuccess` on a separate element to show only the follow-up actions.
- **Invitation card.** The card starts compact with the experience, batch, start date, languages and optional HTTPS cover from `experience.pic`. Add the boolean `applied` attribute in registration to show the applied status. The in-card chevron reveals available `experience.description`, `experience.outcome` and Acharyas from the same response. An Acharya with `about` opens a dismissible biography. Missing or broken portraits use initials. Invitations with no further details omit the chevron.
- **Host styling hooks for disclosure.** Use `.mygita-story`, `.mygita-cover`, `.mygita-copy`, `.mygita-toggle`, `.mygita-person` and `.mygita-bio`. The expanded section has `data-expanded` and the toggle exposes `aria-expanded`. The control retains its accessible name in either mode.
- **Default appearance.** Omitting `styling` or setting it to `default` renders inside a shadow root. “Guided by” sits above a grid of three columns above 900 CSS pixels, two from 701 to 900 and one up to 700. Optional theme variables are `--ink`, `--muted`, `--teal`, and `--gold`.
- **Host appearance.** Set `styling="host"` to render light-DOM elements with the host's CSS. The main styling hooks are `.mygita-invitation-details`, `.mygita-experience`, `.mygita-offering`, `.mygita-acharyas`, `.mygita-acharya-label`, `.mygita-acharya-list`, `.mygita-acharya`, `.mygita-acharya-avatar`, `.mygita-acharya-initials`, `.mygita-acharya-name`, `.mygita-invitation-meta`, `.mygita-success-action`, `.mygita-action-prompt`, `.mygita-success-action-link`, and `.mygita-invitation-status`. Switching styling modes reuses the loaded data.
