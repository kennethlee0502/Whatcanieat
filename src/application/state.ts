import type { AnalysisError } from "@/domain/analysis";
import type { EvaluationResult } from "@/domain/evaluation";
import type { ExtractedFoodFacts } from "@/domain/food";
import type { UserProfile } from "@/domain/profile";

type ImageReference = Readonly<{ id: string }>;

type CaptureRecovery = Readonly<{
  kind: "capture";
  profile: UserProfile;
}>;

type PreviewRecovery = Readonly<{
  kind: "preview";
  profile: UserProfile;
  image: ImageReference;
}>;

type ErrorRecovery = CaptureRecovery | PreviewRecovery;

export type ApplicationState =
  | Readonly<{ kind: "restoring" }>
  | Readonly<{ kind: "welcome" }>
  | Readonly<{ kind: "profile"; profile?: UserProfile }>
  | Readonly<{ kind: "capture"; profile: UserProfile }>
  | Readonly<{
      kind: "preparingImage";
      profile: UserProfile;
      image: ImageReference;
    }>
  | Readonly<{
      kind: "preview";
      profile: UserProfile;
      image: ImageReference;
    }>
  | Readonly<{
      kind: "analyzing";
      profile: UserProfile;
      image: ImageReference;
      requestId: string;
    }>
  | Readonly<{
      kind: "result";
      profile: UserProfile;
      image: ImageReference;
      facts: ExtractedFoodFacts;
      evaluation: EvaluationResult;
    }>
  | Readonly<{
      kind: "clarification";
      profile: UserProfile;
      image: ImageReference;
      facts: ExtractedFoodFacts;
      evaluation: EvaluationResult;
      questionId: string;
    }>
  | Readonly<{
      kind: "error";
      error: AnalysisError;
      recovery: ErrorRecovery;
    }>;

export type ApplicationEvent =
  | Readonly<{ type: "profileRestored"; profile: UserProfile | null }>
  | Readonly<{ type: "profileRestorationFailed" }>
  | Readonly<{ type: "profileStarted" }>
  | Readonly<{ type: "profileSaved"; profile: UserProfile }>
  | Readonly<{ type: "profileEditRequested" }>
  | Readonly<{ type: "imageSelected"; imageId: string }>
  | Readonly<{ type: "imagePrepared"; imageId: string }>
  | Readonly<{ type: "imagePreparationFailed"; imageId: string; error: AnalysisError }>
  | Readonly<{ type: "analysisStarted"; requestId: string }>
  | Readonly<{
      type: "analysisSucceeded";
      requestId: string;
      facts: ExtractedFoodFacts;
      evaluation: EvaluationResult;
    }>
  | Readonly<{
      type: "analysisFailed";
      requestId: string;
      error: AnalysisError;
    }>
  | Readonly<{ type: "analysisCanceled"; requestId: string }>
  | Readonly<{ type: "clarificationRequested"; questionId: string }>
  | Readonly<{
      type: "clarificationCompleted";
      facts: ExtractedFoodFacts;
      evaluation: EvaluationResult;
    }>
  | Readonly<{ type: "newScanRequested" }>
  | Readonly<{ type: "retryRequested" }>
  | Readonly<{ type: "errorDismissed" }>
  | Readonly<{ type: "clearAll" }>;

export const initialApplicationState: ApplicationState = { kind: "restoring" };

export const applicationReducer = (
  state: ApplicationState,
  event: ApplicationEvent,
): ApplicationState => {
  if (event.type === "clearAll") {
    return { kind: "welcome" };
  }

  switch (state.kind) {
    case "restoring":
      if (event.type === "profileRestored") {
        return event.profile
          ? { kind: "capture", profile: event.profile }
          : { kind: "welcome" };
      }
      if (event.type === "profileRestorationFailed") {
        return { kind: "welcome" };
      }
      return state;

    case "welcome":
      return event.type === "profileStarted" ? { kind: "profile" } : state;

    case "profile":
      return event.type === "profileSaved"
        ? { kind: "capture", profile: event.profile }
        : state;

    case "capture":
      if (event.type === "profileEditRequested") {
        return { kind: "profile", profile: state.profile };
      }
      if (event.type === "imageSelected") {
        return {
          kind: "preparingImage",
          profile: state.profile,
          image: { id: event.imageId },
        };
      }
      return state;

    case "preparingImage":
      if (event.type === "imagePrepared" && event.imageId === state.image.id) {
        return { kind: "preview", profile: state.profile, image: state.image };
      }
      if (
        event.type === "imagePreparationFailed" &&
        event.imageId === state.image.id
      ) {
        return {
          kind: "error",
          error: event.error,
          recovery: { kind: "capture", profile: state.profile },
        };
      }
      return state;

    case "preview":
      if (event.type === "analysisStarted") {
        return { ...state, kind: "analyzing", requestId: event.requestId };
      }
      if (event.type === "imageSelected") {
        return {
          kind: "preparingImage",
          profile: state.profile,
          image: { id: event.imageId },
        };
      }
      if (event.type === "profileEditRequested") {
        return { kind: "profile", profile: state.profile };
      }
      return state;

    case "analyzing":
      if (
        event.type !== "analysisSucceeded" &&
        event.type !== "analysisFailed" &&
        event.type !== "analysisCanceled"
      ) {
        return state;
      }
      if (event.requestId !== state.requestId) {
        return state;
      }
      if (event.type === "analysisSucceeded") {
        return {
          kind: "result",
          profile: state.profile,
          image: state.image,
          facts: event.facts,
          evaluation: event.evaluation,
        };
      }
      if (event.type === "analysisFailed") {
        return {
          kind: "error",
          error: event.error,
          recovery: {
            kind: "preview",
            profile: state.profile,
            image: state.image,
          },
        };
      }
      if (event.type === "analysisCanceled") {
        return { kind: "preview", profile: state.profile, image: state.image };
      }
      return state;

    case "result":
      if (event.type === "clarificationRequested") {
        return { ...state, kind: "clarification", questionId: event.questionId };
      }
      if (event.type === "newScanRequested") {
        return { kind: "capture", profile: state.profile };
      }
      if (event.type === "profileEditRequested") {
        return { kind: "profile", profile: state.profile };
      }
      return state;

    case "clarification":
      if (event.type === "clarificationCompleted") {
        return {
          kind: "result",
          profile: state.profile,
          image: state.image,
          facts: event.facts,
          evaluation: event.evaluation,
        };
      }
      return state;

    case "error":
      if (event.type === "retryRequested" && state.error.retryable) {
        return state.recovery;
      }
      if (event.type === "errorDismissed") {
        return state.recovery;
      }
      return state;
  }
};
