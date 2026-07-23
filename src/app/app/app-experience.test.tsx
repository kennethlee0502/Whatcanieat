import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppExperience,
  ApplicationView,
} from "@/app/app/app-experience";
import type { ApplicationEvent, ApplicationState } from "@/application/state";
import type { UserProfile } from "@/domain/profile";
import type {
  ImageLifecycle,
  PreparedImage,
} from "@/lib/image-lifecycle";
import { syntheticAnalysisResponses } from "@/lib/mock-analysis";

const application = vi.hoisted(() => ({
  state: { kind: "capture" } as ApplicationState,
  dispatch: vi.fn<(event: ApplicationEvent) => void>(),
  saveProfile: vi.fn(),
  clearStoredProfile: vi.fn().mockReturnValue({ status: "success" }),
}));

vi.mock("@/application/use-application-state", () => ({
  useApplicationState: () => application,
}));

const saveProfile = vi.fn();
const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
};

const preparedImage: PreparedImage = {
  blob: new Blob(["prepared"], { type: "image/jpeg" }),
  objectUrl: "blob:prepared",
  width: 1200,
  height: 900,
  mimeType: "image/jpeg",
  sizeBytes: 8,
};

const lifecycle: ImageLifecycle = {
  select: vi.fn().mockReturnValue({
    imageId: "image-1",
    completion: Promise.resolve(),
  }),
  cancel: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
  getPreparedImage: vi.fn().mockReturnValue(preparedImage),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  application.dispatch.mockReset();
  application.clearStoredProfile
    .mockReset()
    .mockReturnValue({ status: "success" });
  vi.unstubAllGlobals();
});

