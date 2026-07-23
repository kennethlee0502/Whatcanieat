"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type FormEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "@/app/app/profile-setup.module.css";
import {
  allergyProfileSchema,
  userProfileSchema,
  type AllergyProfile,
  type AllergySeverity,
  type UserProfile,
} from "@/domain/profile";
import { calculateBmi } from "@/domain/profile-operations";
import type { ProfileStorageOperationResult } from "@/storage/profile-storage";

const STEP_COUNT = 5;
const MAX_ALLERGIES = 20;

type ProfileStep = 0 | 1 | 2 | 3 | 4;
type PregnancyStatus = "" | "notPregnant" | "pregnant";
type BooleanChoice = "" | "yes" | "no";
type DietChoice = "" | "none" | "vegetarian" | "vegan";

type ProfileDraft = {
  pregnancyStatus: PregnancyStatus;
  pregnancyWeek: string;
  allergies: AllergyProfile[];
  highBloodPressure: BooleanChoice;
  diet: DietChoice;
  height: string;
  heightUnit: "centimeters" | "inches";
  weight: string;
  weightUnit: "kilograms" | "pounds";
};

type ProfileSetupProps = Readonly<{
  initialProfile?: UserProfile;
  onSave: (profile: UserProfile) => ProfileStorageOperationResult;
  onContinueWithoutSaving?: (profile: UserProfile) => void;
  onCancelEditing?: () => void;
}>;

const isValidOptionalMeasurement = (value: string) =>
  value === "" || (Number.isFinite(Number(value)) && Number(value) > 0);

const createDraft = (profile?: UserProfile): ProfileDraft => ({
  pregnancyStatus: profile?.pregnancy.status ?? "",
  pregnancyWeek:
    profile?.pregnancy.status === "pregnant" &&
    profile.pregnancy.week !== undefined
      ? String(profile.pregnancy.week)
      : "",
  allergies: profile?.allergies.map((allergy) => ({ ...allergy })) ?? [],
  highBloodPressure:
    profile === undefined ? "" : profile.highBloodPressure ? "yes" : "no",
  diet: profile?.diet ?? "",
  height:
    profile?.measurements?.height === undefined
      ? ""
      : String(profile.measurements.height.value),
  heightUnit:
    profile?.measurements?.height?.unit ??
    "centimeters",
  weight:
    profile?.measurements?.weight === undefined
      ? ""
      : String(profile.measurements.weight.value),
  weightUnit:
    profile?.measurements?.weight?.unit ??
    "kilograms",
});

const getStepError = (step: ProfileStep, draft: ProfileDraft) => {
  if (step === 0 && draft.pregnancyStatus === "") {
    return "Choose whether you are currently pregnant.";
  }

  if (
    step === 0 &&
    draft.pregnancyStatus === "pregnant" &&
    draft.pregnancyWeek !== "" &&
    (!Number.isInteger(Number(draft.pregnancyWeek)) ||
      Number(draft.pregnancyWeek) < 1 ||
      Number(draft.pregnancyWeek) > 42)
  ) {
    return "Enter a pregnancy week from 1 to 42, or leave it blank.";
  }

  if (step === 2 && draft.highBloodPressure === "") {
    return "Choose whether high blood pressure applies to you.";
  }

  if (step === 3 && draft.diet === "") {
    return "Choose one dietary preference.";
  }

  if (step === 4) {
    if (
      !isValidOptionalMeasurement(draft.height) ||
      !isValidOptionalMeasurement(draft.weight)
    ) {
      return "Enter a number greater than zero, or leave the field blank.";
    }
  }

  return null;
};

const buildProfile = (draft: ProfileDraft): UserProfile | null => {
  if (
    draft.pregnancyStatus === "" ||
    draft.highBloodPressure === "" ||
    draft.diet === ""
  ) {
    return null;
  }

  const height =
    draft.height === ""
      ? undefined
      : { value: Number(draft.height), unit: draft.heightUnit };
  const weight =
    draft.weight === ""
      ? undefined
      : { value: Number(draft.weight), unit: draft.weightUnit };
  const measurements =
    height || weight
      ? {
          ...(height ? { height } : {}),
          ...(weight ? { weight } : {}),
          ...(height && weight
            ? {
                bmi:
                  calculateBmi({ height, weight }) ??
                  undefined,
              }
            : {}),
        }
      : undefined;

  const candidate = {
    pregnancy:
      draft.pregnancyStatus === "pregnant"
        ? {
            status: "pregnant" as const,
            ...(draft.pregnancyWeek === ""
              ? {}
              : { week: Number(draft.pregnancyWeek) }),
          }
        : { status: "notPregnant" as const },
    allergies: draft.allergies,
    highBloodPressure: draft.highBloodPressure === "yes",
    diet: draft.diet,
    ...(measurements ? { measurements } : {}),
  };
  const result = userProfileSchema.safeParse(candidate);

  return result.success ? result.data : null;
};

