"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import styles from "@/app/app/analysis-flow.module.css";
import type { AnalysisError } from "@/domain/analysis";
import type { AnalysisResponse } from "@/domain/analysis";
import type { UserProfile } from "@/domain/profile";
import type { ClientAnalysis } from "@/lib/client-analysis";
import type { PreparedImage } from "@/lib/image-lifecycle";

const ANALYSIS_MESSAGES = [
  "Looking closely at the food",
  "Identifying relevant ingredients",
  "Checking preparation details",
  "Applying your dietary profile",
  "Preparing the recommendation",
] as const;

const MESSAGE_DELAYS_MS = [1_600, 3_200, 4_800, 6_400] as const;
const SLOW_RESPONSE_DELAY_MS = 8_000;

type AnalysisFlowProps = Readonly<{
  requestId: string;
  preparedImage: PreparedImage;
  profile: UserProfile;
  analyze: ClientAnalysis;
  onSuccess: (requestId: string, response: AnalysisResponse) => void;
  onFailure: (requestId: string, error: AnalysisError) => void;
  onCancel: (requestId: string) => void;
}>;

const isAnalysisError = (error: unknown): error is AnalysisError =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  "retryable" in error;

export const AnalysisFlow = ({
  requestId,
  preparedImage,
  profile,
  analyze,
  onSuccess,
  onFailure,
  onCancel,
}: AnalysisFlowProps) => {
  const prefersReducedMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [requestId]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const messageTimers = MESSAGE_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => setMessageIndex(index + 1), delay),
    );
    const slowTimer = window.setTimeout(
      () => setIsSlow(true),
      SLOW_RESPONSE_DELAY_MS,
    );

    return () => {
      messageTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(slowTimer);
    };
  }, [prefersReducedMotion, requestId]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    void analyze(preparedImage, profile, controller.signal)
      .then(
        (analysisResponse) => {
          if (!controller.signal.aborted) {
            onSuccess(requestId, analysisResponse);
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            onFailure(
              requestId,
              isAnalysisError(error)
                ? error
                : { code: "evaluationFailed", retryable: true },
            );
          }
        },
      )
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      });

    return () => {
      controller.abort();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [
    analyze,
    onFailure,
    onSuccess,
    preparedImage,
    profile,
    requestId,
  ]);

  const cancel = () => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    onCancel(requestId);
  };

  const currentMessage = isSlow
    ? "This is taking a little longer."
    : ANALYSIS_MESSAGES[messageIndex];

  return (
    <main className={`content-shell ${styles.flow}`}>
      <p className={styles.brand}>Can / I Eat This?</p>
      <section className={styles.analysis} aria-labelledby="analysis-title">
        <div className={styles.previewFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.previewImage}
            src={preparedImage.objectUrl}
            alt="Selected image being analyzed"
          />
        </div>

        <div className={styles.copy}>
          <h1
            ref={headingRef}
            id="analysis-title"
            className={styles.title}
            tabIndex={-1}
          >
            Looking closely
          </h1>
          <div className={styles.statusFrame}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={currentMessage}
                className={styles.status}
                role="status"
                aria-live="polite"
                initial={
                  prefersReducedMotion ? false : { opacity: 0, y: 4 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.16,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {currentMessage}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className={styles.supportingText}>
            We’ll keep important uncertainty visible.
            {isSlow ? " You can cancel and return to your photo." : ""}
          </p>
        </div>

        <button className={styles.secondaryButton} type="button" onClick={cancel}>
          Cancel analysis
        </button>
      </section>
    </main>
  );
};
