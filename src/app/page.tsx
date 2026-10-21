"use client";

import { useMemo, useState } from "react";
import {
  calculateContributionPlan,
  type ContributionInput,
  type PayFrequency,
} from "@/lib/contribution-calculator";
import styles from "./page.module.css";

const initialInput: ContributionInput = {
  ageAtYearEnd: 35,
  annualSalary: 120_000,
  annualSalaryAfterRaise: 126_000,
  raiseEffectiveDate: "2026-11-01",
  nextPayDate: "2026-10-23",
  payFrequency: "biweekly",
  semimonthlySchedule: "1st-and-15th",
  bonusAmount: 5_000,
  bonusPayDate: "2026-12-04",
  contributionsYtd: 12_000,
  currentContributionRate: 0,
  updateDelayPaychecks: 1,
  goalType: "target",
  targetAmount: 20_000,
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const payFrequencyLabels: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice monthly",
  monthly: "Monthly",
};

function currencyValue(value: number) {
  return currency.format(value);
}

export default function Home() {
  const [input, setInput] = useState(initialInput);
  const [rateOverride, setRateOverride] = useState("");
  const percentage = rateOverride === "" ? undefined : Number(rateOverride);
  const plan = useMemo(
    () => calculateContributionPlan(input, percentage),
    [input, percentage],
  );
  const goalProgress =
    plan.goalAmount > 0
      ? Math.min(100, (plan.projectedAnnualContribution / plan.goalAmount) * 100)
      : 0;

  function updateInput<K extends keyof ContributionInput>(
    key: K,
    value: ContributionInput[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark} aria-hidden="true">
            p
          </div>
          <span className={styles.brandName}>pennywise</span>
        </div>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>YOUR 2026 CONTRIBUTION PLAN</p>
            <h1>A little clarity goes a long way.</h1>
            <p className={styles.subtitle}>
              Find a paycheck percentage that fits your goal, your pay schedule,
              and the rest of your year.
            </p>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <svg
              className={styles.heroIllustration}
              viewBox="0 0 360 190"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="coin-gradient"
                  x1="95"
                  y1="72"
                  x2="151"
                  y2="144"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#E9C878" />
                  <stop offset="1" stopColor="#C59340" />
                </linearGradient>
                <linearGradient
                  id="leaf-gradient"
                  x1="197"
                  y1="42"
                  x2="286"
                  y2="137"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#9CB783" />
                  <stop offset="1" stopColor="#547E5D" />
                </linearGradient>
              </defs>
              <ellipse cx="196" cy="166" rx="128" ry="12" fill="#DDE4D4" />
              <path
                d="M43 154h220c7 0 12 5 12 12v4H43v-16Z"
                fill="#D9C9A3"
              />
              <path d="M43 154h220v5H43z" fill="#E9D9B5" />
              <rect x="75" y="116" width="62" height="38" rx="5" fill="#BF8C3B" />
              <rect x="75" y="110" width="62" height="12" rx="4" fill="#D4A44D" />
              <path d="M96 122h20v32H96z" fill="#E1B65E" />
              <circle cx="103" cy="88" r="28" fill="url(#coin-gradient)" />
              <circle cx="103" cy="88" r="21" stroke="#F8E7B4" strokeWidth="2" />
              <path
                d="M107 77c-2-2-8-2-10 1-3 5 1 7 6 9 6 2 8 5 5 9-2 3-8 4-12 1m7-24v30"
                stroke="#FFF1C7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="143" cy="106" r="18" fill="#E6C16F" />
              <circle cx="143" cy="106" r="12" stroke="#FFF0C6" strokeWidth="1.5" />
              <path d="M222 148c3-29 1-55-5-78" stroke="#547E5D" strokeWidth="4" strokeLinecap="round" />
              <path
                d="M216 98c-23 1-37-12-35-31 19-1 34 9 35 31Z"
                fill="url(#leaf-gradient)"
              />
              <path d="M214 93l-24-21" stroke="#E0E9D8" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M216 79c1-21 16-34 36-31 0 20-14 33-36 31Z"
                fill="url(#leaf-gradient)"
              />
              <path d="M220 74l24-20" stroke="#E0E9D8" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M219 122c-18-1-29-12-27-27 16 0 27 10 27 27Z"
                fill="#75966B"
              />
              <path d="m216 117-17-17" stroke="#DDE8D7" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M264 53h47v47" stroke="#B7C7A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m258 94 22-22 13 12 30-33" stroke="#78936D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="323" cy="51" r="4" fill="#D4A44D" />
              <circle cx="54" cy="73" r="3" fill="#D5B874" />
              <circle cx="294" cy="131" r="3" fill="#A9BA98" />
            </svg>
            <div className={styles.heroArtNote}>
              <span className={styles.heroNoteIcon}>↗</span>
              <span>Small steps. Steadier growth.</span>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.formPanel} aria-labelledby="details-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.stepLabel}>FIRST, THE BASICS</p>
              <h2 id="details-title">Your pay and contribution details</h2>
              <p className={styles.sectionDescription}>
                A few details help us make the estimate fit your situation.
              </p>
            </div>
            <span className={styles.yearBadge}>TAX YEAR <b>2026</b></span>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Age by December 31, 2026</span>
              <input
                type="number"
                min="16"
                max="120"
                step="1"
                value={input.ageAtYearEnd}
                onChange={(event) =>
                  updateInput("ageAtYearEnd", Number(event.target.value))
                }
              />
              <small>Used to include an eligible IRS catch-up limit.</small>
            </label>

            <label className={styles.field}>
              <span>Pay frequency</span>
              <select
                value={input.payFrequency}
                onChange={(event) =>
                  updateInput(
                    "payFrequency",
                    event.target.value as PayFrequency,
                  )
                }
              >
                {Object.entries(payFrequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Current annual salary</span>
              <div className={styles.inputWithPrefix}>
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={input.annualSalary}
                  onChange={(event) =>
                    updateInput("annualSalary", Number(event.target.value))
                  }
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>Next paycheck date</span>
              <input
                type="date"
                value={input.nextPayDate}
                onChange={(event) =>
                  updateInput("nextPayDate", event.target.value)
                }
              />
              <small>Enter your next upcoming payday in 2026.</small>
            </label>

            {input.payFrequency === "semimonthly" && (
              <label className={styles.field}>
                <span>Twice-monthly paydays</span>
                <select
                  value={input.semimonthlySchedule}
                  onChange={(event) =>
                    updateInput(
                      "semimonthlySchedule",
                      event.target.value as ContributionInput["semimonthlySchedule"],
                    )
                  }
                >
                  <option value="1st-and-15th">1st and 15th</option>
                  <option value="15th-and-last">15th and last day</option>
                </select>
              </label>
            )}

            <label className={styles.field}>
              <span>Contributions already made in 2026</span>
              <div className={styles.inputWithPrefix}>
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={input.contributionsYtd}
                  onChange={(event) =>
                    updateInput("contributionsYtd", Number(event.target.value))
                  }
                />
              </div>
              <small>Include your own traditional and Roth 401(k) deferrals.</small>
            </label>

            <label className={styles.field}>
              <span>Current contribution rate</span>
              <div
                className={`${styles.inputWithPrefix} ${styles.inputWithSuffix}`}
              >
                <input
                  aria-label="Current contribution rate"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={input.currentContributionRate}
                  onChange={(event) =>
                    updateInput(
                      "currentContributionRate",
                      Number(event.target.value),
                    )
                  }
                />
                <span aria-hidden="true">%</span>
              </div>
              <small>Used for paychecks before the update takes effect.</small>
            </label>

            <label className={styles.field}>
              <span>Paychecks before the new rate starts</span>
              <input
                type="number"
                min="0"
                max="52"
                step="1"
                value={input.updateDelayPaychecks}
                onChange={(event) =>
                  updateInput(
                    "updateDelayPaychecks",
                    Number(event.target.value),
                  )
                }
              />
              <small>
                Enter 0 if the new rate applies to your next paycheck.
              </small>
            </label>
          </div>

          <div className={styles.divider} />

          <div className={styles.subsectionHeading}>
            <div>
              <span className={styles.sectionNumber}>02</span>
              <div>
                <p className={styles.stepLabel}>CHANGES AHEAD</p>
                <h3>Raises and bonuses</h3>
              </div>
            </div>
            <span className={styles.optionalTag}>OPTIONAL</span>
          </div>
          <p className={styles.groupDescription}>
            Include expected pay changes so they’re reflected in the estimate.
          </p>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>New annual salary after raise</span>
              <div className={styles.inputWithPrefix}>
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={input.annualSalaryAfterRaise}
                  onChange={(event) =>
                    updateInput(
                      "annualSalaryAfterRaise",
                      Number(event.target.value),
                    )
                  }
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>Raise effective date</span>
              <input
                type="date"
                value={input.raiseEffectiveDate ?? ""}
                onChange={(event) =>
                  updateInput(
                    "raiseEffectiveDate",
                    event.target.value || null,
                  )
                }
              />
              <small>Leave blank if your salary will not change.</small>
            </label>

            <label className={styles.field}>
              <span>Expected bonus still to come</span>
              <div className={styles.inputWithPrefix}>
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={input.bonusAmount}
                  onChange={(event) =>
                    updateInput("bonusAmount", Number(event.target.value))
                  }
                />
              </div>
              <small>Assumes the same contribution percentage applies.</small>
            </label>

            <label className={styles.field}>
              <span>Expected bonus pay date</span>
              <input
                type="date"
                value={input.bonusPayDate ?? ""}
                onChange={(event) =>
                  updateInput("bonusPayDate", event.target.value || null)
                }
              />
            </label>
          </div>

          <div className={styles.divider} />

          <fieldset className={styles.goalFieldset}>
            <legend>
              <span className={styles.sectionNumber}>03</span>
              <span>
                <small className={styles.stepLabel}>YOUR FINISH LINE</small>
                What do you want to contribute this year?
              </span>
            </legend>
            <p className={styles.groupDescription}>
              Pick a personal target or aim for the IRS employee maximum.
            </p>
            <label className={styles.goalOption}>
              <input
                type="radio"
                name="goalType"
                checked={input.goalType === "target"}
                onChange={() => updateInput("goalType", "target")}
              />
              <span>
                <strong>My target amount</strong>
                <small>Choose a personal total for 2026.</small>
              </span>
              <span className={styles.targetInput}>
                <span aria-hidden="true">$</span>
                <input
                  aria-label="My 2026 contribution target"
                  type="number"
                  min="0"
                  step="500"
                  value={input.targetAmount}
                  disabled={input.goalType !== "target"}
                  onChange={(event) =>
                    updateInput("targetAmount", Number(event.target.value))
                  }
                />
              </span>
            </label>
            <label className={styles.goalOption}>
              <input
                type="radio"
                name="goalType"
                checked={input.goalType === "max"}
                onChange={() => updateInput("goalType", "max")}
              />
              <span>
                <strong>MAX — IRS employee limit</strong>
                <small>Use the legal 2026 limit for your age.</small>
              </span>
            </label>
          </fieldset>
        </section>

        <aside className={styles.resultsPanel} aria-labelledby="results-title">
          <div className={styles.resultTopline}>
            <p className={styles.stepLabel}>THE GAME PLAN</p>
            <span className={styles.liveBadge}>
              <span aria-hidden="true" /> Live estimate
            </span>
          </div>
          <h2 id="results-title">Your next step</h2>
          <p className={styles.resultsIntro}>
            One clear percentage to put your goal within reach.
          </p>

          {plan.errors.length > 0 ? (
            <div className={styles.errorBox} role="alert">
              <strong>Check these details</strong>
              <ul>
                {plan.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className={styles.rateCard}>
                <label htmlFor="contribution-rate">Contribution per paycheck</label>
                <div className={styles.rateInputWrap}>
                  <input
                    id="contribution-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={
                      rateOverride === ""
                        ? plan.recommendedRate
                        : rateOverride
                    }
                    onChange={(event) => setRateOverride(event.target.value)}
                  />
                  <span>%</span>
                </div>
                <p>
                  {rateOverride !== ""
                    ? "Applies after the update delay; earlier checks use your current rate."
                    : plan.goalAchievable
                      ? "Lowest whole-number rate projected to reach your goal."
                      : "Even 100% of projected eligible pay will not reach this goal."}
                </p>
              </div>

              <div className={styles.progressSection}>
                <div className={styles.progressLabels}>
                  <span>Projected progress</span>
                  <strong>{Math.round(goalProgress)}%</strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Projected progress toward contribution goal"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(goalProgress)}
                >
                  <span style={{ width: `${goalProgress}%` }} />
                </div>
                <p>
                  {currencyValue(plan.projectedAnnualContribution)} projected
                  toward {currencyValue(plan.goalAmount)}
                </p>
              </div>

              <div className={styles.metricList}>
                <div className={styles.metric}>
                  <span>Contribution goal</span>
                  <strong>{currencyValue(plan.goalAmount)}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Still needed</span>
                  <strong>{currencyValue(plan.remainingToGoal)}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Paychecks remaining</span>
                  <strong>{plan.paychecksRemaining}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Checks before the change</span>
                  <strong>
                    {Math.min(
                      input.updateDelayPaychecks,
                      plan.paychecksRemaining,
                    )}
                  </strong>
                </div>
                <div className={styles.metric}>
                  <span>Projected total at this rate</span>
                  <strong>
                    {currencyValue(plan.projectedAnnualContribution)}
                  </strong>
                </div>
              </div>

              {plan.projectedAnnualContribution > plan.goalAmount && (
                <p className={styles.notice}>
                  At this whole-number rate, the estimate is{" "}
                  {currencyValue(
                    plan.projectedAnnualContribution - plan.goalAmount,
                  )}{" "}
                  above your goal. Payroll settings may not stop at a personal
                  target.
                </p>
              )}
              {plan.contributionsYtd > plan.legalLimit && (
                <p className={styles.notice}>
                  Your entered contributions are already above the estimated
                  IRS limit. Confirm your year-to-date total with your plan
                  administrator.
                </p>
              )}

              <p className={styles.disclaimer}>
                Planning estimate only. Employer contributions aren’t included.
                Check your plan’s bonus rules and payroll timing before changing
                your election.
              </p>
            </>
          )}
        </aside>
      </div>

      <footer className={styles.footer}>
        <span>
          2026 IRS employee contribution limit: {currencyValue(plan.legalLimit)}
        </span>
        <span>Educational estimate · Not financial or tax advice</span>
      </footer>
    </main>
  );
}
