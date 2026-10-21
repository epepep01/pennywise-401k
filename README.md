# Pennywise 401(k) planner

A first learning project using Next.js, React, and TypeScript. It estimates a
whole-number employee contribution rate for the rest of the 2026 tax year.

## Run it on your Mac

Open this folder in VS Code, then open its integrated terminal with
**Control + backtick** (the shortcut can vary by keyboard settings). Run:

```bash
npm run dev
```

Open the local address printed by Next.js, usually
[http://localhost:3000](http://localhost:3000). The development server updates
the page as you save code. Stop it with **Control + C** in that terminal.

## Checks

```bash
npm test
npm run lint
npm run build
```

The calculator logic is separate from the page in
`src/lib/contribution-calculator.ts`; its unit tests live beside it. Separating
the calculation from the interface makes the rules easier to test without
clicking through the website.

The GitHub Actions workflow at `.github/workflows/ci.yml` runs the tests, lint,
and production build on every push and pull request. These automated checks
help catch mistakes before a change is merged.

## What the estimate assumes

- The IRS 2026 employee elective-deferral limit is $24,500, plus an $8,000
  catch-up at age 50 or older, or an $11,250 catch-up at ages 60-63. The
  calculator uses the age you enter for December 31, 2026.
  [IRS 2026 limit announcement](https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500).
- The estimate counts future weekly, every-two-weeks, twice-monthly (1st and
  15th or 15th and month-end), or monthly paydays through December 31.
- Salary is annual salary divided by the normal number of pay periods. A raise
  applies to paychecks on or after its effective date. An expected bonus is
  included if it is paid on or after your next paycheck and you leave the
  contribution percentage applied to it.
- Contributions already made count toward your goal and the IRS employee
  limit. Employer match and other employer contributions are excluded.
- If you enter paychecks before a contribution update takes effect, those
  checks use the current contribution rate; the recommended rate applies after
  that delay. The expected bonus uses the rate based on its date relative to
  the first paycheck at the new rate.
- The recommended rate is the lowest whole-number percentage that is projected
  to reach the goal. A whole percentage can overshoot a personal target. The
  projection stops at the IRS employee limit, but your plan may have its own
  restrictions, bonus rules, or payroll cutoff dates. Confirm those with your
  plan administrator before changing your election.

This is an educational estimate, not financial or tax advice. The first
version is specifically for 2026; the IRS limits should be updated before
using it for another tax year.

## Git and GitHub

This project is connected to
[github.com/epepep01/pennywise-401k](https://github.com/epepep01/pennywise-401k).
In VS Code, use **Control + Shift + G** to open Source Control (shortcuts can
vary). Review and stage changes, enter a commit message, and commit a local
checkpoint. Then push your feature branch to GitHub and open a pull request to
propose merging it into `main`. GitHub runs CI for the push and pull request.
Pushing publishes commits; it does not deploy the app to DigitalOcean.
