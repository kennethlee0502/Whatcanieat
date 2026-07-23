import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileSetup } from "@/app/app/profile-setup";
import type { UserProfile } from "@/domain/profile";

afterEach(cleanup);

const advanceRequiredSteps = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText("No, I’m not pregnant"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Do you have food allergies?" });
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", {
    name: "Does high blood pressure apply to you?",
  });
  await user.click(screen.getByLabelText("No"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", {
    name: "What is your dietary preference?",
  });
  await user.click(screen.getByLabelText("Neither vegetarian nor vegan"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Add measurements, if you want." });
};

describe("ProfileSetup", () => {
  it("requires an explicit pregnancy answer and focuses the invalid choice", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose whether you are currently pregnant.",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("No, I’m not pregnant")).toHaveFocus(),
    );
  });

  it("reveals an optional pregnancy week only when pregnancy is selected", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);

    expect(screen.queryByLabelText(/Pregnancy week/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Yes, I’m pregnant"));
    expect(screen.getByLabelText(/Pregnancy week/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("No, I’m not pregnant"));
    expect(screen.queryByLabelText(/Pregnancy week/)).not.toBeInTheDocument();
  });

  it("moves focus to the next step heading", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);

    await user.click(screen.getByLabelText("No, I’m not pregnant"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const heading = await screen.findByRole("heading", {
      name: "Do you have food allergies?",
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("keeps diet mutually exclusive and allergy severity unspecified by default", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);

    await user.click(screen.getByLabelText("No, I’m not pregnant"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Do you have food allergies?" });
    await user.type(screen.getByLabelText(/^Allergy name/), "Peanuts");
    await user.click(screen.getByRole("button", { name: "Add allergy" }));
    expect(screen.getByLabelText("Severity you would use")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", {
      name: "Does high blood pressure apply to you?",
    });
    await user.click(screen.getByLabelText("No"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", {
      name: "What is your dietary preference?",
    });

    const vegetarian = screen.getByLabelText("Vegetarian");
    const vegan = screen.getByLabelText("Vegan");
    await user.click(vegetarian);
    expect(vegetarian).toBeChecked();
    await user.click(vegan);
    expect(vegan).toBeChecked();
    expect(vegetarian).not.toBeChecked();
  });

  it("clears a stale allergy error when the allergy name changes", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);
    await user.click(screen.getByLabelText("No, I’m not pregnant"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Do you have food allergies?" });

    await user.click(screen.getByRole("button", { name: "Add allergy" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an allergy name",
    );
    await user.type(screen.getByLabelText(/^Allergy name/), "Milk");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Allergy name/)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("clears a duplicate allergy error when the conflicting allergy is removed", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);
    await user.click(screen.getByLabelText("No, I’m not pregnant"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Do you have food allergies?" });

    const allergyName = screen.getByLabelText(/^Allergy name/);
    await user.type(allergyName, "Milk");
    await user.click(screen.getByRole("button", { name: "Add allergy" }));
    await user.type(allergyName, "Milk");
    await user.click(screen.getByRole("button", { name: "Add allergy" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That allergy is already listed.",
    );

    await user.click(screen.getByRole("button", { name: "Remove Milk" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(allergyName).toHaveAttribute("aria-invalid", "false");
  });

  it("focuses invalid weight without marking valid height invalid", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);
    await advanceRequiredSteps(user);
    const height = screen.getByLabelText(/^Height/);
    const weight = screen.getByLabelText(/^Weight/);
    await user.type(height, "170");
    await user.type(weight, "0");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(weight).toHaveFocus());
    expect(weight).toHaveAttribute("aria-invalid", "true");
    expect(height).toHaveAttribute("aria-invalid", "false");
  });

  it("focuses invalid height without marking valid weight invalid", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup onSave={vi.fn()} />);
    await advanceRequiredSteps(user);
    const height = screen.getByLabelText(/^Height/);
    const weight = screen.getByLabelText(/^Weight/);
    await user.type(height, "0");
    await user.type(weight, "70");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(height).toHaveFocus());
    expect(height).toHaveAttribute("aria-invalid", "true");
    expect(weight).toHaveAttribute("aria-invalid", "false");
  });

  it("submits a validated profile only after a successful storage callback", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockReturnValue({ status: "success" });
    render(<ProfileSetup onSave={onSave} />);
    await advanceRequiredSteps(user);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      pregnancy: { status: "notPregnant" },
      allergies: [],
      highBloodPressure: false,
      diet: "none",
    } satisfies UserProfile);
  });

  it("preserves entries, reports storage failure, and allows retry", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockReturnValueOnce({ status: "error", reason: "writeFailed" })
      .mockReturnValueOnce({ status: "success" });
    render(<ProfileSetup onSave={onSave} />);
    await advanceRequiredSteps(user);
    await user.type(screen.getByLabelText(/^Height/), "170");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your entries are still here. Try again.",
    );
    expect(screen.getByLabelText(/^Height/)).toHaveValue(170);
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
