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
- Salary is annual salary divided by the normal number of pay periods. Raises are prorated by calendar days within an estimated earning period: the day after the previous scheduled payday through the current payday, inclusive. The effective date uses the new salary. The normal full-period gross is annual salary divided by pay periods; a split period weights the old and new salaries before rounding gross to cents. This assumes no payroll lag and may differ from employer payroll periods or workday-based rules. Contribution-rate delays still apply. A future bonus is projected as its own payment and
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
- The recommended rate is the highest permitted whole-number percentage whose
  paycheck-by-paycheck deductions, rounded to cents, stay within your goal.
  That can leave a gap. Projections do not assume an automatic payroll cutoff.
  A comparison rate may therefore project above your target or the IRS limit.
  Contributions already made or scheduled during a payroll delay may make
  staying below a target impossible, even with a new rate of zero.
- If your plan has a percentage cap, that cap can prevent you from reaching
  your goal. Match-at-risk estimates require your simple regular-pay match formula and
  confirmation of no true-up. They show what could be missed if payroll stops
  at your remaining employee limit, including partial final deductions. Bonus
  matching and tiered formulas are not modelled. Confirm your plan rules;
  payroll may not know contributions at another employer.

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

## Version 3 workflow

- Try the calculator immediately with fictional starting values; naming and saving a plan is optional.
- YTD from salary and your current percentage remains available without a payslip. You may optionally enter actual employee YTD from a paystub.
- Unsaved plans last until refresh. Saved household plans stay in this browser only; clearing browser data removes them and they do not sync between devices.
- The recommendation and its progress stay visible. “Use my own rate” updates both paycheck table views and the maths; “Use recommendation” restores the recommended schedule. Invalid custom rates pause the table instead of silently showing a different rate.
- Form sections collapse on desktop and phone. The header's result link jumps directly to the recommendation.
- An old next-pay date prompts you to update the schedule and review YTD before showing a recommendation. A delayed election requires the current rate.
- Tests include cent rounding, uncapped comparisons, stale dates, payroll delays, saved profiles, and match lost on a partial final paycheck. Run tests, lint, and the production build before committing.

### Paycheck comparison views

The result card compares employee contributions in dollars at the current and recommended rates on the same upcoming gross paycheck. The table offers **Old vs new ($)** and **Year-end projection** views, including bonuses and payroll-update delays. The last scheduled paycheck before the new rate is shaded. With no delay, a clearly labelled estimated prior paycheck provides context; this reference is excluded from future events and YTD totals. Historical gross and deductions are estimates based on the entered salary, raises, and current rate, not imported payroll history.

Previous-employer contributions are collapsed by default; any entered amount still counts toward the goal. All dropdowns share a themed menu with arrow-key navigation, Home/End, type-to-search, Enter/Space selection, Escape cancellation, and outside-click dismissal. Browser and keyboard checks are left for manual verification.

### Validation feedback

Errors and field-specific warnings appear beside their inputs. Raise and bonus messages use each event's ID so they stay with the correct row after edits or removals. Combined-limit errors appear beside the YTD estimate/actual controls. Collapsed form sections open when they first gain an error and display a count of fields to fix. Only plan-wide notices remain by the recommendation; comparison-rate errors stay with the comparison input. Input descriptions and invalid states are linked for assistive technology.

## Runtime and dependency security

Use patched Node.js 24 (currently 24.22.1; see `.nvmrc`) and `npm ci` to install the locked dependencies. CI tests, lints, builds, and audits runtime packages on pushes, pull requests, and a weekly schedule. See [SECURITY.md](SECURITY.md) for the currently unpatched development dependency advisory and maintenance steps.
