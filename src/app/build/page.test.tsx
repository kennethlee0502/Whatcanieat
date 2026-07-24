import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BuildPage, { metadata } from "@/app/build/page";

afterEach(cleanup);

describe("build page", () => {
  it("documents the current validated deterministic pipeline", () => {
    render(<BuildPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Evidence before conclusions.",
      }),
    ).toBeInTheDocument();
    const pipeline = screen.getByRole("list");
    expect(pipeline).toHaveTextContent(/AI extracts structured food facts/i);
    expect(pipeline).toHaveTextContent(/validated and normalized/i);
    expect(pipeline).toHaveTextContent(/deterministic TypeScript rules/i);
    expect(pipeline).toHaveTextContent(/validated response/i);
  });

  it("keeps extraction, evaluation, evidence, and profile ownership distinct", () => {
    render(<BuildPage />);

    expect(
      screen.getByText(/AI does not produce the verdict/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sole owner of the recommendation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Measurements and locally calculated BMI stay out/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contradictory observations remain represented/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/rule definitions are versioned and carry reviewed/i),
    ).toBeInTheDocument();
  });

  it("states current limitations without speculative commitments", () => {
    render(<BuildPage />);

    expect(screen.getByText(/cannot reliably reveal every hidden ingredient/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Future possibilities" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/documents only the current implementation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/avoids speculative commitments/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/coming soon|roadmap|future database|future accounts|future history/i),
    ).not.toBeInTheDocument();
  });

  it("provides internal navigation and route-specific metadata", () => {
    render(<BuildPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Check a food" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(metadata.title).toBe("How It Works | Can / I Eat This?");
    expect(metadata.description).toBe(
      "How Can / I Eat This? separates food-fact extraction from deterministic dietary evaluation.",
    );
  });
});
