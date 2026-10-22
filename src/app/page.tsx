"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import {
  DateInput,
  Field,
  MoneyInput,
  PercentInput,
} from "@/components/planner/fields";
import { PaycheckTable } from "@/components/planner/paycheck-table";
import { ResultCard } from "@/components/planner/result-card";
import { ShowMath } from "@/components/planner/show-math";
import {
  calculateContributionPlan,
  derivePaychecksPassed,
  derivePaychecksRemaining,
  deriveYtdContributionEstimate,
} from "@/lib/calc/calculator";
import { ANNUAL_LIMITS, getAnnualLimit } from "@/lib/calc/limits";
import {
  clearSavedProfiles,
  createProfile,
  getEmptyProfilesSnapshot,
  getProfilesSnapshot,
  getStorageErrorSnapshot,
  replaceProfiles,
  subscribeToProfiles,
  subscribeToStorageError,
  type PlannerProfile,
} from "@/lib/calc/profiles";
import type {
  Bonus,
  PayFrequency,
  PlannerInput,
  Raise,
} from "@/lib/calc/types";
import styles from "./planner.module.css";

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice monthly" },
  { value: "monthly", label: "Monthly" },
];

const wholeDollar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function DismissibleNotice({
  message,
  role,
}: {
  message: string;
  role: "alert" | "status";
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <p className="notice notice--warning notice--dismissible" role={role}>
      <span>{message}</span>
      <button
        className="message-dismiss"
        type="button"
        aria-label="Dismiss message"
        onClick={() => setDismissed(true)}
      >
        x
      </button>
    </p>
  );
}

function displayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SegmentOption<Value extends string> = {
  value: Value;
  label: string;
};

