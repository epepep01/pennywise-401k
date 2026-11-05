# Security maintenance

## Chrome extension review — November 4, 2026

Version 0.2 removes `activeTab` and required `scripting`. The calculator requires
only `sidePanel` and a cleanup `alarms` permission. Reading requests optional
`scripting` and the exact `workplaceservices.fidelity.com` HTTPS host; both are
removed and checked after each attempt. A background alarm/startup cleanup
provides best-effort recovery, not a hard expiry guarantee. Our code restricts
reads to the contribution overview and refuses authentication screens.

Data remains in panel memory; pending imports expire after one minute and
hidden/idle panels clear their data. Imports require explicit verification.
CSP, Trusted Types, input validation, bounded DOM reads, reproducible hashed
snapshots and integrity verification provide additional defenses. CI installs
with dependency lifecycle scripts disabled. See
[the threat model and verification record](extension/README.md).

Page access is not browser-enforced read-only. Compromised code could manipulate
the authorized host, and CSP does not rule out all exfiltration paths. Local
malware, malicious build tooling, compromised dependencies and other privileged
extensions remain risks. Hashes are not independent signatures. Installed 0.2
permission cleanup, background recovery and authenticated Fidelity layouts
remain unverified; real-data access is deferred.

The dependency review found development-only advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
in the TypeScript lint parser's `minimatch` dependency. A scoped override selects
patched `minimatch` 11.0.1 without downgrading Next.js. It intentionally crosses
the parser's declared major-version range; lint, types, tests, and builds must
remain checked, and the override should be removed when the parser adopts a
patched range. The subsequent install audit reported zero known vulnerabilities.
No lint or build dependencies are shipped in the extension package.

## Website maintenance record

Last checked: 2026-10-26. A clean package audit is a check against known advisories, not a guarantee against vulnerabilities or malicious packages.

## Supported stack

Use Node.js 24.22.1 or a newer patched Node.js 24 release. `.nvmrc` records the tested version; CI reads it. React and React DOM are upgraded together to 19.3.1. Next.js and its ESLint configuration remain at the current patched stable version, 16.4.3.

Install reproducibly with `npm ci`. Review dependency changes, run `npm test`, `npm run lint`, and `npm run build`, then run both `npm audit` and `npm audit --omit=dev`. Avoid `npm audit fix --force`; review compatibility instead of accepting major changes or framework downgrades blindly.

## Advisory review and monitoring

On 2026-10-26, the full npm audit reports zero known vulnerabilities. The earlier [braces advisory, GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), was withdrawn by GitHub on 2026-10-23 because it was not practically exploitable. The development dependency remains installed; the advisory was withdrawn, rather than fixed by the Next.js patch.

CI now fails for any reported dependency advisory, including development dependencies. The previous warning-only development audit exception has been removed. Dependabot checks npm and GitHub Actions weekly, and groups Next.js with its ESLint configuration. GitHub vulnerability alerts and automatic security-fix PRs are enabled; automatic merging is not enabled.

Major upgrades of `@types/node` and TypeScript are deferred. Node types should match the Node 24 runtime, and the current TypeScript lint tooling rejects TypeScript 7. Review these restrictions during planned runtime/compiler migrations, and review security alerts if a fix requires a major upgrade.

## Data and deployment boundaries

Saved plans and salary inputs remain in this browser's local storage. Do not treat browser storage as encrypted or suitable for credentials. Environment files are ignored by Git. This project has no server-side account database or third-party bank connection.

This review updates the local source and shared Mac runtime. It does not imply that a production deployment has been patched. Keep a deployment record with the deployed commit, Node version, app version, and verification results.
