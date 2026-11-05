# Pennywise Chrome extension

Experimental Manifest V3 calculator inside Chrome's desktop side panel. It runs
the website's calculation engine locally; Next.js does not need to be running.
Use a current, patched Chrome. Do not use real financial data until the installed
0.2 permission flow and authenticated Fidelity layout have been verified.

## Build, verify, and load

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run check:types
npm run build:extension
npm run verify:extension
```

The build prints a snapshot directory under `build/extension-releases/<sha256>`.
Load that directory through `chrome://extensions` → Developer mode → Load
unpacked. Use Elliot's personal profile (currently Person 1), not EP Sweep.
Disable/remove the earlier development copy loaded from `build/extension`
before using the snapshot, so the old extension cannot retain its permissions.
Building again does not overwrite existing snapshot directories. A changed
release needs separate review and loading; it is not an automatic update.

The integrity verifier checks every file, detects additional or modified files,
and refuses symlinks. To verify an older snapshot against a separately retained
digest, run:

```sh
node scripts/verify-extension.mjs /absolute/path/to/snapshot EXPECTED_SHA256
```

Hashes detect changes relative to a trusted digest. They are not signatures or
protection against malware that can modify both the files and the verifier.
`build/extension-integrity.json` records file/source hashes, the compiler version
and lockfile hash. Keep trusted review records outside the installed directory.
The generated package contains no npm runtime dependencies, test harness or
source maps. The compiler and build tooling remain trusted inputs.

## Permission model in version 0.2

Opening the calculator grants no page access. Required permissions are only
`sidePanel` and `alarms`; the latter supports backup access cleanup.

**Read Fidelity contribution overview** requests optional `scripting` and access
to exactly `https://workplaceservices.fidelity.com/*`. There is no `activeTab`,
all-sites access, cookies, storage, webRequest, history or broad tabs permission.
Other providers remain available through manual entry. Adding another provider
requires a separately reviewed host declaration and adapter.

The application accepts only `/mybenefits/dcnav/pages/contributions` (optional
trailing slash), without a query string, and with no hash or the overview hash
`#/landing` / `#/`. Login, editing, transaction and other routes are rejected.
Chrome enforces the host boundary; the narrower route restriction is enforced
by our code, not by Chrome host permissions.

After every read attempt, both optional permissions are removed and checked.
Results are discarded if cleanup fails. A background alarm retries cleanup if
the panel disappears mid-read, and startup/install handlers remove stale grants.
Alarms may be delayed during sleep; this is best-effort recovery, not a hard
one-minute permission lease. Disable the extension if cleanup reports failure.

## Data minimization and import review

The injected reader repeats the URL check to catch navigation races. It uses
Chrome's isolated world, targets only the top frame, and refuses documents with
password or one-time-code controls, including hidden authentication controls.
It walks at most 10,000 elements and returns at most 40 short contribution
snippets. It excludes hidden/editable content, form controls and executable
content, rather than reading the entire page's body text. It does not inspect
input values, cookies, hidden application state or network responses.

The parser recognizes explicit employee YTD totals and total contribution rates.
It rejects balances, employer match, split pretax/Roth source labels and
ambiguous YTD labels. Fidelity's authenticated layout has not been validated;
this is a conservative initial reader, not a certified provider integration.
Employee pretax and Roth deferrals must be combined manually when split.
Non-Roth after-tax contributions and employer match must be excluded.

Page output is untrusted. The broker checks response shape, size, frame, URL
and the active tab again, then revokes access before returning parsed details.
Nothing is selected automatically. The user must select values and confirm the
employer, 2026 tax year and employee-only scope. Pending imports expire after
one minute and are discarded on tab/navigation events. Same-route changes to
account content may not produce a navigation event; user verification remains
necessary. Evidence is rendered using text nodes, never HTML.

Financial entries are not persisted, logged or uploaded. **Clear my data** wipes
inputs/results/pending imports; hiding the panel or five minutes of inactivity
also clears them and cancels pending reads. Clearing is best-effort removal from
application memory, not cryptographic zeroization of browser memory. Chrome,
the device and other extensions with access remain trusted components.

## Security boundaries and residual risks

The extension-page CSP disallows network connections, remote scripts, frames,
plugins and form navigation. Trusted Types enforcement disables HTML/script
injection sinks, and incognito use is disabled. No external messaging listener
or web-accessible resources are exposed. The build rejects unexpected runtime
source files, external runtime dependencies and direct dynamic-code/network/HTML
injection APIs. These checks are regression guards, not a sandbox for malicious
build tooling or deliberately obfuscated code.

Read-only is our implementation's behavior, not a browser-enforced capability.
While optional access is granted, compromised code could read or modify pages
on that host. The CSP is defense in depth, not a guarantee against all egress:
malicious extension code could use other browser capabilities such as tab
navigation. Replacing local files, a compromised compiler/dependency, an
extension exploit or a compromised device remain threats. A clean audit and
passing tests do not prove security. An independent review is still advisable
before routine financial-account use.

The current implementation never fills or submits provider forms. The calculator
supports 2026 actual YTD, other-employer contributions, payroll delays, custom
targets and percentage caps. Raises, bonuses, saved profiles and employer match
remain web-app features. Values start blank rather than using fictional defaults.

## Verification record — November 4, 2026

The earlier 0.1 build was tested in desktop Chrome's personal Elliot profile:
calculation, clearing, stale-result hiding, toolbar access and a no-candidates
read on a neutral HTTPS page worked. That permission model is now superseded.

For 0.2, automated tests cover permission denial, cleanup success/failure,
cancellation, unsupported URLs, navigation races, response validation, review
expiry, authentication refusal, bounded DOM extraction and artifact tampering.
A localhost harness runs the real panel with fake Chrome APIs and synthetic
financial values. Desktop testing verified explicit import selection, navigation
invalidation, reset confirmation, dismissal and clearing. The harness is built
outside release artifacts:

```sh
node scripts/prepare-extension-ui-test.mjs
```

Still required before accessing real Fidelity data: verify optional permission
prompts and removal in installed Chrome 0.2, background recovery, CSP/Network
behavior, and an authenticated provider layout. Do not share credentials or
commit real account screenshots, statements or DOM captures. Browser tools used
to inspect a real account may expose visible information to the chat context;
that is separate from the extension's local processing.

CI uses locked dependencies with lifecycle scripts disabled, audits dependencies,
tests/lints/type-checks, builds both products, verifies the release and checks
byte-for-byte reproducibility. Chrome Web Store publication and signing are
separate future steps.