function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: SegmentOption<Value>[];
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="segment-field">
      <legend className="field-label">{label}</legend>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            className={
              option.value === value
                ? "segment-button segment-button--selected"
                : "segment-button"
            }
            type="button"
            aria-pressed={option.value === value}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Home() {
  const profiles = useSyncExternalStore(
    subscribeToProfiles,
    getProfilesSnapshot,
    getEmptyProfilesSnapshot,
  );
  const storageError = useSyncExternalStore(
    subscribeToStorageError,
    getStorageErrorSnapshot,
    () => "",
  );
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rateOverride, setRateOverride] = useState("");

  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedProfileId,
  ) ?? profiles[0];
  const activeProfileId = selectedProfile?.id ?? "";
  const input = selectedProfile?.plan ?? null;
  const estimatedYtd =
    input === null ? 0 : deriveYtdContributionEstimate(input);
  const effectiveInput =
    input === null
      ? null
      : {
          ...input,
          contributionsYtdThisEmployer:
            input.contributionsYtdOverride ?? estimatedYtd,
        };
  const parsedOverride =
    rateOverride === "" ? undefined : Number(rateOverride);
  const plan =
    effectiveInput === null
      ? null
      : calculateContributionPlan(effectiveInput, parsedOverride);
  const derivedPaychecks =
    input === null ? null : derivePaychecksRemaining(input);
  const paidPaychecks =
    input === null ? 0 : derivePaychecksPassed(input);
  const annualLimit =
    input === null
      ? null
      : getAnnualLimit(
          input.ageAtYearEnd,
          ANNUAL_LIMITS[input.taxYear] ?? ANNUAL_LIMITS[2026],
        );
  const nextPayDateError = plan?.errors.find((error) =>
    error.startsWith("Next pay date"),
  );
  const noticeErrors =
    plan?.errors.filter((error) => error !== nextPayDateError) ?? [];
  const noticeWarnings =
    plan?.warnings.filter(
      (warning) =>
        !warning.startsWith("Match at risk") &&
        !warning.startsWith("All remaining paychecks will use your current contribution rate"),
    ) ?? [];

  function updatePlan<K extends keyof PlannerInput>(
    key: K,
    value: PlannerInput[K],
  ) {
    replaceProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== activeProfileId) return profile;
        const plan = { ...profile.plan, [key]: value };
        if (key === "nextPayDate" && typeof value === "string") {
          plan.bonuses = profile.plan.bonuses.map((bonus) =>
            bonus.grossAmount === null &&
            bonus.payDate === profile.plan.nextPayDate
              ? { ...bonus, payDate: value }
              : bonus,
          );
        }
        return {
          ...profile,
          updatedAt: new Date().toISOString(),
          plan,
        };
      }),
    );
  }

  function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileName.trim();
    if (!name) return;
    const profile = createProfile(name);
    replaceProfiles((current) => [...current, profile]);
    setSelectedProfileId(profile.id);
    setProfileName("");
    setIsAddingProfile(false);
    setRateOverride("");
  }

  function removeSelectedProfile() {
    let remaining: PlannerProfile[] = [];
    replaceProfiles((current) => {
      remaining = current.filter(
        (profile) => profile.id !== activeProfileId,
      );
      return remaining;
    });
    setSelectedProfileId(remaining[0]?.id ?? "");
    setConfirmDelete(false);
    setRateOverride("");
  }

  function resetLocalProfiles() {
    if (!clearSavedProfiles()) {
      setSelectedProfileId("");
    }
  }

  function updateRaise(id: string, patch: Partial<Raise>) {
    if (!input) return;
    updatePlan(
      "raises",
      input.raises.map((raise) =>
        raise.id === id ? { ...raise, ...patch } : raise,
      ),
    );
  }

  function updateBonus(id: string, patch: Partial<Bonus>) {
    if (!input) return;
    updatePlan(
      "bonuses",
      input.bonuses.map((bonus) =>
        bonus.id === id ? { ...bonus, ...patch } : bonus,
      ),
    );
  }

  const taxYear = input?.taxYear ?? 2026;

  function defaultBonusPayDate(): string {
    if (!input) return `${taxYear}-12-31`;
    return input.nextPayDate.startsWith(`${taxYear}-`)
      ? input.nextPayDate
      : `${taxYear}-12-31`;
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.topbar}>
          <Link className={styles.brand} href="/" aria-label="Contribution planner home">
            <span className={styles.brandMark} aria-hidden="true">
              P
            </span>
            <span>
              <strong>Contribution Planner</strong>
              <small>401(k) · {taxYear}</small>
            </span>
          </Link>

          <div className={styles.profileControls}>
            {profiles.length > 0 && (
              <label className={styles.profileSelectField}>
                <span className="field-label">Planning for</span>
                <select
                  className={styles.profileSelect}
                  value={selectedProfileId}
                  onChange={(event) => {
                    setSelectedProfileId(event.target.value);
                    setRateOverride("");
                    setConfirmDelete(false);
                  }}
                >
                  {profiles.map((profile) => (
                    <option value={profile.id} key={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedProfile && (
              <span className={styles.savedDate}>
                Updated {displayDate(selectedProfile.updatedAt.slice(0, 10))}
              </span>
            )}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setIsAddingProfile((current) => !current);
                setProfileName("");
              }}
            >
              + Add plan
            </button>
          </div>
        </div>

        <div className={styles.hero}>
          <div>
            <p className="eyebrow">A CLEARER YEAR-END PLAN</p>
            <h1>Make your remaining paychecks count.</h1>
            <p className={styles.heroCopy}>
              See your inputs, paycheck-by-paycheck forecast, and recommended
              contribution rate together. Your plan updates as you make changes.
            </p>
          </div>
          <div className={styles.heroNote}>
            <span className={styles.heroNoteMark} aria-hidden="true">
              01
            </span>
            <span>Plan it once. See every paycheck.</span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {storageError && (
          <div className="notice notice--warning" role="alert">
            <p>{storageError}</p>
            <button className="text-button" type="button" onClick={resetLocalProfiles}>
              Clear saved plans and start fresh
            </button>
          </div>
        )}

        {isAddingProfile && (
          <form className={styles.addProfile} onSubmit={addProfile}>
            <div>
              <p className="eyebrow">HOUSEHOLD PLAN</p>
              <h2>Name this plan</h2>
              <p className="section-copy">
                Use a first name or nickname. We prefilled an example plan
                with fictional amounts so you can see how the calculator works.
                Replace them with your details before relying on the estimate.
              </p>
            </div>
            <label className={styles.profileNameField}>
              <span className="field-label">Name</span>
              <input
                autoFocus
                className="text-input"
                id="new-profile-name"
                maxLength={40}
                required
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />
            </label>
            <div className={styles.profileFormActions}>
              <button className="button button--primary" type="submit">
                Create plan
              </button>
              <button
                className="button button--text"
                type="button"
                onClick={() => setIsAddingProfile(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!selectedProfile || !input || !plan ? (
          <section className={styles.emptyState}>
            <p className="eyebrow">YOUR PLANS</p>
            <h2>Add your first plan</h2>
            <p>
              Create a local plan for yourself or a household member. Your
              profile and contribution details stay in this browser.
            </p>
            {!isAddingProfile && (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setIsAddingProfile(true)}
              >
                + Add your first plan
              </button>
            )}
          </section>
        ) : (
          <>
            {(noticeErrors.length > 0 || noticeWarnings.length > 0) && (
              <div className={`notice-list ${styles.plannerIssues}`}>
                {noticeErrors.map((error) => (
                  <DismissibleNotice
                    key={`${activeProfileId}-error-${error}`}
                    message={error}
                    role="alert"
                  />
                ))}
                {noticeWarnings.map((warning) => (
                  <DismissibleNotice
                    key={`${activeProfileId}-warning-${warning}`}
                    message={warning}
                    role="status"
                  />
                ))}
              </div>
            )}

            <div className={styles.plannerGrid}>
              <div className={styles.formColumn}>
                <section
                  className={`${styles.formCard} ${styles.paySection}`}
                  aria-labelledby="pay-title"
                >
                  <div className={styles.cardHeading}>
                    <div>
                      <p className="eyebrow">01 · YOUR PAY</p>
                      <h2 id="pay-title">How you get paid</h2>
                    </div>
                  </div>
                  <div className={styles.twoColumns}>
                    <MoneyInput
                      id="annual-salary"
                      label="Annual salary"
                      value={input.annualSalary}
                      onChange={(value) =>
                        updatePlan("annualSalary", Number(value))
                      }
                      className="field"
                      controlClassName="text-input tabular-number"
                      help="Your current annual salary before tax."
                      error={plan.errors.find((error) =>
                        error.startsWith("Annual salary"),
                      )}
                    />
                    <div className="field">
                      <span className="field-label">Pay frequency</span>
                      <div className={styles.frequencyOptions}>
                        {FREQUENCIES.map((frequency) => (
                          <button
                            className={
                              input.payFrequency === frequency.value
                                ? styles.frequencySelected
                                : styles.frequencyButton
                            }
                            type="button"
                            aria-pressed={
                              input.payFrequency === frequency.value
                            }
                            key={frequency.value}
                            onClick={() =>
                              updatePlan("payFrequency", frequency.value)
                            }
                          >
                            {frequency.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {input.payFrequency === "semimonthly" && (
                    <Field
                      label="Twice-monthly payday pattern"
                      htmlFor="semimonthly-schedule"
                      className="field"
                    >
                      <select
                        className="text-input"
                        id="semimonthly-schedule"
                        value={input.semimonthlySchedule}
                        onChange={(event) =>
                          updatePlan(
                            "semimonthlySchedule",
                            event.target.value as PlannerInput["semimonthlySchedule"],
                          )
                        }
                      >
                        <option value="1st-and-15th">1st and 15th</option>
                        <option value="15th-and-last">15th and last day</option>
                      </select>
                    </Field>
                  )}
                  <div className={styles.twoColumns}>
                    <DateInput
                      id="next-pay-date"
                      label="Next pay date"
                      value={input.nextPayDate}
                      onChange={(value) => updatePlan("nextPayDate", value)}
                      className="field"
                      controlClassName="text-input"
                      help={`Choose the next payday. Paychecks remaining through December 31 are counted automatically.`}
                      error={nextPayDateError}
                    />
                    <div className="field paycheck-count" aria-live="polite">
                      <span className="field-label">
                        Paychecks remaining this year
                      </span>
                      <output
                        className="paycheck-count-value tabular-number"
                        aria-label="Paychecks remaining this year"
                      >
                        {derivedPaychecks ?? "—"}
                      </output>
                      <span className="field-help">
                        Automatically counted from your next pay date.
                      </span>
                    </div>
                  </div>
                  <div className={styles.targetBlock}>
                    <SegmentedControl
                      label="Your contribution goal"
                      value={input.goalType}
                      options={[
                        { value: "max", label: "MAX · legal limit" },
                        { value: "target", label: "Set a target" },
                      ]}
                      onChange={(value) => updatePlan("goalType", value)}
                    />
                    {input.goalType === "target" && (
                      <MoneyInput
                        id="target-amount"
                        label="Target contribution"
                        value={input.targetAmount}
                        onChange={(value) =>
                          updatePlan("targetAmount", Number(value))
                        }
                        className="field"
                        controlClassName="text-input tabular-number"
                        help="The total you want to contribute this year."
                        error={plan.errors.find((error) =>
                          error.startsWith("Contribution target"),
                        )}
                      />
                    )}
                  </div>
                </section>

                <section
                  className={`${styles.formCard} ${styles.whereSection}`}
                  aria-labelledby="where-title"
                >
                  <div className={styles.cardHeading}>
                    <div>
                      <p className="eyebrow">02 · WHERE YOU ARE</p>
                      <h2 id="where-title">Your current contributions</h2>
                    </div>
                  </div>
                  <p className="section-copy">
                    Start with the contribution percentage on your latest
                    paystub. We’ll estimate your contributions so far from
                    salary, pay frequency, and the next payday.
                  </p>
                  <div className={styles.currentRateField}>
                    <PercentInput
                      id="current-rate"
                      label="What percentage are you contributing today?"
                      value={input.currentContributionRate ?? ""}
                      onChange={(value) =>
                        updatePlan(
                          "currentContributionRate",
                          value === "" ? null : Number(value),
                        )
                      }
                      className="field"
                      controlClassName="text-input tabular-number"
                      help="Use the employee contribution rate on your latest paystub."
                      error={plan.errors.find((error) =>
                        error.startsWith("Current contribution rate"),
                      )}
                    />
                  </div>

                  <div className={styles.estimatePanel}>
                    <div>
                      <span className="field-label">
                        {input.contributionsYtdOverride === null
                          ? "Estimated contributed here so far"
                          : "Calculated estimate"}
                      </span>
                      <strong className={`${styles.estimateAmount} tabular-number`}>
                        {wholeDollar.format(estimatedYtd)}
                      </strong>
                      <span className="field-help">
                        Estimated from {paidPaychecks} paycheck
                        {paidPaychecks === 1 ? "" : "s"} before{" "}
                        {displayDate(input.nextPayDate)}. This salary-based
                        estimate excludes past raises and bonuses.
                      </span>
                    </div>
                    {input.contributionsYtdOverride === null ? (
                      <button
                        className="button button--secondary button--compact"
                        type="button"
                        onClick={() =>
                          updatePlan(
                            "contributionsYtdOverride",
                            estimatedYtd,
                          )
                        }
                      >
                        Enter actual amount
                      </button>
                    ) : (
                      <div className={styles.overrideControls}>
                        <MoneyInput
                          id="ytd-current-employer"
                          label="Actual amount from paystub"
                          value={input.contributionsYtdOverride}
                          onChange={(value) =>
                            updatePlan(
                              "contributionsYtdOverride",
                              Number(value),
                            )
                          }
                          className="field"
                          controlClassName="text-input tabular-number"
                          help="The plan will use this amount instead of the estimate."
                          error={plan.errors.find((error) =>
                            error.startsWith("This-employer contributions"),
                          )}
                        />
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            updatePlan("contributionsYtdOverride", null)
                          }
                        >
                          Use calculated estimate
                        </button>
                      </div>
                    )}
                  </div>

                  <Field
                    label={`Age on December 31, ${taxYear}`}
                    htmlFor="age-at-year-end"
                    className="field"
                    help={
                      <>
                        {taxYear} IRS employee limit for your age:{" "}
                        <span className="tabular-number">
                          {wholeDollar.format(annualLimit ?? 0)}
                        </span>
                        .
                      </>
                    }
                    error={plan.errors.find((error) =>
                      error.startsWith("Enter an age"),
                    )}
                  >
                    <input
                      className="text-input tabular-number"
                      id="age-at-year-end"
                      type="number"
                      min={16}
                      max={120}
                      step={1}
                      value={input.ageAtYearEnd}
                      onChange={(event) =>
                        updatePlan("ageAtYearEnd", Number(event.target.value))
                      }
                    />
                  </Field>
                  <section
                    className={styles.otherEmployerPanel}
                    aria-labelledby="other-employer-title"
                  >
                    <div>
                      <p className="eyebrow">CHANGED JOBS THIS YEAR?</p>
                      <h3 id="other-employer-title">
                        Contributions from previous employers
                      </h3>
                      <p className="section-copy">
                        Add any 401(k) employee contributions from another
                        employer. The IRS limit is shared across jobs.
                      </p>
                      <p className={styles.limitSummary}>
                        Combined year-to-date contributions:{" "}
                        <strong className="tabular-number">
                          {wholeDollar.format(plan.ytdTotal)}
                        </strong>
                        . Remaining employee limit:{" "}
                        <strong className="tabular-number">
                          {wholeDollar.format(
                            Math.max(0, plan.legalLimit - plan.ytdTotal),
                          )}
                        </strong>
                        .
                      </p>
                    </div>
                    <MoneyInput
                      id="ytd-other-employers"
                      label="Contributed at other employers"
                      value={input.contributionsYtdOtherEmployers}
                      onChange={(value) =>
                        updatePlan(
                          "contributionsYtdOtherEmployers",
                          Number(value),
                        )
                      }
                      className="field"
                      controlClassName="text-input tabular-number"
                      help="Enter 0 if this does not apply."
                      error={plan.errors.find(
                        (error) =>
                          error.startsWith("Other-employer contributions") ||
                          error.startsWith("Over the limit"),
                      )}
                    />
                  </section>
                </section>

                <section
                  className={`${styles.formCard} ${styles.changesSection}`}
                  aria-labelledby="changes-title"
                >
                  <div className={styles.cardHeading}>
                    <div>
                      <p className="eyebrow">03 · CHANGES THIS YEAR</p>
                      <h2 id="changes-title">Raises and bonuses</h2>
                    </div>
                  </div>
                  <p className="section-copy">
                    A raise changes the gross pay of checks on or after its
                    effective date, even while a contribution-rate change is
                    delayed. A bonus uses the current or new rate according to
                    its pay date.
                  </p>
                  <div className={styles.delayPanel}>
                    <Field
                      label="When can your new contribution rate start?"
                      htmlFor="update-delay"
                      className="field"
                      help={
                        <>
                          Choose how many upcoming paychecks will still use
                          your current rate.
                          {derivedPaychecks !== null &&
                            derivedPaychecks > 0 &&
                            input.updateDelayPaychecks >= derivedPaychecks && (
                              <span className={styles.inlineWarning}>
                                {" "}
                                No remaining paycheck will receive the new
                                rate.
                              </span>
                            )}
                        </>
                      }
                      error={plan.errors.find((error) =>
                        error.startsWith("Update delay"),
                      )}
                    >
                      <select
                        className="text-input"
                        id="update-delay"
                        value={input.updateDelayPaychecks}
                        onChange={(event) =>
                          updatePlan(
                            "updateDelayPaychecks",
                            Number(event.target.value),
                          )
                        }
                      >
                        {[0, 1, 2, 3].map((count) => (
                          <option value={count} key={count}>
                            {count === 0
                              ? "Immediately · 0 paychecks"
                              : `After ${count} paycheck${count === 1 ? "" : "s"}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className={styles.eventHeading}>
                    <h3>Raises</h3>
                    <button
                      className={`${styles.eventAction} ${styles.raiseAction}`}
                      type="button"
                      onClick={() =>
                        updatePlan("raises", [
                          ...input.raises,
                          {
                            id: crypto.randomUUID(),
                            effectiveDate: "",
                            annualSalary: null,
                          },
                        ])
                      }
                    >
                      <span aria-hidden="true">+</span> Add raise
                    </button>
                  </div>
                  {input.raises.length === 0 ? (
                    <p className={styles.noEvents}>No raises added.</p>
                  ) : (
                    <div className={styles.eventList}>
                      {input.raises.map((raise, index) => (
                        <div className={styles.eventRow} key={raise.id}>
                          <DateInput
                            id={`raise-date-${raise.id}`}
                            label={`Raise ${index + 1} effective date`}
                            value={raise.effectiveDate}
                            onChange={(value) =>
                              updateRaise(raise.id, { effectiveDate: value })
                            }
                            className="field"
                            controlClassName="text-input"
                          />
                          <MoneyInput
                            id={`raise-salary-${raise.id}`}
                            label="New annual salary"
                            value={raise.annualSalary ?? ""}
                            onChange={(value) =>
                              updateRaise(raise.id, {
                                annualSalary:
                                  value === "" ? null : Number(value),
                              })
                            }
                            className="field"
                            controlClassName="text-input tabular-number"
                            help={
                              raise.effectiveDate === "" &&
                              raise.annualSalary === null
                                ? "Optional · leave blank if you do not expect a raise."
                                : undefined
                            }
                          />
                          <button
                            className={styles.removeEvent}
                            type="button"
                            aria-label={`Remove raise ${index + 1}`}
                            onClick={() =>
                              updatePlan(
                                "raises",
                                input.raises.filter(
                                  (item) => item.id !== raise.id,
                                ),
                              )
                            }
                          >
                            <span aria-hidden="true">×</span> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.eventHeading}>
                    <h3>Bonuses</h3>
                    <button
                      className={`${styles.eventAction} ${styles.bonusAction}`}
                      type="button"
                      onClick={() =>
                        updatePlan("bonuses", [
                          ...input.bonuses,
                          {
                            id: crypto.randomUUID(),
                            payDate: defaultBonusPayDate(),
                            grossAmount: null,
                          },
                        ])
                      }
                    >
                      <span aria-hidden="true">+</span> Add bonus
                    </button>
                  </div>
                  {input.bonuses.length === 0 ? (
                    <p className={styles.noEvents}>No bonuses added.</p>
                  ) : (
                    <div className={styles.eventList}>
                      {input.bonuses.map((bonus, index) => (
                        <div
                          className={`${styles.eventRow} ${styles.bonusEvent}`}
                          key={bonus.id}
                        >
                          <DateInput
                            id={`bonus-date-${bonus.id}`}
                            label={`Bonus ${index + 1} pay date`}
                            value={bonus.payDate}
                            onChange={(value) =>
                              updateBonus(bonus.id, { payDate: value })
                            }
                            className="field"
                            controlClassName="text-input"
                            help="A future bonus is included as a separate payment; it does not need to match a regular paycheck date."
                          />
                          <MoneyInput
                            id={`bonus-amount-${bonus.id}`}
                            label="Gross bonus"
                            value={bonus.grossAmount ?? ""}
                            onChange={(value) =>
                              updateBonus(bonus.id, {
                                grossAmount:
                                  value === "" ? null : Number(value),
                              })
                            }
                            className="field"
                            controlClassName="text-input tabular-number"
                            help={
                              bonus.grossAmount === null
                                ? "Optional · leave the amount blank if you do not expect a bonus."
                                : undefined
                            }
                          />
                          <button
                            className={styles.removeEvent}
                            type="button"
                            aria-label={`Remove bonus ${index + 1}`}
                            onClick={() =>
                              updatePlan(
                                "bonuses",
                                input.bonuses.filter(
                                  (item) => item.id !== bonus.id,
                                ),
                              )
                            }
                          >
                            <span aria-hidden="true">×</span> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <details className={styles.advanced}>
                    <summary>Advanced plan details</summary>
                    <div className={styles.advancedContent}>
                      <PercentInput
                        id="plan-max-percent"
                        label="Plan's maximum contribution rate"
                        value={input.planMaxPercent ?? ""}
                        onChange={(value) =>
                          updatePlan(
                            "planMaxPercent",
                            value === "" ? null : Number(value),
                          )
                        }
                        className="field"
                        controlClassName="text-input tabular-number"
                        help="Leave blank if your plan has no percentage cap."
                      />
                      <p className="field-label">Employer match (optional)</p>
                      <div className={styles.twoColumns}>
                        <PercentInput
                          id="employer-match-percent"
                          label="Employer match rate"
                          value={
                            input.employerMatch?.employerMatchPercent ?? ""
                          }
                          onChange={(value) =>
                            updatePlan(
                              "employerMatch",
                              value === ""
                                ? null
                                : {
                                    employerMatchPercent: Number(value),
                                    employeeContributionCapPercent:
                                      input.employerMatch
                                        ?.employeeContributionCapPercent ?? 4,
                                  },
                            )
                          }
                          className="field"
                          controlClassName="text-input tabular-number"
                          help="Example: 100% match."
                        />
                        <PercentInput
                          id="match-cap-percent"
                          label="Employee rate matched up to"
                          value={
                            input.employerMatch
                              ?.employeeContributionCapPercent ?? ""
                          }
                          onChange={(value) =>
                            updatePlan(
                              "employerMatch",
                              value === ""
                                ? null
                                : {
                                    employerMatchPercent:
                                      input.employerMatch
                                        ?.employerMatchPercent ?? 100,
                                    employeeContributionCapPercent:
                                      Number(value),
                                  },
                            )
                          }
                          className="field"
                          controlClassName="text-input tabular-number"
                          help="Example: up to 4% of your pay."
                        />
                      </div>
                      <label className={styles.checkField}>
                        <input
                          type="checkbox"
                          checked={input.planHasTrueUp}
                          onChange={(event) =>
                            updatePlan("planHasTrueUp", event.target.checked)
                          }
                        />
                        <span>My plan has a year-end match true-up</span>
                      </label>
                      <p className="field-help">
                        We only estimate a missed match when you enter your
                        employer’s formula. Confirm it with your plan documents.
                      </p>
                    </div>
                  </details>
                </section>

                <p className={styles.localNote}>
                  Your profile is saved on this device only. Avoid entering
                  account numbers or other sensitive details.
                </p>
              </div>

              {plan && (
                <aside className={styles.resultColumn}>
                  <ResultCard
                    className={styles.resultCard}
                    plan={plan}
                    input={input}
                    selectedRate={rateOverride}
                    onSelectedRateChange={setRateOverride}
                    onUseRecommendation={() => setRateOverride("")}
                  />
                  <p className={styles.sourceNote}>
                    The {taxYear} employee limit is{" "}
                    <strong className="tabular-number">
                      {wholeDollar.format(plan.legalLimit)}
                    </strong>
                    .{" "}
                    <a
                      href={ANNUAL_LIMITS[taxYear]?.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      IRS source for {taxYear}
                    </a>
                    .
                  </p>
                </aside>
              )}
            </div>

            {plan && plan.errors.length === 0 && (
              <div className={styles.projectionDetails}>
                <PaycheckTable
                  className={styles.scheduleCard}
                  events={plan.contributionEvents}
                />
                <ShowMath
                  className={styles.mathCard}
                  plan={plan}
                  input={input}
                />
              </div>
            )}

            {selectedProfile && profiles.length > 0 && (
              <div className={styles.profileFooter}>
                {confirmDelete ? (
                  <span>
                    Remove {selectedProfile.name} and their local plan? This
                    cannot be undone.
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      onClick={removeSelectedProfile}
                    >
                      Yes, remove plan
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Remove this local plan
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <p>
          Planning estimate only — not tax or investment advice. Check your
          paystub and plan documents before changing your elections.
        </p>
      </footer>
    </main>
  );
}
