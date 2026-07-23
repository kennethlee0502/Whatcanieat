import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplicationView } from "@/app/app/app-experience";
import type { UserProfile } from "@/domain/profile";

const saveProfile = vi.fn();
const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
};

afterEach(cleanup);

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
      />,
    );

    expect(
      screen.getByText("Your temporary profile is ready."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "profileEditRequested" });
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