const Choice = ({
  name,
  value,
  checked,
  onChange,
  children,
}: Readonly<{
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}>) => (
  <label className={styles.choice}>
    <input
      type="radio"
      name={name}
      value={value}
      required
      checked={checked}
      onChange={onChange}
    />
    <span>{children}</span>
  </label>
);

const focusInvalidControl = (form: HTMLFormElement | null) => {
  form
    ?.querySelector<HTMLElement>("[aria-invalid='true'], input:invalid")
    ?.focus();
};

export const ProfileSetup = ({
  initialProfile,
  onSave,
  onContinueWithoutSaving = () => undefined,
  onCancelEditing,
}: ProfileSetupProps) => {
  const prefersReducedMotion = useReducedMotion();
  const initialProfileSignature = JSON.stringify(initialProfile ?? null);
  const previousInitialProfileSignature = useRef(initialProfileSignature);
  const [step, setStep] = useState<ProfileStep>(0);
  const [draft, setDraft] = useState(() => createDraft(initialProfile));
  const [stepError, setStepError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [profilePendingStorage, setProfilePendingStorage] =
    useState<UserProfile | null>(null);
  const [allergyLabel, setAllergyLabel] = useState("");
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const headingRef = useCallback<RefCallback<HTMLHeadingElement>>((element) => {
    element?.focus();
  }, []);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (previousInitialProfileSignature.current === initialProfileSignature) {
      return;
    }

    previousInitialProfileSignature.current = initialProfileSignature;
    setStep(0);
    setDraft(createDraft(initialProfile));
    setStepError(null);
    setStorageError(null);
    setProfilePendingStorage(null);
    setAllergyLabel("");
    setAllergyError(null);
  }, [initialProfile, initialProfileSignature]);

  const updateDraft = (change: Partial<ProfileDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setStepError(null);
    setStorageError(null);
    setProfilePendingStorage(null);
  };

  const addAllergy = () => {
    const trimmedLabel = allergyLabel.trim();
    const candidate = {
      allergenId: trimmedLabel.toLocaleLowerCase(),
      label: trimmedLabel,
    };
    const validation = allergyProfileSchema.safeParse(candidate);

    if (!validation.success) {
      setAllergyError("Enter an allergy name between 1 and 120 characters.");
      return;
    }
    if (draft.allergies.length >= MAX_ALLERGIES) {
      setAllergyError("You can add up to 20 allergies.");
      return;
    }
    if (
      draft.allergies.some(
        ({ allergenId }) => allergenId === validation.data.allergenId,
      )
    ) {
      setAllergyError("That allergy is already listed.");
      return;
    }

    updateDraft({ allergies: [...draft.allergies, validation.data] });
    setAllergyLabel("");
    setAllergyError(null);
  };

  const updateAllergySeverity = (
    index: number,
    severity: AllergySeverity | "",
  ) => {
    updateDraft({
      allergies: draft.allergies.map((allergy, allergyIndex) =>
        allergyIndex === index
          ? {
              allergenId: allergy.allergenId,
              label: allergy.label,
              ...(severity === "" ? {} : { severity }),
            }
          : allergy,
      ),
    });
  };

  const continueFromStep = (event: FormEvent) => {
    event.preventDefault();

    if (step === 1 && allergyLabel.trim() !== "") {
      setAllergyError("Add this allergy before continuing, or clear the field.");
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>("#allergy-name")?.focus(),
      );
      return;
    }

    const error = getStepError(step, draft);

    if (error) {
      setStepError(error);
      requestAnimationFrame(() => focusInvalidControl(formRef.current));
      return;
    }

    if (step < 4) {
      setStep((step + 1) as ProfileStep);
      setStepError(null);
      return;
    }

    const profile = buildProfile(draft);
    if (!profile) {
      setStepError("Review the profile fields and try again.");
      requestAnimationFrame(() => focusInvalidControl(formRef.current));
      return;
    }

    const result = onSave(profile);
    if (result.status === "error") {
      setStorageError(
        "We couldn’t save your temporary profile in this browser. Your entries are still here. Try again.",
      );
      setProfilePendingStorage(profile);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep((step - 1) as ProfileStep);
      setStepError(null);
      setStorageError(null);
      setProfilePendingStorage(null);
    }
  };

  const transition = {
    duration: prefersReducedMotion ? 0 : 0.26,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return (
    <main className={`content-shell ${styles.profile}`}>
      <header className={styles.header}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <p className={styles.progress} aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
          Your profile · {step + 1} of {STEP_COUNT}
        </p>
      </header>

      <form ref={formRef} onSubmit={continueFromStep} noValidate>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className={styles.step}
            key={step}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={transition}
          >
            {step === 0 ? (
              <PregnancyStep
                draft={draft}
                updateDraft={updateDraft}
                headingRef={headingRef}
                error={stepError}
              />
            ) : null}
            {step === 1 ? (
              <AllergyStep
                draft={draft}
                updateDraft={updateDraft}
                headingRef={headingRef}
                allergyLabel={allergyLabel}
                setAllergyLabel={setAllergyLabel}
                addAllergy={addAllergy}
                allergyError={allergyError}
                clearAllergyError={() => setAllergyError(null)}
                updateAllergySeverity={updateAllergySeverity}
              />
            ) : null}
            {step === 2 ? (
              <BloodPressureStep
                draft={draft}
                updateDraft={updateDraft}
                headingRef={headingRef}
                error={stepError}
              />
            ) : null}
            {step === 3 ? (
              <DietStep
                draft={draft}
                updateDraft={updateDraft}
                headingRef={headingRef}
                error={stepError}
              />
            ) : null}
            {step === 4 ? (
              <MeasurementsStep
                draft={draft}
                updateDraft={updateDraft}
                headingRef={headingRef}
                error={stepError}
              />
            ) : null}

            {storageError ? (
              <div className={styles.storageError} role="alert">
                <p>{storageError}</p>
              </div>
            ) : null}

            <div className={styles.actions}>
              <button className={styles.primaryAction} type="submit">
                {storageError
                  ? "Retry saving"
                  : step === 4
                    ? initialProfile
                      ? "Update profile"
                      : "Save profile"
                    : "Continue"}
              </button>
              {storageError && profilePendingStorage ? (
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() =>
                    onContinueWithoutSaving(profilePendingStorage)
                  }
                >
                  Continue without saving
                </button>
              ) : null}
              {!storageError && step > 0 ? (
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={goBack}
                >
                  Back
                </button>
              ) : null}
              {onCancelEditing ? (
                <button
                  className={styles.tertiaryAction}
                  type="button"
                  onClick={onCancelEditing}
                >
                  Cancel editing
                </button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </form>
    </main>
  );
};

type StepProps = Readonly<{
  draft: ProfileDraft;
  updateDraft: (change: Partial<ProfileDraft>) => void;
  headingRef: RefCallback<HTMLHeadingElement>;
  error: string | null;
}>;

const StepHeading = ({
  headingRef,
  children,
  description,
}: Readonly<{
  headingRef: RefCallback<HTMLHeadingElement>;
  children: React.ReactNode;
  description: string;
}>) => (
  <div className={styles.introduction}>
    <h1 ref={headingRef} className={styles.title} tabIndex={-1}>
      {children}
    </h1>
    <p className={styles.description}>{description}</p>
  </div>
);

const FieldError = ({ id, error }: Readonly<{ id: string; error: string | null }>) =>
  error ? (
    <p className={styles.fieldError} id={id} role="alert">
      {error}
    </p>
  ) : null;

const PregnancyStep = ({ draft, updateDraft, headingRef, error }: StepProps) => (
  <>
    <StepHeading
      headingRef={headingRef}
      description="This helps us check the limited pregnancy-related guidance supported by this product."
    >
      Are you currently pregnant?
    </StepHeading>
    <fieldset
      className={styles.fieldset}
      aria-describedby={error ? "pregnancy-error" : undefined}
    >
      <legend className={styles.srOnly}>Pregnancy status</legend>
      <Choice
        name="pregnancy-status"
        value="notPregnant"
        checked={draft.pregnancyStatus === "notPregnant"}
        onChange={() => updateDraft({ pregnancyStatus: "notPregnant", pregnancyWeek: "" })}
      >
        No, I’m not pregnant
      </Choice>
      <Choice
        name="pregnancy-status"
        value="pregnant"
        checked={draft.pregnancyStatus === "pregnant"}
        onChange={() => updateDraft({ pregnancyStatus: "pregnant" })}
      >
        Yes, I’m pregnant
      </Choice>
    </fieldset>
    {draft.pregnancyStatus === "pregnant" ? (
      <label className={styles.inputField}>
        <span>Pregnancy week <span className={styles.optional}>(optional)</span></span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="42"
          value={draft.pregnancyWeek}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "pregnancy-error" : "pregnancy-week-help"}
          onChange={(event) => updateDraft({ pregnancyWeek: event.target.value })}
        />
        <span className={styles.help} id="pregnancy-week-help">
          Leave this blank if you do not know.
        </span>
      </label>
    ) : null}
    <FieldError id="pregnancy-error" error={error} />
  </>
);

