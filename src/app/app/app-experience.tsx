"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
} from "react";

import styles from "@/app/app/app.module.css";
import { AnalysisFlow } from "@/app/app/analysis-flow";
import { CaptureFlow } from "@/app/app/capture-flow";
import { ClearAllControl } from "@/app/app/clear-all-control";
import { ClarificationFlow } from "@/app/app/clarification-flow";
import { ProfileSetup } from "@/app/app/profile-setup";
import { ResultFlow } from "@/app/app/result-flow";
import {
  type ApplicationEvent,
  type ApplicationState,
} from "@/application/state";
import { useApplicationState } from "@/application/use-application-state";
import type { UserProfile } from "@/domain/profile";
import { resolveClarification } from "@/domain/clarification";
import {
  requestAnalysis,
  type ClientAnalysis,
} from "@/lib/client-analysis";
import {
  createImageLifecycle,
  type ImageLifecycle,
  type PreparedImage,
} from "@/lib/image-lifecycle";
import type { ProfileStorageOperationResult } from "@/storage/profile-storage";

type ImageFlowController = Readonly<{
  lifecycle: ImageLifecycle;
  preparedImage: PreparedImage | null;
}>;

type ApplicationViewProps = Readonly<{
  state: ApplicationState;
  dispatch: Dispatch<ApplicationEvent>;
  saveProfile: (profile: UserProfile) => ProfileStorageOperationResult;
  imageFlow?: ImageFlowController;
  analyze?: ClientAnalysis;
  createRequestId?: () => string;
  onClearAll?: () => void;
}>;

export const ApplicationView = ({
  state,
  dispatch,
  saveProfile,
  imageFlow,
  analyze = requestAnalysis,
  createRequestId = () => crypto.randomUUID(),
  onClearAll,
}: ApplicationViewProps) => {
  const prefersReducedMotion = useReducedMotion();
  const welcomeHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.kind === "welcome" && state.clearPresentation) {
      welcomeHeadingRef.current?.focus();
    }
  }, [state]);

  const renderCanvas = (content: React.ReactNode) => (
    <div className={`app-canvas ${styles.canvas}`}>
      {(state.kind !== "welcome" ||
        state.clearPresentation === "storedProfileClearFailed") &&
      onClearAll ? (
        <ClearAllControl onConfirm={onClearAll} />
      ) : null}
      {content}
    </div>
  );

  if (state.kind === "restoring") {
    return renderCanvas(
        <div className={`content-shell ${styles.restoring}`}>
          <p className={styles.brand}>Can / I Eat This?</p>
          <p className={styles.restoringStatus} role="status" aria-live="polite">
            Restoring your temporary profile.
          </p>
        </div>
    );
  }

  if (state.kind === "welcome") {
    return renderCanvas(
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
            <h1
              ref={welcomeHeadingRef}
              id="welcome-title"
              className={styles.title}
              tabIndex={state.clearPresentation ? -1 : undefined}
            >
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
          {state.clearPresentation ? (
            <p
              className={styles.clearAnnouncement}
              role="status"
              aria-live="polite"
            >
              {state.clearPresentation === "storedProfileClearFailed"
                ? "Temporary app data was cleared, but the saved profile could not be removed. Try Clear All again."
                : state.clearPresentation === "cleared"
                  ? "Temporary data cleared."
                  : "Temporary app data cleared. Removing the saved profile."}
            </p>
          ) : null}
        </motion.main>
    );
  }

  if (state.kind === "profile") {
    return renderCanvas(
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
    );
  }

  if (
    imageFlow &&
    (state.kind === "capture" ||
      state.kind === "preparingImage" ||
      state.kind === "preview" ||
      state.kind === "error")
  ) {
    const startAnalysis = () => {
      dispatch({ type: "analysisStarted", requestId: createRequestId() });
    };

    return renderCanvas(
        <CaptureFlow
          state={state}
          dispatch={dispatch}
          imageLifecycle={imageFlow.lifecycle}
          preparedImage={imageFlow.preparedImage}
          onEditProfile={
            state.kind === "capture"
              ? () => dispatch({ type: "profileEditRequested" })
              : undefined
          }
          onConfirmPreparedImage={
            state.kind === "preview" && imageFlow.preparedImage
              ? startAnalysis
              : undefined
          }
          onRetryAnalysis={
            state.kind === "error" &&
            state.recovery.kind === "preview" &&
            state.error.retryable
              ? () => {
                  dispatch({ type: "errorDismissed" });
                  startAnalysis();
                }
              : undefined
          }
        />
    );
  }

  if (
    imageFlow &&
    state.kind === "analyzing" &&
    imageFlow.preparedImage
  ) {
    return renderCanvas(
        <AnalysisFlow
          requestId={state.requestId}
          preparedImage={imageFlow.preparedImage}
          profile={state.profile}
          analyze={analyze}
          onSuccess={(requestId, response) =>
            dispatch({
              type: "analysisSucceeded",
              requestId,
              facts: response.facts,
              evaluation: response.evaluation,
            })
          }
          onFailure={(requestId, error) =>
            dispatch({ type: "analysisFailed", requestId, error })
          }
          onCancel={(requestId) =>
            dispatch({ type: "analysisCanceled", requestId })
          }
        />
    );
  }

  if (imageFlow && state.kind === "result" && imageFlow.preparedImage) {
    return renderCanvas(
        <ResultFlow
          preparedImage={imageFlow.preparedImage}
          facts={state.facts}
          evaluation={state.evaluation}
          presentation={state.presentation}
          onClarificationRequested={(questionId) =>
            dispatch({ type: "clarificationRequested", questionId })
          }
          onNewScan={() => dispatch({ type: "newScanRequested" })}
        />
    );
  }

  if (state.kind === "clarification") {
    const question = state.evaluation.clarificationQuestions[0];
    if (question?.id === state.questionId) {
      return renderCanvas(
          <ClarificationFlow
            question={question}
            onSubmit={(answerOptionId) => {
              const resolution = resolveClarification({
                profile: state.profile,
                facts: state.facts,
                evaluation: state.evaluation,
                questionId: state.questionId,
                answerOptionId,
              });
              if (!resolution.success) {
                return false;
              }
              dispatch({
                type: "clarificationCompleted",
                facts: resolution.facts,
                evaluation: resolution.evaluation,
              });
              return true;
            }}
            onCancel={() => dispatch({ type: "clarificationCanceled" })}
          />
      );
    }
  }

  return renderCanvas(
      <main className={`content-shell ${styles.developmentBoundary}`}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <p>This step will be added in its approved implementation task.</p>
      </main>
  );
};