describe("ApplicationView", () => {
  it("announces profile restoration without a spinner", () => {
    const { container } = render(
      <ApplicationView
        state={{ kind: "restoring" }}
        dispatch={vi.fn()}
        saveProfile={saveProfile}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your temporary profile.",
    );
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("presents the factual welcome narrative and minimization disclosure", () => {
    render(
      <ApplicationView
        state={{ kind: "welcome" }}
        dispatch={vi.fn()}
        saveProfile={saveProfile}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "See what we can confirm—and what still needs checking.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your complete profile stays on this device/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only the food image and the profile information needed/),
    ).toBeInTheDocument();
  });

  it("dispatches profileStarted from the keyboard-accessible primary action", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(
      <ApplicationView
        state={{ kind: "welcome" }}
        dispatch={dispatch}
        saveProfile={saveProfile}
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Create my profile" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "profileStarted" });
  });

  it("exposes only the temporary profile-edit entry from capture", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(
      <ApplicationView
        state={{ kind: "capture", profile }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage: null }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Add a photo of the food" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "profileEditRequested" });
  });

  it("starts analysis from preview with a fresh request identity", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(
      <ApplicationView
        state={{ kind: "preview", profile, image: { id: "image-1" } }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
        createRequestId={() => "request-new"}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Use this photo" }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "analysisStarted",
      requestId: "request-new",
    });
  });

  it("queues existing recovery before retrying with a fresh request identity", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(
      <ApplicationView
        state={{
          kind: "error",
          error: { code: "providerUnavailable", retryable: true },
          recovery: {
            kind: "preview",
            profile,
            image: { id: "image-1" },
          },
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
        createRequestId={() => "request-retry"}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "errorDismissed" });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "analysisStarted",
      requestId: "request-retry",
    });
  });

  it("connects analyzing success directly to the existing result transition", async () => {
    const dispatch = vi.fn();
    const analyze = vi.fn().mockResolvedValue(syntheticAnalysisResponses.safe);
    render(
      <ApplicationView
        state={{
          kind: "analyzing",
          profile,
          image: { id: "image-1" },
          requestId: "request-1",
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
        analyze={analyze}
      />,
    );

    await vi.waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "analysisSucceeded",
        requestId: "request-1",
        facts: syntheticAnalysisResponses.safe.facts,
        evaluation: syntheticAnalysisResponses.safe.evaluation,
      }),
    );
  });

  it("renders the accepted result and dispatches the existing new-scan transition", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const response = syntheticAnalysisResponses.safe;
    render(
      <ApplicationView
        state={{
          kind: "result",
          profile,
          image: { id: "image-1" },
          facts: response.facts,
          evaluation: response.evaluation,
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "What we saw" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Check another food" }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "newScanRequested" });
  });

  it("opens only the engine-selected clarification question", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const response = syntheticAnalysisResponses.needMoreInformation;
    const question = response.evaluation.clarificationQuestions[0];
    render(
      <ApplicationView
        state={{
          kind: "result",
          profile: {
            ...profile,
            allergies: [{ allergenId: "peanut", label: "Peanut" }],
          },
          image: { id: "image-1" },
          facts: response.facts,
          evaluation: response.evaluation,
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Answer one question" }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "clarificationRequested",
      questionId: question.id,
    });
  });

  it("completes clarification locally without making a request", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);
    const response = syntheticAnalysisResponses.needMoreInformation;
    const question = response.evaluation.clarificationQuestions[0];
    const option = question.answerOptions.find(
      ({ id }) => id === "confirmed-present",
    )!;
    render(
      <ApplicationView
        state={{
          kind: "clarification",
          profile: {
            ...profile,
            allergies: [{ allergenId: "peanut", label: "Peanut" }],
          },
          image: { id: "image-1" },
          facts: response.facts,
          evaluation: response.evaluation,
          questionId: question.id,
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
      />,
    );

    await user.click(screen.getByRole("radio", { name: option.label }));
    await user.click(
      screen.getByRole("button", { name: "Update recommendation" }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "clarificationCompleted",
        evaluation: expect.objectContaining({ verdict: "avoid" }),
      }),
    );
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("cancels clarification through the existing application flow", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const response = syntheticAnalysisResponses.needMoreInformation;
    const question = response.evaluation.clarificationQuestions[0];
    render(
      <ApplicationView
        state={{
          kind: "clarification",
          profile,
          image: { id: "image-1" },
          facts: response.facts,
          evaluation: response.evaluation,
          questionId: question.id,
        }}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "clarificationCanceled" });
  });

  it("offers confirmed Clear All from every non-empty reachable state", async () => {
    const user = userEvent.setup();
    const response = syntheticAnalysisResponses.needMoreInformation;
    const questionId = response.evaluation.clarificationQuestions[0].id;
    const states: ApplicationState[] = [
      { kind: "restoring" },
      { kind: "profile", profile },
      { kind: "capture", profile },
      {
        kind: "preparingImage",
        profile,
        image: { id: "image-1" },
      },
      { kind: "preview", profile, image: { id: "image-1" } },
      {
        kind: "analyzing",
        profile,
        image: { id: "image-1" },
        requestId: "request-clear",
      },
      {
        kind: "error",
        error: { code: "providerUnavailable", retryable: true },
        recovery: {
          kind: "preview",
          profile,
          image: { id: "image-1" },
        },
      },
      {
        kind: "result",
        profile,
        image: { id: "image-1" },
        facts: response.facts,
        evaluation: response.evaluation,
      },
      {
        kind: "clarification",
        profile,
        image: { id: "image-1" },
        facts: response.facts,
        evaluation: response.evaluation,
        questionId,
      },
      {
        kind: "result",
        profile,
        image: { id: "image-1" },
        facts: response.facts,
        evaluation: response.evaluation,
        presentation: "clarificationRevision",
      },
    ];

    for (const state of states) {
      const onClearAll = vi.fn();
      render(
        <ApplicationView
          state={state}
          dispatch={vi.fn()}
          saveProfile={saveProfile}
          imageFlow={{ lifecycle, preparedImage }}
          analyze={() => new Promise(() => undefined)}
          onClearAll={onClearAll}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Clear all" }));
      const dialog = screen.getByRole("dialog", {
        name: "Clear temporary data?",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Clear all" }),
      );
      expect(onClearAll).toHaveBeenCalledOnce();
      cleanup();
    }
  });

  it("omits Clear All from an empty welcome and announces clear outcomes", () => {
    const { rerender } = render(
      <ApplicationView
        state={{ kind: "welcome", clearPresentation: "cleared" }}
        dispatch={vi.fn()}
        saveProfile={saveProfile}
        onClearAll={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Temporary data cleared.",
    );
    expect(
      screen.getByRole("heading", {
        name: "See what we can confirm—and what still needs checking.",
      }),
    ).toHaveFocus();

    rerender(
      <ApplicationView
        state={{
          kind: "welcome",
          clearPresentation: "storedProfileClearFailed",
        }}
        dispatch={vi.fn()}
        saveProfile={saveProfile}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "the saved profile could not be removed",
    );
    expect(screen.getByRole("button", { name: "Clear all" })).toBeVisible();
  });

  it("aborts active analysis on reset and ignores its late completion", async () => {
    let signal: AbortSignal | undefined;
    let resolveAnalysis:
      | ((value: typeof syntheticAnalysisResponses.safe) => void)
      | undefined;
    const analyze = vi.fn(
      (_image, _profile, activeSignal: AbortSignal) =>
        new Promise<typeof syntheticAnalysisResponses.safe>((resolve) => {
          signal = activeSignal;
          resolveAnalysis = resolve;
        }),
    );
    const dispatch = vi.fn();
    const analyzingState: ApplicationState = {
      kind: "analyzing",
      profile,
      image: { id: "image-1" },
      requestId: "request-clear",
    };
    const view = (
      state: ApplicationState,
      onClearAll?: () => void,
    ) => (
      <ApplicationView
        state={state}
        dispatch={dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
        analyze={analyze}
        onClearAll={onClearAll}
      />
    );
    const clear = () => {
      dispatch({ type: "clearAll" });
      rendered.rerender(
        view({
          kind: "welcome",
          clearPresentation: "clearingStoredProfile",
        }),
      );
    };
    const rendered = render(view(analyzingState, clear));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      }),
    );

    expect(signal?.aborted).toBe(true);
    resolveAnalysis?.(syntheticAnalysisResponses.safe);
    await Promise.resolve();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "analysisSucceeded" }),
    );
  });

  it("cleans memory before attempting storage and reports storage failure", async () => {
    application.state = { kind: "capture", profile };
    const order: string[] = [];
    const ownedLifecycle: ImageLifecycle = {
      ...lifecycle,
      clear: vi.fn(() => order.push("lifecycle")),
    };
    application.dispatch.mockImplementation((event) => {
      order.push(event.type);
    });
    application.clearStoredProfile.mockImplementation(() => {
      order.push("storage");
      throw new DOMException("blocked");
    });
    render(
      <AppExperience
        createLifecycle={vi.fn().mockReturnValue(ownedLifecycle)}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Clear all" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      }),
    );

    expect(order).toEqual(["lifecycle", "clearAll"]);
    await vi.waitFor(() =>
      expect(order).toEqual([
        "lifecycle",
        "clearAll",
        "storage",
        "profileStorageClearCompleted",
      ]),
    );
    expect(application.dispatch).toHaveBeenLastCalledWith({
      type: "profileStorageClearCompleted",
      status: "failure",
    });
  });

  it("confirmation cancellation preserves the request, storage, and image", async () => {
    application.state = {
      kind: "analyzing",
      profile,
      image: { id: "image-1" },
      requestId: "request-preserved",
    };
    let signal: AbortSignal | undefined;
    const analyze = vi.fn(
      (_image, _profile, activeSignal: AbortSignal) => {
        signal = activeSignal;
        return new Promise<typeof syntheticAnalysisResponses.safe>(
          () => undefined,
        );
      },
    );
    const onClearAll = vi.fn();
    render(
      <ApplicationView
        state={application.state}
        dispatch={application.dispatch}
        saveProfile={saveProfile}
        imageFlow={{ lifecycle, preparedImage }}
        analyze={analyze}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Clear all" }),
    );
    await vi.waitFor(() => expect(signal).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(signal?.aborted).toBe(false);
    expect(onClearAll).not.toHaveBeenCalled();
    expect(application.dispatch).not.toHaveBeenCalledWith({ type: "clearAll" });
    expect(
      screen.getByRole("img", { name: "Selected image being analyzed" }),
    ).toHaveAttribute("src", preparedImage.objectUrl);
  });

  it("repeats lifecycle and reducer clearing idempotently", async () => {
    application.state = { kind: "capture", profile };

    for (let index = 0; index < 2; index += 1) {
      const rendered = render(
        <AppExperience createLifecycle={vi.fn().mockReturnValue(lifecycle)} />,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Clear all" }),
      );
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Clear all",
        }),
      );
      await Promise.resolve();
      rendered.unmount();
    }

    expect(lifecycle.clear).toHaveBeenCalledTimes(2);
    expect(application.dispatch).toHaveBeenCalledWith({ type: "clearAll" });
  });

  it("owns one lifecycle across rerenders and ignores visibility changes", () => {
    application.state = { kind: "capture", profile };
    const createLifecycle = vi.fn().mockReturnValue(lifecycle);
    const { rerender } = render(
      <AppExperience createLifecycle={createLifecycle} />,
    );

    expect(createLifecycle).toHaveBeenCalledOnce();
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibilityState.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    rerender(<AppExperience createLifecycle={createLifecycle} />);

    expect(createLifecycle).toHaveBeenCalledOnce();
    expect(lifecycle.cancel).not.toHaveBeenCalled();
    expect(lifecycle.clear).not.toHaveBeenCalled();
    expect(lifecycle.remove).not.toHaveBeenCalled();
    expect(lifecycle.dispose).not.toHaveBeenCalled();
    expect(application.state).toEqual({ kind: "capture", profile });
  });

  it("disposes the owned lifecycle on unmount", () => {
    application.state = { kind: "capture", profile };
    const createLifecycle = vi.fn().mockReturnValue(lifecycle);
    const { unmount } = render(
      <AppExperience createLifecycle={createLifecycle} />,
    );

    unmount();

    expect(lifecycle.dispose).toHaveBeenCalledOnce();
  });

  it("wires lifecycle callbacks to opaque reducer events and memory-only preview", () => {
    application.state = { kind: "capture", profile };
    let callbacks:
      | Parameters<typeof import("@/lib/image-lifecycle").createImageLifecycle>[0]
      | undefined;
    const createLifecycle = vi.fn((options) => {
      callbacks = options;
      return lifecycle;
    });
    render(<AppExperience createLifecycle={createLifecycle} />);

    callbacks?.onSelected?.("image-1");
    callbacks?.onPrepared?.("image-1", preparedImage);
    callbacks?.onFailed?.("image-2", {
      code: "invalidImage",
      retryable: false,
    });
    callbacks?.onCanceled?.("image-3");
    callbacks?.onRemoved?.("image-4");

    expect(application.dispatch).toHaveBeenNthCalledWith(1, {
      type: "imageSelected",
      imageId: "image-1",
    });
    expect(application.dispatch).toHaveBeenNthCalledWith(2, {
      type: "imagePrepared",
      imageId: "image-1",
    });
    expect(application.dispatch).toHaveBeenNthCalledWith(3, {
      type: "imagePreparationFailed",
      imageId: "image-2",
      error: { code: "invalidImage", retryable: false },
    });
    expect(application.dispatch).toHaveBeenNthCalledWith(4, {
      type: "imagePreparationCanceled",
      imageId: "image-3",
    });
    expect(application.dispatch).toHaveBeenNthCalledWith(5, {
      type: "imageRemoved",
      imageId: "image-4",
    });
    expect(application.dispatch.mock.calls.flat()).not.toContain(preparedImage);
    expect(
      application.dispatch.mock.calls.some(([event]) =>
        Object.hasOwn(event, "requestId"),
      ),
    ).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
    expect(application.dispatch.mock.calls.flat()).not.toContain(preparedImage);
  });

  it("does not recreate or revoke object URLs in the UI", () => {
    application.state = { kind: "capture", profile };
    const createObjectUrl = vi.fn();
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    const createLifecycle = vi.fn().mockReturnValue(lifecycle);

    render(<AppExperience createLifecycle={createLifecycle} />);

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it("does not make a network request", () => {
    application.state = { kind: "capture", profile };
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);
    const createLifecycle = vi.fn().mockReturnValue(lifecycle);

    render(<AppExperience createLifecycle={createLifecycle} />);

    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("wires edit cancellation back to the application reducer", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(
      <ApplicationView
        state={{ kind: "profile", profile }}
        dispatch={dispatch}
        saveProfile={saveProfile}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel editing" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "profileEditCanceled" });
  });
});
