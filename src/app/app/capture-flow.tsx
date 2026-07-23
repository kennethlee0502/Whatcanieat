"use client";

import { useEffect, useRef, type ChangeEvent } from "react";

import styles from "@/app/app/capture-flow.module.css";
import type { ApplicationEvent, ApplicationState } from "@/application/state";
import type {
  ImageLifecycle,
  PreparedImage,
} from "@/lib/image-lifecycle";

const ACCEPTED_IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

type ImageFlowState = Extract<
  ApplicationState,
  { kind: "capture" | "preparingImage" | "preview" | "error" }
>;

type CaptureFlowProps = Readonly<{
  state: ImageFlowState;
  imageLifecycle: ImageLifecycle;
  preparedImage: PreparedImage | null;
  dispatch: React.Dispatch<ApplicationEvent>;
  onEditProfile?: () => void;
  onConfirmPreparedImage?: (image: PreparedImage) => void;
  onRetryAnalysis?: () => void;
}>;

const imageErrorContent = {
  unsupportedImage: {
    title: "Choose a different image",
    message:
      "This image format is not supported by your browser. Try a JPEG, PNG, or WebP image.",
  },
  imageTooLarge: {
    title: "This image is too large",
    message: "Choose a smaller image and try again.",
  },
  invalidImage: {
    title: "We couldn’t read this image",
    message: "Choose a different image and try again.",
  },
} as const;

const ImageInput = ({
  label,
  camera,
  onSelect,
  secondary = false,
}: Readonly<{
  label: string;
  camera?: boolean;
  onSelect: (file: File) => void;
  secondary?: boolean;
}>) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (file) {
      onSelect(file);
    }

    input.value = "";
  };

  return (
    <label
      className={
        secondary ? styles.secondaryFileAction : styles.primaryFileAction
      }
    >
      <span>{label}</span>
      <input
        className={styles.fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        capture={camera ? "environment" : undefined}
        onChange={handleChange}
      />
    </label>
  );
};

export const CaptureFlow = ({
  state,
  imageLifecycle,
  preparedImage,
  dispatch,
  onEditProfile,
  onConfirmPreparedImage,
  onRetryAnalysis,
}: CaptureFlowProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedImageId =
    state.kind === "preparingImage" || state.kind === "preview"
      ? state.image.id
      : null;
  const focusedErrorCode = state.kind === "error" ? state.error.code : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.kind, focusedImageId, focusedErrorCode]);

  const selectImage = (file: File) => {
    imageLifecycle.select(file);
  };

  if (state.kind === "error") {
    const isAnalysisFailure = state.recovery.kind === "preview";

    if (isAnalysisFailure) {
      return (
        <main className={`content-shell ${styles.flow}`}>
          <p className={styles.brand}>Can / I Eat This?</p>
          <section
            className={styles.error}
            role="alert"
            aria-labelledby="analysis-error-title"
          >
            <h1
              ref={headingRef}
              id="analysis-error-title"
              className={styles.title}
              tabIndex={-1}
            >
              We couldn’t finish the analysis
            </h1>
            <p className={styles.supportingText}>
              Your photo is still here. Try again, or return to review it.
            </p>
            <div className={styles.actions}>
              {state.error.retryable && onRetryAnalysis ? (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={onRetryAnalysis}
                >
                  Try again
                </button>
              ) : null}
              <button
                className={styles.textButton}
                type="button"
                onClick={() => dispatch({ type: "errorDismissed" })}
              >
                Back to photo
              </button>
            </div>
          </section>
        </main>
      );
    }

    const content =
      state.error.code in imageErrorContent
        ? imageErrorContent[
            state.error.code as keyof typeof imageErrorContent
          ]
        : {
            title: "We couldn’t prepare this image",
            message: "Choose a different image and try again.",
          };

    return (
      <main className={`content-shell ${styles.flow}`}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <section className={styles.error} role="alert" aria-labelledby="image-error-title">
          <h1
            ref={headingRef}
            id="image-error-title"
            className={styles.title}
            tabIndex={-1}
          >
            {content.title}
          </h1>
          <p className={styles.supportingText}>{content.message}</p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => dispatch({ type: "errorDismissed" })}
          >
            Choose another image
          </button>
        </section>
      </main>
    );
  }

  if (state.kind === "preparingImage") {
    return (
      <main className={`content-shell ${styles.flow}`}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <section className={styles.centeredState}>
          <h1 ref={headingRef} className={styles.title} tabIndex={-1}>
            Preparing your image
          </h1>
          <p
            className={styles.supportingText}
            role="status"
            aria-live="polite"
          >
            Making it ready for review.
          </p>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => imageLifecycle.cancel()}
          >
            Cancel
          </button>
        </section>
      </main>
    );
  }

  if (state.kind === "preview") {
    return (
      <main className={`content-shell ${styles.flow}`}>
        <p className={styles.brand}>Can / I Eat This?</p>
        <section className={styles.preview}>
          <div>
            <h1 ref={headingRef} className={styles.title} tabIndex={-1}>
              Review your photo
            </h1>
            <p className={styles.supportingText}>
              Make sure the food or label is clear enough to inspect.
            </p>
          </div>

          {preparedImage ? (
            <div className={styles.previewFrame}>
              {/* The user-selected image is intentionally described without classifying its contents. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.previewImage}
                src={preparedImage.objectUrl}
                alt="Selected image ready for review"
              />
            </div>
          ) : (
            <p className={styles.supportingText} role="status" aria-live="polite">
              Preparing the preview.
            </p>
          )}

          <div className={styles.actions}>
            {preparedImage && onConfirmPreparedImage ? (
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => onConfirmPreparedImage(preparedImage)}
              >
                Use this photo
              </button>
            ) : null}

            <ImageInput
              label="Take another photo"
              camera
              onSelect={selectImage}
              secondary
            />
            <ImageInput
              label="Choose another photo"
              onSelect={selectImage}
              secondary
            />
            <button
              className={styles.textButton}
              type="button"
              onClick={() => imageLifecycle.remove()}
            >
              Remove photo
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`content-shell ${styles.flow}`}>
      <p className={styles.brand}>Can / I Eat This?</p>
      <section className={styles.capture}>
        <div>
          <h1 ref={headingRef} className={styles.title} tabIndex={-1}>
            Add a photo of the food
          </h1>
          <p className={styles.supportingText}>
            Include the food, packaging, or label details you want checked.
          </p>
        </div>

        <div className={styles.actions}>
          <ImageInput label="Take a photo" camera onSelect={selectImage} />
          <ImageInput
            label="Choose a photo"
            onSelect={selectImage}
            secondary
          />
        </div>

        {onEditProfile ? (
          <button
            className={styles.textButton}
            type="button"
            onClick={onEditProfile}
          >
            Edit profile
          </button>
        ) : null}
      </section>
    </main>
  );
};
