"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Dispatch } from "react";

import styles from "@/app/app/app.module.css";
import { ProfileSetup } from "@/app/app/profile-setup";
import {
  type ApplicationEvent,
  type ApplicationState,
} from "@/application/state";
import { useApplicationState } from "@/application/use-application-state";
import type { UserProfile } from "@/domain/profile";
import type { ProfileStorageOperationResult } from "@/storage/profile-storage";

type ApplicationViewProps = Readonly<{
  state: ApplicationState;
  dispatch: Dispatch<ApplicationEvent>;
  saveProfile: (profile: UserProfile) => ProfileStorageOperationResult;
}>;

export const ApplicationView = ({
  state,
  dispatch,
  saveProfile,
}: ApplicationViewProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (state.kind === "restoring") {
    return (
      <div className={`app-canvas ${styles.canvas}`}>
        <div className={`content-shell ${styles.restoring}`}>
          <p className={styles.brand}>Can / I Eat This?</p>
          <p className={styles.restoringStatus} role="status" aria-live="polite">
            Restoring your temporary profile.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "welcome") {
    return (
      <div className={`app-canvas ${styles.canvas}`}>
        <motion.main
          className={`content-shell ${styles.welcome}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.26,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <p className={styles.brand}>Can / I Eat This?</p>

          <section className={styles.introduction} aria-labelledby="welcome-title">
            <h1 id="welcome-title" className={styles.title}>
              See what we can confirm—and what still needs checking.
            </h1>
            <p className={styles.summary}>
              Take a photo of a food and get an explanation based on the
              restrictions you choose. When an important detail is not visible,
              we will say so.
            </p>
            <p className={styles.scope}>
              Supports pregnancy, food allergies, high blood pressure,
              vegetarian, and vegan profiles.
            </p>
          </section>

          <div className={styles.actionGroup}>
            <button
              className={styles.primaryAction}
              type="button"
              onClick={() => dispatch({ type: "profileStarted" })}
            >
              Create my profile
            </button>
          </div>

          <footer className={styles.disclosures}>
            <p>
              Your complete profile stays on this device. When you request an
              analysis, only the food image and the profile information needed
              for that analysis are sent to our server and AI provider.
            </p>
            <p>
              This is decision support for selected restrictions, not medical
              advice or a guarantee that a food is safe.
            </p>
          </footer>
        </motion.main>
      </div>
    );
  }

  if (state.kind === "profile") {
    return (
      <div className={`app-canvas ${styles.canvas}`}>
        <ProfileSetup
          initialProfile={state.profile}
          onSave={saveProfile}
          onContinueWithoutSaving={(profile) =>
            dispatch({ type: "profileContinuedInMemory", profile })
          }
          onCancelEditing={
            state.profile
              ? () => dispatch({ type: "profileEditCanceled" })
              : undefined
          }
        />
      </div>
    );
  }

  if (state.kind === "capture") {
    return (
      <div className={`app-canvas ${styles.canvas}`}>
        <main className={`content-shell ${styles.developmentBoundary}`}>
          <p className={styles.brand}>Can / I Eat This?</p>
          <p>Your temporary profile is ready.</p>
          <button
            className={styles.secondaryAction}
            type="button"
            onClick={() => dispatch({ type: "profileEditRequested" })}
          >
            Edit profile
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={`app-canvas ${styles.canvas}`}>
      <main className={`content-shell ${styles.developmentBoundary}`}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <p>This step will be added in its approved implementation task.</p>
      </main>
    </div>
  );
};

export const AppExperience = () => {
  const { state, dispatch, saveProfile } = useApplicationState();

  return (
    <ApplicationView
      state={state}
      dispatch={dispatch}
      saveProfile={saveProfile}
    />
  );
};