type AppExperienceProps = Readonly<{
  createLifecycle?: typeof createImageLifecycle;
  analyze?: ClientAnalysis;
  createRequestId?: () => string;
}>;

export const AppExperience = ({
  createLifecycle = createImageLifecycle,
  analyze = requestAnalysis,
  createRequestId,
}: AppExperienceProps = {}) => {
  const { state, dispatch, saveProfile, clearStoredProfile } =
    useApplicationState();
  const lifecycleRef = useRef<ImageLifecycle | null>(null);
  const [imageFlow, setImageFlow] = useState<ImageFlowController | null>(null);

  useEffect(() => {
    const lifecycle = createLifecycle({
      onSelected: (imageId) => {
        setImageFlow((current) =>
          current?.lifecycle === lifecycle
            ? { lifecycle, preparedImage: null }
            : current,
        );
        dispatch({ type: "imageSelected", imageId });
      },
      onPrepared: (imageId, image) => {
        setImageFlow((current) =>
          current?.lifecycle === lifecycle
            ? { lifecycle, preparedImage: image }
            : current,
        );
        dispatch({ type: "imagePrepared", imageId });
      },
      onFailed: (imageId, error) => {
        setImageFlow((current) =>
          current?.lifecycle === lifecycle
            ? { lifecycle, preparedImage: null }
            : current,
        );
        dispatch({ type: "imagePreparationFailed", imageId, error });
      },
      onCanceled: (imageId) => {
        dispatch({ type: "imagePreparationCanceled", imageId });
      },
      onRemoved: (imageId) => {
        setImageFlow((current) =>
          current?.lifecycle === lifecycle
            ? { lifecycle, preparedImage: null }
            : current,
        );
        dispatch({ type: "imageRemoved", imageId });
      },
    });

    lifecycleRef.current = lifecycle;
    queueMicrotask(() => {
      if (lifecycleRef.current === lifecycle) {
        setImageFlow({ lifecycle, preparedImage: null });
      }
    });

    return () => {
      lifecycle.dispose();
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
    };
  }, [createLifecycle, dispatch]);

  const clearAll = () => {
    try {
      lifecycleRef.current?.clear();
    } finally {
      setImageFlow((current) =>
        current
          ? { lifecycle: current.lifecycle, preparedImage: null }
          : current,
      );
      dispatch({ type: "clearAll" });
      queueMicrotask(() => {
        let status: "success" | "failure" = "failure";
        try {
          status =
            clearStoredProfile().status === "success"
              ? "success"
              : "failure";
        } catch {
          status = "failure";
        }
        dispatch({ type: "profileStorageClearCompleted", status });
      });
    }
  };

  return imageFlow ? (
    <ApplicationView
      state={state}
      dispatch={dispatch}
      saveProfile={saveProfile}
      imageFlow={imageFlow}
      analyze={analyze}
      createRequestId={createRequestId}
      onClearAll={clearAll}
    />
  ) : null;
};
