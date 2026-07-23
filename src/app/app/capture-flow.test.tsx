import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureFlow } from "@/app/app/capture-flow";
import type {
  ApplicationEvent,
  ApplicationState,
} from "@/application/state";
import type { UserProfile } from "@/domain/profile";
import type {
  ImageLifecycle,
  PreparedImage,
} from "@/lib/image-lifecycle";

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

const createLifecycle = (): ImageLifecycle => ({
  select: vi.fn().mockReturnValue({
    imageId: "image-1",
    completion: Promise.resolve(),
  }),
  cancel: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
  getPreparedImage: vi.fn().mockReturnValue(preparedImage),
});

const renderFlow = ({
  state = { kind: "capture", profile },
  lifecycle = createLifecycle(),
  image = null,
  dispatch = vi.fn(),
  onConfirmPreparedImage,
}: {
  state?: Extract<
    ApplicationState,
    { kind: "capture" | "preparingImage" | "preview" | "error" }
  >;
  lifecycle?: ImageLifecycle;
  image?: PreparedImage | null;
  dispatch?: React.Dispatch<ApplicationEvent>;
  onConfirmPreparedImage?: (prepared: PreparedImage) => void;
} = {}) => {
  const result = render(
    <CaptureFlow
      state={state}
      imageLifecycle={lifecycle}
      preparedImage={image}
      dispatch={dispatch}
      onConfirmPreparedImage={onConfirmPreparedImage}
    />,
  );

  return { ...result, lifecycle, dispatch };
};

afterEach(cleanup);

describe("CaptureFlow", () => {
  it("provides native camera and library inputs for the supported formats", () => {
    renderFlow();

    const camera = screen.getByLabelText("Take a photo");
    const library = screen.getByLabelText("Choose a photo");

    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/heic,image/heif",
    );
    expect(camera).toHaveAttribute("capture", "environment");
    expect(library).toHaveAttribute("type", "file");
    expect(library).not.toHaveAttribute("capture");
  });

  it("treats picker cancellation as a no-op", () => {
    const { lifecycle, dispatch } = renderFlow();

    fireEvent.change(screen.getByLabelText("Choose a photo"), {
      target: { files: [] },
    });

    expect(lifecycle.select).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("selects each chosen file once and resets for same-file reselection", () => {
    const { lifecycle } = renderFlow();
    const input = screen.getByLabelText("Choose a photo") as HTMLInputElement;
    const file = new File(["food"], "food.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { files: [file] } });

    expect(lifecycle.select).toHaveBeenCalledTimes(2);
    expect(lifecycle.select).toHaveBeenNthCalledWith(1, file);
    expect(lifecycle.select).toHaveBeenNthCalledWith(2, file);
  });

  it("announces preparation and delegates cancellation", async () => {
    const user = userEvent.setup();
    const lifecycle = createLifecycle();
    renderFlow({
      state: {
        kind: "preparingImage",
        profile,
        image: { id: "image-1" },
      },
      lifecycle,
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Making it ready for review.",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(lifecycle.cancel).toHaveBeenCalledOnce();
  });

  it("renders a contained preview and delegates replacement and removal", async () => {
    const user = userEvent.setup();
    const lifecycle = createLifecycle();
    renderFlow({
      state: { kind: "preview", profile, image: { id: "image-1" } },
      lifecycle,
      image: preparedImage,
    });

    expect(
      screen.getByRole("img", { name: "Selected image ready for review" }),
    ).toHaveAttribute("src", "blob:prepared");

    const replacement = new File(["new"], "new.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose another photo"), {
      target: { files: [replacement] },
    });
    await user.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(lifecycle.select).toHaveBeenCalledWith(replacement);
    expect(lifecycle.remove).toHaveBeenCalledOnce();
  });

  it("only offers confirmation when a callback is available", async () => {
    const user = userEvent.setup();
    const state = {
      kind: "preview",
      profile,
      image: { id: "image-1" },
    } as const;
    const { rerender } = renderFlow({ state, image: preparedImage });

    expect(
      screen.queryByRole("button", { name: "Use this photo" }),
    ).not.toBeInTheDocument();

    const onConfirmPreparedImage = vi.fn();
    rerender(
      <CaptureFlow
        state={state}
        imageLifecycle={createLifecycle()}
        preparedImage={preparedImage}
        dispatch={vi.fn()}
        onConfirmPreparedImage={onConfirmPreparedImage}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Use this photo" }));

    expect(onConfirmPreparedImage).toHaveBeenCalledWith(preparedImage);
  });

  it.each([
    [
      "unsupportedImage",
      "Choose a different image",
      "This image format is not supported by your browser.",
    ],
    [
      "imageTooLarge",
      "This image is too large",
      "Choose a smaller image and try again.",
    ],
    [
      "invalidImage",
      "We couldn’t read this image",
      "Choose a different image and try again.",
    ],
  ] as const)(
    "presents a safe %s error and delegates reducer-defined recovery",
    async (code, title, message) => {
      const user = userEvent.setup();
      const dispatch = vi.fn();
      renderFlow({
        state: {
          kind: "error",
          error: { code, retryable: false },
          recovery: {
            kind: "preview",
            profile,
            image: { id: "image-1" },
          },
        },
        dispatch,
      });

      expect(screen.getByRole("alert")).toHaveTextContent(title);
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      await user.click(
        screen.getByRole("button", { name: "Choose another image" }),
      );

      expect(dispatch).toHaveBeenCalledWith({ type: "errorDismissed" });
    },
  );

  it("uses a safe generic message for non-retryable preparation failures", () => {
    renderFlow({
      state: {
        kind: "error",
        error: { code: "evaluationFailed", retryable: false },
        recovery: { kind: "capture", profile },
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn’t prepare this image",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("evaluationFailed");
  });

  it("moves focus to each state heading", () => {
    const lifecycle = createLifecycle();
    const { rerender } = renderFlow({ lifecycle });

    expect(
      screen.getByRole("heading", { name: "Add a photo of the food" }),
    ).toHaveFocus();

    rerender(
      <CaptureFlow
        state={{
          kind: "preparingImage",
          profile,
          image: { id: "image-1" },
        }}
        imageLifecycle={lifecycle}
        preparedImage={null}
        dispatch={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Preparing your image" }),
    ).toHaveFocus();
  });
});
