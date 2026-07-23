"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import styles from "@/app/app/clarification-flow.module.css";
import type { ClarificationQuestion } from "@/domain/evaluation";

type ClarificationFlowProps = Readonly<{
  question: ClarificationQuestion;
  onSubmit: (answerOptionId: string) => boolean;
  onCancel: () => void;
}>;

export const ClarificationFlow = ({
  question,
  onSubmit,
  onCancel,
}: ClarificationFlowProps) => {
  const prefersReducedMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [answerOptionId, setAnswerOptionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answerOptionId) {
      setError("Choose one answer before updating the recommendation.");
      return;
    }
    if (!onSubmit(answerOptionId)) {
      setError("We couldn’t apply that answer. Your result has not changed.");
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main className={`content-shell ${styles.flow}`}>
      <p className={styles.brand}>Can / I Eat This?</p>
      <motion.section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarification-title"
        aria-describedby="clarification-description"
        onKeyDown={handleDialogKeyDown}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.26,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <p className={styles.eyebrow}>One useful detail</p>
        <h1
          ref={headingRef}
          id="clarification-title"
          className={styles.title}
          tabIndex={-1}
        >
          {question.prompt}
        </h1>
        <p id="clarification-description" className={styles.description}>
          {question.whyItMatters}
        </p>

        <form onSubmit={submit} noValidate>
          <fieldset
            className={styles.options}
            aria-describedby={error ? "clarification-error" : undefined}
          >
            <legend className={styles.legend}>Choose one answer</legend>
            {question.answerOptions.map((option) => (
              <label className={styles.option} key={option.id}>
                <input
                  type="radio"
                  name="clarification-answer"
                  value={option.id}
                  checked={answerOptionId === option.id}
                  onChange={() => {
                    setAnswerOptionId(option.id);
                    setError(null);
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          {error ? (
            <p id="clarification-error" className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit">
              Update recommendation
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.section>
    </main>
  );
};
