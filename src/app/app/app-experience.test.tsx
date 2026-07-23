import { cleanup, render, screen } from "@testing-library/react";
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

const application = vi.hoisted(() => ({
  state: { kind: "capture" } as ApplicationState,
  dispatch: vi.fn<(event: ApplicationEvent) => void>(),
  saveProfile: vi.fn(),
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
    expect(
      screen.queryByRole("button", { name: "Use this photo" }),
    ).not.toBeInTheDocument();
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
