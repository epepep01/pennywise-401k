# Brief: 401(k) Contribution Planner — design system + calculator update

**Owner:** Elliot Poulter · **Date:** 2026-10-21
**For:** a coding agent updating the existing Next.js + TypeScript app
**Design reference:** Design canvas "401(k) Contribution Planner" (artboards: Design system, Screen map, Planner result, Colour options → **option B chosen**)

---

## 0. How to work with me

- I'm learning web development. Before each step, explain new concepts in 1–2 sentences, and walk me through Git (branch, commit, PR) rather than doing it silently.
- Read `NEXT_AGENT_GUIDE.md` in my previous project (`/Users/elliotpoulter/Documents/Codex/finance-app`) for my learning preferences, and follow it where it conflicts with this brief's process notes.
- Work on a feature branch. Don't push or deploy (DigitalOcean comes later) unless I ask.
- **Order of work:** (1) calculator logic + tests, (2) design tokens, (3) components, (4) screens. Don't style anything before the calculator tests pass.
- Audit the existing app first and tell me what you'll change, keep or delete before you edit.

---

## 1. Goal

Replace the manual year-end maths (contribution left, paychecks left, new %) with an app that tells each family member **the single whole-percentage contribution rate** to set now so they finish the year at their goal. The goal is either **MAX** (the legal limit) or a **target $ amount**, and the app never goes over it.

---

## 2. Calculation rules (source of truth)

### Inputs (per person, per tax year)

| Field | Type | Required | Notes |
|---|---|---|---|
| Annual salary | $ | yes | Before tax |
| Pay frequency | enum | yes | weekly (52), biweekly (26), semimonthly (24), monthly (12) |
| Next pay date | date | yes | Used to derive the paychecks remaining |
| Paychecks remaining | int | derived | User can override |
| Contributed YTD (this employer) | $ | yes | From the latest pay stub |
| Contributed YTD (other employers) | $ | no | Default 0. For people who changed jobs this year |
| Current contribution % | int | no | Shown as "from X%" |
| Age at Dec 31 | int | yes | Drives the catch-up limit |
| Goal | MAX \| target $ | yes | |
| Plan max % | int | no | Employer's rule. Blank = no cap |
| Raises | list of {effective date, new salary} | no | Applies to paychecks on or after the date |
| Bonuses | list of {pay date, gross amount} | no | **The contribution % applies to bonuses** (confirmed for my plan) |
| Employer match formula | e.g. 100% up to 4% | no | Used only for warnings |
| Plan has true-up | bool | default **false** | My plan does **not** true-up |

### Limits (store in a per-year config table, not hard-coded)

| Year | Employee deferral (402(g)) | Catch-up 50+ | Catch-up 60–63 |
|---|---|---|---|
| 2026 | $24,500 | $8,000 | $11,250 |

**Verify against IRS.gov before shipping.** Render the year and source next to every limit in the UI.

### Algorithm

1. `limit = base + catchUp(age)`.
2. `goal = MAX ? limit : min(target, limit)`.
3. `needed = goal − ytdThisEmployer − ytdOtherEmployers`. The legal limit applies **per person across all employers**.
4. Build the schedule of remaining pay events through Dec 31: regular paychecks at the salary in effect on each pay date (`salary / periodsPerYear`), plus bonus events.
5. `eligible = sum(gross of remaining events)`.
6. `rate = floor(needed / eligible × 100)`, then cap at plan max %, with a minimum of 0.
7. Simulate per event: `contribution = round2(gross × rate%)`, but never more than the limit space left. Return the per-event table and the year-end total.
8. Report: `rate`, `projectedTotal`, `gap = goal − projectedTotal`, and `nextRateOvershoot = simulate(rate + 1)` (shown as "37% would overshoot by $X").

### Rules and the states they produce

- **Never round up past the goal.** Whole percentages only, because that's what payroll accepts.
- **No true-up ⇒ never suggest front-loading.** If any rate the user enters would reach the limit before the last paycheck of the year, show "Match at risk", and estimate the lost match from the match formula.
- **Already at or over the goal:** recommend 0%. If YTD is over the limit, show an error: "Over the limit — excess must be refunded by April 15."
- **Can't reach the goal even at plan max %:** show the plan max and the shortfall in $.
- **No paychecks left:** "No paychecks left this year." No rate shown.
- **Input validation:** YTD > limit, a raise or bonus dated in the past (allowed, but labelled "already paid, include in YTD"), paychecks remaining that conflict with the next pay date.
- **Paycheck can't cover the rate:** if the rate would exceed ~70% of gross (after taxes and benefits), show a soft warning: "Payroll may not be able to withhold this much."
- **Later, not MVP:** Roth catch-up requirement for prior-year wages over ~$150k; separate pre-tax and Roth rates; highly-compensated employee testing.

### Required test cases (unit tests, written before the UI)

1. **Worked example** (also used in the design):
   - Inputs: salary $104,000, biweekly, 5 paychecks left (Oct 30, Nov 13, Nov 27, Dec 11, Dec 25), $8,000 bonus Dec 15, YTD $14,200, age < 50, goal MAX.
   - Expected: **36%**, $1,440 per paycheck, $2,880 from the bonus, finishes at **$24,280**, gap $220. 37% overshoots by $60.
