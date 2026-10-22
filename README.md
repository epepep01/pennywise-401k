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

The pure calculator lives in `src/lib/calc/calculator.ts`, with its
specification tests beside it. The planner keeps pay details, current
contributions, raises/bonuses, and the live recommendation together on one
screen.
Paychecks remaining are derived from your selected next payday. Your current
contribution rate estimates year-to-date contributions from salary and checks
already paid; the estimate excludes past raises and bonuses. You can replace it
with the actual amount from your paystub. The new-rate delay can be set from
zero to three paychecks, and the paycheck schedule shows up to ten events per
page. Cross-field validation and warnings appear as you edit the related fields.
The result also shows a separate year-end projection if your current rate stays
in place, so the effect of future raises and eligible bonuses is visible even
when the recommended rate changes to keep aiming for the same goal. Household
profiles are stored in this browser only; they are not synced
to an account or server. A new profile includes one optional blank raise and
bonus row to make common planning inputs faster to enter; the bonus defaults
to the next pay date. The remaining sample salary, age, and contribution rate
are fictional starting values and should be replaced before relying on a plan.

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
  applies to paychecks on or after its effective date, even if the contribution
  rate change is delayed. A future bonus is projected as its own payment and
  does not have to fall on a regular paycheck date; its date determines whether
  the current or new contribution rate applies. Already-paid bonuses should be
  reflected in your year-to-date contribution amount instead.
- Contributions already made at this and other employers count toward your
  goal and the shared IRS employee limit. Employer match does not count toward
  that employee limit.
- If you enter paychecks before a contribution update takes effect, those
  checks use the current contribution rate; the recommended rate applies after
  that delay. The expected bonus uses the rate based on its date relative to
  the first paycheck at the new rate.
- The recommended rate is a whole-number percentage rounded down so it will
  not exceed your goal. That can leave a small gap. The paycheck table shows
  each estimate, including contributions clipped at the IRS employee limit.
- If your plan has a percentage cap, that cap can prevent you from reaching
  your goal. Match-at-risk estimates are only available when you enter the
  actual match formula; confirm the formula and true-up rules in your plan
  documents.

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
