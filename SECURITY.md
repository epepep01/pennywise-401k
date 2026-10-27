# Security maintenance

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