2. Already maxed → 0%.
3. Target $15,000 with YTD $15,000 → 0%.
4. Plan max 20% caps the rate → shortfall reported.
5. Raise mid-schedule changes the per-paycheck gross.
6. One case for each frequency: weekly, biweekly, semimonthly, monthly.
7. Ages 50, 60 and 64 → correct catch-up limits.
8. Other-employer YTD reduces what's needed.
9. Zero paychecks remaining.
10. Floating-point: totals reconcile to the cent.

---

## 3. Design system — "Ledger", palette B (Deep teal & coral)

Implement as CSS custom properties (or Tailwind theme tokens if the app uses Tailwind). No colours outside this table.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F2F6F6` | Page background |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--border` | `#CFDCDC` | Card borders, dividers |
| `--border-strong` | `#7C9395` | Input borders (3:1 on white) |
| `--ink` | `#0F2A2E` | Primary text |
| `--muted` | `#3F5659` | Secondary text, labels |
| `--accent` | `#0F766E` | The answer, primary buttons, selected state |
| `--accent-hover` | `#0B5F58` | Button hover |
| `--accent-tint` | `#D7EFEC` | Selected background, "On track" chip |
| `--accent-on-tint` | `#0B524C` | Text on accent tint |
| `--progress` | `#14B8A6` | "Still to come" bar segment |
| `--track` | `#E1EAEA` | Progress track |
| `--warn` | `#C2410C` | Over-limit and overshoot borders |
| `--warn-tint` | `#FCE5DA` | Warning backgrounds |
| `--warn-on-tint` | `#8C2F08` | Warning text |
| `--info` | `#5B4BB7` | Employer match, bonus rows |
| `--info-tint` | `#E8E5F7` | Info backgrounds, bonus row highlight |
| `--info-on-tint` | `#43368F` | Info text |

**Type:** IBM Plex Sans (400/500/600/700) for words; **IBM Plex Mono with `font-variant-numeric: tabular-nums` for every $ and %**. Load via `next/font/google`.

| Style | Size / weight |
|---|---|
| display-num | 56–88 / 600, letter-spacing −0.04em |
| h1 | 32 / 600 |
| h2 | 22 / 600 |
| body | 16 / 400, line-height 1.5 |
| label | 13 / 600, uppercase, letter-spacing 0.06em, `--muted` |

**Spacing:** 4, 8, 12, 16, 24, 32, 48, 64.
**Radius:** 8 for inputs and buttons, 16 for cards, pill for chips.
**Elevation:** none, except the result card (`0 8px 24px rgba(15,42,46,.08)`).

**Accessibility:**
- Text contrast of at least 4.5:1.
- Touch targets of at least 44px.
- Real `<label>` for every input.
- Status chips always include words, never colour alone.
- Visible focus ring: 2px `--accent`, 2px offset.

**Voice:** second person, plain words, with dates. For example, "You'll hit the limit on your Nov 27 paycheck." Not "Threshold exceeded."
**Numbers:** results are rounded to whole dollars. Cents are shown only in the paycheck table and inside "Show the math".

### Components to build

`MoneyInput` (with error state and helper text), `PercentInput`, `DateInput`, `SegmentedControl` (pay frequency, goal), `Button` (primary / secondary / text), `Card`, `StatusChip` (on-track / warn / info), `ResultCard` (big %, "from X%", progress bar split into already-in vs still-to-come, finish amount, gap, overshoot note), `PaycheckTable` (date, type, gross, contribution, YTD; bonus rows tinted with `--info-tint`), `EventList` (raises and bonuses with edit and remove), `ShowTheMath` (expandable step-by-step derivation), `PersonSwitcher`.

---

## 4. Screens

**Desktop (design this first):**
- Header with the app name and a person/year switcher.
- Left column, 420px wide: Your pay → Where you are → Changes this year (raises and bonuses) → Advanced (plan max %, other employers, match formula).
- Right column: `ResultCard` + `PaycheckTable`, which **update live** with no Calculate round-trip.

**Phone:** the same content as a three-step wizard (Pay → Where you are → Changes), ending on the result. The result is reachable directly once the inputs are valid.

**MVP screens:**
1. Who's planning? Saved household profiles with last-updated dates. The empty state reads "Add your first plan".
2. Planner (the desktop layout above, or the phone wizard).
3. Show the math (drawer).

**States to design:** on track · already maxed · can't reach the goal at plan max · whole % overshoot note · bonus pushes over · zero paychecks · match at risk (no true-up) · input errors.

**v2 (don't build yet):** scenario comparison, household overview, editable limits-by-year settings, pre-tax/Roth split, reminders, history.

---

## 5. Data and persistence

- Keep the calculator a **pure TypeScript module** (`lib/calc/`) with no React imports, so it's fully unit-testable.
- Store profiles locally for now (localStorage is fine at this stage). Design the shape so it can move to a server database later. Don't store SSNs or account numbers.

---

## 6. Acceptance criteria

- [ ] All test cases in §2 pass (`npm test`).
- [ ] The worked example renders exactly: 36%, $24,280, gap $220, "37% would overshoot by $60".
- [ ] Only §3 tokens are used. A grep finds no hard-coded hex values in components.
- [ ] Every $ and % uses tabular mono.
- [ ] Works at 375px wide with no horizontal scroll.
- [ ] Keyboard-only use works, with visible focus throughout.
- [ ] Every limit shown is labelled with its year and source.
- [ ] A short summary of what changed, plus the Git steps for me to run.

## 7. Open items for me (ask, don't assume)

- My employer's match formula.
- Whether we want a pre-tax/Roth split in v1.
- The existing app's current state: the agent should report on it before changing anything.
