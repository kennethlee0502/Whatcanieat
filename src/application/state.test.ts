import { describe, expect, it } from "vitest";

import {
  applicationReducer,
  initialApplicationState,
  type ApplicationState,
} from "@/application/state";
import type { EvaluationResult } from "@/domain/evaluation";
import type { ExtractedFoodFacts } from "@/domain/food";
import type { UserProfile } from "@/domain/profile";

const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
};
const facts = {} as ExtractedFoodFacts;
const evaluation = {} as EvaluationResult;
const retryableError = { code: "networkInterrupted", retryable: true } as const;

const analyzingState: ApplicationState = {
  kind: "analyzing",
  profile,
  image: { id: "image-1" },
  requestId: "request-1",
};

describe("applicationReducer", () => {
  it("restores an existing profile into capture", () => {
    expect(
      applicationReducer(initialApplicationState, {
        type: "profileRestored",
        profile,
      }),
    ).toEqual({ kind: "capture", profile });
  });

  it("moves a new user from welcome through profile and capture", () => {
    const welcome = applicationReducer(initialApplicationState, {
      type: "profileRestored",
      profile: null,
    });
    const profileState = applicationReducer(welcome, { type: "profileStarted" });
    const capture = applicationReducer(profileState, {
      type: "profileSaved",
      profile,
    });

    expect(capture).toEqual({ kind: "capture", profile });
  });

  it("ignores stale image preparation results", () => {
    const state: ApplicationState = {
      kind: "preparingImage",
      profile,
      image: { id: "current-image" },
    };

    expect(
      applicationReducer(state, {
        type: "imagePrepared",
        imageId: "stale-image",
      }),
    ).toBe(state);
  });

  it("ignores stale analysis responses", () => {
    expect(
      applicationReducer(analyzingState, {
        type: "analysisSucceeded",
        requestId: "stale-request",
        facts,
        evaluation,
      }),
    ).toBe(analyzingState);
  });

  it("moves the active analysis response into result", () => {
    expect(
      applicationReducer(analyzingState, {
        type: "analysisSucceeded",
        requestId: "request-1",
        facts,
        evaluation,
      }),
    ).toMatchObject({ kind: "result", facts, evaluation });
  });

  it("cancels only the active analysis", () => {
    expect(
      applicationReducer(analyzingState, {
        type: "analysisCanceled",
        requestId: "request-1",
      }),
    ).toEqual({ kind: "preview", profile, image: { id: "image-1" } });
  });

  it("preserves preview recovery for retryable analysis errors", () => {
    const failed = applicationReducer(analyzingState, {
      type: "analysisFailed",
      requestId: "request-1",
      error: retryableError,
    });

    expect(applicationReducer(failed, { type: "retryRequested" })).toEqual({
      kind: "preview",
      profile,
      image: { id: "image-1" },
    });
  });

  it("does not retry non-retryable errors", () => {
    const errorState: ApplicationState = {
      kind: "error",
      error: { code: "invalidImage", retryable: false },
      recovery: { kind: "capture", profile },
    };

    expect(
      applicationReducer(errorState, { type: "retryRequested" }),
    ).toBe(errorState);
    expect(applicationReducer(errorState, { type: "errorDismissed" })).toEqual({
      kind: "capture",
      profile,
    });
  });

  it("clears every state back to welcome", () => {
    for (const state of [initialApplicationState, analyzingState]) {
      expect(applicationReducer(state, { type: "clearAll" })).toEqual({
        kind: "welcome",
      });
    }
  });
});
