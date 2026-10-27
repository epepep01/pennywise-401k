# Security maintenance

Last checked: 2026-10-22. A clean package audit is a check against known advisories, not a guarantee against vulnerabilities or malicious packages.

## Supported stack

Use Node.js 24.22.1 or a newer patched Node.js 24 release. `.nvmrc` records the tested version; CI reads it. React and React DOM are upgraded together to 19.3.1. Next.js and its ESLint configuration remain at the current patched stable version, 16.4.2.

Install reproducibly with `npm ci`. Review dependency changes, run `npm test`, `npm run lint`, and `npm run build`, then run both `npm audit` and `npm audit --omit=dev`. Avoid `npm audit fix --force`: its suggested downgrade removes newer Next.js security fixes.

## Open development dependency advisory

`eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces@3.0.3` is affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), a stack exhaustion denial of service through deeply nested glob patterns. There is no published patched version as of this review. npm reports five high findings because it also counts the dependent packages; these trace to one underlying advisory.

This chain is development-only. It is not present in the app's runtime dependency graph, and the calculator does not accept glob patterns from visitors. Keep ESLint configuration and glob settings under source control; do not run lint/build scripts from untrusted contributions with privileged credentials. Recheck this advisory weekly and update when an upstream fix is available. Next review due: 2026-10-29.

CI fails for any runtime advisory and reports the full development audit separately as a visible warning. Development findings are not automatically considered resolved. Dependabot checks npm and GitHub Actions weekly once this configuration is merged; repository-level vulnerability alerts must also be enabled in GitHub Settings → Advanced Security.

## Data and deployment boundaries

Saved plans and salary inputs remain in this browser's local storage. Do not treat browser storage as encrypted or suitable for credentials. Environment files are ignored by Git. This project has no server-side account database or third-party bank connection.

This review updates the local source and shared Mac runtime. It does not imply that a production deployment has been patched. Keep a deployment record with the deployed commit, Node version, app version, and verification results.
