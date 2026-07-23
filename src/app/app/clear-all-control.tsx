"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import styles from "@/app/app/clear-all-control.module.css";

type ClearAllControlProps = Readonly<{
  onConfirm: () => void;
}>;

export const ClearAllControl = ({ onConfirm }: ClearAllControlProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
      "button:not([disabled])",
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
    <>
      <button
        ref={triggerRef}
        className={styles.trigger}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Clear all
      </button>

      {isOpen ? (
        <div className={styles.backdrop}>
          <motion.div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-all-title"
            aria-describedby="clear-all-description"
            onKeyDown={handleKeyDown}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.26,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <p className={styles.eyebrow}>Privacy control</p>
            <h2 id="clear-all-title" className={styles.title}>
              Clear temporary data?
            </h2>
            <p id="clear-all-description" className={styles.description}>
              This removes your temporary profile, selected image, and current
              result from this session.
            </p>
            <div className={styles.actions}>
              <button
                ref={cancelRef}
                className={styles.cancelButton}
                type="button"
                onClick={close}
              >
                Cancel
              </button>
              <button
                className={styles.clearButton}
                type="button"
                onClick={onConfirm}
              >
                Clear all
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
};
