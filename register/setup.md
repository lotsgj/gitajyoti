# V1 interest registration: Google Apps Script setup

This folder is the **Phase 1** registration package. It is not live merely because the files are in Git. Phase 2, after owner confirmation, will add `mygita.html` and link the site to the deployed form. This is a public **interest** form, not the MyGita Account creation or enrolment flow.

## What it does

`Form.html` is served by Google Apps Script. On each form load, `Code.gs` reads the `Experiences`, `Acharyas`, and `Offerings` tabs of the [existing private spreadsheet](https://docs.google.com/spreadsheets/d/1Ybb2EANEbpeYt-hk766MtCs39Qqj43KnoSaSgj4DJQs/edit), then renders active Experiences and their active Offerings. Each Offering row is one choice; multiple Acharya IDs in that row represent a joint Offering. Acharya names and descriptions come from the `Acharyas` master tab, not duplicated text in `Offerings`.

The form calls `submitRegistration` through `google.script.run`. The server validates the fields and selected Offering IDs against current active rows, verifies Google reCAPTCHA v2, rejects a filled honeypot, and appends **one seven-column row** to `Registrations`. Only after a successful append does it show confirmation and, if configured, a WhatsApp invite link. The Sheet and reCAPTCHA secret are never sent to the browser.

## Set up the Sheet and script

1. Use the existing private **My Gita - Registrations** spreadsheet. Keep its four tabs and these exact A1 headers:

   | Tab | A1 headers, in order |
   | --- | --- |
   | `Experiences` | `ID`, `Name`, `Description`, `Outcome`, `Status` |
   | `Acharyas` | `ID`, `Name`, `Email`, `Description` |
   | `Offerings` | `Offering Id`, `Experience Id`, `Experience Name`, `Acharya Id`, `Acharya Name`, `Language`, `Status`, `Start Date` |
   | `Registrations` | `Date`, `Name`, `DOB`, `Email`, `Mobile`, `Offering Id`, `Comment` |

   Do not make the spreadsheet or `Registrations` tab public. Experience and Offering statuses must both be `Active` for an Offering to appear. The form does not display statuses. Its `Offering Id` registration cell contains all selected IDs separated by commas; it permits only one Offering per Experience, but multiple Experiences per submission. Do not put commas inside Offering IDs. An Acharya ID cell may contain multiple comma-separated IDs for a single joint Offering.
2. In that Sheet, choose **Extensions → Apps Script**. Replace the default `Code.gs` with this folder's `Code.gs`. Add an HTML file named `Form` and paste this folder's `Form.html`. Enable **Show "appsscript.json" manifest file in editor** in Project Settings and replace the manifest with this folder's `appsscript.json`. The script must be **bound to this spreadsheet** because it uses `SpreadsheetApp.getActiveSpreadsheet()`.
3. Create a **Google reCAPTCHA v2 “I'm not a robot” checkbox** key pair. Register the domain on which the Apps Script HTML-service frame runs. Apps Script embeds the form in a sandboxed iframe whose hostname may have a generated prefix; inspect its `location.hostname` in browser developer tools rather than assuming the GitHub Pages or address-bar hostname. Keep Google's domain validation enabled. If Google will not accept that host/domain, pause deployment and revisit the robot-check architecture; do not disable domain validation just to make the widget appear.
4. In **Apps Script → Project Settings → Script properties**, set:

   | Property | Value |
   | --- | --- |
   | `RECAPTCHA_SITE_KEY` | Public site key for the v2 checkbox. |
   | `RECAPTCHA_SECRET_KEY` | Private secret key; never put it in HTML or Git. |
   | `RECAPTCHA_ALLOWED_HOST_SUFFIX` | The narrowest stable hostname suffix observed for the deployed HTML-service frame, without scheme or slash (likely `script.googleusercontent.com`; confirm in the browser). The server rejects tokens whose verified `hostname` falls outside it. |
   | `WHATSAPP_INVITE_URL` | Optional `https://chat.whatsapp.com/...` invitation; leave unset until the group and joining policy are ready. |

   The public site key is inserted into the form at render time. A missing site key disables the form; a missing secret or allowed host suffix rejects submissions. Do not commit actual keys, registration data, or the invite URL to this repository.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Authorize the requested scopes (current spreadsheet and outbound HTTPS request). Use the resulting `/exec` URL for real users. After any code change, create a new deployment version. `/dev` is for editors and does not represent the public deployment.

## Verify before sharing the link

1. Open the `/exec` URL in a signed-out or incognito browser. Confirm the checkbox loads, active Experiences appear, and selecting one reveals its active Offerings. Verify a joint Offering displays its Acharyas together. Submit selections across two Experiences; exactly one row should appear in `Registrations`, with both IDs in its `Offering Id` cell and the other six values in the existing column order. If configured, confirm the WhatsApp link appears **only after** successful submission.
2. Mark one Experience and one Offering inactive in the Sheet (restore them afterward). Reload and confirm each inactive item is absent. Submit a stale Offering ID through developer tools; it must be rejected. Also try two Offering IDs for the same Experience, no choice, invalid mobile, invalid or future date, under-18 date without guardian confirmation, and without consent. Each must produce an error and **no row**.
3. Fill the hidden `website` field using developer tools and submit. It must be rejected without a row. A fabricated, expired, or replayed reCAPTCHA token must also fail.
4. The seven-column registration schema has no submission ID, so a retry after a lost success response cannot be durably deduplicated. The form disables its submit button while a call is pending, but a manual retry can create a second row. Do not claim exactly-once submission until a technical ID column or separate durable submission log is approved.
5. Verify the form inside an iframe only after Phase 2 provides the site page. `ALLOWALL` permits third-party framing, so the public form must not be treated as proof that a submission came from the Gita Jyoti site. This is an interest form; do not put sensitive account access or authorization in it.

The current `Registrations` schema also lacks columns for contact consent or guardian confirmation. The form enforces both, but does **not** persist their evidence. Approve privacy, child-data, retention, and consent-recording policy before public launch. Google Sheet permissions, reCAPTCHA configuration, WhatsApp group administration, and live browser verification are owner setup tasks, not steps the repository tests can perform.
