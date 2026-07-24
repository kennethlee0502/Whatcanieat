import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPage, { metadata } from "@/app/privacy/page";

afterEach(cleanup);

describe("privacy page", () => {
  it("accurately separates stored, in-memory, and transmitted data", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your data stays temporary.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What stays in session storage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/image, its temporary object URL, extracted food facts/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pregnancy information when applicable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/height, weight, BMI, profile labels/i),
    ).toBeInTheDocument();
  });

  it("describes provider processing and current privacy controls", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/to OpenAI to extract structured food facts/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not intentionally log images, profiles/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no server database for them/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Clear All removes the saved session profile/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/not HIPAA compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/not medical advice, diagnosis/i)).toBeInTheDocument();
  });

  it("provides semantic, internal navigation", () => {
    render(<PrivacyPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("navigation", { name: "Product information" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check a food" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/build",
    );
  });

  it("exports route-specific metadata", () => {
    expect(metadata.title).toBe("Privacy | Can / I Eat This?");
    expect(metadata.description).toBe(
      "How Can / I Eat This? handles your temporary profile, food image, and analysis data.",
    );
  });
});