const AllergyStep = ({
  draft,
  updateDraft,
  headingRef,
  allergyLabel,
  setAllergyLabel,
  addAllergy,
  allergyError,
  clearAllergyError,
  updateAllergySeverity,
}: Omit<StepProps, "error"> & {
  allergyLabel: string;
  setAllergyLabel: (value: string) => void;
  addAllergy: () => void;
  allergyError: string | null;
  clearAllergyError: () => void;
  updateAllergySeverity: (index: number, severity: AllergySeverity | "") => void;
}) => (
  <>
    <StepHeading
      headingRef={headingRef}
      description="Add only allergies you want considered. Severity is optional and is never inferred."
    >
      Do you have food allergies?
    </StepHeading>
    <div className={styles.allergyEntry}>
      <label className={styles.inputField} htmlFor="allergy-name">
        <span>Allergy name</span>
        <input
          id="allergy-name"
          type="text"
          maxLength={120}
          value={allergyLabel}
          aria-invalid={Boolean(allergyError)}
          aria-describedby={allergyError ? "allergy-error" : "allergy-help"}
          onChange={(event) => {
            setAllergyLabel(event.target.value);
            clearAllergyError();
          }}
        />
        <span className={styles.help} id="allergy-help">
          Leave this empty if you have none to add.
        </span>
      </label>
      <button className={styles.addAction} type="button" onClick={addAllergy}>
        Add allergy
      </button>
    </div>
    <FieldError id="allergy-error" error={allergyError} />
    {draft.allergies.length === 0 ? (
      <p className={styles.emptyState}>No allergies added.</p>
    ) : (
      <ul className={styles.allergyList}>
        {draft.allergies.map((allergy, index) => (
          <li className={styles.allergyItem} key={allergy.allergenId}>
            <div>
              <p className={styles.allergyName}>{allergy.label}</p>
              <label className={styles.severityField}>
                <span>Severity you would use</span>
                <select
                  value={allergy.severity ?? ""}
                  onChange={(event) =>
                    updateAllergySeverity(
                      index,
                      event.target.value as AllergySeverity | "",
                    )
                  }
                >
                  <option value="">Not specified</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
            </div>
            <button
              className={styles.removeAction}
              type="button"
              aria-label={`Remove ${allergy.label}`}
              onClick={() => {
                updateDraft({
                  allergies: draft.allergies.filter(
                    (_, allergyIndex) => allergyIndex !== index,
                  ),
                });
                clearAllergyError();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    )}
  </>
);

const BloodPressureStep = ({ draft, updateDraft, headingRef, error }: StepProps) => (
  <>
    <StepHeading
      headingRef={headingRef}
      description="This lets the analysis flag supported high-sodium concerns. It is not a diagnosis."
    >
      Does high blood pressure apply to you?
    </StepHeading>
    <fieldset className={styles.fieldset} aria-describedby={error ? "pressure-error" : undefined}>
      <legend className={styles.srOnly}>High blood pressure</legend>
      <Choice name="blood-pressure" value="no" checked={draft.highBloodPressure === "no"} onChange={() => updateDraft({ highBloodPressure: "no" })}>
        No
      </Choice>
      <Choice name="blood-pressure" value="yes" checked={draft.highBloodPressure === "yes"} onChange={() => updateDraft({ highBloodPressure: "yes" })}>
        Yes
      </Choice>
    </fieldset>
    <FieldError id="pressure-error" error={error} />
  </>
);

const DietStep = ({ draft, updateDraft, headingRef, error }: StepProps) => (
  <>
    <StepHeading
      headingRef={headingRef}
      description="Choose the one option that best describes what you want checked."
    >
      What is your dietary preference?
    </StepHeading>
    <fieldset className={styles.fieldset} aria-describedby={error ? "diet-error" : undefined}>
      <legend className={styles.srOnly}>Dietary preference</legend>
      <Choice name="diet" value="none" checked={draft.diet === "none"} onChange={() => updateDraft({ diet: "none" })}>
        Neither vegetarian nor vegan
      </Choice>
      <Choice name="diet" value="vegetarian" checked={draft.diet === "vegetarian"} onChange={() => updateDraft({ diet: "vegetarian" })}>
        Vegetarian
      </Choice>
      <Choice name="diet" value="vegan" checked={draft.diet === "vegan"} onChange={() => updateDraft({ diet: "vegan" })}>
        Vegan
      </Choice>
    </fieldset>
    <FieldError id="diet-error" error={error} />
  </>
);

const MeasurementsStep = ({
  draft,
  updateDraft,
  headingRef,
  error,
}: StepProps) => {
  const heightIsValid = isValidOptionalMeasurement(draft.height);
  const weightIsValid = isValidOptionalMeasurement(draft.weight);
  const bmi =
    draft.height !== "" &&
    draft.weight !== "" &&
    heightIsValid &&
    weightIsValid
      ? calculateBmi({
          height: {
            value: Number(draft.height),
            unit: draft.heightUnit,
          },
          weight: {
            value: Number(draft.weight),
            unit: draft.weightUnit,
          },
        })
      : null;

  return (
    <>
      <StepHeading
        headingRef={headingRef}
        description="These fields are optional and saved for possible future profile features. They are not used in today’s food evaluation or sent for analysis."
      >
        Add measurements, if you want.
      </StepHeading>
      <div className={styles.measurements}>
        <div className={styles.measurementRow}>
          <label className={styles.inputField}>
            <span>Height <span className={styles.optional}>(optional)</span></span>
            <input type="number" inputMode="decimal" min="0" step="any" value={draft.height} aria-invalid={!heightIsValid} aria-describedby={!heightIsValid ? "measurements-error" : undefined} onChange={(event) => updateDraft({ height: event.target.value })} />
          </label>
          <label className={styles.unitField}>
            <span>Unit</span>
            <select value={draft.heightUnit} onChange={(event) => updateDraft({ heightUnit: event.target.value as ProfileDraft["heightUnit"] })}>
              <option value="centimeters">cm</option>
              <option value="inches">in</option>
            </select>
          </label>
        </div>
        <div className={styles.measurementRow}>
          <label className={styles.inputField}>
            <span>Weight <span className={styles.optional}>(optional)</span></span>
            <input type="number" inputMode="decimal" min="0" step="any" value={draft.weight} aria-invalid={!weightIsValid} aria-describedby={!weightIsValid ? "measurements-error" : undefined} onChange={(event) => updateDraft({ weight: event.target.value })} />
          </label>
          <label className={styles.unitField}>
            <span>Unit</span>
            <select value={draft.weightUnit} onChange={(event) => updateDraft({ weightUnit: event.target.value as ProfileDraft["weightUnit"] })}>
              <option value="kilograms">kg</option>
              <option value="pounds">lb</option>
            </select>
          </label>
        </div>
      </div>
      <FieldError id="measurements-error" error={error} />
      {bmi === null ? null : (
        <output className={styles.bmiOutput}>
          <span>Locally calculated BMI</span>
          <strong>{bmi.toFixed(1)}</strong>
        </output>
      )}
      <p className={styles.localNote}>
        Your complete profile stays in this browser session. Measurements and
        BMI are saved only for possible future profile features. They do not
        affect current recommendations and are not sent for analysis.
      </p>
    </>
  );
};
